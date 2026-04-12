// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * AI Scene Calibrator
 * 
 * Sử dụng AI hiệu chỉnh thông minh từ Kịch bảC được chiết xuất từ nảnh danh sách
 * 
 * chức năng：
 * 1. Thống kêMọi CảSố lần xuất hiện của nh、Số tập xuất hiện
 * 2. AI Phân tíchXác định C quan trọngảnh vs Chuyển tiếpCảnh
 * 3. AI hợp nhất các biến thể của cùng một vị trí（Phòng khách của Trương = Phòng khách của Trương Minh）
 * 4. Bổ sung AI Cảnh thông tin（Kiến trúcPhong cách、Ánh sáng、Đạo cụ, v.v.）
 * 5. Thầy Cảnh thiết kế hình ảnh（Chuyên nghiệpPrompTạo）
 */

import type { ScriptScene, ProjectBackground, EpisodeRawScript, SceneRawContent, PromptLanguage } from '@/types/script';
import { callFeatureAPI } from '@/lib/ai/feature-router';
import { processBatched } from '@/lib/ai/batch-processor';
import { estimateTokens, safeTruncate } from '@/lib/ai/model-registry';
import { useScriptStore } from '@/stores/script-store';
import { buildSeriesContextSummary } from './series-meta-sync';

// ==================== LoạiĐịnh nghĩa ====================

export interface SceneCalibrationResult {
  /** Hiệu chuẩn Cảnh danh sách */
  scenes: CalibratedScene[];
  /** Hợp nhất CảnhBản ghi */
  mergeRecords: SceneMergeRecord[];
  /** AI Phân tíchGiải thích */
  analysisNotes: string;
}

export interface CalibratedScene {
  id: string;
  name: string;
  location: string;
  time: string;
  atmosphere: string;
  /** Cảtầm quan trọng của nh */
  importance: 'main' | 'secondary' | 'transition';
  /** Số tập đã xuất hiện */
  episodeNumbers: number[];
  /** Số lần xuất hiện */
  appearanceCount: number;
  /** Kiến trúcPhong cách */
  architectureStyle?: string;
  /** Ánh sáthiết kế */
  lightingDesign?: string;
  /** Màu sắgiai điệu c */
  colorPalette?: string;
  /** đạo cụ chính */
  keyProps?: string[];
  /** bố trí không gian */
  spatialLayout?: string;
  /** Đặc điểm của thời đại */
  eraDetails?: string;
  /** Lời nhắc trực quan bằng tiếng Anh */
  visualPromptEn?: string;
  /** Tầm nhìn Trung Quốc Mô tả */
  visualPromptZh?: string;
  /** T gốcêcác biến thể */
  nameVariants: string[];
}

export interface SceneMergeRecord {
  /** Cuối cùng được sử dụng Tên */
  finalName: string;
  /** các biến thể hợp nhất */
  variants: string[];
  /** Lý do sáp nhập */
  reason: string;
}

export interface SceneStats {
  name: string;
  location: string;
  /** Số lần xuất hiện */
  appearanceCount: number;
  /** Số tập đã xuất hiện */
  episodeNumbers: number[];
  /** Cảmẫu nội dung nh */
  contentSamples: string[];
  /** Ngoại hình Nhân vật */
  characters: string[];
  /** Thờtôi cài đặt gian */
  times: string[];
  /** Hành độmẫu mô tả ng（được sử dụng để suy ra Cảnh đạo cụ/Bố cục） */
  actionSamples: string[];
  /** mẫu đối thoại（Đã từng hiểu Cảnh sử dụng） */
  dialogueSamples: string[];
}

/** @không được dùng nữa không cần phải chuyển thủ công nữa，Tự động thu được từ bản đồ dịch vụ */
export interface CalibrationOptions {
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
  promptLanguage?: PromptLanguage;
}

// ==================== Thống kêchức năng ====================

/**
 * Từ tập Kịch bảTh trong nống kêTất cảCảnh dữ liệu ngoại hình
 */
