// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Dịch vụ trailer - AI chọn các phân cảnh trailer.
 *
 * Chức năng:
 * - Chọn thông minh các phân cảnh nổi bật từ danh sách có sẵn
 * - Ưu tiên cảnh có vai trò tường thuật mạnh (cao trao/buoc ngoat/xung dot)
 * - Ưu tiên cảnh có cảm xúc mạnh và tác động thị giác cao
 */

import type { Shot, ProjectBackground } from '@/types/script';
import type { SplitScene, TrailerDuration } from '@/stores/director-store';
import { callFeatureAPI } from '@/lib/ai/feature-router';

// Mapping thời lượng trailer -> số phân cảnh mục tiêu
const DURATION_TO_SHOT_COUNT: Record<TrailerDuration, number> = {
  10: 2,   // 10 giây: 2-3 phân cảnh
  30: 6,   // 30 giây: 5-6 phân cảnh
  60: 12,  // 1 phút: 10-12 phân cảnh
};

/** @deprecated Khong can truyen thu cong nua, cau hinh duoc lay tu service map */
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
 * AI chon phan canh cho trailer.
 *
 * @param shots Tat ca phan canh hien co
 * @param background Thong tin nen du an
 * @param duration Thoi luong trailer
 * @param _options Cau hinh API (giu lai de tuong thich nguoc)
 */
export async function selectTrailerShots(
  shots: Shot[],
  background: ProjectBackground | null,
  duration: TrailerDuration,
  _options?: TrailerGenerationOptions // Khong con can thiet, chi giu cho backward compatibility
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
  
  // Neu so phan canh nho hon muc tieu thi tra ve tat ca
  if (shots.length <= targetCount) {
    return {
      success: true,
      selectedShots: shots,
      shotIds: shots.map(s => s.id),
    };
  }

  try {
    // Tao ban tom tat phan canh de AI phan tich
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

    const systemPrompt = `Ban la bien tap vien trailer chuyen nghiep, gioi chon cac canh hap dan nhat tu mot tap lon du lieu.

Nhiem vu: tu danh sach phan canh da cho, chon ${targetCount} phan canh phu hop nhat de dung lam trailer.

[Nguyen tac cau truc trailer]
1. Mo dau: tao bau khong khi, thu hut su chu y (1-2 canh)
2. Leo thang xung dot: the hien xung dot trung tam (2-4 canh)
3. Cao trao gay hoi hop: hinh anh manh nhat, de lai su to mo (1-2 canh)

[Tieu chi lua chon]
- Uu tien canh co chuc nang tuong thuat nhu "dinh diem", "buoc ngoat", "xung dot"
- Uu tien canh co cam xuc manh (tense, excited, mysterious)
- Uu tien canh co tac dong thi giac (hanh dong, can canh, doi dau)
- Uu tien khoanh khac quan trong cua nhan vat chinh
- Co su da dang giua cac tap de the hien pham vi cau chuyen
- Tranh tiet lo ket thuc quan trong

[Dau ra bat buoc]
Tra ve dung JSON, chi gom cac chi so phan canh duoc chon theo thu tu trailer.
Dinh dang: { "selectedIndices": [1, 5, 12, 23, 45, 60] }`;

    const userPrompt = `[Thong tin du an]
${background?.title ? `Tieu de: ${background.title}` : ''}
${background?.outline ? `Phac thao: ${background.outline.slice(0, 500)}` : ''}

[Danh sach phan canh] (tong cong ${shots.length} phan canh)
${shotSummaries.map(s => 
  `[${s.index}] ${s.id}
   Hanh dong: ${s.actionSummary.slice(0, 100)}
   Mo ta: ${s.visualDescription.slice(0, 100)}
   Nhan vat: ${s.characterNames.join(', ') || 'khong co'}
   Chuc nang tuong thuat: ${s.narrativeFunction || 'khong ro'}
   Cam xuc: ${Array.isArray(s.emotionTags) ? s.emotionTags.join(', ') : 'khong co'}`
).join('\n\n')}

Hay chon ${targetCount} phan canh tot nhat va tra ve danh sach chi so dung dinh dang JSON.`;

    // Lay cau hinh thong nhat tu service mapping
    const result = await callFeatureAPI('script_analysis', systemPrompt, userPrompt);

    // Phan tich JSON tra ve tu AI (ho tro nhieu dinh dang)
    let selectedIndices: number[] = [];
    
    console.log('[TrailerService] AI raw response (first 1000 chars):', result.slice(0, 1000));
    
    // Thu parse theo dinh dang { "selectedIndices": [...] }
    const jsonMatch = result.match(/\{[\s\S]*?"selectedIndices"\s*:\s*\[[\d,\s]*\][\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        selectedIndices = parsed.selectedIndices || [];
      } catch (e) {
        console.warn('[TrailerService] Failed to parse JSON match:', e);
      }
    }
    
    // Neu that bai thi thu match truc tiep mang so [1, 2, 3, ...]
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
    
    // Neu van that bai thi thu bo tat ca so trong chuoi phan hoi
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
      throw new Error('Dinh dang AI tra ve khong hop le, khong the phan tich chi so');
    }
    
    console.log('[TrailerService] Parsed selectedIndices:', selectedIndices);

    // Lay cac phan canh theo chi so da chon
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
    
    // Phuong an du phong: chon bang rule-based
    const fallbackShots = selectTrailerShotsByRules(shots, targetCount);
    return {
      success: true,
      selectedShots: fallbackShots,
      shotIds: fallbackShots.map(s => s.id),
      error: 'AI chon that bai, da chuyen sang rule-based',
    };
  }
}

