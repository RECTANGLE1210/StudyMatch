# Trạng thái triển khai

Phạm vi đã chốt: toàn bộ MVP, giữ thiết kế Figma và thay mock data bằng Supabase thật; chưa có project Supabase để áp migrations từ xa.

| Tính năng | UI và code integration | Kiểm chứng / việc còn lại |
|---|---|---|
| Auth | Login Figma, Google PKCE, session restoration, Remember, sign-out, guards | Browser guard/storage tests; cần Google provider thật |
| Hồ sơ/Onboarding | Editors Figma, năm bước, dynamic catalogs/custom options, per-subject knowledge, avatar private | SQL/browser save-refresh tests; cần Storage/Auth HTTP thật |
| Matching | Trọng số 35/30/20/15, complementary topics, timezone/DST, explainability/filter/paging | Unit tests + browser candidates/invitation flow |
| Invitations/Block/Report | Pending/accept/reject/cancel, duplicates/self/block/actor rules, privacy controls | SQL authorization + two-user browser flow |
| Chat | Conversations thật, cursor history, sending, unread, Realtime cleanup/reconnect/dedup | SQL/browser persistence; WebSocket delivery remote chưa kiểm tra |
| Scheduling | Propose/topic/goal, confirm/reject, reschedule/cancel, UTC/state rules | SQL/browser flow; reconcile khi user truy cập, chưa có cron |
| Study Room | ID access, attendance, Pomodoro25/50, goals, Meet, complete/feedback | SQL/browser workflow; timer local, progress theo server clock |
| Documents | Session-scoped library, file/link/Quiz, private previews/downloads, attach/delete | SQL/storage policies + browser upload/sign/preview qua test transport; remote Storage chưa kiểm tra |
| Progress | Time/count/partners/goals/history/chart từ actual records | Unit/SQL/browser aggregate checks |
| Notifications | Transactional rows, real bell, owner reads và unread total | SQL/browser checks; remote Realtime chưa kiểm tra |
| Pricing | Giữ card layout, MVP miễn phí; Sprint/Plus chưa phát hành | Không có fake metrics hoặc billing; payment ngoài scope |
| Deployment | Vercel SPA config, no hardcoded production localhost | Chưa deploy |

Không có `src/demo`, fake default profiles/messages/counters, simulated timeout writes hoặc route IntegrationStatus trong app. Fixtures chỉ tồn tại trong tests; local test HTTP transport không được import vào production.

## Việc bạn cần làm để chạy dữ liệu thật

1. Tạo Supabase project mới; áp hai migrations và seed catalog theo SUPABASE_SETUP.md.
2. Bật Google OAuth, cấu hình callback/redirect URLs, thêm URL và publishable key vào .env.local.
3. Chạy thử hai account thật trong browser profiles khác nhau; xác nhận PostgREST, Storage signed URLs và Realtime.
4. Khi được yêu cầu deploy, thêm env/redirect domain vào Vercel và kiểm tra deep links.

## Giới hạn vận hành MVP

Chưa có background cron khi tất cả user offline, orphan-file cleanup job, tự tạo Google Meet hoặc thanh toán. Candidate/chat đã paging; workspace lists cá nhân hiện được snapshot cùng lúc và cần phân trang tiếp khi dữ liệu tăng lớn. Không tuyên bố các dịch vụ remote hoạt động trước khi project thật được cấu hình và kiểm chứng.
