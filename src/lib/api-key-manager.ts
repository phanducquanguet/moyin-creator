// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * API Key Manager with rotation and blacklist support
 * Based on AionUi's ApiKeyManager pattern
 */

// ==================== Types ====================

export type ModelCapability = 
  | 'text' 
  | 'vision' 
  | 'function_calling' 
  | 'image_generation' 
  | 'video_generation'
  | 'web_search' 
  | 'reasoning' 
  | 'embedding';

export interface IProvider {
  id: string;
  platform: string;
  name: string;
  baseUrl: string;
  apiKey: string; // Supports comma or newline separated multiple keys
  model: string[];
  capabilities?: ModelCapability[];
  contextLimit?: number;
}

/**
 * Default provider templates
 * Mặc địnhNhà cung cấp\u6a21\u677f
 * 
 * cốt lõiNhà cung cấp：
 * 1. API ma thuật (memefast) - Chuyển AI đầy đủ tính năng（Đề xuất），Hỗ trợ\u6587\u672c/Hình ảnh/Video/\u8bc6\u56fe
 * 2. RunningHub - Góc nhìnChuyển đổi/Đa góc Tạo
 */
export const DEFAULT_PROVIDERS: Omit<IProvider, 'id' | 'apiKey'>[] = [
  {
    platform: 'memefast',
    name: 'API ma thuật',
    baseUrl: 'https://memefast.top',
    model: [
      'deepseek-v3.2',
      'glm-4.7',
      'gemini-3-pro-preview',
      'gemini-3-pro-image-preview',
      'gpt-image-1.5',
      'doubao-seedance-1-5-pro-251215',
      'veo3.1',
      'sora-2-all',
      'wan2.6-i2v',
      'grok-video-3-10s',
      'claude-haiku-4-5-20251001',
    ],
    capabilities: ['text', 'vision', 'image_generation', 'video_generation'],
  },
  {
    platform: 'runninghub',
    name: 'RunningHub',
    baseUrl: 'https://www.runninghub.cn/openapi/v2',
    model: ['2009613632530812930'],
    capabilities: ['image_generation', 'vision'],
  },
];

// ==================== Model Classification ====================

/**
 * \u6839\u636eMô hìnhTênchế độsuy luậnMô hìnhkhả năng
 * sử dụng\u4e8e\u52a8\u6001\u540c\u6b65của 552+ Mô hình\u81ea\u52a8\u5206\u7c7b
 */
export function classifyModelByName(modelName: string): ModelCapability[] {
  const name = modelName.toLowerCase();

  // ---- VideoTạoMô hình ----
  const videoPatterns = [
    'veo', 'sora', 'wan', 'kling', 'runway', 'luma', 'seedance',
    'cogvideo', 'hunyuan-video', 'minimax-video', 'hailuo', 'pika',
    'gen-3', 'gen3', 'mochi', 'ltx',
  ];
  // \u7cbe\u786etrận đấu：grok-video \u7c7b
  if (/grok[- ]?video/.test(name)) return ['video_generation'];
  if (videoPatterns.some(p => name.includes(p))) return ['video_generation'];

  // ---- Hình ảnhTạoMô hình ----
  const imageGenPatterns = [
    'dall-e', 'dalle', 'flux', 'midjourney', 'niji', 'imagen', 'cogview',
    'gpt-image', 'ideogram', 'sd3', 'stable-diffusion', 'sdxl',
    'playground', 'recraft', 'kolors', 'seedream',
  ];
  if (imageGenPatterns.some(p => name.includes(p))) return ['image_generation'];
  // "xxx-image-preview" \u7c7b（Chẳng hạn như gemini-3-pro-image-preview）
  if (/image[- ]?preview/.test(name)) return ['image_generation'];

  // ---- \u89c6\u89c9/\u8bc6\u56feMô hình ----
  if (/vision/.test(name)) return ['text', 'vision'];

  // ---- TTS / Audio Mô hình（\u4e0d\u5f52\u5165\u4efb\u4f55Chúa ơi\u5206\u7c7b）----
  if (/tts|whisper|audio/.test(name)) return ['text'];

  // ---- Embedding Mô hình ----
  if (/embed/.test(name)) return ['embedding'];

  // ---- lý luận/nghĩMô hình（\u4ecd\u5f52\u5165 text）----
  if (/[- ](r1|thinking|reasoner|reason)/.test(name) || /^o[1-9]/.test(name)) return ['text', 'reasoning'];

  // ---- Mặc định：\u5bf9\u8bddMô hình ----
  return ['text'];
}

// ==================== Endpoint Routing ====================

