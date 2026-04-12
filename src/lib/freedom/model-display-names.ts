/**
 * Mô hình\u53cb\u597dtênmap\u8868
 * API ID → Người dùng\u53ef\u8bfbcủa\u663e\u793atên
 *
 * \u6570\u636eNguồn: https://memefast.top/api/pricing_new (2026-02-19)
 * \u4e0d\u5728\u6b64\u8868trongcủaMô hình\u76f4\u63a5\u663e\u793anguyên bản ID
 */

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // ==================== \u56fe\u50cfMô hình ====================

  // --- Google / Gemini ---
  'gemini-3.1-pro-image-preview': 'Nano Banana 2 (Gemini 3.1 Pro)',
  'gemini-3-pro-image-preview': 'Nano Banana Pro (Gemini 3 Pro)',
  'gemini-2.5-flash-image': 'Nano Banana (Gemini 2.5 Flash)',
  'gemini-2.5-flash-image-preview': 'Nano Banana Preview (Gemini 2.5 Flash)',
  'aigc-image-gem': 'AIGC Gemini \u7ed8\u56fe',
  'aigc-image-qwen': 'AIGC Qwen \u7ed8\u56fe',

  // --- OpenAI / GPT ---
  'gpt-image-1.5': 'GPT Image 1.5',
  'gpt-image-1.5-all': 'GPT Image 1.5 (\u9006\u5411)',
  'gpt-image-1': 'GPT Image 1',
  'gpt-image-1-all': 'GPT Image 1 (\u9006\u5411)',
  'gpt-image-1-mini': 'GPT Image 1 Mini',
  'gpt-4o-image-vip': 'GPT-4o Image VIP',
  'sora_image': 'Sora Hình ảnhTạo',

  // --- Qwen / \u901a\u4e49ngàn\u95ee ---
  'qwen-image-edit-2509': 'Qwen \u56fe\u50cfChỉnh sửa',
  'qwen-image-max': '\u901a\u4e49\u4e07\u76f8 Max',
  'qwen-image-max-2025-12-30': '\u901a\u4e49\u4e07\u76f8 Max (2025-12-30)',
  'qwen-image-plus': '\u901a\u4e49\u4e07\u76f8 Plus',
  'z-image-turbo': 'Z-Image Turbo',

  // --- Flux ---
  'flux-dev': 'Flux Dev',
  'flux.1-dev': 'Flux.1 Dev',
  'flux-schnell': 'Flux Schnell',
  'flux-pro': 'Flux Pro',
  'flux-1.1-pro': 'Flux 1.1 Pro',
  'flux-pro-1.1-ultra': 'Flux 1.1 Pro Ultra',
  'flux-kontext-pro': 'Flux Kontext Pro',
  'flux.1-kontext-pro': 'Flux.1 Kontext Pro',
  'flux-kontext-max': 'Flux Kontext Max',
  'flux.1-kontext-dev': 'Flux.1 Kontext Dev',
  'flux-kontext-dev': 'Flux Kontext Dev',
  'flux-kontext-dev-lora': 'Flux Kontext Dev LoRA',
  'flux-dev-lora': 'Flux Dev LoRA',
  'flux-redux': 'Flux Redux (Phong cách\u8fc1\u79fb)',
  'flux-2-dev': 'Flux 2 Dev',
  'flux-2-pro': 'Flux 2 Pro',

  // --- Fal-ai ---
  'fal-ai/flux-1/dev': 'Flux.1 Dev (fal)',
  'fal-ai/flux-lora': 'Flux LoRA (fal)',
  'fal-ai/flux-pro/kontext': 'Flux Kontext Pro (fal)',
  'fal-ai/flux-pro/kontext/text-to-image': 'Flux Kontext Pro T2I (fal)',
  'fal-ai/flux-pro/kontext/max': 'Flux Kontext Max (fal)',
  'fal-ai/flux-pro/kontext/max/text-to-image': 'Flux Kontext Max T2I (fal)',
  'fal-ai/flux-pro/v1.1-ultra': 'Flux 1.1 Pro Ultra (fal)',
  'fal-ai/flux-pro/v1.1-ultra-finetuned': 'Flux 1.1 Pro Ultra \u5fae\u8c03 (fal)',
  'fal-ai/flux-pro/new': 'Flux Pro New (fal)',
  'fal-ai/flux-realism': 'Flux Realism (fal)',
  'fal-ai/recraft-v3': 'Recraft V3 (fal)',
  'fal-ai/ideogram/v3': 'Ideogram V3 (fal)',
  'fal-ai/ideogram/v2': 'Ideogram V2 (fal)',
  'fal-ai/ideogram/v2/turbo': 'Ideogram V2 Turbo (fal)',
  'fal-ai/stable-diffusion-v35-large': 'SD 3.5 Large (fal)',
  'fal-ai/stable-diffusion-v35-large-turbo': 'SD 3.5 Large Turbo (fal)',
  'fal-ai/stable-diffusion-v35-medium': 'SD 3.5 Medium (fal)',
  'fal-ai/hidream-i1-full': 'HiDream I1 Full (fal)',
  'fal-ai/hidream-i1-dev': 'HiDream I1 Dev (fal)',
  'fal-ai/hidream-i1-fast': 'HiDream I1 Fast (fal)',
  'fal-ai/nano-banana': 'Nano Banana (fal)',

  // --- Midjourney ---
  'midjourney': 'Midjourney \u7ed8\u56fe',
  'niji-6': 'Niji 6 \u7ed8\u56fe',
  'mj-chat': 'Midjourney Chat',
  'mj-video': 'Midjourney Video',
  'mj-video-extend': 'Midjourney Videomở rộng',
  'mj-video-upscale': 'Midjourney Video\u653e\u5927',
  'mj-editor': 'Midjourney Chỉnh sửa',
  'mj-inpaint': 'Midjourney \u5c40\u90e8\u91cd\u7ed8',
  'mj-outpaint': 'Midjourney Bên ngoài\u6269',
  'mj-pan': 'Midjourney \u5e73\u79fb\u6269\u5c55',
  'mj-upscale': 'Midjourney \u653e\u5927',
  'mj-variation': 'Midjourney thay đổi\u4f53',
  'mj-zoom': 'Midjourney Thu phóng',
  'mj_imagine': 'Midjourney \u7ed8\u56fe',
  'mj_blend': 'Midjourney \u6df7\u5408chế độ',
  'mj_describe': 'Midjourney Hình ảnhMô tả',
  'mj_shorten': 'Midjourney Prompt\u7cbe\u7b80',
  'mj_uploads': 'Midjourney Hình ảnhTải lên',
  'mj_action': 'Midjourney Hành động',
  'mj_modal': 'Midjourney \u5f39cửa sổ\u63d0\u4ea4',
  'mj_fetch': 'Midjourney Nhiệm vụTruy vấn',
  'mj_notify': 'Midjourney gọi lạiThông báo',

  // --- Ideogram ---
  'ideogram_generate_V_1': 'Ideogram V1',
  'ideogram_generate_V_1_TURBO': 'Ideogram V1 Turbo',
  'ideogram_generate_V_2': 'Ideogram V2',
  'ideogram_generate_V_3_TURBO': 'Ideogram V3 Turbo',
  'ideogram_edit_V_3_DEFAULT': 'Ideogram V3 Chỉnh sửa',
  'ideogram_edit_V_3_QUALITY': 'Ideogram V3 Chỉnh sửa Quality',
  'ideogram_edit_V_3_TURBO': 'Ideogram V3 Chỉnh sửa Turbo',
  'ideogram_remix_V_1': 'Ideogram V1 Remix',
  'ideogram_remix_V_1_TURBO': 'Ideogram V1 Remix Turbo',
  'ideogram_remix_V_2': 'Ideogram V2 Remix',
  'ideogram_remix_V_2_TURBO': 'Ideogram V2 Remix Turbo',
  'ideogram_remix_V_3_DEFAULT': 'Ideogram V3 Remix',
  'ideogram_remix_V_3_QUALITY': 'Ideogram V3 Remix Quality',
  'ideogram_remix_V_3_TURBO': 'Ideogram V3 Remix Turbo',
  'ideogram_reframe_V_3_DEFAULT': 'Ideogram V3 Reframe',
  'ideogram_reframe_V_3_QUALITY': 'Ideogram V3 Reframe Quality',
  'ideogram_reframe_V_3_TURBO': 'Ideogram V3 Reframe Turbo',
  'ideogram_replace_background_V_3_DEFAULT': 'Ideogram V3 Nềnthay thế',
  'ideogram_replace_background_V_3_QUALITY': 'Ideogram V3 Nềnthay thế Quality',
  'ideogram_replace_background_V_3_TURBO': 'Ideogram V3 Nềnthay thế Turbo',
  'ideogram_describe': 'Ideogram \u56fe\u751f\u6587',
  'ideogram_upscale': 'Ideogram \u653e\u5927',
  'ideogram_generate_V_3_DEFAULT': 'Ideogram V3',
  'ideogram_generate_V_3_QUALITY': 'Ideogram V3 Quality',
  'ideogram_generate_V_3_SPEED': 'Ideogram V3 Speed',
  'ideogram_generate_V_2_DEFAULT': 'Ideogram V2',
  'ideogram_generate_V_2_QUALITY': 'Ideogram V2 Quality',
  'ideogram_generate_V_2_SPEED': 'Ideogram V2 Speed',
  'ideogram_generate_V_2_TURBO': 'Ideogram V2 Turbo',

  // --- Doubao / \u8c46\u5305 / Seedream ---
  'doubao-seedream-4-0-250828': 'Seedream 4.0',
  'doubao-seedream-4-5-251128': 'Seedream 4.5',
  'doubao-seedream-3-0-t2i-250415': 'Seedream 3.0',
  'doubao-seededit-3-0-i2i-250628': 'SeedEdit 3.0 (\u56fe\u751f\u56fe)',

  // --- Kling / \u53ef\u7075 ---
  'kling-image': 'Kling Hình ảnhTạo',
  'kling-omni-image': 'Kling Omni Hình ảnh',
  'kling-image-recognize': 'Kling \u56fe\u50cf\u8bc6\u522b',
  // Kling Hình ảnhMô hìnhPhiên bản (MemeFast model_version)
  'kling-image-v1': 'Kling Hình ảnh V1',
  'kling-image-v1-5': 'Kling Hình ảnh V1.5',
  'kling-image-v2': 'Kling Hình ảnh V2',
  'kling-image-v2-new': 'Kling Hình ảnh V2 New',
  'kling-image-v2-1': 'Kling Hình ảnh V2.1',

  // --- Grok / xAI ---
  'grok-3-image': 'Grok 3 Image',
  'grok-4-image': 'Grok 4 Image',

  // --- Recraft ---
  'recraft-v3': 'Recraft V3',

  // --- Stability / SD ---
  'stable-diffusion-3-5-large': 'SD 3.5 Large',
  'stable-diffusion-3-5-large-turbo': 'SD 3.5 Large Turbo',
  'stable-diffusion-3-5-medium': 'SD 3.5 Medium',

  // --- HiDream ---
  'hidream-i1-full': 'HiDream I1 Full',
  'hidream-i1-dev': 'HiDream I1 Dev',
  'hidream-i1-fast': 'HiDream I1 Fast',

  // --- Leonardo ---
  'leonardo-image': 'Leonardo Hình ảnhTạo',

  // --- DeepSeek ---
  'deepseek-ocr': 'DeepSeek OCR',

  // --- Recraftv3 (dall-e-3 Định dạng) ---
  'recraftv3': 'Recraft V3 (dall-e-3)',

  // --- Kolors ---
  'kolors': 'Kolors \u53ef\u56fe',

  // --- SiliconFlow ---
  'SiliconFlow-flux-1-schnell': 'Flux Schnell (SiliconFlow)',
  'SiliconFlow-flux-1-dev': 'Flux Dev (SiliconFlow)',
  'SiliconFlow-sd-3-5-large': 'SD 3.5 Large (SiliconFlow)',
  'SiliconFlow-sd-3-5-large-turbo': 'SD 3.5 Large Turbo (SiliconFlow)',
  'SiliconFlow-kolors': 'Kolors \u53ef\u56fe (SiliconFlow)',

  // --- Replicate ---
  'replicate-flux-1.1-pro': 'Flux 1.1 Pro (Replicate)',
  'replicate-flux-1.1-pro-ultra': 'Flux 1.1 Pro Ultra (Replicate)',
  'replicate-flux-dev': 'Flux Dev (Replicate)',
  'replicate-flux-schnell': 'Flux Schnell (Replicate)',

  // ==================== Âm thanhVideoMô hình ====================

  // --- Google / Veo ---
  'veo3.1': 'Veo 3.1',
  'veo3.1-4k': 'Veo 3.1 4K',
  'veo3.1-pro': 'Veo 3.1 Pro',
  'veo3.1-pro-4k': 'Veo 3.1 Pro 4K',
  'veo3.1-fast': 'Veo 3.1 Fast',
  'veo3.1-components': 'Veo 3.1 Chất liệu\u5408\u6210',
  'veo3.1-components-4k': 'Veo 3.1 Chất liệu\u5408\u6210 4K',
  'veo3.1-fast-components': 'Veo 3.1 Fast Chất liệu\u5408\u6210',
  'veo3': 'Veo 3',
  'veo3-fast': 'Veo 3 Fast',
  'veo3-pro': 'Veo 3 Pro',
  'veo3-fast-frames': 'Veo 3 Fast \u9996\u5c3e\u5e27',
  'veo3-frames': 'Veo 3 \u9996\u5c3e\u5e27',
  'veo3-pro-frames': 'Veo 3 Pro \u9996\u5c3e\u5e27',
  'veo2': 'Veo 2',
  'veo2-fast': 'Veo 2 Fast',
  'veo2-fast-components': 'Veo 2 Fast Chất liệu\u5408\u6210',
  'veo2-fast-frames': 'Veo 2 Fast \u9996\u5c3e\u5e27',
  'veo2-pro': 'Veo 2 Pro',
  'veo2-pro-components': 'Veo 2 Pro Chất liệu\u5408\u6210',
  // veo_ Gạch chânĐịnh dạng（\u540cMô hình\u4e0d\u540c\u7aef\u70b9）
  'veo_3_1': 'Veo 3.1 (\u5f02\u6b65)',
  'veo_3_1-4K': 'Veo 3.1 4K (\u5f02\u6b65)',
  'veo_3_1-fast': 'Veo 3.1 Fast (\u5f02\u6b65)',
  'veo_3_1-fast-4K': 'Veo 3.1 Fast 4K (\u5f02\u6b65)',
  'veo_3_1-components': 'Veo 3.1 Chất liệu\u5408\u6210 (\u5f02\u6b65)',
  'veo_3_1-components-4K': 'Veo 3.1 Chất liệu\u5408\u6210 4K (\u5f02\u6b65)',
  'veo_3_1-fast-components': 'Veo 3.1 Fast Chất liệu\u5408\u6210 (\u5f02\u6b65)',
  'veo_3_1-fast-components-4K': 'Veo 3.1 Fast Chất liệu\u5408\u6210 4K (\u5f02\u6b65)',

  // --- Google TTS ---
  'gemini-2.5-flash-preview-tts': 'Gemini 2.5 Flash TTS',
  'gemini-2.5-pro-preview-tts': 'Gemini 2.5 Pro TTS',

  // --- OpenAI / Sora ---
  'sora-2': 'Sora 2',
  'sora-2-pro': 'Sora 2 Pro',
  'sora-2-all': 'Sora 2 (\u9006\u5411)',
  'sora-2-pro-all': 'Sora 2 Pro (\u9006\u5411)',
  'sora-2-vip-all': 'Sora 2 VIP (\u9006\u5411)',

  // --- Wan / \u4e07\u76f8 ---
  'wan2.5-i2v-preview': '\u4e07\u76f8 2.5 \u56fe\u751fVideo（Xem trước）',
  'wan2.6-i2v': '\u4e07\u76f8 2.6 \u56fe\u751fVideo',
  'wan2.6-i2v-flash': '\u4e07\u76f8 2.6 \u56fe\u751fVideo Flash',

  // --- Grok Video ---
  'grok-video-3': 'Grok Video 3',
  'grok-video-3-10s': 'Grok Video 3 (10s)',
  'grok-video-3-15s': 'Grok Video 3 (15s)',

  // --- Kling / \u53ef\u7075 ---
  'kling-video': 'Kling \u6587\u751fVideo',
  'kling-omni-video': 'Kling Omni Video',
  'kling-video-extend': 'Kling Videomở rộng',
  'kling-motion-control': 'Kling Hành động\u63a7\u5236',
  'kling-multi-elements': 'Kling \u591aphần tử\u5408\u6210',
  'kling-avatar-image2video': 'Kling Avatar \u56fe\u751fVideo',
  'kling-advanced-lip-sync': 'Kling Nâng cao\u53e3\u578b\u540c\u6b65',
  'kling-effects': 'Kling Hiệu ứng',
  'kling-audio': 'Kling Âm thanhTạo',
  'kling-custom-voices': 'Kling Tuỳ chỉnh\u97f3\u8272',
  'kling-custom-elements': 'Kling Tuỳ chỉnhChúa ơi\u4f53',
  // Kling VideoMô hìnhPhiên bản (MemeFast model_version)
  'kling-v1': 'Kling V1',
  'kling-v1-5': 'Kling V1.5',
  'kling-v1-6': 'Kling V1.6',
  'kling-v2-master': 'Kling V2 Master',
  'kling-v2-1': 'Kling V2.1',
  'kling-v2-1-master': 'Kling V2.1 Master',
  'kling-v2-5-turbo': 'Kling V2.5 Turbo',
  'kling-v2-6': 'Kling V2.6',

  // --- Doubao / \u8c46\u5305 / Seedance ---
  'doubao-seedance-1-0-pro-250528': 'Seedance 1.0 Pro',
  'doubao-seedance-1-0-pro-fast-251015': 'Seedance 1.0 Pro Fast',
  'doubao-seedance-1-0-lite-t2v-250428': 'Seedance 1.0 Lite T2V',
  'doubao-seedance-1-0-lite-i2v-250428': 'Seedance 1.0 Lite I2V',
  'doubao-seedance-1-5-pro-250428': 'Seedance 1.5 Pro',
  'doubao-seedance-1-5-pro-251215': 'Seedance 1.5 Pro',
  'doubao-seedance-1-0-lite-250428': 'Seedance 1.0 Lite',
  'doubao-seedance-1-0-pro-250428': 'Seedance 1.0 Pro',
  'doubao-seedance-1-5-lite-251215': 'Seedance 1.5 Lite',
  'doubao-seedance-1-5-pro-i2v-251215': 'Seedance 1.5 Pro \u56fe\u751fVideo',

  // --- Vidu ---
  'vidu2.0': 'Vidu 2.0',
  'viduq1': 'Vidu Q1',
  'viduq1-classic': 'Vidu Q1 Classic',
  'viduq2': 'Vidu Q2',
  'viduq2-pro': 'Vidu Q2 Pro',
  'viduq2-turbo': 'Vidu Q2 Turbo',
  'viduq3-pro': 'Vidu Q3 Pro',
  'aigc-video-vidu': 'Vidu（AIGC \u805a\u5408）',
  'vidu-video': 'Vidu VideoTạo',
  'vidu-video-ref': 'Vidu Tài liệu tham khảoVideo',
  'vidu-video-character': 'Vidu Nhân vậtVideo',
  'vidu-video-character-ref': 'Vidu Nhân vậsự phản bộiVideo',
  'vidu-video-scene': 'Vidu CảnhVideo',
  'vidu-video-scene-ref': 'Vidu Cảnh tham khảoVideo',
  'vidu-video-lip-sync': 'Vidu \u53e3\u578b\u540c\u6b65',

  // --- MiniMax / Hailuo ---
  'MiniMax-Hailuo-02': 'Hailuo 02',
  'MiniMax-Hailuo-2.3': 'Hailuo 2.3',
  'MiniMax-Hailuo-2.3-Fast': 'Hailuo 2.3 Fast',
  'aigc-video-hailuo': 'Hailuo（AIGC \u805a\u5408）',
  'minimax/video-01': 'MiniMax Video-01',
  'minimax/video-01-live': 'MiniMax Video-01 Live',
  'MiniMax-Hailuo-02-standard': 'Hailuo 02 Standard',
  'MiniMax-Hailuo-02-standard-i2v': 'Hailuo 02 Standard \u56fe\u751fVideo',
  'MiniMax-Hailuo-02-director': 'Hailuo 02 Director',
  'MiniMax-Hailuo-02-director-i2v': 'Hailuo 02 Director \u56fe\u751fVideo',
  'MiniMax-Hailuo-02-live': 'Hailuo 02 Live',
  'MiniMax-Hailuo-02-live-i2v': 'Hailuo 02 Live \u56fe\u751fVideo',

  // --- Runway ---
  'runwayml-gen3a_turbo-5': 'Runway Gen-3A Turbo 5s',
  'runwayml-gen3a_turbo-10': 'Runway Gen-3A Turbo 10s',
  'runwayml-gen4_turbo-5': 'Runway Gen-4 Turbo 5s',
  'runwayml-gen4_turbo-10': 'Runway Gen-4 Turbo 10s',
  'runway-gen4-turbo': 'Runway Gen-4 Turbo',
  'runway-gen4-turbo-i2v': 'Runway Gen-4 Turbo \u56fe\u751fVideo',
  'runway-gen3a-turbo': 'Runway Gen-3α Turbo',
  'runway-gen3a-turbo-i2v': 'Runway Gen-3α Turbo \u56fe\u751fVideo',

  // --- PixVerse ---
  'pixverse-v4': 'PixVerse V4',
  'pixverse-v4-i2v': 'PixVerse V4 \u56fe\u751fVideo',
  'pixverse-v3.5': 'PixVerse V3.5',
  'pixverse-v3.5-i2v': 'PixVerse V3.5 \u56fe\u751fVideo',

  // --- LTX ---
  'ltx-video': 'LTX Video',
  'ltx-video-i2v': 'LTX Video \u56fe\u751fVideo',

  // --- Luma ---
  'luma_video_api': 'Luma VideoTạo',
  'luma_video_extend_api': 'Luma Videomở rộng',
  'luma-video': 'Luma VideoTạo',
  'luma-video-ray2': 'Luma Ray 2',
  'luma-video-ray2-flash': 'Luma Ray 2 Flash',

  // --- Pika ---
  'pika-video': 'Pika VideoTạo',
  'pika-video-2.2': 'Pika 2.2',

  // --- Hunyuan / \u6df7\u5143 ---
  'hunyuan-video': '\u6df7\u5143Video',

  // --- CogVideoX ---
  'cogvideox': 'CogVideoX',

  // --- OpenAI Audio ---
  'gpt-4o-audio-preview': 'GPT-4o Audio Preview',
  'gpt-4o-audio-preview-2024-10-01': 'GPT-4o Audio (2024-10)',
  'gpt-4o-audio-preview-2024-12-17': 'GPT-4o Audio (2024-12)',
  'gpt-4o-mini-audio-preview': 'GPT-4o Mini Audio',
  'gpt-4o-mini-audio-preview-2024-12-17': 'GPT-4o Mini Audio (2024-12)',

  // --- TTS ---
  'tts-1': 'TTS-1',
  'tts-1-1106': 'TTS-1 (1106)',
  'tts-1-hd': 'TTS-1 HD',
  'tts-1-hd-1106': 'TTS-1 HD (1106)',
  'audio1.0': 'Audio 1.0 Tổng hợp giọng nói',

  // --- Whisper ---
  'whisper-1': 'Whisper \u8bed\u97f3\u8f6c\u6587từ',

  // --- SunoAI ---
  'suno_music': 'Suno âm nhạcTạo',
  'suno_lyrics': 'Suno \u6b4c\u8bcdTạo',
  'suno_upload': 'Suno Âm thanhTải lên',
  'suno_fetch': 'Suno Nhiệm vụTruy vấn',
};

/**
 * \u83b7\u53d6Mô hình\u53cb\u597d\u663e\u793atên
 * Ưu tiên\u67e5\u6620\u5c04\u8868，\u67e5\u4e0dĐếnQuay lạinguyên bản ID
 */
export function getModelDisplayName(modelId: string): string {
  return MODEL_DISPLAY_NAMES[modelId] ?? modelId;
}
