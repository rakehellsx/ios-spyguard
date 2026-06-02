import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Trash2, Eye, FileSearch, Clock, CheckCircle2, XCircle,
  Activity, Upload, HardDrive, Archive, Terminal, RefreshCw,
  AlertTriangle, ChevronRight, Zap, BarChart3,
} from "lucide-react";
import { toast } from "sonner";

const SCAN_TYPE_CONFIG = {
  encrypted_backup: {
    label: "加密备份",
    icon: Archive,
    desc: "通过 iTunes/Finder 备份解密方式获取数据",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    activeBorder: "border-blue-500",
    activeBg: "bg-blue-50/60",
  },
  filesystem_dump: {
    label: "文件系统转储",
    icon: HardDrive,
    desc: "直接转储设备文件系统，最完整的取证数据",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    activeBorder: "border-violet-500",
    activeBg: "bg-violet-50/60",
  },
  sysdiagnose: {
    label: "Sysdiagnose",
    icon: Terminal,
    desc: "上传系统诊断日志，分析进程与内存痕迹",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    activeBorder: "border-orange-500",
    activeBg: "bg-orange-50/60",
  },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: "等待中", className: "bg-slate-50 text-slate-500 border-slate-200" },
  running:   { label: "检测中", className: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "已完成", className: "bg-green-50 text-green-700 border-green-200" },
  failed:    { label: "失败",   className: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "已取消", className: "bg-slate-50 text-slate-400 border-slate-200" },
};

