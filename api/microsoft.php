<?php

function ensureSessionStarted(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        ini_set( 'session.cookie_httponly', 1 );
        session_start();
    }
}

function getMicrosoftConfig(): array
{
    $config = getAppConfig();

    return [
        'tenant' => $config['microsoft_tenant_id'],
        'client_id' => $config['microsoft_client_id'],
        'client_secret' => $config['microsoft_client_secret'],
        'redirect_uri' => $config['microsoft_redirect_uri'],
        'role_map' => $config['microsoft_group_role_map'],
    ];
}

function buildMicrosoftAuthorizationUrl(): string
{
    ensureSessionStarted();

    $config = getMicrosoftConfig();
    $state = bin2hex(random_bytes(16));
    $_SESSION['ms_oauth_state'] = $state;

    $params = [
        'client_id' => $config['client_id'],
        'response_type' => 'code',
        'redirect_uri' => $config['redirect_uri'],
        'response_mode' => 'query',
        'scope' => 'openid profile email User.Read GroupMember.Read.All',
        'state' => $state,
        'prompt' => 'select_account',
    ];

    return 'https://login.microsoftonline.com/' . rawurlencode($config['tenant']) . '/oauth2/v2.0/authorize?' . http_build_query($params);
}

function exchangeCodeForToken(string $code, string $redirectUri): array
{
    $config = getMicrosoftConfig();
    $tokenUrl = 'https://login.microsoftonline.com/' . rawurlencode($config['tenant']) . '/oauth2/v2.0/token';

    $payload = [
        'client_id' => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'code' => $code,
        'redirect_uri' => $redirectUri,
        'grant_type' => 'authorization_code',
    ];

    $response = sendHttpRequest($tokenUrl, $payload, 'POST');
    if (!isset($response['access_token'])) {
        throw new RuntimeException('Microsoft token exchange failed', 400);
    }

    return $response;
}

function getMicrosoftUserInfo(string $accessToken): array
{
    $userUrl = 'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName';
    $response = sendHttpRequest($userUrl, [], 'GET', [
        'Authorization: Bearer ' . $accessToken,
    ]);

    if (!isset($response['id'])) {
        throw new RuntimeException('Could not load Microsoft profile', 400);
    }

    return $response;
}

function getMicrosoftGroups(string $accessToken): array
{
    $groupsUrl = 'https://graph.microsoft.com/v1.0/me/transitiveMemberOf/microsoft.graph.group?$select=id,displayName,mail';
    $response = sendHttpRequest($groupsUrl, [], 'GET', [
        'Authorization: Bearer ' . $accessToken,
    ]);

    if (!isset($response['value']) || !is_array($response['value'])) {
        return [];
    }

    return $response['value'];
}

function resolveRoleFromGroups(array $groups): string
{
    $config = getMicrosoftConfig();
    $roleMap = array_filter(array_map('trim', explode(',', $config['role_map'])));

    foreach ($roleMap as $entry) {
        if ($entry === '') {
            continue;
        }

        [$groupName, $role] = array_pad(explode('=', $entry, 2), 2, '');
        $groupName = trim($groupName);
        $role = trim($role);
        if ($groupName === '' || $role === '') {
            continue;
        }

        foreach ($groups as $group) {
            $groupDisplayName = $group['displayName'] ?? '';
            $groupMail = $group['mail'] ?? '';
            if ($groupDisplayName === $groupName || $groupMail === $groupName) {
                return $role;
            }
        }
    }

    return 'user';
}

function persistOrUpdateMicrosoftUser(PDO $pdo, array $profile, array $groups): array
{
    $azureUserId = (string)($profile['id'] ?? '');
    if ($azureUserId === '') {
        throw new RuntimeException('Microsoft user id missing', 400);
    }

    $email = (string)($profile['mail'] ?? $profile['userPrincipalName'] ?? '');
    $displayName = (string)($profile['displayName'] ?? $email);
    $role = resolveRoleFromGroups($groups);

    $stmt = $pdo->prepare('INSERT INTO users (azure_user_id, email, display_name, role, is_active) VALUES (:azure_user_id, :email, :display_name, :role, 1) ON DUPLICATE KEY UPDATE email = VALUES(email), display_name = VALUES(display_name), role = VALUES(role), is_active = 1');
    $stmt->execute([
        ':azure_user_id' => $azureUserId,
        ':email' => $email,
        ':display_name' => $displayName,
        ':role' => $role,
    ]);

    $userStmt = $pdo->prepare('SELECT id, azure_user_id, email, display_name, role FROM users WHERE azure_user_id = :azure_user_id AND is_active = 1');
    $userStmt->execute([':azure_user_id' => $azureUserId]);
    $user = $userStmt->fetch();

    if (!$user) {
        throw new RuntimeException('User could not be loaded after login', 500);
    }

    return $user;
}

function setAuthenticatedSession(array $user): void
{
    ensureSessionStarted();
    $_SESSION['azure_user_id'] = $user['azure_user_id'];
    $_SESSION['user_id'] = $user['id'];
}

function clearAuthenticatedSession(): void
{
    ensureSessionStarted();
    unset($_SESSION['azure_user_id'], $_SESSION['user_id'], $_SESSION['ms_oauth_state']);
}

function sendHttpRequest(string $url, array $data = [], string $method = 'POST', array $headers = []): array
{
    $options = [
        'http' => [
            'method' => $method,
            'ignore_errors' => true,
            'header' => [],
        ],
    ];

    if ($headers !== []) {
        $options['http']['header'] = $headers;
    }

    if ($method === 'POST' && $data !== []) {
        $options['http']['content'] = http_build_query($data);
        $options['http']['header'][] = 'Content-Type: application/x-www-form-urlencoded';
    }

    $context = stream_context_create($options);
    $responseBody = @file_get_contents($url, false, $context);
    if ($responseBody === false) {
        throw new RuntimeException('Microsoft request failed', 502);
    }

    $decoded = json_decode($responseBody, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid response from Microsoft', 502);
    }

    return $decoded;
}
