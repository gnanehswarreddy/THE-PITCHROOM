import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, EyeOff, Globe2, Loader2, Rocket, ShieldCheck, ShieldOff } from "lucide-react";
import WriterLayout from "./WriterLayout";
import { mongodbClient, type ScriptRecord } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type AccessRequest = {
  id: string;
  producer_id: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  created_at?: string;
  updated_at?: string;
  producer_name?: string;
};

const WriterScriptViewer = () => {
  const navigate = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [script, setScript] = useState<ScriptRecord | null>(null);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [busyProducerId, setBusyProducerId] = useState<string | null>(null);

  useEffect(() => {
    const loadScript = async () => {
      setLoading(true);
      const { data, error } = await mongodbClient.scripts.getById(id);

      if (error || !data?.scriptContent) {
        toast({
          title: "Script unavailable",
          description: error?.message || "This script could not be opened.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setScript(data);
      setLoading(false);
    };

    void loadScript();
  }, [id, toast]);

  useEffect(() => {
    const loadAccessRequests = async () => {
      if (!script) return;

      const grants = await mongodbClient
        .from("script_access_grants")
        .select("*")
        .eq("script_id", script.id)
        .order("updated_at", { ascending: false });

      if (grants.error || !Array.isArray(grants.data)) {
        return;
      }

      const producerIds = [...new Set(grants.data.map((item: any) => item.producer_id).filter(Boolean))];
      let profileMap = new Map<string, string>();

      if (producerIds.length) {
        const profiles = await mongodbClient
          .from("profiles")
          .select("id,name")
          .in("id", producerIds);

        if (!profiles.error && Array.isArray(profiles.data)) {
          profileMap = new Map(profiles.data.map((profile: any) => [profile.id, profile.name || "Producer"]));
        }
      }

      setAccessRequests(
        grants.data.map((item: any) => ({
          id: item.id || item._id,
          producer_id: item.producer_id,
          status: item.status,
          created_at: item.created_at,
          updated_at: item.updated_at,
          producer_name: profileMap.get(item.producer_id) || "Producer",
        })),
      );
    };

    void loadAccessRequests();
  }, [script]);

  const updateAccessStatus = async (producerId: string, status: AccessRequest["status"]) => {
    if (!script) return;
    setBusyProducerId(producerId);

    const now = new Date().toISOString();
    const existing = accessRequests.find((request) => request.producer_id === producerId);

    let result;
    if (existing) {
      result = await mongodbClient
        .from("script_access_grants")
        .update({ status, updated_at: now })
        .eq("id", existing.id);
    } else {
      result = await mongodbClient
        .from("script_access_grants")
        .insert({
          script_id: script.id,
          writer_id: script.writer_id || script.userId,
          producer_id: producerId,
          status,
          created_at: now,
          updated_at: now,
        });
    }

    if (result.error) {
      toast({
        title: "Access update failed",
        description: result.error.message,
        variant: "destructive",
      });
      setBusyProducerId(null);
      return;
    }

    setAccessRequests((current) => current.map((request) =>
      request.producer_id === producerId ? { ...request, status, updated_at: now } : request,
    ));

    toast({
      title: status === "approved" ? "Access granted" : "Access revoked",
      description: status === "approved"
        ? "The producer can now open the full script."
        : "The producer will no longer be able to open the full script.",
    });

    setBusyProducerId(null);
  };

  return (
    <WriterLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_30%),linear-gradient(180deg,_rgba(9,9,11,1),_rgba(23,18,12,1))] px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <Button variant="ghost" onClick={() => navigate("/writer/scripts")} className="mb-6 text-stone-200 hover:bg-stone-800/80">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Scripts
          </Button>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-amber-200" />
            </div>
          ) : !script ? (
            <Card className="border-stone-800 bg-stone-950/80 p-10 text-center text-stone-300">Script not found.</Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.6fr]">
              <div className="space-y-6">
                <Card className="border-stone-800 bg-stone-950/85 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Protected Record</p>
                      <h1 className="mt-4 font-['Oswald'] text-4xl uppercase leading-none text-amber-50">{script.title}</h1>
                      <p className="mt-5 text-sm leading-6 text-stone-300">{script.logline}</p>
                    </div>
                    <Button
                      onClick={() => navigate(`/ai-studio/${script.id}`)}
                      className="rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-blue-600 px-5 py-2 font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.35)] transition-transform duration-200 hover:scale-105 hover:from-fuchsia-500 hover:to-blue-500"
                    >
                      <Rocket className="mr-2 h-4 w-4" />
                      Open in AI Studio
                    </Button>
                  </div>

                  <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-stone-400">
                    {script.visibility === "public" ? <Globe2 className="h-4 w-4 text-emerald-200" /> : <EyeOff className="h-4 w-4 text-stone-300" />}
                    {script.visibility}
                  </div>

                  <div className="mt-6 rounded-2xl border border-stone-800 bg-stone-900/70 p-4 text-sm text-stone-300">
                    {script.visibility === "public"
                      ? "Public viewers can discover the title and logline. Approved producers can also open the full script."
                      : "This script is fully private and visible only inside your writer workspace until you grant access."}
                  </div>
                </Card>

                <Card className="border-stone-800 bg-stone-950/85 p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Access Requests</p>
                  <div className="mt-4 space-y-3">
                    {accessRequests.length === 0 ? (
                      <div className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4 text-sm text-stone-400">
                        No producers have requested access yet.
                      </div>
                    ) : (
                      accessRequests.map((request) => {
                        const busy = busyProducerId === request.producer_id;
                        const approved = request.status === "approved";

                        return (
                          <div key={request.id} className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium text-stone-100">{request.producer_name}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">{request.status}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-emerald-200 text-stone-950 hover:bg-emerald-100"
                                  disabled={busy || approved}
                                  onClick={() => updateAccessStatus(request.producer_id, "approved")}
                                >
                                  {busy && !approved ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-stone-700 bg-stone-900 text-stone-100"
                                  disabled={busy || !approved}
                                  onClick={() => updateAccessStatus(request.producer_id, "revoked")}
                                >
                                  {busy && approved ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
                                  Revoke
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </div>

              <Card className="border-stone-800 bg-stone-950/85 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Full Script</p>
                    <p className="mt-2 text-sm text-stone-400">Writer access is always allowed. Approved producers can view this from their side too.</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                </div>
                <pre className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-stone-800 bg-black/30 p-6 font-mono text-sm leading-7 text-stone-100">
                  {script.scriptContent}
                </pre>
              </Card>
            </div>
          )}
        </div>
      </div>
    </WriterLayout>
  );
};

export default WriterScriptViewer;
