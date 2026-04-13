// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Adaptive Batch Processor — AI \u8c03\u5ea6trong\u5fc3cốt lõi\u7ec4\u4ef6 3
 *
 * \u804c\u8d23：\u5c06\u5927\u91cf items \u81ea\u52a8\u5206lô\u53d1\u7ed9 AI，\u540c\u65f6\u6ee1\u8db3 input và output token khoảng\u675f。
 *
 * cốt lõi\u7279\u6027：
 *   - \u53cc\u91cdkhoảng\u675f\u5206lô（input token + output token）
 *   - 60K token Hard Cap（\u9632\u6b62\u8d85\u957f\u4e0a\u4e0b\u6587Mô hình TTFT \u8fc7\u9ad8 / Lost in the middle）
 *   - \u5bb9\u9519\u9694\u79bb（\u5355batch thất bại\u4e0d\u5f71\u54cd\u5176\u4ed6lô，một phầnThành công\u4e5fQuay lạkết quả của tôi）
 *   - \u5355đợt thứử lại（\u6307\u6570\u9000\u907f，nhất 2 lần）
 *   - Đồng thờiđặt\u6210（\u590dsử dụng runStaggered + Người dùng concurrency Cài đặt）
 *   - Tiến độgọi lại
 */

import type { AIFeature } from '@/stores/api-config-store';
import { useAPIConfigStore } from '@/stores/api-config-store';
import { callFeatureAPI, type CallFeatureAPIOptions } from '@/lib/ai/feature-router';
import { getModelLimits, estimateTokens } from '@/lib/ai/model-registry';
import { runStaggered } from '@/lib/utils/concurrency';

// ==================== Constants ====================

/** không có\u8bbaMô hìnhHỗ trợ\u591a\u5927\u4e0a\u4e0b\u6587，\u6bcflô input nhất 60K token */
const HARD_CAP_TOKENS = 60000;

/** \u5355lô\u6700\u5927Thử lạtôi lần */
const MAX_BATCH_RETRIES = 2;

/** Thử lạiCơ bảnĐộ trễ（ms），\u6307\u6570\u9000\u907f */
const RETRY_BASE_DELAY = 3000;

// ==================== Types ====================

export interface ProcessBatchedOptions<TItem, TResult> {
  /** Chờ xử lýTất cả items */
  items: TItem[];

  /** AI chức năngLoại（sử dụng\u4e8etừ feature-router GetCấu hình） */
  feature: AIFeature;

  /**
   * \u6784\u5efa prompt chức năng — \u63a5\u6536mộtmột batch của items，Quay lại system + user prompt
   * \u6bcflô\u8c03sử dụngmộtlần，prompt trong\u5e94chứatình hình chung\u4e0a\u4e0b\u6587（sử dụng safeTruncate \u622a\u65ad）
   */
  buildPrompts: (batch: TItem[]) => { system: string; user: string };

  /**
   * Phân tích AI Quay lạtôi lànguyên bảvăn bảnchocó cấu trúckết quả
   * Quay lại Map<itemKey, result>，key sử dụng\u4e8e\u8de8lô\u5408\u5e76
   */
  parseResult: (raw: string, batch: TItem[]) => Map<string, TResult>;

  /**
   * Tùy chọn：Tuỳ chỉnh\u5408\u5e76\u903b\u8f91。Mặc định\u7b80\u5355\u5408\u5e76（\u540e\u8005\u8986\u76d6\u524d\u8005）
   */
  mergeResults?: (all: Map<string, TResult>[]) => Map<string, TResult>;

  /**
   * \u4f30\u7b97\u5355một item của input token \u5f00\u9500
   * Chẳng hạn như\u679c\u4e0d\u63d0\u4f9b，sử dụng estimateTokens(JSON.stringify(item))
   */
  estimateItemTokens?: (item: TItem) => number;

  /**
   * \u4f30\u7b97\u5355một item của output token \u5f00\u9500（sử dụng\u4e8e output khoảng\u675f）
   * Chẳng hạn như\u679c\u4e0d\u63d0\u4f9b，Mặc định 300 tokens/item
   */
  estimateItemOutputTokens?: (item: TItem) => number;

  /**
   * Tùy chọn：callFeatureAPI của\u989dBên ngoài\u9009\u9879（temperature, maxTokens Đợi đã）
   */
  apiOptions?: CallFeatureAPIOptions;

  /**
   * Tiến độgọi lại
   */
  onProgress?: (completed: number, total: number, message: string) => void;
}

export interface ProcessBatchedResult<TResult> {
  /** \u5408\u5e76\u540eTất cảkết quả */
  results: Map<string, TResult>;
  /** Thất bạtôi làlô\u6570 */
  failedBatches: number;
  /** \u603blô\u6570 */
  totalBatches: number;
}

