import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mongodbClient } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Pen, Film } from "lucide-react";
import { ROUTES, getPostAuthRoute } from "@/lib/routes";

interface MongoResponse<T> {
  data: T | null;
  error?: { message?: string } | null;
}

interface UserRoleRecord {
  id?: string;
  role?: "writer" | "producer" | null;
}

interface ProfileRecord {
  id?: string;
  onboarding_completed?: boolean | null;
}

const SelectRole = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const redirectIfRoleExists = async () => {
      const { data: { user } } = await mongodbClient.auth.getUser();

      if (!user) {
        navigate(ROUTES.login, { replace: true });
        return;
      }

      const { data: roleRecord } = await mongodbClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle() as MongoResponse<UserRoleRecord>;

      if (roleRecord?.role) {
        const { data: profileRecord } = await mongodbClient
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle() as MongoResponse<ProfileRecord>;

        navigate(getPostAuthRoute(roleRecord.role, profileRecord?.onboarding_completed), { replace: true });
      }
    };

    redirectIfRoleExists();
  }, [navigate]);

  const handleRoleSelection = async (role: "writer" | "producer") => {
    setLoading(true);
    const { data: { user } } = await mongodbClient.auth.getUser();
    
    if (!user) {
      navigate(ROUTES.login, { replace: true });
      return;
    }

    const { data: existingRole, error: existingRoleError } = await mongodbClient
      .from("user_roles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle() as MongoResponse<UserRoleRecord>;

    if (existingRoleError) {
      toast({
        title: "Error",
        description: existingRoleError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = (existingRole
      ? await mongodbClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", user.id)
      : await mongodbClient
          .from("user_roles")
          .insert({ user_id: user.id, role })) as MongoResponse<null>;

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data: profileRecord } = await mongodbClient
      .from("profiles")
      .select("id,onboarding_completed")
      .eq("id", user.id)
      .maybeSingle() as MongoResponse<ProfileRecord>;

    if (!profileRecord) {
      const { error: profileError } = (await mongodbClient
        .from("profiles")
        .insert({
          id: user.id,
          name: "",
          bio: "",
          avatar_url: "",
          onboarding_completed: false,
        })) as MongoResponse<null>;

      if (profileError) {
        toast({
          title: "Error",
          description: profileError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    navigate(ROUTES.onboarding, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold font-space mb-4">
            <span className="text-white">Pitch</span>
            <span className="text-[hsl(265_85%_58%)]">Room</span>
          </h1>
          <h2 className="text-2xl font-bold gradient-text mb-4">
            Choose Your Path
          </h2>
          <p className="text-xl text-muted-foreground">
            Join as a Writer or Producer
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass glass-hover rounded-2xl p-8 shadow-glass text-center">
            <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <Pen className="w-10 h-10 text-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Writer</h2>
            <p className="text-muted-foreground mb-6">
              Create, upload, and manage scripts. Use AI tools to expand your stories,
              generate storyboards, and connect with producers.
            </p>
            <Button
              onClick={() => handleRoleSelection("writer")}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              Continue as Writer
            </Button>
          </div>

          <div className="glass glass-hover rounded-2xl p-8 shadow-glass text-center">
            <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <Film className="w-10 h-10 text-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Producer</h2>
            <p className="text-muted-foreground mb-6">
              Discover scripts, collaborate with writers, and use AI to evaluate
              market viability. Build your next project with confidence.
            </p>
            <Button
              onClick={() => handleRoleSelection("producer")}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              Continue as Producer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectRole;
