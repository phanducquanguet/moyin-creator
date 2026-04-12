// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
// Hoàn thànhTrạng thái
export type CompletionStatus = 'pending' | 'in_progress' | 'completed';

// Tùy chọn ngôn ngữ nhắc nhở
export type PromptLanguage = 'zh' | 'en' | 'zh+en';

// AINhân vậsự nghiêm ngặt của hiệu chuẩn
export type CalibrationStrictness = 'strict' | 'normal' | 'loose';

/** Là LọcNhân vậtBản ghi（để phục hồi） */
export interface FilteredCharacterRecord {
  name: string;
  reason: string;
}

/**
 * Nhân vậthông tin sân khấu t
 * Used to identify Nhân vậHình ảnh Phi của t trong một số tập cụ thểên bản
 */
export interface CharacterStageInfo {
  stageName: string;              // Giai đoạn Tên："phiên bản trẻ"、"phiên bản trung niên"、"Giai đoạn đầu kinh doanh"
  episodeRange: [number, number]; // Phạm vi cài đặt áp dụng：[Tập khởi đầu, Kết thúbộ c]
  ageDescription?: string;        // Tuổi M ở giai đoạn nàyô tả："25 tuổi"、"50 tuổi"
}

/**
 * Nhân vật Yếu tố nhất quán
 * Dùng để giữ nguyên Nhân vậCó thể xác định ở các giai đoạn khác nhau
 */
export interface CharacterConsistencyElements {
  facialFeatures?: string;  // đặc điểm khuôn mặt（không thay đổi）：hình dạng mắt、Đặc điểm khuôn mặt hình chữ Tỷ lệ
  bodyType?: string;        // Đặc điểm vật lý：chiều cao、vóc dáng
  uniqueMarks?: string;     // dấu ấn độc đáo：vết bớt、vết sẹo、Tính năng mang tính biểu tượng
}

/**
 * Nhân vậtIdentity Anchor - Khóa tính năng 6 lớp Hệ thống
 * Được sử dụng để đảm bảo rằng hình ảnh do AI tạo ra có cùng Nhân vật ở C khác nhauảnh giữ sự nhất quán
 */
export interface CharacterIdentityAnchors {
  // ① Lớp pha xương - Cấu trúc xương mặt
  faceShape?: string;       // hình dạng khuôn mặt：oval/square/heart/round/diamond/oblong
  jawline?: string;         // đường viền hàm：sharp angular/soft rounded/prominent
  cheekbones?: string;      // xương gò má：high prominent/subtle/wide set
  
  // ② Lớp đặc điểm khuôn mặt - mắt, mũi và môi chính xác Mô tả
  eyeShape?: string;        // hình dạng mắt：almond/round/hooded/monolid/upturned
  eyeDetails?: string;      // Chi tiết mắt：double eyelids, slight epicanthic fold
  noseShape?: string;       // Hình dáng mũi：straight bridge, rounded tip, medium width
  lipShape?: string;        // hình môi：full lips, defined cupid's bow
  
  // ③ Xác định lớp đánh dấu – điểm neo mạnh nhất
  uniqueMarks: string[];    // Bắt buộc！vết bớt/vết sẹo/V chính xác cho nốt ruồiị trí："small mole 2cm below left eye"
  
  // ④ Màu sắc lớp điểm neo - Giá trị màu Hex
  colorAnchors?: {
    iris?: string;          // màu mống mắt：#3D2314 (dark brown)
    hair?: string;          // màu tóc：#1A1A1A (jet black)
    skin?: string;          // màu da：#E8C4A0 (warm beige)
    lips?: string;          // màu môi：#C4727E (dusty rose)
  };
  
  // ⑤ lớp kết cấu da
  skinTexture?: string;     // visible pores on nose, light smile lines
  
  // ⑥ lớp neo kiểu tóc
  hairStyle?: string;       // kiểu tóc：shoulder-length, layered, side-parted
  hairlineDetails?: string; // đường chân tóc：natural hairline, slight widow's peak
}

/**
 * Nhân vậtTiêu cựcPrompt
 * Dùng để loại trừ việc không tuân thủ Nhân vậT đặt bởi tạoKết quả
 */
