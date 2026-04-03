import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, Theater, BarChart3, Clapperboard, FileText, Clock, Film, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import WriterLayout from "./WriterLayout";

const analysisSteps = [
  { icon: Brain, label: "Reading Structure", color: "text-primary" },
  { icon: Theater, label: "Analyzing Dialogue", color: "text-accent" },
  { icon: BarChart3, label: "Measuring Pacing", color: "text-primary" },
  { icon: Clapperboard, label: "Detecting Genre", color: "text-accent" },
];

const ScriptAnalysis = () => {
  const [analyzing, setAnalyzing] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!analyzing) return;
    const stepDuration = 1200;
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= analysisSteps.length - 1) {
          clearInterval(interval);
          setTimeout(() => setAnalyzing(false), 800);
          return prev;
        }
        return prev + 1;
      });
    }, stepDuration);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) { clearInterval(progressInterval); return 100; }
        return prev + 2;
      });
    }, 80);

    return () => { clearInterval(interval); clearInterval(progressInterval); };
  }, [analyzing]);

  // Mock analysis results
  const summaryCards = [
    { icon: FileText, label: "Total Pages", value: "112", color: "text-primary" },
    { icon: Clock, label: "Est. Runtime", value: "1h 52m", color: "text-accent" },
    { icon: Film, label: "Genre", value: "Thriller", color: "text-primary" },
    { icon: MessageSquare, label: "Dialogue Ratio", value: "62%", color: "text-accent" },
  ];

  const scores = [
    { label: "Pacing Score", value: 78, explanation: "Strong momentum with a few slow passages in Act 2.", color: "hsl(265 85% 58%)" },
    { label: "Emotional Depth", value: 85, explanation: "Rich emotional layers with well-crafted character arcs.", color: "hsl(175 85% 45%)" },
    { label: "Character Strength", value: 72, explanation: "Main leads are solid. Supporting cast needs more depth.", color: "hsl(285 80% 55%)" },
  ];

  if (analyzing) {
    return (
      <WriterLayout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
          <div className="w-full max-w-lg text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-8 animate-pulse" style={{ boxShadow: '0 0 50px hsl(265 85% 58% / 0.2)' }}>
              <Brain className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-space text-foreground mb-2">Analyzing Your Script</h1>
            <p className="text-muted-foreground text-sm mb-8">Our AI is reading through your screenplay...</p>

            <div className="space-y-4 mb-8">
              {analysisSteps.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${isActive ? "glass border-primary/30" : isDone ? "opacity-60" : "opacity-30"}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive ? "bg-primary/20" : "bg-muted/30"}`}>
                      <Icon className={`w-5 h-5 ${isActive ? step.color : "text-muted-foreground"} ${isActive ? "animate-pulse" : ""}`} />
                    </div>
                    <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                    {isDone && <span className="ml-auto text-xs text-accent">✓</span>}
                  </div>
                );
              })}
            </div>

            <Progress value={progress} className="h-2 rounded-full" />
            <p className="text-xs text-muted-foreground mt-2">{progress}% complete</p>
          </div>
        </div>
      </WriterLayout>
    );
  }

  return (
    <WriterLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-8 animate-fade-in">
        {/* Summary row */}
        <div>
          <h1 className="text-2xl font-bold font-space text-foreground mb-1">Analysis Complete</h1>
          <p className="text-sm text-muted-foreground mb-6">Here's how your script performs across key metrics.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="glass rounded-xl p-5 text-center border border-border/20">
                  <Icon className={`w-5 h-5 mx-auto mb-2 ${card.color}`} />
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {scores.map((score) => (
            <div key={score.label} className="glass glass-hover rounded-xl p-6 border border-border/20 text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={score.color} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${score.value * 2.64} 264`}
                    style={{ filter: `drop-shadow(0 0 6px ${score.color})` }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-foreground">{score.value}</span>
              </div>
              <h3 className="font-semibold text-foreground text-sm">{score.label}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{score.explanation}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="glass rounded-xl p-6 border border-border/20 text-center">
          <Sparkles className="w-6 h-6 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground font-space mb-1">What would you like to improve?</h2>
          <p className="text-sm text-muted-foreground mb-5">Enhance your script with AI-powered tools.</p>
          <Button
            onClick={() => navigate("/writer/enhance")}
            className="h-11 px-8 rounded-xl font-semibold relative overflow-hidden group"
            style={{ boxShadow: '0 0 25px hsl(265 85% 58% / 0.2)' }}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-[hsl(285_80%_55%)] opacity-100 group-hover:opacity-90 transition-opacity" />
            <span className="relative flex items-center gap-2">
              Go to Enhancements <ArrowRight className="w-4 h-4" />
            </span>
          </Button>
        </div>
      </div>
    </WriterLayout>
  );
};

export default ScriptAnalysis;
