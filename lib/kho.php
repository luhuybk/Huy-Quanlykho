<?php
/**
 * KHO KÝ GỬI — máy chủ PHP + SQLite (chạy trên Hostinger hoặc bất kỳ hosting PHP nào).
 *
 * Nghiệp vụ và phân quyền giống hệt core.js (bản dùng ở giao diện). Máy chủ là nơi quyết định cuối cùng:
 * mọi thao tác ghi đều được kiểm tra quyền + dữ liệu ở đây.
 */

date_default_timezone_set('Asia/Ho_Chi_Minh');

// ===================== HẰNG SỐ =====================

const L_NHAP = 'Nhập';
const L_XUAT = 'Xuất';
const L_CHUYEN_DI = 'Chuyển đi';
const L_CHUYEN_DEN = 'Chuyển đến';
const L_TON_DAU = 'Tồn đầu';
const L_DIEU_CHINH = 'Điều chỉnh';

// Cột của 1 dòng Sổ Kho (giống core.js)
const C_ID = 0, C_NGAY = 1, C_LOAI = 2, C_KHO = 3, C_TEN = 4, C_THUNG = 5, C_LE = 6, C_DV = 7, C_SL = 8,
  C_DOITUONG = 9, C_GHICHU = 10, C_NGUOI = 11, C_TAO = 12, C_SUA = 13;

final class K
{
    const KIND = ['NK' => 'NHAP', 'XK' => 'XUAT', 'CK' => 'CHUYEN', 'TD' => 'TONDAU', 'DC' => 'DIEUCHINH'];
    const KIND_LABEL = ['NHAP' => 'Nhập kho', 'XUAT' => 'Xuất kho', 'CHUYEN' => 'Chuyển kho', 'TONDAU' => 'Tồn đầu', 'DIEUCHINH' => 'Điều chỉnh', 'KIEMKE' => 'Kiểm kê'];
    const ROLES = ['admin' => 'Quản trị', 'nhanvien' => 'Nhân viên', 'xem' => 'Đối tác (chỉ xem)'];
    const ACL = [
        'data' => ['admin', 'nhanvien', 'xem'],
        'changePassword' => ['admin', 'nhanvien', 'xem'],
        'savePhieu' => ['admin', 'nhanvien'],
        'saveCost' => ['admin', 'nhanvien'],
        'deletePhieu' => ['admin'], 'deleteCost' => ['admin'],
        'saveProduct' => ['admin'], 'deleteProduct' => ['admin'],
        'saveSettings' => ['admin'],
        'listUsers' => ['admin'], 'saveUser' => ['admin'], 'deleteUser' => ['admin'],
        'listLog' => ['admin'], 'saveChot' => ['admin'], 'deleteChot' => ['admin'], 'postFees' => ['admin'],
        'importData' => ['admin'], 'backup' => ['admin'], 'restore' => ['admin'],
    ];
    const READ_ONLY = ['data' => 1, 'listUsers' => 1, 'listLog' => 1, 'backup' => 1];
    const FEE_TYPES = ['store' => 'Phí lưu kho', 'inn' => 'Phí nhập hàng', 'out' => 'Phí xuất hàng'];
    const FIXED_SAMPLE = [['loai' => 'Tiền Rinh Hàng', 'amount' => 2000000, 'note' => ''], ['loai' => 'Quỹ Dự Phòng', 'amount' => 2000000, 'note' => '']];
    const DEFAULT_COST_TYPES = ['Phí Ship Hà Nội - > TPHCM', 'Phí Ship nội vùng TPHCM', 'Quỹ Dự Phòng', 'Tiền Rinh Hàng', 'Mua sắm', 'Ngoài luồng'];
    const DEFAULT_UNITS = ['lẻ', 'chai', 'cái', 'hộp', 'tuýp', 'gói'];
    const PREFIX_BY_TYPE = ['NHAP' => 'NK', 'XUAT' => 'XK', 'CHUYEN' => 'CK', 'KIEMKE' => 'DC'];
}

// ===================== SỐ & ĐỊNH DẠNG (giống JavaScript) =====================

function k_round($x) { $v = floor(((float)$x) * 10000 + 0.5) / 10000; return $v == 0 ? 0.0 : $v; }
function k_jsround($x) { $v = floor((float)$x + 0.5); return $v == 0 ? 0.0 : $v; }
function k_num($v)
{
    if ($v === '' || $v === null) return 0.0;
    if (is_bool($v)) return $v ? 1.0 : 0.0;
    if (is_int($v) || is_float($v)) return (float)$v;
    if (!is_string($v)) return 0.0;
    $s = trim(preg_replace('/,/', '.', $v, 1));
    return is_numeric($s) ? (float)$s : 0.0;
}
function k_blank($v) { return $v === '' || $v === null; }
function k_str($v)
{
    if ($v === null) return '';
    if (is_bool($v)) return $v ? 'true' : 'false';
    if (is_float($v)) return k_numstr($v);
    if (is_array($v)) return '';
    return trim((string)$v);
}
/** Số → chữ như JavaScript (12 → "12", 1.5 → "1.5") */
function k_numstr($x)
{
    $x = (float)$x;
    if ($x == floor($x) && abs($x) < 1e15) return (string)(int)$x;
    return rtrim(rtrim(sprintf('%.10F', $x), '0'), '.');
}
/** Giống !!x trong JavaScript */
function k_truthy($v) { return !($v === false || $v === null || $v === '' || $v === 0 || $v === 0.0); }
function k_len($s) { return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s); }

function k_toUnits($thung, $le, $per) { $p = k_num($per); return k_round(k_num($thung) * ($p ?: 1) + k_num($le)); }
function k_split($units, $per)
{
    $per = k_num($per) ?: 1;
    $sign = $units < 0 ? -1 : 1;
    $abs = abs(k_round($units));
    $thung = floor(k_round($abs / $per));
    $le = k_round($abs - $thung * $per);
    $t = $sign * $thung; $l = $sign * $le;
    return ['thung' => $t == 0 ? 0.0 : $t, 'le' => $l == 0 ? 0.0 : $l];
}
function k_fmtThung($units, $per, $unit = 'lẻ')
{
    $units = k_round($units);
    if ($units == 0) return '0';
    $s = k_split($units, $per);
    $parts = [];
    if ($s['thung']) $parts[] = k_numstr(abs($s['thung'])) . ' thùng';
    if ($s['le']) $parts[] = k_numstr(abs($s['le'])) . ' ' . ($unit ?: 'lẻ');
    return ($units < 0 ? '-' : '') . implode(' + ', $parts);
}
function k_fmtMoney($n)
{
    $n = k_jsround(k_num($n));
    return ($n < 0 ? '-' : '') . number_format(abs($n), 0, '', '.') . 'đ';
}
function k_vnNum($x) { return str_replace('.', ',', k_numstr(k_round($x))); }
function k_isYmd($s) { return is_string($s) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s); }

function k_delta($loai, $sl)
{
    $sl = k_num($sl);
    if ($loai === L_NHAP || $loai === L_CHUYEN_DEN) return abs($sl);
    if ($loai === L_XUAT || $loai === L_CHUYEN_DI) return -abs($sl);
    if ($loai === L_TON_DAU || $loai === L_DIEU_CHINH) return $sl;
    return 0.0;
}
function k_kindOfId($id) { $p = substr((string)$id, 0, 2); return K::KIND[$p] ?? 'KHAC'; }

// ===================== SỔ KHO =====================

function k_pmap($products) { $m = []; foreach ($products as $p) $m[$p['name']] = $p; return $m; }

function k_parseLedger($rows, $pmap)
{
    $out = [];
    foreach (array_values($rows) as $i => $r) {
        $name = k_str($r[C_TEN] ?? '');
        if ($name === '' || !($r[C_LOAI] ?? '')) continue;
        $p = $pmap[$name] ?? null;
        $per = ($p ? k_num($p['per']) : 0) ?: (k_num($r[C_DV] ?? '') ?: 1);
        $units = !k_blank($r[C_SL] ?? '') ? k_round(k_num($r[C_SL])) : k_toUnits($r[C_THUNG] ?? '', $r[C_LE] ?? '', k_num($r[C_DV] ?? '') ?: $per);
        $loai = k_str($r[C_LOAI]);
        $out[] = ['idx' => $i, 'id' => k_str($r[C_ID]), 'date' => k_str($r[C_NGAY]), 'loai' => $loai, 'kho' => k_str($r[C_KHO]), 'name' => $name,
            'per' => $per, 'unit' => ($p && $p['unit']) ? $p['unit'] : 'lẻ', 'units' => $units, 'delta' => k_delta($loai, $units)];
    }
    return $out;
}

