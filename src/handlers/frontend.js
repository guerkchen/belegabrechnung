import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Serve the SPA index.html for any /frontend/* request
export async function serveFrontend() {
  try {
    const indexPath = join(__dirname, '..', 'public', 'index.html');
    const html = await fs.readFile(indexPath, 'utf-8');
    return {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: html,
    };
  } catch (e) {
    const message = process.env.NODE_ENV === 'development' ? e.message : 'Not found';
    return {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: message,
    };
  }
}
