// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Tiện ích bắn - Chức năng công cụ được chia sẻ
 * Mã trùng lặp được trích xuất từ file-tree.tsx, property-panel.tsx, context-panel.tsx
 */

import type { CompletionStatus, Shot } from "@/types/script";
import type { ShotSizeType } from "@/stores/director-store";

/**
 * Theo imageStatus của Shot/videoTính toán trạng thái đã hoàn thànhTrạng thái
 */
export function getShotCompletionStatus(shot: Shot): CompletionStatus {
  if (shot.imageStatus === "completed" && shot.videoStatus === "completed") {
    return "completed";
  }
  if (shot.imageStatus === "completed" || shot.videoStatus === "completed") {
    return "in_progress";
  }
  return "pending";
}

/**
 * Tính Ti cho tập các mục có trường trạng tháiến độchuỗi
 */
export function calculateProgress(items: { status?: CompletionStatus }[]): string {
  const completed = items.filter((i) => i.status === "completed").length;
  return `${completed}/${items.length}`;
}

/**
 * Cỡ cảnhTên → Bảng ánh xạ ShotSizeType
 * được sử dụng để chuyển đổi Kịch bảC trong nỡ cảnhMô tảChuyển đổi sang ID tiêu chuẩn
 */
export const SHOT_SIZE_MAP: Record<string, ShotSizeType> = {
  'ECU': 'ecu', 'Extreme Close-Up': 'ecu', 'Đặc tả': 'ecu',
  'CU': 'cu', 'Close-Up': 'cu', 'Cận cảnh': 'cu',
  'MCU': 'mcu', 'Medium Close-Up': 'mcu', 'Trung bình Cận cảnh': 'mcu',
  'MS': 'ms', 'Medium Shot': 'ms', 'Trung cảnh': 'ms',
  'MLS': 'mls', 'Medium Long Shot': 'mls', 'giữaTớiàn cảnh': 'mls',
  'LS': 'ls', 'Long Shot': 'ls', 'Toàn cảnh': 'ls',
  'WS': 'ws', 'Wide Shot': 'ws', 'Cảnh rộng': 'ws','POV': 'pov', 'POV Shot': 'pov', 'chủ quan Cảnh quay': 'pov',
};

/**
 * Sẽ Cỡ cảChuyển chuỗi nh thành ShotSizeType chuẩn hóa
 */
export function normalizeShotSize(shotSize: string | undefined | null): ShotSizeType | null {
  if (!shotSize) return null;
  return (SHOT_SIZE_MAP[shotSize] || null) as ShotSizeType | null;
}
