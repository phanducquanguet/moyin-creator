// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * AI Viewpoint Analyzer
 * 
 * Sử dụng AI Ph.ân tíchCảnh và phân cảnh nội dung，thông minh TạoG thích hợpóc nhìnDanh sách
 * Thay thế kết hợp từ khóa được mã hóa cứng ban đầu
 */

import type { Shot, ScriptScene } from '@/types/script';
import { callFeatureAPI } from '@/lib/ai/feature-router';

export interface AnalyzedViewpoint {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  keyProps: string[];
  keyPropsEn: string[];
  shotIndexes: number[];  // liên kết tiến sĩân cảsố sê-ri
}

export interface ViewpointAnalysisResult {
  viewpoints: AnalyzedViewpoint[];
  analysisNote: string;
}

export interface ViewpointAnalysisOptions {
  /** Tóm tắt tập phim/Tóm tắt cốt truyện */
  episodeSynopsis?: string;
  /** Chìa khóa của tập này là Sự kiện */
  keyEvents?: string[];
  /** Tiêu đề phim truyền hình */
  title?: string;
  /** Loại（chiến tranh kinh doanh/võ thuật/tình yêu v.v.） */
  genre?: string;
  /** Thời đại Nền */
  era?: string;
  /** thế giới quan/Phong cácài đặt ch */
  worldSetting?: string;
}

/**
 * AI Phân tíchCảnhGóc nhìn
 * Theo C.ảnh thông tin và phân cảnh nội dung，thông minh Tạo CảG theo yêu cầu của nhóc nhìnDanh sách
 */
