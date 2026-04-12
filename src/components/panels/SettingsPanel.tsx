// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Settings Panel - Unified API Manager v2
 * Provider-based API configuration with multi-key support
 * Based on AionUi's ModelModalContent pattern
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  isVisibleImageHostProvider,
  useAPIConfigStore,
  type IProvider,
  type ImageHostProvider,
  type AIFeature,
} from "@/stores/api-config-store";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useProjectStore } from "@/stores/project-store";
import { useCharacterLibraryStore } from "@/stores/character-library-store";
import { useSceneStore } from "@/stores/scene-store";
import { useMediaStore } from "@/stores/media-store";
import { getApiKeyCount, parseApiKeys, maskApiKey } from "@/lib/api-key-manager";
import { AddProviderDialog, EditProviderDialog, FeatureBindingPanel } from "@/components/api-manager";
import { AddImageHostDialog } from "@/components/image-host-manager/AddImageHostDialog";
import { EditImageHostDialog } from "@/components/image-host-manager/EditImageHostDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  Key,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Shield,
  Check,
  X,
  Loader2,
  MessageSquare,
  Zap,
  ScanEye,
  Info,
  Image,
  RotateCcw,
  Link2,
  Play,
  ShieldAlert,
  Layers,
  Folder,
  HardDrive,
  Download,
  RefreshCw,
  Upload,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uploadToImageHost } from "@/lib/image-host";
import { UpdateDialog } from "@/components/UpdateDialog";
import type { AvailableUpdateInfo } from "@/types/update";
import packageJson from "../../../package.json";

// Platform icon mapping
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  memefast: <Zap className="h-5 w-5" />,
  runninghub: <Image className="h-5 w-5" />,
  custom: <Settings className="h-5 w-5" />,
};

