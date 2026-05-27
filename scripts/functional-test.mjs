#!/usr/bin/env node
/**
 * CLI functional test harness for MarkItDown.
 *
 * Exercises the REAL conversion path the extension uses: it builds a Python
 * venv, installs the same pinned markitdown spec the extension installs, then
 * converts every fixture in test-files/fixtures/ through the shipped
 * python/markitdown_runner.py and asserts the output. No VS Code, no manual
 * steps. Exits non-zero if any expectation fails.
 *
 *   node scripts/functional-test.mjs            # build venv if needed, run
 *   MARKITDOWN_TEST_VENV=/path node ...         # reuse an existing venv
 *   node scripts/functional-test.mjs --keep     # keep venv between runs (default)
 *
 * Keep MARKITDOWN_SPEC in sync with src/python/environmentManager.ts.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'python', 'markitdown_runner.py');
const FIXTURES = path.join(ROOT, 'test-files', 'fixtures');

// Mirror of the extension's install spec. Targeted extras (not [all]) so it
// resolves on modern Python (3.13/3.14); the >=0.1.6 floor blocks pip's silent
// backtrack to the weak 0.0.2 release.
const MARKITDOWN_SPEC =
  'markitdown[docx,pptx,xlsx,xls,pdf,outlook,audio-transcription]>=0.1.6,<0.2.0';

// fixture -> case-insensitive substrings every conversion must contain.
// `null` means "expected to be empty" (markitdown does EXIF/LLM, not OCR, so a
// plain image yields no text — we assert the runner reports that cleanly).
const EXPECTATIONS = {
  'with_image.docx': ['Quarterly Report', 'Revenue', '1.2M'],
  'plain.docx': ['Plain Doc', 'no graphics'],
  'sheet.xlsx': ['Alice', '95', 'Bob'],
  'deck.pptx': ['Deck Title', 'Bullet one'],
  'doc.pdf': ['Hello from PDF fixture'],
  'data.csv': ['col1', 'col2'],
  'data.json': ['items'],
  'data.xml': ['alpha', 'beta'],
  'page.html': ['Title', 'bold'],
  'pic.png': null,
};

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf-8', ...opts });
}

function findPython() {
  for (const c of ['python3', 'python']) {
    const r = run(c, ['--version']);
    if (r.status === 0) return c;
  }
  return null;
}

function venvPython(venv) {
  return process.platform === 'win32'
    ? path.join(venv, 'Scripts', 'python.exe')
    : path.join(venv, 'bin', 'python');
}

function setupVenv() {
  if (process.env.MARKITDOWN_TEST_VENV) {
    const py = venvPython(process.env.MARKITDOWN_TEST_VENV);
    if (!existsSync(py)) {
      fail(`MARKITDOWN_TEST_VENV set but no python at ${py}`);
    }
    return py;
  }

  const venv = path.join(ROOT, '.test-venv');
  const py = venvPython(venv);
  const sysPython = findPython();
  if (!sysPython) fail('No python3/python found on PATH.');

  if (!existsSync(py)) {
    console.log('• creating venv (.test-venv)…');
    const r = run(sysPython, ['-m', 'venv', venv]);
    if (r.status !== 0) fail(`venv creation failed:\n${r.stderr}`);
  }

  // Always run the same check the extension runs; install only if it fails.
  const check = run(py, [RUNNER, 'check']);
  if (check.status === 0) {
    console.log(`• markitdown ${check.stdout.trim()} present, skipping install`);
  } else {
    console.log(`• installing ${MARKITDOWN_SPEC} (first run, may take a minute)…`);
    const inst = run(py, ['-m', 'pip', 'install', '--upgrade', MARKITDOWN_SPEC], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    if (inst.status !== 0) fail('pip install failed (see output above).');
    const recheck = run(py, [RUNNER, 'check']);
    if (recheck.status !== 0) fail(`post-install check failed:\n${recheck.stderr}`);
    console.log(`• markitdown ${recheck.stdout.trim()} installed`);
  }
  return py;
}

function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

function main() {
  if (!existsSync(RUNNER)) fail(`runner not found: ${RUNNER}`);
  if (!existsSync(FIXTURES)) fail(`fixtures not found: ${FIXTURES}`);

  const py = setupVenv();
  const tmp = mkdtempSync(path.join(tmpdir(), 'mid-fn-'));
  const results = [];

  for (const [fixture, expect] of Object.entries(EXPECTATIONS)) {
    const input = path.join(FIXTURES, fixture);
    if (!existsSync(input)) {
      results.push({ fixture, ok: false, detail: 'fixture missing' });
      continue;
    }
    const output = path.join(tmp, fixture + '.md');
    const r = run(py, [RUNNER, 'convert', input, output]);

    if (r.status !== 0) {
      results.push({ fixture, ok: false, detail: `convert exited ${r.status}: ${r.stderr.trim()}` });
      continue;
    }
    const chars = parseInt((r.stdout.match(/CHARS:(\d+)/) || [])[1] ?? '-1', 10);
    const text = existsSync(output) ? readFileSync(output, 'utf-8') : '';

    if (expect === null) {
      // Expected-empty: runner must succeed and report 0 chars (no crash).
      const ok = chars === 0;
      results.push({ fixture, ok, detail: ok ? 'empty as expected' : `expected empty, got ${chars} chars` });
      continue;
    }

    const lc = text.toLowerCase();
    const missing = expect.filter((s) => !lc.includes(s.toLowerCase()));
    const ok = chars > 0 && missing.length === 0;
    results.push({
      fixture,
      ok,
      detail: ok ? `${chars} chars, all markers present` : `missing markers: ${missing.join(', ')}`,
    });
  }

  console.log('\n── Functional results ──');
  let failed = 0;
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.fixture.padEnd(18)} ${r.detail}`);
    if (!r.ok) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
