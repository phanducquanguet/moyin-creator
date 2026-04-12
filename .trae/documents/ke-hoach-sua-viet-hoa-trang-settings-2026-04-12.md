# Kế hoạch sửa lỗi việt hoá trang Settings

## 1) Tóm tắt
- Mục tiêu: sửa triệt để lỗi việt hoá ở trang `Settings` bằng cách chuẩn hoá toàn bộ text hiển thị, loại bỏ chuỗi lỗi mã hoá/trộn ngôn ngữ, và chuyển sang cơ chế i18n thống nhất.
- Kết quả mong muốn:
  - Giao diện `Settings` hiển thị tiếng Việt rõ ràng, tự nhiên, không lỗi ký tự.
  - Có key i18n tương ứng cho `vi` và `en` để tránh tái phát lỗi hardcode.
  - Không thay đổi logic nghiệp vụ (API/store/luồng dữ liệu), chỉ thay đổi lớp hiển thị chuỗi và message.

## 2) Phân tích hiện trạng
- File chính chứa lỗi: `src/components/panels/SettingsPanel.tsx`.
- Hiện trạng kỹ thuật:
  - Rất nhiều text đang hardcode trực tiếp trong JSX/toast/confirm.
  - Nhiều chuỗi bị lỗi mã hoá và trộn ngôn ngữ (Việt/Trung/Anh) trong cùng câu.
  - Chưa dùng `t()` từ `src/lib/i18n.ts` trong `SettingsPanel`.
- Hạ tầng i18n hiện có:
  - `src/lib/i18n.ts` đã sẵn sàng với `t()`, fallback, và dictionary `vi/en`.
  - `src/locales/vi.json` và `src/locales/en.json` đang có key cho một số màn khác (freedom/characters/export), nhưng chưa có namespace cho `settings`.

## 3) Thay đổi đề xuất (theo file)

### A. `src/components/panels/SettingsPanel.tsx`
- Việc cần làm:
  - Import `t` từ `@/lib/i18n`.
  - Thay toàn bộ text hiển thị người dùng bằng `t("settings....")`:
    - Tiêu đề/tên tab/nhãn form/button/tooltip/empty-state.
    - Nội dung cảnh báo/hướng dẫn.
    - `toast.success` / `toast.error`.
    - `confirm(...)`.
    - Các nhãn trạng thái (`configured`, `no config`, ...).
  - Chuẩn hoá nội dung câu tiếng Việt tự nhiên, nhất quán thuật ngữ.
- Giữ nguyên:
  - Biến trạng thái, event handler, API call, cấu trúc component, logic side effect.
- Lý do:
  - Cắt nguồn gốc lỗi hardcode bị hỏng mã hoá.
  - Đồng bộ cách làm với các panel đã dùng i18n.

### B. `src/locales/vi.json`
- Việc cần làm:
  - Thêm namespace `settings.*` cho toàn bộ chuỗi dùng tại `SettingsPanel`.
  - Viết lại nội dung tiếng Việt chuẩn, dễ hiểu, thống nhất thuật ngữ:
    - `Cài đặt`, `Nhà cung cấp API`, `Đã cấu hình`, `Chưa cấu hình`, `Kiểm tra kết nối`, `Làm mới`, `Lưu trữ`, `Bộ nhớ đệm`, ...
  - Bổ sung key có biến động tham số (vd `{count}`, `{name}`, `{version}`) đúng cú pháp hiện tại.
- Lưu ý:
  - Không phá vỡ các key cũ đang dùng bởi màn khác.

### C. `src/locales/en.json`
- Việc cần làm:
  - Thêm đầy đủ cặp key `settings.*` tương ứng với `vi.json`.
  - Nội dung tiếng Anh rõ nghĩa để fallback/đổi locale hoạt động đúng.
- Lưu ý:
  - Bảo đảm parity key 1-1 giữa `vi` và `en` cho namespace `settings.*`.

### D. (Tuỳ mức độ phát hiện) `scripts/check-i18n.mjs`
- Chỉ xem xét cập nhật nếu script hiện tại có kiểm tra namespace/key parity và cần mở rộng rule cho key mới.
- Nếu script đã generic thì không sửa file này.

## 4) Giả định và quyết định đã chốt
- Quyết định phạm vi: sửa triệt để tại trang `Settings` (theo xác nhận của bạn).
- Không refactor UI layout hay business logic.
- Không mở rộng i18n cho các màn ngoài `Settings` trong đợt này.
- Không thay đổi cơ chế chọn locale toàn cục; chỉ đảm bảo nội dung của `Settings` tương thích cơ chế hiện hữu.

## 5) Kế hoạch triển khai chi tiết
1. Lập danh sách toàn bộ chuỗi user-facing trong `SettingsPanel` theo nhóm:
   - Header/tab.
   - API manager.
   - Advanced options.
   - Image host.
   - Storage/cache/update.
   - Dialog/confirm/toast.
2. Thiết kế bộ key i18n `settings.*` theo cấu trúc phân nhóm ổn định.
3. Thêm key tiếng Việt vào `vi.json`.
4. Thêm key tiếng Anh tương ứng vào `en.json`.
5. Thay text hardcode trong `SettingsPanel.tsx` bằng `t()` + truyền params khi cần.
6. Rà soát lần cuối để không còn chuỗi hardcode lỗi mã hoá trong file.

## 6) Xác minh sau khi triển khai
- Kiểm tra tĩnh:
  - Chạy kiểm tra type/lint để chắc không sai key tham số, không lỗi cú pháp.
  - Chạy script i18n parity (nếu có) để bảo đảm đủ key `vi/en`.
- Kiểm tra giao diện thủ công:
  - Mở trang `Settings` và đi qua đủ 4 tab con (`api`, `advanced`, `imagehost`, `storage`).
  - Xác nhận không còn ký tự lỗi/trộn ngôn ngữ ở tiêu đề, mô tả, button, toast.
  - Thử các hành động sinh toast chính: test kết nối, clear cache, check update, import/link data (ít nhất đường lỗi/thành công cơ bản).
- Tiêu chí chấp nhận:
  - Không còn text lỗi mã hoá trên trang `Settings`.
  - Tất cả text trong `SettingsPanel` đi qua `t()`.
  - `vi.json` và `en.json` có đầy đủ key `settings.*` tương ứng.
