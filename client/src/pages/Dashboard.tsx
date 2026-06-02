import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Smartphone, Shield, AlertTriangle, Activity, ArrowRight,
  CheckCircle2, XCircle, Clock, FileSearch, Database,
  ChevronRight, TrendingUp, Zap, Cpu, Network, HardDrive,
  BarChart3,
} from "lucide-react";
import { useLocation } from "wouter";

const OBJECT_TYPES = [
  { key: "firmware", label: "固件", icon: Cpu, color: "text-violet-600", bg: "bg-violet-50" },
  { key: "filesystem", label: "文件系统", icon: HardDrive, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "process", label: "进程", icon: Activity, color: "text-green-600", bg: "bg-green-50" },
  { key: "network", label: "网络", icon: Network, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "memory_runtime_artifact", label: "内存/运行态", icon: Zap, color: "text-pink-600", bg: "bg-pink-50" },
  { key: "application", label: "应用", icon: Smartphone, color: "text-cyan-600", bg: "bg-cyan-50" },
  { key: "permission", label: "权限", icon: Shield, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "configuration_profile", label: "配置文件", icon: Database, color: "text-indigo-600", bg: "bg-indigo-50" },
  { key: "log_cache", label: "日志/缓存", icon: FileSearch, color: "text-teal-600", bg: "bg-teal-50" },
];

