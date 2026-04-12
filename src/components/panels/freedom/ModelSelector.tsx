"use client";

import { useState, useMemo } from 'react';
import { AlertTriangle, Check, ChevronsUpDown, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAPIConfigStore } from '@/stores/api-config-store';
import { extractBrandFromModel, getBrandInfo } from '@/lib/brand-mapping';
import { getModelDisplayName } from '@/lib/freedom/model-display-names';

interface ModelSelectorProps {
  type: 'image' | 'video';
  value: string;
  onChange: (modelId: string) => void;
  className?: string;
}

interface SelectorModel {
  id: string;       // Nhà cung cấpnguyên bảnMô hình ID（\u76f4\u63a5sử dụng\u4e8e API \u8c03sử dụng）
  name: string;     // \u663e\u793atên
  brandId: string;  // Thương hiệu ID
}

const KLING_VIDEO_VARIANTS = [
  'kling-video',
  'kling-omni-video',
  'kling-video-extend',
  'kling-motion-control',
  'kling-multi-elements',
  'kling-avatar-image2video',
  'kling-advanced-lip-sync',
  'kling-effects',
  // kling-video Mô hìnhPhiên bản (MemeFast model_version)
  'kling-v1',
  'kling-v1-5',
  'kling-v1-6',
  'kling-v2-master',
  'kling-v2-1',
  'kling-v2-1-master',
  'kling-v2-5-turbo',
  'kling-v2-6',
];
const VEO3_VIDEO_VARIANTS = [
  'veo3',
  'veo3-fast',
  'veo3-frames',
  'veo3-fast-frames',
  'veo3-pro',
  'veo3-pro-frames',
];

const VEO31_VIDEO_VARIANTS = [
  'veo3.1',
  'veo3.1-fast',
  'veo3.1-4k',
  'veo3.1-pro',
  'veo3.1-pro-4k',
  'veo3.1-components',
  'veo3.1-fast-components',
  'veo3.1-components-4k',
];

const VEO31_OPENAI_VIDEO_VARIANTS = [
  'veo_3_1',
  'veo_3_1-fast',
  'veo_3_1-components',
  'veo_3_1-4K',
  'veo_3_1-fast-4K',
  'veo_3_1-components-4K',
  'veo_3_1-fast-components-4K',
];

const VEO2_VIDEO_VARIANTS = [
  'veo2',
  'veo2-fast',
  'veo2-fast-frames',
  'veo2-fast-components',
  'veo2-pro',
  'veo2-pro-components',
];

const SORA_VIDEO_VARIANTS = [
  'sora-2',
  'sora-2-pro',
  'sora-2-all',
  'sora-2-pro-all',
  'sora-2-vip-all',
];

const RUNWAY_VIDEO_VARIANTS = [
  'runwayml-gen3a_turbo-5',
  'runwayml-gen3a_turbo-10',
  'runwayml-gen4_turbo-5',
  'runwayml-gen4_turbo-10',
];

const VIDU_VIDEO_VARIANTS = [
  'vidu2.0',
  'viduq1',
  'viduq1-classic',
  'viduq2',
  'viduq2-pro',
  'viduq2-turbo',
  'viduq3-pro',
];

const MINIMAX_VIDEO_VARIANTS = [
  'MiniMax-Hailuo-02',
  'MiniMax-Hailuo-2.3',
  'MiniMax-Hailuo-2.3-Fast',
];

const MINIMAX_VIDEO01_VARIANTS = [
  'minimax/video-01',
  'minimax/video-01-live',
];

const WAN_VIDEO_VARIANTS = [
  'wan2.5-i2v-preview',
  'wan2.6-i2v',
  'wan2.6-i2v-flash',
];

const SEEDANCE_VIDEO_VARIANTS = [
  'doubao-seedance-1-5-pro-251215',
  'doubao-seedance-1-0-pro-250528',
  'doubao-seedance-1-0-pro-fast-251015',
  'doubao-seedance-1-0-lite-t2v-250428',
  'doubao-seedance-1-0-lite-i2v-250428',
];

