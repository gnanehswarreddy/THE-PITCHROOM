import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, Expand, RefreshCw, MessageCircle, PenTool, AlignLeft, BookOpen, Rocket } from "lucide-react";
import WriterLayout from "./WriterLayout";

const scopeOptions = ["Entire Script", "Selected Act", "Selected Scene"];

const enhancementOptions = [
  { id: "expand", label: "Expand Scene" },
  { id: "rewrite", label: "Rewrite Scene" },
  { id: "generate-dialogue", label: "Generate Dialogue" },
  { id: "polish-dialogue", label: "Polish Dialogue" },
  { id: "format", label: "Format Script" },
  { id: "full-story", label: "Full Story" },
];

const toolCards = [
  {
    section: "Scene Tools",
    tools: [
      { icon: Expand, title: "Expand Scene", desc: "Add depth, description, and tension.", id: "expand" },
      { icon: RefreshCw, title: "Rewrite Scene", desc: "Improve structure and pacing.", id: "rewrite" },
    ],
  },
  {
    section: "Dialogue Tools",
    tools: [
      { icon: MessageCircle, title: "Generate Dialogue", desc: "Create new engaging dialogue.", id: "generate-dialogue" },
      { icon: PenTool, title: "Polish Dialogue", desc: "Refine and elevate spoken lines.", id: "polish-dialogue" },
    ],
  },
  {
    section: "Script Tools",
    tools: [
      { icon: AlignLeft, title: "Format Script", desc: "Convert to professional screenplay format.", id: "format" },
      { icon: BookOpen, title: "Full Story", desc: "Generate complete story from script base.", id: "full-story" },
    ],
  },
];

const EnhanceDashboard = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [masterScope, setMasterScope] = useState("Entire Script");
  const [cardScopes, setCardScopes] = useState<Record<string, string>>({});

  const toggleOption = (id: string) => {
    setSelectedOptions((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
  };

  const handleApply = (toolId: string) => {
    // Placeholder for enhancement logic
    console.log("Applying:", toolId, "Scope:", cardScopes[toolId] || "Entire Script");
  };

  return (
    <WriterLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {/* Master Upgrade Card */}
        <div
          className="glass rounded-2xl p-8 border border-primary/20 text-center cursor-pointer group transition-all hover:border-primary/40"
          style={{ boxShadow: '0 0 50px hsl(265 85% 58% / 0.08)' }}
          onClick={() => setModalOpen(true)}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-space mb-1">✨ Cinematic Upgrade</h1>
          <p className="text-sm text-muted-foreground">Enhance your script with all improvements in one click.</p>
        </div>

        {/* Master Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md glass border-border/30">
            <DialogHeader>
              <DialogTitle className="font-space text-lg">Cinematic Upgrade</DialogTitle>
              <DialogDescription>Select the enhancements you want to apply.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {enhancementOptions.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                  <Checkbox
                    checked={selectedOptions.includes(opt.id)}
                    onCheckedChange={() => toggleOption(opt.id)}
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Scope</p>
              <Select value={masterScope} onValueChange={setMasterScope}>
                <SelectTrigger className="bg-muted/30 border-border/40 rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={selectedOptions.length === 0}
              className="w-full h-11 rounded-xl font-semibold relative overflow-hidden group"
              style={{ boxShadow: '0 0 25px hsl(265 85% 58% / 0.2)' }}
              onClick={() => { setModalOpen(false); }}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-[hsl(285_80%_55%)] opacity-100 group-hover:opacity-90 transition-opacity" />
              <span className="relative flex items-center gap-2">
                <Rocket className="w-4 h-4" /> Run Upgrade
              </span>
            </Button>
          </DialogContent>
        </Dialog>

        {/* Tool Cards by Section */}
        {toolCards.map((section) => (
          <div key={section.section}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{section.section}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {section.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.id}
                    className="glass glass-hover rounded-xl p-5 border border-border/20 flex flex-col gap-4 transition-all hover:border-primary/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground text-sm">{tool.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{tool.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={cardScopes[tool.id] || "Entire Script"}
                        onValueChange={(v) => setCardScopes({ ...cardScopes, [tool.id]: v })}
                      >
                        <SelectTrigger className="flex-1 h-9 bg-muted/30 border-border/40 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {scopeOptions.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-9 px-4 rounded-lg text-xs font-semibold"
                        onClick={() => handleApply(tool.id)}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </WriterLayout>
  );
};

export default EnhanceDashboard;
