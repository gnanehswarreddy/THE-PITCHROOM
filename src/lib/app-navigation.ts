import {
  BarChart3,
  BookOpen,
  Bookmark,
  Brain,
  Clapperboard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";

export type AppNavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
};

export const writerPrimaryNav: AppNavItem[] = [
  { title: "Dashboard", url: "/writer/dashboard", icon: LayoutDashboard },
  { title: "My Scripts", url: "/writer/scripts", icon: FileText },
  { title: "Stories", url: "/writer/stories", icon: BookOpen },
  { title: "AI Studio", url: "/writer/editor", icon: Wand2 },
  { title: "Messages", url: "/writer/messages", icon: MessageSquare },
  { title: "Analytics", url: "/writer/analytics", icon: BarChart3 },
  { title: "Intelligence", url: "/writer/intelligence", icon: Brain },
];

export const producerPrimaryNav: AppNavItem[] = [
  { title: "Dashboard", url: "/producer/dashboard", icon: LayoutDashboard },
  { title: "Discover", url: "/producer/discover", icon: Search },
  { title: "Collections", url: "/producer/collections", icon: Bookmark },
  { title: "Messages", url: "/producer/messages", icon: MessageSquare },
  { title: "Analytics", url: "/producer/analytics", icon: BarChart3 },
  { title: "Intelligence", url: "/producer/intelligence", icon: Brain },
  { title: "AI Studio", url: "/producer/ai-studio", icon: Clapperboard },
];

export const sharedNav: AppNavItem[] = [
  { title: "Community", url: "/community", icon: Users },
  { title: "Academy+", url: "/academy", icon: GraduationCap },
  { title: "AI Labs", url: "/labs", icon: Sparkles },
  { title: "Profile", url: "/profile", icon: LayoutDashboard },
];

export const writerBottomNav: AppNavItem[] = [
  { title: "Home", url: "/writer/dashboard", icon: LayoutDashboard },
  { title: "Stories", url: "/writer/stories", icon: BookOpen },
  { title: "Scripts", url: "/writer/scripts", icon: FileText },
  { title: "AI Studio", url: "/writer/editor", icon: Wand2 },
  { title: "Profile", url: "/profile", icon: Users },
];

export const producerBottomNav: AppNavItem[] = [
  { title: "Home", url: "/producer/dashboard", icon: LayoutDashboard },
  { title: "Discover", url: "/producer/discover", icon: Search },
  { title: "Messages", url: "/producer/messages", icon: MessageSquare },
  { title: "AI Studio", url: "/producer/ai-studio", icon: Clapperboard },
  { title: "Profile", url: "/profile", icon: Users },
];
