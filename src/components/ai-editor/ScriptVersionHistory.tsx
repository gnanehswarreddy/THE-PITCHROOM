import { useState, useEffect } from "react";
import { mongodbClient } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { History, GitCompare, RotateCcw, Eye, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";

interface Version {
  id: string;
  version_number: number;
  title: string;
  content: string;
  logline: string | null;
  change_summary: string | null;
  created_at: string;
}

interface ScriptVersionHistoryProps {
  scriptId?: string;
  currentContent: string;
  onRevert: (content: string) => void;
}

const ScriptVersionHistory = ({ scriptId, currentContent, onRevert }: ScriptVersionHistoryProps) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [compareVersion, setCompareVersion] = useState<Version | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (scriptId) {
      fetchVersions();
    }
  }, [scriptId]);

  const fetchVersions = async () => {
    if (!scriptId) return;
    setLoading(true);
    try {
      const { data, error } = await mongodbClient
        .from("script_versions")
        .select("*")
        .eq("script_id", scriptId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error("Error fetching versions:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveVersion = async (changeSummary?: string) => {
    try {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) {
        toast({ title: "Please log in", variant: "destructive" });
        return;
      }

      const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;

      const { error } = await mongodbClient.from("script_versions").insert({
        script_id: scriptId,
        user_id: user.id,
        version_number: nextVersion,
        title: `Version ${nextVersion}`,
        content: currentContent,
        change_summary: changeSummary || "Manual save",
      });

      if (error) throw error;

      toast({ title: "Version Saved", description: `Version ${nextVersion} saved successfully` });
      fetchVersions();
    } catch (error) {
      console.error("Error saving version:", error);
      toast({ title: "Error", description: "Failed to save version", variant: "destructive" });
    }
  };

  const handleRevert = (version: Version) => {
    onRevert(version.content);
    toast({
      title: "Reverted",
      description: `Reverted to version ${version.version_number}`,
    });
  };

  const getChangedLines = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const changes: { type: 'added' | 'removed' | 'same'; line: string }[] = [];
    
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= oldLines.length) {
        changes.push({ type: 'added', line: newLines[i] });
      } else if (i >= newLines.length) {
        changes.push({ type: 'removed', line: oldLines[i] });
      } else if (oldLines[i] !== newLines[i]) {
        changes.push({ type: 'removed', line: oldLines[i] });
        changes.push({ type: 'added', line: newLines[i] });
      } else {
        changes.push({ type: 'same', line: oldLines[i] });
      }
    }
    return changes;
  };

  return (
    <Card className="glass p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Version History
        </h3>
        <Button size="sm" onClick={() => saveVersion()} disabled={!currentContent}>
          Save Version
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : versions.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          No versions saved yet. Save your first version to start tracking changes.
        </p>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className="p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={index === 0 ? "default" : "secondary"}>
                      v{version.version_number}
                    </Badge>
                    <span className="text-sm font-medium">{version.title}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setSelectedVersion(version)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh]">
                        <DialogHeader>
                          <DialogTitle>Version {version.version_number}</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh]">
                          <pre className="text-sm whitespace-pre-wrap font-mono p-4 bg-muted rounded-lg">
                            {version.content}
                          </pre>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setCompareVersion(version);
                        setShowCompare(true);
                      }}
                    >
                      <GitCompare className="w-4 h-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleRevert(version)}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {format(new Date(version.created_at), "MMM d, yyyy h:mm a")}
                </div>
                {version.change_summary && (
                  <p className="text-xs text-muted-foreground mt-1">{version.change_summary}</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Compare with Current</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-1 font-mono text-sm">
              {compareVersion && getChangedLines(compareVersion.content, currentContent).map((change, i) => (
                <div
                  key={i}
                  className={`px-2 py-0.5 ${
                    change.type === 'added'
                      ? 'bg-green-500/20 text-green-400'
                      : change.type === 'removed'
                      ? 'bg-red-500/20 text-red-400'
                      : ''
                  }`}
                >
                  <span className="mr-2 opacity-50">
                    {change.type === 'added' ? '+' : change.type === 'removed' ? '-' : ' '}
                  </span>
                  {change.line || ' '}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ScriptVersionHistory;
