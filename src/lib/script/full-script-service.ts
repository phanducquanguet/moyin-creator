// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Dịch vụ kịch bản đầy đủ-Full Kịch bảnNhập và theo tập Phân cảnhTạoDịch vụ
 * 
 * Chức năng cốt lõi：
 * 1. Nhậhoàn thànhKịch bản（Chứa một phác thảo、Tiểu sử、Nội dung 60 tập）
 * 2. Nhấn nút TạoPhân cảnh（Một lần Tạtập phim）
 * 3. Cập nhậtMột tập hoặc tất cả Phân cảnh
 * 4. Hiệu chỉnh AI：là số tập thiếu tựa TạoTiêu đề
 */

import type {
  EpisodeRawScript,
  ProjectBackground,
  PromptLanguage,
  ScriptData,
  Shot,
  SceneRawContent,
} from "@/types/script";
import {
  parseFullScript,
  convertToScriptData,
  parseScenes,
} from "./episode-parser";
import { normalizeScriptFormat, analyzeScriptStructureWithAI, applyAIAnalysis, preprocessLineBreaks } from "./script-normalizer";
import { populateSeriesMetaFromImport } from "./series-meta-sync";
import { callFeatureAPI } from "@/lib/ai/feature-router";
import { processBatched } from "@/lib/ai/batch-processor";
import { useScriptStore } from "@/stores/script-store";
import { useCharacterLibraryStore } from "@/stores/character-library-store";
import { useAPIConfigStore } from "@/stores/api-config-store";
import { retryOperation } from "@/lib/utils/retry";
import { ApiKeyManager } from "@/lib/api-key-manager";
import { getStyleDescription, getMediaType } from "@/lib/constants/visual-styles";
import { buildCinematographyGuidance } from "@/lib/constants/cinematography-profiles";
import { getMediaTypeGuidance } from "@/lib/generation/media-type-tokens";
import { getVariationForEpisode } from "./character-stage-analyzer";
import { analyzeSceneViewpoints, type ViewpointAnalysisOptions } from "./viewpoint-analyzer";
import { runStaggered } from "@/lib/utils/concurrency";
import { calibrateShotsMultiStage } from "./shot-calibration-stages";
import { buildSeriesContextSummary } from "./series-meta-sync";

export interface ImportResult {
  success: boolean;
  background: ProjectBackground | null;
  projectBackground?: ProjectBackground; // Các trường tương thích
  episodes: EpisodeRawScript[];
  scriptData: ScriptData | null;
  error?: string;
}

export interface GenerateShotsOptions {
  apiKey: string;
  provider: string;
  baseUrl?: string;
  styleId: string;
  targetDuration: string;
  promptLanguage?: import('@/types/script').PromptLanguage;
}

export interface GenerateEpisodeShotsResult {
  shots: Shot[];
  viewpointAnalyzed: boolean;
  viewpointSkippedReason?: string;
}

/**
 * Nhậhoàn thànhKịch bản
 * @param fullText hoàn thànhKịch bảvăn bản
 * @param projectId Dự ánID
 */
export async function importFullScript(
  fullText: string,
  projectId: string,
  importSettings?: { styleId?: string; promptLanguage?: PromptLanguage }
): Promise<ImportResult> {
  try {
    // -1. Tiền xử lý：dưới dạng một dòng/Tự động chèn ngắt dòng cho dòng văn bản dài hơn
    const preprocessed = preprocessLineBreaks(fullText);
    const processedText = preprocessed.text;
    
    // 0. Phát hiện cấu trúc AI（bước đầu tiên）→ Yandi thường xuyên
    let normalizeResult;
    const aiAnalysis = await analyzeScriptStructureWithAI(processedText);
    
    if (aiAnalysis) {
      // AI phát hiện Thành công：Chèn đánh dấu + phác thảo hoàn chỉnh dựa trên kết quả AI
      normalizeResult = applyAIAnalysis(processedText, aiAnalysis);
      console.log('[importFullScript] Phát hiện cấu trúc AI đã hoàn tất:', normalizeResult.changes);
    } else {
      // AI không khả dụng hoặc Thất bại：Hạ cấp xuống đáy Yan thông thường
      normalizeResult = normalizeScriptFormat(processedText);
      if (normalizeResult.changes.length > 0) {
        console.log('[importFullScript] Bình thường hóa thường xuyên:', normalizeResult.changes);
      }
    }
    
    // 1. Phân tích văn bản chuẩn hóa
    const { background, episodes } = parseFullScript(normalizeResult.normalized);
    
    if (episodes.length === 0) {
      return {
        success: false,
        background: null,
        episodes: [],
        scriptData: null,
        error: "Không có tập nào có thể được phân tích cú pháp，Vui lòng kiểm tra K.ịch bảnĐịnh dạng",
      };
    }
    
    // Kỷ nguyên 1.5 sử dụng AI/thể loại ghi đè giá trị phát hiện thông thường（AI chính xác hơn）
    if (normalizeResult.aiAnalysis) {
      if (normalizeResult.aiAnalysis.era) {
        background.era = normalizeResult.aiAnalysis.era;
      }
      if (normalizeResult.aiAnalysis.genre) {
        background.genre = normalizeResult.aiAnalysis.genre;
      }
    }
    
    // 2. Chuyển đổi sang ScriptData Định dạng
    const scriptData = convertToScriptData(background, episodes);
    
    // 3. Lưbạn lưu trữ（Văn bản gốc Lưu，Văn bản chuẩn hóa chỉ được sử dụng để phân tích cú pháp）
    const store = useScriptStore.getState();
    store.setProjectBackground(projectId, background);
    store.setEpisodeRawScripts(projectId, episodes);
    store.setScriptData(projectId, scriptData);
    store.setRawScript(projectId, fullText);
    store.setParseStatus(projectId, "ready");
    
    // 4. Xây dựng siêu dữ liệu ở cấp độ kịch（SeriesMeta）— Người dùng đã chọn Phong cách và ngôn ngữ được truyền trực tiếp
    const aiResult = normalizeResult.aiAnalysis || null;
    const seriesMeta = populateSeriesMetaFromImport(background, scriptData, aiResult, importSettings);
    store.setSeriesMeta(projectId, seriesMeta);
    
    // 5. Tự động TạoDự án siêu dữ liệu MD（Như AI TạTài liệu tham khảo toàn cầu cho o）
    const metadataMd = exportProjectMetadata(projectId);
    store.setMetadataMarkdown(projectId, metadataMd);
    console.log('[importFullScript] Siêu dữ liệu đã được tự độngạo，Chiều dài:', metadataMd.length);
    
    return {
      success: true,
      background,
      projectBackground: background, // Đồng thời Quay lạCác trường iTwo tương thích
      episodes,
      scriptData,
    };
  } catch (error) {
    console.error("Import error:", error);
    return {
      success: false,
      background: null,
      episodes: [],
      scriptData: null,
      error: error instanceof Error ? error.message : "NhậpThất bại",
    };
  }
}

// ==================== Hoàn thành cấu trúc tập đơn ====================

export interface SingleEpisodeImportResult {
  success: boolean;
  sceneCount: number;
  error?: string;
}

/**
 * Hoàn thành cấu trúc tập đơn — Phân tích cú phápười dùđã dán tập duy nhất Kịch bảnội dung n là Cảcấu trúc nh
 *
 * quá trình：
 * 1. preprocessLineBreaks → parseScenes → Chuyển đổi sang ScriptScene[]
 * 2. Ghi lại nguyên tử vào cửa hàng（episodeRawScripts + scriptData.scenes + episodes.sceneIds）
 * 3. Dọn dẹp những bức ảnh cũ của tập này
 * 4. AI T nhẹạoTiêu đề + Đề cương（Không chặn trong nền）
 */
export async function importSingleEpisodeContent(
  rawContent: string,
  episodeIndex: number,
  projectId: string,
): Promise<SingleEpisodeImportResult> {
  const TAG = '[importSingleEpisodeContent]';

  try {
    const store = useScriptStore.getState();
    const project = store.projects[projectId];
    if (!project?.scriptData) {
      return { success: false, sceneCount: 0, error: 'Dự án hoặc Kịch bảndata không tồn tại' };
    }

    const scriptData = project.scriptData;
    const episode = scriptData.episodes.find(e => e.index === episodeIndex);
    if (!episode) {
      return { success: false, sceneCount: 0, error: `Không. không tìm thấy ${episodeIndex} đặt` };
    }

    // === 1. Tiền xử lý + Cảnh phân tích ===
    const preprocessed = preprocessLineBreaks(rawContent);
    const rawScenes = parseScenes(preprocessed.text);
    console.log(`${TAG} phân tích ra ${rawScenes.length} Cảnh`);

    if (rawScenes.length === 0) {
      // Không Cảnh đầu cũng Cập nhật rawContent
      store.updateEpisodeRawScript(projectId, episodeIndex, {
        rawContent,
        scenes: [],
      });
      return { success: true, sceneCount: 0 };
    }

    // === 2. SceneRawContent → ScriptScene ===
    const timestamp = Date.now();
    const timeMap: Record<string, string> = {
      'ngày': 'day', 'đêm': 'night', 'buổi sáng': 'dawn', 'chạng vạng': 'dusk',
      'Hoàng hôn': 'dusk', 'Bình minh': 'dawn', 'sáng sớm': 'dawn', 'buổi tối': 'dusk',
    };
    const newScenes = rawScenes.map((scene, idx) => {
      const sceneId = `scene_ep${episodeIndex}_${timestamp}_${idx + 1}`;
      const headerParts = scene.sceneHeader.split(/\s+/);
      const timeOfDay = headerParts[1] || 'ngày';
      const hasInterior = headerParts[2] && /^(trong|Bên ngoài|bên trong\/bên ngoài)$/.test(headerParts[2]);
      const locStart = hasInterior ? 3 : 2;
      let loc = headerParts.slice(locStart).join(' ') || headerParts[headerParts.length - 1] || 'Không rõ';
      loc = loc.replace(/\s*(?:nhân vật|Nhân vật)[：:].*/g, '').trim();

      let atmosphere = 'bình tĩnh';
      if (/lo lắng|nguy hiểm|xung đột|chiến đấu|tức giận/.test(scene.content)) atmosphere = 'lo lắng';
      else if (/Sự ấm áp|hạnh phúc|cười|Huân/.test(scene.content)) atmosphere = 'Sự ấm áp';
      else if (/buồn|khóc|đau đớn|nước mắt/.test(scene.content)) atmosphere = 'buồn';
      else if (/bí ẩn|kỳ lạ|bóng tối/.test(scene.content)) atmosphere = 'bí ẩn';

      return {
        id: sceneId,
        name: `${episodeIndex}-${idx + 1} ${loc}`,
        location: loc,
        time: timeMap[timeOfDay] || 'day',
        atmosphere,
      };
    });
    const newSceneIds = newScenes.map(s => s.id);

    // === 3. Ghi lại nguyên tử vào cửa hàng ===
    const oldSceneIds = new Set(episode.sceneIds);
    const remainingScenes = scriptData.scenes.filter(s => !oldSceneIds.has(s.id));
    const remainingShots = project.shots.filter(s => !oldSceneIds.has(s.sceneRefId));

    // Cập nhật episodeRawScript
    store.updateEpisodeRawScript(projectId, episodeIndex, {
      rawContent,
      scenes: rawScenes,
    });

    // Cập nhật scriptData（Cảnh list +ep.sceneIds）
    store.setScriptData(projectId, {
      ...scriptData,
      scenes: [...remainingScenes, ...newScenes],
      episodes: scriptData.episodes.map(e =>
        e.index === episodeIndex ? { ...e, sceneIds: newSceneIds } : e
      ),
    });

    // Dọn dẹp ảnh cũ
    if (remainingShots.length !== project.shots.length) {
      store.setShots(projectId, remainingShots);
      console.log(`${TAG} Dọn dẹp ảnh cũ: ${project.shots.length - remainingShots.length} một`);
    }

    console.log(`${TAG} Hoàn thiện kết cấu: ${newScenes.length} Cảnh`);

    // === 4. Tiêu đề + phác thảo AI nhẹ（Không chặn trong nền） ===
    generateSingleEpisodeTitleAndSynopsis(projectId, episodeIndex).catch(e => {
      console.warn(`${TAG} Tiêu đề/phác thảo TạoThất bại（Không ảnh hưởng đến việc hoàn thiện kết cấu）:`, e);
    });

    return { success: true, sceneCount: newScenes.length };
  } catch (error) {
    console.error('[importSingleEpisodeContent] Error:', error);
    return {
      success: false,
      sceneCount: 0,
      error: error instanceof Error ? error.message : 'Hoàn thiện kết cấu Thất bại',
    };
  }
}

/**
 * AI nhẹ là một tập duy nhất TạoTiêu đề + Đề cương（Tác vụ nền，Hoàn thiện cấu trúc không chặn）
 */
async function generateSingleEpisodeTitleAndSynopsis(
  projectId: string,
  episodeIndex: number,
): Promise<void> {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  if (!project) return;

  const epRaw = project.episodeRawScripts.find(e => e.episodeIndex === episodeIndex);
  if (!epRaw || !epRaw.rawContent) return;

  // Nếu đã có tiêu đề và dàn ý có ý nghĩa thì hãy bỏ qua nó.
  const hasTitle = epRaw.title && !/^Không.[\d một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn]+bộ$/.test(epRaw.title.trim());
  const hasSynopsis = !!(epRaw.synopsis && epRaw.synopsis.trim().length > 0);
  if (hasTitle && hasSynopsis) return;

  const background = project.projectBackground;
  const seriesCtx = buildSeriesContextSummary(project.seriesMeta || null);
  const contentSummary = epRaw.rawContent.slice(0, 800);

  const system = `bạn là Kịch bảcấu trúc Phân tíchexpert。Theo K.ịch bảnglobalNền và nội dung một tập，TạoTiêu đề và tóm tắt của tập phim。
${seriesCtx ? `\n【Tài liệu tham khảo kiến thức cấp độ kịch】\n${seriesCtx}\n` : ''}Tiêu đề phim truyền hình：${background?.title || project.scriptData?.title || 'Chưa đặt tên'}
Loại：${background?.genre || 'Không rõ'}
${background?.era ? `thời đại：${background.era}` : ''}

Vui lòng sử dụng JSON Định dạngQuay lại：
{
  "title": "Tiêu đề 6-15 từ（Phản ánh xung đột cốt lõi của tập phim này/bước ngoặt）",
  "synopsis": "dàn ý 100-200 từ（Tóm tắt cốt truyện chính của tập này）",
  "keyEvents": ["Phímự kiện1", "Phímự kiện2", "Phímự kiện3"]
}`;

  const user = `Không.${episodeIndex}đặt nội dung：\n${contentSummary}`;

  try {
    const result = await callFeatureAPI('script_analysis', system, user, {
      temperature: 0.3,
      maxTokens: 512,
    });
    if (!result) return;

    const jsonMatch = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    const updates: Partial<EpisodeRawScript> = {};

    if (!hasTitle && parsed.title) {
      const fullTitle = `Không.${episodeIndex}đặt：${parsed.title}`;
      updates.title = fullTitle;
      // Đồng bộ hóa với scriptData.episodes
      const cur = useScriptStore.getState();
      const sd = cur.projects[projectId]?.scriptData;
      if (sd) {
        cur.setScriptData(projectId, {
          ...sd,
          episodes: sd.episodes.map(e =>
            e.index === episodeIndex ? { ...e, title: fullTitle } : e
          ),
        });
      }
    }

    if (!hasSynopsis && parsed.synopsis) {
      updates.synopsis = parsed.synopsis;
      updates.keyEvents = parsed.keyEvents || [];
      updates.synopsisGeneratedAt = Date.now();
    }

    if (Object.keys(updates).length > 0) {
      useScriptStore.getState().updateEpisodeRawScript(projectId, episodeIndex, updates);
      console.log(`[generateSingleEpisodeTitleAndSynopsis] Không.${episodeIndex}tiêu đề tập phim/Đề cương đã được Tạo`);
    }
  } catch (e) {
    console.warn('[generateSingleEpisodeTitleAndSynopsis] AI gọi Thất bại:', e);
  }
}

