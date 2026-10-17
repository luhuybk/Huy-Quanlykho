# Ứng dụng web Kho ký gửi — Hướng dẫn cài đặt

Ứng dụng chạy trên chính file Google Sheets của bạn (Google Apps Script), **miễn phí, không cần thuê máy chủ**.
Có link web mở được trên điện thoại và máy tính, đăng nhập bằng tài khoản riêng, chia 3 quyền.

| File | Vai trò |
|---|---|
| `Core.gs` | Lõi tính toán: tồn kho, kiểm tra xuất vượt tồn, mã phiếu, báo cáo, **phân quyền** |
| `Code.gs` | Đọc/ghi Google Sheets, đăng nhập, menu trong Sheets |
| `Index.html` | Giao diện web (điện thoại + máy tính) |

## Phân quyền

| | Quản trị (bạn) | Nhân viên | Đối tác (chỉ xem) |
|---|:-:|:-:|:-:|
| Xem tổng quan, tồn kho, lịch sử phiếu, báo cáo | ✅ | ✅ | ✅ |
| Xem chi phí, công nợ, các đợt chốt | ✅ | ✅ | ✅ (mặc định bật, tắt được trong Cài đặt → Chung) |
| Tạo phiếu nhập / xuất / chuyển kho (+ chi phí kèm phiếu) | ✅ | ✅ | ❌ |
| Sửa phiếu, xóa phiếu, kiểm kê | ✅ không để dấu vết | ❌ | ❌ |
| Sửa/xóa chi phí, chốt sổ chi phí | ✅ không để dấu vết | ❌ | ❌ |
| Bị ghi Nhật ký | không | ✅ đăng nhập, tạo phiếu, thêm chi phí, đổi mật khẩu | ✅ đăng nhập |
| Sản phẩm, brand, kho, loại phí, đơn vị tính | ✅ | ❌ | ❌ |
| Quản lý tài khoản | ✅ | ❌ | ❌ |

Mật khẩu được mã hóa và lưu trong phần cài đặt riêng của script, **không nằm trong Sheet**.
Nhân viên và đối tác **không cần quyền truy cập file Google Sheets**. Họ chỉ dùng link web.

## Cài đặt (khoảng 10 phút, làm 1 lần)

### 1. Chuẩn bị file
- Mở file Google Sheets nhập xuất hiện tại → **Tệp → Tạo bản sao** (làm trên bản sao, file gốc giữ nguyên).
- Nếu muốn có cả lịch sử từ 11/2024: chạy chuyển dữ liệu trên file cũ trước, hoặc hỏi mình cách gộp 2 file.

### 2. Dán code
1. Trong bản sao: **Tiện ích mở rộng → Apps Script**.
2. Xóa nội dung file `Mã.gs` có sẵn → dán toàn bộ **`Code.gs`** vào → đổi tên file thành `Code`.
3. Bấm **＋ → Tập lệnh** → đặt tên `Core` → dán toàn bộ **`Core.gs`**.
4. Bấm **＋ → HTML** → đặt tên đúng là `Index` → dán toàn bộ **`Index.html`**.
5. Bấm 💾 **Lưu**.

### 3. Chuyển dữ liệu cũ + tạo tài khoản quản trị
1. Trên thanh công cụ chọn hàm **`chuyenDuLieuCu`** → **Chạy**.
2. Google hỏi cấp quyền: **Xem lại quyền → chọn tài khoản → Nâng cao → Đi tới dự án (không an toàn) → Cho phép**. Đây là code của chính bạn nên an toàn.
3. Quay lại tab Google Sheets. Sẽ có hộp thoại hỏi **tên đăng nhập + mật khẩu quản trị**, bạn nhập vào.
4. Xong sẽ báo số dòng, số chi phí, số sản phẩm đã chuyển.

> File mới, không có dữ liệu cũ: chạy hàm `caiDat` thay cho `chuyenDuLieuCu`.

### 4. Đưa lên web
1. Trong Apps Script: **Triển khai → Tùy chọn triển khai mới**.
2. Bấm ⚙️ cạnh "Chọn loại" → **Ứng dụng web**.
3. Đặt như sau:
   - **Thực thi dưới dạng: Tôi** (email của bạn)
   - **Người có quyền truy cập: Bất kỳ ai**
4. **Triển khai** → copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).
5. Mở link trên điện thoại → đăng nhập bằng tài khoản quản trị vừa tạo.
6. Mẹo: trên điện thoại, mở link bằng Safari/Chrome → **Thêm vào màn hình chính** để dùng như một app.

### 5. Tạo tài khoản cho nhân viên và đối tác
Trong web: **Cài đặt → Tài khoản → ＋ Thêm**
- Nhân viên: vai trò **Nhân viên**
- Bên đối tác: vai trò **Đối tác (chỉ xem)**

