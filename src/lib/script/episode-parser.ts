// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Tập Parser - Tiếng Trung Kịch bảtrình phân tích cú pháp nRule
 * Phân tích cú pháp tiếng Trung chuẩn Kịch bảnĐịnh dạng，Bộ trích xuất、Cảnh、đối thoại、Hành động và thông tin có cấu trúc khác
 * 
 * Hỗ trợcủaĐịnh dạng：
 * - đặt điểm đánh dấu：Tập X
 * - Cảnh đầu：**Trong vòng 1-1 ngày, Thượng Hải Zhangjia** Hoặc trong vòng 1-1 ngày Thượng Hải Zhangjia
 * - Hàng ký tự：nhân vật：Trương Minh、bố của Trương
 * - phụ đề：【phụ đề：Mùa hè 2002】
 * - Hành động mô tả：△Hoa dành dành nở ngoài cửa sổ...
 * - Đối thoại：bố của Trương：（uống）Rõ ràng là chúng tôi rất hứa hẹn.！
 * - Hồi tưởng：【hồi tưởng】...【Hồi tưởng Kết thúc】
 * - Người kể chuyện/VO：【VO：...】
 */

import type {
  EpisodeRawScript,
  SceneRawContent,
  DialogueLine,
  ProjectBackground,
  ScriptData,
  Episode,
  ScriptScene,
  ScriptCharacter,
} from "@/types/script";

/**
 * Làm sạch Cảnh chuỗi vị trí，Xóa nội dung không liên quan như thông tin nhân vật
 * Chẳng hạn như "đường nông thôn/nhân vật xe buýt：Thẩm Tinh Thanh、dân làng" -> "đường nông thôn/xe buýt"
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

/**
 * Phân tích K hoàn chỉnhịch bảvăn bản，Trích xuất NềnThông tin và nội dung tập phim
 */
export function parseFullScript(fullText: string): {
  background: ProjectBackground;
  episodes: EpisodeRawScript[];
} {
  const lines = fullText.split('\n');
  
  // 1. Trích xuất tiêu đề
  const titleMatch = fullText.match(/[《「]([^》」]+)[》」]/);
  const title = titleMatch ? titleMatch[1] : 'Không tên kịch bản';
  
  // 2. Trích xuất phác thảo（từ"phác thảo："Đến"Tiểu sử："nội dung giữa）
  // Hỗ trợ Markdown Định dạng：**phác thảo：** hoặc phác thảo： hoặc 【phác thảo】
  // kết thúc |$ Hãy ghi nhớ mọi thứ：Không có tiểu sử/Khớp với phần cuối của văn bản khi không có thẻ được đặt
  const outlineMatch = fullText.match(/(?:\*{0,2}phác thảo[：:]​?\*{0,2}|【phác thảo】)([\s\S]*?)(?=(?:\*{0,2}Tiểu sử[：:]|【nhân vật|Không.[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín mươi\d]+bộ|$))/i);
  const outline = outlineMatch ? outlineMatch[1].trim() : '';
  
  // 3. Trích xuất tiểu sử nhân vật（từ"Tiểu sử："Nội dung trước tập đầu tiên）
  // Hỗ trợ Markdown Định dạng：**Tiểu sử：** hoặc tiểu sử： hoặc 【Tiểu sử】
  // kết thúc |$ Hãy ghi nhớ mọi thứ：Khớp với phần cuối của văn bản khi không có thẻ được đặt
  const characterBiosMatch = fullText.match(/(?:\*{0,2}Tiểu sử[：:]\*{0,2}|【Tiểu sử】)([\s\S]*?)(?=\*{0,2}Không.[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín mươi\d]+bộ|$)/i);
  const characterBios = characterBiosMatch ? characterBiosMatch[1].trim() : '';
  
  // 4. Trích xuất kỷ nguyên Nền và Thờtôi cài đặt dòng
  const { era, timelineSetting, storyStartYear, storyEndYear } = extractTimelineInfo(outline, characterBios);
  
  // 5. Trích xuất Lôại（genre）
  const genre = detectGenre(outline, characterBios);
  
  // 6. Trích xuất thế giới quan/Phong cácài đặt ch
  const worldSetting = extractWorldSetting(outline, characterBios);
  
  // 7. Trích xuất từ khóa chủ đề
  const themes = extractThemes(outline, characterBios);
  
  // 8. Phân tích nội dung từng tập phim
  const episodes = parseEpisodes(fullText);
  
  return {
    background: {
      title,
      outline,
      characterBios,
      era,
      timelineSetting,
      storyStartYear,
      storyEndYear,
      genre,
      worldSetting,
      themes,
    },
    episodes,
  };
}

/**
 * Trích xuất Th từ đề cương và tiểu sửờtôi gian dòng thông tin
 */
