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
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Bookmark,
  Brain,
  Clapperboard,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

const producerItems = [
  { title: "Dashboard", url: "/producer/dashboard", icon: LayoutDashboard },
  { title: "Discover", url: "/producer/discover", icon: Search },
  { title: "Collections", url: "/producer/collections", icon: Bookmark },
  { title: "Messages", url: "/producer/messages", icon: MessageSquare },
  { title: "Analytics", url: "/producer/analytics", icon: BarChart3 },
  { title: "Intelligence", url: "/producer/intelligence", icon: Brain },
  { title: "AI Studio", url: "/producer/ai-studio", icon: Clapperboard, badge: "New" },
];

const sharedItems = [
  { title: "Community", url: "/community", icon: Users },
  { title: "Academy+", url: "/academy", icon: GraduationCap },
  { title: "Profile", url: "/profile", icon: LayoutDashboard },
  { title: "AI Labs", url: "/labs", icon: Sparkles, hidden: true },
];

export function ProducerSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Producer Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {producerItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span>{item.title}</span>
                          {item.badge ? (
                            <Badge className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0 text-[10px] uppercase tracking-[0.18em] text-amber-200 hover:bg-amber-300/10">
                              {item.badge}
                            </Badge>
                          ) : null}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sharedItems.filter((item) => !item.hidden).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
