import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

const audit = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull(),
  username: varchar('username', { length: 40 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 24 }).default('traveler').notNull(),
  status: varchar('status', { length: 24 }).default('active').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...audit,
}, (t) => [uniqueIndex('users_email_uq').on(t.email), uniqueIndex('users_username_uq').on(t.username)]);

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 140 }).notNull(),
  visitorType: varchar('visitor_type', { length: 16 }).notNull(),
  nationality: varchar('nationality', { length: 80 }),
  countryCode: varchar('country_code', { length: 2 }),
  city: varchar('city', { length: 100 }),
    birthDate: timestamp('birth_date', { mode: 'date' }),
    registrationDocumentType: varchar('registration_document_type', { length: 24 }),
    registrationDocumentHash: varchar('registration_document_hash', { length: 64 }),
  preferredLanguage: varchar('preferred_language', { length: 8 }).default('es').notNull(),
  bio: varchar('bio', { length: 240 }),
  avatarKey: text('avatar_key'),
  verificationStatus: varchar('verification_status', { length: 24 }).default('unverified').notNull(),
  profileVisibility: varchar('profile_visibility', { length: 16 }).default('public').notNull(),
  ...audit,
  }, (t) => [uniqueIndex('profiles_registration_document_uq').on(t.registrationDocumentHash)]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  deviceName: varchar('device_name', { length: 120 }),
  ipHash: varchar('ip_hash', { length: 64 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('sessions_user_idx').on(t.userId), uniqueIndex('sessions_refresh_uq').on(t.refreshTokenHash)]);

export const authTokens = pgTable('auth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 24 }).notNull(), tokenHash: text('token_hash').notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), usedAt: timestamp('used_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('auth_tokens_hash_uq').on(t.tokenHash), index('auth_tokens_user_idx').on(t.userId)]);

export const identityVerifications = pgTable('identity_verifications', {
  id: uuid('id').primaryKey().defaultRandom(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), documentType: varchar('document_type', { length: 24 }).notNull(), documentNumberHash: varchar('document_number_hash', { length: 64 }).notNull(), documentFrontKey: text('document_front_key').notNull(), documentBackKey: text('document_back_key'), selfieKey: text('selfie_key').notNull(), status: varchar('status', { length: 24 }).default('pending').notNull(), reviewerNotes: text('reviewer_notes'), reviewedAt: timestamp('reviewed_at', { withTimezone: true }), ...audit,
}, (t) => [index('identity_user_idx').on(t.userId), index('identity_status_idx').on(t.status)]);

export const destinations = pgTable('destinations', {
  id: uuid('id').primaryKey().defaultRandom(), slug: varchar('slug', { length: 120 }).notNull(), name: varchar('name', { length: 160 }).notNull(), department: varchar('department', { length: 100 }).notNull(), category: varchar('category', { length: 60 }).notNull(), description: text('description').notNull(), latitude: doublePrecision('latitude').notNull(), longitude: doublePrecision('longitude').notNull(), validationRadiusMeters: integer('validation_radius_meters').default(100).notNull(), coverKey: text('cover_key'), activities: jsonb('activities').$type<string[]>().default([]).notNull(), averageCostMin: integer('average_cost_min'), averageCostMax: integer('average_cost_max'), costCurrency: varchar('cost_currency', { length: 3 }).default('GTQ').notNull(), contentStatus: varchar('content_status', { length: 24 }).default('published').notNull(), humanVerifiedAt: timestamp('human_verified_at', { withTimezone: true }), humanVerifiedBy: uuid('human_verified_by').references(() => users.id, { onDelete: 'set null' }), verificationNotes: text('verification_notes'), sourceUrl: text('source_url'), points: integer('points').default(100).notNull(), isActive: boolean('is_active').default(true).notNull(), metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}), ...audit,
}, (t) => [uniqueIndex('destinations_slug_uq').on(t.slug), index('destinations_department_idx').on(t.department)]);

