// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * ShotGroupCard — lớp S\u5206\u7ec4\u5bb9\u5668\u7ec4\u4ef6
 *
 * \u663e\u793amột\u7ec4Cảnh quaycủa\u805a\u5408thông tin：
 * - \u7ec4\u5934：Tên nhóm + Cảnh quay\u6570 + Tổng Thời lượng\u9884\u7b97\u6761
 * - cấp độ nhómThao tác：Tạo video / Mở rộng\u6298\u53e0
 * - Mở rộng\u540ekết xuấtbên trong\u90e8của SceneCard danh sách
 * - cấp độ nhómVideoKết quả\u663e\u793a
 */

import React, { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  Film,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  Image as ImageIcon,
  Download,
  Copy,
  ZoomIn,
  Sparkles,
  Timer,
  Scissors,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SplitScene } from "@/stores/director-store";
import type { Character } from "@/stores/character-library-store";
import type { Scene } from "@/stores/scene-store";
import type { ShotGroup } from "@/stores/sclass-store";
import { recalcGroupDuration } from "./auto-grouping";
import { GroupRefManager } from "./group-ref-manager";

// ==================== Types ====================

export interface ShotGroupCardProps {
  group: ShotGroup;
  /** \u7ec4bên trongcủa SplitScene \u6570\u636e */
  scenes: SplitScene[];
  /** Tất cả SplitScene (cho Thời lượngTính toán) */
  allScenes: SplitScene[];
  /** \u7ec4\u7d22\u5f15 (0-based) */
  groupIndex: number;
  /** \u662f\u5426\u6b63\u5728tình hình chungTạotrong */
  isGeneratingAny: boolean;
  /** kết xuấtĐơn Cảnh quay\u5361\u7247củagọi lại */
  renderSceneCard: (scene: SplitScene) => React.ReactNode;
  /** cấp độ nhómVideoTạogọi lại */
  onGenerateGroupVideo?: (groupId: string) => void;
  /** cấp độ nhóm AI \u6821\u51c6gọi lại */
  onCalibrateGroup?: (groupId: string) => void;
  /** Videomở rộnggọi lại */
  onExtendGroup?: (groupId: string) => void;
  /** VideoChỉnh sửagọi lại */
  onEditGroup?: (groupId: string) => void;
  /** Mặc địnhMở rộng */
  defaultExpanded?: boolean;
  /** Thư viện nhân vật\u6570\u636e（sử dụng\u4e8e @\u5f15sử dụng\u7ba1\u7406） */
  characters?: Character[];
  /** Thư viện cảnh dữ liệu（sử dụng\u4e8e @\u5f15sử dụng\u7ba1\u7406） */
  sceneLibrary?: Scene[];
}

// ==================== Component ====================