Gửi cho họ link web + tên đăng nhập + mật khẩu. Họ có thể tự đổi mật khẩu trong Cài đặt.

### Đã cài bản trước, giờ cập nhật bản mới
1. Dán đè 3 file `Code`, `Core`, `Index` bằng bản mới → 💾 Lưu.
2. Chạy hàm **`caiDat`** 1 lần để tạo thêm sheet và cột mới (Chốt Sổ, Nhật Ký, cột giá phí riêng, các dòng biểu phí trong Cài Đặt). Dữ liệu cũ giữ nguyên. Google sẽ hỏi thêm quyền **chạy tác vụ tự động** (dùng cho việc tự ghi phí hằng tháng), bấm Cho phép.
3. **Triển khai → Quản lý các bản triển khai → ✏️ → Phiên bản: Phiên bản mới → Triển khai**. Link web giữ nguyên.

### Khi sửa code về sau
Dán code mới → **Triển khai → Quản lý các bản triển khai → ✏️ → Phiên bản: Phiên bản mới → Triển khai**. Link web giữ nguyên.

## Các chức năng chính

- **Tổng quan**: tồn kho, nhập/xuất tháng này, chi phí tháng, cảnh báo tồn âm, biểu đồ xuất 14 ngày, hàng bán chạy 30 ngày, phiếu gần đây.
- **Tạo phiếu** (nút ＋): Nhập, Xuất, Chuyển kho, Kiểm kê (chỉ quản trị).
  - Chọn hàng từ danh sách có ô tìm, lọc theo brand, hiện tồn từng mặt hàng.
  - Số lượng = **thùng (nút − / +) + lẻ**. Hiện ngay "còn bao nhiêu sau phiếu". Xuất vượt tồn thì dòng tô đỏ và không cho lưu.
  - Gõ người nhận có gợi ý các tên đã dùng trước đó.
  - **Chi phí kèm phiếu**: ship, bốc xếp… được ghi vào sổ chi phí và gắn với mã phiếu.
  - **Kiểm kê**: nhập số đếm thực tế, hệ thống tự ghi phiếu điều chỉnh phần chênh lệch.
- **Phiếu & lịch sử**: phiếu nhóm theo ngày, lọc theo khoảng ngày / loại / kho, tìm theo mã, sản phẩm, người nhận.
  - **Tổng hợp ngày**: ngày đó xuất những hàng gì, mỗi hàng bao nhiêu, gồm những phiếu nào. In được.
  - Bấm vào phiếu để xem chi tiết, in phiếu xuất/nhập kho có chỗ ký tên. Quản trị thấy thêm nút **Sửa** và **Hủy**.
- **Tồn kho**: theo brand, theo kho, ẩn hàng hết. Bấm một mặt hàng để xem **thẻ kho** (lịch sử + tồn sau mỗi lần).
- **Báo cáo**: nhập – xuất – tồn theo kỳ (tháng này, tháng trước, năm, tùy chọn), lọc kho/brand, kèm chi phí trong kỳ. In để đối soát với đối tác.
- **Chi phí & chốt sổ** (giống công nợ):
  - Đầu trang là **Công nợ chi phí hiện tại** = tổng chi phí − tổng đã thanh toán.
  - Tab **Chưa chốt**: các khoản đang chờ thanh toán. Có nút **In bảng kê** để gửi đối tác.
  - Quản trị bấm **Chốt sổ** → chọn ngày chốt → hệ thống gom mọi khoản chưa chốt đến ngày đó → nhập số tiền đã thanh toán.
  - Từ hôm sau chi phí bắt đầu tính lại. Trả thiếu thì phần thiếu tự cộng vào kỳ sau, trả dư thì tự trừ.
  - Tab **Các đợt chốt**: lịch sử thanh toán, xem/in bảng kê từng đợt. Chốt nhầm thì bấm **Mở lại đợt chốt**.
- **Phí cố định hằng tháng** (Cài đặt → Biểu phí → mục đầu tiên):
  - Các khoản cố định mỗi tháng, ví dụ **Tiền Rinh Hàng 2.000.000đ** và **Quỹ Dự Phòng 2.000.000đ** như sổ cũ. Bấm "Dùng mẫu sổ cũ" để điền nhanh, sửa số tiền hoặc thêm khoản khác tùy ý.
  - Mỗi tháng ghi 1 lần vào Chi phí (ngày cuối tháng, ghi chú "Tháng mm/yyyy"), cùng lúc với phí kho. Có thể dùng riêng phí cố định mà không cần bật phí kho.
  - Ghi bằng nút ở Chi phí → **Phí tháng**, hoặc bật **Tự động ghi phí hằng tháng**.
  - Ngày "Bắt đầu tính phí" cũng áp dụng cho phí cố định: tháng nào kết thúc trước ngày này thì không tính.
