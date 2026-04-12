// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Character Stage Analyzer
 * 
 * Phân tíchKịch bảnphác thảo，\u81ea\u52a8\u8bc6\u522bMainNhân vậtcủa\u9636\u6bb5thay đổi，Tạo\u591abiến thể sân khấu。
 * 
 * chức năng：
 * 1. Phân tíchphác thảotrongThời gian\u8de8\u5ea6vàNhân vậtphát triển\u8f68\u8ff9
 * 2. choMainNhân vậtTạobiến thể sân khấu（phiên bản trẻ、phiên bản trung niên v.v.）
 * 3. \u6bcfmộtthay đổi\u4f53chứađặt\u6570\u8303\u56f4，\u4f9bPhân cảnh thời gian\u81ea\u52a8\u8c03sử dụng
 */

import type { ProjectBackground, ScriptCharacter, PromptLanguage } from '@/types/script';
import type { CharacterVariation } from '@/stores/character-library-store';
import { callFeatureAPI } from '@/lib/ai/feature-router';

// ==================== LoạiĐịnh nghĩa ====================

export interface CharacterStageAnalysis {
  characterName: string;
  needsMultiStage: boolean;        // \u662f\u5426\u9700\u8981\u591a\u9636\u6bb5
  reason: string;                   // \u5224\u65ad\u7406\u7531
  stages: StageVariationData[];     // \u9636\u6bb5danh sách
  consistencyElements: {            // yếu tố nhất quán
    facialFeatures: string;
    bodyType: string;
    uniqueMarks: string;
  };
}

export interface StageVariationData {
  name: string;                     // "phiên bản trẻ"、"phiên bản trung niên"
  episodeRange: [number, number];   // [1, 15]
  ageDescription: string;           // "25 tuổi"
  stageDescription: string;         // "Giai đoạn đầu kinh doanh，\u610f\u6c14gió\u53d1"
  visualPromptEn: string;           // Tiếng AnhNhắc
  visualPromptZh: string;           // Lời nhắc tiếng Trung
}

// AnalyzeOptions Đã rồi\u7ecf\u4e0d\u9700\u8981\u4e86，Thống nhất có được cấu hình từ ánh xạ dịch vụ

// ==================== chức năng cốt lõi ====================

/**
 * Phân tíchKịch bảnNhân vật，\u8bc6\u522b\u9700\u8981\u591a\u9636\u6bb5\u5f62\u8c61Nhân vật
 * 
 * @param background Dự ánNền（Chứa một phác thảo）
 * @param characters Nhân vậdanh sách t
 * @param totalEpisodes tổng số tập
 * @param options APICấu hình
 */
