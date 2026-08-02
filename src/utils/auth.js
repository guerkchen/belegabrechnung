import { upsertUser } from '../services/cosmos.js';
import { SignJWT, jwtVerify } from 'jose';
import { request } from 'undici';
import { config } from './config.js';
import { getJwtSecretKeyBytes } from './jwtKey.js';

const tenantId = config.MICROSOFT_TENANT_ID;
const clientId = config.MICROSOFT_CLIENT_ID;
const clientSecret = config.MICROSOFT_CLIENT_SECRET;
const redirectUri = config.MICROSOFT_REDIRECT_URI;
const groupRoleMapEnv = config.MICROSOFT_GROUP_ROLE_MAP;

// Secret key is resolved lazily via getJwtSecretKeyBytes()

function parseGroupRoleMap() {
  const map = new Map();
  for (const pair of groupRoleMapEnv.split(',')) {
    const [g, r] = pair.split('=').map(s => s && s.trim());
    if (g && r) map.set(g, r);
  }
  return map;
}

function getAuthBaseUrl() {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
}

export async function issueStateToken() {
  const exp = Math.floor(Date.now() / 1000) + 300; // 5 minutes
  const encKey = await getJwtSecretKeyBytes();
  return await new SignJWT({ nonce: Math.random().toString(36).slice(2) })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(exp)
    .sign(encKey);
}

export async function verifyStateToken(token) {
  try {
    const encKey = await getJwtSecretKeyBytes();
    await jwtVerify(token, encKey);
    return true;
  } catch {
    return false;
  }
}

export async function buildMicrosoftAuthorizationUrl() {
  const state = await issueStateToken();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid profile email offline_access User.Read GroupMember.Read.All',
    state,
  });
  return `${getAuthBaseUrl()}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  // Be defensive: ensure all params are strings and send a plain string body.
  const params = new URLSearchParams({
    client_id: String(clientId),
    client_secret: String(clientSecret),
    grant_type: 'authorization_code',
    code: String(code),
    redirect_uri: String(redirectUri),
  });
  const { body: resBody, statusCode } = await request(`${getAuthBaseUrl()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // undici.request expects a string/Buffer/TypedArray/etc as body (unlike fetch).
    // Explicitly pass the serialized form body to avoid type issues.
    body: params.toString(),
  });
  const json = await resBody.json();
  if (statusCode >= 400) {
    throw new Error(json.error_description || 'Token exchange failed');
  }
  return json; // contains access_token, id_token, refresh_token, ...
}

export async function getMicrosoftUserInfo(accessToken) {
  const { body, statusCode } = await request('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await body.json();
  if (statusCode >= 400) throw new Error('Failed to fetch profile');
  return json; // { id, userPrincipalName, mail, displayName }
}

export async function getMicrosoftGroups(accessToken) {
  // Use group mail addresses (not display names) for role mapping.
  // Cast to groups so Graph only returns group objects and supports selecting 'mail'.
  const { body, statusCode } = await request('https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.group?$select=mail', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await body.json();
  if (statusCode >= 400) throw new Error('Failed to fetch groups');
  // Only groups have a mail attribute; others (e.g., directory roles) will be falsy and filtered out
  const mails = (json.value || []).map(g => g.mail).filter(Boolean);
  return mails;
}

export function mapRoleFromGroups(groupNames) {
  const map = parseGroupRoleMap();
  const found = new Set();
  for (const name of groupNames) {
    const role = map.get(name);
    if (role) found.add(role);
  }
  // Prefer highest-privilege role if multiple groups match
  if (found.has('admin')) return 'admin';
  if (found.has('kassenwart')) return 'kassenwart';
  if (found.has('freigeber')) return 'freigeber';
  return 'user';
}

export async function persistOrUpdateMicrosoftUser(profile, groups) {
  const email = profile.mail || profile.userPrincipalName || '';
  const azure_user_id = profile.id;
  const display_name = profile.displayName || email || azure_user_id;
  const role = mapRoleFromGroups(groups);
  return upsertUser({ azure_user_id, email, display_name, role });
}
