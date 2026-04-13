// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Visual Style Presets - Định nghĩa thống nhất phong cách hình ảnh
 *
 * Dùng chung cho tất cả các panel (Kịch bản, Nhân vật, Cảnh, AI Đạo diễn)
 * Nguồn: Thư viện phong cách nội dung
 */

// Phân loại phong cách
export type StyleCategory = '3d' | '2d' | 'real' | 'stop_motion';

/**
 * Loại media — quyết định chiến lược dịch tham số quay phim trong prompt-builder
 * - cinematic: Từ vựng quay phim đầy đủ (người thật / 3D thực tế)
 * - animation: Thích nghi với hoạt hình (hoạt hình 2D / 3D phong cách)
 * - stop-motion: Khoảng dừng giữa các khung (hoạt hình stop motion)
 * - graphic: Chỉ màu sắc / cảm xúc / nhịp điệu (pixel / màu nước / phác thảo và các phong cách trừu tượng cao)
 */
export type MediaType = 'cinematic' | 'animation' | 'stop-motion' | 'graphic';

export interface StylePreset {
  id: string;
  name: string;
  category: StyleCategory;
  /** Loại media — kiểm soát chiến lược dịch tham số quay phim */
  mediaType: MediaType;
  /** Prompt tiếng Anh */
  prompt: string;
  /** Prompt tiêu cực */
  negativePrompt: string;
  /** Mô tả tiếng Việt */
  description: string;
  /** Tên file thumbnail */
  thumbnail: string;
}

// ============================================================
// Phong cách 3D
// ============================================================

