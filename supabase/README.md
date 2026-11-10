# Khởi tạo Supabase

Chưa có credentials/project được cung cấp. Không có migration nào được chạy trên Supabase từ xa. SQL đã được áp và kiểm tra trên PGlite PostgreSQL trong Vitest, với auth/storage schemas mô phỏng tối thiểu.

1. Tạo Supabase project mới, không dùng database đang có dữ liệu quan trọng cho migration khởi tạo này.
2. Review `migrations/202611040001_foundation.sql`, chạy file đó trong SQL Editor của project mới. Chạy `seed.sql` để thêm catalog. Lưu lịch sử áp dụng migration; mọi thay đổi tiếp theo dùng file version mới.
3. Nếu dùng Supabase CLI, initialize config, link đúng project mới và review `supabase db push --dry-run` trước khi chủ động `supabase db push`. Không chạy reset trên remote hoặc sửa schema ngoài migration. Không cần Docker cho frontend/tests hiện tại.
4. Bật Google provider trong Authentication. Nhập OAuth secrets trong dashboard của provider/Supabase, không đưa vào React hoặc Git. Allowlist `/login` trên origin local và Vercel; Site URL dùng domain deploy thực tế.
5. Lấy project URL và publishable key (`sb_publishable_...`) đưa vào `.env.local`; tắt VITE_DEMO_MODE. App dùng origin hiện tại để redirect nên không hardcode localhost trong production.
6. Kiểm tra bucket `session-materials` private và publication `supabase_realtime` có messages/notifications. Nếu project không có publication, cần cấu hình Realtime trước khi kiểm thử delivery.
7. Test bằng hai participant và một outsider: hồ sơ, invitation accept, chat, session transitions, signed URLs và file deletion. PGlite tests không thay thế kiểm thử dịch vụ thực.

Tham khảo chính thức: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [Google OAuth API](https://supabase.com/docs/reference/javascript/auth-signinwithoauth). Helpers privileged có explicit grants/search_path; chỉ browser publishable key được dùng trong source.
