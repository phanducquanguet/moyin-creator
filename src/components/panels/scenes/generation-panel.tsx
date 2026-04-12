// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Scene Generation Panel - Left column
 * Scene creation controls: name, location, time, atmosphere, style, generate
 */

import { useState, useEffect } from "react";
import {
  useSceneStore,
  type Scene,
  TIME_PRESETS,
  ATMOSPHERE_PRESETS,
} from "@/stores/scene-store";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { useScriptStore, useActiveScriptProject } from "@/stores/script-store";
import type { PromptLanguage } from "@/types/script";
import { useProjectStore } from "@/stores/project-store";
import { useMediaStore } from "@/stores/media-store";
import { getFeatureConfig, getFeatureNotConfiguredMessage } from "@/lib/ai/feature-router";
import { generateSceneImage as generateSceneImageAPI, submitGridImageRequest } from "@/lib/ai/image-generator";
import { generateContactSheetPrompt, generateMultiPageContactSheetData, type SceneViewpoint } from "@/lib/script/scene-viewpoint-generator";
import type { PendingViewpointData, ContactSheetPromptSet } from "@/stores/media-panel-store";
import { splitStoryboardImage } from "@/lib/storyboard/image-splitter";
import { saveImageToLocal, readImageAsBase64 } from "@/lib/image-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  MapPin,
  Plus,
  Check,
  RotateCcw,
  Grid3X3,
  Upload,
  Scissors,
  Copy,
  Image as ImageIcon,
  Box,
  LayoutGrid,
  ImagePlus,
  X,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { StylePicker } from "@/components/ui/style-picker";
import { 
  VISUAL_STYLE_PRESETS, 
  STYLE_CATEGORIES,
  getStyleById, 
  getStylePrompt, 
  DEFAULT_STYLE_ID,
  type VisualStyleId 
} from "@/lib/constants/visual-styles";

interface GenerationPanelProps {
  selectedScene: Scene | null;
  onSceneCreated?: (id: string) => void;
}

