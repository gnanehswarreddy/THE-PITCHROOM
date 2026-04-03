import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import WriterLayout from "@/pages/writer/WriterLayout";
import ProducerLayout from "@/pages/producer/ProducerLayout";
import { parsePosterOutput } from "@/lib/ai/poster-output";
import { 
  Sparkles, 
  Wand2, 
  Palette,
  Music,
  Mic,
  Image,
  Loader2,
  Copy,
  RefreshCw,
  Lightbulb,
  Zap,
  Brain,
  Volume2
} from "lucide-react";

const AILabs = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const { toast } = useToast();

  // Idea Generator State
  const [ideaGenre, setIdeaGenre] = useState("Thriller");
  const [ideaElements, setIdeaElements] = useState("");
  const [generatedIdea, setGeneratedIdea] = useState("");
  const [generatingIdea, setGeneratingIdea] = useState(false);

  // Title Generator State
  const [titleLogline, setTitleLogline] = useState("");
  const [titleStyle, setTitleStyle] = useState("dramatic");
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [generatingTitles, setGeneratingTitles] = useState(false);

  // Poster Concept State
  const [posterTitle, setPosterTitle] = useState("");
  const [posterGenre, setPosterGenre] = useState("Action");
  const [posterMood, setPosterMood] = useState("Dramatic");
  const [posterConcept, setPosterConcept] = useState("");
  const [posterOutput, setPosterOutput] = useState("");
  const [posterImageUrl, setPosterImageUrl] = useState("");
  const [generatingPoster, setGeneratingPoster] = useState(false);

  // Audio Pitch State
  const [audioPitch, setAudioPitch] = useState("");
  const [audioVoice, setAudioVoice] = useState("dramatic");
  const [generatedAudioScript, setGeneratedAudioScript] = useState("");
  const [generatingAudio, setGeneratingAudio] = useState(false);

  const parsedPoster = parsePosterOutput(posterOutput);

  const extractAiPayload = (data: unknown) => {
    if (typeof data === "object" && data !== null && "data" in data) {
      return (data as { data?: unknown }).data ?? data;
    }
    return data;
  };

  const extractAiText = (data: unknown) => {
    const payload = extractAiPayload(data);
    if (typeof payload === "string") return payload;
    if (typeof payload === "object" && payload !== null) {
      const record = payload as { content?: string; result?: string };
      return record.content || record.result || "";
    }
    return "";
  };

  const extractAiErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      const message = error.message;
      if (/quota|rate limit|resource has been exhausted|retry in/i.test(message)) {
        return "AI service is temporarily busy. Please try again in a minute.";
      }
      return message;
    }
    return fallback;
  };

  useEffect(() => {
    const getUserRole = async () => {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) return;

      const { data: roleData } = await mongodbClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setUserRole(roleData?.role || "writer");
    };

    getUserRole();
  }, []);

  const generateIdea = async () => {
    setGeneratingIdea(true);
    setGeneratedIdea("Thinking up a sharper concept...");
    try {
      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action: "expand_story",
          content: `Generate a unique and compelling movie concept for a ${ideaGenre} film. ${ideaElements ? `Include these elements: ${ideaElements}` : ""} 
          
          Keep it concise and cinematic. Provide:
          1. A catchy title
          2. A compelling logline (one sentence)
          3. A brief synopsis (2 sentences)
          4. Main character description (2 sentences max)
          5. Unique selling point (1 sentence)`,
          context: "Be creative and original. Think like a Hollywood development executive."
        }
      });

      if (error) throw error;
      setGeneratedIdea(extractAiText(data));
      toast({ title: "Idea generated!", description: "Your movie concept is ready." });
    } catch (error) {
      console.error("Error generating idea:", error);
      toast({
        title: "Error",
        description: extractAiErrorMessage(error, "Failed to generate idea. Please try again."),
        variant: "destructive",
      });
    } finally {
      setGeneratingIdea(false);
    }
  };

  const generateTitles = async () => {
    if (!titleLogline.trim()) {
      toast({ title: "Error", description: "Please enter a logline first.", variant: "destructive" });
      return;
    }
    
    setGeneratingTitles(true);
    setGeneratedTitles(["Generating title options..."]);
    try {
      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action: "generate_titles",
          content: `Generate 10 creative movie titles for this concept: "${titleLogline}"
          
          Style: ${titleStyle}
          
          Return ONLY the titles, one per line, numbered 1-10. Make them catchy, memorable, and marketable.`,
          context: "Think like a marketing executive creating titles that would work on a movie poster."
        }
      });

      if (error) throw error;
      
      const content = extractAiText(data);
      const titles = content
        .split("\n")
        .map((title) => title.replace(/^\s*\d+[\).\-\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 10);
      setGeneratedTitles(titles);
      toast({ title: "Titles generated!", description: "10 title options are ready." });
    } catch (error) {
      console.error("Error generating titles:", error);
      toast({
        title: "Error",
        description: extractAiErrorMessage(error, "Failed to generate titles."),
        variant: "destructive",
      });
    } finally {
      setGeneratingTitles(false);
    }
  };

  const generatePosterConcept = async () => {
    if (!posterTitle.trim()) {
      toast({ title: "Error", description: "Please enter a title first.", variant: "destructive" });
      return;
    }
    
    setGeneratingPoster(true);
    setPosterOutput("Building a cinematic concept and image prompt...");
    setPosterImageUrl("");
    try {
      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action: "poster_concept",
          content: `A cinematic movie poster for a film titled "${posterTitle}".

Genre: ${posterGenre}
Mood: ${posterMood}

Scene Description:
${posterConcept || "Create a powerful poster composition with a strong central subject, dramatic atmosphere, and theatrical emotional impact."}

Create a visually stunning, high-quality poster with the following:

- A strong central subject (main character or symbolic visual) based on the description
- Cinematic composition with depth and dramatic framing
- Ultra-realistic or stylized film poster quality
- Professional lighting (dramatic shadows, rim light, glow, or natural cinematic lighting)
- Rich, immersive background matching the genre (city, village, fantasy world, war zone, etc.)
- Emotional expression and storytelling through visuals

Style:
- High-budget Hollywood/Bollywood poster style
- 4K detail, sharp focus, highly detailed textures
- Atmospheric effects like fog, rain, smoke, particles if suitable

Color Grading:
- Match the mood (dramatic contrast, warm tones, dark tones, neon, etc.)

Typography:
- Include the movie title "${posterTitle}" in bold cinematic font
- Place title naturally (top, center, or bottom)
- Clean and readable text

Camera:
- Cinematic framing (portrait orientation)
- Slight depth of field

Negative constraints:
- No blur
- No distorted faces
- No extra limbs
- No artifacts
- No watermark
- No messy or unreadable text

Final Output:
- Poster Concept: describe the final poster visually
- Image Prompt: provide a single high-quality cinematic image-generation prompt for a vertical poster, high resolution, poster style, 1024x1792.`,
          context: "Return only two sections titled 'Poster Concept:' and 'Image Prompt:'. The image prompt must be highly detailed, cinematic, vertical, and ready for AI image generation."
        }
      });

      if (error) throw error;
      const payload = extractAiPayload(data);
      const content = extractAiText(payload);
      const imageUrl =
        typeof payload === "string"
          ? ""
          : String(
              (payload as {
                imageUrl?: string;
                image_url?: string;
                result?: { imageUrl?: string; image_url?: string };
              })?.imageUrl ||
              (payload as {
                imageUrl?: string;
                image_url?: string;
                result?: { imageUrl?: string; image_url?: string };
              })?.image_url ||
              (payload as {
                imageUrl?: string;
                image_url?: string;
                result?: { imageUrl?: string; image_url?: string };
              })?.result?.imageUrl ||
              (payload as {
                imageUrl?: string;
                image_url?: string;
                result?: { imageUrl?: string; image_url?: string };
              })?.result?.image_url ||
              "",
            );

      setPosterOutput(content);
      setPosterImageUrl(imageUrl);

      toast({
        title: "Poster concept created!",
        description: imageUrl
          ? "Your poster concept, image prompt, and generated poster are ready."
          : "Poster concept is ready, but no image came back yet. If you just enabled image generation, restart the backend once.",
      });
    } catch (error) {
      console.error("Error generating poster:", error);
      toast({
        title: "Error",
        description: extractAiErrorMessage(error, "Failed to generate poster concept."),
        variant: "destructive",
      });
    } finally {
      setGeneratingPoster(false);
    }
  };

  const generateAudioScript = async () => {
    if (!audioPitch.trim()) {
      toast({ title: "Error", description: "Please enter your pitch first.", variant: "destructive" });
      return;
    }
    
    setGeneratingAudio(true);
    setGeneratedAudioScript("Writing a tighter trailer voiceover...");
    try {
      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action: "audio_pitch",
          content: `Create a ${audioVoice} movie trailer voiceover script for:
          
          "${audioPitch}"
          
          Create a compelling 30-60 second voiceover script that:
          1. Opens with a hook
          2. Builds tension/interest
          3. Introduces the main conflict
          4. Ends with a powerful tagline
          
          Include [PAUSE], [MUSIC CUE], and [SFX] directions where appropriate.`,
          context: "Write like Don LaFontaine or other legendary movie trailer voice artists."
        }
      });

      if (error) throw error;
      setGeneratedAudioScript(extractAiText(data));
      toast({ title: "Audio script created!", description: "Your voiceover script is ready." });
    } catch (error) {
      console.error("Error generating audio script:", error);
      toast({
        title: "Error",
        description: extractAiErrorMessage(error, "Failed to generate audio script."),
        variant: "destructive",
      });
    } finally {
      setGeneratingAudio(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Content copied to clipboard." });
  };

  const tools = [
    { id: "ideas", name: "Idea Generator", icon: Lightbulb, desc: "Generate unique movie concepts" },
    { id: "titles", name: "Title Generator", icon: Wand2, desc: "Create catchy movie titles" },
    { id: "poster", name: "Poster Concept", icon: Image, desc: "Design poster concepts" },
    { id: "audio", name: "Trailer Voice", icon: Mic, desc: "Generate voiceover scripts" },
  ];

  const content = (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2 flex items-center gap-2">
            <Sparkles className="w-8 h-8" />
            AI Labs
          </h1>
          <p className="text-muted-foreground">Experimental AI tools to supercharge your creativity</p>
        </div>

        {/* Tools Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {tools.map((tool) => (
            <Card key={tool.id} className="glass glass-hover p-4 cursor-pointer group">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-primary/20 rounded-xl mb-3 group-hover:bg-primary/30 transition-colors">
                  <tool.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{tool.name}</h3>
                <p className="text-xs text-muted-foreground">{tool.desc}</p>
              </div>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="ideas" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ideas">
              <Lightbulb className="w-4 h-4 mr-2" />
              Ideas
            </TabsTrigger>
            <TabsTrigger value="titles">
              <Wand2 className="w-4 h-4 mr-2" />
              Titles
            </TabsTrigger>
            <TabsTrigger value="poster">
              <Image className="w-4 h-4 mr-2" />
              Poster
            </TabsTrigger>
            <TabsTrigger value="audio">
              <Mic className="w-4 h-4 mr-2" />
              Audio
            </TabsTrigger>
          </TabsList>

          {/* Idea Generator */}
          <TabsContent value="ideas">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="glass p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Movie Idea Generator
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Genre</label>
                    <Select value={ideaGenre} onValueChange={setIdeaGenre}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Action", "Comedy", "Drama", "Horror", "Thriller", "Sci-Fi", "Romance", "Fantasy", "Mystery", "Adventure"].map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Include Elements (optional)</label>
                    <Input
                      value={ideaElements}
                      onChange={(e) => setIdeaElements(e.target.value)}
                      placeholder="e.g., time travel, hidden society, redemption arc..."
                    />
                  </div>
                  <Button onClick={generateIdea} disabled={generatingIdea} className="w-full">
                    {generatingIdea ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Generate Idea
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              <Card className="glass p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    Generated Concept
                  </h3>
                  {generatedIdea && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedIdea)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={generateIdea}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="min-h-[300px] bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                  {generatedIdea || <span className="text-muted-foreground">Your generated idea will appear here...</span>}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Title Generator */}
          <TabsContent value="titles">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="glass p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-primary" />
                  Title Generator
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Your Logline / Concept</label>
                    <Textarea
                      value={titleLogline}
                      onChange={(e) => setTitleLogline(e.target.value)}
                      placeholder="Describe your movie concept..."
                      className="min-h-[100px]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Title Style</label>
                    <Select value={titleStyle} onValueChange={setTitleStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dramatic">Dramatic</SelectItem>
                        <SelectItem value="mysterious">Mysterious</SelectItem>
                        <SelectItem value="action">Action-Packed</SelectItem>
                        <SelectItem value="poetic">Poetic</SelectItem>
                        <SelectItem value="minimalist">Minimalist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={generateTitles} disabled={generatingTitles} className="w-full">
                    {generatingTitles ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate 10 Titles
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              <Card className="glass p-6">
                <h3 className="text-xl font-semibold mb-4">Generated Titles</h3>
                <div className="space-y-2">
                  {generatedTitles.length > 0 ? (
                    generatedTitles.map((title, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                        <span>{title}</span>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(title)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      Your generated titles will appear here...
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Poster Concept */}
          <TabsContent value="poster">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="glass p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Image className="w-5 h-5 text-primary" />
                  Poster Concept Generator
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Movie Title</label>
                    <Input
                      value={posterTitle}
                      onChange={(e) => setPosterTitle(e.target.value)}
                      placeholder="Enter movie title..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Genre</label>
                    <Select value={posterGenre} onValueChange={setPosterGenre}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Action", "Comedy", "Drama", "Horror", "Thriller", "Sci-Fi", "Romance", "Fantasy"].map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Mood</label>
                    <Input
                      value={posterMood}
                      onChange={(e) => setPosterMood(e.target.value)}
                      placeholder="e.g. dark, romantic, haunting, explosive..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Scene Description</label>
                    <Textarea
                      value={posterConcept}
                      onChange={(e) => setPosterConcept(e.target.value)}
                      placeholder="Describe the main character, symbolic visual, setting, and emotional moment for the poster..."
                      className="min-h-[120px]"
                    />
                  </div>
                  <Button onClick={generatePosterConcept} disabled={generatingPoster} className="w-full">
                    {generatingPoster ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        Generate Poster Concept
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              <Card className="glass p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Poster Output</h3>
                  {posterOutput && (
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(posterOutput)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {posterOutput ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-muted/30 p-4">
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Poster Concept</h4>
                      <div className="whitespace-pre-wrap text-sm">
                        {parsedPoster.posterConcept || "No poster concept returned."}
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/30 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Image Prompt</h4>
                        {parsedPoster.imagePrompt && (
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(parsedPoster.imagePrompt)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-sm">
                        {parsedPoster.imagePrompt || "No image prompt returned."}
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/30 p-4">
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Generated Image</h4>
                      {posterImageUrl || parsedPoster.imageUrl ? (
                        <img
                          src={posterImageUrl || parsedPoster.imageUrl}
                          alt={`${posterTitle || "Poster"} generated preview`}
                          className="w-full rounded-lg border border-border/40 object-cover"
                        />
                      ) : (
                        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border/40 text-center text-sm text-muted-foreground">
                          Generated image preview will appear here when the backend returns an image URL.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[300px] bg-muted/30 rounded-lg p-4 whitespace-pre-wrap">
                    <span className="text-muted-foreground">Your poster concept, image prompt, and generated image area will appear here...</span>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Audio Pitch */}
          <TabsContent value="audio">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="glass p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-primary" />
                  Trailer Voiceover Generator
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Your Pitch / Logline</label>
                    <Textarea
                      value={audioPitch}
                      onChange={(e) => setAudioPitch(e.target.value)}
                      placeholder="Describe your movie..."
                      className="min-h-[100px]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Voice Style</label>
                    <Select value={audioVoice} onValueChange={setAudioVoice}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dramatic">Dramatic (Don LaFontaine style)</SelectItem>
                        <SelectItem value="mysterious">Mysterious & Haunting</SelectItem>
                        <SelectItem value="exciting">High Energy & Exciting</SelectItem>
                        <SelectItem value="emotional">Emotional & Moving</SelectItem>
                        <SelectItem value="dark">Dark & Intense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={generateAudioScript} disabled={generatingAudio} className="w-full">
                    {generatingAudio ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 mr-2" />
                        Generate Voiceover Script
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              <Card className="glass p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <Music className="w-5 h-5 text-primary" />
                    Voiceover Script
                  </h3>
                  {generatedAudioScript && (
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedAudioScript)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="min-h-[300px] bg-muted/30 rounded-lg p-4 whitespace-pre-wrap font-mono text-sm">
                  {generatedAudioScript || <span className="text-muted-foreground">Your voiceover script will appear here...</span>}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Tips */}
        <Card className="glass p-6 mt-8">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Pro Tips
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">1</Badge>
              <p>Be specific with your inputs for better results. Include tone, themes, and unique elements.</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">2</Badge>
              <p>Regenerate multiple times and combine the best elements from different outputs.</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">3</Badge>
              <p>Use generated content as a starting point, then refine with your creative vision.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  if (userRole === "writer") {
    return <WriterLayout>{content}</WriterLayout>;
  }

  return <ProducerLayout>{content}</ProducerLayout>;
};

export default AILabs;
