# Audit Việt hoá - Task 1

## Phạm vi rà soát
- Khu vực `src/components/panels/freedom/*` (Image/Video/Cinema/History/Tabs).
- Kiểm tra chuỗi hiển thị trực tiếp trên UI, toast và placeholder.

## Màn hình/luồng có lỗi
- `FreedomView`: nhãn tab bị lẫn chuỗi Trung-Việt.
- `ImageStudio`: nhãn, placeholder, trạng thái loading, toast thành công/thất bại bị lỗi mã hoá và sai ngữ cảnh.
- `CinemaStudio`: nhãn thiết lập máy quay, mô tả trung tâm, toast và prompt preview bị lỗi Việt hoá.
- `VideoStudio`: lỗi nặng nhất; thông báo validation upload, toast, nhãn, placeholder bị trộn nhiều ngôn ngữ và sai dấu.
- `GenerationHistory`: chuỗi trống/lịch sử, tiêu đề, hành động xóa và định dạng thời gian dùng locale không phù hợp (`zh-CN`).

## Nhóm lỗi theo loại và mức độ
- **P0 - Trải nghiệm nghiêm trọng**
  - Chuỗi lai Trung-Việt làm sai nghĩa và khó sử dụng.
  - Toast lỗi/thành công khó hiểu trong luồng tạo nội dung.
- **P1 - Chất lượng i18n**
  - Hardcode trực tiếp trong component, chưa theo key chuẩn.
  - Thiếu fallback thân thiện khi key không tồn tại.
- **P2 - Nhất quán locale/format**
  - Format thời gian dùng locale không đúng ngữ cảnh tiếng Việt.
  - Thuật ngữ chưa đồng bộ giữa các studio.

## Quyết định ưu tiên sửa
- Ưu tiên xử lý toàn bộ chuỗi hiển thị trực tiếp ở module `freedom`.
- Chuẩn hoá key theo namespace `freedom.*` + `common.*`.
- Bổ sung kiểm tra tự động key thiếu/dư, placeholder mismatch, chuỗi rỗng.
