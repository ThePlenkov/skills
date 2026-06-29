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
    child.stdout.on('data', (b: Buffer) => chunks.push(b));
    child.stderr.on('data', (b: Buffer) => errChunks.push(b));
    child.on('close', (code) => {
      const stdout = Buffer.concat(chunks).toString('utf8');
      const stderr = Buffer.concat(errChunks).toString('utf8');
      const firstBrace = stdout.indexOf('{');
      const jsonText = firstBrace >= 0 ? stdout.slice(firstBrace) : '';
      resolve({ exitCode: code ?? 1, stdout, stderr, jsonText });
    });
  });
}