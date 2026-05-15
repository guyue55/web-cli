import fs from 'fs';
import os from 'os';
import path from 'path';

const GEMINI_BASE_DIR = path.join(os.homedir(), '.gemini');

function splitEnvList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readGeminiProjectPaths(): string[] {
  const projectsFile = path.join(GEMINI_BASE_DIR, 'projects.json');
  if (!fs.existsSync(projectsFile)) return [];

  try {
    const { projects } = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
    return Object.keys(projects as Record<string, string>);
  } catch {
    return [];
  }
}

export class SecurityConfig {
  static authToken(): string | null {
    const token = process.env.WEB_CLI_AUTH_TOKEN?.trim();
    return token || null;
  }

  static isAuthEnabled(): boolean {
    return Boolean(this.authToken());
  }

  static allowedOrigins(): string[] {
    return splitEnvList(process.env.WEB_CLI_ALLOWED_ORIGINS);
  }

  static workspaceRoots(): string[] {
    const configured = splitEnvList(process.env.WEB_CLI_WORKSPACE_ROOTS);
    const roots = configured.length > 0
      ? configured
      : [process.cwd(), ...readGeminiProjectPaths()];

    return Array.from(new Set(roots.map((root) => path.resolve(root))));
  }

  static geminiArgs(isNew: boolean, uuid: string): string[] {
    const args = isNew ? [] : ['--resume', uuid];
    const approvalMode = process.env.GEMINI_APPROVAL_MODE?.trim();

    if (process.env.GEMINI_SKIP_TRUST === 'true') {
      args.push('--skip-trust');
    }
    if (approvalMode && approvalMode !== 'default') {
      args.push('--approval-mode', approvalMode);
    }

    args.push('--prompt-interactive', ' ');
    return args;
  }
}
