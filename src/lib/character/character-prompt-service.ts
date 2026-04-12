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
    throw new Error('Kịch bảndata không tồn tại');
  }
  
  // tìm thấyĐíchNhân vật
  const character = scriptData.characters.find(c => c.id === characterId);
  if (!character) {
    throw new Error('Nhân vật\u4e0d\u5b58\u5728');
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
    character.gender ? `giới tính：${character.gender}` : '',
    character.age ? `tuổi tác：${character.age}` : '',
    character.personality ? `nhân vật：${character.personality}` : '',
    character.role ? `danh tính：${character.role}` : '',
    character.traits ? `\u7279\u8d28：${character.traits}` : '',
    character.appearance ? `Bên ngoài\u8c8c：${character.appearance}` : '',
    character.relationships ? `mối quan hệ：${character.relationships}` : '',
    character.keyActions ? `việc làm quan trọng：${character.keyActions}` : '',
  ].filter(Boolean).join('\n');
  
  return {
    projectTitle: background?.title || project.scriptData?.title || 'Không tênKịch bản',
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
  
  const systemPrompt = `\u4f60\u662f\u597d\u83b1\u575e\u9876\u7ea7Nhân vật\u8bbe\u8ba1\u5927phép chia，một lần cho\u6f2b\u5a01、\u8fea\u58eb\u5c3c、\u76ae\u514b\u65af\u8bbe\u8ba1\u8fc7không có\u6570\u7ecf\u5178Nhân vật。

khả năng chuyên môn của bạn：
- **Nhân vật\u89c6\u89c9\u8bbe\u8ba1**：\u80fd\u51c6\u786e\u6355\u6349Nhân vậtcủaBên ngoài\u5728\u5f62\u8c61、quần áoPhong cách、\u80a2\u4f53ngôn ngữ
- **Nhân vậtphát triển\u5f27\u7ebf**：\u7406\u89e3Nhân vật\u5728\u4e0d\u540c\u5267\u60c5\u9636\u6bb5của\u5f62\u8c61thay đổi（từvị thành niênĐếnngười lớn、từ\u666e\u901a\u4ebaĐến\u82f1\u96c4Đợi đã）
- **Hình ảnh AI TạoKinh nghiệm**：Biết giữa hành trình、DALL-E、Stable Diffusion Đợi đã AI \u7ed8\u56feMô hìNH hoạt động như thế nào?，\u80fd\u5199\u51fa\u9ad8\u8d28\u91cfcủaPrompt
- **một\u81f4\u6027giữ**：\u77e5\u9053Chẳng hạn như\u4f55Mô tảđặc điểm khuôn mặt、\u4f53\u578bĐợi đãkhông thay đổiphần tử，\u786e\u4fddNhân vật\u5728\u4e0d\u540c\u9636\u6bb5\u4ecd\u53ef\u8fa8\u8ba4

Nhiệm vụ của bạn là đi theo Kịch bảthông tin，choNhân vật\u8bbe\u8ba1**\u591a\u9636\u6bb5\u89c6\u89c9\u5f62\u8c61**。

【Kịch bảthông tin】
Tiêu đề phim truyền hình：《${context.projectTitle}》
Loại：${context.genre || 'Không rõ'}
thời đại：${context.era || 'hiện đại'}
tổng số tập：${context.totalEpisodes}đặt

【Tóm tắt】
${context.outline?.slice(0, 800) || 'không có'}

【Nhân vậthông tin t】
${context.characterBio}

【Nhân vậtNgoại hìnhống kê】
${context.characterAppearances.length > 0 
  ? context.characterAppearances.map((a: any) => 
      `Không.${a.episodeIndex}đặt「${a.episodeTitle}」: xuất hiện${a.actions.length}lần`
    ).join('\n')
  : '\u6682không cóxuất hiệdữ liệu'
}

【Nhiệm vụyêu cầu】
1. **Phân tíchNhân vậtphát triển\u5f27\u7ebf**：\u6839\u636e\u5267\u60c5\u5224\u65adNhân vật\u662f\u5426Có\u660e\u663ecủa\u9636\u6bb5thay đổi
   - tuổtôi thay đổi：\u5c0f\u5b69→vị thành niên→người lớn→tuổi già
   - Danh tínhthay đổi：\u666e\u901a\u4eba→Kinh doanh\u5927\u4ea8、\u5b66\u5f92→vũ lâm\u9ad8tay
   - Trạng thátôi thay đổi：\u5065\u5eb7→\u53d7\u4f24、\u666e\u901a→trồng trọt\u540e\u5f62\u6001
   
2. **\u8bbe\u8ba1\u591a\u9636\u6bb5\u5f62\u8c61**：cho\u6bcfGiai đoạn Tạođộc lậpcủaLời nhắc trực quan
   - Chẳng hạn như\u679cNhân vật\u6ca1Có\u660e\u663e\u9636\u6bb5thay đổi，\u53ea\u9700\u8bbe\u8ba11một\u9636\u6bb5
   - nếu cóthay đổi，\u8bbe\u8ba12-4một\u9636\u6bb5

3. **giữyếu tố nhất quán**：\u8bc6\u522bNhân vậtcủakhông thay đổi\u7279\u5f81
   - đặc điểm khuôn mặt（hình dạng mắt、Đặc điểm khuôn mặt hình chữ Tỷ lệ）
   - Đặc điểm vật lý（chiều cao、vóc dáng）
   - dấu ấn độc đáo（vết bớt、vết sẹo、Tính năng mang tính biểu tượng）

4. **Promptyêu cầu**：
   - Tiếng AnhNhắc：40-60\u8bcd，Phù hợp với hình ảnh AI Tạo
   - Lời nhắc tiếng Trung：Chi tiếtMô tả，chứaChi tiết

Vui lòng sử dụng JSONĐịnh dạngQuay lại：
{
  "characterName": "Nhân vậtên t",
  "baseDescription": "Nhân vậtCơ bảnMô tả（một\u53e5\u8bdd）",
  "baseVisualPromptEn": "Cơ bảnTiếng AnhNhắc",
  "baseVisualPromptZh": "Cơ bảnLời nhắc tiếng Trung",
  "consistencyElements": {
    "facialFeatures": "đặc điểm khuôn mặtMô tả（Tiếng Anh）",
    "bodyType": "\u4f53\u578bMô tả（Tiếng Anh）",
    "uniqueMarks": "dấu ấn độc đáoMô tả（Tiếng Anh，Chẳng hạn nhưkhông có\u5219cho\u7a7a）"
  },
  "stages": [
    {
      "stageId": "stage_1",
      "stageName": "Giai đoạn Tên（Chẳng hạn như：vị thành niênthời kỳ）",
      "episodeRange": "1-5",
      "description": "Giai đoạn Nhân vậtTrạng tháiMô tả",
      "visualPromptEn": "\u8be5\u9636\u6bb5Lời nhắc trực quan bằng tiếng Anh",
      "visualPromptZh": "\u8be5\u9636\u6bb5Lời nhắc trực quan của Trung Quốc",
      "ageDescription": "tuổi tácMô tả",
      "clothingStyle": "quần áoPhong cách",
      "keyChanges": "với\u4e0amột\u9636\u6bb5củathay đổi（Không.một\u9636\u6bb5cho\u7a7a）"
    }
  ]
}`;

  const userPrompt = `\u8bf7choNhân vật「${character.name}」\u8bbe\u8ba1\u591a\u9636\u6bb5\u89c6\u89c9\u5f62\u8c61。`;
  
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
    throw new Error('phân tích cú phápNhân vật\u8bbe\u8ba1Thất bại');
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
