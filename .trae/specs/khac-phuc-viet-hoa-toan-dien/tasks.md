# Tasks
- [x] Task 1: Khảo sát và khoanh vùng lỗi Việt hoá hiện tại trong toàn bộ sản phẩm.
  - [x] SubTask 1.1: Liệt kê màn hình/luồng có lỗi chuỗi tiếng Việt (sai dấu, sai ngữ cảnh, lộ key, placeholder lỗi)
  - [x] SubTask 1.2: Nhóm lỗi theo loại và mức độ ảnh hưởng để ưu tiên sửa
- [x] Task 2: Chuẩn hoá nguồn locale tiếng Việt và quy ước key.
  - [x] SubTask 2.1: Chuẩn hoá key theo module và ngữ cảnh sử dụng
  - [x] SubTask 2.2: Loại bỏ key trùng, key mồ côi và đồng bộ thuật ngữ
- [x] Task 3: Sửa lỗi hiển thị Việt hoá trên UI và thông báo hệ thống.
  - [x] SubTask 3.1: Thay chuỗi hardcode bằng truy xuất i18n tại các điểm còn thiếu
  - [x] SubTask 3.2: Sửa chuỗi sai chính tả, sai nghĩa, sai placeholder
  - [x] SubTask 3.3: Đảm bảo fallback thân thiện khi thiếu bản dịch
- [x] Task 4: Bổ sung kiểm tra chất lượng i18n để ngăn lỗi tái phát.
  - [x] SubTask 4.1: Thêm bước kiểm tra key thiếu/dư và placeholder không khớp
  - [x] SubTask 4.2: Đưa kiểm tra vào quy trình xác thực trước phát hành
- [x] Task 5: Xác minh end-to-end và chốt phạm vi xử lý triệt để.
  - [x] SubTask 5.1: Kiểm thử các luồng chính bằng giao diện tiếng Việt
  - [x] SubTask 5.2: Xác nhận không còn điểm lộ key kỹ thuật hoặc chuỗi sai ngữ cảnh
- [x] Task 6: Khắc phục các điểm Việt hoá còn sót sau vòng xác minh.
  - [x] SubTask 6.1: Chuẩn hoá chuỗi còn trộn ngôn ngữ tại các panel director/export
  - [x] SubTask 6.2: Thay chuỗi hardcode hiển thị người dùng bằng i18n key tương ứng
  - [x] SubTask 6.3: Chạy lại kiểm thử và đóng toàn bộ checkpoint checklist còn mở

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2
- Task 5 depends on Task 3
- Task 5 depends on Task 4
- Task 6 depends on Task 5
