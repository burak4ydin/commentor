/**
 * Core unit tests for stripComments.
 * Uses node:test (built-in, no install required).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from '../src/strip.js';

// ──────────────────────────────────────────────────────── helpers ──

function strip(code, lang) {
  return stripComments(code, { lang, keepLicense: false }).code;
}

function stripKeep(code, lang) {
  return stripComments(code, { lang, keepLicense: true }).code;
}

function stats(code, lang, keepLicense = false) {
  return stripComments(code, { lang, keepLicense });
}

// ──────────────────────────────────────────────────────── JavaScript ──

describe('JavaScript — line comments', () => {
  it('removes a standalone line comment', () => {
    assert.equal(strip('// hello\nconst x = 1;\n', 'javascript'), 'const x = 1;\n');
  });

  it('removes a trailing line comment', () => {
    assert.equal(strip('const x = 1; // hello\n', 'javascript'), 'const x = 1;\n');
  });

  it('preserves // inside a string', () => {
    const code = 'const u = "http://example.com";\n';
    assert.equal(strip(code, 'javascript'), code);
  });

  it('preserves // inside a single-quoted string', () => {
    const code = "const s = 'http://x.co';\n";
    assert.equal(strip(code, 'javascript'), code);
  });

  it('preserves // inside a template literal', () => {
    const code = 'const s = `url: http://x.co`;\n';
    assert.equal(strip(code, 'javascript'), code);
  });

  it('handles multiple line comments', () => {
    const code = '// a\nconst x = 1;\n// b\nconst y = 2;\n';
    assert.equal(strip(code, 'javascript'), 'const x = 1;\nconst y = 2;\n');
  });

  it('preserves shebang on first line', () => {
    const code = '#!/usr/bin/env node\n// comment\nconst x = 1;\n';
    const result = strip(code, 'javascript');
    assert.ok(result.startsWith('#!/usr/bin/env node\n'), 'shebang preserved');
    assert.ok(!result.includes('// comment'), 'comment removed');
  });
});

describe('JavaScript — block comments', () => {
  it('removes a standalone block comment', () => {
    assert.equal(strip('/* hello */\nconst x = 1;\n', 'javascript'), 'const x = 1;\n');
  });

  it('removes a multi-line block comment', () => {
    const code = '/*\n * docs\n */\nconst x = 1;\n';
    assert.equal(strip(code, 'javascript'), 'const x = 1;\n');
  });

  it('collapses inline block comment to a space', () => {
    const result = strip('const x = /* val */ 1;\n', 'javascript');
    assert.ok(!result.includes('/*'), 'block removed');
    assert.ok(result.includes('const x ='), 'code before preserved');
    assert.ok(result.includes('1;'), 'code after preserved');
  });

  it('keeps @license comments when keepLicense=true', () => {
    const code = '/* @license MIT */\nconst x = 1;\n';
    assert.ok(stripKeep(code, 'javascript').includes('@license'), 'license kept');
    assert.ok(!strip(code, 'javascript').includes('@license'), 'license removed');
  });

  it('keeps @preserve comments when keepLicense=true', () => {
    const code = '/* @preserve important */\nconst x = 1;\n';
    assert.ok(stripKeep(code, 'javascript').includes('@preserve'));
  });
});

describe('JavaScript — regex vs division disambiguation', () => {
  it('does not confuse division with a comment', () => {
    const code = 'const r = a / b; // comment\n';
    const result = strip(code, 'javascript');
    assert.ok(result.includes('a / b'), 'division preserved');
    assert.ok(!result.includes('// comment'), 'comment removed');
  });

  it('preserves regex literals', () => {
    const code = 'const re = /hello\\/world/gi;\n';
    assert.equal(strip(code, 'javascript'), code);
  });

  it('preserves regex after return keyword', () => {
    const code = 'function f() { return /test/; }\n';
    assert.equal(strip(code, 'javascript'), code);
  });

  it('does not treat /* inside a regex as a comment', () => {
    const code = 'const re = /\\/\\*/;\n';
    assert.equal(strip(code, 'javascript'), code);
  });
});

describe('JavaScript — template literals', () => {
  it('preserves template literal with expression', () => {
    const code = 'const s = `hello ${name}`;\n';
    assert.equal(strip(code, 'javascript'), code);
  });

  it('removes comment inside template interpolation', () => {
    const code = 'const s = `${/* remove me */x + 1}`;\n';
    const result = strip(code, 'javascript');
    assert.ok(!result.includes('remove me'));
    assert.ok(result.includes('x + 1'));
  });
});