export interface CharacterNegativePrompt {
  avoid: string[];          // Những đặc điểm cần tránh：["blonde hair", "blue eyes", "beard"]
  styleExclusions?: string[]; // Phong cáloại trừ：["anime style", "cartoon"]
}

export interface ScriptCharacter {
  id: string; // Script-level id
  name: string;
  gender?: string;
  age?: string;
  personality?: string; // Đặc điểm tính cách（Chi tiếtMô tả）
  role?: string; // danh tính/Nền（Chi tiếtMô tả）
  traits?: string; // đặc điểm cốt lõi（Chi tiếtMô tả）
  skills?: string; // Kỹ năng/khả năng（Chẳng hạn như võ thuật、ma thuật vv.）
  keyActions?: string; // hành vi chính/Chứng thư
  appearance?: string; // Ngoại hình Mô tả
  relationships?: string; // mối quan hệ chính
  tags?: string[]; // Nhân vậthẻ t，Chẳng hạn như: #võ thuật #Nam Chúa #kiếm sĩ
  notes?: string; // Nhân vậtNhận xét（Lô Giải thích）
  status?: CompletionStatus; // Nhân vậthời gianTạoTrạng thái
  characterLibraryId?: string; // Liên kết Thư viện nhân vậtID
  
  // === Nh nhiều giai đoạnân vậtHỗ trợ ===
  baseCharacterId?: string;        // Nh gốcân vậtID（Giai đoạn Nhân vật trỏ tới Cơ bảnNhân vật，Chẳng hạn như"Phiên bản trẻ Zhang Ming"chỉ vào"Trương Minh"）
  stageInfo?: CharacterStageInfo;  // thông tin sân khấu（Giai đoạn Nh thôiân vật có trường này）
  stageCharacterIds?: string[];    // Giai đoạn dẫn xuất Nhân vậdanh sách tID（chỉ Cơ bảnNhân vật có trường này）
  consistencyElements?: CharacterConsistencyElements; // yếu tố nhất quán（Cơ bảnNhân vậtĐịnh nghĩa，Giai đoạn Nhân vậsự kế thừa）
  visualPromptEn?: string;         // Lời nhắc trực quan bằng tiếng Anh（cho hình ảnh AI Tạo）
  visualPromptZh?: string;         // Lời nhắc trực quan của Trung Quốc
  
  // === Neo nhận dạng lớp 6（Điền vào trong quá trình hiệu chỉnh AI）===
  identityAnchors?: CharacterIdentityAnchors;  // neo nhận dạng（cho Nhân vậtTính nhất quán）
  negativePrompt?: CharacterNegativePrompt;    // Lời nhắc tiêu cực（Loại trừ các tính năng chưa từng có）
}

export interface ScriptScene {
  id: string; // Script-level id
  name?: string;
  location: string;
  time: string;
  atmosphere: string;
  visualPrompt?: string; // Tiếng Trung Cảnh tầm nhìn Mô tả（cho Cảnh bản đồ khái niệm Tạo）
  tags?: string[]; // Cảthẻ nh，Chẳng hạn như: #cột gỗ #lưới cửa sổ #tòa nhà cổ
  notes?: string; // Ghi chú vị trí（Lô Giải thích）
  status?: CompletionStatus; // CảnhTạoTrạng thái
  sceneLibraryId?: string; // Liên kết Thư viện cảnhID
  
  // === C chuyên nghiệpảlĩnh vực thiết kế（Điền vào trong quá trình hiệu chỉnh AI）===
  visualPromptEn?: string;      // Lời nhắc trực quan bằng tiếng Anh（cho hình ảnh AI Tạo）
  architectureStyle?: string;   // Kiến trúcPhong cách（Hiện đại và đơn giản/Trung Quốc cổ điển/phong cách công nghiệp/Phong cách châu Âu vv.）
  lightingDesign?: string;      // Ánh sáthiết kế（ánh sáng tự nhiên/đèn/mờ/Tươi sáng và như vậy）
  colorPalette?: string;        // Màu sắgiai điệu c（Ấm Tông màu/lạnh Tông màu/Màu sắc trung tính vv.）
  keyProps?: string[];          // Danh sách các đạo cụ chính
  spatialLayout?: string;       // Bố cục không gianMô tả
  eraDetails?: string;          // Đặc điểm của thời đại（Chẳng hạn như phong cách trang trí những năm 2000 Phong cách）
  
