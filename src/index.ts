import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { verifyAuth } from '@supabase/server/core';
import { getDb } from './db/client';
import { authTokens, comments, destinations, identityVerifications, postLikes, postMedia, posts, profiles, sessions, stamps, userStamps, users, visits } from './db/schema';
import { openApiJson, swaggerHtml } from './docs';
import { infoHtml } from './info';
import { createAccessToken, hashPassword, hashToken, randomToken, verifyAccessToken, verifyPassword } from './lib/security';
import { buildMediaTarget, bucketFor, isOwnedDocument, ownedPrivateObject } from './lib/media';
import { requireAuth } from './middleware/auth';
import type { AppVariables, Env } from './types';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
app.use('*', logger());
app.use('*', secureHeaders());
app.use('/api/*', async (c, next) => cors({ origin: c.env.ALLOWED_ORIGINS === '*' ? '*' : c.env.ALLOWED_ORIGINS.split(',').map((x) => x.trim()), allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], maxAge: 86400 })(c, next));

const registerSchema = z.object({
  email: z.string().email().max(320),
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9._]+$/),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(140),
  visitorType: z.enum(['local', 'foreign']),
  nationality: z.string().max(80).optional(),
  countryCode: z.string().length(2).optional(),
  preferredLanguage: z.enum(['es', 'en']).default('es'),
  deviceName: z.string().max(120).optional(),
  birthDate: z.coerce.date().max(new Date()),
  documentType: z.enum(['dpi', 'passport']).optional(),
  documentNumber: z.string().min(4).max(40),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1), deviceName: z.string().max(120).optional() });

function publicUser(user: typeof users.$inferSelect, profile?: typeof profiles.$inferSelect) {
  return { id: user.id, email: user.email, username: user.username, role: user.role, status: user.status, emailVerified: !!user.emailVerifiedAt, profile: profile ? { fullName: profile.fullName, visitorType: profile.visitorType, nationality: profile.nationality, countryCode: profile.countryCode, city: profile.city, bio: profile.bio, avatarKey: profile.avatarKey, verificationStatus: profile.verificationStatus, profileVisibility: profile.profileVisibility } : undefined };
}

async function issueSession(env: Env, userId: string, deviceName?: string) {
  const db = getDb(env); const refreshToken = randomToken(); const refreshTokenHash = await hashToken(refreshToken); const expiresAt = new Date(Date.now() + Number(env.REFRESH_TOKEN_TTL_DAYS || 30) * 86400000);
  const [session] = await db.insert(sessions).values({ userId, refreshTokenHash, deviceName, expiresAt }).returning();
  const accessToken = await createAccessToken(env.JWT_SECRET, userId, session.id, Number(env.ACCESS_TOKEN_TTL_MINUTES || 15));
  return { accessToken, refreshToken, expiresIn: Number(env.ACCESS_TOKEN_TTL_MINUTES || 15) * 60 };
}

app.get('/', (c) => c.json({ service: 'NÃ³mada API', status: 'ok', version: 'v1' }));
app.get('/info', (c) => c.html(infoHtml()));
app.get('/api/v1/health', async (c) => { try { await getDb(c.env).execute(sql`select 1`); return c.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() }); } catch { return c.json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() }, 503); } });
app.get('/api/v1/openapi.json', openApiJson);
app.get('/api/v1/docs', (c) => c.html(swaggerHtml()));

// Endpoint de transiciÃ³n para tokens emitidos por Supabase Auth.
// Las rutas existentes continÃºan usando sesiones propias hasta completar la migraciÃ³n.
app.get('/api/v1/supabase/me', async (c) => {
  const { data: auth, error } = await verifyAuth(c.req.raw, {
    auth: 'user',
    env: {
      url: c.env.SUPABASE_URL,
      publishableKeys: { default: c.env.SUPABASE_PUBLISHABLE_KEY },
      secretKeys: c.env.SUPABASE_SECRET_KEY ? { default: c.env.SUPABASE_SECRET_KEY } : {},
      jwks: new URL(c.env.SUPABASE_JWKS_URL),
    },
  });
  if (error) return c.json({ error: error.code, message: error.message }, error.status as 401);
  return c.json({
    authMode: auth.authMode,
    user: auth.userClaims,
    subject: auth.jwtClaims?.sub,
  });
});

