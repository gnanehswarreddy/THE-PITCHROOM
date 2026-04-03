import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Clapperboard, FileText, Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { mongodbClient } from "@/lib/mongodb/client";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import {
  buildStoryToScriptContext,
  buildStoryToScriptPrompt,
  extractScreenplayJson,
  screenplayJsonToText,
  type ScreenplayJson,
} from "@/lib/ai/pitchroom-engine";

type StoryRecord = {
  id: string;
  title: string;
  logline?: string;
  notes?: string;
  genre?: string;
  convertedScriptId?: string;
};

const buildStorySource = (story: StoryRecord) =>
  [
    `Title: ${story.title}`,
    story.genre ? `Genre: ${story.genre}` : "",
    story.logline ? `Logline: ${story.logline}` : "",
    "",
    "Story Content:",
    story.notes || story.logline || "",
  ]
    .filter(Boolean)
    .join("\n");

const deriveScriptLogline = (text: string, fallbackTitle: string) => {
  const firstSentence = text.replace(/\s+/g, " ").split(/[.!?]/)[0]?.trim() || `${fallbackTitle} is a screenplay adaptation.`;
  return firstSentence.slice(0, 200);
};

const StoryToScriptPanel = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storyId = searchParams.get("storyId") || "";
  const { toast } = useToast();

  const [loadingStory, setLoadingStory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [story, setStory] = useState<StoryRecord | null>(null);
  const [scriptTitle, setScriptTitle] = useState("");
  const [storyContent, setStoryContent] = useState("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [generatedScreenplay, setGeneratedScreenplay] = useState<ScreenplayJson | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const hasGeneratedScript = generatedScript.trim().length > 0;

  const generationPrompt = useMemo(
    () =>
      buildStorySource({
        id: story?.id || storyId,
        title: scriptTitle || story?.title || "Untitled Story",
        genre: story?.genre || "",
        logline: story?.logline || "",
        notes: storyContent,
      }),
    [scriptTitle, story, storyContent, storyId],
  );

  useEffect(() => {
    const loadStory = async () => {
      if (!storyId) {
        setErrorMessage("Story not found. No storyId was provided.");
        setLoadingStory(false);
        return;
      }

      setLoadingStory(true);
      setErrorMessage("");

      const result = await mongodbClient.from("stories").select("*").eq("_id", storyId).maybeSingle();
      if (result.error || !result.data) {
        setErrorMessage(result.error?.message || "Story not found.");
        setLoadingStory(false);
        return;
      }

      const fetchedStory = result.data as StoryRecord;
      setStory(fetchedStory);
      setScriptTitle(fetchedStory.title || "Untitled Story");
      setStoryContent(fetchedStory.notes || fetchedStory.logline || "");
      setGeneratedScript("");
      setGeneratedScreenplay(null);
      setLoadingStory(false);
    };

    void loadStory();
  }, [storyId]);

  useEffect(() => {
    if (!story || story.convertedScriptId || !storyContent.trim()) return;

    const timer = window.setTimeout(() => {
      void handleGenerateScript();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [story]);

  const handleGenerateScript = async () => {
    if (!storyContent.trim()) {
      toast({
        title: "Story content required",
        description: "Add story content before generating a screenplay.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setErrorMessage("");

    try {
      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action: "format_screenplay",
          content: buildStoryToScriptPrompt(generationPrompt),
          context: buildStoryToScriptContext(),
          language: "English",
        },
      });

      if (error) {
        throw new Error(error.message || "AI generation failed");
      }

      const content = String(data?.result || data?.content || "").trim();
      if (!content) throw new Error("AI returned an empty screenplay draft.");

      const screenplayJson = extractScreenplayJson(content, scriptTitle || story?.title || "Generated Script");
      screenplayJson.story_id = story?.id || storyId;
      setGeneratedScreenplay(screenplayJson);
      setGeneratedScript(screenplayJsonToText(screenplayJson));
      setScriptTitle(screenplayJson.title || scriptTitle || story?.title || "Generated Script");
      toast({
        title: "Script generated",
        description: "The story has been converted into a structured screenplay draft.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI generation failed.";
      setErrorMessage(message);
      toast({
        title: "Generation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveScript = async () => {
    if (!story) {
      toast({ title: "Story missing", description: "We could not find the source story.", variant: "destructive" });
      return;
    }
    if (!generatedScript.trim()) {
      toast({ title: "No script to save", description: "Generate a screenplay first.", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const saveResult = await mongodbClient.scripts.create({
        title: generatedScreenplay?.title || scriptTitle || story.title || "Untitled Script",
        logline: deriveScriptLogline(generatedScript, scriptTitle || story.title || "Untitled Script"),
        scriptContent: generatedScript,
        genre: story.genre || "",
        visibility: "private",
        sourceStoryId: story.id,
      } as Parameters<typeof mongodbClient.scripts.create>[0]);

      if (saveResult.error || !saveResult.data) {
        throw new Error(saveResult.error?.message || "Could not save the script.");
      }

      const updateStory = await mongodbClient
        .from("stories")
        .update({
          convertedScriptId: saveResult.data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("_id", story.id);

      if (updateStory.error) {
        throw new Error(updateStory.error.message || "Script saved, but the story link could not be updated.");
      }

      await mongodbClient.from("script_versions").insert({
        user_id: saveResult.data.writer_id || saveResult.data.userId,
        script_id: saveResult.data.id,
        version_number: 1,
        title: generatedScreenplay?.title || scriptTitle || story.title || "Untitled Script",
        content: generatedScript,
        change_summary: "Initial draft created from story conversion",
      });

      await trackEvent({
        event_type: "SCRIPT_GENERATED",
        script_id: saveResult.data.id,
        story_id: story.id,
        metadata: {
          script_owner_id: saveResult.data.writer_id || saveResult.data.userId,
          story_owner_id: saveResult.data.writer_id || saveResult.data.userId,
          script_title: saveResult.data.title,
          story_title: story.title,
          genre: story.genre || null,
        },
      });

      setStory((current) => (current ? { ...current, convertedScriptId: saveResult.data!.id } : current));
      toast({
        title: "Script saved",
        description: "The screenplay is now available in My Scripts as a private draft.",
      });
      navigate(`/writer/scripts/${saveResult.data.id}`);
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save the script.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenScript = () => {
    if (story?.convertedScriptId) {
      navigate(`/writer/scripts/${story.convertedScriptId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Story to Script</h2>
          <p className="text-sm text-muted-foreground">
            Turn a saved story into a screenplay draft, edit it, and save it into My Scripts.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/writer/stories")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Stories
        </Button>
      </div>

      {loadingStory ? (
        <Card className="glass">
          <CardContent className="flex min-h-[240px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : errorMessage && !story ? (
        <Card className="glass border-destructive/40">
          <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-foreground">{errorMessage}</p>
            <Button variant="outline" onClick={() => navigate("/writer/stories")}>Return to Stories</Button>
          </CardContent>
        </Card>
      ) : story ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Source Story
              </CardTitle>
              <CardDescription>The story is auto-filled from your Stories page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Script Title</label>
                <Textarea
                  value={scriptTitle}
                  onChange={(event) => setScriptTitle(event.target.value)}
                  className="min-h-[72px] resize-none bg-muted/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Story Content</label>
                <Textarea
                  value={storyContent}
                  onChange={(event) => setStoryContent(event.target.value)}
                  className="min-h-[360px] bg-muted/20"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {story.convertedScriptId ? (
                  <Button onClick={handleOpenScript}>
                    <Clapperboard className="mr-2 h-4 w-4" />
                    View Script
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleGenerateScript} disabled={generating || saving}>
                      {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Generate Script
                    </Button>
                    <Button variant="outline" onClick={handleSaveScript} disabled={saving || generating || !hasGeneratedScript}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Script
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-primary" />
                Screenplay Draft
              </CardTitle>
              <CardDescription>
                Generated from structured screenplay scenes, then rendered into an editable draft for PitchRoom.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMessage ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : null}
              <Textarea
                value={generatedScript}
                onChange={(event) => setGeneratedScript(event.target.value)}
                placeholder="Your generated screenplay will appear here..."
                className="min-h-[620px] bg-background/70 font-mono text-sm leading-7"
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export default StoryToScriptPanel;
