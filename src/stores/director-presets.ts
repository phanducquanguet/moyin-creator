// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Director Presets — Các hằng số mặc định của bảng điều khiển
 *
 * T được trích xuất từ ​​giám đốc-store.tsất cảCác hằng số mặc định và dẫn xuất Loại。
 * Dành cho phân cảnh.tsx、split-scene-card.tsx、nhắc-builder.ts và các mô-đun khác Nhập。
 */

// ==================== Cỡ cảnhDefault (Kích thước ảnh) ====================

export const SHOT_SIZE_PRESETS = [
  { id: 'ws', label: 'Toàn cảnh', labelEn: 'Wide Shot', abbr: 'WS', promptToken: 'wide shot, establishing shot, distant view' },
  { id: 'ls', label: 'Toàn cảnh', labelEn: 'Long Shot', abbr: 'LS', promptToken: 'long shot, full body shot' },
  { id: 'mls', label: 'giữaTớiàn cảnh', labelEn: 'Medium Long Shot', abbr: 'MLS', promptToken: 'medium long shot, knee shot' },
  { id: 'ms', label: 'Trung cảnh', labelEn: 'Medium Shot', abbr: 'MS', promptToken: 'medium shot, waist shot' },
  { id: 'mcu', label: 'Trung bình Cận cảnh', labelEn: 'Medium Close-Up', abbr: 'MCU', promptToken: 'medium close-up, chest shot' },
  { id: 'cu', label: 'Cận cảnh', labelEn: 'Close-Up', abbr: 'CU', promptToken: 'close-up, face shot' },
  { id: 'ecu', label: 'Đặc tả', labelEn: 'Extreme Close-Up', abbr: 'ECU', promptToken: 'extreme close-up, detail shot' },
  { id: 'pov', label: 'chủ quan Cảnh quay', labelEn: 'POV Shot', abbr: 'POV', promptToken: 'point of view shot, first person perspective' },
] as const;

export type ShotSizeType = typeof SHOT_SIZE_PRESETS[number]['id'];

// ==================== Thời lượngDefault (Thời lượng) ====================

export const DURATION_PRESETS = [
  { id: 4, label: '4 giây', value: 4 },
  { id: 5, label: '5 giây', value: 5 },
  { id: 6, label: '6 giây', value: 6 },
  { id: 7, label: '7 giây', value: 7 },
  { id: 8, label: '8 giây', value: 8 },
  { id: 9, label: '9 giây', value: 9 },
  { id: 10, label: '10 giây', value: 10 },
  { id: 11, label: '11 giây', value: 11 },
  { id: 12, label: '12 giây', value: 12 },
] as const;

// Thời lượngLoạtôi: 4-12 giây
export type DurationType = number;

// ==================== Cài đặt trước thẻ hiệu ứng âm thanh (Hiệu ứng âm thanh) ====================

export const SOUND_EFFECT_PRESETS = {
  // môi trường tự nhiên
  nature: [
    { id: 'wind', label: 'Âm thanh của gió', promptToken: 'wind blowing sound' },
    { id: 'rain', label: 'tiếng mưa', promptToken: 'rain falling sound' },
    { id: 'thunder', label: 'sấm sét', promptToken: 'thunder rumbling' },
    { id: 'birds', label: 'Tiếng chim hót', promptToken: 'birds chirping' },
    { id: 'water', label: 'nước chảy', promptToken: 'water flowing sound' },
    { id: 'waves', label: 'sóng biển', promptToken: 'ocean waves crashing' },
  ],
  // Nhân vật Hành động
  action: [
    { id: 'footsteps', label: 'bước chân', promptToken: 'footsteps sound' },
    { id: 'breathing', label: 'tiếng thở', promptToken: 'heavy breathing' },
    { id: 'heartbeat', label: 'nhịp tim', promptToken: 'heartbeat pounding' },
    { id: 'fighting', label: 'âm thanh chiến đấu', promptToken: 'fighting impact sounds' },
    { id: 'running', label: 'âm thanh chạy', promptToken: 'running footsteps' },
  ],
  // Hiệu ứng khí quyển
  atmosphere: [
    { id: 'suspense', label: 'Hồi hộp', promptToken: 'suspenseful ambient sound' },
    { id: 'dramatic', label: 'kịch tính', promptToken: 'dramatic sound effect' },
    { id: 'peaceful', label: 'bình tĩnh', promptToken: 'peaceful ambient sound' },
    { id: 'tense', label: 'lo lắng', promptToken: 'tense atmosphere sound' },
    { id: 'epic', label: 'sử thi', promptToken: 'epic cinematic sound' },
  ],
  // môi trường đô thị
  urban: [
    { id: 'traffic', label: 'luồng giao thông', promptToken: 'traffic noise' },
    { id: 'crowd', label: 'đám đông', promptToken: 'crowd murmuring' },
    { id: 'siren', label: 'còi báo động', promptToken: 'siren wailing' },
    { id: 'horn', label: 'loa', promptToken: 'car horn honking' },
  ],
} as const;

