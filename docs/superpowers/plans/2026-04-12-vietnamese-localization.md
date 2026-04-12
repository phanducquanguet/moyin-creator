# Vietnamese Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay toàn bộ chuỗi tiếng Trung và comment tiếng Trung trong 118 file `.tsx`/`.ts` bằng tiếng Việt tương đương.

**Architecture:** Thay trực tiếp string literal và comment trong từng file — không thêm thư viện i18n, không thay đổi logic, không đổi cấu trúc file. Các task được thiết kế để chạy song song theo nhóm file.

**Tech Stack:** React 18, Electron 30, TypeScript, Vite

---

## Nguyên tắc dịch (áp dụng cho TẤT CẢ các task)

1. **Chỉ dịch:** string literal trong JSX/TS, nội dung `toast.*()`, comment `//` và `/* */`
2. **KHÔNG dịch:** tên biến, function name, prop name, import path, type name, API key, URL, format string placeholder (`${...}`)
3. **Thuật ngữ nhất quán:**

| Tiếng Trung | Tiếng Việt |
|-------------|------------|
| 项目 | Dự án |
| 场景 | Cảnh |
| 剧本 | Kịch bản |
| 角色 | Nhân vật |
| 导出 | Xuất |
| 设置 | Cài đặt |
| 删除 | Xoá |
| 确认 | Xác nhận |
| 取消 | Huỷ |
| 保存 | Lưu |
| 生成 | Tạo |
| 上传 | Tải lên |
| 下载 | Tải xuống |
| 导入 | Nhập |
| 镜头 | Cảnh quay |
| 分镜 | Phân cảnh |
| 背景 | Nền |
| 提示词 | Prompt |
| 供应商 | Nhà cung cấp |
| 图床 | Lưu trữ ảnh |
| 白天 | Ban ngày |
| 夜晚 | Ban đêm |
| 黄昏 | Hoàng hôn |
| 黎明 | Bình minh |
| 正在... | Đang... |
| 加载中 | Đang tải |
| 错误 | Lỗi |
| 成功 | Thành công |
| 警告 | Cảnh báo |

4. **AI prompts trong lib/:** Dịch sang tiếng Việt (app hướng đến người dùng Việt Nam)
5. **Tone:** Thân thiện, ngắn gọn

---

## Task 1: Core Components (chạy song song với các task khác)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/SimpleTimeline.tsx`
- Modify: `src/components/TabBar.tsx`
- Modify: `src/components/WardrobeModal.tsx`
- Modify: `src/components/angle-switch/AngleController.tsx`
- Modify: `src/components/angle-switch/AngleSwitchResultDialog.tsx`
- Modify: `src/components/api-manager/AddProviderDialog.tsx`
- Modify: `src/components/api-manager/FeatureBindingPanel.tsx`
- Modify: `src/components/image-host-manager/AddImageHostDialog.tsx`
- Modify: `src/components/quad-grid/QuadGridResultDialog.tsx`
- Modify: `src/components/ui/chart.tsx`
- Modify: `src/components/ui/cinematography-profile-picker/index.tsx`
- Modify: `src/components/ui/color-picker.tsx`
- Modify: `src/components/ui/draggable-item.tsx`
- Modify: `src/components/ui/editable-timecode.tsx`
- Modify: `src/components/ui/font-picker.tsx`
- Modify: `src/components/ui/form.tsx`
- Modify: `src/components/ui/phone-input.tsx`
- Modify: `src/components/ui/progress.tsx`
- Modify: `src/components/ui/sidebar.tsx`
- Modify: `src/components/ui/sponsor-button.tsx`
- Modify: `src/components/ui/video-player.tsx`

- [ ] **Step 1: Đọc và dịch từng file**

Với mỗi file trong danh sách trên:
1. Đọc toàn bộ nội dung file
2. Tìm tất cả chuỗi tiếng Trung (string literal, comment)
3. Dịch sang tiếng Việt theo bảng thuật ngữ ở trên
4. Ghi lại file

- [ ] **Step 2: Kiểm tra không còn tiếng Trung**

