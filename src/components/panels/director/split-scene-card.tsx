// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * \u5206\u955c\u5361\u7247\u7ec4\u4ef6 (Split Scene Card Component)
 * \u663e\u793a\u5355một\u5206\u955ccủa\u6240Cóthông tin，bao gồmkhung hình đầu tiên/\u5c3e\u5e27\u56fe\u7247、\u89c6\u9891\u9884\u89c8、\u63d0\u793a\u8bcd\u7f16\u8f91Đợi đã
 * sử dụng\u4e8e SplitScene \u7c7b\u578b（với scene-card.tsx trongcủa AIScene \u7c7b\u578b\u4e0d\u540c）
 */

import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { readImageAsBase64 } from "@/lib/image-storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  type SplitScene,
  type EmotionTag,
  type ShotSizeType,
  type DurationType,
  type SoundEffectTag,
  CAMERA_MOVEMENT_PRESETS,
  SPECIAL_TECHNIQUE_PRESETS,
  CAMERA_ANGLE_PRESETS,
  PHOTOGRAPHY_TECHNIQUE_PRESETS,
  FOCAL_LENGTH_PRESETS,
} from "@/stores/director-store";
import type { PromptLanguage } from "@/types/script";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Play,
  ImageIcon,
  AlertCircle,
  Loader2,
  Sparkles,
  Download,
  RefreshCw,
  Upload,
  MapPin,
  RotateCw,
  Camera,
  Grid2X2,
  Square,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { EmotionTags } from "./emotion-tags";
import { ShotSizeSelector } from "./shot-size-selector";
import { DurationSelector } from "./duration-selector";
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
import { usePreviewStore } from "@/stores/preview-store";
import { CharacterSelector } from "./character-selector";
import { SceneLibrarySelector } from "./scene-library-selector";
import { MediaLibrarySelector } from "./media-library-selector";
import { EditableTextField } from "./editable-text-field";
import { useResolvedImageUrl } from "@/hooks/use-resolved-image-url";

export interface SplitSceneCardProps {
  scene: SplitScene;
  /** \u63d0\u793a\u8bcdngôn ngữ\u8bbe\u7f6e（\u6765\u81ea\u5267\u672c\u9762\u677f），\u51b3\u5b9a\u7f16\u8f91/\u663e\u793a\u54eamộtngôn ngữCánh đồng */
  promptLanguage?: PromptLanguage;
  // ba\u5c42\u63d0\u793a\u8bcd\u66f4mớigọi lại
  onUpdateImagePrompt: (id: number, prompt: string, promptZh?: string) => void;
  onUpdateVideoPrompt: (id: number, prompt: string, promptZh?: string) => void;
  onUpdateEndFramePrompt: (id: number, prompt: string, promptZh?: string) => void;
  onUpdateNeedsEndFrame: (id: number, needsEndFrame: boolean) => void;
  onUpdateEndFrame: (id: number, imageUrl: string | null) => void;
  onUpdateCharacters: (id: number, characterIds: string[]) => void;
  onUpdateCharacterVariationMap?: (id: number, map: Record<string, string>) => void;
  onUpdateEmotions: (id: number, emotionTags: EmotionTag[]) => void;
  onUpdateShotSize: (id: number, shotSize: ShotSizeType | null) => void;
  onUpdateDuration: (id: number, duration: DurationType) => void;
  onUpdateAmbientSound: (id: number, ambientSound: string) => void;
  onUpdateSoundEffects: (id: number, soundEffects: SoundEffectTag[]) => void;
  // \u573a\u666f\u5e93\u5173\u8054gọi lại
  onUpdateSceneReference?: (id: number, sceneLibraryId?: string, viewpointId?: string, referenceImage?: string, subViewId?: string) => void;
  onUpdateEndFrameSceneReference?: (id: number, sceneLibraryId?: string, viewpointId?: string, referenceImage?: string, subViewId?: string) => void;
  onDelete: (id: number) => void;
  onSaveToLibrary?: (scene: SplitScene, type: 'image' | 'video') => void;
  onGenerateImage?: (sceneId: number) => void;
  onGenerateVideo?: (sceneId: number) => void;
  onGenerateEndFrame?: (sceneId: number) => void;
  onRemoveImage?: (sceneId: number) => void;
  onUploadImage?: (sceneId: number, imageDataUrl: string) => void;
  // phổ quátCánh đồng\u66f4mớigọi lại（sử dụng\u4e8e\u53cc\u51fb\u7f16\u8f91）
  onUpdateField?: (sceneId: number, field: keyof SplitScene, value: any) => void;
  // góc\u5207\u6362gọi lại
  onAngleSwitch?: (sceneId: number, type: "start" | "end") => void;
  // bốncung điện\u683cgọi lại
  onQuadGrid?: (sceneId: number, type: "start" | "end") => void;
  // Trích xuất\u89c6\u9891\u6700\u540emột\u5e27gọi lại
  onExtractVideoLastFrame?: (sceneId: number) => void;
  // \u505c\u6b62\u751f\u6210gọi lại
  onStopImageGeneration?: (sceneId: number) => void;
  onStopVideoGeneration?: (sceneId: number) => void;
  onStopEndFrameGeneration?: (sceneId: number) => void;
  isExtractingFrame?: boolean;
  isAngleSwitching?: boolean;
  isQuadGridGenerating?: boolean;
  isGeneratingAny?: boolean;
}

