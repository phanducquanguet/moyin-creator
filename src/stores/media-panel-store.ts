// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import {
  ClapperboardIcon,
  UsersIcon,
  VideoIcon,
  SettingsIcon,
  MapPinIcon,
  FileTextIcon,
  FilmIcon,
  SparklesIcon,
  PaletteIcon,
  LayoutDashboardIcon,
  FolderOpenIcon,
  LucideIcon,
} from "lucide-react";
import { create } from "zustand";
import type { CharacterIdentityAnchors, CharacterNegativePrompt } from "@/types/script";

// Tab-based navigation (simpler flat structure)
export type Tab = "dashboard" | "overview" | "script" | "characters" | "scenes" | "freedom" | "director" | "sclass" | "assets" | "media" | "export" | "settings";

export interface NavItem {
  id: Tab;
  label: string;
  icon: LucideIcon;
  phase?: string; // Optional phase indicator
}

// Main navigation items (top section)
export const mainNavItems: NavItem[] = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboardIcon },
  { id: "script", label: "Kịch bản", icon: FileTextIcon, phase: "01" },
  { id: "characters", label: "Nhân vật", icon: UsersIcon, phase: "02" },
  { id: "scenes", label: "Cảnh", icon: MapPinIcon, phase: "02" },
  { id: "director", label: "giám đốc", icon: ClapperboardIcon, phase: "03" },
  { id: "sclass", label: "lớp S", icon: SparklesIcon, phase: "03" },
  { id: "assets", label: "tài sản", icon: FolderOpenIcon },
  { id: "media", label: "Chất liệu", icon: VideoIcon },
  { id: "export", label: "Xuất", icon: FilmIcon, phase: "04" },
  { id: "freedom", label: "sự tự do", icon: PaletteIcon, phase: "02" },
];

// Bottom navigation items
export const bottomNavItems: NavItem[] = [
  { id: "settings", label: "Cài đặt", icon: SettingsIcon },
];

// Legacy exports for compatibility
export type Stage = "script" | "assets" | "director" | "export";
export interface StageConfig {
  id: Stage;
  label: string;
  phase: string;
  icon: LucideIcon;
  tabs: Tab[];
}
export const stages: StageConfig[] = [
  { id: "script", label: "Kịch bản", phase: "Phase 01", icon: FileTextIcon, tabs: ["script"] },
  { id: "assets", label: "Nhân vật và Cảnh", phase: "Phase 02", icon: UsersIcon, tabs: ["characters", "scenes"] },
  { id: "director", label: "Bàn giám đốc", phase: "Phase 03", icon: ClapperboardIcon, tabs: ["director"] },
  { id: "export", label: "Làm phim và Xuất", phase: "Phase 04", icon: FilmIcon, tabs: ["export"] },
];

export const tabs: { [key in Tab]: { icon: LucideIcon; label: string; stage?: Stage } } = {
  dashboard: { icon: FileTextIcon, label: "Dự án" },
  overview: { icon: LayoutDashboardIcon, label: "Tổng quan" },
  script: { icon: FileTextIcon, label: "Kịch bản", stage: "script" },
  characters: { icon: UsersIcon, label: "Nhân vật", stage: "assets" },
  scenes: { icon: MapPinIcon, label: "Cảnh", stage: "assets" },
  freedom: { icon: PaletteIcon, label: "sự tự do" },
  director: { icon: ClapperboardIcon, label: "giám đốc", stage: "director" },
  sclass: { icon: SparklesIcon, label: "lớp S", stage: "director" },
  assets: { icon: FolderOpenIcon, label: "tài sản" },
  media: { icon: VideoIcon, label: "Chất liệu" },
  export: { icon: FilmIcon, label: "Xuất", stage: "export" },
  settings: { icon: SettingsIcon, label: "Cài đặt" },
};

// Data passed from script panel to director
export interface PendingDirectorData {
  storyPrompt: string; // Combined action + dialogue
  characterNames?: string[];
  sceneLocation?: string;
  sceneTime?: string;
  shotId?: string; // Source shot ID for reference
  // Auto-fill parameters
  sceneCount?: number; // 1 for single shot, N for scene with N shots
  styleId?: string; // Visual style from script
  sourceType?: 'shot' | 'scene' | 'episode'; // What triggered this jump
  // Đặt thông qua phạm vi
  sourceEpisodeIndex?: number;
  sourceEpisodeId?: string;
}

