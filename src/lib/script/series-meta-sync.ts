// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Series Meta Sync — Mô-đun công cụ siêu dữ liệu ở cấp độ kịch
 *
 * 1. populateSeriesMetaFromImport: đầu tiên NhậTừ kết quả phân tích + AI Ph khi pân tích build SeriesMeta
 * 2. buildSeriesContextSummary: Xây dựng bản tóm tắt ngữ cảnh nhỏ gọn được AI đưa vào từ SeriesMeta
 * 3. syncToSeriesMeta: Sau khi hiệu chỉnh xong, ghi dữ liệu phong phú trở lại SeriesMeta
 */

import type {
  SeriesMeta,
  ScriptCharacter,
  ScriptScene,
  ProjectBackground,
  ScriptData,
  NamedEntity,
  Faction,
  PromptLanguage,
} from '@/types/script';
import type { ScriptStructureAnalysis } from './script-normalizer';

// ==================== 1. Lần đầu Nhậđệm p ====================

/**
 * Từ Nhậxây dựng kết quả p SeriesMeta
 * Ưu tiên cho AI Ph.ân tích kết quả，Nếu không đủ, hãy hoàn thành từ nền + scriptData
 */
export function populateSeriesMetaFromImport(
  background: ProjectBackground,
  scriptData: ScriptData,
  aiAnalysis?: ScriptStructureAnalysis | null,
  importSettings?: { styleId?: string; promptLanguage?: PromptLanguage }
): SeriesMeta {
  // Xác minh tiêu đề không được đặt tiêu đề（Chẳng hạn như"Tập 1 Cuộc gặp gỡ đầu tiên"）
  const isEpTitle = (t: string) => /^Không.[Một, hai, ba, bốn, năm, sáu, bảy, tám, chín, một trăm nghìn\d]+bộ/.test(t);
  const rawTitle = background.title || scriptData.title || '';
  const safeTitle = (rawTitle && !isEpTitle(rawTitle)) ? rawTitle : 'Chưa đặt tên';

  const meta: SeriesMeta = {
    // Cốt lõi câu chuyện
    title: safeTitle,
    outline: background.outline || aiAnalysis?.generatedOutline || undefined,
    logline: aiAnalysis?.logline || undefined,
    centralConflict: aiAnalysis?.centralConflict || undefined,
    themes: aiAnalysis?.themes || background.themes || undefined,

    // thế giới quan
    era: background.era || aiAnalysis?.era || undefined,
    genre: background.genre || aiAnalysis?.genre || undefined,
    timelineSetting: background.timelineSetting || undefined,
    geography: aiAnalysis?.geography?.map(g => ({ name: g.name, desc: g.description })) || undefined,
    keyItems: aiAnalysis?.keyItems?.map(i => ({ name: i.name, desc: i.description })) || undefined,
    worldNotes: background.worldSetting || undefined,

    // Nhân vậhệ thống t — Thích sử dụng scriptData.characters（Đã vượt qua phân tích cú pháp + hiệu chuẩn thường xuyên），Nhân vật AI như một phần bổ sung
    characters: scriptData.characters || [],
    factions: aiAnalysis?.factions || undefined,

    // Tầm nhìnHệ thống — Sử dụng Ng trực tiếpười dùng ở NhậPhong c được chọn bởi p panelách
    styleId: importSettings?.styleId,
    recurringLocations: undefined,
    colorPalette: undefined,

    // Cài đặt sản xuất — nhắcNgôn ngữ từ Người dùng chọn ánh xạ trực tiếp
    language: scriptData.language || 'Tiếng Trung',
    promptLanguage: importSettings?.promptLanguage,
  };

  // Nếu AI Ph.ân tích chiết xuất Nhân vật nhưng scriptData thì không（Nhỏ gọnĐịnh dạng phân tíchThất bạtình huống của tôi），Sử dụng AI
  if (meta.characters.length === 0 && aiAnalysis?.characters?.length) {
    meta.characters = aiAnalysis.characters.map((c, i) => ({
      id: `char_${i + 1}`,
      name: c.name,
      age: c.age,
      role: c.identity,
      personality: c.personality,
      keyActions: c.keyActions,
      tags: c.faction ? [c.faction] : undefined,
    }));
    console.log(`[populateSeriesMeta] AI Nhân vật làm nguồn dữ liệu chính: ${meta.characters.length} một`);
  }

  // Nếu AI trích xuất thông tin trại nhưng Nhân vậkhông có thẻ phe phái，Phe bổ sung
  if (!meta.factions?.length && aiAnalysis?.characters?.length) {
    const factionMap = new Map<string, string[]>();
    for (const c of aiAnalysis.characters) {
      if (c.faction) {
        const members = factionMap.get(c.faction) || [];
        members.push(c.name);
        factionMap.set(c.faction, members);
      }
    }
    if (factionMap.size > 0) {
      meta.factions = Array.from(factionMap.entries()).map(([name, members]) => ({ name, members }));
    }
  }

  console.log('[populateSeriesMeta] Dữ liệu cấp độ kịch đã được xây dựng:', {
    title: meta.title,
    characters: meta.characters.length,
    factions: meta.factions?.length || 0,
    keyItems: meta.keyItems?.length || 0,
    geography: meta.geography?.length || 0,
    hasOutline: !!meta.outline,
    hasLogline: !!meta.logline,
  });

  return meta;
}

