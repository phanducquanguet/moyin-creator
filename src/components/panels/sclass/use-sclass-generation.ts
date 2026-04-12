// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * use-sclass-generation.ts — lớp S Seedance 2.0 VideoTạo Hook
 *
 * Chức năng cốt lõi：
 * 1. generateGroupVideo(group) — \u5355Nhóm Tạo：\u6536đặt @\u5f15sử dụng → \u6784\u5efa\u591a\u6a21\u6001Yêu cầu → \u8c03sử dụng API → \u8f6e\u8be2
 * 2. generateAllGroups() — Lô Tạo：\u9010\u7ec4\u4e32được rồi，\u5404\u7ec4độc lậpTạo
 * 3. generateSingleShot(sceneId) — thấu kính đơn Tạo（\u517c\u5bb9chế độ）
 * 4. Tự động Tải lên base64/local Hình ảnhĐến HTTP URL
 * 5. TạoTrạng thái\u5b9e\u65f6\u540c\u6b65Đến sclass-store
 */

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  useSClassStore,
  type ShotGroup,
  type AssetRef,
  type GenerationRecord,
  type SClassAspectRatio,
  type SClassResolution,
  type SClassDuration,
  type VideoGenStatus,
} from "@/stores/sclass-store";
import { useDirectorStore, useActiveDirectorProject, type SplitScene } from "@/stores/director-store";
import { useCharacterLibraryStore } from "@/stores/character-library-store";
import { useSceneStore } from "@/stores/scene-store";
import {
  getFeatureConfig,
  getFeatureNotConfiguredMessage,
} from "@/lib/ai/feature-router";
import {
  callVideoGenerationApi,
  buildImageWithRoles,
  convertToHttpUrl,
  saveVideoLocally,
  isContentModerationError,
} from "../director/use-video-generation";
import {
  buildGroupPrompt,
  collectAllRefs,
  mergeToGridImage,
  SEEDANCE_LIMITS,
  type GroupPromptResult,
} from "./sclass-prompt-builder";

// ==================== Types ====================

export interface GroupGenerationResult {
  groupId: string;
  success: boolean;
  videoUrl: string | null;
  error: string | null;
}

export interface BatchGenerationProgress {
  total: number;
  completed: number;
  current: string | null;
  results: GroupGenerationResult[];
}

// ==================== Hook ====================

