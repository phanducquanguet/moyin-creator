// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Director Store
 * Manages AI screenplay generation and scene execution state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createProjectScopedStorage } from '@/lib/project-storage';
import { DEFAULT_CINEMATOGRAPHY_PROFILE_ID } from '@/lib/constants/cinematography-profiles';
import type { 
  AIScreenplay, 
  AIScene, 
  SceneProgress, 
  GenerationConfig 
} from '@opencut/ai-core';
import type {
  LightingStyle,
  LightingDirection,
  ColorTemperature,
  DepthOfField,
  FocusTransition,
  CameraRig,
  MovementSpeed,
  AtmosphericEffect,
  EffectIntensity,
  PlaybackSpeed,
  ContinuityRef,
  CameraAngle,
  FocalLength,
  PhotographyTechnique,
} from '@/types/script';

// ==================== Types ====================

export type ScreenplayStatus = 'idle' | 'generating' | 'ready' | 'generating_images' | 'images_ready' | 'generating_videos' | 'completed' | 'error';

// Storyboard-specific status
export type StoryboardStatus = 'idle' | 'generating' | 'preview' | 'splitting' | 'editing' | 'error';

// Generation status for each scene (used for both image and video)
export type GenerationStatus = 'idle' | 'uploading' | 'generating' | 'completed' | 'failed';
// Alias for backward compatibility
export type VideoStatus = GenerationStatus;

// ==================== \u68f0\u52eeGiám đốc-presets.ts Giám đốc-presets.tscấp độ khỉ ====================
// chuỗi\u6e74\u7035\u73c6\u53c6\u66f0\u6c31\u6924\u6d5c\u5ea2\u6e70\u93c2\u56e6Huan\u934d\u546f\u5b91\u7aeb\u6bf2kiêu ngạotiếng Làokuang\u6924\u96dc\u5aebplitScene \u7edb\u590b\u5e34\u9359ｅMức độ của
import type {
  ShotSizeType,
  DurationType,
  SoundEffectTag,
  EmotionTag,
} from './director-presets';
// Nhập khẩu { SHOT_SIZE_PRESETS } from '@/stores/director-store' \u7f01хTranh vẽ\u6924
export {
  SHOT_SIZE_PRESETS,
  type ShotSizeType,
  DURATION_PRESETS,
  type DurationType,
  SOUND_EFFECT_PRESETS,
  type SoundEffectTag,
  LIGHTING_STYLE_PRESETS,
  LIGHTING_DIRECTION_PRESETS,
  COLOR_TEMPERATURE_PRESETS,
  DEPTH_OF_FIELD_PRESETS,
  FOCUS_TRANSITION_PRESETS,
  CAMERA_RIG_PRESETS,
  MOVEMENT_SPEED_PRESETS,
  ATMOSPHERIC_EFFECT_PRESETS,
  EFFECT_INTENSITY_PRESETS,
  PLAYBACK_SPEED_PRESETS,
  EMOTION_PRESETS,
  type EmotionTag,
  CAMERA_ANGLE_PRESETS,
  type CameraAngleType,
  FOCAL_LENGTH_PRESETS,
  type FocalLengthType,
  PHOTOGRAPHY_TECHNIQUE_PRESETS,
  type PhotographyTechniqueType,
  CAMERA_MOVEMENT_PRESETS,
  type CameraMovementType,
  SPECIAL_TECHNIQUE_PRESETS,
  type SpecialTechniqueType,
} from './director-presets';

// Chia cảnh?
// nhỏ giọt\u590a\u7730\u9efb\u612eずhuyền cơRực rỡ★ổn
// 1. \u68e3\u6827\u65fb\u612eずXuân?(imagePrompt) - Wei Hui€Quan Yunwei㈡\u5f3f\u6769 giúp đỡㄤ\u7c2c\u9422\u71b8\u5923\u68e3\u6827\u65e9\u65a4\u62f7
// 2. Sợ hãi và sợ hãiずXuân?(endFramePrompt) - Wei Hui€Quan Yunwei㈡\u5f3f\u6769 giúp đỡㄤ\u7c2c\u9422\u71b8\u579a\u768f\u954f\u951b\u951f\u65a4\u62f7Mức độ của
// 3. Naupa\u9efb\u612eずXuân?(videoPrompt) - \u9537ㄦ€\u4f78\u5a69Huancang\u5f3f\u6769\u67b4\u7d34\u98a2ㄤ\u7c2c\u9422\u7db8\u579a\u8bfa\u55d7
export interface SplitScene {
  id: number;
  // Rất tuyệtОnồi adze\u951b\u6a69\u5317\u9249\u621d\u9559★cấp độ
  sceneName: string;
  // \u9366\u70ed\u6aeb\u9366\u82e3\u52db\u57da\u951b\u6c2d\u6680\u7039ゅNgụy Đàcấp độ
  sceneLocation: string;
  
  // ========== Khung hình đầu tiên / Start State) ==========
  // \u68e3\u69e7\u69d3\u951f\u65a4\u62f7 \u951b\u951b\u581c\u7ca0\u9352bốn\u9685\u9505\u951b sợ hãi \u944fberiinsert \u7f2e\u9352help\u7eb4\u93b4?AI \u9422\u7db8\u579aQuảng cáo?
  imageDataUrl: string;
  // \u68e3\u69e7\u6c94\u9532\u5267\u5896\u9504?HTTP URL\u951b\u52e2\u6924\u6d5c\u5ea4\u68f0\u6220\u64d3\u93b4?API?
  imageHttpUrl: string | null;
  width: number;
  height: number;
  // Địch Lệ, vuốt ve, sợ hãi, sợ hãi mà sợ hãi.ずXuân\u7d8fpaper\u947b\u7efc\u5408răng nanh\u651b\u5980\u6924\u6d5c\u5ea1\u6d75\u9555gallium\u93b4?APIQuảng cáo?
  // Đọc câu chuyện€\u4e38\u539c\u8930\u4e8b€làn đường\u6c49\u9417╁Ô Não€Người vợ lẽЭgiấy tờ€cấp độ băng đảng \u5f79\u5fe9\u6769
  imagePrompt: string;
  // Địch Lệ, vuốt ve, sợ hãi, sợ hãi mà sợ hãi.ずHuyền Cơ Chi Quyênrăng nanh\u651b\u5300\u6924\u6d5c\u5ea3\u6924\u6d34\u6d34\u6d34\u6d34\u6a09\u7240?
  imagePromptZh: string;
  // Di Li Fu Yi Ji Yao Zhong Duo€?
  imageStatus: GenerationStatus;
  imageProgress: number; // 0-100
  imageError: string | null;
  
  // ========== Hao Fear vuốt ve (Khung cuối / End State) ==========
  // \u9104tối€Hạ Nghị Ngạo NinhэNhíp giấy AI\u5a69\u9352ゆ\u67c7\u6d34\u682b\u6924\u6d34FengchuiㄨTươngcấp độ
  // tối€Hạ Nghị Ngạo Ninhх\u6b91\u9366\u70ed\u6ad9\u6d1b ArぇQian Nao Quai Fu Hui€\u4f78\u5f49\u97ec€\u4f80\u6145\u6fb6\u6751ぇBộ sưu tập bánh crepe của Qian Yajiang€\u4f7d\u5366\u9366\u7ea2\u6685\u6fb6Quen€\u4f80Hannao Po xào
  // nhỏ giọt\u5d89\u4e36\u4e36\u4e36\u4e36\u5b89\u5b81х\u6b91\u9366\u70ed\u6ad9\u6d1b\u6c31mu\u9357\u679eHuyền Nghị€Jijing'eㄤ\u7514\u9286\u4e38\u7451\u93c0\u9000\u7026\u7026\u99a6\u7ad9
  needsEndFrame: boolean;
  // \u73b4\u6828\u6e70\u9366\u9366\u5fb6\u5fb0?
  endFrameImageUrl: string | null;
  // Làm cách nào để sử dụng URL HTTP?APINao Cheng \u7f1b\u7f01€эcấp độ
  endFrameHttpUrl: string | null;
  // Hảo sợ Fuminユ\u7c2e\u951b\u6b6full=Mũi tên?| upload=\u9422ㄦ\u57dbnhỏ giọt\u5a04\u7db6 | ai-generated=AI \u9422\u7e38\u579a | next-scene=nhỏ giọt\u5b29\u7af4\u9352\u55db\u6685\u68e3\u6827\u6827 Fu | video-extracted=Tích Ngọc\u68f0\u621e\u5f41\u9359?| prev-scene-cascade=nhỏ giọt\u5a04\u5af4\u5352bốn\u6685\u63b4Phúc Vạnц\u4ec8
  endFrameSource: 'upload' | 'ai-generated' | 'next-scene' | 'video-extracted' | 'prev-scene-cascade' | null;
  // Hảo sợ hãi, vuốt ve, sợ hãi, sợ hãi, sợ hãiずXuân\u7d8fpaper\u947b\u7efc\u5408răng nanh\u651b\u5980\u6924\u6d5c\u5ea1\u6d75\u9555gallium\u93b4?APIQuảng cáo?
  // Đọc câu chuyệnЭQuần chữ E€䷷\u7d85\u70c5giấy tờ€cấp độ băng đảng \u5f79\u5fe9\u6769
  endFramePrompt: string;
  // Hảo sợ hãi, vuốt ve, sợ hãi, sợ hãi, sợ hãiずHuyền Cơ Chi Quyênrăng nanh\u651b\u5300\u6924\u6d5c\u5ea3\u6924\u6d34\u6d34\u6d34\u6d34\u6a09\u7240?
  endFramePromptZh: string;
  // Hạo Sợ, Phù Dao, Chung Đóa€?
  endFrameStatus: GenerationStatus;
  endFrameProgress: number; // 0-100
  endFrameError: string | null;
  
