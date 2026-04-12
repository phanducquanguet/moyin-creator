// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Director Context Panel Component
 * tình hình chung\u53f3\u680f - AIgiám đốcchế độ：\u663e\u793a\u5267\u672c\u5c42\u7ea7cây，\u8ba9sử dụng\u6237\u9009\u62e9\u8981\u751f\u6210củabên trong\u5bb9
 */

import { useState, useMemo, useCallback } from "react";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { useActiveScriptProject } from "@/stores/script-store";
import { getShotCompletionStatus, calculateProgress, SHOT_SIZE_MAP } from "@/lib/script/shot-utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Film,
  MapPin,
  Circle,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Send,
  FileVideo,
  Plus,
} from "lucide-react";
import type { Shot, CompletionStatus, ScriptScene } from "@/types/script";
import { DEFAULT_STYLE_ID, getStyleById } from "@/lib/constants/visual-styles";
import { useDirectorStore, useActiveDirectorProject, type SoundEffectTag } from '@/stores/director-store';
import { useCharacterLibraryStore } from '@/stores/character-library-store';
import { useSceneStore } from '@/stores/scene-store';
import { useAppSettingsStore } from '@/stores/app-settings-store';
import { useProjectStore } from '@/stores/project-store';
import { toast } from "sonner";
import { matchSceneAndViewpoint, matchSceneAndViewpointSync, type ViewpointMatchResult } from '@/lib/scene/viewpoint-matcher';

// \u72b6\u6001\u56fe\u6807
function StatusIcon({ status }: { status?: CompletionStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "in_progress":
      return <Clock className="h-3 w-3 text-yellow-500" />;
    default:
      return <Circle className="h-3 w-3 text-muted-foreground" />;
  }
}

