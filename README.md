# StudyMatch

Ứng dụng MVP ghép bạn học 1–1: Google OAuth, hồ sơ học tập, matching, lời mời, chat, lịch học, Study Room, tài liệu riêng tư, tiến độ và thông báo. UI được chuyển từ Figma Make StudyMatch, giữ CSS/tokens, sidebar, card, modal và bố cục responsive; dữ liệu hiển thị lấy từ Supabase, không có tài khoản hoặc hoạt động demo mặc định.

## Chạy ứng dụng

Yêu cầu Node >=22.12, npm và trình duyệt hiện đại.

```powershell
npm ci
Copy-Item .env.example .env.local
# Điền project URL và publishable key thật trong .env.local
npm run dev
```

Chưa có project Supabase thì app chỉ mở màn hình Login; không giả đăng nhập hoặc ghi dữ liệu. Làm theo [SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) để tạo project mới, áp hai migrations theo thứ tự, seed catalog và bật Google OAuth. Không dùng service_role/secret key trong frontend. `.env.local` luôn bị ignore.

Nếu npm giải nén lỗi trên Google Drive, dùng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-dependencies.ps1
```

Script cài npm ci trên ổ local rồi copy dependencies về repo. Nếu Google Drive đang đồng bộ nhiều file, thao tác copy có thể chậm; build và kiểm thử cũng có thể chạy trên bản sao local giống hệt source.

## Lệnh

| Lệnh | Công dụng |
|---|---|
| `npm run dev` | Vite development server |
| `npm run typecheck` | TypeScript strict |
| `npm run test` | Unit/domain và SQL/RLS tests bằng PGlite |
| `npm run test:e2e` | Browser workflows qua HTTP transport chỉ dành cho tests |
| `npm run build` | TypeScript và production build |
| `npm run preview` | Xem production build |
| `npm run format` | Prettier cho TypeScript/TSX |

E2E tự dùng Chrome nếu có ở vị trí chuẩn trên Windows. Có thể đặt CHROME_EXECUTABLE, hoặc chạy `npx playwright install chromium` trước tests trên máy chưa có browser. Fixtures/transport chỉ nằm trong tests, không được import hoặc bật trong app thật.

## Stack và kiến trúc

React/TypeScript/Vite, Tailwind v4, React Router, Supabase Auth/PostgreSQL/Realtime/Storage, Vitest/PGlite và Playwright. Không có Express/FastAPI, Docker hoặc dịch vụ AI riêng. Feature modules tách UI, hooks/application services, domain thuần và data-access adapters/RPC. Xem [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Trạng thái

Code UI và backend đã nối theo hợp đồng Supabase; kiểm thử local không thay thế kiểm thử Google OAuth, PostgREST, Realtime và Storage HTTP của project thật. Chưa có remote project được cung cấp, chưa áp migration từ xa và chưa deploy. [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) ghi rõ giới hạn.

MVP miễn phí; trang gói giữ layout Figma nhưng Sprint/Plus chưa phát hành, không có thanh toán hoặc fake-door metrics.

Vercel dùng build `npm run build`, output `dist`; vercel.json có SPA fallback. Đặt VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY trong Vercel, thêm domain/login vào OAuth redirect allowlist. Không hardcode localhost trong code OAuth production.

Tài liệu: [Thiết lập Supabase](docs/SUPABASE_SETUP.md), [luật sản phẩm](docs/PRODUCT_RULES.md), [database](docs/DATABASE.md), [phát triển](docs/DEVELOPMENT.md), [migration Figma](docs/FIGMA_MIGRATION.md), [verification](docs/VERIFICATION.md).