/**
 * Mô hình API \u8c03sử dụngĐịnh dạng
 * Dựa trên MemeFast Đợi đã\u5e73\u53f0 /v1/models Quay lạtôi là supported_endpoint_types từ\u6bb5
 */
export type ModelApiFormat =
  | 'openai_chat'        // /v1/chat/completions （\u6587\u672c/\u5bf9\u8bdd，\u4e5fsử dụng\u4e8e Gemini Hình ảnhTạo）
  | 'openai_images'      // /v1/images/generations （Tiêu chuẩnHình ảnhTạo）
  | 'openai_video'       // /v1/videos/generations （Tiêu chuẩnVideoTạo）
  | 'kling_image'        // /kling/v1/images/generations hoặc /kling/v1/images/omni-image
  | 'unsupported';       // \u4e0dHỗ trợcủa\u7aef\u70b9Định dạng

// MemeFast supported_endpoint_types \u503c → \u6211\u4eecHình ảnh API Định dạng
const IMAGE_ENDPOINT_MAP: Record<string, ModelApiFormat> = {
  'image-generation': 'openai_images',
  'dall-e-3': 'openai_images',  // z-image-turbo, qwen-image-max Đợi đãđi /v1/images/generations
  'aigc-image': 'openai_images', // aigc-image-gem, aigc-image-qwen
  'openai': 'openai_chat',  // Chẳng hạn như gpt-image-1-all Chấp nhận chat completions \u751f\u56fe
};

// MemeFast supported_endpoint_types \u503c → \u6211\u4eeccủaVideo API Định dạngkhả năng\u5206\u7c7b
// Lưu ý：\u8fd9\u91cc\u7edfmột\u6620\u5c04cho 'openai_video' \u4ec5thể hiện「VideoTạoKhả năng」，\u5b9e\u9645 API \u8def\u7531\u7531 use-video-generation.ts trongcủa VIDEO_FORMAT_MAP \u51b3\u5b9a
const VIDEO_ENDPOINT_MAP: Record<string, ModelApiFormat> = {
  'Video\u7edfmộtĐịnh dạng': 'openai_video',
  'openAIVideoĐịnh dạng': 'openai_video',
  'openAI\u5b98\u65b9VideoĐịnh dạng': 'openai_video',
  '\u5f02\u6b65': 'openai_video',            // wan \u7cfbCột
  '\u8c46\u5305Video\u5f02\u6b65': 'openai_video',    // doubao-seedance \u7cfbCột
  'grokVideo': 'openai_video',          // grok-video
  '\u6587\u751fVideo': 'openai_video',          // kling \u6587\u751fVideo
  '\u56fe\u751fVideo': 'openai_video',          // kling \u56fe\u751fVideo
  'Videomở rộng': 'openai_video',          // kling Videomở rộng
  'biển\u87baVideoTạo': 'openai_video',    // MiniMax-Hailuo
  'lumaVideoTạo': 'openai_video',     // luma_video_api
  'lumaVideo\u6269\u5c55': 'openai_video',     // luma_video_extend
  'runway\u56fe\u751fVideo': 'openai_video',   // runwayml
  'aigc-video': 'openai_video',       // aigc-video-hailuo/kling/vidu
  'minimax/video-01\u5f02\u6b65': 'openai_video', // minimax/video-01
  'openai-response': 'openai_video',  // veo3-pro Đợi đã
};

/**
 * \u6839\u636eMô hình supported_endpoint_types \u786e\u5b9aHình ảnhTạoÁp dụngcủa API Định dạng
 * \u5f53\u7aef\u70b9\u5143\u6570\u636e\u4e0dCó sẵn\u65f6，\u6839\u636eMô hìnhTênsuy luận
 */
export function resolveImageApiFormat(endpointTypes: string[] | undefined, modelName?: string): ModelApiFormat {
  // 1. sử dụng API Quay lạtôi là\u7aef\u70b9\u5143\u6570\u636e
  if (endpointTypes && endpointTypes.length > 0) {
    // Ưu tiênsử dụng image-generation \u7aef\u70b9
    for (const t of endpointTypes) {
      if (IMAGE_ENDPOINT_MAP[t] === 'openai_images') return 'openai_images';
    }
    // \u5176lần\u5c1d\u8bd5 chat completions （Gemini \u591a\u6a21\u6001Hình ảnh）
    for (const t of endpointTypes) {
      if (IMAGE_ENDPOINT_MAP[t] === 'openai_chat') return 'openai_chat';
    }
    return 'unsupported';
  }

  // 2. Fallback: \u6839\u636eMô hìnhTênsuy luận API Định dạng
  if (modelName) {
    const name = modelName.toLowerCase();
    // Kling image models → native /kling/v1/images/* endpoint
    if (/^kling-(image|omni-image)$/i.test(name)) {
      return 'kling_image';
    }
    // Gemini image models → chat completions \u591a\u6a21\u6001
    if (name.includes('gemini') && (name.includes('image') || name.includes('imagen'))) {
      return 'openai_chat';
    }
    // GPT image, flux, dall-e, ideogram, sd, recraft → standard images API
    if (/gpt-image|flux|dall-e|dalle|ideogram|stable-diffusion|sdxl|sd3|recraft|kolors|cogview/.test(name)) {
      return 'openai_images';
    }
    // sora_image → openai chat
    if (name.includes('sora') && name.includes('image')) {
      return 'openai_chat';
    }
  }

  return 'openai_images'; // ultimate fallback
}