const LUMA_VIDEO_VARIANTS = [
  'luma_video_api',
  'luma_video_extend_api',
];

const GROK_VIDEO_VARIANTS = [
  'grok-video-3',
  'grok-video-3-10s',
  'grok-video-3-15s',
];

const GEMINI_IMAGE_VARIANTS = [
  'gemini-3.1-pro-image-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
  'gemini-2.5-flash-image-preview',
];

const GPT_IMAGE_VARIANTS = [
  'gpt-image-1.5',
  'gpt-image-1.5-all',
  'gpt-image-1',
  'gpt-image-1-all',
  'gpt-image-1-mini',
  'gpt-4o-image-vip',
];

const QWEN_IMAGE_VARIANTS = [
  'qwen-image-max',
  'qwen-image-max-2025-12-30',
];

const SEEDREAM_IMAGE_VARIANTS = [
  'doubao-seedream-4-5-251128',
  'doubao-seedream-4-0-250828',
  'doubao-seedream-3-0-t2i-250415',
];

const KLING_IMAGE_VARIANTS = [
  'kling-image',
  'kling-omni-image',
  // kling-image Mô hìnhPhiên bản (MemeFast model_version)
  'kling-image-v1',
  'kling-image-v1-5',
  'kling-image-v2',
  'kling-image-v2-new',
  'kling-image-v2-1',
];

const Z_IMAGE_VARIANTS = [
  'z-image-turbo',
];

const MIDJOURNEY_IMAGE_VARIANTS = [
  'midjourney',
  'niji-6',
  'mj_imagine',
];

const IDEOGRAM_IMAGE_VARIANTS = [
  'ideogram_generate_V_1',
  'ideogram_generate_V_1_TURBO',
  'ideogram_generate_V_2',
  'ideogram_generate_V_2_TURBO',
  'ideogram_generate_V_3_DEFAULT',
  'ideogram_generate_V_3_QUALITY',
  'ideogram_generate_V_3_TURBO',
];