function extractTimelineInfo(outline: string, characterBios: string): {
  era: string;
  timelineSetting?: string;
  storyStartYear?: number;
  storyEndYear?: number;
} {
  const fullText = `${outline}\n${characterBios}`;
  
  // 1. Trích xuất năm cụ thể（Chẳng hạn như"2002"、"1990-2020"、"Mùa hè 2022"）
  const yearPatterns = [
    // phạm vi năm：1990-2020、1990 đến 2020
    /(\d{4})\s*[- đến nơi~]\s*(\d{4})\s*năm?/,
    // Năm + mùa riêng biệt/Thời gian：mùa hè 2002、Đầu năm 2022
    /(\d{4}) năm[\u4e00-\u9fa5]{0,4}/,
    // một năm：2002
    /(\d{4}) năm/,
  ];
  
  let storyStartYear: number | undefined;
  let storyEndYear: number | undefined;
  let timelineSetting: string | undefined;
  
  // Cố gắng khớp phạm vi năm
  const rangeMatch = fullText.match(/(\d{4})\s*[- đến nơi~]\s*(\d{4})\s*năm?/);
  if (rangeMatch) {
    storyStartYear = parseInt(rangeMatch[1]);
    storyEndYear = parseInt(rangeMatch[2]);
    timelineSetting = `${storyStartYear}năm - ${storyEndYear}năm`;
  } else {
    // Cố gắng khớp một năm
    const singleYearMatch = fullText.match(/(\d{4})năm([\u4e00-\u9fa5]{0,6})/);
    if (singleYearMatch) {
      storyStartYear = parseInt(singleYearMatch[1]);
      const season = singleYearMatch[2] || '';
      timelineSetting = season ? `${storyStartYear}năm${season}` : `${storyStartYear}năm`;
    }
  }
  
  // 2. Trích xuất kỷ nguyên Nền（Chẳng hạn như"hiện đại"、"Cộng hòa Trung Quốc"、"nhà Đường"）
  const eraPatterns = [
    /(Hiện đại|đương đại|thời hiện đại|Cộng hòa Trung Quốc|Cuối nhà Thanh|nhà Thanh|nhà Minh|Nhà Tống|nhà Đường|nhà Hán|Tam Quốc|Thời Chiến Quốc|mùa xuân và mùa thu|thời cổ đại|thời cổ đại|tương lai)/,
    /(thế kỷ 20|thế kỷ XXI|thế kỷ 20|thế kỷ 21|\d{2}s)/,
  ];
  
  let era = 'hiện đại'; // Mặc định hiện đại
  for (const pattern of eraPatterns) {
    const eraMatch = fullText.match(pattern);
    if (eraMatch) {
      era = eraMatch[1];
      break;
    }
  }
  
  // 3. Suy ra niên đại dựa vào năm
  if (storyStartYear) {
    if (storyStartYear >= 2000) {
      era = 'hiện đại';
    } else if (storyStartYear >= 1949) {
      era = 'hiện đại（Trung Quốc mới）';
    } else if (storyStartYear >= 1912) {
      era = 'Cộng hòa Trung Quốc';
    } else if (storyStartYear >= 1840) {
      era = 'Cuối nhà Thanh/thời hiện đại';
    }
  }
  
  // 4. Khi không có từ khóa năm rõ ràng và không có năm，Chấp nhậSuy luận thuật ngữ cổ
  // Chỉ khi thời đại vẫn là Mặc địgiá trị nh 'hiện đại' Nó chỉ được suy ra khi không có hỗ trợ năm.
  if (era === 'hiện đại' && !storyStartYear) {
    // chức vụ chính thức cổ xưa/thuật ngữ chế độ phong kiến（độ tin cậy cao）
    const ancientInstitutionTerms = /Chúa thành phố|hoàng tử|Tỉnh trưởng|Thẩm phán quận|thủ tướng|hoàng tử|hoàng đế|Thái hậu|vợ lẽ|chung|chung|chung|cảnh sát trưởng|hầu tước|vua chư hầu/;
    // võ thuật/Thuật ngữ cổ xưa（độ tin cậy trung bình，Yêu cầu nhiều lượt truy cập）
    const ancientCultureTerms = /võ thuật|nội lực|tức giận|kiếm thuật|Kỹ năng dùng dao|giáo phái|vũ lâm|giang hồ|hiệp sĩ|anh hùng|lãnh đạo|đệ tử|Thanh Công|Vũ khí ẩn/;
    // Cổ Cảthuật ngữ nh
    const ancientSettingTerms = /tháp|quán trọ|Bưu điện|cổng thành|chính phủ|nha môn|doanh trại|cơ quan hộ tống|cửa hàng rượu|quán trà|biệt thự|cung điện/;
    
    if (ancientInstitutionTerms.test(fullText)) {
      era = 'thời cổ đại';
    } else {
      // Thuật ngữ văn hóa + Cảnh thuật ngữ xuất hiện đồng thời → Độ tin cậy cao cổ xưa
      const hasCulture = ancientCultureTerms.test(fullText);
      const hasSetting = ancientSettingTerms.test(fullText);
      if (hasCulture && hasSetting) {
        era = 'thời cổ đại';
      } else if (hasCulture) {
        // Chỉ thuật ngữ võ thuật，Có lẽ võ thuật hiện đại，Gắn thẻ đồ cổ
        era = 'thời cổ đại（suy luận）';
      }
    }
  }
  
  return {
    era,
    timelineSetting,
    storyStartYear,
    storyEndYear,
  };
}

/**
 * Phát hiện K từ phác thảo và tiểu sửịch bảnLoại（genre）
 * Phát hiện phổ quát，Đừng mã hóa Lo cụ thểạtôi đặt tên，Nhưng Chấp nhậkết hợp mẫu từ khóa
 */
function detectGenre(outline: string, characterBios: string): string {
  const fullText = `${outline}\n${characterBios}`;
  
  // LoạÁnh xạ iKeyword（Sắp xếp theo mức độ ưu tiên）
  const genrePatterns: Array<{ keywords: RegExp; genre: string }> = [
    { keywords: /võ thuật|giang hồ|giáo phái|võ thuật|thanh kiếm|Kỹ năng dùng dao|nội lực|vũ lâm/, genre: 'võ thuật' },
    { keywords: /Tiên Hạ|trồng trọt|hào quang|Vượt qua hoạn nạn|bay lên|vũ khí ma thuật|cội nguồn tâm linh/, genre: 'Tiên Hạ' },
    { keywords: /tưởng tượng|ma thuật|Một thế giới khác|tộc rồng|yêu tinh|Ác quỷ/, genre: 'tưởng tượng' },
    { keywords: /khoa học viễn tưởng|không gian|liên sao|người máy|AI|người ngoài hành tinh|thế giới tương lai/, genre: 'khoa học viễn tưởng' },
    { keywords: /Hồi hộp|giết người|Thám tử|lý luận|kẻ giết người|trường hợp|cảnh sát/, genre: 'Hồi hộp' },
    { keywords: /kinh dị|ma|siêu nhiên|Lời nguyền|bị ma ám/, genre: 'kinh dị' },
    { keywords: /chiến tranh kinh doanh|Bắt đầu kinh doanh|công ty|Vốn chủ sở hữu|Tài chính|Đã niêm yết|đế chế kinh doanh|doanh nghiệp/, genre: 'chiến tranh kinh doanh' },
    { keywords: /Cuộc chiến cung điện|hậu cung|vợ lẽ|hoàng đế|Thái hậu|bản nháp/, genre: 'Cuộc chiến cung điện' },
    { keywords: /đánh nhau trong nhà|trực tiếp Nữ|vợ lẽ|Đại Trại Môn|nhà trong/, genre: 'đánh nhau trong nhà' },
    { keywords: /chiến tranh gián điệp|đại lý|gián điệp|Mật khẩu|rình rập|trí thông minh/, genre: 'chiến tranh gián điệp' },
    { keywords: /quân sự|quân đội|chiến trường|quân đội|trại quân sự|chiến tranh/, genre: 'quân sự' },
    { keywords: /điều tra tội phạm|Interpol|Giải quyết vụ án|nghi ngờ|pháp y/, genre: 'điều tra tội phạm' },
    { keywords: /y tế|bệnh viện|phẫu thuật|bác sĩ|bệnh nhân|khẩn cấp/, genre: 'y tế' },
    { keywords: /pháp luật|luật sư|tòa án|bảo vệ|kiện tụng/, genre: 'pháp luật' },
    { keywords: /khuôn viên trường|trường đại học|trường trung học|bạn cùng lớp|trường học|giáo viên/, genre: 'khuôn viên trường' },
    { keywords: /tình yêu|yêu|tình yêu bí mật|Lời thú tội|ngọt ngào|chia tay/, genre: 'tình yêu' },
    { keywords: /gia đình|bố mẹ|anh trai|chị em|tình cảm gia đình|gia đình/, genre: 'gia đình' },
    { keywords: /Hài kịch|Hài hước|hài hước|buồn cười/, genre: 'Hài kịch' },
    { keywords: /Lịch sử|triều đình|hoàng đế|Bộ trưởng|Cải cách|cải cách/, genre: 'Lịch sử' },
    { keywords: /khu vực nông thôn|nông thôn|nông nghiệp|Thoát khỏi nghèo đói|hồi sinh/, genre: 'nông thôn' },
  ];
  
  for (const { keywords, genre } of genrePatterns) {
    if (keywords.test(fullText)) {
      return genre;
    }
  }
  
  return ''; // Để trống nếu không được phát hiện，Không mã hóa cứng Mặc địgiá trị nh
}

