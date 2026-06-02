import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Smartphone,
  Shield,
  AlertTriangle,
  Activity,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  FileSearch,
  Database,
} from "lucide-react";
import { useLocation } from "wouter";

const OBJECT_TYPE_LABELS: Record<string, string> = {
  firmware: "固件",
  filesystem: "文件系统",
  process: "进程",
  network: "网络",
  memory_runtime_artifact: "内存/运行态",
  application: "应用",
  permission: "权限",
  configuration_profile: "配置文件",
  log_cache: "日志/缓存",
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "严重", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  high: { label: "高危", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  medium: { label: "中危", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  low: { label: "低危", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  informational: { label: "信息", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: tasks, isLoading: tasksLoading } = trpc.scan.list.useQuery();
  const { data: devices, isLoading: devicesLoading } = trpc.devices.list.useQuery();

  const recentTasks = tasks?.slice(0, 5) ?? [];
  const connectedDevices = devices?.filter((d) => d.status === "connected") ?? [];

  const latestCompletedTask = tasks?.find((t) => t.status === "completed");
  const latestSummary = latestCompletedTask?.resultSummary as any;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">安全概览</h1>
        <p className="text-sm text-muted-foreground mt-0.5">iOS 设备间谍软件检测平台总览</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="已连接设备"
          value={statsLoading ? null : connectedDevices.length}
          total={statsLoading ? null : (stats?.devices ?? 0)}
          icon={<Smartphone className="w-5 h-5" />}
          color="text-blue-600"
          bg="bg-blue-50"
          onClick={() => navigate("/devices")}
        />
        <StatCard
          title="检测任务"
          value={statsLoading ? null : (stats?.tasks ?? 0)}
          icon={<FileSearch className="w-5 h-5" />}
          color="text-purple-600"
          bg="bg-purple-50"
          onClick={() => navigate("/tasks")}
        />
        <StatCard
          title="威胁命中"
          value={statsLoading ? null : (stats?.threats ?? 0)}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="text-red-600"
          bg="bg-red-50"
          onClick={() => navigate("/tasks")}
          highlight={stats?.threats ? stats.threats > 0 : false}
        />
        <StatCard
          title="IOC 规则库"
          value={null}
          icon={<Database className="w-5 h-5" />}
          color="text-green-600"
          bg="bg-green-50"
          onClick={() => navigate("/ioc")}
          label="管理规则"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tasks */}
        <div className="lg:col-span-2">
          <Card className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">最近检测任务</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7"
                onClick={() => navigate("/tasks")}
              >
                查看全部 <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {tasksLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无检测任务</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate("/tasks/new")}
                  >
                    创建第一个任务
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <TaskStatusIcon status={task.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {SCAN_TYPE_LABELS[task.scanType]} · {formatDate(task.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.status === "running" && (
                          <span className="text-xs text-blue-600 font-medium">{task.progress}%</span>
                        )}
                        {task.status === "completed" && (task.resultSummary as any)?.detected > 0 && (
                          <Badge variant="outline" className="text-xs border-red-200 text-red-700 bg-red-50">
                            {(task.resultSummary as any).detected} 威胁
                          </Badge>
                        )}
                        <TaskStatusBadge status={task.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detection Coverage */}
        <div className="space-y-4">
          {/* Object Coverage */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                检测对象覆盖
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {Object.entries(OBJECT_TYPE_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-green-600 font-medium">已覆盖</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Latest Threat Summary */}
          {latestSummary && (
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  最新检测摘要
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {Object.entries(SEVERITY_CONFIG).map(([sev, cfg]) => {
                    const count = latestSummary.bySeverity?.[sev] ?? 0;
                    if (count === 0) return null;
                    return (
                      <div key={sev} className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        <Badge variant="outline" className={`text-xs ${cfg.bg} ${cfg.color} border`}>
                          {count}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">快速操作</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction
              icon={<Smartphone className="w-5 h-5" />}
              label="扫描设备"
              desc="识别已连接 iOS 设备"
              onClick={() => navigate("/devices")}
            />
            <QuickAction
              icon={<FileSearch className="w-5 h-5" />}
              label="新建检测"
              desc="创建数据采集与检测任务"
              onClick={() => navigate("/tasks/new")}
            />
            <QuickAction
              icon={<Database className="w-5 h-5" />}
              label="上传 IOC"
              desc="导入 STIX2 规则文件"
              onClick={() => navigate("/ioc")}
            />
            <QuickAction
              icon={<Shield className="w-5 h-5" />}
              label="查看报告"
              desc="导出 Markdown 检测报告"
              onClick={() => navigate("/tasks")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title, value, total, icon, color, bg, onClick, highlight, label,
}: {
  title: string;
  value: number | null;
  total?: number | null;
  icon: React.ReactNode;
  color: string;
  bg: string;
  onClick?: () => void;
  highlight?: boolean;
  label?: string;
}) {
  return (
    <Card
      className={`border cursor-pointer hover:shadow-md transition-shadow ${highlight ? "border-red-200" : "border-border"}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <div className="mt-2">
              {value === null ? (
                label ? (
                  <span className="text-sm font-medium text-primary">{label}</span>
                ) : (
                  <Skeleton className="h-8 w-16" />
                )
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold ${highlight ? "text-red-600" : "text-foreground"}`}>
                    {value}
                  </span>
                  {total !== undefined && total !== null && total !== value && (
                    <span className="text-sm text-muted-foreground">/ {total}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className={`p-2.5 rounded-xl ${bg}`}>
            <span className={color}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon, label, desc, onClick }: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
    >
      <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

const SCAN_TYPE_LABELS: Record<string, string> = {
  encrypted_backup: "加密备份",
  filesystem_dump: "文件系统转储",
  sysdiagnose: "Sysdiagnose",
};

function TaskStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (status === "running") return <Activity className="w-4 h-4 text-blue-500 shrink-0 animate-pulse" />;
  return <Clock className="w-4 h-4 text-gray-400 shrink-0" />;
}

function TaskStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "等待中", className: "bg-gray-50 text-gray-600 border-gray-200" },
    running: { label: "检测中", className: "bg-blue-50 text-blue-700 border-blue-200" },
    completed: { label: "已完成", className: "bg-green-50 text-green-700 border-green-200" },
    failed: { label: "失败", className: "bg-red-50 text-red-700 border-red-200" },
    cancelled: { label: "已取消", className: "bg-gray-50 text-gray-500 border-gray-200" },
  };
  const c = config[status] ?? config.pending;
  return (
    <Badge variant="outline" className={`text-xs ${c.className}`}>
      {c.label}
    </Badge>
  );
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
