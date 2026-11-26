import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ErrorHandler, EnvironmentError, ConversionError } from '../utils/errorHandler';
import { parsePythonVersion, isSupportedPython, SUPPORTED_RANGE, NO_PIP_CANDIDATES, rankByWheels, UV_PYTHON } from './pythonVersion';
import { runProcess, ProcessResult, ProcessTimeoutError, ProcessCancelledError } from './process';

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

/**
 * Written into the venv after a successful install. When it differs (a new
 * spec, or an environment built by an older extension) the next run upgrades
 * the packages in place, so existing users get markitdown fixes.
 */
const ENV_STAMP = `${MARKITDOWN_SPEC} | env-v2`;

const INSTALL_TIMEOUT_MS = 15 * 60 * 1000;
const VERSION_TIMEOUT_MS = 15000;
const CHECK_TIMEOUT_MS = 60000;
const LOCK_STALE_MS = 5 * 60 * 1000; // owner.json is refreshed every 30s while held
const LOCK_HEARTBEAT_MS = 30000;
const LOCK_WAIT_MS = 20 * 60 * 1000;

/** An interpreter invocation: the program plus any leading args (`py -3.12`). */
interface PythonCommand {
    cmd: string;
    args: string[];
}

const describe = (c: PythonCommand) => [c.cmd, ...c.args].join(' ');

type Progress = vscode.Progress<{ message?: string; increment?: number }>;

export interface ConversionOptions {
    keepDataUris: boolean;
    transcribeAudio: boolean;
    /** Fail instead of replacing an existing output file. */
    noClobber: boolean;
    timeoutMs: number;
    token?: vscode.CancellationToken;
}

export interface ConversionResult {
    /** Number of (trimmed) characters written to the output file. */
    chars: number;
}

/** Bridge a VS Code cancellation token to an AbortSignal. Call dispose() when done. */
function toAbortSignal(token?: vscode.CancellationToken): { signal?: AbortSignal; dispose: () => void } {
    if (!token) { return { dispose: () => undefined }; }
    const controller = new AbortController();
    if (token.isCancellationRequested) {
        controller.abort();
        return { signal: controller.signal, dispose: () => undefined };
    }
    const listener = token.onCancellationRequested(() => controller.abort());
    return { signal: controller.signal, dispose: () => listener.dispose() };
}