export type SoundEffectTag = 
  | typeof SOUND_EFFECT_PRESETS.nature[number]['id']
  | typeof SOUND_EFFECT_PRESETS.action[number]['id']
  | typeof SOUND_EFFECT_PRESETS.atmosphere[number]['id']
  | typeof SOUND_EFFECT_PRESETS.urban[number]['id'];

// ==================== Cài đặt trước điều khiển chụp（Mỗi tiến sĩân cảnh độc lập） ====================

// Chiếu sángPhong cáchDefault (Gaffer)
export const LIGHTING_STYLE_PRESETS = [
  { id: 'high-key' as const, label: 'Cấu hình cao và tươi sáng', labelEn: 'High-Key', emoji: '☀️', promptToken: 'high-key lighting, bright and even,' },
  { id: 'low-key' as const, label: 'Thấp và tối', labelEn: 'Low-Key', emoji: '🌑', promptToken: 'low-key lighting, dramatic shadows, film noir,' },
  { id: 'silhouette' as const, label: 'hình bóng', labelEn: 'Silhouette', emoji: '🌅', promptToken: 'silhouette, backlit figure against bright background,' },
  { id: 'chiaroscuro' as const, label: 'chiaroscuro', labelEn: 'Chiaroscuro', emoji: '🎨', promptToken: 'chiaroscuro lighting, Rembrandt style, strong contrast,' },
  { id: 'natural' as const, label: 'ánh sáng tự nhiên', labelEn: 'Natural', emoji: '🌤️', promptToken: 'natural lighting,' },
  { id: 'neon' as const, label: 'đèn neon', labelEn: 'Neon', emoji: '💜', promptToken: 'neon lighting, vibrant colored lights,' },
  { id: 'candlelight' as const, label: 'dưới ánh nến', labelEn: 'Candlelight', emoji: '🕯️', promptToken: 'candlelight, warm dim golden glow,' },
  { id: 'moonlight' as const, label: 'ánh trăng', labelEn: 'Moonlight', emoji: '🌙', promptToken: 'moonlight, soft cold blue illumination,' },
] as const;

// Đặt trước hướng ánh sáng
export const LIGHTING_DIRECTION_PRESETS = [
  { id: 'front' as const, label: 'ánh sáng phía trước', labelEn: 'Front', emoji: '⬆️', promptToken: 'front lighting,' },
  { id: 'side' as const, label: 'ánh sáng bên', labelEn: 'Side', emoji: '➡️', promptToken: 'dramatic side lighting,' },
  { id: 'back' as const, label: 'Đèn nền', labelEn: 'Back', emoji: '⬇️', promptToken: 'backlit,' },
  { id: 'top' as const, label: 'ánh sáng hàng đầu', labelEn: 'Top', emoji: '🔽', promptToken: 'overhead top lighting,' },
  { id: 'bottom' as const, label: 'Ánh sáng phía dưới', labelEn: 'Bottom', emoji: '🔼', promptToken: 'underlighting, eerie,' },
  { id: 'rim' as const, label: 'ánh sáng vành', labelEn: 'Rim', emoji: '💫', promptToken: 'rim light, edge glow separating subject from background,' },
  { id: 'three-point' as const, label: 'Chiếu sáng ba điểm', labelEn: 'Three-Point', emoji: '🔺', promptToken: 'three-point lighting setup,' },
] as const;

