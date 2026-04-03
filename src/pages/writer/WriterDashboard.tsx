import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mongodbClient } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import SendScriptPitch from "@/components/SendScriptPitch";
import { 
  FileText, BookOpen, BarChart3, MessageSquare, LogOut, 
  Wand2, Upload, TrendingUp, Eye, Clock, ArrowRight, 
  PenTool, Sparkles, Send
} from "lucide-react";
import WriterLayout from "./WriterLayout";

const WriterDashboard = () => {
  const [userName, setUserName] = useState("");
  const [scriptCount, setScriptCount] = useState(0);
  const [storyCount, setStoryCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [producers, setProducers] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) return;

      const { data: profile } = await mongodbClient.from("profiles").select("name").eq("id", user.id).single();
      if (profile) setUserName(profile.name || "");

      const [scriptsRes, storiesRes, convsRes, viewsRes] = await Promise.all([
        mongodbClient.from("scripts").select("*", { count: "exact", head: true }).eq("writer_id", user.id),
        mongodbClient.from("stories").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        mongodbClient.from("conversations").select("id").or(`writer_id.eq.${user.id},producer_id.eq.${user.id}`),
        mongodbClient.from("scripts").select("views").eq("writer_id", user.id),
      ]);

      setScriptCount(scriptsRes.count || 0);
      setStoryCount(storiesRes.count || 0);

      if (convsRes.data && convsRes.data.length > 0) {
        const convIds = convsRes.data.map(c => c.id);
        const { count } = await mongodbClient.from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .eq("read", false)
          .neq("sender_id", user.id);
        setMessageCount(count || 0);
      }

      if (viewsRes.data) {
        setTotalViews(viewsRes.data.reduce((sum, s) => sum + (s.views || 0), 0));
      }

      // Load producer profiles
      const { data: producerRoles } = await mongodbClient.from("user_roles").select("user_id").eq("role", "producer").limit(6);
      if (producerRoles && producerRoles.length > 0) {
        const producerIds = producerRoles.map(r => r.user_id);
        const { data: producerProfiles } = await mongodbClient
          .from("profiles")
          .select("id, name, avatar_url, bio")
          .in("id", producerIds);
        setProducers(producerProfiles || []);
      }
    };
    loadData();
  }, []);

  const handleSignOut = async () => {
    await mongodbClient.auth.signOut();
    navigate("/");
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <WriterLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-space tracking-tight text-foreground">
              {greeting()}, <span className="gradient-text">{userName || "Writer"}</span>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Your creative workspace awaits.</p>
          </div>
          <Button onClick={handleSignOut} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4 mr-2" />Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Scripts", value: scriptCount, icon: FileText, color: "text-primary" },
            { label: "Stories", value: storyCount, icon: BookOpen, color: "text-accent" },
            { label: "Unread Messages", value: messageCount, icon: MessageSquare, color: "text-primary" },
            { label: "Total Views", value: totalViews, icon: Eye, color: "text-accent" },
          ].map(stat => (
            <div key={stat.label} className="glass rounded-xl p-5 flex items-center gap-4 group hover:border-primary/20 transition-all duration-300">
              <div className="p-2.5 rounded-lg bg-muted/50">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold font-space text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-lg font-semibold font-space text-foreground">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "Upload Script", desc: "Add a new screenplay", icon: Upload, action: () => navigate("/writer/upload") },
                { title: "AI Co-Writer", desc: "Generate scenes & dialogue", icon: Wand2, action: () => navigate("/writer/editor") },
                { title: "My Scripts", desc: "Manage your screenplays", icon: FileText, action: () => navigate("/writer/scripts") },
                { title: "View Analytics", desc: "Track views & trends", icon: BarChart3, action: () => navigate("/writer/analytics") },
              ].map(item => (
                <button key={item.title} onClick={item.action}
                  className="glass glass-hover rounded-xl p-5 text-left group transition-all duration-300 hover:border-primary/30">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="font-semibold text-foreground font-space text-sm">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Producers Section */}
            <h2 className="text-lg font-semibold font-space text-foreground">Producers</h2>
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary uppercase tracking-wider">Send Your Script</span>
              </div>
              {producers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No producers yet</p>
              ) : (
                <div className="space-y-3">
                  {producers.slice(0, 5).map(producer => (
                    <div key={producer.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={producer.avatar_url} />
                        <AvatarFallback className="bg-primary/20 text-primary text-sm">{producer.name?.charAt(0) || "P"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{producer.name || "Producer"}</p>
                        <p className="text-xs text-muted-foreground truncate">{producer.bio || "Producer"}</p>
                      </div>
                      <SendScriptPitch
                        producerId={producer.id}
                        producerName={producer.name || "Producer"}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <Send className="w-4 h-4 text-primary" />
                          </Button>
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => navigate("/network")}>
                View All Producers
              </Button>
            </div>

            {/* Writer's Corner */}
            <div className="glass rounded-xl p-5 border-l-2 border-primary/50">
              <div className="flex items-center gap-2 mb-3">
                <PenTool className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary uppercase tracking-wider">Daily Prompt</span>
              </div>
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                "A filmmaker discovers that the documentary they're editing contains footage they never shot..."
              </p>
            </div>

            <div className="glass rounded-xl p-5 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-xs font-medium text-accent uppercase tracking-wider">Pro Tip</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Scripts with loglines get 3× more producer views. Add one when uploading!
              </p>
            </div>
          </div>
        </div>
      </div>
    </WriterLayout>
  );
};

export default WriterDashboard;
