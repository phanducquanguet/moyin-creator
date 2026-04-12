// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Cửa hàng cấp S — Phần tạo đa phương thức Seedance 2.0 Trạng thátôi quản lý
 *
 * khái niệm cốt lõi：
 * - ShotGroup：Hợp nhất SplitScenes trong cửa hàng giám đốc theo nhóm，cho đa Cảnh quaynarrativeVideoTạo
 * - AssetRef：@Nội dung tham chiếu（Hình ảnh/Video/Âm thanh），Nhắc nhở với @Image1 @Video1 @Tham chiếu biểu mẫu Audio1
 * - Chế độ kép：Phân cảnh chế độ（từKịch bản dây chuyền lắp ráp Nhập）+ Chế độ miễn phí（Chất liệu nguyên chất Tải lên）
 *
 * Hạn chế của Seedance 2.0：
 * - Đầu vào：≤9Hình ảnh + ≤3Video(≤15s) + ≤3Âm thanh(MP3,≤15s) + văn bản (5000 ký tự) ，Tổng Tệp≤12
 * - Đầu ra：4-15s，480p/720p/1080p，16:9/9:16/4:3/3:4/21:9/1:1
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createProjectScopedStorage } from '@/lib/project-storage';

// ==================== Types ====================

/** @Tài sản tham chiếu Loại */
export type AssetType = 'image' | 'video' | 'audio';

/** Sử dụng vật liệu（Seedance 2.0 @Ghi nhãn chính xác việc sử dụng vật liệu） */
export type AssetPurpose =
  | 'character_ref'     // Nhân vậsự phản bội
  | 'scene_ref'         // Cảnh tham khảo
  | 'first_frame'       // khung hình đầu tiên
  | 'grid_image'        // biểu đồ lưới
  | 'camera_replicate'  // Bản sao chuyển động gương
  | 'action_replicate'  // Hành độbản sao
  | 'effect_replicate'  // Hiệu ứbản sao
  | 'beat_sync'         // Điểm kẹt nhạc
  | 'bgm'              // NềnÂm nhạc
  | 'voice_ref'        // Tham chiếu bằng giọng nói
  | 'prev_video'       // Phần mở rộng phía trước
  | 'video_extend'     // Video mở rộng
  | 'video_edit_src'   // Bé Chỉnh sửNguồn Video của một
  | 'general'          // tài liệu tham khảo chung
;

/** VideoTạoTrạng thái */
export type VideoGenStatus = 'idle' | 'generating' | 'completed' | 'failed';

/** Đầbạn raTỷ lệ khung hình video */
export type SClassAspectRatio = '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '1:1';

/** Đầu raVideoĐộ phân giải */
export type SClassResolution = '480p' | '720p' | '1080p';

/** Đầu raVideoThời lượng（giây） */
export type SClassDuration = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

/** chế độ sáng tạo */
export type SClassMode = 'storyboard' | 'free';

/** Nhóm TạoLoại */
export type GroupGenerationType = 'new' | 'extend' | 'edit';

/** Hướng mở rộng */
export type ExtendDirection = 'forward' | 'backward';

/** Chỉnh sửaLoại */
export type EditType = 'plot_change' | 'character_swap' | 'attribute_modify' | 'element_add';

// ==================== Interfaces ====================

/**
 * @Nội dung tham chiếu
 * Nhắc nhở với @Image1, @Video1, @Tham chiếu chế độ Audio1
 */
export interface AssetRef {
  id: string;
  type: AssetType;
  /** Thẻ nội dung，Chẳng hạn như @Image1, @Video2 */
  tag: string;
  /** địa phươngTệpĐường dẫcũng như URL dữ liệu */
  localUrl: string;
  /** HTTP URL（Tải lên thu được sau khi truy cập API） */
  httpUrl: string | null;
  /** Tệtên p（để trưng bày） */
  fileName: string;
  /** TệpKích cỡ（Byte） */
  fileSize: number;
  /** Video/Âm thanhThời lượng（giây），Hình ảnh là null */
  duration: number | null;
  /** Sử dụng vật liệu（Seedance 2.0 @Ghi nhãn chính xác việc sử dụng vật liệu） */
  purpose?: AssetPurpose;
}

