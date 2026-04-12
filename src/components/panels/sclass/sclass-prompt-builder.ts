// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * sclass-prompt-builder.ts — lớp Scấp độ nhómPrompt\u6784\u5efa
 *
 * Chức năng cốt lõi：
 * 1. \u81ea\u52a8từ character-library-store Trích xuất Nhân vậsự phản bội\u56fe → @Image
 * 2. \u81ea\u52a8từ scene-store Trích xuấtCảnh tham khảo\u56fe → @Image
 * 3. \u81ea\u52a8từ splitScene.dialogue Trích xuấtđối thoại → \u5507\u5f62\u540c\u6b65\u6307\u4ee4
 * 4. \u5408\u5e76\u7ec4bên trong\u5404Cảnh quaycủaba\u5c42Promptcho「Cảnh quay1→Cảnh quay2→Cảnh quay3」\u7ed3\u6784
 * 5. \u6536đặtNgười dùngTải lêncủa @Video / @Audio \u5f15sử dụng
 * 6. \u68c0\u67e5 Hạn chế của Seedance 2.0（≤9\u56fe + ≤3Video + ≤3Âm thanh，\u603b≤12，prompt≤5000từ\u7b26）
 */

import type { SplitScene } from '@/stores/director-store';
import type { Character } from '@/stores/character-library-store';
import type { Scene } from '@/stores/scene-store';
import type { ShotGroup, AssetRef, AssetPurpose, SClassAspectRatio, SClassResolution, SClassDuration, EditType } from '@/stores/sclass-store';

// ==================== Types ====================

/** @\u5f15sử dụng\u6536đặtkết quả */
export interface CollectedRefs {
  /** Hình ảnh tham khảo（Nhân vật\u56fe + Cảnh\u56fe + khung hình đầu tiêđồ thị n），nhất 9 \u5f20 */
  images: AssetRef[];
  /** Trích dẫn video（Người dùngTải lên），nhất 3 một */
  videos: AssetRef[];
  /** Âm thanh quote（Người dùngTải lên），nhất 3 một */
  audios: AssetRef[];
  /** Tổng Tệp\u6570 */
  totalFiles: number;
  /** \u662f\u5426\u8d85\u51fa\u9650\u5236 */
  overLimit: boolean;
  /** \u8d85\u9650Chi tiết */
  limitWarnings: string[];
}

/** cấp độ nhóm prompt \u6784\u5efakết quả */
export interface GroupPromptResult {
  /** \u6700\u7ec8\u7ec4\u88c5của prompt（\u53d1\u9001\u7ed9 API） */
  prompt: string;
  /** prompt từ\u7b26\u6570 */
  charCount: number;
  /** \u662f\u5426\u8d85\u51fa 5000 từ\u7b26\u9650\u5236 */
  overCharLimit: boolean;
  /** \u6536đặtĐếncủa @\u5f15sử dụng */
  refs: CollectedRefs;
  /** \u5404Cảnh quaycủa prompt \u7247\u6bb5（sử dụng\u4e8e UI Xem trước） */
  shotSegments: ShotSegment[];
  /** đối thoại\u5507\u5f62\u540c\u6b65\u7247\u6bb5 */
  dialogueSegments: DialogueSegment[];
}

/** Đơn Cảnh quaycủa prompt \u7247\u6bb5 */
export interface ShotSegment {
  sceneId: number;
  sceneName: string;
  /** \u8be5Cảnh quay\u5728\u7ec4bên trongcủa\u7d22\u5f15（1-based） */
  shotIndex: number;
  /** Cảnh quayMô tả（Hành động + Cảnh quayngôn ngữ） */
  description: string;
  /** đối thoại\u6587\u672c */
  dialogue: string;
  /** Thời lượng（giây） */
  duration: number;
}

/** đối thoại\u5507\u5f62\u540c\u6b65\u7247\u6bb5 */
export interface DialogueSegment {
  sceneId: number;
  characterName: string;
  text: string;
  /** \u5728Videotrongcủa\u5927\u81f4Thời gianVị trí（giây） */
  timeOffset: number;
}

// ==================== Seedance 2.0 Limits ====================

export const SEEDANCE_LIMITS = {
  maxImages: 9,
  maxVideos: 3,
  maxAudios: 3,
  maxTotalFiles: 12,
  maxPromptChars: 5000,
  maxDuration: 15,
  minDuration: 4,
} as const;

// ==================== Grid Image Merge ====================

/**
 * Tính toánbố trí lưới（N×N Chiến lược）
 */
function calculateGridLayout(count: number): { cols: number; rows: number; paddedCount: number } {
  if (count <= 4) return { cols: 2, rows: 2, paddedCount: 4 };
  return { cols: 3, rows: 3, paddedCount: 9 };
}

/**
 * \u5c06Nhiều hình ảnhkhung hình đầu tiênHình ảnh\u5408\u5e76chomột mảnhbiểu đồ lưới（Canvas \u62fc\u63a5）
 *
 * Bố cụcquy tắc（N×N Chiến lược，với handleMergedGenerate một\u81f4）：
 * - 1-4 \u5f20 → 2×2，\u4e0d\u8db3của\u683c\u5b50Để trống
 * - 5-9 \u5f20 → 3×3，\u4e0d\u8db3của\u683c\u5b50Để trống
 * \u5bbd\u9ad8\u6bd4：N×N \u7f51\u683c\u4e0b，\u6574\u56fe\u5bbd\u9ad8\u6bd4 = \u5355\u683c\u5bbd\u9ad8\u6bd4 = Đích\u753b\u5e45\u6bd4
 *
 * @param imageUrls Hình ảnh URL danh sách（base64 / http / local-image://）
 * @param aspectRatio ĐíchTỷ lệ khung hình，Chẳng hạn như '16:9' hoặc '9:16'
 * @returns \u5408\u5e76\u540ecủa dataUrl (image/png)
 */
