#!/usr/bin/env node
/**
 * commentor — remove comments from source code files
 *
 * Usage:
 *   commentor [options] <file|dir> [file|dir...]
 *   cat file.js | commentor --stdin --lang javascript
 *
 * Options:
 *   --write, -w          Overwrite files in-place (default: dry-run, print to stdout)
 *   --check, -c          Exit 1 if any file has comments; do not modify files
 *   --stdin              Read from stdin; requires --lang
 *   --lang <id>          Force language id (e.g. javascript, python, go)
 *   --ext <.ts,.js>      Only process these extensions (comma-separated)
 *   --keep-license       Keep @license / @preserve comments (default: true)
 *   --no-keep-license    Remove @license / @preserve comments too
 *   --json               Output JSON report instead of text
 *   --stats              Print summary statistics after processing
 *   --version, -v        Print version and exit
 *   --help, -h           Print this help
 *
 * Exit codes:
 *   0  Success (dry-run: no comments found or --check with no comments)
 *   1  Failure (error occurred, or --check found comments)
 *   2  Usage error (bad arguments)
 */

import { parseArgs } from 'node:util';
import { readFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../src/strip.js';
import { stripCommentsFromFile, stripCommentsFromDir } from '../src/fileProcessor.js';
import { getLanguageForFile, listLanguageIds } from '../src/languages.js';
import { EXIT_OK, EXIT_FAILURE, EXIT_USAGE } from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));

// ─────────────────────────────────────────────────────────────── argument parsing ──

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      write:           { type: 'boolean', short: 'w', default: false },
      check:           { type: 'boolean', short: 'c', default: false },
      stdin:           { type: 'boolean',              default: false },
      lang:            { type: 'string' },
      ext:             { type: 'string' },
      'keep-license':  { type: 'boolean', default: true },
      json:            { type: 'boolean', default: false },
      stats:           { type: 'boolean', default: false },
      version:         { type: 'boolean', short: 'v', default: false },
      help:            { type: 'boolean', short: 'h', default: false },
    },
  });
} catch (err) {
  printError(err.message);
  process.exit(EXIT_USAGE);
}

const {
  values: opts,
  positionals: targets,
} = parsed;

if (opts.help) {
  printHelp();
  process.exit(EXIT_OK);
}

if (opts.version) {
  process.stdout.write(`commentor-cli v${pkg.version}\n`);
  process.exit(EXIT_OK);
}

// ──────────────────────────────────────────────────────────────── validation ──

if (opts.stdin && targets.length > 0) {
  printError('--stdin cannot be combined with file/dir targets');
  process.exit(EXIT_USAGE);
}

if (opts.stdin && !opts.lang) {
  printError('--stdin requires --lang <language-id>');
  process.exit(EXIT_USAGE);
}

if (opts.lang && !listLanguageIds().includes(opts.lang)) {
  printError(`Unknown language "${opts.lang}". Supported: ${listLanguageIds().join(', ')}`);
  process.exit(EXIT_USAGE);
}

if (!opts.stdin && targets.length === 0) {
  printHelp();
  process.exit(EXIT_USAGE);
}

if (opts.write && opts.check) {
  printError('--write and --check are mutually exclusive');
  process.exit(EXIT_USAGE);
}

const extensions = opts.ext
  ? opts.ext.split(',').map((e) => (e.startsWith('.') ? e.toLowerCase() : '.' + e.toLowerCase()))
  : null;

const keepLicense = opts['keep-license'];

// ────────────────────────────────────────────────────────────────────── main ──

(async () => {
  try {
    if (opts.stdin) {
      await runStdin();
    } else {
      await runTargets();
    }
  } catch (err) {
    printError(err.message);
    process.exit(EXIT_FAILURE);
  }
})();

async function runStdin() {
  const chunks = [];
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    chunks.push(line);
  }
  const code = chunks.join('\n');

  const result = stripComments(code, { lang: opts.lang, keepLicense });

  if (opts.json) {
    process.stdout.write(JSON.stringify({ stdin: true, ...result }) + '\n');
  } else {
    process.stdout.write(result.code);
  }
}

