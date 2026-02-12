import { useILI, useReserveState, useRevenue } from "../../hooks/useApi";
import { RoleSelectorPanel } from "../ui/RoleSelectorPanel";

export const HeroSection = () => {
  const { data: iliData, isLoading: iliLoading } = useILI();
  const { data: reserveData, isLoading: reserveLoading } = useReserveState();
  const { data: revenueData, isLoading: revenueLoading } = useRevenue();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <section className="relative pt-16 pb-12 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          <div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5rem] font-bold leading-[0.9] tracking-tighter uppercase">
              <span className="whitespace-nowrap">Agentic Reserve</span>
              <br />
              System
            </h1>
            <p className="mt-8 text-white/40 max-w-xl text-lg leading-relaxed">
              Institutional-grade autonomous reserve management on Solana.
              High-fidelity liquidity monitoring and agentic rebalancing
              infrastructure.
            </p>
          </div>

          {/* Role Selector Panel */}
          <div className="lg:pt-0">
            <RoleSelectorPanel />
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-white/10">
          {/* ILI Index */}
          <div className="p-8 border-r border-white/10 group hover:bg-white/5 transition-colors">
            <div className="text-xs text-white/40 uppercase tracking-widest mb-4 flex justify-between">
              <span>ILI Index</span>
              <span className="text-primary">+0.04%</span>
            </div>
            <div className="text-5xl font-bold tracking-tighter">
              {iliLoading ? "—" : iliData?.ili.toFixed(2) || "11.54"}
            </div>
            <div className="mt-6 h-1 w-full bg-white/5">
              <div className="h-full bg-white w-2/3"></div>
            </div>
          </div>

          {/* Total Reserve Value */}
          <div className="p-8 border-r border-white/10 group hover:bg-white/5 transition-colors">
            <div className="text-xs text-white/40 uppercase tracking-widest mb-4">
              Total Reserve Value
            </div>
            <div className="text-5xl font-bold tracking-tighter">
              {reserveLoading
                ? "—"
                : formatCurrency(reserveData?.totalValueUsd || 1000000)}
            </div>
            <div className="mt-6 flex gap-1">
              <div className="h-4 w-1 bg-white/20"></div>
              <div className="h-4 w-1 bg-white/40"></div>
              <div className="h-4 w-1 bg-white/60"></div>
              <div className="h-4 w-1 bg-white/80"></div>
              <div className="h-4 w-1 bg-white"></div>
            </div>
          </div>

          {/* Active Agents */}
          <div className="p-8 group hover:bg-white/5 transition-colors">
            <div className="text-xs text-white/40 uppercase tracking-widest mb-4 flex justify-between">
              <span>Active Agents</span>
              <span className="text-primary">LIVE</span>
            </div>
            <div className="text-5xl font-bold tracking-tighter">
              {revenueLoading ? "—" : revenueData?.agentCount || 247}
            </div>
            <div className="mt-6 text-xs text-white/30 italic">
              Cluster: SOL-Mainnet-Beta-1
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
