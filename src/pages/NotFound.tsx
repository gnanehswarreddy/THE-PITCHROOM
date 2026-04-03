import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <Sparkles className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="mb-4 text-6xl font-bold gradient-text">404</h1>
        <p className="mb-8 text-xl text-muted-foreground">Page not found</p>
        <Link to="/">
          <Button size="lg">
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;