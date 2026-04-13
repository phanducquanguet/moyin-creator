// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * AI Character Calibrator
 * 
 * Sử dụng AI hiệu chỉnh thông minh từ Kịch bảntrongĐã trích xuất Nhân vậdanh sách t
 * 
 * chức năng：
 * 1. Thống kêMỗi Nhân vậtcủaSố lần xuất hiện、đối thoại\u6761\u6570、xuất hiệnđặt\u6570
 * 2. AI Phân tích\u8bc6\u522b\u771f\u6b63Nhân vật vs \u975eNhân vật\u8bcd
 * 3. AI \u5408\u5e76\u91cd\u590dNhân vật（\u738b\u603b = \u6295\u8d44\u4eba\u738b\u603b）
 * 4. AI \u5206\u7c7bnhân vật chính/vai phụ/\u9f99\u5957（\u7ed3\u5408Ngoại hìnhống kê）
 * 5. AI bổ sungNhân vậthông tin t（tuổi tác、giới tính、mối quan hệ）
 */

import type { ScriptCharacter, ProjectBackground, EpisodeRawScript, CharacterIdentityAnchors, CharacterNegativePrompt, PromptLanguage, CalibrationStrictness, FilteredCharacterRecord } from '@/types/script';
import { callFeatureAPI } from '@/lib/ai/feature-router';
import { processBatched } from '@/lib/ai/batch-processor';
import { estimateTokens, safeTruncate } from '@/lib/ai/model-registry';
import { useScriptStore } from '@/stores/script-store';
import { buildSeriesContextSummary } from './series-meta-sync';

// ==================== LoạiĐịnh nghĩa ====================

export interface CharacterCalibrationResult {
  /** \u6821\u51c6\u540eNhân vậdanh sách t */
  characters: CalibratedCharacter[];
  /** Là Lọccủa\u8bcd（\u975eNhân vật） */
  filteredWords: string[];
  /** Là LọcNhân vật（\u5e26lý do，sử dụng\u4e8eNgười dùngXác nhận/\u6062\u590d） */
  filteredCharacters: FilteredCharacterRecord[];
  /** \u5408\u5e76Bản ghi（\u54ea\u4e9b\u88ab\u5408\u5e76Đếnmột\u8d77） */
  mergeRecords: MergeRecord[];
  /** AI Phân tíchGiải thích */
  analysisNotes: string;
}

export interface CalibratedCharacter {
  id: string;
  name: string;
  /** Nhân vậtquan trọng\u6027：protagonist(nhân vật chính), supporting(quan trọngvai phụ), minor(MinorNhân vật), extra(\u9f99\u5957) */
  importance: 'protagonist' | 'supporting' | 'minor' | 'extra';
  /** xuất hiệnđặt\u6570\u8303\u56f4 */
  episodeRange?: [number, number];
  /** Số lần xuất hiện */
  appearanceCount: number;
  /** AI bổ sungNhân vậtMô tả */
  role?: string;
  /** AI suy luậncủatuổi tác */
  age?: string;
  /** AI suy luậncủagiới tính */
  gender?: string;
  /** với Nh khácân vậmối quan hệ */
  relationships?: string;
  /** nguyên bảnTrích xuấtcủatêntừthay đổi\u4f53 */
  nameVariants: string[];
  // === NH chuyên nghiệpân vậlĩnh vực thiết kế t ===
  /** Lời nhắc trực quan bằng tiếng Anh（cho hình ảnh AI Tạo） */
  visualPromptEn?: string;
  /** Lời nhắc trực quan của Trung Quốc */
  visualPromptZh?: string;
  /** đặc điểm khuôn mặtMô tả */
  facialFeatures?: string;
  /** dấu ấn độc đáo（\u7586\u75d5、vết bớtĐợi đã） */
  uniqueMarks?: string;
  /** quần áoPhong cách */
  clothingStyle?: string;
  
  // === Neo nhận dạng lớp 6（Nhân vậtTính nhất quán）===
  /** Identity Anchors – Khóa tính năng 6 lớp */
  identityAnchors?: CharacterIdentityAnchors;
  /** Lời nhắc tiêu cực */
  negativePrompt?: CharacterNegativePrompt;
}

export interface MergeRecord {
  /** \u6700\u7ec8sử dụngcủatêntừ */
  finalName: string;
  /** các biến thể hợp nhất */
  variants: string[];
  /** Lý do sáp nhập */
  reason: string;
}

export interface CalibrationOptions {
  /** \u4e0alần\u6821\u51c6Nhân vậdanh sách t，sử dụng\u4e8e\u5408\u5e76\u786e\u4fddNhân vật\u4e0d\u4e22\u5931 */
  previousCharacters?: CalibratedCharacter[];
  /** Tùy chọn ngôn ngữ nhắc nhở */
  promptLanguage?: PromptLanguage;
  /** \u6821\u51c6\u4e25\u683c\u5ea6 */
  strictness?: CalibrationStrictness;
}

// ==================== từKịch bản\u91cd\u65b0Trích xuất Nhân vật ====================

/**
 * từ episodeRawScripts trong\u91cd\u65b0Trích xuất Tất cảNhân vật
 * \u8fd9\u4f1a\u904d\u5386Tất cảđặtTất cảCảnh，Trích xuấtCảnh nhân vậtvàđối thoạinói\u4eba
 */
export function extractAllCharactersFromEpisodes(
  episodeScripts: EpisodeRawScript[]
): ScriptCharacter[] {
  const characterSet = new Set<string>();
  
  if (!episodeScripts || !Array.isArray(episodeScripts)) {
    console.warn('[extractAllCharactersFromEpisodes] tập lệnh không hợp lệ');
    return [];
  }
  
  // \u904d\u5386Tất cảđặt
  for (const ep of episodeScripts) {
    if (!ep || !ep.scenes) continue;
    
    for (const scene of ep.scenes) {
      if (!scene) continue;
      
      // Từ Cảnh nhân vậdanh sách tTrích xuất
      const sceneChars = scene.characters || [];
      for (const name of sceneChars) {
        if (name && name.trim()) {
          characterSet.add(name.trim());
        }
      }
      
      // từđối thoạitrongTrích xuấtnói\u4eba
      const dialogues = scene.dialogues || [];
      for (const dialogue of dialogues) {
        if (dialogue && dialogue.character && dialogue.character.trim()) {
          characterSet.add(dialogue.character.trim());
        }
      }
    }
  }
  
  // \u8f6c\u6362cho ScriptCharacter \u6570\u7ec4
  const characters: ScriptCharacter[] = Array.from(characterSet).map((name, index) => ({
    id: `char_raw_${index + 1}`,
    name,
  }));
  
  console.log(`[extractAllCharactersFromEpisodes] từ ${episodeScripts.length} đặtKịch bảntrongTrích xuấtĐến ${characters.length} Nhân vật`);
  return characters;
}

// ==================== Ngoại hìnhống kê ====================

/** Nhân vậtNgoại hìnhống kê */
export interface CharacterStats {
  name: string;
  /** Cảnh xuất hiện */
  sceneCount: number;
  /** đối thoại\u6761\u6570 */
  dialogueCount: number;
  /** Danh sách các tập mà họ xuất hiện */
  episodes: number[];
  /** Xuất hiện lần đầu trong các tập phim */
  firstEpisode: number;
  /** Xuất hiện tập cuối */
  lastEpisode: number;
  /** mẫu đối thoại（3 mục hàng đầu） */
  dialogueSamples: string[];
  /** Ngoại hình Cảnh mẫu */
  sceneSamples: string[];
}

/**
 * Thống kêMỗi Nhân vậsự xuất hiện của t
 */
export function collectCharacterStats(
  characterNames: string[],
  episodeScripts: EpisodeRawScript[]
): Map<string, CharacterStats> {
  const stats = new Map<string, CharacterStats>();
  
  // kiểm tra phòng thủ
  if (!characterNames || !Array.isArray(characterNames)) {
    console.warn('[collectCharacterStats] tên ký tự không hợp lệ');
    return stats;
  }
  if (!episodeScripts || !Array.isArray(episodeScripts)) {
    console.warn('[collectCharacterStats] tập lệnh không hợp lệ');
    return stats;
  }
  
  // \u521d\u59cb\u5316
  for (const name of characterNames) {
    if (!name) continue;
    stats.set(name, {
      name,
      sceneCount: 0,
      dialogueCount: 0,
      episodes: [],
      firstEpisode: Infinity,
      lastEpisode: 0,
      dialogueSamples: [],
      sceneSamples: [],
    });
  }
  
  // \u904d\u5386Tất cảKịch bản
  for (const ep of episodeScripts) {
    if (!ep || !ep.scenes) continue;
    const epIndex = ep.episodeIndex ?? 0;
    
    for (const scene of ep.scenes) {
      if (!scene) continue;
      
      // \u68c0\u67e5Cảnh nhân vật
      const sceneChars = scene.characters || [];
      for (const charName of sceneChars) {
        if (!charName) continue;
        // \u7cbe\u786etrận đấuhoặcchứatrận đấu
        for (const name of characterNames) {
          if (!name) continue;
          if (charName === name || charName.includes(name) || name.includes(charName)) {
            const s = stats.get(name);
            if (!s) continue;
            s.sceneCount++;
            if (!s.episodes.includes(epIndex)) {
              s.episodes.push(epIndex);
            }
            s.firstEpisode = Math.min(s.firstEpisode, epIndex);
            s.lastEpisode = Math.max(s.lastEpisode, epIndex);
            if (s.sceneSamples.length < 3) {
              s.sceneSamples.push(`Không.${epIndex}Đặt: ${scene.sceneHeader || 'Không rõCảnh'}`);
            }
          }
        }
      }
      
      // \u68c0\u67e5đối thoại
      const dialogues = scene.dialogues || [];
      for (const dialogue of dialogues) {
        if (!dialogue || !dialogue.character) continue;
        for (const name of characterNames) {
          if (!name) continue;
          if (dialogue.character === name || dialogue.character.includes(name)) {
            const s = stats.get(name);
            if (!s) continue;
            s.dialogueCount++;
            if (s.dialogueSamples.length < 3) {
              const line = dialogue.line || '';
              s.dialogueSamples.push(`${dialogue.character}: ${line.slice(0, 30)}...`);
            }
          }
        }
      }
    }
  }
  
  // \u4fee\u6b63 Infinity
  for (const s of stats.values()) {
    if (s.firstEpisode === Infinity) s.firstEpisode = 0;
  }
  
  return stats;
}

