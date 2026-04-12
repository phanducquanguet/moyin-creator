# Vietnamese Localization Design

**Date:** 2026-04-12
**Status:** Approved

## Summary

Việt hoá toàn bộ app Moyin Creator bằng cách thay trực tiếp các chuỗi tiếng Trung và comment tiếng Trung trong source code bằng tiếng Việt. Không thêm thư viện i18n, không thay đổi logic hay cấu trúc file.

## Scope

- ~81 file `.tsx`/`.ts` chứa chuỗi tiếng Trung
- ~655+ toast messages, dialog titles, button labels, placeholder text
- Comment tiếng Trung trong code
- `electron/main.ts` (Electron main process strings)
- **Không bao gồm:** tên biến, function name, prop name, API keys, URLs

## Approach

### Thay trực tiếp trong code (không dùng i18n library)

Tìm và thay từng chuỗi tiếng Trung bằng tiếng Việt ngay trong file TSX/TS. Không thêm dependency mới.

### Chạy song song theo 6 nhóm

| Nhóm | Nội dung |
|------|----------|
| 1 | `src/App.tsx`, `src/components/Dashboard.tsx`, `src/components/Layout.tsx`, `src/components/ProjectHeader.tsx`, và các component chính |
| 2 | `src/components/panels/script/` — toàn bộ panel kịch bản |
| 3 | `src/components/panels/director/` — toàn bộ panel đạo diễn |
| 4 | `src/components/panels/sclass/`, `src/components/panels/scenes/` |
| 5 | `src/components/panels/characters/`, `src/components/panels/media/`, `src/components/panels/export/`, `src/components/panels/assets/`, `src/components/panels/freedom/`, `src/components/panels/overview/` |
| 6 | `src/components/SettingsPanel.tsx`, `src/stores/`, `src/lib/`, `src/hooks/`, `electron/main.ts`, các file còn lại |

## Translation Principles

1. **Chỉ dịch string literal và comment** — giữ nguyên tên biến, function, prop, key
2. **Thuật ngữ kỹ thuật giữ nguyên tiếng Anh** — API, URL, model name, format name
3. **Tone thân thiện, ngắn gọn** — phù hợp app sáng tạo nội dung
4. **Nhất quán terminology** — dùng thuật ngữ nhất quán xuyên suốt app:
   - 项目 → Dự án
   - 场景 → Cảnh
   - 剧本 → Kịch bản
   - 角色 → Nhân vật
   - 导出 → Xuất
   - 设置 → Cài đặt
   - 删除 → Xoá
   - 确认 → Xác nhận
   - 取消 → Huỷ
   - 保存 → Lưu
   - 生成 → Tạo
   - 上传 → Tải lên
   - 下载 → Tải xuống
   - 导入 → Nhập

## Success Criteria

- Toàn bộ UI hiển thị bằng tiếng Việt
- Không còn chuỗi tiếng Trung trong UI
- App hoạt động bình thường sau khi dịch
- TypeScript compile không có lỗi mới
