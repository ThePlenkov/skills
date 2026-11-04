/**
 * Thin wrapper around the SkillSpector CLI.
 */
import { spawn } from 'node:child_process';

export interface SkillspectorRunOptions {
  bin?: string;
  path: string;
  noLlM?: boolean;
  baseline?: string;
  recursive?: boolean;
}

export interface SkillspectorResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  jsonText: string;
}

export function runSkillspector(opts: SkillspectorRunOptions): Promise<SkillspectorResult> {
  const bin = opts.bin ?? 'skillspector';
  const args = ['scan', opts.path, '--format', 'json'];
  if (opts.noLlM ?? true) args.push('--no-llm');
  if (opts.baseline) args.push('--baseline', opts.baseline);
  if (opts.recursive) args.push('--recursive');

  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let settled = false;
    const settle = (result: SkillspectorResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    child.stdout.on('data', (b: Buffer) => chunks.push(b));
    child.stderr.on('data', (b: Buffer) => errChunks.push(b));
    // If the binary is missing (ENOENT) or otherwise un-spawnable,
    // Node fires 'error' instead of 'close'. Without this handler
    // the Promise never resolves and Nx's task runner logs an
    // unhandled error.
    child.on('error', (err) => {
      settle({
        exitCode: 127,
        stdout: '',
        stderr: err.message,
        jsonText: '',
      });
    });
    child.on('close', (code) => {
      const stdout = Buffer.concat(chunks).toString('utf8');
      const stderr = Buffer.concat(errChunks).toString('utf8');
      // Slice the JSON payload between the first '{' and the last
      // '}'. Using only the first '{' (as before) can swallow trailing
      // noise appended after the JSON closes, producing a malformed
      // string that JSON.parse then rejects.
      const firstBrace = stdout.indexOf('{');
      const lastBrace = stdout.lastIndexOf('}');
      const jsonText =
        firstBrace >= 0 && lastBrace > firstBrace
          ? stdout.slice(firstBrace, lastBrace + 1)
          : '';
      settle({ exitCode: code ?? 1, stdout, stderr, jsonText });
    });
  });
}