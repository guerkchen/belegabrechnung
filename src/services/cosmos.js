import { CosmosClient } from '@azure/cosmos';
import { config } from '../utils/config.js';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);

const client = new CosmosClient({ endpoint: config.COSMOS_ENDPOINT, key: config.COSMOS_KEY });
const db = client.database(config.COSMOS_DB_NAME);

const containers = {
  users: db.container('users'),
  receipts: db.container('receipts'),
  receipt_status_history: db.container('receipt_status_history'),
  app_settings: db.container('app_settings'),
};

export function getContainers() {
  return containers;
}

// Users
export async function getUserByAzureId(azureUserId) {
  const { resources } = await containers.users.items
    .query({
      query: 'SELECT * FROM c WHERE c.azure_user_id = @azure_user_id AND c.is_active = true',
      parameters: [{ name: '@azure_user_id', value: azureUserId }],
    }, { enableCrossPartitionQuery: true })
    .fetchAll();
  return resources[0] || null;
}

export async function upsertUser({ azure_user_id, email, display_name, role }) {
  const existing = await getUserByAzureId(azure_user_id);
  const now = new Date().toISOString();
  if (existing) {
    const updated = { ...existing, email, display_name, role, updated_at: now };
    await containers.users.items.upsert(updated);
    return updated;
  }
  const user = {
    id: 'user_' + nanoid(),
    azure_user_id,
    email,
    display_name,
    role: role || 'user',
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  await containers.users.items.create(user);
  return user;
}

// Receipts
export async function createReceipt(doc) {
  const now = new Date().toISOString();
  const receipt = {
    id: 'rcpt_' + nanoid(),
    ...doc,
    created_at: now,
    updated_at: now,
  };
  await containers.receipts.items.create(receipt, { partitionKey: receipt.user_id });
  return receipt;
}

export async function getReceiptById(id) {
  // Unknown partition key -> cross-partition query
  const { resources } = await containers.receipts.items
    .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] }, { enableCrossPartitionQuery: true })
    .fetchAll();
  return resources[0] || null;
}

export async function updateReceipt(id, patch) {
  const existing = await getReceiptById(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
  await containers.receipts.items.upsert(updated, { partitionKey: updated.user_id });
  return updated;
}

export async function deleteReceipt(id) {
  const existing = await getReceiptById(id);
  if (!existing) return false;
  await containers.receipts.item(existing.id, existing.user_id).delete();
  return true;
}

export async function queryReceipts({ user, from, to, status }) {
  const conditions = [];
  const parameters = [];

  let query = 'SELECT * FROM c';
  if (user.role === 'user') { // users must only see their own receipts
    conditions.push('c.user_id = @uid');
    parameters.push({ name: '@uid', value: user.id });
  }
  if (from) {
    conditions.push('c.receipt_date >= @from');
    parameters.push({ name: '@from', value: from });
  }
  if (to) {
    conditions.push('c.receipt_date <= @to');
    parameters.push({ name: '@to', value: to });
  }
  if (status) {
    conditions.push('c.status = @status');
    parameters.push({ name: '@status', value: status });
  }
  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY c.created_at DESC';

  const { resources } = await containers.receipts.items
    .query({ query, parameters }, { enableCrossPartitionQuery: true })
    .fetchAll();
  return resources;
}

// Explicitly fetch receipts for a specific user regardless of caller role
export async function getReceiptsForUser(userId) {
  const { resources } = await containers.receipts.items
    .query({
      query: 'SELECT * FROM c WHERE c.user_id = @uid ORDER BY c.created_at DESC',
      parameters: [{ name: '@uid', value: userId }]
    }, { enableCrossPartitionQuery: true })
    .fetchAll();
  return resources;
}

// Get the latest receipt for a specific user (by created_at DESC)
export async function getLatestReceiptForUser(userId) {
  const { resources } = await containers.receipts.items
    .query({
      query: 'SELECT TOP 1 * FROM c WHERE c.user_id = @uid ORDER BY c.created_at DESC',
      parameters: [{ name: '@uid', value: userId }]
    }, { enableCrossPartitionQuery: true })
    .fetchAll();
  return resources && resources.length ? resources[0] : null;
}

export async function getReceiptsByStatus(status) {
  const { resources } = await containers.receipts.items
    .query({ query: 'SELECT * FROM c WHERE c.status = @status ORDER BY c.created_at DESC', parameters: [{ name: '@status', value: status }] }, { enableCrossPartitionQuery: true })
    .fetchAll();
  return resources;
}

export async function getReceiptHistory(receipt_id) {
  const { resources } = await containers.receipt_status_history.items
    .query({ query: 'SELECT * FROM c WHERE c.receipt_id = @id ORDER BY c.changed_at ASC', parameters: [{ name: '@id', value: receipt_id }] }, { enableCrossPartitionQuery: true })
    .fetchAll();
  return resources;
}

export async function appendHistory({ receipt_id, old_status, new_status, changed_by_user_id, comment }) {
  const doc = {
    id: 'hist_' + nanoid(),
    receipt_id,
    old_status: old_status ?? null,
    new_status,
    changed_by_user_id,
    changed_at: new Date().toISOString(),
    comment: comment ?? null,
  };
  await containers.receipt_status_history.items.create(doc, { partitionKey: doc.receipt_id });
  return doc;
}

// App settings (for storing application-level configuration like JWT secret)
export async function getAppSetting(id) {
  try {
    const { resource } = await containers.app_settings.item(id, id).read();
    return resource || null;
  } catch (e) {
    // If not found, Cosmos SDK throws with code 404
    if (e.code === 404) return null;
    throw e;
  }
}

export async function upsertAppSetting(doc) {
  const now = new Date().toISOString();
  const existing = await getAppSetting(doc.id);
  const payload = existing
    ? { ...existing, ...doc, updated_at: now }
    : { ...doc, created_at: now, updated_at: now };
  await containers.app_settings.items.upsert(payload, { partitionKey: payload.id });
  return payload;
}