  // ========== Naobueㄤ\u7514 (Video hành động / Movement) ==========
  // Naobueㄤ\u7514\u9efb\u612eずXuân\u7d8fpaper\u947bBanrăng nanh\u651b\u5980\u6924\u6d5c\u5ea4\u68f0\u6220\u64d3\u93b4?API?
  // Đọc thêm€\u4f80\u6145\u6fb6\u620d\u9537ㄣ€giấy tờㄦ€cấp độ băng đảng \u5f79\u5fe9\u6769
  // PingㄦHYDRO€sai sótnhà Hán╁Nao Sui Zhou Zheng Ai tiêu cực Chen Cha Mei Di Li Fu Zhen phim truyền hình
  videoPrompt: string;
  // Naobueㄤ\u7514\u9efb\u612eずHuyền Cơ Chi Quyênrăng nanh\u651b\u5300\u6924\u6d5c\u5ea3\u6924\u6d34\u6d34\u6d34\u6d34\u6a09\u7240?
  videoPromptZh: string;
  // NaobuYixiyao Zhongduo€?
  videoStatus: GenerationStatus;
  videoProgress: number; // 0-100
  videoUrl: string | null;
  videoError: string | null;
  // \u6bef\u638d\u7d8b\u6d34\u63ff\u7a69\u9422giấyㄤ\u7c2c\u93b7\u6828\u5a73\u9352\u7248 \u6902\u9082inch hú?
  videoMediaId: string | null;
  
  // ========== Vấn đề là gì?==========
  // Nao \u6555\u58ca\u6d34\u67b4€\u52cb\u5a28\u951b\u5822\u6924\u6d5c\u5ea4\u68f0\u6220\u6553\u6d34\u612d\u6902\u6544\u52ee\u9539\u9534\u9534\u9534\u65a4\u62f7€эcấp độ
  characterIds: string[];
  // Nao Jie Lei Chenｆ┍\u9359cây\u7d8b\u9104\u72b2\u76a0\u951b\u5048harId \u922b?variationId\u921b\u5000ji\u9410\u4f7a\u6924\u9369\u7ea2\u7039 argonkhó chịuэcấp độ
  characterVariationMap?: Record<string, string>;
  // \u93af\u5bef\u534e\u5559\u56e9\u951b\u5f9f\u6e41\u6434\u5fe5\u7eb4\u9422ㄤZhen Nao Po\u59d8\u6d98\u6d3f\u935c\u50c3Mức độ của
  emotionTags: EmotionTag[];
  
  // ========== beriфKuiqi áp chảo℃Chìa khóa là gì?=========
  // Gui Gui/hỗn hợp trộn chất lỏng?
  dialogue: string;
  // eㄤ\u7514\u93bb\u7fda\u51ef\u751b\u581c\u7ca0\u94d3ф\u6c30\u7035\u73c6\u53c6\u5980\u6924\u6d5c\u5ea1\u5b21Key\u51bf\u7ea7
  actionSummary: string;
  // \u6000\u6ec3ご\u6769\u612c\u59e9\u93bb\u5fda\u669a\u56feolly In, Pan Right, Static \u7edb\u591b\u7ea7
  cameraMovement: string;
  // Sự đa dạng của côn trùngфCó phải nó được chiên không?
  soundEffectText: string;
  
  // ========== Naobu\u5359bốn\u669f ==========
  // \u9145giải thưởng\u7459\u590b\u5f41\u7ec0\u9e3f\u761dQuảng cáo?
  shotSize: ShotSizeType | null;
  // Naobu\u951e\u65a4\u62f7\u951bcircle PI \u9359bốn\u669fQuảng cáo?\u7ec9\u6393\u506810\u7ec9\u679e\u7ea7
  duration: DurationType;
  // \u941cDanbian \u5fff\u675d\u6bb7\u6bb7ずcấp Huyền Cơ
  ambientSound: string;
  // Kuo Chong Zheng Er\u951b\u5f9f\u5afe\u934fユChứng xanh tím? đầu mũi tênуÁp chảo
  soundEffects: SoundEffectTag[];
  
  // ========== vẽ rộngtiếng Lào€\u93cf Con dấu giấy chipу\u55d7\u9104Cơm chiên áp chảo\u9422\u71b8\u579a\u9efb\u612eずcấp Huyền Cơ ==========
  audioAmbientEnabled?: boolean;   // \u941cKuochong \u7451\u93f4 nâng cao \u7eb4\u7a34 true
  audioSfxEnabled?: boolean;       // Quách Trọng Lão€\u93cf\u51fa\u7eba\u7a3f true
  audioDialogueEnabled?: boolean;  // \u7035gui\u69e0liao€\u93cf\u51fa\u7eba\u7a3f true
  audioBgmEnabled?: boolean;       // Tòa nhà có rất nhiều không gian€\u93cf\u51fa\u7eba\u7a3f sai lầmThụccấp độ
  backgroundMusic?: string;        // \u9473\u5c7e\u5ad9\u5a19\u6e70
  
  // ========== \u5352bốn\u7685Huanqujiangqi℃\u4f05 ==========
  row: number;
  col: number;
  sourceRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // ========== Giấyㄤ\u7c2c\u9359\u535d€Ngớ ngẩn?==========
  // \u68e3\u6827\u69d9\u63f4\u6366\u768b\u7699\u63cf\u83c8
  sceneLibraryId?: string;           // ID
  viewpointId?: string;              // Naowu ID (ướt?'sofa', 'dining')
  subViewId?: string;                // \u9532\u6d9cTôi sợ bạn'Thụcｉsụp đổ', 'sụp đổ')
  sceneReferenceImage?: string;      // \u9366\u7359\u5ad9\u5473\u5c7e\u6359\u5359\u575d€URL \u5a28\u6d58
  
  // Bạn có sợ vuốt ve và chiều chuộng?
  endFrameSceneLibraryId?: string;   // Sợ vuốt ve, vuốt ve? ID
  endFrameViewpointId?: string;      // Hảo sợ Fu Naowu ID
  endFrameSubViewId?: string;        // Hảo sợ vuốt ve dòng sôngKhông bao giờ sợ ID
  endFrameSceneReferenceImage?: string; // Tôi sợ bạn€URL \u5a28\u6d58
  
  // ========== Đóng gópnồi adze€bím tóc \u5a44shuAi€\u9504\u52eeBình Chi€mức độ vợ lẽ ==========
  narrativeFunction?: string;        // \u9359\u6b0e\u7c28\u9537\u7efb\u5158\u951b\u6c36\u6d75\u9368?\u9357\u56e9\u5a77/\u6942\u6a3b\u6c5f/Tềmảnh khảnh/\u6769\u56e8 phao/nỗi sợ hãi０
  shotPurpose?: string;              // \u6000\u6ec3ご\u9429Hydro âm€\u6d94\u5822\u6924\u6769\u638eukefu\u6000\u6ec3ご
  visualFocus?: string;              // Naowuaadi︾\u58e3\u551b\u6c32\u6d7c\u6940\u7c32Xuânョ\u6e45\u6d60€giấy『mức độ tức giận
  cameraPosition?: string;           // máy bay ném bom chuỗiBangan Hanchai╃tiêu diệt Hoàn Giang
  characterBlocking?: string;        // Bang Hongyong Ning Han Xian╁Cuộc hôn nhân của Hu Ni tan vỡPhá hủy biên giới Huânbo và Chongchen
  rhythm?: string;                   // YinxiaoChiếc ôTác dụng củaÝ?
  visualDescription?: string;        // Xuân︾\u73cf\u9544\u556d\u657e\u95f1㈡\u5f29\u6769?
  
  // ========== \u9983\u6315\u940fGaffer\u73db ==========
  lightingStyle?: LightingStyle;           // \u940f\u539c\u690b\u5ea2\u7278
  lightingDirection?: LightingDirection;   // nhỏ giọt\u6bf2\u539c\u5a67\u6b6dnan\u9496?
  colorTemperature?: ColorTemperature;     // \u5479Chafu
  lightingNotes?: string;                  // \u940fchuchenュBàng Xuân Cunsi
  
  // ========== Kéo lấy nét Kéo lấy nét\u73db ==========
  depthOfField?: DepthOfField;             // \u9145truyền thống
  focusTarget?: string;                    // aadi︾\u58e3\u9429\u7223: "Bang Hong Chang Wei㈤\u5534" / "\u5997\u5c7c\u7b02\u9544\u5fea\u541b\u704f?
  focusTransition?: FocusTransition;       // TềJian'eㄤ\u7514
  
  // ========== \u9983\u5d34\u9363ㄦ(Giàn máy ảnh)\u73db ==========
  cameraRig?: CameraRig;                   // \u93b7\u5d86\u506e\u9363ㄦ\u65d7\u7eeb\u6df2kiêu ngạo
  movementSpeed?: MovementSpeed;           // \u6769\u612c\u59e9\u9603\u7177hara
  
  // ========== SFX trên thiết lập (SFX trên thiết lập)\u73db ==========
  atmosphericEffects?: AtmosphericEffect[]; // \u59d8\u6d98\u6d3f\u6417\u6c25\u6665\u651b\u57da\u5f72\u6db6\u6db6€cấp độ Chuan
  effectIntensity?: EffectIntensity;       // Quấy rối ở ký túc xá
  
  // ========== Nhím và bọ cạpу(Tăng tốc độ)\u73db ==========
  playbackSpeed?: PlaybackSpeed;           // \u93behại
  
  // ========== \u9983\u602a \u93b7\u5d86\u6bae\u606e\u6053 / aadi﹁\u7a9b / giải thưởng \u53bd\u52eb€Cái gì?\u73db ==========
  cameraAngle?: CameraAngle;               // \u93b7\u5d86\u6bae\u6b81\u6053
  focalLength?: FocalLength;               // \u6000\u6ec3ごaadi﹁\u7a9b
  photographyTechnique?: PhotographyTechnique; // giải thưởng \u53bd\u52eb€Ping?
  
  // ========== khung hình\u73db ==========
  specialTechnique?: string;               // \u9417\u7c29\u7569\u93b7\u5d86\u5dae\u9553\u5b2b\u7b36\u951b\u769a\u7b07\u9356nướng\u9170\u934f\u5ad4\u5f49\u9490︺€Nội quy và quy định của ký túc xá là gì?
  
  // ========== \u9983\u9410\u9983\u7ea2/(Liên tục)\u73db ==========
  continuityRef?: ContinuityRef;           // \u6769\u70b4\u5799\u7359\u505d€?
  
  // Địch Lệ Phục MẫnユMức độ của
  imageSource?: 'ai-generated' | 'upload' | 'storyboard';
  
