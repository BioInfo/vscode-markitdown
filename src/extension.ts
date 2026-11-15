import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConversionOrchestrator, isSupportedFile } from './conversion/orchestrator';
import { PythonEnvironmentManager } from './python/environmentManager';
import { killAllChildren } from './python/process';
import { ConfigurationManager } from './config/configurationManager';
import { ErrorHandler, categorize, ErrorCategory } from './utils/errorHandler';
import { SUPPORTED_EXTENSIONS } from './formats';

let errorHandler: ErrorHandler;
let pythonManager: PythonEnvironmentManager;
let orchestrator: ConversionOrchestrator;
let initializePromise: Promise<void> | null = null;

const FOLDER_CONFIRM_THRESHOLD = 25;
const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', 'venv', '__pycache__', '.vscode-test']);

/**
 * Set up the Python environment on first use, behind a cancellable progress
 * notification. Later calls reuse the promise. A failure resets it so the
 * next command retries (after the user installs Python, say).
 */
function ensureInitialized(): Promise<void> {
    if (!initializePromise) {
        initializePromise = (async () => {
            try {
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: 'MarkItDown', cancellable: true },
                    (progress, token) => pythonManager.initialize(progress, token)
                );
            } catch (error) {
                initializePromise = null;
                throw error;
            }
        })();
    }
    return initializePromise;
}

export function activate(context: vscode.ExtensionContext) {
    errorHandler = new ErrorHandler();
    pythonManager = new PythonEnvironmentManager(context, errorHandler);
    orchestrator = new ConversionOrchestrator(pythonManager, new ConfigurationManager(), errorHandler);

    context.subscriptions.push(
        vscode.commands.registerCommand('markitdown.convertFile',
            (uri?: vscode.Uri, selected?: vscode.Uri[]) => report(() => convertCommand(uri, selected), 'Failed to convert')),

        vscode.commands.registerCommand('markitdown.rebuildEnvironment', () => report(async () => {
            initializePromise = null;
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'MarkItDown: rebuilding environment', cancellable: true },
                (progress, token) => pythonManager.rebuild(progress, token)
            );
            vscode.window.showInformationMessage('MarkItDown environment rebuilt.');
        }, 'Failed to rebuild the environment')),

        vscode.commands.registerCommand('markitdown.showEnvironmentInfo', () => report(async () => {
            const info = await pythonManager.describeEnvironment();
            errorHandler.log(`--- Environment info ---\n${info}`);
            errorHandler.outputChannel.show();
        }, 'Failed to read environment info')),

        { dispose: () => errorHandler.dispose() }
    );
}

/** Run a command and report a failure once. */
async function report(fn: () => Promise<void>, context: string): Promise<void> {
    try {
        await fn();
    } catch (error) {
        if (categorize(error).category === ErrorCategory.EnvironmentMissing) {
            initializePromise = null; // re-check the environment on the next command
        }
        errorHandler.handleError(error, context);
    }
}

