import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Dot, Film, Phone, ShieldCheck, Video } from "lucide-react";
import type { ChatTheme } from "@/components/chatThemes";

interface ChatHeaderProps {
  name: string;
  subtitle?: string | null;
  avatar?: string | null;
  status?: string;
  roleLabel?: string;
  projectName?: string | null;
  className?: string;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  theme: ChatTheme;
}

const getInitial = (name?: string | null) => name?.trim().charAt(0).toUpperCase() || "?";

const ChatHeader = ({
  name,
  subtitle,
  avatar,
  status = "Online",
  roleLabel = "Collaborator",
  projectName,
  className,
  onAudioCall,
  onVideoCall,
  theme,
}: ChatHeaderProps) => {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 border-b border-white/10 px-4 py-4 backdrop-blur-3xl sm:px-6",
        theme.headerClassName,
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border border-white/10 shadow-[0_0_40px_rgba(245,158,11,0.18)]">
          <AvatarImage src={avatar || undefined} />
          <AvatarFallback className={cn("text-sm font-semibold", theme.receiverAvatarClassName)}>
            {getInitial(name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-white sm:text-base">{name}</h2>
            <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200">
              <Dot className="-ml-1 mr-0.5 h-4 w-4" />
              {status}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            <span className="text-slate-300/90">{roleLabel}</span>
            {subtitle ? <span className="text-slate-600">&bull;</span> : null}
            {subtitle ? <span className="truncate">{subtitle}</span> : null}
            {projectName ? <span className="text-slate-600">&bull;</span> : null}
            {projectName ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/10 bg-amber-200/5 px-2 py-1 text-amber-100/90">
                <Film className="h-3.5 w-3.5" />
                {projectName}
              </span>
            ) : null}
          </div>
          <div className="mt-2 hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-200/75" />
            Script conversation synced and secured in PitchRoom
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={onAudioCall}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-white/10 hover:text-white"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onVideoCall}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-white/10 hover:text-white"
          >
            <Video className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
