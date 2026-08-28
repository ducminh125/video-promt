# Hướng dẫn cập nhật mã nguồn Mai Đức Minh'web

Các tệp tin trong thư mục này đã được chỉnh sửa theo yêu cầu của bạn. 
Bạn hãy chép đè các tệp này vào dự án Next.js hiện tại của bạn:

1. `app/layout.tsx`: Đã đổi title trang thành "Mai Đức Minh'web - Trình tạo Video & Ảnh".
2. `components/Nav.tsx`: Đã đổi logo/tên thương hiệu trên thanh điều hướng.
3. `components/Studio.tsx`: 
   - Đã thêm thẻ Tạo ảnh bằng `gpt-image-2-all` với 4 bước.
   - Bổ sung nút chuyển ảnh vừa tạo sang làm ảnh minh họa cho tab Video.
   - Bổ sung Gợi ý giọng nói ở Bước 1 của thẻ Video.
   - Prompt tạo video tự động đính kèm yêu cầu đồng nhất khuôn mặt.
4. `app/api/video/generate/route.ts`: API route mẫu cho thấy cách nối thêm prompt "yêu cầu đồng nhất" ở phía Backend.

Lưu ý: Tùy thuộc vào các component hiện tại (như UI thư viện shadcn/ui, tailwind class), bạn có thể tinh chỉnh lại class CSS cho phù hợp với phong cách của dự án.
