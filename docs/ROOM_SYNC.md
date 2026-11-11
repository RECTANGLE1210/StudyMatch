# Phát hành đồng bộ phòng học — 11/11/2026

Phương án hiện tại cho phép deploy frontend trước khi đổi database. Người dùng không bị ép refresh, đăng nhập lại hoặc chuyển timer trong buổi đang học. Không yêu cầu backup như một điều kiện phát hành theo lựa chọn của chủ sản phẩm. Việc không ảnh hưởng tuyệt đối vẫn phụ thuộc hoạt động Supabase/Vercel và mạng thực tế.

## Thứ tự thực hiện trên sản phẩm đang chạy

1. Deploy code frontend đã kiểm thử. Sửa màu lịch và đọc Meet mới nhất hoạt động với database hiện có. Nếu chưa có get_room_v2, app dùng get_room cũ và Pomodoro cá nhân; không hiện NaN hoặc gọi timer API chưa tồn tại.
2. Trong Supabase SQL Editor, chạy **chỉ** `supabase/migrations/202611110002_room_sync_rollout.sql` một lần. File này chạy trực tiếp sau product.sql, không cần 202611110001_room_sync.sql. Nó tạo hai bảng riêng, API versioned và RLS; không ALTER study_sessions, không sửa trigger hoặc thay get_room/set_meet_link cũ. Cờ đồng bộ mặc định tắt.
3. Sau khi frontend mới hoạt động bình thường, chạy `supabase/operations/enable_room_sync.sql`. Cờ bật với mốc thời gian server; chỉ buổi được tạo sau mốc này mới đủ điều kiện. Chạy lại khi đang bật không đổi mốc.
4. Tạo một buổi mới bằng hai tài khoản, cả hai mở phòng trên phiên bản mới. Chỉ khi cả hai đã xác nhận khả năng dùng API mới thì timer chung mới được bật. Thử start/pause/reset/25–50, refresh và đổi Meet hai chiều.

Không chạy lại foundation/product, không reset database và không chạy `supabase db push` toàn bộ các file chưa áp cho đợt rollout này: file 001 là phương án cũ còn giữ để hỗ trợ lịch sử/kiểm thử. Nếu đã áp 001 thành công thì giữ nguyên, không cần xóa cột; 002 hoạt động cả khi có hoặc không có 001.

## Người dùng và phiên đang mở

- API cũ và hợp đồng dữ liệu cũ được giữ. Giao diện cũ đang mở tiếp tục gọi API cũ; không có logic tự reload trang.
- Các buổi tạo trước mốc bật cờ giữ Pomodoro cá nhân, kể cả sau refresh hoặc sau khi bật tính năng. Timer local trước đây chỉ có trong browser, không thể tự chuyển thời gian đang chạy sang server.
- Buổi mới chờ cả hai client hỗ trợ phiên bản mới; trong lúc chờ vẫn dùng chat, Meet và mục tiêu. Người dùng cũ không bị buộc cập nhật giữa buổi học cũ.
- Khi đã bắt đầu dùng timer chung, lỗi API/network giữ snapshot/timestamp chung hiện có và hiển thị lỗi; không âm thầm đổi sang timer cá nhân.
- Đồng bộ dùng Realtime theo session và fallback tải lại 2 giây khi tab hiển thị. Browser dùng server timestamp + performance.now(), không ghi elapsed do browser khai báo. RPC khóa đúng hàng session và kiểm tra revision khi điều khiển; không có DDL khóa bảng session trong migration rollout.

Hai bảng mới không có foreign key tới bảng cũ nhằm tránh khóa parent table khi tạo FK. RPC luôn xác minh session/membership trước khi ghi; không cấp quyền write trực tiếp cho client. State chỉ được tạo khi participant của buổi đủ điều kiện vào bằng API mới. Nếu sau này bổ sung xóa session bằng admin, cần dọn room_sync_state mồ côi tương ứng.

## Tắt tính năng và xử lý lỗi

Chạy `supabase/operations/disable_room_sync.sql` để dừng nhận buổi mới. Các phòng đã dùng timer chung tiếp tục hoạt động; không reset timer hoặc xóa dữ liệu. Có thể deploy bản vá frontend mà không buộc người đang mở trang phải refresh.

Nếu cần quay về frontend cũ trên Vercel, cờ có thể tắt trước. Nên chờ các buổi dùng timer chung kết thúc nếu muốn tránh người refresh bị quay lại UI timer cá nhân của bản cũ. Rollback frontend không hoàn tác database. Không DROP bảng/cột hoặc xóa state để rollback giao diện.

Migration có lock_timeout 3 giây và statement_timeout 20 giây trong transaction; đây không phải cam kết zero downtime hoặc timeout tổng của toàn script. Nếu lỗi/timeout, chưa bật cờ, chạy rollback nếu phiên SQL còn transaction lỗi và kiểm tra trước khi thử lại. Không chạy riêng nửa script.

## Kiểm thử

Unit/SQL kiểm tra cả database chỉ có hai migrations đầu và database đã có 001: API cũ giữ nguyên, buổi cũ giữ nguyên, hai client handshake, quyền dữ liệu, chống ghi đè và tắt cờ khi đang chạy. Browser kiểm tra bản server cũ không có v2, API mới cờ tắt, phiên cũ đang chạy lúc bật cờ, timer chung khi hai người hỗ trợ, Meet hai chiều, refresh và clock lệch 5 phút. Test transport không xác minh WebSocket Supabase thật.

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:e2e
npm.cmd run build
```
