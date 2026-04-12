// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Thẻ cảm xúc\u9009\u62e9\u7ec4\u4ef6
 * \u652f\u6301Nhiều lựa chọn、Có\u5e8f\u6392Cột，sử dụng\u4e8e\u63a7\u5236\u89c6\u9891\u751f\u6210bầu không khívà\u8bed\u6c14
 */

import { useState } from "react";
import { EMOTION_PRESETS, type EmotionTag } from "@/stores/director-store";
import { Button } from "@/components/ui/button";
import { X, Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmotionTagsProps {
  value: EmotionTag[];
  onChange: (tags: EmotionTag[]) => void;
  disabled?: boolean;
}

// \u83b7\u53d6nhãnthông tin
function getTagInfo(tagId: EmotionTag) {
  const allTags = [
    ...EMOTION_PRESETS.basic,
    ...EMOTION_PRESETS.atmosphere,
    ...EMOTION_PRESETS.tone,
  ];
  return allTags.find(t => t.id === tagId);
}

export function EmotionTags({ value, onChange, disabled }: EmotionTagsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // \u6dfb\u52a0nhãn
  const addTag = (tagId: EmotionTag) => {
    if (!value.includes(tagId)) {
      onChange([...value, tagId]);
    }
  };

  // Xóanhãn
  const removeTag = (tagId: EmotionTag) => {
    onChange(value.filter(t => t !== tagId));
  };

  // \u68c0\u67e5ĐúngKHÔNGĐã rồiđã chọn
  const isSelected = (tagId: EmotionTag) => value.includes(tagId);

  // kết xuấtnhãn\u5206\u7c7b
  const renderTagGroup = (
    title: string, 
    tags: readonly { id: string; label: string; emoji: string }[]
  ) => (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground px-1">{title}</p>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => {
          const selected = isSelected(tag.id as EmotionTag);
          return (
            <button
              key={tag.id}
              onClick={() => {
                if (selected) {
                  removeTag(tag.id as EmotionTag);
                } else {
                  addTag(tag.id as EmotionTag);
                }
              }}
              disabled={disabled}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-foreground",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <span>{tag.emoji}</span>
              <span>{tag.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Đã rồi\u9009nhãn（Có\u5e8f\u663e\u793a） */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {value.map((tagId, index) => {
            const tagInfo = getTagInfo(tagId);
            if (!tagInfo) return null;
            return (
              <div
                key={tagId}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
              >
                <span className="text-muted-foreground text-[10px]">{index + 1}.</span>
                <span>{tagInfo.emoji}</span>
                <span>{tagInfo.label}</span>
                {!disabled && (
                  <button
                    onClick={() => removeTag(tagId)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* \u6dfb\u52a0nhãn\u6309\u94ae */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            \u6dfb\u52a0Thẻ cảm xúc
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-3">
            <p className="text-sm font-medium">\u9009\u62e9Thẻ cảm xúc</p>
            <p className="text-xs text-muted-foreground">
              theo thứ tự\u6dfb\u52a0nhãn，\u89c6\u9891\u5c06\u6309\u6b64\u987a\u5e8f\u5448\u73b0cảm xúcthay đổi
            </p>
            {renderTagGroup("\u57fa\u7840cảm xúc", EMOTION_PRESETS.basic)}
            {renderTagGroup("khí sắc", EMOTION_PRESETS.atmosphere)}
            {renderTagGroup("giọng điệu", EMOTION_PRESETS.tone)}
          </div>
        </PopoverContent>
      </Popover>

      {/* \u63d0\u793a\u6587từ */}
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          \u6dfb\u52a0Thẻ cảm xúc\u63a7\u5236\u89c6\u9891bầu không khívànói\u8bed\u6c14
        </p>
      )}
      {value.length > 1 && (
        <p className="text-xs text-muted-foreground">
          cảm xúc\u5c06\u6309 {value.map((t, i) => getTagInfo(t)?.label).filter(Boolean).join(" → ")} \u987a\u5e8fthay đổi
        </p>
      )}
    </div>
  );
}