/**
 * Trích xuất thế giới quan từ phác thảo/Phong cácài đặt ch
 */
function extractWorldSetting(outline: string, characterBios: string): string {
  const fullText = `${outline}\n${characterBios}`;
  
  // Phù hợp với thế giới quan chung Mô tảchế độ
  const patterns = [
    /(?:Thế giới quan|Bối cảnh thế giới|Nềcài đặt)[：:] *([^\n]{10,200})/,
    /(?:Câu chuyện diễn ra ở|TruyệnNền[：: Vâng]) *([^\n]{10,200})/,
    /(?:thiết lập[：:]) *([^\n]{10,200})/,
  ];
  
  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return ''; // Không có thế giới quanMô tảsau đó để trống
}

/**
 * Trích xuất từ khóa chủ đề từ dàn ý
 */
function extractThemes(outline: string, characterBios: string): string[] {
  const fullText = `${outline}\n${characterBios}`;
  const themes: string[] = [];
  
  // Thư viện từ khóa chủ đề（phổ quát，Bao gồm tất cả các loại Kịch bản）
  const themePatterns: Array<{ keywords: RegExp; theme: string }> = [
    { keywords: /đấu tranh|đấu tranh|phản công|phát triển/, theme: 'đấu tranh' },
    { keywords: /Trả thù|trả thù|trả thù/, theme: 'Trả thù' },
    { keywords: /tình yêu|tình yêu|tình yêu đích thực|yêu/, theme: 'tình yêu' },
    { keywords: /tình cảm gia đình|gia đình|gia đình/, theme: 'tình cảm gia đình' },
    { keywords: /tình bạn|anh trai|lòng trung thành|lòng trung thành/, theme: 'tình bạn' },
    { keywords: /quyền lực|chiến đấu|Machiavellian|âm mưu/, theme: 'Machiavellian' },
    { keywords: /công lý|công bằng|pháp quyền|sự thật/, theme: 'công lý' },
    { keywords: /sự tự do|giải phóng|độc lập/, theme: 'sự tự do' },
    { keywords: /sự cứu chuộc|tha thứ|Hòa giải|ăn năn/, theme: 'sự cứu chuộc' },
    { keywords: /sự phản bội|phản bội|tin tưởng/, theme: 'sự phản bội và sự tin tưởng' },
    { keywords: /định mệnh|số phận|định mệnh/, theme: 'định mệnh' },
    { keywords: /chiến tranh|hòa bình|phản chiến/, theme: 'chiến tranh và hòa bình' },
    { keywords: /sự kế thừa|sự kế thừa|Sứ mệnh/, theme: 'sự kế thừa' },
    { keywords: /sự sống và cái chết|cuộc sống|cái chết|sự hy sinh/, theme: 'sự sống và cái chết' },
  ];
  
  for (const { keywords, theme } of themePatterns) {
    if (keywords.test(fullText) && !themes.includes(theme)) {
      themes.push(theme);
    }
  }
  
  return themes.slice(0, 5); // Lên tới Bến Lạchủ đề i5
}

/**
 * Phân tích từng tập Kịch bản
 */
export function parseEpisodes(text: string): EpisodeRawScript[] {
  const episodes: EpisodeRawScript[] = [];
  
  // thẻ tập hợp trận đấu：Tập X hoặc Tập：Tiêu đề
  // Hỗ trợ **Tập X** hoặc **Tập X：Tiêu đề** Định dạng
  const episodeRegex = /\*{0,2}Không. ([\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\d]+) đặt[\uff1a:]?\s*([^\n\*]*?)\*{0,2}(?=\n|$)/g;
  const matches = [...text.matchAll(episodeRegex)];
  
  if (matches.length === 0) {
    // Nếu không tìm thấy thẻ đặt，Coi toàn bộ văn bản như tập đầu tiên
    const scenes = parseScenes(text);
    return [{
      episodeIndex: 1,
      title: 'Tập 1',
      rawContent: text,
      scenes,
      shotGenerationStatus: 'idle',
    }];
  }
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const episodeIndex = chineseToNumber(match[1]);
    // tiêu đề rõ ràng：Xóa các khoảng trắng ở đầu và cuối và ** biểu tượng
    let rawTitle = match[2]?.trim().replace(/^\*+|\*+$/g, '').trim() || '';
    // Đảm bảo tiêu đề bao gồm số tập
    const episodeTitle = rawTitle 
      ? `Không.${episodeIndex}đặt：${rawTitle}` 
      : `Không.${episodeIndex}đặt`;
    
    // Nhận tập này（Từ tập hiện tại đến tập tiếp theo）
    const startIndex = match.index! + match[0].length;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index! : text.length;
    const rawContent = text.slice(startIndex, endIndex).trim();
    
    // Phân tích cú pháp Cảnh
    const scenes = parseScenes(rawContent);
    
    // Trích xuất các phần từ phụ đề
    const season = extractSeasonFromScenes(scenes);
    
    episodes.push({
      episodeIndex,
      title: episodeTitle,
      rawContent,
      scenes,
      shotGenerationStatus: 'idle',
      season,
    });
  }
  
  return episodes;
}

/**
 * Phân tích C trong một tập duy nhấtảnh
 */