/**
 * TạoLịch sửBản ghi
 */
export interface GenerationRecord {
  id: string;
  timestamp: number;
  prompt: string;
  videoUrl: string | null;
  status: VideoGenStatus;
  error: string | null;
  /** Ảnh chụp nhanh tham chiếu nội dung đã được sử dụng */
  assetRefs: AssetRef[];
  /** TạoTham sốẢnh chụp nhanh */
  config: {
    aspectRatio: SClassAspectRatio;
    resolution: SClassResolution;
    duration: SClassDuration;
  };
}

/**
 * Cảnh quay group — Cấu trúc dữ liệu cốt lõi cấp S
 *
 * Nhóm nhiều SplitScenes trong cửa hàng giám đốc，
 * Hợp nhất khung hình đầu tiên của họ Hình ảnh、Prompt，TạoNhiều chữ C trong một đoạn vănảnh quay tường thuậtVideo。
 */
export interface ShotGroup {
  id: string;
  /** Tên nhóm（Tự động TạoorNgười dùngTuỳ chỉnh） */
  name: string;
  /** Tham khảo danh sách SplitScene.id trong cửa hàng giám đốc */
  sceneIds: number[];
  /** Tổng Th trong nhómời lượgiới hạn ng（≤15s） */
  totalDuration: SClassDuration;
  /** @Hình ảnh tham khảo */
  imageRefs: AssetRef[];
  /** @Trích dẫn video */
  videoRefs: AssetRef[];
  /** @Âm thanh quote */
  audioRefs: AssetRef[];
  /** Lời nhắc đã hợp nhất（Người dùng can Chỉnh sửa） */
  mergedPrompt: string;
  /** TạURL video của o */
  videoUrl: string | null;
  /** ID thư viện video（Dùng để kéo tới Thờtôi gian dòng） */
  videoMediaId: string | null;
  /** VideoTạoTrạng thái */
  videoStatus: VideoGenStatus;
  /** TạoTiến độ 0-100 */
  videoProgress: number;
  /** Lỗtôi thông tin */
  videoError: string | null;
  /** TạoLịch sử */
  history: GenerationRecord[];
  /** Sắp xếchỉ số p */
  sortIndex: number;
  /** Hợp nhất dữ liệu lưới mắt cáoUrl（VideoTạXây dựng tại o，for Xem trước/Tải xuống） */
  gridImageUrl: string | null;
  /** T gần đây nhấtạo Đã sử dụng toàn bộ lời nhắc（để kiểm tra bản sao） */
  lastPrompt: string | null;

  // ---- Hiệu chỉnh AI cấp nhóm ----
  /** vòng kể chuyện nhóm（Sản phẩm hiệu chuẩn AI） */
  narrativeArc?: string;
  /** Cảnh quay phòng Chuyển tiếlệnh p，chiều dài = sceneIds.length - 1 */
  transitions?: string[];
  /** cấp độ nhómÂthiết kế m thanh（Toàn bộ kế hoạch của thập niên 15） */
  groupAudioDesign?: string;
  /** Lời nhắc cấp nhóm sau khi hiệu chỉnh AI（ưu tiên：mergedPrompt > calibratedPrompt > nối tự động） */
  calibratedPrompt?: string;
  /** Hiệu chuẩnTrạng thái */
  calibrationStatus?: 'idle' | 'calibrating' | 'done' | 'failed';
  /** Hiệu chuẩnLỗtôi thông tin */
  calibrationError?: string | null;

  // ---- Tiện ích mở rộng video & VideoChỉnh sửa ----
  /** Nhóm TạoLoại：new=T hoàn toàn mớiạo, extend=mở rộng, chỉnh sửa=Chỉnh sửa */
  generationType?: GroupGenerationType;
  /** Hướng mở rộng（Chỉ có hiệu lực khi gia hạn） */
  extendDirection?: ExtendDirection;
  /** Chỉnh sửaLoại（Chỉ có hiệu lực khi chỉnh sửa） */
  editType?: EditType;
  /** Nguồn ID nhóm（mở rộng/Chỉnh sửNhóm Video gốc của một） */
  sourceGroupId?: string;
  /** NguồnVideo URL（lưu trữ dư thừa，Ngăn chặn việc tìm thấy nhóm ban đầu sau khi bị xóa） */
  sourceVideoUrl?: string;
}

