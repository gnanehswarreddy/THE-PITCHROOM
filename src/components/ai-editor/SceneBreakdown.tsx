import { useState } from "react";
import { mongodbClient } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { 
  Film, Sparkles, MapPin, Users, Package, Shirt, Wand2, 
  Clock, Loader2, Download, Camera, Clapperboard 
} from "lucide-react";

interface SceneBreakdownData {
  scenes: Array<{
    sceneNumber: number;
    heading: string;
    description: string;
    pageLength: string;
    dayNight: string;
    interiorExterior: string;
    location: {
      name: string;
      requirements: string[];
      notes: string;
    };
    characters: string[];
    extras: { count: number; description: string };
    props: string[];
    wardrobe: Array<{ character: string; costume: string }>;
    makeup: string[];
    specialEffects: string[];
    stunts: string[];
    vehicles: string[];
    animals: string[];
    sound: string[];
    estimatedDuration: string;
    shootingNotes: string;
  }>;
  summary: {
    totalScenes: number;
    totalPages: string;
    estimatedShootDays: number;
    uniqueLocations: string[];
    mainCast: string[];
    keyProductionNotes: string[];
  };
}

interface SceneBreakdownProps {
  selectedLanguage?: string;
}

const SceneBreakdown = ({ selectedLanguage = "english" }: SceneBreakdownProps) => {
  const [scriptContent, setScriptContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<SceneBreakdownData | null>(null);
  const { toast } = useToast();

  const generateBreakdown = async () => {
    if (!scriptContent.trim()) {
      toast({
        title: "Script Required",
        description: "Please paste your script or scene content.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setBreakdown(null);

    try {
      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action: "scene_breakdown",
          sceneData: scriptContent.trim(),
          context: `Respond in ${selectedLanguage} language.`,
          language: selectedLanguage,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const resultText = data.result;
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setBreakdown(parsed);
        toast({ title: "Scene Breakdown Complete!" });
      } else {
        throw new Error("Could not parse breakdown data");
      }
    } catch (error) {
      console.error("Scene breakdown error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate breakdown",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportBreakdown = () => {
    if (!breakdown) return;
    const blob = new Blob([JSON.stringify(breakdown, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scene-breakdown.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported!", description: "Breakdown downloaded as JSON" });
  };

  return (
    <div className="space-y-6">
      <Card className="glass p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-primary" />
          Script Input
        </h3>

        <Textarea
          value={scriptContent}
          onChange={(e) => setScriptContent(e.target.value)}
          placeholder="Paste your screenplay or scene content here for production breakdown analysis..."
          className="min-h-[200px] bg-background/50 font-mono text-sm mb-4"
        />

        <Button onClick={generateBreakdown} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing Script...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Production Breakdown
            </>
          )}
        </Button>
      </Card>

      {breakdown && (
        <>
          <Card className="glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" />
                Production Summary
              </h3>
              <Button size="sm" variant="outline" onClick={exportBreakdown}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-3xl font-bold text-primary">{breakdown.summary.totalScenes}</p>
                <p className="text-sm text-muted-foreground">Scenes</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-3xl font-bold text-primary">{breakdown.summary.totalPages}</p>
                <p className="text-sm text-muted-foreground">Pages</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-3xl font-bold text-primary">{breakdown.summary.estimatedShootDays}</p>
                <p className="text-sm text-muted-foreground">Shoot Days</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50">
                <p className="text-3xl font-bold text-primary">{breakdown.summary.uniqueLocations?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Locations</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> Locations
                </p>
                <div className="flex flex-wrap gap-2">
                  {breakdown.summary.uniqueLocations?.map((loc, i) => (
                    <Badge key={i} variant="outline">{loc}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="w-4 h-4" /> Main Cast
                </p>
                <div className="flex flex-wrap gap-2">
                  {breakdown.summary.mainCast?.map((char, i) => (
                    <Badge key={i}>{char}</Badge>
                  ))}
                </div>
              </div>

              {breakdown.summary.keyProductionNotes?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Key Production Notes</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {breakdown.summary.keyProductionNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card className="glass p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Scene-by-Scene Breakdown
            </h3>

            <Accordion type="single" collapsible className="w-full">
              {breakdown.scenes?.map((scene, index) => (
                <AccordionItem key={index} value={`scene-${index}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge variant="secondary">#{scene.sceneNumber}</Badge>
                      <span className="font-mono text-sm">{scene.heading}</span>
                      <Badge variant="outline" className="ml-auto">
                        {scene.estimatedDuration}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      <p className="text-sm">{scene.description}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Location
                          </p>
                          <p className="text-sm font-medium">{scene.location?.name}</p>
                          {scene.location?.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{scene.location.notes}</p>
                          )}
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Characters
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {scene.characters?.map((char, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{char}</Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Package className="w-3 h-3" /> Props
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {scene.props?.map((prop, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{prop}</Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Shirt className="w-3 h-3" /> Wardrobe
                          </p>
                          <div className="space-y-1">
                            {scene.wardrobe?.map((w, i) => (
                              <p key={i} className="text-xs">
                                <span className="font-medium">{w.character}:</span> {w.costume}
                              </p>
                            ))}
                          </div>
                        </div>

                        {scene.specialEffects?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <Wand2 className="w-3 h-3" /> Special Effects
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {scene.specialEffects.map((fx, i) => (
                                <Badge key={i} variant="destructive" className="text-xs">{fx}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {scene.stunts?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Stunts</p>
                            <ul className="list-disc list-inside text-xs">
                              {scene.stunts.map((stunt, i) => (
                                <li key={i}>{stunt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {scene.shootingNotes && (
                        <div className="p-3 rounded bg-background/50 border-l-2 border-primary">
                          <p className="text-xs text-muted-foreground mb-1">Shooting Notes</p>
                          <p className="text-sm">{scene.shootingNotes}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </>
      )}
    </div>
  );
};

export default SceneBreakdown;
