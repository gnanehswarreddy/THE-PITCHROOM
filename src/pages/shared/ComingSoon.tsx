import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import ProducerLayout from "@/pages/producer/ProducerLayout";
import WriterLayout from "@/pages/writer/WriterLayout";
import { useEffect, useState } from "react";
import { mongodbClient } from "@/lib/mongodb/client";
import { getDashboardRoute } from "@/lib/routes";

const ComingSoon = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const getUserRole = async () => {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) return;

      const { data: roleData } = await mongodbClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setUserRole(roleData?.role || null);
    };

    getUserRole();
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes("studio")) return "Studio";
    if (path.includes("intelligence")) return "Intelligence";
    if (path.includes("community")) return "Community";
    if (path.includes("academy")) return "Academy+";
    if (path.includes("network")) return "Network";
    if (path.includes("stories")) return "Stories";
    if (path.includes("analytics")) return "Analytics";
    if (path.includes("labs")) return "AI Labs";
    if (path.includes("settings")) return "Settings";
    return "Feature";
  };

  const content = (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-8">
      <Card className="glass glass-hover max-w-2xl w-full p-12 text-center shadow-glass">
        <Sparkles className="w-20 h-20 text-primary mx-auto mb-6" />
        <h1 className="text-4xl font-bold gradient-text mb-4">
          {getPageTitle()} Coming Soon
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          We're working hard to bring you this exciting feature. Stay tuned!
        </p>
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            size="lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Button
            onClick={() => navigate(getDashboardRoute(userRole))}
            size="lg"
          >
            Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );

  if (userRole === "writer") {
    return <WriterLayout>{content}</WriterLayout>;
  }

  return <ProducerLayout>{content}</ProducerLayout>;
};

export default ComingSoon;
