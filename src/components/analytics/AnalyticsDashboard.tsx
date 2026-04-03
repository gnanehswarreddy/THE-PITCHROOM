import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import {
  ArrowUpRight,
  BookmarkPlus,
  Bot,
  BrainCircuit,
  Clapperboard,
  Eye,
  Film,
  MessageSquareText,
  Rocket,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Audience = "writer" | "producer";

type AnalyticsResponse = {
  audience: Audience;
  range: { start: string; end: string; days: number };
  summary: {
    total_views: number;
    scripts_saved: number;
    messages_sent: number;
    pitches_sent: number;
    scripts_generated: number;
    growth_percentage: number;
    profile_views: number;
    followers: number;
    story_success_score: number;
    pitch_readiness_meter: number;
  };
  daily_activity: Array<{
    date: string;
    label: string;
    events: number;
    views: number;
    saves: number;
    messages: number;
    pitches: number;
    scripts_generated: number;
  }>;
  genre_distribution: Array<{ genre: string; count: number; percentage: number }>;
  funnel_data: Array<{ key: string; label: string; count: number; conversion: number }>;
  top_content: {
    best_performing_script: null | {
      script_id: string;
      title: string;
      views: number;
      saves: number;
      messages: number;
      pitches: number;
      score: number;
    };
    most_viewed_story: null | {
      story_id: string;
      title: string;
      views: number;
    };
  };
  user_behavior: {
    most_active_day: string | null;
    average_session_activity: number;
    active_days: number;
    session_count: number;
  };
  event_mix: Array<{ key: string; label: string; count: number }>;
};

type InsightsResponse = {
  generated_at: string;
  best_performing_genre: string | null;
  activity_trend: "up" | "down" | "flat";
  user_engagement_behavior: string;
  highlights: string[];
  recommendations: string[];
};

const COLORS = ["#7c3aed", "#22d3ee", "#f472b6", "#38bdf8", "#a855f7", "#f59e0b"];

const chartTooltipStyle = {
  backgroundColor: "rgba(2, 6, 23, 0.94)",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: "16px",
  color: "#e2e8f0",
};

const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = displayValue;
    const delta = value - start;
    const totalFrames = 24;

    const tick = () => {
      frame += 1;
      const progress = frame / totalFrames;
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round((start + delta * eased) * 10) / 10;
      setDisplayValue(progress >= 1 ? value : next);
      if (frame < totalFrames) {
        window.requestAnimationFrame(tick);
      }
    };

    const animation = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animation);
  }, [value]);

  return (
    <span>
      {Number.isInteger(displayValue) ? displayValue.toLocaleString() : displayValue}
      {suffix}
    </span>
  );
};

