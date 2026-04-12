// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * RunningHub API Client
 * Góc nhìnChuyển đổichức năngcủaAPI\u5ba2\u6237\u7aef
 */

import { retryOperation } from '@/lib/utils/retry';
import type { HorizontalDirection, ElevationAngle, ShotSize } from './runninghub-angles';
import { generateAnglePrompt } from './runninghub-angles';

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

export interface RunningHubSubmitParams {
  referenceImage: string;  // \u539f\u56feURLhoặcbase64
  anglePrompt: string;     // Góc nhìnPrompt
  apiKey: string;
  baseUrl: string;
  appId: string;
  instanceType?: 'default' | 'plus';  // default: 24G\u663e\u5b58, plus: 48G\u663e\u5b58
  usePersonalQueue?: boolean;
}

export interface RunningHubTaskResult {
  taskId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
  resultUrl?: string;
}

/**
 * \u63d0\u4ea4Góc nhìnChuyển đổiNhiệm vụ
 */
export async function submitAngleSwitchTask(
  params: RunningHubSubmitParams
): Promise<string> {
  const { referenceImage, anglePrompt, apiKey, baseUrl, appId, instanceType = 'default', usePersonalQueue = false } = params;
  if (!baseUrl) {
    throw new Error('RunningHub URL cơ sở chưa được định cấu hình');
  }
  if (!appId) {
    throw new Error('RunningHub App ID Chưa được định cấu hình');
  }

  console.log('[RunningHub] Submitting angle switch task:', {
    anglePrompt,
    instanceType,
    hasReferenceImage: !!referenceImage,
  });

  const requestData = {
    nodeInfoList: [
      {
        nodeId: 'prompt_node',
        fieldName: 'text',
        fieldValue: anglePrompt,
      },
      {
        nodeId: 'image_node',
        fieldName: 'image',
        fieldValue: referenceImage,
      },
    ],
    instanceType,
    usePersonalQueue: usePersonalQueue.toString(),
  };

  try {
    const data = await retryOperation(async () => {
      const response = await fetch(`${normalizeBaseUrl(baseUrl)}/run/ai-app/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[RunningHub] Submit error:', response.status, errorText);

        let errorMessage = `RunningHub API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorJson.msg || errorMessage;
        } catch {
          if (errorText && errorText.length < 200) errorMessage = errorText;
        }

        const error = new Error(
          response.status === 401 || response.status === 403
            ? 'Khóa API không hợp lệ hoặc đã hết hạn'
            : response.status >= 500
              ? 'RunningHub Dịch vụ tạm thời không khả dụng'
              : errorMessage
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      return response.json();
    }, {
      maxRetries: 3,
      baseDelay: 3000,
      retryOn429: true,
    });

    console.log('[RunningHub] Submit response:', data);

    const taskId = data.taskId || data.task_id;
    if (!taskId) {
      throw new Error('No taskId in response');
    }

    return taskId;
  } catch (error) {
    console.error('[RunningHub] Submit failed:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('\u63d0\u4ea4 RunningHub Nhiệm vụThất bại');
  }
}

/**
 * Truy vấnNhiệm vụTrạng thái
 */
export async function queryTaskStatus(
  taskId: string,
  apiKey: string,
  baseUrl: string
): Promise<RunningHubTaskResult> {
  try {
    if (!baseUrl) {
      throw new Error('RunningHub URL cơ sở chưa được định cấu hình');
    }
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ taskId }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Task not found');
      }
      throw new Error(`Query failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[RunningHub] Task ${taskId} status:`, data);

    const status = (data.status || 'RUNNING').toUpperCase();
    let resultUrl: string | undefined;

    if (status === 'SUCCESS' && data.results && Array.isArray(data.results) && data.results.length > 0) {
      resultUrl = data.results[0].url;
    }

    return {
      taskId,
      status: status as RunningHubTaskResult['status'],
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      resultUrl,
    };
  } catch (error) {
    console.error(`[RunningHub] Query task ${taskId} failed:`, error);
    throw error;
  }
}

/**
 * \u8f6e\u8be2Nhiệm vụ\u76f4ĐếnHoàn thành
 */
export async function pollTaskUntilComplete(
  taskId: string,
  apiKey: string,
  baseUrl: string,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const maxAttempts = 120; // nhất2\u5206\u949f
  const pollInterval = 2000; // 2giây

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const progress = Math.min(Math.floor((attempt / maxAttempts) * 100), 99);
    
    try {
      const result = await queryTaskStatus(taskId, apiKey, baseUrl);
      
      onProgress?.(progress, result.status);

      if (result.status === 'SUCCESS') {
        if (!result.resultUrl) {
          throw new Error('Task completed but no result URL');
        }
        onProgress?.(100, 'SUCCESS');
        return result.resultUrl;
      }

      if (result.status === 'FAILED') {
        throw new Error(result.errorMessage || 'Task failed');
      }

      // QUEUED or RUNNING - continue polling
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      if (error instanceof Error && 
          (error.message.includes('Task failed') || error.message.includes('Task not found'))) {
        throw error;
      }
      console.error(`[RunningHub] Poll attempt ${attempt} failed:`, error);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error('Góc nhìnChuyển đổi\u8d85\u65f6，Xin vui lòng Thử lại');
}

/**
 * một\u952eTạoGóc nhìnChuyển đổi（\u7ec4\u5408chức năng）
 */
export async function generateAngleSwitch(params: {
  referenceImage: string;
  direction: HorizontalDirection;
  elevation: ElevationAngle;
  shotSize: ShotSize;
  apiKey: string;
  baseUrl: string;
  appId: string;
  onProgress?: (progress: number, status: string) => void;
}): Promise<string> {
  const { referenceImage, direction, elevation, shotSize, apiKey, baseUrl, appId, onProgress } = params;

  // TạoPrompt
  const anglePrompt = generateAnglePrompt(direction, elevation, shotSize);

  console.log('[RunningHub] Starting angle switch:', {
    direction,
    elevation,
    shotSize,
    prompt: anglePrompt,
  });

  // \u63d0\u4ea4Nhiệm vụ
  onProgress?.(0, 'SUBMITTING');
  const taskId = await submitAngleSwitchTask({
    referenceImage,
    anglePrompt,
    apiKey,
    baseUrl,
    appId,
  });

  // \u8f6e\u8be2kết quả
  onProgress?.(10, 'POLLING');
  const resultUrl = await pollTaskUntilComplete(taskId, apiKey, baseUrl, onProgress);

  return resultUrl;
}