/**
 * thấu kính đơn TạoBản ghi（Lệnh dự trữ Cảnh quay độc lập TạoKhả năng）
 */
export interface SingleShotOverride {
  sceneId: number;
  /** Đơn Cảnh quay độc lập（Che Phân cảnhoriginPrompt） */
  prompt: string;
  /** @Nội dung tham chiếu */
  assetRefs: AssetRef[];
  /** TạURL video của o */
  videoUrl: string | null;
  videoMediaId: string | null;
  videoStatus: VideoGenStatus;
  videoProgress: number;
  videoError: string | null;
  history: GenerationRecord[];
}

// ==================== Project Data ====================

/** S lớp Dự ádữ liệu cấp độ n */
export interface SClassProjectData {
  /** Cảdanh sách nhóm nh quay */
  shotGroups: ShotGroup[];
  /** thấu kính đơn Tạo Bảng lớp phủ (SceneId -> override) */
  singleShotOverrides: Record<number, SingleShotOverride>;
  /** tình hình chung @Nội dung tham chiếu（Sử dụng ở chế độ miễn phí） */
  globalAssetRefs: AssetRef[];
  /** TạoCấu hình */
  config: SClassConfig;
  /** Chế độ hiện tại */
  mode: SClassMode;
  /** Liệu nó có được nhóm tự động từ dữ liệu giám đốc hay không */
  hasAutoGrouped: boolean;
  /** Jiugongge T gần đây nhấtạo URL hình ảnh lớn ban đầu（cho VideoTạo tái sử dụng thời gian，tránh tái xuất hiện） */
  lastGridImageUrl: string | null;
  /** Ph tương ứng với LastGridImageUrlân cảdanh sách ID（Được sử dụng để xác định xem nó có thể được tái sử dụng hay không） */
  lastGridSceneIds: number[] | null;
  editorPrefs: SClassEditorPrefs;
}

/** S-Class TạoCấu hình（Tỷ lệ khung hình cấu hình được chia sẻ/độ phân giải đã được thống nhất quản lý bởi cửa hàng giám đốc） */
export interface SClassConfig {
  defaultDuration: SClassDuration;
  /** TạoSố đồng thời */
  concurrency: number;
}

export interface SClassEditorPrefs {
  imageGenMode: 'single' | 'merged';
  frameMode: 'first' | 'last' | 'both';
  refStrategy: 'cluster' | 'minimal' | 'none';
  useExemplar: boolean;
  activeTab: 'editing' | 'trailer';
  episodeViewScope: 'all' | 'episode';
}

// ==================== Store ====================

interface SClassState {
  activeProjectId: string | null;
  projects: Record<string, SClassProjectData>;
  /** ID nhóm hiện được chọn */
  selectedGroupId: string | null;
  /** Tạomode：Nhóm Tạo / thấu kính đơn Tạo */
  generationMode: 'group' | 'single';
}

interface SClassActions {
  // Dự ánQuản lý
  setActiveProjectId: (projectId: string | null) => void;
  ensureProject: (projectId: string) => void;
  getProjectData: (projectId: string) => SClassProjectData;

  // Cảnh quay nhóm CRUD
  addShotGroup: (group: ShotGroup) => void;
  updateShotGroup: (groupId: string, updates: Partial<ShotGroup>) => void;
  removeShotGroup: (groupId: string) => void;
  setShotGroups: (groups: ShotGroup[]) => void;
  reorderShotGroups: (groupIds: string[]) => void;

  // Cảnh quay nhóm Cảnh quản lý
  addSceneToGroup: (groupId: string, sceneId: number) => void;
  removeSceneFromGroup: (groupId: string, sceneId: number) => void;
  moveSceneBetweenGroups: (fromGroupId: string, toGroupId: string, sceneId: number) => void;

  // Cảnh quay nhómVideoTạo
  updateGroupVideoStatus: (groupId: string, updates: Partial<Pick<ShotGroup, 'videoStatus' | 'videoProgress' | 'videoUrl' | 'videoError' | 'videoMediaId'>>) => void;
  addGroupHistory: (groupId: string, record: GenerationRecord) => void;

