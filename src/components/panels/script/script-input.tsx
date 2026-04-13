// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Script Input Component
 * \u5de6\u680f：Kịch bảnĐầu vào（Nhập/\u521b\u4f5cHai loạichế độ）
 */

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  FileText,
  Wand2,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  Palette,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StylePicker } from "@/components/ui/style-picker";
import type { VisualStyleId } from "@/lib/constants/visual-styles";
import type { PromptLanguage } from "@/types/script";
import { useScriptStore } from "@/stores/script-store";
import { t } from "@/lib/i18n";

const PROMPT_LANGUAGE_OPTIONS = [
  { value: "zh", label: "Chỉ tiếng Trung" },
  { value: "en", label: "Chỉ tiếng Anh" },
  { value: "zh+en", label: "Trung + Anh" },
];

const DURATION_OPTIONS = [
  { value: "auto", label: "Tự động" },
  { value: "10s", label: "10 giây" },
  { value: "15s", label: "15 giây" },
  { value: "20s", label: "20 giây" },
  { value: "30s", label: "30 giây" },
  { value: "60s", label: "1 phút" },
  { value: "90s", label: "1 phút 30 giây" },
  { value: "120s", label: "2 phút" },
  { value: "180s", label: "3 phút" },
];

const SCENE_COUNT_OPTIONS = [
  { value: "1", label: "1 cảnh" },
  { value: "2", label: "2 cảnh" },
  { value: "3", label: "3 cảnh" },
  { value: "4", label: "4 cảnh" },
  { value: "5", label: "5 cảnh" },
  { value: "6", label: "6 cảnh" },
  { value: "8", label: "8Cảnh" },
  { value: "10", label: "10Cảnh" },
];

const SHOT_COUNT_OPTIONS = [
  { value: "3", label: "3Phân cảnh" },
  { value: "4", label: "4Phân cảnh" },
  { value: "5", label: "5Phân cảnh" },
  { value: "6", label: "6Phân cảnh" },
  { value: "8", label: "8Phân cảnh" },
  { value: "10", label: "10Phân cảnh" },
  { value: "12", label: "12Phân cảnh" },
  { value: "custom", label: "Tuỳ chỉnh..." },
];

interface ScriptInputProps {
  rawScript: string;
  language: string;
  targetDuration: string;
  styleId: string;
  sceneCount?: string;
  shotCount?: string;
  parseStatus: "idle" | "parsing" | "ready" | "error";
  parseError?: string;
  chatConfigured: boolean;
  onRawScriptChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onStyleChange: (value: string) => void;
  onSceneCountChange?: (value: string) => void;
  onShotCountChange?: (value: string) => void;
  onParse: () => void;
  onGenerateFromIdea?: (idea: string) => void;
  // \u5b8c\u6574Kịch bảnNhập
  onImportFullScript?: (text: string) => Promise<void>;
  importStatus?: 'idle' | 'importing' | 'ready' | 'error';
  importError?: string;
  // Hiệu chuẩn AI
  onCalibrate?: () => Promise<void>;
  calibrationStatus?: 'idle' | 'calibrating' | 'completed' | 'error';
  missingTitleCount?: number;
  // phác thảo Tạo
  onGenerateSynopses?: () => Promise<void>;
  synopsisStatus?: 'idle' | 'generating' | 'completed' | 'error';
  missingSynopsisCount?: number;
  // Phân cảnhTạoTrạng thái
  viewpointAnalysisStatus?: 'idle' | 'analyzing' | 'completed' | 'error';
  // Nhân vậtHiệu chuẩnTrạng thái
  characterCalibrationStatus?: 'idle' | 'calibrating' | 'completed' | 'error';
  // Cảnh hiệu chuẩn Trạng thái
  sceneCalibrationStatus?: 'idle' | 'calibrating' | 'completed' | 'error';
  // Hailần\u6821\u51c6\u8ffd\u8e2a（trong\u680fđộc lập\u6309\u94aeKích hoạt）
  secondPassTypes?: Set<string>;
  // Promptngôn ngữ
  promptLanguage?: PromptLanguage;
  onPromptLanguageChange?: (value: PromptLanguage) => void;
}

