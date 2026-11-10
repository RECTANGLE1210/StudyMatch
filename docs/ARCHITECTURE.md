# Kiến trúc

Luồng chính: React UI → hooks/application services → domain thuần TypeScript và repositories → Supabase. Domain chỉ nhận dữ liệu có kiểu và trả kết quả; services điều phối fetching và scoring. Không để domain import React hay Supabase.

- `app`: providers, React Router, auth/onboarding guards, loading/not-found. Route thật yêu cầu session; onboarding dùng hồ sơ server.
- `features/auth`: khôi phục session, lắng nghe auth changes có cleanup, Google OAuth PKCE và sign-out ở shared auth adapter.
- `features/profile`: repository và form thật dùng catalog động; lưu profile + learning data bằng một RPC transaction. Onboarding tái sử dụng form này.
- `features/matching`: công thức `0.35C + 0.30T + 0.20G + 0.15L`, giải thích complementary topics, overlap theo phút, lọc/xếp hạng ổn định; repository phân trang candidates.
- `features/scheduling`: validate thời gian có timezone, chuẩn hóa UTC, state machine và RPC adapter.
- `features/study-room`: timer timestamp, hook cleanup interval và repository attendance/goals/Meet/feedback.
- `features/invitations`, `chat`, `documents`, `notifications`: repository thật với RLS/RPC; presentation gốc chưa nối dữ liệu này.
- `features/progress`: tính toán từ session/goal records, không từ counters do client tự khai.
- `lib`: env, Supabase client/auth/Storage, error mapping. `types`: entities dùng chung.
- `demo`: App/profile/library nguyên mẫu, catalog, fixture và mock writes được cô lập theo entrypoint demo. Không dùng repository demo làm fallback production.

Không tạo các tầng rỗng cho từng tính năng. Chưa cần global store hoặc query cache. React state dùng cho form/timer; Supabase Auth quản lý session. Realtime subscription trả cleanup để hook/page gọi khi unmount. History cần reload khi reconnect và deduplicate theo message ID trước khi nối UI.

## Quy ước matching

Có cùng môn mới được đề xuất. C khởi đầu 40 cho cùng môn; tối đa 60 điểm bổ sung từ strong/weak thực sự hai chiều. C được tính trung bình trên môn chung. Không tính weak/weak hoặc topic vừa strong vừa weak là bổ trợ. T là số phút trùng chia tổng phút nhỏ hơn sau khi gộp overlap; G/L dùng Dice similarity trên tập unique. Score 0–100, tie-break bằng ID.

Domain availability dùng phút trong tuần UTC, độ phân giải một phút. Database lưu ngày/giờ local với IANA timezone của profile. `findMatches` yêu cầu adapter normalize theo tuần tham chiếu, không tự so sánh giờ local của hai múi giờ. Adapter timezone/DST cho production còn cần triển khai. Demo chỉ dùng cùng múi giờ, khung sáng/chiều/tối.

## Ranh giới triển khai

Auth và form hồ sơ đã có code integration; cần project thật để xác nhận OAuth và API. Các màn hình còn lại giữ đầy đủ UI trong demo. Production dùng trạng thái chưa nối dữ liệu, không trình bày mock như dữ liệu thật. Tiếp tục tách từng screen từ demo thành feature component khi nối hook/repository; không cần viết lại thiết kế.