  // === Ngoại hìnhống kê（Điền vào trong quá trình hiệu chỉnh AI）===
  episodeNumbers?: number[];    // Nó xuất hiện ở tập nào?
  appearanceCount?: number;     // Số lần xuất hiện
  importance?: 'main' | 'secondary' | 'transition';  // Cảtầm quan trọng của nh
  
  // === Nhiều Góc nhìđồ thị chung（CảnhNềnTính nhất quán）===
  contactSheetImage?: string;   // Hình ảnh chung gốc（base64 hoặc URL）
  contactSheetImageUrl?: string; // URL HTTP biểu đồ liên kết
  viewpoints?: SceneViewpointData[]; // Góc nhìnDanh sách
  viewpointImages?: Record<string, {
    imageUrl: string;           // H sau khi cắtình ảnh（base64 hoặc URL）
    imageBase64?: string;       // Sử dụng base64 để duy trì
    gridIndex: number;          // V trong sơ đồ chungị trí (0-5)
  }>;
}

/**
 * CảnhGóc nhìdữ liệu（Phiên bản đơn giản，Được lưu trữ trong ScriptScene）
 */
export interface SceneViewpointData {
  id: string;           // Góc nhìnID，Chẳng hạn như 'dining', 'sofa', 'window'
  name: string;         // Tên tiếng Trung：khu vực bàn ăn、khu vực ghế sofa、cửa sổ
  nameEn: string;       // tên tiếng anh
  shotIds: string[];    // liên kết tiến sĩân cảdanh sách nhID
  keyProps: string[];   // Góc nhìn Đạo cụ bắt buộc
  gridIndex: number;    // V trong sơ đồ chungị trí (0-5)
}

export interface ScriptParagraph {
  id: number;
  text: string;
  sceneRefId: string;
}

// Cảnh nội dung gốc（Giữ đối thoại đầy đủ và Hành động）
export interface SceneRawContent {
  sceneHeader: string;        // Cảnh đầu：Chẳng hạn như "Trong vòng 1-1 ngày, Thượng Hải Zhangjia"
  characters: string[];       // nhân vật
  content: string;            // Hoàn thành Cảnh nội dung（Đối thoại+Hành động+phụ đề, v.v.）
  dialogues: DialogueLine[];  // Danh sách hội thoại được phân tích cú pháp
  actions: string[];          // Hành độdanh sách mô tả ng（△sự khởi đầu）
  subtitles: string[];        // phụ đề【】
  weather?: string;           // thời tiết（rõ ràng/mưa/tuyết/sương mù/Âm v.v.，Từ Cảphát hiện nội dung nh）
  timeOfDay?: string;         // Thời gian（ngày/đêm/buổi sáng/Chạng vạng và những người khác，Từ Cảtrích xuất tiêu đề nh）
}

// dòng đối thoại
export interface DialogueLine {
  character: string;          // Nhân vậtên t
  parenthetical?: string;     // H trong ngoặcành động/cảm xúc，Chẳng hạn như（uống）
  line: string;               // Nội dung dòng
}

// bộ K gốcịch bảnNội dung
export interface EpisodeRawScript {
  episodeIndex: number;       // Tập nào
  title: string;              // tiêu đề tập phim
  synopsis?: string;          // Tóm tắt tập/Tóm tắt（AITạhướng dẫn sử dụng Chỉnh sửa）
  keyEvents?: string[];       // Chìa khóa của tập này là Sự kiện
  rawContent: string;         // Nội dung đầy đủ gốc
  scenes: SceneRawContent[];  // Đã phân tích cú pháp Cảnh danh sách
  shotGenerationStatus: 'idle' | 'generating' | 'completed' | 'error';  // Phân cảnhTạoTrạng thái
  lastGeneratedAt?: number;   // Lần trước T.ạoThời gian
  synopsisGeneratedAt?: number; // phác thảo TạoThời gian
  season?: string;            // mùa（mùa xuân/mùa hè/mùa thu/mùa đông，Trích xuất từ phụ đề）
}

