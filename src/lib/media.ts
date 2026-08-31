import type { Env } from '../types';

export type MediaKind = 'profile' | 'post' | 'visit' | 'identity';

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedPostVideoTypes = new Set(['video/mp4', 'video/quicktime']);
const extensionFor: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

export function buildMediaTarget(kind: MediaKind, userId: string, contentType: string, slot?: string) {
  const isVideo = allowedPostVideoTypes.has(contentType);
  if ((!allowedImageTypes.has(contentType) && !isVideo) || (isVideo && kind !== 'post')) throw new Error('unsupported_media');
  const extension = extensionFor[contentType];
  const id = crypto.randomUUID();
  if (kind === 'profile') return { bucket: 'photos' as const, key: `perfil/${userId}/${id}.${extension}`, visibility: 'public' as const };
  if (kind === 'post') return { bucket: 'photos' as const, key: `publicaciones/${userId}/${id}.${extension}`, visibility: 'public' as const };
  if (kind === 'visit') return { bucket: 'photos' as const, key: `visitas/${userId}/${id}.${extension}`, visibility: 'private' as const };
  const safeSlot = slot && /^(dpi-front|dpi-back|passport-front|passport-back|selfie)$/.test(slot) ? slot : 'documento';
  return { bucket: 'documents' as const, key: `certificaciones/${userId}/${safeSlot}-${id}.${extension}`, visibility: 'private' as const };
}

export function bucketFor(env: Env, bucket: 'photos' | 'documents') {
  return bucket === 'photos' ? env.FOTOS : env.DOCUMENTOS;
}

export async function ownedPrivateObject(bucket: R2Bucket, key: string, userId: string) {
  const object = await bucket.get(key);
  if (!object || object.customMetadata?.ownerId !== userId) return null;
  return object;
}

export async function isOwnedDocument(env: Env, key: string, userId: string) {
  if (!key.startsWith(`certificaciones/${userId}/`)) return false;
  const object = await env.DOCUMENTOS.head(key);
  return object?.customMetadata?.ownerId === userId;
}
