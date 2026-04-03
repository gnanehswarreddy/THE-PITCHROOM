import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProducerLayout from "./ProducerLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeStory,
  defaultProducerStudioProject,
  estimateBudget,
  generatePitchDeck,
  improveScript,
  predictMarket,
  type ProducerStudioModule,
  type ProducerStudioProject,
  visualizeScenes,
  workflowSteps,
} from "@/lib/producer-ai-studio";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BrainCircuit,
  Camera,
  CheckCircle2,
  DollarSign,
  FilePlus2,
  FolderKanban,
  LineChart,
  Presentation,
  Sparkles,
  Wand2,
} from "lucide-react";

// cspell:ignore pitchroom
const STORAGE_KEY = "pitchroom-producer-ai-studio-projects";
// cspell:disable-next-line
const CURRENT_KEY = "pitchroom-producer-ai-studio-current";

const moduleCards: Array<{
  key: ProducerStudioModule;
  title: string;
  description: string;
  icon: typeof BrainCircuit;
}> = [
  { key: "story-analyzer", title: "Story Analyzer", description: "Extract genre, structure, originality, and viability.", icon: BrainCircuit },
  { key: "script-improver", title: "Script Improver", description: "Refine scenes, dialogue, emotion, and pacing.", icon: Wand2 },
  { key: "scene-visualizer", title: "Scene Visualizer", description: "Turn scenes into camera, lighting, and mood guidance.", icon: Camera },
  { key: "budget-estimator", title: "Budget Estimator", description: "Estimate scale, line items, and production assumptions.", icon: DollarSign },
  { key: "market-predictor", title: "Market Predictor", description: "Forecast audience, platform, and market potential.", icon: LineChart },
  { key: "pitch-generator", title: "Pitch Generator", description: "Convert the full workflow into a producer-ready deck.", icon: Presentation },
];

const modulePath = (key: ProducerStudioModule) =>
  key === "home" ? "/producer/ai-studio" : `/producer/ai-studio/${key}`;

const getModuleFromPath = (pathname: string): ProducerStudioModule => {
  const match = workflowSteps.find((step) => pathname.endsWith(step.key));
  return match?.key || "home";
};

const loadProjects = (): ProducerStudioProject[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [defaultProducerStudioProject()];
    const parsed = JSON.parse(raw) as ProducerStudioProject[];
    return parsed.length ? parsed : [defaultProducerStudioProject()];
  } catch {
    return [defaultProducerStudioProject()];
  }
};

