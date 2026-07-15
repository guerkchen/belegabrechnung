#!/usr/bin/env python3
import os
import ssl
import ftplib
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# .env aus dem Projektverzeichnis laden
load_dotenv(PROJECT_ROOT / ".env")

FTP_HOST = os.getenv("FTP_HOST")
FTP_PORT = int(os.getenv("FTP_PORT"))
FTP_USER = os.getenv("FTP_USER")
FTP_PASS = os.getenv("FTP_PASS")
FTP_ROOT = os.getenv("FTP_ROOT")
FTP_PASSIVE = os.getenv("FTP_PASSIVE").lower() in {"1", "true", "yes", "on"}
FTP_TLS = os.getenv("FTP_TLS").lower() in {"1", "true", "yes", "on"}

FILES_TO_UPLOAD = [
    "api/config.php",
    "api/index.php",
    "api/router.php",
    "api/microsoft.php",
    #"api/secrets.php",
    "api/handlers/authHandler.php",
    "api/handlers/receiptHandler.php",
    "api/routes/auth.php",
    "api/routes/receipts.php",
    "frontend/index.html",
    "database/schema.sql",
    "database/setup.sql",
    "api/.htaccess",
]

UPLOAD_TARGETS = {
    "frontend/index.html": "frontend/index.html",
    "api/config.php": "api/config.php",
    "api/index.php": "api/index.php",
    "api/router.php": "api/router.php",
    #"api/secrets.php": "api/secrets.php",
    "api/handlers/authHandler.php": "api/handlers/authHandler.php",
    "api/handlers/receiptHandler.php": "api/handlers/receiptHandler.php",
    "api/routes/auth.php": "api/routes/auth.php",
    "api/routes/receipts.php": "api/routes/receipts.php",
    "database/schema.sql": "database/schema.sql",
    "database/setup.sql": "database/setup.sql",
    "api/.htaccess": "api/.htaccess",
}

DIRECTORIES_TO_CREATE = [
    "api/handlers",
    "api/routes",
    "api/uploads",
    "frontend",
    "database",
]


def ensure_directory_exists(ftp: ftplib.FTP, remote_dir: str) -> None:
    parts = [part for part in remote_dir.strip("/").split("/") if part]
    ftp.cwd(FTP_ROOT)

    for part in parts:
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)

    ftp.cwd(FTP_ROOT)


def upload_file(ftp: ftplib.FTP, local_path: Path, remote_path: str) -> None:
    remote_dir = str(Path(remote_path).parent)
    if remote_dir not in {".", ""}:
        ensure_directory_exists(ftp, remote_dir)

    ftp.cwd(FTP_ROOT)
    with local_path.open("rb") as handle:
        ftp.storbinary(f"STOR {remote_path}", handle)

    print(f"Uploaded: {local_path.relative_to(PROJECT_ROOT)} -> {remote_path}")


def main() -> None:
    ftp = ftplib.FTP_TLS() if FTP_TLS else ftplib.FTP()
    ftp.connect(FTP_HOST, FTP_PORT, timeout=10)

    if FTP_TLS:
        ftp.ssl_version = ssl.PROTOCOL_TLS_CLIENT
        ftp.auth()
        ftp.prot_p()

    ftp.login(FTP_USER, FTP_PASS)
    if FTP_PASSIVE:
        ftp.set_pasv(True)

    try:
        ftp.cwd(FTP_ROOT)
    except ftplib.error_perm:
        print(f"FTP root does not exist: {FTP_ROOT}")
        ftp.quit()
        raise SystemExit(1)

    for directory in DIRECTORIES_TO_CREATE:
        try:
            ensure_directory_exists(ftp, directory)
        except Exception as exc:  # noqa: BLE001
            print(f"Warning: could not create directory {directory}: {exc}")

    for relative_path in FILES_TO_UPLOAD:
        local_path = PROJECT_ROOT / relative_path
        if not local_path.exists():
            print(f"Skipping missing file: {relative_path}")
            continue
        remote_target = UPLOAD_TARGETS.get(relative_path, relative_path)
        upload_file(ftp, local_path, remote_target)

    print("Upload completed successfully.")
    ftp.quit()


if __name__ == "__main__":
    main()
