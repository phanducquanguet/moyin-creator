// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * AI Scene Finder
 * 
 * Theo Người dùngtự nhiênngôn ngữMô tả，từKịch bảntrongTìm Cảnh\u5e76TạoC chuyên nghiệpảnh dữ liệu
 * 
 * chức năng：
 * 1. Phân tích cú phápười dùngĐầu vào（Chẳng hạn như "thiếuKhông.5Bộ Phòng khách của Trương"）
 * 2. Tìm kiếmKịch bảC trong nảnh thông tin
 * 3. AI TạoHoàn thành Cảnh dữ liệu（bao gồmLời nhắc trực quan）
 */

import type { ScriptScene, ProjectBackground, EpisodeRawScript, SceneRawContent } from '@/types/script';
import { callFeatureAPI } from '@/lib/ai/feature-router';

// ==================== LoạiĐịnh nghĩa ====================

export interface SceneSearchResult {
  /** \u662f\u5426tìm thấyCảnh */
  found: boolean;
  /** Cảnh tên/vị trí */
  name: string;
  /** \u7f6e\u4fe1\u5ea6 0-1 */
  confidence: number;
  /** Số tập đã xuất hiện */
  episodeNumbers: number[];
  /** tìm thấycủa\u4e0a\u4e0b\u6587（Cảnh nội dungĐợi đã） */
  contexts: string[];
  /** AI Tạo Hoàn thành Cảnh dữ liệu */
  scene?: ScriptScene;
  /** Tìm kiếmGiải thích */
  message: string;
}

/** @không được dùng nữa không cần phải chuyển thủ công nữa，Tự động thu được từ bản đồ dịch vụ */
export interface SceneFinderOptions {
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
}

// ==================== chức năng cốt lõi ====================

/**
 * Phân tích cú phápười dùngĐầu vào，Trích xuấtCảnh tênvàđặt\u6570thông tin
 */
