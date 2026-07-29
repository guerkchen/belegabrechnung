// Centralized JWT secret management with Cosmos-backed persistence and in-memory cache
import crypto from 'node:crypto';
import { getAppSetting, upsertAppSetting } from '../services/cosmos.js';

let cachedSecretString = null;

export async function getJwtSecretString() {
  if (cachedSecretString) return cachedSecretString;

  // Try load from Cosmos app_settings
  const existing = await getAppSetting('app_jwt_secret');
  if (existing && existing.value) {
    // Be defensive: normalize to a plain UTF-8 string in case older data stored an Array/Buffer-like
    const v = existing.value;
    let normalized;
    if (typeof v === 'string') {
      normalized = v;
    } else if (Array.isArray(v)) {
      // If it's a single string element, use it; if it's an array of numbers (byte array), decode as UTF-8
      if (v.length === 1 && typeof v[0] === 'string') {
        normalized = v[0];
      } else if (v.every?.(n => typeof n === 'number')) {
        try {
          normalized = Buffer.from(Uint8Array.from(v)).toString('utf8');
        } catch {
          normalized = String(v);
        }
      } else {
        normalized = String(v);
      }
    } else if (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) {
      // Handle Node Buffer JSON representation: { type: 'Buffer', data: [...] }
      try {
        normalized = Buffer.from(v.data).toString('utf8');
      } catch {
        normalized = String(v);
      }
    } else {
      normalized = String(v);
    }
    // If the stored value was not a string, write back the normalized string for future reads
    if (typeof v !== 'string') {
      try { await upsertAppSetting({ id: 'app_jwt_secret', value: normalized }); } catch {}
    }
    cachedSecretString = normalized;
    return cachedSecretString;
  }

  // Generate strong random secret on first start
  const seed = crypto.randomBytes(64).toString('base64url');

  await upsertAppSetting({ id: 'app_jwt_secret', value: seed });
  cachedSecretString = seed;
  return cachedSecretString;
}

export async function getJwtSecretKeyBytes() {
  const strVal = await getJwtSecretString();
  const str = typeof strVal === 'string' ? strVal : String(strVal);
  // Prefer Web TextEncoder if available, else fall back to Node Buffer
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  return Uint8Array.from(Buffer.from(str, 'utf8'));
}