// Nhiệt độ màuMặc định
export const COLOR_TEMPERATURE_PRESETS = [
  { id: 'warm' as const, label: 'Màu ấm 3200K', labelEn: 'Warm', emoji: '🟠', promptToken: 'warm color temperature 3200K,' },
  { id: 'neutral' as const, label: 'Trung tính 5500K', labelEn: 'Neutral', emoji: '⚪', promptToken: 'neutral daylight 5500K,' },
  { id: 'cool' as const, label: 'Màu sắc mát mẻ 7000K', labelEn: 'Cool', emoji: '🔵', promptToken: 'cool blue color temperature,' },
  { id: 'golden-hour' as const, label: 'giờ vàng', labelEn: 'Golden Hour', emoji: '🌇', promptToken: 'golden hour warm sunlight,' },
  { id: 'blue-hour' as const, label: 'giờ nhạc blues', labelEn: 'Blue Hour', emoji: '🌆', promptToken: 'blue hour twilight tones,' },
  { id: 'mixed' as const, label: 'MixNhiệt độ màu', labelEn: 'Mixed', emoji: '🎭', promptToken: 'mixed warm and cool lighting,' },
] as const;

// Cài đặt trước độ sâu trường ảnh (Kéo lấy nét)
export const DEPTH_OF_FIELD_PRESETS = [
  { id: 'ultra-shallow' as const, label: 'rất nông cạn/1.4', labelEn: 'Ultra Shallow', emoji: '🔍', promptToken: 'extremely shallow depth of field, f/1.4, dreamy bokeh,' },
  { id: 'shallow' as const, label: 'Độ sâu trường ảnh nông f/2.8', labelEn: 'Shallow', emoji: '👤', promptToken: 'shallow depth of field, soft background bokeh,' },
  { id: 'medium' as const, label: 'trung bình/5.6', labelEn: 'Medium', emoji: '👥', promptToken: 'medium depth of field,' },
  { id: 'deep' as const, label: 'độ sâu trường ảnh f/11', labelEn: 'Deep', emoji: '🏔️', promptToken: 'deep focus, everything sharp,' },
  { id: 'split-diopter' as const, label: 'diop', labelEn: 'Split Diopter', emoji: '🪞', promptToken: 'split diopter lens, foreground and background both in focus,' },
] as const;

// Đặt trước tiêu điểm
export const FOCUS_TRANSITION_PRESETS = [
  { id: 'none' as const, label: 'tiêu điểm cố định', labelEn: 'None', promptToken: '' },
  { id: 'rack-to-fg' as const, label: 'tập trung vào tiền cảnh', labelEn: 'Rack to FG', promptToken: 'rack focus to foreground,' },
  { id: 'rack-to-bg' as const, label: 'Tập trung vào Nền', labelEn: 'Rack to BG', promptToken: 'rack focus to background,' },
  { id: 'rack-between' as const, label: 'Tập trung giữa các ký tự', labelEn: 'Rack Between', promptToken: 'rack focus between characters,' },
  { id: 'pull-focus' as const, label: 'theo dõi trọng tâm', labelEn: 'Pull Focus', promptToken: 'pull focus following subject movement,' },
] as const;