// ==================== 2. Tóm tắt nội dung AI ====================

/**
 * Xây dựng các bản tóm tắt được đưa vào ngữ cảnh AI nhỏ gọn từ SeriesMeta
 * để tiêm vào Tất cả Trong lời nhắc hệ thống được AI gọi
 */
export function buildSeriesContextSummary(meta: SeriesMeta | null): string {
  if (!meta) return '';

  const parts: string[] = [];

  // Dòng thông tin cơ bản
  const infoLine = [
    `hoạt động《${meta.title}》`,
    meta.era || '',
    meta.genre || '',
    meta.timelineSetting || '',
  ].filter(Boolean).join('，');
  parts.push(`[Kiến thức cấp độ kịch] ${infoLine}`);

  // xung đột cốt lõi
  if (meta.centralConflict) {
    parts.push(`xung đột cốt lõi：${meta.centralConflict}`);
  }

  // Nhân vậdanh sách t（Nhỏ gọnĐịnh dạng）
  if (meta.characters.length > 0) {
    const charSummary = meta.characters
      .slice(0, 15) // Tối đa 15 để tránh độ dài quá mức
      .map(c => {
        const info = [c.name];
        if (c.age) info.push(`${c.age}tuổi`);
        if (c.role) info.push(c.role.substring(0, 20));
        return info.join(',');
      })
      .join('; ');
    parts.push(`Nhân vật：${charSummary}`);
  }

  // trại
  if (meta.factions?.length) {
    const factionSummary = meta.factions
      .map(f => `${f.name}[${f.members.slice(0, 4).join(',')}]`)
      .join('; ');
    parts.push(`trại：${factionSummary}`);
  }

  // hệ thống điện
  if (meta.powerSystem) {
    parts.push(`hệ thống điện：${meta.powerSystem}`);
  }

  // mục chính
  if (meta.keyItems?.length) {
    const itemsSummary = meta.keyItems
      .slice(0, 5)
      .map(i => `${i.name}(${i.desc.substring(0, 15)})`)
      .join(', ');
    parts.push(`mục chính：${itemsSummary}`);
  }

  // Địa lý
  if (meta.geography?.length) {
    const geoSummary = meta.geography
      .slice(0, 5)
      .map(g => `${g.name}(${g.desc.substring(0, 15)})`)
      .join(', ');
    parts.push(`Địa lý：${geoSummary}`);
  }

  return parts.join('\n');
}

// ==================== 3. Viết lại hiệu chuẩn ====================

export type CalibrationSyncType = 'character' | 'scene' | 'shot';

/**
 * Sau khi hiệu chỉnh xong, ghi dữ liệu trở lại SeriesMeta
 *
 * @thông số meta hiện tại SeriesMeta
 * @param syncType hiệu chuẩnLoại
 * @dữ liệu kết quả hiệu chuẩn kết quả param
 * @returns Cập nhậmột phần SeriesMeta sau t（để cập nhậtSeriesMeta）
 */
