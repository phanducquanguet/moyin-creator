// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Model Capability Registry — AI \u8c03\u5ea6trong\u5fc3cốt lõi\u7ec4\u4ef6 1
 *
 * \u804c\u8d23：\u6839\u636eMô hìnhTênTruy vấn contextWindow và maxOutput \u9650\u5236。
 * Tìm kiếm ba cấp độ（ưu tiên\u9012\u51cf）：
 *   1. \u6301\u4e45\u5316bộ nhớ đệm（từ API Lỗitrong\u81ea\u52a8\u5b66Đếncủa\u771f\u5b9e\u9650\u5236）
 *   2. tĩnhĐăng ký\u8868（\u5b98\u65b9\u6587\u6863\u9a8c\u8bc1\u8fc7củaĐã rồi\u77e5Mô hình）
 *   3. _default \u4fdd\u5b88Mặc địgiá trị nh
 *
 * \u8bbe\u8ba1\u539f\u5219：
 *   - \u6309Mô hình tên\u67e5\u8868，\u4e0d\u6309 URL — memefast \u4ee3\u7406củaMô hìnhvà\u76f4\u8fdemột\u6837
 *   - prefix trận đấu\u6309chiều dài\u964d\u5e8f — \u907f\u514d\u77ed\u524d\u7f00\u8beftrận đấu\u66f4\u5177\u4f53củaMô hình
 *   - \u4ec5\u8986\u76d6 text/chat Mô hình — \u56fe\u50cf/Video/Âm thanh\u4e0dđi callChatAPI
 *   - \u4fdd\u5b88Mặc địgiá trị nh — Không rõMô hình\u5b81\u53ef\u591a\u5206lô\u4e5f\u4e0d\u649e\u9650\u5236
 */

// ==================== Types ====================

export interface ModelLimits {
  /** Mô hìnhmaxĐầu vào\u4e0a\u4e0b\u6587cửa sổ\u53e3（tokens） */
  contextWindow: number;
  /** Mô hìnhmaxĐầbạn ra số token（max_tokens Tham số\u4e0a\u9650） */
  maxOutput: number;
}

/** từ API 400 Lỗitrongkhám phácủaMô hình hạn chế（Kiên trì với localStorage） */
export interface DiscoveredModelLimits {
  maxOutput?: number;
  contextWindow?: number;
  /** khám phá thời gian\u6233 */
  discoveredAt: number;
}

// ==================== Static Registry ====================

/**
 * tĩnhĐăng ký\u8868 — \u4ec5\u542b\u5b98\u65b9\u6587\u6863\u9a8c\u8bc1\u8fc7của\u6570\u636e
 *
 * \u6570\u636eNguồn：
 *   - DeepSeek: https://api-docs.deepseek.com/quick_start/pricing (V3.2 = 128K context)
 *   - GLM: https://bigmodel.cn/pricing + \u591a\u65b9\u9a8c\u8bc1 (4.7 = 200K ctx / 128K output)
 *   - Gemini: https://ai.google.dev/gemini-api/docs/models + OCI docs (2.5 = 1M ctx / 65K output)
 *   - \u5176\u4ed6: \u4fdd\u5b88\u503c，\u6807Lưu ý"\u4fdd\u5b88"
 *
 * ⚠️ memefast \u4e0acủa\u540ctênMô hình sử dụng\u76f8\u540c\u9650\u5236。MớiMô hình\u5e94\u67e5\u9605\u5b98\u65b9\u6587\u6863\u540eThêm，\u4e0d\u53ef\u9760\u731c\u6d4b。
 */
