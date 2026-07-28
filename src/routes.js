import { app } from '@azure/functions';
import { jsonResponse, ROLES } from './utils/common.js';
import { withAuth } from './utils/middleware.js';
import { serveFrontend } from './handlers/frontend.js';
import {
  authMe,
  authLogin,
  authCallback,
  authLogout,
} from './handlers/auth.js';
import {
  createReceiptHandler,
  listReceiptsHandler,
  listMyReceiptsHandler,
  pendingApprovalHandler,
  payableHandler,
  statisticsHandler,
  getReceiptHandler,
  getReceiptHistoryHandler,
  updateReceiptHandler,
  deleteReceiptHandler,
  approveReceiptHandler,
  rejectReceiptHandler,
  payReceiptHandler,
} from './handlers/receipts.js';

function cors204() {
  return {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
  };
}

// Global OPTIONS handler for SPA preflights
app.http('optionsAll', {
  methods: ['OPTIONS'],
  authLevel: 'anonymous',
  route: '{*restOfPath}',
  handler: async () => cors204(),
});

// Auth endpoints
app.http('authMe', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/me',
  handler: async (request) => authMe(request),
});

app.http('authLogin', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: async () => authLogin(),
});

app.http('authCallback', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/callback',
  handler: async (request) => authCallback(request),
});

app.http('authLogout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/logout',
  handler: async () => authLogout(),
});

// Receipts
app.http('createReceipt', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'receipts',
  handler: withAuth([ROLES.USER, ROLES.FREIGEBER, ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => createReceiptHandler(request, user)),
});

app.http('listReceipts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'receipts',
  handler: withAuth([ROLES.USER, ROLES.FREIGEBER, ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => listReceiptsHandler(request, user)),
});

app.http('listMyReceipts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'receipts/me',
  handler: withAuth([ROLES.USER, ROLES.FREIGEBER, ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => listMyReceiptsHandler(request, user)),
});

app.http('pendingApprovalReceipts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'receipts/pending-approval',
  handler: withAuth([ROLES.FREIGEBER, ROLES.ADMIN], async (request, user) => pendingApprovalHandler(request, user)),
});

app.http('payableReceipts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'receipts/payable',
  handler: withAuth([ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => payableHandler(request, user)),
});

app.http('receiptStatistics', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'receipts/statistics',
  handler: withAuth([ROLES.USER, ROLES.FREIGEBER, ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => statisticsHandler(request, user)),
});

app.http('getReceiptHistory', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'receipts/{id}/history',
  handler: withAuth([ROLES.USER, ROLES.FREIGEBER, ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => getReceiptHistoryHandler(request, user, request.params.id)),
});

app.http('getReceipt', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'receipts/{id}',
  handler: withAuth([ROLES.USER, ROLES.FREIGEBER, ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => getReceiptHandler(request, user, request.params.id)),
});

app.http('updateReceipt', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'receipts/{id}',
  handler: withAuth([ROLES.USER, ROLES.FREIGEBER, ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => updateReceiptHandler(request, user, request.params.id)),
});

app.http('deleteReceipt', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'receipts/{id}',
  handler: withAuth([ROLES.USER, ROLES.FREIGEBER, ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => deleteReceiptHandler(request, user, request.params.id)),
});

app.http('approveReceipt', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'receipts/{id}/approve',
  handler: withAuth([ROLES.FREIGEBER, ROLES.ADMIN], async (request, user) => approveReceiptHandler(request, user, request.params.id)),
});

app.http('rejectReceipt', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'receipts/{id}/reject',
  handler: withAuth([ROLES.FREIGEBER, ROLES.ADMIN], async (request, user) => rejectReceiptHandler(request, user, request.params.id)),
});

app.http('payReceipt', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'receipts/{id}/pay',
  handler: withAuth([ROLES.KASSENWART, ROLES.ADMIN], async (request, user) => payReceiptHandler(request, user, request.params.id)),
});

// Frontend SPA
// Serve index.html for root path "" (e.g., /api)
app.http('rootFrontend', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: '',
  handler: async () => serveFrontend(),
});