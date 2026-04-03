import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ROUTES, getPostAuthRoute } from "@/lib/routes";

const Login = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email || searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const clearStaleSession = async () => {
      try {
        const { error } = await mongodbClient.auth.getSession();
        if (error) {
          console.log("Clearing stale session:", error.message);
          await mongodbClient.auth.signOut();
        }
      } catch (err) {
        console.log("Session check error, clearing:", err);
        await mongodbClient.auth.signOut();
      }
    };
    clearStaleSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await mongodbClient.auth.signOut();

      const { data, error } = await mongodbClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("Login error:", error);
        toast({
          title: "Login failed",
          description: error.message === "Failed to fetch"
            ? "Network error. Please check your connection and try again."
            : error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (data.user) {
        const { data: roleRecord } = await mongodbClient
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        const { data: profileRecord } = await mongodbClient
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", data.user.id)
          .maybeSingle();

        navigate(getPostAuthRoute(roleRecord?.role, profileRecord?.onboarding_completed), { replace: true });
      }
    } catch (err: any) {
      console.error("Login catch error:", err);
      toast({
        title: "Login failed",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 blur-[150px] rounded-full" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-accent/5 blur-[100px] rounded-full" />

      <div className="relative z-10 w-full max-w-md">
        <div className="absolute top-0 right-0"><ThemeToggle /></div>
        <Link to={ROUTES.root} className="flex items-center justify-center mb-10">
          <h1 className="text-4xl font-bold font-space">
            <span className="text-foreground">Pitch</span>
            <span className="text-primary" style={{ textShadow: "0 0 30px hsl(265 85% 58% / 0.4)" }}>Room</span>
          </h1>
        </Link>

        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-8 shadow-[0_0_60px_hsl(265_85%_58%/0.05)]">
          <h2 className="text-2xl font-bold font-space text-foreground text-center mb-2">Welcome Back</h2>
          <p className="text-sm text-muted-foreground text-center mb-8">Sign in to continue your journey</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_15px_hsl(265_85%_58%/0.1)] transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_15px_hsl(265_85%_58%/0.1)] transition-all"
                  placeholder="********"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-semibold font-space text-sm hover:bg-primary/90 transition-all shadow-[0_0_20px_hsl(265_85%_58%/0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Signing in..." : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to={ROUTES.signup} className="text-primary hover:text-primary/80 transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
