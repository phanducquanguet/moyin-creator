// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.

/**
 * PropsLibrary - đạo cụ\u5e93Chúa ơi\u89c6\u56fe
 * \u5de6\u4fa7\u76ee\u5f55cây + bên phảiđạo cụ\u7f51\u683c，\u652f\u6301\u81ea\u5b9a\u4e49\u76ee\u5f55\u7ba1\u7406
 */

import { useState, useRef } from 'react';
import { usePropsLibraryStore, PropItem, PropFolder } from '@/stores/props-library-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  MoveRight,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { useResolvedImageUrl } from '@/hooks/use-resolved-image-url';

// ── PropCard \u5b50\u7ec4\u4ef6 ──────────────────────────────────────────────────────────

function PropCard({ item }: { item: PropItem }) {
  const { deleteProp, renameProp, moveProp, folders } = usePropsLibraryStore();
  const resolvedUrl = useResolvedImageUrl(item.imageUrl);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(item.name);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const handleRenameConfirm = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    renameProp(item.id, trimmed);
    setRenaming(false);
  };

  return (
    <>
      <div className="group relative flex flex-col rounded-lg border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
        {/* \u56fe\u7247Quận */}
        <div className="aspect-square bg-muted relative overflow-hidden">
          {resolvedUrl ? (
            <img
              src={resolvedUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground/40" />
            </div>
          )}
          {/* \u60ac\u6d6e\u64cd\u4f5c\u83dc\u5355 */}
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 rounded-md shadow-md"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => { setNameInput(item.name); setRenaming(true); }}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  \u91cd\u547dtên
                </DropdownMenuItem>
                {/* \u79fb\u52a8Đến\u76ee\u5f55 */}
                {folders.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground py-1">
                      \u79fb\u52a8Đến\u76ee\u5f55
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => moveProp(item.id, null)}
                      className={cn(item.folderId === null && 'text-primary')}
                    >
                      <Layers className="mr-2 h-3.5 w-3.5" />
                      \u6839\u76ee\u5f55
                    </DropdownMenuItem>
                    {folders.map((f) => (
                      <DropdownMenuItem
                        key={f.id}
                        onClick={() => moveProp(item.id, f.id)}
                        className={cn(item.folderId === f.id && 'text-primary')}
                      >
                        <MoveRight className="mr-2 h-3.5 w-3.5" />
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteAlert(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  \u5220\u9664
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* tên\u79f0Quận */}
        <div className="px-2 py-1.5">
          {renaming ? (
            <Input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleRenameConfirm}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="h-6 text-xs px-1 py-0"
            />
          ) : (
            <p
              className="text-xs text-foreground truncate cursor-default"
              onDoubleClick={() => { setNameInput(item.name); setRenaming(true); }}
              title={item.name}
            >
              {item.name}
            </p>
          )}
        </div>
      </div>

      {/* \u5220\u9664\u786e\u8ba4 */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>\u5220\u9664đạo cụ</AlertDialogTitle>
            <AlertDialogDescription>
              \u786e\u8ba4\u5220\u9664「{item.name}」？\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>\u53d6\u6d88</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteProp(item.id);
                toast.success(`Đã rồi\u5220\u9664「${item.name}」`);
              }}
            >
              \u5220\u9664
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── FolderItem \u5b50\u7ec4\u4ef6 ────────────────────────────────────────────────────────

function FolderItem({
  folder,
  isActive,
  onClick,
}: {
  folder: PropFolder;
  isActive: boolean;
  onClick: () => void;
}) {
  const { renameFolder, deleteFolder, setSelectedFolderId } = usePropsLibraryStore();
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(folder.name);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const handleRenameConfirm = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    renameFolder(folder.id, trimmed);
    setRenaming(false);
  };

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
        onClick={onClick}
      >
        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
        {renaming ? (
          <Input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleRenameConfirm}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm();
              if (e.key === 'Escape') setRenaming(false);
            }}
            className="h-5 text-xs px-1 py-0 flex-1"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate">{folder.name}</span>
        )}

        {/* \u76ee\u5f55\u64cd\u4f5c\u6309\u94ae（\u60ac\u6d6e\u663e\u793a） */}
        {!renaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setNameInput(folder.name);
                  setRenaming(true);
                }}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                \u91cd\u547dtên
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteAlert(true);
                }}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                \u5220\u9664\u76ee\u5f55
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* \u5220\u9664\u76ee\u5f55\u786e\u8ba4 */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>\u5220\u9664\u76ee\u5f55</AlertDialogTitle>
            <AlertDialogDescription>
              \u786e\u8ba4\u5220\u9664\u76ee\u5f55「{folder.name}」？\u76ee\u5f55bên trongcủađạo cụ\u5c06\u79fb\u81f3\u6839\u76ee\u5f55，sẽ không\u88ab\u5220\u9664。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>\u53d6\u6d88</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteFolder(folder.id);
                setSelectedFolderId('all');
                toast.success(`\u76ee\u5f55「${folder.name}」Đã rồi\u5220\u9664`);
              }}
            >
              \u5220\u9664
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── mới\u5efa\u76ee\u5f55\u5f39cửa sổ ──────────────────────────────────────────────────────────────

function NewFolderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addFolder, setSelectedFolderId } = usePropsLibraryStore();
  const [name, setName] = useState('');

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const folder = addFolder(trimmed);
    setSelectedFolderId(folder.id);
    setName('');
    onOpenChange(false);
    toast.success(`\u76ee\u5f55「${trimmed}」Đã rồi\u521b\u5efa`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>mới\u5efa\u76ee\u5f55</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            autoFocus
            placeholder="\u8f93\u5165\u76ee\u5f55tên\u79f0，Chẳng hạn như：xe hơi、\u6b66\u5668..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') onOpenChange(false);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            \u53d6\u6d88
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim()}>
            \u521b\u5efa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PropsLibrary Chúa ơi\u7ec4\u4ef6 ───────────────────────────────────────────────────────

export function PropsLibrary() {
  const {
    items,
    folders,
    selectedFolderId,
    setSelectedFolderId,
    getPropsByFolder,
  } = usePropsLibraryStore();

  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const visibleItems = getPropsByFolder(selectedFolderId);
  const currentFolderName =
    selectedFolderId === 'all'
      ? 'Tất cảđạo cụ'
      : folders.find((f) => f.id === selectedFolderId)?.name ?? 'Tất cảđạo cụ';

  return (
    <div className="h-full flex">
      {/* ── \u5de6\u4fa7\u76ee\u5f55cây ── */}
      <div className="w-[160px] shrink-0 border-r border-border flex flex-col bg-panel">
        {/* \u76ee\u5f55câyTiêu đề */}
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-muted-foreground">\u76ee\u5f55</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={() => setNewFolderOpen(true)}
            title="mới\u5efa\u76ee\u5f55"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* \u76ee\u5f55danh sách */}
        <ScrollArea className="flex-1 py-1.5 px-1.5">
          {/* Tất cảđạo cụ */}
          <button
            className={cn(
              'flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-xs transition-colors',
              selectedFolderId === 'all'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            onClick={() => setSelectedFolderId('all')}
          >
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Tất cảđạo cụ</span>
            <span className="ml-auto text-[10px] opacity-60">{items.length}</span>
          </button>

          {/* sử dụng\u6237\u81ea\u5b9a\u4e49\u76ee\u5f55 */}
          {folders.map((folder) => {
            const count = items.filter((i) => i.folderId === folder.id).length;
            return (
              <div key={folder.id} className="relative">
                <FolderItem
                  folder={folder}
                  isActive={selectedFolderId === folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                />
                <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                  {count}
                </span>
              </div>
            );
          })}

          {/* không có\u76ee\u5f55\u63d0\u793a */}
          {folders.length === 0 && (
            <p className="text-[10px] text-muted-foreground px-3 py-2 leading-relaxed">
              \u70b9\u51fb\u53f3\u4e0a\u89d2 + mới\u5efa\u76ee\u5f55
            </p>
          )}
        </ScrollArea>

        {/* \u5e95\u90e8mới\u5efa\u6309\u94ae */}
        <div className="p-2 border-t border-border shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7"
            onClick={() => setNewFolderOpen(true)}
          >
            <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
            mới\u5efa\u76ee\u5f55
          </Button>
        </div>
      </div>

      {/* ── bên phảiđạo cụ\u7f51\u683c ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* \u9762\u5305\u5c51/Tiêu đề\u680f */}
        <div className="px-4 py-2.5 border-b border-border shrink-0 flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{currentFolderName}</span>
          <span className="text-xs text-muted-foreground">({visibleItems.length} mộtđạo cụ)</span>
        </div>

        {/* đạo cụ\u7f51\u683c */}
        <ScrollArea className="flex-1">
          {visibleItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground py-24">
              <Package className="h-16 w-16 opacity-20" />
              <div className="text-center">
                <p className="text-base font-medium">đạo cụ\u5e93cho\u7a7a</p>
                <p className="text-sm mt-1">
                  \u5728「sự tự do」\u677f\u5757của\u56fe\u7247\u5de5\u4f5c\u5ba4\u751f\u6210\u56fe\u7247\u540e，<br />
                  \u70b9\u51fb「\u4fdd\u5b58Đếnđạo cụ\u5e93」\u5373\u53ef\u6dfb\u52a0đạo cụ
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              {visibleItems.map((item) => (
                <PropCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* mới\u5efa\u76ee\u5f55\u5f39cửa sổ */}
      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} />
    </div>
  );
}
