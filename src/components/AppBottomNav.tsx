import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { producerBottomNav, writerBottomNav, type AppNavItem } from "@/lib/app-navigation";

type AppBottomNavProps = {
  role: "writer" | "producer";
};

const isActiveRoute = (pathname: string, item: AppNavItem) => {
  if (item.url === pathname) return true;
  if (item.url === "/profile") return pathname.startsWith("/profile");
  return pathname.startsWith(item.url);
};

export function AppBottomNav({ role }: AppBottomNavProps) {
  const location = useLocation();
  const items = role === "writer" ? writerBottomNav : producerBottomNav;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 rounded-2xl bg-muted/40 p-1.5 shadow-[0_-12px_40px_rgba(15,23,42,0.12)]">
        {items.map((item) => {
          const active = isActiveRoute(location.pathname, item);

          return (
            <NavLink
              key={item.title}
              to={item.url}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-all duration-200",
                active
                  ? "bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.35)]"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="truncate">{item.title}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