async function convertCommand(uri?: vscode.Uri, selected?: vscode.Uri[]): Promise<void> {
    const active = vscode.window.activeTextEditor?.document.uri;
    let targets: vscode.Uri[];
    if (selected && selected.length > 0) {
        targets = selected; // Explorer multi-select passes the full selection second
    } else if (uri) {
        targets = [uri];
    } else if (active?.scheme === 'file' && isSupportedFile(active.fsPath)) {
        targets = [active];
    } else {
        const picked = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Convert to Markdown',
            filters: { 'Supported Files': [...SUPPORTED_EXTENSIONS] }
        });
        if (!picked || picked.length === 0) { return; }
        targets = picked;
    }

    const files = await expandFolders(targets);
    if (files === null) { return; } // declined the confirmation
    if (files.length === 0) {
        vscode.window.showWarningMessage('MarkItDown: no supported files found.');
        return;
    }

    await ensureInitialized();

    if (files.length === 1 && targets.length === 1 && targets[0].fsPath === files[0].fsPath) {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Converting ${path.basename(files[0].fsPath)}`, cancellable: true },
            (_progress, token) => orchestrator.convertFile(files[0], { token })
        );
        return;
    }
    await convertBatch(files);
}

/** Replace folders with the supported files inside them (recursive). Null = user declined. */
async function expandFolders(targets: vscode.Uri[]): Promise<vscode.Uri[] | null> {
    const files: vscode.Uri[] = [];
    let sawFolder = false;
    for (const target of targets) {
        const stat = await fs.promises.stat(target.fsPath).catch(() => null);
        if (stat?.isDirectory()) {
            sawFolder = true;
            await walk(target.fsPath, files);
        } else if (targets.length === 1 || isSupportedFile(target.fsPath)) {
            // A single explicit file is passed through so an unsupported one gets a clear error;
            // in a multi-select, unsupported files are skipped.
            files.push(target);
        }
    }
    if (sawFolder && files.length > FOLDER_CONFIRM_THRESHOLD) {
        const choice = await vscode.window.showWarningMessage(
            `Convert ${files.length} files to Markdown?`, { modal: true }, 'Convert');
        if (choice !== 'Convert') { return null; }
    }
    return files;
}

async function walk(dir: string, out: vscode.Uri[]): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
                await walk(full, out);
            }
        } else if (entry.isFile() && isSupportedFile(full)) {
            out.push(vscode.Uri.file(full));
        }
    }
}

/** One progress bar, one summary, failures in the output channel. */
async function convertBatch(files: vscode.Uri[]): Promise<void> {
    const succeeded: string[] = [];
    const empty: string[] = [];
    const failed: Array<{ file: string; error: string }> = [];
    const claimed = new Set<string>();
    let cancelled = false;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'MarkItDown', cancellable: true },
        async (progress, token) => {
            for (let i = 0; i < files.length; i++) {
                if (token.isCancellationRequested) { cancelled = true; break; }
                const name = path.basename(files[i].fsPath);
                progress.report({ message: `${i + 1} of ${files.length}: ${name}`, increment: 100 / files.length });
                try {
                    const { outputPath, chars } = await orchestrator.convertFile(files[i], { token, quiet: true, claimed });
                    succeeded.push(outputPath);
                    if (chars === 0) { empty.push(files[i].fsPath); }
                } catch (error) {
                    const info = categorize(error);
                    if (info.category === ErrorCategory.Cancelled) { cancelled = true; break; }
                    failed.push({ file: files[i].fsPath, error: info.message });
                }
            }
        }
    );

    if (empty.length > 0) {
        errorHandler.log(`[${new Date().toISOString()}] Batch: no text extracted (images or scanned PDFs; markitdown does not do OCR):\n` +
            empty.map(f => `  ${f}`).join('\n'));
    }
    if (failed.length > 0) {
        errorHandler.log(`[${new Date().toISOString()}] Batch: ${succeeded.length} converted, ${failed.length} failed:\n` +
            failed.map(f => `  ${f.file}: ${f.error}`).join('\n'));
    }
    const parts = [`${succeeded.length} converted`];
    if (empty.length) { parts.push(`${empty.length} with no text`); }
    if (failed.length) { parts.push(`${failed.length} failed`); }
    if (cancelled) { parts.push(`${files.length - succeeded.length - failed.length} skipped (cancelled)`); }
    const message = `MarkItDown: ${parts.join(', ')}`;

    if (failed.length > 0 || empty.length > 0) {
        vscode.window.showWarningMessage(message, 'Show Details').then(s => {
            if (s === 'Show Details') { errorHandler.outputChannel.show(); }
        });
    } else if (succeeded.length > 0) {
        vscode.window.showInformationMessage(message, 'Open First').then(s => {
            if (s === 'Open First') { orchestrator.openFile(succeeded[0]); }
        });
    } else {
        vscode.window.showInformationMessage(message);
    }
}

export function deactivate() {
    // Stop any install or conversion still running (they run in their own
    // process group, so they would otherwise outlive the window).
    killAllChildren();
}
