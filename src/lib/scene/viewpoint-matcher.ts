// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Viewpoint Matcher Service
 * 
 * Theo Ph.ân cảnhHành độngMô tả\u667a\u80fdtrận đấuThư viện cảnhtrongcủaGóc nhìcác biến thể
 * Chiến lược：đầu tiênsử dụngchìa khóa\u8bcdNhanh\u901ftrận đấu，trận đấu\u4e0dĐến\u624d\u8c03sử dụng AI
 */

import { getFeatureConfig } from '@/lib/ai/feature-router';
import type { Scene } from '@/stores/scene-store';

// ==================== LoạiĐịnh nghĩa ====================

export interface ViewpointMatchResult {
  sceneLibraryId: string;
  viewpointId?: string;
  sceneReferenceImage?: string;
  matchedSceneName: string;
  matchMethod: 'keyword' | 'ai' | 'fallback';
  confidence: number; // 0-1
}

// ==================== chìa khóa\u8bcd\u6620\u5c04 ====================

// Góc nhìnÁnh xạ từ khóa（sử dụng\u4e8eNhanh\u901ftrận đấu）
const VIEWPOINT_KEYWORDS: Record<string, string[]> = {
  // bàn ăn/Liên quan đến bữa ăn
  'dining': [
    'ăn', 'bàn ăn', 'bàn ăn', 'bữa ăn', 'Phục vụ đồ ăn', 'Nhặt rau', 'uống', 'Kính kêu leng keng', 'bánh mì nướng',
    'sử dụng\u81b3', '\u8fdb\u9910', '\u5c31\u9910', 'cơm\u83dc', '\u9910\u5177', '\u7b77\u5b50', '\u7897', '\u76d8\u5b50',
  ],
  // Sofa/phòng khách\u4f11\u606fQuận\u76f8\u5173
  'sofa': [
    'Sofa', 'xem tivi', 'bàn cà phê', 'rót trà', 'uống trà', 'ngồi xuống', 'Ngồi xuống đi', 'đứng dậy',
    'Sofa\u4e0a', 'ngồi', '\u8eba\u5728Sofa', 'truyền hình\u673a', '\u9065\u63a7\u5668',
  ],
  // cửa sổ\u76f8\u5173
  'window': [
    'cửa sổ', 'bên ngoài cửa sổ', 'cửa sổ', 'ban công', 'nhìn về phía', '\u773a\u671b', 'Rèm cửa', 'các cửa sổ',
    '\u501acửa sổ', 'cửa sổ\u524d', '\u51edcửa sổ', '\u900f\u8fc7cửa sổ', 'cửa sổ\u53f0',
  ],
  // lối vào/cửa\u76f8\u5173
  'entrance': [
    'ngưỡng cửa', 'cửa', 'Vào đi', 'đi ra ngoài', 'về nhà', 'Vào đi', 'bước vào', 'rời đi',
    'Lối vào', 'Thay giày', '\u5f00cửa', '\u5173cửa', 'cửa\u94c3', '\u6572cửa', 'cửaBên ngoài',
  ],
  // nhà bếp\u76f8\u5173
  'kitchen': [
    'nhà bếp', 'nấu ăn', 'nấu ăn', 'xào', 'rửa bát', 'Cắt rau', 'tủ lạnh',
    '\u9505', 'bếp lò', 'tủ', 'bồn rửa', '\u6599\u7406', '\u4e0b\u53a8',
  ],
  // phòng học/\u5de5\u4f5c\u76f8\u5173
  'study': [
    'bàn', 'máy tính', 'đọc một cuốn sách', 'viết', 'văn phòng', 'Tệp', 'giá sách',
    'phòng học', '\u5de5\u4f5c', 'đèn bàn', '\u7b14\u8bb0\u672c', '\u952e\u76d8',
  ],
  // phòng ngủ\u76f8\u5173
  'bedroom': [
    'giường', '\u7761\u89c9', '\u8eba', 'thức dậy', '\u5165\u7761', 'đầu giường', 'phòng ngủ',
    'chăn bông', '\u6795\u5934', 'giường', '\u8eba\u4e0b', '\u7761\u7740', '\u9192\u6765',
  ],
  // ban công/ngoài trời\u76f8\u5173
  'balcony': [
    'ban công', '\u9732\u53f0', '\u667e\u8863', '\u6652\u592a\u9633', '\u82b1\u76c6', 'lan can',
  ],
  // đi\u5eca/lối đi\u76f8\u5173
  'corridor': [
    'đi\u5eca', 'lối đi', '\u697c\u68af', '\u4e0a\u697c', '\u4e0b\u697c', 'bước',
  ],
  // phòng tắm\u76f8\u5173
  'bathroom': [
    'phòng tắm', 'phòng tắm', '\u6d17tay', '\u6d17\u8138', '\u5237\u7259', '\u6dcb\u6d74', 'con ngựa\u6876', '\u955c\u5b50',
  ],
};