/**
 * Đối với một tập duy nhất TạoPhân cảnh
 * @param tập Index chỉ số tập（1-based）
 * @param projectId Dự ánID
 * @param options TạoTùy chọn
 */
export async function generateEpisodeShots(
  episodeIndex: number,
  projectId: string,
  options: GenerateShotsOptions,
  onProgress?: (message: string) => void
): Promise<GenerateEpisodeShotsResult> {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project) {
    throw new Error("Dự án không tồn tại");
  }
  
  const episodeScript = project.episodeRawScripts.find(
    (ep) => ep.episodeIndex === episodeIndex
  );
  
  if (!episodeScript) {
    throw new Error(`Không. không tìm thấy ${episodeIndex} Đặt Kịch bản`);
  }
  
  // Cập nhậtập T của tạoTrạng thái
  store.updateEpisodeRawScript(projectId, episodeIndex, {
    shotGenerationStatus: 'generating',
  });
  
  try {
    onProgress?.(`Làm việc trên ${episodeIndex} Đặt TạoPhân cảnh...`);
    
    // Lấy C tương ứng với bộ nàyảnh
    const scriptData = project.scriptData;
    if (!scriptData) {
      throw new Error("Kịch bảndata không tồn tại");
    }
    
    const episode = scriptData.episodes.find((ep) => ep.index === episodeIndex);
    if (!episode) {
      throw new Error(`Không. không tìm thấy ${episodeIndex} tập dữ liệu cấu trúc`);
    }
    
    const episodeScenes = scriptData.scenes.filter((s) =>
      episode.sceneIds.includes(s.id)
    );
    
    // \u6784\u5efaCảnh nội dung cho Phân cảnhTạo
    const scenesWithContent = episodeScenes.map((scene, idx) => {
      const rawScene = episodeScript.scenes[idx];
      return {
        ...scene,
        // Sử dụng nội dung gốcTạoPhân cảnh
        rawContent: rawScene?.content || '',
        dialogues: rawScene?.dialogues || [],
        actions: rawScene?.actions || [],
      };
    });
    
    // TạoPhân cảnh
    const newShots = await generateShotsForEpisode(
      scenesWithContent,
      episodeIndex,
      episode.id,
      scriptData.characters,
      options,
      onProgress
    );
    
    // Cập nhậtPh hiện tạiân cảnh（Xóa Ph cũ khỏi tập nàyân cảnh，ThêmNewPhân cảnh）
    const existingShots = project.shots.filter(
      (shot) => shot.episodeId !== episode.id
    );
    const allShots = [...existingShots, ...newShots];
    
    store.setShots(projectId, allShots);
    
    // === AI Góc nhìnPhân tích（Phân cảnhTạo Tự động thực hiện sau）===
    let viewpointAnalyzed = false;
    let viewpointSkippedReason: string | undefined;
    let analysisExecuted = false;
    let viewpointCount = 0;
    
    console.log('\n============================================');
    console.log('[generateEpisodeShots] === Bắt đầu AI Góc nhìnPhân tích ===');
    console.log('[generateEpisodeShots] apiKey:', options.apiKey ? `được cấu hình (chiều dài${options.apiKey.length})` : 'Chưa được định cấu hình');
    console.log('[generateEpisodeShots] provider:', options.provider);
    console.log('[generateEpisodeShots] baseUrl:', options.baseUrl || 'Mặc định');
    console.log('[generateEpisodeShots] episodeScenes.length:', episodeScenes.length);
    console.log('[generateEpisodeShots] newShots.length:', newShots.length);
    console.log('============================================\n');
    
    if (!options.apiKey) {
      viewpointSkippedReason = 'apiKey chưa được định cấu hình';
      console.error('[generateEpisodeShots] ❌ Bỏ qua AI Góc nhìnPhân tích: apiKey chưa được định cấu hình');
    } else if (episodeScenes.length === 0) {
      viewpointSkippedReason = 'Không Cảnh';
      console.warn('[generateEpisodeShots] ⚠️ Bỏ qua AI Góc nhìnPhân tích: không Cảnh');
    }
    
    if (options.apiKey && episodeScenes.length > 0) {
      onProgress?.(`Hiện đang làm việc trên AI Ph.ân tíchCảnhGóc nhìn（tổng cộng ${episodeScenes.length} Cảnh）...`);
      
      try {
        // Lấy tóm tắt tập phim và phím Sự kiện
        const episodeSynopsis = episodeScript.synopsis || '';
        const keyEvents = episodeScript.keyEvents || [];
        
        console.log('[generateEpisodeShots] Sơ lược về tập này:', episodeSynopsis ? `Đã định cấu hình (${episodeSynopsis.length}từ)` : 'Chưa được định cấu hình');
        console.log('[generateEpisodeShots] Phímự kiện:', keyEvents.length > 0 ? keyEvents.join(', ') : 'Chưa được định cấu hình');
        
        const background = project.projectBackground;
        const viewpointOptions: ViewpointAnalysisOptions = {
          episodeSynopsis,  // Đưa vào bản tóm tắt tập phim
          keyEvents,        // Nhập khóa Sự kiện
          title: background?.title,
          genre: background?.genre,
          era: background?.era,
          worldSetting: background?.worldSetting,
        };
        
        console.log('[generateEpisodeShots] quan điểmTùy chọn được xây dựng, thể loại:', viewpointOptions.genre || 'Không rõ');
        
        // Nhận cấu hình đồng thời（Sử dụng đầu tĩnh Nhậcửa hàng của p）
        // Giới hạn đồng thời của API Zhipu rất nghiêm ngặt，Góc nhìnPhân tích sử dụng tối đa 10 đồng thời
        const userConcurrency = useAPIConfigStore.getState().concurrency || 1;
        const concurrency = Math.min(userConcurrency, 10);
        console.log(`[generateEpisodeShots] Sử dụng đồng thời: ${concurrency} (Người dùngCài đặt: ${userConcurrency}, giới hạn trên: 10)`);
        
        // cho mỗi CảnhPhân tíchGóc nhìn（Hỗ trợĐồng thời）
        const updatedScenes = [...scriptData.scenes];
        
        // Chuẩn bị CảnhPhân tínhiệm vụ ch
        const sceneAnalysisTasks = episodeScenes.map((scene, i) => ({
          scene,
          index: i,
          sceneShots: newShots.filter(s => s.sceneRefId === scene.id),
        })).filter(task => task.sceneShots.length > 0);
        
        console.log(`[generateEpisodeShots] 🚀 Chờ Ph.ân tíchCảnh: ${sceneAnalysisTasks.length} một，Số lượng đồng thời: ${concurrency}`);
        
        // Xử lý một C duy nhấtảchức năng của nh
        const processScene = async (taskIndex: number) => {
          const task = sceneAnalysisTasks[taskIndex];
          const { scene, index: i, sceneShots } = task;
          
          console.log(`[generateEpisodeShots] Cảnh ${i + 1}/${episodeScenes.length}: "${scene.location}" Có ${sceneShots.length} Phân cảnh`);
          analysisExecuted = true;
          onProgress?.(`AI Phân tíchCảnh ${i + 1}/${episodeScenes.length}: ${scene.location}...`);
          
          console.log(`[generateEpisodeShots] 🔄 Gọi analyzeSceneViewpoints cho "${scene.location}"...`);
          const result = await analyzeSceneViewpoints(scene, sceneShots, viewpointOptions);
          console.log(`[generateEpisodeShots] ✅ AI Phân tích đã hoàn thành，Quay lại ${result.viewpoints.length} Góc nhìn:`, 
            result.viewpoints.map(v => v.name).join(', '));
          console.log(`[generateEpisodeShots] 📝 analysisNote: ${result.analysisNote}`);
          
          return { scene, sceneShots, result };
        };
        
        // Kiểm soát đồng thời cho các lần khởi động so le：Bắt đầu một nhiệm vụ mới cứ sau 5 giây，Nhiều nhất là đồng thời cùng một lúc
        const settledResults = await runStaggered(
          sceneAnalysisTasks.map((_, taskIndex) => async () => {
            console.log(`[generateEpisodeShots] 🚀 Bắt đầu Cảnh ${taskIndex + 1}/${sceneAnalysisTasks.length}`);
            return await processScene(taskIndex);
          }),
          concurrency,
          5000
        );
        
        // Quy trình Tất cảkết quả
        for (const settledResult of settledResults) {
          if (settledResult.status === 'fulfilled') {
            const { scene, sceneShots, result } = settledResult.value;
            
            // Cập nhậtCảG của nhóc nhìdữ liệu
            const sceneIndex = updatedScenes.findIndex(s => s.id === scene.id);
            if (sceneIndex !== -1) {
              const viewpointsData = result.viewpoints.map((v: any, idx: number) => ({
                id: v.id,
                name: v.name,
                nameEn: v.nameEn,
                shotIds: v.shotIndexes.map((si: number) => sceneShots[si - 1]?.id).filter(Boolean),
                keyProps: v.keyProps,
                gridIndex: idx,
              }));
              
              // Kiểm tra xem có Ph nào chưa được phân bổ khôngân cảnh，và gán chúng cho G thích hợpóc nhìn
              const allAssignedShotIds = new Set(viewpointsData.flatMap((v: any) => v.shotIds));
              const unassignedShots = sceneShots.filter((s: any) => !allAssignedShotIds.has(s.id));
              
              if (unassignedShots.length > 0) {
                console.log(`[generateEpisodeShots] ⚠️ khám phá ${unassignedShots.length} Ph chưa được phân bổân cảnh:`, unassignedShots.map((s: any) => s.id));
                
                // Chiến lược：Theo Ph.ân cảnội dung nh được phân phối thông minh tới G phù hợp nhấtóc nhìn
                for (const shot of unassignedShots) {
                  const shotText = [
                    shot.actionSummary,
                    shot.visualDescription,
                    shot.visualFocus,
                    shot.dialogue,
                  ].filter(Boolean).join(' ').toLowerCase();
                  
                  // Tìm G phù hợp nhấtóc nhìn
                  let bestViewpointIdx = 0;
                  let bestScore = 0;
                  
                  for (let vIdx = 0; vIdx < viewpointsData.length; vIdx++) {
                    const vp = viewpointsData[vIdx];
                    const vpName = vp.name.toLowerCase();
                    const vpKeywords = vp.keyProps || [];
                    
                    let score = 0;
                    const nameKeywords = vpName.replace(/(Góc nhìn|Quận|chút)$/g, '').split('');
                    for (const char of nameKeywords) {
                      if (shotText.includes(char)) score += 1;
                    }
                    for (const prop of vpKeywords) {
                      if (shotText.includes(prop.toLowerCase())) score += 2;
                    }
                    
                    if (score > bestScore) {
                      bestScore = score;
                      bestViewpointIdx = vIdx;
                    }
                  }
                  
                  if (bestScore === 0) {
                    const overviewIdx = viewpointsData.findIndex((v: any) => 
                      v.name.includes('Toàn cảnh') || v.id === 'overview'
                    );
                    bestViewpointIdx = overviewIdx >= 0 ? overviewIdx : 0;
                  }
                  
                  viewpointsData[bestViewpointIdx].shotIds.push(shot.id);
                  console.log(`[generateEpisodeShots]   - Phân cảnh ${shot.id} Được giao cho Góc nhìn "${viewpointsData[bestViewpointIdx].name}" (score: ${bestScore})`);
                }
              }
              
              updatedScenes[sceneIndex] = {
                ...updatedScenes[sceneIndex],
                viewpoints: viewpointsData,
              };
              viewpointCount += viewpointsData.length;
              console.log(`[generateEpisodeShots] 💾 Cảnh "${scene.location}" quan điểm Cập nhật:`, viewpointsData);
            }
          } else {
            console.error(`[generateEpisodeShots] ❌ CảnhPhân tíchThất bại:`, settledResult.reason);
          }
        }
        
        // Bỏ qua Không Phân cảC của nhảnhNhật ký
        const skippedScenes = episodeScenes.filter(scene => 
          !sceneAnalysisTasks.find(t => t.scene.id === scene.id)
        );
        for (const scene of skippedScenes) {
          console.log(`[generateEpisodeShots] ⏭️ Bỏ qua Cảnh "${scene.location}" (Không có Phân cảnh)`);
        }
        
        // LưuCập nhậC sau tảnh dữ liệu
        console.log('\n============================================');
        console.log('[generateEpisodeShots] 📦 Lưu AI Góc nhìvào scriptData.scenes...');
        console.log('[generateEpisodeShots] Có G trong UpdateScenesóc nhìnCảnh:');
        updatedScenes.forEach(s => {
          if (s.viewpoints && s.viewpoints.length > 0) {
            console.log(`  - ${s.location}: ${s.viewpoints.length} Góc nhìn [${s.viewpoints.map((v: any) => v.name).join(', ')}]`);
          }
        });
        
        store.setScriptData(projectId, {
          ...scriptData,
          scenes: updatedScenes,
        });
        
        console.log('[generateEpisodeShots] ✅ AI Góc nhìnhas Lưbạn lưu trữ');
        console.log('[generateEpisodeShots] Tổng AI Phân tíchGóc nhìsố n:', viewpointCount);
        console.log('============================================\n');
        
        viewpointAnalyzed = analysisExecuted;
        if (!analysisExecuted) {
          viewpointSkippedReason = 'Không có Phân cảnh';
        }
        
        onProgress?.(`AI Góc nhìnPhân tích đã hoàn thành（${viewpointCount} Góc nhìn）`);
      } catch (e) {
        const err = e as Error;
        console.error('\n============================================');
        console.error('[generateEpisodeShots] ❌ AI Góc nhìnPhân tíchThất bại:', err);
        console.error('[generateEpisodeShots] Error name:', err.name);
        console.error('[generateEpisodeShots] Error message:', err.message);
        console.error('[generateEpisodeShots] Error stack:', err.stack);
        console.error('============================================\n');
        viewpointSkippedReason = `AI Phân tíchThất bại: ${err.message}`;
        // Không ảnh hưởng đến quá trình chính，Nhưng Bản ghiChi tiếtLỗi
      }
    }
    
    store.updateEpisodeRawScript(projectId, episodeIndex, {
      shotGenerationStatus: 'completed',
      lastGeneratedAt: Date.now(),
    });
    
    onProgress?.(`Không. ${episodeIndex} SetPhân cảnhTạoHoàn thành！tổng cộng ${newShots.length} Phân cảnh`);
    
    return { shots: newShots, viewpointAnalyzed, viewpointSkippedReason };
  } catch (error) {
    store.updateEpisodeRawScript(projectId, episodeIndex, {
      shotGenerationStatus: 'error',
    });
    throw error;
  }
}

/**
 * C cho bộ được chỉ địnhảnhTạoPhân cảnh
 */
