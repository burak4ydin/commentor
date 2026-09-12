/**
 * File-level comment stripping with binary detection, size guard and
 * recursive directory walking.
 */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { stripComments } from './strip.js';
import { getLanguageForFile } from './languages.js';
import { SKIP_DIRS, MAX_FILE_SIZE, BINARY_SNIFF_BYTES } from './constants.js';

/**
 * Read bytes from the start of a file to detect binary content.
 * A file is considered binary if the first BINARY_SNIFF_BYTES contain a NUL byte.
 */
async function isBinaryFile(filePath) {
  const fd = await import('node:fs').then((m) => m.promises.open(filePath, 'r'));
  try {
    const buf = Buffer.alloc(BINARY_SNIFF_BYTES);
    const { bytesRead } = await fd.read(buf, 0, BINARY_SNIFF_BYTES, 0);
    return buf.subarray(0, bytesRead).includes(0);
  } finally {
    await fd.close();
  }
}

/**
 * Strip comments from a single file.
 *
 * @param {string} filePath
 * @param {{ write?: boolean, keepLicense?: boolean, lang?: string }} [options]
 * @returns {Promise<{
 *   filePath: string,
 *   language: string | null,
 *   skipped: boolean,
 *   skipReason?: string,
 *   commentsRemoved: number,
 *   commentsKept: number,
 *   linesRemoved: number,
 *   charsBefore: number,
 *   charsAfter: number,
 *   changed: boolean,
 * }>}
 */
export async function stripCommentsFromFile(filePath, options = {}) {
  const abs = resolve(filePath);
  const { write = false, keepLicense = true, lang: forcedLang } = options;

  const langId = forcedLang ?? getLanguageForFile(abs);
  if (!langId) {
    return { filePath: abs, language: null, skipped: true, skipReason: 'unknown-extension', commentsRemoved: 0, commentsKept: 0, linesRemoved: 0, charsBefore: 0, charsAfter: 0, changed: false };
  }

  const fileStat = await stat(abs);
  if (fileStat.size > MAX_FILE_SIZE) {
    return { filePath: abs, language: langId, skipped: true, skipReason: 'too-large', commentsRemoved: 0, commentsKept: 0, linesRemoved: 0, charsBefore: fileStat.size, charsAfter: fileStat.size, changed: false };
  }

  const binary = await isBinaryFile(abs);
  if (binary) {
    return { filePath: abs, language: langId, skipped: true, skipReason: 'binary', commentsRemoved: 0, commentsKept: 0, linesRemoved: 0, charsBefore: fileStat.size, charsAfter: fileStat.size, changed: false };
  }

  const raw = await readFile(abs, 'utf8');
  const result = stripComments(raw, { lang: langId, keepLicense });
  const changed = result.code !== raw;

  if (write && changed) {
    await writeFile(abs, result.code, 'utf8');
  }

  return {
    filePath: abs,
    language: langId,
    skipped: false,
    commentsRemoved: result.commentsRemoved,
    commentsKept: result.commentsKept,
    linesRemoved: result.linesRemoved,
    charsBefore: result.charsBefore,
    charsAfter: result.charsAfter,
    changed,
  };
}

/**
 * Recursively walk a directory and strip comments from all recognised files.
 *
 * @param {string} dirPath
 * @param {{ write?: boolean, keepLicense?: boolean, extensions?: string[], skipDirs?: Set<string> }} [options]
 * @yields {Promise<object>} per-file result (same shape as stripCommentsFromFile)
 */
export async function* stripCommentsFromDir(dirPath, options = {}) {
  const {
    write = false,
    keepLicense = true,
    extensions = null,
    skipDirs = SKIP_DIRS,
  } = options;

  const abs = resolve(dirPath);
  const entries = await readdir(abs, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(abs, entry.name);

    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      yield* stripCommentsFromDir(fullPath, options);
      continue;
    }

    if (!entry.isFile()) continue;

    const langId = getLanguageForFile(fullPath);
    if (!langId) continue;

    if (extensions) {
      const dot = entry.name.lastIndexOf('.');
      const ext = dot >= 0 ? entry.name.slice(dot).toLowerCase() : '';
      if (!extensions.includes(ext)) continue;
    }

    yield await stripCommentsFromFile(fullPath, { write, keepLicense });
  }
}