// \u53cd\u5411\u7d22\u5f15：chìa khóa\u8bcd -> Góc nhìnID
const KEYWORD_TO_VIEWPOINT: Record<string, string> = {};
for (const [viewpointId, keywords] of Object.entries(VIEWPOINT_KEYWORDS)) {
  for (const keyword of keywords) {
    KEYWORD_TO_VIEWPOINT[keyword] = viewpointId;
  }
}

// ==================== bộ nhớ đệm ====================

// AI trận đấukết quảbộ nhớ đệm（\u907f\u514d\u91cd\u590d\u8c03sử dụng）
const aiMatchCache = new Map<string, { viewpointId: string | null; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30\u5206\u949fbộ nhớ đệm

// ==================== chức năng cốt lõi ====================

/**
 * sử dụngchìa khóa\u8bcdNhanh\u901ftrận đấuGóc nhìn
 */
function matchByKeyword(actionSummary: string): string | null {
  for (const [keyword, viewpointId] of Object.entries(KEYWORD_TO_VIEWPOINT)) {
    if (actionSummary.includes(keyword)) {
      return viewpointId;
    }
  }
  return null;
}

/**
 * sử dụng AI trận đấuGóc nhìn
 */
async function matchByAI(
  actionSummary: string,
  availableViewpoints: Array<{ id: string; name: string }>
): Promise<string | null> {
  // \u68c0\u67e5bộ nhớ đệm
  const cacheKey = `${actionSummary}:${availableViewpoints.map(v => v.id).join(',')}`;
  const cached = aiMatchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.viewpointId;
  }

  // \u83b7\u53d6 AI Cấu hình
  const config = getFeatureConfig('chat');
  if (!config) {
    console.warn('[ViewpointMatcher] No chat API configured for AI matching');
    return null;
  }
  const model = config.models?.[0];
  if (!model) {
    console.warn('[ViewpointMatcher] No chat model configured for AI matching');
    return null;
  }
  const apiKey = config.apiKey;
  if (!apiKey) {
    console.warn('[ViewpointMatcher] No chat API key configured for AI matching');
    return null;
  }

  try {
    const viewpointList = availableViewpoints
      .map(v => `- ${v.id}: ${v.name}`)
      .join('\n');

    const prompt = `\u6839\u636e\u4ee5\u4e0bHành độngMô tả，\u5224\u65ad\u6700trận đấuCảnhGóc nhìn。

【Hành độngMô tả】
${actionSummary}

【Tùy chọnGóc nhìn】
${viewpointList}

\u8bf7Quay tôi chỉại\u6700trận đấucủaGóc nhìnID（Chẳng hạn như dining、sofa、window Đợi đã），\u4e0d\u8981\u4efb\u4f55\u89e3\u91ca。
nếu không\u5408\u9002củaGóc nhìn，Quay lại null。`;

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        provider: config.platform,
        apiKey,
        model,
        temperature: 0.1, // \u4f4e\u6e29\u5ea6，\u66f4\u786e\u5b9a\u6027củaĐầu ra
        maxTokens: 50,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.content?.trim().toLowerCase();
    
    // \u9a8c\u8bc1Quay lạtôi là\u662fCó\u6548củaGóc nhìnID
    const viewpointId = availableViewpoints.find(v => v.id === result)?.id || null;
    
    // bộ nhớ đệmkết quả
    aiMatchCache.set(cacheKey, { viewpointId, timestamp: Date.now() });
    
    return viewpointId;
  } catch (error) {
    console.error('[ViewpointMatcher] AI matching failed:', error);
    return null;
  }
}

