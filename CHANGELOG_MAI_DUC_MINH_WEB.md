# Thay đổi theo yêu cầu - Mai Đức Minh'web

## 1. Branding hiển thị trên web

- Đổi tên giao diện thành **Mai Đức Minh'web AI Studio**.
- Các nhãn/trạng thái API hiển thị cho người dùng dùng tên **Mai Đức Minh'web API**.
- Giữ nguyên biến môi trường `SHOPAIKEY_API_KEY` và `SHOPAIKEY_BASE_URL` ở backend để không làm hỏng cấu hình Vercel hiện tại.

## 2. Luồng tạo video

- Bổ sung gợi ý **Giọng nói / thoại** ở Bước 1: ngôn ngữ, vùng miền, chất giọng, câu thoại, tốc độ, cảm xúc, độ rõ lời và lip-sync.
- GPT-5.4 được yêu cầu đưa thông tin voice/dialogue vào prompt khi người dùng có yêu cầu.
- Mọi prompt video được backend chèn ràng buộc nhận diện: nếu ảnh tham chiếu có người thì video phải giữ **đúng cùng một người**, khuôn mặt, tóc, màu da, dáng người, đặc điểm nhận diện, trang phục/phụ kiện (trừ khi người dùng chủ động yêu cầu thay đổi).
- Ràng buộc này được chèn lần nữa ở `/api/video/generate` trước khi gửi sang `grok-video-3-10s`, nên vẫn có hiệu lực kể cả khi người dùng sửa mô tả ở Bước 3.

## 3. Luồng tạo ảnh mới - 4 bước

1. Nhập mô tả + tối đa 4 ảnh tham chiếu.
2. GPT-5.4 tạo 3 phương án prompt ảnh.
3. Chọn và chỉnh mô tả tiếng Việt.
4. Tạo ảnh bằng `gpt-image-2-all`.

Backend dùng:

- `POST /v1/images/generations` khi không có ảnh tham chiếu.
- `POST /v1/images/edits` khi có ảnh tham chiếu.

Không gửi `n`, `size`, `quality`; tỉ lệ được đặt ở đầu prompt.

Ảnh kết quả được ưu tiên copy sang Vercel Blob để có URL ổn định hơn. Luồng này dùng lại `BLOB_READ_WRITE_TOKEN` hiện có, không cần thêm biến môi trường mới.

## 4. Chuyển ảnh sang tạo video

Sau khi ảnh tạo xong có nút **Dùng ảnh này làm ảnh minh họa tạo video**. Nút này:

- chuyển sang thẻ Tạo video;
- tự thêm ảnh kết quả vào danh sách ảnh tham chiếu ở Bước 1;
- xóa prompt/video downstream cũ nếu có để tránh prompt cũ không còn khớp ảnh mới.

## 2026-09-03 - Prompt limit, structured options, direct download
- Initial fix capped video prompts below the upstream 4096 limit. This behavior is superseded by the GPT-5.4 lossless prompt compiler described below; the current code no longer blindly truncates prompt text.
- Camera, character, environment, lighting, voice/dialogue and video-style helpers are now dropdown selections. Selections are combined with the user's description only when sending to the prompt API and no longer dump boilerplate into the textarea.
- History downloads now use a same-origin `/api/video/download?id=...` proxy with `Content-Disposition: attachment`, so the Download button saves the file instead of opening the remote video page.


## 2026-09-03 - GPT-5.4 lossless prompt compiler before video generation
- `/api/video/generate` no longer cuts long prompt text to fit the 4096 limit.
- Before calling `grok-video-3-10s`, the backend sends the full approved Vietnamese description plus the selected technical prompt to `gpt-5.4`.
- Pass 1 semantically compacts the request by merging repetition and using concise production terminology while preserving every unique visible/audible requirement.
- Pass 2 always audits the compiled candidate against both original source blocks, repairs omissions/ambiguity, and outputs the final compact prompt.
- The final prompt must pass both a character limit and UTF-8 byte limit. If GPT-5.4 reports missing details or still exceeds the safe limit, video generation stops instead of silently deleting content.
- Exact dialogue, proper nouns, numbers, visible text/logos, identity constraints, camera, action, lighting, materials, timing and negative constraints are explicitly marked as lossless requirements.
- Added optional server variable `PROMPT_OPTIMIZER_MODEL` (default `gpt-5.4`).