function parseSceneQuery(query: string): { name: string | null; episodeNumber: number | null } {
  let name: string | null = null;
  let episodeNumber: number | null = null;
  
  // Bộ trích xuất\u6570：Tập X、Không.X\u8bdd、EP.X、EpX Đợi đã
  const episodeMatch = query.match(/Không.\s*(\d+)\s*[đặt\u8bdd]|EP\.?\s*(\d+)|episode\s*(\d+)/i);
  if (episodeMatch) {
    episodeNumber = parseInt(episodeMatch[1] || episodeMatch[2] || episodeMatch[3]);
  }
  
  // Xóađặt\u6570\u76f8\u5173\u6587\u672c
  let cleanQuery = query
    .replace(/Không.\s*\d+\s*[đặt\u8bdd]/g, '')
    .replace(/EP\.?\s*\d+/gi, '')
    .replace(/episode\s*\d+/gi, '')
    .trim();
  
  // chế độ1：XC nàyảnh/X\u8fd9mộtvị trí/X\u8fd9mộtNền
  let nameMatch = cleanQuery.match(/[「「"']?([^「」""'\s,，。！？]+?)[」」"']?\s*\u8fd9một[Cảvị trí nhNềnmôi trường]/);
  if (nameMatch) {
    name = nameMatch[1];
  }
  
  // chế độ2：thiếu/\u9700\u8981/Thêm + Cảnh tên
  if (!name) {
    nameMatch = cleanQuery.match(/^[thiếu\u9700\u8981Thêm\u627e\u67e5\u60f3\u8bf7\u5e2e\u6211của]+\s*[「「"']?([^「」""'\s,，。！？C nàyảvị trí nh]{2,15})[」」"']?/);
    if (nameMatch) {
      name = nameMatch[1];
    }
  }
  
  // chế độ3：Cảnh：/vị trí：\u540e\u9762củabên trong\u5bb9
  if (!name) {
    nameMatch = cleanQuery.match(/[Cảvị trí nhNền][：:tên]?\s*[「「"']?([^「」""'\s,，。！？]{2,15})[」」"']?/);
    if (nameMatch) {
      name = nameMatch[1];
    }
  }
  
  // chế độ4：\u76f4\u63a5\u5c31\u662fCảnh tên（2-15mộttừ\u7b26）
  if (!name) {
    const pureQuery = cleanQuery.replace(/^[thiếu\u9700\u8981Thêm\u627e\u67e5\u60f3\u8bf7\u5e2e\u6211của]+/g, '').trim();
    if (pureQuery.length >= 2 && pureQuery.length <= 15 && /^[\u4e00-\u9fa5A-Za-z\s]+$/.test(pureQuery)) {
      name = pureQuery;
    }
  }
  
  return { name, episodeNumber };
}

/**
 * từKịch bảntrongTìm kiếmCảnh
 */
function searchSceneInScripts(
  name: string,
  episodeScripts: EpisodeRawScript[],
  targetEpisode?: number
): {
  found: boolean;
  episodeNumbers: number[];
  contexts: string[];
  matchedScenes: { episodeIndex: number; scene: SceneRawContent }[];
} {
  const episodeNumbers: number[] = [];
  const contexts: string[] = [];
  const matchedScenes: { episodeIndex: number; scene: SceneRawContent }[] = [];
  
  // \u904d\u5386Kịch bảnTìm kiếm
  const scriptsToSearch = targetEpisode 
    ? episodeScripts.filter(ep => ep.episodeIndex === targetEpisode)
    : episodeScripts;
  
  for (const ep of scriptsToSearch) {
    if (!ep || !ep.scenes) continue;
    
    for (const scene of ep.scenes) {
      if (!scene) continue;
      
      // \u68c0\u67e5Cảnh đầu\u662f\u5426trận đấu（Cảnh đầu\u901a\u5e38chứavị tríthông tin）
      const sceneHeader = scene.sceneHeader || '';
      const isMatch = 
        sceneHeader.includes(name) || 
        name.includes(sceneHeader.split(/\s+/).slice(-1)[0] || '') || // trận đấu\u6700\u540emộtmột\u8bcd（\u901a\u5e38\u662fvị trí）
        sceneHeader.split(/\s+/).some(word => word.includes(name) || name.includes(word));
      
      if (isMatch) {
        if (!episodeNumbers.includes(ep.episodeIndex)) {
          episodeNumbers.push(ep.episodeIndex);
        }
        
        matchedScenes.push({ episodeIndex: ep.episodeIndex, scene });
        
        // \u6536đặt\u4e0a\u4e0b\u6587
        if (contexts.length < 5) {
          const sceneContext = [
            `【Không.${ep.episodeIndex}đặt - ${sceneHeader}】`,
            scene.characters?.length ? `nhân vật: ${scene.characters.join(', ')}` : '',
            scene.actions?.slice(0, 2).join('\n') || '',
            scene.dialogues?.slice(0, 2).map(d => `${d.character}: ${d.line.slice(0, 30)}...`).join('\n') || '',
          ].filter(Boolean).join('\n');
          contexts.push(sceneContext);
        }
      }
    }
  }
  
  return {
    found: matchedScenes.length > 0,
    episodeNumbers,
    contexts,
    matchedScenes,
  };
}

/**
 * sử dụng AI TạoHoàn thành Cảnh dữ liệu
 */
async function generateSceneData(
  name: string,
  background: ProjectBackground,
  contexts: string[],
  matchedScenes: { episodeIndex: number; scene: SceneRawContent }[]
): Promise<ScriptScene> {
  
  // từtrận đấuCảnhtrongTrích xuấtthông tin
  const sceneHeaders = matchedScenes.map(s => s.scene.sceneHeader).filter(Boolean);
  const allActions = matchedScenes.flatMap(s => s.scene.actions || []).slice(0, 5);
  const allCharacters = [...new Set(matchedScenes.flatMap(s => s.scene.characters || []))];
  
  const systemPrompt = `\u4f60\u662f\u4e13\u4e1acủa\u5f71\u89c6Cảnh nhà thiết kế，\u64c5\u957ftừKịch bảthông tintrong\u63d0\u70bcCảnh\u7279\u5f81\u5e76TạoC chuyên nghiệpảnh dữ liệu。

\u8bf7\u6839\u636e\u63d0\u4f9bcủaKịch bảthông tinvàCảnh\u4e0a\u4e0b\u6587，TạoHoàn thành Cảnh dữ liệu。

【Đầu raĐịnh dạng】
Xin hãy quay lạiạiJSONĐịnh dạng，chứa\u4ee5\u4e0btừ\u6bb5：
{
  "name": "CảnhTên（\u7b80\u77ed）",
  "location": "vị tríChi tiếtMô tả",
  "time": "Thời gian（Chẳng hạn như 'Ban ngày'、'Ban đêm'、'Hoàng hôn'、'sáng sớm'）",
  "atmosphere": "Khí quyển Mô tả（Chẳng hạn như 'lo lắng'、'Sự ấm áp'、'chán nản'、'\u70ed\u95f9'）",
  "visualPrompt": "Lời nhắc trực quan bằng tiếng Anh，cho hình ảnh AI Tạo，Mô tảCảmôi trường、ánh sáng、Tông màu、Kiến trúcPhong cáchĐợi đã",
  "visualPromptZh": "Tầm nhìn Trung Quốc Mô tả",
  "tags": ["nhãn1", "nhãn2"],
  "notes": "CảnhNhận xét（\u5267\u60c5\u4f5csử dụng）"
}`;

  const userPrompt = `【Kịch bảthông tin】
Tiêu đề phim truyền hình：《${background.title}》
Loại：${background.genre || '\u5267\u60c5'}
thời đại：${background.era || 'hiện đại'}

【Tóm tắt】
${background.outline?.slice(0, 800) || 'không có'}

【thế giới quan/Phong cácài đặt ch】
${background.worldSetting?.slice(0, 500) || 'không có'}

【\u8981Phân tíchCảnh】
${name}

【Cảnh\u51fa\u73b0Cảnh đầu】
${sceneHeaders.slice(0, 5).join('\n')}

【Cảnhbên trongHành động mô tả】
${allActions.join('\n')}

【Cảnhbên trong\u51fa\u73b0củanhân vật】
${allCharacters.join(', ')}

【Cảnh\u4e0a\u4e0b\u6587】
${contexts.slice(0, 3).join('\n\n')}

\u8bf7Dựa trên\u4ee5\u4e0athông tin，TạoCảnh「${name}」của\u5b8csố nguyên\u636e。Chẳng hạn như\u679cthông tin\u4e0d\u8db3，Xin vui lòng Theo K.ịch bảnLoạivàThời đại Nền\u5408\u7406suy luận。`;

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
        if (Array.isArray(val)) {
          return val.join(', ');
        }
        return Object.entries(val)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
      }
      return String(val);
    };
    
    // \u786e\u4fdd tags \u662fchuỗi\u6570\u7ec4
    const ensureTags = (val: any): string[] | undefined => {
      if (!val) return undefined;
      if (Array.isArray(val)) {
        return val.map(t => String(t));
      }
      if (typeof val === 'string') {
        return val.split(/[,，、]/).map(t => t.trim()).filter(Boolean);
      }
      return undefined;
    };
    
    return {
      id: `scene_${Date.now()}`,
      name: ensureString(parsed.name) || name,
      location: ensureString(parsed.location) || name,
      time: ensureString(parsed.time) || 'Ban ngày',
      atmosphere: ensureString(parsed.atmosphere) || '',
      visualPrompt: ensureString(parsed.visualPrompt),
      tags: ensureTags(parsed.tags),
      notes: ensureString(parsed.notes),
    };
  } catch (error) {
    console.error('[generateSceneData] AITạoThất bại:', error);
    // Quay lạiCơ bảdữ liệu
    return {
      id: `scene_${Date.now()}`,
      name,
      location: name,
      time: 'Ban ngày',
      atmosphere: '',
    };
  }
}

/**
 * Chúa ơichức năng：Theo Người dùngMô tả\u67e5\u627e\u5e76TạoCảnh
 */
export async function findSceneByDescription(
  userQuery: string,
  background: ProjectBackground,
  episodeScripts: EpisodeRawScript[],
  existingScenes: ScriptScene[],
  _options?: SceneFinderOptions // không còn cần thiết nữa，dành riêng cho khả năng tương thích
): Promise<SceneSearchResult> {
  console.log('[findSceneByDescription] Người dùngTruy vấn:', userQuery);
  
  // 1. Phân tích cú phápười dùngĐầu vào
  const { name, episodeNumber } = parseSceneQuery(userQuery);
  
  if (!name) {
    return {
      found: false,
      name: '',
      confidence: 0,
      episodeNumbers: [],
      contexts: [],
      message: 'không có\u6cd5\u8bc6\u522bCảnh tên。\u8bf7sử dụng\u7c7b\u4f3c"thiếuKhông.5Bộ Phòng khách của Trương"hoặc"Thêmbệnh việnđi\u5ecaC nàyảnh"của\u65b9\u5f0fMô tả。',
    };
  }
  
  console.log('[findSceneByDescription] Phân tích kết quả:', { name, episodeNumber });
  
  // 2. \u68c0\u67e5\u662f\u5426Đã rồi\u5b58\u5728
  const existing = existingScenes.find(s => 
    s.name === name || 
    s.location === name || 
    (s.name && (s.name.includes(name) || name.includes(s.name))) ||
    s.location.includes(name) || 
    name.includes(s.location)
  );
  
  if (existing) {
    return {
      found: true,
      name: existing.name || existing.location,
      confidence: 1,
      episodeNumbers: [],
      contexts: [],
      message: `Cảnh「${existing.name || existing.location}」Đã rồi\u5b58\u5728\u4e8eCảnh danh sáchtrong。`,
      scene: existing,
    };
  }
  
  // 3. từKịch bảntrongTìm kiếm
  const searchResult = searchSceneInScripts(name, episodeScripts, episodeNumber || undefined);
  
  if (!searchResult.found) {
    // \u6ca1tìm thấy\u4f46\u53ef\u4ee5\u8ba9Người dùngXác nhận liệu Tạo
    return {
      found: false,
      name,
      confidence: 0.3,
      episodeNumbers: [],
      contexts: [],
      message: episodeNumber 
        ? `ở Không. ${episodeNumber} đặttrong\u672atìm thấyCảnh「${name}」。Bạn vẫn muốn TạoC nàyảnh？`
        : `ở Kịch bảntrong\u672atìm thấyCảnh「${name}」。Bạn vẫn muốn TạoC nàyảnh？`,
    };
  }
  
  // 4. sử dụng AI TạoHoàn thành Cảnh dữ liệu
  console.log('[findSceneByDescription] Là TạoCảnh dữ liệu...');
  
  const scene = await generateSceneData(
    name,
    background,
    searchResult.contexts,
    searchResult.matchedScenes
  );
  
  // Tính toán\u7f6e\u4fe1\u5ea6
  const confidence = Math.min(
    0.5 + searchResult.matchedScenes.length * 0.1 + searchResult.episodeNumbers.length * 0.05,
    1
  );
  
  return {
    found: true,
    name: scene.name || scene.location,
    confidence,
    episodeNumbers: searchResult.episodeNumbers,
    contexts: searchResult.contexts,
    message: `tìm thấyCảnh「${scene.name || scene.location}」，\u51fa\u73b0ở Không. ${searchResult.episodeNumbers.join(', ')} đặt。`,
    scene,
  };
}

/**
 * \u4ec5Tìm kiếm（\u4e0d\u8c03sử dụngAI），sử dụng\u4e8eNhanh\u901fXem trước
 */
export function quickSearchScene(
  userQuery: string,
  episodeScripts: EpisodeRawScript[],
  existingScenes: ScriptScene[]
): { name: string | null; found: boolean; message: string; existingScene?: ScriptScene } {
  const { name, episodeNumber } = parseSceneQuery(userQuery);
  
  if (!name) {
    return { name: null, found: false, message: 'Vui lòng nhậpCảnh tên' };
  }
  
  // \u68c0\u67e5Đã rồi\u5b58\u5728
  const existing = existingScenes.find(s => 
    s.name === name || 
    s.location === name ||
    (s.name && (s.name.includes(name) || name.includes(s.name))) ||
    s.location.includes(name) || 
    name.includes(s.location)
  );
  
  if (existing) {
    return { 
      name: existing.name || existing.location, 
      found: true, 
      message: `Cảnh「${existing.name || existing.location}」Đã rồi\u5b58\u5728`,
      existingScene: existing,
    };
  }
  
  // Nhanh\u901fTìm kiếm
  const searchResult = searchSceneInScripts(name, episodeScripts, episodeNumber || undefined);
  
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