const VIDEO_FAMILY_VARIANTS: Record<string, string[]> = {
  // Kling
  'kling-video': KLING_VIDEO_VARIANTS,
  'kling-omni-video': KLING_VIDEO_VARIANTS,
  'kling-video-extend': KLING_VIDEO_VARIANTS,
  'kling-motion-control': KLING_VIDEO_VARIANTS,
  'kling-multi-elements': KLING_VIDEO_VARIANTS,
  'kling-avatar-image2video': KLING_VIDEO_VARIANTS,
  'kling-advanced-lip-sync': KLING_VIDEO_VARIANTS,
  'kling-effects': KLING_VIDEO_VARIANTS,
  'aigc-video-kling': KLING_VIDEO_VARIANTS,
  // kling-video Mô hìnhPhiên bản (MemeFast model_version)
  'kling-v1': KLING_VIDEO_VARIANTS,
  'kling-v1-5': KLING_VIDEO_VARIANTS,
  'kling-v1-6': KLING_VIDEO_VARIANTS,
  'kling-v2-master': KLING_VIDEO_VARIANTS,
  'kling-v2-1': KLING_VIDEO_VARIANTS,
  'kling-v2-1-master': KLING_VIDEO_VARIANTS,
  'kling-v2-5-turbo': KLING_VIDEO_VARIANTS,
  'kling-v2-6': KLING_VIDEO_VARIANTS,
  // Google Veo
  'veo3': VEO3_VIDEO_VARIANTS,
  'veo3-fast': VEO3_VIDEO_VARIANTS,
  'veo3-frames': VEO3_VIDEO_VARIANTS,
  'veo3-fast-frames': VEO3_VIDEO_VARIANTS,
  'veo3-pro': VEO3_VIDEO_VARIANTS,
  'veo3-pro-frames': VEO3_VIDEO_VARIANTS,
  'veo3.1': VEO31_VIDEO_VARIANTS,
  'veo3.1-fast': VEO31_VIDEO_VARIANTS,
  'veo3.1-4k': VEO31_VIDEO_VARIANTS,
  'veo3.1-pro': VEO31_VIDEO_VARIANTS,
  'veo3.1-pro-4k': VEO31_VIDEO_VARIANTS,
  'veo3.1-components': VEO31_VIDEO_VARIANTS,
  'veo3.1-fast-components': VEO31_VIDEO_VARIANTS,
  'veo3.1-components-4k': VEO31_VIDEO_VARIANTS,
  'veo_3_1': VEO31_OPENAI_VIDEO_VARIANTS,
  'veo_3_1-fast': VEO31_OPENAI_VIDEO_VARIANTS,
  'veo_3_1-components': VEO31_OPENAI_VIDEO_VARIANTS,
  'veo_3_1-4K': VEO31_OPENAI_VIDEO_VARIANTS,
  'veo_3_1-fast-4K': VEO31_OPENAI_VIDEO_VARIANTS,
  'veo_3_1-components-4K': VEO31_OPENAI_VIDEO_VARIANTS,
  'veo_3_1-fast-components-4K': VEO31_OPENAI_VIDEO_VARIANTS,
  'veo2': VEO2_VIDEO_VARIANTS,
  'veo2-fast': VEO2_VIDEO_VARIANTS,
  'veo2-fast-frames': VEO2_VIDEO_VARIANTS,
  'veo2-fast-components': VEO2_VIDEO_VARIANTS,
  'veo2-pro': VEO2_VIDEO_VARIANTS,
  'veo2-pro-components': VEO2_VIDEO_VARIANTS,
  // OpenAI Sora
  'sora-2': SORA_VIDEO_VARIANTS,
  'sora-2-pro': SORA_VIDEO_VARIANTS,
  'sora-2-all': SORA_VIDEO_VARIANTS,
  'sora-2-pro-all': SORA_VIDEO_VARIANTS,
  'sora-2-vip-all': SORA_VIDEO_VARIANTS,
  // Runway
  'runwayml-gen3a_turbo-5': RUNWAY_VIDEO_VARIANTS,
  'runwayml-gen3a_turbo-10': RUNWAY_VIDEO_VARIANTS,
  'runwayml-gen4_turbo-5': RUNWAY_VIDEO_VARIANTS,
  'runwayml-gen4_turbo-10': RUNWAY_VIDEO_VARIANTS,
  // Vidu
  'vidu2.0': VIDU_VIDEO_VARIANTS,
  'viduq1': VIDU_VIDEO_VARIANTS,
  'viduq1-classic': VIDU_VIDEO_VARIANTS,
  'viduq2': VIDU_VIDEO_VARIANTS,
  'viduq2-pro': VIDU_VIDEO_VARIANTS,
  'viduq2-turbo': VIDU_VIDEO_VARIANTS,
  'viduq3-pro': VIDU_VIDEO_VARIANTS,
  'aigc-video-vidu': VIDU_VIDEO_VARIANTS,
  // MiniMax
  'MiniMax-Hailuo-02': MINIMAX_VIDEO_VARIANTS,
  'MiniMax-Hailuo-2.3': MINIMAX_VIDEO_VARIANTS,
  'MiniMax-Hailuo-2.3-Fast': MINIMAX_VIDEO_VARIANTS,
  'aigc-video-hailuo': MINIMAX_VIDEO_VARIANTS,
  'minimax/video-01': MINIMAX_VIDEO01_VARIANTS,
  'minimax/video-01-live': MINIMAX_VIDEO01_VARIANTS,
  // Wan
  'wan2.5-i2v-preview': WAN_VIDEO_VARIANTS,
  'wan2.6-i2v': WAN_VIDEO_VARIANTS,
  'wan2.6-i2v-flash': WAN_VIDEO_VARIANTS,
  // Doubao Seedance
  'doubao-seedance-1-5-pro-251215': SEEDANCE_VIDEO_VARIANTS,
  'doubao-seedance-1-0-pro-250528': SEEDANCE_VIDEO_VARIANTS,
  'doubao-seedance-1-0-pro-fast-251015': SEEDANCE_VIDEO_VARIANTS,
  'doubao-seedance-1-0-lite-t2v-250428': SEEDANCE_VIDEO_VARIANTS,
  'doubao-seedance-1-0-lite-i2v-250428': SEEDANCE_VIDEO_VARIANTS,
  'doubao-seedance-1-5-pro-250428': SEEDANCE_VIDEO_VARIANTS,
  // Luma
  'luma_video_api': LUMA_VIDEO_VARIANTS,
  'luma_video_extend_api': LUMA_VIDEO_VARIANTS,
  // Grok
  'grok-video-3': GROK_VIDEO_VARIANTS,
  'grok-video-3-10s': GROK_VIDEO_VARIANTS,
  'grok-video-3-15s': GROK_VIDEO_VARIANTS,
};

