// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useAPIConfigStore } from "@/stores/api-config-store";
import { parseApiKeys } from "@/lib/api-key-manager";
import { useDirectorStore } from "@/stores/director-store";
import { generateAngleSwitch } from "@/lib/ai/runninghub-client";
import { getAngleLabel, type HorizontalDirection, type ElevationAngle, type ShotSize } from "@/lib/ai/runninghub-angles";
import type { AngleSwitchResult, AngleSwitchHistoryItem } from "@/components/angle-switch";
import type { SplitScene } from "@/stores/director-store";

export interface AngleSwitchTarget {
  sceneId: number;
  type: "start" | "end";
}

export interface UseAngleSwitchOptions {
  splitScenes: SplitScene[];
  updateSplitSceneImage: (sceneId: number, imageDataUrl: string | null, imageHttpUrl: string | null, imageMediaId: string | null) => void;
  updateSplitSceneEndFrame: (sceneId: number, imageUrl: string | null) => void;
}

export interface UseAngleSwitchReturn {
  // State
  angleSwitchOpen: boolean;
  angleSwitchResultOpen: boolean;
  angleSwitchTarget: AngleSwitchTarget | null;
  angleSwitchResult: AngleSwitchResult | null;
  selectedHistoryIndex: number;
  isAngleSwitching: boolean;
  // State setters
  setAngleSwitchOpen: (open: boolean) => void;
  setAngleSwitchResultOpen: (open: boolean) => void;
  setSelectedHistoryIndex: (index: number) => void;
  // Handlers
  handleAngleSwitchClick: (sceneId: number, type: "start" | "end") => void;
  handleAngleSwitchGenerate: (params: {
    direction: HorizontalDirection;
    elevation: ElevationAngle;
    shotSize: ShotSize;
    applyToSameScene: boolean;
    applyToAll: boolean;
  }) => Promise<void>;
  handleApplyAngleSwitch: () => void;
  // Helper to get history for current target
  getAngleSwitchHistory: () => AngleSwitchHistoryItem[];
}

