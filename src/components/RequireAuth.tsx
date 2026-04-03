import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { mongodbClient, type AuthUser } from "@/lib/mongodb/client";
import { ROUTES, getDashboardRoute } from "@/lib/routes";

interface RequireAuthProps {
  children: React.ReactNode;
  requiredRole?: "writer" | "producer";
}

const RequireAuth = ({ children, requiredRole }: RequireAuthProps) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await mongodbClient.auth.getUser();
        
        // If there's an auth error (like stale session), clear and redirect
        if (error) {
          console.log("Auth error, clearing session:", error.message);
          await mongodbClient.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }
        
        setUser(user);

        if (user) {
          const { data: roleData } = await mongodbClient
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();
          
          setUserRole(roleData?.role || null);
        } else {
          setUserRole(null);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Auth check failed:", err);
        await mongodbClient.auth.signOut();
        setUser(null);
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = mongodbClient.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const { data: roleData } = await mongodbClient
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();
          
          setUserRole(roleData?.role || null);
        } else {
          setUserRole(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={ROUTES.login} replace />;
  }

  if (requiredRole && !userRole) {
    return <Navigate to={ROUTES.selectRole} replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to={getDashboardRoute(userRole)} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
