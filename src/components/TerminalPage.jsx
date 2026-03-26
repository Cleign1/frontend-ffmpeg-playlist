import { useEffect, useState, useRef } from "react";
import { getSocket, connectSocket } from "../api/socket";

/**
 * TerminalPage Component - Full-Screen CLI-Style Log Viewer
 * Displays server logs in an immersive terminal interface
 */
export default function TerminalPage({ onClose, standalone = false }) {
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isStandalone, setIsStandalone] = useState(standalone);
  const logsEndRef = useRef(null);
  const containerRef = useRef(null);

  const handleClose = () => {
    if (isStandalone) {
      window.close();
    } else if (onClose) {
      onClose();
    }
  };

  const MAX_LOGS = 1000;

  // Detect if we're in standalone mode (opened via React Router)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isStandaloneFromUrl = urlParams.get("standalone") === "true";
    setIsStandalone((prev) => prev || isStandaloneFromUrl || standalone);
  }, [standalone]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStandalone, onClose]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Handle manual scrolling
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    setAutoScroll(isAtBottom);
  };

  // Connect socket and listen for server logs
  useEffect(() => {
    // CRITICAL: Connect socket when Terminal opens in new window
    // Without this, the socket remains disconnected and no logs will be received
    console.log("[Terminal] Initializing socket connection...");
    connectSocket();

    const socket = getSocket();
    if (!socket) {
      console.error("[Terminal] Socket not available");
      return;
    }

    console.log("[Terminal] Socket obtained, setting up listeners...");

    const handleLog = (logEntry) => {
      console.log("[Terminal] Received log:", logEntry);
      setLogs((prev) => {
        const newLogs = [...prev, logEntry];
        if (newLogs.length > MAX_LOGS) {
          return newLogs.slice(-MAX_LOGS);
        }
        return newLogs;
      });
    };

    const handleLogHistory = (logHistory) => {
      console.log(
        "[Terminal] Received log history:",
        logHistory?.length,
        "entries",
      );
      if (Array.isArray(logHistory) && logHistory.length > 0) {
        setLogs((prev) => [...prev, ...logHistory]);
      }
    };

    const handleConnect = () => {
      console.log("[Terminal] ✅ Socket connected successfully");
    };

    const handleDisconnect = () => {
      console.log("[Terminal] ❌ Socket disconnected");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:log", handleLog);
    socket.on("server:log_history", handleLogHistory);

    // Log initial connection state
    console.log("[Terminal] Socket connected:", socket.connected);
    if (socket.connected) {
      console.log("[Terminal] Socket already connected, listeners attached");
    }

    return () => {
      console.log("[Terminal] Cleaning up socket listeners");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:log", handleLog);
      socket.off("server:log_history", handleLogHistory);
    };
  }, []);

  const clearLogs = () => setLogs([]);

  const getLogColor = (level) => {
    switch (level) {
      case "error":
        return "text-red-400";
      case "warn":
        return "text-yellow-400";
      case "info":
      default:
        return "text-green-400";
    }
  };

  const getLogIcon = (level) => {
    switch (level) {
      case "error":
        return "❌";
      case "warn":
        return "⚠️";
      case "info":
      default:
        return "ℹ️";
    }
  };

  // Filter and search logs
  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filter === "all" || log.level === filter;
    const matchesSearch =
      !searchTerm ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black text-green-400 font-mono overflow-hidden flex flex-col">
      {/* Terminal Header Bar */}
      <div className="bg-neutral-900 border-b border-neutral-700 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleClose}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded font-bold transition"
            title="Close Terminal (Esc)"
          >
            Exit (Esc)
          </button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition"
            title={autoScroll ? "Disable Auto-scroll" : "Enable Auto-scroll"}
          >
            {autoScroll ? "Auto-scroll On" : "Auto-scroll Off"}
          </button>
          <button
            onClick={clearLogs}
            className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition"
            title="Clear Logs"
          >
            Clear Logs
          </button>

          <div className="text-sm font-bold text-green-400 tracking-wide">
            🖥️ STATION MASTER - SERVER TERMINAL
          </div>

          <div className="text-xs text-neutral-500">
            [{filteredLogs.length} / {logs.length} logs]
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="px-3 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-green-600"
          />

          {/* Filter Buttons */}
          <div className="flex gap-1 bg-neutral-800 rounded p-1">
            {["all", "info", "warn", "error"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  filter === f
                    ? "bg-green-600 text-black font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Auto-scroll indicator */}
          <div
            className={`px-3 py-1 text-xs rounded border ${
              autoScroll
                ? "bg-green-600/20 text-green-400 border-green-600"
                : "bg-neutral-800 text-neutral-400 border-neutral-600"
            }`}
          >
            {autoScroll ? "▼ LIVE" : "⏸️ PAUSED"}
          </div>

          {/* Exit Button */}
          <button
            onClick={handleClose}
            className="px-4 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded font-bold transition"
          >
            {isStandalone ? "CLOSE WINDOW" : "EXIT (ESC)"}
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-black p-6"
        style={{ scrollBehavior: "smooth" }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">🖥️</div>
              <div className="text-neutral-600 text-lg">
                {searchTerm || filter !== "all"
                  ? "No logs match your filters"
                  : "Waiting for server activity..."}
              </div>
              <div className="text-neutral-700 text-sm mt-2">
                Server console output will appear here in real-time
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* System Banner */}
            <div className="mb-6 pb-4 border-b border-neutral-800">
              <div className="text-green-400 text-sm">
                ╔════════════════════════════════════════════════════════════╗
              </div>
              <div className="text-green-400 text-sm">
                ║ STATION MASTER SERVER CONSOLE - REAL-TIME LOG STREAM ║
              </div>
              <div className="text-green-400 text-sm">
                ╚════════════════════════════════════════════════════════════╝
              </div>
            </div>

            {/* Log Entries */}
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className="mb-2 hover:bg-neutral-900/30 px-3 py-2 rounded transition group"
              >
                <div className="flex items-start gap-3">
                  {/* Timestamp */}
                  <span className="text-cyan-600 shrink-0 text-xs">
                    [
                    {new Date(log.timestamp).toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      fractionalSecondDigits: 3,
                    })}
                    ]
                  </span>

                  {/* Level Badge */}
                  <span
                    className={`shrink-0 text-sm ${
                      log.level === "error"
                        ? "text-red-500"
                        : log.level === "warn"
                          ? "text-yellow-500"
                          : "text-green-500"
                    }`}
                  >
                    [{log.level.toUpperCase().padEnd(5)}]
                  </span>

                  {/* Icon */}
                  <span className="shrink-0 text-sm">
                    {getLogIcon(log.level)}
                  </span>

                  {/* Message */}
                  <span
                    className={`${getLogColor(log.level)} break-all flex-1 text-sm leading-relaxed`}
                  >
                    {log.message}
                  </span>
                </div>

                {/* Additional Data */}
                {log.data && (
                  <div className="ml-[180px] mt-2 text-neutral-500 text-xs bg-neutral-900/50 p-3 rounded border border-neutral-800">
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-neutral-900 border-t border-neutral-700 px-6 py-2 flex items-center justify-between text-xs text-neutral-500 shrink-0">
        <div className="flex items-center gap-4">
          <span>🟢 Connected</span>
          <span>
            Buffer: {logs.length} / {MAX_LOGS}
          </span>
          {searchTerm && <span>Search: "{searchTerm}"</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>Press ESC or click Exit to close</span>
          <span className="text-green-500">◉ LIVE</span>
        </div>
      </div>
    </div>
  );
}
