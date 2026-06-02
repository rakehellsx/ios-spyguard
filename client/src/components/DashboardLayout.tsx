import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  LayoutDashboard,
  Smartphone,
  FileSearch,
  Database,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Activity,
  Settings,
  Cpu,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/", icon: LayoutDashboard, label: "安全概览", exact: true },
  { path: "/devices", icon: Smartphone, label: "设备管理" },
  { path: "/tasks", icon: FileSearch, label: "检测任务" },
  { path: "/ioc", icon: Database, label: "IOC 规则库" },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: me } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("已退出登录");
      window.location.href = "/login";
    },
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location === path;
    return location === path || location.startsWith(path + "/");
  };

  const displayName = (me as any)?.displayName ?? (me as any)?.username ?? "用户";
  const username = (me as any)?.username ?? "";
  const role = (me as any)?.role ?? "user";
  const initials = displayName.slice(0, 2).toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={cn(
        "flex items-center gap-3 px-4 h-[64px] border-b border-sidebar-border shrink-0",
        collapsed && "justify-center px-3"
      )}>
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0" style={{ boxShadow: "0 2px 8px 0 oklch(0.28 0.13 258 / 0.30)" }}>
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-[14px] text-foreground tracking-tight leading-tight">iOS SpyGuard</p>
            <p className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">间谍软件检测平台</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-bold text-muted-foreground/35 uppercase tracking-widest px-2.5 mb-3">
            功能模块
          </p>
        )}
        {NAV_ITEMS.map(({ path, icon: Icon, label, exact }) => {
          const active = isActive(path, exact);
          return (
            <Link key={path} href={path}>
              <div
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer group select-none",
                  collapsed && "justify-center px-2.5",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
                style={active ? { boxShadow: "0 1px 4px 0 oklch(0.28 0.13 258 / 0.25)" } : {}}
                title={collapsed ? label : undefined}
              >
                <Icon className={cn(
                  "shrink-0 transition-colors",
                  collapsed ? "w-[18px] h-[18px]" : "w-4 h-4",
                  active ? "text-primary-foreground" : "text-muted-foreground/60 group-hover:text-foreground"
                )} />
                {!collapsed && (
                  <span className="truncate">{label}</span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Engine status */}
      {!collapsed && (
        <div className="px-2.5 mb-2">
          <div className="px-3 py-2.5 rounded-xl bg-green-50/80 border border-green-100">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-[11px] text-green-700 font-semibold">检测引擎运行中</span>
              <Activity className="w-3 h-3 text-green-500/60 ml-auto" />
            </div>
            <p className="text-[10px] text-green-600/55 mt-1 leading-tight">MVT SpywareObjects 已就绪</p>
          </div>
        </div>
      )}

      {/* User area */}
      <div className={cn(
        "border-t border-sidebar-border p-3 shrink-0",
        collapsed && "flex justify-center"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center gap-2.5 rounded-xl transition-all duration-150 hover:bg-sidebar-accent w-full px-2.5 py-2.5 group",
              collapsed && "w-auto justify-center p-2"
            )}>
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 text-white text-[10px] font-bold" style={{ boxShadow: "0 1px 4px 0 oklch(0.28 0.13 258 / 0.25)" }}>
                {initials}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[12px] font-semibold text-foreground truncate leading-tight">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground/60 truncate leading-tight mt-0.5">
                    {role === "admin" ? "管理员" : "普通用户"}
                  </p>
                </div>
              )}
              {!collapsed && (
                <Settings className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 transition-colors" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={collapsed ? "center" : "end"} className="w-52 mb-1">
            <div className="px-3 py-2.5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[11px] font-bold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">@{username} · {role === "admin" ? "管理员" : "普通用户"}</p>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/5 cursor-pointer text-xs gap-2"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="w-3.5 h-3.5" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-out shrink-0 relative",
          collapsed ? "w-[60px]" : "w-[228px]"
        )}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1/2 -translate-y-1/2 -right-[13px] w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 z-10 shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-10 animate-fade-in">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-white shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm text-foreground">iOS SpyGuard</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