export async function analyzeSceneViewpoints(
  scene: ScriptScene,
  shots: Shot[],
  options?: ViewpointAnalysisOptions
): Promise<ViewpointAnalysisResult> {
  
  // Nếu không có Phân cảnh，Quay lạiMặc địnhGóc nhìn
  if (shots.length === 0) {
    return {
      viewpoints: [
        { id: 'overview', name: 'Toàn cảnh', nameEn: 'Overview', description: 'không gian tổng thể', descriptionEn: 'Overall space', keyProps: [], keyPropsEn: [], shotIndexes: [] },
        { id: 'detail', name: 'Chi tiết', nameEn: 'Detail', description: 'Chi tiếtĐặc tả', descriptionEn: 'Detail close-up', keyProps: [], keyPropsEn: [], shotIndexes: [] },
      ],
      analysisNote: 'Không có Phân cảnh，sử dụng Mặc địnhGóc nhìn',
    };
  }
  
  // xây dựng tiến sĩân cảnh tóm tắt nội dung（Sử dụng ThêmTrường chi tiết）
  const shotSummaries = shots.map((shot, idx) => {
    const parts = [
      `【Phân cảnh${idx + 1}】`,
      shot.actionSummary && `Hành độngMô tả: ${shot.actionSummary}`,
      shot.visualDescription && `Màn hình Mô tả: ${shot.visualDescription}`,
      shot.visualFocus && `Tập trung thị giác: ${shot.visualFocus}`,
      shot.dialogue && `Đối thoại: ${shot.dialogue.slice(0, 80)}`,
      shot.ambientSound && `Âm thanh xung quanh: ${shot.ambientSound}`,
      shot.characterBlocking && `Bố cục nhân vật: ${shot.characterBlocking}`,
      shot.shotSize && `Cỡ cảnh: ${shot.shotSize}`,
      shot.cameraMovement && `Cảnh quay thể thao: ${shot.cameraMovement}`,
    ].filter(Boolean);
    return parts.join('\n  ');
  }).join('\n\n');
  
  // Xử lý thống nhất Tham s tùy chọnố
  const opts = options || {};

  // Xây dựng phần phác thảo tập
  const synopsisPart = opts.episodeSynopsis 
    ? `【Tóm tắt tập phim】\n${opts.episodeSynopsis}\n`
    : '';
  const keyEventsPart = opts.keyEvents && opts.keyEvents.length > 0
    ? `【Chìa khóa của tập này là Sự kiện】\n${opts.keyEvents.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n`
    : '';

  // Xây dựng bối cảnh câu chuyện toàn cầu
  const globalContextParts = [
    opts.title ? `Tiêu đề phim truyền hình：《${opts.title}》` : '',
    opts.genre ? `Loại：${opts.genre}` : '',
    opts.era ? `Thời đại Nền：${opts.era}` : '',
    opts.worldSetting ? `thế giới quan：${opts.worldSetting.slice(0, 200)}` : '',
  ].filter(Boolean);
  const globalContextSection = globalContextParts.length > 0
    ? `【Kịch bảthông tin】\n${globalContextParts.join('\n')}\n\n`
    : '';

  const systemPrompt = `Bạn là một đạo diễn nghệ thuật điện ảnh và truyền hình chuyên nghiệp，giỏi tiến sĩân tíchCảnh và xác định cú đánh cần thiết Góc nhìn。

${globalContextSection}【Nhiệm vụ】
Theo dàn ý của tập này、Cảnh thông tin và phân cảnh nội dung，Phân tíchtheCảNhững G khác nhau nào cần thiết cho nh?óc nhìn/Góc máyTạoCảnhNềđồ thị n。

【nguyên tắc quan trọng】
1. Góc nhìn phải giống với CảnhLoạimmatch：
   - xe buýt/Xe Cảnh：cửa sổ xe hơi、khu vực chỗ ngồi、lối đi、Ghế lái vv.
   - Nội thất nhà：phòng khách、phòng ngủ、nhà bếp、Chờ bên cửa sổ
   - Ngoài trời Cảnh：Toàn cảnh、Cận cảnh、Các mốc cụ thể, v.v.
   - Cổ Cảnh：Sảnh chính、sân、Mức độ vụ việc là gì?
2. Từ Phân cảnhHành động và hình ảnh Mô tảTrích xuất G yêu cầu thực tế từóc nhìn
3. Hiểu C dựa vào dàn ý của tập nàyảchức năng tường thuật của nh，Xác định G nàoóc nhìn là cốt lõi
4. Mỗi Góc nhìn phải có đạo cụ chính（Từ Phân cảNH tập trung hình ảnh và trích xuất âm thanh xung quanh）
5. Đầbạn ra4-6Góc nhìn

【Đầu raĐịnh dạng】
Quay lại JSON:
{
  "viewpoints": [
    {
      "id": "ID duy nhất như cửa sổ/seat/overview",
      "name": "Tiếng Trungên",
      "nameEn": "English Name",
      "description": "Trung Quốc Mô tả（Trong vòng 20 từ）",
      "descriptionEn": "English description",
      "keyProps": ["Đạo cụ 1", "Đạo cụ 2"],
      "keyPropsEn": ["prop1", "prop2"],
      "shotIndexes": [1, 2]  // Ph nàoân cảnh cần G nàyóc nhìn
    }
  ],
  "analysisNote": "Phân tíchGiải thích"
}`;

  const userPrompt = `${synopsisPart}${keyEventsPart}【Cảnh thông tin】
Vị trí: ${scene.location || scene.name}
Thời gian: ${scene.time || 'ngày'}
Bầu không khí: ${scene.atmosphere || 'bình tĩnh'}

【Phân cảnh nội dung（tổng cộng ${shots.length} Phân cảnh）】
${shotSummaries}

Hãy làm theo dàn ý ở trên của tập này và Ph.ân cảnh nội dung，Phân tíchtheCảG theo yêu cầu của nhóc nhìn，Quay lại JSON。`;

  try {
    console.log('[analyzeSceneViewpoints] 🚀 Bắt đầAPI AI của uCall...');
    console.log('[analyzeSceneViewpoints] Cảnh:', scene.location || scene.name);
    console.log('[analyzeSceneViewpoints] Phân cảsố lượng nh:', shots.length);
    
    // Thống nhất có được cấu hình từ ánh xạ dịch vụ
    const result = await callFeatureAPI('script_analysis', systemPrompt, userPrompt);
    
    console.log('[analyzeSceneViewpoints] ✅ Lệnh gọi API AI Thành công，Quay lạĐộ dài nội dung:', result.length);
    console.log('[analyzeSceneViewpoints] 200 ký tự đầu tiên của phản hồi thô:', result.slice(0, 200));
    
    // Phân tích cú pháp JSON
    let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    
    const parsed = JSON.parse(cleaned);
    
    console.log('[analyzeSceneViewpoints] 🎯 Phân tích cú pháp JSON Thành công，Góc nhìnSố lượng:', parsed.viewpoints?.length || 0);
    
    const viewpoints = (parsed.viewpoints || []).map((v: any, idx: number) => ({
      id: v.id || `viewpoint_${idx}`,
      name: v.name || 'Chưa đặt tênGóc nhìn',
      nameEn: v.nameEn || 'Unnamed Viewpoint',
      description: v.description || '',
      descriptionEn: v.descriptionEn || '',
      keyProps: v.keyProps || [],
      keyPropsEn: v.keyPropsEn || [],
      shotIndexes: v.shotIndexes || [],
    }));
    
    console.log('[analyzeSceneViewpoints] 📦 Quay lạiGóc nhìn:', viewpoints.map((v: any) => v.name).join(', '));
    
    return {
      viewpoints,
      analysisNote: parsed.analysisNote || '',
    };
  } catch (error) {
    const err = error as Error;
    console.error('[analyzeSceneViewpoints] ❌ AI Phân tíchThất bại:');
    console.error('[analyzeSceneViewpoints] Error name:', err.name);
    console.error('[analyzeSceneViewpoints] Error message:', err.message);
    console.error('[analyzeSceneViewpoints] Error stack:', err.stack);
    
    // Hạ cấp：Quay lạiCơ bảnGóc nhìn
    return {
      viewpoints: [
        { id: 'overview', name: 'Toàn cảnh', nameEn: 'Overview', description: 'bố trí không gian tổng thể', descriptionEn: 'Overall spatial layout', keyProps: [], keyPropsEn: [], shotIndexes: [] },
        { id: 'medium', name: 'Trung cảnh', nameEn: 'Medium Shot', description: 'Trung cảnhGóc nhìn', descriptionEn: 'Medium view', keyProps: [], keyPropsEn: [], shotIndexes: [] },
        { id: 'detail', name: 'Chi tiết', nameEn: 'Detail', description: 'Chi tiếtĐặc tả', descriptionEn: 'Detail close-up', keyProps: [], keyPropsEn: [], shotIndexes: [] },
      ],
      analysisNote: 'AI Phân tíchThất bại，sử dụng Mặc địnhGóc nhìn',
    };
  }
}

/**
 * Lô Phân tích bội CảG của nhóc nhìn
 */
export async function analyzeMultipleScenesViewpoints(
  scenesWithShots: Array<{ scene: ScriptScene; shots: Shot[] }>,
  options: ViewpointAnalysisOptions,
  onProgress?: (current: number, total: number, sceneName: string) => void
): Promise<Map<string, ViewpointAnalysisResult>> {
  const results = new Map<string, ViewpointAnalysisResult>();
  
  for (let i = 0; i < scenesWithShots.length; i++) {
    const { scene, shots } = scenesWithShots[i];
    
    onProgress?.(i + 1, scenesWithShots.length, scene.name || scene.location || 'Không rõCảnh');
    
    const result = await analyzeSceneViewpoints(scene, shots, options);
    results.set(scene.id, result);
    
    // Tránh giới hạn tần suất API
    if (i < scenesWithShots.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}
