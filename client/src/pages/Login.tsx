import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  Cpu,
  Network,
  FileSearch,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

const FEATURES = [
  { icon: Cpu, label: "固件与进程检测", desc: "深度扫描系统层面的间谍软件痕迹" },
  { icon: Network, label: "网络行为分析", desc: "识别 C2 通信与恶意域名连接" },
  { icon: FileSearch, label: "文件系统扫描", desc: "检测隐藏文件、可疑路径与注入痕迹" },
  { icon: Lock, label: "IOC 规则引擎", desc: "支持 STIX2 格式规则库，覆盖 Pegasus/Predator" },
];

export default function Login() {
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", password: "", displayName: "" });
  const [error, setError] = useState("");

  const utils = trpc.useUtils();

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("登录成功");
      navigate("/");
    },
    onError: (err) => setError(err.message),
  });

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("注册成功，已自动登录");
      navigate("/");
    },
    onError: (err) => setError(err.message),
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginForm.username || !loginForm.password) { setError("请输入用户名和密码"); return; }
    loginMutation.mutate(loginForm);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!registerForm.username || !registerForm.password) { setError("请输入用户名和密码"); return; }
    if (registerForm.password.length < 6) { setError("密码长度至少 6 位"); return; }
    registerMutation.mutate(registerForm);
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, oklch(0.18 0.08 255) 0%, oklch(0.24 0.12 260) 50%, oklch(0.20 0.10 250) 100%)",
        }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, oklch(0.85 0.05 255), transparent)" }}
          />
          <div
            className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-8"
            style={{ background: "radial-gradient(circle, oklch(0.75 0.10 240), transparent)" }}
          />
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg tracking-tight">iOS SpyGuard</p>
              <p className="text-white/50 text-xs">专业间谍软件检测平台</p>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              守护 iOS 设备<br />
              <span className="text-white/70">免受间谍软件威胁</span>
            </h1>
            <p className="mt-4 text-white/60 text-base leading-relaxed max-w-sm">
              基于 MVT SpywareObjects 检测引擎，覆盖固件、文件系统、进程、网络、内存等 9 类对象，检测 Pegasus、Predator、Stalkerware 等主流间谍软件。
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-white/80" />
                </div>
                <div>
                  <p className="text-white/90 text-sm font-medium">{label}</p>
                  <p className="text-white/45 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs">
            基于开源项目 ios-spyguard · MVT SpywareObjects 检测引擎
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-foreground">iOS SpyGuard</span>
        </div>

        <div className="w-full max-w-[380px] animate-fade-in-up">
          <div className="mb-8">
            <h2 className="text-[26px] font-bold text-foreground tracking-tight leading-tight">欢迎回来</h2>
            <p className="text-muted-foreground text-sm mt-2">使用本地账号登录检测平台</p>
          </div>

          <Tabs defaultValue="login" onValueChange={() => setError("")}>
            <TabsList className="grid w-full grid-cols-2 mb-7 h-11 bg-muted/50 rounded-xl p-1 border border-border">
              <TabsTrigger value="login" className="rounded-lg text-sm font-semibold">登录</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg text-sm font-semibold">注册账号</TabsTrigger>
            </TabsList>

            {/* ── Login ── */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">用户名</Label>
                  <Input
                    type="text"
                    placeholder="请输入用户名"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    autoComplete="username"
                    className="h-11 bg-muted/30 border-border/60 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">密码</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="请输入密码"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      autoComplete="current-password"
                      className="h-11 pr-11 bg-muted/30 border-border/60 focus:bg-white transition-colors"
                    />
                    <button
                      type="button"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/15 rounded-lg px-3.5 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold shadow-sm"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      登录中...
                    </span>
                  ) : "登录"}
                </Button>
              </form>
            </TabsContent>

            {/* ── Register ── */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">用户名</Label>
                  <Input
                    type="text"
                    placeholder="3-32 位字母数字"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    autoComplete="username"
                    className="h-11 bg-muted/30 border-border/60 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">
                    显示名称 <span className="text-muted-foreground font-normal">(可选)</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="您的显示名称"
                    value={registerForm.displayName}
                    onChange={(e) => setRegisterForm({ ...registerForm, displayName: e.target.value })}
                    className="h-11 bg-muted/30 border-border/60 focus:bg-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">密码</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="至少 6 位"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      autoComplete="new-password"
                      className="h-11 pr-11 bg-muted/30 border-border/60 focus:bg-white transition-colors"
                    />
                    <button
                      type="button"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/15 rounded-lg px-3.5 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold shadow-sm"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      注册中...
                    </span>
                  ) : "创建账号"}
                </Button>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">首个注册账号将自动获得管理员权限</p>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
