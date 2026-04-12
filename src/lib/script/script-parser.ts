// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Script Parser Service
 * Uses AI chat APIs to parse screenplay text and extract structured data
 * Based on CineGen-AI geminiService.ts patterns
 */

import type { ScriptData, ScriptCharacter, ScriptScene, ScriptParagraph, Shot } from "@/types/script";
import { retryOperation } from "@/lib/utils/retry";
import { cleanJsonString, safeParseJson, normalizeIds } from "@/lib/utils/json-cleaner";
import { delay, RATE_LIMITS } from "@/lib/utils/rate-limiter";
import { ApiKeyManager } from "@/lib/api-key-manager";
import { getModelLimits, parseModelLimitsFromError, cacheDiscoveredLimits, estimateTokens } from "@/lib/ai/model-registry";
import { corsFetch } from "@/lib/cors-fetch";

/**
 * Normalize time value to match scene-store TIME_PRESETS
 * Maps Chinese time descriptions to standard time IDs
 */
function normalizeTimeValue(time: string | undefined): string {
  if (!time) return 'day';
  
  const timeMap: Record<string, string> = {
    // Chinese mappings
    'Ban ngày': 'day',
    'ban ngày': 'day',
    'buổi sáng': 'day',
    'buổi chiều': 'day',
    'Ban đêm': 'night',
    'đêm': 'night',
    'đêm khuya': 'midnight',
    'nửa đêm': 'midnight',
    'Hoàng hôn': 'dusk',
    'hoàng hôn': 'dusk',
    'muộn': 'dusk',
    'Bình minh': 'dawn',
    'sáng sớm': 'dawn',
    'mặt trời mọc': 'dawn',
    'buổi trưa': 'noon',
    // English mappings (pass through)
    'day': 'day',
    'night': 'night',
    'dawn': 'dawn',
    'dusk': 'dusk',
    'noon': 'noon',
    'midnight': 'midnight',
  };
  
  const normalized = time.toLowerCase().trim();
  return timeMap[normalized] || timeMap[time] || 'day';
}

const PARSE_SYSTEM_PROMPT = `Bạn là một chuyên gia phân tích kịch bản。Phân tíchNgười dùK được cung cấp bởi ngịch bản/văn bản câu chuyện，Trích xuất thông tin có cấu trúc。

Vui lòng tuân thủ nghiêm ngặt JSON sau đâyĐịnh dạngQuay lạkết quả của tôi（Không bao gồm bất kỳ văn bản nào khác）：
{
  "title": "tên truyện",
  "genre": "Loại（Chẳng hạn như：tình yêu、Hồi hộp、Hài kịch vv.）",
  "logline": "Tóm tắt một câu",
  "characters": [
    {
      "id": "char_1",
      "name": "Nhân vậtên t",
      "gender": "giới tính",
      "age": "tuổi tác",
      "role": "Danh tính chi tiết NềnMô tả，bao gồm nghề nghiệp、trạng thái、NềnCâu chuyện v.v.",
      "personality": "Đặc điểm tính cách chi tiết Mô tả，bao gồm cả cách làm việc、Giá trị, v.v.",
      "traits": "M chi tiết về đặc điểm cốt lõiô tả，trong đó có những khả năng vượt trội、Các tính năng, v.v.",
      "skills": "Kỹ năng/Khả năngMô tả（như những động tác võ thuật、ma thuật、Kỹ năng chuyên môn, v.v.）",
      "keyActions": "hành vi chính/hành độngMô tả，Quan trọng Lịch sửhành động",
      "appearance": "đặc điểm vật lý（Nếu có）",
      "relationships": "với Nh khácân vậmối quan hệ",
      "tags": ["Nhân vậthẻ t，Chẳng hạn như: võ công, Nam Vương, kiếm khách, phản diện, Nữchung"],
      "notes": "Nhân vậtNhận xét（Lô Giải thích，Chẳng hạn như: nhân vật chính của bộ phim này，Trong Màn III Kích hoạxung đột khốc liệt）"
    }
  ],
  "episodes": [
    {
      "id": "ep_1",
      "index": 1,
      "title": "Tiêu đề tập 1",
      "description": "Tóm tắt tập này",
      "sceneIds": ["scene_1", "scene_2"]
    }
  ],
  "scenes": [
    {
      "id": "scene_1",
      "episodeId": "ep_1",
      "name": "CảnhTên（Chẳng hạn như：Phố Diêm Thành、Đền hoang dã、sân cung điện）",
      "location": "Vị trí chi tiết Mô tả（bao gồm các đặc điểm kiến trúc、yếu tố môi trường、đặc điểm địa lý, v.v.）",
      "time": "Thờtôi cài đặt gian（day/night/dawn/dusk/noon/midnight）",
      "atmosphere": "Bầu không khí chi tiết Mô tả（Chẳng hạn như：Lo lắng và chán nản、Ấm áp và bình yên、Bí ẩn và ma quái、Vụ giết người bi thảm）",
      "visualPrompt": "CảHình ảnh chi tiết của nh Mô tả，cho TạoCảbản đồ khái niệm nh（bao gồm cả ánh sáng、thời tiết、Kiến trúcPhong cách、Các yếu tố đặc biệt, v.v.，bằng tiếng Anh）",
      "tags": ["Cảthẻ phần tử khóa nh，Chẳng hạn như: cột gỗ, mép cửa sổ, tòa nhà cổ, tàn tích, rừng sâu"],
      "notes": "Ghi chú vị trí（Lô Giải thích，Chẳng hạn như: cung điện cổ nơi diễn ra trận chiến quyết định）"
    }
  ],
  "storyParagraphs": [
    {
      "id": 1,
      "text": "Nội dung đoạn văn",
      "sceneRefId": "scene_1"
    }
  ]
}

Yêu cầu quan trọng：
1. 【Nhân vậThông tin phải chi tiết】：Đừng đơn giản hóa Nhân vậthông tin t！Giữ chữ T trong văn bản gốcất cảChi tiết：
   - vai trò: danh tính đầy đủ Nền（Chẳng hạn như"Người hào hiệp Bắc Tân Cương，Người giữ thanh kiếm Jinghong，Từng bảo vệ Diêm Thành..."）
   - Tính cách: Tính cách hoàn chỉnh Mô tả（Chẳng hạn như"Nhấn mạnh vào tinh thần hiệp sĩ、Bảo vệ người dân bình thường、Vị trí ánh sáng、nguyên tắc，Đừng bận tâm bảo vệ bản thân khi bị buộc tội..."）
   - Đặc điểm: đầy đủ các đặc điểm cốt lõi（Chẳng hạn như"Võ thuật xuất sắc，Chăm lo cho người dân bình thường，Thờ ơ với danh vọng và sự giàu có"）
   - kỹ năng: kỹ năng Mô tả（Chẳng hạn như"Giỏi kỹ thuật kiếm Jinghong、Phương Pháp Tâm Triều Dương，Sử dụng một thanh kiếm tuốt vỏ để đàn áp kẻ thù mạnh mẽ"）
   - keyActions: các thao tác chính（Chẳng hạn như"Bảo vệ Diêm Thành và giết chết mười ba bàn thờ chủ của Youmao Pavilion vào tháng 12..."）
   - tags: Nhân vậthẻ t，3-5，Mô tảNhân vậtLoạtôi và các tính năng（Như: võ công, Nam vương, kiếm khách, hộ vệ）
   - notes: Nhân vậtNhận xét，Giải thíchthisNhân vậVai trò của t trong cốt truyện（Chẳng hạn như: "nhân vật chính，Hành động 3Kích hoạxung đột"）
2. 【Cảnh thiết kế phải chi tiết】：Đừng đơn giản hóa Cảnh thông tin！Cảnh là visual Tạo'Cơ bản：
   - name: CảnhTên phải cụ thể và có thể nhận dạng được（Đừng chỉ viết"trong nhà""ngoài trời"）
   - vị trí: vị trí chi tiết Mô tả，bao gồm các đặc điểm kiến trúc、yếu tố môi trường
   - thời gian: sử dụng tiếng Anh Thờtôi nói dối（day/night/dawn/dusk/noon/midnight）
   - bầu không khí: bầu không khí chi tiết，Đừng chỉ viết một từ
   - visualPrompt: viết C bằng tiếng Anhảnh visual Mô tả（ánh sáng、thời tiết、Phong cách、đặc điểm kiến trúc vv.），Ví dụ：
     "Ancient Chinese city street at dawn, misty atmosphere, traditional wooden buildings with curved roofs, lanterns hanging, cobblestone path, golden morning light, dramatic clouds"
   - tags: Cảthẻ phần tử khóa nh，3-6 miếng，Mô tảđặc điểm môi trường（Chẳng hạn như: cột gỗ, mép cửa sổ, tòa nhà cổ, khói, tàn tích）
   - ghi chú: ghi chú vị trí，Giải thích cái này CảVai trò của nh trong cốt truyện（Chẳng hạn như: "Cung điện cổ nơi diễn ra trận chiến quyết định"）
3. Xác định cấu trúc nhiều tập hợp。Nếu Kịch bảbao gồm"Tập X"、"Episode X"、"Chương X"v.v. đánh dấu，Chia thành nhiều tập
4. Nếu không có thẻ đặt rõ ràng，TạoMột tập duy nhất chứa Tất cảCảnh
5. Nhân vậtID sử dụng char_1, char_2 Định dạng
6. CảnhID sử dụng cảnh_1, cảnh_2 Định dạng
7. Đặt ID sử dụng ep_1, ep_2 Định dạng`;

