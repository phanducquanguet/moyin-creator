# Kế hoạch khắc phục lỗi tiếng Việt trang thiết lập kịch bản (mở rộng UI chính)

## Summary
- Mục tiêu: sửa lỗi tiếng Việt/garbled text ở trang thiết lập kịch bản và các màn UI chính liên quan, đồng thời chuẩn hoá i18n đầy đủ.
- Tiêu chí hoàn tất đã chốt:
  - Không còn garbled text ở UI chính.
  - Chuỗi user-facing đi qua `t()` theo i18n.
  - Kiểm chứng bằng `check-i18n`, `check-garbled-ui-text`, và `lint`.
- Cách làm đã chốt: chuẩn hoá i18n đầy đủ (không sửa kiểu hardcode tạm).

## Current State Analysis
- Hạ tầng i18n có sẵn tại `src/lib/i18n.ts`, locale tại `src/locales/vi.json` và `src/locales/en.json`.
- `settings.*` đã được i18n đầy đủ, nhưng nhóm `script.*` hiện chưa có key trong locale.
- Khu vực script có lỗi nặng:
  - `src/components/panels/script/index.tsx`
  - `src/components/panels/script/script-input.tsx`
  - `src/components/panels/script/episode-tree.tsx`
  - `src/components/panels/script/property-panel.tsx`
  - `src/components/panels/script/shot-list.tsx`
  - `src/components/panels/script/shot-breakdown.tsx`
  - `src/components/panels/script/export-panel.tsx`
- UI chính ngoài script vẫn còn chuỗi trộn ngôn ngữ/garbled ở nhiều nơi, đặc biệt:
  - `src/stores/media-panel-store.ts` (label điều hướng đang hiển thị trực tiếp cho người dùng)
  - `src/components/Layout.tsx` (comment/chuỗi lẫn ngôn ngữ trong vùng liên quan hiển thị tab)
  - `src/components/panels/director/*` (rất nhiều chuỗi user-facing)
- Script chống tái phát đã tồn tại:
  - `scripts/check-i18n.mjs` (parity key/placeholder)
  - `scripts/check-garbled-ui-text.mjs` (detect pattern UI lỗi trong `src/components`)

## Proposed Changes

### 1) Chuẩn hoá dictionary cho Script và điều hướng chính
- Files:
  - `src/locales/vi.json`
  - `src/locales/en.json`
- What:
  - Thêm namespace mới có cấu trúc rõ ràng:
    - `script.header.*`, `script.input.*`, `script.tree.*`, `script.property.*`, `script.toast.*`, `script.dialog.*`, `script.progress.*`
    - `nav.*` cho label điều hướng chính (tối thiểu các label đang lỗi/trộn ngôn ngữ).
    - `director.common.*` cho các cụm lặp dùng ở màn director (button/toast/trạng thái) trong đợt UI chính.
- Why:
  - Tách nghĩa theo module giúp dễ kiểm soát chất lượng dịch và tránh hardcode quay lại.
- How:
  - Viết tiếng Việt chuẩn cho `vi`.
  - Viết bản tiếng Anh parity 1-1 cho `en`.
  - Giữ nguyên key cũ đang dùng để tránh regression.

### 2) Refactor toàn bộ Script panel sang i18n key
- Files:
  - `src/components/panels/script/index.tsx`
  - `src/components/panels/script/script-input.tsx`
  - `src/components/panels/script/episode-tree.tsx`
  - `src/components/panels/script/property-panel.tsx`
  - `src/components/panels/script/shot-list.tsx`
  - `src/components/panels/script/shot-breakdown.tsx`
  - `src/components/panels/script/export-panel.tsx`
- What:
  - Import `t` và thay toàn bộ chuỗi user-facing (title, label, placeholder, tooltip, trạng thái, toast, dialog confirm).
  - Loại bỏ chuỗi trộn Việt/Trung/escape khỏi UI.
  - Chuẩn hoá format tham số động (`{count}`, `{episodeIndex}`, `{message}`...) trong key i18n.
- Why:
  - Đây là vùng lỗi chính đúng theo issue “trang thiết lập kịch bản”.