export function collectSceneStats(
  episodeScripts: EpisodeRawScript[]
): Map<string, SceneStats> {
  const stats = new Map<string, SceneStats>();
  
  if (!episodeScripts || !Array.isArray(episodeScripts)) {
    console.warn('[collectSceneStats] tập lệnh không hợp lệ');
    return stats;
  }
  
  for (const ep of episodeScripts) {
    if (!ep || !ep.scenes) continue;
    const epIndex = ep.episodeIndex ?? 0;
    
    for (const scene of ep.scenes) {
      if (!scene || !scene.sceneHeader) continue;
      
      // Phân tích cú pháp Cảnh trưởng địa điểm mua lại
      const location = extractLocationFromHeader(scene.sceneHeader);
      const key = normalizeLocation(location);
      
      let stat = stats.get(key);
      if (!stat) {
        stat = {
          name: location,
          location: location,
          appearanceCount: 0,
          episodeNumbers: [],
          contentSamples: [],
          characters: [],
          times: [],
          actionSamples: [],
          dialogueSamples: [],
        };
        stats.set(key, stat);
      }
      
      stat.appearanceCount++;
      if (!stat.episodeNumbers.includes(epIndex)) {
        stat.episodeNumbers.push(epIndex);
      }
      
      // Thu thập mẫu nội dung
      if (stat.contentSamples.length < 5) {
        const sample = scene.content?.slice(0, 150) || scene.sceneHeader;
        stat.contentSamples.push(`Không.${epIndex}Đặt: ${sample}`);
      }
      
      // Thu thậpHành động mô tả（để suy ra đạo cụ và Cảbố cục）
      if (scene.actions && scene.actions.length > 0 && stat.actionSamples.length < 8) {
        // Sử dụng H được phân tích cú phápành động mô tả（△Bắt đầu）
        for (const action of scene.actions.slice(0, 3)) {
          if (action && stat.actionSamples.length < 8) {
            stat.actionSamples.push(`Không.${epIndex}Đặt: ${action.slice(0, 100)}`);
          }
        }
      } else if (scene.content && stat.actionSamples.length < 8) {
        // nếu không△Hành động，Sử dụng Cả200 từ đầu tiên của nội dung nh được dùng là Hành độmẫu vật
        const contentSample = scene.content.slice(0, 200).replace(/\n/g, ' ');
        stat.actionSamples.push(`Không.${epIndex}Đặt: ${contentSample}`);
      }
      
      // Thu thập mẫu đối thoại（Đã từng hiểu Cảchuyện gì đã xảy ra ở nh）
      if (scene.dialogues && stat.dialogueSamples.length < 5) {
        for (const d of scene.dialogues.slice(0, 2)) {
          if (d && stat.dialogueSamples.length < 5) {
            stat.dialogueSamples.push(`${d.character}: ${d.line.slice(0, 50)}`);
          }
        }
      }
      
      // Thu thập Nhân vật
      for (const char of (scene.characters || [])) {
        if (!stat.characters.includes(char)) {
          stat.characters.push(char);
        }
      }
      
      // Thu thập Thời gian
      const time = extractTimeFromHeader(scene.sceneHeader);
      if (time && !stat.times.includes(time)) {
        stat.times.push(time);
      }
    }
  }
  
  return stats;
}

/**
 * Từ Cảnh trưởng vị trí khai thác
 * Chẳng hạn như "Trong vòng 1-1 ngày Thượng Hải Zhangjia" → "Thượng Hải Trương Gia"
 */
function extractLocationFromHeader(header: string): string {
  // Xóa Cảsố nh và Thời gian/dấu hiệu bên trong và bên ngoài
  const parts = header.split(/\s+/);
  // bỏ qua "1-1", "ngày/đêm", "bên trong/Bên ngoài"
  const locationParts = parts.filter(p => 
    !p.match(/^\d+-\d+$/) && 
    !p.match(/^(Ngày|đêm|buổi sáng|chạng vạng|Hoàng hôn|Bình minh)$/) &&
    !p.match(/^(trong|Bên ngoài|bên trong\/bên ngoài)$/)
  );
  return locationParts.join(' ') || header;
}

