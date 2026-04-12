// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Script Format Normalizer - Kịch bảnĐịnh dạng bình thường hóa
 * 
 * Tự động phát hiện không chuẩn trước parsFullScriptĐịnh dạng và chèn thẻ cấu trúc，
 * Cho phép trình phân tích cú pháp trích xuất chính xác tiêu đề、phác thảo、Tiểu sử、Số tập và thông tin khác。
 * 
 * Kiến trúc hai tầng：
 * 1. Phát hiện AI（Ưu tiên）：Gọi LLM để hiểu ngữ nghĩa nội dung，Xác định chính xác cấu trúc + hoàn thành các phác thảo còn thiếu
 * 2. Giữ mọi thứ đều đặn（Hạ cấp）：Không có cấu hình AI hoặc AI gọi Thất bạSử dụng tính năng khớp mẫu được mã hóa cứng khi tôi
 * 
 * nguyên tắc cốt lõi：
 * - Chỉ chèn các thẻ cấu trúc（《》、phác thảo：、Tiểu sử：）+ AI Tạphác thảo của o
 * - Khôngửa、Khôngábất kỳ nội dung gốc nào
 * - Bình thường：Đã có tiêu chuẩn rồiĐịnh dạvăn bản ng không bị ảnh hưởng
 */

import { callFeatureAPI } from '@/lib/ai/feature-router';
import { getFeatureConfig } from '@/lib/ai/feature-router';

/**
 * tiền xử lý：Tự động chèn ngắt dòng trước thẻ cấu trúc cho văn bản thiếu ngắt dòng
 * 
 * Người dùngtừ Word/WeChat/\u7f51\u9875\u590d\u5236củaKịch bản often loses newlines，trở thành cả một đoạn văn bản。
 * Hàm này chèn trước dấu cấu trúc khóa \n，Để các biểu thức chính quy tiếp theo ở đầu dòng có thể được khớp một cách bình thường。
 * 
 * Điều kiện phát hiện：Văn bản không có ngắt dòng hoặc độ dài dòng trung bình > 500 từ
 * Chèn Vị trí（theo mức độ ưu tiên）：
 *   1. Đặt thẻ：Tập X / Chương X / Episode X
 *   2. Đánh số đoạn văn tiếng Trung：một、 Hai、 ba、...
 *   3. Cảsố thứ：con số - con số（Chẳng hạn như 1-1、2-3）
 *   4. Hành động mô tả：△
 *   5. Đối thoại：Nhân vậtên t：hoặc Nhân vậtên t（
 *   6. Bổ sung Giải thích：Bổ sung: / Lưu ý：/ Bình luận：
 */
