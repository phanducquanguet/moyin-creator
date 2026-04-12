// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.

/**
 * Thương hiệuĐăng ký\u8868 + Mô hình tên → Thương hiệu\u6620\u5c04
 * sử dụng\u4e8e\u670d\u52a1\u6620\u5c04\u9762\u677fThương hiệu\u5206\u7c7b\u9009\u62e9
 */

export interface BrandInfo {
  displayName: string;
  color: string; // fallback color for brand pill
}

/**
 * Thương hiệuĐăng ký\u8868
 * key: brandId, value: \u663e\u793atên + Chúa ơi\u8272
 */
export const BRAND_REGISTRY: Record<string, BrandInfo> = {
  openai:       { displayName: 'OpenAI',              color: '#10A37F' },
  anthropic:    { displayName: 'Anthropic',            color: '#D97757' },
  google:       { displayName: 'Google',               color: '#4285F4' },
  deepseek:     { displayName: 'DeepSeek',             color: '#4D6BFE' },
  zhipu:        { displayName: 'ChatGLM (\u667a\u8c31)',        color: '#3485FF' },
  doubao:       { displayName: 'Doubao (\u8c46\u5305)',         color: '#A569FF' },
  kling:        { displayName: 'Kling (\u53ef\u7075)',          color: '#04A6F0' },
  midjourney:   { displayName: 'Midjourney',           color: '#000000' },
  flux:         { displayName: 'Flux',                 color: '#333333' },
  grok:         { displayName: 'Grok (xAI)',           color: '#000000' },
  alibaba:      { displayName: 'Bailian (\u963f\u91cc\u4e91Trăm\u70bc)',   color: '#FF6A00' },
  moonshot:     { displayName: 'Moonshot',             color: '#5B5BD6' },
  minimax:      { displayName: 'Minimax',              color: '#E2167E' },
  ollama:       { displayName: 'Ollama',               color: '#333333' },
  mistral:      { displayName: 'Mistral',              color: '#FA500F' },
  hunyuan:      { displayName: '\u817e\u8baf',                  color: '#0055E9' },
  vidu:         { displayName: 'Vidu',                 color: '#333333' },
  replicate:    { displayName: 'Replicate',            color: '#333333' },
  wenxin:       { displayName: 'Wenxin (\u6587\u5fc3)',         color: '#0A51C3' },
  siliconcloud: { displayName: 'SiliconFlow (\u7845\u57fa\u6d41\u52a8)', color: '#7C3AED' },
  spark:        { displayName: 'Spark (\u8baf\u98de\u661f\u706b)',       color: '#3DC8F9' },
  fal:          { displayName: 'Fal-ai',               color: '#333333' },
  luma:         { displayName: 'Luma',                 color: '#4400AA' },
  runway:       { displayName: 'Runway',               color: '#333333' },
  ideogram:     { displayName: 'Ideogram',             color: '#333333' },
  suno:         { displayName: 'Suno',                 color: '#333333' },
  other:        { displayName: '\u5176\u4ed6',                  color: '#6B7280' },
};

/**
 * Mô hình tên\u524d\u7f00 → Thương hiệu\u6620\u5c04quy tắc
 * \u987a\u5e8fquan trọng：\u66f4\u5177\u4f53củachế độ\u5e94\u653e\u5728\u524d\u9762
 */
