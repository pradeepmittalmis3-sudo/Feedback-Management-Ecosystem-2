import { LayoutDashboard, MessageSquare, BarChart3, Settings, Users, FileText, Crown, Clock, CheckCircle2, Shield } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Pending", url: "/pending", icon: Clock },
  { title: "Done", url: "/done", icon: CheckCircle2 },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Stores", url: "/stores", icon: Users },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Permissions", url: "/permissions", icon: Shield, role: 'superadmin' },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut, role } = useAuth();

  const filteredItems = mainItems.filter(item => {
    if (role === 'superadmin') return true;
    if (role === 'admin') return item.title !== 'Settings'; // Simple example
    if (role === 'user') return ['Pending', 'Done'].includes(item.title);
    if (role === 'viewer') return ['Dashboard', 'Analytics', 'Reports'].includes(item.title);
    return false;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-base font-display font-bold text-sidebar-foreground leading-none">Rajmandir</h1>
              <p className="text-[10px] text-sidebar-foreground/60">{role?.toUpperCase()} Mode</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="text-[11px] text-sidebar-foreground/60 truncate mb-2 px-1">{user?.email}</p>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
