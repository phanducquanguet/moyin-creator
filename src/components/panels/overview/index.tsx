"use client";

/**
 * OverviewPanel — Dự ánTổng quan（SeriesMeta hiển thị + bên trong\u8054Chỉnh sửa）
 *
 * \u4e24\u680fBố cục：
 *   \u5de6\u680f：Cốt lõi câu chuyện + thế giới quan + Cài đặt sản xuất
 *   \u53f3\u680f：Nhân vậdanh sách t + trại + mục chính/Địa lý
 */

import { useState, useCallback } from "react";
import { useScriptStore, useActiveScriptProject } from "@/stores/script-store";
import { useProjectStore } from "@/stores/project-store";
import { useMediaPanelStore } from "@/stores/media-panel-store";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Globe,
  Users,
  Swords,
  MapPin,
  Gem,
  Pencil,
  Check,
  X,
  Shield,
  Settings2,
  ListOrdered,
  Film,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import type { SeriesMeta, NamedEntity, Faction, EpisodeRawScript } from "@/types/script";
import { getStyleName } from "@/lib/constants/visual-styles";

const OVERVIEW_WORKFLOW_SECTIONS: Array<{ id: number; title: string; steps: string[] }> = [
  {
    id: 1,
    title: "Kịch bản\u6a21\u5757",
    steps: [
      "\u70b9\u51fbKịch bản\u6a21\u5757",
      "Nhập",
      "\u7c98\u8d34\u5b8c\u6574Kịch bản",
      "\u70b9\u51fbNhậhoàn thànhKịch bản",
      "\u9009\u62e9Tầm nhìn Phong cách",
      "Hailần\u68c0\u67e5",
      "AICảnh\u6821\u51c6",
      "\u70b9\u51fbCảnh，\u53f3\u8fb9\u680f：\u53bbThư viện cảnhTạoCảnh",
      "\u5728Cảnh\u677f\u5757\u5de6\u8fb9\u680fTạo\u540eTạoLưu",
      "AI hiệu chuẩn Phân cảnh",
      "AINhân vật\u6821\u51c6",
      "\u70b9\u51fbNhân vật，\u53f3\u8fb9\u680f：\u53bbThư viện nhân vậtTạo\u5f62\u8c61",
      "\u5728Nhân vật\u677f\u5757\u70b9\u51fb“Tạocài đặt\u56fe”",
      "Tạo\u540eLưu",
    ],
  },
  {
    id: 2,
    title: "giám đốc\u6a21\u5757",
    steps: [
      "\u70b9\u51fbgiám đốc\u6a21\u5757",
      "\u70b9\u51fb\u5de6\u8fb9cây\u5f62\u680f",
      "\u628a\u9700\u8981Cảnh\u70b9\u51fb“+”\u540e，ThêmĐến\u5de6\u8fb9\u680fPhân cảnhChỉnh sửa\u91cc",
      "Hình ảnhTạo\u65b9\u5f0f：\u9009\u62e9“\u5408\u5e76Tạo”，Tham sốvà\u56fe\u81eađược rồi\u9009",
      "\u70b9\u51fb\u6267được rồi\u5408\u5e76Tạo",
      "Hình ảnhTạo\u5b8c\u6bd5",
      "không cónhân vật chính\u6848\u4f8b\u65f6：“Tạo\u6210\u56fe”\u6309\u94ae",
      "Cónhân vật chínhTạo\u6210\u56fe：\u5728Tất cảPhân cảnh\u9875\u4e0b\u65b9“Tạo video”\u6309\u94ae",
    ],
  },
];

// ==================== Inline Editable Field ====================

function EditableText({
  value,
  placeholder,
  onSave,
  multiline = false,
  className = "",
}: {
  value: string | undefined;
  placeholder: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const startEdit = () => {
    setDraft(value || "");
    setEditing(true);
  };

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  if (editing) {
    const Comp = multiline ? Textarea : Input;
    return (
      <div className="flex items-start gap-1">
        <Comp
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !multiline) save();
            if (e.key === "Escape") cancel();
          }}
          autoFocus
          className={`text-sm ${multiline ? "min-h-[80px]" : ""} ${className}`}
          placeholder={placeholder}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={save}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={cancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`group cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50 transition-colors ${className}`}
      onClick={startEdit}
    >
      <span className={`text-sm ${value ? "text-foreground" : "text-muted-foreground italic"}`}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 ml-1 inline opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  );
}

// ==================== Section Card ====================

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

// ==================== Named Entity List ====================