```bash
grep -rn "[\u4e00-\u9fff]" src/App.tsx src/components/Dashboard.tsx src/components/SimpleTimeline.tsx src/components/TabBar.tsx src/components/WardrobeModal.tsx src/components/angle-switch/ src/components/api-manager/ src/components/image-host-manager/ src/components/quad-grid/ src/components/ui/chart.tsx src/components/ui/cinematography-profile-picker/ src/components/ui/color-picker.tsx src/components/ui/draggable-item.tsx src/components/ui/editable-timecode.tsx src/components/ui/font-picker.tsx src/components/ui/form.tsx src/components/ui/phone-input.tsx src/components/ui/progress.tsx src/components/ui/sidebar.tsx src/components/ui/sponsor-button.tsx src/components/ui/video-player.tsx
```

Kết quả mong đợi: không có output (không còn ký tự tiếng Trung)

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/Dashboard.tsx src/components/SimpleTimeline.tsx src/components/TabBar.tsx src/components/WardrobeModal.tsx src/components/angle-switch/ src/components/api-manager/ src/components/image-host-manager/ src/components/quad-grid/ src/components/ui/chart.tsx src/components/ui/cinematography-profile-picker/ src/components/ui/color-picker.tsx src/components/ui/draggable-item.tsx src/components/ui/editable-timecode.tsx src/components/ui/font-picker.tsx src/components/ui/form.tsx src/components/ui/phone-input.tsx src/components/ui/progress.tsx src/components/ui/sidebar.tsx src/components/ui/sponsor-button.tsx src/components/ui/video-player.tsx
git commit -m "i18n: Việt hoá core components và UI components"
```

---

## Task 2: SettingsPanel (chạy song song với các task khác)

**Files:**
- Modify: `src/components/SettingsPanel.tsx`

- [ ] **Step 1: Đọc và dịch SettingsPanel.tsx**

Đọc `src/components/SettingsPanel.tsx`, tìm toàn bộ chuỗi tiếng Trung và comment, dịch sang tiếng Việt. File này có khoảng 1,744 dòng — kiểm tra kỹ các section: API settings, import/export data, provider management.

- [ ] **Step 2: Kiểm tra**

```bash
grep -n "[\u4e00-\u9fff]" src/components/SettingsPanel.tsx
```

Kết quả mong đợi: không có output

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "i18n: Việt hoá SettingsPanel"
```

---

## Task 3: Script Panel (chạy song song với các task khác)

**Files:**
- Modify: `src/components/panels/script/index.tsx`
- Modify: `src/components/panels/script/episode-tree.tsx`
- Modify: `src/components/panels/script/export-panel.tsx`
- Modify: `src/components/panels/script/property-panel.tsx`
- Modify: `src/components/panels/script/script-input.tsx`
- Modify: `src/components/panels/script/shot-list.tsx`

- [ ] **Step 1: Đọc và dịch từng file trong script panel**

Với mỗi file, đọc nội dung, tìm chuỗi tiếng Trung (chú ý: file `index.tsx` có ~2,520 dòng), dịch sang tiếng Việt.

- [ ] **Step 2: Kiểm tra**

```bash
grep -rn "[\u4e00-\u9fff]" src/components/panels/script/
```

Kết quả mong đợi: không có output

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/script/
git commit -m "i18n: Việt hoá Script panel"
```

---

## Task 4: Director Panel (chạy song song với các task khác)

**Files:**
- Modify: `src/components/panels/director/index.tsx`
- Modify: `src/components/panels/director/api-settings.tsx`
- Modify: `src/components/panels/director/context-panel.tsx`
- Modify: `src/components/panels/director/duration-selector.tsx`
- Modify: `src/components/panels/director/generation-progress.tsx`
- Modify: `src/components/panels/director/scene-card.tsx`
- Modify: `src/components/panels/director/scene-library-selector.tsx`
- Modify: `src/components/panels/director/screenplay-input.tsx`
- Modify: `src/components/panels/director/shot-grid-view.tsx`
- Modify: `src/components/panels/director/shot-list-panel.tsx`
- Modify: `src/components/panels/director/shot-properties-panel.tsx`
- Modify: `src/components/panels/director/shot-size-selector.tsx`
- Modify: `src/components/panels/director/split-scene-card.tsx`
- Modify: `src/components/panels/director/split-scenes.tsx`
- Modify: `src/components/panels/director/storyboard-preview.tsx`
- Modify: `src/components/panels/director/use-angle-switch.ts`
- Modify: `src/components/panels/director/use-image-generation.ts`
- Modify: `src/components/panels/director/use-video-generation.ts`

- [ ] **Step 1: Đọc và dịch từng file trong director panel**

Chú ý: `split-scenes.tsx` có ~4,066 dòng — dịch kỹ từng section. Các file `use-*.ts` thường chứa toast messages và error strings.

- [ ] **Step 2: Kiểm tra**

```bash
grep -rn "[\u4e00-\u9fff]" src/components/panels/director/
```

Kết quả mong đợi: không có output

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/director/
git commit -m "i18n: Việt hoá Director panel"
```