  // thấu kính đơn Tạo
  setSingleShotOverride: (sceneId: number, override: SingleShotOverride) => void;
  updateSingleShotVideo: (sceneId: number, updates: Partial<Pick<SingleShotOverride, 'videoStatus' | 'videoProgress' | 'videoUrl' | 'videoError' | 'videoMediaId'>>) => void;
  removeSingleShotOverride: (sceneId: number) => void;

  // @Nội dung tham chiếu
  addAssetRef: (groupId: string | null, asset: AssetRef) => void;
  removeAssetRef: (groupId: string | null, assetId: string) => void;

  // Cấu hình
  updateConfig: (config: Partial<SClassConfig>) => void;
  setEditorPrefs: (prefs: Partial<SClassEditorPrefs>) => void;

  // Bộ đệm lưới chín cung điện
  setLastGridImage: (url: string | null, sceneIds: number[] | null) => void;

  // UI
  setSelectedGroupId: (groupId: string | null) => void;
  setGenerationMode: (mode: 'group' | 'single') => void;
  setMode: (mode: SClassMode) => void;
  setHasAutoGrouped: (value: boolean) => void;

  // Đặt lại
  reset: () => void;
}

type SClassStore = SClassState & SClassActions;

// ==================== Defaults ====================

const defaultConfig: SClassConfig = {
  defaultDuration: 10,
  concurrency: 1,
};

const defaultEditorPrefs: SClassEditorPrefs = {
  imageGenMode: 'merged',
  frameMode: 'first',
  refStrategy: 'cluster',
  useExemplar: true,
  activeTab: 'editing',
  episodeViewScope: 'episode',
};

const defaultProjectData = (): SClassProjectData => ({
  shotGroups: [],
  singleShotOverrides: {},
  globalAssetRefs: [],
  config: { ...defaultConfig },
  mode: 'storyboard',
  hasAutoGrouped: false,
  lastGridImageUrl: null,
  lastGridSceneIds: null,
  editorPrefs: { ...defaultEditorPrefs },
});

const initialState: SClassState = {
  activeProjectId: null,
  projects: {},
  selectedGroupId: null,
  generationMode: 'group',
};

// ==================== Helpers ====================

/** Lấy D hiện tạiự ádữ liệu */
const getCurrentProject = (state: SClassState): SClassProjectData | null => {
  if (!state.activeProjectId) return null;
  return state.projects[state.activeProjectId] || null;
};

const normalizeProjectData = (project: any): SClassProjectData => {
  const defaults = defaultProjectData();
  return {
    ...defaults,
    ...project,
    config: {
      ...defaults.config,
      ...(project?.config || {}),
    },
    editorPrefs: {
      ...defaultEditorPrefs,
      ...(project?.editorPrefs || {}),
    },
  };
};

// ==================== Store ====================

