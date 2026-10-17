/**
 * KHO KÝ GỬI — ỨNG DỤNG WEB (Google Apps Script)
 *
 * Gồm 3 file trong dự án Apps Script:
 *   Core.gs    — lõi tính toán + phân quyền (dùng chung với giao diện)
 *   Code.gs    — file này: đọc/ghi Google Sheets, đăng nhập, menu
 *   Index.html — giao diện web (máy tính + điện thoại)
 *
 * Cài đặt & triển khai: xem HUONG-DAN.md
 */

var SHEET = {
  SP: 'Sản Phẩm', SO: 'Sổ Kho', CP: 'Chi Phí', CS: 'Chốt Sổ', TON: 'Tồn Kho', CD: 'Cài Đặt', LOG: 'Nhật Ký'
};
var SP_HEADERS = ['STT', 'Tên sản phẩm', 'Brand', 'ĐV/Thùng', 'Đơn vị tính', 'Trạng thái', 'Ghi chú', 'Phí lưu riêng', 'Phí nhập riêng', 'Phí xuất riêng'];
var OPT_LABELS = ['Tên hiển thị', 'Cho phép xuất âm', 'Đối tác được xem chi phí', 'Bật tính phí kho', 'Phí lưu kho (đ/thùng)', 'Tính phí lưu theo (ngày/tháng)',
  'Phí nhập (đ/thùng)', 'Phí xuất (đ/thùng)', 'Làm tròn lên thùng chẵn', 'Ngày bắt đầu tính phí', 'Tự động ghi phí ngày 1 hằng tháng'];
var CP_HEADERS = ['Mã', 'Ngày', 'Loại phí', 'Số tiền', 'Ghi chú', 'Mã phiếu', 'Người tạo', 'Thời điểm tạo', 'Mã chốt'];
var CS_HEADERS = ['Mã', 'Ngày chốt', 'Từ ngày', 'Đến ngày', 'Số khoản', 'Tổng chi phí', 'Đã thanh toán', 'Ghi chú', 'Người chốt', 'Thời điểm'];
var LOG_HEADERS = ['Thời điểm', 'Tài khoản', 'Tên', 'Vai trò', 'Thao tác', 'Mã', 'Chi tiết'];
var DEFAULT_COST_TYPES = ['Phí Ship Hà Nội - > TPHCM', 'Phí Ship nội vùng TPHCM', 'Quỹ Dự Phòng', 'Tiền Rinh Hàng', 'Mua sắm', 'Ngoài luồng'];
var DEFAULT_UNITS = ['lẻ', 'chai', 'cái', 'hộp', 'tuýp', 'gói'];
var SESSION_DAYS = 30;

// ===================== WEB APP =====================

function doGet() {
  var t = HtmlService.createTemplateFromFile('Index');
  t.core = 'var coreFactory_ = ' + coreFactory_.toString() + ';';
  var company = 'Kho hàng';
  try { company = Store.settings().company; } catch (e) { }
  return t.evaluate()
    .setTitle(company)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    // cho phép nhúng vào trang khác (vd: tên miền riêng trên Hostinger)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function login(u, password) {
  u = String(u || '').trim().toLowerCase();
  var cache = CacheService.getScriptCache(), key = 'F_' + u;
  var fails = Number(cache.get(key) || 0);
  if (fails >= 5) return { ok: false, errors: ['Sai mật khẩu quá nhiều lần. Thử lại sau 10 phút.'] };
  var user = K.checkLogin(Store, u, password);
  if (!user) {
    cache.put(key, String(fails + 1), 600);
    return { ok: false, errors: ['Sai tên đăng nhập hoặc mật khẩu.'] };
  }
  cache.remove(key);
  if (user.role !== 'admin') {
    try { Store.log({ time: Store.now(), u: user.u, name: user.name, role: user.role, action: 'login', ref: '', detail: 'Đăng nhập' }); } catch (e) { }
  }
  var props = PropertiesService.getScriptProperties();
  cleanSessions_(props);
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  props.setProperty('S_' + token, JSON.stringify({ u: user.u, exp: Date.now() + SESSION_DAYS * 864e5 }));
  return { ok: true, token: token, data: K.snapshot(Store, user) };
}

