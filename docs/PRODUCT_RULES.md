# Luật nghiệp vụ MVP

## Tài khoản và hồ sơ

Chỉ Google OAuth qua Supabase, không custom password auth. User mới lấy tên/ảnh từ chính session Google nếu có, các trường học tập bắt đầu trống. Profile, nhiều môn, proficiency và strong/weak được lưu nguyên tử bằng `save_profile_view` → `save_learning_profile`; không cho browser tự ghi trạng thái onboarding hoặc impersonate account khác.

Hoàn tất onboarding cần tên, trường, ngành, ít nhất một môn, goals, styles và lịch rảnh. Profile UI cho sửa lại toàn bộ. Các danh mục load từ database; tên trường/ngành/môn/topic tự nhập được tạo trong cùng transaction, có giới hạn độ dài và số phần tử. Mỗi topic chỉ thuộc strong hoặc weak cho từng user/môn. Lịch rảnh giữ grid sáng/chiều/tối của Figma; mỗi slot 3 giờ, lưu local với IANA timezone, không giả định hai user cùng múi giờ.

Email chỉ lấy từ auth session và chỉ hiện trong tài khoản của chính user; không nằm trong public profile snapshots. Ảnh upload thuộc private avatars bucket và được cấp signed URL; ảnh Google có thể dùng URL từ Google session.

## Matching

Công thức `S=0.35C+0.30T+0.20G+0.15L`, điểm 0–100. C bắt đầu 40 khi có môn chung và tăng theo strong/weak bổ trợ thật; weak/weak không tăng complementarity. T tính overlap theo phút sau chuẩn hóa timezone cho cùng tuần tham chiếu, kể cả DST; G/L dùng Dice similarity trên tập unique. Không gợi ý self hoặc quan hệ block. Candidate pages 50 người, tải thêm không đặt giới hạn tổng user; ranking áp dụng trên candidates đã tải, tie-break bằng UUID.

Giờ local không tồn tại do DST bị từ chối khi đặt lịch. Với giờ local lặp lại vào cuối DST, chọn thời điểm xảy ra sớm hơn; người dùng cần kiểm tra timestamp hiển thị trước khi xác nhận.

## Kết nối và chat

Một cặp user chỉ có một lời mời active hai chiều. Recipient accept/reject, sender cancel khi pending. Accept tạo conversation với đúng hai participant. Chat chỉ cho participant, sender/timestamp do server gán, tối đa 4000 ký tự. History dùng cursor `(created_at,id)`; client merge theo message ID và reload khi reconnect để tránh thiếu/trùng. Unread dựa trên last_read_at; đọc conversation đồng thời đánh dấu message notifications tương ứng.

Block hủy invitation và session đang active giữa hai user, chặn đọc/gửi chat; unblock không tự khôi phục trạng thái cũ. Báo cáo optional được lưu với reporter từ auth.uid(), không giả gửi email hoặc xử lý moderation tự động.

## Buổi học và phòng học

Phải có accepted connection và môn chung. Proposer chọn partner, môn/topic, thời gian có timezone, duration và mục tiêu; topic phải thuộc đúng môn. Chỉ partner accept/reject. Proposer dời lịch sẽ đưa session về proposed, xóa attendance cũ và yêu cầu xác nhận lại.

Lifecycle: proposed → scheduled → in_progress → completed; có rejected/cancelled/missed. Cả hai phải confirm attendance và đang trong khung giờ trước khi bắt đầu. Terminal state không thể quay lại. Server gán started_at/completed_at, không nhận số phút/counters từ browser.

