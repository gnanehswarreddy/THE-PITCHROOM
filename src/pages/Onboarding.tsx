import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mongodbClient } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";
import { ROUTES, getDashboardRoute } from "@/lib/routes";

const Onboarding = () => {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await mongodbClient.auth.getUser();
        if (!user) {
          navigate(ROUTES.login, { replace: true });
          return;
        }

        const { data: profile } = await mongodbClient
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        const { data: roleData } = await mongodbClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          setName(profile.name || "");
          setBio(profile.bio || "");
        } else {
          const { error: profileError } = await mongodbClient.from("profiles").insert({
            id: user.id,
            name: "",
            bio: "",
            avatar_url: "",
            onboarding_completed: false,
          });

          if (profileError) {
            throw new Error(profileError.message);
          }
        }

        if (roleData?.role) {
          setUserRole(roleData.role);
        } else {
          navigate(ROUTES.selectRole, { replace: true });
        }
      } catch (error) {
        console.error("Failed to load onboarding data:", error);
        toast({
          title: "Unable to load profile",
          description: "Please try selecting your role again.",
          variant: "destructive",
        });
        navigate(ROUTES.selectRole, { replace: true });
      }
    };

    loadProfile();
  }, [navigate, toast]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) {
      navigate(ROUTES.login, { replace: true });
      return;
    }

    const { error } = await mongodbClient
      .from("profiles")
      .update({ name, bio, onboarding_completed: true })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Profile completed!",
      description: "Welcome to PitchRoom",
    });

    navigate(getDashboardRoute(userRole), { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="glass glass-hover rounded-2xl p-8 shadow-glass">
          <div className="flex items-center justify-center mb-8">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-3xl font-bold text-center gradient-text mb-2">
            Complete Your Profile
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            Tell us a bit about yourself
          </p>
          
          <form onSubmit={handleComplete} className="space-y-6">
            <div>
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-2"
                placeholder="Your name"
              />
            </div>
            
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-2 min-h-[120px]"
                placeholder="Tell us about yourself and your creative journey..."
              />
            </div>
            
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Completing..." : "Complete Profile"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