export function useAngleSwitch({
  splitScenes,
  updateSplitSceneImage,
  updateSplitSceneEndFrame,
}: UseAngleSwitchOptions): UseAngleSwitchReturn {
  // góc\u5207\u6362\u72b6\u6001
  const [angleSwitchOpen, setAngleSwitchOpen] = useState(false);
  const [angleSwitchResultOpen, setAngleSwitchResultOpen] = useState(false);
  const [angleSwitchTarget, setAngleSwitchTarget] = useState<AngleSwitchTarget | null>(null);
  const [angleSwitchResult, setAngleSwitchResult] = useState<AngleSwitchResult | null>(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const [isAngleSwitching, setIsAngleSwitching] = useState(false);

  const getProviderByPlatform = useAPIConfigStore(state => state.getProviderByPlatform);
  const { addAngleSwitchHistory } = useDirectorStore();

  // Handle angle switch click
  const handleAngleSwitchClick = useCallback((sceneId: number, type: "start" | "end") => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    const imageUrl = type === "start" ? scene.imageDataUrl : scene.endFrameImageUrl;
    if (!imageUrl) {
      toast.error(`\u8bf7đầu tiên\u751f\u6210${type === "start" ? "khung hình đầu tiên" : "\u5c3e\u5e27"}`);
      return;
    }

    // \u91cd\u7f6eđã chọn\u7d22\u5f15（\u5386\u53f2từ store trong\u8bfb\u53d6）
    setSelectedHistoryIndex(-1);
    setAngleSwitchTarget({ sceneId, type });
    setAngleSwitchOpen(true);
  }, [splitScenes]);

  // Handle angle switch generation
  const handleAngleSwitchGenerate = useCallback(async (params: {
    direction: HorizontalDirection;
    elevation: ElevationAngle;
    shotSize: ShotSize;
    applyToSameScene: boolean;
    applyToAll: boolean;
  }) => {
    if (!angleSwitchTarget) return;
    const { direction, elevation, shotSize } = params;

    // Get RunningHub provider config
    const runninghubProvider = getProviderByPlatform('runninghub');
    const runninghubKey = parseApiKeys(runninghubProvider?.apiKey || '')[0];
    const runninghubBaseUrl = runninghubProvider?.baseUrl?.trim();
    const runninghubAppId = runninghubProvider?.model?.[0];
    if (!runninghubKey || !runninghubBaseUrl || !runninghubAppId) {
      toast.error("\u8bf7đầu tiên\u5728\u8bbe\u7f6eTrung bình Cấu hình RunningHub（API Key / Base URL / \u6a21\u578bAppId）");
      setAngleSwitchOpen(false);
      return;
    }

    const scene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
    if (!scene) return;

    const originalImage = angleSwitchTarget.type === "start" ? scene.imageDataUrl : scene.endFrameImageUrl;
    if (!originalImage) {
      toast.error("Không thể tìm thấy hình ảnh gốc");
      return;
    }

    setIsAngleSwitching(true);

    try {
      const newImageUrl = await generateAngleSwitch({
        referenceImage: originalImage,
        direction,
        elevation,
        shotSize,
        apiKey: runninghubKey,
        baseUrl: runninghubBaseUrl,
        appId: runninghubAppId,
        onProgress: (progress, status) => {
          console.log(`[AngleSwitch] Progress: ${progress}%, Status: ${status}`);
        },
      });

      const angleLabel = getAngleLabel(direction, elevation, shotSize);

      // Save to store history
      const newHistoryItem = {
        imageUrl: newImageUrl,
        angleLabel,
        timestamp: Date.now(),
      };
      addAngleSwitchHistory(angleSwitchTarget.sceneId, angleSwitchTarget.type, newHistoryItem);

      // \u83b7\u53d6\u66f4mới\u540ecủa\u5386\u53f2（Đọc từ cảnh）
      const updatedScene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
      const history = angleSwitchTarget.type === "start" 
        ? (updatedScene?.startFrameAngleSwitchHistory || [])
        : (updatedScene?.endFrameAngleSwitchHistory || []);
      setSelectedHistoryIndex(history.length - 1); // Chọn mới nhất

      setAngleSwitchResult({
        originalImage,
        newImage: newImageUrl,
        angleLabel,
      });

      setAngleSwitchOpen(false);
      setAngleSwitchResultOpen(true);

      toast.success("\u89c6\u89d2\u5207\u6362\u751f\u6210Hoàn thành");
    } catch (error) {
      toast.error(`\u89c6\u89d2\u5207\u6362\u5931\u8d25: ${(error as Error).message}`);
    } finally {
      setIsAngleSwitching(false);
    }
  }, [angleSwitchTarget, splitScenes, getProviderByPlatform, addAngleSwitchHistory]);

  // Apply angle switch result
  const handleApplyAngleSwitch = useCallback(() => {
    if (!angleSwitchResult || !angleSwitchTarget) return;

    // từ store trong\u8bfb\u53d6\u5386\u53f2
    const scene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
    const history = angleSwitchTarget.type === "start"
      ? (scene?.startFrameAngleSwitchHistory || [])
      : (scene?.endFrameAngleSwitchHistory || []);

    // Use selected history item if available, otherwise use current result
    const imageToApply = selectedHistoryIndex >= 0 && history[selectedHistoryIndex]
      ? history[selectedHistoryIndex].imageUrl
      : angleSwitchResult.newImage;

    if (angleSwitchTarget.type === "start") {
      updateSplitSceneImage(angleSwitchTarget.sceneId, imageToApply, null, null);
    } else {
      updateSplitSceneEndFrame(angleSwitchTarget.sceneId, imageToApply);
    }

    setAngleSwitchResultOpen(false);
    setAngleSwitchResult(null);
    setAngleSwitchTarget(null);
    setSelectedHistoryIndex(-1);
    toast.success("\u89c6\u89d2Đã rồi\u5e94sử dụng");
  }, [angleSwitchResult, angleSwitchTarget, splitScenes, selectedHistoryIndex, updateSplitSceneImage, updateSplitSceneEndFrame]);

  // Helper to get history for current target
  const getAngleSwitchHistory = useCallback((): AngleSwitchHistoryItem[] => {
    if (!angleSwitchTarget) return [];
    const scene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
    if (!scene) return [];
    return angleSwitchTarget.type === "start"
      ? (scene.startFrameAngleSwitchHistory || [])
      : (scene.endFrameAngleSwitchHistory || []);
  }, [angleSwitchTarget, splitScenes]);

  return {
    // State
    angleSwitchOpen,
    angleSwitchResultOpen,
    angleSwitchTarget,
    angleSwitchResult,
    selectedHistoryIndex,
    isAngleSwitching,
    // State setters
    setAngleSwitchOpen,
    setAngleSwitchResultOpen,
    setSelectedHistoryIndex,
    // Handlers
    handleAngleSwitchClick,
    handleAngleSwitchGenerate,
    handleApplyAngleSwitch,
    // Helper
    getAngleSwitchHistory,
  };
}