---

## Task 5: SClass + Scenes Panels (chạy song song với các task khác)

**Files:**
- Modify: `src/components/panels/sclass/auto-grouping.ts`
- Modify: `src/components/panels/sclass/extend-edit-dialog.tsx`
- Modify: `src/components/panels/sclass/group-ref-manager.tsx`
- Modify: `src/components/panels/sclass/sclass-calibrator.ts`
- Modify: `src/components/panels/sclass/sclass-prompt-builder.ts`
- Modify: `src/components/panels/sclass/sclass-scene-card.tsx`
- Modify: `src/components/panels/sclass/sclass-scenes.tsx`
- Modify: `src/components/panels/sclass/shot-group.tsx`
- Modify: `src/components/panels/sclass/use-sclass-generation.ts`
- Modify: `src/components/panels/scenes/generation-panel.tsx`
- Modify: `src/components/panels/scenes/scene-detail.tsx`
- Modify: `src/components/panels/scenes/scene-gallery.tsx`

- [ ] **Step 1: Đọc và dịch từng file**

Chú ý: `sclass-scenes.tsx` có ~3,839 dòng, `scenes/generation-panel.tsx` có ~3,497 dòng. Dịch kỹ từng section.

- [ ] **Step 2: Kiểm tra**

```bash
grep -rn "[\u4e00-\u9fff]" src/components/panels/sclass/ src/components/panels/scenes/
```

Kết quả mong đợi: không có output

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/sclass/ src/components/panels/scenes/
git commit -m "i18n: Việt hoá SClass và Scenes panels"
```

---

## Task 6: Characters + Other Panels (chạy song song với các task khác)

**Files:**
- Modify: `src/components/panels/characters/character-card.tsx`
- Modify: `src/components/panels/characters/character-detail.tsx`
- Modify: `src/components/panels/characters/character-gallery.tsx`
- Modify: `src/components/panels/characters/character-generator.tsx`
- Modify: `src/components/panels/characters/generation-panel.tsx`
- Modify: `src/components/panels/characters/wardrobe-modal.tsx`
- Modify: `src/components/panels/media/index.tsx`
- Modify: `src/components/panels/export/index.tsx`
- Modify: `src/components/panels/assets/PropsLibrary.tsx`
- Modify: `src/components/panels/assets/StyleEditor.tsx`
- Modify: `src/components/panels/freedom/CameraControls.tsx`
- Modify: `src/components/panels/freedom/CinemaStudio.tsx`
- Modify: `src/components/panels/freedom/ImageStudio.tsx`
- Modify: `src/components/panels/freedom/SaveToPropsDialog.tsx`
- Modify: `src/components/panels/freedom/VideoStudio.tsx`
- Modify: `src/components/panels/overview/index.tsx`

- [ ] **Step 1: Đọc và dịch từng file**

Dịch tất cả string literal và comment tiếng Trung trong các panel nhân vật, media, xuất, tài sản, tự do sáng tạo, và tổng quan.

- [ ] **Step 2: Kiểm tra**

```bash
grep -rn "[\u4e00-\u9fff]" src/components/panels/characters/ src/components/panels/media/ src/components/panels/export/ src/components/panels/assets/ src/components/panels/freedom/ src/components/panels/overview/
```

Kết quả mong đợi: không có output

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/characters/ src/components/panels/media/ src/components/panels/export/ src/components/panels/assets/ src/components/panels/freedom/ src/components/panels/overview/
git commit -m "i18n: Việt hoá Characters, Media, Export, Assets, Freedom, Overview panels"
```

---