function logout(token) {
  PropertiesService.getScriptProperties().deleteProperty('S_' + token);
  return { ok: true };
}

/** Mọi thao tác từ giao diện đi qua đây */
function api(token, action, payload) {
  var user = sessionUser_(token);
  if (!user) return { ok: false, auth: true, errors: ['Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'] };
  var write = action !== 'data' && action !== 'listUsers';
  var lock = LockService.getScriptLock();
  if (write) lock.waitLock(30000);
  try {
    Store.reset();
    return K.handle(Store, user, action, payload);
  } catch (e) {
    return { ok: false, errors: ['Lỗi máy chủ: ' + (e && e.message || e)] };
  } finally {
    if (write) lock.releaseLock();
  }
}

function sessionUser_(token) {
  if (!token) return null;
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('S_' + token);
  if (!raw) return null;
  var s = JSON.parse(raw);
  if (s.exp < Date.now()) { props.deleteProperty('S_' + token); return null; }
  var rec = Store.users().filter(function (x) { return x.u === s.u; })[0];
  return rec ? { u: rec.u, name: rec.name, role: rec.role } : null;
}

function cleanSessions_(props) {
  var all = props.getProperties(), now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('S_') !== 0) return;
    try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

// ===================== LƯU TRỮ TRÊN GOOGLE SHEETS =====================

function ss_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SSID');
  return SpreadsheetApp.openById(id);
}
function tz_() { return ss_().getSpreadsheetTimeZone(); }
function ymd_(v) { return v instanceof Date ? Utilities.formatDate(v, tz_(), 'yyyy-MM-dd') : String(v || '').trim(); }
function ymdhm_(v) { return v instanceof Date ? Utilities.formatDate(v, tz_(), 'yyyy-MM-dd HH:mm') : String(v || '').trim(); }
function toDate_(ymd) { return ymd ? Utilities.parseDate(ymd, tz_(), 'yyyy-MM-dd') : ''; }

function sheet_(name, headers) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    if (headers) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1f4e78').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function body_(sh, cols) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols).getValues();
}

