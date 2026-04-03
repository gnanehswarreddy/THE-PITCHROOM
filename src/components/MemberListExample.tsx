import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MessageSquare, FileText, Users, Globe } from "lucide-react";

interface Member {
  id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  role: string;
  script_count?: number;
}

// Mock data for demonstration
const mockMembers: Member[] = [
  {
    id: "1",
    name: "Alice Johnson",
    avatar_url: "",
    bio: "Passionate storyteller with experience in drama and comedy",
    role: "writer",
    script_count: 5
  },
  {
    id: "2", 
    name: "Bob Smith",
    avatar_url: "",
    bio: "Producer specializing in independent films",
    role: "producer"
  },
  {
    id: "3",
    name: "Carol Davis",
    avatar_url: "",
    bio: "Award-winning screenwriter",
    role: "Writer", // Mixed case to test case-insensitivity
    script_count: 12
  },
  {
    id: "4",
    name: "David Wilson",
    bio: "Film producer with 10+ years experience",
    role: "PRODUCER" // Uppercase to test case-insensitivity
  },
  {
    id: "5",
    name: "Eva Martinez",
    avatar_url: "",
    bio: "New writer focused on thrillers",
    role: "writer",
    script_count: 2
  }
];

const MemberListExample = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Memoized filtered members for performance
  const filteredMembers = useMemo(() => {
    return mockMembers.filter((member) => {
      // Search filter - case-insensitive search in name and bio
      const matchesSearch = 
        member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.bio?.toLowerCase().includes(searchTerm.toLowerCase());

      // Role filter - case-insensitive with null safety
      const normalizedRole = member.role?.toLowerCase().trim();
      const matchesRole = 
        activeTab === "all" || 
        normalizedRole === activeTab.toLowerCase().trim();

      return matchesSearch && matchesRole;
    });
  }, [searchTerm, activeTab]);

  // Calculate counts with case-insensitive filtering
  const stats = useMemo(() => {
    const writers = mockMembers.filter(m => m.role?.toLowerCase().trim() === "writer").length;
    const producers = mockMembers.filter(m => m.role?.toLowerCase().trim() === "producer").length;
    
    return {
      total: mockMembers.length,
      writers,
      producers
    };
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    console.log(`Tab changed to: ${value}`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Globe className="w-8 h-8" />
          Member Network
        </h1>
        <p className="text-muted-foreground">Connect with writers and producers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Members</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.writers}</p>
              <p className="text-sm text-muted-foreground">Writers</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{stats.producers}</p>
              <p className="text-sm text-muted-foreground">Producers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Members ({stats.total})</TabsTrigger>
          <TabsTrigger value="writer">Writers ({stats.writers})</TabsTrigger>
          <TabsTrigger value="producer">Producers ({stats.producers})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredMembers.length} of {stats.total} members
          {activeTab !== "all" && ` (${activeTab})`}
          {searchTerm && ` matching "${searchTerm}"`}
        </p>
      </div>

      {/* Member Grid */}
      {filteredMembers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No members found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={member.avatar_url} />
                  <AvatarFallback>
                    {member.name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold truncate">{member.name}</span>
                    <Badge 
                      variant={member.role?.toLowerCase().trim() === "producer" ? "default" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {member.role?.toLowerCase().trim() === "producer" ? "Producer" : "Writer"}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {member.bio || "No bio yet"}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    {member.role?.toLowerCase().trim() === "writer" && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {member.script_count || 0} scripts
                      </span>
                    )}
                  </div>
                  
                  <Button size="sm" variant="outline" className="w-full">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Message
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MemberListExample;
