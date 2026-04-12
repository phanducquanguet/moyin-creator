// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * CORS-safe fetch wrapper
 *
 * \u81ea\u52a8Phát hiện\u8fd0được rồimôi trường：
 * - Electron \u684c\u9762chế độ → Sử dụng trực tiếp\u539f\u751f fetch()（không có CORS \u9650\u5236）
 * - \u6d4f\u89c8\u5668\u5f00\u53d1chế độ   → Chấp nhận Vite \u5f00\u53d1\u670d\u52a1\u5668 /__api_proxy?url=... \u4ee3\u7406\u8f6c\u53d1
 * - \u6d4f\u89c8\u5668\u751f\u4ea7chế độ   → \u76f4\u63a5 fetch()（\u9700\u540e\u7aef/Nginx \u63d0\u4f9b\u53cd\u5411\u4ee3\u7406）
 */

/** Phát hiện\u662f\u5426\u5728 Electron môi trườngtrong\u8fd0được rồi */
function isElectron(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    (window as any).electron
  );
}

/** Phát hiện\u662f\u5426\u5728 Vite \u5f00\u53d1\u670d\u52a1\u5668trong\u8fd0được rồi */
function isViteDev(): boolean {
  return import.meta.env?.DEV === true;
}

/**
 * CORS \u5b89\u5168của fetch \u5c01\u88c5
 *
 * \u5728\u6d4f\u89c8\u5668\u5f00\u53d1chế độ\u4e0b，\u81ea\u52a8\u5c06Yêu cầu\u4ee3\u7406Đến Vite \u5f00\u53d1\u670d\u52a1\u5668của
 * `/__api_proxy` trong\u95f4\u4ef6，\u7531Máy chủ chuyển tiếp yêu cầu\u4ee5Bỏ qua các hạn chế CORS。
 *
 * @param url    Đích URL（với\u539f\u751f fetch Tham số\u76f8\u540c）
 * @param init   Yêu cầu\u9009\u9879（với\u539f\u751f fetch Tham số\u76f8\u540c）
 * @returns      Response（với\u539f\u751f fetch Quay lại\u503c\u76f8\u540c）
 */
export async function corsFetch(
  url: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const targetUrl = url.toString();

  // Electron hoặc\u975e\u5f00\u53d1môi trường：\u76f4\u8fde
  if (isElectron() || !isViteDev()) {
    return fetch(targetUrl, init);
  }

  // \u6d4f\u89c8\u5668\u5f00\u53d1chế độ：đi Vite \u4ee3\u7406
  const proxyUrl = `/__api_proxy?url=${encodeURIComponent(targetUrl)}`;

  // \u5c06nguyên bản headers \u5e8fCột\u5316Đến x-proxy-headers \u5934trong
  // \u8fd9\u6837\u4ee3\u7406trong\u95f4\u4ef6\u53ef\u4ee5\u628a\u5b83\u4eec\u8f6c\u53d1\u7ed9Đích\u670d\u52a1\u5668
  const proxyHeaders = new Headers(init?.headers);

  // \u628anguyên bản headers \u6253\u5305\u8fdbmộtmột\u7279\u6b8a\u5934，\u4ee3\u7406\u7aef\u8d1f\u8d23\u89e3\u5305
  const originalHeaders: Record<string, string> = {};
  proxyHeaders.forEach((value, key) => {
    originalHeaders[key] = value;
  });

  const proxyInit: RequestInit = {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-proxy-headers': JSON.stringify(originalHeaders),
    },
  };

  return fetch(proxyUrl, proxyInit);
}