// Cài đặt trước thiết bị (Camera Rig)
export const CAMERA_RIG_PRESETS = [
  { id: 'tripod' as const, label: 'chân máy', labelEn: 'Tripod', emoji: '📐', promptToken: 'static tripod shot,' },
  { id: 'handheld' as const, label: 'cầm tay', labelEn: 'Handheld', emoji: '🤲', promptToken: 'handheld camera, slight shake, documentary feel,' },
  { id: 'steadicam' as const, label: 'Steadicam', labelEn: 'Steadicam', emoji: '🎥', promptToken: 'smooth steadicam shot,' },
  { id: 'dolly' as const, label: 'Quỹ đạo', labelEn: 'Dolly', emoji: '🛤️', promptToken: 'dolly tracking shot, smooth rail movement,' },
  { id: 'crane' as const, label: 'cánh tay rocker', labelEn: 'Crane', emoji: '🏗️', promptToken: 'crane shot, sweeping vertical movement,' },
  { id: 'drone' as const, label: 'chụp ảnh trên không', labelEn: 'Drone', emoji: '🚁', promptToken: 'aerial drone shot, bird\'s eye perspective,' },
  { id: 'shoulder' as const, label: 'vai', labelEn: 'Shoulder', emoji: '💪', promptToken: 'shoulder-mounted camera, subtle movement,' },
  { id: 'slider' as const, label: 'Ray trượt', labelEn: 'Slider', emoji: '↔️', promptToken: 'slider shot, short smooth lateral movement,' },
] as const;

// Đặt trước tốc độ di chuyển
export const MOVEMENT_SPEED_PRESETS = [
  { id: 'very-slow' as const, label: 'Cực kỳ chậm', labelEn: 'Very Slow', promptToken: 'very slow camera movement,' },
  { id: 'slow' as const, label: 'chậm', labelEn: 'Slow', promptToken: 'slow camera movement,' },
  { id: 'normal' as const, label: 'bình thường', labelEn: 'Normal', promptToken: '' },
  { id: 'fast' as const, label: 'Nhanh', labelEn: 'Fast', promptToken: 'fast camera movement,' },
  { id: 'very-fast' as const, label: 'Cực kỳ nhanh', labelEn: 'Very Fast', promptToken: 'very fast camera movement,' },
] as const;

// Không khí Xin chàoệu ứngPreset (SFX cài sẵn)
export const ATMOSPHERIC_EFFECT_PRESETS = {
  weather: [
    { id: 'rain' as const, label: 'mưa', emoji: '🌧️', promptToken: 'rain' },
    { id: 'heavy-rain' as const, label: 'mưa lớn', emoji: '⛈️', promptToken: 'heavy rain pouring' },
    { id: 'snow' as const, label: 'tuyết', emoji: '❄️', promptToken: 'snow falling' },
    { id: 'blizzard' as const, label: 'bão tuyết', emoji: '🌨️', promptToken: 'blizzard, heavy snowstorm' },
    { id: 'fog' as const, label: 'Sương mù dày đặc', emoji: '🌫️', promptToken: 'dense fog' },
    { id: 'mist' as const, label: 'sương mù', emoji: '🌁', promptToken: 'light mist' },
  ],
  environment: [
    { id: 'dust' as const, label: 'bụi bặm', emoji: '💨', promptToken: 'dust particles in air' },
    { id: 'sandstorm' as const, label: 'bão cát', emoji: '🏜️', promptToken: 'sandstorm' },
    { id: 'smoke' as const, label: 'khói', emoji: '💨', promptToken: 'smoke' },
    { id: 'haze' as const, label: 'sương mù', emoji: '🌫️', promptToken: 'atmospheric haze' },
    { id: 'fire' as const, label: 'ngọn lửa', emoji: '🔥', promptToken: 'fire, flames' },
    { id: 'sparks' as const, label: 'tia lửa', emoji: '✨', promptToken: 'sparks flying' },
  ],
  artistic: [
    { id: 'lens-flare' as const, label: 'Cảnh quay halo', emoji: '🌟', promptToken: 'lens flare' },
    { id: 'light-rays' as const, label: 'Hiệu ứng Tyndall', emoji: '🌅', promptToken: 'god rays, light rays through atmosphere' },
    { id: 'falling-leaves' as const, label: 'lá rụng', emoji: '🍂', promptToken: 'falling leaves' },
    { id: 'cherry-blossom' as const, label: 'hoa anh đào', emoji: '🌸', promptToken: 'cherry blossom petals floating' },
    { id: 'fireflies' as const, label: 'đom đóm', emoji: '✨', promptToken: 'fireflies glowing' },
    { id: 'particles' as const, label: 'hạt', emoji: '💫', promptToken: 'floating particles' },
  ],
} as const;

