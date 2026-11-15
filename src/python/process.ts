// Child-process runner with real timeouts, cancellation and process-tree kill.
// No vscode import, so plain-Node tests exercise it directly.
import { spawn } from 'child_process';

export interface ProcessResult {
    /** Exit code; -1 when the process was killed by a signal (crash, OOM). */
    exitCode: number;
    signal: string | null;
    stdout: string;
    stderr: string;
}

export interface RunOptions {
    timeoutMs: number;
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    /** Called with each chunk of stdout/stderr as it arrives. */
    onOutput?: (chunk: string) => void;
    signal?: AbortSignal;
}

export class ProcessTimeoutError extends Error {
    constructor(public readonly command: string, timeoutMs: number) {
        super(`${command} did not finish within ${Math.round(timeoutMs / 1000)}s`);
        this.name = 'ProcessTimeoutError';
    }
}

export class ProcessCancelledError extends Error {
    constructor() {
        super('Cancelled');
        this.name = 'ProcessCancelledError';
    }
}

const MAX_OUTPUT = 10 * 1024 * 1024; // per stream

/** Children still running, so deactivate can stop them (they run in their own process group). */
const active = new Set<number>();

/** Kill every child this module started that is still running. Call on extension deactivate. */
export function killAllChildren(): void {
    for (const pid of active) {
        killTree(pid, true);
    }
    active.clear();
}
const KILL_GRACE_MS = 5000;

/** Kill the process and everything it started (pip spawns its own children). */
function killTree(pid: number | undefined, hard: boolean): void {
    if (pid === undefined) { return; }
    if (process.platform === 'win32') {
        // taskkill /T walks the tree; /F forces.
        spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        return;
    }
    try {
        process.kill(-pid, hard ? 'SIGKILL' : 'SIGTERM'); // negative pid = the process group
    } catch {
        try { process.kill(pid, hard ? 'SIGKILL' : 'SIGTERM'); } catch { /* already gone */ }
    }
}

export function runProcess(command: string, args: string[], opts: RunOptions): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
        if (opts.signal?.aborted) {
            reject(new ProcessCancelledError());
            return;
        }
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: opts.env,
            cwd: opts.cwd,
            windowsHide: true,
            // Own process group on POSIX so killTree can take the children too.
            detached: process.platform !== 'win32',
        });

        if (child.pid !== undefined) { active.add(child.pid); }
        let stdout = '';
        let stderr = '';
        let exited = false;
        let settled = false;
        const stdoutDecoder = new TextDecoder('utf-8');
        const stderrDecoder = new TextDecoder('utf-8');

        const finish = (fn: () => void) => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            opts.signal?.removeEventListener('abort', onAbort);
            fn();
        };

        const stop = () => {
            killTree(child.pid, false);
            setTimeout(() => { if (!exited) { killTree(child.pid, true); } }, KILL_GRACE_MS).unref();
        };

        const timer = setTimeout(() => {
            stop();
            finish(() => reject(new ProcessTimeoutError([command, ...args.slice(0, 2)].join(' '), opts.timeoutMs)));
        }, opts.timeoutMs);

        const onAbort = () => {
            stop();
            finish(() => reject(new ProcessCancelledError()));
        };
        opts.signal?.addEventListener('abort', onAbort);

        const collect = (decoder: TextDecoder, append: (s: string) => void) => (data: Buffer) => {
            const text = decoder.decode(data, { stream: true });
            append(text);
            opts.onOutput?.(text);
        };
        child.stdout?.on('data', collect(stdoutDecoder, s => {
            if (stdout.length + s.length > MAX_OUTPUT) { stop(); finish(() => reject(new Error('Process output exceeded 10MB'))); return; }
            stdout += s;
        }));
        child.stderr?.on('data', collect(stderrDecoder, s => {
            if (stderr.length + s.length > MAX_OUTPUT) { stop(); finish(() => reject(new Error('Process output exceeded 10MB'))); return; }
            stderr += s;
        }));

        const forget = () => { if (child.pid !== undefined) { active.delete(child.pid); } };
        child.on('error', (err) => {
            exited = true;
            forget();
            finish(() => reject(err));
        });
        child.on('close', (code, signal) => {
            exited = true;
            forget();
            finish(() => resolve({ exitCode: code ?? -1, signal: signal ?? null, stdout, stderr }));
        });
    });
}