app.post('/api/v1/auth/register', async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', message: 'Revisa los datos enviados.', fields: parsed.error.flatten().fieldErrors }, 422);
  const input = parsed.data; const documentType = input.documentType ?? (input.visitorType === 'local' ? 'dpi' : 'passport'); if ((input.visitorType === 'local' && documentType !== 'dpi') || (input.visitorType === 'foreign' && documentType !== 'passport')) return c.json({ error: 'validation_error', message: 'El tipo de documento no corresponde al tipo de viajero.' }, 422); const db = getDb(c.env); const email = input.email.trim().toLowerCase(); const username = input.username.trim().toLowerCase(); const documentHash = await hashToken(input.documentNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const duplicate = await db.select({ id: users.id, email: users.email, username: users.username }).from(users).where(sql`${users.email} = ${email} OR ${users.username} = ${username}`).limit(1);
  if (duplicate.length) return c.json({ error: 'account_exists', message: duplicate[0].email === email ? 'Ese correo ya estÃ¡ registrado.' : 'Ese nombre de usuario no estÃ¡ disponible.' }, 409);
  const documentInUse = await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.registrationDocumentHash, documentHash)).limit(1);
  if (documentInUse.length) return c.json({ error: 'document_exists', message: documentType === 'dpi' ? 'Ese DPI ya está registrado.' : 'Ese número de pasaporte ya está registrado.' }, 409);
  const passwordHash = await hashPassword(input.password);
  const result = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, username, passwordHash }).returning();
    const [profile] = await tx.insert(profiles).values({
      userId: user.id,
      fullName: input.fullName.trim(),
      visitorType: input.visitorType,
      nationality: input.nationality,
      countryCode: input.countryCode?.toUpperCase(),
      birthDate: input.birthDate,
      registrationDocumentType: documentType,
      registrationDocumentHash: documentHash,
      preferredLanguage: input.preferredLanguage,
    }).returning();
    return { user, profile };
  });
  const verificationToken = randomToken(); await db.insert(authTokens).values({ userId: result.user.id, type: 'verify_email', tokenHash: await hashToken(verificationToken), expiresAt: new Date(Date.now() + 86400000) });
  const session = await issueSession(c.env, result.user.id, input.deviceName);
  return c.json({ ...session, user: publicUser(result.user, result.profile), ...(c.env.APP_ENV === 'development' ? { debugEmailVerificationToken: verificationToken } : {}) }, 201);
});

app.post('/api/v1/auth/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', message: 'Correo o contraseÃ±a invÃ¡lidos.' }, 422);
  const db = getDb(c.env); const found = await db.select().from(users).where(eq(users.email, parsed.data.email.trim().toLowerCase())).limit(1); if (!found.length || !(await verifyPassword(parsed.data.password, found[0].passwordHash))) return c.json({ error: 'invalid_credentials', message: 'Correo o contraseÃ±a incorrectos.' }, 401);
  if (found[0].status !== 'active') return c.json({ error: 'account_disabled', message: 'La cuenta no estÃ¡ activa.' }, 403);
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, found[0].id)).limit(1); await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, found[0].id)); const session = await issueSession(c.env, found[0].id, parsed.data.deviceName); return c.json({ ...session, user: publicUser(found[0], profile) });
});

app.post('/api/v1/auth/refresh', async (c) => {
  const parsed = z.object({ refreshToken: z.string().min(32) }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', message: 'Token de renovaciÃ³n requerido.' }, 422);
  const db = getDb(c.env); const tokenHash = await hashToken(parsed.data.refreshToken); const [session] = await db.select().from(sessions).where(and(eq(sessions.refreshTokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))).limit(1); if (!session) return c.json({ error: 'invalid_refresh_token', message: 'Debes iniciar sesiÃ³n nuevamente.' }, 401);
  const nextToken = randomToken(); const nextHash = await hashToken(nextToken); const expiresAt = new Date(Date.now() + Number(c.env.REFRESH_TOKEN_TTL_DAYS || 30) * 86400000); await db.update(sessions).set({ refreshTokenHash: nextHash, expiresAt }).where(eq(sessions.id, session.id)); const accessToken = await createAccessToken(c.env.JWT_SECRET, session.userId, session.id, Number(c.env.ACCESS_TOKEN_TTL_MINUTES || 15)); return c.json({ accessToken, refreshToken: nextToken, expiresIn: Number(c.env.ACCESS_TOKEN_TTL_MINUTES || 15) * 60 });
});

app.post('/api/v1/auth/forgot-password', async (c) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ message: 'Si la cuenta existe, recibirÃ¡s instrucciones.' }); const db = getDb(c.env); const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1); let debugToken: string | undefined;
  if (user) { const token = randomToken(); debugToken = token; await db.insert(authTokens).values({ userId: user.id, type: 'reset_password', tokenHash: await hashToken(token), expiresAt: new Date(Date.now() + 30 * 60000) }); }
  return c.json({ message: 'Si la cuenta existe, recibirÃ¡s instrucciones.', ...(c.env.APP_ENV === 'development' && debugToken ? { debugResetToken: debugToken } : {}) });
});

