import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { mongodbClient } from "@/lib/mongodb/client";
import { trackEvent } from "@/lib/analytics";
import WriterLayout from "./WriterLayout";
import {
  buildStoryManagementPrompt,
  extractStoryManagementResponse,
  legacyStoryToManagedStory,
  storyToLegacyFields,
  type StoryEditMode,
  type StorySection,
} from "@/lib/ai/story-management";
import {
  BookOpen, Plus, Search, Edit3, Trash2, Calendar, FileText,
  Lightbulb, Target, Users, Sparkles, MoreVertical, Clock, Star, Loader2, Clapperboard,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Story {
  id: string;
  title: string;
  logline: string;
  genre: string;
  status: "idea" | "outline" | "treatment" | "draft" | "complete";
  characters: string[];
  themes: string[];
  notes: string;
  created_at: string;
  updated_at: string;
  starred: boolean;
  convertedScriptId?: string;
  sections?: StorySection[];
  version?: number;
  story_version_history?: Array<Record<string, unknown>>;
  script_outdated?: boolean;
}

const GENRES = [
  "Action", "Comedy", "Drama", "Horror", "Thriller",
  "Sci-Fi", "Romance", "Mystery", "Fantasy", "Documentary"
];

const STATUS_COLORS: Record<string, string> = {
  idea: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  outline: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  treatment: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  draft: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  complete: "bg-green-500/20 text-green-400 border-green-500/30",
};

const Stories = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGenre, setFilterGenre] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiEditing, setAiEditing] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [editMode, setEditMode] = useState<StoryEditMode>("partial_add");
  const [editInstruction, setEditInstruction] = useState("");
  const [editStory, setEditStory] = useState({
    title: "", logline: "", genre: "", notes: "", tags: "", status: "idea", sections: "",
  });
  const [newStory, setNewStory] = useState({
    title: "", logline: "", genre: "", notes: "", characters: "", themes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    void loadStories();
  }, []);

  const loadStories = async () => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) {
      setStories([]);
      setLoading(false);
      return;
    }

    const result = await mongodbClient
      .from("stories")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    const { data, error } = result as { data: Story[] | null; error: { message?: string } | null };

    if (!error && data) {
      setStories(data as unknown as Story[]);
    }
    setLoading(false);
  };

  const handleCreateStory = async () => {
    if (!newStory.title.trim()) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) {
      setSaving(false);
      toast({ title: "Error", description: "Please log in again", variant: "destructive" });
      return;
    }

    const insertResult = await mongodbClient.from("stories").insert({
      user_id: user.id,
      title: newStory.title,
      logline: newStory.logline,
      genre: newStory.genre || "Drama",
      status: "idea",
      characters: newStory.characters.split(",").map(c => c.trim()).filter(Boolean),
      themes: newStory.themes.split(",").map(t => t.trim()).filter(Boolean),
      notes: newStory.notes,
      sections: [],
      version: 1,
      story_version_history: [],
      script_outdated: false,
      starred: false,
    });

    const { error } = insertResult as { error: { message?: string } | null };

    if (error) {
      toast({ title: "Error", description: "Failed to create story", variant: "destructive" });
    } else {
      const insertedStory = Array.isArray((insertResult as { data?: Story[] | null }).data)
        ? (insertResult as { data?: Story[] | null }).data?.[0]
        : null;
      await trackEvent({
        event_type: "STORY_CREATED",
        story_id: insertedStory?.id || null,
        metadata: {
          story_owner_id: user.id,
          story_title: newStory.title,
          genre: newStory.genre || "Drama",
        },
      });
      toast({ title: "Story created!", description: `"${newStory.title}" has been added.` });
      setNewStory({ title: "", logline: "", genre: "", notes: "", characters: "", themes: "" });
      setIsCreateOpen(false);
      void loadStories();
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const updateResult = await mongodbClient.from("stories").update({ status }).eq("_id", id);
    const { error } = updateResult as { error: { message?: string } | null };
    if (!error) {
      setStories(stories.map(s => s.id === id ? { ...s, status: status as Story["status"] } : s));
      toast({ title: "Status updated" });
    }
  };

  const handleToggleStar = async (id: string) => {
    const story = stories.find(s => s.id === id);
    if (!story) return;
    const starResult = await mongodbClient.from("stories").update({ starred: !story.starred }).eq("_id", id);
    const { error } = starResult as { error: { message?: string } | null };
    if (!error) {
      setStories(stories.map(s => s.id === id ? { ...s, starred: !s.starred } : s));
    }
  };

  const handleDeleteStory = async (id: string) => {
    const deleteResult = await mongodbClient.from("stories").delete().eq("_id", id);
    const { error } = deleteResult as { error: { message?: string } | null };
    if (!error) {
      setStories(stories.filter(s => s.id !== id));
      toast({ title: "Story deleted" });
    }
  };

  const openEditDialog = (story: Story) => {
    setSelectedStory(story);
    setEditMode("partial_add");
    setEditInstruction("");
    setEditStory({
      title: story.title || "",
      logline: story.logline || "",
      genre: story.genre || "Drama",
      notes: story.notes || "",
      tags: (story.themes || []).join(", "),
      status: ["idea", "draft", "treatment"].includes(story.status) ? story.status : "idea",
      sections: JSON.stringify(story.sections || [], null, 2),
    });
    setIsEditOpen(true);
  };

  const parseSectionsInput = (value: string) => {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return null;
    }
  };

  const applyStoryUpdate = async (
    story: Story,
    nextStory: ReturnType<typeof legacyStoryToManagedStory>,
    message: string,
    scriptOutdated: boolean,
  ) => {
    const history = [
      ...(story.story_version_history || []),
      {
        version: story.version || 1,
        saved_at: new Date().toISOString(),
        snapshot: {
          title: story.title,
          genre: story.genre,
          logline: story.logline,
          status: story.status,
          content: story.notes,
          tags: story.themes || [],
          sections: story.sections || [],
        },
      },
    ];

    const payload = {
      ...storyToLegacyFields(nextStory),
      sections: nextStory.sections,
      version: nextStory.version,
      story_version_history: history,
      script_outdated: scriptOutdated,
      updated_at: new Date().toISOString(),
    };

    const updateResult = await mongodbClient.from("stories").update(payload).eq("_id", story.id);
    const { error } = updateResult as { error: { message?: string } | null };
    if (error) {
      toast({ title: "Update failed", description: error.message || "Could not update story.", variant: "destructive" });
      return false;
    }

    const nextStatus = (nextStory.status === "treatment" ? "treatment" : nextStory.status) as Story["status"];
    const updatedCard: Story = {
      ...story,
      title: nextStory.title,
      genre: nextStory.genre,
      logline: nextStory.logline,
      notes: nextStory.content,
      themes: nextStory.tags,
      status: nextStatus,
      sections: nextStory.sections,
      version: nextStory.version,
      story_version_history: history,
      script_outdated: scriptOutdated,
      updated_at: payload.updated_at,
    };

    setStories((current) => current.map((item) => item.id === story.id ? updatedCard : item));
    setSelectedStory(updatedCard);
    toast({ title: "Story updated", description: message });
    setIsEditOpen(false);
    return true;
  };

  const handleManualSave = async () => {
    if (!selectedStory) return;
    const parsedSections = parseSectionsInput(editStory.sections);
    if (parsedSections === null) {
      toast({ title: "Invalid sections", description: "Sections must be a valid JSON array.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const managedStory = legacyStoryToManagedStory({
      title: editStory.title,
      genre: editStory.genre,
      logline: editStory.logline,
      status: editStory.status,
      notes: editStory.notes,
      themes: editStory.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      sections: parsedSections,
      version: (selectedStory.version || 1) + 1,
    });

    await applyStoryUpdate(
      selectedStory,
      managedStory,
      selectedStory.convertedScriptId
        ? "Story has been updated. Regenerate screenplay to reflect changes."
        : "Story updated successfully.",
      Boolean(selectedStory.convertedScriptId),
    );
    setSaving(false);
  };

  const handleAiAssist = async () => {
    if (!selectedStory || !editInstruction.trim()) {
      toast({ title: "Update request required", description: "Describe the change you want AI to make.", variant: "destructive" });
      return;
    }

    const parsedSections = parseSectionsInput(editStory.sections);
    if (parsedSections === null) {
      toast({ title: "Invalid sections", description: "Sections must be a valid JSON array.", variant: "destructive" });
      return;
    }

    setAiEditing(true);
    try {
      const baseStory = legacyStoryToManagedStory({
        title: editStory.title,
        genre: editStory.genre,
        logline: editStory.logline,
        status: editStory.status,
        notes: editStory.notes,
        themes: editStory.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        sections: parsedSections,
        version: selectedStory.version || 1,
      });

      const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action: "expand_story",
          content: buildStoryManagementPrompt({
            mode: editMode,
            story: baseStory,
            updateInstruction: editInstruction,
            hasLinkedScript: Boolean(selectedStory.convertedScriptId),
          }),
          context: "Return valid JSON only for PitchRoom story editing. No markdown fences or commentary.",
        },
      });

      if (error) throw new Error(error.message || "AI story editing failed");
      const content = String(data?.result || data?.content || "").trim();
      if (!content) throw new Error("AI returned an empty story update.");

      const response = extractStoryManagementResponse(content, baseStory, Boolean(selectedStory.convertedScriptId));
      setEditStory({
        title: response.updated_story.title,
        genre: response.updated_story.genre,
        logline: response.updated_story.logline,
        notes: response.updated_story.content,
        tags: response.updated_story.tags.join(", "),
        status: response.updated_story.status,
        sections: JSON.stringify(response.updated_story.sections, null, 2),
      });

      await applyStoryUpdate(selectedStory, response.updated_story, response.message, response.script_outdated);
    } catch (error) {
      toast({
        title: "AI edit failed",
        description: error instanceof Error ? error.message : "Could not update story with AI.",
        variant: "destructive",
      });
    } finally {
      setAiEditing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "idea": return <Lightbulb className="w-4 h-4" />;
      case "outline": return <FileText className="w-4 h-4" />;
      case "treatment": return <Target className="w-4 h-4" />;
      case "draft": return <Edit3 className="w-4 h-4" />;
      case "complete": return <Star className="w-4 h-4" />;
      default: return null;
    }
  };

  const filteredStories = stories.filter(story => {
    const matchesSearch = story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.logline.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || story.status === filterStatus;
    const matchesGenre = filterGenre === "all" || story.genre === filterGenre;
    return matchesSearch && matchesStatus && matchesGenre;
  });

  return (
    <WriterLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">My Stories</h1>
            <p className="text-muted-foreground">Manage your story ideas, outlines, and treatments</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />New Story</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />Create New Story
                </DialogTitle>
                <DialogDescription>Start with a spark of an idea.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="Working title" value={newStory.title}
                    onChange={e => setNewStory({ ...newStory, title: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="logline">Logline</Label>
                  <Textarea id="logline" placeholder="A one-sentence summary..." value={newStory.logline}
                    onChange={e => setNewStory({ ...newStory, logline: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Genre</Label>
                    <Select value={newStory.genre} onValueChange={v => setNewStory({ ...newStory, genre: v })}>
                      <SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger>
                      <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Characters (comma-separated)</Label>
                    <Input placeholder="e.g., John, Sarah" value={newStory.characters}
                      onChange={e => setNewStory({ ...newStory, characters: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Themes (comma-separated)</Label>
                  <Input placeholder="e.g., Love, Redemption" value={newStory.themes}
                    onChange={e => setNewStory({ ...newStory, themes: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Initial thoughts..." value={newStory.notes}
                    onChange={e => setNewStory({ ...newStory, notes: e.target.value })} className="min-h-[100px]" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateStory} disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Create Story"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search stories..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="idea">Idea</SelectItem>
              <SelectItem value="outline">Outline</SelectItem>
              <SelectItem value="treatment">Treatment</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterGenre} onValueChange={setFilterGenre}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Genre" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Ideas", count: stories.filter(s => s.status === "idea").length, color: "text-blue-400" },
            { label: "Outlines", count: stories.filter(s => s.status === "outline").length, color: "text-purple-400" },
            { label: "Treatments", count: stories.filter(s => s.status === "treatment").length, color: "text-amber-400" },
            { label: "Drafts", count: stories.filter(s => s.status === "draft").length, color: "text-emerald-400" },
            { label: "Complete", count: stories.filter(s => s.status === "complete").length, color: "text-green-400" },
          ].map(stat => (
            <Card key={stat.label} className="glass p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </Card>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {stories.length === 0 ? "No stories yet" : "No matching stories"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {stories.length === 0 ? "Create your first story idea to get started." : "Try adjusting your filters."}
            </p>
            {stories.length === 0 && (
              <Button onClick={() => setIsCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />New Story</Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredStories.map(story => (
              <Card key={story.id} className="glass glass-hover p-6 relative group">
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStar(story.id)}
                    type="button"
                    title={story.starred ? "Unstar story" : "Star story"}
                    aria-label={story.starred ? "Unstar story" : "Star story"}
                    className={`p-1 rounded-full transition-colors ${story.starred ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}>
                    <Star className={`w-4 h-4 ${story.starred ? "fill-current" : ""}`} />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(story)}>
                        <Edit3 className="w-4 h-4 mr-2" /> Edit Story
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteStory(story.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-4">
                  <div>
                    <Badge variant="outline" className="mb-2">{story.genre}</Badge>
                    <h3 className="text-xl font-semibold mb-2">{story.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{story.logline}</p>
                    {story.script_outdated && (
                      <p className="mt-2 text-xs font-medium text-amber-500">Screenplay outdated. Regenerate screenplay to sync changes.</p>
                    )}
                  </div>
                  <Badge className={`${STATUS_COLORS[story.status] || ""} border`}>
                    {getStatusIcon(story.status)}
                    <span className="ml-1 capitalize">{story.status}</span>
                  </Badge>
                  {story.characters && story.characters.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{story.characters.slice(0, 3).join(", ")}</span>
                    </div>
                  )}
                  {story.themes && story.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {story.themes.map(theme => (
                        <Badge key={theme} variant="secondary" className="text-xs">{theme}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(story.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Updated {new Date(story.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Select value={story.status} onValueChange={v => handleUpdateStatus(story.id, v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idea">Move to Idea</SelectItem>
                      <SelectItem value="outline">Move to Outline</SelectItem>
                      <SelectItem value="treatment">Move to Treatment</SelectItem>
                      <SelectItem value="draft">Move to Draft</SelectItem>
                      <SelectItem value="complete">Mark Complete</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant={story.convertedScriptId ? "outline" : "default"}
                    className="w-full"
                    onClick={() => navigate(
                      story.convertedScriptId
                        ? `/writer/scripts/${story.convertedScriptId}`
                        : `/ai-studio?mode=story-to-script&storyId=${story.id}`,
                    )}
                  >
                    <Clapperboard className="w-4 h-4 mr-2" />
                    {story.convertedScriptId ? "View Script" : "Convert to Script"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
            <DialogHeader className="border-b border-border/50 px-6 py-4">
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" />
                Edit Story
              </DialogTitle>
              <DialogDescription>
                Update story content safely, preserve existing material, and use AI to merge changes intelligently.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input value={editStory.title} onChange={e => setEditStory({ ...editStory, title: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Genre</Label>
                  <Input value={editStory.genre} onChange={e => setEditStory({ ...editStory, genre: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Logline</Label>
                  <Textarea rows={3} value={editStory.logline} onChange={e => setEditStory({ ...editStory, logline: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Tags</Label>
                  <Input value={editStory.tags} onChange={e => setEditStory({ ...editStory, tags: e.target.value })} placeholder="comma-separated tags" />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={editStory.status} onValueChange={value => setEditStory({ ...editStory, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idea">Idea</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="treatment">Treatment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Story Content</Label>
                  <Textarea value={editStory.notes} onChange={e => setEditStory({ ...editStory, notes: e.target.value })} className="min-h-[220px]" />
                </div>
                <div className="grid gap-2">
                  <Label>Sections JSON</Label>
                  <Textarea value={editStory.sections} onChange={e => setEditStory({ ...editStory, sections: e.target.value })} className="min-h-[160px] font-mono text-xs" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <h4 className="font-medium">Story Management AI</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Non-destructive editing with full edit, partial add, and structured update modes.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Edit Mode</Label>
                  <Select value={editMode} onValueChange={(value: StoryEditMode) => setEditMode(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_edit">Full Edit</SelectItem>
                      <SelectItem value="partial_add">Partial Add</SelectItem>
                      <SelectItem value="structured_update">Structured Update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Update Request</Label>
                  <Textarea
                    value={editInstruction}
                    onChange={e => setEditInstruction(e.target.value)}
                    className="min-h-[180px]"
                    placeholder="Add a new scene, deepen the protagonist motivation, refine the logline, add backstory, update the tags..."
                  />
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Version on save: {(selectedStory?.version || 1) + 1}. Previous versions are preserved internally before updates.
                </div>
                {selectedStory?.convertedScriptId && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                    This story already has a screenplay. Updating it will mark the script as outdated and recommend regeneration.
                  </div>
                )}
              </div>
            </div>
            </div>
            <DialogFooter className="sticky bottom-0 border-t border-border/50 bg-background px-6 py-4 sm:justify-end">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button variant="outline" onClick={handleAiAssist} disabled={aiEditing || saving}>
                {aiEditing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                AI Update
              </Button>
              <Button onClick={handleManualSave} disabled={saving || aiEditing}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Edit3 className="w-4 h-4 mr-2" />}
                Save Story
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </WriterLayout>
  );
};

export default Stories;
