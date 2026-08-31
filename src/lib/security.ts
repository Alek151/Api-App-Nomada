import { jwtVerify, SignJWT } from 'jose';

const encoder = new TextEncoder();
const ITERATIONS = 210_000;

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, 256);
  return `${ITERATIONS}.${toBase64Url(salt)}.${toBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [iterationsText, saltText, expected] = stored.split('.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromBase64Url(saltText), iterations: Number(iterationsText), hash: 'SHA-256' }, material, 256);
  const actual = new Uint8Array(bits);
  const expectedBytes = fromBase64Url(expected);
  if (actual.length !== expectedBytes.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1) mismatch |= actual[i] ^ expectedBytes[i];
  return mismatch === 0;
}

export function randomToken(bytes = 32) { return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes))); }

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return toBase64Url(new Uint8Array(digest));
}

export async function createAccessToken(secret: string, userId: string, sessionId: string, minutes = 15) {
  return new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(userId).setIssuer('nomada-api').setAudience('nomada-mobile').setIssuedAt().setExpirationTime(`${minutes}m`).sign(encoder.encode(secret));
}

export async function verifyAccessToken(secret: string, token: string) {
  const { payload } = await jwtVerify(token, encoder.encode(secret), { issuer: 'nomada-api', audience: 'nomada-mobile' });
  if (!payload.sub || typeof payload.sid !== 'string') throw new Error('Token inválido');
  return { userId: payload.sub, sessionId: payload.sid };
}
