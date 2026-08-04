import { jsonResponse, parseJson, normalizeStatus, canAccessReceipt, escapeHtml, STATUSES, ROLES } from '../utils/common.js';
import {
  createReceipt,
  queryReceipts,
  getReceiptsByStatus,
  getReceiptById,
  updateReceipt as updateReceiptDoc,
  deleteReceipt as deleteReceiptDoc,
  appendHistory,
  getReceiptHistory,
  getReceiptsForUser,
  getLatestReceiptForUser,
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

// IBAN validation: normalize (strip spaces, uppercase), basic format and mod-97 check
function normalizeIban(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\s+/g, '').toUpperCase();
}

function validateIban(ibanRaw) {
  const iban = normalizeIban(ibanRaw);
  // Generic IBAN pattern: 2 letters country, 2 digits check, then alphanum 10-30
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  // Rearrange and convert
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let converted = '';
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      // A=10 ... Z=35
      converted += String(code - 55);
    } else {
      converted += ch;
    }
  }
  // Compute mod 97. Process in chunks to avoid bigints.
  let remainder = 0;
  for (let i = 0; i < converted.length; i += 7) {
    const part = String(remainder) + converted.slice(i, i + 7);
    remainder = Number(BigInt(part) % 97n);
  }
  return remainder === 1;
}

function sanitizeReceiptForUser(user, receipt) {
  const isOwner = String(receipt.user_id) === String(user.id);
  const canSeeAll = user.role === ROLES.KASSENWART || user.role === ROLES.ADMIN;
  const allow = canSeeAll || isOwner;
  // Only redact the bank fields if not allowed
  const redacted = { ...receipt };
  if (!allow) {
    if (Object.prototype.hasOwnProperty.call(redacted, 'payout_account_holder')) redacted.payout_account_holder = '<protected>';
    if (Object.prototype.hasOwnProperty.call(redacted, 'payout_iban')) redacted.payout_iban = '<protected>';
  }
  return redacted;
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
  const payout_account_holder = escapeHtml(String(body.payout_account_holder || '').trim());
  const payout_iban_raw = String(body.payout_iban || '').trim();
  const payout_iban = normalizeIban(payout_iban_raw);
  const user_comment_raw = String(body.comment || '').substring(0, 1000).trim();
  const user_comment = user_comment_raw ? escapeHtml(user_comment_raw) : null;

  if (!description || !amount || !receipt_date || !file) {
    return jsonResponse({ error: 'description, amount, receipt_date and file are required' }, 400);
  }
  if (!validateAmountString(amount)) {
    return jsonResponse({ error: 'Invalid amount format. Use e.g. 123.45' }, 400);
  }
  if (!validateDateString(receipt_date)) {
    return jsonResponse({ error: 'Invalid receipt_date format. Use YYYY-MM-DD' }, 400);
  }

  // If one bank field is provided, require both and validate IBAN
  if ((payout_account_holder && !payout_iban) || (!payout_account_holder && payout_iban)) {
    return jsonResponse({ error: 'Please provide both payout_account_holder and payout_iban or leave both empty' }, 400);
  }
  if (payout_iban && !validateIban(payout_iban)) {
    return jsonResponse({ error: 'Invalid IBAN' }, 400);
  }

  let stored = { stored: false };
  if (file && file.base64) {
    stored = await uploadBase64ToBlob({ base64: file.base64, mimeType: file.mimeType, name: file.name });
  }

  const doc = await createReceipt({
    user_id: user.id,
    user_name: user.display_name,
    // Also persist a consistent display name field for submitter
    user_display_name: user.display_name,
    description,
    amount_euro: amount,
    receipt_date,
    file_name: file?.name ? escapeHtml(String(file.name)) : null,
    file_path: stored.url || null,
    mime_type: file?.mimeType || 'application/pdf',
    status: STATUSES.PENDING,
    payout_account_holder: payout_account_holder || null,
    payout_iban: payout_iban || null,
    user_comment,
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
  const sanitized = receipts.map((r) => sanitizeReceiptForUser(user, r));
  return jsonResponse({ receipts: sanitized });
}

export async function listMyReceiptsHandler(request, user) {
  // Always return only the caller's own receipts, regardless of role
  const receipts = await getReceiptsForUser(user.id);
  const sanitized = receipts.map((r) => sanitizeReceiptForUser(user, r));
  return jsonResponse({ receipts: sanitized });
}

export async function pendingApprovalHandler(request, user) {
  const receipts = await getReceiptsByStatus(STATUSES.PENDING);
  const sanitized = receipts.map((r) => sanitizeReceiptForUser(user, r));
  return jsonResponse({ receipts: sanitized });
}

export async function payableHandler(request, user) {
  const receipts = await getReceiptsByStatus(STATUSES.APPROVED);
  const sanitized = receipts.map((r) => sanitizeReceiptForUser(user, r));
  return jsonResponse({ receipts: sanitized });
}

// Returns Kontoinhaber + IBAN from the user's latest submitted receipt
export async function getLastPayoutDataHandler(request, user) {
  const last = await getLatestReceiptForUser(user.id);
  if (!last) {
    return jsonResponse({ error: 'Keine früheren Belege gefunden' }, 404);
  }
  const holder = String(last.payout_account_holder || '').trim();
  const iban = String(last.payout_iban || '').trim();
  if (!holder || !iban) {
    return jsonResponse({ error: 'Im letzten Beleg sind keine Kontodaten hinterlegt' }, 404);
  }
  return jsonResponse({ payout_account_holder: holder, payout_iban: iban });
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
  return jsonResponse({ receipt: sanitizeReceiptForUser(user, receipt) });
}

export async function getReceiptHistoryHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (!canAccessReceipt(user, receipt)) return jsonResponse({ error: 'Forbidden' }, 403);
  const history = await getReceiptHistory(receipt.id);
  return jsonResponse({ receipt: sanitizeReceiptForUser(user, receipt), history });
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
  const payout_account_holder = escapeHtml(String(body.payout_account_holder || '').trim());
  const payout_iban_raw = String(body.payout_iban || '').trim();
  const payout_iban = normalizeIban(payout_iban_raw);
  if (!description || !amount || !receipt_date) {
    return jsonResponse({ error: 'description, amount and receipt_date are required' }, 400);
  }
  if (!validateAmountString(amount)) {
    return jsonResponse({ error: 'Invalid amount format. Use e.g. 123.45' }, 400);
  }
  if (!validateDateString(receipt_date)) {
    return jsonResponse({ error: 'Invalid receipt_date format. Use YYYY-MM-DD' }, 400);
  }
  if ((payout_account_holder && !payout_iban) || (!payout_account_holder && payout_iban)) {
    return jsonResponse({ error: 'Please provide both payout_account_holder and payout_iban or leave both empty' }, 400);
  }
  if (payout_iban && !validateIban(payout_iban)) {
    return jsonResponse({ error: 'Invalid IBAN' }, 400);
  }
  await updateReceiptDoc(id, {
    description,
    amount_euro: amount,
    receipt_date,
    payout_account_holder: payout_account_holder || null,
    payout_iban: payout_iban || null,
  });
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
  await updateReceiptDoc(id, { status: STATUSES.APPROVED, approved_at: new Date().toISOString(), approved_by_user_id: user.id, approved_by_user_name: user.display_name });
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
  await updateReceiptDoc(id, {
    status: STATUSES.REJECTED,
    rejected_at: new Date().toISOString(),
    rejected_by_user_id: user.id,
    rejected_by_user_name: user.display_name,
  });
  await appendHistory({ receipt_id: id, old_status: receipt.status, new_status: STATUSES.REJECTED, changed_by_user_id: user.id, comment: comment || 'Rejected' });
  return jsonResponse({ message: 'Receipt rejected successfully' });
}

export async function payReceiptHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (receipt.status !== STATUSES.APPROVED) return jsonResponse({ error: 'Receipt is not ready for payout' }, 400);
  await updateReceiptDoc(id, {
    status: STATUSES.PAID,
    paid_at: new Date().toISOString(),
    paid_by_user_id: user.id,
    // Standardize on *_user_name for display in UI
    paid_by_user_name: user.display_name,
  });
  await appendHistory({ receipt_id: id, old_status: receipt.status, new_status: STATUSES.PAID, changed_by_user_id: user.id, comment: 'Paid' });
  return jsonResponse({ message: 'Receipt paid successfully' });
}

