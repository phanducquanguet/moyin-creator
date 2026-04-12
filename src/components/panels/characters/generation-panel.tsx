// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Generation Panel - Left column
 * Character generation controls: style, views, description, reference images
 */

import { useState, useEffect } from "react";
import { useCharacterLibraryStore, type Character } from "@/stores/character-library-store";
import { useProjectStore } from "@/stores/project-store";
import type { CharacterIdentityAnchors, CharacterNegativePrompt, PromptLanguage } from "@/types/script";
import { useActiveScriptProject } from "@/stores/script-store";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { useMediaStore } from "@/stores/media-store";
import { generateCharacterImage as generateCharacterImageAPI } from "@/lib/ai/image-generator";
import { saveImageToLocal } from "@/lib/image-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { 
  Loader2,
  ImagePlus,
  X,
  Shuffle,
  FileImage,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { StylePicker } from "@/components/ui/style-picker";
import { getStyleById, getStylePrompt, type VisualStyleId, DEFAULT_STYLE_ID } from "@/lib/constants/visual-styles";

// Gender presets
const GENDER_PRESETS = [
  { id: "male", label: "\u7537" },
  { id: "female", label: "\u5973" },
  { id: "other", label: "\u5176\u4ed6" },
] as const;

// Age presets
const AGE_PRESETS = [
  { id: "child", label: "\u513f\u7ae5", range: "5-12tuổi" },
  { id: "teen", label: "\u9752vị thành niên", range: "13-18tuổi" },
  { id: "young-adult", label: "tuổi trẻ", range: "19-30tuổi" },
  { id: "adult", label: "tuổi trung niên", range: "31-50 tuổi" },
  { id: "senior", label: "tuổi già", range: "50 tuổi\u4ee5\u4e0a" },
] as const;

// Sheet elements
const SHEET_ELEMENTS = [
  { id: 'three-view', label: 'ba\u89c6\u56fe', prompt: 'front view, side view, back view, turnaround', default: true },
  { id: 'expressions', label: '\u8868\u60c5cài đặt', prompt: 'expression sheet, multiple facial expressions, happy, sad, angry, surprised', default: true },
  { id: 'proportions', label: '\u6bd4\u4f8bcài đặt', prompt: 'height chart, body proportions, head-to-body ratio reference', default: false },
  { id: 'poses', label: '\u52a8\u4f5ccài đặt', prompt: 'pose sheet, various action poses, standing, sitting, running', default: false },
] as const;

type SheetElementId = typeof SHEET_ELEMENTS[number]['id'];

interface GenerationPanelProps {
  selectedCharacter: Character | null;
  onCharacterCreated?: (id: string) => void;
}

