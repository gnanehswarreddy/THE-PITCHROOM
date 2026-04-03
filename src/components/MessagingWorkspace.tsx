import { useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { mongodbClient } from "@/lib/mongodb/client";
import { cn } from "@/lib/utils";
import ChatComposer from "@/components/ChatComposer";
import ChatHeader from "@/components/ChatHeader";
import ChatMessageList, { type ChatMessageItem, type PitchCardData } from "@/components/ChatMessageList";
import type { ChatTheme } from "@/components/chatThemes";
import { ArrowUpRight, CircleDot, Film, Info, MessageSquare, MoreHorizontal, Search, Sparkles, Star, Users } from "lucide-react";

export interface MessagingConversationItem {
  id: string;
  name: string;
  avatar?: string | null;
  scriptTitle?: string | null;
  unreadCount: number;
  lastMessageAt?: string | null;
  lastMessage?: string | null;
  roleLabel: string;
  status: string;
}

interface MessagingWorkspaceProps<T extends ChatMessageItem> {
  conversations: MessagingConversationItem[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  messages: T[];
  currentUserId: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: (content?: string) => Promise<void> | void;
  onDeleteMessage?: (messageId: string) => void;
  onPitchAction?: (action: "view" | "discuss" | "accept", pitch: PitchCardData, message: T) => void;
  isTyping?: boolean;
  typingLabel?: string;
  emptySidebarTitle: string;
  emptySidebarDescription: string;
  emptyChatTitle: string;
  emptyChatDescription: string;
  panelLabel: string;
  theme: ChatTheme;
  messagesEndRef?: RefObject<HTMLDivElement>;
}

const formatConversationTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const getInitial = (name?: string | null) => name?.trim().charAt(0).toUpperCase() || "?";

const parsePitchCard = (content?: string | null): PitchCardData | null => {
  const text = String(content || "").trim();
  const titleMatch = text.match(/(?:^|\n)Title:\s*(.+)/i);
  const genreMatch = text.match(/(?:^|\n)Genre:\s*(.+)/i);
  const loglineMatch = text.match(/(?:^|\n)Logline:\s*(.+)/i);
  if (!titleMatch || !loglineMatch) return null;
  return {
    title: titleMatch[1].trim(),
    genre: genreMatch?.[1]?.trim() || "Unlisted",
    logline: loglineMatch[1].trim(),
  };
};

const derivePitchStatus = <T extends ChatMessageItem>(messages: T[]) => {
  const joined = messages.map((message) => String(message.content || "")).join("\n").toLowerCase();
  if (/accept(ed)? pitch|move forward|greenlight|let's do this/.test(joined)) return "Accepted";
  if (/discuss|review|schedule|call/.test(joined)) return "In Review";
  if (messages.some((message) => parsePitchCard(message.content))) return "Pending";
  return "Open Conversation";
};

const buildMeetingUrl = (kind: "audio" | "video", conversation: MessagingConversationItem) => {
  const roomSeed = `${conversation.name}-${conversation.id}-${conversation.scriptTitle || "project"}`
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const room = `PitchRoom-${kind}-${roomSeed}-${Date.now()}`;
  const audioConfig = "#config.prejoinPageEnabled=true&config.startWithAudioMuted=false&config.startWithVideoMuted=true";
  const videoConfig = "#config.prejoinPageEnabled=true&config.startWithAudioMuted=false&config.startWithVideoMuted=false";
  return `https://meet.jit.si/${room}${kind === "audio" ? audioConfig : videoConfig}`;
};

const MessagingWorkspace = <T extends ChatMessageItem>({
  conversations,
  selectedConversationId,
  onSelectConversation,
  messages,
  currentUserId,
  searchTerm,
  onSearchTermChange,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onDeleteMessage,
  onPitchAction,
  isTyping = false,
  typingLabel = "Typing...",
  emptySidebarTitle,
  emptySidebarDescription,
  emptyChatTitle,
  emptyChatDescription,
  panelLabel,
  theme,
  messagesEndRef,
}: MessagingWorkspaceProps<T>) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) || null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const latestPitch = useMemo(() => {
    const pitchMessage = [...messages].reverse().find((message) => parsePitchCard(message.content));
    return pitchMessage ? parsePitchCard(pitchMessage.content) : null;
  }, [messages]);

  const pitchStatus = useMemo(() => derivePitchStatus(messages), [messages]);

  const sendSystemMessage = async (content: string) => {
    if (!selectedConversation) return;
    await onSendMessage(content);
  };

  const handleCallLaunch = (kind: "audio" | "video") => {
    if (!selectedConversation) return;
    const url = buildMeetingUrl(kind, selectedConversation);
    const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!openedWindow) {
      toast({
        title: `${kind === "audio" ? "Audio" : "Video"} call blocked`,
        description: "Please allow pop-ups to open the meeting room.",
        variant: "destructive",
      });
      return;
    }
    void sendSystemMessage(`${kind === "audio" ? "Audio" : "Video"} call started: ${url}`);
    toast({
      title: `${kind === "audio" ? "Audio" : "Video"} room opened`,
      description: "A PitchRoom meeting link opened in a new tab.",
    });
  };

  const handleAttachClick = () => {
    if (!selectedConversation || isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !selectedConversation) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        const storagePath = `${currentUserId || "guest"}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { data, error } = await mongodbClient.storage.from("uploads").upload(storagePath, file);
        if (error || !data) {
          throw new Error(error?.message || `Failed to upload ${file.name}`);
        }

        const publicUrl = data.publicUrl || mongodbClient.storage.from("uploads").getPublicUrl(data.path).data.publicUrl;
        await onSendMessage(`Attachment: ${file.name}\nType: ${file.type || "file"}\nOpen: ${publicUrl}`);
      }

      toast({
        title: "Files sent",
        description: `${files.length} attachment${files.length > 1 ? "s were" : " was"} added to the conversation.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload the selected file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const stopRecording = async () => {
    const mediaRecorder = recorderRef.current;
    if (!mediaRecorder) return;
    mediaRecorder.stop();
  };

  const handleVoiceRecorder = async () => {
    if (!selectedConversation || isUploading) return;

    if (isRecording) {
      await stopRecording();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Recorder unavailable",
        description: "This browser does not support microphone recording.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (recorderEvent) => {
        if (recorderEvent.data.size > 0) recordedChunksRef.current.push(recorderEvent.data);
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(recordedChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        if (!audioBlob.size) return;

        setIsUploading(true);
        try {
          const extension = mediaRecorder.mimeType.includes("ogg") ? "ogg" : "webm";
          const fileName = `voice-note-${Date.now()}.${extension}`;
          const storagePath = `${currentUserId || "guest"}/${fileName}`;
          const { data, error } = await mongodbClient.storage.from("uploads").upload(storagePath, audioBlob);
          if (error || !data) {
            throw new Error(error?.message || "Failed to upload voice note");
          }

          const publicUrl = data.publicUrl || mongodbClient.storage.from("uploads").getPublicUrl(data.path).data.publicUrl;
          await onSendMessage(`Voice Note: ${fileName}\nOpen: ${publicUrl}`);
          toast({
            title: "Voice note sent",
            description: "Your recording has been uploaded and shared.",
          });
        } catch (error) {
          toast({
            title: "Voice note failed",
            description: error instanceof Error ? error.message : "Could not upload the recording.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
          recorderRef.current = null;
          recordedChunksRef.current = [];
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({
        title: "Recording started",
        description: "Tap the mic button again to stop and send your voice note.",
      });
    } catch {
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record voice notes.",
        variant: "destructive",
      });
    }
  };

  const handleMarkNextStep = () => {
    if (!selectedConversation) return;
    onNewMessageChange(`Next step for ${selectedConversation.scriptTitle || "this project"}: let's lock the review notes, confirm timeline, and schedule the follow-up call.`);
    toast({
      title: "Next step added",
      description: "The composer has been filled with a follow-up prompt.",
    });
  };

  const handleSaveProjectNotes = () => {
    if (!selectedConversation) return;
    const transcript = messages
      .map((message) => {
        const author = message.sender_id === currentUserId ? "You" : selectedConversation.name;
        return `[${message.created_at || ""}] ${author}: ${message.content || ""}`;
      })
      .join("\n\n");

    const fileContent = `PitchRoom Notes\nConversation: ${selectedConversation.name}\nProject: ${selectedConversation.scriptTitle || "Untitled project"}\n\n${transcript}`;
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${(selectedConversation.scriptTitle || selectedConversation.name).replace(/[^a-zA-Z0-9_-]/g, "_")}-notes.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    toast({
      title: "Notes saved",
      description: "A text export of this conversation was downloaded.",
    });
  };

  const handleOpenScriptRoom = () => {
    const isProducer = location.pathname.startsWith("/producer");
    navigate(isProducer ? "/producer/discover" : "/writer/scripts");
  };

  return (
    <div className="superhero-chat-container">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleFilesSelected}
        accept=".pdf,.doc,.docx,.fdx,.txt,.rtf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a,.webm"
      />

      <div className={cn("relative h-[calc(100vh-4rem)] overflow-hidden rounded-[2rem] border border-white/10", theme.shellClassName)}>
        <div className={cn("pointer-events-none absolute inset-0", theme.textureClassName)} />
        <div className={cn("pointer-events-none absolute inset-0", theme.ambientClassName)} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)] opacity-50" />

        <div className="relative grid h-full min-h-0 grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className={cn("flex min-h-0 flex-col border-b border-white/10 xl:border-b-0 xl:border-r", theme.sidebarClassName)}>
            <div className="border-b border-white/10 px-4 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/75">PitchRoom</p>
                  <h1 className="mt-2 text-xl font-semibold text-white">{panelLabel}</h1>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300">
                  Live chat
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">A cinematic messaging workspace where scripts, notes, and decisions stay in the same thread.</p>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Search conversations"
                  value={searchTerm}
                  onChange={(event) => onSearchTermChange(event.target.value)}
                  className="h-11 rounded-full border-white/10 bg-white/[0.04] pl-10 text-sm text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {conversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center text-slate-400">
                  <Users className="h-8 w-8 opacity-50" />
                  <p className="mt-3 text-sm text-white">{emptySidebarTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">{emptySidebarDescription}</p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className={cn(
                      "mb-2 w-full rounded-[1.45rem] border p-3 text-left transition duration-200 hover:-translate-y-0.5",
                      selectedConversationId === conversation.id ? theme.sidebarItemActiveClassName : theme.sidebarItemIdleClassName,
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 border border-white/10">
                        <AvatarImage src={conversation.avatar || undefined} />
                        <AvatarFallback className={cn("font-semibold", theme.receiverAvatarClassName)}>{getInitial(conversation.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-white">{conversation.name}</p>
                          <span className="shrink-0 text-[11px] text-slate-500">{formatConversationTime(conversation.lastMessageAt)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-100/80">{conversation.roleLabel}</span>
                          <p className="truncate text-xs text-amber-200/75">{conversation.scriptTitle || "General thread"}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-xs text-slate-400">{conversation.lastMessage || "Open the conversation"}</p>
                          {conversation.unreadCount > 0 ? <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" /> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col border-r border-white/10">
            {selectedConversation ? (
              <>
                <ChatHeader
                  name={selectedConversation.name}
                  avatar={selectedConversation.avatar}
                  subtitle={selectedConversation.roleLabel}
                  status={selectedConversation.status}
                  projectName={selectedConversation.scriptTitle}
                  onAudioCall={() => handleCallLaunch("audio")}
                  onVideoCall={() => handleCallLaunch("video")}
                  theme={theme}
                />

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                  <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-end">
                    <div className="mb-5 flex items-center justify-between px-1">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Conversation</p>
                        <p className="mt-1 text-sm text-slate-400">Discussing <span className="text-amber-100">{selectedConversation.scriptTitle || "Untitled project"}</span></p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    <ChatMessageList
                      messages={messages}
                      currentUserId={currentUserId}
                      otherUserName={selectedConversation.name}
                      otherUserAvatar={selectedConversation.avatar}
                      onDeleteMessage={onDeleteMessage}
                      onPitchAction={onPitchAction}
                      theme={theme}
                    />

                    {isTyping ? (
                      <div className="superhero-typing mt-4 ml-2">
                        <span className="superhero-reactor" />
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                        <span>{typingLabel}</span>
                      </div>
                    ) : null}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <ChatComposer
                  value={newMessage}
                  onChange={onNewMessageChange}
                  onSend={() => void onSendMessage()}
                  onAttach={handleAttachClick}
                  onVoice={() => void handleVoiceRecorder()}
                  isRecording={isRecording}
                  theme={theme}
                />
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <MessageSquare className="h-12 w-12 text-slate-500" />
                <p className="mt-4 text-lg font-medium text-white">{emptyChatTitle}</p>
                <p className="mt-2 max-w-sm text-sm text-slate-400">{emptyChatDescription}</p>
              </div>
            )}
          </section>

          <aside className="hidden min-h-0 flex-col bg-slate-950/35 xl:flex">
            <div className="border-b border-white/10 px-5 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/70">Context</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Project Snapshot</h2>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.95)]">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <Info className="h-3.5 w-3.5" />
                  Pitch Status
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-lg font-semibold text-white">{pitchStatus}</p>
                  <Badge className="rounded-full border border-amber-300/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">Live</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {latestPitch ? `${latestPitch.title} is currently being discussed in this thread.` : "Conversation is active and ready for script discussion."}
                </p>
              </section>

              <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 border border-white/10">
                    <AvatarImage src={selectedConversation?.avatar || undefined} />
                    <AvatarFallback className={cn("font-semibold", theme.receiverAvatarClassName)}>{getInitial(selectedConversation?.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">{selectedConversation?.name || "No contact selected"}</p>
                    <p className="text-sm text-slate-400">{selectedConversation?.roleLabel || "Collaborator"}</p>
                    <p className="mt-1 text-xs text-emerald-300">{selectedConversation?.status || "Offline"}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <Film className="h-3.5 w-3.5" />
                  Script Details
                </div>
                <p className="mt-3 text-base font-semibold text-white">{latestPitch?.title || selectedConversation?.scriptTitle || "Untitled project"}</p>
                <p className="mt-1 text-sm text-amber-100/85">{latestPitch?.genre || "In development"}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {latestPitch?.logline || "Keep the project context visible while the conversation moves through notes, revisions, and next steps."}
                </p>
              </section>

              <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  Quick Actions
                </div>
                <div className="mt-4 grid gap-2">
                  <Button type="button" variant="secondary" className="justify-start rounded-2xl border border-white/10 bg-white/8 text-white hover:bg-white/12" onClick={handleMarkNextStep}>
                    <CircleDot className="mr-2 h-4 w-4 text-amber-200" />
                    Mark next step
                  </Button>
                  <Button type="button" variant="secondary" className="justify-start rounded-2xl border border-white/10 bg-white/8 text-white hover:bg-white/12" onClick={handleSaveProjectNotes}>
                    <Star className="mr-2 h-4 w-4 text-amber-200" />
                    Save project notes
                  </Button>
                  <Button type="button" variant="secondary" className="justify-start rounded-2xl border border-white/10 bg-white/8 text-white hover:bg-white/12" onClick={handleOpenScriptRoom}>
                    <ArrowUpRight className="mr-2 h-4 w-4 text-amber-200" />
                    Open script room
                  </Button>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default MessagingWorkspace;