describe('JavaScript — stats', () => {
  it('counts removed and kept comments', () => {
    const code = '// line\n/* @license MIT */\nconst x = 1;\n';
    const r = stats(code, 'javascript', true);
    assert.equal(r.commentsRemoved, 1);
    assert.equal(r.commentsKept, 1);
  });

  it('charsBefore >= charsAfter', () => {
    const code = '// comment\nconst x = 1;\n';
    const r = stats(code, 'javascript');
    assert.ok(r.charsBefore >= r.charsAfter);
  });
});

// ──────────────────────────────────────────────────────── Python ──

describe('Python — comments', () => {
  it('removes a standalone # comment', () => {
    assert.equal(strip('# comment\nx = 1\n', 'python'), 'x = 1\n');
  });

  it('removes a trailing # comment', () => {
    const result = strip('x = 1  # comment\n', 'python');
    assert.ok(result.includes('x = 1'));
    assert.ok(!result.includes('# comment'));
  });

  it('preserves # inside a string', () => {
    const code = 'x = "not a # comment"\n';
    assert.equal(strip(code, 'python'), code);
  });

  it('preserves docstrings (triple quotes are not comments)', () => {
    const code = 'def f():\n    """docstring"""\n    pass\n';
    assert.equal(strip(code, 'python'), code);
  });

  it('preserves shebang', () => {
    const code = '#!/usr/bin/env python3\n# comment\nx = 1\n';
    const result = strip(code, 'python');
    assert.ok(result.startsWith('#!/usr/bin/env python3'));
    assert.ok(!result.includes('# comment'));
  });
});

// ──────────────────────────────────────────────────────── HTML ──

describe('HTML — comments', () => {
  it('removes HTML comment', () => {
    const code = '<!-- comment -->\n<p>Hello</p>\n';
    const result = strip(code, 'html');
    assert.ok(!result.includes('<!-- comment -->'));
    assert.ok(result.includes('<p>Hello</p>'));
  });

  it('removes multi-line HTML comment', () => {
    const code = '<!--\n  multi\n  line\n-->\n<p>text</p>\n';
    const result = strip(code, 'html');
    assert.ok(!result.includes('<!--'));
    assert.ok(result.includes('<p>text</p>'));
  });

  it('removes inline HTML comment between elements', () => {
    const code = '<p>A</p><!-- note --><p>B</p>\n';
    const result = strip(code, 'html');
    assert.ok(!result.includes('<!-- note -->'));
    assert.ok(result.includes('<p>A</p>'));
    assert.ok(result.includes('<p>B</p>'));
  });
});

// ──────────────────────────────────────────────────────── CSS ──

describe('CSS — comments', () => {
  it('removes /* comment */', () => {
    const code = '/* reset */\nbody { margin: 0; }\n';
    const result = strip(code, 'css');
    assert.ok(!result.includes('/* reset */'));
    assert.ok(result.includes('body { margin: 0; }'));
  });

  it('preserves /* inside a string', () => {
    const code = 'content: "not/* a comment */";\n';
    assert.equal(strip(code, 'css'), code);
  });
});

// ──────────────────────────────────────────────────────── SCSS ──

describe('SCSS — comments', () => {
  it('removes // and /* */ comments', () => {
    const code = '// line\n$color: red; /* block */\n';
    const result = strip(code, 'scss');
    assert.ok(!result.includes('// line'));
    assert.ok(!result.includes('/* block */'));
    assert.ok(result.includes('$color: red;'));
  });
});

// ──────────────────────────────────────────────────────── SQL ──

describe('SQL — comments', () => {
  it('removes -- comments', () => {
    const code = '-- select all\nSELECT * FROM t;\n';
    const result = strip(code, 'sql');
    assert.ok(!result.includes('-- select all'));
    assert.ok(result.includes('SELECT * FROM t;'));
  });

  it('removes /* */ block comments', () => {
    const code = '/* filter */\nWHERE id = 1;\n';
    const result = strip(code, 'sql');
    assert.ok(!result.includes('/* filter */'));
    assert.ok(result.includes('WHERE id = 1;'));
  });

  it('preserves -- inside a string', () => {
    const code = "SELECT '--not a comment' AS s;\n";
    assert.equal(strip(code, 'sql'), code);
  });

  it('handles SQL double-escape (two single quotes = literal quote)', () => {
    const code = "SELECT 'it''s fine' AS s;\n";
    assert.equal(strip(code, 'sql'), code);
  });
});