const STYLES_3D: StylePreset[] = [
  {
    id: '3d_xuanhuan',
    name: '3D Huyền Tưởng',
    category: '3d',
    mediaType: 'cinematic',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (stunning stylized 3D Chinese animation character render:1.3), (Unreal Engine 5 style:1.2), (cinematic lighting, soft volumetric fog:1.1), (smooth porcelain skin texture:1.1), (intricate traditional Chinese fabric details, fine embroidery, flowing robes:1.1), ethereal atmosphere, glowing spiritual energy, beautiful facial features, (delicate body proportions), sharp focus, detailed background',
    negativePrompt: '(worst quality, low quality, bad quality:1.4), (blurry, fuzzy, distorted, out of focus:1.3), (2D, flat, drawing, painting, sketch, anime, cartoon:1.2), (realistic, photo, real life, photography:1.1), (western style, modern clothing), (extra limbs, missing limbs, mutated hands, distorted body), ugly, watermark, signature, text, easynegative, bad-hands-5',
    description: 'Huyền tưởng Trung Quốc, tiên hiệp, render Unreal Engine, hiệu ứng ánh sáng tráng lệ',
    thumbnail: '3d_xuanhuan.png',
  },
  {
    id: '3d_american',
    name: '3D Kiểu Mỹ',
    category: '3d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Disney Pixar style 3D animation:1.3), (expressive character design, large eyes:1.2), (subsurface scattering skin:1.1), (vibrant colors, warm lighting:1.1), cute, 3d render, cgsociety, detailed background, soft edges',
    negativePrompt: '(worst quality, low quality, bad quality:1.4), (blurry, fuzzy:1.3), (2D, flat, sketch, anime:1.2), (gloomy, dark, gritty), (realistic, photo), ugly, distorted',
    description: 'Phong cách Disney/Pixar, hoạt hình 3D Mỹ, màu sắc tươi sáng, nhân vật dễ thương',
    thumbnail: '3d_american.png',
  },
  {
    id: '3d_q_version',
    name: '3D Phiên Bản Q',
    category: '3d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Pop Mart blind box style:1.3), (chibi 3d rendering:1.2), (Oc render:1.2), (soft studio lighting, rim light:1.1), (plastic material, smooth texture:1.1), cute, super deformed, clean background, c4d render',
    negativePrompt: '(worst quality, low quality:1.4), (rough surface), (realistic skin texture), (2D, flat), dark, scary, ugly',
    description: 'Phong cách hộp mù/đồ chơi, phiên bản Q 3D, render C4D, ánh sáng mềm',
    thumbnail: '3d_q_version.png',
  },
  {
    id: '3d_realistic',
    name: '3D Siêu Thực',
    category: '3d',
    mediaType: 'cinematic',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (photorealistic 3D render:1.3), (hyperrealistic details:1.2), (Unreal Engine 5:1.2), (cinematic lighting, ray tracing:1.1), (highly detailed texture, pores, imperfections:1.1), sharp focus, depth of field',
    negativePrompt: '(worst quality, low quality:1.4), (cartoon, anime, painting, sketch:1.3), (stylized, 2D, flat), blurry, low res, plastic skin',
    description: '3D siêu thực, ánh sáng chuẩn điện ảnh, độ phân giải 8K, kết cấu chi tiết phong phú',
    thumbnail: '3d_realistic.png',
  },
  {
    id: '3d_block',
    name: '3D Low Poly',
    category: '3d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (low poly art style:1.3), (minimalist 3D:1.2), (sharp edges, geometric shapes:1.2), (flat shading, simple colors:1.1), polygon art, clean composition',
    negativePrompt: '(worst quality, low quality:1.4), (detailed texture, realistic, high poly), (round, smooth, soft), (2D, sketch), noise',
    description: 'Đa giác thấp, Low Poly, mặt phẳng hình học, phong cách tối giản',
    thumbnail: '3d_block.png',
  },
  {
    id: '3d_voxel',
    name: '3D Voxel',
    category: '3d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Minecraft style voxel art:1.3), (cubic blocks:1.2), (8-bit 3d:1.1), lego style, sharp focus, vibrant colors, isometric view',
    negativePrompt: '(worst quality, low quality:1.4), (round, curved, organic shapes), (realistic, high resolution texture), (2D, flat), blur',
    description: 'Phong cách Minecraft, nghệ thuật voxel, cảm giác khối vuông',
    thumbnail: '3d_voxel.png',
  },
  {
    id: '3d_mobile',
    name: '3D Game Mobile',
    category: '3d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (unity engine mobile game style:1.3), (stylized 3D character:1.2), (cel shaded 3d:1.1), (clean textures, vibrant aesthetic:1.1), game asset, polished',
    negativePrompt: '(worst quality, low quality:1.4), (sketch, rough), (photorealistic, heavy noise), (2D, flat), ugly, pixelated',
    description: 'Phong cách game mobile 3D, render Unity, 3D phong cách',
    thumbnail: '3d_mobile.png',
  },
  {
    id: '3d_render_2d',
    name: '3D Cel-Shade 2D',
    category: '3d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Genshin Impact style:1.3), (cel shaded 3D:1.2), (anime style 3d rendering:1.2), (clean lines, vibrant anime colors:1.1), 2.5d, toon shading',
    negativePrompt: '(worst quality, low quality:1.4), (realistic, photorealistic:1.3), (sketch, rough lines), (heavy shadows), ugly, distorted',
    description: '3D render 2D, cel shading, phong cách Genshin Impact',
    thumbnail: '3d_render_2d.png',
  },
  {
    id: 'jp_3d_render_2d',
    name: '3D Cel-Shade Nhật',
    category: '3d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Guilty Gear Strive style:1.3), (Japanese anime 3D render:1.2), (dynamic camera angles:1.1), (sharp cel shading:1.1), vibrant colors, detailed character design',
    negativePrompt: '(worst quality, low quality:1.4), (realistic, photorealistic:1.3), (western cartoon), (flat colors, dull), ugly',
    description: '3D render 2D kiểu Nhật, phong cách Guilty Gear, màu hoạt hình tươi sáng',
    thumbnail: 'jp_3d_render_2d.png',
  },
];

// ============================================================
// Phong cách 2D
// ============================================================

