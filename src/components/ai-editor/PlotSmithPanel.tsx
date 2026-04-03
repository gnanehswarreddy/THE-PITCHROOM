import { useState } from "react";
import { BookOpenText, Clapperboard, Copy, Loader2, RefreshCw, ScrollText, Sparkles, Theater } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";

type PlotSmithCharacter = {
  name: string;
  role: string;
  description: string;
  goal: string;
};

type PlotSmithStory = {
  platform: string;
  feature: string;
  contentType: string;
  title: string;
  genre: string;
  tone: string;
  logline: string;
  characters: PlotSmithCharacter[];
  world: {
    setting: string;
    rules: string;
  };
  story: {
    act1: string;
    act2: string;
    act3: string;
  };
  themes: string[];
  twist: string;
  ending: string;
};

const starterPrompts = [
  "A retired stuntwoman discovers the action films she worked on were training simulations for real assassins.",
  "A love story between two people who keep meeting in different timelines but never remember each other.",
  "A village priest starts receiving confessions for crimes that have not happened yet.",
];

const buildStoryText = (story: PlotSmithStory) =>
  [
    story.title,
    "",
    `Genre: ${story.genre}`,
    `Tone: ${story.tone}`,
    "",
    `Logline: ${story.logline}`,
    "",
    "World",
    story.world.setting,
    story.world.rules,
    "",
    "Characters",
    ...story.characters.flatMap((character) => [
      `${character.name} - ${character.role}`,
      character.description,
      `Goal: ${character.goal}`,
      "",
    ]),
    "Act 1",
    story.story.act1,
    "",
    "Act 2",
    story.story.act2,
    "",
    "Act 3",
    story.story.act3,
    "",
    "Twist",
    story.twist,
    "",
    `Ending: ${story.ending}`,
    "",
    `Themes: ${story.themes.join(", ")}`,
  ].join("\n");

const PlotSmithPanel = () => {
  const [prompt, setPrompt] = useState(starterPrompts[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [story, setStory] = useState<PlotSmithStory | null>(null);
  const { toast } = useToast();

  const generateStory = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Add a story idea and PlotSmith will turn it into a cinematic narrative.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await mongodbClient.functions.invoke("plot-smith", {
        body: { prompt },
      });

      if (error) {
        throw error;
      }

      setStory(data.story);
      toast({
        title: "Story generated",
        description: "PlotSmith delivered a structured cinematic story.",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "PlotSmith could not generate a story right now.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access was blocked.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <Card className="glass p-6 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-[0.2em]">PlotSmith</span>
            </div>
            <h2 className="text-2xl font-semibold text-foreground">Story Engine</h2>
            <p className="text-sm text-muted-foreground">
              Drop in a phrase, premise, or rough idea and generate a fully structured story in strict JSON.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Story prompt</label>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A washed-up magician learns his tricks are actually fragments of a banned ancient science..."
              className="min-h-[220px] resize-none bg-muted/20"
            />
          </div>

          <div className="space-y-3">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Quick starts</span>
            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPrompt(item)}
                  className="rounded-full border border-border/60 bg-muted/20 px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={generateStory} disabled={isLoading} className="rounded-xl">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  <BookOpenText className="mr-2 h-4 w-4" />
                  Generate Story
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStory(null);
              }}
              disabled={isLoading || !story}
              className="rounded-xl"
            >
              Clear Output
            </Button>
          </div>
        </Card>

        <Card className="glass p-6">
          {story ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{story.genre}</Badge>
                    <Badge variant="outline">{story.tone}</Badge>
                    <Badge variant="outline">{story.contentType}</Badge>
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-foreground">{story.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{story.logline}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={generateStory} disabled={isLoading} aria-label="Regenerate story">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => copyText(buildStoryText(story), "Story")} aria-label="Copy story">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <BookOpenText className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-foreground">Story Draft</h4>
                </div>
                <Textarea
                  readOnly
                  value={buildStoryText(story)}
                  className="min-h-[280px] resize-none border-border/40 bg-background/70 text-sm leading-7"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Theater className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">World</h4>
                  </div>
                  <p className="text-sm text-foreground">{story.world.setting}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{story.world.rules}</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Themes & Ending</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {story.themes.map((theme) => (
                      <Badge key={theme} variant="secondary">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-foreground">{story.ending}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clapperboard className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-foreground">Characters</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {story.characters.map((character) => (
                    <div key={`${character.name}-${character.role}`} className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="font-semibold text-foreground">{character.name}</h5>
                        <Badge variant="outline">{character.role}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{character.description}</p>
                      <p className="mt-3 text-sm text-foreground">
                        <span className="font-medium">Goal:</span> {character.goal}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: "Act 1", content: story.story.act1 },
                  { label: "Act 2", content: story.story.act2 },
                  { label: "Act 3", content: story.story.act3 },
                ].map((act) => (
                  <div key={act.label} className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <ScrollText className="h-4 w-4 text-primary" />
                      <h4 className="font-medium text-foreground">{act.label}</h4>
                    </div>
                    <p className="text-sm leading-7 text-foreground">{act.content}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <h4 className="font-medium text-foreground">Twist</h4>
                <p className="mt-2 text-sm leading-6 text-foreground">{story.twist}</p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[640px] flex-col items-center justify-center text-center">
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8">
                <Sparkles className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 text-xl font-semibold text-foreground">Separate from the script workflow</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  PlotSmith lives inside AI Editor as its own story-generation space. Generate a new narrative here without affecting upload, analysis, or enhancement.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PlotSmithPanel;