export async function mergeToGridImage(
  imageUrls: string[],
  aspectRatio: string = '16:9',
): Promise<string> {
  if (imageUrls.length === 0) throw new Error('mergeToGridImage: không cóHình ảnh\u53ef\u5408\u5e76');
  if (imageUrls.length === 1) {
    // \u5355\u5f20Quay trực tiếp lại，không có\u9700\u5408\u5e76
    return imageUrls[0];
  }

  const { cols, rows } = calculateGridLayout(imageUrls.length);

  // phân tích cú pháp\u5bbd\u9ad8\u6bd4
  const [aw, ah] = aspectRatio.split(':').map(Number);
  const cellAspect = (aw || 16) / (ah || 9);

  // \u6bcflướtôi là\u50cf\u7d20Kích thước（Dựa trên\u5408\u7406Độ phân giải）
  const cellWidth = cellAspect >= 1 ? 512 : Math.round(512 * cellAspect);
  const cellHeight = cellAspect >= 1 ? Math.round(512 / cellAspect) : 512;

  const totalWidth = cellWidth * cols;
  const totalHeight = cellHeight * rows;

  // \u52a0\u8f7dTất cảHình ảnh
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`\u52a0\u8f7dHình ảnhThất bại: ${src.substring(0, 60)}...`));
      img.src = src;
    });

  const images = await Promise.all(imageUrls.map(loadImage));

  // Canvas \u62fc\u63a5
  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;

  // \u586b\u5145\u7070\u8272Nền（\u7a7a\u683c\u5b50）
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // \u7ed8\u5236\u6bcf\u5f20Hình ảnhĐến\u5bf9\u5e94\u683c\u5b50，Căn giữaCropgiữ\u5bbd\u9ad8\u6bd4
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const dx = col * cellWidth;
    const dy = row * cellHeight;

    // Tính toán cover \u88c1\u526aQuận\u57df
    const imgAspect = img.width / img.height;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAspect > cellAspect) {
      // Hình ảnh\u592a\u5bbd，\u88c1\u5bbd\u5ea6
      sw = Math.round(img.height * cellAspect);
      sx = Math.round((img.width - sw) / 2);
    } else {
      // Hình ảnh\u592a\u9ad8，\u88c1\u9ad8\u5ea6
      sh = Math.round(img.width / cellAspect);
      sy = Math.round((img.height - sh) / 2);
    }

    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, cellWidth, cellHeight);
  }

  return canvas.toDataURL('image/png');
}

// ==================== Reference Collection ====================

/**
 * từ character-library-store Trích xuất Nhân vậsự phản bội\u56fe
 * Mỗi Nhân vật\u53d6Không.một mảnh view Hình ảnh
 */
export function collectCharacterRefs(
  characterIds: string[],
  characters: Character[],
): AssetRef[] {
  const refs: AssetRef[] = [];
  const seen = new Set<string>();

  for (const charId of characterIds) {
    if (seen.has(charId)) continue;
    seen.add(charId);

    const char = characters.find(c => c.id === charId);
    if (!char) continue;

    // Ưu tiênsử dụng base64（\u6301\u4e45\u5316），\u5176lầnsử dụng URL
    const view = char.views[0];
    const imageUrl = view?.imageBase64 || view?.imageUrl || char.thumbnailUrl;
    if (!imageUrl) continue;

    refs.push({
      id: `char_${charId}`,
      type: 'image',
      tag: `@Hình ảnh`,  // tag \u4f1a\u5728\u6700\u7ec8\u7ec4\u88c5\u65f6\u91cd\u65b0\u7f16\u53f7
      localUrl: imageUrl,
      httpUrl: null,
      fileName: `${char.name}_ref.png`,
      fileSize: 0,
      duration: null,
      purpose: 'character_ref',
    });
  }

  return refs;
}

/**
 * từ scene-store Trích xuấtCảnh tham khảo\u56fe
 * Chấp nhận SplitScene.sceneLibraryId \u5173\u8054
 */