const STYLES_2D: StylePreset[] = [
  {
    id: '2d_animation',
    name: '2D Hoạt Hình',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (standard Japanese anime style:1.3), (clean lineart, flat color:1.2), (anime character design:1.1), vibrant, detailed eyes',
    negativePrompt: '(worst quality, low quality:1.4), (3D, realistic, photorealistic, cgi:1.3), (sketch, messy), ugly, bad anatomy',
    description: 'Phong cách hoạt hình 2D Nhật Bản chuẩn',
    thumbnail: '2d_animation.png',
  },
  {
    id: '2d_movie',
    name: '2D Điện Ảnh',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Makoto Shinkai style:1.3), (breathtaking cinematic lighting:1.2), (highly detailed background, clouds, starry sky:1.1), (sentimental atmosphere:1.1), anime movie still, high budget animation',
    negativePrompt: '(worst quality, low quality:1.4), (simple, flat, cartoon), (3D, realistic), (dull colors), low resolution',
    description: 'Chất lượng điện ảnh hoạt hình, phong cách Makoto Shinkai, nền chi tiết',
    thumbnail: '2d_movie.png',
  },
  {
    id: '2d_fantasy',
    name: '2D Kỳ Ảo',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (fantasy anime style:1.3), (magical atmosphere, glowing particles:1.2), (intricate armor and robes:1.1), (vibrant mystical colors:1.1), world of magic, dreamy',
    negativePrompt: '(worst quality, low quality:1.4), (modern setting, sci-fi), (3D, realistic), dark and gritty, ugly',
    description: 'Hoạt hình kỳ ảo, thế giới phép thuật, màu sắc mộng mơ',
    thumbnail: '2d_fantasy.png',
  },
  {
    id: '2d_retro',
    name: '2D Hoài Cổ',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (90s retro anime style:1.3), (cel animation aesthetic:1.2), (vintage VHS effect, lo-fi:1.1), (Sailor Moon style:1.1), matte painting background, nostalgic',
    negativePrompt: '(worst quality, low quality:1.4), (digital painting, modern anime style, 3D), (high definition, sharp), (glossy)',
    description: 'Hoạt hình hoài cổ thập niên 90, phong cách Thủy Thủ Mặt Trăng, lo-fi',
    thumbnail: '2d_retro.png',
  },
  {
    id: '2d_american',
    name: '2D Cartoon Mỹ',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Cartoon Network style:1.3), (bold thick outlines:1.2), (exaggerated expressions:1.1), (western cartoon aesthetic:1.1), flat colors, energetic',
    negativePrompt: '(worst quality, low quality:1.4), (anime, manga style), (3D, realistic, shaded), (delicate lines), ugly',
    description: 'Hoạt hình Mỹ, phong cách Cartoon Network, nét đậm',
    thumbnail: '2d_american.png',
  },
  {
    id: '2d_ghibli',
    name: '2D Studio Ghibli',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Studio Ghibli style:1.3), (Hayao Miyazaki:1.2), (hand painted watercolor background:1.2), (peaceful nature atmosphere:1.1), soft colors, charming characters',
    negativePrompt: '(worst quality, low quality:1.4), (sharp digital lines), (3D, realistic, cgi), (neon colors), dark, scary',
    description: 'Phong cách Ghibli, Miyazaki Hayao, nền màu nước, tự nhiên trong sáng',
    thumbnail: '2d_ghibli.png',
  },
  {
    id: '2d_retro_girl',
    name: '2D Shojo Hoài Cổ',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (80s shoujo manga style:1.3), (sparkly big eyes:1.2), (pastel colors, flowers and bubbles:1.1), (retro fashion:1.1), dreamy, romantic',
    negativePrompt: '(worst quality, low quality:1.4), (modern digital art), (3D, realistic), (dark, horror), (thick lines), ugly',
    description: 'Phong cách truyện tranh thiếu nữ thập niên 80, mắt sao, màu pastel nhẹ nhàng',
    thumbnail: '2d_retro_girl.png',
  },
  {
    id: '2d_korean',
    name: '2D Manhwa Hàn',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (premium Webtoon style:1.3), (sharp handsome facial features:1.2), (detailed digital coloring, glowing eyes:1.1), (modern fashion:1.1), manhwa aesthetic',
    negativePrompt: '(worst quality, low quality:1.4), (Japanese anime style), (retro), (3D, realistic), (sketch), ugly',
    description: 'Phong cách truyện tranh Hàn, Webtoon, tô màu tinh tế',
    thumbnail: '2d_korean.png',
  },
  {
    id: '2d_shonen',
    name: '2D Shonen',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Shonen anime style:1.3), (dynamic high-impact pose:1.2), (intense action lines, speed lines:1.1), (high contrast shading:1.1), powerful, energetic',
    negativePrompt: '(worst quality, low quality:1.4), (calm, static), (shoujo style, soft), (3D, realistic), (pastel colors), boring',
    description: 'Truyện tranh shonen nhiệt huyết, tư thế năng động, đường tốc độ, độ tương phản cao',
    thumbnail: '2d_shonen.png',
  },
  {
    id: '2d_akira',
    name: '2D Toriama',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Akira Toriyama art style:1.3), (Dragon Ball Z style:1.2), (muscular definition:1.1), (sharp angular eyes:1.1), retro shonen, iconic',
    negativePrompt: '(worst quality, low quality:1.4), (modern soft anime), (shoujo), (3D, realistic), (round features), ugly',
    description: 'Phong cách Toriama Akira / Dragon Ball',
    thumbnail: '2d_akira.png',
  },
  {
    id: '2d_doraemon',
    name: '2D Doraemon',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Doraemon style:1.3), (Fujiko F Fujio:1.2), (simple round character design:1.2), (childlike and cute:1.1), bright colors, clean lines',
    negativePrompt: '(worst quality, low quality:1.4), (complex details, realistic), (sharp angles), (dark, gloomy), (3D), scary',
    description: 'Phong cách Doraemon / Fujiko F. Fujio',
    thumbnail: '2d_doraemon.png',
  },
  {
    id: '2d_fujimoto',
    name: '2D Fujimoto',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Tatsuki Fujimoto style:1.3), (sketchy loose lines:1.2), (cinematic movie composition:1.1), (raw emotion:1.1), chainsaw man manga style, unique',
    negativePrompt: '(worst quality, low quality:1.4), (polished digital art), (standard anime), (3D, realistic), (moe, kawaii), boring',
    description: 'Phong cách Fujimoto / Chainsaw Man, nét vẽ phóng khoáng, bố cục điện ảnh',
    thumbnail: '2d_fujimoto.png',
  },
  {
    id: '2d_mob',
    name: '2D Mob Psycho',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Mob Psycho 100 style:1.3), (ONE style:1.2), (psychedelic colors:1.1), (warped perspective:1.1), urban fantasy, supernatural',
    negativePrompt: '(worst quality, low quality:1.4), (realistic proportions), (standard anime beauty), (3D), (calm colors), boring',
    description: 'Phong cách Mob Psycho 100, truyền thuyết đô thị, màu sắc ảo giác',
    thumbnail: '2d_mob.png',
  },
  {
    id: '2d_jojo',
    name: '2D JOJO',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Jojo\'s Bizarre Adventure style:1.3), (Araki Hirohiko artstyle:1.2), (heavy shading, harsh lines:1.1), (fabulous pose, muscular:1.1), menacing text, detailed',
    negativePrompt: '(worst quality, low quality:1.4), (moe, cute, soft), (minimalist), (3D, realistic), (thin lines), weak',
    description: 'Phong cách JOJO, Araki Hirohiko, nét đặc trưng, bóng mạnh',
    thumbnail: '2d_jojo.png',
  },
  {
    id: '2d_detective',
    name: '2D Thám Tử',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Detective Conan style:1.3), (Gosho Aoyama:1.2), (distinctive sharp nose and ears:1.1), (mystery atmosphere:1.1), 90s anime aesthetic',
    negativePrompt: '(worst quality, low quality:1.4), (modern detailed eye), (3D, realistic), (fantasy), ugly',
    description: 'Phong cách Thám Tử Conan / Gosho Aoyama',
    thumbnail: '2d_detective.png',
  },
  {
    id: '2d_slamdunk',
    name: '2D Slam Dunk',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Slam Dunk style:1.3), (Takehiko Inoue:1.2), (realistic body proportions:1.1), (detailed muscle and sweat:1.1), intense sports atmosphere, 90s anime',
    negativePrompt: '(worst quality, low quality:1.4), (chibi, moe), (fantasy), (3D), (distorted anatomy), weak',
    description: 'Phong cách Slam Dunk / Inoue Takehiko, tỷ lệ thực tế',
    thumbnail: '2d_slamdunk.png',
  },
  {
    id: '2d_astroboy',
    name: '2D Tezuka',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Osamu Tezuka style:1.3), (classic Astro Boy aesthetic:1.2), (large expressive eyes, rounded features:1.1), black and white or vintage color, iconic',
    negativePrompt: '(worst quality, low quality:1.4), (modern anime), (sharp angles), (3D, realistic), (complex shading), ugly',
    description: 'Phong cách Tezuka Osamu / Astro Boy, nét vẽ tròn trặn cổ điển',
    thumbnail: '2d_astroboy.png',
  },
  {
    id: '2d_deathnote',
    name: '2D Death Note',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Death Note style:1.3), (Takeshi Obata:1.2), (gothic dark atmosphere:1.1), (intricate cross-hatching, sharp features:1.1), serious, mystery',
    negativePrompt: '(worst quality, low quality:1.4), (cute, happy, bright colors), (chibi), (thick lines), (3D), ugly',
    description: 'Phong cách Death Note / Obata Takeshi, gothic, không khí tối tăm',
    thumbnail: '2d_deathnote.png',
  },
  {
    id: '2d_thick_line',
    name: '2D Nét Đậm',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (Graffiti art style:1.3), (bold thick black outlines:1.2), (urban street art:1.1), (vibrant contrast colors:1.1), stylized, cool',
    negativePrompt: '(worst quality, low quality:1.4), (thin delicate lines), (realistic, painting), (faded colors), (3D), boring',
    description: 'Đường viền nét đậm, phong cách graffiti, nghệ thuật đường phố',
    thumbnail: '2d_thick_line.png',
  },
  {
    id: '2d_rubberhose',
    name: '2D Rubber Hose',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (1930s rubber hose animation:1.3), (Cuphead style:1.2), (vintage Disney style:1.1), (black and white, film grain:1.1), swinging limbs, pie eyes',
    negativePrompt: '(worst quality, low quality:1.4), (modern cartoon), (color), (3D, realistic), (anime), (stiff animation)',
    description: 'Hoạt hình rubber hose, phim hoạt hình thập niên 30, phong cách Cuphead',
    thumbnail: '2d_rubberhose.png',
  },
  {
    id: '2d_q_version',
    name: '2D Phiên Bản Q',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k:1.2), (kawaii chibi style:1.3), (super deformed characters:1.2), (soft pastel colors:1.1), (simple shading:1.1), cute, adorable',
    negativePrompt: '(worst quality, low quality:1.4), (realistic proportions), (mature, dark), (3D, realistic), (horror), ugly',
    description: '2D phiên bản Q, phong cách dễ thương',
    thumbnail: '2d_q_version.png',
  },
  {
    id: '2d_pixel',
    name: '2D Pixel',
    category: '2d',
    mediaType: 'graphic',
    prompt: '(best quality, masterpiece, 8k:1.2), (pixel art style:1.3), (16-bit game sprite:1.2), (retro gaming aesthetic:1.1), (dithering:1.1), clean pixels, colorful',
    negativePrompt: '(worst quality, low quality:1.4), (vector art), (smooth lines), (3D, realistic), (blur), (anti-aliasing)',
    description: 'Nghệ thuật pixel, phong cách game 8-bit/16-bit',
    thumbnail: '2d_pixel.png',
  },
  {
    id: '2d_gongbi',
    name: '2D Tranh Công Bút',
    category: '2d',
    mediaType: 'graphic',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Chinese Gongbi painting style:1.3), (meticulous brushwork:1.2), (elegant traditional art:1.1), (ink wash painting background:1.1), delicate, cultural',
    negativePrompt: '(worst quality, low quality:1.4), (western art style), (oil painting), (sketchy), (3D, realistic), (vibrant neon colors)',
    description: 'Phong cách tranh công bút Trung Quốc, nét cọ tinh tế',
    thumbnail: '2d_gongbi.png',
  },
  {
    id: '2d_stick',
    name: '2D Vẽ Phác',
    category: '2d',
    mediaType: 'graphic',
    prompt: '(best quality, masterpiece, 8k:1.2), (minimalist stick figure style:1.3), (hand drawn doodle:1.2), (sketchbook aesthetic:1.1), simple lines, white background, cute',
    negativePrompt: '(worst quality, low quality:1.4), (complex, detailed, realistic), (color filled), (3D), (shading)',
    description: 'Tranh vẽ phác, graffiti, vẽ tay tối giản',
    thumbnail: '2d_stick.png',
  },
  {
    id: '2d_watercolor',
    name: '2D Màu Nước',
    category: '2d',
    mediaType: 'graphic',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (watercolor painting style:1.3), (wet on wet technique:1.2), (soft edges, artistic strokes:1.1), (paper texture:1.1), dreamy, illustration',
    negativePrompt: '(worst quality, low quality:1.4), (digital flat color), (sharp hard lines), (3D, realistic), (vector art), ugly',
    description: 'Phong cách tranh màu nước, kỹ thuật vẽ ướt, cảm giác nghệ thuật',
    thumbnail: '2d_watercolor.png',
  },
  {
    id: '2d_simple_line',
    name: '2D Đường Nét Đơn',
    category: '2d',
    mediaType: 'graphic',
    prompt: '(best quality, masterpiece, 8k:1.2), (minimalist line art:1.3), (clean continuous line:1.2), (vector style:1.1), (black lines on white:1.1), elegant, simple',
    negativePrompt: '(worst quality, low quality:1.4), (sketchy, messy), (colored), (shaded, 3D, realistic), (complex background)',
    description: 'Đường đơn giản, phác thảo nét, nền trắng',
    thumbnail: '2d_simple_line.png',
  },
  {
    id: '2d_comic',
    name: '2D Truyện Tranh Mỹ',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (American comic book style:1.3), (Marvel/DC comic style:1.2), (halftone dots, hatching:1.1), (dynamic action, speech bubbles:1.1), vibrant ink',
    negativePrompt: '(worst quality, low quality:1.4), (manga style), (chibi), (3D, realistic), (watercolor), (blurry)',
    description: 'Truyện tranh Mỹ, lưới halftone, phong cách Marvel/DC',
    thumbnail: '2d_comic.png',
  },
  {
    id: '2d_shoujo',
    name: '2D Shoujo',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (classic Shoujo manga style:1.3), (delicate thin lines:1.2), (flowery background, screentones:1.1), (emotional expression:1.1), beautiful, romantic',
    negativePrompt: '(worst quality, low quality:1.4), (shonen style), (thick bold lines), (3D, realistic), (dark, horror), ugly',
    description: 'Truyện tranh shoujo truyền thống, nét vẽ tinh tế, nền hoa lá',
    thumbnail: '2d_shoujo.png',
  },
  {
    id: '2d_horror',
    name: '2D Kinh Dị',
    category: '2d',
    mediaType: 'animation',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Junji Ito horror manga:1.3), (grotesque art style:1.2), (heavy black ink, spirals:1.1), (creepy atmosphere:1.1), body horror, nightmare',
    negativePrompt: '(worst quality, low quality:1.4), (cute, happy), (bright colors), (3D, realistic), (soft), safe',
    description: 'Phong cách Ito Junji, truyện tranh kinh dị, xoắn ốc, kỳ quái',
    thumbnail: '2d_horror.png',
  },
];

