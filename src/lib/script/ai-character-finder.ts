// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * AI Character Finder
 * 
 * Theo Người dùngtự nhiênngôn ngữMô tả，từKịch bảntrong\u67e5\u627eNhân vật\u5e76TạoNH chuyên nghiệpân vật\u6570\u636e
 * 
 * chức năng：
 * 1. Phân tích cú phápười dùngĐầu vào（Chẳng hạn như "thiếuKhông.10đặt\u738b\u5927\u54e5\u8fd9Nhân vật"）
 * 2. Tìm kiếmKịch bảntrongNhân vậthông tin t
 * 3. AI TạoHoàn thànhNhân vật\u6570\u636e（bao gồmLời nhắc trực quan）
 */

import type { ScriptCharacter, ProjectBackground, EpisodeRawScript } from '@/types/script';
import { callFeatureAPI } from '@/lib/ai/feature-router';

// ==================== LoạiĐịnh nghĩa ====================

export interface CharacterSearchResult {
  /** \u662f\u5426tìm thấyNhân vật */
  found: boolean;
  /** Nhân vậtên t */
  name: string;
  /** \u7f6e\u4fe1\u5ea6 0-1 */
  confidence: number;
  /** Số tập đã xuất hiện */
  episodeNumbers: number[];
  /** tìm thấycủa\u4e0a\u4e0b\u6587（đối thoại、CảnhĐợi đã） */
  contexts: string[];
  /** AI Tạo Hoàn thànhNhân vật\u6570\u636e */
  character?: ScriptCharacter;
  /** Tìm kiếmGiải thích */
  message: string;
}

/** @không được dùng nữa không cần phải chuyển thủ công nữa，Tự động thu được từ bản đồ dịch vụ */
export interface FinderOptions {
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
}

// ==================== chức năng cốt lõi ====================

/**
 * Phân tích cú phápười dùngĐầu vào，Trích xuất Nhân vậtên tvàđặt\u6570thông tin
 */
