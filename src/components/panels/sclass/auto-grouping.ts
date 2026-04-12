// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * auto-grouping.ts — lớp S\u667a\u80fd\u5206\u7ec4\u7b97\u6cd5
 *
 * \u5c06 director-store trongcủa SplitScene[] \u81ea\u52a8\u5206cho ShotGroup[]。
 * Chiến lược：
 *   1. theo thứ tự\u8d2a\u5fc3\u586b\u88c5，\u6bcfNhóm Tổng Thời lượng ≤ maxDuration（Mặc định15s）
 *   2. Cảnh chuyển đổiƯu tiên\u65ad\u5f00（\u4e0d\u540c sceneName Cảnh quayƯu tiên\u4e0d\u5728\u540cmột\u7ec4）
 *   3. Nhân vật\u91cd\u53e0\u5ea6\u9ad8Cảnh quayƯu tiên\u540c\u7ec4（characterIds \u4ea4đặt）
 *   4. \u6bcf\u7ec4 2~maxPerGroup Cảnh quay
 */

import type { SplitScene } from '@/stores/director-store';
import type { ShotGroup, SClassDuration } from '@/stores/sclass-store';

// ==================== Config ====================

export interface GroupingConfig {
  /** \u5355\u7ec4\u6700\u5927Thời lượng（giây），Mặc định 15 */
  maxDuration: number;
  /** \u5355\u7ec4\u6700\u5927Cảnh quay\u6570，Mặc định 4 */
  maxPerGroup: number;
  /** \u5355\u7ec4\u6700\u5c0fCảnh quay\u6570，Mặc định 1（\u6700\u540emột\u7ec4\u53ef\u80fdcho 1） */
  minPerGroup: number;
  /** Mặc địnhthấu kính đơn Thời lượng（\u5f53 scene.duration \u672aCài đặt\u65f6），Mặc định 5 */
  defaultSceneDuration: number;
}

const DEFAULT_CONFIG: GroupingConfig = {
  maxDuration: 15,
  maxPerGroup: 4,
  minPerGroup: 1,
  defaultSceneDuration: 5,
};

// ==================== Helpers ====================

/** \u83b7\u53d6Tiến sĩ đơnân cảnhCó\u6548Thời lượng */
function getSceneDuration(scene: SplitScene, defaultDuration: number): number {
  return scene.duration > 0 ? scene.duration : defaultDuration;
}

