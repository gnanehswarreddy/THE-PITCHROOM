import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EyeOff, Globe2, Plus, Trash2 } from "lucide-react";
import WriterLayout from "./WriterLayout";
import { mongodbClient, type ScriptRecord } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const WriterScripts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadScripts = async () => {
    setLoading(true);
    const { data, error } = await mongodbClient.scripts.listMine();

    if (error) {
      toast({
        title: "Could not load scripts",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setScripts(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadScripts();
  }, []);

  const handleDelete = async (id: string) => {
    setBusyId(id);
    const { error } = await mongodbClient.scripts.delete(id);

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setScripts((current) => current.filter((script) => script.id !== id));
      toast({ title: "Script removed" });
    }

    setBusyId(null);
  };

  const toggleVisibility = async (script: ScriptRecord) => {
    const nextVisibility = script.visibility === "public" ? "private" : "public";
    setBusyId(script.id);

    const { data, error } = await mongodbClient.scripts.updateVisibility(script.id, nextVisibility);
    if (error || !data) {
      toast({
        title: "Visibility update failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } else {
      setScripts((current) => current.map((item) => (item.id === script.id ? data : item)));
      toast({
        title: nextVisibility === "public" ? "Script is now public" : "Script is now private",
        description: nextVisibility === "public"
          ? "Only the teaser fields are visible to other users."
          : "Only you can access the full script now.",
      });
    }

    setBusyId(null);
  };

  return (
    <WriterLayout forceDark hideThemeToggle>
      <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.15),_transparent_28%),linear-gradient(180deg,_rgba(12,10,9,1),_rgba(20,16,12,1))] px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.35em] text-amber-200/70">Writer Dashboard</p>
              <h1 className="font-['Oswald'] text-5xl uppercase tracking-wide text-amber-50">My Scripts</h1>
              <p className="mt-3 max-w-2xl text-sm text-stone-300">
                Manage visibility, protect full drafts, and decide which projects tease the market.
              </p>
            </div>
            <Button
              onClick={() => navigate("/writer/scripts/new")}
              className="bg-amber-200 text-stone-950 hover:bg-amber-100"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Script
            </Button>
          </div>

          {loading ? (
            <Card className="border-stone-800 bg-stone-950/80 p-10 text-center text-stone-300">Loading scripts...</Card>
          ) : scripts.length === 0 ? (
            <Card className="border-stone-800 bg-stone-950/80 p-12 text-center">
              <h2 className="font-['Oswald'] text-3xl uppercase text-amber-50">No scripts yet</h2>
              <p className="mt-3 text-sm text-stone-300">Create your first protected listing and start building interest safely.</p>
              <Button
                onClick={() => navigate("/writer/scripts/new")}
                className="mt-6 bg-amber-200 text-stone-950 hover:bg-amber-100"
              >
                Upload Script
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {scripts.map((script) => {
                const busy = busyId === script.id;
                const isPublic = script.visibility === "public";

                return (
                  <Card key={script.id} className="flex flex-col border-stone-800 bg-stone-950/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                          {new Date(script.created_at || script.createdAt || "").toLocaleDateString()}
                        </p>
                        <h2 className="mt-3 font-['Oswald'] text-3xl uppercase leading-none text-amber-50">{script.title}</h2>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-[0.25em]",
                          isPublic ? "bg-emerald-400/10 text-emerald-200" : "bg-stone-800 text-stone-300",
                        )}
                      >
                        {isPublic ? <Globe2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {script.visibility}
                      </span>
                    </div>

                    <p className="mt-5 line-clamp-4 text-sm leading-6 text-stone-300">{script.logline}</p>

                    <div className="mt-6 rounded-xl border border-stone-800 bg-stone-900/80 p-4 text-xs text-stone-400">
                      {isPublic
                        ? "Public listing: title, logline, author, and date are visible. Full pages stay protected."
                        : "Private draft: full script is accessible only from your dashboard."}
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2">
                      <Button variant="outline" className="border-stone-700 bg-stone-900 text-stone-100" onClick={() => navigate(`/writer/scripts/${script.id}`)}>
                        View
                      </Button>
                      <Button
                        variant="outline"
                        className="border-stone-700 bg-stone-900 text-stone-100"
                        disabled={busy}
                        onClick={() => toggleVisibility(script)}
                      >
                        {isPublic ? "Make Private" : "Make Public"}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        disabled={busy}
                        onClick={() => handleDelete(script.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </WriterLayout>
  );
};

export default WriterScripts;