const BRAND_PATTERNS: Array<{ pattern: RegExp; brand: string }> = [
  // OpenAI \u7cfbCột
  { pattern: /^(gpt-|o[1-9]|dall-e|dalle|chatgpt|sora|codex)/i,       brand: 'openai' },
  { pattern: /^gpt[-_]?image/i,                                         brand: 'openai' },
  { pattern: /^(text-(embedding|babbage|curie|davinci|search)|davinci-|tts-|whisper)/i, brand: 'openai' },

  // Anthropic / Claude
  { pattern: /^claude/i,                                                 brand: 'anthropic' },

  // Google / Gemini / Imagen
  { pattern: /^(gemini|gemma|veo|palm|bard)/i,                          brand: 'google' },
  { pattern: /^google\//i,                                               brand: 'google' },

  // DeepSeek
  { pattern: /^deepseek/i,                                               brand: 'deepseek' },

  // \u667a\u8c31 ChatGLM
  { pattern: /^(glm|cogview|cogvideo|chatglm)/i,                        brand: 'zhipu' },

  // \u8c46\u5305 Doubao (ByteDance)
  { pattern: /^(doubao|seed[- ]?oss)/i,                                  brand: 'doubao' },
  // seedance (\u8c46\u5305Video) — must be before generic seed
  { pattern: /^(doubao-)?seed(ance|dream)/i,                             brand: 'doubao' },

  // Kling (\u53ef\u7075)
  { pattern: /^kling/i,                                                   brand: 'kling' },

  // Midjourney
  { pattern: /^(mj_|midjourney|niji)/i,                                     brand: 'midjourney' },

  // Flux (Black Forest Labs) — \u542b flux.1.x \u547dtênthay đổi\u4f53
  { pattern: /^(flux[-_.]|black-forest)/i,                                 brand: 'flux' },

  // Grok (xAI)
  { pattern: /^grok/i,                                                    brand: 'grok' },

  // \u963f\u91cc\u5df4\u5df4 / Qwen / \u901a\u4e49 / QVQ / QWQ
  { pattern: /^(qwen|wan|tongyi|alibaba|bailian|qvq|qwq)/i,           brand: 'alibaba' },

  // Moonshot / Kimi
  { pattern: /^(moonshot|kimi)/i,                                         brand: 'moonshot' },

  // MiniMax / biển\u87ba / speech / audio / mimo
  { pattern: /^(minimax|MiniMax|hailuo|speech-|audio[0-9]|mimo)/i,       brand: 'minimax' },

  // Ollama / Llama / Meta
  { pattern: /^(ollama|llama|meta-llama)/i,                                brand: 'ollama' },

  // Mistral
  { pattern: /^(mistral|mixtral|dolphin)/i,                               brand: 'mistral' },

  // \u817e\u8baf\u6df7\u5143
  { pattern: /^hunyuan/i,                                                  brand: 'hunyuan' },

  // Vidu (\u751f\u6570\u79d1\u6280)
  { pattern: /^vidu/i,                                                     brand: 'vidu' },

  // Replicate (\u542b org/model \u547dtênĐịnh dạng)
  { pattern: /^(replicate|andreasjansson|stability-ai|cjwbw|lucataco|recraft-ai|riffusion|sujaykhandekar|prunaai)/i, brand: 'replicate' },

  // Trăm\u5ea6\u6587\u5fc3 ERNIE / Embedding-V1
  { pattern: /^(ernie|wenxin|Embedding-V)/i,                              brand: 'wenxin' },

  // \u7845\u57fa\u6d41\u52a8 SiliconCloud
  { pattern: /^(silicon|BAAI|Pro\/BAAI)/i,                                 brand: 'siliconcloud' },

  // \u8baf\u98de\u661f\u706b
  { pattern: /^(spark|sparkdesk)/i,                                        brand: 'spark' },

  // Fal-ai
  { pattern: /^fal[-_]ai\//i,                                              brand: 'fal' },

  // Luma
  { pattern: /^luma/i,                                                      brand: 'luma' },

  // Runway
  { pattern: /^(runway|runwayml)/i,                                         brand: 'runway' },

  // Ideogram
  { pattern: /^ideogram/i,                                                   brand: 'ideogram' },

  // Suno
  { pattern: /^suno/i,                                                       brand: 'suno' },

  // Pika
  { pattern: /^pika/i,                                                       brand: 'other' },

  // aigc-* (MemeFast \u805a\u5408)
  { pattern: /^aigc[-_]?(image|video)/i,                                     brand: 'other' },
];

/**
 * \u6839\u636eMô hìnhTêlần chiết tiếp theoThương hiệu ID
 */
export function extractBrandFromModel(modelName: string): string {
  for (const { pattern, brand } of BRAND_PATTERNS) {
    if (pattern.test(modelName)) return brand;
  }
  return 'other';
}

/**
 * \u83b7\u53d6Thương hiệuthông tin（\u542b fallback）
 */
export function getBrandInfo(brandId: string): BrandInfo {
  return BRAND_REGISTRY[brandId] || BRAND_REGISTRY['other'];
}
