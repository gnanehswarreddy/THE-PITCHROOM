import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Upload, BarChart3, Users, Search, MessageSquare, BookmarkPlus, Sparkles, Eye, Filter, Zap, Lock, FileCheck, Globe } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

function useReveal(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const Home = () => {
  const [scrolled, setScrolled] = useState(false);
  const stats = useReveal(0.2);
  const writers = useReveal(0.15);
  const producers = useReveal(0.15);
  const howItWorks = useReveal(0.15);
  const preview = useReveal(0.15);
  const security = useReveal(0.15);
  const finalCta = useReveal(0.2);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="bg-background text-foreground min-h-screen font-inter selection:bg-primary/40">

      {/* ── Sticky Navbar ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold font-space">
            <span className="text-foreground">Pitch</span>
            <span className="text-primary">Room</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#writers" className="hover:text-foreground transition-colors">For Writers</a>
            <a href="#producers" className="hover:text-foreground transition-colors">For Producers</a>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Login</Link>
            <Link to="/signup" className="text-sm px-5 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_20px_hsl(265_85%_58%/0.3)]">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/10 blur-[150px] rounded-full" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
              AI-Powered Film Development
            </div>
            <h1 className="text-4xl md:text-6xl font-bold font-space text-foreground leading-tight mb-6">
              Where Stories Meet<br />
              <span className="text-primary glow-text">The Screen</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mb-10 leading-relaxed">
              The AI-powered platform where screenwriters craft stories and producers discover their next hit. Together.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Link to="/signup" className="inline-block px-8 py-3.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-[0_0_20px_hsl(265_85%_58%/0.3)] text-center">
                Create Account
              </Link>
              <Link to="/login" className="inline-block px-8 py-3.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all text-center">
                Login
              </Link>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <span><strong className="text-foreground">2,500+</strong> Scripts</span>
              <span><strong className="text-foreground">800+</strong> Writers</span>
              <span><strong className="text-foreground">300+</strong> Producers</span>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="relative rounded-2xl border border-border bg-card/90 backdrop-blur-xl p-6 shadow-[0_0_60px_hsl(265_85%_58%/0.1)]">
              <div className="flex gap-1.5 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="space-y-4">
                <div className="h-8 w-48 rounded-lg bg-muted" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-20 rounded-lg bg-primary/10 border border-primary/20" />
                  <div className="h-20 rounded-lg bg-accent/10 border border-accent/15" />
                  <div className="h-20 rounded-lg bg-[hsl(38_80%_65%/0.08)] border border-[hsl(38_80%_65%/0.15)]" />
                </div>
                <div className="h-32 rounded-lg bg-muted border border-border" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 rounded-lg bg-muted" />
                  <div className="h-16 rounded-lg bg-muted" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section ref={stats.ref} className="py-20 px-6">
        <div className={`max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 transition-all duration-1000 ${stats.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          {[
            { num: "2,500+", label: "Scripts Reviewed" },
            { num: "800+", label: "Writers" },
            { num: "300+", label: "Producers" },
            { num: "95%", label: "AI Accuracy" },
          ].map((s, i) => (
            <div key={i} className="text-center py-8 rounded-xl border border-border bg-card/50 backdrop-blur-md">
              <p className="text-3xl md:text-4xl font-bold font-space text-foreground">{s.num}</p>
              <p className="text-sm text-muted-foreground mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── For Writers Section ── */}
      <section id="writers" ref={writers.ref} className="py-24 px-6">
        <div className={`max-w-6xl mx-auto transition-all duration-1000 ${writers.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-space text-foreground mb-4">Built for Writers</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Everything you need to craft, analyze, and pitch your screenplay.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" id="features">
            {[
              { icon: Upload, title: "Upload Scripts Securely", desc: "Upload your screenplay in any format with enterprise-grade security." },
              { icon: Sparkles, title: "AI Script Insights", desc: "Get intelligent feedback on structure, pacing, and character development." },
              { icon: BarChart3, title: "Market Viability Analysis", desc: "Real-time market data and genre trends for your script." },
              { icon: Users, title: "Direct Producer Access", desc: "Connect directly with verified producers looking for content." },
              { icon: Eye, title: "Script Analytics", desc: "Track views, engagement, and interest from producers." },
            ].map((f, i) => (
              <div key={i} className="group rounded-xl border border-border bg-card/50 backdrop-blur-md p-6 hover:border-primary/40 hover:bg-card/80 transition-all duration-300 hover:shadow-[0_0_25px_hsl(265_85%_58%/0.1)]">
                <f.icon className="w-8 h-8 text-primary mb-4" />
                <h4 className="text-lg font-semibold font-space text-foreground mb-2">{f.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Producers Section ── */}
      <section id="producers" ref={producers.ref} className="py-24 px-6">
        <div className={`max-w-6xl mx-auto transition-all duration-1000 ${producers.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-space text-foreground mb-4">Built for Producers</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Discover your next project faster with AI-powered tools.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Search, title: "Discover Curated Scripts", desc: "Browse AI-curated scripts matched to your preferences." },
              { icon: Zap, title: "AI Summaries Instantly", desc: "Get instant AI-generated loglines and script summaries." },
              { icon: Filter, title: "Smart Filtering", desc: "Filter scripts by genre, budget, language, and market fit." },
              { icon: MessageSquare, title: "Direct Messaging", desc: "Message writers directly and negotiate seamlessly." },
              { icon: BookmarkPlus, title: "Save & Track Projects", desc: "Organize scripts into collections and track progress." },
            ].map((f, i) => (
              <div key={i} className="group rounded-xl border border-border bg-card/50 backdrop-blur-md p-6 hover:border-accent/30 hover:bg-card/80 transition-all duration-300 hover:shadow-[0_0_25px_hsl(175_85%_45%/0.1)]">
                <f.icon className="w-8 h-8 text-accent mb-4" />
                <h4 className="text-lg font-semibold font-space text-foreground mb-2">{f.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" ref={howItWorks.ref} className="py-24 px-6">
        <div className={`max-w-4xl mx-auto transition-all duration-1000 ${howItWorks.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-space text-foreground mb-4">How It Works</h2>
            <p className="text-muted-foreground">Three steps to your next production.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: "01", icon: Upload, title: "Upload", desc: "Upload your screenplay in any format. AI parses it instantly." },
              { step: "02", icon: Sparkles, title: "Analyze", desc: "Get AI-powered insights, market data, and enhancement suggestions." },
              { step: "03", icon: Users, title: "Connect", desc: "Match with producers, share scripts, and move to production." },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-6xl font-bold font-space text-primary/15 mb-4">{s.step}</p>
                <s.icon className="w-10 h-10 text-primary mx-auto mb-4" />
                <h4 className="text-xl font-semibold font-space text-foreground mb-2">{s.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product Preview ── */}
      <section ref={preview.ref} className="py-24 px-6">
        <div className={`max-w-6xl mx-auto transition-all duration-1000 ${preview.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-space text-foreground mb-4">See It In Action</h2>
            <p className="text-muted-foreground">A glimpse into the PitchRoom experience.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "Writer Dashboard", desc: "Manage scripts, track analytics, and access AI tools." },
              { title: "Script Upload", desc: "Drag & drop your screenplay for instant AI analysis." },
              { title: "Producer Discovery", desc: "Browse and filter curated scripts by genre and market fit." },
              { title: "Messaging", desc: "Real-time encrypted messaging between writers and producers." },
            ].map((p, i) => (
              <div key={i} className="rounded-xl border border-border bg-card/50 p-6">
                <div className="flex gap-1.5 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                  <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
                  <span className="w-2 h-2 rounded-full bg-[#28c840]" />
                </div>
                <div className="h-32 rounded-lg bg-muted border border-border mb-4" />
                <h4 className="font-semibold font-space text-foreground mb-1">{p.title}</h4>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security Section ── */}
      <section ref={security.ref} className="py-24 px-6">
        <div className={`max-w-4xl mx-auto transition-all duration-1000 ${security.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-space text-foreground mb-4">Your Work, Protected</h2>
            <p className="text-muted-foreground">Enterprise-grade security for your creative assets.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { icon: Shield, label: "Secure Uploads" },
              { icon: Eye, label: "Private Visibility" },
              { icon: Lock, label: "Encrypted Messaging" },
              { icon: FileCheck, label: "IP Protection" },
            ].map((s, i) => (
              <div key={i} className="text-center py-8 rounded-xl border border-border bg-card/50">
                <s.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section ref={finalCta.ref} className="py-32 px-6 relative">
        <div className={`relative z-10 max-w-3xl mx-auto text-center transition-all duration-1000 ${finalCta.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-4xl md:text-5xl font-bold font-space text-foreground mb-6">
            Your Next Film Starts Here.
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
            Join thousands of writers and producers already using PitchRoom.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup" className="inline-block px-10 py-4 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-[0_0_20px_hsl(265_85%_58%/0.3)]">
              Sign Up
            </Link>
            <Link to="/login" className="inline-block px-10 py-4 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all">
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <Link to="/" className="text-lg font-bold font-space">
            <span className="text-foreground">Pitch</span>
            <span className="text-primary">Room</span>
          </Link>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">About</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 PitchRoom. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;

