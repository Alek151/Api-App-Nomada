import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { verifyAuth } from '@supabase/server/core';
import { getDb } from './db/client';
import { authTokens, badges, commentLikes, comments, destinationPhotos, destinations, identityVerifications, postLikes, postMedia, posts, profiles, recognitions, routeStops, routes, savedPosts, sessions, stamps, userBadges, userRecognitions, userStamps, users, visits } from './db/schema';
import { openApiJson, swaggerHtml } from './docs';
import { infoHtml } from './info';
import { createAccessToken, hashPassword, hashToken, randomToken, verifyAccessToken, verifyPassword } from './lib/security';
import { buildMediaTarget, bucketFor, isOwnedDocument, ownedPrivateObject } from './lib/media';
import { requireAdmin, requireAuth } from './middleware/auth';
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
  birthDate: z.coerce.date(),
  documentType: z.enum(['dpi', 'passport']).optional(),
  documentNumber: z.string().min(4).max(40),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1), deviceName: z.string().max(120).optional() });
const destinationBaseSchema = z.object({
  slug: z.string().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string().min(2).max(160), department: z.string().min(2).max(100), category: z.string().min(2).max(60), description: z.string().min(10).max(4000), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), validationRadiusMeters: z.number().int().min(100).max(100).default(100), activities: z.array(z.string().min(2).max(40)).max(12).default([]), averageCostMin: z.number().int().min(0).max(100000).nullable().optional(), averageCostMax: z.number().int().min(0).max(100000).nullable().optional(), costCurrency: z.string().length(3).default('GTQ'), coverKey: z.string().max(500).nullable().optional(), sourceUrl: z.string().url().max(1000).nullable().optional(), contentStatus: z.enum(['draft', 'published', 'archived']).default('draft'), isActive: z.boolean().default(true), points: z.number().int().min(0).max(10000).default(100), stamp: z.object({ code: z.string().min(3).max(40), name: z.string().min(2).max(120), description: z.string().max(1000).nullable().optional(), artworkKey: z.string().max(500).nullable().optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(), isActive: z.boolean().default(true) }),
});
const destinationSchema = destinationBaseSchema.superRefine((value, ctx) => { if (value.averageCostMin !== null && value.averageCostMax !== null && value.averageCostMin !== undefined && value.averageCostMax !== undefined && value.averageCostMin > value.averageCostMax) ctx.addIssue({ code: 'custom', path: ['averageCostMax'], message: 'El costo máximo debe ser mayor o igual al mínimo.' }); });
const destinationPatchSchema = destinationBaseSchema.partial().extend({ humanVerified: z.boolean().optional(), verificationNotes: z.string().max(4000).nullable().optional(), stamp: destinationBaseSchema.shape.stamp.partial().optional() });
const destinationPhotoSchema = z.object({ objectKey: z.string().min(1).max(500), caption: z.string().max(240).nullable().optional(), position: z.number().int().min(0).max(100).default(0), isPrimary: z.boolean().default(false) });

function publicUser(user: typeof users.$inferSelect, profile?: typeof profiles.$inferSelect) {
  return { id: user.id, email: user.email, username: user.username, role: user.role, status: user.status, emailVerified: !!user.emailVerifiedAt, profile: profile ? { fullName: profile.fullName, visitorType: profile.visitorType, nationality: profile.nationality, countryCode: profile.countryCode, city: profile.city, bio: profile.bio, avatarKey: profile.avatarKey, verificationStatus: profile.verificationStatus, profileVisibility: profile.profileVisibility } : undefined };
}

function publicDestination(destination: typeof destinations.$inferSelect, stamp?: typeof stamps.$inferSelect, photos: (typeof destinationPhotos.$inferSelect)[] = []) {
  const { humanVerifiedAt, humanVerifiedBy, verificationNotes, sourceUrl, contentStatus, isActive, ...safeDestination } = destination;
  return { ...safeDestination, stamp: stamp ? { id: stamp.id, code: stamp.code, name: stamp.name, description: stamp.description, artworkKey: stamp.artworkKey, color: stamp.color } : null, photos: photos.map(({ id, objectKey, caption, position, isPrimary }) => ({ id, objectKey, caption, position, isPrimary })) };
}

