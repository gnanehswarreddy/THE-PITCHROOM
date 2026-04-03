import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, Expand, RefreshCw, MessageCircle, PenTool, AlignLeft, BookOpen, Rocket,
  Loader2, Copy, Save, Timer, Check, X, ArrowLeft, CheckCircle2, RotateCw, Eye, Layers,
  Download, FileText, Merge
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mongodbClient } from "@/lib/mongodb/client";
import { useNavigate } from "react-router-dom";
import { buildEnhancementContext } from "@/lib/ai/pitchroom-engine";

const scopeOptions = ["Entire Script", "Selected Act", "Selected Scene"];

const enhancementOptions = [
  { id: "expand_scene", label: "Expand Scene", icon: Expand, desc: "Add depth, description, and tension." },
  { id: "rewrite_scene", label: "Rewrite Scene", icon: RefreshCw, desc: "Improve structure and pacing." },
  { id: "generate_dialogue", label: "Generate Dialogue", icon: MessageCircle, desc: "Create new engaging dialogue." },
  { id: "polish_dialogue", label: "Polish Dialogue", icon: PenTool, desc: "Refine and elevate spoken lines." },
  { id: "format_screenplay", label: "Format Script", icon: AlignLeft, desc: "Convert to professional screenplay format." },
  { id: "story_transform", label: "Full Story", icon: BookOpen, desc: "Generate complete story from script base." },
];

interface ActionResult {
  action: string;
  label: string;
  content: string;
  status: "pending" | "loading" | "success" | "error";
  duration?: number;
  accepted?: boolean;
}

interface EnhanceStepProps {
  scriptText: string;
  selectedLanguage: string;
  onBack: () => void;
}

type SaveFormat = "script" | "story";

const STORY_ACTION_ID = "story_transform";