interface Probe {
    candidate: PythonCommand;
    version: [number, number] | null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class PythonEnvironmentManager {
    private readonly storageDir: string;
    private readonly venvPath: string;
    private readonly runnerPath: string;
    private readonly lockPath: string;
    private readonly stampPath: string;

    constructor(context: vscode.ExtensionContext, private readonly errorHandler: ErrorHandler) {
        this.storageDir = context.globalStorageUri.fsPath;
        this.venvPath = path.join(this.storageDir, 'markitdown-venv');
        this.runnerPath = path.join(context.extensionPath, 'python', 'markitdown_runner.py');
        this.lockPath = path.join(this.storageDir, 'markitdown-venv.lock');
        this.stampPath = path.join(this.venvPath, '.markitdown-stamp');
    }

    // ---------------------------------------------------------------- public

    public async initialize(progress?: Progress, token?: vscode.CancellationToken): Promise<void> {
        await fs.promises.mkdir(this.storageDir, { recursive: true });
        // Fast path: a healthy, current environment needs no lock.
        if (await this.isReady()) {
            return;
        }
        await this.withLock(progress, token, async () => {
            if (await this.isReady()) {
                return; // another window finished it while we waited
            }
            await this.buildEnvironment(progress, token);
        });
    }

    /** Delete the environment and build it again. */
    public async rebuild(progress?: Progress, token?: vscode.CancellationToken): Promise<void> {
        await fs.promises.mkdir(this.storageDir, { recursive: true });
        await this.withLock(progress, token, async () => {
            this.log('Rebuilding the environment on request');
            await this.removeVenv();
            await this.buildEnvironment(progress, token);
        });
    }

    /** Human-readable description of the environment, for the info command. */
    public async describeEnvironment(): Promise<string> {
        const lines: string[] = [];
        const venvPython = this.venvPython();
        lines.push(`Environment: ${this.venvPath}`);
        if (!fs.existsSync(venvPython)) {
            lines.push('Status: not built yet (it is created on first conversion)');
        } else {
            const version = await this.queryVersion({ cmd: venvPython, args: [] }).catch(() => null);
            lines.push(`Python: ${version ? version.join('.') : 'did not run'}`);
            const check = await this.runPython(venvPython, [this.runnerPath, 'check'], CHECK_TIMEOUT_MS).catch(() => null);
            lines.push(`markitdown: ${check?.exitCode === 0 ? check.stdout.trim() : 'not working'}`);
            lines.push(`Stamp current: ${(await this.readStamp()) === ENV_STAMP ? 'yes' : 'no (upgrades on next conversion)'}`);
        }
        const uv = await this.findUv();
        lines.push(`uv: ${uv ?? 'not found (installs use pip)'}`);
        const configured = this.setting<string>('pythonPath', '').trim();
        lines.push(`markitdown.pythonPath: ${configured || '(search PATH)'}`);
        return lines.join('\n');
    }

    public async convertFile(inputPath: string, outputPath: string, opts: ConversionOptions): Promise<ConversionResult> {
        const args = [this.runnerPath, 'convert'];
        if (opts.keepDataUris) { args.push('--keep-data-uris'); }
        if (opts.transcribeAudio) { args.push('--transcribe'); }
        if (opts.noClobber) { args.push('--no-clobber'); }
        // Paths go as argv to a spawned process (no shell): no injection surface.
        args.push(inputPath, outputPath);

        const abort = toAbortSignal(opts.token);
        let result: ProcessResult;
        try {
            result = await this.runPython(this.venvPython(), args, opts.timeoutMs, abort.signal);
        } finally {
            abort.dispose();
        }

        const line = result.stdout.split(/\r?\n/).reverse().find(l => l.startsWith('RESULT:'));
        if (!line) {
            const why = result.exitCode === -1 ? `it was killed (${result.signal ?? 'signal'})` : `exit code ${result.exitCode}`;
            this.log(`Converter produced no result (${why}). stderr:\n${result.stderr}`);
            throw new Error(`The converter stopped without a result (${why}). See the MarkItDown output channel.`);
        }
        const parsed = JSON.parse(line.slice('RESULT:'.length)) as
            { ok: boolean; chars?: number; error_type?: string; error?: string };
        if (!parsed.ok) {
            throw new ConversionError(parsed.error ?? 'Conversion failed', parsed.error_type ?? 'error');
        }
        return { chars: parsed.chars ?? 0 };
    }

    // ------------------------------------------------------------ readiness

    /** The venv runs a supported Python, carries the current stamp, and passes `check`. */
    private async isReady(): Promise<boolean> {
        const venvPython = this.venvPython();
        if (!fs.existsSync(venvPython)) { return false; }
        if ((await this.readStamp()) !== ENV_STAMP) { return false; }
        try {
            const check = await this.runPython(venvPython, [this.runnerPath, 'check'], CHECK_TIMEOUT_MS);
            return check.exitCode === 0;
        } catch {
            return false;
        }
    }

    // ---------------------------------------------------------------- build

    private async buildEnvironment(progress?: Progress, token?: vscode.CancellationToken): Promise<void> {
        const abort = toAbortSignal(token);
        try {
            await this.buildEnvironmentWith(progress, abort.signal);
        } finally {
            abort.dispose();
        }
    }

    private async buildEnvironmentWith(progress: Progress | undefined, signal: AbortSignal | undefined): Promise<void> {
        const uv = this.setting<boolean>('useUv', true) ? await this.findUv() : null;

        if (await this.venvNeedsRecreate()) {
            await this.removeVenv();
        }

        if (fs.existsSync(this.venvPython())) {
            // Existing venv on a supported Python: upgrade packages in place.
            progress?.report({ message: 'Updating markitdown…' });
            const result = await this.install(this.venvPython(), uv, signal);
            if (result.exitCode !== 0) {
                this.log('In-place upgrade failed; rebuilding the environment');
                await this.removeVenv();
            } else {
                await this.finish();
                return;
            }
        }

        progress?.report({ message: 'Locating Python…' });
        const probes = await this.probePythons();
        const ranked = rankByWheels(probes, p => p.version);
        const supported = ranked.map(p => p.candidate);
        const configured = this.setting<string>('pythonPath', '').trim();
        if (configured && supported.length === 0) {
            // Never swap a configured interpreter for another one silently.
            throw this.noPythonError(probes);
        }

        if (uv) {
            try {
                await this.buildWithUv(uv, ranked, progress, signal);
                await this.finish();
                return;
            } catch (error) {
                if (error instanceof ProcessCancelledError || supported.length === 0) { throw error; }
                this.log(`uv build failed (${error instanceof Error ? error.message : error}); falling back to pip`);
                await this.removeVenv();
            }
        }
        if (supported.length === 0) {
            throw this.noPythonError(probes);
        }
        await this.buildWithPip(supported, progress, signal);
        await this.finish();
    }

    /** uv creates the venv (fetching a managed Python if none is installed) and installs fast. */
    private async buildWithUv(uv: string, ranked: Probe[], progress: Progress | undefined, signal: AbortSignal | undefined): Promise<void> {
        progress?.report({ message: 'Creating environment with uv…' });
        // A configured pythonPath is used as given; otherwise the pinned version.
        const configured = this.setting<string>('pythonPath', '').trim();
        const request = configured && ranked.length > 0 ? this.uvPythonRequest(ranked[0].candidate) : UV_PYTHON;
        this.log(`Creating venv with uv (python ${request})`);
        const created = await this.run(uv, ['venv', '--seed', '--python', request, this.venvPath], INSTALL_TIMEOUT_MS, signal);
        if (created.exitCode !== 0) {
            throw new EnvironmentError(
                `uv could not create the environment: ${lastLines(created.stderr)}`,
                'Set "markitdown.useUv" to false to use pip instead. Full output is in the MarkItDown output channel.');
        }
        progress?.report({ message: 'Installing markitdown (first run, usually under a minute with uv)…' });
        const installed = await this.install(this.venvPython(), uv, signal);
        if (installed.exitCode !== 0) {
            throw this.installError(installed);
        }
    }

    /** Try each supported interpreter in turn until one builds a working venv. */
    private async buildWithPip(pythons: PythonCommand[], progress: Progress | undefined, signal: AbortSignal | undefined): Promise<void> {
        let lastFailure: ProcessResult | undefined;
        for (const py of pythons) {
            progress?.report({ message: `Creating environment with ${describe(py)}…` });
            this.log(`Creating venv with ${describe(py)}`);
            const created = await this.run(py.cmd, [...py.args, '-m', 'venv', this.venvPath], 120000, signal);
            if (created.exitCode !== 0) {
                this.log(`venv creation with ${describe(py)} failed`);
                lastFailure = created;
                await this.removeVenv();
                continue;
            }
            progress?.report({ message: 'Installing markitdown (first run, may take a few minutes)…' });
            const installed = await this.install(this.venvPython(), null, signal);
            if (installed.exitCode === 0) {
                return;
            }
            lastFailure = installed;
            this.log(`Install with ${describe(py)} failed; trying the next interpreter if there is one`);
            await this.removeVenv();
        }
        if (lastFailure && /No module named venv|ensurepip is not available/i.test(lastFailure.stderr + lastFailure.stdout)) {
            throw new EnvironmentError(
                'Python is installed without the venv module.',
                'On Debian/Ubuntu run "sudo apt install python3-venv", or install uv (https://docs.astral.sh/uv/).');
        }
        throw this.installError(lastFailure);
    }

    private install(venvPython: string, uv: string | null, signal?: AbortSignal): Promise<ProcessResult> {
        this.log(`Installing ${MARKITDOWN_SPEC}${uv ? ' with uv' : ''}`);
        if (uv) {
            return this.run(uv, ['pip', 'install', '--upgrade', '--python', venvPython, MARKITDOWN_SPEC],
                INSTALL_TIMEOUT_MS, signal);
        }
        const args = ['-m', 'pip', 'install', '--upgrade', MARKITDOWN_SPEC];
        const proxy = this.proxy();
        if (proxy) { args.push('--proxy', proxy); }
        return this.run(venvPython, args, INSTALL_TIMEOUT_MS, signal);
    }

    private async finish(): Promise<void> {
        const check = await this.runPython(this.venvPython(), [this.runnerPath, 'check'], CHECK_TIMEOUT_MS);
        if (check.exitCode !== 0) {
            throw new EnvironmentError(`markitdown installed but does not work: ${lastLines(check.stderr)}`,
                'Run "MarkItDown: Rebuild Environment". Details are in the MarkItDown output channel.');
        }
        await fs.promises.writeFile(this.stampPath, ENV_STAMP, 'utf-8');
        this.log(`Environment ready: markitdown ${check.stdout.trim()}`);
    }

    private installError(result?: ProcessResult): EnvironmentError {
        const output = (result?.stderr ?? '') + (result?.stdout ?? '');
        const hint = NO_PIP_CANDIDATES.test(output)
            ? 'pip could not see any markitdown release. Check that this machine can reach pypi.org, or set "markitdown.pipIndexUrl" or VS Code\'s "http.proxy".'
            : 'A dependency may have no prebuilt wheel for this platform.';
        return new EnvironmentError(`Failed to install markitdown. ${hint}`,
            'The full install output is in the MarkItDown output channel.');
    }

    private noPythonError(probes: Probe[]): EnvironmentError {
        const fix = `Install Python ${SUPPORTED_RANGE} or uv (https://docs.astral.sh/uv/), or set "markitdown.pythonPath".`;
        const configured = this.setting<string>('pythonPath', '').trim();
        if (configured) {
            return new EnvironmentError(`The configured markitdown.pythonPath (${configured}) did not run or is older than ${SUPPORTED_RANGE}.`,
                'Fix or clear the "markitdown.pythonPath" setting.');
        }
        const rejected = probes
            .filter(p => p.version && !isSupportedPython(p.version))
            .map(p => `${describe(p.candidate)} (${p.version!.join('.')})`);
        return new EnvironmentError(
            rejected.length > 0
                ? `Found Python, but markitdown needs ${SUPPORTED_RANGE}: ${rejected.join(', ')}.`
                : 'Python was not found on PATH.',
            fix);
    }

    /**
     * Recreate when the venv's Python fails or reports an unsupported version.
     * A timeout (antivirus scanning python.exe on first launch, say) keeps it.
     */
    private async venvNeedsRecreate(): Promise<boolean> {
        const venvPython = this.venvPython();
        if (!fs.existsSync(venvPython)) { return false; }
        try {
            const version = await this.queryVersion({ cmd: venvPython, args: [] });
            if (!isSupportedPython(version)) {
                this.log(`Recreating venv (its Python: ${version?.join('.') ?? 'failed to run'})`);
                return true;
            }
        } catch (error) {
            this.log(`Could not query the venv's Python, keeping it: ${error}`);
        }
        return false;
    }

    // ------------------------------------------------------------ discovery

    private pythonCandidates(): PythonCommand[] {
        const configured = this.setting<string>('pythonPath', '').trim();
        if (configured) {
            return [{ cmd: configured, args: [] }];
        }
        // VS Code can see a different PATH than your terminal (a Dock launch
        // on macOS, for example), so also try the versioned names installers add.
        const minors: number[] = [];
        for (let m = 16; m >= 10; m--) { minors.push(m); }
        if (process.platform === 'win32') {
            return [
                { cmd: 'python', args: [] },
                { cmd: 'python3', args: [] },
                { cmd: 'py', args: ['-3'] },
                ...minors.map(m => ({ cmd: 'py', args: [`-3.${m}`] })),
            ];
        }
        return [
            { cmd: 'python3', args: [] },
            { cmd: 'python', args: [] },
            ...minors.map(m => ({ cmd: `python3.${m}`, args: [] })),
        ];
    }

    /** Ask every candidate for its version, in parallel. Order follows pythonCandidates(). */
    private probePythons(): Promise<Probe[]> {
        return Promise.all(this.pythonCandidates().map(async candidate => ({
            candidate,
            version: await this.queryVersion(candidate).catch(() => null),
        })));
    }

    /** uv's --python request for an interpreter we found. */
    private uvPythonRequest(py: PythonCommand): string {
        if (py.cmd === 'py') {
            return py.args[0]?.replace(/^-/, '') || '3';
        }
        return py.cmd;
    }

    private async findUv(): Promise<string | null> {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const exe = process.platform === 'win32' ? 'uv.exe' : 'uv';
        const candidates = ['uv', path.join(home, '.local', 'bin', exe), path.join(home, '.cargo', 'bin', exe)];
        for (const candidate of candidates) {
            try {
                const r = await this.run(candidate, ['--version'], VERSION_TIMEOUT_MS, undefined, false);
                if (r.exitCode === 0) { return candidate; }
            } catch { /* not there */ }
        }
        return null;
    }

    /** Version of an interpreter, or null if it ran but printed none. Throws if it cannot run. */
    private async queryVersion(c: PythonCommand): Promise<[number, number] | null> {
        const result = await this.run(c.cmd, [...c.args, '--version'], VERSION_TIMEOUT_MS, undefined, false);
        if (result.exitCode !== 0) { return null; }
        return parsePythonVersion(result.stdout + ' ' + result.stderr);
    }

    // ---------------------------------------------------------------- lock

    /**
     * Every VS Code window shares one venv in global storage. The lock is a
     * directory (mkdir is atomic) holding the owner's pid, so a crashed
     * window's lock can be detected and cleared.
     */
    private async withLock<T>(progress: Progress | undefined, token: vscode.CancellationToken | undefined, fn: () => Promise<T>): Promise<T> {
        const started = Date.now();
        let announced = false;
        for (;;) {
            try {
                await fs.promises.mkdir(this.lockPath);
                await fs.promises.writeFile(path.join(this.lockPath, 'owner.json'),
                    JSON.stringify({ pid: process.pid, time: Date.now() }));
                break;
            } catch (error: any) {
                if (error?.code !== 'EEXIST') { throw error; }
                if (await this.lockIsStale()) {
                    this.log('Clearing a stale environment lock');
                    await fs.promises.rm(this.lockPath, { recursive: true, force: true });
                    continue;
                }
                if (token?.isCancellationRequested) {
                    throw new ProcessCancelledError();
                }
                if (Date.now() - started > LOCK_WAIT_MS) {
                    throw new EnvironmentError('Timed out waiting for another VS Code window to finish setting up MarkItDown.',
                        'Close other VS Code windows and try again, or run "MarkItDown: Rebuild Environment".');
                }
                if (!announced) {
                    progress?.report({ message: 'Waiting for another VS Code window to finish setup…' });
                    announced = true;
                }
                await sleep(1000);
            }
        }
        const ownerFile = path.join(this.lockPath, 'owner.json');
        const heartbeat = setInterval(() => {
            fs.promises.writeFile(ownerFile, JSON.stringify({ pid: process.pid, time: Date.now() })).catch(() => undefined);
        }, LOCK_HEARTBEAT_MS);
        try {
            return await fn();
        } finally {
            clearInterval(heartbeat);
            await fs.promises.rm(this.lockPath, { recursive: true, force: true }).catch(() => undefined);
        }
    }

    private async lockIsStale(): Promise<boolean> {
        try {
            const raw = await fs.promises.readFile(path.join(this.lockPath, 'owner.json'), 'utf-8');
            const owner = JSON.parse(raw) as { pid: number; time: number };
            try {
                process.kill(owner.pid, 0); // throws if the process is gone
            } catch (e: any) {
                if (e?.code === 'ESRCH') { return true; }
            }
            // Owner alive (or not ours to signal): stale only if its heartbeat stopped,
            // which also covers a reused pid.
            return Date.now() - owner.time > LOCK_STALE_MS;
        } catch {
            // Lock dir without an owner file: the owner died between mkdir and write,
            // or is writing right now. Treat it as stale only after a grace period.
            const stat = await fs.promises.stat(this.lockPath).catch(() => null);
            return !stat || Date.now() - stat.mtimeMs > 30000;
        }
    }

    // ------------------------------------------------------------- process

    /** Environment for every child: UTF-8 I/O, no inherited settings that break venvs, proxy and index. */
    private childEnv(): NodeJS.ProcessEnv {
        const env: NodeJS.ProcessEnv = { ...process.env };
        for (const key of ['PYTHONPATH', 'PYTHONHOME', 'PYTHONSTARTUP', 'PIP_USER', 'PIP_REQUIRE_VIRTUALENV', 'VIRTUAL_ENV']) {
            delete env[key];
        }
        env.PYTHONUTF8 = '1';
        env.PYTHONIOENCODING = 'utf-8';
        env.PIP_DISABLE_PIP_VERSION_CHECK = '1';
        const proxy = this.proxy();
        if (proxy) {
            env.HTTPS_PROXY = env.HTTPS_PROXY || proxy;
            env.HTTP_PROXY = env.HTTP_PROXY || proxy;
        }
        const index = this.setting<string>('pipIndexUrl', '').trim();
        if (index) {
            env.PIP_INDEX_URL = index;
            env.UV_INDEX_URL = index;
        }
        return env;
    }

    /** Run a command, optionally streaming its output to the MarkItDown output channel. */
    private run(cmd: string, args: string[], timeoutMs: number, signal?: AbortSignal, stream = true): Promise<ProcessResult> {
        return runProcess(cmd, args, {
            timeoutMs,
            signal,
            env: this.childEnv(),
            // Not the workspace: on Windows a bare `python` is looked up in the cwd first.
            cwd: this.storageDir,
            onOutput: stream ? chunk => this.errorHandler.append(chunk) : undefined,
        });
    }

    /** Run the venv's Python in isolated mode (-I: no user site, no script-dir imports, no PYTHON* env). */
    private async runPython(python: string, args: string[], timeoutMs: number, signal?: AbortSignal): Promise<ProcessResult> {
        try {
            // -I implies -E, which ignores PYTHONUTF8; -X utf8 sets UTF-8 mode directly.
            return await runProcess(python, ['-I', '-X', 'utf8', ...args], {
                timeoutMs, signal, env: this.childEnv(), cwd: this.storageDir,
            });
        } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
                throw new EnvironmentError('The MarkItDown Python environment is missing.',
                    'It is rebuilt on the next conversion, or run "MarkItDown: Rebuild Environment".');
            }
            if (error instanceof ProcessTimeoutError) {
                throw new Error(`Stopped after ${Math.round(timeoutMs / 1000)}s. ` +
                    'For very large files, raise "markitdown.conversionTimeoutSeconds".');
            }
            throw error;
        }
    }

    // ---------------------------------------------------------------- misc

    private venvPython(): string {
        return process.platform === 'win32'
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');
    }

    private async readStamp(): Promise<string | null> {
        return fs.promises.readFile(this.stampPath, 'utf-8').then(s => s.trim(), () => null);
    }

    private async removeVenv(): Promise<void> {
        if (fs.existsSync(this.venvPath)) {
            this.log('Removing the virtual environment');
            await fs.promises.rm(this.venvPath, { recursive: true, force: true, maxRetries: 3 });
        }
    }

    private proxy(): string {
        return vscode.workspace.getConfiguration('http').get<string>('proxy', '').trim();
    }

    private setting<T>(key: string, fallback: T): T {
        return vscode.workspace.getConfiguration('markitdown').get<T>(key, fallback);
    }

    private log(line: string): void {
        this.errorHandler.log(`[${new Date().toISOString()}] ${line}`);
    }
}

function lastLines(text: string, n = 3): string {
    return text.trim().split(/\r?\n/).slice(-n).join(' ');
}