async function destinationWithDetails(db: ReturnType<typeof getDb>, destination: typeof destinations.$inferSelect, admin = false) {
  const [stamp] = await db.select().from(stamps).where(eq(stamps.destinationId, destination.id)).limit(1);
  const photos = await db.select().from(destinationPhotos).where(eq(destinationPhotos.destinationId, destination.id)).orderBy(asc(destinationPhotos.position));
  return admin ? { destination, stamp: stamp ?? null, photos } : publicDestination(destination, stamp, photos);
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
  const maxBytes = contentType.startsWith('video/') ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!bytes.byteLength || bytes.byteLength > maxBytes) return c.json({ error: 'invalid_size', message: contentType.startsWith('video/') ? 'El video no puede superar 20 MB.' : 'La imagen debe pesar entre 1 byte y 10 MB.' }, 413);
  try {
    const target = buildMediaTarget(parsed.data.kind, c.get('userId'), contentType, parsed.data.slot);
    await bucketFor(c.env, target.bucket).put(target.key, bytes, {
      httpMetadata: { contentType },
      customMetadata: { ownerId: c.get('userId'), visibility: target.visibility, kind: parsed.data.kind },
    });
    return c.json({ bucket: target.bucket, objectKey: target.key, visibility: target.visibility }, 201);
  } catch {
    return c.json({ error: 'unsupported_media', message: 'Solo se permiten imágenes JPEG, PNG, WebP o videos MP4/MOV para publicaciones.' }, 415);
  }
});

