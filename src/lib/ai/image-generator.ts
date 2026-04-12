// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Image Generator Service
 * Unified interface for image generation across different AI providers
 * Uses same API logic as storyboard-service.ts
 */

import { getFeatureConfig, getFeatureNotConfiguredMessage } from '@/lib/ai/feature-router';
import { retryOperation } from '@/lib/utils/retry';
import { resolveImageApiFormat } from '@/lib/api-key-manager';
import { useAPIConfigStore } from '@/stores/api-config-store';

export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  resolution?: '1K' | '2K' | '4K';
  referenceImages?: string[];  // Base64 encoded images
  styleId?: string;
}

export interface ImageGenerationResult {
  imageUrl: string;
  taskId?: string;
}

const buildEndpoint = (baseUrl: string, path: string) => {
  const normalized = baseUrl.replace(/\/+$/, '');
  return /\/v\d+$/.test(normalized) ? `${normalized}/${path}` : `${normalized}/v1/${path}`;
};

const getRootBaseUrl = (baseUrl: string): string => {
  return baseUrl.replace(/\/+$/, '').replace(/\/v\d+$/, '');
};

/**
 * Hình ảnh\u7aef\u70b9Đường dẫnmap（\u7aef\u70b9Loại → \u63d0\u4ea4/\u8f6e\u8be2 URL Đường dẫn）
 * \u4ec5sử dụng\u4e8e\u9700\u8981Tuỳ chỉnhĐường dẫncủa\u7aef\u70b9Loại，Phần còn lạiđiMặc định /v1/images/generations
 */
const IMAGE_ENDPOINT_PATHS: Record<string, { submit: string; poll: (id: string) => string }> = {
  'aigc-image': { submit: '/tencent-vod/v1/aigc-image', poll: (id) => `/tencent-vod/v1/aigc-image/${id}` },
  'vidu\u751f\u56fe':   { submit: '/ent/v2/reference2image',    poll: (id) => `/ent/v2/task?task_id=${id}` },
};
const DEFAULT_IMAGE_ENDPOINT = { submit: '/v1/images/generations', poll: (id: string) => `/v1/images/generations/${id}` };

function getImageEndpointPaths(endpointTypes: string[]): { submit: string; poll: (id: string) => string } {
  for (const t of endpointTypes) {
    if (IMAGE_ENDPOINT_PATHS[t]) return IMAGE_ENDPOINT_PATHS[t];
  }
  return DEFAULT_IMAGE_ENDPOINT;
}

// Aspect ratio to pixel dimension mapping (doubao-seedream Đợi đãMô hình\u9700\u8981\u50cf\u7d20Kích thước)
const ASPECT_RATIO_DIMS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '4:3': { width: 1152, height: 864 },
  '3:4': { width: 864, height: 1152 },
  '3:2': { width: 1248, height: 832 },
  '2:3': { width: 832, height: 1248 },
  '21:9': { width: 1512, height: 648 },
};

/**
 * Resolution + aspect ratio → target pixel dimensions for chat completions models
 * \u975e Gemini Hình ảnhMô hìnhđi prompt \u6587\u672cGợi ý；Gemini Hình ảnhMô hìnhđi\u5b98\u65b9 image_size Tham số。
 */
const RESOLUTION_MULTIPLIERS: Record<string, number> = {
  '1K': 1,
  '2K': 2,
  '4K': 4,
};

function getTargetDimensions(aspectRatio: string, resolution?: string): { width: number; height: number } | undefined {
  const baseDims = ASPECT_RATIO_DIMS[aspectRatio];
  if (!baseDims) return undefined;
  const multiplier = RESOLUTION_MULTIPLIERS[resolution || '2K'] || 2;
  return {
    width: baseDims.width * multiplier,
    height: baseDims.height * multiplier,
  };
}

/**
 * \u5224\u65adMô hình là\u5426cho Gemini Hình ảnhTạoMô hình（Nano Banana \u7cfbCột）
 * - Nano Banana Pro = gemini-3-pro-image-preview   → Hỗ trợ 1K/2K/4K
 * - Nano Banana 2  = gemini-3.1-flash-image-preview → Hỗ trợ 512/1K/2K/4K
 * - Nano Banana    = gemini-2.5-flash-image          → \u56fa\u5b9a 1K（\u4e0dHỗ trợ image_size Tham số）
 *
 * sử dụng\u4e8e\u51b3\u5b9a\u662f\u5426\u5728Yêu cầu\u4f53trong\u9644\u52a0\u5b98\u65b9 image_size / aspect_ratio Tham số
 */
function isGeminiImageModel(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes('gemini') && (m.includes('image') || m.includes('imagen'))
  );
}

/**
 * \u5224\u65ad Gemini Hình ảnhMô hình là\u5426Hỗ trợ image_size Tham số（1K/2K/4K）
 * gemini-2.5-flash-image \u53eaĐầu ra\u56fa\u5b9a 1024px，\u4e0dHỗ trợ image_size
 */
function geminiSupportsImageSize(model: string): boolean {
  const m = model.toLowerCase();
  // gemini-3-pro-image / gemini-3.1-flash-image Hỗ trợ 1K/2K/4K
  if (m.includes('gemini-3') && m.includes('image')) return true;
  // gemini-2.5-flash-image \u4e0dHỗ trợ image_size，\u56fa\u5b9a 1K
  return false;
}