var Store = {
  _m: {},
  reset: function () { this._m = {}; },
  _memo: function (k, f) { if (!(k in this._m)) this._m[k] = f(); return this._m[k]; },

  now: function () { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm'); },

  // ---- Sản phẩm ----
  products: function () {
    return this._memo('p', function () {
      var seen = {}, out = [];
      body_(ss_().getSheetByName(SHEET.SP), SP_HEADERS.length).forEach(function (r) {
        var name = String(r[1] || '').trim();
        if (!name || seen[name]) return;
        seen[name] = 1;
        var ov = function (v) { return v === '' || v === null ? '' : Number(v) || 0; };
        out.push({ name: name, brand: String(r[2] || 'Khác'), per: Number(r[3]) || 1, unit: String(r[4] || 'lẻ'),
          active: String(r[5]) !== 'Ngừng bán', note: String(r[6] || ''), feeStore: ov(r[7]), feeIn: ov(r[8]), feeOut: ov(r[9]) });
      });
      return out;
    });
  },
  saveProduct: function (p, oldName) {
    var sh = sheet_(SHEET.SP, SP_HEADERS), vals = body_(sh, 2), row = -1;
    vals.forEach(function (r, i) { if (oldName && String(r[1]).trim() === oldName) row = i + 2; });
    var f = function (v) { return v === undefined ? '' : v; };
    var rec = [p.name, p.brand, p.per, p.unit, p.active ? 'Đang bán' : 'Ngừng bán', p.note, f(p.feeStore), f(p.feeIn), f(p.feeOut)];
    if (row > 0) sh.getRange(row, 2, 1, rec.length).setValues([rec]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, rec.length + 1).setValues([[vals.length + 1].concat(rec)]);
    if (oldName && oldName !== p.name) {
      var so = ss_().getSheetByName(SHEET.SO);
      if (so && so.getLastRow() > 1) {
        var rng = so.getRange(2, K.C.TEN + 1, so.getLastRow() - 1, 1), names = rng.getValues();
        rng.setValues(names.map(function (r) { return [r[0] === oldName ? p.name : r[0]]; }));
      }
    }
    this.reset();
  },
  removeProduct: function (name) {
    var sh = ss_().getSheetByName(SHEET.SP), vals = body_(sh, 2);
    for (var i = vals.length - 1; i >= 0; i--) if (String(vals[i][1]).trim() === name) sh.deleteRow(i + 2);
    this.reset();
  },

  // ---- Cài đặt ----
  settings: function () {
    return this._memo('s', function () {
      var sh = ss_().getSheetByName(SHEET.CD);
      var s = { company: 'Kho hàng', khos: ['Kho 1'], brands: [], costTypes: DEFAULT_COST_TYPES.slice(), units: DEFAULT_UNITS.slice(), allowNegative: false, viewerSeeCosts: true,
        fee: K.cleanFee(K.FEE_DEFAULT) };
      if (!sh) return s;
      var last = Math.max(sh.getLastRow(), 2), v = sh.getRange(2, 1, last - 1, 4).getValues(), fx = sh.getRange(2, 9, last - 1, 3).getValues();
      var col = function (i) { return v.map(function (r) { return String(r[i] || '').trim(); }).filter(String); };
      var opt = sh.getRange('G2:G12').getValues();
      s.khos = col(0).length ? col(0) : s.khos;
      s.brands = col(1); s.costTypes = col(2); s.units = col(3).length ? col(3) : s.units;
      s.company = String(opt[0][0] || 'Kho hàng');
      s.allowNegative = opt[1][0] === true;
      s.viewerSeeCosts = opt[2][0] !== false;
      s.fee = K.cleanFee({ on: opt[3][0] === true, storeRate: opt[4][0], storeUnit: String(opt[5][0]).indexOf('ng') === 0 ? 'ngay' : 'thang',
        inRate: opt[6][0], outRate: opt[7][0], roundUp: opt[8][0] === true, start: ymd_(opt[9][0]), auto: opt[10][0] === true,
        fixed: fx.map(function (r) { return { loai: r[0], amount: r[1], note: r[2] }; }) });
      return s;
    });
  },
  saveSettings: function (s) {
    var sh = sheet_(SHEET.CD);
    sh.getRange('A1:D1').setValues([['Kho', 'Brand', 'Loại chi phí', 'Đơn vị tính']]).setFontWeight('bold');
    sh.getRange('F1:G1').setValues([['Tùy chọn', 'Giá trị']]).setFontWeight('bold');
    sh.getRange(2, 6, OPT_LABELS.length, 1).setValues(OPT_LABELS.map(function (x) { return [x]; }));
    var f = K.cleanFee(s.fee);
    var n = Math.max(s.khos.length, s.brands.length, s.costTypes.length, s.units.length, f.fixed.length, sh.getLastRow() - 1, 1);
    var grid = [];
    for (var i = 0; i < n; i++) grid.push([s.khos[i] || '', s.brands[i] || '', s.costTypes[i] || '', s.units[i] || '']);
    sh.getRange(2, 1, n, 4).setValues(grid);
    sh.getRange('I1:K1').setValues([['Phí cố định hằng tháng', 'Số tiền / tháng', 'Ghi chú']]).setFontWeight('bold');
    var fg = [];
    for (var j = 0; j < n; j++) { var x = f.fixed[j]; fg.push(x ? [x.loai, x.amount, x.note] : ['', '', '']); }
    sh.getRange(2, 9, n, 3).setValues(fg);
    sh.getRange(2, 10, n, 1).setNumberFormat('#,##0');
    sh.getRange('G2:G12').setValues([[s.company], [s.allowNegative], [s.viewerSeeCosts], [f.on], [f.storeRate], [f.storeUnit === 'ngay' ? 'ngày' : 'tháng'],
      [f.inRate], [f.outRate], [f.roundUp], [f.start ? toDate_(f.start) : ''], [f.auto]]);
    sh.getRange('G11').setNumberFormat('dd/MM/yyyy');
    this.reset();
    try { syncFeeTrigger_(f.auto && K.hasMonthly(f)); } catch (e) { }
  },

  // ---- Sổ kho ----
  ledger: function () {
    return this._memo('l', function () {
      return body_(ss_().getSheetByName(SHEET.SO), K.SO_HEADERS.length).filter(function (r) { return r[K.C.TEN] !== ''; }).map(function (r) {
        r[K.C.NGAY] = ymd_(r[K.C.NGAY]);
        r[K.C.TAO] = ymdhm_(r[K.C.TAO]);
        r[K.C.SUA] = String(r[K.C.SUA] || '');
        r[K.C.ID] = String(r[K.C.ID] || '');
        return r;
      });
    });
  },
  _toSheetRows: function (rows) {
    return rows.map(function (r) { r = r.slice(); r[K.C.NGAY] = toDate_(r[K.C.NGAY]); return r; });
  },
  appendLedger: function (rows) {
    var sh = sheet_(SHEET.SO, K.SO_HEADERS);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, K.SO_HEADERS.length).setValues(this._toSheetRows(rows));
    this.reset();
  },
  _deleteIdRows: function (sh, id) {
    var ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues(), hit = [];
    ids.forEach(function (r, i) { if (String(r[0]) === id) hit.push(i + 2); });
    // xóa theo cụm liên tiếp từ dưới lên
    for (var k = hit.length - 1; k >= 0;) {
      var end = hit[k], start = end;
      while (k > 0 && hit[k - 1] === start - 1) { start--; k--; }
      sh.deleteRows(start, end - start + 1);
      k--;
    }
    return hit.length;
  },
  replacePhieu: function (id, rows) {
    this._deleteIdRows(ss_().getSheetByName(SHEET.SO), id);
    this.appendLedger(rows);
  },
  removePhieu: function (id) {
    this._deleteIdRows(ss_().getSheetByName(SHEET.SO), id);
    this.reset();
  },

  // ---- Chi phí ----
  costs: function () {
    return this._memo('c', function () {
      return body_(ss_().getSheetByName(SHEET.CP), CP_HEADERS.length).filter(function (r) { return r[0] !== ''; }).map(function (r) {
        return { id: String(r[0]), date: ymd_(r[1]), loai: String(r[2]), amount: Number(r[3]) || 0, note: String(r[4] || ''),
          phieu: String(r[5] || ''), nguoi: String(r[6] || ''), tao: ymdhm_(r[7]), chot: String(r[8] || '') };
      });
    });
  },
  _costRow: function (c) { return [c.id, toDate_(c.date), c.loai, c.amount, c.note, c.phieu, c.nguoi, c.tao, c.chot || '']; },
  appendCosts: function (list) {
    var sh = sheet_(SHEET.CP, CP_HEADERS), self = this;
    sh.getRange(sh.getLastRow() + 1, 1, list.length, CP_HEADERS.length).setValues(list.map(function (c) { return self._costRow(c); }));
    this.reset();
  },
  updateCost: function (c) {
    var sh = ss_().getSheetByName(SHEET.CP), ids = body_(sh, 1);
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === c.id) sh.getRange(i + 2, 1, 1, CP_HEADERS.length).setValues([this._costRow(c)]);
    this.reset();
  },
  removeCost: function (id) {
    var sh = ss_().getSheetByName(SHEET.CP), ids = body_(sh, 1);
    for (var i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === id) sh.deleteRow(i + 2);
    this.reset();
  },

  markCosts: function (ids, chotId) {
    var sh = ss_().getSheetByName(SHEET.CP);
    if (!sh || sh.getLastRow() < 2) return;
    var n = sh.getLastRow() - 1, idv = sh.getRange(2, 1, n, 1).getValues(), rng = sh.getRange(2, 9, n, 1), cur = rng.getValues();
    var set = {};
    ids.forEach(function (x) { set[x] = 1; });
    rng.setValues(idv.map(function (r, i) { return [set[String(r[0])] ? chotId : cur[i][0]]; }));
    this.reset();
  },

  // ---- Chốt sổ chi phí ----
  chots: function () {
    return this._memo('cs', function () {
      return body_(ss_().getSheetByName(SHEET.CS), CS_HEADERS.length).filter(function (r) { return r[0] !== ''; }).map(function (r) {
        return { id: String(r[0]), date: ymd_(r[1]), from: ymd_(r[2]), to: ymd_(r[3]), count: Number(r[4]) || 0, total: Number(r[5]) || 0,
          paid: Number(r[6]) || 0, note: String(r[7] || ''), nguoi: String(r[8] || ''), tao: ymdhm_(r[9]) };
      });
    });
  },
  appendChot: function (x) {
    var sh = sheet_(SHEET.CS, CS_HEADERS);
    sh.getRange(sh.getLastRow() + 1, 1, 1, CS_HEADERS.length)
      .setValues([[x.id, toDate_(x.date), toDate_(x.from), toDate_(x.to), x.count, x.total, x.paid, x.note, x.nguoi, x.tao]]);
    this.reset();
  },
  removeChot: function (id) {
    var sh = ss_().getSheetByName(SHEET.CS), ids = body_(sh, 1);
    for (var i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === id) sh.deleteRow(i + 2);
    this.reset();
  },

  // ---- Nhật ký (chỉ thao tác của nhân viên / đối tác) ----
  log: function (e) {
    var sh = sheet_(SHEET.LOG, LOG_HEADERS);
    sh.appendRow([e.time, e.u, e.name, K.ROLES[e.role] || e.role, K.LOG_LABEL[e.action] || e.action, e.ref, e.detail]);
  },
  logs: function () {
    return body_(ss_().getSheetByName(SHEET.LOG), LOG_HEADERS.length).map(function (r) {
      return { time: ymdhm_(r[0]), u: String(r[1]), name: String(r[2]), role: String(r[3]), action: String(r[4]), ref: String(r[5]), detail: String(r[6]) };
    });
  },

  // ---- Tài khoản (lưu trong Script Properties, không nằm trong Sheet) ----
  users: function () {
    var raw = PropertiesService.getScriptProperties().getProperty('USERS');
    return raw ? JSON.parse(raw) : [];
  },
  saveUsers: function (list) { PropertiesService.getScriptProperties().setProperty('USERS', JSON.stringify(list)); },
  newSalt: function () { return Utilities.getUuid(); },
  hash: function (pw, salt) {
    return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8));
  },
  dropSessions: function (u) {
    var props = PropertiesService.getScriptProperties(), all = props.getProperties();
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('S_') === 0) { try { if (JSON.parse(all[k]).u === u) props.deleteProperty(k); } catch (e) { } }
    });
  },

  afterWrite: function (action) {
    this.reset();
    if (['saveCost', 'deleteCost', 'saveChot', 'deleteChot', 'saveUser', 'deleteUser', 'changePassword'].indexOf(action) < 0) {
      lamMoiTonKho();
    }
  }
};

