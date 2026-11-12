# Database

Cài mới có thể áp migrations theo thứ tự: `202611040001_foundation.sql`, `202611100001_product.sql`, rồi `202611110001_room_sync.sql`. Chưa chạy trên database từ xa. Seed chỉ thêm university/major/subject/topic catalog; không thêm user, conversation, session, progress hoặc notification mẫu.

| Nhóm | Bảng |
|---|---|
| Catalog | universities, majors, subjects, topics |
| Hồ sơ | profiles, user_subjects, user_topics, user_availability |
| Quan hệ | match_requests, user_blocks, user_reports |
| Chat | conversations, conversation_participants, messages |
| Buổi học | study_sessions, session_topics, session_attendance |
| Phòng học | session_goals, session_resources, session_feedback |
| Thông báo | notifications |

UUID, foreign keys, unique/check constraints và indexes bảo vệ dữ liệu. Composite FK bảo đảm user_topics thuộc đúng môn. Topic không thể vừa strong vừa weak cho một user/môn. user_availability dùng ngày local 0=CN, phút local và profile IANA timezone; session timestamps là timestamptz UTC.

Tất cả application tables bật RLS. Public learning fields chỉ đọc cho authenticated theo access policy, có chặn quan hệ block; email không nằm trong public profile. User chỉ có thể thay hồ sơ mình qua RPC. Không có bảng counter do client tự sửa.

## API chính

- `get_profile_snapshot`, `save_profile_view`: chuyển giữa DTO giao diện Figma và quan hệ normalized; save catalogs/knowledge/availability nguyên tử, giới hạn input, kiểm tra owner avatar và expected account.
- `find_candidate_profiles`: candidates cùng môn, đã onboarding, loại self/block, page size 50.
- `send_invitation`, `respond_invitation`: self/duplicate/block/actor checks, transaction tạo conversation và participants khi accept.
- `send_message`, `message_page`, `mark_conversation_read`: author/timestamps từ server, history keyset và unread/notifications đồng bộ.
- `propose_study_session`, `reschedule_study_session`, `transition_session`, `confirm_attendance`, `set_session_topics`: accepted connection/môn/topic/role/time/state rules. Reschedule quay về proposed và xóa attendance cũ.
- `control_pomodoro(session, command, expected_revision, minutes)`: shared 25/50 timer trên study_sessions; chỉ participant của session in_progress còn hạn, serialized row lock và revision check. Không nhận elapsed/started_at từ browser; trigger dừng timer khi session kết thúc.
- `get_room`: trả serverNow cùng shared timer/session/Meet; client sử dụng snapshot phòng mới nhất, Realtime theo session và polling fallback.
- `get_workspace`, `get_room`, `get_progress`: chỉ dữ liệu actor được phép đọc; stats aggregate từ actual sessions/goals, không bị cắt theo số rows hiển thị.
- `attach_resource`, `remove_session_goal`: participant và active-session checks. Goal/material edits bị chặn ngay khi hết khung giờ, kể cả trước lazy status reconciliation.
- `block_user`, `unblock_user`: block hủy active relations/sessions; report lưu reporter từ auth.uid(). Unblock không revive lịch sử.
- `mark_notification_read`, `mark_all_notifications_read`: owner-only, server read_at; tổng unread không bị giới hạn theo 100 rows bell hiển thị.

Actor không tự insert/update messages, participants, status/progress timestamps hoặc notifications. Helpers SECURITY DEFINER ở private schema; các public RPC có explicit execute grants và search_path cố định. JSON snapshots dùng invoker RLS cho reads.

## Storage và Realtime

`avatars` private: upload path user_id/random_uuid, tối đa 2MB JPG/PNG/WebP; read theo profile visibility hoặc owner trước lần lưu profile đầu. `session-materials` private: session_id/uploader_id/random_uuid, tối đa 10MiB PDF/ảnh/Word/PPT/TXT. Metadata file phải trỏ đến object đã upload thật; chỉ uploader xóa. Chỉ participant đọc/attach trong chính session.

Download/preview tạo signed URL 60 giây; avatar dùng signed URL 1 giờ và refresh hồ sơ định kỳ. Không persist signed URL vào avatar_path hoặc tạo permanent public URL cho file riêng tư. Signed URL đã cấp còn hiệu lực tới expiry. Storage và metadata là hai dịch vụ, nên orphan reconciliation/cleanup là tác vụ vận hành còn cần thêm.

Publication Realtime được mở rộng cho bảng ứng dụng nếu publication đã tồn tại. RLS vẫn hạn chế event visibility. Workspace có refresh fallback; browser tests không xác nhận WebSocket delivery thật.

`refresh_session_statuses` reconcile các phiên của actor khi tải workspace; không có cron toàn hệ thống. Luật chi tiết tại PRODUCT_RULES.md. Bất kỳ thay đổi schema nào sau khi migrations đã áp phải dùng version mới, không sửa remote bằng thao tác ngoài lịch sử.

Production đang chạy: dùng riêng `202611110002_room_sync_rollout.sql` theo [ROOM_SYNC.md](ROOM_SYNC.md), không cần áp 001. Hai bảng mới room_sync_rollout/room_sync_state với RLS và API get_room_v2/join_room_sync/control_pomodoro_v2 không thay API cũ. Cờ ban đầu tắt; bật/tắt bằng scripts trong supabase/operations. Chỉ phòng tạo sau mốc bật cờ và cả hai client mới tham gia được dùng timer chung.

Ngân hàng độc lập: `202611120001_library.sql` chạy trực tiếp sau product.sql, không phụ thuộc room-sync. Tạo library_resources/library_grants/library_attachments và private bucket library-materials; API get_library_resources/create_library_resource, ACL và attach/detach riêng. Không thay session_resources/get_room/get_workspace hoặc policies bucket cũ. Hướng dẫn: [LIBRARY_ACCESS.md](LIBRARY_ACCESS.md).