/**
 * \u6839\u636eMô hình supported_endpoint_types \u786e\u5b9aVideoTạoÁp dụngcủa API Định dạng
 */
export function resolveVideoApiFormat(endpointTypes: string[] | undefined): ModelApiFormat {
  if (!endpointTypes || endpointTypes.length === 0) return 'openai_video'; // fallback
  for (const t of endpointTypes) {
    const mapped = VIDEO_ENDPOINT_MAP[t];
    if (mapped) return mapped;
  }
  // nếu có openai Loại，\u4e5f\u8bd5sử dụngVideo\u7aef\u70b9
  if (endpointTypes.includes('openai')) return 'openai_video';
  return 'unsupported';
}

// ==================== Utilities ====================

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Parse API keys from a string (comma or newline separated)
 */
export function parseApiKeys(apiKey: string): string[] {
  if (!apiKey) return [];
  return apiKey
    .split(/[,\n]/)
    .map(k => k.trim())
    .filter(k => k.length > 0);
}

/**
 * Get the count of API keys
 */
export function getApiKeyCount(apiKey: string): number {
  return parseApiKeys(apiKey).length;
}

/**
 * Mask an API key for display
 */
export function maskApiKey(key: string): string {
  if (!key || key.length === 0) return '\u672aCài đặt';
  if (key.length <= 10) return `${key.substring(0, 4)}***`;
  return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
}

// ==================== ApiKeyManager ====================

interface BlacklistedKey {
  key: string;
  blacklistedAt: number;
  reason?: 'rate_limit' | 'auth' | 'service_unavailable' | 'model_incompatible' | 'unknown';
  durationMs?: number;
}

const BLACKLIST_DURATION_MS = 90 * 1000; // 90 seconds
const MODEL_MISMATCH_BLACKLIST_DURATION_MS = 15 * 1000; // short cooldown for model mismatch

function isModelIncompatibleError(errorText?: string): boolean {
  if (!errorText) return false;
  const text = errorText.toLowerCase();
  return (
    text.includes('not support') ||
    text.includes('unsupported') ||
    text.includes('model') && text.includes('invalid') ||
    text.includes('model') && text.includes('not available') ||
    text.includes('model') && text.includes('unavailable')
  );
}

/**
 * Phát hiện HTTP 500 phản ứng\u4f53trong\u662f\u5426chứatải ngược dòngbão hòa\u76f8\u5173chìa khóa\u8bcd。
 * MemeFast Có\u65f6sử dụng 500 \u800c\u975e 503/529 Quay lại\u8d1f\u8f7dbão hòaLỗi。
 */
function isUpstreamOverloadError(errorText?: string): boolean {
  if (!errorText) return false;
  const text = errorText.toLowerCase();
  return (
    text.includes('tải ngược dòng') ||
    text.includes('\u8d1f\u8f7dĐã rồibão hòa') ||
    text.includes('\u8d1f\u8f7dbão hòa') ||
    text.includes('overloaded') ||
    text.includes('Không có kênh nào') ||
    text.includes('no available channel')
  );
}

/**
 * API Key Manager with rotation and blacklist support
 * Manages multiple API keys per provider with automatic rotation on failures
 */
export class ApiKeyManager {
  private keys: string[];
  private currentIndex: number;
  private blacklist: Map<string, BlacklistedKey> = new Map();

  constructor(apiKeyString: string) {
    this.keys = parseApiKeys(apiKeyString);
    // Start with a random index for load balancing
    this.currentIndex = this.keys.length > 0 ? Math.floor(Math.random() * this.keys.length) : 0;
  }

  /**
   * Get the current API key
   */
  getCurrentKey(): string | null {
    this.cleanupBlacklist();
    
    if (this.keys.length === 0) return null;

    // Find a non-blacklisted key starting from current index
    for (let i = 0; i < this.keys.length; i++) {
      const index = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[index];
      
      if (!this.blacklist.has(key)) {
        this.currentIndex = index;
        return key;
      }
    }

    // All keys are blacklisted, return null or the first key anyway
    return this.keys.length > 0 ? this.keys[0] : null;
  }

