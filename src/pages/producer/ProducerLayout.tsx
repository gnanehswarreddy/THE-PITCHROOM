import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProducerSidebar } from "@/components/ProducerSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";
import { NotificationBell } from "@/components/NotificationBell";
import { useLocation } from "react-router-dom";

interface ProducerLayoutProps {
  children: React.ReactNode;
}

const ProducerLayout = ({ children }: ProducerLayoutProps) => {
  const location = useLocation();
  const showBackButton = location.pathname !== "/producer/dashboard";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ProducerSidebar />
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
              <ThemeToggle />
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

export default ProducerLayout;