export function GenerationPanel({ selectedCharacter, onCharacterCreated }: GenerationPanelProps) {
  const { 
    addCharacter, 
    updateCharacter,
    addCharacterView,
    selectCharacter,
    generationStatus,
    generatingCharacterId,
    setGenerationStatus,
    setGeneratingCharacter,
    currentFolderId,
  } = useCharacterLibraryStore();
  const { activeProjectId } = useProjectStore();
  const scriptProject = useActiveScriptProject();
  
  const { pendingCharacterData, setPendingCharacterData } = useMediaPanelStore();
  const { addMediaFromUrl, getOrCreateCategoryFolder } = useMediaStore();
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [personality, setPersonality] = useState("");
  // Extended character fields (from script panel)
  const [role, setRole] = useState("");
  const [traits, setTraits] = useState("");
  const [skills, setSkills] = useState("");
  const [keyActions, setKeyActions] = useState("");
  const [appearance, setAppearance] = useState("");
  const [relationships, setRelationships] = useState(""); // Mối quan hệ nhân vật
  const [tags, setTags] = useState<string[]>([]);  // \u89d2\u8272nhãn
  const [notes, setNotes] = useState("");           // \u89d2\u8272Bình luận
  // === \u4e13\u4e1a\u89d2\u8272\u8bbe\u8ba1Cánh đồng（\u4e16\u754c\u7ea7\u5927phép chia\u751f\u6210）===
  const [visualPromptEn, setVisualPromptEn] = useState(""); // Tiếng Anh\u89c6\u89c9\u63d0\u793a\u8bcd
  const [visualPromptZh, setVisualPromptZh] = useState(""); // Tiếng Trung\u89c6\u89c9\u63d0\u793a\u8bcd
  // === Neo nhận dạng lớp 6 ===
  const [identityAnchors, setIdentityAnchors] = useState<CharacterIdentityAnchors | undefined>();
  const [charNegativePrompt, setCharNegativePrompt] = useState<CharacterNegativePrompt | undefined>();
  // === \u63d0\u793a\u8bcdngôn ngữ\u504f\u597d ===
  const [promptLanguage, setPromptLanguage] = useState<PromptLanguage>('zh');
  // === thông tin tuổi tác（từ\u5267\u672c\u5143\u6570\u636e\u4f20\u9012）===
  const [storyYear, setStoryYear] = useState<number | undefined>();
  const [era, setEra] = useState<string | undefined>();
  // === đặt\u4f5csử dụng\u57df（từ pending \u6570\u636e\u900f\u4f20）===
  const [sourceEpisodeId, setSourceEpisodeId] = useState<string | undefined>();
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [styleId, setStyleId] = useState<string>(DEFAULT_STYLE_ID);
  const [selectedElements, setSelectedElements] = useState<SheetElementId[]>(
    SHEET_ELEMENTS.filter(e => e.default).map(e => e.id)
  );
  
  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCharacterId, setPreviewCharacterId] = useState<string | null>(null);
  
  // AI \u6821\u51c6thông tin\u6298\u53e0Quận\u72b6\u6001：Có\u6570\u636e\u65f6\u9ed8\u8ba4\u5c55\u5f00
  const [calibrationExpanded, setCalibrationExpanded] = useState(true);
  const [isManuallyModified, setIsManuallyModified] = useState(false);

  const isGenerating = generationStatus === 'generating';
  
  // \u68c0\u67e5ĐúngKHÔNGCó AI \u6821\u51c6\u6570\u636e
  const hasCalibrationData = !!(identityAnchors || charNegativePrompt || visualPromptEn || visualPromptZh);

  // Lưu ý\u610f：\u5de6\u8fb9\u680f\u59cb\u7ec8sử dụng\u4e8emới\u5efa\u89d2\u8272，\u4e0dphản ứngtrong\u95f4\u89d2\u8272\u5e93của\u9009\u62e9
  // \u53f3\u8fb9\u680fsử dụng\u4e8e\u67e5\u770b/\u7f16\u8f91Đã rồiCó\u89d2\u8272của\u8be6\u60c5

  // Handle pending data from script panel
  useEffect(() => {
    if (pendingCharacterData) {
      setName(pendingCharacterData.name || "");
      
      // \u6620\u5c04giới tính："\u7537" -> "male", "\u5973" -> "female"
      const genderMap: Record<string, string> = {
        '\u7537': 'male', '\u7537\u6027': 'male', 'male': 'male', 'Male': 'male',
        '\u5973': 'female', '\u5973\u6027': 'female', 'female': 'female', 'Female': 'female',
      };
      const mappedGender = genderMap[pendingCharacterData.gender || ''] || '';
      setGender(mappedGender);
      
      // \u6620\u5c04tuổi tác：\u6839\u636econ số\u8303\u56f4\u81ea\u52a8\u9009\u62e9nhóm tuổi
      const ageStr = pendingCharacterData.age || '';
      let mappedAge = '';
      if (ageStr.includes('5') && ageStr.includes('12') || ageStr.includes('\u513f\u7ae5')) {
        mappedAge = 'child';
      } else if (ageStr.includes('13') || ageStr.includes('18') || ageStr.includes('\u9752vị thành niên')) {
        mappedAge = 'teen';
      } else if (ageStr.includes('19') || ageStr.includes('20') || ageStr.includes('25') || ageStr.includes('30') || ageStr.includes('tuổi trẻ')) {
        mappedAge = 'young-adult';
      } else if (ageStr.includes('35') || ageStr.includes('40') || ageStr.includes('45') || ageStr.includes('50') || ageStr.includes('tuổi trung niên')) {
        mappedAge = 'adult';
      } else if (ageStr.includes('55') || ageStr.includes('60') || ageStr.includes('70') || ageStr.includes('tuổi già')) {
        mappedAge = 'senior';
      } else if (ageStr.match(/\d+.*\d+/)) {
        // \u8de8nhóm tuổiChẳng hạn như "25-50 tuổi"，\u9009\u62e9tuổi trung niên
        mappedAge = 'adult';
      }
      setAge(mappedAge);
      
      setPersonality(pendingCharacterData.personality || "");
      
      // Store extended fields independently
      setRole(pendingCharacterData.role || "");
      setTraits(pendingCharacterData.traits || "");
      setSkills(pendingCharacterData.skills || "");
      setKeyActions(pendingCharacterData.keyActions || "");
      setAppearance(pendingCharacterData.appearance || "");
      setRelationships(pendingCharacterData.relationships || "");
      
      // Also build description for display/generation prompt
      const descParts: string[] = [];
      if (pendingCharacterData.role) descParts.push(`【danh tính/\u80cc\u666f】\n${pendingCharacterData.role}`);
      if (pendingCharacterData.traits) descParts.push(`【đặc điểm cốt lõi】\n${pendingCharacterData.traits}`);
      if (pendingCharacterData.skills) descParts.push(`【Kỹ năng/khả năng】\n${pendingCharacterData.skills}`);
      if (pendingCharacterData.keyActions) descParts.push(`【việc làm quan trọng】\n${pendingCharacterData.keyActions}`);
      if (pendingCharacterData.appearance) descParts.push(`【đặc điểm vật lý】\n${pendingCharacterData.appearance}`);
      if (pendingCharacterData.relationships) descParts.push(`【Mối quan hệ nhân vật】\n${pendingCharacterData.relationships}`);
      if (descParts.length > 0) {
        setDescription(descParts.join("\n\n"));
      }

      // \u5904\u7406nhãnvàBình luận
      if (pendingCharacterData.tags) {
        setTags(pendingCharacterData.tags);
      }
      if (pendingCharacterData.notes) {
        setNotes(pendingCharacterData.notes);
      }
      
      // === \u5904\u7406\u63d0\u793a\u8bcdngôn ngữ\u504f\u597d ===
      if (pendingCharacterData.promptLanguage) {
        setPromptLanguage(pendingCharacterData.promptLanguage);
      }
      // === \u5904\u7406\u4e13\u4e1a\u89c6\u89c9\u63d0\u793a\u8bcd（\u4e16\u754c\u7ea7\u5927phép chia\u751f\u6210）===
      if (pendingCharacterData.visualPromptEn) {
        setVisualPromptEn(pendingCharacterData.visualPromptEn);
      }
      if (pendingCharacterData.visualPromptZh) {
        setVisualPromptZh(pendingCharacterData.visualPromptZh);
      }
      
      // === \u5904\u7406Neo nhận dạng lớp 6 ===
      if (pendingCharacterData.identityAnchors) {
        setIdentityAnchors(pendingCharacterData.identityAnchors);
      }
      if (pendingCharacterData.negativePrompt) {
        setCharNegativePrompt(pendingCharacterData.negativePrompt);
      }
      
      // === \u5904\u7406thông tin tuổi tác ===
      if (pendingCharacterData.storyYear) {
        setStoryYear(pendingCharacterData.storyYear);
      }
      if (pendingCharacterData.era) {
        setEra(pendingCharacterData.era);
      }
      // === Đặt thông qua phạm vi ===
      setSourceEpisodeId(pendingCharacterData.sourceEpisodeId);

      if (pendingCharacterData.styleId) {
        const validStyle = getStyleById(pendingCharacterData.styleId);
        if (validStyle) {
          setStyleId(validStyle.id);
        }
      }
      
      // TODO: \u5904\u7406\u591a\u9636\u6bb5\u89d2\u8272thay đổi\u4f53
      // nếu có stageInfo hoặc consistencyElements，\u5e94\u8be5：
      // 1. \u5728\u89d2\u8272\u63cf\u8ff0trong\u63d0\u793asử dụng\u6237Đây là\u591a\u9636\u6bb5\u89d2\u8272
      // 2. \u751f\u6210\u89d2\u8272\u540e\u81ea\u52a8cho\u5176\u6dfb\u52a0 variations
      // Lưu ý：\u8fd9một phần\u903b\u8f91\u5e94\u8be5\u5728 handleCreateAndGenerate \u540e\u6267được rồi

      setPendingCharacterData(null);
    }
  }, [pendingCharacterData, setPendingCharacterData]);

  const toggleElement = (elementId: SheetElementId) => {
    setSelectedElements(prev => 
      prev.includes(elementId) 
        ? prev.filter(e => e !== elementId)
        : [...prev, elementId]
    );
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    for (const file of Array.from(files)) {
      if (referenceImages.length + newImages.length >= 3) break;
      try {
        const base64 = await fileToBase64(file);
        newImages.push(base64);
      } catch (err) {
        console.error("Failed to convert image:", err);
      }
    }

    if (newImages.length > 0) {
      setReferenceImages([...referenceImages, ...newImages].slice(0, 3));
    }
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setGender("");
    setAge("");
    setPersonality("");
    setRole("");
    setTraits("");
    setSkills("");
    setKeyActions("");
    setAppearance("");
    setRelationships("");
    setTags([]);
    setNotes("");
    // === \u91cd\u7f6e\u4e13\u4e1a\u89c6\u89c9\u63d0\u793a\u8bcd ===
    setVisualPromptEn("");
    setVisualPromptZh("");
    // === \u91cd\u7f6eNeo nhận dạng lớp 6 ===
    setIdentityAnchors(undefined);
    setCharNegativePrompt(undefined);
    // === \u91cd\u7f6ethông tin tuổi tác ===
    setStoryYear(undefined);
    setEra(undefined);
    // === \u91cd\u7f6eđặt\u4f5csử dụng\u57df ===
    setSourceEpisodeId(undefined);
    setReferenceImages([]);
    setStyleId(DEFAULT_STYLE_ID);
    setSelectedElements(SHEET_ELEMENTS.filter(e => e.default).map(e => e.id));
    setPreviewUrl(null);
    setPreviewCharacterId(null);
    // === \u91cd\u7f6e AI \u6821\u51c6\u72b6\u6001 ===
    setCalibrationExpanded(false);
    setIsManuallyModified(false);
  };

  // \u521b\u5efamới\u89d2\u8272\u5e76\u751f\u6210\u56fe\u7247（\u59cb\u7ec8mới\u5efa，sẽ không\u8986\u76d6Đã rồiCó\u89d2\u8272）
  const handleCreateAndGenerate = async () => {
    if (!name.trim()) {
      toast.error("\u8bf7\u8f93\u5165\u89d2\u8272tên\u79f0");
      return;
    }
    if (!description.trim()) {
      toast.error("\u8bf7\u8f93\u5165\u89d2\u8272\u63cf\u8ff0");
      return;
    }
    if (selectedElements.length === 0) {
      toast.error("\u8bf7\u81f3\u5c11\u9009\u62e9mộtmột\u751f\u6210bên trong\u5bb9");
      return;
    }

    // \u59cb\u7ec8\u521b\u5efamới\u89d2\u8272
    const targetId = addCharacter({
      name: name.trim(),
      description: description.trim(),
      visualTraits: "",
      gender: gender || undefined,
      age: age || undefined,
      personality: personality.trim() || undefined,
      role: role.trim() || undefined,
      traits: traits.trim() || undefined,
      skills: skills.trim() || undefined,
      keyActions: keyActions.trim() || undefined,
      appearance: appearance.trim() || undefined,
      relationships: relationships.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      notes: notes.trim() || undefined,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      styleId: styleId === "random" ? undefined : styleId,
      views: [],
      folderId: currentFolderId,
      projectId: activeProjectId || undefined,
      // === Neo nhận dạng lớp 6（\u89d2\u8272một\u81f4\u6027）===
      identityAnchors: identityAnchors,
      negativePrompt: charNegativePrompt,
      // === đặt\u4f5csử dụng\u57df ===
      linkedEpisodeId: sourceEpisodeId,
    });
    selectCharacter(targetId);
    onCharacterCreated?.(targetId);

    // \u5f00\u59cb\u751f\u6210\u56fe\u7247
    setGenerationStatus('generating');
    setGeneratingCharacter(targetId);

    try {
      // \u6784\u5efa\u63d0\u793a\u8bcd：\u6839\u636engôn ngữ\u504f\u597d\u9009\u62e9\u63d0\u793a\u8bcd + Neo nhận dạng lớp 6 + Hình ảnh tham khảoưu tiên\u903b\u8f91 + thông tin tuổi tác
      // \u83b7\u53d6\u5b9e\u65f6củangôn ngữ\u504f\u597d（Ưu tiênsử dụng pending \u4f20\u6765của，\u5176lầntừ scriptProject \u8bfb\u53d6）
      const effectiveLang = promptLanguage || scriptProject?.promptLanguage || 'zh';
      const prompt = buildCharacterSheetPrompt(
        description, 
        name, 
        selectedElements, 
        styleId, 
        visualPromptEn,
        visualPromptZh,
        effectiveLang,
        identityAnchors,
        referenceImages.length > 0,  // CóHình ảnh tham khảo\u65f6\u7b80\u5316\u63cf\u8ff0
        storyYear,
        era
      );
      const stylePreset = styleId && styleId !== 'random' 
        ? getStyleById(styleId) 
        : null;
      const isRealistic = stylePreset?.category === 'real';
      
      // \u6784\u5efa\u8d1f\u9762\u63d0\u793a\u8bcd：\u5408\u5e76\u89d2\u8272\u7279\u5b9acủa\u8d1f\u9762\u63d0\u793a\u8bcd
      let negativePrompt = isRealistic
        ? 'blurry, low quality, watermark, text, cropped, anime, cartoon, illustration'
        : 'blurry, low quality, watermark, text, cropped';
      
      // nếu có\u89d2\u8272\u7279\u5b9acủa\u8d1f\u9762\u63d0\u793a\u8bcd，\u8ffd\u52a0Đến\u540e\u9762
      if (charNegativePrompt) {
        const avoidList = charNegativePrompt.avoid || [];
        const styleExclusions = charNegativePrompt.styleExclusions || [];
        const charNegatives = [...avoidList, ...styleExclusions].join(', ');
        if (charNegatives) {
          negativePrompt = `${negativePrompt}, ${charNegatives}`;
        }
      }

      const result = await generateCharacterImageAPI({
        prompt,
        negativePrompt,
        aspectRatio: '1:1',
        referenceImages,
        styleId,
      });
      
      setPreviewUrl(result.imageUrl);
      setPreviewCharacterId(targetId);
      setGenerationStatus('completed');
      toast.success("\u56fe\u7247\u751f\u6210Hoàn thành，\u8bf7\u9884\u89c8\u786e\u8ba4");
    } catch (error) {
      const err = error as Error;
      setGenerationStatus('error', err.message);
      toast.error(`\u751f\u6210\u5931\u8d25: ${err.message}`);
    } finally {
      setGeneratingCharacter(null);
    }
  };

  const handleSavePreview = async () => {
    if (!previewUrl || !previewCharacterId) return;

    toast.loading("\u6b63\u5728\u4fdd\u5b58\u56fe\u7247Đến\u672c\u5730...", { id: 'saving-preview' });
    
    try {
      // Save image to local storage
      const localPath = await saveImageToLocal(
        previewUrl, 
        'characters', 
        `${name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.png`
      );

      // Save view with local path
      addCharacterView(previewCharacterId, {
        viewType: 'front',
        imageUrl: localPath,
      });

      const visualTraits = `${name} character, ${description.substring(0, 200)}`;
      updateCharacter(previewCharacterId, { visualTraits });

      // \u540c\u6b65\u5f52\u6863ĐếnChất liệu\u5e93 AI\u56fe\u7247 \u6587\u4ef6\u5939
      const aiFolderId = getOrCreateCategoryFolder('ai-image');
      addMediaFromUrl({
        url: localPath,
        name: `\u89d2\u8272-${name || 'Chưa đặt tên'}`,
        type: 'image',
        source: 'ai-image',
        folderId: aiFolderId,
        projectId: activeProjectId || undefined,
      });

      setPreviewUrl(null);
      setPreviewCharacterId(null);
      toast.success("\u89d2\u8272cài đặt\u56feĐã rồi\u4fdd\u5b58Đến\u672c\u5730！", { id: 'saving-preview' });
    } catch (error) {
      console.error('Failed to save preview:', error);
      toast.error("\u4fdd\u5b58\u5931\u8d25", { id: 'saving-preview' });
    }
  };

  const handleDiscardPreview = () => {
    setPreviewUrl(null);
    setPreviewCharacterId(null);
  };

  // If showing preview
  if (previewUrl) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="p-3 pb-2 border-b shrink-0">
          <h3 className="font-medium text-sm">\u9884\u89c8\u89d2\u8272cài đặt\u56fe</h3>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-4 pb-32">
            <div className="relative rounded-lg overflow-hidden border-2 border-amber-500/50 bg-muted">
              <img 
                src={previewUrl} 
                alt="\u89d2\u8272cài đặt\u9884\u89c8"
                className="w-full h-auto"
              />
              <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded">
                \u9884\u89c8
              </div>
            </div>
          </div>
        </ScrollArea>
        <div className="p-3 border-t space-y-2 shrink-0">
          <Button onClick={handleSavePreview} className="w-full">
            \u4fdd\u5b58cài đặt\u56fe
          </Button>
          <Button onClick={handleCreateAndGenerate} variant="outline" className="w-full" disabled={isGenerating}>
            \u91cdmới\u751f\u6210
          </Button>
          <Button onClick={handleDiscardPreview} variant="ghost" className="w-full text-muted-foreground" size="sm">
            \u653e\u5f03\u5e76\u8fd4\u56de
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-3 pb-2 border-b shrink-0">
        <h3 className="font-medium text-sm">\u751f\u6210\u63a7\u5236\u53f0</h3>
      </div>
      
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-4">
          {/* Character name */}
          <div className="space-y-2">
            <Label className="text-xs">\u89d2\u8272tên\u79f0</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ：\u5c0f\u660e、\u673a\u5668\u732b"
              disabled={isGenerating}
            />
          </div>

          {/* Gender and Age */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">giới tính</Label>
              <Select value={gender} onValueChange={setGender} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder="\u9009\u62e9" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_PRESETS.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">nhóm tuổi</Label>
              <Select value={age} onValueChange={setAge} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder="\u9009\u62e9" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_PRESETS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Personality */}
          <div className="space-y-2">
            <Label className="text-xs">Đặc điểm tính cách</Label>
            <Input
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="\u5f00\u6717、\u52c7\u6562..."
              disabled={isGenerating}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs">\u89d2\u8272\u63cf\u8ff0</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="\u8be6\u7ec6\u63cf\u8ff0\u89d2\u8272Bên ngoài\u89c2..."
              className="min-h-[80px] text-sm resize-none"
              disabled={isGenerating}
            />
          </div>

          {/* AI \u6821\u51c6thông tin\u6298\u53e0Quận */}
          {hasCalibrationData && (
            <div className="border rounded-lg overflow-hidden">
              {/* \u6298\u53e0Quậncái đầu */}
              <button
                type="button"
                className="w-full flex items-center justify-between p-2 hover:bg-muted/50 transition-colors"
                onClick={() => setCalibrationExpanded(!calibrationExpanded)}
                disabled={isGenerating}
              >
                <div className="flex items-center gap-2">
                  {calibrationExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium">AI \u6821\u51c6thông tin</span>
                </div>
                <div className="flex items-center gap-1">
                  {isManuallyModified ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span className="text-[10px] text-amber-500">Đã rồi\u4fee\u6539</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span className="text-[10px] text-green-500">đã hiệu chuẩn</span>
                    </>
                  )}
                </div>
              </button>
              
              {/* \u6298\u53e0Quậnbên trong\u5bb9 */}
              {calibrationExpanded && (
                <div className="border-t p-2 space-y-3 bg-muted/20">
                  {/* Neo nhận dạng lớp 6 */}
                  {identityAnchors && (
                    <div className="space-y-2">
                      <Label className="text-[10px] text-muted-foreground">① \u9aa8\u76f8\u5c42</Label>
                      <div className="grid grid-cols-3 gap-1">
                        <Input
                          value={identityAnchors.faceShape || ''}
                          onChange={(e) => {
                            setIdentityAnchors({ ...identityAnchors, faceShape: e.target.value || undefined });
                            setIsManuallyModified(true);
                          }}
                          placeholder="hình dạng khuôn mặt"
                          className="h-7 text-[10px]"
                          disabled={isGenerating}
                        />
                        <Input
                          value={identityAnchors.jawline || ''}
                          onChange={(e) => {
                            setIdentityAnchors({ ...identityAnchors, jawline: e.target.value || undefined });
                            setIsManuallyModified(true);
                          }}
                          placeholder="\u4e0b\u9882"
                          className="h-7 text-[10px]"
                          disabled={isGenerating}
                        />
                        <Input
                          value={identityAnchors.cheekbones || ''}
                          onChange={(e) => {
                            setIdentityAnchors({ ...identityAnchors, cheekbones: e.target.value || undefined });
                            setIsManuallyModified(true);
                          }}
                          placeholder="\u989a\u9aa8"
                          className="h-7 text-[10px]"
                          disabled={isGenerating}
                        />
                      </div>
                      
                      <Label className="text-[10px] text-muted-foreground">② lớp đặc điểm khuôn mặt</Label>
                      <div className="grid grid-cols-2 gap-1">
                        <Input
                          value={identityAnchors.eyeShape || ''}
                          onChange={(e) => {
                            setIdentityAnchors({ ...identityAnchors, eyeShape: e.target.value || undefined });
                            setIsManuallyModified(true);
                          }}
                          placeholder="hình dạng mắt"
                          className="h-7 text-[10px]"
                          disabled={isGenerating}
                        />
                        <Input
                          value={identityAnchors.noseShape || ''}
                          onChange={(e) => {
                            setIdentityAnchors({ ...identityAnchors, noseShape: e.target.value || undefined });
                            setIsManuallyModified(true);
                          }}
                          placeholder="Hình dáng mũi"
                          className="h-7 text-[10px]"
                          disabled={isGenerating}
                        />
                        <Input
                          value={identityAnchors.lipShape || ''}
                          onChange={(e) => {
                            setIdentityAnchors({ ...identityAnchors, lipShape: e.target.value || undefined });
                            setIsManuallyModified(true);
                          }}
                          placeholder="hình môi"
                          className="h-7 text-[10px]"
                          disabled={isGenerating}
                        />
                        <Input
                          value={identityAnchors.eyeDetails || ''}
                          onChange={(e) => {
                            setIdentityAnchors({ ...identityAnchors, eyeDetails: e.target.value || undefined });
                            setIsManuallyModified(true);
                          }}
                          placeholder="Chi tiết mắt"
                          className="h-7 text-[10px]"
                          disabled={isGenerating}
                        />
                      </div>
                      
                      <Label className="text-[10px] text-muted-foreground">③ \u8fa8\u8bc6\u6807\u8bb0\u5c42（\u6700\u5f3a\u951a\u70b9）</Label>
                      <Input
                        value={identityAnchors.uniqueMarks?.join(', ') || ''}
                        onChange={(e) => {
                          const marks = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setIdentityAnchors({ ...identityAnchors, uniqueMarks: marks.length > 0 ? marks : [] });
                          setIsManuallyModified(true);
                        }}
                        placeholder="\u7279\u5f81\u6807\u8bb0，sử dụngdấu phẩy\u5206\u9694"
                        className="h-7 text-[10px]"
                        disabled={isGenerating}
                      />
                      
                      <Label className="text-[10px] text-muted-foreground">④ \u8272\u5f69\u951a\u70b9\u5c42（Hex\u8272\u503c）</Label>
                      <div className="grid grid-cols-4 gap-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={identityAnchors.colorAnchors?.iris || '#000000'}
                            onChange={(e) => {
                              setIdentityAnchors({
                                ...identityAnchors,
                                colorAnchors: { ...identityAnchors.colorAnchors, iris: e.target.value }
                              });
                              setIsManuallyModified(true);
                            }}
                            className="w-6 h-6 rounded cursor-pointer"
                            disabled={isGenerating}
                          />
                          <span className="text-[9px] text-muted-foreground">\u77b3</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={identityAnchors.colorAnchors?.hair || '#000000'}
                            onChange={(e) => {
                              setIdentityAnchors({
                                ...identityAnchors,
                                colorAnchors: { ...identityAnchors.colorAnchors, hair: e.target.value }
                              });
                              setIsManuallyModified(true);
                            }}
                            className="w-6 h-6 rounded cursor-pointer"
                            disabled={isGenerating}
                          />
                          <span className="text-[9px] text-muted-foreground">\u53d1</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={identityAnchors.colorAnchors?.skin || '#000000'}
                            onChange={(e) => {
                              setIdentityAnchors({
                                ...identityAnchors,
                                colorAnchors: { ...identityAnchors.colorAnchors, skin: e.target.value }
                              });
                              setIsManuallyModified(true);
                            }}
                            className="w-6 h-6 rounded cursor-pointer"
                            disabled={isGenerating}
                          />
                          <span className="text-[9px] text-muted-foreground">\u80a4</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={identityAnchors.colorAnchors?.lips || '#000000'}
                            onChange={(e) => {
                              setIdentityAnchors({
                                ...identityAnchors,
                                colorAnchors: { ...identityAnchors.colorAnchors, lips: e.target.value }
                              });
                              setIsManuallyModified(true);
                            }}
                            className="w-6 h-6 rounded cursor-pointer"
                            disabled={isGenerating}
                          />
                          <span className="text-[9px] text-muted-foreground">\u5507</span>
                        </div>
                      </div>
                      
                      <Label className="text-[10px] text-muted-foreground">⑤ lớp kết cấu da</Label>
                      <Input
                        value={identityAnchors.skinTexture || ''}
                        onChange={(e) => {
                          setIdentityAnchors({ ...identityAnchors, skinTexture: e.target.value || undefined });
                          setIsManuallyModified(true);
                        }}
                        placeholder="kết cấu da\u63cf\u8ff0"
                        className="h-7 text-[10px]"
                        disabled={isGenerating}
                      />
                      
                      <Label className="text-[10px] text-muted-foreground">⑥ lớp neo kiểu tóc</Label>
                      <div className="grid grid-cols-2 gap-1">
                        <Input
                          value={identityAnchors.hairStyle || ''}
                          onChange={(e) => {
                            setIdentityAnchors({ ...identityAnchors, hairStyle: e.target.value || undefined });
                            setIsManuallyModified(true);
                          }}
                          placeholder="kiểu tóc"
                          className="h-7 text-[10px]"
                          disabled={isGenerating}
                        />
                        <Input
                          value={identityAnchors.hairlineDetails || ''}
                          onChange={(e) => {
                            setIdentityAnchors({ ...identityAnchors, hairlineDetails: e.target.value || undefined });
                            setIsManuallyModified(true);
                          }}
                          placeholder="đường chân tócChi tiết"
                          className="h-7 text-[10px]"
                          disabled={isGenerating}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* \u8d1f\u9762\u63d0\u793a\u8bcd */}
                  {charNegativePrompt && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-[10px] text-muted-foreground">\u8d1f\u9762\u63d0\u793a\u8bcd</Label>
                      <Input
                        value={charNegativePrompt.avoid?.join(', ') || ''}
                        onChange={(e) => {
                          const avoidList = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setCharNegativePrompt({ ...charNegativePrompt, avoid: avoidList });
                          setIsManuallyModified(true);
                        }}
                        placeholder="\u907f\u514dphần tử，sử dụngdấu phẩy\u5206\u9694"
                        className="h-7 text-[10px]"
                        disabled={isGenerating}
                      />
                      <Input
                        value={charNegativePrompt.styleExclusions?.join(', ') || ''}
                        onChange={(e) => {
                          const exclusions = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setCharNegativePrompt({ ...charNegativePrompt, styleExclusions: exclusions.length > 0 ? exclusions : undefined });
                          setIsManuallyModified(true);
                        }}
                        placeholder="gió\u683c\u6392\u9664，sử dụngdấu phẩy\u5206\u9694"
                        className="h-7 text-[10px]"
                        disabled={isGenerating}
                      />
                    </div>
                  )}
                  
                  {/* \u4e13\u4e1a\u89c6\u89c9\u63d0\u793a\u8bcd：\u6839\u636engôn ngữ\u504f\u597d\u53eahiển thịmột\u79cd，\u7f16\u8f91\u540e\u76f4\u63a5sử dụng\u4e8e\u751f\u6210 */}
                  {(() => {
                    const effectiveLang = promptLanguage || scriptProject?.promptLanguage || 'zh';
                    const showZh = effectiveLang === 'zh' || effectiveLang === 'zh+en';
                    const activePrompt = showZh ? visualPromptZh : visualPromptEn;
                    const setActivePrompt = showZh ? setVisualPromptZh : setVisualPromptEn;
                    const langLabel = showZh ? 'Tiếng Trung' : 'Tiếng Anh';
                    if (!activePrompt) return null;
                    return (
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-[10px] text-muted-foreground">
                          \u89c6\u89c9\u63d0\u793a\u8bcd（{langLabel}，\u4fee\u6539\u540e\u76f4\u63a5sử dụng\u4e8e\u751f\u6210）
                        </Label>
                        <Textarea
                          value={activePrompt}
                          onChange={(e) => {
                            setActivePrompt(e.target.value);
                            setIsManuallyModified(true);
                          }}
                          placeholder={`${langLabel}\u63d0\u793a\u8bcd`}
                          className="min-h-[120px] text-xs resize-y"
                          disabled={isGenerating}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Style */}
          <div className="space-y-2">
            <Label className="text-xs">\u89c6\u89c9gió\u683c</Label>
            <StylePicker
              value={styleId}
              onChange={(id) => setStyleId(id)}
              disabled={isGenerating}
            />
          </div>

          {/* Reference images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Hình ảnh tham khảo\u7247</Label>
              <span className="text-xs text-muted-foreground">{referenceImages.length}/3</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {referenceImages.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img}
                    alt={`Hình ảnh tham khảo ${i + 1}`}
                    className="w-14 h-14 object-cover rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {referenceImages.length < 3 && (
                <>
                  <input
                    id="gen-panel-ref-image"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <div
                    className="w-14 h-14 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors gap-1 cursor-pointer"
                    onClick={() => document.getElementById('gen-panel-ref-image')?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-[10px]">\u4e0a\u4f20</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sheet elements */}
          <div className="space-y-2">
            <Label className="text-xs">\u751f\u6210bên trong\u5bb9</Label>
            <div className="space-y-1.5">
              {SHEET_ELEMENTS.map((element) => (
                <div
                  key={element.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded border text-sm cursor-pointer transition-all",
                    "hover:border-foreground/20",
                    selectedElements.includes(element.id) && "border-primary bg-primary/5",
                    isGenerating && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => !isGenerating && toggleElement(element.id)}
                >
                  <Checkbox
                    checked={selectedElements.includes(element.id)}
                    disabled={isGenerating}
                  />
                  <span>{element.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action button - inside scroll area */}
          <div className="pt-2 pb-4 space-y-2">
            <Button 
              onClick={handleCreateAndGenerate} 
              className="w-full"
              disabled={isGenerating || !name.trim() || !description.trim() || selectedElements.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  \u751f\u6210trong...
                </>
              ) : (
                <>
                  <FileImage className="h-4 w-4 mr-2" />
                  \u751f\u6210cài đặt\u56fe
                </>
              )}
            </Button>
            
            {/* sao chép\u89d2\u8272\u6570\u636e\u6309\u94ae */}
            <Button 
              variant="outline"
              onClick={() => {
                // \u6784\u5efa\u89d2\u8272\u6570\u636e\u6587\u672c
                const lines: string[] = [];
                
                // Thông tin cơ bản
                lines.push(`\u89d2\u8272tên\u79f0: ${name || '(\u672a\u586b\u5199)'}`);
                const genderLabel = GENDER_PRESETS.find(g => g.id === gender)?.label;
                if (genderLabel) lines.push(`giới tính: ${genderLabel}`);
                const ageLabel = AGE_PRESETS.find(a => a.id === age)?.label;
                if (ageLabel) lines.push(`nhóm tuổi: ${ageLabel}`);
                if (personality) lines.push(`Đặc điểm tính cách: ${personality}`);
                
                // \u89d2\u8272\u63cf\u8ff0
                if (description) {
                  lines.push('');
                  lines.push(`\u89d2\u8272\u63cf\u8ff0:`);
                  lines.push(description);
                }
                
                // AI \u6821\u51c6thông tin
                if (hasCalibrationData) {
                  lines.push('');
                  lines.push(`AI \u6821\u51c6thông tin: ${isManuallyModified ? 'Đã rồi\u4fee\u6539' : 'đã hiệu chuẩn'}`);
                  
                  // Neo nhận dạng lớp 6
                  if (identityAnchors) {
                    lines.push('');
                    lines.push('--- Neo nhận dạng lớp 6 ---');
                    
                    // ① \u9aa8\u76f8\u5c42
                    const boneFeatures = [identityAnchors.faceShape, identityAnchors.jawline, identityAnchors.cheekbones].filter(Boolean);
                    if (boneFeatures.length > 0) {
                      lines.push(`① \u9aa8\u76f8\u5c42: ${boneFeatures.join(', ')}`);
                    }
                    
                    // ② lớp đặc điểm khuôn mặt
                    const facialFeatures = [identityAnchors.eyeShape, identityAnchors.eyeDetails, identityAnchors.noseShape, identityAnchors.lipShape].filter(Boolean);
                    if (facialFeatures.length > 0) {
                      lines.push(`② lớp đặc điểm khuôn mặt: ${facialFeatures.join(', ')}`);
                    }
                    
                    // ③ \u8fa8\u8bc6\u6807\u8bb0\u5c42
                    if (identityAnchors.uniqueMarks && identityAnchors.uniqueMarks.length > 0) {
                      lines.push(`③ \u8fa8\u8bc6\u6807\u8bb0\u5c42: ${identityAnchors.uniqueMarks.join(', ')}`);
                    }
                    
                    // ④ \u8272\u5f69\u951a\u70b9\u5c42
                    if (identityAnchors.colorAnchors) {
                      const colors: string[] = [];
                      if (identityAnchors.colorAnchors.iris) colors.push(`\u77b3\u8272:${identityAnchors.colorAnchors.iris}`);
                      if (identityAnchors.colorAnchors.hair) colors.push(`màu tóc:${identityAnchors.colorAnchors.hair}`);
                      if (identityAnchors.colorAnchors.skin) colors.push(`màu da:${identityAnchors.colorAnchors.skin}`);
                      if (identityAnchors.colorAnchors.lips) colors.push(`màu môi:${identityAnchors.colorAnchors.lips}`);
                      if (colors.length > 0) {
                        lines.push(`④ \u8272\u5f69\u951a\u70b9\u5c42: ${colors.join(', ')}`);
                      }
                    }
                    
                    // ⑤ lớp kết cấu da
                    if (identityAnchors.skinTexture) {
                      lines.push(`⑤ lớp kết cấu da: ${identityAnchors.skinTexture}`);
                    }
                    
                    // ⑥ lớp neo kiểu tóc
                    const hairFeatures = [identityAnchors.hairStyle, identityAnchors.hairlineDetails].filter(Boolean);
                    if (hairFeatures.length > 0) {
                      lines.push(`⑥ lớp neo kiểu tóc: ${hairFeatures.join(', ')}`);
                    }
                  }
                  
                  // \u8d1f\u9762\u63d0\u793a\u8bcd
                  if (charNegativePrompt) {
                    lines.push('');
                    lines.push('--- \u8d1f\u9762\u63d0\u793a\u8bcd ---');
                    if (charNegativePrompt.avoid && charNegativePrompt.avoid.length > 0) {
                      lines.push(`\u907f\u514d: ${charNegativePrompt.avoid.join(', ')}`);
                    }
                    if (charNegativePrompt.styleExclusions && charNegativePrompt.styleExclusions.length > 0) {
                      lines.push(`gió\u683c\u6392\u9664: ${charNegativePrompt.styleExclusions.join(', ')}`);
                    }
                  }
                  
                  // \u4e13\u4e1a\u89c6\u89c9\u63d0\u793a\u8bcd
                  if (visualPromptEn || visualPromptZh) {
                    lines.push('');
                    lines.push('--- \u4e13\u4e1a\u89c6\u89c9\u63d0\u793a\u8bcd ---');
                    if (visualPromptEn) lines.push(`EN: ${visualPromptEn}`);
                    if (visualPromptZh) lines.push(`ZH: ${visualPromptZh}`);
                  }
                }
                
                // thông tin tuổi tác
                if (storyYear || era) {
                  lines.push('');
                  lines.push('--- thông tin tuổi tác ---');
                  if (storyYear) lines.push(`năm câu chuyện: ${storyYear}năm`);
                  if (era) lines.push(`thời đại\u80cc\u666f: ${era}`);
                }
                
                // \u89c6\u89c9gió\u683c
                const stylePreset = getStyleById(styleId);
                const styleLabel = stylePreset?.name || styleId;
                lines.push('');
                lines.push(`\u89c6\u89c9gió\u683c: ${styleLabel}`);
                if (stylePreset?.prompt) {
                  lines.push(`gió\u683c\u63d0\u793a\u8bcd: ${stylePreset.prompt.substring(0, 100)}...`);
                }
                
                // Hình ảnh tham khảo\u7247
                if (referenceImages.length > 0) {
                  lines.push(`Hình ảnh tham khảo\u7247: ${referenceImages.length} \u5f20`);
                }
                
                // \u751f\u6210bên trong\u5bb9
                const selectedSheetElements = selectedElements.map(id => SHEET_ELEMENTS.find(e => e.id === id)).filter(Boolean);
                if (selectedSheetElements.length > 0) {
                  const labels = selectedSheetElements.map(e => e?.label).join(', ');
                  const prompts = selectedSheetElements.map(e => e?.prompt).join(', ');
                  lines.push(`\u751f\u6210bên trong\u5bb9: ${labels}`);
                  lines.push(`bên trong\u5bb9\u63d0\u793a\u8bcd: ${prompts}`);
                }
                
                const text = lines.join('\n');
                navigator.clipboard.writeText(text);
                toast.success('\u89d2\u8272\u6570\u636eĐã sao chépĐến\u526a\u8d34\u677f');
              }}
              className="w-full"
              disabled={isGenerating}
            >
              <Copy className="h-4 w-4 mr-2" />
              sao chép\u89d2\u8272\u6570\u636e
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * từNeo nhận dạng lớp 6\u6784\u5efa\u63d0\u793a\u8bcd
 * 
 * @param anchors - Neo nhận dạng lớp 6
 * @param hasReferenceImages - ĐúngKHÔNGCóHình ảnh tham khảo
 * @returns \u6784\u5efacủa\u63d0\u793a\u8bcdchuỗi
 * 
 * Hình ảnh tham khảoưu tiên\u903b\u8f91：
 * - CóHình ảnh tham khảo\u65f6：\u53easử dụng\u6700\u5f3a\u951a\u70b9（uniqueMarks + colorAnchors），\u5176\u4ed6\u7279\u5f81\u7531Hình ảnh tham khảo\u5f15\u5bfc
 * - không cóHình ảnh tham khảo\u65f6：sử dụng\u5b8c\u6574của6\u5c42\u7279\u5f81\u9501\u5b9a
 */
function buildPromptFromAnchors(
  anchors: CharacterIdentityAnchors | undefined,
  hasReferenceImages: boolean,
  promptLanguage?: PromptLanguage
): string {
  if (!anchors) return '';

  // \u6839\u636e\u951a\u70b9\u503cbên trong\u5bb9\u81ea\u52a8Phát hiệnngôn ngữ（Tiếng Trung\u951a\u70b9\u503c → Tiếng Trung\u8fde\u63a5\u8bcd）
  const isZh = promptLanguage === 'zh' || /[\u4e00-\u9fff]/.test(anchors.faceShape || anchors.eyeShape || '');

  const parts: string[] = [];

  if (hasReferenceImages) {
    // === CóHình ảnh tham khảo：\u53easử dụng\u6700\u5f3a\u951a\u70b9 ===
    if (anchors.uniqueMarks && anchors.uniqueMarks.length > 0) {
      parts.push(isZh ? `\u8fa8\u8bc6\u6807\u8bb0：${anchors.uniqueMarks.join('、')}` : `distinctive marks: ${anchors.uniqueMarks.join(', ')}`);
    }

    if (anchors.colorAnchors) {
      const colors: string[] = [];
      if (anchors.colorAnchors.iris) colors.push(isZh ? `\u77b3\u8272${anchors.colorAnchors.iris}` : `iris color ${anchors.colorAnchors.iris}`);
      if (anchors.colorAnchors.hair) colors.push(isZh ? `màu tóc${anchors.colorAnchors.hair}` : `hair color ${anchors.colorAnchors.hair}`);
      if (anchors.colorAnchors.skin) colors.push(isZh ? `màu da${anchors.colorAnchors.skin}` : `skin tone ${anchors.colorAnchors.skin}`);
      if (colors.length > 0) {
        parts.push(colors.join(isZh ? '，' : ', '));
      }
    }
  } else {
    // === không cóHình ảnh tham khảo：\u5b8c\u65746\u5c42\u7279\u5f81\u9501\u5b9a ===

    // ① \u9aa8\u76f8\u5c42
    const boneFeatures: string[] = [];
    if (anchors.faceShape) boneFeatures.push(isZh ? `${anchors.faceShape}\u8138` : `${anchors.faceShape} face`);
    if (anchors.jawline) boneFeatures.push(isZh ? `${anchors.jawline}\u4e0b\u988c` : `${anchors.jawline} jawline`);
    if (anchors.cheekbones) boneFeatures.push(isZh ? `${anchors.cheekbones}xương gò má` : `${anchors.cheekbones} cheekbones`);
    if (boneFeatures.length > 0) {
      parts.push(boneFeatures.join(isZh ? '，' : ', '));
    }

    // ② lớp đặc điểm khuôn mặt
    const facialFeatures: string[] = [];
    if (anchors.eyeShape) facialFeatures.push(isZh ? `${anchors.eyeShape}\u773c` : `${anchors.eyeShape} eyes`);
    if (anchors.eyeDetails) facialFeatures.push(anchors.eyeDetails);
    if (anchors.noseShape) facialFeatures.push(anchors.noseShape);
    if (anchors.lipShape) facialFeatures.push(anchors.lipShape);
    if (facialFeatures.length > 0) {
      parts.push(facialFeatures.join(isZh ? '，' : ', '));
    }

    // ③ \u8fa8\u8bc6\u6807\u8bb0\u5c42
    if (anchors.uniqueMarks && anchors.uniqueMarks.length > 0) {
      parts.push(isZh ? `\u8fa8\u8bc6\u6807\u8bb0：${anchors.uniqueMarks.join('、')}` : `distinctive marks: ${anchors.uniqueMarks.join(', ')}`);
    }

    // ④ \u8272\u5f69\u951a\u70b9\u5c42
    if (anchors.colorAnchors) {
      const colors: string[] = [];
      if (anchors.colorAnchors.iris) colors.push(isZh ? `\u77b3\u8272${anchors.colorAnchors.iris}` : `iris ${anchors.colorAnchors.iris}`);
      if (anchors.colorAnchors.hair) colors.push(isZh ? `màu tóc${anchors.colorAnchors.hair}` : `hair ${anchors.colorAnchors.hair}`);
      if (anchors.colorAnchors.skin) colors.push(isZh ? `màu da${anchors.colorAnchors.skin}` : `skin ${anchors.colorAnchors.skin}`);
      if (anchors.colorAnchors.lips) colors.push(isZh ? `màu môi${anchors.colorAnchors.lips}` : `lips ${anchors.colorAnchors.lips}`);
      if (colors.length > 0) {
        parts.push(isZh ? `\u8272\u5f69\u951a\u70b9：${colors.join('，')}` : `color anchors: ${colors.join(', ')}`);
      }
    }

    // ⑤ lớp kết cấu da
    if (anchors.skinTexture) {
      parts.push(isZh ? `kết cấu da：${anchors.skinTexture}` : `skin texture: ${anchors.skinTexture}`);
    }

    // ⑥ lớp neo kiểu tóc
    const hairFeatures: string[] = [];
    if (anchors.hairStyle) hairFeatures.push(anchors.hairStyle);
    if (anchors.hairlineDetails) hairFeatures.push(anchors.hairlineDetails);
    if (hairFeatures.length > 0) {
      parts.push(isZh ? `kiểu tóc：${hairFeatures.join('，')}` : `hair: ${hairFeatures.join(', ')}`);
    }
  }

  return parts.join(isZh ? '，' : ', ');
}

/**
 * \u6784\u5efa\u89d2\u8272cài đặt\u56fe\u63d0\u793a\u8bcd
 * 
 * ưu tiên：
 * 1. \u6839\u636e promptLanguage \u9009\u62e9Chúa ơi\u63d0\u793a\u8bcd：zh→visualPromptZh, en→visualPromptEn, zh+en→\u4e24\u8005\u5408\u5e76
 * 2. CóHình ảnh tham khảo + Có\u951a\u70b9：\u7b80\u5316\u63cf\u8ff0 + \u6700\u5f3a\u951a\u70b9
 * 3. không cóHình ảnh tham khảo + Có\u951a\u70b9：\u5b8c\u65746\u5c42\u9501\u5b9a
 * 4. Có\u89c6\u89c9\u63d0\u793a\u8bcd：sử dụngAI\u5927phép chia\u751f\u6210của\u63d0\u793a\u8bcd
 * 5. \u53eaCódescription：sử dụng\u57fa\u7840\u63cf\u8ff0
 * 6. thông tin tuổi tác：\u52a0\u5165quần áogió\u683c\u951a\u70b9
 */
function buildCharacterSheetPrompt(
  description: string, 
  name: string, 
  selectedElements: SheetElementId[],
  styleId?: string,
  visualPromptEn?: string,
  visualPromptZh?: string,
  promptLanguage?: PromptLanguage,
  identityAnchors?: CharacterIdentityAnchors,
  hasReferenceImages?: boolean,
  storyYear?: number,
  era?: string
): string {
  const stylePreset = styleId && styleId !== 'random' 
    ? getStyleById(styleId) 
    : null;
  // sửa chữa：\u81ea\u5b9a\u4e49gió\u683c prompt cho\u7a7a\u65f6sử dụnggió\u683ctên\u79f0Hãy ghi nhớ mọi thứ，thay vì\u56de\u9000Đến anime
  const styleTokens = stylePreset
    ? (stylePreset.prompt || `${stylePreset.name} style, professional quality`)
    : 'anime style, professional quality';
  const isRealistic = stylePreset?.category === 'real';
  
  // \u6839\u636engôn ngữ\u504f\u597d\u9009\u62e9Chúa ơi\u89c6\u89c9\u63d0\u793a\u8bcd
  const lang = promptLanguage || 'zh';

  // \u6784\u5efathời đạiquần áo\u63d0\u793a\u8bcd（\u6839\u636engôn ngữ\u504f\u597d）
  let eraPrompt = '';
  if (storyYear) {
    if (lang === 'zh') {
      if (storyYear >= 2020) eraPrompt = `${storyYear}thời đạiđương đạitrong\u56fd\u65f6\u5c1a，hiện đại\u4f11\u95f2gió`;
      else if (storyYear >= 2010) eraPrompt = `${storyYear}thời đạitrong\u56fd\u65f6\u5c1a，\u97e9gió\u5f71\u54cd`;
      else if (storyYear >= 2000) eraPrompt = `2000thời đạiGiai đoạn đầutrong\u56fd\u65f6\u5c1a，ngàn\u79a7năm\u670d\u9970`;
      else if (storyYear >= 1990) eraPrompt = `1990thời đạitrong\u56fd\u65f6\u5c1a，\u8f6c\u578b\u671f\u670d\u9970`;
      else if (storyYear >= 1980) eraPrompt = `1980thời đạitrong\u56fd\u65f6\u5c1a，cải cách\u5f00\u653ethời kỳ\u670d\u9970`;
      else eraPrompt = `${storyYear}thời đạitrong\u56fd\u670d\u9970gió\u683c`;
    } else {
      if (storyYear >= 2020) eraPrompt = `${storyYear}s contemporary Chinese fashion, modern casual style`;
      else if (storyYear >= 2010) eraPrompt = `${storyYear}s Chinese fashion, Korean-influenced style`;
      else if (storyYear >= 2000) eraPrompt = `early 2000s Chinese fashion, millennium era clothing style`;
      else if (storyYear >= 1990) eraPrompt = `1990s Chinese fashion, transitional era clothing`;
      else if (storyYear >= 1980) eraPrompt = `1980s Chinese fashion, reform era clothing style`;
      else eraPrompt = `${storyYear}s era-appropriate Chinese clothing`;
    }
  } else if (era) {
    eraPrompt = lang === 'zh' ? `${era}thời kỳ\u670d\u9970gió\u683c` : `${era} era clothing style`;
  }
  let primaryVisualPrompt: string | undefined;
  if (lang === 'zh' || lang === 'zh+en') {
    // Tiếng TrungƯu tiên（zh+en \u53eaĐúng\u8ba9sử dụng\u6237\u540c\u65f6\u770bĐếnHai loại，\u751f\u6210\u65f6sử dụngTiếng Trung）
    primaryVisualPrompt = visualPromptZh || visualPromptEn;
  } else {
    // en：Tiếng AnhƯu tiên
    primaryVisualPrompt = visualPromptEn || visualPromptZh;
  }
  
  // \u6784\u5efa\u89d2\u8272\u63cf\u8ff0：\u6839\u636eCókhông cóHình ảnh tham khảo\u51b3\u5b9asử dụng\u5b8c\u6574\u951a\u70b9\u8fd8Đúng\u7b80\u5316\u951a\u70b9
  let characterDescription = '';
  
  // \u6784\u5efaneo nhận dạng\u63d0\u793a\u8bcd
  const anchorPrompt = buildPromptFromAnchors(identityAnchors, hasReferenceImages || false, promptLanguage);
  
  if (hasReferenceImages) {
    // CóHình ảnh tham khảo：\u7b80\u5316\u63cf\u8ff0，\u8ba9Hình ảnh tham khảo\u5f15\u5bfcchính\u7279\u5f81
    const basicDesc = primaryVisualPrompt ? primaryVisualPrompt.split(/[,，]/).slice(0, 3).join(',') : description.substring(0, 100);
    characterDescription = anchorPrompt 
      ? `${basicDesc}, ${anchorPrompt}` 
      : basicDesc;
  } else if (anchorPrompt) {
    // không cóHình ảnh tham khảo + Có\u951a\u70b9：\u5b8c\u65746\u5c42\u9501\u5b9a
    const baseDesc = primaryVisualPrompt || description;
    characterDescription = `${baseDesc}, ${anchorPrompt}`;
  } else if (primaryVisualPrompt) {
    // sử dụngAI\u5927phép chia\u63d0\u793a\u8bcd（Đã rồi\u6839\u636engôn ngữ\u504f\u597d\u9009\u62e9）
    characterDescription = primaryVisualPrompt;
  } else {
    // \u53eaCó\u57fa\u7840\u63cf\u8ff0
    characterDescription = description;
  }
  
  // \u52a0\u5165thời đạiquần áo\u63d0\u793a\u8bcd
  if (eraPrompt) {
    characterDescription = `${characterDescription}, ${eraPrompt}`;
  }

  const isZh = lang === 'zh';

  const basePrompt = isRealistic
    ? (isZh
        ? `\u4e13\u4e1a\u89d2\u8272Hình ảnh tham khảo，"${name}"，${characterDescription}，người thậtThực tế`
        : `professional character reference for "${name}", ${characterDescription}, real person`)
    : (isZh
        ? `\u4e13\u4e1a\u89d2\u8272\u8bbe\u8ba1Hình ảnh tham khảo，"${name}"，${characterDescription}`
        : `professional character design sheet for "${name}", ${characterDescription}`);
  
  // sử dụng SHEET_ELEMENTS \u5b9a\u4e49của prompt，Chẳng hạn như\u679cĐúngngười thậtgió\u683c\u5219\u8f6c\u6362\u6210Thực tế/\u6444\u5f71\u8868\u8ff0
  const contentParts = selectedElements
    .map(id => {
      const element = SHEET_ELEMENTS.find(e => e.id === id);
      if (!element) return null;
      if (isRealistic) {
        switch (id) {
          case 'three-view': return 'multiple photographic angles: front portrait, side profile, full body shot';
          case 'expressions': return 'collage of different facial expressions: smiling, frowning, angry, surprised';
          case 'proportions': return 'full body photography, standing straight';
          case 'poses': return 'various action poses, action photography collage';
          default: return element.prompt;
        }
      }
      return element.prompt;
    })
    .filter(Boolean);
  
  const contentPrompt = contentParts.join(', ');
  
  // \u7edfmột\u5f3a\u5316\u7eaf\u767d\u80cc\u666f，\u907f\u514d\u80cc\u666f\u989c\u8272\u88abgió\u683c\u8bcd\u5e26\u504f
  const whiteBackgroundPrompt = "pure solid white background, isolated character on white background, absolutely no background scenery";
  
  if (isRealistic) {
    return isZh
      ? `${basePrompt}, ${contentPrompt}, \u6444\u5f71\u89d2\u8272Hình ảnh tham khảo\u7248\u5f0f, \u62fc\u8d34\u683c\u5f0f, ${whiteBackgroundPrompt}, ${styleTokens}, lớp phimđèn, \u9ad8Chi tiếtkết cấu da, \u7167\u7247Thực tế`
      : `${basePrompt}, ${contentPrompt}, photographic character reference layout, collage format, ${whiteBackgroundPrompt}, ${styleTokens}, cinematic lighting, highly detailed skin texture, photorealistic`;
  } else {
    return isZh
      ? `${basePrompt}, ${contentPrompt}, \u89d2\u8272Hình ảnh tham khảo\u7248\u5f0f, ${whiteBackgroundPrompt}, ${styleTokens}, \u7cbe\u7ec6\u63d2\u753b`
      : `${basePrompt}, ${contentPrompt}, character reference sheet layout, ${whiteBackgroundPrompt}, ${styleTokens}, detailed illustration`;
  }
}

// Note: generateCharacterImage and imageUrlToBase64 are now imported from @/lib/ai/image-generator
