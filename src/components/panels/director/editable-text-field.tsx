// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * EditableTextField Component
 * \u53ef\u53cc\u51fb\u7f16\u8f91của\u6587\u672cCánh đồng\u7ec4\u4ef6
 */

import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit3 } from "lucide-react";

export interface EditableTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  className?: string;
}

export function EditableTextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  multiline = false,
  className,
}: EditableTextFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // \u5f00\u59cb\u7f16\u8f91
  const startEditing = () => {
    if (disabled) return;
    setEditValue(value);
    setIsEditing(true);
  };

  // \u4fdd\u5b58\u7f16\u8f91
  const saveEdit = () => {
    if (editValue !== value) {
      onChange(editValue);
    }
    setIsEditing(false);
  };

  // \u53d6\u6d88\u7f16\u8f91
  const cancelEdit = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  // \u5904\u7406\u952e\u76d8\u4e8b\u4ef6
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // \u81ea\u52a8\u805a\u7126
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className={className}>
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[40px] text-xs resize-none mt-0.5"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-2 py-1 text-xs border rounded bg-background mt-0.5"
          />
        )}
      </div>
    );
  }

  return (
    <div 
      className={cn("cursor-pointer group/field", className)}
      onDoubleClick={startEditing}
      title="\u53cc\u51fb\u7f16\u8f91"
    >
      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
        {label}
        {!disabled && <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover/field:opacity-50" />}
      </Label>
      <p className={cn(
        "text-xs mt-0.5 min-h-[1.2em]",
        value ? "text-foreground/80" : "text-muted-foreground/50 italic",
        multiline && "line-clamp-2"
      )}>
        {value || placeholder || "\u53cc\u51fb\u7f16\u8f91..."}
      </p>
    </div>
  );
}
