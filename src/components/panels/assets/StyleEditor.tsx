// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * StyleEditor - \u81ea\u5b9a\u4e49gió\u683c\u7f16\u8f91\u5668
 * mới\u5efa/\u7f16\u8f91\u81ea\u5b9a\u4e49gió\u683c，\u652f\u6301Hình ảnh tham khảo\u4e0a\u4f20
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useCustomStyleStore, type CustomStyle } from "@/stores/custom-style-store";
import { saveImageToLocal } from "@/lib/image-storage";
import { extractStyleTokens } from "@/lib/ai/style-extractor";
import { LocalImage } from "@/components/ui/local-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ImagePlus, Save, ArrowLeft, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StyleEditorProps {
  styleId: string | null; // null = mới\u5efa, 'new' = mới\u5efa, \u5176\u4ed6 = \u7f16\u8f91
  onClose: () => void;
}

interface FormData {
  name: string;
  prompt: string;
  negativePrompt: string;
  description: string;
  referenceImages: string[];
  tags: string[];
  styleTokens: string;
  sceneTokens: string;
}

const emptyForm: FormData = {
  name: "",
  prompt: "",
  negativePrompt: "",
  description: "",
  referenceImages: [],
  tags: [],
  styleTokens: "",
  sceneTokens: "",
};

