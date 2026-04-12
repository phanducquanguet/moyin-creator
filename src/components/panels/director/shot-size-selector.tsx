// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * \u666f\u522b\u9009\u62e9\u5668\u7ec4\u4ef6 (Shot Size Selector)
 * sử dụng\u4e8e\u9009\u62e9\u955c\u5934của\u666f\u522b\u7c7b\u578b：xa\u666f、trong\u666f、\u8fd1\u666f、\u7279\u5199Đợi đã
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SHOT_SIZE_PRESETS, type ShotSizeType } from "@/stores/director-store";
import { Camera } from "lucide-react";

interface ShotSizeSelectorProps {
  value: ShotSizeType | null;
  onChange: (value: ShotSizeType | null) => void;
  disabled?: boolean;
  className?: string;
}

export function ShotSizeSelector({
  value,
  onChange,
  disabled,
  className,
}: ShotSizeSelectorProps) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? null : (v as ShotSizeType))}
      disabled={disabled}
    >
      <SelectTrigger className={`h-7 text-xs ${className || ""}`}>
        <div className="flex items-center gap-1.5">
          <Camera className="h-3 w-3 text-muted-foreground" />
          <SelectValue placeholder="\u666f\u522b" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-muted-foreground">\u672a\u8bbe\u7f6e</span>
        </SelectItem>
        {SHOT_SIZE_PRESETS.map((preset) => (
          <SelectItem key={preset.id} value={preset.id}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] bg-muted px-1 rounded">
                {preset.abbr}
              </span>
              <span>{preset.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * \u666f\u522bnhãn\u663e\u793a\u7ec4\u4ef6（\u53ea\u8bfb）
 */
export function ShotSizeLabel({ shotSize }: { shotSize: ShotSizeType | null }) {
  if (!shotSize) return null;
  
  const preset = SHOT_SIZE_PRESETS.find((p) => p.id === shotSize);
  if (!preset) return null;

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium">
      <span className="font-mono">{preset.abbr}</span>
      <span>{preset.label}</span>
    </span>
  );
}
