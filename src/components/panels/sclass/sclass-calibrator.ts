// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.

/**
 * lớp S「cấp độ nhóm AI \u6821\u51c6」cốt lõi\u6a21\u5757
 *
 * chức năng：
 * 1. \u8bfb\u53d6\u7ec4bên trong\u5404 SplitScene \u6570\u636e（\u53ea\u8bfb，Khôngửa director-store）
 * 2. \u8c03sử dụng LLM Tạovòng kể chuyện nhóm、Cảnh quayChuyển tiếp、Âthiết kế m thanh、\u4f18\u5316 prompt
 * 3. \u5199\u5165 sclass-store của ShotGroup \u6821\u51c6từ\u6bb5
 *
 * \u6570\u636e\u5b89\u5168：
 * - \u53ea\u8bfb director-store，không\u6c61\u67d3K gốcịch bảdữ liệu
 * - \u4ea7\u7269\u53ea\u5199 sclass-store.ShotGroup của\u6821\u51c6từ\u6bb5
 */

import type { SplitScene } from '@/stores/director-store';
import type { ShotGroup } from '@/stores/sclass-store';
import type { Character } from '@/stores/character-library-store';
import type { Scene } from '@/stores/scene-store';
import { callFeatureAPI } from '@/lib/ai/feature-router';
import { useSClassStore } from '@/stores/sclass-store';

// ==================== LoạiĐịnh nghĩa ====================

/** \u6821\u51c6\u4ea7\u7269（AI Đầu rcủa một 4 \u9879cấp độ nhóm\u4f18\u5316\u6570\u636e） */
export interface CalibrationResult {
  /** vòng kể chuyện nhómMô tả */
  narrativeArc: string;
  /** Cảnh quay phòng Chuyển tiếlệnh p（chiều dài = scenes.length - 1） */
  transitions: string[];
  /** cấp độ nhómÂthiết kế m thanh（Toàn bộ kế hoạch của thập niên 15） */
  groupAudioDesign: string;
  /** AI \u4f18\u5316\u540ecủacấp độ nhóm prompt */
  calibratedPrompt: string;
}

// ==================== bên trong\u90e8\u5de5\u5177 ====================

/**
 * từ SplitScene Trích xuấtTóm tắtthông tin（sử dụng\u4e8e\u6784\u5efa AI Đầu vào，\u4e0d\u6cc4\u6f0f\u591a\u4f59từ\u6bb5）
 */
