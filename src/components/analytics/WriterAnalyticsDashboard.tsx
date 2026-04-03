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
import { BrainCircuit, Clapperboard, Eye, Film, Heart, Sparkles, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["#8b5cf6", "#22d3ee", "#f472b6", "#38bdf8", "#f59e0b"];
const tooltipStyle = {
  backgroundColor: "rgba(2, 6, 23, 0.95)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  borderRadius: "16px",
  color: "#e2e8f0",
};

const WriterAnalyticsDashboard = () => {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [days, setDays] = useState("30");
  const [genreFilter, setGenreFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const [analyticsResult, insightsResult] = await Promise.all([
        mongodbClient.analytics.getAnalytics({ audience: "writer", days: Number(days) }),
        mongodbClient.analytics.getInsights({ audience: "writer", days: Number(days) }),
      ]);

      if (analyticsResult.error || insightsResult.error) {
        toast({ title: "Analytics unavailable", description: analyticsResult.error?.message || insightsResult.error?.message || "Could not load writer analytics.", variant: "destructive" });
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
    return <div className="p-8 text-slate-300">Loading writer analytics...</div>;
  }

  const storyCount = analytics.funnel_data.find((item: any) => item.key === "stories")?.count || 0;
  const scriptCount = analytics.summary.scripts_generated || 0;
  const conversionRate = storyCount > 0 ? Math.round((scriptCount / storyCount) * 100) : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.22),_transparent_30%),linear-gradient(180deg,_rgba(2,6,23,1),_rgba(16,12,31,1))] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-violet-300/70">Writer Performance</p>
            <h1 className="mt-2 font-['Oswald'] text-4xl uppercase tracking-wide text-white lg:text-5xl">Writer Analytics</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">Creation performance, script conversion, audience traction, and engagement signals for your stories.</p>
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

        <Card className="border-white/10 bg-[linear-gradient(135deg,rgba(139,92,246,0.24),rgba(15,23,42,0.92))] p-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-center gap-2 text-violet-200">
                <BrainCircuit className="h-5 w-5" />
                <p className="text-sm font-medium uppercase tracking-[0.28em]">Writer Insights</p>
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
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Best Genre</p>
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Stories Created", value: storyCount, icon: Film },
            { label: "Scripts Generated", value: scriptCount, icon: Clapperboard },
            { label: "Total Views", value: analytics.summary.total_views, icon: Eye },
            { label: "Audience Interest", value: analytics.summary.scripts_saved, icon: Heart },
            { label: "Story → Script", value: conversionRate, icon: TrendingUp, suffix: "%" },
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Story Creation Trend</p>
            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.daily_activity}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="stories" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="scripts_generated" stroke="#22d3ee" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Genre Distribution</p>
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Engagement Metrics</p>
            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.daily_activity}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="views" stroke="#22d3ee" fill="rgba(34,211,238,0.18)" />
                  <Area type="monotone" dataKey="saves" stroke="#f472b6" fill="rgba(244,114,182,0.18)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Top Performing Stories</p>
            <div className="space-y-4 pt-4">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-slate-400">Top script</p>
                <p className="mt-2 text-xl font-semibold text-white">{analytics.top_content.best_performing_script?.title || "No standout script yet"}</p>
                {analytics.top_content.best_performing_script ? (
                  <p className="mt-3 text-sm text-slate-300">{analytics.top_content.best_performing_script.views} views · {analytics.top_content.best_performing_script.saves} saves</p>
                ) : null}
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-slate-400">Most viewed story</p>
                <p className="mt-2 text-xl font-semibold text-white">{analytics.top_content.most_viewed_story?.title || "No story data yet"}</p>
                {analytics.top_content.most_viewed_story ? (
                  <p className="mt-3 text-sm text-slate-300">{analytics.top_content.most_viewed_story.views} views</p>
                ) : null}
              </div>
            </div>
          </Card>
        </div>

        <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Writer Funnel</p>
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

export default WriterAnalyticsDashboard;
