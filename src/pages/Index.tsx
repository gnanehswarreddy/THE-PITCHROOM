import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, stagger } from "framer-motion";
import Lenis from "lenis";
import { ThemeToggle } from "@/components/ThemeToggle";

// ── Typewriter Hook ──
function useTypewriter(lines: string[], speed = 40, pauseBetween = 1500) {
  const [display, setDisplay] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      for (let i = 0; i < lines.length; i++) {
        const chars = lines[i].split("");
        for (let j = 0; j <= chars.length; j++) {
          if (cancelled) return;
          setDisplay((prev) => {
            const next = [...prev];
            next[i] = lines[i].slice(0, j);
            return next;
          });
          await new Promise((r) => setTimeout(r, speed));
        }
        if (i < lines.length - 1) await new Promise((r) => setTimeout(r, pauseBetween));
      }
      if (!cancelled) setDone(true);
    }
    run();
    return () => { cancelled = true; };
  }, []);

  return { display, done };
}

// ── Animation Variants (GPU optimized: transform + opacity) ──
const customEasing = (t: number) => {
  const c1 = 0.22;
  const c3 = 0.36;
  const c4 = 1;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : c1 * 3 * (1 - t) * (1 - t) * t +
      3 * (1 - c1) * (1 - t) * t * t +
      c4 * t * t * t;
};

const easing = "easeOut"; // Use Framer Motion's built-in easing for type safety

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30, filter: "blur(10px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -30 },
};

const scaleUpVariant = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

const floatingVariant = (delay: number, duration: number = 3) => ({
  animate: {
    y: [0, -15, 0],
    transition: {
      duration,
      repeat: Infinity,
      delay,
      ease: "easeInOut",
    },
  },
});

const pulseVariant = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ── 3D tilt component with Framer Motion ──
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientY - rect.top) / rect.height - 0.5;
    const y = (e.clientX - rect.left) / rect.width - 0.5;
    setRotation({
      x: x * -8,
      y: y * 8,
    });
  }, []);

  const handleLeave = useCallback(() => {
    setRotation({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      animate={{
        rotateX: rotation.x,
        rotateY: rotation.y,
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ perspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Floating card with Framer Motion ──
function FloatingCard({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
  const duration = 3 + Math.random() * 1;
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: easing, delay }}
      viewport={{ once: true, margin: "-100px" }}
      animate={{
        y: [0, -12, 0],
        transition: {
          duration,
          repeat: Infinity,
          delay: Math.random() * 2,
          ease: "easeInOut",
        },
      }}
      className="rounded-lg border border-primary/30 bg-card/80 backdrop-blur-md px-4 py-3 will-change-transform"
    >
      <p className="text-[10px] uppercase tracking-widest text-primary">{label}</p>
      <p className="text-sm font-bold text-foreground font-space">{value}</p>
    </motion.div>
  );
}

// ── Letter Split Animation ──
function SplitText({ text, className = "" }: { text: string; className?: string }) {
  const letters = text.split("");
  return (
    <span className={className}>
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            delay: i * 0.04,
            ease: easing,
          }}
          className="inline-block"
        >
          {letter === " " ? "\u00A0" : letter}
        </motion.span>
      ))}
    </span>
  );
}


