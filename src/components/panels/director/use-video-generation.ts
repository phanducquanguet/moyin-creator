// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import { getFeatureConfig } from "@/lib/ai/feature-router";
import { uploadToImageHost, isImageHostConfigured } from "@/lib/image-host";
import { saveVideoToLocal, readImageAsBase64 } from "@/lib/image-storage";
import { normalizeUrl } from "./use-image-generation";
import { useAPIConfigStore } from "@/stores/api-config-store";
import { retryOperation } from "@/lib/utils/retry";

// ==================== Content Moderation ====================

/**
 * Keywords indicating content moderation errors
 * Based on ScriptAgent's CONTENT_MODERATION_KEYWORDS
 */
const CONTENT_MODERATION_KEYWORDS = [
  'moderation',
  'authentication',
  'content_sensitive',
  'violation',
  'sensitive',
  'policy',
  'refused',
  'rejected',
  'inappropriate',
  'blocked',
  'review',
  'prohibited',
  'not_allowed',
  'unsafe',
  'bên trong\u5bb9\u5ba1\u6838',
  '\u8fdd\u89c4',
  '\u654f\u611f',
  '\u7981\u6b62',
  '\u62d2\u7edd',
  '\u4e0d\u5408\u89c4',
] as const;

/**
 * Check if an error is related to content moderation
 * @param error - Error message or error object
 * @returns true if it's a moderation error
 */
export function isContentModerationError(error: string | Error | unknown): boolean {
  const errorStr = error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase();

  return CONTENT_MODERATION_KEYWORDS.some(keyword => 
    errorStr.includes(keyword.toLowerCase())
  );
}

// Get API configuration for video generation
export function getVideoApiConfig() {
  const featureConfig = getFeatureConfig('video_generation');
  if (!featureConfig) {
    return null;
  }
  
  const keyManager = featureConfig.keyManager;
  const apiKey = keyManager.getCurrentKey() || '';
  const platform = featureConfig.platform;
  const model = featureConfig.models?.[0];
  if (!model) {
    return null;
  }
  const videoBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
  if (!videoBaseUrl) {
    return null;
  }
  
  return {
    apiKey,
    keyManager,
    platform,
    model,
    videoBaseUrl,
  };
}

interface ConvertToHttpUrlOptions {
  fallbackHttpUrl?: string | null;
  uploadName?: string;
}

// Convert local/base64 image to HTTP URL for API
export async function convertToHttpUrl(
  rawUrl: unknown,
  options?: ConvertToHttpUrlOptions
): Promise<string> {
  const url = typeof rawUrl === 'string' ? rawUrl : (Array.isArray(rawUrl) ? rawUrl[0] : '');
  const fallbackHttpUrl = typeof options?.fallbackHttpUrl === 'string' ? options.fallbackHttpUrl : '';
  if (!url) {
    if (fallbackHttpUrl.startsWith('http://') || fallbackHttpUrl.startsWith('https://')) {
      return fallbackHttpUrl;
    }
    console.warn('[VideoGen] convertToHttpUrl received invalid url:', rawUrl);
    return '';
  }
  
  // Already HTTP URL - use directly
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // For base64/local data URLs, upload to image host
  if (!isImageHostConfigured()) {
    throw new Error('Host ảnh chưa được cấu hình. Vui lòng vào Cài đặt để thêm API Key host ảnh.');
  }

  let imageData = url;
  if (url.startsWith('local-image://')) {
    const base64 = await readImageAsBase64(url);
    if (!base64) throw new Error(`Không thể đọc tệp cục bộ: ${url.substring(0, 40)}`);
    imageData = base64;
  }

  const result = await uploadToImageHost(imageData, {
    name: options?.uploadName?.trim() || `media_ref_${Date.now()}`,
    expiration: 15552000,
  });
  if (!result.success || !result.url) {
    throw new Error(result.error || 'Tải ảnh lên host thất bại');
  }
  return result.url;
}

// Build image_with_roles array for video generation
export async function buildImageWithRoles(
  firstFrameUrl: string | undefined,
  lastFrameUrl: string | undefined
): Promise<Array<{ url: string; role: 'first_frame' | 'last_frame' }>> {
  const imageWithRoles: Array<{ url: string; role: 'first_frame' | 'last_frame' }> = [];

  if (firstFrameUrl) {
    const normalizedFirstFrame = normalizeUrl(firstFrameUrl) || '';
    const firstFrameConverted = await convertToHttpUrl(normalizedFirstFrame);
    if (firstFrameConverted) {
      imageWithRoles.push({ url: firstFrameConverted, role: 'first_frame' });
    }
  }

  if (lastFrameUrl) {
    const lastFrameConverted = await convertToHttpUrl(lastFrameUrl);
    if (lastFrameConverted) {
      imageWithRoles.push({ url: lastFrameConverted, role: 'last_frame' });
    }
  }

  return imageWithRoles;
}

// ==================== \u6a21\u578b\u8def\u7531Phát hiện ====================

/**
 * MemeFast supported_endpoint_types → bên trong\u90e8\u89c6\u9891\u8def\u7531\u683c\u5f0f
 * Dựa trên /api/pricing_new \u8fd4\u56decủa\u5143\u6570\u636e，\u800c\u975e\u6a21\u578btên\u731c\u6d4b
 */
const VIDEO_FORMAT_MAP: Record<string, 'openai_official' | 'unified' | 'volc' | 'wan' | 'kling' | 'replicate'> = {
  // OpenAI \u5b98\u65b9\u89c6\u9891\u683c\u5f0f (sora-2): /v1/videos
  'openAI\u5b98\u65b9\u89c6\u9891\u683c\u5f0f': 'openai_official',
  'openAI\u89c6\u9891\u683c\u5f0f': 'openai_official',
  // túi đậu/Seedance: /volc/v1/contents/generations/tasks
  'túi đậu\u89c6\u9891\u5f02\u6b65': 'volc',
  // \u963f\u91ccTrăm\u70bc wan: /ali/bailian/...
  '\u5f02\u6b65': 'wan',
  // \u53ef\u7075 Kling \u5168\u7cfbCột: /kling/v1/videos/...
  '\u6587\u751f\u89c6\u9891': 'kling',
  '\u56fe\u751f\u89c6\u9891': 'kling',
  '\u89c6\u9891mở rộng': 'kling',
  'omni-video': 'kling',
  '\u52a8\u4f5c\u63a7\u5236': 'kling',
  '\u591a\u6a21\u6001\u89c6\u9891\u7f16\u8f91': 'kling',
  'con số\u4eba': 'kling',
  '\u5bf9\u53e3\u578b': 'kling',
  '\u89c6\u9891\u7279\u6548': 'kling',
  // \u7edfmột\u683c\u5f0f: /v1/video/generations
  'openai': 'unified', // \u67d0\u4e9b\u81ea\u5b9a\u4e49\u4f9b\u5e94\u5546\u4f1a\u628a\u89c6\u9891\u6a21\u578b\u6807\u8bb0chophổ quát openai
  '\u89c6\u9891\u7edfmột\u683c\u5f0f': 'unified',
  'grok\u89c6\u9891': 'unified',
  'openai-response': 'unified',
  'biển\u87ba\u89c6\u9891\u751f\u6210': 'unified',
  'luma\u89c6\u9891\u751f\u6210': 'unified',
  'luma\u89c6\u9891\u6269\u5c55': 'unified',
  'runway\u56fe\u751f\u89c6\u9891': 'unified',
  'aigc-video': 'unified',
  'wan\u89c6\u9891\u751f\u6210': 'unified',
  // Vidu (all route to unified /v1/video/generations)
  'vidu\u6587\u751f\u89c6\u9891': 'unified',
  'vidu\u56fe\u751f\u89c6\u9891': 'unified',
  'viduTài liệu tham khảo\u751f\u89c6\u9891': 'unified',
  'vidu\u9996\u5c3e\u5e27': 'unified',
  'luma\u89c6\u9891mở rộng': 'unified',
};

/**
 * \u7edfmột\u683c\u5f0f\u7aef\u70b9\u8def\u5f84\u6620\u5c04（\u7aef\u70b9\u7c7b\u578b → \u63d0\u4ea4/\u8f6e\u8be2 URL \u8def\u5f84）
 * \u6bcf\u79cd\u7aef\u70b9\u7c7b\u578b\u76f4\u63a5\u5bf9\u5e94\u786e\u5b9acủa URL，\u4e0dMột lần nữa\u9760 fallback \u731c\u6d4b
 */