app.post('/api/v1/auth/reset-password', async (c) => {
  const parsed = z.object({ token: z.string().min(32), password: z.string().min(8).max(128) }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', message: 'El enlace o la contraseÃ±a no son vÃ¡lidos.' }, 422); const db = getDb(c.env); const tokenHash = await hashToken(parsed.data.token); const [record] = await db.select().from(authTokens).where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, 'reset_password'), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1); if (!record) return c.json({ error: 'expired_token', message: 'El enlace expirÃ³ o ya fue utilizado.' }, 400);
  await db.transaction(async (tx) => { await tx.update(users).set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: new Date() }).where(eq(users.id, record.userId)); await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, record.id)); await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, record.userId), isNull(sessions.revokedAt))); }); return c.json({ message: 'ContraseÃ±a actualizada. Inicia sesiÃ³n nuevamente.' });
});

app.post('/api/v1/auth/logout', requireAuth, async (c) => { await getDb(c.env).update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, c.get('sessionId'))); return c.body(null, 204); });
app.get('/api/v1/me', requireAuth, async (c) => { const db = getDb(c.env); const [row] = await db.select({ user: users, profile: profiles }).from(users).innerJoin(profiles, eq(users.id, profiles.userId)).where(eq(users.id, c.get('userId'))).limit(1); return row ? c.json({ user: publicUser(row.user, row.profile) }) : c.json({ error: 'not_found', message: 'Cuenta no encontrada.' }, 404); });
app.patch('/api/v1/me/profile', requireAuth, async (c) => { const parsed = z.object({ fullName: z.string().min(2).max(140).optional(), city: z.string().max(100).nullable().optional(), nationality: z.string().max(80).nullable().optional(), bio: z.string().max(240).nullable().optional(), avatarKey: z.string().max(500).nullable().optional(), profileVisibility: z.enum(['public', 'private']).optional(), preferredLanguage: z.enum(['es', 'en']).optional() }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const [profile] = await getDb(c.env).update(profiles).set({ ...parsed.data, updatedAt: new Date() }).where(eq(profiles.userId, c.get('userId'))).returning(); return c.json({ profile }); });
app.post('/api/v1/me/change-password', requireAuth, async (c) => { const parsed = z.object({ currentPassword: z.string(), newPassword: z.string().min(8).max(128) }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', message: 'Revisa la contraseÃ±a.' }, 422); const db = getDb(c.env); const [user] = await db.select().from(users).where(eq(users.id, c.get('userId'))).limit(1); if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) return c.json({ error: 'invalid_password', message: 'La contraseÃ±a actual no coincide.' }, 400); await db.update(users).set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: new Date() }).where(eq(users.id, user.id)); return c.json({ message: 'ContraseÃ±a actualizada.' }); });

app.post('/api/v1/media', requireAuth, async (c) => {
  const parsed = z.object({ kind: z.enum(['profile', 'post', 'visit', 'identity']), slot: z.string().optional() }).safeParse({ kind: c.req.query('kind') ?? 'post', slot: c.req.query('slot') });
  if (!parsed.success) return c.json({ error: 'validation_error', message: 'Tipo de archivo no vÃ¡lido.' }, 422);
  const contentType = c.req.header('Content-Type')?.split(';')[0].trim().toLowerCase() ?? '';
  const bytes = await c.req.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) return c.json({ error: 'invalid_size', message: 'La imagen debe pesar entre 1 byte y 10 MB.' }, 413);
  try {
    const target = buildMediaTarget(parsed.data.kind, c.get('userId'), contentType, parsed.data.slot);
    await bucketFor(c.env, target.bucket).put(target.key, bytes, {
      httpMetadata: { contentType },
      customMetadata: { ownerId: c.get('userId'), visibility: target.visibility, kind: parsed.data.kind },
    });
    return c.json({ bucket: target.bucket, objectKey: target.key, visibility: target.visibility }, 201);
  } catch {
    return c.json({ error: 'unsupported_media', message: 'Solo se permiten imÃ¡genes JPEG, PNG o WebP.' }, 415);
  }
});

app.get('/api/v1/media/fotos/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.FOTOS.get(key);
  if (!object) return c.notFound();
  const isPublic = object.customMetadata?.visibility === 'public';
  if (!isPublic) {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) return c.json({ error: 'unauthorized', message: 'Debes iniciar sesiÃ³n.' }, 401);
    try {
      const { userId } = await verifyAccessToken(c.env.JWT_SECRET, header.slice(7));
      if (object.customMetadata?.ownerId !== userId) return c.json({ error: 'forbidden', message: 'No tienes acceso a este archivo.' }, 403);
    } catch { return c.json({ error: 'invalid_token', message: 'La sesiÃ³n no es vÃ¡lida.' }, 401); }
  }
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); headers.set('Cache-Control', isPublic ? 'public, max-age=86400' : 'private, no-store');
  return new Response(object.body, { headers });
});