export async function analyzeCharacterStages(
  background: ProjectBackground,
  characters: ScriptCharacter[],
  totalEpisodes: number,
  promptLanguage: PromptLanguage = 'zh+en'
): Promise<CharacterStageAnalysis[]> {
  
  // \u53eaPhân tíchMainNhân vật（\u524d3mộthoặcCóChi tiếtMô tảcủa）
  const mainCharacters = characters.slice(0, 5).filter(c => 
    c.role || c.personality || c.appearance
  );
  
  if (mainCharacters.length === 0) {
    console.log('[CharacterStageAnalyzer] \u6ca1Cótìm thấy\u9700\u8981Phân tíchcủaMainNhân vật');
    return [];
  }
  
  const systemPrompt = `\u4f60\u662f\u4e13\u4e1acủa\u5f71\u89c6Nhân vật\u8bbe\u8ba1\u987e\u95ee，giỏi tiến sĩân tíchNhân vật\u5728\u957f\u7bc7\u5267đặttrongcủa\u5f62\u8c61thay đổi。

của bạnNhiệm vụ\u662fPhân tíchKịch bảnphác thảo，\u5224\u65ad\u6bcfmộtMainNhân vật\u662f\u5426\u9700\u8981\u591amột\u9636\u6bb5của\u5f62\u8c61thay đổi\u4f53。

【\u5224\u65adTiêu chuẩn】
Nhân vật\u9700\u8981\u591a\u9636\u6bb5\u5f62\u8c61của\u60c5\u51b5：
1. Thời gian\u8de8\u5ea6\u5927（Chẳng hạn nhưtừ25 tuổiĐến50 tuổi）
2. danh tínhtrạng tháithay đổi（từ\u666e\u901a\u4ebaĐếnThành côngdoanh nghiệpnhà）
3. Bên ngoài\u8c8cCó\u663e\u8457thay đổi（năm\u8f7b→Trưởng thành→tuổi già）
4. Số lượng tập phim lớn（Nhân vật chính có hơn 30 tập thường cần）

Không cần tình huống nhiều giai đoạn：
1. Vai phụ、Nh ai chơi ít hơnân vật
2. Thờtôi gian phim truyền hình ngắn tập
3. Nhân vật Không có sự thay đổi rõ rệt về ngoại hình

【Nguyên tắc phân chia giai đoạn】
- Phân chia hợp lý theo tổng số tập，\u6bcfmột\u9636\u6bb5\u81f3\u5c1110đặt
- \u9636\u6bb5\u4e4b\u95f4\u8981Có\u660e\u663ecủa\u5f62\u8c61Quận\u5206
- giữđặc điểm khuôn mặt、\u4f53\u578bĐợi đãyếu tố nhất quán

Vui lòng sử dụng JSONĐịnh dạngQuay lạiPhân tích kết quả。`;

  const userPrompt = `【Kịch bảthông tin】
Tiêu đề phim truyền hình：《${background.title}》
tổng số tập：${totalEpisodes}đặt
Loại：${background.genre || 'Không rõ'}
thời đại：${background.era || 'hiện đại'}

【Tóm tắt】
${background.outline?.slice(0, 1500) || 'không có'}

【\u9700\u8981Phân tíchNhân vật】
${mainCharacters.map(c => `
Nhân vật：${c.name}
tuổi tác：${c.age || 'Không rõ'}
danh tính：${c.role || 'Không rõ'}
Bên ngoài\u8c8c：${c.appearance || 'Không rõ'}
`).join('\n')}

\u8bf7choMỗi Nhân vậtPhân tích\u662f\u5426\u9700\u8981\u591a\u9636\u6bb5\u5f62\u8c61，\u5e76Tạobiến thể sân khấu\u6570\u636e。

Quay lạiJSONĐịnh dạng：
{
  "analyses": [
    {
      "characterName": "Nhân vậtên t",
      "needsMultiStage": true,
      "reason": "Thời gian\u8de8\u5ea625năm，từtuổi trẻĐếntuổi trung niên...",
      "stages": [
        {
          "name": "phiên bản trẻ",
          "episodeRange": [1, 15],
          "ageDescription": "25 tuổi",
          "stageDescription": "985\u6bd5\u4e1a\u751f，\u610f\u6c14gió\u53d1，\u767d\u886c\u886b",
${promptLanguage !== 'en' ? '          "visualPromptZh": "25 tuổitrong\u56fdNam\u6027，\u5e72\u51c0\u5229\u843dcủaBên ngoài\u8868，\u767d\u8272\u886c\u886b，\u81ea\u4fe1Có\u62b1\u8d1fcủa\u795e\u6001"' : ''}${promptLanguage !== 'zh' ? `${promptLanguage === 'zh+en' ? ',' : ''}\n          "visualPromptEn": "25 year old Chinese male, clean-cut appearance, white dress shirt, confident and ambitious look"` : ''}
        },
        {
          "name": "phiên bản trung niên",
          "episodeRange": [16, 40],
          "ageDescription": "35-40tuổi",
          "stageDescription": "\u4e8b\u4e1aCó\u6210củadoanh nghiệpnhà，\u66f4\u52a0\u6c89\u7a33",
${promptLanguage !== 'en' ? '          "visualPromptZh": "35-40tuổitrong\u56fdNam\u6027，Trưởng thành\u5546\u4eba\u5f62\u8c61，\u526a\u88c1\u5408\u8eabcủa\u897f\u88c5"' : ''}${promptLanguage !== 'zh' ? `${promptLanguage === 'zh+en' ? ',' : ''}\n          "visualPromptEn": "35-40 year old Chinese male, mature businessman look, tailored suit, commanding presence"` : ''}
        }
      ],
      "consistencyElements": {
        "facialFeatures": "sharp jawline, deep-set eyes, straight nose",
        "bodyType": "tall, athletic build, broad shoulders",
        "uniqueMarks": "scar on left wrist"
      }
    }
  ]
}`;

  try {
    // Thống nhất có được cấu hình từ ánh xạ dịch vụ
    const result = await callFeatureAPI('script_analysis', systemPrompt, userPrompt);
    
    // phân tích cú phápJSONkết quả
    let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    
    const parsed = JSON.parse(cleaned);
    return parsed.analyses || [];
  } catch (error) {
    console.error('[CharacterStageAnalyzer] AIPhân tíchThất bại:', error);
    return [];
  }
}