/**
 * Từ Cảnh trích xuất tiêu đề Thời gian
 */
function extractTimeFromHeader(header: string): string {
  const timeMatch = header.match(/(Ngày|đêm|buổi sáng|chạng vạng|Hoàng hôn|Bình minh|sáng sớm|buổi tối)/);
  return timeMatch ? timeMatch[1] : 'ngày';
}

/**
 * Vị trí tiêu chuẩn Tên được sử dụng để phù hợp
 */
function normalizeLocation(location: string): string {
  return cleanLocationString(location)
    .replace(/\s+/g, '')
    .replace(/[\uff08\uff09()]/g, '')
    .toLowerCase();
}

/**
 * Làm sạch Cảnh chuỗi vị trí，Xóa nội dung không liên quan như thông tin nhân vật
 */
function cleanLocationString(location: string): string {
  if (!location) return '';
  // Xóa "nhân vật：XXX" một phần
  let cleaned = location.replace(/\s*nhân vật[\uff1a:].*/g, '');
  // Xóa "Nhân vật：XXX" một phần
  cleaned = cleaned.replace(/\s*Nhân vật[\uff1a:].*/g, '');
  // Xóa "Thời gian：XXX" một phần
  cleaned = cleaned.replace(/\s*Thời gian[\uff1a:].*/g, '');
  // Xóa khoảng trắng đầu và cuối
  return cleaned.trim();
}

// ==================== chức năng hiệu chuẩn cốt lõi ====================

/**
 * Hiệu chỉnh AITất cảCảnh（chế độ nhẹ）
 * 
 * 【quan trọng】Chức năng này chỉ bổ sung cho C hiện cóảthông tin thiết kế nghệ thuật nh，Đừng thay đổi：
 * - Cảnh danh sách（Không có bổ sung mới、Khôngá、Không hợp nhất）
 * - Cảnh đặt hàng
 * - viewpoints（Nhiều Góc nhìdữ liệu đồ thị nối）
 * - sceneIds、shotIds và các dữ liệu liên quan khác
 */