const ProducerAIStudio = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeModule = useMemo(() => getModuleFromPath(location.pathname), [location.pathname]);
  const [projects, setProjects] = useState<ProducerStudioProject[]>(() => loadProjects());
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => localStorage.getItem(CURRENT_KEY) || loadProjects()[0].id);
  const [improverMode, setImproverMode] = useState("dialogue");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(CURRENT_KEY, currentProjectId);
  }, [currentProjectId]);

  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentProjectId) || projects[0],
    [projects, currentProjectId],
  );

  useEffect(() => {
    if (!currentProject) return;
    if (!projects.some((project) => project.id === currentProjectId)) {
      setCurrentProjectId(projects[0]?.id || defaultProducerStudioProject().id);
    }
  }, [projects, currentProject, currentProjectId]);

  const updateProject = (updater: (project: ProducerStudioProject) => ProducerStudioProject) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === currentProject.id
          ? {
              ...updater(project),
              updatedAt: new Date().toISOString(),
            }
          : project,
      ),
    );
  };

  const createNewProject = () => {
    const fresh = defaultProducerStudioProject();
    setProjects((current) => [fresh, ...current]);
    setCurrentProjectId(fresh.id);
    navigate("/producer/ai-studio");
  };

  const completedCount = [
    currentProject.analysis,
    currentProject.improvement,
    currentProject.visualization,
    currentProject.budget,
    currentProject.market,
    currentProject.pitch,
  ].filter(Boolean).length;

  const nextRecommended = workflowSteps.find((step) => {
    if (step.key === "story-analyzer") return !currentProject.analysis;
    if (step.key === "script-improver") return !currentProject.improvement;
    if (step.key === "scene-visualizer") return !currentProject.visualization;
    if (step.key === "budget-estimator") return !currentProject.budget;
    if (step.key === "market-predictor") return !currentProject.market;
    if (step.key === "pitch-generator") return !currentProject.pitch;
    return false;
  }) || workflowSteps[workflowSteps.length - 1];

  const runAnalysis = () => updateProject((project) => ({ ...project, analysis: analyzeStory(project.sourceText) }));
  const runImprover = () =>
    updateProject((project) => ({
      ...project,
      improvement: improveScript(project.sourceText, improverMode, project.analysis || analyzeStory(project.sourceText)),
    }));
  const runVisualizer = () =>
    updateProject((project) => ({
      ...project,
      visualization: visualizeScenes(project.improvement?.improvedText || project.sourceText, project.analysis || analyzeStory(project.sourceText)),
    }));
  const runBudget = () =>
    updateProject((project) => ({
      ...project,
      budget: estimateBudget(project.improvement?.improvedText || project.sourceText, project.analysis || analyzeStory(project.sourceText)),
    }));
  const runMarket = () =>
    updateProject((project) => ({
      ...project,
      market: predictMarket(
        project.improvement?.improvedText || project.sourceText,
        project.analysis || analyzeStory(project.sourceText),
        project.budget || estimateBudget(project.sourceText, project.analysis || analyzeStory(project.sourceText)),
      ),
    }));
  const runPitch = () =>
    updateProject((project) => ({
      ...project,
      pitch: generatePitchDeck(
        project.improvement?.improvedText || project.sourceText,
        project.analysis || analyzeStory(project.sourceText),
        project.budget || estimateBudget(project.sourceText, project.analysis || analyzeStory(project.sourceText)),
        project.market || predictMarket(project.sourceText, project.analysis || analyzeStory(project.sourceText), project.budget),
      ),
    }));

  const renderHome = () => (
    <div className="space-y-6">
      <Card className="border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.34em] text-amber-200/80">Producer-only workflow</p>
            <h1 className="mt-3 text-3xl font-semibold text-white lg:text-4xl">AI Studio</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A virtual film production assistant that guides producers from idea to execution:
              story analysis, improvement, visualization, budgeting, market fit, and pitch generation.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="rounded-full bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 text-slate-950 hover:brightness-105" onClick={createNewProject}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              Start New Project
            </Button>
            <Button variant="secondary" className="rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(modulePath(nextRecommended.key))}>
              Continue Workflow
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-white/10 bg-slate-950/55 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Workflow Tracker</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{currentProject.name}</h2>
            </div>
            <Badge className="rounded-full border border-emerald-300/20 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
              {completedCount}/6 complete
            </Badge>
          </div>
          <div className="mt-6 space-y-4">
            {workflowSteps.map((step, index) => {
              const completed =
                (step.key === "story-analyzer" && currentProject.analysis) ||
                (step.key === "script-improver" && currentProject.improvement) ||
                (step.key === "scene-visualizer" && currentProject.visualization) ||
                (step.key === "budget-estimator" && currentProject.budget) ||
                (step.key === "market-predictor" && currentProject.market) ||
                (step.key === "pitch-generator" && currentProject.pitch);
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => navigate(modulePath(step.key))}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-[1.25rem] border px-4 py-4 text-left transition",
                    completed ? "border-emerald-300/20 bg-emerald-300/5" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                  )}
                >
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-full border", completed ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300")}>
                    {completed ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm font-semibold">{index + 1}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <p className="mt-1 text-xs text-slate-400">{step.hint}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="border-white/10 bg-slate-950/55 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-amber-200" />
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Recent Projects</p>
          </div>
          <div className="mt-5 space-y-3">
            {projects.slice(0, 4).map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setCurrentProjectId(project.id)}
                className={cn(
                  "w-full rounded-[1.2rem] border px-4 py-4 text-left transition",
                  project.id === currentProjectId ? "border-amber-200/25 bg-white/[0.07]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                )}
              >
                <p className="text-sm font-medium text-white">{project.name}</p>
                <p className="mt-1 text-xs text-slate-400">Updated {new Date(project.updatedAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {moduleCards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => navigate(modulePath(card.key))}
            className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-5 text-left transition hover:-translate-y-1 hover:bg-slate-950/60"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <card.icon className="h-5 w-5 text-amber-200" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-4 text-lg font-semibold text-white">{card.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{card.description}</p>
          </button>
        ))}
      </div>
    </div>
  );

  const moduleShell = (title: string, description: string, body: ReactNode, onRun?: () => void) => (
    <div className="space-y-6">
      <Card className="border-white/10 bg-slate-950/55 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Current Project</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {onRun ? (
              <Button className="rounded-full bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 text-slate-950 hover:brightness-105" onClick={onRun}>
                Run Step
              </Button>
            ) : null}
            <Button variant="secondary" className="rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(modulePath(nextRecommended.key))}>
              Suggested Next: {nextRecommended.label}
            </Button>
          </div>
        </div>
      </Card>
      {body}
    </div>
  );

  const sharedInputPanel = (
    <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Project Memory</p>
          <p className="mt-2 text-sm text-slate-300">All modules reuse the same story context. You can skip steps without breaking the flow.</p>
        </div>
        <Badge className="rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/5">Large scripts supported</Badge>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-[0.22em] text-slate-400">Project Name</label>
          <Input value={currentProject.name} onChange={(event) => updateProject((project) => ({ ...project, name: event.target.value }))} className="border-white/10 bg-white/[0.04] text-white" />
          <label className="text-xs uppercase tracking-[0.22em] text-slate-400">Producer Notes</label>
          <Textarea value={currentProject.notes} onChange={(event) => updateProject((project) => ({ ...project, notes: event.target.value }))} className="min-h-[140px] border-white/10 bg-white/[0.04] text-white" placeholder="Packaging notes, talent targets, platform assumptions..." />
        </div>
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-[0.22em] text-slate-400">Story / Script / Synopsis</label>
          <Textarea value={currentProject.sourceText} onChange={(event) => updateProject((project) => ({ ...project, sourceText: event.target.value }))} className="min-h-[240px] border-white/10 bg-white/[0.04] text-white" placeholder="Paste story, synopsis, beat sheet, or script pages here." />
        </div>
      </div>
    </Card>
  );

  const renderModule = () => {
    if (activeModule === "home") return renderHome();

    if (activeModule === "story-analyzer") {
      const analysis = currentProject.analysis;
      return moduleShell(
        "Story Analyzer",
        "Upload or paste story material, then extract structural, emotional, and commercial signals for production decisions.",
        <div className="space-y-6">
          {sharedInputPanel}
          {analysis ? (
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">AI Scores</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[
                    ["Overall", analysis.overallScore],
                    ["Originality", analysis.originalityScore],
                    ["Audience", analysis.audienceEngagement],
                    ["Commercial", analysis.commercialViability],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{(Number(value) / 10).toFixed(1)}/10</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Detected Genre</p>
                  <p className="mt-2 text-xl font-semibold text-white">{analysis.genre}</p>
                </div>
              </Card>
              <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Insights</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Strengths</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">{analysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Weaknesses</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">{analysis.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Suggestions</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">{analysis.suggestions.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </div>,
        runAnalysis,
      );
    }

    if (activeModule === "script-improver") {
      const improvement = currentProject.improvement;
      return moduleShell(
        "Script Improver",
        "Rewrite dialogue, increase emotion, sharpen pacing, and maintain consistency using analysis and producer notes.",
        <div className="space-y-6">
          {sharedInputPanel}
          <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Improvement Modes</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {[
                ["emotional", "Emotional Enhancement"],
                ["humor", "Humor Mode"],
                ["intensity", "High Intensity"],
                ["dialogue", "Cinematic Dialogue"],
              ].map(([key, label]) => (
                <Button key={key} variant="secondary" className={cn("rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10", improverMode === key && "border-amber-200/30 bg-amber-200/10 text-amber-100")} onClick={() => setImproverMode(key)}>
                  {label}
                </Button>
              ))}
            </div>
          </Card>
          {improvement ? (
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Change Summary</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">{improvement.changes.map((item) => <div key={item} className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3">{item}</div>)}</div>
              </Card>
              <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Improved Draft</p>
                <Textarea value={improvement.improvedText} readOnly className="mt-4 min-h-[320px] border-white/10 bg-white/[0.04] text-white" />
              </Card>
            </div>
          ) : null}
        </div>,
        runImprover,
      );
    }

    if (activeModule === "scene-visualizer") {
      const visualization = currentProject.visualization;
      return moduleShell(
        "Scene Visualizer",
        "Translate narrative intent into cinematic direction with camera, lighting, tone, and storyboard-style prompts.",
        <div className="space-y-6">
          {sharedInputPanel}
          {visualization ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {visualization.scenes.map((scene) => (
                <Card key={scene.title} className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
                  <p className="text-lg font-semibold text-white">{scene.title}</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <p><span className="text-slate-500">Camera:</span> {scene.camera}</p>
                    <p><span className="text-slate-500">Lighting:</span> {scene.lighting}</p>
                    <p><span className="text-slate-500">Mood:</span> {scene.mood}</p>
                    <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-3 text-slate-200">{scene.storyboardPrompt}</div>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </div>,
        runVisualizer,
      );
    }

    if (activeModule === "budget-estimator") {
      const budget = currentProject.budget;
      return moduleShell(
        "Budget Estimator",
        "Estimate total production cost using script scale, character count, locations, and workflow context.",
        <div className="space-y-6">
          {sharedInputPanel}
          {budget ? (
            <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Total Estimate</p>
                <p className="mt-3 text-5xl font-semibold text-white">{budget.totalBudget}</p>
                <div className="mt-5 space-y-3 text-sm text-slate-300">{budget.assumptions.map((item) => <div key={item} className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3">{item}</div>)}</div>
              </Card>
              <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Breakdown</p>
                <div className="mt-5 space-y-4">
                  {budget.breakdown.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{item.label}</span>
                        <span className="text-white">${item.value}M</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200" style={{ width: `${Math.min(100, item.value * 4)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}
        </div>,
        runBudget,
      );
    }

    if (activeModule === "market-predictor") {
      const market = currentProject.market;
      return moduleShell(
        "Market Predictor",
        "Predict audience, release platform, trend fit, and commercial confidence using previous workflow outputs.",
        <div className="space-y-6">
          {sharedInputPanel}
          {market ? (
            <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Market Read</p>
                <p className="mt-3 text-4xl font-semibold text-white">{market.successProbability}%</p>
                <p className="mt-2 text-sm text-slate-300">Success probability based on structure, scope, and current positioning.</p>
                <div className="mt-5 rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Best Platform</p>
                  <p className="mt-2 text-xl font-semibold text-white">{market.platform}</p>
                </div>
              </Card>
              <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-white">Target Audience</p>
                    <div className="mt-3 flex flex-wrap gap-2">{market.targetAudience.map((item) => <Badge key={item} className="rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/5">{item}</Badge>)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Comparable Films</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-300">{market.comparableFilms.map((item) => <div key={item} className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3">{item}</div>)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Market Trends</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-300">{market.trends.map((item) => <div key={item} className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3">{item}</div>)}</div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </div>,
        runMarket,
      );
    }

    const pitch = currentProject.pitch;
    return moduleShell(
      "Pitch Generator",
      "Generate a producer-ready pitch deck using the full workflow context: analysis, improvements, visuals, budget, and market signals.",
      <div className="space-y-6">
        {sharedInputPanel}
        {pitch ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Deck Core</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Title</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{pitch.title}</p>
                  <p className="mt-2 text-sm text-amber-100/85">{pitch.tagline}</p>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Logline</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{pitch.logline}</p>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Story Summary</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{pitch.storySummary}</p>
                </div>
              </div>
            </Card>
            <Card className="border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Deck Additions</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Characters</p>
                  <div className="mt-2 space-y-2 text-sm text-slate-200">{pitch.characters.map((item) => <div key={item}>{item}</div>)}</div>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Visual Style</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{pitch.visualStyle}</p>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Budget Summary</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{pitch.budgetSummary}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button className="rounded-full bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 text-slate-950 hover:brightness-105">Export PDF</Button>
                  <Button variant="secondary" className="rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10">Export PPT</Button>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </div>,
      runPitch,
    );
  };

  return (
    <ProducerLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_18%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,0.12),transparent_16%),linear-gradient(180deg,#070914_0%,#0f1220_48%,#140f25_100%)] px-5 py-6 text-slate-100 lg:px-8 lg:py-8">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-4 backdrop-blur-xl">
            <Button className="w-full rounded-full bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 text-slate-950 hover:brightness-105" onClick={createNewProject}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              Start New Project
            </Button>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Pipeline</p>
              <div className="mt-3 space-y-2">
                <button type="button" onClick={() => navigate("/producer/ai-studio")} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition", activeModule === "home" ? "bg-white/[0.08] text-white" : "text-slate-300 hover:bg-white/[0.05]")}>
                  <Sparkles className="h-4 w-4" />
                  <span>AI Studio Home</span>
                </button>
                {moduleCards.map((card) => (
                  <button key={card.key} type="button" onClick={() => navigate(modulePath(card.key))} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition", activeModule === card.key ? "bg-white/[0.08] text-white" : "text-slate-300 hover:bg-white/[0.05]")}>
                    <card.icon className="h-4 w-4" />
                    <span className="flex-1">{card.title}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Active Project</p>
              <p className="mt-2 text-base font-semibold text-white">{currentProject.name}</p>
              <p className="mt-2 text-sm text-slate-400">Next suggested step: {nextRecommended.label}</p>
              <div className="mt-4 h-2 rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200" style={{ width: `${(completedCount / 6) * 100}%` }} />
              </div>
            </div>
          </aside>
          <div>{renderModule()}</div>
        </div>
      </div>
    </ProducerLayout>
  );
};

export default ProducerAIStudio;
