// Plain-Node unit tests for logic that has no vscode dependency.
// Run after `npm run compile`: node --test scripts/unit-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parsePythonVersion, isSupportedPython, NO_PIP_CANDIDATES } = require('../out/python/pythonVersion.js');

test('parsePythonVersion reads major.minor from --version output', () => {
    assert.deepEqual(parsePythonVersion('Python 3.14.6'), [3, 14]);
    assert.deepEqual(parsePythonVersion('Python 3.10.0\n'), [3, 10]);
    assert.deepEqual(parsePythonVersion('Python 2.7.18'), [2, 7]);
    assert.equal(parsePythonVersion(''), null);
    assert.equal(parsePythonVersion('command not found'), null);
});

test('isSupportedPython accepts 3.10 and newer, with no upper bound', () => {
    for (const v of [[3, 10], [3, 14], [3, 15], [3, 20], [4, 0]]) {
        assert.equal(isSupportedPython(v), true, `expected ${v} supported`);
    }
    for (const v of [[3, 9], [3, 7], [2, 7], null]) {
        assert.equal(isSupportedPython(v), false, `expected ${v} unsupported`);
    }
});

test('NO_PIP_CANDIDATES matches only an empty candidate list', () => {
    assert.equal(NO_PIP_CANDIDATES.test('(from versions: )'), true);
    assert.equal(NO_PIP_CANDIDATES.test('(from versions: none)'), true);
    assert.equal(NO_PIP_CANDIDATES.test('(from versions: 0.0.1a1)'), false);
});

// ---------------------------------------------------------------- formats
const { SUPPORTED_EXTENSIONS } = require('../out/formats.js');
const pkg = JSON.parse(require('node:fs').readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

test('every menu clause lists exactly the supported extensions', () => {
    const fileMenus = Object.values(pkg.contributes.menus).flat()
        .filter(m => m.command === 'markitdown.convertFile' && /resourceExtname/.test(m.when));
    assert.ok(fileMenus.length >= 2, 'expected explorer and editor-title menus');
    for (const m of fileMenus) {
        const listed = m.when.match(/\(([^)]+)\)/)[1].split('|').sort();
        assert.deepEqual(listed, [...SUPPORTED_EXTENSIONS].sort(), `menu clause out of sync: ${m.when}`);
    }
});

// ------------------------------------------------------------ output path
const { resolveOutputPath, resolveOutputDir } = require('../out/conversion/outputPath.js');
const path = require('node:path');
const taken = (...names) => async p => names.includes(path.basename(p));

test('resolveOutputPath uses name.md when free', async () => {
    assert.equal(path.basename(await resolveOutputPath('/d/a.pdf', { overwriteExisting: false }, taken())), 'a.md');
});

test('resolveOutputPath numbers around existing files', async () => {
    const p = await resolveOutputPath('/d/a.pdf', { overwriteExisting: false }, taken('a.md', 'a-1.md'));
    assert.equal(path.basename(p), 'a-2.md');
});

test('resolveOutputPath throws instead of overwriting when all numbers are taken', async () => {
    const all = ['a.md', ...Array.from({ length: 100 }, (_, i) => `a-${i + 1}.md`)];
    await assert.rejects(resolveOutputPath('/d/a.pdf', { overwriteExisting: false }, taken(...all)), /free filename/);
});

test('resolveOutputPath with overwrite returns name.md even if it exists', async () => {
    assert.equal(path.basename(await resolveOutputPath('/d/a.pdf', { overwriteExisting: true }, taken('a.md'))), 'a.md');
});

test('resolveOutputPath honours outputDir', async () => {
    assert.equal(await resolveOutputPath('/d/a.pdf', { overwriteExisting: false, outputDir: '/out' }, taken()), path.join('/out', 'a.md'));
});

