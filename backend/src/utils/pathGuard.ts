import fs from 'fs';
import path from 'path';
import { SecurityConfig } from '../config/SecurityConfig.js';

function toRealPath(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }
  return fs.realpathSync(resolved);
}

export function getAllowedWorkspaceRoots(): string[] {
  return SecurityConfig.workspaceRoots()
    .filter((root) => fs.existsSync(root))
    .map((root) => fs.realpathSync(root));
}

export function assertAllowedPath(targetPath: string, label: string = 'path'): string {
  try {
    return toRealPath(targetPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : `${label} is not accessible`;
    throw new Error(message);
  }
}
