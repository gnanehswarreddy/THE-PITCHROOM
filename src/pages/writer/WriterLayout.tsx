import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WriterSidebar } from "@/components/WriterSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";
import { NotificationBell } from "@/components/NotificationBell";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";

interface WriterLayoutProps {
  children: React.ReactNode;
  forceDark?: boolean;
  hideThemeToggle?: boolean;
}

const WriterLayout = ({ children, forceDark = false, hideThemeToggle = false }: WriterLayoutProps) => {
  const location = useLocation();
  const showBackButton = location.pathname !== "/writer/dashboard";
  const { theme } = useTheme();

  useEffect(() => {
    if (!forceDark) return;

    const root = window.document.documentElement;
    const nextTheme = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;

    root.classList.remove("light", "dark");
    root.classList.add("dark");

    return () => {
      root.classList.remove("light", "dark");
      root.classList.add(nextTheme);
    };
  }, [forceDark, theme]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <WriterSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 glass">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              {showBackButton && <BackButton />}
              <div className="flex items-center ml-2 font-space font-bold text-xl">
                <span className="text-foreground">Pitch</span>
                <span className="text-[hsl(265_85%_58%)]">Room</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              {!hideThemeToggle && <ThemeToggle />}
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default WriterLayout;