app.get('/api/v1/media/documentos/:key{.+}', requireAuth, async (c) => {
  const object = await ownedPrivateObject(c.env.DOCUMENTOS, c.req.param('key'), c.get('userId'));
  if (!object) return c.json({ error: 'not_found', message: 'Documento no encontrado.' }, 404);
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); headers.set('Cache-Control', 'private, no-store'); headers.set('Content-Disposition', 'inline');
  return new Response(object.body, { headers });
});

app.get('/api/v1/destinations', async (c) => { const db = getDb(c.env); const department = c.req.query('department'); const rows = await db.select().from(destinations).where(department ? and(eq(destinations.isActive, true), eq(destinations.department, department)) : eq(destinations.isActive, true)).orderBy(destinations.name); return c.json({ data: rows }); });
app.get('/api/v1/destinations/:id', async (c) => { const [row] = await getDb(c.env).select().from(destinations).where(and(eq(destinations.id, c.req.param('id')), eq(destinations.isActive, true))).limit(1); return row ? c.json({ destination: row }) : c.json({ error: 'not_found', message: 'Destino no encontrado.' }, 404); });

app.get('/api/v1/posts', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
  const db = getDb(c.env);
  const rows = await db.select({ post: posts, username: users.username, fullName: profiles.fullName, avatarKey: profiles.avatarKey }).from(posts).innerJoin(users, eq(posts.userId, users.id)).innerJoin(profiles, eq(posts.userId, profiles.userId)).where(eq(posts.status, 'published')).orderBy(desc(posts.createdAt)).limit(limit);
  const data = await Promise.all(rows.map(async (row) => ({ ...row, media: await db.select({ objectKey: postMedia.objectKey, mediaType: postMedia.mediaType, position: postMedia.position }).from(postMedia).where(eq(postMedia.postId, row.post.id)).orderBy(postMedia.position) })));
  return c.json({ data });
});
app.post('/api/v1/posts', requireAuth, async (c) => { const parsed = z.object({ caption: z.string().min(1).max(800), destinationId: z.string().uuid().optional(), visibility: z.enum(['public', 'followers', 'private']).default('public'), mediaKeys: z.array(z.string().min(1)).min(1).max(10) }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const db = getDb(c.env); const post = await db.transaction(async (tx) => { const [created] = await tx.insert(posts).values({ userId: c.get('userId'), caption: parsed.data.caption, destinationId: parsed.data.destinationId, visibility: parsed.data.visibility }).returning(); await tx.insert(postMedia).values(parsed.data.mediaKeys.map((objectKey, position) => ({ postId: created.id, objectKey, position }))); return created; }); return c.json({ post }, 201); });
app.post('/api/v1/posts/:id/like', requireAuth, async (c) => { const db = getDb(c.env); const inserted = await db.insert(postLikes).values({ postId: c.req.param('id'), userId: c.get('userId') }).onConflictDoNothing().returning(); if (inserted.length) await db.update(posts).set({ likeCount: sql`${posts.likeCount} + 1`, updatedAt: new Date() }).where(eq(posts.id, c.req.param('id'))); return c.json({ liked: true }); });
app.delete('/api/v1/posts/:id/like', requireAuth, async (c) => { const db = getDb(c.env); const deleted = await db.delete(postLikes).where(and(eq(postLikes.postId, c.req.param('id')), eq(postLikes.userId, c.get('userId')))).returning(); if (deleted.length) await db.update(posts).set({ likeCount: sql`greatest(${posts.likeCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, c.req.param('id'))); return c.body(null, 204); });
app.post('/api/v1/posts/:id/comments', requireAuth, async (c) => { const parsed = z.object({ body: z.string().min(1).max(500) }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', message: 'El comentario no es vÃ¡lido.' }, 422); const db = getDb(c.env); const [comment] = await db.insert(comments).values({ postId: c.req.param('id'), userId: c.get('userId'), body: parsed.data.body }).returning(); await db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1`, updatedAt: new Date() }).where(eq(posts.id, c.req.param('id'))); return c.json({ comment }, 201); });

app.post('/api/v1/verification', requireAuth, async (c) => { const parsed = z.object({ documentType: z.enum(['dpi', 'passport']), documentNumber: z.string().min(4).max(40), documentFrontKey: z.string(), documentBackKey: z.string().optional(), selfieKey: z.string() }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const userId = c.get('userId'); const keys = [parsed.data.documentFrontKey, parsed.data.selfieKey, parsed.data.documentBackKey].filter((key): key is string => !!key); if (!(await Promise.all(keys.map((key) => isOwnedDocument(c.env, key, userId)))).every(Boolean)) return c.json({ error: 'invalid_document', message: 'Debes adjuntar documentos que te pertenezcan.' }, 422); const db = getDb(c.env); const [request] = await db.insert(identityVerifications).values({ userId, documentType: parsed.data.documentType, documentNumberHash: await hashToken(parsed.data.documentNumber.trim()), documentFrontKey: parsed.data.documentFrontKey, documentBackKey: parsed.data.documentBackKey, selfieKey: parsed.data.selfieKey }).returning(); await db.update(profiles).set({ verificationStatus: 'pending', updatedAt: new Date() }).where(eq(profiles.userId, userId)); return c.json({ verification: request }, 201); });
app.get('/api/v1/verification/status', requireAuth, async (c) => { const [request] = await getDb(c.env).select({ id: identityVerifications.id, status: identityVerifications.status, reviewerNotes: identityVerifications.reviewerNotes, createdAt: identityVerifications.createdAt, reviewedAt: identityVerifications.reviewedAt }).from(identityVerifications).where(eq(identityVerifications.userId, c.get('userId'))).orderBy(desc(identityVerifications.createdAt)).limit(1); return c.json({ verification: request ?? { status: 'unverified' } }); });

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) { const r = 6371000; const p1 = lat1 * Math.PI / 180; const p2 = lat2 * Math.PI / 180; const dp = (lat2 - lat1) * Math.PI / 180; const dl = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
app.post('/api/v1/visits/validate', requireAuth, async (c) => { const parsed = z.object({ destinationId: z.string().uuid(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracyMeters: z.number().positive().max(2000).optional(), evidenceKey: z.string().optional() }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const db = getDb(c.env); const [destination] = await db.select().from(destinations).where(eq(destinations.id, parsed.data.destinationId)).limit(1); if (!destination) return c.json({ error: 'not_found', message: 'Destino no encontrado.' }, 404); const distance = distanceMeters(parsed.data.latitude, parsed.data.longitude, destination.latitude, destination.longitude); if (distance > destination.validationRadiusMeters) return c.json({ error: 'outside_radius', message: `Debes estar a menos de ${destination.validationRadiusMeters} m del destino.`, distanceMeters: Math.round(distance) }, 422); const result = await db.transaction(async (tx) => { const [visit] = await tx.insert(visits).values({ userId: c.get('userId'), destinationId: destination.id, latitude: parsed.data.latitude, longitude: parsed.data.longitude, accuracyMeters: parsed.data.accuracyMeters, distanceMeters: distance, evidenceKey: parsed.data.evidenceKey }).returning(); const [stamp] = await tx.select().from(stamps).where(and(eq(stamps.destinationId, destination.id), eq(stamps.isActive, true))).limit(1); let awarded = null; if (stamp) { const [row] = await tx.insert(userStamps).values({ userId: c.get('userId'), stampId: stamp.id, visitId: visit.id, certificateCode: `NMD-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}` }).onConflictDoNothing().returning(); awarded = row ?? null; } return { visit, awarded, stamp }; }); return c.json(result, 201); });
app.get('/api/v1/passport', requireAuth, async (c) => { const db = getDb(c.env); const [profile] = await db.select().from(profiles).where(eq(profiles.userId, c.get('userId'))).limit(1); const collection = await db.select({ stamp: stamps, earnedAt: userStamps.earnedAt, certificateCode: userStamps.certificateCode }).from(userStamps).innerJoin(stamps, eq(userStamps.stampId, stamps.id)).where(eq(userStamps.userId, c.get('userId'))).orderBy(desc(userStamps.earnedAt)); const points = collection.length * 100; return c.json({ owner: profile, level: Math.floor(points / 250) + 1, points, stamps: collection }); });

app.notFound((c) => c.json({ error: 'not_found', message: 'Ruta no encontrada.' }, 404));
app.onError((error, c) => { console.error(error); return c.json({ error: 'internal_error', message: c.env.APP_ENV === 'development' ? error.message : 'OcurriÃ³ un error inesperado.' }, 500); });

export default app;

