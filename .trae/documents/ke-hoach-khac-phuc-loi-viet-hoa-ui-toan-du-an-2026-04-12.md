# Kế hoạch khắc phục lỗi Việt hoá UI toàn dự án

## Tóm tắt
- Mục tiêu: sửa triệt để lỗi tiếng Việt ở **toàn bộ text hiển thị cho người dùng** (UI/toast/dialog/placeholder/label), loại bỏ chuỗi lỗi mã hoá, trộn ngôn ngữ và chuỗi escape hiển thị thô.
- Chuẩn đầu ra: **Việt hoá hoàn toàn**, không lộ text Trung/Anh sai ngữ cảnh trong giao diện người dùng.
- Mức hoàn tất: xử lý dứt điểm trong phạm vi đã chọn + thêm kiểm tra tự động để chặn tái phát.
- Ngoài phạm vi: comment nội bộ, log debug, tên model/API endpoint kỹ thuật không hiển thị trực tiếp cho người dùng.

## Phân tích hiện trạng
- Hệ i18n đã có sẵn: `src/lib/i18n.ts`, locale chính `src/locales/vi.json` và `src/locales/en.json`, script kiểm tra `scripts/check-i18n.mjs`.
- Lỗi hiện tại không nằm ở loader i18n, mà nằm ở **nội dung string trong component/hook**:
  - Có nhiều chuỗi `\uXXXX` và chuỗi trộn Việt/Trung/Anh bị hỏng trong text hiển thị.
  - Có nhiều `toast/placeholder/label` hardcode không đi qua key i18n.
- Khảo sát cho thấy phạm vi lớn, tập trung nặng ở các module:
  - `src/components/panels/director/*` (đặc biệt: `split-scenes.tsx`, `split-scene-card.tsx`, `use-video-generation.ts`, `storyboard-preview.tsx`).
  - `src/components/panels/script/*`, `src/components/panels/scenes/*`, `src/components/panels/sclass/*`.
  - `src/components/panels/characters/*`, `src/components/panels/media/*`, `src/components/panels/freedom/*`.
  - Một số file nền: `src/components/UpdateDialog.tsx`, `src/components/PreviewPanel.tsx`, `src/components/panels/SettingsPanel.tsx`.
- Dấu hiệu quy mô:
  - Regex `\u[0-9a-fA-F]{4}` xuất hiện dày đặc trong nhóm panel chính.
  - Nhiều file có mẫu lỗi trộn ngôn ngữ kiểu “Đã rồi…”, “trongcủa…”, “mộtxe kéo…”.

## Thay đổi đề xuất (theo file và nhóm file)

### 1) Chuẩn hoá i18n dictionary
- File:
  - `src/locales/vi.json`
  - `src/locales/en.json`
- Việc làm:
  - Bổ sung/chuẩn hoá namespace theo module:
    - `director.*`, `script.*`, `scenes.*`, `sclass.*`, `characters.*`, `media.*`, `freedom.*`, `update.*`, mở rộng `common.*` nếu cần.
  - Thiết kế key theo ngữ cảnh UI (button/title/toast/confirm/empty/tooltip/placeholder) để không trùng nghĩa.
  - Bảo toàn placeholder (`{count}`, `{name}`, `{status}`, ...) đồng bộ 1-1 giữa `vi` và `en`.
- Lý do:
  - Tập trung toàn bộ text user-facing vào dictionary để kiểm soát chất lượng và tránh lặp lỗi hardcode.

### 2) Sửa triệt để module Director (ưu tiên 1)
- File chính:
  - `src/components/panels/director/split-scenes.tsx`
  - `src/components/panels/director/split-scene-card.tsx`
  - `src/components/panels/director/storyboard-preview.tsx`
  - `src/components/panels/director/use-video-generation.ts`
  - `src/components/panels/director/use-image-generation.ts`
  - `src/components/panels/director/use-angle-switch.ts`
  - Cùng nhóm: `index.tsx`, `shot-*`, `scene-*`, `context-panel.tsx`, `screenplay-input.tsx`, `emotion-tags.tsx`, `sound-effect-tags.tsx`
- Việc làm:
  - Thay toàn bộ text user-facing bằng `t("...")`.
  - Sửa dứt điểm chuỗi hỏng mã hoá/trộn ngôn ngữ trong toast, confirm, placeholder, label, tab title, empty-state.
  - Giữ nguyên logic gọi API, routing model, retry/poll, chỉ đổi lớp hiển thị.