// ===================== SHEET TỒN KHO (để xem nhanh trong Google Sheets) =====================

function lamMoiTonKho() {
  Store.reset();
  var products = Store.products(), s = Store.settings();
  var st = K.computeStock(K.parseLedger(Store.ledger(), K.productMap(products)));
  var sh = sheet_(SHEET.TON);
  sh.clear();
  var head = ['STT', 'Brand', 'Tên sản phẩm', 'ĐV/Thùng', 'Tồn (đv)', 'Tồn (thùng)', 'Quy đổi'].concat(s.khos).concat(['Cảnh báo']);
  var rows = products.map(function (p, i) {
    var by = st[p.name] || {}, total = 0, neg = [];
    s.khos.forEach(function (k) { total += by[k] || 0; if ((by[k] || 0) < 0) neg.push(k + ' âm'); });
    total = K.round_(total);
    return [i + 1, p.brand, p.name, p.per, total, K.round_(total / p.per), K.fmtThung(total, p.per, p.unit)]
      .concat(s.khos.map(function (k) { return K.fmtThung(by[k] || 0, p.per, p.unit); }))
      .concat([neg.join(', ')]);
  });
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#1f4e78').setFontColor('#ffffff');
  if (rows.length) {
    sh.getRange(2, 1, rows.length, head.length).setValues(rows);
    sh.getRange(2, 6, rows.length, 1).setNumberFormat('0.##');
    var L = colLetter_(head.length);
    sh.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=LEN($' + L + '2)>0')
      .setBackground('#fde2e1').setRanges([sh.getRange(2, 1, rows.length, head.length)]).build()]);
  }
  sh.setFrozenRows(1);
  sh.setColumnWidth(3, 260);
  sh.getRange(1, head.length + 2).setValue('Cập nhật: ' + Store.now() + ' — sheet này tự tạo lại, đừng sửa tay.');
}

function colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Sửa tay Thùng / Lẻ trong sheet Sổ Kho → tự tính lại ĐV/Thùng và Tổng SL của dòng đó */
function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== SHEET.SO || e.range.getRow() < 2) return;
  var c0 = e.range.getColumn(), c1 = c0 + e.range.getNumColumns() - 1;
  if (c1 < K.C.TEN + 1 || c0 > K.C.LE + 1) return;
  Store.reset();
  var pmap = K.productMap(Store.products());
  var rng = sh.getRange(e.range.getRow(), 1, e.range.getNumRows(), K.SO_HEADERS.length), vals = rng.getValues();
  var out = vals.map(function (r) {
    var p = pmap[String(r[K.C.TEN]).trim()];
    if (!p || (r[K.C.THUNG] === '' && r[K.C.LE] === '')) return [r[K.C.DV], r[K.C.SL]];
    return [p.per, K.toUnits(r[K.C.THUNG], r[K.C.LE], p.per)];
  });
  sh.getRange(e.range.getRow(), K.C.DV + 1, out.length, 2).setValues(out);
}

// ===================== PHÍ KHO TỰ ĐỘNG =====================

/** Chạy tự động ngày 1 hằng tháng: ghi phí kho + phí cố định của tháng trước vào Chi Phí (nếu chưa ghi) */
function tuDongGhiPhi() {
  Store.reset();
  var s = Store.settings();
  if (!s.fee.auto || !K.hasMonthly(s.fee)) return;
  var d = new Date();
  d.setDate(0); // ngày cuối tháng trước
  var month = Utilities.formatDate(d, tz_(), 'yyyy-MM');
  K.handle(Store, { u: '_auto', name: 'Tự động', role: 'admin' }, 'postFees', { month: month, auto: true });
}

