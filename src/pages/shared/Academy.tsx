import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import WriterLayout from "@/pages/writer/WriterLayout";
import ProducerLayout from "@/pages/producer/ProducerLayout";
import {
  GraduationCap, Play, Clock, Star, Search, BookOpen, Video,
  FileText, Award, ChevronRight, Users, TrendingUp, Sparkles, Lock, Loader2
} from "lucide-react";

interface Course {
  id: string;
  title: string;
  instructor: string;
  duration: string;
  lessons: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  rating: number;
  students: number;
  category: string;
  isPremium: boolean;
}

const COURSES: Course[] = [
  { id: "1", title: "Mastering Three-Act Structure", instructor: "Robert McKee", duration: "4h 30m", lessons: 24, level: "Beginner", rating: 4.9, students: 12500, category: "screenwriting", isPremium: false },
  { id: "2", title: "Writing Compelling Dialogue", instructor: "Aaron Sorkin", duration: "6h 15m", lessons: 32, level: "Intermediate", rating: 4.8, students: 8900, category: "screenwriting", isPremium: true },
  { id: "3", title: "From Script to Screen: Producer's Guide", instructor: "Kathleen Kennedy", duration: "8h 45m", lessons: 48, level: "Advanced", rating: 4.9, students: 5600, category: "production", isPremium: true },
  { id: "4", title: "AI-Powered Screenwriting Tools", instructor: "PitchRoom Academy", duration: "3h 20m", lessons: 18, level: "Beginner", rating: 4.7, students: 15200, category: "ai-tools", isPremium: false },
  { id: "5", title: "Pitching Your Script Successfully", instructor: "Blake Snyder", duration: "5h 10m", lessons: 28, level: "Intermediate", rating: 4.8, students: 7800, category: "business", isPremium: true },
  { id: "6", title: "Writing for Streaming Platforms", instructor: "Shonda Rhimes", duration: "7h 30m", lessons: 42, level: "Advanced", rating: 4.9, students: 11200, category: "screenwriting", isPremium: true },
  { id: "7", title: "Character Development Masterclass", instructor: "Vince Gilligan", duration: "5h 45m", lessons: 30, level: "Intermediate", rating: 4.9, students: 9800, category: "screenwriting", isPremium: false },
  { id: "8", title: "Budget Planning for Indie Films", instructor: "Jason Blum", duration: "4h 15m", lessons: 22, level: "Beginner", rating: 4.6, students: 6500, category: "production", isPremium: false },
];

const categories = [
  { id: "all", name: "All Courses", icon: BookOpen },
  { id: "screenwriting", name: "Screenwriting", icon: FileText },
  { id: "production", name: "Production", icon: Video },
  { id: "business", name: "Business", icon: TrendingUp },
  { id: "ai-tools", name: "AI Tools", icon: Sparkles },
];

