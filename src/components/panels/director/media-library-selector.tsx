// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Chất liệu\u5e93\u9009\u62e9\u5668\u7ec4\u4ef6 (Media Library Selector)
 * từChất liệu\u5e93trong\u9009\u62e9\u56fe\u7247\u5e94sử dụngĐến\u5206\u955ckhung hình đầu tiên/\u5c3e\u5e27
 */

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, ImageIcon, FolderOpen, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useMediaStore } from "@/stores/media-store";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useProjectStore } from "@/stores/project-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MediaLibrarySelectorProps {
  sceneId: number;
  isEndFrame?: boolean;
  onSelect: (imageUrl: string) => void;
  disabled?: boolean;
}

export function MediaLibrarySelector({
  sceneId: _sceneId,
  isEndFrame = false,
  onSelect,
  disabled,
}: MediaLibrarySelectorProps) {
  void _sceneId; // Available for future use
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  const { mediaFiles, folders } = useMediaStore();
  const { resourceSharing } = useAppSettingsStore();
  const { activeProjectId } = useProjectStore();
  
  const visibleFolders = useMemo(() => {
    if (resourceSharing.shareMedia) return folders;
    if (!activeProjectId) return [];
    return folders.filter((f) => f.projectId === activeProjectId);
  }, [folders, resourceSharing.shareMedia, activeProjectId]);
  
  const visibleMedia = useMemo(() => {
    if (resourceSharing.shareMedia) return mediaFiles;
    if (!activeProjectId) return [];
    return mediaFiles.filter((m) => m.projectId === activeProjectId);
  }, [mediaFiles, resourceSharing.shareMedia, activeProjectId]);
  
  // \u53ea\u83b7\u53d6\u56fe\u7247\u7c7b\u578bcủa\u5a92\u4f53\u6587\u4ef6（\u975e\u4e34\u65f6）
  const imageFiles = useMemo(() => 
    visibleMedia.filter(f => f.type === 'image' && !f.ephemeral),
    [visibleMedia]
  );
  
  // \u6839\u636eđã chọncủa\u6587\u4ef6\u5939\u7b5b\u9009\u56fe\u7247
  const filteredImages = useMemo(() => {
    if (selectedFolderId === null) {
      return imageFiles; // \u663e\u793a\u6240Có
    }
    return imageFiles.filter(f => f.folderId === selectedFolderId);
  }, [imageFiles, selectedFolderId]);
  
  // \u5904\u7406\u9009\u62e9\u56fe\u7247
  const handleSelectImage = (imageUrl: string) => {
    onSelect(imageUrl);
    setIsOpen(false);
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded border border-dashed text-xs transition-colors disabled:opacity-50",
            "border-purple-500/30 text-purple-400 hover:border-purple-500/50 hover:text-purple-300 hover:bg-purple-500/5"
          )}
        >
          <ImageIcon className="h-3 w-3" />
          <span className="max-w-[80px] truncate">
            {isEndFrame ? 'từChất liệu\u5e93' : 'từChất liệu\u5e93'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">
            \u9009\u62e9\u56fe\u7247\u5e94sử dụngĐến{isEndFrame ? '\u5c3e\u5e27' : 'khung hình đầu tiên'}
          </p>
          <span className="text-xs text-muted-foreground">
            tổng cộng {filteredImages.length} \u5f20\u56fe\u7247
          </span>
        </div>
        
        {imageFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Chất liệu\u5e93trong\u6ca1Có\u56fe\u7247，\u8bf7đầu tiên\u6dfb\u52a0\u56fe\u7247hoặc\u751f\u6210bốncung điện\u683c
          </p>
        ) : (
          <div className="space-y-3">
            {/* \u6587\u4ef6\u5939\u7b5b\u9009 */}
            {visibleFolders.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className={cn(
                    "px-2 py-1 rounded text-xs transition-colors",
                    selectedFolderId === null
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  Tất cả
                </button>
                {visibleFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-colors flex items-center gap-1",
                      selectedFolderId === folder.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    <FolderOpen className="h-3 w-3" />
                    {folder.name}
                  </button>
                ))}
              </div>
            )}
            
            {/* \u56fe\u7247\u7f51\u683c */}
            <div className="max-h-[300px] overflow-y-auto">
              {filteredImages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  \u8be5\u6587\u4ef6\u5939trong\u6ca1Có\u56fe\u7247
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {filteredImages.map((img) => {
                    const imageUrl = img.url || img.thumbnailUrl || '';
                    if (!imageUrl) return null;
                    
                    return (
                      <button
                        key={img.id}
                        onClick={() => handleSelectImage(imageUrl)}
                        className="relative group aspect-video rounded overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                      >
                        <img
                          src={imageUrl}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                        {/* \u60ac\u505c\u906e\u7f69 */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Check className="h-6 w-6 text-white" />
                        </div>
                        {/* \u6587\u4ef6tên */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                          <span className="text-[9px] text-white truncate block">
                            {img.name}
                          </span>
                        </div>
                        {/* AI \u6807\u8bb0 */}
                        {img.source === 'ai-image' && (
                          <span className="absolute top-1 left-1 text-[8px] bg-primary text-white px-1 rounded">
                            AI
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