// Per-scene shot generation prompt (based on CineGen-AI)
const SHOT_GENERATION_SYSTEM_PROMPT = `Bạn có phải là tiến sĩ chuyên nghiệp không?ân cảnh chia/đạo diễn hình ảnh。cho một C duy nhấtảnhTạoChi tiết cấp độ phimCảnh quay danh sách（Camera Blocking）。

Vui lòng tuân thủ nghiêm ngặt mảng JSON sau đâyĐịnh dạngQuay lạkết quả của tôi（Không bao gồm bất kỳ văn bản nào khác）：
[
  {
    "sceneId": "scene_1",
    "shotSize": "Cỡ cảnh（WS/MS/CU/ECU）",
    "duration": 4.0,
    "visualDescription": "Màn hình Trung Quốc chi tiết Mô tả，Bao gồm Cảnh、ánh sáng、Nhân vậtHành động、Biểu cảtôi v.v.",
    "actionSummary": "H ngắnành động tổng quan",
    "cameraMovement": "Cảnh quay thể thao",
    "dialogue": "Nội dung đối thoại（Chứa loa và âm thanh）",
    "ambientSound": "Âm thanh xung quanh Mô tả",
    "soundEffect": "Hiệu ứng âm thanh Mô tả",
    "characters": ["Nhân vậtên t"],
    "keyframes": [
      {
        "id": "kf-1-start",
        "type": "start",
        "visualPrompt": "Tiếng Anh chi tiết Mô tả（cho Hình ảnhTạo）"
      }
    ]
  }
]

Phân cảnh nguyên tắc：
1. 【quan trọng】Mọi Cảnh lên tới 6-8 Cảnh quay，Tránh cắt bớt JSON
2. 【Cỡ cảnh viết tắt】WS=Toàn cảnh, MS=Trung cảnh, CU=Cận cảnh, ECU=Đặc tả, FS=Toàn cảnh
3. 【Cảnh quay thể thao】Sử dụng thuật ngữ kỹ thuật：
   - Tĩnh, Dolly In, Dolly Out, Pan Left/Phải(lắc), Nghiêng lên/xuống/uốn cong)
   - Theo dõi, Cần cẩu, Cầm tay, Zoom In/Ngoài (thu phóng)
4. 【Tầm nhìn Mô tả】visualDescription giống như viết văn văn phim Kịch bản，Chi tiếtMô tả：
   - CảnhÁnh sáng（Chẳng hạn như"Ánh sáng yếu ớt che đi bóng tối"）
   - Nhân vậtTrạng thái（Chẳng hạn như"Mặc bát quái màu vàng sáng，Tư thế mạnh mẽ"）
   - Tạo bầu không khí（Chẳng hạn như"Không khí đối đầu căng thẳng"）
   - Bê tông Hành động（Chẳng hạn như"Cảnh quay từ từ tiến tới"）
5. 【Âthiết kế m thanh】Mọi Cảnh quay nên cân nhắc：
   -ambientSound: âm thanh xung quanh（Âm thanh của gió、tiếng mưa、Một đám đông khổng lồ、Ngủ yên và chờ đợi）
   - soundEffect: hiệu ứng âm thanh（bước chân、tiếng kêu của thanh kiếm、gõ cửa、Vụ nổ vv.）
   - hội thoại: hội thoại nên bao gồm người nói và giọng điệu（Chẳng hạn như"Thiên chủ（Địch Thần Triệu Lệ）：Thế giới là vô biên..."）
6. 【Thời lượng】ước tính thời lượng mỗi Cảnh quay giây（2-8 giây，Theo độ phức tạp của nội dung）
7. 【visualPrompt】Tiếng Anh Mô tả，Trong vòng 40 từ，cho Hình ảnhTạo，Định dạng：
   "[Scene setting], [lighting], [character appearance and action], [mood], [camera angle], [style keywords]"
   Ví dụ："Ancient altar in darkness, dim candlelight, Taoist priest in yellow robe standing solemnly, mysterious atmosphere, wide shot, cinematic, dramatic lighting"`;

interface ParseOptions {
  apiKey: string; // Supports comma-separated multiple keys
  provider: string;
  baseUrl: string;
  model: string;
  language?: string;
  sceneCount?: number; // Giới hạn Cảnh số lượng（Được sử dụng cho xe kéo, vv）
  shotCount?: number; // mỗi CảnhPhân cảnh số Gợi ý（Đã chuyển sang thế hệ bắn tiếp theo）
  keyManager?: ApiKeyManager; // Optional: use existing key manager for rotation
  temperature?: number; // Tuỳ chỉnhiệt độ，Mặc định 0.7
  maxTokens?: number; // Tuỳ chỉnhmaxĐầbạn ra số token，Mặc định 4096
  /** ĐóngreasoningMô hình suy nghĩ sâu sắc（GLM-4.7/4.5 v.v.），Tránh cạn kiệt mã thông báo lý luận */
  disableThinking?: boolean;
}

