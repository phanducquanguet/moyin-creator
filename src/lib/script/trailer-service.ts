// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Dịch vụ Trailer - AI Trailer Phân cảdịch vụ tuyển chọn nh
 * 
 * chức năng：Từ Ph hiện cóân cảLựa chọn phím Ph thông minh trong nhân cảnh，TạoTrailer
 * Tiêu chí lựa chọn：
 * - Chức năng tường thuật là"đỉnh điểm/bước ngoặt"ưu tiên
 * - Ưu tiên người có cảm xúc mạnh
 * - C có tác động trực quanảnh ưu tiên
 * - Key Nhân vật xuất hiện đầu tiên
 */

import type { Shot, ProjectBackground } from '@/types/script';
import type { SplitScene, TrailerDuration } from '@/stores/director-store';
import { callFeatureAPI } from '@/lib/ai/feature-router';

// Thời lượPh tương ứng với ngân cảnh số lượng
const DURATION_TO_SHOT_COUNT: Record<TrailerDuration, number> = {
  10: 2,   // 10 giây：2-3 phân cảnh
  30: 6,   // 30 giây：5-6 độân cảnh
  60: 12,  // 1 phút：10-12 giờân cảnh
};

/** @không được dùng nữa không cần phải chuyển thủ công nữa，Tự động thu được từ bản đồ dịch vụ */
export interface TrailerGenerationOptions {
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
}

export interface TrailerGenerationResult {
  success: boolean;
  selectedShots: Shot[];
  shotIds: string[];
  error?: string;
}

/**
 * Đoạn giới thiệu AI Picks Phân cảnh
 * 
 * @param shots Tất cảPh có sẵnân cảnh
 * @param background Dự ánNềthông tin
 * @đoạn giới thiệu thời lượng thông số Thời lượng
 * @cấu hình API tùy chọn param
 */