function k_stock($tx)
{
    $st = [];
    foreach ($tx as $t) $st[$t['name']][$t['kho']] = k_round(($st[$t['name']][$t['kho']] ?? 0) + $t['delta']);
    return $st;
}
function k_stockAt($st, $name, $kho) { return $st[$name][$kho] ?? 0.0; }

function k_validatePhieu($p, $pmap, $khos, $stock, $allowNegative)
{
    $errs = [];
    $type = $p['type'] ?? '';
    if (!in_array($type, ['NHAP', 'XUAT', 'CHUYEN', 'KIEMKE'], true)) $errs[] = 'Loại phiếu không hợp lệ.';
    if (!k_isYmd($p['date'] ?? '')) $errs[] = 'Chưa chọn ngày.';
    $kho = $p['kho'] ?? null;
    if (!in_array($kho, $khos, true)) $errs[] = 'Kho không hợp lệ: ' . k_str($kho);
    if ($type === 'CHUYEN') {
        if (!in_array($p['khoDen'] ?? null, $khos, true)) $errs[] = 'Chưa chọn kho đến.';
        elseif ($p['khoDen'] === $kho) $errs[] = 'Kho đến phải khác kho đi.';
    }
    $lines = array_values(array_filter(is_array($p['lines'] ?? null) ? $p['lines'] : [], function ($l) {
        return is_array($l) && (k_str($l['name'] ?? '') !== '' || k_num($l['thung'] ?? '') || k_num($l['le'] ?? ''));
    }));
    if (!$lines) $errs[] = 'Phiếu chưa có mặt hàng nào.';
    $need = []; $seen = [];
    foreach ($lines as $i => $l) {
        $name = k_str($l['name'] ?? ''); $label = 'Dòng ' . ($i + 1) . ': ';
        if (!isset($pmap[$name])) { $errs[] = $label . 'không có sản phẩm "' . $name . '".'; continue; }
        if (k_num($l['thung'] ?? '') < 0 || k_num($l['le'] ?? '') < 0) { $errs[] = $label . 'số lượng không được âm.'; continue; }
        $u = k_toUnits($l['thung'] ?? '', $l['le'] ?? '', $pmap[$name]['per']);
        if ($type === 'KIEMKE') {
            if (!empty($seen[$name])) $errs[] = $label . '"' . $name . '" bị lặp trong phiếu kiểm kê.';
            $seen[$name] = true;
            continue;
        }
        if ($u <= 0) { $errs[] = $label . 'chưa nhập số thùng / số lẻ.'; continue; }
        $need[$name] = k_round(($need[$name] ?? 0) + $u);
    }
    if (!$allowNegative && ($type === 'XUAT' || $type === 'CHUYEN')) {
        foreach ($need as $name => $n) {
            $have = k_stockAt($stock, $name, $kho); $pr = $pmap[$name];
            if ($n > $have + 1e-9) {
                $errs[] = '"' . $name . '" tại ' . $kho . ' chỉ còn ' . k_fmtThung($have, $pr['per'], $pr['unit']) .
                    ', không đủ ' . k_fmtThung($n, $pr['per'], $pr['unit']) . '.';
            }
        }
    }
    return $errs;
}

function k_nextId($existingIds, $prefix, $ymd)
{
    $head = $prefix . '-' . str_replace('-', '', substr($ymd, 2)) . '-';
    $max = 0;
    foreach ($existingIds as $id) {
        $id = (string)$id;
        if (strpos($id, $head) === 0) $max = max($max, (int)substr($id, strlen($head)));
    }
    return $head . substr('0' . ($max + 1), -2);
}

function k_phieuToRows($p, $pmap, $id, $user, $now, $stock)
{
    $rows = [];
    foreach ($p['lines'] as $l) {
        if (!is_array($l)) continue;
        $name = k_str($l['name'] ?? '');
        if (!isset($pmap[$name])) continue;
        $per = $pmap[$name]['per'];
        $units = k_toUnits($l['thung'] ?? '', $l['le'] ?? '', $per);
        $row = function ($loai, $kho, $u, $note) use ($id, $p, $name, $per, $user, $now) {
            $s = k_split($u, $per);
            return [$id, $p['date'], $loai, $kho, $name, $s['thung'], $s['le'], (float)$per, $u, k_str($p['doiTuong'] ?? ''), $note, $user ?: '', $now, ''];
        };
        $note = k_str($l['ghiChu'] ?? '') ?: k_str($p['ghiChu'] ?? '');
        $type = $p['type'];
        if ($type === 'NHAP') { if ($units > 0) $rows[] = $row(L_NHAP, $p['kho'], $units, $note); }
        elseif ($type === 'XUAT') { if ($units > 0) $rows[] = $row(L_XUAT, $p['kho'], $units, $note); }
        elseif ($type === 'CHUYEN') {
            if ($units > 0) { $rows[] = $row(L_CHUYEN_DI, $p['kho'], $units, $note); $rows[] = $row(L_CHUYEN_DEN, $p['khoDen'], $units, $note); }
        } elseif ($type === 'KIEMKE') {
            $cur = k_stockAt($stock, $name, $p['kho']); $diff = k_round($units - $cur);
            if ($diff != 0) {
                $unit = $pmap[$name]['unit'];
                $rows[] = $row(L_DIEU_CHINH, $p['kho'], $diff, trim('Kiểm kê: thực tế ' . k_fmtThung($units, $per, $unit) . ', sổ ' . k_fmtThung($cur, $per, $unit) . '. ' . k_str($p['ghiChu'] ?? '')));
            }
        }
    }
    return $rows;
}

function k_describePhieu($p, $pmap)
{
    $type = $p['type'];
    $head = (K::KIND_LABEL[$type] ?? $type) . ' ' . ($type === 'CHUYEN' ? $p['kho'] . ' → ' . $p['khoDen'] : $p['kho']) . ' ngày ' . $p['date'];
    $items = [];
    foreach ($p['lines'] as $l) {
        $n = k_str($l['name'] ?? '');
        if (!isset($pmap[$n])) continue;
        $pr = $pmap[$n];
        $items[] = $n . ' ' . k_fmtThung(k_toUnits($l['thung'] ?? '', $l['le'] ?? '', $pr['per']), $pr['per'], $pr['unit']);
    }
    $dt = $p['doiTuong'] ?? '';
    return $head . ($dt ? ' · ' . $dt : '') . ': ' . implode('; ', $items);
}

// ===================== PHÍ KHO =====================

function k_ymdAdd($s, $n) { $d = new DateTime($s . ' 00:00:00', new DateTimeZone('UTC')); $d->modify(($n >= 0 ? '+' : '') . $n . ' day'); return $d->format('Y-m-d'); }
function k_daysInMonth($s) { $p = explode('-', $s); return (int)date('t', gmmktime(0, 0, 0, (int)$p[1], 1, (int)$p[0])); }
function k_monthRange($m) { return ['from' => $m . '-01', 'to' => $m . '-' . substr('0' . k_daysInMonth($m . '-01'), -2)]; }

function k_cleanFee($f)
{
    $f = is_array($f) ? $f : [];
    $start = k_str($f['start'] ?? '');
    $fixed = [];
    foreach ((is_array($f['fixed'] ?? null) ? $f['fixed'] : []) as $x) {
        $x = is_array($x) ? $x : [];
        $it = ['loai' => k_str($x['loai'] ?? ''), 'amount' => max(0, k_jsround(k_num($x['amount'] ?? ''))), 'note' => k_str($x['note'] ?? '')];
        if ($it['loai'] !== '' && $it['amount'] > 0) $fixed[] = $it;
    }
    return ['on' => k_truthy($f['on'] ?? false), 'storeRate' => max(0, k_num($f['storeRate'] ?? 0)), 'storeUnit' => ($f['storeUnit'] ?? '') === 'ngay' ? 'ngay' : 'thang',
        'inRate' => max(0, k_num($f['inRate'] ?? 0)), 'outRate' => max(0, k_num($f['outRate'] ?? 0)), 'roundUp' => k_truthy($f['roundUp'] ?? false),
        'start' => k_isYmd($start) ? $start : '', 'auto' => k_truthy($f['auto'] ?? false), 'fixed' => $fixed];
}
function k_hasMonthly($fee) { return !empty($fee['on']) || !empty($fee['fixed']); }