export function GenerationPanel({ selectedScene, onSceneCreated }: GenerationPanelProps) {
  const {
    addScene,
    updateScene,
    selectScene,
    generationStatus,
    generatingSceneId,
    setGenerationStatus,
    setGeneratingScene,
    generationPrefs,
    setGenerationPrefs,
    currentFolderId,
    setContactSheetTask,
  } = useSceneStore();

  const { pendingSceneData, setPendingSceneData } = useMediaPanelStore();
  const { addMediaFromUrl, getOrCreateCategoryFolder } = useMediaStore();
  
  // Lấy D hiện tạiự áncủaPhân cảnh dữ liệu，sử dụng\u4e8eTrích xuấtCảnh đạo cụ
  const { activeProjectId: scriptProjectId, projects } = useScriptStore();
  const { activeProjectId: resourceProjectId } = useProjectStore();
  const scriptProject = useActiveScriptProject();
  const currentProject = scriptProjectId ? projects[scriptProjectId] : null;
  const allShots = currentProject?.shots || [];

  // Tùy chọn ngôn ngữ nhắc nhở（từKịch bảnCài đặt\u540c\u6b65）
  const [promptLanguage, setPromptLanguage] = useState<PromptLanguage>('zh');

  // Form state
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [time, setTime] = useState("day");
  const [atmosphere, setAtmosphere] = useState("peaceful");
  const [visualPrompt, setVisualPrompt] = useState(""); // Cảnh tầm nhìn Mô tả
  const [tags, setTags] = useState<string[]>([]);       // Cảthẻ nh
  const [notes, setNotes] = useState("");               // CảnhNhận xét
  const [styleId, setStyleId] = useState<string>(DEFAULT_STYLE_ID);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null);

  // Generation mode: single (\u5355\u56fe), contact-sheet (\u8054\u5408\u56fe/Nhiều Góc nhìn), orthographic (bốn\u89c6\u56fe)
  type GenerationMode = 'single' | 'contact-sheet' | 'orthographic';
  const [generationMode, setGenerationMode] = useState<GenerationMode>(generationPrefs.generationMode);

  // Contact sheet state
  const [contactSheetPrompt, setContactSheetPrompt] = useState<string | null>(null);
  const [contactSheetPromptZh, setContactSheetPromptZh] = useState<string | null>(null);
  const [extractedViewpoints, setExtractedViewpoints] = useState<SceneViewpoint[]>([]);
  const [contactSheetImage, setContactSheetImage] = useState<string | null>(null);
  const [splitViewpointImages, setSplitViewpointImages] = useState<Record<string, { imageUrl: string; gridIndex: number }>>({});
  const [isSplitting, setIsSplitting] = useState(false);
  const [isGeneratingContactSheet, setIsGeneratingContactSheet] = useState(false);
  const [contactSheetProgress, setContactSheetProgress] = useState(0);
  // \u8054\u5408\u56feBố cục\u9009\u9879: 2x2(4\u683c), 3x3(9\u683c)
  type ContactSheetLayout = '2x2' | '3x3';
  const [contactSheetLayout, setContactSheetLayout] = useState<ContactSheetLayout>(generationPrefs.contactSheetLayout);

  // Orthographic (bốn\u89c6\u56fe) state
  const [orthographicPrompt, setOrthographicPrompt] = useState<string | null>(null);
  const [orthographicPromptZh, setOrthographicPromptZh] = useState<string | null>(null);
  const [orthographicImage, setOrthographicImage] = useState<string | null>(null);
  const [isGeneratingOrthographic, setIsGeneratingOrthographic] = useState(false);
  const [orthographicProgress, setOrthographicProgress] = useState(0);
  // bốn\u89c6\u56fe\u5bbd\u9ad8\u6bd4\u9009\u62e9
  const [orthographicAspectRatio, setOrthographicAspectRatio] = useState<'16:9' | '9:16'>(generationPrefs.orthographicAspectRatio);
  // bốn\u89c6\u56fe\u5207\u5272kết quả
  const [orthographicViews, setOrthographicViews] = useState<{
    front: string | null;
    back: string | null;
    left: string | null;
    right: string | null;
  }>({ front: null, back: null, left: null, right: null });
  
  // từKịch bản\u4f20\u9012\u8fc7\u6765củaNhiều Góc nhìdữ liệu
  const [pendingViewpoints, setPendingViewpoints] = useState<PendingViewpointData[]>([]);
  const [pendingContactSheetPrompts, setPendingContactSheetPrompts] = useState<ContactSheetPromptSet[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [contactSheetAspectRatio, setContactSheetAspectRatio] = useState<'16:9' | '9:16'>(generationPrefs.contactSheetAspectRatio);
  // lô\u91cfbốn\u89c6\u56feTrạng thái
  const [savedChildSceneIds, setSavedChildSceneIds] = useState<string[]>([]); // \u521aLưucủa\u5b50Cảnh ID

  const isGenerating = generationStatus === 'generating';

  // Keep local UI state in sync with persisted preferences (project switch / rehydrate)
  useEffect(() => {
    setGenerationMode(generationPrefs.generationMode);
    setContactSheetLayout(generationPrefs.contactSheetLayout);
    setContactSheetAspectRatio(generationPrefs.contactSheetAspectRatio);
    setOrthographicAspectRatio(generationPrefs.orthographicAspectRatio);
  }, [
    generationPrefs.generationMode,
    generationPrefs.contactSheetLayout,
    generationPrefs.contactSheetAspectRatio,
    generationPrefs.orthographicAspectRatio,
  ]);

  // Persist key mode/layout/aspect preferences to avoid panel-switch state loss
  useEffect(() => {
    setGenerationPrefs({
      generationMode,
      contactSheetLayout,
      contactSheetAspectRatio,
      orthographicAspectRatio,
    });
  }, [
    generationMode,
    contactSheetLayout,
    contactSheetAspectRatio,
    orthographicAspectRatio,
    setGenerationPrefs,
  ]);

  // Reference image handlers
  const handleRefImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const removeRefImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  // Fill form when scene selected
  useEffect(() => {
    if (selectedScene) {
      setName(selectedScene.name);
      setLocation(selectedScene.location);
      setTime(selectedScene.time || "day");
      setAtmosphere(selectedScene.atmosphere || "peaceful");
      setVisualPrompt(selectedScene.visualPrompt || "");
      setTags(selectedScene.tags || []);
      setNotes(selectedScene.notes || "");
      setStyleId(selectedScene.styleId || DEFAULT_STYLE_ID);
    }
  }, [selectedScene]);

  // Handle pending data from script panel
  // \u5f53từKịch bản\u8df3\u8f6c\u8fc7\u6765\u65f6，Tự động TạoCảnh\u5e76nhậpđồ thị chung Tạomode
  useEffect(() => {
    if (!pendingSceneData) return;
    
    // \u7acb\u5373\u6355\u83b7\u6570\u636e\u5e76\u6e05\u9664，\u9632\u6b62 React \u4e25\u683cchế độ\u4e0b\u91cd\u590d\u6267được rồi
    const data = pendingSceneData;
    setPendingSceneData(null);
    
    // \u540c\u6b65Tùy chọn ngôn ngữ nhắc nhở
    if (data.promptLanguage) {
      setPromptLanguage(data.promptLanguage);
    } else if (scriptProject?.promptLanguage) {
      setPromptLanguage(scriptProject.promptLanguage);
    }
    
    // nếu cóTênvàvị trí，Tự động Tạo\u65b0Cảnh
    if (data.name && data.location) {
      // phân tích cú phápThời gianvàbầu không khí
      let timeId = "day";
      if (data.time) {
        const timePreset = TIME_PRESETS.find(
          t => t.label === data.time || t.id === data.time
        );
        timeId = timePreset?.id || "day";
      }

      let atmosphereId = "peaceful";
      if (data.atmosphere) {
        const atmospherePreset = ATMOSPHERE_PRESETS.find(
          a => a.label === data.atmosphere || a.id === data.atmosphere
        );
        atmosphereId = atmospherePreset?.id || "peaceful";
      }

      let parsedStyleId = DEFAULT_STYLE_ID;
      if (data.styleId) {
        const validStyle = getStyleById(data.styleId);
        if (validStyle) {
          parsedStyleId = validStyle.id;
        }
      }
      
      // \u540c\u6b65\u8868\u5355Trạng thái，\u786e\u4fdd UI \u663e\u793a\u6b63\u786ecủaPhong cách
      setStyleId(parsedStyleId);

      // Tự động TạoCảnh（chứa\u4e13\u4e1a\u8bbe\u8ba1từ\u6bb5）
      const newId = addScene({
        name: data.name.trim(),
        location: data.location.trim(),
        time: timeId,
        atmosphere: atmosphereId,
        visualPrompt: data.visualPrompt?.trim() || undefined,
        tags: data.tags?.length ? data.tags : undefined,
        notes: data.notes?.trim() || undefined,
        styleId: parsedStyleId,
        folderId: currentFolderId,
        projectId: resourceProjectId || undefined,
      // C chuyên nghiệpảlĩnh vực thiết kế
        architectureStyle: data.architectureStyle,
        lightingDesign: data.lightingDesign,
        colorPalette: data.colorPalette,
        eraDetails: data.eraDetails,
        keyProps: data.keyProps,
        spatialLayout: data.spatialLayout,
        // đặt\u4f5csử dụng\u57df
        linkedEpisodeId: data.sourceEpisodeId,
      } as any);

      // \u9009trong\u65b0Tạo'Cảnh
      selectScene(newId);
      onSceneCreated?.(newId);
      
      // nếu cóNhiều Góc nhìdữ liệu，\u76f4\u63a5nhậpđồ thị chung Tạomode
      if (data.viewpoints && data.viewpoints.length > 0 &&
          data.contactSheetPrompts && data.contactSheetPrompts.length > 0) {
        setPendingViewpoints(data.viewpoints);
        setPendingContactSheetPrompts(data.contactSheetPrompts);
        setCurrentPageIndex(0);
        
        // Cài đặtKhông.một\u9875củaPrompt
        const firstPage = data.contactSheetPrompts[0];
        setContactSheetPrompt(firstPage.prompt);
        setContactSheetPromptZh(firstPage.promptZh);
        
        // \u540c\u6b65Bố cụcCài đặt，\u786e\u4fdd\u5207\u5272\u65f6sử dụng\u6b63\u786ecủađược rồiCột\u6570
        if (firstPage.gridLayout) {
          const { rows, cols } = firstPage.gridLayout;
          const totalCells = rows * cols;
          
          // \u6839\u636e\u603b\u683c\u6570\u5224\u65ad\u662f 2x2 \u8fd8\u662f 3x3
          if (totalCells <= 4) {
            setContactSheetLayout('2x2');
          } else {
            setContactSheetLayout('3x3');
          }
          
          // \u6839\u636e\u5bbd\u9ad8\u6bd4Cài đặt\u65b9\u5411：\u6b63\u65b9\u5f62\u7f51\u683c（3x3, 2x2）Mặc định\u6a2a\u5c4f
          if (cols >= rows) {
             setContactSheetAspectRatio('16:9');
          } else {
             setContactSheetAspectRatio('9:16');
          }
        }
        
        // \u8f6c\u6362Góc nhìdữ liệuĐịnh dạng
        const firstPageViewpoints = data.viewpoints
          .filter(v => v.pageIndex === 0)
          .map(v => ({
            id: v.id,
            name: v.name,
            nameEn: v.nameEn,
            shotIds: v.shotIds,
            keyProps: v.keyProps,
            keyPropsEn: v.keyPropsEn,
            description: '',
            descriptionEn: '',
            gridIndex: v.gridIndex,
          }));
        setExtractedViewpoints(firstPageViewpoints);
        
        const pageCount = data.contactSheetPrompts.length;
        toast.success(
          `Cảnh「${data.name}」Đã Tạo\n` +
          `✔ ${data.viewpoints.length} Góc nhìnĐã rồi\u52a0\u8f7d${pageCount > 1 ? `（${pageCount}\u5f20\u8054\u5408\u56fe）` : ''}`
        );
      } else {
        toast.success(`Cảnh「${data.name}」Đã Tự động Tạo`);
      }
    } else {
      // Chỉ Cómột phầdữ liệu，\u4ec5\u586b\u5145\u8868\u5355
      setName(data.name || "");
      setLocation(data.location || "");
      
      if (data.time) {
        const timePreset = TIME_PRESETS.find(
          t => t.label === data.time || t.id === data.time
        );
        setTime(timePreset?.id || "day");
      }

      if (data.atmosphere) {
        const atmospherePreset = ATMOSPHERE_PRESETS.find(
          a => a.label === data.atmosphere || a.id === data.atmosphere
        );
        setAtmosphere(atmospherePreset?.id || "peaceful");
      }

      if (data.styleId) {
        const validStyle = getStyleById(data.styleId);
        if (validStyle) {
          setStyleId(validStyle.id);
        }
      }

      if (data.visualPrompt) {
        setVisualPrompt(data.visualPrompt);
      }
      if (data.tags) {
        setTags(data.tags);
      }
      if (data.notes) {
        setNotes(data.notes);
      }
    }
  }, [pendingSceneData, setPendingSceneData, addScene, selectScene, onSceneCreated, currentFolderId]);

  // Khi Người dùng\u66f4\u6539\u5bbd\u9ad8\u6bd4\u65f6，Theo G.óc nhìn\u6570\u91cf\u91cd\u65b0Tính toántối ưuBố cục
  // Lưu ý：\u4e0d\u91cd\u65b0Trích xuấtGóc nhìn，Chỉ Cập nhậtBố cụcvàPrompt
  useEffect(() => {
    // \u53ea\u5728Có pendingViewpoints \u65f6\u5904\u7406
    if (pendingViewpoints.length === 0) return;
    // \u907f\u514d\u9996lần\u52a0\u8f7d\u65f6\u91cd\u590d\u5904\u7406
    if (pendingContactSheetPrompts.length === 0) return;
    
    const vpCount = pendingViewpoints.length;
    const isLandscape = contactSheetAspectRatio === '16:9';
    
    // Theo G.óc nhìn\u6570\u91cfvà\u5bbd\u9ad8\u6bd4Tính toántối ưuBố cục
    // lực lượngsử dụng N x N Bố cục\u4ee5\u4fdd\u8bc1\u5bbd\u9ad8\u6bd4một\u81f4\u6027
    let newLayout: { rows: number; cols: number };
    
    // Nếu Góc nhìn\u6570\u91cf <= 4，Sử dụng 2x2
    // Nếu Góc nhìn\u6570\u91cf > 4，Sử dụng 3x3
    if (vpCount <= 4) {
      newLayout = { rows: 2, cols: 2 };
    } else {
      newLayout = { rows: 3, cols: 3 };
    }
    
    // Cập nhậtBố cục\u9009\u62e9\u5668
    const layoutKey = `${newLayout.rows}x${newLayout.cols}` as ContactSheetLayout;
    // Cập nhật UI Trạng thái
    if (['2x2', '3x3'].includes(layoutKey)) {
      setContactSheetLayout(layoutKey);
    }
    
    // Cập nhật pendingContactSheetPrompts trongcủa gridLayout
    const updatedPrompts = pendingContactSheetPrompts.map(p => ({
      ...p,
      gridLayout: newLayout,
    }));
    setPendingContactSheetPrompts(updatedPrompts);
    
    // \u91cd\u65b0Tạohiện tại\u9875củaPrompt（\u66ffdòng mớiCột\u6570）
    const currentPage = updatedPrompts[currentPageIndex] || updatedPrompts[0];
    if (currentPage && contactSheetPrompt) {
      const totalCells = newLayout.rows * newLayout.cols;
      const paddedCount = totalCells;
      const sceneName = selectedScene?.name || selectedScene?.location || 'scene';
      
      // Nhận Phong cáchthông tin
      const stylePreset = getStyleById(styleId);
      const styleStr = stylePreset?.prompt || 'anime style, soft colors';
      
      // \u83b7\u53d6Góc nhìnMô tả
      const currentPageVps = pendingViewpoints.filter(v => v.pageIndex === currentPageIndex);
      const actualCount = currentPageVps.length;
      
      // Xây dựng phiên bản nâng cao của Lời nhắc (Structured Prompt)
      const promptParts: string[] = [];
      
      // 1. Khối lệnh lõi (Instruction Block)
      promptParts.push('<instruction>');
      promptParts.push(`Generate a clean ${newLayout.rows}x${newLayout.cols} architectural concept grid with exactly ${paddedCount} equal-sized panels.`);
      promptParts.push(`Overall Image Aspect Ratio: ${isLandscape ? '16:9' : '9:16'}.`);
      
      // Chỉ định rõ ràng tỷ lệ khung hình của một lưới riêng lẻ，Ngăn chặn sự nhầm lẫn của AI
      const panelAspect = isLandscape ? '16:9 (horizontal landscape)' : '9:16 (vertical portrait)';
      promptParts.push(`Each individual panel must have a ${panelAspect} aspect ratio.`);
      
      promptParts.push('Structure: No borders between panels, no text, no watermarks.');
      promptParts.push('Consistency: Maintain consistent perspective, lighting, and style across all panels.');
      promptParts.push('Subject: Interior design and architectural details only, NO people.');
      promptParts.push('</instruction>');
      
      // 2. Bố cục Mô tả
      promptParts.push(`Layout: ${newLayout.rows} rows, ${newLayout.cols} columns, reading order left-to-right, top-to-bottom.`);
      
      // 2.5 từT gốciếng AnhNhắctrongTrích xuất Scene Context và Visual Description
      const originalPromptEn = currentPage.prompt || '';
      const sceneContextMatch = originalPromptEn.match(/Scene Context: ([^\n]+)/);
      if (sceneContextMatch && sceneContextMatch[1]) {
        promptParts.push(`Scene Context: ${sceneContextMatch[1]}`);
      }
      const visualDescMatch = originalPromptEn.match(/Visual Description: ([^\n]+)/);
      if (visualDescMatch && visualDescMatch[1]) {
        promptParts.push(`Visual Description: ${visualDescMatch[1]}`);
      }
      
      // 3. Nội dung của mỗi lưới Mô tả
      currentPageVps.forEach((vp, idx) => {
        const row = Math.floor(idx / newLayout.cols) + 1;
        const col = (idx % newLayout.cols) + 1;
        
        const content = vp.keyPropsEn && vp.keyPropsEn.length > 0 
          ? `showing ${vp.keyPropsEn.join(', ')}` 
          : (vp.nameEn === 'Overview' ? 'wide shot showing the entire room layout' : `${vp.nameEn || vp.name} angle of the room`);
          
        promptParts.push(`Panel [row ${row}, col ${col}] (no people): ${content}`);
      });
      
      // 4. phần giữ chỗ trốngMô tả
      for (let i = actualCount; i < paddedCount; i++) {
        const row = Math.floor(i / newLayout.cols) + 1;
        const col = (i % newLayout.cols) + 1;
        promptParts.push(`Panel [row ${row}, col ${col}]: empty placeholder, solid gray background`);
      }
      
      // 5. Phong cáchvới\u8d1f\u9762Gợi ý
      promptParts.push(`Style: ${styleStr}`);
      promptParts.push('Negative constraints: text, watermark, split screen borders, speech bubbles, blur, distortion, bad anatomy, people, characters.');
      
      const newPrompt = promptParts.join('\n');
      
      // \u91cd\u65b0TạoLời nhắc tiếng Trung
      const gridItemsZh = currentPageVps.map((vp, idx) => {
        const content = vp.keyProps && vp.keyProps.length > 0 
          ? `hiển thị${vp.keyProps.join('、')}` 
          : (vp.name === 'Toàn cảnh' ? 'hiển thị\u6574mộtphòngBố cụccủa\u5bbdgócToàn cảnh' : `${vp.name}Góc nhìn`);
        return `[${idx + 1}] ${vp.name}：${content}`;
      }).join('\n');
      
      // từnguyên bảnLời nhắc tiếng TrungtrongTrích xuấtCảnhMô tả（Kiến trúcPhong cách、Màu sắgiai điệu c、Đặc điểm của thời đại、Ánh sáthiết kế）
      // \u8fd9\u6837\u5373\u4f7f selectedScene \u8fd8\u6ca1Cập nhật，\u4e5f\u80fd\u4fdd\u7559\u6b63\u786eCảnhMô tả
      let sceneDescZh = '';
      let visualPromptZh = '';
      const originalPromptZh = currentPage.promptZh || '';
      
      // CảnhMô tảở Không.mộtđược rồivà"Cảbầu không khí nh"hoặc"X Mỗi lưới được hiển thị riêng biệt"\u4e4b\u95f4
      const sceneDescMatch = originalPromptZh.match(/\u4e0d\u540cGóc nhìn。\n([^\n]*(?:Kiến trúcPhong cách|Màu sắgiai điệu c|Đặc điểm của thời đại|Ánh sáthiết kế)[^\n]*)/);
      if (sceneDescMatch && sceneDescMatch[1]) {
        sceneDescZh = sceneDescMatch[1].trim();
      } else {
        // \u56de\u9000Đếntừ selectedScene \u6784\u5efa（sử dụng\u4e8e\u975e\u8df3\u8f6cCảnh）
        const sceneDescParts: string[] = [];
        if (selectedScene?.architectureStyle) {
          sceneDescParts.push(`Kiến trúcPhong cách：${selectedScene.architectureStyle}`);
        }
        if (selectedScene?.colorPalette) {
          sceneDescParts.push(`Màu sắgiai điệu c：${selectedScene.colorPalette}`);
        }
        if (selectedScene?.eraDetails) {
          sceneDescParts.push(`Đặc điểm của thời đại：${selectedScene.eraDetails}`);
        }
        if (selectedScene?.lightingDesign) {
          sceneDescParts.push(`Ánh sáthiết kế：${selectedScene.lightingDesign}`);
        }
        sceneDescZh = sceneDescParts.length > 0 ? sceneDescParts.join('，') : '';
      }
      
      // Trích xuấtLời nhắc trực quan（Cảbầu không khí nh）
      const visualPromptMatch = originalPromptZh.match(/Cảbầu không khí nh：([^\n]+)/);
      if (visualPromptMatch && visualPromptMatch[1]) {
        visualPromptZh = visualPromptMatch[1].trim();
      } else if (selectedScene?.visualPrompt) {
        visualPromptZh = selectedScene.visualPrompt;
      }
      
      const newPromptZh = `chính xác ${newLayout.rows}được rồi${newLayout.cols}biểu đồ lưới cột（tổng cộng ${totalCells} lưới），hiển thị tương tự「${sceneName}」CảDifferent G of nhóc nhìn。
${sceneDescZh}${visualPromptZh ? `\nCảbầu không khí nh：${visualPromptZh}` : ''}

${totalCells} Mỗi lưới được hiển thị riêng biệt：
${gridItemsZh}

quan trọng：
- Phải chính xácạo ${newLayout.rows} được rồi ${newLayout.cols} Cột，Không hơn, không kém。
- Đây là hình ảnh tham khảo rõ ràng，Hình ảKhông Th trên nhêghi đè văn bản mAny。
- Đừng màêthẻ m、Tiêu đề、Giải thívăn bản ch、Hình mờ hoặc bất kỳ Loạvăn bản của tôi。

Phong cách：${stylePreset?.name || 'Hoạt ảnhPhong cách'}，Tất cảLưới chiếu sáng nhất quán，Sử dụng Vi trắng mịn giữa các lướiền tách ra，Chỉ có Nền，không có ký tự。`;
      
      setContactSheetPrompt(newPrompt);
      setContactSheetPromptZh(newPromptZh);
    }
    
    console.log('[ContactSheet] \u5bbd\u9ad8\u6bd4thay đổi，Cập nhậtBố cục:', {
      aspectRatio: contactSheetAspectRatio,
      vpCount,
      newLayout,
      sceneDescExtracted: currentPage ? (currentPage.promptZh?.includes('Kiến trúcPhong cách') || currentPage.promptZh?.includes('Ánh sáthiết kế')) : false,
      selectedSceneId: selectedScene?.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactSheetAspectRatio]); // \u53ea\u76d1\u542c\u5bbd\u9ad8\u6bd4thay đổi

  const handleCreateScene = () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhậpCảnhTên");
      return;
    }
    if (!location.trim()) {
      toast.error("Vui lòng nhậpVị trí Mô tả");
      return;
    }

    // \u83b7\u53d6hiện tạiđặt\u4f5csử dụng\u57df
    const { activeEpisodeIndex } = useMediaPanelStore.getState();
    const scriptState = useScriptStore.getState();
    const activeScriptProject = scriptState.activeProjectId ? scriptState.projects[scriptState.activeProjectId] : null;
    const manualEpisodeId = activeEpisodeIndex != null
      ? activeScriptProject?.scriptData?.episodes.find(ep => ep.index === activeEpisodeIndex)?.id
      : undefined;

    const id = addScene({
      name: name.trim(),
      location: location.trim(),
      time,
      atmosphere,
      visualPrompt: visualPrompt.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      notes: notes.trim() || undefined,
      styleId,
      folderId: currentFolderId,
      projectId: resourceProjectId || undefined,
      linkedEpisodeId: manualEpisodeId,
    });

    toast.success("CảnhĐã Tạo");
    selectScene(id);
    onSceneCreated?.(id);
  };

  const handleGenerate = async () => {
    const targetId = selectedScene?.id;
    if (!targetId) {
      toast.error("\u8bf7đầu tiên\u9009\u62e9hoặcTạoCảnh");
      return;
    }
    if (!location.trim()) {
      toast.error("Vui lòng nhậpVị trí Mô tả");
      return;
    }

    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('character_generation'));
      return;
    }

    // Update scene if changed
    if (location.trim() !== selectedScene.location || 
        time !== selectedScene.time ||
        atmosphere !== selectedScene.atmosphere ||
        visualPrompt.trim() !== (selectedScene.visualPrompt || '') ||
        notes.trim() !== (selectedScene.notes || '')) {
      updateScene(targetId, { 
        location: location.trim(),
        time,
        atmosphere,
        visualPrompt: visualPrompt.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
      });
    }

    setGenerationStatus('generating');
    setGeneratingScene(targetId);

    try {
      // \u83b7\u53d6\u8be5CảnhHạ Tất cảPhân cảH của nhành động mô tả，Trích xuấtđạo cụ chính
      const sceneShots = allShots.filter(shot => 
        shot.sceneRefId === selectedScene?.id ||
        shot.sceneId === selectedScene?.id
      );
      const actionDescriptions = sceneShots
        .map(shot => shot.actionSummary)
        .filter(Boolean)
        .slice(0, 10); // nhất\u53d6 10 Phân cảnh
      
      console.log('[SceneGeneration] tìm thấy', sceneShots.length, 'Phân cảnhcho Cảnh:', selectedScene?.name);
      console.log('[SceneGeneration] Hành độmô tả ng:', actionDescriptions);
      
      const prompt = buildScenePrompt({ ...selectedScene, location, time, atmosphere, styleId }, actionDescriptions);
      const stylePreset = styleId ? getStyleById(styleId) : null;
      const isRealistic = stylePreset?.category === 'real';
      const negativePrompt = isRealistic
        ? 'blurry, low quality, watermark, text, people, characters, anime, cartoon'
        : 'blurry, low quality, watermark, text, people, characters';

      const result = await generateSceneImageAPI({
        prompt,
        negativePrompt,
        aspectRatio: '16:9',
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        styleId,
      });

      setPreviewUrl(result.imageUrl);
      setPreviewSceneId(targetId);
      setGenerationStatus('completed');
      toast.success("Cảnh bản đồ khái niệm TạoHoàn thành，\u8bf7Xem trướcXác nhận");
    } catch (error) {
      const err = error as Error;
      setGenerationStatus('error', err.message);
      toast.error(`TạoThất bại: ${err.message}`);
    } finally {
      setGeneratingScene(null);
    }
  };

  const handleSavePreview = async () => {
    if (!previewUrl || !previewSceneId) return;

    toast.loading("\u6b63\u5728LưuHình ảnhĐến\u672c\u5730...", { id: 'saving-scene-preview' });

    try {
      const sceneName = (name || selectedScene?.name || 'scene').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
      const localPath = await saveImageToLocal(
        previewUrl,
        'scenes',
        `${sceneName}_${Date.now()}.png`
      );

      updateScene(previewSceneId, {
        referenceImage: localPath,
        visualPrompt: buildScenePrompt({ 
          ...selectedScene!, 
          location, 
          time, 
          atmosphere, 
          styleId 
        }),
      });

      // \u540c\u6b65\u5f52\u6863ĐếnChất liệu\u5e93 AIHình ảnh Thư mục
      const aiFolderId = getOrCreateCategoryFolder('ai-image');
      addMediaFromUrl({
        url: localPath,
        name: `Cảnh-${name || selectedScene?.name || 'Chưa đặt tên'}`,
        type: 'image',
        source: 'ai-image',
        folderId: aiFolderId,
        projectId: resourceProjectId || undefined,
      });

      setPreviewUrl(null);
      setPreviewSceneId(null);
      toast.success("Cảbản đồ khái niệm nhĐã LưuĐến\u672c\u5730！", { id: 'saving-scene-preview' });
    } catch (error) {
      console.error('Failed to save scene preview:', error);
      toast.error("LưuThất bại", { id: 'saving-scene-preview' });
    }
  };

  const handleDiscardPreview = () => {
    setPreviewUrl(null);
    setPreviewSceneId(null);
    setGenerationStatus('idle');
  };

  // ========== Nhiều Góc nhìđồ thị chungchức năng ==========

  /**
   * TạoNhiều Góc nhìđồ thị njointPrompt
   */
  const handleGenerateContactSheetPrompt = () => {
    if (!selectedScene) {
      toast.error("\u8bf7đầu tiên\u9009\u62e9Cảnh");
      return;
    }

    // \u83b7\u53d6\u8be5CảPh của nhân cảnh
    const sceneShots = allShots.filter(shot => 
      shot.sceneRefId === selectedScene.id ||
      shot.sceneId === selectedScene.id
    );

    if (sceneShots.length === 0) {
      toast.warning("\u8be5Cảnh\u6ca1Cóliên kết tiến sĩân cảnh，\u5c06sử dụng Mặc địnhGóc nhìn");
    }

    // \u83b7\u53d6hiện tại\u9009trongcủaPhong cách
    const stylePreset = getStyleById(styleId);
    const styleTokens = stylePreset?.prompt ? [stylePreset.prompt] : ['anime style', 'soft colors'];

    // \u6784\u5efaCảnh dữ liệu（\u5408\u5e76hiện tại\u8868\u5355bên trong\u5bb9）
    const sceneData = {
      ...selectedScene,
      name: name || selectedScene.name,
      location: location || selectedScene.location,
    };

    // TạoPrompt
    const result = generateContactSheetPrompt({
      scene: sceneData as any,
      shots: sceneShots,
      styleTokens,
      aspectRatio: '16:9',
    });

    setContactSheetPrompt(result.prompt);
    setContactSheetPromptZh(result.promptZh);
    setExtractedViewpoints(result.viewpoints);

    // \u68c0\u67e5\u662f\u5426sử dụng\u4e86 AI Phân tíG của chóc nhìn
    // viewpoints \u5c5e\u6027\u53ef\u80fd\u6765\u81eaKịch bảncủa scriptData.scenes，Chấp nhận pendingSceneData \u4f20\u9012
    const sceneViewpoints = (selectedScene as any)?.viewpoints || (sceneData as any)?.viewpoints;
    const hasAIViewpoints = sceneViewpoints && sceneViewpoints.length > 0;
    const sourceText = hasAIViewpoints ? 'AI Phân tích' : 'Trích xuất từ khóa';
    toast.success(`${sourceText} ${result.viewpoints.length} Góc nhìn，PromptĐã Tạo`);
  };

  /**
   * \u590d\u5236Prompt（chứaTầm nhìn Phong cáchvà\u5bbd\u9ad8\u6bd4thông tin）
   */
  const handleCopyPrompt = (isEnglish: boolean) => {
    const prompt = isEnglish ? contactSheetPrompt : contactSheetPromptZh;
    if (!prompt) return;
    
    // \u83b7\u53d6Tầm nhìn Phong cáchthông tin
    const stylePreset = getStyleById(styleId);
    const styleName = stylePreset?.name || styleId;
    const styleTokens = stylePreset?.prompt || '';
    
    // \u6839\u636e\u5bbd\u9ad8\u6bd4\u786e\u5b9aBố cụcMô tả
    const isLandscape = contactSheetAspectRatio === '16:9';
      const layoutDesc = `${contactSheetLayout} (${contactSheetLayout === '2x2' ? '4\u683c' : '9\u683c'})`;
    const layoutDescEn = `${contactSheetLayout === '2x2' ? '2 rows x 2 cols' : '3 rows x 3 cols'} (${contactSheetLayout})`;
    
    // \u7ec4\u5408\u5b8c\u6574Prompt
    let fullPrompt: string;
    if (isEnglish) {
      fullPrompt = [
        `=== Contact Sheet Settings ===${`\n`}`,
        `Style: ${styleName}`,
        `Style Tokens: ${styleTokens}`,
        `Aspect Ratio: ${contactSheetAspectRatio}`,
        `Grid Layout: ${layoutDescEn}`,
        ``,
        `=== Prompt ===${`\n`}`,
        prompt,
      ].join('\n');
    } else {
      fullPrompt = [
        `=== \u8054\u5408\u56feCài đặt ===${`\n`}`,
        `Tầm nhìn Phong cách: ${styleName}`,
        `Phong cáchkeywords: ${styleTokens}`,
        `\u5bbd\u9ad8\u6bd4: ${contactSheetAspectRatio}`,
        `bố trí lưới: ${layoutDesc}`,
        ``,
        `=== Prompt ===${`\n`}`,
        prompt,
      ].join('\n');
    }
    
    navigator.clipboard.writeText(fullPrompt);
    toast.success(isEnglish ? "Tiếng AnhNhắcĐã rồi\u590d\u5236（\u542bPhong cáchvà\u5bbd\u9ad8\u6bd4）" : "Lời nhắc tiếng TrungĐã rồi\u590d\u5236（\u542bPhong cáchvà\u5bbd\u9ad8\u6bd4）");
  };

  /**
   * \u76f4\u63a5Tạo\u8054\u5408\u56fe（\u8c03sử dụngbên trong\u90e8 AI Hình ảnhTạo API）
   * sử dụng submitGridImageRequest Căn chỉnhgiám đốc\u9762\u677f，\u786e\u4fdd\u7f51\u683cĐịnh dạng\u6b63\u786e
   */
  const handleGenerateContactSheetImage = async () => {
    if (!contactSheetPrompt) {
      toast.error("\u8bf7đầu tiênTạoPrompt");
      return;
    }

    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('character_generation'));
      return;
    }

    const apiKey = featureConfig.apiKey;
    const baseUrl = featureConfig.baseUrl?.replace(/\/+$/, '') || '';
    const model = featureConfig.models?.[0] || '';
    const keyManager = featureConfig.keyManager;

    if (!apiKey || !baseUrl || !model) {
      toast.error('Hình ảnhTạo API Chưa được định cấu hình');
      return;
    }

    setIsGeneratingContactSheet(true);
    setContactSheetProgress(0);

    try {
      const stylePreset = getStyleById(styleId);
      const isRealistic = stylePreset?.category === 'real';
      const negativePrompt = isRealistic
        ? 'blurry, low quality, watermark, text, labels, titles, captions, words, letters, numbers, annotations, subtitles, typography, font, writing, people, characters, anime, cartoon, distorted grid, uneven panels'
        : 'blurry, low quality, watermark, text, labels, titles, captions, words, letters, numbers, annotations, subtitles, typography, font, writing, people, characters, distorted grid, uneven panels';

      // \u589e\u5f3aPrompt：Chẳng hạn như\u679cNgười dùngChỉnh sửcủa một\u662fLời nhắc tiếng Trung，\u5728\u524d\u9762góiTiếng Anhcó cấu trúc\u7f51\u683c\u6307\u4ee4
      let finalPrompt = contactSheetPrompt;
      const isChinese = /[\u4e00-\u9fa5]/.test(finalPrompt) && !finalPrompt.includes('<instruction>');
      if (isChinese) {
        const layoutDims = (() => {
          switch (contactSheetLayout) {
            case '2x2': return { rows: 2, cols: 2 };
            case '3x3': return { rows: 3, cols: 3 };
            default: return { rows: 3, cols: 3 };
          }
        })();
        const totalCells = layoutDims.rows * layoutDims.cols;
        const panelAspect = contactSheetAspectRatio === '16:9' ? '16:9 (horizontal landscape)' : '9:16 (vertical portrait)';
        const styleTokens = stylePreset?.prompt || '';
        
        finalPrompt = [
          '<instruction>',
          `Generate a clean ${layoutDims.rows}x${layoutDims.cols} storyboard grid with exactly ${totalCells} equal-sized panels.`,
          `Overall Image Aspect Ratio: ${contactSheetAspectRatio}.`,
          `Each individual panel must have a ${panelAspect} aspect ratio.`,
          styleTokens ? `MANDATORY Visual Style for ALL panels: ${styleTokens}` : '',
          'Structure: No borders between panels, no text, no watermarks, no speech bubbles.',
          'Consistency: Maintain consistent perspective, lighting, color grading, and visual style across ALL panels.',
          '</instruction>',
          '',
          contactSheetPrompt,
          '',
          `Negative constraints: ${negativePrompt}`,
        ].filter(Boolean).join('\n');
      } else if (!finalPrompt.includes('Negative constraints:')) {
        finalPrompt += `\nNegative constraints: ${negativePrompt}`;
      }

      setContactSheetProgress(20);

      const result = await submitGridImageRequest({
        model,
        prompt: finalPrompt,
        apiKey,
        baseUrl,
        aspectRatio: contactSheetAspectRatio,
        resolution: '2K',
        keyManager,
      });

      setContactSheetProgress(100);
      if (!result.imageUrl) {
        throw new Error('Hình ảnhTạoThất bại：\u672aQuay lạiHình ảnh URL');
      }
      
      // Chẳng hạn như\u679cQuay lạtôi là\u662f HTTP URL，\u8f6ccho base64 — \u907f\u514d\u540e\u7eed\u5207\u5272\u65f6 CORS \u95ee\u9898
      let finalImageUrl = result.imageUrl;
      if (finalImageUrl.startsWith('http://') || finalImageUrl.startsWith('https://')) {
        try {
          const resp = await fetch(finalImageUrl);
          const blob = await resp.blob();
          finalImageUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          console.log('[ContactSheet] HTTP→base64 \u8f6c\u6362Thành công');
        } catch (e) {
          console.warn('[ContactSheet] HTTP→base64 \u8f6c\u6362Thất bại，sử dụng\u539fURL');
        }
      }
      
      setContactSheetImage(finalImageUrl);
      toast.success("đồ thị chung TạoThành công，\u53ef\u4ee5\u8fdbđược rồi\u5207\u5272");
    } catch (error) {
      const err = error as Error;
      console.error('[ContactSheet] TạoThất bại:', err);
      toast.error(`TạoThất bại: ${err.message}`);
    } finally {
      setIsGeneratingContactSheet(false);
      setContactSheetProgress(0);
    }
  };

  /**
   * \u6839\u636eBố cục\u83b7\u53d6được rồiCột\u6570
   * - 3x3: \u56fa\u5b9a 3được rồi3Cột
   * - 2x2: \u56fa\u5b9a 2được rồi2Cột
   */
  const getLayoutDimensions = (layout: ContactSheetLayout, aspectRatio: '16:9' | '9:16') => {
    switch (layout) {
      case '2x2':
        return { rows: 2, cols: 2 };
      case '3x3':
        return { rows: 3, cols: 3 };
      default:
        // \u540e\u5907：Mặc định 3x3
        return { rows: 3, cols: 3 };
    }
  };

  /**
   * Tải lêđồ thị chung（dự phòng，sử dụng\u4e8etay\u52a8Tải lênBên ngoài\u90e8Tạo Hình ảnh）
   */
  const handleUploadContactSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setContactSheetImage(dataUrl);
      toast.success("\u8054\u5408\u56feĐã Tải lên，\u53ef\u4ee5\u8fdbđược rồi\u5207\u5272");
    };
    reader.readAsDataURL(file);
  };

  /**
   * độc lậpTải lêđồ thị chunglối vào（\u4e0d\u9700\u8981đầu tiênTạoPrompt）
   * Theo Người dùng\u9009\u62e9củabố trí lướiTự động TạoMặc địnhGóc nhìn
   * quan trọng：Huỷhiện tại\u9009trongCảnh，\u786e\u4fddLưu\u65f6Tạo\u65b0Cảnh
   */
  const handleDirectUploadContactSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // quan trọng：Huỷhiện tại\u9009trongCảnh，\u786e\u4fddLưu\u65f6\u4f1aTạo\u65b0Cảnh
    selectScene(null);
    
    // \u6e05\u7a7a\u8868\u5355，\u51c6\u5907\u81ea\u52a8\u547dtên
    const timestamp = new Date().toLocaleString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).replace(/[\/:]/g, '-');
    const autoSceneName = `\u8054\u5408\u56feCảnh-${timestamp}`;
    setName(autoSceneName);
    setLocation(autoSceneName);

    // GetNgười dùng\u9009\u62e9củaBố cục
    const dims = getLayoutDimensions(contactSheetLayout, contactSheetAspectRatio);
    const totalCells = dims.rows * dims.cols;

    // Tự động TạoMặc địnhGóc nhìn（Góc nhìn1, Góc nhìn2, ..., Góc nhìnN）
    const defaultViewpoints: SceneViewpoint[] = [];
    for (let i = 0; i < totalCells; i++) {
      defaultViewpoints.push({
        id: `viewpoint-${i + 1}`,
        name: `Góc nhìn${i + 1}`,
        nameEn: `Viewpoint ${i + 1}`,
        shotIds: [],
        keyProps: [],
        keyPropsEn: [],
        description: '',
        descriptionEn: '',
        gridIndex: i,
      });
    }

    // Cài đặtGóc nhìdữ liệu
    setExtractedViewpoints(defaultViewpoints);
    
    // TạoMặc địnhPrompt\u9875\u9762\u6570\u636e（sử dụng\u4e8e\u5207\u5272\u65f6\u83b7\u53d6Bố cụcthông tin）
    const defaultPromptPage: ContactSheetPromptSet = {
      pageIndex: 0,
      prompt: '',
      promptZh: '',
      viewpointIds: defaultViewpoints.map(v => v.id),
      gridLayout: { rows: dims.rows, cols: dims.cols },
    };
    setPendingContactSheetPrompts([defaultPromptPage]);
    setPendingViewpoints(defaultViewpoints.map((vp) => ({
      ...vp,
      pageIndex: 0,
      shotIndexes: [],
    })));
    setCurrentPageIndex(0);
    
    // Cài đặtmộtmột\u5360\u4f4dPrompt，Kích hoạtnhập\u8054\u5408\u56fe\u754c\u9762
    setContactSheetPrompt('[\u76f4\u63a5Tải lên - không cóPrompt]');
    setContactSheetPromptZh('[\u76f4\u63a5Tải lên - không cóPrompt]');

    // \u8bfb\u53d6\u5e76\u663e\u793aTải lênHình ảnh
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setContactSheetImage(dataUrl);
      toast.success(`\u8054\u5408\u56feĐã Tải lên（${dims.rows}×${dims.cols} = ${totalCells}\u683c），\u5207\u5272\u540e\u5c06Tự động Tạo\u65b0Cảnh`);
    };
    reader.readAsDataURL(file);
  };

  /**
   * \u5728\u8054\u5408\u56fe\u754c\u9762trong\u5904\u7406Bố cụcthay đổi（\u4ec5\u5bf9\u76f4\u63a5Tải lênchế độ\u751f\u6548）
   * Cập nhậtGóc nhìn\u6570\u91cf\u4ee5trận đấu\u65b0Bố cục
   */
  const handleContactSheetLayoutChange = (newLayout: ContactSheetLayout) => {
    setContactSheetLayout(newLayout);
    
    // Chẳng hạn như\u679c\u662f\u76f4\u63a5Tải lênchế độ（\u6ca1Có\u771f\u6b63củaPrompt），\u9700\u8981Cập nhậtGóc nhìdữ liệu
    if (contactSheetPrompt === '[\u76f4\u63a5Tải lên - không cóPrompt]') {
      const dims = getLayoutDimensions(newLayout, contactSheetAspectRatio);
      const totalCells = dims.rows * dims.cols;
      
      // \u91cd\u65b0TạoMặc địnhGóc nhìn
      const newDefaultViewpoints: SceneViewpoint[] = [];
      for (let i = 0; i < totalCells; i++) {
        newDefaultViewpoints.push({
          id: `viewpoint-${i + 1}`,
          name: `Góc nhìn${i + 1}`,
          nameEn: `Viewpoint ${i + 1}`,
          shotIds: [],
          keyProps: [],
          keyPropsEn: [],
          description: '',
          descriptionEn: '',
          gridIndex: i,
        });
      }
      
      setExtractedViewpoints(newDefaultViewpoints);
      setPendingViewpoints(newDefaultViewpoints.map((vp) => ({
        ...vp,
        pageIndex: 0,
        shotIndexes: [],
      })));
      
      // Cập nhậtBố cụcthông tin
      const updatedPromptPage: ContactSheetPromptSet = {
        pageIndex: 0,
        prompt: '',
        promptZh: '',
        viewpointIds: newDefaultViewpoints.map(v => v.id),
        gridLayout: { rows: dims.rows, cols: dims.cols },
      };
      setPendingContactSheetPrompts([updatedPromptPage]);
      
      // \u6e05\u9664Đã rồiCócủa\u5207\u5272kết quả
      setSplitViewpointImages({});
    }
  };

  /**
   * \u5207\u5272\u8054\u5408\u56fe
   */
  const handleSplitContactSheet = async () => {
    // Ưu tiênsử dụng pendingViewpoints（từKịch bản\u4f20\u6765của），\u5426\u5219sử dụng extractedViewpoints
    const currentPageVps = pendingViewpoints.filter(v => v.pageIndex === currentPageIndex);
    const viewpointsToUse = currentPageVps.length > 0 ? currentPageVps : extractedViewpoints;
    
    if (!contactSheetImage || viewpointsToUse.length === 0) {
      toast.error("\u8bf7đầu tiênTải lêđồ thị chung\u5e76TạoPrompt");
      return;
    }

    setIsSplitting(true);
    try {
      // Ưu tiêntừ pendingContactSheetPrompts \u83b7\u53d6Bố cục（Đây làTạoPrompt\u65f6\u786e\u5b9acủa\u771f\u5b9eBố cục）
      // nếu không，\u624dsử dụngNgười dùng\u9009\u62e9của contactSheetLayout
      let expectedRows: number;
      let expectedCols: number;
      
      const currentPagePrompt = pendingContactSheetPrompts[currentPageIndex];
      if (currentPagePrompt?.gridLayout) {
        // sử dụngTạoPrompt\u65f6\u786e\u5b9acủaBố cục
        expectedRows = currentPagePrompt.gridLayout.rows;
        expectedCols = currentPagePrompt.gridLayout.cols;
        console.log('[Split] sử dụng pendingContactSheetPrompts trongcủaBố cục:', { expectedRows, expectedCols });
      } else {
        // \u540e\u5907：sử dụngNgười dùng\u9009\u62e9củaBố cục
        const dims = getLayoutDimensions(contactSheetLayout, contactSheetAspectRatio);
        expectedRows = dims.rows;
        expectedCols = dims.cols;
        console.log('[Split] sử dụngNgười dùng\u9009\u62e9củaBố cục:', { expectedRows, expectedCols, contactSheetLayout });
      }
      
      const expectedCount = expectedRows * expectedCols;
      
      // Chẳng hạn như\u679cHình ảnh là HTTP URL，đầu tiên\u8f6ccho base64 \u907f\u514d CORS \u5bfc\u81f4 canvas \u88ab\u6c61\u67d3
      let imageForSplit = contactSheetImage;
      if (contactSheetImage.startsWith('http://') || contactSheetImage.startsWith('https://')) {
        console.log('[Split] HTTP URL Phát hiệnĐến，\u8f6c\u6362cho base64...');
        try {
          const resp = await fetch(contactSheetImage);
          const blob = await resp.blob();
          imageForSplit = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          console.log('[Split] HTTP→base64 \u8f6c\u6362Thành công');
        } catch (convertErr) {
          console.warn('[Split] HTTP→base64 \u8f6c\u6362Thất bại，sử dụng\u539fURL:', convertErr);
        }
      }
      
      const splitResults = await splitStoryboardImage(imageForSplit, {
        aspectRatio: contactSheetAspectRatio,
        resolution: '2K',
        sceneCount: expectedCount,
        options: {
          expectedRows,
          expectedCols,
          filterEmpty: false, // Giữ Tất cả\u683c\u5b50
          edgeMarginPercent: 0.02, // 2% \u8fb9\u7f18\u88c1\u526a
        },
      });
      
      // \u5c06\u5207\u5272kết quả\u6620\u5c04ĐếnGóc nhìn
      const viewpointImagesMap: Record<string, { imageUrl: string; gridIndex: number }> = {};
      
      for (const vp of viewpointsToUse) {
        const gridIndex = vp.gridIndex;
        // \u6839\u636e\u5bbd\u9ad8\u6bd4Tính toánđược rồiCột
        const row = Math.floor(gridIndex / expectedCols);
        const col = gridIndex % expectedCols;
        
        // splitResults \u6309 row/col trận đấu
        const splitResult = splitResults.find(sr => sr.row === row && sr.col === col);
        
        if (splitResult) {
          viewpointImagesMap[vp.id] = {
            imageUrl: splitResult.dataUrl,
            gridIndex: gridIndex,
          };
        }
      }
      
      // \u540c\u6b65Cập nhật extractedViewpoints，\u786e\u4fddLưu\u65f6Có\u6570\u636e
      if (currentPageVps.length > 0 && extractedViewpoints.length === 0) {
        setExtractedViewpoints(currentPageVps.map(vp => ({
          id: vp.id,
          name: vp.name,
          nameEn: vp.nameEn,
          shotIds: vp.shotIds,
          keyProps: vp.keyProps,
          keyPropsEn: vp.keyPropsEn,
          description: '',
          descriptionEn: '',
          gridIndex: vp.gridIndex,
        })));
      }
      
      setSplitViewpointImages(viewpointImagesMap);
      toast.success(`Đã rồi\u5207\u5272cho ${Object.keys(viewpointImagesMap).length} Góc nhìnHình ảnh`);
    } catch (error) {
      console.error('[ContactSheet] \u5207\u5272Thất bại:', error);
      toast.error("\u5207\u5272Thất bại，\u8bf7\u68c0\u67e5Hình ảnhĐịnh dạng");
    } finally {
      setIsSplitting(false);
    }
  };

  /**
   * LưuGóc nhìnHình ảnh - cho mỗi Góc nhìnTạođộc lậpcủa\u5b50Cảnh
   * Ví dụ：“Phòng khách của Trương” → TạoThư mục“Phòng khách của Trương-Góc nhìn” → Lưu\u5b50CảnhĐếnThư mục
   * nếu không\u9009Trung bình Cảnh，\u4f1aTự động TạomộtmộtPhụ huynh Cảnh
   */
  const handleSaveViewpointImages = async () => {
    if (Object.keys(splitViewpointImages).length === 0) {
      toast.error("\u6ca1Có\u53efLưucủaGóc nhìnHình ảnh");
      return;
    }
    
    // nếu không\u9009Trung bình Cảnh，đầu tiênTự động TạomộtmộtPhụ huynh Cảnh
    let parentScene = selectedScene;
    if (!parentScene) {
      // \u68c0\u67e5\u8868\u5355\u6570\u636e
      const sceneName = name.trim() || 'Chưa đặt tênCảnh';
      const sceneLocation = location.trim() || sceneName;
      
      // TạoPhụ huynh Cảnh
      const newParentId = addScene({
        name: sceneName,
        location: sceneLocation,
        time: time || 'day',
        atmosphere: atmosphere || 'peaceful',
        styleId: styleId || DEFAULT_STYLE_ID,
        folderId: currentFolderId,
        projectId: resourceProjectId ?? undefined,
      });
      
      // \u83b7\u53d6\u521aTạo'Cảnh
      const { scenes } = useSceneStore.getState();
      parentScene = scenes.find(s => s.id === newParentId) || null;
      
      if (!parentScene) {
        toast.error("TạoPhụ huynh CảnhThất bại");
        return;
      }
      
      // \u9009trong\u65b0Tạo'Cảnh
      selectScene(newParentId);
      toast.success(`Đã Tự động TạoCảnh「${sceneName}」`);
    }

    // Ưu tiênsử dụng pendingViewpoints（từKịch bản\u4f20\u6765của），\u5426\u5219sử dụng extractedViewpoints
    const currentPageVps = pendingViewpoints.filter(v => v.pageIndex === currentPageIndex);
    let viewpointsToUse = currentPageVps.length > 0 ? currentPageVps : extractedViewpoints;
    
    if (viewpointsToUse.length === 0) {
      toast.error("\u6ca1CóGóc nhìdữ liệu");
      return;
    }
    
    // === \u8865\u5168\u672a\u5206\u914dcủaPhân cảnh shotIds ===
    // tìm thấyC hiện tạiảnhTất cảPhân cảnh
    const sceneName = parentScene.name || parentScene.location || '';
    const sceneShots = allShots.filter(shot => {
      // Chấp nhận sceneRefId hoặcCảnhTêntrận đấu
      const scriptScenes = currentProject?.scriptData?.scenes || [];
      const matchedScene = scriptScenes.find(s => 
        s.name === sceneName || s.location === sceneName ||
        (s.name && sceneName.includes(s.name)) || (s.location && sceneName.includes(s.location))
      );
      return matchedScene && shot.sceneRefId === matchedScene.id;
    });
    
    if (sceneShots.length > 0) {
      // \u6536đặtĐã rồi\u5206\u914dcủaPhân cảnh ID
      const assignedShotIds = new Set(viewpointsToUse.flatMap(vp => vp.shotIds || []));
      
      // \u627e\u51fa\u672a\u5206\u914dcủaPhân cảnh
      const unassignedShots = sceneShots.filter(shot => !assignedShotIds.has(shot.id));
      
      if (unassignedShots.length > 0) {
        console.log(`[ContactSheet] khám phá ${unassignedShots.length} Ph chưa được phân bổân cảnh，\u6309\u5e8f\u53f7Được giao cho Góc nhìn`);
        
        // \u6309Phân cảsố sê-riĐược giao cho Góc nhìn（Phân cảnh1->Góc nhìn1，Phân cảnh2->Góc nhìn2，...）
        // \u590d\u5236 viewpointsToUse \u4ee5\u4fbfSửa
        viewpointsToUse = viewpointsToUse.map((vp) => ({
          ...vp,
          shotIds: [...(vp.shotIds || [])],
        })) as typeof viewpointsToUse;
        
        // \u5c06\u672a\u5206\u914dcủaPhân cảnh\u6309\u5e8f\u53f7\u5206\u914d
        for (const shot of unassignedShots) {
          // Theo Ph.ân cảnh ở trongCảnhbên trongcủa\u5e8f\u53f7\u786e\u5b9a\u5bf9\u5e94củaGóc nhìn
          const shotIndexInScene = sceneShots.findIndex(s => s.id === shot.id);
          const vpIndex = shotIndexInScene % viewpointsToUse.length;
          viewpointsToUse[vpIndex].shotIds.push(shot.id);
          console.log(`  - Phân cảnh ${shot.id} (\u5e8f\u53f7${shotIndexInScene + 1}) -> Góc nhìn ${vpIndex + 1}: ${viewpointsToUse[vpIndex].name}`);
        }
      }
    }

    const parentSceneName = parentScene.name || parentScene.location;
    const createdVariantIds: string[] = [];
    
    // \u5b50CảnhLưu\u5728vàPhụ huynh Cảnh\u76f8\u540cThư mụctrong，Chấp nhận parentSceneId \u5173\u8054
    const targetFolderId = parentScene.folderId;
    
    console.log('[ContactSheet] LưuGóc nhìnHình ảnh（\u59cb\u7ec8Tạo mới）:', {
      parentSceneId: parentScene.id,
      parentSceneName,
      viewpointsToSave: viewpointsToUse.map(v => v.name),
    });
    
    // cho mỗi Góc nhìn\u59cb\u7ec8Tạo\u65b0\u5b50Cảnh（Hình ảnhđầu tiên\u5b58\u672c\u5730）
    for (const vp of viewpointsToUse) {
      const imgData = splitViewpointImages[vp.id];
      if (!imgData) continue;
      
      const variantName = `${parentSceneName}-${vp.name}`;
      // \u5c06 data URL LưuĐếnđịa phươngTệp
      const safeName = variantName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
      const localPath = await saveImageToLocal(
        imgData.imageUrl,
        'scenes',
        `${safeName}_${Date.now()}.png`
      );
      // \u9a8c\u8bc1\u672c\u5730Lưu\u662f\u5426Thành công（Thất bại\u65f6 saveImageToLocal Quay lạinguyên bản data: URL）
      if (!localPath.startsWith('local-image://')) {
        console.warn(`[ContactSheet] Góc nhìnHình ảnh\u672c\u5730LưuThất bại: ${vp.name}, \u5c06sử dụngnguyên bản URL`);
      }
      const variantId = addScene({
        name: variantName,
        location: parentScene.location,
        time: parentScene.time || 'day',
        atmosphere: parentScene.atmosphere || 'peaceful',
        visualPrompt: parentScene.visualPrompt,
        referenceImage: localPath,
        styleId: parentScene.styleId || styleId,
        folderId: targetFolderId,
        projectId: parentScene.projectId ?? resourceProjectId ?? undefined,
        tags: parentScene.tags,
        // Góc nhìcác biến thể\u7279Cótừ\u6bb5
        parentSceneId: parentScene.id,
        viewpointId: vp.id,
        viewpointName: vp.name,
        shotIds: vp.shotIds,
        isViewpointVariant: true,
      } as any);
      createdVariantIds.push(variantId);

      // \u540c\u6b65\u5f52\u6863ĐếnChất liệu\u5e93 AIHình ảnh Thư mục
      const aiFolder = getOrCreateCategoryFolder('ai-image');
      addMediaFromUrl({
        url: localPath,
        name: `Cảnh-${variantName}`,
        type: 'image',
        source: 'ai-image',
        folderId: aiFolder,
        projectId: parentScene.projectId ?? resourceProjectId ?? undefined,
      });
    }

    // Cập nhậtPhụ huynh Cảnh：\u4ec5Bản ghi\u672clầđồ thị chung（Không được bảo hiểm\u5176\u5b83\u5b50Cảnh）
    const viewpointsData = viewpointsToUse.map(vp => ({
      id: vp.id,
      name: vp.name,
      nameEn: vp.nameEn,
      shotIds: vp.shotIds,
      keyProps: vp.keyProps,
      gridIndex: vp.gridIndex,
    }));
    // \u8054\u5408\u56fe\u4e5fLưuĐến\u672c\u5730（\u907f\u514d base64 \u6301\u4e45\u5316\u81a8\u80c0）
    let localContactSheet: string | null = contactSheetImage;
    if (contactSheetImage && contactSheetImage.startsWith('data:')) {
      const csPath = await saveImageToLocal(
        contactSheetImage,
        'scenes',
        `contact-sheet-${parentScene.id}_${Date.now()}.png`
      );
      if (csPath.startsWith('local-image://')) {
        localContactSheet = csPath;
        // \u8054\u5408\u56fe\u540c\u6b65\u5f52\u6863ĐếnChất liệu\u5e93
        const csAiFolder = getOrCreateCategoryFolder('ai-image');
        addMediaFromUrl({
          url: csPath,
          name: `\u8054\u5408\u56fe-${parentSceneName}`,
          type: 'image',
          source: 'ai-image',
          folderId: csAiFolder,
          projectId: parentScene.projectId ?? resourceProjectId ?? undefined,
        });
      }
    }
    updateScene(parentScene.id, {
      contactSheetImage: localContactSheet,
      viewpoints: viewpointsData,
    } as any);

    console.log('[ContactSheet] LưuHoàn thành（\u59cb\u7ec8Tạo mới）:', {
      parentSceneId: parentScene.id,
      created: createdVariantIds.length,
    });

    // \u4ec5Lưu\u65b0Tạocủa\u5b50Cảnh ID，sử dụng\u4e8elô\u91cfbốn\u89c6\u56fe
    setSavedChildSceneIds(createdVariantIds);
    
    toast.success(`Đã Tạo ${createdVariantIds.length} Góc nhìcác biến thểCảnh`);
    
    // \u6e05\u7a7a\u4e34\u65f6Trạng thái（\u4fdd\u7559 savedChildSceneIds）
    setContactSheetPrompt(null);
    setContactSheetPromptZh(null);
    setContactSheetImage(null);
    setSplitViewpointImages({});
    setExtractedViewpoints([]);
    setPendingViewpoints([]);
    setPendingContactSheetPrompts([]);
  };

  /**
   * HuỷNhiều Góc nhìnThao tác
   */
  const handleCancelContactSheet = () => {
    setContactSheetPrompt(null);
    setContactSheetPromptZh(null);
    setContactSheetImage(null);
    setSplitViewpointImages({});
    setExtractedViewpoints([]);
  };

  /**
   * một\u952e\u81ea\u52a8nước chảy\u7ebf：Tạo\u8054\u5408\u56fe → \u5207\u5272 → Lưu\u5b50Cảnh
   * Nhiệm vụ\u5728\u540e\u53f0\u8fd0được rồi，Người dùng\u53ef\u4ee5tiếp tụcCài đặt\u4e0bmộtmộtTạoNhiệm vụ
   */
  const handleAutoGenerateContactSheet = async () => {
    if (!contactSheetPrompt) {
      toast.error("\u8bf7đầu tiênTạoPrompt");
      return;
    }

    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('character_generation'));
      return;
    }

    // Ảnh chụp nhanhhiện tạiTất cả\u5fc5\u8981Trạng thái（\u786e\u4fdd\u540e\u53f0\u8fd0được rồi\u65f6\u4e0d\u53d7 UI Trạng thátôi thay đổi\u5f71\u54cd）
    const snapshotPrompt = contactSheetPrompt;
    const snapshotStyleId = styleId;
    const snapshotAspectRatio = contactSheetAspectRatio;
    const snapshotLayout = contactSheetLayout;
    const snapshotViewpoints = [...(pendingViewpoints.length > 0 ? pendingViewpoints.filter(v => v.pageIndex === currentPageIndex) : extractedViewpoints)];
    const snapshotAllPendingViewpoints = [...pendingViewpoints];
    const snapshotCurrentPageIndex = currentPageIndex;
    const snapshotPendingPrompts = [...pendingContactSheetPrompts];

    console.log('[AutoContactSheet] Ảnh chụp nhanhTrạng thái:', {
      promptLength: contactSheetPrompt?.length,
      aspectRatio: snapshotAspectRatio,
      layout: snapshotLayout,
      viewpointsCount: snapshotViewpoints.length,
      pendingViewpointsTotal: pendingViewpoints.length,
      extractedViewpointsCount: extractedViewpoints.length,
      currentPageIndex,
    });

    const snapshotName = name.trim() || selectedScene?.name || 'Chưa đặt tênCảnh';
    const snapshotLocation = location.trim() || selectedScene?.location || snapshotName;
    const snapshotTime = time || selectedScene?.time || 'day';
    const snapshotAtmosphere = atmosphere || selectedScene?.atmosphere || 'peaceful';
    const snapshotVisualPrompt = visualPrompt || selectedScene?.visualPrompt;
    const snapshotTags = [...tags];
    const snapshotNotes = notes;
    const snapshotFolderId = currentFolderId;
    const snapshotProjectId = resourceProjectId;

    // \u7acb\u5373Tạohoặc\u590dsử dụngPhụ huynh Cảnh
    let parentSceneId: string;
    if (selectedScene) {
      parentSceneId = selectedScene.id;
    } else {
      parentSceneId = addScene({
        name: snapshotName,
        location: snapshotLocation,
        time: snapshotTime,
        atmosphere: snapshotAtmosphere,
        styleId: snapshotStyleId || DEFAULT_STYLE_ID,
        folderId: snapshotFolderId,
        projectId: snapshotProjectId ?? undefined,
        visualPrompt: snapshotVisualPrompt,
        tags: snapshotTags.length > 0 ? snapshotTags : undefined,
        notes: snapshotNotes?.trim() || undefined,
      });
      selectScene(parentSceneId);
      onSceneCreated?.(parentSceneId);
    }

    // Cài đặtTạotrongTrạng thái — trong\u95f4\u680f\u4f1a\u663e\u793a spinner
    setContactSheetTask(parentSceneId, { status: 'generating', progress: 10, message: 'Là Tạo\u8054\u5408\u56fe...' });
    toast.info(`Cảnh「${snapshotName}」\u8054\u5408\u56feBắt đầuTạo...`);

    // \u7acb\u5373\u6e05\u7a7a\u5de6\u680fTrạng thái，\u5141\u8bb8Người dùngCài đặt\u4e0bmộtmộtNhiệm vụ
    setContactSheetPrompt(null);
    setContactSheetPromptZh(null);
    setContactSheetImage(null);
    setSplitViewpointImages({});
    setIsGeneratingContactSheet(false);

    // \u540e\u53f0\u5f02\u6b65\u6267được rồi\u6574mộtnước chảy\u7ebf
    (async () => {
      try {
        // ==================== \u9636\u6bb5 1: Tạo\u8054\u5408\u56fe ====================
        // \u83b7\u53d6 API Cấu hình — vớigiám đốc\u9762\u677fmột\u81f4sử dụng submitGridImageRequest
        const autoFeatureConfig = getFeatureConfig('character_generation');
        if (!autoFeatureConfig) {
          throw new Error(getFeatureNotConfiguredMessage('character_generation'));
        }
        const apiKey = autoFeatureConfig.apiKey;
        const baseUrl = autoFeatureConfig.baseUrl?.replace(/\/+$/, '') || '';
        const model = autoFeatureConfig.models?.[0] || '';
        const keyManager = autoFeatureConfig.keyManager;

        if (!apiKey || !baseUrl || !model) {
          throw new Error('Hình ảnhTạo API Chưa được định cấu hình');
        }

        // Lời nhắc tiêu cực — \u589e\u52a0 distorted grid / uneven panels
        const stylePreset = getStyleById(snapshotStyleId);
        const isRealistic = stylePreset?.category === 'real';
        const negativePrompt = isRealistic
          ? 'blurry, low quality, watermark, text, labels, titles, captions, words, letters, numbers, annotations, subtitles, typography, font, writing, people, characters, anime, cartoon, distorted grid, uneven panels'
          : 'blurry, low quality, watermark, text, labels, titles, captions, words, letters, numbers, annotations, subtitles, typography, font, writing, people, characters, distorted grid, uneven panels';

        // \u589e\u5f3aPrompt：Chẳng hạn như\u679cNgười dùngChỉnh sửcủa một\u662fLời nhắc tiếng Trung，\u5728\u524d\u9762góiTiếng Anhcó cấu trúc\u7f51\u683c\u6307\u4ee4
        let finalPrompt = snapshotPrompt;
        const isChinese = /[\u4e00-\u9fa5]/.test(finalPrompt) && !finalPrompt.includes('<instruction>');
        if (isChinese) {
          // Người dùng\u63d0\u4f9b\u4e86Lời nhắc tiếng Trung\u4f46\u6ca1Cócó cấu trúc\u6307\u4ee4 → góiTiếng Anh grid \u6307\u4ee4
          const currentPagePromptForLayout = snapshotPendingPrompts[snapshotCurrentPageIndex];
          const layoutForPrompt = currentPagePromptForLayout?.gridLayout || 
            (() => {
              switch (snapshotLayout) {
                case '2x2': return { rows: 2, cols: 2 };
                case '3x3': return { rows: 3, cols: 3 };
                default: return { rows: 3, cols: 3 };
              }
            })();
          const totalCells = layoutForPrompt.rows * layoutForPrompt.cols;
          const panelAspect = snapshotAspectRatio === '16:9' ? '16:9 (horizontal landscape)' : '9:16 (vertical portrait)';
          const styleTokens = stylePreset?.prompt || '';
          
          finalPrompt = [
            '<instruction>',
            `Generate a clean ${layoutForPrompt.rows}x${layoutForPrompt.cols} storyboard grid with exactly ${totalCells} equal-sized panels.`,
            `Overall Image Aspect Ratio: ${snapshotAspectRatio}.`,
            `Each individual panel must have a ${panelAspect} aspect ratio.`,
            styleTokens ? `MANDATORY Visual Style for ALL panels: ${styleTokens}` : '',
            'Structure: No borders between panels, no text, no watermarks, no speech bubbles.',
            'Consistency: Maintain consistent perspective, lighting, color grading, and visual style across ALL panels.',
            '</instruction>',
            '',
            snapshotPrompt,
            '',
            `Negative constraints: ${negativePrompt}`,
          ].filter(Boolean).join('\n');
        } else {
          // Đã rồiCóTiếng Anhcó cấu trúcPrompt，\u8ffd\u52a0Lời nhắc tiêu cực
          if (!finalPrompt.includes('Negative constraints:')) {
            finalPrompt += `\nNegative constraints: ${negativePrompt}`;
          }
        }

        setContactSheetTask(parentSceneId, { status: 'generating', progress: 30, message: '\u6b63\u5728\u8c03sử dụng AI Tạo...' });

        // sử dụng submitGridImageRequest — vớigiám đốc\u9762\u677fgiữmột\u81f4
        const result = await submitGridImageRequest({
          model,
          prompt: finalPrompt,
          apiKey,
          baseUrl,
          aspectRatio: snapshotAspectRatio,
          resolution: '2K',
          keyManager,
        });

        const generatedImageUrl = result.imageUrl;
        if (!generatedImageUrl) {
          throw new Error('Hình ảnhTạoThất bại：\u672aQuay lạiHình ảnh URL');
        }

        console.log('[AutoContactSheet] \u9636\u6bb51Hoàn thành，Hình ảnhURLLoại:', 
          generatedImageUrl.startsWith('data:') ? 'base64' : 'HTTP URL',
          'Chiều dài:', generatedImageUrl.length
        );

        // ==================== \u9636\u6bb5 2: \u5207\u5272 ====================
        setContactSheetTask(parentSceneId, { status: 'splitting', progress: 60, message: '\u6b63\u5728\u5207\u5272Góc nhìn...' });

        const currentPagePrompt = snapshotPendingPrompts[snapshotCurrentPageIndex];
        let expectedRows: number, expectedCols: number;
        if (currentPagePrompt?.gridLayout) {
          expectedRows = currentPagePrompt.gridLayout.rows;
          expectedCols = currentPagePrompt.gridLayout.cols;
        } else {
          const layoutDims = (() => {
            switch (snapshotLayout) {
              case '2x2': return { rows: 2, cols: 2 };
              case '3x3': return { rows: 3, cols: 3 };
              default: return { rows: 3, cols: 3 };
            }
          })();
          expectedRows = layoutDims.rows;
          expectedCols = layoutDims.cols;
        }
        const expectedCount = expectedRows * expectedCols;

        // Chẳng hạn như\u679cHình ảnh là HTTP URL，đầu tiên\u8f6ccho base64 \u907f\u514d CORS \u5bfc\u81f4 canvas \u88ab\u6c61\u67d3
        let imageForSplit = generatedImageUrl;
        if (generatedImageUrl.startsWith('http://') || generatedImageUrl.startsWith('https://')) {
          console.log('[AutoContactSheet] HTTP URL Phát hiệnĐến，\u8f6c\u6362cho base64...');
          try {
            const resp = await fetch(generatedImageUrl);
            const blob = await resp.blob();
            imageForSplit = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            console.log('[AutoContactSheet] HTTP→base64 \u8f6c\u6362Thành công，Chiều dài:', imageForSplit.length);
          } catch (convertErr) {
            console.warn('[AutoContactSheet] HTTP→base64 \u8f6c\u6362Thất bại，sử dụng\u539fURL:', convertErr);
          }
        }

        console.log('[AutoContactSheet] \u5207\u5272Tham số:', { expectedRows, expectedCols, expectedCount, aspectRatio: snapshotAspectRatio });

        const splitResults = await splitStoryboardImage(imageForSplit, {
          aspectRatio: snapshotAspectRatio,
          resolution: '2K',
          sceneCount: expectedCount,
          options: {
            expectedRows,
            expectedCols,
            filterEmpty: false,
            edgeMarginPercent: 0.02,
          },
        });

        console.log('[AutoContactSheet] \u5207\u5272Hoàn thành，kết quả\u6570\u91cf:', splitResults.length);

        // Chẳng hạn như\u679c snapshotViewpoints cho\u7a7a（Người dùngManualChỉnh sửaPrompt，\u672ađiGóc nhìnTạoquá trình），
        // Tự động Tạo fallback Góc nhìn\u4ee5trận đấu\u5207\u5272kết quả
        let effectiveViewpoints = snapshotViewpoints;
        if (effectiveViewpoints.length === 0 && splitResults.length > 0) {
          console.log('[AutoContactSheet] Góc nhìncho\u7a7a，Tự động Tạo fallback Góc nhìn，\u6570\u91cf:', splitResults.length);
          effectiveViewpoints = splitResults.map((sr, idx) => ({
            id: `auto-vp-${idx}-${Date.now()}`,
            name: `Góc nhìn-${idx + 1}`,
            nameEn: `Viewpoint-${idx + 1}`,
            shotIds: [] as string[],
            shotIndexes: [] as number[],
            keyProps: [] as string[],
            keyPropsEn: [] as string[],
            gridIndex: idx,
            pageIndex: 0,
          }));
        }

        console.log('[AutoContactSheet] Có\u6548Góc nhìnSố lượng:', effectiveViewpoints.length);
        // Gỡ lỗi：Đầu ra\u6bcfGóc nhìncủa gridIndex
        effectiveViewpoints.forEach((vp, i) => {
          console.log(`[AutoContactSheet] Góc nhìn[${i}]: id=${vp.id}, name=${vp.name}, gridIndex=${vp.gridIndex}`);
        });

        // \u5c06\u5207\u5272kết quả\u6620\u5c04ĐếnGóc nhìn — \u53cc\u91cd\u6620\u5c04Chiến lược：Ưu tiên\u76f4\u63a5\u7d22\u5f15，\u56de\u9000Đến row/col \u67e5\u627e
        const viewpointImagesMap: Record<string, { imageUrl: string; gridIndex: number }> = {};
        for (const vp of effectiveViewpoints) {
          const gridIdx = vp.gridIndex;
          // Chiến lược 1: \u76f4\u63a5\u7d22\u5f15 — splitResults \u6309được rồiƯu tiên\u6392Cột，gridIndex \u76f4\u63a5\u5bf9\u5e94
          let splitResult = (gridIdx >= 0 && gridIdx < splitResults.length) ? splitResults[gridIdx] : undefined;
          // \u9a8c\u8bc1：\u76f4\u63a5\u7d22\u5f15của row/col \u5e94\u8be5 = gridIndex \u6574\u9664và\u53d6\u6a21
          if (splitResult) {
            const expectRow = Math.floor(gridIdx / expectedCols);
            const expectCol = gridIdx % expectedCols;
            if (splitResult.row !== expectRow || splitResult.col !== expectCol) {
              console.warn(`[AutoContactSheet] \u76f4\u63a5\u7d22\u5f15không có trận đấu: gridIndex=${gridIdx}, split[row=${splitResult.row},col=${splitResult.col}] vs expected[row=${expectRow},col=${expectCol}]`);
              splitResult = undefined; // không có trận đấu，\u56de\u9000Đến\u67e5\u627e
            }
          }
          // Chiến lược 2: row/col \u67e5\u627e
          if (!splitResult) {
            const row = Math.floor(gridIdx / expectedCols);
            const col = gridIdx % expectedCols;
            splitResult = splitResults.find(sr => sr.row === row && sr.col === col);
          }
          if (splitResult) {
            viewpointImagesMap[vp.id] = { imageUrl: splitResult.dataUrl, gridIndex: vp.gridIndex };
          } else {
            console.warn(`[AutoContactSheet] Góc nhìn ${vp.name}(gridIndex=${gridIdx}) \u672atìm thấy\u5bf9\u5e94\u5207\u5272kết quả`);
          }
        }

        const mappedCount = Object.keys(viewpointImagesMap).length;
        console.log('[AutoContactSheet] \u6620\u5c04kết quả\u6570\u91cf:', mappedCount, '/', effectiveViewpoints.length);

        // ===== \u5b89\u5168\u56de\u9000：Chẳng hạn như\u679c\u6620\u5c04Tất cảThất bại\u4f46\u5207\u5272Cókết quả，Sử dụng trực tiếp\u5207\u5272kết quảTạo\u5b50Cảnh =====
        if (mappedCount === 0 && splitResults.length > 0) {
          console.warn('[AutoContactSheet] ⚠ \u6620\u5c04Tất cảThất bại！\u542fsử dụng\u5b89\u5168\u56de\u9000：Sử dụng trực tiếp\u5207\u5272kết quảTạo\u5b50Cảnh');
          // \u91cd\u5efa effectiveViewpoints và viewpointImagesMap
          effectiveViewpoints = splitResults.map((sr, idx) => ({
            id: `fallback-vp-${idx}-${Date.now()}`,
            name: `Góc nhìn-${idx + 1}`,
            nameEn: `Viewpoint-${idx + 1}`,
            shotIds: [] as string[],
            shotIndexes: [] as number[],
            keyProps: [] as string[],
            keyPropsEn: [] as string[],
            gridIndex: idx,
            pageIndex: 0,
          }));
          effectiveViewpoints.forEach((vp, idx) => {
            viewpointImagesMap[vp.id] = { imageUrl: splitResults[idx].dataUrl, gridIndex: idx };
          });
          console.log('[AutoContactSheet] \u56de\u9000\u540e\u6620\u5c04\u6570\u91cf:', Object.keys(viewpointImagesMap).length);
        }

        // ==================== \u9636\u6bb5 3: Lưu\u5b50Cảnh ====================
        setContactSheetTask(parentSceneId, { status: 'saving', progress: 80, message: '\u6b63\u5728LưuGóc nhìn...' });

        const { scenes: currentScenes } = useSceneStore.getState();
        const parentScene = currentScenes.find(s => s.id === parentSceneId);
        if (!parentScene) {
          throw new Error('Phụ huynh CảnhĐã rồi\u88abXoá');
        }
        const parentSceneName = parentScene.name || parentScene.location;
        const targetFolderId = parentScene.folderId;
        const createdVariantIds: string[] = [];

        // \u8865\u5168Phân cảnh shotIds — sử dụng effectiveViewpoints（\u542b fallback）
        let viewpointsToSave = effectiveViewpoints.map((vp) => ({
          ...vp,
          shotIds: [...(vp.shotIds || [])],
        }));

        const sceneShots = allShots.filter(shot => {
          const scriptScenes = currentProject?.scriptData?.scenes || [];
          const matchedScene = scriptScenes.find(s => 
            s.name === parentSceneName || s.location === parentSceneName ||
            (s.name && parentSceneName.includes(s.name)) || (s.location && parentSceneName.includes(s.location))
          );
          return matchedScene && shot.sceneRefId === matchedScene.id;
        });

        if (sceneShots.length > 0) {
          const assignedShotIds = new Set(viewpointsToSave.flatMap(vp => vp.shotIds || []));
          const unassignedShots = sceneShots.filter(shot => !assignedShotIds.has(shot.id));
          for (const shot of unassignedShots) {
            const shotIndexInScene = sceneShots.findIndex(s => s.id === shot.id);
            const vpIndex = shotIndexInScene % viewpointsToSave.length;
            viewpointsToSave[vpIndex].shotIds.push(shot.id);
          }
        }

        console.log('[AutoContactSheet] \u9636\u6bb53: \u51c6\u5907Lưu\u5b50Cảnh, viewpointsToSave:', viewpointsToSave.length, 'viewpointImagesMap\u6761\u76ee:', Object.keys(viewpointImagesMap).length);

        for (const vp of viewpointsToSave) {
          const imgData = viewpointImagesMap[vp.id];
          if (!imgData) {
            console.warn(`[AutoContactSheet] bỏ quaGóc nhìn ${vp.name}: viewpointImagesMap trongkhông có\u5bf9\u5e94\u6570\u636e (id=${vp.id})`);
            continue;
          }

          const variantName = `${parentSceneName}-${vp.name}`;
          const safeName = variantName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
          const localPath = await saveImageToLocal(
            imgData.imageUrl,
            'scenes',
            `${safeName}_${Date.now()}.png`
          );

          const variantId = addScene({
            name: variantName,
            location: parentScene.location,
            time: parentScene.time || 'day',
            atmosphere: parentScene.atmosphere || 'peaceful',
            visualPrompt: parentScene.visualPrompt,
            referenceImage: localPath,
            styleId: parentScene.styleId || snapshotStyleId,
            folderId: targetFolderId,
            projectId: parentScene.projectId ?? snapshotProjectId ?? undefined,
            tags: parentScene.tags,
            parentSceneId: parentScene.id,
            viewpointId: vp.id,
            viewpointName: vp.name,
            shotIds: vp.shotIds,
            isViewpointVariant: true,
          } as any);
          createdVariantIds.push(variantId);

          const aiFolder = getOrCreateCategoryFolder('ai-image');
          addMediaFromUrl({
            url: localPath,
            name: `Cảnh-${variantName}`,
            type: 'image',
            source: 'ai-image',
            folderId: aiFolder,
            projectId: parentScene.projectId ?? snapshotProjectId ?? undefined,
          });
        }

        // Lưu\u8054\u5408\u56feĐếnPhụ huynh Cảnh（\u540c\u65f6\u517c\u5bb9 base64 và imageForSplit Đã rồi\u8f6c\u6362\u8fc7của）
        let localContactSheet: string | null = imageForSplit || generatedImageUrl;
        const imageToSave = imageForSplit || generatedImageUrl;
        if (imageToSave && (imageToSave.startsWith('data:') || imageToSave.startsWith('http'))) {
          const csPath = await saveImageToLocal(
            imageToSave,
            'scenes',
            `contact-sheet-${parentScene.id}_${Date.now()}.png`
          );
          if (csPath.startsWith('local-image://')) {
            localContactSheet = csPath;
            const csAiFolder = getOrCreateCategoryFolder('ai-image');
            addMediaFromUrl({
              url: csPath,
              name: `\u8054\u5408\u56fe-${parentSceneName}`,
              type: 'image',
              source: 'ai-image',
              folderId: csAiFolder,
              projectId: parentScene.projectId ?? snapshotProjectId ?? undefined,
            });
          }
        }

        const viewpointsData = viewpointsToSave.map(vp => ({
          id: vp.id,
          name: vp.name,
          nameEn: vp.nameEn,
          shotIds: vp.shotIds,
          keyProps: vp.keyProps,
          gridIndex: vp.gridIndex,
        }));
        updateScene(parentScene.id, {
          contactSheetImage: localContactSheet,
          viewpoints: viewpointsData,
        } as any);

        // ==================== Hoàn thành ====================
        console.log('[AutoContactSheet] ✅ nước chảy\u7ebfHoàn thành:', {
          parentSceneId,
          childScenesCreated: createdVariantIds.length,
          splitResultsCount: splitResults.length,
          viewpointsMapped: Object.keys(viewpointImagesMap).length,
        });
        setContactSheetTask(parentSceneId, { status: 'done', progress: 100, message: `Hoàn thành，Đã Tạo ${createdVariantIds.length} một\u5b50Cảnh` });
        if (createdVariantIds.length > 0) {
          toast.success(`Cảnh「${parentSceneName}」\u8054\u5408\u56feĐã rồi\u5207\u5272Lưu，tổng cộng ${createdVariantIds.length} Góc nhìn\u5b50Cảnh（\u70b9\u51fbMở rộng\u67e5\u770b）`);
        } else {
          toast.warning(`Cảnh「${parentSceneName}」\u8054\u5408\u56feĐã Lưu，\u4f46\u672a\u80fdTạo\u5b50Cảnh（\u5207\u5272kết quả: ${splitResults.length} một）`);
        }

        // 3giây\u540e\u6e05\u9664Hoàn thànhTrạng thái
        setTimeout(() => {
          setContactSheetTask(parentSceneId, null);
        }, 3000);

      } catch (error) {
        const err = error as Error;
        console.error('[AutoContactSheet] \u81ea\u52a8nước chảy\u7ebfThất bại:', err);
        setContactSheetTask(parentSceneId, { status: 'error', progress: 0, message: err.message });
        toast.error(`CảnhĐồ thị chung T tự độngạoThất bại: ${err.message}`);
        // 10 giây\u540e\u6e05\u9664LỗiTrạng thái
        setTimeout(() => {
          setContactSheetTask(parentSceneId, null);
        }, 10000);
      }
    })();
  };

  /**
   * \u6e05\u9664lô\u91cfbốn\u89c6\u56feTrạng thái
   */
  const handleClearBatchOrthographic = () => {
    setSavedChildSceneIds([]);
  };

  /**
   * Lô Tạobốn\u89c6\u56fe（choTất cả\u5b50Cảnh）
   */
  const handleBatchGenerateOrthographic = async () => {
    if (savedChildSceneIds.length === 0) {
      toast.error("\u6ca1Có\u53ef\u5904\u7406của\u5b50Cảnh");
      return;
    }

    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('character_generation'));
      return;
    }

    const { scenes, getSceneById } = useSceneStore.getState();
    const childScenes = savedChildSceneIds
      .map(id => scenes.find(s => s.id === id))
      .filter(Boolean) as Scene[];

    if (childScenes.length === 0) {
      toast.error("\u627e\u4e0dĐến\u5b50Cảnh");
      return;
    }

    toast.info(`Bắt đầbạn là ${childScenes.length} một\u5b50CảnhTạobốn\u89c6\u56fe...`);

    let successCount = 0;
    let failCount = 0;

    for (const childScene of childScenes) {
      try {
        // Tạobốn\u89c6\u56fePrompt
        const { anchor, walls } = extractSpatialAssets(childScene);
        const sceneName = childScene.name || childScene.location || 'the scene';
        const stylePreset = getStyleById(childScene.styleId || styleId);
        const styleTokens = stylePreset?.prompt || 'anime style';

        const promptEn = `A professional orthographic concept sheet arranged in a precise 2x2 grid, depicting ${sceneName} from four cardinal angles with perfect spatial continuity. ${styleTokens}, detailed environment concept art.

**Top-Left (Front View):** A direct front-facing shot of ${anchor}. Background: ${walls.south}.
**Top-Right (Back View):** A direct back-facing shot of ${anchor}. Background: ${walls.north}.
**Bottom-Left (Left Profile):** Side profile shot from the left. Background: ${walls.east}.
**Bottom-Right (Right Profile):** Side profile shot from the right. Background: ${walls.west}.

No characters, empty environment.`;

        const isRealistic = stylePreset?.category === 'real';
        const negativePrompt = isRealistic
          ? 'blurry, low quality, watermark, text, people, characters, anime, cartoon, distorted grid'
          : 'blurry, low quality, watermark, text, people, characters, distorted grid';

        // Thu thậpHình ảnh tham khảo：Ưu tiênsử dụng「Toàn cảnh」\u5b50Cảnh + hiện tại\u5b50CảnhHình ảnh
        const rawReferenceImages: string[] = [];
        
        // 1. \u83b7\u53d6\u540cmộtPhụ huynh Cảnh\u4e0bcủa「Toàn cảnh」\u5b50Cảnh
        let overviewImage: string | null = null;
        if (childScene.parentSceneId) {
          const overviewScene = scenes.find(s => 
            s.parentSceneId === childScene.parentSceneId && 
            (s as any).viewpointId === 'overview'
          );
          if (overviewScene?.referenceImage) {
            overviewImage = overviewScene.referenceImage;
          }
          if (!overviewImage) {
            const overviewByName = scenes.find(s => 
              s.parentSceneId === childScene.parentSceneId && 
              (s.name?.includes('Toàn cảnh') || (s as any).viewpointName === 'Toàn cảnh')
            );
            if (overviewByName?.referenceImage) {
              overviewImage = overviewByName.referenceImage;
            }
          }
        }
        
        if (overviewImage) {
          rawReferenceImages.push(overviewImage);
          console.log(`[lô\u91cfbốn\u89c6\u56fe] ${childScene.name} sử dụngToàn cảnh\u5b50Cảnh để tham khảo`);
        }
        
        // 2. Thêm\u5b50Cảnh\u81ea\u8eabHình ảnh
        if (childScene.referenceImage && childScene.referenceImage !== overviewImage) {
          rawReferenceImages.push(childScene.referenceImage);
        }

        // \u5c06 local-image:// \u8f6c\u6362cho base64 \u4ee5\u4f20\u7ed9 API
        const referenceImages: string[] = [];
        for (const ref of rawReferenceImages) {
          if (ref.startsWith('local-image://')) {
            const base64 = await readImageAsBase64(ref);
            if (base64) referenceImages.push(base64);
          } else {
            referenceImages.push(ref);
          }
        }

        // Tạo hình ảnh
        const result = await generateSceneImageAPI({
          prompt: promptEn,
          negativePrompt,
          aspectRatio: orthographicAspectRatio,
          styleId: childScene.styleId || styleId,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        });

        // \u5207\u5272
        const splitResults = await splitStoryboardImage(result.imageUrl, {
          aspectRatio: orthographicAspectRatio,
          resolution: '2K',
          sceneCount: 4,
          options: { expectedRows: 2, expectedCols: 2, filterEmpty: false, edgeMarginPercent: 0.02 },
        });

        // Lưu 4 Góc nhìn\u5b50Cảnh
        const viewLabels = [
          { key: 'front', name: 'phía trước', row: 0, col: 0 },
          { key: 'back', name: '\u80cc\u9762', row: 0, col: 1 },
          { key: 'left', name: '\u5de6\u4fa7', row: 1, col: 0 },
          { key: 'right', name: '\u53f3\u4fa7', row: 1, col: 1 },
        ];

        for (const view of viewLabels) {
          const sr = splitResults.find(r => r.row === view.row && r.col === view.col);
          if (sr) {
            const safeName = `${childScene.name}-${view.name}`.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
            const localPath = await saveImageToLocal(
              sr.dataUrl,
              'scenes',
              `${safeName}_${Date.now()}.png`
            );
            addScene({
              name: `${childScene.name}-${view.name}`,
              location: childScene.location,
              time: childScene.time || 'day',
              atmosphere: childScene.atmosphere || 'peaceful',
              referenceImage: localPath,
              styleId: childScene.styleId || styleId,
              folderId: childScene.folderId,
              projectId: childScene.projectId ?? resourceProjectId ?? undefined,
              parentSceneId: childScene.id,
              viewpointId: view.key,
              viewpointName: view.name,
              isViewpointVariant: true,
            } as any);

            // \u540c\u6b65\u5f52\u6863ĐếnChất liệu\u5e93
            const batchAiFolder = getOrCreateCategoryFolder('ai-image');
            addMediaFromUrl({
              url: localPath,
              name: `Cảnh-${childScene.name}-${view.name}`,
              type: 'image',
              source: 'ai-image',
              folderId: batchAiFolder,
              projectId: childScene.projectId ?? resourceProjectId ?? undefined,
            });
          }
        }

        successCount++;
        console.log(`[lô\u91cfbốn\u89c6\u56fe] ${childScene.name} Hoàn thành`);
      } catch (err) {
        failCount++;
        console.error(`[lô\u91cfbốn\u89c6\u56fe] ${childScene.name} Thất bại:`, err);
      }
    }

    setSavedChildSceneIds([]);
    toast.success(`lô\u91cfbốn\u89c6\u56feHoàn thành！Thành công ${successCount} một，Thất bại ${failCount} một`);
  };

  // ========== bốn\u89c6\u56fe（\u6b63\u4ea4\u89c6\u56fe）chức năng ==========

  /**
   * Từ CảnhMô tảtrongTrích xuất\u7a7a\u95f4tài sản
   */
  const extractSpatialAssets = (scene: Scene) => {
    const locationParts = (scene.location || '').split(/[,，、。；;\n]/).filter(Boolean);
    const visualParts = (scene.visualPrompt || '').split(/[,，、。；;\n]/).filter(Boolean);
    
    // \u5c1d\u8bd5\u8bc6\u522bCảnhtrongcủachính\u7269\u4f53\u4f5ccho ANCHOR
    const commonAnchors = ['\u684c', '\u6905', 'giường', 'Sofa', '\u67dc', '\u53f0', '\u67b6', '\u706f', 'cửa', 'cửa sổ'];
    let anchor = locationParts[0] || scene.name || 'the central object';
    for (const part of [...locationParts, ...visualParts]) {
      for (const keyword of commonAnchors) {
        if (part.includes(keyword)) {
          anchor = part.trim();
          break;
        }
      }
    }

    // Tạobốn\u9762\u5899củaMô tả
    const wallDescriptions = {
      north: 'các cửa sổvàánh sáng tự nhiên',
      south: 'lối vàocửa',
      west: '\u88c5\u9970\u5899hoặcgiá sách',
      east: 'nhà\u5177hoặc\u9648\u8bbe',
    };

    // từTầm nhìn Mô tảtrong\u5c1d\u8bd5Trích xuất\u5899\u9762thông tin
    const wallKeywords = {
      window: ['cửa sổ', 'window', '\u9633\u5149', 'sunlight'],
      door: ['cửa', 'door', 'lối vào', 'entrance'],
      shelf: ['\u67b6', 'shelf', '\u67dc', 'cabinet', '\u4e66'],
      decoration: ['\u753b', '\u88c5\u9970', 'decoration', 'art'],
    };

    for (const part of [...locationParts, ...visualParts]) {
      if (wallKeywords.window.some(k => part.includes(k))) {
        wallDescriptions.north = part.trim();
      } else if (wallKeywords.door.some(k => part.includes(k))) {
        wallDescriptions.south = part.trim();
      } else if (wallKeywords.shelf.some(k => part.includes(k))) {
        wallDescriptions.west = part.trim();
      } else if (wallKeywords.decoration.some(k => part.includes(k))) {
        wallDescriptions.east = part.trim();
      }
    }

    return { anchor, walls: wallDescriptions };
  };

  /**
   * Tạobốn\u89c6\u56fe（\u6b63\u4ea4\u89c6\u56fe）Prompt
   */
  const handleGenerateOrthographicPrompt = () => {
    if (!selectedScene) {
      toast.error("\u8bf7đầu tiên\u9009\u62e9Cảnh");
      return;
    }

    const { anchor, walls } = extractSpatialAssets(selectedScene);
    const sceneName = selectedScene.name || selectedScene.location || 'the scene';
    
    // Nhận Phong cách tokens
    const stylePreset = getStyleById(styleId);
    const styleTokens = stylePreset?.prompt || 'anime style';

    // Tiếng AnhNhắc
    const promptEn = `A professional orthographic concept sheet arranged in a precise 2x2 grid, depicting ${sceneName} from four cardinal angles with perfect spatial continuity. ${styleTokens}, detailed environment concept art.

**Top-Left (Front View):**
A direct front-facing shot of ${anchor}. We see the front details clearly. The background is the wall behind it, featuring ${walls.south}.

**Top-Right (Back View):**
A direct back-facing shot of ${anchor}. We see the rear structure. The background is the wall the object is facing, featuring ${walls.north}.

**Bottom-Left (Left Profile):**
A side profile shot of ${anchor} from the left. The background is the opposite wall, strictly featuring ${walls.east}.

**Bottom-Right (Right Profile):**
A side profile shot of ${anchor} from the right. The background is the opposite wall, strictly featuring ${walls.west}.

Unified by flat, neutral cinematic lighting to ensure texture visibility. No characters, empty environment.`;

    // Lời nhắc tiếng Trung
    const promptZh = `\u4e13\u4e1a\u6b63\u4ea4khái niệm\u56fe，\u7cbe\u786ecủa 2x2 \u7f51\u683c\u6392Cột，hiển thị「${sceneName}」củabốnmột\u57fa\u672cGóc nhìn，giữ\u5b8c\u7f8ecủa\u7a7a\u95f4\u8fde\u7eed\u6027。${stylePreset?.name || 'Hoạt ảnhPhong cách'}，\u8be6\u7ec6củamôi trườngkhái niệm\u827a\u672f。

**\u5de6\u4e0a（phía trước\u89c6\u56fe）：**
${anchor} củaphía trước\u76f4\u89c6Cảnh quay。\u6e05\u6670hiển thịphía trướcChi tiết。Nền\u662f\u5176\u540e\u65b9của\u5899\u58c1，chứa ${walls.south}。

**\u53f3\u4e0a（\u80cc\u9762\u89c6\u56fe）：**
${anchor} của\u80cc\u9762\u76f4\u89c6Cảnh quay。hiển thị\u540e\u90e8\u7ed3\u6784。Nền\u662f\u7269\u4f53\u9762\u5411của\u5899\u58c1，chứa ${walls.north}。

**\u5de6\u4e0b（\u5de6\u4fa7\u89c6\u56fe）：**
từ\u5de6Bắn bên\u6444của ${anchor} \u4fa7\u9762Cảnh quay。Nền\u662f\u5bf9\u9762của\u5899\u58c1，\u4e25\u683cchứa ${walls.east}。

**\u53f3\u4e0b（\u53f3\u4fa7\u89c6\u56fe）：**
từ\u53f3Bắn bên\u6444của ${anchor} \u4fa7\u9762Cảnh quay。Nền\u662f\u5bf9\u9762của\u5899\u58c1，\u4e25\u683cchứa ${walls.west}。

sử dụngbằng phẳng、trong\u6027của\u7535\u5f71\u5149\u7167\u4ee5\u786e\u4fdd\u7eb9\u7406\u53ef\u89c1。không cóNhân vật，\u7a7aCảnh。`;

    setOrthographicPrompt(promptEn);
    setOrthographicPromptZh(promptZh);
    toast.success("bốn\u89c6\u56fePromptĐã Tạo");
  };

  /**
   * Tạobốn\u89c6\u56feHình ảnh
   */
  const handleGenerateOrthographicImage = async () => {
    if (!orthographicPrompt) {
      toast.error("\u8bf7đầu tiênTạoPrompt");
      return;
    }

    const featureConfig = getFeatureConfig('character_generation');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('character_generation'));
      return;
    }

    setIsGeneratingOrthographic(true);
    setOrthographicProgress(0);

    try {
      const stylePreset = getStyleById(styleId);
      const isRealistic = stylePreset?.category === 'real';
      const negativePrompt = isRealistic
        ? 'blurry, low quality, watermark, text, people, characters, anime, cartoon, distorted grid, uneven panels, asymmetric'
        : 'blurry, low quality, watermark, text, people, characters, distorted grid, uneven panels, asymmetric';

      setOrthographicProgress(20);

      // Thu thậpHình ảnh tham khảo：Ưu tiênsử dụng「Toàn cảnh」\u5b50Cảnh，thay vì\u6574\u5f20\u8054\u5408\u56fe
      const rawRefs: string[] = [];
      
      // 1. \u5c1d\u8bd5\u83b7\u53d6「Toàn cảnh」\u5b50CảH của nhình ảnh（ưu tiên cao nhất）
      let overviewImage: string | null = null;
      
      if (selectedScene?.parentSceneId) {
        const { scenes } = useSceneStore.getState();
        const overviewScene = scenes.find(s => 
          s.parentSceneId === selectedScene.parentSceneId && 
          (s as any).viewpointId === 'overview'
        );
        if (overviewScene?.referenceImage) {
          overviewImage = overviewScene.referenceImage;
          console.log('[Orthographic] tìm thấyToàn cảnh\u5b50Cảnh để tham khảo');
        }
        
        if (!overviewImage) {
          const overviewByName = scenes.find(s => 
            s.parentSceneId === selectedScene.parentSceneId && 
            (s.name?.includes('Toàn cảnh') || (s as any).viewpointName === 'Toàn cảnh')
          );
          if (overviewByName?.referenceImage) {
            overviewImage = overviewByName.referenceImage;
            console.log('[Orthographic] \u6309Têntìm thấyToàn cảnh\u5b50Cảnh');
          }
        }
      }
      
      if (overviewImage) {
        rawRefs.push(overviewImage);
        console.log('[Orthographic] sử dụngToàn cảnh\u5b50Cảnh\u4f5cchoChúa ơiTài liệu tham khảo');
      }
      
      // 2. Thêmhiện tại\u9009Trung bình CảnhHình ảnh tham khảo
      if (selectedScene?.referenceImage && selectedScene.referenceImage !== overviewImage) {
        rawRefs.push(selectedScene.referenceImage);
        console.log('[Orthographic] Thêm\u5b50CảnhHình ảnh\u4f5cchophụ trợTài liệu tham khảo');
      }

      // \u5c06 local-image:// \u8f6c\u6362cho base64 \u4ee5\u4f20\u7ed9 API
      const referenceImages: string[] = [];
      for (const ref of rawRefs) {
        if (ref.startsWith('local-image://')) {
          const base64 = await readImageAsBase64(ref);
          if (base64) referenceImages.push(base64);
        } else {
          referenceImages.push(ref);
        }
      }

      const result = await generateSceneImageAPI({
        prompt: orthographicPrompt,
        negativePrompt,
        aspectRatio: orthographicAspectRatio,
        styleId,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      });

      setOrthographicProgress(100);
      setOrthographicImage(result.imageUrl);
      toast.success("bốn\u89c6\u56feTạoThành công，\u53ef\u4ee5\u8fdbđược rồi\u5207\u5272");
    } catch (error) {
      const err = error as Error;
      console.error('[Orthographic] TạoThất bại:', err);
      toast.error(`TạoThất bại: ${err.message}`);
    } finally {
      setIsGeneratingOrthographic(false);
      setOrthographicProgress(0);
    }
  };

  /**
   * Tải lênbốn\u89c6\u56fe（dự phòng）
   */
  const handleUploadOrthographic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setOrthographicImage(dataUrl);
      toast.success("bốn\u89c6\u56feĐã Tải lên，\u53ef\u4ee5\u8fdbđược rồi\u5207\u5272");
    };
    reader.readAsDataURL(file);
  };

  /**
   * \u5207\u5272bốn\u89c6\u56fe (2x2)
   */
  const handleSplitOrthographic = async () => {
    if (!orthographicImage) {
      toast.error("\u8bf7đầu tiênTạohoặcTải lênbốn\u89c6\u56fe");
      return;
    }

    setIsSplitting(true);
    try {
      // 2x2 \u5207\u5272，Hỗ trợ 16:9 hoặc 9:16
      const splitResults = await splitStoryboardImage(orthographicImage, {
        aspectRatio: orthographicAspectRatio, // sử dụngNgười dùng\u9009\u62e9của\u5bbd\u9ad8\u6bd4
        resolution: '2K',
        sceneCount: 4,
        options: {
          expectedRows: 2,
          expectedCols: 2,
          filterEmpty: false,
          edgeMarginPercent: 0.02,
        },
      });

      // \u6620\u5c04ĐếnbốnGóc nhìn: \u5de6\u4e0a=phía trước, \u53f3\u4e0a=\u80cc\u9762, \u5de6\u4e0b=\u5de6\u4fa7, \u53f3\u4e0b=\u53f3\u4fa7
      const viewMap: { front: string | null; back: string | null; left: string | null; right: string | null } = {
        front: null,
        back: null,
        left: null,
        right: null,
      };

      for (const sr of splitResults) {
        if (sr.row === 0 && sr.col === 0) viewMap.front = sr.dataUrl;
        if (sr.row === 0 && sr.col === 1) viewMap.back = sr.dataUrl;
        if (sr.row === 1 && sr.col === 0) viewMap.left = sr.dataUrl;
        if (sr.row === 1 && sr.col === 1) viewMap.right = sr.dataUrl;
      }

      setOrthographicViews(viewMap);
      toast.success("Đã rồi\u5207\u5272cho 4 Góc nhìnHình ảnh");
    } catch (error) {
      console.error('[Orthographic] \u5207\u5272Thất bại:', error);
      toast.error("\u5207\u5272Thất bại，\u8bf7\u68c0\u67e5Hình ảnhĐịnh dạng");
    } finally {
      setIsSplitting(false);
    }
  };

  /**
   * Lưubốn\u89c6\u56feĐếnCảnh
   */
  const handleSaveOrthographicViews = async () => {
    if (!selectedScene) {
      toast.error("\u8bf7đầu tiên\u9009\u62e9Cảnh");
      return;
    }

    const { front, back, left, right } = orthographicViews;
    if (!front && !back && !left && !right) {
      toast.error("\u6ca1Có\u53efLưucủaGóc nhìnHình ảnh");
      return;
    }

    const parentSceneName = selectedScene.name || selectedScene.location;
    const createdIds: string[] = [];
    const viewLabels = [
      { key: 'front', name: 'phía trước', nameEn: 'Front View', image: front },
      { key: 'back', name: '\u80cc\u9762', nameEn: 'Back View', image: back },
      { key: 'left', name: '\u5de6\u4fa7', nameEn: 'Left View', image: left },
      { key: 'right', name: '\u53f3\u4fa7', nameEn: 'Right View', image: right },
    ];

    for (const view of viewLabels) {
      if (!view.image) continue;
      
      const variantName = `${parentSceneName}-${view.name}`;
      const safeName = variantName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
      const localPath = await saveImageToLocal(
        view.image,
        'scenes',
        `${safeName}_${Date.now()}.png`
      );
      const variantId = addScene({
        name: variantName,
        location: selectedScene.location,
        time: selectedScene.time || 'day',
        atmosphere: selectedScene.atmosphere || 'peaceful',
        visualPrompt: selectedScene.visualPrompt,
        referenceImage: localPath,
        styleId: selectedScene.styleId || styleId,
        folderId: selectedScene.folderId,
        projectId: selectedScene.projectId ?? resourceProjectId ?? undefined,
        tags: selectedScene.tags,
        parentSceneId: selectedScene.id,
        viewpointId: view.key,
        viewpointName: view.name,
        isViewpointVariant: true,
      } as any);
      
      // \u540c\u6b65\u5f52\u6863ĐếnChất liệu\u5e93
      const orthoAiFolder = getOrCreateCategoryFolder('ai-image');
      addMediaFromUrl({
        url: localPath,
        name: `Cảnh-${variantName}`,
        type: 'image',
        source: 'ai-image',
        folderId: orthoAiFolder,
        projectId: selectedScene.projectId ?? resourceProjectId ?? undefined,
      });

      createdIds.push(variantId);
    }

    // Lưubốn\u89c6\u56fe\u539f\u56feĐếnPhụ huynh Cảnh
    updateScene(selectedScene.id, {
      orthographicImage,
    } as any);

    toast.success(`Đã Tạo ${createdIds.length} một\u6b63\u4ea4Góc nhìnCảnh`);
    
    // \u6e05\u7a7aTrạng thái
    setOrthographicPrompt(null);
    setOrthographicPromptZh(null);
    setOrthographicImage(null);
    setOrthographicViews({ front: null, back: null, left: null, right: null });
  };

  /**
   * Huỷbốn\u89c6\u56feThao tác
   */
  const handleCancelOrthographic = () => {
    setOrthographicPrompt(null);
    setOrthographicPromptZh(null);
    setOrthographicImage(null);
    setOrthographicViews({ front: null, back: null, left: null, right: null });
  };

  /**
   * \u590d\u5236bốn\u89c6\u56fePrompt
   */
  const handleCopyOrthographicPrompt = (isEnglish: boolean) => {
    const prompt = isEnglish ? orthographicPrompt : orthographicPromptZh;
    if (!prompt) return;
    
    const stylePreset = getStyleById(styleId);
    const styleName = stylePreset?.name || styleId;
    
    const fullPrompt = isEnglish
      ? `=== Orthographic View Settings ===\nStyle: ${styleName}\nAspect Ratio: ${orthographicAspectRatio}\nGrid Layout: 2x2\n\n=== Prompt ===\n${prompt}`
      : `=== bốn\u89c6\u56feCài đặt ===\nTầm nhìn Phong cách: ${styleName}\n\u5bbd\u9ad8\u6bd4: ${orthographicAspectRatio}\nbố trí lưới: 2x2\n\n=== Prompt ===\n${prompt}`;
    
    navigator.clipboard.writeText(fullPrompt);
    toast.success(isEnglish ? "Tiếng AnhNhắcĐã rồi\u590d\u5236" : "Lời nhắc tiếng TrungĐã rồi\u590d\u5236");
  };

  // ========== bốn\u89c6\u56fe UI ==========
  if (orthographicPrompt) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 pb-2 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            <h3 className="font-medium text-sm">bốn\u89c6\u56fe（\u6b63\u4ea4\u89c6\u56fe）</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancelOrthographic}>
            Huỷ
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-4">
            {/* Tầm nhìn Phong cách + \u5bbd\u9ad8\u6bd4 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Tầm nhìn Phong cách</Label>
                <StylePicker
                  value={styleId}
                  onChange={(id) => setStyleId(id)}
                  disabled={isGeneratingOrthographic}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">\u5bbd\u9ad8\u6bd4</Label>
                <Select value={orthographicAspectRatio} onValueChange={(v) => setOrthographicAspectRatio(v as '16:9' | '9:16')} disabled={isGeneratingOrthographic}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 \u6a2a\u5c4f</SelectItem>
                    <SelectItem value="9:16">9:16 \u7ad6\u5c4f</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Góc nhìnGiải thích */}
            <div className="space-y-2">
              <Label className="text-xs">Góc nhìnBố cục (2x2)</Label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="p-2 rounded border bg-muted/50 text-center">
                  <span className="font-medium">phía trước</span>
                  <span className="text-muted-foreground block">Front View</span>
                </div>
                <div className="p-2 rounded border bg-muted/50 text-center">
                  <span className="font-medium">\u80cc\u9762</span>
                  <span className="text-muted-foreground block">Back View</span>
                </div>
                <div className="p-2 rounded border bg-muted/50 text-center">
                  <span className="font-medium">\u5de6\u4fa7</span>
                  <span className="text-muted-foreground block">Left Profile</span>
                </div>
                <div className="p-2 rounded border bg-muted/50 text-center">
                  <span className="font-medium">\u53f3\u4fa7</span>
                  <span className="text-muted-foreground block">Right Profile</span>
                </div>
              </div>
            </div>

            {/* Hình ảnh tham khảoXem trước（\u81ea\u52a8\u83b7\u53d6） */}
            {(() => {
              // Tính toánHình ảnh tham khảo：Ưu tiênsử dụng「Toàn cảnh」\u5b50Cảnh
              const referenceImages: { label: string; src: string }[] = [];
              
              // 1. \u67e5\u627e「Toàn cảnh」\u5b50Cảnh（ưu tiên cao nhất）
              let overviewImage: string | null = null;
              if (selectedScene?.parentSceneId) {
                const { scenes } = useSceneStore.getState();
                // \u67e5\u627e\u540cmộtPhụ huynh CảnhTất cả\u5b50Cảnh，\u627e viewpointId='overview' của\u90a3một
                const overviewScene = scenes.find(s => 
                  s.parentSceneId === selectedScene.parentSceneId && 
                  (s as any).viewpointId === 'overview'
                );
                if (overviewScene?.referenceImage) {
                  overviewImage = overviewScene.referenceImage;
                } else if (overviewScene?.referenceImageBase64) {
                  overviewImage = overviewScene.referenceImageBase64;
                }
                // Chẳng hạn như\u679c\u627e\u4e0dĐến，\u5c1d\u8bd5\u6309Têntrận đấu
                if (!overviewImage) {
                  const overviewByName = scenes.find(s => 
                    s.parentSceneId === selectedScene.parentSceneId && 
                    (s.name?.includes('Toàn cảnh') || (s as any).viewpointName === 'Toàn cảnh')
                  );
                  if (overviewByName?.referenceImage) {
                    overviewImage = overviewByName.referenceImage;
                  }
                }
              }
              if (overviewImage) {
                referenceImages.push({ label: 'Toàn cảnh tham khảo', src: overviewImage });
              }
              
              // 2. hiện tại\u5b50CảnhHình ảnh
              if (selectedScene?.referenceImage && selectedScene.referenceImage !== overviewImage) {
                referenceImages.push({ label: 'hiện tạiGóc nhìn', src: selectedScene.referenceImage });
              } else if (selectedScene?.referenceImageBase64 && selectedScene.referenceImageBase64 !== overviewImage) {
                referenceImages.push({ label: 'hiện tạiGóc nhìn', src: selectedScene.referenceImageBase64 });
              }
              
              if (referenceImages.length === 0) return null;
              
              return (
                <div className="space-y-2">
                  <Label className="text-xs">Hình ảnh tham khảo（\u81ea\u52a8\u83b7\u53d6）</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {referenceImages.map((ref, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="relative rounded overflow-hidden border bg-muted aspect-video">
                          <img 
                            src={ref.src} 
                            alt={ref.label}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 text-center">
                            {ref.label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    💡 sử dụng「Toàn cảnh」\u5b50Cảnh\u4f5cchoChúa ơiTài liệu tham khảo，\u786e\u4fddbốn\u89c6\u56fePhong cáchmột\u81f4
                  </p>
                </div>
              );
            })()}

            {/* Tạo\u6309\u94ae */}
            {!orthographicImage && (
              <div className="space-y-2">
                <Button 
                  onClick={handleGenerateOrthographicImage} 
                  className="w-full"
                  disabled={isGeneratingOrthographic}
                >
                  {isGeneratingOrthographic ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Tạotrong... {orthographicProgress}%
                    </>
                  ) : (
                    <>
                      <Box className="h-4 w-4 mr-2" />
                      Tạobốn\u89c6\u56fe
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">hoặc</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadOrthographic}
                    className="hidden"
                    disabled={isGeneratingOrthographic}
                  />
                  <div className="flex items-center justify-center gap-2 p-2 border border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                    <Upload className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tải lênĐã rồiCóHình ảnh</span>
                  </div>
                </label>
              </div>
            )}

            {/* Prompt（Mặc địnhMở rộng，Cán Chỉnh sửa，\u6839\u636engôn ngữ\u504f\u597d\u53ea\u663e\u793amột\u79cd） */}
            <details className="group" open>
              <summary className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                bốn\u89c6\u56fePrompt（Cán Chỉnh sửa，Sửa\u540e\u76f4\u63a5cho Tạo）
              </summary>
              <div className="mt-2 space-y-2">
                {(() => {
                  const effectiveLang = promptLanguage || scriptProject?.promptLanguage || 'zh';
                  const isZh = effectiveLang === 'zh' || effectiveLang === 'zh+en';
                  const langLabel = isZh ? 'Tiếng Trung' : 'English';
                  const currentValue = isZh
                    ? (orthographicPromptZh || orthographicPrompt || '')
                    : (orthographicPrompt || orthographicPromptZh || '');
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">TạoPrompt（{langLabel}，Sửa\u540e\u76f4\u63a5cho Tạo）</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-2 text-xs"
                          onClick={() => handleCopyOrthographicPrompt(isZh ? false : true)}
                        >
                          <Copy className="h-3 w-3 mr-1" />\u590d\u5236
                        </Button>
                      </div>
                      <Textarea
                        value={currentValue}
                        onChange={(e) => {
                          if (isZh) {
                            setOrthographicPromptZh(e.target.value);
                            // \u540c\u6b65Cập nhật\u5b9e\u9645\u53d1\u9001củaPrompt
                            setOrthographicPrompt(e.target.value);
                          } else {
                            setOrthographicPrompt(e.target.value);
                          }
                        }}
                        className="min-h-[200px] text-xs resize-y"
                      />
                    </div>
                  );
                })()}
              </div>
            </details>

            {/* bốn\u89c6\u56feXem trước */}
            {orthographicImage && (
              <div className="space-y-2">
                <Label className="text-xs">bốn\u89c6\u56feXem trước ({orthographicAspectRatio})</Label>
                <div className={`relative rounded-lg overflow-hidden border bg-muted ${orthographicAspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'}`}>
                  <img 
                    src={orthographicImage} 
                    alt="bốn\u89c6\u56feXem trước"
                    className="w-full h-full object-contain"
                  />
                </div>
                <Button 
                  onClick={handleSplitOrthographic} 
                  className="w-full" 
                  disabled={isSplitting}
                >
                  {isSplitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      \u5207\u5272trong...
                    </>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 mr-2" />
                      \u5207\u5272cho 4 Góc nhìn
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* \u5207\u5272kết quảXem trước */}
            {(orthographicViews.front || orthographicViews.back || orthographicViews.left || orthographicViews.right) && (
              <div className="space-y-2">
                <Label className="text-xs">\u5207\u5272kết quả</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'front', name: 'phía trước', image: orthographicViews.front },
                    { key: 'back', name: '\u80cc\u9762', image: orthographicViews.back },
                    { key: 'left', name: '\u5de6\u4fa7', image: orthographicViews.left },
                    { key: 'right', name: '\u53f3\u4fa7', image: orthographicViews.right },
                  ].map((view) => (
                    <div key={view.key} className="space-y-1">
                      <div className={`relative rounded overflow-hidden border bg-muted ${orthographicAspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'}`}>
                        {view.image ? (
                          <img 
                            src={view.image} 
                            alt={view.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-center text-muted-foreground">
                        {view.name}
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={handleSaveOrthographicViews} className="w-full">
                  <Check className="h-4 w-4 mr-2" />
                  LưuGóc nhìnHình ảnhĐếnCảnh
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            💡 bốn\u89c6\u56fe\u53ef\u4fdd\u8bc1Cảnh ở trong\u4e0d\u540cGóc máy\u4e0bcủa\u7a7a\u95f4một\u81f4\u6027
          </p>
        </div>
      </div>
    );
  }

  // If showing contact sheet mode
  if (contactSheetPrompt) {
    const totalPages = pendingContactSheetPrompts.length;
    const hasMultiplePages = totalPages > 1;
    
    // \u83b7\u53d6hiện tại\u9875củaGóc nhìdữ liệu（\u5e26Phân cảsố sê-ri）
    const currentPageViewpointsWithIndexes = pendingViewpoints
      .filter(v => v.pageIndex === currentPageIndex)
      .sort((a, b) => a.gridIndex - b.gridIndex);
    
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 pb-2 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">Nhiều Góc nhìđồ thị chung</h3>
            {hasMultiplePages && (
              <span className="text-xs text-muted-foreground">
                ({currentPageIndex + 1}/{totalPages})
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancelContactSheet}>
            Huỷ
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-4">
            {/* Phân trang\u63a7\u5236 */}
            {hasMultiplePages && (
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPageIndex === 0}
                  onClick={() => {
                    const newIndex = currentPageIndex - 1;
                    setCurrentPageIndex(newIndex);
                    const page = pendingContactSheetPrompts[newIndex];
                    setContactSheetPrompt(page.prompt);
                    setContactSheetPromptZh(page.promptZh);
                    setContactSheetImage(null);
                    setSplitViewpointImages({});
                  }}
                >
                  \u4e0amột\u9875
                </Button>
                <span className="text-xs">
                  \u8054\u5408\u56fe {currentPageIndex + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPageIndex >= totalPages - 1}
                  onClick={() => {
                    const newIndex = currentPageIndex + 1;
                    setCurrentPageIndex(newIndex);
                    const page = pendingContactSheetPrompts[newIndex];
                    setContactSheetPrompt(page.prompt);
                    setContactSheetPromptZh(page.promptZh);
                    setContactSheetImage(null);
                    setSplitViewpointImages({});
                  }}
                >
                  \u4e0bmột\u9875
                </Button>
              </div>
            )}
            
            {/* Tầm nhìn Phong cách + \u5bbd\u9ad8\u6bd4 + Bố cục\u9009\u62e9 */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Tầm nhìn Phong cách</Label>
                  <StylePicker
                    value={styleId}
                    onChange={(id) => setStyleId(id)}
                    disabled={isGeneratingContactSheet}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">\u5bbd\u9ad8\u6bd4</Label>
                  <Select value={contactSheetAspectRatio} onValueChange={(v) => setContactSheetAspectRatio(v as '16:9' | '9:16')} disabled={isGeneratingContactSheet}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 \u6a2a\u5c4f</SelectItem>
                      <SelectItem value="9:16">9:16 \u7ad6\u5c4f</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Bố cục\u9009\u62e9 */}
              <div className="space-y-2">
                <Label className="text-xs">bố trí lưới</Label>
                <Select value={contactSheetLayout} onValueChange={(v) => handleContactSheetLayoutChange(v as ContactSheetLayout)} disabled={isGeneratingContactSheet}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2x2">2×2 (4\u683c)</SelectItem>
                    <SelectItem value="3x3">3×3 (9\u683c)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {(() => {
                    const dims = getLayoutDimensions(contactSheetLayout, contactSheetAspectRatio);
                    return `${dims.rows}được rồi${dims.cols}Cột = ${dims.rows * dims.cols}\u683c`;
                  })()}
                </p>
              </div>
            </div>
            
            {/* Góc nhìnDanh sách（\u663e\u793a\u5173\u8054Phân cảsố sê-ri） */}
            <div className="space-y-2">
              <Label className="text-xs">
                hiện tại\u9875Góc nhìn ({currentPageViewpointsWithIndexes.length > 0 ? currentPageViewpointsWithIndexes.length : extractedViewpoints.length})
              </Label>
              <div className="space-y-1.5">
                {(currentPageViewpointsWithIndexes.length > 0 ? currentPageViewpointsWithIndexes : extractedViewpoints).map((vp, idx) => {
                  const vpWithIndexes = vp as PendingViewpointData;
                  const shotIndexes = vpWithIndexes.shotIndexes || [];
                  
                  return (
                    <div 
                      key={vp.id} 
                      className="flex items-center gap-2 p-2 rounded border bg-muted/50 text-xs"
                    >
                      <span className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center font-medium shrink-0">
                        {('gridIndex' in vp ? vp.gridIndex : idx) + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{vp.name}</div>
                        <div className="text-muted-foreground truncate">
                          {vp.keyProps.join('、') || 'Mặc địnhGóc nhìn'}
                        </div>
                      </div>
                      {shotIndexes.length > 0 && (
                        <div className="text-muted-foreground text-right shrink-0">
                          <div className="text-[10px]">Phân cảnh</div>
                          <div>#{shotIndexes.map(i => String(i).padStart(2, '0')).join(',#')}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* một\u952eTạo\u8054\u5408\u56fe（Tự động Tạo→\u5207\u5272→Lưu） */}
            {!contactSheetImage && (
              <div className="space-y-2">
                <Button 
                  onClick={handleAutoGenerateContactSheet} 
                  className="w-full"
                  disabled={isGeneratingContactSheet}
                >
                  {isGeneratingContactSheet ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Tạotrong... {contactSheetProgress}%
                    </>
                  ) : (
                    <>
                      <Grid3X3 className="h-4 w-4 mr-2" />
                      Tạo\u8054\u5408\u56fe（\u81ea\u52a8\u5207\u5272\u5e76Lưu）
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">hoặc</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadContactSheet}
                    className="hidden"
                    disabled={isGeneratingContactSheet}
                  />
                  <div className="flex items-center justify-center gap-2 p-2 border border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                    <Upload className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tải lênĐã rồiCóHình ảnh</span>
                  </div>
                </label>
              </div>
            )}

            {/* Prompt（Mặc địnhMở rộng，Cán Chỉnh sửa，\u6839\u636engôn ngữ\u504f\u597d\u53ea\u663e\u793amột\u79cd） */}
            <details className="group" open>
              <summary className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                Biểu đồ công đoàn（Cán Chỉnh sửa，Sửa\u540e\u76f4\u63a5cho Tạo）
              </summary>
              <div className="mt-2 space-y-2">
                {(() => {
                  const effectiveLang = promptLanguage || scriptProject?.promptLanguage || 'zh';
                  const isZh = effectiveLang === 'zh' || effectiveLang === 'zh+en';
                  const langLabel = isZh ? 'Tiếng Trung' : 'English';
                  const currentValue = isZh
                    ? (contactSheetPromptZh || contactSheetPrompt || '')
                    : (contactSheetPrompt || contactSheetPromptZh || '');
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">TạoPrompt（{langLabel}，Sửa\u540e\u76f4\u63a5cho Tạo）</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-2 text-xs"
                          onClick={() => handleCopyPrompt(isZh ? false : true)}
                        >
                          <Copy className="h-3 w-3 mr-1" />\u590d\u5236
                        </Button>
                      </div>
                      <Textarea
                        value={currentValue}
                        onChange={(e) => {
                          if (isZh) {
                            setContactSheetPromptZh(e.target.value);
                            // \u540c\u6b65Cập nhật\u5b9e\u9645\u53d1\u9001củaPrompt
                            setContactSheetPrompt(e.target.value);
                          } else {
                            setContactSheetPrompt(e.target.value);
                          }
                        }}
                        className="min-h-[200px] text-xs resize-y"
                      />
                    </div>
                  );
                })()}
              </div>
            </details>

            {/* \u8054\u5408\u56feXem trước */}
            {contactSheetImage && (
              <div className="space-y-2">
                <Label className="text-xs">\u8054\u5408\u56feXem trước</Label>
                <div className="relative rounded-lg overflow-hidden border bg-muted">
                  <img 
                    src={contactSheetImage} 
                    alt="\u8054\u5408\u56feXem trước"
                    className="w-full h-auto"
                  />
                </div>
                <Button 
                  onClick={handleSplitContactSheet} 
                  className="w-full" 
                  disabled={isSplitting}
                >
                  {isSplitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      \u5207\u5272trong...
                    </>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 mr-2" />
                      \u5207\u5272cho {(() => {
                        const currentPageVps = pendingViewpoints.filter(v => v.pageIndex === currentPageIndex);
                        return currentPageVps.length > 0 ? currentPageVps.length : extractedViewpoints.length || 6;
                      })()} Góc nhìn
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* \u5207\u5272kết quảXem trước */}
            {Object.keys(splitViewpointImages).length > 0 && (() => {
              // Ưu tiênsử dụng pendingViewpoints，\u5426\u5219sử dụng extractedViewpoints
              const currentPageVps = pendingViewpoints.filter(v => v.pageIndex === currentPageIndex);
              const viewpointsToDisplay = currentPageVps.length > 0 ? currentPageVps : extractedViewpoints;
              
              // \u6839\u636e\u5bbd\u9ad8\u6bd4\u51b3\u5b9a\u5207\u5272kết quảcủa\u663e\u793aTỷ lệ
              const aspectClass = contactSheetAspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video';
              // 9:16 \u7ad6\u5c4f\u65f6sử dụng 2 Cột，16:9 \u6a2a\u5c4f\u65f6sử dụng 3 Cột
              const gridCols = contactSheetAspectRatio === '9:16' ? 'grid-cols-2' : 'grid-cols-3';
              
              return (
                <div className="space-y-2">
                  <Label className="text-xs">\u5207\u5272kết quả ({contactSheetAspectRatio})</Label>
                  <div className={`grid ${gridCols} gap-2`}>
                    {viewpointsToDisplay.map((vp) => {
                      const imgData = splitViewpointImages[vp.id];
                      return (
                        <div key={vp.id} className="space-y-1">
                          <div className={`relative ${aspectClass} rounded overflow-hidden border bg-muted`}>
                            {imgData ? (
                              <img 
                                src={imgData.imageUrl} 
                                alt={vp.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-center text-muted-foreground truncate">
                            {vp.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button onClick={handleSaveViewpointImages} className="w-full">
                    <Check className="h-4 w-4 mr-2" />
                    LưuGóc nhìnHình ảnhĐếnCảnh
                  </Button>
                </div>
              );
            })()}
          </div>
        </ScrollArea>

        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            💡 \u70b9\u51fb「Tạo\u8054\u5408\u56fe」\u540e\u81ea\u52a8Hoàn thành\u5207\u5272vàLưu，\u53ef\u8fde\u7eed\u53d1\u8d77\u591amộtNhiệm vụ
          </p>
        </div>
      </div>
    );
  }

  // If showing preview
  if (previewUrl) {
    return (
      <div className="h-full flex flex-col p-3">
        <h3 className="font-medium text-sm mb-3">Xem trướcCảbản đồ khái niệm nh</h3>
        <ScrollArea className="flex-1">
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden border-2 border-amber-500/50 bg-muted">
              <img 
                src={previewUrl} 
                alt="Cảbản đồ khái niệm nhXem trước"
                className="w-full h-auto"
              />
              <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded">
                Xem trước
              </div>
            </div>
            <Button onClick={handleSavePreview} className="w-full">
              <Check className="h-4 w-4 mr-2" />
              Lưukhái niệm\u56fe
            </Button>
            <Button onClick={handleGenerate} variant="outline" className="w-full" disabled={isGenerating}>
              <RotateCcw className="h-4 w-4 mr-2" />
              \u91cd\u65b0Tạo
            </Button>
            <Button onClick={handleDiscardPreview} variant="ghost" className="w-full text-muted-foreground" size="sm">
              \u653e\u5f03\u5e76Quay lại
            </Button>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 pb-2 border-b space-y-2">
        <h3 className="font-medium text-sm">Tạo\u63a7\u5236\u53f0</h3>
        {/* Tạomode\u5207\u6362 */}
        <ToggleGroup 
          type="single" 
          value={generationMode} 
          onValueChange={(v) => v && setGenerationMode(v as GenerationMode)}
          className="justify-start"
        >
          <ToggleGroupItem value="single" aria-label="\u5355\u56fe" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <ImageIcon className="h-3 w-3 mr-1" />
            \u5355\u56fe
          </ToggleGroupItem>
          <ToggleGroupItem value="contact-sheet" aria-label="\u8054\u5408\u56fe" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Grid3X3 className="h-3 w-3 mr-1" />
            \u8054\u5408\u56fe
          </ToggleGroupItem>
          <ToggleGroupItem value="orthographic" aria-label="bốn\u89c6\u56fe" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Box className="h-3 w-3 mr-1" />
            bốn\u89c6\u56fe
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {/* Scene name */}
          <div className="space-y-2">
            <Label className="text-xs">CảnhTên</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ：thành phốđường phố、rừng\u5c0f\u5c4b"
              disabled={isGenerating}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-xs">Vị trí Mô tả</Label>
            <Textarea
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Chi tiếtMô tảCảnhmôi trường，Ví dụ：truyền thống\u534ecủa\u4e1c\u4eac\u6da9\u8c37ngã tư，đèn neon\u706f\u95ea\u70c1..."
              className="min-h-[100px] text-sm resize-none"
              disabled={isGenerating}
            />
          </div>

          {/* Time and Atmosphere */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">Thời gian</Label>
              <Select value={time} onValueChange={setTime} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder="\u9009\u62e9" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PRESETS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">bầu không khí</Label>
              <Select value={atmosphere} onValueChange={setAtmosphere} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder="\u9009\u62e9" />
                </SelectTrigger>
                <SelectContent>
                  {ATMOSPHERE_PRESETS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Style */}
          <div className="space-y-2">
            <Label className="text-xs">Tầm nhìn Phong cách</Label>
            <StylePicker
              value={styleId}
              onChange={(id) => setStyleId(id)}
              disabled={isGenerating}
            />
          </div>

          {/* Reference images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Tài liệu tham khảoHình ảnh</Label>
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
                    onClick={() => removeRefImage(i)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {referenceImages.length < 3 && (
                <>
                  <input
                    id="scene-gen-ref-image"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleRefImageChange}
                  />
                  <div
                    className="w-14 h-14 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors gap-1 cursor-pointer"
                    onClick={() => document.getElementById('scene-gen-ref-image')?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-[10px]">Tải lên</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              AI \u5c06Tài liệu tham khảo\u8fd9\u4e9bHình ảnhTạoCảbản đồ khái niệm nh
            </p>
          </div>
        </div>
      </ScrollArea>

      {/* Action buttons */}
      <div className="p-3 border-t space-y-2">
        {/* lô\u91cfbốn\u89c6\u56fe\u6309\u94ae（\u5728Lưu\u8054\u5408\u56feGóc nhìn\u540e\u663e\u793a） */}
        {savedChildSceneIds.length > 0 && (
          <div className="p-3 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 space-y-2">
            <div className="text-xs text-center">
              <span className="font-medium">Đã Lưu {savedChildSceneIds.length} một\u5b50Cảnh</span>
              <p className="text-muted-foreground">\u53efcho\u6bcfmột\u5b50CảnhTạobốn\u89c6\u56fe（tổng cộng {savedChildSceneIds.length * 4} \u5f20）</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleBatchGenerateOrthographic} 
                className="flex-1"
                size="sm"
              >
                <Box className="h-3 w-3 mr-1" />
                Lô Tạobốn\u89c6\u56fe
              </Button>
              <Button 
                onClick={handleClearBatchOrthographic} 
                variant="ghost"
                size="sm"
              >
                bỏ qua
              </Button>
            </div>
          </div>
        )}
        
        {/* \u5355\u56fechế độ */}
        {generationMode === 'single' && (
          !selectedScene ? (
            <Button onClick={handleCreateScene} className="w-full" disabled={!name.trim() || !location.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              TạoCảnh
            </Button>
          ) : (
            <Button 
              onClick={handleGenerate} 
              className="w-full"
              disabled={isGenerating || !location.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Tạotrong...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  {selectedScene.referenceImage ? '\u91cd\u65b0Tạokhái niệm\u56fe' : 'TạoCảbản đồ khái niệm nh'}
                </>
              )}
            </Button>
          )
        )}
        
        {/* \u8054\u5408\u56fechế độ - không có\u8bba\u662f\u5426\u9009Trung bình Cảnh\u90fd\u663e\u793aTải lên\u9009\u9879 */}
        {generationMode === 'contact-sheet' && (
          <div className="space-y-2">
            {/* Bố cục\u9009\u62e9\u5668 */}
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">bố trí lưới</Label>
              <Select value={contactSheetLayout} onValueChange={(v) => setContactSheetLayout(v as ContactSheetLayout)} disabled={isGenerating}>
                <SelectTrigger className="h-8 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2x2">2×2 (4\u683c)</SelectItem>
                  <SelectItem value="3x3">3×3 (9\u683c)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedScene ? (
              <Button 
                onClick={handleGenerateContactSheetPrompt} 
                className="w-full"
                disabled={isGenerating}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                TạoNhiều Góc nhìđồ thị chung
              </Button>
            ) : (
              <Button onClick={handleCreateScene} className="w-full" disabled={!name.trim() || !location.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                TạoCảnh
              </Button>
            )}
            {/* hoặc\u76f4\u63a5Tải lên */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">hoặc</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleDirectUploadContactSheet}
                className="hidden"
                disabled={isGenerating}
              />
              <div className="flex items-center justify-center gap-2 p-2 border border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                <Upload className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">\u76f4\u63a5Tải lêđồ thị chung\u5207\u5272</span>
              </div>
            </label>
          </div>
        )}
        
        {/* bốn\u89c6\u56fechế độ */}
        {generationMode === 'orthographic' && (
          !selectedScene ? (
            <Button onClick={handleCreateScene} className="w-full" disabled={!name.trim() || !location.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              TạoCảnh
            </Button>
          ) : (
            <Button 
              onClick={handleGenerateOrthographicPrompt} 
              className="w-full"
              disabled={isGenerating}
            >
              <Box className="h-4 w-4 mr-2" />
              Tạobốn\u89c6\u56fe
            </Button>
          )
        )}
        <p className="text-xs text-muted-foreground text-center">
          {generationMode === 'single' && '💡 \u5355\u56fechế độ：Tạo\u5355mộtGóc nhìnCảbản đồ khái niệm nh'}
          {generationMode === 'contact-sheet' && '💡 \u8054\u5408\u56fechế độ：Tạo 2x3 Nhiều Góc nhìnCảnh\u7f51\u683c'}
          {generationMode === 'orthographic' && '💡 bốn\u89c6\u56fechế độ：Tạo\u524d/\u540e/\u5de6/\u53f3\u6b63\u4ea4Góc nhìn'}
        </p>
      </div>
    </div>
  );
}

// Helper functions
function buildScenePrompt(
  scene: Partial<Scene> & { styleId?: string },
  actionDescriptions?: string[]
): string {
  const stylePreset = scene.styleId ? getStyleById(scene.styleId) : null;
  const styleTokens = stylePreset?.prompt || 'anime style';

  const timePreset = TIME_PRESETS.find(t => t.id === scene.time);
  const timePrompt = timePreset?.prompt || 'daytime';

  const atmospherePreset = ATMOSPHERE_PRESETS.find(a => a.id === scene.atmosphere);
  const atmospherePrompt = atmospherePreset?.prompt || '';

  // Từ Phân cảnhHành động mô tả được trích xuấtđạo cụ chính
  let propsPrompt = '';
  if (actionDescriptions && actionDescriptions.length > 0) {
    // \u5408\u5e76Tất cảHành động mô tả，Trích xuấtyếu tố then chốt
    const allActions = actionDescriptions.join(' ');
    const extractedProps = extractPropsFromActions(allActions);
    if (extractedProps.length > 0) {
      propsPrompt = `, with ${extractedProps.join(', ')}`;
      console.log('[buildScenePrompt] Trích xuấtcủađạo cụ:', extractedProps);
    }
  }

  return `${scene.location}${propsPrompt}, ${timePrompt}, ${atmospherePrompt}, ${styleTokens}, detailed background, environment concept art, establishing shot, cinematic composition, no characters`;
}

/**
 * từ Hành động mô tả được trích xuấtđạo cụ chính
 */
function extractPropsFromActions(actions: string): string[] {
  const props: string[] = [];
  
  // \u5e38\u89c1đạo cụchìa khóa\u8bcd\u6620\u5c04（Tiếng Trung -> Tiếng Anh）
  const propMappings: Record<string, string> = {
    // nhà\u5177/sử dụng\u5177
    'bàn ăn': 'dining table',
    'Bộ đồ ăn': 'bowls and chopsticks',
    'Món ăn': 'dishes of food',
    'ăn': 'dining table with food',
    'Sofa': 'sofa',
    'bàn cà phê': 'coffee table',
    'truyền hình': 'television',
    'truyền hình\u67dc': 'TV cabinet',
    'bàn': 'desk',
    '\u4e66\u67dc': 'bookshelf',
    'giường': 'bed',
    '\u8863\u67dc': 'wardrobe',
    'các cửa sổ': 'window',
    'cửa sổ': 'window',
    'cửa': 'door',
    // Mặt hàng
    '\u6bd5\u4e1a\u8bc1': 'graduation certificate',
    'Giấy chứng nhận': 'certificate',
    '\u7167\u7247': 'photo frame',
    '\u5168nhà\u798f': 'family photo',
    'Điện thoại': 'smartphone',
    'máy tính': 'computer',
    'Tệp': 'documents',
    '\u4fe1': 'letter',
    // thực vật
    '\u6800\u5b50\u82b1': 'gardenia flowers',
    '\u82b1': 'flowers',
    '\u76c6\u683d': 'potted plant',
    '\u7eff\u690d': 'green plants',
    // \u98df\u7269
    '\u9152': 'wine/alcohol',
    'ly rượu': 'wine glasses',
    '\u5496\u5561': 'coffee',
    '\u8336': 'tea',
    // Cảnhphần tử
    'ban công': 'balcony',
    'bên ngoài cửa sổ': 'view outside window',
    '\u706f': 'lamp',
    'đèn bàn': 'table lamp',
    '\u5439gió\u6a5f': 'electric fan',
    '\u7a7a\u8c03': 'air conditioner',
  };
  
  // Kiểm tra mọi từ khóa\u662f\u5426\u51fa\u73b0\u5728Hành động mô tảtrong
  for (const [chinese, english] of Object.entries(propMappings)) {
    if (actions.includes(chinese) && !props.includes(english)) {
      props.push(english);
    }
  }
  
  return props.slice(0, 8); // Lên tới Bến Lại 8 mộtđạo cụ
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Note: generateSceneImage is now imported from @/lib/ai/image-generator
