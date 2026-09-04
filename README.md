# Mai Đức Minh'web AI Studio

Web app AI mang thương hiệu **Mai Đức Minh'web**, gồm 2 luồng 4 bước: tạo video và tạo ảnh. Upstream kỹ thuật vẫn dùng API key/base URL ShopAIKey ở server để không làm thay đổi cấu hình deploy hiện có.

Luồng tạo video:

1. Nhập mô tả + đính kèm ảnh hoặc video tham chiếu.
2. GPT-5.4 tạo đúng 3 gợi ý prompt video.
3. Chọn và chỉnh sửa prompt.
4. Gửi prompt sang `grok-video-3`, polling trạng thái và hiển thị video.

Luồng tạo ảnh:

1. Nhập mô tả + đính kèm tối đa 4 ảnh tham chiếu.
2. GPT-5.4 tạo đúng 3 gợi ý prompt ảnh.
3. Chọn và chỉnh sửa mô tả tiếng Việt.
4. Gửi sang `gpt-image-2-all`; ảnh kết quả được ưu tiên lưu vào Vercel Blob và có nút chuyển trực tiếp sang làm ảnh minh họa/tham chiếu cho luồng tạo video.

Mọi prompt video có ảnh tham chiếu đều được backend chèn ràng buộc bắt buộc giữ **đúng cùng một người/nhận diện nhân vật** từ ảnh trước khi gửi sang model video. Bước 1 của video có thêm gợi ý về ngôn ngữ, chất giọng, thoại, tốc độ/cảm xúc và lip-sync.

Có trang `/history` riêng để lưu:

- mô tả ban đầu;
- chỉ prompt cuối cùng đã chọn/chỉnh sửa để tạo video;
- ảnh/frame tham chiếu;
- cấu hình video;
- task id, trạng thái, tiến độ;
- URL video hoàn thành hoặc lý do thất bại.

## Kiến trúc

- **Next.js App Router + TypeScript**: frontend + server API routes.
- **Mai Đức Minh'web API (branding trên web)**: upstream server gọi ShopAIKey cho `gpt-5.4`, `grok-video-3` và `gpt-image-2-all`.
- **Vercel Blob**: lưu ảnh/frame tham chiếu dưới URL public để ShopAIKey có thể đọc.
- **Neon Postgres**: lịch sử prompt/video. Bảng được tự tạo ở request đầu tiên.
- **Basic Auth tùy chọn**: bảo vệ toàn bộ web/API khỏi người lạ dùng credit.

### Cách xử lý video tham chiếu

Tài liệu Grok Video của ShopAIKey hiện mô tả `metadata.images` nhưng chưa mô tả input video reference trực tiếp. Vì vậy web **không upload file video gốc**. Trình duyệt lấy 4 frame đại diện từ video, nén thành JPEG rồi upload các frame đó. GPT-5.4 và Grok Video 3 10s nhận các frame làm tham chiếu hình ảnh.

Cách này cũng tránh giới hạn payload của Vercel Functions đối với file video lớn.

## 1. Chạy local