const STATIC_REGISTRY: Record<string, ModelLimits> = {
  // ==================== DeepSeek \u7cfbCột ====================
  // DeepSeek-V3.2: 128K context limit
  // memefast Mô hìtên nh: deepseek-v3, deepseek-v3.2, deepseek-r1
  'deepseek-v3':            { contextWindow: 128000,   maxOutput: 8192   },
  'deepseek-v3.2':          { contextWindow: 128000,   maxOutput: 8192   },
  'deepseek-chat':          { contextWindow: 128000,   maxOutput: 8192   },
  'deepseek-r1':            { contextWindow: 128000,   maxOutput: 16384  },
  'deepseek-reasoner':      { contextWindow: 128000,   maxOutput: 16384  },

  // ==================== \u667a\u8c31 GLM \u7cfbCột ====================
  'glm-4.7':                { contextWindow: 200000,   maxOutput: 128000 },
  'glm-4.6v':               { contextWindow: 128000,   maxOutput: 8192   }, // \u4fdd\u5b88
  'glm-4.5-flash':          { contextWindow: 128000,   maxOutput: 8192   }, // \u4fdd\u5b88

  // ==================== Google Gemini \u7cfbCột ====================
  'gemini-2.5-flash':       { contextWindow: 1048576,  maxOutput: 65536  },
  'gemini-2.5-pro':         { contextWindow: 1048576,  maxOutput: 65536  },
  'gemini-3-flash-preview': { contextWindow: 1048576,  maxOutput: 65536  }, // \u6cbfsử dụng 2.5 \u89c4\u683c
  'gemini-3-pro-preview':   { contextWindow: 1048576,  maxOutput: 65536  },
  'gemini-2.0-flash':       { contextWindow: 1048576,  maxOutput: 8192   },

  // ==================== \u5176\u4ed6Mô hình（\u4fdd\u5b88\u503c） ====================
  'kimi-k2':                { contextWindow: 128000,   maxOutput: 8192   },
  'qwen3-max':              { contextWindow: 128000,   maxOutput: 8192   },
  'qwen3-max-preview':      { contextWindow: 128000,   maxOutput: 8192   },
  'minimax-m2.1':           { contextWindow: 128000,   maxOutput: 8192   },

  // ==================== phổ quát prefix quy tắc ====================
  // Lưu ý：prefix trận đấu\u6309chiều dài\u964d\u5e8f\u6267được rồi，\u957f key Ưu tiên
  'deepseek-':              { contextWindow: 128000,   maxOutput: 8192   },
  'gemini-':                { contextWindow: 1048576,  maxOutput: 65536  },
  'glm-':                   { contextWindow: 128000,   maxOutput: 8192   },
  'claude-':                { contextWindow: 200000,   maxOutput: 8192   },
  'gpt-':                   { contextWindow: 128000,   maxOutput: 16384  },
  'doubao-':                { contextWindow: 32000,    maxOutput: 4096   },

  // ==================== Mặc địgiá trị nh ====================
  '_default':               { contextWindow: 32000,    maxOutput: 4096   },
};

// Pre-sort keys by length descending for prefix matching
// Exclude '_default' from prefix search
const SORTED_KEYS = Object.keys(STATIC_REGISTRY)
  .filter(k => k !== '_default')
  .sort((a, b) => b.length - a.length);

// ==================== Discovery Cache Access ====================

// These are injected at runtime by the store (avoids circular dependency)
let _getDiscoveredLimits: ((model: string) => DiscoveredModelLimits | undefined) | null = null;
let _setDiscoveredLimits: ((model: string, limits: Partial<DiscoveredModelLimits>) => void) | null = null;

/**
 * Lưu ý\u5165\u6301\u4e45\u5316bộ nhớ đệmcủa\u8bfb\u5199chức năng（\u7531 api-config-store \u5728\u521d\u59cb\u5316\u65f6\u8c03sử dụng）
 * \u8fd9\u79cdchế độ\u907f\u514d\u4e86 model-registry ↔ api-config-store củaLặp lại\u4f9d\u8d56
 */
export function injectDiscoveryCache(
  getter: (model: string) => DiscoveredModelLimits | undefined,
  setter: (model: string, limits: Partial<DiscoveredModelLimits>) => void,
): void {
  _getDiscoveredLimits = getter;
  _setDiscoveredLimits = setter;
}

// ==================== Core Lookup ====================

/**
 * Truy vấnMô hình contextWindow và maxOutput \u9650\u5236
 *
 * Tìm kiếm ba cấp độ：
 *   1. \u6301\u4e45\u5316bộ nhớ đệm（Error-driven Discovery \u5b66Đếncủa\u771f\u5b9e\u9650\u5236）
 *   2. tĩnhĐăng ký\u8868（\u7cbe\u786etrận đấu → prefix trận đấu，prefix \u6309chiều dài\u964d\u5e8f）
 *   3. _default
 */
