import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { mongodbClient } from "@/lib/mongodb/client";
import {
  BarChart3, Sparkles, Loader2, FileText, Target, TrendingUp,
  Users, Clock, Palette, Drama, Heart, Zap, Star, AlertTriangle,
  CheckCircle, Download
} from "lucide-react";

interface AnalysisResult {
  coverage: {
    logline: string;
    synopsis: string;
    premise: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    overallRating: number;
    commercialViability: number;
  };
  genre: {
    primary: string;
    secondary: string[];
    tone: string;
    targetAudience: string;
    comparableTitles: string[];
    uniqueElements: string[];
  };
  marketability: {
    score: number;
    budgetEstimate: string;
    targetPlatforms: string[];
    demographicAppeal: { group: string; score: number }[];
    trendAlignment: string[];
    castingPotential: string;
    internationalAppeal: number;
  };
  structure: {
    actBreakdown: { act: string; description: string; strength: number }[];
    pacingScore: number;
    characterArcs: { name: string; arc: string; development: number }[];
    thematicDepth: number;
    dialogueQuality: number;
  };
}

const ScriptAnalysis = () => {
  const [scriptContent, setScriptContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const analyzeScript = async () => {
    if (!scriptContent.trim()) {
      toast({
        title: "Script Required",
        description: "Please paste your script content for analysis.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setAnalysis(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 90));
    }, 500);

    try {
      const { data, error } = await mongodbClient.functions.invoke("fast-script-analysis", {
        body: {
          scriptContent: scriptContent.trim(),
          fileName: "script_analysis",
        },
      });

      if (error) throw new Error(error.message || "Analysis failed");

      // The new endpoint returns structured data directly
      if (data) {
        setAnalysis(data as AnalysisResult);
        toast({ title: "Analysis Complete!" });
      } else {
        throw new Error("Invalid analysis response format");
      }

      setProgress(100);
    } catch (error) {
      console.error("Script analysis error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze script",
        variant: "destructive",
      });
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const exportAnalysis = () => {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "script-analysis.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported!", description: "Analysis downloaded" });
  };

  const ScoreBar = ({ score, label, max = 10 }: { score: number; label: string; max?: number }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}/{max}</span>
      </div>
      <Progress value={(score / max) * 100} className="h-2" />
    </div>
  );

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 6) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      <Card className="glass p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Script Analysis
        </h3>

        <Textarea
          value={scriptContent}
          onChange={(e) => setScriptContent(e.target.value)}
          placeholder="Paste your screenplay or treatment here for comprehensive analysis...