export function preprocessLineBreaks(text: string): { text: string; inserted: boolean } {
  const lineCount = text.split('\n').length;
  const avgLineLen = text.length / lineCount;
  
  // Văn bản có ngắt dòng hợp lý không được xử lý
  if (lineCount > 5 && avgLineLen < 500) {
    return { text, inserted: false };
  }
  
  let result = text;
  
  // 1. đặt/chương/ngắt dòng trước dấu rèm
  result = result.replace(
    /(?<!\n)(?=\*{0,2}Không.[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn\d]+[rèm chương][：:]?)/g,
    '\n'
  );
  
  // 2. Ngắt dòng trước đoạn văn được đánh số tiếng Trung（một、xxx hai、xxx）
  result = result.replace(
    /(?<!\n)(?=[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín mươi]+[、.]\s*(?:[\u4e00-\u9fa5]{2,}))/g,
    '\n'
  );
  
  // 3. CảNgắt dòng trước số nh（1-1 xxx、2-3 xxx，Không có số đứng trước/Colon để tránh vô tình cắt Thời gian）
  result = result.replace(
    /(?<!\n)(?<![\d：:])(?=\d+-\d+[\s\u4e00-\u9fa5])/g,
    '\n'
  );
  
  // 4. △ Hành độNgắt dòng trước ng mô tả
  result = result.replace(
    /(?<!\n)(?=△)/g,
    '\n'
  );
  
  // 5. Ngắt dòng trước đoạn hội thoại：2-8 ký tự Tên tiếng Trung + dấu hai chấm có độ rộng đầy đủ/dấu ngoặc đơn（tránh cắt đứt "tuổi tác：" thuộc tính）
  // Chỉ khi dòng trước không phải là dòng mới và không thuộc thuộc tính Mô tảtrong（Có chữ Hán + dấu hai chấm phía trước）
  result = result.replace(
    /(?<!\n)(?<![\u4e00-\u9fa5：])(?=[\u4e00-\u9fa5]{2,8}[（(][^）)]{0,10}[）)][：:])/g,
    '\n'
  );
  result = result.replace(
    /(?<!\n)(?<![\u4e00-\u9fa5：tuổi tác, thân phận, tính cách])(?=[\u4e00-\u9fa5]{2,6}[：:][（(「])/g,
    '\n'
  );
  
  // 6. Bổ sung/Ngắt dòng trước phần bình luận
  result = result.replace(
    /(?<!\n)(?=(?:Bổ sung|Lưu ý|Nhận xét)[：:])/g,
    '\n'
  );
  
  // 7. Nhân vậtDòng mới trước mục tiểu sử：dừng hẳn/Dấu chấm than/Dấu câu như dấu chấm phẩy được theo sau bởi Nhân vậtên t：tuổi tác/Năm thứ hai：
  // Xử lý nhỏ gọnĐịnh dạtiểu sử ng（Tất cảNhân vật bị ép vào cùng một dòng）
  result = result.replace(
    /([。！；;）\)」】])\s*(?=[\u4e00-\u9fa5]{2,8}[：:]\s*(?:Tuổi|Hai năm)[：:])/g,
    '$1\n'
  );
  
  // dọn dẹp：Loại bỏ các ngắt dòng bổ sung có thể có ở đầu
  result = result.replace(/^\n+/, '');
  
  const inserted = result !== text;
  if (inserted) {
    const newLineCount = result.split('\n').length;
    console.log(`[preprocessLineBreaks] Chèn dòng mới：${lineCount} được rồi → ${newLineCount} được rồi`);
  }
  
  return { text: result, inserted };
}

export interface NormalizationResult {
  /** Văn bản chuẩn hóa */
  normalized: string;
  /** Thay đổiNhật ký（Được sử dụng để theo dõi console.log） */
  changes: string[];
  /** AI Phân tích kết quả（era được sử dụng để ghi đè trình phân tích cú pháp/genre） */
  aiAnalysis?: ScriptStructureAnalysis;
}

/**
 * Bình thường hóa thường xuyên（Được sử dụng mà không có AI）
 * Phát hiện không chuẩnĐịnh dạng và chèn thẻ cấu trúc，Nội dung gốc là nguyên văn
 */
export function normalizeScriptFormat(text: string): NormalizationResult {
  const changes: string[] = [];
  
  // Kiểm tra các điểm đánh dấu tiêu chuẩn hiện có
  const hasTitle = /[《「][^》」]+[》」]/.test(text);
  const hasOutline = /(?:\*{0,2}phác thảo[：:]\*{0,2}|【phác thảo】)/i.test(text);
  const hasCharBios = /(?:\*{0,2}Tiểu sử[：:]\*{0,2}|【Tiểu sử】)/i.test(text);
  
  // Tất cả các tiêu chuẩn，Không cần bình thường hóa
  if (hasTitle && hasOutline && hasCharBios) {
    return { normalized: text, changes: [] };
  }
  
  let normalized = text;
  
  // === Bước 1: Chuẩn hóa tiêu đề ===
  if (!hasTitle) {
    normalized = normalizeTitle(normalized, changes);
  }
  
  // === Bước 2: Phát hiện dấu tiểu sử nhân vật（trước đề cương，Bởi vì phác thảo chèn Vị tríTiểu sử nhân vật phụ thuộc Vị trí）===
  if (!hasCharBios) {
    normalized = normalizeCharacterSection(normalized, changes);
  }
  
  // === Bước 3: Phát hiện dấu phác thảo ===
  const hasOutlineNow = /(?:\*{0,2}phác thảo[：:]\*{0,2}|【phác thảo】)/i.test(normalized);
  if (!hasOutlineNow) {
    normalized = normalizeOutlineSection(normalized, changes);
  }
  
  // === Bước 4: Đặt chuẩn hóa nhãn（Chương X → Tập X, v.v.）===
  normalized = normalizeEpisodeMarkers(normalized, changes);
  
  return { normalized, changes };
}