export function parseScenes(episodeText: string): SceneRawContent[] {
  const scenes: SceneRawContent[] = [];
  
  // Cảnh đầuĐịnh dạtrận đấu：
  // **Trong vòng 1-1 ngày, Thượng Hải Zhangjia** hoặc
  // Trong vòng 1-1 ngày Thượng Hải Zhangjia hoặc
  // **2-3 đêm ngoài bến tàu**
  const sceneHeaderRegex = /\*{0,2}(\d+-\d+)\s*(Ngày|đêm|buổi sáng|chạng vạng|Hoàng hôn|Bình minh|sáng sớm|buổi tối)\s*(trong|Bên ngoài|bên trong\/bên ngoài)\s+([^\*\n]+)\*{0,2}/g;
  const sceneMatches = [...episodeText.matchAll(sceneHeaderRegex)];
  
  if (sceneMatches.length === 0) {
    // Không tìm thấy tiêu chuẩn Cảnh đầu，Hãy thử số-số lỏng lẻo Định dạng
    // Trận đấu như：1-1 Thế giới luật lệ và truyện ma，Quảng trường hội，Ngày hoặc 1-2 phòng phát sóng trực tiếp hội nghị toàn cầu，ngày
    const looseSceneRegex = /^\*{0,2}(\d+-\d+)\s+([^\*\n]+)\*{0,2}$/gm;
    const looseMatches = [...episodeText.matchAll(looseSceneRegex)];
    
    if (looseMatches.length > 0) {
      for (let i = 0; i < looseMatches.length; i++) {
        const match = looseMatches[i];
        const sceneNumber = match[1]; // Chẳng hạn như "1-1"
        const rawDesc = match[2].replace(/\*{1,2}/g, '').trim(); // Chẳng hạn như "Thế giới của những quy luật kỳ lạ，Quảng trường hội，ngày"
        
        // Trich xuat thoi diem (ngay/dem/buoi sang/chang vang...) thuong nam o cuoi mo ta
        const timeWords = ['ngày', 'đêm', 'buổi sáng', 'chạng vạng', 'Hoàng hôn', 'Bình minh', 'sáng sớm', 'buổi tối'];
        let timeOfDay = 'ngày'; // Gia tri mac dinh
        let locationDesc = rawDesc;
        
        // Kiem tra mo ta co ket thuc bang tu khoa thoi gian khong
        for (const tw of timeWords) {
          const endPattern = new RegExp(`[，,\\s]${tw}\\s*$`);
          if (endPattern.test(rawDesc)) {
            timeOfDay = tw;
            locationDesc = rawDesc.replace(endPattern, '').trim();
            break;
          }
          // Cung xu ly truong hop toan bo mo ta chi la tu khoa thoi gian
          if (rawDesc === tw) {
            timeOfDay = tw;
            locationDesc = 'Không rõ vị trí';
            break;
          }
        }
        
        // Thu trich xuat thong tin noi/ngoai canh
        let interior = '';
        const interiorMatch = locationDesc.match(/[，,\s](trong|Bên ngoài|bên trong\/bên ngoài)\s*/);
        if (interiorMatch) {
          interior = interiorMatch[1];
          locationDesc = locationDesc.replace(interiorMatch[0], '').trim();
        }
        
        // Chuan hoa dia diem, thay dau phay thanh khoang trang
        const location = locationDesc.replace(/[，,]/g, ' ').replace(/\s+/g, ' ').trim() || 'Không rõ vị trí';
        
        // Tao scene header chuan de cac buoc sau su dung
        const sceneHeader = interior 
          ? `${sceneNumber} ${timeOfDay} ${interior} ${location}`
          : `${sceneNumber} ${timeOfDay} ${location}`;
        
        // Lay noi dung canh
        const startIndex = match.index! + match[0].length;
        const endIndex = i < looseMatches.length - 1 ? looseMatches[i + 1].index! : episodeText.length;
        const content = episodeText.slice(startIndex, endIndex).trim();
        
        // Phân tích ký tự
        const characters = parseCharacters(content);
        const dialogues = parseDialogues(content);
        const actions = parseActions(content);
        const subtitles = parseSubtitles(content);
        const weather = detectWeather(content, actions);
        
        scenes.push({
          sceneHeader,
          characters,
          content,
          dialogues,
          actions,
          subtitles,
          weather,
          timeOfDay,
        });
      }
      return scenes;
    }
    
    // Neu dinh dang long cung khong khop, thu dinh dang thay the
    return parseAlternativeSceneFormat(episodeText);
  }
  
  for (let i = 0; i < sceneMatches.length; i++) {
    const match = sceneMatches[i];
    const sceneHeader = match[0].replace(/\*{1,2}/g, '').trim();
    const sceneNumber = match[1]; // Chẳng hạn như "1-1"
    const timeOfDay = match[2];   // Vi du: "ngày", "đêm"
    const interior = match[3];    // Vi du: "bên trong", "bên ngoài"
    const location = match[4]?.trim() || 'Không rõ vị trí';
    
    // Lay noi dung canh (tu canh hien tai den truoc canh tiep theo)
    const startIndex = match.index! + match[0].length;
    const endIndex = i < sceneMatches.length - 1 ? sceneMatches[i + 1].index! : episodeText.length;
    const content = episodeText.slice(startIndex, endIndex).trim();
    
    // Phân tích ký tự
    const characters = parseCharacters(content);
    
    // Phân tích đoạn hội thoại
    const dialogues = parseDialogues(content);
    
    // Phân tích Hành động
    const actions = parseActions(content);
    
    // Parse subtitles
    const subtitles = parseSubtitles(content);
    
    // Kiểm tra thời tiết
    const weather = detectWeather(content, actions);
    
    scenes.push({
      sceneHeader: `${sceneNumber} ${timeOfDay} ${interior} ${location}`,
      characters,
      content,
      dialogues,
      actions,
      subtitles,
      weather,
      timeOfDay,
    });
  }
  
  return scenes;
}

/**
 * phân tích thay thế CảnhĐịnh dạng（Khi đạt tiêu chuẩnĐịnh dạng không khớp）
 */
