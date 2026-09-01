import { and, eq, gt, isNull } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { getDb } from '../db/client';
import { sessions, users } from '../db/schema';
import { verifyAccessToken } from '../lib/security';
import type { AppVariables, Env } from '../types';

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return c.json({ error: 'unauthorized', message: 'Debes iniciar sesión.' }, 401);
  try {
    const auth = await verifyAccessToken(c.env.JWT_SECRET, header.slice(7));
    const db = getDb(c.env);
    const active = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, auth.sessionId), eq(sessions.userId, auth.userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))).limit(1);
    if (!active.length) return c.json({ error: 'session_expired', message: 'La sesión ya no está activa.' }, 401);
    c.set('userId', auth.userId); c.set('sessionId', auth.sessionId);
    await next();
  } catch {
    return c.json({ error: 'invalid_token', message: 'La sesión no es válida o expiró.' }, 401);
  }
});

// Debe usarse después de requireAuth. El rol nunca llega desde el cliente.
export const requireAdmin = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
  const [user] = await getDb(c.env).select({ role: users.role, status: users.status }).from(users).where(eq(users.id, c.get('userId'))).limit(1);
  if (!user || user.status !== 'active' || user.role !== 'admin') return c.json({ error: 'forbidden', message: 'Esta acción requiere un rol de administrador.' }, 403);
  await next();
});