- **Phí kho tự động** (Cài đặt → Biểu phí, chỉ quản trị):
  - Đặt **phí lưu kho** (đ/thùng/tháng hoặc đ/thùng/ngày), **phí nhập** và **phí xuất** (đ/thùng), ngày bắt đầu tính, có làm tròn lên thùng chẵn hay không.
  - Sản phẩm cồng kềnh (máy sấy…) đặt **giá riêng** trong Cài đặt → Sản phẩm, để trống thì theo giá chung.
  - **Lưu kho** = tồn cuối mỗi ngày (thùng, cộng mọi kho) × đơn giá. Giá theo tháng được chia đều theo số ngày của tháng.
  - **Nhập / xuất** = số thùng trên phiếu Nhập / Xuất × đơn giá. Chuyển kho, kiểm kê, tồn đầu không tính phí.
  - Chi phí → tab **Phí tháng**: xem phí tạm tính tháng này và các tháng trước, chi tiết từng sản phẩm, in bảng tính phí cho đối tác.
  - Hết tháng, bấm **Ghi phí vào chi phí & công nợ**, hoặc bật **Tự động ghi phí hằng tháng** để hệ thống tự ghi lúc 6h sáng ngày 1. Phí được ghi thành 3 khoản (lưu kho / nhập / xuất) với mã `PHI-yyyy-mm` và tự vào lần chốt sổ tiếp theo.
  - Ghi lại cùng tháng thì thay số cũ. Tháng đã chốt sổ thì phải **Mở lại đợt chốt** trước mới ghi lại được.
- **Nhật ký** (Cài đặt → Nhật ký, chỉ quản trị xem): ai làm gì, lúc nào, kèm chi tiết từng phiếu. Bấm vào để mở phiếu.
- **Giao diện tối**: nút 🌙/☀️ trên thanh tiêu đề, hoặc Cài đặt → Tài khoản → Giao diện (Sáng / Tối / Theo máy). Mỗi máy nhớ lựa chọn riêng.
- **Cài đặt**:
  - Sản phẩm: tên, brand, số đơn vị/thùng, đơn vị tính (chai/cái/hộp…), đang bán / ngừng bán.
  - Danh mục: kho, brand, loại chi phí, đơn vị tính.
  - Tài khoản.
  - Chung: tên hiển thị, cho phép xuất âm, đối tác có được xem chi phí hay không.

## Dữ liệu nằm ở đâu (trong Google Sheets)

| Sheet | Nội dung |
|---|---|
| Sản Phẩm | Danh mục hàng + giá phí riêng (cột H–J, trống = theo biểu phí chung) |
| Sổ Kho | Mỗi dòng = 1 mặt hàng trong 1 phiếu. Ngày ghi ở **mọi dòng** |
| Chi Phí | Các khoản chi, có cột mã phiếu liên quan và cột **Mã chốt** (trống = chưa chốt) |
| Tồn Kho | Tự tạo lại sau mỗi phiếu, để xem nhanh trong Sheets (đừng sửa tay) |
| Cài Đặt | Kho, brand, loại phí, đơn vị tính (A–D), tùy chọn + **biểu phí kho** (F–G), **phí cố định hằng tháng** (I–K) |
| Chốt Sổ | Các đợt chốt chi phí: kỳ, số khoản, tổng, đã thanh toán |
| Nhật Ký | Thao tác của nhân viên / đối tác |

Các sheet cũ **Tổng / Nhập / Xuất / Phí Phát Sinh** được giữ nguyên. Kiểm tra xong bạn có thể ẩn đi.

## Đã kiểm tra
- Chuyển dữ liệu từ mẫu cũ (Tổng / Nhập / Xuất / Phí Phát Sinh): tồn từng kho của mọi sản phẩm và tổng chi phí khớp đúng với sheet cũ.
- Phân quyền, chốt sổ công nợ, phí kho, phí cố định hằng tháng được kiểm thử tự động với số liệu tính tay.
- Brand và đơn vị tính được đoán theo tên sản phẩm (ví dụ "ml" thành chai, máy sấy/lược thành cái). Vào **Cài đặt → Sản phẩm** để chỉnh lại cho đúng.


## Lưu ý về "không để dấu vết"
- Trong **ứng dụng web**: quản trị sửa/xóa phiếu, sửa/xóa chi phí, chốt sổ đều **không** để lại dấu vết. Phiếu sửa vẫn giữ người tạo và giờ tạo ban đầu, phiếu xóa thì mất hẳn, nhật ký không ghi.
- Riêng **Google Sheets** luôn tự lưu **Lịch sử phiên bản** của file (Tệp → Lịch sử phiên bản). Phần này chỉ người có quyền chỉnh sửa file xem được. Nhân viên và đối tác chỉ dùng link web, không có quyền mở file, nên họ không xem được.
