import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

// End to end in a real VS Code: activate, build the Python environment from
// scratch (uv when installed, else pip), convert a fixture, check the output.
// Slow on the first run (it installs markitdown), so it has a long timeout.
suite('End to end', function () {
    this.timeout(20 * 60 * 1000);

    const fixtures = path.resolve(__dirname, '../../../test-files/fixtures');
    let tmp: string;

    suiteSetup(async () => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mid-e2e-'));
        await vscode.workspace.getConfiguration('markitdown')
            .update('openFileOnSuccess', false, vscode.ConfigurationTarget.Global);
    });

    test('converts a DOCX through the extension command', async () => {
        const input = path.join(tmp, 'plain.docx');
        fs.copyFileSync(path.join(fixtures, 'plain.docx'), input);
        await vscode.commands.executeCommand('markitdown.convertFile', vscode.Uri.file(input));
        const output = path.join(tmp, 'plain.md');
        assert.ok(fs.existsSync(output), 'plain.md was not written');
        assert.match(fs.readFileSync(output, 'utf-8'), /Plain Doc/);
    });

    test('a second conversion does not overwrite the first', async () => {
        const input = path.join(tmp, 'plain.docx');
        await vscode.commands.executeCommand('markitdown.convertFile', vscode.Uri.file(input));
        assert.ok(fs.existsSync(path.join(tmp, 'plain-1.md')), 'plain-1.md was not written');
    });

    test('batch conversion of a folder writes one file per input', async () => {
        const dir = path.join(tmp, 'batch');
        fs.mkdirSync(dir);
        for (const f of ['sheet.xlsx', 'deck.pptx', 'doc.pdf']) {
            fs.copyFileSync(path.join(fixtures, f), path.join(dir, f));
        }
        await vscode.commands.executeCommand('markitdown.convertFile', vscode.Uri.file(dir));
        for (const f of ['sheet.md', 'deck.md', 'doc.md']) {
            assert.ok(fs.existsSync(path.join(dir, f)), `${f} was not written`);
        }
    });

    test('with overwrite on, two inputs with the same name in one batch get separate files', async () => {
        const cfg = vscode.workspace.getConfiguration('markitdown');
        await cfg.update('overwriteExisting', true, vscode.ConfigurationTarget.Global);
        try {
            const dir = path.join(tmp, 'same-name');
            fs.mkdirSync(dir);
            fs.copyFileSync(path.join(fixtures, 'doc.pdf'), path.join(dir, 'report.pdf'));
            fs.copyFileSync(path.join(fixtures, 'plain.docx'), path.join(dir, 'report.docx'));
            await vscode.commands.executeCommand('markitdown.convertFile', vscode.Uri.file(dir));
            const texts = ['report.md', 'report-1.md'].map(f => {
                assert.ok(fs.existsSync(path.join(dir, f)), `${f} was not written`);
                return fs.readFileSync(path.join(dir, f), 'utf-8');
            }).join('\n');
            assert.match(texts, /Hello from PDF fixture/);
            assert.match(texts, /Plain Doc/);
        } finally {
            await cfg.update('overwriteExisting', undefined, vscode.ConfigurationTarget.Global);
        }
    });
});
