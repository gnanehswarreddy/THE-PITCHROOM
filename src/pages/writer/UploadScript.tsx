import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EyeOff, FileText, Globe2, Loader2 } from "lucide-react";
import WriterLayout from "./WriterLayout";
import { mongodbClient } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LOG_LINE_LIMIT = 200;

const UploadScript = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    const { data, error } = await mongodbClient.scripts.create({
      title,
      logline,
      scriptContent,
      visibility,
    });

    if (error || !data) {
      toast({
        title: "Upload failed",
        description: error?.message || "We could not save your script.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    toast({
      title: "Script saved",
      description: visibility === "public"
        ? "Your public listing is live and the full script remains protected."
        : "Your script is private and visible only to you.",
    });

    navigate(`/writer/scripts/${data.id}`);
  };

  return (
    <WriterLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_rgba(222,184,135,0.16),_transparent_32%),linear-gradient(180deg,_rgba(8,10,15,0.98),_rgba(22,17,12,0.98))] px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 max-w-2xl">
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-amber-200/70">Script Visibility System</p>
            <h1 className="font-['Oswald'] text-5xl uppercase tracking-wide text-amber-50">Protect the pages. Sell the premise.</h1>
            <p className="mt-4 text-sm leading-6 text-stone-300">
              Publish your title and logline for discovery while keeping the full script protected behind owner-only access.
            </p>
          </div>

          <Card className="border-amber-200/10 bg-stone-950/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="The script title audiences will remember"
                      className="border-stone-800 bg-stone-900 text-stone-100"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="logline">Logline</Label>
                      <span className="text-xs text-stone-400">{logline.length}/{LOG_LINE_LIMIT}</span>
                    </div>
                    <Textarea
                      id="logline"
                      value={logline}
                      onChange={(event) => setLogline(event.target.value.slice(0, LOG_LINE_LIMIT))}
                      placeholder="One sharp sentence that makes producers want more."
                      className="min-h-[110px] border-stone-800 bg-stone-900 text-stone-100"
                      required
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200/10 bg-gradient-to-b from-stone-900 to-stone-950 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Visibility</p>
                  <p className="mt-3 text-sm text-stone-300">
                    Public shares only the teaser. Private keeps the entire project invisible to everyone else.
                  </p>

                  <div className="mt-5 grid gap-3">
                    <button
                      type="button"
                      onClick={() => setVisibility("private")}
                      className={cn(
                        "rounded-xl border p-4 text-left transition",
                        visibility === "private"
                          ? "border-amber-300/50 bg-amber-200/10 text-amber-50"
                          : "border-stone-800 bg-stone-900/70 text-stone-300",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <EyeOff className="h-5 w-5" />
                        <div>
                          <div className="font-medium">Private</div>
                          <div className="text-xs text-stone-400">Only you can read the full script.</div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisibility("public")}
                      className={cn(
                        "rounded-xl border p-4 text-left transition",
                        visibility === "public"
                          ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-50"
                          : "border-stone-800 bg-stone-900/70 text-stone-300",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Globe2 className="h-5 w-5" />
                        <div>
                          <div className="font-medium">Public</div>
                          <div className="text-xs text-stone-400">Only title, logline, author, and date are visible.</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scriptContent">Script Editor</Label>
                <Textarea
                  id="scriptContent"
                  value={scriptContent}
                  onChange={(event) => setScriptContent(event.target.value)}
                  placeholder="Paste the complete script here. This full text is only returned to the owner."
                  className="min-h-[420px] border-stone-800 bg-stone-950 font-mono text-sm leading-6 text-stone-100"
                  required
                />
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-stone-800 bg-stone-950/60 p-4 text-sm text-stone-300 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-amber-200" />
                  <span>
                    Public mode never exposes `scriptContent` in feed, search, or public detail responses.
                  </span>
                </div>
                <Button
                  type="submit"
                  disabled={submitting || !title.trim() || !logline.trim() || !scriptContent.trim()}
                  className="bg-amber-200 text-stone-950 hover:bg-amber-100"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Script
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </WriterLayout>
  );
};

export default UploadScript;
