// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Custom Style Store
 * Người dùngTuỳ chỉnhPhong cáchQuản lý tài sản，Độc lập với các cài đặt trước tích hợp
 * Sử dụng localStorage để duy trì sự kiên trì（tài sản toàn cầu，Đừng nhấn Dự án phép chia）
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { registerCustomStyleLookup, type StylePreset } from '@/lib/constants/visual-styles';

// ==================== Types ====================

export interface CustomStyle {
  id: string;
  name: string;                 // Phong cáchTên（Bắt buộc）
  prompt: string;               // Người dùngoriginPrompt（Có thể trộn lẫn với Phong cách+CảnhMô tả）
  negativePrompt: string;       // Lời nhắc tiêu cực
  description: string;          // Mô tả
  referenceImages: string[];    // Hình ảnh tham khảoĐường dẫn (local-image://styles/...)
  tags: string[];               // nhãn
  folderId: string | null;      // Thuộc về Th.ư mục
  // === Cấu trúc Phong c được trích xuất bằng AIách từ（Mức độ ưu tiên cao hơn lời nhắc） ===
  styleTokens?: string;         // Hình ảnh thuần khiết Phong cáchkeywords（phong cách vẽ tranh/ánh sáng/Màu sắc/Chất liệu）→ Nhân vật/Cảcách sử dụng sơ đồ thiết lập nh
  sceneTokens?: string;         // Cảnh/thành phần/Dự luật Mô tả → Bàn giám đốc/Phân cảnh sử dụng
  createdAt: number;
  updatedAt: number;
}

export interface CustomStyleFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

interface CustomStyleState {
  styles: CustomStyle[];
  folders: CustomStyleFolder[];
  selectedStyleId: string | null;
  editingStyleId: string | null;    // null = Không phải ở Chỉnh sửa, 'new' = Tạo mớtôi, người khác = Chỉnh sửđã rồi
}

