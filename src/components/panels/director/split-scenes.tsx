// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * \u5206\u955c\u7ec4\u4ef6 (Split Scenes Component)
 * \u663e\u793a\u5206\u955c\u5207\u5272kết quả，\u652f\u6301\u7f16\u8f91\u63d0\u793a\u8bcd、\u4e0a\u4f20\u5c3e\u5e27、\u9009\u62e9\u89d2\u8272\u5e93、\u6dfb\u52a0Thẻ cảm xúc
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
import { useCharacterLibraryStore, type Character, type CharacterVariation } from "@/stores/character-library-store";
import { useScriptStore } from "@/stores/script-store";
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
  Plus,
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
import { callVideoGenerationApi, extractLastFrameFromVideo, isContentModerationError } from './use-video-generation';
import { persistSceneImage } from '@/lib/utils/image-persist';
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
import { SplitSceneCard } from "./split-scene-card";
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

// SceneCard Đã rồi\u79fb\u81f3 split-scene-card.tsx，\u6b64\u5904sử dụng SplitSceneCard
const SceneCard = SplitSceneCard;

const isHttpImageUrl = (value?: string | null): boolean => {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
};

const isLocalImageSource = (value?: string | null): value is string => {
  return typeof value === 'string' && value.length > 0 && !isHttpImageUrl(value);
};

const isDiscouragedExternalImageUrl = (value?: string | null): boolean => {
  if (!isHttpImageUrl(value)) return false;
  try {
    const hostname = new URL(value ?? '').hostname.toLowerCase();
    return hostname === 'bmp.ovh' || hostname.endsWith('.bmp.ovh');
  } catch {
    return false;
  }
};

const shouldRefreshImageViaCurrentHost = (localUrl?: string | null): boolean => {
  return isLocalImageSource(localUrl) && useAPIConfigStore.getState().isImageHostConfigured();
};

type ReferenceBucketKind = 'anchor' | 'character' | 'scene' | 'style';

type ReferenceBucket = {
  kind: ReferenceBucketKind;
  images: string[];
};

type SceneCharacterContext = {
  characterId: string;
  name: string;
  identityNotes: string[];
  referenceImages: string[];
};

const MAX_REFERENCE_IMAGES = 14;
const MAX_NANO_BANANA_REFERENCE_IMAGES = 6;
const NANO_BANANA_IDENTITY_MODELS = new Set([
  'nano-banana-pro',
  'gemini-3-pro-image-preview',
  'nano-banana-2',
  'gemini-3.1-pro-image-preview',
]);
const REFERENCE_BUCKET_PRIORITY: Record<ReferenceBucketKind, number> = {
  anchor: 0,
  character: 1,
  scene: 2,
  style: 3,
};

const normalizeCharacterIdentityText = (value?: string | null, maxLength = 96): string => {
  if (!value) return '';
  const normalized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-*•·]+/, '')
    .replace(/[;,，；。]+$/g, '')
    .trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const isNanoBananaProModel = (model?: string | null): boolean => {
  const normalized = (model || '').trim().toLowerCase();
  return NANO_BANANA_IDENTITY_MODELS.has(normalized);
};

const optimizeReferenceImagesForModel = (
  model: string | undefined,
  buckets: ReferenceBucket[],
): string[] => {
  const orderedBuckets = isNanoBananaProModel(model)
    ? [...buckets].sort((left, right) => REFERENCE_BUCKET_PRIORITY[left.kind] - REFERENCE_BUCKET_PRIORITY[right.kind])
    : buckets;
  const limit = isNanoBananaProModel(model) ? MAX_NANO_BANANA_REFERENCE_IMAGES : MAX_REFERENCE_IMAGES;
  const refs: string[] = [];
  const seen = new Set<string>();

  for (const bucket of orderedBuckets) {
    for (const image of bucket.images) {
      if (!image || seen.has(image)) continue;
      seen.add(image);
      refs.push(image);
      if (refs.length >= limit) return refs;
    }
  }

  return refs;
};

const buildReferencePriorityHint = (model: string | undefined, hasCharacterReferences: boolean): string => {
  if (!isNanoBananaProModel(model) || !hasCharacterReferences) return '';
  return [
    'Reference priority:',
    'the earliest character references are canonical identity anchors;',
    'later references are only for scene, lighting, framing, and mood;',
    'later references must never override face-name-body identity.',
  ].join(' ');
};

const buildCharacterIdentityNotes = (
  character: Character,
  selectedVariation?: CharacterVariation,
): string[] => {
  const notes: string[] = [];
  const push = (value?: string | null, maxLength = 96) => {
    const normalized = normalizeCharacterIdentityText(value, maxLength);
    if (!normalized || notes.includes(normalized)) return;
    notes.push(normalized);
  };

  const anchors = character.identityAnchors;
  if (anchors) {
    const boneStructure = [anchors.faceShape, anchors.jawline, anchors.cheekbones].filter(Boolean).join(', ');
    const facialFeatures = [anchors.eyeShape, anchors.eyeDetails, anchors.noseShape, anchors.lipShape].filter(Boolean).join(', ');
    const hairDetails = [anchors.hairStyle, anchors.hairlineDetails].filter(Boolean).join(', ');
    const colorDetails = [
      anchors.colorAnchors?.iris ? `iris ${anchors.colorAnchors.iris}` : '',
      anchors.colorAnchors?.hair ? `hair ${anchors.colorAnchors.hair}` : '',
      anchors.colorAnchors?.skin ? `skin ${anchors.colorAnchors.skin}` : '',
      anchors.colorAnchors?.lips ? `lips ${anchors.colorAnchors.lips}` : '',
    ].filter(Boolean).join(', ');

    if (boneStructure) push(`bone structure ${boneStructure}`);
    if (facialFeatures) push(`facial features ${facialFeatures}`);
    if (anchors.uniqueMarks?.length) push(`unique marks ${anchors.uniqueMarks.slice(0, 2).join(', ')}`);
    if (hairDetails) push(`hair ${hairDetails}`);
    if (colorDetails) push(`color anchors ${colorDetails}`);
    if (anchors.skinTexture) push(`skin texture ${anchors.skinTexture}`);
  }

  if (notes.length < 4) push(character.appearance);
  if (notes.length < 4) push(character.visualTraits);
  if (notes.length < 4) push(character.description);
  if (notes.length < 4) push(character.role);

  if (selectedVariation) {
    const variationPrompt = selectedVariation.visualPromptZh || selectedVariation.visualPrompt || selectedVariation.name;
    push(`current outfit/state ${variationPrompt}`, 84);
  }

  return notes.slice(0, 4);
};

const buildCharacterIdentityBlock = (contexts: SceneCharacterContext[]): string => {
  if (contexts.length === 0) return '';

  const lines = ['Character identity lock:'];
  contexts.forEach((context) => {
    const summary = context.identityNotes.length > 0
      ? context.identityNotes.join('; ')
      : 'use the canonical earliest reference as the exact face/body identity anchor';
    lines.push(`- ${context.name}: ${summary}.`);
  });

  if (contexts.length > 1) {
    lines.push('Do not swap face identity, body identity, speaking ownership, or action ownership between named characters.');
  } else {
    lines.push('The named character must remain the exact same person in every output.');
  }

  return lines.join('\n');
};

const buildSceneCharacterCastLine = (contexts: SceneCharacterContext[]): string => {
  if (contexts.length === 0) return '';

  const names = contexts.map((context) => context.name).join(', ');
  if (contexts.length === 1) {
    return `Exact scene cast: ${names} only. Do not add any other person.`;
  }

  return `Exact scene cast: ${names}. Keep the face-name-body mapping exact for each named character and do not swap who performs or receives the action.`;
};