const UNIFIED_ENDPOINT_PATHS: Record<string, { submit: string; poll: (id: string) => string }> = {
  // \u8def\u5f84\u5747cho\u57dftên\u6839\u8d77của\u7edd\u5bf9\u8def\u5f84（\u4e0d\u4f9d\u8d56 /v1/ \u524d\u7f00\u62fc\u63a5）
  'grok\u89c6\u9891':     { submit: '/v1/video/create',      poll: (id) => `/v1/video/query?id=${id}` },
  '\u89c6\u9891\u7edfmột\u683c\u5f0f': { submit: '/v1/video/create',      poll: (id) => `/v1/video/query?id=${id}` },
  'biển\u87ba\u89c6\u9891\u751f\u6210': { submit: '/minimax/v1/video_generation', poll: (id) => `/minimax/v1/query/video_generation?task_id=${id}` },
  'luma\u89c6\u9891\u751f\u6210': { submit: '/luma/generations',            poll: (id) => `/luma/generations/${id}` },
  'luma\u89c6\u9891\u6269\u5c55': { submit: '/luma/generations',            poll: (id) => `/luma/generations/${id}` },
  'luma\u89c6\u9891mở rộng': { submit: '/luma/generations',            poll: (id) => `/luma/generations/${id}` },
  'runway\u56fe\u751f\u89c6\u9891': { submit: '/runwayml/v1/image_to_video', poll: (id) => `/runwayml/v1/tasks/${id}` },
  'wan\u89c6\u9891\u751f\u6210':    { submit: '/alibailian/api/v1/services/aigc/video-generation/video-synthesis', poll: (id) => `/alibailian/api/v1/tasks/${id}` },
  'aigc-video':    { submit: '/tencent-vod/v1/aigc-video', poll: (id) => `/tencent-vod/v1/aigc-video/${id}` },
  // Vidu doanh nghiệp\u7248\u7aef\u70b9 (/ent/v2/)
  'vidu\u6587\u751f\u89c6\u9891':   { submit: '/ent/v2/text2video',       poll: (id) => `/ent/v2/task?task_id=${id}` },
  'vidu\u56fe\u751f\u89c6\u9891':   { submit: '/ent/v2/img2video',        poll: (id) => `/ent/v2/task?task_id=${id}` },
  'viduTài liệu tham khảo\u751f\u89c6\u9891': { submit: '/ent/v2/reference2video',  poll: (id) => `/ent/v2/task?task_id=${id}` },
  'vidu\u9996\u5c3e\u5e27':     { submit: '/ent/v2/start-end2video',  poll: (id) => `/ent/v2/task?task_id=${id}` },
};
const DEFAULT_UNIFIED_ENDPOINT = { submit: '/v1/video/generations', poll: (id: string) => `/v1/video/generations/${id}` };

/**
 * \u6839\u636e\u6a21\u578b\u7aef\u70b9\u7c7b\u578b\u67e5\u627e\u5bf9\u5e94của\u63d0\u4ea4/\u8f6e\u8be2 URL \u8def\u5f84
 */
function getUnifiedEndpointPaths(endpointTypes: string[]): { submit: string; poll: (id: string) => string } {
  for (const t of endpointTypes) {
    if (UNIFIED_ENDPOINT_PATHS[t]) return UNIFIED_ENDPOINT_PATHS[t];
  }
  return DEFAULT_UNIFIED_ENDPOINT;
}

/**
 * \u6839\u636e\u6a21\u578bcủa supported_endpoint_types \u5143\u6570\u636ePhát hiện\u5e94sử dụngcủa\u89c6\u9891 API \u683c\u5f0f
 * Ưu tiênsử dụng MemeFast /api/pricing_new \u540c\u6b65của\u5143\u6570\u636e，fallback Đến\u6a21\u578btênsuy luận
 */
function detectVideoApiFormat(model: string): 'openai_official' | 'unified' | 'volc' | 'wan' | 'kling' | 'replicate' {
  // 1. Truy vấn store trongcủa endpoint types \u5143\u6570\u636e
  const endpointTypes = useAPIConfigStore.getState().modelEndpointTypes[model];
  if (endpointTypes && endpointTypes.length > 0) {
    // ưu tiên：openai_official → kling → volc → wan → replicate → unified
    for (const t of endpointTypes) {
      if (VIDEO_FORMAT_MAP[t] === 'openai_official') {
        console.log(`[VideoGen] Metadata-driven routing: ${model} → openai_official (endpoint: ${t})`);
        return 'openai_official';
      }
    }
    for (const t of endpointTypes) {
      if (VIDEO_FORMAT_MAP[t] === 'kling') {
        console.log(`[VideoGen] Metadata-driven routing: ${model} → kling (endpoint: ${t})`);
        return 'kling';
      }
    }
    for (const t of endpointTypes) {
      if (VIDEO_FORMAT_MAP[t] === 'volc') {
        console.log(`[VideoGen] Metadata-driven routing: ${model} → volc (endpoint: ${t})`);
        return 'volc';
      }
    }
    for (const t of endpointTypes) {
      if (VIDEO_FORMAT_MAP[t] === 'wan') {
        console.log(`[VideoGen] Metadata-driven routing: ${model} → wan (endpoint: ${t})`);
        return 'wan';
      }
    }
    // Replicate: endpoint type uses '{org}/{model}\u5f02\u6b65' pattern (contains '/' before '\u5f02\u6b65')
    if (endpointTypes.some(t => t.includes('/') && t.endsWith('\u5f02\u6b65'))) {
      console.log(`[VideoGen] Metadata-driven routing: ${model} → replicate (dynamic pattern)`);
      return 'replicate';
    }
    for (const t of endpointTypes) {
      if (VIDEO_FORMAT_MAP[t] === 'unified') {
        console.log(`[VideoGen] Metadata-driven routing: ${model} → unified (endpoint: ${t})`);
        return 'unified';
      }
    }
    // Có\u5143\u6570\u636e\u4f46\u6ca1trận đấuĐếnĐã rồi\u77e5\u683c\u5f0f
    console.warn(`[VideoGen] Unknown endpoint types for ${model}:`, endpointTypes, '→ fallback to name-based');
  }

  // 2. Fallback: \u6309\u6a21\u578btênsuy luận
  const m = model.toLowerCase();
  if (m.includes('sora-2')) return 'openai_official';
  if (m.includes('kling')) return 'kling';
  // doubao-seedance đi volc \u683c\u5f0f（/volc/v1/contents/generations/tasks）
  if (m.includes('doubao') || m.includes('seedance') || m.includes('seedream')) return 'volc';
  if (m.includes('wan')) return 'wan';
  return 'unified';
}

// ==================== phổ quát\u9519\u8bef\u5904\u7406 ====================

function handleVideoSubmitError(
  status: number,
  errorText: string,
  keyManager?: { handleError: (status: number, errorText?: string) => boolean; getCurrentKey?: () => string | null },
): never {
  if (keyManager?.handleError(status, errorText)) {
    const nextKey = keyManager.getCurrentKey?.();
    const keyHint = nextKey ? `${nextKey.substring(0, 8)}…` : '(none)';
    console.log(`[VideoGen] Rotated to next key: ${keyHint} (due to ${status})`);
  }
  let errorMessage = `\u89c6\u9891 API \u9519\u8bef: ${status}`;
  try {
    const errorJson = JSON.parse(errorText);
    errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
  } catch { /* ignore */ }
  if (status === 401 || status === 403) throw new Error('Khóa API không hợp lệ hoặc đã hết hạn');
  if (status === 429) {
    const err = new Error('API Yêu cầu\u8fc7\u4e8e\u9891truyền thống，\u8bf7\u7a0d\u540e\u91cd\u8bd5') as Error & { status?: number };
    err.status = 429;
    throw err;
  }
  // \u6240Có 500/502/503/529 \u5747\u89c6cho\u53ef\u91cd\u8bd5của\u4e34\u65f6\u670d\u52a1\u9519\u8bef，\u643a\u5e26 status \u4f9b\u91cd\u8bd5\u673a\u5236\u8bc6\u522b
  if (status >= 500) {
    const err = new Error(errorMessage || `\u4e0a\u6e38Dịch vụ tạm thời không khả dụng (${status})`) as Error & { status?: number };
    err.status = status;
    throw err;
  }
  const err = new Error(errorMessage) as Error & { status?: number };
  err.status = status;
  throw err;
}

// ==================== \u56fe\u7247\u6700\u5c0f\u5c3a\u5bf8\u4fdd\u969c ====================

/**
 * \u89c6\u9891\u751f\u6210 API \u901a\u5e38yêu cầu\u8f93\u5165\u56fe\u7247\u6ee1\u8db3\u6700\u5c0f\u5c3a\u5bf8（Chẳng hạn như Seedance yêu cầu\u5bbd\u5ea6 ≥ 300px）。
 * \u5f53chíncung điện\u683c\u5207\u5272\u540ecủa\u56fe\u7247\u5c3a\u5bf8\u8fc7\u5c0f\u65f6，\u81ea\u52a8\u653e\u5927Đến\u6ee1\u8db3\u6700\u4f4eyêu cầu\u540e\u91cdmới\u4e0a\u4f20。
 * @param imageUrl  HTTP URL \u56fe\u7247\u5730\u5740
 * @param minDimension  \u5bbd\u9ad8của\u6700\u5c0f\u50cf\u7d20\u503c（\u9ed8\u8ba4 300，trận đấu Seedance Đợi đã\u6a21\u578byêu cầu）
 * @returns nguyên bản URL（\u5c3a\u5bf8\u8fbe\u6807）hoặc\u653e\u5927\u540e\u91cdmới\u4e0a\u4f20củamới URL
 */
