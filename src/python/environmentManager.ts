import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * markitdown install spec.
 *
 * Targeted extras (NOT `[all]`) so it resolves on modern Python (3.13/3.14):
 * `[all]` pulls youtube/azure extras whose pins are ResolutionImpossible there,
 * and an unpinned `markitdown[all]` lets pip silently backtrack to the ancient
 * 0.0.2 release, whose DOCX handling fails on documents with embedded graphics
 * (the cause of the early "half my docx files fail" reports).
 *
 * The `>=0.1.6` floor blocks that backtrack; `<0.2.0` avoids unvetted majors.
 * Keep in sync with scripts/functional-test.mjs and python/markitdown_runner.py.
 */
const MARKITDOWN_SPEC =
    'markitdown[docx,pptx,xlsx,xls,pdf,outlook,audio-transcription]>=0.1.6,<0.2.0';

export interface ConversionResult {
    /** Number of (trimmed) characters written to the output file. */
    chars: number;
}

export class PythonEnvironmentManager {
    private context: vscode.ExtensionContext;
    private errorHandler: ErrorHandler;
    private venvPath: string;
    private runnerPath: string;
    private pythonExecutable: string | null = null;

    constructor(context: vscode.ExtensionContext, errorHandler: ErrorHandler) {
        this.context = context;
        this.errorHandler = errorHandler;
        this.venvPath = path.join(context.globalStorageUri.fsPath, 'markitdown-venv');
        this.runnerPath = path.join(context.extensionPath, 'python', 'markitdown_runner.py');
    }

