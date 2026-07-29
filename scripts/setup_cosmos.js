import { CosmosClient } from '@azure/cosmos';
import fs from 'fs';
import { webcrypto as nodeWebCrypto, randomUUID as nodeRandomUUID } from 'node:crypto';

// Ensure globalThis.crypto.randomUUID is available (Node < 19 workaround)
if (!globalThis.crypto) {
  globalThis.crypto = nodeWebCrypto;
}
if (!globalThis.crypto?.randomUUID) {
  // Fallback to Node's randomUUID if webcrypto.randomUUID isn't present
  globalThis.crypto = globalThis.crypto || {};
  globalThis.crypto.randomUUID = nodeRandomUUID;
}

// Load required env vars from local.settings.json (Azure Functions style)
// if they are not already present in process.env. This makes `npm run setup:cosmos`
// work without having to manually export env vars first.
function hydrateEnvFromLocalSettings() {
  try {
    if (!fs.existsSync('local.settings.json')) return;
    const text = fs.readFileSync('local.settings.json', 'utf8');
    const json = JSON.parse(text);
    const values = json?.Values || {};
    for (const k of ['COSMOS_ENDPOINT', 'COSMOS_KEY', 'COSMOS_DB_NAME']) {
      if (!process.env[k] && values[k]) {
        process.env[k] = values[k];
      }
    }
  } catch (e) {
    // Non-fatal: just log a hint and continue so we still error clearly below if vars are missing
    console.warn('Warning: could not read local.settings.json:', e.message);
  }
}

async function main() {
  // Ensure env is hydrated from local.settings.json if available
  hydrateEnvFromLocalSettings();

  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const dbName = process.env.COSMOS_DB_NAME;

  if (!endpoint || !key || !dbName) {
    console.error('Missing COSMOS_ENDPOINT or COSMOS_KEY or COSMOS_DB_NAME');
    process.exit(1);
  }
  const client = new CosmosClient({ endpoint, key });

  console.log('Ensuring database:', dbName);
  const { database } = await client.databases.createIfNotExists({ id: dbName });

  // users: partition key /id (each user item is its own partition)
  console.log('Ensuring container: users');
  await database.containers.createIfNotExists({ id: 'users', partitionKey: { paths: ['/id'] } });

  // receipts: partition key /user_id
  console.log('Ensuring container: receipts');
  await database.containers.createIfNotExists({ id: 'receipts', partitionKey: { paths: ['/user_id'] } });

  // receipt_status_history: partition key /receipt_id
  console.log('Ensuring container: receipt_status_history');
  await database.containers.createIfNotExists({ id: 'receipt_status_history', partitionKey: { paths: ['/receipt_id'] } });

  // app_settings: partition key /id
  console.log('Ensuring container: app_settings');
  await database.containers.createIfNotExists({ id: 'app_settings', partitionKey: { paths: ['/id'] } });

  console.log('Cosmos setup completed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
