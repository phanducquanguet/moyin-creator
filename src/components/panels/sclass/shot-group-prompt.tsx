// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * ShotGroupPrompt — lớp Scấp độ nhómPromptChỉnh sửa\u5668
 *
 * chức năng：
 * - \u81ea\u52a8\u8c03sử dụng sclass-prompt-builder \u7ec4\u88c5Nhiều Cảnh quay prompt
 * - \u663e\u793a @\u5f15sử dụngnhãn（Nhân vật\u56fe/Cảnh\u56fe/khung hình đầu tiên/Video/Âm thanh）+ \u914d\u989d
 * - Người dùng can Chỉnh sửa/\u8986\u76d6\u81ea\u52a8 prompt
 * - \u5b9e\u65f6từ\u7b26\u8ba1\u6570（5000\u4e0a\u9650）
 * - Đối thoại\u5507\u5f62\u540c\u6b65Xem trước
 */

import React, { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ImageIcon,
  Film,
  Music,
  AlertCircle,
  RotateCcw,
  Edit3,
  Check,
  MessageCircle,
  FileText,
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
import type { ShotGroup, SClassAspectRatio } from "@/stores/sclass-store";
import {
  buildGroupPrompt,
  estimateGroupRefs,
  SEEDANCE_LIMITS,
  type GroupPromptResult,
} from "./sclass-prompt-builder";

// ==================== Props ====================

export interface ShotGroupPromptProps {
  group: ShotGroup;
  scenes: SplitScene[];
  characters: Character[];
  sceneLibrary: Scene[];
  styleTokens?: string[];
  aspectRatio?: SClassAspectRatio;
  enableLipSync?: boolean;
  /** Khi Người dùngChỉnh sửa prompt \u65f6gọi lại */
  onUpdatePrompt?: (groupId: string, prompt: string) => void;
  /** \u662f\u5426\u53ea\u8bfb */
  readOnly?: boolean;
}

// ==================== Component ====================

export function ShotGroupPrompt({
  group,
  scenes,
  characters,
  sceneLibrary,
  styleTokens,
  aspectRatio,
  enableLipSync = true,
  onUpdatePrompt,
  readOnly = false,
}: ShotGroupPromptProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // \u6784\u5efa prompt
  const result: GroupPromptResult = useMemo(
    () =>
      buildGroupPrompt({
        group,
        scenes,
        characters,
        sceneLibrary,
        styleTokens,
        aspectRatio,
        enableLipSync,
      }),
    [group, scenes, characters, sceneLibrary, styleTokens, aspectRatio, enableLipSync]
  );

  // @\u5f15sử dụng\u9884\u4f30（\u8f7b\u91cf）
  const refEstimate = useMemo(
    () => estimateGroupRefs(group, scenes),
    [group, scenes]
  );

  // Bắt đầuChỉnh sửa
  const handleStartEdit = useCallback(() => {
    setEditValue(result.prompt);
    setIsEditing(true);
  }, [result.prompt]);

  // LưuChỉnh sửa
  const handleSave = useCallback(() => {
    onUpdatePrompt?.(group.id, editValue);
    setIsEditing(false);
  }, [group.id, editValue, onUpdatePrompt]);

  // Đặt lạichoTự động Tạo
  const handleReset = useCallback(() => {
    onUpdatePrompt?.(group.id, "");
    setIsEditing(false);
  }, [group.id, onUpdatePrompt]);

  const displayPrompt = isEditing ? editValue : result.prompt;
  const charCount = displayPrompt.length;
  const isOverLimit = charCount > SEEDANCE_LIMITS.maxPromptChars;

  return (
    <div className="space-y-2">
      {/* ========== @\u5f15sử dụng\u914d\u989d\u6761 ========== */}
      <div className="flex items-center gap-3 text-xs">
        {/* Hình ảnh\u914d\u989d */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded",
                  result.refs.images.length > SEEDANCE_LIMITS.maxImages
                    ? "bg-red-500/10 text-red-500"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                )}
              >
                <ImageIcon className="h-3 w-3" />
                <span>
                  {result.refs.images.length}/{SEEDANCE_LIMITS.maxImages}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1">
                <p className="font-medium">Hình ảnh tham khảo ({result.refs.images.length}/{SEEDANCE_LIMITS.maxImages})</p>
                {result.refs.images.map((r) => (
                  <p key={r.id} className="text-muted-foreground">
                    {r.tag}: {r.fileName}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Video\u914d\u989d */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded",
                  result.refs.videos.length > 0
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Film className="h-3 w-3" />
                <span>
                  {result.refs.videos.length}/{SEEDANCE_LIMITS.maxVideos}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Trích dẫn video ({result.refs.videos.length}/{SEEDANCE_LIMITS.maxVideos})
                {result.refs.videos.length === 0 && " — \u53ef\u5728Cảnh quay\u5361\u7247trongTải lên"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Âm thanh\u914d\u989d */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded",
                  result.refs.audios.length > 0
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Music className="h-3 w-3" />
                <span>
                  {result.refs.audios.length}/{SEEDANCE_LIMITS.maxAudios}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Âm thanh quote ({result.refs.audios.length}/{SEEDANCE_LIMITS.maxAudios})
                {result.refs.audios.length === 0 && " — \u53ef\u5728Cảnh quay\u5361\u7247trongTải lên"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* đối thoại\u6570 */}
        {result.dialogueSegments.length > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <MessageCircle className="h-3 w-3" />
            <span>{result.dialogueSegments.length} \u6bb5đối thoại</span>
          </div>
        )}

        {/* \u8d85\u9650Cảnh báo */}
        {result.refs.overLimit && (
          <div className="flex items-center gap-1 text-red-500">
            <AlertCircle className="h-3 w-3" />
            <span>Chất liệu\u8d85\u9650</span>
          </div>
        )}

        {/* từ\u7b26\u6570 */}
        <div
          className={cn(
            "ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded",
            isOverLimit
              ? "bg-red-500/10 text-red-500"
              : "bg-muted text-muted-foreground"
          )}
        >
          <FileText className="h-3 w-3" />
          <span>
            {charCount}/{SEEDANCE_LIMITS.maxPromptChars}
          </span>
        </div>
      </div>

      {/* ========== Prompt Chỉnh sửaQuận ========== */}
      <div className="relative">
        {isEditing ? (
          <div className="space-y-1.5">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={8}
              className={cn(
                "text-xs font-mono resize-y",
                isOverLimit && "border-red-500"
              )}
              placeholder="cấp độ nhómPrompt..."
            />
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleSave}
              >
                <Check className="h-3 w-3 mr-1" />
                Lưu
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setIsEditing(false)}
              >
                Huỷ
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs ml-auto"
                onClick={handleReset}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Đặt lạicho\u81ea\u52a8
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "text-xs bg-muted/30 rounded-md p-2 max-h-32 overflow-y-auto cursor-pointer hover:bg-muted/50 transition-colors group",
              "whitespace-pre-wrap font-mono",
              readOnly && "cursor-default hover:bg-muted/30"
            )}
            onClick={readOnly ? undefined : handleStartEdit}
          >
            {/* Chỉnh sửaGợi ý */}
            {!readOnly && (
              <div className="float-right opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit3 className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            {/* Prompt Xem trước：\u9ad8\u4eae @\u5f15sử dụngnhãn */}
            {highlightRefs(displayPrompt)}
          </div>
        )}
      </div>

      {/* ========== \u8d85\u9650Cảnh báoChi tiết ========== */}
      {result.refs.limitWarnings.length > 0 && (
        <div className="flex items-start gap-1.5 text-xs text-red-500 bg-red-500/5 rounded p-1.5">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <div>
            {result.refs.limitWarnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Helpers ====================

/**
 * \u5728 prompt \u6587\u672ctrong\u9ad8\u4eae @Image/@Video/@Audio nhãn
 */
function highlightRefs(text: string): React.ReactNode {
  if (!text) return <span className="text-muted-foreground">\u70b9\u51fbChỉnh sửacấp độ nhómPrompt...</span>;

  // trận đấu @Image1, @Video2, @Audio3 Đợi đã
  const regex = /(@(?:Image|Video|Audio)\d+)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (regex.test(part) || part.match(/^@(?:Image|Video|Audio)\d+$/)) {
      const type = part.startsWith("@Image")
        ? "text-blue-500"
        : part.startsWith("@Video")
          ? "text-purple-500"
          : "text-green-500";
      return (
        <span key={i} className={cn("font-semibold", type)}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