const buildStoryDraft = (content: string, fallbackTitle: string) => {
  const cleaned = content.trim();
  const firstLine = cleaned.split("\n").map((l) => l.trim()).find(Boolean) || fallbackTitle;
  const title = firstLine.replace(/^#+\s*/, "").slice(0, 100) || fallbackTitle;
  const firstSentence = cleaned.replace(/\s+/g, " ").split(/[.!?]/)[0]?.trim() || "AI-generated story.";
  const logline = firstSentence.slice(0, 280);

  return {
    title,
    logline,
    genre: "Drama",
    status: "draft",
    characters: [],
    themes: [],
    notes: cleaned,
    starred: false,
  };
};

const buildScriptDraft = (content: string, fallbackTitle: string) => {
  const cleaned = content.trim();
  const firstLine = cleaned.split("\n").map((l) => l.trim()).find(Boolean) || fallbackTitle;
  const title = firstLine.replace(/^#+\s*/, "").slice(0, 120) || fallbackTitle;
  const firstSentence = cleaned.replace(/\s+/g, " ").split(/[.!?]/)[0]?.trim() || "AI-generated script.";
  const logline = firstSentence.slice(0, 280);

  return {
    title,
    logline,
    genre: "Drama",
    file_name: `${title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "ai-script"}.txt`,
    file_url: "",
    visibility: "private",
    status: "draft",
    views: 0,
  };
};

const EnhanceStep = ({ scriptText, selectedLanguage, onBack }: EnhanceStepProps) => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>(enhancementOptions.map(o => o.id));
  const [masterScope, setMasterScope] = useState("Entire Script");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [allResults, setAllResults] = useState<ActionResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [singleResult, setSingleResult] = useState("");
  const [singleActionId, setSingleActionId] = useState<string | null>(null);
  const [saveFormat, setSaveFormat] = useState<SaveFormat>("script");
  const [lastSavedFormat, setLastSavedFormat] = useState<SaveFormat | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedResult === STORY_ACTION_ID) {
      setSaveFormat("story");
    }
  }, [selectedResult]);

  const toggleOption = (id: string) => {
    setSelectedOptions((prev) => prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]);
  };

  const selectAll = () => setSelectedOptions(enhancementOptions.map(o => o.id));
  const deselectAll = () => setSelectedOptions([]);

  const runSingleAction = useCallback(async (action: string) => {
    setIsLoading(true);
    setActiveAction(action);
    setSingleActionId(action);
    if (action === STORY_ACTION_ID) {
      setSaveFormat("story");
    }
    setSingleResult("");
    setProgress(0);
    setGenerationTime(null);
    const startTime = Date.now();
    let progressInterval: ReturnType<typeof setInterval>;

    try {
      progressInterval = setInterval(() => setProgress(prev => Math.min(prev + 3, 90)), 300);
      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action,
          text: scriptText.trim(),
          context: buildEnhancementContext(selectedLanguage, action),
          language: selectedLanguage,
        },
      });
      if (error) throw new Error(error.message || "AI service unavailable");

      const fullResult = String(data?.result || data?.content || "").trim();
      if (!fullResult) throw new Error("No AI output received");
      setSingleResult(fullResult);

      clearInterval(progressInterval);
      setProgress(100);
      const duration = Date.now() - startTime;
      setGenerationTime(duration);

      // Update allResults if this action exists there
      setAllResults(prev => prev.map(r => r.action === action ? { ...r, content: fullResult, status: "success" as const, duration } : r));

      toast({ title: "Generated!", description: `Completed in ${(duration / 1000).toFixed(1)}s` });
    } catch (error) {
      clearInterval(progressInterval!);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [scriptText, selectedLanguage, toast]);

  const handleRunAll = useCallback(async () => {
    const actionsToRun = selectedOptions.length > 0 ? selectedOptions : enhancementOptions.map(o => o.id);
    if (actionsToRun.length === 0) {
      toast({ title: "Select at least one enhancement", variant: "destructive" });
      return;
    }

    setIsRunningAll(true);
    setSingleResult("");
    setSelectedResult(null);
    const initialResults: ActionResult[] = actionsToRun.map(id => {
      const opt = enhancementOptions.find(o => o.id === id)!;
      return { action: id, label: opt.label, content: "", status: "loading" as const, accepted: false };
    });
    setAllResults(initialResults);
    setModalOpen(false);

    const startTime = Date.now();
    const promises = actionsToRun.map(async (action) => {
      const actionStart = Date.now();
      try {
        const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
          body: {
            action,
            text: scriptText.trim(),
            context: buildEnhancementContext(selectedLanguage, action),
            language: selectedLanguage,
          },
        });
        if (error) throw new Error(error.message || "AI error");
        const content = String(data?.result || data?.content || "").trim();
        if (!content) throw new Error("No AI output received");
        return { action, label: enhancementOptions.find(o => o.id === action)!.label, content, status: "success" as const, duration: Date.now() - actionStart, accepted: false };
      } catch {
        return { action, label: enhancementOptions.find(o => o.id === action)!.label, content: "Failed to generate", status: "error" as const, duration: Date.now() - actionStart, accepted: false };
      }
    });

    const results = await Promise.all(promises);
    setAllResults(results);
    const successCount = results.filter(r => r.status === "success").length;
    toast({ title: `Generated ${successCount}/${actionsToRun.length} enhancements`, description: `All completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s` });

    const firstSuccess = results.find(r => r.status === "success");
    if (firstSuccess) setSelectedResult(firstSuccess.action);
    setIsRunningAll(false);
  }, [scriptText, selectedLanguage, selectedOptions, toast]);

  const handleAccept = async (action: string) => {
    const acceptedResult = allResults.find(r => r.action === action && r.status === "success");
    setAllResults(prev => prev.map(r => r.action === action ? { ...r, accepted: true } : r));

    try {
      if (acceptedResult) {
        await saveToLibraryByFormat(acceptedResult.content, acceptedResult.label, saveFormat);
        toast({
          title: "Enhancement accepted!",
          description: saveFormat === "story" ? "Saved to My Stories." : "Saved to My Scripts.",
        });
        return;
      }
      toast({ title: "Enhancement accepted!" });
    } catch {
      toast({ title: "Accepted, but story save failed", variant: "destructive" });
    }
  };

  const saveStoryToLibrary = useCallback(async (content: string, label: string) => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;

    const story = buildStoryDraft(content, `AI Story - ${label}`);
    const { error } = await mongodbClient.from("stories").insert({
      user_id: user.id,
      ...story,
    });

    if (error) {
      throw new Error(error.message || "Failed to save story");
    }
  }, []);

  const saveScriptToLibrary = useCallback(async (content: string, label: string) => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;

    const script = buildScriptDraft(content, `AI Script - ${label}`);
    const { error } = await mongodbClient.from("scripts").insert({
      writer_id: user.id,
      ...script,
    });

    if (error) {
      throw new Error(error.message || "Failed to save script");
    }
  }, []);

  const saveToLibraryByFormat = useCallback(async (content: string, label: string, format: SaveFormat) => {
    if (format === "story") {
      await saveStoryToLibrary(content, label);
      return;
    }
    await saveScriptToLibrary(content, label);
  }, [saveScriptToLibrary, saveStoryToLibrary]);

  const handleAcceptAll = async () => {
    const successResults = allResults.filter(r => r.status === "success");
    setAllResults(prev => prev.map(r => r.status === "success" ? { ...r, accepted: true } : r));

    // Save combined result as a new version
    try {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) return;
      const result = await mongodbClient.from("script_versions").select("version_number").eq("user_id", user.id).order("version_number", { ascending: false }).limit(1) as { data: any[] | null, error: any, count: any };
      const versions = result.data || [];
      const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;
      const combinedContent = successResults.map(r => `=== ${r.label} ===\n\n${r.content}`).join("\n\n---\n\n");
      await mongodbClient.from("script_versions").insert({
        user_id: user.id, version_number: nextVersion, title: `All Enhancements v${nextVersion}`,
        content: combinedContent, change_summary: `Applied ${successResults.length} enhancements`,
      });

      const preferredResult = successResults.find(r => r.action === STORY_ACTION_ID) || successResults[0];
      if (preferredResult) {
        await saveToLibraryByFormat(preferredResult.content, preferredResult.label, saveFormat);
      }

      toast({
        title: "All enhancements accepted & saved!",
        description: `${saveFormat === "story" ? "Saved to Stories" : "Saved to Scripts"} + version ${nextVersion}.`,
      });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleRegenerate = (action: string) => {
    setAllResults(prev => prev.map(r => r.action === action ? { ...r, status: "loading" as const, content: "" } : r));
    setSelectedResult(action);

    mongodbClient.functions.invoke("ai-studio", {
      body: {
        action,
        text: scriptText.trim(),
        context: buildEnhancementContext(selectedLanguage, action),
        language: selectedLanguage,
      },
    })
      .then(data => {
        if (data.error) throw new Error(data.error.message || "AI error");
        const content = String(data.data?.result || data.data?.content || "").trim();
        if (!content) throw new Error("No AI output received");
        setAllResults(prev => prev.map(r => r.action === action ? { ...r, content, status: "success" as const, accepted: false } : r));
        toast({ title: "Regenerated!" });
      })
      .catch(() => {
        setAllResults(prev => prev.map(r => r.action === action ? { ...r, content: "Failed", status: "error" as const } : r));
        toast({ title: "Regeneration failed", variant: "destructive" });
      });
  };

  const handleSaveResult = async (content: string, label: string, action: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) return;
      const result = await mongodbClient.from("script_versions").select("version_number").eq("user_id", user.id).order("version_number", { ascending: false }).limit(1) as { data: any[] | null, error: any, count: any };
      const versions = result.data || [];
      const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;
      await mongodbClient.from("script_versions").insert({ user_id: user.id, version_number: nextVersion, title: `AI: ${label}`, content, change_summary: `Enhancement - ${label}` });

      await saveToLibraryByFormat(content, label, saveFormat);
      setLastSavedFormat(saveFormat);
      toast({
        title: "Saved!",
        description: saveFormat === "story"
          ? `Version ${nextVersion}. Story added to My Stories.`
          : `Version ${nextVersion}. Script added to My Scripts.`,
      });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  const handleSaveSingleResult = async () => {
    if (!singleResult.trim()) return;
    const action = singleActionId || "single_output";
    const label = enhancementOptions.find((o) => o.id === action)?.label || "Single Output";
    await handleSaveResult(singleResult, label, action);
  };

  const openSavedDestination = () => {
    if (!lastSavedFormat) return;
    if (lastSavedFormat === "story") {
      navigate("/writer/stories");
      return;
    }
    navigate("/writer/scripts");
  };

  const exportAsPDF = (content: string, title: string) => {
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj
4 0 obj
<< /Length ${content.length + 50} >>
stream
BT
/F1 10 Tf
36 756 Td
12 TL
${content.split('\n').map(line => `(${line.replace(/[()\\]/g, '\\$&')}) '`).join('\n')}
ET
endstream
endobj
xref
0 6
trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "PDF downloaded!" });
  };

  const exportAsFDX = (content: string, title: string) => {
    const fdxContent = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="4">
  <Content>
    <Paragraph Type="Action">
      <Text>${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Text>
    </Paragraph>
  </Content>
  <TitlePage>
    <Content>
      <Paragraph Type="Title Page">
        <Text>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Text>
      </Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>`;
    const blob = new Blob([fdxContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.fdx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Final Draft (.fdx) downloaded!" });
  };

  const exportAsText = (content: string, title: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Text file downloaded!" });
  };

  const handleMergeAll = async () => {
    const accepted = allResults.filter(r => r.accepted && r.status === "success");
    if (accepted.length === 0) {
      toast({ title: "Accept at least one enhancement first", variant: "destructive" });
      return;
    }
    const mergedContent = accepted.map(r => r.content).join("\n\n");
    setIsSaving(true);
    try {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) return;
      const result = await mongodbClient.from("script_versions").select("version_number").eq("user_id", user.id).order("version_number", { ascending: false }).limit(1) as { data: any[] | null, error: any, count: any };
      const versions = result.data || [];
      const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;
      await mongodbClient.from("script_versions").insert({
        user_id: user.id, version_number: nextVersion, title: `Merged Final Script v${nextVersion}`,
        content: mergedContent, change_summary: `Merged ${accepted.length} accepted enhancements into final script`,
      });
      toast({ title: "Merged & saved!", description: `Final script saved as version ${nextVersion}` });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
    finally { setIsSaving(false); }
  };

  const successResults = allResults.filter(r => r.status === "success");
  const acceptedCount = allResults.filter(r => r.accepted).length;
  const currentResult = allResults.find(r => r.action === selectedResult);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-space text-foreground">Enhancement Studio</h1>
          <p className="text-sm text-muted-foreground">Enhance your script with AI-powered tools.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl border-border/40">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Analysis
        </Button>
      </div>

      {/* Apply All Enhancements - Primary CTA */}
      <div
        className="glass rounded-2xl p-6 border border-primary/20 cursor-pointer group transition-all hover:border-primary/40 shadow-[0_0_50px_hsl(265_85%_58%_/_0.08)] hover:shadow-[0_0_60px_hsl(265_85%_58%_/_0.12)]"
        onClick={() => setModalOpen(true)}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors shrink-0">
            <Layers className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground font-space">✨ Apply All Enhancements</h2>
            <p className="text-sm text-muted-foreground">Run all AI enhancements in parallel and review results with before/after comparison.</p>
          </div>
          <Rocket className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* Enhancement Selection Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg glass border-border/30">
          <DialogHeader>
            <DialogTitle className="font-space text-lg">Select Enhancements</DialogTitle>
            <DialogDescription>Choose which AI enhancements to apply to your script.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{selectedOptions.length}/{enhancementOptions.length} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>Select All</Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>Clear</Button>
            </div>
          </div>
          <div className="space-y-2 py-2">
            {enhancementOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 cursor-pointer transition-colors border border-transparent hover:border-border/20">
                  <Checkbox checked={selectedOptions.includes(opt.id)} onCheckedChange={() => toggleOption(opt.id)} />
                  <Icon className="w-4 h-4 text-primary/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Scope</p>
            <Select value={masterScope} onValueChange={setMasterScope}>
              <SelectTrigger className="bg-muted/30 border-border/40 rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{scopeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button disabled={isRunningAll || selectedOptions.length === 0} onClick={handleRunAll} className="w-full h-11 rounded-xl font-semibold relative overflow-hidden group shadow-[0_0_25px_hsl(265_85%_58%_/_0.2)]">
            <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-[hsl(285_80%_55%)] opacity-100 group-hover:opacity-90 transition-opacity" />
            <span className="relative flex items-center gap-2">
              {isRunningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {isRunningAll ? "Running..." : `Apply ${selectedOptions.length} Enhancement${selectedOptions.length !== 1 ? "s" : ""}`}
            </span>
          </Button>
        </DialogContent>
      </Dialog>

      {/* Individual Tool Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {enhancementOptions.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeAction === tool.id;
          const resultItem = allResults.find(r => r.action === tool.id);

          const triggerEnhancement = () => {
            if (isLoading || isRunningAll) return;
            if (resultItem?.status === "success") {
              setSelectedResult(tool.id);
              return;
            }
            runSingleAction(tool.id);
          };

          return (
            <div
              key={tool.id}
              role="button"
              tabIndex={0}
              onClick={triggerEnhancement}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  triggerEnhancement();
                }
              }}
              className={`glass rounded-xl p-4 border transition-all hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer ${resultItem?.accepted ? "border-accent/40 bg-accent/5" : "border-border/20"}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">{tool.label}</h3>
                  <p className="text-xs text-muted-foreground">{tool.desc}</p>
                </div>
                {resultItem?.accepted && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
                {resultItem?.status === "success" && !resultItem.accepted && <Check className="w-4 h-4 text-primary shrink-0" />}
              </div>
              <Button
                size="sm"
                className="w-full h-8 rounded-lg text-xs font-semibold"
                disabled={isLoading || isRunningAll}
                onClick={(e) => {
                  e.stopPropagation();
                  // Prevent double-trigger because the parent card is clickable.
                  if (resultItem?.status === "success") { setSelectedResult(tool.id); }
                  else { runSingleAction(tool.id); }
                }}
              >
                {isActive ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                {resultItem?.status === "loading" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                {resultItem?.status === "success" ? <><Eye className="w-3 h-3 mr-1" /> View Result</> : isActive ? "Generating..." : "Run"}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Progress during Run All */}
      {isRunningAll && (
        <div className="glass rounded-xl p-5 border border-primary/20 space-y-3 shadow-[0_0_30px_hsl(265_85%_58%_/_0.06)]">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Running {allResults.length} enhancements in parallel...
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {allResults.map((r) => {
              const opt = enhancementOptions.find(o => o.id === r.action);
              const Icon = opt?.icon || Sparkles;
              return (
                <div key={r.action} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 text-xs">
                  {r.status === "loading" && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                  {r.status === "success" && <Check className="w-3 h-3 text-accent shrink-0" />}
                  {r.status === "error" && <X className="w-3 h-3 text-destructive shrink-0" />}
                  <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate text-foreground">{r.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Panel */}
      {successResults.length > 0 && !isRunningAll && (
        <div className="glass rounded-xl border border-border/20 overflow-hidden">
          {/* Results Header */}
          <div className="p-4 border-b border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Enhancement Results</h3>
              <Badge variant="outline" className="text-xs">{acceptedCount}/{successResults.length} accepted</Badge>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="min-w-[170px]">
                <Select value={saveFormat} onValueChange={(v: SaveFormat) => setSaveFormat(v)}>
                  <SelectTrigger className="h-8 text-xs rounded-lg">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="script">Store As Script</SelectItem>
                    <SelectItem value="story">Store As Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={handleAcceptAll} disabled={acceptedCount === successResults.length}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Accept All
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={handleMergeAll} disabled={acceptedCount === 0 || isSaving}>
                <Merge className="w-3 h-3 mr-1" /> Merge Accepted
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={() => {
                const content = allResults.filter(r => r.accepted && r.status === "success").map(r => r.content).join("\n\n");
                if (!content) { toast({ title: "Accept enhancements first", variant: "destructive" }); return; }
                exportAsPDF(content, "Enhanced_Script");
              }}>
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={() => {
                const content = allResults.filter(r => r.accepted && r.status === "success").map(r => r.content).join("\n\n");
                if (!content) { toast({ title: "Accept enhancements first", variant: "destructive" }); return; }
                exportAsFDX(content, "Enhanced_Script");
              }}>
                <FileText className="w-3 h-3 mr-1" /> FDX
              </Button>
            </div>
          </div>

          {/* Result Tabs */}
          <div className="flex border-b border-border/20 overflow-x-auto">
            {successResults.map((r) => {
              const opt = enhancementOptions.find(o => o.id === r.action);
              const Icon = opt?.icon || Sparkles;
              return (
                <button
                  key={r.action}
                  onClick={() => setSelectedResult(r.action)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${selectedResult === r.action
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
                    }`}
                >
                  <Icon className="w-3 h-3" />
                  {r.label}
                  {r.accepted && <CheckCircle2 className="w-3 h-3 text-accent" />}
                  {r.duration && <span className="text-muted-foreground/60">({(r.duration / 1000).toFixed(1)}s)</span>}
                </button>
              );
            })}
          </div>

          {/* Selected Result Content */}
          {currentResult && currentResult.status === "success" && (
            <div className="p-4 space-y-4">
              {/* Before/After Toggle */}
              <Tabs defaultValue="after" className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <TabsList className="h-8">
                    <TabsTrigger value="before" className="text-xs h-7 px-3">Before (Original)</TabsTrigger>
                    <TabsTrigger value="after" className="text-xs h-7 px-3">After (Enhanced)</TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(currentResult.content); toast({ title: "Copied!" }); }}>
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={isSaving} onClick={() => handleSaveResult(currentResult.content, currentResult.label, currentResult.action)}>
                      <Save className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => exportAsPDF(currentResult.content, currentResult.label)}>
                      <Download className="w-3 h-3 mr-1" /> PDF
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => exportAsFDX(currentResult.content, currentResult.label)}>
                      <FileText className="w-3 h-3 mr-1" /> FDX
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => exportAsText(currentResult.content, currentResult.label)}>
                      <Download className="w-3 h-3 mr-1" /> TXT
                    </Button>
                  </div>
                </div>
                <TabsContent value="before">
                  <Textarea
                    value={scriptText.slice(0, 3000) + (scriptText.length > 3000 ? "\n\n... (truncated for display)" : "")}
                    readOnly
                    className="min-h-[250px] bg-muted/10 border-border/20 font-mono text-xs rounded-xl opacity-70"
                  />
                </TabsContent>
                <TabsContent value="after">
                  <Textarea
                    value={currentResult.content}
                    readOnly
                    className="min-h-[250px] bg-muted/10 border-border/20 font-mono text-xs rounded-xl"
                  />
                </TabsContent>
              </Tabs>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/20">
                {!currentResult.accepted ? (
                  <>
                    <Button size="sm" className="rounded-lg font-semibold" onClick={() => handleAccept(currentResult.action)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Accept Enhancement
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => handleRegenerate(currentResult.action)}>
                      <RotateCw className="w-4 h-4 mr-1" /> Regenerate
                    </Button>
                    {lastSavedFormat && (
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={openSavedDestination}>
                        <Eye className="w-4 h-4 mr-1" />
                        {lastSavedFormat === "story" ? "Open My Stories" : "Open My Scripts"}
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-accent">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">Accepted</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading state for regeneration */}
          {currentResult && currentResult.status === "loading" && (
            <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Regenerating {currentResult.label}...</span>
            </div>
          )}
        </div>
      )}

      {/* Single action streaming result */}
      {singleResult && allResults.length === 0 && (
        <div className="glass rounded-xl p-6 border border-border/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> AI Output
              {generationTime && <span className="text-xs text-muted-foreground font-normal ml-2">{(generationTime / 1000).toFixed(1)}s</span>}
            </h3>
            <div className="flex gap-2">
              <div className="min-w-[170px]">
                <Select value={saveFormat} onValueChange={(v: SaveFormat) => setSaveFormat(v)}>
                  <SelectTrigger className="h-7 text-xs rounded-lg">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="script">Store As Script</SelectItem>
                    <SelectItem value="story">Store As Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(singleResult); toast({ title: "Copied!" }); }}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" disabled={isSaving} onClick={handleSaveSingleResult}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
              {lastSavedFormat && (
                <Button size="sm" variant="ghost" onClick={openSavedDestination}>
                  <Eye className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <Textarea value={singleResult} readOnly className="min-h-[300px] bg-muted/20 border-border/30 font-mono text-sm rounded-xl" />
        </div>
      )}

      {/* Single action progress */}
      {isLoading && (
        <div className="glass rounded-xl p-4 border border-border/20 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Timer className="w-3 h-3" />Generating...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
    </div>
  );
};

export default EnhanceStep;
