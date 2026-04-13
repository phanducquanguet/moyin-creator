// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Phân cảnh\u7ec4\u4ef6 (Split Scenes Component)
 * \u663e\u793aPhân cảnh\u5207\u5272kết quả，Hỗ trợChỉnh sửaPrompt、Tải lên\u5c3e\u5e27、\u9009\u62e9Thư viện nhân vật、ThêmThẻ cảm xúc
 */

import React, { useState, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  useDirectorStore, 
  useActiveDirectorProject,
  type SplitScene, 
  type EmotionTag,
  type ShotSizeType,
  type DurationType,
  type SoundEffectTag,
  EMOTION_PRESETS,
  SHOT_SIZE_PRESETS,
  SOUND_EFFECT_PRESETS,
} from "@/stores/director-store";
import { useCharacterLibraryStore } from "@/stores/character-library-store";
import { 
  ArrowLeft, 
  Trash2, 
  Play,
  ImageIcon,
  AlertCircle,
  Loader2,
  Sparkles,
  Clapperboard,
  Film,
  Square,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaStore } from "@/stores/media-store";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { generateScenePrompts } from "@/lib/storyboard/scene-prompt-generator";
import { useAPIConfigStore } from "@/stores/api-config-store";
import { parseApiKeys } from "@/lib/api-key-manager";
import { getFeatureConfig, getFeatureNotConfiguredMessage } from "@/lib/ai/feature-router";
import { submitGridImageRequest } from "@/lib/ai/image-generator";
import { uploadToImageHost, isImageHostConfigured } from "@/lib/image-host";
import { saveVideoToLocal, readImageAsBase64 } from '@/lib/image-storage';
import { persistSceneImage } from '@/lib/utils/image-persist';
import { callVideoGenerationApi, convertToHttpUrl, extractLastFrameFromVideo, isContentModerationError } from '../director/use-video-generation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Monitor, Smartphone } from "lucide-react";
import { AngleSwitchDialog, AngleSwitchResultDialog, type AngleSwitchResult } from "@/components/angle-switch";
import { generateAngleSwitch } from "@/lib/ai/runninghub-client";
import { getAngleLabel, type HorizontalDirection, type ElevationAngle, type ShotSize } from "@/lib/ai/runninghub-angles";
import { SClassSceneCard } from "./sclass-scene-card";
import { ShotGroupCard } from "./shot-group";
import { useSClassStore, useShotGroups, type SClassAspectRatio, type ShotGroup } from "@/stores/sclass-store";
import { autoGroupScenes, generateGroupName } from "./auto-grouping";
import { useSClassGeneration, type BatchGenerationProgress } from "./use-sclass-generation";
import { ExtendEditDialog, type ExtendEditMode } from "./extend-edit-dialog";
import { runCalibration, runBatchCalibration } from "./sclass-calibrator";
import { useSceneStore } from "@/stores/scene-store";
import { Music } from "lucide-react";
import { QuadGridDialog, QuadGridResultDialog, type QuadVariationType, type QuadGridResult } from "@/components/quad-grid";
import { 
  VISUAL_STYLE_PRESETS, 
  STYLE_CATEGORIES,
  getStyleById, 
  getStylePrompt,
  getStyleNegativePrompt,
  getMediaType,
  DEFAULT_STYLE_ID 
} from "@/lib/constants/visual-styles";
import { getCinematographyProfile, DEFAULT_CINEMATOGRAPHY_PROFILE_ID } from "@/lib/constants/cinematography-profiles";
import { buildVideoPrompt, buildEmotionDescription as buildEmotionDesc } from "@/lib/generation/prompt-builder";
import { StylePicker } from "@/components/ui/style-picker";
import { CinematographyProfilePicker } from "@/components/ui/cinematography-profile-picker";

interface SplitScenesProps {
  onBack?: () => void;
  onGenerateVideos?: () => void;
}

// SceneCard sử dụng lớp S\u4e13\u5c5ePhiên bản SClassSceneCard
const SceneCard = SClassSceneCard;

