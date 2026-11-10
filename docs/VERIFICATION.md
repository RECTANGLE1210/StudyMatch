# Kết quả kiểm tra — 04/11/2026

Tất cả kết quả cuối được chạy trực tiếp tại `G:\My Drive\HUST\IT-E10\DMST\StudyMatch`, không chỉ trên bản copy tạm.

| Kiểm tra | Kết quả thực tế |
|---|---|
| Cài dependencies | Thành công, 86 packages qua npm ci trong local temp + copy về workspace |
| Script workaround | `scripts/install-dependencies.ps1` đã chạy thành công end-to-end và dọn temp riêng |
| Dependency tree | `npm ls --depth=0` thành công, không missing dependencies |
| TypeScript | `npm run typecheck` thành công |
| Unit/database tests | `npm run test`: 61 tests / 7 files passed |
| Production build | `npm run build` thành công, Vite 8.3.5 |
| Dev server | `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort` ready; browser tải app thành công |
| Production preview | Server port 4174 hoạt động; unauthenticated route chuyển về /login |
| Browser desktop/mobile | Chrome headless, viewport 1440×1000 và 390×844; 10 URL, sidebar, 404, demo onboarding entry |
| Interactions | Pomodoro 25/50, pause, reset; gửi/hủy invitation demo thành công |
| Production safeguards | Không có demo badge/entry; OAuth khi thiếu cấu hình hiển thị lỗi rõ ràng |
| Browser page errors | 0 |
| Source preservation | Hash của cả 6 source gốc không đổi; library.tsx/index.css/vite-env.d.ts copy nguyên byte |
| Git exclusions | .env.local, node_modules, dist được ignore; không có remote |

Trước khi có cấu hình, source gốc không có package.json nên không thể chạy npm trực tiếp. Đã dựng baseline nguyên bản trong thư mục tạm cùng React/Vite/Tailwind config và build thành công. Browser verification kiểm tra bản ứng dụng đã tổ chức lại; không tuyên bố pixel-diff tự động với Figma.

Lỗi ban đầu: npm giải nén trực tiếp trên Google Drive tạo TAR_ENTRY_ERROR; bản dependency chưa hoàn chỉnh từng khiến tsc không chạy hoặc thiếu vite/client. Đã giải quyết bằng cài local rồi robocopy /MT:32, sau đó chạy lại toàn bộ kiểm tra tại repository thật thành công. Workaround được lưu trong scripts/ để dùng khi cài mới.

PGlite chạy migration và 15 tests SQL/authorization bằng role authenticated/anon. Schema auth/storage tối thiểu được dựng riêng trong test, không tác động remote Supabase. Chưa kiểm tra OAuth provider, PostgREST API, Storage HTTP/signed URL, Realtime delivery hoặc Vercel deploy thật.

Ảnh đã xem thủ công: [desktop](verification/desktop.png), [mobile](verification/mobile.png). Thông tin browser: [browser.json](verification/browser.json). Các dev/preview server dùng để kiểm tra được dừng sau verification.