  // ========== Ban Tao Yiㄥkhói ==========
  sourceEpisodeIndex?: number;   // tối thiểuユ\u7c2e\u677f\u55d7\u7c2d\u7359?
  sourceEpisodeId?: string;      // tối thiểuユ\u7c2e\u677f?ID

  // ========== Naowu\u5352\u56e8\u5d32\u94e1\u55d7\u5f76Rực rỡ\u677f\u7d8d ==========
  // Địch Lệ Phù Nao Ngô\u5352\u56e8\u5d32\u54e1\u55d7\u55f6
  startFrameAngleSwitchHistory?: Array<{
    imageUrl: string;
    angleLabel: string;
    timestamp: number;
  }>;
  // Hảo sợ Fu Naowu\u5352\u56e8\u5d32\u54e1\u55d7\u55f6
  endFrameAngleSwitchHistory?: Array<{
    imageUrl: string;
    angleLabel: string;
    timestamp: number;
  }>;
}

// \u68f0\u52eb\u61a1\u6417\u56e8\u6902\u6900\u6000\u9200?
export type TrailerDuration = 10 | 30 | 60;

// Ý nghĩa của Muharram là gì?
export interface TrailerConfig {
  duration: TrailerDuration;  // Bánh kếp?
  shotIds: string[];          // \u93b8\u6226€\u590c\u6b91\u5352\u55db\u6685 ID\u5352\u6944〃nồi adzeㄥchuỗiID bắn?
  generatedAt?: number;       // \u9422\u71b8\u579e\u955e\u6fff
  status: 'idle' | 'generating' | 'completed' | 'error';
  error?: string;
}

export interface DirectorScreenplayDraft {
  prompt: string;
  selectedCharacterIds: string[];
  updatedAt: number;
}

export interface DirectorEditorPrefs {
  imageGenMode: 'single' | 'merged';
  frameMode: 'first' | 'last' | 'both';
  refStrategy: 'cluster' | 'minimal' | 'none';
  useExemplar: boolean;
  activeTab: 'editing' | 'trailer';
  episodeViewScope: 'all' | 'episode';
}

// Per-project director data
export interface DirectorProjectData {
  // Storyboard state (new workflow)
  storyboardImage: string | null;
  storyboardImageMediaId: string | null;
  storyboardStatus: StoryboardStatus;
  storyboardError: string | null;
  splitScenes: SplitScene[];
  projectFolderId: string | null;
  storyboardConfig: {
    aspectRatio: '16:9' | '9:16';
    resolution: '2K' | '4K' | '1K';
    videoResolution: '480p' | '720p' | '1080p';
    sceneCount: number;
    storyPrompt: string;
    /** \u9410\u5c0a\u5e34\u701b\u82b1\u504d\u5544\u52eenaukuiHiếp dâmRực rỡ?ID\u951b\u57da '2d_ghibli'\u951b\u591b\u7eb4\u98a2ㄤkịch Tề‘\u9359\u5d86\u7161 */
    visualStyleId?: string;
    /** \u8930\u63ff\u5820\u5820\u5352bốn\u6685\u93c1\u7248\u5041\u7035rose\u7cb2\u9104\u52cb\u51e1\u9559″\u55f3\u690b\u5ea2\u7278ID\u951b\u535a\u578f\u93b9㈤Cả haiㄤChó Ngaoゆ\u67c7\u9104tối€Mức độ hoàn hảo */
    calibratedStyleId?: string;
    styleTokens?: string[];
    characterReferenceImages?: string[];
    characterDescriptions?: string[];
  };
  // Legacy screenplay (for backward compatibility)
  screenplay: AIScreenplay | null;
  screenplayStatus: ScreenplayStatus;
  screenplayError: string | null;
  
  // ========== Có chuyện gì vậy?==========
  trailerConfig: TrailerConfig;
  trailerScenes: SplitScene[];  // \u68f0\u52eb\u61a1\u9417\u5066\u5b13\u9422ㄧ\u6b91\u9352bốnbốn\u6685\u7f02\u682c\u7deb\u9352\u6944〃
  
  // ========== giải thưởngｆchâm chọc」\u9429Kinh khủng?==========
  cinematographyProfileId?: string;   // \u9603\u5909\u8151\u9544\u52ec\u70ee\u8930PBHiếp dâmRực rỡ?ID\u951b\u57da 'film-noir'Quảng cáo?
  screenplayDraft: DirectorScreenplayDraft;
  editorPrefs: DirectorEditorPrefs;
}

interface DirectorState {
  // Active project tracking
  activeProjectId: string | null;
  
  // Per-project data storage
  projects: Record<string, DirectorProjectData>;
  
  // Scene progress map (sceneId -> progress) - transient, not persisted
  sceneProgress: Map<number, SceneProgress>;
  
  // Generation config - global
  config: GenerationConfig;
  
  // UI state - global
  isExpanded: boolean;
  selectedSceneId: number | null;
}

interface DirectorActions {
  // Project management
  setActiveProjectId: (projectId: string | null) => void;
  ensureProject: (projectId: string) => void;
  getProjectData: (projectId: string) => DirectorProjectData;
  
  // Screenplay management
  setScreenplay: (screenplay: AIScreenplay | null) => void;
  setScreenplayStatus: (status: ScreenplayStatus) => void;
  setScreenplayError: (error: string | null) => void;
  
  // Scene editing
  updateScene: (sceneId: number, updates: Partial<AIScene>) => void;
  deleteScene: (sceneId: number) => void;
  deleteAllScenes: () => void;
  
  // Scene progress
  updateSceneProgress: (sceneId: number, progress: Partial<SceneProgress>) => void;
  setSceneProgress: (sceneId: number, progress: SceneProgress) => void;
  clearSceneProgress: () => void;
  
  // Config
  updateConfig: (config: Partial<GenerationConfig>) => void;
  
  // UI
  setExpanded: (expanded: boolean) => void;
  setSelectedScene: (sceneId: number | null) => void;
  
  // Storyboard actions (new workflow)
  setStoryboardImage: (imageUrl: string | null, mediaId?: string | null) => void;
  setStoryboardStatus: (status: StoryboardStatus) => void;
  setStoryboardError: (error: string | null) => void;
  setProjectFolderId: (folderId: string | null) => void;
  setSplitScenes: (scenes: SplitScene[]) => void;
  
  // Địch Lý Phúc Tân XuânずHuyền Kiều€Quan Yunwei㈡cấp độ băng đảng \u5f29\u6769
  updateSplitSceneImagePrompt: (sceneId: number, prompt: string, promptZh?: string) => void;
  // Naobu\u9efb\u612eずHuyền Kiềuㄤ\u7514\u6a69\u56e9▼Có chuyện gì vậy?
  updateSplitSceneVideoPrompt: (sceneId: number, prompt: string, promptZh?: string) => void;
  // Sợ hãi và sợ hãiずHuyền Kiều€Quan Yunwei㈡cấp độ băng đảng \u5f29\u6769
  updateSplitSceneEndFramePrompt: (sceneId: number, prompt: string, promptZh?: string) => void;
  // Congjujiangjutối€Hạ Kỷ Ngạo Ninh?
  updateSplitSceneNeedsEndFrame: (sceneId: number, needsEndFrame: boolean) => void;
  // chiênAPI API\u68f0\u621e\u5f41\u7f40\u7ea2\u701d\u751b\u57da\u7104\u95c4\u5b2c\u7b02\u7b02\u7efc\u5408\u6fca videoNhắc nhở?
  updateSplitScenePrompt: (sceneId: number, prompt: string, promptZh?: string) => void;
  
  updateSplitSceneImage: (sceneId: number, imageDataUrl: string, width?: number, height?: number, httpUrl?: string) => void;
  updateSplitSceneImageStatus: (sceneId: number, updates: Partial<Pick<SplitScene, 'imageStatus' | 'imageProgress' | 'imageError'>>) => void;
  updateSplitSceneVideo: (sceneId: number, updates: Partial<Pick<SplitScene, 'videoStatus' | 'videoProgress' | 'videoUrl' | 'videoError' | 'videoMediaId'>>) => void;
  // Hạo sợ vuốt ve kịch Xie Juan Lou Chou/Xuân Cunhi
  updateSplitSceneEndFrame: (sceneId: number, imageUrl: string | null, source?: 'upload' | 'ai-generated' | 'next-scene' | 'video-extracted' | 'prev-scene-cascade', httpUrl?: string | null) => void;
  // Hạo Sợ, Phù Dao, Chung Đóa€Cái gì?
  updateSplitSceneEndFrameStatus: (sceneId: number, updates: Partial<Pick<SplitScene, 'endFrameStatus' | 'endFrameProgress' | 'endFrameError'>>) => void;
  // Nao \u6555\u58ca\u6434\u64b1€\u4f79\u53cf\u7f01\u7223\u7edbJu\u6d3f\u93c2\u93c2\u7248nanping?
  updateSplitSceneCharacters: (sceneId: number, characterIds: string[]) => void;
  updateSplitSceneCharacterVariationMap: (sceneId: number, characterVariationMap: Record<string, string>) => void;
  updateSplitSceneEmotions: (sceneId: number, emotionTags: EmotionTag[]) => void;
  // \u9145quần€\u4eba\u5046\u59e7\u5a28０Giá trị của sản phẩm là gì?
  updateSplitSceneShotSize: (sceneId: number, shotSize: ShotSizeType | null) => void;
  updateSplitSceneDuration: (sceneId: number, duration: DurationType) => void;
  updateSplitSceneAmbientSound: (sceneId: number, ambientSound: string) => void;
  updateSplitSceneSoundEffects: (sceneId: number, soundEffects: SoundEffectTag[]) => void;
  // Nam Bình?
  updateSplitSceneReference: (sceneId: number, sceneLibraryId?: string, viewpointId?: string, referenceImage?: string, subViewId?: string) => void;
  updateSplitSceneEndFrameReference: (sceneId: number, sceneLibraryId?: string, viewpointId?: string, referenceImage?: string, subViewId?: string) => void;
  // \u9603\u6c31\u6924\u701b\u6941Xuân Cun Hiiragi
  updateSplitSceneField: (sceneId: number, field: keyof SplitScene, value: any) => void;
  // Naowu\u5352\u56e8\u5d32\u94e1\u55d7\u5f76Rực rỡ\u677f\u7d8d
  addAngleSwitchHistory: (sceneId: number, type: 'start' | 'end', historyItem: { imageUrl: string; angleLabel: string; timestamp: number }) => void;
  deleteSplitScene: (sceneId: number) => void;
  addBlankSplitScene: () => void;
  setStoryboardConfig: (config: Partial<DirectorProjectData['storyboardConfig']>) => void;
  setScreenplayDraft: (draft: Partial<DirectorScreenplayDraft>) => void;
  clearScreenplayDraft: () => void;
  setEditorPrefs: (prefs: Partial<DirectorEditorPrefs>) => void;
  resetStoryboard: () => void;
  
