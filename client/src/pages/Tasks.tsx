import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Trash2, Eye, FileSearch, Clock, CheckCircle2, XCircle,
  Activity, Upload, HardDrive, Archive, Terminal, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const SCAN_TYPE_CONFIG = {
  encrypted_backup: {
    label: "加密备份",
    icon: <Archive className="w-4 h-4" />,
    desc: "通过 iTunes/Finder 备份解密方式获取数据，包含 Safari 历史、联系人等完整记录",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  filesystem_dump: {
    label: "文件系统转储",
    icon: <HardDrive className="w-4 h-4" />,
    desc: "直接转储设备文件系统，提供最完整的取证数据（需要越狱或专用取证工具）",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  sysdiagnose: {
    label: "Sysdiagnose/日志目录",
    icon: <Terminal className="w-4 h-4" />,
    desc: "上传系统诊断日志目录，适用于内存运行态、崩溃日志、进程痕迹分析",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "等待中", className: "bg-gray-50 text-gray-600 border-gray-200" },
  running: { label: "检测中", className: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "已完成", className: "bg-green-50 text-green-700 border-green-200" },
  failed: { label: "失败", className: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "已取消", className: "bg-gray-50 text-gray-500 border-gray-200" },
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
    refetchInterval: 3000, // Poll every 3s for running tasks
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
    onSuccess: () => {
      utils.scan.list.invalidate();
      toast.success("任务已删除");
    },
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">检测任务管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">创建、查看和管理 iOS 间谍软件检测任务</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1.5" />刷新
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />新建任务
          </Button>
        </div>
      </div>

      {/* Running Tasks */}
      {runningTasks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            运行中 ({runningTasks.length})
          </h2>
          <div className="space-y-3">
            {runningTasks.map((task) => (
              <RunningTaskCard key={task.id} task={task} onView={() => navigate(`/tasks/${task.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* All Tasks */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (tasks?.length ?? 0) === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileSearch className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">暂无检测任务</p>
            <p className="text-xs text-muted-foreground mt-1">创建任务以开始 iOS 间谍软件检测</p>
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />新建任务
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          {otherTasks.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                全部任务 ({otherTasks.length})
              </h2>
              <div className="space-y-2">
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
          )}
        </div>
      )}

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建检测任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Task Name */}
            <div className="space-y-2">
              <Label>任务名称 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="如：iPhone 15 Pro 安全检测 2024-06"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Device */}
            <div className="space-y-2">
              <Label>关联设备（可选）</Label>
              <Select value={form.deviceId} onValueChange={(v) => setForm({ ...form, deviceId: v })}>
                <SelectTrigger>
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
              <Label>采集方式 <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(SCAN_TYPE_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                      form.scanType === key
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                    onClick={() => setForm({ ...form, scanType: key as any })}
                  >
                    <div className={`p-2 rounded-lg ${cfg.bg} ${cfg.color}`}>{cfg.icon}</div>
                    <div>
                      <p className="text-sm font-semibold">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{cfg.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>上传数据文件（可选）</Label>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  {form.scanType === "sysdiagnose"
                    ? "上传 sysdiagnose .tar.gz 或日志压缩包"
                    : form.scanType === "encrypted_backup"
                    ? "上传解密后的备份目录压缩包"
                    : "上传文件系统转储压缩包"}
                </p>
                <input
                  type="file"
                  id="data-file"
                  className="hidden"
                  accept=".zip,.tar,.gz,.tar.gz"
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("data-file")?.click()}
                >
                  选择文件
                </Button>
                {uploadFile && (
                  <p className="text-xs text-green-600 mt-2">
                    已选择：{uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                )}
              </div>
            </div>

            {/* IOC Files */}
            {iocFiles && iocFiles.length > 0 && (
              <div className="space-y-2">
                <Label>IOC 规则文件（可选，多选）</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                  {iocFiles.filter((f) => f.isActive).map((ioc) => (
                    <div key={ioc.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`ioc-${ioc.id}`}
                        checked={form.iocFileIds.includes(ioc.id)}
                        onCheckedChange={() => toggleIoc(ioc.id)}
                      />
                      <label htmlFor={`ioc-${ioc.id}`} className="text-sm cursor-pointer flex-1">
                        {ioc.name}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({ioc.indicatorCount} 条指标)
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "创建中..." : "开始检测"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunningTaskCard({ task, onView }: { task: any; onView: () => void }) {
  return (
    <Card className="border border-blue-200 bg-blue-50/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
            <p className="text-sm font-semibold">{task.name}</p>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
            检测中
          </Badge>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{task.progressMessage ?? "正在检测..."}</span>
            <span className="font-medium text-blue-700">{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-1.5" />
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground">
            {SCAN_TYPE_CONFIG[task.scanType as keyof typeof SCAN_TYPE_CONFIG]?.label} · {formatDate(task.createdAt)}
          </p>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onView}>
            <Eye className="w-3 h-3 mr-1" />查看
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, onView, onDelete }: { task: any; onView: () => void; onDelete: () => void }) {
  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
  const summary = task.resultSummary as any;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
      <TaskStatusIcon status={task.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{task.name}</p>
          <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
            {statusCfg.label}
          </Badge>
          {summary?.detected > 0 && (
            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
              {summary.detected} 威胁
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {SCAN_TYPE_CONFIG[task.scanType as keyof typeof SCAN_TYPE_CONFIG]?.label} · {formatDate(task.createdAt)}
          {summary && ` · 共 ${summary.total} 条结果`}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onView}>
          <Eye className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (status === "running") return <Activity className="w-4 h-4 text-blue-500 shrink-0 animate-pulse" />;
  return <Clock className="w-4 h-4 text-gray-400 shrink-0" />;
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