function NamedEntityList({
  items,
  emptyText,
  onUpdate,
}: {
  items: NamedEntity[] | undefined;
  emptyText: string;
  onUpdate: (items: NamedEntity[]) => void;
}) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-muted-foreground italic">{emptyText}</p>;
  }
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={`${item.name}-${i}`} className="flex items-start gap-2 text-xs">
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {item.name}
          </Badge>
          <EditableText
            value={item.desc}
            placeholder="Mô tả..."
            onSave={(desc) => {
              const next = [...items];
              next[i] = { ...item, desc };
              onUpdate(next);
            }}
            className="flex-1"
          />
        </div>
      ))}
    </div>
  );
}

// ==================== Field Row ====================

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-16 shrink-0 pt-1">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ==================== Main Component ====================

export function OverviewPanel() {
  const { activeProjectId, activeProject } = useProjectStore();
  const scriptProject = useActiveScriptProject();
  const { updateSeriesMeta, addEpisodeBundle, deleteEpisodeBundle, updateEpisodeBundle } = useScriptStore();
  const { enterEpisode } = useMediaPanelStore();

  const projectId = activeProjectId || "default";
  const meta: SeriesMeta | null = scriptProject?.seriesMeta || null;
  const episodes: EpisodeRawScript[] = scriptProject?.episodeRawScripts || [];
  const scriptData = scriptProject?.scriptData || null;

  // Tạo mớiĐặt Trạng thái
  const [showNewEpisode, setShowNewEpisode] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState("");
  // XoáXác nhậnTrạng thái
  const [deletingEpIndex, setDeletingEpIndex] = useState<number | null>(null);

  const update = useCallback(
    (updates: Partial<SeriesMeta>) => {
      updateSeriesMeta(projectId, updates);
    },
    [projectId, updateSeriesMeta]
  );

  if (!meta) {
    return (
      <div className="h-full p-6">
        <div className="mx-auto w-full max-w-6xl rounded-xl border bg-panel">
          <div className="border-b px-5 py-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <BookOpen className="h-3.5 w-3.5" />
              \u65b0tay\u5f15\u5bfc
            </div>
            <h3 className="mt-2 text-lg font-semibold text-foreground">\u5355\u673a\u7248\u7231\u9605người thật\u5267Cơ bản\u5de5\u4f5c\u6d41</h3>
            <p className="mt-1 text-sm text-muted-foreground">theo thứ tự\u6267được rồi，\u4e0d\u8981\u8df3\u6b65。</p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            {OVERVIEW_WORKFLOW_SECTIONS.map((section) => (
              <div key={section.id} className="rounded-lg border bg-background/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {section.id}
                  </span>
                  <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
                </div>
                <div className="space-y-2">
                  {section.steps.map((step, idx) => (
                    <div key={`${section.id}-${idx}`} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">
                        {idx + 1}
                      </span>
                      <p className="text-sm leading-5 text-foreground">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 pb-2 bg-panel border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <h2 className="font-semibold text-sm">Dự ánTổng quan</h2>
          <span className="text-xs text-muted-foreground">
            《{meta.title}》
            {meta.genre && <Badge variant="secondary" className="ml-1 text-[10px]">{meta.genre}</Badge>}
            {meta.era && <Badge variant="outline" className="ml-1 text-[10px]">{meta.era}</Badge>}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {episodes.length} đặt · {meta.characters.length} Nhân vật · {meta.factions?.length || 0} trại · {meta.keyItems?.length || 0} Mặt hàng
        </span>
      </div>

      {/* Two-column layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left: Story + World + Settings */}
        <ResizablePanel defaultSize={55} minSize={35}>
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4 pb-32">
              {/* Cốt lõi câu chuyện */}
              <SectionCard icon={BookOpen} title="Cốt lõi câu chuyện">
                <FieldRow label="Tiêu đề">
                  <EditableText value={meta.title} placeholder="Tiêu đề phim truyền hình" onSave={(v) => update({ title: v })} />
                </FieldRow>
                <FieldRow label="Logline">
                  <EditableText value={meta.logline} placeholder="Tóm tắt một câucâu chuyệnChúa ơi\u7ebf..." onSave={(v) => update({ logline: v })} />
                </FieldRow>
                <FieldRow label="phác thảo">
                  <EditableText value={meta.outline} placeholder="Một câu chuyện hoàn chỉnh từ 100-500 từ..." onSave={(v) => update({ outline: v })} multiline />
                </FieldRow>
                <FieldRow label="xung đột cốt lõi">
                  <EditableText value={meta.centralConflict} placeholder="Xung đột dòng chính..." onSave={(v) => update({ centralConflict: v })} />
                </FieldRow>
                <FieldRow label="chủ đề">
                  <div className="flex flex-wrap gap-1">
                    {meta.themes?.map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                    {(!meta.themes || meta.themes.length === 0) && (
                      <span className="text-xs text-muted-foreground italic">\u672aCài đặtchủ đềnhãn</span>
                    )}
                  </div>
                </FieldRow>
              </SectionCard>

              {/* thế giới quan */}
              <SectionCard icon={Globe} title="thế giới quan">
                <FieldRow label="thời đại">
                  <EditableText value={meta.era} placeholder="thời cổ đại/hiện đại/tương lai..." onSave={(v) => update({ era: v })} />
                </FieldRow>
                <FieldRow label="Loại">
                  <EditableText value={meta.genre} placeholder="võ thuật/chiến tranh kinh doanh/tình yêu..." onSave={(v) => update({ genre: v })} />
                </FieldRow>
                <FieldRow label="Thờtôi gian dòng">
                  <EditableText value={meta.timelineSetting} placeholder="Chính xácờtôi cài đặt dòng..." onSave={(v) => update({ timelineSetting: v })} />
                </FieldRow>
                <FieldRow label="hệ thống xã hội">
                  <EditableText value={meta.socialSystem} placeholder="\u793e\u4f1a/quyền lựcấu trúc c..." onSave={(v) => update({ socialSystem: v })} />
                </FieldRow>
                <FieldRow label="hệ thống điện">
                  <EditableText value={meta.powerSystem} placeholder="võ thuật/ma thuật/\u79d1\u6280..." onSave={(v) => update({ powerSystem: v })} />
                </FieldRow>
                <FieldRow label="thế giới quan">
                  <EditableText value={meta.worldNotes} placeholder="bổ sungcài đặt..." onSave={(v) => update({ worldNotes: v })} multiline />
                </FieldRow>
              </SectionCard>

              {/* Cài đặt sản xuất */}
              <SectionCard icon={Settings2} title="Cài đặt sản xuất">
                <FieldRow label="Tầm nhìn Phong cách">
                  <span className="text-xs">{meta.styleId ? getStyleName(meta.styleId) : "\u672aCài đặt"}</span>
                </FieldRow>
                <FieldRow label="Màu sắgiai điệu c">
                  <EditableText value={meta.colorPalette} placeholder="Nhân vật chính của toàn bộ vở kịchông màu..." onSave={(v) => update({ colorPalette: v })} />
                </FieldRow>
                <FieldRow label="ngôn ngữ">
                  <span className="text-xs">{meta.language || "Tiếng Trung"}</span>
                </FieldRow>
              </SectionCard>

              {/* \u5206Đặt Thư mục — \u5b50Dự ánQuản lý\u53f0 */}
              <SectionCard icon={ListOrdered} title={`\u5206Đặt Thư mục (${episodes.length} đặt)`}>
                {episodes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">\u6682không có\u5206đặt\u6570\u636e（NhậpKịch bản\u540eTự động Tạo）</p>
                ) : (
                  <div className="space-y-2">
                    {episodes.map((ep) => {
                      const epSceneCount = ep.scenes?.length || 0;
                      const episode = scriptData?.episodes?.find(e => e.index === ep.episodeIndex);
                      const statusIcon = ep.shotGenerationStatus === 'completed'
                        ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                        : ep.shotGenerationStatus === 'generating'
                          ? <Clock className="h-3 w-3 text-yellow-500 animate-spin" />
                          : ep.shotGenerationStatus === 'error'
                            ? <AlertCircle className="h-3 w-3 text-red-500" />
                            : <Film className="h-3 w-3 text-muted-foreground" />;
                      const isDeleting = deletingEpIndex === ep.episodeIndex;

                      return (
                        <div
                          key={ep.episodeIndex}
                          className="group rounded border p-2.5 text-xs space-y-1 hover:bg-muted/30 hover:border-primary/30 transition-colors cursor-pointer"
                          onClick={() => enterEpisode(ep.episodeIndex, projectId)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-medium">
                              {statusIcon}
                              <span>Không.{ep.episodeIndex}đặt</span>
                              <span className="text-muted-foreground font-normal truncate max-w-[200px]">
                                {ep.title.replace(/^Không.\bộ d+[：:]?\s*/, '')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                              {epSceneCount > 0 && <span>{epSceneCount} Cảnh</span>}
                              {ep.season && <Badge variant="outline" className="text-[9px] h-4 px-1">{ep.season}</Badge>}
                              {/* Chỉnh sửaTiêu đề */}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 opacity-0 group-hover:opacity-70"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newTitle = window.prompt('Chỉnh sửatiêu đề tập phim', ep.title);
                                  if (newTitle !== null && newTitle !== ep.title) {
                                    updateEpisodeBundle(projectId, ep.episodeIndex, { title: newTitle });
                                  }
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {/* Xoá */}
                              {isDeleting ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-red-400 text-[10px]">Xác nhậnXoá?</span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 text-red-500 hover:text-red-400"
                                    onClick={() => {
                                      deleteEpisodeBundle(projectId, ep.episodeIndex);
                                      setDeletingEpIndex(null);
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5"
                                    onClick={() => setDeletingEpIndex(null)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-70 hover:text-red-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingEpIndex(ep.episodeIndex);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              {/* nhập\u7bad\u5934 */}
                              <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 text-primary" />
                            </div>
                          </div>
                          {ep.synopsis && (
                            <p className="text-muted-foreground line-clamp-2 pl-5">{ep.synopsis}</p>
                          )}
                          {ep.keyEvents && ep.keyEvents.length > 0 && (
                            <div className="flex flex-wrap gap-1 pl-5">
                              {ep.keyEvents.slice(0, 3).map((evt, j) => (
                                <Badge key={j} variant="secondary" className="text-[9px] font-normal">
                                  {evt.length > 20 ? evt.slice(0, 20) + '…' : evt}
                                </Badge>
                              ))}
                              {ep.keyEvents.length > 3 && (
                                <span className="text-[9px] text-muted-foreground">+{ep.keyEvents.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tạo mớiđặt */}
                {scriptData && (
                  <div className="mt-3 pt-3 border-t">
                    {showNewEpisode ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newEpTitle}
                          onChange={(e) => setNewEpTitle(e.target.value)}
                          placeholder={`Không.${episodes.length + 1}đặt Tiêu đề...`}
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addEpisodeBundle(projectId, newEpTitle || `Không.${episodes.length + 1}đặt`);
                              setNewEpTitle('');
                              setShowNewEpisode(false);
                            }
                            if (e.key === 'Escape') {
                              setNewEpTitle('');
                              setShowNewEpisode(false);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs px-3"
                          onClick={() => {
                            addEpisodeBundle(projectId, newEpTitle || `Không.${episodes.length + 1}đặt`);
                            setNewEpTitle('');
                            setShowNewEpisode(false);
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" /> Thêm
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => { setNewEpTitle(''); setShowNewEpisode(false); }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs"
                        onClick={() => setShowNewEpisode(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Tạo mớiđặt
                      </Button>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Characters + Factions + Items + Geography */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4 pb-32">
              {/* Nhân vậdanh sách t */}
              <SectionCard icon={Users} title={`Nhân vật (${meta.characters.length})`}>
                {meta.characters.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">\u6682không cóNhân vật\u6570\u636e</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {meta.characters.slice(0, 20).map((char) => (
                      <div
                        key={char.id}
                        className="rounded border p-2 text-xs space-y-0.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="font-medium flex items-center gap-1">
                          {char.name}
                          {char.tags?.includes("protagonist") && (
                            <Badge variant="default" className="text-[9px] h-4 px-1">nhân vật chính</Badge>
                          )}
                          {char.tags?.includes("supporting") && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1">vai phụ</Badge>
                          )}
                        </div>
                        {char.age && <span className="text-muted-foreground">{char.age}tuổi</span>}
                        {char.role && (
                          <p className="text-muted-foreground line-clamp-2">{char.role}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {meta.characters.length > 20 && (
                  <p className="text-[10px] text-muted-foreground">
                    \u8fd8Có {meta.characters.length - 20} Nhân vật...
                  </p>
                )}
              </SectionCard>

              {/* trại */}
              <SectionCard icon={Shield} title={`trại (${meta.factions?.length || 0})`}>
                {!meta.factions?.length ? (
                  <p className="text-xs text-muted-foreground italic">\u6682không cótrại\u6570\u636e（AI \u6821\u51c6\u540etự động điền）</p>
                ) : (
                  <div className="space-y-2">
                    {meta.factions.map((faction, i) => (
                      <div key={i} className="space-y-1">
                        <span className="text-xs font-medium">{faction.name}</span>
                        <div className="flex flex-wrap gap-1">
                          {faction.members.map((m, j) => (
                            <Badge key={j} variant="outline" className="text-[10px]">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* mục chính */}
              <SectionCard icon={Gem} title={`mục chính (${meta.keyItems?.length || 0})`}>
                <NamedEntityList
                  items={meta.keyItems}
                  emptyText="\u6682không cómục chính（AI Phân tích\u540etự động điền）"
                  onUpdate={(items) => update({ keyItems: items })}
                />
              </SectionCard>

              {/* Địa lý */}
              <SectionCard icon={MapPin} title={`Cài đặt địa lý (${meta.geography?.length || 0})`}>
                <NamedEntityList
                  items={meta.geography}
                  emptyText="\u6682không cóĐịa lý\u6570\u636e（AI Phân tích\u540etự động điền）"
                  onUpdate={(items) => update({ geography: items })}
                />
              </SectionCard>
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
