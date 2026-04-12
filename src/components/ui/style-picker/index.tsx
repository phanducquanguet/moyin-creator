// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * StylePicker - \u7edfmộtTầm nhìn Phong cách\u9009\u62e9\u5668
 * 
 * chức năng：
 * - \u5de6\u4fa7：\u5206\u7c7b\u5c0f\u56fedanh sách，\u53ef\u6eda\u52a8
 * - \u53f3\u4fa7：\u60ac\u505c/\u9009trong\u65f6\u663e\u793a\u5927\u56feXem trước + Mô tả
 * - Hỗ trợ\u4e0b\u62c9\u5f39\u51fachế độvàbên trong\u5d4cchế độ
 */

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  STYLE_CATEGORIES,
  VISUAL_STYLE_PRESETS,
  getStyleById,
  type StylePreset,
  type VisualStyleId,
} from "@/lib/constants/visual-styles";
import { useCustomStyleStore } from "@/stores/custom-style-store";

// Phong cách phân loại\u5bf9\u5e94củaMàu nền（Hình ảnhĐã rồiXóa，sử dụng\u8272\u5757\u5360\u4f4d）
const CATEGORY_COLORS: Record<string, string> = {
  '3d': 'bg-blue-500/20 text-blue-600',
  '2d': 'bg-green-500/20 text-green-600',
  'real': 'bg-amber-500/20 text-amber-600',
  'stop_motion': 'bg-purple-500/20 text-purple-600',
};

interface StylePickerProps {
  /** hiện tại\u9009trongcủaPhong cách ID */
  value: string;
  /** \u9009\u62e9thay đổigọi lại */
  onChange: (styleId: VisualStyleId) => void;
  /** \u662f\u5426sử dụng\u4e0b\u62c9\u5f39\u51fachế độ（Mặc định true） */
  popover?: boolean;
  /** Tuỳ chỉnhKích hoạt\u5668（\u4ec5 popover chế độ） */
  trigger?: React.ReactNode;
  /** Tuỳ chỉnh\u7c7btên */
  className?: string;
  /** \u7981sử dụngTrạng thái */
  disabled?: boolean;
  /** \u672a\u9009\u62e9\u65f6của\u5360\u4f4d\u6587từ */
  placeholder?: string;
}

/**
 * Phong cách\u9009\u62e9\u5668\u7ec4\u4ef6
 */
