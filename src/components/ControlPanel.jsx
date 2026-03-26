import {
  Play,
  Square,
  RotateCcw,
  SkipForward,
  Repeat,
  AlertOctagon,
} from "lucide-react";
import { getSocket } from "../api/socket";

export default function ControlPanel({ playing, mode, connected, isStopping }) {
  const socket = getSocket();

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* --- PLAY --- */}
        <button
          className="flex flex-col items-center justify-center gap-3 p-6 bg-gradient-to-br from-green-900/30 to-green-800/20 hover:from-green-900/50 hover:to-green-800/40 border border-green-500/30 hover:border-green-500/50 rounded-xl transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-green-900/30 disabled:hover:to-green-800/20 shadow-lg"
          disabled={!connected || playing}
          onClick={() => socket.emit("start")}
        >
          <div className="p-3 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
            <Play className="w-7 h-7 text-green-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-sm font-semibold text-green-100 text-center">
            Start Playout
          </span>
        </button>

        {/* --- STOP (Graceful) --- */}
        <button
          className="flex flex-col items-center justify-center gap-3 p-6 bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 hover:from-yellow-900/50 hover:to-yellow-800/40 border border-yellow-500/30 hover:border-yellow-500/50 rounded-xl transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-yellow-900/30 disabled:hover:to-yellow-800/20 shadow-lg"
          disabled={!connected || !playing || isStopping}
          onClick={() => socket.emit("stop")}
        >
          <div className="p-3 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
            <Square className="w-7 h-7 text-yellow-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-sm font-semibold text-yellow-100 text-center">
            {isStopping ? "Stopping..." : "Stop After Song"}
          </span>
        </button>

        {/* --- RESTART SONG --- */}
        <button
          className="flex flex-col items-center justify-center gap-3 p-6 bg-gradient-to-br from-blue-900/30 to-blue-800/20 hover:from-blue-900/50 hover:to-blue-800/40 border border-blue-500/30 hover:border-blue-500/50 rounded-xl transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-blue-900/30 disabled:hover:to-blue-800/20 shadow-lg"
          disabled={!connected || !playing}
          onClick={() => socket.emit("restart")}
        >
          <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
            <RotateCcw className="w-7 h-7 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-sm font-semibold text-blue-100 text-center">
            Restart Song
          </span>
        </button>

        {/* --- NEXT TRACK --- */}
        <button
          className="flex flex-col items-center justify-center gap-3 p-6 bg-gradient-to-br from-purple-900/30 to-purple-800/20 hover:from-purple-900/50 hover:to-purple-800/40 border border-purple-500/30 hover:border-purple-500/50 rounded-xl transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-purple-900/30 disabled:hover:to-purple-800/20 shadow-lg"
          disabled={!connected || !playing}
          onClick={() => socket.emit("next")}
        >
          <div className="p-3 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
            <SkipForward className="w-7 h-7 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-sm font-semibold text-purple-100 text-center">
            Skip Track
          </span>
        </button>

        {/* --- AUTO MODE --- */}
        <button
          className="flex flex-col items-center justify-center gap-3 p-6 bg-gradient-to-br from-indigo-900/30 to-indigo-800/20 hover:from-indigo-900/50 hover:to-indigo-800/40 border border-indigo-500/30 hover:border-indigo-500/50 rounded-xl transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-indigo-900/30 disabled:hover:to-indigo-800/20 shadow-lg"
          disabled={!connected || mode === "AUTO"}
          onClick={() => socket.emit("auto")}
        >
          <div className="p-3 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
            <Repeat className="w-7 h-7 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-sm font-semibold text-indigo-100 text-center">
            {mode === "AUTO" ? "Auto Mode" : "Switch to Auto"}
          </span>
        </button>
      </div>

      {/* --- HARD STOP (Emergency) - Full Width Below --- */}
      <div className="mt-6 pt-6 border-t border-gray-700/50">
        <button
          className="w-full flex items-center justify-center gap-3 p-5 bg-gradient-to-br from-red-900/30 to-red-800/20 hover:from-red-600 hover:to-red-700 border border-red-500/50 hover:border-red-500 rounded-xl transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-red-900/30 disabled:hover:to-red-800/20 shadow-lg hover:shadow-xl hover:shadow-red-900/20"
          disabled={!connected}
          onClick={() => {
            if (
              confirm(
                "🛑 EMERGENCY STOP: This will kill the audio immediately. Are you sure?",
              )
            ) {
              socket.emit("hard_stop");
            }
          }}
        >
          <AlertOctagon className="w-6 h-6 text-red-400 group-hover:text-white group-hover:scale-110 transition-all" />
          <span className="text-base font-bold text-red-400 group-hover:text-white transition-colors uppercase tracking-wider">
            Emergency Hard Stop
          </span>
        </button>
      </div>
    </div>
  );
}
