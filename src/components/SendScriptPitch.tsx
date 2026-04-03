import { useEffect, useState, type ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";
import { mongodbClient, type ScriptRecord } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, Send, Sparkles } from "lucide-react";

interface SendScriptPitchProps {
  producerId: string;
  producerName: string;
  trigger: ReactNode;
}

const SendScriptPitch = ({ producerId, producerName, trigger }: SendScriptPitchProps) => {
  const [open, setOpen] = useState(false);
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [selectedScript, setSelectedScript] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      void loadScripts();
    }
  }, [open]);

  const loadScripts = async () => {
    const { data, error } = await mongodbClient.scripts.listMine();
    if (!error) {
      setScripts(data || []);
    }
  };

  const handleSend = async () => {
    if (!selectedScript) {
      toast({ title: "Select a script", variant: "destructive" });
      return;
    }

    setSending(true);

    try {
      const { data, error } = await mongodbClient.functions.invoke("send-script-pitch", {
        body: { scriptId: selectedScript, producerId },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to send pitch");
      }

      const selectedScriptRecord = scripts.find((item) => item.id === selectedScript);
      await trackEvent({
        event_type: "PITCH_SENT",
        script_id: selectedScript,
        story_id: selectedScriptRecord?.sourceStoryId || null,
        metadata: {
          producer_id: producerId,
          producer_name: producerName,
          script_owner_id: selectedScriptRecord?.writer_id || selectedScriptRecord?.userId || null,
          script_title: selectedScriptRecord?.title || null,
          genre: selectedScriptRecord?.genre || null,
        },
      });

      toast({
        title: "Pitch sent!",
        description: `AI-generated pitch for your script has been sent to ${producerName}.`,
      });
      setOpen(false);
      setSelectedScript("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send pitch",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Send Script Pitch to {producerName}
            </DialogTitle>
            <DialogDescription>
              Select a script and our AI will generate a compelling pitch summary and send it automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {scripts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                You have no scripts yet. Upload a script first.
              </p>
            ) : (
              <Select value={selectedScript} onValueChange={setSelectedScript}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a script to pitch..." />
                </SelectTrigger>
                <SelectContent>
                  {scripts.map((script) => (
                    <SelectItem key={script.id} value={script.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {script.title} {script.genre ? `(${script.genre})` : ""}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedScript ? (
              <div className="mt-4 rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  AI will analyze your script details and generate a professional pitch summary for {producerName}.
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !selectedScript}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating & Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send AI Pitch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SendScriptPitch;
