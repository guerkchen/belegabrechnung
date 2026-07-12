#!/usr/bin/env python3

import os
import subprocess
from pathlib import Path

from dotenv import load_dotenv

# .env laden
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

host = os.getenv("MYSQL_HOST", "localhost")
port = os.getenv("MYSQL_PORT", "3306")
user = os.getenv("MYSQL_USER")
password = os.getenv("MYSQL_PASSWORD")
database = os.getenv("MYSQL_DATABASE")
sql_file = os.getenv("SQL_FILE", "database/setup.sql")

if not all([user, password, database]):
    raise RuntimeError("MYSQL_USER, MYSQL_PASSWORD und MYSQL_DATABASE müssen gesetzt sein")

sql_path = PROJECT_ROOT / sql_file

if not sql_path.exists():
    raise FileNotFoundError(f"SQL-Datei nicht gefunden: {sql_path}")

cmd = [
    "mysql",
    "-h", host,
    "-P", port,
    "-u", user,
    f"-p{password}",
    database
]

print(f"Importiere {sql_file} in Datenbank {database}...")

with sql_path.open("r", encoding="utf-8") as sql:
    subprocess.run(
        cmd,
        stdin=sql,
        check=True
    )

print("Datenbank-Import erfolgreich abgeschlossen.")