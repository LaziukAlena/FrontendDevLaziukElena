<?php
// Приём короткой заявки и подробного брифа с сайта, отправка в Telegram.
// Токен и chat_id лежат в brief-config.php (создайте его из brief-config.example.php).
// Файл brief-config.php НЕ должен попадать в git.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $code, array $payload): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// безопасная обрезка (mbstring может быть не установлен)
function cut(string $s, int $max): string
{
    return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
}

// однострочное поле: убираем переводы строк и лишние пробелы
function line(string $key, int $max): string
{
    $v = trim((string)($_POST[$key] ?? ''));
    $v = preg_replace('/\s+/u', ' ', $v) ?? '';
    return cut($v, $max);
}

// многострочное поле
function text(string $key, int $max): string
{
    $v = trim((string)($_POST[$key] ?? ''));
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    $v = preg_replace("/\n{3,}/", "\n\n", $v) ?? '';
    return cut($v, $max);
}

// значение из заранее известного списка (иначе пустая строка)
function choice(string $key, array $allowed): string
{
    $v = trim((string)($_POST[$key] ?? ''));
    return in_array($v, $allowed, true) ? $v : '';
}

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$configFile = __DIR__ . '/brief-config.php';
if (!is_file($configFile)) {
    respond(500, ['ok' => false, 'error' => 'not_configured']);
}
$config = require $configFile;
if (empty($config['token']) || empty($config['chat_id'])) {
    respond(500, ['ok' => false, 'error' => 'not_configured']);
}

// ловушка для ботов: люди скрытое поле не видят и не заполняют
if (trim((string)($_POST['website'] ?? '')) !== '') {
    respond(200, ['ok' => true]); // боту говорим «успех», ничего не отправляя
}

// не больше 5 отправок в час с одного IP
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/brief_rate_' . md5($ip);
$now = time();
$hits = [];
if (is_file($rateFile)) {
    $decoded = json_decode((string)file_get_contents($rateFile), true);
    if (is_array($decoded)) {
        $hits = array_values(array_filter($decoded, static fn($t) => is_int($t) && $now - $t < 3600));
    }
}
if (count($hits) >= 5) {
    respond(429, ['ok' => false, 'error' => 'too_many_requests']);
}

// допустимые значения (должны совпадать с value в разметке форм)
$types = [
    'Сайт на конструкторе (Tilda, WordPress и др.)', 'Лендинг (одностраничный сайт)',
    'Многостраничный / корпоративный сайт', 'Интернет-магазин',
    'Доработка или исправление готового сайта', 'Пока не определился(лась)',
];
$actionsAllowed = [
    'Заявка через форму', 'Звонок', 'Покупка онлайн', 'Запись / бронирование',
    'Просто рассказать о себе или компании', 'Другое',
];
$readiness = ['Есть макет в Figma — нужна верстка', 'Есть готовый сайт — нужны правки', 'Макета пока нет'];
$content   = ['Да, всё готово', 'Частично готово', 'Пока нет'];
$budgets   = ['до 500 BYN', '500–900 BYN', '900–1 400 BYN', '1 400–2 000 BYN', 'от 2 000 BYN', 'Пока не знаю'];
$deadlines = ['Срочно — до 2 недель', 'В течение месяца', 'Не спешу — важнее качество'];
$sources   = [
    'Поиск (Google, Яндекс)', 'Telegram', 'Instagram', 'Рекомендация', 'GitHub',
    'Фриланс-платформа', 'Другое',
];

$isQuick = (($_POST['form'] ?? '') === 'quick'); // короткая заявка или подробный бриф

$name    = line('name', 80);
$contact = line('contact', 120);
$consent = ($_POST['consent'] ?? '') === '1';

// контакт: email, телефон или Telegram — проверяем и на сервере, на клиенте проверку можно обойти
$contactOk = preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $contact) === 1
    || (preg_match('/^[+\d\s().-]+$/', $contact) === 1 && strlen(preg_replace('/\D/', '', $contact) ?? '') >= 7)
    || preg_match('~^(@|https?://t\.me/)?[A-Za-z][A-Za-z0-9_]{4,31}$~', $contact) === 1;

$lang = (($_POST['lang'] ?? '') === 'en') ? 'en' : 'ru';
$row = static fn(string $label, string $value): string =>
    $label . ': <b>' . e($value !== '' ? $value : '—') . '</b>';

if ($isQuick) {
    $task = text('task', 1000);
    if ($name === '' || $task === '' || !$consent || !$contactOk) {
        respond(422, ['ok' => false, 'error' => 'invalid_data']);
    }
    $message = implode("\n", [
        '⚡ <b>Новая заявка с lenacode.by</b>',
        '',
        $row('Имя', $name),
        $row('Контакт', $contact),
        'Что нужно сделать: ' . "\n" . e($task),
        $row('Бюджет', choice('budget', $budgets)),
        '',
        'Язык сайта: ' . $lang,
    ]);
} else {
    $niche = line('niche', 200);
    $info  = text('info', 2000);
    $type  = choice('type', $types);

    $actions = [];
    foreach ((array)($_POST['actions'] ?? []) as $a) {
        if (is_string($a) && in_array($a, $actionsAllowed, true)) {
            $actions[] = $a;
        }
    }

    if ($name === '' || $niche === '' || $type === '' || !$consent || !$contactOk) {
        respond(422, ['ok' => false, 'error' => 'invalid_data']);
    }

    $message = implode("\n", [
        '📝 <b>Новый бриф с lenacode.by</b>',
        '',
        $row('Имя', $name),
        $row('Контакт', $contact),
        '',
        $row('Тип сайта', $type),
        $row('Ниша', $niche),
        'Что разместить: ' . ($info !== '' ? "\n" . e($info) : '<b>—</b>'),
        $row('Целевое действие', implode(', ', $actions)),
        '',
        $row('Готовность', choice('readiness', $readiness)),
        $row('Контент', choice('content', $content)),
        $row('Бюджет', choice('budget', $budgets)),
        $row('Сроки', choice('deadline', $deadlines)),
        $row('Источник', choice('source', $sources)),
        '',
        'Язык сайта: ' . $lang,
    ]);
}

$apiBase = rtrim((string)($config['api_base'] ?? 'https://api.telegram.org'), '/');
$ch = curl_init($apiBase . '/bot' . $config['token'] . '/sendMessage');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'chat_id'                  => $config['chat_id'],
        'text'                     => $message,
        'parse_mode'               => 'HTML',
        'disable_web_page_preview' => 'true',
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
]);
$response = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$decoded = is_string($response) ? json_decode($response, true) : null;
if ($response === false || $status !== 200 || !is_array($decoded) || empty($decoded['ok'])) {
    respond(502, ['ok' => false, 'error' => 'delivery_failed']);
}

// успешная отправка — запоминаем для ограничения частоты
$hits[] = $now;
@file_put_contents($rateFile, json_encode($hits), LOCK_EX);

respond(200, ['ok' => true]);