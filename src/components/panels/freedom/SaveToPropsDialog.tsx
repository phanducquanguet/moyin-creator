// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.

/**
 * SaveToPropsDialog - LưuHình ảnhĐếnThư viện đạo cụ\u5f39cửa sổ
 * \u5728Hình ảnh\u5de5\u4f5c\u5ba4Tạo hình ảnh\u540e，Người dùng\u53ef\u4ee5\u9009\u62e9Thư mục\u5e76Lưu
 */

import { useState } from 'react';
import { usePropsLibraryStore } from '@/stores/props-library-store';
import { saveImageToLocal } from '@/lib/image-storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { FolderOpen, FolderPlus, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SaveToPropsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** \u5f85LưuHình ảnhURL（\u53ef\u80fd\u662fxa\u7a0bURL） */
  imageUrl: string;
  /** TạNhắc tại o，Tùy chọn */
  prompt?: string;
}

export function SaveToPropsDialog({
  open,
  onOpenChange,
  imageUrl,
  prompt = '',
}: SaveToPropsDialogProps) {
  const { folders, addProp, addFolder, setSelectedFolderId } =
    usePropsLibraryStore();

  const [propName, setPropName] = useState('');
  const [selectedFolderId, setLocalFolderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const folder = addFolder(trimmed);
    setLocalFolderId(folder.id);
    setNewFolderName('');
    setNewFolderMode(false);
    toast.success(`Thư mục「${trimmed}」Đã Tạo`);
  };

  const handleSave = async () => {
    const name = propName.trim() || `đạo cụ_${Date.now()}`;
    setSaving(true);
    try {
      // \u5c1d\u8bd5\u6301\u4e45\u5316Đến\u672c\u5730\u5b58\u50a8（Electron），\u6d4f\u89c8\u5668\u7aef\u56de\u9000chonguyên bảnURL
      const localPath = await saveImageToLocal(
        imageUrl,
        'props',
        `prop_${Date.now()}.png`
      );
      addProp({
        name,
        imageUrl: localPath,
        prompt,
        folderId: selectedFolderId,
      });
      // \u540c\u6b65Thư viện đạo cụ\u4fa7\u8fb9\u680f\u9009trongTrạng thái（\u8df3\u8f6cĐếnĐíchThư mục）
      setSelectedFolderId(selectedFolderId ?? 'all');
      toast.success(`「${name}」Đã LưuĐếnThư viện đạo cụ`);
      onOpenChange(false);
      // Đặt lại\u8868\u5355
      setPropName('');
      setLocalFolderId(null);
    } catch (err: any) {
      toast.error(`LưuThất bại：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onOpenChange(false);
    setPropName('');
    setLocalFolderId(null);
    setNewFolderMode(false);
    setNewFolderName('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            LưuĐếnThư viện đạo cụ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Hình ảnhXem trước */}
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-lg border border-border bg-muted overflow-hidden">
              <img
                src={imageUrl}
                alt="Xem trước"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Dự luật Tên */}
          <div className="space-y-1.5">
            <Label htmlFor="prop-name" className="text-xs">
              Dự luật Tên
            </Label>
            <Input
              id="prop-name"
              placeholder="Đầu vàoDự luật Tên（\u53efĐể trống\u81ea\u52a8\u547dtên）"
              value={propName}
              onChange={(e) => setPropName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !saving) handleSave();
              }}
            />
          </div>

          {/* \u9009\u62e9Thư mục */}
          <div className="space-y-1.5">
            <Label className="text-xs">LưuĐếnThư mục</Label>
            <ScrollArea className="max-h-40 rounded-md border border-border">
              <div className="p-1.5 space-y-0.5">
                {/* gốc thư mục */}
                <button
                  className={cn(
                    'flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors',
                    selectedFolderId === null
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                  onClick={() => setLocalFolderId(null)}
                >
                  <Package className="h-3.5 w-3.5 shrink-0" />
                  gốc thư mục（\u4e0d\u5206\u7c7b）
                </button>

                {/* Người dùngThư mục */}
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    className={cn(
                      'flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors',
                      selectedFolderId === folder.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                    onClick={() => setLocalFolderId(folder.id)}
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    {folder.name}
                  </button>
                ))}

                {/* Tạo mớiThư mụcđược rồibên trongĐầu vào */}
                {newFolderMode ? (
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <FolderPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Input
                      autoFocus
                      placeholder="Thư mụcTên..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') {
                          setNewFolderMode(false);
                          setNewFolderName('');
                        }
                      }}
                      className="h-6 text-xs px-1.5 flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim()}
                    >
                      Xác nhận
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setNewFolderMode(false);
                        setNewFolderName('');
                      }}
                    >
                      Huỷ
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border mt-1 pt-2"
                    onClick={() => setNewFolderMode(true)}
                  >
                    <FolderPlus className="h-3.5 w-3.5 shrink-0" />
                    + Tạo mớiThư mục
                  </button>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Lưutrong...
              </>
            ) : (
              <>
                <Package className="mr-2 h-4 w-4" />
                Lưu
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
