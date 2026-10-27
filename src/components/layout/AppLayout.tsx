import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAlerts } from "@/hooks/useAlerts";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  // Alertas saíram do menu: ficam no sino do cabeçalho, com a contagem do período.
  const { data: alerts = [] } = useAlerts("consolidated");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border bg-card px-4 shrink-0">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-sm font-medium text-muted-foreground flex-1">
              Controle Financeiro
            </h1>
            <Button variant="ghost" size="icon" className="relative mr-1" onClick={() => navigate("/alertas")}
              title={alerts.length ? `${alerts.length} alerta(s)` : "Alertas"} aria-label="Alertas">
              <Bell className="h-4 w-4" />
              {alerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center">
                  {alerts.length > 99 ? "99+" : alerts.length}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === "dark" ? "Modo claro" : "Modo escuro"}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
