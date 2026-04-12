// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Property Panel Component
 * \u53f3\u680f：\u9009trong\u9879\u5c5e\u6027 + \u8df3\u8f6cThao tác + Chỉnh sửachức năng
 */

import { useState, useEffect } from "react";
import type { ScriptCharacter, ScriptScene, Shot, CompletionStatus, Episode, EpisodeRawScript } from "@/types/script";
import { getShotCompletionStatus } from "@/lib/script/shot-utils";
import { useActiveScriptProject } from "@/stores/script-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CAMERA_MOVEMENT_PRESETS, SPECIAL_TECHNIQUE_PRESETS } from "@/stores/director-presets";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  MapPin,
  Film,
  ArrowRight,
  Circle,
  Clock,
  CheckCircle2,
  Camera,
  MessageSquare,
  Pencil,
  Save,
  X,
  Trash2,
  Volume2,
  Sparkles,
  Timer,
  BookOpen,
  ListChecks,
  Clapperboard,
  Copy,
  Check,
  Grid3X3,
  Loader2,
} from "lucide-react";
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
import { generateMultiPageContactSheetData } from "@/lib/script/scene-viewpoint-generator";
import type { PendingViewpointData, ContactSheetPromptSet } from "@/stores/media-panel-store";

// Trạng thái\u5fbdchương
function StatusBadge({ status }: { status?: CompletionStatus }) {
  const config = {
    pending: { label: "\u672aBắt đầu", className: "bg-muted text-muted-foreground" },
    in_progress: { label: "\u8fdbĐang di chuyển", className: "bg-yellow-500/10 text-yellow-600" },
    completed: { label: "Đã hoàn thành", className: "bg-green-500/10 text-green-600" },
  };
  const { label, className } = config[status || "pending"];
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${className}`}>
      {label}
    </span>
  );
}

// đặt\u8be6\u7ec6thông tin
interface EpisodeDetail extends Episode {
  synopsis?: string;
  keyEvents?: string[];
  scenes: Array<{ sceneHeader: string; characters: string[] }>;
  shotGenerationStatus: 'idle' | 'generating' | 'completed' | 'error';
}

interface PropertyPanelProps {
  selectedItemId: string | null;
  selectedItemType: "character" | "scene" | "shot" | "episode" | null;
  character?: ScriptCharacter;
  scene?: ScriptScene;
  shot?: Shot;
  episode?: EpisodeDetail;  // đặtthông tin
  episodeShots?: Shot[];    // \u8be5đặtTất cảPhân cảnh
  sceneShots?: Shot[];      // \u8be5CảnhTất cảPhân cảnh（sử dụng\u4e8eNhiều Góc nhìnPhân tích）
  onGoToCharacterLibrary?: (characterId: string) => void;
  onGoToSceneLibrary?: (sceneId: string) => void;
  onGoToDirector?: (shotId: string) => void;
  onGoToDirectorFromScene?: (sceneId: string) => void; // Cảnh\u7ea7\u522b\u8df3\u8f6c
  onGenerateEpisodeShots?: (episodeIndex: number) => void; // TạoPhân cảnh
  onCalibrateShots?: (episodeIndex: number) => void;  // \u6821\u51c6Phân cảnh
  // Edit callbacks
  onUpdateCharacter?: (id: string, updates: Partial<ScriptCharacter>) => void;
  onUpdateScene?: (id: string, updates: Partial<ScriptScene>) => void;
  onUpdateShot?: (id: string, updates: Partial<Shot>) => void;
  onDeleteCharacter?: (id: string) => void;
  onDeleteScene?: (id: string) => void;
  onDeleteShot?: (id: string) => void;
  // Nhân vật\u9636\u6bb5Phân tích
  onAnalyzeCharacterStages?: () => void;
  stageAnalysisStatus?: 'idle' | 'analyzing' | 'completed' | 'error';
  suggestMultiStage?: boolean;
  multiStageHints?: string[];
}

export function PropertyPanel({
  selectedItemId,
  selectedItemType,
  character,
  scene,
  shot,
  episode,
  episodeShots = [],
  sceneShots = [],
  onGoToCharacterLibrary,
  onGoToSceneLibrary,
  onGoToDirector,
  onGoToDirectorFromScene,
  onGenerateEpisodeShots,
  onCalibrateShots,
  onUpdateCharacter,
  onUpdateScene,
  onUpdateShot,
  onDeleteCharacter,
  onDeleteScene,
  onDeleteShot,
  onAnalyzeCharacterStages,
  stageAnalysisStatus,
  suggestMultiStage,
  multiStageHints,
}: PropertyPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [copiedCharacter, setCopiedCharacter] = useState(false);
  const [copiedShotPrompts, setCopiedShotPrompts] = useState(false);
  const [copiedScene, setCopiedScene] = useState(false);
  const scriptProject = useActiveScriptProject();
  const promptLanguage = scriptProject?.promptLanguage || 'zh';

  // \u590d\u5236Cảnh dữ liệu
  const handleCopySceneData = async () => {
    if (!scene) return;
    
    const lines: string[] = [];
    lines.push(`# Cảnhcài đặt：${scene.name || scene.location}`);
    lines.push('');
    
    // Cơ bảthông tin
    lines.push(`## Cơ bảthông tin`);
    lines.push(`vị trí：${scene.location}`);
    if (scene.time) lines.push(`Thời gian：${scene.time}`);
    if (scene.atmosphere) lines.push(`bầu không khí：${scene.atmosphere}`);
    lines.push('');
    
    // Cảnh thiết kế（Hiệu chuẩn AI\u540e）
    if (scene.architectureStyle || scene.lightingDesign || scene.colorPalette || scene.eraDetails) {
      lines.push(`## Cảnh thiết kế`);
      if (scene.architectureStyle) lines.push(`Kiến trúcPhong cách：${scene.architectureStyle}`);
      if (scene.lightingDesign) lines.push(`Ánh sáthiết kế：${scene.lightingDesign}`);
      if (scene.colorPalette) lines.push(`Màu sắgiai điệu c：${scene.colorPalette}`);
      if (scene.eraDetails) lines.push(`Đặc điểm của thời đại：${scene.eraDetails}`);
      if (scene.keyProps && scene.keyProps.length > 0) lines.push(`đạo cụ chính：${scene.keyProps.join('、')}`);
      if (scene.spatialLayout) lines.push(`bố trí không gian：${scene.spatialLayout}`);
      lines.push('');
    }
    
    // Lời nhắc trực quan（\u6309Promptngôn ngữ\u663e\u793a）
    const includeZhScenePrompt = promptLanguage !== 'en';
    const includeEnScenePrompt = promptLanguage !== 'zh';
    if ((includeZhScenePrompt && scene.visualPrompt) || (includeEnScenePrompt && scene.visualPromptEn)) {
      lines.push(`## Lời nhắc trực quan`);
      if (includeZhScenePrompt && scene.visualPrompt) lines.push(`Tiếng Trung：${scene.visualPrompt}`);
      if (includeEnScenePrompt && scene.visualPromptEn) lines.push(`English: ${scene.visualPromptEn}`);
      lines.push('');
    }
    
    // Nhiều Góc nhìđồ thị chung（AIGóc nhìnPhân tíchcủa\u4ea7\u51fa）
    if (scene.viewpoints && scene.viewpoints.length > 0) {
      lines.push(`## Nhiều Góc nhìđồ thị chung（AIPhân tích）`);
      lines.push(`Góc nhìn\u6570\u91cf：${scene.viewpoints.length} một`);
      lines.push('');
      scene.viewpoints.forEach((vp, idx) => {
        lines.push(`### Góc nhìn ${idx + 1}: ${vp.name}`);
        lines.push(`- ID: ${vp.id}`);
        if (vp.nameEn) lines.push(`- tên tiếng anh: ${vp.nameEn}`);
        if (vp.keyProps && vp.keyProps.length > 0) lines.push(`- đạo cụ chính: ${vp.keyProps.join('、')}`);
        if (vp.shotIds && vp.shotIds.length > 0) lines.push(`- \u5173\u8054Phân cảnhID: ${vp.shotIds.join(', ')}`);
        lines.push(`- \u7f51\u683cVị trí: ${vp.gridIndex}`);
        lines.push('');
      });
    }
    
    // Ngoại hìnhống kê
    if (scene.importance || scene.appearanceCount || scene.episodeNumbers?.length) {
      lines.push(`## Ngoại hìnhống kê`);
      if (scene.importance) {
        const importanceLabel = scene.importance === 'main' ? 'Chính Cảnh' : 
                               scene.importance === 'secondary' ? 'Tiểu Cảnh' : 'Chuyển tiếpCảnh';
        lines.push(`quan trọng\u7a0b\u5ea6：${importanceLabel}`);
      }
      if (scene.appearanceCount) lines.push(`Số lần xuất hiện：${scene.appearanceCount} lần`);
      if (scene.episodeNumbers && scene.episodeNumbers.length > 0) {
        lines.push(`Số tập xuất hiện：Không. ${scene.episodeNumbers.join(', ')} đặt`);
      }
      lines.push('');
    }
    
    const text = lines.join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedScene(true);
      setTimeout(() => setCopiedScene(false), 2000);
    } catch (e) {
      console.error('Copy scene failed:', e);
    }
  };

  // \u590d\u5236Nhân vật\u6570\u636e
  const handleCopyCharacterData = async () => {
    if (!character) return;
    
    // Định dạng\u5316Nhân vật\u6570\u636e
    const lines: string[] = [];
    lines.push(`# Nhân vậcài đặt t：${character.name}`);
    lines.push('');
    
    // Thông tin cơ bản（Ưu tiên\u663e\u793a）
    if (character.gender || character.age) {
      lines.push(`## Thông tin cơ bản`);
      const basicInfo: string[] = [];
      if (character.gender) basicInfo.push(`giới tính：${character.gender}`);
      if (character.age) basicInfo.push(`tuổi tác：${character.age}`);
      lines.push(basicInfo.join(' | '));
      lines.push('');
    }
    
    // danh tính/Nền（chínhMô tả）
    if (character.role) {
      lines.push(`## danh tính/Nền`);
      lines.push(character.role);
      lines.push('');
    }
    
    // Đặc điểm tính cách
    if (character.personality) {
      lines.push(`## Đặc điểm tính cách`);
      lines.push(character.personality);
      lines.push('');
    }
    
    // đặc điểm cốt lõi
    if (character.traits) {
      lines.push(`## đặc điểm cốt lõi`);
      lines.push(character.traits);
      lines.push('');
    }
    
    // đặc điểm vật lý
    if (character.appearance) {
      lines.push(`## đặc điểm vật lý`);
      lines.push(character.appearance);
      lines.push('');
    }
    
    // Kỹ năng/khả năng
    if (character.skills) {
      lines.push(`## Kỹ năng/khả năng`);
      lines.push(character.skills);
      lines.push('');
    }
    
    // hành vi chính/Chứng thư
    if (character.keyActions) {
      lines.push(`## hành vi chính/Chứng thư`);
      lines.push(character.keyActions);
      lines.push('');
    }
    
    // Mối quan hệ nhân vật
    if (character.relationships) {
      lines.push(`## Mối quan hệ nhân vật`);
      lines.push(character.relationships);
      lines.push('');
    }
    
    // === Neo nhận dạng lớp 6（Nhân vậtTính nhất quán）===
    if (character.identityAnchors) {
      const anchors = character.identityAnchors;
      lines.push(`## Neo nhận dạng lớp 6`);
      
      // ① \u9aa8\u76f8\u5c42
      const boneFeatures: string[] = [];
      if (anchors.faceShape) boneFeatures.push(`hình dạng khuôn mặt: ${anchors.faceShape}`);
      if (anchors.jawline) boneFeatures.push(`đường viền hàm: ${anchors.jawline}`);
      if (anchors.cheekbones) boneFeatures.push(`xương gò má: ${anchors.cheekbones}`);
      if (boneFeatures.length > 0) {
        lines.push(`① \u9aa8\u76f8\u5c42：${boneFeatures.join(', ')}`);
      }
      
      // ② năm\u5b98\u5c42
      const facialFeatures: string[] = [];
      if (anchors.eyeShape) facialFeatures.push(`hình dạng mắt: ${anchors.eyeShape}`);
      if (anchors.eyeDetails) facialFeatures.push(`Chi tiết mắt: ${anchors.eyeDetails}`);
      if (anchors.noseShape) facialFeatures.push(`Hình dáng mũi: ${anchors.noseShape}`);
      if (anchors.lipShape) facialFeatures.push(`hình môi: ${anchors.lipShape}`);
      if (facialFeatures.length > 0) {
        lines.push(`② năm\u5b98\u5c42：${facialFeatures.join(', ')}`);
      }
      
      // ③ \u8fa8\u8bc6\u6807\u8bb0\u5c42（\u6700\u5f3a\u951a\u70b9）
      if (anchors.uniqueMarks && anchors.uniqueMarks.length > 0) {
        lines.push(`③ \u8fa8\u8bc6\u6807\u8bb0\u5c42（\u6700\u5f3a\u951a\u70b9）：${anchors.uniqueMarks.join('; ')}`);
      }
      
      // ④ Màu sắc\u951a\u70b9\u5c42
      if (anchors.colorAnchors) {
        const colors: string[] = [];
        if (anchors.colorAnchors.iris) colors.push(`\u8679\u819c: ${anchors.colorAnchors.iris}`);
        if (anchors.colorAnchors.hair) colors.push(`màu tóc: ${anchors.colorAnchors.hair}`);
        if (anchors.colorAnchors.skin) colors.push(`màu da: ${anchors.colorAnchors.skin}`);
        if (anchors.colorAnchors.lips) colors.push(`màu môi: ${anchors.colorAnchors.lips}`);
        if (colors.length > 0) {
          lines.push(`④ Màu sắc\u951a\u70b9\u5c42（Hex）：${colors.join(', ')}`);
        }
      }
      
      // ⑤ lớp kết cấu da
      if (anchors.skinTexture) {
        lines.push(`⑤ lớp kết cấu da：${anchors.skinTexture}`);
      }
      
      // ⑥ lớp neo kiểu tóc
      const hairFeatures: string[] = [];
      if (anchors.hairStyle) hairFeatures.push(`kiểu tóc: ${anchors.hairStyle}`);
      if (anchors.hairlineDetails) hairFeatures.push(`đường chân tóc: ${anchors.hairlineDetails}`);
      if (hairFeatures.length > 0) {
        lines.push(`⑥ lớp neo kiểu tóc：${hairFeatures.join(', ')}`);
      }
      
      lines.push('');
    }
    
    // === Lời nhắc tiêu cực ===
    if (character.negativePrompt) {
      lines.push(`## Lời nhắc tiêu cực`);
      if (character.negativePrompt.avoid && character.negativePrompt.avoid.length > 0) {
        lines.push(`\u8981\u907f\u514d：${character.negativePrompt.avoid.join(', ')}`);
      }
      if (character.negativePrompt.styleExclusions && character.negativePrompt.styleExclusions.length > 0) {
        lines.push(`Phong cáloại trừ：${character.negativePrompt.styleExclusions.join(', ')}`);
      }
      lines.push('');
    }
    
    // Nhân vậthẻ t
    if (character.tags && character.tags.length > 0) {
      lines.push(`## Nhân vậthẻ t`);
      lines.push(character.tags.map(t => `#${t}`).join(' '));
      lines.push('');
    }
    
    // Nhân vậtNhận xét
    if (character.notes) {
      lines.push(`## Nhân vậtNhận xét`);
      lines.push(character.notes);
      lines.push('');
    }
    
    const text = lines.join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCharacter(true);
      setTimeout(() => setCopiedCharacter(false), 2000);
    } catch (e) {
      console.error('Copy character failed:', e);
    }
  };

  // \u590d\u5236SetPhân cảnh dữ liệu
  const handleCopyEpisodeShots = async () => {
    if (!episode || episodeShots.length === 0) return;
    
    // Thẻ cảm xúcTiếng Trung\u6620\u5c04
    const emotionLabels: Record<string, string> = {
      happy: 'hạnh phúc', sad: 'buồn', angry: 'tức giận', surprised: 'ngạc nhiên', fearful: 'nỗi sợ hãi', calm: 'bình tĩnh',
      tense: 'lo lắng', excited: 'vui mừng', mysterious: 'bí ẩn', romantic: 'lãng mạn', funny: 'Hài hước', touching: 'chạm vào',
      serious: 'nghiêm túc', relaxed: 'Dễ dàng', playful: 'chế nhạo', gentle: 'nhẹ nhàng', passionate: 'đam mê', low: 'thấp'
    };
    
    // Định dạng\u5316Phân cảnh dữ liệu
    const lines: string[] = [];
    lines.push(`# Không.${episode.index}đặt：${episode.title.replace(/^Không.\bộ d+[：:]?/, '')}`);
    lines.push('');
    if (episode.synopsis) {
      lines.push(`## Tóm tắt tập phim`);
      lines.push(episode.synopsis);
      lines.push('');
    }
    lines.push(`## Phân cảnh danh sách (tổng cộng ${episodeShots.length} một)`);
    lines.push('');
    
    episodeShots.forEach((s, idx) => {
      lines.push(`### Phân cảnh ${String(idx + 1).padStart(2, '0')}`);
      if (s.shotSize || s.cameraMovement) {
        lines.push(`**Cảnh quay**: ${[s.shotSize, s.cameraMovement].filter(Boolean).join(' | ')}`);
      }
      if ((s as any).visualDescription) {
        lines.push(`**Tầm nhìn Mô tả**: ${(s as any).visualDescription}`);
      }
      if (s.actionSummary) {
        lines.push(`**Hành động**: ${s.actionSummary}`);
      }
      if (s.dialogue) {
        lines.push(`**đối thoại**: 「${s.dialogue}」`);
      }
      if (s.characterNames && s.characterNames.length > 0) {
        lines.push(`**Ngoại hình Nhân vật**: ${s.characterNames.join('、')}`);
      }
      if (s.emotionTags && s.emotionTags.length > 0) {
        const tags = s.emotionTags.map(t => emotionLabels[t] || t).join('、');
        lines.push(`**cảm xúc**: ${tags}`);
      }
      if (promptLanguage !== 'zh' && (s as any).visualPrompt) {
        lines.push(`**Tiếng AnhNhắc**: ${(s as any).visualPrompt}`);
      }
      // Ba lớp NhắcHệ thống
      if (s.imagePromptZh || s.imagePrompt) {
        if (promptLanguage === 'zh') {
          lines.push(`**Lời nhắc khung đầu tiên**: ${s.imagePromptZh || ''}`);
        } else if (promptLanguage === 'en') {
          lines.push(`**Lời nhắc khung đầu tiên**: ${s.imagePrompt || ''}`);
        } else {
          lines.push(`**Lời nhắc khung đầu tiên**: ${s.imagePromptZh || ''} ${s.imagePrompt ? `(EN: ${s.imagePrompt})` : ''}`);
        }
      }
      if (s.videoPromptZh || s.videoPrompt) {
        if (promptLanguage === 'zh') {
          lines.push(`**VideoPrompt**: ${s.videoPromptZh || ''}`);
        } else if (promptLanguage === 'en') {
          lines.push(`**VideoPrompt**: ${s.videoPrompt || ''}`);
        } else {
          lines.push(`**VideoPrompt**: ${s.videoPromptZh || ''} ${s.videoPrompt ? `(EN: ${s.videoPrompt})` : ''}`);
        }
      }
      if (s.needsEndFrame) {
        lines.push(`**\u9700\u8981\u5c3e\u5e27**: \u662f`);
        if (s.endFramePromptZh || s.endFramePrompt) {
          if (promptLanguage === 'zh') {
            lines.push(`**Lời nhắc khung cuối cùng**: ${s.endFramePromptZh || ''}`);
          } else if (promptLanguage === 'en') {
            lines.push(`**Lời nhắc khung cuối cùng**: ${s.endFramePrompt || ''}`);
          } else {
            lines.push(`**Lời nhắc khung cuối cùng**: ${s.endFramePromptZh || ''} ${s.endFramePrompt ? `(EN: ${s.endFramePrompt})` : ''}`);
          }
        }
      }
      lines.push('');
    });
    
    const text = lines.join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  // \u590d\u5236hiện tạiPhân cảnhba\u5c42Prompt
  const handleCopyShotTriPrompts = async () => {
    if (!shot) return;

    const hasTri = !!(
      shot.imagePrompt || shot.imagePromptZh ||
      shot.videoPrompt || shot.videoPromptZh ||
      shot.endFramePrompt || shot.endFramePromptZh
    );

    // Cỡ cảnhTiếng Trung\u6620\u5c04
    const shotSizeLabels: Record<string, string> = {
      'ECU': 'Đặc tả', 'CU': 'Cận cảnh', 'MCU': 'Trung bình Cận cảnh', 'MS': 'Trung cảnh',
      'MLS': 'giữaTớiàn cảnh', 'LS': 'Toàn cảnh', 'ELS': '\u5927Toàn cảnh', 'POV': 'chủ quan Cảnh quay'
    };
    // Cảnh quay thể thaoTiếng Trung\u6620\u5c04（\u517c\u5bb9\u65e7\u503c+\u65b0\u9884\u8bbeID）
    const cameraLabelsLegacy: Record<string, string> = {
      'Static': '\u56fa\u5b9a', 'Pan': '\u6a2a\u6447', 'Tilt': '\u4fef\u4ef0', 'Dolly': '\u63a8\u62c9',
      'Zoom': 'thu phóng', 'Tracking': 'Theo dõi cú đánh', 'Crane': 'nâng', 'Handheld': 'cầm tay'
    };
    const cameraLabels = (id: string) => {
      const preset = CAMERA_MOVEMENT_PRESETS.find(p => p.id === id);
      return preset ? preset.label : (cameraLabelsLegacy[id] || id);
    };
    const specialTechniqueLabel = (id: string) => {
      const preset = SPECIAL_TECHNIQUE_PRESETS.find(p => p.id === id);
      return preset ? preset.label : id;
    };

    const lines: string[] = [];
    lines.push('═══════════════════════════════════════');
    lines.push(`Phân cảnh ${shot.index} - ba\u5c42Prompt\u6570\u636e`);
    lines.push('═══════════════════════════════════════');
    lines.push('');

    // Cơ bảthông tin
    lines.push('【Cơ bảthông tin】');
    if (shot.shotSize) {
      lines.push(`Cỡ cảnh: ${shotSizeLabels[shot.shotSize] || shot.shotSize} (${shot.shotSize})`);
    }
    if (shot.cameraMovement) {
      lines.push(`Cảnh quay thể thao: ${cameraLabels(shot.cameraMovement)}`);
    }
    if (shot.specialTechnique && shot.specialTechnique !== 'none') {
      lines.push(`\u7279\u6b8a\u62cd\u6444: ${specialTechniqueLabel(shot.specialTechnique)}`);
    }
    if (shot.duration) {
      lines.push(`Thời lượng: ${shot.duration}giây`);
    }
    if (shot.characterNames && shot.characterNames.length > 0) {
      lines.push(`Ngoại hình Nhân vật: ${shot.characterNames.join('、')}`);
    }
    // đối thoạitừ\u6bb5\u59cb\u7ec8\u663e\u793a，không cóđối thoại\u65f6\u660e\u786e\u6807Lưu ý“không có”，\u9632\u6b62AIVideoMô hình\u5e7b\u89c9
    lines.push(`Đối thoại: ${shot.dialogue ? `「${shot.dialogue}」` : 'không có'}`);
    if (shot.actionSummary) {
      lines.push(`Hành độngMô tả: ${shot.actionSummary}`);
    }
    lines.push('');

    // Tầm nhìn Mô tả
    if ((shot as any).visualDescription) {
      lines.push('【Tầm nhìn Mô tả】');
      lines.push((shot as any).visualDescription);
      lines.push('');
    }

    // Âthiết kế m thanh
    if (shot.ambientSound || shot.soundEffect) {
      lines.push('【Âthiết kế m thanh】');
      if (shot.ambientSound) {
        lines.push(`âm thanh xung quanh: ${shot.ambientSound}`);
      }
      if (shot.soundEffect) {
        lines.push(`Hiệu ứng âm thanh: ${shot.soundEffect}`);
      }
      lines.push('');
    }

    // thiết kế theo hướng tường thuật（Dựa trên《Ngữ pháp ngôn ngữ điện ảnh》）
    const hasNarrative = (shot as any).narrativeFunction || (shot as any).shotPurpose || 
                         (shot as any).visualFocus || (shot as any).cameraPosition || 
                         (shot as any).characterBlocking || (shot as any).rhythm;
    if (hasNarrative) {
      lines.push('【thiết kế theo hướng tường thuật】Dựa trên《Ngữ pháp ngôn ngữ điện ảnh》');
      if ((shot as any).narrativeFunction) {
        lines.push(`chức năng tường thuật: ${(shot as any).narrativeFunction}`);
      }
      if ((shot as any).shotPurpose) {
        lines.push(`Cảnh quay mục đích: ${(shot as any).shotPurpose}`);
      }
      if ((shot as any).visualFocus) {
        lines.push(`Tập trung thị giác: ${(shot as any).visualFocus}`);
      }
      if ((shot as any).cameraPosition) {
        lines.push(`Góc máyMô tả: ${(shot as any).cameraPosition}`);
      }
      if ((shot as any).characterBlocking) {
        lines.push(`Bố cục nhân vật: ${(shot as any).characterBlocking}`);
      }
      if ((shot as any).rhythm) {
        lines.push(`Nhịp điệu: ${(shot as any).rhythm}`);
      }
      lines.push('');
    }

    if (!hasTri) {
      lines.push('⚠️ Phân cảnh\u5c1a\u672aTạoba\u5c42Prompt，\u8bf7đầu tiên\u6267được rồi"AI hiệu chuẩn Phân cảnh"。');
    } else {
      // ===== Lời nhắc khung đầu tiên =====
      lines.push('───────────────────────────────────────');
      lines.push('【Lời nhắc khung đầu tiên】cho Tạo videocủaKhông.một\u5e27Hình ảnh');
      lines.push('───────────────────────────────────────');
      if (promptLanguage !== 'en' && shot.imagePromptZh) {
        lines.push(`Tiếng Trung: ${shot.imagePromptZh}`);
      }
      if (promptLanguage !== 'zh' && shot.imagePrompt) {
        lines.push(`English: ${shot.imagePrompt}`);
      }
      if (
        (promptLanguage === 'zh' && !shot.imagePromptZh) ||
        (promptLanguage === 'en' && !shot.imagePrompt) ||
        (promptLanguage === 'zh+en' && !shot.imagePrompt && !shot.imagePromptZh)
      ) {
        lines.push('(\u672aTạo)');
      }
      lines.push('');

      // ===== VideoPrompt =====
      lines.push('───────────────────────────────────────');
      lines.push('【VideoPrompt】sử dụng\u4e8e\u56fe\u751fVideo，Mô tảHành độngvàcác môn thể thao');
      lines.push('───────────────────────────────────────');
      if (promptLanguage !== 'en' && shot.videoPromptZh) {
        lines.push(`Tiếng Trung: ${shot.videoPromptZh}`);
      }
      if (promptLanguage !== 'zh' && shot.videoPrompt) {
        lines.push(`English: ${shot.videoPrompt}`);
      }
      if (
        (promptLanguage === 'zh' && !shot.videoPromptZh) ||
        (promptLanguage === 'en' && !shot.videoPrompt) ||
        (promptLanguage === 'zh+en' && !shot.videoPrompt && !shot.videoPromptZh)
      ) {
        lines.push('(\u672aTạo)');
      }
      lines.push('');

      // ===== Lời nhắc khung cuối cùng =====
      lines.push('───────────────────────────────────────');
      lines.push('【Lời nhắc khung cuối cùng】cho Tạo videocủa\u6700\u540emột\u5e27（Chẳng hạn như\u9700\u8981）');
      lines.push('───────────────────────────────────────');
      if (shot.needsEndFrame) {
        lines.push('\u9700\u8981\u5c3e\u5e27: ✓ \u662f');
        if (promptLanguage !== 'en' && shot.endFramePromptZh) {
          lines.push(`Tiếng Trung: ${shot.endFramePromptZh}`);
        }
        if (promptLanguage !== 'zh' && shot.endFramePrompt) {
          lines.push(`English: ${shot.endFramePrompt}`);
        }
        if (
          (promptLanguage === 'zh' && !shot.endFramePromptZh) ||
          (promptLanguage === 'en' && !shot.endFramePrompt) ||
          (promptLanguage === 'zh+en' && !shot.endFramePrompt && !shot.endFramePromptZh)
        ) {
          lines.push('(\u672aTạo)');
        }
      } else {
        lines.push('\u9700\u8981\u5c3e\u5e27: ✗ \u5426（\u6b64Phân cảnh\u4e0d\u9700\u8981\u5355\u72eccủa\u5c3e\u5e27）');
      }
    }

    lines.push('');
    lines.push('═══════════════════════════════════════');

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedShotPrompts(true);
      setTimeout(() => setCopiedShotPrompts(false), 2000);
    } catch (e) {
      console.error('Copy tri-layer prompts failed:', e);
    }
  };

  // Reset edit state when selection changes
  useEffect(() => {
    setIsEditing(false);
    setEditData({});
  }, [selectedItemId, selectedItemType]);

  // Initialize edit data
  const startEditing = () => {
    if (selectedItemType === "character" && character) {
      setEditData({
        name: character.name || "",
        gender: character.gender || "",
        age: character.age || "",
        personality: character.personality || "",
        role: character.role || "",
        traits: character.traits || "",
        skills: character.skills || "",
        keyActions: character.keyActions || "",
        appearance: character.appearance || "",
        relationships: character.relationships || "",
      });
    } else if (selectedItemType === "scene" && scene) {
      setEditData({
        name: scene.name || "",
        location: scene.location || "",
        time: scene.time || "",
        atmosphere: scene.atmosphere || "",
      });
    } else if (selectedItemType === "shot" && shot) {
      setEditData({
        actionSummary: shot.actionSummary || "",
        dialogue: shot.dialogue || "",
        shotSize: shot.shotSize || "",
        cameraMovement: shot.cameraMovement || "none",
        specialTechnique: shot.specialTechnique || "none",
      });
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    if (selectedItemType === "character" && character) {
      onUpdateCharacter?.(character.id, editData);
    } else if (selectedItemType === "scene" && scene) {
      onUpdateScene?.(scene.id, editData);
    } else if (selectedItemType === "shot" && shot) {
      onUpdateShot?.(shot.id, editData as any);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (selectedItemType === "character" && character) {
      onDeleteCharacter?.(character.id);
    } else if (selectedItemType === "scene" && scene) {
      onDeleteScene?.(scene.id);
    } else if (selectedItemType === "shot" && shot) {
      onDeleteShot?.(shot.id);
    }
    setDeleteDialogOpen(false);
  };

  if (!selectedItemId || !selectedItemType) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
        \u9009\u62e9đặt、Nhân vật、CảnhhoặcPhân cảnh
        <br />
        \u67e5\u770bChi tiết
      </div>
    );
  }

  // đặtChi tiết
  if (selectedItemType === "episode" && episode) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4 pb-32">
          {/* \u5934\u90e8 */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
              <Clapperboard className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Không.{episode.index}đặt</h3>
              <p className="text-sm text-muted-foreground">{episode.title.replace(/^Không.\bộ d+[：:]？/, '')}</p>
            </div>
          </div>

          <Separator />

          {/* phác thảo */}
          {episode.synopsis ? (
            <div className="bg-gradient-to-r from-primary/5 to-transparent p-3 rounded-lg border-l-2 border-primary/30">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Tóm tắt tập phim
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{episode.synopsis}</div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              \u672aTạoPhác thảo，\u70b9\u51fb\u4e0b\u65b9\u6309\u94aeTạo
            </div>
          )}

          {/* Phímự kiện */}
          {episode.keyEvents && episode.keyEvents.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <ListChecks className="h-3 w-3" />
                Phímự kiện
              </div>
              <div className="space-y-1">
                {episode.keyEvents.map((event, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary font-medium">{i + 1}.</span>
                    <span>{event}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CảnhThống kê */}
          <div className="bg-muted/30 p-3 rounded-lg">
            <div className="text-xs text-muted-foreground mb-2">CảnhThống kê</div>
            <div className="text-sm">
              \u672cđặttổng cộng <span className="font-medium text-primary">{episode.scenes?.length || 0}</span> Cảnh
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Phân cảnhTrạng thái：{episode.shotGenerationStatus === 'completed' ? '✅ Đã Tạo' : 
                episode.shotGenerationStatus === 'generating' ? '⏳ Tạotrong...' : '⏹ \u672aTạo'}
            </div>
          </div>

          <Separator />

          {/* Thao tác */}
          <div className="space-y-2">
            {episode.shotGenerationStatus !== 'completed' && (
              <Button
                className="w-full"
                onClick={() => onGenerateEpisodeShots?.(episode.index)}
                disabled={episode.shotGenerationStatus === 'generating'}
              >
                <Film className="h-4 w-4 mr-2" />
                TạoPhân cảnh
              </Button>
            )}
            {episode.shotGenerationStatus === 'completed' && (
              <>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => onCalibrateShots?.(episode.index)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI hiệu chuẩn Phân cảnh
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCopyEpisodeShots}
                  disabled={episodeShots.length === 0}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      Đã rồi\u590d\u5236
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      \u590d\u5236Phân cảnh dữ liệu ({episodeShots.length})
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </ScrollArea>
    );
  }

  // Nhân vậtChi tiết
  if (selectedItemType === "character" && character) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4 pb-32">
          {/* \u5934\u90e8 */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editData.name || ""}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="h-7 text-sm font-medium"
                />
              ) : (
                <h3 className="font-medium">{character.name}</h3>
              )}
              <StatusBadge status={character.status} />
            </div>
            {!isEditing ? (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={startEditing}>
                <Pencil className="h-3 w-3" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSave}>
                  <Save className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* \u5c5e\u6027 */}
          {isEditing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">danh tính/Nền</Label>
                <Textarea value={editData.role || ""} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className="min-h-[60px]" placeholder="Danh tính chi tiết NềnMô tả" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">giới tính</Label>
                  <Input value={editData.gender || ""} onChange={(e) => setEditData({ ...editData, gender: e.target.value })} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">tuổi tác</Label>
                  <Input value={editData.age || ""} onChange={(e) => setEditData({ ...editData, age: e.target.value })} className="h-8" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">nhân vật</Label>
                <Textarea value={editData.personality || ""} onChange={(e) => setEditData({ ...editData, personality: e.target.value })} className="min-h-[60px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">đặc điểm cốt lõi</Label>
                <Textarea value={editData.traits || ""} onChange={(e) => setEditData({ ...editData, traits: e.target.value })} className="min-h-[60px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kỹ năng/khả năng</Label>
                <Textarea value={editData.skills || ""} onChange={(e) => setEditData({ ...editData, skills: e.target.value })} className="min-h-[60px]" placeholder="võ thuật、ma thuật、Kỹ năng chuyên môn, v.v." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">hành vi chính/Chứng thư</Label>
                <Textarea value={editData.keyActions || ""} onChange={(e) => setEditData({ ...editData, keyActions: e.target.value })} className="min-h-[60px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">đặc điểm vật lý</Label>
                <Textarea value={editData.appearance || ""} onChange={(e) => setEditData({ ...editData, appearance: e.target.value })} className="min-h-[40px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mối quan hệ nhân vật</Label>
                <Textarea value={editData.relationships || ""} onChange={(e) => setEditData({ ...editData, relationships: e.target.value })} className="min-h-[40px]" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Giai đoạn Nhân vật\u7279\u6b8athông tin */}
              {character.stageInfo && (
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-1">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    🎭 Giai đoạn Nhân vật：{character.stageInfo.stageName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    \u9002sử dụngđặt\u6570：Không.{character.stageInfo.episodeRange[0]}-{character.stageInfo.episodeRange[1]}đặt
                  </div>
                  {character.stageInfo.ageDescription && (
                    <div className="text-xs text-muted-foreground">
                      tuổi tác：{character.stageInfo.ageDescription}
                    </div>
                  )}
                </div>
              )}
              
              {/* Lời nhắc trực quan（Bậc thầy đẳng cấp thế giới Tạo） */}
              {((promptLanguage !== 'en' && character.visualPromptZh) || (promptLanguage !== 'zh' && character.visualPromptEn)) && (
                <div className="bg-gradient-to-r from-purple-500/10 to-transparent p-2 rounded-lg border-l-2 border-purple-500/30">
                  <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">🎨 Lời nhắc trực quan</div>
                  {promptLanguage !== 'en' && character.visualPromptZh && (
                    <div className="text-xs text-muted-foreground mb-1">{character.visualPromptZh}</div>
                  )}
                  {promptLanguage !== 'zh' && character.visualPromptEn && (
                    <div className="text-xs text-muted-foreground/70 italic">{character.visualPromptEn}</div>
                  )}
                </div>
              )}
              
              {character.role && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">danh tính/Nền</div>
                  <div className="text-sm whitespace-pre-wrap">{character.role}</div>
                </div>
              )}
              {(character.gender || character.age) && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Thông tin cơ bản</div>
                  <div className="text-sm">
                    {[character.gender, character.age].filter(Boolean).join(" · ")}
                  </div>
                </div>
              )}
              {character.personality && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">nhân vật</div>
                  <div className="text-sm whitespace-pre-wrap">{character.personality}</div>
                </div>
              )}
              {character.traits && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">đặc điểm cốt lõi</div>
                  <div className="text-sm whitespace-pre-wrap">{character.traits}</div>
                </div>
              )}
              {character.skills && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Kỹ năng/khả năng</div>
                  <div className="text-sm whitespace-pre-wrap">{character.skills}</div>
                </div>
              )}
              {character.keyActions && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">hành vi chính/Chứng thư</div>
                  <div className="text-sm whitespace-pre-wrap">{character.keyActions}</div>
                </div>
              )}
              {character.appearance && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">đặc điểm vật lý</div>
                  <div className="text-sm whitespace-pre-wrap">{character.appearance}</div>
                </div>
              )}
              {character.relationships && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Mối quan hệ nhân vật</div>
                  <div className="text-sm whitespace-pre-wrap">{character.relationships}</div>
                </div>
              )}
              {character.tags && character.tags.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Nhân vậthẻ t</div>
                  <div className="flex flex-wrap gap-1">
                    {character.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {character.notes && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Nhân vậtNhận xét</div>
                  <div className="text-sm text-muted-foreground italic whitespace-pre-wrap">{character.notes}</div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Thao tác */}
          <div className="space-y-2">
            {/* \u7236Nhân vật（CóGiai đoạn Nhân vật）：\u663e\u793aGợi ý，\u4e0d\u663e\u793aTạo\u6309\u94ae */}
            {character.stageCharacterIds && character.stageCharacterIds.length > 0 ? (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-2">
                <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  Đã Tạo {character.stageCharacterIds.length} một\u9636\u6bb5Phiên bản
                </div>
                <div className="text-xs text-muted-foreground">
                  \u8bf7\u5728trong\u680f\u70b9\u51fb\u5404\u9636\u6bb5Phiên bản（Chẳng hạn như「{character.name}（phiên bản trẻ）」），\u7136\u540e\u53bbThư viện nhân vậtTạo\u5f62\u8c61
                </div>
              </div>
            ) : (
              /* \u666e\u901aNhân vậthoặcGiai đoạn Nhân vật：\u663e\u793aTạo\u6309\u94ae */
              <Button
                className="w-full"
                onClick={() => onGoToCharacterLibrary?.(character.id)}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                {character.characterLibraryId ? '\u67e5\u770bThư viện nhân vật\u5f62\u8c61' : '\u53bbThư viện nhân vậtTạo\u5f62\u8c61'}
              </Button>
            )}
            
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCopyCharacterData}
            >
              {copiedCharacter ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Đã rồi\u590d\u5236
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  \u590d\u5236Nhân vật\u6570\u636e
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              XoáNhân vật
            </Button>
          </div>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhậnXoá</AlertDialogTitle>
              <AlertDialogDescription>\u786e\u5b9a\u8981XoáNhân vật「{character.name}」\u5417？</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Huỷ</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Xoá</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ScrollArea>
    );
  }

  // CảnhChi tiết
  if (selectedItemType === "scene" && scene) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4 pb-32">
          {/* \u5934\u90e8 */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
              <MapPin className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editData.name || ""}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="h-7 text-sm font-medium"
                />
              ) : (
                <h3 className="font-medium">{scene.name || scene.location}</h3>
              )}
              <StatusBadge status={scene.status} />
            </div>
            {!isEditing ? (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={startEditing}>
                <Pencil className="h-3 w-3" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSave}>
                  <Save className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* \u5c5e\u6027 */}
          {isEditing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">vị trí</Label>
                <Input value={editData.location || ""} onChange={(e) => setEditData({ ...editData, location: e.target.value })} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Thời gian</Label>
                <Input value={editData.time || ""} onChange={(e) => setEditData({ ...editData, time: e.target.value })} className="h-8" placeholder="Chẳng hạn như：Ban ngày、Ban đêm、Hoàng hôn" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">bầu không khí</Label>
                <Textarea value={editData.atmosphere || ""} onChange={(e) => setEditData({ ...editData, atmosphere: e.target.value })} className="min-h-[60px]" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Cơ bảthông tin */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">vị trí</div>
                <div className="text-sm">{scene.location}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Thời gian</div>
                <div className="text-sm">{scene.time}</div>
              </div>
              {scene.atmosphere && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">bầu không khí</div>
                  <div className="text-sm">{scene.atmosphere}</div>
                </div>
              )}
              
              {/* C chuyên nghiệpảlĩnh vực thiết kế（Hiệu chuẩn AI\u540e\u663e\u793a） */}
              {(scene.architectureStyle || scene.lightingDesign || scene.colorPalette || scene.eraDetails) && (
                <>
                  <Separator className="my-2" />
                  <div className="text-xs font-medium text-primary mb-2">Cảnh thiết kế</div>
                  
                  {scene.architectureStyle && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Kiến trúcPhong cách</div>
                      <div className="text-sm">{scene.architectureStyle}</div>
                    </div>
                  )}
                  {scene.lightingDesign && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Ánh sáthiết kế</div>
                      <div className="text-sm">{scene.lightingDesign}</div>
                    </div>
                  )}
                  {scene.colorPalette && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Màu sắgiai điệu c</div>
                      <div className="text-sm">{scene.colorPalette}</div>
                    </div>
                  )}
                  {scene.eraDetails && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Đặc điểm của thời đại</div>
                      <div className="text-sm">{scene.eraDetails}</div>
                    </div>
                  )}
                  {scene.keyProps && scene.keyProps.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">đạo cụ chính</div>
                      <div className="text-sm">{scene.keyProps.join('、')}</div>
                    </div>
                  )}
                  {scene.spatialLayout && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">bố trí không gian</div>
                      <div className="text-sm">{scene.spatialLayout}</div>
                    </div>
                  )}
                </>
              )}
              
              {/* Lời nhắc trực quan（Hiệu chuẩn AI\u540e\u663e\u793a） */}
              {((promptLanguage !== 'en' && scene.visualPrompt) || (promptLanguage !== 'zh' && scene.visualPromptEn)) && (
                <>
                  <Separator className="my-2" />
                  <div className="text-xs font-medium text-primary mb-2">Lời nhắc trực quan</div>
                  
                  {promptLanguage !== 'en' && scene.visualPrompt && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Tiếng Trung</div>
                      <div className="text-sm text-muted-foreground">{scene.visualPrompt}</div>
                    </div>
                  )}
                  {promptLanguage !== 'zh' && scene.visualPromptEn && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">English</div>
                      <div className="text-sm text-muted-foreground italic">{scene.visualPromptEn}</div>
                    </div>
                  )}
                </>
              )}
              
              {/* Nhiều Góc nhìđồ thị chungXem trước - \u4ec5\u663e\u793a AI Phân tíG của chóc nhìn */}
              {sceneShots.length > 0 && (() => {
                // \u53eaSử dụng AI Ph.ân tíG của chóc nhìn
                if (!scene.viewpoints || scene.viewpoints.length === 0) {
                  return (
                    <>
                      <Separator className="my-2" />
                      <div className="text-xs font-medium text-primary mb-2">
                        <Grid3X3 className="h-3 w-3 inline mr-1" />
                        Nhiều Góc nhìđồ thị chung
                      </div>
                      <div className="text-xs text-muted-foreground">
                        \u672aPhân tíchGóc nhìn（Tùy chọn，AI hiệu chuẩn Phân cảnh\u540eTự động Tạo）
                      </div>
                    </>
                  );
                }
                
                const viewpoints = scene.viewpoints.map(v => ({
                  ...v,
                  shotIndexes: v.shotIds?.map(id => {
                    const shot = sceneShots.find(s => s.id === id);
                    return shot?.index || 0;
                  }).filter(i => i > 0) || [],
                }));
                
                return (
                  <>
                    <Separator className="my-2" />
                    <div className="text-xs font-medium text-primary mb-2">
                      <Grid3X3 className="h-3 w-3 inline mr-1" />
                      Nhiều Góc nhìđồ thị chung
                    </div>
                    
                    <div className="text-xs text-muted-foreground mb-2">
                      AI Phân tích {viewpoints.length} Góc nhìn
                    </div>
                    
                    {/* Góc nhìnDanh sách */}
                    <div className="space-y-1.5">
                      {viewpoints.slice(0, 6).map((vp, idx) => (
                        <div 
                          key={vp.id} 
                          className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50"
                        >
                          <span className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center font-medium">
                            {idx + 1}
                          </span>
                          <span className="flex-1 truncate">{vp.name}</span>
                          {vp.shotIndexes && vp.shotIndexes.length > 0 && (
                            <span className="text-muted-foreground">
                              Phân cảnh #{vp.shotIndexes.map(i => String(i).padStart(2, '0')).join(',#')}
                            </span>
                          )}
                        </div>
                      ))}
                      {viewpoints.length > 6 && (
                        <div className="text-xs text-muted-foreground text-center py-1">
                          \u8fd8Có {viewpoints.length - 6} Góc nhìn...
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              
              {/* Ngoại hìnhống kê */}
              {(scene.appearanceCount || scene.episodeNumbers?.length) && (
                <>
                  <Separator className="my-2" />
                  <div className="flex items-center gap-2 flex-wrap">
                    {scene.importance && (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        scene.importance === 'main' ? 'bg-primary/10 text-primary' :
                        scene.importance === 'secondary' ? 'bg-yellow-500/10 text-yellow-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {scene.importance === 'main' ? 'Chính Cảnh' : scene.importance === 'secondary' ? 'Tiểu Cảnh' : 'Chuyển tiếpCảnh'}
                      </span>
                    )}
                    {scene.appearanceCount && (
                      <span className="text-xs text-muted-foreground">xuất hiện {scene.appearanceCount} lần</span>
                    )}
                    {scene.episodeNumbers && scene.episodeNumbers.length > 0 && (
                      <span className="text-xs text-muted-foreground">Không. {scene.episodeNumbers.join(', ')} đặt</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <Separator />

          {/* Thao tác */}
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => onGoToSceneLibrary?.(scene.id)}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              \u53bbThư viện cảnhTạoNền
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCopySceneData}
            >
              {copiedScene ? (
                <Check className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copiedScene ? 'Đã rồi\u590d\u5236' : '\u590d\u5236Cảnh dữ liệu'}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => onGoToDirectorFromScene?.(scene.id)}
            >
              <Film className="h-4 w-4 mr-2" />
              \u53bbAIgiám đốcTạo video
            </Button>
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              XoáCảnh
            </Button>
          </div>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhậnXoá</AlertDialogTitle>
              <AlertDialogDescription>\u786e\u5b9a\u8981XoáCảnh「{scene.name || scene.location}」\u5417？\u5176Hạ Tất cảPhân cảnh\u4e5f\u5c06\u88abXoá。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Huỷ</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Xoá</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ScrollArea>
    );
  }

  // Phân cảnhChi tiết
  if (selectedItemType === "shot" && shot) {
    const shotStatus = getShotCompletionStatus(shot);
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4 pb-32">
          {/* \u5934\u90e8 */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Phân cảnh {String(shot.index).padStart(2, "0")}</h3>
              <StatusBadge status={shotStatus} />
            </div>
            {!isEditing ? (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={startEditing}>
                <Pencil className="h-3 w-3" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSave}>
                  <Save className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Xem trước\u56fe */}
          {shot.imageUrl && (
            <div className="rounded-lg overflow-hidden">
              <img
                src={shot.imageUrl}
                alt={`Shot ${shot.index}`}
                className="w-full h-auto"
              />
            </div>
          )}

          <Separator />

          {/* \u5c5e\u6027 */}
          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Cỡ cảnh</Label>
                  <Input value={editData.shotSize || ""} onChange={(e) => setEditData({ ...editData, shotSize: e.target.value })} className="h-8" placeholder="Chẳng hạn như：WS/MS/CU/ECU" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cảnh quay thể thao</Label>
                  <Select value={editData.cameraMovement || 'none'} onValueChange={(v) => setEditData({ ...editData, cameraMovement: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMERA_MOVEMENT_PRESETS.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kỹ thuật chụp đặc biệt</Label>
                <Select value={editData.specialTechnique || 'none'} onValueChange={(v) => setEditData({ ...editData, specialTechnique: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIAL_TECHNIQUE_PRESETS.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hành độngMô tả</Label>
                <Textarea value={editData.actionSummary || ""} onChange={(e) => setEditData({ ...editData, actionSummary: e.target.value })} className="min-h-[80px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">đối thoại</Label>
                <Textarea value={editData.dialogue || ""} onChange={(e) => setEditData({ ...editData, dialogue: e.target.value })} className="min-h-[60px]" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Cảnh quaythông tin：Cỡ cảnh + các môn thể thao + Thời lượng */}
              <div className="flex items-center gap-2 flex-wrap">
                {shot.shotSize && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                    {shot.shotSize}
                  </span>
                )}
                {shot.cameraMovement && shot.cameraMovement !== 'none' && (
                  <span className="px-2 py-0.5 bg-muted rounded text-xs">
                    {CAMERA_MOVEMENT_PRESETS.find(p => p.id === shot.cameraMovement)?.label || shot.cameraMovement}
                  </span>
                )}
                {shot.specialTechnique && shot.specialTechnique !== 'none' && (
                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded text-xs">
                    {SPECIAL_TECHNIQUE_PRESETS.find(p => p.id === shot.specialTechnique)?.label || shot.specialTechnique}
                  </span>
                )}
                {(shot as any).duration && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs">
                    <Timer className="h-3 w-3" />
                    {(shot as any).duration}s
                  </span>
                )}
              </div>

              {/* \u8be6\u7ec6Tầm nhìn Mô tả */}
              {(shot as any).visualDescription && (
                <div className="bg-gradient-to-r from-primary/5 to-transparent p-3 rounded-lg border-l-2 border-primary/30">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    \u89c6\u89c9
                  </div>
                  <div className="text-sm leading-relaxed">{(shot as any).visualDescription}</div>
                </div>
              )}

              {/* Hành độngMô tả */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Hành độngMô tả</div>
                <div className="text-sm">{shot.actionSummary}</div>
              </div>

              {/* Âthiết kế m thanh */}
              {((shot as any).ambientSound || (shot as any).soundEffect || shot.dialogue) && (
                <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Volume2 className="h-3 w-3" />
                    Âm thanh
                  </div>
                  {(shot as any).ambientSound && (
                    <div>
                      <span className="text-xs text-muted-foreground">Âm thanh xung quanh: </span>
                      <span className="text-xs italic">{(shot as any).ambientSound}</span>
                    </div>
                  )}
                  {(shot as any).soundEffect && (
                    <div>
                      <span className="text-xs text-muted-foreground">Hiệu ứng âm thanh: </span>
                      <span className="text-xs italic">{(shot as any).soundEffect}</span>
                    </div>
                  )}
                  {shot.dialogue && (
                    <div>
                      <span className="text-xs text-muted-foreground">Đối thoại: </span>
                      <span className="text-xs italic">"{shot.dialogue}"</span>
                    </div>
                  )}
                </div>
              )}

              {/* Ngoại hình Nhân vật */}
              {shot.characterNames && shot.characterNames.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Ngoại hình Nhân vật</div>
                  <div className="flex flex-wrap gap-1">
                    {shot.characterNames.map((name, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-muted rounded text-xs"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Thẻ cảm xúc */}
              {shot.emotionTags && shot.emotionTags.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">cảm xúc</div>
                  <div className="flex flex-wrap gap-1">
                    {shot.emotionTags.map((tag, i) => {
                      const emotionLabels: Record<string, string> = {
                        happy: 'hạnh phúc', sad: 'buồn', angry: 'tức giận', surprised: 'ngạc nhiên', fearful: 'nỗi sợ hãi', calm: 'bình tĩnh',
                        tense: 'lo lắng', excited: 'vui mừng', mysterious: 'bí ẩn', romantic: 'lãng mạn', funny: 'Hài hước', touching: 'chạm vào',
                        serious: 'nghiêm túc', relaxed: 'Dễ dàng', playful: 'chế nhạo', gentle: 'nhẹ nhàng', passionate: 'đam mê', low: 'thấp'
                      };
                      return (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs"
                        >
                          {emotionLabels[tag] || tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TạoTrạng thái */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Hình ảnh</span>
              <StatusBadge
                status={
                  shot.imageStatus === "completed"
                    ? "completed"
                    : shot.imageStatus === "generating"
                    ? "in_progress"
                    : "pending"
                }
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Video</span>
              <StatusBadge
                status={
                  shot.videoStatus === "completed"
                    ? "completed"
                    : shot.videoStatus === "generating"
                    ? "in_progress"
                    : "pending"
                }
              />
            </div>
          </div>

          <Separator />

          {/* Thao tác */}
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => onGoToDirector?.(shot.id)}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              \u53bbAIgiám đốcTạo
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleCopyShotTriPrompts}
            >
              {copiedShotPrompts ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Đã rồi\u590d\u5236
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  \u590d\u5236ba\u5c42Prompt\u6570\u636e
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              XoáPhân cảnh
            </Button>
          </div>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhậnXoá</AlertDialogTitle>
              <AlertDialogDescription>\u786e\u5b9a\u8981XoáPhân cảnh {shot.index} \u5417？</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Huỷ</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Xoá</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ScrollArea>
    );
  }

  return null;
}