async function generateShotsForEpisode(
  scenes: Array<{
    id: string;
    name?: string;
    location: string;
    time: string;
    atmosphere: string;
    rawContent: string;
    dialogues: Array<{ character: string; parenthetical?: string; line: string }>;
    actions: string[];
  }>,
  episodeIndex: number,
  episodeId: string,
  characters: Array<{ id: string; name: string }>,
  options: GenerateShotsOptions,
  onProgress?: (message: string) => void
): Promise<Shot[]> {
  const shots: Shot[] = [];
  let shotIndex = 1;
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    onProgress?.(`Quy trình Cảnh ${i + 1}/${scenes.length}: ${scene.name || scene.location}`);
    
    // Dựa trên Cảnh nội dung TạoPhân cảnh
    const sceneShots = generateShotsFromSceneContent(
      scene,
      episodeId,
      shotIndex,
      characters
    );
    
    shots.push(...sceneShots);
    shotIndex += sceneShots.length;
  }
  
  return shots;
}

/**
 * Dựa trên Cảnh nội dung gốcTạoPhân cảnh（T chính quyạo，Không phụ thuộc vào AI）
 * Mỗi đoạn hội thoại hoặc Hành độngTạoaPhân cảnh
 */
function generateShotsFromSceneContent(
  scene: {
    id: string;
    name?: string;
    location: string;
    time: string;
    atmosphere: string;
    rawContent: string;
    dialogues: Array<{ character: string; parenthetical?: string; line: string }>;
    actions: string[];
  },
  episodeId: string,
  startIndex: number,
  characters: Array<{ id: string; name: string }>
): Shot[] {
  const shots: Shot[] = [];
  let index = startIndex;
  
  // Phân tích cú pháp Cảnh nội dung，theo thứ tự TạoPhân cảnh
  const lines = scene.rawContent.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Bỏ qua dòng ký tự và dòng trống（bao gồm cả việc giảm giá Định dạngru **nhân vật：xxx**）
    if (!trimmedLine) continue;
    if (trimmedLine.startsWith('nhân vật') || trimmedLine.startsWith('**nhân vật')) continue;
    // Bỏ qua việc đánh dấu thuần túy Định dạdòng ng（Chẳng hạn như **xxx**）
    if (trimmedLine.match(/^\*\*[^nhân vật\*]+\*\*$/)) continue;
    
    // dòng đối thoại
    const dialogueMatch = trimmedLine.match(/^([^：:（\([【\n△\*]{1,10})[：:]\s*(?:[（\(]([^）\)]+)[）\)])?\s*(.+)$/);
    if (dialogueMatch) {
      const charName = dialogueMatch[1].trim();
      const parenthetical = dialogueMatch[2]?.trim() || '';
      const dialogueText = dialogueMatch[3].trim();
      
      // Bỏ qua việc không đối thoại
      if (charName.match(/^[Thuyết minh phụ đề Cảnh nhân vật]/)) continue;
      
      const charId = characters.find(c => c.name === charName)?.id || '';
      
      shots.push(createShot({
        index: index++,
        episodeId,
        sceneRefId: scene.id,
        actionSummary: `${charName}nói`,
        visualDescription: `${scene.location}，${charName}${parenthetical ? `（${parenthetical}）` : ''}nói："${dialogueText.slice(0, 50)}${dialogueText.length > 50 ? '...' : ''}"`,
        dialogue: `${charName}${parenthetical ? `（${parenthetical}）` : ''}：${dialogueText}`,
        characterNames: [charName],
        characterIds: charId ? [charId] : [],
        shotSize: dialogueText.length > 30 ? 'MS' : 'CU',
        duration: Math.max(3, Math.ceil(dialogueText.length / 10)),
      }));
      continue;
    }
    
    // Hành độdòng ng (△bắt đầu)
    if (trimmedLine.startsWith('△')) {
      const actionText = trimmedLine.slice(1).trim();
      
      // từ Hành độngMô tảTrích xuất Nh có thể từân vật
      const mentionedChars = characters.filter(c => 
        actionText.includes(c.name)
      );
      
      shots.push(createShot({
        index: index++,
        episodeId,
        sceneRefId: scene.id,
        // Giữ nguyên chữ H ban đầuành độvăn bản，Đừng cắt ngắn，Dễ dàng sử dụng trong quá trình hiệu chỉnh AI
        actionSummary: actionText,
        visualDescription: `${scene.location}，${actionText}`,
        characterNames: mentionedChars.map(c => c.name),
        characterIds: mentionedChars.map(c => c.id),
        shotSize: actionText.includes('Toàn cảnh') || actionText.includes('xa') ? 'WS' : 'MS',
        duration: Math.max(2, Math.ceil(actionText.length / 15)),
        ambientSound: detectAmbientSound(actionText, scene.atmosphere),
      }));
      continue;
    }
    
    // phụ đề【】
    if (trimmedLine.startsWith('【') && trimmedLine.endsWith('】')) {
      const subtitleText = trimmedLine.slice(1, -1);
      
      // Nếu đó là một điểm đánh dấu hồi tưởng，TạoChuyển tiếpCảnh quay
      if (subtitleText.includes('hồi tưởng')) {
        shots.push(createShot({
          index: index++,
          episodeId,
          sceneRefId: scene.id,
          actionSummary: subtitleText,
          visualDescription: `【${subtitleText}】Màn hình chuyển màu chuyển sắcển tiếp`,
          characterNames: [],
          characterIds: [],
          shotSize: 'WS',
          duration: 2,
        }));
        continue;
      }
      
      // Hiển thị phụ đề
      if (subtitleText.startsWith('phụ đề')) {
        shots.push(createShot({
          index: index++,
          episodeId,
          sceneRefId: scene.id,
          actionSummary: 'Hiển thị phụ đề',
          visualDescription: `Chèn phụ đề trên màn hình：${subtitleText.replace('phụ đề：', '').replace('Phụ đề:', '')}`,
          characterNames: [],
          characterIds: [],
          shotSize: 'WS',
          duration: 3,
        }));
      }
    }
  }
  
  // Nếu Cảnh không TạoBất kỳ Ph nàoân cảnh，TạoanMặc địCơ sở C của nhảnh quay
  if (shots.length === 0) {
    shots.push(createShot({
      index: index,
      episodeId,
      sceneRefId: scene.id,
      actionSummary: `${scene.name || scene.location} xây dựngCảnh quay`,
      visualDescription: `${scene.location}，${scene.atmosphere}bầu không khí`,
      characterNames: [],
      characterIds: [],
      shotSize: 'WS',
      duration: 3,
      ambientSound: detectAmbientSound('', scene.atmosphere),
    }));
  }
  
  return shots;
}

/**
 * Tự động ghép Nh dựa trên số tậpân vậbiến thể giai đoạn của t
 * cho tiến sĩân cảnhTạTự động chọn đúng Phi khi oên bảNhân vật（Ví dụ như tập 50 tự động sử dụng phiên bản trung niên của Trương Minh）
 */
function matchCharacterVariationsForEpisode(
  characterIds: string[],
  episodeIndex: number
): Record<string, string> {
  const characterVariations: Record<string, string> = {};
  const charLibStore = useCharacterLibraryStore.getState();
  
  for (const charId of characterIds) {
    // Chấp nhận ký tựThư việnId Tìm Thư viện nhân vậNh trong tân vật
    // Lưu ý：charId là Kịch bảID ở n，Cần tìm Th liên quanư viện nhân vậtNhân vật
    const scriptStore = useScriptStore.getState();
    const projects = Object.values(scriptStore.projects);
    
    // Đi ngang Dự ánfindNhân vật
    for (const project of projects) {
      const scriptChar = project.scriptData?.characters.find(c => c.id === charId);
      if (scriptChar?.characterLibraryId) {
        const libChar = charLibStore.getCharacterById(scriptChar.characterLibraryId);
        if (libChar && libChar.variations.length > 0) {
          // Tìm các biến thể của màn phù hợp với số tập hiện tại
          const matchedVariation = getVariationForEpisode(libChar.variations, episodeIndex);
          if (matchedVariation) {
            characterVariations[charId] = matchedVariation.id;
            console.log(`[VariationMatch] Nhân vật ${scriptChar.name} Không.${episodeIndex}đặt -> Sử dụng các biến thể "${matchedVariation.name}"`);
          }
        }
        break;
      }
    }
  }
  
  return characterVariations;
}

/**
 * Trích xuất số tập từ tậpId
 */
function getEpisodeIndexFromId(episodeId: string): number {
  // episodeId Định dạng là "ep_X"
  const match = episodeId.match(/ep_(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * TạoPhân cảnh đối tượng
 */
function createShot(params: {
  index: number;
  episodeId: string;
  sceneRefId: string;
  actionSummary: string;
  visualDescription: string;
  dialogue?: string;
  characterNames: string[];
  characterIds: string[];
  shotSize: string;
  duration: number;
  ambientSound?: string;
  cameraMovement?: string;
}): Shot {
  // Tự động khớp Nhân vậbiến thể giai đoạn t
  const episodeIndex = getEpisodeIndexFromId(params.episodeId);
  const characterVariations = matchCharacterVariationsForEpisode(
    params.characterIds,
    episodeIndex
  );
  
  return {
    id: `shot_${Date.now()}_${params.index}`,
    index: params.index,
    episodeId: params.episodeId,
    sceneRefId: params.sceneRefId,
    actionSummary: params.actionSummary,
    visualDescription: params.visualDescription,
    dialogue: params.dialogue,
    characterNames: params.characterNames,
    characterIds: params.characterIds,
    characterVariations,  // Ánh xạ biến thể giai đoạn được điền tự động
    shotSize: params.shotSize,
    duration: params.duration,
    ambientSound: params.ambientSound,
    cameraMovement: params.cameraMovement || 'Static',
    imageStatus: 'idle',
    imageProgress: 0,
    videoStatus: 'idle',
    videoProgress: 0,
  };
}

/**
 * Phát hiện âm thanh xung quanh
 */
function detectAmbientSound(text: string, atmosphere: string): string {
  if (text.includes('mưa') || atmosphere.includes('mưa')) return 'tiếng mưa';
  if (text.includes('gió') || atmosphere.includes('gió')) return 'Âm thanh của gió';
  if (text.includes('biển') || text.includes('bến tàu')) return 'Âm thanh của sóng、hải âu';
  if (text.includes('đường phố') || text.includes('thị trường')) return 'Tiếng ồn đường phố、Một đám đông khổng lồ';
  if (text.includes('đêm') || atmosphere.includes('đêm')) return 'Ban đêsự im lặng、Tiếng côn trùng kêu';
  if (text.includes('cơm') || text.includes('ăn')) return 'Tiếng dao nĩa leng keng';
  return 'âm thanh xung quanh';
}

/**
 * Cập nhậtTất cảBộ Phân cảnh
 */
export async function regenerateAllEpisodeShots(
  projectId: string,
  options: GenerateShotsOptions,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project || !project.episodeRawScripts.length) {
    throw new Error("Không có gì với Tạtập hợp của o");
  }
  
  const totalEpisodes = project.episodeRawScripts.length;
  
  for (let i = 0; i < totalEpisodes; i++) {
    const ep = project.episodeRawScripts[i];
    onProgress?.(i + 1, totalEpisodes, `Là Tạthứ khác ${ep.episodeIndex} Đặt...`);
    
    await generateEpisodeShots(
      ep.episodeIndex,
      projectId,
      options,
      (msg) => onProgress?.(i + 1, totalEpisodes, msg)
    );
  }
}

/**
 * Nhận bộ TạoTrạng tháiTóm tắt
 */
export function getEpisodeGenerationSummary(projectId: string): {
  total: number;
  completed: number;
  generating: number;
  idle: number;
  error: number;
} {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project) {
    return { total: 0, completed: 0, generating: 0, idle: 0, error: 0 };
  }
  
  const episodes = project.episodeRawScripts;
  return {
    total: episodes.length,
    completed: episodes.filter(ep => ep.shotGenerationStatus === 'completed').length,
    generating: episodes.filter(ep => ep.shotGenerationStatus === 'generating').length,
    idle: episodes.filter(ep => ep.shotGenerationStatus === 'idle').length,
    error: episodes.filter(ep => ep.shotGenerationStatus === 'error').length,
  };
}

// ==================== Chức năng hiệu chỉnh AI ====================

// CalibrationOptions không còn cần thiết nữa，Thống nhất có được cấu hình từ ánh xạ dịch vụ
export interface CalibrationOptions {
  // Giữ giao diện trống để duy trì khả năng tương thích
}

export interface CalibrationResult {
  success: boolean;
  calibratedCount: number;
  totalMissing: number;
  error?: string;
}

/**
 * Kiểm tra xem số tập có bị thiếu tiêu đề không
 * Tiêu chí đánh giá danh hiệu còn thiếu：Tiêu đề trống，hoặc chỉ"Tập X"Không có nội dung sau dấu hai chấm
 */
function isMissingTitle(title: string): boolean {
  if (!title || title.trim() === '') return true;
  // trận đấu "Tập X" hoặc "Tập XX" nhưng không có tiêu đề tiếp theo
  const onlyEpisodeNum = /^Không.[\d một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn]+bộ$/;
  return onlyEpisodeNum.test(title.trim());
}

/**
 * Nhận danh sách các tập bị thiếu tiêu đề
 */
export function getMissingTitleEpisodes(projectId: string): EpisodeRawScript[] {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project || !project.episodeRawScripts.length) {
    return [];
  }
  
  return project.episodeRawScripts.filter(ep => isMissingTitle(ep.title));
}


/**
 * Trích xuất tóm tắt từ nội dung đã đặt
 */
function extractEpisodeSummary(episode: EpisodeRawScript): string {
  const parts: string[] = [];
  
  // Lấy 3 chữ C đầu tiênảnh tóm tắt nội dung
  const scenesToUse = episode.scenes.slice(0, 3);
  for (const scene of scenesToUse) {
    // Cảnh thông tin（Sử dụng sceneHeader thay vì vị trí）
    if (scene.sceneHeader) {
      parts.push(`Cảnh：${scene.sceneHeader}`);
    }
    
    // Lấy vài dòng đối thoại đầu tiên
    const dialogueSample = scene.dialogues.slice(0, 3).map(d => 
      `${d.character}：${d.line.slice(0, 30)}`
    ).join('\n');
    if (dialogueSample) {
      parts.push(dialogueSample);
    }
    
    // Lấy vài chữ H đầu tiênành động mô tả
    const actionSample = scene.actions.slice(0, 2).map(a => a.slice(0, 50)).join('\n');
    if (actionSample) {
      parts.push(actionSample);
    }
  }
  
  // Giới hạn tổng chiều dài
  const summary = parts.join('\n').slice(0, 800);
  return summary || '（Không có nội dung）';
}

/**
 * Hiệu chuẩn AI：là số tập thiếu tựa TạoTiêu đề
 * @param projectId Dự ánID
 * @tùy chọn param cấu hình AI
 * @param onProgress Tiến độgọi lại
 */