function syncFeeTrigger_(on) {
  var ts = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'tuDongGhiPhi'; });
  if (on && !ts.length) ScriptApp.newTrigger('tuDongGhiPhi').timeBased().onMonthDay(1).atHour(6).create();
  if (!on) ts.forEach(function (t) { ScriptApp.deleteTrigger(t); });
}

// ===================== MENU TRONG GOOGLE SHEETS =====================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📦 Kho hàng')
    .addItem('🌐 Mở ứng dụng web', 'moUngDung')
    .addItem('🔄 Làm mới Tồn Kho', 'lamMoiTonKho')
    .addSeparator()
    .addItem('⚙️ Cài đặt lần đầu', 'caiDat')
    .addItem('📥 Chuyển dữ liệu từ mẫu cũ', 'chuyenDuLieuCu')
    .addItem('🔑 Đặt lại mật khẩu quản trị', 'datLaiAdmin')
    .addToUi();
}

function moUngDung() {
  var url = ScriptApp.getService().getUrl();
  var html = url
    ? '<p style="font-family:Arial">Link ứng dụng:</p><p><a href="' + url + '" target="_blank" style="font:16px Arial">' + url + '</a></p>'
    : '<p style="font-family:Arial">Chưa triển khai web. Vào Apps Script → <b>Triển khai → Tùy chọn triển khai mới → Ứng dụng web</b> (xem HUONG-DAN).</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(140), 'Ứng dụng kho');
}

