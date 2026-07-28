# Frontend-Anforderungen für die Belegabrechnung

## Ziel
Die Webanwendung soll für die drei Rollen User, Freigeber und Kassenwart eine einfache, responsive und verständliche Benutzeroberfläche bereitstellen. Die Oberfläche soll die wichtigsten Workflows der Belegabrechnung abbilden und eine klare Navigation ermöglichen.

## Allgemeine Anforderungen

- Das Frontend soll responsive sein und auf Desktop-, Tablet- und Smartphone-Bildschirmen funktionieren.
- Die Benutzeroberfläche soll mit Bootstrap, HTML und JavaScript umgesetzt werden.
- Es soll eine feste oder sticky Navigationsleiste geben.
- Die Navigation soll je nach Rolle unterschiedliche Menüpunkte anzeigen.
- Die Anwendung soll eine einheitliche Gestaltung mit klaren Formularen, Listen und Statusanzeigen haben.
- Alle Screens sollen barrierearm und intuitiv nutzbar sein.

## Globale UI-Bestandteile

### Navigation
- Eine Navigationsleiste soll oben im Layout vorhanden sein.
- Sie soll Links zu den verfügbaren Screens je nach Rolle enthalten.
- Auf kleinen Displays soll die Navigation zusammenklappbar sein (z. B. Bootstrap Navbar mit Hamburger-Menü).

### Fußzeile
- Eine Fußzeile soll am unteren Rand jeder Seite sichtbar sein.
- Sie soll mindestens folgende Links enthalten:
  - Impressum
  - Datenschutz

## Rollen und Sichtbarkeit

### User
- Kann die Screens Home, Beleg einreichen und Meine Belege sehen.

### Freigeber
- Kann alle Screens eines Users sehen.
- Zusätzlich kann er den Screen Belege freigeben sehen.
- Zusätzlich kann er den Screen Beleghistorie sehen.

### Kassenwart
- Kann alle Screens eines Users sehen.
- Zusätzlich kann er den Screen Belege auszahlen sehen.
- Zusätzlich kann er den Screen Beleghistorie sehen.

## Screens

### 1. Home
Ziel: Überblick über die wichtigsten Informationen für die aktuelle Rolle.

Anforderungen:
- Für alle Rollen verfügbar.
- Zeigt eine kurze Zusammenfassung der wichtigsten Funktionen.
- Optional: Statistikkarten wie Anzahl der Belege pro Status.
- Gut lesbare Übersicht mit klaren Abschnitten.

### 2. Beleg einreichen
Ziel: Neue Belege hochladen und angeben.

Anforderungen:
- Für alle Rollen verfügbar.
- Formular mit folgenden Feldern:
  - Belegbeschreibung
  - Betrag
  - Belegdaten / Belegdatum
  - PDF-Datei hochladen
- Beim Speichern soll der Beleg automatisch in den Status "zur Freigabe" übergehen.
- Nach dem Speichern soll eine Bestätigungsnachricht sichtbar sein.
- Bei Fehlern sollen klare Fehlermeldungen erscheinen.

### 3. Meine Belege
Ziel: Übersicht über die eigenen eingereichten Belege.

Anforderungen:
- Für alle Rollen verfügbar.
- Liste aller eigenen Belege mit mindestens folgenden Daten:
  - Belegbeschreibung
  - Betrag
  - Status
  - Einreichungsdatum
- Filteroptionen nach:
  - Datumsspanne
  - Status
- Optional: Suchfunktion nach Beschreibung oder Datum.
- Pro Beleg soll ein Eintrag sichtbar sein, der bei Bedarf geöffnet oder weiter bearbeitet werden kann.

### 4. Belege freigeben
Ziel: Offene Belege zur Freigabe prüfen und entscheiden.

Anforderungen:
- Nur für Freigeber sichtbar.
- Liste aller Belege mit Status "zur Freigabe".
- Pro Beleg sollen sichtbar sein:
  - Einreicher
  - Beschreibung
  - Betrag
  - Datum
  - PDF-Link oder Vorschau
- Freigeber soll die Möglichkeit haben, einen Beleg zu genehmigen oder abzulehnen.
- Nach der Entscheidung soll der Status entsprechend aktualisiert werden.

### 5. Belege auszahlen
Ziel: Freigegebene Belege zur Auszahlung verwalten.

Anforderungen:
- Nur für Kassenwart sichtbar.
- Liste aller Belege mit Status "Freigegeben".
- Pro Beleg sollen sichtbar sein:
  - Beschreibung
  - Betrag
  - Einreicher
  - Freigabedatum
- Kassenwart soll einen Beleg als "Ausgezahlt" markieren können.

### 6. Beleghistorie
Ziel: Historie aller relevanten Belege einsehen.

Anforderungen:
- Für Freigeber und Kassenwart sichtbar.
- Übersicht aller Belege, die bereits bearbeitet wurden.
- Optional Filter nach:
  - Datumsspanne
  - Status
- Zeigt die Historie von Statusänderungen an, soweit verfügbar.

## Responsive Anforderungen

- Die Seiten sollen auf kleinen Bildschirmen ohne horizontalen Scrollen nutzbar sein.
- Formulare sollen auf mobilen Geräten gut lesbar und mit ausreichender Touch-Zielgröße dargestellt werden.
- Tabellen sollten auf kleinen Displays in eine kompakte, scrollbare oder gestapelte Darstellung überführt werden.
- Die Navigation soll auf kleinen Displays als Hamburger-Menü erscheinen.

## UX- und Usability-Anforderungen

- Klare visuelle Statusfarben für die Belegstatus sollten verwendet werden.
- Erfolgs- und Fehlermeldungen sollen sichtbar und verständlich sein.
- Ladezustände und leere Zustände sollen sinnvoll umgesetzt werden.
- Die Anwendung soll konsistent aufgebaut sein, damit Rollenwechsel leicht nachvollziehbar sind.

## Optionaler Ausbau

- Dark Mode
- Sortierung nach Datum oder Betrag
- Download von Belegen direkt aus der Übersicht
- Fortschrittsbalken oder Kennzahlen auf dem Home-Screen