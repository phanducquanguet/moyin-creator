// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * AI Feature Router
 * Routes AI requests to the bound provider based on feature bindings
 * 
 * v2: Hỗ trợ\u591aMô hìnhLiên kết + \u8f6e\u8be2\u8c03\u5ea6
 * 
 * Usage:
 *   const config = getFeatureConfig('character_generation');
 *   if (!config) {
 *     toast.error('\u8bf7đầu tiên\u5728Cài đặtTrung bình Cấu hìnhNhân vậtTạocủa API Nhà cung cấp');
 *     return;
 *   }
 *   // Use config.apiKey and config.provider in API call
 */

import { useAPIConfigStore, type AIFeature, type IProvider, AI_FEATURES } from '@/stores/api-config-store';
import { parseApiKeys, getProviderKeyManager, ApiKeyManager } from '@/lib/api-key-manager';

export interface FeatureConfig {
  feature: AIFeature;
  featureName: string;
  provider: IProvider;
  apiKey: string;
  allApiKeys: string[]; // All available API keys
  keyManager: ApiKeyManager; // For key rotation
  platform: string;
  baseUrl: string;
  models: string[];
  model: string; // hiện tại\u9009trongcủaMô hình
}

// \u591aMô hình\u8f6e\u8be2\u8c03\u5ea6\u5668：Bản ghi\u6bcfmộtchức năngcủahiện tại\u7d22\u5f15
const featureRoundRobinIndex: Map<AIFeature, number> = new Map();

/**
 * Default mapping for features to platforms (fallback when not explicitly bound)
 */
const FEATURE_PLATFORM_MAP: Partial<Record<AIFeature, string>> = {
  script_analysis: 'memefast',
  character_generation: 'memefast',
  video_generation: 'memefast',
  image_understanding: 'memefast',
  chat: 'memefast',
  freedom_image: 'memefast',
  freedom_video: 'memefast',
};

/**
 * Mặc địnhMô hình\u6620\u5c04：\u5f53Nhà cung cấp\u672a\u663e\u5f0fLiên kếtMô hình thời gian，cho\u7279\u5b9achức năng\u63d0\u4f9bMặc địnhMô hình
 * \u4ec5\u5728 fallback Đường dẫntrongsử dụng（Người dùng\u663e\u5f0fLiên kếtƯu tiên）
 */
const FEATURE_DEFAULT_MODEL: Partial<Record<AIFeature, Record<string, string>>> = {
  image_understanding: {
    memefast: 'gemini-3.1-pro-preview', // \u9b54\u97f3API Mặc định sử dụng Gemini 3.1 Pro
  },
};


/**
 * phân tích cú pháp platform:model Định dạng
 */
function parseBindingValue(binding: string): { platform: string; model?: string } | null {
  if (binding.includes(':')) {
    const [platform, model] = binding.split(':');
    return { platform, model };
  }
  return null;
}

/**
 * Get the platform and model from featureBindings (first binding)
 * featureBindings now stores: string[] (array of platform:model)
 * \u8fd9mộtchức năng\u4ec5sử dụng\u4e8e\u517c\u5bb9\u65e7\u4ee3\u7801，\u65b0\u4ee3\u7801\u5e94sử dụng getProvidersForFeature
 */
function getBoundPlatformAndModel(store: ReturnType<typeof useAPIConfigStore.getState>, feature: AIFeature): { platform: string; model?: string } | null {
  const bindings = store.getFeatureBindings(feature);
  if (!bindings || bindings.length === 0) return null;
  
  // \u53d6Không.mộtmộtLiên kết
  const binding = bindings[0];
  if (!binding) return null;
  
  // \u65b0Định dạng: platform:model
  const parsed = parseBindingValue(binding);
  if (parsed) {
    return parsed;
  }
  
  // \u517c\u5bb9\u65e7Định dạng: provider ID
  const provider = store.providers.find(p => p.id === binding);
  if (provider) return { platform: provider.platform };
  
  // \u517c\u5bb9\u65e7Định dạng: platform name
  const providerByPlatform = store.providers.find(p => p.platform === binding);
  if (providerByPlatform) return { platform: providerByPlatform.platform };
  
  // It might be a platform name that's not yet added
  return { platform: binding };
}

/**
 * Nhận chức năng Tất cảCó sẵnCấu hình（\u591aMô hình）
 */