async function ensureMinImageSize(
  imageUrl: string,
  minDimension: number = 300,
): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('http')) return imageUrl;

  let objectUrl: string | undefined;
  try {
    // \u901a\u8fc7 fetch \u52a0\u8f7d\u56fe\u7247cho blob，\u907f\u514d CORS \u95ee\u9898
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn('[VideoGen] ensureMinImageSize: fetch failed', response.status);
      return imageUrl;
    }
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to decode image'));
      image.src = objectUrl!;
    });

    const { naturalWidth, naturalHeight } = img;

    if (naturalWidth >= minDimension && naturalHeight >= minDimension) {
      URL.revokeObjectURL(objectUrl);
      return imageUrl; // \u5c3a\u5bf8\u8fbe\u6807
    }

    // Tính toán v.v.\u6bd4\u653e\u5927\u7cfb\u6570
    const scaleW = naturalWidth < minDimension ? minDimension / naturalWidth : 1;
    const scaleH = naturalHeight < minDimension ? minDimension / naturalHeight : 1;
    const scale = Math.max(scaleW, scaleH);
    const newWidth = Math.ceil(naturalWidth * scale);
    const newHeight = Math.ceil(naturalHeight * scale);

    console.log(`[VideoGen] Image too small (${naturalWidth}×${naturalHeight}), upscaling to ${newWidth}×${newHeight}`);

    // Canvas \u653e\u5927
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    URL.revokeObjectURL(objectUrl); // drawImage Hoàn thành\u540e\u91ca\u653e
    objectUrl = undefined;
    const upscaledDataUrl = canvas.toDataURL('image/png');

    // \u91cdmới\u4e0a\u4f20Đến\u56fegiường
    if (!isImageHostConfigured()) {
      console.warn('[VideoGen] Image host not configured, cannot re-upload upscaled image');
      return imageUrl;
    }
    const result = await uploadToImageHost(upscaledDataUrl, {
      name: `upscaled_${Date.now()}`,
      expiration: 15552000,
    });
    if (result.success && result.url) {
      console.log(`[VideoGen] Upscaled & re-uploaded: ${result.url.substring(0, 60)}`);
      return result.url;
    }

    console.warn('[VideoGen] Re-upload failed, using original URL');
    return imageUrl;
  } catch (e) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    console.warn('[VideoGen] ensureMinImageSize failed, using original:', e);
    return imageUrl;
  }
}

// ==================== \u89c6\u9891\u751f\u6210Chúa ơilối vào ====================

/** AbortSignal \u611f\u77e5của sleep：\u82e5\u4fe1\u53f7\u89e6\u53d1\u5219\u7acb\u5373\u4ee5 'sử dụng\u6237Đã rồi\u53d6\u6d88' \u62d2\u7edd */
function sleepOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('sử dụng\u6237Đã rồi\u53d6\u6d88'));
    const tid = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(tid); reject(new Error('sử dụng\u6237Đã rồi\u53d6\u6d88')); }, { once: true });
  });
}

// Call video generation API — \u6839\u636e\u6a21\u578b\u81ea\u52a8\u8def\u7531Đến\u6b63\u786ecủa MemeFast API \u683c\u5f0f
export async function callVideoGenerationApi(
  apiKey: string,
  prompt: string,
  duration: number,
  aspectRatio: string,
  imageWithRoles: Array<{ url: string; role: 'first_frame' | 'last_frame' }>,
  onProgress?: (progress: number) => void,
  keyManager?: { getCurrentKey?: () => string | null; handleError: (status: number, errorText?: string) => boolean; getAvailableKeyCount: () => number; getTotalKeyCount: () => number },
  platform?: string,
  videoResolution?: '480p' | '720p' | '1080p',
  /** Seedance 2.0: \u89c6\u9891\u5f15sử dụng URL danh sách (\u8fd0\u955c/\u52a8\u4f5c\u590d\u523b) */
  videoRefs?: string[],
  /** Seedance 2.0: \u97f3\u9891\u5f15sử dụng URL danh sách (\u8282\u594f/BGM) */
  audioRefs?: string[],
  /** Seedance 2.0: ĐúngKHÔNG\u751f\u6210\u97f3\u9891（\u9ed8\u8ba4 true） */
  enableAudio?: boolean,
  /** Seedance 2.0: ĐúngKHÔNG\u9501\u5b9a\u8fd0\u955c（\u9ed8\u8ba4 false） */
  cameraFixed?: boolean,
  /** Bên ngoài\u90e8trong\u6b62\u4fe1\u53f7，sử dụng\u4e8e\u505c\u6b62\u751f\u6210\u65f6\u771f\u6b63\u53d6\u6d88\u7f51\u7edcYêu cầu */
  signal?: AbortSignal,
): Promise<string> {
  const featureConfig = getFeatureConfig('video_generation');
  const resolvedPlatform = platform || featureConfig?.platform;
  if (!resolvedPlatform) {
    throw new Error('\u8bf7đầu tiên\u5728\u8bbe\u7f6eTrung bình Cấu hình\u89c6\u9891\u751f\u6210\u670d\u52a1\u6620\u5c04');
  }
  const model = featureConfig?.models?.[0];
  if (!model) {
    throw new Error('\u8bf7đầu tiên\u5728\u8bbe\u7f6eTrung bình Cấu hình\u89c6\u9891\u751f\u6210\u6a21\u578b');
  }
  const videoBaseUrl = featureConfig?.baseUrl?.replace(/\/+$/, '');
  if (!videoBaseUrl) {
    throw new Error('\u8bf7đầu tiên\u5728\u8bbe\u7f6eTrung bình Cấu hình\u89c6\u9891\u751f\u6210\u670d\u52a1\u6620\u5c04');
  }

  // \u786e\u4fdd\u6240Có\u8f93\u5165\u56fe\u7247\u6ee1\u8db3\u89c6\u9891 API của\u6700\u5c0f\u5c3a\u5bf8yêu cầu（Chẳng hạn như Seedance ≥ 300px）
  const processedImages = await Promise.all(
    imageWithRoles.map(async (img) => ({
      ...img,
      url: await ensureMinImageSize(img.url),
    }))
  );

  // \u6839\u636e\u5143\u6570\u636e/\u6a21\u578btênPhát hiện API \u683c\u5f0f\u5e76\u8def\u7531，gói\u91cd\u8bd5（\u8986\u76d6 429/503/529 Đợi đã）
  const format = detectVideoApiFormat(model);
  console.log('[VideoGen] Detected API format:', { model, format, platform: resolvedPlatform });

  return retryOperation(() => {
    if (signal?.aborted) return Promise.reject(new Error('sử dụng\u6237Đã rồi\u53d6\u6d88'));
    // \u6bcflần\u91cd\u8bd5\u52a8\u6001\u53d6hiện tại key（keyManager.handleError Đã rồi rotate，\u9700\u8981sử dụngmới key）
    const currentApiKey = keyManager?.getCurrentKey?.() || apiKey;
    const keyHint = currentApiKey ? `${currentApiKey.substring(0, 8)}…` : '(none)';
    console.log(`[VideoGen] Using key: ${keyHint}, format: ${format}`);
    switch (format) {
      case 'openai_official':
        return callOpenAIOfficialVideoApi(currentApiKey, prompt, videoBaseUrl, model, aspectRatio, duration, videoResolution, onProgress, keyManager, signal);
      case 'volc':
        return callVolcVideoApi(currentApiKey, prompt, videoBaseUrl, model, aspectRatio, processedImages, videoResolution, duration, cameraFixed, onProgress, keyManager, videoRefs, audioRefs, signal);
      case 'wan':
        return callWanVideoApi(currentApiKey, prompt, videoBaseUrl, model, processedImages, videoResolution, duration, enableAudio, onProgress, keyManager, signal);
      case 'kling':
        return callKlingVideoApi(currentApiKey, prompt, videoBaseUrl, model, aspectRatio, processedImages, duration, onProgress, keyManager, signal);
      case 'replicate':
        return callReplicateVideoApi(currentApiKey, prompt, videoBaseUrl, model, aspectRatio, processedImages, duration, videoResolution, onProgress, keyManager, signal);
      default:
        // \u7edfmột\u683c\u5f0f: grok, veo, luma, runway, biển\u87ba, \u5373\u68a6, wan2.6, vidu Đợi đã
        return callUnifiedVideoApi(currentApiKey, prompt, videoBaseUrl, model, aspectRatio, processedImages, videoResolution, duration, onProgress, keyManager, signal);
    }
  }, {
    maxRetries: 3,
    baseDelay: 3000,
    retryOn429: true,
    onRetry: (attempt, delay) => {
      const availableKeys = keyManager?.getAvailableKeyCount?.() ?? 1;
      console.warn(`[VideoGen] Retryable error, retrying in ${delay}ms... (Attempt ${attempt}/3, available keys: ${availableKeys})`);
    },
  });
}

