// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Prompt Builder — \u7edfmộtVideoPrompt\u7ec4\u88c5\u6a21\u5757
 *
 * nguyên tắc cốt lõi：\u6574\u5408cho\u8bed\u4e49\u5c42lần，\u907f\u514d\u788e\u7247\u5316\u5806\u53e0\u5bfc\u81f4\u4fe1\u53f7\u7a00\u91ca
 * Layer 1: Cảthiết kế bến cảng (Camera) - ưu tiên cao nhất
 * Layer 1.5: đèn\u8bbe\u8ba1 (Lighting)
 * Layer 2: bên trong\u5bb9tiêu điểm (Subject) - lần\u9ad8ưu tiên
 * Layer 3: bầu không khí\u4fee\u9970 (Mood) - phụ trợ
 * Layer 4: CảnhÂm thanh (Setting & Audio)
 * Layer 5: Tầm nhìn Phong cách (Style)
 * Base: Người dùngPrompt
 *
 * Nhiếp ảnh Phong cách\u6863\u6848\u56de\u9000quy tắc：\u9010\u955ctừ\u6bb5cho\u7a7a\u65f6sử dụngDự án\u7ea7\u6444\u5f71\u6863\u6848Mặc địgiá trị nh
 */

import type { SplitScene, EmotionTag } from '@/stores/director-store';
import {
  SHOT_SIZE_PRESETS,
  CAMERA_RIG_PRESETS,
  MOVEMENT_SPEED_PRESETS,
  DEPTH_OF_FIELD_PRESETS,
  FOCUS_TRANSITION_PRESETS,
  LIGHTING_STYLE_PRESETS,
  LIGHTING_DIRECTION_PRESETS,
  COLOR_TEMPERATURE_PRESETS,
  ATMOSPHERIC_EFFECT_PRESETS,
  EFFECT_INTENSITY_PRESETS,
  PLAYBACK_SPEED_PRESETS,
  EMOTION_PRESETS,
  CAMERA_ANGLE_PRESETS,
  FOCAL_LENGTH_PRESETS,
  PHOTOGRAPHY_TECHNIQUE_PRESETS,
  CAMERA_MOVEMENT_PRESETS,
  SPECIAL_TECHNIQUE_PRESETS,
} from '@/stores/director-store';
import type { CinematographyProfile } from '@/lib/constants/cinematography-profiles';
import type { MediaType } from '@/lib/constants/visual-styles';
import { translateToken, type CinematographyField } from '@/lib/generation/media-type-tokens';

// ==================== phụ trợchức năng ====================

/**
 * Theo Th.ẻ cảm xúc\u6784\u5efaKhí quyển Mô tả\u6587\u672c
 */
export function buildEmotionDescription(emotionTags: EmotionTag[]): string {
  if (!emotionTags || emotionTags.length === 0) return '';

  const allPresets = [
    ...EMOTION_PRESETS.basic,
    ...EMOTION_PRESETS.atmosphere,
    ...EMOTION_PRESETS.tone,
  ];

  const labels = emotionTags.map(tagId => {
    const preset = allPresets.find(p => p.id === tagId);
    return preset?.label || tagId;
  });

  if (labels.length === 1) {
    return `bầu không khí${labels[0]}，`;
  } else if (labels.length === 2) {
    return `bầu không khítừ${labels[0]}\u8f6ccho${labels[1]}，`;
  } else {
    const progression = labels.slice(0, -1).join('、') + '\u7136\u540e' + labels[labels.length - 1];
    return `bầu không khí\u4f9dlần${progression}，`;
  }
}

// ==================== \u9884\u8bbe\u67e5\u627ephụ trợ ====================

/**
 * \u67e5\u627e\u9884\u8bbe token \u5e76Áp dụngLò vừaại\u7ffb\u8bd1。
 * \u5f53 mediaType cho undefined \u65f6\u89c6cho cinematic（\u76f4\u901a）。
 */
function findPresetToken<T extends { id: string; promptToken: string }>(
  presets: readonly T[],
  id: string | undefined,
  mediaType: MediaType | undefined,
  field: CinematographyField,
): string | undefined {
  if (!id) return undefined;
  const preset = presets.find(p => p.id === id);
  if (!preset?.promptToken) return undefined;
  const translated = translateToken(mediaType ?? 'cinematic', field, id, preset.promptToken);
  return translated || undefined; // \u7a7achuỗi → undefined（bỏ qua）
}

// ==================== Video Prompt \u6784\u5efaCấu hình ====================

export interface VideoPromptConfig {
  /** Tầm nhìn Phong cách tokens */
  styleTokens?: string[];
  /** bức tranhTỷ lệ (\u4ec5\u4f5ccho\u4e0a\u4e0b\u6587Tài liệu tham khảo) */
  aspectRatio?: '16:9' | '9:16';
  /** Lò vừaại — \u63a7\u5236\u6444\u5f71Tham số\u7ffb\u8bd1Chiến lược */
  mediaType?: MediaType;
}

