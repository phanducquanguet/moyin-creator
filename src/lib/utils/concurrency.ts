// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Sự khởi đầu đáng kinh ngạc của những người thực thi kiểm soát đồng thời
 *
 * hành vi：
 * - Mỗi tác vụ mới phải đợi ít nhất một giây sau khi tác vụ trước đó bắt đầu trước khi bắt đầu
 * - Chạy tối đa các tác vụ maxConcurrent cùng lúc
 * - Khi số lượng tác vụ đang hoạt động đạt đến giới hạn trên，Đợi một nhiệm vụ hoàn thành trước khi bắt đầu nhiệm vụ tiếp theo（vẫn duy trì khoảng cách StaggerMs）
 *
 * Ví dụ: maxConcurrent=3, staggerMs=5000, mỗi nhiệm vụ mất 20 giây：
 *   t=0s: Bắt đầu nhiệm vụ 1
 *   t=5s: Bắt đầu nhiệm vụ 2
 *   t=10s: Bắt đầu nhiệm vụ 3（Đã đạt đến giới hạn đồng thời）
 *   t=15s: Stagger của nhiệm vụ 4 hết hạn，Nhưng đồng thời đã đầy，Xếp hàng chờ
 *   t=20s: Nhiệm vụ 1 đã hoàn thành → Nhiệm vụ 4 bắt đầu ngay lập tức
 *   t=25s: Nhiệm vụ 2 đã hoàn thành → Nhiệm vụ 5 bắt đầu ngay lập tức
 *
 * Ví dụ: maxConcurrent=1, staggerMs=5000, mỗi nhiệm vụ mất 2 giây：
 *   t=0s: Bắt đầu nhiệm vụ 1
 *   t=2s: Nhiệm vụ 1 đã hoàn thành
 *   t=5s: loạng choạng hết hạn → Bắt đầu nhiệm vụ 2（Duy trì nghiêm ngặt khoảng thời gian 5 giây）
 *   t=7s: Nhiệm vụ 2 đã hoàn thành
 *   t=10s: Bắt đầu nhiệm vụ 3
 */
export async function runStaggered<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number,
  staggerMs: number = 5000
): Promise<PromiseSettledResult<T>[]> {
  if (tasks.length === 0) return [];

  const results: PromiseSettledResult<T>[] = new Array(tasks.length);

  // ngữ nghĩa：Kiểm soát số lượng đồng thời tối đa
  let activeCount = 0;
  const waiters: (() => void)[] = [];

  const acquire = async (): Promise<void> => {
    if (activeCount < maxConcurrent) {
      activeCount++;
      return;
    }
    // Đồng thời đã đầy，Xếp hàng chờ
    await new Promise<void>((resolve) => waiters.push(resolve));
  };

  const release = (): void => {
    activeCount--;
    if (waiters.length > 0) {
      // Đánh thức người phục vụ tiếp theo trong hàng đợi
      activeCount++;
      const next = waiters.shift()!;
      next();
    }
  };

  // Bắt đầu từng nhiệm vụ một，loạng choạngM mỗi khoảng
  // Nhiệm vụ thứ N là tại N * StaggerMs được phép bắt đầu.（khoảng thời gian đảm bảo xen kẽ）
  // Cũng bị giới hạn bởi semaphore（Đảm bảo đồng thời）
  const taskPromises = tasks.map(async (task, idx) => {
    // khởi đầu loạng choạng：Nhiệm vụ thứ N ít nhất là N * Bắt đầu sau loạng choạngMs
    if (idx > 0) {
      await new Promise<void>((r) => setTimeout(r, idx * staggerMs));
    }

    // Nhận các vị trí đồng thời（Nếu nó đầy, hãy đợi nhiệm vụ được hoàn thành.）
    await acquire();

    try {
      const value = await task();
      results[idx] = { status: 'fulfilled', value };
    } catch (reason) {
      results[idx] = { status: 'rejected', reason: reason as any };
    } finally {
      release();
    }
  });

  await Promise.all(taskPromises);
  return results;
}
