import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Smartphone,
  RefreshCw,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  HelpCircle,
  ChevronRight,
  Cpu,
  Hash,
  Info,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  connected: { label: "已连接", icon: <Wifi className="w-3 h-3" />, className: "bg-green-50 text-green-700 border-green-200" },
  disconnected: { label: "未连接", icon: <WifiOff className="w-3 h-3" />, className: "bg-gray-50 text-gray-500 border-gray-200" },
  unknown: { label: "未知", icon: <HelpCircle className="w-3 h-3" />, className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
};

export default function Devices() {
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    udid: "", name: "", model: "", iosVersion: "", serialNumber: "",
  });

  const utils = trpc.useUtils();
  const { data: devices, isLoading } = trpc.devices.list.useQuery();

  const scanMutation = trpc.devices.scan.useMutation({
    onSuccess: (data) => {
      utils.devices.list.invalidate();
      toast.success(`扫描完成，发现 ${data.found} 台设备`);
    },
    onError: () => toast.error("扫描失败"),
  });

  const addMutation = trpc.devices.add.useMutation({
    onSuccess: () => {
      utils.devices.list.invalidate();
      setAddOpen(false);
      setAddForm({ udid: "", name: "", model: "", iosVersion: "", serialNumber: "" });
      toast.success("设备添加成功");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.devices.delete.useMutation({
    onSuccess: () => {
      utils.devices.list.invalidate();
      toast.success("设备已删除");
    },
    onError: () => toast.error("删除失败"),
  });

  const updateStatusMutation = trpc.devices.updateStatus.useMutation({
    onSuccess: () => utils.devices.list.invalidate(),
  });

  const handleAdd = () => {
    if (!addForm.udid) { toast.error("UDID 不能为空"); return; }
    addMutation.mutate(addForm);
  };

  const connected = devices?.filter((d) => d.status === "connected") ?? [];
  const others = devices?.filter((d) => d.status !== "connected") ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">iOS 设备管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">识别并管理已连接的 iOS 设备</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${scanMutation.isPending ? "animate-spin" : ""}`} />
            扫描设备
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            手动添加
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">设备识别说明</p>
          <p className="text-blue-700 mt-0.5">
            点击「扫描设备」可自动识别通过 USB 连接的 iOS 设备（需要 libimobiledevice）。
            也可手动输入 UDID 添加设备。支持 iPhone 5s 及更新机型，推荐 iPhone 11+ 运行当前 iOS 主线版本。
          </p>
        </div>
      </div>

      {/* Device List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (devices?.length ?? 0) === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Smartphone className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">暂无设备</p>
            <p className="text-xs text-muted-foreground mt-1">连接 iOS 设备后点击「扫描设备」，或手动添加</p>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => scanMutation.mutate()}>
                <RefreshCw className="w-4 h-4 mr-1.5" />扫描设备
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />手动添加
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connected.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                已连接 ({connected.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {connected.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onDelete={() => deleteMutation.mutate({ id: device.id })}
                    onStatusChange={(status) => updateStatusMutation.mutate({ id: device.id, status })}
                  />
                ))}
              </div>
            </div>
          )}
          {others.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                其他设备 ({others.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {others.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onDelete={() => deleteMutation.mutate({ id: device.id })}
                    onStatusChange={(status) => updateStatusMutation.mutate({ id: device.id, status })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Device Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>手动添加设备</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>UDID <span className="text-red-500">*</span></Label>
              <Input
                placeholder="设备 UDID（40 或 25 位）"
                value={addForm.udid}
                onChange={(e) => setAddForm({ ...addForm, udid: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>设备名称</Label>
                <Input
                  placeholder="如：iPhone 15 Pro"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>型号</Label>
                <Input
                  placeholder="如：iPhone16,1"
                  value={addForm.model}
                  onChange={(e) => setAddForm({ ...addForm, model: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>iOS 版本</Label>
                <Input
                  placeholder="如：17.4.1"
                  value={addForm.iosVersion}
                  onChange={(e) => setAddForm({ ...addForm, iosVersion: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>序列号</Label>
                <Input
                  placeholder="如：F2LXQ8XXXXXX"
                  value={addForm.serialNumber}
                  onChange={(e) => setAddForm({ ...addForm, serialNumber: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? "添加中..." : "添加设备"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeviceCard({ device, onDelete, onStatusChange }: {
  device: any;
  onDelete: () => void;
  onStatusChange: (status: "connected" | "disconnected" | "unknown") => void;
}) {
  const statusCfg = STATUS_CONFIG[device.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.unknown;

  return (
    <Card className="border border-border hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2.5 rounded-xl bg-slate-100 shrink-0">
              <Smartphone className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate">{device.name ?? device.model ?? "iPhone"}</p>
                <Badge variant="outline" className={`text-xs flex items-center gap-1 ${statusCfg.className}`}>
                  {statusCfg.icon}
                  {statusCfg.label}
                </Badge>
              </div>
              <div className="mt-2 space-y-1">
                <InfoRow icon={<Cpu className="w-3 h-3" />} label="型号" value={device.productType ?? device.model ?? "-"} />
                <InfoRow icon={<Info className="w-3 h-3" />} label="iOS" value={device.iosVersion ? `${device.iosVersion} (${device.buildVersion ?? ""})` : "-"} />
                <InfoRow icon={<Hash className="w-3 h-3" />} label="UDID" value={device.udid} mono />
                {device.serialNumber && (
                  <InfoRow icon={<Hash className="w-3 h-3" />} label="序列号" value={device.serialNumber} mono />
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            最后活跃：{new Date(device.lastSeen).toLocaleString("zh-CN")}
          </p>
          <button
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
            onClick={() => onStatusChange(device.status === "connected" ? "disconnected" : "connected")}
          >
            切换状态 <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon, label, value, mono }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="text-muted-foreground/60">{icon}</span>
      <span className="shrink-0">{label}:</span>
      <span className={`truncate ${mono ? "font-mono text-foreground/70" : ""}`}>{value}</span>
    </div>
  );
}