function summarizeScene(scene: SplitScene, characters: Character[]): string {
  const charNames = (scene.characterIds || [])
    .map(id => characters.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join('、');

  const parts: string[] = [];
  parts.push(`Cảnh：${scene.sceneName || 'Chưa đặt tên'}`);
  if (scene.sceneLocation) parts.push(`vị trí：${scene.sceneLocation}`);
  parts.push(`Thời lượng：${scene.duration || 5}s`);
  if (charNames) parts.push(`Nhân vật：${charNames}`);
  if (scene.actionSummary) parts.push(`Hành động：${scene.actionSummary}`);
  if (scene.cameraMovement) parts.push(`\u8fd0\u955c：${scene.cameraMovement}`);
  if (scene.dialogue) parts.push(`đối thoại：${scene.dialogue}`);
  if (scene.ambientSound) parts.push(`âm thanh xung quanh：${scene.ambientSound}`);
  if (scene.soundEffectText) parts.push(`Hiệu ứng âm thanh：${scene.soundEffectText}`);
  if (scene.emotionTags?.length) parts.push(`cảm xúc：${scene.emotionTags.join('、')}`);
  if (scene.narrativeFunction) parts.push(`chức năng tường thuật：${scene.narrativeFunction}`);

  return parts.join('\n  ');
}

// ==================== chức năng cốt lõi ====================

/**
 * \u6821\u51c6\u5355một\u7ec4
 *
 * @param group       Đích\u7ec4（\u53ea\u8bfb sceneIds）
 * @param scenes      \u7ec4bên trong SplitScene[]（\u53ea\u8bfb，\u6765\u81ea director-store）
 * @param characters  Thư viện nhân vật（cho Tênmap）
 * @param sceneLibrary Thư viện cảnh（dự phòng\u4e0a\u4e0b\u6587）
 * @returns CalibrationResult
 */
export async function calibrateGroup(
  group: ShotGroup,
  scenes: SplitScene[],
  characters: Character[],
  _sceneLibrary: Scene[],
): Promise<CalibrationResult> {
  if (scenes.length === 0) {
    throw new Error('\u7ec4bên trongKhông Cảnh quay，Không thể hiệu chỉnh');
  }

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 5), 0);

  // ---- \u6784\u5efaĐầu vào ----
  const sceneSummaries = scenes.map((s, i) =>
    `【Cảnh quay${i + 1}】\n  ${summarizeScene(s, characters)}`
  ).join('\n\n');

  const systemPrompt = `\u4f60\u662fmột\u4f4d\u8d44\u6df1\u7535\u5f71giám đốc\u517c\u526a\u8f91phép chia，\u64c5\u957fNhiều Cảnh quay tường thuậtVideocủa\u8282\u594f\u628a\u63a7và\u53d9\u4e8b\u8fde\u8d2f\u6027\u4f18\u5316。

【cốt lõikhoảng\u675f — \u4e25\u683c\u6267được rồi】
1. \u4e25\u683cDựa trên\u4ee5\u4e0bCảnh quay\u6570\u636e，\u4e0d\u5f97ThêmKịch bảntrong\u4e0d\u5b58\u5728Nhân vật、Cảnhhoặcđối thoại。
2. \u53ea\u505a\u53d9\u4e8b\u8fde\u8d2f\u4f18\u5316vàChuyển tiếp\u8bbe\u8ba1，Đừng thay đổi\u5404Cảnh quaycủacốt lõibên trong\u5bb9vàcảm xúgiai điệu c。
3. \u4fdd\u7559Mọi Cảnh quaycủa\u539fCó\u8fd0\u955cvàHành độthiết kế，\u53ea\u5728Cảnh quay\u8854\u63a5\u5904\u589e\u52a0Chuyển tiếlệnh p。
4. Âthiết kế m thanh\u5fc5\u987bDựa trên\u5404Cảnh quayĐã rồiCócủaâm thanh xung quanh/Hiệu ứng âm thanhthông tin，\u4e0d\u51ed\u7a7a\u521b\u9020\u65b0\u97f3\u6e90。
5. calibratedPrompt \u662f\u5bf9Tất cảCảnh quaycủa\u6574\u5408\u91cd\u5199，phải chứaMọi Cảnh quaycủacốt lõithông tin，\u4e0d\u9057\u6f0f。

Vui lòng sử dụng JSON Định dạngQuay lại，\u4e0d\u8981Có\u4efb\u4f55\u89e3\u91ca\u6587từ。`;

  const userPrompt = `【\u7ec4thông tin】
Tên nhóm：${group.name}
Cảnh quay\u6570：${scenes.length}
Tổng Thời lượng：${totalDuration}s

${sceneSummaries}

\u8bf7Đầu ra\u4ee5\u4e0b JSON：
{
  "narrativeArc": "sử dụngmột\u53e5\u8bddMô tả\u8fd9\u7ec4Cảnh quaycủa\u53d9\u4e8b\u5f27\u7ebf（\u8d77\u627f\u8f6c\u5408）",
  "transitions": [
    "Cảnh quay1→Cảnh quay2 Chuyển tiếlệnh p（Chẳng hạn như：bức tranh\u6eb6\u89e3、\u786c\u5207、\u58f0\u6865Chuyển tiếpĐợi đã）"
  ],
  "groupAudioDesign": "\u6574\u6bb5 ${totalDuration}s củaÂthiết kế m thanh\u89c4\u5212（âm thanh xung quanh\u5c42lần、Hiệu ứng âm thanh thời gian\u673a、cảm xúc\u66f2\u7ebf）",
  "calibratedPrompt": "\u6574\u5408\u4f18\u5316\u540ecủa\u5b8c\u6574cấp độ nhómPrompt，Tiếng Trung，sử dụng\u4e8e Seedance 2.0 Nhiều Cảnh quaynarrativeVideoTạo"
}

transitions \u6570\u7ec4chiều dài\u5fc5\u987bcho ${scenes.length - 1}（\u6bcf\u4e24một\u76f8\u90bbCảnh quay\u4e4b\u95f4một\u6761）。
calibratedPrompt \u5fc5\u987b\u8986\u76d6Tất cả ${scenes.length} Cảnh quay，giữCảnh quay\u7f16\u53f7vàThời gian\u8f74。`;

  // ---- \u8c03sử dụng LLM ----
  const raw = await callFeatureAPI('script_analysis', systemPrompt, userPrompt, {
    temperature: 0.3, // \u4f4e\u6e29\u5ea6\u786e\u4fdd\u7a33\u5b9aĐầu ra
    maxTokens: 4096,
  });

  // ---- Phân tích cú pháp JSON ----
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI Quay lạtôi là Phân tích cú pháp JSON Thất bại，Xin vui lòng Thử lại');
  }

  // ---- \u6821\u9a8c & \u5bb9\u9519 ----
  const result: CalibrationResult = {
    narrativeArc: typeof parsed.narrativeArc === 'string' ? parsed.narrativeArc : '',
    transitions: Array.isArray(parsed.transitions) ? parsed.transitions.map(String) : [],
    groupAudioDesign: typeof parsed.groupAudioDesign === 'string' ? parsed.groupAudioDesign : '',
    calibratedPrompt: typeof parsed.calibratedPrompt === 'string' ? parsed.calibratedPrompt : '',
  };

  // transitions chiều dài\u4fee\u6b63
  const expectedLen = Math.max(scenes.length - 1, 0);
  if (result.transitions.length > expectedLen) {
    result.transitions = result.transitions.slice(0, expectedLen);
  }
  while (result.transitions.length < expectedLen) {
    result.transitions.push('tự nhiênChuyển tiếp');
  }

  if (!result.calibratedPrompt) {
    throw new Error('AI \u672aQuay lạiCó\u6548của calibratedPrompt');
  }

  return result;
}

