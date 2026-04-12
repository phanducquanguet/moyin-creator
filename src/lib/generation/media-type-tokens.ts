// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Media-Type Tokens — \u6444\u5f71Tham số × Lò vừaại\u7ffb\u8bd1\u5c42
 *
 * cốt lõi\u804c\u8d23：\u6839\u636eTầm nhìn Phong cáchcủa mediaType，\u5c06\u7269\u7406\u6444\u5f71 promptToken \u7ffb\u8bd1cho
 * \u8be5\u5a92\u4ecb\u80fd\u9a7e\u9a6dcủaĐợi đã\u6548\u8868\u8fbe。
 *
 * \u7ffb\u8bd1Chiến lược：
 * - cinematic  → \u76f4\u901a，Giữ Tất cả\u7269\u7406\u6444\u5f71\u8bcd\u6c47
 * - animation  → \u865a\u62df\u6444\u50cf\u673a\u8bed\u4e49\u9002\u914d（Quỹ đạo→\u89c6\u5dee\u5e73\u79fb、độ sâu trường ảnh→\u5c42lần\u6a21\u7cca）
 * - stop-motion → \u5fae\u7f29Bắn thậtkhoảng\u675f（Quỹ đạo→\u5fae\u578bRay trượt、độ sâu trường ảnh→Vĩ môCảnh quay）
 * - graphic    → bỏ qua\u7269\u7406Tham số，đèn→Màu sắc/cảm xúc/Nhịp điệu Mô tả
 */

import type { MediaType } from '@/lib/constants/visual-styles';

// ==================== từ\u6bb5Loại ====================

export type CinematographyField =
  | 'cameraRig'
  | 'shotSize'
  | 'movementSpeed'
  | 'depthOfField'
  | 'focusTransition'
  | 'lightingStyle'
  | 'lightingDirection'
  | 'colorTemperature'
  | 'atmosphericEffect'
  | 'effectIntensity'
  | 'playbackSpeed'
  | 'cameraAngle'
  | 'focalLength'
  | 'photographyTechnique';

// ==================== \u7ffb\u8bd1\u8868 ====================

/**
 * \u6bcf\u79cd\u975e-cinematic \u5a92\u4ecbcủatừ\u6bb5\u7ea7\u7ffb\u8bd1\u8868。
 * - key = preset id
 * - value = thay thế\u540ecủa promptToken（\u7a7achuỗi = \u9759\u9ed8bỏ qua）
 *
 * \u4e0d\u5728\u8868trongcủa preset id → \u6cbfsử dụngnguyên bản token（\u517c\u5bb9tương laiMới\u9884\u8bbe）
 */
type FieldOverrides = Record<string, string>;

/**
 * 'skip' thể hiện\u8be5từ\u6bb5\u5728\u8be5\u5a92\u4ecb\u4e0b\u6574\u4f53bỏ qua（Quay lại\u7a7achuỗi）
 */
type FieldStrategy = FieldOverrides | 'skip';

type MediaTranslationTable = Partial<Record<CinematographyField, FieldStrategy>>;

// ---------- animation ----------

const ANIMATION_TABLE: MediaTranslationTable = {
  cameraRig: {
    tripod:    'static frame composition,',
    handheld:  'slight camera wobble, animated shake,',
    steadicam: 'smooth gliding virtual camera,',
    dolly:     'smooth tracking with parallax layers,',
    crane:     'sweeping vertical arc camera,',
    drone:     'aerial sweeping bird-eye view,',
    shoulder:  'subtle animated camera sway,',
    slider:    'smooth lateral pan with depth shift,',
  },
  depthOfField: {
    'ultra-shallow': 'dreamy layered blur, strong foreground-background separation,',
    shallow:         'soft background blur, depth layers,',
    medium:          'moderate depth layering,',
    deep:            'all layers in sharp focus,',
    'split-diopter': 'dual-plane sharp focus, foreground and background clear,',
  },
  focusTransition: {
    none:           '',
    'rack-to-fg':   'focus shift to foreground layer,',
    'rack-to-bg':   'focus shift to background layer,',
    'rack-between': 'focus shift between character layers,',
    'pull-focus':   'focus tracking subject movement,',
  },
  // lightingStyle / lightingDirection / colorTemperature / movementSpeed / playbackSpeed
  // → khái niệm\u76f8\u901a，\u4e0d\u505a\u7ffb\u8bd1，\u6cbfsử dụngnguyên bản token
  // cameraAngle / focalLength / photographyTechnique → \u865a\u62df\u6444\u50cf\u673a\u53efSử dụng trực tiếp
};

// ---------- stop-motion ----------

const STOP_MOTION_TABLE: MediaTranslationTable = {
  cameraRig: {
    tripod:    'locked miniature camera, tabletop framing,',
    handheld:  'subtle stop-motion jitter,',
    steadicam: 'smooth miniature track movement,',
    dolly:     'miniature rail push-in,',
    crane:     'overhead rig on miniature set,',
    drone:     'overhead crane angle, miniature landscape,',
    shoulder:  'gentle stop-motion wobble,',
    slider:    'miniature slider lateral movement,',
  },
  depthOfField: {
    'ultra-shallow': 'macro lens extreme bokeh, tilt-shift miniature feel,',
    shallow:         'macro lens shallow DOF, miniature scale emphasis,',
    medium:          'moderate DOF, miniature set visible,',
    deep:            'deep focus, full miniature set sharp,',
    'split-diopter': 'split focus, miniature foreground and background sharp,',
  },
  focusTransition: {
    none:           '',
    'rack-to-fg':   'rack focus to foreground prop,',
    'rack-to-bg':   'rack focus to miniature background,',
    'rack-between': 'rack focus between miniature figures,',
    'pull-focus':   'pull focus following figure movement,',
  },
  playbackSpeed: {
    'slow-motion-4x': 'fewer frames per movement, very deliberate pacing,',
    'slow-motion-2x': 'reduced frame rate, deliberate pacing,',
    normal:           '',
    'fast-2x':        'rapid frame sequence,',
    timelapse:        'rapid stop-motion sequence, time compression,',
  },
};