export function collectSceneRefs(
  scenes: SplitScene[],
  sceneLibrary: Scene[],
): AssetRef[] {
  const refs: AssetRef[] = [];
  const seen = new Set<string>();

  for (const splitScene of scenes) {
    // \u65b9\u5f0f1: Sử dụng trực tiếpPhân cảnh\u4e0aĐã rồiliên quan đến Cảnh tham khảo\u56fe
    if (splitScene.sceneReferenceImage && !seen.has(splitScene.sceneReferenceImage)) {
      seen.add(splitScene.sceneReferenceImage);
      refs.push({
        id: `scene_ref_${splitScene.id}`,
        type: 'image',
        tag: '@Hình ảnh',
        localUrl: splitScene.sceneReferenceImage,
        httpUrl: null,
        fileName: `scene_${splitScene.sceneName || splitScene.id}.png`,
        fileSize: 0,
        duration: null,
        purpose: 'scene_ref',
      });
      continue;
    }

    // \u65b9\u5f0f2: Chấp nhận sceneLibraryId từThư viện cảnh\u67e5\u627e
    if (splitScene.sceneLibraryId && !seen.has(splitScene.sceneLibraryId)) {
      seen.add(splitScene.sceneLibraryId);
      const sceneObj = sceneLibrary.find(s => s.id === splitScene.sceneLibraryId);
      const sceneImg = sceneObj?.referenceImageBase64 || sceneObj?.referenceImage;
      if (sceneImg) {
        refs.push({
          id: `scene_lib_${splitScene.sceneLibraryId}`,
          type: 'image',
          tag: '@Hình ảnh',
          localUrl: sceneImg,
          httpUrl: null,
          fileName: `${sceneObj?.name || 'scene'}_ref.png`,
          fileSize: 0,
          duration: null,
          purpose: 'scene_ref',
        });
      }
    }
  }

  return refs;
}

/**
 * \u6536đặt\u7ec4bên trong\u5404Cảnh quaycủakhung hình đầu tiênHình ảnh\u4f5ccho @Image
 */
export function collectFirstFrameRefs(scenes: SplitScene[]): AssetRef[] {
  const refs: AssetRef[] = [];
  for (const scene of scenes) {
    const imageUrl = scene.imageDataUrl || scene.imageHttpUrl;
    if (!imageUrl) continue;
    refs.push({
      id: `firstframe_${scene.id}`,
      type: 'image',
      tag: '@Hình ảnh',
      localUrl: imageUrl,
      httpUrl: scene.imageHttpUrl || null,
      fileName: `shot_${scene.id + 1}_frame.png`,
      fileSize: 0,
      duration: null,
      purpose: 'first_frame',
    });
  }
  return refs;
}

/**
 * \u6c47Tổng Tất cả @\u5f15sử dụng\u5e76\u6267được rồi\u914d\u989d\u6821\u9a8c
 *
 * \u65b0\u7248ưu tiên（biểu đồ lướichế độ）：
 *   @Image1 = biểu đồ lưới（1\u5f20） > @Image2~9 = Nhân vậsự phản bội\u56fe（≤8\u5f20）
 * \u65e7\u7248ưu tiên（\u517c\u5bb9）：
 *   khung hình đầu tiêđồ thị n > Nhân vật\u56fe > Cảnh\u56fe，\u5408\u8ba1≤9\u5f20
 *
 * @param gridImageRef Chẳng hạn như\u679c\u63d0\u4f9b，\u5219sử dụngbiểu đồ lướichế độ（\u4e0dMột lần nữa\u9010\u5f20Thêmkhung hình đầu tiên）
 */
export function collectAllRefs(
  group: ShotGroup,
  scenes: SplitScene[],
  characters: Character[],
  sceneLibrary: Scene[],
  gridImageRef?: AssetRef | null,
): CollectedRefs {
  // 1. Thu thập Nhân vậsự phản bội\u56fe（\u53bb\u91cd：\u7ec4bên trongTất cảCảnh quaycủa characterIds \u5408\u5e76）
  const allCharIds = Array.from(
    new Set(scenes.flatMap(s => s.characterIds || []))
  );
  const charRefs = collectCharacterRefs(allCharIds, characters);

  // 2. \u6536đặtCảnh tham khảo\u56fe
  const sceneRefs = collectSceneRefs(scenes, sceneLibrary);

  let images: AssetRef[];

  if (gridImageRef) {
    // ========== biểu đồ lướichế độ ==========
    // biểu đồ lưới\u5360 1 \u69fd，\u5269\u4f59\u7ed9Nhân vật\u5f15sử dụng + Cảnh tham khảo\u56fe
    const remainingSlots = SEEDANCE_LIMITS.maxImages - 1;
    const charSlice = charRefs.slice(0, remainingSlots);
    images = [gridImageRef, ...charSlice];
    // Chẳng hạn như\u679c\u8fd8Có\u69fd\u4f4d，\u52a0\u5165Cảnh tham khảo\u56fe
    const usedSlots = images.length;
    if (usedSlots < SEEDANCE_LIMITS.maxImages) {
      images.push(...sceneRefs.slice(0, SEEDANCE_LIMITS.maxImages - usedSlots));
    }
  } else {
    // ========== \u65e7\u7248\u517c\u5bb9chế độ：\u9010\u5f20khung hình đầu tiên > Nhân vật > Cảnh ==========
    const frameRefs = collectFirstFrameRefs(scenes);
    const allImageRefs = [...frameRefs, ...charRefs, ...sceneRefs];
    images = allImageRefs.slice(0, SEEDANCE_LIMITS.maxImages);
  }

  // 5. Người dùngTải lêncủaVideo/Âm thanh quote（Đã rồi\u5728 group trong）
  const videoSlice = (group.videoRefs || []).slice(0, SEEDANCE_LIMITS.maxVideos);
  const audioSlice = (group.audioRefs || []).slice(0, SEEDANCE_LIMITS.maxAudios);

  // 6. \u91cd\u65b0\u7f16\u53f7 tag（map Tạo\u65b0\u5bf9\u8c61，\u6d88\u9664\u526f\u4f5csử dụng）
  const taggedImages = images.map((ref, i) => ({ ...ref, tag: `@Hình ảnh${i + 1}` }));
  const taggedVideos = videoSlice.map((ref, i) => ({ ...ref, tag: `@Video${i + 1}` }));
  const taggedAudios = audioSlice.map((ref, i) => ({ ...ref, tag: `@Âm thanh${i + 1}` }));

  // 7. \u914d\u989d\u6821\u9a8c
  const totalFiles = taggedImages.length + taggedVideos.length + taggedAudios.length;
  const warnings: string[] = [];
  if (taggedImages.length >= SEEDANCE_LIMITS.maxImages) {
    warnings.push(`Hình ảnh tham khảoĐã rồi\u8fbe\u4e0a\u9650 ${SEEDANCE_LIMITS.maxImages}`);
  }
  if (totalFiles > SEEDANCE_LIMITS.maxTotalFiles) {
    warnings.push(`Tổng Tệp\u6570 ${totalFiles} \u8d85\u51fa\u9650\u5236 ${SEEDANCE_LIMITS.maxTotalFiles}`);
  }

  return {
    images: taggedImages,
    videos: taggedVideos,
    audios: taggedAudios,
    totalFiles,
    overLimit: totalFiles > SEEDANCE_LIMITS.maxTotalFiles,
    limitWarnings: warnings,
  };
}