export const destinationPhotos = pgTable('destination_photos', {
  id: uuid('id').primaryKey().defaultRandom(), destinationId: uuid('destination_id').notNull().references(() => destinations.id, { onDelete: 'cascade' }), objectKey: text('object_key').notNull(), caption: varchar('caption', { length: 240 }), source: varchar('source', { length: 24 }).default('nomada_library').notNull(), credit: varchar('credit', { length: 140 }), position: integer('position').default(0).notNull(), isPrimary: boolean('is_primary').default(false).notNull(), ...audit,
}, (t) => [index('destination_photos_destination_idx').on(t.destinationId), uniqueIndex('destination_photos_position_uq').on(t.destinationId, t.position)]);

export const routes = pgTable('routes', {
  id: uuid('id').primaryKey().defaultRandom(), slug: varchar('slug', { length: 120 }).notNull(), name: varchar('name', { length: 160 }).notNull(), description: text('description'), difficulty: varchar('difficulty', { length: 24 }).default('easy').notNull(), estimatedMinutes: integer('estimated_minutes'), distanceKm: doublePrecision('distance_km'), badgeId: uuid('badge_id'), coverKey: text('cover_key'), isActive: boolean('is_active').default(true).notNull(), ...audit,
}, (t) => [uniqueIndex('routes_slug_uq').on(t.slug)]);

export const routeStops = pgTable('route_stops', {
  routeId: uuid('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }), destinationId: uuid('destination_id').notNull().references(() => destinations.id, { onDelete: 'cascade' }), position: integer('position').notNull(),
}, (t) => [primaryKey({ columns: [t.routeId, t.destinationId] }), uniqueIndex('route_stop_position_uq').on(t.routeId, t.position)]);

export const stamps = pgTable('stamps', {
  id: uuid('id').primaryKey().defaultRandom(), destinationId: uuid('destination_id').references(() => destinations.id, { onDelete: 'set null' }), code: varchar('code', { length: 40 }).notNull(), name: varchar('name', { length: 120 }).notNull(), description: text('description'), artworkKey: text('artwork_key'), color: varchar('color', { length: 12 }), isActive: boolean('is_active').default(true).notNull(), ...audit,
}, (t) => [uniqueIndex('stamps_code_uq').on(t.code), uniqueIndex('stamps_destination_uq').on(t.destinationId)]);

export const visits = pgTable('visits', {
  id: uuid('id').primaryKey().defaultRandom(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), destinationId: uuid('destination_id').notNull().references(() => destinations.id, { onDelete: 'cascade' }), latitude: doublePrecision('latitude').notNull(), longitude: doublePrecision('longitude').notNull(), accuracyMeters: doublePrecision('accuracy_meters'), distanceMeters: doublePrecision('distance_meters'), evidenceKey: text('evidence_key'), verificationMethod: varchar('verification_method', { length: 24 }).default('gps_photo').notNull(), status: varchar('status', { length: 24 }).default('verified').notNull(), visitedAt: timestamp('visited_at', { withTimezone: true }).defaultNow().notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('visits_user_idx').on(t.userId), index('visits_destination_idx').on(t.destinationId)]);

export const userStamps = pgTable('user_stamps', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), stampId: uuid('stamp_id').notNull().references(() => stamps.id, { onDelete: 'cascade' }), visitId: uuid('visit_id').references(() => visits.id, { onDelete: 'set null' }), earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull(), certificateCode: varchar('certificate_code', { length: 64 }).notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.stampId] }), uniqueIndex('user_stamps_certificate_uq').on(t.certificateCode)]);

