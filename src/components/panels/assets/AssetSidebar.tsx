// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * AssetSidebar - tài sản\u9762\u677f\u5de6\u4fa7\u5bfc\u822acây
 * \u53ef\u63d2\u62d4\u8bbe\u8ba1，\u540e\u7eed\u53ef\u6269\u5c55Chất liệu\u5e93、hoạt động\u5e93Đợi đã\u5b50\u6a21\u5757
 */

import { cn } from "@/lib/utils";
import {
  Palette,
  Layers,
  UserCircle,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Box,
} from "lucide-react";
import { useState } from "react";

// \u5bfc\u822a\u8282\u70b9\u7c7b\u578b
export type AssetSection = "style-default" | "style-custom" | "props-library";

interface AssetSidebarProps {
  activeSection: AssetSection;
  onSectionChange: (section: AssetSection) => void;
}

// \u9876\u5c42\u6a21\u5757\u5b9a\u4e49（\u53ef\u63d2\u62d4，\u540e\u7eed\u5728\u6b64\u6570\u7ec4\u8ffd\u52a0mới\u6a21\u5757）
interface NavModule {
  id: string;
  label: string;
  icon: React.ElementType;
  children: { id: AssetSection; label: string; icon: React.ElementType }[];
}

const NAV_MODULES: NavModule[] = [
  {
    id: "styles",
    label: "gió\u683c\u5e93",
    icon: Palette,
    children: [
      { id: "style-default", label: "\u9ed8\u8ba4gió\u683c", icon: Layers },
      { id: "style-custom", label: "\u6211củagió\u683c", icon: UserCircle },
    ],
  },
  {
    id: "props",
    label: "đạo cụ\u5e93",
    icon: Box,
    children: [
      { id: "props-library", label: "\u6211củađạo cụ", icon: Box },
    ],
  },
];

export function AssetSidebar({ activeSection, onSectionChange }: AssetSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(NAV_MODULES.map((m) => m.id))
  );

  const toggleModule = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-panel border-r border-border">
      {/* Tiêu đề */}
      <div className="px-3 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">một\u4ebatài sản\u5e93</span>
        </div>
      </div>

      {/* \u5bfc\u822acây */}
      <div className="flex-1 overflow-y-auto py-2">
        {NAV_MODULES.map((mod) => (
          <div key={mod.id} className="mb-1">
            {/* \u6a21\u5757Tiêu đề */}
            <button
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => toggleModule(mod.id)}
            >
              {expanded.has(mod.id) ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <mod.icon className="w-3.5 h-3.5" />
              {mod.label}
            </button>

            {/* \u5b50\u9879 */}
            {expanded.has(mod.id) && (
              <div className="ml-3">
                {mod.children.map((child) => (
                  <button
                    key={child.id}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-md transition-colors",
                      activeSection === child.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    onClick={() => onSectionChange(child.id)}
                  >
                    <child.icon className="w-3.5 h-3.5" />
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