export function ScriptInput({
  rawScript,
  language,
  targetDuration,
  styleId,
  sceneCount,
  shotCount,
  parseStatus,
  parseError,
  chatConfigured,
  onRawScriptChange,
  onLanguageChange,
  onDurationChange,
  onStyleChange,
  onSceneCountChange,
  onShotCountChange,
  onParse,
  onGenerateFromIdea,
  onImportFullScript,
  importStatus,
  importError,
  onCalibrate,
  calibrationStatus,
  missingTitleCount,
  onGenerateSynopses,
  synopsisStatus,
  missingSynopsisCount,
  viewpointAnalysisStatus,
  characterCalibrationStatus,
  sceneCalibrationStatus,
  secondPassTypes,
  promptLanguage,
  onPromptLanguageChange,
}: ScriptInputProps) {
  const scriptActiveProjectId = useScriptStore((state) => state.activeProjectId);
  const inputDraft = useScriptStore((state) => {
    if (!state.activeProjectId) return null;
    return state.projects[state.activeProjectId]?.inputDraft || null;
  });
  const setInputDraft = useScriptStore((state) => state.setInputDraft);

  const [mode, setMode] = useState<"import" | "create">(inputDraft?.mode || "import");
  const [idea, setIdea] = useState(inputDraft?.idea || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCustomShotInput, setShowCustomShotInput] = useState(false);
  const [customShotValue, setCustomShotValue] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState(false);

  // Reload persisted draft when project switches
  useEffect(() => {
    setMode(inputDraft?.mode || "import");
    setIdea(inputDraft?.idea || "");
  }, [scriptActiveProjectId, inputDraft?.mode, inputDraft?.idea]);

  // Persist mode/idea draft to survive panel switching
  useEffect(() => {
    if (!scriptActiveProjectId) return;
    const timer = window.setTimeout(() => {
      setInputDraft(scriptActiveProjectId, { mode, idea });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [scriptActiveProjectId, mode, idea, setInputDraft]);

  const handleGenerate = async () => {
    if (!idea.trim() || !onGenerateFromIdea) return;
    setIsGenerating(true);
    try {
      await onGenerateFromIdea(idea);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportFullScript = async () => {
    if (!rawScript.trim() || !onImportFullScript) return;
    setIsImporting(true);
    try {
      await onImportFullScript(rawScript);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCalibrate = async () => {
    if (!onCalibrate) return;
    setIsCalibrating(true);
    try {
      await onCalibrate();
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleGenerateSynopses = async () => {
    if (!onGenerateSynopses) return;
    setIsGeneratingSynopsis(true);
    try {
      await onGenerateSynopses();
    } finally {
      setIsGeneratingSynopsis(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-3 space-y-3">
      {/* chế độ\u5207\u6362 */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "import" | "create")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {t("script.input.mode.import")}
          </TabsTrigger>
          <TabsTrigger value="create" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            {t("script.input.mode.create")}
          </TabsTrigger>
        </TabsList>

        {/* Nhậpchế độ */}
        <TabsContent value="import" className="flex-1 mt-3 overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("script.input.import.label")}
            </Label>
            <Textarea
              placeholder={t("script.input.import.placeholder")}
              value={rawScript}
              onChange={(e) => onRawScriptChange(e.target.value)}
              className="min-h-[200px] max-h-[40vh] resize-none text-sm overflow-y-auto"
              disabled={parseStatus === "parsing" || isImporting}
            />
            {/* NhậpTrạng tháiGợi ý */}
            {importStatus === "ready" && (
              <div className="space-y-1">
                <p className="text-xs text-green-600">✓ {t("script.input.import.success")}</p>
                {(missingTitleCount ?? 0) > 0 && (
                  <p className="text-xs text-amber-600">
                    ⚠ Còn {missingTitleCount} tập thiếu tiêu đề, bạn có thể dùng AI để hiệu chuẩn
                  </p>
                )}
              </div>
            )}
            {importStatus === "error" && importError && (
              <p className="text-xs text-destructive">{t("script.input.import.error", { message: importError })}</p>
            )}
            
            {/* \u6301\u4e45Tiến độTrạng thái\u663e\u793a - \u5728\u6267được rồi\u8fc7\u7a0btrong\u59cb\u7ec8\u53ef\u89c1 */}
            {(importStatus === 'importing' || 
              calibrationStatus === 'calibrating' || 
              synopsisStatus === 'generating' || 
              viewpointAnalysisStatus === 'analyzing' || 
              characterCalibrationStatus === 'calibrating' ||
              sceneCalibrationStatus === 'calibrating') && (
              <div className="p-4 rounded-xl bg-primary/10 border-2 border-primary/30 space-y-3 shadow-lg">
                {/* Tiêu đề：\u6839\u636e\u662f\u5426Hailần\u6821\u51c6\u663e\u793a\u4e0d\u540c\u6587\u6848 */}
                <div className="flex items-center gap-3 text-primary">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-lg font-bold">
                    {secondPassTypes && secondPassTypes.size > 0 ? "🔄 Đang hiệu chuẩn lần 2..." : t("script.input.processing")}
                  </span>
                </div>
                <div className="space-y-2">
                  {/* === Hailần\u6821\u51c6chế độ：\u53ea\u663e\u793a\u76f8\u5173\u6b65\u9aa4 === */}
                  {secondPassTypes && secondPassTypes.size > 0 ? (
                    <>
                      {/* Phân cảnh\u6821\u51c6（Hailần） */}
                      {secondPassTypes.has('shots') && (
                        <div className={`flex items-center gap-3 py-1 ${viewpointAnalysisStatus === 'analyzing' ? 'text-primary font-bold' : viewpointAnalysisStatus === 'completed' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                          {viewpointAnalysisStatus === 'analyzing' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : viewpointAnalysisStatus === 'completed' ? (
                            <span className="text-lg">✓</span>
                          ) : (
                            <span className="w-5 h-5 rounded-full border-2 border-current" />
                          )}
                          <span className="text-base">AI hiệu chuẩn phân cảnh</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Lần 2</span>
                        </div>
                      )}
                      
                      {/* Nhân vật\u6821\u51c6（Hailần） */}
                      {secondPassTypes.has('characters') && (
                        <div className={`flex items-center gap-3 py-1 ${characterCalibrationStatus === 'calibrating' ? 'text-primary font-bold' : characterCalibrationStatus === 'completed' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                          {characterCalibrationStatus === 'calibrating' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : characterCalibrationStatus === 'completed' ? (
                            <span className="text-lg">✓</span>
                          ) : (
                            <span className="w-5 h-5 rounded-full border-2 border-current" />
                          )}
                          <span className="text-base">AI hiệu chuẩn nhân vật</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Lần 2</span>
                        </div>
                      )}
                      
                      {/* Cảnh\u6821\u51c6（Hailần） */}
                      {secondPassTypes.has('scenes') && (
                        <div className={`flex items-center gap-3 py-1 ${sceneCalibrationStatus === 'calibrating' ? 'text-primary font-bold' : sceneCalibrationStatus === 'completed' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                          {sceneCalibrationStatus === 'calibrating' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : sceneCalibrationStatus === 'completed' ? (
                            <span className="text-lg">✓</span>
                          ) : (
                            <span className="w-5 h-5 rounded-full border-2 border-current" />
                          )}
                        <span className="text-base">AI hiệu chuẩn cảnh</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Lần 2</span>
                        </div>
                      )}
                    </>
                  ) : (
                    /* === \u9996lần pipeline chế độ：\u5b8c\u6574 6 \u6b65\u9aa4 === */
                    <>
                      {/* Nhập kịch bản */}
                      <div className={`flex items-center gap-3 py-1 ${importStatus === 'importing' ? 'text-primary font-bold' : importStatus === 'ready' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {importStatus === 'importing' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : importStatus === 'ready' ? (
                          <span className="text-lg">✓</span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border-2 border-current" />
                        )}
                        <span className="text-base">Nhập kịch bản</span>
                      </div>
                      
                      {/* Hiệu chỉnh tiêu đề */}
                      <div className={`flex items-center gap-3 py-1 ${calibrationStatus === 'calibrating' ? 'text-primary font-bold' : calibrationStatus === 'completed' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {calibrationStatus === 'calibrating' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : calibrationStatus === 'completed' ? (
                          <span className="text-lg">✓</span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border-2 border-current" />
                        )}
                        <span className="text-base">AI Hiệu chỉnh tiêu đề</span>
                      </div>
                      
                      {/* phác thảo Tạo */}
                      <div className={`flex items-center gap-3 py-1 ${synopsisStatus === 'generating' ? 'text-primary font-bold' : synopsisStatus === 'completed' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {synopsisStatus === 'generating' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : synopsisStatus === 'completed' ? (
                          <span className="text-lg">✓</span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border-2 border-current" />
                        )}
                        <span className="text-base">AI tạo tóm tắt</span>
                      </div>
                      
                      {/* Phân cảnh\u6821\u51c6 */}
                      <div className={`flex items-center gap-3 py-1 ${viewpointAnalysisStatus === 'analyzing' ? 'text-primary font-bold' : viewpointAnalysisStatus === 'completed' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {viewpointAnalysisStatus === 'analyzing' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : viewpointAnalysisStatus === 'completed' ? (
                          <span className="text-lg">✓</span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border-2 border-current" />
                        )}
                        <span className="text-base">AI hiệu chuẩn phân cảnh</span>
                      </div>
                      
                      {/* Nhân vật\u6821\u51c6 */}
                      <div className={`flex items-center gap-3 py-1 ${characterCalibrationStatus === 'calibrating' ? 'text-primary font-bold' : characterCalibrationStatus === 'completed' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {characterCalibrationStatus === 'calibrating' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : characterCalibrationStatus === 'completed' ? (
                          <span className="text-lg">✓</span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border-2 border-current" />
                        )}
                        <span className="text-base">AI hiệu chuẩn nhân vật</span>
                      </div>
                      
                      {/* Cảnh\u6821\u51c6 */}
                      <div className={`flex items-center gap-3 py-1 ${sceneCalibrationStatus === 'calibrating' ? 'text-primary font-bold' : sceneCalibrationStatus === 'completed' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {sceneCalibrationStatus === 'calibrating' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : sceneCalibrationStatus === 'completed' ? (
                          <span className="text-lg">✓</span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border-2 border-current" />
                        )}
                        <span className="text-base">AI hiệu chuẩn cảnh</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* chế độ sáng tạo */}
        <TabsContent value="create" className="flex-1 mt-3">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Nhập ý tưởng câu chuyện, AI sẽ giúp bạn tạo kịch bản
              </Label>
              <Textarea
                placeholder="Ví dụ: Một lập trình viên gặp một cô gái lạc quan trong quán cà phê và bắt đầu một câu chuyện ấm áp..."
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                className="min-h-[100px] resize-none text-sm"
                disabled={isGenerating}
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!idea.trim() || isGenerating || !chatConfigured}
              className="w-full"
              variant="outline"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI tạo kịch bản
                </>
              )}
            </Button>

            {/* Tạo\u540ecủaKịch bảnXem trước */}
            {rawScript && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Kịch bản đã tạo (có thể chỉnh sửa)
                </Label>
                <Textarea
                  value={rawScript}
                  onChange={(e) => onRawScriptChange(e.target.value)}
                  className="min-h-[100px] resize-none text-sm"
                  disabled={parseStatus === "parsing"}
                />
              </div>
            )}

            {/* chế độ sáng tạo\u5de5\u4f5c\u6d41\u5f15\u5bfc */}
            {parseStatus === "ready" && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <div className="text-xs font-medium text-primary">✨ Kịch bản đã tạo, bước tiếp theo</div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Chọn Cảnh ở cây bên trái → nhấn "Đến Thư viện cảnh tạo bối cảnh" ở panel phải</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Chọn Nhân vật → nhấn "Đến Thư viện nhân vật tạo hình tượng" ở panel phải</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Chọn Phân cảnh → nhấn "Đến AI đạo diễn tạo video" ở panel phải</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Cài đặtQuận\u57df - Theomode\u663e\u793a\u4e0d\u540c\u9009\u9879 */}
      <div className="space-y-3 pt-2 border-t">
        {/* Nhậpchế độ：\u663e\u793angôn ngữ、Cảnh số lượng、Phân cảnh số lượng */}
        {mode === "import" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("script.input.language")}</Label>
              <Select
                value={language}
                onValueChange={onLanguageChange}
                disabled={parseStatus === "parsing"}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tiếng Trung">Tiếng Trung</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Tiếng Nhật">Tiếng Nhật</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t("script.input.promptLanguage")}</Label>
              <Select
                value={promptLanguage || "zh"}
                onValueChange={(v) => onPromptLanguageChange?.(v as PromptLanguage)}
                disabled={parseStatus === "parsing"}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROMPT_LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {t("script.input.promptLanguageHint")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("script.input.sceneCountOptional")}</Label>
                <Select
                  value={sceneCount || ""}
                  onValueChange={(v) => onSceneCountChange?.(v)}
                  disabled={parseStatus === "parsing"}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Tự động" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Tự động</SelectItem>
                    {SCENE_COUNT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t("script.input.shotCountOptional")}</Label>
                {showCustomShotInput ? (
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Nhập số lượng"
                      value={customShotValue}
                      onChange={(e) => setCustomShotValue(e.target.value)}
                      onBlur={() => {
                        if (customShotValue && parseInt(customShotValue) > 0) {
                          onShotCountChange?.(customShotValue);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customShotValue && parseInt(customShotValue) > 0) {
                          onShotCountChange?.(customShotValue);
                        }
                      }}
                      className="h-8 text-xs flex-1"
                      disabled={parseStatus === "parsing"}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        setShowCustomShotInput(false);
                        setCustomShotValue("");
                        onShotCountChange?.("auto");
                      }}
                    >
                      Huỷ
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={shotCount || ""}
                    onValueChange={(v) => {
                      if (v === "custom") {
                        setShowCustomShotInput(true);
                      } else {
                        onShotCountChange?.(v);
                      }
                    }}
                    disabled={parseStatus === "parsing"}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Tự động" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Tự động</SelectItem>
                      {SHOT_COUNT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Tầm nhìn Phong cách - Nhậpchế độ\u4e5f\u53ef\u4ee5\u9009\u62e9 */}
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Palette className="h-3 w-3" />
                {t("script.input.visualStyle")}
              </Label>
              <StylePicker
                value={styleId}
                onChange={(id) => onStyleChange(id)}
                disabled={parseStatus === "parsing"}
              />
              <p className="text-[10px] text-muted-foreground">
                {t("script.input.visualStyleHint")}
              </p>
            </div>
          </div>
        )}

        {/* chế độ sáng tạo：\u663e\u793angôn ngữ、Thời lượng、Phong cách、Cảnh số lượng、Phân cảnh số lượng */}
        {mode === "create" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("script.input.promptLanguage")}</Label>
              <Select
                value={promptLanguage || "zh"}
                onValueChange={(v) => onPromptLanguageChange?.(v as PromptLanguage)}
                disabled={parseStatus === "parsing"}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROMPT_LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {t("script.input.promptLanguageHint")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">ngôn ngữ</Label>
                <Select
                  value={language}
                  onValueChange={onLanguageChange}
                  disabled={parseStatus === "parsing"}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tiếng Trung">Tiếng Trung</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Tiếng Nhật">Tiếng Nhật</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Thời lượng</Label>
                <Select
                  value={targetDuration}
                  onValueChange={onDurationChange}
                  disabled={parseStatus === "parsing"}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Phong cách</Label>
                <StylePicker
                  value={styleId}
                  onChange={(id) => onStyleChange(id)}
                  disabled={parseStatus === "parsing"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("script.input.sceneCountOptional")}</Label>
                <Select
                  value={sceneCount || ""}
                  onValueChange={(v) => onSceneCountChange?.(v)}
                  disabled={parseStatus === "parsing"}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Tự động" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Tự động</SelectItem>
                    {SCENE_COUNT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t("script.input.shotCountOptional")}</Label>
                {showCustomShotInput ? (
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Nhập số lượng"
                      value={customShotValue}
                      onChange={(e) => setCustomShotValue(e.target.value)}
                      onBlur={() => {
                        if (customShotValue && parseInt(customShotValue) > 0) {
                          onShotCountChange?.(customShotValue);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customShotValue && parseInt(customShotValue) > 0) {
                          onShotCountChange?.(customShotValue);
                        }
                      }}
                      className="h-8 text-xs flex-1"
                      disabled={parseStatus === "parsing"}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        setShowCustomShotInput(false);
                        setCustomShotValue("");
                        onShotCountChange?.("auto");
                      }}
                    >
                      Huỷ
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={shotCount || ""}
                    onValueChange={(v) => {
                      if (v === "custom") {
                        setShowCustomShotInput(true);
                      } else {
                        onShotCountChange?.(v);
                      }
                    }}
                    disabled={parseStatus === "parsing"}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Tự động" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Tự động</SelectItem>
                      {SHOT_COUNT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* API Cảnh báo */}
        {!chatConfigured && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <div className="text-xs text-yellow-600 dark:text-yellow-400">
              <p className="font-medium">API Chưa được định cấu hình</p>
              <p className="opacity-80">Vui lòng vào Cài đặt để cấu hình API key</p>
            </div>
          </div>
        )}

        {/* Nhập/phân tích cú pháp\u6309\u94ae */}
        <div className="space-y-2">
          {/* \u5b8c\u6574Kịch bảnNhập\u6309\u94ae（\u4e0d\u9700\u8981AI，sử dụngquy tắcphân tích cú pháp） */}
          {mode === "import" && onImportFullScript && (
            <Button
              onClick={handleImportFullScript}
              disabled={!rawScript.trim() || isImporting}
              className="w-full"
              variant="default"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("script.input.generating")}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {t("script.input.generateButton")}
                </>
              )}
            </Button>
          )}
          
          {/* Hiệu chuẩn AI\u6309\u94ae - NhậpThành công\u4e14Cóthiếu\u5931Tiêu đề\u65f6\u663e\u793a */}
          {mode === "import" && importStatus === "ready" && (missingTitleCount ?? 0) > 0 && onCalibrate && (
            <Button
              onClick={handleCalibrate}
              disabled={isCalibrating || calibrationStatus === 'calibrating'}
              className="w-full"
              variant="outline"
            >
              {isCalibrating || calibrationStatus === 'calibrating' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang hiệu chuẩn AI...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Hiệu chuẩn AI (tạo {missingTitleCount} tiêu đề tập phim)
                </>
              )}
            </Button>
          )}
          
          {/* TạoPhác thảo\u6309\u94ae - NhậpThành công\u540e\u663e\u793a */}
          {mode === "import" && importStatus === "ready" && onGenerateSynopses && (
            <Button
              onClick={handleGenerateSynopses}
              disabled={isGeneratingSynopsis || synopsisStatus === 'generating'}
              className="w-full"
              variant="outline"
            >
              {isGeneratingSynopsis || synopsisStatus === 'generating' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang tạo tóm tắt...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 mr-2" />
                  {(missingSynopsisCount ?? 0) > 0 
                    ? `Tạo tóm tắt (${missingSynopsisCount} tập còn thiếu)`
                    : 'Tạo lại tóm tắt'
                  }
                </>
              )}
            </Button>
          )}
          
          {/* AIphân tích cú pháp\u6309\u94ae - \u4ec5\u5728Nhậpchế độ\u663e\u793a */}
          {mode === "import" && (
            <Button
              onClick={onParse}
              disabled={!rawScript.trim() || parseStatus === "parsing" || !chatConfigured}
              className="w-full"
              variant={onImportFullScript ? "outline" : "default"}
            >
              {parseStatus === "parsing" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang phân tích...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  AI phân tích cú pháp kịch bản
                </>
              )}
            </Button>
          )}
        </div>

        {/* phân tích cú phápLỗi */}
        {parseStatus === "error" && parseError && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive">{parseError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
