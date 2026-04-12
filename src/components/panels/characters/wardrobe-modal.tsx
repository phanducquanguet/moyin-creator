// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Wardrobe Modal Component
 * Manages character variations (outfits/states) with AI generation support
 * Leverages Nano Banana (Gemini) multi-image fusion for outfit swapping:
 *   - Character base portrait for face/body consistency
 *   - User-uploaded clothing reference images for target outfit
 *   - Text prompt for fine-grained control
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  type Character,
  type CharacterVariation,
  useCharacterLibraryStore,
} from "@/stores/character-library-store";
import { useMediaStore } from "@/stores/media-store";
import { useProjectStore } from "@/stores/project-store";
import { getFeatureConfig, getFeatureNotConfiguredMessage } from "@/lib/ai/feature-router";
import { submitGridImageRequest } from "@/lib/ai/image-generator";
import { readImageAsBase64, saveImageToLocal } from "@/lib/image-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Wand2,
  Loader2,
  Shirt,
  ImageIcon,
  Check,
  X,
  RotateCcw,
  Upload,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getStyleById } from "@/lib/constants/visual-styles";
import { LocalImage } from "@/components/ui/local-image";
import { ImagePreviewModal } from "@/components/panels/director/media-preview-modal";

// Preset variation types for quick creation
const VARIATION_PRESETS = [
  { name: "mặc hàng ngày", prompt: "casual everyday clothing, relaxed outfit" },
  { name: "trang phục chính thức", prompt: "formal attire, business suit, elegant clothing" },
  { name: "đồng phục chiến đấu", prompt: "tactical gear, combat outfit, armor" },
  { name: "\u7761\u8863", prompt: "sleepwear, pajamas, nightwear" },
  { name: "các môn thể thao\u88c5", prompt: "sportswear, athletic clothing, workout outfit" },
  { name: "Bị thương\u72b6\u6001", prompt: "injured appearance, bandages, wounds" },
  { name: "mưa\u5929\u88c5\u626e", prompt: "raincoat, umbrella, wet weather gear" },
  { name: "mùa đông\u88c5", prompt: "winter clothing, warm coat, scarf" },
] as const;

// Max clothing reference images per variation
const MAX_CLOTHING_REFS = 3;