// ==================== Core ====================

/**
 * \u81ea\u9002\u5e94lô\u5904\u7406 AI \u8c03sử dụng
 *
 * \u81ea\u52a8Hoàn thành：
 *   1. từ Registry \u67e5\u51faMô hình contextWindow và maxOutput
 *   2. \u53cc\u91cdkhoảng\u675f\u8d2a\u5fc3\u5206\u7ec4（input + output）
 *   3. Chấp nhận runStaggered Đồng thời\u6267được rồi
 *   4. \u5355đợt thứử lại + \u5bb9\u9519\u9694\u79bb
 *   5. \u5408\u5e76kết quả
 */
export async function processBatched<TItem, TResult>(
  opts: ProcessBatchedOptions<TItem, TResult>,
): Promise<ProcessBatchedResult<TResult>> {
  const {
    items,
    feature,
    buildPrompts,
    parseResult,
    mergeResults,
    estimateItemTokens,
    estimateItemOutputTokens,
    apiOptions,
    onProgress,
  } = opts;

  // \u7a7aĐầu vàoNhanh\u901fQuay lại
  if (items.length === 0) {
    return { results: new Map(), failedBatches: 0, totalBatches: 0 };
  }

  // === 1. \u83b7\u53d6Mô hình hạn chế ===
  const store = useAPIConfigStore.getState();
  const providerInfo = store.getProviderForFeature(feature);
  const modelName = providerInfo?.model?.[0] || '';
  const limits = getModelLimits(modelName);

  const inputBudget = Math.min(Math.floor(limits.contextWindow * 0.6), HARD_CAP_TOKENS);
  const outputBudget = Math.floor(limits.maxOutput * 0.8); // \u7559 20% \u7ed9 JSON Định dạng\u5f00\u9500

  console.log(
    `[BatchProcessor] ${feature}: model=${modelName}, ` +
    `ctx=${limits.contextWindow}, maxOutput=${limits.maxOutput}, ` +
    `inputBudget=${inputBudget}, outputBudget=${outputBudget}, ` +
    `items=${items.length}`,
  );

  // === 2. \u4f30\u7b97 system prompt của token \u5f00\u9500（sử dụngKhông.mộtmột item \u8bd5\u7b97） ===
  const samplePrompts = buildPrompts([items[0]]);
  const systemPromptTokens = estimateTokens(samplePrompts.system);

  // === 3. \u53cc\u91cdkhoảng\u675f\u8d2a\u5fc3\u5206\u7ec4 ===
  const defaultItemTokenEstimator = (item: TItem) => estimateTokens(JSON.stringify(item));
  const defaultItemOutputEstimator = () => 300; // Mặc định\u6bcf\u9879 300 output tokens

  const getItemTokens = estimateItemTokens || defaultItemTokenEstimator;
  const getItemOutputTokens = estimateItemOutputTokens || defaultItemOutputEstimator;

  const batches = createBatches(
    items,
    getItemTokens,
    getItemOutputTokens,
    inputBudget,
    outputBudget,
    systemPromptTokens,
  );

  console.log(
    `[BatchProcessor] \u5206lôkết quả: ${batches.length} lô ` +
    `(${batches.map(b => b.length).join(', ')} items)`,
  );

  // \u5355lôkhông có\u9700Đồng thời\u8c03\u5ea6
  if (batches.length === 1) {
    onProgress?.(0, 1, `Đang xử lý (1/1)...`);
    try {
      const result = await executeBatchWithRetry(
        batches[0], feature, buildPrompts, parseResult, apiOptions,
      );
      onProgress?.(1, 1, 'Hoàn thành');
      return { results: result, failedBatches: 0, totalBatches: 1 };
    } catch (err) {
      console.error('[BatchProcessor] Batch đơn thất bại:', err);
      onProgress?.(1, 1, 'Thất bại');
      return { results: new Map(), failedBatches: 1, totalBatches: 1 };
    }
  }

  // === 4. Đồng thời\u6267được rồi ===
  const concurrency = store.concurrency || 1;
  let completedCount = 0;

  const batchTasks = batches.map((batch, idx) => {
    return async () => {
      onProgress?.(completedCount, batches.length, `Đang xử lý batch ${idx + 1}/${batches.length}...`);
      const result = await executeBatchWithRetry(
        batch, feature, buildPrompts, parseResult, apiOptions,
      );
      completedCount++;
      onProgress?.(completedCount, batches.length, `Batch ${idx + 1} hoàn thành`);
      return result;
    };
  });

  const settled = await runStaggered(batchTasks, concurrency, 5000);

  // === 5. \u5bb9\u9519\u5408\u5e76 ===
  const successResults: Map<string, TResult>[] = [];
  let failedBatches = 0;

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      successResults.push(result.value);
    } else {
      failedBatches++;
      console.error('[BatchProcessor] Batch thất bại:', result.reason);
    }
  }

  if (failedBatches > 0) {
    console.warn(`[BatchProcessor] ${failedBatches}/${batches.length} batch thất bại, trả về kết quả một phần`);
  }

  // \u5408\u5e76
  let finalResults: Map<string, TResult>;
  if (mergeResults) {
    finalResults = mergeResults(successResults);
  } else {
    finalResults = new Map();
    for (const map of successResults) {
      for (const [key, value] of map) {
        finalResults.set(key, value);
      }
    }
  }

  onProgress?.(batches.length, batches.length, `Hoàn thành (${failedBatches > 0 ? `${failedBatches} batch thất bại` : 'Tất cả thành công'})`);

  return { results: finalResults, failedBatches, totalBatches: batches.length };
}

