import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { theme, toggleTheme } = useTheme();

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
