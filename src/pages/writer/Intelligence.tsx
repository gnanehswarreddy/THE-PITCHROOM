import { useState } from "react";
import WriterLayout from "./WriterLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, TrendingUp, Target, BarChart3, Loader2 } from "lucide-react";

const Intelligence = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [genre, setGenre] = useState("Action");
  const [timeframe, setTimeframe] = useState("6 months");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptLogline, setScriptLogline] = useState("");
  const { toast } = useToast();

  const runAnalysis = async (analysisType: string, data: any) => {
    setLoading(true);
    setAnalysis("");

    try {
      const { data: result, error } = await mongodbClient.functions.invoke("intelligence-analysis", {
        body: { analysisType, data },
      });

      if (error) throw error;

      if (result?.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setAnalysis(result.analysis);
      toast({ title: "Analysis complete!" });
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Error",
        description: "Failed to generate analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <WriterLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Intelligence Hub</h1>
          <p className="text-muted-foreground">
            AI-powered market insights, trend analysis, and script evaluation
          </p>
        </div>

        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trends">
              <TrendingUp className="w-4 h-4 mr-2" />
              Market Trends
            </TabsTrigger>
            <TabsTrigger value="predictions">
              <Target className="w-4 h-4 mr-2" />
              Genre Predictions
            </TabsTrigger>
            <TabsTrigger value="evaluation">
              <BarChart3 className="w-4 h-4 mr-2" />
              Script Evaluation
            </TabsTrigger>
            <TabsTrigger value="competitive">
              <Brain className="w-4 h-4 mr-2" />
              Competitive Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <Card className="glass p-6">
              <h3 className="text-xl font-semibold mb-4">Market Trend Analysis</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Genre</label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Timeframe</label>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3 months">Last 3 Months</SelectItem>
                      <SelectItem value="6 months">Last 6 Months</SelectItem>
                      <SelectItem value="1 year">Last Year</SelectItem>
                      <SelectItem value="2 years">Last 2 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => runAnalysis("market-trends", { genre, timeframe })}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Analyze Market Trends"
                  )}
                </Button>
              </div>
              {analysis && (
                <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                  {analysis}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="predictions">
            <Card className="glass p-6">
              <h3 className="text-xl font-semibold mb-4">Genre Predictions</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Genre</label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => runAnalysis("genre-prediction", { genre })}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Predicting...
                    </>
                  ) : (
                    "Get Genre Predictions"
                  )}
                </Button>
              </div>
              {analysis && (
                <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                  {analysis}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="evaluation">
            <Card className="glass p-6">
              <h3 className="text-xl font-semibold mb-4">Script Evaluation</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Script Title</label>
                  <Input
                    value={scriptTitle}
                    onChange={(e) => setScriptTitle(e.target.value)}
                    placeholder="Enter your script title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Genre</label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Logline</label>
                  <Textarea
                    value={scriptLogline}
                    onChange={(e) => setScriptLogline(e.target.value)}
                    placeholder="Enter your script's logline (1-2 sentences)"
                    className="min-h-[100px]"
                  />
                </div>
                <Button
                  onClick={() =>
                    runAnalysis("script-evaluation", {
                      title: scriptTitle,
                      genre,
                      logline: scriptLogline,
                    })
                  }
                  disabled={loading || !scriptTitle || !scriptLogline}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    "Evaluate Script"
                  )}
                </Button>
              </div>
              {analysis && (
                <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                  {analysis}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="competitive">
            <Card className="glass p-6">
              <h3 className="text-xl font-semibold mb-4">Competitive Analysis</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Genre</label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Comedy">Comedy</SelectItem>
                      <SelectItem value="Thriller">Thriller</SelectItem>
                      <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                      <SelectItem value="Horror">Horror</SelectItem>
                      <SelectItem value="Romance">Romance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => runAnalysis("competitive-analysis", { genre })}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Run Competitive Analysis"
                  )}
                </Button>
              </div>
              {analysis && (
                <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                  {analysis}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </WriterLayout>
  );
};

export default Intelligence;