interface ShotGenerationOptions extends ParseOptions {
  targetDuration: string;
  styleId: string;
  characterDescriptions?: Record<string, string>;
  shotCount?: number; // Giới hạn tổng Phân cảnh số lượng（Được sử dụng cho xe kéo, vv）
  concurrency?: number; // Xử lý song song Cảsố thứ（Mặc định1，Có thể sử dụng với nhiều phímài đặt cao hơn）
}

// Use imported cleanJsonString from json-cleaner.ts

/**
 * Call chat API (Zhipu or OpenAI compatible) with multi-key rotation support
 */
export async function callChatAPI(
  systemPrompt: string,
  userPrompt: string,
  options: ParseOptions
): Promise<string> {
  const { apiKey, provider, baseUrl, model } = options;
  
  console.log('\n[callChatAPI] ==================== Lệnh gọi API Bắt đầu ====================');
  console.log('[callChatAPI] provider:', provider);
  console.log('[callChatAPI] chiều dài apiKey:', apiKey?.length || 0);
  console.log('[callChatAPI] Liệu apiKey có trống không:', !apiKey);
  console.log('[callChatAPI] baseUrl:', baseUrl);
  console.log('[callChatAPI] Độ dài dấu nhắc của hệ thống:', systemPrompt.length);
  console.log('[callChatAPI] độ dài userPrompt:', userPrompt.length);
  
  if (!apiKey) {
    console.error('[callChatAPI] ❌ Khóa API trống！');
    throw new Error('Khóa API chưa được định cấu hình');
  }
  
  // Create or use existing key manager for rotation
  const keyManager = options.keyManager || new ApiKeyManager(apiKey);
  
  const totalKeys = keyManager.getTotalKeyCount();
  console.log(`[callChatAPI] sử dụng ${provider}，tổng cộng ${totalKeys} Khóa API`);

  if (!baseUrl) {
    throw new Error('URL cơ sở chưa được định cấu hình');
  }
  if (!model) {
    throw new Error('Mô hình chưa được cấu hình');
  }
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const url = /\/v\d+$/.test(normalizedBaseUrl)
    ? `${normalizedBaseUrl}/chat/completions`
    : `${normalizedBaseUrl}/v1/chat/completions`;
  
  // Truy vấn M từ Sổ đăng ký mẫuô hình hạn chế（Tìm kiếm ba cấp độ：bộ nhớ đệm→tĩnh→default）
  const modelLimits = getModelLimits(model);
  const requestedMaxTokens = options.maxTokens ?? 4096;
  const effectiveMaxTokens = Math.min(requestedMaxTokens, modelLimits.maxOutput);
  if (effectiveMaxTokens < requestedMaxTokens) {
    console.log(`[callChatAPI] kẹp tự động max_tokens: ${requestedMaxTokens} -> ${effectiveMaxTokens} (${model} maxOutput=${modelLimits.maxOutput})`);
  }
  
  // === Token Budget Calculator ===
  const inputTokens = estimateTokens(systemPrompt + userPrompt);
  const safetyMargin = Math.ceil(modelLimits.contextWindow * 0.1);
  const availableForOutput = modelLimits.contextWindow - inputTokens - safetyMargin;
  const utilization = Math.round((inputTokens / modelLimits.contextWindow) * 100);
  
  console.log(
    `[Dispatch] ${model}: input≈${inputTokens} / ctx=${modelLimits.contextWindow}, ` +
    `output=${effectiveMaxTokens} (lề${100 - utilization}%)`
  );
  
  // Đầu vào Đã vượt quá cửa sổ ngữ cảnh 90% → Ném Lỗi（Không có yêu cầu，tiết kiệm tiền）
  if (inputTokens > modelLimits.contextWindow * 0.9) {
    const err = new Error(
      `[TokenBudget] Đầu vào token (≈${inputTokens}) vượt quá ${model} cửa sổ ngữ cảnh ` +
      `(${modelLimits.contextWindow}) của 90%，Hãy giảm bớtĐầu vào hoặc sử dụng M với ngữ cảnh lớn hơnô hình`
    );
    (err as any).code = 'TOKEN_BUDGET_EXCEEDED';
    (err as any).inputTokens = inputTokens;
    (err as any).contextWindow = modelLimits.contextWindow;
    throw err;
  }
  
  // Đầdung lượng của bạn nhỏ hơn yêu cầu 50% → in cảnh báo
  if (availableForOutput < requestedMaxTokens * 0.5) {
    console.warn(
      `[Dispatch] ⚠️ ${model}: Đầbạn ra không gian chật hẹp！Có sẵn≈${availableForOutput} tokens，` +
      `Yêu cầu=${requestedMaxTokens}，có thể gây raĐầbạn ra bị cắt ngắn`
    );
  }
  
  console.log('[callChatAPI] URL yêu cầu:', url);

  // Use retryOperation with key rotation on rate limit
  return await retryOperation(async () => {
    // Get current key from rotation
    const currentKey = keyManager.getCurrentKey();
    if (!currentKey) {
      throw new Error('No API keys available');
    }
    
    console.log(`[callChatAPI] Using key index, available: ${keyManager.getAvailableKeyCount()}/${totalKeys}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentKey}`,
    };
    
    // Mô hìlogic lựa chọn nh：Phải sử dụng mô hình cấu hình
    const modelName = model;
    console.log('[callChatAPI] sử dụng Mô hình:', modelName);
    
    const body: Record<string, any> = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: effectiveMaxTokens,
    };

    // Lý luận phổ trí tuệ Mô hình (GLM-4.7/4.5 v.v.) Hỗ trợChấp nhận thinking.type Đóngdeep suy nghĩ
    if (options.disableThinking) {
      body.thinking = { type: 'disabled' };
      console.log('[callChatAPI] Đã rồiĐósuy nghĩ ngdeep (suy nghĩ: bị vô hiệu hóa)');
    }

    const response = await corsFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle rate limit or auth error with key rotation
      if (keyManager.handleError(response.status, errorText)) {
        console.log(`[callChatAPI] Rotated to next API key due to error ${response.status}, available: ${keyManager.getAvailableKeyCount()}/${totalKeys}`);
      }
      
      // === Error-driven Discovery: 400 Lỗtôi tự động phát hiện ra Mô hình giới hạn và Thử lại ===
      if (response.status === 400) {
        const discovered = parseModelLimitsFromError(errorText);
        if (discovered) {
          cacheDiscoveredLimits(model, discovered);
          
          // Nếu tìm thấy giới hạn maxOutput và yêu cầu hiện tại vượt quá，Sử dụng ngay giá trị đúng Thử lại
          if (discovered.maxOutput && effectiveMaxTokens > discovered.maxOutput) {
            const correctedMaxTokens = Math.min(requestedMaxTokens, discovered.maxOutput);
            console.warn(
              `[callChatAPI] 🧠 khám phá ${model} maxOutput=${discovered.maxOutput}，` +
              `Lấy max_token=${correctedMaxTokens} tự độngThử lại...`
            );
            const retryBody = { ...body, max_tokens: correctedMaxTokens };
            const retryResp = await corsFetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(retryBody),
            });
            if (retryResp.ok) {
              const retryData = await retryResp.json();
              const retryContent = retryData.choices?.[0]?.message?.content;
              if (retryContent) {
                if (totalKeys > 1) keyManager.rotateKey();
                return retryContent;
              }
            } else {
              console.warn('[callChatAPI] khám phá thử lạtôi vẫn Thất bại:', retryResp.status);
            }
          }
        }
      }
      
      const error = new Error(`API request failed: ${response.status} - ${errorText}`);
      (error as any).status = response.status;
      throw error;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      // Chẩn đoán Nhật ký：Bản ghi API thực tế Quay lạcấu trúc của tôi
      const finishReason = data.choices?.[0]?.finish_reason;
      const usage = data.usage;
      const reasoningContent = data.choices?.[0]?.message?.reasoning_content;
      console.error('[callChatAPI] ⚠️ API Quay lạtôi làm trống nội dung！Thông tin chẩn đoán:');
      console.error('[callChatAPI]   finish_reason:', finishReason);
      console.error('[callChatAPI]   usage:', JSON.stringify(usage));
      console.error('[callChatAPI]   choices length:', data.choices?.length);
      console.error('[callChatAPI]   message keys:', data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : 'N/A');
      console.error('[callChatAPI]   độ dài lý luận_content:', reasoningContent?.length || 0);
      console.error('[callChatAPI]   phản hồi thô (500 từ đầu tiên):', JSON.stringify(data).slice(0, 500));
      
      // L nhạy cảm của API Zhipuọc：Hãy thử xoay phím Thử lại
      if (finishReason === 'sensitive' || finishReason === 'content_filter') {
        if (keyManager.handleError(403)) {
          console.warn(`[callChatAPI] Nội dung được bảo mậtọc(${finishReason})，Xoay phím Thử lại`);
        }
        throw new Error(`Nội dung được bảo mậtọc(finish_reason: ${finishReason})`);
      }
      
      // Lý luậnMô hình dự phòng：Nếu có Reason_content nhưng nội dung trống，Giải thíchMô hình đang suy nghĩ hết token
      if (finishReason === 'length' && reasoningContent) {
        // Trước tiên hãy thử trích xuất JSON từ Reason_content（Trong một số trường hợp, kết quả được đưa vào phản ánh）
        const jsonMatch = reasoningContent.match(/```json\s*([\s\S]*?)```/) ||
                          reasoningContent.match(/(\{[\s\S]*"characters"[\s\S]*\})/);
        if (jsonMatch) {
          console.log('[callChatAPI] ✅ Trích xuất Reason_content sang JSON');
          return jsonMatch[1] || jsonMatch[0];
        }
        
        // Phát hiện tỷ lệ mã thông báo suy luận — Nếu lý luận chiếm >80% mã thông báo hoàn thành，
        // Giải thíchMô hình ở trong「nghĩ」đã chi quá nhiều ngân sách cho，Tự động Th với max_tokens gấp đôiử lạtôi một lần
        const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens || 0;
        const completionTokens = usage?.completion_tokens || 0;
        const currentMaxTokens = body.max_tokens;
        const newMaxTokens = Math.min(currentMaxTokens * 2, modelLimits.maxOutput);
        
        if (reasoningTokens > 0 && completionTokens > 0 &&
            reasoningTokens / completionTokens > 0.8 &&
            newMaxTokens > currentMaxTokens) {
          console.warn(
            `[callChatAPI] Lý luậnMô hình token đã cạn kiệt (lý do: ${reasoningTokens}/${completionTokens})，` +
            `Lấy max_token=${newMaxTokens} tự độngThử lại...`
          );
          
          const retryBody = { ...body, max_tokens: newMaxTokens };
          const retryResp = await corsFetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(retryBody),
          });
          
          if (retryResp.ok) {
            const retryData = await retryResp.json();
            const retryContent = retryData.choices?.[0]?.message?.content;
            const retryUsage = retryData.usage;
            console.log(
              `[callChatAPI] Thử lạkết quả: nội dung=${retryContent?.length || 0}từ, ` +
              `reasoning=${retryUsage?.completion_tokens_details?.reasoning_tokens || '?'}, ` +
              `completion=${retryUsage?.completion_tokens || '?'}`
            );
            if (retryContent) {
              if (totalKeys > 1) keyManager.rotateKey();
              return retryContent;
            }
          } else {
            console.warn('[callChatAPI] Thử lạtôi yêu cầu Thất bại:', retryResp.status);
          }
        } else {
          console.warn(
            `[callChatAPI] Lý luậnMô hình token đã hết：reasoning ${reasoningContent.length} từ，nội dung trống。` +
            `(reasoning_tokens=${reasoningTokens}, completion_tokens=${completionTokens}, max_tokens=${currentMaxTokens})`
          );
        }
      }
      
      throw new Error(`Empty response from API (finish_reason: ${finishReason || 'unknown'})`);
    }

    // Rotate key after successful request to distribute load
    if (totalKeys > 1) {
      keyManager.rotateKey();
    }

    return content;
  }, { maxRetries: 3, baseDelay: 2000 });
}

