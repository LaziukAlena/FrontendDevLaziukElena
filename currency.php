<?php
// Определяет страну посетителя и подсказывает, в какой валюте показывать цены:
//   Беларусь → BYN, Россия → RUB, остальные страны → USD.
// ЛЮБАЯ неопределённость (нет данных, ошибка, служебный IP) → BYN: это безопасный вариант.
// IP-адрес посетителя не записывается: в кэше хранится только хэш и страна.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(string $country): void
{
    $country = strtoupper($country);
    $valid = preg_match('/^[A-Z]{2}$/', $country) === 1 && !in_array($country, ['XX', 'T1', 'ZZ'], true);
    if (!$valid) {
        $currency = 'BYN';
        $country = '';
    } elseif ($country === 'BY') {
        $currency = 'BYN';
    } elseif ($country === 'RU') {
        $currency = 'RUB';
    } else {
        $currency = 'USD';
    }
    echo json_encode(['currency' => $currency, 'country' => $country], JSON_UNESCAPED_UNICODE);
    exit;
}

// 1) Страну уже определил CDN или веб-сервер (Cloudflare, mod_geoip)
foreach (['HTTP_CF_IPCOUNTRY', 'GEOIP_COUNTRY_CODE'] as $key) {
    if (!empty($_SERVER[$key])) {
        respond((string)$_SERVER[$key]);
    }
}

// 2) Определяем по IP. Служебные и локальные адреса не проверяем → BYN
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
    respond('');
}

$config = [];
$configFile = __DIR__ . '/brief-config.php';
if (is_file($configFile)) {
    $loaded = require $configFile;
    if (is_array($loaded)) {
        $config = $loaded;
    }
}
$api = $config['geo_api'] ?? 'https://api.country.is';
if ($api === false || $api === '') {
    respond(''); // сторонний сервис отключён в настройках
}

// кэш на 24 часа, чтобы не запрашивать сервис при каждом визите
$cacheFile = sys_get_temp_dir() . '/currency_geo_' . hash('sha256', 'lenacode|' . $ip);
if (is_file($cacheFile) && time() - (int)filemtime($cacheFile) < 86400) {
    respond((string)file_get_contents($cacheFile));
}

$ch = curl_init(rtrim((string)$api, '/') . '/' . rawurlencode($ip));
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 2,
    CURLOPT_TIMEOUT        => 3,
]);
$response = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$country = '';
if (is_string($response) && $status === 200) {
    $decoded = json_decode($response, true);
    if (is_array($decoded) && isset($decoded['country']) && is_string($decoded['country'])) {
        $country = $decoded['country'];
    }
}
if (preg_match('/^[A-Za-z]{2}$/', $country) === 1) {
    @file_put_contents($cacheFile, strtoupper($country), LOCK_EX);
}
respond($country);