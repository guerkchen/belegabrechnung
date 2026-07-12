<?php

function handleCreateReceipt(PDO $pdo, array $user): void
{
    requireRole($user, ['user', 'freigeber', 'kassenwart']);

    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
        throw new RuntimeException('File upload required', 400);
    }

    $body = parseJsonBody();
    $description = trim((string)($_POST['description'] ?? $body['description'] ?? ''));
    $amount = (string)($_POST['amount'] ?? $body['amount'] ?? '');
    $receiptDate = (string)($_POST['receipt_date'] ?? $body['receipt_date'] ?? '');

    if ($description === '' || $amount === '' || $receiptDate === '') {
        throw new RuntimeException('description, amount and receipt_date are required', 400);
    }

    $fileInput = $_FILES['file'] ?? null;
    if (!$fileInput) {
        throw new RuntimeException('File upload required', 400);
    }

    $fileData = saveUploadedFile($fileInput);

    $stmt = $pdo->prepare('INSERT INTO receipts (user_id, description, amount_euro, receipt_date, file_name, file_path, mime_type, status) VALUES (:user_id, :description, :amount_euro, :receipt_date, :file_name, :file_path, :mime_type, :status)');
    $stmt->execute([
        ':user_id' => $user['id'],
        ':description' => $description,
        ':amount_euro' => $amount,
        ':receipt_date' => $receiptDate,
        ':file_name' => $fileData['file_name'],
        ':file_path' => $fileData['file_path'],
        ':mime_type' => $fileData['mime_type'],
        ':status' => 'zur_Freigabe',
    ]);

    $receiptId = (int)$pdo->lastInsertId();
    appendHistory($pdo, $receiptId, null, 'zur_Freigabe', $user['id'], 'Submitted');

    sendJson(['message' => 'Receipt submitted successfully', 'receipt_id' => $receiptId], 201);
}