export function syncToSeriesMeta(
  meta: SeriesMeta,
  syncType: CalibrationSyncType,
  results: {
    characters?: ScriptCharacter[];
    scenes?: ScriptScene[];
    keyItems?: NamedEntity[];
  }
): Partial<SeriesMeta> {
  const updates: Partial<SeriesMeta> = {};

  switch (syncType) {
    case 'character': {
      // Nhân vậtSau khi hiệu chuẩn：Viết lại danh tínhAnchors, visualPrompt, NegativePrompt, unityElements
      if (results.characters?.length) {
        const updatedChars = meta.characters.map(existing => {
          const calibrated = results.characters!.find(c =>
            c.id === existing.id || c.name === existing.name ||
            c.name.includes(existing.name) || existing.name.includes(c.name)
          );
          if (!calibrated) return existing;

          // Chỉ ghi lại đầu ra của trường bằng hiệu chỉnh AI，Không che Người dùngManualChỉnh sửcủa một
          return {
            ...existing,
            identityAnchors: calibrated.identityAnchors || existing.identityAnchors,
            visualPromptEn: calibrated.visualPromptEn || existing.visualPromptEn,
            visualPromptZh: calibrated.visualPromptZh || existing.visualPromptZh,
            negativePrompt: calibrated.negativePrompt || existing.negativePrompt,
            consistencyElements: calibrated.consistencyElements || existing.consistencyElements,
            // Bổ sung Cơ bảnfield（nếu trước đó nó trống rỗng）
            appearance: existing.appearance || calibrated.appearance,
            gender: existing.gender || calibrated.gender,
            age: existing.age || calibrated.age,
          };
        });
        updates.characters = updatedChars;
        console.log(`[syncToSeriesMeta:character] viết lại ${results.characters.length} Nhân vậtKết quả hiệu chuẩn`);
      }
      break;
    }

    case 'scene': {
      // CảSau khi hiệu chuẩn：Xác định cư dân Cảnh（≥Xuất hiện trong 2 tập），Cập nhậtĐịa lý
      if (results.scenes?.length) {
        // Cư dân Cảnh：episodeNumbers >= 2
        const recurring = results.scenes.filter(s =>
          s.episodeNumbers && s.episodeNumbers.length >= 2
        );
        if (recurring.length > 0) {
          const existingNames = new Set(
            (meta.recurringLocations || []).map(l => l.name || l.location)
          );
          const newRecurring = recurring.filter(s =>
            !existingNames.has(s.name || s.location)
          );
          if (newRecurring.length > 0) {
            updates.recurringLocations = [
              ...(meta.recurringLocations || []),
              ...newRecurring,
            ];
            console.log(`[syncToSeriesMeta:scene] Mới ${newRecurring.length} cư dân Cảnh`);
          }
        }

        // Cập nhậtCài đặt địa lý：Từ CảTrích xuất tên địa điểm mới từ thời đạiChi tiết của nh
        const existingGeoNames = new Set(
          (meta.geography || []).map(g => g.name)
        );
        const newGeo: NamedEntity[] = [];
        for (const scene of results.scenes) {
          const locationName = scene.name || scene.location;
          if (locationName && !existingGeoNames.has(locationName) && scene.eraDetails) {
            newGeo.push({ name: locationName, desc: scene.eraDetails.substring(0, 100) });
            existingGeoNames.add(locationName);
          }
        }
        if (newGeo.length > 0) {
          updates.geography = [...(meta.geography || []), ...newGeo];
          console.log(`[syncToSeriesMeta:scene] Mới ${newGeo.length} cài đặt địa lý`);
        }
      }
      break;
    }

    case 'shot': {
      // Phân cảSau khi hiệu chuẩn：Thêm các mục chính mới（Chỉ nối thêm, không ghi đè）
      if (results.keyItems?.length) {
        const existingItemNames = new Set(
          (meta.keyItems || []).map(i => i.name)
        );
        const newItems = results.keyItems.filter(i =>
          !existingItemNames.has(i.name)
        );
        if (newItems.length > 0) {
          updates.keyItems = [...(meta.keyItems || []), ...newItems];
          console.log(`[syncToSeriesMeta:shot] Mới ${newItems.length} mục chính`);
        }
      }
      break;
    }
  }

  return updates;
}
