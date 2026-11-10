# Trạng thái triển khai

Đây là foundation có thể build/test, chưa phải MVP end-to-end hoàn chỉnh. UI gốc thuộc demo; không đánh đồng mock interaction với backend.

| Tính năng | UI | Logic/foundation | Supabase và việc còn lại |
|---|---|---|---|
| Auth | Login gốc dùng chung | Provider session restoration, PKCE, guards, errors, sign-out | Code integration đã có; chưa kiểm tra Google OAuth từ xa |
| Onboarding/Profile | UI gốc demo; form thật riêng | Dynamic catalogs, nhiều môn, proficiency, strong/weak, goals/styles, lịch rảnh | RPC lưu nguyên tử + RLS đã test local; cần kiểm thử API thật, đưa form thật về đúng UI gốc, avatar upload riêng |
| Matching | UI gốc demo | Pure scoring, overlap, explainability, stable ranking/filter; demo gọi domain mới | Candidate repository phân trang + service; thiếu timezone/DST adapter và live UI hook |
| Invitations | UI/notifications demo | Client rules, duplicate/self/block/transition checks | Transactional RPC + RLS test local; chưa nối UI thật |
| Chat | UI demo | History paging, send/mark-read, Realtime cleanup/error callback | Repository + participant RLS; còn unread UI, dedup/reconnect và test delivery thật |
| Scheduling | UI demo | UTC validation, explicit state machine | Propose/respond/reschedule RPC + security tests; còn live UI, topic-selection repository, tự động đánh dấu missed |
| Study Room | UI demo | Timestamp Pomodoro 25/50, pause/resume/reset; checklist logic | Attendance/goals/Meet/feedback adapters, server progress timestamps; chưa nối room theo ID thật |
| Documents | Library/resource UI demo | MIME/size checks, metadata, educational links, signed URLs | Private bucket policies + upload/list/delete adapters; còn nối UI, previews thật, orphan reconciliation |
| Progress | UI demo (số liệu mẫu) | Pure aggregate từ actual session/goal inputs, unit test | Chưa fetch/hiển thị thống kê thật; không cho client ghi counters |
| Notifications | Bell UI demo | Transactional notifications và owner-only read/mark-read | Chưa nối bell với repository/Realtime |
| Pricing | Giữ UI demo | Không triển khai thanh toán | Ngoài foundation; không dùng dịch vụ trả phí |
| Deployment | Vercel config + SPA fallback | Production demo guard có test/browser check | Chưa deploy |

## Ưu tiên tiếp theo

1. Tạo Supabase project mới, review/apply migration + seed; bật Google OAuth, kiểm tra auth và profile API bằng hai tài khoản.
2. Nối profile UI gốc với repository/hook thật, bổ sung avatar Storage và trải nghiệm editor thống nhất.
3. Hoàn thiện timezone normalization; nối matching và invitations, xử lý loading/error/empty.
4. Nối chat với Realtime, unread và reconnect; nối scheduling và room theo session ID.
5. Nối file previews và progress/notifications thật; thêm reconciliation và missed-session automation phù hợp.
6. Chạy end-to-end authorization bằng nhiều user trên Supabase; deploy preview Vercel khi được yêu cầu.
