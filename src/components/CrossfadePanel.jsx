import { Link } from "react-router-dom";
import { Settings2, Info, Power, Maximize2 } from "lucide-react";
import { getSocket } from "../api/socket";

export default function CrossfadePanel({
  config = {
    enabled: false,
    fadeInMs: 0,
    preloadMs: 0,
    overlapMs: 0,
    fadeOutMs: 0,
  },
}) {
  const socket = getSocket();
  const safeNumber = (val, fallback = 0) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  };

  const update = (key, val) => {
    socket.emit("crossfade_set", { [key]: safeNumber(val) });
  };

  const applyPreset = (name) => {
    socket.emit("crossfade_preset", name);
  };

  const presets = [
    { value: "soft", label: "SOFT", color: "from-blue-500 to-blue-600" },
    {
      value: "normal",
      label: "NORMAL",
      color: "from-purple-500 to-purple-600",
    },
    {
      value: "aggressive",
      label: "AGGRESSIVE",
      color: "from-red-500 to-red-600",
    },
  ];

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden w-full">
      {/* HEADER */}
      <div className="p-4 sm:p-6 border-b border-gray-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-lg">
              <Settings2 className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white">Crossfade Engine</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Advanced transition controls
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/crossfade"
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg hover:from-purple-500 hover:to-purple-600"
            >
              <Maximize2 className="w-4 h-4" />
              Advanced
            </Link>
            <button
              onClick={() => socket.emit("crossfade_enable", !config.enabled)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                config.enabled
                  ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <Power className="w-4 h-4" />
              {config.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>

        {/* PRESET BUTTONS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => applyPreset(preset.value)}
              className={`py-3 rounded-lg font-bold text-sm transition-all duration-200 bg-gradient-to-r ${preset.color} text-white shadow-lg hover:scale-105`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* FADE IN */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label
              className="text-sm font-medium text-gray-300"
              title="How long the new track takes to reach full volume. Higher = slower attack."
            >
              Fade In (Attack)
            </label>
            <span className="text-sm font-mono text-purple-400 bg-purple-900/30 px-3 py-1 rounded-lg border border-purple-500/30">
              {config.fadeInMs} ms
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
               value={safeNumber(config.fadeInMs)}
               onChange={(e) => update("fadeInMs", e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={!config.enabled}
            />
            <div
              className="absolute top-0 left-0 h-2 bg-gradient-to-r from-purple-600 to-purple-500 rounded-lg pointer-events-none"
               style={{ width: `${(safeNumber(config.fadeInMs) / 5000) * 100}%` }}
            />
          </div>
        </div>

        {/* PRELOAD */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label
              className="text-sm font-medium text-gray-300"
              title="How early we stage the next track before its mix point. Higher = more lead time for seamless starts."
            >
              Preload (Buffer)
            </label>
            <span className="text-sm font-mono text-blue-400 bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-500/30">
              {config.preloadMs} ms
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="10000"
              step="100"
               value={safeNumber(config.preloadMs)}
               onChange={(e) => update("preloadMs", e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={!config.enabled}
            />
            <div
              className="absolute top-0 left-0 h-2 bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg pointer-events-none"
               style={{
                 width: `${(safeNumber(config.preloadMs) / 10000) * 100}%`,
               }}
            />
          </div>
        </div>

        {/* OVERLAP */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label
              className="text-sm font-medium text-gray-300"
              title="Slide left (more negative) starts the next song earlier and begins the current fade-out sooner. Slide right (toward 0) mixes later, closer to the cut point."
            >
              Overlap (Mix Point)
            </label>
            <span className="text-sm font-mono text-green-400 bg-green-900/30 px-3 py-1 rounded-lg border border-green-500/30">
              {config.overlapMs} ms
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="-10000"
              max="0"
              step="100"
               value={safeNumber(config.overlapMs)}
               onChange={(e) => update("overlapMs", e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={!config.enabled}
            />
            <div
              className="absolute top-0 left-0 h-2 bg-gradient-to-r from-green-600 to-green-500 rounded-lg pointer-events-none"
              style={{
                 width: `${((safeNumber(config.overlapMs) + 10000) / 10000) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* FADE OUT */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label
              className="text-sm font-medium text-gray-300"
              title="How long the current track takes to fade down once the mix begins. Higher = longer, smoother decay."
            >
              Fade Out (Decay)
            </label>
            <span className="text-sm font-mono text-orange-400 bg-orange-900/30 px-3 py-1 rounded-lg border border-orange-500/30">
              {config.fadeOutMs} ms
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="10000"
              step="100"
               value={safeNumber(config.fadeOutMs)}
               onChange={(e) => update("fadeOutMs", e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={!config.enabled}
            />
            <div
              className="absolute top-0 left-0 h-2 bg-gradient-to-r from-orange-600 to-orange-500 rounded-lg pointer-events-none"
               style={{ width: `${(safeNumber(config.fadeOutMs) / 10000) * 100}%` }}
            />
          </div>
        </div>

        {/* INFO BANNER */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-100 font-medium">
                Crossfade Configuration
              </p>
              <p className="text-xs text-blue-200/70 mt-1">
                {config.enabled
                  ? "Smooth transitions between tracks with custom timing controls"
                  : "Crossfade is currently disabled. Enable to apply smooth transitions"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: white;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 10;
        }

        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: white;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          border: none;
          position: relative;
          z-index: 10;
        }

        input[type="range"]:disabled::-webkit-slider-thumb {
          background: #6b7280;
          cursor: not-allowed;
        }

        input[type="range"]:disabled::-moz-range-thumb {
          background: #6b7280;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
