# Kết quả kiểm tra — 10/11/2026

Mã trong `src`, `tests` và `supabase` được đối chiếu byte-for-byte với bản sao local đã chạy kiểm thử tại `product-verification-nj7qhs5w`. Google Drive có thể làm thao tác npm chậm; bản sao local sử dụng cùng package-lock và dependencies. Typecheck, 82 tests và production build cũng đã chạy lại thành công trực tiếp trong repo trên ổ G. Không có project Supabase thật hoặc deployment được tạo trong lần triển khai này.

| Kiểm tra trên bản sao local | Kết quả |
|---|---|
| TypeScript | `npm run typecheck` thành công |
| Unit/domain/database | `npm run test`: **82 tests / 9 files passed**, gồm 26 SQL/authorization tests |
| Production build | `npm run build` thành công, Vite 8.3.5 |
| Browser workflows | `npm run test:e2e`: **3 tests passed**, Chrome desktop/mobile |
| Browser page errors | 0 trong luồng hai người dùng |
| Figma CSS | `src/styles/index.css` nguyên byte so với source Figma |
| Runtime demo | Đã bỏ src/demo, demo mode và default users/activity |

## Những gì đã được kiểm tra

- Anonymous vào trang được bảo vệ sẽ về Login, không nhận danh tính demo.
- Hai tài khoản test gửi/chấp nhận lời mời, chat, đề xuất/chấp nhận lịch, xác nhận attendance, bắt đầu buổi học, sửa checklist/Meet, upload PDF và mở signed preview, hoàn thành, gửi feedback và xem tiến độ.
- Onboarding năm bước lưu profile thật qua SQL local và giữ dữ liệu sau refresh; chỉnh sửa profile, cảnh báo thay đổi chưa lưu và layout mobile.
- Database chạy cả hai migrations với role authenticated/anon trong PGlite: actor spoofing, outsider access, RLS, private storage metadata, profile atomic rollback, block/report, unread, lifecycle/deadline và progress.
- Matching theo trọng số đã chốt, timezone/DST, timer và lựa chọn session persistence.

Các fixture identities, auth tokens và HTTP transport nằm riêng trong tests. Transport thực thi PostgreSQL/RLS local nhưng mô phỏng giao thức Auth/Storage; không được import vào app production và không chứng minh tích hợp Google/Supabase từ xa đã hoạt động.

## Giới hạn xác minh

Chưa kiểm tra Google OAuth provider, Supabase PostgREST thực, Realtime delivery, Storage HTTP/signed URLs thực hoặc deploy Vercel. Làm theo [SUPABASE_SETUP.md](SUPABASE_SETUP.md), áp hai migrations vào project mới rồi chạy checklist hai tài khoản và outsider. Không dùng service_role trong frontend.

Figma Make không hỗ trợ screenshot qua MCP ở file này. Code nguồn được đọc trực tiếp; CSS và favicon giữ nguyên, markup được nối dữ liệu động. Chưa có automated pixel-diff với Figma. [Ảnh mobile hiện tại](verification/live-mobile.png) dùng **dữ liệu fixture kiểm thử**, không phải dữ liệu mặc định sản phẩm; banner mất kết nối trong ảnh do transport local không cung cấp Realtime.

Các file `verification/desktop.png`, `mobile.png`, `browser.json` và `source-manifest.json` là bằng chứng lịch sử của bước khởi tạo 04/11, không mô tả dữ liệu hoặc giao diện runtime hiện tại. [live-results.json](verification/live-results.json) ghi kết quả kiểm thử lần này.

## Chạy lại

```powershell
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

E2E dùng Chrome cài sẵn trên Windows hoặc CHROME_EXECUTABLE; máy chưa có browser có thể chạy `npx playwright install chromium`. Không cần credentials thật để chạy tests local.
