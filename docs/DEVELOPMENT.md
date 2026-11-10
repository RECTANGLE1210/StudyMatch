# Phát triển

`npm ci`, cấu hình `.env.local` theo SUPABASE_SETUP.md rồi `npm run dev`. Không có demo switch; chưa cấu hình backend thì chỉ Login hoạt động, không tạo user/writes giả. Google Drive có thể cần scripts/install-dependencies.ps1.

Feature directories dùng kebab-case, components/types PascalCase, functions/hooks camelCase và database snake_case. Giữ markup/class/token từ Figma khi đổi data bindings. UI chỉ xác nhận thành công sau API; không fallback về mock khi lỗi. Dùng ErrorNotice và giữ form khi mutation thất bại.

Thêm business rule thuần ở domain, test độc lập React/Supabase. Queries/Storage/RPC nằm sau adapters/services/hooks; schema changes dùng migration version mới. Quyền actor/state phải được bảo vệ ở database, không chỉ UI. Không có service_role hoặc OAuth secret trong VITE_*.

Realtime subscriptions trả cleanup, cần dedup theo ID và reload khi reconnect; workspace snapshot gắn với actor ID. Không publish private file URL lâu dài. Khi thay profile/provider, giữ request-generation checks để response cũ không ghi đè state mới. Timer dùng timestamps và cleanup interval, không dùng tick count làm số giờ học server.

```powershell
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Vitest chạy domain, timezone/DST, env/session storage và SQL authorization qua PGlite. Playwright dùng migrations thật với HTTP transport chỉ trong tests/e2e; user/session fixtures không nằm trong src hoặc seed. Các tests này không xác nhận Google provider, Supabase PostgREST nuances, WebSocket delivery hoặc Storage HTTP remote. Dùng project thật kiểm tra cuối theo checklist setup.

E2E dùng Chrome chuẩn trên Windows, CHROME_EXECUTABLE nếu được đặt, hoặc browser Chromium đã cài bằng `npx playwright install chromium`. Test artifacts ở test-results/playwright-report được ignore. `npm run format` dùng Prettier.

Không push/deploy hay sửa remote database ngoài phạm vi đã được yêu cầu. Ghi kết quả xác minh thực tế ở VERIFICATION.md; phân biệt code integration, test fixture và remote verification.
