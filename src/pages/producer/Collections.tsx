import { useState, useEffect } from "react";
import ProducerLayout from "./ProducerLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, Trash2, Edit2, Tag, Share2, Filter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Collection {
  id: string;
  script_id: string;
  notes: string | null;
  tags: string[];
  category: string | null;
  priority: string;
  created_at: string;
  script_title: string;
  script_logline: string | null;
  script_genre: string | null;
  writer_name: string;
}

const Collections = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editCategory, setEditCategory] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [newTag, setNewTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [shareEmail, setShareEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => { fetchCollections(); }, []);
  useEffect(() => { applyFilters(); }, [collections, searchQuery, filterCategory, filterPriority, sortBy]);

  const fetchCollections = async () => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;

    const { data, error } = await mongodbClient
      .from("collections")
      .select("id, script_id, notes, tags, category, priority, created_at")
      .eq("producer_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) return;

    // Enrich with script and writer info
    const scriptIds = data.map((c) => c.script_id);
    const { data: scripts } = await mongodbClient
      .from("scripts")
      .select("id, title, logline, genre, writer_id")
      .in("id", scriptIds);

    const writerIds = [...new Set(scripts?.map((s) => s.writer_id) || [])];
    const { data: profiles } = await mongodbClient
      .from("profiles")
      .select("id, name")
      .in("id", writerIds);

    const scriptMap = new Map(scripts?.map((s) => [s.id, s]) || []);
    const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);

    const enriched: Collection[] = data.map((item) => {
      const script = scriptMap.get(item.script_id);
      return {
        ...item,
        tags: item.tags || [],
        priority: item.priority || "medium",
        script_title: script?.title || "Unknown",
        script_logline: script?.logline || null,
        script_genre: script?.genre || null,
        writer_name: script ? (profileMap.get(script.writer_id) || "Unknown") : "Unknown",
      };
    });

    setCollections(enriched);
  };

  const applyFilters = () => {
    let filtered = [...collections];
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.script_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    if (filterCategory !== "all") filtered = filtered.filter((item) => item.category === filterCategory);
    if (filterPriority !== "all") filtered = filtered.filter((item) => item.priority === filterPriority);
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "title": return a.script_title.localeCompare(b.script_title);
        case "priority":
          const po = { high: 3, medium: 2, low: 1 };
          return (po[b.priority as keyof typeof po] || 0) - (po[a.priority as keyof typeof po] || 0);
        default: return 0;
      }
    });
    setFilteredCollections(filtered);
  };

  const removeFromCollection = async (collectionId: string) => {
    const { error } = await mongodbClient.from("collections").delete().eq("id", collectionId);
    if (error) { toast({ title: "Error", description: "Failed to remove", variant: "destructive" }); return; }
    toast({ title: "Removed from collection" });
    fetchCollections();
  };

  const updateCollection = async (collectionId: string) => {
    const { error } = await mongodbClient
      .from("collections")
      .update({ notes: editNotes, tags: editTags, category: editCategory || null, priority: editPriority })
      .eq("id", collectionId);
    if (error) { toast({ title: "Error", description: "Failed to update", variant: "destructive" }); return; }
    toast({ title: "Collection updated" });
    setEditingId(null);
    fetchCollections();
  };

  const addTag = () => {
    if (newTag.trim() && !editTags.includes(newTag.trim())) { setEditTags([...editTags, newTag.trim()]); setNewTag(""); }
  };

  const shareCollection = async (collectionId: string) => {
    const { data: profile } = await mongodbClient.from("profiles").select("id").eq("name", shareEmail).single();
    if (!profile) { toast({ title: "Error", description: "User not found", variant: "destructive" }); return; }
    const { error } = await mongodbClient.from("collection_shares").insert({
      collection_id: collectionId,
      shared_by: (await mongodbClient.auth.getUser()).data.user?.id!,
      shared_with: profile.id,
    });
    if (error) { toast({ title: "Error", description: "Failed to share", variant: "destructive" }); return; }
    toast({ title: "Collection shared successfully" });
    setShareEmail("");
  };

  const clearFilters = () => { setSearchQuery(""); setFilterCategory("all"); setFilterPriority("all"); setSortBy("date"); };

  return (
    <ProducerLayout>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold gradient-text mb-2">My Collections</h1>
              <p className="text-muted-foreground">Organize and manage your saved scripts</p>
            </div>
          </div>

          <Card className="glass p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="must-read">Must Read</SelectItem>
                  <SelectItem value="potential">Potential</SelectItem>
                  <SelectItem value="maybe">Maybe</SelectItem>
                  <SelectItem value="pass">Pass</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date Added</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredCollections.length} of {collections.length} scripts
              </p>
              {(searchQuery || filterCategory !== "all" || filterPriority !== "all") && (
                <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4 mr-2" />Clear</Button>
              )}
            </div>
          </Card>
        </div>

        {filteredCollections.length === 0 && collections.length === 0 ? (
          <Card className="glass p-12 text-center">
            <Bookmark className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No saved scripts yet</h3>
            <p className="text-muted-foreground mb-6">Start exploring and save your favorites</p>
            <Button onClick={() => window.location.href = '/producer/discover'}>Discover Scripts</Button>
          </Card>
        ) : filteredCollections.length === 0 ? (
          <Card className="glass p-12 text-center">
            <Filter className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No scripts match your filters</h3>
            <Button onClick={clearFilters} variant="outline">Clear Filters</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCollections.map((item) => (
              <Card key={item.id} className="glass glass-hover p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1">{item.script_title}</h3>
                    <p className="text-sm text-muted-foreground">by {item.writer_name}</p>
                  </div>
                  <div className="flex gap-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost"><Share2 className="w-4 h-4" /></Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Share Collection</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <Input placeholder="Enter user name" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                          <Button onClick={() => shareCollection(item.id)} className="w-full">Share</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button size="icon" variant="ghost" onClick={() => removeFromCollection(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {item.script_genre && <Badge variant="outline">{item.script_genre}</Badge>}
                  {item.category && <Badge variant="secondary">{item.category}</Badge>}
                  {item.priority && (
                    <Badge variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "outline"}>
                      {item.priority} priority
                    </Badge>
                  )}
                </div>

                {item.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {item.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs"><Tag className="w-3 h-3 mr-1" />{tag}</Badge>
                    ))}
                  </div>
                )}

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{item.script_logline || "No logline"}</p>
                {item.notes && <div className="bg-muted/30 rounded-lg p-3 mb-4"><p className="text-sm">{item.notes}</p></div>}

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditNotes(item.notes || "");
                        setEditTags(item.tags || []);
                        setEditCategory(item.category || "");
                        setEditPriority(item.priority || "medium");
                      }}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />Edit Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Edit Collection Details</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Category</label>
                        <Select value={editCategory} onValueChange={setEditCategory}>
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="must-read">Must Read</SelectItem>
                            <SelectItem value="potential">Potential</SelectItem>
                            <SelectItem value="maybe">Maybe</SelectItem>
                            <SelectItem value="pass">Pass</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Priority</label>
                        <Select value={editPriority} onValueChange={setEditPriority}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Tags</label>
                        <div className="flex gap-2 mb-2">
                          <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." onKeyDown={(e) => e.key === "Enter" && addTag()} />
                          <Button onClick={addTag} variant="outline">Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {editTags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="cursor-pointer" onClick={() => setEditTags(editTags.filter((t) => t !== tag))}>
                              {tag} <X className="w-3 h-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Notes</label>
                        <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Your notes..." className="min-h-[100px]" />
                      </div>
                      <Button onClick={() => updateCollection(item.id)} className="w-full">Save Changes</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProducerLayout>
  );
};

export default Collections;