export function StylePicker({
  value,
  onChange,
  popover = true,
  trigger,
  className,
  disabled = false,
  placeholder = "\u9009\u62e9Phong cách",
}: StylePickerProps) {
  const [hoveredStyle, setHoveredStyle] = useState<StylePreset | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Người dùngTuỳ chỉnhPhong cách（Người dùdữ liệu，\u5b58\u50a8\u5728 localStorage）
  const customStyles = useCustomStyleStore((s) => s.styles);
  const customAsPresets: StylePreset[] = useMemo(() =>
    customStyles.map((s) => ({
      id: s.id,
      name: s.name,
      category: '2d' as const,
      mediaType: 'animation' as const,
      prompt: s.prompt || '',
      negativePrompt: s.negativePrompt || '',
      description: s.description || '',
      thumbnail: '',
    })),
    [customStyles]
  );

  // \u83b7\u53d6hiện tại\u9009trongcủaPhong cách（bên trong\u7f6e + Tuỳ chỉnh）
  const selectedStyle = useMemo(() => getStyleById(value), [value]);

  // Xem trướccủaPhong cách（\u60ac\u505cƯu tiên，\u5426\u5219\u663e\u793a\u9009trongcủa）
  const previewStyle = hoveredStyle || selectedStyle || VISUAL_STYLE_PRESETS[0];

  // \u5904\u7406\u9009\u62e9
  const handleSelect = (style: StylePreset) => {
    onChange(style.id as VisualStyleId);
    if (popover) {
      setIsOpen(false);
    }
  };

  // bên trong\u5bb9\u9762\u677f
  const pickerContent = (
    <div className={cn("flex", popover ? "w-[520px] h-[400px]" : "w-full h-full", className)}>
      {/* \u5de6\u4fa7：Phong cáchdanh sách */}
      <ScrollArea className="w-[240px] border-r border-border">
        <div className="p-2">
          {STYLE_CATEGORIES.map((category) => (
            <div key={category.id} className="mb-4">
              {/* \u5206\u7c7bTiêu đề */}
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50 mb-2">
                {category.name}
              </div>
              {/* Phong cáchdanh sách */}
              <div className="space-y-1">
                {category.styles.map((style) => (
                  <StyleItem
                    key={style.id}
                    style={style}
                    isSelected={value === style.id}
                    onSelect={() => handleSelect(style)}
                    onHover={() => setHoveredStyle(style)}
                    onLeave={() => setHoveredStyle(null)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Người dùngTuỳ chỉnhPhong cách（Người dùngmột\u4ebatài sản） */}
          {customAsPresets.length > 0 && (
            <div className="mb-4">
              <div className="px-2 py-1.5 text-xs font-medium text-primary border-b border-primary/30 mb-2">
                \u6211củaPhong cách
              </div>
              <div className="space-y-1">
                {customAsPresets.map((style) => (
                  <StyleItem
                    key={style.id}
                    style={style}
                    isSelected={value === style.id}
                    isCustom
                    onSelect={() => handleSelect(style)}
                    onHover={() => setHoveredStyle(style)}
                    onLeave={() => setHoveredStyle(null)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* \u53f3\u4fa7：Xem trướcthông tin */}
      <div className="flex-1 p-4 flex flex-col">
        {/* \u8272\u5757\u5360\u4f4d + Phong cáchTên */}
        <div className={cn(
          "flex-1 flex flex-col items-center justify-center rounded-lg mb-3",
          CATEGORY_COLORS[previewStyle.category] || 'bg-muted/30'
        )}>
          <div className="text-2xl font-bold mb-2">{previewStyle.name}</div>
          <div className="text-xs opacity-70">{previewStyle.category.toUpperCase()} · {previewStyle.mediaType}</div>
        </div>
        {/* Phong cáchthông tin */}
        <div className="text-center">
          <div className="font-medium text-sm mb-1">{previewStyle.name}</div>
          <div className="text-xs text-muted-foreground line-clamp-2">
            {previewStyle.description}
          </div>
        </div>
      </div>
    </div>
  );

  // \u4e0b\u62c9chế độ
  if (popover) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          {trigger || (
            <button
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "text-sm w-full justify-between"
              )}
              disabled={disabled}
            >
              <div className="flex items-center gap-2">
                {selectedStyle && (
                  <span className={cn(
                    "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold",
                    selectedStyle.id.startsWith('custom_style_')
                      ? 'bg-primary/20 text-primary'
                      : CATEGORY_COLORS[selectedStyle.category] || 'bg-muted'
                  )}>
                    {selectedStyle.id.startsWith('custom_style_') ? '★' : selectedStyle.category === '3d' ? '3D' : selectedStyle.category === '2d' ? '2D' : selectedStyle.category === 'real' ? '\u771f' : '\u5b9a'}
                  </span>
                )}
                <span className={!selectedStyle ? "text-muted-foreground" : ""}>
                  {selectedStyle?.name || placeholder}
                </span>
              </div>
              <svg
                className="w-4 h-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-auto"
          align="start"
          sideOffset={4}
        >
          {pickerContent}
        </PopoverContent>
      </Popover>
    );
  }

  // bên trong\u5d4cchế độ
  return pickerContent;
}

/**
 * Tiến sĩ đơnong cách\u9879
 */
interface StyleItemProps {
  style: StylePreset;
  isSelected: boolean;
  isCustom?: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
}

function StyleItem({ style, isSelected, isCustom, onSelect, onHover, onLeave }: StyleItemProps) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors",
        "hover:bg-accent",
        isSelected && "bg-accent"
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* \u8272\u5757\u5360\u4f4d */}
      <span className={cn(
        "w-10 h-10 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0",
        isCustom ? 'bg-primary/20 text-primary' : CATEGORY_COLORS[style.category] || 'bg-muted'
      )}>
        {isCustom ? '★' : style.category === '3d' ? '3D' : style.category === '2d' ? '2D' : style.category === 'real' ? '\u771f' : '\u5b9a'}
      </span>
      {/* Tên */}
      <span className="flex-1 text-left text-sm truncate">{style.name}</span>
      {/* \u9009trong\u6807\u8bb0 */}
      {isSelected && (
        <Check className="w-4 h-4 text-primary flex-shrink-0" />
      )}
    </button>
  );
}

export default StylePicker;
