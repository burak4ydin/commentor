/**
 * Language specifications for commentor-cli.
 *
 * A spec is pure data; the scanner in scanner.js interprets it.
 * Supported spec fields:
 *   id / label        - identity
 *   extensions        - file extensions mapped to this language (lowercase, with dot)
 *   lineComments      - tokens starting a comment that runs to end of line
 *   blockComments     - [open, close] pairs spanning multiple lines
 *   strings           - string delimiters: { delim, escape, multiline, interpolation, doubles }
 *   shebang           - preserve a "#!" first line
 *   regexLiterals     - JS-style `/regex/` detection with division disambiguation
 *   braceGuard        - treat `${ ... }` in code as literal shell expansion (no comments inside)
 *   lifetimeAware     - Rust: distinguish char literals from lifetimes, handle raw strings
 *   customBlocks      - language-specific block comments (Lua long brackets, Ruby =begin)
 */

const jsStrings = [
  { delim: "'", escape: '\\' },
  { delim: '"', escape: '\\' },
  { delim: '`', escape: '\\', multiline: true, interpolation: '${' },
];

export const LANGUAGES = {
  javascript: {
    id: 'javascript',
    label: 'JavaScript / TypeScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.jsonc', '.json5'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: jsStrings,
    shebang: true,
    regexLiterals: true,
  },

  python: {
    id: 'python',
    label: 'Python',
    extensions: ['.py', '.pyw'],
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { delim: "'''", escape: '\\', multiline: true },
      { delim: '"""', escape: '\\', multiline: true },
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
  },

  ruby: {
    id: 'ruby',
    label: 'Ruby',
    extensions: ['.rb'],
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\', interpolation: '#{' },
    ],
    shebang: true,
    customBlocks: ['ruby'],
  },

  html: {
    id: 'html',
    label: 'HTML / XML',
    extensions: ['.html', '.htm', '.xhtml', '.xml', '.svg'],
    lineComments: [],
    blockComments: [['<!--', '-->']],
    strings: [],
    shebang: false,
  },

  css: {
    id: 'css',
    label: 'CSS',
    extensions: ['.css'],
    lineComments: [],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
  },

  scss: {
    id: 'scss',
    label: 'SCSS / LESS',
    extensions: ['.scss', '.less', '.sass'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
  },

  sql: {
    id: 'sql',
    label: 'SQL',
    extensions: ['.sql'],
    lineComments: ['--'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: "'", escape: null, doubles: true },
      { delim: '"', escape: null, doubles: true },
    ],
    shebang: false,
  },

  lua: {
    id: 'lua',
    label: 'Lua',
    extensions: ['.lua'],
    lineComments: ['--'],
    blockComments: [],
    strings: [
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
    customBlocks: ['lua'],
  },

  shell: {
    id: 'shell',
    label: 'Shell / Bash',
    extensions: ['.sh', '.bash', '.zsh', '.ksh'],
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { delim: "'", escape: null },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
    braceGuard: true,
    commentBoundary: true,
  },

  dockerfile: {
    id: 'dockerfile',
    label: 'Dockerfile',
    extensions: ['.dockerfile'],
    fileNames: ['dockerfile'],
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { delim: "'", escape: null },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
    braceGuard: true,
    commentBoundary: true,
    lineStartComments: true,
  },

  yaml: {
    id: 'yaml',
    label: 'YAML',
    extensions: ['.yml', '.yaml'],
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { delim: "'", escape: null },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
    commentBoundary: true,
  },

  toml: {
    id: 'toml',
    label: 'TOML',
    extensions: ['.toml'],
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { delim: "'''", escape: '\\', multiline: true },
      { delim: '"""', escape: '\\', multiline: true },
      { delim: "'", escape: null },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
    commentBoundary: true,
  },

  ini: {
    id: 'ini',
    label: 'INI / Config',
    extensions: ['.ini', '.cfg', '.conf', '.properties', '.env'],
    lineComments: [';', '#'],
    blockComments: [],
    strings: [
      { delim: "'", escape: null },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
    commentBoundary: true,
  },

  java: {
    id: 'java',
    label: 'Java',
    extensions: ['.java'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: '"""', escape: null, multiline: true },
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
  },

  kotlin: {
    id: 'kotlin',
    label: 'Kotlin',
    extensions: ['.kt', '.kts'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: '"""', escape: null, multiline: true },
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
  },

  scala: {
    id: 'scala',
    label: 'Scala',
    extensions: ['.scala', '.sc'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: '"""', escape: null, multiline: true },
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
  },

  groovy: {
    id: 'groovy',
    label: 'Groovy',
    extensions: ['.groovy', '.gradle'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: "'''", escape: '\\', multiline: true },
      { delim: '"""', escape: '\\', multiline: true },
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
  },

  c: {
    id: 'c',
    label: 'C / C++',
    extensions: ['.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx', '.ino'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
  },

  csharp: {
    id: 'csharp',
    label: 'C#',
    extensions: ['.cs'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
  },

  go: {
    id: 'go',
    label: 'Go',
    extensions: ['.go'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: '`', escape: null, multiline: true },
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: false,
  },

  rust: {
    id: 'rust',
    label: 'Rust',
    extensions: ['.rs'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
    lifetimeAware: true,
  },

  swift: {
    id: 'swift',
    label: 'Swift',
    extensions: ['.swift'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: '"""', escape: '\\', multiline: true },
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
  },

  dart: {
    id: 'dart',
    label: 'Dart',
    extensions: ['.dart'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: "'''", escape: '\\', multiline: true },
      { delim: '"""', escape: '\\', multiline: true },
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
  },

  php: {
    id: 'php',
    label: 'PHP',
    extensions: ['.php', '.phtml'],
    lineComments: ['//', '#'],
    blockComments: [['/*', '*/']],
    strings: [
      { delim: "'", escape: null },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
  },

  powershell: {
    id: 'powershell',
    label: 'PowerShell',
    extensions: ['.ps1', '.psm1'],
    lineComments: ['#'],
    blockComments: [['<#', '#>']],
    strings: [
      { delim: "'", escape: null, doubles: true },
      { delim: '"', escape: '`' },
    ],
    shebang: false,
  },

  perl: {
    id: 'perl',
    label: 'Perl',
    extensions: ['.pl', '.pm', '.t'],
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
  },

  r: {
    id: 'r',
    label: 'R',
    extensions: ['.r'],
    lineComments: ['#'],
    blockComments: [],
    strings: [
      { delim: "'", escape: '\\' },
      { delim: '"', escape: '\\' },
    ],
    shebang: true,
  },

  makefile: {
    id: 'makefile',
    label: 'Makefile',
    extensions: ['.mk'],
    fileNames: ['makefile'],
    lineComments: ['#'],
    blockComments: [],
    strings: [],
    shebang: false,
  },
};

/** extension (lowercase, with dot) -> language id */
const EXT_TO_LANG = new Map();
/** basename (lowercase) -> language id (Dockerfile, Makefile, ...) */
const FILENAME_TO_LANG = new Map();

for (const spec of Object.values(LANGUAGES)) {
  for (const ext of spec.extensions) {
    EXT_TO_LANG.set(ext, spec.id);
  }
  for (const name of spec.fileNames ?? []) {
    FILENAME_TO_LANG.set(name, spec.id);
  }
}

/**
 * Resolve the language id for a file path.
 * @param {string} filePath absolute or relative path
 * @returns {string | null} language id, or null when the type is unknown
 */
export function getLanguageForFile(filePath) {
  const base = filePath.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot >= 0) {
    const ext = base.slice(dot).toLowerCase();
    const byExt = EXT_TO_LANG.get(ext);
    if (byExt) {
      return byExt;
    }
  }
  return FILENAME_TO_LANG.get(base.toLowerCase()) ?? null;
}

/** All supported language ids in registry order. */
export function listLanguageIds() {
  return Object.keys(LANGUAGES);
}

/** Human readable label for a language id. */
export function languageLabel(langId) {
  return LANGUAGES[langId]?.label ?? langId;
}