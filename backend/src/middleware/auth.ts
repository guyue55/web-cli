import type { Request, RequestHandler } from 'express';
import type { IncomingMessage } from 'http';
import { SecurityConfig } from '../config/SecurityConfig.js';

function extractBearerToken(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]?.trim() || null : null;
}

function tokenFromExpressRequest(req: Request): string | null {
  return extractBearerToken(req.header('authorization')) || req.header('x-web-cli-token') || null;
}

function tokenFromWsRequest(req: IncomingMessage, authTokenQuery: string | null): string | null {
  const authorization = req.headers.authorization;
  const headerValue = Array.isArray(authorization) ? authorization[0] : authorization;
  const headerToken = extractBearerToken(headerValue);
  const customToken = req.headers['x-web-cli-token'];
  const customHeaderToken = Array.isArray(customToken) ? customToken[0] : customToken;
  return headerToken || customHeaderToken || authTokenQuery;
}

function isTokenAccepted(token: string | null): boolean {
  const expected = SecurityConfig.authToken();
  return !expected || token === expected;
}

export const requireHttpAuth: RequestHandler = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
  if (!isTokenAccepted(tokenFromExpressRequest(req))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

export function isWsAuthorized(req: IncomingMessage, url: URL): boolean {
  return isTokenAccepted(tokenFromWsRequest(req, url.searchParams.get('authToken')));
}