function parseAlternativeSceneFormat(text: string): SceneRawContent[] {
  const scenes: SceneRawContent[] = [];
  
  // Cố gắng phù hợp với những điểm chung khácĐịnh dạng
  // Định dạng1: CảnhX hoặc Cảnh X
  // Định dạng2: [CảnhMô tả]
  // Định dạng3: Chia trực tiếp theo đoạn văn
  
  const altRegex = /(?:Cảnh\s*(\d+)|【Cảnh[：:]?\s*([^\】]+)】)/g;
  const matches = [...text.matchAll(altRegex)];
  
  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const startIndex = match.index! + match[0].length;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : text.length;
      const content = text.slice(startIndex, endIndex).trim();
      
      scenes.push({
        sceneHeader: match[0].replace(/[【】]/g, ''),
        characters: parseCharacters(content),
        content,
        dialogues: parseDialogues(content),
        actions: parseActions(content),
        subtitles: parseSubtitles(content),
      });
    }
  } else {
    // dưới dạng một C đơnảnh chế biến
    scenes.push({
      sceneHeader: 'Chính Cảnh',
      characters: parseCharacters(text),
      content: text,
      dialogues: parseDialogues(text),
      actions: parseActions(text),
      subtitles: parseSubtitles(text),
    });
  }
  
  return scenes;
}

/**
 * Từ Cảnh nội dung và Hành độPhát hiện thời tiết trong mô tả ng
 */
function detectWeather(content: string, actions: string[]): string | undefined {
  const fullText = `${content} ${actions.join(' ')}`;
  
  // Phát hiện từ khóa thời tiết（phổ quát，Không mã hóa cụ thể Cảnh）
  if (/mưa lớn|mưa to|trận mưa như trút nước/.test(fullText)) return 'mưa lớn';
  if (/mưa nhẹ|mưa phùn|mưa phùn|Bối rối và chìm đắm/.test(fullText)) return 'mưa nhẹ';
  if (/mưa|người làm công việc pitter|làm ẩm/.test(fullText)) return 'mưa';
  if (/bão tuyết|Lông chim diều hâu tuyết dày/.test(fullText)) return 'bão tuyết';
  if (/tuyết|tuyết rơi|bông tuyết/.test(fullText)) return 'tuyết';
  if (/Sương mù dày đặc|Sương mù dày đặc/.test(fullText)) return 'Sương mù dày đặc';
  if (/sương mù|sương mù|sương mù/.test(fullText)) return 'sương mù';
  if (/gió mạnh|gió giật|cơn bão/.test(fullText)) return 'gió mạnh';
  if (/gió|Gió|gió mát/.test(fullText)) return 'Gió';
  if (/ngày nhiều mây|những đám mây đen|ảm đạm/.test(fullText)) return 'âm';
  if (/rõ ràng|mặt trời tươi sáng|ngày nắng|Không có mây/.test(fullText)) return 'rõ ràng';
  if (/sét và sấm sét|sấm sét|tia sét/.test(fullText)) return 'giông bão';
  
  return undefined; // Không phát hiện được thời tiết cụ thể
}

/**
 * Từ CảTrích xuất các phần từ phụ đề nh
 */
function extractSeasonFromScenes(scenes: SceneRawContent[]): string | undefined {
  for (const scene of scenes) {
    for (const subtitle of scene.subtitles) {
      // Khớp thông tin theo mùa trong phụ đề，Chẳng hạn như【phụ đề：Mùa hè 2002】
      const seasonMatch = subtitle.match(/(Mùa xuân?|Mùa hè?|Mùa thu?|Mùa đông?|đầu xuân|giữa hè|cuối thu|giữa mùa đông|Giữa hè|mùa xuân ấm áp|mùa đông lạnh)/);
      if (seasonMatch) {
        const s = seasonMatch[1];
        if (s.includes('mùa xuân')) return 'mùa xuân';
        if (s.includes('mùa hè')) return 'mùa hè';
        if (s.includes('mùa thu')) return 'mùa thu';
        if (s.includes('mùa đông')) return 'mùa đông';
      }
    }
  }
  return undefined;
}

/**
 * Phân tích cú pháp Cảký tự trong nh
 */
function parseCharacters(text: string): string[] {
  const characters: Set<string> = new Set();
  
  // 1. từ"nhân vật："trích xuất hàng
  const charLineMatch = text.match(/nhân vật[：:]\s*([^\n]+)/);
  if (charLineMatch) {
    const charList = charLineMatch[1].split(/[、,，]/);
    charList.forEach(c => {
      const name = c.trim();
      if (name) characters.add(name);
    });
  }
  
  // 2. Trích xuất người nói ra khỏi đoạn hội thoại
  const dialogueRegex = /^([^：:（\(【\n]{1,10})[：:](?:\s*[（\(][^）\)]+[）\)])?/gm;
  const dialogueMatches = [...text.matchAll(dialogueRegex)];
  dialogueMatches.forEach(m => {
    const name = m[1].trim();
    // Lọc Xóa tên không riêng tư
    if (name && !name.match(/^[△【Phụ đề thuyết minh VOCảnh]/)) {
      characters.add(name);
    }
  });
  
  return Array.from(characters);
}

/**
 * Phân tích đoạn hội thoại
 */
function parseDialogues(text: string): DialogueLine[] {
  const dialogues: DialogueLine[] = [];
  
  // đối thoạiĐịnh dạng：Nhân vậtên t：（Hành động）dòng
  // hoặc：Nhân vậtên t：dòng
  const dialogueRegex = /^([^：:（\(【\n△]{1,10})[：:]\s*(?:[（\(]([^）\)]+)[）\)])?\s*(.+)$/gm;
  
  const matches = [...text.matchAll(dialogueRegex)];
  
  for (const match of matches) {
    const character = match[1].trim();
    const parenthetical = match[2]?.trim();
    const line = match[3]?.trim();
    
    // Lọc Loại bỏ nội dung không có lời thoại
    if (character && line && !character.match(/^[Thuyết minh phụ đề Cảnh nhân vật]/)) {
      dialogues.push({
        character,
        parenthetical,
        line,
      });
    }
  }
  
  return dialogues;
}

/**
 * Phân tích Hành động mô tả（△dòng bắt đầu bằng）
 */
function parseActions(text: string): string[] {
  const actions: string[] = [];
  
  // △Bắt đầu bằng Hành động mô tả
  const actionRegex = /^△(.+)$/gm;
  const matches = [...text.matchAll(actionRegex)];
  
  matches.forEach(m => {
    const action = m[1].trim();
    if (action) actions.push(action);
  });
  
  return actions;
}

/**
 * Parse subtitles（【phụ đề：...】hoặc【VO：...】Đợi đã）
 */
function parseSubtitles(text: string): string[] {
  const subtitles: string[] = [];
  
  // 【phụ đề：...】hoặc【VO：...】hoặc【hồi tưởng】Đợi đã
  const subtitleRegex = /【([^】]+)】/g;
  const matches = [...text.matchAll(subtitleRegex)];
  
  matches.forEach(m => {
    subtitles.push(m[1]);
  });
  
  return subtitles;
}