## Task 7: Stores (chạy song song với các task khác)

**Files:**
- Modify: `src/stores/api-config-store.ts`
- Modify: `src/stores/character-library-store.ts`
- Modify: `src/stores/custom-style-store.ts`
- Modify: `src/stores/director-store.ts`
- Modify: `src/stores/media-panel-store.ts`
- Modify: `src/stores/media-store.ts`
- Modify: `src/stores/project-store.ts`
- Modify: `src/stores/props-library-store.ts`
- Modify: `src/stores/scene-store.ts`
- Modify: `src/stores/script-store.ts`
- Modify: `src/stores/simple-timeline-store.ts`

- [ ] **Step 1: Đọc và dịch từng store**

Stores thường chứa default values (ví dụ: `{ name: "场景名称", location: "地点描述" }`) và comment giải thích logic. Dịch cả hai.

- [ ] **Step 2: Kiểm tra**

```bash
grep -rn "[\u4e00-\u9fff]" src/stores/
```

Kết quả mong đợi: không có output

- [ ] **Step 3: Commit**

```bash
git add src/stores/
git commit -m "i18n: Việt hoá stores"
```

---

## Task 8: lib/script/ (chạy song song với các task khác)

**Files:**
- Modify: `src/lib/script/ai-character-finder.ts`
- Modify: `src/lib/script/ai-scene-finder.ts`
- Modify: `src/lib/script/character-calibrator.ts`
- Modify: `src/lib/script/character-stage-analyzer.ts`
- Modify: `src/lib/script/episode-parser.ts`
- Modify: `src/lib/script/export-service.ts`
- Modify: `src/lib/script/full-script-service.ts`
- Modify: `src/lib/script/recalibrate-scenes.ts`
- Modify: `src/lib/script/scene-calibrator.ts`
- Modify: `src/lib/script/scene-viewpoint-generator.ts`
- Modify: `src/lib/script/script-normalizer.ts`
- Modify: `src/lib/script/script-parser.ts`
- Modify: `src/lib/script/series-meta-sync.ts`
- Modify: `src/lib/script/shot-calibration-stages.ts`
- Modify: `src/lib/script/shot-generator.ts`
- Modify: `src/lib/script/shot-utils.ts`
- Modify: `src/lib/script/trailer-service.ts`
- Modify: `src/lib/script/viewpoint-analyzer.ts`

**Chú ý quan trọng:** Nhiều file trong `lib/script/` chứa **AI system prompts** (ví dụ: `"你是一个专业的剧本分析师"`). Dịch các prompt này sang tiếng Việt vì app hướng đến người dùng Việt Nam và AI models sẽ phản hồi bằng tiếng Việt.

- [ ] **Step 1: Đọc và dịch từng file**

Dịch: error messages, comment, AI system prompts, default values tiếng Trung.

Ví dụ dịch AI prompt:
- `"你是一个专业的剧本分析师"` → `"Bạn là một chuyên gia phân tích kịch bản"`
- `"白天"` → `"Ban ngày"`, `"夜晚"` → `"Ban đêm"`, `"黄昏"` → `"Hoàng hôn"`, `"黎明"` → `"Bình minh"`

- [ ] **Step 2: Kiểm tra**

```bash
grep -rn "[\u4e00-\u9fff]" src/lib/script/
```

Kết quả mong đợi: không có output

- [ ] **Step 3: Commit**

```bash
git add src/lib/script/
git commit -m "i18n: Việt hoá lib/script/ bao gồm AI prompts"
```

---

## Task 9: Remaining lib/ + packages/ + workers/ + electron/ (chạy song song với các task khác)

