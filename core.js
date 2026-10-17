/**
 * LÕI XỬ LÝ — chạy trên trình duyệt (tính tồn, báo cáo, phí, kiểm tra phiếu, đọc Excel cũ).
 * Máy chủ PHP (lib/kho.php) có cùng nghiệp vụ và là nơi quyết định cuối cùng khi ghi dữ liệu.
 */
function coreFactory_() {

  // ===================== HẰNG SỐ =====================

  var LOAI = {
    NHAP: 'Nhập', XUAT: 'Xuất', CHUYEN_DI: 'Chuyển đi', CHUYEN_DEN: 'Chuyển đến',
    TON_DAU: 'Tồn đầu', DIEU_CHINH: 'Điều chỉnh'
  };
  var LOAI_LIST = [LOAI.NHAP, LOAI.XUAT, LOAI.CHUYEN_DI, LOAI.CHUYEN_DEN, LOAI.TON_DAU, LOAI.DIEU_CHINH];
  var PREFIX = { 'Nhập': 'NK', 'Xuất': 'XK', 'Chuyển đi': 'CK', 'Chuyển đến': 'CK', 'Tồn đầu': 'TD', 'Điều chỉnh': 'DC' };
  var KIND = { NK: 'NHAP', XK: 'XUAT', CK: 'CHUYEN', TD: 'TONDAU', DC: 'DIEUCHINH' };
  var KIND_LABEL = { NHAP: 'Nhập kho', XUAT: 'Xuất kho', CHUYEN: 'Chuyển kho', TONDAU: 'Tồn đầu', DIEUCHINH: 'Điều chỉnh', KIEMKE: 'Kiểm kê' };

  // Cột Sổ Kho (0-based)
  var C = { ID: 0, NGAY: 1, LOAI: 2, KHO: 3, TEN: 4, THUNG: 5, LE: 6, DV: 7, SL: 8, DOITUONG: 9, GHICHU: 10, NGUOI: 11, TAO: 12, SUA: 13 };
  var SO_HEADERS = ['Mã phiếu', 'Ngày', 'Loại', 'Kho', 'Tên sản phẩm', 'Thùng', 'Lẻ', 'ĐV/Thùng', 'Tổng SL (đv)',
    'Đối tượng', 'Ghi chú', 'Người tạo', 'Thời điểm tạo', 'Sửa lần cuối'];

  var ROLES = { admin: 'Quản trị', nhanvien: 'Nhân viên', xem: 'Đối tác (chỉ xem)' };
  var ACL = {
    data: ['admin', 'nhanvien', 'xem'],
    changePassword: ['admin', 'nhanvien', 'xem'],
    savePhieu: ['admin', 'nhanvien'],
    saveCost: ['admin', 'nhanvien'],
    deletePhieu: ['admin'], deleteCost: ['admin'],
    saveProduct: ['admin'], deleteProduct: ['admin'],
    saveSettings: ['admin'],
    listUsers: ['admin'], saveUser: ['admin'], deleteUser: ['admin'],
    listLog: ['admin'], saveChot: ['admin'], deleteChot: ['admin'], postFees: ['admin']
  };
  var FEE_TYPES = { store: 'Phí lưu kho', inn: 'Phí nhập hàng', out: 'Phí xuất hàng' };
  var FEE_DEFAULT = { on: false, storeRate: 0, storeUnit: 'thang', inRate: 0, outRate: 0, roundUp: false, start: '', auto: false, fixed: [] };
  // Mẫu phí cố định theo sổ cũ (mỗi tháng 1 lần)
  var FIXED_SAMPLE = [{ loai: 'Tiền Rinh Hàng', amount: 2000000, note: '' }, { loai: 'Quỹ Dự Phòng', amount: 2000000, note: '' }];
  var READ_ONLY = { data: 1, listUsers: 1, listLog: 1 };
  var LOG_LABEL = { savePhieu: 'Tạo phiếu', saveCost: 'Thêm chi phí', changePassword: 'Đổi mật khẩu', login: 'Đăng nhập' };

  // ===================== SỐ & ĐỊNH DẠNG =====================

  function round_(x) { return Math.round((Number(x) || 0) * 10000) / 10000; }
  function num_(v) {
    if (v === '' || v === null || v === undefined) return 0;
    var n = Number(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  function isBlank_(v) { return v === '' || v === null || v === undefined; }
  function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

  function toUnits(thung, le, perCase) { return round_(num_(thung) * (num_(perCase) || 1) + num_(le)); }

  function splitUnits(units, perCase) {
    perCase = num_(perCase) || 1;
    var sign = units < 0 ? -1 : 1, abs = Math.abs(round_(units));
    var thung = Math.floor(round_(abs / perCase));
    return { thung: sign * thung, le: sign * round_(abs - thung * perCase) };
  }

  /** "3 thùng + 12 chai" */
  function fmtThung(units, perCase, unit) {
    units = round_(units);
    if (units === 0) return '0';
    var s = splitUnits(units, perCase), parts = [];
    if (s.thung) parts.push(Math.abs(s.thung) + ' thùng');
    if (s.le) parts.push(Math.abs(s.le) + ' ' + (unit || 'lẻ'));
    return (units < 0 ? '-' : '') + parts.join(' + ');
  }

  function fmtMoney(n) {
    n = Math.round(num_(n));
    return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  }

  function deltaOf(loai, sl) {
    sl = num_(sl);
    if (loai === LOAI.NHAP || loai === LOAI.CHUYEN_DEN) return Math.abs(sl);
    if (loai === LOAI.XUAT || loai === LOAI.CHUYEN_DI) return -Math.abs(sl);
    if (loai === LOAI.TON_DAU || loai === LOAI.DIEU_CHINH) return sl;
    return 0;
  }

  function kindOfId(id) { return KIND[String(id).slice(0, 2)] || 'KHAC'; }

  // ===================== SỔ KHO =====================

  function productMap(products) {
    var m = {};
    products.forEach(function (p) { m[p.name] = p; });
    return m;
  }

  /** Dòng thô Sổ Kho (ngày dạng 'yyyy-MM-dd') → giao dịch */
  function parseLedger(rows, pmap) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], name = str_(r[C.TEN]);
      if (!name || !r[C.LOAI]) continue;
      var p = pmap[name];
      var per = (p && num_(p.per)) || num_(r[C.DV]) || 1;
      // Tổng SL đã ghi là số chuẩn (đổi ĐV/thùng sau này không làm sai lịch sử); trống thì tính từ Thùng + Lẻ
      var units = !isBlank_(r[C.SL]) ? round_(num_(r[C.SL])) : toUnits(r[C.THUNG], r[C.LE], num_(r[C.DV]) || per);
      var loai = str_(r[C.LOAI]);
      out.push({
        idx: i, id: str_(r[C.ID]), date: str_(r[C.NGAY]), loai: loai, kho: str_(r[C.KHO]), name: name,
        per: per, unit: (p && p.unit) || 'lẻ', units: units, delta: deltaOf(loai, units),
        doiTuong: str_(r[C.DOITUONG]), ghiChu: str_(r[C.GHICHU]), nguoi: str_(r[C.NGUOI]), tao: str_(r[C.TAO]), sua: str_(r[C.SUA])
      });
    }
    return out;
  }

  function computeStock(tx) {
    var st = {};
    tx.forEach(function (t) {
      st[t.name] = st[t.name] || {};
      st[t.name][t.kho] = round_((st[t.name][t.kho] || 0) + t.delta);
    });
    return st;
  }

  function stockAt(st, name, kho) { return (st[name] && st[name][kho]) || 0; }

  /** Gom các dòng thành phiếu, mới nhất trước */
  function groupPhieu(tx) {
    var map = {}, list = [];
    tx.forEach(function (t) {
      var key = t.id || ('?' + t.idx);
      var ph = map[key];
      if (!ph) {
        ph = map[key] = {
          id: t.id, kind: kindOfId(t.id), date: t.date, kho: t.kho, khoDen: '', doiTuong: t.doiTuong, ghiChu: t.ghiChu,
          nguoi: t.nguoi, tao: t.tao, sua: t.sua, lines: [], totalCases: 0, idx: t.idx
        };
        list.push(ph);
      }
      if (t.loai === LOAI.CHUYEN_DEN) { ph.khoDen = t.kho; return; }
      if (t.loai === LOAI.CHUYEN_DI) ph.kho = t.kho;
      ph.lines.push({ name: t.name, units: t.units, signed: t.delta, per: t.per, unit: t.unit, ghiChu: t.ghiChu, kho: t.kho });
      ph.totalCases = round_(ph.totalCases + Math.abs(t.units) / t.per);
    });
    list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.id !== b.id) return a.id < b.id ? 1 : -1;
      return b.idx - a.idx;
    });
    return list;
  }

  /**
   * Kiểm tra phiếu. p = { id?, type: NHAP|XUAT|CHUYEN|KIEMKE, date, kho, khoDen, doiTuong, ghiChu, lines:[{name,thung,le}] }
   * stock: tồn đã loại trừ chính phiếu đang sửa.
   */
  function validatePhieu(p, pmap, khos, stock, allowNegative) {
    var errs = [];
    if (['NHAP', 'XUAT', 'CHUYEN', 'KIEMKE'].indexOf(p.type) < 0) errs.push('Loại phiếu không hợp lệ.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) errs.push('Chưa chọn ngày.');
    if (khos.indexOf(p.kho) < 0) errs.push('Kho không hợp lệ: ' + p.kho);
    if (p.type === 'CHUYEN') {
      if (khos.indexOf(p.khoDen) < 0) errs.push('Chưa chọn kho đến.');
      else if (p.khoDen === p.kho) errs.push('Kho đến phải khác kho đi.');
    }
    var lines = (p.lines || []).filter(function (l) { return l && (str_(l.name) || num_(l.thung) || num_(l.le)); });
    if (!lines.length) errs.push('Phiếu chưa có mặt hàng nào.');
    var need = {}, seen = {};
    lines.forEach(function (l, i) {
      var name = str_(l.name), label = 'Dòng ' + (i + 1) + ': ';
      if (!pmap[name]) { errs.push(label + 'không có sản phẩm "' + name + '".'); return; }
      if (num_(l.thung) < 0 || num_(l.le) < 0) { errs.push(label + 'số lượng không được âm.'); return; }
      var u = toUnits(l.thung, l.le, pmap[name].per);
      if (p.type === 'KIEMKE') {
        if (seen[name]) errs.push(label + '"' + name + '" bị lặp trong phiếu kiểm kê.');
        seen[name] = true;
        return;
      }
      if (u <= 0) { errs.push(label + 'chưa nhập số thùng / số lẻ.'); return; }
      need[name] = round_((need[name] || 0) + u);
    });
    if (!allowNegative && (p.type === 'XUAT' || p.type === 'CHUYEN')) {
      Object.keys(need).forEach(function (name) {
        var have = stockAt(stock, name, p.kho), pr = pmap[name];
        if (need[name] > have + 1e-9) {
          errs.push('"' + name + '" tại ' + p.kho + ' chỉ còn ' + fmtThung(have, pr.per, pr.unit) +
            ', không đủ ' + fmtThung(need[name], pr.per, pr.unit) + '.');
        }
      });
    }
    return errs;
  }

  function nextPhieuId(existingIds, prefix, ymd) {
    var head = prefix + '-' + ymd.slice(2).replace(/-/g, '') + '-', max = 0;
    existingIds.forEach(function (id) {
      id = String(id);
      if (id.indexOf(head) === 0) max = Math.max(max, parseInt(id.slice(head.length), 10) || 0);
    });
    return head + ('0' + (max + 1)).slice(-2);
  }

  /** Phiếu → dòng Sổ Kho */
  function phieuToRows(p, pmap, id, user, now, stock) {
    var rows = [];
    p.lines.forEach(function (l) {
      var name = str_(l.name);
      if (!pmap[name]) return;
      var per = pmap[name].per, units = toUnits(l.thung, l.le, per);
      var row = function (loai, kho, u, note) {
        var s = splitUnits(u, per);
        return [id, p.date, loai, kho, name, s.thung, s.le, per, u, str_(p.doiTuong), note, user || '', now, ''];
      };
      var note = str_(l.ghiChu) || str_(p.ghiChu);
      if (p.type === 'NHAP') { if (units > 0) rows.push(row(LOAI.NHAP, p.kho, units, note)); }
      else if (p.type === 'XUAT') { if (units > 0) rows.push(row(LOAI.XUAT, p.kho, units, note)); }
      else if (p.type === 'CHUYEN') {
        if (units > 0) { rows.push(row(LOAI.CHUYEN_DI, p.kho, units, note)); rows.push(row(LOAI.CHUYEN_DEN, p.khoDen, units, note)); }
      } else if (p.type === 'KIEMKE') {
        var cur = stockAt(stock, name, p.kho), diff = round_(units - cur);
        if (diff !== 0) {
          var unit = pmap[name].unit;
          rows.push(row(LOAI.DIEU_CHINH, p.kho, diff, ('Kiểm kê: thực tế ' + fmtThung(units, per, unit) + ', sổ ' + fmtThung(cur, per, unit) + '. ' + str_(p.ghiChu)).trim()));
        }
      }
    });
    return rows;
  }

  function buildPeriodReport(tx, products, from, to, kho) {
    var by = {}, order = [];
    var mk = function (name, per, unit, brand) {
      order.push(name);
      return by[name] = { name: name, per: per, unit: unit, brand: brand || '', dau: 0, nhap: 0, xuat: 0, chuyen: 0, dc: 0 };
    };
    products.forEach(function (p) { mk(p.name, p.per, p.unit, p.brand); });
    tx.forEach(function (t) {
      if (kho && t.kho !== kho) return;
      if (to && t.date > to) return;
      var b = by[t.name] || mk(t.name, t.per, t.unit, '');
      // Tồn đầu (kể cả ghi trong kỳ) luôn tính vào cột tồn đầu kỳ
      if ((from && t.date < from) || t.loai === LOAI.TON_DAU) { b.dau += t.delta; return; }
      if (t.loai === LOAI.NHAP) b.nhap += t.units;
      else if (t.loai === LOAI.XUAT) b.xuat += t.units;
      else if (t.loai === LOAI.CHUYEN_DI || t.loai === LOAI.CHUYEN_DEN) b.chuyen += t.delta;
      else b.dc += t.delta;
    });
    return order.map(function (k) {
      var b = by[k];
      ['dau', 'nhap', 'xuat', 'chuyen', 'dc'].forEach(function (f) { b[f] = round_(b[f]); });
      b.cuoi = round_(b.dau + b.nhap - b.xuat + b.chuyen + b.dc);
      return b;
    });
  }

  function buildCard(tx, name, kho) {
    var list = tx.filter(function (t) { return t.name === name && (!kho || t.kho === kho); });
    list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.idx - b.idx; });
    var bal = 0;
    return list.map(function (t) {
      bal = round_(bal + t.delta);
      return {
        date: t.date, id: t.id, loai: t.loai, kho: t.kho, doiTuong: t.doiTuong, ghiChu: t.ghiChu,
        delta: t.delta, deltaText: (t.delta > 0 ? '+' : '') + fmtThung(t.delta, t.per, t.unit),
        balance: bal, balanceText: fmtThung(bal, t.per, t.unit)
      };
    });
  }

  // ===================== CHUYỂN DỮ LIỆU CŨ =====================

  var BRANDS = ['Roug', 'Fanftcy', 'Butter', 'Cinplus', 'Surker', '2VEE', 'Chaoba', 'Texture'];
  function guessBrand(name) {
    for (var i = 0; i < BRANDS.length; i++) if (name.toLowerCase().indexOf(BRANDS[i].toLowerCase()) >= 0) return BRANDS[i];
    return 'Khác';
  }
  function guessUnit(name) {
    var n = name.toLowerCase();
    if (/\d\s*ml/.test(n) || n.indexOf('gôm') >= 0 || n.indexOf('spray') >= 0 || n.indexOf('mousse') >= 0) return 'chai';
    if (n.indexOf('máy') >= 0 || n.indexOf('lược') >= 0) return 'cái';
    return 'lẻ';
  }

  /** tong/nhap/xuat/phi: mảng giá trị từ dòng 4 (ngày đã đổi sang 'yyyy-MM-dd' hoặc '') */
  function migrateOld(tong, nhap, xuat, phi, khoMacDinh) {
    khoMacDinh = khoMacDinh || 'Kho 1';
    var products = [], per = {}, warnings = [], khos = [khoMacDinh];
    tong.forEach(function (r) {
      var name = str_(r[1]);
      if (!name || per[name]) return;
      per[name] = num_(r[2]) || 1;
      products.push({ name: name, brand: guessBrand(name), per: per[name], unit: guessUnit(name), active: true, note: '', tonTruoc: num_(r[3]) });
    });
    var rows = [], ids = [], firstDate = null;

    function walk(values, kind) {
      var curDate = null, groupNote = '', groups = {};
      values.forEach(function (r, i) {
        var name = str_(r[1]);
        if (r[0]) { curDate = str_(r[0]); groupNote = str_(r[5]); }
        if (!name) return;
        if (!curDate) { warnings.push(kind + ' dòng ' + (i + 4) + ': không có ngày, bỏ qua.'); return; }
        if (!per[name]) {
          per[name] = (num_(r[2]) ? round_(num_(r[3]) / num_(r[2])) : 1) || 1;
          products.push({ name: name, brand: guessBrand(name), per: per[name], unit: guessUnit(name), active: true, note: '', tonTruoc: 0 });
          warnings.push('Thêm sản phẩm "' + name + '" (ĐV/Thùng tạm = ' + per[name] + ').');
        }
        var units = typeof r[3] === 'number' ? round_(r[3]) : toUnits(r[2], 0, per[name]);
        if (!units) return;
        var loai = kind === 'Xuất' ? LOAI.XUAT : /tồn/i.test(groupNote) ? LOAI.TON_DAU : units < 0 ? LOAI.DIEU_CHINH : LOAI.NHAP;
        if (loai === LOAI.NHAP || loai === LOAI.XUAT) units = Math.abs(units);
        var key = curDate + '|' + loai;
        if (!groups[key]) { groups[key] = nextPhieuId(ids, PREFIX[loai], curDate); ids.push(groups[key]); }
        if (!firstDate || curDate < firstDate) firstDate = curDate;
        var kho = str_(r[4]) || khoMacDinh;
        if (khos.indexOf(kho) < 0) khos.push(kho);
        var s = splitUnits(units, per[name]);
        rows.push([groups[key], curDate, loai, kho, name, s.thung, s.le, per[name], units, '', str_(r[5]), 'dữ liệu cũ', '', '']);
      });
    }
    walk(nhap, 'Nhập');
    walk(xuat, 'Xuất');

    var tonTruoc = products.filter(function (p) { return p.tonTruoc; });
    if (tonTruoc.length) {
      var d = firstDate || '2000-01-01', id = nextPhieuId(ids, 'TD', d);
      tonTruoc.forEach(function (p) {
        var s = splitUnits(p.tonTruoc, p.per);
        rows.unshift([id, d, LOAI.TON_DAU, khoMacDinh, p.name, s.thung, s.le, p.per, p.tonTruoc, '', 'Tồn trước (sheet Tổng cũ)', 'dữ liệu cũ', '', '']);
      });
    }

    // Phí Phát Sinh: Ngày | Nội dung (loại) | Giá trị | Ghi chú | … | H: danh sách loại phí
    var costs = [], costTypes = [], cIds = [], cur = null;
    (phi || []).forEach(function (r) {
      var t = str_(r[7]);
      if (t && costTypes.indexOf(t) < 0) costTypes.push(t);
    });
    (phi || []).forEach(function (r) {
      if (r[0]) cur = str_(r[0]);
      var loai = str_(r[1]), amount = num_(r[2]);
      if (!loai && !amount) return;
      if (!cur) { warnings.push('Chi phí "' + loai + '" không có ngày, bỏ qua.'); return; }
      if (loai && costTypes.indexOf(loai) < 0) costTypes.push(loai);
      var id = nextPhieuId(cIds, 'CP', cur); cIds.push(id);
      costs.push({ id: id, date: cur, loai: loai || 'Khác', amount: amount, note: str_(r[3]), phieu: '', nguoi: 'dữ liệu cũ', tao: '', chot: '' });
    });

    var brands = [];
    products.forEach(function (p) { if (brands.indexOf(p.brand) < 0) brands.push(p.brand); });
    products.forEach(function (p) { delete p.tonTruoc; });
    return { products: products, rows: rows, costs: costs, costTypes: costTypes, brands: brands, khos: khos, warnings: warnings };
  }

  // ===================== PHÍ KHO (lưu kho / nhập / xuất theo thùng) =====================

  function ymdAdd_(s, n) {
    var p = s.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
  }
  function daysInMonth_(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate(); }
  function monthRange(m) { return { from: m + '-01', to: m + '-' + ('0' + daysInMonth_(m + '-01')).slice(-2) }; }

  /** Đơn giá của 1 sản phẩm: giá riêng (nếu có) hoặc giá mặc định */
  function feeRates(p, fee) {
    var g = function (v, d) { return v === '' || v === null || v === undefined ? num_(d) : num_(v); };
    return { store: g(p && p.feeStore, fee.storeRate), inn: g(p && p.feeIn, fee.inRate), out: g(p && p.feeOut, fee.outRate) };
  }

  /**
   * Tính phí kho trong khoảng [from, to].
   * - Lưu kho: tồn cuối mỗi ngày (thùng, gộp mọi kho; tồn âm tính 0) × đơn giá/ngày
   *   (đơn giá theo tháng được chia cho số ngày của tháng đó).
   * - Nhập / xuất: số thùng của phiếu Nhập / Xuất × đơn giá. Chuyển kho, kiểm kê, tồn đầu không tính.
   */
  function computeFees(tx, products, fee, from, to) {
    fee = fee || FEE_DEFAULT;
    if (fee.start && from < fee.start) from = fee.start;
    var res = { from: from, to: to, days: 0, rows: [], caseDays: 0, storeFee: 0, inCases: 0, inFee: 0, outCases: 0, outFee: 0, total: 0 };
    if (!from || !to || from > to) return res;
    var pm = productMap(products), by = {};
    var cases = function (u, per) { var c = Math.max(0, u) / per; return fee.roundUp ? Math.ceil(c - 1e-9) : c; };
    tx.forEach(function (t) {
      if (t.date > to) return;
      var b = by[t.name] || (by[t.name] = { open: 0, ch: {}, inC: 0, outC: 0, per: t.per });
      if (t.date < from) { b.open += t.delta; return; }
      b.ch[t.date] = (b.ch[t.date] || 0) + t.delta;
      if (t.loai === LOAI.NHAP) b.inC += cases(Math.abs(t.units), t.per);
      else if (t.loai === LOAI.XUAT) b.outC += cases(Math.abs(t.units), t.per);
    });
    var days = [];
    for (var d = from; d <= to; d = ymdAdd_(d, 1)) days.push(d);
    res.days = days.length;
    Object.keys(by).forEach(function (name) {
      var b = by[name], p = pm[name], per = (p && num_(p.per)) || b.per || 1, r = feeRates(p, fee);
      var bal = b.open, cd = 0, sf = 0;
      days.forEach(function (d) {
        bal = round_(bal + (b.ch[d] || 0));
        var c = cases(bal, per);
        cd += c;
        sf += c * (fee.storeUnit === 'thang' ? r.store / daysInMonth_(d) : r.store);
      });
      var row = { name: name, per: per, unit: (p && p.unit) || 'lẻ', rates: r, caseDays: round_(cd), storeFee: Math.round(sf),
        inCases: round_(b.inC), inFee: Math.round(b.inC * r.inn), outCases: round_(b.outC), outFee: Math.round(b.outC * r.out), endCases: round_(Math.max(0, bal) / per) };
      row.total = row.storeFee + row.inFee + row.outFee;
      if (row.caseDays || row.inCases || row.outCases) res.rows.push(row);
    });
    res.rows.sort(function (a, b) { return b.total - a.total; });
    res.rows.forEach(function (r) {
      res.caseDays += r.caseDays; res.storeFee += r.storeFee; res.inCases += r.inCases; res.inFee += r.inFee;
      res.outCases += r.outCases; res.outFee += r.outFee;
    });
    ['caseDays', 'inCases', 'outCases'].forEach(function (k) { res[k] = round_(res[k]); });
    res.total = res.storeFee + res.inFee + res.outFee;
    return res;
  }

  function cleanFee_(f) {
    f = f || {};
    var ymd = /^\d{4}-\d{2}-\d{2}$/.test(str_(f.start)) ? str_(f.start) : '';
    return { on: !!f.on, storeRate: Math.max(0, num_(f.storeRate)), storeUnit: f.storeUnit === 'ngay' ? 'ngay' : 'thang',
      inRate: Math.max(0, num_(f.inRate)), outRate: Math.max(0, num_(f.outRate)), roundUp: !!f.roundUp, start: ymd, auto: !!f.auto,
      fixed: (f.fixed || []).map(function (x) { return { loai: str_(x && x.loai), amount: Math.max(0, Math.round(num_(x && x.amount))), note: str_(x && x.note) }; })
        .filter(function (x) { return x.loai && x.amount > 0; }) };
  }

  /** Có khoản phí hằng tháng nào để ghi không (phí kho hoặc phí cố định) */
  function hasMonthly(fee) { return !!(fee && (fee.on || (fee.fixed && fee.fixed.length))); }

  /**
   * Toàn bộ phí của 1 tháng: phí kho (nếu bật) + phí cố định hằng tháng.
   * upTo: tính phí kho đến ngày này (tạm tính tháng đang chạy).
   */
  function monthCharges(tx, products, fee, month, upTo) {
    fee = cleanFee_(fee);
    var mr = monthRange(month), label = 'Tháng ' + month.slice(5) + '/' + month.slice(0, 4);
    var to = upTo && upTo < mr.to ? upTo : mr.to;
    var f = fee.on ? computeFees(tx, products, fee, mr.from, to) : computeFees([], [], fee, mr.from, to);
    var items = [];
    if (f.storeFee) items.push({ loai: FEE_TYPES.store, amount: f.storeFee, note: label + ': ' + vnNum_(f.caseDays) + ' thùng-ngày', kind: 'kho' });
    if (f.inFee) items.push({ loai: FEE_TYPES.inn, amount: f.inFee, note: label + ': ' + vnNum_(f.inCases) + ' thùng nhập', kind: 'kho' });
    if (f.outFee) items.push({ loai: FEE_TYPES.out, amount: f.outFee, note: label + ': ' + vnNum_(f.outCases) + ' thùng xuất', kind: 'kho' });
    var fixedOn = !fee.start || mr.to >= fee.start;
    if (fixedOn) fee.fixed.forEach(function (x) { items.push({ loai: x.loai, amount: x.amount, note: label + (x.note ? ' · ' + x.note : ''), kind: 'codinh' }); });
    var fixedTotal = 0;
    items.forEach(function (it) { if (it.kind === 'codinh') fixedTotal += it.amount; });
    return { month: month, label: label, from: mr.from, to: mr.to, fees: f, items: items, fixedTotal: fixedTotal, total: f.total + fixedTotal };
  }
  function vnNum_(x) { return String(round_(x)).replace('.', ','); }

  // ===================== API (phân quyền + xử lý) =====================

  function can(role, action) { return (ACL[action] || []).indexOf(role) >= 0; }

  function snapshot(store, user) {
    var s = store.settings();
    var seeCost = user.role !== 'xem' || s.viewerSeeCosts;
    return {
      me: { u: user.u, name: user.name, role: user.role },
      settings: s,
      products: store.products(),
      ledger: store.ledger(),
      costs: seeCost ? store.costs() : null,
      chots: seeCost ? store.chots() : null
    };
  }

  /**
   * Công nợ chi phí: tổng chi phí − tổng đã thanh toán.
   * Chi phí chưa chốt = các khoản chưa thuộc đợt chốt nào.
   */
  function costDebt(costs, chots) {
    var total = 0, paid = 0, open = 0, openN = 0, since = '';
    (costs || []).forEach(function (c) {
      total += num_(c.amount);
      if (!c.chot) { open += num_(c.amount); openN++; if (!since || c.date < since) since = c.date; }
    });
    (chots || []).forEach(function (x) { paid += num_(x.paid); });
    var balance = round_(total - paid);
    return { total: round_(total), paid: round_(paid), open: round_(open), openN: openN, since: since,
      carry: round_(balance - open), balance: balance };
  }

  /** Mô tả ngắn 1 phiếu (dùng cho nhật ký) */
  function describePhieu(p, pmap) {
    var head = (KIND_LABEL[p.type] || p.type) + ' ' + (p.type === 'CHUYEN' ? p.kho + ' → ' + p.khoDen : p.kho) + ' ngày ' + p.date;
    var items = (p.lines || []).filter(function (l) { return pmap[str_(l.name)]; }).map(function (l) {
      var pr = pmap[str_(l.name)];
      return str_(l.name) + ' ' + fmtThung(toUnits(l.thung, l.le, pr.per), pr.per, pr.unit);
    });
    return head + (p.doiTuong ? ' · ' + p.doiTuong : '') + ': ' + items.join('; ');
  }

  function costRowOk_(c, s) {
    var e = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date || '')) e.push('Chi phí: chưa chọn ngày.');
    if (!str_(c.loai)) e.push('Chi phí: chưa chọn loại phí.');
    if (!(num_(c.amount) > 0)) e.push('Chi phí "' + str_(c.loai) + '": số tiền phải lớn hơn 0.');
    return e;
  }

  /**
   * Xử lý 1 yêu cầu. user = { u, name, role }.
   * Trả { ok:true, data?, id? } hoặc { ok:false, errors:[...] }.
   */
  function handle(store, user, action, p) {
    if (!ACL[action]) return { ok: false, errors: ['Thao tác không tồn tại: ' + action] };
    if (!can(user.role, action)) return { ok: false, errors: ['Tài khoản của bạn không có quyền thực hiện thao tác này.'] };
    p = p || {};
    var res = actions[action](store, user, p);
    // Nhật ký: chỉ ghi thao tác của nhân viên / đối tác. Quản trị không để lại dấu vết.
    if (res.ok && res.log && user.role !== 'admin' && store.log) {
      store.log({ time: store.now(), u: user.u, name: user.name, role: user.role, action: action, ref: res.id || '', detail: res.log });
    }
    delete res.log;
    if (res.ok && !READ_ONLY[action]) {
      if (store.afterWrite) store.afterWrite(action);
      res.data = snapshot(store, user);
    }
    return res;
  }

  var actions = {
    data: function (store, user) { return { ok: true, data: snapshot(store, user) }; },

    savePhieu: function (store, user, p) {
      var editing = !!p.id;
      if ((editing || p.type === 'KIEMKE') && user.role !== 'admin')
        return { ok: false, errors: ['Chỉ quản trị viên được sửa phiếu / kiểm kê.'] };
      var s = store.settings(), products = store.products(), pmap = productMap(products);
      var raw = store.ledger();
      var others = raw;
      if (editing) {
        var exists = raw.some(function (r) { return r[C.ID] === p.id; });
        if (!exists) return { ok: false, errors: ['Không tìm thấy phiếu ' + p.id] };
        var k = kindOfId(p.id);
        if (['NHAP', 'XUAT', 'CHUYEN'].indexOf(k) < 0) return { ok: false, errors: ['Phiếu loại này chỉ có thể hủy, không sửa được.'] };
        p.type = k;
        others = raw.filter(function (r) { return r[C.ID] !== p.id; });
      }
      var stock = computeStock(parseLedger(others, pmap));
      var errs = validatePhieu(p, pmap, s.khos, stock, s.allowNegative);
      var costs = (p.costs || []).filter(function (c) { return c && (str_(c.loai) || num_(c.amount)); });
      costs.forEach(function (c) { c.date = p.date; errs = errs.concat(costRowOk_(c, s)); });
      if (errs.length) return { ok: false, errors: errs };

      var now = store.now();
      var id = editing ? p.id : nextPhieuId(raw.map(function (r) { return r[C.ID]; }),
        { NHAP: 'NK', XUAT: 'XK', CHUYEN: 'CK', KIEMKE: 'DC' }[p.type], p.date);
      var rows = phieuToRows(p, pmap, id, user.name, now, stock);
      if (!rows.length) return { ok: false, errors: p.type === 'KIEMKE' ? ['Số kiểm kê khớp với sổ, không cần điều chỉnh.'] : ['Phiếu không có dòng hợp lệ.'] };
      if (editing) {
        var old = raw.filter(function (r) { return r[C.ID] === p.id; })[0];
        // quản trị sửa: giữ nguyên người tạo / thời điểm tạo, không ghi dấu vết
        rows.forEach(function (r) { r[C.NGUOI] = old[C.NGUOI]; r[C.TAO] = old[C.TAO]; r[C.SUA] = ''; });
        store.replacePhieu(p.id, rows);
      } else {
        store.appendLedger(rows);
      }
      if (costs.length) {
        var cIds = store.costs().map(function (c) { return c.id; });
        store.appendCosts(costs.map(function (c) {
          var cid = nextPhieuId(cIds, 'CP', p.date); cIds.push(cid);
          return { id: cid, date: p.date, loai: str_(c.loai), amount: num_(c.amount), note: str_(c.note), phieu: id, nguoi: user.name, tao: now, chot: '' };
        }));
      }
      var log = 'Tạo ' + id + ' — ' + describePhieu(p, pmap);
      if (costs.length) log += ' | Chi phí: ' + costs.map(function (c) { return str_(c.loai) + ' ' + fmtMoney(c.amount); }).join('; ');
      return { ok: true, id: id, log: log };
    },

    deletePhieu: function (store, user, p) {
      if (!store.ledger().some(function (r) { return r[C.ID] === p.id; })) return { ok: false, errors: ['Không tìm thấy phiếu ' + p.id] };
      store.removePhieu(p.id); // xóa hẳn, không lưu lại
      return { ok: true, id: p.id };
    },

    saveCost: function (store, user, c) {
      var s = store.settings(), errs = costRowOk_(c, s);
      if (errs.length) return { ok: false, errors: errs };
      var list = store.costs();
      if (c.id) {
        if (user.role !== 'admin') return { ok: false, errors: ['Chỉ quản trị viên được sửa chi phí.'] };
        var old = list.filter(function (x) { return x.id === c.id; })[0];
        if (!old) return { ok: false, errors: ['Không tìm thấy chi phí ' + c.id] };
        store.updateCost({ id: c.id, date: c.date, loai: str_(c.loai), amount: num_(c.amount), note: str_(c.note), phieu: str_(c.phieu), nguoi: old.nguoi, tao: old.tao, chot: old.chot || '' });
        return { ok: true, id: c.id };
      }
      var id = nextPhieuId(list.map(function (x) { return x.id; }), 'CP', c.date);
      store.appendCosts([{ id: id, date: c.date, loai: str_(c.loai), amount: num_(c.amount), note: str_(c.note), phieu: str_(c.phieu), nguoi: user.name, tao: store.now(), chot: '' }]);
      return { ok: true, id: id, log: 'Thêm chi phí ' + id + ' ngày ' + c.date + ': ' + str_(c.loai) + ' ' + fmtMoney(c.amount) + (str_(c.note) ? ' (' + str_(c.note) + ')' : '') };
    },

    deleteCost: function (store, user, p) {
      if (!store.costs().some(function (c) { return c.id === p.id; })) return { ok: false, errors: ['Không tìm thấy chi phí ' + p.id] };
      store.removeCost(p.id);
      return { ok: true };
    },

    /** Chốt sổ chi phí: gom mọi khoản chưa chốt đến ngày chốt, ghi số tiền đã thanh toán */
    saveChot: function (store, user, p) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) return { ok: false, errors: ['Chưa chọn ngày chốt.'] };
      var paid = num_(p.paid);
      if (paid < 0) return { ok: false, errors: ['Số tiền thanh toán không được âm.'] };
      var open = store.costs().filter(function (c) { return !c.chot && c.date <= p.date; });
      if (!open.length && !paid) return { ok: false, errors: ['Không có khoản chi phí nào chưa chốt đến ngày ' + p.date + '.'] };
      var chots = store.chots();
      var id = nextPhieuId(chots.map(function (x) { return x.id; }), 'CS', p.date);
      var total = 0, from = '';
      open.forEach(function (c) { total += num_(c.amount); if (!from || c.date < from) from = c.date; });
      store.appendChot({ id: id, date: p.date, from: from, to: p.date, count: open.length, total: round_(total), paid: paid,
        note: str_(p.note), nguoi: user.name, tao: store.now() });
      if (open.length) store.markCosts(open.map(function (c) { return c.id; }), id);
      return { ok: true, id: id };
    },

    /** Mở lại đợt chốt: các khoản trở lại "chưa chốt" */
    deleteChot: function (store, user, p) {
      if (!store.chots().some(function (x) { return x.id === p.id; })) return { ok: false, errors: ['Không tìm thấy đợt chốt ' + p.id] };
      var ids = store.costs().filter(function (c) { return c.chot === p.id; }).map(function (c) { return c.id; });
      if (ids.length) store.markCosts(ids, '');
      store.removeChot(p.id);
      return { ok: true };
    },

    /** Ghi phí kho 1 tháng đã kết thúc thành các khoản chi phí (ghi lại thì thay bản cũ) */
    postFees: function (store, user, p) {
      var s = store.settings(), fee = cleanFee_(s.fee);
      if (!hasMonthly(fee)) return { ok: false, errors: ['Chưa cài phí kho hoặc phí cố định hằng tháng (Cài đặt → Biểu phí).'] };
      if (!/^\d{4}-\d{2}$/.test(p.month || '')) return { ok: false, errors: ['Chưa chọn tháng.'] };
      var mr = monthRange(p.month), label = 'Tháng ' + p.month.slice(5) + '/' + p.month.slice(0, 4);
      if (mr.to >= store.now().slice(0, 10)) return { ok: false, errors: [label + ' chưa kết thúc, chỉ ghi được khi hết tháng.'] };
      var ref = 'PHI-' + p.month;
      var existing = store.costs().filter(function (c) { return c.phieu === ref; });
      var locked = existing.filter(function (c) { return c.chot; })[0];
      if (locked) return { ok: false, errors: ['Phí ' + label + ' đã nằm trong đợt chốt ' + locked.chot + '. Mở lại đợt chốt trước nếu muốn ghi lại.'] };
      if (existing.length && p.auto) return { ok: true, id: ref, skipped: true };
      var products = store.products();
      var mc = monthCharges(parseLedger(store.ledger(), productMap(products)), products, fee, p.month);
      var items = mc.items;
      if (!items.length) return { ok: false, errors: ['Không có phí phát sinh trong ' + label + '.'] };
      existing.forEach(function (c) { store.removeCost(c.id); });
      var missing = [];
      items.forEach(function (it) { if (s.costTypes.indexOf(it.loai) < 0 && missing.indexOf(it.loai) < 0) missing.push(it.loai); });
      if (missing.length) { s.costTypes = s.costTypes.concat(missing); store.saveSettings(s); }
      var ids = store.costs().map(function (c) { return c.id; }), now = store.now();
      store.appendCosts(items.map(function (it) {
        var id = nextPhieuId(ids, 'CP', mr.to); ids.push(id);
        return { id: id, date: mr.to, loai: it.loai, amount: it.amount, note: it.note, phieu: ref, nguoi: user.name, tao: now, chot: '' };
      }));
      return { ok: true, id: ref, total: mc.total, replaced: existing.length > 0 };
    },

    listLog: function (store) {
      return { ok: true, logs: (store.logs ? store.logs() : []).slice(-1000).reverse() };
    },

    saveProduct: function (store, user, p) {
      var name = str_(p.name), oldName = str_(p.oldName), errs = [];
      if (!name) errs.push('Chưa nhập tên sản phẩm.');
      if (!(num_(p.per) > 0)) errs.push('ĐV/Thùng phải lớn hơn 0.');
      var list = store.products();
      if (name !== oldName && list.some(function (x) { return x.name === name; })) errs.push('Đã có sản phẩm tên "' + name + '".');
      if (oldName && !list.some(function (x) { return x.name === oldName; })) errs.push('Không tìm thấy sản phẩm "' + oldName + '".');
      if (errs.length) return { ok: false, errors: errs };
      var ov = function (v) { return v === '' || v === null || v === undefined ? '' : Math.max(0, num_(v)); };
      store.saveProduct({ name: name, brand: str_(p.brand) || 'Khác', per: num_(p.per), unit: str_(p.unit) || 'lẻ', active: p.active !== false, note: str_(p.note),
        feeStore: ov(p.feeStore), feeIn: ov(p.feeIn), feeOut: ov(p.feeOut) }, oldName);
      return { ok: true };
    },

    deleteProduct: function (store, user, p) {
      var used = store.ledger().some(function (r) { return r[C.TEN] === p.name; });
      if (used) return { ok: false, errors: ['Sản phẩm đã có giao dịch, không xóa được. Hãy chuyển trạng thái sang "Ngừng bán".'] };
      store.removeProduct(p.name);
      return { ok: true };
    },

    saveSettings: function (store, user, p) {
      var clean = function (a) {
        var out = [];
        (a || []).forEach(function (x) { x = str_(x); if (x && out.indexOf(x) < 0) out.push(x); });
        return out;
      };
      var s = {
        company: str_(p.company) || 'Kho hàng',
        khos: clean(p.khos), brands: clean(p.brands), costTypes: clean(p.costTypes), units: clean(p.units),
        allowNegative: !!p.allowNegative, viewerSeeCosts: !!p.viewerSeeCosts, fee: cleanFee_(p.fee)
      };
      if (!s.khos.length) return { ok: false, errors: ['Cần ít nhất 1 kho.'] };
      var usedKho = {};
      store.ledger().forEach(function (r) { usedKho[r[C.KHO]] = true; });
      var removed = store.settings().khos.filter(function (k) { return s.khos.indexOf(k) < 0 && usedKho[k]; });
      if (removed.length) return { ok: false, errors: ['Không xóa được kho đã có giao dịch: ' + removed.join(', ')] };
      store.saveSettings(s);
      return { ok: true };
    },

    listUsers: function (store) {
      return { ok: true, users: store.users().map(function (u) { return { u: u.u, name: u.name, role: u.role }; }) };
    },

    saveUser: function (store, user, p) {
      var u = str_(p.u).toLowerCase(), list = store.users(), errs = [];
      if (!/^[a-z0-9._-]{3,30}$/.test(u)) errs.push('Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, . _ -');
      if (!ROLES[p.role]) errs.push('Vai trò không hợp lệ.');
      if (!str_(p.name)) errs.push('Chưa nhập tên hiển thị.');
      var existing = list.filter(function (x) { return x.u === u; })[0];
      if (p.isNew && existing) errs.push('Tên đăng nhập đã tồn tại.');
      if (!p.isNew && !existing) errs.push('Không tìm thấy tài khoản.');
      if ((p.isNew || p.password) && String(p.password || '').length < 6) errs.push('Mật khẩu tối thiểu 6 ký tự.');
      if (existing && existing.u === user.u && p.role !== 'admin') errs.push('Không thể tự hạ quyền của chính mình.');
      if (errs.length) return { ok: false, errors: errs };
      var rec = existing || { u: u };
      rec.name = str_(p.name); rec.role = p.role;
      if (p.password) { rec.salt = store.newSalt(); rec.h = store.hash(String(p.password), rec.salt); }
      if (!existing) list.push(rec);
      store.saveUsers(list);
      if (p.password && existing && store.dropSessions) store.dropSessions(u);
      return { ok: true };
    },

    deleteUser: function (store, user, p) {
      if (p.u === user.u) return { ok: false, errors: ['Không thể xóa chính mình.'] };
      var list = store.users().filter(function (x) { return x.u !== p.u; });
      store.saveUsers(list);
      if (store.dropSessions) store.dropSessions(p.u);
      return { ok: true };
    },

    changePassword: function (store, user, p) {
      var list = store.users(), me = list.filter(function (x) { return x.u === user.u; })[0];
      if (!me || store.hash(String(p.old || ''), me.salt) !== me.h) return { ok: false, errors: ['Mật khẩu hiện tại không đúng.'] };
      if (String(p.password || '').length < 6) return { ok: false, errors: ['Mật khẩu mới tối thiểu 6 ký tự.'] };
      me.salt = store.newSalt(); me.h = store.hash(String(p.password), me.salt);
      store.saveUsers(list);
      return { ok: true, log: 'Đổi mật khẩu' };
    }
  };

  /** Kiểm tra đăng nhập: trả về user hoặc null */
  function checkLogin(store, u, password) {
    u = str_(u).toLowerCase();
    var rec = store.users().filter(function (x) { return x.u === u; })[0];
    if (!rec || store.hash(String(password || ''), rec.salt) !== rec.h) return null;
    return { u: rec.u, name: rec.name, role: rec.role };
  }

  return {
    LOAI: LOAI, LOAI_LIST: LOAI_LIST, PREFIX: PREFIX, KIND_LABEL: KIND_LABEL, C: C, SO_HEADERS: SO_HEADERS, ROLES: ROLES, ACL: ACL,
    round_: round_, num_: num_, str_: str_, toUnits: toUnits, splitUnits: splitUnits, fmtThung: fmtThung, fmtMoney: fmtMoney,
    deltaOf: deltaOf, kindOfId: kindOfId, productMap: productMap, parseLedger: parseLedger, computeStock: computeStock,
    stockAt: stockAt, groupPhieu: groupPhieu, validatePhieu: validatePhieu, nextPhieuId: nextPhieuId, phieuToRows: phieuToRows,
    buildPeriodReport: buildPeriodReport, buildCard: buildCard, guessBrand: guessBrand, guessUnit: guessUnit,
    migrateOld: migrateOld, can: can, snapshot: snapshot, handle: handle, checkLogin: checkLogin,
    costDebt: costDebt, describePhieu: describePhieu, LOG_LABEL: LOG_LABEL,
    FEE_TYPES: FEE_TYPES, FEE_DEFAULT: FEE_DEFAULT, FIXED_SAMPLE: FIXED_SAMPLE, monthCharges: monthCharges, hasMonthly: hasMonthly, computeFees: computeFees, feeRates: feeRates, monthRange: monthRange, cleanFee: cleanFee_
  };
}

var K = coreFactory_();
