import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Check, CheckCheck, FileText, MessageCircleMore, Sparkles, Trash2 } from "lucide-react";
import type { ChatTheme } from "@/components/chatThemes";

export interface ChatMessageItem {
  id: string;
  sender_id?: string | null;
  content?: string | null;
  created_at?: string | null;
  read?: boolean | null;
}

export interface PitchCardData {
  title: string;
  genre: string;
  logline: string;
}

interface ChatMessageListProps<T extends ChatMessageItem> {
  messages: T[];
  currentUserId: string;
  otherUserName: string;
  otherUserAvatar?: string | null;
  onDeleteMessage?: (messageId: string) => void;
  onPitchAction?: (action: "view" | "discuss" | "accept", pitch: PitchCardData, message: T) => void;
  theme: ChatTheme;
}

const formatTime = (createdAt?: string | null) => {
  if (!createdAt) return "";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const getInitial = (name?: string | null) => name?.trim().charAt(0).toUpperCase() || "?";

const parsePitchCard = (content?: string | null): PitchCardData | null => {
  const text = String(content || "").trim();
  if (!text) return null;

  const titleMatch = text.match(/(?:^|\n)Title:\s*(.+)/i);
  const genreMatch = text.match(/(?:^|\n)Genre:\s*(.+)/i);
  const loglineMatch = text.match(/(?:^|\n)Logline:\s*(.+)/i);

  if (!titleMatch || !loglineMatch) {
    return null;
  }

  return {
    title: titleMatch[1].trim(),
    genre: genreMatch?.[1]?.trim() || "Unlisted",
    logline: loglineMatch[1].trim(),
  };
};

const ChatMessageList = <T extends ChatMessageItem>({
  messages,
  currentUserId,
  otherUserName,
  otherUserAvatar,
  onDeleteMessage,
  onPitchAction,
  theme,
}: ChatMessageListProps<T>) => {
  return (
    <div className="flex min-h-full flex-col justify-end pb-2">
      {messages.map((message, index) => {
        const previousMessage = index > 0 ? messages[index - 1] : null;
        const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
        const senderId = message.sender_id || "unknown";
        const isCurrentUser = senderId === currentUserId;
        const isSameSenderAsPrevious = previousMessage?.sender_id === senderId;
        const isSameSenderAsNext = nextMessage?.sender_id === senderId;
        const showGroupSpacing = !isSameSenderAsPrevious;
        const showMeta = !isSameSenderAsNext;
        const showAvatar = !isCurrentUser && showMeta;
        const pitch = parsePitchCard(message.content);
        const bubbleShapeClassName = isCurrentUser
          ? cn(
              !isSameSenderAsPrevious ? "rounded-tr-[1.4rem]" : "rounded-tr-md",
              !isSameSenderAsNext ? "rounded-br-md" : "rounded-br-[1.4rem]",
              "rounded-tl-[1.4rem] rounded-bl-[1.4rem]",
            )
          : cn(
              !isSameSenderAsPrevious ? "rounded-tl-[1.4rem]" : "rounded-tl-md",
              !isSameSenderAsNext ? "rounded-bl-md" : "rounded-bl-[1.4rem]",
              "rounded-tr-[1.4rem] rounded-br-[1.4rem]",
            );

        return (
          <div
            key={message.id}
            className={cn(
              "pitchroom-message-fade flex w-full items-end gap-3",
              isCurrentUser ? "justify-end" : "justify-start",
              showGroupSpacing ? "mt-4" : "mt-1",
            )}
          >
            {!isCurrentUser && (
              <div className="hidden w-10 shrink-0 sm:block">
                {showAvatar ? (
                  <Avatar className="h-10 w-10 border border-white/10 bg-slate-950/80 shadow-[0_16px_40px_-25px_rgba(0,0,0,0.9)]">
                    <AvatarImage src={otherUserAvatar || undefined} />
                    <AvatarFallback className={cn("text-xs font-semibold", theme.receiverAvatarClassName)}>
                      {getInitial(otherUserName)}
                    </AvatarFallback>
                  </Avatar>
                ) : null}
              </div>
            )}

            <div className={cn("group flex min-w-0 flex-col", isCurrentUser ? "items-end" : "items-start")}>
              {showGroupSpacing && !isCurrentUser ? (
                <span className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  {otherUserName}
                </span>
              ) : null}

              <div
                className={cn(
                  "pitchroom-bubble w-auto max-w-[85%] px-4 py-3 sm:max-w-[60%] sm:px-5 sm:py-3.5",
                  bubbleShapeClassName,
                  isCurrentUser ? "pitchroom-bubble-user" : "pitchroom-bubble-other",
                )}
              >
                {pitch ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-amber-100">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-[0.28em]",
                            isCurrentUser ? "text-slate-950/55" : "text-white/55",
                          )}
                        >
                          Script Pitch
                        </p>
                        <h3 className={cn("mt-1 text-base font-semibold", isCurrentUser ? "text-slate-950" : "text-white")}>
                          {pitch.title}
                        </h3>
                        <p
                          className={cn(
                            "mt-1 text-xs uppercase tracking-[0.18em]",
                            isCurrentUser ? "text-slate-900/70" : "text-amber-100/80",
                          )}
                        >
                          {pitch.genre}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
                          isCurrentUser
                            ? "border-slate-900/10 bg-slate-950/10 text-slate-900/70"
                            : "border-amber-200/15 bg-amber-200/10 text-amber-100/80",
                        )}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Premium
                      </span>
                    </div>
                    <p className={cn("text-sm leading-6", isCurrentUser ? "text-slate-900/80" : "text-slate-100/88")}>
                      {pitch.logline}
                    </p>
                    <div
                      className={cn(
                        "rounded-[1.15rem] border p-3",
                        isCurrentUser ? "border-slate-900/10 bg-slate-950/10" : "border-white/10 bg-white/5",
                      )}
                    >
                      <div className="grid gap-1 text-xs sm:grid-cols-2">
                        <div>
                          <p className={cn("uppercase tracking-[0.22em]", isCurrentUser ? "text-slate-900/50" : "text-white/45")}>Title</p>
                          <p className={cn("mt-1 text-sm font-medium", isCurrentUser ? "text-slate-950" : "text-white")}>{pitch.title}</p>
                        </div>
                        <div>
                          <p className={cn("uppercase tracking-[0.22em]", isCurrentUser ? "text-slate-900/50" : "text-white/45")}>Genre</p>
                          <p className={cn("mt-1 text-sm font-medium", isCurrentUser ? "text-slate-950" : "text-amber-100")}>{pitch.genre}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className={cn(
                          "rounded-full border text-xs",
                          isCurrentUser
                            ? "border-slate-900/10 bg-slate-950/10 text-slate-950 hover:bg-slate-950/15"
                            : "border-white/10 bg-white/10 text-white hover:bg-white/15",
                        )}
                        onClick={() => onPitchAction?.("view", pitch, message)}
                      >
                        View Script
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className={cn(
                          "rounded-full border text-xs",
                          isCurrentUser
                            ? "border-slate-900/10 bg-slate-950/10 text-slate-950 hover:bg-slate-950/15"
                            : "border-white/10 bg-white/10 text-white hover:bg-white/15",
                        )}
                        onClick={() => onPitchAction?.("discuss", pitch, message)}
                      >
                        <MessageCircleMore className="mr-1 h-3.5 w-3.5" />
                        Discuss
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-xs font-semibold text-slate-950 hover:brightness-105"
                        onClick={() => onPitchAction?.("accept", pitch, message)}
                      >
                        Accept Pitch
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-inherit">{message.content || ""}</p>
                )}

                {onDeleteMessage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute right-2 top-2 h-7 w-7 rounded-full opacity-0 transition group-hover:opacity-100",
                      isCurrentUser
                        ? "text-slate-900/55 hover:bg-slate-950/10 hover:text-slate-950"
                        : "text-white/60 hover:bg-black/20 hover:text-white",
                    )}
                    onClick={() => onDeleteMessage(message.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>

              {showMeta ? (
                <div
                  className={cn(
                    "mt-1.5 flex items-center gap-1 px-1 text-[11px]",
                    isCurrentUser ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  <span>{formatTime(message.created_at)}</span>
                  {isCurrentUser ? (
                    message.read ? (
                      <CheckCheck className="h-3.5 w-3.5 text-emerald-300" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-slate-500" />
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatMessageList;