/**
 * \u89c4\u8303\u5316Độ phân giải\u503ccho Gemini \u5b98\u65b9yêu cầucủaĐịnh dạng
 * \u5b98\u65b9yêu cầu\u5927\u5199 K（Ví dụ 1K、2K、4K），\u5c0f\u5199\u4f1a\u88abTừ chối
 */
function normalizeResolutionForGemini(resolution?: string): string {
  if (!resolution) return '2K';
  const upper = resolution.toUpperCase();
  // \u63a5\u53d7 '512' \u76f4\u63a5Chấp nhận（\u4ec5 3.1 Flash Image Hỗ trợ）
  if (upper === '512') return '512';
  // \u786e\u4fdd\u662f '1K' / '2K' / '4K' Định dạng
  if (['1K', '2K', '4K'].includes(upper)) return upper;
  return '2K'; // \u4e0d\u8bc6\u522bcủa\u503c\u56de\u9000Đến 2K
}

/**
 * \u5224\u65adMô hình là\u5426\u9700\u8981\u50cf\u7d20Kích thướcĐịnh dạng (Chẳng hạn như "1024x1024") \u800c\u975eTỷ lệĐịnh dạng (Chẳng hạn như "1:1")
 * doubao-seedream, cogview Đợi đã\u56fd\u4ea7Mô hình\u9700\u8981\u50cf\u7d20Kích thước
 */
function needsPixelSize(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes('doubao') || m.includes('seedream') || m.includes('cogview') || false /* zhipu removed */;
}

/**
 * Generate image for character
 */
export async function generateCharacterImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
  return generateImage(params, 'character_generation');
}

/**
 * Generate image for scene
 */
export async function generateSceneImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
  return generateImage(params, 'character_generation');
}

/**
 * Core image generation function
 * Uses the provider bound to the feature via service mapping
 */
async function generateImage(
  params: ImageGenerationParams,
  feature: 'character_generation'
): Promise<ImageGenerationResult> {
  const featureConfig = getFeatureConfig(feature);
  if (!featureConfig) {
    throw new Error(getFeatureNotConfiguredMessage(feature));
  }
  const apiKey = featureConfig.apiKey;
  const baseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
  const model = featureConfig.models?.[0];
  if (!apiKey || !baseUrl || !model) {
    throw new Error(getFeatureNotConfiguredMessage(feature));
  }

  const aspectRatio = params.aspectRatio || '1:1';
  const resolution = params.resolution || '2K';

  // \u6839\u636e\u5143\u6570\u636e\u51b3\u5b9aHình ảnhTạo API Định dạng
  const endpointTypes = useAPIConfigStore.getState().modelEndpointTypes[model];
  const apiFormat = resolveImageApiFormat(endpointTypes, model);

  console.log('[ImageGenerator] Generating image', {
    model,
    apiFormat,
    endpointTypes,
    aspectRatio,
    resolution,
    promptPreview: params.prompt.substring(0, 100) + '...',
  });

  // Gemini Đợi đãMô hìnhChấp nhận chat completions \u751f\u56fe
  if (apiFormat === 'openai_chat') {
    return submitViaChatCompletions(
      params.prompt,
      model,
      apiKey,
      baseUrl,
      aspectRatio,
      params.referenceImages,
      resolution,
      featureConfig.keyManager,
    );
  }

  // Kling image \u539f\u751f\u7aef\u70b9: /kling/v1/images/generations hoặc /kling/v1/images/omni-image
  if (apiFormat === 'kling_image') {
    return submitViaKlingImages(params, model, apiKey, baseUrl, aspectRatio, featureConfig.keyManager);
  }

  // Tiêu chuẩnĐịnh dạng: /v1/images/generations (GPT Image, DALL-E, Flux, doubao-seedream Đợi đã)
  // aigc-image / vidu\u751f\u56fe Đợi đãđiTuỳ chỉnhĐường dẫn
  const result = await submitImageTask(
    params.prompt,
    aspectRatio,
    resolution,
    apiKey,
    params.referenceImages,
    model,
    baseUrl,
    featureConfig.keyManager,
    endpointTypes,
  );

  if (result.imageUrl) {
    return { imageUrl: result.imageUrl };
  }

  if (result.taskId) {
    const imageUrl = await pollTaskStatus(result.taskId, apiKey, baseUrl, undefined, result.pollUrl);
    return { imageUrl, taskId: result.taskId };
  }

  throw new Error('Invalid API response');
}

/**
 * \u538b\u7f29 base64 Hình ảnh tham khảoĐến\u5408\u7406\u4f53\u79ef
 * trong\u8f6c\u7ad9（new_api/one_api）\u5728\u505a OpenAI → Gemini Định dạng\u8f6c\u6362\u65f6，
 * \u8d85\u5927 base64 \u4f1a\u5bfc\u81f4 Phân tích cú pháp JSON Thất bạihoặc body size \u8d85\u9650，\u62a5 "contents is required"。
 * Will Hình ảnh tham khảo\u7f29\u5c0fĐến maxEdge px \u5e76\u8f6ccho JPEG \u53ef\u5927\u5e45\u964d\u4f4e\u4f53\u79ef（2~4MB → ~60KB）。
 */