// ==================== chức năng cốt lõi ====================

/**
 * sử dụng AI \u6821\u51c6Nhân vậdanh sách t
 * 
 * @param rawCharacters nguyên bảnĐã trích xuất Nhân vậdanh sách t
 * @param background Dự ánNền（phác thảo）
 * @param episodeScripts \u5206đặtKịch bản（\u63d0\u4f9b\u4e0a\u4e0b\u6587）
 * @cấu hình API tùy chọn param
 */
export async function calibrateCharacters(
  rawCharacters: ScriptCharacter[],
  background: ProjectBackground,
  episodeScripts: EpisodeRawScript[],
  options?: CalibrationOptions
): Promise<CharacterCalibrationResult> {
  const previousCharacters = options?.previousCharacters;
  const promptLanguage = options?.promptLanguage || 'zh+en';
  const strictness = options?.strictness || 'normal';
  
  // 1. đầu tiênThống kêMỗi Nhân vậsự xuất hiện của t
  const characterNames = rawCharacters.map(c => c.name);
  const stats = collectCharacterStats(characterNames, episodeScripts);
  
  // 2. \u6784\u5efaVới Thống kêthông tinNhân vậdanh sách t，\u6309\u667a\u80fdưu tiênSắp xếp
  const charsWithStats = rawCharacters.map(c => {
    const s = stats.get(c.name);
    const name = c.name;
    
    // \u5224\u65ad\u662f\u5426\u662f\u7fa4\u6f14（\u7eafSự nghiệp\u79f0\u547f、con số\u7f16\u53f7、\u7fa4\u4f53Mô tả）
    // loose chế độ\u4e0b\u4e0d\u6807\u8bb0\u7fa4\u6f14，Tất cả\u4fdd\u7559\u7ed9 AI \u5224\u65ad
    const isGroupExtra = strictness === 'loose' ? false : [
      '\u4fdd\u5b89', 'cảnh sát', '\u5458\u5de5', '\u62a4\u58eb', 'bác sĩ', '\u8bb0\u8005', 
      'luật sư', '\u8def\u4eba', '\u4f17\u4eba', '\u82e5\u5e72', '\u7fa4\u4f17', '\u5927\u5988',
    ].some(keyword => 
      name === keyword || 
      name === keyword + '1' || 
      name === keyword + '2' ||
      name.startsWith('\u51e0tên') ||
      name.startsWith('\u4e24một') ||
      name.startsWith('\u82e5\u5e72')
    );
    
    // \u5224\u65ad\u662f\u5426Có\u5177\u4f53têntừ（Tên tiếng Trungtừ2-4từ，hoặcCó\u6635\u79f0\u540e\u7f00）
    const hasSpecificName = (
      (name.length >= 2 && name.length <= 4 && /[\u4e00-\u9fa5]/.test(name)) || // Tên tiếng Trungtừ
      name.includes('\u54e5') || name.includes('\u59d0') || name.includes('\u8463') || // Có\u79f0\u547c
      name.includes('\u603b') || name.includes('\u8001') || name.includes('\u5c0f') || // Có\u79f0\u547c
      /^[A-Z][a-z]+$/.test(name) // tên tiếng anh
    );
    
    return {
      name: c.name,
      sceneCount: s?.sceneCount || 0,
      dialogueCount: s?.dialogueCount || 0,
      episodeCount: s?.episodes.length || 0,
      isGroupExtra,
      hasSpecificName,
      // \u667a\u80fdưu tiên：Cótêntừưu tiên，\u7136\u540e\u6309xuất hiệnSắp xếp
      priority: isGroupExtra ? -1000 : // \u7fa4\u6f14\u6700\u4f4e
                hasSpecificName ? 1000 + (s?.sceneCount || 0) + (s?.dialogueCount || 0) : // CótêntừƯu tiên
                (s?.sceneCount || 0) + (s?.dialogueCount || 0), // \u6ca1têntừ\u6309xuất hiện
    };
  }).sort((a, b) => b.priority - a.priority);
  
  // \u9650\u5236\u53d1\u9001\u7ed9 AI Nhân vật\u6570\u91cf，\u907f\u514dĐầu ra\u622a\u65ad
  // Ưu tiên\u4fdd\u7559CótêntừNhân vật
  const maxCharsToSend = 150;
  const charsToProcess = charsWithStats.slice(0, maxCharsToSend);
  const skippedCount = charsWithStats.length - charsToProcess.length;
  
  // 3. \u51c6\u5907lô\u5904\u7406 items（Mỗi Nhân vật\u5e26\u4e0aThống kêthông tinvàmẫu đối thoại）
  const batchItems = charsToProcess.map(c => ({
    name: c.name,
    sceneCount: c.sceneCount,
    dialogueCount: c.dialogueCount,
    episodeCount: c.episodeCount,
    dialogueSamples: stats.get(c.name)?.dialogueSamples || [],
  }));
  
  // Tính toán\u603b\u573alần\u6570sử dụng\u4e8e\u5224\u65adnhân vật chính cốt lõtôi là 10% \u9608\u503c
  let totalSceneCount = 0;
  for (const ep of episodeScripts) {
    if (ep?.scenes) totalSceneCount += ep.scenes.length;
  }
  const coreThreshold = Math.max(Math.floor(totalSceneCount * 0.1), 10);
  
  // === \u6839\u636e\u4e25\u683c\u5ea6Tạo\u4e0d\u540ccủa\u7b5b\u9009\u6307\u4ee4\u6bb5 ===
  const strictnessInstructions = strictness === 'strict'
    ? `【\u7b5b\u9009chế độ：\u4e25\u683c】
- Chỉ giữ nhân vật chính rõ ràng、quan trọngvai phụ、và Nh thứ cấp với tên cụ thểân vật
- xuất hiện ≤1 Nh không có hội thoạiân vậtLọc
- Địa chỉ thuần túy của Nh không có tên cụ thểân vậtLọc（Chẳng hạn như"ủy ban nghiên cứu"、"Anh Nam đeo kính"）
- Tất cả các tính năng bổ sung là Lọc`
    : strictness === 'loose'
    ? `【\u7b5b\u9009chế độ：lỏng lẻo】
- Khắc nghiệtọc，Giữ Tất cả\u80fd\u8bc6\u522bNhân vật
- bao gồm\u7fa4\u6f14、\u4f4e\u9891Nhân vật、Chỉ Có\u79f0\u547cNhân vật（Chẳng hạn như"ủy ban nghiên cứu"、"Anh Nam đeo kính"）
- \u53eaLọc\u7eafMô tả\u8bcd（Chẳng hạn như"\u773c\u6846\u5fae\u6e7f"、"\u5e72\u7ec3\u4f18\u96c5"）và\u975enhân vật\u8bcd（Chẳng hạn như"\u5168\u4f53\u5458\u5de5"、"cốt lõi\u56e2\u961f"）`
    : `【\u7b5b\u9009chế độ：Tiêu chuẩn】
- Cótêntừhoặc\u79f0\u547cNhân vậtTất cả\u4fdd\u7559
- \u53eaLọc\u7eaf\u7fa4\u6f14、\u7fa4\u4f53、\u975eNhân vật\u8bcd`;
  
  // Lưu ý\u5165bối cảnh kịch
  const store = useScriptStore.getState();
  const activeProjectId = store.activeProjectId;
  const seriesMeta = activeProjectId ? store.projects[activeProjectId]?.seriesMeta : null;
  const seriesCtx = buildSeriesContextSummary(seriesMeta || null);
  const seriesCtxBlock = seriesCtx ? `\n\n${seriesCtx}\n` : '';

  const systemPrompt = `\u4f60\u662f\u4e13\u4e1acủa\u5f71\u89c6Kịch bảnPhân tích chia，\u64c5\u957ftừKịch bảdữ liệutrong\u8bc6\u522bvà\u6821\u51c6Nhân vật。${seriesCtxBlock}
【cốt lõiĐích】
\u6821\u51c6\u540eNhân vậdanh sách t\u5c06cho TạoNhân vậtba\u89c6\u56fe。

${strictnessInstructions}

【\u4e25\u683c\u6267được rồi - \u4fdd\u7559quy tắc】

**1. nhân vật chính cốt lõi (protagonist)** - \u5fc5\u987b\u4fdd\u7559
   - têntừ\u660e\u786e，xuất hiện\u591a，\u8d2f\u7a7f\u5168\u5267
   - Ví dụ：Trương Minh、\u8001\u5468、\u82cfrõ ràng

**2. quan trọngvai phụ (supporting)** - \u5fc5\u987b\u4fdd\u7559
   - Có\u5177\u4f53têntừhoặc\u6635\u79f0：\u5200\u7591\u54e5、\u9f99\u54e5、\u674e\u5f3a、\u738b\u8273、\u5c0f\u4e50、\u963f\u5f3a
   - Có\u56fa\u5b9a\u79f0\u547c：\u8d56\u8463、\u738b\u603b、\u5468\u603b、\u674ebác sĩ
   - xuất hiện ≥1 \u4e14Cóđối thoại、hoặcxuất hiện ≥2

**3. MinorNhân vật (minor)** - \u5fc5\u987b\u4fdd\u7559
   - Có\u5177\u4f53têntừ，\u5076\u5c14xuất hiện
   - \u5bf9\u5267\u60c5Cómột\u5b9a\u4f5csử dụng
   - **\u53eaxuất hiện1lần\u4f46Cótêntừcủa\u4e5f\u8981\u4fdd\u7559！**

**4. \u7fa4\u6f14/vai phụ (extra)** - ${strictness === 'strict' ? '\u53ef\u4ee5Lọc' : strictness === 'loose' ? '\u5fc5\u987b\u4fdd\u7559' : '\u5c3d\u91cf\u4fdd\u7559'}
   - Có\u79f0\u547c\u4f46xuất hiện\u6781\u5c11của，\u6807\u8bb0cho extra
   - Ví dụ：\u674e\u8001\u5934、\u5c0f\u5218、\u738b\u5927\u5988

${strictness !== 'strict' ? `【cực kỳ quan trọng - lỏng lẻo\u7b5b\u9009\u539f\u5219】
- **CótêntừTất cả\u4fdd\u7559！**（\u5373\u4f7f\u53eaxuất hiện1lần）
- **Có\u79f0\u547cTất cả\u4fdd\u7559！**（Chẳng hạn như\u8001X、bé X、Anh X、Chị X、Ông X、X Đông）
- **\u4e0d\u786e\u5b9acủa\u4fdd\u7559！**（Thà giữ nhiều hơn，đừng bỏ lỡ）
` : ''}【Lọcquy tắc】

**\u5fc5\u987bLọccủa（không cótêntừcủa\u7eaf\u7fa4\u6f14）：**
- \u7eafSự nghiệp\u8bcd：\u4fdd\u5b89、cảnh sát、\u62a4\u58eb、bác sĩ、\u8bb0\u8005、\u5458\u5de5、luật sư、\u670d\u52a1\u5458、người lái xe
- con số\u7f16\u53f7：\u4fdd\u5b891、cảnh sát2、\u62a4\u58eb3、\u5458\u5de5A
- \u7fa4\u4f53\u8bcd：\u82e5\u5e72\u4eba、\u4f17\u4eba、\u51e0tên\u4fdd\u5b89、\u4e24một\u5927\u5988、một\u7fa4\u4eba
- \u975eNhân vật\u8bcd：\u5168\u4f53\u5458\u5de5、\u4fdd\u5b89\u90e8、cốt lõi\u56e2\u961f
- Mô tả\u8bcd：\u773c\u6846\u5fae\u6e7f、\u5e72\u7ec3\u4f18\u96c5、\u773c\u795e\u6c89\u9759

**\u7edd\u5bf9\u4e0d\u80fdLọccủa：**
- \u4efb\u4f55Có\u59d3têncủa：Trương Minh、\u674e\u5f3a、\u738b\u8273、\u6797gió、con ngựa\u514b
- \u4efb\u4f55Có\u6635\u79f0của：\u5200\u7591\u54e5、\u9f99\u54e5、\u5c0f\u4e50、\u963f\u5f3a、\u8001\u674e、\u5c0f\u5218
- Có\u59d3\u6c0f+Sự nghiệp：\u8d56\u8463、\u738b\u603b、\u5468\u603b、\u674ebác sĩ、\u5f20\u79d8\u4e66、\u6797phép chia\u5085
- Có\u59d3\u6c0f+\u79f0\u8c13：\u674e\u8001\u5934、\u738b\u5927\u5988、\u5468\u59b9

【\u5408\u5e76quy tắc】
\u53ea\u5408\u5e76\u660e\u786e\u662f\u540cmột\u4ebacủa\u4e0d\u540c\u79f0\u547c：
- Ví dụ："\u738b\u603b" và "\u6295\u8d44\u4eba\u738b\u603b" → \u5408\u5e76cho "\u738b\u603b"
- Ví dụ："\u5200\u7591\u54e5" và "\u674e\u5f3a" Chẳng hạn như\u679c\u5267\u60c5\u660e\u786e\u662f\u540cmột\u4eba → \u5408\u5e76

【\u6570\u91cfkhoảng\u675f】
- nhân vật chính：1-3 một
- vai phụ：5-30 một（CótêntừTất cả\u4fdd\u7559，\u4e0d\u8981\u9650\u5236）
- \u603bNhân vật\u6570：\u5efa\u8bae 15-40 một，\u5b81\u591a\u52ff\u5c11

【quan trọng】\u6bcfmộtLà LọcNhân vật\u8bf7\u5728 filteredCharacters trongGiải thíchLọclý do。

Vui lòng sử dụng JSONĐịnh dạngQuay lạiPhân tích kết quả。`;

  // Đã chia sẻNềnContext（\u6bcflô\u90fd\u5e26，sử dụng safeTruncate \u622a\u65ad）
  const outlineContext = safeTruncate(background.outline || '', 1500);
  const biosContext = safeTruncate(background.characterBios || '', 1000);

  // === bước đầu tiên：AI Nhân vậtPhân tích（\u81ea\u52a8\u5206lô）===
  let parsed: any;
  try {
    console.log('[CharacterCalibrator] Bắt đầu AI Nhân vậtPhân tích...');
    
    // Đóng cửa thu thập các trường tổng hợp theo lô
    const allFilteredWords: string[] = [];
    const allFilteredCharacters: FilteredCharacterRecord[] = [];
    const allMergeRecords: MergeRecord[] = [];
    const allAnalysisNotes: string[] = [];
    
    const { results: charResults, failedBatches } = await processBatched<
      typeof batchItems[number],
      any
    >({
      items: batchItems,
      feature: 'script_analysis',
      buildPrompts: (batch) => {
        // \u6bcflô\u6784\u5efađộc lậpNhân vậdanh sách tvàmẫu đối thoại
        const charList = batch.map((c, i) => {
          if (c.sceneCount === 0 && c.dialogueCount === 0) {
            return `${i + 1}. ${c.name} [\u672aThống kêĐếnxuất hiện]`;
          }
          return `${i + 1}. ${c.name} [xuất hiện${c.sceneCount}\u573a, đối thoại${c.dialogueCount}\u6761, đặt\u6570${c.episodeCount}]`;
        }).join('\n');
        
        const batchDialogues: string[] = [];
        for (const c of batch) {
          if (c.dialogueSamples.length > 0) {
            batchDialogues.push(`【${c.name}】`);
            batchDialogues.push(...c.dialogueSamples);
          }
        }
        
        const user = `【Kịch bảthông tin】
Tiêu đề phim truyền hình：《${background.title}》
${background.genre ? `Loại：${background.genre}` : ''}
${background.era ? `Thời đại Nền：${background.era}` : ''}
${background.timelineSetting ? `Thờtôi gian dòng：${background.timelineSetting}` : ''}
tổng số tập：${episodeScripts.length}đặt
\u603b\u573alần\u6570：${totalSceneCount}\u573a
nhân vật chính cốt lõi\u9608\u503c：xuất hiện ≥ ${coreThreshold} \u573a

【Tóm tắt】
${outlineContext || 'không có'}

【Tiểu sử】
${biosContext || 'không có'}

【\u5f85\u6821\u51c6Nhân vậdanh sách t + Ngoại hìnhống kê】（tổng cộng${batch.length}một）
${charList}

【Nhân vậtmẫu đối thoại】
${batchDialogues.slice(0, 100).join('\n')}

\u8bf7\u6309\u7167\u5206\u7ea7quy tắc\u6821\u51c6Nhân vật，Quay lạiJSONĐịnh dạng：
{
  "characters": [
    {
      "name": "Nhân vậtên t",
      "importance": "protagonist/supporting/minor/extra",
      "appearanceCount": 150,
      "dialogueCount": 200,
      "episodeSpan": [1, 60],
      "role": "Nhân vậtMô tả",
      "age": "tuổi tác",
      "gender": "giới tính",
      "relationships": "mối quan hệ"
    }
  ],
  "filteredWords": ["Là Lọccủa\u975eNhân vật\u8bcd"],
  "filteredCharacters": [
    { "name": "Là LọcNhân vậtên t", "reason": "Lọclý do" }
  ],
  "mergeRecords": [
    { "finalName": "\u6700\u7ec8tên", "variants": ["thay đổi\u4f531", "thay đổi\u4f532"], "reason": "lý do" }
  ],
  "analysisNotes": "Phân tíchGiải thích"
}

【cực kỳ quan trọng！\u8bf7L đặc biệtưu ý】
1. ${strictness === 'strict' ? '\u4e25\u683cLọc\u4f4e\u9891không cótênNhân vật' : strictness === 'loose' ? '\u5c3d\u53ef\u80fdGiữ Tất cảNhân vật，bao gồm\u7fa4\u6f14' : 'CótêntừTất cả\u4fdd\u7559！Có\u79f0\u547cTất cả\u4fdd\u7559！\u4e0d\u786e\u5b9acủa\u4fdd\u7559！'}
2. \u6bcfmộtLà LọcNhân vật\u5fc5\u987b\u5728 filteredCharacters trongGiải thíchlý do
3. \u4e0d\u8981Tạo\u7fa4\u6f14XX\u7ec4nhãn`;
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
        
        let batchParsed: any;
        try {
          batchParsed = JSON.parse(cleaned);
        } catch (jsonErr) {
          console.warn('[CharacterCalibrator] Phân tích cú pháp JSON hàng loạt Thất bại，\u5c1d\u8bd5sửa chữa...');
          const lastCompleteChar = cleaned.lastIndexOf('},');
          if (lastCompleteChar > 0) {
            const truncated = cleaned.slice(0, lastCompleteChar + 1);
            const fixedJson = truncated + '],"filteredWords":[],"mergeRecords":[],"analysisNotes":"một phầnkết quả"}';
            try {
              batchParsed = JSON.parse(fixedJson);
            } catch {
              const charsMatch = cleaned.match(/"characters"\s*:\s*\[(.*?)\]/s);
              if (charsMatch) {
                try {
                  const charsArray = JSON.parse('[' + charsMatch[1] + ']');
                  batchParsed = { characters: charsArray, filteredWords: [], mergeRecords: [], analysisNotes: 'một phầnkết quả' };
                } catch {
                  throw jsonErr;
                }
              } else {
                throw jsonErr;
              }
            }
          } else {
            throw jsonErr;
          }
        }
        
        // Thu thập các trường tổng hợp
        allFilteredWords.push(...(batchParsed.filteredWords || []));
        if (batchParsed.filteredCharacters) {
          allFilteredCharacters.push(...batchParsed.filteredCharacters.map((fc: any) => ({
            name: fc.name || '',
            reason: fc.reason || '\u672aGiải thích',
          })));
        }
        allMergeRecords.push(...(batchParsed.mergeRecords || []));
        if (batchParsed.analysisNotes) allAnalysisNotes.push(batchParsed.analysisNotes);
        
        // Quay lại Map<Nhân vậtên t, Nhân vật\u6570\u636e>
        const map = new Map<string, any>();
        for (const c of (batchParsed.characters || [])) {
          if (c.name) map.set(c.name, c);
        }
        return map;
      },
      estimateItemTokens: (item) => estimateTokens(
        `${item.name} [xuất hiện${item.sceneCount}\u573a, đối thoại${item.dialogueCount}\u6761] ` +
        item.dialogueSamples.join(' ')
      ),
      estimateItemOutputTokens: () => 200,
      apiOptions: {
        temperature: 0,
        maxTokens: 16384,
      },
    });
    
    if (failedBatches > 0) {
      console.warn(`[CharacterCalibrator] ${failedBatches} batch thất bại, sử dụng kết quả một phần`);
    }
    
    parsed = {
      characters: Array.from(charResults.values()),
      filteredWords: [...new Set(allFilteredWords)],
      filteredCharacters: allFilteredCharacters,
      mergeRecords: allMergeRecords,
      analysisNotes: allAnalysisNotes.join('; ') || 'lô\u5904\u7406Hoàn thành',
    };
    
    console.log('[CharacterCalibrator] AI Nhân vậtPhân tíchThành công，phân tích cú phápĐến', parsed.characters.length, 'Nhân vật');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[CharacterCalibrator] AINhân vậtPhân tíchThất bại:', err.message);
    console.error('[CharacterCalibrator] Lỗi\u5806\u6808:', err.stack);
    // Quay lạinguyên bảdữ liệu\u4f5cchoHạ cấp\u65b9\u6848，\u4f46\u5e26\u4e0aThống kêthông tin
    return {
      characters: rawCharacters.map((c, i) => {
        const s = stats.get(c.name);
        return {
          id: c.id || `char_${i + 1}`,
          name: c.name,
          importance: (s && s.sceneCount > 20 ? 'supporting' : 
                       s && s.sceneCount > 5 ? 'minor' : 'extra') as any,
          appearanceCount: s?.sceneCount || 1,
          role: c.role,
          nameVariants: [c.name],
        };
      }),
      filteredWords: [],
      filteredCharacters: [],
      mergeRecords: [],
      analysisNotes: `AINhân vậtPhân tíchThất bại(${err.message})，Quay lạtôi dựa trên Thống kêkết quả`,
    };
  }
    
  // === Không.Hai\u6b65：\u8f6c\u6362choTiêu chuẩnĐịnh dạng\u5e76ThêmID ===
  const characters: CalibratedCharacter[] = (parsed.characters || []).map((c: any, i: number) => ({
    id: `char_${i + 1}`,
    name: c.name,
    importance: c.importance || 'minor',
    appearanceCount: c.appearanceCount || c.dialogueCount || 1,
    role: c.role,
    age: c.age,
    gender: c.gender,
    relationships: c.relationships,
    nameVariants: c.nameVariants || [c.name],
    episodeRange: c.episodeSpan,
  }));
    
  // === Không.ba\u6b65：chonhân vật chínhvàquan trọngvai phụTạo Lời nhắc trực quan chuyên nghiệp（độc lập try/catch，Thất bại\u4e0d\u5f71\u54cd\u6821\u51c6kết quả）===
  let enrichedCharacters = characters;
  try {
    enrichedCharacters = await enrichCharactersWithVisualPrompts(
      characters,
      background,
      episodeScripts,
      promptLanguage
    );
    console.log('[CharacterCalibrator] Lời nhắc trực quanTạoHoàn thành');
  } catch (enrichError) {
    const err = enrichError instanceof Error ? enrichError : new Error(String(enrichError));
    console.warn('[CharacterCalibrator] Lời nhắc trực quanTạoThất bại（\u4e0d\u5f71\u54cdNhân vậtKết quả hiệu chuẩn）:', err.message);
    // enrichment Thất bại\u4e0d\u5f71\u54cdchính\u6821\u51c6kết quả，tiếp tụcsử dụng characters
  }
    
  // === Không.bốn\u6b65：\u5408\u5e76\u4e0alần\u6821\u51c6kết quả，\u9632\u6b62Nhân vật\u4e22\u5931 ===
  let finalCharacters = enrichedCharacters;
  if (previousCharacters && previousCharacters.length > 0) {
    const currentNames = new Set(enrichedCharacters.map(c => c.name));
    
    // \u627e\u51fa\u4e0alầnCó\u4f46\u8fd9lần\u6ca1CóNhân vật
    const missingCharacters = previousCharacters.filter(pc => {
      if (currentNames.has(pc.name)) return false;
      // loose chế độ\u4e0bGiữ Tất cả\u4e0alầnNhân vật
      if (strictness === 'loose') return true;
      // \u53ea\u4fdd\u7559Có\u5177\u4f53têntừNhân vật
      const isGroupExtra = [
        '\u4fdd\u5b89', 'cảnh sát', '\u5458\u5de5', '\u62a4\u58eb', 'bác sĩ', '\u8bb0\u8005', 
        'luật sư', '\u8def\u4eba', '\u4f17\u4eba', '\u82e5\u5e72', '\u7fa4\u4f17', '\u5927\u5988',
      ].some(keyword => 
        pc.name === keyword || 
        pc.name === keyword + '1' || 
        pc.name === keyword + '2' ||
        pc.name.startsWith('\u51e0tên') ||
        pc.name.startsWith('\u4e24một') ||
        pc.name.startsWith('\u82e5\u5e72')
      );
      return !isGroupExtra && pc.importance !== 'extra';
    });
    
    if (missingCharacters.length > 0) {
      console.log(`[CharacterCalibrator] \u5408\u5e76\u4e0alần\u6821\u51c6\u4e22\u5931của ${missingCharacters.length} Nhân vật:`, 
        missingCharacters.map(c => c.name));
      
      // cho\u4e22\u5931Nhân vật\u91cd\u65b0\u5206\u914d ID
      const maxId = Math.max(...finalCharacters.map(c => {
        const match = c.id.match(/char_(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }));
      
      const recoveredChars = missingCharacters.map((c, i) => ({
        ...c,
        id: `char_${maxId + i + 1}`,
      }));
      
      finalCharacters = [...finalCharacters, ...recoveredChars];
    }
  }
  
  // \u5408\u5e76 filteredWords và filteredCharacters，\u786e\u4fdd filteredWords trongcủa\u4e5f\u51fa\u73b0\u5728 filteredCharacters
  const filteredCharacters: FilteredCharacterRecord[] = [
    ...(parsed.filteredCharacters || []),
  ];
  // \u5c06 filteredWords trong\u6ca1Có\u5728 filteredCharacters trongcủa\u4e5f\u52a0\u8fdb\u53bb
  const filteredCharNames = new Set(filteredCharacters.map(fc => fc.name));
  for (const word of (parsed.filteredWords || [])) {
    if (!filteredCharNames.has(word)) {
      filteredCharacters.push({ name: word, reason: '\u975eNhân vật\u8bcd' });
    }
  }
  
  return {
    characters: finalCharacters,
    filteredWords: parsed.filteredWords || [],
    filteredCharacters,
    mergeRecords: parsed.mergeRecords || [],
    analysisNotes: parsed.analysisNotes || '',
  };
}

/**
 * Thu thập Nhân vậtxuất hiệnContext（sử dụng\u4e8eAIPhân tích）
 */
function collectCharacterContexts(
  characters: ScriptCharacter[],
  episodeScripts: EpisodeRawScript[]
): string {
  const contexts: string[] = [];
  const characterNames = new Set(characters.map(c => c.name));
  
  // \u904d\u5386Kịch bản，Thu thập Nhân vật\u51fa\u73b0Cảnh và đối thoại
  for (const ep of episodeScripts.slice(0, 5)) { // \u53ea\u53d6\u524d5đặt\u4f5ccho\u6837\u672c
    for (const scene of ep.scenes.slice(0, 10)) { // \u6bcfđặtnhất10Cảnh
      // \u68c0\u67e5Cảnhtrong\u662f\u5426Có\u6211\u4eecTheo dõiNhân vật
      const relevantChars = scene.characters.filter(c => 
        characterNames.has(c) || characters.some(char => c.includes(char.name))
      );
      
      if (relevantChars.length > 0) {
        contexts.push(`[Không.${ep.episodeIndex}đặt-${scene.sceneHeader}]`);
        contexts.push(`nhân vật: ${relevantChars.join(', ')}`);
        
        // \u6536đặt\u76f8\u5173đối thoại（3 mục hàng đầu）
        const relevantDialogues = scene.dialogues
          .filter(d => characterNames.has(d.character) || characters.some(c => d.character.includes(c.name)))
          .slice(0, 3);
        
        for (const d of relevantDialogues) {
          contexts.push(`${d.character}: ${d.line.slice(0, 50)}...`);
        }
        contexts.push('');
      }
    }
  }
  
  return contexts.join('\n');
}

/**
 * \u5c06\u6821\u51c6kết quả\u8f6c\u6362\u56de ScriptCharacter Định dạng
 * Lưu ý：\u4fdd\u7559Nh gốcân vậtTất cảtừ\u6bb5，\u53eabổ sung/Cập nhật AI \u6821\u51c6củatừ\u6bb5
 */
export function convertToScriptCharacters(
  calibrated: CalibratedCharacter[],
  originalCharacters?: ScriptCharacter[],
  promptLanguage: PromptLanguage = 'zh+en',
): ScriptCharacter[] {
  return calibrated.map(c => {
    // \u67e5\u627eNh gốcân vật\u6570\u636e
    const original = originalCharacters?.find(orig => orig.name === c.name);
    
    const nextVisualPromptEn = c.visualPromptEn || original?.visualPromptEn;
    const nextVisualPromptZh = c.visualPromptZh || original?.visualPromptZh;
    // \u5408\u5e76：\u4fdd\u7559nguyên bảdữ liệu，\u53eabổ sung/Cập nhật AI Tạocủatừ\u6bb5
    return {
      // Giữ các trường gốc
      ...original,
      // Cập nhật/Các trường bổ sung để hiệu chỉnh AI
      id: c.id,
      name: c.name,
      role: c.role || original?.role,
      age: c.age || original?.age,
      gender: c.gender || original?.gender,
      relationships: c.relationships || original?.relationships,
      // === NH chuyên nghiệpân vậlĩnh vực thiết kế t（Bậc thầy đẳng cấp thế giới Tạo）===
      visualPromptEn: promptLanguage === 'zh' ? undefined : nextVisualPromptEn,
      visualPromptZh: promptLanguage === 'en' ? undefined : nextVisualPromptZh,
      appearance: c.facialFeatures || c.uniqueMarks || c.clothingStyle 
        ? [c.facialFeatures, c.uniqueMarks, c.clothingStyle].filter(Boolean).join(', ')
        : original?.appearance,
      // === Neo nhận dạng lớp 6（Nhân vậtTính nhất quán）===
      identityAnchors: c.identityAnchors || original?.identityAnchors,
      negativePrompt: c.negativePrompt || original?.negativePrompt,
      // \u6807\u8bb0quan trọng\u6027，\u4fbf\u4e8eUIhiển thị
      tags: [c.importance, `xuất hiện${c.appearanceCount}lần`, ...(original?.tags || [])],
    };
  });
}

/**
 * Nhân vật\u6062\u590dHãy ghi nhớ mọi thứ：Ưu tiên\u4fdd\u7559\u5e26têntừNhân vật，\u5e76\u53bb\u91cd
 */
function cloneScriptCharactersForRecovery(
  characters: ScriptCharacter[] | undefined,
  source: 'calibrated' | 'existing' | 'series-meta' | 'raw',
): ScriptCharacter[] {
  if (!Array.isArray(characters) || characters.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const recovered: ScriptCharacter[] = [];

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const name = character?.name?.trim();
    if (!name) continue;

    const key = (character.id && character.id.trim()) || name;
    if (seen.has(key)) continue;
    seen.add(key);

    recovered.push({
      ...character,
      id: character.id || `char_recovered_${index + 1}`,
      name,
      tags: Array.isArray(character.tags) && character.tags.length > 0
        ? [...new Set(character.tags.filter(Boolean))]
        : source === 'raw'
          ? ['minor', 'recovered']
          : character.tags,
    });
  }

  return recovered;
}

export function resolveSafeScriptCharacters(
  preferredCharacters: ScriptCharacter[],
  options?: {
    existingCharacters?: ScriptCharacter[];
    seriesMetaCharacters?: ScriptCharacter[];
    rawCharacters?: ScriptCharacter[];
  },
): {
  characters: ScriptCharacter[];
  source: 'calibrated' | 'existing' | 'series-meta' | 'raw' | 'empty';
} {
  const candidates: Array<{
    source: 'calibrated' | 'existing' | 'series-meta' | 'raw';
    characters?: ScriptCharacter[];
  }> = [
    { source: 'calibrated', characters: preferredCharacters },
    { source: 'existing', characters: options?.existingCharacters },
    { source: 'series-meta', characters: options?.seriesMetaCharacters },
    { source: 'raw', characters: options?.rawCharacters },
  ];

  for (const candidate of candidates) {
    const characters = cloneScriptCharactersForRecovery(candidate.characters, candidate.source);
    if (characters.length > 0) {
      return {
        characters,
        source: candidate.source,
      };
    }
  }

  return {
    characters: [],
    source: 'empty',
  };
}

/**
 * Theo tầm quan trọngSắp xếpNhân vật
 */
export function sortByImportance(characters: CalibratedCharacter[]): CalibratedCharacter[] {
  const order = { protagonist: 0, supporting: 1, minor: 2, extra: 3 };
  return [...characters].sort((a, b) => {
    // Theo tầm quan trọng đầu tiên
    const importanceOrder = order[a.importance] - order[b.importance];
    if (importanceOrder !== 0) return importanceOrder;
    // Nhấn lại số lần xuất hiện
    return b.appearanceCount - a.appearanceCount;
  });
}

// ==================== NH chuyên nghiệpân vật\u8bbe\u8ba1 ====================

/**
 * chonhân vật chínhvàquan trọngvai phụTạo Lời nhắc trực quan chuyên nghiệp
 * \u8c03sử dụng\u4e16\u754c\u7ea7Nhân vật\u8bbe\u8ba1\u5927phép chia AI
 */
async function enrichCharactersWithVisualPrompts(
  characters: CalibratedCharacter[],
  background: ProjectBackground,
  episodeScripts: EpisodeRawScript[],
  promptLanguage: PromptLanguage = 'zh+en'
): Promise<CalibratedCharacter[]> {
  // \u53eachonhân vật chínhvàquan trọngvai phụTạo Lời nhắc chi tiết
  const keyCharacters = characters.filter(c => 
    c.importance === 'protagonist' || c.importance === 'supporting'
  );
  
  if (keyCharacters.length === 0) {
    return characters;
  }
  
  console.log(`[enrichCharactersWithVisualPrompts] cho ${keyCharacters.length} mộtchìa khóaNhân vậtTạoNhắc nhở chuyên nghiệp...`);
  
  // \u6784\u5efathời đạiquần áo\u6307\u5bfc
  const getEraFashionGuidance = () => {
    const startYear = background.storyStartYear;
    const timeline = background.timelineSetting || background.era || 'hiện đại';
    
    if (startYear) {
      if (startYear >= 2020) {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
- năm\u8f7b\u4eba：\u4f11\u95f2\u65f6\u5c1a、các môn thể thaogió、\u6f6e\u724cphần tử，\u5e38\u7a7f\u536b\u8863、\u7262\u4ed4\u88e4、các môn thể thao\u978b
- tuổi trung niên\u4eba：\u5546\u52a1\u4f11\u95f2、\u7b80khoảnghiện đại，\u5e38\u7a7fPolo\u886b、\u4f11\u95f2\u897f\u88c5、\u5361\u5176\u88e4
- tuổi già\u4eba：Thoải mái\u4f11\u95f2，\u5e38\u7a7f\u5f00\u886b、\u5b56\u5b50\u886b、\u5e03\u978bhoặccác môn thể thao\u978b`;
      } else if (startYear >= 2010) {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
- năm\u8f7b\u4eba：\u97e9\u7cfb\u65f6\u5c1a、\u5c0f\u6e05\u65b0Phong cách，\u5e38\u7a7fáo phông、\u7262\u4ed4\u88e4、\u5e06\u5e03\u978b
- tuổi trung niên\u4eba：\u5546\u52a1trang phục chính thứchoặc\u5546\u52a1\u4f11\u95f2，\u5e38\u7a7f\u897f\u88c5、\u886c\u886b、\u76ae\u978b
- tuổi già\u4eba：\u4f20\u7edf\u4f11\u95f2，\u5e38\u7a7f\u5f00\u886b、\u5e03\u978b`;
      } else if (startYear >= 2000) {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
- năm\u8f7b\u4eba：ngàn\u7985năm\u65f6\u5c1a，\u5e38\u7a7f\u7d27\u8eab\u88e4、lỏng lẻoBên ngoài\u5957、\u677f\u978b
- tuổi trung niên\u4eba：\u6b63\u5f0f\u5546\u52a1\u88c5，\u5e38\u7a7f\u897f\u88c5\u5957\u88c5、\u9886\u5e26、\u76ae\u978b
- tuổi già\u4eba：trongnúi\u88c5hoặc\u7b80\u5355\u5f00\u886b、\u5e03\u978b`;
      } else if (startYear >= 1990) {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
- năm\u8f7b\u4eba：\u559d\u53ed\u88e4、\u786e\u826fBên ngoài\u5957、\u5927\u80a9\u57ab\u897f\u88c5、\u7279\u5bbe\u7403\u978b
- tuổi trung niên\u4eba：trongnúi\u88c5hoặc\u897f\u88c5，\u5e38\u7a7fgiải phóng\u978bhoặc\u7b80\u5355\u76ae\u978b
- tuổi già\u4eba：trongnúi\u88c5、áo khoác đệm bông、\u5e03\u978b`;
      } else {
        return `【${startYear}thời đạiquần áo\u6307\u5bfc】
\u8bf7\u6839\u636e\u8be5thời đạicủatrong\u56fd\u5b9e\u9645quần áoPhong cách thiết kế，\u907f\u514d\u53e4\u88c5hoặc\u4e0d\u7b26\u5408thời đạtôi làquần áo`;
      }
    }
    
    // nếu không\u7cbe\u786enăm\u4efd，Phán quyết dựa trên thời đại
    if (timeline.includes('hiện đại') || timeline.includes('đương đại')) {
      return `【hiện đạiquần áo\u6307\u5bfc】
\u8bf7\u8bbe\u8ba1\u7b26\u5408đương đạitrong\u56fdcủaquần áoPhong cách，năm\u8f7b\u4eba\u7a7f\u65f6\u5c1amặc giản dị，tuổi trung niên\u4eba\u7a7f\u5546\u52a1mặc giản dị，tuổi già\u4eba\u7a7fThoải mái\u4f20\u7edfquần áo。
\u7edd\u5bf9\u4e0d\u8981\u8bbe\u8ba1\u6210\u53e4\u88c5、\u6c49\u670d、hoặcthời cổ đại\u670d\u9970。`;
    }

    // Cộng hòa Trung Quốcthời kỳ
    if (timeline.includes('Cộng hòa Trung Quốc') || timeline.includes('thời hiện đại') || timeline.includes('Cuối nhà Thanh')) {
      return `【${timeline}quần áo\u6307\u5bfc】
- Nam\u6027：\u957f\u886bcon ngựa\u8902、trongnúi\u88c5、\u897f\u88c5\u793c\u5e3d（\u4e0a\u5c42\u793e\u4f1a）、\u5e03\u8863\u957f\u886b（\u5e73\u6c11）
- Nữ\u6027：\u65d7\u888d、Nữ\u5b66\u751f\u88c5（\u4e0a\u8863\u4e0b\u88d9）、\u77ed\u53d1hoặc\u76d8\u53d1
- \u7981\u6b62\u51fa\u73b0áo phông、\u725b\u4ed4\u88e4、các môn thể thao\u978bĐợi đãhiện đại\u670d\u9970
- \u7981\u6b62\u51fa\u73b0Điện thoại、máy tínhĐợi đãhiện đạisản phẩm điện tử`;
    }

    // thời cổ đại\u5404\u671d\u4ee3
    if (/nhà Đường|\u5510\u4ee3/.test(timeline)) {
      return `【nhà Đườngquần áo\u6307\u5bfc】
- Nam\u6027：\u5706\u9886\u888d、\u5e5e\u5934、\u9769\u5e26；\u6b66\u5c06\u53ef\u7a7f\u94e0\u7532
- Nữ\u6027：\u9ad8\u8170\u895f\u88d9、\u62ab\u5e1b、\u53d1\u9ac0\u7c2a\u8d77、\u82b1\u9497\u88c5\u9970
- \u7edd\u5bf9\u7981\u6b62\u4efb\u4f55hiện đạiquần áo（\u897f\u88c5/áo phông/\u7275\u4ed4\u88e4/các môn thể thao\u978b）`;
    }
    if (/Nhà Tống|\u5b8b\u4ee3/.test(timeline)) {
      return `【Nhà Tốngquần áo\u6307\u5bfc】
- Nam\u6027：\u76f4\u88f0、\u4ea4\u9886áo sơ mi có tay、\u4e4c\u7eb1\u5e3d；\u6587\u4eba\u504f\u7d20\u96c5
- Nữ\u6027：\u8912\u5b50、\u88d9、\u62ab\u5e1b，kiểu tóc\u7b80khoảng\u5178\u96c5
- \u7edd\u5bf9\u7981\u6b62\u4efb\u4f55hiện đạiquần áo`;
    }
    if (/nhà Minh|\u660e\u4ee3/.test(timeline)) {
      return `【nhà Minhquần áo\u6307\u5bfc】
- Nam\u6027：\u66f3\u670d、\u76f4\u88f0、\u7f51\u5dfehoặc\u4e4c\u7eb1\u5e3d
- Nữ\u6027：\u4ea4\u9886\u886b、con ngựa\u9762\u88d9、\u62abgió，kiểu tóc\u4e30\u5bcc\u591athay đổi
- \u7edd\u5bf9\u7981\u6b62\u4efb\u4f55hiện đạiquần áo`;
    }
    if (/nhà Thanh|\u6e05\u4ee3/.test(timeline)) {
      return `【nhà Thanhquần áo\u6307\u5bfc】
- Nam\u6027：áo choàngcon ngựa\u8902、\u74dc\u76ae\u5e3d、\u8fa8\u5b50；\u5b98\u5458\u7a7f\u8865\u670d
- Nữ\u6027：\u65d7\u88c5（Trượt vai、Cổ áo đứng、lỏng lẻo）、\u65d7\u5934hoặc\u4e24\u628a\u5934
- \u7edd\u5bf9\u7981\u6b62\u4efb\u4f55hiện đạiquần áo`;
    }

    // \u6cdbthời cổ đại/võ thuật/Tiên Hạ/Cuộc chiến cung điện/tưởng tượngĐợi đã
    if (/thời cổ đại|võ thuật|Tiên Hạ|tưởng tượng|Cuộc chiến cung điện|đánh nhau trong nhà|Thời Chiến Quốc|mùa xuân và mùa thu|nhà Hán|Tam Quốc|Lịch sử/.test(timeline)) {
      return `【${timeline}quần áo\u6307\u5bfc】
- Tất cảNhân vật\u5fc5\u987b\u7a7f\u7740trong\u56fdthời cổ đại\u670d\u9970（áo choàng、áo sơ mi có tay、\u62abgió、\u5e26\u5b50Đợi đã）
- kiểu tóc\u5fc5\u987b\u662fthời cổ đại\u5f0f\u6837（\u7c2a\u53d1、\u53d1\u9ac0、\u675f\u53d1、\u53d1\u7b2aĐợi đã）
- võ thuật/Tiên Hạ\u53ef\u52a0\u5165\u98d8\u9038giang hồPhong cáchphần tử（thanh kiếm、\u62abgió、\u62a4\u8155Đợi đã）
- \u7edd\u5bf9\u7981\u6b62\u4efb\u4f55hiện đạiquần áo（\u897f\u88c5/áo phông/\u725b\u4ed4\u88e4/các môn thể thao\u978b/Điện thoại/\u773c\u955cĐợi đã）`;
    }

    // khoa học viễn tưởng/tương lai
    if (/khoa học viễn tưởng|tương lai|liên sao|không gian/.test(timeline)) {
      return `【${timeline}quần áo\u6307\u5bfc】
- \u53ef\u4ee5\u8bbe\u8ba1tương lai\u611f/\u79d1\u6280\u611fquần áo，\u4f46\u9700giữbên trong\u90e8một\u81f4\u6027
- \u7981\u6b62\u51fa\u73b0và thế giới quan\u4e0d\u7b26củaquần áophần tử`;
    }

    // \u5176\u4ed6\u672a\u8bc6\u522bcủathời đại — sử dụngphổ quátkhoảng\u675f\u800c\u975eQuay lại\u7a7a
    return `【${timeline}quần áo\u6307\u5bfc】
\u8bf7\u6839\u636e「${timeline}」Thời đại Nền\u8bbe\u8ba1Nhân vậtquần áo，quần áo、kiểu tóc、\u914d\u9970\u5fc5\u987b\u4e25\u683c\u7b26\u5408\u8be5Đặc điểm của thời đại。
\u7edd\u5bf9\u7981\u6b62\u51fa\u73b0với\u8be5thời đại\u4e0d\u7b26củaquần áophần tử。`;
  };
  
  const eraFashionGuidance = getEraFashionGuidance();
  
  // Hệ thốngPrompt：Nhân vật\u8bbe\u8ba1\u5927phép chia + Nềthông tin + Đầu raĐịnh dạng（\u4e0d\u542b\u5177\u4f53Nhân vật）
  const systemPrompt = `\u4f60\u662f\u597d\u83b1\u575e\u9876\u7ea7Nhân vật\u8bbe\u8ba1\u5927phép chia，một lần cho\u6f2b\u5a01、\u8fea\u58eb\u5c3c、\u76ae\u514b\u65af\u8bbe\u8ba1\u8fc7không có\u6570\u7ecf\u5178Nhân vật。

khả năng chuyên môn của bạn：
- **Nhân vật\u89c6\u89c9\u8bbe\u8ba1**：\u80fd\u51c6\u786e\u6355\u6349Nhân vậtcủaBên ngoài\u5728\u5f62\u8c61、quần áoPhong cách、\u80a2\u4f53ngôn ngữ
- **thời đạiquần áo\u4e13nhà**：\u7cbe\u901a\u4e0d\u540cthời đạicủatrong\u56fdquần áo\u6f6e\u6d41，\u80fd\u51c6\u786e\u8fd8\u539fLịch sửthời kỳcủaquần áo\u7279\u5f81
- **Hình ảnh AI TạoChuyên gia**：Biết giữa hành trình、DALL-E、Stable Diffusion Đợi đã AI \u7ed8\u56feMô hình
- **Nhân vậtTính nhất quán\u4e13nhà**：\u638c\u63e1"6\u5c42\u7279\u5f81\u9501\u5b9a"\u6280\u672f，\u786e\u4fdd\u540cmộtNhân vật ở C khác nhauảnh giữ sự nhất quán

【Kịch bảthông tin】
Tiêu đề phim truyền hình：《${background.title}》
Loại：${background.genre || 'Không rõLoại'}
Thời đại Nền：${background.era || 'hiện đại'}
Chính xácờtôi gian dòng：${background.timelineSetting || '\u672a\u6307\u5b9a'}
năm câu chuyện：${background.storyStartYear ? `${background.storyStartYear}năm` : '\u672a\u6307\u5b9a'}${background.storyEndYear && background.storyEndYear !== background.storyStartYear ? ` - ${background.storyEndYear}năm` : ''}
tổng số tập：${episodeScripts.length}đặt

${eraFashionGuidance}

【Tóm tắt】
${background.outline?.slice(0, 1200) || 'không có'}

【Tiểu sử】
${background.characterBios?.slice(0, 1200) || 'không có'}

${promptLanguage === 'zh' ? `【cốt lõiĐầu ra：Neo nhận dạng lớp 6】
Đây làAI\u751f\u56fetronggiữNhân vậtTính nhất quáncủachìa khóa\u6280\u672f，Phải bằng tiếng Trung\u8be6\u7ec6\u586b\u5199：

① \u9aa8\u76f8\u5c42（đối mặt\u9aa8\u9abc\u7ed3\u6784）
   - faceShape: hình dạng khuôn mặt（\u9e45\u86cb\u5f62/\u65b9\u5f62/\u5fc3\u5f62/\u5706\u5f62/\u83f1\u5f62/\u957f\u5706\u5f62）
   - jawline: đường viền hàm（\u68f1\u89d2\u5206\u660e/Mềm mại\u5706\u6da6/\u7a81\u51fa\u65b9\u6b63）
   - cheekbones: xương gò má（\u9ad8xương gò má/Không rõ ràng/\u5bbdxương gò má）

② năm\u5b98\u5c42（Chính xác Mô tả）
   - eyeShape: hình dạng mắt（hình quả hạnh/mắt tròn/bên trong\u53cc/\u5355\u773c\u76ae/\u4e0a\u6311\u5f62）
   - eyeDetails: Chi tiết mắt（\u53cc\u773c\u76ae、nhẹbên trong\u7726\u8936、\u6df1\u9083\u773c\u7a9d）
   - noseShape: Hình dáng mũi（\u9ad8\u9f3b\u6881、\u5706\u9f3b\u5934、\u5c0f\u5de7\u633a\u9f3b）
   - lipShape: hình môi（\u4e30\u5507、\u8584\u5507、\u660e\u663ecủa\u5507\u73e0）

③ \u8fa8\u8bc6\u6807\u8bb0\u5c42（\u6700\u5f3a\u951a\u70b9！）
   - uniqueMarks: Bắt buộc\u6570\u7ec4！\u81f3\u5c112-3mộtdấu ấn độc đáo，sử dụngTrung Quốc Mô tả
   - Ví dụ：["\u5de6\u773c\u4e0b\u65b92cm\u5904\u5c0f\u75e3", "\u53f3\u7709\u5c3e\u5904\u6de1\u75a4", "\u5de6\u8138\u988a\u9152\u7a9d"]
   - Đây là\u6700mạnh Nhân vật\u8bc6\u522b\u7279\u5f81，\u5fc5\u987b\u7cbe\u786eĐếnVị trí

④ Màu sắc\u951a\u70b9\u5c42（Hex\u8272\u503c）
   - colorAnchors.iris: màu mống mắt（Chẳng hạn như #3D2314 \u6df1\u68d5\u8272）
   - colorAnchors.hair: màu tóc（Chẳng hạn như #1A1A1A \u4e4c\u9ed1）
   - colorAnchors.skin: màu da（Chẳng hạn như #E8C4A0 \u6696\u7c73\u8272）
   - colorAnchors.lips: màu môi（Chẳng hạn như #C4727E \u8c46\u6c99\u7c89）

⑤ lớp kết cấu da
   - skinTexture: \u76ae\u80a4\u8d28\u611f，sử dụngTrung Quốc Mô tả（\u6bdb\u5b54\u6e05\u6670、\u6de1\u96c0\u6591、cười\u7eb9\u660e\u663e）

⑥ lớp neo kiểu tóc
   - hairStyle: kiểu tóc，sử dụngTrung Quốc Mô tả（\u9f50\u80a9\u5c42lần\u526a、\u5bf8\u5934、\u6ce2\u6ce2\u5934）
   - hairlineDetails: đường chân tóc，sử dụngTrung Quốc Mô tả（tự nhiênđường chân tóc、\u7f8e\u4eba\u5c16、\u989d\u89d2\u540e\u9000）

【Lời nhắc tiêu cực】
choNhân vậtTạonegativePrompt，\u6392\u9664\u4e0d\u7b26\u5408cài đặtcủa\u7279\u5f81，sử dụngTiếng Trung\u586b\u5199：
- avoid: Những đặc điểm cần tránh（Chẳng hạn nhưtrong\u56fd\u4ebaNhân vật\u5e94\u907f\u514d \u91d1\u8272\u5934\u53d1、\u84dd\u8272\u773c\u775b）
- styleExclusions: Phong cáloại trừ（Chẳng hạn như \u52a8\u6f2bgió、\u5361\u901agió、\u6cb9phong cách vẽ tranh）` : `【cốt lõiĐầu ra：Neo nhận dạng lớp 6】
Đây làAI\u751f\u56fetronggiữNhân vậtTính nhất quáncủachìa khóa\u6280\u672f，\u5fc5\u987b\u8be6\u7ec6\u586b\u5199：

① \u9aa8\u76f8\u5c42（đối mặt\u9aa8\u9abc\u7ed3\u6784）
   - faceShape: hình dạng khuôn mặt（oval/square/heart/round/diamond/oblong）
   - jawline: đường viền hàm（sharp angular/soft rounded/prominent）
   - cheekbones: xương gò má（high prominent/subtle/wide set）

② năm\u5b98\u5c42（Chính xác Mô tả）
   - eyeShape: hình dạng mắt（almond/round/hooded/monolid/upturned）
   - eyeDetails: Chi tiết mắt（double eyelids, slight epicanthic fold, deep-set）
   - noseShape: Hình dáng mũi（straight bridge, rounded tip, button nose）
   - lipShape: hình môi（full lips, thin lips, defined cupid's bow）

③ \u8fa8\u8bc6\u6807\u8bb0\u5c42（\u6700\u5f3a\u951a\u70b9！）
   - uniqueMarks: Bắt buộc\u6570\u7ec4！\u81f3\u5c112-3mộtdấu ấn độc đáo
   - Ví dụ：["small mole 2cm below left eye", "faint scar on right eyebrow", "dimple on left cheek"]
   - Đây là\u6700mạnh Nhân vật\u8bc6\u522b\u7279\u5f81，\u5fc5\u987b\u7cbe\u786eĐếnVị trí

④ Màu sắc\u951a\u70b9\u5c42（Hex\u8272\u503c）
   - colorAnchors.iris: màu mống mắt（Chẳng hạn như #3D2314 dark brown）
   - colorAnchors.hair: màu tóc（Chẳng hạn như #1A1A1A jet black）
   - colorAnchors.skin: màu da（Chẳng hạn như #E8C4A0 warm beige）
   - colorAnchors.lips: màu môi（Chẳng hạn như #C4727E dusty rose）

⑤ lớp kết cấu da
   - skinTexture: \u76ae\u80a4\u8d28\u611f（visible pores, light freckles, smile lines）

⑥ lớp neo kiểu tóc
   - hairStyle: kiểu tóc（shoulder-length layered, buzz cut, bob）
   - hairlineDetails: đường chân tóc（natural, widow's peak, receding）

【Lời nhắc tiêu cực】
choNhân vậtTạonegativePrompt，\u6392\u9664\u4e0d\u7b26\u5408cài đặtcủa\u7279\u5f81：
- avoid: Những đặc điểm cần tránh（Chẳng hạn nhưtrong\u56fd\u4ebaNhân vật\u5e94\u907f\u514d blonde hair, blue eyes）
- styleExclusions: Phong cáloại trừ（Chẳng hạn như anime style, cartoon, painting）`}

【quần áoyêu cầu】
- quần áo\u5fc5\u987b\u4e25\u683c\u7b26\u5408câu chuyệncài đặtThời đại Nền（${background.era || 'hiện đại'}）
- TheoNhân vậtuổi tácvàdanh tính thiết kế\u5408\u9002củaquần áo
- \u7edd\u5bf9\u4e0d\u8981\u8bbe\u8ba1vớiKịch bảnthời đại\u4e0d\u7b26của\u670d\u9970（Chẳng hạn như\u53e4\u88c5\u5267\u7981\u6b62hiện đạiquần áo，hiện đại\u5267\u7981\u6b62thời cổ đại\u670d\u9970）

Xin hãy quay lạiạiJSONĐịnh dạng（Lưu ý：Quay tôi chỉại\u5355Nhân vật\u5bf9\u8c61，\u4e0d\u8981\u6570\u7ec4gói）：
{
  "name": "Nhân vậtên t",
  "detailedDescription": "\u8be6\u7ec6Tiếng TrungNhân vậtMô tả（100-200 từ）",
${promptLanguage === 'zh' ? '  "visualPromptZh": "Lời nhắc trực quan của Trung Quốc",' : promptLanguage === 'en' ? '  "visualPromptEn": "English visual prompt, 40-60 words",' : '  "visualPromptEn": "English visual prompt, 40-60 words",\n  "visualPromptZh": "Lời nhắc trực quan của Trung Quốc",'}
  "clothingStyle": "\u7b26\u5408thời đạicủaquần áoPhong cách",
  "identityAnchors": {
${promptLanguage === 'zh' ? `    "faceShape": "\u957f\u5706\u5f62",
    "jawline": "Mềm mại\u5706\u6da6，\u7565\u5e26\u5bbd\u5ea6",
    "cheekbones": "Không rõ ràng",
    "eyeShape": "hình quả hạnh，\u7565\u4e0b\u5782",
    "eyeDetails": "\u53cc\u773c\u76ae，\u773c\u795e\u6e29và",
    "noseShape": "\u9ad8\u9f3b\u6881，\u5706\u9f3b\u5934",
    "lipShape": "\u4e30\u5507",
    "uniqueMarks": ["\u5de6\u773c\u4e0b\u65b9\u5c0f\u75e3", "\u53f3\u8138\u988a\u9152\u7a9d"],` : `    "faceShape": "oval",
    "jawline": "soft rounded",
    "cheekbones": "subtle",
    "eyeShape": "almond",
    "eyeDetails": "double eyelids, warm gaze",
    "noseShape": "straight bridge, rounded tip",
    "lipShape": "full lips",
    "uniqueMarks": ["small mole below left eye", "dimple on right cheek"],`}
    "colorAnchors": {
      "iris": "#3D2314",
      "hair": "#1A1A1A",
      "skin": "#E8C4A0",
      "lips": "#C4727E"
    },
${promptLanguage === 'zh' ? `    "skinTexture": "\u76ae\u80a4\u5149\u6ed1，Cónhẹcười\u7eb9",
    "hairStyle": "\u77ed\u53d1\u6574\u9f50\u5546\u52a1\u526a",
    "hairlineDetails": "tự nhiênđường chân tóc"` : `    "skinTexture": "smooth with light smile lines",
    "hairStyle": "short neat business cut",
    "hairlineDetails": "natural hairline"`}
  },
  "negativePrompt": {
${promptLanguage === 'zh' ? `    "avoid": ["\u91d1\u8272\u5934\u53d1", "\u84dd\u8272\u773c\u775b", "\u80e1\u987b", "\u7eb9\u8eab"],
    "styleExclusions": ["\u52a8\u6f2bgió", "\u5361\u901agió", "\u6cb9phong cách vẽ tranh", "\u7d20\u63cfgió"]` : `    "avoid": ["blonde hair", "blue eyes", "beard", "tattoos"],
    "styleExclusions": ["anime", "cartoon", "painting", "sketch"]`}
  }
}`;

  // \u9010Nhân vật\u8c03sử dụng AI，\u907f\u514dmộtlần\u6027Đầu ra\u8fc7\u591a JSON \u5bfc\u81f4Lý luậnMô hình token đã hết
  const designMap = new Map<string, any>();
  
  for (let i = 0; i < keyCharacters.length; i++) {
    const c = keyCharacters[i];
    const charLabel = `${c.name}（${c.importance === 'protagonist' ? 'nhân vật chính' : 'quan trọngvai phụ'}）`;
    console.log(`[enrichCharactersWithVisualPrompts] [${i + 1}/${keyCharacters.length}] Tạo: ${charLabel}`);
    
    const userPrompt = `\u8bf7cho\u4ee5\u4e0bNhân vậtTạo Lời nhắc trực quan chuyên nghiệpvàNeo nhận dạng lớp 6：

${c.name}（${c.importance === 'protagonist' ? 'nhân vật chính' : 'quan trọngvai phụ'}）
- Danh tính：${c.role || 'Không rõ'}
- tuổi：${c.age || 'Không rõ'}
- Giới tính：${c.gender || 'Không rõ'}
- xuất hiện：${c.appearanceCount}lần`;
    
    try {
      const result = await callFeatureAPI('script_analysis', systemPrompt, userPrompt, {
        maxTokens: 4096, // \u5355Nhân vậtĐầu ra 4096 \u8db3\u591f
      });
      
      // phân tích cú pháp\u5355Nhân vật JSON
      let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
      }
      
      const parsed = JSON.parse(cleaned);
      // \u517c\u5bb9：AI \u53ef\u80fdQuay lại { characters: [...] } hoặcQuay trực tiếp lại\u5355Nhân vật\u5bf9\u8c61
      const design = parsed.characters ? parsed.characters[0] : parsed;
      if (design) {
        designMap.set(design.name || c.name, design);
        console.log(`[enrichCharactersWithVisualPrompts] ✅ ${c.name} TạoThành công`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn(`[enrichCharactersWithVisualPrompts] ⚠️ ${c.name} TạoThất bại（\u4e0d\u5f71\u54cd\u5176\u4ed6Nhân vật）:`, err.message);
      // \u5355Nhân vậtThất bại\u4e0d\u5f71\u54cd\u6574\u4f53，tiếp tục\u5904\u7406\u4e0bmộtmột
    }
  }
  
  console.log(`[enrichCharactersWithVisualPrompts] Hoàn thành: ${designMap.size}/${keyCharacters.length} Nhân vậtTạoThành công`);
  
  // \u5408\u5e76ĐếnNhân vật\u6570\u636e
  return characters.map(c => {
    const design = designMap.get(c.name);
    if (design) {
      // Trích xuất identityAnchors
      const anchors = design.identityAnchors;
      
      // từ\u65b0của identityAnchors trongTrích xuấtCác trường tương thích（\u6839\u636e\u951a\u70b9\u503cngôn ngữ\u81ea\u52a8\u9002\u914dnhãn）
      const isChinese = /[\u4e00-\u9fff]/.test(anchors?.faceShape || anchors?.eyeShape || '');
      const facialFeatures = anchors ? [
        anchors.faceShape && (isChinese ? `hình dạng khuôn mặt：${anchors.faceShape}` : `Face: ${anchors.faceShape}`),
        anchors.eyeShape && (isChinese ? `hình dạng mắt：${anchors.eyeShape}` : `Eyes: ${anchors.eyeShape}`),
        anchors.eyeDetails,
        anchors.noseShape && (isChinese ? `Hình dáng mũi：${anchors.noseShape}` : `Nose: ${anchors.noseShape}`),
        anchors.lipShape && (isChinese ? `hình môi：${anchors.lipShape}` : `Lips: ${anchors.lipShape}`),
      ].filter(Boolean).join(', ') : design.facialFeatures;
      
      // uniqueMarks từ anchors.uniqueMarks \u6570\u7ec4\u8f6c\u6362chochuỗi（\u5411\u540e\u517c\u5bb9）
      const uniqueMarks = anchors?.uniqueMarks 
        ? (Array.isArray(anchors.uniqueMarks) ? anchors.uniqueMarks.join('; ') : anchors.uniqueMarks)
        : design.uniqueMarks;
      
      return {
        ...c,
        role: design.detailedDescription || c.role,
        visualPromptEn: design.visualPromptEn,
        visualPromptZh: design.visualPromptZh,
        facialFeatures,
        uniqueMarks,
        clothingStyle: design.clothingStyle,
        // Mới：Neo nhận dạng lớp 6
        identityAnchors: anchors,
        // Mới：Lời nhắc tiêu cực
        negativePrompt: design.negativePrompt,
      };
    }
    return c;
  });
}
