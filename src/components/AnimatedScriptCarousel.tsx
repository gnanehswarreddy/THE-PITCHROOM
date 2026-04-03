import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from "lucide-react";

interface Script {
  id: string;
  title: string;
  logline: string | null;
  genre: string | null;
  writer_name: string;
  is_saved: boolean;
  image_url?: string;
}

interface AnimatedScriptCarouselProps {
  scripts: Script[];
  onSave: (scriptId: string, currentlySaved: boolean) => void;
  onViewScript: (scriptId: string) => void;
}

const AnimatedScriptCarousel = ({ scripts, onSave, onViewScript }: AnimatedScriptCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [detailsEven, setDetailsEven] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<number[]>([]);

  const offsetTop = 200;
  const offsetLeft = 700;
  const cardWidth = 200;
  const cardHeight = 300;
  const gap = 40;

  useEffect(() => {
    if (scripts.length === 0) return;
    orderRef.current = scripts.map((_, i) => i);
    init();
  }, [scripts]);

  const init = () => {
    gsap.set("#pagination", {
      top: offsetTop + cardHeight,
      left: offsetLeft,
      y: 200,
      opacity: 0,
      zIndex: 60,
    });
    gsap.set("nav", { y: -200, opacity: 0 });

    gsap.set(getDetails(0), { opacity: 0, zIndex: 22, x: -200 });
    gsap.set(getDetails(1), { opacity: 0, zIndex: 12, x: -200 });

    scripts.forEach((_, i) => {
      gsap.set(getCard(i), {
        x: offsetLeft + i * (cardWidth + gap),
        y: offsetTop,
        width: cardWidth,
        height: cardHeight,
        zIndex: -i,
        borderRadius: 8,
        ease: "sine.inOut",
      });

      gsap.set(getCardContent(i), {
        x: offsetLeft + i * (cardWidth + gap),
        y: offsetTop,
        opacity: 0,
        display: "none",
      });

      gsap.set(getSliderItem(i), { x: i * 50, zIndex: -i });
    });

    gsap.set(".progress-sub-foreground", {
      width: 500 / scripts.length,
    });

    gsap.to("nav", { y: 0, opacity: 1, ease: "sine.inOut", duration: 1 });
    gsap.to("#pagination", { y: 0, opacity: 1, ease: "sine.inOut", duration: 1 });
    gsap.to(getDetails(0), { opacity: 1, x: 0, ease: "sine.inOut", duration: 1 });
  };

  const getCard = (index: number) => `#card${index}`;
  const getCardContent = (index: number) => `#card-content-${index}`;
  const getSliderItem = (index: number) => `#slide-item-${index}`;
  const getDetails = (index: number) => `#details-${index % 2 === 0 ? "even" : "odd"}`;

  const step = () => {
    return new Promise((resolve) => {
      orderRef.current.push(orderRef.current.shift()!);

      gsap.to(getDetails(0), { opacity: 0, x: -200, duration: 0.3, ease: "sine.inOut" });
      gsap.to(getDetails(1), { opacity: 0, x: -200, duration: 0.3, ease: "sine.inOut" });

      scripts.forEach((_, i) => {
        const currentIndex = orderRef.current.indexOf(i);

        gsap.to(getCard(i), {
          x: offsetLeft + currentIndex * (cardWidth + gap),
          zIndex: -currentIndex,
          duration: 0.5,
          ease: "sine.inOut",
          onComplete: () => {
            if (i === orderRef.current[0]) {
              gsap.set(getDetails(0), {
                zIndex: 22,
              });
              gsap.to(getDetails(0), {
                opacity: 1,
                x: 0,
                ease: "sine.inOut",
                duration: 0.4,
                onComplete: resolve as any,
              });
            }
          },
        });

        gsap.to(getSliderItem(i), { x: currentIndex * 50, zIndex: -currentIndex, duration: 0.5, ease: "sine.inOut" });
      });

      gsap.to(".progress-sub-foreground", {
        width: (orderRef.current[0] + 1) * (500 / scripts.length),
        duration: 0.5,
        ease: "sine.inOut",
      });
    });
  };

  const stepBack = () => {
    return new Promise((resolve) => {
      orderRef.current.unshift(orderRef.current.pop()!);

      gsap.to(getDetails(0), { opacity: 0, x: -200, duration: 0.3, ease: "sine.inOut" });
      gsap.to(getDetails(1), { opacity: 0, x: -200, duration: 0.3, ease: "sine.inOut" });

      scripts.forEach((_, i) => {
        const currentIndex = orderRef.current.indexOf(i);

        gsap.to(getCard(i), {
          x: offsetLeft + currentIndex * (cardWidth + gap),
          zIndex: -currentIndex,
          duration: 0.5,
          ease: "sine.inOut",
          onComplete: () => {
            if (i === orderRef.current[0]) {
              gsap.set(getDetails(0), { zIndex: 22 });
              gsap.to(getDetails(0), {
                opacity: 1,
                x: 0,
                ease: "sine.inOut",
                duration: 0.4,
                onComplete: resolve as any,
              });
            }
          },
        });

        gsap.to(getSliderItem(i), { x: currentIndex * 50, zIndex: -currentIndex, duration: 0.5, ease: "sine.inOut" });
      });

      gsap.to(".progress-sub-foreground", {
        width: (orderRef.current[0] + 1) * (500 / scripts.length),
        duration: 0.5,
        ease: "sine.inOut",
      });
    });
  };

  const handleNext = async () => {
    await step();
    setDetailsEven(!detailsEven);
    setCurrentIndex(orderRef.current[0]);
  };

  const handlePrev = async () => {
    await stepBack();
    setDetailsEven(!detailsEven);
    setCurrentIndex(orderRef.current[0]);
  };

  if (scripts.length === 0) return null;

  const currentScript = scripts[orderRef.current[0]] || scripts[0];

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-background">
      <div id="demo" className="relative">
        {scripts.map((script, index) => (
          <div
            key={script.id}
            id={`card${index}`}
            className="absolute card overflow-hidden shadow-2xl"
          >
            {script.image_url ? (
              <img
                src={script.image_url}
                alt={script.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/70" />
            )}
          </div>
        ))}
      </div>

      <div id="details-even" className="absolute top-60 left-16 z-[22] opacity-0">
        <div className="h-12 overflow-hidden">
          <div className="pt-4 text-xl relative">
            <div className="absolute top-0 left-0 w-8 h-1 rounded-full bg-primary" />
            {currentScript.genre || "Script"}
          </div>
        </div>
        <div className="mt-1 h-24 overflow-hidden">
          <div className="text-7xl font-bold font-['Oswald']">{currentScript.title.split(" ")[0]}</div>
        </div>
        <div className="mt-1 h-24 overflow-hidden">
          <div className="text-7xl font-bold font-['Oswald']">
            {currentScript.title.split(" ").slice(1).join(" ") || ""}
          </div>
        </div>
        <div className="mt-4 w-[500px] text-muted-foreground">
          {currentScript.logline || "No logline available"}
        </div>
        <div className="mt-4 text-sm text-muted-foreground">by {currentScript.writer_name}</div>
        <div className="w-[500px] mt-6 flex items-center gap-4">
          <Button
            onClick={() => onSave(currentScript.id, currentScript.is_saved)}
            className="w-10 h-10 rounded-full p-0"
            variant={currentScript.is_saved ? "default" : "outline"}
          >
            {currentScript.is_saved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </Button>
          <Button onClick={() => onViewScript(currentScript.id)} className="px-6 uppercase text-xs">
            View Script
          </Button>
        </div>
      </div>

      <div id="details-odd" className="absolute top-60 left-16 z-[12] opacity-0">
        <div className="h-12 overflow-hidden">
          <div className="pt-4 text-xl relative">
            <div className="absolute top-0 left-0 w-8 h-1 rounded-full bg-primary" />
            {currentScript.genre || "Script"}
          </div>
        </div>
        <div className="mt-1 h-24 overflow-hidden">
          <div className="text-7xl font-bold font-['Oswald']">{currentScript.title.split(" ")[0]}</div>
        </div>
        <div className="mt-1 h-24 overflow-hidden">
          <div className="text-7xl font-bold font-['Oswald']">
            {currentScript.title.split(" ").slice(1).join(" ") || ""}
          </div>
        </div>
        <div className="mt-4 w-[500px] text-muted-foreground">
          {currentScript.logline || "No logline available"}
        </div>
        <div className="mt-4 text-sm text-muted-foreground">by {currentScript.writer_name}</div>
        <div className="w-[500px] mt-6 flex items-center gap-4">
          <Button
            onClick={() => onSave(currentScript.id, currentScript.is_saved)}
            className="w-10 h-10 rounded-full p-0"
            variant={currentScript.is_saved ? "default" : "outline"}
          >
            {currentScript.is_saved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </Button>
          <Button onClick={() => onViewScript(currentScript.id)} className="px-6 uppercase text-xs">
            View Script
          </Button>
        </div>
      </div>

      <div id="pagination" className="absolute flex items-center gap-4 opacity-0">
        <Button onClick={handlePrev} size="icon" variant="ghost" className="arrow-left">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button onClick={handleNext} size="icon" variant="ghost" className="arrow-right">
          <ChevronRight className="w-6 h-6" />
        </Button>
        <div className="progress-sub-container ml-4">
          <div className="w-[500px] h-1 bg-muted rounded-full progress-sub-background">
            <div className="h-full bg-primary rounded-full progress-sub-foreground transition-all" />
          </div>
        </div>
        <div id="slide-numbers" className="flex ml-4">
          {scripts.map((_, index) => (
            <div
              key={index}
              id={`slide-item-${index}`}
              className="absolute w-12 h-12 flex items-center justify-center text-sm font-medium"
            >
              {index + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimatedScriptCarousel;
