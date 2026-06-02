import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Database, Plus, Trash2, Upload, FileJson, CheckCircle2, Info,
  AlertTriangle, Shield, Zap, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const SAMPLE_STIX2 = `{
  "type": "bundle",
  "id": "bundle--example",
  "objects": [
    {
      "type": "indicator",
      "id": "indicator--1",
      "name": "Pegasus C2 Domain",
      "pattern": "[domain-name:value = 'samsungtechwin.com']",
      "pattern_type": "stix",
      "valid_from": "2024-01-01T00:00:00Z"
    }
  ]
}`;

export default function IocManager() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", content: "", filename: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [useManual, setUseManual] = useState(false);

  const utils = trpc.useUtils();
  const { data: iocFiles, isLoading } = trpc.ioc.list.useQuery();

  const uploadMutation = trpc.ioc.upload.useMutation({
    onSuccess: () => {
      utils.ioc.list.invalidate();
      setUploadOpen(false);
      resetForm();
      toast.success("IOC 文件上传成功");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.ioc.toggleActive.useMutation({
    onSuccess: () => utils.ioc.list.invalidate(),
    onError: () => toast.error("操作失败"),
  });

  const deleteMutation = trpc.ioc.delete.useMutation({
    onSuccess: () => { utils.ioc.list.invalidate(); toast.success("IOC 文件已删除"); },
    onError: () => toast.error("删除失败"),
  });

  const resetForm = () => {
    setForm({ name: "", description: "", content: "", filename: "" });
    setUploadFile(null);
    setUseManual(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setForm((f) => ({ ...f, filename: file.name, content: base64, name: f.name || file.name.replace(/\.[^.]+$/, "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleManualContent = (text: string) => {
    const base64 = btoa(unescape(encodeURIComponent(text)));
    setForm((f) => ({ ...f, content: base64, filename: f.filename || "manual-ioc.json" }));
  };

  const handleUpload = () => {
    if (!form.name) { toast.error("请输入规则集名称"); return; }
    if (!form.content) { toast.error("请上传文件或输入 STIX2 内容"); return; }
    uploadMutation.mutate({ name: form.name, description: form.description, content: form.content, filename: form.filename || "ioc.json" });
  };

  const activeCount = iocFiles?.filter((f) => f.isActive).length ?? 0;
  const totalIndicators = iocFiles?.reduce((sum, f) => sum + (f.indicatorCount ?? 0), 0) ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">IOC 规则库</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 STIX2 格式的威胁情报指标文件</p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5 shadow-sm">
          <Plus className="w-3.5 h-3.5" />上传 IOC 文件
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5 stagger-children">
        {[
          { label: "规则文件", value: iocFiles?.length ?? 0, icon: Database, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "已启用", value: activeCount, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "总指标数", value: totalIndicators, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-border px-4 py-3.5 flex items-center gap-3" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/70 border border-blue-200 mb-5">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-blue-900">STIX2 格式说明</p>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            支持 STIX 2.0/2.1 格式的 JSON 文件，包含 <code className="bg-blue-100 px-1 rounded font-mono">indicator</code> 类型对象。
            可从 MISP、OpenCTI、Amnesty Tech、Citizen Lab 等平台导出 STIX2 格式的 IOC 文件。
            内置规则集已覆盖 Pegasus、Predator、Stalkerware 等主流间谍软件的域名、进程、文件路径等指标。
          </p>
        </div>
      </div>

      {/* IOC File List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : (iocFiles?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-dashed border-border">
          <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <Database className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-semibold text-foreground">暂无 IOC 规则文件</p>
          <p className="text-xs text-muted-foreground mt-1.5 mb-5 max-w-xs">
            上传 STIX2 格式的 IOC 文件以增强检测能力，覆盖更多已知间谍软件特征
          </p>
          <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
            <Zap className="w-3.5 h-3.5" />上传第一个 IOC 文件
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}>
          <div className="divide-y divide-border">
            {iocFiles?.map((ioc) => (
              <div
                key={ioc.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/20 ${!ioc.isActive ? "opacity-60" : ""}`}
              >
                <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ${ioc.isActive ? "bg-green-50" : "bg-slate-100"}`}>
                  <FileJson className={`w-5 h-5 ${ioc.isActive ? "text-green-600" : "text-slate-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{ioc.name}</p>
                    <span className="inline-flex items-center text-[11px] font-medium border rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                      STIX2
                    </span>
                    {ioc.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 bg-green-50 text-green-700 border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />已启用
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[11px] font-medium border rounded-full px-2 py-0.5 bg-slate-50 text-slate-500 border-slate-200">
                        已禁用
                      </span>
                    )}
                  </div>
                  {ioc.description && (
                    <p className="text-xs text-muted-foreground mt-1">{ioc.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">{ioc.indicatorCount ?? 0} 条指标</span>
                    <span>{formatFileSize(ioc.fileSize ?? 0)}</span>
                    <span>上传于 {formatDate(ioc.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{ioc.isActive ? "启用" : "禁用"}</span>
                    <Switch
                      checked={ioc.isActive ?? false}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: ioc.id, isActive: checked })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"
                    onClick={() => deleteMutation.mutate({ id: ioc.id })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">上传 IOC 规则文件</DialogTitle>
            <DialogDescription>上传 STIX2 格式的威胁情报指标文件以增强检测能力</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">规则集名称 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="如：Pegasus IOC 2024"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">描述 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Input
                placeholder="规则集来源、版本说明等"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-10"
              />
            </div>

            {/* Upload Method Toggle */}
            <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg w-fit">
              <button
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-150 ${!useManual ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setUseManual(false)}
              >
                上传文件
              </button>
              <button
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-150 ${useManual ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setUseManual(true)}
              >
                手动输入
              </button>
            </div>

            {!useManual ? (
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/30 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => document.getElementById("ioc-file")?.click()}
              >
                <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {uploadFile ? uploadFile.name : "点击选择 STIX2 JSON 文件"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {uploadFile ? `${formatFileSize(uploadFile.size)}` : "支持 .json、.stix、.stix2 格式"}
                </p>
                <input
                  type="file"
                  id="ioc-file"
                  className="hidden"
                  accept=".json,.stix,.stix2"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">STIX2 JSON 内容</Label>
                <Textarea
                  placeholder={SAMPLE_STIX2}
                  className="font-mono text-xs h-48 bg-muted/20"
                  onChange={(e) => {
                    handleManualContent(e.target.value);
                    setForm((f) => ({ ...f, filename: f.filename || "manual-ioc.json" }));
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetForm(); }}>取消</Button>
            <Button onClick={handleUpload} disabled={uploadMutation.isPending} className="gap-1.5 shadow-sm">
              {uploadMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  上传中...
                </span>
              ) : (
                <><Upload className="w-3.5 h-3.5" />上传</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
