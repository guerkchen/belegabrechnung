import { SignJWT, jwtVerify } from 'jose';
import { getJwtSecretKeyBytes } from './jwtKey.js';

// Domain constants to avoid stringly-typed logic across the codebase
export const ROLES = {
  USER: 'user',
  FREIGEBER: 'freigeber',
  KASSENWART: 'kassenwart',
  ADMIN: 'admin',
};

export const STATUSES = {
  PENDING: 'zur_Freigabe',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  PAID: 'Ausgezahlt',
};

export function jsonResponse(body, status = 200, headers = {}) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      ...headers,
    },
    jsonBody: body,
  };
}

export async function parseJson(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export function normalizeStatus(status) {
  const allowed = Object.values(STATUSES);
  if (!allowed.includes(status)) {
    throw new Error('Invalid status');
  }
  return status;
}

export function canAccessReceipt(user, receipt) {
  if (user.role === ROLES.FREIGEBER || user.role === ROLES.KASSENWART || user.role === ROLES.ADMIN) return true;
  return String(receipt.user_id) === String(user.id);
}

export function requireRole(user, roles) {
  if (!roles.includes(user.role)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

export async function issueAppToken(payload, { expiresIn = '2h' } = {}) {
  // payload: { id, role, email, display_name, azure_user_id }
  // jose supports string durations like '2h' or numeric seconds for exp
  const encKey = await getJwtSecretKeyBytes();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encKey);
}

export async function verifyAppToken(authorizationHeader) {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    const encKey = await getJwtSecretKeyBytes();
    const { payload } = await jwtVerify(token, encKey);
    return payload;
  } catch {
    return null;
  }
}

// Basic HTML escape to mitigate XSS when storing/rendering user-provided text
// Escapes &, <, >, ", ' and / characters.
export function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}