// ============================================================
// Phong cách người thật
// ============================================================

const STYLES_REAL: StylePreset[] = [
  {
    id: 'real_movie',
    name: 'Người Thật - Điện Ảnh',
    category: 'real',
    mediaType: 'cinematic',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (cinematic movie still:1.3), (35mm film grain:1.2), (dramatic movie lighting:1.1), (color graded:1.1), photorealistic, depth of field',
    negativePrompt: '(worst quality, low quality:1.4), (3D render, cgi, game), (anime, illustration, painting), (cartoon), artificial, fake',
    description: 'Khung hình tĩnh điện ảnh, cảm giác phim, chỉnh màu điện ảnh',
    thumbnail: 'real_movie.png',
  },
  {
    id: 'real_costume',
    name: 'Người Thật - Cổ Trang',
    category: 'real',
    mediaType: 'cinematic',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Chinese period drama style:1.3), (Hanfu traditional costume:1.2), (exquisite embroidery:1.1), (elegant ancient setting:1.1), photorealistic, cinematic lighting',
    negativePrompt: '(worst quality, low quality:1.4), (modern clothing, glasses, watch), (3D render, anime), (western background), ugly',
    description: 'Phong cách phim cổ trang, hanfu, chụp ảnh cổ phong',
    thumbnail: 'real_costume.png',
  },
  {
    id: 'real_hk_retro',
    name: 'Người Thật - Hồng Kông Cổ',
    category: 'real',
    mediaType: 'cinematic',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (90s Hong Kong movie style:1.3), (Wong Kar-wai aesthetic:1.2), (neon lights, high contrast:1.1), (motion blur, film grain:1.1), dreamy, moody',
    negativePrompt: '(worst quality, low quality:1.4), (modern digital look), (clean, sharp, sterile), (3D, anime), (bright daylight), ugly',
    description: 'Cổ điển Hồng Kông, phong cách Vương Gia Vệ, đèn neon, phim thập niên 90',
    thumbnail: 'real_hk_retro.png',
  },
  {
    id: 'real_wuxia',
    name: 'Người Thật - Võ Hiệp',
    category: 'real',
    mediaType: 'cinematic',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Shaw Brothers Wuxia style:1.3), (vintage kung fu movie:1.2), (martial arts pose:1.1), (retro film aesthetic:1.1), photorealistic, cinematic',
    negativePrompt: '(worst quality, low quality:1.4), (fantasy effects, cgi), (modern clothing), (anime, 3D), (high fancy tech), ugly',
    description: 'Phim võ hiệp cổ điển, phong cách điện ảnh Shaw Brothers',
    thumbnail: 'real_wuxia.png',
  },
  {
    id: 'real_bloom',
    name: 'Người Thật - Ánh Hào Quang',
    category: 'real',
    mediaType: 'cinematic',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (dreamy soft focus photography:1.3), (strong bloom, lens flare:1.2), (backlit by sun:1.1), (ethereal lighting:1.1), photorealistic, angelic',
    negativePrompt: '(worst quality, low quality:1.4), (sharp, harsh contrast), (dark, gloomy), (anime, 3D), (flat lighting), ugly',
    description: 'Ánh hào quang lãng mạn, ngược sáng, hiệu ứng ánh sáng mộng mơ',
    thumbnail: 'real_bloom.png',
  },
];

