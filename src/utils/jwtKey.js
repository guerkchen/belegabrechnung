// Centralized JWT secret management with Cosmos-backed persistence and in-memory cache
import crypto from 'node:crypto';
import { getAppSetting, upsertAppSetting } from '../services/cosmos.js';

let cachedSecretString = null;

export async function getJwtSecretString() {
  if (cachedSecretString) return cachedSecretString;

  // Try load from Cosmos app_settings
  const existing = await getAppSetting('app_jwt_secret');
  if (existing && existing.value) {
    cachedSecretString = existing.value;
    return cachedSecretString;
  }

  // Generate strong random secret on first start
  const seed = crypto.randomBytes(64).toString('base64url');

  await upsertAppSetting({ id: 'app_jwt_secret', value: seed });
  cachedSecretString = seed;
  return cachedSecretString;
}

export async function getJwtSecretKeyBytes() {
  const str = await getJwtSecretString();
  return new TextEncoder().encode(str);
}
