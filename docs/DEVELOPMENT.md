# Phát triển

1. Cài dependencies bằng `npm ci`. Nếu Google Drive gây lỗi tar write, chạy `scripts/install-dependencies.ps1` như README. Lockfile đã có trong repository.
2. `.env.local` hiện bật demo để chạy UI không cần Supabase. Các biến môi trường không được commit. Đổi `VITE_DEMO_MODE=false` để dùng luồng thật.
3. `npm run dev`, `npm run typecheck`, `npm run test`, `npm run build`. `npm run preview` dùng production bundle, demo luôn bị tắt.

## Thêm tính năng

Đặt presentation trong `features/<feature>/components`, custom hooks khi có orchestration/lifecycle, business rules thuần trong `domain` hoặc `services`, Supabase calls trong `repositories`. Chỉ tạo folder có code thực sự. PascalCase cho component/type, camelCase cho function/hook, kebab-case cho feature, snake_case cho database.

Khi tách screen từ `src/demo`, giữ markup, class và token hiện có. Thay mock state bằng props/hook; xử lý loading, empty và error rõ ràng. Chưa nối backend thì không thông báo thành công như thao tác thật. Giữ demo riêng để kiểm tra regression thiết kế.

Không import Supabase vào domain. Repository throw error, UI dùng `errorMessage`; không nuốt lỗi hoặc fallback về mock production. Query theo RLS; mutation nhạy cảm dùng RPC. Auth/session không được tạo giả trong repository. Realtime cần cleanup, dedup và reload history sau reconnect; file dùng signed URL có hạn.

Thời gian session phải có timezone, chuẩn hóa ISO UTC trước khi gửi. Weekly availability local phải normalize theo timezone và tuần tham chiếu trước matching; chưa có adapter production. Không so sánh trực tiếp ngày/giờ local của hai user khác múi giờ.

## Tests

Vitest chạy các fixtures deterministic cho matching, scheduling, timer, invitation rules, progress, env/file validation. `tests/database/security.test.ts` dùng PGlite PostgreSQL/WASM với schema auth/storage tối thiểu, áp migration và kiểm tra quyền bằng role authenticated/anon. Không cần Docker hay remote credentials.

```powershell
npm run test
npm run test:watch
npm run typecheck
npm run build
```

Test SQL không xác nhận dịch vụ Supabase từ xa. Sau khi cấu hình project mới, cần kiểm tra OAuth redirect/refresh/sign-out, onboarding save, đọc chéo user, Storage upload/signed URL, Realtime và refresh deep link trên Vercel.

Git đã init ở StudyMatch, chưa có commit/remote. Kiểm tra `git status` trước commit; `.env.local`, node_modules, dist, coverage và .vercel bị ignore.