/**
 * Chuyển đổi chữ số Trung Quốc sang chữ số Ả Rập
 */
function chineseToNumber(chinese: string): number {
  // nếu nó đã là một con số
  if (/^\d+$/.test(chinese)) {
    return parseInt(chinese, 10);
  }
  
  const chineseNums: Record<string, number> = {
    'không': 0, 'một': 1, 'Hai': 2, 'ba': 3, 'bốn': 4,
    'năm': 5, 'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9,
    'mười': 10, 'Trăm': 100, 'ngàn': 1000,
  };
  
  let result = 0;
  let temp = 0;
  let prevUnit = 1;
  
  for (const char of chinese) {
    const num = chineseNums[char];
    if (num === undefined) continue;
    
    if (num >= 10) {
      // là đơn vị（mười、Trăm、ngàn）
      if (temp === 0) temp = 1;
      result += temp * num;
      temp = 0;
      prevUnit = num;
    } else {
      temp = num;
    }
  }
  
  result += temp;
  return result || 1;
}

/**
 * Trích xuất Nh từ văn bản tiểu sửân vậthông tin t
 * Hỗ trợHai loạiĐịnh dạng：
 * 1. Nhỏ gọnĐịnh dạng：Nhân vậtên t：tuổi tác：Danh tính XX：... （từ từ/Văn bản được sao chép từ WeChat không ngắt dòng）
 * 2. Tiêu chuẩnĐịnh dạng：Nhân vậtên t：Mô tả hoặc Nhân vậtên t（tuổi tác）：Mô tả
 */
export function parseCharacterBios(bios: string): ScriptCharacter[] {
  if (!bios || !bios.trim()) return [];
  
  // Phát hiện nhỏ gọnĐịnh dạng：Nhân vậtên t：tuổi tác/Năm thứ hai：XX （Ít nhất 2 mục được coi là nhỏ gọnĐịnh dạng）
  const compactEntryRegex = /([\u4e00-\u9fa5]{2,12})[：:]\s*(?:Tuổi|Hai năm)[：:]\s*(\d{1,3})/g;
  const compactMatches = [...bios.matchAll(compactEntryRegex)];
  
  if (compactMatches.length >= 2) {
    return parseCompactBioFormat(bios, compactMatches);
  }
  
  // Tiêu chuẩnĐịnh dạvà điểm mấu chốt
  return parseStandardBioFormat(bios);
}

/**
 * Nhỏ gọnĐịnh dạphân tích cú pháp：Nhân vậtên t：tuổi tác：Danh tính XX：...hành động chính：...
 * Tự động loại bỏ dấu đoạn（một、Nhân vật chính cốt lõi, v.v.）Trích xuất Nh thựcân vậtên t
 */
function parseCompactBioFormat(bios: string, matches: RegExpMatchArray[]): ScriptCharacter[] {
  const characters: ScriptCharacter[] = [];
  let index = 1;
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    let rawName = match[1];
    const age = match[2];
    
    // Tách từ khóa khỏi đoạn văn để trích xuất Nh thậtân vậtên t
    const actualName = stripSectionKeywords(rawName);
    if (!actualName || actualName.length < 2 || actualName.length > 8) continue;
    
    // Trích xuất Mô tả：Từ tuổi này sang tuổi khác Nhân vậtrước khi nhập cảnh
    const descStart = match.index! + match[0].length;
    const descEnd = i < matches.length - 1 ? matches[i + 1].index! : bios.length;
    let description = bios.slice(descStart, descEnd).trim();
    
    // Xóa dấu đoạn ở cuối（Chẳng hạn như "ba、Lực Lượng Phản Diện Nhân vật"）
    description = description.replace(/\n?[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín mươi\d]+[、.]\s*[\u4e00-\u9fa5]*$/, '').trim();
    
    characters.push({
      id: `char_${index}`,
      name: actualName,
      age,
      role: description.substring(0, 300),
      personality: extractPersonality(description),
      traits: extractTraits(description),
    });
    index++;
  }
  
  console.log(`[parseCharacterBios] Nhỏ gọnĐịnh dạngPhát hiệnĐến ${characters.length} Nhân vật`);
  return characters;
}

/**
 * từ\u542b\u6bb5\u843d\u6807\u8bb0củatêntừtrongTrích xuất Nh thựcân vậtên t
 * Chẳng hạn như "nhân vật chính cốt lõi\u8427\u60ca\u9e3f" → "\u8427\u60ca\u9e3f"，"Lực dương Nhân vật\u8d75chung" → "\u8d75chung"
 */
function stripSectionKeywords(name: string): string {
  // 1. Xóasự khởi đầuTiếng Trung\u7f16\u53f7：một、 Hai. Đợi đã
  name = name.replace(/^[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín mươi\d]+[、.]\s*/, '');
  // 2. Xóa\u6bb5\u843d\u7c7b\u522bchìa khóa\u8bcd
  name = name.replace(
    /^(?:Lõi|chính|phía trước|mặt trái|nhân vật phản diện|lần\u8981|quan trọng|chìa khóa|\u7fa4\u4f17|đàng hoàng|\u5176\u4ed6)(?:quyền lực)?(?:Nhân vật|nhân vật chính|vai phụ|ký tự)?/,
    ''
  ).trim();
  return name;
}

/**
 * Tiêu chuẩnĐịnh dạphân tích cú pháp（\u539f\u903b\u8f91）：Nhân vậtên t：Mô tả hoặc Nhân vậtên t（tuổi tác）：Mô tả
 */
function parseStandardBioFormat(bios: string): ScriptCharacter[] {
  const characters: ScriptCharacter[] = [];
  
  const charRegex = /([^：:\n，,]+?)(?:[（\(](\d+tuổi?)[）\)])?[：:]\s*([^\n]+(?:\n(?![^：:\n]+[：:])[^\n]+)*)/g;
  const matches = [...bios.matchAll(charRegex)];
  
  let index = 1;
  for (const match of matches) {
    const name = match[1].trim();
    const age = match[2]?.replace('tuổi', '') || '';
    const description = match[3].trim();
    
    // bỏ qua\u975eNhân vậtbên trong\u5bb9
    if (name.length > 10 || name.match(/^[Không.Một, hai, ba, bốn, năm, sáu, bảy, tám, chín mươi\d]/)) continue;
    // bỏ qua\u5c5e\u6027nhãnvàbổ sungGiải thích
    if (/^(?:Tuổi|danh tính|nhân vật|bổ sung|Lưu ý|Bình luận|đặc điểm cốt lõi|hành vi chính)$/.test(name)) continue;
    
    characters.push({
      id: `char_${index}`,
      name,
      age,
      role: description,
      personality: extractPersonality(description),
      traits: extractTraits(description),
    });
    index++;
  }
  
  return characters;
}