/**
 * Parse screenplay text into structured data
 */
export async function parseScript(
  rawScript: string,
  options: ParseOptions
): Promise<ScriptData> {
  // \u6784\u5efaCảnhGiới hạn số lượngGợi ý
  const sceneCountHint = options.sceneCount 
    ? `\n\n【quan trọng】Vui lòng chỉ trích xuất những gì quan trọng nhất ${options.sceneCount} Cảnh，Chọn chữ C tiêu biểu và có tác động trực quan nhất trong cốt truyệnảnh。`
    : '';

  const userPrompt = `Xin vui lòng Phân tích dưới Kịch bản/Nội dung truyện：

${rawScript}

ngôn ngữ：${options.language || 'Tiếng Trung'}${sceneCountHint}`;

  const response = await callChatAPI(PARSE_SYSTEM_PROMPT, userPrompt, options);
  const cleaned = cleanJsonString(response);

  try {
    const parsed = JSON.parse(cleaned);

    // Validate and transform scenes with detailed visual design
    const scenes = (parsed.scenes || []).map((s: any, i: number) => ({
      id: s.id || `scene_${i + 1}`,
      name: s.name || s.location || `Cảnh${i + 1}`,
      location: s.location || 'Không rõvị trí',
      time: normalizeTimeValue(s.time),
      atmosphere: s.atmosphere || '',
      visualPrompt: s.visualPrompt || '', // cho Cảnh bản đồ khái niệm Tạo
      tags: s.tags || [],        // Cảthẻ nh
      notes: s.notes || '',      // CảnhNhận xét
      episodeId: s.episodeId,
    }));

    // Validate and transform characters with ALL extended fields
    const characters = (parsed.characters || []).map((c: any, i: number) => ({
      id: c.id || `char_${i + 1}`,
      name: c.name || `Nhân vật${i + 1}`,
      gender: c.gender,
      age: c.age,
      personality: c.personality,
      role: c.role,
      traits: c.traits,
      skills: c.skills,           // Giữ các trường kỹ năng
      keyActions: c.keyActions,   // Giữ những câu chuyện quan trọng
      appearance: c.appearance,   // Giữ ngoại hình Mô tả
      relationships: c.relationships, // Giữ gìn mối quan hệ nhân vật
      tags: c.tags || [],         // Nhân vậthẻ t
      notes: c.notes || '',       // Nhân vậtNhận xét
    }));

    // Parse episodes - use AI-generated if available, otherwise create default
    let episodes = (parsed.episodes || []).map((e: any, i: number) => ({
      id: e.id || `ep_${i + 1}`,
      index: e.index || i + 1,
      title: e.title || `Không.${i + 1}đặt`,
      description: e.description,
      sceneIds: e.sceneIds || [],
    }));

    // If no episodes from AI, create default episode with all scenes
    if (episodes.length === 0) {
      episodes = [{
        id: 'ep_1',
        index: 1,
        title: parsed.title || 'Tập 1',
        description: parsed.logline,
        sceneIds: scenes.map((s: any) => s.id),
      }];
    } else {
      // Ensure all scenes are assigned to an episode
      const assignedSceneIds = new Set(episodes.flatMap((e: any) => e.sceneIds));
      const unassignedScenes = scenes.filter((s: any) => !assignedSceneIds.has(s.id));
      if (unassignedScenes.length > 0 && episodes.length > 0) {
        // Add unassigned scenes to the last episode
        episodes[episodes.length - 1].sceneIds.push(...unassignedScenes.map((s: any) => s.id));
      }
    }

    const scriptData: ScriptData = {
      title: parsed.title || 'Không tênKịch bản',
      genre: parsed.genre,
      logline: parsed.logline,
      language: options.language || 'Tiếng Trung',
      characters,
      scenes,
      episodes,
      storyParagraphs: (parsed.storyParagraphs || []).map((p: any, i: number) => ({
        id: p.id || i + 1,
        text: p.text || '',
        sceneRefId: p.sceneRefId || 'scene_1',
      })),
    };

    return scriptData;
  } catch (e) {
    console.error('[parseScript] Failed to parse JSON:', cleaned);
    throw new Error('Không thể phân tích AIQuay lạtôi Kịch bảdữ liệu');
  }
}