export function getAllFeatureConfigs(feature: AIFeature): FeatureConfig[] {
  const store = useAPIConfigStore.getState();
  const providersWithModels = store.getProvidersForFeature(feature);
  const featureInfo = AI_FEATURES.find(f => f.key === feature);
  
  const configs: FeatureConfig[] = [];
  
  for (const { provider, model } of providersWithModels) {
    const keys = parseApiKeys(provider.apiKey);
    if (keys.length === 0) continue;
    
    const scopeKey = `${feature}:${model || 'default'}`;
    const keyManager = getProviderKeyManager(provider.id, provider.apiKey, scopeKey);
    
    configs.push({
      feature,
      featureName: featureInfo?.name || feature,
      provider,
      apiKey: keyManager.getCurrentKey() || keys[0],
      allApiKeys: keys,
      keyManager,
      platform: provider.platform,
      baseUrl: provider.baseUrl,
      models: [model],
      model,
    });
  }
  
  return configs;
}

/**
 * Get configuration for an AI feature (with round-robin for multi-model)
 * Returns null if feature is not configured (no provider bound or no API key)
 * 
 * v2: Hỗ trợ\u591aMô hình\u8f6e\u8be2
 */
export function getFeatureConfig(feature: AIFeature): FeatureConfig | null {
  const configs = getAllFeatureConfigs(feature);
  
  if (configs.length === 0) {
    // Fallback: \u5c1d\u8bd5sử dụng Mặc địnền tảng nh\u6620\u5c04
    const store = useAPIConfigStore.getState();
    const defaultPlatform = FEATURE_PLATFORM_MAP[feature];
    if (defaultPlatform) {
      const provider = store.providers.find(p => p.platform === defaultPlatform);
      if (provider) {
        const keys = parseApiKeys(provider.apiKey);
        if (keys.length > 0) {
          const fallbackModel = FEATURE_DEFAULT_MODEL[feature]?.[provider.platform] || provider.model?.[0] || '';
          const scopeKey = `${feature}:${fallbackModel || 'default'}`;
          const keyManager = getProviderKeyManager(provider.id, provider.apiKey, scopeKey);
          const featureInfo = AI_FEATURES.find(f => f.key === feature);
          // Ưu tiênsử dụngchức năngMặc địnhMô hình，\u5426\u5219\u53d6Nhà cung cấpKhông.mộtmộtMô hình
          const defaultModel = FEATURE_DEFAULT_MODEL[feature]?.[provider.platform];
          const model = defaultModel || provider.model?.[0] || '';
          return {
            feature,
            featureName: featureInfo?.name || feature,
            provider,
            apiKey: keyManager.getCurrentKey() || keys[0],
            allApiKeys: keys,
            keyManager,
            platform: provider.platform,
            baseUrl: provider.baseUrl,
            models: provider.model || [],
            model,
          };
        }
      }
    }
    console.warn(`[FeatureRouter] No provider bound for feature: ${feature}`);
    return null;
  }
  
  // \u5355Mô hìnhQuay trực tiếp lại
  if (configs.length === 1) {
    return configs[0];
  }
  
  // \u591aMô hình\u8f6e\u8be2
  const currentIndex = featureRoundRobinIndex.get(feature) || 0;
  const config = configs[currentIndex % configs.length];
  
  // Cập nhật\u7d22\u5f15（\u4e0blần\u8c03sử dụngsử dụng\u4e0bmộtmột）
  featureRoundRobinIndex.set(feature, currentIndex + 1);
  
  console.log(`[FeatureRouter] \u591aMô hình\u8f6e\u8be2: ${feature} -> ${config.provider.name}:${config.model} (${currentIndex % configs.length + 1}/${configs.length})`);
  
  return config;
}

/**
 * Đặt lại\u8f6e\u8be2\u7d22\u5f15（sử dụng\u4e8e\u65b0Nhiệm vụBắt đầu\u65f6）
 */
export function resetFeatureRoundRobin(feature?: AIFeature): void {
  if (feature) {
    featureRoundRobinIndex.set(feature, 0);
  } else {
    featureRoundRobinIndex.clear();
  }
}

/**
 * Check if a feature is properly configured
 */
export function isFeatureReady(feature: AIFeature): boolean {
  return getFeatureConfig(feature) !== null;
}

/**
 * Get error message for unconfigured feature
 */
export function getFeatureNotConfiguredMessage(feature: AIFeature): string {
  const featureInfo = AI_FEATURES.find(f => f.key === feature);
  const featureName = featureInfo?.name || feature;
  return `Vui lòng vào Cài đặt để liên kết nhà cung cấp API cho tính năng "${featureName}".`;
}

// ==================== \u7edfmột API \u8c03sử dụnglối vào ====================

import { callChatAPI } from '@/lib/script/script-parser';

