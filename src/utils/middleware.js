import { jsonResponse } from './common.js';
import { verifyAppToken, requireRole } from './common.js';
import { getUserByAzureId } from '../services/cosmos.js';

// Centralized auth + role enforcement for HTTP handlers
// Usage:
//   handler: withAuth(['role1','role2'], (request, user, context) => { ... })
//   or without specific roles: withAuth((request, user, context) => { ... })

export async function getAuthedUser(request) {
  const claims = await verifyAppToken(request.headers.get('authorization') || '');
  if (!claims) return null;
  // Enforce active user state from DB; if user was deactivated or not found, deny.
  const dbUser = await getUserByAzureId(claims.azure_user_id);
  return dbUser || null;
}

export function withAuth(rolesOrHandler, maybeHandler) {
  const roles = typeof rolesOrHandler === 'function' ? null : (rolesOrHandler || null);
  const inner = typeof rolesOrHandler === 'function' ? rolesOrHandler : maybeHandler;

  if (typeof inner !== 'function') {
    throw new Error('withAuth requires a handler function');
  }

  return async (request, context) => {
    const user = await getAuthedUser(request);
    if (!user) return jsonResponse({ error: 'Authentication required' }, 401);

    if (roles && roles.length) {
      try {
        requireRole(user, roles);
      } catch (e) {
        return jsonResponse({ error: e.message || 'Forbidden' }, e.status || 403);
      }
    }

    return inner(request, user, context);
  };
}