- Lý do:
  - Đây là vùng phát sinh lỗi nhiều nhất và ảnh hưởng trực tiếp trải nghiệm chính.

### 3) Sửa module Script + Scenes + SClass (ưu tiên 2)
- File nhóm:
  - `src/components/panels/script/*`
  - `src/components/panels/scenes/*`
  - `src/components/panels/sclass/*`
- Việc làm:
  - Chuẩn hoá text hiển thị và đồng bộ thuật ngữ dùng chung.
  - Xử lý toàn bộ chuỗi hardcode lỗi trong các panel, modal, prompt editor, danh sách shot/cảnh.
- Lý do:
  - Đây là chuỗi màn hình liên thông với Director, nếu không sửa đồng bộ sẽ còn text lỗi xen kẽ.

### 4) Sửa module Characters + Media + Freedom + shared components (ưu tiên 3)
- File nhóm:
  - `src/components/panels/characters/*`
  - `src/components/panels/media/*`
  - `src/components/panels/freedom/*` (bao gồm `CameraControls.tsx`)
  - `src/components/UpdateDialog.tsx`
  - `src/components/PreviewPanel.tsx`
  - `src/components/panels/SettingsPanel.tsx` (rà soát lại text còn sót)
- Việc làm:
  - Hoàn tất xử lý các text còn sót để đạt trạng thái “không còn điểm lỗi nhìn thấy”.

### 5) Bổ sung hàng rào chống tái phát
- File:
  - `scripts/check-i18n.mjs` (mở rộng)
  - Thêm mới: `scripts/check-garbled-ui-text.mjs`
  - `package.json` (thêm script npm gọi checker mới)
- Việc làm:
  - Giữ checker hiện tại cho parity key + placeholder.
  - Thêm checker mới để fail build khi phát hiện trong `src/components/**`:
    - chuỗi user-facing chứa mẫu `\uXXXX` đáng ngờ,
    - chuỗi trộn ngôn ngữ lỗi (mẫu đã biết),
    - toast/confirm/dialog text hardcode không đi qua i18n (theo rule heuristic có whitelist).
- Lý do:
  - Không chỉ sửa một lần; cần chặn tái phát ở commit sau.

## Quyết định và giả định đã chốt
- Chỉ xử lý **text user-facing**; không dọn comment/log nội bộ nếu không ảnh hưởng UI.
- Chuẩn đích là tiếng Việt đầy đủ, tự nhiên, thống nhất thuật ngữ.
- `en.json` vẫn được duy trì parity để không phá fallback/chuyển locale.
- Không thay đổi logic nghiệp vụ, API contract, hay schema store.

## Trình tự triển khai chi tiết
1. Tạo danh sách key i18n mới theo module, khoá nghĩa trùng để tránh key rác.
2. Cập nhật `vi.json` và `en.json` trước (đảm bảo đủ key cho từng màn).
3. Refactor module Director toàn bộ.
4. Refactor module Script/Scenes/SClass.
5. Refactor module Characters/Media/Freedom và shared components còn sót.
6. Chạy checker i18n, checker garbled text, lint/typecheck.
7. Quét lại bằng grep theo mẫu lỗi để xác nhận không còn text lỗi trong UI scope.

## Bước xác minh
- Kiểm tra tự động:
  - Chạy `node scripts/check-i18n.mjs`.
  - Chạy checker mới chống garbled UI text.
  - Chạy lint/typecheck trên mã đã sửa.
- Kiểm tra hồi quy bằng grep:
  - Không còn chuỗi user-facing theo mẫu lỗi (`\uXXXX` đáng ngờ, cụm trộn ngôn ngữ đã biết) trong `src/components/**` thuộc phạm vi UI.
- Kiểm tra thủ công UI:
  - Đi qua các panel chính: Director, Script, Scenes, SClass, Characters, Media, Freedom, Settings, Update dialog.
  - Xác nhận toàn bộ title/button/toast/dialog/placeholder hiển thị tiếng Việt chuẩn.

## Tiêu chí nghiệm thu
- Không còn text lỗi Việt hoá hiển thị cho người dùng trong các module thuộc phạm vi.
- Không còn toast/dialog/placeholder user-facing bị hardcode lỗi hoặc trộn ngôn ngữ.
- Locale `vi/en` đồng bộ key và placeholder cho các key mới.
- Checker tự động phát hiện và chặn được lỗi garbled text trước khi merge.