// ==================== Dialogue / Lip-Sync ====================

/**
 * từ\u7ec4bên trongCảnh quayTrích xuấtđối thoại，Tạo\u5507\u5f62\u540c\u6b65\u7247\u6bb5
 */
export function extractDialogueSegments(
  scenes: SplitScene[],
  characters: Character[],
): DialogueSegment[] {
  const segments: DialogueSegment[] = [];
  let timeOffset = 0;

  for (const scene of scenes) {
    const dur = scene.duration > 0 ? scene.duration : 5;

    if (scene.dialogue && scene.dialogue.trim()) {
      const dialogueText = scene.dialogue.trim();

      // Phát hiệnđối thoại\u6587\u672c\u662f\u5426Đã rồichứanói\u4ebaĐịnh dạng（Chẳng hạn như "dân làng：\u59b9\u5b50" hoặc "dân làng（\u64cd\u7740\u65b9\u8a00）：\u59b9\u5b50"）
      const speakerMatch = dialogueText.match(/^([^\uff1a:]{1,20})[\uff1a:](.+)$/s);

      let characterName: string;
      let text: string;

      if (speakerMatch) {
        // đối thoại\u81ea\u5e26nói\u4eba，Sử dụng trực tiếp
        characterName = speakerMatch[1].trim();
        text = speakerMatch[2].trim();
      } else {
        // \u56de\u9000Đến characterIds \u67e5\u627eNhân vậtên t
        characterName = scene.characterIds?.[0]
          ? characters.find(c => c.id === scene.characterIds[0])?.name || 'Nhân vật'
          : 'Nhân vật';
        text = dialogueText;
      }

      segments.push({
        sceneId: scene.id,
        characterName,
        text,
        timeOffset,
      });
    }

    timeOffset += dur;
  }

  return segments;
}

/**
 * \u5c06đối thoại\u7247\u6bb5\u8f6ccho\u5507\u5f62\u540c\u6b65\u6307\u4ee4\u6587\u672c
 */
function buildDialoguePromptPart(segments: DialogueSegment[]): string {
  if (segments.length === 0) return '';

  const lines = segments.map(s =>
    `[khoảng${s.timeOffset}s\u5904] ${s.characterName}：「${s.text}」— \u53e3\u578b\u540c\u6b65，tự nhiên\u53e3\u90e8Hành động`
  );

  return `\n\đối thoạivới\u53e3\u578b\u540c\u6b65：\n${lines.join('\n')}`;
}

// ==================== Shot Segment Building ====================

/**
 * cho một C duy nhấtảnh quay\u6784\u5efaMô tả\u7247\u6bb5（\u5b8c\u6574\u7248 — \u6db5\u76d6Phân cảnh\u5361\u7247\u4e0aTất cảCó sẵntừ\u6bb5）
 */
