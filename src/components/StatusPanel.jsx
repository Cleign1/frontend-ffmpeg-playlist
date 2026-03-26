import {
  Users,
  Radio,
  MapPin,
  Hash,
  Wifi,
  WifiOff,
  Activity,
} from "lucide-react";

export default function StatusPanel({
  nowPlaying,
  listeners = 0,
  mode,
  connected,
  stationInfo,
}) {
  // Destructure with defaults to prevent errors
  const {
    network_code = "N/A",
    network_id = 0,
    local_code = "N/A",
    country_code = "N/A",
  } = stationInfo || {};

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden">
      {/* HEADER */}
      <div className="p-6 border-b border-gray-700/50 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg shadow-lg">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Station Status
            </h3>
          </div>
          <span
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg font-bold tracking-wider shadow-lg transition-all duration-200 ${
              connected
                ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-green-900/20"
                : "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-red-900/20 animate-pulse"
            }`}
          >
            {connected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                ONLINE
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                OFFLINE
              </>
            )}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* METRICS GRID */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 bg-gradient-to-br from-gray-900/70 to-gray-900/50 rounded-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 shadow-lg">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-3 uppercase tracking-wider font-semibold">
              <Users className="w-4 h-4" />
              Listeners
            </div>
            <div className="text-3xl font-bold text-green-400 font-mono">
              {listeners.toLocaleString()}
            </div>
            <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                style={{ width: Math.min((listeners / 1000) * 100, 100) + "%" }}
              ></div>
            </div>
          </div>

          <div className="p-5 bg-gradient-to-br from-gray-900/70 to-gray-900/50 rounded-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 shadow-lg">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-3 uppercase tracking-wider font-semibold">
              <Radio className="w-4 h-4" />
              Mode
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`text-3xl font-bold font-mono ${
                  mode === "AUTO" ? "text-blue-400" : "text-yellow-400"
                }`}
              >
                {mode}
              </div>
              <div
                className={`w-2.5 h-2.5 rounded-full ${mode === "AUTO" ? "bg-blue-500 shadow-lg shadow-blue-500/50" : "bg-yellow-500 shadow-lg shadow-yellow-500/50"} animate-pulse`}
              ></div>
            </div>
          </div>
        </div>

        {/* STATION INFO GRID */}
        <div className="p-5 bg-gradient-to-br from-gray-900/70 to-gray-900/50 rounded-xl border border-gray-700/50 shadow-lg">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-4 uppercase tracking-wider font-semibold">
            <MapPin className="w-4 h-4" />
            Channel Information
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-gray-800/50 rounded-lg border border-gray-700/30 hover:border-gray-600/50 transition-all duration-200">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                Network
              </p>
              <p className="text-sm font-mono font-bold text-white">
                {network_code}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-800/50 rounded-lg border border-gray-700/30 hover:border-purple-500/30 transition-all duration-200">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                ID
              </p>
              <p className="text-sm font-mono font-bold text-purple-400">
                {network_id}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-800/50 rounded-lg border border-gray-700/30 hover:border-gray-600/50 transition-all duration-200">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                Local
              </p>
              <p className="text-sm font-mono font-bold text-white">
                {local_code}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-800/50 rounded-lg border border-gray-700/30 hover:border-blue-500/30 transition-all duration-200">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                Country
              </p>
              <p className="text-sm font-mono font-bold text-blue-400">
                {country_code}
              </p>
            </div>
          </div>
        </div>

        {/* NOW PLAYING */}
        <div className="p-5 bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-500/40 rounded-xl shadow-lg shadow-green-900/10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
          <div className="flex items-center gap-2 text-xs font-bold text-green-400 tracking-wider uppercase">
            <Hash className="w-3.5 h-3.5" />
            Now Playing
          </div>
        </div>
        {nowPlaying ? (
             <div>
               <p className="text-lg font-bold text-white leading-tight mb-1.5 line-clamp-1">
                 {nowPlaying.title}
               </p>
               <p className="text-sm text-gray-300 mb-3 line-clamp-1">
                 {nowPlaying.artist}
               </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-gray-900/60 border border-gray-700/50 px-3 py-1.5 rounded-lg text-gray-400 font-mono flex items-center gap-1.5 shadow-sm">
                   <span className="text-gray-500">ID:</span>
                   <span className="text-white">
                     {nowPlaying.id || nowPlaying.uuid || nowPlaying.audio_id || "—"}
                   </span>
                 </span>
                 <span className="bg-gray-900/60 border border-gray-700/50 px-3 py-1.5 rounded-lg text-gray-400 font-mono flex items-center gap-1.5 shadow-sm">
                   <span className="text-gray-500">Duration:</span>
                   <span className="text-green-400">
                     {nowPlaying.duration || Math.round(nowPlaying.playDurationMs / 1000) || "?"}
                     s
                   </span>
                 </span>
               </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-2">
              <div className="animate-pulse flex gap-2">
                <div className="w-1.5 h-8 bg-gray-700 rounded-full"></div>
                <div className="w-1.5 h-10 bg-gray-700 rounded-full"></div>
                <div className="w-1.5 h-6 bg-gray-700 rounded-full"></div>
                <div className="w-1.5 h-9 bg-gray-700 rounded-full"></div>
              </div>
              <p className="text-sm text-gray-400 italic">
                Awaiting playback...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
