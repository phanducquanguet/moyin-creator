// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Character Prompt Generation Service
 * 
 * NH chuyên nghiệpân vật\u8bbe\u8ba1\u670d\u52a1，với\u73b0CóThư viện nhân vật(character-library-store)Căn chỉnh。
 * 
 * chức năng：
 * 1. \u8bfb\u53d6Kịch bảsiêu dữ liệu，\u7406\u89e3Nhân vậtphát triển\u5f27\u7ebf
 * 2. \u6839\u636eLô Giai đoạn Tạo\u4e0d\u540cNhân vật\u5f62\u8c61
 * 3. Tạocủa\u9636\u6bb5\u53ef\u8f6c\u6362choThư viện nhân vậtcủa CharacterVariation
 * 4. sử dụng\u4e16\u754c\u7ea7\u4e13\u4e1a\u4eba\u8bbe\u63d0\u5347 AI Tạo\u8d28\u91cf
 * 
 * Lưu ý：Đây làmộtmộtphụ trợ\u670d\u52a1，Khôngửa\u73b0CóThư viện nhân vậtcủa\u4efb\u4f55chức năng。
 */

import { useScriptStore } from '@/stores/script-store';
import { callFeatureAPI } from '@/lib/ai/feature-router';
import type { CharacterVariation } from '@/stores/character-library-store';

// ==================== LoạiĐịnh nghĩa ====================

/**
 * Nhân vật\u9636\u6bb5\u5f62\u8c61
 * mộtNhân vật\u5728\u4e0d\u540c\u5267\u60c5\u9636\u6bb5\u53ef\u80fdCó\u4e0d\u540ccủaBên ngoài\u89c2/Trạng thái
 */
export interface CharacterStageAppearance {
  stageId: string;           // \u9636\u6bb5ID
  stageName: string;         // Giai đoạn Tên（Chẳng hạn như"vị thành niênthời kỳ"、"\u6210cho\u5927\u4ea8\u540e"）
  episodeRange: string;      // đặt\u6570\u8303\u56f4（Chẳng hạn như"1-5"、"10-20"）
  description: string;       // Giai đoạn Nhân vậtMô tả
  visualPromptEn: string;    // Lời nhắc trực quan bằng tiếng Anh
  visualPromptZh: string;    // Lời nhắc trực quan của Trung Quốc
  ageDescription?: string;   // tuổi tácMô tả
  clothingStyle?: string;    // quần áoPhong cách
  keyChanges?: string;       // với\u4e0amột\u9636\u6bb5củachìa khóathay đổi
}

/**
 * Hoàn thànhNhân vật\u8bbe\u8ba1
 */
export interface CharacterDesign {
  characterId: string;
  characterName: string;
  // Cơ bảthông tin
  baseDescription: string;      // Cơ bảnNhân vậtMô tả
  baseVisualPromptEn: string;   // Cơ bảnTiếng AnhNhắc
  baseVisualPromptZh: string;   // Cơ bảnLời nhắc tiếng Trung
  // \u591a\u9636\u6bb5\u5f62\u8c61
  stages: CharacterStageAppearance[];
  // yếu tố nhất quán（Tất cả\u9636\u6bb5tổng cộng\u4eab）
  consistencyElements: {
    facialFeatures: string;     // đặc điểm khuôn mặt（không thay đổi）
    bodyType: string;           // \u4f53\u578b
    uniqueMarks: string;        // dấu ấn độc đáo（vết bớt、vết sẹoĐợi đã）
  };
  // \u5143\u6570\u636e
  generatedAt: number;
  sourceProjectId: string;
}

/** @không được dùng nữa không cần phải chuyển thủ công nữa，Tự động thu được từ bản đồ dịch vụ */
export interface CharacterDesignOptions {
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
  styleId?: string;
}

// ==================== AI Nhân vật\u8bbe\u8ba1\u670d\u52a1 ====================

/**
 * choKịch bảnNhân vậtTạoNH chuyên nghiệp nhiều giai đoạnân vật\u8bbe\u8ba1
 * 
 * @param characterId Kịch bảntrongNhân vậtID
 * @param projectId Dự ánID
 * @param options APICấu hình
 */