function k_feeRates($p, $fee)
{
    $g = function ($v, $d) { return ($v === '' || $v === null) ? k_num($d) : k_num($v); };
    return ['store' => $g($p['feeStore'] ?? null, $fee['storeRate']), 'inn' => $g($p['feeIn'] ?? null, $fee['inRate']), 'out' => $g($p['feeOut'] ?? null, $fee['outRate'])];
}

function k_computeFees($tx, $products, $fee, $from, $to)
{
    if ($fee['start'] && $from < $fee['start']) $from = $fee['start'];
    $res = ['from' => $from, 'to' => $to, 'days' => 0, 'rows' => [], 'caseDays' => 0, 'storeFee' => 0, 'inCases' => 0, 'inFee' => 0, 'outCases' => 0, 'outFee' => 0, 'total' => 0];
    if (!$from || !$to || $from > $to) return $res;
    $pm = k_pmap($products); $by = [];
    $cases = function ($u, $per) use ($fee) { $c = max(0, $u) / $per; return $fee['roundUp'] ? ceil($c - 1e-9) : $c; };
    foreach ($tx as $t) {
        if ($t['date'] > $to) continue;
        if (!isset($by[$t['name']])) $by[$t['name']] = ['open' => 0, 'ch' => [], 'inC' => 0, 'outC' => 0, 'per' => $t['per']];
        $b = &$by[$t['name']];
        if ($t['date'] < $from) { $b['open'] += $t['delta']; unset($b); continue; }
        $b['ch'][$t['date']] = ($b['ch'][$t['date']] ?? 0) + $t['delta'];
        if ($t['loai'] === L_NHAP) $b['inC'] += $cases(abs($t['units']), $t['per']);
        elseif ($t['loai'] === L_XUAT) $b['outC'] += $cases(abs($t['units']), $t['per']);
        unset($b);
    }
    $days = [];
    for ($d = $from; $d <= $to; $d = k_ymdAdd($d, 1)) $days[] = $d;
    $res['days'] = count($days);
    $dim = [];
    foreach ($by as $name => $b) {
        $p = $pm[$name] ?? null;
        $per = ($p ? k_num($p['per']) : 0) ?: ($b['per'] ?: 1);
        $r = k_feeRates($p ?: [], $fee);
        $bal = $b['open']; $cd = 0; $sf = 0;
        foreach ($days as $d) {
            $bal = k_round($bal + ($b['ch'][$d] ?? 0));
            $c = $cases($bal, $per);
            $cd += $c;
            if ($fee['storeUnit'] === 'thang') { $m = substr($d, 0, 7); if (!isset($dim[$m])) $dim[$m] = k_daysInMonth($d); $sf += $c * ($r['store'] / $dim[$m]); }
            else $sf += $c * $r['store'];
        }
        $row = ['name' => $name, 'per' => $per, 'caseDays' => k_round($cd), 'storeFee' => k_jsround($sf), 'inCases' => k_round($b['inC']), 'inFee' => k_jsround($b['inC'] * $r['inn']),
            'outCases' => k_round($b['outC']), 'outFee' => k_jsround($b['outC'] * $r['out'])];
        $row['total'] = $row['storeFee'] + $row['inFee'] + $row['outFee'];
        if ($row['caseDays'] || $row['inCases'] || $row['outCases']) $res['rows'][] = $row;
    }
    usort($res['rows'], function ($a, $b) { return $b['total'] <=> $a['total']; });
    foreach ($res['rows'] as $r) {
        $res['caseDays'] += $r['caseDays']; $res['storeFee'] += $r['storeFee']; $res['inCases'] += $r['inCases'];
        $res['inFee'] += $r['inFee']; $res['outCases'] += $r['outCases']; $res['outFee'] += $r['outFee'];
    }
    foreach (['caseDays', 'inCases', 'outCases'] as $k) $res[$k] = k_round($res[$k]);
    $res['total'] = $res['storeFee'] + $res['inFee'] + $res['outFee'];
    return $res;
}

function k_monthCharges($tx, $products, $fee, $month, $upTo = '')
{
    $fee = k_cleanFee($fee);
    $mr = k_monthRange($month); $label = 'Tháng ' . substr($month, 5) . '/' . substr($month, 0, 4);
    $to = ($upTo && $upTo < $mr['to']) ? $upTo : $mr['to'];
    $f = $fee['on'] ? k_computeFees($tx, $products, $fee, $mr['from'], $to) : k_computeFees([], [], $fee, $mr['from'], $to);
    $items = [];
    if ($f['storeFee']) $items[] = ['loai' => K::FEE_TYPES['store'], 'amount' => $f['storeFee'], 'note' => $label . ': ' . k_vnNum($f['caseDays']) . ' thùng-ngày', 'kind' => 'kho'];
    if ($f['inFee']) $items[] = ['loai' => K::FEE_TYPES['inn'], 'amount' => $f['inFee'], 'note' => $label . ': ' . k_vnNum($f['inCases']) . ' thùng nhập', 'kind' => 'kho'];
    if ($f['outFee']) $items[] = ['loai' => K::FEE_TYPES['out'], 'amount' => $f['outFee'], 'note' => $label . ': ' . k_vnNum($f['outCases']) . ' thùng xuất', 'kind' => 'kho'];
    if (!$fee['start'] || $mr['to'] >= $fee['start']) {
        foreach ($fee['fixed'] as $x) $items[] = ['loai' => $x['loai'], 'amount' => $x['amount'], 'note' => $label . ($x['note'] ? ' · ' . $x['note'] : ''), 'kind' => 'codinh'];
    }
    $fixedTotal = 0;
    foreach ($items as $it) if ($it['kind'] === 'codinh') $fixedTotal += $it['amount'];
    return ['month' => $month, 'label' => $label, 'from' => $mr['from'], 'to' => $mr['to'], 'fees' => $f, 'items' => $items, 'total' => $f['total'] + $fixedTotal];
}

function k_costRowOk($c)
{
    $e = [];
    if (!k_isYmd($c['date'] ?? '')) $e[] = 'Chi phí: chưa chọn ngày.';
    if (k_str($c['loai'] ?? '') === '') $e[] = 'Chi phí: chưa chọn loại phí.';
    if (!(k_num($c['amount'] ?? '') > 0)) $e[] = 'Chi phí "' . k_str($c['loai'] ?? '') . '": số tiền phải lớn hơn 0.';
    return $e;
}

// ===================== LƯU TRỮ: SQLITE =====================

final class Store
{
    /** @var PDO */
    public $db;
    public $fixedNow = null; // dùng khi test

    public static function defaultPath()
    {
        $env = getenv('KHO_DB');
        if ($env) return $env;
        $web = dirname(__DIR__);
        // Ưu tiên lưu NGOÀI thư mục web (không ai tải được qua trình duyệt)
        $outside = dirname($web) . '/kho-data';
        if ((is_dir($outside) || @mkdir($outside, 0700, true)) && is_writable($outside)) return $outside . '/kho.sqlite';
        $inside = $web . '/data';
        if (!is_dir($inside)) @mkdir($inside, 0700, true);
        if (!file_exists($inside . '/.htaccess')) @file_put_contents($inside . '/.htaccess', "Require all denied\nDeny from all\n");
        return $inside . '/kho.sqlite';
    }

    public function __construct($path = null)
    {
        $this->db = new PDO('sqlite:' . ($path ?: self::defaultPath()));
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->db->exec('PRAGMA busy_timeout = 8000');
        $this->db->exec('PRAGMA journal_mode = WAL');
        $this->db->exec('PRAGMA foreign_keys = OFF');
        $this->migrate();
    }

