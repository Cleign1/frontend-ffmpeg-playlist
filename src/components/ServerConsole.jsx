import { useEffect, useState, useRef } from "react";
import { getSocket } from "../api/socket";

/**
 * ServerConsole Component
 * Displays real-time server logs in a terminal-styled interface
 */
export default function ServerConsole() {
  const [logs, setLogs] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("all"); // all, info, warn, error
  const logsEndRef = useRef(null);
  const containerRef = useRef(null);

  const MAX_LOGS = 500;

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Handle manual scrolling - disable auto-scroll if user scrolls up
  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;

    setAutoScroll(isAtBottom);
  };

  // Listen for server logs via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.error("[ServerConsole] Socket not available");
      return;
    }

    console.log("[ServerConsole] Setting up log listeners...");

    const handleLog = (logEntry) => {
      console.log("[ServerConsole] Received log:", logEntry);
      setLogs((prev) => {
        const newLogs = [...prev, logEntry];
        // Maintain buffer limit
        if (newLogs.length > MAX_LOGS) {
          return newLogs.slice(-MAX_LOGS);
        }
        return newLogs;
      });
    };

    const handleLogHistory = (logHistory) => {
      console.log(
        "[ServerConsole] Received log history:",
        logHistory?.length,
        "entries",
      );
      if (Array.isArray(logHistory) && logHistory.length > 0) {
        setLogs((prev) => [...prev, ...logHistory]);
      }
    };

    socket.on("server:log", handleLog);
    socket.on("server:log_history", handleLogHistory);

    console.log("[ServerConsole] Socket connected:", socket.connected);

    return () => {
      socket.off("server:log", handleLog);
      socket.off("server:log_history", handleLogHistory);
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

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

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.level === filter;
  });

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden shadow-lg">
      {/* Header */}
      <div className="bg-neutral-800 px-4 py-3 flex items-center justify-between border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <h3 className="text-sm font-bold text-neutral-200 tracking-wide">
            🖥️ SERVER CONSOLE
          </h3>
          <span className="text-xs text-neutral-500">
            ({filteredLogs.length} logs)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Buttons */}
          <div className="flex gap-1 bg-neutral-900 rounded p-1">
            {["all", "info", "warn", "error"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 text-xs font-medium rounded transition ${
                  filter === f
                    ? "bg-neutral-700 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Auto-scroll indicator */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 text-xs rounded transition ${
              autoScroll
                ? "bg-green-600/20 text-green-400 border border-green-600/30"
                : "bg-neutral-700 text-neutral-400 border border-neutral-600"
            }`}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          >
            {autoScroll ? "📌 Auto" : "⏸️ Manual"}
          </button>

          {/* Clear logs */}
          <button
            onClick={clearLogs}
            className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition"
            title="Clear logs"
          >
            🗑️ Clear
          </button>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition"
          >
            {isExpanded ? "▼ Collapse" : "▲ Expand"}
          </button>
        </div>
      </div>

      {/* Console Content */}
      {isExpanded && (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="bg-black/90 p-4 font-mono text-xs overflow-y-auto"
          style={{ height: "400px" }}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-neutral-600 text-center py-8">
              No logs to display. Waiting for server activity...
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className="mb-1 hover:bg-neutral-900/50 px-2 py-1 rounded transition"
              >
                <div className="flex items-start gap-2">
                  <span className="text-neutral-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      fractionalSecondDigits: 3,
                    })}
                  </span>
                  <span className="shrink-0">{getLogIcon(log.level)}</span>
                  <span className={`${getLogColor(log.level)} break-all`}>
                    {log.message}
                  </span>
                </div>
                {log.data && (
                  <div className="ml-28 text-neutral-500 text-xs mt-1">
                    {JSON.stringify(log.data, null, 2)}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      )}

      {/* Collapsed state shows last log */}
      {!isExpanded && filteredLogs.length > 0 && (
        <div className="bg-black/90 px-4 py-2 font-mono text-xs border-t border-neutral-800">
          <div className="flex items-center gap-2 text-neutral-400">
            <span>
              {getLogIcon(filteredLogs[filteredLogs.length - 1].level)}
            </span>
            <span className="truncate">
              {filteredLogs[filteredLogs.length - 1].message}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
