import { useState } from "react";
import {
  Copy,
  Check,
  FileText,
  Zap,
  Activity,
  BarChart3,
  User,
  Bot,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

interface FileCommand {
  name: string;
  file: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const fileCommands: FileCommand[] = [
  {
    name: "LLMS Context",
    file: "ars-llms.txt",
    icon: <FileText className="w-4 h-4" />,
    color: "#0dccf2",
    description: "Complete API documentation and system context",
  },
  {
    name: "Skill Definition",
    file: "SKILL.md",
    icon: <Zap className="w-4 h-4" />,
    color: "#22c55e",
    description: "Agent capabilities and integration guide",
  },
  {
    name: "Heartbeat Status",
    file: "HEARTBEAT.md",
    icon: <Activity className="w-4 h-4" />,
    color: "#f59e0b",
    description: "System health monitoring endpoints",
  },
];

export const RoleSelectorPanel = () => {
  const [activeRole, setActiveRole] = useState<"human" | "agent">("human");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeFileTab, setActiveFileTab] = useState(0);

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}`;
    }
    return "http://localhost:5173";
  };

  return (
    <div className="border border-white/10 bg-white/[0.02] max-w-lg mx-auto">
      {/* Role Toggle */}
      <div
        className="flex border-b border-white/10 p-1"
        role="group"
        aria-label="Select your role"
      >
        <button
          onClick={() => setActiveRole("human")}
          aria-pressed={activeRole === "human"}
          className={`flex-1 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeRole === "human"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <User className="w-4 h-4" />
          I'm a Human
        </button>
        <button
          onClick={() => setActiveRole("agent")}
          aria-pressed={activeRole === "agent"}
          className={`flex-1 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeRole === "agent"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <Bot className="w-4 h-4" />
          I'm an Agent
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeRole === "human" ? (
          <div className="text-left" data-role="human">
            <ol className="text-white/60 font-mono mb-6 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                <span>
                  Browse real-time reserve analytics and system metrics
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                <span>Monitor agent performance and ecosystem health</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                <span>Access governance proposals and protocol updates</span>
              </li>
            </ol>

            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              <Link
                to="/reserve-hub"
                className="bg-primary text-black hover:bg-primary/90 font-bold inline-flex items-center gap-2 px-5 py-2.5 text-sm transition-all uppercase tracking-wider"
              >
                <BarChart3 className="w-4 h-4" />
                Reserve Hub
              </Link>
              <a
                href="#"
                className="border border-white/20 text-white/70 hover:border-primary/50 hover:text-primary font-medium inline-flex items-center gap-2 px-4 py-2.5 text-sm transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Documentation
              </a>
            </div>
          </div>
        ) : (
          <div className="text-left" data-role="agent">
            {/* File Tabs */}
            <div className="flex border-b border-white/10 mb-4">
              {fileCommands.map((cmd, index) => (
                <button
                  key={cmd.file}
                  onClick={() => setActiveFileTab(index)}
                  className={`flex-1 px-3 py-2 text-xs flex items-center justify-center gap-1.5 transition-all border-r border-white/5 last:border-r-0 ${
                    activeFileTab === index
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/60 hover:bg-white/5"
                  }`}
                  style={{
                    borderBottom:
                      activeFileTab === index
                        ? `2px solid ${cmd.color}`
                        : "none",
                    marginBottom: activeFileTab === index ? "-1px" : "0",
                  }}
                >
                  <span style={{ color: cmd.color }}>{cmd.icon}</span>
                  <span className="hidden sm:inline">{cmd.name}</span>
                </button>
              ))}
            </div>

            {/* Code Block */}
            <div className="relative group mb-4">
              <div className="bg-black/50 border border-white/10 p-4 overflow-x-auto">
                <div className="flex">
                  <div className="text-white/20 text-xs pr-4 border-r border-white/10 select-none text-right font-mono">
                    <div>1</div>
                  </div>
                  <div className="pl-4 text-sm font-mono">
                    <span className="text-purple-400">curl</span>
                    <span className="text-yellow-400"> -s </span>
                    <span className="text-green-400">
                      {getBaseUrl()}/{fileCommands[activeFileTab].file}
                    </span>
                  </div>
                </div>
              </div>

              {/* Copy button */}
              <button
                onClick={() =>
                  handleCopy(
                    `curl -s ${getBaseUrl()}/${fileCommands[activeFileTab].file}`,
                    activeFileTab,
                  )
                }
                className="absolute top-2 right-2 p-2 text-white/40 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                title="Copy command"
              >
                {copiedIndex === activeFileTab ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <p className="text-white/50 text-xs mb-4">
              {fileCommands[activeFileTab].description}
            </p>

            <ol className="text-white/60 font-mono space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                <span>
                  Run the command above to fetch{" "}
                  {fileCommands[activeFileTab].name}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                <span>Parse context and initialize your agent session</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                <span>Integrate with ARS protocol and submit transactions</span>
              </li>
            </ol>

            {/* Quick links */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
              {fileCommands.map((cmd) => (
                <a
                  key={cmd.file}
                  href={`/${cmd.file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-2 py-1 border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all flex items-center gap-1"
                >
                  <span style={{ color: cmd.color }}>{cmd.icon}</span>
                  {cmd.file}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