// ============================================================
// Phong cách Stop Motion
// ============================================================

const STYLES_STOP_MOTION: StylePreset[] = [
  {
    id: 'stop_motion',
    name: 'Stop Motion',
    category: 'stop_motion',
    mediaType: 'stop-motion',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (stop motion animation style:1.3), (claymation texture:1.2), (handmade props:1.1), (frame by frame look:1.1), tactile, studio lighting',
    negativePrompt: '(worst quality, low quality:1.4), (fluid computer animation, cgi), (2D, anime), (smooth digital texture), ugly',
    description: 'Tên gọi chung của stop motion',
    thumbnail: 'stop_motion.png',
  },
  {
    id: 'figure_stop_motion',
    name: 'Stop Motion Mô Hình',
    category: 'stop_motion',
    mediaType: 'stop-motion',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (PVC action figure photography:1.3), (toy photography:1.2), (plastic texture, sub-surface scattering:1.1), (macro photography, depth of field:1.1), realistic toy',
    negativePrompt: '(worst quality, low quality:1.4), (human skin texture), (2D, anime), (drawing, sketch), (life size), ugly',
    description: 'Chất cảm mô hình nhựa, chất liệu PVC, chụp ảnh đồ chơi',
    thumbnail: 'figure_stop_motion.png',
  },
  {
    id: 'clay_stop_motion',
    name: 'Stop Motion Đất Sét',
    category: 'stop_motion',
    mediaType: 'stop-motion',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Aardman style claymation:1.3), (plasticine material:1.2), (visible fingerprints and imperfections:1.1), (soft clay texture:1.1), handmade, cute',
    negativePrompt: '(worst quality, low quality:1.4), (smooth plastic), (3D render, shiny), (2D, anime), (realistic human), ugly',
    description: 'Chất cảm đất sét, đất nặn, chi tiết vân tay',
    thumbnail: 'clay_stop_motion.png',
  },
  {
    id: 'lego_stop_motion',
    name: 'Stop Motion LEGO',
    category: 'stop_motion',
    mediaType: 'stop-motion',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (Lego stop motion:1.3), (plastic brick texture:1.2), (construction toy aesthetic:1.1), (macro lens:1.1), toy world, vibrant',
    negativePrompt: '(worst quality, low quality:1.4), (melted, curved shapes), (clay, soft), (2D, anime), (realistic), ugly',
    description: 'Phong cách LEGO, chất cảm nhựa',
    thumbnail: 'lego_stop_motion.png',
  },
  {
    id: 'felt_stop_motion',
    name: 'Stop Motion Len',
    category: 'stop_motion',
    mediaType: 'stop-motion',
    prompt: '(best quality, masterpiece, 8k, high detailed:1.2), (needle felting animation:1.3), (wool texture, fuzzy:1.2), (soft fabric material:1.1), (handmade craft:1.1), warm atmosphere, cute',
    negativePrompt: '(worst quality, low quality:1.4), (hard plastic), (smooth, shiny), (2D, anime), (realistic), ugly',
    description: 'Chất cảm len lông cừu, chất liệu nhung, mềm mại dễ thương',
    thumbnail: 'felt_stop_motion.png',
  },
];

