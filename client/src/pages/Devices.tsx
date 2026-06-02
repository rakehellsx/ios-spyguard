import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Smartphone, Plus, RefreshCw, Wifi, WifiOff, Trash2,
  Info, Cpu, Hash, Shield, Calendar,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  connected: { label: "已连接", dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  disconnected: { label: "未连接", dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
  unknown: { label: "未知", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
};

export default function Devices() {
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ udid: "", name: "", model: "", iosVersion: "", serialNumber: "" });

  const utils = trpc.useUtils();
  const { data: devices, isLoading } = trpc.devices.list.useQuery();

  const scanMutation = trpc.devices.scan.useMutation({
    onSuccess: (data) => { utils.devices.list.invalidate(); toast.success(`扫描完成，发现 ${data.found} 台设备`); },
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
    onSuccess: () => { utils.devices.list.invalidate(); toast.success("设备已删除"); },
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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">设备管理</h1>
          <p className="text-sm text-muted-foreground mt-1">识别并管理已连接的 iOS 设备</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanMutation.isPending ? "animate-spin" : ""}`} />
            扫描设备
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" />手动添加
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50/70 border border-blue-100 mb-7">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-blue-900">设备识别说明</p>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            通过 USB 连接 iOS 设备并信任此电脑后，点击「扫描设备」自动识别（需要 libimobiledevice）。
            也可手动输入 UDID 添加设备进行离线分析。支持 iPhone 5s 及更新机型。
          </p>
        </div>
      </div>

      {/* Device list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : (devices?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-dashed border-border">
          <div className="w-20 h-20 rounded-3xl bg-muted/40 flex items-center justify-center mb-5">
            <Smartphone className="w-10 h-10 text-muted-foreground/25" />
          </div>
          <p className="text-base font-bold text-foreground">暂无 iOS 设备</p>
          <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-xs leading-relaxed">
            通过 USB 连接 iOS 设备后点击扫描，或手动输入 UDID 添加设备
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => scanMutation.mutate()} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />扫描设备
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />手动添加
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {connected.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h2 className="text-sm font-semibold text-foreground">已连接设备</h2>
                <span className="text-xs text-muted-foreground">({connected.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {connected.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onDelete={() => deleteMutation.mutate({ id: device.id })}
                    onStatusChange={(status) => updateStatusMutation.mutate({ id: device.id, status })}
                  />
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <h2 className="text-sm font-semibold text-foreground">其他设备</h2>
                <span className="text-xs text-muted-foreground">({others.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {others.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onDelete={() => deleteMutation.mutate({ id: device.id })}
                    onStatusChange={(status) => updateStatusMutation.mutate({ id: device.id, status })}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Add device dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">手动添加设备</DialogTitle>
            <DialogDescription>输入设备信息以手动添加 iOS 设备进行离线分析</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">UDID <span className="text-red-500">*</span></Label>
              <Input
                placeholder="设备 UDID（40 或 25 位）"
                value={addForm.udid}
                onChange={(e) => setAddForm({ ...addForm, udid: e.target.value })}
                className="font-mono text-xs h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">设备名称</Label>
                <Input
                  placeholder="如：iPhone 15 Pro"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">型号标识</Label>
                <Input
                  placeholder="如：iPhone16,1"
                  value={addForm.model}
                  onChange={(e) => setAddForm({ ...addForm, model: e.target.value })}
                  className="font-mono text-xs h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">iOS 版本</Label>
                <Input
                  placeholder="如：17.4.1"
                  value={addForm.iosVersion}
                  onChange={(e) => setAddForm({ ...addForm, iosVersion: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">序列号</Label>
                <Input
                  placeholder="如：F2LXQ8XXXXXX"
                  value={addForm.serialNumber}
                  onChange={(e) => setAddForm({ ...addForm, serialNumber: e.target.value })}
                  className="font-mono text-xs h-10"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending} className="gap-1.5 shadow-sm">
              {addMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  添加中...
                </span>
              ) : (
                <><Plus className="w-3.5 h-3.5" />添加设备</>
              )}
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
  const isConnected = device.status === "connected";

  return (
    <div
      className="bg-white rounded-2xl border border-border overflow-hidden transition-all duration-200 group"
      style={{ boxShadow: "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px 0 oklch(0.10 0.020 258 / 0.10), 0 2px 4px -1px oklch(0.10 0.020 258 / 0.06)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 3px 0 oklch(0.10 0.020 258 / 0.07), 0 1px 2px -1px oklch(0.10 0.020 258 / 0.04)")}
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isConnected ? "bg-primary/10" : "bg-muted/50"}`}>
            <Smartphone className={`w-6 h-6 ${isConnected ? "text-primary" : "text-muted-foreground/40"}`} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold border rounded-full px-2.5 py-1 ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${isConnected ? "animate-pulse" : ""}`} />
              {statusCfg.label}
            </span>
            <button
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors opacity-0 group-hover:opacity-100"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <h3 className="font-bold text-[15px] text-foreground leading-tight">
          {device.name ?? device.model ?? "iOS 设备"}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">{device.productType ?? device.model ?? "—"}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-border mx-5" />

      {/* Meta info */}
      <div className="px-5 py-4 space-y-2.5">
        {device.iosVersion && (
          <MetaRow icon={<Shield className="w-3.5 h-3.5" />} label="iOS" value={`${device.iosVersion}${device.buildVersion ? ` (${device.buildVersion})` : ""}`} />
        )}
        {device.udid && (
          <MetaRow icon={<Hash className="w-3.5 h-3.5" />} label="UDID" value={device.udid} mono />
        )}
        {device.serialNumber && (
          <MetaRow icon={<Cpu className="w-3.5 h-3.5" />} label="序列号" value={device.serialNumber} mono />
        )}
        <MetaRow
          icon={<Calendar className="w-3.5 h-3.5" />}
          label="最后在线"
          value={new Date(device.lastSeen).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        />
      </div>

      {/* Footer actions */}
      <div className="border-t border-border px-4 py-3 flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          className="flex-1 h-8 text-xs gap-1.5"
          onClick={() => onStatusChange(isConnected ? "disconnected" : "connected")}
        >
          {isConnected ? (
            <><WifiOff className="w-3 h-3" />断开连接</>
          ) : (
            <><Wifi className="w-3 h-3" />标记连接</>
          )}
        </Button>
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MetaRow({ icon, label, value, mono }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground/40 shrink-0">{icon}</span>
      <span className="text-[11px] text-muted-foreground shrink-0 w-10">{label}</span>
      <span className={`text-[12px] text-foreground/80 truncate ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
    </div>
  );
}
