# Database

Migration `supabase/migrations/202611040001_foundation.sql` tạo schema cho Supabase PostgreSQL trong transaction. Chưa áp dụng lên project từ xa. `seed.sql` chỉ thêm catalog, không tạo user, message hoặc thống kê giả.

| Nhóm | Bảng |
|---|---|
| Catalog | universities, majors, subjects, topics |
| Hồ sơ | profiles, user_subjects, user_topics, user_availability |
| Kết nối | match_requests, user_blocks |
| Chat | conversations, conversation_participants, messages |
| Buổi học | study_sessions, session_topics, session_attendance |
| Phòng học | session_goals, session_resources, session_feedback |
| Thông báo | notifications |

UUID, foreign keys, composite unique keys, checks và indexes bảo vệ quan hệ. `user_topics` tham chiếu cặp topic/subject và user/subject, nên không thể gán topic sai môn. Mỗi topic có duy nhất trạng thái strong hoặc weak cho một user; proficiency thuộc từng môn. Catalog không giới hạn số môn/người.

`profiles` không chứa email, token hoặc thông tin đăng nhập riêng. Các trường công khai của learning profile đọc được bởi user đã đăng nhập, trừ quan hệ block; tự đọc hồ sơ mình luôn được. Đây là access policy chủ đích cho matching. Nếu thêm thông tin riêng sau này, tách bảng riêng có owner-only RLS.

## Bảo mật và transaction

RLS bật ở tất cả bảng ứng dụng. Browser không được ghi trực tiếp profile, invitation state, conversation participants, message author, session status/timestamps hoặc notifications. Các thao tác đó đi qua RPC kiểm tra `auth.uid()`:

- `save_learning_profile`: thay profile, subjects/topics và availability nguyên tử; advisory lock cho concurrent saves; kiểm tra timezone/onboarding.
- `send_invitation`/`respond_invitation`: chặn self, blocked và duplicate active pair hai chiều; row lock khi phản hồi; chỉ recipient accept/reject, sender cancel. Accept tạo conversation và đúng hai participants.
- `send_message`: kiểm tra membership và block, gán sender/timestamp ở server, tạo notification cùng transaction.
- `propose_session`/`transition_session`/`reschedule_session`: kiểm tra partner, môn chung, accepted connection và lifecycle. Chỉ partner xác nhận; chỉ proposer dời lịch, dời lịch quay về proposed. Hai người phải confirm attendance trước khi bắt đầu trong khung giờ.
- `confirm_attendance`, `set_meet_link`, `mark_conversation_read`, `mark_notification_read`: kiểm tra participant/owner, không tin ID người gửi từ UI.

Progress lấy từ completed session với server timestamps; không có bảng counter cho client tự sửa. Completed time bị chặn ở `ends_at`. Session terminal không thể quay lại hoặc bị hủy. Missed chỉ ghi được sau ends_at và thiếu attendance; chưa có scheduled job tự đánh dấu missed.

Helpers SECURITY DEFINER nằm trong schema `private`, có search_path cố định và explicit grants; anonymous không được gọi RPC. Catalog chỉ đọc cho authenticated; thêm/sửa catalog bằng migration có kiểm soát.

## File và Realtime

Bucket `session-materials` private, path `session_id/uploader_id/random_uuid`. Chỉ participant đọc; chỉ uploader xóa; upload cần session còn hoạt động. Bucket giới hạn 10 MiB, PDF/PNG/JPEG/WebP; client cho phép giới hạn thấp hơn. Preview/download tạo signed URL 60 giây. Xóa Storage và metadata là hai API call nên chưa có transaction xuyên dịch vụ; cần reconciliation job khi phát triển tiếp.

Migration thêm messages/notifications vào publication `supabase_realtime` nếu publication có sẵn. Chat adapter unsubscribe khi cleanup. PGlite kiểm tra SQL/RLS; chưa thay thế kiểm thử Supabase Storage HTTP, signed URL, Realtime delivery hoặc Google OAuth.

## Migration

Mọi thay đổi schema tiếp theo phải có migration mới; không sửa lịch sử đã áp dụng. Xem `supabase/README.md`. Không chạy migration khởi tạo này lên database đã có các bảng cùng tên mà chưa review/diff. Seed có `ON CONFLICT` để chạy lại an toàn cho catalog mẫu.
