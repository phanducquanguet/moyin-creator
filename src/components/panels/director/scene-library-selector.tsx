// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * \u573a\u666f\u5e93\u9009\u62e9\u5668\u7ec4\u4ef6 (Scene Library Selector)
 * \u652f\u6301ba\u5c42\u9009\u62e9：\u7236\u573a\u666f → \u89c6\u89d2thay đổi\u4f53 → bốn\u89c6\u56fe\u5b50\u573a\u666f
 */

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, Layers, MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useSceneStore } from "@/stores/scene-store";
import { useResolvedImageUrl } from "@/hooks/use-resolved-image-url";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useProjectStore } from "@/stores/project-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SceneLibrarySelectorProps {
  sceneId: number;
  selectedSceneLibraryId?: string;
  selectedViewpointId?: string;
  selectedSubViewId?: string;  // bốn\u89c6\u56fe\u5b50\u573a\u666f ID
  isEndFrame?: boolean;
  onChange: (
    sceneLibraryId: string | undefined, 
    viewpointId: string | undefined, 
    referenceImage: string | undefined, 
    subViewId?: string
  ) => void;
  disabled?: boolean;
}

/** phân tích cú pháp local-image:// hình thu nhỏ */
function ResolvedImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const resolved = useResolvedImageUrl(src);
  return <img src={resolved || ''} alt={alt} className={className} />;
}