export async function calibrateEpisodeTitles(
  projectId: string,
  _options?: CalibrationOptions, // không còn cần thiết nữa，dành riêng cho khả năng tương thích
  onProgress?: (current: number, total: number, message: string) => void
): Promise<CalibrationResult> {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project) {
    return { success: false, calibratedCount: 0, totalMissing: 0, error: 'Dự án không tồn tại' };
  }
  
  // Tìm số tập bị thiếu tiêu đề
  const missingEpisodes = getMissingTitleEpisodes(projectId);
  const totalMissing = missingEpisodes.length;
  
  if (totalMissing === 0) {
    return { success: true, calibratedCount: 0, totalMissing: 0 };
  }
  
  onProgress?.(0, totalMissing, `tìm thấy ${totalMissing} Đặt tiêu đề bị thiếu，Bắt đầuHiệu chuẩn...`);
  
  // Nhận N toàn cầuềthông tin
  const background = project.projectBackground;
  const globalContext = {
    title: background?.title || project.scriptData?.title || 'Không tênKịch bản',
    outline: background?.outline || project.scriptData?.logline || '',
    characterBios: background?.characterBios || '',
    totalEpisodes: project.episodeRawScripts.length,
  };
  
  // Đưa kiến thức thế giới quan vào tổng quan（Nhân vật、trại、thời đại、Hệ thống sức mạnh, v.v.）
  const seriesCtx = buildSeriesContextSummary(project.seriesMeta || null);
  
  try {
    // Chuẩn bị hàng loạt
    type TitleItem = { index: number; contentSummary: string };
    const items: TitleItem[] = missingEpisodes.map(ep => ({
      index: ep.episodeIndex,
      contentSummary: extractEpisodeSummary(ep),
    }));
    
    const { results, failedBatches, totalBatches } = await processBatched<TitleItem, string>({
      items,
      feature: 'script_analysis',
      buildPrompts: (batch) => {
        const { title, outline, characterBios, totalEpisodes } = globalContext;
        const system = `Bạn là một nhà biên kịch cấp cao của Hollywood，Được đề cử giải Emmy cho Kịch bản xuất sắc nhất。

khả năng chuyên môn của bạn：
- Thành thạo nghệ thuật đặt tên tập phim：Nắm bắt xung đột cốt lõi và cảm xúc của mỗi tập phim bằng một tiêu đề ngắn gọn và mạnh mẽ
- Kiểm soát cấu trúc tường thuật：Hiểu về chiến tranh kinh doanh、gia đình、Cảm xúc thì khác LoạiTập phim có tên là Phong cách
- Độ nhạy thị trường：Biết tiêu đề nào sẽ thu hút khán giả của bạn，Cải thiện tỷ lệ nhấp chuột

Nhiệm vụ của bạn là đi theo Kịch bảN toàn cầu của nền và nội dung từng tập，cho mỗi tập TạoTiêu đề ngắn gọn và hấp dẫn。
${seriesCtx ? `\n【Tài liệu tham khảo kiến thức cấp độ kịch】\n${seriesCtx}\n` : ''}
【Kịch bảthông tin】
Tiêu đề phim truyền hình：${title}
tổng số tập：${totalEpisodes}đặt

【Tóm tắt】
${outline.slice(0, 1500)}

【nhân vật chính】
${characterBios.slice(0, 1000)}

【yêu cầu】
1. Tiêu đề nên tóm tắt nội dung chính hoặc bước ngoặt của tình tiết.
2. Độ dài tiêu đề nên được kiểm soát ở mức 6-15 từ.
3. Phong cách phải tuân theo Kịch bảnLoại（Ví dụ: phim truyền hình về chiến tranh kinh doanh sử dụng thuật ngữ chiến tranh kinh doanh，Phim võ thuật sử dụng không khí sông hồ）
4. Cần có sự mạch lạc giữa các chức danh，Phản ánh sự phát triển cốt truyện

Vui lòng sử dụng JSONĐịnh dạngQuay lại，Định dạng là：
{
  "titles": {
    "1": "Tiêu đề tập 1",
    "2": "Tiêu đề tập 2"
  }
}`;
        const episodeContents = batch.map(ep => 
          `Không.${ep.index}Đặt tóm tắt nội dung：${ep.contentSummary}`
        ).join('\n\n');
        const user = `Vui lòng cung cấp số tập sau TạoTiêu đề：\n\n${episodeContents}`;
        return { system, user };
      },
      parseResult: (raw) => {
        let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const result = new Map<string, string>();
        if (parsed.titles) {
          for (const [key, value] of Object.entries(parsed.titles)) {
            result.set(key, value as string);
          }
        }
        return result;
      },
      estimateItemOutputTokens: () => 30, // Tiêu đề ngắn，Khoảng 30 token mỗi tập
      onProgress: (completed, total, message) => {
        onProgress?.(completed, total, `[Hiệu chỉnh tiêu đề] ${message}`);
      },
    });
    
    // Xử lý kết quả
    let calibratedCount = 0;
    for (const ep of missingEpisodes) {
      const newTitle = results.get(String(ep.episodeIndex));
      if (newTitle) {
        store.updateEpisodeRawScript(projectId, ep.episodeIndex, {
          title: `Không.${ep.episodeIndex}đặt：${newTitle}`,
        });
        
        const scriptData = store.projects[projectId]?.scriptData;
        if (scriptData) {
          const epData = scriptData.episodes.find(e => e.index === ep.episodeIndex);
          if (epData) {
            epData.title = `Không.${ep.episodeIndex}đặt：${newTitle}`;
            store.setScriptData(projectId, { ...scriptData });
          }
        }
        
        calibratedCount++;
      }
    }
    
    if (failedBatches > 0) {
      console.warn(`[Đặt hiệu chỉnh tiêu đề] ${failedBatches}/${totalBatches} đợt thứất bại`);
    }
    
    onProgress?.(calibratedCount, totalMissing, `đã hiệu chuẩn ${calibratedCount}/${totalMissing} đặt`);
    
    return {
      success: true,
      calibratedCount,
      totalMissing,
    };
  } catch (error) {
    console.error('[calibrate] Error:', error);
    return {
      success: false,
      calibratedCount: 0,
      totalMissing,
      error: error instanceof Error ? error.message : 'Hiệu chỉnh Thất bại',
    };
  }
}

// ==================== AI Phân cảchức năng hiệu chỉnh nh ====================

export interface ShotCalibrationOptions {
  apiKey: string;
  provider: string;
  baseUrl?: string;
  model?: string;  // Tùy chọn chỉ định Mô hình
  styleId?: string;  // Phong cálogo ch，Ảnh hưởng đến visualPromptTạo
  cinematographyProfileId?: string;  // Nhiếp ảnh Phong cáID tập tin ch，Ảnh hưởng đến trường điều khiển chụp Mặc địgiá trị nh
  promptLanguage?: import('@/types/script').PromptLanguage;
}

export interface ShotCalibrationResult {
  success: boolean;
  calibratedCount: number;
  totalShots: number;
  error?: string;
}

/**
 * Theo Người dùNgôn ngữ nhắc nhở được chọn bởi ng，dọn dẹp/Giữ Phân cảnhTrường nhắc nhở，Tránh các trường cũ còn lại sau khi chuyển đổi ngôn ngữ
 */
function applyPromptLanguageToShotPrompts(
  existingShot: Shot,
  calibration: Record<string, any>,
  promptLanguage: PromptLanguage = 'zh+en',
): Pick<Shot, 'visualPrompt' | 'imagePrompt' | 'imagePromptZh' | 'videoPrompt' | 'videoPromptZh' | 'endFramePrompt' | 'endFramePromptZh'> {
  const nextVisualPrompt = calibration.visualPrompt || existingShot.visualPrompt;
  const nextImagePrompt = calibration.imagePrompt || existingShot.imagePrompt;
  const nextImagePromptZh = calibration.imagePromptZh || existingShot.imagePromptZh;
  const nextVideoPrompt = calibration.videoPrompt || existingShot.videoPrompt;
  const nextVideoPromptZh = calibration.videoPromptZh || existingShot.videoPromptZh;
  const nextEndFramePrompt = calibration.endFramePrompt || existingShot.endFramePrompt;
  const nextEndFramePromptZh = calibration.endFramePromptZh || existingShot.endFramePromptZh;

  if (promptLanguage === 'zh') {
    return {
      visualPrompt: undefined,
      imagePrompt: undefined,
      imagePromptZh: nextImagePromptZh,
      videoPrompt: undefined,
      videoPromptZh: nextVideoPromptZh,
      endFramePrompt: undefined,
      endFramePromptZh: nextEndFramePromptZh,
    };
  }

  if (promptLanguage === 'en') {
    return {
      visualPrompt: nextVisualPrompt,
      imagePrompt: nextImagePrompt,
      imagePromptZh: undefined,
      videoPrompt: nextVideoPrompt,
      videoPromptZh: undefined,
      endFramePrompt: nextEndFramePrompt,
      endFramePromptZh: undefined,
    };
  }

  return {
    visualPrompt: nextVisualPrompt,
    imagePrompt: nextImagePrompt,
    imagePromptZh: nextImagePromptZh,
    videoPrompt: nextVideoPrompt,
    videoPromptZh: nextVideoPromptZh,
    endFramePrompt: nextEndFramePrompt,
    endFramePromptZh: nextEndFramePromptZh,
  };
}

/**
 * AI hiệu chuẩn Phân cảnh：Tối ưu tiếng Trung Mô tả、TạoTiếng Anh trực quanPrompt、Tối ưu hóa Cảthiết kế bến cảng
 */
export async function calibrateEpisodeShots(
  episodeIndex: number,
  projectId: string,
  options: ShotCalibrationOptions,
  onProgress?: (current: number, total: number, message: string) => void,
  filterSceneId?: string,
): Promise<ShotCalibrationResult> {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project) {
    return { success: false, calibratedCount: 0, totalShots: 0, error: 'Dự án không tồn tại' };
  }
  
  // Tìm Ph của tập phimân cảnh
  const scriptData = project.scriptData;
  if (!scriptData) {
    return { success: false, calibratedCount: 0, totalShots: 0, error: 'Kịch bảndata không tồn tại' };
  }
  
  const episode = scriptData.episodes.find(ep => ep.index === episodeIndex);
  if (!episode) {
    return { success: false, calibratedCount: 0, totalShots: 0, error: `Không. không tìm thấy ${episodeIndex} đặt` };
  }
  
  // Lấy chữ T của tập phimất cảPhân cảnh（Tùy chọn：Hiệu chỉnh chỉ được chỉ định CảPh của nhân cảnh）
  let episodeShots = project.shots.filter(shot => shot.episodeId === episode.id);
  if (filterSceneId) {
    episodeShots = episodeShots.filter(shot => shot.sceneRefId === filterSceneId);
  }
  const totalShots = episodeShots.length;
  
  if (totalShots === 0) {
    return { success: false, calibratedCount: 0, totalShots: 0, error: 'Tập này không có Phân cảnh' };
  }
  
  onProgress?.(0, totalShots, `Bắt đầuHiệu chuẩn ${episodeIndex} đặt ${totalShots} Phân cảnh...`);
  
  // Nhận N toàn cầuềthông tin
  const background = project.projectBackground;
  const episodeScript = project.episodeRawScripts.find(ep => ep.episodeIndex === episodeIndex);
  
  // Trích xuất K ban đầu của tập hợpịch bảnNội dung（Đối thoại+Hành động）
  const episodeRawContent = episodeScript?.rawContent || '';
  
  // Xây dựng tóm tắt theo ngữ cảnh ở cấp độ kịch
  const seriesContextSummary = buildSeriesContextSummary(project.seriesMeta || null);
  
  const globalContext = {
    title: background?.title || project.scriptData?.title || 'Không tênKịch bản',
    genre: background?.genre || '',
    era: background?.era || '',
    outline: background?.outline || '',
    characterBios: background?.characterBios || '',
    worldSetting: background?.worldSetting || '',
    themes: background?.themes || [],
    episodeTitle: episode.title,
    episodeSynopsis: episodeScript?.synopsis || '',  // Sử dụng dàn ý tập
    episodeKeyEvents: episodeScript?.keyEvents || [],  // Phímự kiện
    episodeRawContent,  // Tập hợp K gốcịch bảnNội dung（đối thoại đầy đủ、Hành động mô tả）
    episodeSeason: episodeScript?.season,  // mùa của tập phim này
    totalEpisodes: project.episodeRawScripts.length,
    currentEpisode: episodeIndex,
    seriesContextSummary,  // bối cảnh kịch
  };
  
  // Xây dựng C thôảbản đồ thời tiết nh（C được phân tích từ thôảNhận thời tiết ở nh）
  const rawSceneWeatherMap = new Map<string, string>();
  if (episodeScript?.scenes) {
    for (const rawScene of episodeScript.scenes) {
      if (rawScene.weather) {
        // Sử dụng Cảtiêu đề nh làm khóa
        rawSceneWeatherMap.set(rawScene.sceneHeader, rawScene.weather);
      }
    }
  }
  
  try {
    // GetNgười dùngCài đặSố lượng đồng thời của t
    const concurrency = useAPIConfigStore.getState().concurrency || 1;
    const batchSize = 5; // Mỗi cuộc gọi AI xử lý 5 Phân cảnh
    let calibratedCount = 0;
    const updatedShots: Shot[] = [...project.shots];
    
    // Chuẩn bị cho T.ất cảnhiệm vụ hàng loạt
    const allBatches: { batch: Shot[]; batchNum: number; batchData: any[] }[] = [];
    for (let i = 0; i < episodeShots.length; i += batchSize) {
      const batch = episodeShots.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      // Chuẩn bị dữ liệu hàng loạt
      const batchData = batch.map(shot => {
        const scene = scriptData.scenes.find(s => s.id === shot.sceneRefId);
        let sourceText = shot.actionSummary || '';
        if (shot.dialogue) {
          sourceText += `\đối thoại：「${shot.dialogue}」`;
        }
        // Hãy cố gắng tìm C.ảThời tiết tương ứng với nh
        let sceneWeather = '';
        for (const [header, weather] of rawSceneWeatherMap) {
          if (scene?.location && header.includes(scene.location.replace(/\s+/g, ''))) {
            sceneWeather = weather;
            break;
          }
        }
        return {
          shotId: shot.id,
          sourceText,
          actionSummary: shot.actionSummary,
          dialogue: shot.dialogue,
          characterNames: shot.characterNames,
          sceneLocation: scene?.location || '',
          sceneAtmosphere: scene?.atmosphere || '',
          sceneTime: scene?.time || 'day',
          sceneWeather,
          architectureStyle: scene?.architectureStyle || '',
          colorPalette: scene?.colorPalette || '',
          eraDetails: scene?.eraDetails || '',
          lightingDesign: scene?.lightingDesign || '',
          currentShotSize: shot.shotSize,
          currentCameraMovement: shot.cameraMovement,
          currentDuration: shot.duration,
        };
      });
      
      allBatches.push({ batch, batchNum, batchData });
    }
    
    const totalBatches = allBatches.length;
    console.log(`🚀 [calibrateShots] Chờ xử lý: ${totalShots} Phân cảnh，${totalBatches} lô，Số lượng đồng thời: ${concurrency}`);
    
    // Kiểm soát đồng thời cho các lần khởi động so le：Bắt đầu một đợt mới cứ sau 5 giây，Nhiều nhất là đồng thời cùng một lúc
    let completedBatches = 0;
    const settledBatchResults = await runStaggered(
      allBatches.map(({ batch, batchNum, batchData }) => async () => {
        console.log(`[calibrateShots] 🚀 Bắt đầu đợt ${batchNum}/${totalBatches}`);
        onProgress?.(calibratedCount, totalShots, `🚀 xử lý hàng loạt ${batchNum}/${totalBatches}...`);
        
        // Với Thử lạCuộc gọi AI của cơ chế i
        let calibrations: Record<string, any> = {};
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            calibrations = await calibrateShotsMultiStage(
              batchData,
              { styleId: options.styleId, cinematographyProfileId: options.cinematographyProfileId, promptLanguage: options.promptLanguage },
              globalContext,
              (stage, total, name) => {
                console.log(`[calibrateShots] lô ${batchNum}/${totalBatches} - Stage ${stage}/${total}: ${name}`);
                onProgress?.(calibratedCount, totalShots, `lô ${batchNum} Stage ${stage}/${total}: ${name}`);
              }
            );
            completedBatches++;
            console.log(`[calibrateShots] ✅ lô ${batchNum} Hoàn thành，Tiến độ: ${completedBatches}/${totalBatches}`);
            return { batch, calibrations, success: true as const };
          } catch (err) {
            retryCount++;
            console.warn(`[calibrateShots] lô ${batchNum} Thất bại，Thử lại ${retryCount}/${maxRetries}:`, err);
            if (retryCount >= maxRetries) {
              console.error(`[calibrateShots] lô ${batchNum} Đạt mức tối đa Thử lạtôi lần，bỏ qua`);
              completedBatches++;
              return { batch, calibrations: {} as Record<string, any>, success: false as const };
            }
            await new Promise(r => setTimeout(r, 2000 * retryCount));
          }
        }
        completedBatches++;
        return { batch, calibrations, success: false as const };
      }),
      concurrency,
      5000
    );
    const results = settledBatchResults
      .filter((r): r is { status: 'fulfilled'; value: any } => r.status === 'fulfilled')
      .map(r => r.value);
    
    // Xử lý kết quả
    for (const { batch, calibrations, success } of results) {
      if (success) {
        for (const shot of batch) {
          const calibration = calibrations[shot.id];
          if (calibration) {
            const shotIndex = updatedShots.findIndex(s => s.id === shot.id);
            if (shotIndex !== -1) {
              updatedShots[shotIndex] = {
                ...updatedShots[shotIndex],
                visualDescription: calibration.visualDescription || updatedShots[shotIndex].visualDescription,
                shotSize: calibration.shotSize || updatedShots[shotIndex].shotSize,
                cameraMovement: calibration.cameraMovement || updatedShots[shotIndex].cameraMovement,
                duration: calibration.duration || updatedShots[shotIndex].duration,
                emotionTags: calibration.emotionTags || updatedShots[shotIndex].emotionTags,
                characterNames: calibration.characterNames?.length > 0 
                  ? calibration.characterNames 
                  : updatedShots[shotIndex].characterNames,
                ambientSound: calibration.ambientSound || updatedShots[shotIndex].ambientSound,
                soundEffect: calibration.soundEffect || updatedShots[shotIndex].soundEffect,
                ...applyPromptLanguageToShotPrompts(
                  updatedShots[shotIndex],
                  calibration,
                  options.promptLanguage || 'zh+en',
                ),
                needsEndFrame: calibration.needsEndFrame ?? updatedShots[shotIndex].needsEndFrame,
                narrativeFunction: calibration.narrativeFunction || updatedShots[shotIndex].narrativeFunction,
                conflictStage: calibration.conflictStage || updatedShots[shotIndex].conflictStage,
                shotPurpose: calibration.shotPurpose || updatedShots[shotIndex].shotPurpose,
                storyAlignment: calibration.storyAlignment || updatedShots[shotIndex].storyAlignment,
                visualFocus: calibration.visualFocus || updatedShots[shotIndex].visualFocus,
                cameraPosition: calibration.cameraPosition || updatedShots[shotIndex].cameraPosition,
                characterBlocking: calibration.characterBlocking || updatedShots[shotIndex].characterBlocking,
                rhythm: calibration.rhythm || updatedShots[shotIndex].rhythm,
                // Trường điều khiển bắn súng
                lightingStyle: calibration.lightingStyle || updatedShots[shotIndex].lightingStyle,
                lightingDirection: calibration.lightingDirection || updatedShots[shotIndex].lightingDirection,
                colorTemperature: calibration.colorTemperature || updatedShots[shotIndex].colorTemperature,
                lightingNotes: calibration.lightingNotes || updatedShots[shotIndex].lightingNotes,
                depthOfField: calibration.depthOfField || updatedShots[shotIndex].depthOfField,
                focusTarget: calibration.focusTarget || updatedShots[shotIndex].focusTarget,
                focusTransition: calibration.focusTransition || updatedShots[shotIndex].focusTransition,
                cameraRig: calibration.cameraRig || updatedShots[shotIndex].cameraRig,
                movementSpeed: calibration.movementSpeed || updatedShots[shotIndex].movementSpeed,
                atmosphericEffects: calibration.atmosphericEffects || updatedShots[shotIndex].atmosphericEffects,
                effectIntensity: calibration.effectIntensity || updatedShots[shotIndex].effectIntensity,
                playbackSpeed: calibration.playbackSpeed || updatedShots[shotIndex].playbackSpeed,
                cameraAngle: calibration.cameraAngle || updatedShots[shotIndex].cameraAngle,
                focalLength: calibration.focalLength || updatedShots[shotIndex].focalLength,
                photographyTechnique: calibration.photographyTechnique || updatedShots[shotIndex].photographyTechnique,
                specialTechnique: calibration.specialTechnique || updatedShots[shotIndex].specialTechnique,
              };
              calibratedCount++;
            }
          }
        }
      }
    }
    
    onProgress?.(calibratedCount, totalShots, `đã hiệu chuẩn ${calibratedCount}/${totalShots} Phân cảnh`);
    
    // LưuCập nhậPh sau tân cảnh
    store.setShots(projectId, updatedShots);
    
    return {
      success: true,
      calibratedCount,
      totalShots,
    };
  } catch (error) {
    console.error('[calibrateShots] Error:', error);
    return {
      success: false,
      calibratedCount: 0,
      totalShots,
      error: error instanceof Error ? error.message : 'Phân cảnh hiệu chuẩn Thất bại',
    };
  }
}

