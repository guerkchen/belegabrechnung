import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const dbName = process.env.COSMOS_DB_NAME;

async function main() {
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