/** Tạo sheet + tài khoản quản trị. Chạy lại không mất dữ liệu. */
function caiDat() {
  ensureSheets_();
  if (!Store.users().length) taoAdmin_();
  lamMoiTonKho();
  SpreadsheetApp.getUi().alert('Đã cài đặt xong.\n\nBước tiếp: Apps Script → Triển khai → Ứng dụng web (xem HUONG-DAN).');
}

function ensureSheets_() {
  PropertiesService.getScriptProperties().setProperty('SSID', ss_().getId());
  var sp = sheet_(SHEET.SP, SP_HEADERS);
  sp.getRange(1, 1, 1, SP_HEADERS.length).setValues([SP_HEADERS]).setFontWeight('bold').setBackground('#1f4e78').setFontColor('#ffffff');
  sp.setColumnWidth(2, 260);
  var so = sheet_(SHEET.SO, K.SO_HEADERS);
  so.getRange('B2:B').setNumberFormat('dd/MM/yyyy');
  so.setColumnWidth(5, 240);
  var cp = sheet_(SHEET.CP, CP_HEADERS);
  cp.getRange(1, 1, 1, CP_HEADERS.length).setValues([CP_HEADERS]).setFontWeight('bold').setBackground('#1f4e78').setFontColor('#ffffff');
  cp.getRange('B2:B').setNumberFormat('dd/MM/yyyy');
  cp.getRange('D2:D').setNumberFormat('#,##0');
  var cs = sheet_(SHEET.CS, CS_HEADERS);
  cs.getRange('B2:D').setNumberFormat('dd/MM/yyyy');
  cs.getRange('F2:G').setNumberFormat('#,##0');
  sheet_(SHEET.LOG, LOG_HEADERS).setColumnWidth(7, 520);
  if (!ss_().getSheetByName(SHEET.CD)) {
    var fee0 = K.cleanFee(K.FEE_DEFAULT);
    fee0.fixed = K.FIXED_SAMPLE.slice(); // Tiền Rinh Hàng + Quỹ Dự Phòng như sổ cũ, sửa được trong Biểu phí
    Store.saveSettings({ company: 'Kho hàng', khos: ['Kho 1', 'Kho 2'], brands: [], costTypes: DEFAULT_COST_TYPES.slice(),
      units: DEFAULT_UNITS.slice(), allowNegative: false, viewerSeeCosts: true, fee: fee0 });
  }
  // bổ sung các dòng tùy chọn mới (bản cũ chỉ có 3 dòng) + ô tick
  var cd = ss_().getSheetByName(SHEET.CD);
  Store.reset();
  Store.saveSettings(Store.settings());
  ['G3', 'G4', 'G5', 'G10', 'G12'].forEach(function (a) { if (!cd.getRange(a).getDataValidation()) cd.getRange(a).insertCheckboxes(); });
  sheet_(SHEET.TON);
  Store.reset();
}

