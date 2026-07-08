import { spawn } from 'child_process';
import * as path from 'path';

export interface ChildRunResult {
  name: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export async function runChild(
  command: string,
  args: string[],
  options?: { cwd?: string; timeoutMs?: number; name?: string; env?: NodeJS.ProcessEnv }
): Promise<ChildRunResult> {
  const cwd = options?.cwd ?? path.resolve(__dirname, '../..');
  const timeoutMs = options?.timeoutMs ?? 600_000;
  const name = options?.name ?? [command, ...args].join(' ');
  const start = Date.now();

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...options?.env },
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout?.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr?.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(s);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        name,
        exitCode: timedOut ? 124 : code ?? 1,
        stdout,
        stderr: timedOut ? `${stderr}\nTimed out after ${timeoutMs}ms` : stderr,
        duration: Date.now() - start,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        name,
        exitCode: 1,
        stdout,
        stderr: err.message,
        duration: Date.now() - start,
      });
    });
  });
}