/** Tính toán\u4e24Cảnh quayNhân vật\u91cd\u53e0\u5ea6 (0~1) */
function characterOverlap(a: SplitScene, b: SplitScene): number {
  if (!a.characterIds?.length || !b.characterIds?.length) return 0;
  const setA = new Set(a.characterIds);
  const intersection = b.characterIds.filter((id) => setA.has(id));
  const union = new Set([...a.characterIds, ...b.characterIds]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

/** \u5224\u65ad\u4e24Cảnh quay\u662f\u5426\u540cCảnh */
function isSameScene(a: SplitScene, b: SplitScene): boolean {
  // sử dụng sceneName \u5224\u65ad，\u7a7a\u503c\u89c6cho\u540cCảnh
  if (!a.sceneName && !b.sceneName) return true;
  return a.sceneName === b.sceneName;
}

/** Tạo\u552fmột ID */
function genId(): string {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ==================== Core Algorithm ====================

/**
 * \u5bf9 SplitScene[] \u6267được rồi\u81ea\u52a8\u5206\u7ec4
 *
 * @returns ShotGroup[] — \u6bcf\u7ec4chứa sceneIds、totalDuration Đợi đã
 */
export function autoGroupScenes(
  scenes: SplitScene[],
  config: Partial<GroupingConfig> = {},
): ShotGroup[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (scenes.length === 0) return [];

  const groups: ShotGroup[] = [];
  let currentSceneIds: number[] = [];
  let currentDuration = 0;

  const flush = () => {
    if (currentSceneIds.length === 0) return;
    const dur = Math.round(Math.min(Math.max(currentDuration, 4), 15)) as SClassDuration;
    groups.push({
      id: genId(),
      name: `Không.${groups.length + 1}\u7ec4`,
      sceneIds: [...currentSceneIds],
      totalDuration: dur,
      imageRefs: [],
      videoRefs: [],
      audioRefs: [],
      mergedPrompt: '',
      videoUrl: null,
      videoMediaId: null,
      videoStatus: 'idle',
      videoProgress: 0,
      videoError: null,
      history: [],
      sortIndex: groups.length,
      gridImageUrl: null,
      lastPrompt: null,
    });
    currentSceneIds = [];
    currentDuration = 0;
  };

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const dur = getSceneDuration(scene, cfg.defaultSceneDuration);

    // \u51b3\u5b9a\u662f\u5426\u9700\u8981\u5728\u6b64\u5904\u65ad\u5f00\u65b0\u7ec4
    let shouldBreak = false;

    if (currentSceneIds.length >= cfg.maxPerGroup) {
      // Đã rồi\u6ee1
      shouldBreak = true;
    } else if (currentDuration + dur > cfg.maxDuration && currentSceneIds.length > 0) {
      // \u52a0\u5165\u540e\u8d85Thời lượng\u4e0a\u9650
      shouldBreak = true;
    } else if (currentSceneIds.length > 0) {
      // Cảnh chuyển đổiPhát hiện：\u4e0d\u540cCảnh ưu tiên\u65ad\u5f00
      const prevScene = scenes[i - 1];
      if (prevScene && !isSameScene(prevScene, scene)) {
        // \u4e0d\u540cCảnh —— Chẳng hạn như\u679chiện tại\u7ec4Đã rồiCó ≥ minPerGroup Cảnh quay，\u65ad\u5f00
        if (currentSceneIds.length >= cfg.minPerGroup) {
          // \u4f46\u82e5Nhân vật\u9ad8\u5ea6\u91cd\u53e0，\u53ef\u4ee5\u5bb9\u5fcd（\u8de8Cảnh\u4f46\u540cNhân vật）
          const overlap = characterOverlap(prevScene, scene);
          if (overlap < 0.5) {
            shouldBreak = true;
          }
        }
      }
    }

    if (shouldBreak) {
      flush();
    }

    currentSceneIds.push(scene.id);
    currentDuration += dur;
  }

  // \u6700\u540emột\u7ec4
  flush();

  return groups;
}

/**
 * \u91cd\u65b0Tính toánNhóm Tổng Thời lượng
 */
export function recalcGroupDuration(
  group: ShotGroup,
  scenes: SplitScene[],
  defaultDuration = 5,
): number {
  const sceneMap = new Map(scenes.map((s) => [s.id, s]));
  let total = 0;
  for (const id of group.sceneIds) {
    const s = sceneMap.get(id);
    total += s ? getSceneDuration(s, defaultDuration) : defaultDuration;
  }
  return total;
}

/**
 * choNhóm TạoMặc địnhTên
 */
export function generateGroupName(
  group: ShotGroup,
  scenes: SplitScene[],
  groupIndex: number,
): string {
  if (group.sceneIds.length === 0) return `Không.${groupIndex + 1}\u7ec4`;

  // \u5c1d\u8bd5Sử dụng Cảnh tên
  const sceneMap = new Map(scenes.map((s) => [s.id, s]));
  const firstScene = sceneMap.get(group.sceneIds[0]);

  // sử dụng\u7ec4bên trong\u987a\u5e8f\u7f16\u53f7（\u800c\u975e scene.id），\u907f\u514d 1-based ID \u5bfc\u81f4\u504f\u79fb
  const allIds = scenes.map(s => s.id);
  const firstIdx = allIds.indexOf(group.sceneIds[0]);
  const lastIdx = allIds.indexOf(group.sceneIds[group.sceneIds.length - 1]);
  const firstNum = firstIdx >= 0 ? firstIdx + 1 : 1;
  const lastNum = lastIdx >= 0 ? lastIdx + 1 : firstNum + group.sceneIds.length - 1;

  if (firstScene?.sceneName) {
    return `${firstScene.sceneName} (Cảnh quay${firstNum}-${lastNum})`;
  }

  return `Không.${groupIndex + 1}\u7ec4: Cảnh quay${firstNum}-${lastNum}`;
}
