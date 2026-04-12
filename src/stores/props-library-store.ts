// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.

/**
 * PropsLibraryStore - Thư viện đạo cụTrạng thátôi quản lý
 * Hỗ trợTuỳ chỉnhThư mụphân loại c，Kiên trì với localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// vật phẩm chống đỡ
export interface PropItem {
  id: string;
  name: string;           // Dự luật Tên（Cán Chỉnh sửa）
  imageUrl: string;       // local-image://props/... hoặc URL từ xa
  prompt: string;         // TạNhắc tại o（để tham khảo）
  folderId: string | null; // Thuộc về Th.ư mục，null = gốc thư mục
  createdAt: number;
}

// Tuỳ chỉnhThư mục
export interface PropFolder {
  id: string;
  name: string;           // Thư mụcTên
  parentId: string | null; // Đã đặt trước phần mở rộng lồng nhau（Giao diện người dùng hiện tại chỉ sử dụng một cấp độ）
  createdAt: number;
}

interface PropsLibraryState {
  items: PropItem[];
  folders: PropFolder[];
  // Hiện đang được chọnư mục（null = Tất cả）
  selectedFolderId: string | null | 'all';
}

interface PropsLibraryActions {
  // Đạo cụ Thảo tác
  addProp: (prop: Omit<PropItem, 'id' | 'createdAt'>) => PropItem;
  renameProp: (id: string, name: string) => void;
  deleteProp: (id: string) => void;
  moveProp: (propId: string, folderId: string | null) => void;

  // Thư mụcThao tác
  addFolder: (name: string, parentId?: string | null) => PropFolder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void; // XoáThời gian đạo cụ phụ được chuyển đến thư mục gốc Thư mục

  // UI Trạng thái
  setSelectedFolderId: (folderId: string | null | 'all') => void;

  // Truy vấn
  getPropsByFolder: (folderId: string | null | 'all') => PropItem[];
  getPropById: (id: string) => PropItem | undefined;
}

type PropsLibraryStore = PropsLibraryState & PropsLibraryActions;

export const usePropsLibraryStore = create<PropsLibraryStore>()(
  persist(
    (set, get) => ({
      items: [],
      folders: [],
      selectedFolderId: 'all',

      // ── Đạo cụ Thảo tác ──────────────────────────────────────────────────────────

      addProp: (prop) => {
        const newProp: PropItem = {
          ...prop,
          id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(),
        };
        set((s) => ({ items: [newProp, ...s.items] }));
        return newProp;
      },

      renameProp: (id, name) => {
        set((s) => ({
          items: s.items.map((item) =>
            item.id === id ? { ...item, name } : item
          ),
        }));
      },

      deleteProp: (id) => {
        set((s) => ({ items: s.items.filter((item) => item.id !== id) }));
      },

      moveProp: (propId, folderId) => {
        set((s) => ({
          items: s.items.map((item) =>
            item.id === propId ? { ...item, folderId } : item
          ),
        }));
      },

      // ── Thư mụcThao tác ──────────────────────────────────────────────────────────

      addFolder: (name, parentId = null) => {
        const newFolder: PropFolder = {
          id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name,
          parentId,
          createdAt: Date.now(),
        };
        set((s) => ({ folders: [...s.folders, newFolder] }));
        return newFolder;
      },

      renameFolder: (id, name) => {
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id === id ? { ...f, name } : f
          ),
        }));
      },

      deleteFolder: (id) => {
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          // Thếư mụĐạo cụ dưới c được chuyển đến thư mục gốc Thư mục
          items: s.items.map((item) =>
            item.folderId === id ? { ...item, folderId: null } : item
          ),
          // Nếu Th hiện đang được chọnư mục，chuyển trở lại"Tất cả"
          selectedFolderId:
            s.selectedFolderId === id ? 'all' : s.selectedFolderId,
        }));
      },

      // ── UI Trạng thái ───────────────────────────────────────────────────────────

      setSelectedFolderId: (folderId) => {
        set({ selectedFolderId: folderId });
      },

      // ── Truy vấn ─────────────────────────────────────────────────────────────

      getPropsByFolder: (folderId) => {
        const { items } = get();
        if (folderId === 'all') return items;
        return items.filter((item) => item.folderId === folderId);
      },

      getPropById: (id) => {
        return get().items.find((item) => item.id === id);
      },
    }),
    {
      name: 'moyin-props-library',
      partialize: (state) => ({
        items: state.items,
        folders: state.folders,
      }),
    }
  )
);