Yêu cầu Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`.

## 2. Biến môi trường

```env
SHOPAIKEY_API_KEY=sk-your-shopaikey-key
SHOPAIKEY_BASE_URL=https://api.shopaikey.com
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
APP_USER=admin
APP_PASSWORD=a-very-long-password
```

### SHOPAIKEY_API_KEY

Tạo key tại ShopAIKey. Key chỉ tồn tại ở server. Không dùng prefix `NEXT_PUBLIC_`.

App gọi:

```text
POST /v1/chat/completions        model: gpt-5.4
POST /v1/video/generations       model: grok-video-3
GET  /v1/video/generations/:id
POST /v1/images/generations      model: gpt-image-2-all
POST /v1/images/edits            model: gpt-image-2-all (khi có ảnh tham chiếu)
```

Nếu muốn dùng Direct endpoint, có thể đặt:

```env
SHOPAIKEY_BASE_URL=https://direct.shopaikey.com
```

### DATABASE_URL

Cách dễ nhất trên Vercel:

1. Mở project Vercel.
2. Marketplace/Storage → tạo Neon Postgres.
3. Kết nối database với project.
4. Đảm bảo biến `DATABASE_URL` có trong Production/Preview/Development.

Không cần chạy migration thủ công. `lib/db.ts` dùng `CREATE TABLE IF NOT EXISTS` ở request đầu tiên.

### BLOB_READ_WRITE_TOKEN

1. Vercel project → Storage → Blob.
2. Tạo Blob store và attach vào project.
3. Vercel sẽ thêm `BLOB_READ_WRITE_TOKEN`.

App chỉ upload **ảnh đã nén hoặc frame JPEG**, giới hạn server là 4 MB/file.

### APP_USER / APP_PASSWORD

Khuyến nghị bật khi deploy. Nếu cả hai biến tồn tại, middleware bật HTTP Basic Auth cho toàn bộ site và API routes.

Nếu không đặt hai biến này, URL Vercel sẽ không có login và bất kỳ ai truy cập được URL có thể gọi API làm tiêu credit.

## 3. Push lên GitHub

```bash
git init
git add .
git commit -m "Initial Video Prompt Studio"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/video-prompt-studio.git
git push -u origin main
```

## 4. Deploy Vercel

1. Vercel → Add New Project.
2. Import repository GitHub.
3. Framework Preset: Next.js.
4. Add/confirm các environment variables ở trên.
5. Attach Neon + Blob.
6. Deploy.

Sau khi thay đổi env var, redeploy project.

## Luồng API nội bộ

```text
Browser
  │
  ├─ POST /api/upload
  │     └─ Vercel Blob (public reference images)
  │
  ├─ POST /api/prompts
  │     ├─ ShopAIKey /v1/chat/completions (gpt-5.4)
  │     └─ Neon: status=PROMPTS_READY
  │
  ├─ POST /api/video/generate
  │     ├─ ShopAIKey /v1/video/generations (grok-video-3)
  │     └─ Neon: task_id + queued
  │
  └─ GET /api/video/status/:taskId every 7s
        ├─ ShopAIKey status
        └─ Neon: processing / SUCCESS / FAILURE
```

## Lưu ý vận hành

- `metadata.images` dùng URL public. Không upload tài liệu nhạy cảm nếu bạn không muốn chúng nằm trên public Blob URL.
- `/history` chỉ hiển thị các tác vụ đã chọn prompt và gửi tạo video; 3 prompt gợi ý không còn hiển thị trong lịch sử. URL video kết quả do ShopAIKey trả về được lưu cùng bản ghi để phát lại trong lịch sử; app chưa sao chép toàn bộ video về Blob.
- Tỉ lệ mặc định là `16:9`; UI cũng có `9:16`, `1:1`, `3:2`, `2:3`. Nếu upstream giới hạn một tỉ lệ cụ thể, lỗi API sẽ được hiển thị nguyên nhân trên web.
- Polling mặc định mỗi 7 giây, phù hợp hướng dẫn 5–10 giây của ShopAIKey.
- Thời lượng video mặc định là **10 giây**. Backend gửi `duration` ở cả top-level request và `metadata.duration` để tương thích với hai dạng tài liệu ShopAIKey.
- Nên bật Vercel Spend Management/rate limit nếu mở ứng dụng cho nhiều người.

## Cấu trúc chính

```text
app/
  api/
    history/
    prompts/
    upload/
    video/generate/
    video/status/[taskId]/
  history/
components/
  Studio.tsx
  HistoryClient.tsx
  Nav.tsx
lib/
  db.ts
  media-client.ts
  shopaikey.ts
middleware.ts
```

## Nâng cấp đề xuất

- Đăng nhập nhiều người + lịch sử theo `user_id`.
- Rate limiting theo user/IP.
- Lưu bản copy video hoàn thành về object storage để archive dài hạn.
- Webhook/background worker để cập nhật trạng thái dù người dùng đóng trang.
- Nút regenerate prompt / duplicate project / favorite prompt.


### Long video prompt handling

At Step 3, the app shows the exact prompt length before video generation. The approved Vietnamese prompt is sent directly to Grok Video 3 without a GPT rewrite at Step 4. Both the browser and server block submission when the prompt exceeds the 4096-character/API safety limit (including a UTF-8 byte safety check).