/**
 * Từ Mô tảtrongTrích xuấtĐặc điểm tính cách
 */
function extractPersonality(description: string): string {
  // \u67e5\u627enhân vật\u76f8\u5173chìa khóa\u8bcd
  const personalityKeywords = ['nhân vật', 'cho\u4eba', '\u54c1\u6027', '\u813e\u6c14'];
  for (const keyword of personalityKeywords) {
    const match = description.match(new RegExp(`${keyword}[^，。,\.]+`));
    if (match) return match[0];
  }
  return '';
}

/**
 * Từ Mô tảtrongTrích xuấtđặc điểm cốt lõi
 */
function extractTraits(description: string): string {
  // \u67e5\u627e\u7279\u8d28\u76f8\u5173chìa khóa\u8bcd
  const traits: string[] = [];
  const traitPatterns = [
    /\u806a[\u660e\u6167]/, /vững chãi[Khó]/, /siêng năng[làm việc chăm chỉ]/, /trung thực/, /trung thực/,
    /chịu đựng gian khổ và chịu khó làm việc/, /xuống trái đất/, /tri ân/,
  ];
  
  for (const pattern of traitPatterns) {
    const match = description.match(pattern);
    if (match) traits.push(match[0]);
  }
  
  return traits.join('、');
}

/**
 * Clean Nhân vậtên t（\u53bb\u9664markdown\u6807\u8bb0và\u591a\u4f59biểu tượng）
 */
