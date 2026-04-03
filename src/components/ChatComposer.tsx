import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Mic, Paperclip, Plus, SendHorizonal, Square } from "lucide-react";
import type { ChatTheme } from "@/components/chatThemes";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  onVoice?: () => void;
  isRecording?: boolean;
  placeholder?: string;
  className?: string;
  theme: ChatTheme;
}

const chromeButtonClassName =
  "h-11 w-11 rounded-full border border-white/10 bg-white/5 text-slate-300 shadow-[0_18px_36px_-26px_rgba(0,0,0,0.95)] transition hover:-translate-y-0.5 hover:border-amber-300/25 hover:bg-white/10 hover:text-white";

const ChatComposer = ({
  value,
  onChange,
  onSend,
  onAttach,
  onVoice,
  isRecording = false,
  placeholder = "Type your message...",
  className,
  theme,
}: ChatComposerProps) => {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 border-t border-white/10 px-3 py-3 backdrop-blur-3xl sm:px-5",
        theme.composerClassName,
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-[1.9rem] border p-2 shadow-[0_30px_90px_-44px_rgba(0,0,0,1)] backdrop-blur-xl",
          theme.composerInputClassName,
        )}
      >
        <Button type="button" size="icon" variant="ghost" className={chromeButtonClassName} onClick={onAttach}>
          <Plus className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(chromeButtonClassName, "hidden sm:inline-flex")}
          onClick={onAttach}
        >
          <Paperclip className="h-4 w-4 text-slate-300" />
        </Button>

        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isRecording ? "Recording voice note..." : placeholder}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          className="h-12 flex-1 rounded-full border border-transparent bg-transparent px-4 text-sm text-slate-50 shadow-none placeholder:text-slate-500 focus-visible:border-amber-300/20 focus-visible:bg-white/[0.03] focus-visible:ring-[0_0_0_4px_rgba(245,158,11,0.08)]"
        />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            chromeButtonClassName,
            isRecording && "border-rose-300/30 bg-rose-400/10 text-rose-200 hover:border-rose-300/40 hover:bg-rose-400/15 hover:text-rose-100",
          )}
          onClick={onVoice}
        >
          {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <Button
          type="button"
          onClick={onSend}
          size="icon"
          className={cn(
            "h-12 w-12 rounded-full text-slate-950 shadow-[0_22px_44px_-20px_rgba(245,158,11,0.8)] transition hover:scale-[1.03]",
            theme.composerButtonClassName,
          )}
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatComposer;
