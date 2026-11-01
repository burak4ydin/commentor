export interface StripResult {
  code: string;
  language: string;
  commentsRemoved: number;
  commentsKept: number;
  linesRemoved: number;
  charsBefore: number;
  charsAfter: number;
}

export interface StripOptions {
  lang: string;
  keepLicense?: boolean;
}

export interface FileResult {
  filePath: string;
  language: string | null;
  skipped: boolean;
  skipReason?: 'unknown-extension' | 'too-large' | 'binary';
  commentsRemoved: number;
  commentsKept: number;
  linesRemoved: number;
  charsBefore: number;
  charsAfter: number;
  changed: boolean;
}

export interface FileOptions {
  write?: boolean;
  keepLicense?: boolean;
  lang?: string;
}

export interface DirOptions extends FileOptions {
  extensions?: string[];
  skipDirs?: Set<string>;
}

export interface LanguageSpec {
  id: string;
  label: string;
  extensions: string[];
  lineComments: string[];
  blockComments: [string, string][];
  strings: Array<{
    delim: string;
    escape: string | null;
    multiline?: boolean;
    interpolation?: string;
    doubles?: boolean;
  }>;
  shebang?: boolean;
  regexLiterals?: boolean;
  braceGuard?: boolean;
  lifetimeAware?: boolean;
  customBlocks?: string[];
  fileNames?: string[];
}

export declare function stripComments(code: string, options: StripOptions): StripResult;

export declare function stripCommentsFromFile(filePath: string, options?: FileOptions): Promise<FileResult>;

export declare function stripCommentsFromDir(dirPath: string, options?: DirOptions): AsyncGenerator<FileResult>;

export declare function getLanguageForFile(filePath: string): string | null;

export declare function listLanguageIds(): string[];

export declare function languageLabel(langId: string): string;

export declare const LANGUAGES: Record<string, LanguageSpec>;