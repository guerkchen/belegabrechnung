import { jsonResponse, parseJson, normalizeStatus, canAccessReceipt, escapeHtml, STATUSES } from '../utils/common.js';
import {
  createReceipt,
  queryReceipts,
  getReceiptsByStatus,
  getReceiptById,
  updateReceipt as updateReceiptDoc,
  deleteReceipt as deleteReceiptDoc,
  appendHistory,
  getReceiptHistory,
} from '../services/cosmos.js';
import { uploadBase64ToBlob } from '../utils/blob.js';
// Auth is handled centrally via middleware. All handlers below assume
// a valid `user` object was provided and only implement business logic
// (resource checks like ownership are still enforced here).

function validateAmountString(amount) {
  if (typeof amount !== 'string' && typeof amount !== 'number') return false;
  const str = String(amount);
  return /^\d{1,7}(\.\d{1,2})?$/.test(str);
}

function validateDateString(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function createReceiptHandler(request, user) {
  let body;
  try {
    body = await parseJson(request);
  } catch (e) {
    return jsonResponse({ error: e.message || 'Invalid JSON body' }, 400);
  }
  const description = escapeHtml(String(body.description || '').trim());
  const amount = String(body.amount || '').trim();
  const receipt_date = String(body.receipt_date || '').trim();
  const file = body.file || null; // { name, mimeType, base64 }

  if (!description || !amount || !receipt_date || !file) {
    return jsonResponse({ error: 'description, amount, receipt_date and file are required' }, 400);
  }
  if (!validateAmountString(amount)) {
    return jsonResponse({ error: 'Invalid amount format. Use e.g. 123.45' }, 400);
  }
  if (!validateDateString(receipt_date)) {
    return jsonResponse({ error: 'Invalid receipt_date format. Use YYYY-MM-DD' }, 400);
  }

  let stored = { stored: false };
  if (file && file.base64) {
    stored = await uploadBase64ToBlob({ base64: file.base64, mimeType: file.mimeType, name: file.name });
  }

  const doc = await createReceipt({
    user_id: user.id,
    description,
    amount_euro: amount,
    receipt_date,
    file_name: file?.name ? escapeHtml(String(file.name)) : null,
    file_path: stored.url || null,
    mime_type: file?.mimeType || 'application/pdf',
    status: STATUSES.PENDING,
  });
  await appendHistory({ receipt_id: doc.id, old_status: null, new_status: STATUSES.PENDING, changed_by_user_id: user.id, comment: 'Submitted' });
  return jsonResponse({ message: 'Receipt submitted successfully', receipt_id: doc.id }, 201);
}

export async function listReceiptsHandler(request, user) {
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status');
  let finalStatus;
  try {
    finalStatus = status ? normalizeStatus(status) : undefined;
  } catch (e) {
    return jsonResponse({ error: e.message || 'Invalid status' }, 400);
  }
  const receipts = await queryReceipts({ user, from, to, status: finalStatus });
  return jsonResponse({ receipts });
}

export async function listMyReceiptsHandler(request, user) {
  const receipts = await queryReceipts({ user, from: undefined, to: undefined, status: undefined });
  return jsonResponse({ receipts });
}

export async function pendingApprovalHandler(request, user) {
  const receipts = await getReceiptsByStatus(STATUSES.PENDING);
  return jsonResponse({ receipts });
}

export async function payableHandler(request, user) {
  const receipts = await getReceiptsByStatus(STATUSES.APPROVED);
  return jsonResponse({ receipts });
}

export async function statisticsHandler(request, user) {
  // Fetch relevant receipts and aggregate in code
  const receipts = await queryReceipts({ user, from: undefined, to: undefined, status: undefined });
  const stats = receipts.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const statistics = Object.entries(stats).map(([status, count]) => ({ status, count }));
  return jsonResponse({ statistics });
}

export async function getReceiptHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (!canAccessReceipt(user, receipt)) return jsonResponse({ error: 'Forbidden' }, 403);
  return jsonResponse({ receipt });
}