Workspace reconcile khi tải và mỗi khoảng 30 giây: proposal hết hạn bị hủy, scheduled quá giờ nhưng chưa bắt đầu thành missed, in_progress tới ends_at hoàn tất với completed_at bị chặn ở ends_at. Cách này hoạt động khi người dùng truy cập; không có cron chạy nền khi mọi người offline. Progress được cập nhật trên lần tải kế tiếp. Pomodoro 25/50 dùng trạng thái chung theo session, lưu duration/elapsed/started_at/revision trong room_sync_state trên server; chỉ buổi tạo sau khi bật cờ và cả hai client hỗ trợ API v2. Buổi cũ giữ timer cá nhân, không tự chuyển giữa buổi. Cả hai participant được start/pause/reset; row lock và expected revision từ chối thao tác trên dữ liệu cũ. Browser đếm theo server timestamp và performance.now(), không phụ thuộc đồng hồ máy; refresh/rejoin giữ nguyên timer. Timer tự đóng băng khi buổi học kết thúc và không quyết định số giờ học server.

Room tải thay đổi qua Realtime theo session và fallback polling 2 giây khi tab hiển thị; focus/online/visibilitychange tải lại ngay. Meet link lưu trong study_sessions.meet_link và giữ theo lịch sử buổi học, không dùng localStorage hoặc bộ nhớ tạm.

Checklist chia sẻ cho cả hai, chỉ sửa khi session active. Google Meet do user tự nhập; chỉ nhận HTTPS meet.google.com hợp lệ, không tự tạo meeting/WebRTC. Feedback 1–5 và comment thuộc người gửi, chỉ sau completed.

## Tài liệu và tiến độ

Tài liệu mới thuộc ngân hàng độc lập, không cần session để upload file/link/Quiz. Mặc định restricted: uploader và người được cấp quyền trực tiếp xem được; public cho mọi tài khoản đã đăng nhập StudyMatch, không phải anonymous. Bucket library-materials luôn private; kiểm tra quyền cả metadata và Storage, chỉ cấp signed URL 60 giây. Chỉ uploader quản lý ACL/xóa tài liệu.

Mọi người có quyền đọc được gắn tài liệu vào buổi học họ tham gia còn chỉnh sửa được. Attachment cấp quyền xem cho cả hai participant và có thể dùng cùng tài liệu ở nhiều buổi. Gỡ attachment loại quyền kế thừa từ buổi đó; direct grant hoặc public vẫn độc lập. Thu hồi direct grant không tự xóa quyền qua buổi học; uploader có thể gỡ khỏi mọi buổi học rồi đặt restricted/thu hồi grants để thu hồi đầy đủ. Permission cho tài liệu đã gắn còn tồn tại sau khi buổi học kết thúc để người tham gia xem lại, tới khi bị gỡ/xóa.

Tài liệu session_resources cũ giữ nguyên bucket/quyền/API. Uploader có thể sao chép sang ngân hàng mới để dùng public/cấp quyền; bản cũ và quyền của người đã tham gia buổi cũ không bị xóa. PDF/ảnh có preview; Office/TXT tải qua signed URL. Với liên kết ngoài, quyền StudyMatch kiểm soát việc thấy liên kết; quyền thật trên Google Drive/Forms/website nguồn vẫn do nơi đó quản lý.

Storage và metadata là hai API call, không có transaction xuyên dịch vụ: upload thất bại metadata sẽ cố cleanup object; lỗi cleanup được báo rõ. Avatar bị bỏ sau khi upload hoặc object mồ côi cần bảo trì định kỳ khi vận hành; không có background service được triển khai ở MVP này.

Progress tổng hợp từ completed session timestamps, completed goals, missed states và distinct partners; không có số liệu seed. Biểu đồ ngày dùng timezone của profile. Notifications là database rows trong transaction của thao tác; bell/read state không giả lập push notification.

## Gói học tập

Giữ bố cục pricing từ Figma; MVP miễn phí, các gói Sprint/Plus hiển thị chưa phát hành. Không có fake-door metrics, lượt xem/mua giả, giới hạn lời mời giả hoặc xác nhận thanh toán giả. Payment/billing không thuộc phạm vi MVP đã chốt.