- How:
  - Chia theo block chức năng (header/input/tree/property/toast) để thay có kiểm soát.
  - Không đổi business logic, chỉ đổi lớp hiển thị text.

### 3) Sửa điều hướng và text UI chính hiển thị trực tiếp
- Files:
  - `src/stores/media-panel-store.ts`
  - `src/components/TabBar.tsx`
- What:
  - Chuẩn hoá label điều hướng đang hiển thị bất nhất (ví dụ `giám đốc`, `lớp S`, `sự tự do`, `tài sản`...) theo bộ từ vựng thống nhất.
  - Chuyển phần text hiển thị trực tiếp sang lấy từ i18n key (nếu phù hợp kiến trúc hiện tại), hoặc tối thiểu chuẩn hoá literal sạch trong đợt này.
- Why:
  - Điều hướng là phần UI chính, user nhìn thấy liên tục.
- How:
  - Ưu tiên giữ cấu trúc store hiện tại; chỉ chỉnh nhãn hiển thị và mapping key.

### 4) Sửa nhanh các điểm garbled ưu tiên cao ở Director (UI chính)
- Files (ưu tiên):
  - `src/components/panels/director/index.tsx`
  - `src/components/panels/director/screenplay-input.tsx`
  - `src/components/panels/director/shot-list-panel.tsx`
  - `src/components/panels/director/shot-properties-panel.tsx`
  - `src/components/panels/director/split-scenes.tsx`
  - `src/components/panels/director/split-scene-card.tsx`
- What:
  - Dọn text user-facing đang lỗi/trộn ngôn ngữ ở các panel director chính.
  - Dùng cùng chuẩn key i18n đã mở rộng (mục 1) cho cụm dùng chung.
- Why:
  - Đây là phần UI chính liền mạch sau bước kịch bản, tác động trực tiếp trải nghiệm.
- How:
  - Chỉ xử lý text hiển thị và toast/dialog; không động vào flow tạo ảnh/video.

### 5) Củng cố script kiểm tra chống tái phát (nếu cần)
- Files:
  - `scripts/check-garbled-ui-text.mjs` (xem xét cập nhật pattern/allowlist)
- What:
  - Rà lại pattern hiện có (`BROKEN_PATTERNS`, unicode escape allowlist) để giảm false negative cho lỗi trộn ngôn ngữ thực tế vừa xử lý.
- Why:
  - Đảm bảo lỗi tương tự bị chặn sớm ở lần commit sau.
- How:
  - Chỉ bổ sung rule tối thiểu, tránh quá gắt làm false positive hàng loạt.

## Assumptions & Decisions
- Phạm vi thực thi theo mức “UI chính”: Script + điều hướng + điểm ưu tiên cao của Director.
- Không xử lý comment nội bộ hoặc log debug không hiển thị cho người dùng.
- Không refactor kiến trúc i18n lớn (hook/provider mới); dùng hạ tầng `t()` hiện có.
- Không thay đổi nghiệp vụ, API contract, store schema.
- Nếu phát hiện chuỗi lỗi ở module ngoài phạm vi “UI chính”, ghi nhận backlog cho vòng sau, không mở rộng vô hạn trong cùng đợt.

## Verification Steps
1. Chạy `node ./scripts/check-i18n.mjs` để đảm bảo parity key/placeholder giữa `vi/en`.
2. Chạy `node ./scripts/check-garbled-ui-text.mjs` để đảm bảo không còn pattern UI lỗi trong `src/components`.
3. Chạy `npm run lint` và xử lý lỗi phát sinh trong các file đã chỉnh.
4. Kiểm tra thủ công luồng chính:
   - Vào tab `Kịch bản`: xác nhận header, input, tree, property, toast, dialog đều tiếng Việt chuẩn.
   - Chuyển tab điều hướng chính: nhãn hiển thị nhất quán.
   - Vào tab `Giám đốc` (màn chính): xác nhận các text trọng yếu không còn garbled.
5. Tiêu chí đạt:
   - Không còn chuỗi tiếng Việt lỗi mã hoá/trộn ngôn ngữ trên UI chính.
   - Các text mới dùng i18n key và có cặp `vi/en` tương ứng.
   - Bộ check tự động chạy xanh.
