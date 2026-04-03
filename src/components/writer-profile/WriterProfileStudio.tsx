import { useEffect, useRef, useState } from "react";
import {
  Award,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  Film,
  GripVertical,
  ImagePlus,
  Languages,
  LayoutGrid,
  Lightbulb,
  Palette,
  PenSquare,
  Save,
  Sparkles,
  Star,
  Type,
  Upload,
  Wand2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { mongodbClient, type ScriptRecord } from "@/lib/mongodb/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type LayoutMode = "classic-grid" | "cinematic" | "social-feed";
type FontStyle = "editorial" | "cinematic" | "modern";
type ExperienceLevel = "emerging" | "professional" | "veteran";
type SectionId =
  | "spotlight"
  | "about"
  | "stats"
  | "featured"
  | "stories"
  | "scripts"
  | "achievements"
  | "tags";

interface StoryRecord {
  id: string;
  title: string;
  logline: string;
  genre: string;
  updated_at?: string;
  created_at?: string;
}

interface WriterProfileProject {
  id: string;
  type: "story" | "script";
  title: string;
  genre: string;
  logline: string;
  coverImage: string;
  pinned: boolean;
  featured: boolean;
  visible: boolean;
}

interface WriterProfileSection {
  id: SectionId;
  title: string;
  visible: boolean;
}

interface WriterProfileJson {
  profile: {
    avatarUrl: string;
    bannerImageUrl: string;
    username: string;
    displayName: string;
    bioRichText: string;
    genres: string[];
    languages: string[];
    experienceLevel: ExperienceLevel;
    achievements: string[];
    writingStyleTags: string[];
    contactEmail: string;
  };
  content: {
    projects: WriterProfileProject[];
    featuredProjectIds: string[];
    spotlightProjectId: string;
  };
  appearance: {
    themeColor: string;
    fontStyle: FontStyle;
    layoutMode: LayoutMode;
    pitchMode: boolean;
  };
  sections: WriterProfileSection[];
  privacy: {
    profileVisibility: "public" | "private";
    showContactInfo: boolean;
    collaborationOpen: boolean;
  };
  ai: {
    bioOptimized: boolean;
    suggestedLayout: LayoutMode;
    autoGenreTaggingRun: boolean;
  };
  stats: {
    stories: number;
    scripts: number;
    views: number;
  };
  ui: {
    editorTabs: ["info", "appearance", "content", "settings"];
    livePreview: true;
  };
  renderConfig: {
    layout: LayoutMode;
    fontClassName: string;
    accentColor: string;
    sectionOrder: SectionId[];
    visibleSections: SectionId[];
    pitchMode: boolean;
  };
}

interface WriterProfileStudioProps {
  profileId: string;
  initialName: string;
  initialBio: string;
  initialAvatarUrl: string;
  initialPreferences: Record<string, unknown>;
}

const FONT_OPTIONS: Array<{ value: FontStyle; label: string; className: string }> = [
  { value: "editorial", label: "Editorial", className: "font-serif" },
  { value: "cinematic", label: "Cinematic", className: "font-['Oswald']" },
  { value: "modern", label: "Modern", className: "font-sans" },
];

const SECTION_TITLES: Record<SectionId, string> = {
  spotlight: "Featured Spotlight",
  about: "About",
  stats: "Statistics",
  featured: "Featured Projects",
  stories: "Stories",
  scripts: "Scripts",
  achievements: "Achievements",
  tags: "Writing Style Tags",
};

const DEFAULT_SECTIONS: WriterProfileSection[] = [
  { id: "spotlight", title: SECTION_TITLES.spotlight, visible: true },
  { id: "about", title: SECTION_TITLES.about, visible: true },
  { id: "stats", title: SECTION_TITLES.stats, visible: true },
  { id: "featured", title: SECTION_TITLES.featured, visible: true },
  { id: "stories", title: SECTION_TITLES.stories, visible: true },
  { id: "scripts", title: SECTION_TITLES.scripts, visible: true },
  { id: "achievements", title: SECTION_TITLES.achievements, visible: true },
  { id: "tags", title: SECTION_TITLES.tags, visible: true },
];

const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

const normalizeColor = (color: string) => (color?.startsWith("#") ? color : "#f59e0b");

const createCoverFallback = (title: string, genre: string, color: string) =>
  `https://placehold.co/640x900/${normalizeColor(color).replace("#", "")}/111827?text=${encodeURIComponent(
    `${title}\n${genre || "PitchRoom"}`,
  )}`;

const getFontClassName = (fontStyle: FontStyle) =>
  FONT_OPTIONS.find((option) => option.value === fontStyle)?.className || "font-serif";

const suggestLayout = (projects: WriterProfileProject[], tags: string[]): LayoutMode => {
  const hasManyPinned = projects.filter((project) => project.featured || project.pinned).length >= 3;
  const cinematicTone = tags.some((tag) => /visual|cinematic|moody|elevated/i.test(tag));
  if (cinematicTone || hasManyPinned) return "cinematic";
  if (projects.length >= 6) return "classic-grid";
  return "social-feed";
};

const generateGenreTags = (projects: WriterProfileProject[]) => {
  const found = new Set<string>();
  projects.forEach((project) => {
    splitList(project.genre).forEach((genre) => found.add(genre));
    const text = `${project.title} ${project.logline}`.toLowerCase();
    if (text.includes("love")) found.add("Romance");
    if (text.includes("murder") || text.includes("crime")) found.add("Thriller");
    if (text.includes("ghost") || text.includes("haunt")) found.add("Horror");
    if (text.includes("future") || text.includes("space")) found.add("Sci-Fi");
    if (text.includes("family")) found.add("Drama");
    if (text.includes("funny") || text.includes("comic")) found.add("Comedy");
  });
  return Array.from(found).slice(0, 8);
};

const improveBioText = (bio: string, displayName: string, genres: string[], styles: string[]) => {
  const genreText = genres.length ? genres.join(", ") : "character-driven stories";
  const styleText = styles.length ? ` with a ${styles.join(", ")} voice` : "";
  const base = bio.trim() || `${displayName} is building original projects for PitchRoom.`;
  return `${base}\n\n${displayName} crafts ${genreText}${styleText}, shaping concept-forward worlds, emotional hooks, and pitch-ready material for collaborators and producers.`;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const renderRichText = (value: string) => {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^-\s(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n/g, "<br />");
};

const buildProjects = (
  scripts: ScriptRecord[],
  stories: StoryRecord[],
  themeColor: string,
  previous?: WriterProfileJson["content"]["projects"],
) => {
  const previousMap = new Map((previous || []).map((item) => [item.id, item]));
  const storyProjects: WriterProfileProject[] = stories.map((story) => {
    const existing = previousMap.get(story.id);
    return {
      id: story.id,
      type: "story",
      title: story.title || "Untitled Story",
      genre: story.genre || "Drama",
      logline: story.logline || "A new story in development.",
      coverImage: existing?.coverImage || createCoverFallback(story.title || "Story", story.genre || "Drama", themeColor),
      pinned: existing?.pinned || false,
      featured: existing?.featured || false,
      visible: existing?.visible ?? true,
    };
  });
  const scriptProjects: WriterProfileProject[] = scripts.map((script) => {
    const existing = previousMap.get(script.id);
    const genre = (script as ScriptRecord & { genre?: string }).genre || "Screenplay";
    return {
      id: script.id,
      type: "script",
      title: script.title || "Untitled Script",
      genre,
      logline: script.logline || "A pitch-ready screenplay project.",
      coverImage: existing?.coverImage || createCoverFallback(script.title || "Script", genre, themeColor),
      pinned: existing?.pinned || false,
      featured: existing?.featured || false,
      visible: existing?.visible ?? true,
    };
  });
  return [...scriptProjects, ...storyProjects];
};

const createDefaultProfile = (
  name: string,
  bio: string,
  avatarUrl: string,
  email: string,
  scripts: ScriptRecord[],
  stories: StoryRecord[],
): WriterProfileJson => {
  const themeColor = "#f59e0b";
  const projects = buildProjects(scripts, stories, themeColor);
  const featuredIds = projects.slice(0, 2).map((project) => project.id);
  const spotlightId = featuredIds[0] || projects[0]?.id || "";

  return {
    profile: {
      avatarUrl,
      bannerImageUrl: "",
      username: email.split("@")[0] || "writer",
      displayName: name || "PitchRoom Writer",
      bioRichText: bio || "Write a bold bio here. Use **bold** or *italic* to shape your voice.",
      genres: generateGenreTags(projects).slice(0, 4),
      languages: ["English"],
      experienceLevel: "emerging",
      achievements: ["Completed onboarding", "Building a pitch-ready portfolio"],
      writingStyleTags: ["Character-driven", "Visual", "Pitch-ready"],
      contactEmail: email,
    },
    content: {
      projects,
      featuredProjectIds: featuredIds,
      spotlightProjectId: spotlightId,
    },
    appearance: {
      themeColor,
      fontStyle: "editorial",
      layoutMode: "classic-grid",
      pitchMode: false,
    },
    sections: DEFAULT_SECTIONS,
    privacy: {
      profileVisibility: "public",
      showContactInfo: false,
      collaborationOpen: true,
    },
    ai: {
      bioOptimized: false,
      suggestedLayout: "classic-grid",
      autoGenreTaggingRun: false,
    },
    stats: {
      stories: stories.length,
      scripts: scripts.length,
      views: scripts.reduce((sum, script) => sum + (script.views || 0), 0),
    },
    ui: {
      editorTabs: ["info", "appearance", "content", "settings"],
      livePreview: true,
    },
    renderConfig: {
      layout: "classic-grid",
      fontClassName: getFontClassName("editorial"),
      accentColor: themeColor,
      sectionOrder: DEFAULT_SECTIONS.map((section) => section.id),
      visibleSections: DEFAULT_SECTIONS.filter((section) => section.visible).map((section) => section.id),
      pitchMode: false,
    },
  };
};

const ensureProfileShape = (
  profile: Partial<WriterProfileJson> | undefined,
  fallback: WriterProfileJson,
  scripts: ScriptRecord[],
  stories: StoryRecord[],
) => {
  const themeColor = normalizeColor(profile?.appearance?.themeColor || fallback.appearance.themeColor);
  const mergedSections = DEFAULT_SECTIONS.map((section) => {
    const existing = profile?.sections?.find((item) => item.id === section.id);
    return { ...section, ...existing, title: SECTION_TITLES[section.id] };
  });
  const projects = buildProjects(scripts, stories, themeColor, profile?.content?.projects || fallback.content.projects);
  const spotlightProjectId = profile?.content?.spotlightProjectId || projects.find((item) => item.featured)?.id || projects[0]?.id || "";
  const featuredProjectIds = (profile?.content?.featuredProjectIds || fallback.content.featuredProjectIds)
    .filter((id) => projects.some((project) => project.id === id))
    .slice(0, 4);
  const fontStyle = profile?.appearance?.fontStyle || fallback.appearance.fontStyle;
  const layoutMode = profile?.appearance?.layoutMode || fallback.appearance.layoutMode;
  const pitchMode = profile?.appearance?.pitchMode ?? fallback.appearance.pitchMode;

  return {
    profile: {
      avatarUrl: profile?.profile?.avatarUrl || fallback.profile.avatarUrl,
      bannerImageUrl: profile?.profile?.bannerImageUrl || fallback.profile.bannerImageUrl,
      username: profile?.profile?.username || fallback.profile.username,
      displayName: profile?.profile?.displayName || fallback.profile.displayName,
      bioRichText: profile?.profile?.bioRichText || fallback.profile.bioRichText,
      genres: profile?.profile?.genres?.length ? profile.profile.genres : fallback.profile.genres,
      languages: profile?.profile?.languages?.length ? profile.profile.languages : fallback.profile.languages,
      experienceLevel: profile?.profile?.experienceLevel || fallback.profile.experienceLevel,
      achievements: profile?.profile?.achievements?.length ? profile.profile.achievements : fallback.profile.achievements,
      writingStyleTags: profile?.profile?.writingStyleTags?.length ? profile.profile.writingStyleTags : fallback.profile.writingStyleTags,
      contactEmail: profile?.profile?.contactEmail || fallback.profile.contactEmail,
    },
    content: { projects, featuredProjectIds, spotlightProjectId },
    appearance: { themeColor, fontStyle, layoutMode, pitchMode },
    sections: mergedSections,
    privacy: {
      profileVisibility: profile?.privacy?.profileVisibility || fallback.privacy.profileVisibility,
      showContactInfo: profile?.privacy?.showContactInfo ?? fallback.privacy.showContactInfo,
      collaborationOpen: profile?.privacy?.collaborationOpen ?? fallback.privacy.collaborationOpen,
    },
    ai: {
      bioOptimized: profile?.ai?.bioOptimized ?? fallback.ai.bioOptimized,
      suggestedLayout: profile?.ai?.suggestedLayout || fallback.ai.suggestedLayout,
      autoGenreTaggingRun: profile?.ai?.autoGenreTaggingRun ?? fallback.ai.autoGenreTaggingRun,
    },
    stats: {
      stories: stories.length,
      scripts: scripts.length,
      views: scripts.reduce((sum, script) => sum + (script.views || 0), 0),
    },
    ui: fallback.ui,
    renderConfig: {
      layout: layoutMode,
      fontClassName: getFontClassName(fontStyle),
      accentColor: themeColor,
      sectionOrder: mergedSections.map((section) => section.id),
      visibleSections: mergedSections.filter((section) => section.visible).map((section) => section.id),
      pitchMode,
    },
  } satisfies WriterProfileJson;
};

const SectionTitle = ({ icon: Icon, title, subtitle }: { icon: typeof Sparkles; title: string; subtitle: string }) => (
  <div className="mb-4 flex items-start gap-3">
    <div className="rounded-xl border border-border bg-muted/50 p-2">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

const ProjectSection = ({
  title,
  icon,
  projects,
  accentColor,
  layout,
}: {
  title: string;
  icon: React.ReactNode;
  projects: WriterProfileProject[];
  accentColor: string;
  layout: LayoutMode;
}) => (
  <Card className="rounded-3xl border-border/60 p-5">
    <div className="flex items-center gap-2">
      <div style={{ color: accentColor }}>{icon}</div>
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{title}</p>
    </div>
    <div className={cn("mt-5 grid gap-4", layout === "social-feed" ? "grid-cols-1" : "md:grid-cols-2")}>
      {projects.map((project) => (
        <div key={project.id} className="rounded-3xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-16 overflow-hidden rounded-2xl">
              <img src={project.coverImage} alt={project.title} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">{project.title}</h3>
              <Badge className="mt-2 bg-primary/10 text-primary">{project.genre}</Badge>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.logline}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

const WriterProfilePreview = ({ profile }: { profile: WriterProfileJson }) => {
  const projects = profile.content.projects.filter((project) => project.visible);
  const spotlight = projects.find((project) => project.id === profile.content.spotlightProjectId) || projects[0];
  const featured = projects.filter((project) => profile.content.featuredProjectIds.includes(project.id));
  const stories = projects.filter((project) => project.type === "story");
  const scripts = projects.filter((project) => project.type === "script");
  const visibleSectionSet = new Set(profile.renderConfig.visibleSections);
  const pitchMode = profile.renderConfig.pitchMode;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[28px] border bg-card text-card-foreground shadow-[0_24px_70px_rgba(0,0,0,0.18)]",
        profile.renderConfig.fontClassName,
      )}
      style={{ borderColor: `${profile.renderConfig.accentColor}40` }}
    >
      <div
        className={cn(
          "relative overflow-hidden px-6 py-8 text-white",
          profile.renderConfig.layout === "cinematic" && "min-h-[280px]",
          profile.renderConfig.layout === "social-feed" && "min-h-[220px]",
        )}
        style={{
          background: profile.profile.bannerImageUrl
            ? `linear-gradient(180deg, rgba(0,0,0,0.22), rgba(0,0,0,0.75)), url(${profile.profile.bannerImageUrl}) center/cover`
            : `radial-gradient(circle at top left, ${profile.renderConfig.accentColor}, #111827 58%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/15" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-white/50">
              <AvatarImage src={profile.profile.avatarUrl} />
              <AvatarFallback>{profile.profile.displayName.charAt(0) || "W"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/70">@{profile.profile.username}</p>
              <h1 className="mt-2 text-3xl font-bold">{profile.profile.displayName}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.profile.genres.map((genre) => (
                  <Badge key={genre} className="border-white/20 bg-white/10 text-white">{genre}</Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.25em] text-white/65">{pitchMode ? "Pitch Mode On" : "Writer Profile"}</p>
            <p className="mt-2 text-sm text-white/90">
              {pitchMode ? "Portfolio view optimized for industry pitching." : "Customizable live preview."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 bg-background p-6">
        {visibleSectionSet.has("spotlight") && spotlight && (
          <Card
            className={cn(
              "overflow-hidden border-0 text-white",
              profile.renderConfig.layout === "social-feed" ? "rounded-3xl" : "rounded-[26px]",
            )}
            style={{
              background: `linear-gradient(120deg, rgba(17,24,39,0.9), ${profile.renderConfig.accentColor}99), url(${spotlight.coverImage}) center/cover`,
            }}
          >
            <div className="grid gap-5 p-6 md:grid-cols-[180px_1fr] md:items-end">
              <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <img src={spotlight.coverImage} alt={spotlight.title} className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/70">Featured Project Spotlight</p>
                <h2 className="mt-3 text-3xl font-bold">{spotlight.title}</h2>
                <Badge className="mt-3 border-white/20 bg-white/10 text-white">{spotlight.genre}</Badge>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/90">{spotlight.logline}</p>
              </div>
            </div>
          </Card>
        )}

        <div
          className={cn(
            "grid gap-5",
            profile.renderConfig.layout === "classic-grid" && "md:grid-cols-[1.2fr_0.8fr]",
            profile.renderConfig.layout === "cinematic" && "md:grid-cols-1",
            profile.renderConfig.layout === "social-feed" && "md:grid-cols-[0.95fr_1.05fr]",
          )}
        >
          {visibleSectionSet.has("about") && (
            <Card className="rounded-3xl border-border/60 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">About</p>
              <div className="mt-4 text-sm leading-7 text-foreground/90" dangerouslySetInnerHTML={{ __html: renderRichText(profile.profile.bioRichText) }} />
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.profile.languages.map((language) => (
                  <Badge key={language} variant="secondary">{language}</Badge>
                ))}
                <Badge variant="outline" className="capitalize">{profile.profile.experienceLevel}</Badge>
              </div>
            </Card>
          )}

          {visibleSectionSet.has("stats") && (
            <Card className="rounded-3xl border-border/60 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Profile Statistics</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: "Stories", value: profile.stats.stories },
                  { label: "Scripts", value: profile.stats.scripts },
                  { label: "Views", value: profile.stats.views },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border p-4 text-center" style={{ borderColor: `${profile.renderConfig.accentColor}33` }}>
                    <p className="text-2xl font-bold" style={{ color: profile.renderConfig.accentColor }}>{stat.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
              {profile.privacy.collaborationOpen && (
                <div className="mt-4 rounded-2xl bg-muted/40 p-3 text-sm text-muted-foreground">Open to collaboration</div>
              )}
            </Card>
          )}
        </div>

        {visibleSectionSet.has("featured") && featured.length > 0 && (
          <Card className="rounded-3xl border-border/60 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Featured Projects</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featured.map((project) => (
                <div key={project.id} className="overflow-hidden rounded-3xl border bg-card">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={project.coverImage} alt={project.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{project.title}</h3>
                      <Badge variant="outline">{project.type}</Badge>
                    </div>
                    <Badge className="bg-primary/10 text-primary">{project.genre}</Badge>
                    <p className="text-sm text-muted-foreground">{project.logline}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {visibleSectionSet.has("stories") && stories.length > 0 && (
          <ProjectSection title="Stories" icon={<BookOpen className="h-4 w-4" />} projects={stories} accentColor={profile.renderConfig.accentColor} layout={profile.renderConfig.layout} />
        )}

        {visibleSectionSet.has("scripts") && scripts.length > 0 && (
          <ProjectSection title="Scripts" icon={<Film className="h-4 w-4" />} projects={scripts} accentColor={profile.renderConfig.accentColor} layout={profile.renderConfig.layout} />
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {visibleSectionSet.has("achievements") && (
            <Card className="rounded-3xl border-border/60 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Achievements</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.profile.achievements.map((achievement) => (
                  <Badge key={achievement} className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
                    <Award className="mr-1.5 h-3.5 w-3.5" />
                    {achievement}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {visibleSectionSet.has("tags") && (
            <Card className="rounded-3xl border-border/60 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Writing Style Tags</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.profile.writingStyleTags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
              {profile.privacy.showContactInfo && (
                <p className="mt-4 text-sm text-muted-foreground">Contact: {profile.profile.contactEmail}</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const WriterProfileStudio = ({
  profileId,
  initialName,
  initialBio,
  initialAvatarUrl,
  initialPreferences,
}: WriterProfileStudioProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [profileJson, setProfileJson] = useState<WriterProfileJson | null>(null);
  const [activeTab, setActiveTab] = useState("info");
  const [draggingSectionId, setDraggingSectionId] = useState<SectionId | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await mongodbClient.auth.getUser();
      const scriptsResponse = await mongodbClient.scripts.listMine();
      const storiesResponse = await mongodbClient
        .from("stories")
        .select("*")
        .eq("user_id", profileId)
        .order("updated_at", { ascending: false });

      const scripts = scriptsResponse.data || [];
      const stories = (storiesResponse.data || []) as StoryRecord[];
      const baseProfile = createDefaultProfile(
        initialName,
        initialBio,
        initialAvatarUrl,
        user?.email || "writer@pitchroom.app",
        scripts,
        stories,
      );
      const existing = (initialPreferences?.writer_profile || undefined) as Partial<WriterProfileJson> | undefined;
      const ensured = ensureProfileShape(existing, baseProfile, scripts, stories);
      setProfileJson(ensured);
      setLoading(false);
    };

    void load();
  }, [initialAvatarUrl, initialBio, initialName, initialPreferences, profileId]);

  const profileData = profileJson;

  const updateProfile = (updater: (current: WriterProfileJson) => WriterProfileJson) => {
    setProfileJson((current) => {
      if (!current) return current;
      return updater(current);
    });
  };

  const updateSections = (sections: WriterProfileSection[]) => {
    updateProfile((current) => ({
      ...current,
      sections,
      renderConfig: {
        ...current.renderConfig,
        sectionOrder: sections.map((section) => section.id),
        visibleSections: sections.filter((section) => section.visible).map((section) => section.id),
      },
    }));
  };

  const handleSave = async () => {
    if (!profileJson) return;
    setSaving(true);
    const mergedPreferences = {
      ...(initialPreferences || {}),
      writer_profile: profileJson,
    };

    const { error } = await mongodbClient
      .from("profiles")
      .update({
        name: profileJson.profile.displayName,
        bio: profileJson.profile.bioRichText,
        avatar_url: profileJson.profile.avatarUrl,
        preferences: mergedPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Save failed", description: error.message || "Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Writer profile updated", description: "Your portfolio changes are now live in the preview." });
      setEditorOpen(false);
    }
    setSaving(false);
  };

  const handleImageUpload = async (file: File, kind: "avatar" | "banner") => {
    if (!profileJson) return;
    const extension = file.name.split(".").pop() || "png";
    const storagePath = `${profileId}/${kind}-${Date.now()}.${extension}`;
    const { data, error } = await mongodbClient.storage.from("scripts").upload(storagePath, file, { upsert: true });
    if (error || !data) {
      toast({ title: "Upload failed", description: error?.message || "Could not upload image.", variant: "destructive" });
      return;
    }
    const { data: publicUrlData } = mongodbClient.storage.from("scripts").getPublicUrl(data.path);
    updateProfile((current) => ({
      ...current,
      profile: {
        ...current.profile,
        avatarUrl: kind === "avatar" ? publicUrlData.publicUrl : current.profile.avatarUrl,
        bannerImageUrl: kind === "banner" ? publicUrlData.publicUrl : current.profile.bannerImageUrl,
      },
    }));
  };

  const handleSectionDrop = (targetId: SectionId) => {
    if (!profileData || !draggingSectionId || draggingSectionId === targetId) return;
    const reordered = [...profileData.sections];
    const sourceIndex = reordered.findIndex((section) => section.id === draggingSectionId);
    const targetIndex = reordered.findIndex((section) => section.id === targetId);
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    updateSections(reordered);
    setDraggingSectionId(null);
  };

  if (loading || !profileData) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="glass p-10 text-center text-muted-foreground">Loading writer profile studio...</Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary/70">PitchRoom Writer Profile</p>
            <h1 className="mt-2 text-3xl font-bold">Customizable writer portfolio</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Shape your profile, reorder sections with drag and drop, and switch to Pitch Mode for a producer-ready showcase that feels native to PitchRoom.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setEditorOpen(true)}>
              <PenSquare className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Portfolio"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <WriterProfilePreview profile={profileData} />
          <div className="space-y-6">
            <Card className="rounded-3xl p-5">
              <SectionTitle icon={Sparkles} title="Portfolio Tone" subtitle="A quick summary of how your profile is presenting right now." />
              <div className="grid gap-3">
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Headline</p>
                  <p className="mt-2 text-lg font-semibold">{profileData.profile.displayName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">@{profileData.profile.username}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Creative Focus</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profileData.profile.genres.map((genre) => (
                      <Badge key={genre} variant="secondary">{genre}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Style Tags</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profileData.profile.writingStyleTags.map((tag) => (
                      <Badge key={tag} className="bg-primary/10 text-primary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="rounded-3xl p-5">
              <SectionTitle icon={Lightbulb} title="Quick Signals" subtitle="At-a-glance profile readiness for pitching." />
              <div className="grid gap-3">
                {[
                  `Layout: ${profileData.appearance.layoutMode}`,
                  `Pitch Mode: ${profileData.appearance.pitchMode ? "enabled" : "disabled"}`,
                  `Featured Projects: ${profileData.content.featuredProjectIds.length}`,
                  `Visible Sections: ${profileData.renderConfig.visibleSections.length}`,
                ].map((item) => (
                  <div key={item} className="rounded-2xl border bg-muted/30 px-4 py-3 text-sm">{item}</div>
                ))}
              </div>
            </Card>

            <Card className="rounded-3xl p-5">
              <SectionTitle icon={Palette} title="Visual Direction" subtitle="Current appearance settings that shape the public profile." />
              <div className="grid gap-4">
                <div className="flex items-center gap-4 rounded-2xl border p-4">
                  <div className="h-12 w-12 rounded-2xl border" style={{ backgroundColor: profileData.appearance.themeColor }} />
                  <div>
                    <p className="font-medium">Accent Color</p>
                    <p className="text-sm text-muted-foreground">{profileData.appearance.themeColor}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Layout</p>
                    <p className="mt-2 font-semibold capitalize">{profileData.appearance.layoutMode.replace("-", " ")}</p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Font Mood</p>
                    <p className="mt-2 font-semibold capitalize">{profileData.appearance.fontStyle}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="h-[92vh] max-w-[1400px] overflow-hidden p-0">
          <div className="grid h-full gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <ScrollArea className="h-[92vh] border-r">
              <div className="p-6">
                <DialogHeader>
                  <DialogTitle>Writer Profile Dashboard</DialogTitle>
                  <DialogDescription>
                    Tabs for Info, Appearance, Content, and Settings with a live preview that updates as you edit.
                  </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="info">Info</TabsTrigger>
                    <TabsTrigger value="appearance">Appearance</TabsTrigger>
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="info" className="space-y-6 pt-6">
                    <Card className="rounded-3xl p-5">
                      <SectionTitle icon={PenSquare} title="Identity" subtitle="Core profile details with rich text bio support." />
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Username</Label>
                          <Input value={profileData.profile.username} onChange={(event) => updateProfile((current) => ({ ...current, profile: { ...current.profile, username: event.target.value } }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Display Name</Label>
                          <Input value={profileData.profile.displayName} onChange={(event) => updateProfile((current) => ({ ...current, profile: { ...current.profile, displayName: event.target.value } }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Bio Rich Text</Label>
                          <Textarea rows={7} value={profileData.profile.bioRichText} onChange={(event) => updateProfile((current) => ({ ...current, profile: { ...current.profile, bioRichText: event.target.value } }))} />
                          <p className="text-xs text-muted-foreground">Supports lightweight markdown like `**bold**`, `*italic*`, and `- list`.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="outline"
                            onClick={() => updateProfile((current) => ({
                              ...current,
                              profile: {
                                ...current.profile,
                                bioRichText: improveBioText(current.profile.bioRichText, current.profile.displayName, current.profile.genres, current.profile.writingStyleTags),
                              },
                              ai: { ...current.ai, bioOptimized: true },
                            }))}
                          >
                            <Wand2 className="mr-2 h-4 w-4" />
                            Improve Bio
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => updateProfile((current) => ({
                              ...current,
                              profile: { ...current.profile, genres: generateGenreTags(current.content.projects) },
                              ai: { ...current.ai, autoGenreTaggingRun: true },
                            }))}
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Auto Genre Tagging
                          </Button>
                        </div>
                      </div>
                    </Card>

                    <Card className="rounded-3xl p-5">
                      <SectionTitle icon={Languages} title="Creative Metadata" subtitle="Genres, languages, experience level, achievements, and style tags." />
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Genres</Label>
                          <Input value={profileData.profile.genres.join(", ")} onChange={(event) => updateProfile((current) => ({ ...current, profile: { ...current.profile, genres: splitList(event.target.value) } }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Languages</Label>
                          <Input value={profileData.profile.languages.join(", ")} onChange={(event) => updateProfile((current) => ({ ...current, profile: { ...current.profile, languages: splitList(event.target.value) } }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Experience Level</Label>
                          <Select value={profileData.profile.experienceLevel} onValueChange={(value: ExperienceLevel) => updateProfile((current) => ({ ...current, profile: { ...current.profile, experienceLevel: value } }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="emerging">Emerging</SelectItem>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="veteran">Veteran</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Achievements</Label>
                          <Textarea rows={4} value={profileData.profile.achievements.join(", ")} onChange={(event) => updateProfile((current) => ({ ...current, profile: { ...current.profile, achievements: splitList(event.target.value) } }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Writing Style Tags</Label>
                          <Input value={profileData.profile.writingStyleTags.join(", ")} onChange={(event) => updateProfile((current) => ({ ...current, profile: { ...current.profile, writingStyleTags: splitList(event.target.value) } }))} />
                        </div>
                      </div>
                    </Card>
                  </TabsContent>

                  <TabsContent value="appearance" className="space-y-6 pt-6">
                    <Card className="rounded-3xl p-5">
                      <SectionTitle icon={Palette} title="Style Controls" subtitle="Theme, fonts, banner imagery, and layout modes." />
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Theme Color</Label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={profileData.appearance.themeColor}
                              onChange={(event) => updateProfile((current) => ({ ...current, appearance: { ...current.appearance, themeColor: event.target.value }, renderConfig: { ...current.renderConfig, accentColor: event.target.value } }))}
                              className="h-11 w-16 rounded-xl border bg-transparent p-1"
                            />
                            <Input value={profileData.appearance.themeColor} onChange={(event) => updateProfile((current) => ({ ...current, appearance: { ...current.appearance, themeColor: normalizeColor(event.target.value) }, renderConfig: { ...current.renderConfig, accentColor: normalizeColor(event.target.value) } }))} />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Font Style</Label>
                          <Select value={profileData.appearance.fontStyle} onValueChange={(value: FontStyle) => updateProfile((current) => ({ ...current, appearance: { ...current.appearance, fontStyle: value }, renderConfig: { ...current.renderConfig, fontClassName: getFontClassName(value) } }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {FONT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Layout Mode</Label>
                          <Select value={profileData.appearance.layoutMode} onValueChange={(value: LayoutMode) => updateProfile((current) => ({ ...current, appearance: { ...current.appearance, layoutMode: value }, renderConfig: { ...current.renderConfig, layout: value } }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="classic-grid">Classic Grid</SelectItem>
                              <SelectItem value="cinematic">Cinematic</SelectItem>
                              <SelectItem value="social-feed">Social Feed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="outline"
                            onClick={() => updateProfile((current) => {
                              const nextLayout = suggestLayout(current.content.projects, current.profile.writingStyleTags);
                              return {
                                ...current,
                                appearance: { ...current.appearance, layoutMode: nextLayout },
                                ai: { ...current.ai, suggestedLayout: nextLayout },
                                renderConfig: { ...current.renderConfig, layout: nextLayout },
                              };
                            })}
                          >
                            <LayoutGrid className="mr-2 h-4 w-4" />
                            Suggest Layout
                          </Button>
                          <div className="flex items-center gap-3 rounded-2xl border px-4 py-2">
                            <Type className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">Pitch Mode</span>
                            <Switch checked={profileData.appearance.pitchMode} onCheckedChange={(checked) => updateProfile((current) => ({ ...current, appearance: { ...current.appearance, pitchMode: checked }, renderConfig: { ...current.renderConfig, pitchMode: checked } }))} />
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="rounded-3xl p-5">
                      <SectionTitle icon={ImagePlus} title="Images" subtitle="Upload avatar and banner or paste direct image URLs." />
                      <div className="grid gap-4">
                        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImageUpload(file, "avatar"); }} />
                        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImageUpload(file, "banner"); }} />
                        <div className="grid gap-2">
                          <Label>Avatar URL</Label>
                          <Input value={profileData.profile.avatarUrl} onChange={(event) => updateProfile((current) => ({ ...current, profile: { ...current.profile, avatarUrl: event.target.value } }))} />
                        </div>
                        <Button variant="outline" onClick={() => avatarInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Profile Picture
                        </Button>
                        <div className="grid gap-2">
                          <Label>Banner Image URL</Label>
                          <Input value={profileData.profile.bannerImageUrl} onChange={(event) => updateProfile((current) => ({ ...current, profile: { ...current.profile, bannerImageUrl: event.target.value } }))} />
                        </div>
                        <Button variant="outline" onClick={() => bannerInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Banner Image
                        </Button>
                      </div>
                    </Card>
                  </TabsContent>
                  <TabsContent value="content" className="space-y-6 pt-6">
                    <Card className="rounded-3xl p-5">
                      <SectionTitle icon={Film} title="Project Display" subtitle="Stories, scripts, featured picks, pinned content, and spotlight controls." />
                      <div className="space-y-4">
                        {profileData.content.projects.map((project) => (
                          <div key={project.id} className="rounded-3xl border p-4">
                            <div className="grid gap-4 lg:grid-cols-[120px_1fr]">
                              <div className="overflow-hidden rounded-2xl border">
                                <img src={project.coverImage} alt={project.title} className="h-full w-full object-cover" />
                              </div>
                              <div className="grid gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">{project.type}</Badge>
                                  {project.featured && <Badge className="bg-primary/10 text-primary">Featured</Badge>}
                                  {project.pinned && <Badge className="bg-amber-500/10 text-amber-600">Pinned</Badge>}
                                </div>
                                <Input value={project.title} onChange={(event) => updateProfile((current) => ({ ...current, content: { ...current.content, projects: current.content.projects.map((item) => item.id === project.id ? { ...item, title: event.target.value } : item) } }))} />
                                <Input value={project.genre} onChange={(event) => updateProfile((current) => ({ ...current, content: { ...current.content, projects: current.content.projects.map((item) => item.id === project.id ? { ...item, genre: event.target.value } : item) } }))} />
                                <Textarea rows={3} value={project.logline} onChange={(event) => updateProfile((current) => ({ ...current, content: { ...current.content, projects: current.content.projects.map((item) => item.id === project.id ? { ...item, logline: event.target.value } : item) } }))} />
                                <Input value={project.coverImage} onChange={(event) => updateProfile((current) => ({ ...current, content: { ...current.content, projects: current.content.projects.map((item) => item.id === project.id ? { ...item, coverImage: event.target.value } : item) } }))} />
                                <div className="flex flex-wrap gap-3">
                                  <Button size="sm" variant={project.pinned ? "default" : "outline"} onClick={() => updateProfile((current) => ({ ...current, content: { ...current.content, projects: current.content.projects.map((item) => item.id === project.id ? { ...item, pinned: !item.pinned } : item) } }))}>
                                    <Star className="mr-2 h-4 w-4" />
                                    {project.pinned ? "Pinned" : "Pin Project"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={project.featured ? "default" : "outline"}
                                    onClick={() => updateProfile((current) => {
                                      const nextProjects = current.content.projects.map((item) => item.id === project.id ? { ...item, featured: !item.featured } : item);
                                      const featuredIds = nextProjects.filter((item) => item.featured).slice(0, 4).map((item) => item.id);
                                      return { ...current, content: { ...current.content, projects: nextProjects, featuredProjectIds: featuredIds } };
                                    })}
                                  >
                                    <Check className="mr-2 h-4 w-4" />
                                    {project.featured ? "Featured" : "Feature Project"}
                                  </Button>
                                  <Button size="sm" variant={profileData.content.spotlightProjectId === project.id ? "default" : "outline"} onClick={() => updateProfile((current) => ({ ...current, content: { ...current.content, spotlightProjectId: project.id } }))}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Spotlight
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => updateProfile((current) => ({ ...current, content: { ...current.content, projects: current.content.projects.map((item) => item.id === project.id ? { ...item, visible: !item.visible } : item) } }))}>
                                    {project.visible ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                                    {project.visible ? "Visible" : "Hidden"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-6 pt-6">
                    <Card className="rounded-3xl p-5">
                      <SectionTitle icon={Eye} title="Privacy Settings" subtitle="Public/private state, contact visibility, and collaboration controls." />
                      <div className="grid gap-4">
                        <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
                          <div>
                            <p className="font-medium">Public profile</p>
                            <p className="text-sm text-muted-foreground">Switch between public and private profile visibility.</p>
                          </div>
                          <Switch checked={profileData.privacy.profileVisibility === "public"} onCheckedChange={(checked) => updateProfile((current) => ({ ...current, privacy: { ...current.privacy, profileVisibility: checked ? "public" : "private" } }))} />
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
                          <div>
                            <p className="font-medium">Show contact info</p>
                            <p className="text-sm text-muted-foreground">Display the email on the public profile.</p>
                          </div>
                          <Switch checked={profileData.privacy.showContactInfo} onCheckedChange={(checked) => updateProfile((current) => ({ ...current, privacy: { ...current.privacy, showContactInfo: checked } }))} />
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
                          <div>
                            <p className="font-medium">Collaboration open</p>
                            <p className="text-sm text-muted-foreground">Show collaborators that you are open to opportunities.</p>
                          </div>
                          <Switch checked={profileData.privacy.collaborationOpen} onCheckedChange={(checked) => updateProfile((current) => ({ ...current, privacy: { ...current.privacy, collaborationOpen: checked } }))} />
                        </div>
                      </div>
                    </Card>

                    <Card className="rounded-3xl p-5">
                      <SectionTitle icon={GripVertical} title="Section Control" subtitle="Drag and drop to reorder sections or toggle visibility." />
                      <div className="space-y-3">
                        {profileData.sections.map((section) => (
                          <div
                            key={section.id}
                            draggable
                            onDragStart={() => setDraggingSectionId(section.id)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => handleSectionDrop(section.id)}
                            className="flex items-center justify-between rounded-2xl border bg-background px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{section.title}</p>
                                <p className="text-xs text-muted-foreground">{section.id}</p>
                              </div>
                            </div>
                            <Switch checked={section.visible} onCheckedChange={(checked) => updateSections(profileData.sections.map((item) => item.id === section.id ? { ...item, visible: checked } : item))} />
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="rounded-3xl p-5">
                      <SectionTitle icon={Sparkles} title="Profile Readiness" subtitle="A simple check before you publish or pitch." />
                      <div className="space-y-3">
                        {[
                          {
                            label: "Featured spotlight selected",
                            ok: Boolean(profileData.content.spotlightProjectId),
                          },
                          {
                            label: "At least one featured project",
                            ok: profileData.content.featuredProjectIds.length > 0,
                          },
                          {
                            label: "Bio written",
                            ok: Boolean(profileData.profile.bioRichText.trim()),
                          },
                          {
                            label: "Genres added",
                            ok: profileData.profile.genres.length > 0,
                          },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                            <span className="text-sm">{item.label}</span>
                            <Badge variant={item.ok ? "default" : "secondary"}>{item.ok ? "Ready" : "Needs work"}</Badge>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="mt-6 flex gap-3">
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Profile"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditorOpen(false)}>Close</Button>
                </div>
              </div>
            </ScrollArea>

            <div className="h-[92vh] overflow-auto bg-muted/20 p-6">
              <p className="mb-4 text-xs uppercase tracking-[0.35em] text-muted-foreground">Live Preview</p>
              <WriterProfilePreview profile={profileData} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WriterProfileStudio;
