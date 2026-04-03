import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BookmarkPlus, BrainCircuit, Eye, MessageSquareText, Radar, Rocket, Sparkles, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["#22d3ee", "#38bdf8", "#8b5cf6", "#f472b6", "#34d399"];
const tooltipStyle = {
  backgroundColor: "rgba(2, 6, 23, 0.95)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  borderRadius: "16px",
  color: "#e2e8f0",
};

const ProducerAnalyticsDashboard = () => {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [days, setDays] = useState("30");
  const [genreFilter, setGenreFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const [analyticsResult, insightsResult] = await Promise.all([
        mongodbClient.analytics.getAnalytics({ audience: "producer", days: Number(days) }),
        mongodbClient.analytics.getInsights({ audience: "producer", days: Number(days) }),
      ]);

      if (analyticsResult.error || insightsResult.error) {
        toast({ title: "Analytics unavailable", description: analyticsResult.error?.message || insightsResult.error?.message || "Could not load producer analytics.", variant: "destructive" });
        return;
      }

      setAnalytics(analyticsResult.data);
      setInsights(insightsResult.data);
    };

    void load();
  }, [days, toast]);

  const filteredGenres = useMemo(() => {
    if (!analytics?.genre_distribution) return [];
    if (genreFilter === "all") return analytics.genre_distribution;
    return analytics.genre_distribution.filter((item: any) => item.genre === genreFilter);
  }, [analytics, genreFilter]);

  if (!analytics || !insights) {
    return <div className="p-8 text-slate-300">Loading producer analytics...</div>;
  }

  const saveRate = analytics.summary.total_views > 0
    ? Math.round((analytics.summary.scripts_saved / analytics.summary.total_views) * 100)
    : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_30%),linear-gradient(180deg,_rgba(2,6,23,1),_rgba(8,18,32,1))] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Producer Discovery</p>
            <h1 className="mt-2 font-['Oswald'] text-4xl uppercase tracking-wide text-white lg:text-5xl">Producer Analytics</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">Discovery behavior, saved projects, outreach momentum, and network activity across the PitchRoom platform.</p>
          </div>
          <div className="flex gap-3">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[160px] border-white/10 bg-white/[0.05] text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="w-[180px] border-white/10 bg-white/[0.05] text-slate-100">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genres</SelectItem>
                {(analytics.genre_distribution || []).map((item: any) => (
                  <SelectItem key={item.genre} value={item.genre}>{item.genre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.2),rgba(15,23,42,0.92))] p-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-center gap-2 text-cyan-200">
                <BrainCircuit className="h-5 w-5" />
                <p className="text-sm font-medium uppercase tracking-[0.28em]">Producer Insights</p>
              </div>
              <div className="mt-4 space-y-3">
                {insights.highlights.map((item: string) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Strongest Genre Interest</p>
              <p className="mt-3 text-2xl font-semibold text-white">{insights.best_performing_genre || "Still learning"}</p>
              <div className="mt-4 space-y-2">
                {insights.recommendations.slice(0, 2).map((item: string) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-slate-200">
                    <Sparkles className="mt-0.5 h-4 w-4 text-fuchsia-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            { label: "Scripts Viewed", value: analytics.summary.total_views, icon: Eye },
            { label: "Scripts Saved", value: analytics.summary.scripts_saved, icon: BookmarkPlus },
            { label: "Messages Sent", value: analytics.summary.messages_sent, icon: MessageSquareText },
            { label: "Pitches Sent", value: analytics.summary.pitches_sent, icon: Rocket },
            { label: "Writers Followed", value: analytics.summary.followers, icon: Users },
            { label: "Save Rate", value: saveRate, icon: TrendingUp, suffix: "%" },
          ].map((item, index) => (
            <Card key={item.label} className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.value}{item.suffix || ""}</p>
                </div>
                <div className="rounded-2xl border border-white/10 p-3 text-white" style={{ backgroundColor: `${COLORS[index]}22` }}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Discovery Trend</p>
            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.daily_activity}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="views" stroke="#22d3ee" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="saves" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Genre Interest</p>
            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={filteredGenres} dataKey="count" nameKey="genre" innerRadius={55} outerRadius={95}>
                    {filteredGenres.map((item: any, index: number) => (
                      <Cell key={item.genre} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Outreach Motion</p>
            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.daily_activity}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="messages" stroke="#f472b6" fill="rgba(244,114,182,0.18)" />
                  <Area type="monotone" dataKey="pitches" stroke="#22d3ee" fill="rgba(34,211,238,0.18)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Top Discovery Signal</p>
            <div className="space-y-4 pt-4">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-slate-400">Top script</p>
                <p className="mt-2 text-xl font-semibold text-white">{analytics.top_content.best_performing_script?.title || "No standout script yet"}</p>
                {analytics.top_content.best_performing_script ? (
                  <p className="mt-3 text-sm text-slate-300">{analytics.top_content.best_performing_script.views} views · {analytics.top_content.best_performing_script.saves} saves</p>
                ) : null}
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-slate-400">Most active day</p>
                <p className="mt-2 text-xl font-semibold text-white">{analytics.user_behavior.most_active_day || "Not enough data yet"}</p>
                <p className="mt-3 text-sm text-slate-300">{analytics.summary.profile_views} profile views logged</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Producer Funnel</p>
          <div className="mt-4 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Funnel dataKey="count" data={analytics.funnel_data}>
                    <LabelList position="right" fill="#e2e8f0" stroke="none" dataKey="label" />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {analytics.funnel_data.map((item: any) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 text-sm">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-medium text-white">{item.count} · {item.conversion}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProducerAnalyticsDashboard;
