import { createHash } from 'node:crypto';

export function buildCacheKey(namespace: string, keyMaterial: unknown): string {
  const serialized = JSON.stringify(keyMaterial) ?? String(keyMaterial);

  const digest = createHash('sha256').update(serialized).digest('hex');

  return `meridian:v2:${namespace}:${digest}`;
}
