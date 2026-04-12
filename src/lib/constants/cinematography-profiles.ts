// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Cinematography Profile Presets — Nhiếp ảnh Phong cách\u6863\u6848\u9884\u8bbe
 *
 * \u5728「phong cách vẽ tranh\u9009\u62e9」và「\u9010\u955cTrường điều khiển bắn súng」\u4e4b\u95f4，\u63d0\u4f9bDự án\u7ea7\u6444\u5f71ngôn ngữ\u57fa\u51c6。
 * AI \u6821\u51c6\u65f6\u4ee5\u6b64choMặc định\u503e\u5411，prompt builder \u5728\u9010\u955ctừ\u6bb5cho\u7a7a\u65f6\u56de\u9000Đến\u6b64\u5904。
 */

import type {
  LightingStyle,
  LightingDirection,
  ColorTemperature,
  DepthOfField,
  FocusTransition,
  CameraRig,
  MovementSpeed,
  AtmosphericEffect,
  EffectIntensity,
  PlaybackSpeed,
  CameraAngle,
  FocalLength,
  PhotographyTechnique,
} from '@/types/script';

// ==================== LoạiĐịnh nghĩa ====================

export type CinematographyCategory =
  | 'cinematic'     // \u7535\u5f71\u7c7b
  | 'documentary'   // Phim tài liệu\u7c7b
  | 'stylized'      // Phong cách\u5316
  | 'genre'         // Loại\u7247
  | 'era';          // thời đạiPhong cách

export interface CinematographyProfile {
  id: string;
  name: string;          // Tên tiếng Trung
  nameEn: string;        // tên tiếng anh
  category: CinematographyCategory;
  description: string;   // Trung Quốc Mô tả（1-2\u53e5）
  emoji: string;         // \u6807\u8bc6 emoji

  // ---- đènMặc định (Gaffer) ----
  defaultLighting: {
    style: LightingStyle;
    direction: LightingDirection;
    colorTemperature: ColorTemperature;
  };

  // ---- tiêu điểmMặc định (Focus Puller) ----
  defaultFocus: {
    depthOfField: DepthOfField;
    focusTransition: FocusTransition;
  };

  // ---- Thiết bịMặc định (Camera Rig) ----
  defaultRig: {
    cameraRig: CameraRig;
    movementSpeed: MovementSpeed;
  };

  // ---- Khí quyển Mặc định (On-set SFX) ----
  defaultAtmosphere: {
    effects: AtmosphericEffect[];
    intensity: EffectIntensity;
  };

  // ---- tốc độMặc định (Speed Ramping) ----
  defaultSpeed: {
    playbackSpeed: PlaybackSpeed;
  };

  // ---- góc chụp / tiêu cự / Kỹ thuậtMặc định（Tùy chọn） ----
  defaultAngle?: CameraAngle;
  defaultFocalLength?: FocalLength;
  defaultTechnique?: PhotographyTechnique;

  // ---- AI \u6307\u5bfc ----
  /** \u7ed9 AI Tiếng Trungđạo diễn hình ảnhGiải thích（2-3\u53e5\u8bdd，Lưu ý\u5165 system prompt） */
  promptGuidance: string;
  /** Tài liệu tham khảo\u5f71\u7247danh sách（Trợ giúp AI \u7406\u89e3ĐíchPhong cách） */
  referenceFilms: string[];
}

// ==================== \u5206\u7c7bthông tin ====================

export const CINEMATOGRAPHY_CATEGORIES: { id: CinematographyCategory; name: string; emoji: string }[] = [
  { id: 'cinematic', name: '\u7535\u5f71\u7c7b', emoji: '🎬' },
  { id: 'documentary', name: 'Phim tài liệu\u7c7b', emoji: '📹' },
  { id: 'stylized', name: 'Phong cách\u5316', emoji: '🎨' },
  { id: 'genre', name: 'Loại\u7247', emoji: '🎭' },
  { id: 'era', name: 'thời đạiPhong cách', emoji: '📅' },
];

// ==================== \u9884\u8bbedanh sách ====================

// ---------- \u7535\u5f71\u7c7b (cinematic) ----------