function buildShotSegment(
  scene: SplitScene,
  shotIndex: number,
  refs: CollectedRefs,
): ShotSegment {
  const parts: string[] = [];

  // Lọckhông có\u6548\u503ccủaphụ trợchức năng
  const isValid = (v?: string | null): v is string =>
    !!v && !['none', 'null', 'không có', 'không cóKỹ thuật', 'Mặc định'].includes(v.toLowerCase().trim());

  // ===== Cảnh quayngôn ngữ（\u8fd0\u955c + Cỡ cảnh + góc + tiêu cự + kỹ thuật chụp ảnh） =====
  if (isValid(scene.cameraMovement)) parts.push(scene.cameraMovement);
  if (isValid(scene.shotSize)) parts.push(scene.shotSize);
  if (isValid(scene.cameraAngle)) parts.push(scene.cameraAngle);
  if (isValid(scene.focalLength)) parts.push(scene.focalLength);
  if (isValid(scene.photographyTechnique)) parts.push(scene.photographyTechnique);
  if (isValid(scene.specialTechnique)) parts.push(scene.specialTechnique);

  // ===== Góc máyMô tả =====
  if (scene.cameraPosition?.trim()) parts.push(`camera: ${scene.cameraPosition.trim()}`);

  // ===== Hành độngMô tả（Ưu tiênVideoPrompt，\u5176lầnHành độngTóm tắt） =====
  const action = scene.videoPromptZh?.trim() || scene.videoPrompt?.trim()
    || scene.actionSummary?.trim() || '';
  if (action) parts.push(action);

  // ===== đèn =====
  const lightParts: string[] = [];
  if (isValid(scene.lightingStyle)) lightParts.push(scene.lightingStyle);
  if (isValid(scene.lightingDirection)) lightParts.push(scene.lightingDirection);
  if (isValid(scene.colorTemperature)) lightParts.push(scene.colorTemperature);
  if (scene.lightingNotes?.trim()) lightParts.push(scene.lightingNotes.trim());
  if (lightParts.length > 0) parts.push(`lighting: ${lightParts.join(', ')}`);

  // ===== độ sâu trường ảnh + tiêu điểm =====
  if (isValid(scene.depthOfField)) parts.push(`DoF: ${scene.depthOfField}`);
  if (scene.focusTarget?.trim()) parts.push(`focus: ${scene.focusTarget.trim()}`);
  if (isValid(scene.focusTransition)) parts.push(`focus-transition: ${scene.focusTransition}`);

  // ===== Thiết bị + Tốc độ di chuyển =====
  if (isValid(scene.cameraRig)) parts.push(`rig: ${scene.cameraRig}`);
  if (isValid(scene.movementSpeed) && !['normal', 'static'].includes(scene.movementSpeed!)) parts.push(`speed: ${scene.movementSpeed}`);

  // ===== Không khí Xin chàoệu ứng =====
  if (scene.atmosphericEffects && scene.atmosphericEffects.length > 0) {
    parts.push(`atmosphere: ${scene.atmosphericEffects.join(', ')}`);
  }

  // ===== Phátốc độ =====
  if (scene.playbackSpeed && scene.playbackSpeed !== 'normal') {
    parts.push(`playback: ${scene.playbackSpeed}`);
  }

  // ===== cảm xúcbầu không khí =====
  if (scene.emotionTags && scene.emotionTags.length > 0) {
    parts.push(`mood: ${scene.emotionTags.join(' → ')}`);
  }

  // ===== @Image \u5f15sử dụng（\u8be5Cảnh quaycủakhung hình đầu tiên） =====
  const frameRef = refs.images.find(r => r.id === `firstframe_${scene.id}`);
  if (frameRef) parts.push(`reference: ${frameRef.tag}`);

  return {
    sceneId: scene.id,
    sceneName: scene.sceneName || `Cảnh quay${scene.id + 1}`,
    shotIndex,
    description: parts.join(', '),
    dialogue: scene.dialogue || '',
    duration: scene.duration > 0 ? scene.duration : 5,
  };
}

// ==================== Main Builder ====================

export interface BuildGroupPromptOptions {
  group: ShotGroup;
  scenes: SplitScene[];
  characters: Character[];
  sceneLibrary: Scene[];
  /** Phong cách token（từ storyboardConfig） */
  styleTokens?: string[];
  /** \u5bbd\u9ad8\u6bd4 */
  aspectRatio?: SClassAspectRatio;
  /** \u662f\u5426chứađối thoại\u5507\u5f62\u540c\u6b65 */
  enableLipSync?: boolean;
  /** biểu đồ lưới\u5f15sử dụng（Chẳng hạn như\u679c\u63d0\u4f9b，sử dụngbiểu đồ lướichế độ\u6536đặt\u5f15sử dụng） */
  gridImageRef?: AssetRef | null;
}

/** purpose → Tiếng TrungGợi ý\u8bed\u6620\u5c04 */
const PURPOSE_PROMPT_MAP: Record<AssetPurpose, string> = {
  character_ref: 'giữNhân vậtBên ngoài\u89c2một\u81f4',
  scene_ref: '\u4f5ccho Cảnh tham khảo',
  first_frame: '\u4f5cchokhung hình đầu tiên',
  grid_image: 'choNhân vậsự phản bộibiểu đồ lưới，giữNhân vậtTính nhất quán',
  camera_replicate: '\u7cbe\u51c6\u590d\u523bCảnh quay thể thao\u8f68\u8ff9vàtốc độ',
  action_replicate: '\u590d\u523bHành động\u8282\u594fvà\u5e45\u5ea6',
  effect_replicate: '\u590d\u523bTầm nhìnHiệu ứngvà\u8f6c\u573a\u6548\u679c',
  beat_sync: '\u4f5cchoNềnÂm nhạc，Video\u8282\u594f\u4e25\u683ctrận đấuâm nhạc\u8282\u62cd',
  bgm: '\u4f5cchoNềnÂm nhạcTài liệu tham khảo',
  voice_ref: '\u4f5cchoTham chiếu bằng giọng nói',
  prev_video: '\u63a5\u7eed\u524d\u6bb5Video，giữNhân vậtvàCảnhmột\u81f4',
  video_extend: '\u4f5cchoVideo mở rộng，\u5e73\u6ed1\u8854\u63a5',
  video_edit_src: '\u4f5cchoBé Chỉnh sửNguồn Video của một',
  general: '\u4f5cchoTài liệu tham khảo',
};