/**
 * \u5c06\u9636\u6bb5Phân tích kết quả\u8f6c\u6362cho CharacterVariation Định dạng
 * \u53ef\u76f4\u63a5sử dụng\u4e8e addVariation()
 */
export function convertStagesToVariations(
  analysis: CharacterStageAnalysis
): Omit<CharacterVariation, 'id'>[] {
  if (!analysis.needsMultiStage || analysis.stages.length === 0) {
    return [];
  }
  
  return analysis.stages.map(stage => ({
    name: stage.name,
    visualPrompt: [
      analysis.consistencyElements.facialFeatures,
      analysis.consistencyElements.bodyType,
      analysis.consistencyElements.uniqueMarks,
      stage.visualPromptEn,
    ].filter(Boolean).join(', '),
    visualPromptZh: stage.visualPromptZh,
    isStageVariation: true,
    episodeRange: stage.episodeRange,
    ageDescription: stage.ageDescription,
    stageDescription: stage.stageDescription,
  }));
}

/**
 * \u6839\u636eđặt\u6570\u83b7\u53d6Nhân vật\u5e94sử dụngcủathay đổi\u4f53
 * 
 * @param variations Nhân vậtcủathay đổi\u4f53danh sách
 * @param episodeIndex hiện tạiđặt\u6570
 * @returns trận đấucủathay đổi\u4f53，nếu khôngbiến thể sân khấu\u5219Quay lại undefined
 */
export function getVariationForEpisode(
  variations: CharacterVariation[],
  episodeIndex: number
): CharacterVariation | undefined {
  // \u53ea\u67e5\u627ebiến thể sân khấu
  const stageVariations = variations.filter(v => v.isStageVariation && v.episodeRange);
  
  if (stageVariations.length === 0) {
    return undefined;
  }
  
  // tìm thấytrận đấuđặt\u6570\u8303\u56f4củathay đổi\u4f53
  return stageVariations.find(v => {
    const [start, end] = v.episodeRange!;
    return episodeIndex >= start && episodeIndex <= end;
  });
}

/**
 * Nhanh\u901fPhát hiệnphác thảo\u662f\u5426chứa\u591a\u9636\u6bb5\u7ebf\u7d22
 * sử dụng\u4e8e\u5728NhậpKịch bản\u65f6Gợi ýNgười dùng
 */