// Hiệu ứcài đặt trước cường độ ng
export const EFFECT_INTENSITY_PRESETS = [
  { id: 'subtle' as const, label: 'nhẹ', labelEn: 'Subtle', promptToken: 'subtle' },
  { id: 'moderate' as const, label: 'trung bình', labelEn: 'Moderate', promptToken: '' },
  { id: 'heavy' as const, label: 'mạnh mẽ', labelEn: 'Heavy', promptToken: 'heavy' },
] as const;

// PhátSpeed cài sẵn (Tốc độ tăng tốc)
export const PLAYBACK_SPEED_PRESETS = [
  { id: 'slow-motion-4x' as const, label: 'Siêu chậm 0,25x', labelEn: 'Super Slow', emoji: '🐌', promptToken: 'ultra slow motion, 120fps,' },
  { id: 'slow-motion-2x' as const, label: 'Chậm Hành động 0.5x', labelEn: 'Slow Mo', emoji: '🐢', promptToken: 'slow motion, 60fps,' },
  { id: 'normal' as const, label: 'Bình thường 1x', labelEn: 'Normal', emoji: '▶️', promptToken: '' },
  { id: 'fast-2x' as const, label: 'Chuyển tiếp nhanh 2x', labelEn: 'Fast', emoji: '⏩', promptToken: 'fast motion, sped up,' },
  { id: 'timelapse' as const, label: 'chụp ảnh tua nhanh thời gian', labelEn: 'Timelapse', emoji: '⏱️', promptToken: 'timelapse, time passing rapidly,' },
] as const;

// ==================== Cảnh quay chuyển động cài sẵn (Camera Movement) ====================

export const CAMERA_MOVEMENT_PRESETS = [
  { id: 'none' as const, label: 'không có', labelEn: 'None', promptToken: '' },
  { id: 'static' as const, label: 'cố địnhGóc máy', labelEn: 'Static', promptToken: 'static camera, locked off,' },
  { id: 'tracking' as const, label: 'Theo dõi cú đánh', labelEn: 'Tracking', promptToken: 'tracking shot, following subject,' },
  { id: 'orbit' as const, label: 'bao quanh', labelEn: 'Orbit', promptToken: 'orbiting around subject, circular camera movement,' },
  { id: 'zoom-in' as const, label: 'Phóng to', labelEn: 'Zoom In', promptToken: 'zoom in, lens zooming closer,' },
  { id: 'zoom-out' as const, label: 'Thu nhỏ', labelEn: 'Zoom Out', promptToken: 'zoom out, lens zooming wider,' },
  { id: 'pan-left' as const, label: 'Cảnh quay lắc trái', labelEn: 'Pan Left', promptToken: 'pan left, horizontal camera rotation left,' },
  { id: 'pan-right' as const, label: 'Cảnh quay lắc phải', labelEn: 'Pan Right', promptToken: 'pan right, horizontal camera rotation right,' },
  { id: 'tilt-up' as const, label: 'Cảnh quay lên', labelEn: 'Tilt Up', promptToken: 'tilt up, camera tilting upward,' },
  { id: 'tilt-down' as const, label: 'Cảnh quay cúi xuống', labelEn: 'Tilt Down', promptToken: 'tilt down, camera tilting downward,' },
  { id: 'dolly-in' as const, label: 'Cảnh quay tiến về phía trước', labelEn: 'Dolly In', promptToken: 'dolly in, camera pushing forward,' },
  { id: 'dolly-out' as const, label: 'Cảnh quay đã chuyển về', labelEn: 'Dolly Out', promptToken: 'dolly out, camera pulling back,' },
  { id: 'truck-left' as const, label: 'Cảnh quay left shift', labelEn: 'Truck Left', promptToken: 'truck left, lateral camera movement left,' },
  { id: 'truck-right' as const, label: 'Cảnh quay shift phải', labelEn: 'Truck Right', promptToken: 'truck right, lateral camera movement right,' },
  { id: 'crane-up' as const, label: 'Cánh tay rocker nâng lên', labelEn: 'Crane Up', promptToken: 'crane up, camera ascending vertically,' },
  { id: 'crane-down' as const, label: 'Cánh tay rocker hạ xuống', labelEn: 'Crane Down', promptToken: 'crane down, camera descending vertically,' },
  { id: 'drone-aerial' as const, label: 'Chụp ảnh trên không bằng máy bay không người lái', labelEn: 'Drone Aerial', promptToken: 'drone aerial shot, sweeping aerial movement,' },
  { id: '360-roll' as const, label: '360°cuộn', labelEn: '360° Roll', promptToken: '360 degree barrel roll, rotating camera,' },
] as const;

