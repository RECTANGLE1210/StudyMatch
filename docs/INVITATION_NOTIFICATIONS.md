# Thông báo từ chối lời mời

Khi A từ chối lời mời học cùng do B gửi, chuông của B có thông báo “A đã từ chối lời mời học cùng của bạn” và tăng số chưa đọc. Nếu hồ sơ A không còn khả dụng, dùng thông báo chung. Bấm thông báo mở Smart Match và đánh dấu đã đọc; thông báo vẫn được giữ sau tải lại trang.

Cả nút Từ chối trong chuông và Smart Match dùng chung cơ chế database. Trigger chỉ tạo thông báo khi trạng thái chuyển từ pending sang rejected, trong cùng transaction. Quyền trả lời vẫn do respond_invitation kiểm tra và khóa bản ghi; retry không tạo thêm thông báo. Hủy lời mời, chấp nhận, tự động hủy do chặn không tạo thông báo từ chối.

## Bật trên project đang chạy

1. Deploy frontend mới trước để nhận diện loại thông báo mới.
2. Chạy toàn bộ `supabase/migrations/202611120003_invitation_rejected_notification.sql` **một lần** trong Supabase SQL Editor. Chỉ cần foundation/product đã áp; không cần áp lại các migrations cũ, seed hoặc reset database.
3. Dùng hai tài khoản: B gửi → A từ chối → mở chuông B → bấm thông báo → tải lại kiểm tra trạng thái đã đọc.

Migration mở rộng constraint loại thông báo và thêm trigger; giữ nguyên RPC, dữ liệu và quyền hiện tại. Không phát thông báo cho các lời mời đã bị từ chối trước đó. Transaction có lock_timeout 3 giây và statement_timeout 20 giây; nếu SQL lỗi, rollback và kiểm tra lỗi trước khi thử lại.

Chuông cập nhật qua cơ chế Realtime hiện có, focus/online và polling 30 giây khi không có Realtime. Kiểm thử trình duyệt local dùng focus fallback; chưa chứng minh WebSocket delivery của project thật.

```powershell
npm.cmd run test -- --maxWorkers=1
npx.cmd playwright test tests/e2e/invitationNotifications.spec.ts
npm.cmd run build
```
