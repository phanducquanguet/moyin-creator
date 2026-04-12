// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Script View
 * Kịch bản\u677f\u5757 - ba\u680fBố cục
 * \u5de6\u680f：Kịch bảnĐầu vào（Nhập/\u521b\u4f5c）
 * trong\u95f4\u680f：\u5c42\u7ea7\u7ed3\u6784（đặt→Cảnh→Phân cảnh）
 * \u53f3\u680f：\u5c5e\u6027\u9762\u677fvà\u8df3\u8f6cThao tác
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useScriptStore,
  useActiveScriptProject,
  type ScriptCalibrationStatus,
  type ScriptViewpointStatus,
  type ScriptStructureStatus,
} from "@/stores/script-store";
import { useProjectStore } from "@/stores/project-store";
import { useAPIConfigStore } from "@/stores/api-config-store";
import { getFeatureConfig, getFeatureNotConfiguredMessage } from "@/lib/ai/feature-router";
import { useCharacterLibraryStore } from "@/stores/character-library-store";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { parseScript, generateShotList, generateScriptFromIdea } from "@/lib/script/script-parser";
import { 
  importFullScript, 
  importSingleEpisodeContent,
  generateEpisodeShots, 
  regenerateAllEpisodeShots,
  calibrateEpisodeTitles,
  getMissingTitleEpisodes,
  calibrateEpisodeShots,
  calibrateSingleShot,
  generateEpisodeSynopses,
  getMissingSynopsisEpisodes,
} from "@/lib/script/full-script-service";
import {
  analyzeCharacterStages,
  convertStagesToVariations,
  detectMultiStageHints,
} from "@/lib/script/character-stage-analyzer";
import { generateMultiPageContactSheetData, buildContactSheetDataFromViewpoints } from "@/lib/script/scene-viewpoint-generator";
import {
  calibrateCharacters,
  convertToScriptCharacters,
  sortByImportance,
  extractAllCharactersFromEpisodes,
  resolveSafeScriptCharacters,
} from "@/lib/script/character-calibrator";
import { findCharacterByDescription } from "@/lib/script/ai-character-finder";
import { findSceneByDescription } from "@/lib/script/ai-scene-finder";
import {
  calibrateScenes,
  calibrateEpisodeScenes,
  convertToScriptScenes,
  sortByImportance as sortScenesByImportance,
} from "@/lib/script/scene-calibrator";
import { syncToSeriesMeta } from "@/lib/script/series-meta-sync";
import { exportProjectMetadata } from "@/lib/script/full-script-service";
import {
  selectTrailerShots,
  convertShotsToSplitScenes,
  type TrailerGenerationOptions,
} from "@/lib/script/trailer-service";
import { useDirectorStore, useActiveDirectorProject, type TrailerDuration } from "@/stores/director-store";
import { DEFAULT_CINEMATOGRAPHY_PROFILE_ID } from "@/lib/constants/cinematography-profiles";
import { ScriptInput } from "./script-input";
import { EpisodeTree } from "./episode-tree";
import { PropertyPanel } from "./property-panel";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { getStyleTokens, DEFAULT_STYLE_ID } from "@/lib/constants/visual-styles";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { CalibrationStrictness, FilteredCharacterRecord } from "@/types/script";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ScriptView() {
  const { activeProjectId } = useProjectStore();
  const scriptProject = useActiveScriptProject();
  const {
    setActiveProjectId,
    ensureProject,
    setRawScript,
    setLanguage,
    setTargetDuration,
    setStyleId,
    setSceneCount,
    setShotCount,
    setScriptData,
    setParseStatus,
    setShots,
    setShotStatus,
    // CRUD operations
    addEpisode,
    updateEpisode,
    deleteEpisode,
    // Bundle Thao tác（\u540c\u6b65 episodeRawScripts）
    addEpisodeBundle,
    updateEpisodeBundle,
    deleteEpisodeBundle,
    addScene,
    updateScene,
    deleteScene,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    updateShot,
    deleteShot,
    // \u5b8c\u6574Kịch bảnQuản lý
    setProjectBackground,
    setEpisodeRawScripts,
    updateEpisodeRawScript,
    setPromptLanguage,
    setCalibrationState: setScriptCalibrationState,
    setSingleShotCalibrationStatus: setSingleShotCalibrationStatusInStore,
    setCalibrationStrictness,
    setLastFilteredCharacters,
  } = useScriptStore();

  const { getApiKey, checkChatKeys, isFeatureConfigured } = useAPIConfigStore();
  const { 
    characters: allCharacters, 
    selectCharacter: selectLibraryCharacter,
  } = useCharacterLibraryStore();
  const { setActiveTab, goToDirectorWithData, goToCharacterWithData, goToSceneWithData, activeEpisodeIndex, enterEpisode } = useMediaPanelStore();

  // \u9009trongTrạng thái
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<
    "character" | "scene" | "shot" | "episode" | null
  >(null);
  
  // \u5b8c\u6574Kịch bảnNhậpTrạng thái
  const [importError, setImportError] = useState<string | undefined>();

  // AIHiệu chuẩnTrạng thái
  const calibrationState = scriptProject?.calibrationState;
  const calibrationStatus = calibrationState?.titleCalibrationStatus || 'idle';
  const [missingTitleCount, setMissingTitleCount] = useState(0);

  // Nhập/phác thảo TạoTrạng thái\u6301\u4e45\u5316Đến store，\u9762\u677f\u5207\u6362\u540e\u53ef\u6062\u590d
  const importStatus = calibrationState?.importStatus || 'idle';
  const setImportStatus = useCallback((status: 'idle' | 'importing' | 'ready' | 'error') => {
    if (!activeProjectId) return;
    setScriptCalibrationState(activeProjectId, { importStatus: status });
  }, [activeProjectId, setScriptCalibrationState]);

  const synopsisStatus = calibrationState?.synopsisStatus || 'idle';
  const setSynopsisStatus = useCallback((status: 'idle' | 'generating' | 'completed' | 'error') => {
    if (!activeProjectId) return;
    setScriptCalibrationState(activeProjectId, { synopsisStatus: status });
  }, [activeProjectId, setScriptCalibrationState]);

  // phác thảo TạoTrạng thái
  const [missingSynopsisCount, setMissingSynopsisCount] = useState(0);
  
  // Nhân vật\u9636\u6bb5Phân tíchTrạng thái
  const [stageAnalysisStatus, setStageAnalysisStatus] = useState<'idle' | 'analyzing' | 'completed' | 'error'>('idle');
  const [multiStageHints, setMultiStageHints] = useState<string[]>([]);
  const [suggestMultiStage, setSuggestMultiStage] = useState(false);
  
  // Nhân vậtHiệu chuẩnTrạng thái
  const characterCalibrationStatus = calibrationState?.characterCalibrationStatus || 'idle';
  const [characterCalibrationResult, setCharacterCalibrationResult] = useState<{
    filteredCount: number;
    mergedCount: number;
    finalCount: number;
  } | null>(null);
  
  // Nhân vật\u6821\u51c6Xác nhận\u5f39cửa sổTrạng thái
  const pendingCalibrationCharacters = calibrationState?.pendingCalibrationCharacters || null;
  const pendingFilteredCharacters = calibrationState?.pendingFilteredCharacters || [];
  const calibrationDialogOpen = calibrationState?.calibrationDialogOpen || false;
  
  // Cảnh hiệu chuẩn Trạng thái
  const sceneCalibrationStatus = calibrationState?.sceneCalibrationStatus || 'idle';
  // Góc nhìnPhân tíchTrạng thái（lực lượng\u5de5\u4f5c\u6d41）
  const viewpointAnalysisStatus = calibrationState?.viewpointAnalysisStatus || 'idle';
  
  // Tiến sĩ đơnân cảnh hiệu chuẩn Trạng thái
  const singleShotCalibrationStatus = calibrationState?.singleShotCalibrationStatus || {};
  
  // Hoàn thành cấu trúc tập đơnTrạng thái
  const structureCompletionStatus = calibrationState?.structureCompletionStatus || 'idle';
  const [structureOverwriteConfirmOpen, setStructureOverwriteConfirmOpen] = useState(false);
  const prevEpisodeRef = useRef<{ index: number | null; rawLen: number }>({ index: null, rawLen: 0 });

  // Hailần\u6821\u51c6\u8ffd\u8e2a（trong\u680fđộc lập\u6309\u94aeKích hoạt\u65f6\u6807\u8bb0，cho Tiến độ\u9762\u677fQuận\u5206\u9996lần/Hailần）
  const [secondPassTypes, setSecondPassTypes] = useState<Set<string>>(new Set());
  const addSecondPass = useCallback((type: string) => {
    setSecondPassTypes(prev => new Set(prev).add(type));
  }, []);
  const removeSecondPass = useCallback((type: string) => {
    setSecondPassTypes(prev => { const next = new Set(prev); next.delete(type); return next; });
  }, []);
  
  // xe kéoTrạng thái
  const { 
    setTrailerConfig, 
    setTrailerScenes, 
    clearTrailer,
    addScenesFromScript,
  } = useDirectorStore();
  const directorProject = useActiveDirectorProject();
  const trailerConfig = directorProject?.trailerConfig || null;
  const currentSplitScenes = directorProject?.splitScenes || [];

  // Sync activeProjectId from project-store to script-store
  useEffect(() => {
    if (activeProjectId) {
      setActiveProjectId(activeProjectId);
      ensureProject(activeProjectId);
    }
  }, [activeProjectId, setActiveProjectId, ensureProject]);

  // \u9762\u677f\u91cd\u65b0\u6302\u8f7d\u65f6，\u5c06"\u8fdbĐang di chuyển"của\u77ac\u6001Trạng tháiĐặt lạicho idle，\u907f\u514d\u663e\u793a\u865a\u5047của loading Trạng thái
  useEffect(() => {
    if (!activeProjectId) return;
    const state = useScriptStore.getState().projects[activeProjectId]?.calibrationState;
    if (!state) return;
    const fixes: Record<string, string> = {};
    if (state.importStatus === 'importing') fixes.importStatus = 'idle';
    if (state.synopsisStatus === 'generating') fixes.synopsisStatus = 'idle';
    if (Object.keys(fixes).length > 0) {
      setScriptCalibrationState(activeProjectId, fixes as never);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // Keep last stable project id during transient null windows (e.g. duplicate flow)
  // to avoid creating phantom project keys like "default".
  const stableProjectIdRef = useRef<string>("default-project");
  useEffect(() => {
    if (activeProjectId) {
      stableProjectIdRef.current = activeProjectId;
    }
  }, [activeProjectId]);

  const projectId = activeProjectId || stableProjectIdRef.current;

  const setCalibrationStatus = useCallback((status: ScriptCalibrationStatus) => {
    setScriptCalibrationState(projectId, { titleCalibrationStatus: status });
  }, [projectId, setScriptCalibrationState]);

  const setCharacterCalibrationStatus = useCallback((status: ScriptCalibrationStatus) => {
    setScriptCalibrationState(projectId, { characterCalibrationStatus: status });
  }, [projectId, setScriptCalibrationState]);

  const setSceneCalibrationStatus = useCallback((status: ScriptCalibrationStatus) => {
    setScriptCalibrationState(projectId, { sceneCalibrationStatus: status });
  }, [projectId, setScriptCalibrationState]);

  const setViewpointAnalysisStatus = useCallback((status: ScriptViewpointStatus) => {
    setScriptCalibrationState(projectId, { viewpointAnalysisStatus: status });
  }, [projectId, setScriptCalibrationState]);

  const setStructureCompletionStatus = useCallback((status: ScriptStructureStatus) => {
    setScriptCalibrationState(projectId, { structureCompletionStatus: status });
  }, [projectId, setScriptCalibrationState]);

  // Local state fallbacks
  const rawScript = scriptProject?.rawScript || "";
  const language = scriptProject?.language || "Tiếng Trung";
  const targetDuration = scriptProject?.targetDuration || "60s";
  const styleId = scriptProject?.styleId || DEFAULT_STYLE_ID;
  const sceneCount = scriptProject?.sceneCount;
  const shotCount = scriptProject?.shotCount;
  const scriptData = scriptProject?.scriptData || null;
  const parseStatus = scriptProject?.parseStatus || "idle";
  const parseError = scriptProject?.parseError;
  const shots = scriptProject?.shots || [];
  const promptLanguage = scriptProject?.promptLanguage || 'zh';

  // hiện tạiđặt\u4f5csử dụng\u57df：từ activeEpisodeIndex \u6620\u5c04Đến episodeId
  const activeEpisodeId = activeEpisodeIndex != null
    ? scriptData?.episodes.find(ep => ep.index === activeEpisodeIndex)?.id ?? undefined
    : undefined;

  // nhậpđặt\u65f6\u81ea\u52a8\u805a\u7126Đến\u5bf9\u5e94 episode
  useEffect(() => {
    if (activeEpisodeIndex != null && scriptData?.episodes) {
      const ep = scriptData.episodes.find(e => e.index === activeEpisodeIndex);
      if (ep) {
        setSelectedItemId(`episode_${activeEpisodeIndex}`);
        setSelectedItemType("episode");
      }
    }
  }, [activeEpisodeIndex, scriptData?.episodes]);

  // Ưu tiên\u68c0\u67e5\u65b0của\u670d\u52a1\u6620\u5c04
  const chatConfigured = isFeatureConfigured('script_analysis') || checkChatKeys().isAllConfigured;
  const episodeRawScripts = scriptProject?.episodeRawScripts || [];

  // đặt\u4f5csử dụng\u57df\u4e0b\u663e\u793a\u8be5đặtnguyên bảnbên trong\u5bb9，\u5168\u5267\u89c6\u56fe\u663e\u793a\u5b8c\u6574 rawScript
  const effectiveRawScript = activeEpisodeIndex != null
    ? episodeRawScripts.find(ep => ep.episodeIndex === activeEpisodeIndex)?.rawContent ?? ""
    : rawScript;
  
  // === Hoàn thành cấu trúc tập đơn: rawContent từ\u7a7a→\u975e\u7a7a \u81ea\u52a8Kích hoạt ===
  const handleStructureCompletion = useCallback(async () => {
    if (activeEpisodeIndex == null || !scriptData) return;
    setStructureCompletionStatus('processing');
    try {
      const result = await importSingleEpisodeContent(
        effectiveRawScript,
        activeEpisodeIndex,
        projectId,
      );
      if (result.success) {
        setStructureCompletionStatus('completed');
        if (result.sceneCount > 0) {
          toast.success(`\u7ed3\u6784\u8865\u5168Hoàn thành：phân tích ra ${result.sceneCount} Cảnh`);
        }
      } else {
        setStructureCompletionStatus('error');
        toast.error(result.error || 'Hoàn thiện kết cấu Thất bại');
      }
    } catch (e) {
      setStructureCompletionStatus('error');
      console.error('[handleStructureCompletion]', e);
    }
    // 3giây\u540eĐặt lạicho idle，\u5141\u8bb8Một lần nữalầnKích hoạt
    setTimeout(() => setStructureCompletionStatus('idle'), 3000);
  }, [activeEpisodeIndex, effectiveRawScript, projectId, scriptData]);

  useEffect(() => {
    const prev = prevEpisodeRef.current;
    const currentLen = effectiveRawScript.length;

    // đặt\u5207\u6362 → Chỉ Cập nhật ref
    if (prev.index !== (activeEpisodeIndex ?? null)) {
      prevEpisodeRef.current = { index: activeEpisodeIndex ?? null, rawLen: currentLen };
      return;
    }

    prevEpisodeRef.current = { index: activeEpisodeIndex ?? null, rawLen: currentLen };

    // \u53ea\u5728đặt\u4f5csử dụng\u57df + idle Trạng thái\u4e0bKích hoạt
    if (activeEpisodeIndex == null) return;
    if (structureCompletionStatus !== 'idle') return;

    // Phát hiện\u7c98\u8d34：từ\u77edbên trong\u5bb9\u8df3thay đổiĐến\u5927\u91cfbên trong\u5bb9
    if (prev.rawLen < 20 && currentLen > 50) {
      const ep = scriptData?.episodes?.find(e => e.index === activeEpisodeIndex);
      const hasScenes = ep && ep.sceneIds.length > 0;

      if (hasScenes) {
        setStructureOverwriteConfirmOpen(true);
      } else {
        handleStructureCompletion();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRawScript, activeEpisodeIndex, structureCompletionStatus]);

  // Tính toán\u5404Bộ Phân cảnhTạoTrạng thái
  const episodeGenerationStatus = episodeRawScripts.reduce((acc, ep) => {
    acc[ep.episodeIndex] = ep.shotGenerationStatus;
    return acc;
  }, {} as Record<number, 'idle' | 'generating' | 'completed' | 'error'>);

  // \u5904\u7406\u9009trong
  const handleSelectItem = useCallback(
    (id: string, type: "character" | "scene" | "shot" | "episode") => {
      setSelectedItemId(id);
      setSelectedItemType(type);

      // \u9009trongđặt\u65f6nhậpđặt\u4f5csử dụng\u57df（Cài đặt activeEpisodeIndex，\u6fc0\u6d3b P4C \u81ea\u52a8\u7ed3\u6784\u8865\u5168）
      if (type === "episode" && id.startsWith("episode_")) {
        const epIndex = parseInt(id.replace("episode_", ""), 10);
        if (!Number.isNaN(epIndex)) {
          enterEpisode(epIndex, projectId);
        }
      }
    },
    [enterEpisode, projectId]
  );

  // \u83b7\u53d6\u9009trongcủa\u6570\u636e
  const selectedCharacter =
    selectedItemType === "character"
      ? scriptData?.characters.find((c) => c.id === selectedItemId)
      : undefined;
  const selectedScene =
    selectedItemType === "scene"
      ? scriptData?.scenes.find((s) => s.id === selectedItemId)
      : undefined;
  const selectedShot =
    selectedItemType === "shot"
      ? shots.find((s) => s.id === selectedItemId)
      : undefined;
  
  // \u83b7\u53d6\u9009trongcủađặt\u6570\u636e（Chứa một phác thảo）
  const selectedEpisode = selectedItemType === "episode" && selectedItemId
    ? (() => {
        const epIndex = parseInt(selectedItemId.replace('episode_', ''));
        const rawScript = episodeRawScripts.find(ep => ep.episodeIndex === epIndex);
        const epData = scriptData?.episodes.find(ep => ep.index === epIndex);
        return rawScript && epData ? { ...epData, ...rawScript } : undefined;
      })()
    : undefined;
  
  // \u83b7\u53d6\u9009Trung bình CảnhTất cảPhân cảnh（sử dụng\u4e8eNhiều Góc nhìnPhân tích）
  const selectedSceneShots = selectedItemType === "scene" && selectedItemId
    ? shots.filter(s => s.sceneRefId === selectedItemId || s.sceneId === selectedItemId)
    : undefined;
  
  // \u83b7\u53d6\u9009trongđặtTất cảPhân cảnh（Phân cảnh\u76f4\u63a5Có episodeId từ\u6bb5）
  const selectedEpisodeShots = selectedItemType === "episode" && selectedEpisode
    ? shots.filter(shot => (shot as any).episodeId === selectedEpisode.id)
    : [];

  // Đối với một tập duy nhất TạoPhân cảnh（\u9700\u8981đầu tiênĐịnh nghĩa，\u56e0cho handleImportFullScript \u4f9d\u8d56\u5b83）
  const handleGenerateEpisodeShots = useCallback(async (episodeIndex: number) => {
    // sử dụng feature router \u83b7\u53d6 API Cấu hình
    const featureConfig = getFeatureConfig('script_analysis');
    
    console.log('[handleGenerateEpisodeShots] featureConfig:', featureConfig ? 'Đã rồiCấu hình' : 'Chưa được định cấu hình');
    console.log('[handleGenerateEpisodeShots] allApiKeys:', featureConfig?.allApiKeys?.length || 0);
    
    if (!featureConfig) {
      toast.warning('Chưa được định cấu hình\u667a\u8c31 API，AI Góc nhìnPhân tích\u5c06bỏ qua');
    }
    
    try {
      toast.info(`Làm việc trên ${episodeIndex} Đặt TạoPhân cảnh...`);
      setViewpointAnalysisStatus('analyzing');
      
      const apiKey = featureConfig?.allApiKeys?.join(',') || '';
      // sử dụngCấu hìnhcủa provider，\u4e0dMột lần nữa\u786c\u7f16\u7801
      const provider = (featureConfig?.platform === 'zhipu' ? 'zhipu' : 'openai') as string;
      
      console.log('[handleGenerateEpisodeShots] apiKey length:', apiKey.length);
      console.log('[handleGenerateEpisodeShots] provider:', provider, '(from config:', featureConfig?.platform, ')');
      
      const options = {
        apiKey,
        provider,
        baseUrl: featureConfig?.baseUrl,
        styleId,
        targetDuration,
        promptLanguage,
      };
      
      const result = await generateEpisodeShots(
        episodeIndex,
        projectId,
        options,
        (msg) => console.log(`[ScriptView] ${msg}`)
      );
      
      if (result.viewpointAnalyzed) {
        setViewpointAnalysisStatus('completed');
      } else {
        setViewpointAnalysisStatus('error');
        toast.error(`AI Góc nhìnPhân tích\u672a\u6267được rồi：${result.viewpointSkippedReason || 'Không rõlý do'}`);
      }
      
      toast.success(`Không. ${episodeIndex} SetPhân cảnhTạoHoàn thành！tổng cộng ${result.shots.length} Phân cảnh`);
      return result;
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] Episode shot generation failed:", err);
      toast.error(`Phân cảnhTạoThất bại: ${err.message}`);
      setViewpointAnalysisStatus('error');
      return { shots: [], viewpointAnalyzed: false, viewpointSkippedReason: err.message };
    }
  }, [projectId, styleId, targetDuration, promptLanguage]);

  // \u5b8c\u6574Kịch bảnNhập
  const handleImportFullScript = useCallback(async (text: string) => {
    if (!text.trim()) {
      toast.error("Vui lòng nhậpKịch bảnNội dung");
      return;
    }

    const featureConfig = getFeatureConfig('script_analysis');
    const hasAI = !!featureConfig;

    setImportStatus('importing');
    setImportError(undefined);

    try {
      // 1. quy tắcphân tích cú phápNhập（\u628aNgười dùng đã chọn Phong cáchvàngôn ngữmột\u8d77\u4f20\u8fdb\u53bb）
      const result = await importFullScript(text, projectId, { styleId, promptLanguage });
      
      if (!result.success) {
        throw new Error(result.error || "NhậpThất bại");
      }

      setImportStatus('ready');
      const rawCharacterCount = result.scriptData?.characters.length || 0;
      toast.success(
        `NhậpThành công: ${result.episodes.length} đặt, ${rawCharacterCount} Nhân vật(\u5f85\u6821\u51c6), ${result.scriptData?.scenes.length || 0} Cảnh`
      );
      
      // 2. \u6821\u51c6（thiếuTiêu đềcủađặt）
      const missingTitles = getMissingTitleEpisodes(projectId);
      if (missingTitles.length > 0 && hasAI) {
        setMissingTitleCount(missingTitles.length);
        toast.info(`\u6b63\u5728cho ${missingTitles.length} Đặt Tự động TạoTiêu đề...`);
        setCalibrationStatus('calibrating');
        
        try {
          const calibResult = await calibrateEpisodeTitles(
            projectId,
            {
              apiKey: featureConfig.allApiKeys.join(','),
              provider: featureConfig.platform,
              baseUrl: featureConfig.baseUrl,
              model: featureConfig.models?.[0],
            },
            (current, total, msg) => console.log(`[ScriptView] Hiệu chỉnh tiêu đề: ${msg}`)
          );
          
          if (calibResult.success) {
            setCalibrationStatus('completed');
            setMissingTitleCount(0);
            toast.success(`Đã rồicho ${calibResult.calibratedCount} Đặt TạoTiêu đề`);
          }
        } catch (e) {
          console.error('[ScriptView] Auto calibration failed:', e);
          setCalibrationStatus('error');
        }
      }
      
      // 3. Tạo（Tóm tắt tập phim）
      if (hasAI && result.episodes.length > 0) {
        toast.info(`\u6b63\u5728cho ${result.episodes.length} Đặt TạoNội dung...`);
        setSynopsisStatus('generating');
        
        try {
          const synopsisResult = await generateEpisodeSynopses(
            projectId,
            {
              apiKey: featureConfig.allApiKeys.join(','),
              provider: featureConfig.platform,
              baseUrl: featureConfig.baseUrl,
              model: featureConfig.models?.[0],
            },
            (current, total, msg) => console.log(`[ScriptView] phác thảo Tạo: ${msg}`)
          );
          
          if (synopsisResult.success) {
            setSynopsisStatus('completed');
            setMissingSynopsisCount(0);
            toast.success(`Đã rồicho ${synopsisResult.generatedCount} Đặt TạoPhác thảo`);
          }
        } catch (e) {
          console.error('[ScriptView] Auto synopsis generation failed:', e);
          setSynopsisStatus('error');
        }
      }
      
      // 4. Tạo（Tập 1Phân cảnh）——\u6b64\u65f6\u5143\u6570\u636evớiphác thảoĐã rồi\u5c31\u7eea
      let viewpointResult: { viewpointAnalyzed: boolean; viewpointSkippedReason?: string } | null = null;
      if (result.episodes.length > 0) {
        toast.info("Là Tự động TạoTập 1Phân cảnh...");
        await new Promise(resolve => setTimeout(resolve, 500));
        viewpointResult = await handleGenerateEpisodeShots(1);
      }
      
      // 5. \u6821\u51c6（Nhân vật）
      if (hasAI && rawCharacterCount > 0 && result.scriptData && result.projectBackground) {
        // lực lượng\u5de5\u4f5c\u6d41：AI Góc nhìnPhân tích\u672a\u6267được rồi，\u4e0dnhậpNhân vật\u6821\u51c6
        if (!viewpointResult?.viewpointAnalyzed) {
          toast.error(`AI Góc nhìnPhân tích\u672a\u6267được rồi，Đã rồi\u963b\u6b62Nhân vật\u6821\u51c6：${viewpointResult?.viewpointSkippedReason || 'Không rõlý do'}`);
          return;
        }
        toast.info(`\u6b63\u5728 AI \u6821\u51c6 ${rawCharacterCount} Nhân vật...`);
        setCharacterCalibrationStatus('calibrating');
        
        try {
          // Thống nhất có được cấu hình từ ánh xạ dịch vụ，\u4e0d\u9700\u8981tay\u52a8\u4f20\u53c2
          const calibResult = await calibrateCharacters(
            result.scriptData.characters,
            result.projectBackground,
            result.episodes,
            { promptLanguage }
          );
          
          // \u8f6c\u6362\u5e76Cập nhậtNhân vậdanh sách t
          const sortedChars = sortByImportance(calibResult.characters);
          const currentProject = useScriptStore.getState().projects[projectId];
          const currentScriptData = currentProject?.scriptData;
          const existingCharacters = currentScriptData?.characters || result.scriptData.characters;
          const resolvedCharacters = resolveSafeScriptCharacters(
            convertToScriptCharacters(sortedChars, existingCharacters, promptLanguage),
            {
              existingCharacters,
              seriesMetaCharacters: currentProject?.seriesMeta?.characters,
              rawCharacters: result.scriptData.characters,
            },
          );
          const newCharacters = resolvedCharacters.characters;
          
          // từ store \u83b7\u53d6\u6700\u65b0của scriptData（\u907f\u514dChe Phân cảnhTạocủa AI Góc nhìdữ liệu）
          if (currentScriptData) {
            setScriptData(projectId, {
              ...currentScriptData,  // sử dụng\u6700\u65b0\u6570\u636e，\u4fdd\u7559 scenes.viewpoints
              characters: newCharacters,
            });
          }
          if (resolvedCharacters.source !== 'calibrated') {
            console.warn(`[ScriptView] AI character calibration returned empty result, recovered characters from ${resolvedCharacters.source}.`);
            toast.warning('AI Nhân vật\u6821\u51c6Quay lại\u7a7akết quả，Đã rồi\u4fdd\u7559\u73b0CóNhân vật，\u907f\u514dKịch bảnChúa ơi\u6570\u636e\u88ab\u6e05\u7a7a');
          }
          
          setCharacterCalibrationStatus('completed');
          setCharacterCalibrationResult({
            filteredCount: calibResult.filteredWords.length,
            mergedCount: calibResult.mergeRecords.length,
            finalCount: newCharacters.length,
          });
          
          toast.success(
            `Nhân vật\u6821\u51c6Hoàn thành: ${newCharacters.length} mộtCó\u6548Nhân vật, Lọc ${calibResult.filteredWords.length} một\u975eNhân vật\u8bcd, \u5408\u5e76 ${calibResult.mergeRecords.length} \u7ec4\u91cd\u590d`
          );
          
          console.log('[ScriptView] Nhân vậtKết quả hiệu chuẩn:', calibResult.analysisNotes);
          if (calibResult.filteredWords.length > 0) {
            console.log('[ScriptView] Lọccủa\u975eNhân vật\u8bcd:', calibResult.filteredWords);
          }
          if (calibResult.mergeRecords.length > 0) {
            console.log('[ScriptView] \u5408\u5e76Bản ghi:', calibResult.mergeRecords);
          }
        } catch (e) {
          console.error('[ScriptView] Nhân vậtHiệu chỉnh Thất bại:', e);
          setCharacterCalibrationStatus('error');
          toast.error(`Nhân vậtHiệu chỉnh Thất bại，sử dụngNh gốcân vậdanh sách t`);
        }
      }
      
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] Import failed:", err);
      setImportStatus('error');
      setImportError(err.message);
      toast.error(`NhậpThất bại: ${err.message}`);
    }
  }, [projectId, handleGenerateEpisodeShots, promptLanguage]);

  // Cập nhậtTất cảPhân cảnh
  const handleRegenerateAllShots = useCallback(async () => {
    const featureConfig = getFeatureConfig('script_analysis');
    
    if (episodeRawScripts.length === 0) {
      toast.error("Không có gì với Tạtập hợp của o");
      return;
    }
    
    try {
      toast.info(`\u6b63\u5728choTất cả ${episodeRawScripts.length} Đặt TạoPhân cảnh...（\u53ef\u80fd\u9700\u8981\u8f83\u957fThời gian）`);
      
      const options = {
        apiKey: featureConfig?.allApiKeys.join(',') || '',
        provider: (featureConfig?.platform === 'zhipu' ? 'zhipu' : 'openai') as string,
        styleId,
        targetDuration,
        promptLanguage,
      };
      
      await regenerateAllEpisodeShots(
        projectId,
        options,
        (current, total, msg) => {
          console.log(`[ScriptView] ${msg} (${current}/${total})`);
        }
      );
      
      toast.success(`Tất cả ${episodeRawScripts.length} SetPhân cảnhTạoHoàn thành！`);
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] All episodes shot generation failed:", err);
      toast.error(`Phân cảnhTạoThất bại: ${err.message}`);
    }
  }, [projectId, styleId, targetDuration, promptLanguage, episodeRawScripts.length]);

  // Tính toánthiếu\u5931Tiêu đềvàphác thảocủađặt\u6570
  useEffect(() => {
    if (importStatus === 'ready' && projectId) {
      const missingTitles = getMissingTitleEpisodes(projectId);
      setMissingTitleCount(missingTitles.length);
      
      const missingSynopses = getMissingSynopsisEpisodes(projectId);
      setMissingSynopsisCount(missingSynopses.length);
    }
  }, [importStatus, projectId, episodeRawScripts]);

  // Hiệu chuẩn AI：là số tập thiếu tựa TạoTiêu đề
  const handleCalibrate = useCallback(async () => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }
    
    const missing = getMissingTitleEpisodes(projectId);
    if (missing.length === 0) {
      toast.info("Tất cảđặt\u6570\u90fdĐã rồiCóTiêu đề");
      return;
    }
    
    setCalibrationStatus('calibrating');
    toast.info(`\u6b63\u5728cho ${missing.length} Đặt TạoTiêu đề...`);
    
    try {
      const result = await calibrateEpisodeTitles(
        projectId,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform,  // \u76f4\u63a5Sử dụng Cài đặt\u91cccủaplatform
          baseUrl: featureConfig.baseUrl,
          model: featureConfig.models?.[0],  // sử dụngCấu hìnhcủaKhông.mộtmộtMô hình
        },
        (current, total, msg) => {
          console.log(`[ScriptView] Calibration: ${msg}`);
        }
      );
      
      if (result.success) {
        setCalibrationStatus('completed');
        setMissingTitleCount(result.totalMissing - result.calibratedCount);
        toast.success(`\u6821\u51c6Hoàn thành！Đã rồicho ${result.calibratedCount} Đặt TạoTiêu đề`);
      } else {
        throw new Error(result.error || 'Hiệu chỉnh Thất bại');
      }
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] Calibration failed:", err);
      setCalibrationStatus('error');
      toast.error(`Hiệu chỉnh Thất bại: ${err.message}`);
    }
  }, [projectId]);

  // AI hiệu chuẩn Phân cảnh：Tối ưu tiếng Trung Mô tả、TạoTiếng Anh trực quanPrompt、Tối ưu hóa Cảthiết kế bến cảng
  const handleCalibrateShots = useCallback(async (episodeIndex: number) => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }
    
    addSecondPass('shots');
    setViewpointAnalysisStatus('analyzing');
    toast.info(`\u6b63\u5728\u6821\u51c6Không. ${episodeIndex} Bộ Phân cảnh...`);
    
    try {
      const result = await calibrateEpisodeShots(
        episodeIndex,
        projectId,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform,  // \u76f4\u63a5Sử dụng Cài đặt\u91cccủaplatform
          baseUrl: featureConfig.baseUrl,
          model: featureConfig.models?.[0],  // sử dụngCấu hìnhcủaKhông.mộtmộtMô hình
          styleId,
          cinematographyProfileId: directorProject?.cinematographyProfileId || DEFAULT_CINEMATOGRAPHY_PROFILE_ID,
          promptLanguage,
        },
        (current, total, msg) => {
          console.log(`[ScriptView] Shot Calibration: ${msg}`);
        }
      );
      
      if (result.success) {
        setViewpointAnalysisStatus('completed');
        removeSecondPass('shots');
        toast.success(`Phân cảnh hiệu chuẩn đã hoàn tất！Đã rồi\u4f18\u5316 ${result.calibratedCount}/${result.totalShots} Phân cảnh`);
        
        // P2b: Phân cảnh\u6821\u51c6viết lại SeriesMeta
        try {
          const store = useScriptStore.getState();
          const meta = store.projects[projectId]?.seriesMeta;
          if (meta) {
            const updates = syncToSeriesMeta(meta, 'shot', {});
            if (Object.keys(updates).length > 0) {
              store.updateSeriesMeta(projectId, updates);
              console.log('[handleCalibrateShots] SeriesMeta Phân cảnhviết lạiHoàn thành');
            }
            const mdContent = exportProjectMetadata(projectId);
            store.setMetadataMarkdown(projectId, mdContent);
          }
        } catch (e) {
          console.warn('[handleCalibrateShots] SeriesMeta viết lạiThất bại:', e);
        }
      } else {
        throw new Error(result.error || 'Phân cảnh hiệu chuẩn Thất bại');
      }
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] Shot calibration failed:", err);
      setViewpointAnalysisStatus('error');
      removeSecondPass('shots');
      toast.error(`Phân cảnh hiệu chuẩn Thất bại: ${err.message}`);
    }
  }, [projectId, styleId, promptLanguage, directorProject?.cinematographyProfileId, addSecondPass, removeSecondPass]);

  // Hiệu chuẩn AICảnhPhân cảnh：Hiệu chỉnh chỉ được chỉ định Cảnh\u4e0bcủaPhân cảnh
  const handleCalibrateScenesShots = useCallback(async (sceneId: string) => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }

    // tìm thấyCảnh\u6240\u5c5ecủađặt
    const episode = scriptData?.episodes.find(ep => ep.sceneIds.includes(sceneId));
    if (!episode) {
      toast.error('\u627e\u4e0dĐếnCảnh\u6240\u5c5ecủađặt');
      return;
    }

    const scene = scriptData?.scenes.find(s => s.id === sceneId);
    const sceneName = scene?.name || scene?.location || 'Cảnh';

    addSecondPass('shots');
    setViewpointAnalysisStatus('analyzing');
    toast.info(`\u6b63\u5728\u6821\u51c6「${sceneName}」củaPhân cảnh...`);

    try {
      const result = await calibrateEpisodeShots(
        episode.index,
        projectId,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform,
          baseUrl: featureConfig.baseUrl,
          model: featureConfig.models?.[0],
          styleId,
          cinematographyProfileId: directorProject?.cinematographyProfileId || DEFAULT_CINEMATOGRAPHY_PROFILE_ID,
          promptLanguage,
        },
        (current, total, msg) => {
          console.log(`[ScriptView] Scene Shot Calibration: ${msg}`);
        },
        sceneId,
      );

      if (result.success) {
        setViewpointAnalysisStatus('completed');
        removeSecondPass('shots');
        toast.success(`「${sceneName}」Phân cảnh hiệu chuẩn đã hoàn tất！Đã rồi\u4f18\u5316 ${result.calibratedCount}/${result.totalShots} Phân cảnh`);
      } else {
        throw new Error(result.error || 'Phân cảnh hiệu chuẩn Thất bại');
      }
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] Scene shot calibration failed:", err);
      setViewpointAnalysisStatus('error');
      removeSecondPass('shots');
      toast.error(`Phân cảnh hiệu chuẩn Thất bại: ${err.message}`);
    }
  }, [projectId, scriptData, styleId, promptLanguage, directorProject?.cinematographyProfileId, addSecondPass, removeSecondPass]);

  // AI hiệu chỉnh một Ph duy nhấtân cảnh（sử dụng\u4e8exe kéoPhân cảnh）
  const handleCalibrateSingleShot = useCallback(async (shotId: string) => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }
    
    // Cài đặtTrạng tháicho calibrating
    setSingleShotCalibrationStatusInStore(projectId, shotId, 'calibrating');
    
    const shot = shots.find(s => s.id === shotId);
    if (!shot) {
      toast.error('Không thể tìm thấy Ph.ân cảnh');
      setSingleShotCalibrationStatusInStore(projectId, shotId, 'error');
      return;
    }
    
    toast.info(`Hiệu chỉnh độ Phân cảnh: ${shot.actionSummary?.slice(0, 20)}...`);
    
    try {
      const result = await calibrateSingleShot(
        shotId,
        projectId,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform,
          baseUrl: featureConfig.baseUrl,
          model: featureConfig.models?.[0],
          styleId,
          cinematographyProfileId: directorProject?.cinematographyProfileId || DEFAULT_CINEMATOGRAPHY_PROFILE_ID,
          promptLanguage,
        },
        (msg: string) => {
          console.log(`[ScriptView] Single Shot Calibration: ${msg}`);
        }
      );
      
      if (result.success) {
        setSingleShotCalibrationStatusInStore(projectId, shotId, 'completed');
        toast.success(`Phân cảnh hiệu chuẩn đã hoàn tất！`);
      } else {
        throw new Error(result.error || 'Phân cảnh hiệu chuẩn Thất bại');
      }
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] Single shot calibration failed:", err);
      setSingleShotCalibrationStatusInStore(projectId, shotId, 'error');
      toast.error(`Phân cảnh hiệu chuẩn Thất bại: ${err.message}`);
    }
  }, [projectId, styleId, promptLanguage, shots, directorProject?.cinematographyProfileId, setSingleShotCalibrationStatusInStore]);

  // AITạoNội dung từng tập
  const handleGenerateSynopses = useCallback(async () => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }
    
    setSynopsisStatus('generating');
    toast.info(`\u6b63\u5728cho ${episodeRawScripts.length} Đặt TạoNội dung...`);
    
    try {
      const result = await generateEpisodeSynopses(
        projectId,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform,
          baseUrl: featureConfig.baseUrl,
          model: featureConfig.models?.[0],
        },
        (current, total, msg) => {
          console.log(`[ScriptView] Synopsis: ${msg}`);
        }
      );
      
      if (result.success) {
        setSynopsisStatus('completed');
        setMissingSynopsisCount(0);
        toast.success(`phác thảo TạoHoàn thành！Đã rồicho ${result.generatedCount} Đặt TạoPhác thảo`);
      } else {
        throw new Error(result.error || 'phác thảo TạoThất bại');
      }
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] Synopsis generation failed:", err);
      setSynopsisStatus('error');
      toast.error(`phác thảo TạoThất bại: ${err.message}`);
    }
  }, [projectId, episodeRawScripts.length]);

  // tay\u52a8Kích hoạt AI Nhân vật\u6821\u51c6（chứa\u591abiến thể sân khấuTự động Tạo）
  // Lưu ý：Nhân vật\u6821\u51c6\u662fđộc lập\u6b65\u9aa4，\u4e0d\u4f9d\u8d56Góc nhìnPhân tích，\u53ef\u968f\u65f6\u6839\u636e\u6700\u65b0\u6570\u636e\u6267được rồi
  const handleCalibrateCharacters = useCallback(async () => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }
    
    const background = scriptProject?.projectBackground;
    
    if (!background) {
      toast.error('thiếu\u5c11Kịch bảnNềthông tin');
      return;
    }
    
    // \u68c0\u67e5 episodeRawScripts tồn tại
    if (!episodeRawScripts || episodeRawScripts.length === 0) {
      toast.error('thiếu\u5c11\u5206đặtKịch bảdữ liệu，\u8bf7\u91cd\u65b0NhậpKịch bảnhoặcsử dụng\u65b0\u7248Nhậpchức năng');
      console.error('[handleCalibrateCharacters] episodeRawScripts cho\u7a7ahoặc không tồn tại');
      return;
    }
    
    // Từ tập Kịch bảntrong\u91cd\u65b0Trích xuất Tất cảNhân vật（thay vìsử dụnghiện tại scriptData.characters）
    const rawCharacters = extractAllCharactersFromEpisodes(episodeRawScripts);
    
    if (rawCharacters.length === 0) {
      toast.error('\u672a\u80fdtừKịch bảntrongTrích xuấtĐếnNhân vật');
      return;
    }
    
    console.log('[handleCalibrateCharacters] Bắt đầu\u6821\u51c6:', {
      rawCharacterCount: rawCharacters.length,
      episodeCount: episodeRawScripts.length,
      hasBackground: !!background,
    });
    
    addSecondPass('characters');
    setScriptCalibrationState(projectId, {
      characterCalibrationStatus: 'calibrating',
      calibrationDialogOpen: false,
      pendingCalibrationCharacters: null,
      pendingFilteredCharacters: [],
    });
    toast.info(`\u6b63\u5728 AI \u6821\u51c6 ${rawCharacters.length} Nh gốcân vật...`);
    
    try {
      // === bước đầu tiên：AI \u6821\u51c6Nhân vật ===
      // \u4fdd\u7559\u4e0alần\u6821\u51c6Nhân vật，\u9632\u6b62 AI \u6bcflầnkết quả\u4e0dmột\u81f4\u5bfc\u81f4Nhân vật\u4e22\u5931
      const existingCalibrated = scriptData?.characters?.map(c => ({
        id: c.id,
        name: c.name,
        importance: (c.tags?.includes('protagonist') ? 'protagonist' :
                     c.tags?.includes('supporting') ? 'supporting' :
                     c.tags?.includes('minor') ? 'minor' : 'extra') as 'protagonist' | 'supporting' | 'minor' | 'extra',
        appearanceCount: 1,
        role: c.role,
        age: c.age,
        gender: c.gender,
        relationships: c.relationships,
        nameVariants: [c.name],
        visualPromptEn: c.visualPromptEn,
        visualPromptZh: c.visualPromptZh,
        identityAnchors: c.identityAnchors,
        negativePrompt: c.negativePrompt,
      })) || [];
      
      // Thống nhất có được cấu hình từ ánh xạ dịch vụ，\u4e0d\u9700\u8981tay\u52a8\u4f20\u53c2
      const calibResult = await calibrateCharacters(
        rawCharacters,
        background,
        episodeRawScripts,
        { previousCharacters: existingCalibrated, promptLanguage, strictness: scriptProject?.calibrationStrictness || 'normal' }
      );
      
      // \u8f6c\u6362\u5e76Cập nhậtNhân vậdanh sách t（\u4fdd\u7559nguyên bảdữ liệu）
      const sortedChars = sortByImportance(calibResult.characters);
      
      // \u4e0dMột lần nữa\u786c\u7f16\u7801Lọc，\u7531 calibrator \u6839\u636e\u4e25\u683c\u5ea6\u7edfmột\u5904\u7406
      let newCharacters = convertToScriptCharacters(sortedChars, rawCharacters, promptLanguage);
      if (newCharacters.length === 0) {
        const currentProject = useScriptStore.getState().projects[projectId];
        const resolvedCalibrationCharacters = resolveSafeScriptCharacters([], {
          existingCharacters: currentProject?.scriptData?.characters,
          seriesMetaCharacters: currentProject?.seriesMeta?.characters,
          rawCharacters,
        });
        newCharacters = resolvedCalibrationCharacters.characters;
        console.warn(`[handleCalibrateCharacters] AI character calibration returned empty result, recovered characters from ${resolvedCalibrationCharacters.source}.`);
        toast.warning('AI Nhân vật\u6821\u51c6Quay lại\u7a7akết quả，Đã rồi\u56de\u9000Đến\u73b0CóNhân vậdanh sách t，\u8bf7Xác nhận\u540eLưu');
      }
      
      console.log('[ScriptView] Nhân vậtKết quả hiệu chuẩn:', calibResult.analysisNotes);
      
      // === Không.Hai\u6b65：\u81ea\u52a8Phát hiện\u5e76TạoNh nhiều giai đoạnân vật ===
      const totalEpisodes = episodeRawScripts.length;
      const multiStageHint = detectMultiStageHints(background.outline || '', totalEpisodes);
      
      console.log('[handleCalibrateCharacters] \u591a\u9636\u6bb5Phát hiệnkết quả:', multiStageHint);
      
      if (multiStageHint.suggestMultiStage) {
        toast.info('Phát hiệnĐếnNh nhiều giai đoạnân vật\u7ebf\u7d22，\u6b63\u5728Phân tíchnhân vật chính\u9636\u6bb5thay đổi...');
        setStageAnalysisStatus('analyzing');
        
        try {
          console.log('[handleCalibrateCharacters] Bắt đầu AI Phân tíchNhân vật\u9636\u6bb5...');
          // Thống nhất có được cấu hình từ ánh xạ dịch vụ，\u4e0d\u9700\u8981tay\u52a8\u4f20\u53c2
          const analyses = await analyzeCharacterStages(
            background,
            newCharacters,
            totalEpisodes,
            promptLanguage
          );
          
          console.log('[handleCalibrateCharacters] AI Phân tích kết quả:', analyses);
          
          // Thống kê\u9700\u8981Nh nhiều giai đoạnân vật
          const multiStageChars = analyses.filter(a => a.needsMultiStage);
          console.log('[handleCalibrateCharacters] \u9700\u8981Nh nhiều giai đoạnân vật:', multiStageChars.map(c => c.characterName));
          
          if (multiStageChars.length > 0) {
            // cho\u6bcfmột\u9700\u8981Nh nhiều giai đoạnân vậtTạoGiai đoạn Nhân vật
            const newStageCharacters: import("@/types/script").ScriptCharacter[] = [];
            let stageCount = 0;
            
            for (const analysis of multiStageChars) {
              // Tìm Cơ bảnNhân vật
              const baseCharIndex = newCharacters.findIndex(c => c.name === analysis.characterName);
              if (baseCharIndex === -1) {
                console.log(`[StageAnalysis] \u627e\u4e0dĐếnNhân vật ${analysis.characterName}，bỏ qua`);
                continue;
              }
              const baseChar = newCharacters[baseCharIndex];
              
              // cho\u6bcfGiai đoạn Tạođộc lậpcủa ScriptCharacter
              const stageCharIds: string[] = [];
              for (let stageIdx = 0; stageIdx < analysis.stages.length; stageIdx++) {
                const stage = analysis.stages[stageIdx];
                // sử dụng\u7d22\u5f15\u786e\u4fdd ID \u552fmột，\u907f\u514d\u4e0d\u540cNhân vậtcủa\u76f8\u540c\u9636\u6bb5tên\u5bfc\u81f4\u91cd\u590d key
                const stageCharId = `${baseChar.id}_stage_${stageIdx}_${stage.name.replace(/\s+/g, '_')}`;
                stageCharIds.push(stageCharId);
                
                // TạoGiai đoạn Nhân vật
                const stageChar: import("@/types/script").ScriptCharacter = {
                  id: stageCharId,
                  name: `${baseChar.name}（${stage.name}）`,
                  gender: baseChar.gender,
                  age: stage.ageDescription,
                  personality: baseChar.personality,
                  role: `${stage.stageDescription}\n\nNh gốcân vậtNền：${baseChar.role || ''}`,
                  traits: baseChar.traits,
                  appearance: baseChar.appearance,
                  relationships: baseChar.relationships,
                  tags: [...(baseChar.tags || []), stage.name, 'Giai đoạn Nhân vật'],
                  // \u591a\u9636\u6bb5\u5173\u8054
                  baseCharacterId: baseChar.id,
                  stageInfo: {
                    stageName: stage.name,
                    episodeRange: stage.episodeRange,
                    ageDescription: stage.ageDescription,
                  },
                  consistencyElements: analysis.consistencyElements,
                  // \u4e13\u4e1aLời nhắc trực quan
                  visualPromptEn: promptLanguage === 'zh' ? undefined : [
                    analysis.consistencyElements.facialFeatures,
                    analysis.consistencyElements.bodyType,
                    analysis.consistencyElements.uniqueMarks,
                    stage.visualPromptEn,
                  ].filter(Boolean).join(', '),
                  visualPromptZh: promptLanguage === 'en' ? undefined : stage.visualPromptZh,
                  // === sự kế thừaCơ bảnNhân vậtcủaNeo nhận dạng lớp 6 ===
                  identityAnchors: baseChar.identityAnchors,
                  negativePrompt: baseChar.negativePrompt,
                };
                
                newStageCharacters.push(stageChar);
                stageCount++;
              }
              
              // Cập nhậtCơ bảnNhân vậtcủa stageCharacterIds，\u5e76\u6807\u8bb0cho\u7d22\u5f15Nhân vật（\u4e0d\u9700\u8981\u5355\u72ecTạo\u5f62\u8c61）
              newCharacters[baseCharIndex] = {
                ...baseChar,
                stageCharacterIds: stageCharIds,
                consistencyElements: analysis.consistencyElements,
                // \u6807\u8bb0cho\u7236Nhân vật，\u4e0d\u9700\u8981\u5355\u72ecTạo\u5f62\u8c61，\u53ea\u4f5cchoGiai đoạn Nhân vậtcủa\u5206\u7ec4
                tags: [...(baseChar.tags || []).filter(t => t !== 'protagonist'), '\u7236Nhân vật'],
                notes: `\u6b64Nhân vậtCó ${stageCharIds.length} một\u9636\u6bb5Phiên bản，\u8bf7\u5206\u522bcho\u5404\u9636\u6bb5Phiên bảnTạo\u5f62\u8c61`,
              };
              
              console.log(`[StageAnalysis] choNhân vật ${analysis.characterName} Tạo\u4e86 ${analysis.stages.length} Giai đoạn Nhân vật`);
            }
            
            // \u5408\u5e76Giai đoạn Nhân vậtĐếnNhân vậdanh sách t，Giai đoạn Nhân vật\u7d27\u8ddf\u5728\u5176\u7236Nhân vật\u540e\u9762
            const sortedCharacters: import("@/types/script").ScriptCharacter[] = [];
            for (const char of newCharacters) {
              sortedCharacters.push(char);
              // Chẳng hạn như\u679c\u8fd9Nhân vậtCóGiai đoạn Nhân vật，\u7d27\u8ddf\u5728\u540e\u9762Thêm
              if (char.stageCharacterIds && char.stageCharacterIds.length > 0) {
                const stageChars = newStageCharacters.filter(sc => sc.baseCharacterId === char.id);
                sortedCharacters.push(...stageChars);
              }
            }
            newCharacters = sortedCharacters;
            
            setStageAnalysisStatus('completed');
            setMultiStageHints(multiStageHint.hints);
            setSuggestMultiStage(false); // Đã hoàn thành，\u4e0dMột lần nữaGợi ý
            
            toast.success(`Nh nhiều giai đoạnân vậtTạoHoàn thành！cho ${multiStageChars.length} Nhân vậtTạo\u4e86 ${stageCount} Giai đoạn Nhân vật`);
          } else {
            setStageAnalysisStatus('completed');
            console.log('[StageAnalysis] \u6ca1CóNhân vật\u9700\u8981\u591a\u9636\u6bb5\u5f62\u8c61');
          }
        } catch (stageErr) {
          console.error('[ScriptView] \u591a\u9636\u6bb5Phân tíchThất bại:', stageErr);
          setStageAnalysisStatus('error');
          // \u4e0d\u963b\u6b62Chúa ơiquá trình，tiếp tụcLưuCơ bảnNhân vật
        }
      }
      
      // === Không.ba\u6b65：LưuĐến\u4e34\u65f6Trạng thái，MởXác nhận\u5f39cửa sổ ===
      setScriptCalibrationState(projectId, {
        pendingCalibrationCharacters: newCharacters,
        pendingFilteredCharacters: calibResult.filteredCharacters || [],
        calibrationDialogOpen: true,
      });
      
      setCharacterCalibrationStatus('completed');
      removeSecondPass('characters');
      setCharacterCalibrationResult({
        filteredCount: calibResult.filteredCharacters.length,
        mergedCount: calibResult.mergeRecords.length,
        finalCount: newCharacters.length,
      });
      
      toast.info(`Nhân vật\u6821\u51c6Hoàn thành，tổng cộng ${newCharacters.length} Nhân vật，\u8bf7Xác nhậnkết quả`);
      
      if (calibResult.filteredWords.length > 0) {
        console.log('[ScriptView] Lọccủa\u975eNhân vật\u8bcd:', calibResult.filteredWords);
      }
      if (calibResult.mergeRecords.length > 0) {
        console.log('[ScriptView] \u5408\u5e76Bản ghi:', calibResult.mergeRecords);
      }
    } catch (error) {
      const err = error as Error;
      console.error('[ScriptView] Nhân vậtHiệu chỉnh Thất bại:', err);
      setCharacterCalibrationStatus('error');
      removeSecondPass('characters');
      toast.error(`Nhân vậtHiệu chỉnh Thất bại: ${err.message}`);
    }
  }, [scriptData, scriptProject, episodeRawScripts, projectId, promptLanguage, setScriptData, viewpointAnalysisStatus, addSecondPass, removeSecondPass, setScriptCalibrationState]);

  // Xác nhậnNhân vậtKết quả hiệu chuẩn
  const handleConfirmCalibration = useCallback((
    keptCharacters: import("@/types/script").ScriptCharacter[],
    filteredCharacters: FilteredCharacterRecord[]
  ) => {
    const currentProject = useScriptStore.getState().projects[projectId];
    const currentScriptData = currentProject?.scriptData;
    const safeCharacters = keptCharacters.length > 0
      ? keptCharacters
      : resolveSafeScriptCharacters([], {
          existingCharacters: currentProject?.scriptData?.characters,
          seriesMetaCharacters: currentProject?.seriesMeta?.characters,
        }).characters;
    if (currentScriptData) {
      setScriptData(projectId, {
        ...currentScriptData,
        characters: safeCharacters,
      });
      console.log('[handleConfirmCalibration] Đã Lưbạn lưu trữ，Nhân vật\u6570:', safeCharacters.length);
    }
    setLastFilteredCharacters(projectId, filteredCharacters);
    setScriptCalibrationState(projectId, {
      calibrationDialogOpen: false,
      pendingCalibrationCharacters: null,
      pendingFilteredCharacters: [],
    });
    toast.success(`Nhân vật\u6821\u51c6Xác nhận: ${safeCharacters.length} Nhân vậtĐã Lưu`);
    
    // P2b: \u6821\u51c6viết lại SeriesMeta
    try {
      const store = useScriptStore.getState();
      const meta = store.projects[projectId]?.seriesMeta;
      if (meta) {
        const updates = syncToSeriesMeta(meta, 'character', { characters: safeCharacters });
        if (Object.keys(updates).length > 0) {
          store.updateSeriesMeta(projectId, updates);
          console.log('[handleConfirmCalibration] SeriesMeta Nhân vậtviết lạiHoàn thành');
        }
        // \u91cd\u65b0Tạo\u5143\u6570\u636e MD
        const mdContent = exportProjectMetadata(projectId);
        store.setMetadataMarkdown(projectId, mdContent);
      }
    } catch (e) {
      console.warn('[handleConfirmCalibration] SeriesMeta viết lạiThất bại:', e);
    }
  }, [projectId, setScriptData, setLastFilteredCharacters, setScriptCalibrationState]);

  // HuỷNhân vật\u6821\u51c6
  const handleCancelCalibration = useCallback(() => {
    setScriptCalibrationState(projectId, {
      calibrationDialogOpen: false,
      pendingCalibrationCharacters: null,
      pendingFilteredCharacters: [],
    });
    toast.info('Đã huỷNhân vật\u6821\u51c6');
  }, [projectId, setScriptCalibrationState]);

  // \u6821\u51c6\u4e25\u683c\u5ea6thay đổi\u66f4
  const handleCalibrationStrictnessChange = useCallback((strictness: CalibrationStrictness) => {
    setCalibrationStrictness(projectId, strictness);
  }, [projectId, setCalibrationStrictness]);

  // từLà Lọcdanh sách\u6062\u590dNhân vật
  const handleRestoreFilteredCharacter = useCallback((characterName: string) => {
    const currentScriptData = useScriptStore.getState().projects[projectId]?.scriptData;
    if (!currentScriptData) return;
    
    const newChar: import("@/types/script").ScriptCharacter = {
      id: `char_restored_${Date.now()}`,
      name: characterName,
      tags: ['extra', 'restored'],
    };
    
    setScriptData(projectId, {
      ...currentScriptData,
      characters: [...currentScriptData.characters, newChar],
    });
    
    const current = useScriptStore.getState().projects[projectId]?.lastFilteredCharacters || [];
    setLastFilteredCharacters(projectId, current.filter(fc => fc.name !== characterName));
    toast.success(`Đã rồi\u6062\u590dNhân vật: ${characterName}`);
  }, [projectId, setScriptData, setLastFilteredCharacters]);

  // NhậpKịch bản\u540ePhát hiện\u662f\u5426\u9700\u8981Nh nhiều giai đoạnân vật（\u4ec5để trưng bàyGợi ý）
  const handleAnalyzeCharacterStages = useCallback(async () => {
    // Đã rồi\u6574\u5408Đến handleCalibrateCharacters trong，\u76f4\u63a5\u8c03sử dụng\u5373\u53ef
    await handleCalibrateCharacters();
  }, [handleCalibrateCharacters]);

  // NhậpKịch bản\u540ePhát hiện\u662f\u5426\u9700\u8981Nh nhiều giai đoạnân vật
  useEffect(() => {
    if (importStatus === 'ready' && scriptProject?.projectBackground?.outline) {
      const result = detectMultiStageHints(
        scriptProject.projectBackground.outline,
        episodeRawScripts.length
      );
      setMultiStageHints(result.hints);
      setSuggestMultiStage(result.suggestMultiStage);
      
      if (result.suggestMultiStage) {
        console.log('[ScriptView] Phát hiệnĐếnNh nhiều giai đoạnân vật\u7ebf\u7d22:', result.hints);
      }
    }
  }, [importStatus, scriptProject?.projectBackground?.outline, episodeRawScripts.length]);

  // Generate script from idea (chế độ sáng tạo)
  // AIPhân tíchNgười dùngĐầu vào，TạoTiêu chuẩnĐịnh dạngKịch bản，\u7136\u540eđiNhậpquá trình
  const handleGenerateFromIdea = useCallback(async (idea: string) => {
    if (!idea.trim()) {
      toast.error("Vui lòng nhậpcâu chuyện\u521b\u610f");
      return;
    }

    // Use feature router to get script_analysis config
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }

    setParseStatus(projectId, "parsing");
    toast.info("\u6b63\u5728\u6839\u636e\u521b\u610fTạoKịch bản...");

    try {
      const allKeysString = featureConfig.allApiKeys.join(',');
      const provider = featureConfig.platform === 'zhipu' ? 'zhipu' : 'openai';
      const baseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
      const model = featureConfig.models?.[0];
      
      if (!baseUrl || !model) {
        toast.error('\u8bf7đầu tiên\u5728Cài đặtTrung bình Cấu hình「Kịch bảnPhân tích」của Base URL vàMô hình');
        setParseStatus(projectId, "error", "thiếu\u5c11 Base URL hoặcMô hình cấu hình");
        return;
      }

      console.log(`[ScriptView] Generating script from idea with ${featureConfig.allApiKeys.length} API keys`);

      // bước đầu tiên：AI TạoKịch bảvăn bản（\u7b26\u5408NhậpĐịnh dạng）
      const generatedScript = await generateScriptFromIdea(idea, {
        apiKey: allKeysString,
        provider: provider as string,
        baseUrl,
        model,
        language,
        targetDuration,
        sceneCount: sceneCount ? parseInt(sceneCount) : undefined,
        shotCount: shotCount ? parseInt(shotCount) : undefined,
        styleId,
      });

      // LưuTạocủaKịch bảnĐến rawScript（\u65b9\u4fbfNgười dùng\u67e5\u770b/Chỉnh sửa）
      setRawScript(projectId, generatedScript);
      setParseStatus(projectId, "idle");
      toast.success('Kịch bảnTạoThành công！\u6b63\u5728\u81ea\u52a8Nhập...');

      // Không.Hai\u6b65：\u81ea\u52a8\u8c03sử dụngNhậpquá trình（\u590dsử dụngNhậpTất cả\u540e\u7eed\u903b\u8f91）
      await handleImportFullScript(generatedScript);
      
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] Script generation failed:", err);
      setParseStatus(projectId, "error", err.message);
      toast.error(`Kịch bảnTạoThất bại: ${err.message}`);
    }
  }, [projectId, language, targetDuration, sceneCount, shotCount, styleId, setRawScript, setParseStatus, handleImportFullScript]);

  // Parse screenplay (AIphân tích cú pháp)
  const handleParse = useCallback(async () => {
    if (!rawScript.trim()) {
      toast.error("Vui lòng nhậpKịch bảnNội dung");
      return;
    }

    // Use feature router to get script_analysis config (with multi-key support)
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }

    setParseStatus(projectId, "parsing");

    try {
      // Pass all API keys (comma-separated) for rotation
      const allKeysString = featureConfig.allApiKeys.join(',');
      const provider = featureConfig.platform === 'zhipu' ? 'zhipu' : 'openai';
      
      console.log(`[ScriptView] Parsing with ${featureConfig.allApiKeys.length} API keys`);

      const baseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
      const model = featureConfig.models?.[0];
      if (!baseUrl || !model) {
        toast.error('\u8bf7đầu tiên\u5728Cài đặtTrung bình Cấu hình「Kịch bảnPhân tích」của Base URL vàMô hình');
        setParseStatus(projectId, "error", "thiếu\u5c11 Base URL hoặcMô hình cấu hình");
        return;
      }

      const result = await parseScript(rawScript, {
        apiKey: allKeysString, // Pass all keys for rotation
        provider: provider as string,
        baseUrl,
        model,
        language,
        sceneCount: sceneCount ? parseInt(sceneCount) : undefined,
        shotCount: shotCount ? parseInt(shotCount) : undefined,
      });

      // Đảm bảo C.óepisodestừ\u6bb5
      if (!result.episodes || result.episodes.length === 0) {
        result.episodes = [{
          id: "default",
          index: 1,
          title: result.title || "Tập 1",
          sceneIds: result.scenes.map((s) => s.id),
        }];
      }

      setScriptData(projectId, result);
      setParseStatus(projectId, "ready");
      toast.success(
        `phân tích cú phápHoàn thành: ${result.characters.length} Nhân vật, ${result.scenes.length} Cảnh`
      );

      // Tự động TạoPhân cảnh
      await handleGenerateShots(result);
    } catch (error) {
      const err = error as Error;
      console.error("[ScriptView] Parse failed:", err);
      setParseStatus(projectId, "error", err.message);
      toast.error(`phân tích cú phápThất bại: ${err.message}`);
    }
  }, [
    rawScript,
    language,
    sceneCount,
    shotCount,
    projectId,
    setParseStatus,
    setScriptData,
  ]);

  // Generate shot list with streaming updates
  const handleGenerateShots = useCallback(
    async (data?: typeof scriptData) => {
      const targetData = data || scriptData;
      if (!targetData) {
        return;
      }

      // Use feature router for script_analysis (shot generation uses same API)
      const featureConfig = getFeatureConfig('script_analysis');
      if (!featureConfig) {
        return;
      }

      setShotStatus(projectId, "generating");
      
      // Clear existing shots and prepare for streaming updates
      setShots(projectId, []);
      let accumulatedShots: import("@/types/script").Shot[] = [];

      try {
        // Pass all API keys for rotation
        const allKeysString = featureConfig.allApiKeys.join(',');
        const provider = featureConfig.platform === 'zhipu' ? 'zhipu' : 'openai';
        
        console.log(`[ScriptView] Generating shots with ${featureConfig.allApiKeys.length} API keys`);

        // Build character descriptions from library if available
        const characterDescriptions: Record<string, string> = {};
        targetData.characters.forEach((char) => {
          const libChar = allCharacters.find(
            (c) => c.name === char.name || c.name.includes(char.name)
          );
          if (libChar) {
            characterDescriptions[char.id] =
              libChar.visualTraits || libChar.description || "";
          }
        });

        // Streaming callback: update UI immediately when each scene completes
        const onShotsGenerated = (newShots: import("@/types/script").Shot[], sceneIndex: number) => {
          // Re-index new shots to be sequential
          const reindexedShots = newShots.map((shot, idx) => ({
            ...shot,
            id: `shot-${accumulatedShots.length + idx + 1}`,
            index: accumulatedShots.length + idx + 1,
          }));
          
          accumulatedShots = [...accumulatedShots, ...reindexedShots];
          
          // Update UI immediately
          setShots(projectId, [...accumulatedShots]);
          
          console.log(`[ScriptView] Cảnh ${sceneIndex + 1} Hoàn thành，Đã Tạo ${accumulatedShots.length} Phân cảnh`);
        };

        // Progress callback
        const onProgress = (completed: number, total: number) => {
          console.log(`[ScriptView] Tiến độ: ${completed}/${total} Cảnh`);
        };

        const baseUrl = featureConfig.baseUrl?.replace(/\/+$/, '');
        const model = featureConfig.models?.[0];
        if (!baseUrl || !model) {
          toast.error('\u8bf7đầu tiên\u5728Cài đặtTrung bình Cấu hình「Kịch bảnPhân tích」của Base URL vàMô hình');
          setShotStatus(projectId, "error", "thiếu\u5c11 Base URL hoặcMô hình cấu hình");
          return;
        }

        const result = await generateShotList(
          targetData,
          {
            apiKey: allKeysString,
            provider: provider as string,
            baseUrl,
            model,
            targetDuration,
            styleId,
            characterDescriptions,
            shotCount: shotCount ? parseInt(shotCount) : undefined,
          },
          onProgress,
          onShotsGenerated // Truyền trực tuyến cuộc gọi lại
        );

        // Final update with all shots (in case streaming missed any)
        setShots(projectId, result);
        setShotStatus(projectId, "ready");
        toast.success(`TạoHoàn thành: ${result.length} Phân cảnh`);
      } catch (error) {
        const err = error as Error;
        console.error("[ScriptView] Shot generation failed:", err);
        setShotStatus(projectId, "error", err.message);
        toast.error(`Phân cảnhTạoThất bại: ${err.message}`);
      }
    },
    [
      scriptData,
      targetDuration,
      styleId,
      shotCount,
      projectId,
      allCharacters,
      setShotStatus,
      setShots,
    ]
  );

  // \u8df3\u8f6cĐếnThư viện nhân vật（\u4f20\u9012\u6570\u636eĐếnTạo\u63a7\u5236\u53f0）
  const handleGoToCharacterLibrary = useCallback(
    (characterId: string) => {
      // \u67e5\u627eNhân vật\u6570\u636e
      const character = scriptData?.characters.find((c) => c.id === characterId);
      if (!character) {
        setActiveTab("characters");
        toast.info("Đã rồi\u8df3\u8f6cĐếnThư viện nhân vật");
        return;
      }

      // \u68c0\u67e5\u662f\u5426Đã rồi\u5173\u8054Thư viện nhân vật
      if (character.characterLibraryId) {
        // Đã rồi\u5173\u8054，\u76f4\u63a5\u8df3\u8f6c\u5e76\u9009trong
        selectLibraryCharacter(character.characterLibraryId);
        setActiveTab("characters");
        toast.info(`Đã rồi\u8df3\u8f6cĐếnThư viện nhân vật，\u9009trong「${character.name}」`);
        return;
      }

      // \u4f20\u9012Nhân vật\u6570\u636eĐếnThư viện nhân vậtTạo\u63a7\u5236\u53f0（chứaBậc thầy đẳng cấp thế giới Tạo là Lời nhắc trực quan）
      // \u83b7\u53d6Kịch bảsiêu dữ liệutrongcủathông tin tuổi tác
      const background = scriptProject?.projectBackground;
      
      goToCharacterWithData({
        name: character.name,
        gender: character.gender,
        age: character.age,
        personality: character.personality,
        role: character.role,
        traits: character.traits,
        skills: character.skills,
        keyActions: character.keyActions,
        appearance: character.appearance,
        relationships: character.relationships,
        tags: character.tags,
        notes: character.notes,
        styleId,
        // === Tùy chọn ngôn ngữ nhắc nhở ===
        promptLanguage: scriptProject?.promptLanguage || 'zh',
        // === NH chuyên nghiệpân vậlĩnh vực thiết kế t（Bậc thầy đẳng cấp thế giới Tạo）===
        visualPromptEn: character.visualPromptEn,
        visualPromptZh: character.visualPromptZh,
        // === Neo nhận dạng lớp 6（Nhân vậtTính nhất quán）===
        identityAnchors: character.identityAnchors,
        negativePrompt: character.negativePrompt,
        // === Nh nhiều giai đoạnân vậtHỗ trợ ===
        stageInfo: character.stageInfo,
        consistencyElements: character.consistencyElements,
        // === thông tin tuổi tác（từKịch bảtruyền dữ liệu phần tử n）===
        storyYear: background?.storyStartYear,
        era: background?.era || background?.timelineSetting,
        // === Đặt thông qua phạm vi ===
        sourceEpisodeIndex: activeEpisodeIndex ?? undefined,
        sourceEpisodeId: activeEpisodeId,
      });

      toast.success(`Đã rồi\u8df3\u8f6cĐếnThư viện nhân vật，Nhân vật「${character.name}」thông tinĐã rồi\u586b\u5145ĐếnTạo\u63a7\u5236\u53f0`);
    },
    [scriptData, styleId, setActiveTab, selectLibraryCharacter, goToCharacterWithData, activeEpisodeIndex, activeEpisodeId]
  );

  // \u83b7\u53d6hiện tạiPhong cáchcủa tokens（từ\u7edfmộtPhong cáthư viện chNhập）
  const getStyleTokensLocal = useCallback((currentStyleId: string) => {
    return getStyleTokens(currentStyleId);
  }, []);

  // \u8df3\u8f6cĐếnThư viện cảnh（Sử dụng AI Ph.ân tíchcủa\u5b8csố nguyên\u636e，hoặcCơ bảnCảnh thông tin）
  const handleGoToSceneLibrary = useCallback(
    (sceneId: string) => {
      // Tìm Cảnh dữ liệu
      const scene = scriptData?.scenes.find((s) => s.id === sceneId);
      if (!scene) {
        setActiveTab("scenes");
        toast.info("Đã rồi\u8df3\u8f6cĐếnThư viện cảnh");
        return;
      }

      const hasViewpoints = scene.viewpoints && scene.viewpoints.length > 0;
      const hasCalibrationData = scene.architectureStyle || scene.keyProps?.length || scene.lightingDesign;

      if (hasViewpoints) {
        // 【\u5b8c\u6574Đường dẫn】Có AI Góc nhìnPhân tích kết quả，\u6784\u5efa\u8054\u5408\u56fe\u6570\u636e
        const invalidViewpoints = scene.viewpoints!.filter(vp => !vp.name || !vp.id);
        if (invalidViewpoints.length > 0) {
          console.warn('[handleGoToSceneLibrary] khám phá\u4e0d\u5b8c\u6574của viewpoints:', invalidViewpoints);
          toast.warning('Góc nhìdữ liệu\u4e0d\u5b8c\u6574，\u8bf7\u91cd\u65b0\u6267được rồi"AI Phân tíchCảnhGóc nhìn"');
          return;
        }

        const styleTokens = getStyleTokens(styleId);
        const contactSheetData = buildContactSheetDataFromViewpoints(
          scene.viewpoints!,
          scene,
          shots,
          styleTokens,
          '16:9'
        );

        console.log('[handleGoToSceneLibrary] Sử dụng AI Ph.ân tích\u6570\u636eTạo\u8054\u5408\u56fe:', {
          sceneId: scene.id,
          viewpointsCount: scene.viewpoints!.length,
          pendingViewpointsCount: contactSheetData.viewpoints.length,
          contactSheetPromptsCount: contactSheetData.contactSheetPrompts.length,
        });

        goToSceneWithData({
          name: scene.name || scene.location,
          location: scene.location,
          time: scene.time,
          atmosphere: scene.atmosphere,
          styleId,
          tags: scene.tags,
          notes: scene.notes,
          visualPrompt: scene.visualPrompt,
          visualPromptEn: scene.visualPromptEn,
          architectureStyle: scene.architectureStyle,
          lightingDesign: scene.lightingDesign,
          colorPalette: scene.colorPalette,
          eraDetails: scene.eraDetails,
          keyProps: scene.keyProps,
          spatialLayout: scene.spatialLayout,
          viewpoints: contactSheetData.viewpoints,
          contactSheetPrompts: contactSheetData.contactSheetPrompts,
          // === Đặt thông qua phạm vi ===
          sourceEpisodeIndex: activeEpisodeIndex ?? undefined,
          sourceEpisodeId: activeEpisodeId,
          // === Tùy chọn ngôn ngữ nhắc nhở ===
          promptLanguage: scriptProject?.promptLanguage || 'zh',
        });

        const viewpointCount = scene.viewpoints!.length;
        toast.success(
          `Đã rồi\u8df3\u8f6cĐếnThư viện cảnh，Cảnh「${scene.name || scene.location}」Đã rồi\u586b\u5145\n` +
          `✔ ${viewpointCount} một AI Phân tíchGóc nhìnĐã rồi\u52a0\u8f7d`
        );
      } else {
        // 【\u7b80\u5355Đường dẫn】không cóGóc nhìnPhân tích（chế độ sáng tạohoặc\u672a\u6821\u51c6），\u4f20\u9012Cơ bảnCảnh thông tin
        goToSceneWithData({
          name: scene.name || scene.location,
          location: scene.location,
          time: scene.time,
          atmosphere: scene.atmosphere,
          styleId,
          tags: scene.tags,
          notes: scene.notes,
          ...(hasCalibrationData && {
            visualPrompt: scene.visualPrompt,
            visualPromptEn: scene.visualPromptEn,
            architectureStyle: scene.architectureStyle,
            lightingDesign: scene.lightingDesign,
            colorPalette: scene.colorPalette,
            eraDetails: scene.eraDetails,
            keyProps: scene.keyProps,
            spatialLayout: scene.spatialLayout,
          }),
          // === Đặt thông qua phạm vi ===
          sourceEpisodeIndex: activeEpisodeIndex ?? undefined,
          sourceEpisodeId: activeEpisodeId,
          // === Tùy chọn ngôn ngữ nhắc nhở ===
          promptLanguage: scriptProject?.promptLanguage || 'zh',
        });

        toast.success(
          `Đã rồi\u8df3\u8f6cĐếnThư viện cảnh，Cảnh「${scene.name || scene.location}」Cơ bảthông tinĐã rồi\u586b\u5145`
        );
      }
    },
    [scriptData, styleId, setActiveTab, goToSceneWithData, shots, activeEpisodeIndex, activeEpisodeId]
  );

  // \u8df3\u8f6cĐếnAIgiám đốc
  const handleGoToDirector = useCallback(
    (shotId: string) => {
      // \u67e5\u627ePhân cảnh dữ liệu
      const shot = shots.find((s) => s.id === shotId);
      if (!shot) {
        setActiveTab("director");
        toast.info("Đã rồi\u8df3\u8f6cĐếnAIgiám đốc");
        return;
      }

      // Tìm Cảnh thông tin
      const scene = scriptData?.scenes.find((s) => s.id === shot.sceneRefId);

      // \u7ec4\u5408câu chuyệnprompt: Cảnh + Hành động + đối thoại
      const promptParts: string[] = [];
      if (scene) {
        promptParts.push(`Cảnh：${scene.location || scene.name}`);
        if (scene.time) promptParts.push(`Thời gian：${scene.time}`);
        if (scene.atmosphere) promptParts.push(`bầu không khí：${scene.atmosphere}`);
      }
      if (shot.actionSummary) {
        promptParts.push(`\nHành động：${shot.actionSummary}`);
      }
      if (shot.dialogue) {
        promptParts.push(`đối thoại：「${shot.dialogue}」`);
      }

      const storyPrompt = promptParts.join("\n");

      // \u4f20\u9012\u6570\u636e\u5e76\u8df3\u8f6c - Tiến sĩ đơnân cảnh sceneCount=1
      goToDirectorWithData({
        storyPrompt,
        characterNames: shot.characterNames,
        sceneLocation: scene?.location,
        sceneTime: scene?.time,
        shotId,
        sceneCount: 1, // Tiến sĩ đơnân cảnh
        styleId, // sự kế thừaKịch bảncủaPhong cách
        sourceType: 'shot',
        // === Đặt thông qua phạm vi ===
        sourceEpisodeIndex: activeEpisodeIndex ?? undefined,
        sourceEpisodeId: activeEpisodeId,
      });

      toast.success("Đã rồi\u8df3\u8f6cĐếnAIgiám đốc，Phân cảnh nội dungĐã rồi\u586b\u5145");
    },
    [shots, scriptData, styleId, goToDirectorWithData, setActiveTab, activeEpisodeIndex, activeEpisodeId]
  );

  // Từ Cảnh\u8df3\u8f6cĐếnAIgiám đốc（\u6574CảnhTất cảPhân cảnh）
  const handleGoToDirectorFromScene = useCallback(
    (sceneId: string) => {
      // Tìm Cảnh dữ liệu
      const scene = scriptData?.scenes.find((s) => s.id === sceneId);
      if (!scene) {
        setActiveTab("director");
        toast.info("Đã rồi\u8df3\u8f6cĐếnAIgiám đốc");
        return;
      }

      // \u67e5\u627e\u8be5CảnhHạ Tất cảPhân cảnh
      const sceneShots = shots.filter((s) => s.sceneRefId === sceneId);
      const shotCount = sceneShots.length || 1;

      // \u7ec4\u5408câu chuyệnprompt: Cảnh thông tin + Tất cảPhân cảnh nội dung
      const promptParts: string[] = [];
      promptParts.push(`Cảnh：${scene.location || scene.name}`);
      if (scene.time) promptParts.push(`Thời gian：${scene.time}`);
      if (scene.atmosphere) promptParts.push(`bầu không khí：${scene.atmosphere}`);

      if (sceneShots.length > 0) {
        promptParts.push(`\n--- Phân cảnh danh sách (${sceneShots.length}một) ---`);
        sceneShots.forEach((shot, idx) => {
          const shotDesc = [
            `\n[Phân cảnh${idx + 1}]`,
            shot.actionSummary ? `Hành động：${shot.actionSummary}` : null,
            shot.dialogue ? `đối thoại：「${shot.dialogue}」` : null,
          ].filter(Boolean).join(" ");
          promptParts.push(shotDesc);
        });
      }

      const storyPrompt = promptParts.join("\n");

      // \u6536Đặt Tất cảPhân cảnhNhân vật
      const allCharacterNames = new Set<string>();
      sceneShots.forEach((shot) => {
        shot.characterNames?.forEach((name) => allCharacterNames.add(name));
      });

      // \u4f20\u9012\u6570\u636e\u5e76\u8df3\u8f6c - Cảnh\u7ea7\u522b sceneCount=Phân cảsố thứ
      goToDirectorWithData({
        storyPrompt,
        characterNames: Array.from(allCharacterNames),
        sceneLocation: scene.location,
        sceneTime: scene.time,
        sceneCount: shotCount,
        styleId,
        sourceType: 'scene',
        // === Đặt thông qua phạm vi ===
        sourceEpisodeIndex: activeEpisodeIndex ?? undefined,
        sourceEpisodeId: activeEpisodeId,
      });

      toast.success(`Đã rồi\u8df3\u8f6cĐếnAIgiám đốc，Cảnh「${scene.name || scene.location}」Đã rồi\u586b\u5145 (${shotCount}Phân cảnh)`);
    },
    [shots, scriptData, styleId, goToDirectorWithData, setActiveTab, activeEpisodeIndex, activeEpisodeId]
  );

  // CRUD handlers - \u5c01\u88c5projectId
  // Episode sử dụng Bundle Phiên bản（\u540c\u6b65 episodeRawScripts）
  const handleAddEpisodeBundle = useCallback((title: string, synopsis: string) => {
    addEpisodeBundle(projectId, title, synopsis);
  }, [projectId, addEpisodeBundle]);

  const handleUpdateEpisodeBundle = useCallback((episodeIndex: number, updates: { title?: string; synopsis?: string }) => {
    updateEpisodeBundle(projectId, episodeIndex, updates);
  }, [projectId, updateEpisodeBundle]);

  const handleDeleteEpisodeBundle = useCallback((episodeIndex: number) => {
    deleteEpisodeBundle(projectId, episodeIndex);
    // \u6e05\u9664\u9009trongTrạng thái（Chẳng hạn như\u679cXoácủa\u662fhiện tại\u9009trongđặt）
    const ep = scriptData?.episodes?.find(e => e.index === episodeIndex);
    if (ep && selectedItemId === ep.id) {
      setSelectedItemId(null);
      setSelectedItemType(null);
    }
  }, [projectId, deleteEpisodeBundle, scriptData?.episodes, selectedItemId]);

  const handleAddScene = useCallback((scene: import("@/types/script").ScriptScene, episodeId?: string) => {
    addScene(projectId, scene, episodeId);
  }, [projectId, addScene]);

  const handleUpdateScene = useCallback((id: string, updates: Partial<import("@/types/script").ScriptScene>) => {
    updateScene(projectId, id, updates);
  }, [projectId, updateScene]);

  const handleDeleteScene = useCallback((id: string) => {
    deleteScene(projectId, id);
    if (selectedItemId === id) {
      setSelectedItemId(null);
      setSelectedItemType(null);
    }
  }, [projectId, deleteScene, selectedItemId]);

  const handleAddCharacter = useCallback((character: import("@/types/script").ScriptCharacter) => {
    addCharacter(projectId, character);
  }, [projectId, addCharacter]);

  const handleUpdateCharacter = useCallback((id: string, updates: Partial<import("@/types/script").ScriptCharacter>) => {
    updateCharacter(projectId, id, updates);
  }, [projectId, updateCharacter]);

  const handleDeleteCharacter = useCallback((id: string) => {
    deleteCharacter(projectId, id);
    if (selectedItemId === id) {
      setSelectedItemId(null);
      setSelectedItemType(null);
    }
  }, [projectId, deleteCharacter, selectedItemId]);

  const handleUpdateShot = useCallback((id: string, updates: Partial<import("@/types/script").Shot>) => {
    updateShot(projectId, id, updates);
  }, [projectId, updateShot]);

  const handleDeleteShot = useCallback((id: string) => {
    deleteShot(projectId, id);
    if (selectedItemId === id) {
      setSelectedItemId(null);
      setSelectedItemType(null);
    }
  }, [projectId, deleteShot, selectedItemId]);

  // AI Nhân vật\u67e5\u627egọi lại
  const handleAIFindCharacter = useCallback(async (query: string) => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      return {
        found: false,
        name: '',
        message: '\u8bf7đầu tiênCấu hình AI \u63a5\u53e3',
      };
    }
    
    const background = scriptProject?.projectBackground;
    if (!background) {
      return {
        found: false,
        name: '',
        message: '\u8bf7đầu tiênNhậpKịch bản',
      };
    }
    
    const existingCharacters = scriptData?.characters || [];
    
    try {
      const result = await findCharacterByDescription(
        query,
        background,
        episodeRawScripts,
        existingCharacters,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform as string,
          baseUrl: featureConfig.baseUrl,
        }
      );
      
      return {
        found: result.found,
        name: result.name,
        message: result.message,
        character: result.character,
      };
    } catch (error) {
      console.error('[handleAIFindCharacter] Lỗi:', error);
      return {
        found: false,
        name: '',
        message: '\u67e5\u627eThất bại，Xin vui lòng Thử lại',
      };
    }
  }, [scriptProject?.projectBackground, episodeRawScripts, scriptData?.characters]);

  // AI Cảnh\u67e5\u627egọi lại
  const handleAIFindScene = useCallback(async (query: string) => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      return {
        found: false,
        message: '\u8bf7đầu tiênCấu hình AI \u63a5\u53e3',
      };
    }
    
    const background = scriptProject?.projectBackground;
    if (!background) {
      return {
        found: false,
        message: '\u8bf7đầu tiênNhậpKịch bản',
      };
    }
    
    const existingScenes = scriptData?.scenes || [];
    
    try {
      const result = await findSceneByDescription(
        query,
        background,
        episodeRawScripts,
        existingScenes,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform as string,
          baseUrl: featureConfig.baseUrl,
        }
      );
      
      return {
        found: result.found,
        message: result.message,
        scene: result.scene,
      };
    } catch (error) {
      console.error('[handleAIFindScene] Lỗi:', error);
      return {
        found: false,
        message: '\u67e5\u627eThất bại，Xin vui lòng Thử lại',
      };
    }
  }, [scriptProject?.projectBackground, episodeRawScripts, scriptData?.scenes]);

  // AI Cảnh\u6821\u51c6（tình hình chung）
  const handleCalibrateScenes = useCallback(async () => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }
    
    const background = scriptProject?.projectBackground;
    if (!background) {
      toast.error('\u8bf7đầu tiênNhậpKịch bản');
      return;
    }
    
    if (!episodeRawScripts || episodeRawScripts.length === 0) {
      toast.error('thiếu\u5c11\u5206đặtKịch bảdữ liệu');
      return;
    }
    
    const currentScenes = scriptData?.scenes || [];
    
    addSecondPass('scenes');
    setSceneCalibrationStatus('calibrating');
    toast.info(`\u6b63\u5728 AI \u6821\u51c6 ${currentScenes.length} Cảnh...`);
    
    try {
      const result = await calibrateScenes(
        currentScenes,
        background,
        episodeRawScripts,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform as string,
          baseUrl: featureConfig.baseUrl,
          promptLanguage,
        }
      );
      
      // 【chế độ nhẹ】Chỉ Cập nhậtlĩnh vực thiết kế nghệ thuật
      // calibrateScenes Đã rồi\u7ecf\u6309 currentScenes của\u987a\u5e8fQuay lại，\u53ea\u9700\u5408\u5e76\u7f8e\u672ftừ\u6bb5
      const newScenes = currentScenes.map((orig, i) => {
        // tìm thấy\u6821\u51c6kết quảtrong\u5bf9\u5e94Cảnh
        const calibrated = result.scenes.find(cs => cs.id === orig.id);
        
        if (!calibrated) {
          console.log(`[handleCalibrateScenes] Cảnh #${i + 1} "${orig.name}" \u672atìm thấy\u6821\u51c6kết quả，giữ\u539f\u6837`);
          return orig;
        }
        
        // 【chìa khóa】Chỉ Cập nhậtlĩnh vực thiết kế nghệ thuật，Giữ Tất cả\u539fCó\u6570\u636e（bao gồm viewpoints）
        const nextVisualPromptZh = calibrated.visualPromptZh || orig.visualPrompt;
        const nextVisualPromptEn = calibrated.visualPromptEn || orig.visualPromptEn;
        return {
          ...orig,  // Giữ Tất cả\u539fCótừ\u6bb5（id, name, location, viewpoints, sceneIds Đợi đã）
          // Chỉ Cập nhậtlĩnh vực thiết kế nghệ thuật
          architectureStyle: calibrated.architectureStyle || orig.architectureStyle,
          lightingDesign: calibrated.lightingDesign || orig.lightingDesign,
          colorPalette: calibrated.colorPalette || orig.colorPalette,
          keyProps: calibrated.keyProps || orig.keyProps,
          spatialLayout: calibrated.spatialLayout || orig.spatialLayout,
          eraDetails: calibrated.eraDetails || orig.eraDetails,
          atmosphere: calibrated.atmosphere || orig.atmosphere,
          importance: calibrated.importance || (orig as any).importance || 'secondary',
          // Lời nhắc trực quan
          visualPrompt: promptLanguage === 'en' ? undefined : nextVisualPromptZh,
          visualPromptEn: promptLanguage === 'zh' ? undefined : nextVisualPromptEn,
          // viewpoints giữkhông thay đổi（Đã rồiChấp nhận ...orig \u4fdd\u7559）
        };
      });
      
      console.log('[handleCalibrateScenes] \u8f7b\u91cf\u7ea7\u6821\u51c6Hoàn thành：Cảsố thứgiữ', newScenes.length, '，\u987a\u5e8fkhông thay đổi');
      
      // Cập nhật scriptData（\u4e0d\u9700\u8981Cập nhật episodes và shots，\u56e0cho sceneId không thay đổi）
      if (scriptData) {
        setScriptData(projectId, {
          ...scriptData,
          scenes: newScenes,
        });
      }
      
      setSceneCalibrationStatus('completed');
      removeSecondPass('scenes');
      toast.success(`Cảnh hiệu chuẩn đã hoàn tất！${result.analysisNotes}`);
      
      // P2b: Cảnh\u6821\u51c6viết lại SeriesMeta
      try {
        const store = useScriptStore.getState();
        const meta = store.projects[projectId]?.seriesMeta;
        if (meta) {
          const updates = syncToSeriesMeta(meta, 'scene', { scenes: newScenes });
          if (Object.keys(updates).length > 0) {
            store.updateSeriesMeta(projectId, updates);
            console.log('[handleCalibrateScenes] SeriesMeta Cảnhviết lạiHoàn thành');
          }
          const mdContent = exportProjectMetadata(projectId);
          store.setMetadataMarkdown(projectId, mdContent);
        }
      } catch (e) {
        console.warn('[handleCalibrateScenes] SeriesMeta viết lạiThất bại:', e);
      }
      
      // \u663e\u793aHợp nhất các đề xuất（Không tự động\u6267được rồi）
      if (result.mergeRecords.length > 0) {
        console.log('[handleCalibrateScenes] Hợp nhất các đề xuất:', result.mergeRecords);
        toast.info(`khám phá ${result.mergeRecords.length} mộtHợp nhất các đề xuất，\u8bf7\u5728\u63a7\u5236\u53f0\u67e5\u770b`);
      }
    } catch (error) {
      const err = error as Error;
      console.error('[handleCalibrateScenes] Hiệu chỉnh Thất bại:', err);
      setSceneCalibrationStatus('error');
      removeSecondPass('scenes');
      toast.error(`Cảnh hiệu chuẩn Thất bại: ${err.message}`);
    }
  }, [scriptProject?.projectBackground, episodeRawScripts, scriptData, projectId, promptLanguage, setScriptData, addSecondPass, removeSecondPass]);

  // AI Cảnh\u6821\u51c6（tập duy nhất）
  const handleCalibrateEpisodeScenes = useCallback(async (episodeIndex: number) => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }
    
    const background = scriptProject?.projectBackground;
    if (!background) {
      toast.error('\u8bf7đầu tiênNhậpKịch bản');
      return;
    }
    
    const currentScenes = scriptData?.scenes || [];
    
    addSecondPass('scenes');
    setSceneCalibrationStatus('calibrating');
    toast.info(`\u6b63\u5728 AI \u6821\u51c6Không. ${episodeIndex} đặtCảnh...`);
    
    try {
      const result = await calibrateEpisodeScenes(
        episodeIndex,
        currentScenes,
        background,
        episodeRawScripts,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform as string,
          baseUrl: featureConfig.baseUrl,
          promptLanguage,
        }
      );
      
      // \u8f6c\u6362\u5e76Cập nhậtCảnh danh sách
      const newCalibratedScenes = convertToScriptScenes(result.scenes, currentScenes, promptLanguage);
      
      // \u5408\u5e76：\u4fdd\u7559\u5176\u4ed6đặtCảnh，thay thế\u8be5đặtCảnh
      const calibratedIds = new Set(newCalibratedScenes.map(s => s.id));
      const otherScenes = currentScenes.filter(s => !calibratedIds.has(s.id));
      const mergedScenes = [...otherScenes, ...newCalibratedScenes];
      
      if (scriptData) {
        setScriptData(projectId, {
          ...scriptData,
          scenes: mergedScenes,
        });
      }
      
      setSceneCalibrationStatus('completed');
      removeSecondPass('scenes');
      toast.success(`Không. ${episodeIndex} đặtCảnh hiệu chuẩn đã hoàn tất！`);
    } catch (error) {
      const err = error as Error;
      console.error('[handleCalibrateEpisodeScenes] Hiệu chỉnh Thất bại:', err);
      setSceneCalibrationStatus('error');
      removeSecondPass('scenes');
      toast.error(`Cảnh hiệu chuẩn Thất bại: ${err.message}`);
    }
  }, [scriptProject?.projectBackground, episodeRawScripts, scriptData, projectId, promptLanguage, setScriptData, addSecondPass, removeSecondPass]);

  // xe kéoTạo
  const handleGenerateTrailer = useCallback(async (duration: TrailerDuration) => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) {
      toast.error(getFeatureNotConfiguredMessage('script_analysis'));
      return;
    }
    
    if (shots.length === 0) {
      toast.error('\u8bf7đầu tiênTạoPhân cảnh');
      return;
    }
    
    const background = scriptProject?.projectBackground || null;
    
    // Cài đặtTạoTrạng thái
    setTrailerConfig({
      duration,
      shotIds: [],
      status: 'generating',
      generatedAt: undefined,
      error: undefined,
    });
    
    toast.info(`\u6b63\u5728 AI chọn ${duration} giâyxe kéoPhân cảnh...`);
    
    try {
      const result = await selectTrailerShots(
        shots,
        background,
        duration,
        {
          apiKey: featureConfig.allApiKeys.join(','),
          provider: featureConfig.platform as string,
          baseUrl: featureConfig.baseUrl,
        }
      );
      
      if (result.success) {
        // Tính toán\u65b0Phân cảnh\u8d77\u59cb ID
        // quan trọng：\u5fc5\u987bsử dụng directorProject của\u6700\u65b0Ảnh chụp nhanh，thay vì useCallback bộ nhớ đệmcủa\u503c
        const latestSplitScenes = directorProject?.splitScenes || [];
        const startId = latestSplitScenes.length > 0 
          ? Math.max(...latestSplitScenes.map(s => s.id)) + 1 
          : 1;
        
        console.log('[handleGenerateTrailer] startId calculation:', {
          latestSplitScenesLength: latestSplitScenes.length,
          latestIds: latestSplitScenes.map(s => s.id),
          calculatedStartId: startId,
        });
        
        // \u5c06chọncủa Shot \u8f6c\u6362cho addScenesFromScript \u9700\u8981củaĐịnh dạng，\u5e76\u8ffd\u52a0Đến splitScenes
        const scenesToAdd = result.selectedShots.map((shot, idx) => ({
          promptZh: shot.visualDescription || shot.actionSummary || `xe kéoPhân cảnh`,
          promptEn: shot.imagePrompt || shot.visualPrompt || '',
          imagePrompt: shot.imagePrompt || shot.visualPrompt || '',
          imagePromptZh: shot.imagePromptZh || shot.visualDescription || '',
          videoPrompt: shot.videoPrompt || '',
          videoPromptZh: shot.videoPromptZh || shot.actionSummary || '',
          endFramePrompt: shot.endFramePrompt || '',
          endFramePromptZh: shot.endFramePromptZh || '',
          needsEndFrame: shot.needsEndFrame || false,
          shotSize: shot.shotSize as any || null,
          duration: shot.duration || 5,
          ambientSound: shot.ambientSound || '',
          soundEffectText: shot.soundEffect || '',
          dialogue: shot.dialogue || '',
          actionSummary: shot.actionSummary || '',
          cameraMovement: shot.cameraMovement || '',
          sceneName: `xe kéo #${idx + 1}`,
          sceneLocation: '',
          // lĩnh vực dẫn dắt câu chuyện
          narrativeFunction: (shot as any).narrativeFunction || '',
          shotPurpose: (shot as any).shotPurpose || '',
          visualFocus: (shot as any).visualFocus || '',
          cameraPosition: (shot as any).cameraPosition || '',
          characterBlocking: (shot as any).characterBlocking || '',
          rhythm: (shot as any).rhythm || '',
          visualDescription: shot.visualDescription || '',
          // Kiểm soát chụp（đèn/tiêu điểm/Thiết bị/Hiệu ứng/tốc độ）
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
        }));
        
        // \u8ffd\u52a0Đến splitScenes
        addScenesFromScript(scenesToAdd);
        
        // Lưunguyên bản Shot của ID（sử dụng\u4e8eKịch bản\u9762\u677f\u663e\u793a）
        const originalShotIds = result.selectedShots.map(s => s.id);
        
        console.log('[handleGenerateTrailer] originalShotIds:', originalShotIds);
        
        // Cập nhật trailerConfig，Lưunguyên bản Shot ID
        setTrailerConfig({
          duration,
          shotIds: originalShotIds,
          status: 'completed',
          generatedAt: Date.now(),
          error: result.error,
        });
        
        toast.success(`Đã rồichọn ${result.selectedShots.length} Phân cảnhsử dụng\u4e8exe kéo，\u53ef\u5728 AI giám đốc\u9762\u677fChỉnh sửa`);
        if (result.error) {
          toast.warning(result.error);
        }
      } else {
        setTrailerConfig({
          duration,
          shotIds: [],
          status: 'error',
          generatedAt: undefined,
          error: result.error || 'chọnThất bại',
        });
        toast.error(result.error || 'xe kéoTạoThất bại');
      }
    } catch (error) {
      const err = error as Error;
      console.error('[handleGenerateTrailer] Thất bại:', err);
      setTrailerConfig({
        duration,
        shotIds: [],
        status: 'error',
        generatedAt: undefined,
        error: err.message,
      });
      toast.error(`xe kéoTạoThất bại: ${err.message}`);
    }
  }, [shots, scriptProject?.projectBackground, setTrailerConfig, addScenesFromScript, directorProject]);
  
  // \u6e05\u9664xe kéo
  const handleClearTrailer = useCallback(() => {
    clearTrailer();
    toast.success('xe kéoĐã rồi\u6e05\u9664');
  }, [clearTrailer]);
  
  // \u83b7\u53d6xe kéo API Cấu hình
  const trailerApiOptions = useCallback((): TrailerGenerationOptions | null => {
    const featureConfig = getFeatureConfig('script_analysis');
    if (!featureConfig) return null;
    return {
      apiKey: featureConfig.allApiKeys.join(','),
      provider: featureConfig.platform as string,
      baseUrl: featureConfig.baseUrl,
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 pb-2 bg-panel border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Kịch bảnChỉnh sửa
          </h2>
          <span className="text-xs text-muted-foreground">
            {parseStatus === "parsing"
              ? "phân tích cú pháptrong..."
              : scriptProject?.shotStatus === "generating"
              ? "Phân cảnhTạotrong..."
              : parseStatus === "ready" && scriptData
              ? `${scriptData.title}`
              : ""}
          </span>
        </div>
      </div>

      {/* ba\u680fBố cục */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* \u5de6\u680f：Kịch bảnĐầu vào */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <ScriptInput
            rawScript={effectiveRawScript}
            language={language}
            targetDuration={targetDuration}
            styleId={styleId}
            sceneCount={sceneCount}
            shotCount={shotCount}
            parseStatus={parseStatus}
            parseError={parseError}
            chatConfigured={chatConfigured}
            onRawScriptChange={activeEpisodeIndex != null
              ? (v) => updateEpisodeRawScript(projectId, activeEpisodeIndex, { rawContent: v })
              : (v) => setRawScript(projectId, v)}
            onLanguageChange={(v) => setLanguage(projectId, v)}
            onDurationChange={(v) => setTargetDuration(projectId, v)}
            onStyleChange={(v) => setStyleId(projectId, v)}
            onSceneCountChange={(v) => setSceneCount(projectId, v === "auto" ? undefined : v)}
            onShotCountChange={(v) => setShotCount(projectId, v === "auto" ? undefined : v)}
            onParse={handleParse}
            onGenerateFromIdea={handleGenerateFromIdea}
            onImportFullScript={handleImportFullScript}
            importStatus={importStatus}
            importError={importError}
            onCalibrate={handleCalibrate}
            calibrationStatus={calibrationStatus}
            missingTitleCount={missingTitleCount}
            onGenerateSynopses={handleGenerateSynopses}
            synopsisStatus={synopsisStatus}
            missingSynopsisCount={missingSynopsisCount}
            viewpointAnalysisStatus={viewpointAnalysisStatus}
            characterCalibrationStatus={characterCalibrationStatus}
            sceneCalibrationStatus={sceneCalibrationStatus}
            secondPassTypes={secondPassTypes}
            promptLanguage={promptLanguage}
            onPromptLanguageChange={(v) => setPromptLanguage(projectId, v)}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* trong\u95f4\u680f：\u5c42\u7ea7\u7ed3\u6784 */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <EpisodeTree
            scriptData={scriptData}
            shots={shots}
            shotStatus={scriptProject?.shotStatus}
            selectedItemId={selectedItemId}
            selectedItemType={selectedItemType}
            onSelectItem={handleSelectItem}
            onAddEpisodeBundle={handleAddEpisodeBundle}
            onUpdateEpisodeBundle={handleUpdateEpisodeBundle}
            onDeleteEpisodeBundle={handleDeleteEpisodeBundle}
            onAddScene={handleAddScene}
            onUpdateScene={handleUpdateScene}
            onDeleteScene={handleDeleteScene}
            onAddCharacter={handleAddCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onDeleteShot={handleDeleteShot}
            onGenerateEpisodeShots={handleGenerateEpisodeShots}
            onRegenerateAllShots={handleRegenerateAllShots}
            episodeGenerationStatus={episodeGenerationStatus}
            onCalibrateShots={handleCalibrateShots}
            onCalibrateScenesShots={handleCalibrateScenesShots}
            onCalibrateCharacters={handleCalibrateCharacters}
            characterCalibrationStatus={characterCalibrationStatus}
            // AI Nhân vật\u67e5\u627e\u76f8\u5173
            projectBackground={scriptProject?.projectBackground ?? undefined}
            episodeRawScripts={episodeRawScripts}
            onAIFindCharacter={scriptProject?.projectBackground ? handleAIFindCharacter : undefined}
            // AI Cảnh\u67e5\u627e\u76f8\u5173
            onAIFindScene={scriptProject?.projectBackground ? handleAIFindScene : undefined}
            // Cảnh\u6821\u51c6\u76f8\u5173
            onCalibrateScenes={scriptProject?.projectBackground ? handleCalibrateScenes : undefined}
            onCalibrateEpisodeScenes={scriptProject?.projectBackground ? handleCalibrateEpisodeScenes : undefined}
            sceneCalibrationStatus={sceneCalibrationStatus}
            // xe kéo\u76f8\u5173
            trailerConfig={trailerConfig}
            onGenerateTrailer={handleGenerateTrailer}
            onClearTrailer={handleClearTrailer}
            trailerApiOptions={trailerApiOptions()}
            // Tiến sĩ đơnân cảnh\u6821\u51c6
            onCalibrateSingleShot={handleCalibrateSingleShot}
            singleShotCalibrationStatus={singleShotCalibrationStatus}
            // \u6821\u51c6\u4e25\u683c\u5ea6\u76f8\u5173
            calibrationStrictness={scriptProject?.calibrationStrictness || 'normal'}
            onCalibrationStrictnessChange={handleCalibrationStrictnessChange}
            lastFilteredCharacters={scriptProject?.lastFilteredCharacters || []}
            onRestoreFilteredCharacter={handleRestoreFilteredCharacter}
            // \u6821\u51c6Xác nhận\u5f39cửa sổ
            calibrationDialogOpen={calibrationDialogOpen}
            pendingCalibrationCharacters={pendingCalibrationCharacters}
            pendingFilteredCharacters={pendingFilteredCharacters}
            onConfirmCalibration={handleConfirmCalibration}
            onCancelCalibration={handleCancelCalibration}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* \u53f3\u680f：\u5c5e\u6027\u9762\u677f */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <PropertyPanel
            selectedItemId={selectedItemId}
            selectedItemType={selectedItemType}
            character={selectedCharacter}
            scene={selectedScene}
            shot={selectedShot}
            episode={selectedEpisode}
            episodeShots={selectedEpisodeShots}
            sceneShots={selectedSceneShots}
            onGoToCharacterLibrary={handleGoToCharacterLibrary}
            onGoToSceneLibrary={handleGoToSceneLibrary}
            onGoToDirector={handleGoToDirector}
            onGoToDirectorFromScene={handleGoToDirectorFromScene}
            onGenerateEpisodeShots={handleGenerateEpisodeShots}
            onCalibrateShots={handleCalibrateShots}
            onUpdateCharacter={handleUpdateCharacter}
            onUpdateScene={handleUpdateScene}
            onUpdateShot={handleUpdateShot}
            onDeleteCharacter={handleDeleteCharacter}
            onDeleteScene={handleDeleteScene}
            onDeleteShot={handleDeleteShot}
            // Nhân vật\u9636\u6bb5Phân tích
            onAnalyzeCharacterStages={handleAnalyzeCharacterStages}
            stageAnalysisStatus={stageAnalysisStatus}
            suggestMultiStage={suggestMultiStage}
            multiStageHints={multiStageHints}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* \u7ed3\u6784\u8865\u5168\u8986\u76d6Xác nhận\u5f39cửa sổ */}
      <AlertDialog open={structureOverwriteConfirmOpen} onOpenChange={setStructureOverwriteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>\u8986\u76d6C hiện tạiảcấu trúc nh？</AlertDialogTitle>
            <AlertDialogDescription>
              \u8be5đặtĐã rồiCóCảnh dữ liệu，\u91cd\u65b0phân tích cú pháp\u5c06thay thếC hiện tạiảnh\u5e76dọn dẹp\u5bf9\u5e94Phân cảnh。Xác nhậntiếp tục？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleStructureCompletion()}>
              Xác nhận\u8986\u76d6
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