/**
 * AI hiệu chỉnh một Ph duy nhấtân cảnh：cho trailer Tab nhấp vào đơn Phân cảnh để hiệu chuẩn
 */
export async function calibrateSingleShot(
  shotId: string,
  projectId: string,
  options: ShotCalibrationOptions,
  onProgress?: (message: string) => void
): Promise<ShotCalibrationResult> {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project) {
    return { success: false, calibratedCount: 0, totalShots: 1, error: 'Dự án không tồn tại' };
  }
  
  const scriptData = project.scriptData;
  if (!scriptData) {
    return { success: false, calibratedCount: 0, totalShots: 1, error: 'Kịch bảndata không tồn tại' };
  }
  
  // tìm thấyĐíchPhân cảnh
  const shot = project.shots.find(s => s.id === shotId);
  if (!shot) {
    return { success: false, calibratedCount: 0, totalShots: 1, error: `Không thể tìm thấy Ph.ân cảnh ${shotId}` };
  }
  
  onProgress?.(`Hiệu chỉnh độ Phân cảnh...`);
  
  // Nhận Phân cảC mà nh thuộc vềảnh và thiết lập thông tin
  const scene = scriptData.scenes.find(s => s.id === shot.sceneRefId);
  const episode = scriptData.episodes.find(ep => ep.id === shot.episodeId);
  const episodeIndex = episode?.index || 1;
  
  // Nhận N toàn cầuềthông tin
  const background = project.projectBackground;
  const episodeScript = project.episodeRawScripts.find(ep => ep.episodeIndex === episodeIndex);
  const episodeRawContent = episodeScript?.rawContent || '';
  
  const globalContext = {
    title: background?.title || scriptData?.title || 'Không tênKịch bản',
    genre: background?.genre || '',
    era: background?.era || '',
    outline: background?.outline || '',
    characterBios: background?.characterBios || '',
    worldSetting: background?.worldSetting || '',
    themes: background?.themes || [],
    episodeTitle: episode?.title || `Không.${episodeIndex}đặt`,
    episodeSynopsis: episodeScript?.synopsis || '',
    episodeKeyEvents: episodeScript?.keyEvents || [],
    episodeRawContent,
    episodeSeason: episodeScript?.season,
    totalEpisodes: project.episodeRawScripts.length,
    currentEpisode: episodeIndex,
  };
  
  try {
    // Chuẩn bị cho bằng tiến sĩân cảnh dữ liệu
    let sourceText = shot.actionSummary || '';
    if (shot.dialogue) {
      sourceText += `\đối thoại：「${shot.dialogue}」`;
    }
    
    // Tìm Cảnh thời tiết
    let sceneWeather = '';
    if (episodeScript?.scenes) {
      for (const rawScene of episodeScript.scenes) {
        if (rawScene.weather && scene?.location && rawScene.sceneHeader.includes(scene.location.replace(/\s+/g, ''))) {
          sceneWeather = rawScene.weather;
          break;
        }
      }
    }
    
    const shotData = [{
      shotId: shot.id,
      sourceText,
      actionSummary: shot.actionSummary || '',
      dialogue: shot.dialogue,
      characterNames: shot.characterNames,
      sceneLocation: scene?.location || '',
      sceneAtmosphere: scene?.atmosphere || '',
      sceneTime: scene?.time || 'day',
      sceneWeather,
      // Cảlĩnh vực thiết kế nghệ thuật nh（từ AICảnh thu thập hiệu chuẩn）
      architectureStyle: scene?.architectureStyle || '',
      colorPalette: scene?.colorPalette || '',
      eraDetails: scene?.eraDetails || '',
      lightingDesign: scene?.lightingDesign || '',
      currentShotSize: shot.shotSize,
      currentCameraMovement: shot.cameraMovement,
      currentDuration: shot.duration,
    }];
    
    // Gọi hiệu chỉnh AI
    const calibrations = await callAIForShotCalibration(shotData, options, globalContext);
    const calibration = calibrations[shot.id];
    
    if (!calibration) {
      return { success: false, calibratedCount: 0, totalShots: 1, error: 'AI Calibration Không Quay lạkết quả của tôi' };
    }
    
    // Cập nhậtPhân cảnh
    const updatedShots = project.shots.map(s => {
      if (s.id !== shot.id) return s;
      return {
        ...s,
        visualDescription: calibration.visualDescription || s.visualDescription,
        shotSize: calibration.shotSize || s.shotSize,
        cameraMovement: calibration.cameraMovement || s.cameraMovement,
        duration: calibration.duration || s.duration,
        emotionTags: calibration.emotionTags || s.emotionTags,
        characterNames: calibration.characterNames?.length > 0 ? calibration.characterNames : s.characterNames,
        ambientSound: calibration.ambientSound || s.ambientSound,
        soundEffect: calibration.soundEffect || s.soundEffect,
        // Ba lớp NhắcHệ thống（Làm sạch các trường cũ bằng ngôn ngữ nhắc nhở）
        ...applyPromptLanguageToShotPrompts(
          s,
          calibration,
          options.promptLanguage || 'zh+en',
        ),
        needsEndFrame: calibration.needsEndFrame ?? s.needsEndFrame,
        // lĩnh vực dẫn dắt câu chuyện
        narrativeFunction: calibration.narrativeFunction || s.narrativeFunction,
        conflictStage: calibration.conflictStage || s.conflictStage,
        shotPurpose: calibration.shotPurpose || s.shotPurpose,
        storyAlignment: calibration.storyAlignment || s.storyAlignment,
        visualFocus: calibration.visualFocus || s.visualFocus,
        cameraPosition: calibration.cameraPosition || s.cameraPosition,
        characterBlocking: calibration.characterBlocking || s.characterBlocking,
        rhythm: calibration.rhythm || s.rhythm,
        // Trường điều khiển bắn súng
        lightingStyle: calibration.lightingStyle || s.lightingStyle,
        lightingDirection: calibration.lightingDirection || s.lightingDirection,
        colorTemperature: calibration.colorTemperature || s.colorTemperature,
        lightingNotes: calibration.lightingNotes || s.lightingNotes,
        depthOfField: calibration.depthOfField || s.depthOfField,
        focusTarget: calibration.focusTarget || s.focusTarget,
        focusTransition: calibration.focusTransition || s.focusTransition,
        cameraRig: calibration.cameraRig || s.cameraRig,
        movementSpeed: calibration.movementSpeed || s.movementSpeed,
        atmosphericEffects: calibration.atmosphericEffects || s.atmosphericEffects,
        effectIntensity: calibration.effectIntensity || s.effectIntensity,
        playbackSpeed: calibration.playbackSpeed || s.playbackSpeed,
        cameraAngle: calibration.cameraAngle || s.cameraAngle,
        focalLength: calibration.focalLength || s.focalLength,
        photographyTechnique: calibration.photographyTechnique || s.photographyTechnique,
        specialTechnique: calibration.specialTechnique || s.specialTechnique,
      } as Shot;
    });
    
    store.setShots(projectId, updatedShots);
    onProgress?.(`Phân cảnh hiệu chuẩn đã hoàn tất`);
    
    return {
      success: true,
      calibratedCount: 1,
      totalShots: 1,
    };
  } catch (error) {
    console.error('[calibrateSingleShot] Error:', error);
    return {
      success: false,
      calibratedCount: 0,
      totalShots: 1,
      error: error instanceof Error ? error.message : 'Tiến sĩ đơnân cảnh hiệu chuẩn Thất bại',
    };
  }
}

/**
 * Gọi API AI để hiệu chỉnh Phân cảnh - Tái sử dụng callChatAPI
 */
