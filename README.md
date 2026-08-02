# Azure Functions Node.js Backend (Cosmos DB NoSQL)

This folder contains a rewritten backend in Node.js using Azure Functions and Azure Cosmos DB (NoSQL), replacing the previous PHP/MySQL implementation.

Key points:

- Single file that defines all REST routes: `src/routes.js`
- Handlers split into focused modules under `src/handlers/`
- Cosmos DB access encapsulated in `src/services/cosmos.js`
- Microsoft Entra ID (Azure AD) login flow and token utilities in `src/utils/auth.js`
- Azure Blob Storage integration for receipt file uploads in `src/utils/blob.js`

## Prerequisites

- Node.js 18+
- Azure Functions Core Tools v4
- An Azure Cosmos DB account (NoSQL API)
- Azure Storage account for file uploads

## Environment Variables

Set these in your environment or `local.settings.json` (Values -> not committed). The app will fail fast at startup if required variables are missing:

- COSMOS_ENDPOINT
- COSMOS_KEY
- COSMOS_DB_NAME (e.g., `belegabrechnung`)
- MICROSOFT_TENANT_ID
- MICROSOFT_CLIENT_ID
- MICROSOFT_CLIENT_SECRET
- MICROSOFT_REDIRECT_URI (e.g., `http://localhost:7071/api/auth/callback`)
- MICROSOFT_GROUP_ROLE_MAP (map Azure AD group mail addresses to roles, e.g., `freigeber@contoso.com=freigeber,kassenwart@contoso.com=kassenwart,admin@contoso.com=admin`)
- AZURE_STORAGE_CONNECTION_STRING (for Blob uploads)

Notes:
- Most variables are required and validated at startup. The app's JWT secret is generated on first start and stored in Cosmos DB (`app_settings`), see `src/utils/jwtKey.js`.

## Install & Run Locally

1. Install dependencies:
   npm install

2. Start the Functions runtime:
   npm start

The API will be available under http://localhost:7071/api

## Routes

All routes are declared in `src/routes.js` using the Azure Functions v4 Node.js programming model:

- GET    /auth/me
- GET    /auth/login
- GET    /auth/callback
- POST   /auth/logout
-
- POST   /receipts
- GET    /receipts
- GET    /receipts/me
- GET    /receipts/pending-approval
- GET    /receipts/payable
- GET    /receipts/statistics
-
- GET    /receipt/{id}
- GET    /receipt/{id}/history
- PUT    /receipt/{id}
- DELETE /receipt/{id}
-
- POST   /receipt/{id}/approve
- POST   /receipt/{id}/reject
- POST   /receipt/{id}/pay
-
- POST   /receipt/{id}/reject-approved  (Kassenwart/Admin: freigegebenen Beleg ablehnen)

Notes:
- Authentication is expected via `Authorization: Bearer <access_token>` header from a frontend SPA using MSAL.
- The `/auth/login` endpoint returns a Microsoft login URL to initiate the auth code flow. `/auth/callback` exchanges the code for tokens and persists/updates the user.
- File uploads: send JSON with `{ file: { name, mimeType, base64 } }` for now. Files are uploaded to a Blob container named `receipts` using the configured `AZURE_STORAGE_CONNECTION_STRING`.

### Roles

- user: Standardnutzer kann eigene Belege einreichen, einsehen und bearbeiten/löschen, solange nicht freigegeben/abgelehnt/ausgezahlt.
- freigeber: Kann zusätzlich alle offenen Belege einsehen und freigeben/ablehnen.
- kassenwart: Kann zusätzlich freigegebene Belege als ausgezahlt markieren und bei Bedarf bereits freigegebene Belege ablehnen.
- admin: Vereinigt alle Rechte (sieht alle Tabs, darf freigeben/ablehnen und auszahlen). Weisen Sie Benutzer der AAD-Gruppe zu, die in `MICROSOFT_GROUP_ROLE_MAP` auf `admin` gemappt ist, z. B. `admin@contoso.com=admin`.

Hinweis zu Rollenzuordnung nach AAD-Gruppen:
- Die Zuordnung erfolgt über die Mailadresse der Gruppe (nicht mehr über den Anzeigenamen/displayName).
- Stellen Sie sicher, dass Ihre Gruppen eine Mailadresse besitzen (z. B. Microsoft 365 Gruppe oder mailaktivierte Sicherheitsgruppe). Nur Einträge mit einer vorhandenen Mailadresse werden berücksichtigt.

## Cosmos DB Containers

Database name: `COSMOS_DB_NAME`

- users (partition key: `/id`) – stores users with `azure_user_id`, `email`, `display_name`, `role`, `is_active`
- receipts (partition key: `/user_id`) – receipts and current status
- receipt_status_history (partition key: `/receipt_id`) – status transitions
 - app_settings (partition key: `/id`) – application-level settings (e.g., `app_jwt_secret`)

You can optionally run `node scripts/setup_cosmos.js` to create missing containers.

## Deployment

Use Azure Functions tooling (or GitHub Actions) to deploy this folder as an Azure Functions app. Ensure the application settings in Azure match the environment variables listed above.

## Manual test walkthrough

Goal: As Kassenwart, reject an already approved receipt.

1) Start backend locally:
   npm start

2) Open the SPA at http://localhost:7071/ and authenticate via Microsoft login.

3) Ensure your user has the role `kassenwart` or `admin` (role assignment is controlled by the group mapping in MICROSOFT_GROUP_ROLE_MAP).

4) Create a test receipt via the UI (Submit tab) as any user; then log in as a `freigeber` (or `admin`) and approve it on the "Belege freigeben" page.

5) Switch to a `kassenwart` (or `admin`) user. Open the "Belege auszahlen" page. Each approved receipt now shows two buttons: "Ablehnen" and "Als ausgezahlt markieren".

6) Click "Ablehnen" and optionally enter a reason. The receipt status changes from "Freigegeben" to "Abgelehnt" and a history entry is recorded.

7) Verify via the History view or by fetching GET /api/receipt/{id}/history that the transition from Freigegeben -> Abgelehnt is recorded with your user ID and comment.
