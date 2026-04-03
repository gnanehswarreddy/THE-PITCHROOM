import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Type, Rocket } from "lucide-react";
import { mongodbClient } from "@/lib/mongodb/client";
import { useToast } from "@/hooks/use-toast";
import { generateLoglineFromScript } from "@/lib/ai/logline";

const genres = ["Action", "Comedy", "Drama", "Horror", "Thriller", "Romance", "Sci-Fi", "Fantasy", "Mystery", "Adventure", "Documentary"];
const languages = [
  "English", "Roman Hindi (Hinglish)", "Roman Telugu", "Roman Tamil", "Roman Kannada",
  "Roman Malayalam", "Roman Bengali", "Roman Marathi", "Roman Gujarati", "Roman Punjabi",
  "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "Punjabi",
  "Spanish", "French", "German", "Korean", "Japanese", "Mandarin", "Arabic", "Portuguese"
];
const formats = ["Screenplay", "Story", "Rough Draft"];

interface UploadStepProps {
  onAnalyze: (text: string, language: string) => void;
}

const UploadStep = ({ onAnalyze }: UploadStepProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [format, setFormat] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processFile = (selectedFile: File) => {
    const validTypes = ['.pdf', '.docx', '.fdx', '.txt', '.fountain'];
    const fileExt = selectedFile.name.slice(selectedFile.name.lastIndexOf('.'));
    if (!validTypes.includes(fileExt.toLowerCase())) {
      toast({ title: "Invalid file type", description: "Please upload a PDF, DOCX, FDX, TXT, or Fountain file", variant: "destructive" });
      return;
    }
    setFile(selectedFile);
    setPasteMode(false);
    if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !pastedText) return;

    setUploading(true);
    try {
      let scriptText = pastedText;
      if (file) {
        scriptText = await file.text();
      }

      const { data: { user } } = await mongodbClient.auth.getUser();
      if (user) {
        const generatedLogline = await generateLoglineFromScript({
          title: title || "Untitled Script",
          genre,
          language,
          scriptText,
        });

        const { error: scriptError } = await mongodbClient.scripts.create({
          title: title || "Untitled Script",
          logline: generatedLogline,
          scriptContent: scriptText,
          visibility: "private",
        });
        if (scriptError) {
          toast({
            title: "Analysis started without autosave",
            description: scriptError.message || "We could not save this draft automatically.",
            variant: "destructive",
          });
        }
      }

      onAnalyze(scriptText, language || "english");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-[620px]">
        <div className="glass rounded-2xl p-8 border border-border/30 shadow-[0_0_60px_hsl(265_85%_58%_/_0.06)]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground font-space">Upload Your Script</h1>
            <p className="text-muted-foreground text-sm mt-1">Drag & drop your script file or paste text manually.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!pasteMode ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center w-full h-44 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
                  isDragging ? "border-primary bg-primary/10 shadow-[0_0_30px_hsl(265_85%_58%/0.15)]"
                    : file ? "border-primary/40 bg-primary/5"
                    : "border-border/50 hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 text-primary" />
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Drop your file here, or <span className="text-primary font-medium">browse</span></p>
                    <p className="text-xs text-muted-foreground/60">.pdf, .docx, .fdx, .txt supported</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  title="Upload script file"
                  aria-label="Upload script file"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
                  accept=".pdf,.fdx,.fountain,.docx,.txt"
                />
              </div>
            ) : (
              <Textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder="Paste your script text here..." className="min-h-[180px] bg-muted/30 border-border/40 focus:border-primary/50 rounded-xl text-sm" />
            )}

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border/30" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>

            <Button type="button" variant="outline" onClick={() => { setPasteMode(!pasteMode); setFile(null); }} className="w-full rounded-xl border-border/40 hover:border-primary/40">
              <Type className="w-4 h-4 mr-2" />
              {pasteMode ? "Upload File Instead" : "Paste Script Text"}
            </Button>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter script title" className="mt-1.5 bg-muted/30 border-border/40 focus:border-primary/50 rounded-xl" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Genre</Label>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger className="mt-1.5 bg-muted/30 border-border/40 rounded-xl text-sm"><SelectValue placeholder="Genre" /></SelectTrigger>
                  <SelectContent>{genres.map((g) => <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="mt-1.5 bg-muted/30 border-border/40 rounded-xl text-sm"><SelectValue placeholder="Language" /></SelectTrigger>
                  <SelectContent>{languages.map((l) => <SelectItem key={l} value={l.toLowerCase()}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="mt-1.5 bg-muted/30 border-border/40 rounded-xl text-sm"><SelectValue placeholder="Format" /></SelectTrigger>
                  <SelectContent>{formats.map((f) => <SelectItem key={f} value={f.toLowerCase()}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={(!file && !pastedText) || uploading} className="w-full h-12 rounded-xl text-base font-semibold relative overflow-hidden group shadow-[0_0_30px_hsl(265_85%_58%_/_0.25)]">
              <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-[hsl(285_80%_55%)] opacity-100 group-hover:opacity-90 transition-opacity" />
              <span className="relative flex items-center gap-2">
                <Rocket className="w-5 h-5" />
                {uploading ? "Processing..." : "Analyze Script"}
              </span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UploadStep;
