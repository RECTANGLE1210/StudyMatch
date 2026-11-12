# Tự bổ sung môn học

Trong Hồ sơ → Môn học của tôi → **+ Thêm môn học**, người dùng chọn môn có sẵn hoặc bấm **+ Tự bổ sung môn học**. Luồng onboarding cũng dùng bộ chọn này.

Nhập tên môn (1–200 ký tự), mã môn tùy chọn (tối đa 80 ký tự), rồi bấm **Tạo môn mới**. Nếu bỏ mã, hệ thống sinh mã riêng. Môn được tạo vào danh mục chung ngay; sau đó chọn trình độ/chủ đề và lưu để thêm môn vào hồ sơ cá nhân. Hủy chỉnh sửa hồ sơ không xóa môn đã tạo khỏi danh mục chung.

Database kiểm tra cả tên lẫn mã. Tên không phân biệt hoa thường, khoảng trắng thừa và cách biểu diễn dấu Unicode NFC/NFD; mã không phân biệt hoa thường và bỏ khoảng trắng. Dấu tiếng Việt vẫn có ý nghĩa, không tự gộp các tên gần giống. Nếu tên hoặc mã đã tồn tại, không tạo bản ghi mới; giao diện báo đã có và cho chọn môn có sẵn nếu chưa nằm trong hồ sơ. Kiểm tra tại database bảo vệ cả các yêu cầu gửi đồng thời và luồng lưu hồ sơ cũ.

## Bật trên Supabase

1. Frontend có thể deploy trước: chọn môn hiện có vẫn hoạt động; nếu thiếu API mới, nút tạo môn hiển thị thông báo chưa được bật trên máy chủ.
2. Mở SQL Editor của project Supabase đang dùng, chạy toàn bộ `supabase/migrations/202611120002_subject_catalog.sql` **một lần** sau foundation/product. Không phụ thuộc migration thư viện hoặc đồng bộ phòng. Không chạy lại migration cũ, seed hay reset database.
3. Refresh ứng dụng, tạo một môn chưa có rồi thử tạo lại tên hoặc mã đó để kiểm tra thông báo.

Migration thêm API `create_subject`, bộ khóa tên/mã trong schema private và trigger chống trùng. Chỉ người đã đăng nhập được gọi API; không bắt buộc hoàn tất hồ sơ để hỗ trợ onboarding. Không sửa, gộp hay xóa môn/ID và liên kết hồ sơ hiện tại. Các biến thể trùng đã có từ trước được giữ nguyên, nhưng không cho tạo thêm biến thể mới. DDL có lock_timeout 3 giây và statement_timeout 20 giây; nếu không lấy được khóa, transaction thất bại thay vì chờ lâu. Khi SQL lỗi, rollback transaction và kiểm tra lỗi trước khi thử lại.

## Kiểm tra local

```powershell
npm.cmd run test
npx.cmd playwright test tests/e2e/subjects.spec.ts
npm.cmd run build
```

Database tests dùng PGlite; bài kiểm tra hai client không thay thế kiểm tra đa kết nối trên PostgreSQL production.