app.post('/api/v1/admin/media', requireAuth, requireAdmin, async (c) => {
  const contentType = c.req.header('Content-Type')?.split(';')[0].trim().toLowerCase() ?? '';
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const extension = extensions[contentType]; if (!extension) return c.json({ error: 'unsupported_media', message: 'Solo se permiten imágenes JPEG, PNG o WebP.' }, 415);
  const bytes = await c.req.arrayBuffer(); if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) return c.json({ error: 'invalid_size', message: 'La imagen debe pesar hasta 10 MB.' }, 413);
  const requestedKind = c.req.query('kind'); const scope = requestedKind === 'stamp' ? 'sellos' : requestedKind === 'badge' ? 'insignias' : requestedKind === 'recognition' ? 'reconocimientos' : 'destinos'; const objectKey = `${scope}/${crypto.randomUUID()}.${extension}`;
  await c.env.FOTOS.put(objectKey, bytes, { httpMetadata: { contentType }, customMetadata: { ownerId: c.get('userId'), visibility: 'public', kind: scope } });
  return c.json({ bucket: 'photos', objectKey, visibility: 'public' }, 201);
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

app.get('/api/v1/destinations', async (c) => {
  const db = getDb(c.env); const department = c.req.query('department');
  const predicate = department ? and(eq(destinations.isActive, true), eq(destinations.contentStatus, 'published'), eq(destinations.department, department)) : and(eq(destinations.isActive, true), eq(destinations.contentStatus, 'published'));
  const rows = await db.select().from(destinations).where(predicate).orderBy(destinations.name);
  return c.json({ data: await Promise.all(rows.map((row) => destinationWithDetails(db, row))) });
});
app.get('/api/v1/destinations/:id', async (c) => {
  const [row] = await getDb(c.env).select().from(destinations).where(and(eq(destinations.id, c.req.param('id')), eq(destinations.isActive, true), eq(destinations.contentStatus, 'published'))).limit(1);
  return row ? c.json({ destination: await destinationWithDetails(getDb(c.env), row) }) : c.json({ error: 'not_found', message: 'Destino no encontrado.' }, 404);
});

async function routeWithStops(db: ReturnType<typeof getDb>, route: typeof routes.$inferSelect) {
  const stops = await db.select({ position: routeStops.position, destination: destinations }).from(routeStops).innerJoin(destinations, eq(routeStops.destinationId, destinations.id)).where(eq(routeStops.routeId, route.id)).orderBy(asc(routeStops.position));
  return { ...route, stops: await Promise.all(stops.map(async (stop) => ({ position: stop.position, destination: await destinationWithDetails(db, stop.destination) }))) };
}
app.get('/api/v1/routes', async (c) => {
  const db = getDb(c.env); const routeRows = await db.select().from(routes).where(eq(routes.isActive, true)).orderBy(asc(routes.name));
  return c.json({ data: await Promise.all(routeRows.map((route) => routeWithStops(db, route))) });
});
app.get('/api/v1/routes/:slug', async (c) => {
  const db = getDb(c.env); const [route] = await db.select().from(routes).where(and(eq(routes.slug, c.req.param('slug')), eq(routes.isActive, true))).limit(1);
  return route ? c.json({ route: await routeWithStops(db, route) }) : c.json({ error: 'not_found', message: 'Ruta no encontrada.' }, 404);
});

app.get('/api/v1/admin/destinations', requireAuth, requireAdmin, async (c) => {
  const db = getDb(c.env); const rows = await db.select().from(destinations).orderBy(destinations.name);
  return c.json({ data: await Promise.all(rows.map((row) => destinationWithDetails(db, row, true))) });
});
app.post('/api/v1/admin/destinations', requireAuth, requireAdmin, async (c) => {
  const parsed = destinationSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422);
  const input = parsed.data; const db = getDb(c.env);
  const result = await db.transaction(async (tx) => {
    const [destination] = await tx.insert(destinations).values({ ...input, costCurrency: input.costCurrency.toUpperCase(), coverKey: input.coverKey ?? null, sourceUrl: input.sourceUrl ?? null, averageCostMin: input.averageCostMin ?? null, averageCostMax: input.averageCostMax ?? null }).returning();
    const [stamp] = await tx.insert(stamps).values({ destinationId: destination.id, ...input.stamp, description: input.stamp.description ?? null, artworkKey: input.stamp.artworkKey ?? null, color: input.stamp.color ?? null }).returning();
    return { destination, stamp };
  });
  return c.json(result, 201);
});
app.patch('/api/v1/admin/destinations/:id', requireAuth, requireAdmin, async (c) => {
  const parsed = destinationPatchSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422);
  const { stamp: stampInput, humanVerified, verificationNotes, ...changes } = parsed.data; const db = getDb(c.env);
  const [existing] = await db.select().from(destinations).where(eq(destinations.id, c.req.param('id'))).limit(1); if (!existing) return c.json({ error: 'not_found', message: 'Destino no encontrado.' }, 404);
  await db.transaction(async (tx) => {
    const destinationChanges = { ...changes, ...(changes.costCurrency ? { costCurrency: changes.costCurrency.toUpperCase() } : {}), ...(humanVerified === undefined ? {} : { humanVerifiedAt: humanVerified ? new Date() : null, humanVerifiedBy: humanVerified ? c.get('userId') : null }), ...(verificationNotes === undefined ? {} : { verificationNotes }), updatedAt: new Date() };
    await tx.update(destinations).set(destinationChanges).where(eq(destinations.id, existing.id));
    if (stampInput && Object.keys(stampInput).length) await tx.update(stamps).set({ ...stampInput, updatedAt: new Date() }).where(eq(stamps.destinationId, existing.id));
  });
  const [updated] = await db.select().from(destinations).where(eq(destinations.id, existing.id)).limit(1);
  return c.json(await destinationWithDetails(db, updated, true));
});
app.post('/api/v1/admin/destinations/:id/photos', requireAuth, requireAdmin, async (c) => {
  const [destination] = await getDb(c.env).select({ id: destinations.id }).from(destinations).where(eq(destinations.id, c.req.param('id'))).limit(1); if (!destination) return c.json({ error: 'not_found', message: 'Destino no encontrado.' }, 404);
  const parsed = destinationPhotoSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422);
  const object = await c.env.FOTOS.head(parsed.data.objectKey); if (!object || object.customMetadata?.visibility !== 'public') return c.json({ error: 'invalid_media', message: 'La foto debe existir en el bucket público.' }, 422);
  const db = getDb(c.env); const [photo] = await db.transaction(async (tx) => { if (parsed.data.isPrimary) await tx.update(destinationPhotos).set({ isPrimary: false, updatedAt: new Date() }).where(eq(destinationPhotos.destinationId, destination.id)); const [created] = await tx.insert(destinationPhotos).values({ destinationId: destination.id, ...parsed.data, caption: parsed.data.caption ?? null }).returning(); if (parsed.data.isPrimary) await tx.update(destinations).set({ coverKey: created.objectKey, updatedAt: new Date() }).where(eq(destinations.id, destination.id)); return [created]; });
  return c.json({ photo }, 201);
});
app.delete('/api/v1/admin/destinations/:destinationId/photos/:photoId', requireAuth, requireAdmin, async (c) => {
  const db = getDb(c.env); const [photo] = await db.delete(destinationPhotos).where(and(eq(destinationPhotos.id, c.req.param('photoId')), eq(destinationPhotos.destinationId, c.req.param('destinationId')))).returning();
  return photo ? c.json({ deleted: true }) : c.json({ error: 'not_found', message: 'Foto no encontrada.' }, 404);
});

