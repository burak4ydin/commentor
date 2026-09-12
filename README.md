# commentor-cli

> Strip comments from source code — fast, multi-language, zero dependencies.

[![npm version](https://img.shields.io/npm/v/commentor-cli.svg)](https://www.npmjs.com/package/commentor-cli)
[![license](https://img.shields.io/npm/l/commentor-cli.svg)](LICENSE)
[![node](https://img.shields.io/node/v/commentor-cli.svg)](package.json)
[![tests](https://img.shields.io/badge/tests-70%20passing-brightgreen.svg)](test/strip.test.js)

`commentor` removes every comment from your source files while leaving strings, regex literals, template literals and shebangs completely intact. Supports **25+ languages** with a single, zero-dependency install.

---

## Install

```bash
npm install -g commentor-cli   # global CLI
npm install commentor-cli      # library
```

---

## CLI

```bash
# Dry-run: show what would change (default, nothing is written)
commentor src/

# Strip comments in-place
commentor --write src/

# Fail in CI if any comments are found
commentor --check src/

# Read from stdin
cat file.py | commentor --stdin --lang python

# Only process certain extensions
commentor --write --ext .ts,.tsx src/

# Machine-readable JSON report
commentor --json src/

# Summary statistics
commentor --stats --write src/

# Keep @license / @preserve blocks (default: on), or remove them too
commentor --write src/
commentor --no-keep-license --write src/
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--write`, `-w` | off | Overwrite files in-place |
| `--check`, `-c` | off | Exit 1 if any file contains comments |
| `--stdin` | off | Read from stdin (requires `--lang`) |
| `--lang <id>` | auto | Force a language id |
| `--ext <.ts,.js>` | all | Only process these extensions |
| `--keep-license` | on | Keep `@license` / `@preserve` blocks |
| `--no-keep-license` | — | Remove `@license` / `@preserve` blocks |
| `--json` | off | Output JSON report |
| `--stats` | off | Print summary after processing |
| `--version`, `-v` | — | Print version |
| `--help`, `-h` | — | Print help |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error, or `--check` found comments |
| `2` | Usage error |

---

## Before / After

**Input** (`utils.ts`):
```typescript
// Format a price as currency string
export function formatPrice(
  amount: number, // amount in cents
  /* currency code */ currency = 'USD',
): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}
```

**Output** after `commentor --write utils.ts`:
```typescript
export function formatPrice(
  amount: number,
  currency = 'USD',
): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}
```

---

## Library API

```js
import { stripComments, stripCommentsFromFile, stripCommentsFromDir } from 'commentor-cli';

// Strip from a string
const result = stripComments(code, { lang: 'javascript' });
console.log(result.code);           // cleaned source
console.log(result.commentsRemoved); // number of comments stripped
console.log(result.linesRemoved);    // lines removed
console.log(result.charsBefore, result.charsAfter);

// Strip a single file (dry-run by default)
const r = await stripCommentsFromFile('./src/app.ts', { keepLicense: true });
if (r.changed) console.log(`${r.commentsRemoved} comment(s) removed`);

// Strip an entire directory and collect results
for await (const r of stripCommentsFromDir('./src', { write: true })) {
  if (!r.skipped) console.log(r.filePath, r.commentsRemoved);
}
```

### `stripComments(code, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lang` | `string` | required | Language id (see table below) |
| `keepLicense` | `boolean` | `true` | Preserve `@license` / `@preserve` |

Returns `{ code, language, commentsRemoved, commentsKept, linesRemoved, charsBefore, charsAfter }`.

### `stripCommentsFromFile(filePath, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `write` | `boolean` | `false` | Overwrite the file |
| `keepLicense` | `boolean` | `true` | Preserve `@license` / `@preserve` |
| `lang` | `string` | auto | Force a language id |

### `stripCommentsFromDir(dirPath, options)` (async generator)

Same options as `stripCommentsFromFile`, plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extensions` | `string[]` | all | Filter by extension (e.g. `['.ts', '.js']`) |
| `skipDirs` | `Set<string>` | built-in | Directory names to skip |

---

## Supported Languages

| Language | Extensions |
|----------|-----------|
| JavaScript / TypeScript | `.js` `.jsx` `.mjs` `.cjs` `.ts` `.tsx` `.mts` `.cts` `.jsonc` `.json5` |
| Python | `.py` `.pyw` |
| Ruby | `.rb` |
| HTML / XML | `.html` `.htm` `.xhtml` `.xml` `.svg` |
| CSS | `.css` |
| SCSS / LESS | `.scss` `.less` `.sass` |
| SQL | `.sql` |
| Lua | `.lua` |
| Shell / Bash | `.sh` `.bash` `.zsh` `.ksh` |
| Dockerfile | `Dockerfile` |
| YAML | `.yml` `.yaml` |
| TOML | `.toml` |
| INI / Config | `.ini` `.cfg` `.conf` `.properties` `.env` |
| Java | `.java` |
| Kotlin | `.kt` `.kts` |
| Scala | `.scala` `.sc` |
| Groovy / Gradle | `.groovy` `.gradle` |
| C / C++ | `.c` `.h` `.cpp` `.cc` `.cxx` `.hpp` |
| C# | `.cs` |
| Go | `.go` |
| Rust | `.rs` |
| Swift | `.swift` |
| Dart | `.dart` |
| PHP | `.php` `.phtml` |
| PowerShell | `.ps1` `.psm1` |
| Perl | `.pl` `.pm` `.t` |
| R | `.r` |
| Makefile | `Makefile` `.mk` |

---

## What is preserved

- **Strings** — `//`, `--`, `#` inside any string literal are never treated as comments
- **Regex literals** (JS/TS) — `/pattern/` is distinguished from division `a / b`
- **Template literals** — backtick strings with `${}` interpolation
- **Shebangs** — `#!/usr/bin/env node` on line 1 is always kept
- **`@license` / `@preserve`** — legal notices kept by default (disable with `--no-keep-license`)
- **Docstrings** — Python `"""..."""` and `'''...'''` are strings, not comments

---

## How it works

`commentor` uses a hand-written character-level state machine — no regular expressions, no AST. It tracks string, template literal, regex and block-comment depth simultaneously so it never strips a `//` that lives inside a string or a `/*` that's part of a regex character class.

---

## FAQ

**Does it handle nested block comments?**
Most languages do not support nesting — `/* outer /* inner */ code */` is handled correctly because the scanner closes at the first `*/`. Rust's nested block comments are treated the same way (closing on first `*/`).

**Is it safe to run on production code?**
Use `commentor src/` (dry-run) first to review changes. The `--check` flag lets you assert "no comments" in CI without modifying anything.

**What about JSDoc / TSDoc?**
They are comments and are removed. If you need to keep them, include `@preserve` in the block (`/** @preserve ... */`).

---

## Real-world examples

### Python script cleanup

```python
# Before
import os  # standard library

def get_env(key: str, default: str = "") -> str:
    """Return env var or default."""  # docstring stays — it's not a comment
    # fetch from environment
    return os.environ.get(key, default)  # may return empty string
```

```python
# After — commentor --write script.py
import os

def get_env(key: str, default: str = "") -> str:
    """Return env var or default."""
    return os.environ.get(key, default)
```

### Go package

```go
// Before
package main

import "fmt" // stdlib

// main is the entry point.
func main() {
    /* greet the world */
    fmt.Println("hello") // output
}
```

```go
// After — commentor --write main.go
package main

import "fmt"

func main() {
    fmt.Println("hello")
}
```

### SQL migration

```sql
-- Before
-- drop old table
DROP TABLE IF EXISTS legacy_users;

-- recreate with new schema
CREATE TABLE users (
    id   SERIAL PRIMARY KEY, /* surrogate key */
    name TEXT NOT NULL       -- display name
);
```

```sql
-- After — commentor --write migration.sql
DROP TABLE IF EXISTS legacy_users;

CREATE TABLE users (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);
```

---

## License

MIT © [Burak Aydın](https://github.com/burak4ydin)