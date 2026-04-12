// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * StyleCard - gió\u683c\u5361\u7247\u7ec4\u4ef6
 * \u9ed8\u8ba4gió\u683cvà\u81ea\u5b9a\u4e49gió\u683ctổng cộngsử dụng
 */

import { cn } from "@/lib/utils";
import { LocalImage } from "@/components/ui/local-image";
import type { StyleCategory } from "@/lib/constants/visual-styles";

// gió\u683c\u5206\u7c7b\u8272\u5757（với StylePicker một\u81f4）
const CATEGORY_COLORS: Record<string, string> = {
  '3d': 'bg-blue-500/20 text-blue-600',
  '2d': 'bg-green-500/20 text-green-600',
  'real': 'bg-amber-500/20 text-amber-600',
  'stop_motion': 'bg-purple-500/20 text-purple-600',
};

const CATEGORY_LABELS: Record<string, string> = {
  '3d': '3D',
  '2d': '2D',
  'real': 'người thật',
  'stop_motion': 'khung đóng băng',
};

interface StyleCardProps {
  name: string;
  description?: string;
  category?: StyleCategory;     // bên trong\u7f6egió\u683c\u5206\u7c7b（sử dụng\u4e8e\u8272\u5757\u663e\u793a）
  referenceImages?: string[];   // \u81ea\u5b9a\u4e49gió\u683cHình ảnh tham khảo
  isCustom?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export function StyleCard({
  name,
  description,
  category,
  referenceImages,
  isCustom = false,
  isSelected = false,
  onClick,
  onDoubleClick,
}: StyleCardProps) {
  // \u81ea\u5b9a\u4e49gió\u683csử dụngKhông.một mảnhHình ảnh tham khảo
  const customImage = isCustom ? referenceImages?.[0] : undefined;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border bg-card overflow-hidden cursor-pointer transition-all hover:shadow-md",
        isSelected
          ? "border-primary ring-1 ring-primary/30"
          : "border-border hover:border-primary/50"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* hình thu nhỏQuận\u57df */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {customImage ? (
          <LocalImage
            src={customImage}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : category ? (
          /* bên trong\u7f6egió\u683c：\u8272\u5757\u5360\u4f4d + \u5206\u7c7bnhãn */
          <div className={cn(
            "w-full h-full flex flex-col items-center justify-center",
            CATEGORY_COLORS[category] || 'bg-muted/30'
          )}>
            <div className="text-lg font-bold">{CATEGORY_LABELS[category] || category}</div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            không cóHình ảnh tham khảo
          </div>
        )}
        {/* \u81ea\u5b9a\u4e49\u6807\u8bb0 */}
        {isCustom && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] bg-primary/80 text-primary-foreground">
            \u81ea\u5b9a\u4e49
          </div>
        )}
      </div>

      {/* thông tinQuận\u57df */}
      <div className="p-2 space-y-0.5">
        <div className="text-sm font-medium truncate">{name}</div>
        {description && (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