export function StyleEditor({ styleId, onClose }: StyleEditorProps) {
  const { styles, addStyle, updateStyle } = useCustomStyleStore();
  const isNew = !styleId || styleId === "new";
  const existing = isNew ? null : styles.find((s) => s.id === styleId);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // \u52a0\u8f7dĐã rồiCó\u6570\u636e
  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        prompt: existing.prompt,
        negativePrompt: existing.negativePrompt,
        description: existing.description,
        referenceImages: [...existing.referenceImages],
        tags: [...existing.tags],
        styleTokens: existing.styleTokens || "",
        sceneTokens: existing.sceneTokens || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [existing]);

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // \u5c06 File \u8f6ccho data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // \u4e0a\u4f20Hình ảnh tham khảo
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newImages: string[] = [];
      for (const file of Array.from(files)) {
        // \u8f6ccho data URL Một lần nữa\u4fdd\u5b58（\u907f\u514d blob: \u534f\u8bae\u4e0d\u88ab Electron \u652f\u6301）
        const dataUrl = await fileToDataUrl(file);
        const filename = `style_ref_${Date.now()}_${file.name}`;
        const localPath = await saveImageToLocal(dataUrl, "styles", filename);
        newImages.push(localPath);
      }
      setForm((prev) => ({
        ...prev,
        referenceImages: [...prev.referenceImages, ...newImages],
      }));
    } catch (err) {
      console.error("Failed to upload images:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // XóaHình ảnh tham khảo
  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      referenceImages: prev.referenceImages.filter((_, i) => i !== index),
    }));
  };

  // AI Trích xuấtgió\u683c\u8bcd
  const handleExtractStyle = async () => {
    if (!form.prompt.trim() && form.referenceImages.length === 0) {
      toast.warning("\u8bf7đầu tiên\u8f93\u5165gió\u683c\u63cf\u8ff0hoặc\u4e0a\u4f20Hình ảnh tham khảo");
      return;
    }
    setExtracting(true);
    try {
      const result = await extractStyleTokens(form.prompt, form.referenceImages);
      setForm((prev) => ({
        ...prev,
        styleTokens: result.styleTokens,
        sceneTokens: result.sceneTokens,
        description: prev.description || result.summaryZh,
      }));
      toast.success("gió\u683cTrích xuấtHoàn thành");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Trích xuất\u5931\u8d25";
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  };

  // \u4fdd\u5b58
  const handleSave = () => {
    if (!form.name.trim()) return;

    const styleData = {
      name: form.name.trim(),
      prompt: form.prompt,
      negativePrompt: form.negativePrompt,
      description: form.description,
      referenceImages: form.referenceImages,
      tags: form.tags,
      styleTokens: form.styleTokens || undefined,
      sceneTokens: form.sceneTokens || undefined,
    };

    if (isNew) {
      addStyle({ ...styleData, folderId: null });
    } else if (existing) {
      updateStyle(existing.id, styleData);
    }
    onClose();
  };

  return (
    <div className="h-full flex flex-col">
      {/* \u9876\u90e8\u680f */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-sm font-semibold flex-1">
          {isNew ? "mới\u5efagió\u683c" : "\u7f16\u8f91gió\u683c"}
        </h2>
        <Button size="sm" onClick={handleSave} disabled={!form.name.trim()}>
          <Save className="w-3.5 h-3.5 mr-1.5" />
          \u4fdd\u5b58
        </Button>
      </div>

      {/* \u8868\u5355Quận\u57df */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* gió\u683ctên\u79f0 */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              gió\u683ctên\u79f0 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="\u7ed9gió\u683c\u8d77mộttêntừ"
              className="h-8 text-sm"
            />
          </div>

          {/* gió\u683c\u63d0\u793a\u8bcd */}
          <div className="space-y-1.5">
            <Label className="text-xs">gió\u683c\u63d0\u793a\u8bcd</Label>
            <textarea
              value={form.prompt}
              onChange={(e) => updateField("prompt", e.target.value)}
              placeholder="\u8f93\u5165gió\u683cchìa khóa\u8bcd，Tiếng Trung và tiếng Anh\u5747\u53ef，Chẳng hạn như：anime style, soft lighting, pastel colors"
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          {/* AI Trích xuất\u6309\u94ae */}
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 text-xs border-primary/30 hover:border-primary/60"
              onClick={handleExtractStyle}
              disabled={extracting || (!form.prompt.trim() && form.referenceImages.length === 0)}
            >
              {extracting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Trích xuấttrong…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" />AI Trích xuấtgió\u683c\u8bcd</>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1">
              từ\u4e0a\u65b9\u63cf\u8ff0 + Hình ảnh tham khảotrong\u667a\u80fd\u5206\u79bb"\u89c6\u89c9gió\u683c"và"\u573a\u666fbên trong\u5bb9"，sử dụng「\u56fe\u7247\u7406\u89e3」\u670d\u52a1
            </p>
          </div>

          {/* Trích xuấtkết quả：styleTokens */}
          {form.styleTokens && (
            <div className="space-y-1.5">
              <Label className="text-xs text-primary">✨ \u89c6\u89c9gió\u683c\u8bcd（\u89d2\u8272/\u573a\u666fcài đặt\u56fesử dụng）</Label>
              <textarea
                value={form.styleTokens}
                onChange={(e) => updateField("styleTokens", e.target.value)}
                className="w-full min-h-[60px] rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-y"
              />
            </div>
          )}

          {/* Trích xuấtkết quả：sceneTokens */}
          {form.sceneTokens && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">🎬 \u573a\u666f/thành phần\u8bcd（Bàn giám đốc/\u5206\u955csử dụng）</Label>
              <textarea
                value={form.sceneTokens}
                onChange={(e) => updateField("sceneTokens", e.target.value)}
                className="w-full min-h-[60px] rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              />
            </div>
          )}

          {/* \u8d1f\u9762\u63d0\u793a\u8bcd */}
          <div className="space-y-1.5">
            <Label className="text-xs">\u8d1f\u9762\u63d0\u793a\u8bcd</Label>
            <textarea
              value={form.negativePrompt}
              onChange={(e) => updateField("negativePrompt", e.target.value)}
              placeholder="\u4e0d\u5e0c\u671b\u51fa\u73b0củaphần tử，Chẳng hạn như：blurry, low quality, watermark"
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          {/* \u63cf\u8ff0 */}
          <div className="space-y-1.5">
            <Label className="text-xs">\u63cf\u8ff0</Label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="\u7b80\u5355\u63cf\u8ff0cái nàygió\u683ccủa\u7279\u70b9，\u65b9\u4fbf\u4ee5\u540e\u67e5\u627e"
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          {/* Hình ảnh tham khảo\u4e0a\u4f20 */}
          <div className="space-y-1.5">
            <Label className="text-xs">Hình ảnh tham khảo</Label>
            <div className="space-y-2">
              {/* Đã rồi\u4e0a\u4f20\u56fe\u7247 */}
              {form.referenceImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {form.referenceImages.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-border group">
                      <LocalImage
                        src={img}
                        alt={`Hình ảnh tham khảo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(i)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* \u4e0a\u4f20\u6309\u94ae */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                {uploading ? "\u4e0a\u4f20trong..." : "\u6dfb\u52a0Hình ảnh tham khảo"}
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