export type CameraMovementType = typeof CAMERA_MOVEMENT_PRESETS[number]['id'];

// ==================== Kỹ thuật đặc biệt ====================

export const SPECIAL_TECHNIQUE_PRESETS = [
  { id: 'none' as const, label: 'không có', labelEn: 'None', promptToken: '' },
  { id: 'hitchcock-zoom' as const, label: 'zoom vòi', labelEn: 'Hitchcock Zoom', promptToken: 'dolly zoom, vertigo effect, Hitchcock zoom,' },
  { id: 'timelapse' as const, label: 'chụp ảnh tua nhanh thời gian', labelEn: 'Timelapse', promptToken: 'timelapse, time passing rapidly,' },
  { id: 'crash-zoom-in' as const, label: 'Đẩy khẩn cấp Cảnh quay', labelEn: 'Crash Zoom In', promptToken: 'crash zoom in, sudden rapid zoom,' },
  { id: 'crash-zoom-out' as const, label: 'Kéo nhanh Cảnh quay', labelEn: 'Crash Zoom Out', promptToken: 'crash zoom out, sudden rapid pull back,' },
  { id: 'whip-pan' as const, label: 'Bắn nhanh', labelEn: 'Whip Pan', promptToken: 'whip pan, fast swish pan, motion blur transition,' },
  { id: 'bullet-time' as const, label: 'Viên đạn thứời gian', labelEn: 'Bullet Time', promptToken: 'bullet time, frozen time orbit shot, ultra slow motion,' },
  { id: 'fpv-shuttle' as const, label: 'Tàu con thoi FPV', labelEn: 'FPV Shuttle', promptToken: 'FPV drone shuttle, first person flight through scene,' },
  { id: 'macro-closeup' as const, label: 'Vĩ môĐặc tả', labelEn: 'Macro Close-up', promptToken: 'macro extreme close-up, intricate detail shot,' },
  { id: 'first-person' as const, label: 'người đầu tiên', labelEn: 'First Person', promptToken: 'first person POV shot, subjective camera,' },
  { id: 'slow-motion' as const, label: 'Chậm Cảnh quay', labelEn: 'Slow Motion', promptToken: 'slow motion, dramatic slow mo, high frame rate,' },
  { id: 'probe-lens' as const, label: 'Đầu dò Cảnh quay', labelEn: 'Probe Lens', promptToken: 'probe lens shot, snorkel camera, macro perspective movement,' },
  { id: 'spinning-tilt' as const, label: 'XoayIn nghiêngCảnh quay', labelEn: 'Spinning Tilt', promptToken: 'spinning tilting camera, disorienting rotation,' },
] as const;

export type SpecialTechniqueType = typeof SPECIAL_TECHNIQUE_PRESETS[number]['id'];

// ==================== Cài đặt trước nhãn cảm xúc ====================

