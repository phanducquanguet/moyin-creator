# Khắc Phục Việt Hoá Toàn Diện Spec

## Why
Hiện có lỗi Việt hoá rải rác gây chuỗi sai nghĩa, thiếu dấu, hoặc hiển thị key thô trong UI. Cần xử lý triệt để để đảm bảo trải nghiệm người dùng nhất quán và giảm lỗi tái phát khi thêm tính năng mới.

## What Changes
- Chuẩn hoá toàn bộ nguồn chuỗi tiếng Việt theo một cấu trúc i18n thống nhất.
- Sửa các lỗi hiển thị tiếng Việt sai mã hoá, sai placeholder, sai ngữ cảnh và không nhất quán thuật ngữ.
- Bổ sung cơ chế fallback an toàn khi thiếu bản dịch để không lộ key nội bộ ra UI.
- Thiết lập tiêu chí kiểm tra tự động cho chuỗi i18n để ngăn lỗi tái phát.

## Impact
- Affected specs: i18n, hiển thị văn bản UI, thông báo lỗi, thông báo trạng thái.
- Affected code: nguồn locale, tầng render UI, helper i18n, luồng validate dữ liệu bản dịch.

## ADDED Requirements
### Requirement: Chuẩn hoá nguồn chuỗi tiếng Việt
Hệ thống SHALL lưu trữ và truy xuất chuỗi tiếng Việt theo cấu trúc key nhất quán, có quy ước đặt tên và phân nhóm theo module.

#### Scenario: Success case
- **WHEN** người dùng mở một màn hình bất kỳ đã được Việt hoá
- **THEN** toàn bộ nhãn, nút, thông báo và placeholder hiển thị đúng tiếng Việt theo chuẩn thuật ngữ

### Requirement: Fallback an toàn cho bản dịch thiếu
Hệ thống SHALL sử dụng fallback thân thiện với người dùng khi thiếu bản dịch, thay vì hiển thị key kỹ thuật.

#### Scenario: Success case
- **WHEN** một key tiếng Việt chưa tồn tại hoặc bị lỗi tải locale
- **THEN** UI hiển thị chuỗi fallback có nghĩa và ghi nhận cảnh báo để theo dõi

### Requirement: Kiểm tra chất lượng bản dịch
Hệ thống SHALL có bước kiểm tra tự động để phát hiện key thiếu, key dư, placeholder không khớp và chuỗi trống.

#### Scenario: Success case
- **WHEN** chạy quy trình kiểm tra trước merge/phát hành
- **THEN** quy trình báo lỗi rõ ràng nếu có bất kỳ vi phạm chất lượng bản dịch

## MODIFIED Requirements
### Requirement: Hiển thị văn bản giao diện
Hệ thống SHALL ưu tiên sử dụng chuỗi từ lớp i18n cho mọi văn bản hiển thị, không hardcode tiếng Việt trực tiếp trong component, trừ nội dung kỹ thuật nội bộ không hiện cho người dùng.

## REMOVED Requirements
### Requirement: Chấp nhận hiển thị key kỹ thuật khi thiếu bản dịch
**Reason**: Gây trải nghiệm kém, khó hiểu với người dùng cuối và che giấu vấn đề chất lượng i18n.
**Migration**: Thay bằng fallback thân thiện và cảnh báo có thể theo dõi trong quá trình kiểm thử/phát hành.