/**
 * \u67e5\u627etrận đấuThư viện cảnhCảnh（Phụ huynh Cảnh）
 */
function findMatchingParentScenes(
  sceneName: string,
  sceneLibraryScenes: Scene[]
): Scene[] {
  // \u53ea\u770bPhụ huynh Cảnh（\u975eGóc nhìcác biến thể）
  const parentScenes = sceneLibraryScenes.filter(s => 
    !s.parentSceneId && !s.isViewpointVariant
  );

  // \u53cc\u5411trận đấu
  const matches = parentScenes.filter(s => 
    s.name.includes(sceneName) || sceneName.includes(s.name)
  );

  return matches;
}

/**
 * Nhận Phụ huynh CảnhTất cảGóc nhìcác biến thể
 */
function getViewpointVariants(
  parentSceneId: string,
  sceneLibraryScenes: Scene[]
): Scene[] {
  return sceneLibraryScenes.filter(s => s.parentSceneId === parentSceneId);
}

/**
 * sử dụngGóc nhìnTêncủachìa khóa\u8bcd\u6a21\u7ccatrận đấuHành độngMô tả
 * cho Tuỳ chỉnhGóc nhìnTên（Chẳng hạn như"xe buýtcửa sổ xe Góc nhìn"）vớiHành độngMô tảcủatrận đấu
 */
function matchByViewpointNameKeywords(
  actionSummary: string,
  viewpointVariants: Scene[]
): Scene | null {
  if (!actionSummary || viewpointVariants.length === 0) return null;
  
  // \u5bf9\u6bcfGóc nhìcác biến thể，Trích xuất Têntrongcủachìa khóa\u8bcd\u5e76\u68c0\u67e5\u662f\u5426\u51fa\u73b0\u5728Hành độngMô tảtrong
  for (const variant of viewpointVariants) {
    const viewpointName = variant.viewpointName || variant.name || '';
    
    // Trích xuấtGóc nhìnTêntrongcủachìa khóa\u8bcd（\u53bb\u9664phổ quát\u8bcdChẳng hạn như"Góc nhìn""góc"Đợi đã）
    const cleanedName = viewpointName
      .replace(/Góc nhìn|góc|Cảnh quay|bức tranh|Cảnh/g, '')
      .trim();
    
    if (!cleanedName) continue;
    
    // \u5c06Tên\u5206\u8bcd（\u6309\u5e38\u89c1\u5206\u9694\u7b26vàTiếng Trung\u5355từ\u62c6\u5206）
    const keywords = extractKeywords(cleanedName);
    
    // \u68c0\u67e5Hành độngMô tả\u662f\u5426chứa\u8fd9\u4e9bchìa khóa\u8bcd
    for (const keyword of keywords) {
      if (keyword.length >= 2 && actionSummary.includes(keyword)) {
        console.log(`[ViewpointMatcher] Matched viewpoint "${viewpointName}" by keyword "${keyword}"`);
        return variant;
      }
    }
  }
  
  return null;
}

/**
 * từTêntrongTrích xuấtchìa khóa\u8bcd
 */
function extractKeywords(name: string): string[] {
  const keywords: string[] = [];
  
  // 1. \u6574\u4f53Tên\u4f5cchochìa khóa\u8bcd
  if (name.length >= 2) {
    keywords.push(name);
  }
  
  // 2. \u6309\u7a7a\u683c/\u659c\u6760/\u7834\u6298\u53f7\u5206\u5272
  const parts = name.split(/[\s\/\-\—\|]+/);
  for (const part of parts) {
    if (part.length >= 2) {
      keywords.push(part);
    }
  }
  
  // 3. Trích xuất\u5e38\u89c1củaVị trí\u8bcd\u7ec4（2-4từcủatên\u8bcd\u77ed\u8bed）
  const locationPatterns = [
    /cửa sổ xe hơi/, /chỗ ngồi/, /lối đi/, /\u4e58\u5ba2/, /mục đích\u5730/, /vận chuyển/, /cửa xe/,
    /các cửa sổ/, /cửa sổ/, /bên ngoài cửa sổ/, /cửa sổ\u53f0/,
    /ngưỡng cửa/, /cửa\u8fb9/, /Lối vào/,
    /Sofa/, /bàn cà phê/, /bàn ăn/, /bàn ăn/, /bàn/, /giường\u8fb9/, /đầu giường/,
    /nhà bếp/, /phòng ngủ/, /phòng khách/, /phòng học/, /ban công/, /phòng tắm/,
    /\u697c\u68af/, /đi\u5eca/, /lối đi/, /sân/, /vườn/,
    /\u524d\u6392/, /\u540e\u6392/, /trong\u95f4/, /\u5de6\u8fb9/, /\u53f3\u8fb9/, /trong\u592e/,
    /lối vào/, /\u51fa\u53e3/, /\u901a\u9053/, /\u89d2\u843d/, /trong\u5fc3/,
  ];
  
  for (const pattern of locationPatterns) {
    const match = name.match(pattern);
    if (match) {
      keywords.push(match[0]);
    }
  }
  
  return [...new Set(keywords)]; // \u53bb\u91cd
}