export function ShotGroupCard({
  group,
  scenes,
  allScenes,
  groupIndex,
  isGeneratingAny,
  renderSceneCard,
  onGenerateGroupVideo,
  onCalibrateGroup,
  onExtendGroup,
  onEditGroup,
  defaultExpanded = false,
  characters = [],
  sceneLibrary = [],
}: ShotGroupCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showRefManager, setShowRefManager] = useState(false);
  const [gridPreviewOpen, setGridPreviewOpen] = useState(false);

  /** Tải xuốngbiểu đồ lưới */
  const handleDownloadGrid = useCallback(() => {
    if (!group.gridImageUrl) return;
    const a = document.createElement('a');
    a.href = group.gridImageUrl;
    a.download = `${group.name}_grid.png`;
    a.click();
  }, [group.gridImageUrl, group.name]);

  /** \u590d\u5236 prompt */
  const handleCopyPrompt = useCallback(() => {
    if (!group.lastPrompt) return;
    navigator.clipboard.writeText(group.lastPrompt).then(() => {
      toast.success('PromptĐã rồi\u590d\u5236Đến\u526a\u8d34\u677f');
    }).catch(() => {
      toast.error('\u590d\u5236Thất bại');
    });
  }, [group.lastPrompt]);

  // \u91cd\u65b0Tính toán\u5b9e\u9645Thời lượng
  const actualDuration = useMemo(
    () => recalcGroupDuration(group, allScenes),
    [group, allScenes],
  );

  const isOverBudget = actualDuration > 15;
  const budgetPercent = Math.min((actualDuration / 15) * 100, 100);
  const isGenerating = group.videoStatus === "generating";
  const isCompleted = group.videoStatus === "completed";
  const isFailed = group.videoStatus === "failed";
  const hasImages = scenes.some((s) => s.imageDataUrl || s.imageHttpUrl);
  const isCalibrating = group.calibrationStatus === 'calibrating';
  const isCalibrated = group.calibrationStatus === 'done';
  const isCalibrationFailed = group.calibrationStatus === 'failed';
  const isExtendChild = group.generationType === 'extend';
  const isEditChild = group.generationType === 'edit';
  const isChildGroup = isExtendChild || isEditChild;

  // \u7ec4bên trong\u5404CảT of nh quayhời lượng\u6bb5
  const durationSegments = useMemo(() => {
    return scenes.map((s, idx) => ({
      id: s.id,
      duration: s.duration > 0 ? s.duration : 5,
      label: `Cảnh quay${idx + 1}`,
    }));
  }, [scenes]);

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden",
        isOverBudget && "border-red-500/50",
        isCompleted && "border-green-500/30",
        isFailed && "border-red-500/30",
        isExtendChild && "border-l-4 border-l-purple-500",
        isEditChild && "border-l-4 border-l-orange-500",
      )}
    >
      {/* ========== \u7ec4\u5934 ========== */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 cursor-pointer select-none",
          "bg-muted/30 hover:bg-muted/50 transition-colors",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* \u6298\u53e0\u56fe\u6807 */}
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        {/* Tên nhóm */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">{group.name}</span>
          {isExtendChild && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full shrink-0">mở rộng</span>
          )}
          {isEditChild && (
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full shrink-0">Chỉnh sửa</span>
          )}
        </div>

        {/* Cảnh quay\u6570 */}
        <span className="text-xs text-muted-foreground shrink-0">
          {group.sceneIds.length} Cảnh quay
        </span>

        {/* Thời lượngnhãn */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded shrink-0",
                  isOverBudget
                    ? "bg-red-500/10 text-red-500"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Clock className="h-3 w-3" />
                <span>
                  {actualDuration}s / 15s
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isOverBudget ? (
                <p>Tổng Thời lượng\u8d85\u51fa 15s \u9650\u5236！\u8bf7\u51cf\u5c11Cảnh quayhoặc\u7f29\u77edthấu kính đơn Thời lượng。</p>
              ) : (
                <p>
                  \u7ec4bên trong {group.sceneIds.length} Cảnh quay，Tổng Thời lượng {actualDuration}
                  s
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Trạng thái\u6807\u8bb0 */}
        {isCompleted && (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
        )}
        {isFailed && (
          <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
        )}

        {/* @\u5f15sử dụng\u6570\u91cf\u6807\u8bb0 */}
        {((group.videoRefs?.length || 0) + (group.audioRefs?.length || 0)) > 0 && (
          <div className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
            <Paperclip className="h-3 w-3" />
            <span>{(group.videoRefs?.length || 0) + (group.audioRefs?.length || 0)}</span>
          </div>
        )}

        {/* \u53f3\u4fa7Thao tácQuận */}
        <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* @\u5f15sử dụng\u7ba1\u7406\u6309\u94ae */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setShowRefManager(!showRefManager)}
          >
            <Paperclip className="h-3 w-3 mr-1" />
            @\u5f15sử dụng
          </Button>
          {/* AI \u6821\u51c6\u6309\u94ae */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isCalibrated ? "outline" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs",
                    isCalibrated && "border-purple-500/50 text-purple-600 dark:text-purple-400",
                  )}
                  disabled={isCalibrating || isGenerating}
                  onClick={() => onCalibrateGroup?.(group.id)}
                >
                  {isCalibrating ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  {isCalibrating ? '\u6821\u51c6trong' : isCalibrated ? 'đã hiệu chuẩn' : 'Hiệu chuẩn AI'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isCalibrated
                  ? <p>Đã hoàn thành AI \u6821\u51c6，\u70b9\u51fb\u91cd\u65b0\u6821\u51c6</p>
                  : <p>AI Phân tích\u7ec4bên trongCảnh quay，Tạo\u53d9\u4e8b\u5f27\u7ebf、Chuyển tiếp\u8bbe\u8ba1、\u4f18\u5316 prompt</p>
                }
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Tạo\u6309\u94ae */}
          <Button
            variant={isCompleted ? "outline" : "default"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            disabled={isGeneratingAny || (!hasImages && !isChildGroup) || isOverBudget}
            onClick={() => onGenerateGroupVideo?.(group.id)}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Tạotrong
              </>
            ) : isCompleted ? (
              <>
                <Film className="h-3 w-3 mr-1" />
                \u91cd\u65b0Tạo
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                Tạo video
              </>
            )}
          </Button>
          {/* mở rộng/Chỉnh sửa\u6309\u94ae（\u4ec5Đã hoàn thành\u666e\u901a\u7ec4\u663e\u793a） */}
          {isCompleted && !isChildGroup && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                      disabled={isGeneratingAny}
                      onClick={() => onExtendGroup?.(group.id)}
                    >
                      <Timer className="h-3 w-3 mr-1" />
                      mở rộng
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Dựa trênhiện tạiVideotiếp tụcmở rộng，\u53ef\u5411\u540ehoặc\u5411\u524d\u62d3\u5c55</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                      disabled={isGeneratingAny}
                      onClick={() => onEditGroup?.(group.id)}
                    >
                      <Scissors className="h-3 w-3 mr-1" />
                      Chỉnh sửa
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>\u5bf9hiện tạiVideo\u8fdbđược rồi\u5267\u60c5Chỉnh sửa、Nhân vậtthay thế、\u5c5e\u6027SửaĐợi đã</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>

      {/* ========== Thời lượng\u9884\u7b97\u6761 ========== */}
      <div className="px-3 py-1 bg-muted/10">
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
          {durationSegments.map((seg, idx) => {
            const segPercent = (seg.duration / 15) * 100;
            const colors = [
              "bg-blue-500",
              "bg-cyan-500",
              "bg-teal-500",
              "bg-emerald-500",
              "bg-violet-500",
              "bg-pink-500",
            ];
            return (
              <TooltipProvider key={seg.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "h-full transition-all",
                        colors[idx % colors.length],
                        idx > 0 && "border-l border-background",
                      )}
                      style={{ width: `${segPercent}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {seg.label}: {seg.duration}s
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
          {/* \u5269\u4f59\u7a7a\u95f4 */}
          {budgetPercent < 100 && (
            <div
              className="h-full bg-muted/50"
              style={{ width: `${100 - budgetPercent}%` }}
            />
          )}
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {durationSegments.map((s) => `${s.duration}s`).join(" + ")} ={" "}
            {actualDuration}s
          </span>
          {isOverBudget && (
            <span className="text-[10px] text-red-500 font-medium">
              \u8d85\u51fa {actualDuration - 15}s
            </span>
          )}
        </div>
      </div>

      {/* ========== AI \u6821\u51c6kết quảXem trước ========== */}
      {(isCalibrated || isCalibrationFailed) && (
        <div className="px-3 py-2 border-t bg-purple-500/5 space-y-1.5">
          {isCalibrated && group.narrativeArc && (
            <div className="flex items-start gap-1.5">
              <Sparkles className="h-3 w-3 text-purple-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">\u53d9\u4e8b\u5f27\u7ebf</span>
                <p className="text-xs text-muted-foreground mt-0.5">{group.narrativeArc}</p>
              </div>
            </div>
          )}
          {isCalibrated && group.transitions && group.transitions.length > 0 && (
            <div className="flex items-start gap-1.5">
              <ChevronRight className="h-3 w-3 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">Chuyển tiếp\u8bbe\u8ba1</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {group.transitions.map((t, i) => `${i + 1}→${i + 2}: ${t}`).join('；')}
                </p>
              </div>
            </div>
          )}
          {isCalibrationFailed && group.calibrationError && (
            <div className="flex items-start gap-1.5">
              <AlertCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
              <span className="text-xs text-red-500">Hiệu chỉnh Thất bại：{group.calibrationError}</span>
            </div>
          )}
        </div>
      )}

      {/* ========== TạoKết quảQuận（biểu đồ lưới + Prompt + Video） ========== */}
      {(group.gridImageUrl || group.lastPrompt || group.videoUrl) && (
        <div className="px-3 py-2 border-t bg-muted/5 space-y-2">
          {/* biểu đồ lướiXem trước + Tải xuống */}
          {group.gridImageUrl && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs text-blue-600 dark:text-blue-400">biểu đồ lưới</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setGridPreviewOpen(!gridPreviewOpen)}>
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleDownloadGrid}>
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {/* \u7f29\u7565\u56fe（\u59cb\u7ec8\u663e\u793a） */}
              <img
                src={group.gridImageUrl}
                alt="Grid preview"
                className={cn(
                  "rounded cursor-pointer transition-all",
                  gridPreviewOpen ? "w-full" : "w-32 h-20 object-cover",
                )}
                onClick={() => setGridPreviewOpen(!gridPreviewOpen)}
              />
            </div>
          )}

          {/* Prompt \u590d\u5236 */}
          {group.lastPrompt && (
            <div>
              <div className="flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs text-orange-600 dark:text-orange-400">Tạo Prompt</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto text-xs" onClick={handleCopyPrompt}>
                  <Copy className="h-3 w-3 mr-1" />
                  \u590d\u5236
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap break-all">
                {group.lastPrompt}
              </p>
            </div>
          )}

          {/* VideoXem trước */}
          {group.videoUrl && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Film className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs text-green-600 dark:text-green-400">VideoĐã Tạo</span>
              </div>
              <video
                src={group.videoUrl}
                controls
                className="w-full max-h-48 rounded"
                preload="metadata"
              />
            </div>
          )}
        </div>
      )}

      {/* Lỗtôi thông tin */}
      {isFailed && group.videoError && (
        <div className="px-3 py-1.5 border-t bg-red-500/5">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
            <span className="text-xs text-red-500">{group.videoError}</span>
          </div>
        </div>
      )}

      {/* ========== @\u5f15sử dụng\u7ba1\u7406\u9762\u677f ========== */}
      {showRefManager && (
        <GroupRefManager
          group={group}
          scenes={scenes}
          characters={characters}
          sceneLibrary={sceneLibrary}
          readOnly={isGenerating}
        />
      )}

      {/* ========== Mở rộng's Cảnh quay\u5361\u7247danh sách ========== */}
      {expanded && (
        <div className="border-t">
          <div className="flex flex-col gap-2 p-2">
            {scenes.map((scene) => (
              <div key={scene.id}>{renderSceneCard(scene)}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
