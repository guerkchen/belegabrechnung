# REST-Schnittstellen für die Belegabrechnung

## Ziel
Diese Datei definiert eine erste REST-API-Übersicht für die Webapp auf Basis der Anforderungen. Der Fokus liegt auf dem Kern-Workflow: Beleg hochladen, zur Freigabe schicken, freigeben oder ablehnen und zur Auszahlung vorbereiten.

## Rollen und Berechtigungen

- User
  - Kann eigene Belege hochladen und verwalten.
  - Kann nur seine eigenen Belege sehen.

- Freigeber
  - Kann wie ein User Belege hochladen.
  - Kann alle offenen Belege zur Freigabe sehen.
  - Kann Belege genehmigen oder ablehnen.
  - Kann alle freigegebenen Belege einsehen und filtern.

- Kassenwart
  - Kann wie ein User Belege hochladen.
  - Kann alle Belege sehen, die freigegeben wurden.
  - Kann freigegebene Belege auf "Ausgezahlt" setzen.
  - Kann bereits freigegebene Belege wieder auf "Abgelehnt" setzen (z. B. bei Unklarheiten in der Auszahlung).

## Allgemeine Regeln

- Alle Endpunkte erfordern eine Authentifizierung über Azure Users.
- Jede Anfrage sollte prüfen, ob die Rolle die Operation erlaubt.
- Belege haben mindestens diese Status:
  - zur Freigabe
  - Freigegeben
  - Abgelehnt
  - Ausgezahlt
- Gültige Statusübergänge:
  - zur Freigabe -> Freigegeben
  - zur Freigabe -> Abgelehnt
  - Freigegeben -> Ausgezahlt
  - Freigegeben -> Abgelehnt (nur Kassenwart/Admin)

## Endpunkte

### 1. Auth und Profil

| Methode | Endpoint | Zweck | Erlaubt für |
|---|---|---|---|
| GET | /api/auth/me | Aktuellen Benutzer mit Rolle und Rechten zurückgeben | Alle authentifizierten Nutzer |
### 2. Belege verwalten

| Methode | Endpoint | Zweck | Erlaubt für |
|---|---|---|---|
| POST | /api/receipts | Neuen Beleg hochladen (PDF + Beschreibung, Betrag, Belegdaten) – optional mit Kommentar und Kontodaten (Kontoinhaber, IBAN). Hinweis: Kommentar ist nach dem Einreichen nicht mehr änderbar. | User, Freigeber, Kassenwart |
| GET | /api/receipt/{id} | Details zu einem bestimmten Beleg | Besitzer, Freigeber, Kassenwart |
| PUT | /api/receipt/{id} | Beleg bearbeiten (nur wenn noch nicht freigegeben/abgelehnt wurde) | Besitzer |
| DELETE | /api/receipt/{id} | Beleg löschen (nur im Status "zur Freigabe") | Besitzer |

### 3. Freigabe-Workflow

| Methode | Endpoint | Zweck | Erlaubt für |
|---|---|---|---|
| GET | /api/receipts/pending-approval | Alle Belege mit Status "zur Freigabe" | Freigeber |
| | POST | /api/receipt/{id}/approve | Beleg genehmigen und Status auf "Freigegeben" setzen | Freigeber |
| | POST | /api/receipt/{id}/reject | Beleg ablehnen und Status auf "Abgelehnt" setzen | Freigeber |
| | GET | /api/receipts?status=Freigegeben | Liste aller Belege mit Status "Freigegeben" (alternativ Filter über Status) | Freigeber, Kassenwart |

### 4. Auszahlung

| Methode | Endpoint | Zweck | Erlaubt für |
|---|---|---|---|
| GET | /api/receipts/payable | Alle Belege mit Status "Freigegeben" | Kassenwart |
| | POST | /api/receipt/{id}/pay | Beleg auf "Ausgezahlt" setzen | Kassenwart |
| POST | /api/receipt/{id}/reject-approved | Bereits freigegebenen Beleg wieder auf "Abgelehnt" setzen (optional mit comment) | Kassenwart |

### 5. Filterung, Suche und Auswertung

| Methode | Endpoint | Zweck | Erlaubt für |
|---|---|---|---|
| GET | /api/receipts?from=...&to=...&status=... | Gefilterte Belegliste nach Datum und Status | User, Freigeber, Kassenwart je nach Sichtbarkeit |
| GET | /api/receipts/statistics | Zählung der Belege pro Status, z. B. für den eigenen Nutzer | User, Freigeber, Kassenwart |
| GET | /api/receipt/{id}/history | Verlauf des Belegs, inklusive Einreicher und Freigabe-/Ablehnungs-Entscheidung | Besitzer, Freigeber, Kassenwart |

Hinweis: Für ID-basierte Beleg-Endpunkte wird bewusst die Singular-Ressource "/api/receipt/{id}" verwendet, um Konflikte mit Unterpfaden wie "/api/receipts/statistics" zu vermeiden.

## Hinweise zur Umsetzung

- Der Upload sollte das PDF speichern und einen Dateipfad bzw. Dateinamen in der Datenbank ablegen.
- Die API sollte bei der Erstellung eines Belegs automatisch den Status "zur Freigabe" setzen.
- Für Statusänderungen sollte eine Prüfung auf die erlaubten Übergänge erfolgen.
- Für die Audit-Funktion sollten Einreicher, Freigebender und Ablehnender in der Datenbank gespeichert werden.
 - Kontodaten (Kontoinhaber, IBAN) können optional pro Beleg mitgegeben werden. IBAN wird serverseitig validiert (IBAN-Format inkl. Mod-97-Prüfung).
 - Sichtbarkeit Kontodaten:
   - Besitzer (Einreicher) sieht Kontodaten seiner eigenen Belege.
   - Kassenwart (und Admin) sieht Kontodaten aller Belege.
 - Nutzerkommentar:
   - Optionales Feld comment beim Erstellen eines Belegs. Serverseitig als user_comment gespeichert und HTML-gesäubert.
   - Wird in der Belegansicht angezeigt.
   - Kommentar ist unveränderlich (keine API zum nachträglichen Ändern oder Löschen). Maximale Länge: 1000 Zeichen.

## MVP vs. Ausbau

### MVP
- Beleg hochladen
- Eigene Belege sehen
- Offene Belege zur Freigabe sehen
- Genehmigen / Ablehnen
- Freigegebene Belege zur Auszahlung sehen
- Auszahlen

### Ausbau 1
- Filterung nach Datumsspanne und Status
- Statistik pro Status
- Übersicht aller freigegebenen Belege für Freigeber

### Ausbau 2
- Beleg bearbeiten
- Beleg löschen
- Nur solange ein Beleg noch nicht freigegeben oder abgelehnt wurde