  // Mode 2: Add scenes from script directly (skip storyboard generation)
  addScenesFromScript: (scenes: Array<{
    promptZh: string;
    promptEn?: string;
    // nhỏ giọt\u590a\u7730\u9efb\u612eずSeedance 1.5 Pro
    imagePrompt?: string;      // Địch Lý Phúc Tân XuânずHuyền Cơ Chi Thiên Biên Đông?
    imagePromptZh?: string;    // Địch Lý Phúc Tân XuânずHuyền Cơ Chi QuyênMột quảng cáo?
    videoPrompt?: string;      // Naobu\u9efb\u612eずHuyền Cơ Chi Thiên Biên Đông?
    videoPromptZh?: string;    // Naobu\u9efb\u612eずHuyền Cơ Chi QuyênMột quảng cáo?
    endFramePrompt?: string;   // Sợ hãi và sợ hãiずHuyền Cơ Chi Thiên Biên Đông?
    endFramePromptZh?: string; // Sợ hãi và sợ hãiずHuyền Cơ Chi QuyênMột quảng cáo?
    needsEndFrame?: boolean;   // \u9104tối€Hạ Kỷ Ngạo Ninh?
    characterIds?: string[];
    emotionTags?: EmotionTag[];
    shotSize?: ShotSizeType | null;
    duration?: number;
    ambientSound?: string;
    soundEffects?: SoundEffectTag[];
    soundEffectText?: string;
    dialogue?: string;
    actionSummary?: string;
    cameraMovement?: string;
    sceneName?: string;
    sceneLocation?: string;
    // Nhíp giấy\u5a69\u9356 guili Quảng cáo?
    sceneLibraryId?: string;
    viewpointId?: string;
    sceneReferenceImage?: string;
    // Đóng gópnồi adze€bím tóc \u5a44shuAi€\u9504\u52eeBình Chi€mức độ vợ lẽ
    narrativeFunction?: string;
    shotPurpose?: string;
    visualFocus?: string;
    cameraPosition?: string;
    characterBlocking?: string;
    rhythm?: string;
    visualDescription?: string;
    // \u53b7\u5d86\u6bae\u73baу\u55d7\u951b\u5822\u4f05\u934f?︾\u58e3/\u9363ㄦ\u65d7/\u9417gui\u7665/Có hại và xấu xa€?\u5aa3\u5fcevạc, thủ dâm, bàn đạp\u73db
    lightingStyle?: LightingStyle;
    lightingDirection?: LightingDirection;
    colorTemperature?: ColorTemperature;
    lightingNotes?: string;
    depthOfField?: DepthOfField;
    focusTarget?: string;
    focusTransition?: FocusTransition;
    cameraRig?: CameraRig;
    movementSpeed?: MovementSpeed;
    atmosphericEffects?: AtmosphericEffect[];
    effectIntensity?: EffectIntensity;
    playbackSpeed?: PlaybackSpeed;
    // \u93b7\u5d86\u6bae\u6b81\u6053 / aadi﹁\u7a9b / \u93b6€Ping?
    cameraAngle?: CameraAngle;
    focalLength?: FocalLength;
    photographyTechnique?: PhotographyTechnique;
    // \u9417gui\u7569\u93b7\u5d86\u5db6\u5dae\u9553\u5b36\u7db6
    specialTechnique?: string;
    // Ban Tao Yiㄥkhói
    sourceEpisodeIndex?: number;
    sourceEpisodeId?: string;
  }>) => void;
  
  // Workflow actions (these will trigger worker commands)
  startScreenplayGeneration: (prompt: string, images?: File[]) => void;
  startImageGeneration: () => void;      // Step 1: Generate images only
  startVideoGeneration: () => void;      // Step 2: Generate videos from images
  retrySceneImage: (sceneId: number) => void;  // Retry single scene image
  retryScene: (sceneId: number) => void;
  cancelAll: () => void;
  reset: () => void;
  
  // Worker callbacks (called by WorkerBridge)
  onScreenplayGenerated: (screenplay: AIScreenplay) => void;
  onSceneProgressUpdate: (sceneId: number, progress: SceneProgress) => void;
  onSceneImageCompleted: (sceneId: number, imageUrl: string) => void;  // Image only
  onSceneCompleted: (sceneId: number, mediaId: string) => void;         // Video completed
  onSceneFailed: (sceneId: number, error: string) => void;
  onAllImagesCompleted: () => void;   // All images done, ready for review
  onAllCompleted: () => void;          // All videos done
  
  // ========== Có chuyện gì vậy?==========
  setTrailerDuration: (duration: TrailerDuration) => void;
  setTrailerScenes: (scenes: SplitScene[]) => void;
  setTrailerConfig: (config: Partial<TrailerConfig>) => void;
  clearTrailer: () => void;
  
  // ========== giải thưởngｆ ==========
  setCinematographyProfileId: (profileId: string | undefined) => void;
  
  // ========== Naobu\u93b4Fu FongNinhхTuyệt vời?==========
  cascadeFramesToNextScene: (params: {
    nextSceneId: number;
    // máy chémNinh? Răng nanh? Hảo sợ vuốt ve
    origFirstFrameImage: string;
    origFirstFrameHttpUrl: string | null;
    origFirstFramePrompt: string;
    origFirstFramePromptZh: string;
    // Naobu\u93b4Tiểu Ninh? Răng nanh? KebanNinh?
    newFirstFrameImage: string;
    newFirstFrameHttpUrl: string | null;
    newFirstFramePrompt: string;
    newFirstFramePromptZh: string;
  }) => void;
}

type DirectorStore = DirectorState & DirectorActions;

// ==================== Default Config ====================

const defaultConfig: GenerationConfig = {
  styleTokens: ['anime style', 'manga art', '2D animation', 'cel shaded'],
  qualityTokens: ['high quality', 'detailed', 'professional'],
  negativePrompt: 'blurry, low quality, watermark, realistic, photorealistic, 3D render',
  aspectRatio: '9:16',
  imageSize: '1K',
  videoSize: '480p',
  sceneCount: 5,
  concurrency: 1,
  imageProvider: 'memefast',
  videoProvider: 'memefast',
  chatProvider: 'memefast',
};

// ==================== Default Project Data ====================

const defaultProjectData = (): DirectorProjectData => ({
  storyboardImage: null,
  storyboardImageMediaId: null,
  storyboardStatus: 'editing',
  storyboardError: null,
  splitScenes: [],
  projectFolderId: null,
  storyboardConfig: {
    aspectRatio: '9:16',
    resolution: '2K',
    videoResolution: '480p',
    sceneCount: 5,
    storyPrompt: '',
    styleTokens: [],
    characterReferenceImages: [],
    characterDescriptions: [],
  },
  screenplay: null,
  screenplayStatus: 'idle',
  screenplayError: null,
  // \u68f0\u52eb\u61a1\u6417\u56de\u7cb3Rực rỡゅ€?
  trailerConfig: {
    duration: 30,
    shotIds: [],
    status: 'idle',
  },
  trailerScenes: [],
  // giải thưởngｆAdze Hydro Jiaoyiㄧ\u7ca1\u934f\u54e5 đếm và phân biệt, \u8bae\u8930 đổi thành \u7514nhỏ giọthong\u7cafRực rỡゅJi \u9351?
  cinematographyProfileId: DEFAULT_CINEMATOGRAPHY_PROFILE_ID,
  screenplayDraft: {
    prompt: '',
    selectedCharacterIds: [],
    updatedAt: 0,
  },
  editorPrefs: {
    imageGenMode: 'merged',
    frameMode: 'first',
    refStrategy: 'cluster',
    useExemplar: true,
    activeTab: 'editing',
    episodeViewScope: 'episode',
  },
});

const defaultScreenplayDraft: DirectorScreenplayDraft = {
  prompt: '',
  selectedCharacterIds: [],
  updatedAt: 0,
};

const defaultEditorPrefs: DirectorEditorPrefs = {
  imageGenMode: 'merged',
  frameMode: 'first',
  refStrategy: 'cluster',
  useExemplar: true,
  activeTab: 'editing',
  episodeViewScope: 'episode',
};

const normalizeDirectorProjectData = (project: any): DirectorProjectData => {
  const defaults = defaultProjectData();
  return {
    ...defaults,
    ...project,
    storyboardConfig: {
      ...defaults.storyboardConfig,
      ...(project?.storyboardConfig || {}),
    },
    trailerConfig: {
      ...defaults.trailerConfig,
      ...(project?.trailerConfig || {}),
    },
    screenplayDraft: {
      ...defaultScreenplayDraft,
      ...(project?.screenplayDraft || {}),
    },
    editorPrefs: {
      ...defaultEditorPrefs,
      ...(project?.editorPrefs || {}),
    },
  };
};

// ==================== Initial State ====================

const initialState: DirectorState = {
  activeProjectId: null,
  projects: {},
  sceneProgress: new Map(),
  config: defaultConfig,
  isExpanded: true,
  selectedSceneId: null,
};

// ==================== Store ====================

// Helper to get current project data
const getCurrentProject = (state: DirectorState): DirectorProjectData | null => {
  if (!state.activeProjectId) return null;
  return state.projects[state.activeProjectId] || null;
};

