import { useState } from "react";
import { mongodbClient } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { User, Sparkles, Brain, MessageCircle, Heart, Loader2, Copy, Save } from "lucide-react";

interface CharacterProfile {
  name: string;
  age: string;
  physicalDescription: string;
  personality: {
    traits: string[];
    mbtiType?: string;
    enneagram?: string;
  };
  backstory: string;
  motivation: string;
  fears: string[];
  flaws: string[];
  relationships: Array<{ name: string; relationship: string }>;
  dialoguePatterns: string[];
  sampleDialogue: string[];
  characterArc: string;
  mannerisms: string[];
}

interface CharacterDevelopmentProps {
  selectedLanguage?: string;
}

const CharacterDevelopment = ({ selectedLanguage = "english" }: CharacterDevelopmentProps) => {
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const { toast } = useToast();

  const generateProfile = async () => {
    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please describe your character briefly.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProfile(null);

    try {
      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action: "character_development",
          characterDescription: description.trim(),
          context: `${context.trim()}\n\nRespond in ${selectedLanguage} language.`.trim(),
          language: selectedLanguage,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Parse the JSON from the result
      const resultText = data.result;
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setProfile(parsed);
        toast({ title: "Character Profile Generated!" });
      } else {
        throw new Error("Could not parse character profile");
      }
    } catch (error) {
      console.error("Character development error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate character profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveCharacter = async () => {
    if (!profile) return;

    try {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) {
        toast({ title: "Please log in", variant: "destructive" });
        return;
      }

      const insertData = {
        user_id: user.id,
        name: profile.name,
        brief_description: description,
        full_profile: JSON.parse(JSON.stringify(profile)),
        backstory: profile.backstory,
        dialogue_patterns: profile.dialoguePatterns,
        personality_traits: profile.personality.traits,
        relationships: JSON.parse(JSON.stringify(profile.relationships)),
      };

      const { error } = await mongodbClient.from("character_profiles").insert(insertData);

      if (error) throw error;

      toast({ title: "Character Saved!", description: `${profile.name} has been saved to your library.` });
    } catch (error) {
      console.error("Save error:", error);
      toast({ title: "Error", description: "Failed to save character", variant: "destructive" });
    }
  };

  const copyToClipboard = () => {
    if (!profile) return;
    navigator.clipboard.writeText(JSON.stringify(profile, null, 2));
    toast({ title: "Copied!", description: "Character profile copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <Card className="glass p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Character Description
        </h3>

        <div className="space-y-4">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your character briefly... (e.g., 'A cynical detective in her 40s who lost her partner, now works alone and struggles with trust issues')"
            className="min-h-[120px] bg-background/50"
          />

          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Optional: Add story context, genre, setting, or specific traits you want..."
            className="min-h-[80px] bg-background/50"
          />

          <Button onClick={generateProfile} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Profile...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Character Profile
              </>
            )}
          </Button>
        </div>
      </Card>

      {profile && (
        <Card className="glass p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold gradient-text">{profile.name}</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button size="sm" onClick={saveCharacter}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="psychology">Psychology</TabsTrigger>
              <TabsTrigger value="dialogue">Dialogue</TabsTrigger>
              <TabsTrigger value="arc">Arc</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Age</p>
                  <p className="font-medium">{profile.age}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Physical Description</p>
                  <p>{profile.physicalDescription}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Backstory</p>
                  <p className="text-sm leading-relaxed">{profile.backstory}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Mannerisms</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.mannerisms?.map((m, i) => (
                      <Badge key={i} variant="outline">{m}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="psychology">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Brain className="w-4 h-4" /> Personality Traits
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.personality.traits.map((trait, i) => (
                      <Badge key={i}>{trait}</Badge>
                    ))}
                  </div>
                </div>
                {profile.personality.mbtiType && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">MBTI Type</p>
                    <Badge variant="secondary">{profile.personality.mbtiType}</Badge>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Heart className="w-4 h-4" /> Motivation
                  </p>
                  <p>{profile.motivation}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Fears</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {profile.fears.map((fear, i) => (
                        <li key={i}>{fear}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Flaws</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {profile.flaws.map((flaw, i) => (
                        <li key={i}>{flaw}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Key Relationships</p>
                  <div className="space-y-2">
                    {profile.relationships?.map((rel, i) => (
                      <div key={i} className="text-sm p-2 rounded bg-background/50">
                        <span className="font-medium">{rel.name}:</span> {rel.relationship}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dialogue">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" /> Speech Patterns
                  </p>
                  <ul className="space-y-2">
                    {profile.dialoguePatterns?.map((pattern, i) => (
                      <li key={i} className="text-sm p-2 rounded bg-background/50 border-l-2 border-primary">
                        {pattern}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Sample Dialogue</p>
                  <div className="space-y-2 font-mono text-sm">
                    {profile.sampleDialogue?.map((line, i) => (
                      <div key={i} className="p-3 rounded bg-muted italic">
                        "{line}"
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="arc">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Character Arc Potential</p>
                <div className="p-4 rounded-lg bg-background/50 border border-primary/20">
                  <p className="leading-relaxed">{profile.characterArc}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  );
};

export default CharacterDevelopment;