const badgeAdminSchema = z.object({ code: z.string().trim().min(3).max(40), name: z.string().trim().min(2).max(120), description: z.string().max(2000).nullable().optional(), artworkKey: z.string().max(500).nullable().optional(), category: z.string().min(2).max(60).default('exploración'), points: z.number().int().min(0).max(10000).default(50), isActive: z.boolean().default(true), requirement: z.record(z.string(), z.unknown()).default({}) });
const recognitionAdminSchema = z.object({ code: z.string().trim().min(3).max(40), title: z.string().trim().min(2).max(140), description: z.string().max(2000).nullable().optional(), artworkKey: z.string().max(500).nullable().optional(), category: z.string().min(2).max(60).default('comunidad'), partnerName: z.string().max(140).nullable().optional(), benefitText: z.string().max(240).nullable().optional(), points: z.number().int().min(0).max(10000).default(100), isActive: z.boolean().default(true), requirement: z.record(z.string(), z.unknown()).default({}) });
app.get('/api/v1/admin/badges', requireAuth, requireAdmin, async (c) => c.json({ data: await getDb(c.env).select().from(badges).orderBy(asc(badges.name)) }));
app.post('/api/v1/admin/badges', requireAuth, requireAdmin, async (c) => { const parsed = badgeAdminSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const [badge] = await getDb(c.env).insert(badges).values(parsed.data).returning(); return c.json({ badge }, 201); });
app.patch('/api/v1/admin/badges/:id', requireAuth, requireAdmin, async (c) => { const parsed = badgeAdminSchema.partial().safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const [badge] = await getDb(c.env).update(badges).set({ ...parsed.data, updatedAt: new Date() }).where(eq(badges.id, c.req.param('id'))).returning(); return badge ? c.json({ badge }) : c.json({ error: 'not_found', message: 'Insignia no encontrada.' }, 404); });
app.post('/api/v1/admin/users/:userId/badges/:badgeId', requireAuth, requireAdmin, async (c) => { await getDb(c.env).insert(userBadges).values({ userId: c.req.param('userId'), badgeId: c.req.param('badgeId') }).onConflictDoNothing(); return c.json({ assigned: true }, 201); });
app.get('/api/v1/admin/recognitions', requireAuth, requireAdmin, async (c) => c.json({ data: await getDb(c.env).select().from(recognitions).orderBy(asc(recognitions.title)) }));
app.post('/api/v1/admin/recognitions', requireAuth, requireAdmin, async (c) => { const parsed = recognitionAdminSchema.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const [recognition] = await getDb(c.env).insert(recognitions).values(parsed.data).returning(); return c.json({ recognition }, 201); });
app.patch('/api/v1/admin/recognitions/:id', requireAuth, requireAdmin, async (c) => { const parsed = recognitionAdminSchema.partial().safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const [recognition] = await getDb(c.env).update(recognitions).set({ ...parsed.data, updatedAt: new Date() }).where(eq(recognitions.id, c.req.param('id'))).returning(); return recognition ? c.json({ recognition }) : c.json({ error: 'not_found', message: 'Reconocimiento no encontrado.' }, 404); });
app.post('/api/v1/admin/users/:userId/recognitions/:recognitionId', requireAuth, requireAdmin, async (c) => { const notes = z.object({ notes: z.string().max(1000).optional() }).safeParse(await c.req.json().catch(() => ({}))); await getDb(c.env).insert(userRecognitions).values({ userId: c.req.param('userId'), recognitionId: c.req.param('recognitionId'), notes: notes.success ? notes.data.notes : undefined }).onConflictDoNothing(); return c.json({ assigned: true }, 201); });