export function getModelLimits(modelName: string): ModelLimits {
  const m = modelName.toLowerCase();

  // Layer 1: \u6301\u4e45\u5316bộ nhớ đệm（\u6700\u51c6\u786e，từ API Lỗitrong\u5b66Đếncủa\u771f\u5b9e\u503c）
  if (_getDiscoveredLimits) {
    const discovered = _getDiscoveredLimits(m);
    if (discovered) {
      const staticFallback = lookupStatic(m);
      return {
        contextWindow: discovered.contextWindow ?? staticFallback.contextWindow,
        maxOutput: discovered.maxOutput ?? staticFallback.maxOutput,
      };
    }
  }

  // Layer 2 + 3: tĩnhĐăng ký\u8868 → _default
  return lookupStatic(m);
}

/**
 * \u4ec5từtĩnhĐăng ký\u8868\u67e5\u627e（\u4e0d\u67e5bộ nhớ đệm）
 */
function lookupStatic(modelNameLower: string): ModelLimits {
  // \u7cbe\u786etrận đấu
  if (STATIC_REGISTRY[modelNameLower]) {
    return STATIC_REGISTRY[modelNameLower];
  }

  // prefix trận đấu（chiều dài\u964d\u5e8f\u4fdd\u8bc1\u6700\u5177\u4f53củađầu tiên\u547dtrong）
  for (const key of SORTED_KEYS) {
    if (modelNameLower.startsWith(key)) {
      return STATIC_REGISTRY[key];
    }
  }

  // Hãy ghi nhớ mọi thứ
  return STATIC_REGISTRY['_default'];
}

// ==================== Error-driven Discovery ====================

/**
 * từ API 400 LỗiTin nhắntrongphân tích cú phápMô hình hạn chế
 *
 * \u8986\u76d6Chúa ơi\u6d41 API củaLỗiĐịnh dạng：
 *   - DeepSeek: "Invalid max_tokens value, the valid range of max_tokens is [1, 8192]"
 *   - OpenAI:   "maximum context length is 128000 tokens ... you requested 150000 tokens"
 *   - \u667a\u8c31:     "max_tokens must be less than or equal to 8192"
 *   - phổ quát:     "max_tokens ... 8192" Đợi đã\u5404\u79cdthay đổi\u4f53
 *
 * @returns phân tích rcủa một\u9650\u5236（\u53ef\u80fdChỉ Có maxOutput hoặc contextWindow hoặc\u4e24\u8005\u90fdCó），
 *          Chẳng hạn như\u679c\u6b63\u5219\u672atrận đấuĐến\u4efb\u4f55\u6570\u503c\u5219Quay lại null（\u4f18\u96c5Hạ cấp，\u4e0d\u4f1a\u6b7bLặp lại）
 */
export function parseModelLimitsFromError(errorText: string): Partial<DiscoveredModelLimits> | null {
  const result: Partial<DiscoveredModelLimits> = {};
  let found = false;

  // --- phân tích cú pháp max_tokens / maxOutput ---
  // Pattern 1: "valid range of max_tokens is [1, 8192]"
  const rangeMatch = errorText.match(/valid\s+range.*?\[\s*\d+\s*,\s*(\d+)\s*\]/i);
  if (rangeMatch) {
    result.maxOutput = parseInt(rangeMatch[1], 10);
    found = true;
  }

  // Pattern 2: "max_tokens must be less than or equal to 8192" / "max_tokens ... <= 8192"
  if (!found) {
    const lteMatch = errorText.match(/max_tokens.*?(?:less than or equal to|<=|\u4e0d\u8d85\u8fc7|\u4e0a\u9650cho?)\s*(\d{3,6})/i);
    if (lteMatch) {
      result.maxOutput = parseInt(lteMatch[1], 10);
      found = true;
    }
  }

  // Pattern 3: Generic fallback — "max_tokens" \u9644\u8fd1củacon số
  if (!found) {
    const genericMatch = errorText.match(/max_tokens.*?\b(\d{3,6})\b/i);
    if (genericMatch) {
      result.maxOutput = parseInt(genericMatch[1], 10);
      found = true;
    }
  }

  // --- phân tích cú pháp context window ---
  // Pattern: "context length is 128000" / "maximum context length is 128000 tokens"
  const ctxMatch = errorText.match(/context.*?length.*?(\d{4,7})/i);
  if (ctxMatch) {
    result.contextWindow = parseInt(ctxMatch[1], 10);
    found = true;
  }

  // Pattern: "maximum ... 128000 tokens" (OpenAI Phong cách)
  if (!result.contextWindow) {
    const maxTokensCtx = errorText.match(/maximum.*?(\d{4,7})\s*tokens/i);
    if (maxTokensCtx) {
      result.contextWindow = parseInt(maxTokensCtx[1], 10);
      found = true;
    }
  }

  if (!found) return null;

  result.discoveredAt = Date.now();
  return result;
}

