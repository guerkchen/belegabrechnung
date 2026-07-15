# FTP-Upload-Skript

Dieses Skript lädt die relevanten Projektdateien per FTP auf einen konfigurierbaren Zielserver.

## Voraussetzungen

- Python 3
- Zugriff auf einen FTP-Server

## Konfiguration

Entweder Umgebungsvariablen setzen oder die Defaults im Skript anpassen.

### Umgebungsvariablen

```bash
export FTP_HOST="ftp.example.com"
export FTP_PORT="21"
export FTP_USER="username"
export FTP_PASS="password"
export FTP_ROOT="/public_html"
export FTP_PASSIVE="1"
export FTP_TLS="1"
```

## Ausführen

```bash
python scripts/upload_ftp.py
```

## Hinweis

Das Skript uploadet die wichtigsten Dateien aus dem Projektverzeichnis, inklusive der API- und Frontend-Dateien. Für einen echten Produktiv-Upload solltest du zusätzlich die Datenbank- und Serverkonfiguration separat vorbereiten.
