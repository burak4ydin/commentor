/**
 * Central constants for commentor-cli.
 * All tunable limits live here so there are no magic numbers elsewhere.
 */

/** Directories that are never walked into when scanning a project. */
export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  'target',
  'vendor',
  'venv',
  '.venv',
  '__pycache__',
  '.idea',
  '.vscode',
]);

/** Files larger than this (bytes) are skipped to keep the CLI responsive. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Bytes inspected from the start of a file to detect binary content. */
export const BINARY_SNIFF_BYTES = 8192;

/** Comments containing these markers are kept by default (legal notices). */
export const LICENSE_PATTERN = /@(?:license|preserve)\b/i;

/** Exit codes used by the CLI. */
export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

/** Words after which a `/` starts a regex literal, not division (JS family). */
export const REGEX_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);

/** Characters that mean "a value just ended", so `/` is division, not a regex. */
export const VALUE_CHARS = new Set([
  ')',
  ']',
  '}',
  '"',
  "'",
  '`',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
]);