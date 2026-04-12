// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Feature Binding Panel (Multi-Select Mode)
 * Chọn mô hình theo phân loại thương hiệu — phong cách trang pricing MemeFast
 * Cấp 1: pill thương hiệu (có SVG logo + số mô hình)
 * Cấp 2: danh sách mô hình (checkbox đa chọn)
 */

import { useMemo, useState } from "react";
import { useAPIConfigStore, type AIFeature } from "@/stores/api-config-store";
import { parseApiKeys, classifyModelByName, type ModelCapability } from "@/lib/api-key-manager";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  Image,
  Video,
  ScanEye,
  Link2,
  Check,
  X,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Search,
  Sparkles,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { extractBrandFromModel, getBrandInfo } from "@/lib/brand-mapping";
import { getBrandIcon } from "./brand-icons";
import { getModelDisplayName } from "@/lib/freedom/model-display-names";

/**
 * Tuỳ chọn nhà cung cấp - Nền tảng + mô hình có thể chọn cho mỗi tính năng
 */
interface ProviderOption {
  providerId: string;
  platform: string;
  name: string;
  model: string;
}

interface FeatureMeta {
  key: AIFeature;
  name: string;
  description: string;
  icon: ReactNode;
  requiredCapability?: ModelCapability;
  /** Gợi ý mô hình khuyến nghị (highlight màu xanh) */
  recommendation?: string;
}

const FEATURE_CONFIGS: FeatureMeta[] = [
  {
    key: "script_analysis",
    name: "Phân tích kịch bản / Hội thoại",
    description: "Phân tách văn bản câu chuyện thành kịch bản có cấu trúc",
    icon: <FileText className="h-4 w-4" />,
    requiredCapability: "text",
  },
  {
    key: "character_generation",
    name: "Tạo ảnh",
    description: "Tạo ảnh tham chiếu cho nhân vật và cảnh",
    icon: <Image className="h-4 w-4" />,
    requiredCapability: "image_generation",
    recommendation: "💎 Khuyến nghị dùng Nano Banana Pro (Gemini 3 Pro) — chất lượng hình ảnh tốt, tính nhất quán cao",
  },
  {
    key: "video_generation",
    name: "Tạo video",
    description: "Chuyển đổi ảnh thành video",
    icon: <Video className="h-4 w-4" />,
    requiredCapability: "video_generation",
    recommendation: "🧪 Khuyến nghị dùng doubao-seedance-1-0-lite-t2v-250428 để thử nghiệm — phù hợp để xác minh quy trình nhanh",
  },
  {
    key: "image_understanding",
    name: "Hiểu ảnh",
    description: "Phân tích nội dung ảnh để tạo mô tả",
    icon: <ScanEye className="h-4 w-4" />,
    requiredCapability: "vision",
  },
  {
    key: "freedom_image",
    name: "Bảng tự do - Ảnh",
    description: "Cấu hình tạo ảnh riêng cho bảng tự do (khi chưa cấu hình sẽ dùng cấu hình「Tạo ảnh」)",
    icon: <Sparkles className="h-4 w-4" />,
    requiredCapability: "image_generation",
    recommendation: "🎨 Có thể cấu hình riêng mô hình tạo ảnh cho bảng tự do, không ảnh hưởng các bảng khác",
  },
  {
    key: "freedom_video",
    name: "Bảng tự do - Video",
    description: "Cấu hình tạo video riêng cho bảng tự do (khi chưa cấu hình sẽ dùng cấu hình「Tạo video」)",
    icon: <Clapperboard className="h-4 w-4" />,
    requiredCapability: "video_generation",
    recommendation: "🎬 Có thể cấu hình riêng mô hình tạo video cho bảng tự do, không ảnh hưởng các bảng khác",
  },
];

function getOptionKey(option: ProviderOption): string {
  return `${option.providerId}:${option.model}`;
}

function parseOptionKey(key: string): { providerIdOrPlatform: string; model: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const providerIdOrPlatform = key.slice(0, idx);
  const model = key.slice(idx + 1);
  if (!providerIdOrPlatform || !model) return null;
  return { providerIdOrPlatform, model };
}