The AI will analyze:
• Coverage report with strengths and weaknesses
• Genre classification and comparable titles
• Marketability scoring and platform recommendations
• Structure, pacing, and character arc assessment"
          className="min-h-[200px] bg-background/50 font-mono text-sm mb-4"
        />

        <Button onClick={analyzeScript} disabled={isLoading} className="w-full" size="lg">
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing Script...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Analyze Script
            </>
          )}
        </Button>

        {isLoading && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Running comprehensive analysis...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </Card>

      {analysis && (
        <>
          {/* Overall Scores Card */}
          <Card className="glass p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                Overall Assessment
              </h3>
              <Button size="sm" variant="outline" onClick={exportAnalysis}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className={`text-4xl font-bold ${getScoreColor(analysis.coverage.overallRating)}`}>
                  {analysis.coverage.overallRating}
                </p>
                <p className="text-sm text-muted-foreground">Overall</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className={`text-4xl font-bold ${getScoreColor(analysis.marketability.score)}`}>
                  {analysis.marketability.score}
                </p>
                <p className="text-sm text-muted-foreground">Marketability</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className={`text-4xl font-bold ${getScoreColor(analysis.structure.pacingScore)}`}>
                  {analysis.structure.pacingScore}
                </p>
                <p className="text-sm text-muted-foreground">Pacing</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className={`text-4xl font-bold ${getScoreColor(analysis.coverage.commercialViability)}`}>
                  {analysis.coverage.commercialViability}
                </p>
                <p className="text-sm text-muted-foreground">Commercial</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium mb-1">Logline</p>
              <p className="text-foreground">{analysis.coverage.logline}</p>
            </div>
          </Card>

          <Tabs defaultValue="coverage" className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="coverage" className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Coverage</span>
              </TabsTrigger>
              <TabsTrigger value="genre" className="flex items-center gap-1">
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Genre</span>
              </TabsTrigger>
              <TabsTrigger value="market" className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Market</span>
              </TabsTrigger>
              <TabsTrigger value="structure" className="flex items-center gap-1">
                <Drama className="w-4 h-4" />
                <span className="hidden sm:inline">Structure</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="coverage">
              <Card className="glass p-6 space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Synopsis</p>
                  <p className="text-sm leading-relaxed">{analysis.coverage.synopsis}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Premise</p>
                  <p className="text-sm leading-relaxed">{analysis.coverage.premise}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" /> Strengths
                    </p>
                    <ul className="space-y-2">
                      {analysis.coverage.strengths.map((s, i) => (
                        <li key={i} className="text-sm p-2 rounded bg-green-500/10 border-l-2 border-green-500">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" /> Areas to Improve
                    </p>
                    <ul className="space-y-2">
                      {analysis.coverage.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm p-2 rounded bg-yellow-500/10 border-l-2 border-yellow-500">
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Zap className="w-4 h-4 text-primary" /> Recommendations
                  </p>
                  <ul className="space-y-2">
                    {analysis.coverage.recommendations.map((r, i) => (
                      <li key={i} className="text-sm p-2 rounded bg-primary/10 border-l-2 border-primary">
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="genre">
              <Card className="glass p-6 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="text-lg py-1 px-3">{analysis.genre.primary}</Badge>
                  {analysis.genre.secondary.map((g, i) => (
                    <Badge key={i} variant="outline">{g}</Badge>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Tone</p>
                    <p className="font-medium">{analysis.genre.tone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Target Audience</p>
                    <p className="font-medium">{analysis.genre.targetAudience}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Comparable Titles</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.genre.comparableTitles.map((t, i) => (
                      <Badge key={i} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Unique Elements</p>
                  <ul className="space-y-1">
                    {analysis.genre.uniqueElements.map((e, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <Star className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="market">
              <Card className="glass p-6 space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-background/50">
                    <p className="text-sm text-muted-foreground mb-1">Budget Estimate</p>
                    <p className="text-xl font-bold text-primary">{analysis.marketability.budgetEstimate}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-background/50">
                    <p className="text-sm text-muted-foreground mb-1">International Appeal</p>
                    <p className="text-xl font-bold">{analysis.marketability.internationalAppeal}/10</p>
                  </div>
                  <div className="p-4 rounded-lg bg-background/50">
                    <p className="text-sm text-muted-foreground mb-1">Casting Potential</p>
                    <p className="text-sm font-medium">{analysis.marketability.castingPotential}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Target className="w-4 h-4" /> Target Platforms
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.marketability.targetPlatforms.map((p, i) => (
                      <Badge key={i}>{p}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                    <Users className="w-4 h-4" /> Demographic Appeal
                  </p>
                  <div className="space-y-3">
                    {analysis.marketability.demographicAppeal.map((d, i) => (
                      <ScoreBar key={i} score={d.score} label={d.group} />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Trend Alignment</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.marketability.trendAlignment.map((t, i) => (
                      <Badge key={i} variant="outline" className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="structure">
              <Card className="glass p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <ScoreBar score={analysis.structure.pacingScore} label="Pacing" />
                  <ScoreBar score={analysis.structure.thematicDepth} label="Thematic Depth" />
                  <ScoreBar score={analysis.structure.dialogueQuality} label="Dialogue Quality" />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-3">Act Breakdown</p>
                  <div className="space-y-3">
                    {analysis.structure.actBreakdown.map((act, i) => (
                      <div key={i} className="p-3 rounded-lg bg-background/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{act.act}</span>
                          <Badge variant={act.strength >= 8 ? "default" : "outline"}>
                            {act.strength}/10
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{act.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                    <Heart className="w-4 h-4" /> Character Arcs
                  </p>
                  <div className="space-y-3">
                    {analysis.structure.characterArcs.map((c, i) => (
                      <div key={i} className="p-3 rounded-lg bg-background/50">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">{c.name}</span>
                          <Badge variant="secondary">{c.development}/10</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{c.arc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default ScriptAnalysis;