function handleListReceipts(PDO $pdo, array $user): void
{
    requireRole($user, ['user', 'freigeber', 'kassenwart']);

    $from = $_GET['from'] ?? null;
    $to = $_GET['to'] ?? null;
    $status = $_GET['status'] ?? null;

    $query = 'SELECT * FROM receipts';
    $conditions = [];
    $paramsDb = [];

    if ($user['role'] === 'user') {
        $conditions[] = 'user_id = :user_id';
        $paramsDb[':user_id'] = $user['id'];
    }

    if ($from) {
        $conditions[] = 'receipt_date >= :from';
        $paramsDb[':from'] = $from;
    }

    if ($to) {
        $conditions[] = 'receipt_date <= :to';
        $paramsDb[':to'] = $to;
    }

    if ($status) {
        $conditions[] = 'status = :status';
        $paramsDb[':status'] = normalizeStatus($status);
    }

    if ($conditions) {
        $query .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $query .= ' ORDER BY created_at DESC';

    $stmt = $pdo->prepare($query);
    $stmt->execute($paramsDb);
    $receipts = $stmt->fetchAll();

    sendJson(['receipts' => $receipts]);
}

function handleListMyReceipts(PDO $pdo, array $user): void
{
    requireRole($user, ['user', 'freigeber', 'kassenwart']);
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE user_id = :user_id ORDER BY created_at DESC');
    $stmt->execute([':user_id' => $user['id']]);
    sendJson(['receipts' => $stmt->fetchAll()]);
}

function handlePendingApprovalReceipts(PDO $pdo, array $user): void
{
    requireRole($user, ['freigeber']);
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE status = :status ORDER BY created_at DESC');
    $stmt->execute([':status' => 'zur_Freigabe']);
    sendJson(['receipts' => $stmt->fetchAll()]);
}

function handlePayableReceipts(PDO $pdo, array $user): void
{
    requireRole($user, ['kassenwart']);
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE status = :status ORDER BY created_at DESC');
    $stmt->execute([':status' => 'Freigegeben']);
    sendJson(['receipts' => $stmt->fetchAll()]);
}

function handleReceiptStatistics(PDO $pdo, array $user): void
{
    requireRole($user, ['user', 'freigeber', 'kassenwart']);
    $where = '';
    $paramsDb = [];
    if ($user['role'] === 'user') {
        $where = ' WHERE user_id = :user_id';
        $paramsDb[':user_id'] = $user['id'];
    }
    $stmt = $pdo->prepare('SELECT status, COUNT(*) as count FROM receipts' . $where . ' GROUP BY status');
    $stmt->execute($paramsDb);
    sendJson(['statistics' => $stmt->fetchAll()]);
}

function handleReceiptHistory(PDO $pdo, array $user, string $receiptId): void
{
    $receiptIdInt = (int)$receiptId;
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE id = :id');
    $stmt->execute([':id' => $receiptIdInt]);
    $receipt = $stmt->fetch();
    if (!$receipt) {
        throw new RuntimeException('Receipt not found', 404);
    }
    if (!canAccessReceipt($user, $receipt)) {
        throw new RuntimeException('Forbidden', 403);
    }

    $historyStmt = $pdo->prepare('SELECT * FROM receipt_status_history WHERE receipt_id = :receipt_id ORDER BY changed_at ASC');
    $historyStmt->execute([':receipt_id' => $receiptIdInt]);
    sendJson(['receipt' => $receipt, 'history' => $historyStmt->fetchAll()]);
}

function handleGetReceipt(PDO $pdo, array $user, string $receiptId): void
{
    $receiptIdInt = (int)$receiptId;
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE id = :id');
    $stmt->execute([':id' => $receiptIdInt]);
    $receipt = $stmt->fetch();
    if (!$receipt) {
        throw new RuntimeException('Receipt not found', 404);
    }
    if (!canAccessReceipt($user, $receipt)) {
        throw new RuntimeException('Forbidden', 403);
    }
    sendJson(['receipt' => $receipt]);
}

function handleUpdateReceipt(PDO $pdo, array $user, string $receiptId): void
{
    $receiptIdInt = (int)$receiptId;
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE id = :id');
    $stmt->execute([':id' => $receiptIdInt]);
    $receipt = $stmt->fetch();
    if (!$receipt) {
        throw new RuntimeException('Receipt not found', 404);
    }
    if ((int)$receipt['user_id'] !== (int)$user['id']) {
        throw new RuntimeException('Forbidden', 403);
    }
    if ($receipt['status'] === 'Freigegeben' || $receipt['status'] === 'Abgelehnt' || $receipt['status'] === 'Ausgezahlt') {
        throw new RuntimeException('Receipt can no longer be edited', 400);
    }

    $body = parseJsonBody();
    $description = trim((string)($body['description'] ?? ''));
    $amount = (string)($body['amount'] ?? '');
    $receiptDate = (string)($body['receipt_date'] ?? '');

    if ($description === '' || $amount === '' || $receiptDate === '') {
        throw new RuntimeException('description, amount and receipt_date are required', 400);
    }

    $stmt = $pdo->prepare('UPDATE receipts SET description = :description, amount_euro = :amount_euro, receipt_date = :receipt_date WHERE id = :id');
    $stmt->execute([
        ':description' => $description,
        ':amount_euro' => $amount,
        ':receipt_date' => $receiptDate,
        ':id' => $receiptIdInt,
    ]);

    sendJson(['message' => 'Receipt updated successfully']);
}

function handleDeleteReceipt(PDO $pdo, array $user, string $receiptId): void
{
    $receiptIdInt = (int)$receiptId;
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE id = :id');
    $stmt->execute([':id' => $receiptIdInt]);
    $receipt = $stmt->fetch();
    if (!$receipt) {
        throw new RuntimeException('Receipt not found', 404);
    }
    if ((int)$receipt['user_id'] !== (int)$user['id']) {
        throw new RuntimeException('Forbidden', 403);
    }
    if ($receipt['status'] === 'Freigegeben' || $receipt['status'] === 'Abgelehnt' || $receipt['status'] === 'Ausgezahlt') {
        throw new RuntimeException('Receipt can no longer be deleted', 400);
    }

    $pdo->prepare('DELETE FROM receipts WHERE id = :id')->execute([':id' => $receiptIdInt]);
    sendJson(['message' => 'Receipt deleted successfully']);
}

function handleApproveReceipt(PDO $pdo, array $user, string $receiptId): void
{
    requireRole($user, ['freigeber']);
    $receiptIdInt = (int)$receiptId;
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE id = :id');
    $stmt->execute([':id' => $receiptIdInt]);
    $receipt = $stmt->fetch();
    if (!$receipt) {
        throw new RuntimeException('Receipt not found', 404);
    }
    if ($receipt['status'] !== 'zur_Freigabe') {
        throw new RuntimeException('Receipt is not pending approval', 400);
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('UPDATE receipts SET status = :status, approved_at = NOW(), approved_by_user_id = :user_id WHERE id = :id');
    $stmt->execute([':status' => 'Freigegeben', ':user_id' => $user['id'], ':id' => $receiptIdInt]);
    appendHistory($pdo, $receiptIdInt, $receipt['status'], 'Freigegeben', $user['id'], 'Approved');
    $pdo->commit();

    sendJson(['message' => 'Receipt approved successfully']);
}

function handleRejectReceipt(PDO $pdo, array $user, string $receiptId): void
{
    requireRole($user, ['freigeber']);
    $receiptIdInt = (int)$receiptId;
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE id = :id');
    $stmt->execute([':id' => $receiptIdInt]);
    $receipt = $stmt->fetch();
    if (!$receipt) {
        throw new RuntimeException('Receipt not found', 404);
    }
    if ($receipt['status'] !== 'zur_Freigabe') {
        throw new RuntimeException('Receipt is not pending approval', 400);
    }

    $body = parseJsonBody();
    $comment = trim((string)($body['comment'] ?? ''));

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('UPDATE receipts SET status = :status, rejected_at = NOW(), rejected_by_user_id = :user_id WHERE id = :id');
    $stmt->execute([':status' => 'Abgelehnt', ':user_id' => $user['id'], ':id' => $receiptIdInt]);
    appendHistory($pdo, $receiptIdInt, $receipt['status'], 'Abgelehnt', $user['id'], $comment !== '' ? $comment : 'Rejected');
    $pdo->commit();

    sendJson(['message' => 'Receipt rejected successfully']);
}

function handlePayReceipt(PDO $pdo, array $user, string $receiptId): void
{
    requireRole($user, ['kassenwart']);
    $receiptIdInt = (int)$receiptId;
    $stmt = $pdo->prepare('SELECT * FROM receipts WHERE id = :id');
    $stmt->execute([':id' => $receiptIdInt]);
    $receipt = $stmt->fetch();
    if (!$receipt) {
        throw new RuntimeException('Receipt not found', 404);
    }
    if ($receipt['status'] !== 'Freigegeben') {
        throw new RuntimeException('Receipt is not ready for payout', 400);
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('UPDATE receipts SET status = :status, paid_at = NOW(), paid_by_user_id = :user_id WHERE id = :id');
    $stmt->execute([':status' => 'Ausgezahlt', ':user_id' => $user['id'], ':id' => $receiptIdInt]);
    appendHistory($pdo, $receiptIdInt, $receipt['status'], 'Ausgezahlt', $user['id'], 'Paid');
    $pdo->commit();

    sendJson(['message' => 'Receipt paid successfully']);
}