export const EMOTION_PRESETS = {
  // Cơ bảnCảm xúc
  basic: [
    { id: 'happy', label: 'hạnh phúc', emoji: '😊' },
    { id: 'sad', label: 'buồn', emoji: '😢' },
    { id: 'angry', label: 'tức giận', emoji: '😠' },
    { id: 'surprised', label: 'ngạc nhiên', emoji: '😲' },
    { id: 'fearful', label: 'nỗi sợ hãi', emoji: '😨' },
    { id: 'calm', label: 'bình tĩnh', emoji: '😐' },
  ],
  // khí sắc
  atmosphere: [
    { id: 'tense', label: 'lo lắng', emoji: '😰' },
    { id: 'excited', label: 'vui mừng', emoji: '🤩' },
    { id: 'mysterious', label: 'bí ẩn', emoji: '🤔' },
    { id: 'romantic', label: 'lãng mạn', emoji: '🥰' },
    { id: 'funny', label: 'Hài hước', emoji: '😂' },
    { id: 'touching', label: 'chạm vào', emoji: '🥹' },
  ],
  // giọng điệu
  tone: [
    { id: 'serious', label: 'nghiêm túc', emoji: '😑' },
    { id: 'relaxed', label: 'Dễ dàng', emoji: '😌' },
    { id: 'playful', label: 'chế nhạo', emoji: '😜' },
    { id: 'gentle', label: 'nhẹ nhàng', emoji: '😇' },
    { id: 'passionate', label: 'đam mê', emoji: '🔥' },
    { id: 'low', label: 'thấp', emoji: '😔' },
  ],
} as const;

export type EmotionTag = typeof EMOTION_PRESETS.basic[number]['id'] 
  | typeof EMOTION_PRESETS.atmosphere[number]['id'] 
  | typeof EMOTION_PRESETS.tone[number]['id'];

// ==================== Cài đặt trước góc máy ảnh ====================

export const CAMERA_ANGLE_PRESETS = [
  { id: 'eye-level' as const, label: 'tầm mắt', labelEn: 'Eye Level', emoji: '👁️', promptToken: 'eye level angle,' },
  { id: 'high-angle' as const, label: 'bắn từ trên cao', labelEn: 'High Angle', emoji: '⬇️', promptToken: 'high angle shot, looking down,' },
  { id: 'low-angle' as const, label: 'Nhìn lên', labelEn: 'Low Angle', emoji: '⬆️', promptToken: 'low angle shot, looking up, heroic perspective,' },
  { id: 'birds-eye' as const, label: 'nhìn từ trên cao', labelEn: "Bird's Eye", emoji: '🦅', promptToken: "bird's eye view, top-down overhead shot," },
  { id: 'worms-eye' as const, label: 'tầm nhìn côn trùng', labelEn: "Worm's Eye", emoji: '🐛', promptToken: "worm's eye view, extreme low angle from ground," },
  { id: 'over-shoulder' as const, label: 'Trên vai', labelEn: 'Over the Shoulder', emoji: '🫂', promptToken: 'over the shoulder shot, OTS,' },
  { id: 'side-angle' as const, label: 'Bắn bên', labelEn: 'Side Angle', emoji: '↔️', promptToken: 'side angle, profile view,' },
  { id: 'dutch-angle' as const, label: 'Mũi Hà Lan', labelEn: 'Dutch Angle', emoji: '📐', promptToken: 'dutch angle, tilted frame, canted angle,' },
  { id: 'third-person' as const, label: 'người thứ ba', labelEn: 'Third Person', emoji: '🎮', promptToken: 'third person perspective, slightly behind and above subject,' },
] as const;

export type CameraAngleType = typeof CAMERA_ANGLE_PRESETS[number]['id'];

// ==================== Cảnh quay tiêu cự cài sẵn (Focal Long) ====================

