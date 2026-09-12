/**
 * Comment removal: turns scanner ranges into precise edits and applies them.
 *
 * Removal semantics:
 * - A comment that owns an entire line removes the whole line including the newline.
 * - A trailing comment removes itself plus the whitespace between code and comment.
 * - A comment between two pieces of code collapses to a single space so tokens stay separated.
 * - Comments containing @license or @preserve are kept when keepLicense is true (default).
 */

import { scanComments } from './scanner.js';
import { LANGUAGES, listLanguageIds } from './languages.js';

const WS_CHARS = new Set([' ', '\t']);

function eolIndex(code, from) {
  const idx = code.indexOf('\n', from);
  return idx === -1 ? code.length : idx;
}

function trimLeft(code, from, limit) {
  let s = from;
  while (s > limit && WS_CHARS.has(code[s - 1])) {
    s -= 1;
  }
  return s;
}

function trimRight(code, from, limit) {
  let e = from;
  while (e < limit && WS_CHARS.has(code[e])) {
    e += 1;
  }
  return e;
}

function countNewlines(text) {
  let n = 0;
  for (const ch of text) {
    if (ch === '\n') n += 1;
  }
  return n;
}

function lineStartOf(code, pos) {
  return pos === 0 ? 0 : code.lastIndexOf('\n', pos - 1) + 1;
}

/**
 * Convert comment ranges into concrete text edits.
 * @returns {{ edits: Array<{start:number, end:number, replacement:string}>, linesRemoved: number }}
 */
function buildEdits(code, removes) {
  const edits = [];
  let linesRemoved = 0;

  for (const range of removes) {
    const lineStart = lineStartOf(code, range.start);
    const before    = code.slice(lineStart, range.start);     // text on same line before comment
    const lineEnd   = eolIndex(code, range.end);
    const after     = code.slice(range.end, lineEnd);         // text on same line after comment

    if (range.kind === 'line') {
      if (before.trim() === '') {
        // Comment owns the full line — drop line + its newline
        const end2 = code[range.end] === '\n' ? range.end + 1 : range.end;
        linesRemoved += 1;
        edits.push({ start: lineStart, end: end2, replacement: '' });
      } else {
        // Trailing line comment — strip whitespace + comment, keep the code before it
        const start2 = trimLeft(code, range.start, lineStart);
        edits.push({ start: start2, end: range.end, replacement: '' });
      }
      continue;
    }

    // block comment
    if (before.trim() === '' && after.trim() === '') {
      // Comment owns full line(s) — drop everything including the trailing newline
      const end2 = code[lineEnd] === '\n' ? lineEnd + 1 : lineEnd;
      linesRemoved += countNewlines(code.slice(lineStart, end2));
      edits.push({ start: lineStart, end: end2, replacement: '' });
    } else if (after.trim() === '') {
      // Block comment is at the end of real code — drop comment + trailing whitespace to EOL
      const start2 = trimLeft(code, range.start, lineStart);
      const removed = code.slice(start2, lineEnd);
      linesRemoved += countNewlines(removed);
      edits.push({ start: start2, end: lineEnd, replacement: '' });
    } else if (before.trim() === '') {
      // Block comment leads the line — drop it and any trailing whitespace up to the code
      const end2 = trimRight(code, range.end, lineEnd);
      edits.push({ start: range.start, end: end2, replacement: '' });
    } else {
      // Block comment sits between two code tokens — collapse to a single space
      const start2 = trimLeft(code, range.start, lineStart);
      const end2   = trimRight(code, range.end, lineEnd);
      linesRemoved += countNewlines(code.slice(start2, end2));
      edits.push({ start: start2, end: end2, replacement: ' ' });
    }
  }

  return { edits, linesRemoved };
}

/**
 * Apply edits to the code in a single left-to-right pass.
 */
function applyEdits(code, edits) {
  const sorted = [...edits].sort((a, b) => a.start - b.start || b.end - a.end);
  const parts = [];
  let pos = 0;
  for (const edit of sorted) {
    if (edit.start < pos) continue; // skip overlapping edits
    parts.push(code.slice(pos, edit.start));
    parts.push(edit.replacement);
    pos = edit.end;
  }
  parts.push(code.slice(pos));
  return parts.join('');
}

/**
 * Strip all comments from a source string.
 *
 * @param {string} code source code
 * @param {{ lang: string, keepLicense?: boolean }} options
 *   lang is a language id from languages.js (e.g. 'javascript', 'python')
 * @returns {{
 *   code: string,
 *   language: string,
 *   commentsRemoved: number,
 *   commentsKept: number,
 *   linesRemoved: number,
 *   charsBefore: number,
 *   charsAfter: number
 * }}
 */
export function stripComments(code, { lang, keepLicense = true } = {}) {
  if (typeof code !== 'string') {
    throw new TypeError('code must be a string');
  }
  const spec = LANGUAGES[lang];
  if (!spec) {
    throw new Error(`Unknown language "${lang}". Supported: ${listLanguageIds().join(', ')}`);
  }

  const { removes, keeps } = scanComments(code, spec, { keepLicense });
  const { edits, linesRemoved } = buildEdits(code, removes);
  const cleaned = edits.length === 0 ? code : applyEdits(code, edits);

  return {
    code: cleaned,
    language: spec.id,
    commentsRemoved: removes.length,
    commentsKept: keeps.length,
    linesRemoved,
    charsBefore: code.length,
    charsAfter: cleaned.length,
  };
}