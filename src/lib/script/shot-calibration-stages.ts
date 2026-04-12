// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Giai đoạn 5Phân cảmô-đun hiệu chuẩn nh
 * 
 * Chia hơn 30 trường thành 5 cuộc gọi AI độc lập，Tránh lý luậnMô hình token đã hết
 * 
 * Giai đoạn 1: Khung tường thuật (9 trường) — Cỡ cảnh/các môn thể thao/Thời lượng + tường thuật Phân tích
 * Giai đoạn 2: VisionMô tả (6 fields) — Tiếng Trung và tiếng Anh Mô tả + Nhân vật + Âm thanh
 * Giai đoạn 3: Điều khiển bắn súng (15 trường) — đèn/độ sâu trường ảnh/Thiết bị/góc/Tiêu cự v.v.
 * Giai đoạn 4: Lời nhắc khung đầu tiên (3 trường) — imagePrompt + needsEndFrame
 * Giai đoạn 5: Động + khung cuối cùng Nhắc (4 trường) — videoPrompt + endFramePrompt
 */

import type { PromptLanguage } from '@/types/script';
import { processBatched } from '@/lib/ai/batch-processor';
import { getStyleDescription, getMediaType } from '@/lib/constants/visual-styles';
import { buildCinematographyGuidance } from '@/lib/constants/cinematography-profiles';
import { getMediaTypeGuidance } from '@/lib/generation/media-type-tokens';
import { useScriptStore } from '@/stores/script-store';
import { buildSeriesContextSummary } from './series-meta-sync';

export interface ShotInputData {
  shotId: string;
  sourceText: string;
  actionSummary: string;
  dialogue?: string;
  characterNames?: string[];
  sceneLocation: string;
  sceneAtmosphere: string;
  sceneTime: string;
  sceneWeather?: string;
  architectureStyle?: string;
  colorPalette?: string;
  eraDetails?: string;
  lightingDesign?: string;
  currentShotSize?: string;
  currentCameraMovement?: string;
  currentDuration?: number;
}

export interface GlobalContext {
  title: string;
  genre?: string;
  era?: string;
  outline: string;
  characterBios: string;
  worldSetting?: string;
  themes?: string[];
  episodeTitle: string;
  episodeSynopsis?: string;
  episodeKeyEvents?: string[];
  episodeRawContent?: string;
  episodeSeason?: string;
  totalEpisodes?: number;
  currentEpisode?: number;
  /** Tóm tắt theo ngữ cảnh ở cấp độ kịch（Bởi buildSeriesContextSummary Tạo） */
  seriesContextSummary?: string;
}

export interface CalibrationOptions {
  styleId?: string;
  cinematographyProfileId?: string;
  promptLanguage?: PromptLanguage;
}

/**
 * Giai đoạn 5Phân cảnh hiệu chuẩn chức năng chính
 */
