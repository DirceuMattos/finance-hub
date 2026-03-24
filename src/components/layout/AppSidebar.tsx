import {
  LayoutDashboard,
  ArrowRightLeft,
  Repeat,
  CreditCard,
  ShoppingCart,
  FileText,
  CalendarRange,
  Landmark,
  PieChart,
  Settings,
  LogOut,
  DollarSign,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
      { title: "Compras no Cartão", url: "/compras-cartao", icon: ShoppingCart },
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
    label: "Configurações",
    items: [
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 pb-2">
          {!collapsed && (
            <h2 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
              FinControl
            </h2>
          )}
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
      <SidebarFooter className="p-2">
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