// \u5bfc\u51fa\u7ec4\u4ef6
export function DirectorContextPanel() {
  const { setActiveTab, goToDirectorWithData } = useMediaPanelStore();
  const scriptProject = useActiveScriptProject();
  const { addScenesFromScript, setStoryboardConfig } = useDirectorStore();
  const { resourceSharing } = useAppSettingsStore();
  const { activeProjectId } = useProjectStore();
  
  // Get current project data
  const projectData = useActiveDirectorProject();
  const splitScenes = projectData?.splitScenes || [];
  const storyboardStatus = projectData?.storyboardStatus || 'idle';
  
  // \u83b7\u53d6\u573a\u666f\u5e93\u6570\u636e
  const { scenes } = useSceneStore();
  const sceneLibraryScenes = useMemo(() => {
    if (resourceSharing.shareScenes) return scenes;
    if (!activeProjectId) return [];
    return scenes.filter((s) => s.projectId === activeProjectId);
  }, [scenes, resourceSharing.shareScenes, activeProjectId]);

  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set(["default", "ep_1"]));
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  const scriptData = scriptProject?.scriptData || null;
  const shots = scriptProject?.shots || [];
  const styleId = scriptProject?.styleId || DEFAULT_STYLE_ID;

  // từ\u5267\u672c\u6dfb\u52a0\u5206\u955c\u65f6，\u540c\u6b65\u5267\u672cgió\u683cĐếngiám đốc\u9762\u677fcủa storyboardConfig
  const addScenesAndSyncStyle: typeof addScenesFromScript = useCallback((scenes) => {
    addScenesFromScript(scenes);
    // Chẳng hạn như\u679cgiám đốc\u9762\u677f\u5c1a\u672a\u8bbe\u7f6e visualStyleId，từ\u5267\u672c\u9879\u76eesự kế thừa
    const directorStyleId = projectData?.storyboardConfig?.visualStyleId;
    if (!directorStyleId && scriptProject?.styleId) {
      const style = getStyleById(scriptProject.styleId);
      if (style) {
        setStoryboardConfig({ visualStyleId: style.id, styleTokens: [style.prompt] });
        console.log('[ContextPanel] Synced script styleId to director:', style.id);
      }
    }
  }, [addScenesFromScript, setStoryboardConfig, projectData?.storyboardConfig?.visualStyleId, scriptProject?.styleId]);

  // nếu khôngepisodes，\u521b\u5efamộtmột\u9ed8\u8ba4của
  const episodes = useMemo(() => {
    if (!scriptData) return [];
    if (scriptData.episodes && scriptData.episodes.length > 0) {
      return scriptData.episodes;
    }
    // \u9ed8\u8ba4tập duy nhất
    return [{
      id: "default",
      index: 1,
      title: scriptData.title || "Tập 1",
      sceneIds: scriptData.scenes.map((s) => s.id),
    }];
  }, [scriptData]);

  // \u6309\u573a\u666f\u5206\u7ec4củashots
  const shotsByScene = useMemo(() => {
    const map: Record<string, Shot[]> = {};
    shots.forEach((shot) => {
      const sceneId = shot.sceneRefId;
      if (!map[sceneId]) map[sceneId] = [];
      map[sceneId].push(shot);
    });
    return map;
  }, [shots]);

  const handleBackToScript = () => {
    setActiveTab("script");
  };

  const toggleEpisode = (id: string) => {
    setExpandedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleScene = (id: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // \u83b7\u53d6\u89d2\u8272\u5e93trongcủa\u6240Có\u89d2\u8272
  const { characters } = useCharacterLibraryStore();
  const libraryCharacters = useMemo(() => {
    if (resourceSharing.shareCharacters) return characters;
    if (!activeProjectId) return [];
    return characters.filter((c) => c.projectId === activeProjectId);
  }, [characters, resourceSharing.shareCharacters, activeProjectId]);
  
  // \u5c06\u5267\u672c\u89d2\u8272IDhoặc\u89d2\u8272tên\u79f0\u6620\u5c04Đến\u89d2\u8272\u5e93ID
  const mapScriptCharacterIdsToLibraryIds = (scriptCharIds: string[], characterNames?: string[]): string[] => {
    const libraryIds: string[] = [];
    const addedIds = new Set<string>(); // \u907f\u514d\u91cd\u590d
    
    // 1. đầu tiên\u901a\u8fc7 characterIds trận đấu
    if (scriptCharIds && scriptCharIds.length > 0 && scriptData) {
      for (const scriptCharId of scriptCharIds) {
        // \u67e5\u627e\u5267\u672c\u89d2\u8272
        const scriptChar = scriptData.characters.find(c => c.id === scriptCharId);
        if (!scriptChar) continue;
        
        // Ưu tiênsử dụngĐã được liên kếtcủa\u89d2\u8272\u5e93ID（\u9700\u6821\u9a8c\u8be5ID\u5728hiện tại\u53ef\u89c1\u89d2\u8272\u5e93trong\u4ecdCó\u6548）
        if (scriptChar.characterLibraryId && !addedIds.has(scriptChar.characterLibraryId)) {
          const linkedLibraryChar = libraryCharacters.find(c => c.id === scriptChar.characterLibraryId);
          if (linkedLibraryChar) {
            libraryIds.push(linkedLibraryChar.id);
            addedIds.add(linkedLibraryChar.id);
            continue;
          }
          console.warn(`[ContextPanel] Invalid characterLibraryId "${scriptChar.characterLibraryId}" for script character "${scriptChar.name}", fallback to name matching`);
        }
        
        // KHÔNG\u5219\u901a\u8fc7têntừ\u5339vai phụ\u8272\u5e93trongcủa\u89d2\u8272
        const libraryChar = libraryCharacters.find(c => c.name === scriptChar.name);
        if (libraryChar && !addedIds.has(libraryChar.id)) {
          libraryIds.push(libraryChar.id);
          addedIds.add(libraryChar.id);
        }
      }
    }
    
    // 2. Một lần nữa\u901a\u8fc7 characterNames bổ sungtrận đấu（Hiệu chuẩn AIcủa\u5206\u955c\u53ef\u80fd\u53eaCótên\u79f0）
    if (characterNames && characterNames.length > 0) {
      for (const charName of characterNames) {
        if (!charName) continue;
        
        // \u7cbe\u786etrận đấu
        let libraryChar = libraryCharacters.find(c => c.name === charName);
        
        // \u6a21\u7ccatrận đấu：\u89d2\u8272\u5e93tên\u79f0chứa\u5206\u955c\u89d2\u8272tên，hoặc\u5206\u955c\u89d2\u8272tênchứa\u89d2\u8272\u5e93tên\u79f0
        if (!libraryChar) {
          libraryChar = libraryCharacters.find(c => 
            c.name.includes(charName) || charName.includes(c.name)
          );
        }
        
        if (libraryChar && !addedIds.has(libraryChar.id)) {
          libraryIds.push(libraryChar.id);
          addedIds.add(libraryChar.id);
          console.log(`[ContextPanel] Matched character "${charName}" to library "${libraryChar.name}"`);
        }
      }
    }
    
    return libraryIds;
  };
  
  // \u6839\u636e\u5206\u955cvà\u573a\u666fthông tin\u67e5\u627etrận đấucủa\u573a\u666f\u5e93\u89c6\u89d2
  // Ưu tiênsử dụngAI\u5206\u6790củashotIds\u5173\u8054，\u4fdd\u5e95sử dụng\u5206\u955c\u5e8f\u53f7\u5bf9\u5e94\u89c6\u89d2\u5e8f\u53f7
  const findMatchingSceneAndViewpointQuick = (shot: Shot, scene: ScriptScene, shotIndexInScene?: number): ViewpointMatchResult | null => {
    const sceneName = scene.name || '';
    
    // tìm thấy\u573a\u666f\u5e93trongtrận đấucủa\u7236\u573a\u666f
    const parentScene = sceneLibraryScenes.find(s => 
      !s.parentSceneId && !s.isViewpointVariant &&
      (s.name.includes(sceneName) || sceneName.includes(s.name))
    );
    
    if (!parentScene) {
      console.log(`[findMatchingSceneAndViewpointQuick] \u672atìm thấytrận đấucủa\u7236\u573a\u666f: "${sceneName}"`);
      return null;
    }
    
    // \u83b7\u53d6\u8be5\u7236\u573a\u666fcủa\u6240Có\u89c6\u89d2thay đổi\u4f53，\u6309\u521b\u5efa\u65f6\u95f4\u6392\u5e8f
    const variants = sceneLibraryScenes
      .filter(s => s.parentSceneId === parentScene.id)
      .sort((a, b) => a.createdAt - b.createdAt);
    
    console.log(`[findMatchingSceneAndViewpointQuick] \u573a\u666f "${sceneName}" Có ${variants.length} một\u89c6\u89d2thay đổi\u4f53`);
    
    if (variants.length === 0) {
      // \u6ca1Có\u89c6\u89d2thay đổi\u4f53，\u8fd4\u56de\u7236\u573a\u666f
      return {
        sceneLibraryId: parentScene.id,
        viewpointId: undefined,
        sceneReferenceImage: parentScene.referenceImage || parentScene.referenceImageBase64,
        matchedSceneName: parentScene.name,
        matchMethod: 'fallback' as const,
        confidence: 0.5,
      };
    }
    
    // \u65b9\u6848một：Ưu tiên\u68c0\u67e5\u573a\u666f\u5e93\u89c6\u89d2thay đổi\u4f53củashotIds（\u5207\u5272\u65f6\u4fdd\u5b58của）
    const variantWithShot = variants.find(v => v.shotIds?.includes(shot.id));
    if (variantWithShot) {
      console.log(`[findMatchingSceneAndViewpointQuick] \u901a\u8fc7\u573a\u666f\u5e93shotIdstrận đấu: \u5206\u955c${shot.id} -> \u89c6\u89d2 "${variantWithShot.viewpointName || variantWithShot.name}"`);
      return {
        sceneLibraryId: variantWithShot.id,
        viewpointId: variantWithShot.viewpointId,
        sceneReferenceImage: variantWithShot.referenceImage || variantWithShot.referenceImageBase64,
        matchedSceneName: variantWithShot.viewpointName || variantWithShot.name,
        matchMethod: 'keyword' as const,
        confidence: 0.98,
      };
    }
    
    // \u65b9\u6848Hai：\u68c0\u67e5\u5267\u672cscene.viewpointscủashotIds（AI\u5206\u6790\u65f6\u4fdd\u5b58của）
    if (scene.viewpoints && scene.viewpoints.length > 0) {
      const matchedViewpoint = scene.viewpoints.find(v => v.shotIds?.includes(shot.id));
      if (matchedViewpoint) {
        // \u5728\u573a\u666f\u5e93\u89c6\u89d2thay đổi\u4f53trongtìm thấy\u540ctêncủa
        const matchedVariant = variants.find(v => {
          const variantName = v.viewpointName || v.name || '';
          return variantName.includes(matchedViewpoint.name) || matchedViewpoint.name.includes(variantName);
        });
        if (matchedVariant) {
          console.log(`[findMatchingSceneAndViewpointQuick] \u901a\u8fc7\u5267\u672cshotIdstrận đấu: \u5206\u955c${shot.id} -> \u89c6\u89d2 "${matchedVariant.viewpointName || matchedVariant.name}"`);
          return {
            sceneLibraryId: matchedVariant.id,
            viewpointId: matchedVariant.viewpointId,
            sceneReferenceImage: matchedVariant.referenceImage || matchedVariant.referenceImageBase64,
            matchedSceneName: matchedVariant.viewpointName || matchedVariant.name,
            matchMethod: 'keyword' as const,
            confidence: 0.95,
          };
        }
      }
    }
    
    // \u65b9\u6848ba：\u4fdd\u5e95 - \u6309\u5206\u955c\u5e8f\u53f7\u5bf9\u5e94\u89c6\u89d2thay đổi\u4f53\u5e8f\u53f7
    // \u5206\u955c1 -> \u89c6\u89d21，\u5206\u955c2 -> \u89c6\u89d22，...
    // Chẳng hạn như\u679c\u5206\u955c\u6570\u8d85\u8fc7\u89c6\u89d2\u6570，\u5faa\u73afsử dụng
    const variantIndex = shotIndexInScene !== undefined 
      ? shotIndexInScene % variants.length 
      : 0;
    
    const matchedVariant = variants[variantIndex];
    
    console.log(`[findMatchingSceneAndViewpointQuick] \u901a\u8fc7\u5e8f\u53f7trận đấu: \u5206\u955c\u5e8f\u53f7 ${(shotIndexInScene ?? 0) + 1} -> \u89c6\u89d2thay đổi\u4f53 ${variantIndex + 1}: "${matchedVariant.viewpointName || matchedVariant.name}"`);
    
    return {
      sceneLibraryId: matchedVariant.id,
      viewpointId: matchedVariant.viewpointId,
      sceneReferenceImage: matchedVariant.referenceImage || matchedVariant.referenceImageBase64,
      matchedSceneName: matchedVariant.viewpointName || matchedVariant.name,
      matchMethod: 'keyword' as const,
      confidence: 0.9,
    };
  };
  
  // \u5728\u573a\u666f\u5e93trong\u67e5\u627etrận đấucủa\u89c6\u89d2
  const findViewpointInLibrary = (sceneName: string, viewpointName: string): ViewpointMatchResult | null => {
    console.log(`[findViewpointInLibrary] \u67e5\u627e\u573a\u666f: "${sceneName}", \u89c6\u89d2: "${viewpointName}"`);
    console.log(`[findViewpointInLibrary] \u573a\u666f\u5e93\u603b\u6570: ${sceneLibraryScenes.length}`);
    
    // tìm thấytrận đấucủa\u7236\u573a\u666f
    const parentScenes = sceneLibraryScenes.filter(s => 
      !s.parentSceneId && !s.isViewpointVariant &&
      (s.name.includes(sceneName) || sceneName.includes(s.name))
    );
    
    console.log(`[findViewpointInLibrary] trận đấucủa\u7236\u573a\u666f\u6570: ${parentScenes.length}`, parentScenes.map(s => s.name));
    
    if (parentScenes.length === 0) return null;
    
    // \u5728\u7236\u573a\u666fcủa\u89c6\u89d2thay đổi\u4f53trong\u67e5\u627etrận đấucủa\u89c6\u89d2
    for (const parent of parentScenes) {
      const variants = sceneLibraryScenes.filter(s => s.parentSceneId === parent.id);
      console.log(`[findViewpointInLibrary] \u7236\u573a\u666f "${parent.name}" của\u89c6\u89d2thay đổi\u4f53\u6570: ${variants.length}`, 
        variants.map(v => ({ name: v.name, viewpointName: v.viewpointName, id: v.id })));
      
      // \u6a21\u7ccatrận đấu\u89c6\u89d2tên\u79f0
      const matchedVariant = variants.find(v => {
        const variantName = v.viewpointName || v.name || '';
        const isMatch = variantName.includes(viewpointName) || viewpointName.includes(variantName);
        console.log(`[findViewpointInLibrary] \u5bf9\u6bd4: "${variantName}" vs "${viewpointName}" => ${isMatch}`);
        return isMatch;
      });
      
      if (matchedVariant) {
        console.log(`[findViewpointInLibrary] ✅ trận đấu\u6210\u529f: ${matchedVariant.viewpointName || matchedVariant.name}`);
        console.log(`[findViewpointInLibrary] \u56fe\u7247Cánh đồng:`, {
          id: matchedVariant.id,
          referenceImage: matchedVariant.referenceImage ? `Có(${matchedVariant.referenceImage.substring(0, 50)}...)` : 'không có',
          referenceImageBase64: matchedVariant.referenceImageBase64 ? `Có(${matchedVariant.referenceImageBase64.substring(0, 50)}...)` : 'không có',
        });
        return {
          sceneLibraryId: matchedVariant.id,
          viewpointId: matchedVariant.viewpointId,
          sceneReferenceImage: matchedVariant.referenceImage || matchedVariant.referenceImageBase64,
          matchedSceneName: matchedVariant.viewpointName || matchedVariant.name,
          matchMethod: 'keyword' as const,
          confidence: 0.95,
        };
      }
    }
    
    console.log(`[findViewpointInLibrary] ❌ \u672atìm thấy\u89c6\u89d2，\u8fd4\u56de\u7236\u573a\u666f`);
    // \u6ca1tìm thấy\u89c6\u89d2，\u8fd4\u56de\u7236\u573a\u666f
    const bestParent = parentScenes[0];
    return {
      sceneLibraryId: bestParent.id,
      viewpointId: undefined,
      sceneReferenceImage: bestParent.referenceImage || bestParent.referenceImageBase64,
      matchedSceneName: bestParent.name,
      matchMethod: 'fallback' as const,
      confidence: 0.5,
    };
  };
  
  // \u5f02\u6b65\u7248\u672c：chìa khóa\u8bcd + AI trận đấu（sử dụng\u4e8elô\u91cf\u6dfb\u52a0）
  const findMatchingSceneAndViewpointWithAI = async (sceneName: string, actionSummary: string): Promise<ViewpointMatchResult | null> => {
    return matchSceneAndViewpoint(sceneName, actionSummary, sceneLibraryScenes, true);
  };

  // \u6dfb\u52a0\u5355một\u5206\u955cĐến\u5206\u955c\u7f16\u8f91（chế độHai）
  const handleAddShotToSplitScenes = (shot: Shot, scene: ScriptScene) => {
    // Debug: \u68c0\u67e5 Shot trongcủaba\u5c42\u63d0\u793a\u8bcd\u6570\u636e
    console.log('[ContextPanel] Adding shot to split scenes:', {
      shotId: shot.id,
      imagePrompt: shot.imagePrompt?.substring(0, 50),
      imagePromptZh: shot.imagePromptZh?.substring(0, 50),
      videoPrompt: shot.videoPrompt?.substring(0, 50),
      videoPromptZh: shot.videoPromptZh?.substring(0, 50),
      endFramePrompt: shot.endFramePrompt?.substring(0, 50),
      needsEndFrame: shot.needsEndFrame,
      narrativeFunction: (shot as any).narrativeFunction,
      shotPurpose: (shot as any).shotPurpose,
    });
    // sử dụng\u8be6\u7ec6của\u89c6\u89c9\u63cf\u8ff0\u4f5ccho\u63d0\u793a\u8bcd（Ưu tiên）
    let promptZh = shot.visualDescription || '';
    if (!promptZh) {
      const parts: string[] = [];
      if (scene.location) parts.push(scene.location);
      if (shot.actionSummary) parts.push(shot.actionSummary);
      promptZh = parts.join(' - ');
    }
    
    // \u5c06\u5267\u672c\u89d2\u8272ID/tên\u79f0\u6620\u5c04Đến\u89d2\u8272\u5e93ID
    const characterLibraryIds = mapScriptCharacterIdsToLibraryIds(shot.characterIds || [], shot.characterNames);
    
    // \u83b7\u53d6\u5206\u955c\u5728\u573a\u666fbên trongcủa\u5e8f\u53f7
    const sceneShots = shotsByScene[scene.id] || [];
    const shotIndexInScene = sceneShots.findIndex(s => s.id === shot.id);
    
    // \u81ea\u52a8trận đấu\u573a\u666f\u5e93trongcủa\u573a\u666fvà\u89c6\u89d2（Ưu tiênsử dụngĐã rồiCócủa\u89c6\u89d2\u5173\u8054）
    const sceneMatch = findMatchingSceneAndViewpointQuick(shot, scene, shotIndexInScene >= 0 ? shotIndexInScene : undefined);
    
    addScenesAndSyncStyle([{
      // \u573a\u666fthông tin
      sceneName: sceneMatch?.matchedSceneName || scene.name || '',
      sceneLocation: scene.location || '',
      // \u65e7\u63d0\u793a\u8bcd（\u517c\u5bb9）
      promptZh,
      promptEn: shot.visualPrompt || shot.videoPrompt || '',
      // ba\u5c42\u63d0\u793a\u8bcd\u7cfb\u7edf (Seedance 1.5 Pro)
      imagePrompt: shot.imagePrompt || '',
      imagePromptZh: shot.imagePromptZh || '',
      videoPrompt: shot.videoPrompt || '',
      videoPromptZh: shot.videoPromptZh || '',
      endFramePrompt: shot.endFramePrompt || '',
      endFramePromptZh: shot.endFramePromptZh || '',
      needsEndFrame: shot.needsEndFrame || false,
      // \u89d2\u8272（sử dụng\u89d2\u8272\u5e93ID）
      characterIds: characterLibraryIds,
      // Thẻ cảm xúc（Hiệu chuẩn AI\u4ea7\u51fa）
      emotionTags: (shot.emotionTags || []) as any,
      // \u666f\u522b
      shotSize: shot.shotSize ? (SHOT_SIZE_MAP[shot.shotSize] || null) as any : null,
      // \u65f6\u957f
      duration: shot.duration || 5,
      // \u97f3\u9891
      ambientSound: shot.ambientSound || '',
      soundEffects: [] as SoundEffectTag[],
      soundEffectText: shot.soundEffect || '',
      // đối thoại
      dialogue: shot.dialogue || '',
      // \u52a8\u4f5c\u63cf\u8ff0
      actionSummary: shot.actionSummary || '',
      // \u955c\u5934các môn thể thao
      cameraMovement: shot.cameraMovement || '',
      // Kỹ thuật chụp đặc biệt
      specialTechnique: shot.specialTechnique || '',
      // \u573a\u666f\u5e93\u5173\u8054（\u81ea\u52a8trận đấu）
      sceneLibraryId: sceneMatch?.sceneLibraryId,
      viewpointId: sceneMatch?.viewpointId,
      sceneReferenceImage: sceneMatch?.sceneReferenceImage,
      // thiết kế theo hướng tường thuật（Dựa trên《Ngữ pháp ngôn ngữ điện ảnh》）
      narrativeFunction: (shot as any).narrativeFunction || '',
      shotPurpose: (shot as any).shotPurpose || '',
      visualFocus: (shot as any).visualFocus || '',
      cameraPosition: (shot as any).cameraPosition || '',
      characterBlocking: (shot as any).characterBlocking || '',
      rhythm: (shot as any).rhythm || '',
      visualDescription: (shot as any).visualDescription || '',
      // Kiểm soát chụp（đèn/tiêu điểm/Thiết bị/\u7279\u6548/tốc độ）
      lightingStyle: shot.lightingStyle,
      lightingDirection: shot.lightingDirection,
      colorTemperature: shot.colorTemperature,
      lightingNotes: shot.lightingNotes,
      depthOfField: shot.depthOfField,
      focusTarget: shot.focusTarget,
      focusTransition: shot.focusTransition,
      cameraRig: shot.cameraRig,
      movementSpeed: shot.movementSpeed,
      atmosphericEffects: shot.atmosphericEffects,
      effectIntensity: shot.effectIntensity,
      playbackSpeed: shot.playbackSpeed,
      cameraAngle: shot.cameraAngle,
      focalLength: shot.focalLength,
      photographyTechnique: shot.photographyTechnique,
    }]);
    
    const matchInfo = sceneMatch ? ` (trận đấu: ${sceneMatch.matchedSceneName})` : '';
    toast.success(`Đã rồi\u6dfb\u52a0\u5206\u955cĐến\u7f16\u8f91danh sách${matchInfo}`);
  };

  // \u6dfb\u52a0\u6574một\u573a\u666fcủa\u6240Có\u5206\u955cĐến\u5206\u955c\u7f16\u8f91（chế độHai）
  const handleAddSceneToSplitScenes = (scene: ScriptScene) => {
    const sceneShots = shotsByScene[scene.id] || [];
    
    if (sceneShots.length === 0) {
      const fallbackPromptZh = scene.visualPrompt?.trim()
        || [scene.location, scene.atmosphere].filter(Boolean).join(' - ')
        || scene.name
        || '\u573a\u666f\u63cf\u8ff0';
      const fallbackPromptEn = scene.visualPromptEn?.trim() || '';
      const matchedScene = sceneLibraryScenes.find((s) =>
        !s.parentSceneId &&
        !s.isViewpointVariant &&
        (
          (!!scene.name && (s.name.includes(scene.name) || scene.name.includes(s.name)))
          || (!!scene.location && (s.name.includes(scene.location) || scene.location.includes(s.name)))
        )
      );

      addScenesAndSyncStyle([{
        sceneName: scene.name || scene.location || 'Chưa đặt tên\u573a\u666f',
        sceneLocation: scene.location || '',
        promptZh: fallbackPromptZh,
        promptEn: fallbackPromptEn,
        imagePrompt: fallbackPromptEn,
        imagePromptZh: fallbackPromptZh,
        videoPrompt: fallbackPromptEn,
        videoPromptZh: fallbackPromptZh,
        endFramePrompt: '',
        endFramePromptZh: '',
        needsEndFrame: false,
        characterIds: [],
        emotionTags: [],
        shotSize: null,
        duration: 5,
        ambientSound: scene.atmosphere || '',
        soundEffects: [] as SoundEffectTag[],
        soundEffectText: '',
        dialogue: '',
        actionSummary: scene.atmosphere || '',
        cameraMovement: '',
        specialTechnique: '',
        sceneLibraryId: matchedScene?.id,
        viewpointId: undefined,
        sceneReferenceImage: matchedScene?.referenceImage || matchedScene?.referenceImageBase64,
      }]);

      const matchInfo = matchedScene ? `（Đã rồitrận đấu\u573a\u666f\u5e93：${matchedScene.name}）` : '';
      toast.success(`\u8be5\u573a\u666f\u6682không có\u5206\u955c，Đã rồi\u521b\u5efa 1 \u6761\u573a\u666f\u5206\u955c${matchInfo}`);
      return;
    }
    
    let matchedCount = 0;
    const scenesToAdd = sceneShots.map((shot, shotIndexInScene) => {
      // sử dụng\u8be6\u7ec6của\u89c6\u89c9\u63cf\u8ff0\u4f5ccho\u63d0\u793a\u8bcd（Ưu tiên）
      let promptZh = shot.visualDescription || '';
      if (!promptZh) {
        const parts: string[] = [];
        if (scene.location) parts.push(scene.location);
        if (shot.actionSummary) parts.push(shot.actionSummary);
        promptZh = parts.join(' - ');
      }
      
      // \u5c06\u5267\u672c\u89d2\u8272ID/tên\u79f0\u6620\u5c04Đến\u89d2\u8272\u5e93ID
      const characterLibraryIds = mapScriptCharacterIdsToLibraryIds(shot.characterIds || [], shot.characterNames);
      
      // \u81ea\u52a8trận đấu\u573a\u666f\u5e93trongcủa\u573a\u666fvà\u89c6\u89d2（Ưu tiênsử dụngĐã rồiCócủa\u89c6\u89d2\u5173\u8054，\u4fdd\u5e95sử dụng\u5e8f\u53f7）
      const sceneMatch = findMatchingSceneAndViewpointQuick(shot, scene, shotIndexInScene);
      if (sceneMatch) matchedCount++;
      
      return {
        // \u573a\u666fthông tin
        sceneName: sceneMatch?.matchedSceneName || scene.name || '',
        sceneLocation: scene.location || '',
        // \u65e7\u63d0\u793a\u8bcd（\u517c\u5bb9）
        promptZh,
        promptEn: shot.visualPrompt || shot.videoPrompt || '',
        // ba\u5c42\u63d0\u793a\u8bcd\u7cfb\u7edf (Seedance 1.5 Pro)
        imagePrompt: shot.imagePrompt || '',
        imagePromptZh: shot.imagePromptZh || '',
        videoPrompt: shot.videoPrompt || '',
        videoPromptZh: shot.videoPromptZh || '',
        endFramePrompt: shot.endFramePrompt || '',
        endFramePromptZh: shot.endFramePromptZh || '',
        needsEndFrame: shot.needsEndFrame || false,
        // \u89d2\u8272（sử dụng\u89d2\u8272\u5e93ID）
        characterIds: characterLibraryIds,
        // Thẻ cảm xúc（Hiệu chuẩn AI\u4ea7\u51fa）
        emotionTags: (shot.emotionTags || []) as any,
        // \u666f\u522b
        shotSize: shot.shotSize ? (SHOT_SIZE_MAP[shot.shotSize] || null) as any : null,
        // \u65f6\u957f
        duration: shot.duration || 5,
        // \u97f3\u9891
        ambientSound: shot.ambientSound || '',
        soundEffects: [] as SoundEffectTag[],
        soundEffectText: shot.soundEffect || '',
        // đối thoại
        dialogue: shot.dialogue || '',
        // \u52a8\u4f5c\u63cf\u8ff0
        actionSummary: shot.actionSummary || '',
        // \u955c\u5934các môn thể thao
        cameraMovement: shot.cameraMovement || '',
        // Kỹ thuật chụp đặc biệt
        specialTechnique: shot.specialTechnique || '',
        // \u573a\u666f\u5e93\u5173\u8054（\u81ea\u52a8trận đấu）
        sceneLibraryId: sceneMatch?.sceneLibraryId,
        viewpointId: sceneMatch?.viewpointId,
        sceneReferenceImage: sceneMatch?.sceneReferenceImage,
        // thiết kế theo hướng tường thuật（Dựa trên《Ngữ pháp ngôn ngữ điện ảnh》）
        narrativeFunction: (shot as any).narrativeFunction || '',
        shotPurpose: (shot as any).shotPurpose || '',
        visualFocus: (shot as any).visualFocus || '',
        cameraPosition: (shot as any).cameraPosition || '',
        characterBlocking: (shot as any).characterBlocking || '',
        rhythm: (shot as any).rhythm || '',
        visualDescription: (shot as any).visualDescription || '',
        // Kiểm soát chụp（đèn/tiêu điểm/Thiết bị/\u7279\u6548/tốc độ）
        lightingStyle: shot.lightingStyle,
        lightingDirection: shot.lightingDirection,
        colorTemperature: shot.colorTemperature,
        lightingNotes: shot.lightingNotes,
        depthOfField: shot.depthOfField,
        focusTarget: shot.focusTarget,
        focusTransition: shot.focusTransition,
        cameraRig: shot.cameraRig,
        movementSpeed: shot.movementSpeed,
        atmosphericEffects: shot.atmosphericEffects,
        effectIntensity: shot.effectIntensity,
        playbackSpeed: shot.playbackSpeed,
        cameraAngle: shot.cameraAngle,
        focalLength: shot.focalLength,
        photographyTechnique: shot.photographyTechnique,
      };
    });
    
    addScenesAndSyncStyle(scenesToAdd);
    const matchInfo = matchedCount > 0 ? ` (${matchedCount}mộtĐã rồitrận đấu\u573a\u666f\u5e93)` : '';
    toast.success(`Đã rồi\u6dfb\u52a0 ${scenesToAdd.length} một\u5206\u955cĐến\u7f16\u8f91danh sách${matchInfo}`);
  };

  // \u53d1\u9001\u5355một\u5206\u955cĐếnAIgiám đốc\u8f93\u5165（chế độmột）
  const handleSendShot = (shot: Shot, scene: ScriptScene) => {
    // \u6784\u5efacâu chuyện\u63d0\u793a
    const parts: string[] = [];
    if (scene.location) parts.push(`\u573a\u666f：${scene.location}`);
    if (scene.time) parts.push(`\u65f6\u95f4：${scene.time}`);
    if (shot.actionSummary) parts.push(`\u52a8\u4f5c：${shot.actionSummary}`);
    if (shot.dialogue) parts.push(`đối thoại：${shot.dialogue}`);

    const storyPrompt = parts.join("\n");

    // Trích xuất\u89d2\u8272tên
    const characterNames: string[] = [];
    if (shot.characterIds && scriptData) {
      shot.characterIds.forEach((charId) => {
        const char = scriptData.characters.find((c) => c.id === charId);
        if (char) characterNames.push(char.name);
      });
    }

    goToDirectorWithData({
      storyPrompt,
      characterNames,
      sceneLocation: scene.location,
      sceneTime: scene.time,
      shotId: shot.id,
      sceneCount: 1,
      styleId,
      sourceType: "shot",
    });

    setSelectedShotId(shot.id);
    setSelectedSceneId(null);
  };

  // \u53d1\u9001\u6574một\u573a\u666fĐếnAIgiám đốc\u8f93\u5165
  const handleSendScene = (scene: ScriptScene) => {
    const sceneShots = shotsByScene[scene.id] || [];

    // \u6784\u5efacâu chuyện\u63d0\u793a - \u5408\u5e76\u573a\u666f\u4e0b\u6240Có\u5206\u955c
    const parts: string[] = [];
    if (scene.location) parts.push(`\u573a\u666f：${scene.location}`);
    if (scene.time) parts.push(`\u65f6\u95f4：${scene.time}`);
    if (scene.atmosphere) parts.push(`bầu không khí：${scene.atmosphere}`);

    // \u6dfb\u52a0\u6240Có\u5206\u955ccủa\u52a8\u4f5cvàđối thoại
    sceneShots.forEach((shot, idx) => {
      const shotParts: string[] = [];
      if (shot.actionSummary) shotParts.push(shot.actionSummary);
      if (shot.dialogue) shotParts.push(`"${shot.dialogue}"`);
      if (shotParts.length > 0) {
        parts.push(`[\u955c\u5934${idx + 1}] ${shotParts.join(" - ")}`);
      }
    });

    const storyPrompt = parts.join("\n");

    // \u6536đặt\u573a\u666ftrong\u6240Có\u89d2\u8272
    const characterNames: string[] = [];
    if (scriptData) {
      const charIds = new Set<string>();
      sceneShots.forEach((shot) => {
        shot.characterIds?.forEach((id) => charIds.add(id));
      });
      charIds.forEach((charId) => {
        const char = scriptData.characters.find((c) => c.id === charId);
        if (char) characterNames.push(char.name);
      });
    }

    goToDirectorWithData({
      storyPrompt,
      characterNames,
      sceneLocation: scene.location,
      sceneTime: scene.time,
      sceneCount: sceneShots.length || 1,
      styleId,
      sourceType: "scene",
    });

    setSelectedSceneId(scene.id);
    setSelectedShotId(null);
  };

  // \u6ca1Có\u5267\u672c\u6570\u636e\u65f6\u663e\u793a\u63d0\u793a
  if (!scriptData) {
    return (
      <div className="h-full min-w-0 flex flex-col overflow-x-hidden">
        <div className="p-3 border-b">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <FileVideo className="h-4 w-4" />
            \u5267\u672c\u7ed3\u6784
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground text-sm">
            <p>\u6682không có\u5267\u672c\u6570\u636e</p>
            <p className="mt-1">\u8bf7đầu tiên\u5728\u5267\u672c\u9762\u677fphân tích cú pháp\u5267\u672c</p>
          </div>
        </div>
        <div className="p-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleBackToScript}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            \u53bb\u5267\u672c\u9762\u677f
          </Button>
        </div>
      </div>
    );
  }

  // Tính toán\u6574\u4f53\u8fdb\u5ea6
  const overallProgress = calculateProgress(
    shots.map((s) => ({ status: getShotCompletionStatus(s) }))
  );

  return (
    <div className="h-full min-w-0 flex flex-col overflow-x-hidden">
      {/* Tiêu đềvà\u8fdb\u5ea6 */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sm">{scriptData.title}</h3>
            {scriptData.genre && (
              <span className="text-xs text-muted-foreground">{scriptData.genre}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            \u8fdb\u5ea6: {overallProgress}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          \u70b9\u51fb\u573a\u666f/\u5206\u955c\u53ef\u53d1\u9001ĐếnAIgiám đốc\u8f93\u5165
        </p>
        {/* \u5206\u955c\u7f16\u8f91\u8ba1\u6570 */}
        {splitScenes.length > 0 && (
          <div className="mt-2 px-2 py-1 bg-green-500/10 rounded text-xs text-green-600 flex items-center gap-1">
            <Plus className="h-3 w-3" />
            <span>Đã rồi\u6dfb\u52a0 {splitScenes.length} một\u5206\u955cĐến\u7f16\u8f91danh sách</span>
          </div>
        )}
      </div>

      {/* cây\u5f62\u7ed3\u6784 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Danh sách tập */}
          {episodes.map((episode) => {
            const episodeScenes = scriptData.scenes.filter((s) =>
              episode.sceneIds.includes(s.id)
            );
            const episodeShots = shots.filter((shot) =>
              episodeScenes.some((s) => s.id === shot.sceneRefId)
            );
            const episodeProgress = calculateProgress(
              episodeShots.map((s) => ({ status: getShotCompletionStatus(s) }))
            );

            return (
              <div key={episode.id} className="space-y-0.5">
                {/* tiêu đề tập phim */}
                <button
                  onClick={() => toggleEpisode(episode.id)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 rounded hover:bg-muted text-left"
                >
                  {expandedEpisodes.has(episode.id) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <Film className="h-3 w-3 text-primary" />
                  <span className="text-sm font-medium flex-1 truncate">
                    {episode.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {episodeProgress}
                  </span>
                </button>

                {/* \u573a\u666fdanh sách */}
                {expandedEpisodes.has(episode.id) && (
                  <div className="ml-4 space-y-0.5">
                    {episodeScenes.map((scene) => {
                      const sceneShots = shotsByScene[scene.id] || [];
                      const sceneProgress = calculateProgress(
                        sceneShots.map((s) => ({ status: getShotCompletionStatus(s) }))
                      );
                      const isSceneSelected = selectedSceneId === scene.id;

                      return (
                        <div key={scene.id} className="space-y-0.5">
                          {/* \u573a\u666fTiêu đề */}
                          <div className="flex items-center group">
                            <button
                              onClick={() => toggleScene(scene.id)}
                              className={cn(
                                "flex-1 flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-left",
                                isSceneSelected && "bg-primary/10 ring-1 ring-primary/30"
                              )}
                            >
                              {sceneShots.length > 0 ? (
                                expandedScenes.has(scene.id) ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )
                              ) : (
                                <span className="w-3" />
                              )}
                              <MapPin className="h-3 w-3 text-blue-500" />
                              <span className="text-xs flex-1 truncate">
                                {scene.name || scene.location}
                              </span>
                              <StatusIcon status={scene.status} />
                              <span className="text-xs text-muted-foreground">
                                {sceneProgress}
                              </span>
                            </button>
                            {/* \u6dfb\u52a0\u573a\u666f\u6240Có\u5206\u955cĐến\u5206\u955c\u7f16\u8f91 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddSceneToSplitScenes(scene);
                              }}
                              title="\u6dfb\u52a0\u6240Có\u5206\u955cĐến\u5206\u955c\u7f16\u8f91"
                            >
                              <Plus className="h-3 w-3 text-green-500" />
                            </Button>
                            {/* \u53d1\u9001\u573a\u666f\u6309\u94ae */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendScene(scene);
                              }}
                              title="\u53d1\u9001\u6574một\u573a\u666fĐếnAIgiám đốc\u751f\u6210\u56fe\u7247"
                            >
                              <Send className="h-3 w-3 text-primary" />
                            </Button>
                          </div>

                          {/* \u5206\u955cdanh sách */}
                          {expandedScenes.has(scene.id) && sceneShots.length > 0 && (
                            <div className="ml-4 space-y-0.5">
                              {sceneShots.map((shot) => {
                                const isShotSelected = selectedShotId === shot.id;

                                return (
                                  <div key={shot.id} className="flex items-center group">
                                    <button
                                      onClick={() => handleSendShot(shot, scene)}
                                      onDoubleClick={() => handleAddShotToSplitScenes(shot, scene)}
                                      className={cn(
                                        "flex-1 flex items-center gap-2 px-2 py-1 rounded hover:bg-muted text-left",
                                        isShotSelected && "bg-primary/10 ring-1 ring-primary/30"
                                      )}
                                      title="\u5355\u51fb: \u53d1\u9001ĐếnAIgiám đốc\u8f93\u5165 | \u53cc\u51fb: \u76f4\u63a5\u6dfb\u52a0Đến\u5206\u955c\u7f16\u8f91"
                                    >
                                      <span className="text-xs font-mono text-muted-foreground w-5">
                                        {String(shot.index).padStart(2, "0")}
                                      </span>
                                      <span className="text-xs flex-1 truncate">
                                        {shot.shotSize || "\u955c\u5934"} - {shot.actionSummary?.slice(0, 20)}...
                                      </span>
                                      <StatusIcon
                                        status={getShotCompletionStatus(shot)}
                                      />
                                    </button>
                                    {/* \u6dfb\u52a0Đến\u5206\u955c\u6309\u94ae */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddShotToSplitScenes(shot, scene);
                                      }}
                                      title="\u6dfb\u52a0Đến\u5206\u955c\u7f16\u8f91"
                                    >
                                      <Plus className="h-3 w-3 text-green-500" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* \u5e95\u90e8\u64cd\u4f5c */}
      <div className="p-3 border-t space-y-2">
        {/* chế độnói\u660e */}
        <div className="text-[10px] text-muted-foreground space-y-1">
          <p><span className="text-green-500">+</span> \u6dfb\u52a0Đến\u5206\u955c（\u5355\u72ec\u751f\u6210\u56fe\u7247）</p>
          <p><span className="text-primary">→</span> \u53d1\u9001Đến\u8f93\u5165（lô\u91cf\u751f\u6210tiết kiệm tiền）</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleBackToScript}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          \u8fd4\u56de\u5267\u672c
        </Button>
      </div>
    </div>
  );
}