/**
 * Generate shot list from parsed script data
 * Uses per-scene generation with parallel processing support for multi-key
 */
export async function generateShotList(
  scriptData: ScriptData,
  options: ShotGenerationOptions,
  onSceneProgress?: (sceneIndex: number, total: number) => void,
  onShotsGenerated?: (newShots: Shot[], sceneIndex: number) => void // Truyền trực tuyến cuộc gọi lại，Mọi CảNgay sau khi nh hoàn thành Thông báo
): Promise<Shot[]> {
  if (!scriptData.scenes || scriptData.scenes.length === 0) {
    return [];
  }

  const lang = options.language || scriptData.language || 'Tiếng Trung';
  const allShots: Shot[] = [];
  
  // Tính mỗi Cảnh ShouldTạPh của oân cảsố thứ
  const totalScenes = scriptData.scenes.length;
  const targetShotCount = options.shotCount;
  const durationSec = options.targetDuration && options.targetDuration !== 'auto'
    ? (parseInt(options.targetDuration) || 0)
    : 0;

  // Xác định mỗi CảPh của nhân cảsố thứ
  let shotsPerScene: number | undefined;
  let shotsPerSceneHint = '6-8 miếng';
  if (targetShotCount) {
    // Người dùng chỉ định rõ ràng tổng Phân cảsố thứ
    shotsPerScene = Math.max(1, Math.ceil(targetShotCount / totalScenes));
  } else if (durationSec > 0) {
    // Theo Th.ời lượng tính toán hợp lý theo CảnhPhân cảsố thứ（Tài liệu tham khảo：mỗi Cảnh quay khoảng 2-5 giây）
    const totalBudget = Math.max(2, Math.ceil(durationSec / 3));
    shotsPerScene = Math.max(1, Math.ceil(totalBudget / totalScenes));
    shotsPerSceneHint = `${shotsPerScene}một（ĐíchThời lượng ${durationSec}giây，Tổng cộng khoảng. ${totalBudget} Phân cảnh）`;
  }

  if (targetShotCount) {
    console.log(`[generateShotList] Target: ${targetShotCount} shots total, ${shotsPerScene} per scene (${totalScenes} scenes)`);
  } else if (durationSec > 0) {
    console.log(`[generateShotList] Duration-based: ~${shotsPerScene} shots/scene for ${durationSec}s (${totalScenes} scenes)`);
  }

  // Determine concurrency based on available keys
  const keyManager = new ApiKeyManager(options.apiKey);
  const keyCount = keyManager.getTotalKeyCount();
  const concurrency = options.concurrency || Math.min(keyCount, 4); // Max 4 parallel
  
  console.log(`[generateShotList] Processing ${totalScenes} scenes with concurrency ${concurrency} (${keyCount} keys)`);

  // Helper function to process a single scene
  const processScene = async (sceneIndex: number): Promise<Shot[]> => {
    const scene = scriptData.scenes[sceneIndex];
    const sceneShots: Shot[] = [];
    
    // Get paragraphs for this scene
    const paragraphs = scriptData.storyParagraphs
      .filter(p => String(p.sceneRefId) === String(scene.id))
      .map(p => p.text)
      .join('\n');

    const sceneContent = paragraphs.trim() 
      ? paragraphs 
      : `Cảnh${sceneIndex + 1}: ${scene.name || scene.location}，${scene.atmosphere || ''}môi trường`;

    const userPrompt = `cho Cảnh ${sceneIndex + 1} TạoTiền chi tiết cấp độ phimân cảnh。
Đầngôn ngữ của bạn: ${lang}

=== Cảnh thông tin ===
Cảtên nh: ${scene.name || scene.location}
Vị trí: ${scene.location}
Thời gian: ${scene.time}
Bầu không khí: ${scene.atmosphere}
${(scene as any).visualPrompt ? `Cảnh tài liệu tham khảo trực quan: ${(scene as any).visualPrompt}` : ''}

=== Cảnh nội dung ===
"${sceneContent.slice(0, 5000)}"

=== Dự áthông tin ===
Loại: ${scriptData.genre || 'phổ quát'}
ĐíchThời lượng: ${options.targetDuration}
Tầm nhìn Phong cách: ${options.styleId}

=== Nhân vậthông tin t ===
${scriptData.characters.map(c => `- ${c.name}: ${c.personality || ''} ${c.appearance || ''}`).join('\n')}

=== Phân cảyêu cầu nh ===
1. Đối với C nàyảnhTạo${shotsPerScene ? `Vừa phải ${shotsPerScene} một` : shotsPerSceneHint}Cảnh quay，Chọn hình ảnh có tác động trực quan nhất
2. Mỗi Cảnh quay phải chứa：
   - shotSize: Cỡ cảnh（WS/MS/CU/ECU）
   - duration: Thời lượng（giây）
   - VisualDescription: Màn hình Trung Quốc chi tiết Mô tả（Giống như viết một bộ phim Kịch bản rất chi tiết）
   - hành độngTóm tắt: H ngắnành động tổng quan
   - cameraMovement: Cảnh quay thể thao
   -ambientSound: âm thanh xung quanh
   - soundEffect: hiệu ứng âm thanh
   - đối thoại: đối thoại（Bao gồm loa và âm thanh）
   - ký tự: Ngoại hìnhNhân vậdanh sách tên t
   - khung hình chính: visualPrompt chứa khung hình chính bắt đầu（Tiếng Anh，Trong vòng 40 từ）
3. Mô tả trực quan phải chi tiết，bao gồmÁnh sáng、Nhân vậtTrạng thái、bầu không khí、Cảnh quay thể thao
4. Âthiết kế m thanh cần cụ thể，Có thể tái tạo Cảbầu không khí nh`;

    try {
      const response = await callChatAPI(SHOT_GENERATION_SYSTEM_PROMPT, userPrompt, options);
      const cleaned = cleanJsonString(response);
      const shots = safeParseJson<any[]>(cleaned, []);

      // Validate and transform shots - FORCE TRUNCATE to shotsPerScene
      let validShots = Array.isArray(shots) ? shots : [];
      
      // Buộc đánh chặn tới mọi Cảnh giới hạn số lượng（AI may Quay lạiThêm）
      if (shotsPerScene && validShots.length > shotsPerScene) {
        console.log(`[generateShotList] Scene ${sceneIndex + 1}: truncating ${validShots.length} shots to ${shotsPerScene}`);
        validShots = validShots.slice(0, shotsPerScene);
      }
      
      for (const s of validShots) {
        const characterIds = (s.characters || s.characterNames || [])
          .map((nameOrId: string) => {
            const char = scriptData.characters.find(
              c => c.name === nameOrId || c.id === nameOrId
            );
            return char?.id;
          })
          .filter(Boolean) as string[];

        const keyframes: NonNullable<Shot['keyframes']> = [];
        if (s.keyframes && Array.isArray(s.keyframes)) {
          keyframes.push(...s.keyframes.map((k: any) => ({
            ...k,
            status: 'pending' as const,
          })));
        } else if (s.visualPrompt) {
          keyframes.push({
            id: `kf-${sceneIndex}-${sceneShots.length}-start`,
            type: 'start' as const,
            visualPrompt: s.visualPrompt,
            status: 'pending' as const,
          });
        }

        sceneShots.push({
          id: `shot_${sceneIndex}_${sceneShots.length}`,
          index: sceneShots.length + 1,
          sceneRefId: String(scene.id),
          actionSummary: s.actionSummary || '',
          visualDescription: s.visualDescription || '',
          cameraMovement: s.cameraMovement,
          shotSize: s.shotSize,
          duration: s.duration || 4,
          visualPrompt: s.visualPrompt || keyframes[0]?.visualPrompt || '',
          videoPrompt: s.videoPrompt || '',
          dialogue: s.dialogue,
          ambientSound: s.ambientSound || '',
          soundEffect: s.soundEffect || '',
          characterNames: s.characters || s.characterNames || [],
          characterIds,
          characterVariations: {},
          keyframes,
          imageStatus: 'idle' as const,
          imageProgress: 0,
          videoStatus: 'idle' as const,
          videoProgress: 0,
        });
      }
      
      console.log(`[generateShotList] Scene ${sceneIndex + 1} generated ${sceneShots.length} shots`);
      
      // Truyền trực tuyến cuộc gọi lại：Th ngay lập tứcông báoT mớiạPh của oân cảnh
      if (onShotsGenerated && sceneShots.length > 0) {
        onShotsGenerated(sceneShots, sceneIndex);
      }
    } catch (e) {
      console.error(`[generateShotList] Failed for scene ${sceneIndex + 1}:`, e);
    }
    
    return sceneShots;
  };

  // Process scenes in parallel batches
  let completedCount = 0;
  for (let i = 0; i < scriptData.scenes.length; i += concurrency) {
    const batch = scriptData.scenes.slice(i, i + concurrency);
    const batchIndices = batch.map((_, idx) => i + idx);
    
    console.log(`[generateShotList] Processing batch ${Math.floor(i / concurrency) + 1}: scenes ${batchIndices.map(x => x + 1).join(', ')}`);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batchIndices.map(idx => processScene(idx))
    );
    
    // Collect results
    batchResults.forEach(shots => allShots.push(...shots));
    
    // Update progress
    completedCount += batch.length;
    if (onSceneProgress) {
      onSceneProgress(completedCount, scriptData.scenes.length);
    }
    
    // Small delay between batches to avoid overwhelming the API
    if (i + concurrency < scriptData.scenes.length) {
      await delay(500);
    }
  }

  // Re-index shots to be sequential
  let finalShots = allShots.map((s, idx) => ({
    ...s,
    id: `shot-${idx + 1}`,
    index: idx + 1,
  }));

  // Nếu Cài đặPhân cảnh số lượng giới hạn，Cắt theo số lượng quy định
  if (targetShotCount && finalShots.length > targetShotCount) {
    // từ mỗi Cảlựa chọn đồng phục nh，Thay vì chỉ chặn chữ N đầu tiên
    const sceneShotMap = new Map<string, Shot[]>();
    for (const shot of finalShots) {
      const sceneId = shot.sceneRefId;
      if (!sceneShotMap.has(sceneId)) {
        sceneShotMap.set(sceneId, []);
      }
      sceneShotMap.get(sceneId)!.push(shot);
    }

    // từ mỗi CảnhNhấn Tỷ lệchọn
    const selectedShots: Shot[] = [];
    const sceneIds = Array.from(sceneShotMap.keys());
    const shotsNeededPerScene = Math.ceil(targetShotCount / sceneIds.length);
    
    for (const sceneId of sceneIds) {
      const sceneShots = sceneShotMap.get(sceneId)!;
      // Lấy chữ N đầu tiên（quan trọng nhất）
      selectedShots.push(...sceneShots.slice(0, shotsNeededPerScene));
    }

    // Bị chặn tớiĐích số lượng và đánh số lại
    finalShots = selectedShots.slice(0, targetShotCount).map((s, idx) => ({
      ...s,
      id: `shot-${idx + 1}`,
      index: idx + 1,
    }));
  }

  return finalShots;
}