const DEFAULT_PLATFORM_CAPABILITIES: Record<string, ModelCapability[]> = {
  memefast: ["text", "vision", "image_generation", "video_generation"],
  // RunningHub is used for specialized tools; do not expose it as a default vision/chat provider.
  runninghub: ["image_generation"],
};

/**
 * Ánh xạ khả năng cấp mô hình
 * Kiểm soát chính xác phạm vi có thể chọn của từng mô hình trong ánh xạ dịch vụ
 * Mô hình chưa liệt kê sẽ fallback về khả năng cấp nền tảng
 */
const MODEL_CAPABILITIES: Record<string, ModelCapability[]> = {
  // ---- Mô hình hội thoại/văn bản ----
  'glm-4.7': ['text', 'function_calling'],
  'glm-4.6v': ['text', 'vision'],
  'deepseek-v3': ['text'],
  'deepseek-v3.2': ['text'],
  'deepseek-r1': ['text', 'reasoning'],
  'kimi-k2': ['text'],
  'MiniMax-M2.1': ['text'],
  'qwen3-max': ['text'],
  'qwen3-max-preview': ['text'],
  'gemini-2.0-flash': ['text'],
  'gemini-3-flash-preview': ['text'],
  'gemini-3-pro-preview': ['text'],
  'claude-haiku-4-5-20251001': ['text', 'vision'],

  // ---- Mô hình tạo ảnh ----
  'cogview-3-plus': ['image_generation'],
  'gemini-imagen': ['image_generation'],
  'gemini-3-pro-image-preview': ['image_generation'],
  'gpt-image-1.5': ['image_generation'],

  // ---- Mô hình tạo video ----
  'cogvideox': ['video_generation'],
  'gemini-veo': ['video_generation'],
  'doubao-seedance-1-5-pro': ['video_generation'],
  'doubao-seedance-1-5-pro-251215': ['video_generation'],
  'doubao-seedream-4-5-251128': ['image_generation'],
  'veo3.1': ['video_generation'],
  'sora-2-all': ['video_generation'],
  'wan2.6-i2v': ['video_generation'],
  'grok-video-3': ['video_generation'],
  'grok-video-3-10s': ['video_generation'],
  'grok-video-3-15s': ['video_generation'],

  // ---- Mô hình hiểu ảnh/thị giác ----
  'doubao-vision': ['vision'],

  // ---- Mô hình đặc biệt RunningHub ----
  '2009613632530812930': ['image_generation'],
};

function providerSupportsCapability(
  provider: { platform: string; capabilities?: ModelCapability[] },
  required?: ModelCapability
): boolean {
  if (!required) return true;

  const explicitCaps = provider.capabilities && provider.capabilities.length > 0
    ? provider.capabilities
    : undefined;

  const caps = explicitCaps || DEFAULT_PLATFORM_CAPABILITIES[provider.platform];

  // If we still don't know, treat as "unknown" and allow selection.
  if (!caps || caps.length === 0) return true;

  return caps.includes(required);
}

/**
 * Kiểm tra xem mô hình cụ thể có hỗ trợ khả năng yêu cầu không
 * Ưu tiên: ánh xạ hardcode → metadata nền tảng (model_type/tags) → suy luận tên mô hình → fallback cấp nền tảng
 */
function modelSupportsCapability(
  modelName: string,
  provider: { platform: string; capabilities?: ModelCapability[] },
  required?: ModelCapability,
  modelType?: string,     // "Văn bản" | "Hình ảnh" | "Âm thanh/Video" | "Tìm kiếm" (giá trị từ API, không dịch)
  modelTagsList?: string[] // ["Trò chuyện","Nhận dạng ảnh","Công cụ"] (giá trị từ API, không dịch)
): boolean {
  if (!required) return true;

  // 1. Ánh xạ hardcode (kiểm soát chính xác một số mô hình preset)
  const modelCaps = MODEL_CAPABILITIES[modelName];
  if (modelCaps) {
    return modelCaps.includes(required);
  }

  // 2. Metadata nền tảng (model_type + tags từ /api/pricing_new)
  if (modelType) {
    switch (required) {
      case 'text':
        return modelType === '\u6587\u672c';
      case 'image_generation':
        return modelType === '\u56fe\u50cf';
      case 'video_generation':
        // Trong loại âm thanh/video chỉ lọc những cái có tag “Video” (loại trừ thuần âm thanh/TTS/nhạc)
        return modelType === '\u97f3\u89c6\u9891' && (modelTagsList?.some(t => t.includes('\u89c6\u9891')) ?? false);
      case 'vision':
        // Khả năng nhận dạng ảnh trải qua nhiều model_type, chỉ xem tags có chứa "Nhận dạng ảnh" hoặc "Đa phương thức" không
        return modelTagsList?.some(t => t.includes('\u8bc6\u56fe') || t.includes('\u591a\u6a21\u6001')) ?? false;
      case 'embedding':
        return modelType === '\u68c0\u7d22';
      default:
        break;
    }
  }

  // 3. Suy luận theo pattern tên mô hình (các nhà cung cấp không phải MemeFast)
  const inferred = classifyModelByName(modelName);
  if (inferred.length > 0) {
    return inferred.includes(required);
  }

  // 4. Fallback cấp nền tảng
  return providerSupportsCapability(provider, required);
}