// ============================================================
// Lớp phát hiện cấu trúc AI
// ============================================================

/** Cấu trúc AIPhân tích kết quả */
export interface ScriptStructureAnalysis {
  /** công trình Tên */
  title: string;
  /** Thời đại Nền（thời cổ đại/hiện đại/Cộng hòa Trung Quốc/Chờ đợi trong tương lai） */
  era: string;
  /** Loại（võ thuật/chiến tranh kinh doanh/tình yêu v.v.） */
  genre: string;
  /** Có một phác thảo trong văn bản gốc?/Tổng quan câu chuyện */
  hasOutline: boolean;
  /** AI Tạphác thảo của o（Chỉ khi hasOutline=Điền khi sai） */
  generatedOutline: string;
  /** nhân vật/Nhân vậtMô tảVăn bản bắt đầu khu vực（Sao chép chính xác 30 ký tự đầu tiên của văn bản gốc） */
  characterSectionKeyword: string;
  /** phác thảo/Văn bản bắt đầu khu vực tổng quan câu chuyện（30 ký tự đầu tiên của văn bản gốc，Nếu không thì để trống） */
  outlineSectionKeyword: string;
  // === Trích xuất siêu dữ liệu ở cấp độ kịch（Tùy chọn，Điền vào khi AI có khả năng） ===
  /** Tóm tắt một câu */
  logline?: string;
  /** xung đột cốt lõi */
  centralConflict?: string;
  /** Từ khóa chủ đề */
  themes?: string[];
  /** Đã trích xuất Nhân vậdanh sách t */
  characters?: Array<{
    name: string;
    age?: string;
    identity?: string;
    faction?: string;
    personality?: string;
    keyActions?: string;
  }>;
  /** trại/quyền lực */
  factions?: Array<{ name: string; members: string[] }>;
  /** mục chính */
  keyItems?: Array<{ name: string; description: string }>;
  /** Cài đặt địa lý */
  geography?: Array<{ name: string; description: string }>;
}

/**
 * Phát hiện cấu trúc AI：Gọi LLM Phân tíchKịch bảcấu trúc，Xác định tiêu đề/phác thảo/nhân vật/thời đại，và hoàn thành dàn ý còn thiếu
 * @returns Phân tích kết quả，AI không khả dụng hoặc đang gọi Thất bạQuay lại null
 */
