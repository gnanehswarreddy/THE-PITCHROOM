import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mongodbClient } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Search, Bookmark, TrendingUp, MessageSquare, LogOut,
  Eye, ArrowRight, Brain, Clock, FileText, Users
} from "lucide-react";
import ProducerLayout from "./ProducerLayout";

interface Writer {
  id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  scriptCount: number;
}

const ProducerDashboard = () => {
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({ collections: 0, messages: 0, views: 0, scripts: 0 });
  const [writers, setWriters] = useState<Writer[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) return;

      const { data: profile } = await mongodbClient.from("profiles").select("name").eq("id", user.id).single();
      if (profile) setUserName(profile.name || "");

      const [collectionsRes, messagesRes, viewsRes, scriptsRes] = await Promise.all([
        mongodbClient.from("collections").select("*", { count: "exact", head: true }).eq("producer_id", user.id),
        mongodbClient.from("messages").select("*", { count: "exact", head: true }).eq("sender_id", user.id),
        mongodbClient.from("script_views").select("*", { count: "exact", head: true }).eq("viewer_id", user.id),
        mongodbClient.from("scripts").select("*", { count: "exact", head: true }).eq("visibility", "public"),
      ]);

      setStats({
        collections: collectionsRes.count || 0,
        messages: messagesRes.count || 0,
        views: viewsRes.count || 0,
        scripts: scriptsRes.count || 0,
      });

      // Load writer profiles
      const { data: writerRoles } = await mongodbClient.from("user_roles").select("user_id").eq("role", "writer").limit(6);
      if (writerRoles && writerRoles.length > 0) {
        const writerIds = writerRoles.map(r => r.user_id);
        const { data: writerProfiles } = await mongodbClient.from("profiles").select("id, name, avatar_url, bio").in("id", writerIds);
        
        // Get script counts for each writer
        const enriched = await Promise.all((writerProfiles || []).map(async (w) => {
          const { count } = await mongodbClient.from("scripts").select("*", { count: "exact", head: true }).eq("writer_id", w.id).eq("visibility", "public");
          return { ...w, scriptCount: count || 0 };
        }));
        setWriters(enriched);
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
    <ProducerLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-space tracking-tight text-foreground">
              {greeting()}, <span className="gradient-text">{userName || "Producer"}</span>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Discover your next blockbuster.</p>
          </div>
          <Button onClick={handleSignOut} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4 mr-2" />Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Saved Scripts", value: stats.collections, icon: Bookmark, color: "text-primary" },
            { label: "Scripts Viewed", value: stats.views, icon: Eye, color: "text-accent" },
            { label: "Messages Sent", value: stats.messages, icon: MessageSquare, color: "text-primary" },
            { label: "Public Scripts", value: stats.scripts, icon: FileText, color: "text-accent" },
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
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold font-space text-foreground">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { title: "Discover Scripts", desc: "Browse public scripts", icon: Search, action: () => navigate("/producer/discover") },
                { title: "My Collections", desc: "View saved scripts", icon: Bookmark, action: () => navigate("/producer/collections") },
                { title: "Messages", desc: "Chat with writers", icon: MessageSquare, action: () => navigate("/producer/messages") },
                { title: "Intelligence", desc: "AI market analysis", icon: Brain, action: () => navigate("/producer/intelligence") },
                { title: "Analytics", desc: "Track your activity", icon: TrendingUp, action: () => navigate("/producer/analytics") },
                { title: "Network", desc: "Connect with community", icon: Sparkles, action: () => navigate("/network") },
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

          {/* Writers Sidebar */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold font-space text-foreground">Writers</h2>
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary uppercase tracking-wider">Talented Writers</span>
              </div>
              {writers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No writers yet</p>
              ) : (
                <div className="space-y-3">
                  {writers.slice(0, 5).map(writer => (
                    <div key={writer.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={writer.avatar_url} />
                        <AvatarFallback className="bg-accent/20 text-accent text-sm">{writer.name?.charAt(0) || "W"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{writer.name || "Writer"}</p>
                        <p className="text-xs text-muted-foreground">{writer.scriptCount} scripts</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => navigate("/producer/messages")} className="shrink-0 text-xs">
                        <MessageSquare className="w-3 h-3 mr-1" />Chat
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => navigate("/network")}>
                View All Writers
              </Button>
            </div>

            <div className="glass rounded-xl p-5 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-xs font-medium text-accent uppercase tracking-wider">Pro Tip</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use the Intelligence Hub to analyze market trends and find the perfect genre for your next production.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProducerLayout>
  );
};

export default ProducerDashboard;