// Dự ánNềthông tin
export interface ProjectBackground {
  title: string;              // Tiêu đề phim truyền hình
  genre?: string;             // Loại（chiến tranh kinh doanh/võ thuật/tình yêu v.v.）
  era?: string;               // Thời đại Nền（Cộng hòa Trung Quốc/hiện đại/Thời cổ đại v.v.）
  timelineSetting?: string;   // Chính xácờtôi cài đặt dòng（Chẳng hạn như"Mùa hè 2022"、"1990-2020"）
  storyStartYear?: number;    // Câu chuyện Bắt đầuNăm（Được sử dụng để lấy Nhân vậtuổi tác）
  storyEndYear?: number;      // Câu chuyện Kết thúnăm c
  totalEpisodes?: number;     // tổng số tập
  outline: string;            // Tóm tắt
  characterBios: string;      // Tiểu sử
  worldSetting?: string;      // thế giới quan/Phong cácài đặt ch
  themes?: string[];          // Từ khóa chủ đề
}

// ==================== dữ liệu cấp độ kịch（SeriesMeta）— Chia sẻ giữa các bộ ====================

/** thực thể được đặt tên：Địa lý/Mặt hàng/trại vv. */
export interface NamedEntity {
  name: string;
  desc: string;
}

/** trại/quyền lực */
export interface Faction {
  name: string;
  members: string[];
}

/** Nhân vậmối quan hệ */
export interface CharacterRelationship {
  from: string;
  to: string;
  type: string;
}

/**
 * Siêu dữ liệu cấp kịch — Dự ánTrang chủhiển thị，Tất cảthiết lập chia sẻ
 * Lần đầu NhậTự động điền bằng AI + biểu thức chính quy khi p，Viết lại phong phú sau khi hiệu chuẩn
 */
export interface SeriesMeta {
  // === Cốt lõi câu chuyện ===
  title: string;
  logline?: string;                   // Tóm tắt một câu
  outline?: string;                   // Một câu chuyện hoàn chỉnh từ 100-500 từ
  centralConflict?: string;           // Xung đột dòng chính
  themes?: string[];                  // [trả thù, âm mưu, tình bạn]

  // === thế giới quan ===
  era?: string;                       // thời cổ đại/hiện đại/tương lai
  genre?: string;                     // võ thuật/chiến tranh kinh doanh/tình yêu
  timelineSetting?: string;           // Chính xácờtôi gian dòng
  geography?: NamedEntity[];          // Cài đặt địa lý
  socialSystem?: string;              // hệ thống xã hội
  powerSystem?: string;               // hệ thống điện
  keyItems?: NamedEntity[];           // mục chính
  worldNotes?: string;                // bổ sung thế giới quan（văn bản miễn phí）

  // === Nhân vậhệ thống t ===
  characters: ScriptCharacter[];      // được quảng bá từ scriptData.characters
  factions?: Faction[];               // trại/quyền lực
  relationships?: CharacterRelationship[];  // Nhân vậmối quan hệ

  // === Tầm nhìnHệ thống ===
  styleId?: string;
  recurringLocations?: ScriptScene[]; // Cư dân Thư viện cảnh（≥Xuất hiện ở tập 2）
  colorPalette?: string;              // Nhân vật chính của toàn bộ vở kịchông màu

  // === Cài đặt sản xuất ===
  language?: string;
  promptLanguage?: PromptLanguage;
  calibrationStrictness?: CalibrationStrictness;
  metadataMarkdown?: string;          // Cơ sở kiến thức AI MD
  metadataGeneratedAt?: number;
}

// đặt（Episode）
export interface Episode {
  id: string;
  index: number;
  title: string;
  description?: string;
  sceneIds: string[]; // Bộ này chứa CảnhID
}

