# Ứng dụng web Kho ký gửi — Hướng dẫn (Hostinger + GitHub)

Ứng dụng chạy trên **hosting PHP** (Hostinger). Dữ liệu lưu trong **1 file SQLite** trên hosting, không cần Google, không cần tạo database.
Code nằm trên **GitHub**: mỗi lần đẩy code lên, Hostinger tự cập nhật.

## Cấu trúc

| File | Vai trò |
|---|---|
| `index.html` | Giao diện web (điện thoại + máy tính) |
| `core.js` | Tính toán trên trình duyệt: tồn kho, báo cáo, phí, đọc file Excel cũ |
| `api.php` | Cổng máy chủ: đăng nhập, phân quyền, ghi dữ liệu |
| `lib/kho.php` | Nghiệp vụ + lưu trữ SQLite (bị chặn truy cập trực tiếp) |
| `.htaccess` | Trang chủ, chặn mở thư mục `lib/`, file dữ liệu, tài liệu |
| `manifest.webmanifest`, `icon.svg` | Icon khi "Thêm vào màn hình chính" trên điện thoại |

**Dữ liệu nằm ở đâu?** File `kho-data/kho.sqlite`, nằm **ngoài** thư mục web (cạnh `public_html`), nên không ai tải được qua trình duyệt.
Nếu hosting không cho ghi ra ngoài, app tự dùng `public_html/data/` (đã chặn truy cập).

## Phân quyền

| | Quản trị (bạn) | Nhân viên | Đối tác (chỉ xem) |
|---|:-:|:-:|:-:|
| Xem tổng quan, tồn kho, lịch sử phiếu, báo cáo | ✅ | ✅ | ✅ |
| Xem chi phí, công nợ, các đợt chốt | ✅ | ✅ | ✅ (tắt được trong Cài đặt → Chung) |
| Tạo phiếu nhập / xuất / chuyển kho (+ chi phí kèm phiếu) | ✅ | ✅ | ❌ |
| Sửa / xóa phiếu, kiểm kê | ✅ không để dấu vết | ❌ | ❌ |
| Sửa / xóa chi phí, chốt sổ, ghi phí tháng | ✅ không để dấu vết | ❌ | ❌ |
| Sản phẩm, danh mục, biểu phí, tài khoản, nhập/xuất dữ liệu | ✅ | ❌ | ❌ |
| Bị ghi Nhật ký | không | ✅ đăng nhập, tạo phiếu, thêm chi phí, đổi mật khẩu | ✅ đăng nhập |

Quyền được kiểm tra **trên máy chủ** (`lib/kho.php`). Nhân viên hay đối tác có cố gọi thẳng vào API cũng bị chặn.
Mật khẩu được mã hóa (bcrypt). Đăng nhập sai 5 lần thì khóa 10 phút.

## Cài đặt lần đầu (khoảng 10 phút)

### 1. Đưa code lên Hostinger
Repo GitHub đã nối với Hostinger (hPanel → **Websites → Git**). Mỗi lần đẩy code lên nhánh `main`, Hostinger tự cập nhật.
Nếu chưa nối: hPanel → **Advanced → Git** → nhập `https://github.com/luhuybk/Huy-Quanlykho.git`, nhánh `main`, thư mục `public_html` → **Create**, rồi bật **Auto Deployment**.

Kiểm tra máy chủ: mở `https://<tên-miền>/api.php?health=1`, phải thấy `"ok":true` và `"sqlite":true`.
Nếu `sqlite` là `false`: hPanel → **Advanced → PHP Configuration → PHP extensions** → bật `pdo_sqlite`.

### 2. Tạo tài khoản quản trị
Mở tên miền → màn hình **Cài đặt lần đầu** → nhập tên đăng nhập, tên hiển thị, mật khẩu → vào hệ thống.
Màn hình này chỉ xuất hiện khi chưa có tài khoản nào.

### 3. Nhập dữ liệu cũ từ Google Sheets
1. Mở file Google Sheets cũ → **Tệp → Tải xuống → Microsoft Excel (.xlsx)**.
2. Trong app: **Cài đặt → Dữ liệu → Nhập dữ liệu từ file Excel mẫu cũ** → chọn file.
3. App đọc các sheet **Tổng / Nhập / Xuất / Phí Phát Sinh** và hiện bảng xem trước. Trong đó có dòng **Kiểm tra tồn**: số sản phẩm có tồn từng kho khớp với sheet Tổng.
4. Bấm **Nhập**.