// ==================== \u89c6\u9891\u7edfmột\u683c\u5f0f (grok/veo/luma/runway/biển\u87ba/\u5373\u68a6/doubao-seedance/wan2.6/vidu Đợi đã) ====================
// MemeFast \u6587\u6863: POST /v1/video/generations (primary) + /v1/video/create (fallback)
//             GET  /v1/video/generations/{id} (primary) + /v1/video/query?id= (fallback)

/**
 * Convert aspect ratio string to Runway pixel-format ratio (e.g. '16:9' → '1280:720')
 */
function toRunwayRatio(aspectRatio: string): string {
  const map: Record<string, string> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1':  '720:720',
    '4:3':  '960:720',
    '3:4':  '720:960',
    '21:9': '2048:880',
  };
  return map[aspectRatio] ?? aspectRatio;
}

/**
 * Extract video URL from various response formats
 */
function extractVideoUrl(data: Record<string, any>): string | null {
  const url =
    data.data?.[0]?.url ||
    data.url ||
    data.output?.url ||
    (typeof data.output === 'string' && data.output.startsWith('http') ? data.output : null) ||
    (Array.isArray(data.output) && typeof data.output[0] === 'string' ? data.output[0] : null) ||
    data.outputs?.[0] ||
    data.video_url ||
    data.result_url ||
    data.response?.url;  // doubao, jimeng, grok, wan2.6
  return (url ? normalizeUrl(url) : undefined) ?? null;
}

async function callUnifiedVideoApi(
  apiKey: string,
  prompt: string,
  baseUrl: string,
  model: string,
  aspectRatio: string,
  imageWithRoles: Array<{ url: string; role: 'first_frame' | 'last_frame' }>,
  videoResolution?: string,
  duration?: number,
  onProgress?: (progress: number) => void,
  keyManager?: { handleError: (status: number, errorText?: string) => boolean },
  signal?: AbortSignal,
): Promise<string> {
  // Phát hiện\u6a21\u578b\u7aef\u70b9\u7c7b\u578b，\u51b3\u5b9a\u7279\u6b8a\u5904\u7406và URL \u8def\u5f84
  const endpointTypes = useAPIConfigStore.getState().modelEndpointTypes[model] || [];
  const isLuma = endpointTypes.some(t => /luma/i.test(t));
  const isRunway = endpointTypes.some(t => /runway/i.test(t));
  const isGrok = endpointTypes.some(t => /grok/i.test(t)) || /grok/i.test(model);
  const endpointPaths = getUnifiedEndpointPaths(endpointTypes);

  // \u6784\u5efaYêu cầu\u4f53（\u5bf9\u9f50 freedom-api.ts generateVideoViaUnified）
  const body: Record<string, unknown> = { model, prompt };
  const metadata: Record<string, unknown> = {};

  // Duration: Luma requires string with unit ("5s"), other models use number
  if (duration) {
    body.duration = isLuma ? `${duration}s` : duration;
  }

  // AspectRatio \u5904\u7406Chiến lược（\u5404\u6a21\u578b\u683c\u5f0f\u4e0d\u540c，\u6309\u6a21\u578b\u5206\u522b\u5904\u7406）：
  // - Runway: metadata.ratio（\u50cf\u7d20\u683c\u5f0f 1280:720）
  // - Grok: \u9876\u5c42 aspect_ratio（xAI \u5b98\u65b9\u683c\u5f0f，\u652f\u6301 16:9/9:16/4:3/3:4/3:2/2:3/1:1）
  // - \u5176\u4ed6\u7edfmột\u683c\u5f0f\u6a21\u578b: metadata.aspect_ratio
  if (aspectRatio) {
    if (isRunway) {
      metadata.ratio = toRunwayRatio(aspectRatio);
    } else if (isGrok) {
      body.aspect_ratio = aspectRatio;
    } else {
      metadata.aspect_ratio = aspectRatio;
    }
  }

  // Resolution: Grok supports "720p"/"480p" at top level; others via metadata
  if (videoResolution) {
    if (isRunway) {
      // Runway doesn't use resolution field
    } else if (isGrok) {
      body.resolution = videoResolution;
    } else {
      metadata.resolution = videoResolution;
    }
  }

  // Image inputs: single `image` field (not array)
  const firstFrame = imageWithRoles.find(img => img.role === 'first_frame');
  if (firstFrame?.url) {
    body.image = firstFrame.url;
  }
  const lastFrame = imageWithRoles.find(img => img.role === 'last_frame');
  if (lastFrame?.url) {
    metadata.image_end = lastFrame.url;
  }

  if (Object.keys(metadata).length > 0) body.metadata = metadata;

  // \u7edd\u5bf9\u8def\u5f84\u62fc\u63a5：từ\u57dftên\u6839\u5f00\u59cb
  const rootBase = baseUrl.replace(/\/v\d+$/, '');
  const submitUrl = `${rootBase}${endpointPaths.submit}`;
  console.log(`[VideoGen] Unified format → POST ${endpointPaths.submit}`, { model, metadata, hasImage: !!firstFrame?.url });

  // \u63d0\u4ea4：Sử dụng trực tiếp\u7aef\u70b9\u7c7b\u578b\u5bf9\u5e94của URL
  const resp = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errorText = await resp.text();
    handleVideoSubmitError(resp.status, errorText, keyManager);
  }
  const submitData = await resp.json();

  console.log('[VideoGen] Unified submit response:', submitData);

  // Trích xuấtNhiệm vụ ID（\u8986\u76d6\u5404\u5e73\u53f0của\u5d4c\u5957phản ứng\u683c\u5f0f）
  const taskId = (
    submitData.task_id ||
    submitData.id ||
    submitData.request_id ||
    submitData.data?.task_id ||
    submitData.data?.id ||
    submitData.response?.task_id ||
    submitData.response?.id ||
    submitData.result?.task_id ||
    submitData.result?.id ||
    submitData.output?.task_id ||
    submitData.output?.id
  )?.toString();

  // \u67d0\u4e9b\u6a21\u578b\u76f4\u63a5\u8fd4\u56dekết quả
  const directUrl = extractVideoUrl(submitData);
  if (directUrl) return directUrl;
  if (!taskId) {
    console.error('[VideoGen] Cannot extract taskId from submit response:', JSON.stringify(submitData).substring(0, 300));
    throw new Error(`\u8fd4\u56de\u7a7acủaNhiệm vụ ID（phản ứng\u683c\u5f0f\u672a\u8bc6\u522b，\u8bf7\u68c0\u67e5\u63a7\u5236\u53f0ngày\u5fd7）`);
  }

  // \u8f6e\u8be2：Sử dụng trực tiếp\u7aef\u70b9\u7c7b\u578b\u5bf9\u5e94của URL
  const pollUrl = `${rootBase}${endpointPaths.poll(taskId)}`;
  const pollInterval = 5000;
  const maxAttempts = 180;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onProgress?.(Math.min(20 + Math.floor((attempt / maxAttempts) * 80), 99));
    await sleepOrAbort(pollInterval, signal);

    const statusResponse = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal,
    });

    if (!statusResponse.ok) continue;

    const statusData = await statusResponse.json();
    console.log(`[VideoGen] Unified task ${taskId} status:`, statusData);

    const status = String(statusData.status || statusData.state || statusData.data?.status || '').toLowerCase();

    if (status === 'completed' || status === 'succeeded' || status === 'success') {
      const videoUrl = extractVideoUrl(statusData);
      if (!videoUrl) throw new Error('Nhiệm vụHoàn thành\u4f46\u6ca1Có\u89c6\u9891 URL');
      return videoUrl;
    }

    if (status === 'failed' || status === 'error' || status === 'cancelled') {
      const errorMsg = statusData.error?.message || statusData.error || statusData.message || '\u89c6\u9891\u751f\u6210\u5931\u8d25';
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }
  }
  throw new Error('\u89c6\u9891\u751f\u6210\u8d85\u65f6');
}

// ==================== Volcengine túi đậu/Seedance \u683c\u5f0f ====================
// MemeFast \u6587\u6863: POST /volc/v1/contents/generations/tasks + GET /volc/v1/contents/generations/tasks/{taskId}
// \u706bnúi\u65b9\u821f\u6587\u6863: https://www.volcengine.com/docs/82379/1520757