// ==================== Chúa ơilối vào ====================

/**
 * \u667a\u80fdtrận đấuThư viện cảnhtrongCảnhvàGóc nhìn
 * 
 * @param sceneName Kịch bảnCảnh tên（Chẳng hạn như"Phòng khách của Trương"）
 * @param actionSummary Phân cảnhHành độngMô tả（Chẳng hạn như"bàn ăn\u4e0a，Trương Minhvớibố mẹăn"）
 * @param sceneLibraryScenes Thư viện cảnhtrongTất cảCảnh
 * @param useAI \u662f\u5426\u542fsử dụng AI Hãy ghi nhớ mọi thứ（Mặc định true）
 */
export async function matchSceneAndViewpoint(
  sceneName: string,
  actionSummary: string,
  sceneLibraryScenes: Scene[],
  useAI: boolean = true
): Promise<ViewpointMatchResult | null> {
  // 1. \u627etrận đấucủaPhụ huynh Cảnh
  const parentScenes = findMatchingParentScenes(sceneName, sceneLibraryScenes);
  if (parentScenes.length === 0) {
    return null;
  }

  // 2. đầu tiênsử dụng\u9884\u5b9a\u4e49kết hợp từ khóaGóc nhìn（Chẳng hạn như dining, sofa, window Đợi đã）
  const keywordViewpointId = matchByKeyword(actionSummary);
  
  if (keywordViewpointId) {
    // \u5728Phụ huynh Cảnhtrong\u627e\u5bf9\u5e94củaGóc nhìcác biến thể
    for (const parent of parentScenes) {
      const variants = getViewpointVariants(parent.id, sceneLibraryScenes);
      const matchedVariant = variants.find(v => v.viewpointId === keywordViewpointId);
      
      if (matchedVariant) {
        return {
          sceneLibraryId: matchedVariant.id,
          viewpointId: matchedVariant.viewpointId,
          sceneReferenceImage: matchedVariant.referenceImage || matchedVariant.referenceImageBase64,
          matchedSceneName: matchedVariant.name,
          matchMethod: 'keyword',
          confidence: 0.9,
        };
      }
    }
  }

  // 2.5 \u5c1d\u8bd5sử dụngTuỳ chỉnhGóc nhìnTêncủakết hợp từ khóa
  for (const parent of parentScenes) {
    const variants = getViewpointVariants(parent.id, sceneLibraryScenes);
    if (variants.length > 0) {
      const matchedVariant = matchByViewpointNameKeywords(actionSummary, variants);
      if (matchedVariant) {
        return {
          sceneLibraryId: matchedVariant.id,
          viewpointId: matchedVariant.viewpointId,
          sceneReferenceImage: matchedVariant.referenceImage || matchedVariant.referenceImageBase64,
          matchedSceneName: matchedVariant.viewpointName || matchedVariant.name,
          matchMethod: 'keyword',
          confidence: 0.85,
        };
      }
    }
  }

  // 3. kết hợp từ khóaThất bại，\u5c1d\u8bd5 AI trận đấu
  if (useAI) {
    for (const parent of parentScenes) {
      const variants = getViewpointVariants(parent.id, sceneLibraryScenes);
      
      if (variants.length > 0) {
        const availableViewpoints = variants
          .filter(v => v.viewpointId && v.viewpointName)
          .map(v => ({ id: v.viewpointId!, name: v.viewpointName! }));
        
        if (availableViewpoints.length > 0) {
          const aiViewpointId = await matchByAI(actionSummary, availableViewpoints);
          
          if (aiViewpointId) {
            const matchedVariant = variants.find(v => v.viewpointId === aiViewpointId);
            if (matchedVariant) {
              return {
                sceneLibraryId: matchedVariant.id,
                viewpointId: matchedVariant.viewpointId,
                sceneReferenceImage: matchedVariant.referenceImage || matchedVariant.referenceImageBase64,
                matchedSceneName: matchedVariant.name,
                matchMethod: 'ai',
                confidence: 0.7,
              };
            }
          }
        }
      }
    }
  }

  // 4. \u90fdtrận đấu\u4e0dĐến，Quay lạiKhông.mộtmộtPhụ huynh Cảnh\u4f5ccho fallback
  const bestParent = parentScenes[0];
  return {
    sceneLibraryId: bestParent.id,
    viewpointId: undefined,
    sceneReferenceImage: bestParent.referenceImage || bestParent.referenceImageBase64,
    matchedSceneName: bestParent.name,
    matchMethod: 'fallback',
    confidence: 0.5,
  };
}