// ============================================================
// Xuất
// ============================================================

/** Tất cả phong cách mặc định */
export const VISUAL_STYLE_PRESETS: readonly StylePreset[] = [
  ...STYLES_3D,
  ...STYLES_2D,
  ...STYLES_REAL,
  ...STYLES_STOP_MOTION,
] as const;

// ============================================================
// Tra cứu phong cách tuỳ chỉnh (dữ liệu người dùng, lưu trong localStorage)
// Chấp nhận callback để tránh tệp hằng số phụ thuộc trực tiếp vào zustand store
// ============================================================
let _customStyleLookup: ((id: string) => StylePreset | undefined) | null = null;

/**
 * Đăng ký hàm tra cứu phong cách tuỳ chỉnh (do custom-style-store gọi)
 * Phong cách tuỳ chỉnh là tài sản của người dùng, không chứa trong bộ preset nội bộ
 */
export function registerCustomStyleLookup(fn: (id: string) => StylePreset | undefined) {
  _customStyleLookup = fn;
}

/** Nội bộ: tìm trong preset trước, rồi tìm trong tuỳ chỉnh */
function _findStyle(styleId: string): StylePreset | undefined {
  return VISUAL_STYLE_PRESETS.find(s => s.id === styleId)
    || _customStyleLookup?.(styleId);
}