async function callAIForShotCalibration(
  shots: Array<{
    shotId: string;
    sourceText: string;        // K gốcịch bảđoạn văn bản（Phân cảVăn bản gốc tương ứng với nh）
    actionSummary: string;
    dialogue?: string;
    characterNames?: string[];
    sceneLocation: string;
    sceneAtmosphere: string;
    sceneTime: string;
    sceneWeather?: string;        // thời tiết（mưa/tuyết/Sương mù vv.）
    // Cảlĩnh vực thiết kế nghệ thuật nh（với tên trường ScriptScene Căn chỉnh）
    architectureStyle?: string;   // Kiến trúcPhong cách
    colorPalette?: string;        // Màu sắgiai điệu c
    eraDetails?: string;          // Đặc điểm của thời đại
    lightingDesign?: string;      // Ánh sáthiết kế
    currentShotSize?: string;
    currentCameraMovement?: string;
    currentDuration?: number;
  }>,
  options: ShotCalibrationOptions,
  globalContext: {
    title: string;
    genre?: string;
    era?: string;
    outline: string;
    characterBios: string;
    worldSetting?: string;
    themes?: string[];
    episodeTitle: string;
    episodeSynopsis?: string;  // Tóm tắt tập phim
    episodeKeyEvents?: string[];  // Phímự kiện
    episodeRawContent?: string;  // Tập hợp K gốcịch bảnNội dung
    episodeSeason?: string;      // mùa của tập phim này
    totalEpisodes?: number;
    currentEpisode?: number;
  }
): Promise<Record<string, {
  visualDescription: string;
  visualPrompt: string;
  // Ba lớp NhắcHệ thống
  imagePrompt: string;      // Lời nhắc khung đầu tiên（tĩnhMô tả）
  imagePromptZh: string;    // Khung đầu tiên Nhắc tiếng Trung
  videoPrompt: string;      // VideoPrompt（Động Hành động）
  videoPromptZh: string;    // VideoNhắcTrung Quốc
  endFramePrompt: string;   // Lời nhắc khung cuối cùng（tĩnhMô tả）
  endFramePromptZh: string; // Khung cuối cùng Lời nhắc tiếng Trung
  needsEndFrame: boolean;   // Liệu khung hình cuối cùng có cần thiết hay không
  shotSize: string;
  cameraMovement: string;
  duration: number;         // Thời lượng（giây）
  emotionTags: string[];    // Thẻ cảm xúc
  characterNames: string[]; // Hoàn thànhNhân vậdanh sách t
  ambientSound: string;     // âm thanh xung quanh
  soundEffect: string;      // Hiệu ứng âm thanh
  // === lĩnh vực dẫn dắt câu chuyện（Dựa trên《Ngữ pháp ngôn ngữ điện ảnh》） ===
  narrativeFunction: string;  // chức năng tường thuật：điềm báo/Nâng cấp/đỉnh điểm/bước ngoặt/Chuyển tiếp/Lời kết
  conflictStage?: string;     // giai đoạn xung đột
  shotPurpose: string;        // Cảnh quay mục đích：Tại sao lại dùng C nàyảnh quay
  storyAlignment?: string;    // Sự nhất quán với câu chuyện tổng thể
  visualFocus: string;        // tập trung thị giác：Người xem nên xem gì
  cameraPosition: string;     // Góc máyMô tả
  characterBlocking: string;  // Bố cục nhân vật
  rhythm: string;             // Nhịp điệu Mô tả
  // === Trường điều khiển bắn súng ===
  lightingStyle?: string;
  lightingDirection?: string;
  colorTemperature?: string;
  lightingNotes?: string;
  depthOfField?: string;
  focusTarget?: string;
  focusTransition?: string;
  cameraRig?: string;
  movementSpeed?: string;
  atmosphericEffects?: string[];
  effectIntensity?: string;
  playbackSpeed?: string;
  cameraAngle?: string;
  focalLength?: string;
  photographyTechnique?: string;
  specialTechnique?: string;
}>> {
  // apiKey không còn cần thiết nữa/provider/baseUrl，Thu được từ bản đồ dịch vụ một cách thống nhất
  const { styleId, cinematographyProfileId } = options;
  const { 
    title, genre, era, outline, characterBios, worldSetting, themes,
    episodeTitle, episodeSynopsis, episodeKeyEvents, episodeRawContent,
    episodeSeason, totalEpisodes, currentEpisode 
  } = globalContext;
  
  // Chặn gốc Kịch bảnNội dung（tránh quá lâu，Lấy 3000 từ đầu tiên）
  const rawContentPreview = episodeRawContent ? episodeRawContent.slice(0, 3000) : '';
  
  // Sử dụng Phong c chia sẻáchMô tảchức năng
  const styleDesc = getStyleDescription(styleId || 'cinematic');
  
  // Nhiếp ảnh Phong cávăn bản hướng dẫn tập tin ch
  const cinematographyGuidance = cinematographyProfileId
    ? buildCinematographyGuidance(cinematographyProfileId)
    : '';
  
  // Xây dựng thông tin theo ngữ cảnh đầy đủ hơn
  const contextInfo = [
    `Tiêu đề phim truyền hình：《${title}》`,
    genre ? `Loại：${genre}` : '',
    era ? `Thời đại Nền：${era}` : '',
    totalEpisodes ? `tổng số tập：${totalEpisodes}đặt` : '',
    `hiện tại：Không.${currentEpisode}đặt「${episodeTitle}」`,
    episodeSeason ? `mùa：${episodeSeason}` : '',
  ].filter(Boolean).join(' | ');
  
  const systemPrompt = `Bạn là nhà quay phim hàng đầu thế giới，Sự làm chủ của Danielle·Alihun《Ngữ pháp ngôn ngữ điện ảnh》Tất cảlý thuyết，Trải nghiệm quay phim đoạt giải Oscar。

triết lý cốt lõi của bạn：**Cảnh quay không phải là một bức tranh biệt lập，Đó là một mắt xích trong chuỗi câu chuyện。Mọi CảC của nh quayỡ cảnh、các môn thể thao、Thời lượng phải phục vụ cho câu chuyện。**

khả năng chuyên môn của bạn：
- Thành thạo Cảnh quayngôn ngữ：Có thể phán đoán chính xác từng CảC của nh quayỡ cảnh、Phong cách chuyển động、thiết kế ánh sáng
- **thiết kế theo hướng tường thuật**：Hiểu mọi Cảnh quay V trong truyện full tậpị trívà chức năng，Đảm bảo C.ảnh quay thiết kế phục vụ tường thuật
- mise-en-scène：Sử dụng nguyên lý tam giác、Sử dụng các kỹ thuật như quay ngược bên trong và bên ngoài để xử lý các cảnh đối thoại
- Chụp chuyển đ���ng：Có thể phán đoán chính xác CảBắt đầu Tr của nh quayạng thátôi và Kết thúcTrạng tháCó sự khác biệt đáng kể trong tôi
- AIVideoTạoKinh nghiệm：Hiểu về hạt giống、Sora、Runway và cộng sự AI VideoMô hìNH hoạt động như thế nào?

Nhiệm vụ của bạn là đi theo Kịch bảnglobalNền và phân cảnh thông tin，cho mỗi tiến sĩân cảnhTạoHình ảnh chuyên nghiệp Mô tảvà ba lớp lời nhắc。

【Kịch bảthông tin】
${contextInfo}
${episodeSynopsis ? `
Tóm tắt tập phim：${episodeSynopsis}` : ''}
${episodeKeyEvents && episodeKeyEvents.length > 0 ? `
Phímự kiện：${episodeKeyEvents.join('、')}` : ''}
${worldSetting ? `
thế giới quan：${worldSetting.slice(0, 200)}` : ''}
${themes && themes.length > 0 ? `
chủ đề：${themes.join('、')}` : ''}
${outline ? `
TruyệnNền：${outline.slice(0, 400)}` : ''}
${characterBios ? `
nhân vật chính：${characterBios.slice(0, 400)}` : ''}

【⚠️ Nguyên tắc cốt lõi - phải được tuân thủ nghiêm ngặt】

1. **CảQuyền sở hữu NH là hoàn toàn cố định**（quan trọng nhất！）：
   - Mỗi tiến sĩân cảnh có một【Chính Cảnh】（Được chỉ định bởi trường sceneLocation），Đây là**tuyệt đối không thể thay đổi**
   - Ngay cả Phân cảnhMô tảCác chữ C khác được đề cập trongảnh（như hồi tưởng、sơn phủ、cảnh ký ức、xen kẽ với Cảnh quay），**Chính Cảnh vẫn là cảnhLocation**
   - Hồi tưởng/Sơn lớp phủ là「C chính hiện tạiảkỹ thuật biểu đạt hình ảnh trong nh」，Không phải Cảnh chuyển đổi
   - Bạn T.ạo's Tất cảMô tả（visualDescription、imagePrompt, v.v.）Tất cả đều phải**Chính Cảnh là Nền**
   - Nếu văn bản gốc có chứa đoạn hồi tưởng/Nội dung lớp phủ，sử dụng「lớp phủ màn hình」「hình ảnh trong hình ảnh」「nhớ lại chủ quan」Bằng nhau Mô tả，thay vì Mô tảvào một C khácảnh
   - Ví dụ：Chính Cảnh là"Phòng khách của Trương"，Bài viết gốc đã đề cập"Hồi tưởng lại phòng bi-a"，Có nên Mô tảcho"Trong phòng khách của Zhang，Ký ức về phòng bi-a hiện lên trên màn ảnh."

2. **Căn cứ chặt chẽ vào văn bản gốc**：Mỗi tiến sĩân cảnh đi kèm với nó【K gốcịch bảvăn bản】，T của bạnất cảTạoNội dung phải dựa hoàn toàn vào văn bản gốc：
   - Tầm nhìn Mô tảPhải chứa chữ T được đề cập trong văn bản gốcất cảyếu tố then chốt（nhân vật、Hành động、đạo cụ、Cảnh）
   - Không Th.êmNội dung không tìm thấy trong văn bản gốc
   - Không trộn lẫn với Ph khácân cảnh nội dung
   - Không bỏ sót thông tin quan trọng trong văn bản gốc

3. **Nhân vậtNhận dạng đầy đủ**：Ngoại hình Nhân vật phải xuất phát hoàn toàn từ văn bản gốc，Danh sách theo thứ tự xuất hiện
   - Ví dụ：Văn bản gốc"Trương Minh đang ăn cơm cùng bố mẹ" → characterNames: ["Trương Minh", "bố của Trương", "Trương Mộ"]
   - Nghiêm cấm thiếu sót Nhân vật，Cấm thêm Nh mà không có trong văn bản gốc.ân vật

3. **Tách tiếng Trung và tiếng Anh**：
   - **lĩnh vực Trung Quốc**（visualDescription, ambientSound, soundEffect, imagePromptZh, videoPromptZh, endFramePromptZh）：Phải là người Trung Quốc thuần túy
   - **lĩnh vực tiếng anh**（visualPrompt, imagePrompt, videoPrompt, endFramePrompt）：Phải là 100%Tiếng Anh thuần túy，Tuyệt đối cấm bao gồm bất kỳ ký tự Trung Quốc nào
   - Nếu bạn không chắc chắn về cách dịch một từ，bằng tiếng Anh Mô tảhoặc từ đồng nghĩa thay vì，Nhưng bạn không bao giờ có thể rời khỏi tiếng Trung

4. **Thời lượước tính**：Theo H.ành độước tính độ phức tạp và độ dài đoạn hội thoại để có Ph hợp lýân cảnhThời lượng（giây）
   - H nguyên chấtành độkhông có đối thoại：3-5 giây
   - đoạn hội thoại ngắn：4-6 giây
   - hội thoại dài hơn：6-10 giây
   - Phức hợp Hành độtrình tự ng：5-8 giây

5. **Âthiết kế m thanh**（Phải bằng tiếng Trung）：Xác định vàĐầu ra：
   - ambientSound（âm thanh xung quanh）：Chẳng hạn như"Tiếng chim hót ngoài cửa sổ"、"Tiếng ồn nhà hàng"、"Âm thanh của gió"
   - soundEffect（Hiệu ứng âm thanh）：Chẳng hạn như"Tiếng kính vỡ"、"bước chân"、"cửaĐóâm thanh"

【Nhiệm vụ】
cho mỗi tiến sĩân cảnhTạo：

**Cơ bảnfield：**
1. Tầm nhìn M của Trung Quốcô tả (Mô tả trực quan): chi tiết、Giống như hình ảnh**Tiếng Trung thuần túy**Mô tả，Phải chứa văn bản gốc Tất cảyếu tố then chốt（môi trường、nhân vật、Hành động、đạo cụ）
2. Tiếng Anh Visual Mô tả (visualPrompt): dùng để vẽ AI**Tiếng Anh thuần túy**Mô tả，Trong vòng 40 từ
3. Cỡ cảnh (shotSize): ECU/CU/MCU/MS/MLS/LS/WS/FS
4. Cảnh quay chuyển động (máy ảnhMovement): không có/static/tracking/orbit/zoom-in/zoom-out/pan-left/pan-right/tilt-up/tilt-down/dolly-in/dolly-out/truck-left/truck-right/crane-up/crane-down/drone-aerial/360-roll
4b. Kỹ thuật đặc biệt: không có/hitchcock-zoom/timelapse/crash-zoom-in/crash-zoom-out/whip-pan/bullet-time/fpv-shuttle/macro-closeup/first-person/slow-motion/probe-lens/spinning-tilt
5. Thời lượng (thời lượng): giây，số nguyên
6. Thẻ cảm xúc (emotionTags): 1-3 ID thẻ cảm xúc
7. Ngoại hìnhNhân vật(characterNames): hoàn thành Nhân vậdanh sách t，Từ văn bản gốc
8. Âm thanh xung quanh: **Tiếng Trung**，Theo C.ảnh suy luận
9. Hiệu ứng âm thanh: **Tiếng Trung**，Theo H.ành độsuy luận

**lĩnh vực dẫn dắt câu chuyện（quan trọng！Phải dựa vào dàn ý của tập này Phân tích）：**
10. Chức năng tường thuật: báo trước/Nâng cấp/đỉnh điểm/bước ngoặt/Chuyển tiếp/Lời kết
11. Cảnh quay mục đích (shotPurpose): Tại sao lại dùng C nàyảnh quay？Gi trong một câuải thích
12. Tiêu điểm thị giác: Khán giả nên nhìn theo thứ tự nào?？Được biểu thị bằng mũi tên
13. Góc máyMô tả (CameraPosition): V của camera so với nhân vậtị trí
14. Bố cục ký tự (characterBlocking): V ký tự trong màn hìnhị trímối quan hệ
15. Nhịp điệu Mô tả (nhịp): C nàyảNhịp điệu nh quay

**Trường điều khiển bắn súng（Cinematography Controls）：**
16. Chiếu sáng Phong cách (lightingStyle): natural/high-key/low-key/silhouette/chiaroscuro/neon
17. Hướng chiếu sáng: phía trước/side/back/top/bottom/rim
18. Nhiệt độ màu (colorTemperature): warm-3200K/neutral-5600K/cool-7500K/mixed/golden-hour/blue-hour
19. Ánh sángGhi chú: Văn bản tự do，Tiếng Trung，Thêm chi tiết ánh sáng
20. deepOfField: nông/medium/deep/split-diopter
21. Tập trungĐích (focusTarget): văn bản tự do，Tiếng Trung，Mô tảTập trung vào chủ đề
22. focusTransition: không có/rack-focus/pull-focus/follow-focus
23. Thiết bị chụp ảnh (máy ảnhRig): chân máy/handheld/steadicam/dolly/crane/drone/gimbal/shoulder
24. Tốc độ di chuyển (movementSpeed): tĩnh/slow/normal/fast/whip
25. Hiệu ứng khí quyển: mảng，Có thể có nhiều lựa chọn，Chẳng hạn như ["sương mù","bồ hóng"] Chờ thời tiết/môi trường/hiệu ứng nghệ thuật
26. Cường độ hiệu ứng: tinh tế/moderate/heavy
27. Phátốc độ t (tốc độ phát lại): chậm-0,25x/slow-0.5x/normal/fast-1.5x/fast-2x/timelapse
28. CameraAngle: ngang tầm mắt/low-angle/high-angle/birds-eye/worms-eye/dutch-angle/over-shoulder/pov/aerial
29. Cảnh quay tiêu cự (tiêu cự): 14mm/18mm/24mm/28mm/35mm/50mm/85mm/100mm-macro/135mm/200mm
30. Kỹ thuật chụp ảnh: phơi sáng lâu/double-exposure/high-speed/timelapse-photo/tilt-shift/silhouette/reflection/bokeh（Để trống nếu không yêu cầu kỹ thuật đặc biệt）

【Ba lớp NhắcHệ thống - quan trọng】

【16. Lời nhắc khung đầu tiên (imagePrompt/imagePromptZh): dành cho hình ảnh AI Tạo，Mô tảHình ảnh tĩnh hoàn chỉnh của khung hình đầu tiên của Video
    **Phải chứa T sauất cảphần tử**（không thể thiếu）：
    
    a) **Cảmôi trường**：
       -Vị tríại（nhà hàng gia đình/văn phòng/đường phố vv.）
       - Chi tiết môi trường（Khung cảnh bên ngoài cửa sổ、nội thất bên trong、bố trí đạo cụ）
       - Thờtôi gian bầu không khí（Ban ngày/buổi tối/Ban đêm、cảm giác về mùa）
    
    b) **thiết kế ánh sáng**：
       - Nguồn sáng Lôại（ánh sáng tự nhiên/đèn/ánh sáng hỗn hợp）
       - Kết cấu nhẹ（Mềm mại/Khó khăn/khuếch tán）
       - Ánh sábầu không khí（ấm áp/lạnh Tông màu/chiaroscuro）
    
    c) **Nhân vật Mô tả**（Mỗi ký tự nên được viết）：
       - Nhóm tuổi（tuổi trẻ/tuổi trung niên/tuổi già）
       - Tổng quan về quần áo（mặc giản dị/trang phục chính thức/Quần áo làm việc, vv）
       - Biểu cảthái độ của tôi（lo lắng/nghiêm túc/mỉm cười/lo lắng）
       - Tư thế Hành động（ngồi/đứng/nghiêng người/đồ vật cầm tay）
    
    d) **Thành phần và Cỡ cảnh**：
       - Cỡ cảnhMô tả（Trung cảnh ba người vào ảnh/Cận cảnh nửa cơ thể/Đặc tảđối mặt）
       - Nhân vật Vị trímối quan hệ（Bố cục bên trái ở giữa bên phải、bối cảnh）
       - tập trung thị giác（Chủ thể trong bức ảnh ở đâu?）
    
    e) **đạo cụ quan trọng**：
       - Đạo cụ cốt truyện chính（Giấy chứng nhận、Mặt hàng、thực phẩm vv）
       - Đạo cụ Trạng thái（cầm tay/địa điểm/hiển thị）
    
    f) **Màn hình Phong cách**：
       - Cảm giác điện ảnh/Realistic Phong cách/Kết cấu ảnh câu chuyện
       - Tông màuXu hướng（ấm áp/cool color/tự nhiên）
    
    - imagePromptZh: tiếng Trung thuần túy，60-100 từ，Chứa chữ T ở trênất cảphần tử
    - imagePrompt: tiếng Anh thuần túy，60-80 từ，Bản dịch hoàn chỉnh tương ứng với nội dung tiếng Trung，Phù hợp với hình ảnh AI Mô hình

11. VideoPrompt (videoPrompt/videoPromptZh): Mô tảNội dung động trong Video
    - **Cần nhấn mạnh rằng H.ành động**（Chẳng hạn như"Xem đi xem lại"、"ăn lo lắng"động từ v.v.）
    - Màn hình Hành động（Nhân vật Hành động、vật chuyển động）
    - Cảnh quay sports Mô tả
    - Đối thoại Gợi ý（Nếu có）
    - videoPromptZh: tiếng Trung thuần túy
    - videoPrompt: tiếng Anh thuần túy

【18. Nhắc khung kết thúc (endFramePrompt/endFramePromptZh): dùng cho ảnh AI Tạo，Mô tảHình ảnh tĩnh hoàn chỉnh của khung hình cuối cùng của Video
    
    **Quan trọng như khung hình đầu tiên！Phải chứa T sauất cảphần tử**（không thể thiếu）：
    
    a) **Cảmôi trường**：Giữ C nhất quán với khung đầu tiênảnh，Nhưng phản ánh sự thay đổi của Trạng thái
    
    b) **thiết kế ánh sáng**：Giữ nguyên khung hình đầu tiên（Trừ khi cốt truyện có Thờtôi đang thay đổi）
    
    c) **Nhân vật Mô tả**（tiêu điểm！Mô tảHành độngTr sau khi hoàn thànhạng thái）：
       - Bao gồm cả tuổi、quần áo
       - **Bi mớiểu cảthái độ của tôi**（Hành động cảm xúc sau khi hoàn thành）
       - **Tư thế mới Vị trí**（Hành độV sau khi ng hoàn thànhị trí）
       - TR mới cho đạo cụạng thái
    
    d) **Thành phần và Cỡ cảnh**：
       - Nếu có C.ảnh quay thể thao，Mô tảThể thao Kết thúC mới sau cỡ cảnh
       - Nhân vật V mớiị trímối quan hệ
    
    e) **Thay đổi độ tương phản**（cốt lõi！）：
       - Xóa Mô tảSự khác biệt so với khung hình đầu tiên（Vị trí/Hành động/Biểu cảm/Đạo cụTrạng thái）
    
    f) **Màn hình Phong cách**：Giữ nguyên khung hình đầu tiên
    
    - endFramePromptZh: tiếng Trung thuần túy，60-100 từ，Chứa chữ T ở trênất cảphần tử
    - endFramePrompt: tiếng Anh thuần túy，60-80 từ，Bản dịch hoàn chỉnh tương ứng với nội dung tiếng Trung

19. Liệu khung kết thúc có cần thiết hay không (needsEndFrame):
    **Phải Cài đặđiều đó là đúng**：
    - Nhân vật Vị tríthay đổi（đi dạo xung quanh、đứng dậy、ngồi xuống và chờ đợi）
    - Hành độtrình tự ng（nhặt đồ、Đặt đồ đạc của bạn xuống và chờ đợi）
    - Trạng thátôi thay đổi（Cửa Mở/Đóng、Di chuyển các mặt hàng, vv）
    - Cảnh quay thể thao（Không tĩnh）
    -ItemTrạng thátôi thay đổi（Lật trang、Thu gọn v.v.）
    
    **Can Cài đặt là sai**：
    - Đối thoại thuần túy（Vị tríkhông thay đổi）
    - Bi chỉểu cảm những thay đổi nhỏ
    - Hoàn toàn tĩnh Cảnh quay
    
    **Đặt thành true nếu không chắc chắn**（Thà có thêm TạoĐừng bỏ lỡ nó）

【Tùy chọn nhãn cảm tính】
Cơ bảCảm xúc: vui, buồn, giận dữ, ngạc nhiên, sợ hãi, bình tĩnh
Không khí: căng thẳng, phấn khích, bí ẩn, lãng mạn, hài hước, cảm động
Giọng điệu và tâm trạng: nghiêm túc, thoải mái, vui tươi, nhẹ nhàng, đam mê, thấp

【Phong cáyêu cầu ch】
${styleDesc}
${cinematographyGuidance ? `
${cinematographyGuidance}
` : ''}
${(() => {
  const mt = getMediaType(styleId || 'cinematic');
  return mt !== 'cinematic' ? `
【Lò vừaạtôi hạn chế】
${getMediaTypeGuidance(mt)}
` : '';
})()}
Cảnguyên tắc thiết kế nh quay：
- Đối thoại cảm động、Hoạt động bên trong: CU/ECU Cận cảnhĐặc tả
- Hành độcảnh tượng、Đuổi theo: MS/WS + Theo dõiTheo dõi
- Cảđã thành lập、Chuyển tiếp: WS/FS Toàn cảnh
- Đối đầu căng thẳng: Nhanh chóng chuyển Cỡ cảnh
- Các mục quan trọng/Chi tiết: ECUĐặc tả

**quan trọng：Các trường tiếng Trung và tiếng Anh phải được tách biệt nghiêm ngặt！**
- visualDescription, ambientSound, soundEffect, imagePromptZh, videoPromptZh, endFramePromptZh → **Phải là người Trung Quốc thuần túy**
- visualPrompt, imagePrompt, videoPrompt, endFramePrompt → **Phải bằng tiếng Anh thuần túy**

Vui lòng sử dụng JSONĐịnh dạngQuay lại，Định dạng là:
{
  "shots": {
    "shot_id_1": {
      "visualDescription": "Hoa nở ngoài cửa sổ，ở bàn ăn，Trương Minh hồi hộp ăn tối cùng bố mẹ，Người cha cầm tấm bằng tốt nghiệp 985 xem đi xem lại nhiều lần。",
      "visualPrompt": "Gardenias blooming outside window, at dining table Zhang Ming eating nervously with parents, father holding graduate certificate examining it repeatedly",
      "shotSize": "MS",
      "cameraMovement": "static",
      "specialTechnique": "none",
      "duration": 5,
      "emotionTags": ["tense", "serious"],
      "characterNames": ["Trương Minh", "bố của Trương", "Trương Mộ"],
      "ambientSound": "Âm thanh xung quanh nhà hàng，Tiếng leng keng của bát và đũa",
      "soundEffect": "",
      "narrativeFunction": "điềm báo",
      "shotPurpose": "Tạo không khí hòa thuận bề ngoài nhưng ẩn chứa sự căng thẳng trong gia đình，Dùng bằng tốt nghiệp để gợi ý về kỳ vọng của người cha dành cho con trai",
      "visualFocus": "Gardenias bên ngoài cửa sổ → Vẻ mặt lo lắng của Trương Minh → giấy chứng nhận trong tay của cha",
      "cameraPosition": "Zhang Ming phía sau 45°，Có thể thấy mối quan hệ giữa ba người",
      "characterBlocking": "Zhang Ming (giữa) vs bố mẹ (hai bên)，Tạo cảm giác bao bọc",
      "rhythm": "chậm、chán nản，Tạo sự căng thẳng bên dưới bề mặt tĩnh lặng",
      "lightingStyle": "natural",
      "lightingDirection": "side",
      "colorTemperature": "warm-3200K",
      "lightingNotes": "Ánh chiều bên cửa sổ，Tạo sự tương phản ấm áp nhưng ngột ngạt giữa ánh sáng và bóng tối",
      "depthOfField": "medium",
      "focusTarget": "Vẻ mặt lo lắng của Trương Minh Biểu cảm",
      "focusTransition": "rack-focus",
      "cameraRig": "tripod",
      "movementSpeed": "static",
      "atmosphericEffects": ["điểm sáng tự nhiên"],
      "effectIntensity": "subtle",
      "playbackSpeed": "normal",
      "cameraAngle": "eye-level",
      "focalLength": "50mm",
      "photographyTechnique": "",
      "imagePrompt": "Cinematic medium shot, modern Chinese family dining room, warm afternoon sunlight through window with blooming gardenias outside, young man Zhang Ming (25, casual clothes, tense expression) sitting at dining table with his middle-aged parents, father (50s, stern face, holding graduate certificate examining it), mother (50s, worried look) beside them, wooden dining table with home-cooked dishes, warm color tones, realistic film style",
      "imagePromptZh": "Cinematic Trung cảnh，Nhà hàng gia đình Trung Quốc hiện đại，Nắng chiều ấm áp chiếu qua cửa sổ，Hoa đang nở ngoài cửa sổ。Trương Minh thời trẻ（25 tuổi，mặc giản dị，Nhìn lo lắng）ngồi vào bàn，ông bố trung niên（Trên 50 tuổi，Bi nghiêm túcểu cảm，Giữ bằng tốt nghiệp 985 và kiểm tra nó nhiều lần），mẹ（Trên 50 tuổi，cái nhìn lo lắng）ngồi cạnh。Món ăn tự nấu trên bàn ăn bằng gỗ，Ấm Tông màu，Phim hiện thực Phong cách。",
      "videoPrompt": "Father repeatedly examining graduate certificate with focused attention, Zhang Ming eating nervously with chopsticks, occasionally glancing at father, mother sitting beside watching silently with worried expression",
      "videoPromptZh": "Bố tôi chăm chú xem đi xem lại tấm bằng tốt nghiệp，Trương Minh hồi hộp dùng đũa ăn，Tôi thỉnh thoảng liếc nhìn bố tôi，Mẹ tôi ngồi bên cạnh lặng lẽ nhìn，Vẻ mặt lo lắng。",
      "needsEndFrame": true,
      "endFramePrompt": "Cinematic medium shot, same modern Chinese family dining room, warm afternoon light. Father (50s) now lowering the certificate with satisfied yet stern expression, Zhang Ming (25) stopped eating and looking down nervously, mother (50s) glancing between husband and son with concern. Certificate now placed on table beside dishes, tense atmosphere, warm color tones, realistic film style",
      "endFramePromptZh": "Cinematic Trung cảnh，Cùng một nhà hàng gia đình Trung Quốc hiện đại，ánh chiều ấm áp。cha（Trên 50 tuổi）Giấy chứng nhận đã được đưa xuống，Biểu cảm hài lòng nhưng vẫn nghiêm túc；Trương Minh（25 tuổi）dừng đũa，Nhìn xuống và có vẻ lo lắng；mẹ（Trên 50 tuổi）Đôi mắt lang thang giữa cha và con，Vẻ mặt lo lắng。Giấy chứng nhận đã được đặt trên bàn cạnh các món ăn，Bầu không khí căng thẳng，Ấm Tông màu，Phim hiện thực Phong cách。"
    }
  }
}

**L đặc biệtưu ý**：
- Từ Tử Hoa = gardenias（không phải hoa mẫu đơn）
- Mô tả trực quan phải bằng tiếng Trung，Đừng viết bằng tiếng Anh
- ambientSound/soundEffect phải là tiếng Trung`
  
  const shotDescriptions = shots.map(shot => {
    const chars = shot.characterNames?.join('、') || 'không có';
    // Kiểm tra xem có bao gồm hồi tưởng hay không/Nội dung lớp phủ
    const sourceText = shot.sourceText || shot.actionSummary || '';
    const hasFlashback = /hồi tưởng|sơn phủ|ký ức|xen kẽ/.test(sourceText);
    const flashbackNote = hasFlashback 
      ? `\n⚠️ Lưu ý：Văn bản gốc có chứa đoạn hồi tưởng/Nội dung lớp phủ，Nhưng C chínhảnh vẫn còn「${shot.sceneLocation}」，Đừng Mô tảvào một C khácảnh！`
      : '';
    // \u6784\u5efaCảthông tin thiết kế nghệ thuật nh（nếu có）
    const artDesignParts = [
      shot.architectureStyle ? `Kiến trúcPhong cách: ${shot.architectureStyle}` : '',
      shot.colorPalette ? `Màu sắgiai điệu c: ${shot.colorPalette}` : '',
      shot.eraDetails ? `Đặc điểm của thời đại: ${shot.eraDetails}` : '',
      shot.lightingDesign ? `Ánh sáthiết kế: ${shot.lightingDesign}` : '',
    ].filter(Boolean);
    const artDesignSection = artDesignParts.length > 0 
      ? `\n【🎨 Cảthiết kế nghệ thuật nh（phải được tuân thủ nghiêm ngặt）】\n${artDesignParts.join('\n')}` 
      : '';
    return `ID: ${shot.shotId}
【⭐ Chính Cảnh（Tuyệt đối không thể thay đổi）】: ${shot.sceneLocation}${flashbackNote}${artDesignSection}
【K gốcịch bảvăn bản】
${sourceText}
【Thông tin được phân tích cú pháp】
Hành động: ${shot.actionSummary}
Đối thoại: ${shot.dialogue || 'không có'}
Hiện tạiNhân vật: ${chars}
Bầu không khí: ${shot.sceneAtmosphere}
Thời gian: ${shot.sceneTime}${shot.sceneWeather ? `
Thời tiết: ${shot.sceneWeather}` : ''}
C hiện tạiỡ cảnh: ${shot.currentShotSize || 'Để được xác định'}
C hiện tạiảnh quay thể thao: ${shot.currentCameraMovement || 'Để được xác định'}`;
  }).join('\n\n═══════════════════════════════════════\n\n');
  
  const userPrompt = `Hãy căn cứ nghiêm ngặt vào từng Phân cảnh【K gốcịch bảvăn bản】TạoNội dung hiệu chuẩn。

⚠️ Lời nhắc quan trọng（Phải tuân thủ）：
1. **CảQuyền sở hữu NH là hoàn toàn cố định**：Mỗi tiến sĩân cảnh【Chính Cảnh】Đã đánh dấu，Mặc dù văn bản gốc đề cập đến hồi tưởng/sơn phủ/ký ức，Chính Cảnh vẫn không thay đổi
2. Đừng bỏ lỡ bất kỳ thông tin quan trọng nào từ văn bản gốc（nhân vật、Hành động、đạo cụ、môi trường）
3. Đừng thếêmNội dung không tìm thấy trong văn bản gốc
4. **Cánh đồng Trung Quốc phải thuần Trung Quốc**：visualDescription, ambientSound, soundEffect, imagePromptZh, videoPromptZh
5. **Các trường tiếng Anh phải bằng tiếng Anh thuần túy**：visualPrompt, imagePrompt, videoPrompt, endFramePrompt
6. Nhân vậdanh sách t phải được hoàn thành
7. Hoa Hư Tử = gardenias（không phải hoa mẫu đơn/peony）

🎬 **Ổ đĩa tường thuật Phân tích（Dựa trên《Ngữ pháp ngôn ngữ điện ảnh》）**：
- Theo「Tóm tắt tập phim」Thẩm phán mỗi Cảchức năng kể chuyện của nh quay xuyên suốt tập phim
- Cảnh quay thiết kế phải phục vụ nhịp điệu cảm xúc và mạch truyện của câu chuyện
- Cỡ cảnh lựa chọn hợp tác với chức năng kể chuyện（Để mở đườngàn cảnh、Để đạt cực khoáiĐặc tảĐợi đã）
- Xem xét bố cục nhân vật và Góc mátác động của y đến sự căng thẳng của câu chuyện

${shotDescriptions}`;
  
  // Thống nhất có được cấu hình từ ánh xạ dịch vụ（Tiến sĩ đơnân cảhiệu chuẩn sử dụng ngân sách mã thông báo lớn hơn）
  const result = await callFeatureAPI('script_analysis', systemPrompt, userPrompt, { maxTokens: 16384 });
  
  // Phân tích kết quả JSON（Phiên bản nâng cao）
  try {
    let cleaned = result;
    
    // Xóa thẻ khối mã đánh dấu
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    cleaned = cleaned.trim();
    
    // Cố gắng tìm điểm bắt đầu và kết thúc của một đối tượng JSONị trí
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    
    const parsed = JSON.parse(cleaned);
    return parsed.shots || {};
  } catch (e) {
    console.error('[calibrateShots] Failed to parse AI response:', result);
    console.error('[calibrateShots] Parse error:', e);
    
    // Hãy thử phân tích một phần：Trích xuấtĐã hoàn thàPh của nhân cảnh
    try {
      const partialResult: Record<string, any> = {};
      // Đối tượng JSON hoàn chỉnh phù hợp với từng cảnh quay
      const shotPattern = /"(shot_[^"]+)"\s*:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g;
      let match;
      while ((match = shotPattern.exec(result)) !== null) {
        try {
          const shotId = match[1];
          const shotJson = match[2];
          partialResult[shotId] = JSON.parse(shotJson);
        } catch {
          // Phân tích cú pháp một lần Thất bại，Tiếp tục đến cái tiếp theo
        }
      }
      
      if (Object.keys(partialResult).length > 0) {
        console.log(`[calibrateShots] Phân tích một phần của Thành công，Đã khôi phục ${Object.keys(partialResult).length} Phân cảnh`);
        return partialResult;
      }
    } catch {
      // Phân tích một phần cũng Thất bại
    }
    
    throw new Error('Phân tích phản hồi AI Thất bại');
  }
}