/**
 * \u540c\u6b65Phiên bản（\u4ec5kết hợp từ khóa，\u4e0d\u8c03sử dụng AI）
 * sử dụng\u4e8e\u9700\u8981\u5373\u65f6phản ứngCảnh
 */
export function matchSceneAndViewpointSync(
  sceneName: string,
  actionSummary: string,
  sceneLibraryScenes: Scene[]
): ViewpointMatchResult | null {
  // 1. \u627etrận đấucủaPhụ huynh Cảnh
  const parentScenes = findMatchingParentScenes(sceneName, sceneLibraryScenes);
  if (parentScenes.length === 0) {
    return null;
  }

  // 2. sử dụng\u9884\u5b9a\u4e49kết hợp từ khóaGóc nhìn
  const keywordViewpointId = matchByKeyword(actionSummary);
  
  if (keywordViewpointId) {
    for (const parent of parentScenes) {
      const variants = getViewpointVariants(parent.id, sceneLibraryScenes);
      const matchedVariant = variants.find(v => v.viewpointId === keywordViewpointId);
      
      if (matchedVariant) {
        return {
          sceneLibraryId: matchedVariant.id,
          viewpointId: matchedVariant.viewpointId,
          sceneReferenceImage: matchedVariant.referenceImage || matchedVariant.referenceImageBase64,
          matchedSceneName: matchedVariant.name,
          matchMethod: 'keyword',
          confidence: 0.9,
        };
      }
    }
  }

  // 2.5 \u5c1d\u8bd5sử dụngTuỳ chỉnhGóc nhìnTêncủakết hợp từ khóa
  for (const parent of parentScenes) {
    const variants = getViewpointVariants(parent.id, sceneLibraryScenes);
    if (variants.length > 0) {
      const matchedVariant = matchByViewpointNameKeywords(actionSummary, variants);
      if (matchedVariant) {
        return {
          sceneLibraryId: matchedVariant.id,
          viewpointId: matchedVariant.viewpointId,
          sceneReferenceImage: matchedVariant.referenceImage || matchedVariant.referenceImageBase64,
          matchedSceneName: matchedVariant.viewpointName || matchedVariant.name,
          matchMethod: 'keyword',
          confidence: 0.85,
        };
      }
    }
  }

  // 3. kết hợp từ khóaThất bại，Quay lạiPhụ huynh Cảnh
  const bestParent = parentScenes[0];
  return {
    sceneLibraryId: bestParent.id,
    viewpointId: undefined,
    sceneReferenceImage: bestParent.referenceImage || bestParent.referenceImageBase64,
    matchedSceneName: bestParent.name,
    matchMethod: 'fallback',
    confidence: 0.5,
  };
}

/**
 * \u6e05\u9664 AI trận đấubộ nhớ đệm
 */
export function clearAIMatchCache(): void {
  aiMatchCache.clear();
}