export interface ScriptData {
  title: string;
  genre?: string;
  logline?: string;
  language: string;
  targetDuration?: string;
  characters: ScriptCharacter[];
  scenes: ScriptScene[];
  episodes: Episode[]; // Danh sách tập
  storyParagraphs: ScriptParagraph[];
}

// ==================== Điều khiển quay videoLoại（đèn/tiêu điểm/Thiết bị/Hiệu ứng/tốc độ） ====================

// Gaffer
export type LightingStyle = 
  | 'high-key'      // hồ sơ cao：tươi sáng、độ tương phản thấp，Phù hợp với phim hài/hàng ngày
  | 'low-key'       // cấu hình thấp：đần độn、độ tương phản cao，Thích hợp cho sự hồi hộp/noir
  | 'silhouette'    // hình bóng：Hình bóng toàn màu đen có đèn nền
  | 'chiaroscuro'   // chiaroscuro：Ánh sáng và bóng tối mãnh liệt của Rembrandt
  | 'natural'       // ánh sáng tự nhiên：Cảm giác ban ngày thực sự
  | 'neon'          // đèn neon：cyberpunk/hộp đêm
  | 'candlelight'   // dưới ánh nến：ánh sáng vàng ấm áp
  | 'moonlight';    // ánh trăng：màu xanh dịu mát

export type LightingDirection = 
  | 'front'         // ánh sáng phía trước：bằng phẳng、Không Bóng
  | 'side'          // ánh sáng bên：Nhấn mạnh vào đường nét và kết cấu
  | 'back'          // Đèn nền：ánh sáng vành/hình bóng
  | 'top'           // ánh sáng hàng đầu：cảm giác thẩm vấn/kịch tính
  | 'bottom'        // Ánh sáng phía dưới：kinh dị/không tự nhiên
  | 'rim'           // ánh sáng vành：phát sáng cạnh，với Nềsự tách biệt
  | 'three-point';  // Chiếu sáng ba điểm：Chiếu sáng phim và truyền hình tiêu chuẩn

export type ColorTemperature = 
  | 'warm'          // Màu ấm 3200K：dưới ánh nến/đèn vonfram
  | 'neutral'       // Trung tính 5500K：ánh sáng ban ngày
  | 'cool'          // Màu sắc mát mẻ 7000K：ngày nhiều mây/ánh trăng
  | 'golden-hour'   // giờ vàng：bình minh và hoàng hôn
  | 'blue-hour'     // giờ nhạc blues：sau khi mặt trời lặn
  | 'mixed';        // MixNhiệt độ màu：Ấm và lạnh

// Kéo lấy nét / 1st AC)
export type DepthOfField = 
  | 'ultra-shallow' // f/1.4 Rất nông：Chỉ có đôi mắt là rõ ràng，mờ mạnh
  | 'shallow'       // f/2,8 nông：Ký tự rõ ràng，Nềlờ mờ
  | 'medium'        // f/5.6 Vừa phải：Triển vọng đến Trung cảnh rõ ràng
  | 'deep'          // f/11 sâu：Toàn màn hình rõ ràng
  | 'split-diopter';// diop：Cả mặt trước và mặt sau đều rõ nhưng ở giữa mờ

export type FocusTransition = 
  | 'rack-to-fg'    // tập trung vào tiền cảnh
  | 'rack-to-bg'    // Tập trung vào Nền
  | 'rack-between'  // Tập trung giữa các ký tự
  | 'pull-focus'    // theo dõi trọng tâm（Theo dõi các chủ thể chuyển động）
  | 'none';         // tiêu điểm cố định

// Giàn khoan máy ảnh
export type CameraRig = 
  | 'tripod'        // chân máy：Tuyệt đối ổn định
  | 'handheld'      // cầm tay：Cảm giác thở/Phim tài liệu/lo lắng
  | 'steadicam'     // Steadicam：Mượt theo
  | 'dolly'         // Xe lửa：Đẩy và kéo đường thẳng thống nhất
  | 'crane'         // cánh tay rocker：nâng theo chiều dọc/vòng cung lớn
  | 'drone'         // chụp ảnh trên không：nhìn ra/phạm vi chuyển động rộng
  | 'shoulder'      // vai：Lắc nhẹ/Tin tức và phim tài liệu
  | 'slider';       // Ray trượt：Chuyển động mượt mà trên khoảng cách ngắn