/**
 * Generate a screenplay from creative input (idea, MV concept, ad brief, or storyboard script)
 * Output format is compatible with importFullScript() for seamless integration
 * 
 * Supports:
 * - One-liner ideas: "A love story in a coffee shop"
 * - MV concepts: "A music video about summer youth"
 * - Ad briefs: "30-second energy drink commercial"
 * - Detailed storyboard scripts: Scripts with shot descriptions
 */
// Cơ bản prompt（Để sử dụng mà không cần Phân cảnh cấu trúc sáng tạoĐầu vào：MV、quảng cáo、Một câu sáng tạo, v.v.）
const CREATIVE_SCRIPT_BASE_PROMPT = `Bạn là nhà biên kịch phim truyền hình chuyên nghiệp và có bằng tiến sĩ.ân cảnh chia。Theo Người dùsự sáng tạo của ngĐầu vào，TạoĐầy đủ Kịch bản。

Người dùcó thểĐầu vào：
- Một câu ý tưởng sáng tạo："chuyện tình quán cà phê"
- Ý tưởng MV："Video Ca Nhạc Tuổi Trẻ Mùa Hè"
- Thông tin quảng cáo："Quảng cáo đồ uống thể thao 30 giây"

Đầu raĐịnh dạng phải được tuân thủ nghiêm ngặt（Đây là NhậpHệ thốtiêu chuẩnĐịnh dạng）：

---
《Kịch bảnTiêu đề》

**phác thảo：**
[ngắnMô tảcâu chuyện tổng thể/chủ đề/khái niệm]

**Tiểu sử：**
Nhân vậtA：[XX tuổi]，[danh tính/Sự nghiệp]，[Đặc điểm tính cách]，[đặc điểm vật lý]
Nhân vậtB：[XX tuổi]，[danh tính/Sự nghiệp]，[Đặc điểm tính cách]，[đặc điểm vật lý]

**Tập 1**

**Trong vòng 1-1 ngày Địa điểm Tên**
nhân vật：Nhân vậtA、Nhân vậtB

△[Cảnh mô tả，bao gồm cả môi trường、ánh sáng、bầu không khí]

Nhân vậtA：（Hành động/Biểu cảm）Nội dung dòng

Nhân vậtB：（Hành động/Biểu cảm）Nội dung dòng

**1-2 đêm đi đến địa điểm khác**
...
---

Yêu cầu quan trọng：
1. Phải chứa《Tiêu đề》、**phác thảo：**、**Tiểu sử：**、**Tập X**
2. Cảnh đầuĐịnh dạng：**số Ngày/đêm/địa điểm nước ngoài**
3. Mỗi Cảnh phải có"nhân vật："được rồi
4. Hành động được sử dụng để mô tả △ Bắt đầu
5. Đối thoạiĐịnh dạng：Nhân vậtên t：（Hành động）dòng
6. MV/Quảng cáo cũng nên chia thành Cảnh và phân cảnh，Chỉ là nội dung tập trung vào hình ảnh và hiệu ứng âm thanh thôi
7. Ngôn ngữ và Người dùngĐầu vào Nhất quán（Tiếng TrungĐầu vàoSử dụng tiếng TrungĐầu ra）
8. **tính nhất quán thời đại**：Đề cương phải ghi rõ thời đại Nền；Trang phục trong tiểu sử nhân vật、kiểu tóc、Đạo cụ phải phù hợp với thời đại（Ví dụ, trang phục hiện đại không được phép trong phim cổ trang/sản phẩm điện tử；Trang phục cổ xưa không được phép trong phim truyền hình hiện đại）
9. **tính nhất quán của thế giới quan**：Cảvị trí nh、Kiến trúcPhong cách、Quy tắc xã hội phải tuân theo Kịch bảnBộ thế giới quan，Không được phép có yếu tố mâu thuẫn`;