const IMAGE_FAMILY_VARIANTS: Record<string, string[]> = {
  // Gemini image
  'gemini-3.1-pro-image-preview': GEMINI_IMAGE_VARIANTS,
  'gemini-3-pro-image-preview': GEMINI_IMAGE_VARIANTS,
  'gemini-2.5-flash-image': GEMINI_IMAGE_VARIANTS,
  'gemini-2.5-flash-image-preview': GEMINI_IMAGE_VARIANTS,
  // GPT image
  'gpt-image-1.5': GPT_IMAGE_VARIANTS,
  'gpt-image-1.5-all': GPT_IMAGE_VARIANTS,
  'gpt-image-1': GPT_IMAGE_VARIANTS,
  'gpt-image-1-all': GPT_IMAGE_VARIANTS,
  'gpt-image-1-mini': GPT_IMAGE_VARIANTS,
  'gpt-4o-image-vip': GPT_IMAGE_VARIANTS,
  // Qwen image
  'qwen-image-max': QWEN_IMAGE_VARIANTS,
  'qwen-image-max-2025-12-30': QWEN_IMAGE_VARIANTS,
  // Seedream image
  'doubao-seedream-4-5-251128': SEEDREAM_IMAGE_VARIANTS,
  'doubao-seedream-4-0-250828': SEEDREAM_IMAGE_VARIANTS,
  'doubao-seedream-3-0-t2i-250415': SEEDREAM_IMAGE_VARIANTS,
  // Kling image
  'kling-image': KLING_IMAGE_VARIANTS,
  'kling-omni-image': KLING_IMAGE_VARIANTS,
  // kling-image Mô hìnhPhiên bản (MemeFast model_version)
  'kling-image-v1': KLING_IMAGE_VARIANTS,
  'kling-image-v1-5': KLING_IMAGE_VARIANTS,
  'kling-image-v2': KLING_IMAGE_VARIANTS,
  'kling-image-v2-new': KLING_IMAGE_VARIANTS,
  'kling-image-v2-1': KLING_IMAGE_VARIANTS,
  // Z-Image
  'z-image-turbo': Z_IMAGE_VARIANTS,
  // Midjourney
  'midjourney': MIDJOURNEY_IMAGE_VARIANTS,
  'niji-6': MIDJOURNEY_IMAGE_VARIANTS,
  'mj_imagine': MIDJOURNEY_IMAGE_VARIANTS,
  'mj_blend': MIDJOURNEY_IMAGE_VARIANTS,
  'mj_describe': MIDJOURNEY_IMAGE_VARIANTS,
  'mj_modal': MIDJOURNEY_IMAGE_VARIANTS,
  // Ideogram
  'ideogram_generate_V_1': IDEOGRAM_IMAGE_VARIANTS,
  'ideogram_generate_V_1_TURBO': IDEOGRAM_IMAGE_VARIANTS,
  'ideogram_generate_V_2': IDEOGRAM_IMAGE_VARIANTS,
  'ideogram_generate_V_2_TURBO': IDEOGRAM_IMAGE_VARIANTS,
  'ideogram_generate_V_3_DEFAULT': IDEOGRAM_IMAGE_VARIANTS,
  'ideogram_generate_V_3_QUALITY': IDEOGRAM_IMAGE_VARIANTS,
  'ideogram_generate_V_3_TURBO': IDEOGRAM_IMAGE_VARIANTS,
};