export function SClassScenes({ onBack, onGenerateVideos }: SplitScenesProps) {
  // ========== \u5408\u5e76Tạo（chíncung điện\u683c）\u672c\u5730 UI Trạng thái ==========
  const [imageGenMode, setImageGenMode] = useState<'single' | 'merged'>('single');
  const [frameMode, setFrameMode] = useState<'first' | 'last' | 'both'>('first');
  const [isMergedRunning, setIsMergedRunning] = useState(false);
  const [refStrategy, setRefStrategy] = useState<'cluster'|'minimal'|'none'>('cluster');
  const [useExemplar, setUseExemplar] = useState(true);
  const PAGE_CONCURRENCY = 2; // \u6bcf\u9875Đồng thờiđặt\u7fa4\u6570\u9650\u5236
  // \u5408\u5e76TạoDừng\u63a7\u5236
  const mergedAbortRef = useRef(false);
  // \u5408\u5e76Tạo\u63a7\u4ef6\u5c06\u5728 JSX trongbên trong\u8054kết xuất，\u907f\u514d\u95ed\u5305\u5f15sử dụng\u95ee\u9898
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [currentGeneratingId, setCurrentGeneratingId] = useState<number | null>(null);
  // Tab Trạng thái: Phân cảnhChỉnh sửa vs xe kéo
  const [activeTab, setActiveTab] = useState<"editing" | "trailer">("editing");

  // góc\u5207\u6362Trạng thái
  const [angleSwitchOpen, setAngleSwitchOpen] = useState(false);
  const [angleSwitchResultOpen, setAngleSwitchResultOpen] = useState(false);
  const [angleSwitchTarget, setAngleSwitchTarget] = useState<{ sceneId: number; type: "start" | "end" } | null>(null);
  const [angleSwitchResult, setAngleSwitchResult] = useState<AngleSwitchResult | null>(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const [isAngleSwitching, setIsAngleSwitching] = useState(false);
  
  // Trích xuấtVideo\u6700\u540emột\u5e27Trạng thái
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);

  // bốncung điện\u683cTrạng thái
  const [quadGridOpen, setQuadGridOpen] = useState(false);
  const [quadGridResultOpen, setQuadGridResultOpen] = useState(false);
  const [quadGridTarget, setQuadGridTarget] = useState<{ sceneId: number; type: "start" | "end" } | null>(null);
  const [quadGridResult, setQuadGridResult] = useState<QuadGridResult | null>(null);
  const [isQuadGridGenerating, setIsQuadGridGenerating] = useState(false);

  // Get current project data
  const projectData = useActiveDirectorProject();
  
  // Read from project data (with defaults)
  const splitScenes = projectData?.splitScenes || [];
  const storyboardStatus = projectData?.storyboardStatus || 'idle';
  const storyboardImage = projectData?.storyboardImage || null;
  const storyboardConfig = projectData?.storyboardConfig || {
    aspectRatio: '9:16' as const,
    resolution: '2K' as const,
    videoResolution: '480p' as const,
    sceneCount: 5,
    storyPrompt: '',
  };
  const projectFolderId = projectData?.projectFolderId || null;
  // xe kéo\u6570\u636e - \u76f4\u63a5từ splitScenes \u7b5b\u9009，\u4fdd\u8bc1chức năngmột\u81f4
  const trailerConfig = projectData?.trailerConfig || null;
  const trailerShotIds = trailerConfig?.shotIds || [];
  
  // Debug: log raw data on every render (dev only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[SplitScenes] Raw data:', {
      storyboardStatus,
      splitScenesLength: splitScenes.length,
      splitScenesIds: splitScenes.map(s => s.id),
      trailerConfigStatus: trailerConfig?.status,
      trailerShotIds,
      styleTokens: storyboardConfig.styleTokens,
      aspectRatio: storyboardConfig.aspectRatio,
      sceneCount: storyboardConfig.sceneCount,
    });
  }
  
  // \u7b5b\u9009xe kéoPhân cảnh：Chấp nhận sceneName chứa "xe kéo" chìa khóatừ\u6765\u8bc6\u522b
  const trailerScenes = useMemo(() => {
    // Chấp nhận sceneName chứa "xe kéo" \u6765\u7b5b\u9009
    const filtered = splitScenes.filter(scene => {
      const sceneName = scene.sceneName || '';
      return sceneName.includes('xe kéo');
    });
    console.log('[SplitScenes] Trailer filter by sceneName:', {
      totalScenes: splitScenes.length,
      filteredCount: filtered.length,
      filteredNames: filtered.map(s => s.sceneName),
    });
    return filtered;
  }, [splitScenes]);

  const {
    activeProjectId,
    setStoryboardConfig,
    // Three-tier prompt methods
    updateSplitSceneImagePrompt,
    updateSplitSceneVideoPrompt,
    updateSplitSceneEndFramePrompt,
    updateSplitSceneNeedsEndFrame,
    // Other scene update methods
    updateSplitSceneImage,
    updateSplitSceneImageStatus,
    updateSplitSceneVideo,
    updateSplitSceneEndFrame,
    updateSplitSceneEndFrameStatus,
    updateSplitSceneCharacters,
    updateSplitSceneCharacterVariationMap,
    updateSplitSceneEmotions,
    updateSplitSceneShotSize,
    updateSplitSceneDuration,
    updateSplitSceneAmbientSound,
    updateSplitSceneSoundEffects,
    // Thư viện cảnh\u5173\u8054Cập nhật\u65b9\u6cd5
    updateSplitSceneReference,
    updateSplitSceneEndFrameReference,
    // phổ quáttừ\u6bb5Cập nhật\u65b9\u6cd5（sử dụng\u4e8e\u53cc\u51fbChỉnh sửa）
    updateSplitSceneField,
    // Góc nhìnChuyển đổiLịch sử
    addAngleSwitchHistory,
    deleteSplitScene,
    resetStoryboard,
    // xe kéochức năng
    clearTrailer,
    // Nhiếp ảnh Phong cách\u6863\u6848
    setCinematographyProfileId,
  } = useDirectorStore();
  const mediaProjectId = activeProjectId || undefined;

  // ========== lớp S\u5206Nhóm Trạng thái ==========
  const {
    generationMode: sclassGenMode,
    setGenerationMode: setSclassGenMode,
    setShotGroups,
    setHasAutoGrouped,
    setLastGridImage,
  } = useSClassStore();
  const shotGroups = useShotGroups();
  const sclassProjectData = useSClassStore((s) => {
    if (!s.activeProjectId) return null;
    return s.projects[s.activeProjectId] || null;
  });
  const hasAutoGrouped = sclassProjectData?.hasAutoGrouped || false;
  const { updateShotGroup } = useSClassStore();

  // lớp S Seedance 2.0 Tạo hook
  const {
    generateGroupVideo,
    generateAllGroups,
    generateSingleShot,
    abortGeneration: abortSClassGeneration,
    retryGroup,
    generateChainExtension,
  } = useSClassGeneration();
  const [batchProgress, setBatchProgress] = useState<BatchGenerationProgress | null>(null);

  // mở rộng/Chỉnh sửa\u5bf9\u8bdd\u6846Trạng thái
  const [extendEditOpen, setExtendEditOpen] = useState(false);
  const [extendEditMode, setExtendEditMode] = useState<ExtendEditMode>('extend');
  const [extendEditSourceGroup, setExtendEditSourceGroup] = useState<ShotGroup | null>(null);

  // \u573a\u666e\u5e93
  const sceneLibrary = useSceneStore((s) => s.scenes);
  const allCharacters = useCharacterLibraryStore((s) => s.characters);

  // \u81ea\u52a8\u5206\u7ec4：\u9996lần\u5168\u91cf\u5206\u7ec4 + \u540e\u7eed\u589e\u91cf\u5206\u7ec4（\u53f3\u680fMớiPhân cảnh\u81ea\u52a8\u8ffd\u52a0Đến\u7ec4）
  React.useEffect(() => {
    if (splitScenes.length === 0) return;

    if (!hasAutoGrouped) {
      // \u9996lần：\u5bf9Tất cảPhân cảnh\u6267được rồi\u81ea\u52a8\u5206\u7ec4
      const groups = autoGroupScenes(splitScenes);
      const named = groups.map((g, idx) => ({
        ...g,
        name: generateGroupName(g, splitScenes, idx),
      }));
      setShotGroups(named);
      setHasAutoGrouped(true);
      console.log('[SClassScenes] Auto-grouped:', named.length, 'groups from', splitScenes.length, 'scenes');
      return;
    }

    // Đã rồi\u5206\u7ec4\u540e：Phát hiệnMớtôi là\u672a\u5206\u914dPhân cảnh，\u589e\u91cf\u8ffd\u52a0\u5206\u7ec4
    const assignedIds = new Set(shotGroups.flatMap(g => g.sceneIds));
    const unassigned = splitScenes.filter(s => !assignedIds.has(s.id));
    if (unassigned.length > 0) {
      const newGroups = autoGroupScenes(unassigned);
      const existingCount = shotGroups.length;
      const namedNew = newGroups.map((g, idx) => ({
        ...g,
        name: generateGroupName(g, unassigned, existingCount + idx),
      }));
      setShotGroups([...shotGroups, ...namedNew]);
      console.log('[SClassScenes] Incremental grouping:', newGroups.length, 'new groups for', unassigned.length, 'new scenes');
    }
  }, [splitScenes, hasAutoGrouped, shotGroups, setShotGroups, setHasAutoGrouped]);


  // \u6784\u5efa sceneId -> SplitScene Nhanh\u901f\u67e5\u627e\u8868
  const sceneMap = useMemo(() => new Map(splitScenes.map(s => [s.id, s])), [splitScenes]);

  // Get current style from config
  // Ưu tiênsử dụng\u76f4\u63a5\u5b58\u50a8của visualStyleId，\u56de\u9000Đến styleTokens \u53cd\u63a8（\u517c\u5bb9\u65e7Dự án）
  const currentStyleId = useMemo(() => {
    if (storyboardConfig.visualStyleId) {
      return storyboardConfig.visualStyleId;
    }
    // \u5411\u540e\u517c\u5bb9：\u5c06 styleTokens \u5408\u5e76\u540etrận đấu prompt \u524d\u7f00
    if (storyboardConfig.styleTokens && storyboardConfig.styleTokens.length > 0) {
      const joinedTokens = storyboardConfig.styleTokens.join(', ');
      const found = VISUAL_STYLE_PRESETS.find(s => s.prompt.startsWith(joinedTokens));
      return found?.id || DEFAULT_STYLE_ID;
    }
    return DEFAULT_STYLE_ID;
  }, [storyboardConfig.visualStyleId, storyboardConfig.styleTokens]);

  // \u8bfb\u53d6Hiện tạiNhiếp ảnh Phong cách\u6863\u6848（\u672aCài đặt\u65f6sử dụng Mặc định\u7ecf\u5178\u7535\u5f71Nhiếp ảnh Phong cách）
  const currentCinProfileId = projectData?.cinematographyProfileId || DEFAULT_CINEMATOGRAPHY_PROFILE_ID;

  // \u5207\u6362Nhiếp ảnh Phong cách\u6863\u6848
  const handleCinProfileChange = useCallback((profileId: string) => {
    setCinematographyProfileId(profileId || undefined);
    toast.success('Nhiếp ảnh Phong cáchĐã rồiCập nhật');
  }, [setCinematographyProfileId]);

  // Update style
  const handleStyleChange = useCallback((styleId: string) => {
    const style = getStyleById(styleId);
    if (style) {
      // \u76f4\u63a5\u5b58\u50a8Phong cách ID，\u540c\u65f6\u4fdd\u7559 styleTokens（\u5b8c\u6574 prompt）\u517c\u5bb9\u65e7\u903b\u8f91
      setStoryboardConfig({ visualStyleId: styleId, styleTokens: [style.prompt] });
      toast.success(`Đã rồi\u5207\u6362cho ${style.name} Phong cách`);
    }
  }, [setStoryboardConfig]);

  // Update aspect ratio (lớp S: 6 \u79cd\u753b\u5e45\u6bd4)
  const SCLASS_ASPECT_RATIOS: { value: SClassAspectRatio; label: string; icon?: string }[] = [
    { value: '16:9', label: '\u6a2a\u5c4f 16:9' },
    { value: '9:16', label: '\u7ad6\u5c4f 9:16' },
    { value: '4:3', label: '\u7ecf\u5178 4:3' },
    { value: '3:4', label: 'chân dung 3:4' },
    { value: '21:9', label: '\u5bbd\u5c4f 21:9' },
    { value: '1:1', label: '\u65b9\u5f62 1:1' },
  ];

  const handleAspectRatioChange = useCallback((ratio: SClassAspectRatio) => {
    setStoryboardConfig({ aspectRatio: ratio as '16:9' | '9:16' });
    toast.success(`\u753b\u5e45\u6bd4Đã rồi\u5207\u6362cho ${ratio}`);
  }, [setStoryboardConfig]);

  const { getApiKey, getProviderByPlatform, concurrency } = useAPIConfigStore();
  const { addMediaFromUrl, getOrCreateCategoryFolder } = useMediaStore();
  
  // Get system category folder IDs for auto-saving (images → AIHình ảnh, videos → AIVideo)
  const getImageFolderId = useCallback(() => getOrCreateCategoryFolder('ai-image'), [getOrCreateCategoryFolder]);
  const getVideoFolderId = useCallback(() => getOrCreateCategoryFolder('ai-video'), [getOrCreateCategoryFolder]);

  // Auto-save video to media library and return mediaId
  const autoSaveVideoToLibrary = useCallback((sceneId: number, videoUrl: string, thumbnailUrl?: string, duration?: number): string => {
    const folderId = getVideoFolderId();
    
    const mediaId = addMediaFromUrl({
      url: videoUrl,
      name: `Phân cảnh ${sceneId + 1} - AIVideo`,
      type: 'video',
      source: 'ai-video',
      thumbnailUrl,
      duration: duration || 5,
      folderId,
      projectId: mediaProjectId,
    });
    
    console.log('[SplitScenes] Auto-saved video to AIVideo folder:', mediaId);
    return mediaId;
  }, [addMediaFromUrl, getVideoFolderId, mediaProjectId]);

  // Auto-save image to media library
  const autoSaveImageToLibrary = useCallback((sceneId: number, imageUrl: string): string => {
    const folderId = getImageFolderId();
    
    const mediaId = addMediaFromUrl({
      url: imageUrl,
      name: `Phân cảnh ${sceneId + 1} - AIHình ảnh`,
      type: 'image',
      source: 'ai-image',
      folderId,
      projectId: mediaProjectId,
    });
    
    console.log('[SplitScenes] Auto-saved image to AIHình ảnh folder:', mediaId);
    return mediaId;
  }, [addMediaFromUrl, getImageFolderId, mediaProjectId]);

  // Handle update end frame
  const handleUpdateEndFrame = useCallback((sceneId: number, imageUrl: string | null) => {
    updateSplitSceneEndFrame(sceneId, imageUrl);
  }, [updateSplitSceneEndFrame]);

  // Handle update characters
  const handleUpdateCharacters = useCallback((sceneId: number, characterIds: string[]) => {
    updateSplitSceneCharacters(sceneId, characterIds);
    const currentScene = splitScenes.find((s) => s.id === sceneId);
    const currentMap = currentScene?.characterVariationMap;
    if (!currentMap) return;

    const selectedSet = new Set(characterIds);
    const prunedMap: Record<string, string> = {};
    Object.entries(currentMap).forEach(([charId, variationId]) => {
      if (selectedSet.has(charId) && variationId) {
        prunedMap[charId] = variationId;
      }
    });

    const hasChanged =
      Object.keys(prunedMap).length !== Object.keys(currentMap).length ||
      Object.entries(prunedMap).some(([charId, variationId]) => currentMap[charId] !== variationId);
    if (hasChanged) {
      updateSplitSceneCharacterVariationMap(sceneId, prunedMap);
    }
  }, [splitScenes, updateSplitSceneCharacters, updateSplitSceneCharacterVariationMap]);

  const handleUpdateCharacterVariationMap = useCallback((sceneId: number, characterVariationMap: Record<string, string>) => {
    updateSplitSceneCharacterVariationMap(sceneId, characterVariationMap);
  }, [updateSplitSceneCharacterVariationMap]);

  // Handle update emotions
  const handleUpdateEmotions = useCallback((sceneId: number, emotionTags: EmotionTag[]) => {
    updateSplitSceneEmotions(sceneId, emotionTags);
  }, [updateSplitSceneEmotions]);

  // Handle update shot size
  const handleUpdateShotSize = useCallback((sceneId: number, shotSize: ShotSizeType | null) => {
    updateSplitSceneShotSize(sceneId, shotSize);
  }, [updateSplitSceneShotSize]);

  // Handle update duration
  const handleUpdateDuration = useCallback((sceneId: number, duration: DurationType) => {
    updateSplitSceneDuration(sceneId, duration);
  }, [updateSplitSceneDuration]);

  // Handle update ambient sound
  const handleUpdateAmbientSound = useCallback((sceneId: number, ambientSound: string) => {
    updateSplitSceneAmbientSound(sceneId, ambientSound);
  }, [updateSplitSceneAmbientSound]);

  // Handle update sound effects
  const handleUpdateSoundEffects = useCallback((sceneId: number, soundEffects: SoundEffectTag[]) => {
    updateSplitSceneSoundEffects(sceneId, soundEffects);
  }, [updateSplitSceneSoundEffects]);

  // Handle delete scene
  const handleDeleteScene = useCallback((sceneId: number) => {
    deleteSplitScene(sceneId);
    toast.success(`Phân cảnh ${sceneId} Đã rồiXoá`);
  }, [deleteSplitScene]);

  // Handle remove first frame image
  const handleRemoveImage = useCallback((sceneId: number) => {
    // Reset image to empty and clear status
    updateSplitSceneImage(sceneId, '', undefined, undefined, undefined);
    updateSplitSceneImageStatus(sceneId, {
      imageStatus: 'idle',
      imageProgress: 0,
      imageError: null,
    });
  }, [updateSplitSceneImage, updateSplitSceneImageStatus]);

  // Handle upload first frame image
  const handleUploadImage = useCallback(async (sceneId: number, imageDataUrl: string) => {
    const { localPath, httpUrl } = await persistSceneImage(imageDataUrl, sceneId, 'first');
    updateSplitSceneImage(sceneId, localPath, undefined, undefined, httpUrl || undefined);
  }, [updateSplitSceneImage]);

  // Handle go back
  const handleBack = useCallback(() => {
    resetStoryboard();
    onBack?.();
  }, [resetStoryboard, onBack]);

  // Handle extract video last frame -> insert to next scene's first frame
  const handleExtractVideoLastFrame = useCallback(async (sceneId: number) => {
    const sceneIndex = splitScenes.findIndex(s => s.id === sceneId);
    const scene = splitScenes[sceneIndex];
    if (!scene || !scene.videoUrl) {
      toast.error('Vui lòng tạo video trước');
      return;
    }

    // \u68c0\u67e5\u662f\u5426Có\u4e0bmộtPhân cảnh
    const nextScene = splitScenes[sceneIndex + 1];
    if (!nextScene) {
      toast.error('Đây là\u6700\u540emộtPhân cảnh，không có\u6cd5\u63d2\u5165Đến\u4e0bmộtPhân cảnh');
      return;
    }

    setIsExtractingFrame(true);
    
    try {
      // Trích xuất\u6700\u540emột\u5e27
      const lastFrameBase64 = await extractLastFrameFromVideo(scene.videoUrl, 0.1);
      if (!lastFrameBase64) {
        toast.error('Trích xuất\u5e27Thất bại');
        return;
      }
      
      // \u6301\u4e45\u5316Đến\u672c\u5730 + Lưu trữ ảnh
      const persistResult = await persistSceneImage(lastFrameBase64, nextScene.id, 'first');
      
      // \u63d2\u5165Đến\u4e0bmộtPhân cảnhkhung hình đầu tiên
      updateSplitSceneImage(nextScene.id, persistResult.localPath, nextScene.width, nextScene.height, persistResult.httpUrl || undefined);
      toast.success(`Phân cảnh ${sceneId + 1} \u5c3e\u5e27Đã rồi\u63d2\u5165ĐếnPhân cảnh ${nextScene.id + 1} khung hình đầu tiên`);
      
    } catch (e) {
      console.error('[SplitScenes] Extract last frame error:', e);
      toast.error('Trích xuất\u5e27Thất bại');
    } finally {
      setIsExtractingFrame(false);
    }
  }, [splitScenes, updateSplitSceneImage]);

  // ========== DừngTạo\u5904\u7406chức năng ==========
  // Dừngkhung hình đầu tiênHình ảnhTạo
  const handleStopImageGeneration = useCallback((sceneId: number) => {
    updateSplitSceneImageStatus(sceneId, {
      imageStatus: 'idle',
      imageProgress: 0,
      imageError: 'Người dùngĐã huỷ',
    });
    setIsGenerating(false);
    setCurrentGeneratingId(null);
    toast.info(`Phân cảnh ${sceneId + 1} khung hình đầu tiênTạoĐã rồiDừng`);
  }, [updateSplitSceneImageStatus]);

  // DừngVideoTạo
  const handleStopVideoGeneration = useCallback((sceneId: number) => {
    updateSplitSceneVideo(sceneId, {
      videoStatus: 'idle',
      videoProgress: 0,
      videoError: 'Người dùngĐã huỷ',
    });
    setIsGenerating(false);
    setCurrentGeneratingId(null);
    toast.info(`Phân cảnh ${sceneId + 1} VideoTạoĐã rồiDừng`);
  }, [updateSplitSceneVideo]);

  // Dừng\u5c3e\u5e27Hình ảnhTạo
  const handleStopEndFrameGeneration = useCallback((sceneId: number) => {
    updateSplitSceneEndFrameStatus(sceneId, {
      endFrameStatus: 'idle',
      endFrameProgress: 0,
      endFrameError: 'Người dùngĐã huỷ',
    });
    setIsGenerating(false);
    toast.info(`Phân cảnh ${sceneId + 1} \u5c3e\u5e27TạoĐã rồiDừng`);
  }, [updateSplitSceneEndFrameStatus]);

  // Dừng\u5408\u5e76Tạo
  const handleStopMergedGeneration = useCallback(() => {
    mergedAbortRef.current = true;
    setIsMergedRunning(false);
    toast.info('\u5408\u5e76TạoĐã rồiDừng');
  }, []);

  // Handle angle switch click
  const handleAngleSwitchClick = useCallback((sceneId: number, type: "start" | "end") => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    const imageUrl = type === "start" 
      ? (scene.imageDataUrl || scene.imageHttpUrl) 
      : (scene.endFrameImageUrl || scene.endFrameHttpUrl);
    if (!imageUrl) {
      toast.error(`\u8bf7đầu tiênTạo${type === "start" ? "khung hình đầu tiên" : "\u5c3e\u5e27"}`);
      return;
    }

    // Đặt lại\u9009trong\u7d22\u5f15（Lịch sửtừ store trong\u8bfb\u53d6）
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
      toast.error("Vui lòng vào Cài đặt để cấu hình RunningHub (API Key / Base URL / Model AppId)");
      setAngleSwitchOpen(false);
      return;
    }

    const scene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
    if (!scene) return;

    const originalImage = angleSwitchTarget.type === "start" 
      ? (scene.imageDataUrl || scene.imageHttpUrl) 
      : (scene.endFrameImageUrl || scene.endFrameHttpUrl);
    if (!originalImage) {
      toast.error("\u627e\u4e0dĐến\u539f\u56fe");
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

      // GetCập nhật\u540ecủaLịch sử（từ scene trong\u8bfb\u53d6）
      const updatedScene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
      const history = angleSwitchTarget.type === "start" 
        ? (updatedScene?.startFrameAngleSwitchHistory || [])
        : (updatedScene?.endFrameAngleSwitchHistory || []);
      setSelectedHistoryIndex(history.length - 1); // \u9009trong\u6700\u65b0của

      setAngleSwitchResult({
        originalImage,
        newImage: newImageUrl,
        angleLabel,
      });

      setAngleSwitchOpen(false);
      setAngleSwitchResultOpen(true);

      toast.success("Tạo chuyển đổi góc nhìn thành công");
    } catch (error) {
      toast.error(`Góc nhìnChuyển đổiThất bại: ${(error as Error).message}`);
    } finally {
      setIsAngleSwitching(false);
    }
  }, [angleSwitchTarget, splitScenes, getProviderByPlatform, addAngleSwitchHistory]);

  // Theo Th.ẻ cảm xúcTạoKhí quyển Mô tả - sử dụng\u7edfmột prompt-builder \u6a21\u5757
  const buildEmotionDescription = useCallback((emotionTags: EmotionTag[]): string => {
    return buildEmotionDesc(emotionTags);
  }, []);

  // Thu thập Nhân vậsự phản bộiHình ảnh - \u5fc5\u987b\u5728 handleQuadGridGenerate \u4e4b\u524d\u5b9a\u4e49
  const getCharacterReferenceImages = useCallback((
    characterIds: string[],
    variationMap?: Record<string, string>,
  ): string[] => {
    const { characters } = useCharacterLibraryStore.getState();
    const refs: string[] = [];
    const seen = new Set<string>();
    const MAX_REFS = 14;

    const pushRef = (value?: string) => {
      if (!value || seen.has(value)) return;
      seen.add(value);
      refs.push(value);
    };

    for (const charId of characterIds) {
      const char = characters.find((c) => c.id === charId);
      if (!char) continue;

      const variationId = variationMap?.[charId];
      const selectedVariation = variationId
        ? char.variations?.find((v) => v.id === variationId)
        : undefined;

      pushRef(selectedVariation?.referenceImage);

      for (const view of char.views || []) {
        pushRef(view.imageBase64 || view.imageUrl);
        if (refs.length >= MAX_REFS) return refs;
      }

      for (const image of char.referenceImages || []) {
        pushRef(image);
        if (refs.length >= MAX_REFS) return refs;
      }

      for (const image of selectedVariation?.clothingReferenceImages || []) {
        pushRef(image);
        if (refs.length >= MAX_REFS) return refs;
      }
    }

    return refs.slice(0, MAX_REFS);
  }, []);
  // Handle quad grid click
  const handleQuadGridClick = useCallback((sceneId: number, type: "start" | "end") => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    const imageUrl = type === "start"
      ? (scene.imageDataUrl || scene.imageHttpUrl)
      : (scene.endFrameImageUrl || scene.endFrameHttpUrl);
    if (!imageUrl) {
      toast.error(`Vui lòng tạo ${type === "start" ? "khung hình đầu tiên" : "khung hình cuối"} trước`);
      return;
    }

    setQuadGridTarget({ sceneId, type });
    setQuadGridOpen(true);
  }, [splitScenes]);

  // Handle quad grid generation
  const handleQuadGridGenerate = useCallback(async (variationType: QuadVariationType, useCharacterRef: boolean = false) => {
    if (!quadGridTarget) return;

    const scene = splitScenes.find(s => s.id === quadGridTarget.sceneId);
    if (!scene) return;

    const sourceImage = quadGridTarget.type === "start" 
      ? (scene.imageDataUrl || scene.imageHttpUrl) 
      : (scene.endFrameImageUrl || scene.endFrameHttpUrl);
    if (!sourceImage) {
      toast.error("\u627e\u4e0dĐến\u539f\u56fe");
      return;
    }

    // Get API key - sử dụng\u670d\u52a1\u6620\u5c04Cấu hình
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error('Vui lòng vào Cài đặt để cấu hình API tạo ảnh');
      setQuadGridOpen(false);
      return;
    }
    
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      setQuadGridOpen(false);
      return;
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng vào Cài đặt để cấu hình mô hình tạo ảnh');
      setQuadGridOpen(false);
      return;
    }
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      setQuadGridOpen(false);
      return;
    }
    
    console.log('[QuadGrid] Using image config:', { platform, model, imageBaseUrl });

    setIsQuadGridGenerating(true);
    // \u4e0d\u5728\u8fd9\u91ccĐóng\u5bf9\u8bdd\u6846，giữMở\u663e\u793aTiến độ
    // setQuadGridOpen(false) \u79fbĐếnTạoThành công\u540e

    try {
      // Build variation labels based on type
      const variationLabels = variationType === 'angle'
        ? ['phía trước\u504f\u5de6', 'phía trước\u504f\u53f3', '\u4fa7\u9762Đặc tả', 'Toàn cảnhnhìn ra']
        : variationType === 'composition'
          ? ['\u5168\u8eabToàn cảnh', '\u534a\u8eabTrung cảnh', 'đối mặtĐặc tả', 'môi trường\u4ea4\u4ee3']
          : ['Hành động\u8d77\u59cb', 'Hành động\u8fc7\u7a0b', 'Hành độcực khoái', 'Hành độngKết thúc'];

      const variationPrompts = variationType === 'angle'
        ? ['slight left angle view', 'slight right angle view', 'side profile close-up', 'wide aerial overview']
        : variationType === 'composition'
          ? ['full body wide shot', 'medium shot waist up', 'close-up face', 'establishing shot with environment']
          : ['action beginning', 'action in progress', 'action climax', 'action ending'];

      // Build base prompt from scene
      const basePrompt = scene.imagePromptZh?.trim() || scene.imagePrompt?.trim() || scene.videoPromptZh?.trim() || scene.videoPrompt?.trim() || '';
      const styleTokens = storyboardConfig.styleTokens || [];
      const aspect = storyboardConfig.aspectRatio || '9:16';

      // === nhân vật\u6570\u91cfkhoảng\u675f ===
      const charCount = scene.characterIds?.length || 0;
      let charCountPhrase = '';
      
      if (!useCharacterRef) {
        // \u65b9\u6848A (Mặc định): tin tưởng\u539f\u56fe，Xóa\u5e72\u6270
        charCountPhrase = 'Keep the EXACT same number of characters and their positions as the reference image. Do NOT add or remove characters. Maintain the original character composition.';
      } else {
        // \u65b9\u6848B (\u52fe\u9009): Sử dụng Thư viện nhân vậsự phản bội，\u4fdd\u7559\u786c\u6027\u4eba\u6570\u9650\u5236
        charCountPhrase = charCount === 0 
          ? 'NO human figures in any panel, empty scene or environment only.' 
          : charCount === 1 
            ? 'EXACTLY ONE person in each panel, single character only, do NOT duplicate the character.'
            : `EXACTLY ${charCount} distinct people in each panel, no more no less, each person appears only ONCE.`;
      }

      // === \u7ad6\u5c4fthành phầnkhoảng\u675f（vớichíncung điện\u683cmột\u81f4） ===
      const verticalConstraint = aspect === '9:16' ? 'vertical composition, tighter framing, avoid letterboxing, ' : '';

      // === Hành độngMô tả（\u5bf9\u65f6\u523bthay đổi\u4f53quan trọng） ===
      const actionDesc = scene.actionSummary?.trim() || '';
      const actionContext = (variationType === 'moment' && actionDesc) 
        ? `Action sequence context: ${actionDesc}. ` 
        : '';

      // === cảm xúcbầu không khí（giữmột\u81f4\u6027） ===
      const emotionDesc = buildEmotionDescription(scene.emotionTags || []);
      const moodContext = emotionDesc ? `Mood across all panels: ${emotionDesc} ` : '';

      // === Cảnh\u4e0a\u4e0b\u6587 ===
      const sceneContext = [scene.sceneName, scene.sceneLocation].filter(Boolean).join(' - ');
      const settingContext = sceneContext ? `Setting: ${sceneContext}. ` : '';

      // === Phong cách\u952etừ\u7ec4 ===
      const styleStr = styleTokens.length > 0 ? `Artistic style consistent: ${styleTokens.join(', ')}. ` : '';

      // Build 2x2 grid prompt
      const gridPromptParts: string[] = [];
      gridPromptParts.push('Generate a 2x2 grid image with 4 panels, each panel separated by thin white lines.');
      gridPromptParts.push('Layout: 2 rows, 2 columns, reading order left-to-right, top-to-bottom.');
      
      // \u6bcfmột\u9762\u677fcủaMô tả（chứanhân vật\u6570\u91cfkhoảng\u675f）
      variationPrompts.forEach((v, idx) => {
        const row = Math.floor(idx / 2) + 1;
        const col = (idx % 2) + 1;
        gridPromptParts.push(`Panel [row ${row}, col ${col}]: ${verticalConstraint}${charCountPhrase} ${basePrompt}, ${v}`);
      });
      
      // tình hình chungkhoảng\u675f
      if (settingContext) gridPromptParts.push(settingContext);
      if (actionContext) gridPromptParts.push(actionContext);
      if (moodContext) gridPromptParts.push(moodContext);
      if (styleStr) gridPromptParts.push(styleStr);
      
      // === một\u81f4\u6027\u952etừ\u7ec4（với buildAnchorPhrase một\u81f4） ===
      gridPromptParts.push('Keep character appearance, wardrobe and facial features consistent across all 4 panels.');
      gridPromptParts.push('Keep lighting and color grading consistent across all 4 panels.');
      gridPromptParts.push('IMPORTANT: NO TEXT, NO WORDS, NO LETTERS, NO CAPTIONS, NO SPEECH BUBBLES, NO DIALOGUE BOXES, NO SUBTITLES, NO WRITING of any kind in any panel.');

      const gridPrompt = gridPromptParts.join(' ');
      console.log('[QuadGrid] Grid prompt:', gridPrompt.substring(0, 200) + '...');

      // Collect reference images
      const refs: string[] = [sourceImage];
      // Chỉ Có\u5728\u52fe\u9009\u4e86"Tài liệu tham khảoThư viện nhân vật\u5f62\u8c61"\u65f6，\u624dThêm nhân vậsự phản bội\u56fe
      if (useCharacterRef && scene.characterIds?.length) {
        refs.push(...getCharacterReferenceImages(scene.characterIds, scene.characterVariationMap));
      }
      if (scene.sceneReferenceImage) {
        refs.push(scene.sceneReferenceImage);
      }

      // Process refs for API
      const processedRefs: string[] = [];
      for (const url of refs.slice(0, 14)) {
        if (!url) continue;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          processedRefs.push(url);
        } else if (url.startsWith('data:image/') && url.includes(';base64,')) {
          processedRefs.push(url);
        } else if (url.startsWith('local-image://')) {
          try {
            const base64 = await readImageAsBase64(url);
            if (base64) processedRefs.push(base64);
          } catch (e) {
            console.warn('[QuadGrid] Failed to read local image:', url);
          }
        }
      }

      // Parse result helper（sử dụng\u4e8e\u8f6e\u8be2\u9636\u6bb5）
      const normalizeUrl = (url: any): string | undefined => {
        if (!url) return undefined;
        if (Array.isArray(url)) return url[0] || undefined;
        if (typeof url === 'string') return url;
        return undefined;
      };

      // \u8c03sử dụng API - sử dụng\u667a\u80fd\u8def\u7531（\u81ea\u52a8\u9009\u62e9 chat completions hoặc images/generations）
      console.log('[QuadGrid] Calling API, model:', model);
      const apiResult = await submitGridImageRequest({
        model,
        prompt: gridPrompt,
        apiKey,
        baseUrl: imageBaseUrl,
        aspectRatio: aspect,
        resolution: storyboardConfig.resolution || '2K',
        referenceImages: processedRefs.length > 0 ? processedRefs : undefined,
        keyManager,
      });

      let gridImageUrl = apiResult.imageUrl;
      let taskId = apiResult.taskId;

      // Poll if async
      if (!gridImageUrl && taskId) {
        console.log('[QuadGrid] Polling task:', taskId);
        const pollInterval = 2000;
        const maxAttempts = 60;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const statusUrl = new URL(`${imageBaseUrl}/v1/tasks/${taskId}`);
          statusUrl.searchParams.set('_ts', Date.now().toString());
          
          const statusResp = await fetch(statusUrl.toString(), {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          
          if (!statusResp.ok) throw new Error(`Truy vấnNhiệm vụThất bại: ${statusResp.status}`);
          
          const statusData = await statusResp.json();
          const status = (statusData.status ?? statusData.data?.status ?? '').toString().toLowerCase();
          
          if (status === 'completed' || status === 'succeeded' || status === 'success') {
            const images = statusData.result?.images ?? statusData.data?.result?.images;
            if (images?.[0]) {
              gridImageUrl = normalizeUrl(images[0].url || images[0]);
            }
            gridImageUrl = gridImageUrl || normalizeUrl(statusData.output_url) || normalizeUrl(statusData.url);
            break;
          }
          
          if (status === 'failed' || status === 'error') {
            throw new Error(statusData.error || 'Hình ảnhTạoThất bại');
          }
          
          await new Promise(r => setTimeout(r, pollInterval));
        }
      }

      if (!gridImageUrl) {
        throw new Error('\u672a\u83b7\u53d6Đếnbốncung điện\u683cHình ảnh URL');
      }

      console.log('[QuadGrid] Grid image URL:', gridImageUrl.substring(0, 80));

      // Slice 2x2 grid into 4 images
      const slicedImages = await new Promise<string[]>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const tileW = Math.floor(img.width / 2);
          const tileH = Math.floor(img.height / 2);
          const results: string[] = [];
          
          for (let i = 0; i < 4; i++) {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const canvas = document.createElement('canvas');
            canvas.width = tileW;
            canvas.height = tileH;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, col * tileW, row * tileH, tileW, tileH, 0, 0, tileW, tileH);
            results.push(canvas.toDataURL('image/png'));
          }
          resolve(results);
        };
        img.onerror = () => reject(new Error('\u52a0\u8f7dbốncung điện\u683cHình ảnhThất bại'));
        img.src = gridImageUrl!;
      });

      console.log('[QuadGrid] Sliced into', slicedImages.length, 'images');

      // Set result
      setQuadGridResult({
        originalImage: sourceImage,
        images: slicedImages,
        variationType: variationType === 'angle' ? 'Góc nhìcác biến thể' : variationType === 'composition' ? 'thành phầnthay đổi\u4f53' : '\u65f6\u523bthay đổi\u4f53',
        variationLabels,
      });
      
      // \u81ea\u52a8LưuTất cảbốncung điện\u683cHình ảnhĐếnChất liệu\u5e93
      const folderId = getImageFolderId();
      const variationTypeLabel = variationType === 'angle' ? 'Góc nhìcác biến thể' : variationType === 'composition' ? 'thành phầnthay đổi\u4f53' : '\u65f6\u523bthay đổi\u4f53';
      slicedImages.forEach((img, idx) => {
        addMediaFromUrl({
          url: img,
          name: `bốncung điện\u683c-${variationTypeLabel}-${variationLabels[idx]}`,
          type: 'image',
          source: 'ai-image',
          folderId,
          projectId: mediaProjectId,
        });
      });
      
      // TạoThành công\u540e\u624dĐóng\u9009\u62e9\u5bf9\u8bdd\u6846，Mởkết quả\u5bf9\u8bdd\u6846
      setQuadGridOpen(false);
      setQuadGridResultOpen(true);
      toast.success('bốncung điện\u683cTạoHoàn thành，Đã rồi\u81ea\u52a8LưuĐếnChất liệu\u5e93');

    } catch (error) {
      const err = error as Error;
      console.error('[QuadGrid] Failed:', err);
      toast.error(`bốncung điện\u683cTạoThất bại: ${err.message}`);
    } finally {
      setIsQuadGridGenerating(false);
    }
  }, [quadGridTarget, splitScenes, storyboardConfig, getApiKey, getCharacterReferenceImages]);

  // Apply quad grid result
  const handleApplyQuadGrid = useCallback(async (imageIndex: number) => {
    if (!quadGridResult || !quadGridTarget) return;

    const imageToApply = quadGridResult.images[imageIndex];
    if (!imageToApply) return;

    const frameType = quadGridTarget.type === "start" ? 'first' as const : 'end' as const;
    const { localPath, httpUrl } = await persistSceneImage(imageToApply, quadGridTarget.sceneId, frameType);

    if (quadGridTarget.type === "start") {
      updateSplitSceneImage(quadGridTarget.sceneId, localPath, undefined, undefined, httpUrl || undefined);
    } else {
      updateSplitSceneEndFrame(quadGridTarget.sceneId, localPath, undefined, httpUrl || undefined);
    }

    setQuadGridResultOpen(false);
    setQuadGridResult(null);
    setQuadGridTarget(null);
    toast.success(`Đã rồiÁp dụngĐến${quadGridTarget.type === "start" ? "khung hình đầu tiên" : "\u5c3e\u5e27"}`);
  }, [quadGridResult, quadGridTarget, updateSplitSceneImage, updateSplitSceneEndFrame]);

  // Copy quad grid image to another scene
  const handleCopyQuadGridToScene = useCallback(async (imageIndex: number, targetSceneId: number, targetFrameType: "start" | "end") => {
    if (!quadGridResult) return;

    const imageToApply = quadGridResult.images[imageIndex];
    if (!imageToApply) return;

    const frameType = targetFrameType === "start" ? 'first' as const : 'end' as const;
    const { localPath, httpUrl } = await persistSceneImage(imageToApply, targetSceneId, frameType);

    if (targetFrameType === "start") {
      updateSplitSceneImage(targetSceneId, localPath, undefined, undefined, httpUrl || undefined);
    } else {
      updateSplitSceneEndFrame(targetSceneId, localPath, undefined, httpUrl || undefined);
    }

    toast.success(`Đã rồi\u590d\u5236ĐếnPhân cảnh ${targetSceneId + 1} của${targetFrameType === "start" ? "khung hình đầu tiên" : "\u5c3e\u5e27"}`);
  }, [quadGridResult, updateSplitSceneImage, updateSplitSceneEndFrame]);

  // Save quad grid image to library
  const handleSaveQuadGridToLibrary = useCallback((imageIndex: number) => {
    if (!quadGridResult || !quadGridTarget) return;

    const imageToSave = quadGridResult.images[imageIndex];
    if (!imageToSave) return;

    const folderId = getImageFolderId();
    addMediaFromUrl({
      url: imageToSave,
      name: `bốncung điện\u683c-${quadGridResult.variationType}-${imageIndex + 1}`,
      type: 'image',
      source: 'ai-image',
      folderId,
      projectId: mediaProjectId,
    });

    toast.success('Đã LưuĐếnChất liệu\u5e93');
  }, [quadGridResult, quadGridTarget, getImageFolderId, addMediaFromUrl]);

  // Save all quad grid images to library
  const handleSaveAllQuadGridToLibrary = useCallback(() => {
    if (!quadGridResult) return;

    const folderId = getImageFolderId();
    quadGridResult.images.forEach((img, idx) => {
      addMediaFromUrl({
        url: img,
        name: `bốncung điện\u683c-${quadGridResult.variationType}-${idx + 1}`,
        type: 'image',
        source: 'ai-image',
        folderId,
        projectId: mediaProjectId,
      });
    });

    toast.success(`Đã Lưu ${quadGridResult.images.length} \u5f20Hình ảnhĐếnChất liệu\u5e93`);
  }, [quadGridResult, getImageFolderId, addMediaFromUrl]);

  // Apply angle switch result
  const handleApplyAngleSwitch = useCallback(async () => {
    if (!angleSwitchResult || !angleSwitchTarget) return;

    // từ store trong\u8bfb\u53d6Lịch sử
    const scene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
    const history = angleSwitchTarget.type === "start"
      ? (scene?.startFrameAngleSwitchHistory || [])
      : (scene?.endFrameAngleSwitchHistory || []);

    // Use selected history item if available, otherwise use current result
    const imageToApply = selectedHistoryIndex >= 0 && history[selectedHistoryIndex]
      ? history[selectedHistoryIndex].imageUrl
      : angleSwitchResult.newImage;

    const frameType = angleSwitchTarget.type === "start" ? 'first' as const : 'end' as const;
    const { localPath, httpUrl } = await persistSceneImage(imageToApply, angleSwitchTarget.sceneId, frameType);

    if (angleSwitchTarget.type === "start") {
      updateSplitSceneImage(angleSwitchTarget.sceneId, localPath, undefined, undefined, httpUrl || undefined);
    } else {
      updateSplitSceneEndFrame(angleSwitchTarget.sceneId, localPath, undefined, httpUrl || undefined);
    }

    setAngleSwitchResultOpen(false);
    setAngleSwitchResult(null);
    setAngleSwitchTarget(null);
    setSelectedHistoryIndex(-1);
    toast.success("Góc nhìnĐã rồiÁp dụng");
  }, [angleSwitchResult, angleSwitchTarget, splitScenes, selectedHistoryIndex, updateSplitSceneImage, updateSplitSceneEndFrame]);

  // Handle auto-generate prompts using Gemini Vision
  const handleAutoGeneratePrompts = useCallback(async () => {
    if (!storyboardImage || splitScenes.length === 0) {
      toast.error("không có\u6cd5TạoPrompt：thiếu\u5931câu chuyện\u677fhoặcPhân cảnh");
      return;
    }

    // \u5c1d\u8bd5\u83b7\u53d6Hình ảtôi hiểu rồiCấu hình（\u4ec5\u5f53một phầnPhân cảnhthiếu\u5c11\u6587từMô tả\u65f6\u624d\u9700\u8981）
    const featureConfig = getFeatureConfig('image_understanding');
    const apiKey = featureConfig?.apiKey || '';
    const provider = featureConfig?.platform || '';
    const model = featureConfig?.models?.[0] || '';
    const baseUrl = featureConfig?.baseUrl?.replace(/\/+$/, '') || '';
    // Note: API config is optional - if scenes have text descriptions, no API is needed

    setIsGeneratingPrompts(true);
    toast.info("Là Theo Ph.ân cảnh nội dung TạoPrompt...");

    try {
      // Get story prompt from storyboard config
      const storyPrompt = storyboardConfig.storyPrompt || "VideoPhân cảnh";

      const prompts = await generateScenePrompts({
        storyboardImage,
        storyPrompt,
        scenes: splitScenes.map(s => ({
          id: s.id,
          row: s.row,
          col: s.col,
          // Pass existing script data for better context
          actionSummary: s.actionSummary,
          cameraMovement: s.cameraMovement,
          dialogue: s.dialogue,
          // Additional fields for text-based generation
          sceneName: s.sceneName,
          sceneDescription: s.sceneLocation,
        })),
        apiKey,
        provider: provider as any,
        baseUrl,
        model,
      });

      // Update store with generated three-tier prompts
      let updatedCount = 0;
      let endFrameCount = 0;
      
      prompts.forEach(p => {
        if (p.videoPrompt || p.imagePrompt) {
          // Update first frame prompt (static)
          updateSplitSceneImagePrompt(p.id, p.imagePrompt, p.imagePromptZh);
          
          // Update video prompt (dynamic action)
          updateSplitSceneVideoPrompt(p.id, p.videoPrompt, p.videoPromptZh);
          
          // Update end frame settings
          updateSplitSceneNeedsEndFrame(p.id, p.needsEndFrame);
          if (p.needsEndFrame && p.endFramePrompt) {
            updateSplitSceneEndFramePrompt(p.id, p.endFramePrompt, p.endFramePromptZh);
            endFrameCount++;
          }
          
          updatedCount++;
        }
      });

      toast.success(`Thành côngTạo ${updatedCount} Phân cảnhPrompt（${endFrameCount} một\u9700\u8981\u5c3e\u5e27）`);
    } catch (error) {
      const err = error as Error;
      console.error("[SplitScenes] Prompt generation failed:", err);
      toast.error(`TạoThất bại: ${err.message}`);
    } finally {
      setIsGeneratingPrompts(false);
    }
  }, [storyboardImage, splitScenes, storyboardConfig, getApiKey, updateSplitSceneImagePrompt, updateSplitSceneVideoPrompt, updateSplitSceneEndFramePrompt, updateSplitSceneNeedsEndFrame]);

  /** @deprecated sử dụng lớp S generateAllGroups hoặc handleGenerateSingleVideo \u66ff\u4ee3 */
  const handleGenerateVideos = useCallback(async () => {
    console.warn('[DEPRECATED] handleGenerateVideos Đã rồi\u5e9f\u5f03，\u8bf7sử dụng lớp SLô Tạo');
    if (splitScenes.length === 0) {
      toast.error("Không có gì với TạPh của oân cảnh");
      return;
    }

    const featureConfig = getFeatureConfig('video_generation');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('video_generation'));
      return;
    }
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    const provider = featureConfig.platform;

    // Check if all scenes have prompts
    const scenesWithoutPrompts = splitScenes.filter(s => !s.videoPrompt.trim());
    if (scenesWithoutPrompts.length > 0) {
      toast.warning(`\u8fd8Có ${scenesWithoutPrompts.length} Phân cảnh\u6ca1CóPrompt，\u5c06sử dụng Mặc địnhPrompt`);
    }

    // Filter scenes that need generation (idle or failed)
    const scenesToGenerate = splitScenes.filter(
      s => s.videoStatus === 'idle' || s.videoStatus === 'failed'
    );

    if (scenesToGenerate.length === 0) {
      toast.info("Tất cảPhân cảnhĐã TạohoặcLà Tạotrong");
      return;
    }

    setIsGenerating(true);
    toast.info(`Bắt đầu\u4e32được rồiTạo ${scenesToGenerate.length} mộtVideo...\u6bcflần\u5904\u7406 ${concurrency} một`);

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    // Process scenes sequentially (serial) or with limited concurrency
    for (let i = 0; i < scenesToGenerate.length; i += concurrency) {
      const batch = scenesToGenerate.slice(i, i + concurrency);
      
      await Promise.all(batch.map(async (scene) => {
        setCurrentGeneratingId(scene.id);
        
        try {
          // Update status to generating
          updateSplitSceneVideo(scene.id, {
            videoStatus: 'uploading',
            videoProgress: 0,
            videoError: null,
          });

          // Real API call - upload image first if needed
          let imageUrl = scene.imageDataUrl;
          if (scene.imageDataUrl.startsWith('data:')) {
            const response = await fetch(scene.imageDataUrl);
            const blob = await response.blob();
            const formData = new FormData();
            formData.append('file', blob, `scene-${scene.id}.png`);
            
            const uploadResponse = await fetch(`${baseUrl}/api/upload`, {
              method: 'POST',
              body: formData,
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              imageUrl = uploadData.url || scene.imageDataUrl;
            }
          }

          updateSplitSceneVideo(scene.id, {
            videoStatus: 'generating',
            videoProgress: 20,
          });

          // Submit video generation
          // sử dụng\u7edfmột prompt-builder \u6784\u5efaprompt（với handleGenerateSingleVideo giữmột\u81f4）
          const cinProfile = projectData?.cinematographyProfileId
            ? getCinematographyProfile(projectData.cinematographyProfileId)
            : undefined;
          const fullPrompt = buildVideoPrompt(scene, cinProfile, {
            styleTokens: [getStylePrompt(currentStyleId)],
            aspectRatio: storyboardConfig.aspectRatio,
            mediaType: getMediaType(currentStyleId),
          });
          const videoDuration = Math.max(4, Math.min(12, scene.duration || 5));
          
          const submitResponse = await fetch(`${baseUrl}/api/ai/video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl,
              prompt: fullPrompt || scene.videoPrompt || `Phân cảnh ${scene.id + 1} \u52a8\u6001\u6548\u679c`,
              aspectRatio: storyboardConfig.aspectRatio,
              duration: videoDuration,
              apiKey,
              provider,
            }),
          });

          if (!submitResponse.ok) {
            const errorData = await submitResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Video API failed: ${submitResponse.status}`);
          }

          const submitData = await submitResponse.json();

          // If direct video URL returned
          if (submitData.videoUrl && submitData.status === 'completed') {
            updateSplitSceneVideo(scene.id, {
              videoStatus: 'completed',
              videoProgress: 100,
              videoUrl: submitData.videoUrl,
            });
            toast.success(`Phân cảnh ${scene.id + 1} tạo video hoàn thành`);
            return;
          }

          // Poll for completion
          if (submitData.taskId) {
            const pollInterval = 3000;
            const maxAttempts = 120; // 6 minutes max
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              const progress = Math.min(20 + Math.floor((attempt / maxAttempts) * 80), 99);
              updateSplitSceneVideo(scene.id, { videoProgress: progress });

              const statusResponse = await fetch(
                `${baseUrl}/api/ai/task/${submitData.taskId}?apiKey=${encodeURIComponent(apiKey)}&provider=${provider}&type=video`
              );

              if (!statusResponse.ok) {
                throw new Error(`Failed to check task status: ${statusResponse.status}`);
              }

              const statusData = await statusResponse.json();
              const status = statusData.status?.toLowerCase();

              if (status === 'completed' || status === 'success') {
                const videoUrl = statusData.videoUrl || statusData.url || statusData.resultUrl;
                if (!videoUrl) throw new Error('Task completed but no video URL');
                
                updateSplitSceneVideo(scene.id, {
                  videoStatus: 'completed',
                  videoProgress: 100,
                  videoUrl,
                });
                toast.success(`Phân cảnh ${scene.id + 1} tạo video hoàn thành`);
                return;
              }

              if (status === 'failed' || status === 'error') {
                throw new Error(statusData.error || 'Video generation failed');
              }

              await new Promise(r => setTimeout(r, pollInterval));
            }

            throw new Error('Tạo video quá thời gian chờ');
          }

          throw new Error('Invalid API response');

        } catch (error) {
          const err = error as Error;
          console.error(`[SplitScenes] Scene ${scene.id} video generation failed:`, err);
          updateSplitSceneVideo(scene.id, {
            videoStatus: 'failed',
            videoProgress: 0,
            videoError: err.message,
          });
          toast.error(`Phân cảnh ${scene.id + 1} TạoThất bại: ${err.message}`);
        }
      }));
    }

    setIsGenerating(false);
    setCurrentGeneratingId(null);
    
    const completedCount = splitScenes.filter(s => s.videoStatus === 'completed').length;
    if (completedCount === splitScenes.length) {
      toast.success("Tất cả video đã tạo xong!");
    }
  }, [splitScenes, storyboardConfig, getApiKey, concurrency, updateSplitSceneVideo]);


  // Generate video for a single scene - directly calls API with key rotation
  const handleGenerateSingleVideo = useCallback(async (sceneId: number) => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Debug: Check API store state
    const apiStore = useAPIConfigStore.getState();
    console.log('[SplitScenes] API Store state:', {
      providers: apiStore.providers.length,
      apiKeys: Object.keys(apiStore.apiKeys),
      memefastKey: apiStore.apiKeys['memefast'] ? 'set' : 'not set',
      getApiKey_memefast: apiStore.getApiKey('memefast') ? 'set' : 'not set',
    });

    // Use feature router with key rotation support
    const featureConfig = getFeatureConfig('video_generation');
    console.log('[SplitScenes] Feature config for video_generation:', featureConfig ? {
      platform: featureConfig.platform,
      model: featureConfig.models?.[0],
      apiKey: featureConfig.apiKey ? `${featureConfig.apiKey.substring(0, 8)}...` : 'empty',
      providerId: featureConfig.provider?.id,
    } : 'null');
    
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('video_generation'));
      return;
    }
    
    // từ\u670d\u52a1\u6620\u5c04\u83b7\u53d6 platform và model
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng vào Cài đặt để cấu hình mô hình tạo video');
      return;
    }
    const videoBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!videoBaseUrl) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo video');
      return;
    }
    
    console.log('[SplitScenes] Using video config:', { platform, model, videoBaseUrl });
    
    // Get rotating key from manager
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error(`Vui lòng cấu hình API Key cho ${platform} trước`);
      return;
    }
    
    console.log(`[SplitScenes] Using API key ${keyManager.getTotalKeyCount()} keys, current index available: ${keyManager.getAvailableKeyCount()}`);

    setIsGenerating(true);
    setCurrentGeneratingId(sceneId);

    try {
      // Reset and start
      updateSplitSceneVideo(sceneId, {
        videoStatus: 'uploading',
        videoProgress: 0,
        videoError: null,
        videoUrl: null,
      });

      // khung hình đầu tiênHình ảlogic lựa chọn nh：
      // 1. Ưu tiênsử dụng imageDataUrl（Người dùng\u6700\u65b0\u9009\u62e9/Tải lênHình ảnh）
      // 2. Chỉ Có\u5f53 imageSource === 'ai-generated' \u4e14 imageHttpUrl \u662fCó\u6548 URL \u65f6\u624dsử dụng imageHttpUrl
      // 3. \u5426\u5219sử dụng imageDataUrl \u5e76Chấp nhậnLưu trữ ảnhTải lên\u8f6c\u6362cho HTTP URL
      // chìa khóa：\u5408\u5e76Tạo Hình ảnh\u6ca1Có imageHttpUrl（\u88ab\u6e05\u9664cho null），\u5fc5\u987b\u91cd\u65b0Tải lên
      let firstFrameUrl = scene.imageDataUrl;
      
      // \u68c0\u67e5 imageHttpUrl \u662f\u5426\u662fCó\u6548của HTTP URL（\u975e null、\u975e undefined、\u975e\u7a7achuỗi）
      const hasValidHttpUrl = scene.imageHttpUrl && 
                              typeof scene.imageHttpUrl === 'string' && 
                              scene.imageHttpUrl.startsWith('http');
      
      // Chẳng hạn như\u679c imageDataUrl \u4e0d\u662f HTTP URL，\u68c0\u67e5\u662f\u5426Có\u5bf9\u5e94của imageHttpUrl
      if (firstFrameUrl && !firstFrameUrl.startsWith('http://') && !firstFrameUrl.startsWith('https://')) {
        // imageDataUrl \u662f\u672c\u5730Định dạng（base64 hoặc local-image://）
        if (hasValidHttpUrl && scene.imageSource === 'ai-generated') {
          // Chỉ Có\u5f53 imageSource \u660e\u786e\u6807\u8bb0cho 'ai-generated' \u4e14CóCó\u6548của HTTP URL \u65f6\u624dsử dụng
          // \u8fd9\u610f\u5473\u7740Đây là\u5355\u5f20 AI Tạo Hình ảnh，\u4e0d\u662f\u5408\u5e76Tạo\u5207\u5272Hình ảnh
          console.log('[SplitScenes] Using imageHttpUrl for AI-generated image:', scene.imageHttpUrl!.substring(0, 60));
          firstFrameUrl = scene.imageHttpUrl!;
        } else {
          // \u5426\u5219sử dụng imageDataUrl（\u5408\u5e76Tạo\u5207\u5272Hình ảnh、Chất liệu\u5e93\u9009\u62e9Hình ảnhĐợi đã）
          // Sẽ Chấp nhậnLưu trữ ảnhTải lên\u8f6c\u6362cho HTTP URL
          console.log('[SplitScenes] Using imageDataUrl (will upload to image host):', 
            hasValidHttpUrl ? 'has old httpUrl but imageSource=' + scene.imageSource : 'no valid httpUrl');
        }
      }
      
      if (!firstFrameUrl) {
        toast.error(`Phân cảnh ${sceneId + 1} \u6ca1Cókhung hình đầu tiênHình ảnh，\u8bf7đầu tiênTạo hình ảnh`);
        setIsGenerating(false);
        setCurrentGeneratingId(null);
        return;
      }
      console.log('[SplitScenes] First frame source:', firstFrameUrl.startsWith('http') ? 'HTTP URL' : 'local/base64');
      
      // Chỉ khi cầnEndFrame cho true \u65f6\u624dsử dụng\u5c3e\u5e27
      // Chẳng hạn như\u679cNgười dùngĐã rồiXoá\u5c3e\u5e27hoặcĐóng\u4e86\u5c3e\u5e27\u5f00\u5173，\u5219\u4e0dsử dụng\u5c3e\u5e27\u4f5cchoVideoTạoTài liệu tham khảo
      let lastFrameUrl: string | null | undefined = null;
      if (scene.needsEndFrame && scene.endFrameImageUrl) {
        // Ưu tiênsử dụng endFrameHttpUrl（nguyên bản HTTP URL）
        // nếu không，\u5c1d\u8bd5sử dụng endFrameImageUrl（\u53ef\u80fd\u9700\u8981Tải lênLưu trữ ảnh）
        lastFrameUrl = scene.endFrameHttpUrl || scene.endFrameImageUrl;
        console.log('[SplitScenes] Using end frame for video generation');
      } else {
        console.log('[SplitScenes] Skipping end frame: needsEndFrame=', scene.needsEndFrame, 'hasEndFrame=', !!scene.endFrameImageUrl);
      }

      // Collect character reference images
      const characterRefs = scene.characterIds?.length 
        ? getCharacterReferenceImages(scene.characterIds, scene.characterVariationMap)
        : [];

      updateSplitSceneVideo(sceneId, {
        videoStatus: 'generating',
        videoProgress: 20,
      });

      // ========== \u6784\u5efaVideoPrompt（sử dụng\u7edfmột prompt-builder \u6a21\u5757） ==========
      const cinProfile = projectData?.cinematographyProfileId
        ? getCinematographyProfile(projectData.cinematographyProfileId)
        : undefined;
      
      const fullPrompt = buildVideoPrompt(scene, cinProfile, {
        styleTokens: [getStylePrompt(currentStyleId)],
        aspectRatio: storyboardConfig.aspectRatio,
        mediaType: getMediaType(currentStyleId),
      });
      
      // sử dụngNgười dùngCài đặtThời lượng，Mặc định 5 giây
      // Seedance 1.5 Pro cần 4-12 giây，Giới hạn bắt buộc
      const rawDuration = scene.duration || 5;
      const videoDuration = Math.max(4, Math.min(12, rawDuration));

      console.log('[SplitScenes] Video generation params:', {
        sceneId,
        hasFirstFrame: !!firstFrameUrl,
        hasLastFrame: !!lastFrameUrl,
        characterRefCount: characterRefs.length,
        shotSize: scene.shotSize,
        duration: videoDuration,
        ambientSound: scene.ambientSound,
        soundEffects: scene.soundEffects,
        emotionTags: scene.emotionTags,
        fullPrompt,
      });

      // Normalize URL - handle array format ['url'] and extract string
      const normalizeUrl = (url: any): string => {
        if (!url) return '';
        // Handle array format: ['url'] -> 'url'
        if (Array.isArray(url)) {
          return url[0] || '';
        }
        if (typeof url === 'string') {
          return url;
        }
        return '';
      };


      // Build image_with_roles array
      interface ImageWithRole {
        url: string;
        role: 'first_frame' | 'last_frame';
      }
      const imageWithRoles: ImageWithRole[] = [];

      // First frame (REQUIRED for i2v mode) - must have valid HTTP URL
      const normalizedFirstFrame = normalizeUrl(firstFrameUrl);
      console.log('[SplitScenes] First frame URL (normalized):', normalizedFirstFrame?.substring(0, 80));
      
      const firstFrameConverted = await convertToHttpUrl(normalizedFirstFrame);
      if (!firstFrameConverted) {
        throw new Error('không có\u6cd5\u83b7\u53d6khung hình đầu tiênHình ảnh HTTP URL，\u8bf7\u91cd\u65b0Tạo hình ảnh');
      }
      imageWithRoles.push({ url: firstFrameConverted, role: 'first_frame' });
      console.log('[SplitScenes] First frame HTTP URL:', firstFrameConverted.substring(0, 60));

      // Last frame (optional)
      if (lastFrameUrl) {
        const lastFrameConverted = await convertToHttpUrl(lastFrameUrl);
        if (lastFrameConverted) {
          imageWithRoles.push({ url: lastFrameConverted, role: 'last_frame' });
          console.log('[SplitScenes] Last frame HTTP URL:', lastFrameConverted.substring(0, 60));
        }
      }

      // NOTE: Some providers cannot mix reference_image with first_frame/last_frame
      // So we only use first_frame + optional last_frame for i2v mode
      // Character references are NOT supported in this mode
      if (characterRefs.length > 0) {
        console.log('[SplitScenes] Skipping', characterRefs.length, 'character refs - cannot mix with first_frame');
      }

      console.log('[SplitScenes] image_with_roles:', imageWithRoles.length, 'images', imageWithRoles.map(i => i.role));

      // \u8c03sử dụng\u7edfmộtVideoTạo API（\u81ea\u52a8\u8def\u7531Đến\u6b63\u786ecủa MemeFast \u7aef\u70b9）
      const videoUrl = await callVideoGenerationApi(
        apiKey,
        fullPrompt,
        videoDuration,
        storyboardConfig.aspectRatio,
        imageWithRoles,
        (progress) => {
          updateSplitSceneVideo(sceneId, { videoProgress: progress });
        },
        keyManager,
        platform,
        storyboardConfig.videoResolution as '480p' | '720p' | '1080p' | undefined,
      );

      // Save video to local file system (Electron) for persistence
      let finalVideoUrl = videoUrl;
      try {
        const filename = `scene_${sceneId + 1}_${Date.now()}.mp4`;
        finalVideoUrl = await saveVideoToLocal(videoUrl, filename);
        console.log('[SplitScenes] Video saved locally:', finalVideoUrl);
      } catch (e) {
        console.warn('[SplitScenes] Failed to save video locally, using URL:', e);
      }
      
      // Auto-save to library (use first frame as thumbnail, pass duration)
      const mediaId = autoSaveVideoToLibrary(sceneId, finalVideoUrl, scene.imageDataUrl, videoDuration);
      updateSplitSceneVideo(sceneId, {
        videoStatus: 'completed',
        videoProgress: 100,
        videoUrl: finalVideoUrl,
        videoMediaId: mediaId,
      });
      toast.success(`Phân cảnh ${sceneId + 1} VideoTạoHoàn thành，Đã LưuĐếnChất liệu\u5e93`);
      
      // \u89c6\u89c9\u8fde\u7eed\u6027：\u4ec5\u5f53Phân cảnh\u9700\u8981\u5c3e\u5e27\u65f6，Trích xuấtVideo\u6700\u540emột\u5e27
      const currentScene = splitScenes.find(s => s.id === sceneId);
      const shouldExtractEndFrame = currentScene?.needsEndFrame && !currentScene?.endFrameImageUrl;
      
      if (shouldExtractEndFrame) {
        (async () => {
          try {
            const lastFrameBase64 = await extractLastFrameFromVideo(finalVideoUrl, 0.1);
            if (!lastFrameBase64) {
              console.warn('[SplitScenes] Failed to extract last frame from video');
              return;
            }
            
            // \u6301\u4e45\u5316Đếnđịa phươngTệpHệ thống（local-image://），\u907f\u514d base64 \u88ab partialize \u6e05\u9664
            const persistResult = await persistSceneImage(lastFrameBase64, sceneId, 'end');
            updateSplitSceneEndFrame(sceneId, persistResult.localPath, 'video-extracted', persistResult.httpUrl || undefined);
            console.log('[SplitScenes] Saved video last frame locally:', persistResult.localPath);
          } catch (e) {
            console.warn('[SplitScenes] Error during frame extraction:', e);
          }
        })();
      } else {
        console.log('[SplitScenes] Skipping end frame extraction: needsEndFrame=', currentScene?.needsEndFrame, 'hasEndFrame=', !!currentScene?.endFrameImageUrl);
      }
      
      setIsGenerating(false);
      setCurrentGeneratingId(null);

    } catch (error) {
      const err = error as Error;
      console.error(`[SplitScenes] Scene ${sceneId} video generation failed:`, err);
      
      // Phát hiện\u662f\u5426chobên trong\u5bb9DuyệtLỗi
      const isModerationError = isContentModerationError(err);
      
      if (isModerationError) {
        // bên trong\u5bb9DuyệtLỗi，sử dụng MODERATION_SKIPPED: \u524d\u7f00\u6807\u8bb0
        updateSplitSceneVideo(sceneId, {
          videoStatus: 'failed',
          videoProgress: 0,
          videoError: `MODERATION_SKIPPED:${err.message}`,
        });
        toast.warning(`Phân cảnh ${sceneId + 1} \u56e0bên trong\u5bb9Duyệtbỏ qua`);
        console.log(`[SplitScenes] Scene ${sceneId} skipped due to content moderation`);
      } else {
        // \u666e\u901aLỗi
        updateSplitSceneVideo(sceneId, {
          videoStatus: 'failed',
          videoProgress: 0,
          videoError: err.message,
        });
        toast.error(`Phân cảnh ${sceneId + 1} TạoThất bại: ${err.message}`);
      }
    }

    setIsGenerating(false);
    setCurrentGeneratingId(null);
  }, [splitScenes, storyboardConfig, getApiKey, updateSplitSceneVideo, autoSaveVideoToLibrary, buildEmotionDescription, getCharacterReferenceImages]);

  // Generate image for a single scene using image API
  const handleGenerateSingleImage = useCallback(async (sceneId: number) => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    // sử dụng\u670d\u52a1\u6620\u5c04Cấu hình - \u4e0dMột lần nữa fallback Đến\u786c\u7f16\u7801
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng vào Cài đặt để cấu hình mô hình tạo ảnh');
      return;
    }
    
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    
    console.log('[SingleImage] Using config:', { platform, model, imageBaseUrl });

    // Need a prompt to generate - prefer imagePromptZh (first frame static), fallback to videoPromptZh
    const promptToUse = scene.imagePromptZh?.trim() || scene.imagePrompt?.trim() 
      || scene.videoPromptZh?.trim() || scene.videoPrompt?.trim() || '';
    if (!promptToUse) {
      toast.warning("\u8bf7đầu tiên\u586b\u5199Lời nhắc khung đầu tiên\u540eMột lần nữaTạo hình ảnh");
      return;
    }

    setIsGenerating(true);

    try {
      // Update status
      updateSplitSceneImageStatus(sceneId, {
        imageStatus: 'generating',
        imageProgress: 0,
        imageError: null,
      });

      // Build enhanced prompt with full style prompt for consistency
      let enhancedPrompt = promptToUse;
      const fullStylePrompt = getStylePrompt(currentStyleId);
      if (fullStylePrompt) {
        enhancedPrompt = `${promptToUse}. Style: ${fullStylePrompt}`;
      }

      // Collect reference images: scene background > characters > storyboard style
      const referenceImages: string[] = [];
      
      // 1. \u9996đầu tiênThêmCảnhNềnHình ảnh tham khảo（quan trọng nhất）
      if (scene.sceneReferenceImage) {
        referenceImages.push(scene.sceneReferenceImage);
        console.log('[SplitScenes] Using scene background reference');
      }
      
      // 2. Thêm nhân vậsự phản bội\u56fe
      if (scene.characterIds && scene.characterIds.length > 0) {
        const sceneCharRefs = getCharacterReferenceImages(scene.characterIds, scene.characterVariationMap);
        referenceImages.push(...sceneCharRefs);
      } else if (storyboardConfig.characterReferenceImages && storyboardConfig.characterReferenceImages.length > 0) {
        // Fallback to storyboardConfig characters
        referenceImages.push(...storyboardConfig.characterReferenceImages);
      }
      
      // 3. Thêmnguyên bảnPhân cảnh\u56fe\u4f5cchoPhong cáchTài liệu tham khảo
      if (storyboardImage) {
        referenceImages.push(storyboardImage);
      }

      console.log('[SplitScenes] Generating image:', {
        sceneId,
        prompt: enhancedPrompt.substring(0, 100),
        characterRefCount: referenceImages.length,
        platform,
        model,
        imageBaseUrl,
      });

      // Collect reference images for API
      // Supports: HTTP URLs, base64 Data URI, local-image:// (converted to base64)
      const processedRefs: string[] = [];
      for (const url of referenceImages.slice(0, 14)) {
        if (!url) continue;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          processedRefs.push(url);
        } else if (url.startsWith('data:image/') && url.includes(';base64,')) {
          processedRefs.push(url);
        } else if (url.startsWith('local-image://')) {
          try {
            const base64 = await readImageAsBase64(url);
            if (base64) processedRefs.push(base64);
          } catch (e) {
            console.warn('[SplitScenes] Failed to read local image:', url, e);
          }
        }
      }

      // Call image generation API with smart routing (auto-selects chat/completions or images/generations)
      const apiResult = await submitGridImageRequest({
        model,
        prompt: enhancedPrompt,
        apiKey,
        baseUrl: imageBaseUrl,
        aspectRatio: storyboardConfig.aspectRatio || '9:16',
        resolution: storyboardConfig.resolution || '2K',
        referenceImages: processedRefs.length > 0 ? processedRefs : undefined,
        keyManager,
      });

      // Helper to normalize URL (handle array format) - used in poll responses
      const normalizeUrlValue = (url: any): string | undefined => {
        if (!url) return undefined;
        if (Array.isArray(url)) return url[0] || undefined;
        if (typeof url === 'string') return url;
        return undefined;
      };

      // Direct URL result
      if (apiResult.imageUrl) {
        const persistResult = await persistSceneImage(apiResult.imageUrl, sceneId, 'first');
        updateSplitSceneImage(sceneId, persistResult.localPath, scene.width, scene.height, persistResult.httpUrl || apiResult.imageUrl);
        autoSaveImageToLibrary(sceneId, persistResult.localPath);
        toast.success(`Phân cảnh ${sceneId + 1} Hình ảnhTạoHoàn thành，Đã LưuĐếnChất liệu\u5e93`);
        setIsGenerating(false);
        return;
      }

      // Async task - poll for completion
      let taskId: string | undefined = apiResult.taskId;
      console.log('[SplitScenes] Async task:', taskId);

      // Poll for completion if we have a task ID
      if (taskId) {
        const pollInterval = 2000;
        const maxAttempts = 60; // 2 minutes max
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const progress = Math.min(Math.floor((attempt / maxAttempts) * 100), 99);
          updateSplitSceneImageStatus(sceneId, { imageProgress: progress });

          const url = new URL(`${imageBaseUrl}/v1/tasks/${taskId}`);
          url.searchParams.set('_ts', Date.now().toString());

          const statusResponse = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Cache-Control': 'no-cache',
            },
          });

          if (!statusResponse.ok) {
            if (statusResponse.status === 404) {
              throw new Error('Nhiệm vụ\u4e0d\u5b58\u5728');
            }
            throw new Error(`Failed to check task status: ${statusResponse.status}`);
          }

          const statusData = await statusResponse.json();
          const status = (statusData.status ?? statusData.data?.status ?? 'unknown').toString().toLowerCase();

          if (status === 'completed' || status === 'succeeded' || status === 'success') {
            // Extract image URL (normalize array format)
            const images = statusData.result?.images ?? statusData.data?.result?.images;
            let imageUrl: string | undefined;
            if (images?.[0]) {
              const rawUrl = images[0].url || images[0];
              imageUrl = normalizeUrlValue(rawUrl);
            }
            imageUrl = imageUrl || normalizeUrlValue(statusData.output_url) || normalizeUrlValue(statusData.result_url) || normalizeUrlValue(statusData.url);

            if (!imageUrl) throw new Error('Nhiệm vụHoàn thành\u4f46\u6ca1CóHình ảnh URL');
            
            // \u6301\u4e45\u5316Đến\u672c\u5730 + Lưu trữ ảnh
            const persistResult = await persistSceneImage(imageUrl, sceneId, 'first');
            updateSplitSceneImage(sceneId, persistResult.localPath, scene.width, scene.height, persistResult.httpUrl || imageUrl);
            autoSaveImageToLibrary(sceneId, persistResult.localPath);
            toast.success(`Phân cảnh ${sceneId + 1} Hình ảnhTạoHoàn thành，Đã LưuĐếnChất liệu\u5e93`);
            setIsGenerating(false);
            return;
          }

          if (status === 'failed' || status === 'error') {
            const errorMsg = statusData.error || statusData.message || statusData.data?.error || 'Hình ảnhTạoThất bại';
            console.error('[SplitScenes] Task failed:', statusData);
            throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
          }

          await new Promise(r => setTimeout(r, pollInterval));
        }
        throw new Error('Hình ảnhTạo\u8d85\u65f6');
      }

      throw new Error('Invalid API response: no image URL or task ID');
    } catch (error) {
      const err = error as Error;
      console.error(`[SplitScenes] Scene ${sceneId} image generation failed:`, err);
      updateSplitSceneImageStatus(sceneId, {
        imageStatus: 'failed',
        imageProgress: 0,
        imageError: err.message,
      });
      toast.error(`Phân cảnh ${sceneId + 1} Hình ảnhTạoThất bại: ${err.message}`);
    }

    setIsGenerating(false);
  }, [splitScenes, storyboardConfig, storyboardImage, getApiKey, updateSplitSceneImage, updateSplitSceneImageStatus, autoSaveImageToLibrary, getCharacterReferenceImages]);

  // ===== Utilities for \u5408\u5e76Tạo（chíncung điện\u683c） =====
  type Angle = 'Back View' | 'Over-the-Shoulder (OTS)' | 'POV' | 'Low Angle (Heroic)' | 'High Angle (Vulnerable)' | 'Dutch Angle (Tilted)';

  const allowedShotFromSize = (shot?: ShotSizeType | null): string => {
    switch (shot) {
      case 'ecu': return 'Extreme Close-up (ECU)';
      case 'cu':
      case 'mcu':
      case 'ms':
      case 'mls': return 'Upper Body Shot (Chest-up)';
      case 'ls': return 'Full Body Shot';
      case 'ws': return 'Wide Angle Full Shot';
      default: return 'Upper Body Shot (Chest-up)';
    }
  };

  const allocateAngles = (count: number, preselected: (string | undefined)[]): Angle[] => {
    const result: Angle[] = new Array(count);
    // Desired quotas
    let quotas: Record<Angle, number> = {
      'Back View': 2,
      'Over-the-Shoulder (OTS)': 3,
      'POV': 2,
      'Low Angle (Heroic)': 1,
      'High Angle (Vulnerable)': 1,
      'Dutch Angle (Tilted)': 0,
    };
    // Place user-specified cameraPosition if matches
    const normalize = (s?: string) => (s || '').toLowerCase();
    for (let i = 0; i < count; i++) {
      const u = normalize(preselected[i]);
      let matched: Angle | undefined;
      if (u.includes('over') && u.includes('shoulder')) matched = 'Over-the-Shoulder (OTS)';
      else if (u.includes('pov') || u.includes('point of view')) matched = 'POV';
      else if (u.includes('back')) matched = 'Back View';
      else if (u.includes('low angle')) matched = 'Low Angle (Heroic)';
      else if (u.includes('high angle')) matched = 'High Angle (Vulnerable)';
      else if (u.includes('dutch')) matched = 'Dutch Angle (Tilted)';
      if (matched) {
        result[i] = matched;
        quotas[matched] = Math.max(0, (quotas[matched] || 0) - 1);
      }
    }
    // Fill remaining with quotas
    const fillOrder: Angle[] = [
      'Over-the-Shoulder (OTS)', 'POV', 'Back View',
      'Low Angle (Heroic)', 'High Angle (Vulnerable)', 'Dutch Angle (Tilted)'
    ];
    for (let i = 0; i < count; i++) {
      if (result[i]) continue;
      for (const angle of fillOrder) {
        if ((quotas[angle] || 0) > 0) {
          result[i] = angle;
          quotas[angle]!--;
          break;
        }
      }
      if (!result[i]) result[i] = 'Over-the-Shoulder (OTS)';
    }
    return result;
  };

  const buildAnchorPhrase = (styleTokens?: string[]) => {
    const style = styleTokens && styleTokens.length > 0 ? `Artistic style consistent: ${styleTokens.join(', ')}. ` : '';
    // lực lượng\u7981\u6b62Tạo\u6587từ，\u9632\u6b62\u51fa\u73b0\u5bf9\u8bdd\u6c14\u6ce1、phụ đềĐợi đã
    const noTextConstraint = 'IMPORTANT: NO TEXT, NO WORDS, NO LETTERS, NO CAPTIONS, NO SPEECH BUBBLES, NO DIALOGUE BOXES, NO SUBTITLES, NO WRITING of any kind.';
    return `${style}Keep character appearance, wardrobe and facial features consistent. Keep lighting and color grading consistent. ${noTextConstraint}`;
  };

  const composeTilePrompt = (scene: SplitScene, angle: Angle, aspect: '16:9'|'9:16', styleTokens?: string[]) => {
    const base = scene.imagePromptZh?.trim() || scene.imagePrompt?.trim() || scene.videoPromptZh?.trim() || scene.videoPrompt?.trim() || '';
    const shot = allowedShotFromSize(scene.shotSize);
    const vertical = aspect === '9:16' ? 'vertical composition, tighter framing, avoid letterboxing, ' : '';
    // \u7981sử dụng\u76f8\u673acác môn thể thaovới\u8282\u594f，\u4ec5\u4fdd\u7559Góc nhìn/Cỡ cảnh/thành phần
    const cameraPart = `${angle}, ${shot}`;
    const anchor = buildAnchorPhrase(styleTokens);
    const style = styleTokens && styleTokens.length > 0 ? ` Style: ${styleTokens.join(', ')}` : '';
    
    // nhân vật\u6570\u91cfkhoảng\u675f：\u6839\u636e characterIds \u6570\u91cf\u660e\u786e\u6307\u5b9a，\u9632\u6b62Mô hìnhTạo\u591a\u4f59nhân vật
    const charCount = scene.characterIds?.length || 0;
    const charCountPhrase = charCount === 0 
      ? 'NO human figures in this frame, empty scene or environment only.' 
      : charCount === 1 
        ? 'EXACTLY ONE person in frame, single character only, do NOT duplicate the character.'
        : `EXACTLY ${charCount} distinct people in frame, no more no less, each person appears only ONCE.`;
    
    const prompt = `${cameraPart}, ${vertical}${charCountPhrase} ${base}. ${anchor}.${style}`.replace(/\s+/g, ' ').trim();
    return prompt;
  };

  const handleMergedGenerate = useCallback(async (mode: 'first'|'last'|'both', strategy: 'cluster'|'minimal'|'none' = 'cluster', exemplar: boolean = true) => {
    if (splitScenes.length === 0) {
      toast.error('Không có gì với TạPh của oân cảnh');
      return;
    }

    // \u83b7\u53d6\u56fe\u50cfTạoKhả năng - sử dụng\u670d\u52a1\u6620\u5c04Cấu hình
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng vào Cài đặt để cấu hình mô hình tạo ảnh');
      return;
    }
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    
    console.log('[MergedGen] Using config:', { platform, model, imageBaseUrl });

    setIsMergedRunning(true);
    mergedAbortRef.current = false; // Đặt lạiDừngbiểu tượng
    console.log('[MergedGen] Bắt đầuchíncung điện\u683c\u5408\u5e76Tạo, mode:', mode, 'strategy:', strategy, 'exemplar:', exemplar);

    const aspect = storyboardConfig.aspectRatio || '9:16';
    const styleTokens = storyboardConfig.styleTokens || [];
    // \u59cb\u7ec8sử dụng getStylePrompt \u83b7\u53d6\u5b8c\u6574Phong cáchPrompt（\u4fdd\u8bc1CóMặc địgiá trị nh，\u5373\u4f7f styleTokens cho\u7a7a）
    const fullStylePrompt = getStylePrompt(currentStyleId);
    const fullStyleNegative = getStyleNegativePrompt(currentStyleId);
    const dedup = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

    // === \u7edfmộtNhiệm vụdanh sách\u65b9\u6848：Hỗ trợ\u6df7\u5408chíncung điện\u683c ===
    // Nhiệm vụLoạiĐịnh nghĩa
    type GridTask = { scene: SplitScene; type: 'first' | 'end' };
    
    // quan trọng：VideoĐã TạPh của oân cảnh\u89c6choHoàn thành，\u4e0d\u9700\u8981Một lần nữaTạokhung hình đầu tiênhoặc\u5c3e\u5e27
    const isSceneCompleted = (s: SplitScene) => s.videoUrl || s.videoStatus === 'completed';

    // \u6784\u5efaNhiệm vụdanh sách（Theo Người dùng\u9009\u62e9của mode）
    const tasks: GridTask[] = [];
    for (const scene of splitScenes) {
      if (isSceneCompleted(scene)) continue; // VideoĐã hoàn thành，bỏ qua
      
      // \u4ec5khung hình đầu tiên hoặc \u9996+\u5c3e：\u68c0\u67e5\u662f\u5426\u9700\u8981khung hình đầu tiên
      if ((mode === 'first' || mode === 'both') && !scene.imageDataUrl) {
        tasks.push({ scene, type: 'first' });
      }
      
      // \u4ec5\u5c3e\u5e27 hoặc \u9996+\u5c3e：\u68c0\u67e5Liệu khung hình cuối cùng có cần thiết hay không
      if ((mode === 'last' || mode === 'both') && scene.needsEndFrame && !scene.endFrameImageUrl) {
        tasks.push({ scene, type: 'end' });
      }
    }

    // \u68c0\u67e5\u662f\u5426Có\u9700\u8981Tạocủa
    if (tasks.length === 0) {
      toast.info('Tất cảPhân cảnhĐã TạoHoàn thành，không có\u9700\u91cd\u590dTạo');
      setIsMergedRunning(false);
      return;
    }

    // Thống kêthông tin
    const firstCount = tasks.filter(t => t.type === 'first').length;
    const endCount = tasks.filter(t => t.type === 'end').length;
    const parts: string[] = [];
    if (firstCount > 0) parts.push(`${firstCount}mộtkhung hình đầu tiên`);
    if (endCount > 0) parts.push(`${endCount}mộkhung hình cuối cùng`);
    const completedCount = splitScenes.filter(isSceneCompleted).length;
    const skipInfo = completedCount > 0 ? `（bỏ qua${completedCount}mộtĐã hoàn thànhVideo）` : '';
    toast.info(`Bắt đầuchíncung điện\u683c\u5408\u5e76Tạo：${parts.join('、')}${skipInfo}`);

    // Nhiệm vụPhân trang（\u6bcf9mộtNhiệm vụmột\u9875，\u6df7\u5408khung hình đầu tiênvà\u5c3e\u5e27）
    const taskPages: GridTask[][] = [];
    for (let i = 0; i < tasks.length; i += 9) {
      taskPages.push(tasks.slice(i, i + 9));
    }

    // \u5efa\u7acbHình ảnh tham khảo\u6c60（\u6309Chiến lược\u6536đặt，từNhiệm vụdanh sáchtrongTrích xuấtCảnh）
    const collectRefsFromTasks = (pageTasks: GridTask[]): string[] => {
      if (strategy === 'none') return [];
      const refs: string[] = [];
      const seenScenes = new Set<number>(); // \u907f\u514d\u540cmộtCảnh\u91cd\u590d\u6536đặt
      for (const task of pageTasks) {
        if (seenScenes.has(task.scene.id)) continue;
        seenScenes.add(task.scene.id);
        if (task.scene.sceneReferenceImage) refs.push(task.scene.sceneReferenceImage);
        if (task.scene.characterIds?.length) {
          refs.push(...getCharacterReferenceImages(task.scene.characterIds, task.scene.characterVariationMap));
        }
      }
      // \u53bb\u91cd\u5e76\u9650\u5236\u6570\u91cf（API \u9650\u5236 14 \u5f20）
      return dedup(refs).slice(0, strategy === 'minimal' ? 2 : 14);
    };

    // Theo Ph.ân cảnh số lượngTính toántối ưubố trí lưới（lực lượng N x N \u4ee5\u4fdd\u8bc1Tỷ lệmột\u81f4\u6027）
    const calculateGridLayout = (sceneCount: number): { cols: number; rows: number; paddedCount: number } => {
      // Chiến lược：cho\u4e86\u4fdd\u8bc1\u6bcflướiKích cỡ\u7edd\u5bf9\u5747\u5300，lực lượngsử dụng N x N Bố cục
      // \u8fd9\u6837\u6574\u5f20\u5927\u56fecủa\u5bbd\u9ad8\u6bd4 = \u5355lướtôi là\u5bbd\u9ad8\u6bd4
      // Ví dụ：3x3 Bố cục，\u6bcflưới 16:9，\u6574\u56fe\u4e5f\u662f 16:9
      
      if (sceneCount <= 4) {
        return { cols: 2, rows: 2, paddedCount: 4 }; // 1-4 \u5f20 -> bốncung điện\u683c
      }
      return { cols: 3, rows: 3, paddedCount: 9 }; // 5-9 \u5f20 -> chíncung điện\u683c
    };
    
    // Tính toán\u6574\u5f20\u5927\u56fe\u5e94\u8be5Yêu cầucủa\u5bbd\u9ad8\u6bd4
    // \u5728 N x N Bố cục\u4e0b，\u6574\u56fe\u5bbd\u9ad8\u6bd4\u76f4\u63a5Đợi đã\u4e8eĐíchTỷ lệ khung hình
    const calculateGridAspectRatio = (targetAspect: '16:9' | '9:16'): string => {
      return targetAspect;
    };

    // \u5207\u5272\u5927\u56fecho N một\u5c0f\u56fe（\u6839\u636eBố cụccủađược rồi\u6570vàCột\u6570）
    // chìa khóa\u6539\u8fdb：\u5207\u5272\u65f6\u88c1\u526a\u6bcflướiĐếnĐíchTỷ lệ khung hình，\u9632\u6b62\u56e0\u5927\u56fe\u5bbd\u9ad8\u6bd4\u4e0d\u7cbe\u786e\u5bfc\u81f4củathay đổi\u5f62
    const sliceGridImage = async (
      gridImageUrl: string, 
      actualCount: number, 
      cols: number, 
      rows: number,
      targetAspect: '16:9' | '9:16'
    ): Promise<string[]> => {
      const targetAspectW = targetAspect === '16:9' ? 16 : 9;
      const targetAspectH = targetAspect === '16:9' ? 9 : 16;
      const targetRatio = targetAspectW / targetAspectH;
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // Tính toán\u6bcflưới\u5728\u539f\u56fetrongcủaQuận\u57df
          const rawTileW = Math.floor(img.width / cols);
          const rawTileH = Math.floor(img.height / rows);
          const rawRatio = rawTileW / rawTileH;
          
          // Tính toán\u6700\u7ec8Đầu rcủa một\u683c\u5b50Kích thước（\u4fdd\u8bc1ĐíchTỷ lệ khung hình）
          let outputW: number, outputH: number;
          let cropX = 0, cropY = 0, cropW = rawTileW, cropH = rawTileH;
          
          if (Math.abs(rawRatio - targetRatio) < 0.01) {
            // Tỷ lệ khung hình gần bằngĐích，Sử dụng trực tiếp
            outputW = rawTileW;
            outputH = rawTileH;
          } else if (rawRatio > targetRatio) {
            // Lưới của ảnh gốc quá rộng，Cần cắt chiều rộng
            cropW = Math.floor(rawTileH * targetRatio);
            cropX = Math.floor((rawTileW - cropW) / 2); // Căn giữaCrop
            outputW = cropW;
            outputH = rawTileH;
          } else {
            // Lưới của ảnh gốc quá cao，Yêu cầu cắt chiều cao
            cropH = Math.floor(rawTileW / targetRatio);
            cropY = Math.floor((rawTileH - cropH) / 2); // Căn giữaCrop
            outputW = rawTileW;
            outputH = cropH;
          }
          
          // \u5b89\u5168\u8fb9\u8ddd：\u5411bên trong\u6536\u7f29 0.5%，\u9632\u6b62\u5207Đến\u53ef\u80fdcủa\u5206\u5272\u7ebfhoặc\u8fb9\u7f18\u7455\u75b5
          const safetyMargin = 0.005; 
          const marginW = Math.floor(cropW * safetyMargin);
          const marginH = Math.floor(cropH * safetyMargin);
          
          // bảo hiểm kép：lực lượngĐầu raKích thước tuân thủ nghiêm ngặtĐíchTỷ lệ khung hình
          // \u907f\u514d\u56e0 Math.floor \u5bfc\u81f4của\u5fae\u5c0fTỷ lệ\u504f\u5dee
          if (targetAspect === '16:9') {
            outputH = Math.round(outputW * 9 / 16);
          } else {
            // 9:16
            outputW = Math.round(outputH * 9 / 16);
          }
          
          console.log(`[MergedGen] Slice: raw ${rawTileW}×${rawTileH} → crop ${cropW}×${cropH} (margin ${marginW}px) → output ${outputW}×${outputH} (Strict ${targetAspect})`);
          
          const results: string[] = [];
          
          // \u53ea\u5207\u5272\u5b9e\u9645\u9700\u8981của\u683c\u5b50\u6570\u91cf，bỏ quaphần giữ chỗ trống
          for (let i = 0; i < actualCount; i++) {
            const tileRow = Math.floor(i / cols);
            const tileCol = i % cols;
            const canvas = document.createElement('canvas');
            canvas.width = outputW;
            canvas.height = outputH;
            const ctx = canvas.getContext('2d')!;
            
            // từ\u539f\u56fetrong\u88c1\u526a\u6307\u5b9aQuận\u57df，\u5e76Áp dụký quỹ ngsafe
            const srcX = tileCol * rawTileW + cropX + marginW;
            const srcY = tileRow * rawTileH + cropY + marginH;
            const srcW = cropW - (marginW * 2);
            const srcH = cropH - (marginH * 2);
            
            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);
            results.push(canvas.toDataURL('image/png'));
          }
          resolve(results);
        };
        img.onerror = (e) => reject(new Error('\u52a0\u8f7dchíncung điện\u683cHình ảnhThất bại'));
        img.src = gridImageUrl;
      });
    };

    // Tạochíncung điện\u683cHình ảnh\u5e76\u5207\u5272（Hỗ trợ\u6df7\u5408khung hình đầu tiên+\u5c3e\u5e27Nhiệm vụ）
    const generateGridAndSlice = async (
      pageTasks: GridTask[],
      refs: string[]
    ): Promise<string[]> => {
      const actualCount = pageTasks.length;
      // sử dụng\u65b0củaBố cụcTính toánchức năng (lực lượng N x N)
      const { cols, rows, paddedCount } = calculateGridLayout(actualCount);
      const emptySlots = paddedCount - actualCount;
      
      // \u5728 N x N Bố cục\u4e0b，\u6574\u56fe\u5bbd\u9ad8\u6bd4\u76f4\u63a5Đợi đã\u4e8eĐíchTỷ lệ khung hình
      const gridAspect = aspect;
      
      console.log(`[MergedGen] Grid: ${actualCount} scenes → ${paddedCount} cells (${rows}×${cols}), ${emptySlots} empty slots, grid aspect: ${gridAspect}`);
      
      // Xây dựng phiên bản nâng cao của Lời nhắc (Tài liệu tham khảoNgười dùng\u63d0\u4f9bcủacó cấu trúc Prompt)
      const gridPromptParts: string[] = [];
      
      // 1. Khối lệnh lõi (Instruction Block) — Phong cách\u5728\u6b64\u5904\u524d\u7f6e，\u786e\u4fddtình hình chung\u751f\u6548
      gridPromptParts.push('<instruction>');
      gridPromptParts.push(`Generate a clean ${rows}x${cols} storyboard grid with exactly ${paddedCount} equal-sized panels.`);
      gridPromptParts.push(`Overall Image Aspect Ratio: ${aspect}.`);
      
      // Chỉ định rõ ràng tỷ lệ khung hình của một lưới riêng lẻ，Ngăn chặn sự nhầm lẫn của AI
      const panelAspect = aspect === '16:9' ? '16:9 (horizontal landscape)' : '9:16 (vertical portrait)';
      gridPromptParts.push(`Each individual panel must have a ${panelAspect} aspect ratio.`);
      
      // Global VisionPhong cách（thêm vào khu vực chỉ huy，Trọng lượng cao nhất）
      if (fullStylePrompt) {
        gridPromptParts.push(`MANDATORY Visual Style for ALL panels: ${fullStylePrompt}`);
      }
      
      gridPromptParts.push('Structure: No borders between panels, no text, no watermarks, no speech bubbles.');
      gridPromptParts.push('Consistency: Maintain consistent character appearance, lighting, color grading, and visual style across ALL panels.');
      gridPromptParts.push('</instruction>');
      
      // 2. Bố cục Mô tả (Layout)
      gridPromptParts.push(`Layout: ${rows} rows, ${cols} columns, reading order left-to-right, top-to-bottom.`);
      
      // 3. Nội dung của mỗi lưới Mô tả（\u6839\u636eNhiệm vụLoại\u9009\u62e9khung hình đầu tiênhoặc\u5c3e\u5e27prompt）
      pageTasks.forEach((task, idx) => {
        const s = task.scene;
        const row = Math.floor(idx / cols) + 1;
        const col = (idx % cols) + 1;
        let desc = '';
        if (task.type === 'end') {
          desc = s.endFramePromptZh?.trim() || s.endFramePrompt?.trim() || (s.imagePromptZh || s.imagePrompt || '') + ' end state';
        } else {
          desc = s.imagePromptZh?.trim() || s.imagePrompt?.trim() || s.videoPromptZh?.trim() || s.videoPrompt?.trim() || `scene ${idx + 1}`;
        }
        
        // nhân vật\u6570\u91cfkhoảng\u675f
        const charCount = s.characterIds?.length || 0;
        const charConstraint = charCount === 0 
          ? '(no people)' 
          : charCount === 1 
            ? '(1 person)' 
            : `(${charCount} people)`;
        
        // \u6807\u8bb0\u662fkhung hình đầu tiên\u8fd8\u662f\u5c3e\u5e27
        const frameLabel = task.type === 'end' ? '[END FRAME]' : '[FIRST FRAME]';
        // Bao gồm trong mỗi lướiPhong cách neo，\u9632\u6b62\u591a\u9762\u677f\u65f6Mô hình\u9057\u5fd8tình hình chungPhong cách
        const styleAnchor = fullStylePrompt ? ` [same style]` : '';
        gridPromptParts.push(`Panel [row ${row}, col ${col}] ${frameLabel} ${charConstraint}: ${desc}${styleAnchor}`);
      });
      
      // 4. phần giữ chỗ trốngMô tả
      for (let i = actualCount; i < paddedCount; i++) {
        const row = Math.floor(i / cols) + 1;
        const col = (i % cols) + 1;
        gridPromptParts.push(`Panel [row ${row}, col ${col}]: empty placeholder, solid gray background`);
      }
      
      // 5. tình hình chungPhong cách（\u5c3e\u90e8Một lần nữalần\u5f3a\u8c03，Tấn công trực diện\u786e\u4fddPhong cáchmột\u81f4\u6027）
      if (fullStylePrompt) {
        gridPromptParts.push(`IMPORTANT - Apply this EXACT style uniformly to every panel: ${fullStylePrompt}`);
      }
      
      // 6. Lời nhắc tiêu cực (Negative Constraints) — \u5408\u5e76Phong cách\u4e13\u5c5e\u8d1f\u9762Gợi ý
      const baseNegative = 'text, watermark, split screen borders, speech bubbles, blur, distortion, bad anatomy';
      const styleNeg = fullStyleNegative ? `, ${fullStyleNegative}` : '';
      gridPromptParts.push(`Negative constraints: ${baseNegative}${styleNeg}`);
      
      const gridPrompt = gridPromptParts.join('\n'); // sử dụngdòng mới\u7b26\u5206\u9694\u66f4\u6e05\u6670
      console.log('[MergedGen] Grid prompt:', gridPrompt.substring(0, 200) + '...');
      
      // \u6807\u8bb0Tất cảNhiệm vụ\u5bf9\u5e94củaPhân cảnhchoTạotrong
      pageTasks.forEach(task => {
        if (task.type === 'end') {
          updateSplitSceneEndFrameStatus(task.scene.id, { endFrameStatus: 'generating', endFrameProgress: 10 });
        } else {
          updateSplitSceneImageStatus(task.scene.id, { imageStatus: 'generating', imageProgress: 10 });
        }
      });
      
      // \u6784\u5efaHình ảnh tham khảodanh sách
      const finalRefs = refs.slice(0, 14);
      
      // \u5904\u7406Hình ảnh tham khảocho API Có sẵnĐịnh dạng
      // API Hỗ trợ: 1) HTTP/HTTPS URL  2) Base64 Data URI (phải chứa data:image/xxx;base64, \u524d\u7f00)
      const processedRefs: string[] = [];
      for (const url of finalRefs) {
        if (!url) continue;
        // HTTP/HTTPS URL - Sử dụng trực tiếp
        if (url.startsWith('http://') || url.startsWith('https://')) {
          processedRefs.push(url);
        }
        // Base64 Data URI - \u5fc5\u987b\u662f\u5b8c\u6574Định dạng data:image/xxx;base64,...
        else if (url.startsWith('data:image/') && url.includes(';base64,')) {
          processedRefs.push(url);
        }
        // local-image:// \u9700\u8981đầu tiên\u8f6c\u6362cho base64
        else if (url.startsWith('local-image://')) {
          try {
            const base64 = await readImageAsBase64(url);
            if (base64 && base64.startsWith('data:image/') && base64.includes(';base64,')) {
              processedRefs.push(base64);
            }
          } catch (e) {
            console.warn('[MergedGen] Failed to read local image:', url);
          }
        }
      }
      console.log('[MergedGen] Processed refs:', processedRefs.length, 'valid from', finalRefs.length, 'total');
      // Gỡ lỗi：\u6253\u5370Hình ảnh tham khảoĐịnh dạng
      processedRefs.forEach((ref, i) => {
        const prefix = ref.substring(0, 50);
        console.log(`[MergedGen] Ref[${i}] format:`, prefix + '...');
      });
      
      // Phân tích kết quảphụ trợchức năng（sử dụng\u4e8e\u8f6e\u8be2\u9636\u6bb5）
      const normalizeUrl = (url: any): string | undefined => {
        if (!url) return undefined;
        if (Array.isArray(url)) return url[0] || undefined;
        if (typeof url === 'string') return url;
        return undefined;
      };
      
      // \u8c03sử dụng API Tạochíncung điện\u683cHình ảnh - sử dụng\u667a\u80fd\u8def\u7531（\u81ea\u52a8\u9009\u62e9 chat completions hoặc images/generations）
      console.log('[MergedGen] Calling API with', processedRefs.length, 'reference images, model:', model);
      const apiResult = await submitGridImageRequest({
        model,
        prompt: gridPrompt,
        apiKey,
        baseUrl: imageBaseUrl,
        aspectRatio: gridAspect,
        resolution: storyboardConfig.resolution || '2K',
        referenceImages: processedRefs.length > 0 ? processedRefs : undefined,
        keyManager,
      });
      
      let gridImageUrl = apiResult.imageUrl;
      let taskId = apiResult.taskId;
      console.log('[MergedGen] API result: gridImageUrl=', gridImageUrl?.substring(0, 50), 'taskId=', taskId);
      
      // Chẳng hạn như\u679c\u662f\u5f02\u6b65Nhiệm vụ，\u8f6e\u8be2
      if (!gridImageUrl && taskId) {
        console.log('[MergedGen] Polling task:', taskId);
        const pollInterval = 2000;
        const maxAttempts = 90; // 3 \u5206\u949f
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const progress = Math.min(10 + Math.floor((attempt / maxAttempts) * 80), 90);
          // \u6839\u636eNhiệm vụLoạiCập nhật\u5404\u81eaTiến độ
          pageTasks.forEach(task => {
            if (task.type === 'end') {
              updateSplitSceneEndFrameStatus(task.scene.id, { endFrameProgress: progress });
            } else {
              updateSplitSceneImageStatus(task.scene.id, { imageProgress: progress });
            }
          });
          
          const statusUrl = new URL(`${imageBaseUrl}/v1/tasks/${taskId}`);
          statusUrl.searchParams.set('_ts', Date.now().toString());
          
          const statusResp = await fetch(statusUrl.toString(), {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          
          if (!statusResp.ok) throw new Error(`Truy vấnNhiệm vụThất bại: ${statusResp.status}`);
          
          const statusData = await statusResp.json();
          console.log(`[MergedGen] Task ${taskId} poll #${attempt}:`, JSON.stringify(statusData, null, 2).substring(0, 500));
          
          const status = (statusData.status ?? statusData.data?.status ?? '').toString().toLowerCase();
          
          if (status === 'completed' || status === 'succeeded' || status === 'success') {
            // \u5c1d\u8bd5từkhác nhauĐường dẫn\u83b7\u53d6Hình ảnh URL
            const images = statusData.result?.images ?? statusData.data?.result?.images ?? statusData.images;
            if (images?.[0]) {
              gridImageUrl = normalizeUrl(images[0].url || images[0]);
            }
            gridImageUrl = gridImageUrl 
              || normalizeUrl(statusData.output_url) 
              || normalizeUrl(statusData.result_url)
              || normalizeUrl(statusData.url)
              || normalizeUrl(statusData.data?.url)
              || normalizeUrl(statusData.result?.url);
            console.log('[MergedGen] Task completed, gridImageUrl=', gridImageUrl?.substring(0, 80));
            break;
          }
          
          if (status === 'failed' || status === 'error') {
            const errMsg = statusData.error || statusData.message || statusData.data?.error || 'Hình ảnhTạoThất bại';
            throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
          }
          
          await new Promise(r => setTimeout(r, pollInterval));
        }
      }
      
      if (!gridImageUrl) {
        console.error('[MergedGen] không có\u6cd5\u83b7\u53d6Hình ảnh URL, apiResult:', apiResult);
        if (taskId) {
          throw new Error(`chíncung điện\u683cTạo\u8d85\u65f6（Nhiệm vụ ${taskId} \u5728 3 \u5206\u949fbên trong\u672aHoàn thành），API \u670d\u52a1\u53ef\u80fdtruyền thống\u5fd9，Vui lòng đợi Th.ử lại`);
        }
        throw new Error('\u672a\u83b7\u53d6Đếnchíncung điện\u683cHình ảnh URL，\u8bf7\u68c0\u67e5 API phản ứng');
      }
      
      console.log('[MergedGen] Grid image URL:', gridImageUrl.substring(0, 80));
      
      // Lưunguyên bảnchíncung điện\u683c\u5927\u56fe URL Đến sclass-store（\u4f9bVideoTạo tái sử dụng thời gian）
      const pageSceneIds = pageTasks.filter(t => t.type === 'first').map(t => t.scene.id);
      if (pageSceneIds.length > 0) {
        setLastGridImage(gridImageUrl, pageSceneIds);
        console.log('[MergedGen] Đã rồibộ nhớ đệmchíncung điện\u683c\u5927\u56fe URL，sceneIds:', pageSceneIds);
      }
      
      // \u5207\u5272chíncung điện\u683cHình ảnh（\u4f20\u5165Bố cụcTham sốvàĐíchTỷ lệ khung hình）
      const slicedImages = await sliceGridImage(gridImageUrl, actualCount, cols, rows, aspect);
      console.log('[MergedGen] Sliced into', slicedImages.length, 'images (from', paddedCount, 'grid cells, target aspect:', aspect, ')');
      
      // \u56de\u586bĐến\u5404Phân cảnh\u5e76\u81ea\u52a8LưuĐếnChất liệu\u5e93
      // \u540c\u65f6Tải lênH sau khi cắtình ảnhĐếnLưu trữ ảnh，\u907f\u514dVideoTạo\u65f6Một lần nữalầnTải lên
      const folderId = getImageFolderId();
      const imageHostConfigured = isImageHostConfigured();
      
      // \u56de\u586b：\u6839\u636eNhiệm vụLoại\u51b3\u5b9aCập nhậkhung hình đầu tiên\u8fd8\u662f\u5c3e\u5e27
      // đầu tiên\u6301\u4e45\u5316Đếnđịa phươngTệpHệ thống（local-image://），\u907f\u514d base64 \u88ab partialize \u6e05\u9664\u5bfc\u81f4Nhập\u540eHình ảnh\u4e22\u5931
      for (let i = 0; i < pageTasks.length; i++) {
        const task = pageTasks[i];
        const s = task.scene;
        const slicedImage = slicedImages[i];
        if (slicedImage) {
          // \u6301\u4e45\u5316Đến\u672c\u5730 + Lưu trữ ảnh（với\u5355\u56feTạomột\u81f4）
          const frameType = task.type === 'end' ? 'end' as const : 'first' as const;
          const persistResultLoop = await persistSceneImage(slicedImage, s.id, frameType);
          const httpUrl = persistResultLoop.httpUrl || undefined;
          const localPath = persistResultLoop.localPath;
          
          if (httpUrl) {
            console.log(`[MergedGen] Phân cảnh ${s.id + 1} ${task.type === 'end' ? '\u5c3e\u5e27' : 'khung hình đầu tiên'} Đã Tải lênĐếnLưu trữ ảnh:`, httpUrl.substring(0, 60));
          }
          
          if (task.type === 'end') {
            updateSplitSceneEndFrame(s.id, localPath, 'ai-generated', httpUrl || undefined);
            // \u81ea\u52a8Lưu\u5c3e\u5e27ĐếnChất liệu\u5e93
            addMediaFromUrl({
              url: localPath,
              name: `Phân cảnh ${s.id + 1} - \u5c3e\u5e27`,
              type: 'image',
              source: 'ai-image',
              folderId,
              projectId: mediaProjectId,
            });
          } else {
            // \u4f20\u9012 httpUrl，\u8fd9\u6837VideoTạo\u65f6\u53ef\u4ee5Sử dụng trực tiếp，\u4e0dsử dụngMột lần nữaTải lên
            updateSplitSceneImage(s.id, localPath, s.width, s.height, httpUrl);
            // \u81ea\u52a8Lưukhung hình đầu tiênĐếnChất liệu\u5e93
            addMediaFromUrl({
              url: localPath,
              name: `Phân cảnh ${s.id + 1} - khung hình đầu tiên`,
              type: 'image',
              source: 'ai-image',
              folderId,
              projectId: mediaProjectId,
            });
          }
        }
      }
      
      return slicedImages;
    };

    // phụ trợ：Đặt lạimột\u9875trongTất cảNhiệm vụTrạng tháicho failed
    const resetPageTasksToError = (pageTasks: GridTask[], errorMsg: string) => {
      for (const task of pageTasks) {
        if (task.type === 'end') {
          updateSplitSceneEndFrameStatus(task.scene.id, { endFrameStatus: 'failed', endFrameProgress: 0, endFrameError: errorMsg });
        } else {
          updateSplitSceneImageStatus(task.scene.id, { imageStatus: 'failed', imageProgress: 0, imageError: errorMsg });
        }
      }
    };

    // Không.một\u8f6e：\u9010\u9875\u5c1d\u8bd5，Thất bạtôi là\u9875\u9762Bản ghi\u4e0b\u6765tiếp tục\u4e0bmột\u9875
    const failedPages: { index: number; pageTasks: GridTask[]; refs: string[]; error: string }[] = [];
    let succeededCount = 0;

    for (let p = 0; p < taskPages.length; p++) {
      if (mergedAbortRef.current) {
        console.log('[MergedGen] Người dùngDừng\u5408\u5e76Tạo');
        toast.info('\u5408\u5e76TạoĐã rồiDừng');
        setIsMergedRunning(false);
        return;
      }
      
      const pageTasks = taskPages[p];
      const refs = collectRefsFromTasks(pageTasks);
      
      // Thống kêhiện tại\u9875củakhung hình đầu tiên/\u5c3e\u5e27\u6570\u91cf
      const pageFirstCount = pageTasks.filter(t => t.type === 'first').length;
      const pageEndCount = pageTasks.filter(t => t.type === 'end').length;
      const pageInfo = [pageFirstCount > 0 ? `${pageFirstCount}khung hình đầu tiên` : '', pageEndCount > 0 ? `${pageEndCount}\u5c3e\u5e27` : ''].filter(Boolean).join('+');
      
      console.log(`[MergedGen] Không. ${p + 1}/${taskPages.length} \u9875，${pageTasks.length} mộtNhiệm vụ（${pageInfo}），${refs.length} \u5f20Hình ảnh tham khảo`);
      
      try {
        await generateGridAndSlice(pageTasks, refs);
        succeededCount++;
        if (!mergedAbortRef.current) {
          toast.success(`Không. ${p + 1}/${taskPages.length} \u9875Hoàn thành（${pageInfo}）`);
        }
      } catch (e: any) {
        const errorMsg = e.message || String(e);
        console.error(`[MergedGen] Không. ${p + 1} \u9875Thất bại:`, errorMsg);
        // Đặt lại\u8be5\u9875Phân cảnhTrạng tháicho error，\u4e0d\u8ba9\u5b83\u4eec\u5361\u5728 'generating'
        resetPageTasksToError(pageTasks, errorMsg);
        failedPages.push({ index: p, pageTasks, refs, error: errorMsg });
        toast.warning(`Không. ${p + 1}/${taskPages.length} \u9875Thất bại，\u5c06tự độngThử lại：${errorMsg.substring(0, 60)}`);
        // tiếp tục\u4e0bmột\u9875，\u4e0dtrong\u65ad
      }
    }

    // Không.Hai\u8f6e：tự độngThử lạiThất bạtôi là\u9875\u9762（Độ trễ 5 giây\u540eThử lại，\u7ed9 API \u6062\u590dThời gian）
    if (failedPages.length > 0 && !mergedAbortRef.current) {
      console.log(`[MergedGen] ${failedPages.length} \u9875Thất bại，5 giây\u540etự độngThử lại...`);
      toast.info(`${failedPages.length} \u9875TạoThất bại，5 giây\u540etự độngThử lại...`);
      await new Promise(r => setTimeout(r, 5000));

      for (const fp of failedPages) {
        if (mergedAbortRef.current) break;

        const pageFirstCount = fp.pageTasks.filter(t => t.type === 'first').length;
        const pageEndCount = fp.pageTasks.filter(t => t.type === 'end').length;
        const pageInfo = [pageFirstCount > 0 ? `${pageFirstCount}khung hình đầu tiên` : '', pageEndCount > 0 ? `${pageEndCount}\u5c3e\u5e27` : ''].filter(Boolean).join('+');

        console.log(`[MergedGen] tự độngThử lạiKhông. ${fp.index + 1} \u9875（${pageInfo}）`);
        try {
          // \u91cd\u65b0Thu thậpHình ảnh tham khảo（\u53ef\u80fd\u5728\u5176\u4ed6\u9875Thành công\u540eCó\u65b0của\u56feCó sẵn）
          const freshRefs = collectRefsFromTasks(fp.pageTasks);
          await generateGridAndSlice(fp.pageTasks, freshRefs);
          succeededCount++;
          toast.success(`Không. ${fp.index + 1} \u9875Thử lạiThành công（${pageInfo}）`);
        } catch (retryErr: any) {
          const retryMsg = retryErr.message || String(retryErr);
          console.error(`[MergedGen] Không. ${fp.index + 1} \u9875Thử lại\u4ecd\u7136Thất bại:`, retryMsg);
          // Một lần nữalầnĐặt lạicho error Trạng thái
          resetPageTasksToError(fp.pageTasks, `Thử lạiThất bại: ${retryMsg}`);
          toast.error(`Không. ${fp.index + 1} \u9875Thử lạiThất bại: ${retryMsg.substring(0, 80)}`);
        }
      }
    }

    // \u6700\u7ec8\u6c47\u62a5
    const totalPages = taskPages.length;
    if (!mergedAbortRef.current) {
      if (succeededCount === totalPages) {
        toast.success('chíncung điện\u683c\u5408\u5e76TạoTất cảHoàn thành！');
      } else if (succeededCount > 0) {
        toast.warning(`\u5408\u5e76Tạomột phầnHoàn thành：${succeededCount}/${totalPages} \u9875Thành công，${totalPages - succeededCount} \u9875Thất bại`);
      } else {
        toast.error(`\u5408\u5e76TạoTất cảThất bại（${totalPages} \u9875），\u8bf7\u68c0\u67e5 API \u670d\u52a1\u540eThử lại`);
      }
    }
    setIsMergedRunning(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitScenes, storyboardConfig, getApiKey, updateSplitSceneImage, updateSplitSceneImageStatus, updateSplitSceneEndFrame, updateSplitSceneEndFrameStatus]);

  // \u590dsử dụng\u5355\u56feTạocủa API Đường dẫn，\u5c01\u88c5chophổ quátchức năng（Hỗ trợkhung hình đầu tiên/\u5c3e\u5e27）
  // \u5408\u5e76Tạo\u4e13sử dụng：sử dụng\u9884Tính toánTài liệu tham khảodanh sách；\u4e0dHạ cấpĐến\u5355\u56fe\u901a\u9053
  const generateImageForSceneMerged = async (
    sceneId: number,
    prompt: string,
    apiKey: string,
    aspect: '16:9'|'9:16',
    isEndFrame: boolean,
    refUrls: string[],
    strategy: 'cluster'|'minimal'|'none'
  ): Promise<{ finalBase64?: string; directUrl?: string } | void> => {
    if (isEndFrame) {
      updateSplitSceneEndFrameStatus(sceneId, { endFrameStatus: 'generating', endFrameProgress: 0, endFrameError: null });
    } else {
      updateSplitSceneImageStatus(sceneId, { imageStatus: 'generating', imageProgress: 0, imageError: null });
    }
    // sử dụng\u670d\u52a1\u6620\u5c04Cấu hình
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      throw new Error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      throw new Error('Vui lòng vào Cài đặt để cấu hình mô hình tạo ảnh');
    }
    const apiKeyToUse = apiKey || featureConfig.keyManager.getCurrentKey() || '';
    if (!apiKeyToUse) {
      throw new Error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
    }
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      throw new Error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
    }

    // Call image generation API with smart routing
    const mergedKeyManager = featureConfig.keyManager;
    const apiResult = await submitGridImageRequest({
      model,
      prompt,
      apiKey: apiKeyToUse,
      baseUrl: imageBaseUrl,
      aspectRatio: aspect,
      resolution: storyboardConfig.resolution || '2K',
      referenceImages: refUrls && refUrls.length > 0 ? refUrls.slice(0, 14) : undefined,
      keyManager: mergedKeyManager,
    });

    const normalizeUrlValue = (url: any): string | undefined => Array.isArray(url) ? (url[0] || undefined) : (typeof url === 'string' ? url : undefined);
    let directUrl = apiResult.imageUrl;
    let taskId: string | undefined = apiResult.taskId;

    if (!taskId && !directUrl) {
      // \u5bf9\u975e\u5e38\u89c4phản ứng：\u5c1d\u8bd5mộtlần"không cóTài liệu tham khảo"Thử lại（giữ\u5408\u5e76chế độ，\u4e0dHạ cấpĐến\u5355\u56fe\u901a\u9053）
      if (refUrls.length > 0 && strategy !== 'none') {
        const retryResult = await submitGridImageRequest({
          model,
          prompt,
          apiKey: apiKeyToUse,
          baseUrl: imageBaseUrl,
          aspectRatio: aspect,
          keyManager: mergedKeyManager,
        });
        directUrl = retryResult.imageUrl;
        taskId = retryResult.taskId;
      }
      if (!taskId && !directUrl) throw new Error('Invalid image task response');
    }

    if (!directUrl && taskId) {
      const pollInterval = 2000, maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const progress = Math.min(Math.floor((attempt / maxAttempts) * 100), 99);
        if (isEndFrame) updateSplitSceneEndFrameStatus(sceneId, { endFrameProgress: progress });
        else updateSplitSceneImageStatus(sceneId, { imageProgress: progress });
        const url = new URL(`${imageBaseUrl}/v1/tasks/${taskId}`);
        url.searchParams.set('_ts', Date.now().toString());
        const statusResp = await fetch(url.toString(), { method: 'GET', headers: { 'Authorization': `Bearer ${apiKeyToUse}`, 'Cache-Control': 'no-cache' } });
        if (!statusResp.ok) throw new Error(`Failed to check task status: ${statusResp.status}`);
        const statusData = await statusResp.json();
        const status = (statusData.status ?? statusData.data?.status ?? 'unknown').toString().toLowerCase();
        if (status === 'completed' || status === 'succeeded' || status === 'success') {
          const images = statusData.result?.images ?? statusData.data?.result?.images;
          if (images?.[0]) directUrl = normalizeUrlValue(images[0].url || images[0]);
          directUrl = directUrl || normalizeUrlValue(statusData.output_url) || normalizeUrlValue(statusData.result_url) || normalizeUrlValue(statusData.url);
          break;
        }
        if (status === 'failed' || status === 'error') throw new Error((statusData.error || statusData.message || 'image generation failed').toString());
        await new Promise(r => setTimeout(r, pollInterval));
      }
    }

    if (!directUrl) throw new Error('Nhiệm vụHoàn thành\u4f46\u6ca1CóHình ảnh URL');

    const frameType = isEndFrame ? 'end' as const : 'first' as const;
    const persistResult = await persistSceneImage(directUrl, sceneId, frameType);

    if (isEndFrame) {
      updateSplitSceneEndFrame(sceneId, persistResult.localPath, 'ai-generated', persistResult.httpUrl || directUrl);
    } else {
      const sceneObj = splitScenes.find(s => s.id === sceneId)!;
      updateSplitSceneImage(sceneId, persistResult.localPath, sceneObj.width, sceneObj.height, persistResult.httpUrl || directUrl);
    }
    return { finalBase64: persistResult.localPath, directUrl };
  };

  // Generate end frame image for a single scene using image API
  // Reuses the same API config as first frame generation
  const handleGenerateEndFrameImage = useCallback(async (sceneId: number) => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Must have end frame prompt
    const promptToUse = scene.endFramePromptZh?.trim() || scene.endFramePrompt?.trim() || '';
    if (!promptToUse) {
      toast.warning("\u8bf7đầu tiên\u586b\u5199Lời nhắc khung cuối cùng\u540eMột lần nữaTạo");
      return;
    }

    // sử dụng\u670d\u52a1\u6620\u5c04Cấu hình
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng vào Cài đặt để cấu hình mô hình tạo ảnh');
      return;
    }
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      toast.error('Vui lòng vào Cài đặt để cấu hình ánh xạ dịch vụ tạo ảnh');
      return;
    }
    
    console.log('[EndFrame] Using config:', { platform, model, imageBaseUrl });

    setIsGenerating(true);

    try {
      // Update end frame status
      updateSplitSceneEndFrameStatus(sceneId, {
        endFrameStatus: 'generating',
        endFrameProgress: 0,
        endFrameError: null,
      });

      // Build enhanced prompt with full style prompt
      let enhancedPrompt = promptToUse;
      const endFrameStylePrompt = getStylePrompt(currentStyleId);
      if (endFrameStylePrompt) {
        enhancedPrompt = `${promptToUse}. Style: ${endFrameStylePrompt}`;
      }

      // Collect reference images - include scene background and first frame for consistency
      const referenceImages: string[] = [];
      
      // 1. \u5c3e\u5e27CảnhNềnHình ảnh tham khảo（\u53ef\u80fdvớikhung hình đầu tiên\u4e0d\u540c，Chẳng hạn như“Trương MinhtừSofađi\u5411bàn ăn”）
      if (scene.endFrameSceneReferenceImage) {
        referenceImages.push(scene.endFrameSceneReferenceImage);
        console.log('[SplitScenes] Using end frame scene background reference');
      } else if (scene.sceneReferenceImage) {
        // \u56de\u9000Đếnkhung hình đầu tiênCảnhNền
        referenceImages.push(scene.sceneReferenceImage);
        console.log('[SplitScenes] Using first frame scene background for end frame');
      }
      
      // 2. khung hình đầu tiênHình ảnh\u4f5cchoPhong cáchmột\u81f4\u6027Tài liệu tham khảo
      if (scene.imageDataUrl) {
        referenceImages.push(scene.imageDataUrl);
      }
      
      // 3. Nhân vậsự phản bội\u56fe
      if (scene.characterIds && scene.characterIds.length > 0) {
        const sceneCharRefs = getCharacterReferenceImages(scene.characterIds, scene.characterVariationMap);
        referenceImages.push(...sceneCharRefs);
      }

      console.log('[SplitScenes] Generating end frame:', {
        sceneId,
        prompt: enhancedPrompt.substring(0, 100),
        referenceCount: referenceImages.length,
      });

      // Process reference images for API
      const processedRefs: string[] = [];
      for (const url of referenceImages.slice(0, 14)) {
        if (!url) continue;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          processedRefs.push(url);
        } else if (url.startsWith('data:image/') && url.includes(';base64,')) {
          processedRefs.push(url);
        } else if (url.startsWith('local-image://')) {
          try {
            const base64 = await readImageAsBase64(url);
            if (base64) processedRefs.push(base64);
          } catch (e) {
            console.warn('[SplitScenes] Failed to read local image:', url, e);
          }
        }
      }

      // Call image generation API with smart routing
      const apiResult = await submitGridImageRequest({
        model,
        prompt: enhancedPrompt,
        apiKey,
        baseUrl: imageBaseUrl,
        aspectRatio: storyboardConfig.aspectRatio || '9:16',
        resolution: storyboardConfig.resolution || '2K',
        referenceImages: processedRefs.length > 0 ? processedRefs : undefined,
        keyManager,
      });

      // Helper to normalize URL (handle array format) - used in poll responses
      const normalizeUrlValue = (url: any): string | undefined => {
        if (!url) return undefined;
        if (Array.isArray(url)) return url[0] || undefined;
        if (typeof url === 'string') return url;
        return undefined;
      };

      // Direct URL result
      if (apiResult.imageUrl) {
        const persistResult = await persistSceneImage(apiResult.imageUrl, sceneId, 'end');
        updateSplitSceneEndFrame(sceneId, persistResult.localPath, 'ai-generated', persistResult.httpUrl || apiResult.imageUrl);
        // \u81ea\u52a8Lưu\u5c3e\u5e27ĐếnChất liệu\u5e93
        const folderId = getImageFolderId();
        addMediaFromUrl({
          url: persistResult.localPath,
          name: `Phân cảnh ${sceneId + 1} - \u5c3e\u5e27`,
          type: 'image',
          source: 'ai-image',
          folderId,
          projectId: mediaProjectId,
        });
        toast.success(`Phân cảnh ${sceneId + 1} \u5c3e\u5e27TạoHoàn thành，Đã LưuĐếnChất liệu\u5e93`);
        setIsGenerating(false);
        return;
      }

      // Async task - poll for completion
      let taskId: string | undefined = apiResult.taskId;
      
      if (taskId) {
        const pollInterval = 2000;
        const maxAttempts = 60;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const progress = Math.min(Math.floor((attempt / maxAttempts) * 100), 99);
          updateSplitSceneEndFrameStatus(sceneId, { endFrameProgress: progress });

          const url = new URL(`${imageBaseUrl}/v1/tasks/${taskId}`);
          url.searchParams.set('_ts', Date.now().toString());

          const statusResponse = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Cache-Control': 'no-cache',
            },
          });

          if (!statusResponse.ok) {
            if (statusResponse.status === 404) throw new Error('Nhiệm vụ\u4e0d\u5b58\u5728');
            throw new Error(`Failed to check task status: ${statusResponse.status}`);
          }

          const statusData = await statusResponse.json();
          const status = (statusData.status ?? statusData.data?.status ?? 'unknown').toString().toLowerCase();

          if (status === 'completed' || status === 'succeeded' || status === 'success') {
            const images = statusData.result?.images ?? statusData.data?.result?.images;
            let imageUrl: string | undefined;
            if (images?.[0]) {
              const rawUrl = images[0].url || images[0];
              imageUrl = normalizeUrlValue(rawUrl);
            }
            imageUrl = imageUrl || normalizeUrlValue(statusData.output_url) || normalizeUrlValue(statusData.url);

            if (!imageUrl) throw new Error('Nhiệm vụHoàn thành\u4f46\u6ca1CóHình ảnh URL');
            
            // \u6301\u4e45\u5316Đến\u672c\u5730 + Lưu trữ ảnh
            const persistResult = await persistSceneImage(imageUrl, sceneId, 'end');
            updateSplitSceneEndFrame(sceneId, persistResult.localPath, 'ai-generated', persistResult.httpUrl || imageUrl);
            // \u81ea\u52a8Lưu\u5c3e\u5e27ĐếnChất liệu\u5e93
            const folderId = getImageFolderId();
            addMediaFromUrl({
              url: persistResult.localPath,
              name: `Phân cảnh ${sceneId + 1} - \u5c3e\u5e27`,
              type: 'image',
              source: 'ai-image',
              folderId,
              projectId: mediaProjectId,
            });
            toast.success(`Phân cảnh ${sceneId + 1} \u5c3e\u5e27TạoHoàn thành，Đã LưuĐếnChất liệu\u5e93`);
            setIsGenerating(false);
            return;
          }

          if (status === 'failed' || status === 'error') {
            const errorMsg = statusData.error || statusData.message || '\u5c3e\u5e27TạoThất bại';
            throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
          }

          await new Promise(r => setTimeout(r, pollInterval));
        }
        throw new Error('\u5c3e\u5e27Tạo\u8d85\u65f6');
      }

      throw new Error('Invalid API response');
    } catch (error) {
      const err = error as Error;
      console.error(`[SplitScenes] Scene ${sceneId} end frame generation failed:`, err);
      updateSplitSceneEndFrameStatus(sceneId, {
        endFrameStatus: 'failed',
        endFrameProgress: 0,
        endFrameError: err.message,
      });
      toast.error(`Phân cảnh ${sceneId + 1} \u5c3e\u5e27TạoThất bại: ${err.message}`);
    }

    setIsGenerating(false);
  }, [splitScenes, storyboardConfig, getApiKey, updateSplitSceneEndFrame, updateSplitSceneEndFrameStatus, getCharacterReferenceImages]);

  // Save to media library (image or video) - uses system category folders
  const handleSaveToLibrary = useCallback(async (scene: SplitScene, type: 'image' | 'video') => {
    try {
      if (type === 'video') {
        if (!scene.videoUrl) {
          toast.error("\u6ca1Có\u53efLưucủaVideo");
          return;
        }
        const folderId = getVideoFolderId();
        addMediaFromUrl({
          url: scene.videoUrl,
          name: `Phân cảnh ${scene.id + 1} - AIVideo`,
          type: 'video',
          source: 'ai-video',
          thumbnailUrl: scene.imageDataUrl,
          duration: scene.duration || 5,
          folderId,
          projectId: mediaProjectId,
        });
        toast.success(`Phân cảnh ${scene.id + 1} VideoĐã LưuĐếnChất liệu\u5e93`);
      } else {
        if (!scene.imageDataUrl) {
          toast.error("\u6ca1Có\u53efLưuHình ảnh");
          return;
        }
        const folderId = getImageFolderId();
        addMediaFromUrl({
          url: scene.imageDataUrl,
          name: `Phân cảnh ${scene.id + 1} - AIHình ảnh`,
          type: 'image',
          source: 'ai-image',
          folderId,
          projectId: mediaProjectId,
        });
        toast.success(`Phân cảnh ${scene.id + 1} Hình ảnhĐã LưuĐếnChất liệu\u5e93`);
      }
    } catch (error) {
      const err = error as Error;
      toast.error(`LưuThất bại: ${err.message}`);
    }
  }, [addMediaFromUrl, getImageFolderId, getVideoFolderId, mediaProjectId]);

  // Show empty state
  if (storyboardStatus !== 'editing' || splitScenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">\u6682không có\u5207\u5272củaPhân cảnh</p>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="mt-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* \u9876\u90e8 Tab \u5207\u6362 */}
      <div className="border-b -mx-4 px-4 -mt-4 pt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "editing" | "trailer")} className="w-full">
          <TabsList className="w-full justify-start h-9 rounded-none bg-transparent border-b-0 p-0">
            <TabsTrigger 
              value="editing" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-9 px-4"
            >
              <Film className="h-3 w-3 mr-1" />
              Phân cảnhChỉnh sửa
            </TabsTrigger>
            <TabsTrigger 
              value="trailer" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-9 px-4"
            >
              <Clapperboard className="h-3 w-3 mr-1" />
              xe kéo {trailerScenes.length > 0 ? `(${trailerScenes.length})` : ''}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* xe kéo Tab bên trong\u5bb9 - \u5b8c\u5168\u590dsử dụngPhân cảnhChỉnh sửcủa mộtchức năng */}
      {activeTab === "trailer" && (
        <>
          {trailerScenes.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              <Clapperboard className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>xe kéochức năng</p>
              <p className="text-xs mt-1">\u8bf7\u5728\u5de6\u4fa7「Kịch bản」\u9762\u677ftrongcủa「xe kéo」nhãn\u9875TạoTrailer</p>
              <p className="text-xs mt-1">chọncủaPhân cảnh\u5c06\u5728\u6b64\u663e\u793a\u5e76\u53ef\u8fdbđược rồiHình ảnh/VideoTạo</p>
            </div>
          ) : (
            <>
              {/* Header - vớiPhân cảnhChỉnh sửamột\u81f4 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">xe kéoPhân cảnh</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {trailerScenes.length} Phân cảnh
                  </span>
                  <span className="text-xs text-muted-foreground">
                    \u9884\u8ba1 {trailerScenes.reduce((sum, s) => sum + (s.duration || 5), 0)} giây
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* một\u952e\u6e05\u7a7axe kéoPhân cảnh */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        disabled={isGenerating}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        \u6e05\u7a7aPhân cảnh
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận\u6e05\u7a7axe kéoPhân cảnh</AlertDialogTitle>
                        <AlertDialogDescription>
                          \u8fd9\u5c06XoáTất cả {trailerScenes.length} mộtxe kéoPhân cảnh（bao gồmĐã Tạo Hình ảnhvàVideo）。\u6b64Thao tác\u4e0d\u53ef\u64a4\u9500。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Huỷ</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            // XoáTất cảxe kéoPhân cảnh
                            trailerScenes.forEach(scene => {
                              deleteSplitScene(scene.id);
                            });
                            // \u6e05\u7a7axe kéoCấu hình
                            clearTrailer();
                            toast.success(`Đã rồi\u6e05\u7a7a ${trailerScenes.length} mộtxe kéoPhân cảnh`);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Xác nhận\u6e05\u7a7a
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Global style and aspect ratio config - vớiPhân cảnhChỉnh sửamột\u81f4 */}
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Tầm nhìn Phong cách:</span>
                  <StylePicker
                    value={currentStyleId}
                    onChange={handleStyleChange}
                    disabled={isGenerating}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">bức tranhTỷ lệ:</span>
                  <div className="flex rounded-md border overflow-hidden">
                    <button
                      onClick={() => handleAspectRatioChange('16:9')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                        storyboardConfig.aspectRatio === '16:9'
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      )}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      \u6a2a\u5c4f
                    </button>
                    <button
                      onClick={() => handleAspectRatioChange('9:16')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l",
                        storyboardConfig.aspectRatio === '9:16'
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      )}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      \u7ad6\u5c4f
                    </button>
                  </div>
                </div>
                {/* Image Resolution Selector */}
                <Select
                  value={storyboardConfig.resolution || '2K'}
                  onValueChange={(v: '1K' | '2K' | '4K') => {
                    setStoryboardConfig({ resolution: v });
                    toast.success(`Hình ảnhĐộ phân giảiĐã rồi\u5207\u6362cho ${v}`);
                  }}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1K" className="text-xs">Tiêu chuẩn (1K)</SelectItem>
                    <SelectItem value="2K" className="text-xs">\u9ad8\u6e05 (2K)</SelectItem>
                    <SelectItem value="4K" className="text-xs">\u8d85\u6e05 (4K)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Video Resolution Selector */}
                <Select
                  value={storyboardConfig.videoResolution || '480p'}
                  onValueChange={(v: '480p' | '720p' | '1080p') => {
                    setStoryboardConfig({ videoResolution: v });
                    toast.success(`VideoĐộ phân giảiĐã rồi\u5207\u6362cho ${v}`);
                  }}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p" className="text-xs">Tiêu chuẩn (480P)</SelectItem>
                    <SelectItem value="720p" className="text-xs">\u9ad8\u6e05 (720P)</SelectItem>
                    <SelectItem value="1080p" className="text-xs">\u9ad8\u54c1\u8d28 (1080P)</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1 text-xs text-muted-foreground/70 truncate">
                  {storyboardConfig.styleTokens?.slice(0, 2).join(', ')}...
                </div>
              </div>

              {/* Scene list - \u5b8c\u5168\u590dsử dụngPhân cảnhChỉnh sửcủa một SceneCard */}
              <div className="flex flex-col gap-3">
                {trailerScenes.map((scene) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    onUpdateImagePrompt={(id, prompt, promptZh) => updateSplitSceneImagePrompt(id, prompt, promptZh)}
                    onUpdateVideoPrompt={(id, prompt, promptZh) => updateSplitSceneVideoPrompt(id, prompt, promptZh)}
                    onUpdateEndFramePrompt={(id, prompt, promptZh) => updateSplitSceneEndFramePrompt(id, prompt, promptZh)}
                    onUpdateNeedsEndFrame={(id, needsEndFrame) => updateSplitSceneNeedsEndFrame(id, needsEndFrame)}
                    onUpdateEndFrame={handleUpdateEndFrame}
                    onUpdateCharacters={handleUpdateCharacters}
                    onUpdateCharacterVariationMap={handleUpdateCharacterVariationMap}
                    onUpdateEmotions={handleUpdateEmotions}
                    onUpdateShotSize={handleUpdateShotSize}
                    onUpdateDuration={handleUpdateDuration}
                    onUpdateAmbientSound={handleUpdateAmbientSound}
                    onUpdateSoundEffects={handleUpdateSoundEffects}
            onUpdateSceneReference={(id, sceneLibId, viewpointId, refImage, subViewId) => updateSplitSceneReference(id, sceneLibId, viewpointId, refImage, subViewId)}
            onUpdateEndFrameSceneReference={(id, sceneLibId, viewpointId, refImage, subViewId) => updateSplitSceneEndFrameReference(id, sceneLibId, viewpointId, refImage, subViewId)}
            onDelete={handleDeleteScene}
            onSaveToLibrary={handleSaveToLibrary}
            onGenerateImage={handleGenerateSingleImage}
            onGenerateVideo={handleGenerateSingleVideo}
            onGenerateEndFrame={handleGenerateEndFrameImage}
            onRemoveImage={handleRemoveImage}
            onUploadImage={handleUploadImage}
            onUpdateField={(id, field, value) => updateSplitSceneField(id, field, value)}
            onAngleSwitch={handleAngleSwitchClick}
            onQuadGrid={handleQuadGridClick}
            onExtractVideoLastFrame={handleExtractVideoLastFrame}
            onStopImageGeneration={handleStopImageGeneration}
            onStopVideoGeneration={handleStopVideoGeneration}
            onStopEndFrameGeneration={handleStopEndFrameGeneration}
            isExtractingFrame={isExtractingFrame}
            isAngleSwitching={isAngleSwitching}
            isQuadGridGenerating={isQuadGridGenerating}
            isGeneratingAny={isGenerating}
          />
                ))}
              </div>

              {/* Action buttons - vớiPhân cảnhChỉnh sửamột\u81f4 */}
              <div className="flex gap-2 pt-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => {
                          // \u4ec5choxe kéoPhân cảnhTạo video
                          toast.info(`Bắt đầuTạo ${trailerScenes.length} mộtXem trướcPhimVideo...`);
                          // Lặp lại\u8c03sử dụng\u5355mộtTạo
                          trailerScenes.forEach(scene => {
                            if (scene.imageDataUrl && scene.videoStatus !== 'completed') {
                              handleGenerateSingleVideo(scene.id);
                            }
                          });
                        }}
                        disabled={isGenerating || trailerScenes.length === 0}
                        className="flex-1"
                        size="lg"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Tạotrong...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            TạoXem trướcPhimVideo ({trailerScenes.length})
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>choxe kéoPhân cảnhTạo video</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Tips */}
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                <p>💡 xe kéoPhân cảnhvớiChúa ơiPhân cảnhtổng cộng\u4eab\u6570\u636e，Sửa\u4f1a\u540c\u6b65。\u70b9\u51fbMỗi tiến sĩân cảnh\u4e0b\u65b9của\u6587từQuận\u57dfCán Chỉnh sửaPrompt。</p>
              </div>
            </>
          )}
        </>
      )}

      {/* Phân cảnhChỉnh sửa Tab bên trong\u5bb9 */}
      {activeTab === "editing" && (
      <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Phân cảnhChỉnh sửa</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {splitScenes.length} Phân cảnh
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="text"
            size="sm"
            onClick={handleBack}
            className="h-7 px-2 text-xs"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            \u91cd\u65b0Tạo
          </Button>
        </div>
      </div>

      {/* Row 1: Cơ bảnCấu hình -Visual Phong cách / bức tranhTỷ lệ / Tạo\u65b9\u5f0f */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/30 border">
        {/* Visual Style Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Tầm nhìn Phong cách:</span>
          <StylePicker
            value={currentStyleId}
            onChange={handleStyleChange}
            disabled={isGenerating}
          />
        </div>

        {/* Cinematography Profile Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Nhiếp ảnh Phong cách:</span>
          <CinematographyProfilePicker
            value={currentCinProfileId}
            onChange={handleCinProfileChange}
            disabled={isGenerating}
            styleId={currentStyleId}
          />
        </div>

        {/* Aspect Ratio Selector — lớp S 6 \u79cd\u753b\u5e45\u6bd4 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">\u753b\u5e45\u6bd4:</span>
          <Select
            value={storyboardConfig.aspectRatio || '16:9'}
            onValueChange={(v: string) => handleAspectRatioChange(v as SClassAspectRatio)}
          >
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCLASS_ASPECT_RATIOS.map(ar => (
                <SelectItem key={ar.value} value={ar.value} className="text-xs">
                  {ar.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Image Resolution Selector */}
        <Select
          value={storyboardConfig.resolution || '2K'}
          onValueChange={(v: '1K' | '2K' | '4K') => {
            setStoryboardConfig({ resolution: v });
            toast.success(`Hình ảnhĐộ phân giảiĐã rồi\u5207\u6362cho ${v}`);
          }}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1K" className="text-xs">Tiêu chuẩn (1K)</SelectItem>
            <SelectItem value="2K" className="text-xs">\u9ad8\u6e05 (2K)</SelectItem>
            <SelectItem value="4K" className="text-xs">\u8d85\u6e05 (4K)</SelectItem>
          </SelectContent>
        </Select>

        {/* Video Resolution Selector */}
        <Select
          value={storyboardConfig.videoResolution || '480p'}
          onValueChange={(v: '480p' | '720p' | '1080p') => {
            setStoryboardConfig({ videoResolution: v });
            toast.success(`VideoĐộ phân giảiĐã rồi\u5207\u6362cho ${v}`);
          }}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="480p" className="text-xs">Tiêu chuẩn (480P)</SelectItem>
            <SelectItem value="720p" className="text-xs">\u9ad8\u6e05 (720P)</SelectItem>
            <SelectItem value="1080p" className="text-xs">\u9ad8\u54c1\u8d28 (1080P)</SelectItem>
          </SelectContent>
        </Select>

        {/* Image generation mode toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Hình ảnhTạo\u65b9\u5f0f:</span>
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setImageGenMode('single')}
              className={cn(
                "px-3 py-1.5 text-xs",
                imageGenMode === 'single' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              )}
            >\u5355\u56feTạo</button>
            <button
              onClick={() => setImageGenMode('merged')}
              className={cn(
                "px-3 py-1.5 text-xs border-l",
                imageGenMode === 'merged' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              )}
            >\u5408\u5e76Tạo</button>
          </div>
        </div>

        {/* Current style tokens hint */}
        <div className="flex-1 text-xs text-muted-foreground/70 truncate">
          {storyboardConfig.styleTokens?.slice(0, 2).join(', ')}...
        </div>
      </div>

      {/* Row 1.5: Seedance 2.0 Âm thanh/\u8fd0\u955cGợi ý（\u5b9e\u9645\u63a7\u5236\u590dsử dụngMỗi tiến sĩân cảnh per-scene Âm thanh\u5f00\u5173） */}
      <div className="flex flex-wrap items-center gap-3 p-2 rounded-lg bg-muted/20 border">
        <Music className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Âm thanh/\u8fd0\u955c: \u590dsử dụngMỗi tiến sĩân cảnhđộc lập\u5f00\u5173（đối thoại / Hiệu ứng âm thanh / âm thanh xung quanh / \u8fd0\u955c）\u81ea\u52a8\u805a\u5408</span>
        <span className="text-xs text-muted-foreground/60">Thời lượng\u4e0a\u9650 15s · Seedance 2.0</span>
      </div>

      {/* Row 2: \u5408\u5e76TạoTùy chọn（\u4ec5\u5728\u5408\u5e76chế độ\u4e0b\u663e\u793a） */}
      {imageGenMode === 'merged' && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          {/* \u9996/\u5c3e\u5e27chế độ */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">\u9996/\u5c3e\u5e27:</span>
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => setFrameMode('first')}
                className={cn(
                  "px-3 py-1.5 text-xs",
                  frameMode === 'first' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                )}
              >\u4ec5khung hình đầu tiên</button>
              <button
                onClick={() => setFrameMode('last')}
                className={cn(
                  "px-3 py-1.5 text-xs border-l",
                  frameMode === 'last' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                )}
              >\u4ec5\u5c3e\u5e27</button>
              <button
                onClick={() => setFrameMode('both')}
                className={cn(
                  "px-3 py-1.5 text-xs border-l",
                  frameMode === 'both' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                )}
              >\u9996+\u5c3e</button>
            </div>
          </div>

          {/* Hình ảnh tham khảoChiến lược */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Hình ảnh tham khảoChiến lược:</span>
            <Select value={refStrategy} onValueChange={v => setRefStrategy(v as any)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="\u9009\u62e9Chiến lược" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cluster" className="text-xs">Cluster（\u805a\u7c7b\u53bb\u91cd）</SelectItem>
                <SelectItem value="minimal" className="text-xs">Minimal（\u5355Tài liệu tham khảo）</SelectItem>
                <SelectItem value="none" className="text-xs">None（không cóTài liệu tham khảo）</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => setUseExemplar(!useExemplar)}
              className={cn("px-2 py-1 text-xs rounded border", useExemplar ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
              title="\u540c\u7ec4\u683c\u5f15sử dụngĐã Tạocủa\u8303\u4f8b\u6210\u7247\u4f5ccho\u951a\u70b9"
            >\u8303\u4f8b\u951a\u56fe {useExemplar ? '\u5f00' : '\u5173'}</button>
          </div>

          {/* \u6267được rồi\u5408\u5e76Tạo - \u7a81\u51fa\u663e\u793a */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              className="h-8 px-4 text-xs font-medium"
              disabled={isGenerating || isMergedRunning || splitScenes.length === 0}
              onClick={() => {
                console.log('[MergedGenControls] \u6267được rồi\u5408\u5e76Tạo\u6309\u94ae\u70b9\u51fb, frameMode:', frameMode, 'refStrategy:', refStrategy, 'useExemplar:', useExemplar);
                handleMergedGenerate(frameMode, refStrategy, useExemplar);
              }}
            >
              {isMergedRunning ? (<><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />\u5408\u5e76Tạotrong...</>) : (<><Sparkles className="h-3.5 w-3.5 mr-1.5" />\u6267được rồi\u5408\u5e76Tạo</>)}
            </Button>
            {isMergedRunning && (
              <Button
                variant="destructive"
                className="h-8 px-3 text-xs"
                onClick={handleStopMergedGeneration}
              >
                <Square className="h-3.5 w-3.5 mr-1" />Dừng
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Warning if no prompts */}
      {splitScenes.some(s => !s.videoPrompt.trim()) && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <div className="text-xs text-yellow-600 dark:text-yellow-400">
            <p>một phầnPhân cảnhthiếu\u5c11Prompt，\u70b9\u51fbPhân cảnh\u4e0b\u65b9của\u6587từQuận\u57dfCán Chỉnh sửa。</p>
          </div>
        </div>
      )}

      {/* ========== lớp SVideoTạomode\u5207\u6362 ========== */}
      <div className="flex items-center gap-2 pb-2">
        <span className="text-xs text-muted-foreground">VideoTạomode:</span>
        <div className="flex rounded-md border overflow-hidden">
          <button
            onClick={() => setSclassGenMode('group')}
            className={cn(
              "px-3 py-1.5 text-xs",
              sclassGenMode === 'group' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
          >\u5206Nhóm Tạo ({shotGroups.length} \u7ec4)</button>
          <button
            onClick={() => setSclassGenMode('single')}
            className={cn(
              "px-3 py-1.5 text-xs border-l",
              sclassGenMode === 'single' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
          >thấu kính đơn Tạo ({splitScenes.length} \u955c)</button>
        </div>
        {sclassGenMode === 'group' && (
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={shotGroups.length === 0 || shotGroups.some(g => g.calibrationStatus === 'calibrating')}
              onClick={async () => {
                toast.info('Bắt đầulô\u91cf AI \u6821\u51c6...');
                const { success, total } = await runBatchCalibration(splitScenes, allCharacters, sceneLibrary);
                if (total === 0) {
                  toast.info('\u6ca1Có\u9700\u8981\u6821\u51c6của\u7ec4');
                } else {
                  toast.success(`lô\u91cf\u6821\u51c6Hoàn thành：${success}/${total} Nhóm Thành công`);
                }
              }}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              lô\u91cf\u6821\u51c6
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                const groups = autoGroupScenes(splitScenes);
                const named = groups.map((g, idx) => ({ ...g, name: generateGroupName(g, splitScenes, idx) }));
                setShotGroups(named);
                toast.success(`Đã rồi\u91cd\u65b0\u5206\u7ec4：${named.length} \u7ec4`);
              }}
            >\u91cd\u65b0\u5206\u7ec4</Button>
          </div>
        )}
      </div>

      {/* ========== \u5206\u7ec4chế độ: ShotGroupCard ========== */}
      {sclassGenMode === 'group' ? (
        <div className="flex flex-col gap-3">
          {shotGroups.map((group, groupIdx) => {
            const groupScenes = group.sceneIds
              .map(id => sceneMap.get(id))
              .filter(Boolean) as SplitScene[];
            return (
              <ShotGroupCard
                key={group.id}
                group={group}
                scenes={groupScenes}
                allScenes={splitScenes}
                groupIndex={groupIdx}
                isGeneratingAny={isGenerating}
                characters={allCharacters}
                sceneLibrary={sceneLibrary}
                onCalibrateGroup={(groupId) => {
                  const groupScenes = shotGroups.find(sg => sg.id === groupId)
                    ?.sceneIds.map(id => sceneMap.get(id)).filter(Boolean) as SplitScene[] || [];
                  runCalibration(groupId, groupScenes, allCharacters, sceneLibrary)
                    .then(ok => {
                      if (ok) toast.success('AI \u6821\u51c6Hoàn thành');
                      else toast.error('Hiệu chỉnh AIThất bại');
                    });
                }}
                onGenerateGroupVideo={(groupId) => {
                  const g = shotGroups.find(sg => sg.id === groupId);
                  if (g) {
                    setIsGenerating(true);
                    generateGroupVideo(g, {
                      confirmBeforeGenerate: () => new Promise((resolve) => {
                        resolve(window.confirm(
                          'biểu đồ lướivàPromptĐã rồi\u51c6\u5907\u5b8c\u6bd5，\u53ef\u5728\u5206\u7ec4\u5361\u7247trongXem trướcvàTải xuống。\n\n\u662f\u5426tiếp tục\u8c03sử dụng API Tạo video？'
                        ));
                      }),
                    }).finally(() => setIsGenerating(false));
                  }
                }}
                onExtendGroup={(groupId) => {
                  const g = shotGroups.find(sg => sg.id === groupId);
                  if (g) {
                    setExtendEditMode('extend');
                    setExtendEditSourceGroup(g);
                    setExtendEditOpen(true);
                  }
                }}
                onEditGroup={(groupId) => {
                  const g = shotGroups.find(sg => sg.id === groupId);
                  if (g) {
                    setExtendEditMode('edit');
                    setExtendEditSourceGroup(g);
                    setExtendEditOpen(true);
                  }
                }}
                renderSceneCard={(scene) => (
                  <SceneCard
                    scene={scene}
                    onUpdateImagePrompt={(id, prompt, promptZh) => updateSplitSceneImagePrompt(id, prompt, promptZh)}
                    onUpdateVideoPrompt={(id, prompt, promptZh) => updateSplitSceneVideoPrompt(id, prompt, promptZh)}
                    onUpdateEndFramePrompt={(id, prompt, promptZh) => updateSplitSceneEndFramePrompt(id, prompt, promptZh)}
                    onUpdateNeedsEndFrame={(id, needsEndFrame) => updateSplitSceneNeedsEndFrame(id, needsEndFrame)}
                    onUpdateEndFrame={handleUpdateEndFrame}
                    onUpdateCharacters={handleUpdateCharacters}
                    onUpdateCharacterVariationMap={handleUpdateCharacterVariationMap}
                    onUpdateEmotions={handleUpdateEmotions}
                    onUpdateShotSize={handleUpdateShotSize}
                    onUpdateDuration={handleUpdateDuration}
                    onUpdateAmbientSound={handleUpdateAmbientSound}
                    onUpdateSoundEffects={handleUpdateSoundEffects}
                    onUpdateSceneReference={(id, sceneLibId, viewpointId, refImage, subViewId) => updateSplitSceneReference(id, sceneLibId, viewpointId, refImage, subViewId)}
                    onUpdateEndFrameSceneReference={(id, sceneLibId, viewpointId, refImage, subViewId) => updateSplitSceneEndFrameReference(id, sceneLibId, viewpointId, refImage, subViewId)}
                    onDelete={handleDeleteScene}
                    onSaveToLibrary={handleSaveToLibrary}
                    onGenerateImage={handleGenerateSingleImage}
                    onGenerateVideo={handleGenerateSingleVideo}
                    onGenerateEndFrame={handleGenerateEndFrameImage}
                    onRemoveImage={handleRemoveImage}
                    onUploadImage={handleUploadImage}
                    onUpdateField={(id, field, value) => updateSplitSceneField(id, field, value)}
                    onAngleSwitch={handleAngleSwitchClick}
                    onQuadGrid={handleQuadGridClick}
                    onExtractVideoLastFrame={handleExtractVideoLastFrame}
                    onStopImageGeneration={handleStopImageGeneration}
                    onStopVideoGeneration={handleStopVideoGeneration}
                    onStopEndFrameGeneration={handleStopEndFrameGeneration}
                    isExtractingFrame={isExtractingFrame}
                    isAngleSwitching={isAngleSwitching}
                    isQuadGridGenerating={isQuadGridGenerating}
                    isGeneratingAny={isGenerating}
                  />
                )}
              />
            );
          })}
        </div>
      ) : (
        /* ========== \u5355\u955cchế độ: \u5e73\u94fa SceneCard ========== */
        <div className="flex flex-col gap-3">
          {splitScenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              onUpdateImagePrompt={(id, prompt, promptZh) => updateSplitSceneImagePrompt(id, prompt, promptZh)}
              onUpdateVideoPrompt={(id, prompt, promptZh) => updateSplitSceneVideoPrompt(id, prompt, promptZh)}
              onUpdateEndFramePrompt={(id, prompt, promptZh) => updateSplitSceneEndFramePrompt(id, prompt, promptZh)}
              onUpdateNeedsEndFrame={(id, needsEndFrame) => updateSplitSceneNeedsEndFrame(id, needsEndFrame)}
              onUpdateEndFrame={handleUpdateEndFrame}
              onUpdateCharacters={handleUpdateCharacters}
              onUpdateCharacterVariationMap={handleUpdateCharacterVariationMap}
              onUpdateEmotions={handleUpdateEmotions}
              onUpdateShotSize={handleUpdateShotSize}
              onUpdateDuration={handleUpdateDuration}
              onUpdateAmbientSound={handleUpdateAmbientSound}
              onUpdateSoundEffects={handleUpdateSoundEffects}
              onUpdateSceneReference={(id, sceneLibId, viewpointId, refImage, subViewId) => updateSplitSceneReference(id, sceneLibId, viewpointId, refImage, subViewId)}
              onUpdateEndFrameSceneReference={(id, sceneLibId, viewpointId, refImage, subViewId) => updateSplitSceneEndFrameReference(id, sceneLibId, viewpointId, refImage, subViewId)}
              onDelete={handleDeleteScene}
              onSaveToLibrary={handleSaveToLibrary}
              onGenerateImage={handleGenerateSingleImage}
              onGenerateVideo={handleGenerateSingleVideo}
              onGenerateEndFrame={handleGenerateEndFrameImage}
              onRemoveImage={handleRemoveImage}
              onUploadImage={handleUploadImage}
              onUpdateField={(id, field, value) => updateSplitSceneField(id, field, value)}
              onAngleSwitch={handleAngleSwitchClick}
              onQuadGrid={handleQuadGridClick}
              onExtractVideoLastFrame={handleExtractVideoLastFrame}
              onStopImageGeneration={handleStopImageGeneration}
              onStopVideoGeneration={handleStopVideoGeneration}
              onStopEndFrameGeneration={handleStopEndFrameGeneration}
              isExtractingFrame={isExtractingFrame}
              isAngleSwitching={isAngleSwitching}
              isQuadGridGenerating={isQuadGridGenerating}
              isGeneratingAny={isGenerating}
            />
          ))}
        </div>
      )}

      {/* Action buttons — lớp Scấp độ nhómVideoTạo */}
      {(() => {
        const scenesWithImages = splitScenes.filter(s => s.imageDataUrl).length;
        const scenesNeedVideo = splitScenes.filter(s => s.imageDataUrl && (s.videoStatus === 'idle' || s.videoStatus === 'failed')).length;
        const groupsNeedGen = shotGroups.filter(g => g.videoStatus === 'idle' || g.videoStatus === 'failed').length;
        const noImages = scenesWithImages === 0;
        return (
          <div className="flex gap-2 pt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      if (sclassGenMode === 'group') {
                        // lớp Scấp độ nhómTạo: \u8c03sử dụng Seedance 2.0 API \u9010Nhóm Tạo
                        setIsGenerating(true);
                        setBatchProgress(null);
                        generateAllGroups((progress) => setBatchProgress(progress))
                          .finally(() => {
                            setIsGenerating(false);
                            setBatchProgress(null);
                          });
                      } else {
                        // \u5355\u955cchế độ: sử dụnggiám đốc\u9762\u677f\u539fCó\u903b\u8f91
                        handleGenerateVideos();
                      }
                    }}
                    disabled={isGenerating || splitScenes.length === 0 || noImages}
                    className="flex-1"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {batchProgress
                          ? `Tạotrong (${batchProgress.completed}/${batchProgress.total})...`
                          : 'Tạotrong...'
                        }
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        {sclassGenMode === 'group'
                          ? `Seedance 2.0 cấp độ nhómTạo (${groupsNeedGen}/${shotGroups.length} \u7ec4)`
                          : `Tạo video (${scenesNeedVideo}/${splitScenes.length})`
                        }
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {noImages ? (
                    <p>\u8bf7đầu tiênchoPhân cảnhTạo hình ảnh，Một lần nữaTạo video</p>
                  ) : sclassGenMode === 'group' ? (
                    <p>{groupsNeedGen} một\u7ec4Đợi T.ạo，\u6bcf\u7ec4\u5408\u5e76Nhiều Cảnh quay + @\u5f15sử dụng \u8c03sử dụng Seedance 2.0，\u9010\u7ec4\u5c3e\u5e27\u4f20\u9012</p>
                  ) : (
                    <p>{scenesWithImages} Phân cảnhĐã rồiCóHình ảnh，{scenesNeedVideo} mộtĐợi T.ạo video</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {isGenerating && sclassGenMode === 'group' && (
              <Button
                variant="destructive"
                size="lg"
                onClick={abortSClassGeneration}
              >
                <Square className="h-4 w-4 mr-2" />
                Dừng
              </Button>
            )}
          </div>
        );
      })()}

      {/* Tips */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
        {sclassGenMode === 'group' ? (
          <p>💡 \u5206\u7ec4chế độ：\u6bcf\u7ec4 2~4 Cảnh quay\u5408\u5e76chomộtmộtVideo，Tổng Thời lượng ≤15s。\u70b9\u51fb「\u91cd\u65b0\u5206\u7ec4」\u53ef\u91cd\u65b0\u81ea\u52a8\u5206\u914d。</p>
        ) : (
          <p>💡 \u5355\u955cchế độ：Mọi Cảnh quay độc lập TạomộtmộtVideo。\u70b9\u51fbPhân cảnh\u4e0b\u65b9của\u6587từQuận\u57dfCán Chỉnh sửaPrompt。</p>
        )}
      </div>
      </>
      )}

      {/* Angle Switch Dialog */}
      <AngleSwitchDialog
        open={angleSwitchOpen}
        onOpenChange={setAngleSwitchOpen}
        onGenerate={handleAngleSwitchGenerate}
        isGenerating={isAngleSwitching}
        frameType={angleSwitchTarget?.type || "start"}
        previewUrl={(() => {
          if (!angleSwitchTarget) return undefined;
          const scene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
          return angleSwitchTarget.type === "start"
            ? scene?.imageDataUrl || undefined
            : scene?.endFrameImageUrl || undefined;
        })()}
        sameSceneShotsCount={0}
      />

      {/* Angle Switch Result Dialog */}
      <AngleSwitchResultDialog
        open={angleSwitchResultOpen}
        onOpenChange={setAngleSwitchResultOpen}
        result={angleSwitchResult}
        history={(() => {
          if (!angleSwitchTarget) return [];
          const scene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
          return angleSwitchTarget.type === "start"
            ? (scene?.startFrameAngleSwitchHistory || [])
            : (scene?.endFrameAngleSwitchHistory || []);
        })()}
        selectedHistoryIndex={selectedHistoryIndex}
        onSelectHistory={setSelectedHistoryIndex}
        onApply={handleApplyAngleSwitch}
        onRegenerate={() => {
          setAngleSwitchResultOpen(false);
          setAngleSwitchOpen(true);
        }}
      />

      {/* Quad Grid Dialog */}
      <QuadGridDialog
        open={quadGridOpen}
        onOpenChange={setQuadGridOpen}
        onGenerate={handleQuadGridGenerate}
        isGenerating={isQuadGridGenerating}
        frameType={quadGridTarget?.type || "start"}
        previewUrl={(() => {
          if (!quadGridTarget) return undefined;
          const scene = splitScenes.find(s => s.id === quadGridTarget.sceneId);
          return quadGridTarget.type === "start"
            ? scene?.imageDataUrl || undefined
            : scene?.endFrameImageUrl || undefined;
        })()}
      />

      {/* Quad Grid Result Dialog */}
      <QuadGridResultDialog
        open={quadGridResultOpen}
        onOpenChange={setQuadGridResultOpen}
        result={quadGridResult}
        frameType={quadGridTarget?.type || "start"}
        currentSceneId={quadGridTarget?.sceneId ?? 0}
        availableScenes={splitScenes.map(s => ({ id: s.id, label: `Phân cảnh ${s.id + 1}` }))}
        onApply={handleApplyQuadGrid}
        onCopyToScene={handleCopyQuadGridToScene}
      />

      {/* Videomở rộng/Chỉnh sửa\u5bf9\u8bdd\u6846 */}
      <ExtendEditDialog
        open={extendEditOpen}
        onOpenChange={setExtendEditOpen}
        mode={extendEditMode}
        sourceGroup={extendEditSourceGroup}
        isGenerating={isGenerating}
        onConfirm={(childGroup) => {
          setIsGenerating(true);
          generateGroupVideo(childGroup).finally(() => setIsGenerating(false));
        }}
      />
    </div>
  );
}