export function useSClassGeneration() {
  const abortRef = useRef(false);

  // ========== Store access ==========

  const {
    activeProjectId,
    getProjectData,
    updateGroupVideoStatus,
    addGroupHistory,
    updateSingleShotVideo,
    updateConfig,
    updateShotGroup,
    addShotGroup,
  } = useSClassStore();

  const projectData = useActiveDirectorProject();
  const splitScenes = projectData?.splitScenes || [];
  const characters = useCharacterLibraryStore((s) => s.characters);
  const scenes = useSceneStore((s) => s.scenes);

  // ========== Helpers ==========

  /** \u83b7\u53d6\u7ec4bên trongCảnh danh sách */
  const getGroupScenes = useCallback(
    (group: ShotGroup): SplitScene[] => {
      return group.sceneIds
        .map((id: number) => splitScenes.find((s: SplitScene) => s.id === id))
        .filter(Boolean) as SplitScene[];
    },
    [splitScenes]
  );

  /** \u5c06 @\u5f15sử dụngtrongHình ảnh URL \u8f6ccho HTTP URL */
  const prepareImageUrls = useCallback(
    async (
      refs: AssetRef[]
    ): Promise<Array<{ url: string; role: "first_frame" | "last_frame" }>> => {
      const imageWithRoles: Array<{
        url: string;
        role: "first_frame" | "last_frame";
      }> = [];

      for (let i = 0; i < refs.length; i++) {
        const ref = refs[i];
        const httpUrl = await convertToHttpUrl(ref.localUrl, {
          fallbackHttpUrl: ref.httpUrl,
          uploadName: ref.fileName,
        });
        if (httpUrl) {
          // Không.một mảnh\u56fe\u4f5ccho first_frame，Phần còn lại\u4f5ccho last_frame
          imageWithRoles.push({
            url: httpUrl,
            role: i === 0 ? "first_frame" : "last_frame",
          });
        }
      }

      return imageWithRoles;
    },
    []
  );

  // ========== \u5355Nhóm Tạo ==========

  const generateGroupVideo = useCallback(
    async (
      group: ShotGroup,
      options?: {
        /** Tiến độgọi lại */
        onProgress?: (progress: number) => void;
        /** \u6784\u5efa\u5b8cbiểu đồ lưới+prompt \u540e，\u8be2\u95eeNgười dùng\u662f\u5426Tiếp tục Tạo video；Quay lại false \u5219trong\u6b62 */
        confirmBeforeGenerate?: () => Promise<boolean>;
        /** \u524d\u7ec4Video URL（\u94fe\u5f0fThử lại\u65f6\u4f20\u5165，sử dụng\u4e8e\u8854\u63a5\u524d\u540e\u7ec4Video） */
        prevVideoUrl?: string;
      }
    ): Promise<GroupGenerationResult> => {
      const projectId = activeProjectId;
      if (!projectId) {
        return {
          groupId: group.id,
          success: false,
          videoUrl: null,
          error: "không có\u6d3b\u8dc3Dự án",
        };
      }

      // 1. \u83b7\u53d6 API Cấu hình
      const featureConfig = getFeatureConfig("video_generation");
      if (!featureConfig) {
        const msg = getFeatureNotConfiguredMessage("video_generation");
        return {
          groupId: group.id,
          success: false,
          videoUrl: null,
          error: msg,
        };
      }

      const keyManager = featureConfig.keyManager;
      if (!keyManager.getCurrentKey()) {
        return {
          groupId: group.id,
          success: false,
          videoUrl: null,
          error: "\u8bf7đầu tiên\u5728Cài đặtTrung bình Cấu hìnhVideoTạo API Key",
        };
      }
      const sclassProjectData = getProjectData(projectId);
      const sclassConfig = sclassProjectData.config;

      // 1b. từ director-store \u76f4\u8bfbtổng cộng\u4eabCấu hình（\u5355một\u6570\u636e\u6e90，\u907f\u514d\u53cc store \u540c\u6b65\u95ee\u9898）
      const directorState = useDirectorStore.getState();
      const directorProject = directorState.projects[directorState.activeProjectId || ''];
      const storyboardConfig = directorProject?.storyboardConfig;
      const aspectRatio = (storyboardConfig?.aspectRatio || '16:9') as SClassAspectRatio;
      const videoResolution = (storyboardConfig?.videoResolution || '720p') as SClassResolution;
      const styleTokens = storyboardConfig?.styleTokens;

      // 2. \u83b7\u53d6\u7ec4bên trongCảnh
      const groupScenes = getGroupScenes(group);
      if (groupScenes.length === 0) {
        return {
          groupId: group.id,
          success: false,
          videoUrl: null,
          error: "\u7ec4bên trongKhông Cảnh",
        };
      }

      // 3. Cài đặtTạotrongTrạng thái
      updateGroupVideoStatus(group.id, {
        videoStatus: "generating",
        videoProgress: 0,
        videoError: null,
      });

      try {
      // 4. từ\u7ec4bên trongPhân cảnh\u805a\u5408Âm thanh/\u8fd0\u955cCài đặt
        const isExtendOrEdit = group.generationType === 'extend' || group.generationType === 'edit';
        const hasAnyDialogue = groupScenes.some(s => s.audioDialogueEnabled !== false && s.dialogue?.trim());
        const hasAnyAmbient = groupScenes.some(s => s.audioAmbientEnabled !== false);
        const hasAnySfx = groupScenes.some(s => s.audioSfxEnabled !== false);
        const enableAudio = hasAnyDialogue || hasAnyAmbient || hasAnySfx;
        const enableLipSync = hasAnyDialogue;

        // camerafixed: Tất cảPhân cảnh\u8fd0\u955ccho Static hoặccho\u7a7a → \u9501\u5b9a\u8fd0\u955c
        const allStaticCamera = groupScenes.every(s => {
          const cm = (s.cameraMovement || '').toLowerCase().trim();
          return !cm || cm === 'static' || cm === '\u56fa\u5b9a' || cm === '\u9759\u6b62';
        });

        // 4b. \u6784\u5efabiểu đồ lưới（\u5408\u5e76khung hình đầu tiên hoặc \u590dsử dụngbộ nhớ đệm）
        // mở rộng/Chỉnh sửa\u7ec4bỏ quabiểu đồ lưới — \u5b83\u4eeccủakhung hình đầu tiênTài liệu tham khảo\u6765\u81ea sourceVideoUrl
        let gridImageRef: AssetRef | null = null;

        if (!isExtendOrEdit) {
          const sceneIds = group.sceneIds;

          // \u68c0\u67e5\u662f\u5426\u53ef\u590dsử dụngbộ nhớ đệmcủachíncung điện\u683c\u56fe
          const cachedGridUrl = sclassProjectData.lastGridImageUrl;
          const cachedSceneIds = sclassProjectData.lastGridSceneIds;
          const canReuseGrid = cachedGridUrl &&
            cachedSceneIds &&
            sceneIds.length === cachedSceneIds.length &&
            sceneIds.every((id, i) => id === cachedSceneIds[i]);

          // \u6536đặt\u7ec4bên trongPhân cảnhkhung hình đầu tiênHình ảnh
          const firstFrameUrls = groupScenes
            .map(s => s.imageDataUrl || s.imageHttpUrl || '')
            .filter(Boolean);

          if (firstFrameUrls.length > 0) {
            let gridDataUrl: string;
            if (canReuseGrid) {
              // \u590dsử dụng\u6b65\u9aa4③Lưucủanguyên bảnchíncung điện\u683c\u56fe
              gridDataUrl = cachedGridUrl!;
              console.log('[SClassGen] \u590dsử dụngbộ nhớ đệmchíncung điện\u683c\u56fe:', gridDataUrl.substring(0, 60));
            } else {
              // \u91cd\u65b0\u5408\u5e76khung hình đầu tiênchobiểu đồ lưới
              gridDataUrl = await mergeToGridImage(firstFrameUrls, aspectRatio);
              console.log('[SClassGen] Đã rồi\u5408\u5e76', firstFrameUrls.length, '\u5f20khung hình đầu tiênchobiểu đồ lưới');
            }

            gridImageRef = {
              id: 'grid_image',
              type: 'image',
              tag: '@Hình ảnh1',
              localUrl: gridDataUrl,
              httpUrl: gridDataUrl.startsWith('http') ? gridDataUrl : null,
              fileName: 'grid_image.png',
              fileSize: 0,
              duration: null,
              purpose: 'grid_image',
            };
          }
        }

        // 4c. \u6784\u5efa prompt（\u4f20\u5165biểu đồ lưới\u5f15sử dụng + Phong cách tokens）
        const promptResult: GroupPromptResult = buildGroupPrompt({
          group,
          scenes: groupScenes,
          characters,
          sceneLibrary: scenes,
          styleTokens: styleTokens || undefined,
          aspectRatio,
          enableLipSync,
          gridImageRef,
        });

        if (promptResult.refs.overLimit) {
          console.warn(
            "[SClassGen] Chất liệu\u8d85\u9650:",
            promptResult.refs.limitWarnings
          );
        }

        // 4d. Lưubiểu đồ lưới + prompt Đến group（sử dụng\u4e8e UI Xem trước/\u590d\u5236）
        updateShotGroup(group.id, {
          gridImageUrl: gridImageRef?.localUrl || null,
          lastPrompt: promptResult.prompt || null,
        });

        // 4e. Xác nhận liệu Tiếp tục Tạo video（Người dùng\u53ef\u5728\u6b64\u5904\u4ec5Xem trướcbiểu đồ lưới/prompt \u540etrong\u6b62）
        if (options?.confirmBeforeGenerate) {
          const proceed = await options.confirmBeforeGenerate();
          if (!proceed) {
            // Người dùngHuỷ，Đặt lạiTrạng thái\u4f46\u4fdd\u7559 gridImageUrl + lastPrompt
            updateGroupVideoStatus(group.id, {
              videoStatus: 'idle',
              videoProgress: 0,
            });
            return {
              groupId: group.id,
              success: false,
              videoUrl: null,
              error: null,
            };
          }
        }

        // 5. Thu thậpHình ảnh tham khảo → \u8f6c HTTP URL
        const imageRefs = promptResult.refs.images;
        const imageWithRoles = await prepareImageUrls(imageRefs);

        // 5b. \u6536đặtVideo/Âm thanh quote → \u8f6c HTTP URL（Seedance 2.0 \u591a\u6a21\u6001Đầu vào）
        const videoRefUrls: string[] = [];
        // \u524d\u7ec4Video\u8854\u63a5（\u94fe\u5f0fThử lại\u65f6\u4f20\u5165）— mở rộng/Chỉnh sửa\u7ec4Đã rồi\u5728 refs.videos trong\u643a\u5e26 sourceVideoUrl，bỏ qua
        if (!isExtendOrEdit && options?.prevVideoUrl) {
          const prevHttpUrl = await convertToHttpUrl(options.prevVideoUrl).catch(() => "");
          if (prevHttpUrl) videoRefUrls.push(prevHttpUrl);
        }
        for (const vRef of promptResult.refs.videos) {
          const httpUrl = vRef.httpUrl || (await convertToHttpUrl(vRef.localUrl).catch(() => ""));
          if (httpUrl) videoRefUrls.push(httpUrl);
        }
        const audioRefUrls: string[] = [];
        for (const aRef of promptResult.refs.audios) {
          const httpUrl = aRef.httpUrl || (await convertToHttpUrl(aRef.localUrl).catch(() => ""));
          if (httpUrl) audioRefUrls.push(httpUrl);
        }

        updateGroupVideoStatus(group.id, { videoProgress: 10 });

        // 6. \u8c03sử dụngVideoTạo API
        const prompt =
          promptResult.prompt || `Multi-shot video: ${group.name}`;
        const duration = Math.max(
          SEEDANCE_LIMITS.minDuration,
          Math.min(SEEDANCE_LIMITS.maxDuration, group.totalDuration || sclassConfig.defaultDuration)
        );

        console.log("[SClassGen] Generating group video:", {
          groupId: group.id,
          groupName: group.name,
          scenesCount: groupScenes.length,
          promptLength: prompt.length,
          imagesCount: imageWithRoles.length,
          videoRefsCount: videoRefUrls.length,
          audioRefsCount: audioRefUrls.length,
          duration,
          aspectRatio,
          videoResolution,
        });

        const maxVideoAttempts = Math.max(1, Math.min(keyManager.getTotalKeyCount(), 6));
        let videoUrl: string | null = null;
        let lastVideoError: Error | null = null;

        for (let attempt = 0; attempt < maxVideoAttempts; attempt++) {
          const currentApiKey = keyManager.getCurrentKey() || "";
          if (!currentApiKey) break;

          try {
            videoUrl = await callVideoGenerationApi(
              currentApiKey,
              prompt,
              duration,
              aspectRatio,
              imageWithRoles,
              (progress) => {
                const mappedProgress = 10 + Math.floor(progress * 0.85);
                updateGroupVideoStatus(group.id, {
                  videoProgress: mappedProgress,
                });
                options?.onProgress?.(mappedProgress);
              },
              keyManager,
              featureConfig.platform,
              videoResolution,
              videoRefUrls.length > 0 ? videoRefUrls : undefined,
              audioRefUrls.length > 0 ? audioRefUrls : undefined,
              enableAudio,
              allStaticCamera,
            );
            lastVideoError = null;
            break;
          } catch (error) {
            const err = error as Error & { status?: number };
            lastVideoError = err;
            const message = err.message || "";
            const statusMatch = message.match(/\b(4\d\d|5\d\d)\b/);
            const parsedStatus = typeof err.status === "number"
              ? err.status
              : (statusMatch ? Number(statusMatch[1]) : undefined);
            const alreadyRotatedByInner = typeof err.status === "number"
              && [400, 401, 403, 429, 500, 502, 503, 529].includes(err.status);
            const fallbackStatus = /model|Mô hình/i.test(message)
              && /not support|unsupported|không có\u6743\u9650|Không đủ quyền|\u672a\u5f00\u901a|\u4e0dCó sẵn/i.test(message)
              ? 400
              : undefined;
            const statusForHandle = parsedStatus ?? fallbackStatus;
            const rotated = alreadyRotatedByInner
              ? true
              : (typeof statusForHandle === "number" ? keyManager.handleError(statusForHandle, message) : false);
            const retryableByMessage = /429|500|502|503|529|too many requests|rate|quota|service unavailable|overloaded|internal server error|server error|tải ngược dòng|dịch vụ thượng nguồn|bão hòa|Tạm thời không có|Dịch vụ tạm thời không khả dụng|api key|không có\u6548|\u8fc7\u671f|model|Mô hình|\u4e0dHỗ trợ|\u6743\u9650|\u672a\u5f00\u901a/.test(message.toLowerCase());
            const canRetry = attempt < maxVideoAttempts - 1 && (rotated || retryableByMessage);

            if (canRetry) {
              console.warn(`[SClassGen] Group video retry with next key (${attempt + 1}/${maxVideoAttempts})`, {
                groupId: group.id,
                status: statusForHandle,
                message: message.substring(0, 160),
              });
              continue;
            }
            throw err;
          }
        }

        if (!videoUrl) {
          throw lastVideoError || new Error("VideoTạoThất bại：\u6ca1CóCó sẵn API Key");
        }

        // 7. LưuVideoĐến\u672c\u5730
        const localUrl = await saveVideoLocally(
          videoUrl,
          group.sceneIds[0] || 0
        );

        // 8. Cập nhậtTrạng thái → Hoàn thành
        updateGroupVideoStatus(group.id, {
          videoStatus: "completed",
          videoProgress: 100,
          videoUrl: localUrl,
          videoError: null,
        });

        // 9. Bản ghiLịch sử
        const record: GenerationRecord = {
          id: `gen_${Date.now()}_${group.id}`,
          timestamp: Date.now(),
          prompt,
          videoUrl: localUrl,
          status: "completed",
          error: null,
          assetRefs: [
            ...promptResult.refs.images,
            ...promptResult.refs.videos,
            ...promptResult.refs.audios,
          ],
          config: {
            aspectRatio,
            resolution: videoResolution,
            duration: duration as SClassDuration,
          },
        };
        addGroupHistory(group.id, record);

        return {
          groupId: group.id,
          success: true,
          videoUrl: localUrl,
          error: null,
        };
      } catch (error) {
        const err = error as Error;
        const errorMsg = err.message || "VideoTạoThất bại";
        const isModeration = isContentModerationError(err);

        console.error("[SClassGen] Group generation failed:", err);

        updateGroupVideoStatus(group.id, {
          videoStatus: "failed",
          videoProgress: 0,
          videoError: isModeration ? `bên trong\u5bb9Duyệt\u672aChấp nhận: ${errorMsg}` : errorMsg,
        });

        return {
          groupId: group.id,
          success: false,
          videoUrl: null,
          error: errorMsg,
        };
      }
    },
    [
      activeProjectId,
      getProjectData,
      getGroupScenes,
      characters,
      scenes,
      updateGroupVideoStatus,
      addGroupHistory,
      prepareImageUrls,
      updateShotGroup,
      addShotGroup,
    ]
  );

  // ========== Lô Tạo（\u9010\u7ec4\u4e32được rồi + \u5c3e\u5e27\u4f20\u9012） ==========

  const generateAllGroups = useCallback(
    async (
      onBatchProgress?: (progress: BatchGenerationProgress) => void
    ): Promise<GroupGenerationResult[]> => {
      const projectId = activeProjectId;
      if (!projectId) {
        toast.error("không có\u6d3b\u8dc3Dự án");
        return [];
      }

      const projectData = getProjectData(projectId);
      const groups = projectData.shotGroups;

      if (groups.length === 0) {
        toast.error("Không Cảnh quay group");
        return [];
      }

      // Lọc\u9700\u8981Tạocủa\u7ec4（idle hoặc failed）
      const groupsToGenerate = groups.filter(
        (g) => g.videoStatus === "idle" || g.videoStatus === "failed"
      );

      if (groupsToGenerate.length === 0) {
        toast.info("Tất cảCảnh quay groupĐã TạohoặcLà Tạotrong");
        return [];
      }

      abortRef.current = false;
      const results: GroupGenerationResult[] = [];

      toast.info(
        `Bắt đầu\u9010Nhóm Tạo ${groupsToGenerate.length} Cảnh quay groupVideo...`
      );

      for (let i = 0; i < groupsToGenerate.length; i++) {
        if (abortRef.current) {
          toast.warning("Đã rồitrong\u6b62Lô Tạo");
          break;
        }

        const group = groupsToGenerate[i];

        onBatchProgress?.({
          total: groupsToGenerate.length,
          completed: i,
          current: group.id,
          results,
        });

        const result = await generateGroupVideo(group, {
          onProgress: (progress) => {
            onBatchProgress?.({
              total: groupsToGenerate.length,
              completed: i,
              current: group.id,
              results,
            });
          },
        });

        results.push(result);

        if (result.success) {
          toast.success(
            `\u7ec4 ${i + 1}/${groupsToGenerate.length} 「${group.name}」TạoHoàn thành`
          );
        } else {
          toast.error(
            `\u7ec4 ${i + 1}/${groupsToGenerate.length} 「${group.name}」Thất bại: ${result.error}`
          );
        }
      }

      onBatchProgress?.({
        total: groupsToGenerate.length,
        completed: groupsToGenerate.length,
        current: null,
        results,
      });

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      if (failCount === 0) {
        toast.success(`Tất cả ${successCount} Cảnh quay groupTạoHoàn thành 🎬`);
      } else {
        toast.warning(
          `Tạo\u5b8c\u6bd5：${successCount} Thành công，${failCount} Thất bại`
        );
      }

      return results;
    },
    [activeProjectId, getProjectData, generateGroupVideo]
  );

  // ========== thấu kính đơn Tạo（\u517c\u5bb9chế độ） ==========

  const generateSingleShot = useCallback(
    async (sceneId: number): Promise<boolean> => {
      const scene = splitScenes.find((s: SplitScene) => s.id === sceneId);
      if (!scene) {
        toast.error("\u672atìm thấyPhân cảnh");
        return false;
      }

      const featureConfig = getFeatureConfig("video_generation");
      if (!featureConfig) {
        toast.error(getFeatureNotConfiguredMessage("video_generation"));
        return false;
      }

      const keyManager = featureConfig.keyManager;
      if (!keyManager.getCurrentKey()) {
        toast.error("\u8bf7đầu tiên\u5728Cài đặtTrung bình Cấu hìnhVideoTạo API Key");
        return false;
      }
      const projectId = activeProjectId;
      if (!projectId) return false;

      // từ director-store \u76f4\u8bfbtổng cộng\u4eabCấu hình（với generateGroupVideo giữmột\u81f4）
      const dirState = useDirectorStore.getState();
      const dirProj = dirState.projects[dirState.activeProjectId || ''];
      const sbConfig = dirProj?.storyboardConfig;
      const singleAspectRatio = (sbConfig?.aspectRatio || '16:9') as SClassAspectRatio;
      const singleVideoRes = (sbConfig?.videoResolution || '720p') as SClassResolution;

      updateSingleShotVideo(sceneId, {
        videoStatus: "generating",
        videoProgress: 0,
        videoError: null,
      });

      try {
        // \u6784\u5efa imageWithRoles
        const firstFrameUrl = scene.imageDataUrl || scene.imageHttpUrl || undefined;
        const imageWithRoles = await buildImageWithRoles(
          firstFrameUrl,
          undefined
        );

        const prompt =
          scene.videoPrompt ||
          scene.videoPromptZh ||
          `Phân cảnh ${scene.id + 1} Video`;
        const duration = Math.max(4, Math.min(15, scene.duration || 5));

        const maxVideoAttempts = Math.max(1, Math.min(keyManager.getTotalKeyCount(), 6));
        let videoUrl: string | null = null;
        let lastVideoError: Error | null = null;

        for (let attempt = 0; attempt < maxVideoAttempts; attempt++) {
          const currentApiKey = keyManager.getCurrentKey() || "";
          if (!currentApiKey) break;

          try {
            videoUrl = await callVideoGenerationApi(
              currentApiKey,
              prompt,
              duration,
              singleAspectRatio,
              imageWithRoles,
              (progress) => {
                updateSingleShotVideo(sceneId, { videoProgress: progress });
              },
              keyManager,
              featureConfig.platform,
              singleVideoRes
            );
            lastVideoError = null;
            break;
          } catch (error) {
            const err = error as Error & { status?: number };
            lastVideoError = err;
            const message = err.message || "";
            const statusMatch = message.match(/\b(4\d\d|5\d\d)\b/);
            const parsedStatus = typeof err.status === "number"
              ? err.status
              : (statusMatch ? Number(statusMatch[1]) : undefined);
            const alreadyRotatedByInner = typeof err.status === "number"
              && [400, 401, 403, 429, 500, 502, 503, 529].includes(err.status);
            const fallbackStatus = /model|Mô hình/i.test(message)
              && /not support|unsupported|không có\u6743\u9650|Không đủ quyền|\u672a\u5f00\u901a|\u4e0dCó sẵn/i.test(message)
              ? 400
              : undefined;
            const statusForHandle = parsedStatus ?? fallbackStatus;
            const rotated = alreadyRotatedByInner
              ? true
              : (typeof statusForHandle === "number" ? keyManager.handleError(statusForHandle, message) : false);
            const retryableByMessage = /429|500|502|503|529|too many requests|rate|quota|service unavailable|overloaded|internal server error|server error|tải ngược dòng|dịch vụ thượng nguồn|bão hòa|Tạm thời không có|Dịch vụ tạm thời không khả dụng|api key|không có\u6548|\u8fc7\u671f|model|Mô hình|\u4e0dHỗ trợ|\u6743\u9650|\u672a\u5f00\u901a/.test(message.toLowerCase());
            const canRetry = attempt < maxVideoAttempts - 1 && (rotated || retryableByMessage);

            if (canRetry) {
              console.warn(`[SClassGen] Single shot retry with next key (${attempt + 1}/${maxVideoAttempts})`, {
                sceneId,
                status: statusForHandle,
                message: message.substring(0, 160),
              });
              continue;
            }
            throw err;
          }
        }

        if (!videoUrl) {
          throw lastVideoError || new Error("VideoTạoThất bại：\u6ca1CóCó sẵn API Key");
        }

        const localUrl = await saveVideoLocally(videoUrl, sceneId);

        updateSingleShotVideo(sceneId, {
          videoStatus: "completed",
          videoProgress: 100,
          videoUrl: localUrl,
          videoError: null,
        });

        toast.success(`Phân cảnh ${sceneId + 1} TạoHoàn thành`);
        return true;
      } catch (error) {
        const err = error as Error;
        updateSingleShotVideo(sceneId, {
          videoStatus: "failed",
          videoProgress: 0,
          videoError: err.message,
        });
        toast.error(`Phân cảnh ${sceneId + 1} TạoThất bại: ${err.message}`);
        return false;
      }
    },
    [
      splitScenes,
      activeProjectId,
      getProjectData,
      updateSingleShotVideo,
    ]
  );

  // ========== trong\u6b62 ==========

  const abortGeneration = useCallback(() => {
    abortRef.current = true;
    toast.info("\u6b63\u5728trong\u6b62Tạo...");
  }, []);

  // ========== Thử lại\u5355\u7ec4 ==========

  const retryGroup = useCallback(
    async (groupId: string): Promise<GroupGenerationResult | null> => {
      const projectId = activeProjectId;
      if (!projectId) return null;

      const projectData = getProjectData(projectId);
      const group = projectData.shotGroups.find((g) => g.id === groupId);
      if (!group) return null;

      // Đặt lạiTrạng thái
      updateGroupVideoStatus(groupId, {
        videoStatus: "idle",
        videoProgress: 0,
        videoError: null,
      });

      // \u67e5\u627e\u524d\u7ec4của videoUrl（\u94fe\u5f0f\u8854\u63a5）
      let prevVideoUrl: string | undefined;
      const allGroups = projectData.shotGroups;
      const idx = allGroups.findIndex(g => g.id === groupId);
      if (idx > 0 && allGroups[idx - 1].videoUrl) {
        prevVideoUrl = allGroups[idx - 1].videoUrl!;
      }

      return generateGroupVideo(group, { prevVideoUrl });
    },
    [activeProjectId, getProjectData, updateGroupVideoStatus, generateGroupVideo]
  );

  // ========== \u94fe\u5f0fmở rộng ==========

  /**
   * Dựa trênĐã hoàn thànhNhóm Tạomở rộng\u5b50\u7ec4\u5e76Tạo video
   *
   * @param sourceGroupId Nguồn ID nhóm（\u5fc5\u987bĐã hoàn thành\u4e14Có videoUrl）
   * @param extendDuration mở rộngThời lượng (4-15s)
   * @param direction Hướng mở rộng
   * @param description Người dùngBổ sung Mô tả（Tùy chọn）
   */
  const generateChainExtension = useCallback(
    async (
      sourceGroupId: string,
      extendDuration: number = 10,
      direction: 'backward' | 'forward' = 'backward',
      description?: string,
    ): Promise<GroupGenerationResult | null> => {
      const projectId = activeProjectId;
      if (!projectId) {
        toast.error('không có\u6d3b\u8dc3Dự án');
        return null;
      }

      const pd = getProjectData(projectId);
      const sourceGroup = pd.shotGroups.find(g => g.id === sourceGroupId);
      if (!sourceGroup || !sourceGroup.videoUrl) {
        toast.error('\u6e90\u7ec4không cóĐã hoàn thànhVideo，không có\u6cd5mở rộng');
        return null;
      }

      // Tạomở rộng\u5b50\u7ec4
      const childId = `extend_${Date.now()}_${sourceGroupId.substring(0, 8)}`;
      const childGroup: ShotGroup = {
        id: childId,
        name: `${sourceGroup.name} - mở rộng`,
        sceneIds: [...sourceGroup.sceneIds],
        sortIndex: sourceGroup.sortIndex + 0.5,
        totalDuration: Math.max(4, Math.min(15, extendDuration)) as ShotGroup["totalDuration"],
        videoStatus: 'idle',
        videoProgress: 0,
        videoUrl: null,
        videoMediaId: null,
        videoError: null,
        gridImageUrl: null,
        lastPrompt: null,
        mergedPrompt: description || sourceGroup.mergedPrompt || "",
        history: [],
        imageRefs: [],
        videoRefs: [],
        audioRefs: [],
        generationType: 'extend',
        extendDirection: direction,
        sourceGroupId,
        sourceVideoUrl: sourceGroup.videoUrl || undefined,
      };

      addShotGroup(childGroup);
      toast.info(`Đã Tạomở rộng\u5b50\u7ec4「${childGroup.name}」`);

      return generateGroupVideo(childGroup);
    },
    [activeProjectId, getProjectData, addShotGroup, generateGroupVideo]
  );

  return {
    generateGroupVideo,
    generateAllGroups,
    generateSingleShot,
    abortGeneration,
    retryGroup,
    generateChainExtension,
  };
}