export async function generateCharacterDesign(
  characterId: string,
  projectId: string,
  _options?: CharacterDesignOptions // không còn cần thiết nữa，dành riêng cho khả năng tương thích
): Promise<CharacterDesign> {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project) {
    throw new Error('Dự án không tồn tại');
  }
  
  const scriptData = project.scriptData;
  if (!scriptData) {
    throw new Error('Dữ liệu kịch bản không tồn tại');
  }
  
  // tìm thấyĐíchNhân vật
  const character = scriptData.characters.find(c => c.id === characterId);
  if (!character) {
    throw new Error('Nhân vật không tồn tại');
  }
  
  // Thu thập Nhân vật\u76f8\u5173của\u4e0a\u4e0b\u6587thông tin
  const context = buildCharacterContext(project, character);
  
  // \u8c03sử dụng AI TạoNhân vật\u8bbe\u8ba1
  const design = await callAIForCharacterDesign(
    character,
    context
  );
  
  return design;
}

/**
 * \u6784\u5efaNhân vật\u4e0a\u4e0b\u6587thông tin
 */
function buildCharacterContext(project: any, character: any): {
  projectTitle: string;
  genre: string;
  era: string;
  outline: string;
  totalEpisodes: number;
  characterBio: string;
  characterAppearances: Array<{
    episodeIndex: number;
    episodeTitle: string;
    scenes: string[];
    actions: string[];
    dialogues: string[];
  }>;
} {
  const background = project.projectBackground;
  const episodes = project.episodeRawScripts || [];
  const shots = project.shots || [];
  
  // Thu thập Nhân vật\u5728\u5404đặttrongcủaxuất hiệnthông tin
  const characterAppearances: Array<{
    episodeIndex: number;
    episodeTitle: string;
    scenes: string[];
    actions: string[];
    dialogues: string[];
  }> = [];
  
  for (const ep of episodes) {
    const epShots = shots.filter((s: any) => 
      s.characterNames?.includes(character.name)
    );
    
    if (epShots.length > 0) {
      const sceneIds: string[] = Array.from(
        new Set<string>(
          epShots
            .map((s: any) => s.sceneRefId)
            .filter((id: unknown): id is string | number => id !== null && id !== undefined)
            .map((id): string => String(id))
        )
      );

      characterAppearances.push({
        episodeIndex: ep.episodeIndex,
        episodeTitle: ep.title,
        scenes: sceneIds,
        actions: epShots.map((s: any) => s.actionSummary).filter(Boolean).slice(0, 5),
        dialogues: epShots.map((s: any) => s.dialogue).filter(Boolean).slice(0, 5),
      });
    }
  }
  
  // \u6784\u5efaNhân vật\u4f20\u8bb0
  const characterBio = [
    character.name,
    character.gender ? `Giới tính: ${character.gender}` : '',
    character.age ? `Tuổi: ${character.age}` : '',
    character.personality ? `Tính cách: ${character.personality}` : '',
    character.role ? `Vai trò: ${character.role}` : '',
    character.traits ? `Đặc điểm: ${character.traits}` : '',
    character.appearance ? `Ngoại hình: ${character.appearance}` : '',
    character.relationships ? `Quan hệ: ${character.relationships}` : '',
    character.keyActions ? `Hành động quan trọng: ${character.keyActions}` : '',
  ].filter(Boolean).join('\n');
  
  return {
    projectTitle: background?.title || project.scriptData?.title || 'Kịch bản chưa đặt tên',
    genre: background?.genre || '',
    era: background?.era || '',
    outline: background?.outline || '',
    totalEpisodes: episodes.length,
    characterBio,
    characterAppearances,
  };
}

/**
 * \u8c03sử dụng AI TạoNhân vật\u8bbe\u8ba1
 */