// ==================== Batch Splitting ====================

/**
 * \u53cc\u91cdkhoảng\u675f\u8d2a\u5fc3\u5206\u7ec4
 *
 * khoảng\u675f 1（Input）: \u6bcflô systemPromptTokens + sum(itemTokens) ≤ inputBudget
 * khoảng\u675f 2（Output）: sum(itemOutputTokens) ≤ outputBudget
 *
 * \u8d2a\u5fc3Chiến lược：\u4f9dlầnThêm item，\u4efbmộtkhoảng\u675f\u5373\u5c06\u8d85\u51fa\u65f6Bắt đầu\u65b0lô。
 * \u5355một item \u8d85\u51fa\u9884\u7b97\u65f6\u4ecdđộc lập\u6210lô（\u81f3\u5c11\u6bcflô 1 một item）。
 */
function createBatches<TItem>(
  items: TItem[],
  getItemTokens: (item: TItem) => number,
  getItemOutputTokens: (item: TItem) => number,
  inputBudget: number,
  outputBudget: number,
  systemPromptTokens: number,
): TItem[][] {
  const batches: TItem[][] = [];
  let currentBatch: TItem[] = [];
  let currentInputTokens = systemPromptTokens; // system prompt \u6bcflô\u90fd\u8981\u5e26
  let currentOutputTokens = 0;

  for (const item of items) {
    const itemInput = getItemTokens(item);
    const itemOutput = getItemOutputTokens(item);

    const wouldExceedInput = currentInputTokens + itemInput > inputBudget;
    const wouldExceedOutput = currentOutputTokens + itemOutput > outputBudget;

    if (currentBatch.length > 0 && (wouldExceedInput || wouldExceedOutput)) {
      // hiện tạilôĐã rồi\u6ee1，Bắt đầu\u65b0lô
      batches.push(currentBatch);
      currentBatch = [];
      currentInputTokens = systemPromptTokens;
      currentOutputTokens = 0;
    }

    currentBatch.push(item);
    currentInputTokens += itemInput;
    currentOutputTokens += itemOutput;
  }

  // \u6700\u540emộtmộtlô
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

// ==================== Batch Execution ====================

/**
 * \u6267được rồi\u5355mộtlô，Với Thử lại（\u6307\u6570\u9000\u907f，nhất MAX_BATCH_RETRIES lần）
 */
async function executeBatchWithRetry<TItem, TResult>(
  batch: TItem[],
  feature: AIFeature,
  buildPrompts: (batch: TItem[]) => { system: string; user: string },
  parseResult: (raw: string, batch: TItem[]) => Map<string, TResult>,
  apiOptions?: CallFeatureAPIOptions,
): Promise<Map<string, TResult>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_BATCH_RETRIES; attempt++) {
    try {
      const { system, user } = buildPrompts(batch);
      const raw = await callFeatureAPI(feature, system, user, apiOptions);
      return parseResult(raw, batch);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // TOKEN_BUDGET_EXCEEDED \u4e0dThử lại（Đầu vào\u592a\u5927，Thử lại\u4e5f\u6ca1sử dụng）
      if ((lastError as any).code === 'TOKEN_BUDGET_EXCEEDED') {
        throw lastError;
      }

      if (attempt < MAX_BATCH_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        console.warn(
          `[BatchProcessor] lô\u6267được rồiThất bại (attempt ${attempt + 1}/${MAX_BATCH_RETRIES + 1}), ` +
          `${delay}ms \u540eThử lại: ${lastError.message}`,
        );
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError!;
}
