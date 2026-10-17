# Quản lý kho ký gửi (theo thùng)

Ứng dụng web nhập – xuất kho hàng ký gửi, tính theo **thùng + lẻ**, chạy trên **Google Sheets + Google Apps Script**.
Miễn phí, không cần máy chủ, dùng tốt trên điện thoại.

## Tính năng
- **Phiếu nhập / xuất / chuyển kho / kiểm kê**. Chặn xuất vượt tồn, hiện tồn trước và sau phiếu.
- **Lịch sử phiếu theo ngày** + **tổng hợp ngày** (ngày đó xuất những hàng nào). In phiếu có chỗ ký tên.
- **Tồn kho** theo brand / kho, **thẻ kho** từng sản phẩm, **báo cáo nhập – xuất – tồn** theo kỳ.
- **Chi phí & công nợ**: chốt sổ, thanh toán từng đợt, trả thiếu hoặc dư tự chuyển sang kỳ sau.
- **Phí hằng tháng tự động**: phí lưu kho (thùng-ngày), phí nhập/xuất theo thùng, phí cố định (tiền rinh hàng, quỹ dự phòng…).
- **3 vai trò**:
  - **Quản trị**: toàn quyền, sửa không để dấu vết.
  - **Nhân viên**: tạo phiếu, có nhật ký thao tác.
  - **Đối tác**: chỉ xem.
- Giao diện **sáng / tối**, tối ưu cho điện thoại.

## Cấu trúc
| File | Vai trò |
|---|---|
| `Core.gs` | Lõi tính toán + phân quyền (dùng chung cho máy chủ và giao diện) |
| `Code.gs` | Đọc/ghi Google Sheets, đăng nhập, menu, ghi phí tự động |
| `Index.html` | Giao diện web |
| `HUONG-DAN.md` | Hướng dẫn cài đặt & sử dụng chi tiết |

## Cài đặt nhanh
1. Mở Google Sheets → **Tiện ích mở rộng → Apps Script**.
2. Tạo 3 file `Code`, `Core` (tập lệnh) và `Index` (HTML), dán nội dung tương ứng.
3. Chạy hàm `chuyenDuLieuCu` (có dữ liệu mẫu cũ) hoặc `caiDat` (file mới) → tạo tài khoản quản trị.
4. **Triển khai → Ứng dụng web**: Thực thi dưới dạng *Tôi*, Người có quyền truy cập *Bất kỳ ai*.

Xem đầy đủ trong [HUONG-DAN.md](HUONG-DAN.md).
