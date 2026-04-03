import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import WriterLayout from "@/pages/writer/WriterLayout";
import ProducerLayout from "@/pages/producer/ProducerLayout";
import {
  Users, MessageSquare, Heart, TrendingUp, Search,
  Send, Award, Sparkles, Pen, Loader2, Trash2
} from "lucide-react";

interface Post {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
  author_role?: string;
  liked?: boolean;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
}

const Community = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("feed");
  const [searchTerm, setSearchTerm] = useState("");
  const [newPost, setNewPost] = useState("");
  const [newTags, setNewTags] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Map<string, Comment[]>>(new Map());
  const [commentInputs, setCommentInputs] = useState<Map<string, string>>(new Map());
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: roleData } = await mongodbClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    setUserRole(roleData?.role || "writer");

    await Promise.all([loadPosts(user.id), loadMembers()]);
    setLoading(false);
  };

  const loadPosts = async (currentUserId: string) => {
    const { data: postsData } = await mongodbClient.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
    if (!postsData) return;

    const userIds = [...new Set(postsData.map(p => p.user_id))];
    const { data: profiles } = await mongodbClient.from("profiles").select("id, name, avatar_url, role").in("id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const { data: likes } = await mongodbClient.from("post_likes").select("post_id").eq("user_id", currentUserId);
    const likedIds = new Set((likes || []).map(l => l.post_id));
    setLikedPostIds(likedIds);

    setPosts(postsData.map(p => {
      const profile = profileMap.get(p.user_id);
      return { ...p, author_name: profile?.name || "Anonymous", author_avatar: profile?.avatar_url || "", author_role: profile?.role || "writer", liked: likedIds.has(p.id) };
    }));
  };

  const loadMembers = async () => {
    const { data } = await mongodbClient.from("profiles").select("id, name, avatar_url, bio, role").limit(20);
    setMembers(data || []);
  };

  const loadComments = async (postId: string) => {
    const { data } = await mongodbClient.from("post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (!data) return;

    const userIds = [...new Set(data.map(c => c.user_id))];
    const { data: profiles } = await mongodbClient.from("profiles").select("id, name, avatar_url").in("id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const enriched = data.map(c => ({
      ...c,
      author_name: profileMap.get(c.user_id)?.name || "Anonymous",
      author_avatar: profileMap.get(c.user_id)?.avatar_url || "",
    }));
    setComments(new Map(comments.set(postId, enriched)));
  };

  const toggleComments = async (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
      if (!comments.has(postId)) await loadComments(postId);
    }
    setExpandedComments(newExpanded);
  };

  const handleAddComment = async (postId: string) => {
    const content = commentInputs.get(postId)?.trim();
    if (!content || !userId) return;
    setCommentingOn(postId);

    const { error } = await mongodbClient.from("post_comments").insert({ post_id: postId, user_id: userId, content });
    if (!error) {
      setCommentInputs(new Map(commentInputs.set(postId, "")));
      await loadComments(postId);
      setPosts(posts.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
    }
    setCommentingOn(null);
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    await mongodbClient.from("post_comments").delete().eq("id", commentId);
    await loadComments(postId);
    setPosts(posts.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p));
  };

  const handlePost = async () => {
    if (!newPost.trim() || !userId) return;
    setPosting(true);
    const tags = newTags.split(",").map(t => t.trim()).filter(Boolean);
    const { error } = await mongodbClient.from("posts").insert({ user_id: userId, content: newPost, tags });
    if (!error) {
      setNewPost(""); setNewTags("");
      toast({ title: "Post shared!" });
      await loadPosts(userId);
    }
    setPosting(false);
  };

  const handleLike = async (postId: string) => {
    if (!userId) return;
    const isLiked = likedPostIds.has(postId);
    if (isLiked) {
      await mongodbClient.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
      likedPostIds.delete(postId);
    } else {
      await mongodbClient.from("post_likes").insert({ post_id: postId, user_id: userId });
      likedPostIds.add(postId);
    }
    setLikedPostIds(new Set(likedPostIds));
    setPosts(posts.map(p => p.id === postId ? { ...p, liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const content = (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">Community Hub</h1>
            <p className="text-muted-foreground">Connect with writers and producers worldwide</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search community..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-64" />
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="feed"><MessageSquare className="w-4 h-4 mr-2" />Feed</TabsTrigger>
                <TabsTrigger value="members"><Users className="w-4 h-4 mr-2" />Members</TabsTrigger>
                <TabsTrigger value="events"><Award className="w-4 h-4 mr-2" />Events</TabsTrigger>
              </TabsList>

              <TabsContent value="feed" className="space-y-6">
                <Card className="glass p-6">
                  <div className="flex gap-4">
                    <Avatar><AvatarFallback className="bg-primary/20 text-primary"><Pen className="w-4 h-4" /></AvatarFallback></Avatar>
                    <div className="flex-1">
                      <Textarea placeholder="Share your thoughts..." value={newPost} onChange={e => setNewPost(e.target.value)} className="min-h-[80px] mb-3" />
                      <Input placeholder="Tags (comma-separated)" value={newTags} onChange={e => setNewTags(e.target.value)} className="mb-3" />
                      <div className="flex justify-end">
                        <Button onClick={handlePost} disabled={!newPost.trim() || posting}>
                          {posting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Post
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : posts.filter(p => !searchTerm || p.content.toLowerCase().includes(searchTerm.toLowerCase())).map(post => (
                  <Card key={post.id} className="glass glass-hover p-6">
                    <div className="flex gap-4">
                      <Avatar>
                        <AvatarImage src={post.author_avatar} />
                        <AvatarFallback className="bg-primary/20 text-primary">{post.author_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{post.author_name}</span>
                          <Badge variant={post.author_role === "producer" ? "default" : "secondary"} className="text-xs capitalize">{post.author_role}</Badge>
                          <span className="text-sm text-muted-foreground">• {timeAgo(post.created_at)}</span>
                        </div>
                        <p className="text-foreground/90 mb-3 leading-relaxed">{post.content}</p>
                        {post.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {post.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                          </div>
                        )}
                        <div className="flex items-center gap-6 text-muted-foreground">
                          <button onClick={() => handleLike(post.id)}
                            className={`flex items-center gap-2 hover:text-primary transition-colors ${post.liked ? "text-primary" : ""}`}>
                            <Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} /> {post.likes_count}
                          </button>
                          <button onClick={() => toggleComments(post.id)} className="flex items-center gap-2 hover:text-primary transition-colors">
                            <MessageSquare className="w-4 h-4" /> {post.comments_count}
                          </button>
                        </div>

                        {/* Comments Section */}
                        {expandedComments.has(post.id) && (
                          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                            {(comments.get(post.id) || []).map(comment => (
                              <div key={comment.id} className="flex gap-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={comment.author_avatar} />
                                  <AvatarFallback className="bg-muted text-xs">{comment.author_name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 bg-muted/30 rounded-lg p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{comment.author_name}</span>
                                      <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
                                    </div>
                                    {comment.user_id === userId && (
                                      <button onClick={() => handleDeleteComment(comment.id, post.id)}
                                        className="text-muted-foreground hover:text-destructive transition-colors">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-sm mt-1">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <Input
                                placeholder="Write a comment..."
                                value={commentInputs.get(post.id) || ""}
                                onChange={e => setCommentInputs(new Map(commentInputs.set(post.id, e.target.value)))}
                                onKeyDown={e => e.key === "Enter" && handleAddComment(post.id)}
                                className="text-sm"
                              />
                              <Button size="sm" onClick={() => handleAddComment(post.id)} disabled={commentingOn === post.id}>
                                {commentingOn === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="members">
                <div className="grid md:grid-cols-2 gap-4">
                  {members.map(member => (
                    <Card key={member.id} className="glass glass-hover p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="w-14 h-14">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback className="bg-primary/20 text-primary text-lg">{member.name?.charAt(0) || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{member.name || "Anonymous"}</span>
                            <Badge variant={member.role === "producer" ? "default" : "secondary"} className="text-xs capitalize">{member.role || "writer"}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{member.bio || "No bio yet"}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="events">
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { title: "Virtual Pitch Night", date: "Mar 15, 2026", time: "7:00 PM EST", attendees: 156, type: "Live Event" },
                    { title: "Script Feedback Workshop", date: "Mar 18, 2026", time: "3:00 PM EST", attendees: 89, type: "Workshop" },
                    { title: "Producer Q&A Session", date: "Mar 22, 2026", time: "5:00 PM EST", attendees: 234, type: "Q&A" },
                    { title: "Genre Deep Dive: Horror", date: "Mar 28, 2026", time: "6:00 PM EST", attendees: 178, type: "Masterclass" },
                  ].map((event, i) => (
                    <Card key={i} className="glass glass-hover p-6">
                      <div className="flex items-start justify-between mb-4">
                        <Badge variant="outline">{event.type}</Badge>
                        <span className="text-sm text-muted-foreground">{event.attendees} attending</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{event.title}</h3>
                      <p className="text-muted-foreground mb-4">{event.date} at {event.time}</p>
                      <Button className="w-full">Register</Button>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card className="glass p-6">
              <h3 className="font-semibold flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-primary" />Trending Topics</h3>
              <div className="space-y-3">
                {["#HorrorScripts", "#ScriptSwap", "#WritingTips", "#IndieFilm", "#RomanHindi"].map((tag, i) => (
                  <div key={i} className="flex items-center justify-between hover:bg-muted/50 p-2 rounded-lg cursor-pointer transition-colors">
                    <span className="font-medium text-primary">{tag}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="glass p-6">
              <h3 className="font-semibold flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-primary" />Community Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between"><span className="text-muted-foreground">Members</span><span className="font-semibold">{members.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Posts</span><span className="font-semibold">{posts.length}</span></div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );

  if (userRole === "writer") return <WriterLayout>{content}</WriterLayout>;
  return <ProducerLayout>{content}</ProducerLayout>;
};

export default Community;