function compressReferenceImage(dataUri: string, maxEdge = 768, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    // \u975e data URI（HTTP URL Đợi đã）Quay trực tiếp lại，\u7531\u670d\u52a1\u7aef\u5904\u7406
    if (!dataUri.startsWith('data:image/')) {
      resolve(dataUri);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      // Chẳng hạn như\u679cĐã rồi\u7ecf\u8db3\u591f\u5c0f，Quay trực tiếp lại（\u8f6c JPEG \u5373\u53ef\u7701\u4f53\u79ef）
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUri); // \u89e3\u7801Thất bại\u5c31\u539f\u6837Quay lại
    img.src = dataUri;
  });
}

/**
 * Generate image via /v1/chat/completions (multimodal)
 * Used for Gemini image models that don't support /v1/images/generations
 *
 * Độ phân giảiQuy trình Chiến lược：
 * - Gemini Hình ảnhMô hình（Nano Banana Pro / Nano Banana 2）：
 *   Chấp nhậnYêu cầu\u4f53 image_size + aspect_ratio Tham số\u4e25\u683c\u6307\u5b9aĐộ phân giải（trong\u8f6c\u7ad9\u8f6c\u53d1\u7ed9 Gemini \u539f\u751f API）
 * - \u5176\u4ed6Mô hình：Chấp nhận prompt \u6587\u672c\u5d4c\u5165\u50cf\u7d20Kích thướcGiải thích（\u8f6fGợi ý）
 */
