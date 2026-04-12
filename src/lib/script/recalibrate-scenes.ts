// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Phong cádịch vụ hiệu chỉnh lại switch ch
 * 
 * Khi Người dùng đang chỉ đạo/Bảng điều khiển chuyển mạch trực quan S-class Phong cákhi ch，Tách SplitScene hiện có[] nạp lại
 * Quy trình hiệu chuẩn 5 giai đoạn（calibrateShotsMultiStage），Sử dụng Phong c mớiách ghi đè Nhắc và lấy Tham số，
 * Cũng giữ chữ Tạo Hình ảnh/URL video không thay đổi。
 */

import type { SplitScene } from '@/stores/director-store';
import { useScriptStore } from '@/stores/script-store';
import { calibrateShotsMultiStage, type ShotInputData, type GlobalContext, type CalibrationOptions } from './shot-calibration-stages';

/**
 * Tách cảnh[] Chuyển đổi sang ShotInputData[] Định dạng
 * （Tái sử dụng logic ánh xạ của calibrateEpisodeShots）
 */
function toShotInputData(scenes: SplitScene[]): ShotInputData[] {
  return scenes.map(scene => {
    let sourceText = scene.actionSummary || '';
    if (scene.dialogue) {
      sourceText += `\đối thoại：「${scene.dialogue}」`;
    }
    return {
      shotId: scene.id.toString(),
      sourceText,
      actionSummary: scene.actionSummary || '',
      dialogue: scene.dialogue || '',
      characterNames: [],  // SplitScene không có tên nhân vật，Nhưng có các ký tự
      sceneLocation: scene.sceneLocation || '',
      sceneAtmosphere: '',
      sceneTime: 'day',
      sceneWeather: '',
      // Các trường này không thể lấy được từ SplitScene，Truyền chuỗi trống（Giai đoạn 3 chỉ mang tính chất tham khảo）
      architectureStyle: '',
      colorPalette: '',
      eraDetails: '',
      lightingDesign: '',
      currentShotSize: scene.shotSize || undefined,
      currentCameraMovement: scene.cameraMovement || undefined,
      currentDuration: scene.duration,
    };
  });
}

/**
 * Xây dựng GlobalContext từ kho tập lệnh
 */
function buildGlobalContext(scriptProjectId?: string): GlobalContext {
  const store = useScriptStore.getState();
  
  // Tìm dự án tập lệnh đang hoạt động
  const projectId = scriptProjectId || store.activeProjectId;
  const project = projectId ? store.projects[projectId] : null;
  
  if (!project) {
    // Hãy ghi nhớ mọi thứ：Quay lạtôi đã giảm thiểu bối cảnh
    return {
      title: 'Không tênDự án',
      outline: '',
      characterBios: '',
      episodeTitle: '',
    };
  }

  const background = project.projectBackground;
  const episodeScript = project.episodeRawScripts[0]; // Mặc định lấy tập đầu tiên
  const scriptData = project.scriptData;
  const episode = scriptData?.episodes?.[0];

  return {
    title: background?.title || scriptData?.title || 'Không tênKịch bản',
    genre: background?.genre || '',
    era: background?.era || '',
    outline: background?.outline || '',
    characterBios: background?.characterBios || '',
    worldSetting: background?.worldSetting || '',
    themes: background?.themes || [],
    episodeTitle: episode?.title || episodeScript?.title || '',
    episodeSynopsis: episodeScript?.synopsis || '',
    episodeKeyEvents: episodeScript?.keyEvents || [],
    episodeRawContent: episodeScript?.rawContent || '',
    episodeSeason: episodeScript?.season,
    totalEpisodes: project.episodeRawScripts.length || undefined,
    currentEpisode: episodeScript?.episodeIndex || 1,
  };
}

/**
 * Ghi kết quả hiệu chuẩn trở lại SplitScene（Căn chỉÁnh xạ của nh full-script-service.ts:1265-1305）
 * Đã đặt trướcạo Hình ảnh/URL video không thay đổi
 */