export async function analyzeScriptStructureWithAI(text: string): Promise<ScriptStructureAnalysis | null> {
  // Kiểm tra xem AI có sẵn không
  const config = getFeatureConfig('script_analysis');
  if (!config) {
    console.log('[scriptNormalizer] Không có cấu hình AI，Bỏ qua phát hiện cấu trúc');
    return null;
  }
  
  try {
    // Gửi thêm nội dung để trích xuất siêu dữ liệu cấp chương trình（Nhân vật/trại/Mặt hàng/Địa lý）
    const MAX_ANALYSIS_LENGTH = 10000;
    const analysisText = text.length > MAX_ANALYSIS_LENGTH
      ? text.substring(0, MAX_ANALYSIS_LENGTH) + '\n...\uff08 nội dung tiếp theo bị bỏ qua\uff09'
      : text;
    
    const systemPrompt = `bạn là Kịch bảcấu trúc Phân tíchexpert。Phân tíchNgười dùK được cung cấp bởi ngịch bản/Nhân vậtVăn bản đặc tả，Xác định các thành phần cấu trúc và trích xuất siêu dữ liệu ở cấp độ kịch。

Quay nghiêm lạtôi đang theo dõi JSON Định dạng（Đừng thếênhiều nội dung khác）：
{
  "title": "công trình Tên",
  "era": "Thời đại Nền（thời cổ đại/hiện đại/Cộng hòa Trung Quốc/Cuối nhà Thanh/tương lai/đương đại v.v.）",
  "genre": "Loại（võ thuật/chiến tranh kinh doanh/tình yêu/Hồi hộp/khoa học viễn tưởng/Tiên Hạ/quân sự/gia đình v.v.）",
  "hasOutline": false,
  "generatedOutline": "Nếu không có dàn ý trong văn bản/Khu vực tổng quan câu chuyện，Dựa trên nội dung toàn vănTạoa dàn ý ngắn gọn（100-200 từ）；Để lại chuỗi trống nếu đã có dàn ý",
  "characterSectionKeyword": "nhân vật/Nhân vậtMô tảKhu Bắt đầvăn bản gốc gửi cho bạn（Sao chép chính xác 30 ký tự đầu tiên），Nếu không tìm thấy thì để trống",
  "outlineSectionKeyword": "phác thảo/Tổng quan câu chuyện Khu vực Bắt đầvăn bản gốc gửi cho bạn（Sao chép chính xác 30 ký tự đầu tiên），Nếu không tìm thấy thì để trống",
  "logline": "Tóm tắt toàn bộ câu chuyện trong một câu（Ví dụ：Hiệp sĩ bị trục xuất trở về Diêm Thành cứu dân）",
  "centralConflict": "Xung đột dòng chính（Chẳng hạn như：Nhân vật chính vs Nhân vật phản diện + Ngoại lực）",
  "themes": ["Từ khóa chủ đề 1", "Từ khóa chủ đề 2"],
  "characters": [
    {"name": "Nhân vậtên t", "age": "tuổi tác", "identity": "danh tính", "faction": "Thuộc trại", "personality": "Đặc điểm tính cách", "keyActions": "hành vi chính"}
  ],
  "factions": [{"name": "Tên phe phái", "members": ["Nhân vậtên t 1", "Nhân vậtên t 2"]}],
  "keyItems": [{"name": "Tên mặt hàng", "description": "Mô tả ngắn gọn"}],
  "geography": [{"name": "Tên địa điểm", "description": "Mô tả ngắn gọn"}]
}

quy tắc：
1. title：Xác định công việc T từ văn bảnên，Đừng bịa đặt
2. era：Phải được đánh giá dựa trên bối cảnh nội dung，Đừng Mặc định cho hiện đại（Nếu có một lãnh chúa thành phố/kiếm thuật/Jianghu và vân vân nên được đánh giá là thời cổ đại）
3. genre：Xác định dựa trên các yếu tố trong nội dung
4. hasOutline：Nó đã có trong văn bản gốc chưa?“phác thảo”“Giới thiệu truyện”“TruyệnNền”đoạn tóm tắt rõ ràng
5. generatedOutline：Chỉ khi hasOutline=sai khi Tạo
6. characterSectionKeyword：Phải là một đoạn văn bản thực tế trong văn bản gốc
7. characters：Từ tiểu sử/Nhân vậtMô tảTrích xuất T từất cảNhân vật，Chứa tên、tuổi tác、danh tính、trại、nhân vật、hành vi chính
8. factions：từ「một、nhân vật chính cốt lõi」「Hai、Lực dương Nhân vật」「ba、Lực Lượng Phản Diện Nhân vật」Trích xuất trại từ các danh mục khác
9. keyItems：từ phác thảo+Nhân vậtMô tảXác định các mục quan trọng trong（chẳng hạn như vũ khí、mã thông báo、biểu tượng）
10. geography：Từ Cảnh trưởng và nhân vậtMô tảXác định các địa danh quan trọng trong
11. Chỉ có Phân tícấu trúc ch，KhôngửaBất kỳ nội dung gốc nào`;

    // Lên đến Thử lạtôi 2 lần（Tổng cộng 3 lần thử），Tránh L tạm thờiỗi mạng gây ra sự hạ cấp
    const MAX_RETRIES = 2;
    let result: string | null = null;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[scriptNormalizer] Phát hiện cấu trúc AI Thử lại (${attempt}/${MAX_RETRIES})...`);
          await new Promise(r => setTimeout(r, 1500 * attempt));
        } else {
          console.log('[scriptNormalizer] Gọi AI Phân tíchKịch bảcấu trúc...');
        }
        result = await callFeatureAPI('script_analysis', systemPrompt, analysisText, {
          temperature: 0.1,
          maxTokens: 1024,
        });
        break; // Thành công sẽ nhảy ra khỏi Thử lạiLặp lại
      } catch (e) {
        lastError = e as Error;
        console.warn(`[scriptNormalizer] AI gọi Thất bại (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, lastError.message);
      }
    }
    
    if (!result) {
      console.warn('[scriptNormalizer] Cấu trúc AI phát hiện tất cả Thất bại，Sẽ hạ cấp xuống căn cứ Yan thông thường:', lastError?.message);
      return null;
    }
    
    // Trích xuất JSON（Tương thích với các khối mã markdown、Nghĩa đen của đối tượng JS, v.v.Định dạng）
    let jsonStr = result;
    // 1. Xóa thẻ khối mã đánh dấu
    jsonStr = jsonStr.replace(/^```(?:json|js|javascript)?\s*/gm, '').replace(/```\s*$/gm, '').trim();
    // 2. Trích xuất lớp ngoài cùng {...}
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[scriptNormalizer] AI Quay lạiKhông phải JSON Định dạng:', result.substring(0, 200));
      return null;
    }
    jsonStr = jsonMatch[0];
    // 3. Cố gắng phân tích trực tiếp，Thất bạsau đó tôi sửa các chữ của đối tượng JS（Không có phím trích dẫn）cho JSON
    let analysis: ScriptStructureAnalysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      // Thêm dấu ngoặc kép vào các khóa không được trích dẫn：  title: → "title":
      const fixedJson = jsonStr.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
      try {
        analysis = JSON.parse(fixedJson);
        console.log('[scriptNormalizer] Đã sửa lỗi đối tượng JSĐịnh dạng dưới dạng JSON');
      } catch (e2) {
        console.warn('[scriptNormalizer] Phân tích cú pháp JSON Thất bại:', (e2 as Error).message, '\nVăn bản gốc:', jsonStr.substring(0, 300));
        return null;
      }
    }
    console.log('[scriptNormalizer] AI Phân tích kết quả:', {
      title: analysis.title,
      era: analysis.era,
      genre: analysis.genre,
      hasOutline: analysis.hasOutline,
      outlineLength: analysis.generatedOutline?.length || 0,
      charKeyword: analysis.characterSectionKeyword?.substring(0, 20),
      charactersCount: analysis.characters?.length || 0,
      factionsCount: analysis.factions?.length || 0,
      keyItemsCount: analysis.keyItems?.length || 0,
      geographyCount: analysis.geography?.length || 0,
      logline: analysis.logline?.substring(0, 30),
    });
    
    return analysis;
  } catch (error) {
    console.warn('[scriptNormalizer] Phát hiện cấu trúc AI Thất bại，Sẽ được hạ cấp xuống trang bìa thông thường:', error);
    return null;
  }
}