/** Chỉnh sửaLoại → prompt \u6a21\u677f\u524d\u7f00 */
const EDIT_TYPE_TEMPLATE: Record<EditType, string> = {
  plot_change: '\u98a0\u8986@Video1\u91cccủa\u5267\u60c5，',
  character_swap: 'Video1trongNhân vật\u6362\u6210Hình ảnhtrongNhân vật，Hành động\u5b8c\u5168\u6a21\u4eff\u539fVideo，',
  attribute_modify: '\u5c06Video1trong',
  element_add: '\u5728Video1bức tranhtrongThêm',
};

/**
 * \u6784\u5efacấp độ nhóm prompt — lớp Schức năng cốt lõi
 *
 * Đầu raĐịnh dạng（Tiếng Trung\u6a21\u677f）：
 * ```
 * Nhiều Cảnh quay tường thuậtVideo（tổng cộng3Cảnh quay，Tổng Thời lượng14s）：
 *
 * Cảnh quay1 [0s-5s]「Cảnh tên」：[\u8fd0\u955c], [Hành động]
 * Cảnh quay2 [5s-9s]「Cảnh tên」：[\u8fd0\u955c], [Hành động]
 *
 * Nhân vậsự phản bội：@Hình ảnh4（Nhân vậtA）giữNhân vậtBên ngoài\u89c2một\u81f4
 * Cảnh tham khảo：@Hình ảnh6 \u4f5ccho Cảnh tham khảo
 *
 * đối thoạivới\u53e3\u578b\u540c\u6b65：
 * [khoảng2s\u5904] Nhân vậtA：「dòng」— \u53e3\u578b\u540c\u6b65，tự nhiên\u53e3\u90e8Hành động
 *
 * Phong cách：Cảm giác điện ảnh, Ấm Tông màu...
 * ```
 */
