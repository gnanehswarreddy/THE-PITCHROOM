import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
import { 
  LayoutDashboard, 
  FileText, 
  BookOpen, 
  Wand2, 
  MessageSquare, 
  BarChart3,
  Brain,
  Users,
  GraduationCap,
  Sparkles
} from "lucide-react";

const writerItems = [
  { title: "Dashboard", url: "/writer/dashboard", icon: LayoutDashboard },
  { title: "My Scripts", url: "/writer/scripts", icon: FileText },
  { title: "Stories", url: "/writer/stories", icon: BookOpen },
  { title: "AI Editor", url: "/writer/editor", icon: Wand2 },
  { title: "Messages", url: "/writer/messages", icon: MessageSquare },
  { title: "Analytics", url: "/writer/analytics", icon: BarChart3 },
  { title: "Intelligence", url: "/writer/intelligence", icon: Brain },
];

const sharedItems = [
  { title: "Community", url: "/community", icon: Users },
  { title: "Academy+", url: "/academy", icon: GraduationCap },
  { title: "AI Labs", url: "/labs", icon: Sparkles },
  { title: "Profile", url: "/profile", icon: LayoutDashboard },
];

export function WriterSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Writer Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {writerItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sharedItems.map((item) => (
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