// ---------- graphic ----------

const GRAPHIC_TABLE: MediaTranslationTable = {
  // \u7269\u7406\u6444\u5f71Tham số → Tất cảbỏ qua
  cameraRig:       'skip',
  movementSpeed:   'skip',
  depthOfField:    'skip',
  focusTransition: 'skip',
  lightingDirection: 'skip',
  cameraAngle:             'skip',
  focalLength:             'skip',
  photographyTechnique:    'skip',
  // Chiếu sángPhong cách → \u8f6c\u8bd1choMàu sắc/cảm xúc
  lightingStyle: {
    'high-key':    'bright palette, open composition,',
    'low-key':     'dark tones, heavy contrast areas,',
    silhouette:    'solid dark shapes against light ground,',
    chiaroscuro:   'strong light-dark contrast zones,',
    natural:       'natural color palette,',
    neon:          'vibrant neon color accents,',
    candlelight:   'warm golden amber tint,',
    moonlight:     'cool blue-silver tint,',
  },
  // Nhiệt độ màu → Tông màuXu hướng
  colorTemperature: {
    warm:          'warm orange-amber tones,',
    neutral:       'balanced neutral palette,',
    cool:          'cool blue tones,',
    'golden-hour': 'warm golden cast,',
    'blue-hour':   'twilight blue-purple cast,',
    mixed:         'mixed warm and cool accents,',
  },
  // Phátốc độ → Nhịp điệu Mô tả
  playbackSpeed: {
    'slow-motion-4x': 'slow deliberate pacing,',
    'slow-motion-2x': 'slow pacing,',
    normal:           '',
    'fast-2x':        'rapid sequence,',
    timelapse:        'compressed time sequence,',
  },
};

// ---------- \u6c47\u603b\u67e5\u627e ----------

const TRANSLATION_TABLES: Partial<Record<MediaType, MediaTranslationTable>> = {
  animation:      ANIMATION_TABLE,
  'stop-motion':  STOP_MOTION_TABLE,
  graphic:        GRAPHIC_TABLE,
  // cinematic \u4e0d\u9700\u8981\u7ffb\u8bd1\u8868
};

// ==================== chức năng cốt lõi ====================

/**
 * \u5c06\u6444\u5f71Tham số token \u7ffb\u8bd1chohiện tạiLò vừaạtôi làĐợi đã\u6548\u8868\u8fbe。
 *
 * @param mediaType   - hiện tạiTầm nhìn Phong cáchcủaLò vừaại
 * @param field       - \u6444\u5f71Tham số\u7ef4\u5ea6
 * @param presetId    - \u9884\u8bbe ID（Chẳng hạn như 'dolly', 'shallow'）
 * @param originalToken - nguyên bản promptToken（\u6765\u81ea\u9884\u8bbe\u6570\u636e）
 * @returns \u7ffb\u8bd1\u540ecủa token；\u7a7achuỗithể hiệnThếam số\u5728\u6b64\u5a92\u4ecb\u4e0b\u4e0d\u9002sử dụng
 */
export function translateToken(
  mediaType: MediaType,
  field: CinematographyField,
  presetId: string,
  originalToken: string,
): string {
  // cinematic → \u76f4\u901a
  if (mediaType === 'cinematic') return originalToken;

  const table = TRANSLATION_TABLES[mediaType];
  if (!table) return originalToken;

  const strategy = table[field];

  // \u8be5từ\u6bb5không có\u7279\u6b8a\u5904\u7406 → \u6cbfsử dụngnguyên bản token
  if (strategy === undefined) return originalToken;

  // \u6574\u4f53bỏ qua
  if (strategy === 'skip') return '';

  // \u67e5\u8868thay thế
  const override = strategy[presetId];
  return override !== undefined ? override : originalToken;
}

/**
 * \u5224\u65ad\u67d0mộttừ\u6bb5\u5728hiện tại\u5a92\u4ecb\u4e0b\u662f\u5426\u88abbỏ qua（UI Có sẵn\u6b64\u51b3\u5b9a\u662f\u5426\u663e\u793a\u7070\u8272）
 */
export function isFieldSkipped(mediaType: MediaType, field: CinematographyField): boolean {
  if (mediaType === 'cinematic') return false;
  const table = TRANSLATION_TABLES[mediaType];
  return table?.[field] === 'skip';
}

/**
 * \u83b7\u53d6Lò vừaạtôi là\u7b80\u8981\u6307\u5bfcGiải thích（sử dụng\u4e8e AI \u6821\u51c6 system prompt）
 */
export function getMediaTypeGuidance(mediaType: MediaType): string {
  switch (mediaType) {
    case 'cinematic':
      return 'This is a cinematic/live-action visual style. Use full physical cinematography vocabulary — real camera rigs, lens optics, lighting setups.';
    case 'animation':
      return 'This is an animation style. Adapt camera terms to virtual camera equivalents — use parallax layers instead of physical dolly, layer blur instead of optical DOF. Keep lighting and mood concepts.';
    case 'stop-motion':
      return 'This is a stop-motion style. Frame everything as miniature/tabletop photography — macro lenses, miniature sets, practical lighting on small scale. Respect frame-by-frame pacing.';
    case 'graphic':
      return 'This is a highly abstract graphic style (pixel art, watercolor, line art, etc.). Do NOT use physical camera or lens terminology. Describe visual composition, color palette, mood, and rhythm instead.';
  }
}
