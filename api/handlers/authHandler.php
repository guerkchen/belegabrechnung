<?php
require_once __DIR__ . '/../microsoft.php';

function handleAuthMe(PDO $pdo, ?array $user): void
{
    if ($user === null) {
        throw new RuntimeException('Authentication required', 401);
    }

    sendJson([
        'user' => [
            'id' => $user['id'],
            'azure_user_id' => $user['azure_user_id'],
            'email' => $user['email'],
            'display_name' => $user['display_name'],
            'role' => $user['role'],
        ],
    ]);
}

function handleAuthLogin(): void
{
    try {
        $url = buildMicrosoftAuthorizationUrl();
        header('Location: ' . $url);
        exit;
    } catch (Throwable $e) {
        sendJson(['error' => 'Login initialization failed: ' . $e->getMessage()], 500);
    }
}

function handleAuthCallback(PDO $pdo): void
{
    try {
        ensureSessionStarted();

        $code = $_GET['code'] ?? '';
        $state = $_GET['state'] ?? '';
        $expectedState = $_SESSION['ms_oauth_state'] ?? '';

        if ($code === '' || $state === '' || $state !== $expectedState) {
            throw new RuntimeException('Invalid Microsoft callback', 400);
        }

        $redirectUri = getAppConfigValue('microsoft_redirect_uri');

        $token = exchangeCodeForToken($code, $redirectUri);
        $profile = getMicrosoftUserInfo($token['access_token']);
        $groups = getMicrosoftGroups($token['access_token']);
        $authenticatedUser = persistOrUpdateMicrosoftUser($pdo, $profile, $groups);
        setAuthenticatedSession($authenticatedUser);

        header('Location: /frontend/index.html?auth=success');
        exit;
    } catch (Throwable $e) {
        sendJson(['error' => 'Authentication failed: ' . $e->getMessage()], 500);
    }
}

function handleAuthLogout(): void
{
    clearAuthenticatedSession();
    sendJson(['message' => 'Logged out']);
}