export function SplitSceneCard({
  scene,
  promptLanguage = 'zh',
  onUpdateImagePrompt,
  onUpdateVideoPrompt,
  onUpdateEndFramePrompt,
  onUpdateNeedsEndFrame,
  onUpdateEndFrame,
  onUpdateCharacters,
  onUpdateCharacterVariationMap,
  onUpdateEmotions,
  onUpdateShotSize,
  onUpdateDuration,
  onUpdateAmbientSound,
  onUpdateSoundEffects,
  onUpdateSceneReference,
  onUpdateEndFrameSceneReference,
  onDelete,
  onSaveToLibrary,
  onGenerateImage,
  onGenerateVideo,
  onGenerateEndFrame,
  onRemoveImage,
  onUploadImage,
  onUpdateField,
  onAngleSwitch,
  onQuadGrid,
  onExtractVideoLastFrame,
  onStopImageGeneration,
  onStopVideoGeneration,
  onStopEndFrameGeneration,
  isExtractingFrame,
  isAngleSwitching,
  isQuadGridGenerating,
  isGeneratingAny,
}: SplitSceneCardProps) {
  // \u7f16\u8f91\u72b6\u6001：'none' | 'image' | 'video' | 'endFrame'
  const [editingPrompt, setEditingPrompt] = useState<'none' | 'image' | 'video' | 'endFrame'>('none');
  const [editPromptValue, setEditPromptValue] = useState('');
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  // hiện tạiđã chọncủa\u5e27\u76ee\u6807：'start' | 'end'，sử dụng\u4e8eChất liệu\u5e93\u9009\u62e9
  const [selectedFrameTarget, setSelectedFrameTarget] = useState<'start' | 'end'>('start');
  const endFrameInputRef = useRef<HTMLInputElement>(null);
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const { setPreviewItem } = usePreviewStore();

  // Compute effective display URLs: imageDataUrl → imageHttpUrl fallback
  // (partialize strips data: base64 on save; imageHttpUrl may survive as external URL)
  const effectiveImageUrl = scene.imageDataUrl || scene.imageHttpUrl || '';
  const effectiveEndFrameUrl = scene.endFrameImageUrl || scene.endFrameHttpUrl || '';

  // Resolve local-image:// paths to displayable URLs
  const resolvedImageUrl = useResolvedImageUrl(effectiveImageUrl);
  const resolvedEndFrameUrl = useResolvedImageUrl(effectiveEndFrameUrl);

  // \u6839\u636engôn ngữ\u8bbe\u7f6e\u83b7\u53d6\u5bf9\u5e94của\u63d0\u793a\u8bcdCánh đồng\u503c
  const getPromptByLanguage = (zh: string | undefined, en: string | undefined): string => {
    if (promptLanguage === 'en') return en || '';
    if (promptLanguage === 'zh') return zh || '';
    // zh+en: Ưu tiênTiếng Trung，\u56de\u9000Tiếng Anh
    return zh || en || '';
  };

  // \u5f00\u59cb\u7f16\u8f91\u67d0một\u63d0\u793a\u8bcd（\u6839\u636engôn ngữ\u9009\u62e9\u5bf9\u5e94Cánh đồng）
  const startEditing = (type: 'image' | 'video' | 'endFrame') => {
    if (type === 'image') {
      setEditPromptValue(getPromptByLanguage(scene.imagePromptZh, scene.imagePrompt));
    } else if (type === 'video') {
      setEditPromptValue(getPromptByLanguage(scene.videoPromptZh, scene.videoPrompt));
    } else {
      setEditPromptValue(getPromptByLanguage(scene.endFramePromptZh, scene.endFramePrompt));
    }
    setEditingPrompt(type);
  };

  // \u4fdd\u5b58\u63d0\u793a\u8bcd（\u6839\u636engôn ngữ\u8bbe\u7f6e\u53ea\u66f4mới\u5bf9\u5e94Cánh đồng，Không được bảo hiểm\u53e6một\u79cdngôn ngữ）
  const handleSavePrompt = () => {
    const langLabel = promptLanguage === 'en' ? 'Tiếng Anh' : 'Tiếng Trung';

    if (editingPrompt === 'image') {
      if (promptLanguage === 'en') {
        // chỉ tiếng Anh：\u66f4mới prompt，\u4fdd\u7559 promptZh không thay đổi
        onUpdateImagePrompt(scene.id, editPromptValue, scene.imagePromptZh);
      } else {
        // Tiếng Trung / Tiếng Trung và tiếng Anh：\u66f4mới promptZh，\u4fdd\u7559 prompt không thay đổi
        onUpdateImagePrompt(scene.id, scene.imagePrompt, editPromptValue);
      }
      toast.success(`\u5206\u955c ${scene.id + 1} khung hình đầu tiên${langLabel}\u63d0\u793a\u8bcdĐã rồi\u66f4mới`);
    } else if (editingPrompt === 'video') {
      if (promptLanguage === 'en') {
        onUpdateVideoPrompt(scene.id, editPromptValue, scene.videoPromptZh);
      } else {
        onUpdateVideoPrompt(scene.id, scene.videoPrompt, editPromptValue);
      }
      toast.success(`\u5206\u955c ${scene.id + 1} \u89c6\u9891${langLabel}\u63d0\u793a\u8bcdĐã rồi\u66f4mới`);
    } else if (editingPrompt === 'endFrame') {
      if (promptLanguage === 'en') {
        onUpdateEndFramePrompt(scene.id, editPromptValue, scene.endFramePromptZh);
      } else {
        onUpdateEndFramePrompt(scene.id, scene.endFramePrompt, editPromptValue);
      }
      toast.success(`\u5206\u955c ${scene.id + 1} \u5c3e\u5e27${langLabel}\u63d0\u793a\u8bcdĐã rồi\u66f4mới`);
    }
    setEditingPrompt('none');
  };

  const handleCancelEdit = () => {
    setEditingPrompt('none');
    setEditPromptValue('');
  };

  // \u5904\u7406khung hình đầu tiêđồ thị n\u7247\u4e0a\u4f20
  const handleFirstFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onUploadImage?.(scene.id, dataUrl);
      toast.success(`\u5206\u955c ${scene.id + 1} khung hình đầu tiênha\u4e0a\u4f20`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // \u5904\u7406\u5c3e\u5e27\u56fe\u7247\u4e0a\u4f20
  const handleEndFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onUpdateEndFrame(scene.id, dataUrl);
      // \u4e0a\u4f20\u5c3e\u5e27\u65f6\u81ea\u52a8\u542fsử dụng needsEndFrame，\u786e\u4fdd\u89c6\u9891\u751f\u6210\u65f6\u4f1asử dụng\u5c3e\u5e27Tài liệu tham khảo
      if (!scene.needsEndFrame) {
        onUpdateNeedsEndFrame(scene.id, true);
      }
      toast.success(`\u5206\u955c ${scene.id + 1} \u5c3e\u5e27Đã rồi\u4e0a\u4f20`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Xóa\u5c3e\u5e27
  const handleRemoveEndFrame = () => {
    onUpdateEndFrame(scene.id, null);
    toast.success(`\u5206\u955c ${scene.id + 1} \u5c3e\u5e27Đã rồiXóa`);
  };

  // Xóakhung hình đầu tiên
  const handleRemoveImage = () => {
    onRemoveImage?.(scene.id);
    toast.success(`\u5206\u955c ${scene.id + 1} khung hình đầu tiênhaXóa`);
  };

  // \u4e0b\u8f7d\u56fe\u7247
  const handleDownloadImage = async (imageUrl: string, filename: string) => {
    try {
      let blob: Blob;
      if (imageUrl.startsWith('local-image://')) {
        // Electron \u81ea\u5b9a\u4e49\u534f\u8bae：\u901a\u8fc7 IPC \u8bfb\u53d6cho base64 Một lần nữa\u8f6c blob
        const base64 = await readImageAsBase64(imageUrl);
        if (!base64) throw new Error('không có\u6cd5\u8bfb\u53d6\u672c\u5730\u56fe\u7247');
        const res = await fetch(base64);
        blob = await res.blob();
      } else {
        // data: / http: / https: \u5747\u53ef\u76f4\u63a5 fetch
        const res = await fetch(imageUrl);
        blob = await res.blob();
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${filename} \u4e0b\u8f7dHoàn thành`);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('\u4e0b\u8f7d\u5931\u8d25');
    }
  };

  // Status helpers
  const isImageGenerating = scene.imageStatus === 'generating' || scene.imageStatus === 'uploading';
  const isVideoReady = scene.videoStatus === 'completed' && scene.videoUrl;
  const isVideoGenerating = scene.videoStatus === 'generating' || scene.videoStatus === 'uploading';
  const isVideoFailed = scene.videoStatus === 'failed';
  const isVideoModerationSkipped = isVideoFailed && scene.videoError?.startsWith('MODERATION_SKIPPED:');
  const hasImage = !!effectiveImageUrl;
  const hasEndFrame = !!effectiveEndFrameUrl;
  const canDragVideo = isVideoReady && scene.videoUrl;

  // Handle drag start for video
  const handleVideoDragStart = (e: React.DragEvent) => {
    if (!canDragVideo || !scene.videoUrl) return;
    
    const dragData = {
      id: scene.videoMediaId || `scene-${scene.id}-video`,
      type: 'video',
      name: `\u5206\u955c ${scene.id + 1} - AI\u89c6\u9891`,
      url: scene.videoUrl,
      thumbnailUrl: scene.imageDataUrl,
      duration: 5,
    };
    
    e.dataTransfer.setData('application/x-media-item', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
    
    const dragImage = document.createElement('div');
    dragImage.className = 'bg-primary text-white px-2 py-1 rounded text-xs';
    dragImage.textContent = `\u5206\u955c ${scene.id + 1} \u89c6\u9891`;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  // \u9690\u85cfcủa\u6587\u4ef6\u4e0a\u4f20 input
  const firstFrameInput = (
    <input
      ref={firstFrameInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleFirstFrameUpload}
    />
  );

  const endFrameInput = (
    <input
      ref={endFrameInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleEndFrameUpload}
    />
  );

  return (
    <div className="group relative border rounded-lg overflow-hidden bg-card hover:border-primary/50 transition-colors">
      {/* \u5206\u955c\u7f16\u53f7và\u63a7\u5236\u680f */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-muted-foreground">\u5206\u955c #{scene.id + 1}</span>
          {(scene.sceneName || scene.sceneLocation) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary cursor-default">
                    <MapPin className="h-3 w-3" />
                    {scene.sceneName || scene.sceneLocation}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    {scene.sceneName && <p>\u573a\u666f: {scene.sceneName}</p>}
                    {scene.sceneLocation && <p>Vị trí: {scene.sceneLocation}</p>}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <ShotSizeSelector
            value={scene.shotSize}
            onChange={(v) => onUpdateShotSize(scene.id, v)}
            disabled={isGeneratingAny}
            className="w-24"
          />
        </div>
        {!isGeneratingAny && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>\u5220\u9664\u5206\u955c #{scene.id + 1}？</AlertDialogTitle>
                <AlertDialogDescription>
                  \u6b64\u64cd\u4f5c\u5c06\u5220\u9664\u8be5\u5206\u955ccủa\u6240Cóbên trong\u5bb9，không có\u6cd5\u64a4\u9500。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>\u53d6\u6d88</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(scene.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  \u5220\u9664
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Không.một\u6392：khung hình đầu tiêđồ thị n\u7247 + \u5c3e\u5e27\u56fe\u7247 + \u89d2\u8272\u5e93\u9009\u62e9 */}
      <div className="p-2 space-y-2">
        <div className="flex gap-2">
          {/* khung hình đầu tiêđồ thị n\u7247 */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => setSelectedFrameTarget('start')}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                  selectedFrameTarget === 'start'
                    ? "bg-primary/20 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                khung hình đầu tiên
              </button>
              {hasImage && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAngleSwitch?.(scene.id, "start"); }}
                    disabled={isAngleSwitching}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    <RotateCw className="h-2.5 w-2.5" />
                    \u89c6\u89d2
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onQuadGrid?.(scene.id, "start"); }}
                    disabled={isQuadGridGenerating}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-600 hover:bg-cyan-500/30 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    <Grid2X2 className="h-2.5 w-2.5" />
                    bốncung điện\u683c
                  </button>
                </div>
              )}
            </div>
            <div 
              className={cn(
                "aspect-video bg-muted rounded cursor-pointer relative group/image overflow-hidden border-2 transition-colors",
                selectedFrameTarget === 'start'
                  ? "border-primary border-solid"
                  : "border-dashed border-muted-foreground/20 hover:border-primary/50"
              )}
              onClick={() => {
                setSelectedFrameTarget('start');
                if (hasImage && resolvedImageUrl) {
                  setPreviewItem({ type: 'image', url: resolvedImageUrl, name: `\u5206\u955c ${scene.id + 1} khung hình đầu tiên` });
                } else {
                  firstFrameInputRef.current?.click();
                }
              }}
            >
              {hasImage ? (
                <>
                  <img
                    src={resolvedImageUrl || ''}
                    alt={`\u5206\u955c ${scene.id + 1} khung hình đầu tiên`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/image:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAngleSwitch?.(scene.id, "start"); }}
                      disabled={isAngleSwitching}
                      className="p-0.5 rounded bg-black/50 text-white hover:bg-amber-600 disabled:opacity-50"
                      title="\u5207\u6362\u89c6\u89d2"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onQuadGrid?.(scene.id, "start"); }}
                      disabled={isQuadGridGenerating}
                      className="p-0.5 rounded bg-black/50 text-white hover:bg-cyan-600 disabled:opacity-50"
                      title="bốncung điện\u683c\u751f\u6210"
                    >
                      <Grid2X2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDownloadImage(resolvedImageUrl || scene.imageDataUrl, `\u5206\u955c${scene.id + 1}_khung hình đầu tiên.png`); }}
                      className="p-0.5 rounded bg-black/50 text-white hover:bg-blue-600"
                      title="\u4e0b\u8f7dkhung hình đầu tiên"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemoveImage(); }}
                      className="p-0.5 rounded bg-black/50 text-white hover:bg-red-600"
                      title="\u5220\u9664khung hình đầu tiên"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {scene.imageSource === 'ai-generated' && (
                    <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-primary text-white px-1 rounded">AI</span>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <Upload className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground/50">\u4e0a\u4f20</span>
                </div>
              )}
              {isImageGenerating && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                  <span className="text-[10px] text-white">\u751f\u6210trong {scene.imageProgress}%</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onStopImageGeneration?.(scene.id); }}
                    className="mt-1 px-2 py-0.5 rounded bg-red-600/80 hover:bg-red-600 text-white text-[9px] flex items-center gap-0.5 transition-colors"
                    title="\u505c\u6b62\u751f\u6210"
                  >
                    <Square className="h-2.5 w-2.5" />\u505c\u6b62
                  </button>
                </div>
              )}
            </div>
            {firstFrameInput}
          </div>

          {/* \u5c3e\u5e27\u56fe\u7247 */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedFrameTarget('end')}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                    selectedFrameTarget === 'end'
                      ? "bg-orange-500/20 text-orange-500 font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  \u5c3e\u5e27
                </button>
                <button
                  onClick={() => onUpdateNeedsEndFrame(scene.id, !scene.needsEndFrame)}
                  disabled={isGeneratingAny}
                  className={cn(
                    "text-[9px] px-1 py-0.5 rounded transition-colors",
                    scene.needsEndFrame
                      ? "bg-orange-500/20 text-orange-500 hover:bg-orange-500/30"
                      : "bg-muted text-muted-foreground/60 hover:bg-muted/80"
                  )}
                >
                  {scene.needsEndFrame ? '\u9700\u8981' : 'Tùy chọn'}
                </button>
              </div>
              <div className="flex items-center gap-1">
                {hasEndFrame && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onAngleSwitch?.(scene.id, "end"); }}
                      disabled={isAngleSwitching}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 disabled:opacity-50 flex items-center gap-0.5"
                    >
                      <RotateCw className="h-2.5 w-2.5" />
                      \u89c6\u89d2
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onQuadGrid?.(scene.id, "end"); }}
                      disabled={isQuadGridGenerating}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-600 hover:bg-cyan-500/30 disabled:opacity-50 flex items-center gap-0.5"
                    >
                      <Grid2X2 className="h-2.5 w-2.5" />
                      bốncung điện\u683c
                    </button>
                  </>
                )}
              {/* \u5c3e\u5e27AI\u751f\u6210\u6309\u94ae：không có\u8bbaĐúng“\u9700\u8981\u5c3e\u5e27”\u8fd8Đúng“Tùy chọn\u5c3e\u5e27”\u90fd\u53ef\u4ee5\u751f\u6210 */}
                {!hasEndFrame && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onGenerateEndFrame?.(scene.id); }}
                    disabled={isGeneratingAny || scene.endFrameStatus === 'generating'}
                    className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded disabled:opacity-50",
                      scene.needsEndFrame 
                        ? "bg-orange-500/20 text-orange-500 hover:bg-orange-500/30"
                        : "bg-blue-500/20 text-blue-500 hover:bg-blue-500/30"
                    )}
                  >
                    {scene.endFrameStatus === 'generating' ? (
                      <span className="flex items-center gap-0.5"><Loader2 className="h-2.5 w-2.5 animate-spin" />{scene.endFrameProgress}%</span>
                    ) : (
                      <span className="flex items-center gap-0.5"><Sparkles className="h-2.5 w-2.5" />AI\u751f\u6210</span>
                    )}
                  </button>
                )}
              </div>
            </div>
            <div 
              className={cn(
                "aspect-video bg-muted rounded cursor-pointer relative group/endframe overflow-hidden border-2 transition-colors",
                selectedFrameTarget === 'end'
                  ? "border-orange-500 border-solid"
                  : scene.needsEndFrame 
                    ? "border-dashed border-orange-500/30 hover:border-orange-500/50" 
                    : "border-dashed border-blue-400/30 hover:border-blue-400/50"
              )}
              onClick={() => {
                setSelectedFrameTarget('end');
                if (hasEndFrame && resolvedEndFrameUrl) {
                  setPreviewItem({ type: 'image', url: resolvedEndFrameUrl, name: `\u5206\u955c ${scene.id + 1} \u5c3e\u5e27` });
                } else {
                  endFrameInputRef.current?.click();
                }
              }}
            >
              {hasEndFrame ? (
                <>
                  <img
                    src={resolvedEndFrameUrl || ''}
                    alt={`\u5206\u955c ${scene.id + 1} \u5c3e\u5e27`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/endframe:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAngleSwitch?.(scene.id, "end"); }}
                      disabled={isAngleSwitching}
                      className="p-0.5 rounded bg-black/50 text-white hover:bg-amber-600 disabled:opacity-50"
                      title="\u5207\u6362\u89c6\u89d2"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onQuadGrid?.(scene.id, "end"); }}
                      disabled={isQuadGridGenerating}
                      className="p-0.5 rounded bg-black/50 text-white hover:bg-cyan-600 disabled:opacity-50"
                      title="bốncung điện\u683c\u751f\u6210"
                    >
                      <Grid2X2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDownloadImage(resolvedEndFrameUrl || scene.endFrameImageUrl!, `\u5206\u955c${scene.id + 1}_\u5c3e\u5e27.png`); }}
                      className="p-0.5 rounded bg-black/50 text-white hover:bg-blue-600"
                      title="\u4e0b\u8f7d\u5c3e\u5e27"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemoveEndFrame(); }}
                      className="p-0.5 rounded bg-black/50 text-white hover:bg-red-600"
                      title="\u5220\u9664\u5c3e\u5e27"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {scene.endFrameSource === 'ai-generated' && (
                    <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-orange-500 text-white px-1 rounded">AI</span>
                  )}
                </>
              ) : scene.endFrameStatus === 'generating' ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-orange-500/10">
                  <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                  <span className="text-[10px] text-orange-500">\u751f\u6210trong {scene.endFrameProgress}%</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onStopEndFrameGeneration?.(scene.id); }}
                    className="mt-0.5 px-2 py-0.5 rounded bg-red-600/80 hover:bg-red-600 text-white text-[9px] flex items-center gap-0.5 transition-colors"
                    title="\u505c\u6b62\u751f\u6210"
                  >
                    <Square className="h-2.5 w-2.5" />\u505c\u6b62
                  </button>
                </div>
              ) : scene.needsEndFrame ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-orange-500/5">
                  <span className="text-orange-500 text-lg">◉</span>
                  <span className="text-[10px] text-orange-500/70">\u9700\u8981\u5c3e\u5e27</span>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-blue-500/5">
                  <Upload className="h-4 w-4 text-blue-400/60" />
                  <span className="text-[10px] text-blue-400/60">\u4e0a\u4f20/\u751f\u6210</span>
                </div>
              )}
            </div>
            {endFrameInput}
          </div>

          {/* \u89d2\u8272\u5e93 + \u573a\u666fTài liệu tham khảo\u9009\u62e9 */}
          <div className="flex flex-col gap-1 justify-end">
            <CharacterSelector
              selectedIds={scene.characterIds || []}
              onChange={(ids) => onUpdateCharacters(scene.id, ids)}
              characterVariationMap={scene.characterVariationMap}
              onChangeVariation={(charId, varId) => {
                const current = { ...(scene.characterVariationMap || {}) };
                if (varId) {
                  current[charId] = varId;
                } else {
                  delete current[charId];
                }
                onUpdateCharacterVariationMap?.(scene.id, current);
              }}
              disabled={isGeneratingAny}
            />
            {onUpdateSceneReference && (
              <SceneLibrarySelector
                sceneId={scene.id}
                selectedSceneLibraryId={scene.sceneLibraryId}
                selectedViewpointId={scene.viewpointId}
                selectedSubViewId={scene.subViewId}
                isEndFrame={false}
                onChange={(sceneLibId, viewpointId, refImage, subViewId) => 
                  onUpdateSceneReference(scene.id, sceneLibId, viewpointId, refImage, subViewId)
                }
                disabled={isGeneratingAny}
              />
            )}
            {/* \u573a\u666fTài liệu tham khảo\u9009\u62e9\u5668 - Theođã chọncủa\u5e27\u76ee\u6807\u5207\u6362 */}
            {selectedFrameTarget === 'start' ? (
              // khung hình đầu tiên\u573a\u666fTài liệu tham khảoĐã rồi\u5728\u4e0a\u65b9kết xuất
              null
            ) : (
              // \u5c3e\u5e27\u573a\u666f\u5e93\u9009\u62e9\u5668
              onUpdateEndFrameSceneReference && (
                <SceneLibrarySelector
                  sceneId={scene.id}
                  selectedSceneLibraryId={scene.endFrameSceneLibraryId}
                  selectedViewpointId={scene.endFrameViewpointId}
                  selectedSubViewId={scene.endFrameSubViewId}
                  isEndFrame={true}
                  onChange={(sceneLibId, viewpointId, refImage, subViewId) => 
                    onUpdateEndFrameSceneReference(scene.id, sceneLibId, viewpointId, refImage, subViewId)
                  }
                  disabled={isGeneratingAny}
                />
              )
            )}
            {/* Chất liệu\u5e93\u9009\u62e9\u5668 - Theođã chọncủa\u5e27\u76ee\u6807\u5e94sử dụng */}
            {onUploadImage && (
              <MediaLibrarySelector
                sceneId={scene.id}
                isEndFrame={selectedFrameTarget === 'end'}
                onSelect={(imageUrl) => {
                  if (selectedFrameTarget === 'start') {
                    onUploadImage(scene.id, imageUrl);
                  } else {
                    onUpdateEndFrame(scene.id, imageUrl);
                  }
                }}
                disabled={isGeneratingAny}
              />
            )}
          </div>
        </div>

        {/* Không.Hai\u6392：\u751f\u6210\u56fe\u7247/\u89c6\u9891\u6309\u94ae + \u89c6\u9891\u9884\u89c8/\u72b6\u6001 */}
        <div className="flex items-center gap-2">
          {!hasImage ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => onGenerateImage?.(scene.id)}
                disabled={isGeneratingAny || isImageGenerating}
              >
                {isImageGenerating ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" />\u751f\u6210trong {scene.imageProgress}%</>
                ) : (
                  <><ImageIcon className="h-3 w-3 mr-1" />\u751f\u6210\u56fe\u7247</>
                )}
              </Button>
              {isImageGenerating && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs px-2"
                  onClick={() => onStopImageGeneration?.(scene.id)}
                  title="\u505c\u6b62\u751f\u6210"
                >
                  <Square className="h-3 w-3" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={isVideoReady ? "outline" : "default"}
                className="h-7 text-xs"
                onClick={() => onGenerateVideo?.(scene.id)}
                disabled={isGeneratingAny || isVideoGenerating}
              >
                {isVideoGenerating ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" />\u751f\u6210trong {scene.videoProgress}%</>
                ) : isVideoReady ? (
                  <><RefreshCw className="h-3 w-3 mr-1" />\u91cdmới\u751f\u6210</>
                ) : (
                  <><Play className="h-3 w-3 mr-1" />\u751f\u6210\u89c6\u9891</>
                )}
              </Button>
              {isVideoGenerating && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs px-2"
                  onClick={() => onStopVideoGeneration?.(scene.id)}
                  title="\u505c\u6b62\u751f\u6210"
                >
                  <Square className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
          
          {isVideoReady && scene.videoUrl && (
            <div className="flex items-center gap-1">
              <div 
                className="flex-1 aspect-video max-w-[120px] bg-muted rounded overflow-hidden cursor-pointer relative"
                onClick={() => setPreviewItem({ type: 'video', url: scene.videoUrl!, name: `\u5206\u955c ${scene.id + 1} \u89c6\u9891` })}
                draggable={!!canDragVideo}
                onDragStart={handleVideoDragStart}
              >
                <video src={scene.videoUrl} className="w-full h-full object-cover" muted preload="none" poster={resolvedImageUrl || undefined} />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-4 w-4 text-white" />
                </div>
                {canDragVideo && (
                  <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-green-600 text-white px-1 rounded">\u62d6Đến\u65f6\u95f4\u7ebf</span>
                )}
              </div>
              {/* Trích xuất\u5c3e\u5e27\u6309\u94ae */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExtractVideoLastFrame?.(scene.id);
                      }}
                      disabled={isExtractingFrame || isGeneratingAny}
                      className="p-1.5 rounded bg-cyan-500/20 text-cyan-600 hover:bg-cyan-500/30 disabled:opacity-50 transition-colors"
                    >
                      {isExtractingFrame ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Trích xuất\u6700\u540emột\u5e27Đến\u4e0bmột\u5206\u955ckhung hình đầu tiên</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {isVideoFailed && (
            <span className={cn(
              "text-xs flex items-center gap-1",
              isVideoModerationSkipped 
                ? "text-amber-500" 
                : "text-destructive"
            )}>
              <AlertCircle className="h-3 w-3" />
              {isVideoModerationSkipped 
                ? 'bên trong\u5bb9\u5ba1\u6838bỏ qua'
                : (scene.videoError || '\u751f\u6210\u5931\u8d25')}
            </span>
          )}
        </div>

        {/* Không.ba\u6392：\u63d0\u793a\u8bcd\u7cfb\u7edf（\u5267\u672c\u52a8\u4f5c + ba\u5c42\u63d0\u793a\u8bcd + Thẻ cảm xúc） - \u5f69\u8272\u5206Quận */}
        <div className="space-y-1.5">
          {/* \u6298\u53e0/\u5c55\u5f00 Header：Chevron + Tiêu đề + \u586b\u5145\u72b6\u6001\u5fbdchương */}
          <button
            onClick={() => setShowPromptDetails(!showPromptDetails)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md bg-muted/50 border hover:bg-muted/70 transition-colors"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", showPromptDetails && "rotate-90")} />
            <span className="text-xs font-medium">\u63d0\u793a\u8bcd</span>
            {/* \u586b\u5145\u72b6\u6001\u5fbdchương */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 border",
                scene.actionSummary
                  ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20"
                  : "bg-muted text-muted-foreground/40 border-transparent"
              )}>
                <Edit3 className="h-2.5 w-2.5" /> \u5267\u672c
              </span>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 border",
                getPromptByLanguage(scene.imagePromptZh, scene.imagePrompt)
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20"
                  : "bg-muted text-muted-foreground/40 border-transparent"
              )}>
                <ImageIcon className="h-2.5 w-2.5" /> khung hình đầu tiên
              </span>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 border",
                getPromptByLanguage(scene.endFramePromptZh, scene.endFramePrompt)
                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20"
                  : scene.needsEndFrame
                    ? "bg-orange-500/5 text-orange-400/60 border-dashed border-orange-400/30"
                    : "bg-muted text-muted-foreground/40 border-transparent"
              )}>
                ◉ \u5c3e\u5e27
              </span>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 border",
                getPromptByLanguage(scene.videoPromptZh, scene.videoPrompt)
                  ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20"
                  : "bg-muted text-muted-foreground/40 border-transparent"
              )}>
                <Play className="h-2.5 w-2.5" /> \u89c6\u9891
              </span>
            </div>
          </button>

          {showPromptDetails ? (
            <div className="space-y-2 pl-1">
              {/* ━━ \u5267\u672c\u52a8\u4f5c（\u63d0\u793a\u8bcd\u6765\u6e90）━━ Màu tím\u5de6\u8fb9\u6846 */}
              <div className="border-l-[3px] border-violet-500 pl-3 py-1 space-y-1">
                <Label className="text-[10px] text-violet-600 dark:text-violet-400 flex items-center gap-1 font-medium">
                  <Edit3 className="h-3 w-3" />
                  \u5267\u672c\u52a8\u4f5c（\u63d0\u793a\u8bcd\u6765\u6e90）
                </Label>
                <div className="rounded bg-violet-500/5 border border-violet-500/10">
                  <EditableTextField
                    label=""
                    value={scene.actionSummary || ''}
                    onChange={(v) => onUpdateField?.(scene.id, 'actionSummary', v)}
                    placeholder="\u53cc\u51fb\u6dfb\u52a0\u52a8\u4f5c\u63cf\u8ff0（AI \u5c06\u636e\u6b64\u751f\u6210ba\u5c42\u63d0\u793a\u8bcd）..."
                    disabled={isGeneratingAny}
                    multiline
                  />
                </div>
              </div>

              {/* ━━ khung hình đầu tiên\u63d0\u793a\u8bcd ━━ màu xanh da trời\u5de6\u8fb9\u6846 */}
              <div className="border-l-[3px] border-blue-500 pl-3 py-1 space-y-1">
                <Label className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                  <ImageIcon className="h-3 w-3" />
                  khung hình đầu tiên\u63d0\u793a\u8bcd（tĩnhbức tranh）
                </Label>
                {editingPrompt === 'image' ? (
                  <>
                    <Textarea
                      value={editPromptValue}
                      onChange={(e) => setEditPromptValue(e.target.value)}
                      className="min-h-[150px] text-xs resize-none border-blue-500/30 focus-visible:ring-blue-500/30"
                      placeholder="\u63cf\u8ff0khung hình đầu tiêncủatĩnhbức tranh..."
                      autoFocus
                    />
                    <div className="flex gap-1 justify-end mt-1">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit} className="h-5 px-2 text-[10px]">
                        <X className="h-2.5 w-2.5 mr-0.5" />\u53d6\u6d88
                      </Button>
                      <Button size="sm" onClick={handleSavePrompt} className="h-5 px-2 text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" />\u4fdd\u5b58
                      </Button>
                    </div>
                  </>
                ) : (
                  <div 
                    className="flex items-start gap-2 cursor-pointer p-1.5 rounded bg-blue-500/5 hover:bg-blue-500/10 transition-colors border border-blue-500/10"
                    onClick={() => !isGeneratingAny && startEditing('image')}
                  >
                    <p className="text-[11px] text-muted-foreground flex-1 line-clamp-6 min-h-[4.5em]">
                      {getPromptByLanguage(scene.imagePromptZh, scene.imagePrompt) || "\u70b9\u51fb\u6dfb\u52a0khung hình đầu tiên\u63cf\u8ff0..."}
                    </p>
                    {!isGeneratingAny && <Edit3 className="h-2.5 w-2.5 text-blue-500/50 shrink-0 mt-0.5" />}
                  </div>
                )}
              </div>

              {/* ━━ \u5c3e\u5e27\u63d0\u793a\u8bcd ━━ \u6a59\u8272\u5de6\u8fb9\u6846 */}
              <div className="border-l-[3px] border-orange-500 pl-3 py-1 space-y-1">
                <Label className="text-[10px] text-orange-600 dark:text-orange-400 flex items-center gap-1 font-medium">
                  <span>◉</span>
                  \u5c3e\u5e27\u63d0\u793a\u8bcd{scene.needsEndFrame ? '' : '（Tùy chọn）'}
                </Label>
                {editingPrompt === 'endFrame' ? (
                  <>
                    <Textarea
                      value={editPromptValue}
                      onChange={(e) => setEditPromptValue(e.target.value)}
                      className="min-h-[150px] text-xs resize-none border-orange-500/30 focus-visible:ring-orange-500/30"
                      placeholder="\u63cf\u8ff0\u5c3e\u5e27củatĩnhbức tranh..."
                      autoFocus
                    />
                    <div className="flex gap-1 justify-end mt-1">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit} className="h-5 px-2 text-[10px]">
                        <X className="h-2.5 w-2.5 mr-0.5" />\u53d6\u6d88
                      </Button>
                      <Button size="sm" onClick={handleSavePrompt} className="h-5 px-2 text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" />\u4fdd\u5b58
                      </Button>
                    </div>
                  </>
                ) : (
                  <div 
                    className={cn(
                      "flex items-start gap-2 cursor-pointer p-1.5 rounded transition-colors border",
                      scene.needsEndFrame 
                        ? "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20" 
                        : "bg-orange-500/5 hover:bg-orange-500/10 border-orange-500/10"
                    )}
                    onClick={() => !isGeneratingAny && startEditing('endFrame')}
                  >
                    <p className={cn(
                      "text-[11px] flex-1 line-clamp-6 min-h-[4.5em]",
                      "text-orange-600 dark:text-orange-400"
                    )}>
                      {getPromptByLanguage(scene.endFramePromptZh, scene.endFramePrompt) || (scene.needsEndFrame ? "\u70b9\u51fb\u6dfb\u52a0\u5c3e\u5e27\u63cf\u8ff0..." : "\u70b9\u51fb\u6dfb\u52a0\u5c3e\u5e27\u63cf\u8ff0...（Tùy chọn）")}
                    </p>
                    {!isGeneratingAny && <Edit3 className="h-2.5 w-2.5 text-orange-500/50 shrink-0 mt-0.5" />}
                  </div>
                )}
              </div>

              {/* ━━ \u89c6\u9891\u63d0\u793a\u8bcd ━━ \u7eff\u8272\u5de6\u8fb9\u6846 */}
              <div className="border-l-[3px] border-green-500 pl-3 py-1 space-y-1.5">
                <Label className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
                  <Play className="h-3 w-3" />
                  \u89c6\u9891\u63d0\u793a\u8bcd（\u52a8\u6001\u52a8\u4f5c）
                </Label>
                {/* \u89c6\u9891\u63d0\u793a\u8bcd\u6587\u672c */}
                {editingPrompt === 'video' ? (
                  <>
                    <Textarea
                      value={editPromptValue}
                      onChange={(e) => setEditPromptValue(e.target.value)}
                      className="min-h-[150px] text-xs resize-none border-green-500/30 focus-visible:ring-green-500/30"
                      placeholder="\u63cf\u8ff0\u89c6\u9891trongcủa\u52a8\u4f5c、các môn thể thao、thay đổi..."
                      autoFocus
                    />
                    <div className="flex gap-1 justify-end mt-1">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit} className="h-5 px-2 text-[10px]">
                        <X className="h-2.5 w-2.5 mr-0.5" />\u53d6\u6d88
                      </Button>
                      <Button size="sm" onClick={handleSavePrompt} className="h-5 px-2 text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" />\u4fdd\u5b58
                      </Button>
                    </div>
                  </>
                ) : (
                  <div 
                    className="flex items-start gap-2 cursor-pointer p-1.5 rounded bg-green-500/5 hover:bg-green-500/10 transition-colors border border-green-500/10"
                    onClick={() => !isGeneratingAny && startEditing('video')}
                  >
                    <p className="text-[11px] text-green-600 dark:text-green-400 flex-1 line-clamp-6 min-h-[4.5em]">
                      {getPromptByLanguage(scene.videoPromptZh, scene.videoPrompt) || "\u70b9\u51fb\u6dfb\u52a0\u52a8\u4f5c\u63cf\u8ff0..."}
                    </p>
                    {!isGeneratingAny && <Edit3 className="h-2.5 w-2.5 text-green-500/50 shrink-0 mt-0.5" />}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* \u6298\u53e0Tóm tắt\u89c6\u56fe：\u5f69\u8272\u56fe\u6807nhãn + bên trong\u5bb9\u9884\u89c8 */
            <div 
              className="space-y-1 p-2 rounded-md bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors border border-transparent hover:border-muted"
              onClick={() => setShowPromptDetails(true)}
            >
              <p className="text-[10px] truncate flex items-center gap-1.5">
                <span className="shrink-0 inline-flex items-center gap-0.5 text-violet-600 dark:text-violet-400 font-medium">
                  <Edit3 className="h-2.5 w-2.5" /> \u5267\u672c:
                </span>
                <span className="text-muted-foreground">{scene.actionSummary || '\u672a\u8bbe\u7f6e'}</span>
              </p>
              <p className="text-[10px] truncate flex items-center gap-1.5">
                <span className="shrink-0 inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-medium">
                  <ImageIcon className="h-2.5 w-2.5" /> khung hình đầu tiên:
                </span>
                <span className="text-muted-foreground">{getPromptByLanguage(scene.imagePromptZh, scene.imagePrompt) || '\u672a\u8bbe\u7f6e'}</span>
              </p>
              {(scene.needsEndFrame || getPromptByLanguage(scene.endFramePromptZh, scene.endFramePrompt)) && (
                <p className="text-[10px] truncate flex items-center gap-1.5">
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-medium">
                    ◉ \u5c3e\u5e27:
                  </span>
                  <span className="text-orange-600/70 dark:text-orange-400/70">{getPromptByLanguage(scene.endFramePromptZh, scene.endFramePrompt) || '\u672a\u8bbe\u7f6e'}</span>
                </p>
              )}
              <p className="text-[10px] truncate flex items-center gap-1.5">
                <span className="shrink-0 inline-flex items-center gap-0.5 text-green-600 dark:text-green-400 font-medium">
                  <Play className="h-2.5 w-2.5" /> \u89c6\u9891:
                </span>
                <span className="text-muted-foreground">
                  {getPromptByLanguage(scene.videoPromptZh, scene.videoPrompt) || '\u672a\u8bbe\u7f6e'}
                {scene.cameraMovement && scene.cameraMovement !== 'none' && (
                    <span className="ml-1 text-green-500/50">[{CAMERA_MOVEMENT_PRESETS.find(p => p.id === scene.cameraMovement)?.label || scene.cameraMovement}]</span>
                  )}
                  {scene.specialTechnique && scene.specialTechnique !== 'none' && (
                    <span className="ml-1 text-purple-500/50">[{SPECIAL_TECHNIQUE_PRESETS.find(p => p.id === scene.specialTechnique)?.label || scene.specialTechnique}]</span>
                  )}
                  {scene.duration && <span className="ml-1 text-green-500/50">{scene.duration}s</span>}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* giây\u6570 + \u955c\u5934 + cảm xúcbầu không khí（luôn hiển thị，\u4e0d\u968f\u63d0\u793a\u8bcd\u6298\u53e0） */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* giây\u6570 */}
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground">giây\u6570:</span>
              <DurationSelector
                value={scene.duration || 5}
                onChange={(v) => onUpdateDuration(scene.id, v)}
                disabled={isGeneratingAny}
              />
            </div>
            {/* \u955c\u5934các môn thể thao */}
            <div className="flex items-center gap-1">
              <Select
                value={scene.cameraMovement || 'none'}
                onValueChange={(v) => onUpdateField?.(scene.id, 'cameraMovement', v)}
                disabled={isGeneratingAny}
              >
                <SelectTrigger className="h-6 text-[10px] px-1.5 min-w-0 w-auto max-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMERA_MOVEMENT_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[11px]">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Kỹ thuật chụp đặc biệt */}
            <div className="flex items-center gap-1">
              <Select
                value={scene.specialTechnique || 'none'}
                onValueChange={(v) => onUpdateField?.(scene.id, 'specialTechnique', v)}
                disabled={isGeneratingAny}
              >
                <SelectTrigger className="h-6 text-[10px] px-1.5 min-w-0 w-auto max-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPECIAL_TECHNIQUE_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[11px]">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* góc chụp */}
            <div className="flex items-center gap-1">
              <Select
                value={scene.cameraAngle || 'eye-level'}
                onValueChange={(v) => onUpdateField?.(scene.id, 'cameraAngle', v)}
                disabled={isGeneratingAny}
              >
                <SelectTrigger className="h-6 text-[10px] px-1.5 min-w-0 w-auto max-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMERA_ANGLE_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[11px]">
                      {p.emoji} {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* tiêu cự */}
            <div className="flex items-center gap-1">
              <Select
                value={scene.focalLength || '50mm'}
                onValueChange={(v) => onUpdateField?.(scene.id, 'focalLength', v)}
                disabled={isGeneratingAny}
              >
                <SelectTrigger className="h-6 text-[10px] px-1.5 min-w-0 w-auto max-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOCAL_LENGTH_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[11px]">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* kỹ thuật chụp ảnh */}
            <div className="flex items-center gap-1">
              <Select
                value={scene.photographyTechnique || 'none'}
                onValueChange={(v) => onUpdateField?.(scene.id, 'photographyTechnique', v === 'none' ? undefined : v)}
                disabled={isGeneratingAny}
              >
                <SelectTrigger className="h-6 text-[10px] px-1.5 min-w-0 w-auto max-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-[11px]">không cóKỹ thuật</SelectItem>
                  {PHOTOGRAPHY_TECHNIQUE_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[11px]">
                      {p.emoji} {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* \u673a\u4f4d\u63cf\u8ff0（AI \u751f\u6210củavăn bản miễn phí） */}
          {scene.cameraPosition && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground shrink-0">\u673a\u4f4d:</span>
              <span className="text-[10px] text-muted-foreground/80 truncate">{scene.cameraPosition}</span>
            </div>
          )}
          {/* cảm xúcbầu không khí */}
          <div>
            <EmotionTags
              value={scene.emotionTags || []}
              onChange={(tags) => onUpdateEmotions(scene.id, tags)}
              disabled={isGeneratingAny}
            />
          </div>
        </div>

        {/* Không.bốn\u6392：\u97f3\u9891\u63a7\u5236（âm thanh xung quanh/Hiệu ứng âm thanh/đối thoại） */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground mb-0.5 block">\u97f3\u9891\u63a7\u5236</Label>
          {/* âm thanh xung quanh */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpdateField?.(scene.id, 'audioAmbientEnabled', scene.audioAmbientEnabled === false)}
              disabled={isGeneratingAny}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded shrink-0 w-12 text-center transition-colors",
                scene.audioAmbientEnabled !== false
                  ? "bg-green-500/20 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground line-through"
              )}
            >
              âm thanh xung quanh
            </button>
            <input
              type="text"
              value={scene.ambientSound || ''}
              onChange={(e) => onUpdateAmbientSound(scene.id, e.target.value)}
              placeholder="Âm thanh của gió、tiếng mưa、Tiếng chim hót..."
              disabled={isGeneratingAny || scene.audioAmbientEnabled === false}
              className="flex-1 h-6 px-1.5 text-[10px] rounded border bg-transparent disabled:opacity-40 placeholder:text-muted-foreground/30"
            />
          </div>
          {/* Hiệu ứng âm thanh */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpdateField?.(scene.id, 'audioSfxEnabled', scene.audioSfxEnabled === false)}
              disabled={isGeneratingAny}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded shrink-0 w-12 text-center transition-colors",
                scene.audioSfxEnabled !== false
                  ? "bg-green-500/20 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground line-through"
              )}
            >
              Hiệu ứng âm thanh
            </button>
            <input
              type="text"
              value={scene.soundEffectText || ''}
              onChange={(e) => onUpdateField?.(scene.id, 'soundEffectText', e.target.value)}
              placeholder="bước chân、cửa\u5173\u58f0..."
              disabled={isGeneratingAny || scene.audioSfxEnabled === false}
              className="flex-1 h-6 px-1.5 text-[10px] rounded border bg-transparent disabled:opacity-40 placeholder:text-muted-foreground/30"
            />
          </div>
          {/* đối thoại */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpdateField?.(scene.id, 'audioDialogueEnabled', scene.audioDialogueEnabled === false)}
              disabled={isGeneratingAny}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded shrink-0 w-12 text-center transition-colors",
                scene.audioDialogueEnabled !== false
                  ? "bg-green-500/20 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground line-through"
              )}
            >
              đối thoại
            </button>
            <input
              type="text"
              value={scene.dialogue || ''}
              onChange={(e) => onUpdateField?.(scene.id, 'dialogue', e.target.value)}
              placeholder="\u89d2\u8272dòng..."
              disabled={isGeneratingAny || scene.audioDialogueEnabled === false}
              className="flex-1 h-6 px-1.5 text-[10px] rounded border bg-transparent disabled:opacity-40 placeholder:text-muted-foreground/30"
            />
          </div>
          {/* \u80cc\u666fâm nhạc */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpdateField?.(scene.id, 'audioBgmEnabled', !(scene.audioBgmEnabled === true))}
              disabled={isGeneratingAny}
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded shrink-0 w-12 text-center transition-colors",
                scene.audioBgmEnabled === true
                  ? "bg-green-500/20 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground line-through"
              )}
            >
              âm nhạc
            </button>
            <input
              type="text"
              value={scene.backgroundMusic || ''}
              onChange={(e) => onUpdateField?.(scene.id, 'backgroundMusic', e.target.value)}
              placeholder="\u9ed8\u8ba4\u7981\u6b62\u80cc\u666fâm nhạc，nếu cần thiết\u8bf7\u5f00\u542f\u5e76\u586b\u5199..."
              disabled={isGeneratingAny || scene.audioBgmEnabled !== true}
              className="flex-1 h-6 px-1.5 text-[10px] rounded border bg-transparent disabled:opacity-40 placeholder:text-muted-foreground/30"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