export interface CallFeatureAPIOptions {
  /** Tuỳ chỉnhiệt độ，Mặc định 0.7 */
  temperature?: number;
  /** Tuỳ chỉnhmaxĐầbạn ra số token（Mặc định 4096，Lý luậnMô hình\u5efa\u8baeCài đặt cao hơn） */
  maxTokens?: number;
  /** lực lượng\u8986\u76d6Mô hình（một\u822c\u4e0d\u9700\u8981，Tự động thu được từ bản đồ dịch vụ） */
  modelOverride?: string;
  /** lực lượngsử dụng\u6307\u5b9aCấu hình（sử dụng\u4e8elô\u91cf\u8c03\u5ea6\u65f6\u6307\u5b9a\u5177\u4f53Mô hình） */
  configOverride?: FeatureConfig;
  /** ĐóngreasoningMô hình suy nghĩ sâu sắc（GLM-4.7/4.5 v.v.），Mặc định true */
  disableThinking?: boolean;
}

/**
 * \u7edfmộtcủa AI \u8c03sử dụnglối vào - Tự động thu được từ bản đồ dịch vụCấu hình
 * 
 * v2: Hỗ trợ\u591aMô hình\u8f6e\u8be2
 * 
 * Cách sử dụng：
 *   const result = await callFeatureAPI('script_analysis', systemPrompt, userPrompt);
 * 
 * \u4e0d\u9700\u8981tay\u52a8\u4f20 apiKey、baseUrl、model，Tất cảtừ\u670d\u52a1\u6620\u5c04\u81ea\u52a8\u83b7\u53d6
 */
export async function callFeatureAPI(
  feature: AIFeature,
  systemPrompt: string,
  userPrompt: string,
  options?: CallFeatureAPIOptions
): Promise<string> {
  // sử dụng\u6307\u5b9aCấu hìnhhoặc\u8f6e\u8be2\u83b7\u53d6
  const config = options?.configOverride || getFeatureConfig(feature);
  
  if (!config) {
    throw new Error(getFeatureNotConfiguredMessage(feature));
  }
  
  // từ\u670d\u52a1\u6620\u5c04\u83b7\u53d6Mô hình
  const model = options?.modelOverride || config.model || config.models?.[0];
  const baseUrl = config.baseUrl?.replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('Vui lòng cấu hình Base URL trong Cài đặt trước.');
  }
  if (!model) {
    throw new Error('Vui lòng cấu hình model trong Cài đặt trước.');
  }
  
  console.log(`[callFeatureAPI] chức năng: ${feature}`);
  console.log(`[callFeatureAPI] Nhà cung cấp: ${config.provider.name} (${config.platform})`);
  console.log(`[callFeatureAPI] Mô hình: ${model}`);
  console.log(`[callFeatureAPI] BaseURL: ${baseUrl}`);
  
  // \u8c03sử dụng\u5e95\u5c42 API
  // có cấu trúc JSON Đầu raNhiệm vụMặc địnhĐóngdeep suy nghĩ，Tránh cạn kiệt mã thông báo lý luận
  const disableThinking = options?.disableThinking ?? true;
  return await callChatAPI(systemPrompt, userPrompt, {
    apiKey: config.allApiKeys.join(','),
    provider: 'openai',
    baseUrl,
    model,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    keyManager: config.keyManager,
    disableThinking,
  });
}

/**
 * Hook-friendly version using Zustand subscription
 */
export function useFeatureConfig(feature: AIFeature): FeatureConfig | null {
  const getProviderForFeature = useAPIConfigStore(state => state.getProviderForFeature);
  const provider = getProviderForFeature(feature);
  
  if (!provider) return null;
  
  const keys = parseApiKeys(provider.apiKey);
  if (keys.length === 0) return null;
  
  const featureInfo = AI_FEATURES.find(f => f.key === feature);
  const model = provider.model?.[0] || '';
  const keyManager = getProviderKeyManager(provider.id, provider.apiKey, `${feature}:${model || 'default'}`);
  
  return {
    feature,
    featureName: featureInfo?.name || feature,
    provider,
    apiKey: keyManager.getCurrentKey() || keys[0],
    allApiKeys: keys,
    keyManager,
    platform: provider.platform,
    baseUrl: provider.baseUrl,
    models: provider.model || [],
    model,
  };
}

/**
 * Get all feature configurations for status display
 */
export function getAllFeatureStatuses(): Array<{
  feature: AIFeature;
  name: string;
  description: string;
  configured: boolean;
  providerName?: string;
}> {
  const store = useAPIConfigStore.getState();
  
  return AI_FEATURES.map(f => {
    const provider = store.getProviderForFeature(f.key);
    const configured = store.isFeatureConfigured(f.key);
    
    return {
      feature: f.key,
      name: f.name,
      description: f.description,
      configured,
      providerName: configured ? provider?.name : undefined,
    };
  });
}