// Đối với Ph hiện tạiân cảcấu trúc nhĐầu vào Hướng dẫn bổ sung（Chẳng hạn như【Cảnh quay1】Đến【Gương Yi 12】）
const STORYBOARD_STRUCTURE_PROMPT = `

**★★★ Đã phát hiện Phân cảcấu trúc nh，Phải tuân theo các quy tắc sau ★★★**

1. Giữ nguyên bản Cảnh quay/Cảnh，Không ai có thể thiếu
2. Người dùngĐầu vào Có 12 chữ Cảnh quay，Đầbạn ra phải có 12 Cảnh
3. Mỗi bản gốc Cảnh quay chuyển thành a **ngày X-X/đêm/địa điểm nước ngoài** Định dạng's Cảnh
4. Tuyệt đối cấm sáp nhập、Bỏ qua、nén Cảnh quay số lượng

**★★★ Cảnh nội dungĐịnh dạng（cực kỳ quan trọng）★★★**

Mọi CảChỉ có thể tìm thấy ở nh：
1. Hàng ký tự：nhân vật：Nhân vậtA、Nhân vậtB
2. một Hành độdòng ng：△[Đặt chữ Cảnh quayTất cảbức tranh、Hành động、đối thoại、Hiệu ứng âm thanh, v.v. được nén thành một câu M trực quan hoàn chỉnhô tả]

bị cấm ở CảViết nhiều dòng trong nh！Liệt kê đối thoại riêng biệt bị cấm、Hiệu ứng âm thanh！Tất cảNội dung phải được nén thành một △ Đang di chuyển。

Ví dụ：
Người dùngĐầu vào【Cảnh quay1】Chứa màn hình Mô tả+đối thoại+hiệu ứng âm thanh，của bạnĐầlẽ ra bạn nên thế：
**Trong vòng 1-1 ngày Sân bóng rổ**
nhân vật：Mã Nhất Hoa、Thẩm Tinh Thanh
△bảng điểmĐặc tảĐang hiển thị 68:70，Ma Yihua rê bóng và bị Bi đôiểu cảtôi lo lắng，Khán giả nín thở，Nhịp tim dần vang lên

thay vì：
**Trong vòng 1-1 ngày Sân bóng rổ**
nhân vật：Mã Nhất Hoa、Thẩm Tinh Thanh
△bảng điểmĐặc tả
Mã Nhất Hoa：（bồn chồn）...
【Hiệu ứng âm thanh】nhịp tim

Cái sau là Lỗtôi là！sẽ dẫn đến TạoNhiều Phân cảnh！`;

export interface ScriptGenerationOptions {
  apiKey: string;
  provider: string;
  baseUrl: string;
  model: string;
  language?: string;
  targetDuration?: string;
  sceneCount?: number;
  shotCount?: number;
  styleId?: string;
}

/**
 * Generate screenplay from creative input
 * Returns script text in import-compatible format
 */
