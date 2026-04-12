// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Scene Viewpoint Generator
 * 
 * Từ Cảnh dữ liệu hiệu chuẩn và Phân cảnhHành độTrích xuất G từ mô tả ngóc nhìnNhu cầu，
 * TạoNhiều Góc nhìđồ thị njointPrompt，cho Tạo Đồ thị khớp 6 ô。
 */

import type { ScriptScene, Shot } from '@/types/script';

// ==================== LoạiĐịnh nghĩa ====================

/**
 * CảnhGóc nhìnĐịnh nghĩa
 */
export interface SceneViewpoint {
  id: string;           // Góc nhìnID，Chẳng hạn như 'dining', 'sofa', 'window'
  name: string;         // Tên tiếng Trung：khu vực bàn ăn、khu vực ghế sofa、cửa sổ
  nameEn: string;       // tên tiếng anh：Dining Area, Sofa Area, Window
  shotIds: string[];    // liên kết tiến sĩân cảdanh sách nhID
  keyProps: string[];   // Góc nhìn Đạo cụ bắt buộc（Tiếng Trung）
  keyPropsEn: string[]; // Góc nhìn Đạo cụ bắt buộc（Tiếng Anh）
  description: string;  // Góc nhìnMô tả（Tiếng Trung）
  descriptionEn: string; // Góc nhìnMô tả（Tiếng Anh）
  gridIndex: number;    // V trong sơ đồ chungị trí (0-5)
}

/**
 * đồ thị chung TạoCấu hình
 */
export interface ContactSheetConfig {
  scene: ScriptScene;
  shots: Shot[];
  styleTokens: string[];
  aspectRatio: '16:9' | '9:16';
  maxViewpoints?: number; // Mặc định 6
}

/**
 * đồ thị chung TạoKết quả
 */
export interface ContactSheetPromptResult {
  prompt: string;           // Tiếng AnhNhắc
  promptZh: string;         // Lời nhắc tiếng Trung
  viewpoints: SceneViewpoint[];
  gridLayout: {
    rows: number;
    cols: number;
  };
}

// ==================== Môi trườngLoạiĐịnh nghĩa ====================

/**
 * CảnhMôi trườngLoại
 */
export type SceneEnvironmentType = 
  | 'vehicle'        // giao thông hiện đại（xe buýt、xe hơi、xe lửa、Máy bay vv.）
  | 'outdoor'        // ngoài trời hiện đại（đường cao tốc、đường phố、Công viên vv.）
  | 'indoor_home'    // nhà nội thất hiện đại
  | 'indoor_work'    // Nội thất văn phòng hiện đại/Kinh doanh
  | 'indoor_public'  // công cộng trong nhà hiện đại（bệnh viện、trường học、Nhà hàng vv.）
  | 'ancient_indoor' // nội thất cổ xưa（cung điện、biệt thự、quán trọ、đền thờ vv.）
  | 'ancient_outdoor'// ngoài trời cổ xưa（Cách chính thức、thị trường、cổng thành phố vv.）
  | 'ancient_vehicle'// giao thông cổ xưa（vận chuyển、ghế sedan、thuyền vv.）
  | 'unknown';       // Không rõ

/**
 * Môi trườngLoạtôi phát hiện từ khóa
 * để sử dụng từ Cảnh môi trường suy luận vị trí Loại
 */
const ENVIRONMENT_KEYWORDS: Record<SceneEnvironmentType, string[]> = {
  // === Cổ Cảnh（Ưu tiên phát hiện） ===
  ancient_indoor: [
    // cung điện/hoàng gia
    'cung điện', 'cung điện', 'cung điện', 'cung điện hoàng gia', 'cổng cung điện', 'tòa án bên trong', 'phòng học hoàng gia', 'Vườn Thượng Uyển', 'Hội trường hòa hợp tối cao', 'Cung điện Càn Thanh',
    'Ngồi ở Lý Cung', 'Lãnh Công', 'Đông Cung', 'Nishinomiya', 'hậu cung',
    // biệt thự/nhà ở
    'biệt thự', 'biệt thự', 'nhà ở', 'nhà ở', 'biệt thự', 'ngôi nhà cũ', 'nhà trong', 'nhà bên ngoài',
    'Sảnh chính', 'sảnh chính', 'tiền sảnh', 'đại sảnh', 'Hội trường',
    'boudoir', 'phòng trong', 'Tú Lâu', 'thư viện', 'sảnh hoa',
    // công trình công cộng
    'quán trọ', 'Nhà hàng', 'Cửu Túc', 'quán trà', 'quán trà', 'nhà hàng', 'ngôi đền', 'ngôi đền', 'ngôi đền', 'phòng thiền',
    'Đền thờ Đạo giáo', 'ni viện', 'Nhà trọ Long Môn', 'Nhà trọ Yuelai',
    'Kỳ Đường', 'Điều chỉnh cọc', 'phòng tang lễ', 'hội trường tổ tiên',
    'nha môn', 'tòa án', 'Đền Đại Lý',
    // căn phòng bê tông cổ kính
    'phòng học', 'phòng piano', 'hội trường bên trong', 'Phòng đếm', 'bồi bàn', 'nhà kho',
  ],
  ancient_outdoor: [
    // thành phố
    'cổng thành', 'bức tường thành', 'tháp', 'bên ngoài thành phố', 'Bên trong thành phố', 'kinh đô',
    'thị trường', 'đặt', 'thị trường', 'hội chợ chùa', 'chợ đêm', 'Đông Thạch', 'chợ tây',
    'đường phố', 'đường dài', 'làn đường', 'hẻm', 'Lối vào ngõ',
    'cổng vòm', 'hình vuông', 'Điện Giang Đài', 'sân trường',
    // đường/cuộc hành trình
    'Cách chính thức', 'Trạm', 'đường bưu điện', 'đường núi', 'đường núi', 'con đường cổ', 'Đường kinh doanh', 'đường phố',
    'Chết đã đến', 'Đường Nam', 'Đường Bắc',
    // tự nhiên/sân
    'sân', 'tòa án', 'bệnh viện', 'sân trước', 'sân sau', 'sân trong', 'sân ngoài',
    'vườn', 'Vườn sau', 'Vườn Thượng Uyển', 'ao', 'ao sen', 'dân tộc',
    'núi và cánh đồng', 'rừng', 'Lupan', 'Kiều Đầu', 'phà', 'bến tàu',
  ],
  ancient_vehicle: [
    'vận chuyển', 'xe hơi', 'ghế sedan', 'ghế sedan', 'Xe bò', 'con ngựa', 'cưỡi ngựa',
    'thuyền', 'tàu chở khách', 'tàu buôn', 'thuyền đánh cá', 'mặt sơn', 'thuyền', 'thuyền buồm', 'Thuấn',
    'bên trong xe', 'Bên trong chiếc sedan', 'Bên trong cabin', 'cabin',
  ],
  
  // === C hiện đạiảnh ===
  vehicle: [
    'xe buýt', 'xe buýt', 'xe buýt', 'xe hơi', 'xe hơi', 'Taxi', 'taxi', 'uber',
    'xe lửa', 'đường sắt tốc độ cao', 'EMU', 'tàu điện ngầm', 'xe lửa',
    'máy bay', 'chuyến bay', 'cabin',
    'du thuyền', 'phà', 'tàu', 'tàu du lịch',
    'bên trong xe', 'trong xe', 'vận chuyển',
  ],
  outdoor: [
    'đường cao tốc', 'đường', 'đường phố', 'đường phố', 'ven đường', 'ngã tư',
    'công viên', 'hình vuông', 'sân chơi', 'sân vận động',
    'nông thôn', 'lĩnh vực', 'núi', 'con sông', 'bờ biển', 'bãi biển', 'rừng', 'rừng',
    'sân', 'sân', 'vườn', 'mái nhà', 'mái nhà', 'mái nhà',
    'bãi đậu xe', 'trạm xăng',
  ],
  indoor_home: [
    'nhà', 'khu dân cư', 'căn hộ', 'biệt thự', 'ký túc xá',
    'phòng khách', 'phòng ngủ', 'nhà bếp', 'nhà hàng', 'phòng học', 'phòng tắm', 'phòng tắm', 'ban công',
    'phòng', 'trong nhà', 'trong nhà',
  ],
  indoor_work: [
    'văn phòng', 'công ty', 'tòa nhà văn phòng', 'phòng họp', 'nhà máy', 'xưởng', 'nhà kho',
    'cửa tiệm', 'cửa tiệm', 'siêu thị', 'trung tâm mua sắm',
  ],
  indoor_public: [
    'bệnh viện', 'phòng khám', 'Phường', 'phòng mổ',
    'trường học', 'lớp học', 'thư viện', 'căng tin',
    'nhà hàng', 'khách sạn', 'khách sạn', 'khách sạn', 'quán cà phê', 'thanh', 'KTV',
    'đồn cảnh sát', 'đồn cảnh sát', 'tòa án', 'nhà tù',
    'ngân hàng', 'bưu điện', 'sân bay', 'trạm', 'bến tàu',
  ],
  unknown: [],
};

/**
 * Làm sạch Cảnh chuỗi vị trí，Xóa nội dung không liên quan như thông tin nhân vật
 */
function cleanLocationString(location: string): string {
  // Xóa "nhân vật：XXX" một phần
  let cleaned = location.replace(/\s*nhân vật[：:].*/g, '');
  // Xóa "Nhân vật：XXX" một phần
  cleaned = cleaned.replace(/\s*Nhân vật[：:].*/g, '');
  // Xóa "Thời gian：XXX" một phần
  cleaned = cleaned.replace(/\s*Thời gian[：:].*/g, '');
  // Xóa khoảng trắng đầu và cuối
  return cleaned.trim();
}

/**
 * Từ Cảnh môi trường suy luận vị trí Loại
 */
export function detectEnvironmentType(location: string): SceneEnvironmentType {
  // Làm sạch chuỗi vị trí trước
  const cleanedLocation = cleanLocationString(location);
  const normalizedLocation = cleanedLocation.toLowerCase();
  
  console.log(`[detectEnvironmentType] Bản gốc: "${location}" -> Sau khi làm sạch: "${cleanedLocation}"`);
  
  // Phát hiện theo mức độ ưu tiên：thời cổ đại > giao thông hiện đại > ngoài trời > công cộng trong nhà > văn phòng trong nhà > nhà trong nhà
  const priorities: SceneEnvironmentType[] = [
    'ancient_vehicle', 'ancient_indoor', 'ancient_outdoor',  // Thời xa xưa đầu tiên
    'vehicle', 'outdoor', 'indoor_public', 'indoor_work', 'indoor_home'
  ];
  
  for (const envType of priorities) {
    const keywords = ENVIRONMENT_KEYWORDS[envType];
    for (const keyword of keywords) {
      if (normalizedLocation.includes(keyword)) {
        console.log(`[detectEnvironmentType] Phù hợp với từ khóa "${keyword}" -> Môi trườngLoại: ${envType}`);
        return envType;
      }
    }
  }
  
  console.log(`[detectEnvironmentType] Không có từ khóa nào phù hợp -> unknown`);
  return 'unknown';
}

// ==================== Góc nhìnÁnh xạ từ khóa ====================

/**
 * Góc nhìnCấu hình（Với khả năng tương thích môi trường）
 */
interface ViewpointConfig {
  id: string;
  name: string;
  nameEn: string;
  propsZh: string[];
  propsEn: string[];
  /** Môi trường tương thíchLoại，Mảng trống đại diện cho phổ quát */
  environments: SceneEnvironmentType[];
}

/**
 * Hành độtừ khóa ng -> Góc nhìnmap
 * Từ Phân cảnhHành độXác định G cần thiết trong ng mô tảóc nhìn
 * Mở rộng từ khóa để bao gồm ThêmCảnh
 * 
 * 【quan trọng】Trường môi trường điều khiển Góc nhìn Nó phù hợp với môi trường nào?ại
 * - mảng trống [] là viết tắt của chung Góc nhìn，Áp dụng cho Tất cảmôi trường
 * - Chỉ định môi trường Loạdanh sách tôi có nghĩa là chỉ phù hợp trong những môi trường này
 */