// Data passed from script panel to character library
export interface PendingCharacterData {
  name: string;
  gender?: string;
  age?: string;
  personality?: string;
  role?: string;
  traits?: string;
  skills?: string;
  keyActions?: string;
  appearance?: string;
  relationships?: string;
  tags?: string[];    // Nhân vậthẻ t
  notes?: string;     // Nhân vậtNhận xét
  styleId?: string;
  // Đặt thông qua phạm vi
  sourceEpisodeIndex?: number;
  sourceEpisodeId?: string;
  // === thông tin tuổi tác（từKịch bảtruyền dữ liệu phần tử n）===
  storyYear?: number;  // năm câu chuyện，Chẳng hạn như năm 2002
  era?: string;        // Thời đại NềnMô tả
  // === Tùy chọn ngôn ngữ nhắc nhở（từKịch bản bảng truyền trong suốt）===
  promptLanguage?: import('@/types/script').PromptLanguage;  // 'zh' | 'en' | 'zh+en'
  // === NH chuyên nghiệpân vậlĩnh vực thiết kế t（Bậc thầy đẳng cấp thế giới Tạo） ===
  visualPromptEn?: string;  // Lời nhắc trực quan bằng tiếng Anh
  visualPromptZh?: string;  // Lời nhắc trực quan của Trung Quốc
  // === Neo nhận dạng lớp 6（Nhân vậtTính nhất quán） ===
  identityAnchors?: CharacterIdentityAnchors;  // Identity Anchors – Khóa tính năng 6 lớp
  negativePrompt?: CharacterNegativePrompt;    // Lời nhắc tiêu cực
  // === Nh nhiều giai đoạnân vậtHỗ trợ ===
  stageInfo?: {
    stageName: string;
    episodeRange: [number, number];
    ageDescription?: string;
  };
  consistencyElements?: {
    facialFeatures?: string;
    bodyType?: string;
    uniqueMarks?: string;
  };
}

// Data passed from script panel to scene library
export interface PendingSceneData {
  // === Cơ bảthông tin ===
  name: string;
  location: string;
  time?: string;
  atmosphere?: string;
  styleId?: string;
  tags?: string[];        // Cảthẻ nh
  notes?: string;         // CảnhNhận xét
  // Đặt thông qua phạm vi
  sourceEpisodeIndex?: number;
  sourceEpisodeId?: string;
  // Tùy chọn ngôn ngữ nhắc nhở
  promptLanguage?: import('@/types/script').PromptLanguage;
  
  // === C chuyên nghiệpảnh thiết kế（Giao hàng đầy đủ）===
  visualPrompt?: string;       // Tầm nhìn Trung Quốc Mô tả
  visualPromptEn?: string;     // Tiếng Anh Visual Mô tả
  architectureStyle?: string;  // Kiến trúcPhong cách
  lightingDesign?: string;     // Ánh sáthiết kế
  colorPalette?: string;       // Màu sắgiai điệu c
  eraDetails?: string;         // Đặc điểm của thời đại
  keyProps?: string[];         // đạo cụ chính
  spatialLayout?: string;      // bố trí không gian
  
  // === Nhiều Góc nhìdữ liệu đồ thị nối ===
  viewpoints?: PendingViewpointData[];           // Góc nhìnDanh sách
  contactSheetPrompts?: ContactSheetPromptSet[]; // Biểu đồ công đoàn（Có thể nhiều）
}

// Đợi T.ạo'sGóc nhìdữ liệu
export interface PendingViewpointData {
  id: string;           // Góc nhìnID
  name: string;         // Tên tiếng Trung：khu vực bàn ăn、khu vực ghế sofa
  nameEn: string;       // tên tiếng anh
  shotIds: string[];    // liên kết tiến sĩân cảnhID
  shotIndexes: number[]; // liên kết tiến sĩân cảsố sê-ri（để trưng bày）
  keyProps: string[];   // đạo cụ（Tiếng Trung）
  keyPropsEn: string[]; // đạo cụ（Tiếng Anh）
  gridIndex: number;    // V trong sơ đồ chungị trí
  pageIndex: number;    // Nó thuộc về bức tranh chung nào?（từ 0Bắt đầu）
}

// Bộ sưu tập lời nhắc biểu đồ liên minh（Hỗ trợNhiều hình ảnh）
export interface ContactSheetPromptSet {
  pageIndex: number;          // Hình ảnh chung nào（từ 0Bắt đầu）
  prompt: string;             // Tiếng AnhNhắc
  promptZh: string;           // Lời nhắc tiếng Trung
  viewpointIds: string[];     // Gs nào được bao gồm?óc nhìnID
  gridLayout: { rows: number; cols: number };
}