// ── Main Page ──
const Index = () => {
  const { display, done } = useTypewriter([
    "Every great story begins with a blank page.",
    "But what if the page could write back?",
  ]);

  const screenplayLines = [
    "INT. DARK STUDIO - NIGHT",
    "",
    "A young filmmaker stares at an empty screen.",
    "The cursor blinks.",
    "Then... the story begins to write itself.",
    "",
    "FADE IN.",
    "",
    "A world unlike any other materializes",
    "from the depths of imagination.",
  ];
  const screenplay = useTypewriter(screenplayLines, 30, 200);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLocked, setScrollLocked] = useState(true);

  // ── Initialize Lenis Smooth Scrolling ──
  useEffect(() => {
    const lenis = new Lenis({
      duration: 0.4,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      lerp: 0.35,
      wheelMultiplier: 1.8,
      touchMultiplier: 2.5,
    });

    // Lock scroll on initial load
    if (scrollLocked) {
      lenis.stop();
    }

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, [scrollLocked]);

  const handleBeginStory = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    // Cinematic delay
    await new Promise((r) => setTimeout(r, 500));

    // Unlock scroll and enable scrolling
    setScrollLocked(false);
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";

    // Smooth scroll to struggle section
    const struggleSection = document.getElementById("struggle");
    if (struggleSection) {
      setTimeout(() => {
        struggleSection.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, []);

  return (
    <div ref={containerRef} className={`bg-background text-foreground overflow-x-hidden font-inter selection:bg-primary/40 ${scrollLocked ? "overflow-hidden" : ""}`}>

      {/* Theme toggle - fixed top right */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-3">
          <Link
            to="/home"
            className="rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-md transition hover:border-primary/40 hover:text-foreground"
          >
            Skip to Home
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* SECTION 1 - THE BLANK FRAME */}
      <motion.section
        className="relative h-screen flex flex-col items-center justify-center px-6"
        initial={{ opacity: 1 }}
      >
        {/* grain overlay */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none grain-overlay" />

        {/* glow with pulse */}
        <motion.div
          className={`absolute w-[500px] h-[500px] rounded-full bg-primary/15 blur-[120px] will-change-transform`}
          animate={done ? { scale: [1, 1.05, 1] } : {}}
          transition={done ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" } : {}}
          style={{ opacity: done ? 1 : 0 }}
        />

        {/* typewriter text with stagger */}
        <motion.div
          className="relative z-10 text-center font-courier italic"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <AnimatePresence>
            {display.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: i * 0.2, ease: easing }}
                className="text-xl md:text-2xl text-muted-foreground mb-3 min-h-[2rem] tracking-wide"
              >
                {line}
                {i === display.length - 1 && !done && (
                  <motion.span
                    animate={{ opacity: [1, 0.3] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-[2px] h-6 bg-muted-foreground ml-1 not-italic"
                  />
                )}
              </motion.p>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Logo with letter split animation */}
        <motion.div
          className="relative z-10 mt-12"
          initial={{ opacity: 0 }}
          animate={done ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <h1 className="text-6xl md:text-8xl font-bold font-space">
            <span className="text-foreground">
              <SplitText text="Pitch" />
            </span>
            <motion.span
              className="text-primary block"
              style={{
                textShadow: "0 0 30px hsl(265 85% 58% / 0.4)",
              }}
              animate={done ? { filter: ["drop-shadow(0 0 10px hsl(265 85% 58% / 0.3)) drop-shadow(0 0 20px hsl(265 85% 58% / 0.2))", "drop-shadow(0 0 20px hsl(265 85% 58% / 0.5)) drop-shadow(0 0 40px hsl(265 85% 58% / 0.3))"] } : {}}
              transition={done ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
            >
              <SplitText text="Room" />
            </motion.span>
          </h1>
          <motion.div
            className="absolute inset-0 blur-3xl opacity-40 bg-gradient-to-r from-primary/30 to-primary/15 -z-10 will-change-transform"
            animate={done ? { opacity: [0.3, 0.5, 0.3] } : {}}
            transition={done ? { duration: 2.5, repeat: Infinity } : {}}
          />
        </motion.div>

        {/* CTA with pulse */}
        <motion.div
          className="relative z-10 mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={done ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <motion.a
            href="#struggle"
            onClick={handleBeginStory}
            className="inline-block px-10 py-4 rounded-full font-space font-semibold text-lg text-primary-foreground bg-gradient-to-r from-primary to-accent shadow-[0_0_30px_hsl(265_85%_58%/0.4)]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            animate={done ? { boxShadow: ["0 0 30px hsl(265 85% 58% / 0.4)", "0 0 50px hsl(265 85% 58% / 0.6)", "0 0 30px hsl(265 85% 58% / 0.4)"] } : {}}
            transition={done ? { duration: 1.5, repeat: Infinity } : {}}
          >
            Begin the Story
          </motion.a>
        </motion.div>
      </motion.section>

      {/* ══════ SECTION 2 – THE CREATOR STRUGGLE ══════ */}
      <motion.section
        id="struggle"
        className="relative min-h-[120vh] flex flex-col items-center justify-center px-6 py-32"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <div className="max-w-2xl mx-auto space-y-20 text-center">
          {/* Story text section with staggered animations */}
          <motion.div
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: easing }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <p className="text-2xl md:text-3xl font-space font-medium text-foreground/85">
              <SplitText text="You imagine worlds." />
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: easing, delay: 0.2 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <p className="text-2xl md:text-3xl font-space font-medium text-foreground/80">
              <SplitText text="You create characters." />
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: easing, delay: 0.4 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <p className="text-2xl md:text-3xl font-space font-medium text-foreground/75">
              <SplitText text="But structure slows you down." />
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: easing, delay: 0.6 }}
            viewport={{ once: true, margin: "-100px" }}
            whileHover={{ scale: 1.02 }}
            className="will-change-transform"
          >
            <p className="text-4xl md:text-5xl font-space font-bold text-primary glow-text-primary">
              <SplitText text="Until now." />
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* ══════ SECTION 3 – AI AWAKENS ══════ */}
      <motion.section
        className="relative min-h-screen flex items-center justify-center px-4 py-24"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <motion.div
          className="relative w-full max-w-4xl"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: easing }}
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* glow border */}
          <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-primary/50 via-transparent to-accent/30 blur-sm" />

          <div className="relative flex flex-col lg:flex-row gap-6 rounded-2xl bg-card/90 backdrop-blur-xl border border-primary/15 p-6 md:p-10">
            {/* screenplay with typewriter effect */}
            <motion.div
              className="flex-1 rounded-xl bg-background p-6 border border-border/50 will-change-transform"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: easing, delay: 0.2 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <div className="flex gap-1.5 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="font-courier text-xs md:text-sm leading-relaxed text-muted-foreground space-y-0.5">
                {screenplay.display.map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1 }}
                    className={i === 0 ? "font-bold uppercase text-foreground/85" : ""}
                  >
                    {line || "\u00A0"}
                  </motion.p>
                ))}
              </div>
            </motion.div>

            {/* insight cards from right */}
            <motion.div
              className="flex flex-row lg:flex-col gap-3 lg:w-44 justify-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, staggerChildren: 0.15, delayChildren: 0.3 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <FloatingCard label="Market Viability" value="High" delay={0} />
              <FloatingCard label="Genre Match" value="Psychological Thriller" delay={0.15} />
              <FloatingCard label="Audience Reach" value="Global 18-35" delay={0.3} />
            </motion.div>
          </div>
        </motion.div>
      </motion.section>

      {/* ══════ SECTION 4 – PRODUCT DEPTH ══════ */}
      <motion.section
        className="relative min-h-screen flex items-center justify-center px-6 py-32"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <div className="absolute inset-0 opacity-[0.03] grid-bg" />

        <motion.div
          className="relative w-full max-w-4xl flex flex-col items-start gap-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, staggerChildren: 0.25, delayChildren: 0.2 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          {[
            { title: "Story Architect", desc: "Structure narratives with AI-driven story intelligence.", offset: "ml-[5%]" },
            { title: "Industry Intelligence\nEngine", desc: "Real-time market data meets creative intuition.", offset: "ml-[25%]" },
            { title: "IP Protection System", desc: "Secure your creative assets from day one.", offset: "ml-[45%]" },
          ].map((mod, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: easing }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <TiltCard className={`${mod.offset} will-change-transform`}>
                <motion.div
                  className="relative group rounded-xl border border-primary/40 bg-card/90 backdrop-blur-md px-8 py-6 w-80"
                  whileHover={{
                    borderColor: "hsl(265 85% 58% / 0.8)",
                    boxShadow: "0 0 25px hsl(265 85% 58% / 0.2)",
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    className="absolute -inset-[1px] rounded-xl bg-primary/10 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500"
                    animate={{ opacity: [0, 0] }}
                  />
                  <h3 className="relative text-lg font-bold font-space text-foreground mb-2 whitespace-pre-line">
                    {mod.title}
                  </h3>
                  <p className="relative text-sm text-muted-foreground leading-relaxed">{mod.desc}</p>
                </motion.div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ══════ SECTION 5 – THE TRANSFORMATION ══════ */}
      <motion.section
        className="relative min-h-[80vh] flex flex-col items-center justify-center px-6 py-32"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[hsl(38_80%_65%/0.08)] blur-[100px] rounded-full" />

        <motion.div
          className="relative z-10 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easing }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <p className="text-3xl md:text-5xl font-space font-bold text-foreground mb-4">
            <SplitText text="The industry doesn't wait." />
          </p>

          <motion.div
            initial={{ backgroundPosition: "0% center" }}
            whileInView={{ backgroundPosition: "100% center" }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            style={{
              backgroundImage: "linear-gradient(270deg, hsl(38_80%_65%), hsl(38_80%_65%), hsl(38_80%_65%) 50%, hsl(265_85%_58%), hsl(38_80%_65%))",
              backgroundSize: "200% center",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
            className="text-3xl md:text-5xl font-space font-bold"
          >
            <SplitText text="Why should you?" />
          </motion.div>

          <motion.div
            className="mt-12"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.div
              animate={{
                boxShadow: ["0 0 20px hsl(38 80% 65% / 0.2)", "0 0 40px hsl(38 80% 65% / 0.4)", "0 0 20px hsl(38 80% 65% / 0.2)"],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Link
                to="/home"
                className="inline-block px-10 py-4 rounded-full font-space font-bold text-sm uppercase tracking-widest text-[hsl(38_80%_65%)] border-2 border-[hsl(38_80%_65%/0.6)] bg-transparent hover:bg-[hsl(38_80%_65%/0.08)] will-change-transform"
              >
                ENTER PITCHROOM
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ══════ FOOTER ══════ */}
      <motion.footer
        className="border-t border-border py-8 px-6"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-lg font-bold font-space">
            <span className="text-foreground">Pitch</span>
            <span className="text-primary">Room</span>
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">About</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default Index;