export async function calibrateScenes(
  currentScenes: ScriptScene[],
  background: ProjectBackground,
  episodeScripts: EpisodeRawScript[],
  _options?: CalibrationOptions // không còn cần thiết nữa，dành riêng cho khả năng tương thích
): Promise<SceneCalibrationResult> {
  
  // 【chế độ nhẹ】Sử dụng trực tiếp currentScenes，Không phải là Thống kê
  if (!currentScenes || currentScenes.length === 0) {
    console.warn('[calibrateScenes] hiện tạiScenes trống，Không thể hiệu chỉnh');
    return {
      scenes: [],
      mergeRecords: [],
      analysisNotes: 'Cảdanh sách nh trống',
    };
  }
  
  console.log('[calibrateScenes] chế độ nhẹ：cho', currentScenes.length, 'C hiện cóảnh bổ sung thiết kế nghệ thuật');
  
  // 1. Thu thập CảH của nhành độmẫu mô tả ng（được sử dụng để suy ra đạo cụ）
  const stats = collectSceneStats(episodeScripts);
  
  // 2. Chuẩn bị Cảnh mục xử lý hàng loạt（Mọi Cảnhbring Thống kêthông tin）
  const batchItems = currentScenes.map((scene) => {
    const normalizedLoc = scene.location?.replace(/\s+/g, '').toLowerCase() || '';
    let sceneStat: SceneStats | undefined;
    for (const [key, stat] of stats) {
      if (key.includes(normalizedLoc) || normalizedLoc.includes(key) || 
          stat.name === scene.name || stat.location === scene.location) {
        sceneStat = stat;
        break;
      }
    }
    return {
      sceneId: scene.id,
      name: scene.name || scene.location,
      location: scene.location,
      characters: sceneStat?.characters?.slice(0, 5).join(', ') || 'Không rõ',
      appearCount: sceneStat?.appearanceCount || 1,
      episodes: sceneStat?.episodeNumbers?.join(',') || '1',
      actionSamples: sceneStat?.actionSamples?.slice(0, 3) || [],
      dialogueSamples: sceneStat?.dialogueSamples?.slice(0, 2) || [],
    };
  });
  
  // 2.5 Thêm bối cảnh ở cấp độ kịch
  const store = useScriptStore.getState();
  const activeProjectId = store.activeProjectId;
  const seriesMeta = activeProjectId ? store.projects[activeProjectId]?.seriesMeta : null;
  const seriesCtx = buildSeriesContextSummary(seriesMeta || null);
  const seriesCtxBlock = seriesCtx ? `\n\n${seriesCtx}\n` : '';

  // 3. Xây dựng lời nhắc hệ thống dùng chung
  const systemPrompt = `Bạn là một giám đốc nghệ thuật điện ảnh và truyền hình chuyên nghiệp và C.ảnh nhà thiết kế，Tốt trong việc phục vụ C hiện cóảnh bổ sung cho các giải pháp thiết kế hình ảnh chuyên nghiệp。${seriesCtxBlock}

【sứ mệnh cốt lõi】
cho C sauảnh thông tin thiết kế nghệ thuật bổ sung，cho TạoCảbản đồ khái niệm nh。

【hạn chế quan trọng】
1. **Không có C mớiảnh** - Chỉ có tiến trình C trong danh sáchảnh
2. **KhôngáCảnh** - Kể cả Chuyển tiếpCảnh cũng giữ lại
3. **Không hợp nhất Cảnh** - Chỉ Bản ghi“Hợp nhất các đề xuất”，Không được sáp nhập bởi chính nó
4. **Giữ lại ID cảnh gốc** - Phải như Quay lại

【Cảyếu tố thiết kế - phải dựa trên Hành độsuy luận mô tả ng】
cho mỗi Cảnh bổ sung：
- Kiến trúcPhong cách、Ánh sáthiết kế、Màu sắgiai điệu c
- **đạo cụ chính**：phải dựa trên「Hành động mô tả」suy luận
- Bố trí không gian、Đặc điểm của thời đại、phân loại tầm quan trọng

Vui lòng sử dụng JSONĐịnh dạngQuay lạiPhân tích kết quả。`;

  // Đã chia sẻNềnContext
  const outlineContext = safeTruncate(background.outline || '', 1500);

  try {
    // Đóng cửa thu thập các trường tổng hợp theo lô
    const allMergeRecords: SceneMergeRecord[] = [];
    const allAnalysisNotes: string[] = [];
    
    const { results: sceneResults, failedBatches } = await processBatched<
      typeof batchItems[number],
      any
    >({
      items: batchItems,
      feature: 'script_analysis',
      buildPrompts: (batch) => {
        const sceneList = batch.map((s, i) => {
          const actionInfo = s.actionSamples.length
            ? `\n   Hành độmô tả ng: ${s.actionSamples.join('; ')}`
            : '';
          const dialogueInfo = s.dialogueSamples.length
            ? `\n mẫu hội thoại: ${s.dialogueSamples.join('; ')}`
            : '';
          return `${i + 1}. [sceneId: ${s.sceneId}] ${s.name}\n Vị trí: ${s.location} [xuất hiện${s.appearCount}lần, số tập${s.episodes}]\n   Nhân vật: ${s.characters}${actionInfo}${dialogueInfo}`;
        }).join('\n\n');
        
        const user = `【Kịch bảthông tin】
Tiêu đề phim truyền hình：《${background.title}》
${background.genre ? `Loại：${background.genre}` : ''}
${background.era ? `thời đại：${background.era}` : ''}
${background.storyStartYear ? `năm câu chuyện：${background.storyStartYear}năm${background.storyEndYear && background.storyEndYear !== background.storyStartYear ? ` - ${background.storyEndYear}năm` : ''}` : ''}
${background.timelineSetting ? `Thờtôi gian dòng：${background.timelineSetting}` : ''}
${background.worldSetting ? `thế giới quan：${safeTruncate(background.worldSetting, 200)}` : ''}
tổng số tập：${episodeScripts.length}đặt

【Tóm tắt】
${outlineContext || 'không có'}

【C hiện tạiảnh danh sách - xin cho từng Cảnh bổ sung thiết kế nghệ thuật】（tổng cộng${batch.length}một）
${sceneList}

【Đầbạn ra quy tắc】
1. Phải Quay lạieachCảID cảnh của nh（vớiĐầu vàoHoàn toàn nhất quán）
2. keyProps phải từ Hành động mô tả được trích xuất
3. Đưa gợi ý hợp nhất vào mergeRecords

Xin hãy quay lạiạiJSONĐịnh dạng：
{
  "scenes": [
    {
      "sceneId": "nguyên CảnhID",
      "name": "CảnhTên",
      "location": "vị trí cụ thể",
      "importance": "main/secondary/transition",
      "architectureStyle": "Kiến trúcPhong cách",
      "lightingDesign": "Ánh sáthiết kế",
      "colorPalette": "Màu sắgiai điệu c",
      "keyProps": ["Đạo cụ 1", "Đạo cụ 2"],
      "spatialLayout": "bố trí không gian",
      "eraDetails": "Đặc điểm của thời đại",
      "atmosphere": "bầu không khí"
    }
  ],
  "mergeRecords": [],
  "analysisNotes": "Phân tíchGiải thích"
}`;
        return { system: systemPrompt, user };
      },
      parseResult: (raw) => {
        // Phân tích cú pháp JSON có khả năng chịu lỗi nâng cao
        let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
        }
        
        let batchParsed: { scenes?: any[]; mergeRecords?: any[]; analysisNotes?: string } = { scenes: [] };
        try {
          batchParsed = JSON.parse(cleaned);
        } catch (parseErr) {
          console.warn('[calibrateScenes] Phân tích cú pháp JSON hàng loạt Thất bại，Hãy thử một số phân tích cú pháp ...');
          const partialScenes: any[] = [];
          const scenePattern = /\{\s*"sceneId"\s*:\s*"([^"]+)"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
          let match;
          while ((match = scenePattern.exec(raw)) !== null) {
            try {
              const sceneObj = JSON.parse(match[0]);
              if (sceneObj.sceneId) partialScenes.push(sceneObj);
            } catch { /* skip */ }
          }
          if (partialScenes.length > 0) {
            batchParsed = { scenes: partialScenes, mergeRecords: [], analysisNotes: 'Phân tích một phần' };
          } else {
            throw parseErr;
          }
        }
        
        // Thu thập các trường tổng hợp
        allMergeRecords.push(...(batchParsed.mergeRecords || []));
        if (batchParsed.analysisNotes) allAnalysisNotes.push(batchParsed.analysisNotes);
        
        // Quay lại Map<sceneId, Cảnh dữ liệu>
        const map = new Map<string, any>();
        for (const s of (batchParsed.scenes || [])) {
          if (s.sceneId) {
            map.set(s.sceneId, s);
          }
          // dự phòng：Sử dụng vị trí/ánh xạ tên
          if (s.location) map.set('loc:' + normalizeLocation(s.location), s);
          if (s.name) map.set('loc:' + normalizeLocation(s.name), s);
        }
        return map;
      },
      estimateItemTokens: (item) => estimateTokens(
        `${item.name} ${item.location} ${item.characters} ` +
        item.actionSamples.join(' ') + ' ' + item.dialogueSamples.join(' ')
      ),
      estimateItemOutputTokens: () => 300,
    });
    
    if (failedBatches > 0) {
      console.warn(`[SceneCalibrator] ${failedBatches} đợt thứất bại，Sử dụng kết quả một phần`);
    }
    
    console.log('[calibrateScenes] AI Quay lại', sceneResults.size, 'Cảnh kết quả');
    
    // 【chìa khóa】Lặp lại các cảnh hiện tại theo thứ tự ban đầu，Chỉ Cập nhậruộng bánh tart
    const scenes: CalibratedScene[] = currentScenes.map((orig, i) => {
      let aiData = sceneResults.get(orig.id);
      if (!aiData) aiData = sceneResults.get('loc:' + normalizeLocation(orig.location || ''));
      if (!aiData) aiData = sceneResults.get('loc:' + normalizeLocation(orig.name || ''));
      
      const matched = !!aiData;
      console.log(`[calibrateScenes] Cảnh #${i + 1} "${orig.name || orig.location}" (${orig.id}) -> Kết hợp AI: ${matched ? '✓' : '✗'}`);
      
      return {
        id: orig.id,
        name: orig.name || orig.location,
        location: orig.location,
        time: orig.time || 'day',
        atmosphere: aiData?.atmosphere || orig.atmosphere || 'bình tĩnh',
        importance: aiData?.importance || (orig as any).importance || 'secondary',
        episodeNumbers: (orig as any).episodeNumbers || [],
        appearanceCount: (orig as any).appearanceCount || 1,
        architectureStyle: aiData?.architectureStyle || (orig as any).architectureStyle,
        lightingDesign: aiData?.lightingDesign || (orig as any).lightingDesign,
        colorPalette: aiData?.colorPalette || (orig as any).colorPalette,
        keyProps: aiData?.keyProps || (orig as any).keyProps,
        spatialLayout: aiData?.spatialLayout || (orig as any).spatialLayout,
        eraDetails: aiData?.eraDetails || (orig as any).eraDetails,
        nameVariants: [orig.name || orig.location],
      };
    });
    
    // cho C chínhảnhTạo Lời nhắc trực quan chuyên nghiệp
    const enrichedScenes = await enrichScenesWithVisualPrompts(
      scenes,
      background,
      _options?.promptLanguage || 'zh+en'
    );
    
    return {
      scenes: enrichedScenes,
      mergeRecords: allMergeRecords,
      analysisNotes: allAnalysisNotes.join('; ') || '',
    };
  } catch (error) {
    console.error('[SceneCalibrator] Hiệu chuẩn AI Thất bại:', error);
    const fallbackScenes: CalibratedScene[] = Array.from(stats.values())
      .sort((a, b) => b.appearanceCount - a.appearanceCount)
      .map((s, i) => ({
        id: `scene_${i + 1}`,
        name: s.name,
        location: s.location,
        time: s.times[0] || 'day',
        atmosphere: 'bình tĩnh',
        importance: (s.appearanceCount >= 5 ? 'main' : 
                    s.appearanceCount >= 2 ? 'secondary' : 'transition') as any,
        episodeNumbers: s.episodeNumbers,
        appearanceCount: s.appearanceCount,
        nameVariants: [s.name],
      }));
    
    return {
      scenes: fallbackScenes,
      mergeRecords: [],
      analysisNotes: 'Hiệu chuẩn AI Thất bại，Quay lạtôi dựa trên Thống kêkết quả',
    };
  }
}

