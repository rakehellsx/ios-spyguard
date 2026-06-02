import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Database, Plus, Trash2, Upload, FileJson, CheckCircle2, Info,
  Shield, AlertTriangle,
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
  const [form, setForm] = useState({
    name: "",
    description: "",
    content: "",
    filename: "",
  });
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
    onSuccess: () => {
      utils.ioc.list.invalidate();
      toast.success("IOC 文件已删除");
    },
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
      setForm((f) => ({
        ...f,
        filename: file.name,
        content: base64,
        name: f.name || file.name.replace(/\.[^.]+$/, ""),
      }));
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
    uploadMutation.mutate({
      name: form.name,
      description: form.description,
      content: form.content,
      filename: form.filename || "ioc.json",
    });
  };

  const activeCount = iocFiles?.filter((f) => f.isActive).length ?? 0;
  const totalIndicators = iocFiles?.reduce((sum, f) => sum + (f.indicatorCount ?? 0), 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">IOC 规则库管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理 STIX2 格式的威胁情报指标文件</p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />上传 IOC 文件
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50"><Database className="w-4 h-4 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">规则文件</p>
              <p className="text-xl font-bold">{iocFiles?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">已启用</p>
              <p className="text-xl font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">总指标数</p>
              <p className="text-xl font-bold">{totalIndicators}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">STIX2 格式说明</p>
          <p className="text-blue-700 mt-0.5">
            支持 STIX 2.0/2.1 格式的 JSON 文件，包含 <code className="bg-blue-100 px-1 rounded">indicator</code> 类型对象。
            可从 MISP、OpenCTI、Amnesty Tech、Citizen Lab 等平台导出 STIX2 格式的 IOC 文件。
            内置规则集已覆盖 Pegasus、Predator、Stalkerware 等主流间谍软件的域名、进程、文件路径等指标。
          </p>
        </div>
      </div>

      {/* IOC File List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (iocFiles?.length ?? 0) === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Database className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">暂无 IOC 规则文件</p>
            <p className="text-xs text-muted-foreground mt-1">上传 STIX2 格式的 IOC 文件以增强检测能力</p>
            <Button size="sm" className="mt-4" onClick={() => setUploadOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />上传 IOC 文件
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {iocFiles?.map((ioc) => (
            <Card key={ioc.id} className={`border transition-colors ${ioc.isActive ? "border-border" : "border-border opacity-60"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 ${ioc.isActive ? "bg-green-50" : "bg-gray-50"}`}>
                      <FileJson className={`w-5 h-5 ${ioc.isActive ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{ioc.name}</p>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          STIX2
                        </Badge>
                        {ioc.isActive ? (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            已启用
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">
                            已禁用
                          </Badge>
                        )}
                      </div>
                      {ioc.description && (
                        <p className="text-xs text-muted-foreground mt-1">{ioc.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{ioc.indicatorCount ?? 0} 条指标</span>
                        <span>{formatFileSize(ioc.fileSize ?? 0)}</span>
                        <span>上传于 {formatDate(ioc.createdAt)}</span>
                      </div>
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
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: ioc.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>上传 IOC 规则文件</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>规则集名称 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="如：Pegasus IOC 2024"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>描述（可选）</Label>
              <Input
                placeholder="规则集来源、版本说明等"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Upload Method Toggle */}
            <div className="flex items-center gap-2">
              <button
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${!useManual ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50"}`}
                onClick={() => setUseManual(false)}
              >
                上传文件
              </button>
              <button
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${useManual ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50"}`}
                onClick={() => setUseManual(true)}
              >
                手动输入
              </button>
            </div>

            {!useManual ? (
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">支持 STIX2 JSON 格式</p>
                <input
                  type="file"
                  id="ioc-file"
                  className="hidden"
                  accept=".json,.stix,.stix2"
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("ioc-file")?.click()}
                >
                  选择文件
                </Button>
                {uploadFile && (
                  <p className="text-xs text-green-600 mt-2">
                    已选择：{uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>STIX2 JSON 内容</Label>
                <Textarea
                  placeholder={SAMPLE_STIX2}
                  className="font-mono text-xs h-48"
                  onChange={(e) => {
                    handleManualContent(e.target.value);
                    setForm((f) => ({ ...f, filename: f.filename || "manual-ioc.json" }));
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetForm(); }}>取消</Button>
            <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? "上传中..." : "上传"}
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
  if (!date) return "-";
  return new Date(date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
