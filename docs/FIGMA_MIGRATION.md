# Figma → StudyMatch product

Nguồn chuẩn: https://www.figma.com/make/LT1BBnuJWkxsfsO3sLGAoZ/StudyMatch . Đã đọc trực tiếp App.tsx/profile.tsx/library.tsx/index.css và đối chiếu lại ngày 10/11/2026; bốn file nguồn Figma chưa đổi so với export ban đầu. Figma Make không hỗ trợ screenshot qua node tool; visual reference được render từ source Figma ở cùng viewport với app.

| Source Figma | Triển khai hiện tại |
|---|---|
| src/index.css | src/styles/index.css, giữ nguyên byte: fonts, brand colors, layout/responsive tokens |
| App.tsx sidebar/mobile shell | components/layout/AppLayout.tsx, bindings bằng profile/router/workspace thật |
| App.tsx Login | features/auth/components/Login.tsx, giữ đồ họa/SVG/layout và Google OAuth thật |
| App.tsx Home/Match/Chat/Sessions/Room/Progress/Pricing | Các feature page tương ứng; giữ card/modal/classes, thay mock state bằng backend |
| profile.tsx | features/profile/components/ProfileScreens.tsx + ProfileProvider/profileService; giữ editors/năm bước, thay default user/catalog/save/avatar giả |
| library.tsx | features/documents/components/LibraryScreen.tsx; upload/link/preview/attach/delete private theo session |
| public/favicon.svg | Copy asset SVG gốc, không vẽ lại |
| main.tsx / index.html / configs | Dùng bootstrap, router, env, tests và Vercel config của repository; không copy Vite platform code nội bộ .figma |

Source cũ ở src/demo và alternate ProfileForm đã được thay thế, không giữ runtime mock fallback. User/session/message/progress mặc định bị loại bỏ; các fixtures chỉ dùng trong tests. source-manifest.json giữ hash lịch sử của sáu file export ban đầu trước khi dọn file trùng ngoài repo.

Thay đổi có chủ đích theo yêu cầu: actual/empty/loading/error states, real matching scores và thứ tự, validated timezone/session controls, private session picker cho tài liệu và feedback rating. Email/password không phải custom auth; Google OAuth là phương thức duy nhất. Remember điều khiển persistence thật. Pricing giữ bố cục, bỏ các số liệu/giá/ý định mua giả; Sprint/Plus chưa phát hành.

Các PNG được liệt kê trong Make resource manifest không được source UI tham chiếu; UI hiện dùng SVG inline/emoji và avatar từ user data. Không thay ảnh tĩnh bằng placeholder hoặc thêm icon library khác. Các ảnh verification cũ là snapshot prototype lịch sử, không phải dữ liệu mặc định của app hiện tại.
