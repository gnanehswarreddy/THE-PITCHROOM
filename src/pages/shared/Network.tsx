import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import WriterLayout from "@/pages/writer/WriterLayout";
import ProducerLayout from "@/pages/producer/ProducerLayout";
import {
  Users, Search, MessageSquare, FileText, Globe, UserPlus, Filter,
  TrendingUp, Star, MapPin, Briefcase
} from "lucide-react";

interface NetworkMember {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  role: string | null;
  script_count: number;
}

const normalizeRole = (role?: string | null) => role?.trim().toLowerCase() || "";
const isWriterRole = (role?: string | null) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "writer" || normalizedRole === "author" || normalizedRole === "screenwriter";
};
const isProducerRole = (role?: string | null) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "producer" || normalizedRole === "director" || normalizedRole === "filmmaker";
};

const Network = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [members, setMembers] = useState<NetworkMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [followedWriterIds, setFollowedWriterIds] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await mongodbClient.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: roleData } = await mongodbClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      setUserRole(roleData?.role || "writer");

      // Fetch all profiles
      const { data: profiles } = await mongodbClient
        .from("profiles")
        .select("id, name, avatar_url, bio, role")
        .neq("id", user.id)
        .not("name", "is", null);

      if (!profiles) { setIsLoading(false); return; }

      // Roles are primarily stored in user_roles in this app. Fall back to profiles.role
      // so filtering still works for older or partially migrated records.
      const profileIds = profiles.map((profile) => profile.id);
      const { data: roleRows } = await mongodbClient
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profileIds);

      const roleMap = new Map((roleRows || []).map((row) => [row.user_id, row.role]));

      // Get script counts for writers
      const writerIds = profiles.filter(p => {
        const resolvedRole = roleMap.get(p.id) ?? p.role;
        return isWriterRole(resolvedRole);
      }).map(p => p.id);
      const scriptCounts = new Map<string, number>();

      if (writerIds.length > 0) {
        const { data: scripts } = await mongodbClient
          .from("scripts")
          .select("writer_id")
          .in("writer_id", writerIds)
          .eq("visibility", "public");

        scripts?.forEach(s => {
          scriptCounts.set(s.writer_id, (scriptCounts.get(s.writer_id) || 0) + 1);
        });
      }

      const enriched: NetworkMember[] = profiles.map(p => ({
        ...p,
        role: roleMap.get(p.id) ?? p.role ?? null,
        script_count: scriptCounts.get(p.id) || 0,
      }));

      const { data: follows } = await mongodbClient
        .from("writer_follows")
        .select("writer_id")
        .eq("follower_id", user.id);

      setFollowedWriterIds((follows || []).map((row) => row.writer_id));
      setMembers(enriched);
      setIsLoading(false);
    };

    init();
  }, []);

  const startConversation = async (targetId: string) => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;

    // Check if conversation already exists
    const isWriter = userRole === "writer";
    const { data: existing } = await mongodbClient
      .from("conversations")
      .select("id")
      .eq(isWriter ? "writer_id" : "producer_id", user.id)
      .eq(isWriter ? "producer_id" : "writer_id", targetId)
      .maybeSingle();

    if (existing) {
      toast({ title: "Conversation exists", description: "Check your messages" });
      return;
    }

    const { error } = await mongodbClient.from("conversations").insert({
      writer_id: isWriter ? user.id : targetId,
      producer_id: isWriter ? targetId : user.id,
    });

    if (error) {
      toast({ title: "Error", description: "Could not start conversation", variant: "destructive" });
      return;
    }

    toast({ title: "Conversation started!", description: "Check your messages" });
  };

  const toggleFollowWriter = async (member: NetworkMember) => {
    if (!currentUserId) return;
    const isFollowing = followedWriterIds.includes(member.id);

    if (isFollowing) {
      const { error } = await mongodbClient
        .from("writer_follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("writer_id", member.id);

      if (error) {
        toast({ title: "Error", description: "Could not unfollow writer", variant: "destructive" });
        return;
      }

      setFollowedWriterIds((current) => current.filter((id) => id !== member.id));
      toast({ title: "Unfollowed", description: `${member.name} was removed from your followed writers.` });
      return;
    }

    const { error } = await mongodbClient.from("writer_follows").insert({
      follower_id: currentUserId,
      writer_id: member.id,
      created_at: new Date().toISOString(),
    });

    if (error) {
      toast({ title: "Error", description: "Could not follow writer", variant: "destructive" });
      return;
    }

    setFollowedWriterIds((current) => [...current, member.id]);
    await trackEvent({
      event_type: "FOLLOW_WRITER",
      metadata: {
        writer_id: member.id,
        profile_owner_id: member.id,
        profile_name: member.name,
      },
    });
    toast({ title: "Writer followed", description: `You will now see ${member.name} in your network activity.` });
  };

  const filteredMembers = members.filter((member) => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearchTerm ||
      member.name?.toLowerCase().includes(normalizedSearchTerm) ||
      member.bio?.toLowerCase().includes(normalizedSearchTerm);

    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "writer" && isWriterRole(member.role)) ||
      (roleFilter === "producer" && isProducerRole(member.role));

    return Boolean(matchesSearch && matchesRole);
  });

  const writerCount = members.filter((member) => isWriterRole(member.role)).length;

  const producerCount = members.filter((member) => isProducerRole(member.role)).length;

  const content = (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2 flex items-center gap-2">
              <Globe className="w-8 h-8" />
              Network
            </h1>
            <p className="text-muted-foreground">Connect with writers and producers in the PitchRoom ecosystem</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Members", value: members.length, icon: Users },
            { label: "Writers", value: writerCount, icon: FileText },
            { label: "Producers", value: producerCount, icon: Briefcase },
            { label: "Active Today", value: Math.ceil(members.length * 0.3), icon: TrendingUp },
          ].map((stat, i) => (
            <Card key={i} className="glass p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Filter tabs */}
        <Tabs value={roleFilter} onValueChange={setRoleFilter} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All Members</TabsTrigger>
            <TabsTrigger value="writer">Writers</TabsTrigger>
            <TabsTrigger value="producer">Producers</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Members Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-muted-foreground">Loading members...</div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <Card className="glass p-12 text-center">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No members found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map((member) => (
              <Card key={member.id} className="glass glass-hover p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-lg">
                      {member.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">{member.name}</span>
                      <Badge
                        variant={isProducerRole(member.role) ? "default" : "secondary"}
                        className="text-xs shrink-0"
                      >
                        {isProducerRole(member.role) ? "Producer" : isWriterRole(member.role) ? "Writer" : "Member"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {member.bio || "No bio yet"}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      {isWriterRole(member.role) && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {member.script_count} scripts
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isWriterRole(member.role) && (
                        <Button
                          size="sm"
                          variant={followedWriterIds.includes(member.id) ? "default" : "secondary"}
                          className="flex-1"
                          onClick={() => toggleFollowWriter(member)}
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          {followedWriterIds.includes(member.id) ? "Following" : "Follow"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => startConversation(member.id)}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Message
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (userRole === "writer") return <WriterLayout>{content}</WriterLayout>;
  return <ProducerLayout>{content}</ProducerLayout>;
};

export default Network;