/**
 * Bộ hiệu chỉnh AI đơn Cảnh
 */
export async function calibrateEpisodeScenes(
  episodeIndex: number,
  currentScenes: ScriptScene[],
  background: ProjectBackground,
  episodeScripts: EpisodeRawScript[],
  options: CalibrationOptions
): Promise<SceneCalibrationResult> {
  // Tìm K của tập phimịch bản
  const episodeScript = episodeScripts.find(ep => ep.episodeIndex === episodeIndex);
  if (!episodeScript) {
    throw new Error(`Không. không tìm thấy ${episodeIndex} Đặt Kịch bản`);
  }
  
  // Chỉ hiệu chỉnh C của bộ nàyảnh
  const singleEpisodeScripts = [episodeScript];
  
  // Tái sử dụng logic hiệu chuẩn toàn cầu，Nhưng chỉ có một bộ dữ liệu duy nhất được truyền vào
  return calibrateScenes(currentScenes, background, singleEpisodeScripts, options);
}

// ==================== Thiết kế hình ảnh chuyên nghiệp ====================

/**
 * cho C chínhảnhTạo Lời nhắc trực quan chuyên nghiệp
 */
async function enrichScenesWithVisualPrompts(
  scenes: CalibratedScene[],
  background: ProjectBackground,
  promptLanguage: PromptLanguage = 'zh+en'
): Promise<CalibratedScene[]> {
  // Chỉ dành cho chuyên ngành Cảnh và thứ CảnhTạo Lời nhắc chi tiết
  const keyScenes = scenes.filter(s => 
    s.importance === 'main' || s.importance === 'secondary'
  );
  
  if (keyScenes.length === 0) {
    return scenes;
  }
  
  console.log(`[enrichScenesWithVisualPrompts] cho ${keyScenes.length} phím CảnhTạoNhắc nhở chuyên nghiệp...`);
  
  const systemPrompt = `Bạn là giám đốc nghệ thuật hàng đầu ở Hollywood，một lần cho《Khởi đầu》《khách sạn lớn budapest》Chờ thiết kế phim Cảnh。

khả năng chuyên môn của bạn：
- **thẩm mỹ không gian**：Biết cách sử dụng bố cục、Ánh sáng、Màu sắc truyền tải cảm xúc
- **Khôi phục lại thời gian**：Nắm bắt chính xác đặc điểm kiến trúc và trang trí nội thất của các thời đại khác nhau
- **Hình ảnh AI Tạo**：Biết giữa hành trình、DALL-E và bản vẽ AI khácMô hìCách viết lời nhắc tốt nhất cho nh
- **ngôn ngữ phim**：Hiểu C.ảNh phục vụ tường thuật như thế nào

【Kịch bảthông tin】
Tiêu đề phim truyền hình：《${background.title}》
Loại：${background.genre || 'Không rõLoại'}
thời đại：${background.era || 'Không rõ'}

【Tóm tắt】
${background.outline?.slice(0, 1000) || 'không có'}

【Nhiệm vụ】
cho C sauảnhTạo Lời nhắc trực quan chuyên nghiệp：

${keyScenes.map((s, i) => `${i+1}. ${s.name}
   - Tầm quan trọng：${s.importance === 'main' ? 'Chính Cảnh' : 'Tiểu Cảnh'}
   - Kiến trúcPhong cách：${s.architectureStyle || 'Không rõ'}
   - Ánh sáng：${s.lightingDesign || 'Không rõ'}
   - Màu sắc：${s.colorPalette || 'Không rõ'}
   - đạo cụ：${s.keyProps?.join(', ') || 'Không rõ'}
   - thời đại：${s.eraDetails || 'Không rõ'}`).join('\n\n')}

【Đầbạn yêu cầu】
cho mỗi CảnhTạo：
${promptLanguage !== 'en' ? '- Visual M Trung Quốcô tả（100-150 từ，Chứa đựng cảm giác về không gian、bầu không khí、Chi tiết）' : ''}
${promptLanguage !== 'zh' ? '- Lời nhắc trực quan bằng tiếng Anh（50-80 từ，Phù hợp với hình ảnh AI Tạo，Chứa Phong cách、Ánh sáng、thành phần）' : ''}

Xin hãy quay lạiạiJSONĐịnh dạng：
{
  "scenes": [
    {
      "name": "Cảnh tên"${promptLanguage !== 'en' ? ',\n      "visualPromptZh": "Tầm nhìn Trung Quốc Mô tả"' : ''}${promptLanguage !== 'zh' ? ',\n      "visualPromptEn": "English visual prompt for AI image generation"' : ''}
    }
  ]
}`;

  try {
    // Thống nhất có được cấu hình từ ánh xạ dịch vụ
    const result = await callFeatureAPI('script_analysis', systemPrompt, 'Vui lòng cung cấp C cho những điều trênảnhTạo Lời nhắc trực quan chuyên nghiệp');
    
    // Phân tích kết quả
    let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    
    const parsed = JSON.parse(cleaned);
    const designMap = new Map<string, any>();
    for (const s of (parsed.scenes || [])) {
      designMap.set(s.name, s);
    }
    
    // Sáp nhập vào Cảnh dữ liệu
    return scenes.map(s => {
      const design = designMap.get(s.name);
      if (design) {
        return {
          ...s,
          visualPromptZh: design.visualPromptZh,
          visualPromptEn: design.visualPromptEn,
        };
      }
      return s;
    });
  } catch (error) {
    console.error('[enrichScenesWithVisualPrompts] TạoThất bại:', error);
    return scenes;
  }
}