**Files:**
- Modify: `src/lib/ai/batch-processor.ts`
- Modify: `src/lib/ai/feature-router.ts`
- Modify: `src/lib/ai/image-generator.ts`
- Modify: `src/lib/ai/model-registry.ts`
- Modify: `src/lib/ai/runninghub-angles.ts`
- Modify: `src/lib/ai/runninghub-client.ts`
- Modify: `src/lib/ai/style-extractor.ts`
- Modify: `src/lib/ai/worker-bridge.ts`
- Modify: `src/lib/character/character-prompt-service.ts`
- Modify: `src/lib/constants/cinematography-profiles.ts`
- Modify: `src/lib/cors-fetch.ts`
- Modify: `src/lib/freedom/camera-dictionary.ts`
- Modify: `src/lib/freedom/freedom-api.ts`
- Modify: `src/lib/generation/prompt-builder.ts`
- Modify: `src/lib/image-host.ts`
- Modify: `src/lib/image-storage.ts`
- Modify: `src/lib/indexed-db-storage.ts`
- Modify: `src/lib/media-processing.ts`
- Modify: `src/lib/project-storage.ts`
- Modify: `src/lib/project-switcher.ts`
- Modify: `src/lib/scene/viewpoint-matcher.ts`
- Modify: `src/lib/storage-migration.ts`
- Modify: `src/lib/storage/storage-service.ts`
- Modify: `src/lib/storyboard/grid-calculator.ts`
- Modify: `src/lib/storyboard/image-splitter.ts`
- Modify: `src/lib/storyboard/prompt-builder.ts`
- Modify: `src/lib/storyboard/scene-prompt-generator.ts`
- Modify: `src/lib/storyboard/storyboard-service.ts`
- Modify: `src/lib/time.ts`
- Modify: `src/lib/utils/image-persist.ts`
- Modify: `src/lib/utils/image-upload.ts`
- Modify: `src/lib/utils/rate-limiter.ts`
- Modify: `src/lib/utils/retry.ts`
- Modify: `src/lib/video-cache.ts`
- Modify: `src/app/api/ai/runninghub-test/route.ts`
- Modify: `src/app/api/proxy-image/route.ts`
- Modify: `src/packages/ai-core/api/task-poller.ts`
- Modify: `src/packages/ai-core/api/task-queue.ts`
- Modify: `src/packages/ai-core/services/character-bible.ts`
- Modify: `src/packages/ai-core/services/prompt-compiler.ts`
- Modify: `src/workers/ai-worker.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Đọc và dịch từng file**

Dịch error messages, comment, log messages, và default strings tiếng Trung. `electron/main.ts` có thể chứa menu labels và dialog strings của Electron.

- [ ] **Step 2: Kiểm tra**

```bash
grep -rn "[\u4e00-\u9fff]" src/lib/ai/ src/lib/character/ src/lib/constants/ src/lib/cors-fetch.ts src/lib/freedom/ src/lib/generation/ src/lib/image-host.ts src/lib/image-storage.ts src/lib/indexed-db-storage.ts src/lib/media-processing.ts src/lib/project-storage.ts src/lib/project-switcher.ts src/lib/scene/ src/lib/storage-migration.ts src/lib/storage/ src/lib/storyboard/ src/lib/time.ts src/lib/utils/ src/lib/video-cache.ts src/app/api/ src/packages/ai-core/ src/workers/ electron/
```

Kết quả mong đợi: không có output

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/ src/lib/character/ src/lib/constants/ src/lib/cors-fetch.ts src/lib/freedom/ src/lib/generation/ src/lib/image-host.ts src/lib/image-storage.ts src/lib/indexed-db-storage.ts src/lib/media-processing.ts src/lib/project-storage.ts src/lib/project-switcher.ts src/lib/scene/ src/lib/storage-migration.ts src/lib/storage/ src/lib/storyboard/ src/lib/time.ts src/lib/utils/ src/lib/video-cache.ts src/app/api/ src/packages/ai-core/ src/workers/ electron/
git commit -m "i18n: Việt hoá lib/, packages/, workers/, electron/"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Kiểm tra toàn bộ dự án không còn tiếng Trung trong code**

```bash
grep -rn --include="*.ts" --include="*.tsx" "[\u4e00-\u9fff]" src/ electron/
```

Kết quả mong đợi: không có output. Nếu còn sót, dịch những file đó và commit thêm.

- [ ] **Step 2: Build thử để đảm bảo không có lỗi TypeScript**

```bash
npm run typecheck
```

Hoặc nếu không có script typecheck:

```bash
npx tsc --noEmit
```

Kết quả mong đợi: 0 lỗi mới (so với trước khi dịch)

- [ ] **Step 3: Commit cuối nếu có sửa thêm**

```bash
git add -A
git commit -m "i18n: Hoàn thành Việt hoá toàn bộ app"
```
