import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { HeroSection } from "./components/sections/HeroSection";
import { TechnicalSection } from "./components/sections/TechnicalSection";
import { NetworkSpecsSection } from "./components/sections/NetworkSpecsSection";
import { SystemPulseSection } from "./components/sections/SystemPulseSection";
import { LiquiditySection } from "./components/sections/LiquiditySection";
import { EcosystemSection } from "./components/sections/EcosystemSection";
import { FloatingNav } from "./components/ui/FloatingNav";
import { useHealth } from "./hooks/useApi";
import { useState, useEffect } from "react";
import { Home, BarChart3, ChevronRight } from "lucide-react";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3, // Increased retry attempts
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      staleTime: 30000, // Consider data fresh for 30 seconds
    },
  },
});

// Landing Page (Page 1)
function LandingPage() {
  const { data: healthData } = useHealth();
  const isOperational = healthData?.status === "ok";

  return (
    <div className="relative min-h-screen">
      {/* Background Grid */}
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-50"></div>

      <Navbar isOperational={isOperational} />

      <main className="relative">
        <HeroSection />
        <TechnicalSection />
        <NetworkSpecsSection />
      </main>

      <Footer />

      {/* Decorative Corner Element */}
      <div className="fixed bottom-8 right-8 pointer-events-none opacity-20">
        <div className="w-16 h-16 border-r border-b border-white"></div>
      </div>
    </div>
  );
}

// Reserve Hub Page (Page 2)
function ReserveHubPage() {
  const [activeSection, setActiveSection] = useState("system-pulse");

  const handleNavigate = (section: string) => {
    setActiveSection(section);
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Update active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["system-pulse", "liquidity", "ecosystem"];
      const scrollPosition = window.scrollY + 200;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-background-dark">
      {/* Background Grid */}
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30"></div>

      {/* Custom Header for Reserve Hub */}
      <header className="fixed top-0 w-full z-50 border-b border-primary/20 bg-background-dark/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Branding */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logo/logo_white_transparent.png"
              alt="ARS Logo"
              className="h-8 w-auto object-contain group-hover:opacity-80 transition-opacity"
            />
            <span className="text-xl font-bold tracking-tight text-white">
              ARS{" "}
              <span className="text-slate-500 font-light text-sm ml-1">
                MONITORING
              </span>
            </span>
          </Link>

          {/* Breadcrumb Navigation */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Link
              to="/"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <span className="text-primary flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              Reserve Hub
            </span>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-3 border-l border-white/10 pl-6 h-8">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <span className="text-xs font-bold tracking-wider text-primary">
                LIVE
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono hidden lg:block">
              UPTIME 99.99%
            </div>
          </div>
        </div>
      </header>

      {/* Floating Navigation */}
      <FloatingNav activeSection={activeSection} onNavigate={handleNavigate} />

      {/* Main Content */}
      <main className="relative z-10 pt-28">
        <SystemPulseSection />
        <LiquiditySection />
        <EcosystemSection />
      </main>

      {/* Decorative Corner Element */}
      <div className="fixed bottom-8 right-8 pointer-events-none opacity-20 z-0">
        <div className="w-16 h-16 border-r border-b border-white"></div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/reserve-hub" element={<ReserveHubPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
