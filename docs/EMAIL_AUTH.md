# Đăng ký và đăng nhập bằng email

StudyMatch dùng Supabase Auth cho cả Google và email/mật khẩu. Không cần thêm bảng, SQL migration hoặc đưa secret/service_role key vào frontend. Các tài khoản, ID hồ sơ và dữ liệu hiện có được giữ nguyên.

## Cấu hình Supabase đang deploy

1. Trong **Authentication → Sign In / Providers → Email**, bật Email provider và cho phép đăng ký người dùng mới. Giữ **Confirm email** bật để xác nhận chủ sở hữu email. Đặt minimum password length ít nhất **8** để khớp form; cấu hình mạnh hơn trên Supabase vẫn được áp dụng.
2. Trong **Authentication → URL Configuration**, đặt Site URL là `https://study-match-five.vercel.app`. Thêm Redirect URLs chính xác:
   - `https://study-match-five.vercel.app/login`
   - `https://study-match-five.vercel.app/reset-password`
   - Khi phát triển local: thêm `/login` và `/reset-password` của origin Vite đang dùng, ví dụ `http://localhost:5173/login` và `http://localhost:5173/reset-password`.
   Giữ redirect Google hiện có. Với preview deployments, chỉ thêm các origin preview thực sự cần kiểm tra.
3. Cấu hình **custom SMTP** trong phần Authentication/Email để gửi email xác nhận và khôi phục cho người dùng thực. Điền host, port, user/password và sender theo dịch vụ email của bạn trong Supabase Dashboard; không đưa SMTP password vào Vite hay Git. SMTP mặc định chỉ gửi đến email thành viên tổ chức và có giới hạn thấp, không dùng để phục vụ đăng ký rộng rãi. Xem [hướng dẫn SMTP chính thức](https://supabase.com/docs/guides/auth/auth-smtp).
4. Nếu đã sửa email templates, bảo đảm liên kết **Confirm signup** và **Reset password** dùng `{{ .ConfirmationURL }}` để Supabase xác thực trước khi quay lại app. Không trỏ trực tiếp tới form mà bỏ token xác thực.
5. Deploy frontend rồi kiểm tra bằng email thực có thể nhận thư. Không cần sửa Google Cloud callback, reset database hoặc tạo lại người dùng.

## Luồng người dùng

- `/login`: nhập **Email** và **Password**, bấm **LOGIN WITH EMAIL**. Không dùng mã sinh viên làm email. Nút **LOGIN WITH GOOGLE** vẫn đăng nhập Google.
- **Create Account** → `/signup`: nhập email, mật khẩu ít nhất 8 ký tự và xác nhận mật khẩu. Khi Confirm email bật, app nhắc kiểm tra hộp thư, không tự coi tài khoản đã xác thực. Có nút gửi lại email xác nhận. Nếu hệ thống đã có địa chỉ đó, thông báo không xác nhận tài khoản có tồn tại hay không; dùng đăng nhập/quên mật khẩu thay vì tạo hồ sơ mới.
- Email xác nhận quay về `/login`; Supabase SDK trao đổi PKCE code. Người mới vào onboarding; người đã có hồ sơ quay lại ứng dụng.
- **Forgot password?** → `/forgot-password`: gửi yêu cầu bằng email. Thông báo thành công không tiết lộ tài khoản có tồn tại hay không. Mở email trên **cùng trình duyệt** đã yêu cầu để SDK đọc PKCE verifier; nếu bỏ Remember, dùng cùng tab vì verifier ở sessionStorage.
- `/reset-password`: chỉ hiện form sau khi SDK xác thực liên kết và phát sự kiện PASSWORD_RECOVERY. Nhập mật khẩu mới/xác nhận, lưu rồi tiếp tục vào app. Không refresh khi đang đổi mật khẩu; sau refresh hoặc khi link lỗi/hết hạn, gửi lại yêu cầu mới. Link dùng một lần. Các yêu cầu lỗi không thay đổi hồ sơ.
- Người đã đăng nhập Google có thể đăng xuất và dùng **Forgot password?** với chính email Google để đặt mật khẩu, sau khi xác thực email. Đây là thêm phương thức đăng nhập vào tài khoản hiện tại, không sao chép hồ sơ. Supabase hỗ trợ [thêm password vào OAuth user](https://supabase.com/docs/guides/auth/auth-identity-linking). Không tự gộp hai email khác nhau trong code ứng dụng.
- Remember quyết định lưu auth session trong localStorage hay sessionStorage như trước. Mật khẩu chỉ giữ trong state của form và gửi qua Supabase Auth; không lưu vào browser storage hoặc bảng public. Supabase xử lý hash, kiểm tra và chính sách mật khẩu.

## Kiểm chứng

```powershell
npm.cmd run test
npx.cmd playwright test tests/e2e/auth.spec.ts
npm.cmd run build
```

Browser tests dùng SDK Supabase thực với HTTP fixture riêng trong tests: kiểm tra mapping API, PKCE, auth events, lưu phiên, lỗi/xác nhận/gửi lại email, reset và Google redirect. Không gửi email thật hoặc chứng minh SMTP/Google provider đã được cấu hình trên project đang deploy.

Kiểm tra remote trước khi thông báo tính năng đã sẵn sàng: đăng ký email mới → nhận/xác nhận thư → onboarding → đăng xuất/đăng nhập; quên mật khẩu → nhận thư → đổi mật khẩu → đăng nhập bằng mật khẩu mới; link hết hạn không mở form; tài khoản Google cũ vẫn giữ đúng hồ sơ. Tham khảo [password-based auth](https://supabase.com/docs/guides/auth/passwords).
