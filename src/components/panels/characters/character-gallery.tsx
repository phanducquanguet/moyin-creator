// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

/**
 * Character Gallery - Middle column
 * Folder navigation, breadcrumb, and character card grid
 */

import { useState, useMemo, useEffect } from "react";
import { useCharacterLibraryStore, type Character, type CharacterFolder } from "@/stores/character-library-store";
import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useProjectStore } from "@/stores/project-store";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import { useActiveScriptProject } from "@/stores/script-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  FolderPlus,
  Folder,
  ChevronRight,
  Home,
  Pencil,
  Trash2,
  FolderInput,
  User,
  Image as ImageIcon,
  Grid2X2,
  List,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ImagePreviewModal } from "@/components/panels/director/media-preview-modal";

type ViewMode = "grid" | "list";

interface CharacterGalleryProps {
  onCharacterSelect: (character: Character | null) => void;
  selectedCharacterId: string | null;
}

export function CharacterGallery({ onCharacterSelect, selectedCharacterId }: CharacterGalleryProps) {
  const {
    characters,
    folders,
    currentFolderId,
    addFolder,
    renameFolder,
    deleteFolder,
    setCurrentFolder,
    deleteCharacter,
    moveToFolder,
    getFolderById,
    selectCharacter,
  } = useCharacterLibraryStore();
  const { resourceSharing } = useAppSettingsStore();
  const { activeProjectId } = useProjectStore();
  const { activeEpisodeIndex } = useMediaPanelStore();
  const scriptProject = useActiveScriptProject();

  // đặt\u4f5csử dụng\u57df\u8fc7\u6ee4
  const hasEpisodeScope = activeEpisodeIndex != null;
  const activeEpisodeId = hasEpisodeScope
    ? scriptProject?.scriptData?.episodes.find(ep => ep.index === activeEpisodeIndex)?.id
    : undefined;
  const [episodeViewScope, setEpisodeViewScope] = useState<'all' | 'episode'>('episode');

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<CharacterFolder | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const visibleFolders = useMemo(() => {
    if (resourceSharing.shareCharacters) return folders;
    if (!activeProjectId) return [];
    return folders.filter((f) => f.projectId === activeProjectId);
  }, [folders, resourceSharing.shareCharacters, activeProjectId]);

  const visibleCharacters = useMemo(() => {
    let chars: Character[];
    if (resourceSharing.shareCharacters) {
      chars = characters;
    } else if (!activeProjectId) {
      chars = [];
    } else {
      chars = characters.filter((c) => c.projectId === activeProjectId);
    }
    // \u672cđặt\u8fc7\u6ee4：\u53ea\u663e\u793a\u672cđặt\u5173\u8054của\u89d2\u8272 + không cóđặt\u7ed1\u5b9acủatình hình chung\u89d2\u8272
    if (hasEpisodeScope && episodeViewScope === 'episode' && activeEpisodeId) {
      chars = chars.filter(c => !c.linkedEpisodeId || c.linkedEpisodeId === activeEpisodeId);
    }
    return chars;
  }, [characters, resourceSharing.shareCharacters, activeProjectId, hasEpisodeScope, episodeViewScope, activeEpisodeId]);

  // Current folder's subfolders
  const subFolders = useMemo(() => 
    visibleFolders.filter(f => f.parentId === currentFolderId),
    [visibleFolders, currentFolderId]
  );

  // Current folder's characters
  const currentCharacters = useMemo(() => {
    let chars = visibleCharacters.filter(c => c.folderId === currentFolderId);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      chars = chars.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
      );
    }
    return chars;
  }, [visibleCharacters, currentFolderId, searchQuery]);

  // Breadcrumb path
  const breadcrumbPath = useMemo(() => {
    const path: CharacterFolder[] = [];
    let folderId = currentFolderId;
    while (folderId) {
      const folder = getFolderById(folderId);
      if (folder) {
        path.unshift(folder);
        folderId = folder.parentId;
      } else {
        break;
      }
    }
    return path;
  }, [currentFolderId, getFolderById]);

  useEffect(() => {
    if (resourceSharing.shareCharacters) return;
    const allowedIds = new Set(visibleFolders.map((f) => f.id));
    if (currentFolderId && !allowedIds.has(currentFolderId)) {
      setCurrentFolder(null);
    }
  }, [resourceSharing.shareCharacters, visibleFolders, currentFolderId, setCurrentFolder]);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("\u8bf7\u8f93\u5165\u6587\u4ef6\u5939tên\u79f0");
      return;
    }
    const projectId = resourceSharing.shareCharacters ? undefined : activeProjectId || undefined;
    addFolder(newFolderName.trim(), currentFolderId, projectId);
    setNewFolderName("");
    setShowNewFolderDialog(false);
    toast.success("\u6587\u4ef6\u5939Đã rồi\u521b\u5efa");
  };

  const handleRenameFolder = () => {
    if (!renamingFolder || !renameValue.trim()) return;
    renameFolder(renamingFolder.id, renameValue.trim());
    setRenamingFolder(null);
    setRenameValue("");
    toast.success("\u6587\u4ef6\u5939Đã rồi\u91cd\u547dtên");
  };

  const handleDeleteFolder = (id: string) => {
    if (confirm("\u786e\u5b9a\u8981\u5220\u9664\u6b64\u6587\u4ef6\u5939\u5417？\u6587\u4ef6\u5939bên trongcủa\u89d2\u8272\u5c06\u79fb\u52a8Đến\u4e0a\u7ea7\u76ee\u5f55。")) {
      deleteFolder(id);
      toast.success("\u6587\u4ef6\u5939Đã rồi\u5220\u9664");
    }
  };

  const handleDeleteCharacter = (char: Character) => {
    if (confirm(`\u786e\u5b9a\u8981\u5220\u9664\u89d2\u8272 "${char.name}" \u5417？`)) {
      deleteCharacter(char.id);
      if (selectedCharacterId === char.id) {
        onCharacterSelect(null);
      }
      toast.success("\u89d2\u8272Đã rồi\u5220\u9664");
    }
  };

  const handleCharacterClick = (char: Character) => {
    if (selectedCharacterId === char.id) {
      selectCharacter(null);
      onCharacterSelect(null);
    } else {
      selectCharacter(char.id);
      onCharacterSelect(char);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with breadcrumb and toolbar */}
      <div className="p-3 pb-2 border-b space-y-2">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm overflow-x-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 gap-1"
            onClick={() => setCurrentFolder(null)}
          >
            <Home className="h-3.5 w-3.5" />
            \u89d2\u8272\u5e93
          </Button>
          {breadcrumbPath.map((folder) => (
            <div key={folder.id} className="flex items-center">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => setCurrentFolder(folder.id)}
              >
                {folder.name}
              </Button>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="\u641c\u7d22\u89d2\u8272..."
              className="h-8 pl-7 text-sm"
            />
          </div>
          {/* \u5168\u5267/\u672cđặt\u5207\u6362（\u4ec5\u5728nhập\u67d0đặt\u65f6\u663e\u793a）*/}
          {hasEpisodeScope && (
            <div className="flex border rounded-md">
              <Button
                variant={episodeViewScope === 'episode' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2 rounded-r-none text-xs"
                onClick={() => setEpisodeViewScope('episode')}
              >
                \u672cđặt
              </Button>
              <Button
                variant={episodeViewScope === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2 rounded-l-none text-xs"
                onClick={() => setEpisodeViewScope('all')}
              >
                \u5168\u5267
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setShowNewFolderDialog(true)}
          >
            <FolderPlus className="h-3.5 w-3.5 mr-1" />
            mới\u5efa
          </Button>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <Grid2X2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2 rounded-l-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-3 pb-32">
        {/* Folders */}
        {subFolders.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-2">\u6587\u4ef6\u5939</div>
            <div className={cn(
              viewMode === "grid" 
                ? "grid grid-cols-3 gap-2" 
                : "space-y-1"
            )}>
              {subFolders.map((folder) => (
                <FolderContextMenu
                  key={folder.id}
                  folder={folder}
                  onRename={() => {
                    setRenamingFolder(folder);
                    setRenameValue(folder.name);
                  }}
                  onDelete={() => handleDeleteFolder(folder.id)}
                >
                  <div
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors",
                      "hover:bg-accent",
                      viewMode === "grid" && "flex-col text-center"
                    )}
                    onDoubleClick={() => setCurrentFolder(folder.id)}
                  >
                    <Folder className={cn(
                      "text-yellow-500",
                      viewMode === "grid" ? "h-8 w-8" : "h-4 w-4"
                    )} />
                    <span className={cn(
                      "truncate",
                      viewMode === "grid" ? "text-xs w-full" : "text-sm flex-1"
                    )}>
                      {folder.name}
                    </span>
                  </div>
                </FolderContextMenu>
              ))}
            </div>
          </div>
        )}

        {/* Characters */}
        {currentCharacters.length > 0 ? (
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              \u89d2\u8272 ({currentCharacters.length})
            </div>
            <div className={cn(
              viewMode === "grid" 
                ? "grid grid-cols-3 gap-2" 
                : "space-y-1"
            )}>
              {currentCharacters.map((char) => (
                <CharacterContextMenu
                  key={char.id}
                  character={char}
                  folders={visibleFolders}
                  onDelete={() => handleDeleteCharacter(char)}
                  onMove={(folderId) => {
                    moveToFolder(char.id, folderId);
                    toast.success("\u89d2\u8272Đã rồi\u79fb\u52a8");
                  }}
                >
                  <div
                    className={cn(
                      "rounded-md border cursor-pointer transition-all",
                      "hover:border-foreground/30",
                      selectedCharacterId === char.id && "border-primary ring-1 ring-primary",
                      viewMode === "grid" ? "p-2" : "p-2 flex items-center gap-3"
                    )}
                    onClick={() => handleCharacterClick(char)}
                  >
                    {viewMode === "grid" ? (
                      <>
                        {/* Grid view */}
                        <div
                          className="aspect-square rounded bg-muted flex items-center justify-center overflow-hidden mb-2 cursor-zoom-in"
                          title="\u53cc\u51fb\u67e5\u770b\u5927\u56fe"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (char.thumbnailUrl) setPreviewImageUrl(char.thumbnailUrl);
                          }}
                        >
                          {char.thumbnailUrl ? (
                            <img 
                              src={char.thumbnailUrl} 
                              alt={char.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <User className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium truncate">{char.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {char.views.length > 0 ? `${char.views.length} \u89c6\u56fe` : "\u672a\u751f\u6210"}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* List view */}
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {char.thumbnailUrl ? (
                            <img 
                              src={char.thumbnailUrl} 
                              alt={char.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{char.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {char.description || "\u6682không có\u63cf\u8ff0"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ImageIcon className="h-3 w-3" />
                          {char.views.length}
                        </div>
                      </>
                    )}
                  </div>
                </CharacterContextMenu>
              ))}
            </div>
          </div>
        ) : (
          subFolders.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[200px] text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "\u6ca1Cótìm thấytrận đấucủa\u89d2\u8272" : "\u8fd8\u6ca1Có\u89d2\u8272"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                sử dụng\u5de6\u4fa7\u63a7\u5236\u53f0\u521b\u5efa\u89d2\u8272
              </p>
            </div>
          )
        )}
      </ScrollArea>

      {/* Image preview lightbox */}
      {previewImageUrl && (
        <ImagePreviewModal
          imageUrl={previewImageUrl}
          isOpen={true}
          onClose={() => setPreviewImageUrl(null)}
        />
      )}

      {/* New folder dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>mới\u5efa\u6587\u4ef6\u5939</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="\u6587\u4ef6\u5939tên\u79f0"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              \u53d6\u6d88
            </Button>
            <Button onClick={handleCreateFolder}>\u521b\u5efa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename folder dialog */}
      <Dialog open={!!renamingFolder} onOpenChange={(open) => !open && setRenamingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>\u91cd\u547dtên\u6587\u4ef6\u5939</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="\u6587\u4ef6\u5939tên\u79f0"
            onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingFolder(null)}>
              \u53d6\u6d88
            </Button>
            <Button onClick={handleRenameFolder}>\u4fdd\u5b58</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Folder context menu component
function FolderContextMenu({
  folder,
  children,
  onRename,
  onDelete,
}: {
  folder: CharacterFolder;
  children: React.ReactNode;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onRename}>
          <Pencil className="h-4 w-4 mr-2" />
          \u91cd\u547dtên
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          \u5220\u9664\u6587\u4ef6\u5939
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Character context menu component
function CharacterContextMenu({
  character,
  children,
  folders,
  onDelete,
  onMove,
}: {
  character: Character;
  children: React.ReactNode;
  folders: CharacterFolder[];
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderInput className="h-4 w-4 mr-2" />
            \u79fb\u52a8Đến
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => onMove(null)}>
              <Home className="h-4 w-4 mr-2" />
              \u6839\u76ee\u5f55
            </ContextMenuItem>
            {folders.map((f) => (
              <ContextMenuItem key={f.id} onClick={() => onMove(f.id)}>
                <Folder className="h-4 w-4 mr-2" />
                {f.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          \u5220\u9664\u89d2\u8272
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