**Có 2 file (2024–2025 và 2026), muốn giữ cả lịch sử:**
1. Nhập file **cũ** trước, bật **Thay toàn bộ dữ liệu hiện có**.
2. Nhập file **2026**, tắt "Thay toàn bộ", bật **Nối tiếp file trước**. Dòng "Nhập tồn khớp" của file 2026 được thay bằng một phiếu **cân tồn**, để tồn **từng kho** khớp đúng đầu kỳ 2026 (ví dụ việc gộp Kho 2 vào Kho 1).

Nhập lại cùng một file 2 lần sẽ bị chặn vì trùng mã phiếu.

### 4. Tạo tài khoản nhân viên và đối tác
**Cài đặt → Tài khoản → ＋ Thêm**, chọn vai trò **Nhân viên** hoặc **Đối tác (chỉ xem)**. Gửi họ tên miền, tên đăng nhập và mật khẩu.
Trên điện thoại: mở tên miền → **Thêm vào màn hình chính** để dùng như app.

### 5. Biểu phí (nếu dùng)
**Cài đặt → Biểu phí**:
- **Phí cố định hằng tháng**, ví dụ Tiền Rinh Hàng, Quỹ Dự Phòng.
- **Phí lưu kho / nhập / xuất theo thùng**.
- Bật **Tự động ghi phí hằng tháng**: ngày đầu tháng, lần đầu có người mở app, phí tháng trước tự được ghi vào Chi phí. **Không cần cài Cron Job.**

## Các chức năng chính
- **Tổng quan**: tồn kho, nhập/xuất tháng, công nợ chi phí, cảnh báo tồn âm, biểu đồ xuất 14 ngày, hàng bán chạy, phiếu gần đây.
- **Tạo phiếu** (nút ＋): Nhập, Xuất, Chuyển kho, Kiểm kê (chỉ quản trị). Số lượng nhập theo thùng (nút − / +) và số lẻ. Xuất vượt tồn bị chặn.
- **Phiếu & lịch sử**: phiếu nhóm theo ngày, có **Tổng hợp ngày** (ngày đó xuất hàng gì), in phiếu có chỗ ký tên.
- **Tồn kho** + **thẻ kho** từng sản phẩm. **Báo cáo** nhập – xuất – tồn theo kỳ.
- **Chi phí & chốt sổ** (giống công nợ): xem công nợ hiện tại, các khoản chưa chốt, chốt sổ khi thanh toán. Trả thiếu hoặc dư thì phần chênh lệch tự chuyển sang kỳ sau. Có in bảng kê.
- **Phí tháng**: tạm tính trong tháng, ghi vào công nợ khi hết tháng, in bảng phí cho đối tác.
- **Nhật ký** (quản trị xem): thao tác của nhân viên và đối tác.
- **Giao diện sáng / tối**: nút 🌙/☀️ trên đầu trang.
- Mở lại app (chuyển tab, mở khóa điện thoại) thì dữ liệu tự làm mới.

## Sao lưu — QUAN TRỌNG
Dữ liệu chỉ nằm trên hosting, nên hãy sao lưu định kỳ:
- **Cài đặt → Dữ liệu → Tải bản sao lưu** (file `.json`), cất vào Google Drive hoặc máy tính, mỗi tuần hoặc mỗi tháng.
- **Khôi phục từ file…**: đưa dữ liệu về đúng bản sao lưu đó. Toàn bộ dữ liệu hiện tại bị thay, tài khoản giữ nguyên.
- **Tải file Excel**: gồm Tồn kho, Sổ kho, Chi phí, Chốt sổ, Sản phẩm. Dùng để xem, in, gửi đối tác.
- Hostinger cũng có sao lưu tự động (hPanel → **Files → Backups**).

## Cập nhật code về sau
Sửa code → đẩy lên GitHub (nhánh `main`) → Hostinger tự cập nhật. Dữ liệu nằm ngoài thư mục code nên **không bị mất** khi cập nhật.

## Quên mật khẩu quản trị
- Còn tài khoản quản trị khác: vào **Cài đặt → Tài khoản** → đặt mật khẩu mới.
- Mất hết quyền quản trị: hPanel → **File Manager** → mở thư mục `kho-data` → tải `kho.sqlite` về máy làm bản dự phòng. Sau đó nhờ người biết kỹ thuật (hoặc hỏi lại Claude) để đặt lại mật khẩu trong bảng `users`.

## Lưu ý về "không để dấu vết"
Quản trị sửa hoặc xóa phiếu, sửa chi phí, chốt sổ: **không** ghi nhật ký, phiếu sửa giữ nguyên người tạo và giờ tạo ban đầu, phiếu xóa mất hẳn.
Bản sao lưu hosting của Hostinger (nếu bật) vẫn chứa dữ liệu ở thời điểm sao lưu. Phần này chỉ người quản lý tài khoản Hostinger xem được.
