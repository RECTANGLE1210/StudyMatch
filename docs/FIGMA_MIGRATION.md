# Figma Make migration

Audit ban đầu: DMST chỉ có `App.tsx`, `profile.tsx`, `library.tsx`, `main.tsx`, `index.css`, `vite-env.d.ts`. Không có package.json, src/, public/, node_modules, Git repository hay thư mục StudyMatch. Không có Figma link hoặc file assets riêng.

Các screen được xác nhận: Login, Onboarding, Home, Smart Match, Chat, Sessions, Room, Library, Progress, Pricing và Profile; có modal/public profile, notifications và responsive sidebar/mobile navigation. Navigation trước đây là `useState<Scr>`. State nằm trong React state/ProfileContext; data, catalog, login, message, upload và progress đều mô phỏng.

| Source gốc trong DMST | Đích và thay đổi |
|---|---|
| App.tsx | Copy thành src/demo/App.tsx; thêm React Router adapter, thay timer bằng hook domain; tách Login view tái sử dụng cho OAuth thật |
| profile.tsx | Copy thành src/demo/profile.tsx; giữ profile UI, catalog/mock provider; scorePeer gọi domain matching qua adapter |
| library.tsx | Copy nguyên byte thành src/demo/library.tsx |
| index.css | Copy nguyên byte thành src/styles/index.css; giữ toàn bộ tokens, fonts, layout và responsive rules |
| main.tsx | Copy rồi đổi entry sang src/app/App.tsx, styles path và ErrorBoundary |
| vite-env.d.ts | Copy nguyên byte thành src/vite-env.d.ts |

Ở lần migration đầu, giữ nguyên cả sáu source gốc ở DMST. Sau đó, theo yêu cầu dọn workspace của người dùng, đã đối chiếu hash với manifest, xác nhận các bản trong StudyMatch đầy đủ và xóa sáu file trùng ở DMST; source hiện nằm trong repository StudyMatch. SVG inline, emoji và font imports được giữ. Không thay thư viện UI hoặc thiết kế. Password fields gốc chỉ giữ phần trình bày và được disable; Google OAuth là auth thật duy nhất. Demo entry không còn random failure.

Thêm cấu hình React/Vite/Tailwind v4 vì source chưa có manifest. Baseline nguyên bản đã được dựng trong thư mục kiểm tra local với cấu hình này và build thành công; không có baseline npm command trước khi khôi phục cấu hình.

Mock vẫn nằm cùng UI prototype trong src/demo để giảm rủi ro rewrite. Mọi đường vào demo đều được gate bằng DEV + VITE_DEMO_MODE=true. Production không có mock fallback. Phần UI chưa tích hợp được hiển thị đầy đủ trong demo; production ghi rõ trạng thái chưa nối dữ liệu.

Đã kiểm tra browser 10 URL chính/chi tiết, sidebar, onboarding entry, trang 404, desktop và mobile; không có page error. Ảnh kiểm tra tại `docs/verification/desktop.png` và `mobile.png`. Hash lịch sử của source gốc trước khi dọn file trùng được lưu trong `source-manifest.json`.
