import * as pty from 'node-pty';
import { spawn } from 'child_process';
import { StringDecoder } from 'string_decoder';
import { type IPtyProcess } from '@web-cli/shared';
import { getPythonBridgeScript } from './PythonBridge.js';
import fs from 'fs';

export class PTYFactory {
  static create(
    uuid: string, 
    projectPath: string, 
    cols: number, 
    rows: number, 
    isNew: boolean,
    geminiPath: string
  ): IPtyProcess {
    const args = isNew ? 
      ['--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '] : 
      ['--resume', uuid, '--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '];

    try {
      const ptyProcess = pty.spawn(geminiPath, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: projectPath,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1' } as any
      });
      return ptyProcess as unknown as IPtyProcess;
    } catch (err) {
      console.warn(`[PTYFactory] node-pty failed: ${err}. Falling back to child_process.spawn.`);
      return this.createPythonFallback(uuid, projectPath, cols, rows, isNew, geminiPath);
    }
  }

  private static createPythonFallback(
    uuid: string, 
    projectPath: string, 
    cols: number, 
    rows: number, 
    isNew: boolean,
    geminiPath: string
  ): IPtyProcess {
    const pyArgs = isNew ? 
      ['--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '] : 
      ['--resume', uuid, '--skip-trust', '--approval-mode', 'yolo', '--prompt-interactive', ' '];
    
    const pyScript = getPythonBridgeScript(uuid, geminiPath, pyArgs, rows, cols);
    const decoder = new StringDecoder('utf8');
    let onDataCb: (data: string) => void = () => {};
    let onExitCb: (status: { exitCode: number; signal?: number }) => void = () => {};
    
    let discoveryStep = 1;
    let activeCp: any = null;

    const startBridge = (cmd: string) => {
      const proc = spawn(cmd, ['-u', '-c', pyScript], {
        cwd: projectPath,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '1', LANG: 'en_US.UTF-8' } as any,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      proc.stdin?.on('error', (err: any) => console.warn(`[PTYFactory] Bridge stdin error: ${err.message}`));
      
      proc.stdout?.on('data', (chunk: Buffer) => {
        if (proc === activeCp) onDataCb(decoder.write(chunk));
      });

      proc.stderr?.on('data', (data: any) => {
        const msg = data.toString();
        if (discoveryStep === 1 && (msg.includes('pyenv: version') || msg.includes('command not found'))) {
           console.warn(`[PTYFactory] Tier 1 environment check failed. Silently switching to Tier 2...`);
           discoveryStep = 2;
           proc.kill();
           activeCp = startBridge('/usr/bin/python3');
           return;
        }

        if (proc === activeCp) {
          if (!msg.includes('tcgetattr') && !msg.includes('ioctl')) {
            onDataCb(`\x1b[31m[System Error] ${msg}\x1b[0m`);
          }
        }
      });

      proc.on('error', (err: any) => {
        if (discoveryStep === 1) {
          discoveryStep = 2;
          activeCp = startBridge('/usr/bin/python3');
        } else {
          onDataCb(`\x1b[31m[Critical Error] 执行环境启动失败。详细原因: ${err.message}\x1b[0m`);
          onExitCb({ exitCode: 1 });
        }
      });

      proc.on('exit', (code: any, signal: any) => {
        if (proc === activeCp) onExitCb({ exitCode: code ?? 0, signal: signal ? 1 : undefined as any });
      });

      return proc;
    };

    activeCp = startBridge('python3');

    return {
      write: (data: string) => { if (activeCp?.stdin?.writable) activeCp.stdin.write(data); },
      kill: () => { activeCp?.kill(); },
      resize: (cols: number, rows: number) => {
         const sizeFilePath = `/tmp/gemini-term-size-${uuid}.tmp`;
         try {
           fs.writeFileSync(sizeFilePath, `${rows},${cols}`);
           activeCp?.kill('SIGUSR1');
         } catch (e) { console.warn('[PTYFactory] Resize failed', e); }
      },
      onData: (cb: (data: string) => void) => { onDataCb = cb; },
      onExit: (cb: (status: { exitCode: number; signal?: number }) => void) => {
        const originalOnExit = onExitCb;
        onExitCb = (status) => { originalOnExit(status); cb(status); };
      }
    };
  }
}