export default function Tasks() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    deviceId: "",
    scanType: "encrypted_backup" as "encrypted_backup" | "filesystem_dump" | "sysdiagnose",
    iocFileIds: [] as number[],
    dataFilename: "",
    dataContent: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const utils = trpc.useUtils();
  const { data: tasks, isLoading, refetch } = trpc.scan.list.useQuery(undefined, {
    refetchInterval: 3000,
  });
  const { data: devices } = trpc.devices.list.useQuery();
  const { data: iocFiles } = trpc.ioc.list.useQuery();

  const createMutation = trpc.scan.create.useMutation({
    onSuccess: () => {
      utils.scan.list.invalidate();
      setCreateOpen(false);
      resetForm();
      toast.success("检测任务已创建，正在后台运行");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.scan.delete.useMutation({
    onSuccess: () => { utils.scan.list.invalidate(); toast.success("任务已删除"); },
    onError: () => toast.error("删除失败"),
  });

  const resetForm = () => {
    setForm({ name: "", deviceId: "", scanType: "encrypted_backup", iocFileIds: [], dataFilename: "", dataContent: "" });
    setUploadFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setForm((f) => ({ ...f, dataFilename: file.name, dataContent: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!form.name) { toast.error("请输入任务名称"); return; }
    createMutation.mutate({
      name: form.name,
      deviceId: (form.deviceId && form.deviceId !== "none") ? Number(form.deviceId) : undefined,
      scanType: form.scanType,
      iocFileIds: form.iocFileIds,
      dataContent: form.dataContent || undefined,
      dataFilename: form.dataFilename || undefined,
    });
  };

  const toggleIoc = (id: number) => {
    setForm((f) => ({
      ...f,
      iocFileIds: f.iocFileIds.includes(id)
        ? f.iocFileIds.filter((x) => x !== id)
        : [...f.iocFileIds, id],
    }));
  };

  const runningTasks = tasks?.filter((t) => t.status === "running") ?? [];
  const otherTasks = tasks?.filter((t) => t.status !== "running") ?? [];
  const totalThreats = tasks?.reduce((s, t) => s + ((t.resultSummary as any)?.detected ?? 0), 0) ?? 0;
  const completedCount = tasks?.filter((t) => t.status === "completed").length ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">检测任务</h1>
          <p className="text-sm text-muted-foreground mt-1">创建、查看和管理 iOS 间谍软件检测任务</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />刷新
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" />新建任务
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {(tasks?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7 stagger-children">
          {[
            { label: "全部任务", value: tasks?.length ?? 0, icon: FileSearch, color: "text-foreground", bg: "bg-slate-50", iconColor: "text-slate-500" },
            { label: "检测中", value: runningTasks.length, icon: Activity, color: "text-blue-700", bg: "bg-blue-50", iconColor: "text-blue-500" },
            { label: "已完成", value: completedCount, icon: CheckCircle2, color: "text-green-700", bg: "bg-green-50", iconColor: "text-green-500" },
            { label: "威胁命中", value: totalThreats, icon: AlertTriangle, color: totalThreats > 0 ? "text-red-700" : "text-foreground", bg: totalThreats > 0 ? "bg-red-50" : "bg-slate-50", iconColor: totalThreats > 0 ? "text-red-500" : "text-slate-400" },
          ].map(({ label, value, icon: Icon, color, bg, iconColor }) => (
            <div key={label} className="bg-white rounded-2xl border border-border px-5 py-4 flex items-center gap-3" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className={`text-xl font-bold tabular-nums leading-tight ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Running tasks */}
      {runningTasks.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-foreground">正在运行</h2>
            <span className="text-xs text-muted-foreground">({runningTasks.length})</span>
          </div>
          <div className="space-y-3">
            {runningTasks.map((task) => (
              <RunningTaskCard key={task.id} task={task} onView={() => navigate(`/tasks/${task.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* All tasks */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />)}
        </div>
      ) : (tasks?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-dashed border-border">
          <div className="w-20 h-20 rounded-3xl bg-muted/40 flex items-center justify-center mb-5">
            <FileSearch className="w-10 h-10 text-muted-foreground/25" />
          </div>
          <p className="text-base font-bold text-foreground">暂无检测任务</p>
          <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-xs leading-relaxed">
            创建检测任务，开始对 iOS 设备进行间谍软件扫描
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shadow-sm">
            <Zap className="w-3.5 h-3.5" />创建第一个任务
          </Button>
        </div>
      ) : otherTasks.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <h2 className="text-sm font-semibold text-foreground">历史任务</h2>
            <span className="text-xs text-muted-foreground">({otherTasks.length})</span>
          </div>
          <div className="bg-white rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 1px 4px 0 oklch(0.12 0.018 255 / 0.06)" }}>
            <div className="divide-y divide-border">
              {otherTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onView={() => navigate(`/tasks/${task.id}`)}
                  onDelete={() => deleteMutation.mutate({ id: task.id })}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">新建检测任务</DialogTitle>
            <DialogDescription>配置检测参数并启动 iOS 间谍软件扫描任务</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Task Name */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">任务名称 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="如：iPhone 15 Pro 安全检测 2024-06"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-10"
              />
            </div>

            {/* Device */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">关联设备 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Select value={form.deviceId} onValueChange={(v) => setForm({ ...form, deviceId: v })}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="选择设备（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联设备</SelectItem>
                  {devices?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name ?? d.model ?? "iPhone"} — {d.iosVersion ?? "Unknown iOS"} ({d.udid.slice(0, 8)}...)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scan Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">采集方式 <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(SCAN_TYPE_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const active = form.scanType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                        active
                          ? `${cfg.activeBorder} ${cfg.activeBg} shadow-sm`
                          : `border-border hover:border-border/60 hover:bg-muted/20`
                      }`}
                      onClick={() => setForm({ ...form, scanType: key as any })}
                    >
                      <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                        <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-foreground">{cfg.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{cfg.desc}</p>
                      </div>
                      {active && (
                        <div className={`w-4 h-4 rounded-full border-2 ${cfg.activeBorder} flex items-center justify-center self-end ml-auto -mt-1`}>
                          <div className={`w-2 h-2 rounded-full ${cfg.bg.replace("bg-", "bg-").replace("-50", "-500")}`} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                上传数据文件 <span className="text-muted-foreground font-normal">(可选)</span>
              </Label>
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/30 hover:bg-muted/15 transition-all duration-150 cursor-pointer group"
                onClick={() => document.getElementById("data-file")?.click()}
              >
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/8 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary/50 transition-colors" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {uploadFile ? uploadFile.name : "点击选择文件"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {uploadFile
                    ? `${(uploadFile.size / 1024 / 1024).toFixed(1)} MB`
                    : form.scanType === "sysdiagnose"
                    ? "支持 .tar.gz 或日志压缩包"
                    : form.scanType === "encrypted_backup"
                    ? "支持解密后的备份目录压缩包"
                    : "支持文件系统转储压缩包"}
                </p>
                <input
                  type="file"
                  id="data-file"
                  className="hidden"
                  accept=".zip,.tar,.gz,.tar.gz"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* IOC Files */}
            {iocFiles && iocFiles.filter((f) => f.isActive).length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  IOC 规则文件 <span className="text-muted-foreground font-normal">(可选，多选)</span>
                </Label>
                <div className="space-y-1 max-h-36 overflow-y-auto border border-border rounded-xl p-3 bg-muted/15">
                  {iocFiles.filter((f) => f.isActive).map((ioc) => (
                    <div key={ioc.id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-white transition-colors">
                      <Checkbox
                        id={`ioc-${ioc.id}`}
                        checked={form.iocFileIds.includes(ioc.id)}
                        onCheckedChange={() => toggleIoc(ioc.id)}
                      />
                      <label htmlFor={`ioc-${ioc.id}`} className="text-sm cursor-pointer flex-1 flex items-center gap-2">
                        <span className="font-medium text-foreground">{ioc.name}</span>
                        <span className="text-xs text-muted-foreground">({ioc.indicatorCount} 条指标)</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-1.5 shadow-sm">
              {createMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  创建中...
                </span>
              ) : (
                <><Zap className="w-3.5 h-3.5" />开始检测</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunningTaskCard({ task, onView }: { task: any; onView: () => void }) {
  const cfg = SCAN_TYPE_CONFIG[task.scanType as keyof typeof SCAN_TYPE_CONFIG];
  const Icon = cfg?.icon ?? FileSearch;
  return (
    <div
      className="bg-white rounded-2xl border border-blue-200 overflow-hidden"
      style={{ boxShadow: "0 1px 6px 0 oklch(0.55 0.18 258 / 0.10)" }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-blue-50 to-blue-50/30 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
            <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground">{task.name}</p>
            <p className="text-[11px] text-blue-600/70">{cfg?.label ?? task.scanType}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-blue-700 tabular-nums">{task.progress}%</span>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={onView}>
            <Eye className="w-3 h-3" />查看
          </Button>
        </div>
      </div>
      <div className="px-5 py-3.5 space-y-2">
        <Progress value={task.progress} className="h-2 bg-blue-100" />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{task.progressMessage ?? "正在检测..."}</p>
          <p className="text-xs text-muted-foreground">{formatDate(task.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, onView, onDelete }: { task: any; onView: () => void; onDelete: () => void }) {
  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
  const summary = task.resultSummary as any;
  const cfg = SCAN_TYPE_CONFIG[task.scanType as keyof typeof SCAN_TYPE_CONFIG];
  const Icon = cfg?.icon ?? FileSearch;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 cursor-pointer transition-colors group"
      onClick={onView}
    >
      <TaskStatusIcon status={task.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {task.name}
          </p>
          <span className={`inline-flex items-center text-[11px] font-semibold border rounded-full px-2 py-0.5 ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
          {summary?.detected > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold border rounded-full px-2 py-0.5 bg-red-50 text-red-700 border-red-200">
              <AlertTriangle className="w-2.5 h-2.5" />
              {summary.detected} 威胁
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {cfg?.label ?? task.scanType}
          <span className="mx-1.5 opacity-40">·</span>
          {formatDate(task.createdAt)}
          {summary && (
            <><span className="mx-1.5 opacity-40">·</span>共 {summary.total} 条结果</>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm" variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
          onClick={onView}
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors ml-1" />
      </div>
    </div>
  );
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === "completed") return (
    <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
      <CheckCircle2 className="w-4 h-4 text-green-500" />
    </div>
  );
  if (status === "failed") return (
    <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
      <XCircle className="w-4 h-4 text-red-500" />
    </div>
  );
  if (status === "running") return (
    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
      <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
      <Clock className="w-4 h-4 text-slate-400" />
    </div>
  );
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