// ==================== chức năng cốt lõi ====================

/**
 * \u6784\u5efaVideoTạocủa\u5b8c\u6574 prompt
 *
 * @param scene - Phân cảnh dữ liệu (SplitScene)
 * @param cinProfile - Nhiếp ảnh Phong cách\u6863\u6848 (undefined thể hiện\u672aCài đặt)
 * @param config - \u989dBên ngoàiCấu hình (styleTokens Đợi đã)
 * @returns \u7ec4\u88c5\u597dcủa\u5b8c\u6574 prompt chuỗi
 */
export function buildVideoPrompt(
  scene: SplitScene,
  cinProfile: CinematographyProfile | undefined,
  config: VideoPromptConfig = {},
): string {
  const promptParts: string[] = [];
  const mt = config.mediaType;

  // ---------- Layer 1: Cảthiết kế bến cảng (Camera Design) ----------
  const cameraDesignParts: string[] = [];

  // 1.0 Thiết bịLoại —— \u9010\u955cƯu tiên，\u56de\u9000\u6444\u5f71\u6863\u6848
  const effectiveRig = scene.cameraRig || cinProfile?.defaultRig?.cameraRig;
  const rigToken = findPresetToken(CAMERA_RIG_PRESETS, effectiveRig, mt, 'cameraRig');
  if (rigToken) cameraDesignParts.push(rigToken);

  // 1.1 \u5224\u65adNâng caoGóc máyMô tả
  const hasCameraPosition = scene.cameraPosition?.trim();

  // 1.2 \u8d77\u59cbCỡ cảnh（\u4ec5\u5f53\u6ca1CóNâng caoGóc máyMô tả\u65f6）
  if (!hasCameraPosition && scene.shotSize) {
    const shotPreset = SHOT_SIZE_PRESETS.find(p => p.id === scene.shotSize);
    if (shotPreset) {
      cameraDesignParts.push(`starts ${shotPreset.labelEn.toLowerCase()}`);
    }
  }

  // 1.3 Góc máyvớicác môn thể thao
  if (hasCameraPosition) {
    cameraDesignParts.push(scene.cameraPosition!.trim());
  } else if (scene.cameraMovement?.trim() && scene.cameraMovement !== 'none') {
    // đầu tiên\u67e5\u9884\u8bbe promptToken，\u627e\u4e0dĐến\u56de\u9000\u539f\u503c（Tương thích với dữ liệu cũ）
    const cmPreset = CAMERA_MOVEMENT_PRESETS.find(p => p.id === scene.cameraMovement);
    cameraDesignParts.push(cmPreset?.promptToken || scene.cameraMovement.trim());
  }

  // 1.35 góc chụp —— \u9010\u955cƯu tiên，\u56de\u9000\u6444\u5f71\u6863\u6848
  const effectiveAngle = scene.cameraAngle || cinProfile?.defaultAngle;
  if (effectiveAngle && effectiveAngle !== 'eye-level') {
    const angleToken = findPresetToken(CAMERA_ANGLE_PRESETS, effectiveAngle, mt, 'cameraAngle');
    if (angleToken) cameraDesignParts.push(angleToken);
  }

  // 1.4 Tốc độ di chuyển —— \u9010\u955cƯu tiên，\u56de\u9000\u6444\u5f71\u6863\u6848
  const effectiveSpeed = scene.movementSpeed || cinProfile?.defaultRig?.movementSpeed;
  if (effectiveSpeed && effectiveSpeed !== 'normal') {
    const token = findPresetToken(MOVEMENT_SPEED_PRESETS, effectiveSpeed, mt, 'movementSpeed');
    if (token) cameraDesignParts.push(token);
  }

  // 1.5 \u8282\u594f\u4fee\u9970
  if (scene.rhythm?.trim()) {
    cameraDesignParts.push(`${scene.rhythm.trim()} rhythm`);
  }

  // 1.6 độ sâu trường ảnhvớitiêu điểm —— \u9010\u955cƯu tiên，\u56de\u9000\u6444\u5f71\u6863\u6848
  const effectiveDof = scene.depthOfField || cinProfile?.defaultFocus?.depthOfField;
  const dofToken = findPresetToken(DEPTH_OF_FIELD_PRESETS, effectiveDof, mt, 'depthOfField');
  if (dofToken) cameraDesignParts.push(dofToken);

  if (scene.focusTarget?.trim()) {
    cameraDesignParts.push(`focus on ${scene.focusTarget.trim()}`);
  }

  const effectiveFt = scene.focusTransition || cinProfile?.defaultFocus?.focusTransition;
  if (effectiveFt && effectiveFt !== 'none') {
    const token = findPresetToken(FOCUS_TRANSITION_PRESETS, effectiveFt, mt, 'focusTransition');
    if (token) cameraDesignParts.push(token);
  }

  // 1.7 Cảtiêu cự nh quay —— \u9010\u955cƯu tiên，\u56de\u9000\u6444\u5f71\u6863\u6848
  const effectiveFL = scene.focalLength || cinProfile?.defaultFocalLength;
  if (effectiveFL) {
    const flToken = findPresetToken(FOCAL_LENGTH_PRESETS, effectiveFL, mt, 'focalLength');
    if (flToken) cameraDesignParts.push(flToken);
  }

  // 1.8 kỹ thuật chụp ảnh —— \u9010\u955cƯu tiên，\u56de\u9000\u6444\u5f71\u6863\u6848
  const effectiveTech = scene.photographyTechnique || cinProfile?.defaultTechnique;
  if (effectiveTech) {
    const techToken = findPresetToken(PHOTOGRAPHY_TECHNIQUE_PRESETS, effectiveTech, mt, 'photographyTechnique');
    if (techToken) cameraDesignParts.push(techToken);
  }

  // 1.9 Kỹ thuật chụp đặc biệt
  if ((scene as any).specialTechnique && (scene as any).specialTechnique !== 'none') {
    const stPreset = SPECIAL_TECHNIQUE_PRESETS.find(p => p.id === (scene as any).specialTechnique);
    if (stPreset?.promptToken) cameraDesignParts.push(stPreset.promptToken);
  }

  // \u7ec4\u88c5 Layer 1
  if (cameraDesignParts.length > 0) {
    promptParts.push(`Camera: ${cameraDesignParts.join(', ')}`);
  }

  // ---------- Layer 1.5: đèn\u8bbe\u8ba1 (Lighting) ----------
  const lightingParts: string[] = [];

  const effectiveLs = scene.lightingStyle || cinProfile?.defaultLighting?.style;
  const lsToken = findPresetToken(LIGHTING_STYLE_PRESETS, effectiveLs, mt, 'lightingStyle');
  if (lsToken) lightingParts.push(lsToken);

  const effectiveLd = scene.lightingDirection || cinProfile?.defaultLighting?.direction;
  const ldToken = findPresetToken(LIGHTING_DIRECTION_PRESETS, effectiveLd, mt, 'lightingDirection');
  if (ldToken) lightingParts.push(ldToken);

  const effectiveCt = scene.colorTemperature || cinProfile?.defaultLighting?.colorTemperature;
  const ctToken = findPresetToken(COLOR_TEMPERATURE_PRESETS, effectiveCt, mt, 'colorTemperature');
  if (ctToken) lightingParts.push(ctToken);

  if (scene.lightingNotes?.trim()) {
    lightingParts.push(scene.lightingNotes.trim());
  }

  if (lightingParts.length > 0) {
    promptParts.push(`Lighting: ${lightingParts.join(' ')}`);
  }

  // ---------- Layer 2: bên trong\u5bb9tiêu điểm (Subject & Focus) ----------
  const subjectParts: string[] = [];

  if (scene.characterBlocking?.trim()) {
    subjectParts.push(scene.characterBlocking.trim());
  }
  if (scene.actionSummary?.trim()) {
    subjectParts.push(scene.actionSummary.trim());
  }
  if (scene.visualFocus?.trim()) {
    subjectParts.push(`focus on ${scene.visualFocus.trim()}`);
  }

  if (subjectParts.length > 0) {
    promptParts.push(`Subject: ${subjectParts.join(', ')}`);
  }

  // ---------- Layer 3: bầu không khí\u4fee\u9970 (Mood & Narrative) ----------
  const emotionDesc = buildEmotionDescription(scene.emotionTags || []);
  if (emotionDesc) {
    promptParts.push(`Mood: ${emotionDesc}`);
  }

  if (scene.narrativeFunction?.trim()) {
    promptParts.push(`Narrative purpose: ${scene.narrativeFunction.trim()}`);
  }
  if (scene.shotPurpose?.trim()) {
    promptParts.push(`Shot intent: ${scene.shotPurpose.trim()}`);
  }

  // 3.4 Không khí Xin chàoệu ứng —— \u9010\u955cƯu tiên，\u56de\u9000\u6444\u5f71\u6863\u6848
  const effectiveAtmo = (scene.atmosphericEffects && scene.atmosphericEffects.length > 0)
    ? scene.atmosphericEffects
    : cinProfile?.defaultAtmosphere?.effects;

  if (effectiveAtmo && effectiveAtmo.length > 0) {
    const allEffects = [
      ...ATMOSPHERIC_EFFECT_PRESETS.weather,
      ...ATMOSPHERIC_EFFECT_PRESETS.environment,
      ...ATMOSPHERIC_EFFECT_PRESETS.artistic,
    ];
    const effectTokens = effectiveAtmo
      .map(eid => {
        const e = allEffects.find(ef => ef.id === eid);
        if (!e?.promptToken) return undefined;
        const translated = translateToken(mt ?? 'cinematic', 'atmosphericEffect', eid, e.promptToken);
        return translated || undefined;
      })
      .filter(Boolean);

    if (effectTokens.length > 0) {
      const effectiveIntensity = scene.effectIntensity || cinProfile?.defaultAtmosphere?.intensity;
      const intensityPreset = effectiveIntensity
        ? EFFECT_INTENSITY_PRESETS.find(p => p.id === effectiveIntensity)
        : null;
      let intensityPrefix = '';
      if (intensityPreset?.promptToken) {
        const translatedIntensity = translateToken(mt ?? 'cinematic', 'effectIntensity', effectiveIntensity!, intensityPreset.promptToken);
        intensityPrefix = translatedIntensity ? `${translatedIntensity} ` : '';
      }
      promptParts.push(`Atmosphere: ${intensityPrefix}${effectTokens.join(', ')}`);
    }
  }

  // ---------- Layer 4: CảnhvớiÂm thanh (Setting & Audio) ----------
  if (scene.sceneName || scene.sceneLocation) {
    const sceneInfo = [scene.sceneName, scene.sceneLocation].filter(Boolean).join(' - ');
    promptParts.push(`Setting: ${sceneInfo}`);
  }

  // đối thoại：Cóbên trong\u5bb9\u4e14\u5f00\u542f\u65f6chứa，\u5426\u5219\u660e\u786e\u7981\u6b62
  if (scene.audioDialogueEnabled !== false && scene.dialogue?.trim()) {
    promptParts.push(`Dialogue: "${scene.dialogue.trim()}"`);
  } else {
    promptParts.push('Dialogue: \u7981\u6b62đối thoại');
  }
  // âm thanh xung quanh：Cóbên trong\u5bb9\u4e14\u5f00\u542f\u65f6chứa，\u5426\u5219\u660e\u786e\u7981\u6b62
  if (scene.audioAmbientEnabled !== false && scene.ambientSound?.trim()) {
    promptParts.push(`Ambient: ${scene.ambientSound.trim()}`);
  } else {
    promptParts.push('Ambient: \u7981\u6b62âm thanh xung quanh');
  }
  // Hiệu ứng âm thanh：Cóbên trong\u5bb9\u4e14\u5f00\u542f\u65f6chứa，\u5426\u5219\u660e\u786e\u7981\u6b62
  if (scene.audioSfxEnabled !== false && scene.soundEffectText?.trim()) {
    promptParts.push(`SFX: ${scene.soundEffectText.trim()}`);
  } else {
    promptParts.push('SFX: \u7981\u6b62Hiệu ứng âm thanh');
  }
  // NềnÂm nhạc：Cóbên trong\u5bb9\u4e14\u5f00\u542f\u65f6chứa，\u5426\u5219\u660e\u786e\u7981\u6b62
  if (scene.audioBgmEnabled === true && scene.backgroundMusic?.trim()) {
    promptParts.push(`Music: ${scene.backgroundMusic.trim()}`);
  } else {
    promptParts.push('Music: \u7981\u6b62NềnÂm nhạc');
  }

  // ---------- Layer 5: Tầm nhìn Phong cách (Style) ----------
  if (config.styleTokens && config.styleTokens.length > 0) {
    promptParts.push(`Style: ${config.styleTokens.join(', ')}`);
  }

  // ---------- Base Prompt: Người dùngVideoPrompt ----------
  const basePrompt = scene.videoPromptZh || scene.videoPrompt || '';
  if (basePrompt.trim()) {
    promptParts.push(basePrompt.trim());
  }

  // ---------- Kiểm soát tốc độ (Tăng tốc độ) —— \u9010\u955cƯu tiên，\u56de\u9000\u6444\u5f71\u6863\u6848 ----------
  const effectivePbSpeed = scene.playbackSpeed || cinProfile?.defaultSpeed?.playbackSpeed;
  if (effectivePbSpeed && effectivePbSpeed !== 'normal') {
    const token = findPresetToken(PLAYBACK_SPEED_PRESETS, effectivePbSpeed, mt, 'playbackSpeed');
    if (token) promptParts.push(token);
  }

  // ---------- Chơi liên tụckhoảng\u675f (Continuity) ----------
  if (scene.continuityRef?.lightingContinuity?.trim()) {
    promptParts.push(scene.continuityRef.lightingContinuity.trim());
  }

  // \u6700\u7ec8\u7ec4\u88c5
  return promptParts.join('. ');
}