export function SplitScenes({ onBack, onGenerateVideos }: SplitScenesProps) {
  // ========== \u5408\u5e76\u751f\u6210（chíncung điện\u683c）\u672c\u5730 UI \u72b6\u6001 ==========
  const [imageGenMode, setImageGenMode] = useState<'single' | 'merged'>('merged');
  const [frameMode, setFrameMode] = useState<'first' | 'last' | 'both'>('first');
  const [isMergedRunning, setIsMergedRunning] = useState(false);
  const [refStrategy, setRefStrategy] = useState<'cluster'|'minimal'|'none'>('cluster');
  const [useExemplar, setUseExemplar] = useState(true);
  const PAGE_CONCURRENCY = 2; // \u6bcf\u9875Đồng thờiđặt\u7fa4\u6570\u9650\u5236
  // \u5408\u5e76\u751f\u6210\u505c\u6b62\u63a7\u5236
  const mergedAbortRef = useRef(false);
  // khung hình đầu tiên/\u89c6\u9891/\u5c3e\u5e27\u751f\u6210của AbortController（sử dụng\u4e8e\u771f\u6b63\u53d6\u6d88\u5e95\u5c42 fetch và\u8f6e\u8be2）
  const imageAbortRef = useRef<AbortController | null>(null);
  const videoAbortRef = useRef<AbortController | null>(null);
  const endFrameAbortRef = useRef<AbortController | null>(null);
  // \u5408\u5e76\u751f\u6210\u63a7\u4ef6\u5c06\u5728 JSX trongbên trong\u8054kết xuất，\u907f\u514d\u95ed\u5305\u5f15sử dụng\u95ee\u9898
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [currentGeneratingId, setCurrentGeneratingId] = useState<number | null>(null);
  // Tab \u72b6\u6001: \u5206\u955c\u7f16\u8f91 vs xe kéo
  const [activeTab, setActiveTab] = useState<"editing" | "trailer">("editing");

  // góc\u5207\u6362\u72b6\u6001
  const [angleSwitchOpen, setAngleSwitchOpen] = useState(false);
  const [angleSwitchResultOpen, setAngleSwitchResultOpen] = useState(false);
  const [angleSwitchTarget, setAngleSwitchTarget] = useState<{ sceneId: number; type: "start" | "end" } | null>(null);
  const [angleSwitchResult, setAngleSwitchResult] = useState<AngleSwitchResult | null>(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const [isAngleSwitching, setIsAngleSwitching] = useState(false);
  
  // Trích xuất\u89c6\u9891\u6700\u540emột\u5e27\u72b6\u6001
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);

  // bốncung điện\u683c\u72b6\u6001
  const [quadGridOpen, setQuadGridOpen] = useState(false);
  const [quadGridResultOpen, setQuadGridResultOpen] = useState(false);
  const [quadGridTarget, setQuadGridTarget] = useState<{ sceneId: number; type: "start" | "end" } | null>(null);
  const [quadGridResult, setQuadGridResult] = useState<QuadGridResult | null>(null);
  const [isQuadGridGenerating, setIsQuadGridGenerating] = useState(false);

  // Get current project data
  const projectData = useActiveDirectorProject();

  // \u83b7\u53d6hiện tại\u9879mục đích\u63d0\u793a\u8bcdngôn ngữ\u8bbe\u7f6e（\u6765\u81ea\u5267\u672c\u9762\u677f）
  const promptLanguage = useScriptStore(state => {
    const pid = state.activeProjectId;
    return pid ? state.projects[pid]?.promptLanguage : undefined;
  }) || 'zh';

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
  // Dữ liệu đoạn giới thiệu - lọc trực tiếp từ SplitScenes，Đảm bảo chức năng nhất quán
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
  
  // Lọc các phân cảnh trailer theo từ khóa trong sceneName
  const trailerScenes = useMemo(() => {
    // Hỗ trợ cả dữ liệu cũ ('xe kéo') và mới ('trailer')
    const filtered = splitScenes.filter(scene => {
      const sceneName = scene.sceneName || '';
      return sceneName.includes('trailer') || sceneName.includes('xe kéo');
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
    // \u573a\u666f\u5e93\u5173\u8054\u66f4mới\u65b9\u6cd5
    updateSplitSceneReference,
    updateSplitSceneEndFrameReference,
    // phổ quátCánh đồng\u66f4mới\u65b9\u6cd5（sử dụng\u4e8e\u53cc\u51fb\u7f16\u8f91）
    updateSplitSceneField,
    // \u89c6\u89d2\u5207\u6362\u5386\u53f2
    addAngleSwitchHistory,
    deleteSplitScene,
    addBlankSplitScene,
    resetStoryboard,
    // xe kéochức năng
    clearTrailer,
    // \u6444\u5f71gió\u683c\u6863\u6848
    setCinematographyProfileId,
  } = useDirectorStore();
  const mediaProjectId = activeProjectId || undefined;

  // Get current style from config
  // Ưu tiênsử dụng\u76f4\u63a5\u5b58\u50a8của visualStyleId，\u56de\u9000Đến styleTokens \u53cd\u63a8（Tương thích với cũ\u9879\u76ee）
  // \u672a\u8bbe\u7f6e\u65f6cho null（\u4e0d\u65bd\u52a0\u4efb\u4f55gió\u683c），\u907f\u514d\u9ed8\u8ba4lực lượng 2D \u5409\u535c\u529b
  const currentStyleId = useMemo(() => {
    if (storyboardConfig.visualStyleId) {
      return storyboardConfig.visualStyleId;
    }
    // \u5411\u540e\u517c\u5bb9：\u5c06 styleTokens \u5408\u5e76\u540etrận đấu prompt \u524d\u7f00
    if (storyboardConfig.styleTokens && storyboardConfig.styleTokens.length > 0) {
      const joinedTokens = storyboardConfig.styleTokens.join(', ');
      const found = VISUAL_STYLE_PRESETS.find(s => s.prompt.startsWith(joinedTokens));
      return found?.id || null;
    }
    return null;
  }, [storyboardConfig.visualStyleId, storyboardConfig.styleTokens]);

  // \u8bfb\u53d6hiện tại\u6444\u5f71gió\u683c\u6863\u6848（\u672a\u8bbe\u7f6e\u65f6sử dụng\u9ed8\u8ba4\u7ecf\u5178\u7535\u5f71\u6444\u5f71gió\u683c）
  const currentCinProfileId = projectData?.cinematographyProfileId || DEFAULT_CINEMATOGRAPHY_PROFILE_ID;

  // \u5207\u6362\u6444\u5f71gió\u683c\u6863\u6848
  const handleCinProfileChange = useCallback((profileId: string) => {
    setCinematographyProfileId(profileId || undefined);
    toast.success('Đã cập nhật phong cách quay phim');
  }, [setCinematographyProfileId]);

  // Update style
  const handleStyleChange = useCallback((styleId: string) => {
    const style = getStyleById(styleId);
    if (style) {
      // \u76f4\u63a5\u5b58\u50a8gió\u683c ID，\u540c\u65f6\u4fdd\u7559 styleTokens（\u5b8c\u6574 prompt）Tương thích với cũ\u903b\u8f91
      setStoryboardConfig({ visualStyleId: styleId, styleTokens: [style.prompt] });
      toast.success(`Đã chuyển sang phong cách ${style.name}`);
    }
  }, [setStoryboardConfig]);

  // Update aspect ratio
  const handleAspectRatioChange = useCallback((ratio: '16:9' | '9:16') => {
    setStoryboardConfig({ aspectRatio: ratio });
    toast.success(`Đã chuyển sang chế độ ${ratio === '16:9' ? 'màn hình ngang' : 'màn hình dọc'}`);
  }, [setStoryboardConfig]);

  const { getApiKey, getProviderByPlatform, concurrency } = useAPIConfigStore();
  const { addMediaFromUrl, getOrCreateCategoryFolder } = useMediaStore();
  
  // Get system category folder IDs for auto-saving (images → AI\u56fe\u7247, videos → AI\u89c6\u9891)
  const getImageFolderId = useCallback(() => getOrCreateCategoryFolder('ai-image'), [getOrCreateCategoryFolder]);
  const getVideoFolderId = useCallback(() => getOrCreateCategoryFolder('ai-video'), [getOrCreateCategoryFolder]);

  // Auto-save video to media library and return mediaId
  const autoSaveVideoToLibrary = useCallback((sceneId: number, videoUrl: string, thumbnailUrl?: string, duration?: number): string => {
    const folderId = getVideoFolderId();
    
    const mediaId = addMediaFromUrl({
      url: videoUrl,
      name: `Phân cảnh ${sceneId + 1} - AI Video`,
      type: 'video',
      source: 'ai-video',
      thumbnailUrl,
      duration: duration || 5,
      folderId,
      projectId: mediaProjectId,
    });
    
    console.log('[SplitScenes] Auto-saved video to AI\u89c6\u9891 folder:', mediaId);
    return mediaId;
  }, [addMediaFromUrl, getVideoFolderId, mediaProjectId]);

  // Auto-save image to media library
  const autoSaveImageToLibrary = useCallback((sceneId: number, imageUrl: string): string => {
    const folderId = getImageFolderId();
    
    const mediaId = addMediaFromUrl({
      url: imageUrl,
      name: `Phân cảnh ${sceneId + 1} - AI Ảnh`,
      type: 'image',
      source: 'ai-image',
      folderId,
      projectId: mediaProjectId,
    });
    
    console.log('[SplitScenes] Auto-saved image to AI\u56fe\u7247 folder:', mediaId);
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
    toast.success(`Đã xóa phân cảnh ${sceneId + 1}`);
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

    // \u68c0\u67e5ĐúngKHÔNGCó\u4e0bmộtmột\u5206\u955c
    const nextScene = splitScenes[sceneIndex + 1];
    if (!nextScene) {
      toast.error('Đây là phân cảnh cuối, không thể chèn vào phân cảnh tiếp theo');
      return;
    }

    setIsExtractingFrame(true);
    
    try {
      // Trích xuất\u6700\u540emột\u5e27
      const lastFrameBase64 = await extractLastFrameFromVideo(scene.videoUrl, 0.1);
      if (!lastFrameBase64) {
        toast.error('Trích xuất khung hình thất bại');
        return;
      }
      
      // \u6301\u4e45\u5316Đến\u672c\u5730 + \u56fegiường
      const persistResult = await persistSceneImage(lastFrameBase64, nextScene.id, 'first');
      
      // \u63d2\u5165Đến\u4e0bmộtmột\u5206\u955ccủakhung hình đầu tiên
      updateSplitSceneImage(nextScene.id, persistResult.localPath, nextScene.width, nextScene.height, persistResult.httpUrl || undefined);
      toast.success(`Đã chèn khung cuối của phân cảnh ${sceneId + 1} vào khung đầu của phân cảnh ${nextScene.id + 1}`);
      
    } catch (e) {
      console.error('[SplitScenes] Extract last frame error:', e);
      toast.error('Trích xuất khung hình thất bại');
    } finally {
      setIsExtractingFrame(false);
    }
  }, [splitScenes, updateSplitSceneImage]);

  // ========== \u505c\u6b62\u751f\u6210\u5904\u7406chức năng ==========
  // \u505c\u6b62khung hình đầu tiêđồ thị n\u7247\u751f\u6210
  const handleStopImageGeneration = useCallback((sceneId: number) => {
    imageAbortRef.current?.abort();
    imageAbortRef.current = null;
    updateSplitSceneImageStatus(sceneId, {
      imageStatus: 'idle',
      imageProgress: 0,
      imageError: 'Người dùng đã hủy',
    });
    setIsGenerating(false);
    setCurrentGeneratingId(null);
    toast.info(`Đã dừng tạo khung đầu của phân cảnh ${sceneId + 1}`);
  }, [updateSplitSceneImageStatus]);

  // \u505c\u6b62\u89c6\u9891\u751f\u6210
  const handleStopVideoGeneration = useCallback((sceneId: number) => {
    videoAbortRef.current?.abort();
    videoAbortRef.current = null;
    updateSplitSceneVideo(sceneId, {
      videoStatus: 'idle',
      videoProgress: 0,
      videoError: 'Người dùng đã hủy',
    });
    setIsGenerating(false);
    setCurrentGeneratingId(null);
    toast.info(`Đã dừng tạo video của phân cảnh ${sceneId + 1}`);
  }, [updateSplitSceneVideo]);

  // \u505c\u6b62\u5c3e\u5e27\u56fe\u7247\u751f\u6210
  const handleStopEndFrameGeneration = useCallback((sceneId: number) => {
    endFrameAbortRef.current?.abort();
    endFrameAbortRef.current = null;
    updateSplitSceneEndFrameStatus(sceneId, {
      endFrameStatus: 'idle',
      endFrameProgress: 0,
      endFrameError: 'Người dùng đã hủy',
    });
    setIsGenerating(false);
    toast.info(`Đã dừng tạo khung cuối của phân cảnh ${sceneId + 1}`);
  }, [updateSplitSceneEndFrameStatus]);

  // \u505c\u6b62\u5408\u5e76\u751f\u6210
  const handleStopMergedGeneration = useCallback(() => {
    mergedAbortRef.current = true;
    setIsMergedRunning(false);
    toast.info('Đã dừng tạo gộp');
  }, []);

  // Handle angle switch click
  const handleAngleSwitchClick = useCallback((sceneId: number, type: "start" | "end") => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    const imageUrl = type === "start" 
      ? (scene.imageDataUrl || scene.imageHttpUrl) 
      : (scene.endFrameImageUrl || scene.endFrameHttpUrl);
    if (!imageUrl) {
      toast.error(`Vui lòng tạo ${type === "start" ? "khung đầu" : "khung cuối"} trước`);
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
      toast.error("Vui lòng cấu hình RunningHub trong Cài đặt trước (API Key / Base URL / AppId)");
      setAngleSwitchOpen(false);
      return;
    }

    const scene = splitScenes.find(s => s.id === angleSwitchTarget.sceneId);
    if (!scene) return;

    const originalImage = angleSwitchTarget.type === "start" 
      ? (scene.imageDataUrl || scene.imageHttpUrl) 
      : (scene.endFrameImageUrl || scene.endFrameHttpUrl);
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

      // từ store \u5b9e\u65f6\u8bfb\u53d6\u6700mới\u72b6\u6001，\u907f\u514d\u95ed\u5305trong splitScenes \u5c1a\u672a\u66f4mới\u5bfc\u81f4\u7d22\u5f15\u504f\u5dee
      const { activeProjectId, projects } = useDirectorStore.getState();
      const latestScenes = activeProjectId ? (projects[activeProjectId]?.splitScenes || []) : [];
      const updatedScene = latestScenes.find(s => s.id === angleSwitchTarget.sceneId);
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

      toast.success("Đã tạo chuyển góc thành công");
    } catch (error) {
      toast.error(`Chuyển góc thất bại: ${(error as Error).message}`);
    } finally {
      setIsAngleSwitching(false);
    }
  }, [angleSwitchTarget, splitScenes, getProviderByPlatform, addAngleSwitchHistory]);

  // Theo Th.ẻ cảm xúc\u751f\u6210bầu không khí\u63cf\u8ff0 - Sử dụng mô-đun xây dựng lời nhắc thống nhất
  const buildEmotionDescription = useCallback((emotionTags: EmotionTag[]): string => {
    return buildEmotionDesc(emotionTags);
  }, []);

  const getSceneCharacterContexts = useCallback((
    characterIds: string[],
    variationMap?: Record<string, string>,
  ): SceneCharacterContext[] => {
    if (!characterIds?.length) return [];

    const { characters } = useCharacterLibraryStore.getState();

    return characterIds.flatMap((characterId) => {
      const character = characters.find((item) => item.id === characterId);
      if (!character) return [];

      const variationId = variationMap?.[characterId];
      const selectedVariation = variationId
        ? character.variations?.find((variation) => variation.id === variationId)
        : undefined;

      const referenceImages: string[] = [];
      const seen = new Set<string>();
      const pushRef = (value?: string | null) => {
        if (!value || seen.has(value)) return;
        seen.add(value);
        referenceImages.push(value);
      };

      pushRef(character.thumbnailUrl);
      pushRef(selectedVariation?.referenceImage);

      for (const view of character.views || []) {
        pushRef(view.imageBase64 || view.imageUrl);
      }

      for (const image of character.referenceImages || []) {
        pushRef(image);
      }

      for (const image of selectedVariation?.clothingReferenceImages || []) {
        pushRef(image);
      }

      return [{
        characterId,
        name: character.name || 'Unnamed character',
        identityNotes: buildCharacterIdentityNotes(character, selectedVariation),
        referenceImages: referenceImages.slice(0, MAX_REFERENCE_IMAGES),
      }];
    });
  }, []);

  // \u6536đặt\u89d2\u8272Hình ảnh tham khảo\u7247 - \u5fc5\u987b\u5728 handleQuadGridGenerate \u4e4b\u524d\u5b9a\u4e49
  const getCharacterReferenceImages = useCallback((
    characterIds: string[],
    variationMap?: Record<string, string>,
  ): string[] => {
    const contexts = getSceneCharacterContexts(characterIds, variationMap);
    if (contexts.length === 0) return [];

    const refs: string[] = [];
    const seen = new Set<string>();

    const maxDepth = contexts.reduce((depth, context) => Math.max(depth, context.referenceImages.length), 0);

    for (let index = 0; index < maxDepth; index += 1) {
      for (const context of contexts) {
        const image = context.referenceImages[index];
        if (!image || seen.has(image)) continue;
        seen.add(image);
        refs.push(image);
        if (refs.length >= MAX_REFERENCE_IMAGES) {
          return refs;
        }
      }
    }

    return refs.slice(0, MAX_REFERENCE_IMAGES);
  }, [getSceneCharacterContexts]);

  const getSceneIdentityLockLines = useCallback((
    scene: SplitScene,
    model?: string,
    hasCharacterRefs?: boolean,
  ): string[] => {
    const contexts = getSceneCharacterContexts(scene.characterIds || [], scene.characterVariationMap);
    if (contexts.length === 0) return [];

    const lines: string[] = [];
    const castLine = buildSceneCharacterCastLine(contexts);
    const resolvedHasCharacterRefs = hasCharacterRefs ?? contexts.some((context) => context.referenceImages.length > 0);

    if (castLine) {
      lines.push(castLine);
    }

    const identityBlock = buildCharacterIdentityBlock(contexts);
    if (identityBlock) {
      lines.push(...identityBlock.split('\n'));
    }

    const priorityHint = buildReferencePriorityHint(model, resolvedHasCharacterRefs);
    if (priorityHint) {
      lines.push(priorityHint);
    }

    return lines;
  }, [getSceneCharacterContexts]);

  const buildPromptWithIdentityLock = useCallback((
    basePrompt: string,
    scene: SplitScene,
    model?: string,
    hasCharacterRefs?: boolean,
  ): string => {
    const prompt = basePrompt.trim();
    const identityLines = getSceneIdentityLockLines(scene, model, hasCharacterRefs);
    if (identityLines.length === 0) return prompt;

    return [prompt, identityLines.join('\n')].filter(Boolean).join('\n\n');
  }, [getSceneIdentityLockLines]);

  const processReferenceImagesForApi = useCallback(async (
    referenceImages: string[],
    logPrefix: string,
  ): Promise<string[]> => {
    const processedRefs: string[] = [];

    for (const url of referenceImages) {
      if (!url) continue;

      if (url.startsWith('http://') || url.startsWith('https://')) {
        processedRefs.push(url);
      } else if (url.startsWith('data:image/') && url.includes(';base64,')) {
        processedRefs.push(url);
      } else if (url.startsWith('local-image://')) {
        try {
          const base64 = await readImageAsBase64(url);
          if (base64 && base64.startsWith('data:image/') && base64.includes(';base64,')) {
            processedRefs.push(base64);
          }
        } catch (error) {
          console.warn(`${logPrefix} Failed to read local image:`, url, error);
        }
      }
    }

    return processedRefs;
  }, []);
  // Handle quad grid click
  const handleQuadGridClick = useCallback((sceneId: number, type: "start" | "end") => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    const imageUrl = type === "start"
      ? (scene.imageDataUrl || scene.imageHttpUrl)
      : (scene.endFrameImageUrl || scene.endFrameHttpUrl);
    if (!imageUrl) {
      toast.error(`Vui lòng tạo ${type === "start" ? "khung đầu" : "khung cuối"} trước`);
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
      toast.error("Không thể tìm thấy hình ảnh gốc");
      return;
    }

    // Get API key - sử dụng\u670d\u52a1\u6620\u5c04Cấu hình
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error('Vui lòng cấu hình API tạo ảnh trong Cài đặt trước');
      setQuadGridOpen(false);
      return;
    }
    
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      setQuadGridOpen(false);
      return;
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng cấu hình model tạo ảnh trong Cài đặt trước');
      setQuadGridOpen(false);
      return;
    }
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      setQuadGridOpen(false);
      return;
    }
    
    console.log('[QuadGrid] Using image config:', { platform, model, imageBaseUrl });

    setIsQuadGridGenerating(true);
    // \u4e0d\u5728\u8fd9\u91cc\u5173\u95ed\u5bf9\u8bdd\u6846，giữ\u6253\u5f00\u663e\u793a\u8fdb\u5ea6
    // setQuadGridOpen(false) \u79fbĐến\u751f\u6210\u6210\u529f\u540e

    try {
      // Build variation labels based on type
      const variationLabels = variationType === 'angle'
        ? ['chính diện lệch trái', 'chính diện lệch phải', 'cận cảnh nghiêng', 'toàn cảnh từ xa']
        : variationType === 'composition'
          ? ['toàn thân xa', 'bán thân trung', 'cận mặt', 'toàn cảnh môi trường']
          : ['bắt đầu hành động', 'diễn tiến hành động', 'cao trào hành động', 'kết thúc hành động'];

      const variationPrompts = variationType === 'angle'
        ? ['slight left angle view', 'slight right angle view', 'side profile close-up', 'wide aerial overview']
        : variationType === 'composition'
          ? ['full body wide shot', 'medium shot waist up', 'close-up face', 'establishing shot with environment']
          : ['action beginning', 'action in progress', 'action climax', 'action ending'];

      // Build base prompt from scene
      const basePrompt = scene.imagePromptZh?.trim() || scene.imagePrompt?.trim() || scene.videoPromptZh?.trim() || scene.videoPrompt?.trim() || '';
      const styleTokens = storyboardConfig.styleTokens || [];
      const aspect = storyboardConfig.aspectRatio || '9:16';
      const sceneCharacterContexts = getSceneCharacterContexts(scene.characterIds || [], scene.characterVariationMap);
      const sceneCharacterRefs = useCharacterRef
        ? getCharacterReferenceImages(scene.characterIds || [], scene.characterVariationMap)
        : [];
      const hasCharacterRefs = sceneCharacterContexts.some((context) => context.referenceImages.length > 0);

      // === nhân vật\u6570\u91cfkhoảng\u675f ===
      const charCount = scene.characterIds?.length || 0;
      let charCountPhrase = '';
      
      if (!useCharacterRef) {
        // \u65b9\u6848A (\u9ed8\u8ba4): tin tưởng\u539f\u56fe，Xóa\u5e72\u6270
        charCountPhrase = 'Keep the EXACT same number of characters and their positions as the reference image. Do NOT add or remove characters. Maintain the original character composition.';
      } else {
        // \u65b9\u6848B (\u52fe\u9009): sử dụng\u89d2\u8272\u5e93Tài liệu tham khảo，\u4fdd\u7559\u786c\u6027\u4eba\u6570\u9650\u5236
        charCountPhrase = charCount === 0 
          ? 'NO human figures in any panel, empty scene or environment only.' 
          : charCount === 1 
            ? 'EXACTLY ONE person in each panel, single character only, do NOT duplicate the character.'
            : `EXACTLY ${charCount} distinct people in each panel, no more no less, each person appears only ONCE.`;
      }

      // === \u7ad6\u5c4fthành phầnkhoảng\u675f（vớichíncung điện\u683cmột\u81f4） ===
      const verticalConstraint = aspect === '9:16' ? 'vertical composition, tighter framing, avoid letterboxing, ' : '';

      // === \u52a8\u4f5c\u63cf\u8ff0（\u5bf9\u65f6\u523bthay đổi\u4f53quan trọng） ===
      const actionDesc = scene.actionSummary?.trim() || '';
      const actionContext = (variationType === 'moment' && actionDesc) 
        ? `Action sequence context: ${actionDesc}. ` 
        : '';

      // === cảm xúcbầu không khí（giữmột\u81f4\u6027） ===
      const emotionDesc = buildEmotionDescription(scene.emotionTags || []);
      const moodContext = emotionDesc ? `Mood across all panels: ${emotionDesc} ` : '';

      // === \u573a\u666f\u4e0a\u4e0b\u6587 ===
      const sceneContext = [scene.sceneName, scene.sceneLocation].filter(Boolean).join(' - ');
      const settingContext = sceneContext ? `Setting: ${sceneContext}. ` : '';

      // === gió\u683c\u952etừ\u7ec4 ===
      const styleStr = styleTokens.length > 0 ? `Artistic style consistent: ${styleTokens.join(', ')}. ` : '';

      // Build 2x2 grid prompt
      const gridPromptParts: string[] = [];
      gridPromptParts.push('Generate a 2x2 grid image with 4 panels, each panel separated by thin white lines.');
      gridPromptParts.push('Layout: 2 rows, 2 columns, reading order left-to-right, top-to-bottom.');
      
      // \u6bcfmột\u9762\u677fcủa\u63cf\u8ff0（chứanhân vật\u6570\u91cfkhoảng\u675f）
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

      const gridPrompt = buildPromptWithIdentityLock(gridPromptParts.join(' '), scene, model, hasCharacterRefs);
      console.log('[QuadGrid] Grid prompt:', gridPrompt.substring(0, 200) + '...');

      const optimizedRefs = optimizeReferenceImagesForModel(model, [
        { kind: 'anchor', images: [sourceImage] },
        { kind: 'character', images: sceneCharacterRefs },
        { kind: 'scene', images: scene.sceneReferenceImage ? [scene.sceneReferenceImage] : [] },
      ]);
      const apiReferenceImages = await processReferenceImagesForApi(optimizedRefs, '[QuadGrid]');

      // Collect reference images
      const refs: string[] = [sourceImage];
      // \u53eaCó\u5728\u52fe\u9009\u4e86"Tài liệu tham khảo\u89d2\u8272\u5e93\u5f62\u8c61"\u65f6，\u624d\u6dfb\u52a0\u89d2\u8272Hình ảnh tham khảo
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
        referenceImages: apiReferenceImages.length > 0
          ? apiReferenceImages
          : (processedRefs.length > 0 ? processedRefs : undefined),
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
          
          if (!statusResp.ok) throw new Error(`Truy vấnNhiệm vụ\u5931\u8d25: ${statusResp.status}`);
          
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
            throw new Error(statusData.error || 'Tạo ảnh thất bại');
          }
          
          await new Promise(r => setTimeout(r, pollInterval));
        }
      }

      if (!gridImageUrl) {
        throw new Error('Không lấy được URL ảnh lưới 2x2');
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
        img.onerror = () => reject(new Error('Tải ảnh lưới 2x2 thất bại'));
        img.src = gridImageUrl!;
      });

      console.log('[QuadGrid] Sliced into', slicedImages.length, 'images');

      // Set result
      setQuadGridResult({
        originalImage: sourceImage,
        images: slicedImages,
        variationType: variationType === 'angle' ? 'biến thể góc máy' : variationType === 'composition' ? 'biến thể bố cục' : 'biến thể khoảnh khắc',
        variationLabels,
      });
      
      // \u81ea\u52a8\u4fdd\u5b58\u6240Cóbốncung điện\u683c\u56fe\u7247ĐếnChất liệu\u5e93
      const folderId = getImageFolderId();
      const variationTypeLabel = variationType === 'angle' ? 'biến thể góc máy' : variationType === 'composition' ? 'biến thể bố cục' : 'biến thể khoảnh khắc';
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
      
      // \u751f\u6210\u6210\u529f\u540e\u624d\u5173\u95ed\u9009\u62e9\u5bf9\u8bdd\u6846，\u6253\u5f00kết quả\u5bf9\u8bdd\u6846
      setQuadGridOpen(false);
      setQuadGridResultOpen(true);
      toast.success('Đã tạo lưới 2x2 thành công và tự động lưu vào thư viện');

    } catch (error) {
      const err = error as Error;
      console.error('[QuadGrid] Failed:', err);
      toast.error(`Tạo lưới 2x2 thất bại: ${err.message}`);
    } finally {
      setIsQuadGridGenerating(false);
    }
  }, [
    quadGridTarget,
    splitScenes,
    storyboardConfig,
    buildEmotionDescription,
    getSceneCharacterContexts,
    getCharacterReferenceImages,
    buildPromptWithIdentityLock,
    processReferenceImagesForApi,
    getImageFolderId,
    addMediaFromUrl,
    mediaProjectId,
  ]);

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
    toast.success(`Đã áp dụng vào ${quadGridTarget.type === "start" ? "khung đầu" : "khung cuối"}`);
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

    toast.success(`Đã sao chép vào phân cảnh ${targetSceneId + 1} (${targetFrameType === "start" ? "khung đầu" : "khung cuối"})`);
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

    toast.success('Đã lưu vào thư viện');
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

    toast.success(`Đã lưu ${quadGridResult.images.length} ảnh vào thư viện`);
  }, [quadGridResult, getImageFolderId, addMediaFromUrl]);

  // Apply angle switch result
  const handleApplyAngleSwitch = useCallback(async () => {
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
    toast.success("Đã áp dụng góc quay");
  }, [angleSwitchResult, angleSwitchTarget, splitScenes, selectedHistoryIndex, updateSplitSceneImage, updateSplitSceneEndFrame]);

  // Handle auto-generate prompts using Gemini Vision
  const handleAutoGeneratePrompts = useCallback(async () => {
    if (!storyboardImage || splitScenes.length === 0) {
      toast.error("Không thể tạo prompt: thiếu storyboard hoặc phân cảnh");
      return;
    }

    // \u5c1d\u8bd5\u83b7\u53d6\u56fe\u7247\u7406\u89e3Cấu hình（\u4ec5\u5f53một phần\u5206\u955cthiếu\u5c11\u6587từ\u63cf\u8ff0chỉ cần thiết）
    const featureConfig = getFeatureConfig('image_understanding');
    const apiKey = featureConfig?.apiKey || '';
    const provider = featureConfig?.platform || '';
    const model = featureConfig?.models?.[0] || '';
    const baseUrl = featureConfig?.baseUrl?.replace(/\/+$/, '') || '';
    // Note: API config is optional - if scenes have text descriptions, no API is needed

    setIsGeneratingPrompts(true);
    toast.info("Đang tạo prompt dựa trên nội dung phân cảnh...");

    try {
      // Get story prompt from storyboard config
      const storyPrompt = storyboardConfig.storyPrompt || "video phân cảnh";

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

      toast.success(`Đã tạo prompt cho ${updatedCount} phân cảnh (${endFrameCount} cảnh cần khung cuối)`);
    } catch (error) {
      const err = error as Error;
      console.error("[SplitScenes] Prompt generation failed:", err);
      toast.error(`Tạo thất bại: ${err.message}`);
    } finally {
      setIsGeneratingPrompts(false);
    }
  }, [storyboardImage, splitScenes, storyboardConfig, getApiKey, updateSplitSceneImagePrompt, updateSplitSceneVideoPrompt, updateSplitSceneEndFramePrompt, updateSplitSceneNeedsEndFrame]);


  // Generate video for a single scene - directly calls API with key rotation
  const handleGenerateSingleVideo = useCallback(async (sceneId: number) => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Debug: Check API store state
    const apiStore = useAPIConfigStore.getState();
    if (process.env.NODE_ENV === 'development') {
      console.log('[SplitScenes] API Store state:', {
        providers: apiStore.providers.length,
        apiKeys: Object.keys(apiStore.apiKeys),
        memefastKey: apiStore.apiKeys['memefast'] ? 'set' : 'not set',
        getApiKey_memefast: apiStore.getApiKey('memefast') ? 'set' : 'not set',
      });
    }

    // Use feature router with key rotation support
    const featureConfig = getFeatureConfig('video_generation');
    if (process.env.NODE_ENV === 'development') {
      console.log('[SplitScenes] Feature config for video_generation:', featureConfig ? {
        platform: featureConfig.platform,
        model: featureConfig.models?.[0],
        apiKey: featureConfig.apiKey ? `${featureConfig.apiKey.substring(0, 8)}...` : 'empty',
        providerId: featureConfig.provider?.id,
      } : 'null');
    }
    
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('video_generation'));
      return;
    }
    
    // từ\u670d\u52a1\u6620\u5c04\u83b7\u53d6 platform và model
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng cấu hình model tạo video trong Cài đặt trước');
      return;
    }
    const videoBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!videoBaseUrl) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo video trong Cài đặt trước');
      return;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[SplitScenes] Using video config:', { platform, model, videoBaseUrl });
    }
    
    // Get rotating key from manager
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error(`Vui lòng cấu hình API Key cho ${platform}`);
      return;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SplitScenes] Using API key ${keyManager.getTotalKeyCount()} keys, current index available: ${keyManager.getAvailableKeyCount()}`);
    }

    setIsGenerating(true);
    setCurrentGeneratingId(sceneId);

    // \u521b\u5efa\u672clần\u89c6\u9891\u751f\u6210của AbortController，\u505c\u6b62\u6309\u94ae\u53ef\u901a\u8fc7 videoAbortRef.current.abort() \u53d6\u6d88
    const videoController = new AbortController();
    videoAbortRef.current = videoController;

    try {
      // Reset and start
      updateSplitSceneVideo(sceneId, {
        videoStatus: 'uploading',
        videoProgress: 0,
        videoError: null,
        videoUrl: null,
      });

      // khung hình đầu tiêđồ thị n\u7247\u9009\u62e9\u903b\u8f91：
      // 1. Chẳng hạn như\u679c\u672c\u5730\u6301\u4e45\u5316\u56fe\u7247\u5b58\u5728\u4e14được cấu hình\u56fegiường，\u59cb\u7ec8Ưu tiênsử dụng\u672c\u5730\u56fe\u91cdmới\u4e0a\u4f20Đếnhiện tại\u56fegiường
      // 2. KHÔNG\u5219\u4ec5\u5728 imageSource === 'ai-generated' \u4e14Đã rồiCóCó sẵn HTTP URL \u65f6\u590dsử dụng\u8be5 URL
      // 3. Phần còn lại\u60c5\u51b5sử dụng imageDataUrl，\u5e76\u5728\u540e\u7eed\u8f6c\u6362cho HTTP URL
      let firstFrameUrl = scene.imageDataUrl || (isHttpImageUrl(scene.imageHttpUrl) ? scene.imageHttpUrl : '');
      const hasValidHttpUrl = isHttpImageUrl(scene.imageHttpUrl);
      const shouldRefreshFirstFrame = shouldRefreshImageViaCurrentHost(scene.imageDataUrl);

      if (isLocalImageSource(scene.imageDataUrl)) {
        if (shouldRefreshFirstFrame) {
          if (hasValidHttpUrl) {
            console.log(
              `[SplitScenes] Using local first frame and refreshing via configured image host${isDiscouragedExternalImageUrl(scene.imageHttpUrl) ? ' (skipping discouraged external URL)' : ''}:`,
              scene.imageHttpUrl!.substring(0, 60)
            );
          } else {
            console.log('[SplitScenes] Using local first frame and uploading to configured image host');
          }
          firstFrameUrl = scene.imageDataUrl;
        } else if (hasValidHttpUrl && scene.imageSource === 'ai-generated') {
          // \u6ca1CóCó sẵn\u56fegiường\u65f6，\u624d\u56de\u9000ĐếnĐã rồiCócủa HTTP URL
          console.log('[SplitScenes] Using imageHttpUrl for AI-generated image:', scene.imageHttpUrl!.substring(0, 60));
          firstFrameUrl = scene.imageHttpUrl!;
        } else {
          console.log(
            '[SplitScenes] Using imageDataUrl (will upload to image host):',
            hasValidHttpUrl ? 'has old httpUrl but imageSource=' + scene.imageSource : 'no valid httpUrl'
          );
        }
      }
      
      if (!firstFrameUrl) {
        toast.error(`Phân cảnh ${sceneId + 1} chưa có khung đầu, vui lòng tạo ảnh trước`);
        setIsGenerating(false);
        setCurrentGeneratingId(null);
        return;
      }
      console.log('[SplitScenes] First frame source:', firstFrameUrl.startsWith('http') ? 'HTTP URL' : 'local/base64');
      
      // Chỉ khi cầnEndFrame cho true \u65f6\u624dsử dụng\u5c3e\u5e27
      // Chẳng hạn như\u679csử dụng\u6237Đã rồi\u5220\u9664\u5c3e\u5e27hoặc\u5173\u95ed\u4e86\u5c3e\u5e27\u5f00\u5173，\u5219\u4e0dsử dụng\u5c3e\u5e27\u4f5ccho\u89c6\u9891\u751f\u6210Tài liệu tham khảo
      let lastFrameUrl: string | null | undefined = null;
      if (scene.needsEndFrame && (scene.endFrameImageUrl || scene.endFrameHttpUrl)) {
        const shouldRefreshEndFrame = shouldRefreshImageViaCurrentHost(scene.endFrameImageUrl);
        if (shouldRefreshEndFrame && scene.endFrameImageUrl) {
          lastFrameUrl = scene.endFrameImageUrl;
          console.log(
            `[SplitScenes] Using local end frame and refreshing via configured image host${isDiscouragedExternalImageUrl(scene.endFrameHttpUrl) ? ' (skipping discouraged external URL)' : ''}`
          );
        } else {
          lastFrameUrl = scene.endFrameImageUrl || scene.endFrameHttpUrl;
          console.log('[SplitScenes] Using end frame for video generation');
        }
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

      // ========== \u6784\u5efa\u89c6\u9891\u63d0\u793a\u8bcd（sử dụng\u7edfmột prompt-builder \u6a21\u5757） ==========
      const cinProfile = projectData?.cinematographyProfileId
        ? getCinematographyProfile(projectData.cinematographyProfileId)
        : undefined;
      
      const fullPrompt = buildVideoPrompt(scene, cinProfile, {
        styleTokens: [getStylePrompt(currentStyleId)],
        aspectRatio: storyboardConfig.aspectRatio,
        mediaType: getMediaType(currentStyleId),
      });
      
      // sử dụngsử dụng\u6237\u8bbe\u7f6ecủa\u65f6\u957f，\u9ed8\u8ba4 5 giây
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

      // Convert local/base64 image to HTTP URL for API
      // Video API requires HTTP URLs, not base64
      const convertToHttpUrl = async (
        rawUrl: any,
        options?: { localFallback?: string | null; frameLabel?: string }
      ): Promise<string> => {
        const url = normalizeUrl(rawUrl);
        const localFallback = normalizeUrl(options?.localFallback);
        const frameLabel = options?.frameLabel || 'Frame';
        if (!url) {
          console.warn('[SplitScenes] convertToHttpUrl received invalid url:', rawUrl);
          return '';
        }
        
        // Already HTTP URL - use directly
        if (isHttpImageUrl(url)) {
          if (shouldRefreshImageViaCurrentHost(localFallback)) {
            console.log(
              `[SplitScenes] ${frameLabel}: refreshing via configured image host instead of reusing existing HTTP URL${isDiscouragedExternalImageUrl(url) ? ' (discouraged external host)' : ''}:`,
              url.substring(0, 60)
            );
            return convertToHttpUrl(localFallback, { frameLabel });
          }
          if (isDiscouragedExternalImageUrl(url)) {
            console.warn(`[SplitScenes] ${frameLabel}: using discouraged external URL because no local fallback is available:`, url.substring(0, 60));
          } else {
            console.log('[SplitScenes] Using existing HTTP URL:', url.substring(0, 60));
          }
          return url;
        }
        
        // For base64 or local images, we need to upload to image host
        try {
          // Check if image host is configured
          if (!isImageHostConfigured()) {
            console.warn('[SplitScenes] Image host not configured. Please configure an image host in settings.');
            throw new Error('Image host chưa được cấu hình, vui lòng thiết lập Catbox hoặc dịch vụ tương đương trong Cài đặt');
          }
          
          let imageData = url;
          
          // For local-image:// protocol, read the image first
          if (url.startsWith('local-image://')) {
            const fullBase64 = await readImageAsBase64(url);
            if (!fullBase64) {
              console.warn('[SplitScenes] Failed to read local image:', url);
              return '';
            }
            imageData = fullBase64;
          }
          
          // Upload to configured image host
          console.log('[SplitScenes] Uploading image to image host...');
          const uploadResult = await uploadToImageHost(imageData, {
            name: `scene_${sceneId}_frame_${Date.now()}`,
            expiration: 15552000, // 180 days
          });
          
          if (uploadResult.success && uploadResult.url) {
            console.log('[SplitScenes] Uploaded image to image host:', uploadResult.url.substring(0, 60));
            return uploadResult.url;
          } else {
            console.warn('[SplitScenes] Image upload failed:', uploadResult.error);
            throw new Error(uploadResult.error || 'Tải ảnh lên thất bại');
          }
        } catch (e) {
          console.warn('[SplitScenes] Failed to upload image:', e);
          throw e;
        }
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
      
      const firstFrameConverted = await convertToHttpUrl(normalizedFirstFrame, {
        localFallback: scene.imageDataUrl,
        frameLabel: 'First frame',
      });
      if (!firstFrameConverted) {
        throw new Error('không có\u6cd5\u83b7\u53d6khung hình đầu tiêđồ thị n\u7247của HTTP URL，\u8bf7\u91cdmới\u751f\u6210\u56fe\u7247');
      }
      imageWithRoles.push({ url: firstFrameConverted, role: 'first_frame' });
      console.log('[SplitScenes] First frame HTTP URL:', firstFrameConverted.substring(0, 60));

      // Last frame (optional)
      if (lastFrameUrl) {
        const lastFrameConverted = await convertToHttpUrl(lastFrameUrl, {
          localFallback: scene.endFrameImageUrl,
          frameLabel: 'Last frame',
        });
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

      // \u8c03sử dụng\u7edfmột\u89c6\u9891\u751f\u6210 API（Tự động định tuyến đến điểm cuối MemeFast chính xác）
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
        undefined,  // videoRefs
        undefined,  // audioRefs
        undefined,  // enableAudio
        undefined,  // cameraFixed
        videoController.signal,
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
      toast.success(`Phân cảnh ${sceneId + 1} tạo video thành công và đã lưu vào thư viện`);
      
      // tính liên tục về mặt thị giác：\u4ec5\u5f53\u5206\u955c\u9700\u8981\u5c3e\u5e27\u65f6，Trích xuất\u89c6\u9891\u6700\u540emột\u5e27
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
            
            // \u6301\u4e45\u5316Đến\u672c\u5730\u6587\u4ef6\u7cfb\u7edf（local-image://），Tránh base64 bị xóa bằng cách phân chia một phần
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

      // sử dụng\u6237Chúa ơi\u52a8\u53d6\u6d88：abort() \u89e6\u53d1của AbortError hoặc\u81ea\u5b9a\u4e49 'sử dụng\u6237Đã rồi\u53d6\u6d88'
      if (err.name === 'AbortError' || err.message === 'Người dùng đã hủy') {
        console.log(`[SplitScenes] Scene ${sceneId} video generation cancelled by user`);
        setIsGenerating(false);
        setCurrentGeneratingId(null);
        return;
      }

      console.error(`[SplitScenes] Scene ${sceneId} video generation failed:`, err);

      // Phát hiệnĐúngKHÔNGchobên trong\u5bb9\u5ba1\u6838\u9519\u8bef
      const isModerationError = isContentModerationError(err);
      
      if (isModerationError) {
        // bên trong\u5bb9\u5ba1\u6838\u9519\u8bef，Đánh dấu bằng MODERATION_SKIPPED: tiền tố
        updateSplitSceneVideo(sceneId, {
          videoStatus: 'failed',
          videoProgress: 0,
          videoError: `MODERATION_SKIPPED:${err.message}`,
        });
        toast.warning(`Phân cảnh ${sceneId + 1} bị bỏ qua do kiểm duyệt nội dung`);
        console.log(`[SplitScenes] Scene ${sceneId} skipped due to content moderation`);
      } else {
        // bình thường\u9519\u8bef
        updateSplitSceneVideo(sceneId, {
          videoStatus: 'failed',
          videoProgress: 0,
          videoError: err.message,
        });
        toast.error(`Phân cảnh ${sceneId + 1} tạo thất bại: ${err.message}`);
      }
    }

    setIsGenerating(false);
    setCurrentGeneratingId(null);
  }, [splitScenes, storyboardConfig, getApiKey, updateSplitSceneVideo, autoSaveVideoToLibrary, buildEmotionDescription, getCharacterReferenceImages]);

  // Handle generate videos - serial processing based on concurrency
  // \u590dsử dụng handleGenerateSingleVideo của\u7edfmột API \u8c03sử dụng\u903b\u8f91，\u907f\u514dsử dụng\u4e0d\u5b58\u5728của /api/ai/video \u7aef\u70b9
  const handleGenerateVideos = useCallback(async () => {
    if (splitScenes.length === 0) {
      toast.error("Không có phân cảnh nào để tạo");
      return;
    }

    const featureConfig = getFeatureConfig('video_generation');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('video_generation'));
      return;
    }

    // Check if all scenes have prompts
    const scenesWithoutPrompts = splitScenes.filter(
      s => !(s.videoPromptZh?.trim() || s.videoPrompt?.trim())
    );
    if (scenesWithoutPrompts.length > 0) {
      toast.warning(`Còn ${scenesWithoutPrompts.length} phân cảnh chưa có prompt, hệ thống sẽ dùng prompt mặc định`);
    }

    // Filter scenes that need generation (idle or failed)
    const scenesToGenerate = splitScenes.filter(
      s => s.videoStatus === 'idle' || s.videoStatus === 'failed'
    );

    if (scenesToGenerate.length === 0) {
      toast.info("Tất cả phân cảnh đã tạo xong hoặc đang được tạo");
      return;
    }

    setIsGenerating(true);
    toast.info(`Bắt đầu tạo hàng loạt ${scenesToGenerate.length} video... mỗi lần xử lý ${concurrency} cảnh`);

    let successCount = 0;
    const totalCount = scenesToGenerate.length;

    // Process scenes sequentially (serial) or with limited concurrency
    // \u9010một\u8c03sử dụng handleGenerateSingleVideo，\u590dsử dụng\u5176\u5b8c\u6574của API \u8c03sử dụng\u903b\u8f91
    for (let i = 0; i < scenesToGenerate.length; i += concurrency) {
      const batch = scenesToGenerate.slice(i, i + concurrency);
      
      await Promise.all(batch.map(async (scene) => {
        try {
          await handleGenerateSingleVideo(scene.id);
          successCount++;
        } catch (error) {
          // handleGenerateSingleVideo bên trong\u90e8Đã rồi\u5904\u7406\u9519\u8befvà toast，\u8fd9\u91cc\u4ec5\u505a\u8ba1\u6570
          console.error(`[SplitScenes] Batch: Scene ${scene.id} video generation failed:`, error);
        }
      }));
    }

    setIsGenerating(false);
    setCurrentGeneratingId(null);
    
    if (successCount === totalCount) {
      toast.success("Tất cả video đã tạo thành công!");
    } else if (successCount > 0) {
      toast.info(`${successCount}/${totalCount} video đã tạo thành công, ${totalCount - successCount} video thất bại`);
    }
  }, [splitScenes, concurrency, handleGenerateSingleVideo]);

  // Generate image for a single scene using image API
  const handleGenerateSingleImage = useCallback(async (sceneId: number) => {
    const scene = splitScenes.find(s => s.id === sceneId);
    if (!scene) return;

    // sử dụng\u670d\u52a1\u6620\u5c04Cấu hình - \u4e0dMột lần nữa fallback Đến\u786c\u7f16\u7801
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      return;
    }
    
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      return;
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng cấu hình model tạo ảnh trong Cài đặt trước');
      return;
    }
    
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      return;
    }
    
    console.log('[SingleImage] Using config:', { platform, model, imageBaseUrl });

    // Need a prompt to generate - prefer imagePromptZh (first frame static), fallback to videoPromptZh
    const promptToUse = scene.imagePromptZh?.trim() || scene.imagePrompt?.trim() 
      || scene.videoPromptZh?.trim() || scene.videoPrompt?.trim() || '';
    if (!promptToUse) {
      toast.warning("Vui lòng nhập prompt khung đầu trước rồi tạo lại ảnh");
      return;
    }

    setIsGenerating(true);
    // \u521b\u5efa\u672clần\u751f\u6210của AbortController，\u505c\u6b62\u6309\u94ae\u53ef\u901a\u8fc7 imageAbortRef.current.abort() \u53d6\u6d88
    const imageController = new AbortController();
    imageAbortRef.current = imageController;
    const imageSignal = imageController.signal;

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
      const sceneCharacterContexts = getSceneCharacterContexts(scene.characterIds || [], scene.characterVariationMap);
      const sceneCharacterRefs = getCharacterReferenceImages(scene.characterIds || [], scene.characterVariationMap);
      const fallbackCharacterRefs = sceneCharacterContexts.length === 0
        ? (storyboardConfig.characterReferenceImages || [])
        : [];
      const hasCharacterRefs = sceneCharacterRefs.length > 0;
      enhancedPrompt = buildPromptWithIdentityLock(enhancedPrompt, scene, model, hasCharacterRefs);

      // Collect reference images: scene background > characters > storyboard style
      const referenceImages: string[] = [];
      
      // 1. \u9996đầu tiên\u6dfb\u52a0\u573a\u666f\u80cc\u666fHình ảnh tham khảo（quan trọng nhất）
      if (scene.sceneReferenceImage) {
        referenceImages.push(scene.sceneReferenceImage);
        console.log('[SplitScenes] Using scene background reference');
      }
      
      // 2. \u6dfb\u52a0\u89d2\u8272Hình ảnh tham khảo
      if (scene.characterIds && scene.characterIds.length > 0) {
        const sceneCharRefs = getCharacterReferenceImages(scene.characterIds, scene.characterVariationMap);
        referenceImages.push(...sceneCharRefs);
      } else if (storyboardConfig.characterReferenceImages && storyboardConfig.characterReferenceImages.length > 0) {
        // Fallback to storyboardConfig characters
        referenceImages.push(...storyboardConfig.characterReferenceImages);
      }
      
      // 3. \u6dfb\u52a0nguyên bản\u5206\u955c\u56fe\u4f5cchogió\u683cTài liệu tham khảo
      if (storyboardImage) {
        referenceImages.push(storyboardImage);
      }

      const optimizedReferenceImages = optimizeReferenceImagesForModel(model, [
        { kind: 'scene', images: scene.sceneReferenceImage ? [scene.sceneReferenceImage] : [] },
        { kind: 'character', images: sceneCharacterRefs.length > 0 ? sceneCharacterRefs : fallbackCharacterRefs },
        { kind: 'style', images: storyboardImage ? [storyboardImage] : [] },
      ]);
      const apiReferenceImages = await processReferenceImagesForApi(optimizedReferenceImages, '[SingleImage]');

      console.log('[SplitScenes] Generating image:', {
        sceneId,
        prompt: enhancedPrompt.substring(0, 100),
        characterRefCount: optimizedReferenceImages.length,
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
        referenceImages: apiReferenceImages.length > 0
          ? apiReferenceImages
          : (processedRefs.length > 0 ? processedRefs : undefined),
        keyManager,
        signal: imageSignal,
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
        updateSplitSceneImage(sceneId, persistResult.localPath, scene.width, scene.height, persistResult.httpUrl || undefined);
        autoSaveImageToLibrary(sceneId, persistResult.localPath);
        toast.success(`Phân cảnh ${sceneId + 1} tạo ảnh thành công và đã lưu vào thư viện`);
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
            signal: imageSignal,
          });

          if (!statusResponse.ok) {
            if (statusResponse.status === 404) {
              throw new Error('Nhiệm vụ không tồn tại');
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

            if (!imageUrl) throw new Error('Nhiệm vụ hoàn thành nhưng không có URL ảnh');
            
            // \u6301\u4e45\u5316Đến\u672c\u5730 + \u56fegiường
            const persistResult = await persistSceneImage(imageUrl, sceneId, 'first');
            updateSplitSceneImage(sceneId, persistResult.localPath, scene.width, scene.height, persistResult.httpUrl || undefined);
            autoSaveImageToLibrary(sceneId, persistResult.localPath);
            toast.success(`Phân cảnh ${sceneId + 1} tạo ảnh thành công và đã lưu vào thư viện`);
            setIsGenerating(false);
            return;
          }

          if (status === 'failed' || status === 'error') {
            const errorMsg = statusData.error || statusData.message || statusData.data?.error || 'Tạo ảnh thất bại';
            console.error('[SplitScenes] Task failed:', statusData);
            throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
          }

          await new Promise<void>((resolve, reject) => {
            const tid = setTimeout(resolve, pollInterval);
            imageSignal.addEventListener('abort', () => { clearTimeout(tid); reject(new Error('Người dùng đã hủy')); }, { once: true });
          });
        }
        throw new Error('Tạo ảnh quá thời gian chờ');
      }

      throw new Error('Invalid API response: no image URL or task ID');
    } catch (error) {
      const err = error as Error;

      // sử dụng\u6237Chúa ơi\u52a8\u53d6\u6d88：abort() \u89e6\u53d1của AbortError hoặc\u81ea\u5b9a\u4e49 'sử dụng\u6237Đã rồi\u53d6\u6d88'
      if (err.name === 'AbortError' || err.message === 'Người dùng đã hủy') {
        console.log(`[SplitScenes] Scene ${sceneId} image generation cancelled by user`);
        setIsGenerating(false);
        return;
      }

      console.error(`[SplitScenes] Scene ${sceneId} image generation failed:`, err);
      updateSplitSceneImageStatus(sceneId, {
        imageStatus: 'failed',
        imageProgress: 0,
        imageError: err.message,
      });
      toast.error(`Phân cảnh ${sceneId + 1} tạo ảnh thất bại: ${err.message}`);
    }

    setIsGenerating(false);
  }, [
    splitScenes,
    storyboardConfig,
    storyboardImage,
    currentStyleId,
    updateSplitSceneImage,
    updateSplitSceneImageStatus,
    autoSaveImageToLibrary,
    getSceneCharacterContexts,
    getCharacterReferenceImages,
    buildPromptWithIdentityLock,
    processReferenceImagesForApi,
  ]);

  // ===== Utilities for \u5408\u5e76\u751f\u6210（chíncung điện\u683c） =====
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
    // lực lượng\u7981\u6b62\u751f\u6210\u6587từ，\u9632\u6b62\u51fa\u73b0\u5bf9\u8bdd\u6c14\u6ce1、phụ đềĐợi đã
    const noTextConstraint = 'IMPORTANT: NO TEXT, NO WORDS, NO LETTERS, NO CAPTIONS, NO SPEECH BUBBLES, NO DIALOGUE BOXES, NO SUBTITLES, NO WRITING of any kind.';
    return `${style}Keep character appearance, wardrobe and facial features consistent. Keep lighting and color grading consistent. ${noTextConstraint}`;
  };

  const composeTilePrompt = (scene: SplitScene, angle: Angle, aspect: '16:9'|'9:16', styleTokens?: string[]) => {
    const base = scene.imagePromptZh?.trim() || scene.imagePrompt?.trim() || scene.videoPromptZh?.trim() || scene.videoPrompt?.trim() || '';
    const shot = allowedShotFromSize(scene.shotSize);
    const vertical = aspect === '9:16' ? 'vertical composition, tighter framing, avoid letterboxing, ' : '';
    // \u7981sử dụng\u76f8\u673acác môn thể thaovới\u8282\u594f，\u4ec5\u4fdd\u7559\u89c6\u89d2/\u666f\u522b/thành phần
    const cameraPart = `${angle}, ${shot}`;
    const anchor = buildAnchorPhrase(styleTokens);
    const style = styleTokens && styleTokens.length > 0 ? ` Style: ${styleTokens.join(', ')}` : '';
    
    // nhân vật\u6570\u91cfkhoảng\u675f：\u6839\u636e characterIds \u6570\u91cf\u660e\u786e\u6307\u5b9a，\u9632\u6b62\u6a21\u578b\u751f\u6210\u591a\u4f59nhân vật
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
      toast.error('Không có phân cảnh nào để tạo');
      return;
    }

    // \u83b7\u53d6\u56fe\u50cf\u751f\u6210khả năng - sử dụng\u670d\u52a1\u6620\u5c04Cấu hình
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      return;
    }
    
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      return;
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng cấu hình model tạo ảnh trong Cài đặt trước');
      return;
    }
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      return;
    }
    
    console.log('[MergedGen] Using config:', { platform, model, imageBaseUrl });

    setIsMergedRunning(true);
    mergedAbortRef.current = false; // \u91cd\u7f6e\u505c\u6b62biểu tượng
    console.log('[MergedGen] \u5f00\u59cbchíncung điện\u683c\u5408\u5e76\u751f\u6210, mode:', mode, 'strategy:', strategy, 'exemplar:', exemplar);

    const aspect = storyboardConfig.aspectRatio || '9:16';
    const styleTokens = storyboardConfig.styleTokens || [];
    // \u59cb\u7ec8sử dụng getStylePrompt \u83b7\u53d6\u5b8c\u6574gió\u683c\u63d0\u793a\u8bcd（\u4fdd\u8bc1Có\u9ed8\u8ba4\u503c，\u5373\u4f7f styleTokens cho\u7a7a）
    const fullStylePrompt = getStylePrompt(currentStyleId);
    const fullStyleNegative = getStyleNegativePrompt(currentStyleId);
    const dedup = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

    // === \u7edfmộtNhiệm vụdanh sách\u65b9\u6848：\u652f\u6301\u6df7\u5408chíncung điện\u683c ===
    // Nhiệm vụ\u7c7b\u578b\u5b9a\u4e49
    type GridTask = { scene: SplitScene; type: 'first' | 'end' };
    
    // quan trọng：\u89c6\u9891Đã rồi\u751f\u6210của\u5206\u955c\u89c6choHoàn thành，\u4e0d\u9700\u8981Một lần nữa\u751f\u6210khung hình đầu tiênhoặc\u5c3e\u5e27
    const isSceneCompleted = (s: SplitScene) => s.videoUrl || s.videoStatus === 'completed';

    // \u6784\u5efaNhiệm vụdanh sách（\u6839\u636esử dụng\u6237\u9009\u62e9của mode）
    const tasks: GridTask[] = [];
    for (const scene of splitScenes) {
      if (isSceneCompleted(scene)) continue; // \u89c6\u9891Đã rồiHoàn thành，bỏ qua
      
      // \u4ec5khung hình đầu tiên hoặc \u9996+\u5c3e：\u68c0\u67e5ĐúngKHÔNG\u9700\u8981khung hình đầu tiên
      if ((mode === 'first' || mode === 'both') && !scene.imageDataUrl) {
        tasks.push({ scene, type: 'first' });
      }
      
      // \u4ec5\u5c3e\u5e27 hoặc \u9996+\u5c3e：\u68c0\u67e5Liệu khung hình cuối cùng có cần thiết hay không
      if ((mode === 'last' || mode === 'both') && scene.needsEndFrame && !scene.endFrameImageUrl) {
        tasks.push({ scene, type: 'end' });
      }
    }

    // \u68c0\u67e5ĐúngKHÔNGCó\u9700\u8981\u751f\u6210của
    if (tasks.length === 0) {
      toast.info('Tất cả phân cảnh đã tạo xong, không cần tạo lại');
      setIsMergedRunning(false);
      return;
    }

    // \u7edf\u8ba1thông tin
    const firstCount = tasks.filter(t => t.type === 'first').length;
    const endCount = tasks.filter(t => t.type === 'end').length;
    const parts: string[] = [];
    if (firstCount > 0) parts.push(`${firstCount} khung đầu`);
    if (endCount > 0) parts.push(`${endCount} khung cuối`);
    const completedCount = splitScenes.filter(isSceneCompleted).length;
    const skipInfo = completedCount > 0 ? ` (bỏ qua ${completedCount} cảnh đã có video)` : '';
    toast.info(`Bắt đầu tạo gộp lưới 3x3: ${parts.join(', ')}${skipInfo}`);

    // Nhiệm vụPhân trang（\u6bcf9mộtNhiệm vụmột\u9875，\u6df7\u5408khung hình đầu tiênvà\u5c3e\u5e27）
    const taskPages: GridTask[][] = [];
    for (let i = 0; i < tasks.length; i += 9) {
      taskPages.push(tasks.slice(i, i + 9));
    }

    // \u5efa\u7acbHình ảnh tham khảo\u6c60（\u6309Chiến lược\u6536đặt，từNhiệm vụdanh sáchtrongTrích xuất\u573a\u666f）
    const collectRefsFromTasks = (pageTasks: GridTask[]): string[] => {
      if (strategy === 'none') return [];
      const refs: string[] = [];
      const seenScenes = new Set<number>(); // \u907f\u514d\u540cmột\u573a\u666f\u91cd\u590d\u6536đặt
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

    // \u6839\u636e\u5206\u955c\u6570\u91cfTính toántối ưubố trí lưới（lực lượng N x N \u4ee5\u4fdd\u8bc1\u6bd4\u4f8bmột\u81f4\u6027）
    const collectOptimizedRefsFromTasks = (pageTasks: GridTask[]): string[] => {
      if (strategy === 'none') return [];

      const sceneRefs: string[] = [];
      const characterRefs: string[] = [];
      const anchorRefs: string[] = [];
      const seenScenes = new Set<number>();

      for (const task of pageTasks) {
        if (seenScenes.has(task.scene.id)) continue;
        seenScenes.add(task.scene.id);

        const sceneRef = task.type === 'end'
          ? (task.scene.endFrameSceneReferenceImage || task.scene.sceneReferenceImage)
          : task.scene.sceneReferenceImage;
        if (sceneRef) {
          sceneRefs.push(sceneRef);
        }

        if (task.scene.characterIds?.length) {
          characterRefs.push(...getCharacterReferenceImages(task.scene.characterIds, task.scene.characterVariationMap));
        }

        if (exemplar) {
          const anchorImage = task.type === 'end'
            ? (task.scene.imageDataUrl || task.scene.imageHttpUrl || undefined)
            : (task.scene.endFrameImageUrl || task.scene.endFrameHttpUrl || undefined);
          if (anchorImage) {
            anchorRefs.push(anchorImage);
          }
        }
      }

      const optimizedRefs = optimizeReferenceImagesForModel(model, [
        { kind: 'anchor', images: dedup(anchorRefs) },
        { kind: 'character', images: dedup(characterRefs) },
        { kind: 'scene', images: dedup(sceneRefs) },
      ]);

      return strategy === 'minimal' ? optimizedRefs.slice(0, 2) : optimizedRefs;
    };

    const calculateGridLayout = (sceneCount: number): { cols: number; rows: number; paddedCount: number } => {
      // Chiến lược：cho\u4e86\u4fdd\u8bc1\u6bcflưới\u5927\u5c0f\u7edd\u5bf9\u5747\u5300，lực lượngsử dụng N x N Bố cục
      // \u8fd9\u6837\u6574\u5f20\u5927\u56fecủa\u5bbd\u9ad8\u6bd4 = \u5355lướtôi là\u5bbd\u9ad8\u6bd4
      // Ví dụ：3x3 Bố cục，\u6bcflưới 16:9，\u6574\u56fe\u4e5fĐúng 16:9
      
      if (sceneCount <= 4) {
        return { cols: 2, rows: 2, paddedCount: 4 }; // 1-4 \u5f20 -> bốncung điện\u683c
      }
      return { cols: 3, rows: 3, paddedCount: 9 }; // 5-9 \u5f20 -> chíncung điện\u683c
    };
    
    // Tính toán\u6574\u5f20\u5927\u56fe\u5e94\u8be5Yêu cầucủa\u5bbd\u9ad8\u6bd4
    // \u5728 N x N Bố cục\u4e0b，\u6574\u56fe\u5bbd\u9ad8\u6bd4\u76f4\u63a5Đợi đã\u4e8e\u76ee\u6807\u5bbd\u9ad8\u6bd4
    const calculateGridAspectRatio = (targetAspect: '16:9' | '9:16'): string => {
      return targetAspect;
    };

    // \u5207\u5272\u5927\u56fecho N một\u5c0f\u56fe（\u6839\u636eBố cụccủađược rồi\u6570vàCột\u6570）
    // chìa khóa\u6539\u8fdb：\u5207\u5272\u65f6\u88c1\u526a\u6bcflướiĐến\u76ee\u6807\u5bbd\u9ad8\u6bd4，\u9632\u6b62\u56e0\u5927\u56fe\u5bbd\u9ad8\u6bd4\u4e0d\u7cbe\u786e\u5bfc\u81f4củathay đổi\u5f62
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
          
          // Tính toán\u6700\u7ec8\u8f93\u51facủa\u683c\u5b50\u5c3a\u5bf8（\u4fdd\u8bc1\u76ee\u6807\u5bbd\u9ad8\u6bd4）
          let outputW: number, outputH: number;
          let cropX = 0, cropY = 0, cropW = rawTileW, cropH = rawTileH;
          
          if (Math.abs(rawRatio - targetRatio) < 0.01) {
            // Tỷ lệ khung hình gần bằng\u76ee\u6807，Sử dụng trực tiếp
            outputW = rawTileW;
            outputH = rawTileH;
          } else if (rawRatio > targetRatio) {
            // Lưới của ảnh gốc quá rộng，Cần cắt chiều rộng
            cropW = Math.floor(rawTileH * targetRatio);
            cropX = Math.floor((rawTileW - cropW) / 2); // \u5c45trong\u88c1\u526a
            outputW = cropW;
            outputH = rawTileH;
          } else {
            // Lưới của ảnh gốc quá cao，Yêu cầu cắt chiều cao
            cropH = Math.floor(rawTileW / targetRatio);
            cropY = Math.floor((rawTileH - cropH) / 2); // \u5c45trong\u88c1\u526a
            outputW = rawTileW;
            outputH = cropH;
          }
          
          // \u5b89\u5168\u8fb9\u8ddd：\u5411bên trong\u6536\u7f29 0.5%，\u9632\u6b62\u5207Đến\u53ef\u80fdcủa\u5206\u5272\u7ebfhoặc\u8fb9\u7f18\u7455\u75b5
          const safetyMargin = 0.005; 
          const marginW = Math.floor(cropW * safetyMargin);
          const marginH = Math.floor(cropH * safetyMargin);
          
          // bảo hiểm kép：lực lượng\u8f93\u51fa\u5c3a\u5bf8\u4e25\u683c\u7b26\u5408\u76ee\u6807\u5bbd\u9ad8\u6bd4
          // \u907f\u514d\u56e0 Math.floor \u5bfc\u81f4của\u5fae\u5c0f\u6bd4\u4f8b\u504f\u5dee
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
            
            // từ\u539f\u56fetrong\u88c1\u526a\u6307\u5b9aQuận\u57df，\u5e76\u5e94sử dụng\u5b89\u5168\u8fb9\u8ddd
            const srcX = tileCol * rawTileW + cropX + marginW;
            const srcY = tileRow * rawTileH + cropY + marginH;
            const srcW = cropW - (marginW * 2);
            const srcH = cropH - (marginH * 2);
            
            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);
            results.push(canvas.toDataURL('image/png'));
          }
          resolve(results);
        };
        img.onerror = (e) => reject(new Error('Tải ảnh lưới 3x3 thất bại'));
        img.src = gridImageUrl;
      });
    };

    // \u751f\u6210chíncung điện\u683c\u56fe\u7247\u5e76\u5207\u5272（\u652f\u6301\u6df7\u5408khung hình đầu tiên+\u5c3e\u5e27Nhiệm vụ）
    const generateGridAndSlice = async (
      pageTasks: GridTask[],
      refs: string[]
    ): Promise<string[]> => {
      const actualCount = pageTasks.length;
      // sử dụngmớicủaBố cụcTính toánchức năng (lực lượng N x N)
      const { cols, rows, paddedCount } = calculateGridLayout(actualCount);
      const emptySlots = paddedCount - actualCount;
      
      // \u5728 N x N Bố cục\u4e0b，\u6574\u56fe\u5bbd\u9ad8\u6bd4\u76f4\u63a5Đợi đã\u4e8e\u76ee\u6807\u5bbd\u9ad8\u6bd4
      const gridAspect = aspect;
      
      console.log(`[MergedGen] Grid: ${actualCount} scenes → ${paddedCount} cells (${rows}×${cols}), ${emptySlots} empty slots, grid aspect: ${gridAspect}`);
      
      // \u6784\u5efaPhiên bản nâng cao\u63d0\u793a\u8bcd (Tài liệu tham khảosử dụng\u6237\u63d0\u4f9bcủacó cấu trúc Prompt)
      const gridPromptParts: string[] = [];
      
      // 1. Khối lệnh lõi (Instruction Block) — gió\u683c\u5728\u6b64\u5904\u524d\u7f6e，\u786e\u4fddtình hình chung\u751f\u6548
      gridPromptParts.push('<instruction>');
      gridPromptParts.push(`Generate a clean ${rows}x${cols} storyboard grid with exactly ${paddedCount} equal-sized panels.`);
      gridPromptParts.push(`Overall Image Aspect Ratio: ${aspect}.`);
      
      // Chỉ định rõ ràng tỷ lệ khung hình của một lưới riêng lẻ，Ngăn chặn sự nhầm lẫn của AI
      const panelAspect = aspect === '16:9' ? '16:9 (horizontal landscape)' : '9:16 (vertical portrait)';
      gridPromptParts.push(`Each individual panel must have a ${panelAspect} aspect ratio.`);
      
      // tình hình chung\u89c6\u89c9gió\u683c（thêm vào khu vực chỉ huy，Trọng lượng cao nhất）
      if (fullStylePrompt) {
        gridPromptParts.push(`MANDATORY Visual Style for ALL panels: ${fullStylePrompt}`);
      }
      const pageHasCharacterRefs = pageTasks.some((task) =>
        getSceneCharacterContexts(task.scene.characterIds || [], task.scene.characterVariationMap)
          .some((context) => context.referenceImages.length > 0)
      );
      const referencePriorityHint = buildReferencePriorityHint(model, pageHasCharacterRefs);
      if (referencePriorityHint) {
        gridPromptParts.push(referencePriorityHint);
      }
      
      gridPromptParts.push('Structure: No borders between panels, no text, no watermarks, no speech bubbles.');
      gridPromptParts.push('Consistency: Maintain consistent character appearance, lighting, color grading, and visual style across ALL panels.');
      gridPromptParts.push('</instruction>');
      
      // 2. Bố cục\u63cf\u8ff0 (Layout)
      gridPromptParts.push(`Layout: ${rows} rows, ${cols} columns, reading order left-to-right, top-to-bottom.`);
      
      // 3. \u6bcflướtôi làbên trong\u5bb9\u63cf\u8ff0（\u6839\u636eNhiệm vụ\u7c7b\u578b\u9009\u62e9khung hình đầu tiênhoặc\u5c3e\u5e27prompt）
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
        const sceneCharacterContexts = getSceneCharacterContexts(s.characterIds || [], s.characterVariationMap);
        const identityInline = getSceneIdentityLockLines(
          s,
          model,
          sceneCharacterContexts.some((context) => context.referenceImages.length > 0),
        )
          .map((line) => line.replace(/^- /, '').trim())
          .join(' ');
        
        // nhân vật\u6570\u91cfkhoảng\u675f
        const charCount = s.characterIds?.length || 0;
        const charConstraint = charCount === 0 
          ? '(no people)' 
          : charCount === 1 
            ? '(1 person)' 
            : `(${charCount} people)`;
        
        // \u6807\u8bb0Đúngkhung hình đầu tiên\u8fd8Đúng\u5c3e\u5e27
        const frameLabel = task.type === 'end' ? '[END FRAME]' : '[FIRST FRAME]';
        // Bao gồm trong mỗi lướigió\u683cmỏ neo，\u9632\u6b62\u591a\u9762\u677f\u65f6\u6a21\u578b\u9057\u5fd8tình hình chunggió\u683c
        const styleAnchor = fullStylePrompt ? ` [same style]` : '';
        const identitySuffix = identityInline ? ` Identity lock: ${identityInline}` : '';
        gridPromptParts.push(`Panel [row ${row}, col ${col}] ${frameLabel} ${charConstraint}: ${desc}${styleAnchor}${identitySuffix}`);
      });
      
      // 4. phần giữ chỗ trống\u63cf\u8ff0
      for (let i = actualCount; i < paddedCount; i++) {
        const row = Math.floor(i / cols) + 1;
        const col = (i % cols) + 1;
        gridPromptParts.push(`Panel [row ${row}, col ${col}]: empty placeholder, solid gray background`);
      }
      
      // 5. tình hình chunggió\u683c（\u5c3e\u90e8Một lần nữalần\u5f3a\u8c03，Tấn công trực diện\u786e\u4fddgió\u683cmột\u81f4\u6027）
      if (fullStylePrompt) {
        gridPromptParts.push(`IMPORTANT - Apply this EXACT style uniformly to every panel: ${fullStylePrompt}`);
      }
      
      // 6. \u8d1f\u9762\u63d0\u793a\u8bcd (Negative Constraints) — \u5408\u5e76gió\u683c\u4e13\u5c5e\u8d1f\u9762\u63d0\u793a
      const baseNegative = 'text, watermark, split screen borders, speech bubbles, blur, distortion, bad anatomy';
      const styleNeg = fullStyleNegative ? `, ${fullStyleNegative}` : '';
      gridPromptParts.push(`Negative constraints: ${baseNegative}${styleNeg}`);
      
      const gridPrompt = gridPromptParts.join('\n'); // sử dụngdòng mới\u7b26\u5206\u9694\u66f4\u6e05\u6670
      console.log('[MergedGen] Grid prompt:', gridPrompt.substring(0, 200) + '...');
      
      // \u6807\u8bb0\u6240CóNhiệm vụ\u5bf9\u5e94của\u5206\u955ccho\u751f\u6210trong
      pageTasks.forEach(task => {
        if (task.type === 'end') {
          updateSplitSceneEndFrameStatus(task.scene.id, { endFrameStatus: 'generating', endFrameProgress: 10 });
        } else {
          updateSplitSceneImageStatus(task.scene.id, { imageStatus: 'generating', imageProgress: 10 });
        }
      });
      const apiReferenceImages = await processReferenceImagesForApi(refs, '[MergedGen]');
      
      // \u6784\u5efaHình ảnh tham khảodanh sách
      const finalRefs = refs.slice(0, 14);
      
      // \u5904\u7406Hình ảnh tham khảocho API Có sẵn\u683c\u5f0f
      // API \u652f\u6301: 1) HTTP/HTTPS URL  2) Base64 Data URI (phải chứa data:image/xxx;base64, \u524d\u7f00)
      const processedRefs: string[] = [];
      for (const url of finalRefs) {
        if (!url) continue;
        // HTTP/HTTPS URL - Sử dụng trực tiếp
        if (url.startsWith('http://') || url.startsWith('https://')) {
          processedRefs.push(url);
        }
        // Base64 Data URI - \u5fc5\u987bĐúng\u5b8c\u6574\u683c\u5f0f data:image/xxx;base64,...
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
      // \u8c03\u8bd5：\u6253\u5370Hình ảnh tham khảo\u683c\u5f0f
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
      
      // \u8c03sử dụng API \u751f\u6210chíncung điện\u683c\u56fe\u7247 - sử dụng\u667a\u80fd\u8def\u7531（\u81ea\u52a8\u9009\u62e9 chat completions hoặc images/generations）
      console.log('[MergedGen] Calling API with', apiReferenceImages.length, 'reference images, model:', model);
      const apiResult = await submitGridImageRequest({
        model,
        prompt: gridPrompt,
        apiKey,
        baseUrl: imageBaseUrl,
        aspectRatio: gridAspect,
        resolution: storyboardConfig.resolution || '2K',
        referenceImages: apiReferenceImages.length > 0
          ? apiReferenceImages
          : (processedRefs.length > 0 ? processedRefs : undefined),
        keyManager,
      });
      
      let gridImageUrl = apiResult.imageUrl;
      let taskId = apiResult.taskId;
      console.log('[MergedGen] API result: gridImageUrl=', gridImageUrl?.substring(0, 50), 'taskId=', taskId);
      
      // Chẳng hạn như\u679cĐúng\u5f02\u6b65Nhiệm vụ，\u8f6e\u8be2
      if (!gridImageUrl && taskId) {
        console.log('[MergedGen] Polling task:', taskId);
        const pollInterval = 2000;
        const maxAttempts = 90; // 3 \u5206\u949f
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const progress = Math.min(10 + Math.floor((attempt / maxAttempts) * 80), 90);
          // \u6839\u636eNhiệm vụ\u7c7b\u578b\u66f4mới\u5404\u81eacủa\u8fdb\u5ea6
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
          
          if (!statusResp.ok) throw new Error(`Truy vấnNhiệm vụ\u5931\u8d25: ${statusResp.status}`);
          
          const statusData = await statusResp.json();
          console.log(`[MergedGen] Task ${taskId} poll #${attempt}:`, JSON.stringify(statusData, null, 2).substring(0, 500));
          
          const status = (statusData.status ?? statusData.data?.status ?? '').toString().toLowerCase();
          
          if (status === 'completed' || status === 'succeeded' || status === 'success') {
            // \u5c1d\u8bd5từkhác nhau\u8def\u5f84\u83b7\u53d6\u56fe\u7247 URL
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
            const errMsg = statusData.error || statusData.message || statusData.data?.error || 'Tạo ảnh thất bại';
            throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
          }
          
          await new Promise(r => setTimeout(r, pollInterval));
        }
      }
      
      if (!gridImageUrl) {
        console.error('[MergedGen] không có\u6cd5\u83b7\u53d6\u56fe\u7247 URL, apiResult:', apiResult);
        if (taskId) {
          throw new Error(`Tạo lưới 3x3 quá thời gian chờ (nhiệm vụ ${taskId} chưa hoàn thành trong 3 phút), vui lòng thử lại sau`);
        }
        throw new Error('Không lấy được URL ảnh lưới 3x3, vui lòng kiểm tra phản hồi API');
      }
      
      console.log('[MergedGen] Grid image URL:', gridImageUrl.substring(0, 80));
      
      // \u5207\u5272chíncung điện\u683c\u56fe\u7247（\u4f20\u5165Bố cục\u53c2\u6570và\u76ee\u6807\u5bbd\u9ad8\u6bd4）
      const slicedImages = await sliceGridImage(gridImageUrl, actualCount, cols, rows, aspect);
      console.log('[MergedGen] Sliced into', slicedImages.length, 'images (from', paddedCount, 'grid cells, target aspect:', aspect, ')');
      
      // \u56de\u586bĐến\u5404\u5206\u955c\u5e76\u81ea\u52a8\u4fdd\u5b58ĐếnChất liệu\u5e93
      // \u540c\u65f6\u4e0a\u4f20\u5207\u5272\u540ecủa\u56fe\u7247Đến\u56fegiường，\u907f\u514d\u89c6\u9891\u751f\u6210\u65f6Một lần nữalần\u4e0a\u4f20
      const folderId = getImageFolderId();
      const imageHostConfigured = isImageHostConfigured();
      
      // \u56de\u586b：\u6839\u636eNhiệm vụ\u7c7b\u578b\u51b3\u5b9a\u66f4mớikhung hình đầu tiên\u8fd8Đúng\u5c3e\u5e27
      // đầu tiên\u6301\u4e45\u5316Đến\u672c\u5730\u6587\u4ef6\u7cfb\u7edf（local-image://），Tránh base64 bị xóa bằng cách phân chia một phần\u5bfc\u81f4\u5bfc\u5165\u540e\u56fe\u7247\u4e22\u5931
      for (let i = 0; i < pageTasks.length; i++) {
        const task = pageTasks[i];
        const s = task.scene;
        const slicedImage = slicedImages[i];
        if (slicedImage) {
          // \u6301\u4e45\u5316Đến\u672c\u5730 + \u56fegiường（với\u5355\u56fe\u751f\u6210một\u81f4）
          const frameType = task.type === 'end' ? 'end' as const : 'first' as const;
          const persistResultLoop = await persistSceneImage(slicedImage, s.id, frameType);
          const httpUrl = persistResultLoop.httpUrl || undefined;
          const localPath = persistResultLoop.localPath;
          
          if (httpUrl) {
            console.log(`[MergedGen] Phân cảnh ${s.id + 1} ${task.type === 'end' ? 'khung cuối' : 'khung đầu'} đã upload lên image host:`, httpUrl.substring(0, 60));
          }
          
          if (task.type === 'end') {
            updateSplitSceneEndFrame(s.id, localPath, 'ai-generated', httpUrl || undefined);
            // \u81ea\u52a8\u4fdd\u5b58\u5c3e\u5e27ĐếnChất liệu\u5e93
            addMediaFromUrl({
              url: localPath,
              name: `Phân cảnh ${s.id + 1} - khung cuối`,
              type: 'image',
              source: 'ai-image',
              folderId,
              projectId: mediaProjectId,
            });
          } else {
            // \u4f20\u9012 httpUrl，\u8fd9\u6837\u89c6\u9891\u751f\u6210\u65f6\u53ef\u4ee5Sử dụng trực tiếp，\u4e0dsử dụngMột lần nữa\u4e0a\u4f20
            updateSplitSceneImage(s.id, localPath, s.width, s.height, httpUrl);
            // \u81ea\u52a8\u4fdd\u5b58khung hình đầu tiênĐếnChất liệu\u5e93
            addMediaFromUrl({
              url: localPath,
              name: `Phân cảnh ${s.id + 1} - khung đầu`,
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

    // phụ trợ：\u91cd\u7f6emột\u9875trong\u6240CóNhiệm vụcủa\u72b6\u6001cho failed
    const resetPageTasksToError = (pageTasks: GridTask[], errorMsg: string) => {
      for (const task of pageTasks) {
        if (task.type === 'end') {
          updateSplitSceneEndFrameStatus(task.scene.id, { endFrameStatus: 'failed', endFrameProgress: 0, endFrameError: errorMsg });
        } else {
          updateSplitSceneImageStatus(task.scene.id, { imageStatus: 'failed', imageProgress: 0, imageError: errorMsg });
        }
      }
    };

    // Không.một\u8f6e：\u9010\u9875\u5c1d\u8bd5，\u5931\u8d25của\u9875\u9762\u8bb0\u5f55\u4e0b\u6765tiếp tục\u4e0bmột\u9875
    const failedPages: { index: number; pageTasks: GridTask[]; refs: string[]; error: string }[] = [];
    let succeededCount = 0;

    for (let p = 0; p < taskPages.length; p++) {
      if (mergedAbortRef.current) {
        console.log('[MergedGen] sử dụng\u6237\u505c\u6b62\u5408\u5e76\u751f\u6210');
        toast.info('Đã dừng tạo gộp');
        setIsMergedRunning(false);
        return;
      }
      
      const pageTasks = taskPages[p];
      const refs = collectOptimizedRefsFromTasks(pageTasks);
      
      // \u7edf\u8ba1hiện tại\u9875củakhung hình đầu tiên/\u5c3e\u5e27\u6570\u91cf
      const pageFirstCount = pageTasks.filter(t => t.type === 'first').length;
      const pageEndCount = pageTasks.filter(t => t.type === 'end').length;
      const pageInfo = [pageFirstCount > 0 ? `${pageFirstCount}khung hình đầu tiên` : '', pageEndCount > 0 ? `${pageEndCount}\u5c3e\u5e27` : ''].filter(Boolean).join('+');
      
      console.log(`[MergedGen] Không. ${p + 1}/${taskPages.length} \u9875，${pageTasks.length} mộtNhiệm vụ（${pageInfo}），${refs.length} \u5f20Hình ảnh tham khảo`);
      
      try {
        await generateGridAndSlice(pageTasks, refs);
        succeededCount++;
        if (!mergedAbortRef.current) {
          toast.success(`Trang ${p + 1}/${taskPages.length} hoàn thành (${pageInfo})`);
        }
      } catch (e: any) {
        const errorMsg = e.message || String(e);
        console.error(`[MergedGen] Không. ${p + 1} \u9875\u5931\u8d25:`, errorMsg);
        // \u91cd\u7f6e\u8be5\u9875\u5206\u955c\u72b6\u6001cho error，\u4e0d\u8ba9\u5b83\u4eec\u5361\u5728 'generating'
        resetPageTasksToError(pageTasks, errorMsg);
        failedPages.push({ index: p, pageTasks, refs, error: errorMsg });
        toast.warning(`Trang ${p + 1}/${taskPages.length} thất bại, sẽ tự động thử lại: ${errorMsg.substring(0, 60)}`);
        // tiếp tục\u4e0bmột\u9875，\u4e0dtrong\u65ad
      }
    }

    // Không.Hai\u8f6e：\u81ea\u52a8\u91cd\u8bd5\u5931\u8d25của\u9875\u9762（\u5ef6\u8fdf 5 giây\u540e\u91cd\u8bd5，\u7ed9 API \u6062\u590d\u65f6\u95f4）
    if (failedPages.length > 0 && !mergedAbortRef.current) {
      console.log(`[MergedGen] ${failedPages.length} \u9875\u5931\u8d25，5 giây\u540e\u81ea\u52a8\u91cd\u8bd5...`);
      toast.info(`${failedPages.length} trang tạo thất bại, sẽ tự động thử lại sau 5 giây...`);
      await new Promise(r => setTimeout(r, 5000));

      for (const fp of failedPages) {
        if (mergedAbortRef.current) break;

        const pageFirstCount = fp.pageTasks.filter(t => t.type === 'first').length;
        const pageEndCount = fp.pageTasks.filter(t => t.type === 'end').length;
        const pageInfo = [pageFirstCount > 0 ? `${pageFirstCount}khung hình đầu tiên` : '', pageEndCount > 0 ? `${pageEndCount}\u5c3e\u5e27` : ''].filter(Boolean).join('+');

        console.log(`[MergedGen] \u81ea\u52a8\u91cd\u8bd5Không. ${fp.index + 1} \u9875（${pageInfo}）`);
        try {
          // \u91cdmớiThu thậpHình ảnh tham khảo（\u53ef\u80fd\u5728\u5176\u4ed6\u9875\u6210\u529f\u540eCómớicủa\u56feCó sẵn）
          const freshRefs = collectOptimizedRefsFromTasks(fp.pageTasks);
          await generateGridAndSlice(fp.pageTasks, freshRefs);
          succeededCount++;
          toast.success(`Trang ${fp.index + 1} thử lại thành công (${pageInfo})`);
        } catch (retryErr: any) {
          const retryMsg = retryErr.message || String(retryErr);
          console.error(`[MergedGen] Không. ${fp.index + 1} \u9875\u91cd\u8bd5\u4ecd\u7136\u5931\u8d25:`, retryMsg);
          // Một lần nữalần\u91cd\u7f6echo error \u72b6\u6001
          resetPageTasksToError(fp.pageTasks, `Thử lại thất bại: ${retryMsg}`);
          toast.error(`Trang ${fp.index + 1} thử lại thất bại: ${retryMsg.substring(0, 80)}`);
        }
      }
    }

    // \u6700\u7ec8\u6c47\u62a5
    const totalPages = taskPages.length;
    if (!mergedAbortRef.current) {
      if (succeededCount === totalPages) {
        toast.success('Tạo gộp lưới 3x3 hoàn thành tất cả!');
      } else if (succeededCount > 0) {
        toast.warning(`Tạo gộp hoàn thành một phần: ${succeededCount}/${totalPages} trang thành công, ${totalPages - succeededCount} trang thất bại`);
      } else {
        toast.error(`Tạo gộp thất bại toàn bộ (${totalPages} trang), vui lòng kiểm tra dịch vụ API và thử lại`);
      }
    }
    setIsMergedRunning(false);
  }, [
    splitScenes,
    storyboardConfig,
    currentStyleId,
    updateSplitSceneImage,
    updateSplitSceneImageStatus,
    updateSplitSceneEndFrame,
    updateSplitSceneEndFrameStatus,
    getSceneCharacterContexts,
    getSceneIdentityLockLines,
    getCharacterReferenceImages,
    processReferenceImagesForApi,
    getImageFolderId,
    addMediaFromUrl,
    mediaProjectId,
  ]);

  // \u590dsử dụng\u5355\u56fe\u751f\u6210của API \u8def\u5f84，\u5c01\u88c5chophổ quátchức năng（\u652f\u6301khung hình đầu tiên/\u5c3e\u5e27）
  // \u5408\u5e76\u751f\u6210\u4e13sử dụng：sử dụng\u9884Tính toánTài liệu tham khảodanh sách；\u4e0dHạ cấpĐến\u5355\u56fe\u901a\u9053
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
      throw new Error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      throw new Error('Vui lòng cấu hình model tạo ảnh trong Cài đặt trước');
    }
    const apiKeyToUse = apiKey || featureConfig.keyManager.getCurrentKey() || '';
    if (!apiKeyToUse) {
      throw new Error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
    }
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      throw new Error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
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
      // \u5bf9\u975e\u5e38\u89c4phản ứng：\u5c1d\u8bd5mộtlần"không cóTài liệu tham khảo"\u91cd\u8bd5（giữ\u5408\u5e76chế độ，\u4e0dHạ cấpĐến\u5355\u56fe\u901a\u9053）
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
        // \u68c0\u67e5\u5408\u5e76\u751f\u6210ĐúngKHÔNGĐã rồi\u88absử dụng\u6237\u505c\u6b62
        if (mergedAbortRef.current) {
          console.log(`[MergedGen] Scene ${sceneId} polling cancelled by user`);
          return;
        }
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

    if (!directUrl) throw new Error('Nhiệm vụHoàn thành\u4f46\u6ca1Có\u56fe\u7247 URL');

    const frameType = isEndFrame ? 'end' as const : 'first' as const;
    const persistResult = await persistSceneImage(directUrl, sceneId, frameType);

    if (isEndFrame) {
      updateSplitSceneEndFrame(sceneId, persistResult.localPath, 'ai-generated', persistResult.httpUrl);
    } else {
      const sceneObj = splitScenes.find(s => s.id === sceneId)!;
      updateSplitSceneImage(sceneId, persistResult.localPath, sceneObj.width, sceneObj.height, persistResult.httpUrl || undefined);
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
      toast.warning("Vui lòng nhập prompt khung cuối trước rồi tạo lại");
      return;
    }

    // sử dụng\u670d\u52a1\u6620\u5c04Cấu hình
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      return;
    }
    const keyManager = featureConfig.keyManager;
    const apiKey = keyManager.getCurrentKey() || '';
    if (!apiKey) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      return;
    }
    const platform = featureConfig.platform;
    const model = featureConfig.models?.[0];
    if (!model) {
      toast.error('Vui lòng cấu hình model tạo ảnh trong Cài đặt trước');
      return;
    }
    const imageBaseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
    if (!imageBaseUrl) {
      toast.error('Vui lòng cấu hình ánh xạ dịch vụ tạo ảnh trong Cài đặt trước');
      return;
    }
    
    console.log('[EndFrame] Using config:', { platform, model, imageBaseUrl });

    setIsGenerating(true);

    // \u521b\u5efa\u672clần\u5c3e\u5e27\u751f\u6210của AbortController，\u505c\u6b62\u6309\u94ae\u53ef\u901a\u8fc7 endFrameAbortRef.current.abort() \u53d6\u6d88
    const endFrameController = new AbortController();
    endFrameAbortRef.current = endFrameController;
    const endFrameSignal = endFrameController.signal;

    try {
      // Update end frame status
      updateSplitSceneEndFrameStatus(sceneId, {
        endFrameStatus: 'generating',
        endFrameProgress: 0,
        endFrameError: null,
      });

      // Build enhanced prompt with full style prompt
      let enhancedPrompt = promptToUse;
      const fullStylePrompt = getStylePrompt(currentStyleId);
      if (fullStylePrompt) {
        enhancedPrompt = `${promptToUse}. Style: ${fullStylePrompt}`;
      }
      const sceneCharacterRefs = getCharacterReferenceImages(scene.characterIds || [], scene.characterVariationMap);
      const hasCharacterRefs = sceneCharacterRefs.length > 0;
      enhancedPrompt = buildPromptWithIdentityLock(enhancedPrompt, scene, model, hasCharacterRefs);

      // Collect reference images - include scene background and first frame for consistency
      const referenceImages: string[] = [];
      
      // 1. \u5c3e\u5e27\u573a\u666f\u80cc\u666fHình ảnh tham khảo（\u53ef\u80fdvớikhung hình đầu tiên\u4e0d\u540c，Chẳng hạn như“Trương MinhtừSofađi\u5411bàn ăn”）
      if (scene.endFrameSceneReferenceImage) {
        referenceImages.push(scene.endFrameSceneReferenceImage);
        console.log('[SplitScenes] Using end frame scene background reference');
      } else if (scene.sceneReferenceImage) {
        // \u56de\u9000Đếnkhung hình đầu tiên\u573a\u666f\u80cc\u666f
        referenceImages.push(scene.sceneReferenceImage);
        console.log('[SplitScenes] Using first frame scene background for end frame');
      }
      
      // 2. khung hình đầu tiêđồ thị n\u7247\u4f5cchogió\u683cmột\u81f4\u6027Tài liệu tham khảo
      if (scene.imageDataUrl) {
        referenceImages.push(scene.imageDataUrl);
      }
      
      // 3. \u89d2\u8272Hình ảnh tham khảo
      if (scene.characterIds && scene.characterIds.length > 0) {
        const sceneCharRefs = getCharacterReferenceImages(scene.characterIds, scene.characterVariationMap);
        referenceImages.push(...sceneCharRefs);
      }

      const startFrameAnchor = scene.imageDataUrl || scene.imageHttpUrl || undefined;
      const endFrameSceneRef = scene.endFrameSceneReferenceImage || scene.sceneReferenceImage || undefined;
      const optimizedReferenceImages = optimizeReferenceImagesForModel(model, [
        { kind: 'scene', images: endFrameSceneRef ? [endFrameSceneRef] : [] },
        { kind: 'anchor', images: startFrameAnchor ? [startFrameAnchor] : [] },
        { kind: 'character', images: sceneCharacterRefs },
      ]);
      const apiReferenceImages = await processReferenceImagesForApi(optimizedReferenceImages, '[EndFrame]');

      console.log('[SplitScenes] Generating end frame:', {
        sceneId,
        prompt: enhancedPrompt.substring(0, 100),
        referenceCount: optimizedReferenceImages.length,
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
        referenceImages: apiReferenceImages.length > 0
          ? apiReferenceImages
          : (processedRefs.length > 0 ? processedRefs : undefined),
        keyManager,
        signal: endFrameSignal,
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
        updateSplitSceneEndFrame(sceneId, persistResult.localPath, 'ai-generated', persistResult.httpUrl);
        // \u81ea\u52a8\u4fdd\u5b58\u5c3e\u5e27ĐếnChất liệu\u5e93
        const folderId = getImageFolderId();
        addMediaFromUrl({
          url: persistResult.localPath,
          name: `Phân cảnh ${sceneId + 1} - khung cuối`,
          type: 'image',
          source: 'ai-image',
          folderId,
          projectId: mediaProjectId,
        });
        toast.success(`Phân cảnh ${sceneId + 1} tạo khung cuối thành công và đã lưu vào thư viện`);
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
            signal: endFrameSignal,
          });

          if (!statusResponse.ok) {
            if (statusResponse.status === 404) throw new Error('Nhiệm vụ không tồn tại');
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

            if (!imageUrl) throw new Error('Nhiệm vụ hoàn thành nhưng không có URL ảnh');
            
            // \u6301\u4e45\u5316Đến\u672c\u5730 + \u56fegiường
            const persistResult = await persistSceneImage(imageUrl, sceneId, 'end');
            updateSplitSceneEndFrame(sceneId, persistResult.localPath, 'ai-generated', persistResult.httpUrl);
            // \u81ea\u52a8\u4fdd\u5b58\u5c3e\u5e27ĐếnChất liệu\u5e93
            const folderId = getImageFolderId();
            addMediaFromUrl({
              url: persistResult.localPath,
              name: `Phân cảnh ${sceneId + 1} - khung cuối`,
              type: 'image',
              source: 'ai-image',
              folderId,
              projectId: mediaProjectId,
            });
            toast.success(`Phân cảnh ${sceneId + 1} tạo khung cuối thành công và đã lưu vào thư viện`);
            setIsGenerating(false);
            return;
          }

          if (status === 'failed' || status === 'error') {
            const errorMsg = statusData.error || statusData.message || 'Tạo khung cuối thất bại';
            throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
          }

          await new Promise<void>((resolve, reject) => {
            const tid = setTimeout(resolve, pollInterval);
            endFrameSignal.addEventListener('abort', () => { clearTimeout(tid); reject(new Error('Người dùng đã hủy')); }, { once: true });
          });
        }
        throw new Error('Tạo khung cuối quá thời gian chờ');
      }

      throw new Error('Invalid API response');
    } catch (error) {
      const err = error as Error;

      // sử dụng\u6237Chúa ơi\u52a8\u53d6\u6d88：abort() \u89e6\u53d1của AbortError hoặc\u81ea\u5b9a\u4e49 'sử dụng\u6237Đã rồi\u53d6\u6d88'
      if (err.name === 'AbortError' || err.message === 'Người dùng đã hủy') {
        console.log(`[SplitScenes] Scene ${sceneId} end frame generation cancelled by user`);
        setIsGenerating(false);
        return;
      }

      console.error(`[SplitScenes] Scene ${sceneId} end frame generation failed:`, err);
      updateSplitSceneEndFrameStatus(sceneId, {
        endFrameStatus: 'failed',
        endFrameProgress: 0,
        endFrameError: err.message,
      });
      toast.error(`Phân cảnh ${sceneId + 1} tạo khung cuối thất bại: ${err.message}`);
    }

    setIsGenerating(false);
  }, [
    splitScenes,
    storyboardConfig,
    currentStyleId,
    updateSplitSceneEndFrame,
    updateSplitSceneEndFrameStatus,
    getImageFolderId,
    addMediaFromUrl,
    mediaProjectId,
    getCharacterReferenceImages,
    buildPromptWithIdentityLock,
    processReferenceImagesForApi,
  ]);

  // Save to media library (image or video) - uses system category folders
  const handleSaveToLibrary = useCallback(async (scene: SplitScene, type: 'image' | 'video') => {
    try {
      if (type === 'video') {
        if (!scene.videoUrl) {
          toast.error("Không có video để lưu");
          return;
        }
        const folderId = getVideoFolderId();
        addMediaFromUrl({
          url: scene.videoUrl,
          name: `Phân cảnh ${scene.id + 1} - AI Video`,
          type: 'video',
          source: 'ai-video',
          thumbnailUrl: scene.imageDataUrl,
          duration: scene.duration || 5,
          folderId,
          projectId: mediaProjectId,
        });
        toast.success(`Phân cảnh ${scene.id + 1} đã lưu video vào thư viện`);
      } else {
        if (!scene.imageDataUrl) {
          toast.error("Không có ảnh để lưu");
          return;
        }
        const folderId = getImageFolderId();
        addMediaFromUrl({
          url: scene.imageDataUrl,
          name: `Phân cảnh ${scene.id + 1} - AI Ảnh`,
          type: 'image',
          source: 'ai-image',
          folderId,
          projectId: mediaProjectId,
        });
        toast.success(`Phân cảnh ${scene.id + 1} đã lưu ảnh vào thư viện`);
      }
    } catch (error) {
      const err = error as Error;
      toast.error(`Lưu thất bại: ${err.message}`);
    }
  }, [addMediaFromUrl, getImageFolderId, getVideoFolderId, mediaProjectId]);

  // Show empty state
  if (splitScenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Chưa có phân cảnh nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chuyển đổi tab trên cùng */}
      <div className="border-b -mx-4 px-4 -mt-4 pt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "editing" | "trailer")} className="w-full">
          <TabsList className="w-full justify-start h-9 rounded-none bg-transparent border-b-0 p-0">
            <TabsTrigger 
              value="editing" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-9 px-4"
            >
              <Film className="h-3 w-3 mr-1" />
              Chỉnh sửa phân cảnh
            </TabsTrigger>
            <TabsTrigger 
              value="trailer" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-9 px-4"
            >
              <Clapperboard className="h-3 w-3 mr-1" />
              Trailer {trailerScenes.length > 0 ? `(${trailerScenes.length})` : ''}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab trailer */}
      {activeTab === "trailer" && (
        <>
          {trailerScenes.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              <Clapperboard className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Tính năng trailer</p>
              <p className="text-xs mt-1">Hãy tạo trailer trong tab "Trailer" ở panel "Kịch bản" bên trái.</p>
              <p className="text-xs mt-1">Các phân cảnh đã chọn sẽ hiển thị tại đây để bạn tiếp tục tạo ảnh/video.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Phân cảnh trailer</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {trailerScenes.length} phân cảnh
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Ước tính {trailerScenes.reduce((sum, s) => sum + (s.duration || 5), 0)} giây
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoGeneratePrompts}
                    disabled={isGeneratingPrompts || isGenerating}
                    className="hidden h-7 px-2 text-xs"
                  >
                    {isGeneratingPrompts ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1 text-yellow-500" />
                    )}
                    AI tự động điền prompt
                  </Button>
                  {/* Xóa toàn bộ phân cảnh trailer */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        disabled={isGenerating}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Xóa tất cả
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận xóa phân cảnh trailer</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bạn sẽ xóa toàn bộ {trailerScenes.length} phân cảnh trailer, bao gồm ảnh và video đã tạo. Hành động này không thể hoàn tác.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            // Xóa tất cả phân cảnh trailer
                            trailerScenes.forEach(scene => {
                              deleteSplitScene(scene.id);
                            });
                            // Xóa cấu hình trailer
                            clearTrailer();
                            toast.success(`Đã xóa ${trailerScenes.length} phân cảnh trailer`);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Xác nhận xóa
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Cấu hình phong cách và tỷ lệ khung hình */}
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Phong cách hình ảnh:</span>
                  <StylePicker
                    value={currentStyleId || ''}
                    onChange={handleStyleChange}
                    disabled={isGenerating}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Tỷ lệ khung hình:</span>
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
                      Màn hình ngang
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
                      Màn hình dọc
                    </button>
                  </div>
                </div>
                {/* Image Resolution Selector */}
                <Select
                  value={storyboardConfig.resolution || '2K'}
                  onValueChange={(v: '1K' | '2K' | '4K') => {
                    setStoryboardConfig({ resolution: v });
                    toast.success(`Đã chuyển độ phân giải ảnh sang ${v}`);
                  }}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1K" className="text-xs">Tiêu chuẩn (1K)</SelectItem>
                    <SelectItem value="2K" className="text-xs">HD (2K)</SelectItem>
                    <SelectItem value="4K" className="text-xs">UHD (4K)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Video Resolution Selector */}
                <Select
                  value={storyboardConfig.videoResolution || '480p'}
                  onValueChange={(v: '480p' | '720p' | '1080p') => {
                    setStoryboardConfig({ videoResolution: v });
                    toast.success(`Đã chuyển độ phân giải video sang ${v}`);
                  }}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p" className="text-xs">Tiêu chuẩn (480P)</SelectItem>
                    <SelectItem value="720p" className="text-xs">HD (720P)</SelectItem>
                    <SelectItem value="1080p" className="text-xs">Chất lượng cao (1080P)</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1 text-xs text-muted-foreground/70 truncate">
                  {storyboardConfig.styleTokens?.slice(0, 2).join(', ')}...
                </div>
              </div>

              {/* Scene list - \u5b8c\u5168\u590dsử dụng\u5206\u955c\u7f16\u8f91của SceneCard */}
              <div className="flex flex-col gap-3">
                {trailerScenes.map((scene) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    promptLanguage={promptLanguage}
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

              {/* Action buttons - với\u5206\u955c\u7f16\u8f91một\u81f4 */}
              <div className="flex gap-2 pt-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => {
                          // \u4ec5choxe kéo\u5206\u955c\u751f\u6210\u89c6\u9891
                          toast.info(`Bắt đầu tạo ${trailerScenes.length} video trailer...`);
                          // \u5faa\u73af\u8c03sử dụng\u5355một\u751f\u6210
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
                            Đang tạo...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Tạo video trailer ({trailerScenes.length})
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tạo video cho các phân cảnh trailer</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Tips */}
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                <p>Trailer dùng chung dữ liệu với danh sách phân cảnh chính. Mọi thay đổi sẽ được đồng bộ. Nhấn vào vùng văn bản dưới mỗi cảnh để chỉnh prompt.</p>
              </div>
            </>
          )}
        </>
      )}

      {/* \u5206\u955c\u7f16\u8f91 Tab bên trong\u5bb9 */}
      {activeTab === "editing" && (
      <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Chỉnh sửa phân cảnh</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {splitScenes.length} phân cảnh
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoGeneratePrompts}
            disabled={isGeneratingPrompts || isGenerating}
            className="hidden h-7 px-2 text-xs"
          >
            {isGeneratingPrompts ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1 text-yellow-500" />
            )}
            AI \u81ea\u52a8\u586b\u5199\u63d0\u793a\u8bcd
          </Button>
          <Button
            variant="text"
            size="sm"
            onClick={handleBack}
            className="hidden h-7 px-2 text-xs"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Tạo lại
          </Button>
        </div>
      </div>

      {/* Row 1: \u57fa\u7840Cấu hình - \u89c6\u89c9gió\u683c / bức tranh\u6bd4\u4f8b / \u751f\u6210\u65b9\u5f0f */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/30 border">
        {/* Visual Style Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Phong cách hình ảnh:</span>
          <StylePicker
            value={currentStyleId || ''}
            onChange={handleStyleChange}
            disabled={isGenerating}
          />
        </div>

        {/* Cinematography Profile Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Phong cách quay phim:</span>
          <CinematographyProfilePicker
            value={currentCinProfileId}
            onChange={handleCinProfileChange}
            disabled={isGenerating}
            styleId={currentStyleId || undefined}
          />
        </div>

        {/* Aspect Ratio Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Tỷ lệ khung hình:</span>
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
              Màn hình ngang
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
              Màn hình dọc
            </button>
          </div>
        </div>

        {/* Image Resolution Selector */}
        <Select
          value={storyboardConfig.resolution || '2K'}
          onValueChange={(v: '1K' | '2K' | '4K') => {
            setStoryboardConfig({ resolution: v });
            toast.success(`Đã chuyển độ phân giải ảnh sang ${v}`);
          }}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1K" className="text-xs">Tiêu chuẩn (1K)</SelectItem>
            <SelectItem value="2K" className="text-xs">HD (2K)</SelectItem>
            <SelectItem value="4K" className="text-xs">UHD (4K)</SelectItem>
          </SelectContent>
        </Select>

        {/* Video Resolution Selector */}
        <Select
          value={storyboardConfig.videoResolution || '480p'}
          onValueChange={(v: '480p' | '720p' | '1080p') => {
            setStoryboardConfig({ videoResolution: v });
            toast.success(`Đã chuyển độ phân giải video sang ${v}`);
          }}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="480p" className="text-xs">Tiêu chuẩn (480P)</SelectItem>
            <SelectItem value="720p" className="text-xs">HD (720P)</SelectItem>
            <SelectItem value="1080p" className="text-xs">Chất lượng cao (1080P)</SelectItem>
          </SelectContent>
        </Select>

        {/* Image generation mode toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Chế độ tạo ảnh:</span>
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setImageGenMode('single')}
              className={cn(
                "px-3 py-1.5 text-xs",
                imageGenMode === 'single' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              )}
            >Tạo ảnh đơn</button>
            <button
              onClick={() => setImageGenMode('merged')}
              className={cn(
                "px-3 py-1.5 text-xs border-l",
                imageGenMode === 'merged' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              )}
            >Tạo gộp</button>
          </div>
        </div>

        {/* Current style tokens hint */}
        <div className="flex-1 text-xs text-muted-foreground/70 truncate">
          {storyboardConfig.styleTokens?.slice(0, 2).join(', ')}...
        </div>
      </div>

      {/* Row 2: \u5408\u5e76\u751f\u6210\u9009\u9879（\u4ec5\u5728\u5408\u5e76chế độ\u4e0b\u663e\u793a） */}
      {imageGenMode === 'merged' && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          {/* \u9996/\u5c3e\u5e27chế độ */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Khung hình:</span>
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => setFrameMode('first')}
                className={cn(
                  "px-3 py-1.5 text-xs",
                  frameMode === 'first' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                )}
              >Chỉ khung đầu</button>
              <button
                onClick={() => setFrameMode('last')}
                className={cn(
                  "px-3 py-1.5 text-xs border-l",
                  frameMode === 'last' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                )}
              >Chỉ khung cuối</button>
              <button
                onClick={() => setFrameMode('both')}
                className={cn(
                  "px-3 py-1.5 text-xs border-l",
                  frameMode === 'both' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                )}
              >Khung đầu + cuối</button>
            </div>
          </div>

          {/* Hình ảnh tham khảoChiến lược */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Chiến lược ảnh tham chiếu:</span>
            <Select value={refStrategy} onValueChange={v => setRefStrategy(v as any)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Chọn chiến lược" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cluster" className="text-xs">Cluster (gom cụm, loại trùng)</SelectItem>
                <SelectItem value="minimal" className="text-xs">Minimal (ít tham chiếu)</SelectItem>
                <SelectItem value="none" className="text-xs">None (không tham chiếu)</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => setUseExemplar(!useExemplar)}
              className={cn("px-2 py-1 text-xs rounded border", useExemplar ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
              title="Dùng ảnh mẫu đã tạo để làm neo tham chiếu trong cùng lưới"
            >Neo ảnh mẫu {useExemplar ? 'Bật' : 'Tắt'}</button>
          </div>

          {/* \u6267được rồi\u5408\u5e76\u751f\u6210 - \u7a81\u51fa\u663e\u793a */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              className="h-8 px-4 text-xs font-medium"
              disabled={isGenerating || isMergedRunning || splitScenes.length === 0}
              onClick={() => {
                console.log('[MergedGenControls] \u6267được rồi\u5408\u5e76\u751f\u6210\u6309\u94ae\u70b9\u51fb, frameMode:', frameMode, 'refStrategy:', refStrategy, 'useExemplar:', useExemplar);
                handleMergedGenerate(frameMode, refStrategy, useExemplar);
              }}
            >
              {isMergedRunning ? (<><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Đang tạo gộp...</>) : (<><Sparkles className="h-3.5 w-3.5 mr-1.5" />Chạy tạo gộp</>)}
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
      {splitScenes.some(s => !(s.videoPromptZh?.trim() || s.videoPrompt?.trim())) && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <div className="text-xs text-yellow-600 dark:text-yellow-400">
            <p>Một số phân cảnh đang thiếu prompt, hãy nhấn vào vùng văn bản bên dưới để chỉnh sửa.</p>
          </div>
        </div>
      )}

      {/* Scene list */}
      <div className="flex flex-col gap-3">
        {splitScenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            promptLanguage={promptLanguage}
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

        {/* \u6dfb\u52a0\u7a7a\u767d\u5206\u955c\u6309\u94ae */}
        <button
          type="button"
          onClick={addBlankSplitScene}
          disabled={isGenerating}
          className={cn(
            "w-full rounded-lg border-2 border-dashed border-muted-foreground/25",
            "flex items-center justify-center gap-2 py-6",
            "text-sm text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5",
            "transition-colors cursor-pointer",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <Plus className="h-5 w-5" />
          <span>Thêm phân cảnh trống</span>
        </button>
      </div>

      {/* Action buttons */}
      {(() => {
        const scenesWithImages = splitScenes.filter(s => s.imageDataUrl).length;
        const scenesNeedVideo = splitScenes.filter(s => s.imageDataUrl && (s.videoStatus === 'idle' || s.videoStatus === 'failed')).length;
        const noImages = scenesWithImages === 0;
        return (
          <div className="flex gap-2 pt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleGenerateVideos}
                    disabled={isGenerating || splitScenes.length === 0 || noImages}
                    className="flex-1"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Đang tạo...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Tạo video ({scenesNeedVideo}/{splitScenes.length})
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {noImages ? (
                    <p>Vui lòng tạo ảnh cho phân cảnh trước, rồi tạo lại video</p>
                  ) : (
                    <p>{scenesWithImages} phân cảnh đã có ảnh, {scenesNeedVideo} phân cảnh chờ tạo video</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      })()}

      {/* Tips */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
        <p>Nhấn vào vùng văn bản dưới mỗi phân cảnh để chỉnh prompt tạo video. Di chuột lên phân cảnh để xóa cảnh không cần thiết.</p>
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
    </div>
  );
}

