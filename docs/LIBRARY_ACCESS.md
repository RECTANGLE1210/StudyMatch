# Ngân hàng tài liệu độc lập — 12/11/2026

Tải tài liệu vào ngân hàng bất cứ lúc nào, không cần tạo buổi học. Tệp được lưu online trong Supabase Storage; metadata, quyền và các lần gắn vào buổi học lưu trong PostgreSQL.

## Cập nhật project đang chạy

1. Deploy frontend tương thích; nếu chưa có API mới, các tài liệu buổi học cũ vẫn dùng được và app thông báo ngân hàng độc lập đang được cập nhật.
2. Trong Supabase SQL Editor của đúng project đang dùng, chạy toàn bộ `supabase/migrations/202611120001_library.sql` một lần. Chỉ cần foundation/product đã áp; không phụ thuộc migrations room-sync và không cần chạy lại chúng. Không chạy reset hoặc áp lại foundation.
3. Migration tạo library_resources/library_grants/library_attachments, bucket private library-materials và API/policies mới; không thay bảng/session_resources, get_room/get_workspace hoặc policy bucket session-materials cũ. Có lock_timeout 3 giây và statement_timeout 20 giây trong transaction; nếu SQL lỗi cần kiểm tra/rollback transaction trước khi thử lại.
4. Refresh trang Ngân hàng tài liệu hoặc chờ app phát hiện API mới (khoảng 15–20 giây khi đang mở trang). Không cần thêm env/key hoặc đổi bucket thành public.

## Luật quyền

- Mặc định **Chỉ tôi và người được cấp quyền**. Uploader chọn Chia sẻ, tìm người theo tên hiển thị và cấp/thu hồi quyền trực tiếp.
- **Công khai** cho mọi tài khoản đã đăng nhập StudyMatch. Anonymous không được đọc metadata hoặc xin signed URLs.
- Người có quyền đọc được gắn tài liệu vào buổi học còn chỉnh sửa được mà họ tham gia; hệ thống tự cho cả hai participant quyền xem, kể cả khi uploader không dự buổi đó.
- Có thể gắn cùng một tài liệu vào nhiều buổi, không nhân bản file. Quyền qua attachment tồn tại để xem lại lịch sử cho đến khi tài liệu bị gỡ/xóa.
- Gỡ khỏi một buổi loại quyền từ buổi đó. Direct grant, public hoặc quyền từ buổi khác vẫn có hiệu lực. Thu hồi direct grant không tự xóa attachment; chủ tài liệu có nút **Gỡ khỏi mọi buổi học** để thu hồi quyền kế thừa toàn bộ.
- Chỉ uploader đổi visibility/grants hoặc xóa tài liệu. Viewer không được đổi ACL, xóa file hay gắn vào buổi họ không tham gia. Gắn thành công đồng nghĩa chia sẻ quyền xem cho partner, UI hiển thị rõ.

## Tệp và tài liệu cũ

Files ở bucket private, cùng giới hạn PDF/PNG/JPEG/WebP/Word/PPT/TXT 10MiB. Signed URL có hiệu lực tối đa 60 giây; URL đã cấp có thể còn dùng tới lúc hết hạn sau khi quyền bị thu hồi. Link ngoài chỉ được HTTPS; quyền trên Google Drive/Forms/website nguồn vẫn do nguồn đó quyết định.

Upload Storage và ghi metadata là hai dịch vụ: metadata lỗi sẽ cố xóa object vừa upload; lỗi cleanup được báo để xử lý lại. Xóa tài liệu đánh dấu metadata trước để thu hồi quyền, rồi xóa Storage; nếu Storage lỗi có thể bấm Xóa lại. Không có job cleanup tự động cho object bị bỏ lại do đóng browser giữa chừng.

Tài liệu cũ vẫn ở session_resources và bucket cũ, giữ quyền cũ. Uploader có thể **Sao chép vào ngân hàng**, tạo bản độc lập restricted để dùng ACL mới; không di chuyển/xóa bản cũ hoặc tự public tài liệu lịch sử.

Các bảng mới tránh FK tới bảng profile/session đang chạy để giảm khóa DDL lên bảng cũ; RPC xác minh target/membership trước khi ghi. Nếu admin bổ sung xóa profile/session ngoài các API hiện tại, cần dọn grants/attachments mồ côi tương ứng. Danh sách hiện tải các tài liệu user có quyền; cần bổ sung pagination khi public library lớn.

## Kiểm thử

Kết quả local: TypeScript/build thành công, **111 tests và 9 E2E đạt**. Kiểm thử quyền SQL dùng bốn actor; browser dùng ba tài khoản A/B/C.

Dùng ba tài khoản A/B/C: A upload khi chưa có buổi học, restricted khiến B/C không thấy; A cấp B; B gắn vào buổi B+C và C xem được; A thu hồi grant B rồi gỡ tất cả attachments, B/C mất quyền; đổi public để C thấy, đổi lại restricted để C mất quyền. Kiểm tra refresh và file ký URL, outsider không đổi ACL/xóa file. Test local dùng PGlite/RLS + browser transport, không chứng minh Supabase Storage/Realtime từ xa đã hoạt động.

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:e2e
npm.cmd run build
```
