<?php
/**
 * API của ứng dụng kho. Giao diện (index.html) gửi POST JSON: { "fn": "...", "args": [...] }
 *   fn = status | setup | login | logout | api
 */
require __DIR__ . '/lib/kho.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out($x, $code = 200)
{
    http_response_code($code);
    echo json_encode($x, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

// Kiểm tra nhanh máy chủ: /api.php?health=1
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['health'])) {
        out(['ok' => true, 'php' => PHP_VERSION, 'sqlite' => extension_loaded('pdo_sqlite'), 'mbstring' => extension_loaded('mbstring')]);
    }
    out(['ok' => false, 'errors' => ['Chỉ nhận yêu cầu POST.']], 405);
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || !isset($in['fn'])) out(['ok' => false, 'errors' => ['Yêu cầu không hợp lệ.']], 400);

try {
    $app = new App(new Store());
    out($app->call((string)$in['fn'], $in['args'] ?? []));
} catch (Throwable $e) {
    error_log('[kho] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    out(['ok' => false, 'errors' => ['Lỗi máy chủ: ' . $e->getMessage()]], 500);
}