test('resolveOutputDir: empty, absolute, relative to workspace or file', () => {
    assert.equal(resolveOutputDir('', '/w/sub/a.pdf', '/w'), undefined);
    assert.equal(resolveOutputDir('/abs', '/w/sub/a.pdf', '/w'), '/abs');
    assert.equal(resolveOutputDir('md', '/w/sub/a.pdf', '/w'), path.join('/w', 'md'));
    assert.equal(resolveOutputDir('md', '/x/a.pdf', undefined), path.join('/x', 'md'));
});

// ------------------------------------------------------- categorization
const { categorize, ErrorCategory, EnvironmentError, ConversionError } = require('../out/utils/errorCategory.js');

test('a path containing "python" or "access" does not change the category', () => {
    const r = categorize(new Error('File not found or not readable: /Users/me/Python projects/access log.pdf'));
    assert.equal(r.category, ErrorCategory.MarkitdownError);
    assert.match(r.message, /Python projects/);
});

test('typed errors keep their message and map to the right category', () => {
    assert.equal(categorize(new EnvironmentError('Found Python 3.9', 'fix')).message, 'Found Python 3.9');
    assert.equal(categorize(new ConversionError('damaged', 'corrupt')).category, ErrorCategory.CorruptInput);
    assert.equal(categorize(new ConversionError('nope', 'unsupported')).category, ErrorCategory.UnsupportedFormat);
    assert.equal(categorize(Object.assign(new Error('Cancelled'), { name: 'ProcessCancelledError' })).category, ErrorCategory.Cancelled);
});

// --------------------------------------------------------------- process
const { runProcess, ProcessTimeoutError, ProcessCancelledError } = require('../out/python/process.js');
const node = process.execPath;

test('runProcess returns exit code and output', async () => {
    const r = await runProcess(node, ['-e', 'process.stdout.write("hi"); process.exit(3)'], { timeoutMs: 10000 });
    assert.equal(r.exitCode, 3);
    assert.equal(r.stdout, 'hi');
});

test('runProcess reports a signal death as exit code -1, not success', { skip: process.platform === 'win32' }, async () => {
    const r = await runProcess(node, ['-e', 'process.kill(process.pid, "SIGKILL")'], { timeoutMs: 10000 });
    assert.equal(r.exitCode, -1);
    assert.equal(r.signal, 'SIGKILL');
});

test('runProcess times out and kills the child', async () => {
    const t0 = Date.now();
    await assert.rejects(runProcess(node, ['-e', 'setTimeout(()=>{}, 60000)'], { timeoutMs: 500 }), ProcessTimeoutError);
    assert.ok(Date.now() - t0 < 5000);
});

test('runProcess can be cancelled', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 200);
    await assert.rejects(runProcess(node, ['-e', 'setTimeout(()=>{}, 60000)'], { timeoutMs: 30000, signal: ac.signal }), ProcessCancelledError);
});

test('runProcess decodes UTF-8 split across chunks', async () => {
    const r = await runProcess(node, ['-e', 'const b=Buffer.from("héllo ✓"); process.stdout.write(b.subarray(0,2)); setTimeout(()=>process.stdout.write(b.subarray(2)),50)'], { timeoutMs: 10000 });
    assert.equal(r.stdout, 'héllo ✓');
});

test('a missing venv interpreter under a path with spaces is an environment error', () => {
    const r = categorize(new Error('spawn /Users/x/Library/Application Support/Code/User/globalStorage/bioinfo.markitdown-vscode/markitdown-venv/bin/python ENOENT'));
    assert.equal(r.category, ErrorCategory.EnvironmentMissing);
});

test('killAllChildren stops a running child (used on deactivate)', { skip: process.platform === 'win32' }, async () => {
    const { killAllChildren } = require('../out/python/process.js');
    const running = runProcess(node, ['-e', 'setTimeout(()=>{}, 60000)'], { timeoutMs: 30000 });
    await new Promise(r => setTimeout(r, 200));
    killAllChildren();
    const r = await running;
    assert.equal(r.exitCode, -1);
});