export function FeatureBindingPanel() {
  const {
    providers,
    modelTypes,
    modelTags,
    modelEnableGroups,
    setFeatureBindings,
    toggleFeatureBinding,
    getFeatureBindings,
  } = useAPIConfigStore();
  
  // Theo dõi trạng thái mở rộng/thu gọn
  const [expandedFeatures, setExpandedFeatures] = useState<Set<AIFeature>>(new Set());

  const configuredProviderIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of providers) {
      if (parseApiKeys(p.apiKey).length > 0) {
        set.add(p.id);
        // Cũng thêm platform vào để tương thích kiểm tra dữ liệu cũ
        set.add(p.platform);
      }
    }
    return set;
  }, [providers]);

  const isProviderConfigured = (providerIdOrPlatform: string): boolean => {
    return configuredProviderIds.has(providerIdOrPlatform);
  };

  const optionsByFeature = useMemo(() => {
    const map: Partial<Record<AIFeature, ProviderOption[]>> = {};

    for (const feature of FEATURE_CONFIGS) {
      const opts: ProviderOption[] = [];

      for (const provider of providers) {
        const models = (provider.model || [])
          .map((m) => m.trim())
          .filter((m) => m.length > 0);

        for (const model of models) {
          // Dùng metadata nền tảng (model_type/tags) để phân loại chính xác
          const mType = modelTypes[model];
          const mTags = modelTags[model];
          if (!modelSupportsCapability(model, provider, feature.requiredCapability, mType, mTags)) continue;
          opts.push({
            providerId: provider.id,
            platform: provider.platform,
            name: provider.name,
            model,
          });
        }
      }

      // Prefer configured providers first for better UX.
      opts.sort((a, b) => {
        const aConfigured = isProviderConfigured(a.providerId);
        const bConfigured = isProviderConfigured(b.providerId);
        if (aConfigured !== bConfigured) return aConfigured ? -1 : 1;
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.model.localeCompare(b.model);
      });

      map[feature.key] = opts;
    }

    return map;
  }, [providers, configuredProviderIds, modelTypes, modelTags]);

  // Tính số tính năng đã cấu hình (ít nhất có một binding hợp lệ)
  const configuredCount = useMemo(() => {
    return FEATURE_CONFIGS.filter((feature) => {
      const bindings = getFeatureBindings(feature.key);
      if (bindings.length === 0) return false;
      
      // Kiểm tra xem có ít nhất một binding hợp lệ không
      const options = optionsByFeature[feature.key] || [];
      return bindings.some(binding => {
        const parsed = parseOptionKey(binding);
        if (!parsed) return false;
        const existsInOptions = options.some((o) => getOptionKey(o) === binding || (`${o.platform}:${o.model}` === binding));
        return existsInOptions && isProviderConfigured(parsed.providerIdOrPlatform);
      });
    }).length;
  }, [optionsByFeature, configuredProviderIds, getFeatureBindings]);

  // Chuyển đổi trạng thái chọn của từng mô hình
  const handleToggleBinding = (feature: FeatureMeta, optionKey: string) => {
    const parsed = parseOptionKey(optionKey);
    if (!parsed) return;
    toggleFeatureBinding(feature.key, optionKey);
  };
  
  // Chuyển đổi mở rộng/thu gọn
  const toggleExpanded = (feature: AIFeature) => {
    setExpandedFeatures(prev => {
      const newSet = new Set(prev);
      if (newSet.has(feature)) {
        newSet.delete(feature);
      } else {
        newSet.add(feature);
      }
      return newSet;
    });
  };

  // Nhóm theo thương hiệu (UI phân loại thương hiệu)
  const brandGroupsByFeature = useMemo(() => {
    const result: Partial<Record<AIFeature, Array<{ brandId: string; options: ProviderOption[] }>>> = {};

    for (const feature of FEATURE_CONFIGS) {
      const opts = optionsByFeature[feature.key] || [];
      const brandMap = new Map<string, ProviderOption[]>();

      for (const opt of opts) {
        const brandId = extractBrandFromModel(opt.model);
        if (!brandMap.has(brandId)) brandMap.set(brandId, []);
        brandMap.get(brandId)!.push(opt);
      }

      // Sắp xếp: thương hiệu có nhiều mô hình hơn đứng trước
      const sorted = [...brandMap.entries()]
        .map(([brandId, options]) => ({ brandId, options }))
        .sort((a, b) => b.options.length - a.options.length);

      result[feature.key] = sorted;
    }

    return result;
  }, [optionsByFeature]);

  // Bộ lọc thương hiệu đã chọn cho mỗi feature
  const [selectedBrand, setSelectedBrand] = useState<Record<string, string | null>>({});
  // Từ khoá tìm kiếm cho mỗi feature
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});

  // Tập hợp ID nhà cung cấp MemeFast (dùng cho gợi ý phân nhóm)
  const memefastProviderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of providers) {
      if (p.platform === 'memefast') ids.add(p.id);
    }
    return ids;
  }, [providers]);

  return (
    <div className="p-6 border border-border rounded-xl bg-card space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Ánh xạ dịch vụ
        </h3>
        <span className="text-xs text-muted-foreground">
          Đã cấu hình: {configuredCount}/{FEATURE_CONFIGS.length}
        </span>
      </div>

      {/* Service Mapping Table - Multi-Select */}
      <div className="grid gap-3">
        {FEATURE_CONFIGS.map((feature) => {
          const options = optionsByFeature[feature.key] || [];
          const currentBindings = getFeatureBindings(feature.key);
          const isExpanded = expandedFeatures.has(feature.key);
          const selectableOptionKeys = options
            .filter((o) => isProviderConfigured(o.providerId))
            .map((o) => getOptionKey(o));
          const selectedSelectableCount = selectableOptionKeys.filter((k) => currentBindings.includes(k) || currentBindings.includes(`${options.find(o => getOptionKey(o) === k)?.platform}:${options.find(o => getOptionKey(o) === k)?.model}`)).length;
          const isAllSelected =
            selectableOptionKeys.length > 0 && selectedSelectableCount === selectableOptionKeys.length;
          const isPartiallySelected = selectedSelectableCount > 0 && !isAllSelected;
          const isFreedomFeature = feature.key === 'freedom_image' || feature.key === 'freedom_video';
          const handleToggleSelectAll = (checked: boolean | 'indeterminate') => {
            if (checked === true) {
              setFeatureBindings(
                feature.key,
                selectableOptionKeys.length > 0 ? selectableOptionKeys : null
              );
              return;
            }
            setFeatureBindings(feature.key, null);
          };
          
          // Kiểm tra binding hợp lệ/không hợp lệ (không hợp lệ = mô hình bị lọc ra, offline, hoặc nền tảng chưa cấu hình)
          const validBindings: string[] = [];
          const invalidBindings: string[] = [];
          for (const binding of currentBindings) {
            const parsed = parseOptionKey(binding);
            if (!parsed) {
              invalidBindings.push(binding);
              continue;
            }
            const existsInOptions = options.some((o) => getOptionKey(o) === binding || (`${o.platform}:${o.model}` === binding));
            if (existsInOptions && isProviderConfigured(parsed.providerIdOrPlatform)) {
              validBindings.push(binding);
            } else {
              invalidBindings.push(binding);
            }
          }
          const configured = validBindings.length > 0;

          return (
            <div
              key={feature.key}
              className={cn(
                "rounded-lg border transition-all",
                configured
                  ? "bg-primary/5 border-primary/30"
                  : "bg-destructive/5 border-destructive/30"
              )}
            >
              {/* Header - Click to expand */}
              <div 
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => toggleExpanded(feature.key)}
              >
                {/* Service Info */}
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      configured
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Label className="font-medium text-foreground cursor-pointer">
                        {feature.name}
                      </Label>
                      {configured ? (
                        <Check className="h-3 w-3 text-primary shrink-0" />
                      ) : (
                        <X className="h-3 w-3 text-destructive shrink-0" />
                      )}
                      {validBindings.length > 0 && (
                        <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                          {validBindings.length} mô hình
                        </span>
                      )}
                      {isFreedomFeature && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          Có thể dùng {selectableOptionKeys.length}
                        </span>
                      )}
                      {isFreedomFeature && invalidBindings.length > 0 && (
                        <span className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                          Tạm không dùng được {invalidBindings.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {feature.description}
                    </p>
                  </div>
                </div>

                {/* Expand/Collapse Icon */}
                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              
              {/* Expanded: Brand-categorized model selection */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-border/50">
                  {options.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Chưa có mô hình (vui lòng cấu hình danh sách mô hình trong API dịch vụ trước)
                    </p>
                  ) : (
                    <div className="space-y-3 pt-3">
                      <p className="text-xs text-muted-foreground">
                        Có thể chọn nhiều, yêu cầu sẽ được phân phối luân phiên đến từng mô hình (cách 3 giây)
                      </p>

                      {/* Gợi ý mô hình khuyến nghị */}
                      {feature.recommendation && (
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-red-500/10 border border-red-500/30">
                          <span className="text-sm font-bold text-red-600 dark:text-red-400 leading-relaxed">
                            {feature.recommendation}
                          </span>
                        </div>
                      )}

                      {/* Biểu ngữ gợi ý phân nhóm MemeFast */}
                      {(() => {
                        const groups = new Set<string>();
                        for (const binding of currentBindings) {
                          const parsed = parseOptionKey(binding);
                          if (!parsed) continue;
                          const isMemefast = memefastProviderIds.has(parsed.providerIdOrPlatform)
                            || parsed.providerIdOrPlatform === 'memefast';
                          if (!isMemefast) continue;
                          const mg = modelEnableGroups[parsed.model];
                          if (mg) for (const g of mg) groups.add(g);
                        }
                        const sortedGroups = [...groups].sort();
                        if (sortedGroups.length === 0) return null;
                        return (
                          <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-md bg-blue-500/10 border border-blue-500/30">
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              Các mô hình MemeFast đã chọn hỗ trợ các nhóm sau:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {sortedGroups.map(g => (
                                <span key={g} className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                  {g}
                                </span>
                              ))}
                            </div>
                            <span className="text-[11px] text-blue-600/80 dark:text-blue-400/80">
                              Khuyến nghị thêm Key cho tất cả các nhóm trên trong trang quản lý memefast.top, càng nhiều Key thì tính sẵn sàng càng cao.
                            </span>
                          </div>
                        );
                      })()}
                      {isFreedomFeature && invalidBindings.length > 0 && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          Phát hiện binding tạm không dùng được: hệ thống sẽ không tự xoá, mô hình sẽ tự động khả dụng trở lại khi phục hồi.
                        </p>
                      )}

                      {/* Bảng tự do - một click chọn tất cả (tích = chọn tất cả; bỏ tích = bỏ chọn tất cả) */}
                      {isFreedomFeature && (
                        <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <Checkbox
                              checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                              onCheckedChange={handleToggleSelectAll}
                              disabled={selectableOptionKeys.length === 0}
                            />
                            Chọn tất cả mô hình (bỏ tích = bỏ chọn tất cả)
                          </label>
                          <span className="text-[11px] text-muted-foreground">
                            {selectedSelectableCount}/{selectableOptionKeys.length}
                          </span>
                        </div>
                      )}

                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Tìm kiếm tên mô hình..."
                          value={searchQuery[feature.key] || ''}
                          onChange={(e) => setSearchQuery(prev => ({ ...prev, [feature.key]: e.target.value }))}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </div>

                      {/* Brand Pills */}
                      {(() => {
                        const brands = brandGroupsByFeature[feature.key] || [];
                        const activeBrand = selectedBrand[feature.key] || null;
                        const query = (searchQuery[feature.key] || '').toLowerCase();

                        // Danh sách mô hình sau khi lọc
                        const filteredOptions = options.filter(o => {
                          if (query && !o.model.toLowerCase().includes(query) && !getModelDisplayName(o.model).toLowerCase().includes(query)) return false;
                          if (activeBrand && extractBrandFromModel(o.model) !== activeBrand) return false;
                          return true;
                        });

                        return (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              {/* Tất cả thương hiệu */}
                              <button
                                type="button"
                                onClick={() => setSelectedBrand(prev => ({ ...prev, [feature.key]: null }))}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                  !activeBrand
                                    ? "bg-primary/10 border-primary/40 text-primary"
                                    : "bg-muted/30 border-border hover:bg-accent/50 text-muted-foreground"
                                )}
                              >
                                Tất cả thương hiệu
                                <span className={cn(
                                  "text-[10px] px-1 py-0.5 rounded-full min-w-[18px] text-center",
                                  !activeBrand ? "bg-primary/20" : "bg-muted"
                                )}>
                                  {options.length}
                                </span>
                              </button>

                              {brands.map(({ brandId, options: brandOpts }) => {
                                const info = getBrandInfo(brandId);
                                const isActive = activeBrand === brandId;
                                return (
                                  <button
                                    key={brandId}
                                    type="button"
                                    onClick={() => setSelectedBrand(prev => ({
                                      ...prev,
                                      [feature.key]: isActive ? null : brandId,
                                    }))}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                      isActive
                                        ? "bg-primary/10 border-primary/40 text-primary"
                                        : "bg-muted/30 border-border hover:bg-accent/50 text-muted-foreground"
                                    )}
                                  >
                                    <span className="shrink-0">{getBrandIcon(brandId, 14)}</span>
                                    {info.displayName}
                                    <span className={cn(
                                      "text-[10px] px-1 py-0.5 rounded-full min-w-[18px] text-center",
                                      isActive ? "bg-primary/20" : "bg-muted"
                                    )}>
                                      {brandOpts.length}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Model List */}
                            <div className="space-y-1 max-h-[280px] overflow-y-auto">
                              {filteredOptions.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2 text-center">
                                  Không có mô hình phù hợp
                                </p>
                              ) : (
                                filteredOptions.map((option) => {
                                  const optionKey = getOptionKey(option);
                                  const optionConfigured = isProviderConfigured(option.providerId);
                                  const legacyKey = `${option.platform}:${option.model}`;
                                  const isSelected = currentBindings.includes(optionKey) || currentBindings.includes(legacyKey);
                                  const brandId = extractBrandFromModel(option.model);

                                  return (
                                    <label
                                      key={optionKey}
                                      className={cn(
                                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                                        isSelected
                                          ? "bg-primary/10 border border-primary/30"
                                          : "hover:bg-accent/50 border border-transparent",
                                        !optionConfigured && "opacity-50"
                                      )}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleToggleBinding(feature, optionKey)}
                                        disabled={!optionConfigured}
                                      />
                                      <span className="shrink-0">{getBrandIcon(brandId, 14)}</span>
                                      <span className="text-xs font-mono text-foreground">
                                        {getModelDisplayName(option.model)}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground ml-auto">
                                        {option.name}
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Summary */}
      {configuredCount < FEATURE_CONFIGS.length && (
        <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-destructive">
              Một số dịch vụ chưa được cấu hình
            </p>
            <p className="text-muted-foreground mt-1">
              Vui lòng chọn「Nhà cung cấp/Mô hình」cho từng tính năng ở trên, và đảm bảo nhà cung cấp tương ứng đã nhập API Key.
            </p>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-2">
        <p>
          <strong>💡 Luân phiên đa mô hình:</strong>
          Mỗi tính năng có thể chọn nhiều mô hình, yêu cầu sẽ phân phối tuần tự đến từng mô hình (cách 3 giây mỗi lần), tránh bị giới hạn tốc độ API đơn lẻ.
        </p>
        <p>
          <strong>📌 Lưu ý:</strong>
          Các tuỳ chọn đến từ danh sách mô hình đã cấu hình trong「API Nhà cung cấp」, nhấp để mở rộng và chọn nhiều.
        </p>
      </div>
    </div>
  );
}