const SEVERITY_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string; bar: string }> = {
  critical: { label: "严重", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200", bar: "bg-red-500" },
  high:     { label: "高危", dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", bar: "bg-orange-500" },
  medium:   { label: "中危", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500" },
  low:      { label: "低危", dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", bar: "bg-blue-500" },
  informational: { label: "信息", dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", bar: "bg-slate-400" },
};

const SCAN_TYPE_LABELS: Record<string, string> = {
  encrypted_backup: "加密备份",
  filesystem_dump: "文件系统转储",
  sysdiagnose: "Sysdiagnose",
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: tasks, isLoading: tasksLoading } = trpc.scan.list.useQuery();
  const { data: devices, isLoading: devicesLoading } = trpc.devices.list.useQuery();
  const { data: iocFiles } = trpc.ioc.list.useQuery();

  const recentTasks = tasks?.slice(0, 6) ?? [];
  const connectedDevices = devices?.filter((d) => d.status === "connected") ?? [];
  const totalThreats = tasks?.reduce((sum, t) => sum + ((t.resultSummary as any)?.detected ?? 0), 0) ?? 0;
  const completedTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;
  const runningTasks = tasks?.filter((t) => t.status === "running").length ?? 0;
  const latestCompletedTask = tasks?.find((t) => t.status === "completed");
  const latestSummary = latestCompletedTask?.resultSummary as any;
  const activeIoc = iocFiles?.filter((f) => f.isActive).length ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in-up">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">安全概览</h1>
          <p className="text-sm text-muted-foreground mt-1">iOS 设备间谍软件检测平台总览</p>
        </div>
        <Button size="sm" className="gap-1.5 h-9 px-4 font-semibold" onClick={() => navigate("/tasks")}>
          <Zap className="w-3.5 h-3.5" />新建检测
        </Button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7 stagger-children">
        <StatCard
          label="已连接设备"
          value={devicesLoading ? null : connectedDevices.length}
          sub={`共 ${devices?.length ?? 0} 台设备`}
          icon={<Smartphone className="w-4.5 h-4.5" />}
          iconBg="bg-blue-50" iconColor="text-blue-600"
          trend={connectedDevices.length > 0 ? "online" : "offline"}
          onClick={() => navigate("/devices")}
        />
        <StatCard
          label="检测任务"
          value={tasksLoading ? null : (tasks?.length ?? 0)}
          sub={`${completedTasks} 已完成${runningTasks > 0 ? ` · ${runningTasks} 进行中` : ""}`}
          icon={<FileSearch className="w-4.5 h-4.5" />}
          iconBg="bg-violet-50" iconColor="text-violet-600"
          onClick={() => navigate("/tasks")}
        />
        <StatCard
          label="威胁命中"
          value={tasksLoading ? null : totalThreats}
          sub={totalThreats > 0 ? "需要关注" : "暂无威胁"}
          icon={<AlertTriangle className="w-4.5 h-4.5" />}
          iconBg={totalThreats > 0 ? "bg-red-50" : "bg-green-50"}
          iconColor={totalThreats > 0 ? "text-red-600" : "text-green-600"}
          highlight={totalThreats > 0}
          onClick={() => navigate("/tasks")}
        />
        <StatCard
          label="IOC 规则集"
          value={activeIoc}
          sub={`${iocFiles?.length ?? 0} 个文件已加载`}
          icon={<Database className="w-4.5 h-4.5" />}
          iconBg="bg-emerald-50" iconColor="text-emerald-600"
          onClick={() => navigate("/ioc")}
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent tasks — takes 2 cols */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">最近检测任务</h2>
            </div>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
              onClick={() => navigate("/tasks")}
            >
              查看全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {tasksLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[60px] w-full rounded-xl" />)}
            </div>
          ) : recentTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <FileSearch className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold text-foreground">暂无检测任务</p>
              <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-xs">
                创建第一个检测任务，开始扫描 iOS 设备间谍软件
              </p>
              <Button size="sm" onClick={() => navigate("/tasks")} className="gap-1.5">
                <Zap className="w-3.5 h-3.5" />创建检测任务
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/25 cursor-pointer transition-colors group"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <TaskStatusIcon status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {task.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {SCAN_TYPE_LABELS[task.scanType] ?? task.scanType}
                      <span className="mx-1.5 opacity-40">·</span>
                      {formatDate(task.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === "running" && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-blue-600 tabular-nums w-8 text-right">{task.progress}%</span>
                      </div>
                    )}
                    {task.status === "completed" && (task.resultSummary as any)?.detected > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {(task.resultSummary as any).detected}
                      </span>
                    )}
                    <TaskStatusBadge status={task.status} />
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Detection coverage */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-green-50 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-green-600" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">检测对象覆盖</h2>
              </div>
              <span className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                9 类全覆盖
              </span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {OBJECT_TYPES.map(({ key, label, icon: Icon, color, bg }) => (
                  <div key={key} className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${bg} border border-white`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className={`text-[10px] font-medium ${color} text-center leading-tight`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Latest threat summary */}
          {latestSummary && latestSummary.detected > 0 ? (
            <div className="bg-white rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-red-600" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">最新威胁分布</h2>
              </div>
              <div className="p-4 space-y-2.5">
                {Object.entries(SEVERITY_CONFIG).map(([sev, cfg]) => {
                  const count = latestSummary.bySeverity?.[sev] ?? 0;
                  if (count === 0) return null;
                  const total = latestSummary.detected;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={sev}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className="text-xs text-muted-foreground">{cfg.label}</span>
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${cfg.text}`}>{count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${cfg.bar} rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <button
                  className="w-full text-xs text-primary hover:text-primary/80 font-medium mt-2 text-center flex items-center justify-center gap-1 transition-colors"
                  onClick={() => latestCompletedTask && navigate(`/tasks/${latestCompletedTask.id}`)}
                >
                  查看完整报告 <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            /* Quick actions when no threats */
            <div className="bg-white rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">快速操作</h2>
              </div>
              <div className="p-3 space-y-1">
                {[
                  { icon: Smartphone, label: "扫描连接设备", sub: "识别 iOS 设备", path: "/devices", color: "text-blue-600", bg: "bg-blue-50" },
                  { icon: FileSearch, label: "新建检测任务", sub: "开始安全扫描", path: "/tasks", color: "text-violet-600", bg: "bg-violet-50" },
                  { icon: Database, label: "上传 IOC 规则", sub: "增强检测能力", path: "/ioc", color: "text-emerald-600", bg: "bg-emerald-50" },
                ].map(({ icon: Icon, label, sub, path, color, bg }) => (
                  <button
                    key={path}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors group text-left"
                    onClick={() => navigate(path)}
                  >
                    <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{sub}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, iconBg, iconColor, onClick, highlight, trend,
}: {
  label: string;
  value: number | null;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
  highlight?: boolean;
  trend?: "online" | "offline";
}) {
  return (
    <div
      className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all duration-200 group ${
        highlight ? "border-red-200" : "border-border"
      }`}
      style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px 0 oklch(0.10 0.020 258 / 0.10), 0 2px 4px -1px oklch(0.10 0.020 258 / 0.06)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)")}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
        {trend === "online" && <span className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />在线</span>}
      </div>
      <div>
        {value === null ? (
          <Skeleton className="h-8 w-12 mb-1" />
        ) : (
          <p className={`text-3xl font-bold tabular-nums tracking-tight leading-none ${highlight ? "text-red-600" : "text-foreground"}`}>
            {value}
          </p>
        )}
        <p className="text-[11px] font-medium text-muted-foreground mt-2">{label}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>
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

function TaskStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending:   { label: "等待中", className: "bg-slate-50 text-slate-500 border-slate-200" },
    running:   { label: "检测中", className: "bg-blue-50 text-blue-700 border-blue-200" },
    completed: { label: "已完成", className: "bg-green-50 text-green-700 border-green-200" },
    failed:    { label: "失败",   className: "bg-red-50 text-red-700 border-red-200" },
    cancelled: { label: "已取消", className: "bg-slate-50 text-slate-500 border-slate-200" },
  };
  const c = config[status] ?? config.pending;
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold border rounded-full px-2 py-0.5 ${c.className}`}>
      {c.label}
    </span>
  );
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("zh-CN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