// ==================== Store \u5199\u5165 ====================

/**
 * \u6267được rồi\u6821\u51c6\u5e76\u5199\u5165 store
 *
 * Đây là UI \u5c42\u5e94\u8be5\u8c03sử dụngcủalối vào。Quy trình Trạng tháiCập nhậtvàLỗi。
 */
export async function runCalibration(
  groupId: string,
  scenes: SplitScene[],
  characters: Character[],
  sceneLibrary: Scene[],
): Promise<boolean> {
  const store = useSClassStore.getState();
  const projectData = store.activeProjectId
    ? store.getProjectData(store.activeProjectId)
    : null;
  const group = projectData?.shotGroups.find(g => g.id === groupId);
  if (!group) {
    console.error('[SClassCalibrator] \u627e\u4e0dĐến\u7ec4:', groupId);
    return false;
  }

  // \u6807\u8bb0\u6821\u51c6trong
  store.updateShotGroup(groupId, {
    calibrationStatus: 'calibrating',
    calibrationError: null,
  });

  try {
    const result = await calibrateGroup(group, scenes, characters, sceneLibrary);

    // \u5199\u5165\u6821\u51c6\u4ea7\u7269
    store.updateShotGroup(groupId, {
      narrativeArc: result.narrativeArc,
      transitions: result.transitions,
      groupAudioDesign: result.groupAudioDesign,
      calibratedPrompt: result.calibratedPrompt,
      calibrationStatus: 'done',
      calibrationError: null,
    });

    console.log(`[SClassCalibrator] ✅ \u7ec4「${group.name}」\u6821\u51c6Hoàn thành`);
    return true;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[SClassCalibrator] ❌ \u7ec4「${group.name}」Hiệu chỉnh Thất bại:`, errMsg);

    store.updateShotGroup(groupId, {
      calibrationStatus: 'failed',
      calibrationError: errMsg,
    });

    return false;
  }
}

/**
 * lô\u91cf\u6821\u51c6Tất cả\u672a\u6821\u51c6của\u7ec4
 *
 * @returns Thành công\u6570 / \u603b\u6570
 */
export async function runBatchCalibration(
  scenes: SplitScene[],
  characters: Character[],
  sceneLibrary: Scene[],
): Promise<{ success: number; total: number }> {
  const store = useSClassStore.getState();
  const projectData = store.activeProjectId
    ? store.getProjectData(store.activeProjectId)
    : null;

  if (!projectData) return { success: 0, total: 0 };

  // \u7b5b\u9009\u9700\u8981\u6821\u51c6của\u7ec4（\u672a\u6821\u51c6 hoặc Hiệu chỉnh Thất bại）
  const groups = projectData.shotGroups.filter(g =>
    !g.calibrationStatus || g.calibrationStatus === 'idle' || g.calibrationStatus === 'failed'
  );

  let success = 0;
  for (const group of groups) {
    const groupScenes = scenes.filter(s => group.sceneIds.includes(s.id));
    if (groupScenes.length === 0) continue;

    const ok = await runCalibration(group.id, groupScenes, characters, sceneLibrary);
    if (ok) success++;
  }

  return { success, total: groups.length };
}
