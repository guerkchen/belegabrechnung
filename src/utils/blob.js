import { BlobServiceClient } from '@azure/storage-blob';
import { customAlphabet } from 'nanoid';
import { config } from './config.js';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 32);

const blobServiceClient = BlobServiceClient.fromConnectionString(config.AZURE_STORAGE_CONNECTION_STRING);

export async function uploadBase64ToBlob({ container = 'receipts', base64, mimeType, name, maxBytes = 10 * 1024 * 1024 }) {
  const containerClient = blobServiceClient.getContainerClient(container);
  await containerClient.createIfNotExists();

  // Infer extension from provided file name or mime type
  let ext = name && name.includes('.') ? name.split('.').pop() : '';
  if (!ext) {
    if ((mimeType || '').includes('pdf')) ext = 'pdf';
    else ext = 'bin';
  }
  const blobName = `receipt_${nanoid()}.${ext}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > maxBytes) {
    return { stored: false, reason: 'file-too-large', maxBytes };
  }
  const headers = { blobHTTPHeaders: { blobContentType: mimeType || 'application/octet-stream' } };
  await blockBlobClient.uploadData(buffer, headers);
  return { stored: true, blobName, url: blockBlobClient.url, mimeType };
}