async function callVolcVideoApi(
  apiKey: string,
  prompt: string,
  baseUrl: string,
  model: string,
  aspectRatio: string,
  imageWithRoles: Array<{ url: string; role: string }>,
  videoResolution?: string,
  duration?: number,
  cameraFixed?: boolean,
  onProgress?: (progress: number) => void,
  keyManager?: { handleError: (status: number, errorText?: string) => boolean },
  /** Seedance 2.0: \u89c6\u9891\u5f15sử dụng URL danh sách */
  videoRefs?: string[],
  /** Seedance 2.0: \u97f3\u9891\u5f15sử dụng URL danh sách */
  audioRefs?: string[],
  signal?: AbortSignal,
): Promise<string> {
  // \u6784\u5efa content \u6570\u7ec4（Volcengine \u683c\u5f0f: text + image_url）
  const content: Array<Record<string, unknown>> = [];

  // \u6587\u672cbên trong\u5bb9：prompt + bên trong\u8054\u53c2\u6570（--rs, --rt, --dur, --cf）
  let textContent = prompt;
  const resolution = (videoResolution || '720p').toLowerCase();
  textContent += ` --rs ${resolution}`;
  textContent += ` --rt ${aspectRatio}`;
  if (duration) textContent += ` --dur ${duration}`;
  if (cameraFixed !== undefined) textContent += ` --cf ${cameraFixed}`;

  content.push({ type: 'text', text: textContent });

  // \u56fe\u7247bên trong\u5bb9（khung hình đầu tiên/\u5c3e\u5e27）
  for (const img of imageWithRoles) {
    if (img.url) {
      content.push({
        type: 'image_url',
        image_url: { url: img.url },
        role: img.role,
      });
    }
  }

  // Seedance 2.0 \u591a\u6a21\u6001：\u89c6\u9891\u5f15sử dụng（mở rộng/\u7f16\u8f91/Bản sao chuyển động gươngĐợi đã）
  if (videoRefs && videoRefs.length > 0) {
    for (const vUrl of videoRefs) {
      if (vUrl) {
        content.push({
          type: 'video_url',
          video_url: { url: vUrl },
        });
      }
    }
  }

  // Seedance 2.0 \u591a\u6a21\u6001：\u97f3\u9891\u5f15sử dụng（BGM/\u5361\u70b9Đợi đã）
  if (audioRefs && audioRefs.length > 0) {
    for (const aUrl of audioRefs) {
      if (aUrl) {
        content.push({
          type: 'audio_url',
          audio_url: { url: aUrl },
        });
      }
    }
  }

  const requestBody = { model, content };

  console.log('[VideoGen] Volc format → POST /volc/v1/contents/generations/tasks', {
    model,
    resolution,
    aspectRatio,
    duration,
    imageCount: imageWithRoles.filter(i => i.url).length,
  });

  const submitResponse = await fetch(`${baseUrl}/volc/v1/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    console.error('[VideoGen] Volc video submit error:', submitResponse.status, errorText);
    handleVideoSubmitError(submitResponse.status, errorText, keyManager);
  }

  const submitData = await submitResponse.json();
  console.log('[VideoGen] Volc submit response:', JSON.stringify(submitData).substring(0, 500));

  // Phát hiện\u4ee3\u7406\u5305\u88c5của\u4e1a\u52a1\u7ea7\u9519\u8bef（HTTP 200 \u4f46 body.status cho failed/error）
  // \u5178\u578b\u573a\u666f：MemeFast trong\u8f6c\u5c06\u4e0a\u6e38 451（bên trong\u5bb9\u5ba1\u6838）Đợi đã\u9519\u8bef\u5305\u88c5cho {status: "failed", message: "..."}
  if (submitData.status === 'failed' || submitData.status === 'error') {
    const proxyMsg = submitData.message || submitData.error?.message || '\u89c6\u9891\u63d0\u4ea4\u5931\u8d25（\u4ee3\u7406\u8fd4\u56de\u4e1a\u52a1\u9519\u8bef）';
    console.error('[VideoGen] Volc: proxy-wrapped business error:', proxyMsg);
    // \u5c1d\u8bd5từ\u9519\u8befthông tintrongTrích xuấtnguyên bản HTTP \u72b6\u6001\u7801
    const statusMatch = proxyMsg.match(/status\s+(\d+)/);
    const inferredStatus = statusMatch ? parseInt(statusMatch[1]) : 400;
    handleVideoSubmitError(inferredStatus, JSON.stringify(submitData), keyManager);
  }

  // Trích xuấtNhiệm vụ ID（\u517c\u5bb9khác nhauphản ứng\u683c\u5f0f）
  // MemeFast trong\u8f6c: { id: "cgt-..." }  /  \u539f\u751f\u706bnúi\u65b9\u821f: { id: "01973..." }
  // \u4e5f\u517c\u5bb9 response.* / result.* \u5d4c\u5957\u683c\u5f0f
  const taskId = (
    submitData.id ||
    submitData.task_id ||
    submitData.request_id ||
    submitData.data?.id ||
    submitData.data?.task_id ||
    submitData.response?.task_id ||
    submitData.response?.id ||
    submitData.result?.task_id ||
    submitData.result?.id ||
    submitData.output?.task_id ||
    submitData.output?.id
  )?.toString();

  if (!taskId) {
    console.error('[VideoGen] Volc: cannot extract taskId. Full response:', JSON.stringify(submitData));
    // Hãy ghi nhớ mọi thứ：\u5c06\u4ee3\u7406\u8fd4\u56decủa\u9519\u8befthông tin（Nếu có）\u9644\u52a0Đến\u5f02\u5e38trong，\u907f\u514dthông tin\u4e22\u5931
    const detail = submitData.message || submitData.error?.message || '';
    throw new Error(detail || `doubao-seedance \u8fd4\u56de\u7a7acủaNhiệm vụ ID（phản ứng\u683c\u5f0f\u672a\u8bc6\u522b，\u8bf7\u68c0\u67e5\u63a7\u5236\u53f0ngày\u5fd7）`);
  }

  // \u8f6e\u8be2: GET /volc/v1/contents/generations/tasks/{taskId}
  const pollInterval = 5000;
  const maxAttempts = 180; // 15\u5206\u949f

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onProgress?.(Math.min(20 + Math.floor((attempt / maxAttempts) * 80), 99));

    const statusResponse = await fetch(
      `${baseUrl}/volc/v1/contents/generations/tasks/${taskId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        signal,
      },
    );

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) throw new Error('Nhiệm vụ\u4e0d\u5b58\u5728');
      console.warn('[VideoGen] Volc query failed:', statusResponse.status);
      await sleepOrAbort(pollInterval, signal);
      continue;
    }

    const statusData = await statusResponse.json();
    console.log(`[VideoGen] Volc task ${taskId} status:`, statusData);

    // Volcengine \u72b6\u6001: queued | running | succeeded | failed | expired | cancelled
    const status = (statusData.status ?? 'unknown').toString().toLowerCase();

    if (status === 'succeeded') {
      // \u517c\u5bb9khác nhauphản ứng\u683c\u5f0fTrích xuất\u89c6\u9891 URL
      const videoUrl =
        normalizeUrl(statusData.content?.video_url) ||      // MemeFast trong\u8f6c\u683c\u5f0f
        normalizeUrl(statusData.output?.video_url) ||       // \u539f\u751f\u706bnúi\u65b9\u821f\u683c\u5f0f
        normalizeUrl(statusData.output?.url) ||
        normalizeUrl(statusData.video_url) ||
        normalizeUrl(statusData.url) ||
        extractVideoUrl(statusData);
      if (!videoUrl) {
        console.error('[VideoGen] Volc: task succeeded but no video URL. statusData:', JSON.stringify(statusData));
        throw new Error('Nhiệm vụHoàn thành\u4f46\u6ca1Có\u89c6\u9891 URL');
      }
      return videoUrl;
    }

    if (status === 'failed' || status === 'expired' || status === 'cancelled') {
      const errorMsg = statusData.error?.message || statusData.error?.code || '\u89c6\u9891\u751f\u6210\u5931\u8d25';
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }

    // queued / running → tiếp tục\u8f6e\u8be2
    await sleepOrAbort(pollInterval, signal);
  }
  throw new Error('\u89c6\u9891\u751f\u6210\u8d85\u65f6');
}

// ==================== \u901a\u4e49\u4e07\u8c61 wan \u683c\u5f0f ====================
// MemeFast \u6587\u6863:
//   \u521b\u5efa: POST /alibailian/api/v1/services/aigc/video-generation/video-synthesis
//   Truy vấn: GET  /alibailian/api/v1/tasks/{task_id}