function taoAdmin_() {
  var ui = SpreadsheetApp.getUi();
  var a = ui.prompt('Tạo tài khoản quản trị', 'Tên đăng nhập (chữ thường không dấu, vd: admin):', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return false;
  var b = ui.prompt('Tạo tài khoản quản trị', 'Mật khẩu (tối thiểu 6 ký tự):', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return false;
  var res = K.handle(Store, { u: '_setup', name: 'setup', role: 'admin' }, 'saveUser',
    { isNew: true, u: a.getResponseText().trim(), name: 'Quản trị', role: 'admin', password: b.getResponseText() });
  if (!res.ok) { ui.alert(res.errors.join('\n')); return taoAdmin_(); }
  ui.alert('Đã tạo tài khoản quản trị "' + a.getResponseText().trim().toLowerCase() + '".');
  return true;
}

function datLaiAdmin() {
  var ui = SpreadsheetApp.getUi();
  var list = Store.users().filter(function (u) { return u.role === 'admin'; });
  if (!list.length) return taoAdmin_();
  var a = ui.prompt('Đặt lại mật khẩu', 'Tài khoản quản trị: ' + list.map(function (u) { return u.u; }).join(', ') + '\nNhập tên tài khoản:', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  var b = ui.prompt('Đặt lại mật khẩu', 'Mật khẩu mới (tối thiểu 6 ký tự):', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  var u = a.getResponseText().trim().toLowerCase(), rec = list.filter(function (x) { return x.u === u; })[0];
  if (!rec) { ui.alert('Không có tài khoản quản trị "' + u + '".'); return; }
  var res = K.handle(Store, { u: '_setup', name: 'setup', role: 'admin' }, 'saveUser',
    { isNew: false, u: u, name: rec.name, role: 'admin', password: b.getResponseText() });
  ui.alert(res.ok ? 'Đã đổi mật khẩu.' : res.errors.join('\n'));
}

/** Đọc 4 sheet mẫu cũ (Tổng / Nhập / Xuất / Phí Phát Sinh) và đưa vào hệ thống mới */
function chuyenDuLieuCu() {
  var ui = SpreadsheetApp.getUi(), ss = ss_();
  var tong = ss.getSheetByName('Tổng'), nhap = ss.getSheetByName('Nhập'), xuat = ss.getSheetByName('Xuất'), phi = ss.getSheetByName('Phí Phát Sinh');
  if (!tong || !nhap || !xuat) { ui.alert('Không thấy đủ các sheet "Tổng", "Nhập", "Xuất" trong file này.'); return; }
  ensureSheets_();
  if (Store.ledger().length || Store.costs().length) {
    if (ui.alert('Sổ Kho / Chi Phí đã có dữ liệu. Vẫn ghi thêm dữ liệu cũ vào cuối?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  }
  var read = function (sh, cols) {
    if (!sh || sh.getLastRow() < 4) return [];
    return sh.getRange(4, 1, sh.getLastRow() - 3, cols).getValues().map(function (r) { r[0] = ymd_(r[0]); return r; });
  };
  var m = K.migrateOld(read(tong, 4), read(nhap, 6), read(xuat, 6), read(phi, 8), 'Kho 1');

  var have = K.productMap(Store.products());
  m.products.forEach(function (p) { if (!have[p.name]) Store.saveProduct(p, ''); });
  if (m.rows.length) Store.appendLedger(m.rows);
  if (m.costs.length) Store.appendCosts(m.costs);

  var s = Store.settings();
  var merge = function (a, b) { b.forEach(function (x) { if (x && a.indexOf(x) < 0) a.push(x); }); return a; };
  s.khos = merge(s.khos, m.khos); s.brands = merge(s.brands, m.brands); s.costTypes = merge(s.costTypes, m.costTypes);
  Store.saveSettings(s);
  if (!Store.users().length) taoAdmin_();
  lamMoiTonKho();
  ui.alert('Đã chuyển ' + m.rows.length + ' dòng nhập xuất, ' + m.costs.length + ' khoản chi phí, ' + m.products.length + ' sản phẩm.' +
    (m.warnings.length ? '\n\nLưu ý:\n' + m.warnings.slice(0, 15).join('\n') : '') +
    '\n\nBrand và đơn vị tính được đoán theo tên sản phẩm — vào web → Cài đặt → Sản phẩm để chỉnh lại.' +
    '\nCác sheet cũ vẫn giữ nguyên.');
}
