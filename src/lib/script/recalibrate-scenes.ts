// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Dich vu hieu chinh lai phan canh khi doi phong cach.
 *
 * Khi nguoi dung doi style trong Director/Storyboard panel, he thong se chay lai
 * quy trinh hieu chuan 5 giai doan (calibrateShotsMultiStage) de cap nhat prompt/tham so,
 * dong thoi giu nguyen anh/video URL da tao truoc do.
 */

import type { SplitScene } from '@/stores/director-store';
import { useScriptStore } from '@/stores/script-store';
import { calibrateShotsMultiStage, type ShotInputData, type GlobalContext, type CalibrationOptions } from './shot-calibration-stages';

/**
 * Chuyen SplitScene[] sang ShotInputData[].
 * Tai su dung logic mapping tu calibrateEpisodeShots.
 */
function toShotInputData(scenes: SplitScene[]): ShotInputData[] {
  return scenes.map(scene => {
    let sourceText = scene.actionSummary || '';
    if (scene.dialogue) {
      sourceText += `\nĐối thoại: "${scene.dialogue}"`;
    }
    return {
      shotId: scene.id.toString(),
      sourceText,
      actionSummary: scene.actionSummary || '',
      dialogue: scene.dialogue || '',
      characterNames: [],  // SplitScene khong co danh sach ten nhan vat day du
      sceneLocation: scene.sceneLocation || '',
      sceneAtmosphere: '',
      sceneTime: 'day',
      sceneWeather: '',
      // Cac truong duoi day khong lay truc tiep tu SplitScene, nen de rong
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
  
  // Tim du an script dang active
  const projectId = scriptProjectId || store.activeProjectId;
  const project = projectId ? store.projects[projectId] : null;
  
  if (!project) {
    // Khong tim thay du an: tra ve context toi thieu
    return {
      title: 'Không tên dự án',
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
    title: background?.title || scriptData?.title || 'Không tên kịch bản',
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
 * Ghi ket qua hieu chuan tro lai SplitScene.
 * Giu nguyen image/video URL da co.
 */
function applyCalibrationToScene(
  scene: SplitScene,
  calibration: Record<string, any>,
): SplitScene {
  return {
    ...scene,
    // Truong tuong thuat
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
    // Thiet ke tuong thuat
    narrativeFunction: calibration.narrativeFunction || scene.narrativeFunction,
    shotPurpose: calibration.shotPurpose || scene.shotPurpose,
    visualFocus: calibration.visualFocus || scene.visualFocus,
    cameraPosition: calibration.cameraPosition || scene.cameraPosition,
    characterBlocking: calibration.characterBlocking || scene.characterBlocking,
    rhythm: calibration.rhythm || scene.rhythm,
    // Kiem soat quay/chup
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
 * Hieu chinh lai tat ca phan canh bang style moi.
 *
 * @param newStyleId ID style moi
 * @param splitScenes Danh sach phan canh hien tai
 * @param scriptProjectId ID du an script (mac dinh lay active project)
 * @param onProgress Callback tien do
 * @returns Danh sach SplitScene da hieu chinh
 * @throws Nem loi khi hieu chinh that bai
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

  onProgress?.(0, totalScenes, 'Dang hieu chinh phan canh theo phong cach moi...');

  const calibrations = await calibrateShotsMultiStage(
    shotInputs,
    calibrationOptions,
    globalContext,
    (stage, total, name) => {
      onProgress?.(0, totalScenes, `Stage ${stage}/${total}: ${name}`);
    },
  );

  // 4. Ghi ket qua hieu chinh lai vao SplitScene
  let calibratedCount = 0;
  const updatedScenes = splitScenes.map(scene => {
    const calibration = calibrations[scene.id.toString()];
    if (calibration) {
      calibratedCount++;
      return applyCalibrationToScene(scene, calibration);
    }
    return scene;
  });

  onProgress?.(calibratedCount, totalScenes, `Da hieu chinh ${calibratedCount}/${totalScenes} phan canh`);

  return {
    scenes: updatedScenes,
    calibratedCount,
    totalScenes,
  };
}
