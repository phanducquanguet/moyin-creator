// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * CustomStylesGrid - \u81ea\u5b9a\u4e49gió\u683c\u7f51\u683c
 * hiển thịsử dụng\u6237\u521b\u5efacủagió\u683c，\u652f\u6301mới\u5efa/\u7f16\u8f91/\u5220\u9664/sao chép
 */

import { useCustomStyleStore } from "@/stores/custom-style-store";
import { StyleCard } from "./StyleCard";
import { StyleEditor } from "./StyleEditor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";

export function CustomStylesGrid() {
  const {
    styles,
    selectedStyleId,
    editingStyleId,
    selectStyle,
    setEditingStyle,
    deleteStyle,
    duplicateStyle,
  } = useCustomStyleStore();

  // \u6b63\u5728\u7f16\u8f91 → \u663e\u793a\u7f16\u8f91\u5668
  if (editingStyleId !== null) {
    return (
      <StyleEditor
        styleId={editingStyleId}
        onClose={() => setEditingStyle(null)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* \u9876\u90e8\u680f */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">\u6211củagió\u683c</h2>
          <span className="text-xs text-muted-foreground">{styles.length} một</span>
        </div>
        <Button size="sm" onClick={() => setEditingStyle("new")}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          mới\u5efagió\u683c
        </Button>
      </div>

      {/* bên trong\u5bb9Quận\u57df */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {styles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="text-sm mb-2">\u8fd8\u6ca1Có\u81ea\u5b9a\u4e49gió\u683c</div>
              <div className="text-xs mb-4">\u70b9\u51fb「mới\u5efagió\u683c」\u521b\u5efacủa bạnKhông.mộtmộtgió\u683c</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingStyle("new")}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                mới\u5efagió\u683c
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {styles.map((style) => (
                <ContextMenu key={style.id}>
                  <ContextMenuTrigger>
                    <StyleCard
                      name={style.name}
                      description={style.description}
                      referenceImages={style.referenceImages}
                      isCustom
                      isSelected={selectedStyleId === style.id}
                      onClick={() => selectStyle(style.id)}
                      onDoubleClick={() => setEditingStyle(style.id)}
                    />
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => setEditingStyle(style.id)}>
                      <Pencil className="w-3.5 h-3.5 mr-2" />
                      \u7f16\u8f91
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => duplicateStyle(style.id)}>
                      <Copy className="w-3.5 h-3.5 mr-2" />
                      sao chép
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => deleteStyle(style.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      \u5220\u9664
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