/**
 * Dựa trên AI Ph.ân tích kết quả chèn thẻ cấu trúc
 * Nội dung gốc là nguyên văn，Chỉ chèn dấu + AI Tạphác thảo của o
 */
export function applyAIAnalysis(text: string, analysis: ScriptStructureAnalysis): NormalizationResult {
  const changes: string[] = [];
  let normalized = text;
  
  const hasTitle = /[《「][^》」]+[》」]/.test(text);
  const hasOutline = /(?:\*{0,2}phác thảo[：:]\*{0,2}|【phác thảo】)/i.test(text);
  const hasCharBios = /(?:\*{0,2}Tiểu sử[：:]\*{0,2}|【Tiểu sử】)/i.test(text);
  
  // === 1. Tiêu đề ===
  // Xác minh AI Quay lạTiêu đề của tôi không phải là tiêu đề đã đặt（Chẳng hạn như"Tập 1 Cuộc gặp gỡ đầu tiên"）
  const isEpisodeTitle = analysis.title && /^Không.[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn\d]+bộ/.test(analysis.title);
  if (!hasTitle && analysis.title && !isEpisodeTitle) {
    const titlePos = normalized.indexOf(analysis.title);
    // Tiêu đề phải ở đầu văn bản
    if (titlePos !== -1 && titlePos < 200) {
      normalized = normalized.substring(0, titlePos)
        + `《${analysis.title}》`
        + normalized.substring(titlePos + analysis.title.length);
      changes.push(`[AI] Tiêu đề: 《${analysis.title}》`);
    }
  } else if (isEpisodeTitle) {
    console.warn(`[applyAIAnalysis] AI Quay lạTựa đề của tôi bị nghi là tựa đề của tập phim，Đã bỏ qua: "${analysis.title}"`);
  }
  
  // === 2. Tiểu sử các nhân vật ===
  if (!hasCharBios && analysis.characterSectionKeyword) {
    const charPos = normalized.indexOf(analysis.characterSectionKeyword);
    if (charPos !== -1) {
      normalized = normalized.substring(0, charPos)
        + 'Tiểu sử：\n'
        + normalized.substring(charPos);
      changes.push(`[AI] Tiểu sử được đánh dấu: trong"${analysis.characterSectionKeyword.substring(0, 20)}..."chèn trước`);
    }
  }
  
  // === 3. phác thảo ===
  const hasOutlineNow = /(?:\*{0,2}phác thảo[：:]\*{0,2}|【phác thảo】)/i.test(normalized);
  if (!hasOutlineNow) {
    if (!hasOutline && analysis.outlineSectionKeyword) {
      // Văn bản gốc có nội dung phác thảo nhưng không có đánh dấu chuẩn
      const outlinePos = normalized.indexOf(analysis.outlineSectionKeyword);
      if (outlinePos !== -1) {
        normalized = normalized.substring(0, outlinePos)
          + 'phác thảo：\n'
          + normalized.substring(outlinePos);
        changes.push(`[AI] thẻ phác thảo: trong"${analysis.outlineSectionKeyword.substring(0, 20)}..."chèn trước`);
      }
    } else {
      // Văn bản gốc không có phác thảo → Chèn AI Tạphác thảo của o
      const charBiosPos = normalized.search(/(?:\*{0,2}Tiểu sử[：:]\*{0,2}|【Tiểu sử】)/i);
      let outlineContent = (!analysis.hasOutline && analysis.generatedOutline)
        ? analysis.generatedOutline
        : '';
      
      // Dọn dẹp các thẻ đã đặt trong phác thảo，Ngăn chặn các tập phân tích không khớp
      // "Tập 1 Cuộc gặp gỡ đầu tiên：..." → "Chương 1 Cuộc gặp gỡ đầu tiên：..."
      if (outlineContent) {
        outlineContent = outlineContent.replace(
          /Không. ([Một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn\d]+)set([：:]?)/g,
          'Không.$1 tập$2'
        );
      }
      
      if (charBiosPos !== -1) {
        normalized = normalized.substring(0, charBiosPos)
          + `phác thảo：\n${outlineContent}\n\n`
          + normalized.substring(charBiosPos);
        changes.push(outlineContent
          ? `[AI] Đề cương: AI TạoPhác thảo（${outlineContent.length}từ）`
          : '[AI] Đánh dấu phác thảo: Chèn một phác thảo trống');
      }
    }
  }
  
  // === 4. Đặt chuẩn hóa nhãn（Tái sử dụng logic thông thường） ===
  normalized = normalizeEpisodeMarkers(normalized, changes);
  
  return { normalized, changes, aiAnalysis: analysis };
}

