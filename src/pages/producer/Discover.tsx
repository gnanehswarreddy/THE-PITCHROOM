import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Eye, Search } from "lucide-react";
import ProducerLayout from "./ProducerLayout";
import { mongodbClient, type ScriptRecord } from "@/lib/mongodb/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Discover = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);

  useEffect(() => {
    const loadScripts = async () => {
      setLoading(true);
      const { data, error } = await mongodbClient.scripts.listPublic();

      if (error) {
        toast({ title: "Could not load public scripts", description: error.message, variant: "destructive" });
      } else {
        setScripts(data || []);
      }

      setLoading(false);
    };

    void loadScripts();
  }, [toast]);

  const filteredScripts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return scripts;

    return scripts.filter((script) =>
      script.title.toLowerCase().includes(term) ||
      script.logline.toLowerCase().includes(term) ||
      script.author?.name.toLowerCase().includes(term),
    );
  }, [scripts, search]);

  return (
    <ProducerLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.15),_transparent_22%),linear-gradient(180deg,_rgba(8,12,18,1),_rgba(10,18,28,1))] px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs uppercase tracking-[0.35em] text-sky-200/70">Public Feed</p>
              <h1 className="font-['Oswald'] text-5xl uppercase tracking-wide text-sky-50">Discover market-ready loglines</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Browse public teasers from writers on PitchRoom. Full scripts stay protected until access is granted.
              </p>
            </div>

            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, author, or logline"
                className="border-slate-800 bg-slate-950 pl-10 text-slate-100"
              />
            </div>
          </div>

          {loading ? (
            <Card className="border-slate-800 bg-slate-950/80 p-10 text-center text-slate-300">Loading public scripts...</Card>
          ) : filteredScripts.length === 0 ? (
            <Card className="border-slate-800 bg-slate-950/80 p-10 text-center text-slate-300">
              No public scripts match your search.
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredScripts.map((script) => (
                <Card key={script.id} className="flex flex-col border-slate-800 bg-slate-950/85 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Public Preview</p>
                  <h2 className="mt-4 font-['Oswald'] text-3xl uppercase leading-none text-sky-50">{script.title}</h2>
                  <p className="mt-4 text-sm text-slate-300">by {script.author?.name || "Anonymous"}</p>

                  <p className="mt-5 flex-1 text-sm leading-6 text-slate-300">{script.logline}</p>

                  <div className="mt-6 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {new Date(script.created_at || script.createdAt || "").toLocaleDateString()}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Metadata only
                    </span>
                  </div>

                  <Button
                    className="mt-6 bg-sky-200 text-slate-950 hover:bg-sky-100"
                    onClick={() => navigate(`/producer/script/${script.id}`)}
                  >
                    View Details
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProducerLayout>
  );
};

export default Discover;
