/**
 * commentor-cli — public library API
 *
 * Usage as a library:
 *   import { stripComments, stripCommentsFromFile } from 'commentor-cli'
 *   const result = stripComments(code, { lang: 'javascript' })
 *   const result = await stripCommentsFromFile('/path/to/file.ts')
 */

export { stripComments } from './strip.js';
export { stripCommentsFromFile, stripCommentsFromDir } from './fileProcessor.js';
export { getLanguageForFile, listLanguageIds, languageLabel, LANGUAGES } from './languages.js';