export function SceneLibrarySelector({
  sceneId: _sceneId,
  selectedSceneLibraryId,
  selectedViewpointId,
  selectedSubViewId,
  isEndFrame = false,
  onChange,
  disabled,
}: SceneLibrarySelectorProps) {
  // sceneId is available for future use (e.g., logging, analytics)
  void _sceneId;
  const [isOpen, setIsOpen] = useState(false);
  const { scenes: libraryScenes } = useSceneStore();
  const { resourceSharing } = useAppSettingsStore();
  const { activeProjectId } = useProjectStore();
  
  const visibleScenes = useMemo(() => {
    if (resourceSharing.shareScenes) return libraryScenes;
    if (!activeProjectId) return [];
    return libraryScenes.filter((s) => s.projectId === activeProjectId);
  }, [libraryScenes, resourceSharing.shareScenes, activeProjectId]);
  
  // \u83b7\u53d6\u6240Có\u7236\u573a\u666f（\u975e\u89c6\u89d2thay đổi\u4f53）
  const parentScenes = useMemo(() => 
    visibleScenes.filter(s => !s.isViewpointVariant && !s.parentSceneId),
    [visibleScenes]
  );
  
  // \u6839\u636eđã chọncủa\u573a\u666f\u83b7\u53d6\u89c6\u89d2thay đổi\u4f53（Không.một\u5c42\u5b50\u573a\u666f）
  const viewpointScenes = useMemo(() => {
    if (!selectedSceneLibraryId) return [];
    return visibleScenes.filter(s => s.parentSceneId === selectedSceneLibraryId);
  }, [visibleScenes, selectedSceneLibraryId]);
  
  // \u6839\u636eđã chọncủa\u89c6\u89d2\u83b7\u53d6bốn\u89c6\u56fe\u5b50\u573a\u666f（Không.Hai\u5c42\u5b50\u573a\u666f）
  const subViewScenes = useMemo(() => {
    if (!selectedViewpointId) return [];
    return visibleScenes.filter(s => s.parentSceneId === selectedViewpointId);
  }, [visibleScenes, selectedViewpointId]);
  
  // \u83b7\u53d6hiện tạiđã chọncủa\u573a\u666fthông tin
  const selectedScene = useMemo(() => {
    if (!selectedSceneLibraryId) return null;
    return visibleScenes.find(s => s.id === selectedSceneLibraryId) || null;
  }, [visibleScenes, selectedSceneLibraryId]);
  
  const selectedViewpoint = useMemo(() => {
    if (!selectedViewpointId) return null;
    return visibleScenes.find(s => s.id === selectedViewpointId) || null;
  }, [visibleScenes, selectedViewpointId]);
  
  const selectedSubView = useMemo(() => {
    if (!selectedSubViewId) return null;
    return visibleScenes.find(s => s.id === selectedSubViewId) || null;
  }, [visibleScenes, selectedSubViewId]);
  
  // \u9009\u62e9\u573a\u666f
  const handleSelectScene = (sceneLibId: string) => {
    const scene = visibleScenes.find(s => s.id === sceneLibId);
    if (!scene) {
      onChange(undefined, undefined, undefined, undefined);
      return;
    }
    // đã chọn\u573a\u666f，\u6e05\u7a7a\u89c6\u89d2vàbốn\u89c6\u56fe
    const refImage = scene.referenceImage || scene.referenceImageBase64;
    onChange(sceneLibId, undefined, refImage, undefined);
  };
  
  // \u9009\u62e9\u89c6\u89d2
  const handleSelectViewpoint = (viewpointId: string) => {
    const viewpoint = visibleScenes.find(s => s.id === viewpointId);
    if (!viewpoint) {
      // \u6e05\u7a7a\u89c6\u89d2，sử dụng\u7236\u573a\u666fHình ảnh tham khảo
      const parentRefImage = selectedScene?.referenceImage || selectedScene?.referenceImageBase64;
      onChange(selectedSceneLibraryId, undefined, parentRefImage, undefined);
      return;
    }
    const refImage = viewpoint.referenceImage || viewpoint.referenceImageBase64;
    onChange(selectedSceneLibraryId, viewpointId, refImage, undefined);
  };
  
  // \u9009\u62e9bốn\u89c6\u56fe\u5b50\u573a\u666f
  const handleSelectSubView = (subViewId: string) => {
    const subView = visibleScenes.find(s => s.id === subViewId);
    if (!subView) {
      // \u6e05\u7a7abốn\u89c6\u56fe，sử dụng\u89c6\u89d2Hình ảnh tham khảo
      const viewpointRefImage = selectedViewpoint?.referenceImage || selectedViewpoint?.referenceImageBase64;
      onChange(selectedSceneLibraryId, selectedViewpointId, viewpointRefImage, undefined);
      return;
    }
    const refImage = subView.referenceImage || subView.referenceImageBase64;
    onChange(selectedSceneLibraryId, selectedViewpointId, refImage, subViewId);
  };
  
  // \u6e05\u7a7a\u9009\u62e9
  const handleClear = () => {
    onChange(undefined, undefined, undefined, undefined);
    setIsOpen(false);
  };
  
  // \u663e\u793a\u6587\u672c
  const displayText = useMemo(() => {
    if (!selectedScene) return isEndFrame ? '\u5c3e\u5e27\u573a\u666f' : '\u573a\u666fTài liệu tham khảo';
    if (selectedSubView) {
      return `${selectedScene.name}-${selectedViewpoint?.viewpointName || selectedViewpoint?.name}-${selectedSubView.viewpointName || selectedSubView.name}`;
    }
    if (selectedViewpoint) return `${selectedScene.name}-${selectedViewpoint.viewpointName || selectedViewpoint.name}`;
    return selectedScene.name;
  }, [selectedScene, selectedViewpoint, selectedSubView, isEndFrame]);
  
  // ĐúngKHÔNGCóđã chọn
  const hasSelection = !!selectedSceneLibraryId;
  
  // \u9884\u89c8Hình ảnh tham khảo（Trích xuấtĐến\u7ec4\u4ef6\u7ea7\u522b\u4ee5\u4fbfsử dụng hook）
  const previewRefImage = selectedSubView?.referenceImage || selectedSubView?.referenceImageBase64
    || selectedViewpoint?.referenceImage || selectedViewpoint?.referenceImageBase64
    || selectedScene?.referenceImage || (selectedScene as any)?.contactSheetImage || selectedScene?.referenceImageBase64
    || null;
  const resolvedPreview = useResolvedImageUrl(previewRefImage);
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded border border-dashed text-xs transition-colors disabled:opacity-50",
            hasSelection 
              ? "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10"
              : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"
          )}
        >
          <Layers className="h-3 w-3" />
          <span className="max-w-[80px] truncate">{displayText}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[720px] p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">
            {isEndFrame ? '\u9009\u62e9\u5c3e\u5e27\u573a\u666fTài liệu tham khảo' : '\u9009\u62e9\u573a\u666fTài liệu tham khảo'}
          </p>
          {hasSelection && (
            <button
              onClick={handleClear}
              className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80"
            >
              \u6e05\u7a7a\u9009\u62e9
            </button>
          )}
        </div>
        
        {parentScenes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            \u573a\u666f\u5e93cho\u7a7a，\u8bf7đầu tiên\u521b\u5efa\u573a\u666f
          </p>
        ) : (
          <div className="flex gap-3">
            {/* \u5de6\u4fa7：\u573a\u666f/\u89c6\u89d2/bốn\u89c6\u56fe\u9009\u62e9Cột */}
            <div className="flex gap-3 flex-1">
              {/* \u573a\u666f\u9009\u62e9 - Không.mộtCột */}
              <div className="w-[160px] shrink-0">
                <Label className="text-xs text-muted-foreground mb-2 block">\u573a\u666f</Label>
                <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
                  {parentScenes.map((s) => {
                    const isSelected = selectedSceneLibraryId === s.id;
                    const thumbnail = s.referenceImage || (s as any).contactSheetImage || s.referenceImageBase64;
                    const hasViewpoints = libraryScenes.some(v => v.parentSceneId === s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleSelectScene(s.id)}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded text-left transition-colors",
                          isSelected ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-muted"
                        )}
                      >
                      {thumbnail ? (
                          <ResolvedImg src={thumbnail} alt={s.name} className="w-12 h-12 rounded object-contain bg-muted shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                            <Layers className="h-4 w-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs truncate block">{s.name}</span>
                          {hasViewpoints && (
                            <span className="text-[10px] text-muted-foreground">Có\u89c6\u89d2</span>
                          )}
                        </div>
                        {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* \u89c6\u89d2\u9009\u62e9 - Không.HaiCột（nếu có） */}
              {selectedSceneLibraryId && viewpointScenes.length > 0 && (
                <div className="w-[140px] shrink-0 border-l pl-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">\u89c6\u89d2</Label>
                  <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
                    <button
                      onClick={() => handleSelectViewpoint('')}
                      className={cn(
                        "w-full flex items-center gap-2 p-1.5 rounded text-left transition-colors",
                        !selectedViewpointId ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-muted"
                      )}
                    >
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <MapPin className="h-3 w-3" />
                      </div>
                      <span className="text-xs">\u4e0d\u6307\u5b9a</span>
                      {!selectedViewpointId && <Check className="h-3 w-3 text-primary" />}
                    </button>
                    {viewpointScenes.map((v) => {
                      const isSelected = selectedViewpointId === v.id;
                      const thumbnail = v.referenceImage || v.referenceImageBase64;
                      const hasSubViews = libraryScenes.some(sub => sub.parentSceneId === v.id);
                      return (
                        <button
                          key={v.id}
                          onClick={() => handleSelectViewpoint(v.id)}
                          className={cn(
                            "w-full flex items-center gap-2 p-1.5 rounded text-left transition-colors",
                            isSelected ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-muted"
                          )}
                        >
                          {thumbnail ? (
                            <ResolvedImg src={thumbnail} alt={v.viewpointName || v.name} className="w-8 h-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                              <MapPin className="h-3 w-3" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs truncate block">{v.viewpointName || v.name}</span>
                            {hasSubViews && (
                              <span className="text-[10px] text-muted-foreground">Cóbốn\u89c6\u56fe</span>
                            )}
                          </div>
                          {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* bốn\u89c6\u56fe\u5b50\u573a\u666f\u9009\u62e9 - Không.baCột（nếu có） */}
              {selectedViewpointId && subViewScenes.length > 0 && (
                <div className="w-[120px] shrink-0 border-l pl-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">bốn\u89c6\u56fe</Label>
                  <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
                    <button
                      onClick={() => handleSelectSubView('')}
                      className={cn(
                        "w-full flex items-center gap-2 p-1.5 rounded text-left transition-colors",
                        !selectedSubViewId ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-muted"
                      )}
                    >
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <Layers className="h-3 w-3" />
                      </div>
                      <span className="text-xs">\u4e0d\u6307\u5b9a</span>
                      {!selectedSubViewId && <Check className="h-3 w-3 text-primary" />}
                    </button>
                    {subViewScenes.map((sv) => {
                      const isSelected = selectedSubViewId === sv.id;
                      const thumbnail = sv.referenceImage || sv.referenceImageBase64;
                      return (
                        <button
                          key={sv.id}
                          onClick={() => handleSelectSubView(sv.id)}
                          className={cn(
                            "w-full flex items-center gap-2 p-1.5 rounded text-left transition-colors",
                            isSelected ? "bg-primary/15 ring-1 ring-primary/50" : "hover:bg-muted"
                          )}
                        >
                          {thumbnail ? (
                            <ResolvedImg src={thumbnail} alt={sv.viewpointName || sv.name} className="w-8 h-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                              <Layers className="h-3 w-3" />
                            </div>
                          )}
                          <span className="flex-1 text-xs truncate">{sv.viewpointName || sv.name}</span>
                          {isSelected && <Check className="h-3 w-3 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            {/* bên phải：Hình ảnh tham khảo\u9884\u89c8 */}
            <div className="w-[240px] shrink-0 border-l pl-3">
              <Label className="text-xs text-muted-foreground mb-2 block">Hình ảnh tham khảo\u9884\u89c8</Label>
              {previewRefImage ? (
                <div className="w-full rounded-lg bg-muted flex items-center justify-center min-h-[120px] max-h-[240px] overflow-hidden">
                  <ResolvedImg src={previewRefImage} alt="Hình ảnh tham khảo" className="max-w-full max-h-[240px] rounded-lg object-contain" />
                </div>
              ) : (
                <div className="w-full aspect-video rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">\u8bf7\u9009\u62e9\u573a\u666f</span>
                </div>
              )}
              {/* đã chọn\u8def\u5f84\u663e\u793a */}
              {hasSelection && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="text-foreground">{selectedScene?.name}</span>
                  {selectedViewpoint && (
                    <> › <span className="text-foreground">{selectedViewpoint.viewpointName || selectedViewpoint.name}</span></>
                  )}
                  {selectedSubView && (
                    <> › <span className="text-foreground">{selectedSubView.viewpointName || selectedSubView.name}</span></>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