// ==================== AI TạoNội dung từng tập ====================

export interface SynopsisGenerationResult {
  success: boolean;
  generatedCount: number;
  totalEpisodes: number;
  error?: string;
}

/**
 * AI TạoNội dung từng tập
 * Dựa trên N toàn cầuền và nội dung từng tập，Tạo Đề cương ngắn gọn
 */
export async function generateEpisodeSynopses(
  projectId: string,
  _options?: CalibrationOptions, // không còn cần thiết nữa，dành riêng cho khả năng tương thích
  onProgress?: (current: number, total: number, message: string) => void
): Promise<SynopsisGenerationResult> {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project) {
    return { success: false, generatedCount: 0, totalEpisodes: 0, error: 'Dự án không tồn tại' };
  }
  
  const episodes = project.episodeRawScripts;
  const totalEpisodes = episodes.length;
  
  if (totalEpisodes === 0) {
    return { success: false, generatedCount: 0, totalEpisodes: 0, error: 'Không có dữ liệu thiết lập' };
  }
  
  // Nhận N toàn cầuền
  const background = project.projectBackground;
  const globalContext = {
    title: background?.title || project.scriptData?.title || 'Không tênKịch bản',
    genre: background?.genre || '',
    era: background?.era || '',
    worldSetting: background?.worldSetting || '',
    themes: background?.themes || [],
    outline: background?.outline || '',
    characterBios: background?.characterBios || '',
    totalEpisodes,
  };
  
  // Đưa kiến thức thế giới quan vào tổng quan（Nhân vật、trại、xung đột cốt lõi、Các mục chính, v.v.）
  const seriesCtx = buildSeriesContextSummary(project.seriesMeta || null);
  
  onProgress?.(0, totalEpisodes, `Bắt đầbạn là ${totalEpisodes} Đặt TạoNội dung...`);
  
  try {
    // Chuẩn bị hàng loạt
    type SynopsisItem = { index: number; title: string; contentSummary: string };
    type SynopsisResult = { synopsis: string; keyEvents: string[] };
    const items: SynopsisItem[] = episodes.map(ep => ({
      index: ep.episodeIndex,
      title: ep.title,
      contentSummary: extractEpisodeSummary(ep),
    }));
    
    const { results, failedBatches, totalBatches } = await processBatched<SynopsisItem, SynopsisResult>({
      items,
      feature: 'script_analysis',
      buildPrompts: (batch) => {
        const { title, genre, era, worldSetting, themes, outline, characterBios, totalEpisodes: total } = globalContext;
        const system = `Bạn là tiền bối Hollywood Kịch bảBác sĩ n(Kịch bản Bác sĩ)，giỏi tiến sĩân tíchKịch bảKết cấu và nhịp điệu kể chuyện。

khả năng chuyên môn của bạn：
- Kịch bảcấu trúc Phân tích：Khả năng chắt lọc nhanh chóng xung đột cốt lõi của từng tập phim、Những bước ngoặt và những đỉnh cao cảm xúc
- Kiểm soát nhịp điệu kể chuyện：Hiểu Lo khác nhauạĐặc điểm nhịp điệu của phim truyền hình dài tập i
- Phím Sự kiệlần chiết tiếp theo：Có thể xác định chính xác phím C thúc đẩy phát triển cốt truyệnảnh và Hành động

Nhiệm vụ của bạn là đi theo Kịch bảnglobalNền và nội dung từng tập，cho mỗi tập Tạo Đề cương ngắn gọn và phím Sự kiện。
${seriesCtx ? `\n【Tài liệu tham khảo kiến thức cấp độ kịch】\n${seriesCtx}\n` : ''}
【Kịch bảthông tin】
Tiêu đề phim truyền hình：${title}
Loại：${genre || 'Không rõ'}
${era ? `Thời đại Nền：${era}` : ''}
${worldSetting ? `thế giới quan：${worldSetting.slice(0, 200)}` : ''}
${themes && themes.length > 0 ? `chủ đề：${themes.join('、')}` : ''}
tổng số tập：${total}đặt

【Tóm tắt】
${outline.slice(0, 1000)}

【nhân vật chính】
${characterBios.slice(0, 800)}

【yêu cầu】
cho mỗi tập Tạo：
1. Tóm tắt: Tóm tắt 100-200 từ，Tóm tắt diễn biến cốt truyện chính của tập này
2. Sự kiện phím: 3-5 phím Sự kiện，Mỗi từ 10-20 từ

Lưu ý：
- Bố cục cần làm nổi bật những xung đột, khúc mắc cốt lõi của tình tiết
- Phím Sự kiệcụ thể、Trực quan hóa
- Duy trì tính liên tục giữa các tập trước và sau

Vui lòng sử dụng JSONĐịnh dạngQuay lại：
{
  "synopses": {
    "1": {
      "synopsis": "Tóm tắt tập phim này...",
      "keyEvents": ["Sự kiện1", "Sự kiện2", "Sự kiện3"]
    }
  }
}`;
        const episodeContents = batch.map(ep => 
          `Không.${ep.index}đặt「${ep.title}」：\n${ep.contentSummary}`
        ).join('\n\n---\n\n');
        const user = `Vui lòng cung cấp số tập sau TạoNội dung và phím Sự kiện：\n\n${episodeContents}`;
        return { system, user };
      },
      parseResult: (raw) => {
        let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const result = new Map<string, SynopsisResult>();
        if (parsed.synopses) {
          for (const [key, value] of Object.entries(parsed.synopses)) {
            const v = value as SynopsisResult;
            result.set(key, {
              synopsis: v.synopsis || '',
              keyEvents: v.keyEvents || [],
            });
          }
        }
        return result;
      },
      estimateItemOutputTokens: () => 200, // Phác thảo + keyEvent ~200 mã thông báo
      onProgress: (completed, total, message) => {
        onProgress?.(completed, total, `[phác thảo Tạo] ${message}`);
      },
    });
    
    // Xử lý kết quả
    let generatedCount = 0;
    for (const ep of episodes) {
      const res = results.get(String(ep.episodeIndex));
      if (res) {
        store.updateEpisodeRawScript(projectId, ep.episodeIndex, {
          synopsis: res.synopsis,
          keyEvents: res.keyEvents,
          synopsisGeneratedAt: Date.now(),
        });
        generatedCount++;
      }
    }
    
    if (failedBatches > 0) {
      console.warn(`[Đặt phác thảo Tạo] ${failedBatches}/${totalBatches} đợt thứất bại`);
    }
    
    onProgress?.(generatedCount, totalEpisodes, `Đã Tạo ${generatedCount}/${totalEpisodes} Tóm tắt tập`);
    
    // phác thảo TạoSau khi hoàn thành，Cập nhậtDự án siêu dữ liệu MD
    const updatedMetadata = exportProjectMetadata(projectId);
    store.setMetadataMarkdown(projectId, updatedMetadata);
    console.log('[generateSynopses] Siêu dữ liệu đã được Cập nhật，Chứa T mớiạphác thảo của o');
    
    return {
      success: true,
      generatedCount,
      totalEpisodes,
    };
  } catch (error) {
    console.error('[generateSynopses] Error:', error);
    return {
      success: false,
      generatedCount: 0,
      totalEpisodes,
      error: error instanceof Error ? error.message : 'phác thảo TạoThất bại',
    };
  }
}