async function callAIForCharacterDesign(
  character: any,
  context: any
): Promise<CharacterDesign> {
  
  const systemPrompt = `Bạn là chuyên gia thiết kế nhân vật điện ảnh cấp cao.

Nhiệm vụ của bạn:
- Phân tích thông tin kịch bản để nhận diện tiến trình phát triển của nhân vật.
- Thiết kế hình tượng theo nhiều giai đoạn (nếu có thay đổi rõ ràng theo thời gian/cốt truyện).
- Giữ các yếu tố nhận diện cốt lõi để nhân vật nhất quán giữa các giai đoạn.
- Xuất prompt chất lượng cao cho AI tạo ảnh.

Thông tin kịch bản:
- Tiêu đề: ${context.projectTitle}
- Thể loại: ${context.genre || 'Không rõ'}
- Bối cảnh thời đại: ${context.era || 'Hiện đại'}
- Tổng số tập: ${context.totalEpisodes}

Tóm tắt:
${context.outline?.slice(0, 800) || 'Không có'}

Thông tin nhân vật:
${context.characterBio}

Thống kê xuất hiện:
${context.characterAppearances.length > 0
  ? context.characterAppearances.map((a: any) =>
      `Tập ${a.episodeIndex} - "${a.episodeTitle}": xuất hiện ${a.actions.length} lần`
    ).join('\n')
  : 'Chưa có dữ liệu xuất hiện'
}

Yêu cầu:
1. Phân tích cung phát triển nhân vật:
   - Thay đổi tuổi tác, địa vị, trạng thái thể chất/tâm lý.
   - Xác định có cần nhiều giai đoạn hay chỉ 1 giai đoạn.
2. Thiết kế 1-4 giai đoạn hình tượng:
   - Mỗi giai đoạn phải có mô tả rõ ràng và prompt riêng.
3. Giữ tính nhất quán:
   - Đặc điểm khuôn mặt, vóc dáng, dấu hiệu nhận diện.
4. Chuẩn prompt:
   - visualPromptEn: tiếng Anh, 40-60 từ, tối ưu cho AI tạo ảnh.
   - visualPromptZh: tiếng Trung, mô tả chi tiết tương ứng.

Trả về đúng JSON (không markdown):
{
  "characterName": "Tên nhân vật",
  "baseDescription": "Mô tả nền của nhân vật (1 câu)",
  "baseVisualPromptEn": "Prompt tiếng Anh nền",
  "baseVisualPromptZh": "Prompt tiếng Trung nền",
  "consistencyElements": {
    "facialFeatures": "Mô tả đặc điểm khuôn mặt (EN)",
    "bodyType": "Mô tả vóc dáng (EN)",
    "uniqueMarks": "Mô tả dấu hiệu nhận diện độc đáo (EN, nếu không có để chuỗi rỗng)"
  },
  "stages": [
    {
      "stageId": "stage_1",
      "stageName": "Tên giai đoạn (ví dụ: Tuổi thiếu niên)",
      "episodeRange": "1-5",
      "description": "Mô tả trạng thái nhân vật ở giai đoạn này",
      "visualPromptEn": "Prompt tiếng Anh cho giai đoạn này",
      "visualPromptZh": "Prompt tiếng Trung cho giai đoạn này",
      "ageDescription": "Mô tả tuổi tác",
      "clothingStyle": "Phong cách trang phục",
      "keyChanges": "Thay đổi chính so với giai đoạn trước (giai đoạn đầu để chuỗi rỗng)"
    }
  ]
}`;

  const userPrompt = `Hãy thiết kế hình tượng nhiều giai đoạn cho nhân vật "${character.name}".`;
  
  // Thống nhất có được cấu hình từ ánh xạ dịch vụ
  const result = await callFeatureAPI('script_analysis', systemPrompt, userPrompt);
  
  // Phân tích kết quả
  try {
    let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    
    const parsed = JSON.parse(cleaned);
    
    return {
      characterId: character.id,
      characterName: parsed.characterName || character.name,
      baseDescription: parsed.baseDescription || '',
      baseVisualPromptEn: parsed.baseVisualPromptEn || '',
      baseVisualPromptZh: parsed.baseVisualPromptZh || '',
      stages: parsed.stages || [],
      consistencyElements: parsed.consistencyElements || {
        facialFeatures: '',
        bodyType: '',
        uniqueMarks: '',
      },
      generatedAt: Date.now(),
      sourceProjectId: context.projectTitle,
    };
  } catch (e) {
    console.error('[CharacterDesign] Failed to parse AI response:', result);
    throw new Error('Không thể phân tích kết quả thiết kế nhân vật từ AI');
  }
}