export function buildGroupPrompt(options: BuildGroupPromptOptions): GroupPromptResult {
  const {
    group,
    scenes,
    characters,
    sceneLibrary,
    styleTokens,
    aspectRatio,
    enableLipSync = true,
    gridImageRef,
  } = options;

  // 0. mở rộng/Chỉnh sửachế độ — điđộc lập\u5206\u652f
  const genType = group.generationType || 'new';
  if (genType === 'extend' || genType === 'edit') {
    return buildExtendEditPrompt(group, scenes, characters, sceneLibrary, styleTokens);
  }

  // 1. \u6536Đặt Tất cả @\u5f15sử dụng（biểu đồ lướichế độhoặc\u65e7\u7248chế độ）
  const refs = collectAllRefs(group, scenes, characters, sceneLibrary, gridImageRef);

  // 2. \u6784\u5efa\u5404Cảnh quay\u7247\u6bb5
  const shotSegments = scenes.map((scene, idx) =>
    buildShotSegment(scene, idx + 1, refs)
  );

  // 3. Tính toánThời gian\u8f74
  let timeOffset = 0;
  const totalDuration = shotSegments.reduce((sum, s) => sum + s.duration, 0);

  // 4. Chẳng hạn như\u679cNgười dùngĐã rồitay\u52a8Chỉnh sửa\u8fc7 mergedPrompt，Ưu tiênsử dụng
  if (group.mergedPrompt && group.mergedPrompt.trim()) {
    const dialogueSegs = enableLipSync ? extractDialogueSegments(scenes, characters) : [];
    return {
      prompt: group.mergedPrompt,
      charCount: group.mergedPrompt.length,
      overCharLimit: group.mergedPrompt.length > SEEDANCE_LIMITS.maxPromptChars,
      refs,
      shotSegments,
      dialogueSegments: dialogueSegs,
    };
  }

  // 4.5 AI \u6821\u51c6\u540ecủa prompt ưu tiên\u5728tay\u52a8Chỉnh sửa\u4e4b\u4e0b、nối tự động\u4e4b\u4e0a
  if (group.calibratedPrompt && group.calibrationStatus === 'done') {
    const dialogueSegs = enableLipSync ? extractDialogueSegments(scenes, characters) : [];
    return {
      prompt: group.calibratedPrompt,
      charCount: group.calibratedPrompt.length,
      overCharLimit: group.calibratedPrompt.length > SEEDANCE_LIMITS.maxPromptChars,
      refs,
      shotSegments,
      dialogueSegments: dialogueSegs,
    };
  }

  // 5. \u81ea\u52a8\u7ec4\u88c5 prompt（Tiếng Trung\u6a21\u677f）
  const promptParts: string[] = [];

  // Tiêu đềđược rồi
  if (gridImageRef) {
    promptParts.push(
      `Nhiều Cảnh quay tường thuậtVideo，Tài liệu tham khảo @Hình ảnh1 biểu đồ lưới（tổng cộng${scenes.length}Cảnh quay，Tổng Thời lượng${totalDuration}s）：`
    );
  } else {
    promptParts.push(
      `Nhiều Cảnh quay tường thuậtVideo（tổng cộng${scenes.length}Cảnh quay，Tổng Thời lượng${totalDuration}s）：`
    );
  }
  promptParts.push('');

  // \u5404Cảnh quayMô tả
  for (const seg of shotSegments) {
    const endTime = timeOffset + seg.duration;
    promptParts.push(
      `Cảnh quay${seg.shotIndex} [${timeOffset}s-${endTime}s]「${seg.sceneName}」：${seg.description}`
    );
    timeOffset = endTime;
  }

  // Nhân vật\u5f15sử dụng（Dựa trên purpose Tạo\u7cbe\u786e\u6307\u4ee4）
  const charRefLines = refs.images
    .filter(r => r.id.startsWith('char_'))
    .map(r => {
      const charId = r.id.replace('char_', '');
      const char = characters.find(c => c.id === charId);
      const hint = PURPOSE_PROMPT_MAP[r.purpose || 'character_ref'];
      return `${r.tag}（${char?.name || 'Nhân vật'}）${hint}`;
    });
  if (charRefLines.length > 0) {
    promptParts.push('');
    promptParts.push(`Nhân vậsự phản bội：${charRefLines.join('；')}`);
  }

  // Cảnh tham khảo
  const sceneRefLines = refs.images
    .filter(r => r.id.startsWith('scene_'))
    .map(r => {
      const hint = PURPOSE_PROMPT_MAP[r.purpose || 'scene_ref'];
      return `${r.tag} ${hint}`;
    });
  if (sceneRefLines.length > 0) {
    promptParts.push(`Cảnh tham khảo：${sceneRefLines.join('；')}`);
  }

  // Trích dẫn video
  if (refs.videos.length > 0) {
    const videoLines = refs.videos.map(r => {
      const hint = PURPOSE_PROMPT_MAP[r.purpose || 'camera_replicate'];
      return `${r.tag}（${r.fileName}）${hint}`;
    });
    promptParts.push(`VideoTài liệu tham khảo：${videoLines.join('；')}`);
  }

  // Âm thanh quote
  if (refs.audios.length > 0) {
    const audioRefLines = refs.audios.map(r => {
      const hint = PURPOSE_PROMPT_MAP[r.purpose || 'bgm'];
      return `${r.tag}（${r.fileName}）${hint}`;
    });
    promptParts.push(`Âm thanh tham khảo：${audioRefLines.join('；')}`);
  }

  // Âthiết kế m thanh（âm thanh xung quanh + Hiệu ứng âm thanh，\u6309Cảnh quayCột\u51fa）
  const audioDesignLines: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const aParts: string[] = [];
    if (s.audioAmbientEnabled !== false && s.ambientSound?.trim()) {
      aParts.push(`âm thanh xung quanh：${s.ambientSound.trim()}`);
    }
    const sfxText = s.soundEffectText?.trim();
    const sfxTags = s.soundEffects?.length ? s.soundEffects.join('、') : '';
    if (s.audioSfxEnabled !== false && (sfxText || sfxTags)) {
      aParts.push(`Hiệu ứng âm thanh：${sfxText || sfxTags}`);
    }
    if (aParts.length > 0) {
      audioDesignLines.push(`Cảnh quay${i + 1}：${aParts.join('；')}`);
    }
  }
  if (audioDesignLines.length > 0) {
    promptParts.push('');
    promptParts.push('Âthiết kế m thanh：');
    promptParts.push(...audioDesignLines);
  }

  // đối thoại\u5507\u5f62\u540c\u6b65
  const dialogueSegments = enableLipSync
    ? extractDialogueSegments(scenes, characters)
    : [];
  const dialoguePart = buildDialoguePromptPart(dialogueSegments);
  if (dialoguePart) {
    promptParts.push(dialoguePart);
  }

  // Phong cách（\u4e0dMột lần nữaLưu ý\u5165：\u6821\u51c6\u540ecủa\u5404Cảnh quay prompt Đã rồiChứa Phong cáchMô tả）

  // \u5bbd\u9ad8\u6bd4Gợi ý
  if (aspectRatio) {
    promptParts.push(`\u753b\u5e45：${aspectRatio}`);
  }

  // một\u81f4\u6027khoảng\u675f
  promptParts.push('');
  promptParts.push('Tất cảCảnh quaygiữNhân vậtBên ngoài\u89c2một\u81f4，Cảnh quay\u95f4\u5e73\u6ed1Chuyển tiếp，\u4e0d\u51fa\u73b0\u6587từhoặc\u6c34\u5370。');

  const prompt = promptParts.join('\n');

  return {
    prompt,
    charCount: prompt.length,
    overCharLimit: prompt.length > SEEDANCE_LIMITS.maxPromptChars,
    refs,
    shotSegments,
    dialogueSegments,
  };
}

// ==================== Extend / Edit Prompt Builder ====================

/**
 * mở rộng/Chỉnh sửachế độcủa prompt \u6784\u5efa\u5668
 *
 * với\u5e38\u89c4Nhiều Cảnh quay\u53d9\u4e8b\u4e0d\u540c：
 * - \u4e0d\u5efabiểu đồ lưới
 * - source video \u81ea\u52a8\u5360\u636e @Video1 \u4f4d
 * - prompt sử dụngmở rộng/Chỉnh sửa\u4e13sử dụng\u6a21\u677f
 */
