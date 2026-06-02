import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "./components/DashboardLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import IocManager from "./pages/IocManager";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";

// ─── Auth Guard ───────────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const [location, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Shield className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">正在验证身份...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (location !== "/login") {
      navigate("/login");
    }
    return null;
  }

  return <>{children}</>;
}

// ─── Dashboard Navigation Items ───────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "安全概览", path: "/", icon: "LayoutDashboard" },
  { label: "设备管理", path: "/devices", icon: "Smartphone" },
  { label: "检测任务", path: "/tasks", icon: "FileSearch" },
  { label: "IOC 规则库", path: "/ioc", icon: "Database" },
];

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <AuthGuard>
          <DashboardLayout appName="iOS SpyGuard" navItems={NAV_ITEMS}>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/devices" component={Devices} />
              <Route path="/tasks/new">
                {() => { window.location.href = "/tasks"; return null; }}
              </Route>
              <Route path="/tasks/:id" component={TaskDetail} />
              <Route path="/tasks" component={Tasks} />
              <Route path="/ioc" component={IocManager} />
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </DashboardLayout>
        </AuthGuard>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