function expandBoundModel(type: 'image' | 'video', model: string): string[] {
  if (type === 'video') return VIDEO_FAMILY_VARIANTS[model] ?? [model];
  return IMAGE_FAMILY_VARIANTS[model] ?? [model];
}

function shouldHideModel(type: 'image' | 'video', model: string): boolean {
  if (type === 'video') {
    // \u7c7b\u76eelối vào\u4e0dhiển thị
    if (model === 'kling-video') return true;
    if (model === 'sora-2-characters') return true;

    return false;
  }

  // Hình ảnh\u9762\u677f：\u9690\u85cfhiện tại UI \u4e0dHỗ trợcủaNhiệm vụ\u578bMô hình（Chỉnh sửa/\u91cd\u7ed8/\u8bc6\u56fe/\u653e\u5927Đợi đã）
  if (/^mj_/i.test(model) && model !== 'mj_imagine') return true;
  if (/^ideogram_(edit|reframe|remix|replace_background|upscale|describe)/i.test(model)) return true;
  if (/^(kling-image-recognize|deepseek-ocr)$/i.test(model)) return true;
  if (/qwen-image-edit/i.test(model)) return true;
  if (/seededit/i.test(model)) return true;
  if (/(inpainting|img2img|remove-bg|object-removal|vectorize|rembg)/i.test(model)) return true;

  return false;
}

function isModelAllowedByPanelType(
  type: 'image' | 'video',
  modelId: string,
  modelTypes: Record<string, string>,
  modelEndpointTypes: Record<string, string[]>
): boolean {
  const endpointTypes = modelEndpointTypes[modelId] || [];
  const modelType = modelTypes[modelId];
  if (type === 'image') {
    // \u672a\u540c\u6b65Đến model_type \u65f6đầu tiên\u653eđược rồi，\u907f\u514d\u8bef\u4f24Có sẵnMô hình
    if (!modelType) return true;
    return modelType === '\u56fe\u50cf';
  }

  // Video\u9762\u677f：đầu tiên\u6309 model_type \u7c97Lọc
  if (modelType && modelType !== 'Âm thanhVideo') return false;

  // Một lần nữa\u6309 endpoint type \u7ec6Lọc，\u6392\u9664\u7eafÂm thanh\u7c7bMô hình
  if (endpointTypes.length > 0) {
    return endpointTypes.some((t) => /Video|video|\u6587\u751fVideo|\u56fe\u751fVideo|\u9996\u5c3e\u5e27|Tài liệu tham khảo\u751fVideo|mở rộng|Hành động\u63a7\u5236|con số\u4eba|omni-video/i.test(t));
  }

  // endpoint thiếu\u5931\u65f6sử dụngMô hình tênHãy ghi nhớ mọi thứ\u5224\u5b9a（\u907f\u514dTuỳ chỉnhMở rộng\u578b\u53f7\u88ab\u8befLọc）
  return /kling|veo|sora|runway|vidu|hailuo|minimax\/video|wan|luma|grok-video|seedance|aigc-video/i.test(modelId);
}