interface MediaPanelStore {
  activeTab: Tab;
  activeStage: Stage;
  inProject: boolean; // Whether viewing a project or dashboard
  setActiveTab: (tab: Tab) => void;
  setActiveStage: (stage: Stage) => void;
  setInProject: (inProject: boolean) => void;
  // Phạm vi tập (subDự ánscope)
  activeEpisodeIndex: number | null;
  activeEpisodeScopeKey: string | null; // `${projectId}::ep-${episodeIndex}`
  enterEpisode: (index: number, projectId?: string) => void;
  backToSeries: () => void;
  highlightMediaId: string | null;
  requestRevealMedia: (mediaId: string) => void;
  clearHighlight: () => void;
  // Cross-panel data passing
  pendingDirectorData: PendingDirectorData | null;
  setPendingDirectorData: (data: PendingDirectorData | null) => void;
  goToDirectorWithData: (data: PendingDirectorData) => void;
  // Character library data passing
  pendingCharacterData: PendingCharacterData | null;
  setPendingCharacterData: (data: PendingCharacterData | null) => void;
  goToCharacterWithData: (data: PendingCharacterData) => void;
  // Scene library data passing
  pendingSceneData: PendingSceneData | null;
  setPendingSceneData: (data: PendingSceneData | null) => void;
  goToSceneWithData: (data: PendingSceneData) => void;
}

export const useMediaPanelStore = create<MediaPanelStore>((set) => ({
  activeTab: "dashboard",
  activeStage: "script",
  inProject: false,
  setActiveTab: (tab) => {
    // Auto-update stage based on tab
    const tabConfig = tabs[tab];
    if (tabConfig?.stage) {
      set({ activeTab: tab, activeStage: tabConfig.stage, inProject: true });
    } else if (tab === "dashboard") {
      set({ activeTab: tab, inProject: false, activeEpisodeIndex: null, activeEpisodeScopeKey: null });
    } else if (tab === "overview" || tab === "freedom") {
      // Dự átab cấp độ n（Không có giai đoạn nhưng thuộc về Dự átrong vòng n）
      set({ activeTab: tab, inProject: true });
    } else {
      set({ activeTab: tab });
    }
  },
  setActiveStage: (stage) => {
    // Switch to first tab of the stage
    const stageConfig = stages.find(s => s.id === stage);
    if (stageConfig && stageConfig.tabs.length > 0) {
      set({ activeStage: stage, activeTab: stageConfig.tabs[0], inProject: true });
    }
  },
  setInProject: (inProject) => {
    if (!inProject) {
      set({ inProject: false, activeTab: "dashboard", activeEpisodeIndex: null, activeEpisodeScopeKey: null });
    } else {
      set({ inProject: true });
    }
  },
  // Episode scope
  activeEpisodeIndex: null,
  activeEpisodeScopeKey: null,
  enterEpisode: (index, projectId) => set({
    activeEpisodeIndex: index,
    activeEpisodeScopeKey: projectId ? `${projectId}::ep-${index}` : `default::ep-${index}`,
    activeTab: "script",
    activeStage: "script",
    inProject: true,
  }),
  backToSeries: () => set({
    activeEpisodeIndex: null,
    activeEpisodeScopeKey: null,
    activeTab: "overview",
  }),
  highlightMediaId: null,
  requestRevealMedia: (mediaId) =>
    set({ activeTab: "media", highlightMediaId: mediaId }),
  clearHighlight: () => set({ highlightMediaId: null }),
  // Cross-panel data passing
  pendingDirectorData: null,
  setPendingDirectorData: (data) => set({ pendingDirectorData: data }),
  goToDirectorWithData: (data) => set({
    pendingDirectorData: data,
    activeTab: "director",
    activeStage: "director",
    inProject: true,
  }),
  // Character library data passing
  pendingCharacterData: null,
  setPendingCharacterData: (data) => set({ pendingCharacterData: data }),
  goToCharacterWithData: (data) => set({
    pendingCharacterData: data,
    activeTab: "characters",
    activeStage: "assets",
    inProject: true,
  }),
  // Scene library data passing
  pendingSceneData: null,
  setPendingSceneData: (data) => set({ pendingSceneData: data }),
  goToSceneWithData: (data) => set({
    pendingSceneData: data,
    activeTab: "scenes",
    activeStage: "assets",
    inProject: true,
  }),
}));