export const badges = pgTable('badges', { id: uuid('id').primaryKey().defaultRandom(), code: varchar('code', { length: 40 }).notNull(), name: varchar('name', { length: 120 }).notNull(), description: text('description'), artworkKey: text('artwork_key'), category: varchar('category', { length: 60 }).default('exploración').notNull(), points: integer('points').default(50).notNull(), isActive: boolean('is_active').default(true).notNull(), requirement: jsonb('requirement').$type<Record<string, unknown>>().default({}), ...audit }, (t) => [uniqueIndex('badges_code_uq').on(t.code)]);
export const userBadges = pgTable('user_badges', { userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), badgeId: uuid('badge_id').notNull().references(() => badges.id, { onDelete: 'cascade' }), earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull() }, (t) => [primaryKey({ columns: [t.userId, t.badgeId] })]);
export const recognitions = pgTable('recognitions', { id: uuid('id').primaryKey().defaultRandom(), code: varchar('code', { length: 40 }).notNull(), title: varchar('title', { length: 140 }).notNull(), description: text('description'), artworkKey: text('artwork_key'), category: varchar('category', { length: 60 }).default('comunidad').notNull(), partnerName: varchar('partner_name', { length: 140 }), benefitText: varchar('benefit_text', { length: 240 }), points: integer('points').default(100).notNull(), isActive: boolean('is_active').default(true).notNull(), requirement: jsonb('requirement').$type<Record<string, unknown>>().default({}), ...audit }, (t) => [uniqueIndex('recognitions_code_uq').on(t.code)]);
export const userRecognitions = pgTable('user_recognitions', { userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), recognitionId: uuid('recognition_id').notNull().references(() => recognitions.id, { onDelete: 'cascade' }), earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull(), notes: text('notes') }, (t) => [primaryKey({ columns: [t.userId, t.recognitionId] })]);

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), destinationId: uuid('destination_id').references(() => destinations.id, { onDelete: 'set null' }), locationLabel: varchar('location_label', { length: 160 }), latitude: doublePrecision('latitude'), longitude: doublePrecision('longitude'), caption: varchar('caption', { length: 800 }).notNull(), visibility: varchar('visibility', { length: 16 }).default('public').notNull(), status: varchar('status', { length: 16 }).default('published').notNull(), likeCount: integer('like_count').default(0).notNull(), commentCount: integer('comment_count').default(0).notNull(), ...audit,
}, (t) => [index('posts_feed_idx').on(t.status, t.createdAt), index('posts_user_idx').on(t.userId)]);
export const postMedia = pgTable('post_media', { id: uuid('id').primaryKey().defaultRandom(), postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }), objectKey: text('object_key').notNull(), mediaType: varchar('media_type', { length: 16 }).default('image').notNull(), position: integer('position').default(0).notNull(), width: integer('width'), height: integer('height'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() }, (t) => [index('post_media_post_idx').on(t.postId)]);
export const postLikes = pgTable('post_likes', { postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() }, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);
export const comments = pgTable('comments', { id: uuid('id').primaryKey().defaultRandom(), postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), parentId: uuid('parent_id').references((): any => comments.id, { onDelete: 'cascade' }), body: varchar('body', { length: 500 }).notNull(), status: varchar('status', { length: 16 }).default('published').notNull(), likeCount: integer('like_count').default(0).notNull(), ...audit }, (t) => [index('comments_post_idx').on(t.postId), index('comments_parent_idx').on(t.parentId)]);
export const commentLikes = pgTable('comment_likes', { commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() }, (t) => [primaryKey({ columns: [t.commentId, t.userId] })]);
export const savedPosts = pgTable('saved_posts', { postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() }, (t) => [primaryKey({ columns: [t.postId, t.userId] }), index('saved_posts_user_idx').on(t.userId)]);
export const follows = pgTable('follows', { followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }), followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }), status: varchar('status', { length: 16 }).default('accepted').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull() }, (t) => [primaryKey({ columns: [t.followerId, t.followingId] })]);

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  action: varchar('action', { length: 80 }).notNull(),
  resourceType: varchar('resource_type', { length: 80 }).notNull(),
  resourceId: varchar('resource_id', { length: 160 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('admin_audit_logs_actor_idx').on(t.actorUserId, t.createdAt), index('admin_audit_logs_resource_idx').on(t.resourceType, t.resourceId, t.createdAt)]);