export type MovementSpeed = 'very-slow' | 'slow' | 'normal' | 'fast' | 'very-fast';

// Hiệu ứphân chia ng (SFX cài sẵn)
export type AtmosphericEffect = 
  | 'rain'          | 'heavy-rain'     // mưa / mưa lớn
  | 'snow'          | 'blizzard'       // tuyết / bão tuyết
  | 'fog'           | 'mist'           // Sương mù dày đặc / sương mù
  | 'dust'          | 'sandstorm'      // bụi bặm / bão cát
  | 'smoke'         | 'haze'           // khói / sương mù
  | 'fire'          | 'sparks'         // ngọn lửa / tia lửa
  | 'lens-flare'    | 'light-rays'     // Cảnh quay halo / Hiệu ứng Tyndall
  | 'falling-leaves'| 'cherry-blossom' // lá rụng / hoa anh đào
  | 'fireflies'     | 'particles';     // đom đóm / hạt

export type EffectIntensity = 'subtle' | 'moderate' | 'heavy';

// Kiểm soát tốc độ (Tăng tốc độ)
export type PlaybackSpeed = 
  | 'slow-motion-4x'  // 0,25x siêu chậm：Viên đạn thứời gian
  | 'slow-motion-2x'  // H chậm 0,5 lầnành động：Hành độcực khoái
  | 'normal'           // 1x
  | 'fast-2x'          // tua nhanh gấp 2 lần：Thờtôi đã vượt qua
  | 'timelapse';       // chụp ảnh tua nhanh thời gian

// Góc máy ảnh
export type CameraAngle =
  | 'eye-level'      // tầm mắt：G tự nhiênóc nhìn
  | 'high-angle'     // bắn từ trên cao：trịch thượng
  | 'low-angle'      // Nhìn lên：Cảm giác anh hùng
  | 'birds-eye'      // nhìn từ trên cao：Truyền hình Nga Truyền hình Nga
  | 'worms-eye'      // tầm nhìn côn trùng：góc cực thấp
  | 'over-shoulder'  // Trên vai：Cuộc trò chuyện Cảnh
  | 'side-angle'     // Bắn bên：Bên Góc nhìn
  | 'dutch-angle'    // Mũi Hà Lan：In nghiêcảm giác khó chịu
  | 'third-person';  // người thứ ba：Trò chơi Góc nhìn

// Cảnh quayfocal length (Tiêu cự)
export type FocalLength =
  | '8mm'    // mắt cá：Biến dạng thùng cực lớn
  | '14mm'   // góc siêu rộng：Ý thức mạnh mẽ về quan điểm
  | '24mm'   // góc rộng：bối cảnh môi trường
  | '35mm'   // Góc rộng tiêu chuẩn：chụp ảnh đường phố/ý nghĩa tài liệu
  | '50mm'   // Tiêu chuẩn：Gần với mắt ngườiGóc nhìn
  | '85mm'   // chân dung：Mặt Tỷ lệThoải mái
  | '105mm'  // tiêu điểm trung bình：mềm Nềnén
  | '135mm'  // Chụp ảnh xa：mạnh Nềnén
  | '200mm'  // chụp ảnh xa：nén cực độ
  | '400mm'; // siêu tele：Nén mạnh nhất

// Kỹ thuật chụp ảnh
export type PhotographyTechnique =
  | 'long-exposure'        // tiếp xúc lâu：chuyển động mờ/dấu vết ánh sáng
  | 'double-exposure'      // phơi sáng nhiều lần：Hiệu ứng trong suốt của lớp phủ
  | 'macro'                // Vĩ mô：Chi tiết cực chất
  | 'tilt-shift'           // Dịch chuyển độ nghiêng：hiệu ứng thu nhỏ
  | 'high-speed'           // màn trập tốc độ cao：đóng băngHành động
  | 'bokeh'                // Độ sâu trường ảnh mờ：Điểm mơ ước
  | 'reflection'           // sự phản ánh/bắn gương
  | 'silhouette-technique';// bắn bóng