export async function calibrateShotsMultiStage(
  shots: ShotInputData[],
  options: CalibrationOptions,
  globalContext: GlobalContext,
  onStageProgress?: (stage: number, totalStages: number, stageName: string) => void
): Promise<Record<string, any>> {
  const { styleId, cinematographyProfileId, promptLanguage = 'zh+en' } = options;
  const {
    title, genre, era, episodeTitle, episodeSynopsis, episodeKeyEvents,
    totalEpisodes, currentEpisode, episodeSeason,
    outline, worldSetting, themes, characterBios
  } = globalContext;

  const styleDesc = getStyleDescription(styleId || 'cinematic');
  const cinematographyGuidance = cinematographyProfileId
    ? buildCinematographyGuidance(cinematographyProfileId)
    : '';
  const contextLine = [
    `《${title}》`, genre || '', era || '',
    totalEpisodes ? `tổng cộng${totalEpisodes}đặt` : '',
    `Không.${currentEpisode}đặt「${episodeTitle}」`,
    episodeSeason || '',
  ].filter(Boolean).join(' | ');

  // Tóm tắt theo ngữ cảnh ở cấp độ kịch：từ SeriesMeta
  const seriesCtx = globalContext.seriesContextSummary || '';

  // mỏ neo tường thuật：Cốt lõi câu chuyện + thế giới quan + xung đột cốt lõi（Cắt ngắn để tránh quá dài）
  const narrativeAnchorParts = [
    seriesCtx ? `【Kiến thức cấp độ kịch】\n${seriesCtx}` : '',
    outline ? `【Cốt lõi câu chuyện】\n${outline.slice(0, 600)}` : '',
    worldSetting ? `【thế giới quan/quy tắc】\n${worldSetting.slice(0, 400)}` : '',
    themes?.length ? `【cốt lõichủ đề】${themes.join('、')}` : '',
    characterBios ? `【nhân vật chính】\n${characterBios.slice(0, 400)}` : '',
  ].filter(Boolean);
  const narrativeAnchorBlock = narrativeAnchorParts.length > 0
    ? `\n\n${narrativeAnchorParts.join('\n\n')}`
    : '';

  // Lò vừaạtôi hạn chế（Phim Phong Cánối thêm khi ch）
  const mt = getMediaType(styleId || 'cinematic');
  const mediaTypeHint = mt !== 'cinematic' ? `\n【Lò vừaại】${getMediaTypeGuidance(mt)}` : '';

  // thời đại/bối cảnh thế giới quan：Đối với giai đoạn 2/4/5 hình ảnh TạoSử dụng（Ngăn chặn AI tạo ra những ảo tưởng lỗi thời với thời đại）
  const eraContextParts = [
    contextLine,
    era ? `⚠️ Thời đại Nền：${era}——Tất cảQuần áo nhân vật、kiểu tóc、đạo cụ、Tòa nhà phải tuân thủ nghiêm ngặt các quy định「${era}」thời kỳ，Các yếu tố từ thời đại khác bị cấm（Ví dụ, phim truyền hình cổ trang cấm mặc vest/áo phông/Điện thoạtôi và các mặt hàng hiện đại khác）` : '',
    worldSetting ? `Cài đặt chế độ xem thế giới：${worldSetting.slice(0, 300)}` : '',
    characterBios ? `Tham khảo mô hình nhân vật：${characterBios.slice(0, 300)}` : '',
  ].filter(Boolean);
  const eraContextBlock = eraContextParts.length > 0
    ? `\n\n【⚠️ Kịch bảnNền — Thị giác Tạo Phải tuân thủ nghiêm ngặt】\n${eraContextParts.join('\n')}`
    : '';

  // Hỗ trợ phân tích cú pháp JSON
  function parseStageJSON(raw: string): Record<string, any> {
    let cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    const parsed = JSON.parse(cleaned);
    return parsed.shots || parsed || {};
  }

  // Thiết bị truyền động sân khấu phổ quát：Tự động tạo khối bằng cách sử dụng processBatched（Tự động chia lô phụ khi chụp trên 30 ảnh）
  async function runStage(
    stageName: string,
    buildPrompts: (batch: ShotInputData[]) => { system: string; user: string },
    outputTokensPerItem: number,
    maxTokens: number,
  ): Promise<void> {
    console.log(`[MultiStage] ${stageName}`);
    const { results, failedBatches } = await processBatched<ShotInputData, Record<string, any>>({
      items: shots,
      feature: 'script_analysis',
      buildPrompts,
      parseResult: (raw, batch) => {
        const shotsResult = parseStageJSON(raw);
        const result = new Map<string, Record<string, any>>();
        for (const item of batch) {
          if (shotsResult[item.shotId]) {
            result.set(item.shotId, shotsResult[item.shotId]);
          }
        }
        return result;
      },
      estimateItemOutputTokens: () => outputTokensPerItem,
      apiOptions: { maxTokens },
    });

    for (const shot of shots) {
      const stageResult = results.get(shot.shotId);
      if (stageResult) {
        Object.assign(merged[shot.shotId], stageResult);
      }
    }
    if (failedBatches > 0) {
      console.warn(`[MultiStage] ${stageName}: ${failedBatches} đợt thứất bại`);
    }
  }

  // Khởi tạo kết quả hợp nhất
  const merged: Record<string, any> = {};
  for (const shot of shots) {
    merged[shot.shotId] = {};
  }

  // ===================== Giai đoạn 1: Bộ xương tường thuật =====================
  onStageProgress?.(1, 5, 'bộ xương tường thuật');
  console.log('[MultiStage] Stage 1/5: Bộ xương tường thuật');

  const s1System = `Bạn là người kể chuyện phim Phân tích chia，Thành thạo Cảnh quay ngôn ngữ và cấu trúc trần thuật。Phân tích mọi phân cảhàm trần thuật của nh và xác định Cảnh quayTham số。

${contextLine}${narrativeAnchorBlock}${episodeSynopsis ? `\n\n【Tóm tắt tập phim】\n${episodeSynopsis}` : ''}${episodeKeyEvents?.length ? `\nkeySự kiện：${episodeKeyEvents.join('、')}` : ''}

【⚠️ Kiểm tra tính nhất quán tường thuật — Phải được thực thi】
Mỗi tiến sĩân cảnh phải trả lời：
1. C nàyảNh quay dẫn dắt xung đột trung tâm của tập phim như thế nào？（điềm báo→Nâng cấp→đỉnh điểm→bước ngoặt→Lời kết）
2. C nàyảnh quay có vi phạm thiết lập thế giới quan không?？（Nếu có bất kỳ vi phạm nào，Chú thích trong câu chuyệnAlignment）
3. shotPurpose phải phản ánh CảMối quan hệ giữa nh quay và cốt lõi của câu chuyện，Không thể chỉ Mô tảbức tranh

cho mỗi tiến sĩân cảnhĐầu ra JSON：
- shotSize: ECU/CU/MCU/MS/MLS/LS/WS/FS
- cameraMovement: none/static/tracking/orbit/zoom-in/zoom-out/pan-left/pan-right/tilt-up/tilt-down/dolly-in/dolly-out/truck-left/truck-right/crane-up/crane-down/drone-aerial/360-roll
- specialTechnique: none/hitchcock-zoom/timelapse/crash-zoom-in/crash-zoom-out/whip-pan/bullet-time/fpv-shuttle/macro-closeup/first-person/slow-motion/probe-lens/spinning-tilt
- thời lượng: số giây (số nguyên)，H nguyên chấtành động3-5 giây/Đoạn hội thoại ngắn 4-6 giây/Đoạn hội thoại dài 6-10 giây/Phức hợp Hành động5-8 giây
- Chức năng tường thuật: báo trước/Nâng cấp/đỉnh điểm/bước ngoặt/Chuyển tiếp/Lời kết
- xung độtStage: C nàyảsân khấu của nh quay trong xung đột trung tâm của tập phim（giới thiệu/tăng cường/Đối đầu/bước ngoặt/giải quyết/hậu quả，Điền vào những chỗ không liên quan"phụ trợ"）
- shotMục đích: Gi trong một câuải thíchthisCảNh quay phục vụ cốt lõi của câu chuyện như thế nào（Tiếng Trung）
- StoryAlignment: và thế giới quan/Sự nhất quán ở cốt lõi của câu chuyện（aligned/minor-deviation/needs-review）
- visualFocus: thứ tự lấy nét trực quan（sử dụng→thể hiện）
- cameraPosition: Góc máyMô tả（Tiếng Trung）
- CharacterBlocking: bố cục ký tự（Tiếng Trung）
- nhịp điệu: cảm giác về nhịp điệu（Tiếng Trung）

Định dạng：{"shots":{"shot_id":{...}}}`;

  try {
    await runStage('Stage 1/5: Bộ xương tường thuật', (batch) => {
      const userShots = batch.map(s => {
        const chars = s.characterNames?.join('、') || 'không có';
        return `ID: ${s.shotId}\nCảnh: ${s.sceneLocation} | Thời gian: ${s.sceneTime}${s.sceneWeather ? ` | Thời tiết: ${s.sceneWeather}` : ''}\nVăn bản gốc: ${s.sourceText || s.actionSummary}${s.dialogue ? `\nĐối thoại: 「${s.dialogue}」` : ''}\nNhân vật: ${chars} | Bầu không khí: ${s.sceneAtmosphere}\nHiện tại: Cỡ cảnh=${s.currentShotSize || '?'} các môn thể thao=${s.currentCameraMovement || '?'}`;
      }).join('\n\n---\n\n');
      return { system: s1System, user: `Phân tích dưới Phân cảnh：\n\n${userShots}` };
    }, 200, 4096);
  } catch (e) {
    console.error('[MultiStage] Stage 1 failed:', e);
  }

  // ===================== Giai đoạn 2: VisionMô tả + Âm thanh =====================
  onStageProgress?.(2, 5, 'Tầm nhìn Mô tả');
  console.log('[MultiStage] Stage 2/5: Tầm nhìn Mô tả');
  const includeEnVisualPrompt = promptLanguage !== 'zh';
  const s2VisualPromptRule = includeEnVisualPrompt
    ? '\n- visualPrompt: tiếng Anh thuần túy，Trong vòng 40 từ，Để vẽ AI'
    : '';
  const s2JsonFormat = includeEnVisualPrompt
    ? '{"shots":{"shot_id":{"visualDescription":"","visualPrompt":"","characterNames":[],"emotionTags":[],"ambientSound":"","soundEffect":""}}}'
    : '{"shots":{"shot_id":{"visualDescription":"","characterNames":[],"emotionTags":[],"ambientSound":"","soundEffect":""}}}';

  const s2System = `Bạn là hình ảnh phim và truyền hình Mô tảphép chia。Dựa trên bản gốc Kịch bảnText và NarrativePhân tích，TạoVisual Mô tảvàÂthiết kế m thanh。${eraContextBlock}

⚠️ quy tắc：
- CảQuyền sở hữu NH là hoàn toàn cố định：Chính Cảnh không thể thay đổi，Để hồi tưởng"lớp phủ màn hình"Mô tả
- Nhân vậDanh sách t phải hoàn toàn từ văn bản gốc，Không tăng cũng không giảm
- **tính nhất quán thời đại**：Quần áo nhân vật、kiểu tóc、đạo cụ、Các chi tiết về môi trường phải tuân thủ nghiêm ngặt Kịch bản đặt kỷ nguyên Nền，Cấm trộn lẫn các yếu tố từ thời đại khác
- Mô tả trực quan: thuần Trung Quốc，Màn hình chi tiết Mô tả（quần áo/Đạo cụ phải phù hợp với thời điểm）
${s2VisualPromptRule}
- tùy chọn thẻ cảm xúc: hạnh phúc/sad/angry/surprised/fearful/calm/tense/excited/mysterious/romantic/funny/touching/serious/relaxed/playful/gentle/passionate/low
- ambientSound/Hiệu ứng âm thanh: thuần Trung Quốc
Định dạng：${s2JsonFormat}`;

  try {
    await runStage('Stage 2/5: Tầm nhìn Mô tả', (batch) => {
      const userShots = batch.map(s => {
        const prev = merged[s.shotId] || {};
        const hasFlashback = /hồi tưởng|sơn phủ|ký ức|xen kẽ/.test(s.sourceText || '');
        return `ID: ${s.shotId}\n【Chính Cảnh（không thể thay đổi）】: ${s.sceneLocation}${hasFlashback ? ' ⚠️Chứa hồi tưởng，Chính Cảnh vẫn không thay đổi！' : ''}\nVăn bản gốc: ${s.sourceText || s.actionSummary}${s.dialogue ? `\nĐối thoại: 「${s.dialogue}」` : ''}\nNhân vật: ${s.characterNames?.join('、') || 'không có'}\tường thuật: Cỡ cảnh=${prev.shotSize || '?'} | chức năng=${prev.narrativeFunction || '?'} | mục đích=${prev.shotPurpose || '?'}\nTập trung: ${prev.visualFocus || '?'} | Bố cục: ${prev.characterBlocking || '?'}`;
      }).join('\n\n---\n\n');
      return { system: s2System, user: `Xin vui lòng TạoVisual Mô tả：\n\n${userShots}` };
    }, 200, 4096);
  } catch (e) {
    console.error('[MultiStage] Stage 2 failed:', e);
  }

  // ===================== Giai đoạn 3: Điều khiển bắn súng =====================
  onStageProgress?.(3, 5, 'Kiểm soát chụp');
  console.log('[MultiStage] Stage 3/5: Điều khiển chụp');

  const s3System = `Bạn là Đạo diễn quay phim (DP)。Theo hình ảnh Mô tảQuyết tâm được Thẩm s chụp ảnh chuyên nghiệpố。${cinematographyGuidance ? `\n\n${cinematographyGuidance}` : ''}

cho mỗi tiến sĩân cảnhĐầu ra：
- lightingStyle: natural/high-key/low-key/silhouette/chiaroscuro/neon
- lightingDirection: front/side/back/top/bottom/rim
- colorTemperature: warm-3200K/neutral-5600K/cool-7500K/mixed/golden-hour/blue-hour
- ánh sángGhi chú: chi tiết ánh sáng Trung Quốc
- depthOfField: shallow/medium/deep/split-diopter
- focusTarget: Chủ đề trọng tâm tiếng Trung
- focusTransition: none/rack-focus/pull-focus/follow-focus
- cameraRig: tripod/handheld/steadicam/dolly/crane/drone/gimbal/shoulder
- movementSpeed: static/slow/normal/fast/whip
- Hiệu ứng khí quyển: mảng（Tiếng Trung），Chẳng hạn như["sương mù"]
- effectIntensity: subtle/moderate/heavy
- playbackSpeed: slow-0.25x/slow-0.5x/normal/fast-1.5x/fast-2x/timelapse
- cameraAngle: eye-level/low-angle/high-angle/birds-eye/worms-eye/dutch-angle/over-shoulder/pov/aerial
- focalLength: 14mm/18mm/24mm/28mm/35mm/50mm/85mm/100mm-macro/135mm/200mm
- photographyTechnique: long-exposure/double-exposure/high-speed/timelapse-photo/tilt-shift/silhouette/reflection/hiệu ứng mờ ảo (có thể để trống)

Định dạng：{"shots":{"shot_id":{...}}}`;

  try {
    await runStage('Stage 3/5: Điều khiển chụp', (batch) => {
      const userShots = batch.map(s => {
        const prev = merged[s.shotId] || {};
        const artParts = [
          s.architectureStyle ? `Kiến trúc:${s.architectureStyle}` : '',
          s.colorPalette ? `Màu sắc:${s.colorPalette}` : '',
          s.eraDetails ? `Thời đại:${s.eraDetails}` : '',
          s.lightingDesign ? `Ánh sáng:${s.lightingDesign}` : '',
        ].filter(Boolean);
        return `ID: ${s.shotId}\nCảnh: ${s.sceneLocation} | Thời gian: ${s.sceneTime}${s.sceneWeather ? ` | Thời tiết:${s.sceneWeather}` : ''}\nCỡ cảnh: ${prev.shotSize || '?'} | Phong trào: ${prev.cameraMovement || '?'} | Nhịp điệu: ${prev.rhythm || '?'}\nVisual Mô tả: ${prev.visualDescription || '?'}${artParts.length ? `\nCảnh\u7f8e\u672f: ${artParts.join(' | ')}` : ''}`;
      }).join('\n\n---\n\n');
      return { system: s3System, user: `Hãy chắc chắn để bắn Tham số：\n\n${userShots}` };
    }, 200, 4096);
  } catch (e) {
    console.error('[MultiStage] Stage 3 failed:', e);
  }

  // ===================== Giai đoạn 4: Nhắc khung hình đầu tiên =====================
  onStageProgress?.(4, 5, 'Lời nhắc khung đầu tiên');
  console.log('[MultiStage] Stage 4/5: Lời nhắc khung đầu tiên');

  // Giai đoạn 4: Điều chỉnh động theo ngôn ngữ nhắc nhởĐầu ra field
  const s4Fields = promptLanguage === 'zh'
    ? 'imagePromptZh (Tiếng Trung thuần túy, 60-100 từ)'
    : promptLanguage === 'en'
    ? 'imagePrompt (Tiếng Anh thuần túy, 60-80 từ)'
    : 'imagePrompt (thuần tiếng Anh, 60-80 từ) và imagePromptZh (thuần tiếng Trung, 60-100 từ)';
  const s4JsonFormat = promptLanguage === 'zh'
    ? '{"shots":{"shot_id":{"imagePromptZh":"","needsEndFrame":true}}}'
    : promptLanguage === 'en'
    ? '{"shots":{"shot_id":{"imagePrompt":"","needsEndFrame":true}}}'
    : '{"shots":{"shot_id":{"imagePrompt":"","imagePromptZh":"","needsEndFrame":true}}}';
  const s4LangWarning = promptLanguage === 'zh'
    ? '\n⚠️ imagePromptZh phải là tiếng Trung thuần túy'
    : promptLanguage === 'en'
    ? '\n⚠️ imagePrompt phải là 100%Tiếng Anh thuần túy，Bất kỳ ký tự Trung Quốc nào đều bị cấm'
    : '\n⚠️ imagePrompt phải là 100%Tiếng Anh thuần túy，Bất kỳ ký tự Trung Quốc nào đều bị cấm\n⚠️ imagePromptZh phải là tiếng Trung thuần túy';

  const s4System = `Bạn là hình ảnh AI TạoChuyên gia。Theo hình ảnh Mô tảvà quay phim Thắmố，TạoKhung đầu tiên Nhắc。${eraContextBlock}

${styleDesc}${mediaTypeHint}

⚠️ tính nhất quán thời đại（quan trọng nhất）：Quần áo của nhân vật、kiểu tóc、Phụ kiện phải tuân thủ nghiêm ngặt Kịch bản đặt kỷ nguyên Nền。Ví dụ, nhân vật trong phim cổ trang phải mặc trang phục cổ trang，Không có bộ đồ、áo phông、Kiểu tóc hiện đại, v.v.。

${s4Fields} phải chứa：
a) Cảmôi trường（Vị trí+Chi tiết môi trường+Thờtôi gian bầu không khí）
b) Thiết kế ánh sáng（Nguồn sáng + kết cấu + bầu không khí）
c) Ký tự Mô tả（Tuổi+Quần áo+Biểu cảm+tư thế，Mỗi Nhân vậViết cả hai t）
d) Thành phần và Cỡ cảnh（Cỡ cảnh+ký tự Vị trímối quan hệ + trọng tâm）
e) Đạo cụ quan trọng（Đạo cụ chính+Trạng thái）
f) Màn hình Phong cách（Cảm giác điện ảnh/Tông màu）
${s4LangWarning}

nhu cầu phán xétEndFrame：
- đúng: ký tự Vị tríthay đổi/Hành độtrình tự ng/MụcTrạng thátôi thay đổi/Cảnh quay thể thao (không tĩnh)
- false: đối thoại thuần túy + Vị tríkhông thay đổi/Chỉ có WeiBiểu cảm
- đặt đúng khi không chắc chắn

Định dạng：${s4JsonFormat}`;

  try {
    await runStage('Stage 4/5: Lời nhắc khung đầu tiên', (batch) => {
      const userShots = batch.map(s => {
        const prev = merged[s.shotId] || {};
        return `ID: ${s.shotId}\nCỡ cảnh: ${prev.shotSize || '?'} | Góc: ${prev.cameraAngle || '?'} | Độ dài tiêu cự: ${prev.focalLength || '?'}\nChuyển động: ${prev.cameraMovement || '?'}\nVisual Mô tả: ${prev.visualDescription || '?'}\nNhân vật: ${(prev.characterNames || s.characterNames || []).join('、')}\nÁnh sáng: ${prev.lightingStyle || '?'}, ${prev.lightingDirection || '?'}, ${prev.colorTemperature || '?'}\Độ sâu trường ảnh: ${prev.depthOfField || '?'} | Tập trung: ${prev.focusTarget || '?'}\nKhí quyển: ${(prev.atmosphericEffects || []).join(',')}${prev.lightingNotes ? `\nLighting nhận xét: ${prev.lightingNotes}` : ''}`;
      }).join('\n\n---\n\n');
      return { system: s4System, user: `Xin vui lòng TạoKhung đầu tiên Nhắc：\n\n${userShots}` };
    }, 400, 8192);
  } catch (e) {
    console.error('[MultiStage] Stage 4 failed:', e);
  }

  // ===================== Giai đoạn 5: Động + khung cuối cùng Lời nhắc =====================
  onStageProgress?.(5, 5, 'Động + khung cuối cùng Lời nhắc');
  console.log('[MultiStage] Stage 5/5: Động + khung cuối cùng Nhắc');

  // Giai đoạn 5: Tự động điều chỉnh theo ngôn ngữ nhắc nhởĐầu ra field
  const s5VideoFields = promptLanguage === 'zh'
    ? 'videoPromptZh (Thuần Trung Quốc)'
    : promptLanguage === 'en'
    ? 'videoPrompt (tiếng Anh thuần túy)'
    : 'videoPrompt (tiếng Anh thuần túy) / videoPromptZh (Thuần Trung Quốc)';
  const s5EndFields = promptLanguage === 'zh'
    ? 'endFramePromptZh (Tiếng Trung thuần túy, 60-100 từ)'
    : promptLanguage === 'en'
    ? 'endFramePrompt (Tiếng Anh thuần túy, 60-80 từ)'
    : 'endFramePrompt (Tiếng Anh thuần túy, 60-80 từ) / endFramePromptZh (Tiếng Trung thuần túy, 60-100 từ)';
  const s5JsonFormat = promptLanguage === 'zh'
    ? '{"shots":{"shot_id":{"videoPromptZh":"","endFramePromptZh":""}}}'
    : promptLanguage === 'en'
    ? '{"shots":{"shot_id":{"videoPrompt":"","endFramePrompt":""}}}'
    : '{"shots":{"shot_id":{"videoPrompt":"","videoPromptZh":"","endFramePrompt":"","endFramePromptZh":""}}}';
  const s5LangWarning = promptLanguage === 'zh'
    ? '\n⚠️ Cánh đồng Trung Quốc phải thuần Trung Quốc'
    : promptLanguage === 'en'
    ? '\n⚠️ Trường tiếng Anh phải là 100%Tiếng Anh thuần túy'
    : '\n⚠️ lĩnh vực tiếng anh 100%Tiếng Anh thuần túy，Cánh đồng thuần Trung Hoa';

  const s5System = `Bạn là AIVideoTạoChuyên gia。Theo khung đầu tiên，Tạo videoHành độngMô tảvà khung hình cuối cùng。${eraContextBlock}

${s5VideoFields}：
- Mô tảH động trong videoành động（Nhân vật Hành động、vật chuyển động、Cảnh quay thể thao）
- nhấn mạnh động từ，Mô tảQuá trình di chuyển
- ⚠️ Tất cảMô tảPhải duy trì tính nhất quán của thời đại（quần áo/đạo cụ/Môi trường không thể lệch khỏi Kịch bảnBộ thời đại）

${s5EndFields}：
Chỉ khi cầnEndFrame=đúng khi Tạo，Nếu không thì đặt thành chuỗi trống。
- Mô tảHành độBức ảnh cuối cùng sau khi ng hoàn thành
- Chứa cùng chữ C với khung đầu tiênảnh môi trường và ánh sáng
- Nhấn mạnh Mô tảSự khác biệt so với khung hình đầu tiên（MớiVị trí/tư thế mới/Bi mớiểu cảm/Đạo cụ TR mớiạng thái）
- Giữ nguyên hình ảnh như khung hình đầu tiên Phong cácài đặt ch và thời đại
${s5LangWarning}

Định dạng：${s5JsonFormat}`;

  try {
    await runStage('Stage 5/5: Động + khung hình cuối cùng', (batch) => {
      const userShots = batch.map(s => {
        const prev = merged[s.shotId] || {};
        return `ID: ${s.shotId}\nThời lượng: ${prev.duration || '?'}giây | Phong trào: ${prev.cameraMovement || '?'}\nneedsEndFrame: ${prev.needsEndFrame ?? true}\nHành động: ${s.actionSummary || '?'}${s.dialogue ? `\nĐối thoại: 「${s.dialogue}」` : ''}\nKhung hình đầu tiên (EN): ${prev.imagePrompt || '?'}\nKhung đầu tiên (ZH): ${prev.imagePromptZh || '?'}`;
      }).join('\n\n---\n\n');
      return { system: s5System, user: `Xin vui lòng Tạo lời nhắc video và khung hình cuối cùng：\n\n${userShots}` };
    }, 400, 8192);
  } catch (e) {
    console.error('[MultiStage] Stage 5 failed:', e);
  }

  console.log('[MultiStage] Tất cả 5 giai đoạn đã hoàn thành，Các trường đã hiệu chỉnh:', Object.keys(merged[shots[0]?.shotId] || {}).length);
  return merged;
}