async function runTargets() {
  const results = [];
  const { stat } = await import('node:fs/promises');

  for (const target of targets) {
    const abs = resolve(target);
    let st;
    try {
      st = await stat(abs);
    } catch {
      printError(`Cannot access "${abs}"`);
      process.exit(EXIT_FAILURE);
    }

    if (st.isDirectory()) {
      for await (const r of stripCommentsFromDir(abs, {
        write: opts.write,
        keepLicense,
        extensions,
      })) {
        results.push(r);
        if (!opts.json && !opts.check) {
          printFileResult(r);
        }
      }
    } else {
      const langId = opts.lang ?? getLanguageForFile(abs);
      if (!langId) {
        if (!opts.json) {
          process.stderr.write(`skip  ${abs} — unknown extension\n`);
        }
        continue;
      }
      const r = await stripCommentsFromFile(abs, { write: opts.write, keepLicense, lang: opts.lang });
      results.push(r);
      if (!opts.json && !opts.check) {
        printFileResult(r);
      }
    }
  }

  const totalComments = results.reduce((s, r) => s + (r.commentsRemoved ?? 0), 0);
  const totalKept     = results.reduce((s, r) => s + (r.commentsKept ?? 0), 0);
  const totalLines    = results.reduce((s, r) => s + (r.linesRemoved ?? 0), 0);
  const totalCharsB   = results.reduce((s, r) => s + (r.charsBefore ?? 0), 0);
  const totalCharsA   = results.reduce((s, r) => s + (r.charsAfter ?? 0), 0);
  const changed       = results.filter((r) => r.changed).length;
  const skipped       = results.filter((r) => r.skipped).length;

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      files:    results.length,
      changed,
      skipped,
      commentsRemoved: totalComments,
      commentsKept:    totalKept,
      linesRemoved:    totalLines,
      charsBefore:     totalCharsB,
      charsAfter:      totalCharsA,
      results,
    }, null, 2) + '\n');
  }

  if (opts.stats && !opts.json) {
    const pct = totalCharsB > 0 ? ((1 - totalCharsA / totalCharsB) * 100).toFixed(1) : '0.0';
    process.stderr.write([
      '',
      `  Files processed : ${results.length - skipped}`,
      `  Files skipped   : ${skipped}`,
      `  Files changed   : ${changed}`,
      `  Comments removed: ${totalComments}`,
      `  Comments kept   : ${totalKept} (@license / @preserve)`,
      `  Lines removed   : ${totalLines}`,
      `  Size reduction  : ${pct}%`,
      '',
    ].join('\n'));
  }

  if (opts.check) {
    if (totalComments > 0) {
      process.stderr.write(`commentor: ${totalComments} comment(s) found across ${results.length - skipped} file(s)\n`);
      process.exit(EXIT_FAILURE);
    }
    process.exit(EXIT_OK);
  }

  process.exit(EXIT_OK);
}

// ─────────────────────────────────────────────────────────────────── helpers ──

function printFileResult(r) {
  if (r.skipped) {
    process.stderr.write(`skip  ${r.filePath} (${r.skipReason})\n`);
    return;
  }
  const status = r.changed ? 'done' : 'clean';
  const detail = r.changed
    ? `-${r.commentsRemoved} comment(s), -${r.linesRemoved} line(s)`
    : 'no comments';
  process.stderr.write(`${status}  ${r.filePath}  ${detail}\n`);
}

function printError(msg) {
  process.stderr.write(`commentor: error: ${msg}\n`);
  process.stderr.write(`Run "commentor --help" for usage.\n`);
}

function printHelp() {
  process.stdout.write(`
commentor v${pkg.version} — remove all comments from source code

USAGE
  commentor [options] <file|dir> [file|dir...]
  cat file.js | commentor --stdin --lang javascript

OPTIONS
  -w, --write           Overwrite files in-place (default: dry-run)
  -c, --check           Exit 1 if any file contains comments
      --stdin           Read from stdin (requires --lang)
      --lang <id>       Force a language id
      --ext <.ts,.js>   Only process files with these extensions
      --keep-license    Keep @license / @preserve blocks (default: on)
      --no-keep-license Remove @license / @preserve blocks too
      --json            Output machine-readable JSON report
      --stats           Print a summary after processing
  -v, --version         Print version
  -h, --help            Print this help

SUPPORTED LANGUAGES
  ${listLanguageIds().join(', ')}

EXAMPLES
  commentor src/                   # dry-run: show what would change
  commentor --write src/           # strip comments in-place
  commentor --check src/           # fail in CI if comments exist
  commentor --stats --write src/   # write + summary
  cat file.py | commentor --stdin --lang python | tee clean.py
  commentor --ext .ts,.tsx --write src/
`);
}