async function submitViaChatCompletions(
  prompt: string,
  model: string,
  apiKey: string,
  baseUrl: string,
  aspectRatio: string,
  referenceImages?: string[],
  resolution?: string,
  keyManager?: { getCurrentKey?: () => string | null; handleError?: (status: number, errorText?: string) => boolean },
  signal?: AbortSignal,
): Promise<ImageGenerationResult> {
  const endpoint = buildEndpoint(baseUrl, 'chat/completions');

  // === Độ phân giải\u5904\u7406：Quận\u5206 Gemini Hình ảnhMô hìnhvới\u5176\u4ed6Mô hình ===
  const isGemini = isGeminiImageModel(model);
  const geminiHasImageSize = isGemini && geminiSupportsImageSize(model);

  // \u975e Gemini Mô hình：Chấp nhận prompt \u6587\u672c\u5d4c\u5165\u50cf\u7d20Kích thướcGiải thích（\u8f6fGợi ý）
  // Gemini Mô hìnhChẳng hạn như\u679cHỗ trợ image_size，\u4e5f\u4fdd\u7559 prompt Gợi ý\u4f5cchoHãy ghi nhớ mọi thứ
  const targetDims = getTargetDimensions(aspectRatio, resolution);
  const sizeInstruction = targetDims
    ? ` Output the image at ${targetDims.width}x${targetDims.height} pixels resolution.`
    : '';

  // \u538b\u7f29Hình ảnh tham khảo\u4ee5\u907f\u514d\u8d85\u5927 base64 \u5bfc\u81f4trong\u8f6c\u7ad9 "contents is required" Lỗi
  let compressedRefs: string[] | undefined;
  if (referenceImages && referenceImages.length > 0) {
    compressedRefs = await Promise.all(referenceImages.map(img => compressReferenceImage(img)));
    const originalSize = referenceImages.reduce((s, r) => s + r.length, 0);
    const compressedSize = compressedRefs.reduce((s, r) => s + r.length, 0);
    console.log(`[ImageGenerator] Compressed ${referenceImages.length} refs: ${(originalSize / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB`);
  }

  // Build messages
  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: `Generate an image with aspect ratio ${aspectRatio}.${sizeInstruction} ${prompt}` },
  ];
  // Attach reference images if any (already compressed)
  if (compressedRefs && compressedRefs.length > 0) {
    for (const img of compressedRefs) {
      userContent.push({ type: 'image_url', image_url: { url: img } });
    }
  }

  // === \u6784\u5efaYêu cầu\u4f53 ===
  const requestBody: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: userContent }],
    // Standard multimodal image generation parameters
    max_tokens: 4096,
    stream: false,
  };

  // Gemini Hình ảnhMô hình：\u9644\u52a0\u5b98\u65b9 image_size / aspect_ratio Tham số
  // trong\u8f6c\u7ad9（MemeFast / new_api / one_api Đợi đã）\u4f1a\u5c06\u8fd9\u4e9bTham số\u8f6c\u53d1\u7ed9 Gemini \u539f\u751f API của
  // generation_config.image_config
  if (isGemini) {
    const geminiResolution = geminiHasImageSize
      ? normalizeResolutionForGemini(resolution)
      : undefined; // gemini-2.5-flash-image \u4e0dHỗ trợ image_size

    // \u65b9\u5f0f 1: \u9876\u5c42Tham số（\u5927một phầntrong\u8f6c\u7ad9\u517c\u5bb9）
    if (geminiResolution) {
      requestBody.image_size = geminiResolution;
    }
    requestBody.aspect_ratio = aspectRatio;

    // \u65b9\u5f0f 2: \u5d4c\u5957 generation_config（\u5b98\u65b9 SDK Định dạng，một phầntrong\u8f6c\u7ad9Hỗ trợ）
    requestBody.generation_config = {
      response_modalities: ['TEXT', 'IMAGE'],
      image_config: {
        ...(geminiResolution ? { image_size: geminiResolution } : {}),
        aspect_ratio: aspectRatio,
      },
    };

    console.log('[ImageGenerator] Gemini image model detected, added image_size:', geminiResolution || '(not supported)', 'aspect_ratio:', aspectRatio);
  }

  console.log('[ImageGenerator] Submitting via chat completions:', { model, endpoint, isGemini, geminiImageSize: geminiHasImageSize ? normalizeResolutionForGemini(resolution) : 'N/A' });

  const response = await retryOperation(async () => {
    // \u6bcflầnThử lạiđộc lậpTạo AbortController，\u907f\u514dtổng cộng\u4eab controller \u5728Thử lại\u65f6Đã rồi\u8d85\u65f6
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException('Hình ảnhTạoYêu cầu\u8d85\u65f6（60giây），Vui lòng kiểm tra mạng\u540eThử lại', 'TimeoutError')),
      60000
    );

    // Bên ngoài\u90e8 signal Huỷ\u65f6\u540c\u6b65Huỷbên trong\u90e8 controller，\u5e76\u4f20\u64ad reason
    const onExternalAbort = () => controller.abort(signal?.reason || new Error('Người dùngĐã huỷ'));
    if (signal) {
      if (signal.aborted) throw new Error('Người dùngĐã huỷ');
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    // \u6bcflầnThử lại\u52a8\u6001\u53d6hiện tại key（\u5229sử dụng keyManager rotate \u540ecủa\u65b0 key）
    const currentApiKey = keyManager?.getCurrentKey?.() || apiKey;

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentApiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('[ImageGenerator] Chat completions error:', resp.status, errorText);

        // Thông báo keyManager \u5904\u7406Lỗi（Kích hoạt rotate）
        if (keyManager?.handleError) {
          keyManager.handleError(resp.status, errorText);
        }

        let msg = `Hình ảnhTạo API Lỗi: ${resp.status}`;
        try { const j = JSON.parse(errorText); msg = j.error?.message || msg; } catch {}

        // 401 \u4e13\u9879Gợi ý：\u5f15\u5bfcNgười dùng\u68c0\u67e5 API Key
        if (resp.status === 401) {
          msg = `Khóa API không hợp lệ hoặc đã hết hạn，\u8bf7\u524d\u5f80「Cài đặt」\u68c0\u67e5Hình ảnhTạoDịch vụcủa API Key Cấu hình（nguyên bảnthông tin：${msg}）`;
        }
        // 502 \u4e13\u9879Gợi ý：dịch vụ thượng nguồn\u4e34\u65f6\u4e0dCó sẵn
        if (resp.status === 502) {
          msg = `API \u4e0a\u6e38Dịch vụ tạm thời không khả dụng（502），\u5c06tự độngThử lại（nguyên bảnthông tin：${msg}）`;
        }

        const err = new Error(msg) as Error & { status?: number };
        err.status = resp.status;
        throw err;
      }

      return resp;
    } catch (fetchErr: any) {
      // \u5c06 DOMException abort \u8f6c\u6362cho\u53ef\u8bfbLỗtôi thông tin
      if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
        const reason = controller.signal.reason;
        const readableMsg = reason instanceof Error
          ? reason.message
          : (typeof reason === 'string' ? reason : 'Yêu cầu\u88abtrong\u6b62，Xin vui lòng Thử lại');
        const abortErr = new Error(readableMsg) as Error & { status?: number };
        throw abortErr;
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onExternalAbort);
    }
  }, {
    maxRetries: 3,
    baseDelay: 3000,
    retryOn429: true,
    onRetry: (attempt, delay, error) => {
      console.warn(`[ImageGenerator] Chat completions retry ${attempt}, delay ${delay}ms, error: ${error.message}`);
    },
  });

  // Parse response — some providers return SSE "data: {...}" even with stream:false
  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    // Fallback: accumulate SSE delta chunks into a single message
    const lines = responseText.split('\n').filter(l => l.startsWith('data: '));
    let accumulatedText = '';
    let accumulatedParts: any[] = [];
    let lastChunk: any = null;

    for (const line of lines) {
      const payload = line.replace(/^data:\s*/, '').trim();
      if (payload === '[DONE]') continue;
      try {
        const chunk = JSON.parse(payload);
        lastChunk = chunk;
        const delta = chunk.choices?.[0]?.delta;
        if (delta) {
          if (typeof delta.content === 'string') {
            accumulatedText += delta.content;
          } else if (Array.isArray(delta.content)) {
            accumulatedParts.push(...delta.content);
          }
        }
        // Also check non-delta message (some proxies mix formats)
        const msg = chunk.choices?.[0]?.message;
        if (msg) {
          if (typeof msg.content === 'string') accumulatedText += msg.content;
          else if (Array.isArray(msg.content)) accumulatedParts.push(...msg.content);
        }
      } catch { /* skip malformed line */ }
    }

    if (!lastChunk) {
      throw new Error(`không có\u6cd5Phân tích Hình ảnh API phản ứng: ${responseText.substring(0, 120)}`);
    }

    // Reconstruct standard response format from accumulated deltas
    data = {
      ...lastChunk,
      choices: [{
        ...(lastChunk.choices?.[0] || {}),
        message: {
          role: 'assistant',
          content: accumulatedParts.length > 0 ? accumulatedParts : accumulatedText,
        },
      }],
    };
  }
  console.log('[ImageGenerator] Chat completions response received');

  // Extract image from response - multiple possible formats
  const choice = data.choices?.[0];
  if (!choice) throw new Error('phản ứngtrongkhông cóCó\u6548bên trong\u5bb9');

  const message = choice.message;

  // Format 1: content is array with image parts (OpenAI multimodal)
  if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        return { imageUrl: part.image_url.url };
      }
      // Base64 inline image
      if (part.type === 'image' && part.image?.url) {
        return { imageUrl: part.image.url };
      }
      // Some APIs return base64 in data field
      if (part.type === 'image' && part.data) {
        return { imageUrl: `data:image/png;base64,${part.data}` };
      }
    }
  }

  // Format 2: content is string with markdown image link
  if (typeof message?.content === 'string') {
    // Try to extract image URL from markdown: ![...](url)
    const mdMatch = message.content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
    if (mdMatch) return { imageUrl: mdMatch[1] };
    // Try to extract base64 data URI
    const b64Match = message.content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
    if (b64Match) return { imageUrl: b64Match[1] };
  }

  throw new Error('\u672a\u80fdtừphản ứngtrongTrích xuấtHình ảnh URL');
}