  /**
   * Rotate to the next available key
   */
  rotateKey(): string | null {
    this.cleanupBlacklist();
    
    if (this.keys.length <= 1) return this.getCurrentKey();

    // Move to next key
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    
    // Find next non-blacklisted key
    for (let i = 0; i < this.keys.length; i++) {
      const index = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[index];
      
      if (!this.blacklist.has(key)) {
        this.currentIndex = index;
        return key;
      }
    }

    return this.keys[this.currentIndex];
  }

  /**
   * Mark the current key as failed and blacklist it temporarily
   */
  markCurrentKeyFailed(reason: BlacklistedKey['reason'] = 'unknown', durationMs: number = BLACKLIST_DURATION_MS): void {
    const key = this.keys[this.currentIndex];
    if (key) {
      this.blacklist.set(key, {
        key,
        blacklistedAt: Date.now(),
        reason,
        durationMs,
      });
    }
    this.rotateKey();
  }

  /**
   * Handle API errors and decide whether to rotate
   * Returns true if key was rotated
   */
  handleError(statusCode: number, errorText?: string): boolean {
    if (statusCode === 429) {
      this.markCurrentKeyFailed('rate_limit');
      return true;
    }
    if (statusCode === 401 || statusCode === 403) {
      this.markCurrentKeyFailed('auth');
      return true;
    }
    // Tất cả 5xx \u670d\u52a1\u7aefLỗi\u5747Kích hoạt key \u8f6e\u8f6c（memefast Đợi đãtrong\u8f6c\u7ad9 500 \u591acho\u4e34\u65f6\u6027\u6545\u969c）
    if (statusCode >= 500) {
      this.markCurrentKeyFailed('service_unavailable');
      return true;
    }

    if (statusCode === 400 && isModelIncompatibleError(errorText)) {
      this.markCurrentKeyFailed('model_incompatible', MODEL_MISMATCH_BLACKLIST_DURATION_MS);
      return true;
    }
    return false;
  }

  /**
   * Get the number of available (non-blacklisted) keys
   */
  getAvailableKeyCount(): number {
    this.cleanupBlacklist();
    return this.keys.filter(k => !this.blacklist.has(k)).length;
  }

  /**
   * Get total key count
   */
  getTotalKeyCount(): number {
    return this.keys.length;
  }

  /**
   * Check if manager has any keys
   */
  hasKeys(): boolean {
    return this.keys.length > 0;
  }

  /**
   * Clean up expired blacklist entries
   */
  private cleanupBlacklist(): void {
    const now = Date.now();
    for (const [key, entry] of this.blacklist.entries()) {
      const ttl = entry.durationMs ?? BLACKLIST_DURATION_MS;
      if (now - entry.blacklistedAt >= ttl) {
        this.blacklist.delete(key);
      }
    }
  }

  /**
   * Reset the manager with new keys
   */
  reset(apiKeyString: string): void {
    this.keys = parseApiKeys(apiKeyString);
    this.currentIndex = this.keys.length > 0 ? Math.floor(Math.random() * this.keys.length) : 0;
    this.blacklist.clear();
  }
}

// ==================== Provider Key Managers ====================

// Global map of ApiKeyManagers per provider
const providerManagers = new Map<string, ApiKeyManager>();

function getScopedProviderKey(providerId: string, scopeKey?: string): string {
  return scopeKey ? `${providerId}::${scopeKey}` : providerId;
}

/**
 * Get or create an ApiKeyManager for a provider
 */
export function getProviderKeyManager(providerId: string, apiKey: string, scopeKey?: string): ApiKeyManager {
  const managerKey = getScopedProviderKey(providerId, scopeKey);
  let manager = providerManagers.get(managerKey);
  
  if (!manager) {
    manager = new ApiKeyManager(apiKey);
    providerManagers.set(managerKey, manager);
  }
  
  return manager;
}

/**
 * Update the keys for a provider's manager
 */
export function updateProviderKeys(providerId: string, apiKey: string, scopeKey?: string): void {
  const managerKey = getScopedProviderKey(providerId, scopeKey);
  const manager = providerManagers.get(managerKey);
  if (manager) {
    manager.reset(apiKey);
  } else {
    providerManagers.set(managerKey, new ApiKeyManager(apiKey));
  }
}

/**
 * Clear all provider managers
 */
export function clearAllManagers(): void {
  providerManagers.clear();
}
