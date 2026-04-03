import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import RequireAuth from "./components/RequireAuth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SelectRole from "./pages/SelectRole";
import Onboarding from "./pages/Onboarding";
import WriterDashboard from "./pages/writer/WriterDashboard";
import WriterScripts from "./pages/writer/WriterScripts";
import WriterScriptViewer from "./pages/writer/WriterScriptViewer";
import UploadScript from "./pages/writer/UploadScript";
import AIEditor from "./pages/writer/AIEditor";
import ScriptAnalysis from "./pages/writer/ScriptAnalysis";
import EnhanceDashboard from "./pages/writer/EnhanceDashboard";
import WriterMessages from "./pages/writer/Messages";
import WriterAnalytics from "./pages/writer/Analytics";
import WriterIntelligence from "./pages/writer/Intelligence";
import WriterStories from "./pages/writer/Stories";
import ProducerDashboard from "./pages/producer/ProducerDashboard";
import ProducerDiscover from "./pages/producer/Discover";
import ProducerCollections from "./pages/producer/Collections";
import ProducerMessages from "./pages/producer/Messages";
import ProducerAnalytics from "./pages/producer/Analytics";
import ProducerIntelligence from "./pages/producer/Intelligence";
import ProducerAIStudio from "./pages/producer/AIStudio";
import Community from "./pages/shared/Community";
import Academy from "./pages/shared/Academy";
import AILabs from "./pages/shared/AILabs";
import Profile from "./pages/shared/Profile";
import Network from "./pages/shared/Network";
import SharedIntelligence from "./pages/shared/Intelligence";
import ScriptViewer from "./pages/producer/ScriptViewer";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import ComingSoon from "./pages/shared/ComingSoon";
import { ROUTES } from "@/lib/routes";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="pitchroom-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path={ROUTES.root} element={<Index />} />
            <Route path={ROUTES.home} element={<Home />} />
            <Route path={ROUTES.login} element={<Login />} />
            <Route path={ROUTES.signup} element={<Signup />} />
            <Route
              path={ROUTES.selectRole}
              element={
                <RequireAuth>
                  <SelectRole />
                </RequireAuth>
              }
            />
            <Route
              path={ROUTES.onboarding}
              element={
                <RequireAuth>
                  <Onboarding />
                </RequireAuth>
              }
            />

            <Route
              path={ROUTES.writerDashboard}
              element={
                <RequireAuth requiredRole="writer">
                  <WriterDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/scripts"
              element={
                <RequireAuth requiredRole="writer">
                  <WriterScripts />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/scripts/:id"
              element={
                <RequireAuth requiredRole="writer">
                  <WriterScriptViewer />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/scripts/new"
              element={
                <RequireAuth requiredRole="writer">
                  <UploadScript />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/analysis"
              element={
                <RequireAuth requiredRole="writer">
                  <ScriptAnalysis />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/enhance"
              element={
                <RequireAuth requiredRole="writer">
                  <EnhanceDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/editor"
              element={
                <RequireAuth requiredRole="writer">
                  <AIEditor />
                </RequireAuth>
              }
            />
            <Route
              path="/ai-studio"
              element={
                <RequireAuth requiredRole="writer">
                  <AIEditor />
                </RequireAuth>
              }
            />
            <Route
              path="/ai-studio/:id"
              element={
                <RequireAuth requiredRole="writer">
                  <AIEditor />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/messages"
              element={
                <RequireAuth requiredRole="writer">
                  <WriterMessages />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/stories"
              element={
                <RequireAuth requiredRole="writer">
                  <WriterStories />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/analytics"
              element={
                <RequireAuth requiredRole="writer">
                  <WriterAnalytics />
                </RequireAuth>
              }
            />
            <Route
              path="/writer/intelligence"
              element={
                <RequireAuth requiredRole="writer">
                  <WriterIntelligence />
                </RequireAuth>
              }
            />

            <Route
              path={ROUTES.producerDashboard}
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/discover"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerDiscover />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/messages"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerMessages />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/collections"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerCollections />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/analytics"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerAnalytics />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/intelligence"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerIntelligence />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/ai-studio"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerAIStudio />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/ai-studio/story-analyzer"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerAIStudio />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/ai-studio/script-improver"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerAIStudio />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/ai-studio/scene-visualizer"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerAIStudio />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/ai-studio/budget-estimator"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerAIStudio />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/ai-studio/market-predictor"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerAIStudio />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/ai-studio/pitch-generator"
              element={
                <RequireAuth requiredRole="producer">
                  <ProducerAIStudio />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/settings"
              element={
                <RequireAuth requiredRole="producer">
                  <ComingSoon />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/studio"
              element={
                <RequireAuth requiredRole="producer">
                  <Navigate to="/producer/dashboard" replace />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/ai-labs"
              element={
                <RequireAuth requiredRole="producer">
                  <Navigate to="/producer/dashboard" replace />
                </RequireAuth>
              }
            />
            <Route
              path="/producer/script/:id"
              element={
                <RequireAuth requiredRole="producer">
                  <ScriptViewer />
                </RequireAuth>
              }
            />

            <Route
              path="/studio"
              element={
                <RequireAuth requiredRole="writer">
                  <AILabs />
                </RequireAuth>
              }
            />
            <Route
              path="/intelligence"
              element={
                <RequireAuth>
                  <SharedIntelligence />
                </RequireAuth>
              }
            />
            <Route
              path="/community"
              element={
                <RequireAuth>
                  <Community />
                </RequireAuth>
              }
            />
            <Route
              path="/academy"
              element={
                <RequireAuth>
                  <Academy />
                </RequireAuth>
              }
            />
            <Route
              path="/network"
              element={
                <RequireAuth>
                  <Network />
                </RequireAuth>
              }
            />
            <Route
              path="/labs"
              element={
                <RequireAuth requiredRole="writer">
                  <AILabs />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <Profile />
                </RequireAuth>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
