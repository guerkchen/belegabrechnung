# PHP REST API

Diese Ordnerstruktur enthält eine einfache PHP-REST-API für die Belegabrechnung.

## Struktur

- config.php: Datenbankverbindung, Hilfsfunktionen und Auth-Stub
- index.php: Haupt-Router mit allen Endpunkten
- uploads/: Verzeichnis für hochgeladene Dateien

## Hinweise

- Die Authentifizierung läuft jetzt über Microsoft Entra ID / Azure AD OAuth2.
- Beim ersten Login wird der Nutzer in der lokalen Datenbank angelegt.
- Die Rolle wird über die Gruppenzugehörigkeiten aus Microsoft bestimmt. Die Zuordnung erfolgt über die Umgebungsvariable MICROSOFT_GROUP_ROLE_MAP.

## Microsoft-SSO-Konfiguration

Setze in deiner Umgebung diese Variablen:

- MICROSOFT_TENANT_ID
- MICROSOFT_CLIENT_ID
- MICROSOFT_CLIENT_SECRET
- MICROSOFT_REDIRECT_URI
- MICROSOFT_GROUP_ROLE_MAP

Beispiel für MICROSOFT_GROUP_ROLE_MAP:

- Belegabrechnung-Freigeber=freigeber,Belegabrechnung-Kassenwart=kassenwart

Die Login-Sequenz ist:

1. GET /api/auth/login -> erhält eine Microsoft-Login-URL
2. Browser auf die URL leiten
3. Microsoft leitet zurück nach /api/auth/callback
4. Der Nutzer wird angelegt bzw. aktualisiert und in der Session gespeichert
