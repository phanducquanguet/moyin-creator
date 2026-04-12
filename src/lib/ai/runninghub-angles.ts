// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * RunningHub Angle Constants
 * 96\u79cdGóc nhìnĐịnh nghĩa：8\u65b9\u5411 × 4\u4fef\u4ef0\u89d2 × 3Cỡ cảnh
 */

export type HorizontalDirection = 
  | 'front'              // phía trước 0°
  | 'front-right-quarter' // \u53f3\u524d 45°
  | 'right-side'         // \u53f3\u4fa7 90°
  | 'back-right-quarter' // \u53f3\u540e 135°
  | 'back'               // \u80cc\u9762 180°
  | 'back-left-quarter'  // \u5de6\u540e 225°
  | 'left-side'          // \u5de6\u4fa7 270°
  | 'front-left-quarter'; // \u5de6\u524d 315°

export type ElevationAngle = 
  | 'low-angle'    // \u4ef0\u89c6
  | 'eye-level'    // tầm mắt
  | 'elevated'     // \u5fae\u4fef\u89c6
  | 'high-angle';  // \u5927\u4fef\u89c6

export type ShotSize = 
  | 'close-up'      // Đặc tả
  | 'medium-shot'   // Trung cảnh
  | 'wide-shot';    // Toàn cảnh

export interface AnglePreset {
  id: string;
  direction: HorizontalDirection;
  elevation: ElevationAngle;
  shotSize: ShotSize;
  prompt: string;
  label: {
    zh: string;
    en: string;
  };
}

// \u6c34\u5e73\u65b9\u5411\u5b9a\u4e49
export const HORIZONTAL_DIRECTIONS: Array<{
  id: HorizontalDirection;
  label: string;
  degrees: number;
}> = [
  { id: 'front', label: 'phía trước', degrees: 0 },
  { id: 'front-right-quarter', label: '\u53f3\u524d', degrees: 45 },
  { id: 'right-side', label: '\u53f3\u4fa7', degrees: 90 },
  { id: 'back-right-quarter', label: '\u53f3\u540e', degrees: 135 },
  { id: 'back', label: '\u80cc\u9762', degrees: 180 },
  { id: 'back-left-quarter', label: '\u5de6\u540e', degrees: 225 },
  { id: 'left-side', label: '\u5de6\u4fa7', degrees: 270 },
  { id: 'front-left-quarter', label: '\u5de6\u524d', degrees: 315 },
];

// \u4fef\u4ef0góc\u5b9a\u4e49
export const ELEVATION_ANGLES: Array<{
  id: ElevationAngle;
  label: string;
  description: string;
}> = [
  { id: 'low-angle', label: '\u4ef0\u89c6', description: 'từ\u4e0b\u5f80\u4e0a\u62cd' },
  { id: 'eye-level', label: 'tầm mắt', description: '\u6c34\u5e73Góc nhìn' },
  { id: 'elevated', label: '\u5fae\u4fef\u89c6', description: '\u7565\u5fae\u4fef\u89c6' },
  { id: 'high-angle', label: '\u5927\u4fef\u89c6', description: 'từ\u4e0a\u5f80\u4e0b\u62cd' },
];

// Cỡ cảnh\u5b9a\u4e49
export const SHOT_SIZES: Array<{
  id: ShotSize;
  label: string;
  description: string;
}> = [
  { id: 'close-up', label: 'Đặc tả', description: 'Close-up' },
  { id: 'medium-shot', label: 'Trung cảnh', description: 'Medium Shot' },
  { id: 'wide-shot', label: 'Toàn cảnh', description: 'Wide Shot' },
];

// \u65b9\u5411ĐếnPromptcủa\u7cbe\u786e\u6620\u5c04
const DIRECTION_PROMPTS: Record<HorizontalDirection, string> = {
  'front': 'front view',
  'front-right-quarter': 'front-right quarter view',
  'right-side': 'right side view',
  'back-right-quarter': 'back-right quarter view',
  'back': 'back view',
  'back-left-quarter': 'back-left quarter view',
  'left-side': 'left side view',
  'front-left-quarter': 'front-left quarter view',
};