interface WardrobeModalProps {
  character: Character;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WardrobeModal({ character, open, onOpenChange }: WardrobeModalProps) {
  const { addVariation, updateVariation, deleteVariation } = useCharacterLibraryStore();
  const { addMediaFromUrl, getOrCreateCategoryFolder } = useMediaStore();
  const { activeProjectId } = useProjectStore();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVariationName, setNewVariationName] = useState("");
  const [newVariationPrompt, setNewVariationPrompt] = useState("");
  const [newClothingRefs, setNewClothingRefs] = useState<string[]>([]);
  const [generatingVariationId, setGeneratingVariationId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    variationId: string;
    imageUrl: string;
  } | null>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  // Auto-focus name input when custom form opens (fix Radix Dialog focus trap issue)
  useEffect(() => {
    if (showAddForm) {
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }, [showAddForm]);

  const variations = character.variations || [];

  // Get character base portrait
  const characterBaseImage = character.thumbnailUrl || character.views[0]?.imageUrl;

  // ---- Image Upload ----
  const handleClothingImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_CLOTHING_REFS - newClothingRefs.length;
    if (remaining <= 0) {
      toast.error(`nhất\u4e0a\u4f20 ${MAX_CLOTHING_REFS} \u5f20Hình ảnh tham khảo`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);

    filesToProcess.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} \u8d85\u8fc7 5MB \u9650\u5236`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        if (base64) {
          setNewClothingRefs((prev) => {
            if (prev.length >= MAX_CLOTHING_REFS) return prev;
            return [...prev, base64];
          });
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be re-selected
    e.target.value = "";
  }, [newClothingRefs.length]);

  const handleRemoveClothingRef = useCallback((index: number) => {
    setNewClothingRefs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ---- Add Variation ----
  const handleAddVariation = () => {
    if (!newVariationName.trim()) {
      toast.error("\u8bf7\u8f93\u5165thay đổi\u4f53tên\u79f0");
      return;
    }

    addVariation(character.id, {
      name: newVariationName.trim(),
      visualPrompt: newVariationPrompt.trim() || `${newVariationName.trim()} outfit`,
      clothingReferenceImages: newClothingRefs.length > 0 ? newClothingRefs : undefined,
    });

    resetAddForm();
    toast.success("thay đổi\u4f53Đã rồi\u6dfb\u52a0");
  };

  const handleQuickAdd = (preset: typeof VARIATION_PRESETS[number]) => {
    addVariation(character.id, {
      name: preset.name,
      visualPrompt: preset.prompt,
    });
    toast.success(`Đã rồi\u6dfb\u52a0 "${preset.name}" thay đổi\u4f53`);
  };

  const resetAddForm = () => {
    setShowAddForm(false);
    setNewVariationName("");
    setNewVariationPrompt("");
    setNewClothingRefs([]);
  };

  // ---- Delete Variation ----
  const handleDeleteVariation = (variationId: string, name: string) => {
    if (confirm(`\u786e\u5b9a\u8981\u5220\u9664thay đổi\u4f53 "${name}" \u5417？`)) {
      deleteVariation(character.id, variationId);
      toast.success("thay đổi\u4f53Đã rồi\u5220\u9664");
    }
  };

  // ---- Generate Variation Image ----
  const handleGenerateVariation = async (variation: CharacterVariation) => {
    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('character_generation'));
      return;
    }

    // Need base character image for face consistency
    if (!characterBaseImage) {
      toast.error("\u8bf7đầu tiên\u751f\u6210\u89d2\u8272\u57fa\u7840\u5b9a\u5986\u7167，\u4ee5giữmột\u81f4\u6027");
      return;
    }

    setGeneratingVariationId(variation.id);

    try {
      const imageUrl = await generateVariationImage({
        character,
        variation,
        featureConfig,
      });

      // Show preview
      setPreviewData({
        variationId: variation.id,
        imageUrl,
      });

      toast.success("thay đổi\u4f53\u56fe\u7247\u751f\u6210Hoàn thành，\u8bf7\u9884\u89c8\u786e\u8ba4");
    } catch (error) {
      const err = error as Error;
      toast.error(`\u751f\u6210\u5931\u8d25: ${err.message}`);
    } finally {
      setGeneratingVariationId(null);
    }
  };

  // ---- Preview Actions ----
  const handleSavePreview = async () => {
    if (!previewData) return;

    const variation = variations.find(v => v.id === previewData.variationId);
    const varName = variation?.name || 'variation';
    const ts = Date.now();
    const safeName = `${character.name}_${varName}_${ts}`.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_]/g, '_');

    toast.loading("\u6b63\u5728\u4fdd\u5b58\u56fe\u7247Đến\u672c\u5730...", { id: 'saving-wardrobe' });

    try {
      // 1. Persist image locally (same as generation-panel)
      const localPath = await saveImageToLocal(
        previewData.imageUrl,
        'wardrobe',
        `${safeName}.png`
      );

      // 2. Update variation in store with local path
      updateVariation(character.id, previewData.variationId, {
        referenceImage: localPath,
        generatedAt: ts,
      });

      // 3. Archive to media library (AI\u56fe\u7247 folder)
      const aiFolderId = getOrCreateCategoryFolder('ai-image');
      addMediaFromUrl({
        url: localPath,
        name: `\u8863\u6a71-${character.name}-${varName}`,
        type: 'image',
        source: 'ai-image',
        folderId: aiFolderId,
        projectId: activeProjectId || undefined,
      });

      setPreviewData(null);
      toast.success("thay đổi\u4f53\u56fe\u7247Đã rồi\u4fdd\u5b58Đến\u672c\u5730！", { id: 'saving-wardrobe' });
    } catch (error) {
      console.error('[Wardrobe] Failed to save preview:', error);
      toast.error("\u4fdd\u5b58\u5931\u8d25", { id: 'saving-wardrobe' });
    }
  };

  const handleDiscardPreview = () => {
    setPreviewData(null);
  };

  // ======== Preview Dialog ========
  if (previewData) {
    const variation = variations.find(v => v.id === previewData.variationId);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] p-0 gap-0 flex flex-col">
          <div className="px-6 pt-6 pb-3 shrink-0">
            <DialogHeader>
              <DialogTitle>\u9884\u89c8thay đổi\u4f53\u56fe\u7247 - {variation?.name}</DialogTitle>
              <DialogDescription>
                \u786e\u8ba4\u56fe\u7247ĐúngKHÔNG\u6ee1\u610f，\u6ee1\u610f\u5219\u4fdd\u5b58
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6">
            <div className="relative rounded-lg overflow-hidden border-2 border-amber-500/50 bg-muted">
              <img 
                src={previewData.imageUrl} 
                alt={`${character.name} - ${variation?.name}`}
                className="w-full h-auto"
              />
              <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded">
                \u9884\u89c8
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-3 space-y-2 shrink-0 border-t">
            <div className="flex gap-2">
              <Button onClick={handleSavePreview} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                \u4fdd\u5b58
              </Button>
              <Button 
                onClick={() => handleGenerateVariation(variation!)} 
                variant="outline"
                disabled={generatingVariationId !== null}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                \u91cdmới\u751f\u6210
              </Button>
            </div>
            <Button onClick={handleDiscardPreview} variant="ghost" className="w-full">
              \u653e\u5f03\u5e76\u8fd4\u56de
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ======== Main Dialog ========
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0 flex flex-col">
        <div className="px-6 pt-6 pb-3 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shirt className="h-5 w-5" />
              {character.name} của\u8863\u6a71
            </DialogTitle>
            <DialogDescription>
              \u7ba1\u7406\u89d2\u8272của\u4e0d\u540c\u9020\u578bthay đổi\u4f53，AI \u751f\u6210\u65f6\u5c06giữđặc điểm khuôn mặtmột\u81f4
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6">
          <div className="space-y-4 pb-4">
          {/* Character base portrait preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
              {characterBaseImage ? (
                <LocalImage
                  src={characterBaseImage}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{character.name}</h4>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">\u57fa\u7840\u5b9a\u5986\u7167</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {character.visualTraits || character.description || '\u672a\u8bbe\u7f6e\u89c6\u89c9\u63cf\u8ff0'}
              </p>
              {!characterBaseImage && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ⚠ \u8bf7đầu tiên\u751f\u6210\u89d2\u8272\u57fa\u7840\u56fe\u7247，\u8863\u6a71thay đổi\u4f53\u9700\u8981\u57fa\u7840\u5b9a\u5986\u7167\u4f5cchoTài liệu tham khảo
                </p>
              )}
            </div>
          </div>

          {/* Existing variations */}
          {variations.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Đã rồiCóthay đổi\u4f53 ({variations.length})</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {variations.map((variation) => (
                  <div
                    key={variation.id}
                    className={cn(
                      "p-3 rounded-lg border bg-card min-w-0",
                      generatingVariationId === variation.id && "opacity-70"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Thumbnail — double-click to zoom */}
                      <div
                        className={cn(
                          "w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0",
                          variation.referenceImage && "cursor-pointer ring-offset-background hover:ring-2 hover:ring-primary/40 hover:ring-offset-1 transition-shadow"
                        )}
                        onDoubleClick={() => variation.referenceImage && setZoomedImageUrl(variation.referenceImage)}
                        title={variation.referenceImage ? "\u53cc\u51fb\u653e\u5927\u67e5\u770b" : undefined}
                      >
                        {variation.referenceImage ? (
                          <img 
                            src={variation.referenceImage} 
                            alt={variation.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-medium text-sm truncate flex-1 min-w-0">{variation.name}</h4>
                          <Button
                            size="icon"
                            variant="text"
                            className="h-6 w-6 text-destructive"
                            onClick={() => handleDeleteVariation(variation.id, variation.name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 break-all">
                          {variation.visualPrompt}
                        </p>

                        {/* Clothing ref thumbnails */}
                        {variation.clothingReferenceImages && variation.clothingReferenceImages.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {variation.clothingReferenceImages.map((img, i) => (
                              <div key={i} className="w-6 h-6 rounded border bg-muted overflow-hidden flex-shrink-0">
                                <img src={img} alt="ref" className="w-full h-full object-cover" />
                              </div>
                            ))}
                            <span className="text-[10px] text-muted-foreground self-center">Tài liệu tham khảo</span>
                          </div>
                        )}

                        {/* Generate button */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full h-7 text-xs"
                          onClick={() => handleGenerateVariation(variation)}
                          disabled={generatingVariationId !== null || !characterBaseImage}
                        >
                          {generatingVariationId === variation.id ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              \u751f\u6210trong...
                            </>
                          ) : variation.referenceImage ? (
                            <>
                              <RotateCcw className="h-3 w-3 mr-1" />
                              \u91cdmới\u751f\u6210
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3 w-3 mr-1" />
                              \u751f\u6210\u56fe\u7247
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick add presets */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nhanh\u901f\u6dfb\u52a0</Label>
            <div className="flex flex-wrap gap-2">
              {VARIATION_PRESETS.map((preset) => {
                const exists = variations.some(v => v.name === preset.name);
                return (
                  <Button
                    key={preset.name}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleQuickAdd(preset)}
                    disabled={exists}
                  >
                    {exists ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-green-500" />
                        {preset.name}
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" />
                        {preset.name}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Custom variation form */}
          {showAddForm ? (
            <div
              className="space-y-4 p-4 border rounded-lg bg-muted/30 min-w-0"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Label className="text-sm font-medium">\u6dfb\u52a0\u81ea\u5b9a\u4e49thay đổi\u4f53</Label>

              {/* Variation name */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">thay đổi\u4f53tên\u79f0 *</Label>
                <Input
                  ref={nameInputRef}
                  placeholder="Chẳng hạn như：\u5a5a\u7eb1、\u62abgió\u88c5、\u6821\u670d、\u53e4gió\u6c49\u670d"
                  value={newVariationName}
                  onChange={(e) => setNewVariationName(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Clothing reference images upload */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  quần áoHình ảnh tham khảo（Tùy chọn，nhất {MAX_CLOTHING_REFS} \u5f20）
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  \u4e0a\u4f20\u60f3\u8981\u89d2\u8272\u7a7fcủa\u8863\u670d/\u9020\u578b\u7167\u7247，AI \u4f1a\u5c06\u89d2\u8272\u878d\u5408Đến\u8be5quần áotrong
                </p>

                {/* Uploaded clothing refs */}
                <div className="flex flex-wrap gap-2">
                  {newClothingRefs.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-lg border-2 border-primary/30 overflow-hidden group"
                    >
                      <img
                        src={img}
                        alt={`quần áoTài liệu tham khảo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleRemoveClothingRef(idx)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[9px] text-white text-center py-0.5">
                        Tài liệu tham khảo {idx + 1}
                      </div>
                    </div>
                  ))}

                  {/* Upload button */}
                  {newClothingRefs.length < MAX_CLOTHING_REFS && (
                    <button
                      onClick={() => clothingInputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    >
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">\u4e0a\u4f20</span>
                    </button>
                  )}
                </div>

                <input
                  ref={clothingInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleClothingImageUpload}
                />
              </div>

              {/* Visual prompt */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">\u89c6\u89c9\u63cf\u8ff0（Tùy chọn）</Label>
                <Textarea
                  placeholder="\u63cf\u8ff0quần áoChi tiếthoặc\u6574\u4f53\u9020\u578b，Chẳng hạn như：\n- \u767d\u8272\u857e\u4e1d\u5a5a\u7eb1，\u957f\u62d6\u5c3e，\u5934\u6234\u82b1\u51a0\n- elegant white lace wedding dress, long train, floral headpiece"
                  value={newVariationPrompt}
                  onChange={(e) => setNewVariationPrompt(e.target.value)}
                  className="min-h-[72px]"
                />
                <p className="text-[11px] text-muted-foreground">
                  Có sẵnTiếng TrunghoặcTiếng Anh\u63cf\u8ff0，\u652f\u6301\u6df7\u5408。CóHình ảnh tham khảo\u65f6\u53ef\u7b80\u77ed\u63cf\u8ff0bổ sungChi tiết
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleAddVariation} disabled={!newVariationName.trim()}>
                  <Check className="h-3 w-3 mr-1" />
                  \u6dfb\u52a0thay đổi\u4f53
                </Button>
                <Button size="sm" variant="outline" onClick={resetAddForm}>
                  <X className="h-3 w-3 mr-1" />
                  \u53d6\u6d88
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              \u6dfb\u52a0\u81ea\u5b9a\u4e49thay đổi\u4f53
            </Button>
          )}

          {/* Tips */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>💡 thay đổi\u4f53\u751f\u6210\u4f1aTài liệu tham khảo\u89d2\u8272\u57fa\u7840\u5b9a\u5986\u7167，giữđặc điểm khuôn mặtmột\u81f4</p>
            <p>💡 \u4e0a\u4f20quần áoHình ảnh tham khảo\u53ef\u8ba9 AI \u66f4\u7cbe\u51c6\u5730\u751f\u6210\u76ee\u6807\u9020\u578b</p>
            <p>💡 \u5efa\u8baeđầu tiên\u751f\u6210\u89d2\u8272\u57fa\u7840\u56fe\u7247，Một lần nữa\u6dfb\u52a0thay đổi\u4f53</p>
          </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 border-t shrink-0">
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              \u5173\u95ed
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>

      {/* Fullscreen image preview */}
      <ImagePreviewModal
        imageUrl={zoomedImageUrl || ''}
        isOpen={!!zoomedImageUrl}
        onClose={() => setZoomedImageUrl(null)}
      />
    </Dialog>
  );
}

