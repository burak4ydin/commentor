/**
 * Token-aware scanner that locates comments in source code.
 *
 * The scanner walks the code character by character, tracking strings,
 * template literals, regexes and language-specific constructs, so that a
 * comment token appearing inside a string (e.g. the "//" in a URL) is never
 * mistaken for a real comment.
 *
 * Language behaviour is driven by the pure-data specs in languages.js.
 */

import { LICENSE_PATTERN, REGEX_KEYWORDS, VALUE_CHARS } from './constants.js';

const WORD_CHAR = /[A-Za-z0-9_$]/;

const isWordChar = (c) => c !== undefined && WORD_CHAR.test(c);

/** Characters after which a `#` may start a comment (shell/YAML/TOML/INI rule). */
const COMMENT_BOUNDARY_CHARS = new Set([';', '|', '&', '(', ')', '{', '}', '[', ']', '<', '>', ',']);

const specCache = new WeakMap();

function prepareSpec(spec) {
  const cached = specCache.get(spec);
  if (cached) {
    return cached;
  }
  const lineComments = [...(spec.lineComments ?? [])].sort((a, b) => b.length - a.length);
  const blockComments = (spec.blockComments ?? [])
    .map(([open, close]) => ({ open, close }))
    .sort((a, b) => b.open.length - a.open.length);
  const strings = [...(spec.strings ?? [])].sort((a, b) => b.delim.length - a.delim.length);
  const prepared = { spec, lineComments, blockComments, strings };
  specCache.set(spec, prepared);
  return prepared;
}

function endOfLineIndex(code, from) {
  const idx = code.indexOf('\n', from);
  return idx === -1 ? code.length : idx;
}

function firstTokenMatch(code, i, tokens) {
  for (const token of tokens) {
    if (code.startsWith(token, i)) {
      return token;
    }
  }
  return null;
}

function matchBlockComment(code, i, blockComments) {
  for (const pair of blockComments) {
    if (code.startsWith(pair.open, i)) {
      const closeIdx = code.indexOf(pair.close, i + pair.open.length);
      return closeIdx === -1 ? code.length : closeIdx + pair.close.length;
    }
  }
  return null;
}

function matchStringDef(code, i, strings) {
  for (const def of strings) {
    if (code.startsWith(def.delim, i)) {
      return def;
    }
  }
  return null;
}

/**
 * Ruby `=begin ... =end` block comments (must sit at column 0).
 * @returns {number | null} absolute end index, or null when not applicable
 */
function rubyCustomBlockEnd(code, i) {
  if (!(i === 0 || code[i - 1] === '\n')) {
    return null;
  }
  if (!code.startsWith('=begin', i)) {
    return null;
  }
  const after = code[i + 6];
  if (after !== undefined && after !== ' ' && after !== '\t' && after !== '\r' && after !== '\n') {
    return null;
  }
  const endIdx = code.indexOf('\n=end', i);
  if (endIdx === -1) {
    return code.length;
  }
  return endOfLineIndex(code, endIdx + 1);
}

/**
 * Lua long-bracket comments: `--[[ ]]`, `--[==[ ]==]`, ...
 * @returns {number | null} absolute end index, or null when not applicable
 */