// ──────────────────────────────────────────────────────── Lua ──

describe('Lua — comments', () => {
  it('removes -- line comments', () => {
    const code = '-- comment\nlocal x = 1\n';
    const result = strip(code, 'lua');
    assert.ok(!result.includes('-- comment'));
    assert.ok(result.includes('local x = 1'));
  });

  it('removes --[[ long bracket comments ]]', () => {
    const code = '--[[\n  long comment\n]]\nlocal x = 1\n';
    const result = strip(code, 'lua');
    assert.ok(!result.includes('long comment'));
    assert.ok(result.includes('local x = 1'));
  });

  it('removes --[=[ level-1 long bracket ]=]', () => {
    const code = '--[=[\n  level1\n]=]\nlocal x = 1\n';
    const result = strip(code, 'lua');
    assert.ok(!result.includes('level1'));
  });

  it('preserves -- inside a string', () => {
    const code = 'local s = "not -- a comment"\n';
    assert.equal(strip(code, 'lua'), code);
  });
});

// ──────────────────────────────────────────────────────── Shell ──

describe('Shell — comments', () => {
  it('removes # line comments', () => {
    const code = '# comment\necho hello\n';
    const result = strip(code, 'shell');
    assert.ok(!result.includes('# comment'));
    assert.ok(result.includes('echo hello'));
  });

  it('preserves # inside a string', () => {
    const code = 'echo "not # a comment"\n';
    assert.equal(strip(code, 'shell'), code);
  });

  it('preserves shebang', () => {
    const code = '#!/bin/bash\n# comment\necho hi\n';
    const result = strip(code, 'shell');
    assert.ok(result.startsWith('#!/bin/bash'));
    assert.ok(!result.includes('# comment'));
  });
});

// ──────────────────────────────────────────────────────── Go ──

describe('Go — comments', () => {
  it('removes // line comments', () => {
    const code = '// Package doc\npackage main\n';
    const result = strip(code, 'go');
    assert.ok(!result.includes('// Package doc'));
    assert.ok(result.includes('package main'));
  });

  it('removes /* */ block comments', () => {
    const code = '/* block */\npackage main\n';
    const result = strip(code, 'go');
    assert.ok(!result.includes('/* block */'));
  });

  it('preserves // inside a raw string literal', () => {
    const code = 'x := `url: http://example.com`\n';
    assert.equal(strip(code, 'go'), code);
  });
});

// ──────────────────────────────────────────────────────── Rust ──

describe('Rust — comments', () => {
  it('removes // line comments', () => {
    const code = '// comment\nlet x = 1;\n';
    const result = strip(code, 'rust');
    assert.ok(!result.includes('// comment'));
    assert.ok(result.includes('let x = 1;'));
  });

  it('removes /* */ block comments', () => {
    const code = '/* block */\nlet x = 1;\n';
    const result = strip(code, 'rust');
    assert.ok(!result.includes('/* block */'));
  });

  it('preserves lifetime annotations (not comments)', () => {
    const code = "fn longest<'a>(x: &'a str) -> &'a str { x }\n";
    assert.equal(strip(code, 'rust'), code);
  });

  it('preserves char literals', () => {
    const code = "let c: char = 'a';\n";
    assert.equal(strip(code, 'rust'), code);
  });
});

// ──────────────────────────────────────────────────────── YAML ──

describe('YAML — comments', () => {
  it('removes # comments', () => {
    const code = '# comment\nkey: value\n';
    const result = strip(code, 'yaml');
    assert.ok(!result.includes('# comment'));
    assert.ok(result.includes('key: value'));
  });

  it('preserves # inside a quoted string', () => {
    const code = 'key: "not # a comment"\n';
    assert.equal(strip(code, 'yaml'), code);
  });
});

// ──────────────────────────────────────────────────────── PHP ──

describe('PHP — comments', () => {
  it('removes // line comments', () => {
    const code = '<?php\n// comment\n$x = 1;\n';
    const result = strip(code, 'php');
    assert.ok(!result.includes('// comment'));
    assert.ok(result.includes('$x = 1;'));
  });

  it('removes # line comments', () => {
    const code = '<?php\n# comment\n$x = 1;\n';
    const result = strip(code, 'php');
    assert.ok(!result.includes('# comment'));
    assert.ok(result.includes('$x = 1;'));
  });

  it('removes /* */ block comments', () => {
    const code = '<?php\n/* block */\n$x = 1;\n';
    const result = strip(code, 'php');
    assert.ok(!result.includes('/* block */'));
  });
});