// ============================================================
// chức năng nội bộ
// ============================================================

/**
 * Phát hiện và chuẩn hóa tiêu đề
 * Lấy dòng ngắn đủ điều kiện đầu tiên trong số 5 dòng đầu tiên làm tiêu đề，gói《》
 */
function normalizeTitle(text: string, changes: string[]): string {
  const lines = text.split('\n');
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    
    // bỏ qua các dòng quá dài
    if (trimmed.length > 30) continue;
    
    // Bỏ qua các dòng trông giống như số chương
    if (/^[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn\d]+[、.]/.test(trimmed)) continue;
    
    // bỏ qua bộ/Dấu chương
    if (/^Không.[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn\d]+[rèm chương]/.test(trimmed)) continue;
    
    // Bỏ qua Kịch bảdòng từ khóa cấu trúc（nhân vật：XX、Nhân vật：XX、Cảnh：XX, v.v.）
    if (/^(?:nhân vật|Nhân vật|Cảnh|vị trí|Thời gian|Nền|Lưu ý|Nhận xét)[：:]/.test(trimmed)) continue;
    
    // Bỏ qua tiêu đề Markdown（nhưng trích xuất nội dung）
    const mdMatch = trimmed.match(/^#+\s+(.+)$/);
    if (mdMatch) {
      const title = mdMatch[1].trim();
      if (title.length <= 30) {
        lines[i] = lines[i].replace(trimmed, `《${title}》`);
        changes.push(`Tiêu đề: "${title}" → 《${title}》`);
        return lines.join('\n');
      }
      continue;
    }
    
    // Bỏ qua M đã có dấu hai chấmô tảđược rồi（Chẳng hạn như "Nhân vậtên t：tuổi tác：35"）
    if (/[：:].{15,}/.test(trimmed)) continue;
    
    // Bỏ qua các dòng được đánh dấu trong ngoặc
    if (/^[【\[]/.test(trimmed)) continue;
    
    // Tìm ứng viên chức danh
    // Sử dụng chính xác Vị tríthay thế，Tránh thay thế văn bản giống hệt tiếp theo
    const lineStart = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
    const originalLine = lines[i];
    const trimOffset = originalLine.indexOf(trimmed);
    
    lines[i] = originalLine.substring(0, trimOffset) + `《${trimmed}》` + originalLine.substring(trimOffset + trimmed.length);
    changes.push(`Tiêu đề: "${trimmed}" → 《${trimmed}》`);
    return lines.join('\n');
  }
  
  return text;
}

/**
 * Phát hiện khu vực tiểu sử nhân vật và chèn dấu
 * Hỗ trợ：
 * - tiêu đề rõ ràng：Giới thiệu nhân vật：、Nhân vậtGiới thiệu：、MainNhân vật：、Nhân vậcài đặt t：
 * - Số Trung Quốc Nhân vậphân loại t：một、nhân vật chính cốt lõi / một、MainNhân vật
 * - Nhân vậtMô tảchế độ：XX：tuổi tác：35 / XX：35 tuổi
 */
function normalizeCharacterSection(text: string, changes: string[]): string {
  // 1. Rõ ràng Nhân vậdanh hiệu tarea → Thay thế bằng "Tiểu sử："
  const explicitHeaders = [
    /^((?:nhân vật|Nhân vật)(?:Giới thiệu|cài đặt|Giới thiệu|danh sách|Mô tả)[：:])/m,
    /^((?:chính|cốt lõi|Quan trọng)(?:Nhân vật|ký tự)[：:])/m,
    /^(Nhân vậbàn t[：:])/m,
  ];
  
  for (const regex of explicitHeaders) {
    const match = regex.exec(text);
    if (match && match.index !== undefined) {
      const before = text.slice(0, match.index);
      const after = text.slice(match.index + match[0].length);
      changes.push(`Tag tiểu sử: "${match[0]}" → "Tiểu sử："`);
      return before + 'Tiểu sử：' + after;
    }
  }
  
  // 2. Mã Trung Quốc Nhân vậphân loại t：một、nhân vật chính cốt lõi / một、Lực dương Nhân vật / 1. Chính Nhân vật
  const numberedCharPattern = /^([Một, hai, ba, bốn, năm, sáu, bảy, tám, chín mươi\d]+[、.]\s*(?:Lõi|chính|phía trước|mặt trái|nhân vật phản diện|vai phụ|nhân vật chính|đàng hoàng|NữChúa ơi|Nam Chúa|quan trọng|chìa khóa|thứ yếu)[^\n]*)/m;
  const numberedMatch = numberedCharPattern.exec(text);
  if (numberedMatch && numberedMatch.index !== undefined) {
    const insertPos = numberedMatch.index;
    changes.push(`Tiểu sử được đánh dấu: trong"${numberedMatch[1].substring(0, 20)}..."chèn trước`);
    return text.slice(0, insertPos) + 'Tiểu sử：\n' + text.slice(insertPos);
  }
  
  // 3. Nhân vậtMô tảhoa văn đặc trưng：Nhân vậtên t：tuổi tác：XX hoặc Nhân vậtên t：XX tuổi，danh tính：...
  const charDescPattern = /^([\u4e00-\u9fa5]{2,8}[：:]\s*(?:Tuổi[：:]|giới tính[：:]|danh tính[：:]|\d{1,3}năm))/m;
  const charDescMatch = charDescPattern.exec(text);
  if (charDescMatch && charDescMatch.index !== undefined) {
    const insertPos = charDescMatch.index;
    changes.push(`Tiểu sử được gắn thẻ: Ở Nhân vậtMô tả"${charDescMatch[1].substring(0, 15)}..."chèn trước`);
    return text.slice(0, insertPos) + 'Tiểu sử：\n' + text.slice(insertPos);
  }
  
  return text;
}

/**
 * Phát hiện vùng phác thảo và chèn dấu
 * Hỗ trợ：
 * - tiêu đề rõ ràng：TruyệnNền：、Giới thiệu truyện：、Tóm tắt cốt truyện：、Tổng quan：
 * - Nếu không tìm thấy tóm tắt nhưng có dấu tiểu sử，Chèn thẻ phác thảo trống trước tiểu sử nhân vật
 */
function normalizeOutlineSection(text: string, changes: string[]): string {
  // 1. Tiêu đề phác thảo rõ ràng → Thay thế bằng "phác thảo："
  const outlineHeaders = [
    /^((?:Chuyện(?:Nền|Giới thiệu|Tổng quan|phác thảo|tóm tắt)|Cốt truyện(?:Giới thiệu|Tổng quan|phác thảo|Tóm tắt))[：:])/m,
    /^((?:Nền|Tổng quan|Giới thiệu|tóm tắt)[：:])/m,
    /^(#+\s*(?:Câu chuyện(?:Nền|Giới thiệu|Tổng quan|phác thảo|tóm tắt)|Tóm tắt cốt truyện|Nền|Tổng quan|Giới thiệu)\s*)$/m,
    /^(【(?:Câu chuyện(?:Nền|Giới thiệu|Tổng quan|phác thảo)|phác thảo|Giới thiệu)】)/m,
  ];
  
  for (const regex of outlineHeaders) {
    const match = regex.exec(text);
    if (match && match.index !== undefined) {
      const before = text.slice(0, match.index);
      const after = text.slice(match.index + match[0].length);
      changes.push(`Thẻ phác thảo: "${match[0].trim()}" → "phác thảo："`);
      return before + 'phác thảo：' + after;
    }
  }
  
  // 2. Không tìm thấy đề cương，Nhưng có một dấu ấn tiểu sử → Chèn một đường viền trống trước tiểu sử nhân vật
  const charBiosPos = text.search(/(?:\*{0,2}Tiểu sử[：:]\*{0,2}|【Tiểu sử】)/i);
  if (charBiosPos !== -1) {
    changes.push('Đánh dấu phác thảo: Chèn một phác thảo trống（Không tìm thấy nội dung phác thảo）');
    return text.slice(0, charBiosPos) + 'phác thảo：\n\n' + text.slice(charBiosPos);
  }
  
  return text;
}

/**
 * đặt chuẩn hóa nhãn
 * Chương X → Tập X、EP.X → Tập X, v.v.
 */
function normalizeEpisodeMarkers(text: string, changes: string[]): string {
  let normalized = text;
  let changed = false;
  
  // Chương X → Tập X
  normalized = normalized.replace(
    /^(\*{0,2}) Không. ([Một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn\d]+) chương([：:]\s*[^\n]*)?(\*{0,2})$/gm,
    (_match, s1, num, title, s2) => {
      changed = true;
      return `${s1}Không.${num}đặt${title || ''}${s2}`;
    }
  );
  
  // Màn X → Tập X
  normalized = normalized.replace(
    /^(\*{0,2}) Không. ([Một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn\d]+) rèm([：:]\s*[^\n]*)?(\*{0,2})$/gm,
    (_match, s1, num, title, s2) => {
      changed = true;
      return `${s1}Không.${num}đặt${title || ''}${s2}`;
    }
  );
  
  // Episode X / EP.X / EP X → Tập X（Tiếng AnhĐịnh dạng）
  normalized = normalized.replace(
    /^(?:Episode|EP\.?)\s*(\d+)\s*[：:.\-]?\s*([^\n]*)?$/gim,
    (_match, num, title) => {
      changed = true;
      return `Không.${num}đặt${title ? '：' + title.trim() : ''}`;
    }
  );
  
  if (changed) {
    changes.push('Đặt điểm đánh dấu: Điểm đánh dấu được đặt không chuẩn được chuẩn hóa thành"Tập X"Định dạng');
  }
  
  return normalized;
}