function buildExtendEditPrompt(
  group: ShotGroup,
  scenes: SplitScene[],
  characters: Character[],
  sceneLibrary: Scene[],
  styleTokens?: string[],
): GroupPromptResult {
  // --- \u6536đặt\u5f15sử dụng（\u4e0d\u5efabiểu đồ lưới） ---
  // source video \u5360 @Video1，Người dùngTải lêncủa videoRefs từ @Video2 Bắt đầu
  const sourceVideoRef: AssetRef | null = group.sourceVideoUrl ? {
    id: 'source_video',
    type: 'video',
    tag: '@Video1',
    localUrl: group.sourceVideoUrl,
    httpUrl: group.sourceVideoUrl.startsWith('http') ? group.sourceVideoUrl : null,
    fileName: '\u6e90Video',
    fileSize: 0,
    duration: null,
    purpose: group.generationType === 'extend' ? 'video_extend' : 'video_edit_src',
  } : null;

  // Người dùng\u989dBên ngoàiTải lêncủaVideo/Âm thanh
  const userVideoRefs = (group.videoRefs || []).slice(0, sourceVideoRef ? SEEDANCE_LIMITS.maxVideos - 1 : SEEDANCE_LIMITS.maxVideos);
  const allVideoRefs = sourceVideoRef ? [sourceVideoRef, ...userVideoRefs] : userVideoRefs;
  const taggedVideos = allVideoRefs.map((ref, i) => ({ ...ref, tag: `@Video${i + 1}` }));

  const audioSlice = (group.audioRefs || []).slice(0, SEEDANCE_LIMITS.maxAudios);
  const taggedAudios = audioSlice.map((ref, i) => ({ ...ref, tag: `@Âm thanh${i + 1}` }));

  // Hình ảnh tham khảo（Nhân vậsự phản bội\u56fe + Người dùng\u989dBên ngoàiTải lên）
  const allCharIds = Array.from(new Set(scenes.flatMap(s => s.characterIds || [])));
  const charRefs = collectCharacterRefs(allCharIds, characters);
  const taggedImages = charRefs.slice(0, SEEDANCE_LIMITS.maxImages).map((ref, i) => ({ ...ref, tag: `@Hình ảnh${i + 1}` }));

  const totalFiles = taggedImages.length + taggedVideos.length + taggedAudios.length;
  const refs: CollectedRefs = {
    images: taggedImages,
    videos: taggedVideos,
    audios: taggedAudios,
    totalFiles,
    overLimit: totalFiles > SEEDANCE_LIMITS.maxTotalFiles,
    limitWarnings: totalFiles > SEEDANCE_LIMITS.maxTotalFiles ? [`Tổng Tệp\u6570 ${totalFiles} \u8d85\u51fa\u9650\u5236 ${SEEDANCE_LIMITS.maxTotalFiles}`] : [],
  };

  // --- \u6784\u5efa prompt ---
  // Người dùngManualChỉnh sửaƯu tiên
  if (group.mergedPrompt && group.mergedPrompt.trim()) {
    return {
      prompt: group.mergedPrompt,
      charCount: group.mergedPrompt.length,
      overCharLimit: group.mergedPrompt.length > SEEDANCE_LIMITS.maxPromptChars,
      refs,
      shotSegments: [],
      dialogueSegments: [],
    };
  }

  const promptParts: string[] = [];
  const genType = group.generationType || 'new';

  if (genType === 'extend') {
    // --- mở rộngchế độ ---
    const direction = group.extendDirection === 'forward' ? '\u5411\u524d' : '\u5411\u540e';
    const dur = group.totalDuration || 10;
    promptParts.push(`${direction}mở rộng${dur}sVideo。`);
  } else {
    // --- Chỉnh sửachế độ ---
    const editType = group.editType || 'plot_change';
    promptParts.push(EDIT_TYPE_TEMPLATE[editType]);
  }

  // Nhân vậsự phản bội\u6307\u4ee4
  if (taggedImages.length > 0) {
    const charRefHints = taggedImages
      .filter(r => r.id.startsWith('char_'))
      .map(r => {
        const charId = r.id.replace('char_', '');
        const char = characters.find(c => c.id === charId);
        return `Tài liệu tham khảo${r.tag}（${char?.name || 'Nhân vật'}）giữNhân vậtBên ngoài\u89c2một\u81f4`;
      });
    if (charRefHints.length > 0) {
      promptParts.push(charRefHints.join('；'));
    }
  }

  // Phong cách（\u4e0dMột lần nữaLưu ý\u5165：\u6821\u51c6\u540ecủa\u5404Cảnh quay prompt Đã rồiChứa Phong cáchMô tả）

  const prompt = promptParts.join('\n');

  return {
    prompt,
    charCount: prompt.length,
    overCharLimit: prompt.length > SEEDANCE_LIMITS.maxPromptChars,
    refs,
    shotSegments: [],
    dialogueSegments: [],
  };
}

/**
 * Nhanh\u901f\u9884\u4f30mộtmột\u7ec4của @\u5f15sử dụng\u6570\u91cf（\u4e0d\u6267được rồi\u5b8c\u6574\u6784\u5efa）
 */
export function estimateGroupRefs(
  group: ShotGroup,
  scenes: SplitScene[],
): { images: number; videos: number; audios: number; total: number } {
  const charIds = new Set(scenes.flatMap(s => s.characterIds || []));
  const sceneRefCount = scenes.filter(s => s.sceneReferenceImage || s.sceneLibraryId).length;
  const frameCount = scenes.filter(s => s.imageDataUrl || s.imageHttpUrl).length;

  const images = Math.min(frameCount + charIds.size + sceneRefCount, SEEDANCE_LIMITS.maxImages);
  const videos = Math.min((group.videoRefs || []).length, SEEDANCE_LIMITS.maxVideos);
  const audios = Math.min((group.audioRefs || []).length, SEEDANCE_LIMITS.maxAudios);

  return { images, videos, audios, total: images + videos + audios };
}