// ──────────────────────────────────────────────────────── C-family ──

describe('C — comments', () => {
  it('removes // and /* */ comments', () => {
    const code = '// line\nint x = 1; /* inline */\n';
    const result = strip(code, 'c');
    assert.ok(!result.includes('// line'));
    assert.ok(!result.includes('/* inline */'));
    assert.ok(result.includes('int x = 1;'));
  });
});

describe('C# — comments', () => {
  it('removes // and /* */ comments', () => {
    const code = '// doc\nvar x = 1; /* note */\n';
    const result = strip(code, 'csharp');
    assert.ok(!result.includes('// doc'));
    assert.ok(!result.includes('/* note */'));
    assert.ok(result.includes('var x = 1;'));
  });
});

// ──────────────────────────────────────────────────────── PowerShell ──

describe('PowerShell — comments', () => {
  it('removes # line comments', () => {
    const code = '# comment\n$x = 1\n';
    const result = strip(code, 'powershell');
    assert.ok(!result.includes('# comment'));
    assert.ok(result.includes('$x = 1'));
  });

  it('removes <# block comments #>', () => {
    const code = '<#\n  block\n#>\n$x = 1\n';
    const result = strip(code, 'powershell');
    assert.ok(!result.includes('block'));
    assert.ok(result.includes('$x = 1'));
  });
});

// ──────────────────────────────────────────────────────── Ruby ──

describe('Ruby — comments', () => {
  it('removes # line comments', () => {
    const code = '# comment\nx = 1\n';
    const result = strip(code, 'ruby');
    assert.ok(!result.includes('# comment'));
    assert.ok(result.includes('x = 1'));
  });

  it('removes =begin...=end block comments', () => {
    const code = '=begin\n  block\n=end\nx = 1\n';
    const result = strip(code, 'ruby');
    assert.ok(!result.includes('block'));
    assert.ok(result.includes('x = 1'));
  });

  it('does NOT treat =begin mid-line as a block comment', () => {
    const code = 'x = begin # not =begin comment\n  1\nend\n';
    // should not crash and x = begin line should remain
    const result = strip(code, 'ruby');
    assert.ok(result.includes('x = begin'));
  });
});

// ──────────────────────────────────────────────────────── INI / TOML ──

describe('INI — comments', () => {
  it('removes ; and # comments', () => {
    const code = '; comment\n# hash comment\nkey=value\n';
    const result = strip(code, 'ini');
    assert.ok(!result.includes('; comment'));
    assert.ok(!result.includes('# hash comment'));
    assert.ok(result.includes('key=value'));
  });
});

describe('TOML — comments', () => {
  it('removes # comments', () => {
    const code = '# comment\nkey = "value"\n';
    const result = strip(code, 'toml');
    assert.ok(!result.includes('# comment'));
    assert.ok(result.includes('key = "value"'));
  });
});

// ──────────────────────────────────────────────────────── Edge cases ──

describe('Edge cases', () => {
  it('handles empty string', () => {
    assert.equal(strip('', 'javascript'), '');
  });

  it('handles code with no comments', () => {
    const code = 'const x = 1;\nconst y = 2;\n';
    assert.equal(strip(code, 'javascript'), code);
  });

  it('handles code that is only a comment', () => {
    const result = strip('// just a comment\n', 'javascript');
    assert.equal(result.trim(), '');
  });

  it('throws on unknown language', () => {
    assert.throws(() => strip('x', 'cobol'), /Unknown language/);
  });

  it('throws on non-string code', () => {
    assert.throws(() => strip(null, 'javascript'), /must be a string/);
  });

  it('does not double-remove overlapping ranges', () => {
    // Nested /* /* */ — just a regression guard, should not throw
    assert.doesNotThrow(() => strip('/* outer /* inner */ code */', 'javascript'));
  });

  it('handles adjacent comments', () => {
    const code = '// first\n// second\nconst x = 1;\n';
    const result = strip(code, 'javascript');
    assert.ok(!result.includes('first'));
    assert.ok(!result.includes('second'));
    assert.ok(result.includes('const x = 1;'));
  });
});