    private function migrate()
    {
        $this->db->exec("
          CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
          CREATE TABLE IF NOT EXISTS products (name TEXT PRIMARY KEY, brand TEXT, per REAL, unit TEXT, active INTEGER, note TEXT,
            fee_store REAL, fee_in REAL, fee_out REAL, sort INTEGER);
          CREATE TABLE IF NOT EXISTS ledger (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT, date TEXT, loai TEXT, kho TEXT, name TEXT,
            thung REAL, le REAL, dv REAL, sl REAL, doi_tuong TEXT, ghi_chu TEXT, nguoi TEXT, tao TEXT, sua TEXT);
          CREATE INDEX IF NOT EXISTS ledger_id ON ledger(id);
          CREATE TABLE IF NOT EXISTS costs (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE, date TEXT, loai TEXT, amount REAL, note TEXT,
            phieu TEXT, nguoi TEXT, tao TEXT, chot TEXT);
          CREATE TABLE IF NOT EXISTS chots (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE, date TEXT, from_date TEXT, to_date TEXT,
            count INTEGER, total REAL, paid REAL, note TEXT, nguoi TEXT, tao TEXT);
          CREATE TABLE IF NOT EXISTS users (u TEXT PRIMARY KEY, name TEXT, role TEXT, hash TEXT);
          CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, u TEXT, exp INTEGER);
          CREATE TABLE IF NOT EXISTS fails (u TEXT PRIMARY KEY, n INTEGER, until INTEGER);
          CREATE TABLE IF NOT EXISTS logs (seq INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, u TEXT, name TEXT, role TEXT, action TEXT, ref TEXT, detail TEXT);
        ");
    }

    public function q($sql, $args = []) { $st = $this->db->prepare($sql); $st->execute($args); return $st; }
    public function now() { return $this->fixedNow ?: date('Y-m-d H:i'); }
    public function kvGet($k) { $r = $this->q('SELECT v FROM kv WHERE k = ?', [$k])->fetch(); return $r ? $r['v'] : null; }
    public function kvSet($k, $v) { $this->q('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', [$k, $v]); }

    private static function numOut($v) { return $v === null ? '' : (float)$v; }

    // ---- Sản phẩm ----
    public function products()
    {
        $out = [];
        foreach ($this->q('SELECT * FROM products ORDER BY sort, rowid') as $r) {
            $out[] = ['name' => $r['name'], 'brand' => (string)$r['brand'] ?: 'Khác', 'per' => (float)$r['per'] ?: 1.0, 'unit' => (string)$r['unit'] ?: 'lẻ',
                'active' => (int)$r['active'] !== 0, 'note' => (string)$r['note'], 'feeStore' => self::numOut($r['fee_store']),
                'feeIn' => self::numOut($r['fee_in']), 'feeOut' => self::numOut($r['fee_out'])];
        }
        return $out;
    }
    public function saveProduct($p, $oldName)
    {
        $f = function ($v) { return ($v === '' || $v === null) ? null : (float)$v; };
        $vals = [$p['name'], $p['brand'], $p['per'], $p['unit'], $p['active'] ? 1 : 0, $p['note'], $f($p['feeStore'] ?? ''), $f($p['feeIn'] ?? ''), $f($p['feeOut'] ?? '')];
        if ($oldName && $this->q('SELECT 1 FROM products WHERE name = ?', [$oldName])->fetch()) {
            $this->q('UPDATE products SET name=?, brand=?, per=?, unit=?, active=?, note=?, fee_store=?, fee_in=?, fee_out=? WHERE name=?', array_merge($vals, [$oldName]));
            if ($oldName !== $p['name']) $this->q('UPDATE ledger SET name = ? WHERE name = ?', [$p['name'], $oldName]);
        } else {
            $sort = (int)$this->q('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM products')->fetch()['s'];
            $this->q('INSERT INTO products (name, brand, per, unit, active, note, fee_store, fee_in, fee_out, sort) VALUES (?,?,?,?,?,?,?,?,?,?)', array_merge($vals, [$sort]));
        }
    }
    public function removeProduct($name) { $this->q('DELETE FROM products WHERE name = ?', [$name]); }

    // ---- Cài đặt ----
    public static function defaultSettings()
    {
        $fee = k_cleanFee([]);
        $fee['fixed'] = K::FIXED_SAMPLE;
        return ['company' => 'Kho hàng', 'khos' => ['Kho 1', 'Kho 2'], 'brands' => [], 'costTypes' => K::DEFAULT_COST_TYPES, 'units' => K::DEFAULT_UNITS,
            'allowNegative' => false, 'viewerSeeCosts' => true, 'fee' => $fee];
    }
    public function settings()
    {
        $raw = $this->kvGet('settings');
        $s = $raw ? json_decode($raw, true) : null;
        if (!is_array($s)) return self::defaultSettings();
        $d = self::defaultSettings();
        foreach ($d as $k => $v) if (!array_key_exists($k, $s)) $s[$k] = $v;
        $s['fee'] = k_cleanFee($s['fee']);
        return $s;
    }
    public function saveSettings($s) { $this->kvSet('settings', json_encode($s, JSON_UNESCAPED_UNICODE)); }