function parseUserQuery(query: string): { name: string | null; episodeNumber: number | null } {
  let name: string | null = null;
  let episodeNumber: number | null = null;
  
  // Bộ trích xuất\u6570：Tập X、Không.X\u8bdd、EP.X、EpX Đợi đã
  const episodeMatch = query.match(/Không.\s*(\d+)\s*[đặt\u8bdd]|EP\.?\s*(\d+)|episode\s*(\d+)/i);
  if (episodeMatch) {
    episodeNumber = parseInt(episodeMatch[1] || episodeMatch[2] || episodeMatch[3]);
  }
  
  // Trích xuất Nhân vậtên t：\u5e38\u89c1chế độ
  // 1. "\u738b\u5927\u54e5\u8fd9Nhân vật" → \u738b\u5927\u54e5
  // 2. "thiếu\u5f20\u5c0f\u5b9d\u8fd9một\u4eba" → \u5f20\u5c0f\u5b9d
  // 3. "\u9700\u8981\u674e\u660e" → \u674e\u660e
  // 4. "Nhân vật：\u5200\u75a4\u54e5" → \u5200\u75a4\u54e5
  
  // Xóađặt\u6570\u76f8\u5173\u6587\u672c
  let cleanQuery = query
    .replace(/Không.\s*\d+\s*[đặt\u8bdd]/g, '')
    .replace(/EP\.?\s*\d+/gi, '')
    .replace(/episode\s*\d+/gi, '')
    .trim();
  
  // chế độ1：X\u8fd9Nhân vật/X\u8fd9một\u4eba
  let nameMatch = cleanQuery.match(/[「「"']?([^「」""'\s,，。！？]+?)[」」"']?\s*\u8fd9một[Nhân vật\u4eba]/);
  if (nameMatch) {
    name = nameMatch[1];
  }
  
  // chế độ2：thiếu/\u9700\u8981/Thêm + Nhân vậtên t
  if (!name) {
    // đầu tiênXóa\u524d\u7f00\u52a8\u8bcd，\u7136\u540e\u53d6\u5269\u4f59một phần\u4f5cchoNhân vậtên t
    nameMatch = cleanQuery.match(/^[thiếu\u9700\u8981Thêm\u627e\u67e5\u60f3\u8bf7\u5e2e\u6211của]+\s*[「「"']?([^「」""'\s,，。！？\u8fd9Nhân vật\u4eba]{2,8})[」」"']?/);
    if (nameMatch) {
      name = nameMatch[1];
    }
  }
  
  // chế độ3：Nhân vật：/Nhân vậtên t：\u540e\u9762củabên trong\u5bb9
  if (!name) {
    nameMatch = cleanQuery.match(/Nhân vật[：:tên]?\s*[「「"']?([^「」""'\s,，。！？]{2,8})[」」"']?/);
    if (nameMatch) {
      name = nameMatch[1];
    }
  }
  
  // chế độ4：\u76f4\u63a5\u5c31\u662fNhân vậtên t（2-8mộttừ\u7b26）
  if (!name) {
    // \u53bb\u6389\u5e38\u89c1\u52a8\u8bcdvà\u52a9\u8bcd
    const pureQuery = cleanQuery.replace(/^[thiếu\u9700\u8981Thêm\u627e\u67e5\u60f3\u8bf7\u5e2e\u6211của]+/g, '').trim();
    if (pureQuery.length >= 2 && pureQuery.length <= 8 && /^[\u4e00-\u9fa5A-Za-z]+$/.test(pureQuery)) {
      name = pureQuery;
    }
  }
  
  return { name, episodeNumber };
}

/**
 * từKịch bảntrongTìm kiếmNhân vật
 */
function searchCharacterInScripts(
  name: string,
  episodeScripts: EpisodeRawScript[],
  targetEpisode?: number
): {
  found: boolean;
  episodeNumbers: number[];
  contexts: string[];
  dialogueSamples: string[];
  sceneSamples: string[];
} {
  const episodeNumbers: number[] = [];
  const contexts: string[] = [];
  const dialogueSamples: string[] = [];
  const sceneSamples: string[] = [];
  
  // \u904d\u5386Kịch bảnTìm kiếm
  const scriptsToSearch = targetEpisode 
    ? episodeScripts.filter(ep => ep.episodeIndex === targetEpisode)
    : episodeScripts;
  
  for (const ep of scriptsToSearch) {
    if (!ep || !ep.scenes) continue;
    
    let foundInEpisode = false;
    
    for (const scene of ep.scenes) {
      if (!scene) continue;
      
      // \u68c0\u67e5Cảnh nhân vậdanh sách t
      const hasInCharacters = scene.characters?.some(c => 
        c === name || c.includes(name) || name.includes(c)
      );
      
      // \u68c0\u67e5đối thoại
      const relevantDialogues = scene.dialogues?.filter(d => 
        d.character === name || d.character.includes(name) || name.includes(d.character)
      ) || [];
      
      if (hasInCharacters || relevantDialogues.length > 0) {
        if (!foundInEpisode) {
          episodeNumbers.push(ep.episodeIndex);
          foundInEpisode = true;
        }
        
        // \u6536đặtCảnh thông tin
        if (sceneSamples.length < 3) {
          sceneSamples.push(`Không.${ep.episodeIndex}đặt - ${scene.sceneHeader || 'Cảnh'}`);
        }
        
      // Thu thập mẫu đối thoại
        for (const d of relevantDialogues.slice(0, 3)) {
          if (dialogueSamples.length < 5) {
            dialogueSamples.push(`${d.character}: ${d.line.slice(0, 50)}${d.line.length > 50 ? '...' : ''}`);
          }
        }
        
        // \u6536đặt\u4e0a\u4e0b\u6587
        if (contexts.length < 5) {
          const sceneContext = [
            `【${scene.sceneHeader || 'Cảnh'}】`,
            scene.characters?.length ? `nhân vật: ${scene.characters.join(', ')}` : '',
            ...relevantDialogues.slice(0, 2).map(d => `${d.character}: ${d.line.slice(0, 30)}...`),
          ].filter(Boolean).join('\n');
          contexts.push(sceneContext);
        }
      }
    }
  }
  
  return {
    found: episodeNumbers.length > 0,
    episodeNumbers,
    contexts,
    dialogueSamples,
    sceneSamples,
  };
}

/**
 * sử dụng AI TạoHoàn thànhNhân vật\u6570\u636e
 */
async function generateCharacterData(
  name: string,
  background: ProjectBackground,
  contexts: string[],
  dialogueSamples: string[]
): Promise<ScriptCharacter> {
  
  // Phát hiệnKịch bảnLoại：\u53e4\u88c5/tương lai/hiện đại
  const detectStoryType = () => {
    const era = (background.era || '');
    const timeline = (background.timelineSetting || '');
    const genre = (background.genre || '');
    const outline = (background.outline || '');
    const startYear = background.storyStartYear;
    
    console.log('[detectStoryType] background:', {
      era,
      timeline,
      genre,
      storyStartYear: startYear,
      hasOutline: !!outline,
    });
    
    // nếu có\u660e\u786ecủa storyStartYear \u4e14\u662f\u8fd1hiện đạinăm\u4efd（1800năm\u4ee5\u540e），\u76f4\u63a5\u5224\u5b9achohiện đại\u5267
    if (startYear && startYear >= 1800) {
      console.log('[detectStoryType] Phát hiệnkết quả: modern (Dựa trên storyStartYear:', startYear, ')');
      return 'modern';
    }
    
    // Chẳng hạn như\u679c storyStartYear \u4e0d\u5b58\u5728，\u5c1d\u8bd5từ outline/era/timeline trongTrích xuấtnăm\u4efd
    const textForYearExtraction = `${era} ${timeline} ${outline}`;
    const yearMatch = textForYearExtraction.match(/(19\d{2}|20\d{2})\s*năm/);
    if (yearMatch) {
      const extractedYear = parseInt(yearMatch[1]);
      console.log('[detectStoryType] Phát hiệnkết quả: modern (từ\u6587\u672cTrích xuấtnăm\u4efd:', extractedYear, ')');
      return 'modern';
    }
    
    // \u53e4\u88c5\u5267chìa khóa\u8bcd（\u660e\u786ecủathời cổ đạicài đặt）
    const ancientKeywords = ['thời cổ đại', '\u53e4\u88c5', 'võ thuật', 'Tiên Hạ', 'nhà Đường', 'Nhà Tống', 'nhà Minh', 'nhà Thanh', 'nhà Hán', 'Tam Quốc', 'Thời Chiến Quốc', '\u79e6\u671d', 'cung điện', 'cung điện hoàng gia', 'giang hồ', 'trồng trọt', 'tưởng tượng', '\u795e\u8bdd', '\u4f20nói', '\u671d\u4ee3', 'hoàng đế', 'Bộ trưởng', '\u592a\u76d1', 'vợ lẽ'];
    // tương lai/khoa học viễn tưởngchìa khóa\u8bcd
    const futureKeywords = ['tương lai', 'khoa học viễn tưởng', 'không gian', 'liên sao', 'người máy', 'cyberpunk', '\u672bngày', 'hậu tận thế', 'viễn tưởng', 'trí tuệ nhân tạo', '2100', '2200', '2300'];
    
    const allText = `${era} ${timeline} ${genre} ${outline}`;
    
    if (ancientKeywords.some(kw => allText.includes(kw))) {
      console.log('[detectStoryType] Phát hiệnkết quả: ancient (Dựa trênchìa khóa\u8bcd)');
      return 'ancient';
    }
    if (futureKeywords.some(kw => allText.includes(kw))) {
      console.log('[detectStoryType] Phát hiệnkết quả: future (Dựa trênchìa khóa\u8bcd)');
      return 'future';
    }
    console.log('[detectStoryType] Phát hiệnkết quả: modern (Mặc định)');
    return 'modern';
  };
  
  const storyType = detectStoryType();
  
  // Theo K.ịch bảnLoại\u6784\u5efaquần áo\u6307\u5bfc
  const getEraFashionGuidance = () => {
    // \u53e4\u88c5\u5267
    if (storyType === 'ancient') {
      const era = background.era || background.timelineSetting || 'thời cổ đại';
      return `【${era}quần áo\u6307\u5bfc】
Xin vui lòng Theo K.ịch bảncài đặtcủaLịch sửthời đại\u8bbe\u8ba1quần áo：
- Chẳng hạn như\u679c\u662f\u5ba2\u68a8hoặcvõ thuật：thời cổ đại\u6c49\u670d、hiệp sĩ\u670d\u9970、\u5e03\u8863\u8349\u978b
- Chẳng hạn như\u679c\u662fcung điện：cung điện\u88c5、\u671d\u670d、\u5b98\u670d
- Chẳng hạn như\u679c\u662fTiên Hạ/tưởng tượng：Tiên HạPhong cáchcủa\u670d\u9970、\u98d8\u9038áo choàng
\u8bf7\u6839\u636eNhân vậtdanh tính（\u5e73\u6c11/\u8d35\u65cf/hiệp sĩ/\u5b98\u5458）\u8bbe\u8ba1\u5408\u9002củathời cổ đạiquần áo。`;
    }
    
    // tương lai/khoa học viễn tưởng\u5267
    if (storyType === 'future') {
      return `【tương lai/khoa học viễn tưởngquần áo\u6307\u5bfc】
Xin vui lòng Theo K.ịch bảncài đặt\u8bbe\u8ba1tương laiPhong cáchquần áo：
- \u79d1\u6280\u611f\u670d\u9970、chức năng\u6027\u88c5\u5907、\u667a\u80fd\u7a7f\u6234
- Theocài đặt\u53ef\u4ee5\u662f\u4e4c\u6258\u90a6Phong cáchhoặcviễn tưởngPhong cách
- Lưu ýNhân vậtdanh tính（\u5e73\u6c11/\u79d1\u5b66nhà/\u519b\u4eba/\u673a\u68b0phép chia）`;
    }
    
    // hiện đại\u5267 - Theo\u5177\u4f53thời đại
    const startYear = background.storyStartYear;
    
    if (startYear) {
      if (startYear >= 2020) {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
- năm\u8f7b\u4eba：\u4f11\u95f2\u65f6\u5c1a、các môn thể thaogió、\u6f6e\u724cphần tử，\u5e38\u7a7f\u536b\u8863、\u7275\u4ed4\u88e4、các môn thể thao\u978b
- tuổi trung niên\u4eba：\u5546\u52a1\u4f11\u95f2、\u7b80khoảnghiện đại，\u5e38\u7a7fPolo\u886b、\u4f11\u95f2\u897f\u88c5、\u5361\u5176\u88e4
- tuổi già\u4eba：Thoải mái\u4f11\u95f2，\u5e38\u7a7f\u5f00\u886b、\u5355\u5b50\u886b、\u5e03\u978bhoặccác môn thể thao\u978b`;
      } else if (startYear >= 2010) {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
- năm\u8f7b\u4eba：\u97e9\u7cfb\u65f6\u5c1a、\u5c0f\u6e05\u65b0Phong cách，\u5e38\u7a7fáo phông、\u7275\u4ed4\u88e4、\u5e06\u5e03\u978b
- tuổi trung niên\u4eba：\u5546\u52a1trang phục chính thứchoặc\u5546\u52a1\u4f11\u95f2，\u5e38\u7a7f\u897f\u88c5、\u886c\u886b、\u76ae\u978b
- tuổi già\u4eba：\u4f20\u7edf\u4f11\u95f2，\u5e38\u7a7f\u5f00\u886b、\u5e03\u978b`;
      } else if (startYear >= 2000) {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
- năm\u8f7b\u4eba：ngàn\u79a7năm\u65f6\u5c1a，\u5e38\u7a7f\u7d27\u8eab\u88e4、lỏng lẻoBên ngoài\u5957、\u677f\u978b
- tuổi trung niên\u4eba：\u6b63\u5f0f\u5546\u52a1\u88c5，\u5e38\u7a7f\u897f\u88c5\u5957\u88c5、\u9886\u5e26、\u76ae\u978b
- tuổi già\u4eba：trongnúi\u88c5hoặc\u7b80\u5355\u5f00\u886b、\u5e03\u978b`;
      } else if (startYear >= 1990) {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
- năm\u8f7b\u4eba：loa\u88e4、của\u786e\u826fBên ngoài\u5957、\u5927\u80a9\u57ab\u897f\u88c5
- tuổi trung niên\u4eba：trongnúi\u88c5hoặc\u897f\u88c5，giải phóng\u978bhoặc\u7b80\u5355\u76ae\u978b
- tuổi già\u4eba：trongnúi\u88c5、áo khoác đệm bông、\u5e03\u978b`;
      } else {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
\u8bf7\u6839\u636e\u8be5thời đạicủatrong\u56fd\u5b9e\u9645quần áoPhong cách thiết kế`;
      }
    }
    
    // Mặc định hiện đại
    return `【hiện đạiquần áo\u6307\u5bfc】
\u8bf7\u8bbe\u8ba1\u7b26\u5408đương đạitrong\u56fdcủaquần áoPhong cách，\u6839\u636eNhân vậtuổi tácvàdanh tính\u9009\u62e9\u5408\u9002củahiện đạiquần áo。`;
  };
  
  // \u6784\u5efathông tin tuổi tácchuỗi
  const getEraInfo = () => {
    if (storyType === 'ancient') {
      return `Thời đại Nền：${background.era || background.timelineSetting || 'thời cổ đại'}`;
    }
    if (storyType === 'future') {
      return `Thời đại Nền：${background.era || background.timelineSetting || 'tương lai'}`;
    }
    if (background.storyStartYear) {
      return `năm câu chuyện：${background.storyStartYear}năm${background.storyEndYear && background.storyEndYear !== background.storyStartYear ? ` - ${background.storyEndYear}năm` : ''}`;
    }
    return `Thời đại Nền：${background.era || background.timelineSetting || 'hiện đại'}`;
  };
  
  const eraInfo = getEraInfo();
  const eraFashionGuidance = getEraFashionGuidance();
  
  const systemPrompt = `\u4f60\u662f\u4e13\u4e1acủa\u5f71\u89c6Nhân vật\u8bbe\u8ba1phép chia，\u64c5\u957ftừKịch bảthông tintrong\u63d0\u70bcNhân vật\u7279\u5f81\u5e76TạoNH chuyên nghiệpân vật\u6570\u636e。

\u8bf7\u6839\u636e\u63d0\u4f9bcủaKịch bảthông tinvàNhân vật\u4e0a\u4e0b\u6587，TạoHoàn thànhNhân vật\u6570\u636e。

【quần áo\u8bbe\u8ba1yêu cầu】
${eraFashionGuidance}

quần áo\u5fc5\u987bvớiKịch bảnThời đại Nềnmột\u81f4，\u4e0d\u8981\u6df7\u6dc6\u4e0d\u540cthời đạtôi làquần áoPhong cách。

【Đầu raĐịnh dạng】
Xin hãy quay lạiạiJSONĐịnh dạng，chứa\u4ee5\u4e0btừ\u6bb5：
{
  "name": "Nhân vậtên t",
  "gender": "Nam/Nữ",
  "age": "tuổi tácMô tả，Chẳng hạn như '30tuổi\u5de6\u53f3' hoặc 'tuổi trung niên'",
  "personality": "Đặc điểm tính cách，2-3một\u8bcd",
  "role": "Nhân vậtdanh tính/Sự nghiệp/\u5728\u5267trongcủa\u4f5csử dụng",
  "appearance": "đặc điểm vật lýMô tả（quần áo\u5fc5\u987b\u7b26\u5408thời đại）",
  "relationships": "với Nh khácân vậmối quan hệ",
  "visualPromptEn": "Lời nhắc trực quan bằng tiếng Anh，cho hình ảnh AI Tạo，Mô tảBên ngoài\u8c8c、quần áo（\u5fc5\u987b\u7b26\u5408thời đại）、tính khí",
  "visualPromptZh": "Lời nhắc trực quan của Trung Quốc",
  "importance": "protagonist/supporting/minor"
}`;

  const userPrompt = `【Kịch bảthông tin】
Tiêu đề phim truyền hình：《${background.title}》
Loại：${background.genre || '\u5267\u60c5'}
${eraInfo}

【Tóm tắt】
${background.outline?.slice(0, 1000) || 'không có'}

【Tiểu sử】
${background.characterBios?.slice(0, 800) || 'không có'}

【\u8981Phân tíchNhân vật】
${name}

【Nhân vậtxuất hiệnContext】
${contexts.slice(0, 3).join('\n\n')}

【Nhân vậtmẫu đối thoại】
${dialogueSamples.join('\n')}

\u8bf7Dựa trên\u4ee5\u4e0athông tin，TạoNhân vật「${name}」của\u5b8csố nguyên\u636e。

【quan trọng】quần áo\u5fc5\u987b\u7b26\u5408câu chuyệnThời đại Nền（${eraInfo}）！`;

  try {
    // Thống nhất có được cấu hình từ ánh xạ dịch vụ
    const result = await callFeatureAPI('script_analysis', systemPrompt, userPrompt);
    
    // Phân tích cú pháp JSON
    let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    
    const parsed = JSON.parse(cleaned);
    
    // \u786e\u4fddTất cảtừ\u6bb5\u90fd\u662fchuỗiLoại（AI \u53ef\u80fdQuay lại\u5bf9\u8c61）
    const ensureString = (val: any): string | undefined => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        // Chẳng hạn như\u679c\u662f\u5bf9\u8c61，\u5c1d\u8bd5\u8f6c\u6362chochuỗi
        if (Array.isArray(val)) {
          return val.join(', ');
        }
        // \u5bf9\u8c61\u8f6c\u6362cho\u952e\u503c\u5bf9chuỗi
        return Object.entries(val)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
      }
      return String(val);
    };
    
    return {
      id: `char_${Date.now()}`,
      name: ensureString(parsed.name) || name,
      gender: ensureString(parsed.gender),
      age: ensureString(parsed.age),
      personality: ensureString(parsed.personality),
      role: ensureString(parsed.role),
      appearance: ensureString(parsed.appearance),
      relationships: ensureString(parsed.relationships),
      visualPromptEn: ensureString(parsed.visualPromptEn),
      visualPromptZh: ensureString(parsed.visualPromptZh),
      tags: [parsed.importance || 'minor', 'AITạo'],
    };
  } catch (error) {
    console.error('[generateCharacterData] AITạoThất bại:', error);
    // Quay lạiCơ bảdữ liệu
    return {
      id: `char_${Date.now()}`,
      name,
      tags: ['AITạo'],
    };
  }
}

/**
 * Chúa ơichức năng：Theo Người dùngMô tả\u67e5\u627e\u5e76TạoNhân vật
 */
export async function findCharacterByDescription(
  userQuery: string,
  background: ProjectBackground,
  episodeScripts: EpisodeRawScript[],
  existingCharacters: ScriptCharacter[],
  _options?: FinderOptions // không còn cần thiết nữa，dành riêng cho khả năng tương thích
): Promise<CharacterSearchResult> {
  console.log('[findCharacterByDescription] Người dùngTruy vấn:', userQuery);
  
  // 1. Phân tích cú phápười dùngĐầu vào
  const { name, episodeNumber } = parseUserQuery(userQuery);
  
  if (!name) {
    return {
      found: false,
      name: '',
      confidence: 0,
      episodeNumbers: [],
      contexts: [],
      message: 'không có\u6cd5\u8bc6\u522bNhân vậtên t。\u8bf7sử dụng\u7c7b\u4f3c"thiếuKhông.10đặt\u738b\u5927\u54e5"hoặc"Thêm\u5f20\u5c0f\u5b9d\u8fd9Nhân vật"của\u65b9\u5f0fMô tả。',
    };
  }
  
  console.log('[findCharacterByDescription] Phân tích kết quả:', { name, episodeNumber });
  
  // 2. \u68c0\u67e5\u662f\u5426Đã rồi\u5b58\u5728
  const existing = existingCharacters.find(c => 
    c.name === name || c.name.includes(name) || name.includes(c.name)
  );
  
  if (existing) {
    return {
      found: true,
      name: existing.name,
      confidence: 1,
      episodeNumbers: [],
      contexts: [],
      message: `Nhân vật「${existing.name}」Đã rồi\u5b58\u5728\u4e8eNhân vậdanh sách ttrong。`,
      character: existing,
    };
  }
  
  // 3. từKịch bảntrongTìm kiếm
  const searchResult = searchCharacterInScripts(name, episodeScripts, episodeNumber || undefined);
  
  if (!searchResult.found) {
    // \u6ca1tìm thấy\u4f46\u53ef\u4ee5\u8ba9Người dùngXác nhận liệu Tạo
    return {
      found: false,
      name,
      confidence: 0.3,
      episodeNumbers: [],
      contexts: [],
      message: episodeNumber 
        ? `ở Không. ${episodeNumber} đặttrong\u672atìm thấyNhân vật「${name}」。Bạn vẫn muốn Tạo\u8fd9Nhân vật？`
        : `ở Kịch bảntrong\u672atìm thấyNhân vật「${name}」。Bạn vẫn muốn Tạo\u8fd9Nhân vật？`,
    };
  }
  
  // 4. sử dụng AI TạoHoàn thànhNhân vật\u6570\u636e
  console.log('[findCharacterByDescription] Là TạoNhân vật\u6570\u636e...');
  
  const character = await generateCharacterData(
    name,
    background,
    searchResult.contexts,
    searchResult.dialogueSamples
  );
  
  // Tính toán\u7f6e\u4fe1\u5ea6
  const confidence = Math.min(
    0.5 + searchResult.dialogueSamples.length * 0.1 + searchResult.episodeNumbers.length * 0.05,
    1
  );
  
  return {
    found: true,
    name: character.name,
    confidence,
    episodeNumbers: searchResult.episodeNumbers,
    contexts: searchResult.contexts,
    message: `tìm thấyNhân vật「${character.name}」，\u51fa\u73b0ở Không. ${searchResult.episodeNumbers.join(', ')} đặt。`,
    character,
  };
}

/**
 * \u4ec5Tìm kiếm（\u4e0d\u8c03sử dụngAI），sử dụng\u4e8eNhanh\u901fXem trước
 */
export function quickSearchCharacter(
  userQuery: string,
  episodeScripts: EpisodeRawScript[],
  existingCharacters: ScriptCharacter[]
): { name: string | null; found: boolean; message: string; existingChar?: ScriptCharacter } {
  const { name, episodeNumber } = parseUserQuery(userQuery);
  
  if (!name) {
    return { name: null, found: false, message: 'Vui lòng nhậpNhân vậtên t' };
  }
  
  // \u68c0\u67e5Đã rồi\u5b58\u5728
  const existing = existingCharacters.find(c => 
    c.name === name || c.name.includes(name) || name.includes(c.name)
  );
  
  if (existing) {
    return { 
      name: existing.name, 
      found: true, 
      message: `Nhân vật「${existing.name}」Đã rồi\u5b58\u5728`,
      existingChar: existing,
    };
  }
  
  // Nhanh\u901fTìm kiếm
  const searchResult = searchCharacterInScripts(name, episodeScripts, episodeNumber || undefined);
  
  if (searchResult.found) {
    return {
      name,
      found: true,
      message: `tìm thấy「${name}」，\u51fa\u73b0ở Không. ${searchResult.episodeNumbers.join(', ')} đặt`,
    };
  }
  
  return {
    name,
    found: false,
    message: `\u672aở Kịch bảntrongtìm thấy「${name}」`,
  };
}