app.get('/api/v1/posts', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
  const db = getDb(c.env);
  const rows = await db.select({ post: posts, username: users.username, fullName: profiles.fullName, avatarKey: profiles.avatarKey }).from(posts).innerJoin(users, eq(posts.userId, users.id)).innerJoin(profiles, eq(posts.userId, profiles.userId)).where(and(eq(posts.status, 'published'), eq(posts.visibility, 'public'))).orderBy(desc(posts.createdAt)).limit(limit);
  const data = await Promise.all(rows.map(async (row) => ({ ...row, media: await db.select({ objectKey: postMedia.objectKey, mediaType: postMedia.mediaType, position: postMedia.position }).from(postMedia).where(eq(postMedia.postId, row.post.id)).orderBy(postMedia.position) })));
  return c.json({ data });
});
app.get('/api/v1/posts/me', requireAuth, async (c) => {
  const db = getDb(c.env);
  const rows = await db.select({ post: posts, username: users.username, fullName: profiles.fullName, avatarKey: profiles.avatarKey }).from(posts).innerJoin(users, eq(posts.userId, users.id)).innerJoin(profiles, eq(posts.userId, profiles.userId)).where(eq(posts.userId, c.get('userId'))).orderBy(desc(posts.createdAt));
  const data = await Promise.all(rows.map(async (row) => ({ ...row, media: await db.select({ objectKey: postMedia.objectKey, mediaType: postMedia.mediaType, position: postMedia.position }).from(postMedia).where(eq(postMedia.postId, row.post.id)).orderBy(postMedia.position) })));
  return c.json({ data });
});
// El feed es público, pero el estado de interacción pertenece únicamente a la sesión.
// Mantenerlo separado evita filtrar datos privados y permite pintar los likes guardados
// exactamente como los dejó cada viajero al volver a abrir la aplicación.
app.get('/api/v1/posts/interactions/me', requireAuth, async (c) => {
  const db = getDb(c.env); const userId = c.get('userId');
  const [likes, saved] = await Promise.all([
    db.select({ postId: postLikes.postId }).from(postLikes).where(eq(postLikes.userId, userId)),
    db.select({ postId: savedPosts.postId }).from(savedPosts).where(eq(savedPosts.userId, userId)),
  ]);
  return c.json({ likedPostIds: likes.map((item) => item.postId), savedPostIds: saved.map((item) => item.postId) });
});
app.post('/api/v1/posts', requireAuth, async (c) => { const parsed = z.object({ caption: z.string().min(1).max(800), destinationId: z.string().uuid().optional(), locationLabel: z.string().min(2).max(160).optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), visibility: z.enum(['public', 'followers', 'private']).default('public'), mediaKeys: z.array(z.string().min(1)).max(10).default([]), mediaTypes: z.array(z.enum(['image', 'video'])).max(10).optional() }).superRefine((value, ctx) => { if ((value.latitude === undefined) !== (value.longitude === undefined)) ctx.addIssue({ code: 'custom', message: 'Las coordenadas deben enviarse juntas.', path: ['latitude'] }); if (value.mediaTypes && value.mediaTypes.length !== value.mediaKeys.length) ctx.addIssue({ code: 'custom', message: 'Cada archivo necesita un tipo de medio.', path: ['mediaTypes'] }); }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const db = getDb(c.env); const post = await db.transaction(async (tx) => { const [created] = await tx.insert(posts).values({ userId: c.get('userId'), caption: parsed.data.caption, destinationId: parsed.data.destinationId, locationLabel: parsed.data.locationLabel, latitude: parsed.data.latitude, longitude: parsed.data.longitude, visibility: parsed.data.visibility }).returning(); if (parsed.data.mediaKeys.length) await tx.insert(postMedia).values(parsed.data.mediaKeys.map((objectKey, position) => ({ postId: created.id, objectKey, mediaType: parsed.data.mediaTypes?.[position] ?? 'image', position }))); return created; }); return c.json({ post }, 201); });
app.post('/api/v1/posts/:id/like', requireAuth, async (c) => { const db = getDb(c.env); const inserted = await db.insert(postLikes).values({ postId: c.req.param('id'), userId: c.get('userId') }).onConflictDoNothing().returning(); if (inserted.length) await db.update(posts).set({ likeCount: sql`${posts.likeCount} + 1`, updatedAt: new Date() }).where(eq(posts.id, c.req.param('id'))); return c.json({ liked: true }); });
app.delete('/api/v1/posts/:id/like', requireAuth, async (c) => { const db = getDb(c.env); const deleted = await db.delete(postLikes).where(and(eq(postLikes.postId, c.req.param('id')), eq(postLikes.userId, c.get('userId')))).returning(); if (deleted.length) await db.update(posts).set({ likeCount: sql`greatest(${posts.likeCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, c.req.param('id'))); return c.body(null, 204); });
app.patch('/api/v1/posts/:id', requireAuth, async (c) => { const parsed = z.object({ visibility: z.enum(['public', 'followers', 'private']).optional(), caption: z.string().min(1).max(800).optional() }).refine((value) => value.visibility !== undefined || value.caption !== undefined).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const db = getDb(c.env); const [post] = await db.update(posts).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(posts.id, c.req.param('id')), eq(posts.userId, c.get('userId')))).returning(); return post ? c.json({ post }) : c.json({ error: 'not_found', message: 'No puedes modificar esta publicación.' }, 404); });
app.put('/api/v1/posts/:id/save', requireAuth, async (c) => { const db = getDb(c.env); await db.insert(savedPosts).values({ postId: c.req.param('id'), userId: c.get('userId') }).onConflictDoNothing(); return c.json({ saved: true }); });
app.delete('/api/v1/posts/:id/save', requireAuth, async (c) => { await getDb(c.env).delete(savedPosts).where(and(eq(savedPosts.postId, c.req.param('id')), eq(savedPosts.userId, c.get('userId')))); return c.body(null, 204); });
app.get('/api/v1/posts/:id/comments', requireAuth, async (c) => { const db = getDb(c.env); const viewerId = c.get('userId'); const rows = await db.select({ comment: comments, username: users.username, fullName: profiles.fullName, avatarKey: profiles.avatarKey, likedByMe: commentLikes.commentId }).from(comments).innerJoin(users, eq(comments.userId, users.id)).innerJoin(profiles, eq(comments.userId, profiles.userId)).leftJoin(commentLikes, and(eq(commentLikes.commentId, comments.id), eq(commentLikes.userId, viewerId))).where(eq(comments.postId, c.req.param('id'))).orderBy(asc(comments.createdAt)); return c.json({ data: rows.map((row) => ({ ...row.comment, author: { username: row.username, fullName: row.fullName, avatarKey: row.avatarKey }, isLiked: !!row.likedByMe, isOwner: row.comment.userId === viewerId })) }); });
app.post('/api/v1/posts/:id/comments', requireAuth, async (c) => { const parsed = z.object({ body: z.string().trim().min(1).max(500), parentId: z.string().uuid().optional() }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const db = getDb(c.env); if (parsed.data.parentId) { const [parent] = await db.select({ id: comments.id }).from(comments).where(and(eq(comments.id, parsed.data.parentId), eq(comments.postId, c.req.param('id')))).limit(1); if (!parent) return c.json({ error: 'not_found', message: 'El comentario al que respondes no existe.' }, 404); } const [comment] = await db.insert(comments).values({ postId: c.req.param('id'), userId: c.get('userId'), parentId: parsed.data.parentId, body: parsed.data.body }).returning(); await db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1`, updatedAt: new Date() }).where(eq(posts.id, c.req.param('id'))); return c.json({ comment }, 201); });
app.patch('/api/v1/comments/:id', requireAuth, async (c) => { const parsed = z.object({ body: z.string().trim().min(1).max(500) }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const [comment] = await getDb(c.env).update(comments).set({ body: parsed.data.body, updatedAt: new Date() }).where(and(eq(comments.id, c.req.param('id')), eq(comments.userId, c.get('userId')), eq(comments.status, 'published'))).returning(); return comment ? c.json({ comment }) : c.json({ error: 'not_found', message: 'No puedes editar este comentario.' }, 404); });
app.delete('/api/v1/comments/:id', requireAuth, async (c) => { const db = getDb(c.env); const [comment] = await db.update(comments).set({ status: 'deleted', body: 'Comentario eliminado', updatedAt: new Date() }).where(and(eq(comments.id, c.req.param('id')), eq(comments.userId, c.get('userId')), eq(comments.status, 'published'))).returning(); if (!comment) return c.json({ error: 'not_found', message: 'No puedes eliminar este comentario.' }, 404); await db.update(posts).set({ commentCount: sql`greatest(${posts.commentCount} - 1, 0)`, updatedAt: new Date() }).where(eq(posts.id, comment.postId)); return c.json({ deleted: true }); });
app.post('/api/v1/comments/:id/like', requireAuth, async (c) => { const db = getDb(c.env); const inserted = await db.insert(commentLikes).values({ commentId: c.req.param('id'), userId: c.get('userId') }).onConflictDoNothing().returning(); if (inserted.length) await db.update(comments).set({ likeCount: sql`${comments.likeCount} + 1`, updatedAt: new Date() }).where(eq(comments.id, c.req.param('id'))); return c.json({ liked: true }); });
app.delete('/api/v1/comments/:id/like', requireAuth, async (c) => { const db = getDb(c.env); const deleted = await db.delete(commentLikes).where(and(eq(commentLikes.commentId, c.req.param('id')), eq(commentLikes.userId, c.get('userId')))).returning(); if (deleted.length) await db.update(comments).set({ likeCount: sql`greatest(${comments.likeCount} - 1, 0)`, updatedAt: new Date() }).where(eq(comments.id, c.req.param('id'))); return c.body(null, 204); });

app.post('/api/v1/verification', requireAuth, async (c) => { const parsed = z.object({ documentType: z.enum(['dpi', 'passport']), documentNumber: z.string().min(4).max(40), documentFrontKey: z.string(), documentBackKey: z.string().optional(), selfieKey: z.string() }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const userId = c.get('userId'); const keys = [parsed.data.documentFrontKey, parsed.data.selfieKey, parsed.data.documentBackKey].filter((key): key is string => !!key); if (!(await Promise.all(keys.map((key) => isOwnedDocument(c.env, key, userId)))).every(Boolean)) return c.json({ error: 'invalid_document', message: 'Debes adjuntar documentos que te pertenezcan.' }, 422); const db = getDb(c.env); const [request] = await db.insert(identityVerifications).values({ userId, documentType: parsed.data.documentType, documentNumberHash: await hashToken(parsed.data.documentNumber.trim()), documentFrontKey: parsed.data.documentFrontKey, documentBackKey: parsed.data.documentBackKey, selfieKey: parsed.data.selfieKey }).returning(); await db.update(profiles).set({ verificationStatus: 'pending', updatedAt: new Date() }).where(eq(profiles.userId, userId)); return c.json({ verification: request }, 201); });
app.get('/api/v1/verification/status', requireAuth, async (c) => { const [request] = await getDb(c.env).select({ id: identityVerifications.id, status: identityVerifications.status, reviewerNotes: identityVerifications.reviewerNotes, createdAt: identityVerifications.createdAt, reviewedAt: identityVerifications.reviewedAt }).from(identityVerifications).where(eq(identityVerifications.userId, c.get('userId'))).orderBy(desc(identityVerifications.createdAt)).limit(1); return c.json({ verification: request ?? { status: 'unverified' } }); });

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) { const r = 6371000; const p1 = lat1 * Math.PI / 180; const p2 = lat2 * Math.PI / 180; const dp = (lat2 - lat1) * Math.PI / 180; const dl = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
app.post('/api/v1/visits/validate', requireAuth, async (c) => { const parsed = z.object({ destinationId: z.string().uuid(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracyMeters: z.number().positive().max(2000).optional(), evidenceKey: z.string().optional() }).safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return c.json({ error: 'validation_error', fields: parsed.error.flatten().fieldErrors }, 422); const db = getDb(c.env); const [destination] = await db.select().from(destinations).where(eq(destinations.id, parsed.data.destinationId)).limit(1); if (!destination) return c.json({ error: 'not_found', message: 'Destino no encontrado.' }, 404); const validationRadiusMeters = 100; const distance = distanceMeters(parsed.data.latitude, parsed.data.longitude, destination.latitude, destination.longitude); if (distance > validationRadiusMeters) return c.json({ error: 'outside_radius', message: `Aún no estás lo suficientemente cerca de ${destination.name}. Debes estar a ${validationRadiusMeters} m o menos.`, distanceMeters: Math.round(distance), validationRadiusMeters }, 422); const result = await db.transaction(async (tx) => { const [visit] = await tx.insert(visits).values({ userId: c.get('userId'), destinationId: destination.id, latitude: parsed.data.latitude, longitude: parsed.data.longitude, accuracyMeters: parsed.data.accuracyMeters, distanceMeters: distance, evidenceKey: parsed.data.evidenceKey }).returning(); const [stamp] = await tx.select().from(stamps).where(and(eq(stamps.destinationId, destination.id), eq(stamps.isActive, true))).limit(1); let awarded = null; if (stamp) { const [row] = await tx.insert(userStamps).values({ userId: c.get('userId'), stampId: stamp.id, visitId: visit.id, certificateCode: `NMD-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}` }).onConflictDoNothing().returning(); awarded = row ?? null; } return { visit, awarded, stamp }; }); return c.json(result, 201); });
function meetsAchievementRequirement(requirement: Record<string, unknown> | null | undefined, progress: { verifiedVisits: number; stampCount: number; departmentCount: number }) {
  const rule = requirement ?? {};
  const threshold = (key: 'verifiedVisits' | 'stamps' | 'departments') => Number(rule[key] ?? 0);
  const visitsNeeded = threshold('verifiedVisits'); const stampsNeeded = threshold('stamps'); const departmentsNeeded = threshold('departments');
  // Un requisito vacío significa que Administración lo otorgará de manera manual;
  // nunca debe desbloquear automáticamente un catálogo entero.
  if (!visitsNeeded && !stampsNeeded && !departmentsNeeded) return false;
  return progress.verifiedVisits >= visitsNeeded && progress.stampCount >= stampsNeeded && progress.departmentCount >= departmentsNeeded;
}

app.get('/api/v1/passport', requireAuth, async (c) => {
  const db = getDb(c.env); const userId = c.get('userId');
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const [collection, visitRows, badgeDefinitions, recognitionDefinitions, earnedBadges, earnedRecognitions] = await Promise.all([
    db.select({ stamp: stamps, earnedAt: userStamps.earnedAt, certificateCode: userStamps.certificateCode }).from(userStamps).innerJoin(stamps, eq(userStamps.stampId, stamps.id)).where(eq(userStamps.userId, userId)).orderBy(desc(userStamps.earnedAt)),
    db.select({ id: visits.id, visitedAt: visits.visitedAt, destinationId: destinations.id, destinationName: destinations.name, department: destinations.department, category: destinations.category, latitude: destinations.latitude, longitude: destinations.longitude }).from(visits).innerJoin(destinations, eq(visits.destinationId, destinations.id)).where(and(eq(visits.userId, userId), eq(visits.status, 'verified'))).orderBy(desc(visits.visitedAt)),
    db.select().from(badges).where(eq(badges.isActive, true)).orderBy(asc(badges.name)),
    db.select().from(recognitions).where(eq(recognitions.isActive, true)).orderBy(asc(recognitions.title)),
    db.select({ badgeId: userBadges.badgeId, earnedAt: userBadges.earnedAt }).from(userBadges).where(eq(userBadges.userId, userId)),
    db.select({ recognitionId: userRecognitions.recognitionId, earnedAt: userRecognitions.earnedAt, notes: userRecognitions.notes }).from(userRecognitions).where(eq(userRecognitions.userId, userId)),
  ]);
  const departments = [...new Set(visitRows.map((visit) => visit.department))];
  const progress = { verifiedVisits: visitRows.length, stampCount: collection.length, departmentCount: departments.length };
  const badgeEarned = new Map(earnedBadges.map((entry) => [entry.badgeId, entry]));
  const recognitionEarned = new Map(earnedRecognitions.map((entry) => [entry.recognitionId, entry]));
  // Las reglas objetivas se otorgan una única vez. Administración también puede asignar
  // logros manuales, por ejemplo los de aliados o contribución comunitaria.
  await Promise.all(badgeDefinitions.filter((badge) => !badgeEarned.has(badge.id) && meetsAchievementRequirement(badge.requirement, progress)).map(async (badge) => {
    const [row] = await db.insert(userBadges).values({ userId, badgeId: badge.id }).onConflictDoNothing().returning(); if (row) badgeEarned.set(badge.id, { badgeId: badge.id, earnedAt: row.earnedAt });
  }));
  await Promise.all(recognitionDefinitions.filter((recognition) => !recognitionEarned.has(recognition.id) && meetsAchievementRequirement(recognition.requirement, progress)).map(async (recognition) => {
    const [row] = await db.insert(userRecognitions).values({ userId, recognitionId: recognition.id }).onConflictDoNothing().returning(); if (row) recognitionEarned.set(recognition.id, { recognitionId: recognition.id, earnedAt: row.earnedAt, notes: row.notes });
  }));
  const badgeList = badgeDefinitions.map((badge) => ({ ...badge, earned: badgeEarned.has(badge.id), earnedAt: badgeEarned.get(badge.id)?.earnedAt ?? null, progress }));
  const recognitionList = recognitionDefinitions.map((recognition) => ({ ...recognition, earned: recognitionEarned.has(recognition.id), earnedAt: recognitionEarned.get(recognition.id)?.earnedAt ?? null, notes: recognitionEarned.get(recognition.id)?.notes ?? null, progress }));
  const points = collection.length * 100 + badgeList.filter((badge) => badge.earned).reduce((total, badge) => total + badge.points, 0) + recognitionList.filter((recognition) => recognition.earned).reduce((total, recognition) => total + recognition.points, 0);
  return c.json({ owner: profile, level: Math.floor(points / 250) + 1, points, stamps: collection, stats: { ...progress, departments }, recentVisits: visitRows.slice(0, 24), badges: badgeList, recognitions: recognitionList });
});

app.notFound((c) => c.json({ error: 'not_found', message: 'Ruta no encontrada.' }, 404));
app.onError((error, c) => { console.error(error); return c.json({ error: 'internal_error', message: c.env.APP_ENV === 'development' ? error.message : 'OcurriÃ³ un error inesperado.' }, 500); });

export default app;

