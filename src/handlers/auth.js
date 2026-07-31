import { jsonResponse } from '../utils/common.js';
import {
  buildMicrosoftAuthorizationUrl,
  exchangeCodeForToken,
  getMicrosoftUserInfo,
  getMicrosoftGroups,
  persistOrUpdateMicrosoftUser,
  verifyStateToken,
} from '../utils/auth.js';
import { verifyAppToken, issueAppToken } from '../utils/common.js';
import { getUserByAzureId } from '../services/cosmos.js';

export async function authMe(request) {
  const user = await verifyAppToken(request.headers.get('authorization') || '');
  if (!user) return jsonResponse({ error: 'Authentication required' }, 401);
  // Refresh latest from DB if possible
  const dbUser = await getUserByAzureId(user.azure_user_id);
  const payload = dbUser || user;
  return jsonResponse({ user: {
    id: payload.id,
    azure_user_id: payload.azure_user_id,
    email: payload.email,
    display_name: payload.display_name,
    role: payload.role,
  } });
}

export async function authLogin() {
  try {
    const url = await buildMicrosoftAuthorizationUrl();
    // For browser-based clients, redirect directly to Microsoft login
    return { status: 302, headers: { Location: url } };
  } catch (e) {
    return jsonResponse({ error: 'Login initialization failed: ' + e.message }, 500);
  }
}

export async function authCallback(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) {
      return jsonResponse({ error: 'Invalid Microsoft callback' }, 400);
    }

    // Validate anti-forgery state token
    const ok = await verifyStateToken(state);
    if (!ok) {
      return jsonResponse({ error: 'Invalid or expired state' }, 400);
    }

    const token = await exchangeCodeForToken(code);
    const profile = await getMicrosoftUserInfo(token.access_token);
    const groups = await getMicrosoftGroups(token.access_token);
    const authenticatedUser = await persistOrUpdateMicrosoftUser(profile, groups);

    const appToken = await issueAppToken({
      id: authenticatedUser.id,
      azure_user_id: authenticatedUser.azure_user_id,
      email: authenticatedUser.email,
      display_name: authenticatedUser.display_name,
      role: authenticatedUser.role,
    });

    // Redirect to frontend hosted by Functions and pass token in fragment (avoid server logs)
    const redirect = '/index.html#auth=success&token=' + encodeURIComponent(appToken);
    return { status: 302, headers: { Location: redirect } };
  } catch (e) {
    return jsonResponse({ error: 'Authentication failed: ' + e.message }, 500);
  }
}

export async function authLogout() {
  // Stateless JWT: client can delete token. Return success message.
  return jsonResponse({ message: 'Logged out' });
}