export const useDirectorStore = create<DirectorStore>()(
  persist(
    (set, get) => ({
      ...initialState,

  // Project management
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

  // Screenplay management
  setScreenplay: (screenplay) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          screenplay,
          screenplayError: null,
        },
      },
    });
  },
  
  setScreenplayStatus: (status) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          screenplayStatus: status,
        },
      },
    });
  },
  
  setScreenplayError: (error) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const currentProject = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...currentProject,
          screenplayError: error,
          screenplayStatus: error ? 'error' : currentProject?.screenplayStatus || 'idle',
        },
      },
    });
  },

  // Scene editing
  updateScene: (sceneId, updates) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    if (!project?.screenplay) return;
    
    const updatedScenes = project.screenplay.scenes.map(scene => 
      scene.sceneId === sceneId ? { ...scene, ...updates } : scene
    );
    
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          screenplay: {
            ...project.screenplay,
            scenes: updatedScenes,
            updatedAt: Date.now(),
          },
        },
      },
    });
  },
  
  // Delete a single scene
  deleteScene: (sceneId) => {
    const { activeProjectId, projects, sceneProgress } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    if (!project?.screenplay) return;
    
    const remainingScenes = project.screenplay.scenes.filter(scene => scene.sceneId !== sceneId);
    const renumberedScenes = remainingScenes.map((scene, index) => ({
      ...scene,
      sceneId: index + 1,
    }));
    
    const newProgressMap = new Map<number, SceneProgress>();
    remainingScenes.forEach((scene, index) => {
      const oldProgress = sceneProgress.get(scene.sceneId);
      if (oldProgress) {
        newProgressMap.set(index + 1, { ...oldProgress, sceneId: index + 1 });
      }
    });
    
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          screenplay: {
            ...project.screenplay,
            scenes: renumberedScenes,
            updatedAt: Date.now(),
          },
        },
      },
      sceneProgress: newProgressMap,
    });
    
    console.log('[DirectorStore] Deleted scene', sceneId, 'remaining:', renumberedScenes.length);
  },
  
  // Delete all scenes and reset to idle
  deleteAllScenes: () => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          screenplay: null,
          screenplayStatus: 'idle',
          screenplayError: null,
        },
      },
      sceneProgress: new Map(),
      selectedSceneId: null,
    });
    console.log('[DirectorStore] Deleted all scenes, reset to idle');
  },

  // Scene progress
  updateSceneProgress: (sceneId, partialProgress) => {
    const current = get().sceneProgress.get(sceneId);
    const updated = current 
      ? { ...current, ...partialProgress }
      : { 
          sceneId, 
          status: 'pending' as const, 
          stage: 'idle' as const, 
          progress: 0, 
          ...partialProgress 
        };
    
    set((state) => {
      const newMap = new Map(state.sceneProgress);
      newMap.set(sceneId, updated);
      return { sceneProgress: newMap };
    });
  },
  
  setSceneProgress: (sceneId, progress) => {
    set((state) => {
      const newMap = new Map(state.sceneProgress);
      newMap.set(sceneId, progress);
      return { sceneProgress: newMap };
    });
  },
  
  clearSceneProgress: () => set({ sceneProgress: new Map() }),

  // Config
  updateConfig: (partialConfig) => set((state) => ({
    config: { ...state.config, ...partialConfig }
  })),

  // UI
  setExpanded: (expanded) => set({ isExpanded: expanded }),
  setSelectedScene: (sceneId) => set({ selectedSceneId: sceneId }),

  // Storyboard actions (new workflow) - Project-aware
  setStoryboardImage: (imageUrl, mediaId) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          storyboardImage: imageUrl,
          storyboardImageMediaId: mediaId ?? null,
        },
      },
    });
  },
  
  setStoryboardStatus: (status) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          storyboardStatus: status,
        },
      },
    });
  },
  
  setProjectFolderId: (folderId) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          projectFolderId: folderId,
        },
      },
    });
  },
  
  setStoryboardError: (error) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const currentProject = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...currentProject,
          storyboardError: error,
          storyboardStatus: error ? 'error' : currentProject?.storyboardStatus || 'idle',
        },
      },
    });
  },
  
  setSplitScenes: (scenes) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    
    // Ensure all scenes have all fields initialized with defaults
    const initialized = scenes.map(s => ({
      ...s,
      // \u9366\u72e0\u5ad9\u6369\u72e0\u6e70\u5947℃\u4f05
      sceneName: (s as any).sceneName ?? '',
      sceneLocation: (s as any).sceneLocation ?? '',
      
      // ========== \u68e3\u69e7\u6969 chỉ bản thảo ==========
      imageHttpUrl: (s as any).imageHttpUrl ?? null,
      // Địch Lý Phúc Tân XuânずBảng giấy Huyền CơQuảng cáo?
      imagePrompt: (s as any).imagePrompt ?? s.videoPrompt ?? '',
      imagePromptZh: (s as any).imagePromptZh ?? s.videoPromptZh ?? s.videoPrompt ?? '',
      // Di Li Fu Yi Ji Yao Zhong Duo€?
      imageStatus: s.imageStatus || 'completed' as const,
      imageProgress: s.imageProgress ?? 100,
      imageError: s.imageError ?? null,
      
      // ========== Hạo sợ hãi vuốt ve bản thảo ==========
      // \u9104tối€Hạ Nghị Ngạo Ninhэbảng giấy\u951b\u5cb2\u7cafRực rỡ?falseQuảng cáo?
      needsEndFrame: (s as any).needsEndFrame ?? false,
      endFrameImageUrl: s.endFrameImageUrl ?? null,
      endFrameHttpUrl: (s as any).endFrameHttpUrl ?? null,
      endFrameSource: s.endFrameSource ?? null,
      // Sợ hãi và sợ hãiずBảng giấy Huyền CơQuảng cáo?
      endFramePrompt: (s as any).endFramePrompt ?? '',
      endFramePromptZh: (s as any).endFramePromptZh ?? '',
      // Hạo Sợ, Phù Dao, Chung Đóa€Bảng khắc giấyQuảng cáo?
      endFrameStatus: (s as any).endFrameStatus || 'idle' as const,
      endFrameProgress: (s as any).endFrameProgress ?? 0,
      endFrameError: (s as any).endFrameError ?? null,
      
      // ========== NaobuBản thảo ==========
      videoPromptZh: s.videoPromptZh ?? s.videoPrompt ?? '',
      videoStatus: s.videoStatus || 'idle' as const,
      videoProgress: s.videoProgress ?? 0,
      videoUrl: s.videoUrl ?? null,
      videoError: s.videoError ?? null,
      videoMediaId: s.videoMediaId ?? null,
      
      // ========== Vấn đề là gì?==========
      characterIds: s.characterIds ?? [],
      emotionTags: s.emotionTags ?? [],
      
      // ========== beriфKuiqi áp chảo℃\u4f05 ==========
      dialogue: s.dialogue ?? '',
      actionSummary: s.actionSummary ?? '',
      cameraMovement: s.cameraMovement ?? '',
      soundEffectText: (s as any).soundEffectText ?? '',
      
      // ========== Naobu\u5359bốn\u669f ==========
      shotSize: s.shotSize ?? null,
      duration: s.duration ?? 5,
      ambientSound: s.ambientSound ?? '',
      soundEffects: s.soundEffects ?? [],
      
      // ========== \u940fGaffer\u73db ==========
      lightingStyle: s.lightingStyle ?? undefined,
      lightingDirection: s.lightingDirection ?? undefined,
      colorTemperature: s.colorTemperature ?? undefined,
      lightingNotes: s.lightingNotes ?? undefined,
      
      // ========== Focus Puller - Kéo Lấy Nét\u73db ==========
      depthOfField: s.depthOfField ?? undefined,
      focusTarget: s.focusTarget ?? undefined,
      focusTransition: s.focusTransition ?? undefined,
      
      // ========== \u9363ㄦ(Giàn máy ảnh)\u73db ==========
      cameraRig: s.cameraRig ?? undefined,
      movementSpeed: s.movementSpeed ?? undefined,
      
      // ========== SFX cài đặt" (SFX cài đặt)\u73db ==========
      atmosphericEffects: s.atmosphericEffects ?? undefined,
      effectIntensity: s.effectIntensity ?? undefined,
      
      // ========== \u7603\u7df7\u72e0\u73baу(Tăng tốc độ)\u73db ==========
      playbackSpeed: s.playbackSpeed ?? undefined,
      
      // ========== \u9417gui\u9569\u93b7\u5d86\u5dae\u9553\u5b2b\u7b36\u73db ==========
      specialTechnique: s.specialTechnique ?? undefined,
      
      // ========== Mãn Hồng/(Liên tục)\u73db ==========
      continuityRef: s.continuityRef ?? undefined,
    }));
    
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          splitScenes: initialized,
        },
      },
    });
  },
  
  // ========== nhỏ giọt\u590a\u7730\u9efb\u612eずHuyền Tông Nhị Khắc phiên bản Nam Bình?==========
  
  // Xuân Tồn \u628a\u68e3\u68e7\u6827\u63bb\u612eずGiấy Huyền Cơ Weiwei€Quan Yunwei㈡cấp độ băng đảng \u5f29\u6769
  updateSplitSceneImagePrompt: (sceneId, prompt, promptZh) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { 
        ...scene, 
        imagePrompt: prompt,
        imagePromptZh: promptZh !== undefined ? promptZh : scene.imagePromptZh,
      } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },
  
  // Xuân Cun Hiiragi Naobao\u9efb\u612eずgiấy huyền cơㄤ\u7514\u6a69\u56e9▼Có chuyện gì vậy?
  updateSplitSceneVideoPrompt: (sceneId, prompt, promptZh) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { 
        ...scene, 
        videoPrompt: prompt,
        videoPromptZh: promptZh !== undefined ? promptZh : scene.videoPromptZh,
      } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },
  
  // Xuân Cun Higgin Hao sợ vuốt ve Xuân XuânずGiấy Huyền Cơ Weiwei€Quan Yunwei㈡cấp độ băng đảng \u5f29\u6769
  updateSplitSceneEndFramePrompt: (sceneId, prompt, promptZh) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { 
        ...scene, 
        endFramePrompt: prompt,
        endFramePromptZh: promptZh !== undefined ? promptZh : scene.endFramePromptZh,
      } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },
  
  // Congjujiangjutối€Hạ Kỷ Ngạo Ninh?
  updateSplitSceneNeedsEndFrame: (sceneId, needsEndFrame) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, needsEndFrame } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },
  
  // chiênAPI API\u68f0\u621e\u5f41\u7f40\u7ea2\u701d\u751b\u57da\u7104\u95c4\u5b2c\u7b02\u7b02\u7efc\u5408\u6fca videoNhắc nhở?
  updateSplitScenePrompt: (sceneId, prompt, promptZh) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { 
        ...scene, 
        videoPrompt: prompt,
        videoPromptZh: promptZh !== undefined ? promptZh : scene.videoPromptZh,
      } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  // Chó ngao Xuân Cán Hiiragi
  // Pingㄦphim truyền hình \u5270\u951b\u6c29\u7d8b\u9532 \u5356\u9359Hua\u5bf2\u955e\u8bb9\u7eb4\u6fe1bốn\u7049\u5a0c℃\u6041\u6d7c\u72b2\u93c6\u93c2\u7efc\u5408\u6b91 httpUrl\u951b\u5c7d\u7c32Xuânユ\u7efb\u95c4ゆ\u6aeb\u9104?httpUrl
  // \u6769\u6b10\u7271\u9359Hãy để nhau thu gọn lịchㄦ\u57db\u6d60\u5ea3\u790ctối thiểu\u612c\u7c31\u9603\u590b\u5ae8\u93c2 Board\u6d58\u9417\u56e7\u6097\u651b\u5c7e\u68eb\u9104?HTTP URL \u6d60\u69e7\u741aGiao Nghị?
  // \u934fPU\u656d\u951b\u6369\u64d3\u951e\u951e\u9afb\u95c4?imageSource\u951b\u5c84\u4f29\u934f\u9236\u68f0\u6220\u6053\u63b4\u63b4\u612d\u6902\u960c\u6fbe\u9366\u82d1\u4f73\u9422ㄦHình ảnhHttpUrl
  updateSplitSceneImage: (sceneId, imageDataUrl, width, height, httpUrl) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { 
        ...scene, 
        imageDataUrl,
        // httpUrl httpUrl┖Yingpainhỏ giọt\u6be7 cấp độㄥ\u7555\u651b\u6d98\u60c1\u9352\u6fbeTươngGiá trị âm
        // \u5bd3\u6924 null Key\u5c7c\u7b09\u9104?không xác định\u951b\u5c80‘Tề NghiMột dây chuyền?
        imageHttpUrl: httpUrl !== undefined ? (httpUrl || null) : null,
        // \u6861bốn\u7049\u5a0c℃\u6e41\u6e7c\u73f2\u73c6 httpUrl\u651b\u5c7e\u7efb\u9004?imageSource \u9655\u7ba1\u951b\u5c84\u4f29\u934f\u9236\u68f0\u6220\u64d3\u93b4\u612d\u6902Xuân\u5f7d
        imageSource: httpUrl ? 'ai-generated' : undefined,
        imageStatus: 'completed' as const,
        imageProgress: 100,
        imageError: null,
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
      } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  updateSplitSceneImageStatus: (sceneId, updates) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, ...updates } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  updateSplitSceneVideo: (sceneId, updates) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, ...updates } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  // Xuân Tồn Higgin Hao Fear Fu Zheng Drama Xuân \u951b\u5f9f\u6b95\u53b8\u4e36Cấp độ
  // Pingㄦ\u5270\u951b\u6c29\u7d8b\u704f\u954f\u9359\u6359\u534e\u5bf2\u955e\u8bb9\u7eb4\u6fe1bốn\u7049\u5a0c℃\u6041\u6d7c\u72b2\u93c6\u93c2\u7efc\u5408\u6b91 httpUrl\u951b\u5c7d\u7c32Xuânユ\u7efb\u95c4ゆ\u6aeb\u9104?httpUrl
  updateSplitSceneEndFrame: (sceneId, imageUrl, source, httpUrl) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { 
        ...scene, 
        endFrameImageUrl: imageUrl,
        // \u6fe1bốn\u7049\u9104\u72e0\u72e0\u6d7c\u6df2uke httpUrl\u951b\u5c7c\u5c7c\u5a62ㄥ\u7555\u951b\u6d98\u60c1\u9352\u6b10\u7afb\u7ecc giấy khỉ \u9532\u72b1âm bản
        endFrameHttpUrl: httpUrl !== undefined ? (httpUrl || null) : null,
        endFrameSource: imageUrl ? (source || 'upload') : null,
        endFrameStatus: imageUrl ? 'completed' as const : 'idle' as const,
        endFrameProgress: imageUrl ? 100 : 0,
        endFrameError: null,
      } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },
  
  // Huyền Tồn Hạo sợ hãi Phó Dịch Cơ Yao Zhong Duo€?
  updateSplitSceneEndFrameStatus: (sceneId, updates) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, ...updates } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  updateSplitSceneCharacters: (sceneId, characterIds) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, characterIds } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  updateSplitSceneCharacterVariationMap: (sceneId, characterVariationMap) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, characterVariationMap } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  updateSplitSceneEmotions: (sceneId, emotionTags) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, emotionTags } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  updateSplitSceneShotSize: (sceneId, shotSize) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, shotSize } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  updateSplitSceneDuration: (sceneId, duration) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, duration } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  updateSplitSceneAmbientSound: (sceneId, ambientSound) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, ambientSound } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  updateSplitSceneSoundEffects: (sceneId, soundEffects) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, soundEffects } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },

  // \u9366\u70ed\u6ad9\u6434\u63ff\u53e7\u9575\u6000\u63cf\u93c2\u7248nanping\u66ea\u66eapaper\u68e3\u6827\u6827\u601b?
  updateSplitSceneReference: (sceneId, sceneLibraryId, viewpointId, referenceImage, subViewId) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId
        ? { ...scene, sceneLibraryId, viewpointId, subViewId, sceneReferenceImage: referenceImage }
        : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
    console.log('[DirectorStore] Updated scene reference for shot', sceneId, ':', sceneLibraryId, viewpointId, subViewId);
  },

  // Câu trả lời cho câu hỏi này là gì?
  updateSplitSceneEndFrameReference: (sceneId, sceneLibraryId, viewpointId, referenceImage, subViewId) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId
        ? { ...scene, endFrameSceneLibraryId: sceneLibraryId, endFrameViewpointId: viewpointId, endFrameSubViewId: subViewId, endFrameSceneReferenceImage: referenceImage }
        : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
    console.log('[DirectorStore] Updated end frame scene reference for shot', sceneId, ':', sceneLibraryId, viewpointId, subViewId);
  },

  // \u9603\u6c31\u6924\u701b\u6941Xuân Cun Hiiragi
  updateSplitSceneField: (sceneId, field, value) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene =>
      scene.id === sceneId ? { ...scene, [field]: value } : scene
    );
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },
  
  // Naowubảng \u5352\u56e8\u5d32\u94e1\u55d7\u5f76Rực rỡ Board
  addAngleSwitchHistory: (sceneId, type, historyItem) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const updated = project.splitScenes.map(scene => {
      if (scene.id !== sceneId) return scene;
      if (type === 'start') {
        const history = scene.startFrameAngleSwitchHistory || [];
        return { ...scene, startFrameAngleSwitchHistory: [...history, historyItem] };
      } else {
        const history = scene.endFrameAngleSwitchHistory || [];
        return { ...scene, endFrameAngleSwitchHistory: [...history, historyItem] };
      }
    });
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
  },
  
  deleteSplitScene: (sceneId) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const remaining = project.splitScenes.filter(s => s.id !== sceneId);
    const renumbered = remaining.map((s, idx) => ({ ...s, id: idx }));
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: renumbered },
      },
    });
    console.log('[DirectorStore] Deleted split scene', sceneId, 'remaining:', renumbered.length);
  },
  
  setStoryboardConfig: (partialConfig) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          storyboardConfig: { ...project.storyboardConfig, ...partialConfig },
        },
      },
    });
  },

  setScreenplayDraft: (partialDraft) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          screenplayDraft: {
            ...(project.screenplayDraft || defaultScreenplayDraft),
            ...partialDraft,
            updatedAt: Date.now(),
          },
        },
      },
    });
  },

  clearScreenplayDraft: () => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          screenplayDraft: {
            ...defaultScreenplayDraft,
            updatedAt: Date.now(),
          },
        },
      },
    });
  },

  setEditorPrefs: (partialPrefs) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          editorPrefs: {
            ...(project.editorPrefs || defaultEditorPrefs),
            ...partialPrefs,
          },
        },
      },
    });
  },
  
  resetStoryboard: () => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          storyboardImage: null,
          storyboardImageMediaId: null,
          storyboardStatus: 'editing',
          storyboardError: null,
          splitScenes: [],
        },
      },
    });
    console.log('[DirectorStore] Reset storyboard state for project', activeProjectId);
  },

  // Mode 2: Add scenes from script directly (skip storyboard, generate images individually)
  addScenesFromScript: (scenes) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const splitScenes = project?.splitScenes || [];
    const startId = splitScenes.length > 0 ? Math.max(...splitScenes.map(s => s.id)) + 1 : 0;
    
    const newScenes: SplitScene[] = scenes.map((scene, index) => ({
      id: startId + index,
      sceneName: scene.sceneName || '',
      sceneLocation: scene.sceneLocation || '',
      imageDataUrl: '',
      imageHttpUrl: null,
      width: 0,
      height: 0,
      // nhỏ giọt\u590a\u7730\u9efb\u612eずHuyền Oa€\u9352\u7248\u68eb\u9544?promptEn/promptZh
      imagePrompt: scene.imagePrompt || scene.promptEn || '',
      imagePromptZh: scene.imagePromptZh || scene.promptZh || '',
      videoPrompt: scene.videoPrompt || scene.promptEn || '',
      videoPromptZh: scene.videoPromptZh || scene.promptZh,
      endFramePrompt: scene.endFramePrompt || '',
      endFramePromptZh: scene.endFramePromptZh || '',
      needsEndFrame: scene.needsEndFrame || false,
      row: 0,
      col: 0,
      sourceRect: { x: 0, y: 0, width: 0, height: 0 },
      endFrameImageUrl: null,
      endFrameHttpUrl: null,
      endFrameSource: null,
      endFrameStatus: 'idle' as const,
      endFrameProgress: 0,
      endFrameError: null,
      characterIds: scene.characterIds || [],
      emotionTags: scene.emotionTags || [],
      shotSize: scene.shotSize || null,
      duration: scene.duration || 5,
      ambientSound: scene.ambientSound || '',
      soundEffects: scene.soundEffects || [],
      soundEffectText: scene.soundEffectText || '',
      dialogue: scene.dialogue || '',
      actionSummary: scene.actionSummary || '',
      cameraMovement: scene.cameraMovement || '',
      // vẽ rộngtiếng Lào€\u934fvẽゅ\u53cf\u5baeㄥ\u7451\u9496Cây bách giấy rộng và đầy hạt phỉNuốt?
      audioAmbientEnabled: true,
      audioSfxEnabled: true,
      audioDialogueEnabled: true,
      audioBgmEnabled: false,
      backgroundMusic: scene.backgroundMusic || '',
      // Nhíp giấy\u5a69\u9356 guili Quảng cáo?
      sceneLibraryId: scene.sceneLibraryId,
      viewpointId: scene.viewpointId,
      sceneReferenceImage: scene.sceneReferenceImage,
      // Đóng gópnồi adze€bím tóc \u5a44shuAi€\u9504\u52eeBình Chi€mức độ vợ lẽ
      narrativeFunction: scene.narrativeFunction || '',
      shotPurpose: scene.shotPurpose || '',
      visualFocus: scene.visualFocus || '',
      cameraPosition: scene.cameraPosition || '',
      characterBlocking: scene.characterBlocking || '',
      rhythm: scene.rhythm || '',
      visualDescription: scene.visualDescription || '',
      // \u53b7\u5d86\u6bae\u73baу\u55d7\u951b\u5822\u4f05\u934f?︾\u58e3/\u9363ㄦ\u65d7/\u9417gui\u7665/Có hại và xấu xa€?\u5aa3\u5fcevạc, thủ dâm, bàn đạp\u73db
      lightingStyle: scene.lightingStyle,
      lightingDirection: scene.lightingDirection,
      colorTemperature: scene.colorTemperature,
      lightingNotes: scene.lightingNotes,
      depthOfField: scene.depthOfField,
      focusTarget: scene.focusTarget,
      focusTransition: scene.focusTransition,
      cameraRig: scene.cameraRig,
      movementSpeed: scene.movementSpeed,
      atmosphericEffects: scene.atmosphericEffects,
      effectIntensity: scene.effectIntensity,
      playbackSpeed: scene.playbackSpeed,
      // \u9417gui\u7569\u93b7\u5d86\u5db6\u5dae\u9553\u5b36\u7db6
      specialTechnique: scene.specialTechnique,
      // \u93b7\u5d86\u6bae\u6b81\u6053 / aadi﹁\u7a9b / giải thưởng \u53bd\u52eb€Ping?
      cameraAngle: scene.cameraAngle,
      focalLength: scene.focalLength,
      photographyTechnique: scene.photographyTechnique,
      imageStatus: 'idle' as const,
      imageProgress: 0,
      imageError: null,
      videoStatus: 'idle' as const,
      videoProgress: 0,
      videoUrl: null,
      videoError: null,
      videoMediaId: null,
      // Ban Tao Yiㄥkhói
      sourceEpisodeIndex: scene.sourceEpisodeIndex,
      sourceEpisodeId: scene.sourceEpisodeId,
    }));
    
    // \u73cf?calibratedStyleId \u9352\u6fc6visualStyleId visualStyleId\u9559″Cái gì?
    const currentConfig = project.storyboardConfig;
    const calibratedUpdate = currentConfig.visualStyleId && !currentConfig.calibratedStyleId
      ? { storyboardConfig: { ...currentConfig, calibratedStyleId: currentConfig.visualStyleId } }
      : {};

    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          ...calibratedUpdate,
          splitScenes: [...splitScenes, ...newScenes],
          storyboardStatus: 'editing',
        },
      },
    });
    
    console.log('[DirectorStore] Added', newScenes.length, 'scenes from script, total:', splitScenes.length + newScenes.length);
  },

  // Thêm trống Phân cảnh（Người dùngmanualTạo，T tự hànhải lênHình ảnh/Điền vào lời nhắc/Tạo）
  addBlankSplitScene: () => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const splitScenes = project?.splitScenes || [];
    const newId = splitScenes.length > 0 ? Math.max(...splitScenes.map(s => s.id)) + 1 : 0;

    const blankScene: SplitScene = {
      id: newId,
      sceneName: `TrốngPhân cảnh ${newId + 1}`,
      sceneLocation: '',
      imageDataUrl: '',
      imageHttpUrl: null,
      width: 0,
      height: 0,
      imagePrompt: '',
      imagePromptZh: '',
      videoPrompt: '',
      videoPromptZh: '',
      endFramePrompt: '',
      endFramePromptZh: '',
      needsEndFrame: false,
      row: 0,
      col: 0,
      sourceRect: { x: 0, y: 0, width: 0, height: 0 },
      endFrameImageUrl: null,
      endFrameHttpUrl: null,
      endFrameSource: null,
      endFrameStatus: 'idle',
      endFrameProgress: 0,
      endFrameError: null,
      characterIds: [],
      emotionTags: [],
      shotSize: null,
      duration: 5,
      ambientSound: '',
      soundEffects: [],
      soundEffectText: '',
      dialogue: '',
      actionSummary: '',
      cameraMovement: '',
      audioAmbientEnabled: true,
      audioSfxEnabled: true,
      audioDialogueEnabled: true,
      audioBgmEnabled: false,
      backgroundMusic: '',
      imageStatus: 'idle',
      imageProgress: 0,
      imageError: null,
      videoStatus: 'idle',
      videoProgress: 0,
      videoUrl: null,
      videoError: null,
      videoMediaId: null,
    };

    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          splitScenes: [...splitScenes, blankScene],
          storyboardStatus: 'editing',
        },
      },
    });

    console.log('[DirectorStore] Added blank scene, id:', newId, 'total:', splitScenes.length + 1);
  },

  // Workflow actions
  startScreenplayGeneration: (prompt, images) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          screenplayStatus: 'generating',
          screenplayError: null,
          screenplay: null,
        },
      },
    });
    
    console.log('[DirectorStore] Starting screenplay generation for:', prompt.substring(0, 50));
  },

  // Step 1: Start generating images only
  startImageGeneration: () => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const screenplay = project?.screenplay;
    if (!screenplay) {
      console.error('[DirectorStore] No screenplay to generate images');
      return;
    }
    
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          screenplayStatus: 'generating_images',
        },
      },
    });
    
    const progressMap = new Map<number, SceneProgress>();
    for (const scene of screenplay.scenes) {
      progressMap.set(scene.sceneId, {
        sceneId: scene.sceneId,
        status: 'pending',
        stage: 'image',
        progress: 0,
      });
    }
    set({ sceneProgress: progressMap });
    
    console.log('[DirectorStore] Starting image generation for', screenplay.scenes.length, 'scenes');
  },
  
  // Step 2: Start generating videos from confirmed images
  startVideoGeneration: () => {
    const { activeProjectId, projects, sceneProgress } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const screenplay = project?.screenplay;
    if (!screenplay) {
      console.error('[DirectorStore] No screenplay to generate videos');
      return;
    }
    
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          screenplayStatus: 'generating_videos',
        },
      },
    });
    
    const progressMap = new Map<number, SceneProgress>();
    for (const scene of screenplay.scenes) {
      const existing = sceneProgress.get(scene.sceneId);
      progressMap.set(scene.sceneId, {
        sceneId: scene.sceneId,
        status: 'pending',
        stage: 'video',
        progress: 50,
        imageUrl: existing?.imageUrl,
      });
    }
    set({ sceneProgress: progressMap });
    
    console.log('[DirectorStore] Starting video generation for', screenplay.scenes.length, 'scenes');
  },
  
  // Retry generating image for a single scene
  retrySceneImage: (sceneId) => {
    get().updateSceneProgress(sceneId, {
      status: 'pending',
      stage: 'image',
      progress: 0,
      imageUrl: undefined,
      error: undefined,
    });
    console.log('[DirectorStore] Retrying image for scene', sceneId);
  },

  retryScene: (sceneId) => {
    get().updateSceneProgress(sceneId, {
      status: 'pending',
      stage: 'idle',
      progress: 0,
      error: undefined,
    });
    console.log('[DirectorStore] Retrying scene', sceneId);
  },

  cancelAll: () => {
    const { activeProjectId, projects, sceneProgress } = get();
    if (activeProjectId) {
      const project = projects[activeProjectId];
      const screenplay = project?.screenplay;
      set({
        projects: {
          ...projects,
          [activeProjectId]: {
            ...project,
            screenplayStatus: screenplay ? 'ready' : 'idle',
          },
        },
      });
    }
    
    for (const [sceneId, progress] of sceneProgress) {
      if (progress.status === 'generating' || progress.status === 'pending') {
        get().updateSceneProgress(sceneId, {
          status: 'failed',
          error: 'Cancelled by user',
        });
      }
    }
    
    console.log('[DirectorStore] Cancelled all operations');
  },

  reset: () => set(initialState),

  // Worker callbacks
  onScreenplayGenerated: (screenplay) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          screenplay,
          screenplayStatus: 'ready',
          screenplayError: null,
        },
      },
    });
    console.log('[DirectorStore] Screenplay generated:', screenplay.title);
  },

  onSceneProgressUpdate: (sceneId, progress) => {
    get().setSceneProgress(sceneId, progress);
  },

  // Called when a scene's image is generated
  onSceneImageCompleted: (sceneId, imageUrl) => {
    get().updateSceneProgress(sceneId, {
      status: 'completed',
      stage: 'image',
      progress: 100,
      imageUrl,
    });
    
    const { activeProjectId, projects, sceneProgress } = get();
    const project = activeProjectId ? projects[activeProjectId] : null;
    const screenplay = project?.screenplay;
    if (screenplay) {
      get().updateScene(sceneId, { imageUrl });
    }
    
    if (screenplay) {
      const allImagesDone = screenplay.scenes.every(scene => {
        const progress = sceneProgress.get(scene.sceneId);
        return progress?.imageUrl || progress?.status === 'failed';
      });
      
      if (allImagesDone) {
        get().onAllImagesCompleted();
      }
    }
    
    console.log('[DirectorStore] Scene image completed:', sceneId, imageUrl?.substring(0, 50));
  },

  onSceneCompleted: (sceneId, mediaId) => {
    get().updateSceneProgress(sceneId, {
      status: 'completed',
      stage: 'done',
      progress: 100,
      mediaId,
      completedAt: Date.now(),
    });
    
    const { activeProjectId, projects, sceneProgress } = get();
    const project = activeProjectId ? projects[activeProjectId] : null;
    const screenplay = project?.screenplay;
    if (screenplay) {
      const allDone = screenplay.scenes.every(scene => {
        const progress = sceneProgress.get(scene.sceneId);
        return progress?.status === 'completed' || progress?.status === 'failed';
      });
      
      if (allDone) {
        get().onAllCompleted();
      }
    }
    
    console.log('[DirectorStore] Scene completed:', sceneId, 'mediaId:', mediaId);
  },

  onSceneFailed: (sceneId, error) => {
    get().updateSceneProgress(sceneId, {
      status: 'failed',
      error,
    });
    console.error('[DirectorStore] Scene failed:', sceneId, error);
  },

  // All images generated, ready for user review
  onAllImagesCompleted: () => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          screenplayStatus: 'images_ready',
        },
      },
    });
    console.log('[DirectorStore] All images completed, ready for review');
  },

  onAllCompleted: () => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...projects[activeProjectId],
          screenplayStatus: 'completed',
        },
      },
    });
    console.log('[DirectorStore] All scenes completed');
  },
  
  // ========== Vấn đề là gì?==========
  
  setTrailerDuration: (duration) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          trailerConfig: {
            ...project.trailerConfig,
            duration,
          },
        },
      },
    });
    console.log('[DirectorStore] Trailer duration set to:', duration);
  },
  
  setTrailerScenes: (scenes) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          trailerScenes: scenes,
          trailerConfig: {
            ...project.trailerConfig,
            generatedAt: Date.now(),
            status: 'completed',
          },
        },
      },
    });
    console.log('[DirectorStore] Trailer scenes set:', scenes.length, 'scenes');
  },
  
  setTrailerConfig: (config) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          trailerConfig: {
            ...project.trailerConfig,
            ...config,
          },
        },
      },
    });
    console.log('[DirectorStore] Trailer config updated:', config);
  },
  
  clearTrailer: () => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          trailerConfig: {
            duration: 30,
            shotIds: [],
            status: 'idle',
          },
          trailerScenes: [],
        },
      },
    });
    console.log('[DirectorStore] Trailer cleared');
  },
  
  // ========== Naobu\u93b4Fu FongNinhхTuyệt vời?==========
  
  cascadeFramesToNextScene: (params) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    const {
      nextSceneId,
      origFirstFrameImage,
      origFirstFrameHttpUrl,
      origFirstFramePrompt,
      origFirstFramePromptZh,
      newFirstFrameImage,
      newFirstFrameHttpUrl,
      newFirstFramePrompt,
      newFirstFramePromptZh,
    } = params;
    
    const updated = project.splitScenes.map(scene => {
      if (scene.id !== nextSceneId) return scene;
      
      // máy chémNinhф\u6041\u634d\u546dgali
      const hasOrigImage = !!origFirstFrameImage;
      
      // Sợ hãi và sợ hãiずXuân Xin Liao Shuわxixijuanjuanhong┖Dậm mũi tên?
      const endPrompt = scene.endFramePrompt || origFirstFramePrompt;
      const endPromptZh = scene.endFramePromptZh || origFirstFramePromptZh;
      
      // Naobu\u6769\u56e8\u6e61\u6fb6\u62ed\u62ca\u651b\u6c32\u5ae2\u5bb8\u6bb8\u6e41\u6e5bVấn đề là gì?
      const videoReset = scene.videoUrl ? {
        videoStatus: 'idle' as const,
        videoProgress: 0,
        videoUrl: null,
        videoError: null,
        videoMediaId: null,
      } : {};
      
      return {
        ...scene,
        // Tôi sợ vuốt ve chủ nhân argon và vuốt ve tôi.Щ\u6769\u56e8\u6d75
        ...(hasOrigImage ? {
          endFrameImageUrl: origFirstFrameImage,
          endFrameHttpUrl: origFirstFrameHttpUrl,
          endFrameSource: 'prev-scene-cascade' as const,
          endFrameStatus: 'completed' as const,
          endFrameProgress: 100,
          endFrameError: null,
        } : {}),
        endFramePrompt: endPrompt,
        endFramePromptZh: endPromptZh,
        needsEndFrame: true,
        // \u68e3\u69e7 vuốt ve\u6c30\u621e\u5345\u9359\u6827\u6827FU
        imageDataUrl: newFirstFrameImage,
        imageHttpUrl: newFirstFrameHttpUrl,
        imagePrompt: newFirstFramePrompt,
        imagePromptZh: newFirstFramePromptZh,
        imageStatus: 'completed' as const,
        imageProgress: 100,
        imageError: null,
        // Naobu\u6769\u56e8\u6a21\u66e1Đọc lãnh thổ gồ ghề
        ...videoReset,
      };
    });
    
    set({
      projects: {
        ...projects,
        [activeProjectId]: { ...project, splitScenes: updated },
      },
    });
    
    console.log('[DirectorStore] Cascade frames to next scene:', nextSceneId);
  },

  // ========== giải thưởngｆ ==========
  
  setCinematographyProfileId: (profileId) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects[activeProjectId];
    set({
      projects: {
        ...projects,
        [activeProjectId]: {
          ...project,
          cinematographyProfileId: profileId,
        },
      },
    });
    console.log('[DirectorStore] Cinematography profile set to:', profileId);
  },
    }),
    {
      name: 'moyin-director-store',
      storage: createJSONStorage(() => createProjectScopedStorage('director')),
      partialize: (state) => {
        // Helper: strip base64 data from a string field (keep local-image:// and https://)
        const stripBase64 = (val: string | null | undefined): string | null | undefined => {
          if (!val) return val;
          if (typeof val === 'string' && val.startsWith('data:')) return '';
          return val;
        };

        // Strip base64 from SplitScene to avoid 100MB+ JSON persistence
        const stripScene = (s: SplitScene): SplitScene => ({
          ...s,
          imageDataUrl: (stripBase64(s.imageDataUrl) ?? '') as string,
          endFrameImageUrl: stripBase64(s.endFrameImageUrl) as string | null,
          sceneReferenceImage: stripBase64(s.sceneReferenceImage) as string | undefined,
          endFrameSceneReferenceImage: stripBase64(s.endFrameSceneReferenceImage) as string | undefined,
        });

        const pid = state.activeProjectId;
        
        // Only serialize the active project's data (not all projects)
        let projectData = null;
        if (pid && state.projects[pid]) {
          const proj = state.projects[pid];
          projectData = {
            ...proj,
            storyboardImage: (stripBase64(proj.storyboardImage) ?? null) as string | null,
            splitScenes: proj.splitScenes.map(stripScene),
            trailerScenes: proj.trailerScenes.map(stripScene),
          };
        }

        return {
          activeProjectId: pid,
          projectData,
          config: state.config,
          // Don't persist: sceneProgress (Map), UI state
        };
      },
      merge: (persisted: any, current: any) => {
        if (!persisted) return current;
        
        // Legacy format: has `projects` as Record (from old monolithic file)
        if (persisted.projects && typeof persisted.projects === 'object') {
          const normalizedProjects: Record<string, DirectorProjectData> = {};
          for (const [projectId, projectData] of Object.entries(persisted.projects)) {
            normalizedProjects[projectId] = normalizeDirectorProjectData(projectData);
          }
          return {
            ...current,
            ...persisted,
            projects: normalizedProjects,
          };
        }
        
        // New per-project format: has `projectData` for single project
        const { activeProjectId: pid, projectData, config } = persisted;
        const updates: any = { ...current };
        if (config) updates.config = config;
        if (pid) updates.activeProjectId = pid;
        if (pid && projectData) {
          updates.projects = { ...current.projects, [pid]: normalizeDirectorProjectData(projectData) };
        }
        return updates;
      },
    }
  )
);