/**
 * Chon phan canh bang rule-based (du phong khi AI that bai).
 */
function selectTrailerShotsByRules(shots: Shot[], targetCount: number): Shot[] {
  // Ham cham diem
  const scoreShot = (shot: Shot): number => {
    let score = 0;
    
    // Diem theo vai tro tuong thuat
    const narrativeFunction = (shot as any).narrativeFunction || '';
    if (narrativeFunction.includes('đỉnh điểm')) score += 10;
    if (narrativeFunction.includes('bước ngoặt')) score += 8;
    if (narrativeFunction.includes('xung đột')) score += 6;
    if (narrativeFunction.includes('Nâng cấp')) score += 4;
    
    // Diem theo cam xuc
    const emotionTags = (shot as any).emotionTags || [];
    if (emotionTags.includes('tense')) score += 5;
    if (emotionTags.includes('excited')) score += 5;
    if (emotionTags.includes('mysterious')) score += 4;
    if (emotionTags.includes('touching')) score += 3;
    
    // Canh co hoi thoai thuong hap dan hon
    if (shot.dialogue) score += 2;
    
    // Canh co nhieu nhan vat thuong kich tinh hon
    if (shot.characterNames && shot.characterNames.length >= 2) score += 2;
    
    return score;
  };

  // Sap xep theo diem giam dan
  const scoredShots = shots.map(shot => ({
    shot,
    score: scoreShot(shot),
  })).sort((a, b) => b.score - a.score);

  // Co gang phan bo deu giua cac tap
  const episodeIds = shots.map(s => s.episodeId).filter((id): id is string => !!id);
  const episodeSet = new Set(episodeIds);
  const episodeCount = episodeSet.size;
  
  if (episodeCount > 1) {
    // Nhieu tap: lay mot so canh moi tap
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
    
    // Sap xep lai theo thu tu goc de trailer mach lac theo thoi gian
    return selected.sort((a, b) => {
      const idxA = shots.findIndex(s => s.id === a.id);
      const idxB = shots.findIndex(s => s.id === b.id);
      return idxA - idxB;
    });
  } else {
    // Mot tap duy nhat: lay truc tiep cac canh diem cao nhat
    return scoredShots.slice(0, targetCount).map(s => s.shot);
  }
}

/**
 * Chuyen shot da chon sang dinh dang SplitScene (de dua vao Director panel).
 */
export function convertShotsToSplitScenes(
  shots: Shot[],
  sceneName?: string
): SplitScene[] {
  return shots.map((shot, index) => ({
    id: index,
    sceneName: sceneName || `Trailer #${index + 1}`,
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
    // Seedance 1.5 Pro yeu cau 4-12 giay
    duration: Math.max(4, Math.min(12, shot.duration || 5)),
    ambientSound: shot.ambientSound || '',
    soundEffects: [],
    soundEffectText: shot.soundEffect || '',
    dialogue: shot.dialogue || '',
    actionSummary: shot.actionSummary || '',
    cameraMovement: shot.cameraMovement || '',
    // Nhom truong tuong thuat
    narrativeFunction: (shot as any).narrativeFunction || '',
    shotPurpose: (shot as any).shotPurpose || '',
    visualFocus: (shot as any).visualFocus || '',
    cameraPosition: (shot as any).cameraPosition || '',
    characterBlocking: (shot as any).characterBlocking || '',
    rhythm: (shot as any).rhythm || '',
    visualDescription: shot.visualDescription || '',
    // Nhom truong anh sang
    lightingStyle: shot.lightingStyle,
    lightingDirection: shot.lightingDirection,
    colorTemperature: shot.colorTemperature,
    lightingNotes: shot.lightingNotes,
    // Nhom truong focus
    depthOfField: shot.depthOfField,
    focusTarget: shot.focusTarget,
    focusTransition: shot.focusTransition,
    // Nhóm thiết bị
    cameraRig: shot.cameraRig,
    movementSpeed: shot.movementSpeed,
    // Nhom truong hieu ung
    atmosphericEffects: shot.atmosphericEffects,
    effectIntensity: shot.effectIntensity,
    // Kiem soat toc do
    playbackSpeed: shot.playbackSpeed,
    // Lien tuc canh
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