    // ---- Sổ kho ----
    public function ledger()
    {
        $out = [];
        foreach ($this->q('SELECT * FROM ledger ORDER BY seq') as $r) {
            $out[] = [(string)$r['id'], (string)$r['date'], (string)$r['loai'], (string)$r['kho'], (string)$r['name'], self::numOut($r['thung']), self::numOut($r['le']),
                self::numOut($r['dv']), self::numOut($r['sl']), (string)$r['doi_tuong'], (string)$r['ghi_chu'], (string)$r['nguoi'], (string)$r['tao'], (string)$r['sua']];
        }
        return $out;
    }
    public function appendLedger($rows)
    {
        $st = $this->db->prepare('INSERT INTO ledger (id, date, loai, kho, name, thung, le, dv, sl, doi_tuong, ghi_chu, nguoi, tao, sua) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $n = function ($v) { return ($v === '' || $v === null) ? null : (float)$v; };
        foreach ($rows as $r) {
            $st->execute([k_str($r[0]), k_str($r[1]), k_str($r[2]), k_str($r[3]), k_str($r[4]), $n($r[5]), $n($r[6]), $n($r[7]), $n($r[8]),
                k_str($r[9]), k_str($r[10]), k_str($r[11]), k_str($r[12]), k_str($r[13] ?? '')]);
        }
    }
    public function replacePhieu($id, $rows) { $this->removePhieu($id); $this->appendLedger($rows); }
    public function removePhieu($id) { $this->q('DELETE FROM ledger WHERE id = ?', [$id]); }

    // ---- Chi phí ----
    public function costs()
    {
        $out = [];
        foreach ($this->q('SELECT * FROM costs ORDER BY seq') as $r) {
            $out[] = ['id' => $r['id'], 'date' => (string)$r['date'], 'loai' => (string)$r['loai'], 'amount' => (float)$r['amount'], 'note' => (string)$r['note'],
                'phieu' => (string)$r['phieu'], 'nguoi' => (string)$r['nguoi'], 'tao' => (string)$r['tao'], 'chot' => (string)$r['chot']];
        }
        return $out;
    }
    public function appendCosts($list)
    {
        $st = $this->db->prepare('INSERT INTO costs (id, date, loai, amount, note, phieu, nguoi, tao, chot) VALUES (?,?,?,?,?,?,?,?,?)');
        foreach ($list as $c) $st->execute([$c['id'], $c['date'], $c['loai'], (float)$c['amount'], $c['note'], $c['phieu'], $c['nguoi'], $c['tao'], $c['chot'] ?? '']);
    }
    public function updateCost($c)
    {
        $this->q('UPDATE costs SET date=?, loai=?, amount=?, note=?, phieu=?, nguoi=?, tao=?, chot=? WHERE id=?',
            [$c['date'], $c['loai'], (float)$c['amount'], $c['note'], $c['phieu'], $c['nguoi'], $c['tao'], $c['chot'], $c['id']]);
    }
    public function removeCost($id) { $this->q('DELETE FROM costs WHERE id = ?', [$id]); }
    public function markCosts($ids, $chotId) { $st = $this->db->prepare('UPDATE costs SET chot = ? WHERE id = ?'); foreach ($ids as $id) $st->execute([$chotId, $id]); }

    // ---- Chốt sổ ----
    public function chots()
    {
        $out = [];
        foreach ($this->q('SELECT * FROM chots ORDER BY seq') as $r) {
            $out[] = ['id' => $r['id'], 'date' => (string)$r['date'], 'from' => (string)$r['from_date'], 'to' => (string)$r['to_date'], 'count' => (int)$r['count'],
                'total' => (float)$r['total'], 'paid' => (float)$r['paid'], 'note' => (string)$r['note'], 'nguoi' => (string)$r['nguoi'], 'tao' => (string)$r['tao']];
        }
        return $out;
    }
    public function appendChot($x)
    {
        $this->q('INSERT INTO chots (id, date, from_date, to_date, count, total, paid, note, nguoi, tao) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$x['id'], $x['date'], $x['from'], $x['to'], $x['count'], $x['total'], $x['paid'], $x['note'], $x['nguoi'], $x['tao']]);
    }
    public function removeChot($id) { $this->q('DELETE FROM chots WHERE id = ?', [$id]); }

    // ---- Tài khoản & phiên ----
    public function users() { return $this->q('SELECT u, name, role, hash FROM users ORDER BY rowid')->fetchAll(); }
    public function user($u) { return $this->q('SELECT u, name, role, hash FROM users WHERE u = ?', [$u])->fetch() ?: null; }
    public function upsertUser($u, $name, $role, $hash = null)
    {
        if ($this->user($u)) {
            $this->q('UPDATE users SET name = ?, role = ? WHERE u = ?', [$name, $role, $u]);
            if ($hash) $this->q('UPDATE users SET hash = ? WHERE u = ?', [$hash, $u]);
        } else $this->q('INSERT INTO users (u, name, role, hash) VALUES (?,?,?,?)', [$u, $name, $role, $hash]);
    }
    public function deleteUser($u) { $this->q('DELETE FROM users WHERE u = ?', [$u]); }
    public function dropSessions($u) { $this->q('DELETE FROM sessions WHERE u = ?', [$u]); }

    // ---- Nhật ký ----
    public function log($e)
    {
        $this->q('INSERT INTO logs (time, u, name, role, action, ref, detail) VALUES (?,?,?,?,?,?,?)',
            [$e['time'], $e['u'], $e['name'], $e['role'], $e['action'], $e['ref'], $e['detail']]);
    }
    public function logs() { return $this->q('SELECT time, u, name, role, action, ref, detail FROM logs ORDER BY seq')->fetchAll(); }
}

// ===================== NGHIỆP VỤ + PHÂN QUYỀN =====================

final class App
{
    /** @var Store */
    public $s;
    const SESSION_DAYS = 30;

    public function __construct(Store $s) { $this->s = $s; }

    public static function can($role, $action) { return in_array($role, K::ACL[$action] ?? [], true); }

    public function snapshot($user)
    {
        $set = $this->s->settings();
        $see = $user['role'] !== 'xem' || !empty($set['viewerSeeCosts']);
        return ['me' => ['u' => $user['u'], 'name' => $user['name'], 'role' => $user['role']], 'settings' => $set, 'products' => $this->s->products(),
            'ledger' => $this->s->ledger(), 'costs' => $see ? $this->s->costs() : null, 'chots' => $see ? $this->s->chots() : null];
    }

    /** Xử lý 1 thao tác (giống handle() trong core.js) */
    public function handle($user, $action, $p)
    {
        if (!isset(K::ACL[$action])) return ['ok' => false, 'errors' => ['Thao tác không tồn tại: ' . $action]];
        if (!self::can($user['role'], $action)) return ['ok' => false, 'errors' => ['Tài khoản của bạn không có quyền thực hiện thao tác này.']];
        $p = is_array($p) ? $p : [];
        $write = !isset(K::READ_ONLY[$action]);
        if ($write) $this->s->db->exec('BEGIN IMMEDIATE');
        try {
            $res = $this->{'a_' . $action}($user, $p);
            if (!empty($res['ok']) && !empty($res['log']) && $user['role'] !== 'admin') {
                $this->s->log(['time' => $this->s->now(), 'u' => $user['u'], 'name' => $user['name'], 'role' => $user['role'], 'action' => $action, 'ref' => $res['id'] ?? '', 'detail' => $res['log']]);
            }
            unset($res['log']);
            if ($write) { if (!empty($res['ok'])) $this->s->db->exec('COMMIT'); else $this->s->db->exec('ROLLBACK'); }
        } catch (Throwable $e) {
            if ($write) $this->s->db->exec('ROLLBACK');
            throw $e;
        }
        if (!empty($res['ok']) && $write) $res['data'] = $this->snapshot($user);
        return $res;
    }

    private static function err($m) { return ['ok' => false, 'errors' => is_array($m) ? $m : [$m]]; }

    public function a_data($user, $p) { return ['ok' => true, 'data' => $this->snapshot($user)]; }

    public function a_savePhieu($user, $p)
    {
        $editing = !empty($p['id']);
        if (($editing || ($p['type'] ?? '') === 'KIEMKE') && $user['role'] !== 'admin') return self::err('Chỉ quản trị viên được sửa phiếu / kiểm kê.');
        $set = $this->s->settings(); $products = $this->s->products(); $pmap = k_pmap($products);
        $raw = $this->s->ledger(); $others = $raw;
        if ($editing) {
            $id0 = (string)$p['id'];
            $mine = array_values(array_filter($raw, function ($r) use ($id0) { return $r[C_ID] === $id0; }));
            if (!$mine) return self::err('Không tìm thấy phiếu ' . $id0);
            $k = k_kindOfId($id0);
            if (!in_array($k, ['NHAP', 'XUAT', 'CHUYEN'], true)) return self::err('Phiếu loại này chỉ có thể hủy, không sửa được.');
            $p['type'] = $k;
            $others = array_values(array_filter($raw, function ($r) use ($id0) { return $r[C_ID] !== $id0; }));
        }
        $stock = k_stock(k_parseLedger($others, $pmap));
        $errs = k_validatePhieu($p, $pmap, $set['khos'], $stock, !empty($set['allowNegative']));
        $costs = [];
        foreach ((is_array($p['costs'] ?? null) ? $p['costs'] : []) as $c) {
            if (is_array($c) && (k_str($c['loai'] ?? '') !== '' || k_num($c['amount'] ?? ''))) { $c['date'] = $p['date'] ?? ''; $costs[] = $c; $errs = array_merge($errs, k_costRowOk($c)); }
        }
        if ($errs) return self::err($errs);
        $now = $this->s->now();
        $id = $editing ? (string)$p['id'] : k_nextId(array_column($raw, C_ID), K::PREFIX_BY_TYPE[$p['type']], $p['date']);
        $rows = k_phieuToRows($p, $pmap, $id, $user['name'], $now, $stock);
        if (!$rows) return self::err($p['type'] === 'KIEMKE' ? 'Số kiểm kê khớp với sổ, không cần điều chỉnh.' : 'Phiếu không có dòng hợp lệ.');
        if ($editing) {
            // quản trị sửa: giữ nguyên người tạo / thời điểm tạo, không ghi dấu vết
            foreach ($rows as &$r) { $r[C_NGUOI] = $mine[0][C_NGUOI]; $r[C_TAO] = $mine[0][C_TAO]; $r[C_SUA] = ''; }
            unset($r);
            $this->s->replacePhieu($id, $rows);
        } else $this->s->appendLedger($rows);
        if ($costs) {
            $cIds = array_column($this->s->costs(), 'id'); $add = [];
            foreach ($costs as $c) {
                $cid = k_nextId($cIds, 'CP', $p['date']); $cIds[] = $cid;
                $add[] = ['id' => $cid, 'date' => $p['date'], 'loai' => k_str($c['loai']), 'amount' => k_num($c['amount']), 'note' => k_str($c['note'] ?? ''), 'phieu' => $id, 'nguoi' => $user['name'], 'tao' => $now, 'chot' => ''];
            }
            $this->s->appendCosts($add);
        }
        $log = 'Tạo ' . $id . ' — ' . k_describePhieu($p, $pmap);
        if ($costs) $log .= ' | Chi phí: ' . implode('; ', array_map(function ($c) { return k_str($c['loai']) . ' ' . k_fmtMoney($c['amount']); }, $costs));
        return ['ok' => true, 'id' => $id, 'log' => $log];
    }

    public function a_deletePhieu($user, $p)
    {
        $id = k_str($p['id'] ?? '');
        if (!$this->s->q('SELECT 1 FROM ledger WHERE id = ? LIMIT 1', [$id])->fetch()) return self::err('Không tìm thấy phiếu ' . $id);
        $this->s->removePhieu($id); // xóa hẳn, không lưu lại
        return ['ok' => true, 'id' => $id];
    }

    public function a_saveCost($user, $c)
    {
        $errs = k_costRowOk($c);
        if ($errs) return self::err($errs);
        $list = $this->s->costs();
        if (!empty($c['id'])) {
            if ($user['role'] !== 'admin') return self::err('Chỉ quản trị viên được sửa chi phí.');
            $old = null; foreach ($list as $x) if ($x['id'] === $c['id']) $old = $x;
            if (!$old) return self::err('Không tìm thấy chi phí ' . $c['id']);
            $this->s->updateCost(['id' => $c['id'], 'date' => $c['date'], 'loai' => k_str($c['loai']), 'amount' => k_num($c['amount']), 'note' => k_str($c['note'] ?? ''),
                'phieu' => k_str($c['phieu'] ?? ''), 'nguoi' => $old['nguoi'], 'tao' => $old['tao'], 'chot' => $old['chot'] ?: '']);
            return ['ok' => true, 'id' => $c['id']];
        }
        $id = k_nextId(array_column($list, 'id'), 'CP', $c['date']);
        $this->s->appendCosts([['id' => $id, 'date' => $c['date'], 'loai' => k_str($c['loai']), 'amount' => k_num($c['amount']), 'note' => k_str($c['note'] ?? ''),
            'phieu' => k_str($c['phieu'] ?? ''), 'nguoi' => $user['name'], 'tao' => $this->s->now(), 'chot' => '']]);
        $note = k_str($c['note'] ?? '');
        return ['ok' => true, 'id' => $id, 'log' => 'Thêm chi phí ' . $id . ' ngày ' . $c['date'] . ': ' . k_str($c['loai']) . ' ' . k_fmtMoney($c['amount']) . ($note ? ' (' . $note . ')' : '')];
    }

    public function a_deleteCost($user, $p)
    {
        $id = k_str($p['id'] ?? '');
        if (!$this->s->q('SELECT 1 FROM costs WHERE id = ?', [$id])->fetch()) return self::err('Không tìm thấy chi phí ' . $id);
        $this->s->removeCost($id);
        return ['ok' => true];
    }

    public function a_saveChot($user, $p)
    {
        if (!k_isYmd($p['date'] ?? '')) return self::err('Chưa chọn ngày chốt.');
        $paid = k_num($p['paid'] ?? '');
        if ($paid < 0) return self::err('Số tiền thanh toán không được âm.');
        $open = array_values(array_filter($this->s->costs(), function ($c) use ($p) { return !$c['chot'] && $c['date'] <= $p['date']; }));
        if (!$open && !$paid) return self::err('Không có khoản chi phí nào chưa chốt đến ngày ' . $p['date'] . '.');
        $id = k_nextId(array_column($this->s->chots(), 'id'), 'CS', $p['date']);
        $total = 0; $from = '';
        foreach ($open as $c) { $total += k_num($c['amount']); if (!$from || $c['date'] < $from) $from = $c['date']; }
        $this->s->appendChot(['id' => $id, 'date' => $p['date'], 'from' => $from, 'to' => $p['date'], 'count' => count($open), 'total' => k_round($total), 'paid' => $paid,
            'note' => k_str($p['note'] ?? ''), 'nguoi' => $user['name'], 'tao' => $this->s->now()]);
        if ($open) $this->s->markCosts(array_column($open, 'id'), $id);
        return ['ok' => true, 'id' => $id];
    }

    public function a_deleteChot($user, $p)
    {
        $id = k_str($p['id'] ?? '');
        if (!$this->s->q('SELECT 1 FROM chots WHERE id = ?', [$id])->fetch()) return self::err('Không tìm thấy đợt chốt ' . $id);
        $this->s->q("UPDATE costs SET chot = '' WHERE chot = ?", [$id]);
        $this->s->removeChot($id);
        return ['ok' => true];
    }

    public function a_postFees($user, $p)
    {
        $set = $this->s->settings(); $fee = k_cleanFee($set['fee']);
        if (!k_hasMonthly($fee)) return self::err('Chưa cài phí kho hoặc phí cố định hằng tháng (Cài đặt → Biểu phí).');
        $month = k_str($p['month'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) return self::err('Chưa chọn tháng.');
        $mr = k_monthRange($month); $label = 'Tháng ' . substr($month, 5) . '/' . substr($month, 0, 4);
        if ($mr['to'] >= substr($this->s->now(), 0, 10)) return self::err($label . ' chưa kết thúc, chỉ ghi được khi hết tháng.');
        $ref = 'PHI-' . $month;
        $existing = array_values(array_filter($this->s->costs(), function ($c) use ($ref) { return $c['phieu'] === $ref; }));
        foreach ($existing as $c) if ($c['chot']) return self::err('Phí ' . $label . ' đã nằm trong đợt chốt ' . $c['chot'] . '. Mở lại đợt chốt trước nếu muốn ghi lại.');
        if ($existing && !empty($p['auto'])) return ['ok' => true, 'id' => $ref, 'skipped' => true];
        $products = $this->s->products();
        $mc = k_monthCharges(k_parseLedger($this->s->ledger(), k_pmap($products)), $products, $fee, $month);
        if (!$mc['items']) return self::err('Không có phí phát sinh trong ' . $label . '.');
        foreach ($existing as $c) $this->s->removeCost($c['id']);
        $missing = [];
        foreach ($mc['items'] as $it) if (!in_array($it['loai'], $set['costTypes'], true) && !in_array($it['loai'], $missing, true)) $missing[] = $it['loai'];
        if ($missing) { $set['costTypes'] = array_merge($set['costTypes'], $missing); $this->s->saveSettings($set); }
        $ids = array_column($this->s->costs(), 'id'); $now = $this->s->now(); $add = [];
        foreach ($mc['items'] as $it) {
            $id = k_nextId($ids, 'CP', $mr['to']); $ids[] = $id;
            $add[] = ['id' => $id, 'date' => $mr['to'], 'loai' => $it['loai'], 'amount' => $it['amount'], 'note' => $it['note'], 'phieu' => $ref, 'nguoi' => $user['name'], 'tao' => $now, 'chot' => ''];
        }
        $this->s->appendCosts($add);
        return ['ok' => true, 'id' => $ref, 'total' => $mc['total'], 'replaced' => count($existing) > 0];
    }

    public function a_listLog($user, $p)
    {
        return ['ok' => true, 'logs' => array_reverse(array_slice($this->s->logs(), -1000))];
    }

    public function a_saveProduct($user, $p)
    {
        $name = k_str($p['name'] ?? ''); $oldName = k_str($p['oldName'] ?? ''); $errs = [];
        if ($name === '') $errs[] = 'Chưa nhập tên sản phẩm.';
        if (!(k_num($p['per'] ?? '') > 0)) $errs[] = 'ĐV/Thùng phải lớn hơn 0.';
        $names = array_column($this->s->products(), 'name');
        if ($name !== $oldName && in_array($name, $names, true)) $errs[] = 'Đã có sản phẩm tên "' . $name . '".';
        if ($oldName !== '' && !in_array($oldName, $names, true)) $errs[] = 'Không tìm thấy sản phẩm "' . $oldName . '".';
        if ($errs) return self::err($errs);
        $ov = function ($v) { return ($v === '' || $v === null) ? '' : max(0, k_num($v)); };
        $this->s->saveProduct(['name' => $name, 'brand' => k_str($p['brand'] ?? '') ?: 'Khác', 'per' => k_num($p['per']), 'unit' => k_str($p['unit'] ?? '') ?: 'lẻ',
            'active' => ($p['active'] ?? true) !== false, 'note' => k_str($p['note'] ?? ''), 'feeStore' => $ov($p['feeStore'] ?? ''), 'feeIn' => $ov($p['feeIn'] ?? ''), 'feeOut' => $ov($p['feeOut'] ?? '')], $oldName);
        return ['ok' => true];
    }

    public function a_deleteProduct($user, $p)
    {
        $name = k_str($p['name'] ?? '');
        if ($this->s->q('SELECT 1 FROM ledger WHERE name = ? LIMIT 1', [$name])->fetch()) return self::err('Sản phẩm đã có giao dịch, không xóa được. Hãy chuyển trạng thái sang "Ngừng bán".');
        $this->s->removeProduct($name);
        return ['ok' => true];
    }

    public static function cleanList($a)
    {
        $out = [];
        foreach ((is_array($a) ? $a : []) as $x) { $x = k_str($x); if ($x !== '' && !in_array($x, $out, true)) $out[] = $x; }
        return $out;
    }

    public function a_saveSettings($user, $p)
    {
        $s = ['company' => k_str($p['company'] ?? '') ?: 'Kho hàng', 'khos' => self::cleanList($p['khos'] ?? []), 'brands' => self::cleanList($p['brands'] ?? []),
            'costTypes' => self::cleanList($p['costTypes'] ?? []), 'units' => self::cleanList($p['units'] ?? []),
            'allowNegative' => k_truthy($p['allowNegative'] ?? false), 'viewerSeeCosts' => k_truthy($p['viewerSeeCosts'] ?? false), 'fee' => k_cleanFee($p['fee'] ?? [])];
        if (!$s['khos']) return self::err('Cần ít nhất 1 kho.');
        $used = array_column($this->s->q('SELECT DISTINCT kho FROM ledger')->fetchAll(), 'kho');
        $removed = array_values(array_filter($this->s->settings()['khos'], function ($k) use ($s, $used) { return !in_array($k, $s['khos'], true) && in_array($k, $used, true); }));
        if ($removed) return self::err('Không xóa được kho đã có giao dịch: ' . implode(', ', $removed));
        $this->s->saveSettings($s);
        return ['ok' => true];
    }

    public function a_listUsers($user, $p)
    {
        return ['ok' => true, 'users' => array_map(function ($u) { return ['u' => $u['u'], 'name' => $u['name'], 'role' => $u['role']]; }, $this->s->users())];
    }

    public function a_saveUser($user, $p)
    {
        $u = strtolower(k_str($p['u'] ?? '')); $errs = [];
        $role = $p['role'] ?? ''; $isNew = !empty($p['isNew']); $pw = (string)($p['password'] ?? '');
        if (!preg_match('/^[a-z0-9._-]{3,30}$/', $u)) $errs[] = 'Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, . _ -';
        if (!isset(K::ROLES[$role])) $errs[] = 'Vai trò không hợp lệ.';
        if (k_str($p['name'] ?? '') === '') $errs[] = 'Chưa nhập tên hiển thị.';
        $existing = $this->s->user($u);
        if ($isNew && $existing) $errs[] = 'Tên đăng nhập đã tồn tại.';
        if (!$isNew && !$existing) $errs[] = 'Không tìm thấy tài khoản.';
        if (($isNew || $pw !== '') && k_len($pw) < 6) $errs[] = 'Mật khẩu tối thiểu 6 ký tự.';
        if ($existing && $existing['u'] === $user['u'] && $role !== 'admin') $errs[] = 'Không thể tự hạ quyền của chính mình.';
        if ($errs) return self::err($errs);
        $this->s->upsertUser($u, k_str($p['name']), $role, $pw !== '' ? password_hash($pw, PASSWORD_DEFAULT) : null);
        if ($pw !== '' && $existing) $this->s->dropSessions($u);
        return ['ok' => true];
    }

    public function a_deleteUser($user, $p)
    {
        $u = k_str($p['u'] ?? '');
        if ($u === $user['u']) return self::err('Không thể xóa chính mình.');
        $this->s->deleteUser($u);
        $this->s->dropSessions($u);
        return ['ok' => true];
    }

    public function a_changePassword($user, $p)
    {
        $me = $this->s->user($user['u']);
        if (!$me || !password_verify((string)($p['old'] ?? ''), (string)$me['hash'])) return self::err('Mật khẩu hiện tại không đúng.');
        $pw = (string)($p['password'] ?? '');
        if (k_len($pw) < 6) return self::err('Mật khẩu mới tối thiểu 6 ký tự.');
        $this->s->upsertUser($me['u'], $me['name'], $me['role'], password_hash($pw, PASSWORD_DEFAULT));
        return ['ok' => true, 'log' => 'Đổi mật khẩu'];
    }

    // ---------- Dữ liệu: nhập Excel cũ, sao lưu, khôi phục (chỉ quản trị) ----------

    private function wipe() { foreach (['ledger', 'costs', 'chots', 'products'] as $t) $this->s->db->exec("DELETE FROM $t"); }

    public static function cleanRow($r)
    {
        if (!is_array($r) || count($r) < 13) return null;
        $r = array_values($r);
        $out = [];
        for ($i = 0; $i < 14; $i++) {
            $v = $r[$i] ?? '';
            $out[] = in_array($i, [C_THUNG, C_LE, C_DV, C_SL], true) ? (k_blank($v) ? '' : k_num($v)) : k_str($v);
        }
        if (!k_isYmd($out[C_NGAY]) || $out[C_TEN] === '' || $out[C_LOAI] === '') return null;
        return $out;
    }

    public static function cleanCost($c)
    {
        if (!is_array($c) || !k_isYmd($c['date'] ?? '') || k_str($c['id'] ?? '') === '') return null;
        return ['id' => k_str($c['id']), 'date' => $c['date'], 'loai' => k_str($c['loai'] ?? '') ?: 'Khác', 'amount' => k_num($c['amount'] ?? 0), 'note' => k_str($c['note'] ?? ''),
            'phieu' => k_str($c['phieu'] ?? ''), 'nguoi' => k_str($c['nguoi'] ?? ''), 'tao' => k_str($c['tao'] ?? ''), 'chot' => k_str($c['chot'] ?? '')];
    }

    /** Nhập dữ liệu đã đọc từ file Excel mẫu cũ (giao diện đọc file + chuyển đổi, máy chủ kiểm tra rồi ghi) */
    public function a_importData($user, $p)
    {
        $replace = !empty($p['replace']);
        $rows = array_values(array_filter(array_map([self::class, 'cleanRow'], is_array($p['rows'] ?? null) ? $p['rows'] : [])));
        $costs = array_values(array_filter(array_map([self::class, 'cleanCost'], is_array($p['costs'] ?? null) ? $p['costs'] : [])));
        $products = is_array($p['products'] ?? null) ? $p['products'] : [];
        if (!$rows && !$costs && !$products) return self::err('File không có dữ liệu để nhập.');
        if (!$replace) {
            $haveIds = array_flip(array_column($this->s->ledger(), C_ID));
            $dup = []; foreach ($rows as $r) if (isset($haveIds[$r[C_ID]])) $dup[$r[C_ID]] = 1;
            $haveC = array_flip(array_column($this->s->costs(), 'id'));
            foreach ($costs as $c) if (isset($haveC[$c['id']])) $dup[$c['id']] = 1;
            if ($dup) return self::err('Dữ liệu trùng mã với dữ liệu đang có (' . implode(', ', array_slice(array_keys($dup), 0, 5)) . (count($dup) > 5 ? '…' : '') . '). Chọn "Thay toàn bộ dữ liệu" nếu muốn nhập lại từ đầu.');
        } else $this->wipe();
        $have = array_flip(array_column($this->s->products(), 'name'));
        $nP = 0;
        foreach ($products as $x) {
            if (!is_array($x)) continue;
            $name = k_str($x['name'] ?? '');
            if ($name === '' || isset($have[$name])) continue;
            $this->s->saveProduct(['name' => $name, 'brand' => k_str($x['brand'] ?? '') ?: 'Khác', 'per' => k_num($x['per'] ?? 1) ?: 1, 'unit' => k_str($x['unit'] ?? '') ?: 'lẻ',
                'active' => ($x['active'] ?? true) !== false, 'note' => k_str($x['note'] ?? ''), 'feeStore' => '', 'feeIn' => '', 'feeOut' => ''], '');
            $have[$name] = 1; $nP++;
        }
        $this->s->appendLedger($rows);
        $this->s->appendCosts($costs);
        $set = $this->s->settings();
        foreach (['khos', 'brands', 'costTypes'] as $k) $set[$k] = self::cleanList(array_merge($set[$k], is_array($p[$k] ?? null) ? $p[$k] : []));
        foreach ($rows as $r) if (!in_array($r[C_KHO], $set['khos'], true)) $set['khos'][] = $r[C_KHO];
        $this->s->saveSettings($set);
        return ['ok' => true, 'imported' => ['rows' => count($rows), 'costs' => count($costs), 'products' => $nP]];
    }

    public function a_backup($user, $p)
    {
        return ['ok' => true, 'backup' => ['app' => 'kho-ky-gui', 'version' => 1, 'exportedAt' => $this->s->now(), 'settings' => $this->s->settings(),
            'products' => $this->s->products(), 'ledger' => $this->s->ledger(), 'costs' => $this->s->costs(), 'chots' => $this->s->chots(), 'logs' => $this->s->logs()]];
    }

    public function a_restore($user, $p)
    {
        $b = $p['backup'] ?? null;
        if (!is_array($b) || ($b['app'] ?? '') !== 'kho-ky-gui') return self::err('File sao lưu không đúng định dạng.');
        $this->wipe();
        $this->s->db->exec('DELETE FROM logs');
        foreach ((is_array($b['products'] ?? null) ? $b['products'] : []) as $x) {
            if (!is_array($x) || k_str($x['name'] ?? '') === '') continue;
            $this->s->saveProduct(['name' => k_str($x['name']), 'brand' => k_str($x['brand'] ?? '') ?: 'Khác', 'per' => k_num($x['per'] ?? 1) ?: 1, 'unit' => k_str($x['unit'] ?? '') ?: 'lẻ',
                'active' => ($x['active'] ?? true) !== false, 'note' => k_str($x['note'] ?? ''), 'feeStore' => $x['feeStore'] ?? '', 'feeIn' => $x['feeIn'] ?? '', 'feeOut' => $x['feeOut'] ?? ''], '');
        }
        $this->s->appendLedger(array_values(array_filter(array_map([self::class, 'cleanRow'], is_array($b['ledger'] ?? null) ? $b['ledger'] : []))));
        $this->s->appendCosts(array_values(array_filter(array_map([self::class, 'cleanCost'], is_array($b['costs'] ?? null) ? $b['costs'] : []))));
        foreach ((is_array($b['chots'] ?? null) ? $b['chots'] : []) as $x) {
            if (!is_array($x) || k_str($x['id'] ?? '') === '') continue;
            $this->s->appendChot(['id' => k_str($x['id']), 'date' => k_str($x['date'] ?? ''), 'from' => k_str($x['from'] ?? ''), 'to' => k_str($x['to'] ?? ''), 'count' => (int)($x['count'] ?? 0),
                'total' => k_num($x['total'] ?? 0), 'paid' => k_num($x['paid'] ?? 0), 'note' => k_str($x['note'] ?? ''), 'nguoi' => k_str($x['nguoi'] ?? ''), 'tao' => k_str($x['tao'] ?? '')]);
        }
        foreach ((is_array($b['logs'] ?? null) ? $b['logs'] : []) as $e) {
            if (is_array($e)) $this->s->log(['time' => k_str($e['time'] ?? ''), 'u' => k_str($e['u'] ?? ''), 'name' => k_str($e['name'] ?? ''), 'role' => k_str($e['role'] ?? ''),
                'action' => k_str($e['action'] ?? ''), 'ref' => k_str($e['ref'] ?? ''), 'detail' => k_str($e['detail'] ?? '')]);
        }
        if (is_array($b['settings'] ?? null)) {
            $s = $b['settings'];
            $s['fee'] = k_cleanFee($s['fee'] ?? []);
            $this->s->saveSettings(array_merge(Store::defaultSettings(), $s));
        }
        return ['ok' => true];
    }

    // ---------- Đăng nhập & phiên ----------

    public function needSetup() { return !$this->s->q('SELECT 1 FROM users LIMIT 1')->fetch(); }

    private function newSession($u)
    {
        $this->s->q('DELETE FROM sessions WHERE exp < ?', [time()]);
        $token = bin2hex(random_bytes(32));
        $this->s->q('INSERT INTO sessions (token, u, exp) VALUES (?,?,?)', [$token, $u, time() + self::SESSION_DAYS * 86400]);
        return $token;
    }

    public function sessionUser($token)
    {
        if (!is_string($token) || $token === '') return null;
        $r = $this->s->q('SELECT u, exp FROM sessions WHERE token = ?', [$token])->fetch();
        if (!$r) return null;
        if ($r['exp'] < time()) { $this->s->q('DELETE FROM sessions WHERE token = ?', [$token]); return null; }
        $u = $this->s->user($r['u']);
        return $u ? ['u' => $u['u'], 'name' => $u['name'], 'role' => $u['role']] : null;
    }

    /** Lần đầu: tạo tài khoản quản trị (chỉ khi chưa có tài khoản nào) */
    public function setup($u, $name, $password)
    {
        $this->s->db->exec('BEGIN IMMEDIATE');
        if (!$this->needSetup()) { $this->s->db->exec('ROLLBACK'); return self::err('Hệ thống đã có tài khoản quản trị.'); }
        $res = $this->a_saveUser(['u' => '_setup', 'name' => 'setup', 'role' => 'admin'], ['isNew' => true, 'u' => $u, 'name' => $name ?: 'Quản trị', 'role' => 'admin', 'password' => $password]);
        if (empty($res['ok'])) { $this->s->db->exec('ROLLBACK'); return $res; }
        $this->s->db->exec('COMMIT');
        return $this->login($u, $password);
    }

    public function login($u, $password)
    {
        $u = strtolower(k_str($u));
        $f = $this->s->q('SELECT n, until FROM fails WHERE u = ?', [$u])->fetch();
        if ($f && $f['n'] >= 5 && $f['until'] > time()) return self::err('Sai mật khẩu quá nhiều lần. Thử lại sau 10 phút.');
        $rec = $this->s->user($u);
        if (!$rec || !password_verify((string)$password, (string)$rec['hash'])) {
            $n = ($f && $f['until'] > time()) ? $f['n'] + 1 : 1;
            $this->s->q('INSERT INTO fails (u, n, until) VALUES (?,?,?) ON CONFLICT(u) DO UPDATE SET n = excluded.n, until = excluded.until', [$u, $n, time() + 600]);
            return self::err('Sai tên đăng nhập hoặc mật khẩu.');
        }
        $this->s->q('DELETE FROM fails WHERE u = ?', [$u]);
        $user = ['u' => $rec['u'], 'name' => $rec['name'], 'role' => $rec['role']];
        if ($user['role'] !== 'admin') $this->s->log(['time' => $this->s->now(), 'u' => $user['u'], 'name' => $user['name'], 'role' => $user['role'], 'action' => 'login', 'ref' => '', 'detail' => 'Đăng nhập']);
        $this->autoPostFees();
        return ['ok' => true, 'token' => $this->newSession($user['u']), 'data' => $this->snapshot($user)];
    }

    public function logout($token) { $this->s->q('DELETE FROM sessions WHERE token = ?', [(string)$token]); return ['ok' => true]; }

    /**
     * Tự ghi phí tháng trước (phí kho + phí cố định) nếu bật "Tự động ghi phí hằng tháng".
     * Chạy khi có người mở app — không cần cài Cron Job. Mỗi tháng chỉ kiểm tra 1 lần.
     */
    public function autoPostFees()
    {
        $set = $this->s->settings();
        if (empty($set['fee']['auto']) || !k_hasMonthly($set['fee'])) return;
        $d = new DateTime(substr($this->s->now(), 0, 10));
        $d->modify('first day of last month');
        $month = $d->format('Y-m');
        if ($this->s->kvGet('autoPosted') === $month) return;
        try { $this->handle(['u' => '_auto', 'name' => 'Tự động', 'role' => 'admin'], 'postFees', ['month' => $month, 'auto' => true]); } catch (Throwable $e) { return; }
        $this->s->kvSet('autoPosted', $month);
    }

    /** Điểm vào duy nhất từ api.php */
    public function call($fn, $args)
    {
        $args = is_array($args) ? array_values($args) : [];
        switch ($fn) {
            case 'status': return ['ok' => true, 'needSetup' => $this->needSetup(), 'company' => $this->s->settings()['company']];
            case 'setup': return $this->setup($args[0] ?? '', $args[1] ?? '', $args[2] ?? '');
            case 'login': return $this->login($args[0] ?? '', $args[1] ?? '');
            case 'logout': return $this->logout($args[0] ?? '');
            case 'api':
                $user = $this->sessionUser($args[0] ?? '');
                if (!$user) return ['ok' => false, 'auth' => true, 'errors' => ['Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.']];
                $action = (string)($args[1] ?? '');
                if ($action === 'data') $this->autoPostFees();
                return $this->handle($user, $action, $args[2] ?? []);
        }
        return self::err('Yêu cầu không hợp lệ.');
    }
}