export async function selectTrailerShots(
  shots: Shot[],
  background: ProjectBackground | null,
  duration: TrailerDuration,
  _options?: TrailerGenerationOptions // không còn cần thiết nữa，dành riêng cho khả năng tương thích
): Promise<TrailerGenerationResult> {
  if (shots.length === 0) {
    return {
      success: false,
      selectedShots: [],
      shotIds: [],
      error: 'Không có Phân cảnh',
    };
  }

  const targetCount = DURATION_TO_SHOT_COUNT[duration];
  
  // Nếu Phân cảnh số lượng ít hơnĐích số lượng，Quay trực tiếp lạiTất cảPhân cảnh
  if (shots.length <= targetCount) {
    return {
      success: true,
      selectedShots: shots,
      shotIds: shots.map(s => s.id),
    };
  }

  try {
    // xây dựng tiến sĩân cảnh tóm tắt cho AI Phân tích
    const shotSummaries = shots.map((shot, index) => ({
      index: index + 1,
      id: shot.id,
      episodeId: shot.episodeId,
      actionSummary: shot.actionSummary || '',
      visualDescription: shot.visualDescription || '',
      dialogue: shot.dialogue || '',
      characterNames: shot.characterNames || [],
      narrativeFunction: (shot as any).narrativeFunction || '',
      emotionTags: (shot as any).emotionTags || [],
      shotSize: shot.shotSize || '',
    }));

    const systemPrompt = `Bạn là người biên tập trailer phim chuyên nghiệp，Giỏi lựa chọn C hấp dẫn nhất từ ​​một số lượng lớn vật liệuảnh quay để làm trailer。

Nhiệm vụ của bạn là bắt đầu từ Ph đã choân cảChọn trailer phù hợp nhất từ danh sách nh ${targetCount} Phân cảnh。

【Nguyên tắc cấu trúc trailer】
1. **khai mạc**：Tạo bầu không khí，Thu hút Lưu ý（1-2 Cảnh quay）
2. **Xung đột leo thang**：Chứng minh xung đột trung tâm của câu chuyện（2-4 Cảnh quay）
3. **hồi hộp cao trào**：Hình ảnh mãnh liệt nhất，để lại sự hồi hộp（1-2 Cảnh quay）

【Tiêu chí lựa chọn】
- Ưu tiên chức năng tường thuật như"đỉnh điểm"、"bước ngoặt"、"xung đột"Cảnh quay
- Ưu tiên những người có cảm xúc mạnh（tense, excited, mysterious）Cảnh quay
- Ưu tiên hình ảnh có tác động trực quan（Hành độcảnh tượng、Đặc tả、Đối đầu）
- Ưu tiên chuyên ngành Nhân vậThời điểm quan trọng của sự xuất hiện của t
- Bao gồm số tập khác nhau，Hi��n thị khoảng câu chuyện
- Tránh tiết lộ kết thúc quan trọng

【Đầbạn yêu cầu】
Xin hãy quay lạiạmảng JSON iA，Chứa Ph bạn chọnân cảsố sê-ri（index），báo chí trailer pháđặt hàng。
Định dạng：{ "selectedIndices": [1, 5, 12, 23, 45, 60] }`;

    const userPrompt = `【Dự áthông tin】
${background?.title ? `Tiêu đề phim truyền hình：《${background.title}》` : ''}
${background?.outline ? `phác thảo：${background.outline.slice(0, 500)}` : ''}

【Phân cảnh danh sách】（tổng cộng ${shots.length} Phân cảnh）
${shotSummaries.map(s => 
  `[${s.index}] ${s.id}
   Hành động：${s.actionSummary.slice(0, 100)}
   Mô tả：${s.visualDescription.slice(0, 100)}
   Nhân vật：${s.characterNames.join('、') || 'không có'}
   chức năng tường thuật：${s.narrativeFunction || 'Không rõ'}
   cảm xúc：${Array.isArray(s.emotionTags) ? s.emotionTags.join(', ') : 'không có'}`
).join('\n\n')}

Hãy bắt đầu từ Ph trênân cảChọn từ nh ${targetCount} C tốt nhất cho xe kéoảnh quay，Quay lại JSON Định dạdanh sách số sê-ri。`;

    // Thống nhất có được cấu hình từ ánh xạ dịch vụ
    const result = await callFeatureAPI('script_analysis', systemPrompt, userPrompt);

    // Phân tích AI Quay lạtôi JSON-Hỗ trợkhác nhauĐịnh dạng
    let selectedIndices: number[] = [];
    
    console.log('[TrailerService] AI raw response (first 1000 chars):', result.slice(0, 1000));
    
    // cố gắng để phù hợp { "selectedIndices": [...] } Định dạng
    const jsonMatch = result.match(/\{[\s\S]*?"selectedIndices"\s*:\s*\[[\d,\s]*\][\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        selectedIndices = parsed.selectedIndices || [];
      } catch (e) {
        console.warn('[TrailerService] Failed to parse JSON match:', e);
      }
    }
    
    // Nếu như trên Thất bại，Cố gắng khớp trực tiếp một dãy số [1, 2, 3, ...]
    if (selectedIndices.length === 0) {
      const arrayMatch = result.match(/\[\s*\d+(?:\s*,\s*\d+)*\s*\]/);
      if (arrayMatch) {
        try {
          selectedIndices = JSON.parse(arrayMatch[0]);
        } catch (e) {
          console.warn('[TrailerService] Failed to parse array match:', e);
        }
      }
    }
    
    // Nếu vẫn là Thất bại，Cố gắng giải nén Tất cảcon số
    if (selectedIndices.length === 0) {
      const numbers = result.match(/\b(\d{1,3})\b/g);
      if (numbers) {
        selectedIndices = numbers
          .map(n => parseInt(n, 10))
          .filter(n => n >= 1 && n <= shots.length)
          .slice(0, targetCount);
      }
    }
    
    if (selectedIndices.length === 0) {
      throw new Error('AI Quay lạiĐịnh dạngLỗi，Không thể phân tích số thứ tự');
    }
    
    console.log('[TrailerService] Parsed selectedIndices:', selectedIndices);

    // Lấy Ph tương ứng theo số serialân cảnh
    const selectedShots = selectedIndices
      .filter(idx => idx >= 1 && idx <= shots.length)
      .map(idx => shots[idx - 1]);

    return {
      success: true,
      selectedShots,
      shotIds: selectedShots.map(s => s.id),
    };
  } catch (error) {
    console.error('[TrailerService] AI selection failed:', error);
    
    // Kế hoạch dự phòng：Sử dụng quy tắc để chọn
    const fallbackShots = selectTrailerShotsByRules(shots, targetCount);
    return {
      success: true,
      selectedShots: fallbackShots,
      shotIds: fallbackShots.map(s => s.id),
      error: 'AI chọn Thất bại，Sử dụng quy tắc để chọn',
    };
  }
}

/**
 * Lựa chọn quy tắc（AI Thất bạKế hoạch dự phòng cho lần thứ i）
 */
function selectTrailerShotsByRules(shots: Shot[], targetCount: number): Shot[] {
  // Chức năng chấm điểm
  const scoreShot = (shot: Shot): number => {
    let score = 0;
    
    // Điểm chức năng tường thuật
    const narrativeFunction = (shot as any).narrativeFunction || '';
    if (narrativeFunction.includes('đỉnh điểm')) score += 10;
    if (narrativeFunction.includes('bước ngoặt')) score += 8;
    if (narrativeFunction.includes('xung đột')) score += 6;
    if (narrativeFunction.includes('Nâng cấp')) score += 4;
    
    // điểm tình cảm
    const emotionTags = (shot as any).emotionTags || [];
    if (emotionTags.includes('tense')) score += 5;
    if (emotionTags.includes('excited')) score += 5;
    if (emotionTags.includes('mysterious')) score += 4;
    if (emotionTags.includes('touching')) score += 3;
    
    // C với đoạn hội thoạiảnh quay hấp dẫn hơn
    if (shot.dialogue) score += 2;
    
    // Có nhiều Nhân vật là Cảnh quay kịch tính hơn
    if (shot.characterNames && shot.characterNames.length >= 2) score += 2;
    
    return score;
  };

  // theo phân số Sắp xếp
  const scoredShots = shots.map(shot => ({
    shot,
    score: scoreShot(shot),
  })).sort((a, b) => b.score - a.score);

  // Chọn đồng đều từ các bộ khác nhau
  const episodeIds = shots.map(s => s.episodeId).filter((id): id is string => !!id);
  const episodeSet = new Set(episodeIds);
  const episodeCount = episodeSet.size;
  
  if (episodeCount > 1) {
    // nhiều tập：Chọn một phần của mỗi tập phim
    const perEpisode = Math.ceil(targetCount / episodeCount);
    const selected: Shot[] = [];
    const episodeSelected = new Map<string, number>();
    
    for (const { shot } of scoredShots) {
      const epId = shot.episodeId || 'default';
      const count = episodeSelected.get(epId) || 0;
      
      if (count < perEpisode && selected.length < targetCount) {
        selected.push(shot);
        episodeSelected.set(epId, count + 1);
      }
    }
    
    // Theo thứ tự ban đầu Sắp xếp（Trailer Báo chí Thờtôi gian dòng）
    return selected.sort((a, b) => {
      const idxA = shots.findIndex(s => s.id === a.id);
      const idxB = shots.findIndex(s => s.id === b.id);
      return idxA - idxB;
    });
  } else {
    // tập duy nhất：Lấy trực tiếp người có số điểm cao nhất
    return scoredShots.slice(0, targetCount).map(s => s.shot);
  }
}

/**
 * Chuyển đổi ảnh đã chọn thành SplitScene Định dạng（Dành cho Giám đốc AI Phân cảnhChỉnh sửa）
 */
export function convertShotsToSplitScenes(
  shots: Shot[],
  sceneName?: string
): SplitScene[] {
  return shots.map((shot, index) => ({
    id: index,
    sceneName: sceneName || `xe kéo #${index + 1}`,
    sceneLocation: '',
    imageDataUrl: '',
    imageHttpUrl: null,
    width: 0,
    height: 0,
    imagePrompt: shot.imagePrompt || shot.visualPrompt || '',
    imagePromptZh: shot.imagePromptZh || shot.visualDescription || '',
    videoPrompt: shot.videoPrompt || '',
    videoPromptZh: shot.videoPromptZh || '',
    endFramePrompt: shot.endFramePrompt || '',
    endFramePromptZh: shot.endFramePromptZh || '',
    needsEndFrame: shot.needsEndFrame || false,
    row: 0,
    col: index,
    sourceRect: { x: 0, y: 0, width: 0, height: 0 },
    endFrameImageUrl: null,
    endFrameHttpUrl: null,
    endFrameSource: null,
    characterIds: [],
    emotionTags: (shot.emotionTags || []) as any,
    shotSize: shot.shotSize as any || null,
    // Seedance 1.5 Pro cần 4-12 giây，Giới hạn bắt buộc
    duration: Math.max(4, Math.min(12, shot.duration || 5)),
    ambientSound: shot.ambientSound || '',
    soundEffects: [],
    soundEffectText: shot.soundEffect || '',
    dialogue: shot.dialogue || '',
    actionSummary: shot.actionSummary || '',
    cameraMovement: shot.cameraMovement || '',
    // lĩnh vực dẫn dắt câu chuyện
    narrativeFunction: (shot as any).narrativeFunction || '',
    shotPurpose: (shot as any).shotPurpose || '',
    visualFocus: (shot as any).visualFocus || '',
    cameraPosition: (shot as any).cameraPosition || '',
    characterBlocking: (shot as any).characterBlocking || '',
    rhythm: (shot as any).rhythm || '',
    visualDescription: shot.visualDescription || '',
    // kỹ sư chiếu sáng
    lightingStyle: shot.lightingStyle,
    lightingDirection: shot.lightingDirection,
    colorTemperature: shot.colorTemperature,
    lightingNotes: shot.lightingNotes,
    // dụng cụ kéo tiêu điểm
    depthOfField: shot.depthOfField,
    focusTarget: shot.focusTarget,
    focusTransition: shot.focusTransition,
    // Nhóm thiết bị
    cameraRig: shot.cameraRig,
    movementSpeed: shot.movementSpeed,
    // Hiệu ứphân chia
    atmosphericEffects: shot.atmosphericEffects,
    effectIntensity: shot.effectIntensity,
    // kiểm soát tốc độ
    playbackSpeed: shot.playbackSpeed,
    // Chơi liên tục
    continuityRef: shot.continuityRef,
    imageStatus: 'idle' as const,
    imageProgress: 0,
    imageError: null,
    videoStatus: 'idle' as const,
    videoProgress: 0,
    videoUrl: null,
    videoError: null,
    videoMediaId: null,
    endFrameStatus: 'idle' as const,
    endFrameProgress: 0,
    endFrameError: null,
  }));
}
