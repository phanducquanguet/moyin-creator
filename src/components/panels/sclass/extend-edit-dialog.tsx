// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * ExtendEditDialog — Videomở rộng / VideoChỉnh sửa\u5bf9\u8bdd\u6846
 *
 * mở rộngchế độ：\u9009\u62e9\u65b9\u5411 + Thời lượng + Bổ sung Mô tả → Tạo extend \u5b50\u7ec4
 * Chỉnh sửachế độ：\u9009\u62e9Chỉnh sửaLoại + Bổ sung Mô tả → Tạo edit \u5b50\u7ec4
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Timer, Scissors, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSClassStore,
  type ShotGroup,
  type ExtendDirection,
  type EditType,
} from "@/stores/sclass-store";

// ==================== Types ====================

export type ExtendEditMode = "extend" | "edit";

export interface ExtendEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ExtendEditMode;
  /** Nguồn\u7ec4（Đã hoàn thànhVideocủa\u7ec4） */
  sourceGroup: ShotGroup | null;
  /** Xác nhận\u540ecủagọi lại：Tạo\u5b50\u7ec4\u5e76Tạo */
  onConfirm: (childGroup: ShotGroup) => void;
  isGenerating?: boolean;
}

// ==================== Constants ====================

const EDIT_TYPE_OPTIONS: { value: EditType; label: string; desc: string }[] = [
  { value: "plot_change", label: "\u5267\u60c5\u98a0\u8986", desc: "\u4fdd\u7559Màn hình Phong cách，\u6539thay đổicâu chuyệnđi\u5411" },
  { value: "character_swap", label: "Nhân vậtthay thế", desc: "\u5c06VideotrongNhân vậtThay thế bằngHình ảnh tham khảotrongNhân vật" },
  { value: "attribute_modify", label: "\u5c5e\u6027Sửa", desc: "\u6539thay đổiNhân vật\u670d\u9970、màu tóc、môi trường\u5149\u7167thuộc tính" },
  { value: "element_add", label: "phần tửThêm", desc: "\u5728\u73b0Cóbức tranh\u4e0a\u53e0\u52a0\u65b0của\u89c6\u89c9phần tử" },
];

// ==================== Component ====================

export function ExtendEditDialog({
  open,
  onOpenChange,
  mode,
  sourceGroup,
  onConfirm,
  isGenerating = false,
}: ExtendEditDialogProps) {
  // --- mở rộngTham số ---
  const [direction, setDirection] = useState<ExtendDirection>("backward");
  const [duration, setDuration] = useState(10);

  // --- Chỉnh sửaTham số ---
  const [editType, setEditType] = useState<EditType>("plot_change");

  // --- tổng cộngsử dụng ---
  const [description, setDescription] = useState("");

  const { addShotGroup } = useSClassStore();

  const handleConfirm = useCallback(() => {
    if (!sourceGroup || !sourceGroup.videoUrl) return;

    const childId = `${mode}_${Date.now()}_${sourceGroup.id.substring(0, 8)}`;
    const childGroup: ShotGroup = {
      id: childId,
      name: `${sourceGroup.name} - ${mode === "extend" ? "mở rộng" : "Chỉnh sửa"}`,
      sceneIds: [...sourceGroup.sceneIds],
      sortIndex: sourceGroup.sortIndex + 0.5,
      totalDuration: (mode === "extend"
        ? Math.max(4, Math.min(15, duration))
        : (sourceGroup.totalDuration || 10)) as ShotGroup["totalDuration"],
      videoStatus: "idle",
      videoProgress: 0,
      videoUrl: null,
      videoMediaId: null,
      videoError: null,
      gridImageUrl: null,
      lastPrompt: null,
      mergedPrompt: description.trim() || sourceGroup.mergedPrompt || "",
      history: [],
      imageRefs: [],
      videoRefs: [],
      audioRefs: [],
      generationType: mode,
      extendDirection: mode === "extend" ? direction : undefined,
      editType: mode === "edit" ? editType : undefined,
      sourceGroupId: sourceGroup.id,
      sourceVideoUrl: sourceGroup.videoUrl || undefined,
    };

    addShotGroup(childGroup);
    onConfirm(childGroup);
    onOpenChange(false);

    // Reset form
    setDescription("");
    setDuration(10);
    setDirection("backward");
    setEditType("plot_change");
  }, [sourceGroup, mode, direction, duration, editType, description, addShotGroup, onConfirm, onOpenChange]);

  const isExtend = mode === "extend";
  const title = isExtend ? "Videomở rộng" : "VideoChỉnh sửa";
  const Icon = isExtend ? Timer : Scissors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", isExtend ? "text-purple-500" : "text-orange-500")} />
            {title}
          </DialogTitle>
          <DialogDescription>
            {isExtend
              ? "Dựa trênĐã Tạo videotiếp tụcmở rộng，Hỗ trợ\u5411\u540ehoặc\u5411\u524d\u62d3\u5c55"
              : "\u5bf9Đã Tạo video\u8fdbđược rồi\u5267\u60c5Chỉnh sửa、Nhân vậtthay thếĐợi đãThao tác"
            }
          </DialogDescription>
        </DialogHeader>

        {/* NguồnVideoXem trước */}
        {sourceGroup?.videoUrl && (
          <div className="rounded-md overflow-hidden border">
            <video
              src={sourceGroup.videoUrl}
              className="w-full max-h-32 object-cover"
              preload="metadata"
              muted
            />
            <div className="px-2 py-1 bg-muted/30 text-xs text-muted-foreground">
              Nguồn：{sourceGroup.name}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* ========== mở rộngchế độTham số ========== */}
          {isExtend && (
            <>
              {/* Hướng mở rộng */}
              <div className="space-y-1.5">
                <Label className="text-xs">Hướng mở rộng</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as ExtendDirection)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backward">\u5411\u540emở rộng（Mặc định）</SelectItem>
                    <SelectItem value="forward">\u5411\u524dmở rộng（\u524d\u7f6ebên trong\u5bb9）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* mở rộngThời lượng */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs">mở rộngThời lượng</Label>
                  <span className="text-xs text-muted-foreground">{duration}s</span>
                </div>
                <Slider
                  value={[duration]}
                  onValueChange={(v) => setDuration(v[0])}
                  min={4}
                  max={15}
                  step={1}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>4s</span>
                  <span>15s</span>
                </div>
              </div>
            </>
          )}

          {/* ========== Chỉnh sửachế độTham số ========== */}
          {!isExtend && (
            <div className="space-y-1.5">
              <Label className="text-xs">Chỉnh sửaLoại</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as EditType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDIT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ========== Bổ sung Mô tả ========== */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Bổ sung Mô tả
              <span className="text-muted-foreground ml-1">（Tùy chọn）</span>
            </Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder={isExtend
                ? "Mô tảmở rộngmột phầnbức tranhbên trong\u5bb9，Chẳng hạn như：Cảnh quay\u7f13\u7f13Thu nhỏ，Nhân vật\u6e10được rồi\u6e10xa..."
                : "Mô tảChỉnh sửaĐích，Chẳng hạn như：\u5c06Ban ngàyCảnh\u6539choBan đêm，giữnhân vậtkhông thay đổi..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Huỷ
          </Button>
          <Button
            size="sm"
            className={cn(
              isExtend
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-orange-600 hover:bg-orange-700 text-white",
            )}
            disabled={isGenerating || !sourceGroup?.videoUrl}
            onClick={handleConfirm}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Đang xử lý
              </>
            ) : (
              <>
                <Icon className="h-3 w-3 mr-1" />
                Xác nhận{isExtend ? "mở rộng" : "Chỉnh sửa"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