export const FOCAL_LENGTH_PRESETS = [
  { id: '8mm' as const, label: 'mắt cá 8mm', labelEn: '8mm Fisheye', emoji: '🐟', promptToken: '8mm fisheye lens, extreme barrel distortion, ultra wide field of view,' },
  { id: '14mm' as const, label: 'Góc siêu rộng 14mm', labelEn: '14mm Ultra Wide', emoji: '🌐', promptToken: '14mm ultra wide angle lens, dramatic perspective distortion,' },
  { id: '24mm' as const, label: 'góc rộng 24mm', labelEn: '24mm Wide', emoji: '🏔️', promptToken: '24mm wide angle lens, environmental context, slight perspective exaggeration,' },
  { id: '35mm' as const, label: 'Góc rộng tiêu chuẩn 35mm', labelEn: '35mm Standard Wide', emoji: '📷', promptToken: '35mm lens, natural wide perspective, street photography feel,' },
  { id: '50mm' as const, label: 'tiêu chuẩn 50mm', labelEn: '50mm Standard', emoji: '👁️', promptToken: '50mm standard lens, natural human eye perspective,' },
  { id: '85mm' as const, label: 'chân dung 85mm', labelEn: '85mm Portrait', emoji: '🧑', promptToken: '85mm portrait lens, flattering facial proportions, smooth background compression,' },
  { id: '105mm' as const, label: 'Tiêu cự trung bình 105mm', labelEn: '105mm Medium Tele', emoji: '🔭', promptToken: '105mm medium telephoto, gentle background compression,' },
  { id: '135mm' as const, label: 'ống kính tele 135mm', labelEn: '135mm Telephoto', emoji: '📡', promptToken: '135mm telephoto lens, strong background compression, subject isolation,' },
  { id: '200mm' as const, label: 'ống kính tele 200mm', labelEn: '200mm Long Tele', emoji: '🔬', promptToken: '200mm telephoto, extreme background compression, flattened perspective,' },
  { id: '400mm' as const, label: 'Chụp ảnh siêu tele 400mm', labelEn: '400mm Super Tele', emoji: '🛰️', promptToken: '400mm super telephoto, extreme compression, distant subject isolation,' },
] as const;

export type FocalLengthType = typeof FOCAL_LENGTH_PRESETS[number]['id'];

// ==================== Kỹ thuật chụp ảnh ====================

export const PHOTOGRAPHY_TECHNIQUE_PRESETS = [
  { id: 'long-exposure' as const, label: 'tiếp xúc lâu', labelEn: 'Long Exposure', emoji: '🌊', promptToken: 'long exposure, motion blur, light trails, smooth water,' },
  { id: 'double-exposure' as const, label: 'phơi sáng nhiều lần', labelEn: 'Double Exposure', emoji: '👥', promptToken: 'double exposure, overlapping images, ghostly transparency effect,' },
  { id: 'macro' as const, label: 'chụp ảnh macro', labelEn: 'Macro', emoji: '🔍', promptToken: 'macro photography, extreme close-up, intricate details visible,' },
  { id: 'tilt-shift' as const, label: 'chụp ảnh nghiêng', labelEn: 'Tilt-Shift', emoji: '🏘️', promptToken: 'tilt-shift photography, miniature effect, selective focus plane,' },
  { id: 'high-speed' as const, label: 'Đóng băng màn trập tốc độ cao', labelEn: 'High Speed Freeze', emoji: '⚡', promptToken: 'high speed photography, frozen motion, sharp action freeze frame,' },
  { id: 'bokeh' as const, label: 'Độ sâu trường ảnh mờ', labelEn: 'Bokeh', emoji: '💫', promptToken: 'beautiful bokeh, creamy out-of-focus highlights, dreamy background blur,' },
  { id: 'reflection' as const, label: 'sự phản ánh/bắn gương', labelEn: 'Reflection', emoji: '🪞', promptToken: 'reflection photography, mirror surface, symmetrical composition,' },
  { id: 'silhouette-technique' as const, label: 'bắn bóng', labelEn: 'Silhouette', emoji: '🌅', promptToken: 'silhouette photography, dark figure against bright background, rim light outline,' },
] as const;

export type PhotographyTechniqueType = typeof PHOTOGRAPHY_TECHNIQUE_PRESETS[number]['id'];