// Kassenwart: bereits freigegebene Belege ablehnen
// Erlaubt die Zurückweisung eines Belegs, der den Status "Freigegeben" hat.
// Erwartet optional { comment } im Body. Protokolliert die Änderung in der Historie.
export async function treasurerRejectApprovedReceiptHandler(request, user, id) {
  const receipt = await getReceiptById(id);
  if (!receipt) return jsonResponse({ error: 'Receipt not found' }, 404);
  if (receipt.status !== STATUSES.APPROVED) {
    return jsonResponse({ error: 'Only approved receipts can be rejected by treasurer' }, 400);
  }
  let body = {};
  try {
    body = await parseJson(request);
  } catch (e) {
    // Ignore malformed/empty body -> treat as no comment
    body = {};
  }
  const comment = escapeHtml(String(body.comment || '').trim());

  await updateReceiptDoc(id, {
    status: STATUSES.REJECTED,
    rejected_at: new Date().toISOString(),
    rejected_by_user_id: user.id,
    // Store display name so UI can show the user
    rejected_by_user_name: user.display_name,
  });
  await appendHistory({
    receipt_id: id,
    old_status: receipt.status,
    new_status: STATUSES.REJECTED,
    changed_by_user_id: user.id,
    comment: comment || 'Rejected by treasurer',
  });
  return jsonResponse({ message: 'Approved receipt has been rejected' });
}
