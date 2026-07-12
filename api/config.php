<?php
require_once __DIR__ . '/secrets.php';

$config = getAppConfig();
$host = $config['db_host'];
$db   = $config['db_name'];
$user = $config['db_user'];
$pass = $config['db_pass'];

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$GLOBALS['pdo'] = $pdo;

function getAuthenticatedUser(PDO $pdo): array {
    require_once __DIR__ . '/microsoft.php';
    ensureSessionStarted();

    $azureUserId = $_SESSION['azure_user_id'] ?? null;
    if (!$azureUserId) {
        throw new RuntimeException('Authentication required', 401);
    }

    $stmt = $pdo->prepare('SELECT id, azure_user_id, email, display_name, role FROM users WHERE azure_user_id = :azure_user_id AND is_active = 1');
    $stmt->execute([':azure_user_id' => $azureUserId]);
    $user = $stmt->fetch();

    if (!$user) {
        throw new RuntimeException('User not found', 404);
    }

    return $user;
}

function canAccessReceipt(array $user, array $receipt): bool {
    if ($user['role'] === 'freigeber' || $user['role'] === 'kassenwart') {
        return true;
    }

    return (int)$receipt['user_id'] === (int)$user['id'];
}

function requireRole(array $user, array $roles): void {
    if (!in_array($user['role'], $roles, true)) {
        throw new RuntimeException('Forbidden', 403);
    }
}

function sendJson($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}

function parseJsonBody(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid JSON body', 400);
    }

    return $decoded;
}

function normalizeStatus(string $status): string {
    $allowed = ['zur_Freigabe', 'Freigegeben', 'Abgelehnt', 'Ausgezahlt'];
    if (!in_array($status, $allowed, true)) {
        throw new RuntimeException('Invalid status', 400);
    }

    return $status;
}

function appendHistory(PDO $pdo, int $receiptId, ?string $oldStatus, string $newStatus, int $userId, ?string $comment = null): void {
    $stmt = $pdo->prepare('INSERT INTO receipt_status_history (receipt_id, old_status, new_status, changed_by_user_id, comment) VALUES (:receipt_id, :old_status, :new_status, :changed_by_user_id, :comment)');
    $stmt->execute([
        ':receipt_id' => $receiptId,
        ':old_status' => $oldStatus,
        ':new_status' => $newStatus,
        ':changed_by_user_id' => $userId,
        ':comment' => $comment,
    ]);
}

function saveUploadedFile(array $file): array {
    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        throw new RuntimeException('No valid uploaded file', 400);
    }

    $uploadDir = __DIR__ . '/uploads';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $originalName = basename($file['name']);
    $safeName = uniqid('receipt_', true) . '_' . str_replace([' ', '/'], '_', $originalName);
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $safeName = 'receipt_' . bin2hex(random_bytes(32));
    if ($extension) {
        $safeName .= '.' . $extension;
    }
    $targetPath = $uploadDir . '/' . $safeName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        throw new RuntimeException('Could not save uploaded file', 500);
    }

    return [
        'file_name' => $safeName,
        'file_path' => $targetPath,
        'mime_type' => $file['type'] ?: 'application/pdf',
    ];
}