/**
 * \u5c06khám phácủa\u9650\u5236\u5199\u5165\u6301\u4e45\u5316bộ nhớ đệm
 * @returns true nếu Thành công\u5199\u5165，false Chẳng hạn như\u679cbộ nhớ đệm\u672aLưu ý\u5165
 */
export function cacheDiscoveredLimits(
  modelName: string,
  limits: Partial<DiscoveredModelLimits>,
): boolean {
  if (!_setDiscoveredLimits) return false;
  _setDiscoveredLimits(modelName.toLowerCase(), limits);
  console.log(
    `[ModelRegistry] 🧠 Đã rồi\u5b66\u4e60 ${modelName} của\u9650\u5236:`,
    limits.maxOutput != null ? `maxOutput=${limits.maxOutput}` : '',
    limits.contextWindow != null ? `contextWindow=${limits.contextWindow}` : '',
  );
  return true;
}

// ==================== Utility ====================

/**
 * Token \u4f30\u7b97（\u4fdd\u5b88\u7b97\u6cd5）
 *
 * sử dụng từ\u7b26\u6570/1.5 \u4f5ccho\u4fdd\u5b88\u4e0a\u9650：
 *   - Tiếng Trung: 1 token ≈ 0.6~1.0 \u6c49từ，/1.5 \u76f8\u5f53\u4e8e\u653e\u5927\u4f30\u7b97（\u504f\u5b89\u5168）
 *   - Tiếng Anh/\u6807\u70b9/JSON: 1 token ≈ 3~4 từ\u7b26，/1.5 \u4e5f\u504f\u5b89\u5168
 *   - \u5b81\u53ef\u9ad8\u4f30 token \u6570（\u591a\u5206lô），\u4e5f\u4e0d\u4f4e\u4f30（\u649e\u9650\u5236）
 *   - \u4e0dgiới thiệu tiktoken Đợi đã\u91cd\u578b\u5e93，\u907f\u514dgiao diện người dùng WASM \u517c\u5bb9\u6027và\u4f53\u79ef\u95ee\u9898
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 1.5);
}

/**
 * \u667a\u80fd\u622a\u65ad\u6587\u672c，\u4e0d\u5728\u53e5\u5b50hoặc\u6bb5\u843dtrong\u95f4\u5207\u65ad
 * \u907f\u514d\u622a\u65ad\u5bfc\u81f4 JSON \u7ed3\u6784\u635f\u574fhoặc AI \u7406\u89e3\u6df7\u4e71
 *
 * @param text nguyên bảvăn bản
 * @param maxLength \u6700\u5927từ\u7b26\u6570
 * @param hint \u622a\u65ad\u65f6\u8ffd\u52a0củaGợi ý\u540e\u7f00（Trợ giúp AI \u7406\u89e3thông tin\u4e0d\u5b8c\u6574，\u51cf\u5c11\u5e7b\u89c9）
 */
export function safeTruncate(
  text: string,
  maxLength: number,
  hint: string = '...[\u540e\u7eedbên trong\u5bb9Đã rồi\u622a\u65ad]',
): string {
  if (text.length <= maxLength) return text;

  // cho hint \u9884Để trống\u95f4
  const budget = maxLength - hint.length;
  if (budget <= 0) return text.slice(0, maxLength);

  const sliced = text.slice(0, budget);

  // Ưu tiên\u5728dòng mới\u5904\u622a\u65ad（\u4fdd\u7559\u5b8c\u6574\u6bb5\u843d）
  const lastNewline = sliced.lastIndexOf('\n');
  if (lastNewline > budget * 0.8) {
    return sliced.slice(0, lastNewline) + hint;
  }

  // \u5176lần\u5728Tiếng Trung/Tiếng Anh\u53e5\u672b\u622a\u65ad（\u4fdd\u7559\u5b8c\u6574\u53e5\u5b50）
  const lastSentenceEnd = Math.max(
    sliced.lastIndexOf('。'),
    sliced.lastIndexOf('！'),
    sliced.lastIndexOf('？'),
    sliced.lastIndexOf('. '),
  );
  if (lastSentenceEnd > budget * 0.8) {
    return sliced.slice(0, lastSentenceEnd + 1) + hint;
  }

  return sliced + hint;
}