const VIEWPOINT_KEYWORDS: Record<string, ViewpointConfig> = {
  // ========== G cổ trong nhàóc nhìn (ancient_indoor) ==========
  // Sảnh chính/sảnh chính
  'Sảnh chính': { id: 'ancient_hall', name: 'Sảnh chính', nameEn: 'Main Hall', propsZh: ['Ghế Taishi', 'trường hợp', 'Shouping'], propsEn: ['taishi chair', 'table', 'screen'], environments: ['ancient_indoor'] },
  'sảnh chính': { id: 'ancient_hall', name: 'sảnh chính', nameEn: 'Main Hall', propsZh: ['Shouping', 'Ngồi vào chỗ'], propsEn: ['screen', 'main seat'], environments: ['ancient_indoor'] },
  'tiền sảnh': { id: 'ancient_hall', name: 'tiền sảnh', nameEn: 'Grand Hall', propsZh: ['trường hợp', 'lều gạc'], propsEn: ['table', 'gauze curtain'], environments: ['ancient_indoor'] },
  'đại sảnh': { id: 'ancient_hall', name: 'đại sảnh', nameEn: 'Reception Hall', propsZh: ['trường hợp', 'ghế rộng'], propsEn: ['table', 'armchair'], environments: ['ancient_indoor'] },
  // trường hợp/chỗ ngồi
  'trường hợp': { id: 'ancient_table', name: 'trường hợp', nameEn: 'Ancient Table', propsZh: ['trường hợp', 'bộ trà', 'bút và mực'], propsEn: ['table', 'tea set', 'brush and ink'], environments: ['ancient_indoor'] },
  'Tủ sách': { id: 'ancient_table', name: 'Tủ sách', nameEn: 'Writing Desk', propsZh: ['Tủ sách', 'Bút, mực, giấy và đá mực'], propsEn: ['writing desk', 'brush, ink, paper, inkstone'], environments: ['ancient_indoor'] },
  'ngồi trước vụ án': { id: 'ancient_table', name: 'trường hợp', nameEn: 'At the Table', propsZh: ['trường hợp'], propsEn: ['table'], environments: ['ancient_indoor'] },
  'bồi bàn': { id: 'ancient_table', name: 'Sảnh nhà hàng', nameEn: 'Tavern Hall', propsZh: ['bàn vuông', 'bình rượu', 'Món ăn'], propsEn: ['square table', 'wine pot', 'dishes'], environments: ['ancient_indoor'] },
  // màn hình/Lều ốc
  'màn hình': { id: 'ancient_screen', name: 'màn hình', nameEn: 'Screen View', propsZh: ['màn hình', 'rèm'], propsEn: ['screen', 'curtain'], environments: ['ancient_indoor'] },
  'lều gạc': { id: 'ancient_screen', name: 'lều gạc', nameEn: 'Gauze Curtain', propsZh: ['lều gạc', 'lều treo'], propsEn: ['gauze curtain', 'hanging drape'], environments: ['ancient_indoor'] },
  'Sau tài khoản': { id: 'ancient_screen', name: 'Sau tài khoản', nameEn: 'Behind the Curtain', propsZh: ['rèm'], propsEn: ['curtain'], environments: ['ancient_indoor'] },
  // boudoir/phòng trong
  'boudoir': { id: 'ancient_boudoir', name: 'boudoir', nameEn: 'Boudoir', propsZh: ['bàn trang điểm', 'Gương đồng', 'Hộp đựng đồ'], propsEn: ['dressing table', 'bronze mirror', 'makeup box'], environments: ['ancient_indoor'] },
  'mặc quần áo': { id: 'ancient_boudoir', name: 'bàn trang điểm', nameEn: 'Dressing Table', propsZh: ['bàn trang điểm', 'Gương đồng'], propsEn: ['dressing table', 'bronze mirror'], environments: ['ancient_indoor'] },
  'Tú Lâu': { id: 'ancient_boudoir', name: 'Tú Lâu', nameEn: 'Embroidery Chamber', propsZh: ['Giá thêu', 'chỉ thêu'], propsEn: ['embroidery frame', 'silk thread'], environments: ['ancient_indoor'] },
  // đi văng/giường
  'đi văng': { id: 'ancient_couch', name: 'đi văng', nameEn: 'Ancient Couch', propsZh: ['đi văng', 'bọc nệm'], propsEn: ['daybed', 'cushion'], environments: ['ancient_indoor'] },
  'Giường La Hán': { id: 'ancient_couch', name: 'Giường La Hán', nameEn: 'Arhat Bed', propsZh: ['Giường La Hán', 'bộ trà men ngọc'], propsEn: ['arhat bed', 'celadon tea set'], environments: ['ancient_indoor'] },
  'giường': { id: 'ancient_couch', name: 'giường', nameEn: 'Bed', propsZh: ['giường', 'lều ngủ'], propsEn: ['bed', 'bed curtain'], environments: ['ancient_indoor'] },
  'Xây dựng nhà xưởng': { id: 'ancient_couch', name: 'Lữ Thạch', nameEn: 'Bedroom', propsZh: ['giường', 'lều'], propsEn: ['bed', 'canopy'], environments: ['ancient_indoor'] },
  // Nghiên cứu thời cổ đại
  'vuốt một sợi tóc': { id: 'ancient_study', name: 'phòng học', nameEn: 'Study', propsZh: ['Bút, mực, giấy và đá mực', 'giá sách'], propsEn: ['four treasures of study', 'bookshelf'], environments: ['ancient_indoor'] },
  'Hãy lấy cây bút': { id: 'ancient_study', name: 'phòng học', nameEn: 'Study', propsZh: ['bàn chải viết', 'ngoài nền tảng'], propsEn: ['brush', 'inkstone'], environments: ['ancient_indoor'] },
  'đọc sách': { id: 'ancient_study', name: 'phòng học', nameEn: 'Study', propsZh: ['cuộn', 'đèn lồng nến'], propsEn: ['books', 'candle'], environments: ['ancient_indoor'] },
  // chùa phật giáo/Kỳ Đường
  'chùa phật giáo': { id: 'ancient_shrine', name: 'chùa phật giáo', nameEn: 'Buddha Hall', propsZh: ['tượng phật', 'Lư hương', 'nệm futon'], propsEn: ['Buddha statue', 'incense burner', 'cushion'], environments: ['ancient_indoor'] },
  'Hương': { id: 'ancient_shrine', name: 'chùa phật giáo', nameEn: 'Offering Incense', propsZh: ['Lư hương', 'thơm'], propsEn: ['incense burner', 'incense'], environments: ['ancient_indoor'] },
  'cầu nguyện qua': { id: 'ancient_shrine', name: 'Kỳ Đường', nameEn: 'Ancestral Hall', propsZh: ['nó hơi', 'đệm nhịp'], propsEn: ['memorial tablet', 'kneeling cushion'], environments: ['ancient_indoor'] },
  
  // ========== G ngoài trời cổ xưaóc nhìn (ancient_outdoor) ==========
  // sân
  'sân': { id: 'ancient_courtyard', name: 'sân', nameEn: 'Courtyard', propsZh: ['hòn non bộ', 'hồ bơi', 'hoa'], propsEn: ['rockery', 'pond', 'flower bed'], environments: ['ancient_outdoor'] },
  'sân trước': { id: 'ancient_courtyard', name: 'sân trước', nameEn: 'Front Yard', propsZh: ['bậc đá', 'hoa khóc'], propsEn: ['stone steps', 'hanging flowers'], environments: ['ancient_outdoor'] },
  'sân sau': { id: 'ancient_courtyard', name: 'sân sau', nameEn: 'Back Yard', propsZh: ['hoa', 'rừng tre'], propsEn: ['flower bed', 'bamboo grove'], environments: ['ancient_outdoor'] },
  // ao/dân tộc
  'ao': { id: 'ancient_pond', name: 'ao', nameEn: 'Pond View', propsZh: ['ao sen', 'cầu gỗ', '\u4e9d'], propsEn: ['lotus pond', 'wooden bridge', 'pavilion'], environments: ['ancient_outdoor'] },
  'ao sen': { id: 'ancient_pond', name: 'ao sen', nameEn: 'Lotus Pond', propsZh: ['lá sen', 'hoa sen', 'Vỏ sen'], propsEn: ['lotus leaves', 'lotus flowers', 'lotus seedpod'], environments: ['ancient_outdoor'] },
  'dân tộc': { id: 'ancient_pavilion', name: 'dân tộc', nameEn: 'Pavilion', propsZh: ['\u4e9d', 'ghế đá', 'lan can'], propsEn: ['pavilion', 'stone bench', 'railing'], environments: ['ancient_outdoor'] },
  'nước chảy': { id: 'ancient_pond', name: 'cảnh nước', nameEn: 'Water View', propsZh: ['Tiểu Kiều', 'nước chảy'], propsEn: ['bridge', 'stream'], environments: ['ancient_outdoor'] },
  // Cách chính thức/đường phố
  'Cách chính thức': { id: 'ancient_road', name: 'Cách chính thức', nameEn: 'Official Road', propsZh: ['Cách chính thức', 'cây thông và cây bách'], propsEn: ['road', 'pine trees'], environments: ['ancient_outdoor'] },
  'Trạm': { id: 'ancient_road', name: 'Trạm', nameEn: 'Post Station', propsZh: ['Trạm', 'ổn định'], propsEn: ['post station', 'stable'], environments: ['ancient_outdoor'] },
  'Trên đường đi': { id: 'ancient_road', name: 'đường', nameEn: 'Road', propsZh: ['đường'], propsEn: ['road'], environments: ['ancient_outdoor'] },
  // thị trường/cổng thành
  'thị trường': { id: 'ancient_market', name: 'thị trường', nameEn: 'Market', propsZh: ['thị trường', 'con lắc', 'đám đông'], propsEn: ['market', 'stalls', 'crowd'], environments: ['ancient_outdoor'] },
  'cổng thành': { id: 'ancient_gate', name: 'cổng thành', nameEn: 'City Gate', propsZh: ['cổng thành', 'bức tường thành', 'người lính'], propsEn: ['city gate', 'city wall', 'soldiers'], environments: ['ancient_outdoor'] },
  'tháp': { id: 'ancient_gate', name: 'tháp', nameEn: 'City Tower', propsZh: ['tháp', 'bức tường thành'], propsEn: ['city tower', 'city wall'], environments: ['ancient_outdoor'] },
  // bến tàu/phà
  'bến tàu': { id: 'ancient_dock', name: 'bến tàu', nameEn: 'Dock', propsZh: ['Manya', 'tàu', 'cáp'], propsEn: ['wooden pier', 'boats', 'mooring rope'], environments: ['ancient_outdoor'] },
  'phà': { id: 'ancient_dock', name: 'phà', nameEn: 'Ferry Crossing', propsZh: ['phà', 'nước sông'], propsEn: ['ferry boat', 'river'], environments: ['ancient_outdoor'] },
  
  // ========== Giao thông cổ xưaGóc nhìn (ancient_vehicle) ==========
  // vận chuyển/ghế sedan
  'ghế sedan': { id: 'ancient_sedan', name: 'Bên trong chiếc sedan', nameEn: 'Sedan Chair', propsZh: ['rèm xe', 'Bên trong chiếc sedan'], propsEn: ['sedan curtain', 'sedan interior'], environments: ['ancient_vehicle'] },
  'Bên trong chiếc sedan': { id: 'ancient_sedan', name: 'Bên trong chiếc sedan', nameEn: 'Inside Sedan', propsZh: ['rèm xe', 'đệm'], propsEn: ['sedan curtain', 'cushion'], environments: ['ancient_vehicle'] },
  'Lên xe sedan': { id: 'ancient_sedan', name: 'cửa xe', nameEn: 'Entering Sedan', propsZh: ['cửa xe', 'rèm xe'], propsEn: ['sedan door', 'curtain'], environments: ['ancient_vehicle'] },
  'Xuống xe sedan': { id: 'ancient_sedan', name: 'cửa xe', nameEn: 'Exiting Sedan', propsZh: ['cửa xe'], propsEn: ['sedan door'], environments: ['ancient_vehicle'] },
  'vận chuyển': { id: 'ancient_carriage', name: 'bên trong xe', nameEn: 'Carriage', propsZh: ['Khung xe', 'đệm'], propsEn: ['carriage canopy', 'cushion'], environments: ['ancient_vehicle'] },
  'bên trong xe': { id: 'ancient_carriage', name: 'bên trong xe', nameEn: 'Inside Carriage', propsZh: ['Khung xe', 'Rèm cửa'], propsEn: ['canopy', 'window curtain'], environments: ['ancient_vehicle'] },
  // tàu
  'cabin': { id: 'ancient_boat', name: 'cabin', nameEn: 'Boat Cabin', propsZh: ['cabin', 'cửa sổ'], propsEn: ['cabin', 'window'], environments: ['ancient_vehicle'] },
  'Bên trong cabin': { id: 'ancient_boat', name: 'cabin', nameEn: 'Inside Cabin', propsZh: ['cabin', 'cửa sổ', 'Mục Phương'], propsEn: ['cabin', 'window', 'wooden table'], environments: ['ancient_vehicle'] },
  'boong tàu': { id: 'ancient_deck', name: 'boong tàu', nameEn: 'Ship Deck', propsZh: ['boong tàu', 'thân thùng', 'cánh buồm'], propsEn: ['deck', 'mast', 'sail'], environments: ['ancient_vehicle'] },
  'cúi đầu': { id: 'ancient_deck', name: 'cúi đầu', nameEn: 'Bow', propsZh: ['cúi đầu', 'thân thùng'], propsEn: ['bow', 'mast'], environments: ['ancient_vehicle'] },
  'nghiêm khắc': { id: 'ancient_deck', name: 'nghiêm khắc', nameEn: 'Stern', propsZh: ['nghiêm khắc', 'khó khăn'], propsEn: ['stern', 'rudder'], environments: ['ancient_vehicle'] },
  // cưỡi ngựa
  'cưỡi ngựa': { id: 'ancient_horse', name: 'cưỡi ngựa', nameEn: 'On Horseback', propsZh: ['con ngựa', 'dây cương', 'yên ngựa'], propsEn: ['horse', 'reins', 'saddle'], environments: ['ancient_vehicle'] },
  'Gắn ngựa của bạn': { id: 'ancient_horse', name: 'cưỡi ngựa', nameEn: 'Mounting', propsZh: ['bàn đạp', 'yên ngựa'], propsEn: ['stirrup', 'saddle'], environments: ['ancient_vehicle'] },
  'tháo dỡ': { id: 'ancient_horse', name: 'cưỡi ngựa', nameEn: 'Dismounting', propsZh: ['con ngựa'], propsEn: ['horse'], environments: ['ancient_vehicle'] },
  'phi nước đại': { id: 'ancient_horse', name: 'cưỡi ngựa', nameEn: 'Galloping', propsZh: ['con ngựa', 'dây cương'], propsEn: ['horse', 'reins'], environments: ['ancient_vehicle'] },
  
  // ========== Giao thông hiện đạiGóc nhìn (vehicle) ==========
  // cửa sổ xe Góc nhìn
  'cửa sổ xe hơi': { id: 'vehicle_window', name: 'cửa sổ xe hơi', nameEn: 'Vehicle Window View', propsZh: ['cửa sổ xe hơi', 'Khung cảnh bên ngoài cửa sổ'], propsEn: ['vehicle window', 'outside scenery'], environments: ['vehicle'] },
  'Khung cảnh bên ngoài cửa sổ': { id: 'vehicle_window', name: 'cửa sổ xe hơi', nameEn: 'Vehicle Window View', propsZh: ['cửa sổ xe hơi', 'phong cảnh'], propsEn: ['vehicle window', 'scenery'], environments: ['vehicle'] },
  // Ghế ngồi ô tô Góc nhìn
  'chỗ ngồi': { id: 'vehicle_seat', name: 'khu vực chỗ ngồi', nameEn: 'Seat Area', propsZh: ['chỗ ngồi', 'bàn tay phẳng'], propsEn: ['seat', 'armrest'], environments: ['vehicle'] },
  'ghế ngồi ô tô': { id: 'vehicle_seat', name: 'khu vực chỗ ngồi', nameEn: 'Seat Area', propsZh: ['ghế ngồi ô tô'], propsEn: ['vehicle seat'], environments: ['vehicle'] },
  'ngồi': { id: 'vehicle_seat', name: 'khu vực chỗ ngồi', nameEn: 'Seat Area', propsZh: ['chỗ ngồi'], propsEn: ['seat'], environments: ['vehicle'] },
  // Lối đi trong xe Góc nhìn
  'lối đi': { id: 'vehicle_aisle', name: 'lối đi', nameEn: 'Aisle View', propsZh: ['lối đi', 'tay vịn'], propsEn: ['aisle', 'handrail'], environments: ['vehicle'] },
  // Vị trí lái Góc nhìn
  'lái xe': { id: 'vehicle_driver', name: 'ghế lái', nameEn: 'Driver Area', propsZh: ['vô lăng', 'Trang tổng quan'], propsEn: ['steering wheel', 'dashboard'], environments: ['vehicle'] },
  'người lái xe': { id: 'vehicle_driver', name: 'ghế lái', nameEn: 'Driver Area', propsZh: ['vô lăng'], propsEn: ['steering wheel'], environments: ['vehicle'] },
  // Cửa Góc nhìn
  'cửa xe': { id: 'vehicle_door', name: 'cửa xe', nameEn: 'Vehicle Door', propsZh: ['cửa xe', 'bước'], propsEn: ['vehicle door', 'steps'], environments: ['vehicle'] },
  'Lên xe buýt': { id: 'vehicle_door', name: 'cửa xe', nameEn: 'Vehicle Door', propsZh: ['cửa xe', 'bước'], propsEn: ['vehicle door', 'steps'], environments: ['vehicle'] },
  'Xuống xe': { id: 'vehicle_door', name: 'cửa xe', nameEn: 'Vehicle Door', propsZh: ['cửa xe', 'bước'], propsEn: ['vehicle door', 'steps'], environments: ['vehicle'] },
  
  // ========== ngoài trờiGóc nhìn (outdoor) ==========
  // Đường Góc nhìn
  'ven đường': { id: 'roadside', name: 'ven đường', nameEn: 'Roadside View', propsZh: ['đường', 'lề đường'], propsEn: ['road', 'curb'], environments: ['outdoor'] },
  'đường': { id: 'roadside', name: 'đường', nameEn: 'Road View', propsZh: ['đường', 'cây cối'], propsEn: ['road', 'trees'], environments: ['outdoor'] },
  'đường phố': { id: 'street', name: 'quang cảnh đường phố', nameEn: 'Street View', propsZh: ['đường phố', 'đèn đường', 'cửa tiệm'], propsEn: ['street', 'streetlight', 'shops'], environments: ['outdoor'] },
  // phong cảnh thiên nhiên Góc nhìn
  'núi': { id: 'nature', name: 'phong cảnh thiên nhiên', nameEn: 'Nature View', propsZh: ['núi'], propsEn: ['mountains'], environments: ['outdoor'] },
  'con sông': { id: 'nature', name: 'phong cảnh thiên nhiên', nameEn: 'Nature View', propsZh: ['con sông'], propsEn: ['river'], environments: ['outdoor'] },
  'cây': { id: 'nature', name: 'phong cảnh thiên nhiên', nameEn: 'Nature View', propsZh: ['cây cối', 'lá'], propsEn: ['trees', 'leaves'], environments: ['outdoor'] },
  // Sân Góc nhìn
  'vườn': { id: 'garden', name: 'vườn', nameEn: 'Garden View', propsZh: ['hoa', 'thực vật'], propsEn: ['flowers', 'plants'], environments: ['outdoor'] },
  // ========== Nhà trong nhàGóc nhìn (indoor_home) ==========
  // bàn ăn/Liên quan đến bữa ăn
  'ăn': { id: 'dining', name: 'khu vực bàn ăn', nameEn: 'Dining Area', propsZh: ['bàn ăn', 'Bộ đồ ăn', 'Món ăn'], propsEn: ['dining table', 'bowls and chopsticks', 'dishes'], environments: ['indoor_home', 'indoor_public'] },
  'bàn ăn': { id: 'dining', name: 'khu vực bàn ăn', nameEn: 'Dining Area', propsZh: ['bàn ăn', 'Bộ đồ ăn', 'Món ăn'], propsEn: ['dining table', 'bowls and chopsticks', 'dishes'], environments: ['indoor_home', 'indoor_public'] },
  'bữa ăn': { id: 'dining', name: 'khu vực bàn ăn', nameEn: 'Dining Area', propsZh: ['bàn ăn', 'Bộ đồ ăn', 'Món ăn'], propsEn: ['dining table', 'bowls and chopsticks', 'dishes'], environments: ['indoor_home', 'indoor_public'] },
  'uống': { id: 'dining', name: 'khu vực bàn ăn', nameEn: 'Dining Area', propsZh: ['bàn ăn', 'ly rượu'], propsEn: ['dining table', 'wine glass'], environments: ['indoor_home', 'indoor_public'] },
  'Kính kêu leng keng': { id: 'dining', name: 'khu vực bàn ăn', nameEn: 'Dining Area', propsZh: ['bàn ăn', 'ly rượu'], propsEn: ['dining table', 'glasses'], environments: ['indoor_home', 'indoor_public'] },
  'bánh mì nướng': { id: 'dining', name: 'khu vực bàn ăn', nameEn: 'Dining Area', propsZh: ['bàn ăn', 'ly rượu'], propsEn: ['dining table', 'glasses'], environments: ['indoor_home', 'indoor_public'] },
  
  // Sofa/Phòng khách liên quan - chỉ trong nhà
  'Sofa': { id: 'sofa', name: 'khu vực ghế sofa', nameEn: 'Sofa Area', propsZh: ['Sofa', 'bàn cà phê', 'truyền hình'], propsEn: ['sofa', 'coffee table', 'TV'], environments: ['indoor_home'] },
  'xem tivi': { id: 'sofa', name: 'khu vực ghế sofa', nameEn: 'Sofa Area', propsZh: ['Sofa', 'truyền hình'], propsEn: ['sofa', 'television'], environments: ['indoor_home'] },
  'bàn cà phê': { id: 'sofa', name: 'khu vực ghế sofa', nameEn: 'Sofa Area', propsZh: ['Sofa', 'bàn cà phê'], propsEn: ['sofa', 'coffee table'], environments: ['indoor_home'] },
  'rót trà': { id: 'sofa', name: 'khu vực ghế sofa', nameEn: 'Sofa Area', propsZh: ['Sofa', 'bàn cà phê', 'ấm trà'], propsEn: ['sofa', 'coffee table', 'teapot'], environments: ['indoor_home', 'indoor_work'] },
  'uống trà': { id: 'sofa', name: 'khu vực ghế sofa', nameEn: 'Sofa Area', propsZh: ['Sofa', 'bàn cà phê', 'tách trà'], propsEn: ['sofa', 'coffee table', 'teacup'], environments: ['indoor_home', 'indoor_work'] },
  
  // Liên quan đến cửa sổ - sử dụng trong nhà
  'cửa sổ': { id: 'window', name: 'cửa sổ', nameEn: 'Window View', propsZh: ['các cửa sổ', 'Rèm cửa'], propsEn: ['window', 'curtains'], environments: ['indoor_home', 'indoor_work', 'indoor_public'] },
  'bên ngoài cửa sổ': { id: 'window', name: 'cửa sổ', nameEn: 'Window View', propsZh: ['các cửa sổ', 'Rèm cửa', 'ánh sáng tự nhiên'], propsEn: ['window', 'curtains', 'natural light'], environments: ['indoor_home', 'indoor_work', 'indoor_public'] },
  'ban công': { id: 'window', name: 'cửa sổ/ban công', nameEn: 'Balcony View', propsZh: ['ban công', 'lan can'], propsEn: ['balcony', 'railing'], environments: ['indoor_home'] },
  'Rèm cửa': { id: 'window', name: 'cửa sổ', nameEn: 'Window View', propsZh: ['các cửa sổ', 'Rèm cửa'], propsEn: ['window', 'curtains'], environments: ['indoor_home', 'indoor_work'] },
  // lối vào/Liên quan đến cửa - sử dụng trong nhà
  'ngưỡng cửa': { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', propsZh: ['cửa', 'Lối vào'], propsEn: ['door', 'entrance'], environments: ['indoor_home', 'indoor_work', 'indoor_public'] },
  'cửa': { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', propsZh: ['cửa', 'Lối vào'], propsEn: ['door', 'entrance'], environments: ['indoor_home', 'indoor_work', 'indoor_public'] },
  'Vào đi': { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', propsZh: ['cửa', 'Lối vào'], propsEn: ['door', 'entrance'], environments: ['indoor_home', 'indoor_work', 'indoor_public'] },
  'đi ra ngoài': { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', propsZh: ['cửa'], propsEn: ['door'], environments: ['indoor_home', 'indoor_work', 'indoor_public'] },
  'về nhà': { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', propsZh: ['cửa', 'Lối vào'], propsEn: ['door', 'entrance'], environments: ['indoor_home'] },
  'bước vào': { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', propsZh: ['cửa'], propsEn: ['door'], environments: ['indoor_home', 'indoor_work', 'indoor_public'] },
  'rời đi': { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', propsZh: ['cửa'], propsEn: ['door'], environments: ['indoor_home', 'indoor_work', 'indoor_public'] },
  'Thay giày': { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', propsZh: ['Lối vào', 'tủ giày'], propsEn: ['entrance', 'shoe cabinet'], environments: ['indoor_home'] },
  
  // Liên quan đến Nhà bếp - Chỉ trong nhà
  'nhà bếp': { id: 'kitchen', name: 'nhà bếp', nameEn: 'Kitchen', propsZh: ['bếp lò', 'tủ'], propsEn: ['stove', 'cabinets'], environments: ['indoor_home'] },
  'nấu ăn': { id: 'kitchen', name: 'nhà bếp', nameEn: 'Kitchen', propsZh: ['bếp lò', 'chậu'], propsEn: ['stove', 'cookware'], environments: ['indoor_home'] },
  'xào': { id: 'kitchen', name: 'nhà bếp', nameEn: 'Kitchen', propsZh: ['bếp lò', 'chậu'], propsEn: ['stove', 'wok'], environments: ['indoor_home'] },
  'rửa bát': { id: 'kitchen', name: 'nhà bếp', nameEn: 'Kitchen', propsZh: ['bồn rửa', 'món ăn'], propsEn: ['sink', 'dishes'], environments: ['indoor_home'] },
  'tủ lạnh': { id: 'kitchen', name: 'nhà bếp', nameEn: 'Kitchen', propsZh: ['tủ lạnh'], propsEn: ['refrigerator'], environments: ['indoor_home'] },
  
  // phòng học/Công Việc Liên Quan - Nội thất Nhà + Văn Phòng
  'bàn': { id: 'study', name: 'phòng học/bàn', nameEn: 'Study Area', propsZh: ['bàn', 'đèn bàn', 'giá sách'], propsEn: ['desk', 'lamp', 'bookshelf'], environments: ['indoor_home', 'indoor_work'] },
  'máy tính': { id: 'study', name: 'phòng học/bàn', nameEn: 'Study Area', propsZh: ['bàn', 'máy tính'], propsEn: ['desk', 'computer'], environments: ['indoor_home', 'indoor_work'] },
  'đọc một cuốn sách': { id: 'study', name: 'phòng học/bàn', nameEn: 'Study Area', propsZh: ['bàn', 'đèn bàn'], propsEn: ['desk', 'lamp'], environments: ['indoor_home', 'indoor_public'] },
  'viết': { id: 'study', name: 'phòng học/bàn', nameEn: 'Study Area', propsZh: ['bàn', 'đèn bàn'], propsEn: ['desk', 'lamp'], environments: ['indoor_home', 'indoor_work'] },
  'văn phòng': { id: 'study', name: 'phòng học/bàn', nameEn: 'Study Area', propsZh: ['bàn', 'máy tính'], propsEn: ['desk', 'computer'], environments: ['indoor_work'] },
  'Tệp': { id: 'study', name: 'phòng học/bàn', nameEn: 'Study Area', propsZh: ['bàn', 'Tệp'], propsEn: ['desk', 'documents'], environments: ['indoor_home', 'indoor_work'] },
  'giá sách': { id: 'study', name: 'phòng học/bàn', nameEn: 'Study Area', propsZh: ['giá sách', 'sách'], propsEn: ['bookshelf', 'books'], environments: ['indoor_home', 'indoor_work', 'indoor_public'] },
  
  // Liên quan đến phòng ngủ - phải đề cập rõ ràng đến giường hoặc phòng ngủ
  'phòng ngủ': { id: 'bedroom', name: 'phòng ngủ', nameEn: 'Bedroom', propsZh: ['giường', 'bàn cạnh giường ngủ'], propsEn: ['bed', 'nightstand'], environments: ['indoor_home'] },
  'thức dậy': { id: 'bedroom', name: 'phòng ngủ', nameEn: 'Bedroom', propsZh: ['giường', 'bàn cạnh giường ngủ'], propsEn: ['bed', 'nightstand'], environments: ['indoor_home'] },
  'đầu giường': { id: 'bedroom', name: 'phòng ngủ', nameEn: 'Bedroom', propsZh: ['giường', 'bàn cạnh giường ngủ', 'đèn bàn'], propsEn: ['bed', 'nightstand', 'lamp'], environments: ['indoor_home'] },
  
  // ========== Phổ Góc nhìn（Áp dụng cho Tất cảmôi trường） ==========
  // \u5bf9\u8bdd/Cảm xúcCảnh - chung
  'nói chuyện': { id: 'conversation', name: 'khu vực đối thoại', nameEn: 'Conversation Area', propsZh: [], propsEn: [], environments: [] },
  'trò chuyện': { id: 'conversation', name: 'khu vực đối thoại', nameEn: 'Conversation Area', propsZh: [], propsEn: [], environments: [] },
  'nói': { id: 'conversation', name: 'khu vực đối thoại', nameEn: 'Conversation Area', propsZh: [], propsEn: [], environments: [] },
  'cãi nhau': { id: 'conversation', name: 'khu vực đối thoại', nameEn: 'Conversation Area', propsZh: [], propsEn: [], environments: [] },
  'khóc': { id: 'emotion', name: 'cảm xúcĐặc tả', nameEn: 'Emotional Close-up', propsZh: [], propsEn: [], environments: [] },
  'rơi nước mắt': { id: 'emotion', name: 'cảm xúcĐặc tả', nameEn: 'Emotional Close-up', propsZh: [], propsEn: [], environments: [] },
  'ôm': { id: 'emotion', name: 'cảm xúcĐặc tả', nameEn: 'Emotional Close-up', propsZh: [], propsEn: [], environments: [] },
  
  // Đặc tảCảnh quay - tổng hợp
  'tay': { id: 'detail', name: 'Chi tiếtĐặc tả', nameEn: 'Detail Close-up', propsZh: [], propsEn: [], environments: [] },
  'giữ': { id: 'detail', name: 'Chi tiếtĐặc tả', nameEn: 'Detail Close-up', propsZh: [], propsEn: [], environments: [] },
  'nhặt lên': { id: 'detail', name: 'Chi tiếtĐặc tả', nameEn: 'Detail Close-up', propsZh: [], propsEn: [], environments: [] },
  'buông ra': { id: 'detail', name: 'Chi tiếtĐặc tả', nameEn: 'Detail Close-up', propsZh: [], propsEn: [], environments: [] },
  'Đặc tả': { id: 'detail', name: 'Chi tiếtĐặc tả', nameEn: 'Detail Close-up', propsZh: [], propsEn: [], environments: [] },
  'Cận cảnh': { id: 'detail', name: 'Chi tiếtĐặc tả', nameEn: 'Detail Close-up', propsZh: [], propsEn: [], environments: [] },
  
  // xem/Chung Hành động - chung
  'nhìn về phía': { id: 'looking', name: 'xemGóc nhìn', nameEn: 'Looking View', propsZh: [], propsEn: [], environments: [] },
  'khao khát': { id: 'looking', name: 'xemGóc nhìn', nameEn: 'Looking View', propsZh: [], propsEn: [], environments: [] },
  'xem': { id: 'looking', name: 'xemGóc nhìn', nameEn: 'Looking View', propsZh: [], propsEn: [], environments: [] },
  
  // ngồi xuống/Đứng dậy - năng động thích ứng với môi trường
  'ngồi xuống': { id: 'seating', name: 'Khu vực ngồi', nameEn: 'Seating Area', propsZh: [], propsEn: [], environments: [] },
  'Ngồi xuống đi': { id: 'seating', name: 'Khu vực ngồi', nameEn: 'Seating Area', propsZh: [], propsEn: [], environments: [] },
  'đứng dậy': { id: 'seating', name: 'Khu vực ngồi', nameEn: 'Seating Area', propsZh: [], propsEn: [], environments: [] },
};

// ==================== chức năng cốt lõi ====================

/**
 * Từ Phân cảnhHành độTrích xuất G từ mô tả ngóc nhìnNhu cầu
 */
export function extractViewpointsFromShots(
  shots: Shot[],
  maxViewpoints: number = 6
): SceneViewpoint[] {
  const viewpointMap = new Map<string, SceneViewpoint>();
  
  for (const shot of shots) {
    const actionText = shot.actionSummary || '';
    
    // Kiểm tra mọi từ khóa
    for (const [keyword, config] of Object.entries(VIEWPOINT_KEYWORDS)) {
      if (actionText.includes(keyword)) {
        if (!viewpointMap.has(config.id)) {
          viewpointMap.set(config.id, {
            id: config.id,
            name: config.name,
            nameEn: config.nameEn,
            shotIds: [shot.id],
            keyProps: [...config.propsZh],
            keyPropsEn: [...config.propsEn],
            description: '',
            descriptionEn: '',
            gridIndex: viewpointMap.size,
          });
        } else {
          const existing = viewpointMap.get(config.id)!;
          if (!existing.shotIds.includes(shot.id)) {
            existing.shotIds.push(shot.id);
          }
          // Hợp nhất đạo cụ
          for (const prop of config.propsZh) {
            if (!existing.keyProps.includes(prop)) {
              existing.keyProps.push(prop);
            }
          }
          for (const prop of config.propsEn) {
            if (!existing.keyPropsEn.includes(prop)) {
              existing.keyPropsEn.push(prop);
            }
          }
        }
      }
    }
  }
  
  // Hiệp hội báo chí Phân cảnh số Sắp xếp（Thường được sử dụng Góc nhìưu tiên）
  const viewpoints = Array.from(viewpointMap.values())
    .sort((a, b) => b.shotIds.length - a.shotIds.length)
    .slice(0, maxViewpoints);
  
  // Gán lại GridIndex
  viewpoints.forEach((v, i) => { v.gridIndex = i; });
  
  // Nếu Góc nhìn nhỏ hơn 6，Bổ sung Mặc địnhGóc nhìn
  const defaultViewpoints: Array<Omit<SceneViewpoint, 'shotIds' | 'gridIndex'>> = [
    { id: 'overview', name: 'Toàn cảnh', nameEn: 'Overview', keyProps: [], keyPropsEn: [], description: 'bố trí không gian tổng thể', descriptionEn: 'Overall spatial layout' },
    { id: 'detail', name: 'Chi tiết', nameEn: 'Detail View', keyProps: [], keyPropsEn: [], description: 'chi tiết trang tríĐặc tả', descriptionEn: 'Decorative details close-up' },
  ];
  
  while (viewpoints.length < maxViewpoints && defaultViewpoints.length > 0) {
    const def = defaultViewpoints.shift()!;
    if (!viewpoints.some(v => v.id === def.id)) {
      viewpoints.push({
        ...def,
        shotIds: [],
        gridIndex: viewpoints.length,
      });
    }
  }
  
  return viewpoints;
}

/**
 * TạoBiểu đồ thống nhất Nhắc nhở
 * Ưu tiên cho AI Ph.ân tíG của chóc nhìn，Nếu không, hãy quay lại trích xuất từ khóa
 */
export function generateContactSheetPrompt(config: ContactSheetConfig): ContactSheetPromptResult {
  const { scene, shots, styleTokens, aspectRatio, maxViewpoints = 6 } = config;
  
  // Ưu tiên cho AI Ph.ân tíG của chóc nhìn（từ cảnh.viewpoints）
  let viewpoints: SceneViewpoint[];
  let isAIAnalyzed = false;
  
  if (scene.viewpoints && scene.viewpoints.length > 0) {
    // Sử dụng AI Ph.ân tíG của chóc nhìn
    console.log(`[generateContactSheetPrompt] Sử dụng AI Ph.ân tíchGóc nhìn: ${scene.viewpoints.length} một`);
    viewpoints = scene.viewpoints.slice(0, maxViewpoints).map((v: any, idx: number) => ({
      id: v.id || `viewpoint_${idx}`,
      name: v.name || 'Chưa đặt tênGóc nhìn',
      nameEn: v.nameEn || 'Unnamed Viewpoint',
      shotIds: v.shotIds || [],
      keyProps: v.keyProps || [],
      keyPropsEn: v.keyPropsEn || [],
      description: v.description || '',
      descriptionEn: v.descriptionEn || '',
      gridIndex: idx,
    }));
    isAIAnalyzed = true;
  } else {
    // Quay lại trích xuất từ khóa
    console.log('[generateContactSheetPrompt] Không có AI Góc nhìn，Quay lại trích xuất từ khóa');
    viewpoints = extractViewpointsFromShots(shots, maxViewpoints);
  }
  
  // Xác định bố cục lưới - buộc bố cục NxN (2x2 hoặc 3x3)
  const vpCount = viewpoints.length;
  const gridLayout = vpCount <= 4 
    ? { rows: 2, cols: 2 }
    : { rows: 3, cols: 3 };
  
  // \u6784\u5efaCảnhCơ bảnMô tả
  const sceneDescZh = [
    scene.architectureStyle && `Kiến trúcPhong cách：${scene.architectureStyle}`,
    scene.colorPalette && `Màu sắgiai điệu c：${scene.colorPalette}`,
    scene.eraDetails && `Đặc điểm của thời đại：${scene.eraDetails}`,
    scene.lightingDesign && `Ánh sáthiết kế：${scene.lightingDesign}`,
  ].filter(Boolean).join('，');
  
  const sceneDescEn = [
    scene.architectureStyle && `Architecture: ${scene.architectureStyle}`,
    scene.colorPalette && `Color palette: ${scene.colorPalette}`,
    scene.eraDetails && `Era: ${scene.eraDetails}`,
    scene.lightingDesign && `Lighting: ${scene.lightingDesign}`,
  ].filter(Boolean).join('. ');
  
  // cho mỗi Góc nhìnTạoMô tả
  viewpoints.forEach((vp, index) => {
    const propsZh = vp.keyProps.length > 0 ? `，chứa${vp.keyProps.join('、')}` : '';
    const propsEn = vp.keyPropsEn.length > 0 ? ` with ${vp.keyPropsEn.join(', ')}` : '';
    
    vp.description = `${vp.name}Góc nhìn${propsZh}`;
    vp.descriptionEn = `${vp.nameEn} angle${propsEn}`;
  });
  
  const styleStr = styleTokens.length > 0 
    ? styleTokens.join(', ') 
    : 'anime style, soft colors, detailed background';
  
  const totalCells = gridLayout.rows * gridLayout.cols;
  const paddedCount = totalCells;
  
  // Xây dựng phiên bản nâng cao của Lời nhắc — Căn chỉPhong c ba lớp của bảng giám đốc nh generateGridAndSliceácấu trúc ch nhúm
  const promptParts: string[] = [];
  
  // 1. Khối lệnh lõi (Instruction Block) — Sử dụng thuật ngữ lưới bảng phân cảnh phù hợp với Bảng điều khiển
  promptParts.push('<instruction>');
  promptParts.push(`Generate a clean ${gridLayout.rows}x${gridLayout.cols} storyboard grid with exactly ${paddedCount} equal-sized panels.`);
  promptParts.push(`Overall Image Aspect Ratio: ${aspectRatio}.`);
  // Chỉ định rõ ràng tỷ lệ khung hình của một lưới riêng lẻ，Ngăn chặn sự nhầm lẫn của AI（Sự khác biệt cốt lõi của Ban Giám đốc）
  const panelAspect = aspectRatio === '16:9' ? '16:9 (horizontal landscape)' : '9:16 (vertical portrait)';
  promptParts.push(`Each individual panel must have a ${panelAspect} aspect ratio.`);
  // Global VisionPhong cách（thêm vào khu vực chỉ huy，Trọng lượng cao nhất — Ba lớp gọng kìm tấn công lớp đầu tiên）
  if (styleStr) {
    promptParts.push(`MANDATORY Visual Style for ALL panels: ${styleStr}`);
  }
  promptParts.push('Structure: No borders between panels, no text, no watermarks, no speech bubbles.');
  promptParts.push('Consistency: Maintain consistent perspective, lighting, color grading, and visual style across ALL panels.');
  promptParts.push('Subject: Interior design and architectural details only, NO people.');
  promptParts.push('</instruction>');
  
  // 2. Bố cục Mô tả
  promptParts.push(`Layout: ${gridLayout.rows} rows, ${gridLayout.cols} columns, reading order left-to-right, top-to-bottom.`);
  
  // 3. Cảnh thông tin
  if (sceneDescEn) {
    promptParts.push(`Scene Context: ${sceneDescEn}`);
  }
  
  // 4. Nội dung M của mỗi lướiô tả — Bao gồm trong mỗi lưới [same style] mỏ neo（Ba lớp gọng kìm tấn công lớp thứ hai）
  const styleAnchor = styleStr ? ' [same style]' : '';
  viewpoints.forEach((vp, idx) => {
    const row = Math.floor(idx / gridLayout.cols) + 1;
    const col = (idx % gridLayout.cols) + 1;
    
    promptParts.push(`Panel [row ${row}, col ${col}] (no people): ${vp.nameEn.toUpperCase()}: ${vp.descriptionEn}${styleAnchor}`);
  });
  
  // 5. Khoảng trống Mô tả
  for (let i = viewpoints.length; i < paddedCount; i++) {
    const row = Math.floor(i / gridLayout.cols) + 1;
    const col = (i % gridLayout.cols) + 1;
    promptParts.push(`Panel [row ${row}, col ${col}]: empty placeholder, solid gray background`);
  }
  
    // 6. Toàn Phong cáSự kết thúc của ch được nhấn mạnh một lần nữa（Ba lớp gọng kìm tấn công lớp thứ ba）
    if (styleStr) {
      promptParts.push(`IMPORTANT - Apply this EXACT style uniformly to every panel: ${styleStr}`);
    }
  
    // 7. Lời nhắc tiêu cực
    promptParts.push('Negative constraints: text, watermark, split screen borders, speech bubbles, blur, distortion, bad anatomy, people, characters, distorted grid, uneven panels.');
    
    const prompt = promptParts.join('\n');

    // Lời nhắc tiếng Trung
    const gridItemsZh = viewpoints.map((vp, i) => 
      `[${i + 1}] ${vp.name}：${vp.description || vp.name + 'Góc nhìn'}`
    ).join('\n');
    
    const viewpointSource = isAIAnalyzed ? '（AI Phân tích）' : '（Trích xuất từ khóa）';
  
  const promptZh = `một mảnh${gridLayout.rows}x${gridLayout.cols}sơ đồ nối lưới，hiển thị tương tự「${scene.name || scene.location}」Cảnh${viewpoints.length}khác nhauGóc máyGóc nhìn${viewpointSource}。
${sceneDescZh}

bố trí lưới（từ trái sang phải，từ trên xuống dưới）：
${gridItemsZh}

Phong cách：${styleTokens.length > 0 ? styleTokens.join('、') : 'Hoạt ảnhPhong cách，mềm Màu sắc，Giàu chi tiết'}，${viewpoints.length}Mỗi lưới duy trì phối cảnh và ánh sáng nhất quán。Mỗi lưới được phân tách bằng một đường trắng mỏng。Chỉ có Nền，không có ký tự。`;

  return {
    prompt,
    promptZh,
    viewpoints,
    gridLayout,
  };
}

/**
 * Liên kết G theo kết quả cắtóc nhìn
 * Cắt chữ Hình ảnh được gán cho G tương ứngóc nhìn
 */
export function assignViewpointImages(
  viewpoints: SceneViewpoint[],
  splitResults: Array<{
    id: number;
    dataUrl: string;
    row: number;
    col: number;
  }>,
  gridLayout: { rows: number; cols: number }
): Map<string, { imageUrl: string; gridIndex: number }> {
  const result = new Map<string, { imageUrl: string; gridIndex: number }>();
  
  for (const vp of viewpoints) {
    // Tính Góc nhìchỉ số n trong kết quả cắt
    const gridIndex = vp.gridIndex;
    const row = Math.floor(gridIndex / gridLayout.cols);
    const col = gridIndex % gridLayout.cols;
    
    // Tìm kết quả cắt phù hợp
    const splitResult = splitResults.find(sr => sr.row === row && sr.col === col);
    
    if (splitResult) {
      result.set(vp.id, {
        imageUrl: splitResult.dataUrl,
        gridIndex: gridIndex,
      });
    }
  }
  
  return result;
}

/**
 * Theo Ph.ân cảnhHành động tự động khớp với G tốt nhấtóc nhìn
 */
export function matchShotToViewpoint(
  shot: Shot,
  viewpoints: SceneViewpoint[]
): string | null {
  const actionText = shot.actionSummary || '';
  
  // Kiểm tra Phân cảNh có được liên kết với G hay khôngóc nhìn
  for (const vp of viewpoints) {
    if (vp.shotIds.includes(shot.id)) {
      return vp.id;
    }
  }
  
  // Hãy thử sử dụng Hành độkết hợp từ khóa
  for (const [keyword, config] of Object.entries(VIEWPOINT_KEYWORDS)) {
    if (actionText.includes(keyword)) {
      const matchedVp = viewpoints.find(vp => vp.id === config.id);
      if (matchedVp) {
        return matchedVp.id;
      }
    }
  }
  
  // Mặc địnhQuay lạiToàn cảnhGóc nhìn
  const overviewVp = viewpoints.find(vp => vp.id === 'overview');
  return overviewVp?.id || viewpoints[0]?.id || null;
}

// ==================== Năng động Góc nhìn và phân trang Hỗ trợ ====================

import type { 
  PendingViewpointData, 
  ContactSheetPromptSet 
} from '@/stores/media-panel-store';

/**
 * Từ Phân cảTrích xuất T từ văn bản nhất cảCan Tìm kiếnội dung của tôi
 * bao gồm：Hành độngMô tả、đối thoại、Tầm nhìn Mô tảĐợi đã
 */
function getShotSearchableText(shot: Shot): string {
  const parts = [
    shot.actionSummary || '',
    shot.dialogue || '',
    shot.visualDescription || '',
    shot.characterBlocking || '',
  ];
  return parts.join(' ');
}

/**
 * Theo môi trường Loạtôi nhận được Mặc địnhGóc nhìnDanh sách
 * được sử dụng trong việc trích xuất Góc nhìBổ sung khi n không đủ
 */
function getDefaultViewpointsForEnvironment(
  envType: SceneEnvironmentType
): Array<Omit<SceneViewpoint, 'shotIds' | 'gridIndex'>> {
  // Phổ thông Mặc địnhGóc nhìn
  const commonDefaults: Array<Omit<SceneViewpoint, 'shotIds' | 'gridIndex'>> = [
    { id: 'overview', name: 'Toàn cảnh', nameEn: 'Overview', keyProps: [], keyPropsEn: [], description: 'bố trí không gian tổng thể', descriptionEn: 'Overall spatial layout' },
    { id: 'detail', name: 'Chi tiết', nameEn: 'Detail View', keyProps: [], keyPropsEn: [], description: 'Chi tiếtĐặc tả', descriptionEn: 'Detail close-up' },
  ];
  
  // Theo môi trường LoạiQuay lạđặc trưngMặc địnhGóc nhìn
  switch (envType) {
    case 'vehicle':
      return [
        { id: 'vehicle_window', name: 'cửa sổ xe hơi', nameEn: 'Vehicle Window View', keyProps: ['cửa sổ xe hơi', 'Khung cảnh bên ngoài cửa sổ'], keyPropsEn: ['vehicle window', 'outside scenery'], description: 'cửa sổ xe Góc nhìn', descriptionEn: 'Vehicle window view' },
        { id: 'vehicle_seat', name: 'khu vực chỗ ngồi', nameEn: 'Seat Area', keyProps: ['chỗ ngồi'], keyPropsEn: ['seat'], description: 'khu vực chỗ ngồi', descriptionEn: 'Seating area' },
        { id: 'vehicle_aisle', name: 'lối đi', nameEn: 'Aisle View', keyProps: ['lối đi', 'tay vịn'], keyPropsEn: ['aisle', 'handrail'], description: 'Lối đi Góc nhìn', descriptionEn: 'Aisle view' },
        { id: 'vehicle_driver', name: 'ghế lái', nameEn: 'Driver Area', keyProps: ['vô lăng'], keyPropsEn: ['steering wheel'], description: 'khu vực lái xe', descriptionEn: 'Driver area' },
        ...commonDefaults,
      ];
      
    case 'outdoor':
      return [
        { id: 'nature', name: 'phong cảnh thiên nhiên', nameEn: 'Nature View', keyProps: [], keyPropsEn: [], description: 'phong cảnh thiên nhiên Góc nhìn', descriptionEn: 'Nature scenery view' },
        { id: 'roadside', name: 'ven đường', nameEn: 'Roadside View', keyProps: ['đường'], keyPropsEn: ['road'], description: 'Bên Đường Góc nhìn', descriptionEn: 'Roadside view' },
        { id: 'street', name: 'quang cảnh đường phố', nameEn: 'Street View', keyProps: ['đường phố'], keyPropsEn: ['street'], description: 'Chế độ xem phốGóc nhìn', descriptionEn: 'Street view' },
        ...commonDefaults,
      ];
      
    case 'indoor_home':
      return [
        { id: 'sofa', name: 'khu vực ghế sofa', nameEn: 'Sofa Area', keyProps: ['Sofa', 'bàn cà phê'], keyPropsEn: ['sofa', 'coffee table'], description: 'khu vực ghế sofa', descriptionEn: 'Sofa area' },
        { id: 'window', name: 'cửa sổ', nameEn: 'Window View', keyProps: ['các cửa sổ', 'Rèm cửa'], keyPropsEn: ['window', 'curtains'], description: 'G bên cửa sổóc nhìn', descriptionEn: 'Window view' },
        { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', keyProps: ['cửa', 'Lối vào'], keyPropsEn: ['door', 'entrance'], description: 'Lối vào Góc nhìn', descriptionEn: 'Entrance view' },
        ...commonDefaults,
      ];
      
    case 'indoor_work':
      return [
        { id: 'study', name: 'Khu văn phòng', nameEn: 'Work Area', keyProps: ['bàn', 'máy tính'], keyPropsEn: ['desk', 'computer'], description: 'Khu văn phòng', descriptionEn: 'Work area' },
        { id: 'window', name: 'cửa sổ', nameEn: 'Window View', keyProps: ['các cửa sổ'], keyPropsEn: ['window'], description: 'G bên cửa sổóc nhìn', descriptionEn: 'Window view' },
        { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', keyProps: ['cửa'], keyPropsEn: ['door'], description: 'Lối vào Góc nhìn', descriptionEn: 'Entrance view' },
        ...commonDefaults,
      ];
      
    case 'indoor_public':
      return [
        { id: 'seating', name: 'Khu vực ngồi', nameEn: 'Seating Area', keyProps: [], keyPropsEn: [], description: 'Khu vực chỗ ngồi', descriptionEn: 'Seating area' },
        { id: 'entrance', name: 'lối vào', nameEn: 'Entrance View', keyProps: ['cửa'], keyPropsEn: ['door'], description: 'Lối vào Góc nhìn', descriptionEn: 'Entrance view' },
        ...commonDefaults,
      ];
    
    // === Cổ Cảnh ===
    case 'ancient_indoor':
      return [
        { id: 'ancient_hall', name: 'Sảnh chính', nameEn: 'Main Hall', keyProps: ['Ghế Taishi', 'trường hợp'], keyPropsEn: ['taishi chair', 'table'], description: 'Hội trường Góc nhìn', descriptionEn: 'Main hall view' },
        { id: 'ancient_table', name: 'trường hợp', nameEn: 'Ancient Table', keyProps: ['trường hợp', 'bộ trà'], keyPropsEn: ['table', 'tea set'], description: 'Trường hợp Góc nhìn', descriptionEn: 'Table view' },
        { id: 'ancient_screen', name: 'màn hình', nameEn: 'Screen View', keyProps: ['màn hình', 'rèm'], keyPropsEn: ['screen', 'curtain'], description: 'Màn hình Góc nhìn', descriptionEn: 'Screen view' },
        { id: 'ancient_couch', name: 'đi văng', nameEn: 'Ancient Couch', keyProps: ['đi văng', 'bọc nệm'], keyPropsEn: ['daybed', 'cushion'], description: 'Ghế Góc nhìn', descriptionEn: 'Couch view' },
        ...commonDefaults,
      ];
      
    case 'ancient_outdoor':
      return [
        { id: 'ancient_courtyard', name: 'sân', nameEn: 'Courtyard', keyProps: ['hòn non bộ', 'hồ bơi'], keyPropsEn: ['rockery', 'pond'], description: 'Sân Góc nhìn', descriptionEn: 'Courtyard view' },
        { id: 'ancient_pavilion', name: 'dân tộc', nameEn: 'Pavilion', keyProps: ['\u4e9d', 'ghế đá'], keyPropsEn: ['pavilion', 'stone bench'], description: 'dân tộcGóc nhìn', descriptionEn: 'Pavilion view' },
        { id: 'ancient_road', name: 'Cách chính thức', nameEn: 'Official Road', keyProps: ['Cách chính thức'], keyPropsEn: ['road'], description: 'đường công vụ Góc nhìn', descriptionEn: 'Road view' },
        { id: 'ancient_gate', name: 'cổng thành', nameEn: 'City Gate', keyProps: ['cổng thành', 'bức tường thành'], keyPropsEn: ['city gate', 'wall'], description: 'Cổng thành Góc nhìn', descriptionEn: 'City gate view' },
        ...commonDefaults,
      ];
      
    case 'ancient_vehicle':
      return [
        { id: 'ancient_sedan', name: 'Bên trong chiếc sedan', nameEn: 'Inside Sedan', keyProps: ['rèm xe', 'đệm'], keyPropsEn: ['sedan curtain', 'cushion'], description: 'G bên trong xeóc nhìn', descriptionEn: 'Inside sedan view' },
        { id: 'ancient_carriage', name: 'bên trong xe', nameEn: 'Inside Carriage', keyProps: ['Khung xe', 'đệm'], keyPropsEn: ['canopy', 'cushion'], description: 'G trong xeóc nhìn', descriptionEn: 'Inside carriage view' },
        { id: 'ancient_boat', name: 'cabin', nameEn: 'Boat Cabin', keyProps: ['cabin', 'cửa sổ'], keyPropsEn: ['cabin', 'window'], description: 'Cabin Góc nhìn', descriptionEn: 'Boat cabin view' },
        { id: 'ancient_deck', name: 'boong tàu', nameEn: 'Ship Deck', keyProps: ['boong tàu', 'cánh buồm'], keyPropsEn: ['deck', 'sail'], description: 'Tầng Góc nhìn', descriptionEn: 'Deck view' },
        { id: 'ancient_horse', name: 'cưỡi ngựa', nameEn: 'On Horseback', keyProps: ['con ngựa', 'yên ngựa'], keyPropsEn: ['horse', 'saddle'], description: 'Cưỡi NgựaGóc nhìn', descriptionEn: 'Horseback view' },
        ...commonDefaults,
      ];
      
    default:
      return commonDefaults;
  }
}

/**
 * Kiểm tra Góc nhìn cấu hình phù hợp với môi trường Loạtôi tương thích
 */
function isViewpointCompatibleWithEnvironment(
  config: ViewpointConfig,
  envType: SceneEnvironmentType
): boolean {
  // Một mảng trống đại diện cho một G chungóc nhìn，Áp dụng cho Tất cảmôi trường
  if (config.environments.length === 0) {
    return true;
  }
  // Môi trường không xác định không làm được Lọc，Cho phép Tất cảGóc nhìn
  if (envType === 'unknown') {
    return true;
  }
  // Kiểm tra xem môi trường có nằm trong danh sách tương thích không
  return config.environments.includes(envType);
}

/**
 * Trích xuấtGóc nhìn（Số lượng không giới hạn）
 * Quay lạiTất cảG được công nhậnóc nhìn，Không còn giới hạn ở 6
 * 
 * Góc nhìn đến từ Phân cảTrích từ nội dung nh，Đừng làm môi trường Lọc
 * 
 * @param shots Phân cảnh danh sách
 * @param sceneLocation Cảvị trí nh（Chỉ để bổ sung Mặc địnhGóc nhìn）
 */
export function extractAllViewpointsFromShots(
  shots: Shot[],
  sceneLocation?: string
): SceneViewpoint[] {
  const viewpointMap = new Map<string, SceneViewpoint>();
  const matchedShotIds = new Set<string>();
  
  // lần đầu tiên：Kết hợp Ph dựa trên từ khóaân cảnh đến Góc nhìn
  for (const shot of shots) {
    const searchText = getShotSearchableText(shot);
    let shotMatched = false;
    
    for (const [keyword, config] of Object.entries(VIEWPOINT_KEYWORDS)) {
      if (searchText.includes(keyword)) {
        shotMatched = true;
        
        if (!viewpointMap.has(config.id)) {
          viewpointMap.set(config.id, {
            id: config.id,
            name: config.name,
            nameEn: config.nameEn,
            shotIds: [shot.id],
            keyProps: [...config.propsZh],
            keyPropsEn: [...config.propsEn],
            description: '',
            descriptionEn: '',
            gridIndex: viewpointMap.size,
          });
        } else {
          const existing = viewpointMap.get(config.id)!;
          if (!existing.shotIds.includes(shot.id)) {
            existing.shotIds.push(shot.id);
          }
          for (const prop of config.propsZh) {
            if (!existing.keyProps.includes(prop)) {
              existing.keyProps.push(prop);
            }
          }
          for (const prop of config.propsEn) {
            if (!existing.keyPropsEn.includes(prop)) {
              existing.keyPropsEn.push(prop);
            }
          }
        }
      }
    }
    
    if (shotMatched) {
      matchedShotIds.add(shot.id);
    }
  }
  
  // Lần thứ hai：Sẽ vô song Phân cảnh thuộc về「Toàn cảnh」Góc nhìn
  const unmatchedShots = shots.filter(s => !matchedShotIds.has(s.id));
  if (unmatchedShots.length > 0) {
    if (!viewpointMap.has('overview')) {
      viewpointMap.set('overview', {
        id: 'overview',
        name: 'Toàn cảnh',
        nameEn: 'Overview',
        shotIds: unmatchedShots.map(s => s.id),
        keyProps: [],
        keyPropsEn: [],
        description: 'bố trí không gian tổng thể',
        descriptionEn: 'Overall spatial layout',
        gridIndex: viewpointMap.size,
      });
    } else {
      const overview = viewpointMap.get('overview')!;
      for (const shot of unmatchedShots) {
        if (!overview.shotIds.includes(shot.id)) {
          overview.shotIds.push(shot.id);
        }
      }
    }
  }
  
  // Hiệp hội báo chí Phân cảnh số Sắp xếp
  const viewpoints = Array.from(viewpointMap.values())
    .sort((a, b) => b.shotIds.length - a.shotIds.length);
  
  // Bổ sung Mặc địnhGóc nhìn（Toàn cảnh và chi tiết）
  const defaultViewpoints = [
    { id: 'overview', name: 'Toàn cảnh', nameEn: 'Overview', keyProps: [] as string[], keyPropsEn: [] as string[], description: 'bố trí không gian tổng thể', descriptionEn: 'Overall spatial layout' },
    { id: 'detail', name: 'Chi tiết', nameEn: 'Detail View', keyProps: [] as string[], keyPropsEn: [] as string[], description: 'Chi tiếtĐặc tả', descriptionEn: 'Detail close-up' },
  ];
  
  while (viewpoints.length < 6 && defaultViewpoints.length > 0) {
    const def = defaultViewpoints.shift()!;
    if (!viewpoints.some(v => v.id === def.id)) {
      viewpoints.push({
        ...def,
        shotIds: [],
        gridIndex: viewpoints.length,
      });
    }
  }
  
  viewpoints.forEach((v, i) => { v.gridIndex = i; });
  
  return viewpoints;
}

/**
 * Will Góc nhìnGroup thành các trang bản đồ chung
 * Tối đa 6 G mỗi trangóc nhìn
 */
export function groupViewpointsIntoPages(
  viewpoints: SceneViewpoint[],
  viewpointsPerPage: number = 6
): SceneViewpoint[][] {
  const pages: SceneViewpoint[][] = [];
  
  for (let i = 0; i < viewpoints.length; i += viewpointsPerPage) {
    const page = viewpoints.slice(i, i + viewpointsPerPage);
    // Chỉ định lại GridIndex trong trang (0-5)
    page.forEach((v, idx) => { v.gridIndex = idx; });
    pages.push(page);
  }
  
  return pages;
}

/**
 * TạoNhắc sơ đồ chung
 * Quay lại PendingViewpointData và ContactSheetPromptSet được sử dụng để chuyển tới Thư viện cảnh
 * 
 * Logic lựa chọn bố cục：
 * - Góc nhìn ≤ 6：Sử dụng 2x3 hoặc 3x2（1 bức ảnh）
 * - Góc nhìn 7-9：Sử dụng 3x3（1 bức ảnh）
 * - Góc nhìn > 9：Chia thành nhiều hình ảnh
 */
export function generateMultiPageContactSheetData(
  config: ContactSheetConfig,
  shots: Shot[] // Được sử dụng để lấy Phân cảsố sê-ri
): {
  viewpoints: PendingViewpointData[];
  contactSheetPrompts: ContactSheetPromptSet[];
} {
  const { scene, styleTokens, aspectRatio } = config;
  
  // Trích xuất Tất cảGóc nhìn（Đạt Cảnh vị trí cho môi trường Lọc）
  const sceneLocation = scene.location || scene.name || '';
  const allViewpoints = extractAllViewpointsFromShots(config.shots, sceneLocation);
  
  // Theo G.óc nhìn số và tỷ lệ khung hình tự động chọn bố cục tối ưu
  // Buộc bố cục NxN (2x2 hoặc 3x3) để có tính nhất quán về tỷ lệ khung hình，Phù hợp với Ban giám đốc
  let gridLayout: { rows: number; cols: number };
  let viewpointsPerPage: number;
  
  const vpCount = allViewpoints.length;
  
  if (vpCount <= 4) {
    // Trong vòng 4：Sử dụng 2x2
    gridLayout = { rows: 2, cols: 2 };
    viewpointsPerPage = 4;
  } else {
    // hơn 4：Sử dụng 3x3 (tối đa 9 trang mỗi trang)
    gridLayout = { rows: 3, cols: 3 };
    viewpointsPerPage = 9;
  }
  
  console.log('[ContactSheet] Tùy chọn bố cục:', { vpCount, aspectRatio, gridLayout, viewpointsPerPage });
  
  // Phân trang
  const pages = groupViewpointsIntoPages(allViewpoints, viewpointsPerPage);
  
  // \u6784\u5efaCảnhCơ bảnMô tả
  const sceneDescEn = [
    scene.architectureStyle && `Architecture: ${scene.architectureStyle}`,
    scene.colorPalette && `Color palette: ${scene.colorPalette}`,
    scene.eraDetails && `Era: ${scene.eraDetails}`,
    scene.lightingDesign && `Lighting: ${scene.lightingDesign}`,
  ].filter(Boolean).join('. ');
  
  const sceneDescZh = [
    scene.architectureStyle && `Kiến trúcPhong cách：${scene.architectureStyle}`,
    scene.colorPalette && `Màu sắgiai điệu c：${scene.colorPalette}`,
    scene.eraDetails && `Đặc điểm của thời đại：${scene.eraDetails}`,
    scene.lightingDesign && `Ánh sáthiết kế：${scene.lightingDesign}`,
  ].filter(Boolean).join('，');
  
  const styleStr = styleTokens.length > 0 
    ? styleTokens.join(', ') 
    : 'anime style, soft colors, detailed background';
  
  // xây dựng tiến sĩân cảnh ID để ánh xạ số thứ tự
  const shotIdToIndex = new Map<string, number>();
  shots.forEach(shot => {
    shotIdToIndex.set(shot.id, shot.index);
  });
  
  // Tạo PendingViewpointData
  const pendingViewpoints: PendingViewpointData[] = [];
  
  pages.forEach((pageViewpoints, pageIndex) => {
    pageViewpoints.forEach((vp, idx) => {
      // TạoGóc nhìnMô tả
      const propsZh = vp.keyProps.length > 0 ? `，chứa${vp.keyProps.join('、')}` : '';
      const propsEn = vp.keyPropsEn.length > 0 ? ` with ${vp.keyPropsEn.join(', ')}` : '';
      vp.description = `${vp.name}Góc nhìn${propsZh}`;
      vp.descriptionEn = `${vp.nameEn} angle${propsEn}`;
      
      // Cập nhật gridIndex
      vp.gridIndex = idx;
      
      // Nhận Ph liên quanân cảsố seri của nh
      const shotIndexes = vp.shotIds
        .map(id => shotIdToIndex.get(id))
        .filter((idx): idx is number => idx !== undefined)
        .sort((a, b) => a - b);
      
      pendingViewpoints.push({
        id: vp.id,
        name: vp.name,
        nameEn: vp.nameEn,
        shotIds: vp.shotIds,
        shotIndexes,
        keyProps: vp.keyProps,
        keyPropsEn: vp.keyPropsEn,
        gridIndex: vp.gridIndex,
        pageIndex,
      });
    });
  });
  
  // TạoBảng liên hệPromptSet trên mỗi trang
  const contactSheetPrompts: ContactSheetPromptSet[] = pages.map((pageViewpoints, pageIndex) => {
    const totalCells = gridLayout.rows * gridLayout.cols;
    const paddedCount = totalCells;
    const actualCount = pageViewpoints.length;
    
    // Xây dựng phiên bản nâng cao của Lời nhắc — Căn chỉPhong c ba lớp của bảng giám đốc nh generateGridAndSliceácấu trúc ch nhúm
    const promptParts: string[] = [];
    
    // 1. Khối lệnh lõi (Instruction Block) — Sử dụng thuật ngữ lưới bảng phân cảnh phù hợp với Bảng điều khiển
    promptParts.push('<instruction>');
    promptParts.push(`Generate a clean ${gridLayout.rows}x${gridLayout.cols} storyboard grid with exactly ${paddedCount} equal-sized panels.`);
    promptParts.push(`Overall Image Aspect Ratio: ${aspectRatio}.`);
    
    // Chỉ định rõ ràng tỷ lệ khung hình của một lưới riêng lẻ，Ngăn chặn sự nhầm lẫn của AI
    const panelAspect = aspectRatio === '16:9' ? '16:9 (horizontal landscape)' : '9:16 (vertical portrait)';
    promptParts.push(`Each individual panel must have a ${panelAspect} aspect ratio.`);
    
    // Global VisionPhong cách（thêm vào khu vực chỉ huy，Trọng lượng cao nhất — Ba lớp gọng kìm tấn công lớp đầu tiên）
    if (styleStr) {
      promptParts.push(`MANDATORY Visual Style for ALL panels: ${styleStr}`);
    }
    
    promptParts.push('Structure: No borders between panels, no text, no watermarks, no speech bubbles.');
    promptParts.push('Consistency: Maintain consistent perspective, lighting, color grading, and visual style across ALL panels.');
    promptParts.push('Subject: Interior design and architectural details only, NO people.');
    promptParts.push('</instruction>');
    
    // 2. Bố cục Mô tả
    promptParts.push(`Layout: ${gridLayout.rows} rows, ${gridLayout.cols} columns, reading order left-to-right, top-to-bottom.`);
    
    // 3. Cảnh thông tin
    if (sceneDescEn) {
      promptParts.push(`Scene Context: ${sceneDescEn}`);
    }
    
    // 4. Nội dung M của mỗi lướiô tả — Bao gồm trong mỗi lưới [same style] mỏ neo（Ba lớp gọng kìm tấn công lớp thứ hai）
    const styleAnchor = styleStr ? ' [same style]' : '';
    pageViewpoints.forEach((vp, idx) => {
      const row = Math.floor(idx / gridLayout.cols) + 1;
      const col = (idx % gridLayout.cols) + 1;
      
      const content = vp.keyPropsEn.length > 0 
        ? `showing ${vp.keyPropsEn.join(', ')}` 
        : (vp.nameEn === 'Overview' ? 'wide shot showing the entire room layout' : `${vp.nameEn} angle of the room`);
      
      promptParts.push(`Panel [row ${row}, col ${col}] (no people): ${content}${styleAnchor}`);
    });
    
    // 5. Khoảng trống Mô tả
    for (let i = actualCount; i < paddedCount; i++) {
      const row = Math.floor(i / gridLayout.cols) + 1;
      const col = (i % gridLayout.cols) + 1;
      promptParts.push(`Panel [row ${row}, col ${col}]: empty placeholder, solid gray background`);
    }
    
    // 6. Toàn Phong cáSự kết thúc của ch được nhấn mạnh một lần nữa（Ba lớp gọng kìm tấn công lớp thứ ba）
    if (styleStr) {
      promptParts.push(`IMPORTANT - Apply this EXACT style uniformly to every panel: ${styleStr}`);
    }
    
    // 7. Lời nhắc tiêu cực
    promptParts.push('Negative constraints: text, watermark, split screen borders, speech bubbles, blur, distortion, bad anatomy, people, characters, distorted grid, uneven panels.');
    
    const prompt = promptParts.join('\n');

    // Lời nhắc tiếng Trung
    const gridItemsZh = pageViewpoints.map((vp, i) => 
      `[${i + 1}] ${vp.name}：${vp.description}`
    ).join('\n');
    
    const promptZh = `chính xác ${gridLayout.rows}được rồi${gridLayout.cols}biểu đồ lưới cột（tổng cộng ${totalCells} lưới），hiển thị tương tự「${scene.name || scene.location}」CảDifferent G of nhóc nhìn。
${sceneDescZh}

${totalCells} Mỗi lưới được hiển thị riêng biệt：${gridItemsZh}。

quan trọng：
- Phải chính xácạo ${gridLayout.rows} được rồi ${gridLayout.cols} Cột，Không hơn, không kém。
- Đây là hình ảnh tham khảo rõ ràng，Hình ảKhông Th trên nhêghi đè văn bản mAny。
- Đừng màêthẻ m、Tiêu đề、Giải thívăn bản ch、Hình mờ hoặc bất kỳ Loạvăn bản của tôi。

Phong cách：${styleTokens.length > 0 ? styleTokens.join('、') : 'Hoạt ảnhPhong cách，mềm Màu sắc，Giàu chi tiết'}，Tất cảLưới chiếu sáng nhất quán，Sử dụng Vi trắng mịn giữa các lướiền tách ra，Chỉ có Nền，không có ký tự。`;
    
    return {
      pageIndex,
      prompt,
      promptZh,
      viewpointIds: pageViewpoints.map(vp => vp.id),
      gridLayout,
    };
  });
  
  return {
    viewpoints: pendingViewpoints,
    contactSheetPrompts,
  };
}

/**
 * Xây dựng dữ liệu đồ thị chung từ dữ liệu quan điểm hiện có
 * sử dụng từ Kịch bảbảng n nhảy tới Thư viện cảnh thời gian，Sử dụng AI Ph trực tiếpân tíG của chóc nhìn
 * 
 * @quan điểm param - G từ ScriptScene.viewpointsóc nhìdữ liệu
 * @param scene - Cảnh thông tin（cho TạoPrompt）
 * @param shots - Phân cảnh danh sách（Được sử dụng để lấy Phân cảsố sê-ri）
 * @param styleTokens - Phong cádấu ch
 * @param khía cạnhRatio - tỷ lệ khung hình
 */
export function buildContactSheetDataFromViewpoints(
  viewpoints: Array<{
    id: string;
    name: string;
    nameEn?: string;
    shotIds: string[];
    keyProps: string[];
    gridIndex: number;
  }>,
  scene: Pick<ScriptScene, 'name' | 'location' | 'architectureStyle' | 'lightingDesign' | 'colorPalette' | 'eraDetails' | 'visualPrompt' | 'visualPromptEn'>,
  shots: Shot[],
  styleTokens: string[],
  aspectRatio: '16:9' | '9:16' = '16:9'
): {
  viewpoints: PendingViewpointData[];
  contactSheetPrompts: ContactSheetPromptSet[];
} {
  // Theo G.óc nhìn bố cục chọn số lượng
  const vpCount = viewpoints.length;
  let gridLayout: { rows: number; cols: number };
  let viewpointsPerPage: number;
  
  if (vpCount <= 4) {
    gridLayout = { rows: 2, cols: 2 };
    viewpointsPerPage = 4;
  } else {
    gridLayout = { rows: 3, cols: 3 };
    viewpointsPerPage = 9;
  }
  
  console.log('[buildContactSheetDataFromViewpoints] Sử dụng AI Góc nhìnBuild dữ liệu đồ thị chung:', {
    vpCount,
    gridLayout,
    viewpointsPerPage,
    // Gỡ lỗi：Cảlĩnh vực thiết kế nghệ thuật nh
    sceneFields: {
      name: scene.name,
      location: scene.location,
      architectureStyle: scene.architectureStyle,
      lightingDesign: scene.lightingDesign,
      colorPalette: scene.colorPalette,
      eraDetails: scene.eraDetails,
    },
  });
  
  // Phân trang
  const pages: typeof viewpoints[] = [];
  for (let i = 0; i < viewpoints.length; i += viewpointsPerPage) {
    const page = viewpoints.slice(i, i + viewpointsPerPage);
    // Chỉ định lại GridIndex trong trang (dựa trên 0)
    page.forEach((v, idx) => { (v as any).gridIndex = idx; });
    pages.push(page);
  }
  
  // \u6784\u5efaCảnhMô tả（lĩnh vực thiết kế nghệ thuật）
  const sceneDescEn = [
    scene.architectureStyle && `Architecture: ${scene.architectureStyle}`,
    scene.colorPalette && `Color palette: ${scene.colorPalette}`,
    scene.eraDetails && `Era: ${scene.eraDetails}`,
    scene.lightingDesign && `Lighting: ${scene.lightingDesign}`,
  ].filter(Boolean).join('. ');
  
  const sceneDescZh = [
    scene.architectureStyle && `Kiến trúcPhong cách：${scene.architectureStyle}`,
    scene.colorPalette && `Màu sắgiai điệu c：${scene.colorPalette}`,
    scene.eraDetails && `Đặc điểm của thời đại：${scene.eraDetails}`,
    scene.lightingDesign && `Ánh sáthiết kế：${scene.lightingDesign}`,
  ].filter(Boolean).join('，');
  
  // Lời nhắc trực quan（AI Cảnh hiệu chuẩn TạChi tiết C của oảnhMô tả）
  const visualPromptZh = scene.visualPrompt || '';
  const visualPromptEn = scene.visualPromptEn || '';
  
  console.log('[buildContactSheetDataFromViewpoints] CảnhMô tả:', {
    sceneDescZh,
    sceneDescEn,
    visualPromptZh: visualPromptZh ? visualPromptZh.substring(0, 50) + '...' : '(không có)',
    visualPromptEn: visualPromptEn ? visualPromptEn.substring(0, 50) + '...' : '(không có)',
  });
  
  const styleStr = styleTokens.length > 0 
    ? styleTokens.join(', ') 
    : 'anime style, soft colors, detailed background';
  
  // xây dựng tiến sĩân cảnh ID để ánh xạ số thứ tự
  const shotIdToIndex = new Map<string, number>();
  shots.forEach(shot => {
    shotIdToIndex.set(shot.id, shot.index);
  });
  
  // Tạo PendingViewpointData
  const pendingViewpoints: PendingViewpointData[] = [];
  
  pages.forEach((pageViewpoints, pageIndex) => {
    pageViewpoints.forEach((vp, idx) => {
      // Nhận Ph liên quanân cảsố seri của nh
      const shotIndexes = vp.shotIds
        .map(id => shotIdToIndex.get(id))
        .filter((idx): idx is number => idx !== undefined)
        .sort((a, b) => a - b);
      
      pendingViewpoints.push({
        id: vp.id,
        name: vp.name,
        nameEn: vp.nameEn || vp.name, // Nếu không có tên tiếng Anh，Sử dụng tên tiếng Trung
        shotIds: vp.shotIds,
        shotIndexes,
        keyProps: vp.keyProps,
        keyPropsEn: [], // Có thể không có tên tiếng Anh，Để trống
        gridIndex: idx,
        pageIndex,
      });
    });
  });
  
  // TạoBảng liên hệPromptSet trên mỗi trang
  const contactSheetPrompts: ContactSheetPromptSet[] = pages.map((pageViewpoints, pageIndex) => {
    const totalCells = gridLayout.rows * gridLayout.cols;
    const paddedCount = totalCells;
    const actualCount = pageViewpoints.length;
    
    // Xây dựng lời nhắc tiếng Anh — Căn chỉnh bảng giám đốc ba lớp Phong cách tiêm
    const promptParts: string[] = [];
    
    // Tính tỷ lệ khung hình M của mỗi lướiô tả
    const panelAspect = aspectRatio === '16:9' ? '16:9 (horizontal landscape)' : '9:16 (vertical portrait)';
    
    promptParts.push('<instruction>');
    promptParts.push(`Generate a clean ${gridLayout.rows}x${gridLayout.cols} storyboard grid with exactly ${paddedCount} equal-sized panels.`);
    promptParts.push(`Overall Image Aspect Ratio: ${aspectRatio}.`);
    promptParts.push(`Each individual panel must have a ${panelAspect} aspect ratio.`);
    // Layer 1: MANDATORY Phong cátiền tố ch（Khu vực hướng dẫn，ưu tiên cao nhất）
    promptParts.push(`MANDATORY Visual Style for ALL panels: ${styleStr}`);
    promptParts.push('Structure: No borders between panels, no text, no watermarks, no speech bubbles.');
    promptParts.push('Consistency: Maintain consistent perspective, lighting, color grading, and visual style across ALL panels.');
    promptParts.push('Subject: Interior design and architectural details only, NO people.');
    promptParts.push('</instruction>');
    
    promptParts.push(`Layout: ${gridLayout.rows} rows, ${gridLayout.cols} columns, reading order left-to-right, top-to-bottom.`);
    
    if (sceneDescEn) {
      promptParts.push(`Scene Context: ${sceneDescEn}`);
    }
    
    // ThêLời nhắc mVisual（Tiếng Anh）
    if (visualPromptEn) {
      promptParts.push(`Visual Description: ${visualPromptEn}`);
    }
    
    // Nội dung của mỗi lưới Mô tả + Lớp 2: Phong c mỗi ôách neo
    pageViewpoints.forEach((vp, idx) => {
      const row = Math.floor(idx / gridLayout.cols) + 1;
      const col = (idx % gridLayout.cols) + 1;
      const vpNameEn = vp.nameEn || vp.name;
      const content = vp.keyProps.length > 0 
        ? `showing ${vp.keyProps.join(', ')}` 
        : (vpNameEn === 'Overview' || vp.name === 'Toàn cảnh' ? 'wide shot showing the entire room layout' : `${vpNameEn} angle of the room`);
      
      promptParts.push(`Panel [row ${row}, col ${col}] (no people): ${content} [same style]`);
    });
    
    // phần giữ chỗ trống
    for (let i = actualCount; i < paddedCount; i++) {
      const row = Math.floor(i / gridLayout.cols) + 1;
      const col = (i % gridLayout.cols) + 1;
      promptParts.push(`Panel [row ${row}, col ${col}]: empty placeholder, solid gray background`);
    }
    
    // Lớp 3: Đuôi Phong cách nhấn mạnh（Tấn công trực diện）
    promptParts.push(`IMPORTANT - Apply this EXACT style uniformly to every panel: ${styleStr}`);
    promptParts.push('Negative constraints: text, watermark, split screen borders, speech bubbles, blur, distortion, bad anatomy, people, characters, distorted grid, uneven panels.');
    
    const prompt = promptParts.join('\n');
    
    // Lời nhắc tiếng Trung
    const gridItemsZh = pageViewpoints.map((vp, i) => {
      const content = vp.keyProps.length > 0 
        ? `hiển thị${vp.keyProps.join('、')}` 
        : (vp.name === 'Toàn cảnh' ? 'Góc rộng thể hiện được bố cục của toàn bộ không gianàn cảnh' : `${vp.name}Góc nhìn`);
      return `[${i + 1}] ${vp.name}：${content}`;
    }).join('\n');
    
    const promptZh = `chính xác ${gridLayout.rows}được rồi${gridLayout.cols}biểu đồ lưới cột（tổng cộng ${totalCells} lưới），hiển thị tương tự「${scene.name || scene.location}」CảDifferent G of nhóc nhìn。
${sceneDescZh}${visualPromptZh ? `\nCảbầu không khí nh：${visualPromptZh}` : ''}

${totalCells} Mỗi lưới được hiển thị riêng biệt：
${gridItemsZh}

quan trọng：
- Phải chính xácạo ${gridLayout.rows} được rồi ${gridLayout.cols} Cột，Không hơn, không kém。
- Đây là hình ảnh tham khảo rõ ràng，Hình ảKhông Th trên nhêghi đè văn bản mAny。
- Đừng màêthẻ m、Tiêu đề、Giải thívăn bản ch、Hình mờ hoặc bất kỳ Loạvăn bản của tôi。

Phong cách：${styleTokens.length > 0 ? styleTokens.join('、') : 'Hoạt ảnhPhong cách，mềm Màu sắc，Giàu chi tiết'}，Tất cảLưới chiếu sáng nhất quán，Sử dụng Vi trắng mịn giữa các lướiền tách ra，Chỉ có Nền，không có ký tự。`;
    
    return {
      pageIndex,
      prompt,
      promptZh,
      viewpointIds: pageViewpoints.map(vp => vp.id),
      gridLayout,
    };
  });
  
  return {
    viewpoints: pendingViewpoints,
    contactSheetPrompts,
  };
}
