import os from 'os';
import { SecurityConfig } from '../config/SecurityConfig.js';

let cachedLocalIPs: string[] | null = null;

function getLocalIPs(): string[] {
  if (cachedLocalIPs) {
    return cachedLocalIPs;
  }

  const interfaces = os.networkInterfaces();
  const ips: string[] = ['localhost', '127.0.0.1', '::1'];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.address) {
        ips.push(iface.address);
      }
    }
  }
  cachedLocalIPs = Array.from(new Set(ips));
  return cachedLocalIPs;
}

function isLocalOrPrivateOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    // Check if it's one of the server's own IPs
    if (getLocalIPs().includes(hostname)) {
      return true;
    }

    // Check for private IPv4 ranges
    // 10.0.0.0 – 10.255.255.255
    // 172.16.0.0 – 172.31.255.255
    // 192.168.0.0 – 192.168.255.255
    const parts = hostname.split('.');
    if (parts.length === 4) {
      const p1 = parseInt(parts[0]!, 10);
      const p2 = parseInt(parts[1]!, 10);
      if (p1 === 10) return true;
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
      if (p1 === 192 && p2 === 168) return true;
    }

    return false;
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

  return isLocalOrPrivateOrigin(origin);
}
