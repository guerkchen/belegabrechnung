// Centralized environment configuration and validation

function requireEnv(name) {
  const val = process.env[name];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return val;
}

export const config = {
  COSMOS_ENDPOINT: requireEnv('COSMOS_ENDPOINT'),
  COSMOS_KEY: requireEnv('COSMOS_KEY'),
  COSMOS_DB_NAME: requireEnv('COSMOS_DB_NAME'),

  MICROSOFT_TENANT_ID: requireEnv('MICROSOFT_TENANT_ID'),
  MICROSOFT_CLIENT_ID: requireEnv('MICROSOFT_CLIENT_ID'),
  MICROSOFT_CLIENT_SECRET: requireEnv('MICROSOFT_CLIENT_SECRET'),
  MICROSOFT_REDIRECT_URI: requireEnv('MICROSOFT_REDIRECT_URI'),
  MICROSOFT_GROUP_ROLE_MAP: requireEnv('MICROSOFT_GROUP_ROLE_MAP'),

  AZURE_STORAGE_CONNECTION_STRING: requireEnv('AZURE_STORAGE_CONNECTION_STRING'),

  // Optional convenience
  NODE_ENV: process.env.NODE_ENV || 'production',
};
