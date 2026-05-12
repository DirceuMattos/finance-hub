import {
  LayoutDashboard,
  ArrowRightLeft,
  Repeat,
  CreditCard,
  FileText,
  CalendarRange,
  Landmark,
  PieChart,
  Settings,
  LogOut,
  DollarSign,
  FileDown,
  Bell,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navGroups = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Alertas", url: "/alertas", icon: Bell },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Lançamentos", url: "/lancamentos", icon: ArrowRightLeft },
      { title: "Recorrências", url: "/recorrencias", icon: Repeat },
      { title: "Fluxo Mensal", url: "/fluxo-mensal", icon: CalendarRange },
    ],
  },
  {
    label: "Cartões",
    items: [
      { title: "Cartões", url: "/cartoes", icon: CreditCard },
      { title: "Faturas Projetadas", url: "/faturas-projetadas", icon: FileText },
    ],
  },
  {
    label: "Patrimônio",
    items: [
      { title: "Patrimônio", url: "/patrimonio", icon: Landmark },
      { title: "Investimentos", url: "/investimentos", icon: PieChart },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { title: "Relatórios", url: "/relatorios", icon: FileDown },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-sidebar-primary-foreground shrink-0" />
            {!collapsed && (
              <h2 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
                Finance Hub
              </h2>
            )}
          </div>
        </div>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-2 space-y-1">
        {!collapsed && user?.email && (
          <p className="px-2 text-xs text-muted-foreground truncate" title={user.email}>
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={handleLogout}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