const CINEMATIC_PROFILES: CinematographyProfile[] = [
  {
    id: 'classic-cinematic',
    name: '\u7ecf\u5178\u7535\u5f71',
    nameEn: 'Classic Cinematic',
    category: 'cinematic',
    description: 'Tiêu chuẩnbệnh viện\u7ebf\u7535\u5f71\u8d28\u611f，Chiếu sáng ba điểm，tự nhiênNhiệt độ màu，\u5300\u901fQuỹ đạo\u8fd0\u955c，bức tranh\u7aef\u6b63\u5927\u6c14',
    emoji: '🎞️',
    defaultLighting: { style: 'natural', direction: 'three-point', colorTemperature: 'warm' },
    defaultFocus: { depthOfField: 'medium', focusTransition: 'rack-between' },
    defaultRig: { cameraRig: 'dolly', movementSpeed: 'slow' },
    defaultAtmosphere: { effects: [], intensity: 'subtle' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '50mm',
    promptGuidance: '\u9075\u5faa\u7ecf\u5178\u7535\u5f71\u8bed\u6cd5，Chiếu sáng ba điểmcho Cơ bản，Ấm Tông màu\u8425\u9020ấm áp\u8d28\u611f。Quỹ đạo\u63a8\u62c9giữbức tranh\u7a33\u5b9a\u6d41\u7545，độ sâu trường ảnh\u968fchức năng tường thuật\u8c03\u6574——\u5bf9\u8bddsử dụng\u6d45độ sâu trường ảnh\u805a\u7126cảm xúc，Toàn cảnhsử dụng\u6df1độ sâu trường ảnh\u4ea4\u4ee3môi trường。',
    referenceFilms: ['\u8096\u7533\u514bcủasự cứu chuộc', '\u963f\u7518\u6b63\u4f20', '\u6559\u7236'],
  },
  {
    id: 'film-noir',
    name: '\u9ed1\u8272\u7535\u5f71',
    nameEn: 'Film Noir',
    category: 'cinematic',
    description: 'cấu hình thấp\u5e03\u5149、\u5f3a\u70c8chiaroscuro、ánh sáng bênchoChúa ơi、lạnh Tông màu、sương mù\u5f25\u6f2b、cầm tayCảm giác thở',
    emoji: '🖤',
    defaultLighting: { style: 'low-key', direction: 'side', colorTemperature: 'cool' },
    defaultFocus: { depthOfField: 'shallow', focusTransition: 'rack-to-fg' },
    defaultRig: { cameraRig: 'handheld', movementSpeed: 'slow' },
    defaultAtmosphere: { effects: ['fog', 'smoke'], intensity: 'moderate' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'low-angle',
    defaultFocalLength: '35mm',
    promptGuidance: '\u9ed1\u8272\u7535\u5f71của\u7075\u9b42\u662fÁnh sáng——\u5927\u9762\u79efBóngtrong\u53ea\u7559một\u675fánh sáng bên\u7167\u4eaenhân vật。lạnh Tông màu\u914d\u5408sương mù\u8425\u9020\u4e0d\u5b89\u611f，cầm tay\u5fae\u6643\u589e\u52a0\u771f\u5b9ecủalo lắng\u611f。\u5c3d\u91cf\u8ba9nhân vật\u534a\u8138\u5728bóng tốitrong，\u6697\u793aNhân vậtcủa\u53cc\u9762\u6027。',
    referenceFilms: ['\u94f6\u7ffc\u6740tay', '\u5510\u4ebađường phố', 'Không.ba\u4eba', '\u7f6a\u6076\u4e4b\u57ce'],
  },
  {
    id: 'epic-blockbuster',
    name: 'sử thi\u5927\u7247',
    nameEn: 'Epic Blockbuster',
    category: 'cinematic',
    description: 'Cấu hình cao và tươi sáng、ánh sáng phía trước、\u6df1độ sâu trường ảnh、cánh tay rocker\u5927\u5e45các môn thể thao、Cảnh quay halo、\u5b8f\u5927\u611f',
    emoji: '⚔️',
    defaultLighting: { style: 'high-key', direction: 'front', colorTemperature: 'neutral' },
    defaultFocus: { depthOfField: 'deep', focusTransition: 'none' },
    defaultRig: { cameraRig: 'crane', movementSpeed: 'normal' },
    defaultAtmosphere: { effects: ['lens-flare', 'dust'], intensity: 'moderate' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '24mm',
    promptGuidance: 'sử thi\u611f\u6765\u81ea\u7a7a\u95f4\u7eb5\u6df1——sử dụng\u6df1độ sâu trường ảnhvàcánh tay rocker\u5927\u5e45nânghiển thị\u5b8f\u5927\u573a\u9762。phía trướchồ sơ cao\u5149\u8ba9bức tranhtươi sáng\u58ee\u89c2，\u9002\u5f53\u52a0\u5165Cảnh quay halovà\u5c18\u57c3hạt\u589e\u52a0Cảm giác điện ảnh。\u6218\u6597\u573a\u9762\u53ef\u5207\u6362vaicầm tay\u589e\u52a0vội vàng\u51fb\u529b。',
    referenceFilms: ['\u6307\u73af\u738b', '\u89d2\u6597\u58eb', '\u52c7\u6562của\u5fc3', '\u5929\u56fd\u738b\u671d'],
  },
  {
    id: 'intimate-drama',
    name: '\u4eb2\u5bc6\u5267\u60c5',
    nameEn: 'Intimate Drama',
    category: 'cinematic',
    description: 'tự nhiênánh sáng bên、\u6696Nhiệt độ màu、\u6d45độ sâu trường ảnh、chân máytĩnh、\u5b89\u9759bên trong\u655b、\u805a\u7126nhân vậtcảm xúc',
    emoji: '🫂',
    defaultLighting: { style: 'natural', direction: 'side', colorTemperature: 'warm' },
    defaultFocus: { depthOfField: 'shallow', focusTransition: 'rack-between' },
    defaultRig: { cameraRig: 'tripod', movementSpeed: 'very-slow' },
    defaultAtmosphere: { effects: [], intensity: 'subtle' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '85mm',
    promptGuidance: '\u4eb2\u5bc6\u5267\u60c5sử dụngtĩnhCảnh quayvà\u6d45độ sâu trường ảnh\u628a\u89c2\u4f17\u62c9\u5165Nhân vậtcủabên trong\u5fc3\u4e16\u754c。tự nhiênánh sáng bên\u521b\u9020đối mặtcủa\u660e\u6697\u5c42lần，\u6696Nhiệt độ màu\u4f20\u9012cảm xúc\u6e29\u5ea6。\u6444\u5f71\u673a\u51e0\u4e4e\u4e0d\u52a8，\u8ba9\u6f14\u5458của\u5faeBiểu cảm\u6210chobức tranhTất cảtiêu điểm。',
    referenceFilms: ['bờ biểncủa\u66fc\u5f7b\u65af\u7279', '\u5a5a\u59fbcâu chuyện', '\u82b1\u6837năm\u534e'],
  },
  {
    id: 'romantic-film',
    name: 'lãng mạntình yêu',
    nameEn: 'Romantic Film',
    category: 'cinematic',
    description: 'Đèn nềngiờ vàng、\u6781\u6d45độ sâu trường ảnh、SteadicamMượt theo、\u4e01\u8fbe\u5c14\u5149\u6548、\u68a6\u5e7bMềm mại',
    emoji: '💕',
    defaultLighting: { style: 'natural', direction: 'back', colorTemperature: 'golden-hour' },
    defaultFocus: { depthOfField: 'ultra-shallow', focusTransition: 'pull-focus' },
    defaultRig: { cameraRig: 'steadicam', movementSpeed: 'slow' },
    defaultAtmosphere: { effects: ['light-rays', 'cherry-blossom'], intensity: 'subtle' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '85mm',
    defaultTechnique: 'bokeh',
    promptGuidance: 'lãng mạn\u611fcủacốt lõi\u662fĐèn nền——giờ vàngcủa\u6696\u8272Đèn nền\u8ba9nhân vật\u8f6e\u5ed3\u53d1\u5149。\u6781\u6d45độ sâu trường ảnh\u628a\u4e16\u754c\u865a\u5316\u6210\u5149\u6591，Steadicam\u8f7b\u67d4\u8ddf\u968fnhân vật，\u4eff\u4f5b\u5728\u68a6trongđược rồiđi。\u5076\u5c14\u98d8\u843dcủa\u82b1\u74e3hoặc\u5149\u675fchobức tranh\u589e\u6dfb\u8bd7\u610f。',
    referenceFilms: ['\u604b\u604b\u7b14\u8bb0\u672c', '\u7231\u4e50\u4e4b\u57ce', '\u50b2chậmvới\u504f\u89c1', '\u60c5\u4e66'],
  },
];

// ---------- Phim tài liệu\u7c7b (documentary) ----------

const DOCUMENTARY_PROFILES: CinematographyProfile[] = [
  {
    id: 'documentary-raw',
    name: 'Phim tài liệucầm tay',
    nameEn: 'Raw Documentary',
    category: 'documentary',
    description: 'cầm tayCảm giác thở、ánh sáng tự nhiên、trung bìnhđộ sâu trường ảnh、ánh sáng phía trước、không có\u4fee\u9970、\u771f\u5b9e\u7c97\u7c9d',
    emoji: '📹',
    defaultLighting: { style: 'natural', direction: 'front', colorTemperature: 'neutral' },
    defaultFocus: { depthOfField: 'medium', focusTransition: 'pull-focus' },
    defaultRig: { cameraRig: 'handheld', movementSpeed: 'normal' },
    defaultAtmosphere: { effects: [], intensity: 'subtle' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '35mm',
    promptGuidance: 'Phim tài liệuPhong cách\u8ffd\u6c42「\u5728\u573a\u611f」——cầm tay\u6444\u5f71củaLắc nhẹ\u8ba9\u89c2\u4f17\u611f\u89c9\u8eab\u4e34\u5176\u5883。\u5b8c\u5168sử dụngánh sáng tự nhiên，\u4e0d\u505a\u4efb\u4f55\u4eba\u5de5\u4fee\u9970。theo dõi trọng tâm\u8ddf\u968fnhân vậtcác môn thể thao，\u5141\u8bb8\u5076\u5c14củatiêu điểm\u504f\u79fb，\u8fd9\u79cd\u4e0d\u5b8c\u7f8e\u53cd\u800c\u589e\u52a0\u771f\u5b9e\u611f。',
    referenceFilms: ['\u4eba\u751f\u679c\u5b9e', 'biển\u8c5a\u6e7e', '\u5f92tay\u6500\u5ca9'],
  },
  {
    id: 'news-report',
    name: 'Tin tức và phim tài liệu',
    nameEn: 'News Report',
    category: 'documentary',
    description: 'vai、hồ sơ cao\u5149、\u6df1độ sâu trường ảnh、trong\u6027Nhiệt độ màu、thông tinƯu tiên、bức tranh rõ ràng\u9510\u5229',
    emoji: '📡',
    defaultLighting: { style: 'high-key', direction: 'front', colorTemperature: 'neutral' },
    defaultFocus: { depthOfField: 'deep', focusTransition: 'none' },
    defaultRig: { cameraRig: 'shoulder', movementSpeed: 'normal' },
    defaultAtmosphere: { effects: [], intensity: 'subtle' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '24mm',
    promptGuidance: 'Tin tức và phim tài liệu\u4ee5thông tin\u4f20\u8fbechoKhông.mộtƯu tiên——\u6df1độ sâu trường ảnh\u786e\u4fddbức tranhTất cảphần tử\u6e05\u6670\u53ef\u8fa8，hồ sơ cao\u5149\u6d88\u9664Bóng\u8ba9Chi tiết\u5b8c\u6574\u5448\u73b0。vai\u6444\u5f71giữ\u7075\u6d3b\u8ddf\u8e2a，\u4f46\u6bd4cầm tay\u66f4\u7a33\u5b9a。bức tranhthành phần\u8bb2\u7a76thông tin\u5c42lần，quan trọngnhân vậthoặcSự kiện\u59cb\u7ec8\u5728tập trung thị giác。',
    referenceFilms: ['\u805a\u7126', '\u603b\u7edf\u73ed\u5e95', '\u534e\u76db\u987f\u90ae\u62a5'],
  },
];

// ---------- Phong cách\u5316 (stylized) ----------

const STYLIZED_PROFILES: CinematographyProfile[] = [
  {
    id: 'cyberpunk-neon',
    name: 'cyberpunk',
    nameEn: 'Cyberpunk Neon',
    category: 'stylized',
    description: 'đèn neonđèn、ánh sáng vành、MixNhiệt độ màu、\u6d45độ sâu trường ảnh、\u7a33\u5b9a\u5668\u6ed1\u52a8、sương mù\u5f25\u6f2b',
    emoji: '🌃',
    defaultLighting: { style: 'neon', direction: 'rim', colorTemperature: 'mixed' },
    defaultFocus: { depthOfField: 'shallow', focusTransition: 'rack-to-bg' },
    defaultRig: { cameraRig: 'steadicam', movementSpeed: 'slow' },
    defaultAtmosphere: { effects: ['haze', 'lens-flare'], intensity: 'moderate' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'low-angle',
    defaultFocalLength: '35mm',
    defaultTechnique: 'reflection',
    promptGuidance: 'cyberpunkcủa\u89c6\u89c9ngôn ngữ\u662f「\u51b7\u6696xung đột」——đèn neon\u7d2b\u7ea2với\u51b0\u84dd\u540c\u6846，ánh sáng vành\u628anhân vậttừ\u6697\u8272Nềntrong\u5265\u79bb。\u6d45độ sâu trường ảnh\u8ba9đèn neon\u706fbiến thành\u8ff7\u5e7b\u5149\u6591，sương mùchoánh sáng\u589e\u52a0\u4f53\u79ef\u611f。Cảnh quaychậm\u901f\u6ed1\u52a8\u7a7f\u8fc7mưađêmđường phố，\u8425\u9020tương lai\u90fd\u5e02của\u758f\u79bb\u611f。',
    referenceFilms: ['\u94f6\u7ffc\u6740tay2049', '\u653b\u58f3\u673a\u52a8\u961f', '\u9ed1\u5ba2\u5e1d\u56fd', '\u521b\u6218\u7eaa'],
  },
  {
    id: 'wuxia-classic',
    name: '\u53e4\u5178võ thuật',
    nameEn: 'Classic Wuxia',
    category: 'stylized',
    description: 'tự nhiênánh sáng bên、\u6696Nhiệt độ màu、Trung cảnh\u6df1、cánh tay rockernâng、sương mù\u98d8\u6e3a、\u53e4\u97f5\u60a0\u7136',
    emoji: '🗡️',
    defaultLighting: { style: 'natural', direction: 'side', colorTemperature: 'warm' },
    defaultFocus: { depthOfField: 'medium', focusTransition: 'rack-between' },
    defaultRig: { cameraRig: 'crane', movementSpeed: 'slow' },
    defaultAtmosphere: { effects: ['mist', 'falling-leaves'], intensity: 'moderate' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '50mm',
    promptGuidance: '\u53e4\u5178võ thuật\u8ffd\u6c42「\u610f\u5883」——núi\u95f4sương mùvớilá rụng\u8425\u9020giang hồcủa\u82cd\u832b\u611f。cánh tay rockertừ\u9ad8\u5904\u7f13\u7f13\u964d\u81f3nhân vật，Chẳng hạn nhưnhìn ra\u5929\u4e0bcủaGóc nhìn。tự nhiênánh sáng bên\u6a21\u62df\u900f\u8fc7rừng trecủa\u6591\u9a73Ánh sáng，\u6696Nhiệt độ màu\u547c\u5e94\u6c34\u58a8\u4e39\u9752。chiến đấu\u573a\u9762\u53ef\u52a0\u5165Chậm Hành động，\u5c55\u73b0\u6b66\u672f\u4e4b\u7f8e。',
    referenceFilms: ['\u5367\u864e\u85cf\u9f99', '\u82f1\u96c4', '\u523a\u5ba2\u8042\u9690\u5a18', 'một\u4ee3\u5b97phép chia'],
  },
  {
    id: 'horror-thriller',
    name: 'kinh dị\u60ca\u609a',
    nameEn: 'Horror Thriller',
    category: 'stylized',
    description: 'cấu hình thấp\u5e03\u5149、Ánh sáng phía dưới\u4e0d\u5b89\u611f、lạnh Tông màu、\u6d45độ sâu trường ảnh、cầm tay\u98a4\u6296、Sương mù dày đặc\u906e\u853d',
    emoji: '👻',
    defaultLighting: { style: 'low-key', direction: 'bottom', colorTemperature: 'cool' },
    defaultFocus: { depthOfField: 'shallow', focusTransition: 'rack-to-bg' },
    defaultRig: { cameraRig: 'handheld', movementSpeed: 'very-slow' },
    defaultAtmosphere: { effects: ['fog', 'haze'], intensity: 'heavy' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'low-angle',
    defaultFocalLength: '24mm',
    promptGuidance: 'kinh dị\u7247của\u6444\u5f71\u539f\u5219\u662f「\u9690\u85cf\u6bd4hiển thị\u66f4\u53ef\u6015」——\u6d45độ sâu trường ảnh\u8ba9Nền\u6a21\u7cca\u6210Không rõcủa\u5a01\u80c1，Sương mù dày đặc\u906e\u853d\u89c6\u91ce\u5236\u9020\u4e0d\u5b89。Ánh sáng phía dưới\u8ba9đối mặt\u51fa\u73b0không tự nhiêncủaBóng，cầm tayCực kỳ chậm\u79fb\u52a8\u5236\u9020\u6f5cđược rồi\u611f。chìa khóa\u65f6\u523b\u7a81\u7136Bắn nhanh，\u6253\u7834\u4e4b\u524dcủachậm\u8282\u594f。',
    referenceFilms: ['\u95ea\u7075', '\u9057\u4f20\u5384\u8fd0', '\u62db\u9b42', '\u5348đêm\u51f6\u94c3'],
  },
  {
    id: 'music-video',
    name: 'MVPhong cách',
    nameEn: 'Music Video',
    category: 'stylized',
    description: 'đèn neonĐèn nền、MixNhiệt độ màu、\u6781\u6d45độ sâu trường ảnh、Steadicambao quanh、\u5149hạt\u98de\u821e、\u89c6\u89c9vội vàng\u51fb\u529b\u5f3a',
    emoji: '🎵',
    defaultLighting: { style: 'neon', direction: 'back', colorTemperature: 'mixed' },
    defaultFocus: { depthOfField: 'ultra-shallow', focusTransition: 'pull-focus' },
    defaultRig: { cameraRig: 'steadicam', movementSpeed: 'fast' },
    defaultAtmosphere: { effects: ['particles', 'lens-flare'], intensity: 'heavy' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'low-angle',
    defaultFocalLength: '35mm',
    defaultTechnique: 'bokeh',
    promptGuidance: 'MV\u8ffd\u6c42\u6781\u81f4\u89c6\u89c9vội vàng\u51fb——\u6bcfmột\u5e27\u90fd\u8981\u50cfbiển\u62a5。\u6781\u6d45độ sâu trường ảnh\u628amột\u5207\u865a\u5316\u6210năm\u5f69\u5149\u6591，đèn neonĐèn nền\u52fe\u52d2nhân vật\u8f6e\u5ed3。Nhanh\u901fSteadicambao quanh\u62cd\u6444，\u914d\u5408\u9891truyền thốngcủatốc độthay đổi（chậm\u653evớiNhanh\u8fdb\u4ea4\u66ff）。\u5927\u91cfsử dụng\u5149hạtvàCảnh quay halo\u589e\u52a0\u68a6\u5e7b\u611f。',
    referenceFilms: ['\u7231\u4e50\u4e4b\u57ceMV\u6bb5\u843d', 'Beyoncé - Lemonade', 'The Weeknd - Blinding Lights'],
  },
];

// ---------- Loại\u7247 (genre) ----------

const GENRE_PROFILES: CinematographyProfile[] = [
  {
    id: 'family-warmth',
    name: 'gia đình\u6e29\u60c5',
    nameEn: 'Family Warmth',
    category: 'genre',
    description: 'tự nhiênánh sáng phía trước、\u6696Nhiệt độ màu3200K、trung bìnhđộ sâu trường ảnh、chân máy\u7a33\u5b9a、ấm ápChẳng hạn như\u9633\u5149\u6d12\u5165phòng khách',
    emoji: '🏠',
    defaultLighting: { style: 'natural', direction: 'front', colorTemperature: 'warm' },
    defaultFocus: { depthOfField: 'medium', focusTransition: 'rack-between' },
    defaultRig: { cameraRig: 'tripod', movementSpeed: 'very-slow' },
    defaultAtmosphere: { effects: ['light-rays'], intensity: 'subtle' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '50mm',
    promptGuidance: 'gia đình\u5267của\u6444\u5f71\u8981\u50cfmộtmột\u5b89\u9759của\u89c2\u5bdf\u8005——chân máy\u7a33\u5b9a\u4e0d\u5e72\u6270，\u6696\u8272\u5149Chẳng hạn như\u5348\u540e\u9633\u5149\u6d12\u5165các cửa sổ。trung bìnhđộ sâu trường ảnh\u8ba9gia đình\u6210\u5458\u90fd\u5728bức tranhtrong\u6e05\u6670\u53ef\u89c1，\u4f20\u9012「\u56e2\u805a」\u611f。\u5076\u5c14của\u4e01\u8fbe\u5c14ánh sángtừcác cửa sổ\u5c04\u5165，cho\u5e73\u51e1củagia đìnhCảnh\u589e\u6dfbmột\u4e1d\u8bd7\u610f。',
    referenceFilms: ['\u5c0f\u5077gia đình', '\u6b65\u5c65\u4e0d\u505c', '\u8bf7\u56de\u7b541988', '\u90fd\u633a\u597d'],
  },
  {
    id: 'action-intense',
    name: 'Hành động\u6fc0\u70c8',
    nameEn: 'Intense Action',
    category: 'genre',
    description: 'hồ sơ caoánh sáng bên、trong\u6027Nhiệt độ màu、Trung cảnh\u6df1、vaiNhanh\u901fTheo dõi cú đánh、bụi bặm\u98de\u626c',
    emoji: '💥',
    defaultLighting: { style: 'high-key', direction: 'side', colorTemperature: 'neutral' },
    defaultFocus: { depthOfField: 'medium', focusTransition: 'pull-focus' },
    defaultRig: { cameraRig: 'shoulder', movementSpeed: 'fast' },
    defaultAtmosphere: { effects: ['dust', 'sparks'], intensity: 'moderate' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '24mm',
    defaultTechnique: 'high-speed',
    promptGuidance: 'Hành động\u620fcủa\u6444\u5f71\u8ffd\u6c42「\u52a8\u80fd\u4f20\u9012」——vaiNhanh\u901fTheo dõi cú đánh\u8ba9\u89c2\u4f17\u611f\u53d7vội vàng\u51fb\u529b，ánh sáng bên\u5f3a\u5316\u808c\u8089\u8f6e\u5ed3vàHành động\u7ebf\u6761。Trung cảnh\u6df1\u4fdd\u8bc1Chúa ơi\u4f53\u6e05\u6670\u4f46NềnCó\u9002\u5ea6\u865a\u5316。chìa khóaHành động\u77ac\u95f4（\u51fa\u62f3、\u7206\u70b8）\u53efsử dụngchậm\u653e0.5x\u7a81\u51fa\u529b\u91cf\u611f，\u968f\u540e\u7acb\u523b\u6062\u590dbình thườngtốc độ。bụi bặmvàtia lửa\u589e\u52a0\u7269\u7406\u78b0\u649ecủa\u771f\u5b9e\u611f。',
    referenceFilms: ['\u75af\u72c2của\u9ea6\u514b\u65af', '\u8c0d\u5f71\u91cd\u91cd', '\u7a81\u88ad', '\u789ftrong\u8c0d'],
  },
  {
    id: 'suspense-mystery',
    name: 'Hồi hộplý luận',
    nameEn: 'Suspense Mystery',
    category: 'genre',
    description: 'cấu hình thấpánh sáng bên、lạnh Tông màu、\u6d45độ sâu trường ảnh、Quỹ đạo\u7f13\u63a8、sương mù\u7b3c\u7f69、\u9690\u85cfvới\u63ed\u793a',
    emoji: '🔍',
    defaultLighting: { style: 'low-key', direction: 'side', colorTemperature: 'cool' },
    defaultFocus: { depthOfField: 'shallow', focusTransition: 'rack-to-fg' },
    defaultRig: { cameraRig: 'dolly', movementSpeed: 'very-slow' },
    defaultAtmosphere: { effects: ['mist'], intensity: 'subtle' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '50mm',
    promptGuidance: 'Hồi hộp\u7247của\u6444\u5f71cốt lõi\u662f「\u63a7\u5236thông tin\u63ed\u793a」——\u6d45độ sâu trường ảnh\u9009\u62e9\u6027\u5730\u8ba9\u89c2\u4f17\u53ea\u770bĐếngiám đốc\u60f3\u8ba9\u4ed6\u4eec\u770bĐếncủa。Quỹ đạoCực kỳ chậmtiến lên\u5236\u9020\u538b\u8feb\u611f，cấu hình thấpánh sáng bên\u8ba9bức tranh\u603bCómột\u534a\u9690\u85cf\u5728Bóngtrong。\u8f6c\u7126\u662fquan trọng\u53d9\u4e8btay\u6cd5，từ\u524d\u666f\u7ebf\u7d22Tập trung vào Nềnnghi ngờ，hoặc\u53cd\u5411Thao tác。sương mùchobức tranh\u589e\u52a0\u6726\u80e7\u611f，\u6697\u793asự thậtcủa\u4e0d\u786e\u5b9a\u6027。',
    referenceFilms: ['\u6d88\u5931của\u7231\u4eba', 'bảy\u5b97\u7f6a', '\u6740\u4ebaký ức', 'mườiHaitức giận\u6c49'],
  },
];

// ---------- thời đạiPhong cách (era) ----------

const ERA_PROFILES: CinematographyProfile[] = [
  {
    id: 'hk-retro-90s',
    name: '90s\u6e2f\u7247',
    nameEn: '90s Hong Kong',
    category: 'era',
    description: 'đèn neonánh sáng bên、MixNhiệt độ màu、Trung cảnh\u6df1、cầm tay\u6643\u52a8、sương mù\u5f25\u6f2b、\u738bnhà\u536b\u5f0fu sầu',
    emoji: '🌙',
    defaultLighting: { style: 'neon', direction: 'side', colorTemperature: 'mixed' },
    defaultFocus: { depthOfField: 'medium', focusTransition: 'rack-between' },
    defaultRig: { cameraRig: 'handheld', movementSpeed: 'normal' },
    defaultAtmosphere: { effects: ['haze', 'smoke'], intensity: 'moderate' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '35mm',
    promptGuidance: '90thời đại\u6e2f\u7247của\u6444\u5f71DNA\u662f「\u90fd\u5e02đèn neon+cầm tay\u6e38đi」——MixNhiệt độ màucủađèn neon\u706f\u628athành phốđường phố\u67d3\u6210\u7ea2\u84dd\u4ea4\u7ec7của\u68a6\u5883。cầm tay\u6444\u5f71\u5728đám đôngtrongđưa đón，\u5076\u5c14sử dụng\u62bd\u5e27hoặc\u964d\u683c\u5236\u9020\u738bnhà\u536b\u5f0fcủa\u865a\u5f71\u6548\u679c。sương mù\u7b3c\u7f69củađường phố，\u6bcfmột\u8def\u4eba\u90fd\u50cfCócâu chuyện。ánh sáng bên\u52fe\u52d2\u51fanhân vậtu sầucủa\u8f6e\u5ed3。',
    referenceFilms: ['\u91cd\u5e86rừng', '\u5815\u843d\u5929\u4f7f', 'không có\u95f4\u9053', '\u82f1\u96c4\u672c\u8272'],
  },
  {
    id: 'golden-age-hollywood',
    name: '\u597d\u83b1\u575e\u9ec4\u91d1thời đại',
    nameEn: 'Golden Age Hollywood',
    category: 'era',
    description: 'hồ sơ caoChiếu sáng ba điểm、\u6696Nhiệt độ màu、\u6df1độ sâu trường ảnh、Quỹ đạo\u4f18\u96c5các môn thể thao、\u5149\u8292bốn\u5c04、\u7aef\u5e84\u534e\u4e3d',
    emoji: '⭐',
    defaultLighting: { style: 'high-key', direction: 'three-point', colorTemperature: 'warm' },
    defaultFocus: { depthOfField: 'deep', focusTransition: 'none' },
    defaultRig: { cameraRig: 'dolly', movementSpeed: 'slow' },
    defaultAtmosphere: { effects: ['light-rays'], intensity: 'subtle' },
    defaultSpeed: { playbackSpeed: 'normal' },
    defaultAngle: 'eye-level',
    defaultFocalLength: '50mm',
    promptGuidance: '\u597d\u83b1\u575e\u9ec4\u91d1thời đạtôi là\u6444\u5f71\u8ffd\u6c42「\u5b8c\u7f8e」——Chiếu sáng ba điểm\u6d88\u9664một\u5207\u4e0d\u7f8ecủaBóng，\u8ba9\u660e\u661f\u5bb9\u5149\u7115\u53d1。\u6df1độ sâu trường ảnhvà\u7cbe\u5fc3thành phần\u8ba9\u6bcfmột\u5e27\u90fd\u50cf\u6cb9\u753b，Quỹ đạochậm\u4f18\u96c5\u79fb\u52a8Chẳng hạn như\u534e\u5c14\u5179。\u6696Nhiệt độ màu\u8d4b\u4e88bức tranh\u6000\u65e7của\u91d1\u8272\u5149\u8292。một\u5207\u90fd\u8981\u7aef\u5e84、\u534e\u4e3d、không có\u53ef\u6311\u5254。',
    referenceFilms: ['\u5361\u8428\u5e03\u5170\u5361', '\u516c\u6c11\u51ef\u6069', 'hoàng hôn\u5927\u9053', '\u4e71\u4e16\u4f73\u4eba'],
  },
];

// ==================== Xuất ====================

/** Tất cảNhiếp ảnh Phong cách\u6863\u6848\u9884\u8bbe */
export const CINEMATOGRAPHY_PROFILES: readonly CinematographyProfile[] = [
  ...CINEMATIC_PROFILES,
  ...DOCUMENTARY_PROFILES,
  ...STYLIZED_PROFILES,
  ...GENRE_PROFILES,
  ...ERA_PROFILES,
] as const;

/** \u6309\u5206\u7c7b\u7ec4\u7ec7 */
export const CINEMATOGRAPHY_PROFILE_CATEGORIES: {
  id: CinematographyCategory;
  name: string;
  emoji: string;
  profiles: readonly CinematographyProfile[];
}[] = [
  { id: 'cinematic', name: '\u7535\u5f71\u7c7b', emoji: '🎬', profiles: CINEMATIC_PROFILES },
  { id: 'documentary', name: 'Phim tài liệu\u7c7b', emoji: '📹', profiles: DOCUMENTARY_PROFILES },
  { id: 'stylized', name: 'Phong cách\u5316', emoji: '🎨', profiles: STYLIZED_PROFILES },
  { id: 'genre', name: 'Loại\u7247', emoji: '🎭', profiles: GENRE_PROFILES },
  { id: 'era', name: 'thời đạiPhong cách', emoji: '📅', profiles: ERA_PROFILES },
];

/** \u6839\u636e ID \u83b7\u53d6\u6444\u5f71\u6863\u6848 */
export function getCinematographyProfile(profileId: string): CinematographyProfile | undefined {
  return CINEMATOGRAPHY_PROFILES.find(p => p.id === profileId);
}

/** Mặc định\u6444\u5f71\u6863\u6848 ID */
export const DEFAULT_CINEMATOGRAPHY_PROFILE_ID = 'classic-cinematic';

/**
 * Tạo AI \u6821\u51c6sử dụngcủa\u6444\u5f71\u6863\u6848\u6307\u5bfc\u6587\u672c
 * Lưu ý\u5165Đến system prompt trong，\u4f5cchoTrường điều khiển bắn súngcủaMặc định\u57fa\u51c6
 */
export function buildCinematographyGuidance(profileId: string): string {
  const profile = getCinematographyProfile(profileId);
  if (!profile) return '';

  const { defaultLighting, defaultFocus, defaultRig, defaultAtmosphere, defaultSpeed } = profile;

  const lines = [
    `【🎬 Nhiếp ảnh Phong cách\u6863\u6848 — ${profile.name} (${profile.nameEn})】`,
    `${profile.description}`,
    '',
    '**Mặc định\u6444\u5f71\u57fa\u51c6（\u9010\u955c\u53ef\u6839\u636e\u5267\u60c5\u9700\u8981\u504f\u79bb，\u4f46\u987bCó\u7406\u7531）：**',
    `đèn：${profile.defaultLighting.style} Phong cách + ${profile.defaultLighting.direction} \u65b9\u5411 + ${profile.defaultLighting.colorTemperature} Nhiệt độ màu`,
    `tiêu điểm：${defaultFocus.depthOfField} độ sâu trường ảnh + ${defaultFocus.focusTransition} \u8f6c\u7126`,
    `Thiết bị：${defaultRig.cameraRig} + ${defaultRig.movementSpeed} tốc độ`,
    defaultAtmosphere.effects.length > 0
      ? `bầu không khí：${defaultAtmosphere.effects.join('+')} (${defaultAtmosphere.intensity})`
      : 'bầu không khí：không có\u7279\u6b8aHiệu ứng khí quyển',
    `tốc độ：${defaultSpeed.playbackSpeed}`,
    profile.defaultAngle ? `góc chụp：${profile.defaultAngle}` : '',
    profile.defaultFocalLength ? `Cảtiêu cự nh quay：${profile.defaultFocalLength}` : '',
    profile.defaultTechnique ? `kỹ thuật chụp ảnh：${profile.defaultTechnique}` : '',
    '',
    `**đạo diễn hình ảnh：** ${profile.promptGuidance}`,
    '',
    `**Tài liệu tham khảo\u5f71\u7247：** ${profile.referenceFilms.join('、')}`,
    '',
    '⚠️ \u4ee5\u4e0a\u662f\u672cDự áncủa\u6444\u5f71ngôn ngữ\u57fa\u51c6。Mỗi tiến sĩân cảnhTrường điều khiển bắn súng\u5e94\u4ee5\u6b64choMặc địgiá trị nh，\u4f46Chẳng hạn như\u679c\u5267\u60c5củachức năng tường thuật（Chẳng hạn nhưđỉnh điểm、bước ngoặt）\u9700\u8981\u504f\u79bb\u57fa\u51c6，\u53ef\u4ee5sự tự do\u8c03\u6574——chìa khóa\u662f\u8981Có\u53d9\u4e8b\u7406\u7531，\u4e0d\u8981Ngẫu nhiênthay đổi。',
  ].filter(Boolean);

  return lines.join('\n');
}