export function detectMultiStageHints(outline: string, totalEpisodes: number): {
  hasTimeSpan: boolean;
  hasAgeChange: boolean;
  suggestMultiStage: boolean;
  hints: string[];
} {
  const hints: string[] = [];
  
  // Phát hiệnThời gian\u8de8\u5ea6（khác nhauĐịnh dạng）
  const yearPatterns = [
    /(\d{4}) năm.*?(\d{4}) năm/,           // 2000năm...2020năm
    /(\d{4})-(\d{4})/,                   // 2000-2020
    /từ(\d{4})Đến(\d{4})/,              // từ2000Đến2020
  ];
  let hasTimeSpan = false;
  for (const pattern of yearPatterns) {
    const yearMatch = outline.match(pattern);
    if (yearMatch) {
      const span = parseInt(yearMatch[2]) - parseInt(yearMatch[1]);
      if (span >= 5) {
        hasTimeSpan = true;
        hints.push(`Thời gian\u8de8\u5ea6${span}năm（${yearMatch[1]}-${yearMatch[2]}）`);
        break;
      }
    }
  }
  
  // Phát hiệntuổi tácthay đổi（khác nhauĐịnh dạng）
  const agePatterns = [
    /(\d+)tuổi.*?(\d+)tuổi/,              // 25 tuổi...50 tuổi
    /(\d+)-(\d+)tuổi/,                   // 25-50 tuổi
    /từ(\d+)tuổiĐến(\d+)tuổi/,             // từ25 tuổiĐến50 tuổi
    /(\d+)Đến(\d+)tuổi/,                  // 25Đến50 tuổi
  ];
  let hasAgeChange = false;
  for (const pattern of agePatterns) {
    const ageMatch = outline.match(pattern);
    if (ageMatch) {
      const ageSpan = parseInt(ageMatch[2]) - parseInt(ageMatch[1]);
      if (ageSpan >= 10) { // tuổi tác\u8de8\u5ea6\u81f3\u5c1110tuổi
        hasAgeChange = true;
        hints.push(`tuổi tác\u8de8\u5ea6${ageMatch[1]}tuổiĐến${ageMatch[2]}tuổi`);
        break;
      }
    }
  }
  
  // Phát hiện\u9636\u6bb5chìa khóa\u8bcd（Danh sách mở rộng）
  const stageKeywords = [
    'tuổi trẻ', 'tuổi trung niên', 'tuổi già', 'vị thành niên', 'người lớn', 'tuổi già', 
    'Giai đoạn đầu', 'giai đoạn sau', 'Giai đoạn đầu', 'Cuối kỳ',
    'năm\u8f7b', 'cũ', 'phát triển', 'năm', 'năm\u534e',
    'Bắt đầu kinh doanh\u521d', 'đỉnh cao sự nghiệp', '\u4e8b\u4e1aCó\u6210', '\u529f\u6210tên\u5c31',
  ];
  const foundKeywords = stageKeywords.filter(k => outline.includes(k));
  if (foundKeywords.length > 0) {
    hints.push(`chứa\u9636\u6bb5chìa khóa\u8bcd：${foundKeywords.join('、')}`);
  }
  
  // \u7efc\u5408\u5224\u65ad - \u964d\u4f4ecửa\u69db
  // 1. 20đặt\u4ee5\u4e0a\u4e14Có\u4efb\u4f55\u7ebf\u7d22
  // 2. hoặc\u800540đặt\u4ee5\u4e0acủanhân vật chính\u5267Mặc định\u9700\u8981\u591a\u9636\u6bb5
  const suggestMultiStage = (
    (totalEpisodes >= 20 && (hasTimeSpan || hasAgeChange || foundKeywords.length >= 1)) ||
    (totalEpisodes >= 40) // 40đặt\u4ee5\u4e0acủanhân vật chính\u5267Mặc định\u9700\u8981
  );
  
  console.log('[detectMultiStageHints]', {
    totalEpisodes,
    hasTimeSpan,
    hasAgeChange,
    foundKeywords,
    suggestMultiStage,
    hints,
  });
  
  return {
    hasTimeSpan,
    hasAgeChange,
    suggestMultiStage,
    hints,
  };
}
