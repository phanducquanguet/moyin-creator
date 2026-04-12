// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { fileStorage } from "@/lib/indexed-db-storage";
import { generateUUID } from "@/lib/utils";

export const DEFAULT_FPS = 30;

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  createProject: (name?: string) => Project;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  ensureDefaultProject: () => void;
}

// Default project for desktop app
const DEFAULT_PROJECT: Project = {
  id: "default-project",
  name: "Ma quỷ Manchuang Dự án",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [DEFAULT_PROJECT],
      activeProjectId: DEFAULT_PROJECT.id,
      activeProject: DEFAULT_PROJECT,

      ensureDefaultProject: () => {
        const { projects, activeProjectId } = get();
        if (projects.length === 0) {
          set({
            projects: [DEFAULT_PROJECT],
            activeProjectId: DEFAULT_PROJECT.id,
            activeProject: DEFAULT_PROJECT,
          });
          return;
        }
        if (!activeProjectId) {
          set({
            activeProjectId: projects[0].id,
            activeProject: projects[0],
          });
        }
      },

      createProject: (name) => {
        const newProject: Project = {
          id: generateUUID(),
          name: name?.trim() || `D mớiự án ${new Date().toLocaleDateString('zh-CN')}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          projects: [newProject, ...state.projects],
          // Không phải ở đâyCài đặt activeProjectId —— Được xử lý thống nhất bởi switchProject()
          // Tránh switchProject bỏ qua việc bù nước vì ID giống nhau
        }));
        return newProject;
      },

      renameProject: (id, name) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          ),
          activeProject:
            state.activeProject?.id === id
              ? { ...state.activeProject, name, updatedAt: Date.now() }
              : state.activeProject,
        }));
      },

      deleteProject: (id) => {
        set((state) => {
          const remaining = state.projects.filter((p) => p.id !== id);
          const nextActive =
            state.activeProjectId === id ? remaining[0] || null : state.activeProject;
          return {
            projects: remaining,
            activeProjectId: nextActive?.id || null,
            activeProject: nextActive,
          };
        });
        // Clean up per-project storage directory
        if (window.fileStorage?.removeDir) {
          window.fileStorage.removeDir(`_p/${id}`).catch((err: any) =>
            console.warn(`[ProjectStore] Failed to remove project dir _p/${id}:`, err)
          );
        }
      },

      setActiveProject: (id) => {
        set((state) => {
          const project = state.projects.find((p) => p.id === id) || null;
          return {
            activeProjectId: project?.id || null,
            activeProject: project,
          };
        });
      },
    }),
    {
      name: "moyin-project-store",
      storage: createJSONStorage(() => fileStorage),
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
      }),
      migrate: (persisted: any) => {
        if (persisted?.projects && persisted.projects.length > 0) {
          return persisted;
        }
        return {
          projects: [DEFAULT_PROJECT],
          activeProjectId: DEFAULT_PROJECT.id,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const project =
          state.projects.find((p) => p.id === state.activeProjectId) ||
          state.projects[0] ||
          null;
        state.activeProjectId = project?.id || null;
        state.activeProject = project;

        // Quét đĩa không đồng bộ cho _p/ Thư mục，D còn thiếuự ánrestore vào danh sách
        // giải quyếtĐường dẫnChuyển đổi/Nhập/Sau khi di chuyểnDự áVấn đề với n danh sách trống
        discoverProjectsFromDisk().catch((err) =>
          console.warn('[ProjectStore] Disk discovery failed:', err)
        );
      },
    }
  )
);

/**
 * Quét đĩa để tìm _p/ Thư mụD thực tế theo cự ánThư mục，
 * sẽ không có trong danh sách dự ánĐăng kýDự ánTự động phục hồi。
 * 
 * Giải câu C sauảnh：
 * - Thay đổi lưu trữĐường dẫn và di chuyển dữ liệu，Cửa hàng giao diện người dùng không được tải lại，hoặc moyin-project-store.json
 *   Danh sách dự án chưa đầy đủ（Phi giàên bản、Sao chép thủ công, v.v.）
 * - NhậSau p data moyin-project-store.json bị thiếu hoặc không chứa D mớiự án
 * - Trỏ tới dữ liệu cũ sau khi đổi máy tính Thư mục，danh sách dự án trống
 */
async function discoverProjectsFromDisk(): Promise<void> {
  if (!window.fileStorage?.listDirs) return;

  try {
    // Danh sách _p/ Hạ Tất cảThư mụtên c（Mỗi đứa trẻ Thư mụTên c là projectId）
    const diskProjectIds = await window.fileStorage.listDirs('_p');
    if (!diskProjectIds || diskProjectIds.length === 0) return;

    const { projects } = useProjectStore.getState();
    const knownIds = new Set(projects.map((p) => p.id));

    const missingIds = diskProjectIds.filter((id) => !knownIds.has(id));
    if (missingIds.length === 0) return;

    console.log(
      `[ProjectStore] Found ${missingIds.length} projects on disk not in store:`,
      missingIds.map((id) => id.substring(0, 8))
    );

    // Hãy thử thiếu D t��� mỗiự ágiám đốc của n / script store TệTrích xuất D từ pự án tên
    const recoveredProjects: Project[] = [];
    for (const pid of missingIds) {
      let name = `Đã khôi phục Dự án (${pid.substring(0, 8)})`;
      const createdAt = Date.now();

      // Cố gắng lấy T từ cửa hàng tập lệnhên
      try {
        const scriptRaw = await window.fileStorage.getItem(`_p/${pid}/script-store`);
        if (scriptRaw) {
          const parsed = JSON.parse(scriptRaw);
          const state = parsed?.state ?? parsed;
          // Có thể có D trong trường dự án của script-storeự áthông tin
          if (state?.projects?.[pid]?.title) {
            name = state.projects[pid].title;
          }
        }
      } catch { /* ignore */ }

      // Cố gắng lấy T từ cửa hàng giám đốcạoThờtôi gian và những thông tin khác
      try {
        const directorRaw = await window.fileStorage.getItem(`_p/${pid}/director-store`);
        if (directorRaw) {
          const parsed = JSON.parse(directorRaw);
          const state = parsed?.state ?? parsed;
          if (state?.projects?.[pid]?.screenplay) {
            // Có Kịch bảnNội dung，Giải thích thực sự là một D hợp lệự án
            const screenplay = state.projects[pid].screenplay;
            if (!name.includes('Đã khôi phục Dự án')) {
              // Đã có T.ên，Không được bảo hiểm
            } else if (screenplay) {
              // Sử dụng Kịch bảTạo T tạm thời cho vài từ đầu tiên của nên
              const preview = screenplay.substring(0, 20).replace(/\n/g, ' ').trim();
              if (preview) name = preview + '...';
            }
          }
        }
      } catch { /* ignore */ }

      recoveredProjects.push({
        id: pid,
        name,
        createdAt,
        updatedAt: Date.now(),
      });
    }

    if (recoveredProjects.length > 0) {
      useProjectStore.setState((state) => ({
        projects: [...state.projects, ...recoveredProjects],
      }));
      console.log(
        `[ProjectStore] Recovered ${recoveredProjects.length} projects from disk:`,
        recoveredProjects.map((p) => `${p.id.substring(0, 8)}:${p.name}`)
      );
    }
  } catch (err) {
    console.error('[ProjectStore] discoverProjectsFromDisk error:', err);
  }
}