// Ghi chú hiện trường/Giám sát kịch bản / Continuity)
export interface ContinuityCharacterState {
  position: string;      // "Đứng bên trái màn hình"
  clothing: string;      // "bộ đồ màu xanh，cà vạt bị lỏng"
  expression: string;    // "cau mày"
  props: string[];       // ["tay cầm phong bì", "túi bên trái"]
}

export interface ContinuityRef {
  prevShotId: string | null;         // trướcCảnh quay ID
  nextShotId: string | null;         // Tiếp theoCảnh quay ID
  prevEndFrameUrl: string | null;    // trướcCảnh quay khung hình cuối cùng（tự động điền）
  characterStates: Record<string, ContinuityCharacterState>;  // charName -> Trạng tháiSnapshot
  lightingContinuity: string;        // "Tương tự như C trướcảnh quay duy trì cùng một hướng ánh sáng bên"
  flaggedIssues: string[];           // AI tự động phát hiện nguy cơ vượt băng đảng
}

export type ShotStatus = 'idle' | 'generating' | 'completed' | 'failed';
export type KeyframeStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type KeyframeType = 'start' | 'end';

/**
 * Keyframe for shot generation (start/end frames for video)
 * Based on CineGen-AI types.ts
 */
export interface Keyframe {
  id: string;
  type: KeyframeType;
  visualPrompt: string;
  imageUrl?: string;
  status: KeyframeStatus;
}

/**
 * Video interval data
 */
export interface VideoInterval {
  videoUrl?: string;
  duration?: number;
  status: ShotStatus;
}

export interface Shot {
  id: string;
  index: number;
  episodeId?: string;        // ID bộ thuộc về
  sceneRefId: string;        // Script scene id
  sceneId?: string;          // Scene store id
  sceneViewpointId?: string; // liên quan đến CảnhGóc nhìnID（G sau khi cắt đồ thị chungóc nhìn）
  
  // === Phân cảnh thông tin cốt lõi ===
  actionSummary: string;     // Hành độngMô tả（Người dùngôn ngữ）
  visualDescription?: string; // Màn hình chi tiết Mô tả（Người dùngôn ngữ，Chẳng hạn như：“Bàn thờ phápàn cảnh，Ánh sáng yếu ớt bao trùm bóng tối...”）
  completionStatus?: CompletionStatus;
  
  // === Cảnh quayngôn ngữ ===
  cameraMovement?: string;   // Bài tập quay đầu（Dolly In, Pan Right, Tĩnh, Theo dõi, v.v.）
  specialTechnique?: string; // Kỹ thuật chụp đặc biệt（zoom vòi、Viên đạn thứời gian、Xe đưa đón FPV, v.v.）
  shotSize?: string;         // Cỡ cảnh（Chụp rộng, Chụp trung bình, Cận cảnh, ECU, v.v.）
  duration?: number;         // ước tính thời lượng（giây）
  
  // === Thị giác Tạo ===
  visualPrompt?: string;     // Tiếng Anh Visual Mô tả（cho Hình ảnhTạo，Tương thích với các phiên bản cũ hơn）
  
  // === Ba lớp NhắcHệ thống (Seedance 1.5 Pro) ===
  imagePrompt?: string;      // Lời nhắc khung đầu tiên（Tiếng Anh，tĩnhMô tả）
  imagePromptZh?: string;    // Lời nhắc khung đầu tiên（Tiếng Trung）
  videoPrompt?: string;      // VideoPrompt（Tiếng Anh，Động Hành động）
  videoPromptZh?: string;    // VideoPrompt（Tiếng Trung）
  endFramePrompt?: string;   // Lời nhắc khung cuối cùng（Tiếng Anh，tĩnhMô tả）
  endFramePromptZh?: string; // Lời nhắc khung cuối cùng（Tiếng Trung）
  needsEndFrame?: boolean;   // Liệu khung hình cuối cùng có cần thiết hay không
  
