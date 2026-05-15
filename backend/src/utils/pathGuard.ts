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

function isInsideRoot(targetPath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function getAllowedWorkspaceRoots(): string[] {
  return SecurityConfig.workspaceRoots()
    .filter((root) => fs.existsSync(root))
    .map((root) => fs.realpathSync(root));
}

export function assertAllowedPath(targetPath: string, label: string = 'path'): string {
  const realTarget = toRealPath(targetPath);
  const roots = getAllowedWorkspaceRoots();

  if (roots.some((root) => isInsideRoot(realTarget, root))) {
    return realTarget;
  }

  throw new Error(`${label} is outside allowed workspace roots`);
}