async function callWanVideoApi(
  apiKey: string,
  prompt: string,
  baseUrl: string,
  model: string,
  imageWithRoles: Array<{ url: string; role: string }>,
  resolution?: string,
  duration?: number,
  enableAudio?: boolean,
  onProgress?: (progress: number) => void,
  keyManager?: { handleError: (status: number, errorText?: string) => boolean },
  signal?: AbortSignal,
): Promise<string> {
  const firstFrame = imageWithRoles.find(img => img.role === 'first_frame');

  const requestBody: Record<string, unknown> = {
    model,
    input: {
      prompt,
      ...(firstFrame?.url ? { img_url: firstFrame.url } : {}),
    },
    parameters: {
      resolution: (resolution || '480P').toUpperCase(),
      prompt_extend: true,
      ...(duration ? { duration: Math.max(3, Math.min(10, duration)) } : {}),
      audio: enableAudio !== false,
    },
  };

  console.log('[VideoGen] Wan format → POST /alibailian/api/v1/services/aigc/video-generation/video-synthesis', { model });

  const submitResponse = await fetch(
    `${baseUrl}/alibailian/api/v1/services/aigc/video-generation/video-synthesis`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    console.error('[VideoGen] Wan video submit error:', submitResponse.status, errorText);
    handleVideoSubmitError(submitResponse.status, errorText, keyManager);
  }

  const submitData = await submitResponse.json();
  console.log('[VideoGen] Wan submit response:', submitData);

  // Trăm\u70bcphản ứng: { request_id, output: { task_id, task_status: "PENDING" } }
  const taskId = submitData.output?.task_id;
  if (!taskId) throw new Error('\u8fd4\u56de\u7a7acủaNhiệm vụ ID');

  // \u8f6e\u8be2: GET /alibailian/api/v1/tasks/{task_id}
  const pollInterval = 5000;
  const maxAttempts = 180;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onProgress?.(Math.min(20 + Math.floor((attempt / maxAttempts) * 80), 99));

    const statusResponse = await fetch(
      `${baseUrl}/alibailian/api/v1/tasks/${taskId}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal,
      },
    );

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) throw new Error('Nhiệm vụ\u4e0d\u5b58\u5728');
      console.warn('[VideoGen] Wan query failed:', statusResponse.status);
      await sleepOrAbort(pollInterval, signal);
      continue;
    }

    const statusData = await statusResponse.json();
    console.log(`[VideoGen] Wan task ${taskId} status:`, statusData);

    // Trăm\u70bcphản ứng: { output: { task_status: "SUCCEEDED", video_url: "..." } }
    const taskStatus = (statusData.output?.task_status ?? '').toUpperCase();

    if (taskStatus === 'SUCCEEDED') {
      const videoUrl = normalizeUrl(statusData.output?.video_url);
      if (!videoUrl) throw new Error('Nhiệm vụHoàn thành\u4f46\u6ca1Có\u89c6\u9891 URL');
      return videoUrl;
    }

    if (taskStatus === 'FAILED') {
      throw new Error(statusData.output?.message || statusData.output?.error || '\u89c6\u9891\u751f\u6210\u5931\u8d25');
    }

    await sleepOrAbort(pollInterval, signal);
  }
  throw new Error('\u89c6\u9891\u751f\u6210\u8d85\u65f6');
}

// ==================== Kling \u53ef\u7075\u5168\u7cfbCột\u683c\u5f0f ====================
// MemeFast: POST /kling/v1/videos/{path} + GET /kling/v1/videos/{path}/{task_id}

/**
 * Resolve kling model name for API requests.
 * Composite IDs like 'kling-image-v1-5' → 'kling-v1-5' (MemeFast version ID).
 * Video version IDs (kling-v2-6) pass through unchanged.
 */
function resolveKlingModelName(model: string): string {
  const match = model.match(/^kling-image-(v.+)$/);
  return match ? `kling-${match[1]}` : model;
}

// Native Kling endpoint paths (relative to /kling/v1/videos/)
// kling-video variants (kling-v2-1-master, kling-v3-0-pro, etc.) fall through to text2video / image2video
const KLING_VIDEO_PATH_MAP: Record<string, string> = {
  'kling-omni-video': 'omni-video',
  'kling-video-extend': 'video-extend',
  'kling-motion-control': 'motion-control',
  'kling-multi-elements': 'multi-elements',
  'kling-avatar-image2video': 'avatar/image2video',
  'kling-advanced-lip-sync': 'advanced-lip-sync',
  'kling-effects': 'effects',
};

async function callKlingVideoApi(
  apiKey: string,
  prompt: string,
  baseUrl: string,
  model: string,
  aspectRatio: string,
  imageWithRoles: Array<{ url: string; role: string }>,
  duration?: number,
  onProgress?: (progress: number) => void,
  keyManager?: { handleError: (status: number, errorText?: string) => boolean },
  signal?: AbortSignal,
): Promise<string> {
  const firstFrame = imageWithRoles.find(img => img.role === 'first_frame');
  const lastFrame = imageWithRoles.find(img => img.role === 'last_frame');

  // Determine the endpoint path: specialized models have a fixed path;
  // all kling-video variants fall through to text2video / image2video
  const specialPath = KLING_VIDEO_PATH_MAP[model];
  const endpointPath = specialPath || (firstFrame?.url ? 'image2video' : 'text2video');

  // Kling sử dụng model_name thay vì model
  const requestBody: Record<string, unknown> = {
    model_name: resolveKlingModelName(model),
    prompt,
    aspect_ratio: aspectRatio,
    duration: duration ? String(Math.min(10, Math.max(5, duration))) : '5',
    mode: 'std',
  };

  // Attach image URLs for image-based endpoints
  if (endpointPath === 'image2video' && firstFrame?.url) {
    requestBody.image_url = firstFrame.url;
    if (lastFrame?.url) requestBody.tail_image_url = lastFrame.url;
  } else if (endpointPath === 'avatar/image2video' && firstFrame?.url) {
    requestBody.image_url = firstFrame.url;
  }

  const submitUrl = `${baseUrl}/kling/v1/videos/${endpointPath}`;
  console.log('[VideoGen] Kling format →', endpointPath, { model, submitUrl });

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    console.error('[VideoGen] Kling video submit error:', submitResponse.status, errorText);
    handleVideoSubmitError(submitResponse.status, errorText, keyManager);
  }

  const submitData = await submitResponse.json();
  console.log('[VideoGen] Kling submit response:', submitData);

  // Kling phản ứng: { code, message, data: { task_id, task_status } }
  const taskId = submitData.data?.task_id;
  if (!taskId) throw new Error('\u8fd4\u56de\u7a7acủaNhiệm vụ ID');

  // \u8f6e\u8be2 URL \u955c\u50cf\u63d0\u4ea4\u8def\u5f84: GET /kling/v1/videos/{path}/{task_id}
  const pollUrl = `${baseUrl}/kling/v1/videos/${endpointPath}/${taskId}`;
  const pollInterval = 5000;
  const maxAttempts = 180;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onProgress?.(Math.min(20 + Math.floor((attempt / maxAttempts) * 80), 99));
    await sleepOrAbort(pollInterval, signal);

    const statusResponse = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal,
    });

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) throw new Error('Nhiệm vụ\u4e0d\u5b58\u5728');
      console.warn('[VideoGen] Kling query failed:', statusResponse.status);
      continue;
    }

    const statusData = await statusResponse.json();
    console.log(`[VideoGen] Kling task ${taskId} status:`, statusData);

    // Kling phản ứng: { data: { task_status: "succeed", task_result: { videos: [{ url }] } } }
    const taskStatus = (statusData.data?.task_status ?? '').toLowerCase();

    if (taskStatus === 'succeed' || taskStatus === 'success' || taskStatus === 'completed') {
      const videoUrl =
        normalizeUrl(statusData.data?.task_result?.videos?.[0]?.url) ||
        normalizeUrl(statusData.data?.task_result?.video_url) ||
        extractVideoUrl(statusData);
      if (!videoUrl) throw new Error('Nhiệm vụHoàn thành\u4f46\u6ca1Có\u89c6\u9891 URL');
      return videoUrl;
    }

    if (taskStatus === 'failed' || taskStatus === 'error') {
      throw new Error(statusData.data?.task_status_msg || statusData.message || '\u89c6\u9891\u751f\u6210\u5931\u8d25');
    }
  }
  throw new Error('\u89c6\u9891\u751f\u6210\u8d85\u65f6');
}

// ==================== OpenAI \u5b98\u65b9\u89c6\u9891\u683c\u5f0f (sora-2) ====================
// MemeFast: POST /v1/videos (FormData) + GET /v1/videos/{taskId}

/**
 * Convert aspect ratio + resolution to Sora pixel size (e.g. '1280x720')
 */
function toSoraSize(aspectRatio?: string, resolution?: string): string {
  const isPortrait = aspectRatio === '9:16' || aspectRatio === '3:4';
  const is1080 = (resolution || '').toLowerCase().includes('1080');
  if (is1080) return isPortrait ? '1080x1920' : '1920x1080';
  return isPortrait ? '720x1280' : '1280x720';
}

async function callOpenAIOfficialVideoApi(
  apiKey: string,
  prompt: string,
  baseUrl: string,
  model: string,
  aspectRatio: string,
  duration?: number,
  videoResolution?: string,
  onProgress?: (progress: number) => void,
  keyManager?: { handleError: (status: number, errorText?: string) => boolean },
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', toSoraSize(aspectRatio, videoResolution));
  form.append('seconds', String(duration || 10));

  const submitUrl = `${baseUrl}/v1/videos`;
  console.log('[VideoGen] OpenAI Official format → POST /v1/videos', { model, size: toSoraSize(aspectRatio, videoResolution) });

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form,
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    console.error('[VideoGen] Sora video submit error:', submitResponse.status, errorText);
    handleVideoSubmitError(submitResponse.status, errorText, keyManager);
  }

  const submitData = await submitResponse.json();
  console.log('[VideoGen] Sora submit response:', submitData);

  const taskId = (submitData.id || submitData.video_id)?.toString();
  const directUrl = extractVideoUrl(submitData);
  if (directUrl) return directUrl;
  if (!taskId) throw new Error('Sora \u8fd4\u56de\u7a7aNhiệm vụ ID');

  // \u8f6e\u8be2: GET /v1/videos/{taskId}
  const pollUrl = `${baseUrl}/v1/videos/${taskId}`;
  const pollInterval = 5000;
  const maxAttempts = 180;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onProgress?.(Math.min(20 + Math.floor((attempt / maxAttempts) * 80), 99));
    await sleepOrAbort(pollInterval, signal);

    const statusResponse = await fetch(pollUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal,
    });

    if (!statusResponse.ok) continue;

    const statusData = await statusResponse.json();
    console.log(`[VideoGen] Sora task ${taskId} status:`, statusData);

    const status = String(statusData.status || '').toLowerCase();

    if (status === 'completed' || status === 'succeeded' || status === 'success') {
      const videoUrl = extractVideoUrl(statusData) || normalizeUrl(`${baseUrl}/v1/videos/${taskId}/content`);
      if (!videoUrl) throw new Error('Sora Nhiệm vụHoàn thành\u4f46\u6ca1Có\u89c6\u9891 URL');
      return videoUrl;
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(statusData.error?.message || statusData.error || statusData.message || 'Sora \u751f\u6210\u5931\u8d25');
    }
  }
  throw new Error('Sora \u751f\u6210\u8d85\u65f6');
}

// ==================== Replicate \u89c6\u9891\u683c\u5f0f ====================
// MemeFast: POST /replicate/v1/predictions + GET /replicate/v1/predictions/{id}

async function callReplicateVideoApi(
  apiKey: string,
  prompt: string,
  baseUrl: string,
  model: string,
  aspectRatio: string,
  imageWithRoles: Array<{ url: string; role: string }>,
  duration?: number,
  videoResolution?: string,
  onProgress?: (progress: number) => void,
  keyManager?: { handleError: (status: number, errorText?: string) => boolean },
  signal?: AbortSignal,
): Promise<string> {
  // rootBase: strip /v1 suffix for /replicate/ prefix path
  const rootBase = baseUrl.replace(/\/v\d+$/, '');

  const input: Record<string, unknown> = { prompt };
  if (aspectRatio) input.aspect_ratio = aspectRatio;
  if (duration) input.duration = duration;
  if (videoResolution) input.resolution = videoResolution;

  // Image-to-video: attach first frame inside input
  const firstFrame = imageWithRoles.find(img => img.role === 'first_frame');
  if (firstFrame?.url) input.image = firstFrame.url;
  const lastFrame = imageWithRoles.find(img => img.role === 'last_frame');
  if (lastFrame?.url) input.tail_image = lastFrame.url;

  const submitUrl = `${rootBase}/replicate/v1/predictions`;
  console.log('[VideoGen] Replicate format → POST /replicate/v1/predictions', { model });

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    console.error('[VideoGen] Replicate video submit error:', submitResponse.status, errorText);
    handleVideoSubmitError(submitResponse.status, errorText, keyManager);
  }

  const submitData = await submitResponse.json();
  console.log('[VideoGen] Replicate submit response:', submitData);

  const directUrl = extractVideoUrl(submitData);
  if (directUrl) return directUrl;

  const predictionId = submitData.id?.toString();
  if (!predictionId) throw new Error('Replicate \u8fd4\u56de\u7a7a prediction ID');

  // \u8f6e\u8be2: GET /replicate/v1/predictions/{id}
  const pollUrl = `${rootBase}/replicate/v1/predictions/${predictionId}`;
  const pollInterval = 5000;
  const maxAttempts = 180;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onProgress?.(Math.min(20 + Math.floor((attempt / maxAttempts) * 80), 99));
    await sleepOrAbort(pollInterval, signal);

    const statusResponse = await fetch(pollUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal,
    });

    if (!statusResponse.ok) continue;

    const statusData = await statusResponse.json();
    console.log(`[VideoGen] Replicate prediction ${predictionId} status:`, statusData);

    const status = String(statusData.status || '').toLowerCase();

    if (status === 'succeeded') {
      const videoUrl = extractVideoUrl(statusData);
      if (!videoUrl) throw new Error('Replicate \u6210\u529f\u4f46\u672a\u8fd4\u56de\u89c6\u9891 URL');
      return videoUrl;
    }

    if (status === 'failed' || status === 'canceled') {
      throw new Error(statusData.error || 'Replicate \u89c6\u9891\u751f\u6210\u5931\u8d25');
    }
  }
  throw new Error('Replicate \u89c6\u9891\u751f\u6210\u8d85\u65f6');
}

// Save video to local and return the local URL
export async function saveVideoLocally(videoUrl: string, sceneId: number): Promise<string> {
  try {
    const filename = `scene_${sceneId + 1}_${Date.now()}.mp4`;
    const localUrl = await saveVideoToLocal(videoUrl, filename);
    console.log('[VideoGen] Video saved locally:', localUrl);
    return localUrl;
  } catch (e) {
    console.warn('[VideoGen] Failed to save video locally, using URL:', e);
    return videoUrl;
  }
}

/**
 * Extract the last frame from a video URL as base64 image
 * Uses video element + canvas for frame extraction
 * @param videoUrl - Video URL (HTTP or local)
 * @param seekOffset - Seconds before end to extract (default 0.1s from end)
 * @returns Base64 data URL of the frame, or null on failure
 */
export async function extractLastFrameFromVideo(
  videoUrl: string,
  seekOffset: number = 0.1
): Promise<string | null> {
  // local-image:// Đúng Electron Lưu ý\u518ccủa\u81ea\u5b9a\u4e49\u534f\u8bae，\u53ef\u4ee5Sử dụng trực tiếp
  // \u4e0d\u9700\u8981\u8f6c\u6362cho file://
  const resolvedUrl = videoUrl;
  console.log('[VideoGen] Loading video for frame extraction:', resolvedUrl);
  
  return new Promise((resolve) => {
    const video = document.createElement('video');
    // local-image:// Đúng\u53d7tin tưởngcủa\u534f\u8bae，\u4e0d\u9700\u8981 crossOrigin
    if (!resolvedUrl.startsWith('local-image://') && !resolvedUrl.startsWith('file://')) {
      video.crossOrigin = 'anonymous';
    }
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    
    let hasResolved = false;
    let targetTime = -1; // -1 thể hiện\u8fd8\u672a\u8bbe\u7f6e
    let isSeekStarted = false;
    
    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.oncanplaythrough = null;
      video.onseeked = null;
      video.onerror = null;
      video.ontimeupdate = null;
      video.pause();
      video.src = '';
      video.load();
    };
    
    const timeoutId = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        console.warn('[VideoGen] extractLastFrameFromVideo timeout');
        cleanup();
        resolve(null);
      }
    }, 30000); // 30s timeout
    
    const captureFrame = () => {
      if (hasResolved) return;
      
      // \u786e\u4fdd\u89c6\u9891\u5c3a\u5bf8Có\u6548
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn('[VideoGen] Video dimensions not ready, waiting...');
        setTimeout(captureFrame, 100);
        return;
      }
      
      try {
        video.pause();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.warn('[VideoGen] Cannot get canvas context');
          hasResolved = true;
          clearTimeout(timeoutId);
          cleanup();
          resolve(null);
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        console.log('[VideoGen] Extracted last frame:', {
          width: canvas.width,
          height: canvas.height,
          duration: video.duration,
          currentTime: video.currentTime,
          targetWas: targetTime,
        });
        
        hasResolved = true;
        clearTimeout(timeoutId);
        cleanup();
        resolve(dataUrl);
      } catch (e) {
        console.warn('[VideoGen] Failed to extract frame:', e);
        hasResolved = true;
        clearTimeout(timeoutId);
        cleanup();
        resolve(null);
      }
    };
    
    // \u5f00\u59cb seek củachức năng
    const startSeek = () => {
      if (hasResolved || isSeekStarted) return;
      
      const duration = video.duration;
      if (!duration || duration <= 0 || !isFinite(duration)) {
        console.warn('[VideoGen] Invalid video duration:', duration);
        return;
      }
      
      isSeekStarted = true;
      targetTime = Math.max(0.1, duration - seekOffset);
      console.log('[VideoGen] Starting seek, duration:', duration, 'target:', targetTime);
      
      video.currentTime = targetTime;
    };
    
    // \u65b9\u6cd5：sử dụng timeupdate \u76d1\u542c\u64ad\u653e\u8fdb\u5ea6，\u5f53\u63a5\u8fd1\u76ee\u6807\u65f6\u95f4\u65f6\u6355\u83b7
    video.ontimeupdate = () => {
      if (hasResolved || targetTime < 0) return; // \u672a\u5f00\u59cb seek \u65f6\u5ffd\u7565
      
      // \u5f53\u64ad\u653eĐến\u76ee\u6807\u65f6\u95f4\u9644\u8fd1\u65f6\u6355\u83b7\u5e27
      if (video.currentTime >= targetTime - 0.05) {
        console.log('[VideoGen] timeupdate reached target, currentTime:', video.currentTime, 'target:', targetTime);
        captureFrame();
      }
    };
    
    // \u5f53 seek Hoàn thành\u65f6\u6355\u83b7
    video.onseeked = () => {
      if (hasResolved || targetTime < 0) return;
      console.log('[VideoGen] onseeked fired, currentTime:', video.currentTime, 'target:', targetTime);
      
      // \u68c0\u67e5ĐúngKHÔNG\u771fcủa seek Đến\u4e86\u76ee\u6807\u4f4d\u7f6e
      if (Math.abs(video.currentTime - targetTime) < 0.5) {
        // seek \u6210\u529f，Đợi đã\u5f85một\u4e0bMột lần nữa\u6355\u83b7
        setTimeout(captureFrame, 200);
      } else {
        // seek \u53ef\u80fd\u5931\u8d25，\u5c1d\u8bd5\u64ad\u653eĐến\u76ee\u6807\u4f4d\u7f6e
        console.log('[VideoGen] Seek may have failed, trying play approach...');
        video.playbackRate = 16; // Nhanh\u901f\u64ad\u653e
        video.play().catch(() => {
          // Chẳng hạn như\u679c\u64ad\u653e\u5931\u8d25，\u76f4\u63a5\u6355\u83b7hiện tại\u5e27
          console.warn('[VideoGen] Play failed, capturing current frame');
          captureFrame();
        });
      }
    };
    
    // \u5f53\u89c6\u9891\u6570\u636e\u52a0\u8f7dHoàn thành\u65f6\u5c1d\u8bd5 seek
    video.onloadeddata = () => {
      if (hasResolved) return;
      console.log('[VideoGen] onloadeddata, readyState:', video.readyState, 'duration:', video.duration);
      startSeek();
    };
    
    // \u5f53\u53ef\u4ee5\u64ad\u653e\u65f6\u4e5f\u5c1d\u8bd5 seek（\u5907\u9009）
    video.oncanplaythrough = () => {
      if (hasResolved) return;
      console.log('[VideoGen] oncanplaythrough, readyState:', video.readyState, 'duration:', video.duration);
      startSeek();
    };
    
    video.onerror = (e) => {
      if (!hasResolved) {
        hasResolved = true;
        console.warn('[VideoGen] Video load error:', e);
        clearTimeout(timeoutId);
        cleanup();
        resolve(null);
      }
    };
    
    video.src = resolvedUrl;
    video.load();
  });
}

// ==================== \u805a\u946bAPI Grok Video Generation ====================

/**
 * Convert aspect ratio to Grok format
 */
function toGrokAspectRatio(aspectRatio: string): string {
  // Grok supports: 2:3, 3:2, 1:1
  if (aspectRatio === '9:16' || aspectRatio === '3:4') return '2:3';
  if (aspectRatio === '1:1') return '1:1';
  // 16:9, 4:3, 21:9 → 3:2 (closest landscape)
  return '3:2';
}

/**
 * Call JuxinAPI (Grok) video generation API
 * API Documentation: https://juxinapi.apifox.cn/doc-7302525
 * 
 * Create video: POST /v1/video/create
 * Query task: GET /v1/video/query?id={taskId}
 */
export async function callJuxinVideoGenerationApi(
  apiKey: string,
  prompt: string,
  aspectRatio: string,
  imageWithRoles: Array<{ url: string; role: 'first_frame' | 'last_frame' }>,
  onProgress?: (progress: number) => void,
  keyManager?: { getCurrentKey?: () => string | null; handleError: (status: number, errorText?: string) => boolean; getAvailableKeyCount: () => number; getTotalKeyCount: () => number },
  baseUrl?: string,
  model?: string,
  signal?: AbortSignal,
): Promise<string> {
  const apiBaseUrl = baseUrl?.replace(/\/+$/, '');
  if (!apiBaseUrl) {
    throw new Error('\u8bf7đầu tiên\u5728\u8bbe\u7f6eTrung bình Cấu hình\u89c6\u9891\u751f\u6210\u670d\u52a1\u6620\u5c04');
  }
  if (!model) {
    throw new Error('\u8bf7đầu tiên\u5728\u8bbe\u7f6eTrung bình Cấu hình\u89c6\u9891\u751f\u6210\u6a21\u578b');
  }
  console.log('[VideoGen] Using JuxinAPI (Grok) for video generation');
  
  // Extract first frame URL for Grok
  const images: string[] = [];
  const firstFrame = imageWithRoles.find(img => img.role === 'first_frame');
  if (firstFrame?.url) {
    images.push(firstFrame.url);
  }
  
  const requestBody = {
    model,
    prompt,
    aspect_ratio: toGrokAspectRatio(aspectRatio),
    size: '720P', // Currently only 720P is supported
    images,
  };
  
  console.log('[VideoGen] Grok request:', requestBody);

  // Submit video generation request（\u5e26\u91cd\u8bd5，\u8986\u76d6 429/503/529，\u6bcflần\u91cd\u8bd5\u52a8\u6001\u53d6 key）
  const submitData = await retryOperation(async () => {
    // \u6bcflần\u91cd\u8bd5\u52a8\u6001\u53d6hiện tại key，\u5229sử dụng keyManager rotate \u540ecủamới key
    const currentApiKey = keyManager?.getCurrentKey?.() || apiKey;
    const submitResponse = await fetch(`${apiBaseUrl}/v1/video/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${currentApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error('[VideoGen] Grok video error:', submitResponse.status, errorText);

      if (keyManager?.handleError(submitResponse.status, errorText)) {
        const nextKey = keyManager.getCurrentKey?.();
        console.log(`[VideoGen] Grok: rotated to key ${nextKey?.substring(0, 8)}… (due to ${submitResponse.status})`);
      }

      let errorMessage = `Grok API failed: ${submitResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }

      if (submitResponse.status === 401 || submitResponse.status === 403) {
        throw new Error('Khóa API không hợp lệ hoặc đã hết hạn');
      }
      const err = new Error(errorMessage) as Error & { status?: number };
      err.status = submitResponse.status;
      throw err;
    }

    return submitResponse.json();
  }, {
    maxRetries: 3,
    baseDelay: 3000,
    retryOn429: true,
    onRetry: (attempt, delay) => {
      console.warn(`[VideoGen][Grok] Retryable error, retrying in ${delay}ms... (Attempt ${attempt}/3)`);
    },
  });
  console.log('[VideoGen] Grok submit response:', submitData);

  // Extract task ID from response
  const taskId = submitData.id;
  if (!taskId) {
    throw new Error('Grok API \u8fd4\u56de\u7a7acủaNhiệm vụ ID');
  }

  console.log('[VideoGen] Grok task ID:', taskId);

  // Poll for completion
  const pollInterval = 5000; // 5 seconds for Grok (longer video generation)
  const maxAttempts = 180; // 15 minutes max
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const progress = Math.min(20 + Math.floor((attempt / maxAttempts) * 80), 99);
    onProgress?.(progress);

    // Query task status
    const queryUrl = new URL(`${apiBaseUrl}/v1/video/query`);
    queryUrl.searchParams.set('id', taskId);

    const statusResponse = await fetch(queryUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal,
    });

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) {
        throw new Error('Nhiệm vụ\u4e0d\u5b58\u5728');
      }
      console.warn('[VideoGen] Grok query failed:', statusResponse.status);
      await sleepOrAbort(pollInterval, signal);
      continue;
    }

    const statusData = await statusResponse.json();
    console.log(`[VideoGen] Grok task ${taskId} status:`, statusData);

    const status = (statusData.status ?? 'unknown').toString().toLowerCase();

    if (status === 'completed' || status === 'succeeded' || status === 'success') {
      // Extract video URL
      const videoUrl = statusData.video_url || statusData.result_url || statusData.url;
      
      if (!videoUrl) {
        throw new Error('Nhiệm vụHoàn thành\u4f46\u6ca1Có\u89c6\u9891 URL');
      }
      
      console.log('[VideoGen] Grok video completed:', videoUrl);
      return videoUrl;
    }

    if (status === 'failed' || status === 'error') {
      const errorMsg = statusData.error || statusData.error_message || '\u89c6\u9891\u751f\u6210\u5931\u8d25';
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }

    // Status is pending/processing, continue polling
    await sleepOrAbort(pollInterval, signal);
  }
  
  throw new Error('\u89c6\u9891\u751f\u6210\u8d85\u65f6');
}