// ==================== Generation Logic ====================

/**
 * Build character-sheet-format variation image.
 *
 * The output is a FULL CHARACTER SHEET (ba\u89c6\u56fe + \u8868\u60c5cài đặt + \u6bd4\u4f8bcài đặt + \u52a8\u4f5ccài đặt)
 * matching the base character generation format, NOT a single portrait.
 *
 * Prompt structure = base character sheet prompt + clothing description overlay.
 *
 * Reference images:
 *   - Character base image → face/body identity anchor
 *   - Clothing reference images → target outfit (if provided)
 */

// Same SHEET_ELEMENTS as generation-panel.tsx for consistency
const WARDROBE_SHEET_ELEMENTS = [
  { id: 'three-view', prompt: 'front view, side view, back view, turnaround', realisticPrompt: 'multiple photographic angles: front portrait, side profile, full body shot' },
  { id: 'expressions', prompt: 'expression sheet, multiple facial expressions, happy, sad, angry, surprised', realisticPrompt: 'collage of different facial expressions: smiling, frowning, angry, surprised' },
  { id: 'proportions', prompt: 'height chart, body proportions, head-to-body ratio reference', realisticPrompt: 'full body photography, standing straight' },
  { id: 'poses', prompt: 'pose sheet, various action poses, standing, sitting, running', realisticPrompt: 'various action poses, action photography collage' },
] as const;