interface CustomStyleActions {
  // Style CRUD
  addStyle: (style: Omit<CustomStyle, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateStyle: (id: string, updates: Partial<Omit<CustomStyle, 'id' | 'createdAt'>>) => void;
  deleteStyle: (id: string) => void;
  duplicateStyle: (id: string) => string | null;

  // Folder CRUD
  addFolder: (name: string, parentId?: string | null) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;

  // Selection
  selectStyle: (id: string | null) => void;
  setEditingStyle: (id: string | null) => void;

  // Queries
  getStyleById: (id: string) => CustomStyle | undefined;
  getStylesByFolder: (folderId: string | null) => CustomStyle[];
  getAllStyles: () => CustomStyle[];

  // Reset
  reset: () => void;
}

type CustomStyleStore = CustomStyleState & CustomStyleActions;

// ==================== Initial State ====================

const initialState: CustomStyleState = {
  styles: [],
  folders: [],
  selectedStyleId: null,
  editingStyleId: null,
};

// ==================== Store ====================

export const useCustomStyleStore = create<CustomStyleStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Style CRUD
      addStyle: (styleData) => {
        const id = `custom_style_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const now = Date.now();
        const newStyle: CustomStyle = {
          ...styleData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          styles: [...state.styles, newStyle],
        }));
        return id;
      },

      updateStyle: (id, updates) => {
        set((state) => ({
          styles: state.styles.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
          ),
        }));
      },

      deleteStyle: (id) => {
        set((state) => ({
          styles: state.styles.filter((s) => s.id !== id),
          selectedStyleId: state.selectedStyleId === id ? null : state.selectedStyleId,
          editingStyleId: state.editingStyleId === id ? null : state.editingStyleId,
        }));
      },

      duplicateStyle: (id) => {
        const source = get().styles.find((s) => s.id === id);
        if (!source) return null;
        const newId = `custom_style_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const now = Date.now();
        const copy: CustomStyle = {
          ...source,
          id: newId,
          name: `${source.name} (Sao chép)`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          styles: [...state.styles, copy],
        }));
        return newId;
      },

      // Folder CRUD
      addFolder: (name, parentId = null) => {
        const id = `stylefolder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newFolder: CustomStyleFolder = {
          id,
          name,
          parentId: parentId || null,
          createdAt: Date.now(),
        };
        set((state) => ({
          folders: [...state.folders, newFolder],
        }));
        return id;
      },

      renameFolder: (id, name) => {
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, name } : f
          ),
        }));
      },

      deleteFolder: (id) => {
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
          // Di chuyển đến thư mục gốc Thư mục
          styles: state.styles.map((s) =>
            s.folderId === id ? { ...s, folderId: null, updatedAt: Date.now() } : s
          ),
        }));
      },

      // Selection
      selectStyle: (id) => set({ selectedStyleId: id }),
      setEditingStyle: (id) => set({ editingStyleId: id }),

      // Queries
      getStyleById: (id) => get().styles.find((s) => s.id === id),
      getStylesByFolder: (folderId) => get().styles.filter((s) => s.folderId === folderId),
      getAllStyles: () => get().styles,

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'moyin-custom-styles',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        styles: state.styles,
        folders: state.folders,
      }),
    }
  )
);

// ==================== Đăng kýTuỳ chỉnhPhong cách tìm cuộc gọi lại ====================
// Hãy để chức năng tiện ích của visual-styles.ts（getStyleById/getStylePrompt, v.v.）
// Ng có thể được tìm thấyười dùngTuỳ chỉnhPhong cách（Ng được lưu trữ trong localStorageười dùdữ liệu）

/**
 * Suy ra Phong c từ Nhắcách phân loại（Hỗ trợTừ khóa tiếng Trung và tiếng Anh）
 * kết hợp từ khóa：
 *   real → realistic/photorealistic/photography/Thực tế/người thật/Cảnh thật/lớp phim/Bắn thật/phim ảnh
 *   3d   → 3d/render/unreal/c4d/ba chiều/kết xuất/Công cụ không thực
 *   stop_motion → stop motion/claymation/khung đóng băng/Đất sét
 *   Phần còn lại → '2d'
 */
function inferCategoryFromPrompt(prompt: string): import('@/lib/constants/visual-styles').StyleCategory {
  const lower = prompt.toLowerCase();
  // từ khóa tiếng anh
  if (/\b(realistic|photorealistic|real\s?person|photography|real\s?life|cinematic\s?lighting.*skin)/.test(lower)) {
    return 'real';
  }
  // từ khóa tiếng trung：Thực tế/người thật/Cảnh thật/Chủ nghĩa hiện thực điện ảnh/Bắn thật/phim ảnh/ảnh tĩnh
  if (/(thực tế|người thật|Cảnh thật|lớp phim|Bắn thật|phim ảnh|ảnh tĩnh|không có\s?CGI|kết cấu da|lỗ chân lông)/.test(prompt)) {
    return 'real';
  }
  // Từ khóa 3D tiếng Anh
  if (/\b(3d|render|unreal\s?engine|c4d|blender|voxel|low\s?poly)/.test(lower)) {
    return '3d';
  }
  // Từ khóa 3D tiếng Trung
  if (/(ba chiều|3D|kết xuất|Công cụ không thực|làm người mẫu)/.test(prompt)) {
    return '3d';
  }
  // Hồ đóng băngạt ảnh
  if (/\b(stop.?motion|claymation|puppet)/.test(lower) || /(Khung hình cố định|Đất sét|con rối)/.test(prompt)) {
    return 'stop_motion';
  }
  return '2d';
}

/** Suy ra Lo trung bình từ phân loạiại */
function inferMediaType(category: import('@/lib/constants/visual-styles').StyleCategory): import('@/lib/constants/visual-styles').MediaType {
  switch (category) {
    case 'real': return 'cinematic';
    case '3d': return 'cinematic';
    case 'stop_motion': return 'stop-motion';
    default: return 'animation';
  }
}

registerCustomStyleLookup((id: string): StylePreset | undefined => {
  const style = useCustomStyleStore.getState().styles.find(s => s.id === id);
  if (!style) return undefined;

  // Hạng mục suy luận thông minh/mediaType（Người dùngChỉnh sửThiết bị hiện không có hai trường này）
  const effectivePrompt = style.prompt || '';
  const category = inferCategoryFromPrompt(effectivePrompt);
  const mediaType = inferMediaType(category);

  // Ưu tiên sử dụng styleTokens được trích xuất bằng AI（Hình ảnh thuần khiết Phong cách），Nếu không thì quay lại dấu nhắc ban đầu
  const prompt = style.styleTokens
    || effectivePrompt
    || `${style.name} style, professional quality`;

  return {
    id: style.id,
    name: style.name,
    category,
    mediaType,
    prompt,
    negativePrompt: style.negativePrompt || '',
    description: style.description || '',
    thumbnail: '',
  };
});