// ==================== chức năng chuyển đổi ====================

/**
 * Chuyển đổi kết quả hiệu chỉnh trở lại ScriptScene Định dạng
 */
export function convertToScriptScenes(
  calibrated: CalibratedScene[],
  originalScenes?: ScriptScene[],
  promptLanguage: PromptLanguage = 'zh+en',
): ScriptScene[] {
  return calibrated.map(c => {
    // Tìm C gốcảnh dữ liệu
    const original = originalScenes?.find(orig => 
      orig.name === c.name || 
      orig.location === c.location ||
      normalizeLocation(orig.location) === normalizeLocation(c.location)
    );
    
    // Làm sạch chuỗi vị trí
    const cleanedLocation = cleanLocationString(c.location);
    const nextVisualPromptZh = c.visualPromptZh || original?.visualPrompt;
    const nextVisualPromptEn = c.visualPromptEn || original?.visualPromptEn;
    
    return {
      // Giữ các trường gốc
      ...original,
      // Cập nhật/Các trường bổ sung để hiệu chỉnh AI
      id: original?.id || c.id,
      name: c.name,
      location: cleanedLocation,
      time: c.time,
      atmosphere: c.atmosphere,
      // C chuyên nghiệpảlĩnh vực thiết kế
      visualPrompt: promptLanguage === 'en' ? undefined : nextVisualPromptZh,
      visualPromptEn: promptLanguage === 'zh' ? undefined : nextVisualPromptEn,
      architectureStyle: c.architectureStyle,
      lightingDesign: c.lightingDesign,
      colorPalette: c.colorPalette,
      keyProps: c.keyProps,
      spatialLayout: c.spatialLayout,
      eraDetails: c.eraDetails,
      // Ngoại hìnhống kê
      episodeNumbers: c.episodeNumbers,
      appearanceCount: c.appearanceCount,
      importance: c.importance,
      // nhãn
      tags: [
        c.importance,
        `xuất hiện${c.appearanceCount}lần`,
        ...(c.keyProps || []).slice(0, 3),
      ],
      // 【sửa chữa】Giữ bản gốc Cảnh dữ liệu quan điểm（AIGóc nhìnPhân tích kết quả）
      viewpoints: original?.viewpoints,
    };
  });
}

/**
 * Theo tầm quan trọngSắp xếpCảnh
 */
export function sortByImportance(scenes: CalibratedScene[]): CalibratedScene[] {
  const order = { main: 0, secondary: 1, transition: 2 };
  return [...scenes].sort((a, b) => {
    // Theo tầm quan trọng đầu tiên
    const importanceOrder = order[a.importance] - order[b.importance];
    if (importanceOrder !== 0) return importanceOrder;
    // Nhấn lại số lần xuất hiện
    return b.appearanceCount - a.appearanceCount;
  });
}