export async function getReceiptHistoryHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (!canAccessReceipt(user, receipt)) return jsonResponse({ error: 'Forbidden' }, 403);
  const history = await getReceiptHistory(receipt.id);
  return jsonResponse({ receipt, history });
}

export async function updateReceiptHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (String(receipt.user_id) !== String(user.id)) return jsonResponse({ error: 'Forbidden' }, 403);
  if ([STATUSES.APPROVED, STATUSES.REJECTED, STATUSES.PAID].includes(receipt.status)) {
    return jsonResponse({ error: 'Receipt can no longer be edited' }, 400);
  }
  let body;
  try {
    body = await parseJson(request);
  } catch (e) {
    return jsonResponse({ error: e.message || 'Invalid JSON body' }, 400);
  }
  const description = escapeHtml(String(body.description || '').trim());
  const amount = String(body.amount || '').trim();
  const receipt_date = String(body.receipt_date || '').trim();
  if (!description || !amount || !receipt_date) {
    return jsonResponse({ error: 'description, amount and receipt_date are required' }, 400);
  }
  if (!validateAmountString(amount)) {
    return jsonResponse({ error: 'Invalid amount format. Use e.g. 123.45' }, 400);
  }
  if (!validateDateString(receipt_date)) {
    return jsonResponse({ error: 'Invalid receipt_date format. Use YYYY-MM-DD' }, 400);
  }
  await updateReceiptDoc(id, { description, amount_euro: amount, receipt_date });
  return jsonResponse({ message: 'Receipt updated successfully' });
}

export async function deleteReceiptHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (String(receipt.user_id) !== String(user.id)) return jsonResponse({ error: 'Forbidden' }, 403);
  if ([STATUSES.APPROVED, STATUSES.REJECTED, STATUSES.PAID].includes(receipt.status)) {
    return jsonResponse({ error: 'Receipt can no longer be deleted' }, 400);
  }
  await deleteReceiptDoc(id);
  return jsonResponse({ message: 'Receipt deleted successfully' });
}

export async function approveReceiptHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (receipt.status !== STATUSES.PENDING) return jsonResponse({ error: 'Receipt is not pending approval' }, 400);
  await updateReceiptDoc(id, { status: STATUSES.APPROVED, approved_at: new Date().toISOString(), approved_by_user_id: user.id });
  await appendHistory({ receipt_id: id, old_status: receipt.status, new_status: STATUSES.APPROVED, changed_by_user_id: user.id, comment: 'Approved' });
  return jsonResponse({ message: 'Receipt approved successfully' });
}

export async function rejectReceiptHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (receipt.status !== STATUSES.PENDING) return jsonResponse({ error: 'Receipt is not pending approval' }, 400);
  let body;
  try {
    body = await parseJson(request);
  } catch (e) {
    return jsonResponse({ error: e.message || 'Invalid JSON body' }, 400);
  }
  const comment = escapeHtml(String(body.comment || '').trim());
  await updateReceiptDoc(id, { status: STATUSES.REJECTED, rejected_at: new Date().toISOString(), rejected_by_user_id: user.id });
  await appendHistory({ receipt_id: id, old_status: receipt.status, new_status: STATUSES.REJECTED, changed_by_user_id: user.id, comment: comment || 'Rejected' });
  return jsonResponse({ message: 'Receipt rejected successfully' });
}

export async function payReceiptHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (receipt.status !== STATUSES.APPROVED) return jsonResponse({ error: 'Receipt is not ready for payout' }, 400);
  await updateReceiptDoc(id, { status: STATUSES.PAID, paid_at: new Date().toISOString(), paid_by_user_id: user.id });
  await appendHistory({ receipt_id: id, old_status: receipt.status, new_status: STATUSES.PAID, changed_by_user_id: user.id, comment: 'Paid' });
  return jsonResponse({ message: 'Receipt paid successfully' });
}