/**
 * Submit image generation task via OpenAI-compatible images/generations API
 */
async function submitImageTask(
  prompt: string,
  aspectRatio: string,
  resolution: string,
  apiKey: string,
  referenceImages?: string[],
  model?: string,
  baseUrl?: string,
  keyManager?: { getCurrentKey: () => string | null; handleError: (status: number, errorText?: string) => boolean },
  endpointTypes?: string[],
): Promise<{ taskId?: string; imageUrl?: string; pollUrl?: string }> {
  if (!baseUrl) {
    throw new Error('\u8bf7đầu tiên\u5728Cài đặtTrung bình Cấu hìnhHình ảnhTạoDịch vụ\u6620\u5c04');
  }
  // \u6839\u636eMô hình\u51b3\u5b9a size Định dạng
  let sizeValue: string = aspectRatio;
  if (model && needsPixelSize(model)) {
    const dims = ASPECT_RATIO_DIMS[aspectRatio];
    if (dims) {
      sizeValue = `${dims.width}x${dims.height}`;
    }
  }

  const requestData: Record<string, unknown> = {
    model: model,
    prompt,
    n: 1,
    size: sizeValue,
    stream: false,
  };

  if (referenceImages && referenceImages.length > 0) {
    console.log('[ImageGenerator] Adding reference images:', referenceImages.length);
    requestData.image_urls = referenceImages;
  }

  console.log('[ImageGenerator] Submitting image task:', {
    model: requestData.model,
    size: requestData.size,
    resolution: requestData.resolution,
    hasImageUrls: !!requestData.image_urls,
  });

  try {
    const data = await retryOperation(async () => {
      // \u6bcflầnThử lạiđộc lậpTạo AbortController，\u907f\u514dtổng cộng\u4eab controller \u5728Thử lại\u65f6Đã rồi\u8d85\u65f6
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      // \u6bcflầnThử lại\u52a8\u6001\u53d6hiện tại key（\u5229sử dụng keyManager rotate \u540ecủa\u65b0 key）
      const currentApiKey = keyManager?.getCurrentKey?.() || apiKey;
      const imagePaths = getImageEndpointPaths(endpointTypes || []);
      const rootBase = getRootBaseUrl(baseUrl);
      const endpoint = `${rootBase}${imagePaths.submit}`;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentApiKey}`,
          },
          body: JSON.stringify(requestData),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ImageGenerator] API error:', response.status, errorText);

          // Thông báo keyManager \u5904\u7406Lỗi（Kích hoạt rotate）
          if (keyManager?.handleError) {
            keyManager.handleError(response.status, errorText);
          }

          let errorMessage = `Hình ảnhTạo API Lỗi: ${response.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorJson.message || errorJson.msg || errorMessage;
          } catch {
            if (errorText && errorText.length < 200) errorMessage = errorText;
          }

          if (response.status === 401 || response.status === 403) {
            throw new Error('Khóa API không hợp lệ hoặc đã hết hạn');
          } else if (response.status === 529 || response.status === 503) {
            // tải ngược dòngbão hòa/\u670d\u52a1\u4e0dCó sẵn，\u9700\u8981Kích hoạtThử lại
            const err = new Error(errorMessage || `\u4e0a\u6e38Dịch vụ tạm thời không khả dụng (${response.status})`) as Error & { status?: number };
            err.status = response.status;
            throw err;
          } else if (response.status >= 500) {
            const err = new Error(errorMessage || 'Hình ảnhTạoDịch vụ tạm thời không khả dụng') as Error & { status?: number };
            err.status = response.status;
            throw err;
          }

          const error = new Error(errorMessage) as Error & { status?: number };
          error.status = response.status;
          throw error;
        }

        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch {
          // Fallback: some providers return SSE format "data: {...}" even with stream:false
          const sseMatch = text.match(/^data:\s*(\{.+\})/m);
          if (sseMatch) {
            return JSON.parse(sseMatch[1]);
          }
          throw new Error(`không có\u6cd5Phân tích Hình ảnh API phản ứng: ${text.substring(0, 100)}`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }, {
      maxRetries: 3,
      baseDelay: 3000,
      retryOn429: true,
      onRetry: (attempt, delay) => {
        console.warn(`[ImageGenerator] Retryable error, retrying in ${delay}ms... (Attempt ${attempt}/3)`);
      },
    });
    console.log('[ImageGenerator] API response:', data);

    // GPT Image Quay lại choices Định dạng（MemeFast \u6587\u6863Xác nhận）
    if (data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      // \u53ef\u80fd\u662f markdown Hình ảnh\u94fe\u63a5
      const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
      if (mdMatch) return { imageUrl: mdMatch[1] };
      // \u53ef\u80fd\u662f base64
      const b64Match = content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
      if (b64Match) return { imageUrl: b64Match[1] };
      // \u53ef\u80fd\u76f4\u63a5\u662f URL
      const urlMatch = content.match(/(https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp|gif)[^\s"']*)/i);
      if (urlMatch) return { imageUrl: urlMatch[1] };
    }

    // Tiêu chuẩnĐịnh dạng: { data: [{ url }] }
    let taskId: string | undefined;
    const dataList = data.data;
    if (Array.isArray(dataList) && dataList.length > 0) {
      // Quay trực tiếp lại URL（doubao-seedream、DALL-E Đợi đã\u540c\u6b65Mô hình）
      if (dataList[0].url) return { imageUrl: dataList[0].url };
      taskId = dataList[0].task_id?.toString();
    }
    taskId = taskId || data.task_id?.toString();

    if (!taskId) {
      const directUrl = data.data?.[0]?.url || data.url;
      if (directUrl) return { imageUrl: directUrl };
      throw new Error('No task_id or image URL in response');
    }

    // Quay lại pollUrl \u4f9b\u8c03sử dụng\u65b9sử dụngTuỳ chỉnh\u8f6e\u8be2Đường dẫn
    const imagePaths = getImageEndpointPaths(endpointTypes || []);
    const rootBase = getRootBaseUrl(baseUrl);
    const pollUrl = `${rootBase}${imagePaths.poll(taskId)}`;
    return { taskId, pollUrl };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') throw new Error('API Yêu cầu\u8d85\u65f6');
      throw error;
    }
    throw new Error('Gọi Hình ảnhTạo Kh xảy ra trong APIông rõLỗi');
  }
}

/**
 * Poll task status until completion
 */
async function pollTaskStatus(
  taskId: string,
  apiKey: string,
  baseUrl: string,
  onProgress?: (progress: number) => void,
  customPollUrl?: string,
): Promise<string> {
  const maxAttempts = 120;
  const pollInterval = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const progress = Math.min(Math.floor((attempt / maxAttempts) * 100), 99);
    onProgress?.(progress);

    try {
      const rawUrl = customPollUrl || buildEndpoint(baseUrl, `images/generations/${taskId}`);
      const url = new URL(rawUrl);
      url.searchParams.set('_ts', Date.now().toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('Task not found');
        throw new Error(`Failed to check task status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[ImageGenerator] Task ${taskId} status:`, data);

      const status = (data.status ?? data.data?.status ?? 'unknown').toString().toLowerCase();
      const statusMap: Record<string, string> = {
        'pending': 'pending', 'submitted': 'pending', 'queued': 'pending',
        'processing': 'processing', 'running': 'processing', 'in_progress': 'processing',
        'completed': 'completed', 'succeeded': 'completed', 'success': 'completed',
        'failed': 'failed', 'error': 'failed',
      };
      const mappedStatus = statusMap[status] || 'processing';

      if (mappedStatus === 'completed') {
        onProgress?.(100);
        const images = data.result?.images ?? data.data?.result?.images;
        let resultUrl: string | undefined;
        if (images?.[0]) {
          const urlField = images[0].url;
          resultUrl = Array.isArray(urlField) ? urlField[0] : urlField;
        }
        resultUrl = resultUrl || data.output_url || data.result_url || data.url;
        if (!resultUrl) throw new Error('Task completed but no URL in result');
        return resultUrl;
      }

      if (mappedStatus === 'failed') {
        const rawError = data.error || data.error_message || data.data?.error;
        throw new Error(rawError ? String(rawError) : 'Task failed');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      if (error instanceof Error && 
          (error.message.includes('Task failed') || error.message.includes('no URL') || error.message.includes('Task not found'))) {
        throw error;
      }
      console.error(`[ImageGenerator] Poll attempt ${attempt} failed:`, error);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error('Hình ảnhTạo\u8d85\u65f6');
}

/**
 * Submit a grid/quad image generation request with smart API routing.
 * Handles both chat completions (Gemini) and images/generations (standard) endpoints.
 * Used by merged generation (chíncung điện\u683c) and quad grid (bốncung điện\u683c) in director and sclass panels.
 */
export async function submitGridImageRequest(params: {
  model: string;
  prompt: string;
  apiKey: string;
  baseUrl: string;
  aspectRatio: string;
  resolution?: string;
  referenceImages?: string[];
  /** Tùy chọn：\u4f20\u5165 keyManager \u540e，Thử lại\u65f6\u81ea\u52a8sử dụng\u8f6e\u6362\u540ecủa\u65b0 key */
  keyManager?: { getCurrentKey: () => string | null; handleError: (status: number, errorText?: string) => boolean };
  /** Bên ngoài\u90e8trong\u6b62\u4fe1\u53f7，sử dụng\u4e8eDừngTạo\u65f6\u771f\u6b63Huỷ\u7f51\u7edcYêu cầu */
  signal?: AbortSignal;
}): Promise<{ imageUrl?: string; taskId?: string; pollUrl?: string }> {
  const { model, prompt, apiKey, baseUrl, aspectRatio, resolution, referenceImages, keyManager, signal } = params;
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  // Phát hiện API Định dạng（với generateImage một\u81f4）
  const endpointTypes = useAPIConfigStore.getState().modelEndpointTypes[model];
  const apiFormat = resolveImageApiFormat(endpointTypes, model);
  console.log('[GridImageAPI] format:', apiFormat, 'model:', model);

  if (apiFormat === 'openai_chat') {
    // Gemini Đợi đãMô hìnhChấp nhận chat completions \u751f\u56fe
    const result = await submitViaChatCompletions(prompt, model, apiKey, normalizedBase, aspectRatio, referenceImages, resolution, keyManager, signal);
    return { imageUrl: result.imageUrl };
  }

  if (apiFormat === 'kling_image') {
    const result = await submitViaKlingImages({ prompt, aspectRatio, negativePrompt: undefined }, model, apiKey, normalizedBase, aspectRatio, keyManager);
    return { imageUrl: result.imageUrl, taskId: result.taskId };
  }

  // Tiêu chuẩn images/generations \u7aef\u70b9（aigc-image / vidu\u751f\u56fe điTuỳ chỉnhĐường dẫn）
  const imagePaths = getImageEndpointPaths(endpointTypes || []);
  const rootBase = getRootBaseUrl(normalizedBase);
  const endpoint = `${rootBase}${imagePaths.submit}`;
  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    aspect_ratio: aspectRatio,
  };
  if (resolution) {
    requestBody.resolution = resolution;
  }
  if (referenceImages && referenceImages.length > 0) {
    requestBody.image_urls = referenceImages;
  }

  console.log('[GridImageAPI] Submitting to', endpoint);

  const data = await retryOperation(async () => {
    // \u6bcflầnThử lại\u52a8\u6001\u53d6hiện tại key（\u5229sử dụng keyManager rotate \u540ecủa\u65b0 key）
    const currentApiKey = keyManager?.getCurrentKey?.() || apiKey;
    if (signal?.aborted) throw new Error('Người dùngĐã huỷ');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentApiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Thông báo keyManager \u5904\u7406Lỗi（Kích hoạt rotate）
      if (keyManager?.handleError) {
        keyManager.handleError(response.status, errorText);
      }
      let errorMessage = `API Thất bại: ${response.status}`;
      try {
        const errJson = JSON.parse(errorText);
        errorMessage = errJson.error?.message || errJson.message || errorMessage;
      } catch { /* ignore */ }
      if (errorText && errorText.length < 200) errorMessage = errorMessage || errorText;
      const err = new Error(errorMessage) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json();
  }, {
    maxRetries: 3,
    baseDelay: 3000,
    retryOn429: true,
  });
  console.log('[GridImageAPI] Response received');

  // GPT Image \u53ef\u80fdChấp nhận images/generations Quay lại choices Định dạng
  if (data.choices?.[0]?.message?.content) {
    const content = data.choices[0].message.content;
    const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
    if (mdMatch) return { imageUrl: mdMatch[1] };
    const b64Match = content.match(/(data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)/);
    if (b64Match) return { imageUrl: b64Match[1] };
    const urlMatch = content.match(/(https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp|gif)[^\s"']*)/i);
    if (urlMatch) return { imageUrl: urlMatch[1] };
  }

  // Tiêu chuẩnĐịnh dạng: { data: [{ url, task_id }] }
  const normalizeUrl = (url: any): string | undefined => {
    if (!url) return undefined;
    if (Array.isArray(url)) return url[0] || undefined;
    if (typeof url === 'string') return url;
    return undefined;
  };

  const dataField = data.data;
  const firstItem = Array.isArray(dataField) ? dataField[0] : dataField;

  const imageUrl = normalizeUrl(firstItem?.url)
    || normalizeUrl(firstItem?.image_url)
    || normalizeUrl(firstItem?.output_url)
    || normalizeUrl(data.url)
    || normalizeUrl(data.image_url)
    || normalizeUrl(data.output_url);

  const taskId = firstItem?.task_id?.toString()
    || firstItem?.id?.toString()
    || data.task_id?.toString()
    || data.id?.toString();

  // Chẳng hạn như\u679cChỉ Có taskId \u6ca1Có imageUrl，\u81ea\u52a8\u8f6e\u8be2\u83b7\u53d6kết quả（với generateImage hành vimột\u81f4）
  if (!imageUrl && taskId) {
    console.log('[GridImageAPI] Got taskId without imageUrl, polling...', taskId);
    const pollUrl = `${rootBase}${imagePaths.poll(taskId)}`;
    const polledUrl = await pollTaskStatus(taskId, params.keyManager?.getCurrentKey?.() || apiKey, normalizedBase, undefined, pollUrl);
    return { imageUrl: polledUrl, taskId };
  }

  // taskId \u5b58\u5728\u65f6\u9644\u5e26 pollUrl \u4f9bBên ngoài\u90e8\u8f6e\u8be2
  if (taskId) {
    const pollUrl = `${rootBase}${imagePaths.poll(taskId)}`;
    return { imageUrl, taskId, pollUrl };
  }

  return { imageUrl, taskId };
}

/**
 * Kling image \u539f\u751f\u7aef\u70b9Tạo
 * \u63d0\u4ea4Đến /kling/v1/images/generations hoặc /kling/v1/images/omni-image
 * \u8f6e\u8be2Đến /kling/v1/images/{path}/{task_id}
 */
async function submitViaKlingImages(
  params: { prompt: string; aspectRatio?: string; negativePrompt?: string },
  model: string,
  apiKey: string,
  baseUrl: string,
  aspectRatio: string,
  keyManager?: { getCurrentKey?: () => string | null; handleError?: (status: number, errorText?: string) => boolean },
): Promise<ImageGenerationResult> {
  const rootBase = baseUrl.replace(/\/v\d+$/, '');
  const nativePath = model === 'kling-omni-image'
    ? 'kling/v1/images/omni-image'
    : 'kling/v1/images/generations';

  const body: Record<string, any> = { prompt: params.prompt, model };
  if (aspectRatio) body.aspect_ratio = aspectRatio;
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;

  console.log('[ImageGenerator] Kling image →', nativePath, { model });

  const data = await retryOperation(async () => {
    const currentApiKey = keyManager?.getCurrentKey?.() || apiKey;
    const response = await fetch(`${rootBase}/${nativePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (keyManager?.handleError) {
        keyManager.handleError(response.status, errText);
      }
      const err = new Error(`Kling image API Lỗi: ${response.status} ${errText}`) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json();
  }, {
    maxRetries: 3,
    baseDelay: 3000,
    retryOn429: true,
    onRetry: (attempt, delay) => {
      console.warn(`[ImageGenerator] Kling image retry ${attempt}, delay ${delay}ms`);
    },
  });

  const directUrl = data.data?.[0]?.url;
  if (directUrl) return { imageUrl: directUrl };

  const taskId = data.data?.task_id;
  if (!taskId) throw new Error('Kling image Quay lại\u7a7aNhiệm vụ ID');

  const pollUrl = `${rootBase}/${nativePath}/${taskId}`;
  const pollInterval = 2000;
  const maxAttempts = 60;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, pollInterval));
    const currentApiKey = keyManager?.getCurrentKey?.() || apiKey;
    const pollResp = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${currentApiKey}` },
    });
    if (!pollResp.ok) continue;
    const pollData = await pollResp.json();
    const status = String(pollData.data?.task_status || '').toLowerCase();
    if (status === 'succeed' || status === 'success' || status === 'completed') {
      const imageUrl = pollData.data?.task_result?.images?.[0]?.url;
      if (!imageUrl) throw new Error('Kling image Thành công\u4f46không cóHình ảnh URL');
      return { imageUrl, taskId: String(taskId) };
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(pollData.data?.task_status_msg || 'Kling image TạoThất bại');
    }
  }
  throw new Error('Kling image Tạo\u8d85\u65f6');
}

/**
 * Convert image URL to persistent format
 * In Electron: saves to local file system and returns local-image:// path
 * In browser: converts to base64
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  // If already a local or base64 path, return as-is
  if (url.startsWith('data:image/') || url.startsWith('local-image://')) {
    return url;
  }
  
  // Try to use Electron local storage first
  if (typeof window !== 'undefined' && window.imageStorage) {
    try {
      const filename = `image_${Date.now()}.png`;
      const result = await window.imageStorage.saveImage(url, 'shots', filename);
      if (result.success && result.localPath) {
        console.log('[ImageGenerator] Saved image locally:', result.localPath);
        return result.localPath;
      }
    } catch (error) {
      console.warn('[ImageGenerator] Local save failed, falling back to base64:', error);
    }
  }
  
  // Fallback to base64 for non-Electron environments
  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  
  // Try direct fetch first
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      return await convertBlobToBase64(blob);
    }
  } catch (error) {
    console.warn('[ImageGenerator] Direct fetch failed, trying proxy:', error);
  }
  
  // Fallback: use our API proxy to fetch the image
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Proxy fetch failed: ${response.status}`);
    }
    const blob = await response.blob();
    return await convertBlobToBase64(blob);
  } catch (error) {
    console.warn('[ImageGenerator] Proxy fetch also failed:', error);
    throw error;
  }
}
