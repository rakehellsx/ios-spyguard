import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Download, Shield, AlertTriangle, CheckCircle2, XCircle,
  Activity, Clock, Filter, Search, ChevronDown, ChevronUp, FileText,
  BarChart3, List, Info,
} from "lucide-react";
import { toast } from "sonner";

const SEVERITY_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  critical: { label: "严重", className: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  high: { label: "高危", className: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  medium: { label: "中危", className: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  low: { label: "低危", className: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-400" },
  informational: { label: "信息", className: "bg-gray-50 text-gray-600 border-gray-200", dot: "bg-gray-400" },
};

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

const SCAN_TYPE_LABELS: Record<string, string> = {
  encrypted_backup: "加密备份",
  filesystem_dump: "文件系统转储",
  sysdiagnose: "Sysdiagnose/日志目录",
};

export default function TaskDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const taskId = Number(params.id);

  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterObjectType, setFilterObjectType] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterDetected, setFilterDetected] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const { data: task, isLoading: taskLoading } = trpc.scan.get.useQuery(
    { id: taskId },
    { refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false) }
  );
  const { data: results, isLoading: resultsLoading } = trpc.scan.results.useQuery(
    { taskId },
    { enabled: !!taskId }
  );
  const { data: report, isLoading: reportLoading } = trpc.scan.report.useQuery(
    { taskId },
    { enabled: task?.status === "completed" }
  );

  const handleDownloadReport = () => {
    if (!report?.markdown) return;
    const blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spyguard-report-${taskId}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("报告已下载");
  };

  const filteredResults = (results ?? []).filter((r) => {
    if (filterSeverity !== "all" && r.severity !== filterSeverity) return false;
    if (filterObjectType !== "all" && r.objectType !== filterObjectType) return false;
    if (filterSource !== "all" && r.source !== filterSource) return false;
    if (filterDetected === "detected" && !r.isDetected) return false;
    if (filterDetected === "clean" && r.isDetected) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (r.value ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.path ?? "").toLowerCase().includes(q) ||
        (r.matchedIndicator ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const summary = (task?.resultSummary as any) ?? report?.summary;

  if (taskLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">任务不存在</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/tasks")}>
          返回任务列表
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5" onClick={() => navigate("/tasks")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{task.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {SCAN_TYPE_LABELS[task.scanType]} · 创建于 {formatDate(task.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TaskStatusBadge status={task.status} />
          {task.status === "completed" && (
            <Button size="sm" onClick={handleDownloadReport} disabled={reportLoading}>
              <Download className="w-4 h-4 mr-1.5" />
              导出报告
            </Button>
          )}
        </div>
      </div>

      {/* Running Progress */}
      {task.status === "running" && (
        <Card className="border border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
              <p className="text-sm font-medium text-blue-800">检测进行中...</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{task.progressMessage ?? "正在分析..."}</span>
                <span className="font-medium text-blue-700">{task.progress}%</span>
              </div>
              <Progress value={task.progress ?? 0} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed */}
      {task.status === "failed" && task.errorMessage && (
        <Card className="border border-red-200 bg-red-50/30">
          <CardContent className="p-4 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">检测失败</p>
              <p className="text-xs text-red-700 mt-0.5">{task.errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="结果总数" value={summary.total} icon={<List className="w-4 h-4" />} color="text-slate-600" bg="bg-slate-50" />
          <SummaryCard label="威胁命中" value={summary.detected} icon={<AlertTriangle className="w-4 h-4" />} color="text-red-600" bg="bg-red-50" highlight={summary.detected > 0} />
          <SummaryCard label="对象类别" value={Object.keys(summary.byObjectType ?? {}).length} icon={<Shield className="w-4 h-4" />} color="text-blue-600" bg="bg-blue-50" />
          <SummaryCard label="严重/高危" value={(summary.bySeverity?.critical ?? 0) + (summary.bySeverity?.high ?? 0)} icon={<AlertTriangle className="w-4 h-4" />} color="text-orange-600" bg="bg-orange-50" highlight={(summary.bySeverity?.critical ?? 0) + (summary.bySeverity?.high ?? 0) > 0} />
        </div>
      )}

      {/* Tabs */}
      {task.status === "completed" && (
        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results" className="flex items-center gap-1.5">
              <List className="w-3.5 h-3.5" />检测结果
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />统计分析
            </TabsTrigger>
            <TabsTrigger value="report" className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />检测报告
            </TabsTrigger>
          </TabsList>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索值、路径、描述..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="严重性" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部严重性</SelectItem>
                  {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterObjectType} onValueChange={setFilterObjectType}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="对象类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {Object.entries(OBJECT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  <SelectItem value="ioc">IOC 命中</SelectItem>
                  <SelectItem value="heuristic">启发式</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterDetected} onValueChange={setFilterDetected}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="检测状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="detected">仅威胁</SelectItem>
                  <SelectItem value="clean">仅正常</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground mb-2">
              显示 {filteredResults.length} / {results?.length ?? 0} 条结果
            </div>

            {/* Results Table */}
            {resultsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Filter className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">无匹配结果</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-24">对象类型</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-20">严重性</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-20">来源</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">值</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">路径</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-16">状态</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r, idx) => (
                      <>
                        <tr
                          key={r.id}
                          className={`border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer ${expandedRow === r.id ? "bg-muted/20" : ""}`}
                          onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                        >
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-muted-foreground">
                              {OBJECT_TYPE_LABELS[r.objectType] ?? r.objectType}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className={`text-xs ${SEVERITY_CONFIG[r.severity]?.className ?? ""}`}>
                              {SEVERITY_CONFIG[r.severity]?.label ?? r.severity}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className={`text-xs ${r.source === "ioc" ? "bg-red-50 text-red-700 border-red-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                              {r.source === "ioc" ? "IOC" : "启发式"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono text-xs truncate block max-w-48">{r.value}</span>
                          </td>
                          <td className="px-3 py-2.5 hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground truncate block max-w-48">{r.path}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {r.isDetected ? (
                              <span className="flex items-center gap-1 text-xs text-red-600">
                                <AlertTriangle className="w-3 h-3" />告警
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 className="w-3 h-3" />正常
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            {expandedRow === r.id
                              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </td>
                        </tr>
                        {expandedRow === r.id && (
                          <tr key={`${r.id}-detail`} className="bg-muted/10">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-1">描述</p>
                                  <p className="text-foreground">{r.description}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-1">匹配文本</p>
                                  <p className="font-mono bg-muted/50 rounded px-2 py-1">{r.matchedText}</p>
                                </div>
                                {r.matchedIndicator && (
                                  <div>
                                    <p className="font-semibold text-muted-foreground mb-1">命中 IOC 指标</p>
                                    <p className="font-mono text-red-700">{r.matchedIndicator}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-1">置信度</p>
                                  <p>{r.confidence === "high" ? "高" : r.confidence === "medium" ? "中" : "低"}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-4">
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* By Severity */}
                <Card className="border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">按严重性分布</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {Object.entries(SEVERITY_CONFIG).map(([sev, cfg]) => {
                      const count = summary.bySeverity?.[sev] ?? 0;
                      const total = summary.total ?? 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={sev}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              <span className="font-medium">{cfg.label}</span>
                            </div>
                            <span className="text-muted-foreground">{count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cfg.dot}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* By Object Type */}
                <Card className="border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">按对象类别分布</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {Object.entries(summary.byObjectType ?? {})
                      .sort((a: any, b: any) => b[1] - a[1])
                      .map(([type, count]: any) => {
                        const total = summary.total ?? 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={type} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{OBJECT_TYPE_LABELS[type] ?? type}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="w-8 text-right font-medium">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>

                {/* IOC vs Heuristic */}
                <Card className="border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">IOC 命中 vs 启发式</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {(() => {
                      const iocCount = results?.filter((r) => r.source === "ioc").length ?? 0;
                      const heuCount = results?.filter((r) => r.source === "heuristic").length ?? 0;
                      const total = iocCount + heuCount || 1;
                      return (
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-red-700 font-medium">IOC 命中</span>
                              <span>{iocCount} ({Math.round(iocCount / total * 100)}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${iocCount / total * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-purple-700 font-medium">启发式命中</span>
                              <span>{heuCount} ({Math.round(heuCount / total * 100)}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${heuCount / total * 100}%` }} />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            IOC 命中具有更高证据价值；启发式命中应作为调查线索
                          </p>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Task Info */}
                <Card className="border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">任务信息</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2 text-xs">
                    <InfoRow label="任务 ID" value={String(task.id)} />
                    <InfoRow label="采集方式" value={SCAN_TYPE_LABELS[task.scanType] ?? task.scanType} />
                    <InfoRow label="创建时间" value={formatDate(task.createdAt)} />
                    <InfoRow label="开始时间" value={formatDate(task.startedAt)} />
                    <InfoRow label="完成时间" value={formatDate(task.completedAt)} />
                    <InfoRow label="状态" value={task.status} />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Report Tab */}
          <TabsContent value="report" className="mt-4">
            <Card className="border border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold">Markdown 检测报告</CardTitle>
                <Button size="sm" onClick={handleDownloadReport} disabled={!report?.markdown}>
                  <Download className="w-4 h-4 mr-1.5" />下载报告
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {reportLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : report?.markdown ? (
                  <pre className="text-xs font-mono bg-muted/30 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
                    {report.markdown}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">报告生成中...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, color, bg, highlight }: {
  label: string; value: number; icon: React.ReactNode;
  color: string; bg: string; highlight?: boolean;
}) {
  return (
    <Card className={`border ${highlight ? "border-red-200" : "border-border"}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg} ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold ${highlight ? "text-red-600" : "text-foreground"}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
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
    <Badge variant="outline" className={`${c.className}`}>{c.label}</Badge>
  );
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
