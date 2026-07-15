<?php
require __DIR__ . '/config.php';
require __DIR__ . '/router.php';
require __DIR__ . '/handlers/receiptHandler.php';
require __DIR__ . '/routes/auth.php';
require __DIR__ . '/routes/receipts.php';

try {
    $pdo = $GLOBALS['pdo'];

    $method = $_SERVER['REQUEST_METHOD'];
    $requestedPath = $_GET['route'] ?? null;
    if ($requestedPath === null) {
        $requestedPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    }

    $path = is_string($requestedPath) ? $requestedPath : '/';
    $segments = array_values(array_filter(explode('/', trim($path, '/'))));

    if (count($segments) > 0 && $segments[0] === 'api') {
        $segments = array_slice($segments, 1);
    }

    $publicRoutes = ['/auth/login', '/auth/callback', '/auth/logout'];
    $currentPath = '/' . implode('/', $segments);
    $user = in_array($currentPath, $publicRoutes, true) ? null : getAuthenticatedUser($pdo);

    $router = new Router();
    registerAuthRoutes($router, $pdo, $user);
    registerReceiptRoutes($router, $pdo, $user);
    $router->dispatch($method, $segments);
} catch (RuntimeException $e) {
    sendJson(['error' => $e->getMessage()], $e->getCode() ?: 500);
} catch (Throwable $e) {
    sendJson(['error' => $e->getMessage()], 500);
}
