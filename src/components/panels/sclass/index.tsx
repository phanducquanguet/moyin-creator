// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * lớp S\u9762\u677f — Seedance 2.0 \u591a\u6a21\u6001\u521b\u4f5c\u677f\u5757
 * 
 * \u590dsử dụng director-store củaPhân cảnh dữ liệu（SplitScene[]），
 * \u4ee5「\u5206\u7ec4」chocốt lõi\u8fdbđược rồiNhiều Cảnh quay\u5408\u5e76\u53d9\u4e8bVideoTạo。
 * 
 * Hai loạichế độ：
 * - Phân cảnh chế độ：từKịch bản dây chuyền lắp ráp NhậpcủaPhân cảnh，\u6309Nhóm Tạo video
 * - chế độ miễn phí：Chất liệu nguyên chất Tải lên + Prompt（\u540e\u7eed\u5b9e\u73b0）
 */

import { useEffect } from "react";
import { useDirectorStore, useActiveDirectorProject } from "@/stores/director-store";
import { useProjectStore } from "@/stores/project-store";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { useSClassStore } from "@/stores/sclass-store";
import { SClassScenes } from "./sclass-scenes";
import { Button } from "@/components/ui/button";
import { Settings, Sparkles } from "lucide-react";

export function SClassView() {
  // Sync active project ID from project-store
  const { activeProjectId } = useProjectStore();
  const { setActiveProjectId, ensureProject } = useDirectorStore();
  const { setActiveProjectId: setSClassProjectId, ensureProject: ensureSClassProject } = useSClassStore();
  
  useEffect(() => {
    if (activeProjectId) {
      setActiveProjectId(activeProjectId);
      ensureProject(activeProjectId);
      // Sync sclass-store project as well
      setSClassProjectId(activeProjectId);
      ensureSClassProject(activeProjectId);
    }
  }, [activeProjectId, setActiveProjectId, ensureProject, setSClassProjectId, ensureSClassProject]);
  
  // Get current project data
  const projectData = useActiveDirectorProject();
  const splitScenes = projectData?.splitScenes || [];
  const storyboardStatus = projectData?.storyboardStatus || 'idle';
  
  const { setActiveTab } = useMediaPanelStore();

  // \u5224\u65ad\u662f\u5426CóPhân cảnh dữ liệuCó sẵn
  const hasSplitScenes = splitScenes.length > 0;
  
  // Render empty state when no split scenes available
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
      <Sparkles className="h-12 w-12 text-muted-foreground/30" />
      <div>
        <h3 className="font-medium text-sm mb-1">lớp S · Seedance 2.0 \u591a\u6a21\u6001\u521b\u4f5c</h3>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          \u8bf7\u5728\u53f3\u4fa7「Kịch bảcấu trúc」\u680ftrong，\u70b9\u51fb <span className="text-green-500 font-medium">+</span> ThêmPhân cảnhĐến\u672c\u9762\u677f，Hệ thống\u5c06\u81ea\u52a8\u5206\u7ec4\u8fdbđược rồiNhiều Cảnh quay\u5408\u5e76\u53d9\u4e8bVideoTạo。
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2 max-w-[280px]">
          Chẳng hạn như\u53f3\u4fa7\u672a\u663e\u793aKịch bảcấu trúc，\u8bf7đầu tiên\u5728「Kịch bản」\u9762\u677ftrongNhập\u5e76phân tích cú phápKịch bản。
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveTab('script')}
        >
          \u524d\u5f80Kịch bản\u9762\u677f
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 pb-2 bg-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">lớp S</h2>
            <span className="text-xs text-muted-foreground">Seedance 2.0</span>
          </div>
          <div className="flex items-center gap-2">
            {hasSplitScenes && (
              <span className="text-xs text-muted-foreground">
                {splitScenes.length} Phân cảnh
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="h-3 w-3 mr-1" />
              API
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 pt-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {hasSplitScenes || storyboardStatus === 'editing' ? (
          <SClassScenes />
        ) : (
          renderEmptyState()
        )}
      </div>
    </div>
  );
}
