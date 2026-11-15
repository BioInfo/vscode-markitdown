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