export const useSClassStore = create<SClassStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========== Dự ánQuản lý ==========

      setActiveProjectId: (projectId) => {
        set({ activeProjectId: projectId });
        if (projectId) {
          get().ensureProject(projectId);
        }
      },

      ensureProject: (projectId) => {
        const { projects } = get();
        if (projects[projectId]) return;
        set({
          projects: { ...projects, [projectId]: defaultProjectData() },
        });
      },

      getProjectData: (projectId) => {
        const { projects } = get();
        return projects[projectId] || defaultProjectData();
      },

      // ========== Cảnh quay nhóm CRUD ==========

      addShotGroup: (group) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: [...project.shotGroups, group],
            },
          },
        });
      },

      updateShotGroup: (groupId, updates) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: project.shotGroups.map((g) =>
                g.id === groupId ? { ...g, ...updates } : g
              ),
            },
          },
        });
      },

      removeShotGroup: (groupId) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: project.shotGroups.filter((g) => g.id !== groupId),
            },
          },
        });
      },

      setShotGroups: (groups) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: groups,
            },
          },
        });
      },

      reorderShotGroups: (groupIds) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        const groupMap = new Map<string, ShotGroup>(project.shotGroups.map((g) => [g.id, g]));
        const reordered = groupIds
          .map((id, idx) => {
            const g = groupMap.get(id);
            return g ? { ...(g as ShotGroup), sortIndex: idx } : null;
          })
          .filter(Boolean) as ShotGroup[];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: reordered,
            },
          },
        });
      },

      // ========== Cảnh quay nhóm Cảnh quản lý ==========

      addSceneToGroup: (groupId, sceneId) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: project.shotGroups.map((g) =>
                g.id === groupId && !g.sceneIds.includes(sceneId)
                  ? { ...g, sceneIds: [...g.sceneIds, sceneId] }
                  : g
              ),
            },
          },
        });
      },

      removeSceneFromGroup: (groupId, sceneId) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: project.shotGroups.map((g) =>
                g.id === groupId
                  ? { ...g, sceneIds: g.sceneIds.filter((id) => id !== sceneId) }
                  : g
              ),
            },
          },
        });
      },

      moveSceneBetweenGroups: (fromGroupId, toGroupId, sceneId) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: project.shotGroups.map((g) => {
                if (g.id === fromGroupId) {
                  return { ...g, sceneIds: g.sceneIds.filter((id) => id !== sceneId) };
                }
                if (g.id === toGroupId && !g.sceneIds.includes(sceneId)) {
                  return { ...g, sceneIds: [...g.sceneIds, sceneId] };
                }
                return g;
              }),
            },
          },
        });
      },

      // ========== Cảnh quay nhómVideoTạo ==========

      updateGroupVideoStatus: (groupId, updates) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: project.shotGroups.map((g) =>
                g.id === groupId ? { ...g, ...updates } : g
              ),
            },
          },
        });
      },

      addGroupHistory: (groupId, record) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              shotGroups: project.shotGroups.map((g) =>
                g.id === groupId
                  ? { ...g, history: [...g.history, record] }
                  : g
              ),
            },
          },
        });
      },

      // ========== thấu kính đơn Tạo ==========

      setSingleShotOverride: (sceneId, override) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              singleShotOverrides: {
                ...project.singleShotOverrides,
                [sceneId]: override,
              },
            },
          },
        });
      },

      updateSingleShotVideo: (sceneId, updates) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        const existing = project.singleShotOverrides[sceneId];
        if (!existing) return;
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              singleShotOverrides: {
                ...project.singleShotOverrides,
                [sceneId]: { ...existing, ...updates },
              },
            },
          },
        });
      },

      removeSingleShotOverride: (sceneId) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        const { [sceneId]: _, ...rest } = project.singleShotOverrides;
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              singleShotOverrides: rest,
            },
          },
        });
      },

      // ========== @Nội dung tham chiếu ==========

      addAssetRef: (groupId, asset) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];

        if (groupId) {
          // Thêm vào nhóm được chỉ định
          set({
            projects: {
              ...projects,
              [activeProjectId]: {
                ...project,
                shotGroups: project.shotGroups.map((g) =>
                  g.id === groupId
                    ? {
                        ...g,
                        ...(asset.type === 'image'
                          ? { imageRefs: [...(g.imageRefs || []), asset] }
                          : asset.type === 'video'
                            ? { videoRefs: [...g.videoRefs, asset] }
                            : asset.type === 'audio'
                              ? { audioRefs: [...g.audioRefs, asset] }
                              : g),
                      }
                    : g
                ),
              },
            },
          });
        } else {
          // Thêm đến toàn cầu（chế độ miễn phí）
          set({
            projects: {
              ...projects,
              [activeProjectId]: {
                ...project,
                globalAssetRefs: [...project.globalAssetRefs, asset],
              },
            },
          });
        }
      },

      removeAssetRef: (groupId, assetId) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];

        if (groupId) {
          set({
            projects: {
              ...projects,
              [activeProjectId]: {
                ...project,
                shotGroups: project.shotGroups.map((g) =>
                  g.id === groupId
                    ? {
                        ...g,
                        imageRefs: (g.imageRefs || []).filter((r) => r.id !== assetId),
                        videoRefs: g.videoRefs.filter((r) => r.id !== assetId),
                        audioRefs: g.audioRefs.filter((r) => r.id !== assetId),
                      }
                    : g
                ),
              },
            },
          });
        } else {
          set({
            projects: {
              ...projects,
              [activeProjectId]: {
                ...project,
                globalAssetRefs: project.globalAssetRefs.filter((r) => r.id !== assetId),
              },
            },
          });
        }
      },

      // ========== Cấu hình ==========

      updateConfig: (configUpdates) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              config: { ...project.config, ...configUpdates },
            },
          },
        });
      },

      setEditorPrefs: (prefs) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              editorPrefs: {
                ...(project?.editorPrefs || defaultEditorPrefs),
                ...prefs,
              },
            },
          },
        });
      },

      // ========== UI ==========

      setSelectedGroupId: (groupId) => set({ selectedGroupId: groupId }),

      setGenerationMode: (mode) => set({ generationMode: mode }),

      setMode: (mode) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: { ...project, mode },
          },
        });
      },

      setHasAutoGrouped: (value) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: { ...project, hasAutoGrouped: value },
          },
        });
      },

      // ========== Bộ đệm lưới chín cung điện ==========

      setLastGridImage: (url, sceneIds) => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return;
        const project = projects[activeProjectId];
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              lastGridImageUrl: url,
              lastGridSceneIds: sceneIds,
            },
          },
        });
      },

      // ========== Đặt lại ==========

      reset: () => set(initialState),
    }),
    {
      name: 'moyin-sclass-store',
      storage: createJSONStorage(() => createProjectScopedStorage('sclass')),
      partialize: (state) => {
        const pid = state.activeProjectId;
        let projectData = null;
        if (pid && state.projects[pid]) {
          projectData = state.projects[pid];
        }
        return {
          activeProjectId: pid,
          projectData,
          generationMode: state.generationMode,
          // Don't persist: selectedGroupId (transient UI state)
        };
      },
      merge: (persisted: any, current: any) => {
        if (!persisted) return current;

        // Hỗ trợ di chuyển：Dọn dẹp các trường thừa đã bị loại bỏ trong SClassConfig（aspectRatio/độ phân giải được quản lý bởi cửa hàng giám đốc）
        const migrateConfig = (config: any) => {
          if (!config) return config;
          const { aspectRatio, resolution, ...clean } = config;
          return clean;
        };
        const migrateProjectData = (pd: any) => {
          if (!pd) return normalizeProjectData(pd);
          const normalized = normalizeProjectData(pd);
          return {
            ...normalized,
            config: migrateConfig(normalized.config),
            editorPrefs: {
              ...defaultEditorPrefs,
              ...(normalized.editorPrefs || {}),
            },
          };
        };

        // Legacy format
        if (persisted.projects && typeof persisted.projects === 'object') {
          const migratedProjects: any = {};
          for (const [k, v] of Object.entries(persisted.projects)) {
            migratedProjects[k] = migrateProjectData(v);
          }
          return { ...current, ...persisted, projects: migratedProjects };
        }

        // Per-project format
        const { activeProjectId: pid, projectData, generationMode } = persisted;
        const updates: any = { ...current };
        if (generationMode) updates.generationMode = generationMode;
        if (pid) updates.activeProjectId = pid;
        if (pid && projectData) {
          updates.projects = { ...current.projects, [pid]: migrateProjectData(projectData) };
        }
        return updates;
      },
    }
  )
);

// ==================== Selectors ====================

/** Nhận hoạt động hiện tại Dự áDữ liệu cấp S của n */
export const useActiveSClassProject = (): SClassProjectData | null => {
  return useSClassStore((state) => {
    if (!state.activeProjectId) return null;
    return state.projects[state.activeProjectId] || null;
  });
};

/** Lấy D hiện tạiự ánCảdanh sách nhóm nh quay */
export const useShotGroups = (): ShotGroup[] => {
  return useSClassStore((state) => {
    if (!state.activeProjectId) return [];
    const project = state.projects[state.activeProjectId];
    return project?.shotGroups || [];
  });
};

/** Lấy C được chỉ địnhảnh quay group */
export const useShotGroup = (groupId: string): ShotGroup | null => {
  return useSClassStore((state) => {
    if (!state.activeProjectId) return null;
    const project = state.projects[state.activeProjectId];
    return project?.shotGroups.find((g) => g.id === groupId) || null;
  });
};