export function ModelSelector({ type, value, onChange, className }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const getFeatureBindings = useAPIConfigStore((s) => s.getFeatureBindings);
  const modelTypes = useAPIConfigStore((s) => s.modelTypes);
  const modelEndpointTypes = useAPIConfigStore((s) => s.modelEndpointTypes);

  // \u76f4\u63a5từ featureBindings \u8bfb\u53d6Đã Liên kếtcủaMô hình danh sách
  // Định dạng: ["memefast:gemini-3-pro-image-preview", "memefast:flux-dev", ...]
  const models = useMemo((): SelectorModel[] => {
    const feature = type === 'image' ? 'freedom_image' : 'freedom_video';
    const bindings = getFeatureBindings(feature);
    if (!bindings || bindings.length === 0) return [];

    const result: SelectorModel[] = [];
    const seen = new Set<string>();

    for (const binding of bindings) {
      const idx = binding.indexOf(':');
      if (idx <= 0) continue;
      const model = binding.slice(idx + 1);
      if (!model) continue;

      const expandedModels = expandBoundModel(type, model);
      for (const expandedModel of expandedModels) {
        if (!isModelAllowedByPanelType(type, expandedModel, modelTypes, modelEndpointTypes)) continue;
        if (shouldHideModel(type, expandedModel)) continue;
        if (!expandedModel || seen.has(expandedModel)) continue;
        seen.add(expandedModel);

        result.push({
          id: expandedModel,
          name: getModelDisplayName(expandedModel),
          brandId: extractBrandFromModel(expandedModel),
        });
      }
    }

    return result;
  }, [type, getFeatureBindings, modelTypes, modelEndpointTypes]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    );
  }, [models, search]);
  const brandAvailableCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const model of models) {
      counts[model.brandId] = (counts[model.brandId] ?? 0) + 1;
    }
    return counts;
  }, [models]);

  // \u6309Thương hiệu\u5206\u7ec4
  const grouped = useMemo(() => {
    const groups: Record<string, { brand: ReturnType<typeof getBrandInfo>; models: SelectorModel[] }> = {};
    for (const model of filteredModels) {
      if (!groups[model.brandId]) {
        groups[model.brandId] = {
          brand: getBrandInfo(model.brandId),
          models: [],
        };
      }
      groups[model.brandId].models.push(model);
    }
    return groups;
  }, [filteredModels]);

  const selectedModel = models.find((m) => m.id === value);
  const showUnavailableWarning = Boolean(value) && !selectedModel;

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between h-10', className)}
          >
            <span className="truncate">
              {selectedModel ? selectedModel.name : value ? getModelDisplayName(value) : '\u9009\u62e9Mô hình...'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Tìm kiếmMô hình..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0 h-8 px-0"
            />
          </div>
          <ScrollArea className="h-[400px]">
            <div className="p-1">
              {Object.entries(grouped).map(([brandId, { brand, models: brandModels }]) => (
                <div key={brandId} className="mb-2">
                  <div className="px-2 py-1.5 flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium"
                      style={{ borderColor: brand.color + '40' }}
                    >
                      {brand.displayName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Có sẵn {brandAvailableCounts[brandId] ?? brandModels.length}
                    </span>
                  </div>
                  {brandModels.map((model) => (
                    <button
                      key={model.id}
                      className={cn(
                        'flex items-center w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer',
                        value === model.id && 'bg-accent'
                      )}
                      onClick={() => {
                        onChange(model.id);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          value === model.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="truncate flex-1 text-left">{model.name}</span>
                    </button>
                  ))}
                </div>
              ))}
              {Object.keys(grouped).length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground space-y-2">
                  <Settings className="h-5 w-5 mx-auto mb-1 opacity-50" />
                  <p>\u6682Không Có sẵnMô hình</p>
                  <p className="text-xs">
                    \u8bf7đầu tiên\u5728Cài đặt → \u670d\u52a1\u6620\u5c04 → {type === 'image' ? 'Tấm miễn phí-Hình ảnh' : 'Phần video miễn phí'} trong\u52fe\u9009Mô hình
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {showUnavailableWarning && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            hiện tạiĐã rồi\u9009Mô hình\u4e0dCó sẵn（\u53ef\u80fdĐã rồiGỡ xuốnghoặc\u88abhiện tại\u9762\u677fLọc），\u8bf7\u91cd\u65b0\u9009\u62e9Có sẵnMô hình。
          </span>
        </div>
      )}
    </div>
  );
}
