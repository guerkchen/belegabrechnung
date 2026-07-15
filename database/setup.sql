-- Skript zur Erstellung der Datenbank und Tabellen für die Belegabrechnung
-- Ausführen mit: mysql -u <user> -p < setup.sql

CREATE DATABASE IF NOT EXISTS belegabrechnung CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE belegabrechnung;

SOURCE database/schema.sql;