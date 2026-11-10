# StudyMatch

Nền tảng MVP ghép bạn học 1–1, giữ nguyên UI Figma Make phong cách matcha và coffee. Repository tập trung vào foundation; các màn hình prototype chưa phải tính năng backend hoàn chỉnh.

## Bắt đầu

Yêu cầu Node.js >=22.12 (đã kiểm tra với 24.15), npm và trình duyệt hiện đại.

```powershell
cd 'G:\My Drive\HUST\IT-E10\DMST\StudyMatch'
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Máy hiện tại đã có dependencies và `.env.local` chỉ chứa `VITE_DEMO_MODE=true`, có thể chạy `npm run dev` ngay. Chế độ demo có nhãn rõ ràng, lưu dữ liệu trong memory và không xác thực/ghi dữ liệu thật. Production luôn tắt demo, kể cả khi biến này là `true`.

Google Drive trên máy này từng gây `TAR_ENTRY_ERROR` khi npm giải nén trực tiếp. Nếu gặp lại, dùng lệnh đã kiểm tra:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-dependencies.ps1
```

Script chạy `npm ci` ở thư mục tạm trên ổ local, copy dependencies về repository rồi dọn thư mục tạm. Không thay source hoặc commit dependencies.

## Lệnh phát triển

| Lệnh | Mục đích |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | Kiểm tra TypeScript strict |
| `npm run test` | Vitest: domain, cấu hình, PostgreSQL/RLS |
| `npm run test:watch` | Theo dõi unit tests |
| `npm run build` | TypeScript và Vite production build |
| `npm run preview` | Xem production build tại local |

## Supabase

Đặt `VITE_DEMO_MODE=false`, `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...` trong `.env.local`. Không dùng secret/service_role key. Biến `VITE_*` được đưa vào bundle nên chỉ chứa thông tin công khai. Xem [hướng dẫn database](supabase/README.md) để áp dụng migration trên project mới và bật Google OAuth. Chưa thực hiện thao tác database từ xa.

## Công nghệ và kiến trúc

React, TypeScript, Vite, Tailwind CSS v4, React Router, Supabase và Vitest. Lucide React có sẵn để phát triển tiếp; icon SVG/emoji gốc vẫn được giữ. Chưa thêm TanStack Query vì hiện chưa có nhiều màn hình server-state cần cache.

`src/app` quản lý router/providers/guards. `src/features` chứa domain, services, hooks và repositories theo chức năng. `src/demo` cô lập prototype và mock data. Domain TypeScript không phụ thuộc React/Supabase; UI gọi hooks/repositories thay vì chứa SQL. Không có backend server riêng.

## Deploy

Vercel: Root Directory `StudyMatch` nếu import repository cha; nếu import repository này thì để root mặc định. Build `npm run build`, output `dist`. `vercel.json` có SPA fallback. Thêm hai biến Supabase công khai trong Vercel và origin deploy vào allowlist OAuth của Supabase. Không cần hardcode localhost; OAuth dùng origin hiện tại. Chưa deploy.

## Tài liệu

- [Kiến trúc](docs/ARCHITECTURE.md), [database](docs/DATABASE.md), [phát triển](docs/DEVELOPMENT.md).
- [Migration Figma](docs/FIGMA_MIGRATION.md), [trạng thái thực tế](docs/IMPLEMENTATION_STATUS.md).
- [Kết quả kiểm tra](docs/VERIFICATION.md), [cây repository thực tế](docs/REPOSITORY_TREE.md).

Git được khởi tạo ở chính `StudyMatch`; thư mục `DMST` trước đó chưa có repository. Chưa commit, tạo remote hoặc push. Nếu sau này đặt `DMST` trong Git, chọn theo dõi riêng StudyMatch hoặc hợp nhất lịch sử trước, không giữ hai repository chồng nhau ngoài ý muốn.