/**
 * \u6839\u636eđặt\u6570\u83b7\u53d6Nhân vậthiện tại\u9636\u6bb5củaPrompt
 * 
 * @param design Nhân vật\u8bbe\u8ba1
 * @param episodeIndex hiện tạiđặt\u6570
 */
export function getCharacterPromptForEpisode(
  design: CharacterDesign,
  episodeIndex: number
): { promptEn: string; promptZh: string; stageName: string } {
  // tìm thấy\u5bf9\u5e94\u9636\u6bb5
  for (const stage of design.stages) {
    const [start, end] = stage.episodeRange.split('-').map(Number);
    if (episodeIndex >= start && episodeIndex <= end) {
      // \u7ec4\u5408yếu tố nhất quánvà\u9636\u6bb5Prompt
      const consistencyPrefix = [
        design.consistencyElements.facialFeatures,
        design.consistencyElements.bodyType,
        design.consistencyElements.uniqueMarks,
      ].filter(Boolean).join(', ');
      
      return {
        promptEn: consistencyPrefix 
          ? `${consistencyPrefix}, ${stage.visualPromptEn}`
          : stage.visualPromptEn,
        promptZh: stage.visualPromptZh,
        stageName: stage.stageName,
      };
    }
  }
  
  // Mặc địnhQuay lạiCơ bảnPrompt
  return {
    promptEn: design.baseVisualPromptEn,
    promptZh: design.baseVisualPromptZh,
    stageName: 'Mặc định',
  };
}

/**
 * \u5c06Nhân vật\u8bbe\u8ba1\u8f6c\u6362choThư viện nhân vậtcủathay đổi\u4f53Định dạng (CharacterVariation)
 * \u53ef\u76f4\u63a5sử dụng\u4e8e addVariation() \u65b9\u6cd5
 * 
 * @param design Nhân vật\u8bbe\u8ba1
 * @returns \u53ef\u76f4\u63a5ThêmĐếnThư viện nhân vậtcủathay đổi\u4f53\u6570\u7ec4
 */
export function convertDesignToVariations(design: CharacterDesign): Array<Omit<CharacterVariation, 'id'>> {
  return design.stages.map(stage => ({
    name: stage.stageName,
    // \u7ec4\u5408yếu tố nhất quán + \u9636\u6bb5Prompt
    visualPrompt: [
      design.consistencyElements.facialFeatures,
      design.consistencyElements.bodyType,
      design.consistencyElements.uniqueMarks,
      stage.visualPromptEn,
    ].filter(Boolean).join(', '),
    // referenceImage Để trống，Đợi đã\u5f85Người dùngTạo
    referenceImage: undefined,
    generatedAt: undefined,
  }));
}

/**
 * choThư viện nhân vậNh trong tân vậtTạothay đổi\u4f53（Wardrobe System）
 * Dựa trênNhân vật\u8bbe\u8ba1của\u4e0d\u540c\u9636\u6bb5
 * 
 * @deprecated sử dụng convertDesignToVariations \u4ee3\u66ff
 */
export function generateVariationsFromDesign(design: CharacterDesign): Array<{
  name: string;
  visualPrompt: string;
}> {
  return design.stages.map(stage => ({
    name: stage.stageName,
    visualPrompt: `${design.consistencyElements.facialFeatures}, ${stage.visualPromptEn}`,
  }));
}

/**
 * choThư viện nhân vậtNhân vậtCập nhậtCơ bảnMô tảvà\u89c6\u89c9\u7279\u5f81
 * 
 * @param design Nhân vật\u8bbe\u8ba1
 * @returns Có sẵn\u4e8e updateCharacter() Cập nhật\u5bf9\u8c61
 */
export function getCharacterUpdatesFromDesign(design: CharacterDesign): {
  description: string;
  visualTraits: string;
} {
  return {
    description: design.baseVisualPromptZh,
    visualTraits: design.baseVisualPromptEn,
  };
}