// ==================== Selectors ====================

/**
 * Get current active project data (for reading splitScenes, storyboardImage, etc.)
 */
export const useActiveDirectorProject = (): DirectorProjectData | null => {
  return useDirectorStore((state) => {
    if (!state.activeProjectId) return null;
    return state.projects[state.activeProjectId] || null;
  });
};

/**
 * Get progress for a specific scene
 */
export const useSceneProgress = (sceneId: number): SceneProgress | undefined => {
  return useDirectorStore((state) => state.sceneProgress.get(sceneId));
};

/**
 * Get overall progress (0-100)
 */
export const useOverallProgress = (): number => {
  return useDirectorStore((state) => {
    const project = state.activeProjectId ? state.projects[state.activeProjectId] : null;
    const screenplay = project?.screenplay || null;
    const { sceneProgress } = state;
    if (!screenplay || screenplay.scenes.length === 0) return 0;
    
    let total = 0;
    for (const scene of screenplay.scenes) {
      const progress = sceneProgress.get(scene.sceneId);
      total += progress?.progress ?? 0;
    }
    return Math.round(total / screenplay.scenes.length);
  });
};

/**
 * Check if any scene is currently generating
 */
export const useIsGenerating = (): boolean => {
  return useDirectorStore((state) => {
    for (const progress of state.sceneProgress.values()) {
      if (progress.status === 'generating') return true;
    }
    return false;
  });
};

/**
 * Get count of completed scenes
 */
export const useCompletedScenesCount = (): number => {
  return useDirectorStore((state) => {
    let count = 0;
    for (const progress of state.sceneProgress.values()) {
      if (progress.status === 'completed') count++;
    }
    return count;
  });
};

/**
 * Get count of failed scenes
 */
export const useFailedScenesCount = (): number => {
  return useDirectorStore((state) => {
    let count = 0;
    for (const progress of state.sceneProgress.values()) {
      if (progress.status === 'failed') count++;
    }
    return count;
  });
};


