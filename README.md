# Quản lý kho ký gửi (theo thùng)

Ứng dụng web nhập – xuất kho hàng ký gửi, tính theo **thùng + lẻ**. Chạy trên **hosting PHP** (Hostinger), dữ liệu lưu bằng **SQLite**:
không cần Google, không cần tạo database, dùng tốt trên điện thoại.

## Tính năng
- **Phiếu nhập / xuất / chuyển kho / kiểm kê**: chặn xuất vượt tồn, hiện tồn trước và sau phiếu.
- **Lịch sử phiếu theo ngày** + **tổng hợp ngày**, in phiếu có chỗ ký tên.
- **Tồn kho** theo brand / kho, **thẻ kho**, **báo cáo nhập – xuất – tồn** theo kỳ.
- **Chi phí & công nợ**: chốt sổ, thanh toán từng đợt, trả thiếu hoặc dư thì tự chuyển sang kỳ sau.
- **Phí hằng tháng tự động**:
  - phí lưu kho (thùng-ngày);
  - phí nhập / xuất theo thùng;
  - phí cố định (tiền rinh hàng, quỹ dự phòng…).
- **3 vai trò**, kiểm tra quyền trên máy chủ:
  - **Quản trị**: sửa không để dấu vết.
  - **Nhân viên**: có nhật ký thao tác.
  - **Đối tác**: chỉ xem.
- **Nhập file Excel cũ** (mẫu Tổng / Nhập / Xuất / Phí Phát Sinh), **xuất Excel**, **sao lưu / khôi phục**.
- Giao diện **sáng / tối**.

## Cấu trúc
| File | Vai trò |
|---|---|
| `index.html` | Giao diện |
| `core.js` | Tính toán phía trình duyệt |
| `api.php` | API (đăng nhập, phân quyền, ghi dữ liệu) |
| `lib/kho.php` | Nghiệp vụ + SQLite |
| `.htaccess` | Chặn truy cập `lib/`, dữ liệu, tài liệu |

## Cài đặt nhanh
1. Đưa toàn bộ repo vào `public_html` (Hostinger → Git, bật Auto Deployment).
2. Mở `https://<tên-miền>/api.php?health=1` → kiểm tra `"sqlite": true`.
3. Mở tên miền → **Cài đặt lần đầu** → tạo tài khoản quản trị.
4. **Cài đặt → Dữ liệu** → nhập file Excel cũ.

Yêu cầu: PHP 7.4+ có `pdo_sqlite`. Chi tiết xem [HUONG-DAN.md](HUONG-DAN.md).