const MetricCard = ({
  title,
  value,
  icon: Icon,
  trend,
  accentClassName,
}: {
  title: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  trend?: number;
  accentClassName: string;
}) => (
  <Card className="relative overflow-hidden border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl">
    <div className={cn("absolute inset-x-0 top-0 h-px opacity-80", accentClassName)} />
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{title}</p>
        <p className="mt-4 text-3xl font-semibold text-white">
          <AnimatedNumber value={value} />
        </p>
      </div>
      <div className={cn("rounded-2xl border border-white/10 p-3 text-white shadow-[0_18px_45px_rgba(15,23,42,0.2)]", accentClassName)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2 text-sm">
      {typeof trend === "number" ? (
        <>
          {trend >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-300" /> : <TrendingDown className="h-4 w-4 text-rose-300" />}
          <span className={trend >= 0 ? "text-emerald-300" : "text-rose-300"}>
            {Math.abs(trend)}%
          </span>
          <span className="text-slate-400">vs previous week</span>
        </>
      ) : (
        <span className="text-slate-400">Live event tracking enabled</span>
      )}
    </div>
  </Card>
);

export const AnalyticsDashboard = ({
  audience,
  title,
  description,
  primaryActionLabel,
  primaryActionPath,
}: {
  audience: Audience;
  title: string;
  description: string;
  primaryActionLabel: string;
  primaryActionPath: string;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [dateMode, setDateMode] = useState<"7" | "30" | "custom">("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [seeding, setSeeding] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const params = dateMode === "custom"
        ? { audience, start: customStart, end: customEnd }
        : { audience, days: Number(dateMode) };

      const [analyticsResult, insightsResult] = await Promise.all([
        mongodbClient.analytics.getAnalytics(params),
        mongodbClient.analytics.getInsights(params),
      ]);

      if (analyticsResult.error) {
        throw new Error(analyticsResult.error.message || "Could not load analytics");
      }
      if (insightsResult.error) {
        throw new Error(insightsResult.error.message || "Could not load insights");
      }

      setAnalytics(analyticsResult.data as AnalyticsResponse);
      setInsights(insightsResult.data as InsightsResponse);
    } catch (error) {
      toast({
        title: "Analytics unavailable",
        description: error instanceof Error ? error.message : "Could not load the dashboard.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateMode === "custom" && (!customStart || !customEnd)) {
      return;
    }
    void loadDashboard();
  }, [audience, dateMode, customStart, customEnd]);

  const isEmpty = useMemo(() => {
    if (!analytics) return false;
    return analytics.event_mix.every((item) => item.count === 0);
  }, [analytics]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const result = await mongodbClient.analytics.seedDemo(audience);
      if (result.error) {
        throw new Error(result.error.message || "Could not generate demo analytics");
      }
      toast({ title: "Demo analytics ready", description: "Sample activity has been added to the dashboard." });
      await loadDashboard();
    } catch (error) {
      toast({
        title: "Demo seed failed",
        description: error instanceof Error ? error.message : "Could not seed analytics data.",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  };

  if (loading || !analytics || !insights) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.24),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.16),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,1),_rgba(8,15,35,1))] p-6 lg:p-8">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <Card className="border-white/10 bg-white/[0.04] px-8 py-12 text-center text-slate-300 backdrop-blur-xl">
            <Bot className="mx-auto h-8 w-8 animate-pulse text-violet-300" />
            <p className="mt-4">Building your analytics dashboard...</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.24),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.16),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,1),_rgba(8,15,35,1))] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Live Intelligence</p>
            <h1 className="mt-2 font-['Oswald'] text-4xl uppercase tracking-wide text-white lg:text-5xl">{title}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={dateMode} onValueChange={(value: "7" | "30" | "custom") => setDateMode(value)}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.05] text-slate-100 sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => navigate(primaryActionPath)}
              className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-slate-950 hover:from-violet-400 hover:to-cyan-300"
            >
              {audience === "writer" ? <Upload className="mr-2 h-4 w-4" /> : <Rocket className="mr-2 h-4 w-4" />}
              {primaryActionLabel}
            </Button>
          </div>
        </div>

        {dateMode === "custom" ? (
          <Card className="grid gap-4 border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl md:grid-cols-2">
            <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="border-white/10 bg-slate-950/70 text-slate-100" />
            <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="border-white/10 bg-slate-950/70 text-slate-100" />
          </Card>
        ) : null}

        <Card className="overflow-hidden border-white/10 bg-[linear-gradient(135deg,rgba(124,58,237,0.22),rgba(15,23,42,0.92))] p-6 backdrop-blur-xl">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="flex items-center gap-2 text-cyan-200">
                <BrainCircuit className="h-5 w-5" />
                <p className="text-sm font-medium uppercase tracking-[0.28em]">AI Insights</p>
              </div>
              <div className="mt-4 space-y-3">
                {insights.highlights.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl border border-cyan-300/20 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Best Genre</p>
                <p className="mt-3 text-2xl font-semibold text-white">{insights.best_performing_genre || "Still learning"}</p>
                <Badge className="mt-3 bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/15">{insights.user_engagement_behavior}</Badge>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Recommendations</p>
                <div className="mt-3 space-y-2">
                  {insights.recommendations.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-slate-200">
                      <Sparkles className="mt-0.5 h-4 w-4 text-fuchsia-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {isEmpty ? (
          <Card className="border-dashed border-white/15 bg-white/[0.03] p-10 text-center backdrop-blur-xl">
            <Film className="mx-auto h-14 w-14 text-slate-500" />
            <h2 className="mt-4 text-2xl font-semibold text-white">No analytics yet, but the system is live.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Start creating stories, viewing scripts, sending messages, and pitching projects to build real analytics.
              If you want to preview the dashboard immediately, generate sample activity.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={() => navigate(primaryActionPath)} className="bg-violet-500 text-white hover:bg-violet-400">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                {primaryActionLabel}
              </Button>
              <Button variant="outline" className="border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.08]" onClick={handleSeedDemo} disabled={seeding}>
                {seeding ? <Sparkles className="mr-2 h-4 w-4 animate-pulse" /> : <Bot className="mr-2 h-4 w-4" />}
                Generate Demo Data
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard title="Views" value={analytics.summary.total_views} icon={Eye} trend={analytics.summary.growth_percentage} accentClassName="bg-gradient-to-r from-cyan-400/70 to-transparent" />
              <MetricCard title="Saves" value={analytics.summary.scripts_saved} icon={BookmarkPlus} accentClassName="bg-gradient-to-r from-violet-400/70 to-transparent" />
              <MetricCard title="Messages" value={analytics.summary.messages_sent} icon={MessageSquareText} accentClassName="bg-gradient-to-r from-fuchsia-400/70 to-transparent" />
              <MetricCard title="Pitches" value={analytics.summary.pitches_sent} icon={Rocket} accentClassName="bg-gradient-to-r from-emerald-400/70 to-transparent" />
              <MetricCard title="Scripts" value={analytics.summary.scripts_generated} icon={Clapperboard} accentClassName="bg-gradient-to-r from-sky-400/70 to-transparent" />
              <MetricCard title="Growth" value={analytics.summary.growth_percentage} suffix="%" icon={TrendingUp} accentClassName="bg-gradient-to-r from-amber-300/70 to-transparent" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Activity Over Time</p>
                <div className="mt-4 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.daily_activity}>
                      <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="events" stroke="#22d3ee" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="views" stroke="#a855f7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Genre Distribution</p>
                <div className="mt-4 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.genre_distribution} dataKey="count" nameKey="genre" innerRadius={55} outerRadius={95}>
                        {analytics.genre_distribution.map((entry, index) => (
                          <Cell key={entry.genre} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analytics.genre_distribution.slice(0, 5).map((item, index) => (
                    <Badge key={item.genre} className="bg-white/[0.06] text-slate-100 hover:bg-white/[0.06]">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      {item.genre} {item.percentage}%
                    </Badge>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl xl:col-span-2">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Performance Charts</p>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.daily_activity}>
                        <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                        <XAxis dataKey="label" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="scripts_generated" fill="#a855f7" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.daily_activity}>
                        <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                        <XAxis dataKey="label" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Area type="monotone" dataKey="messages" stroke="#f472b6" fill="rgba(244,114,182,0.3)" />
                        <Area type="monotone" dataKey="pitches" stroke="#22d3ee" fill="rgba(34,211,238,0.18)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Behavior Signals</p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Most active day</p>
                    <p className="mt-2 text-xl font-semibold text-white">{analytics.user_behavior.most_active_day || "Not enough data yet"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Average session activity</p>
                    <p className="mt-2 text-xl font-semibold text-white">{analytics.user_behavior.average_session_activity} actions</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Story success score</p>
                    <p className="mt-2 text-xl font-semibold text-white">{analytics.summary.story_success_score}/100</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Pitch readiness meter</p>
                    <p className="mt-2 text-xl font-semibold text-white">{analytics.summary.pitch_readiness_meter}/100</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Funnel Analytics</p>
                <div className="mt-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Funnel dataKey="count" data={analytics.funnel_data} isAnimationActive>
                        <LabelList position="right" fill="#e2e8f0" stroke="none" dataKey="label" />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {analytics.funnel_data.map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 text-sm">
                      <span className="text-slate-300">{item.label}</span>
                      <span className="font-medium text-white">{item.count} · {item.conversion}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-6">
                <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Top Content</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                      <p className="text-sm text-slate-400">Best performing script</p>
                      <p className="mt-2 text-xl font-semibold text-white">{analytics.top_content.best_performing_script?.title || "No standout script yet"}</p>
                      {analytics.top_content.best_performing_script ? (
                        <p className="mt-3 text-sm text-slate-300">
                          {analytics.top_content.best_performing_script.views} views · {analytics.top_content.best_performing_script.saves} saves · score {analytics.top_content.best_performing_script.score}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                      <p className="text-sm text-slate-400">Most viewed story</p>
                      <p className="mt-2 text-xl font-semibold text-white">{analytics.top_content.most_viewed_story?.title || "No story views yet"}</p>
                      {analytics.top_content.most_viewed_story ? (
                        <p className="mt-3 text-sm text-slate-300">{analytics.top_content.most_viewed_story.views} views</p>
                      ) : null}
                    </div>
                  </div>
                </Card>

                <Card className="border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Event Mix</p>
                  <div className="mt-4 h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.event_mix} layout="vertical">
                        <CartesianGrid stroke="rgba(148,163,184,0.1)" strokeDasharray="3 3" />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis type="category" dataKey="label" stroke="#94a3b8" width={120} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="count" fill="#22d3ee" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