async function generateVariationImage(params: {
  character: Character;
  variation: CharacterVariation;
  featureConfig: ReturnType<typeof getFeatureConfig> & {};
}): Promise<string> {
  const { character, variation, featureConfig } = params;
  const apiKey = featureConfig.apiKey;
  const model = featureConfig.models?.[0];
  const baseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');

  if (!model || !baseUrl) {
    throw new Error('\u56fe\u7247\u751f\u6210\u670d\u52a1\u672a\u6b63\u786eCấu hình（thiếu\u5c11\u6a21\u578bhoặc Base URL）');
  }

  // ---- Build CHARACTER SHEET prompt (same structure as generation-panel) ----
  const stylePreset = character.styleId ? getStyleById(character.styleId) : null;
  const styleTokens = stylePreset?.prompt || 'anime style, professional quality';
  const isRealistic = stylePreset?.category === 'real';

  const charTraits = character.visualTraits || character.description || '';
  const clothingDesc = variation.visualPrompt || variation.name;
  const hasClothingRefs = variation.clothingReferenceImages && variation.clothingReferenceImages.length > 0;

  // Character description with clothing overlay
  const characterDescription = `${charTraits}, wearing ${clothingDesc}`;

  // Base prompt — realistic vs animation branching (matches generation-panel.tsx)
  const basePrompt = isRealistic
    ? `professional character reference for "${character.name}", ${characterDescription}, real person`
    : `professional character design sheet for "${character.name}", ${characterDescription}`;

  // Sheet elements content — all 4 elements for full character sheet
  const contentParts = WARDROBE_SHEET_ELEMENTS.map(el =>
    isRealistic ? el.realisticPrompt : el.prompt
  );
  const contentPrompt = contentParts.join(', ');

  // White background enforcement (same as generation-panel)
  const whiteBackgroundPrompt = 'pure solid white background, isolated character on white background, absolutely no background scenery';

  // Multi-image fusion instructions (when clothing reference images exist)
  const fusionInstruction = hasClothingRefs
    ? 'The FIRST image is the base character — preserve identity exactly. The FOLLOWING image(s) show the target outfit — dress the character in this outfit for ALL views.'
    : '';

  // Assemble final prompt
  let prompt: string;
  if (isRealistic) {
    prompt = [
      basePrompt,
      contentPrompt,
      'photographic character reference layout, collage format',
      whiteBackgroundPrompt,
      styleTokens,
      'cinematic lighting, highly detailed skin texture, photorealistic',
      fusionInstruction,
      'IMPORTANT: NO TEXT, NO WORDS, NO WATERMARKS.',
    ].filter(Boolean).join(', ');
  } else {
    prompt = [
      basePrompt,
      contentPrompt,
      'character reference sheet layout',
      whiteBackgroundPrompt,
      styleTokens,
      'detailed illustration',
      fusionInstruction,
      'IMPORTANT: NO TEXT, NO WORDS, NO WATERMARKS.',
    ].filter(Boolean).join(', ');
  }

  // ---- Collect reference images ----
  // Order: character base portrait first, then clothing references
  const referenceImages: string[] = [];

  // 1. Character base portrait (most important — face anchor)
  const charBaseImage = character.thumbnailUrl || character.views[0]?.imageUrl;
  if (charBaseImage) {
    const resolved = await resolveImageToBase64(charBaseImage);
    if (resolved) referenceImages.push(resolved);
  }

  // 2. Clothing reference images (user-uploaded)
  if (hasClothingRefs) {
    for (const img of variation.clothingReferenceImages!) {
      const resolved = await resolveImageToBase64(img);
      if (resolved) referenceImages.push(resolved);
    }
  }

  console.log('[Wardrobe] Generating character sheet variation:', {
    variationName: variation.name,
    model,
    isRealistic,
    hasClothingRefs,
    refCount: referenceImages.length,
    promptPreview: prompt.substring(0, 150),
  });

  // ---- Call API via unified image generator ----
  // Use 1:1 aspect ratio to match base character sheet format
  const result = await submitGridImageRequest({
    model,
    prompt,
    apiKey,
    baseUrl,
    aspectRatio: '1:1',
    resolution: '2K',
    referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
  });

  // Direct result
  if (result.imageUrl) {
    return result.imageUrl;
  }

  // Async task — poll
  if (result.taskId) {
    return await pollForVariationImage(result.taskId, apiKey, baseUrl);
  }

  throw new Error('không có\u6548của API phản ứng');
}

/**
 * Resolve various image URL formats to base64 data URI for API submission.
 */
async function resolveImageToBase64(url: string): Promise<string | null> {
  if (!url) return null;
  // Already base64
  if (url.startsWith('data:image/')) return url;
  // HTTP URL — pass through (API can fetch it)
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // local-image:// protocol
  if (url.startsWith('local-image://')) {
    try {
      return await readImageAsBase64(url) || null;
    } catch {
      console.warn('[Wardrobe] Failed to read local image:', url);
      return null;
    }
  }
  return null;
}

/**
 * Poll async task for variation image completion.
 */
async function pollForVariationImage(
  taskId: string,
  apiKey: string,
  baseUrl: string,
): Promise<string> {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const hasV1 = /\/v\d+$/.test(normalizedBase);
  const taskEndpoint = hasV1
    ? `${normalizedBase}/tasks/${taskId}`
    : `${normalizedBase}/v1/tasks/${taskId}`;

  const maxAttempts = 60;
  const pollInterval = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      const url = new URL(taskEndpoint);
      url.searchParams.set('_ts', Date.now().toString());

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('Nhiệm vụ\u4e0d\u5b58\u5728');
        continue;
      }

      const data = await response.json();
      const status = (data.status ?? data.data?.status ?? 'unknown').toString().toLowerCase();

      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        const images = data.result?.images ?? data.data?.result?.images;
        let imageUrl: string | undefined;
        if (images?.[0]) {
          const raw = images[0].url || images[0];
          imageUrl = Array.isArray(raw) ? raw[0] : raw;
        }
        imageUrl = imageUrl || data.output_url || data.result_url || data.url;
        if (imageUrl) return imageUrl;
        throw new Error('Nhiệm vụHoàn thành\u4f46không có\u56fe\u7247 URL');
      }

      if (status === 'failed' || status === 'error') {
        throw new Error(data.error || '\u56fe\u7247\u751f\u6210\u5931\u8d25');
      }
    } catch (error) {
      if (error instanceof Error &&
          (error.message.includes('\u5931\u8d25') || error.message.includes('\u4e0d\u5b58\u5728') || error.message.includes('không có\u56fe\u7247'))) {
        throw error;
      }
      // Transient error, continue polling
    }
  }

  throw new Error('\u56fe\u7247\u751f\u6210\u8d85\u65f6');
}