function cleanCharacterName(rawName: string): string {
  let name = rawName.trim();
  // \u53bb\u9664 markdown In đậm\u6807\u8bb0
  name = name.replace(/\*+/g, '');
  // \u53bb\u9664dấu ngoặc đơn\u53ca\u5176bên trong\u5bb9，Chẳng hạn như "\u738b\u8273（\u5468\u59bb）" -> "\u738b\u8273"
  name = name.replace(/[（\(][^）\)]*[）\)]?/g, '');
  // \u53bb\u9664\u5355\u72eccủa\u53f3dấu ngoặc đơn（\u622a\u65ad\u60c5\u51b5）
  name = name.replace(/[）\)]/g, '');
  // \u53bb\u9664\u5f15\u53f7
  name = name.replace(/["“”‘’"']/g, '');
  // \u53bb\u9664 VO/os \u540e\u7f00
  name = name.replace(/(VO|os)$/i, '');
  // \u53bb\u9664\u524d\u540e\u7a7a\u767dvà\u6807\u70b9
  name = name.replace(/^[\s,，、；;：:\u3000]+|[\s,，、；;：:\u3000]+$/g, '');
  return name.trim();
}

/**
 * \u62c6\u5206\u591a\u4eba\u7ec4\u5408têntừ，Chẳng hạn như "Trương Minh、\u8001\u5468" -> ["Trương Minh", "\u8001\u5468"]
 */
function splitMultipleCharacters(rawName: string): string[] {
  // đầu tiêndọn dẹp markdown
  let name = rawName.replace(/\*+/g, '').trim();
  // \u6309\u5e38\u89c1\u5206\u9694\u7b26\u62c6\u5206
  const parts = name.split(/[、,，\s]+/).filter(p => p.length > 0);
  return parts;
}

/**
 * \u68c0\u67e5\u662f\u5426choCó\u6548Nhân vậtên t（\u653e\u5bbdLọc，\u8ba9 AI \u505a\u667a\u80fd\u6821\u51c6）
 */
function isValidCharacterName(name: string): boolean {
  // bỏ qua\u7a7atêntừ
  if (!name || name.length < 1) return false;
  // bỏ qua\u592a\u957fcủatêntừ（\u653e\u5bbdĐến6từ，\u8ba9AI\u5224\u65ad）
  if (name.length > 6) return false;
  // bỏ qua\u7eafcon số
  if (/^\d+$/.test(name)) return false;
  // bỏ quachứa\u7279\u6b8abiểu tượngcủa
  if (/[\*\-\+\=\>\<\|\[\]\{\}]/.test(name)) return false;
  // bỏ qua\u660e\u663ecủa\u975eNhân vật\u8bcd（\u53eaLọc\u6700\u660e\u663ecủa，\u5176\u4ed6\u4ea4\u7ed9AI）
  const obviousNonCharacters = [
    'VO', 'tường thuật', 'os', '\u5de6\u8fb9', '\u53f3\u8fb9', 'trong\u95f4', '\u80cc\u5f71', 'xa\u5904',
    '\u6548\u7387', '\u56de\u6d41\u7387', '\u5206\u62e3', '\u5ba2\u6237', '\u773c\u7736', '\u5fae\u6e7f', 'cầm tay', '\u7b14\u633a',
    'Đã niêm yếtTệp', '\u773c\u795e', '\u58f0\u97f3', 'truyền hình', '\u7535\u8bdd'
  ];
  if (obviousNonCharacters.includes(name)) return false;
  return true;
}

/**
 * \u5904\u7406\u5355Nhân vậtên ttừ\u5e76ThêmĐếnđặt\u5408
 */
function processAndAddCharacter(
  rawName: string,
  existingNames: Set<string>,
  newCharacters: ScriptCharacter[],
  index: { value: number },
  role: string
): void {
  // đầu tiên\u62c6\u5206\u591a\u4eba\u7ec4\u5408
  const parts = splitMultipleCharacters(rawName);
  
  for (const part of parts) {
    const name = cleanCharacterName(part);
    if (!isValidCharacterName(name)) continue;
    if (existingNames.has(name)) continue;
    
    existingNames.add(name);
    newCharacters.push({
      id: `char_${index.value}`,
      name,
      role,
    });
    index.value++;
  }
}

/**
 * từTất cảCảnhtrongTrích xuất Ngoại hình Nhân vật（bổ sungTiểu sửtrong\u6ca1CóNhân vật）
 */
function extractCharactersFromScenes(
  episodeScripts: EpisodeRawScript[],
  existingCharacters: ScriptCharacter[]
): ScriptCharacter[] {
  const existingNames = new Set(existingCharacters.map(c => c.name));
  const newCharacters: ScriptCharacter[] = [];
  const index = { value: existingCharacters.length + 1 };
  
  // Thống kêMỗi Nhân vậtcủaSố lần xuất hiện
  const appearanceCount = new Map<string, number>();
  
  for (const ep of episodeScripts) {
    for (const scene of ep.scenes) {
      // Từ Cảnh characters từ\u6bb5Trích xuất
      for (const charName of scene.characters) {
        const parts = splitMultipleCharacters(charName);
        for (const part of parts) {
          const name = cleanCharacterName(part);
          if (isValidCharacterName(name)) {
            appearanceCount.set(name, (appearanceCount.get(name) || 0) + 1);
          }
        }
      }
      
      // từđối thoạitrongTrích xuấtnói\u4eba
      for (const dialogue of scene.dialogues) {
        const parts = splitMultipleCharacters(dialogue.character);
        for (const part of parts) {
          const name = cleanCharacterName(part);
          if (isValidCharacterName(name)) {
            appearanceCount.set(name, (appearanceCount.get(name) || 0) + 1);
          }
        }
      }
    }
  }
  
  // \u6309Số lần xuất hiệnSắp xếp，Thêm\u65b0Nhân vật
  const sortedNames = [...appearanceCount.entries()]
    .filter(([name]) => !existingNames.has(name))
    .sort((a, b) => b[1] - a[1]); // \u6309Số lần xuất hiện\u964d\u5e8f
  
  for (const [name, count] of sortedNames) {
    existingNames.add(name);
    newCharacters.push({
      id: `char_${index.value}`,
      name,
      role: count > 5 ? `quan trọngvai phụ（xuất hiện${count}lần）` : `MinorNhân vật（xuất hiện${count}lần）`,
    });
    index.value++;
  }
  
  return newCharacters;
}

/**
 * Liệu K được phân tích cú phápịch bảnChuyển sang ScriptData Định dạng（cho Hệ thốngdisplay）
 */
export function convertToScriptData(
  background: ProjectBackground,
  episodeScripts: EpisodeRawScript[]
): ScriptData {
  // 1. Trích xuất Nh chính từ tiểu sử nhân vậtân vật
  const mainCharacters = parseCharacterBios(background.characterBios);
  
  // 2. Từ CảBổ sung các Nh khác trong nhân vật
  const additionalCharacters = extractCharactersFromScenes(episodeScripts, mainCharacters);
  
  // 3. Hợp nhất Nhân vậdanh sách t（Nh của tiểu sửân vật xếp ở phía trước）
  const characters = [...mainCharacters, ...additionalCharacters];
  
  console.log(`[convertToScriptData] Nhân vậtThống kê: Tiểu sử ${mainCharacters.length} một, Cảnh bổ sung ${additionalCharacters.length} một, tổng cộng ${characters.length} một`);
  
  const episodes: Episode[] = [];
  const scenes: ScriptScene[] = [];
  
  let sceneIndex = 1;
  
  for (const ep of episodeScripts) {
    const episodeId = `ep_${ep.episodeIndex}`;
    const sceneIds: string[] = [];
    
    for (const scene of ep.scenes) {
      const sceneId = `scene_${sceneIndex}`;
      sceneIds.push(sceneId);
      
      // Phân tích cú pháp Cảnh đầu\u83b7\u53d6Thời gianvàvị trí
      // Hỗ trợHai loạiĐịnh dạng：
      // Tiêu chuẩnĐịnh dạng: "1-1 ngày bên trong vị trítên" (headerParts: [number, time, interior, ...location])
      // lỏng lẻoĐịnh dạng: "1-1 ngày vị trítên" (headerParts: [number, time, ...location])
      const headerParts = scene.sceneHeader.split(/\s+/);
      const timeOfDay = headerParts[1] || 'ngày';
      const hasInterior = headerParts[2] && /^(trong|Bên ngoài|bên trong\/bên ngoài)$/.test(headerParts[2]);
      const locationStartIndex = hasInterior ? 3 : 2;
      let rawLocation = headerParts.slice(locationStartIndex).join(' ') || headerParts[headerParts.length - 1] || 'Không rõ';
      
      // dọn dẹp location，Xóa nội dung không liên quan như thông tin nhân vật
      const location = cleanLocationString(rawLocation);
      
      scenes.push({
        id: sceneId,
        name: `${ep.episodeIndex}-${sceneIndex} ${location}`,
        location: location,
        time: normalizeTime(timeOfDay),
        atmosphere: detectAtmosphere(scene.content),
      });
      
      sceneIndex++;
    }
    
    episodes.push({
      id: episodeId,
      index: ep.episodeIndex,
      title: ep.title,
      description: extractEpisodeDescription(ep.rawContent),
      sceneIds,
    });
  }
  
  return {
    title: background.title,
    genre: detectGenre(background.outline, background.characterBios),
    logline: extractLogline(background.outline),
    language: 'Tiếng Trung',
    characters,
    episodes,
    scenes,
    storyParagraphs: [],
  };
}

/**
 * Tiêu chuẩn\u5316Thời gian
 */
function normalizeTime(time: string): string {
  const timeMap: Record<string, string> = {
    'ngày': 'day',
    'đêm': 'night',
    'buổi sáng': 'dawn',
    'chạng vạng': 'dusk',
    'Hoàng hôn': 'dusk',
    'Bình minh': 'dawn',
    'sáng sớm': 'dawn',
    'buổi tối': 'dusk',
  };
  return timeMap[time] || 'day';
}

/**
 * Phát hiệnCảbầu không khí nh
 */
function detectAtmosphere(content: string): string {
  if (content.match(/lo lắng|nguy hiểm|xung đột|chiến đấu|tức giận/)) return 'lo lắng';
  if (content.match(/Sự ấm áp|hạnh phúc|cười|Huân/)) return 'Sự ấm áp';
  if (content.match(/buồn|khóc|đau đớn|nước mắt/)) return 'buồn';
  if (content.match(/bí ẩn|kỳ lạ|bóng tối/)) return 'bí ẩn';
  return 'bình tĩnh';
}

// detectGenre Đã rồi\u79fb\u81f3Tệp\u9876\u90e8，Hỗ trợ\u5b8c\u6574củaLoạiPhát hiện

/**
 * Trích xuấtKịch bảnTổng quan
 */
function extractLogline(outline: string): string {
  // \u53d6phác thảocủaKhông.một\u53e5\u8bdd\u4f5cchoTổng quan
  const firstSentence = outline.match(/^[^。！？\n]+[。！？]/);
  return firstSentence ? firstSentence[0] : outline.slice(0, 100);
}

/**
 * Bộ trích xuấtTổng quan
 */
function extractEpisodeDescription(content: string): string {
  // \u53d6\u524d100mộttừ\u7b26\u4f5cchoTổng quan
  return content.replace(/\*{1,2}/g, '').slice(0, 100).trim() + '...';
}
