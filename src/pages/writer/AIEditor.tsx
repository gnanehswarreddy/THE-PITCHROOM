import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import WriterLayout from "./WriterLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, BarChart3, User, Clapperboard, History, BookOpenText, ArrowLeft, Loader2, Save, Sparkles, PenTool, Theater, AlignLeft } from "lucide-react";
import UploadStep from "@/components/ai-editor/UploadStep";
import AnalysisStep from "@/components/ai-editor/AnalysisStep";
import EnhanceStep from "@/components/ai-editor/EnhanceStep";
import ScriptVersionHistory from "@/components/ai-editor/ScriptVersionHistory";
import CharacterDevelopment from "@/components/ai-editor/CharacterDevelopment";
import SceneBreakdown from "@/components/ai-editor/SceneBreakdown";
import ScriptAnalysis from "@/components/ai-editor/ScriptAnalysis";
import PlotSmithPanel from "@/components/ai-editor/PlotSmithPanel";
import StoryToScriptPanel from "@/components/ai-editor/StoryToScriptPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { mongodbClient, type ScriptRecord } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import { buildEnhancementContext } from "@/lib/ai/pitchroom-engine";

type EditorStep = "upload" | "analysis" | "enhance";

const AIEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<EditorStep>("upload");
  const [scriptText, setScriptText] = useState("");
  const [scriptRecord, setScriptRecord] = useState<ScriptRecord | null>(null);
  const [loadingScript, setLoadingScript] = useState(Boolean(id));
  const [savingScript, setSavingScript] = useState(false);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("english");
  const isStoryToScriptMode = searchParams.get("mode") === "story-to-script";
  const defaultTab = useMemo(() => (isStoryToScriptMode ? "story-to-script" : "studio"), [isStoryToScriptMode]);

  const handleAnalyze = (text: string, language: string) => {
    setScriptText(text);
    setSelectedLanguage(language || "english");
    setStep("analysis");
  };

  const handleEnhance = (text: string, analysis: any) => {
    setScriptText(text);
    setAnalysisData(analysis);
    setStep("enhance");
  };

  useEffect(() => {
    if (!id) {
      setLoadingScript(false);
      return;
    }

    const loadScript = async () => {
      setLoadingScript(true);
      const { data, error } = await mongodbClient.scripts.getById(id);
      if (error || !data) {
        toast({
          title: "Script unavailable",
          description: error?.message || "We could not load this script in AI Studio.",
          variant: "destructive",
        });
        setLoadingScript(false);
        return;
      }

      setScriptRecord(data);
      setScriptText(data.scriptContent || "");
      setLoadingScript(false);
    };

    void loadScript();
  }, [id, toast]);

  const saveStudioScript = async (nextContent?: string) => {
    if (!id || !scriptRecord) return;
    const contentToSave = nextContent ?? scriptText;
    setSavingScript(true);
    const { error } = await mongodbClient
      .from("scripts")
      .update({
        scriptContent: contentToSave,
        updated_at: new Date().toISOString(),
      })
      .eq("_id", id);

    if (error) {
      toast({ title: "Save failed", description: error.message || "Could not save script changes.", variant: "destructive" });
    } else {
      setScriptRecord((current) => current ? { ...current, scriptContent: contentToSave } : current);
    }
    setSavingScript(false);
  };

  const runStudioTool = async (action: string) => {
    if (!scriptText.trim()) {
      toast({ title: "Script required", description: "Load or enter script content first.", variant: "destructive" });
      return;
    }

    setRunningTool(action);
    try {
      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action,
          text: scriptText.trim(),
          context: buildEnhancementContext(selectedLanguage, action),
          language: selectedLanguage,
        },
      });

      if (error) throw new Error(error.message || "AI tool failed");
      const nextContent = String(data?.result || data?.content || "").trim();
      if (!nextContent) throw new Error("AI returned empty content.");

      setScriptText(nextContent);
      toast({ title: "AI update ready", description: "The script has been updated in the editor." });
    } catch (error) {
      toast({
        title: "AI tool failed",
        description: error instanceof Error ? error.message : "Could not enhance script.",
        variant: "destructive",
      });
    } finally {
      setRunningTool(null);
    }
  };

  if (id) {
    const studioTools = [
      { id: "expand_scene", label: "Generate Scene", icon: Sparkles },
      { id: "polish_dialogue", label: "Improve Dialogues", icon: PenTool },
      { id: "rewrite_scene", label: "Add Emotions", icon: Theater },
      { id: "format_screenplay", label: "Format Screenplay", icon: AlignLeft },
    ];

    return (
      <WriterLayout forceDark hideThemeToggle>
        <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_24%),linear-gradient(180deg,_rgba(9,9,14,1),_rgba(20,16,28,1))] px-4 py-6 lg:px-6 lg:py-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Button variant="ghost" onClick={() => navigate(`/writer/scripts/${id}`)} className="mb-3 px-0 text-slate-300 hover:bg-transparent hover:text-white">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Script Page
                </Button>
                <p className="text-xs uppercase tracking-[0.35em] text-fuchsia-300/70">AI Studio</p>
                <h1 className="mt-2 font-['Oswald'] text-4xl uppercase tracking-wide text-white">
                  Editing: {scriptRecord?.title || "Loading Script"}
                </h1>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => void saveStudioScript()}
                  disabled={savingScript || loadingScript}
                  className="rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-blue-600 font-semibold text-white hover:from-fuchsia-500 hover:to-blue-500"
                >
                  {savingScript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </div>

            {loadingScript ? (
              <Card className="border-slate-800 bg-slate-950/80 p-10 text-center text-slate-300">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-fuchsia-300" />
                <p className="mt-4">Loading script in AI Studio...</p>
              </Card>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
                <Card className="border-slate-800 bg-slate-950/85 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Script Editor</p>
                      <p className="mt-2 text-sm text-slate-400">Editable screenplay content with manual save.</p>
                    </div>
                    <span className="text-xs text-slate-500">{savingScript ? "Saving..." : "Manual save"}</span>
                  </div>
                  <Textarea
                    value={scriptText}
                    onChange={(event) => setScriptText(event.target.value)}
                    className="min-h-[72vh] resize-none border-slate-800 bg-black/30 font-mono text-sm leading-7 text-slate-100"
                    placeholder="Script content will appear here..."
                  />
                </Card>

                <Card className="border-slate-800 bg-slate-950/85 p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">AI Tools</p>
                    <p className="mt-2 text-sm text-slate-400">Use the current script content as input and enhance it instantly.</p>
                  </div>
                  <div className="mt-6 space-y-3">
                    {studioTools.map((tool) => {
                      const Icon = tool.icon;
                      const active = runningTool === tool.id;
                      return (
                        <Button
                          key={tool.id}
                          variant="outline"
                          className="h-14 w-full justify-start rounded-2xl border-slate-700 bg-slate-900/70 text-left text-white hover:border-fuchsia-500/60 hover:bg-slate-900"
                          disabled={Boolean(runningTool) || loadingScript}
                          onClick={() => void runStudioTool(tool.id)}
                        >
                          {active ? <Loader2 className="mr-3 h-5 w-5 animate-spin text-fuchsia-300" /> : <Icon className="mr-3 h-5 w-5 text-fuchsia-300" />}
                          <span className="font-semibold">{tool.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </WriterLayout>
    );
  }

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 py-4">
      {[
        { key: "upload", label: "Upload" },
        { key: "analysis", label: "Analysis" },
        { key: "enhance", label: "Enhance" },
      ].map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <button
            onClick={() => {
              if (s.key === "upload") setStep("upload");
              if (s.key === "analysis" && scriptText) setStep("analysis");
              if ((s.key === "enhance") && scriptText) setStep("enhance");
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              step === s.key
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(265_85%_58%/0.3)]"
                : step === "enhance" && s.key !== "enhance" || (step === "analysis" && s.key === "upload")
                ? "bg-muted/50 text-muted-foreground hover:bg-muted"
                : "bg-muted/30 text-muted-foreground/50"
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current/30">
              {i + 1}
            </span>
            {s.label}
          </button>
          {i < 2 && <div className="w-8 h-px bg-border/40" />}
        </div>
      ))}
    </div>
  );

  return (
    <WriterLayout>
      <div className="p-4 lg:p-6">
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="grid grid-cols-7 w-full max-w-5xl">
            <TabsTrigger value="studio" className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              <span className="hidden sm:inline">Studio</span>
            </TabsTrigger>
            <TabsTrigger value="story-to-script" className="flex items-center gap-2">
              <Clapperboard className="w-4 h-4" />
              <span className="hidden sm:inline">Story to Script</span>
            </TabsTrigger>
            <TabsTrigger value="plot-smith" className="flex items-center gap-2">
              <BookOpenText className="w-4 h-4" />
              <span className="hidden sm:inline">PlotSmith</span>
            </TabsTrigger>
            <TabsTrigger value="deep-analysis" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="characters" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Characters</span>
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="flex items-center gap-2">
              <Clapperboard className="w-4 h-4" />
              <span className="hidden sm:inline">Breakdown</span>
            </TabsTrigger>
            <TabsTrigger value="versions" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Versions</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="studio">
            {stepIndicator}
            {step === "upload" && <UploadStep onAnalyze={handleAnalyze} />}
            {step === "analysis" && (
              <AnalysisStep
                scriptText={scriptText}
                selectedLanguage={selectedLanguage}
                onEnhance={handleEnhance}
                onBack={() => setStep("upload")}
              />
            )}
            {step === "enhance" && (
              <EnhanceStep
                scriptText={scriptText}
                selectedLanguage={selectedLanguage}
                onBack={() => setStep("analysis")}
              />
            )}
          </TabsContent>

          <TabsContent value="story-to-script">
            <StoryToScriptPanel />
          </TabsContent>

          <TabsContent value="plot-smith">
            <PlotSmithPanel />
          </TabsContent>

          <TabsContent value="deep-analysis">
            <ScriptAnalysis />
          </TabsContent>

          <TabsContent value="characters">
            <CharacterDevelopment selectedLanguage={selectedLanguage} />
          </TabsContent>

          <TabsContent value="breakdown">
            <SceneBreakdown selectedLanguage={selectedLanguage} />
          </TabsContent>

          <TabsContent value="versions">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Current Script</h3>
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Your current script content..."
                  className="w-full min-h-[400px] bg-muted/20 border border-border/30 rounded-xl p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <ScriptVersionHistory
                currentContent={scriptText}
                onRevert={(content) => setScriptText(content)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </WriterLayout>
  );
};

export default AIEditor;