function applyCalibrationToScene(
  scene: SplitScene,
  calibration: Record<string, any>,
): SplitScene {
  return {
    ...scene,
    // bộ xương tường thuật
    visualDescription: calibration.visualDescription || scene.visualDescription,
    shotSize: calibration.shotSize || scene.shotSize,
    cameraMovement: calibration.cameraMovement || scene.cameraMovement,
    duration: calibration.duration || scene.duration,
    emotionTags: calibration.emotionTags || scene.emotionTags,
    ambientSound: calibration.ambientSound || scene.ambientSound,
    // Prompt
    imagePrompt: calibration.imagePrompt || scene.imagePrompt,
    imagePromptZh: calibration.imagePromptZh || scene.imagePromptZh,
    videoPrompt: calibration.videoPrompt || scene.videoPrompt,
    videoPromptZh: calibration.videoPromptZh || scene.videoPromptZh,
    endFramePrompt: calibration.endFramePrompt || scene.endFramePrompt,
    endFramePromptZh: calibration.endFramePromptZh || scene.endFramePromptZh,
    needsEndFrame: calibration.needsEndFrame ?? scene.needsEndFrame,
    // thiết kế tường thuật
    narrativeFunction: calibration.narrativeFunction || scene.narrativeFunction,
    shotPurpose: calibration.shotPurpose || scene.shotPurpose,
    visualFocus: calibration.visualFocus || scene.visualFocus,
    cameraPosition: calibration.cameraPosition || scene.cameraPosition,
    characterBlocking: calibration.characterBlocking || scene.characterBlocking,
    rhythm: calibration.rhythm || scene.rhythm,
    // Kiểm soát chụp
    lightingStyle: calibration.lightingStyle || scene.lightingStyle,
    lightingDirection: calibration.lightingDirection || scene.lightingDirection,
    colorTemperature: calibration.colorTemperature || scene.colorTemperature,
    lightingNotes: calibration.lightingNotes || scene.lightingNotes,
    depthOfField: calibration.depthOfField || scene.depthOfField,
    focusTarget: calibration.focusTarget || scene.focusTarget,
    focusTransition: calibration.focusTransition || scene.focusTransition,
    cameraRig: calibration.cameraRig || scene.cameraRig,
    movementSpeed: calibration.movementSpeed || scene.movementSpeed,
    atmosphericEffects: calibration.atmosphericEffects || scene.atmosphericEffects,
    effectIntensity: calibration.effectIntensity || scene.effectIntensity,
    playbackSpeed: calibration.playbackSpeed || scene.playbackSpeed,
    cameraAngle: calibration.cameraAngle || scene.cameraAngle,
    focalLength: calibration.focalLength || scene.focalLength,
    photographyTechnique: calibration.photographyTechnique || scene.photographyTechnique,
    specialTechnique: calibration.specialTechnique || scene.specialTechnique,
  };
}

export interface RecalibrationResult {
  scenes: SplitScene[];
  calibratedCount: number;
  totalScenes: number;
}

/**
 * Sử dụng Phong c mớiách Hiệu chỉnh lạiTất cảPhân cảnh
 * 
 * @param newStyleId hình ảnh mới Phong cách ID
 * @thông số SplitScenes hiện tại Phân cảnh danh sách
 * @param scriptProjectId dự án lưu trữ tập lệnh tùy chọnId（Mặc định sử dụng active Dự án）
 * @param onProgress Tiến độgọi lại
 * @trả về SplitScene đã hiệu chỉnh[]（Người gọi có trách nhiệm viết thư cho cửa hàng）
 * @ném hiệu chuẩn Thất bạNgoại lệ được ném khi tôi（Người gọi có trách nhiệm thu thập và giữ lại Tr gốcạng thátôi vẫn không thay đổi）
 */
export async function recalibrateSplitScenes(
  newStyleId: string,
  splitScenes: SplitScene[],
  scriptProjectId?: string,
  onProgress?: (current: number, total: number, message: string) => void,
): Promise<RecalibrationResult> {
  const totalScenes = splitScenes.length;
  if (totalScenes === 0) {
    return { scenes: [], calibratedCount: 0, totalScenes: 0 };
  }

  onProgress?.(0, totalScenes, 'Chuẩn bị hiệu chỉnh lại...');

  // 1. SplitScene → ShotInputData
  const shotInputs = toShotInputData(splitScenes);

  // 2. Xây dựng bối cảnh toàn cầu
  const globalContext = buildGlobalContext(scriptProjectId);

  // 3. Gọi hiệu chuẩn 5 giai đoạn
  const calibrationOptions: CalibrationOptions = {
    styleId: newStyleId,
  };

  onProgress?.(0, totalScenes, 'Sử dụng Phong c mớiách hiệu chuẩn Phân cảnh...');

  const calibrations = await calibrateShotsMultiStage(
    shotInputs,
    calibrationOptions,
    globalContext,
    (stage, total, name) => {
      onProgress?.(0, totalScenes, `Stage ${stage}/${total}: ${name}`);
    },
  );

  // 4. Ghi kết qu��� hiệu chỉnh lại vào SplitScene
  let calibratedCount = 0;
  const updatedScenes = splitScenes.map(scene => {
    const calibration = calibrations[scene.id.toString()];
    if (calibration) {
      calibratedCount++;
      return applyCalibrationToScene(scene, calibration);
    }
    return scene;
  });

  onProgress?.(calibratedCount, totalScenes, `đã hiệu chuẩn ${calibratedCount}/${totalScenes} Phân cảnh`);

  return {
    scenes: updatedScenes,
    calibratedCount,
    totalScenes,
  };
}
