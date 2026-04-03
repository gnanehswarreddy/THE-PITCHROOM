export type ChatThemeId = "superhero-command";

export interface ChatTheme {
  id: ChatThemeId;
  label: string;
  backgroundImagePath: string;
  shellClassName: string;
  textureClassName: string;
  ambientClassName: string;
  sidebarClassName: string;
  sidebarItemActiveClassName: string;
  sidebarItemIdleClassName: string;
  chatPanelClassName: string;
  headerClassName: string;
  composerClassName: string;
  composerInputClassName: string;
  composerButtonClassName: string;
  senderBubbleClassName: string;
  receiverBubbleClassName: string;
  receiverAvatarClassName: string;
}

export const chatThemes: Record<ChatThemeId, ChatTheme> = {
  "superhero-command": {
    id: "superhero-command",
    label: "PitchRoom Noir",
    backgroundImagePath: "",
    shellClassName:
      "bg-[radial-gradient(circle_at_14%_10%,rgba(99,102,241,0.16),transparent_20%),radial-gradient(circle_at_85%_12%,rgba(245,158,11,0.14),transparent_18%),radial-gradient(circle_at_52%_110%,rgba(126,34,206,0.2),transparent_28%),linear-gradient(155deg,#060816_0%,#0c1020_32%,#120f26_72%,#181225_100%)] text-slate-100 shadow-[0_42px_140px_-64px_rgba(0,0,0,1)]",
    textureClassName:
      "bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px),radial-gradient(circle_at_16%_22%,rgba(99,102,241,0.12),transparent_18%),radial-gradient(circle_at_86%_16%,rgba(245,158,11,0.1),transparent_18%)] bg-[size:52px_52px,_52px_52px,_auto,_auto] opacity-70",
    ambientClassName:
      "bg-[radial-gradient(circle_at_24%_14%,rgba(59,130,246,0.1),transparent_18%),radial-gradient(circle_at_78%_78%,rgba(168,85,247,0.12),transparent_22%)]",
    sidebarClassName: "bg-slate-950/52 text-slate-100 backdrop-blur-3xl",
    sidebarItemActiveClassName:
      "border-amber-200/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] shadow-[0_26px_64px_-34px_rgba(251,191,36,0.42)]",
    sidebarItemIdleClassName: "border-white/[0.06] bg-white/[0.028] hover:border-white/12 hover:bg-white/[0.055]",
    chatPanelClassName: "border-white/10 bg-slate-950/18",
    headerClassName: "bg-slate-950/56 text-slate-50",
    composerClassName: "bg-slate-950/72",
    composerInputClassName: "border-white/10 bg-white/[0.045]",
    composerButtonClassName: "bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 hover:brightness-105",
    senderBubbleClassName: "bg-gradient-to-br from-[#f7df8b] via-[#d9b152] to-[#b9851f] text-[#111827]",
    receiverBubbleClassName: "bg-[#191d2a] text-[#f8fafc]",
    receiverAvatarClassName: "bg-gradient-to-br from-[#382263] to-[#121828] text-[#f8fafc]",
  },
};

export const chatThemeList = Object.values(chatThemes);
