import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookmarkPlus, CalendarDays, CheckCircle2, EyeOff, Globe2, Loader2, MessageSquareMore } from "lucide-react";
import ProducerLayout from "./ProducerLayout";
import { mongodbClient, type ScriptRecord } from "@/lib/mongodb/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { buildScriptMetadata, trackEvent } from "@/lib/analytics";

type AccessStatus = "idle" | "pending" | "approved" | "rejected";

const ScriptViewer = () => {
  const navigate = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [savingScript, setSavingScript] = useState(false);
  const [script, setScript] = useState<ScriptRecord | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("idle");

  useEffect(() => {
    const loadScript = async () => {
      setLoading(true);
      const { data, error } = await mongodbClient.scripts.getById(id);

      if (error) {
        toast({
          title: error.status === 403 ? "Access denied" : "Script unavailable",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setScript(data);
      await trackEvent({
        event_type: "SCRIPT_VIEW",
        script_id: data.id,
        story_id: data.sourceStoryId || null,
        metadata: buildScriptMetadata(data, {
          story_owner_id: data.writer_id || data.userId || data.author?.id || null,
          story_title: null,
        }),
      });
      setLoading(false);
    };

    void loadScript();
  }, [id, toast]);

  useEffect(() => {
    const loadAccessStatus = async () => {
      if (!script) return;

      const writerId = script.writer_id || script.userId || script.author?.id || null;
      if (!writerId || script.scriptContent) {
        setAccessStatus(script.scriptContent ? "approved" : "idle");
        return;
      }

      const { data: authData } = await mongodbClient.auth.getUser();
      const producerId = authData.user?.id;
      if (!producerId) return;

      const existingGrant = await mongodbClient
        .from("script_access_grants")
        .select("*")
        .eq("script_id", script.id || script._id)
        .eq("producer_id", producerId)
        .maybeSingle();

      setAccessStatus((existingGrant.data?.status as AccessStatus) || "idle");
    };

    void loadAccessStatus();
  }, [script]);

  const handleRequestAccess = async () => {
    const writerId = script?.writer_id || script?.userId || script?.author?.id || null;

    if (!script || !writerId) {
      toast({
        title: "Writer unavailable",
        description: "This script is missing writer information, so we could not create an access request.",
        variant: "destructive",
      });
      return;
    }

    setRequestingAccess(true);

    try {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user?.id) {
        throw new Error("Please log in to request access.");
      }

      const now = new Date().toISOString();
      const scriptId = script.id || script._id;
      const requestMessage = [
        `Hi, I would like access to read the full script "${script.title}".`,
        script.logline ? `The logline caught my attention: ${script.logline}` : "",
        "Please share access if you're open to discussing the project.",
      ].filter(Boolean).join("\n\n");

      const existingGrant = await mongodbClient
        .from("script_access_grants")
        .select("*")
        .eq("script_id", scriptId)
        .eq("producer_id", user.id)
        .maybeSingle();

      if (existingGrant.data?.status === "approved") {
        toast({ title: "Access already granted", description: "Reloading the script view now." });
        window.location.reload();
        return;
      }

      if (existingGrant.data?.status === "pending") {
        toast({ title: "Request already sent", description: "The writer has not responded yet." });
        navigate(`/producer/messages?conversation=${writerId}`);
        return;
      }

      if (existingGrant.data) {
        const updatedGrant = await mongodbClient
          .from("script_access_grants")
          .update({ status: "pending", updated_at: now })
          .eq("id", existingGrant.data.id || existingGrant.data._id);

        if (updatedGrant.error) {
          throw new Error(updatedGrant.error.message || "Could not update the access request.");
        }
      } else {
        const createdGrant = await mongodbClient
          .from("script_access_grants")
          .insert({
            script_id: scriptId,
            writer_id: writerId,
            producer_id: user.id,
            status: "pending",
            created_at: now,
            updated_at: now,
          });

        if (createdGrant.error) {
          throw new Error(createdGrant.error.message || "Could not create the access request.");
        }
      }

      const existingConversation = await mongodbClient
        .from("conversations")
        .select("*")
        .eq("writer_id", writerId)
        .eq("producer_id", user.id)
        .eq("script_id", scriptId)
        .maybeSingle();

      let conversationId = existingConversation.data?.id || existingConversation.data?._id || null;

      if (!conversationId) {
        const insertedConversation = await mongodbClient
          .from("conversations")
          .insert({
            writer_id: writerId,
            producer_id: user.id,
            script_id: scriptId,
            last_message_at: now,
            created_at: now,
            updated_at: now,
          })
          .single();

        if (insertedConversation.error) {
          throw new Error(insertedConversation.error.message || "Could not start the conversation.");
        }

        conversationId = insertedConversation.data?.id || insertedConversation.data?._id || null;
      } else {
        await mongodbClient
          .from("conversations")
          .update({ last_message_at: now, updated_at: now })
          .eq("id", conversationId);
      }

      if (!conversationId) {
        throw new Error("Conversation could not be created.");
      }

      const insertedMessage = await mongodbClient.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: requestMessage,
        read: false,
        created_at: now,
        updated_at: now,
      });

      if (insertedMessage.error) {
        throw new Error(insertedMessage.error.message || "Could not send the access request.");
      }

      setAccessStatus("pending");
      toast({
        title: "Access request sent",
        description: "Your request has been sent to the writer.",
      });

      navigate(`/producer/messages?conversation=${writerId}`);
    } catch (error) {
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Could not send the access request.",
        variant: "destructive",
      });
    } finally {
      setRequestingAccess(false);
    }
  };

  const handleSaveScript = async () => {
    if (!script) return;
    setSavingScript(true);

    try {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user?.id) {
        throw new Error("Please log in to save scripts.");
      }

      const existing = await mongodbClient
        .from("collections")
        .select("id")
        .eq("producer_id", user.id)
        .eq("script_id", script.id)
        .maybeSingle();

      if (existing.data) {
        toast({ title: "Already saved", description: "This script is already in your collection." });
        return;
      }

      const insertResult = await mongodbClient.from("collections").insert({
        producer_id: user.id,
        script_id: script.id,
        notes: null,
        tags: [],
        category: "potential",
        priority: "medium",
      });

      if (insertResult.error) {
        throw new Error(insertResult.error.message || "Could not save this script.");
      }

      await trackEvent({
        event_type: "SCRIPT_SAVE",
        script_id: script.id,
        story_id: script.sourceStoryId || null,
        metadata: buildScriptMetadata(script, {
          story_owner_id: script.writer_id || script.userId || script.author?.id || null,
          saved_to_collection: true,
        }),
      });

      toast({ title: "Saved to collection", description: "You can manage it from My Collections." });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save this script.",
        variant: "destructive",
      });
    } finally {
      setSavingScript(false);
    }
  };

  return (
    <ProducerLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_25%),linear-gradient(180deg,_rgba(7,11,18,1),_rgba(10,16,26,1))] px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Button variant="ghost" onClick={() => navigate("/producer/discover")} className="mb-6 text-slate-200 hover:bg-slate-800/80">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Discover
          </Button>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-sky-200" />
            </div>
          ) : !script ? (
            <Card className="border-slate-800 bg-slate-950/80 p-10 text-center text-slate-300">Script not found.</Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
              <Card className="border-slate-800 bg-slate-950/85 p-6">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Script Profile</p>
                <h1 className="mt-4 font-['Oswald'] text-4xl uppercase leading-none text-sky-50">{script.title}</h1>
                <p className="mt-4 text-sm text-slate-300">by {script.author?.name || "Anonymous"}</p>

                <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-slate-400">
                  {script.visibility === "public" ? <Globe2 className="h-4 w-4 text-emerald-200" /> : <EyeOff className="h-4 w-4" />}
                  {script.visibility}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm leading-6 text-slate-300">
                  <p>{script.logline}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(script.created_at || script.createdAt || "").toLocaleDateString()}
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="mt-6 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                  onClick={handleSaveScript}
                  disabled={savingScript}
                >
                  {savingScript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-2 h-4 w-4" />}
                  Save to Collection
                </Button>
              </Card>

              <Card className="border-slate-800 bg-slate-950/85 p-6">
                {script.scriptContent ? (
                  <>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Full Script</p>
                    <pre className="mt-4 max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-800 bg-black/30 p-6 font-mono text-sm leading-7 text-slate-100">
                      {script.scriptContent}
                    </pre>
                  </>
                ) : (
                  <>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Protected Content</p>
                    <div className="mt-4 rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(14,116,144,0.18),rgba(12,18,30,0.9))] p-8">
                      <h2 className="font-['Oswald'] text-3xl uppercase text-sky-50">Full script is private.</h2>
                      <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                        The writer must approve your request before the full script becomes visible here.
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        Current request status: {accessStatus === "idle" ? "not requested" : accessStatus}.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-6 border-sky-300/30 bg-sky-300/10 text-sky-100 hover:bg-sky-300/20"
                        onClick={handleRequestAccess}
                        disabled={requestingAccess || accessStatus === "pending"}
                      >
                        {requestingAccess ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : accessStatus === "approved" ? (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        ) : (
                          <MessageSquareMore className="mr-2 h-4 w-4" />
                        )}
                        {requestingAccess
                          ? "Sending Request..."
                          : accessStatus === "pending"
                            ? "Request Pending"
                            : accessStatus === "approved"
                              ? "Access Approved - Reload"
                              : "Request Access"}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </ProducerLayout>
  );
};

export default ScriptViewer;