// \u4fef\u4ef0\u89d2ĐếnPromptcủa\u7cbe\u786e\u6620\u5c04
const ELEVATION_PROMPTS: Record<ElevationAngle, string> = {
  'low-angle': 'low-angle shot',
  'eye-level': 'eye-level shot',
  'elevated': 'elevated shot',
  'high-angle': 'high-angle shot',
};

// Cỡ cảnhĐếnPromptcủa\u7cbe\u786e\u6620\u5c04
const SHOT_SIZE_PROMPTS: Record<ShotSize, string> = {
  'close-up': 'close-up',
  'medium-shot': 'medium shot',
  'wide-shot': 'wide shot',
};

/**
 * Tạo\u5355Góc nhìncủaPrompt
 * \u7cbe\u786etrận đấu96\u79cdTiêu chuẩnPromptĐịnh dạng
 */
export function generateAnglePrompt(
  direction: HorizontalDirection,
  elevation: ElevationAngle,
  shotSize: ShotSize
): string {
  const directionText = DIRECTION_PROMPTS[direction];
  const elevationText = ELEVATION_PROMPTS[elevation];
  const shotSizeText = SHOT_SIZE_PROMPTS[shotSize];
  
  return `<sks> ${directionText} ${elevationText} ${shotSizeText}`;
}

/**
 * TạoTất cả96\u79cdGóc nhìn\u9884\u8bbe
 */
export function generateAllAnglePresets(): AnglePreset[] {
  const presets: AnglePreset[] = [];
  
  for (const direction of HORIZONTAL_DIRECTIONS) {
    for (const elevation of ELEVATION_ANGLES) {
      for (const shotSize of SHOT_SIZES) {
        const prompt = generateAnglePrompt(
          direction.id,
          elevation.id,
          shotSize.id
        );
        
        const id = `${direction.id}-${elevation.id}-${shotSize.id}`;
        
        presets.push({
          id,
          direction: direction.id,
          elevation: elevation.id,
          shotSize: shotSize.id,
          prompt,
          label: {
            zh: `${direction.label} ${elevation.label} ${shotSize.label}`,
            en: prompt.replace('<sks> ', ''),
          },
        });
      }
    }
  }
  
  return presets;
}

/**
 * \u83b7\u53d6Tiếng Trungnhãn
 */
export function getAngleLabel(
  direction: HorizontalDirection,
  elevation: ElevationAngle,
  shotSize: ShotSize
): string {
  const dir = HORIZONTAL_DIRECTIONS.find(d => d.id === direction)?.label || '';
  const elev = ELEVATION_ANGLES.find(e => e.id === elevation)?.label || '';
  const size = SHOT_SIZES.find(s => s.id === shotSize)?.label || '';
  
  return `${dir} ${elev} ${size}`;
}

/**
 * Thường được sử dụng Góc nhìnNhanh\u6377\u65b9\u5f0f
 */
export const COMMON_ANGLES: Array<{
  name: string;
  preset: Pick<AnglePreset, 'direction' | 'elevation' | 'shotSize'>;
}> = [
  {
    name: 'phía trướctầm mắtTrung cảnh',
    preset: { direction: 'front', elevation: 'eye-level', shotSize: 'medium-shot' },
  },
  {
    name: '\u53f3\u524dtầm mắtTrung cảnh',
    preset: { direction: 'front-right-quarter', elevation: 'eye-level', shotSize: 'medium-shot' },
  },
  {
    name: '\u4fa7\u9762tầm mắtTrung cảnh',
    preset: { direction: 'right-side', elevation: 'eye-level', shotSize: 'medium-shot' },
  },
  {
    name: '\u80cc\u9762tầm mắtTrung cảnh',
    preset: { direction: 'back', elevation: 'eye-level', shotSize: 'medium-shot' },
  },
];