const Academy = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [enrollments, setEnrollments] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;

    const { data: roleData } = await mongodbClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    setUserRole(roleData?.role || "writer");

    const { data: enrollData } = await mongodbClient.from("course_enrollments").select("course_id, progress").eq("user_id", user.id);
    if (enrollData) {
      setEnrollments(new Map(enrollData.map(e => [e.course_id, e.progress || 0])));
    }
    setLoading(false);
  };

  const handleEnroll = async (courseId: string) => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;

    const { error } = await mongodbClient.from("course_enrollments").upsert({
      user_id: user.id,
      course_id: courseId,
      progress: 0,
    }, { onConflict: "user_id,course_id" });

    if (!error) {
      setEnrollments(new Map(enrollments.set(courseId, 0)));
      toast({ title: "Enrolled!", description: "You've started a new course." });
    }
  };

  const handleUpdateProgress = async (courseId: string, newProgress: number) => {
    const { data: { user } } = await mongodbClient.auth.getUser();
    if (!user) return;

    await mongodbClient.from("course_enrollments").update({ progress: newProgress })
      .eq("user_id", user.id).eq("course_id", courseId);
    setEnrollments(new Map(enrollments.set(courseId, newProgress)));
  };

  const filteredCourses = COURSES.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.instructor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || course.category === selectedCategory;
    const progress = enrollments.get(course.id);
    const matchesTab = activeTab === "all" ||
      (activeTab === "in-progress" && progress !== undefined && progress < 100) ||
      (activeTab === "completed" && progress === 100);
    return matchesSearch && matchesCategory && matchesTab;
  });

  const enrolledCount = [...enrollments.values()].filter(p => p === 100).length;
  const totalHours = [...enrollments.keys()].reduce((sum, id) => {
    const course = COURSES.find(c => c.id === id);
    return sum + (course ? parseFloat(course.duration) || 0 : 0);
  }, 0);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner": return "bg-green-500/20 text-green-400";
      case "Intermediate": return "bg-yellow-500/20 text-yellow-400";
      case "Advanced": return "bg-red-500/20 text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const content = (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2 flex items-center gap-2">
              <GraduationCap className="w-8 h-8" />Academy+
            </h1>
            <p className="text-muted-foreground">Master the craft of screenwriting and production</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search courses..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-64" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Courses Enrolled", value: enrollments.size.toString(), icon: Award },
            { label: "Completed", value: enrolledCount.toString(), icon: GraduationCap },
            { label: "In Progress", value: (enrollments.size - enrolledCount).toString(), icon: Clock },
            { label: "Total Courses", value: COURSES.length.toString(), icon: TrendingUp },
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

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="flex gap-2 mb-6 flex-wrap">
              {categories.map(cat => (
                <Button key={cat.id} variant={selectedCategory === cat.id ? "default" : "outline"} size="sm"
                  onClick={() => setSelectedCategory(cat.id)} className="gap-2">
                  <cat.icon className="w-4 h-4" />{cat.name}
                </Button>
              ))}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList>
                <TabsTrigger value="all">All Courses</TabsTrigger>
                <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {filteredCourses.map(course => {
                  const progress = enrollments.get(course.id);
                  const isEnrolled = progress !== undefined;
                  return (
                    <Card key={course.id} className="glass glass-hover overflow-hidden group">
                      <div className="h-40 bg-gradient-to-br from-primary/30 to-accent/20 relative flex items-center justify-center">
                        <Play className="w-16 h-16 text-white/50 group-hover:text-white/80 transition-colors" />
                        {course.isPremium && (
                          <Badge className="absolute top-3 right-3 bg-yellow-500/90">
                            <Lock className="w-3 h-3 mr-1" />Premium
                          </Badge>
                        )}
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getLevelColor(course.level)}>{course.level}</Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{course.rating}
                          </span>
                        </div>
                        <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{course.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4">by {course.instructor}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{course.duration}</span>
                          <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{course.lessons} lessons</span>
                          <span className="flex items-center gap-1"><Users className="w-4 h-4" />{course.students.toLocaleString()}</span>
                        </div>
                        {isEnrolled && (
                          <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        )}
                        <Button className="w-full" onClick={() => {
                          if (!isEnrolled) handleEnroll(course.id);
                          else if (progress! < 100) handleUpdateProgress(course.id, Math.min(progress! + 25, 100));
                        }}>
                          {!isEnrolled ? "Start Course" : progress! < 100 ? "Continue Learning" : "Completed ✓"}
                          {progress !== 100 && <ChevronRight className="w-4 h-4 ml-2" />}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Card className="glass p-6">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Play className="w-5 h-5 text-primary" />Continue Learning
              </h3>
              {[...enrollments.entries()].filter(([, p]) => p > 0 && p < 100).slice(0, 3).map(([courseId, progress]) => {
                const course = COURSES.find(c => c.id === courseId);
                if (!course) return null;
                return (
                  <div key={courseId} className="mb-4 last:mb-0">
                    <p className="font-medium text-sm mb-1 truncate">{course.title}</p>
                    <Progress value={progress} className="h-1.5 mb-1" />
                    <p className="text-xs text-muted-foreground">{progress}% complete</p>
                  </div>
                );
              })}
              {[...enrollments.entries()].filter(([, p]) => p > 0 && p < 100).length === 0 && (
                <p className="text-sm text-muted-foreground">Enroll in a course to get started!</p>
              )}
            </Card>

            <Card className="glass p-6 bg-gradient-to-br from-primary/20 to-accent/10">
              <h3 className="font-semibold mb-2">Unlock All Courses</h3>
              <p className="text-sm text-muted-foreground mb-4">Get unlimited access to 50+ premium courses</p>
              <Button className="w-full">Upgrade to Pro<Sparkles className="w-4 h-4 ml-2" /></Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );

  if (userRole === "writer") return <WriterLayout>{content}</WriterLayout>;
  return <ProducerLayout>{content}</ProducerLayout>;
};

export default Academy;
