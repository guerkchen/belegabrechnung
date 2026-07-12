<?php
require_once __DIR__ . '/../handlers/receiptHandler.php';

function registerReceiptRoutes(Router $router, PDO $pdo, ?array $user): void
{
    $router->post('/receipts', function (array $params) use ($pdo, $user): void {
        handleCreateReceipt($pdo, $user);
    });

    $router->get('/receipts', function (array $params) use ($pdo, $user): void {
        handleListReceipts($pdo, $user);
    });

    $router->get('/receipts/me', function (array $params) use ($pdo, $user): void {
        handleListMyReceipts($pdo, $user);
    });

    $router->get('/receipts/pending-approval', function (array $params) use ($pdo, $user): void {
        handlePendingApprovalReceipts($pdo, $user);
    });

    $router->get('/receipts/payable', function (array $params) use ($pdo, $user): void {
        handlePayableReceipts($pdo, $user);
    });

    $router->get('/receipts/statistics', function (array $params) use ($pdo, $user): void {
        handleReceiptStatistics($pdo, $user);
    });

    $router->get('/receipts/{id}/history', function (array $params) use ($pdo, $user): void {
        handleReceiptHistory($pdo, $user, $params['id']);
    });

    $router->get('/receipts/{id}', function (array $params) use ($pdo, $user): void {
        handleGetReceipt($pdo, $user, $params['id']);
    });

    $router->put('/receipts/{id}', function (array $params) use ($pdo, $user): void {
        handleUpdateReceipt($pdo, $user, $params['id']);
    });

    $router->delete('/receipts/{id}', function (array $params) use ($pdo, $user): void {
        handleDeleteReceipt($pdo, $user, $params['id']);
    });

    $router->post('/receipts/{id}/approve', function (array $params) use ($pdo, $user): void {
        handleApproveReceipt($pdo, $user, $params['id']);
    });

    $router->post('/receipts/{id}/reject', function (array $params) use ($pdo, $user): void {
        handleRejectReceipt($pdo, $user, $params['id']);
    });

    $router->post('/receipts/{id}/pay', function (array $params) use ($pdo, $user): void {
        handlePayReceipt($pdo, $user, $params['id']);
    });
}