  // === Âthiết kế m thanh ===
  dialogue?: string;         // đối thoại/dòng
  ambientSound?: string;     // âm thanh xung quanh（Chẳng hạn như：“Tiếng gió nặng nề vang vọng trong căn phòng trống”）
  soundEffect?: string;      // Hiệu ứng âm thanh（Chẳng hạn như：“Tiếng chuông xa xăm”）
  
  // === Nhân vậthông tin t ===
  characterNames?: string[];
  characterIds: string[];
  characterVariations: Record<string, string>; // charId -> variationId
  
  // === Thẻ cảm xúc ===
  emotionTags?: string[];  // Mảng ID thẻ tình cảm，Chẳng hạn như ['sad', 'tense', 'serious']
  
  // === lĩnh vực dẫn dắt câu chuyện（Dựa trên《Ngữ pháp ngôn ngữ điện ảnh》） ===
  narrativeFunction?: string;   // chức năng tường thuật：điềm báo/Nâng cấp/đỉnh điểm/bước ngoặt/Chuyển tiếp/Lời kết
  conflictStage?: string;       // giai đoạn xung đột：giới thiệu/tăng cường/Đối đầu/bước ngoặt/giải quyết/hậu quả/phụ trợ
  shotPurpose?: string;         // Cảnh quay mục đích：C nàyảNh quay phục vụ cốt lõi của câu chuyện như thế nào
  storyAlignment?: string;      // và thế giới quan/Sự nhất quán ở cốt lõi của câu chuyện：aligned/minor-deviation/needs-review
  visualFocus?: string;         // tập trung thị giác：Người xem nên xem gì（theo thứ tự）
  cameraPosition?: string;      // Góc máyMô tả：Chữ V của camera so với nhân vậtị trí
  characterBlocking?: string;   // Bố cục nhân vật：Chữ V của nhân vật trong ảnhị trímối quan hệ
  rhythm?: string;              // Nhịp điệu Mô tả：C nàyảNhịp điệu nh quay

  // === Gaffer ===
  lightingStyle?: LightingStyle;           // Chiếu sángPhong cámặc định
  lightingDirection?: LightingDirection;   // Hướng nguồn sáng chính
  colorTemperature?: ColorTemperature;     // Nhiệt độ màu
  lightingNotes?: string;                  // Tự do chiếu sáng Mô tả（bổ sung）

  // === Kéo lấy nét ===
  depthOfField?: DepthOfField;             // độ sâu trường ảnh
  focusTarget?: string;                    // tiêu điểmĐích: "khuôn mặt" / "phong bì trên bàn"
  focusTransition?: FocusTransition;       // Tập trung Hành động

  // === Giàn khoan máy ảnh ===
  cameraRig?: CameraRig;                   // Thiết bị chụp ảnh
  movementSpeed?: MovementSpeed;           // Tốc độ di chuyển

  // === Hiệu ứphân chia ng (SFX cài sẵn) ===
  atmosphericEffects?: AtmosphericEffect[]; // Không khí Xin chàoệu ứng（Có thể có nhiều lựa chọn）
  effectIntensity?: EffectIntensity;       // Hiệu ứcường độ ng

  // === Kiểm soát tốc độ (Tăng tốc độ) ===
  playbackSpeed?: PlaybackSpeed;           // Phátốc độ

  // === góc chụp / tiêu cự / Kỹ thuật ===
  cameraAngle?: CameraAngle;               // góc chụp
  focalLength?: FocalLength;               // Cảtiêu cự nh quay
  photographyTechnique?: PhotographyTechnique; // kỹ thuật chụp ảnh

  // === Ghi chú hiện trường/Tính liên tục ===
  continuityRef?: ContinuityRef;           // Tài liệu tham khảo để chơi liên tục

  // Keyframes for start/end frame generation (CineGen-AI pattern)
  keyframes?: Keyframe[];

  // Generation (legacy single-image mode)
  imageStatus: ShotStatus;
  imageProgress: number;
  imageError?: string;
  imageUrl?: string;
  imageMediaId?: string;

  // Video generation
  videoStatus: ShotStatus;
  videoProgress: number;
  videoError?: string;
  videoUrl?: string;
  videoMediaId?: string;
  
  // Video interval (CineGen-AI pattern)
  interval?: VideoInterval;
}
