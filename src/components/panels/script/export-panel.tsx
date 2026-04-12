// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Export Panel Component
 * UI for exporting shot assets to external video editors
 */

import { useState } from "react";
import type { Shot } from "@/types/script";
import type { ScriptData } from "@/types/script";
import { exportProjectToFolder, exportProjectFiles, getExportStats, type ExportProgress } from "@/lib/script/export-service";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Download,
  FolderOpen,
  Image as ImageIcon,
  Video,
  FileJson,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ExportPanelProps {
  projectName: string;
  scriptData: ScriptData;
  shots: Shot[];
  targetDuration: string;
}

export function ExportPanel({ projectName, scriptData, shots, targetDuration }: ExportPanelProps) {
  const [includeImages, setIncludeImages] = useState(true);
  const [includeVideos, setIncludeVideos] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const stats = getExportStats(shots);

  const handleExportToFolder = async () => {
    if (!stats.canExport) {
      toast.error('\u6ca1Có\u53efXuấtChất liệu');
      return;
    }

    setIsExporting(true);
    setProgress({ current: 0, total: 0, message: '\u51c6\u5907Xuất...' });

    try {
      const success = await exportProjectToFolder(
        {
          projectName: projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_'),
          scriptData,
          shots,
          targetDuration,
          includeImages,
          includeVideos,
          format: 'folder',
        },
        (p) => setProgress(p)
      );

      if (success) {
        toast.success('XuấtHoàn thành！');
      }
    } catch (error) {
      const err = error as Error;
      toast.error(`XuấtThất bại: ${err.message}`);
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  const handleDownloadFiles = async () => {
    if (!stats.canExport) {
      toast.error('\u6ca1Có\u53efXuấtChất liệu');
      return;
    }

    setIsExporting(true);
    setProgress({ current: 0, total: 0, message: 'Chuẩn bị cho T.ải xuống...' });

    try {
      await exportProjectFiles(
        {
          projectName: projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_'),
          scriptData,
          shots,
          targetDuration,
          includeImages,
          includeVideos,
          format: 'folder',
        },
        (p) => setProgress(p)
      );

      toast.success('Tải xuốngHoàn thành！');
    } catch (error) {
      const err = error as Error;
      toast.error(`Tải xuốngThất bại: ${err.message}`);
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">XuấtChất liệu\u5305</h3>
        <span className="text-xs text-muted-foreground">
          Có sẵn\u4e8e\u526a\u6620、PRĐợi đãVideoChỉnh sửa\u8f6f\u4ef6
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded bg-muted/50">
          <div className="text-lg font-semibold">{stats.totalShots}</div>
          <div className="text-xs text-muted-foreground">\u603bCảnh quay</div>
        </div>
        <div className="p-2 rounded bg-muted/50">
          <div className="text-lg font-semibold text-green-500">{stats.imagesReady}</div>
          <div className="text-xs text-muted-foreground">Hình ảnh\u5c31\u7eea</div>
        </div>
        <div className="p-2 rounded bg-muted/50">
          <div className="text-lg font-semibold text-blue-500">{stats.videosReady}</div>
          <div className="text-xs text-muted-foreground">Video\u5c31\u7eea</div>
        </div>
      </div>

      {/* Export options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="include-images" className="flex items-center gap-2 text-sm">
            <ImageIcon className="h-4 w-4" />
            Xuất hình ảnh
            <span className="text-xs text-muted-foreground">({stats.imagesReady})</span>
          </Label>
          <Switch
            id="include-images"
            checked={includeImages}
            onCheckedChange={setIncludeImages}
            disabled={stats.imagesReady === 0 || isExporting}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="include-videos" className="flex items-center gap-2 text-sm">
            <Video className="h-4 w-4" />
            Xuất video
            <span className="text-xs text-muted-foreground">({stats.videosReady})</span>
          </Label>
          <Switch
            id="include-videos"
            checked={includeVideos}
            onCheckedChange={setIncludeVideos}
            disabled={stats.videosReady === 0 || isExporting}
          />
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>{progress.message}</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <Progress value={(progress.current / progress.total) * 100 || 0} className="h-1.5" />
        </div>
      )}

      {/* Export info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1">
          <FileJson className="h-3 w-3" />
          chứa manifest.json \u5143\u6570\u636eTệp
        </div>
        <div>Thư mụcấu trúc c: images/, videos/, manifest.json</div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={handleExportToFolder}
          disabled={!stats.canExport || isExporting || (!includeImages && !includeVideos)}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Xuấttrong...
            </>
          ) : (
            <>
              <FolderOpen className="h-4 w-4 mr-2" />
              \u9009\u62e9Thư mụcXuất
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleDownloadFiles}
          disabled={!stats.canExport || isExporting || (!includeImages && !includeVideos)}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {!stats.canExport && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          \u8bf7đầu tiênTạoCảnh quayHình ảnhhoặcVideo
        </div>
      )}
    </div>
  );
}
