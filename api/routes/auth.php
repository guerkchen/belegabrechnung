<?php
require_once __DIR__ . '/../handlers/authHandler.php';

function registerAuthRoutes(Router $router, PDO $pdo, ?array $user): void
{
    $router->get('/auth/me', function (array $params) use ($pdo, $user): void {
        handleAuthMe($pdo, $user);
    });

    $router->get('/auth/login', function (array $params) use ($pdo): void {
        handleAuthLogin();
    });

    $router->get('/auth/callback', function (array $params) use ($pdo): void {
        handleAuthCallback($pdo);
    });

    $router->post('/auth/logout', function (array $params): void {
        handleAuthLogout();
    });
}