export function SettingsPanel() {
  const {
    providers,
    concurrency,
    advancedOptions,
    imageHostProviders,
    addProvider,
    updateProvider,
    removeProvider,
    addImageHostProvider,
    updateImageHostProvider,
    removeImageHostProvider,
    setConcurrency,
    setAdvancedOption,
    resetAdvancedOptions,
    isImageHostConfigured,
    syncProviderModels,
    setFeatureBindings,
    getFeatureBindings,
  } = useAPIConfigStore();
  const {
    resourceSharing,
    storagePaths,
    cacheSettings,
    updateSettings,
    setResourceSharing,
    setStoragePaths,
    setCacheSettings,
    setUpdateSettings,
  } = useAppSettingsStore();
  const { activeProjectId } = useProjectStore();
  const { assignProjectToUnscoped: assignCharactersToProject } = useCharacterLibraryStore();
  const { assignProjectToUnscoped: assignScenesToProject } = useSceneStore();
  const { assignProjectToUnscoped: assignMediaToProject } = useMediaStore();

  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<IProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [imageHostAddOpen, setImageHostAddOpen] = useState(false);
  const [imageHostEditOpen, setImageHostEditOpen] = useState(false);
  const [editingImageHost, setEditingImageHost] = useState<ImageHostProvider | null>(null);
  const [testingImageHostId, setTestingImageHostId] = useState<string | null>(null);
  const [cacheSize, setCacheSize] = useState(0);
  const [isCacheLoading, setIsCacheLoading] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdateInfo | null>(null);
  const [appVersion, setAppVersion] = useState(packageJson.version);
  const visibleImageHostProviders = useMemo(
    () => imageHostProviders.filter(isVisibleImageHostProvider),
    [imageHostProviders],
  );

  // ====== Memefast \u9ed8\u8ba4\u7ed1\u5b9a\u81ea\u52a8\u8865\u5168 ======
  // \u8986\u76d6\u573a\u666f：
  //  1. \u65e7\u7248\u672cNâng cấp\u540eĐã rồiCó key \u4f46 featureBindings cho\u7a7a
  //  2. \u65e7\u7248\u672c\u7559\u4e0bkhông có\u6548\u7ed1\u5b9a（\u6a21\u578btên\u9519、provider ID thay đổi\u66f4Đợi đã）
  //  3. sử dụng\u6237\u7f16\u8f91\u586b key \u540e\u9875\u9762\u5237mới
  useEffect(() => {
    const mf = providers.find(p => p.platform === 'memefast');
    if (!mf || parseApiKeys(mf.apiKey).length === 0) return;

    const pid = mf.id;
    const models = mf.model || [];
    const defaults: Record<string, string> = {
      script_analysis: `${pid}:deepseek-v3.2`,
      character_generation: `${pid}:gemini-3-pro-image-preview`,
      video_generation: `${pid}:doubao-seedance-1-5-pro-251215`,
      image_understanding: `${pid}:gemini-2.5-flash`,
    };

    // \u68c0\u67e5\u7ed1\u5b9aĐúngKHÔNGCó\u6548
    const isBindingValid = (b: string): boolean => {
      const idx = b.indexOf(':');
      if (idx <= 0) return false;
      const ref = b.slice(0, idx);
      const model = b.slice(idx + 1);
      const p = providers.find(pv => pv.id === ref || pv.platform === ref);
      if (!p || parseApiKeys(p.apiKey).length === 0) return false;
      // \u6a21\u578bdanh sáchcho\u7a7a\u65f6（\u5c1a\u672a\u540c\u6b65）\u6682\u65f6tin tưởng\u7ed1\u5b9a
      if (p.model.length === 0) return true;
      return p.model.includes(model);
    };

    let changed = false;
    for (const [feature, binding] of Object.entries(defaults)) {
      const cur = getFeatureBindings(feature as AIFeature);

      // \u81ea\u6108：deepseek-v3 → deepseek-v3.2（\u5728\u6821\u9a8c\u4e4b\u524dđầu tiên\u8fc1\u79fb）
      if (feature === 'script_analysis' && cur && cur.some(b => b.endsWith(':deepseek-v3'))) {
        const migrated = cur.map(b => {
          if (!b.endsWith(':deepseek-v3')) return b;
          const i = b.indexOf(':');
          return i > 0 ? `${b.slice(0, i)}:deepseek-v3.2` : binding;
        });
        setFeatureBindings(feature as AIFeature, [...new Set(migrated)]);
        changed = true;
        continue;
      }

      // cho\u7a7a hoặc Tất cảkhông có\u6548 → \u91cdmới\u8bbe\u7f6e\u9ed8\u8ba4\u503c
      const needsDefault = !cur || cur.length === 0 || !cur.some(isBindingValid);
      if (needsDefault) {
        setFeatureBindings(feature as AIFeature, [binding]);
        changed = true;
      }
    }
    if (changed) {
      console.log('[SettingsPanel] Auto-applied memefast default bindings');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const version = await window.appUpdater?.getCurrentVersion?.();
        if (!cancelled && version) {
          setAppVersion(version);
        }
      } catch (error) {
        console.warn("[SettingsPanel] Failed to load app version:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Toggle provider expansion
  const toggleExpanded = (id: string) => {
    setExpandedProviders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Open edit dialog
  const handleEdit = (provider: IProvider) => {
    setEditingProvider(provider);
    setEditDialogOpen(true);
  };

  // Delete provider
  const handleDelete = (id: string) => {
    removeProvider(id);
    toast.success("Đã rồi\u5220\u9664\u4f9b\u5e94\u5546");
  };

  const handleEditImageHost = (provider: ImageHostProvider) => {
    setEditingImageHost(provider);
    setImageHostEditOpen(true);
  };

  const handleDeleteImageHost = (id: string) => {
    removeImageHostProvider(id);
    toast.success("Đã rồi\u5220\u9664\u56fegiường");
  };

  const handleTestImageHost = async (provider: ImageHostProvider) => {
    setTestingImageHostId(provider.id);
    try {
      const testImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      const result = await uploadToImageHost(testImage, {
        expiration: 60,
        providerId: provider.id,
      });
      if (result.success) {
        toast.success(`\u56fegiường ${provider.name} \u8fde\u63a5\u6d4b\u8bd5\u6210\u529f`);
      } else {
        toast.error(`\u6d4b\u8bd5\u5931\u8d25: ${result.error || '\u672a\u77e5\u9519\u8bef'}`);
      }
    } catch (error) {
      toast.error('\u8fde\u63a5\u6d4b\u8bd5\u5931\u8d25，Vui lòng kiểm tra mạng');
    } finally {
      setTestingImageHostId(null);
    }
  };

  // Test connection - directly call external APIs
  const testConnection = async (provider: IProvider) => {
    const keys = parseApiKeys(provider.apiKey);
    if (keys.length === 0) {
      toast.error("Vui lòng định cấu hình Khóa API trước");
      return;
    }

    setTestingProvider(provider.id);
    setTestResults((prev) => ({ ...prev, [provider.id]: null }));

    try {
      let response: Response;
      const apiKey = keys[0]; // Use first key for test
      const normalizedBaseUrl = provider.baseUrl?.replace(/\/+$/, "");
      const buildEndpoint = (root: string, path: string) => {
        const normalized = root.replace(/\/+$/, "");
        return /\/v\d+$/.test(normalized) ? `${normalized}/${path}` : `${normalized}/v1/${path}`;
      };

      if (provider.platform === "runninghub") {
        if (!normalizedBaseUrl) {
          toast.error("\u8bf7đầu tiênCấu hình Base URL");
          setTestingProvider(null);
          return;
        }
        response = await fetch(`${normalizedBaseUrl}/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            taskId: "test-connection-check",
          }),
        });
        
        // For RunningHub, 400/404 means auth is OK (task doesn't exist)
        if (response.status === 400 || response.status === 404) {
          setTestResults((prev) => ({ ...prev, [provider.id]: true }));
          toast.success("\u8fde\u63a5\u6d4b\u8bd5\u6210\u529f");
          setTestingProvider(null);
          return;
        }
      } else if (normalizedBaseUrl && provider.model?.length) {
        const endpoint = buildEndpoint(normalizedBaseUrl, "chat/completions");
        const model = provider.model[0];
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 5,
          }),
        });
      } else {
        // For providers without chat endpoint info, just mark as configured
        setTestResults((prev) => ({ ...prev, [provider.id]: true }));
        toast.success(`${provider.name} được cấu hình`);
        setTestingProvider(null);
        return;
      }

      const success = response.ok;
      setTestResults((prev) => ({ ...prev, [provider.id]: success }));

      if (success) {
        toast.success("\u8fde\u63a5\u6d4b\u8bd5\u6210\u529f");
      } else {
        const errorData = await response.text();
        console.error("API test error:", response.status, errorData);
        toast.error(`\u8fde\u63a5\u6d4b\u8bd5\u5931\u8d25 (${response.status})`);
      }
    } catch (error) {
      console.error("Connection test error:", error);
      setTestResults((prev) => ({ ...prev, [provider.id]: false }));
      toast.error("\u8fde\u63a5\u6d4b\u8bd5\u5931\u8d25，Vui lòng kiểm tra mạng");
    } finally {
      setTestingProvider(null);
    }
  };

  // Get existing platforms
  const existingPlatforms = useMemo(
    () => providers.map((p) => p.platform),
    [providers]
  );

  const configuredCount = providers.filter(
    (p) => parseApiKeys(p.apiKey).length > 0
  ).length;

  const [activeTab, setActiveTab] = useState<string>("api");
  const hasStorageManager = typeof window !== "undefined" && !!window.storageManager;
  const hasAppUpdater = typeof window !== "undefined" && !!window.appUpdater;

  const formatBytes = useCallback((bytes: number) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024))
    );
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
  }, []);

  const refreshCacheSize = useCallback(async () => {
    if (!window.storageManager) return;
    setIsCacheLoading(true);
    try {
      const result = await window.storageManager.getCacheSize();
      setCacheSize(result.total || 0);
    } catch (error) {
      console.error("Failed to get cache size:", error);
    } finally {
      setIsCacheLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasStorageManager) return;
    window.storageManager
      ?.getPaths()
      .then((paths) => {
        if (paths.basePath) {
          setStoragePaths({ basePath: paths.basePath });
        }
      })
      .catch(() => {});
    refreshCacheSize();
  }, [hasStorageManager, refreshCacheSize, setStoragePaths]);

  useEffect(() => {
    if (!hasStorageManager || !window.storageManager) return;
    window.storageManager.updateConfig({
      autoCleanEnabled: cacheSettings.autoCleanEnabled,
      autoCleanDays: cacheSettings.autoCleanDays,
    });
  }, [cacheSettings.autoCleanEnabled, cacheSettings.autoCleanDays, hasStorageManager]);

  const handleToggleShareCharacters = async (checked: boolean) => {
    setResourceSharing({ shareCharacters: checked });
    if (!checked && activeProjectId) {
      assignCharactersToProject(activeProjectId);
    }
    // Rehydrate to load/unload other projects' data
    try { await useCharacterLibraryStore.persist.rehydrate(); } catch {}
  };

  const handleToggleShareScenes = async (checked: boolean) => {
    setResourceSharing({ shareScenes: checked });
    if (!checked && activeProjectId) {
      assignScenesToProject(activeProjectId);
    }
    try { await useSceneStore.persist.rehydrate(); } catch {}
  };

  const handleToggleShareMedia = async (checked: boolean) => {
    setResourceSharing({ shareMedia: checked });
    if (!checked && activeProjectId) {
      assignMediaToProject(activeProjectId);
    }
    try { await useMediaStore.persist.rehydrate(); } catch {}
  };

  // Unified storage handlers
  const handleSelectStoragePath = async () => {
    if (!window.storageManager) {
      toast.error("\u8bf7\u5728\u684c\u9762\u5e94sử dụngtrongsử dụng\u6b64chức năng");
      return;
    }
    const dir = await window.storageManager.selectDirectory();
    if (!dir) return;
    const result = await window.storageManager.moveData(dir);
    if (result.success) {
      setStoragePaths({ basePath: result.path || dir });
      
      // \u6e05\u9664 localStorage trongcủabộ nhớ đệm，\u786e\u4fddtừmới\u8def\u5f84\u52a0\u8f7d\u6570\u636e
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('moyin-') || key.includes('store')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // \u6e05\u9664 IndexedDB bộ nhớ đệm
      try {
        const dbRequest = indexedDB.open('moyin-creator-db', 1);
        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          if (db.objectStoreNames.contains('zustand-storage')) {
            const tx = db.transaction('zustand-storage', 'readwrite');
            tx.objectStore('zustand-storage').clear();
          }
        };
      } catch (e) {
        console.warn('Failed to clear IndexedDB:', e);
      }
      
      toast.success("\u5b58\u50a8\u4f4d\u7f6eĐã rồi\u66f4mới，\u6b63\u5728\u5237mới...");
      setTimeout(() => window.location.reload(), 500);
    } else {
      toast.error(`\u79fb\u52a8\u5931\u8d25: ${result.error || "\u672a\u77e5\u9519\u8bef"}`);
    }
  };

  const handleExportData = async () => {
    if (!window.storageManager) return;
    const dir = await window.storageManager.selectDirectory();
    if (!dir) return;
    const result = await window.storageManager.exportData(dir);
    if (result.success) {
      toast.success("\u6570\u636eĐã rồi\u5bfc\u51fa");
    } else {
      toast.error(`\u5bfc\u51fa\u5931\u8d25: ${result.error || "\u672a\u77e5\u9519\u8bef"}`);
    }
  };

  const handleImportData = async () => {
    if (!window.storageManager) return;
    const dir = await window.storageManager.selectDirectory();
    if (!dir) return;
    if (!confirm("\u5bfc\u5165\u5c06\u8986\u76d6hiện tại\u6570\u636e，ĐúngKHÔNGtiếp tục？")) return;
    const result = await window.storageManager.importData(dir);
    if (result.success) {
      // \u6e05\u9664 localStorage trongcủabộ nhớ đệm，\u9632\u6b62\u65e7\u6570\u636e\u8986\u76d6\u5bfc\u5165của\u6570\u636e
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('moyin-') || key.includes('store')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // \u6e05\u9664 IndexedDB bộ nhớ đệm
      try {
        const dbRequest = indexedDB.open('moyin-creator-db', 1);
        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          if (db.objectStoreNames.contains('zustand-storage')) {
            const tx = db.transaction('zustand-storage', 'readwrite');
            tx.objectStore('zustand-storage').clear();
          }
        };
      } catch (e) {
        console.warn('Failed to clear IndexedDB:', e);
      }
      
      toast.success("\u6570\u636eĐã rồi\u5bfc\u5165，\u6b63\u5728\u5237mới...");
      // \u5ef6\u8fdf\u5237mới\u9875\u9762\u4ee5\u786e\u4fddbộ nhớ đệmdọn dẹpHoàn thành
      setTimeout(() => window.location.reload(), 500);
    } else {
      toast.error(`\u5bfc\u5165\u5931\u8d25: ${result.error || "\u672a\u77e5\u9519\u8bef"}`);
    }
  };

  const handleLinkData = async () => {
    if (!window.storageManager) {
      toast.error("\u8bf7\u5728\u684c\u9762\u5e94sử dụngtrongsử dụng\u6b64chức năng");
      return;
    }
    const dir = await window.storageManager.selectDirectory();
    if (!dir) return;
    
    // Validate the directory first
    const validation = await window.storageManager.validateDataDir(dir);
    if (!validation.valid) {
      toast.error(validation.error || "không có\u6548của\u6570\u636e\u76ee\u5f55");
      return;
    }
    
    // Confirm with user
    const confirmMsg = `Phát hiệnĐến ${validation.projectCount || 0} một\u9879\u76ee\u6587\u4ef6，${validation.mediaCount || 0} Chất liệu\u6587\u4ef6。\n\nĐúngKHÔNGchỉ vào\u6b64\u76ee\u5f55？\u64cd\u4f5c\u540e\u5efa\u8bae\u91cd\u542f\u5e94sử dụng。`;
    if (!confirm(confirmMsg)) return;
    
    const result = await window.storageManager.linkData(dir);
    if (result.success) {
      setStoragePaths({ basePath: result.path || dir });
      
      // \u6e05\u9664 localStorage trongcủabộ nhớ đệm，\u786e\u4fddtừmới\u8def\u5f84\u52a0\u8f7d\u6570\u636e
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('moyin-') || key.includes('store')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // \u6e05\u9664 IndexedDB bộ nhớ đệm
      try {
        const dbRequest = indexedDB.open('moyin-creator-db', 1);
        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          if (db.objectStoreNames.contains('zustand-storage')) {
            const tx = db.transaction('zustand-storage', 'readwrite');
            tx.objectStore('zustand-storage').clear();
          }
        };
      } catch (e) {
        console.warn('Failed to clear IndexedDB:', e);
      }
      
      toast.success("Đã rồichỉ vào\u6570\u636e\u76ee\u5f55，\u6b63\u5728\u5237mới...");
      setTimeout(() => window.location.reload(), 500);
    } else {
      toast.error(`\u64cd\u4f5c\u5931\u8d25: ${result.error || "\u672a\u77e5\u9519\u8bef"}`);
    }
  };

  const handleClearCache = async () => {
    if (!window.storageManager) return;
    setIsClearingCache(true);
    try {
      const result = await window.storageManager.clearCache();
      if (result.success) {
        toast.success("bộ nhớ đệmĐã rồidọn dẹp");
        refreshCacheSize();
      } else {
        toast.error(`dọn dẹp\u5931\u8d25: ${result.error || "\u672a\u77e5\u9519\u8bef"}`);
      }
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleCheckForUpdates = async () => {
    if (!window.appUpdater) {
      toast.error("\u8bf7\u5728\u684c\u9762\u5e94sử dụngtrongsử dụng\u6b64chức năng");
      return;
    }

    setIsCheckingForUpdates(true);
    try {
      const result = await window.appUpdater.checkForUpdates();
      if (!result.success) {
        toast.error(`\u68c0\u67e5\u66f4mới\u5931\u8d25: ${result.error || "\u672a\u77e5\u9519\u8bef"}`);
        return;
      }

      if (result.hasUpdate && result.update) {
        setAvailableUpdate(result.update);
        setUpdateDialogOpen(true);
        return;
      }

      setAvailableUpdate(null);
      toast.success(`hiện tạiĐã rồiĐúng\u6700mới\u7248\u672c v${result.currentVersion}`);
    } catch (error) {
      console.error("[SettingsPanel] Failed to check updates:", error);
      toast.error("\u68c0\u67e5\u66f4mới\u5931\u8d25，\u8bf7\u7a0d\u540e\u91cd\u8bd5");
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  const handleClearIgnoredVersion = () => {
    setUpdateSettings({ ignoredVersion: "" });
    toast.success("Đã rồi\u6062\u590d\u66f4mới\u63d0\u9192");
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border bg-panel px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-3">
            <Settings className="w-5 h-5 text-primary" />
            \u8bbe\u7f6e
          </h2>
        </div>
        {activeTab === "api" && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono bg-muted border border-border px-2 py-1 rounded">
              được cấu hình: {configuredCount}/{providers.length}
            </span>
            <Button onClick={() => setAddDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              \u6dfb\u52a0\u4f9b\u5e94\u5546
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-6">
          <TabsList className="h-12 bg-transparent p-0 gap-4">
            <TabsTrigger 
              value="api" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-12"
            >
              <Key className="h-4 w-4 mr-2" />
              API \u7ba1\u7406
            </TabsTrigger>
            <TabsTrigger 
              value="advanced" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-12"
            >
              <Layers className="h-4 w-4 mr-2" />
              \u9ad8\u7ea7\u9009\u9879
            </TabsTrigger>
            <TabsTrigger 
              value="imagehost" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-12"
            >
              <Upload className="h-4 w-4 mr-2" />
              \u56fegiườngCấu hình
              {isImageHostConfigured() && (
                <span className="ml-1 w-2 h-2 bg-green-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="storage" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 h-12"
            >
              <HardDrive className="h-4 w-4 mr-2" />
              \u5b58\u50a8
            </TabsTrigger>
          </TabsList>
        </div>

        {/* API Management Tab */}
        <TabsContent value="api" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-5xl mx-auto space-y-8">
          {/* Security Notice */}
          <div className="flex items-start gap-3 p-4 bg-muted/50 border border-border rounded-lg">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-medium text-foreground text-sm">\u5b89\u5168nói\u660e</h3>
              <p className="text-xs text-muted-foreground mt-1">
                \u6240Có API Key \u4ec5\u5b58\u50a8\u5728\u60a8của\u6d4f\u89c8\u5668\u672c\u5730\u5b58\u50a8trong，sẽ không\u4e0a\u4f20Đến\u4efb\u4f55\u670d\u52a1\u5668。\u652f\u6301Nhiều phím \u8f6e\u6362，\u5931\u8d25\u65f6\u81ea\u52a8\u5207\u6362。
              </p>
            </div>
          </div>

          {/* MemeFast \u8d2d\u4e70\u5f15\u5bfc */}
          <a
            href="https://memefast.top"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-500/5 to-primary/5 border border-orange-500/20 rounded-lg hover:border-orange-500/40 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground text-sm flex items-center gap-2">
                API ma thuật
                <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded">
                  \u63a8\u8350
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                543+ AI \u6a21\u578bmột\u7ad9\u5f0f\u63a5\u5165，\u652f\u6301 GPT / Claude / Gemini / DeepSeek / Sora Đợi đã
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-primary group-hover:underline">
              \u83b7\u53d6 API Key
              <ExternalLink className="h-3.5 w-3.5" />
            </span>
          </a>

          {/* Feature Binding */}
          <FeatureBindingPanel />

          {/* Provider List */}
          <div className="space-y-4">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Key className="h-4 w-4" />
              API \u4f9b\u5e94\u5546
            </h3>

            {providers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl">
                <Info className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  \u5c1aChưa được định cấu hình\u4efb\u4f55\u4f9b\u5e94\u5546
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  \u63a8\u8350sử dụngAPI ma thuật，\u652f\u6301 543+ \u6a21\u578bmột\u7ad9\u5f0f\u63a5\u5165
                </p>
                <a
                  href="https://memefast.top"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-4"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  \u524d\u5f80API ma thuật\u83b7\u53d6 Key
                </a>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  \u6dfb\u52a0\u4f9b\u5e94\u5546
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map((provider) => {
                  const isExpanded = expandedProviders[provider.id] ?? false;
                  const keyCount = getApiKeyCount(provider.apiKey);
                  const configured = keyCount > 0;
                  const testResult = testResults[provider.id];
                  const isTesting = testingProvider === provider.id;

                  return (
                    <Collapsible
                      key={provider.id}
                      open={isExpanded}
                      onOpenChange={() => toggleExpanded(provider.id)}
                    >
                      <div
                        className={cn(
                          "border rounded-xl transition-all",
                          configured
                            ? "bg-card border-primary/30"
                            : "bg-card border-border"
                        )}
                      >
                        {/* Header */}
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-4 hover:bg-muted/30 rounded-t-xl transition-colors">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "p-2 rounded-lg",
                                  configured
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {PLATFORM_ICONS[provider.platform] || (
                                  <Settings className="h-5 w-5" />
                                )}
                              </div>
                              <div className="text-left">
                                <h4 className="font-medium text-foreground flex items-center gap-2">
                                  {provider.name}
                                  {provider.platform === 'memefast' && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded font-normal">
                                      \u63a8\u8350
                                    </span>
                                  )}
                                  {configured && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-normal">
                                      được cấu hình
                                    </span>
                                  )}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {provider.platform}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span
                                  className="cursor-pointer hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpanded(provider.id);
                                  }}
                                >
                                  \u6a21\u578b ({provider.model.length})
                                </span>
                                <span>|</span>
                                <span
                                  className="cursor-pointer hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(provider);
                                  }}
                                >
                                  Key ({keyCount})
                                </span>
                              </div>

                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="\u540c\u6b65\u6a21\u578bdanh sách"
                                  onClick={async () => {
                                    setSyncingProvider(provider.id);
                                    const result = await syncProviderModels(provider.id);
                                    setSyncingProvider(null);
                                    if (result.success) {
                                      toast.success(`Đã rồi\u540c\u6b65 ${result.count} một\u6a21\u578b`);
                                    } else {
                                      toast.error(result.error || '\u540c\u6b65\u5931\u8d25');
                                    }
                                  }}
                                  disabled={!configured || syncingProvider === provider.id}
                                >
                                  {syncingProvider === provider.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="\u6d4b\u8bd5\u8fde\u63a5"
                                  onClick={() => testConnection(provider)}
                                  disabled={!configured || isTesting}
                                >
                                  {isTesting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : testResult === true ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : testResult === false ? (
                                    <X className="h-4 w-4 text-red-500" />
                                  ) : (
                                    <Shield className="h-4 w-4" />
                                  )}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="\u7f16\u8f91"
                                  onClick={() => handleEdit(provider)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        \u786e\u8ba4\u5220\u9664
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        \u786e\u5b9a\u8981\u5220\u9664 {provider.name} \u5417？\u6b64\u64cd\u4f5ckhông có\u6cd5\u64a4\u9500。
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>\u53d6\u6d88</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(provider.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        \u5220\u9664
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>

                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        {/* MemeFast \u8d2d\u4e70\u5f15\u5bfc */}
                        {provider.platform === 'memefast' && !configured && (
                          <div className="px-4 pb-2">
                            <a
                              href="https://memefast.top"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              \u524d\u5f80API ma thuật\u83b7\u53d6 Key →
                            </a>
                          </div>
                        )}

                        {/* Expandable Content */}
                        <CollapsibleContent>
                          <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                            {/* Base URL */}
                            {provider.baseUrl && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">
                                  Base URL:{" "}
                                </span>
                                <span className="font-mono text-foreground">
                                  {provider.baseUrl}
                                </span>
                              </div>
                            )}

                            {/* Models */}
                            {provider.model.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {provider.model.map((m) => (
                                  <span
                                    key={m}
                                    className="text-xs px-2 py-1 bg-muted rounded font-mono"
                                  >
                                    {m}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* API Key Preview */}
                            {configured && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">
                                  API Key:{" "}
                                </span>
                                <span className="font-mono text-foreground">
                                  {maskApiKey(parseApiKeys(provider.apiKey)[0])}
                                  {keyCount > 1 && (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      (+{keyCount - 1} một)
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>

          {/* Global Settings */}
          <div className="p-6 border border-border rounded-xl bg-card space-y-6">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              tình hình chung\u8bbe\u7f6e
            </h3>

            {/* Concurrency */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Đồng thời\u751f\u6210\u6570</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  value={concurrency}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1) setConcurrency(val);
                  }}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">
                  \u540c\u65f6\u751f\u6210củaNhiệm vụ\u6570\u91cf（Nhiều phím \u65f6\u53ef\u8bbe\u7f6e\u66f4\u9ad8，\u5efa\u8bae\u4e0d\u8d85\u8fc7 Key \u6570\u91cf）
                </span>
              </div>
            </div>
          </div>

              {/* About */}
              <div className="text-center py-8 text-muted-foreground border-t border-border">
                <p className="text-sm font-medium">Sáng tạo truyện tranh Mo Yin Moyin Creator</p>
                <p className="text-xs mt-1">v{appVersion} · Hoạt hình do AI điều khiển\u89c6\u9891\u521b\u4f5c\u5de5\u5177</p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Advanced Options Tab */}
        <TabsContent value="advanced" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-3xl mx-auto space-y-8">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    \u9ad8\u7ea7\u751f\u6210\u9009\u9879
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    \u8fd9\u4e9b\u9009\u9879\u5f71\u54cd AI giám đốc\u677f\u5757của\u89c6\u9891\u751f\u6210hành vi
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    resetAdvancedOptions();
                    toast.success("Đã rồi\u6062\u590d\u9ed8\u8ba4\u8bbe\u7f6e");
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  \u6062\u590d\u9ed8\u8ba4
                </Button>
              </div>

              {/* Options List */}
              <div className="space-y-4">
                {/* Visual Continuity */}
                <div className="p-4 border border-border rounded-xl bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                        <Link2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">tính liên tục về mặt thị giác</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          \u81ea\u52a8\u5c06\u4e0amột\u5206\u955ccủa\u5c3e\u5e27\u4f20\u9012\u7ed9\u4e0bmột\u5206\u955c\u4f5cchoHình ảnh tham khảo，giữ\u89c6\u89c9gió\u683cvà\u89d2\u8272Bên ngoài\u89c2củamột\u81f4\u6027
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          \u63a8\u8350\u5f00\u542f · \u9002\u5408\u8fde\u7eed\u53d9\u4e8bvà\u957f\u89c6\u9891\u521b\u4f5c
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={advancedOptions.enableVisualContinuity}
                      onCheckedChange={(checked) => setAdvancedOption('enableVisualContinuity', checked)}
                    />
                  </div>
                </div>

                {/* Resume Generation */}
                <div className="p-4 border border-border rounded-xl bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                        <Play className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">\u65ad\u70b9\u7eed\u4f20</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          lô\u91cf\u751f\u6210trong\u65ad\u540e\u53eftừ\u4e0alần\u4f4d\u7f6etiếp tục，\u4e0d\u9700\u8981\u91cdmới\u5f00\u59cb
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          \u63a8\u8350\u5f00\u542f · \u9632\u6b62\u7f51\u7edctrong\u65adhoặc API \u8d85\u65f6\u5bfc\u81f4\u8fdb\u5ea6\u4e22\u5931
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={advancedOptions.enableResumeGeneration}
                      onCheckedChange={(checked) => setAdvancedOption('enableResumeGeneration', checked)}
                    />
                  </div>
                </div>

                {/* Content Moderation */}
                <div className="p-4 border border-border rounded-xl bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">bên trong\u5bb9\u5ba1\u6838\u5bb9\u9519</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          \u9047Đến\u654f\u611fbên trong\u5bb9\u65f6\u81ea\u52a8bỏ qua\u8be5\u5206\u955c，tiếp tục\u751f\u6210\u5176\u4ed6\u5206\u955c
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          \u63a8\u8350\u5f00\u542f · \u907f\u514d\u5355một\u5206\u955c\u5931\u8d25\u5bfc\u81f4\u6574mộtquá trìnhtrong\u65ad
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={advancedOptions.enableContentModeration}
                      onCheckedChange={(checked) => setAdvancedOption('enableContentModeration', checked)}
                    />
                  </div>
                </div>

                {/* Auto Model Switch */}
                <div className="p-4 border border-border rounded-xl bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted text-muted-foreground mt-0.5">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">\u591a\u6a21\u578b\u81ea\u52a8\u5207\u6362</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          \u9996\u5206\u955csử dụng\u6587\u751f\u89c6\u9891 (t2v)，\u540e\u7eed\u5206\u955csử dụng\u56fe\u751f\u89c6\u9891 (i2v)
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          \u9ed8\u8ba4\u5173\u95ed · \u9700\u8981Cấu hình\u591amột\u6a21\u578b\u624d\u80fdsử dụng
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={advancedOptions.enableAutoModelSwitch}
                      onCheckedChange={(checked) => setAdvancedOption('enableAutoModelSwitch', checked)}
                    />
                  </div>
                </div>
              </div>

              {/* Info Notice */}
              <div className="flex items-start gap-3 p-4 bg-muted/50 border border-border rounded-lg">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    \u8fd9\u4e9b\u9009\u9879\u4f1a\u5f71\u54cd AI giám đốc\u677f\u5757của\u89c6\u9891\u751f\u6210hành vi。Chẳng hạn như\u679c\u4f60\u4e0d\u786e\u5b9a\u67d0một\u9009\u9879của\u4f5csử dụng，\u5efa\u8baegiữ\u9ed8\u8ba4\u8bbe\u7f6e。
                  </p>
                </div>
              </div>

              {/* About */}
              <div className="text-center py-8 text-muted-foreground border-t border-border">
                <p className="text-sm font-medium">Sáng tạo truyện tranh Mo Yin Moyin Creator</p>
                <p className="text-xs mt-1">v{appVersion} · Hoạt hình do AI điều khiển\u89c6\u9891\u521b\u4f5c\u5de5\u5177</p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Image Host Config Tab */}
        <TabsContent value="imagehost" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-3xl mx-auto space-y-8">
              {/* Header */}
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  \u56fegiườngCấu hình
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  \u56fegiườngsử dụng\u4e8e\u5b58\u50a8\u89c6\u9891\u751f\u6210\u8fc7\u7a0btrongcủa\u4e34\u65f6\u56fe\u7247（Chẳng hạn như\u5c3e\u5e27Trích xuất、\u5e27\u4f20\u9012Đợi đã）
                </p>
              </div>

              {/* Image Host Providers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">\u56fegiường\u670d\u52a1\u5546</Label>
                  <Button size="sm" variant="outline" onClick={() => setImageHostAddOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    \u6dfb\u52a0
                  </Button>
                </div>

                {visibleImageHostProviders.length === 0 ? (
                  <div className="text-sm text-muted-foreground">\u6682không có\u56fegiườngCấu hình</div>
                ) : (
                  <div className="space-y-3">
                    {visibleImageHostProviders.map((provider) => {
                      const keyCount = getApiKeyCount(provider.apiKey);
                      const endpoint = provider.uploadPath || provider.baseUrl;
                      const configured = provider.enabled && !!endpoint && (provider.apiKeyOptional || keyCount > 0);
                      return (
                        <div key={provider.id} className="p-4 border border-border rounded-xl bg-card space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{provider.name}</span>
                                {configured ? (
                                  <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded">
                                    được cấu hình
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                                    Chưa được định cấu hình
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {provider.platform} · {endpoint || '\u672a\u8bbe\u7f6e\u5730\u5740'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {provider.apiKeyOptional && keyCount === 0
                                  ? "\u6e38\u5ba2\u4e0a\u4f20（không có\u9700 Key）"
                                  : `${keyCount} một Key`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={provider.enabled}
                                onCheckedChange={(checked) =>
                                  updateImageHostProvider({ ...provider, enabled: checked })
                                }
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!provider.enabled || testingImageHostId === provider.id}
                              onClick={() => handleTestImageHost(provider)}
                            >
                              {testingImageHostId === provider.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "\u6d4b\u8bd5\u8fde\u63a5"
                              )}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditImageHost(provider)}>
                              \u7f16\u8f91
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteImageHost(provider.id)}>
                              \u5220\u9664
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info Notice */}
              <div className="flex items-start gap-3 p-4 bg-muted/50 border border-border rounded-lg">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    \u56fegiườngsử dụng\u4e8e\u5b58\u50a8\u89c6\u9891\u751f\u6210\u8fc7\u7a0btrongcủa\u4e34\u65f6\u56fe\u7247，chínhsử dụng\u4e8e「tính liên tục về mặt thị giác」chức năng。
                    Chẳng hạn như\u679c\u4e0dCấu hình\u56fegiường，\u8de8\u5206\u955ccủa\u5e27\u4f20\u9012chức năng\u5c06\u53d7\u9650。
                    \u542fsử dụng\u591amột\u56fegiường\u4f1atheo thứ tự\u8f6e\u6d41sử dụng，\u5931\u8d25\u81ea\u52a8\u5207\u6362。
                  </p>
                  <p className="text-sm">
                    \u9ed8\u8ba4Đã rồi\u542fsử dụng SCDN \u56fegiường，\u4e0d\u9700\u8981\u586b\u5199KEY；
                    ImgBB \u9ed8\u8ba4giữ\u5173\u95ed，Chẳng hạn như\u9700sử dụng\u8bf7tay\u52a8\u5f00\u542f\u5e76\u81eađược rồi\u6d4b\u8bd5Có sẵn\u6027。
                  </p>
                </div>
              </div>

              {/* About */}
              <div className="text-center py-8 text-muted-foreground border-t border-border">
                <p className="text-sm font-medium">Sáng tạo truyện tranh Mo Yin Moyin Creator</p>
                <p className="text-xs mt-1">v{appVersion} · Hoạt hình do AI điều khiển\u89c6\u9891\u521b\u4f5c\u5de5\u5177</p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-8 max-w-3xl mx-auto space-y-8">
              {/* Header */}
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  \u5b58\u50a8\u8bbe\u7f6e
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  \u8bbe\u7f6e\u8d44\u6e90tổng cộng\u4eabChiến lược、\u5b58\u50a8\u4f4d\u7f6evớibộ nhớ đệm\u7ba1\u7406
                </p>
              </div>

              {!hasStorageManager && (
                <div className="flex items-start gap-3 p-4 bg-muted/50 border border-border rounded-lg">
                  <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      \u5b58\u50a8\u8bbe\u7f6e\u4ec5\u5728\u684c\u9762\u7248trongCó sẵn。
                    </p>
                  </div>
                </div>
              )}

              {/* Resource Sharing */}
              <div className="p-6 border border-border rounded-xl bg-card space-y-4">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  \u8d44\u6e90tổng cộng\u4eab
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">\u89d2\u8272\u5e93\u8de8\u9879\u76eetổng cộng\u4eab</p>
                    <p className="text-xs text-muted-foreground">\u5173\u95ed\u540e，\u4ec5hiện tại\u9879\u76ee\u53ef\u89c1</p>
                  </div>
                  <Switch
                    checked={resourceSharing.shareCharacters}
                    onCheckedChange={handleToggleShareCharacters}
                    disabled={!hasStorageManager}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">\u573a\u666f\u5e93\u8de8\u9879\u76eetổng cộng\u4eab</p>
                    <p className="text-xs text-muted-foreground">\u5173\u95ed\u540e，\u4ec5hiện tại\u9879\u76ee\u53ef\u89c1</p>
                  </div>
                  <Switch
                    checked={resourceSharing.shareScenes}
                    onCheckedChange={handleToggleShareScenes}
                    disabled={!hasStorageManager}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Chất liệu\u5e93\u8de8\u9879\u76eetổng cộng\u4eab</p>
                    <p className="text-xs text-muted-foreground">\u5173\u95ed\u540e，\u4ec5hiện tại\u9879\u76ee\u53ef\u89c1</p>
                  </div>
                  <Switch
                    checked={resourceSharing.shareMedia}
                    onCheckedChange={handleToggleShareMedia}
                    disabled={!hasStorageManager}
                  />
                </div>
              </div>

              {/* Storage Path - Single unified location */}
              <div className="p-6 border border-border rounded-xl bg-card space-y-5">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  \u5b58\u50a8\u4f4d\u7f6e
                </h4>

                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">\u6570\u636e\u5b58\u50a8\u4f4d\u7f6e（chứa\u9879\u76eevàChất liệu）</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={storagePaths.basePath || '\u9ed8\u8ba4\u4f4d\u7f6e'}
                      placeholder="\u9ed8\u8ba4\u4f4d\u7f6e"
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button size="sm" onClick={handleSelectStoragePath} disabled={!hasStorageManager}>
                      \u9009\u62e9
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportData} disabled={!hasStorageManager}>
                      <Download className="h-3.5 w-3.5 mr-1" />
                      \u5bfc\u51fa
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleImportData} disabled={!hasStorageManager}>
                      \u5bfc\u5165
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  ⚠️ \u66f4\u6539\u4f4d\u7f6e\u4f1a\u79fb\u52a8\u73b0Có\u6570\u636eĐếnmới\u76ee\u5f55（\u81ea\u52a8\u521b\u5efa projects/ và media/ \u5b50\u76ee\u5f55）
                </p>
              </div>

              {/* Data Recovery - Link to existing data */}
              <div className="p-6 border border-border rounded-xl bg-card space-y-4">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  \u6570\u636e\u6062\u590d
                </h4>
                <p className="text-sm text-muted-foreground">
                  \u6362\u8bbe\u5907hoặc\u91cd\u88c5\u7cfb\u7edf\u540e，chỉ vàoĐã rồiCó\u6570\u636e\u76ee\u5f55\u5373\u53ef\u6062\u590d\u6240CóCấu hìnhvà\u9879\u76ee
                </p>

                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLinkData} 
                    disabled={!hasStorageManager}
                    className="w-full"
                  >
                    <Folder className="h-3.5 w-3.5 mr-1" />
                    chỉ vàoĐã rồiCó\u6570\u636e\u76ee\u5f55
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    💡 \u9009\u62e9chứa projects/ và media/ \u5b50\u76ee\u5f55của\u6570\u636e\u76ee\u5f55，\u64cd\u4f5c\u540e\u91cd\u542f\u5e94sử dụng。
                  </p>
                </div>
              </div>

              {/* Cache Management */}
              <div className="p-6 border border-border rounded-xl bg-card space-y-4">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  bộ nhớ đệm\u7ba1\u7406
                </h4>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">bộ nhớ đệm\u5927\u5c0f</p>
                    <p className="text-xs text-muted-foreground">
                      {isCacheLoading ? "Tính toántrong..." : formatBytes(cacheSize)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={refreshCacheSize}
                      disabled={!hasStorageManager || isCacheLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isCacheLoading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearCache}
                      disabled={!hasStorageManager || isClearingCache}
                    >
                      {isClearingCache ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "dọn dẹp"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">\u81ea\u52a8dọn dẹp</p>
                    <p className="text-xs text-muted-foreground">\u9ed8\u8ba4\u5173\u95ed</p>
                  </div>
                  <Switch
                    checked={cacheSettings.autoCleanEnabled}
                    onCheckedChange={(checked) => setCacheSettings({ autoCleanEnabled: checked })}
                    disabled={!hasStorageManager}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">dọn dẹp</Label>
                  <Input
                    type="number"
                    min={1}
                    value={cacheSettings.autoCleanDays}
                    onChange={(e) =>
                      setCacheSettings({ autoCleanDays: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="w-20"
                    disabled={!cacheSettings.autoCleanEnabled}
                  />
                  <span className="text-xs text-muted-foreground">\u5929\u524dcủabộ nhớ đệm\u6587\u4ef6</span>
                </div>
              </div>

              <div className="p-6 border border-border rounded-xl bg-card space-y-5">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  \u5e94sử dụng\u66f4mới
                </h4>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">hiện tại\u7248\u672c</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">v{appVersion}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckForUpdates}
                    disabled={!hasAppUpdater || isCheckingForUpdates}
                  >
                    {isCheckingForUpdates ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    \u68c0\u67e5\u66f4mới
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">\u542f\u52a8\u65f6\u81ea\u52a8\u68c0\u67e5\u66f4mới</p>
                    <p className="text-xs text-muted-foreground">
                      \u5f00\u542f\u540e，\u684c\u9762\u7248\u542f\u52a8\u65f6\u4f1a\u81ea\u52a8\u68c0\u67e5xa\u7a0b\u7248\u672c\u6e05\u5355\u5e76\u63d0\u793amới\u7248\u672c
                    </p>
                  </div>
                  <Switch
                    checked={updateSettings.autoCheckEnabled}
                    onCheckedChange={(checked) => setUpdateSettings({ autoCheckEnabled: checked })}
                    disabled={!hasAppUpdater}
                  />
                </div>

                {updateSettings.ignoredVersion && (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Đã rồi\u5ffd\u7565\u7248\u672c</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        v{updateSettings.ignoredVersion}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClearIgnoredVersion}>
                      \u6062\u590d\u63d0\u9192
                    </Button>
                  </div>
                )}

                {!hasAppUpdater && (
                  <p className="text-xs text-muted-foreground">
                    \u6b64chức năng\u4ec5\u5728\u684c\u9762\u6253\u5305\u7248trongCó sẵn。
                  </p>
                )}
              </div>

              {/* About */}
              <div className="text-center py-8 text-muted-foreground border-t border-border">
                <p className="text-sm font-medium">Sáng tạo truyện tranh Mo Yin Moyin Creator</p>
                <p className="text-xs mt-1">v{appVersion} · Hoạt hình do AI điều khiển\u89c6\u9891\u521b\u4f5c\u5de5\u5177</p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddProviderDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={(providerData) => {
          // API ma thuật：Đã rồi\u5b58\u5728\u65f6\u5408\u5e76 Key，\u4e0d\u91cd\u590d\u521b\u5efa
          const existingMemefast = providerData.platform === 'memefast'
            ? providers.find((p) => p.platform === 'memefast')
            : null;
          let provider: IProvider;
          if (existingMemefast) {
            const oldKeys = parseApiKeys(existingMemefast.apiKey);
            const newKeys = parseApiKeys(providerData.apiKey);
            const merged = Array.from(new Set([...oldKeys, ...newKeys]));
            updateProvider({ ...existingMemefast, apiKey: merged.join(',') });
            provider = existingMemefast;
          } else {
            provider = addProvider(providerData);
          }
          // Chẳng hạn như\u679c\u6dfb\u52a0củaĐúng memefast \u4f9b\u5e94\u5546，\u81ea\u52a8\u8bbe\u7f6e\u9ed8\u8ba4\u670d\u52a1\u6620\u5c04（\u4ec5\u5728\u5bf9\u5e94\u670d\u52a1\u5c1aChưa được định cấu hình\u65f6）
          if (providerData.platform === 'memefast') {
            // sử dụng provider.id（\u800c\u975e platform chuỗi）\u907f\u514d\u591a\u4f9b\u5e94\u5546\u65f6của\u6b67\u4e49phân tích cú pháp
            const pid = provider.id;
            const MEMEFAST_DEFAULT_BINDINGS: Record<string, string> = {
              // NOTE: MemeFast \u7aef\u70b9Đã rồiNâng cấp，\u65e7của deepseek-v3 Đã rồi\u4e0d\u5728danh sáchtrong，\u6539sử dụng deepseek-v3.2
              script_analysis: `${pid}:deepseek-v3.2`,
              character_generation: `${pid}:gemini-3-pro-image-preview`,
              video_generation: `${pid}:doubao-seedance-1-5-pro-251215`,
              image_understanding: `${pid}:gemini-2.5-flash`,
            };
            for (const [feature, binding] of Object.entries(MEMEFAST_DEFAULT_BINDINGS)) {
              const current = getFeatureBindings(feature as AIFeature);
              // \u4ec5\u5728Chưa được định cấu hình\u65f6\u8bbe\u7f6e\u9ed8\u8ba4\u503c，\u907f\u514d\u8986\u76d6sử dụng\u6237tay\u52a8\u9009\u62e9
              if (!current || current.length === 0) {
                setFeatureBindings(feature as AIFeature, [binding]);
                continue;
              }
              // \u81ea\u6108：\u65e7\u9ed8\u8ba4 deepseek-v3 -> deepseek-v3.2（\u5c3d\u91cf\u4e0d\u7834\u574fNhiều lựa chọnCấu hình）
              if (feature === 'script_analysis') {
                const hasOld = current.some((b) => b.endsWith(':deepseek-v3'));
                if (hasOld) {
                  const migrated = current.map((b) => {
                    if (!b.endsWith(':deepseek-v3')) return b;
                    const idx = b.indexOf(':');
                    if (idx <= 0) return binding;
                    const prefix = b.slice(0, idx);
                    return `${prefix}:deepseek-v3.2`;
                  });
                  const deduped = Array.from(new Set(migrated));
                  setFeatureBindings(feature as AIFeature, deduped);
                }
              }
            }
          }
          // \u6dfb\u52a0\u540e\u81ea\u52a8\u540c\u6b65\u6a21\u578bdanh sáchvà\u7aef\u70b9\u5143\u6570\u636e
          const finalProviderId = existingMemefast ? existingMemefast.id : provider.id;
          if (parseApiKeys(providerData.apiKey).length > 0) {
            setSyncingProvider(finalProviderId);
            syncProviderModels(finalProviderId).then(result => {
              setSyncingProvider(null);
              if (result.success) {
                toast.success(`Đã rồi\u81ea\u52a8\u540c\u6b65 ${result.count} một\u6a21\u578b`);
              } else if (result.error) {
                toast.error(`\u6a21\u578b\u540c\u6b65\u5931\u8d25: ${result.error}`);
              }
            });
          }
        }}
        existingPlatforms={existingPlatforms}
      />

      <EditProviderDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        provider={editingProvider}
        onSave={(provider) => {
          updateProvider(provider);

          // \u7f16\u8f91 memefast \u65f6\u4e5f\u81ea\u52a8\u8bbe\u7f6e\u9ed8\u8ba4\u670d\u52a1\u6620\u5c04：\u521d\u59cb\u72b6\u6001\u4f1a\u9884\u7f6emộtmột\u7a7a key của memefast，
          // sử dụng\u6237\u901a\u5e38Đúng“\u7f16\u8f91\u586b key”，Chẳng hạn như\u679c\u4e0d\u5728\u8fd9\u91cc\u8865\u9ed8\u8ba4\u6620\u5c04，\u4f1a\u5bfc\u81f4\u670d\u52a1\u6620\u5c04một\u76f4Đúng 0/6。
          if (provider.platform === 'memefast' && parseApiKeys(provider.apiKey).length > 0) {
            const pid = provider.id;
            const MEMEFAST_DEFAULT_BINDINGS: Record<string, string> = {
              // NOTE: MemeFast \u7aef\u70b9Đã rồiNâng cấp，\u65e7của deepseek-v3 Đã rồi\u4e0d\u5728danh sáchtrong，\u6539sử dụng deepseek-v3.2
              script_analysis: `${pid}:deepseek-v3.2`,
              character_generation: `${pid}:gemini-3-pro-image-preview`,
              video_generation: `${pid}:doubao-seedance-1-5-pro-251215`,
              image_understanding: `${pid}:gemini-2.5-flash`,
            };
            for (const [feature, binding] of Object.entries(MEMEFAST_DEFAULT_BINDINGS)) {
              const current = getFeatureBindings(feature as AIFeature);
              if (!current || current.length === 0) {
                setFeatureBindings(feature as AIFeature, [binding]);
                continue;
              }
              // \u81ea\u6108：\u65e7\u9ed8\u8ba4 deepseek-v3 -> deepseek-v3.2
              if (feature === 'script_analysis') {
                const hasOld = current.some((b) => b.endsWith(':deepseek-v3'));
                if (hasOld) {
                  const migrated = current.map((b) => {
                    if (!b.endsWith(':deepseek-v3')) return b;
                    const idx = b.indexOf(':');
                    if (idx <= 0) return binding;
                    const prefix = b.slice(0, idx);
                    return `${prefix}:deepseek-v3.2`;
                  });
                  const deduped = Array.from(new Set(migrated));
                  setFeatureBindings(feature as AIFeature, deduped);
                }
              }
            }
          }
          // \u7f16\u8f91\u4fdd\u5b58\u540e\u81ea\u52a8\u540c\u6b65\u6a21\u578bdanh sáchvà\u7aef\u70b9\u5143\u6570\u636e
          if (parseApiKeys(provider.apiKey).length > 0) {
            setSyncingProvider(provider.id);
            syncProviderModels(provider.id).then(result => {
              setSyncingProvider(null);
              if (result.success) {
                toast.success(`Đã rồi\u81ea\u52a8\u540c\u6b65 ${result.count} một\u6a21\u578b`);
              } else if (result.error) {
                toast.error(`\u6a21\u578b\u540c\u6b65\u5931\u8d25: ${result.error}`);
              }
            });
          }
        }}
      />

      <AddImageHostDialog
        open={imageHostAddOpen}
        onOpenChange={setImageHostAddOpen}
        onSubmit={addImageHostProvider}
      />

      <EditImageHostDialog
        open={imageHostEditOpen}
        onOpenChange={setImageHostEditOpen}
        provider={editingImageHost}
        onSave={updateImageHostProvider}
      />
      <UpdateDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        updateInfo={availableUpdate}
        onIgnoreVersion={(version) => {
          setUpdateSettings({ ignoredVersion: version });
          setAvailableUpdate(null);
        }}
      />
    </div>
  );
}
