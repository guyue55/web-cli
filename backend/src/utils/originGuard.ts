import { SecurityConfig } from '../config/SecurityConfig.js';

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;

  const allowed = SecurityConfig.allowedOrigins();
  if (allowed.length > 0) {
    return allowed.includes(origin);
  }

  return isLocalOrigin(origin);
}
