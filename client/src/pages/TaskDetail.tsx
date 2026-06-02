import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Download, Shield, AlertTriangle, CheckCircle2, XCircle,
  Activity, Filter, Search, ChevronDown, ChevronUp, FileText,
  BarChart3, List, Info, Clock,
} from "lucide-react";
import { toast } from "sonner";

const SEVERITY_CONFIG: Record<string, { label: string; className: string; dot: string; bar: string }> = {
  critical:      { label: "严重", className: "bg-red-50 text-red-700 border-red-200",    dot: "bg-red-500",    bar: "bg-red-500" },
  high:          { label: "高危", className: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", bar: "bg-orange-500" },
  medium:        { label: "中危", className: "bg-amber-50 text-amber-700 border-amber-200",  dot: "bg-amber-500",  bar: "bg-amber-500" },
  low:           { label: "低危", className: "bg-blue-50 text-blue-700 border-blue-200",   dot: "bg-blue-400",   bar: "bg-blue-400" },
  informational: { label: "信息", className: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400",  bar: "bg-slate-400" },
};

const OBJECT_TYPE_LABELS: Record<string, string> = {
  firmware: "固件", filesystem: "文件系统", process: "进程", network: "网络",
  memory_runtime_artifact: "内存/运行态", application: "应用", permission: "权限",
  configuration_profile: "配置文件", log_cache: "日志/缓存",
};

const SCAN_TYPE_LABELS: Record<string, string> = {
  encrypted_backup: "加密备份", filesystem_dump: "文件系统转储", sysdiagnose: "Sysdiagnose/日志目录",
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
    { taskId }, { enabled: !!taskId }
  );
  const { data: report, isLoading: reportLoading } = trpc.scan.report.useQuery(
    { taskId }, { enabled: task?.status === "completed" }
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
      <div className="p-6 lg:p-8 space-y-4 max-w-[1400px] mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm">任务不存在</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/tasks")}>
          返回任务列表
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-[1400px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 mt-0.5 rounded-xl hover:bg-muted"
            onClick={() => navigate("/tasks")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-[22px] font-bold text-foreground tracking-tight">{task.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {SCAN_TYPE_LABELS[task.scanType]} · 创建于 {formatDate(task.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TaskStatusBadge status={task.status} />
          {task.status === "completed" && (
            <Button size="sm" onClick={handleDownloadReport} disabled={reportLoading} className="gap-1.5 shadow-sm">
              <Download className="w-3.5 h-3.5" />导出报告
            </Button>
          )}
        </div>
      </div>

      {/* Running Progress */}
      {task.status === "running" && (
        <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
            <p className="text-sm font-semibold text-blue-900">检测进行中...</p>
            <span className="ml-auto text-sm font-bold text-blue-700 tabular-nums">{task.progress}%</span>
          </div>
          <Progress value={task.progress ?? 0} className="h-2 mb-2" />
          <p className="text-xs text-blue-600/80">{task.progressMessage ?? "正在分析..."}</p>
        </div>
      )}

      {/* Failed */}
      {task.status === "failed" && task.errorMessage && (
        <div className="bg-red-50/60 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">检测失败</p>
            <p className="text-xs text-red-700 mt-0.5">{task.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
          <SummaryCard label="结果总数" value={summary.total} icon={<List className="w-4 h-4" />} color="text-slate-600" bg="bg-slate-50" iconColor="text-slate-500" />
          <SummaryCard label="威胁命中" value={summary.detected} icon={<AlertTriangle className="w-4 h-4" />} color="text-red-600" bg="bg-red-50" iconColor="text-red-500" highlight={summary.detected > 0} />
          <SummaryCard label="对象类别" value={Object.keys(summary.byObjectType ?? {}).length} icon={<Shield className="w-4 h-4" />} color="text-blue-600" bg="bg-blue-50" iconColor="text-blue-500" />
          <SummaryCard
            label="严重/高危"
            value={(summary.bySeverity?.critical ?? 0) + (summary.bySeverity?.high ?? 0)}
            icon={<AlertTriangle className="w-4 h-4" />}
            color="text-orange-600"
            bg="bg-orange-50"
            iconColor="text-orange-500"
            highlight={(summary.bySeverity?.critical ?? 0) + (summary.bySeverity?.high ?? 0) > 0}
          />
        </div>
      )}

      {/* Tabs */}
      {task.status === "completed" && (
        <Tabs defaultValue="results">
          <TabsList className="h-9 bg-muted/50 rounded-xl p-1 border border-border">
            <TabsTrigger value="results" className="rounded-md text-xs gap-1.5 h-7">
              <List className="w-3 h-3" />检测结果
            </TabsTrigger>
            <TabsTrigger value="stats" className="rounded-md text-xs gap-1.5 h-7">
              <BarChart3 className="w-3 h-3" />统计分析
            </TabsTrigger>
            <TabsTrigger value="report" className="rounded-md text-xs gap-1.5 h-7">
              <FileText className="w-3 h-3" />检测报告
            </TabsTrigger>
          </TabsList>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/30 rounded-xl border border-border">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索值、路径、描述..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm bg-white"
                />
              </div>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-28 h-8 text-xs bg-white">
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
                <SelectTrigger className="w-32 h-8 text-xs bg-white">
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
                <SelectTrigger className="w-28 h-8 text-xs bg-white">
                  <SelectValue placeholder="来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  <SelectItem value="ioc">IOC 命中</SelectItem>
                  <SelectItem value="heuristic">启发式</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterDetected} onValueChange={setFilterDetected}>
                <SelectTrigger className="w-28 h-8 text-xs bg-white">
                  <SelectValue placeholder="检测状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="detected">仅威胁</SelectItem>
                  <SelectItem value="clean">仅正常</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                显示 <span className="font-semibold text-foreground">{filteredResults.length}</span> / {results?.length ?? 0} 条结果
              </p>
              {(filterSeverity !== "all" || filterObjectType !== "all" || filterSource !== "all" || filterDetected !== "all" || search) && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => { setFilterSeverity("all"); setFilterObjectType("all"); setFilterSource("all"); setFilterDetected("all"); setSearch(""); }}
                >
                  清除筛选
                </button>
              )}
            </div>

            {/* Results Table */}
            {resultsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-dashed border-border">
                <Filter className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">无匹配结果</p>
                <p className="text-xs text-muted-foreground mt-1">尝试调整筛选条件</p>
              </div>
            ) : (
              <div className="bg-white border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-24">对象类型</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-20">严重性</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-20">来源</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">值</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">路径</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-16">状态</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r) => (
                      <>
                        <tr
                          key={r.id}
                          className={`border-b border-border/60 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors ${expandedRow === r.id ? "bg-muted/20" : ""}`}
                          onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                        >
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5">
                              {OBJECT_TYPE_LABELS[r.objectType] ?? r.objectType}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 ${SEVERITY_CONFIG[r.severity]?.className ?? ""}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_CONFIG[r.severity]?.dot ?? "bg-slate-400"}`} />
                              {SEVERITY_CONFIG[r.severity]?.label ?? r.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center text-[11px] font-medium border rounded-full px-2 py-0.5 ${r.source === "ioc" ? "bg-red-50 text-red-700 border-red-200" : "bg-violet-50 text-violet-700 border-violet-200"}`}>
                              {r.source === "ioc" ? "IOC" : "启发式"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs truncate block max-w-48 text-foreground/80">{r.value}</span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground truncate block max-w-48">{r.path}</span>
                          </td>
                          <td className="px-4 py-3">
                            {r.isDetected ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                                <AlertTriangle className="w-3 h-3" />告警
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                                <CheckCircle2 className="w-3 h-3" />正常
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            {expandedRow === r.id
                              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </td>
                        </tr>
                        {expandedRow === r.id && (
                          <tr key={`${r.id}-detail`} className="bg-muted/10 border-b border-border/60">
                            <td colSpan={7} className="px-5 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-1.5">描述</p>
                                  <p className="text-foreground leading-relaxed">{r.description}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-1.5">匹配文本</p>
                                  <p className="font-mono bg-muted/60 rounded-lg px-3 py-2 text-foreground/80">{r.matchedText}</p>
                                </div>
                                {r.matchedIndicator && (
                                  <div>
                                    <p className="font-semibold text-muted-foreground mb-1.5">命中 IOC 指标</p>
                                    <p className="font-mono text-red-700 bg-red-50 rounded-lg px-3 py-2">{r.matchedIndicator}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-muted-foreground mb-1.5">置信度</p>
                                  <span className={`inline-flex items-center text-[11px] font-medium border rounded-full px-2 py-0.5 ${
                                    r.confidence === "high" ? "bg-red-50 text-red-700 border-red-200" :
                                    r.confidence === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-slate-50 text-slate-600 border-slate-200"
                                  }`}>
                                    {r.confidence === "high" ? "高" : r.confidence === "medium" ? "中" : "低"}
                                  </span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* By Severity */}
                <div className="bg-white rounded-2xl border border-border p-5" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
                  <h3 className="text-sm font-bold text-foreground mb-4">按严重性分布</h3>
                  <div className="space-y-3">
                    {Object.entries(SEVERITY_CONFIG).map(([sev, cfg]) => {
                      const count = summary.bySeverity?.[sev] ?? 0;
                      const total = summary.total ?? 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={sev}>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              <span className="font-medium text-foreground">{cfg.label}</span>
                            </div>
                            <span className="text-muted-foreground tabular-nums">{count} <span className="text-muted-foreground/60">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* By Object Type */}
                <div className="bg-white rounded-2xl border border-border p-5" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
                  <h3 className="text-sm font-bold text-foreground mb-4">按对象类别分布</h3>
                  <div className="space-y-2.5">
                    {Object.entries(summary.byObjectType ?? {})
                      .sort((a: any, b: any) => b[1] - a[1])
                      .map(([type, count]: any) => {
                        const total = summary.total ?? 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={type} className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground w-24 shrink-0">{OBJECT_TYPE_LABELS[type] ?? type}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-8 text-right font-semibold text-foreground tabular-nums">{count}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* IOC vs Heuristic */}
                <div className="bg-white rounded-2xl border border-border p-5" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
                  <h3 className="text-sm font-bold text-foreground mb-4">IOC 命中 vs 启发式</h3>
                  {(() => {
                    const iocCount = results?.filter((r) => r.source === "ioc").length ?? 0;
                    const heuCount = results?.filter((r) => r.source === "heuristic").length ?? 0;
                    const total = iocCount + heuCount || 1;
                    return (
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-medium text-red-700">IOC 命中</span>
                            <span className="text-muted-foreground tabular-nums">{iocCount} ({Math.round(iocCount / total * 100)}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${iocCount / total * 100}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-medium text-violet-700">启发式命中</span>
                            <span className="text-muted-foreground tabular-nums">{heuCount} ({Math.round(heuCount / total * 100)}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${heuCount / total * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100 mt-2">
                          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 leading-relaxed">IOC 命中具有更高证据价值；启发式命中应作为调查线索</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Task Info */}
                <div className="bg-white rounded-2xl border border-border p-5" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
                  <h3 className="text-sm font-bold text-foreground mb-4">任务信息</h3>
                  <div className="space-y-2.5">
                    {[
                      { label: "任务 ID", value: `#${task.id}` },
                      { label: "采集方式", value: SCAN_TYPE_LABELS[task.scanType] ?? task.scanType },
                      { label: "创建时间", value: formatDate(task.createdAt) },
                      { label: "开始时间", value: formatDate(task.startedAt) },
                      { label: "完成时间", value: formatDate(task.completedAt) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Report Tab */}
          <TabsContent value="report" className="mt-4">
            <div className="bg-white rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Markdown 检测报告</h3>
                </div>
                <Button size="sm" onClick={handleDownloadReport} disabled={!report?.markdown} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" />下载报告
                </Button>
              </div>
              <div className="p-5">
                {reportLoading ? (
                  <Skeleton className="h-64 w-full rounded-lg" />
                ) : report?.markdown ? (
                  <pre className="text-xs font-mono bg-muted/30 rounded-xl p-5 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto border border-border/60">
                    {report.markdown}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="w-8 h-8 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">报告生成中...</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, color, bg, iconColor, highlight }: {
  label: string; value: number; icon: React.ReactNode;
  color: string; bg: string; iconColor: string; highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border p-4 flex items-center gap-3 ${highlight ? "border-red-200" : "border-border"}`}
      style={{ boxShadow: "0 1px 4px 0 oklch(0.12 0.018 255 / 0.06)" }}
    >
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold tabular-nums tracking-tight leading-tight ${highlight ? "text-red-600" : "text-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending:   { label: "等待中", className: "bg-slate-50 text-slate-500 border-slate-200" },
    running:   { label: "检测中", className: "bg-blue-50 text-blue-700 border-blue-200" },
    completed: { label: "已完成", className: "bg-green-50 text-green-700 border-green-200" },
    failed:    { label: "失败",   className: "bg-red-50 text-red-700 border-red-200" },
    cancelled: { label: "已取消", className: "bg-slate-50 text-slate-400 border-slate-200" },
  };
  const c = config[status] ?? config.pending;
  return (
    <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-1 ${c.className}`}>
      {c.label}
    </span>
  );
}

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
