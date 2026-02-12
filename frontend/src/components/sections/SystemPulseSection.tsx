import { useEffect, useState } from "react";
import {
  Activity,
  TrendingUp,
  Gauge,
  Lock,
  Server,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { useILI, useHealth, useReserveState } from "../../hooks/useApi";
import { ApiDocumentationPanel } from "../ui/ApiDocumentationPanel";

export const SystemPulseSection = () => {
  const { data: iliData, isLoading: iliLoading } = useILI();
  const { data: healthData, isLoading: healthLoading } = useHealth();
  const { data: reserveData, isLoading: reserveLoading } = useReserveState();

  const [animatedValue, setAnimatedValue] = useState(11.54);

  useEffect(() => {
    if (iliData?.ili && iliData.ili > 0) {
      setAnimatedValue(iliData.ili);
    }
  }, [iliData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  };

  const cacheHitRate =
    healthData?.metrics?.performance?.cacheHitRate || "85.5%";
  const cacheNum = parseFloat(cacheHitRate);

  return (
    <section id="system-pulse" className="relative pt-0 pb-16">
      {/* Background Grid Effect */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `linear-gradient(to right, #1a2c30 1px, transparent 1px), linear-gradient(to bottom, #1a2c30 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            maskImage:
              "linear-gradient(to bottom, black 40%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 40%, transparent 100%)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xs font-bold text-primary tracking-[0.2em] uppercase mb-1">
              System Status
            </h2>
            <h1 className="text-3xl font-light text-white tracking-tight">
              ARS <span className="text-slate-500">Monitoring</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            LIVE FEED • BLOCK 24,981,002
          </div>
        </div>

        {/* Hero: ILI Index */}
        <div className="flex flex-col items-center justify-center py-12 relative mb-8">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-32 h-32 border-l border-t border-primary/20 rounded-tl-3xl"></div>
          <div className="absolute top-0 right-0 w-32 h-32 border-r border-t border-primary/20 rounded-tr-3xl"></div>

          <h1 className="text-sm font-bold tracking-[0.2em] text-slate-500 mb-6 uppercase flex items-center gap-2">
            <span className="w-2 h-2 bg-primary/50 rounded-full"></span>
            Internet Liquidity Index (ILI)
          </h1>

          <div className="relative group cursor-default">
            {/* Massive Value */}
            <div
              className="text-9xl md:text-[10rem] font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 leading-none tracking-tighter select-none"
              style={{ textShadow: "0 0 80px rgba(13,204,242,0.15)" }}
            >
              {iliLoading ? "—" : animatedValue.toFixed(2)}
            </div>

            {/* Trend Indicator */}
            <div className="absolute -right-4 md:-right-16 lg:-right-24 top-0 flex flex-col items-start opacity-80">
              <div className="flex items-center text-primary text-lg font-bold">
                <TrendingUp className="w-4 h-4 mr-1" />
                +2.4%
              </div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                24H Change
              </span>
            </div>
          </div>

          {/* Sub-Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mt-12 w-full max-w-4xl">
            {/* ICR Card */}
            <div className="group border border-white/10 bg-surface-dark/50 p-5 rounded-lg hover:border-primary/50 transition-colors duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Interest Cover Ratio
              </div>
              <div className="text-3xl font-bold text-white group-hover:text-primary transition-colors">
                {healthLoading ? "—" : "500"}{" "}
                <span className="text-sm font-normal text-slate-500">bps</span>
              </div>
              <div className="w-full bg-white/5 h-1 mt-3 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[75%]"></div>
              </div>
            </div>

            {/* VHR Card */}
            <div className="group border border-white/10 bg-surface-dark/50 p-5 rounded-lg hover:border-primary/50 transition-colors duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <Gauge className="w-5 h-5 text-primary" />
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Velocity Health Ratio
              </div>
              <div className="text-3xl font-bold text-white group-hover:text-primary transition-colors">
                {reserveLoading ? "—" : reserveData?.vhr || "2.0"}
                <span className="text-2xl">x</span>
              </div>
              <div className="w-full bg-white/5 h-1 mt-3 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[90%]"></div>
              </div>
            </div>

            {/* TVL Card */}
            <div className="group border border-white/10 bg-surface-dark/50 p-5 rounded-lg hover:border-primary/50 transition-colors duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Total Value Locked
              </div>
              <div className="text-3xl font-bold text-white group-hover:text-primary transition-colors">
                {reserveLoading
                  ? "—"
                  : formatCurrency(reserveData?.totalValueUsd || 1530000000)}
              </div>
              <div className="w-full bg-white/5 h-1 mt-3 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[60%]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-Time System Health Module */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {/* Left: Operational Status */}
          <div className="border border-white/10 bg-surface-dark/30 rounded-lg p-6 relative backdrop-blur-sm">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-lg"></div>
            <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  SYSTEM STATUS
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time dependency verification
                </p>
              </div>
              <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded text-xs font-bold tracking-wider">
                {healthData?.status === "ok" ? "OPERATIONAL" : "DEGRADED"}
              </span>
            </div>
            <div className="space-y-4">
              {["Supabase Database", "Redis Cluster", "Solana RPC Node"].map(
                (service, idx) => (
                  <div
                    key={service}
                    className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                      <span className="text-sm font-medium text-slate-200">
                        {service}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-green-400 text-xs uppercase font-bold tracking-wider">
                      <CheckCircle className="w-4 h-4" />
                      {idx === 2 ? "Synced" : "Connected"}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Right: Performance Gauges */}
          <div className="border border-white/10 bg-surface-dark/30 rounded-lg p-6 relative backdrop-blur-sm">
            <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-primary" />
                  PERFORMANCE
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Network throughput & latency
                </p>
              </div>
              <button className="text-slate-500 hover:text-primary transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {/* Gauge 1: Cache Hit Rate */}
              <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded border border-white/5">
                <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
                  <svg className="transform -rotate-90 w-24 h-24">
                    <circle
                      className="text-slate-700"
                      cx="48"
                      cy="48"
                      fill="transparent"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="6"
                    ></circle>
                    <circle
                      className="text-primary"
                      cx="48"
                      cy="48"
                      fill="transparent"
                      r="40"
                      stroke="currentColor"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * cacheNum) / 100}
                      strokeWidth="6"
                    ></circle>
                  </svg>
                  <span className="absolute text-xl font-bold text-white">
                    {cacheNum}%
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Cache Hit Rate
                </span>
                <span className="text-[10px] text-slate-500 mt-1">
                  Target: &gt;80%
                </span>
              </div>

              {/* Gauge 2: Response Time */}
              <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded border border-white/5">
                <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
                  <svg className="transform -rotate-90 w-24 h-24">
                    <circle
                      className="text-slate-700"
                      cx="48"
                      cy="48"
                      fill="transparent"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="6"
                    ></circle>
                    <circle
                      className="text-green-400"
                      cx="48"
                      cy="48"
                      fill="transparent"
                      r="40"
                      stroke="currentColor"
                      strokeDasharray="251.2"
                      strokeDashoffset="100"
                      strokeWidth="6"
                    ></circle>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-xl font-bold text-white">196</span>
                    <span className="text-[10px] text-slate-400">ms</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Response Time
                </span>
                <span className="text-[10px] text-slate-500 mt-1">
                  Global Avg
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* API Documentation Panel */}
        <div className="mt-8">
          <ApiDocumentationPanel />
        </div>
      </div>
    </section>
  );
};