    public async initialize(
        progress?: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<void> {
        try {
            await this.ensureDirectoryExists(this.context.globalStorageUri.fsPath);

            progress?.report({ message: 'Locating Python…' });
            this.pythonExecutable = await this.findPythonExecutable();

            if (!this.pythonExecutable) {
                throw new Error(
                    'Python not found in PATH. Please install Python 3.10+ and ensure it is available in your PATH.'
                );
            }

            progress?.report({ message: 'Preparing virtual environment…', increment: 20 });
            await this.ensureVirtualEnvironment();

            progress?.report({ message: 'Checking markitdown…', increment: 30 });
            await this.ensureMarkitdownInstalled(progress);

            progress?.report({ message: 'Ready.', increment: 50 });
        } catch (error) {
            this.errorHandler.handleError(error, 'Failed to initialize Python environment');
            throw error;
        }
    }

    private async findPythonExecutable(): Promise<string | null> {
        const candidates = process.platform === 'win32'
            ? ['python', 'python3', 'py']
            : ['python3', 'python'];

        for (const candidate of candidates) {
            try {
                const result = await this.executeCommand(candidate, ['--version'], 10000);
                if (result.exitCode === 0) {
                    return candidate;
                }
            } catch {
                // Continue to next candidate
            }
        }
        return null;
    }

    private async ensureVirtualEnvironment(): Promise<void> {
        const venvPythonPath = this.getVenvPythonPath();
        let needsCreation = false;

        if (!fs.existsSync(venvPythonPath)) {
            needsCreation = true;
        } else {
            // Verify the existing venv interpreter still runs.
            try {
                const verifyResult = await this.executeCommand(venvPythonPath, ['--version'], 10000);
                if (verifyResult.exitCode !== 0) {
                    needsCreation = true;
                }
            } catch (error) {
                console.warn(`Virtual environment appears corrupted: ${error}`);
                needsCreation = true;
            }

            if (needsCreation && fs.existsSync(this.venvPath)) {
                console.log('Removing corrupted virtual environment…');
                await fs.promises.rm(this.venvPath, { recursive: true, force: true });
            }
        }

        if (needsCreation) {
            console.log('Creating virtual environment…');
            const result = await this.executeCommand(this.pythonExecutable!, [
                '-m', 'venv', this.venvPath
            ], 120000);

            if (result.exitCode !== 0) {
                throw new Error(`Failed to create virtual environment: ${result.stderr}`);
            }

            const verifyResult = await this.executeCommand(venvPythonPath, ['--version'], 10000);
            if (verifyResult.exitCode !== 0) {
                throw new Error('Created virtual environment but verification failed');
            }
            console.log('Virtual environment created and verified successfully');
        }
    }

    private async ensureMarkitdownInstalled(
        progress?: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<void> {
        const venvPython = this.getVenvPythonPath();

        // Health check via the shipped runner: importable + modern enough +
        // instantiable. This replaces the old `import docx` check, which always
        // failed (markitdown uses mammoth, not python-docx) and triggered a
        // reinstall on every conversion.
        const check = await this.executeCommand(venvPython, [this.runnerPath, 'check'], 30000);
        if (check.exitCode === 0) {
            console.log(`markitdown ${check.stdout.trim()} present`);
            return;
        }

        console.log(`markitdown check failed (${check.stderr.trim()}); installing…`);
        progress?.report({ message: 'Installing markitdown (first run, may take a minute)…' });

        const installResult = await this.executeCommand(venvPython, [
            '-m', 'pip', 'install', '--upgrade', '--disable-pip-version-check', MARKITDOWN_SPEC
        ], 600000); // 10 min: first install pulls numpy/onnxruntime/etc.

        if (installResult.exitCode !== 0) {
            throw new Error(
                `Failed to install markitdown. This often means your Python is too ` +
                `old (3.10+ required) or a dependency has no wheel for your platform.\n` +
                `pip error: ${installResult.stderr}`
            );
        }

        // Confirm the freshly installed environment actually passes the check.
        const recheck = await this.executeCommand(venvPython, [this.runnerPath, 'check'], 30000);
        if (recheck.exitCode !== 0) {
            throw new Error(`markitdown installed but verification failed: ${recheck.stderr}`);
        }
        console.log(`markitdown ${recheck.stdout.trim()} installed successfully`);
    }

    /**
     * Convert a file to Markdown. Returns the number of characters written so
     * callers can detect an empty result (e.g. an image with no extractable
     * text) and warn the user rather than leaving a silent empty .md.
     */
    public async convertFile(inputPath: string, outputPath: string): Promise<ConversionResult> {
        const venvPython = this.getVenvPythonPath();

        // Paths are passed as argv to a spawned process (no shell), so there is
        // no command-injection surface — no escaping or base64 dance needed.
        const result = await this.executeCommand(venvPython, [
            this.runnerPath, 'convert', inputPath, outputPath
        ]);

        if (result.exitCode !== 0) {
            const detail = result.stderr.replace(/^Error:\s*/, '').trim() || 'unknown error';
            throw new Error(detail);
        }

        const match = result.stdout.match(/CHARS:(\d+)/);
        const chars = match ? parseInt(match[1], 10) : 0;
        return { chars };
    }

    private getVenvPythonPath(): string {
        const isWindows = process.platform === 'win32';
        return isWindows
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }

    private executeCommand(
        command: string,
        args: string[],
        timeoutMs: number = 300000 // 5 minutes default
    ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            const childProcess = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';
            let isTimedOut = false;
            let outputExceeded = false;

            const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB per stream

            const timeout = setTimeout(() => {
                isTimedOut = true;
                childProcess.kill('SIGTERM');
                setTimeout(() => {
                    if (!childProcess.killed) {
                        childProcess.kill('SIGKILL');
                    }
                }, 5000);
                reject(new Error(`Command timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            childProcess.stdout?.on('data', (data) => {
                if (stdout.length + data.length > MAX_OUTPUT_SIZE) {
                    outputExceeded = true;
                    childProcess.kill('SIGTERM');
                    return;
                }
                stdout += data.toString();
            });

            childProcess.stderr?.on('data', (data) => {
                if (stderr.length + data.length > MAX_OUTPUT_SIZE) {
                    outputExceeded = true;
                    childProcess.kill('SIGTERM');
                    return;
                }
                stderr += data.toString();
            });

            childProcess.on('close', (code) => {
                clearTimeout(timeout);
                if (isTimedOut) {
                    return;
                }
                if (outputExceeded) {
                    reject(new Error('Process output exceeded maximum size (10MB)'));
                    return;
                }
                resolve({
                    exitCode: code || 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            childProcess.on('error', (error) => {
                clearTimeout(timeout);
                if (!isTimedOut) {
                    reject(error);
                }
            });
        });
    }

    public dispose(): void {
        // No long-lived resources to release.
    }
}
