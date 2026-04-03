import { useState, useEffect } from "react";
import { mongodbClient } from "@/lib/mongodb/client";
import WriterLayout from "@/pages/writer/WriterLayout";
import ProducerLayout from "@/pages/producer/ProducerLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Brain, TrendingUp, Target, BarChart3, Loader2, Sparkles } from "lucide-react";

const GENRES = ["Action", "Drama", "Comedy", "Thriller", "Sci-Fi", "Horror", "Romance"];

const SharedIntelligence = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [genre, setGenre] = useState("Action");
  const [timeframe, setTimeframe] = useState("6 months");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptLogline, setScriptLogline] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const getUserRole = async () => {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) return;
      const { data: roleData } = await mongodbClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      setUserRole(roleData?.role || "writer");
    };
    getUserRole();
  }, []);

  const runAnalysis = async (analysisType: string, data: any) => {
    setLoading(true);
    setAnalysis("");
    try {
      const { data: result, error } = await mongodbClient.functions.invoke("intelligence-analysis", {
        body: { analysisType, data },
      });
      if (error) throw error;
      if (result?.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }
      setAnalysis(result.analysis);
      toast({ title: "Analysis complete!" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate analysis.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const GenreSelect = () => (
    <Select value={genre} onValueChange={setGenre}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const AnalysisResult = () => analysis ? (
    <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap mt-6">{analysis}</div>
  ) : null;

  const AnalyzeButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <Button onClick={onClick} disabled={loading} className="w-full">
      {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : label}
    </Button>
  );

  const content = (
    <div className="p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2 flex items-center gap-2">
            <Brain className="w-8 h-8" />Intelligence Hub
          </h1>
          <p className="text-muted-foreground">AI-powered market insights, trend analysis, and script evaluation</p>
        </div>

        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trends"><TrendingUp className="w-4 h-4 mr-2" />Trends</TabsTrigger>
            <TabsTrigger value="predictions"><Target className="w-4 h-4 mr-2" />Predictions</TabsTrigger>
            <TabsTrigger value="evaluation"><BarChart3 className="w-4 h-4 mr-2" />Evaluation</TabsTrigger>
            <TabsTrigger value="competitive"><Sparkles className="w-4 h-4 mr-2" />Competitive</TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <Card className="glass p-6">
              <h3 className="text-xl font-semibold mb-4">Market Trend Analysis</h3>
              <p className="text-muted-foreground mb-6">Analyze current trends, audience preferences, and market demand</p>
              <div className="space-y-4">
                <div><label className="text-sm font-medium mb-2 block">Genre</label><GenreSelect /></div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Timeframe</label>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3 months">Last 3 Months</SelectItem>
                      <SelectItem value="6 months">Last 6 Months</SelectItem>
                      <SelectItem value="1 year">Last Year</SelectItem>
                      <SelectItem value="2 years">Last 2 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <AnalyzeButton onClick={() => runAnalysis("market-trends", { genre, timeframe })} label="Analyze Market Trends" />
              </div>
              <AnalysisResult />
            </Card>
          </TabsContent>

          <TabsContent value="predictions">
            <Card className="glass p-6">
              <h3 className="text-xl font-semibold mb-4">Genre Predictions</h3>
              <p className="text-muted-foreground mb-6">Forecast future trends and emerging opportunities</p>
              <div className="space-y-4">
                <div><label className="text-sm font-medium mb-2 block">Genre</label><GenreSelect /></div>
                <AnalyzeButton onClick={() => runAnalysis("genre-prediction", { genre })} label="Get Genre Predictions" />
              </div>
              <AnalysisResult />
            </Card>
          </TabsContent>

          <TabsContent value="evaluation">
            <Card className="glass p-6">
              <h3 className="text-xl font-semibold mb-4">Script Evaluation</h3>
              <p className="text-muted-foreground mb-6">Get an AI-powered marketability assessment of your script</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Script Title</label>
                  <Input value={scriptTitle} onChange={e => setScriptTitle(e.target.value)} placeholder="Enter your script title" />
                </div>
                <div><label className="text-sm font-medium mb-2 block">Genre</label><GenreSelect /></div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Logline</label>
                  <Textarea value={scriptLogline} onChange={e => setScriptLogline(e.target.value)}
                    placeholder="Enter your script's logline (1-2 sentences)" className="min-h-[100px]" />
                </div>
                <AnalyzeButton
                  onClick={() => runAnalysis("script-evaluation", { title: scriptTitle, genre, logline: scriptLogline })}
                  label="Evaluate Script"
                />
              </div>
              <AnalysisResult />
            </Card>
          </TabsContent>

          <TabsContent value="competitive">
            <Card className="glass p-6">
              <h3 className="text-xl font-semibold mb-4">Competitive Analysis</h3>
              <p className="text-muted-foreground mb-6">Understand the competitive landscape and strategic positioning</p>
              <div className="space-y-4">
                <div><label className="text-sm font-medium mb-2 block">Genre</label><GenreSelect /></div>
                <AnalyzeButton onClick={() => runAnalysis("competitive-analysis", { genre })} label="Run Competitive Analysis" />
              </div>
              <AnalysisResult />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  if (userRole === "writer") return <WriterLayout>{content}</WriterLayout>;
  return <ProducerLayout>{content}</ProducerLayout>;
};

export default SharedIntelligence;