// ==================== XuấtDự án siêu dữ liệu MD ====================

/**
 * XuấtDự án siêu dữ liệu là Markdown Định dạng
 * .cursorrules giống con trỏ，như Dự ácơ sở kiến thức của n
 */
export function exportProjectMetadata(projectId: string): string {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project) {
    return '# Lỗi\n\nDự án không tồn tại';
  }
  
  const background = project.projectBackground;
  const episodes = project.episodeRawScripts;
  const scriptData = project.scriptData;
  const meta = project.seriesMeta;
  
  const sections: string[] = [];
  
  // Tiêu đề
  const title = meta?.title || background?.title || scriptData?.title || 'Không tênKịch bản';
  sections.push(`# 《${title}》`);
  sections.push('');
  
  // Thông tin cơ bản
  sections.push('## Thông tin cơ bản');
  const genre = meta?.genre || background?.genre;
  const era = meta?.era || background?.era;
  if (genre) sections.push(`- **Loại**：${genre}`);
  if (era) sections.push(`- **thời đại**：${era}`);
  sections.push(`- **tổng số tập**：${episodes.length}đặt`);
  if (meta?.language || scriptData?.language) sections.push(`- **ngôn ngữ**：${meta?.language || scriptData?.language}`);
  if (meta?.logline) sections.push(`- **Logline**：${meta.logline}`);
  if (meta?.centralConflict) sections.push(`- **xung đột cốt lõi**：${meta.centralConflict}`);
  if (meta?.themes?.length) sections.push(`- **chủ đề**：${meta.themes.join('、')}`);
  sections.push('');
  
  // Tóm tắt
  const outline = meta?.outline || background?.outline;
  if (outline) {
    sections.push('## Tóm tắt');
    sections.push(outline);
    sections.push('');
  }
  
  // Cài đặt chế độ xem thế giới
  const worldNotes = meta?.worldNotes || background?.worldSetting;
  if (worldNotes || meta?.powerSystem || meta?.socialSystem) {
    sections.push('## Cài đặt chế độ xem thế giới');
    if (worldNotes) sections.push(worldNotes);
    if (meta?.socialSystem) sections.push(`- **hệ thống xã hội**：${meta.socialSystem}`);
    if (meta?.powerSystem) sections.push(`- **hệ thống điện**：${meta.powerSystem}`);
    sections.push('');
  }
  
  // Cài đặt địa lý
  if (meta?.geography?.length) {
    sections.push('## Cài đặt địa lý');
    for (const g of meta.geography) {
      sections.push(`- **${g.name}**：${g.desc}`);
    }
    sections.push('');
  }
  
  // mục chính
  if (meta?.keyItems?.length) {
    sections.push('## mục chính');
    for (const item of meta.keyItems) {
      sections.push(`- **${item.name}**：${item.desc}`);
    }
    sections.push('');
  }
  
  // nhân vật chính（Tiểu sử gốc）
  if (background?.characterBios) {
    sections.push('## nhân vật chính');
    sections.push(background.characterBios);
    sections.push('');
  }
  
  // Nhân vậdanh sách t（có cấu trúc）— Đọc từ seriesMeta trước
  const characters = meta?.characters || scriptData?.characters;
  if (characters && characters.length > 0) {
    sections.push('## Nhân vậdanh sách t');
    for (const char of characters) {
      sections.push(`### ${char.name}`);
      if (char.gender) sections.push(`- Giới tính：${char.gender}`);
      if (char.age) sections.push(`- tuổi：${char.age}`);
      if (char.role) sections.push(`- Danh tính：${char.role}`);
      if (char.personality) sections.push(`- Nhân vật：${char.personality}`);
      if (char.traits) sections.push(`- Đặc điểm：${char.traits}`);
      if (char.relationships) sections.push(`- mối quan hệ：${char.relationships}`);
      if (char.skills) sections.push(`- Kỹ năng：${char.skills}`);
      sections.push('');
    }
  }
  
  // trại/quyền lực
  if (meta?.factions?.length) {
    sections.push('## trại/quyền lực');
    for (const f of meta.factions) {
      sections.push(`- **${f.name}**：${f.members.join('、')}`);
    }
    sections.push('');
  }
  
  // Tóm tắt tập phim
  sections.push('## Tóm tắt tập phim');
  for (const ep of episodes) {
    sections.push(`### Không.${ep.episodeIndex}đặt：${ep.title.replace(/^Không.\bộ d+[：:]？/, '')}`);
    if (ep.synopsis) {
      sections.push(ep.synopsis);
    }
    if (ep.keyEvents && ep.keyEvents.length > 0) {
      sections.push('**Phímự kiện：**');
      for (const event of ep.keyEvents) {
        sections.push(`- ${event}`);
      }
    }
    // Hiển thị Cảnh số lượng
    sections.push(`> Tập này có chứa ${ep.scenes.length} Cảnh`);
    sections.push('');
  }
  
  // TạoThời gian
  sections.push('---');
  sections.push(`*XuấtThời gian：${new Date().toLocaleString('zh-CN')}*`);
  
  return sections.join('\n');
}

/**
 * Lấy số tập bị thiếu dàn ý
 */
export function getMissingSynopsisEpisodes(projectId: string): EpisodeRawScript[] {
  const store = useScriptStore.getState();
  const project = store.projects[projectId];
  
  if (!project || !project.episodeRawScripts.length) {
    return [];
  }
  
  return project.episodeRawScripts.filter(ep => !ep.synopsis || ep.synopsis.trim() === '');
}