/** Thông tin phân loại */
export const STYLE_CATEGORIES: { id: StyleCategory; name: string; styles: readonly StylePreset[] }[] = [
  { id: '3d', name: 'Phong cách 3D', styles: STYLES_3D },
  { id: '2d', name: 'Hoạt hình 2D', styles: STYLES_2D },
  { id: 'real', name: 'Người thật', styles: STYLES_REAL },
  { id: 'stop_motion', name: 'Stop Motion', styles: STYLES_STOP_MOTION },
];

/** Lấy phong cách theo ID (preset + tuỳ chỉnh) */
export function getStyleById(styleId: string): StylePreset | undefined {
  return _findStyle(styleId);
}

/** Lấy prompt của phong cách (trả về chuỗi rỗng khi styleId rỗng, không áp phong cách) */
export function getStylePrompt(styleId: string | null | undefined): string {
  if (!styleId) return '';
  const style = _findStyle(styleId);
  return style?.prompt || '';
}

/** Lấy prompt tiêu cực của phong cách */
export function getStyleNegativePrompt(styleId: string | null | undefined): string {
  if (!styleId) return '';
  const style = _findStyle(styleId);
  return style?.negativePrompt || '';
}

/** Lấy tên phong cách */
export function getStyleName(styleId: string): string {
  const style = _findStyle(styleId);
  return style?.name || styleId;
}