export async function generateScriptFromIdea(
  idea: string,
  options: ScriptGenerationOptions
): Promise<string> {
  const { language = 'Tiếng Trung', targetDuration = '60s', sceneCount, shotCount, styleId } = options;
  
  // Theo Th.ời lượngTạoPhạm vi tham chiếu（Không phải là giới hạn cứng，Nó là tài liệu tham khảo cho AI）
  const durationSeconds = targetDuration === 'auto' ? 0 : (parseInt(targetDuration) || 60);
  let durationGuidance = '';
  if (durationSeconds > 0 && !sceneCount && !shotCount) {
    // Tài liệu tham khảo：Mọi Cảnh quay khoảng 2-5 giây
    const minShots = Math.max(2, Math.ceil(durationSeconds / 5));
    const maxShots = Math.max(3, Math.ceil(durationSeconds / 2));
    durationGuidance = `\n- Thời lượng tham khảo：${durationSeconds}Video thứ hai thường chứa ${minShots}-${maxShots} Phân cảnh，Hãy tăng tốc độ theo nhu cầu của nội dung`;
  }

  // Phát hiệnĐầu vàoLoại
  const inputType = detectInputType(idea);
  
  // Thống kênguyên bảnĐầu vàC trong oảnh quay/Cảnh số lượng
  // Hỗ trợkhác nhauĐịnh dạng：【Cảnh quay1】、**【Cảnh quay1：...】**、Cảnh quay1、Cảnh1 v.v.
  const shotMatches = idea.match(/\*?\*?[\[\u3010]\s*Cảnh quay\s*\d+/g) || [];
  const sceneMatches = idea.match(/Cảnh\s*\d+/g) || [];
  const originalShotCount = Math.max(shotMatches.length, sceneMatches.length);
  
  console.log('[generateScriptFromIdea] Cảnh quay trận đấu:', shotMatches);
  console.log('[generateScriptFromIdea] Cảnh trận đấu:', sceneMatches);
  
  // Nếu Ph được phát hiệnân cảcấu trúc nh，Nhấn mạnh vào việc đặt chỗ
  const preserveStructureNote = originalShotCount > 0 
    ? `\n\n**★★★ L đặc biệtưu ý ★★★**
Người dùngĐầu vàchứa ${originalShotCount} Cảnh quay/Cảnh，của bạnĐầbạn ra phải có một cái tương ứng ${originalShotCount} Cảnh（**1-1** Đến **1-${originalShotCount}**）。

quan trọng：Mọi CảChỉ có thể có một ở nh △ Hành độdòng ng！Đặt chữ CảT of nh quayất cảbức tranh、đối thoại、Hiệu ứng âm thanh nén thành một câu。
Không liệt kê riêng nhiều câu thoại hoặc hiệu ứng âm thanh，Nếu không thì sẽ là TạoNhiều Phân cảnh！`
    : '';
  
  const userPrompt = `Hãy sử dụng những ý tưởng sauĐầu vàoTạoHoàn thành Kịch bản：

[Đầu vàoLoại] ${inputType}

[\u521b\u610fbên trong\u5bb9]
${idea}

[yêu cầu]
- ngôn ngữ：${language}
- ĐíchThời lượng：${targetDuration === 'auto' ? 'Đưa ra quyết định của riêng bạn dựa trên nội dung' : `khoảng ${targetDuration}`}${durationGuidance}
${originalShotCount > 0 ? `- Cảnh số lượng：Phải có ${originalShotCount} một（với bản gốc Cảnh quay thư từ một-một）` : sceneCount ? `- Cảnh số lượng：khoảng ${sceneCount} một` : '- Cảnh số lượng：Theo nội dung và Th.ời lượng theo quyết định riêng của mình'}
${originalShotCount > 0 ? '' : shotCount ? `- Phân cảnh số lượng：khoảng ${shotCount} một` : '- Phân cảnh số lượng：Theo nội dung và Th.ời lượng theo quyết định riêng của mình'}
${styleId ? `-Visual Phong cách：${styleId}` : ''}

Xin vui lòng Tạo Phù hợp với tiêu chuẩnĐịnh dạng đã hoàn thành Kịch bản，chứa：
1. Kịch bảnTiêu đề
2. Đề cương（Mô tả ngắn gọn chủ đề/câu chuyện）
3. Tiểu sử các nhân vật（Mỗi Nhân vậThông tin cơ bản về t）
4. Điền Cảnh và đối thoại${preserveStructureNote}`;

  console.log('[generateScriptFromIdea] Đầu vàoLoại:', inputType);
  console.log('[generateScriptFromIdea] Nội dung sáng tạo:', idea.substring(0, 100));
  console.log('[generateScriptFromIdea] Đã phát hiện C thôảnh quay số:', originalShotCount);
  
  // Tùy thuộc vào việc có Ph hay khôngân cảcấu trúc nh chọn các lời nhắc hệ thống khác nhau
  // - Có Phân cảcấu trúc nh：Sử dụng Cơ bản + Phân cảcấu trúc nh hướng dẫn đặc biệt（Mọi Cảnh chỉ có thể có một Hành độdòng ng）
  // - Không có Phân cảcấu trúc nh：Sử dụng Cơ bản prompt（Cho phép M bình thườngở rộng bội Hành động/đối thoại）
  const systemPrompt = originalShotCount > 0
    ? CREATIVE_SCRIPT_BASE_PROMPT + STORYBOARD_STRUCTURE_PROMPT
    : CREATIVE_SCRIPT_BASE_PROMPT;
  
  console.log('[generateScriptFromIdea] Sử dụng dấu nhắc Loại:', originalShotCount > 0 ? 'Phân cảmẫu cấu trúc nh' : 'Chế độ sáng tạo thông thường');
  
  // Để biết chi tiết Ph.ân cảkịch bản，Yêu cầu max_tokens cao hơn
  const extendedOptions = {
    ...options,
    maxTokens: originalShotCount > 5 ? 8192 : 4096, // Nhiều CảTăng khi nh quayĐầchiều dài của bạn
  };
  
  const response = await callChatAPI(systemPrompt, userPrompt, extendedOptions);
  
  console.log('[generateScriptFromIdea] TạoKịch bảchiều dài n:', response.length);
  
  return response;
}

/**
 * Detect the type of creative input
 */
function detectInputType(input: string): string {
  const trimmed = input.trim();
  const lineCount = trimmed.split('\n').filter(l => l.trim()).length;
  
  // Đã kiểm tra Phân cảcấu trúc nh：【Cảnh quayX】hoặc **【Cảnh quayX】**
  if (/[【\[]\s*Cảnh quay\s*\d+/i.test(trimmed) || /\*\*.*Cảnh quay.*\*\*/i.test(trimmed)) {
    return 'Ph chi tiếtân cảkịch bản';
  }
  
  // Phát hiện khái niệm MV
  if (/MV|[âm nhạc][nghe nhìn][video]|music\s*video/i.test(trimmed)) {
    return 'khái niệm MV';
  }
  
  // Phát hiện tóm tắt quảng cáo
  if (/quảng cáo|công khai[PhimVideo]|commercial|ad\s*brief|Thương hiệu/i.test(trimmed)) {
    return 'Tóm tắt quảng cáo';
  }
  
  // Phát hiện trailer
  if (/Xem trước[PhimVideo]|trailer|Video quảng cáo/i.test(trimmed)) {
    return 'kịch bản giới thiệu';
  }
  
  // Phát hiện video ngắn
  if (/Video ngắn|tẩy xóa|tiktok|Kuaishou|reels/i.test(trimmed)) {
    return 'Sáng tạo video ngắn';
  }
  
  // Đánh giá dựa trên chiều dài
  if (lineCount <= 3 && trimmed.length < 100) {
    return 'một câu sáng tạo';
  } else if (lineCount <= 10) {
    return 'Tóm tắt';
  } else {
    return 'Câu chuyện chi tiết Mô tả';
  }
}

export type { ParseOptions, ShotGenerationOptions };