function luaCustomBlockEnd(code, i) {
  if (!code.startsWith('--', i)) {
    return null;
  }
  const m = /^--\[(=*)\[/.exec(code.slice(i, i + 40));
  if (!m) {
    return null;
  }
  const closer = `]${'='.repeat(m[1].length)}]`;
  const closeIdx = code.indexOf(closer, i + m[0].length);
  return closeIdx === -1 ? code.length : closeIdx + closer.length;
}

function customBlockEnd(code, i, spec) {
  const kinds = spec.customBlocks;
  if (!kinds) {
    return null;
  }
  if (kinds.includes('ruby')) {
    const end = rubyCustomBlockEnd(code, i);
    if (end !== null) {
      return end;
    }
  }
  if (kinds.includes('lua')) {
    const end = luaCustomBlockEnd(code, i);
    if (end !== null) {
      return end;
    }
  }
  return null;
}

/**
 * Rust raw strings: `r"..."`, `r#"..."#`, `br##"..."##`.
 * @returns {{ openLength: number, delim: string } | null}
 */
function rustRawStringStart(code, i) {
  const c = code[i];
  if (c !== 'r' && c !== 'b') {
    return null;
  }
  if (i > 0 && isWordChar(code[i - 1])) {
    return null;
  }
  const m = /^(?:br|r)(#*)"/.exec(code.slice(i, i + 40));
  if (!m) {
    return null;
  }
  return { openLength: m[0].length, delim: `"${'#'.repeat(m[1].length)}"` };
}

/**
 * Rust lifetimes (`'static`) must not be scanned as char literals.
 * @returns {number | null} end index of the lifetime token, or null
 */
function rustLifetimeEnd(code, i) {
  if (code[i] !== "'") {
    return null;
  }
  const next = code[i + 1];
  if (next === undefined || next === '\\' || !isWordChar(next)) {
    return null;
  }
  if (code[i + 2] === "'") {
    return null;
  }
  let end = i + 1;
  while (end < code.length && isWordChar(code[end])) {
    end += 1;
  }
  return end;
}

/**
 * Decide whether a `/` at the current code position starts a regex literal
 * or is a division operator. Uses the classic heuristic: look at the last
 * significant character / word and whether a line break was crossed.
 */
function shouldStartRegex(context) {
  if (context.afterNewline) {
    return true;
  }
  const activeWord = context.word.length > 0 ? context.word : context.lastWord;
  if (activeWord && REGEX_KEYWORDS.has(activeWord.toLowerCase())) {
    return true;
  }
  if (context.word.length > 0) {
    return false;
  }
  if (context.lastSig === '' || isWordChar(context.lastSig) || context.VALUE_CHARS.has(context.lastSig)) {
    return false;
  }
  return true;
}

/**
 * Scan code and return comment ranges.
 *
 * @param {string} code source code
 * @param {object} spec language spec from languages.js
 * @param {{ keepLicense?: boolean }} [options]
 * @returns {{ removes: Array<{start: number, end: number, kind: string}>, keeps: Array<{start: number, end: number, kind: string}> }}
 */
export function scanComments(code, spec, options = {}) {
  const { lineComments, blockComments, strings } = prepareSpec(spec);
  const keepLicense = options.keepLicense !== false;
  const removes = [];
  const keeps = [];

  const context = {
    lastSig: '',
    lastWord: '',
    word: '',
    afterNewline: false,
    VALUE_CHARS,
  };

  const stack = [{ kind: 'code', exitBrace: false, noComments: false, braceDepth: 0, inClass: false }];

  const pushCodeFrame = (extra = {}) => {
    stack.push({ kind: 'code', exitBrace: true, noComments: false, braceDepth: 0, inClass: false, ...extra });
  };

  const resetAfterToken = (sig) => {
    context.lastSig = sig;
    context.lastWord = '';
    context.word = '';
    context.afterNewline = false;
  };

  const pushComment = (start, end, kind) => {
    const text = code.slice(start, end);
    if (keepLicense && LICENSE_PATTERN.test(text)) {
      keeps.push({ start, end, kind });
    } else {
      removes.push({ start, end, kind });
    }
  };

  let i = 0;
  const n = code.length;

  while (i < n) {
    const top = stack[stack.length - 1];

    if (top.kind === 'string') {
      const def = top.def;
      const c = code[i];
      if (def.escape && c === def.escape && i + 1 < n) {
        i += 2;
        continue;
      }
      if (def.interpolation && code.startsWith(def.interpolation, i)) {
        pushCodeFrame();
        i += def.interpolation.length;
        continue;
      }
      if (def.doubles && code.startsWith(def.delim, i) && code.startsWith(def.delim, i + def.delim.length)) {
        i += def.delim.length * 2;
        continue;
      }
      if (code.startsWith(def.delim, i)) {
        stack.pop();
        resetAfterToken(def.delim[0]);
        i += def.delim.length;
        continue;
      }
      if (!def.multiline && c === '\n') {
        // Unterminated single-line string: stop treating it as a string so the
        // rest of the line is scanned as normal code.
        stack.pop();
        continue;
      }
      i += 1;
      continue;
    }

    if (top.kind === 'regex') {
      const c = code[i];
      if (c === '\\' && i + 1 < n) {
        i += 2;
        continue;
      }
      if (c === '[') {
        top.inClass = true;
        i += 1;
        continue;
      }
      if (c === ']') {
        top.inClass = false;
        i += 1;
        continue;
      }
      if (c === '/' && !top.inClass) {
        stack.pop();
        resetAfterToken('/');
        i += 1;
        continue;
      }
      if (c === '\n') {
        // A regex literal cannot span lines: bail out and rescan as code.
        stack.pop();
        continue;
      }
      i += 1;
      continue;
    }

    // --- code mode ---
    const c = code[i];

    if (spec.shebang && i === 0 && code.startsWith('#!', 0)) {
      i = endOfLineIndex(code, 0);
      continue;
    }

    if (spec.braceGuard && c === '$' && code[i + 1] === '{') {
      // shell `${...}` parameter expansion: a `#` inside is not a comment
      pushCodeFrame({ noComments: true });
      i += 2;
      continue;
    }

    if (spec.lifetimeAware) {
      const raw = rustRawStringStart(code, i);
      if (raw) {
        stack.push({ kind: 'string', def: { delim: raw.delim, escape: null, multiline: true } });
        i += raw.openLength;
        continue;
      }
      const lifetimeEnd = rustLifetimeEnd(code, i);
      if (lifetimeEnd !== null) {
        resetAfterToken(code[lifetimeEnd - 1]);
        i = lifetimeEnd;
        continue;
      }
    }

    const customEnd = customBlockEnd(code, i, spec);
    if (customEnd !== null) {
      pushComment(i, customEnd, 'block');
      i = customEnd;
      continue;
    }

    if (!top.noComments) {
      const lineToken = firstTokenMatch(code, i, lineComments);
      if (lineToken && !(i > 0 && code[i - 1] === '$')) {
        const atLineStart = i === 0 || code.slice(code.lastIndexOf('\n', i - 1) + 1, i).trim() === '';
        const hasBoundary = i === 0 || /\s/.test(code[i - 1]) || COMMENT_BOUNDARY_CHARS.has(code[i - 1]);
        const allowed = (spec.lineStartComments ? atLineStart : true)
          && (spec.commentBoundary ? hasBoundary : true);
        if (allowed) {
          const eol = endOfLineIndex(code, i);
          pushComment(i, eol, 'line');
          i = eol;
          continue;
        }
      }

      const blockEnd = matchBlockComment(code, i, blockComments);
      if (blockEnd !== null) {
        pushComment(i, blockEnd, 'block');
        const closeTokenIdx = findBlockCloseStart(code, i, blockComments);
        if (closeTokenIdx !== -1 && !code.slice(i, closeTokenIdx).includes('\n')) {
          context.afterNewline = false;
        }
        i = blockEnd;
        continue;
      }
    }

    const strDef = matchStringDef(code, i, strings);
    if (strDef) {
      stack.push({ kind: 'string', def: strDef, inClass: false });
      i += strDef.delim.length;
      continue;
    }

    if (spec.regexLiterals && c === '/' && shouldStartRegex(context)) {
      stack.push({ kind: 'regex', exitBrace: false, noComments: false, braceDepth: 0, inClass: false });
      i += 1;
      continue;
    }

    if (c === '{' && top.exitBrace) {
      top.braceDepth += 1;
    } else if (c === '}' && top.exitBrace) {
      if (top.braceDepth === 0) {
        stack.pop();
        resetAfterToken('}');
        i += 1;
        continue;
      }
      top.braceDepth -= 1;
    }

    if (isWordChar(c)) {
      context.word += c;
      context.lastSig = c;
      context.lastWord = '';
      context.afterNewline = false;
    } else {
      if (context.word !== '') {
        context.lastWord = context.word;
        context.word = '';
      }
      if (c === '\n') {
        context.afterNewline = true;
      } else if (c !== ' ' && c !== '\t' && c !== '\r') {
        context.lastSig = c;
        context.lastWord = '';
        context.afterNewline = false;
      }
    }
    i += 1;
  }

  return { removes, keeps };
}

/**
 * Find the start index of the closing token for the block comment starting at i.
 * @returns {number} index of the closer, or -1 when unterminated
 */
function findBlockCloseStart(code, i, blockComments) {
  for (const pair of blockComments) {
    if (code.startsWith(pair.open, i)) {
      const closeIdx = code.indexOf(pair.close, i + pair.open.length);
      return closeIdx;
    }
  }
  return -1;
}