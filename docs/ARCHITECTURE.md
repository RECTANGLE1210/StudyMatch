# Kiến trúc StudyMatch

UI lấy từ Figma Make, được chia thành feature modules và thay data/state mô phỏng bằng hợp đồng Supabase thật. `src/demo` và các route placeholder đã bị loại bỏ. CSS/tokens gốc vẫn giữ nguyên.

## Luồng dữ liệu

React pages → custom hooks/providers/application services → pure domain và repositories/typed RPC adapter → Supabase PostgreSQL/Auth/Storage/Realtime. Page handlers điều phối thao tác nhỏ; không chứa SQL hoặc tự gán server timestamps/counters.

- `app`: providers, data router, guards, lazy pages. Suspense nằm quanh từng page để giữ sidebar và navigation blocker ổn định khi tải route.
- `features/auth`: Google OAuth PKCE, khôi phục session, sign-out. Remember chọn localStorage/sessionStorage; không có password auth giả.
- `features/profile`: ProfileProvider giữ hồ sơ thật/draft và bảo vệ response cũ, ProfileScreens giữ nguyên editors/onboarding năm bước từ Figma. profileService tải catalog, lưu transactional view và upload avatar private.
- `features/workspace`: một snapshot authenticated cho invitations/conversations/sessions/resources/notifications/progress; refresh sau mutation, Realtime, reconnect/focus và định kỳ. Snapshot gắn với user ID, không giữ dữ liệu user cũ sau đổi session.
- `features/matching`: scoring thuần, timezone/DST normalization, candidate paging, UI giải thích strong/weak và filters. Trọng số chỉ có một module.
- `features/chat`: cursor `(created_at,id)`, merge/dedup, subscription cleanup, read/unread. Không giả tin nhắn đã gửi; form chỉ xóa sau RPC thành công.
- `features/scheduling`: form từ Figma và RPC propose/confirm/reject/reschedule/cancel; timezone UTC conversion và state machine độc lập.
- `features/study-room`: load/access theo session UUID, attendance, shared goals, Meet, feedback và timestamp Pomodoro local; progress dùng server clock thay vì timer UI.
- `features/documents`: private uploads/metadata, session-scoped library, attach/detach, PDF/image previews và signed downloads.
- `features/progress`, `notifications`, `home`, `pricing`: hiển thị actual data hoặc empty/loading/error. Pricing chưa có billing.
- `lib/supabase`: client/auth/storage và typed RPC boundary; `types`: entities/DTOs chung.

Không thêm global store hoặc cache framework mới khi workspace snapshot và hooks hiện tại đủ dùng. Candidate và chat history có pagination; workspace hiện đọc các bản ghi user được phép truy cập và aggregate progress phía SQL. Khi dữ liệu cá nhân tăng lớn, cần tiếp tục phân trang session/library/conversation lists; không có giới hạn tổng số user/môn học trong schema.

## Tính nhất quán và quyền

Mutation nhạy cảm là PostgreSQL transaction. Browser không sửa protected progress, participants, author IDs hoặc state timestamps. RLS áp dụng cho table reads, RPC invoker và Realtime; privileged helpers có search_path cố định và explicit grants. Profile API nhận expected user ID để từ chối save đã bắt đầu trước lúc đổi account.

UI chỉ hiển thị thành công sau API resolve; failure giữ form và báo lỗi. Old/stale fetches không thay room/profile mới. Hooks cleanup Realtime, timers, listeners và load lại khi reconnect để bù sự kiện bị lỡ.

Auth/Storage/Realtime production vẫn cần project thật; tests dùng database WASM với transport HTTP riêng chỉ trong tests. Không có mock runtime hoặc backend fallback trong bundle.