/** Lấy đường dẫn thumbnail của phong cách */
export function getStyleThumbnail(styleId: string): string {
  const style = _findStyle(styleId);
  return style?.thumbnail || VISUAL_STYLE_PRESETS[0].thumbnail;
}

/**
 * Tương thích ngược: Lấy tokens của phong cách (tách thành mảng)
 * @deprecated Nên dùng getStylePrompt trực tiếp
 */
export function getStyleTokens(styleId: string): string[] {
  const prompt = getStylePrompt(styleId);
  return prompt
    .replace(/\([^)]*:[0-9.]+\)/g, (match) => match.replace(/:[0-9.]+\)/, ')'))
    .split(',')
    .map(s => s.trim().replace(/^\(|\)$/g, ''))
    .filter(s => s.length > 0)
    .slice(0, 8);
}

/**
 * Lấy danh sách phong cách theo phân loại
 * @param categoryId ID phân loại (hỗ trợ tên phiên bản cũ 'animation'/'realistic' và tên mới)
 */
export function getStylesByCategory(categoryId: string): StylePreset[] {
  const categoryMap: Record<string, StyleCategory[]> = {
    'animation': ['3d', '2d', 'stop_motion'],
    'realistic': ['real'],
    '3d': ['3d'],
    '2d': ['2d'],
    'real': ['real'],
    'stop_motion': ['stop_motion'],
  };

  const targetCategories = categoryMap[categoryId] || [categoryId as StyleCategory];
  return VISUAL_STYLE_PRESETS.filter(s => targetCategories.includes(s.category));
}

/** Lấy mô tả phong cách */
export function getStyleDescription(styleId: string): string {
  const style = _findStyle(styleId);
  return style?.description || style?.name || styleId;
}

/**
 * Lấy loại media theo ID phong cách
 * @returns MediaType tương ứng, mặc định 'cinematic' nếu không tìm thấy
 */
export function getMediaType(styleId: string | null | undefined): MediaType {
  if (!styleId) return 'cinematic';
  const style = _findStyle(styleId);
  return style?.mediaType ?? 'cinematic';
}

/** Nhãn loại media */
export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  'cinematic': 'Quay phim điện ảnh',
  'animation': 'Hoạt hình',
  'stop-motion': 'Stop motion',
  'graphic': 'Đồ hoạ',
};

/** Kiểu ID phong cách */
export type VisualStyleId = typeof VISUAL_STYLE_PRESETS[number]['id'];

/** ID phong cách mặc định */
export const DEFAULT_STYLE_ID: VisualStyleId = '2d_ghibli';
