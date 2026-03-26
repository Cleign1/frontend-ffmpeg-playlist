// frontend-ffmpeg-playlist/src/App.jsx
import { useEffect, useState } from "react";
import { useLocation, Link, Routes, Route } from "react-router-dom"; // Tambahkan Routes, Route
import {
  Radio,
  List,
  Edit3,
  Music,
  Mic,
  Power,
  FileText,
  ChevronRight,
} from "lucide-react";
import { connectSocket } from "./api/socket";
import { useRadioState } from "./hooks/useRadioState";

// Import Komponen Existing
import ControlPanel from "./components/ControlPanel";
import StatusPanel from "./components/StatusPanel";
import CrossfadePanel from "./components/CrossfadePanel";
import PlaylistViewer from "./components/playlist/PlaylistViewer";
import StreamPlayer from "./components/StreamPlayer";
import FetchPlaylist from "./components/FetchPlaylist";
import ServerConsole from "./components/ServerConsole";
import MusicBedSelector from "./components/MusicBedSelector";

// Import Halaman Baru (Pastikan file ini ada/dibuat sesuai langkah sebelumnya)
import GraphicalCrossfadeEngine from "./components/GraphicalCrossfadeEngine";
// Jika Anda punya file khusus untuk page wrapper, gunakan itu.
// Untuk sekarang kita pakai Engine langsung atau Page jika ada.
import PlaylistEditorPage from "./components/PlaylistEditorPage"; // Pastikan file ini ada

// --- KOMPONEN DASHBOARD (Isi asli App.jsx Anda dipindahkan ke sini) ---
const Dashboard = ({
  radio,
  openTerminal,
  formatTime,
  formatDate,
  formatDuration,
  showFetchPlaylist,
  setShowFetchPlaylist,
  clock,
}) => {
  const nowTrack = radio.nowPlaying;
  const nextTrack = null; // placeholder

  return (
    <div className="max-w-[2000px] mx-auto space-y-6">
      {/* Modal Fetch Playlist */}
      {showFetchPlaylist && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setShowFetchPlaylist(false)}
                className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white rounded-lg transition-all duration-200 shadow-lg"
              >
                ✕ Close
              </button>
            </div>
            <FetchPlaylist />
          </div>
        </div>
      )}

      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {radio.playing && (
            <div className="bg-gradient-to-r from-red-900/50 to-red-800/50 border border-red-500/50 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg animate-pulse">
              <div className="w-2 h-2 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
              <span className="text-red-100 font-semibold text-sm">
                LIVE ON AIR
              </span>
            </div>
          )}
          {/* <div className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg">
            <span className="text-sm text-gray-400">Mode: </span>
            <span className="text-sm text-white font-semibold">
              {radio.mode}
            </span>
          </div>
          <div className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg">
            <span className="text-sm text-gray-400">Listeners: </span>
            <span className="text-sm text-white font-semibold">
              {radio.listeners ?? 0}
            </span>
          </div>*/}
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl px-6 py-4 shadow-xl">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-mono font-bold text-white tracking-tight">
              {formatTime(clock)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {formatDate(clock)}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowFetchPlaylist(true)}
          className="flex items-center gap-2 px-4 md:px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Music className="w-5 h-5" />
          <span className="hidden sm:inline">Feed Playlist</span>
        </button>

        <button
          onClick={openTerminal}
          className="flex items-center gap-2 px-4 md:px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <FileText className="w-5 h-5" />
          <span className="hidden sm:inline">View Logs</span>
        </button>

        <a
          href="http://localhost:5174"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 md:px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Mic className="w-5 h-5" />
          <span className="hidden sm:inline">Record Audio</span>
        </a>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-6">
              <ControlPanel
                playing={radio.playing}
                mode={radio.mode}
                connected={radio.connected}
                isStopping={radio.isStopping}
              />

              <MusicBedSelector tracks={radio.playlist || []} />

          <PlaylistViewer
            viewMode="LIVE"
            editorPlaylistId={null}
            activePlaylistId={radio.activePlaylistId}
            onEditClose={() => {}}
            playing={radio.playing}
            radioStartTime={0}
          />
        </div>

        <div className="space-y-6">
          <StatusPanel
            nowPlaying={radio.nowPlaying}
            listeners={radio.listeners}
            mode={radio.mode}
            connected={radio.connected}
            stationInfo={radio.stationInfo}
          />
          <CrossfadePanel config={radio.crossfade} />
        </div>
      </div>
    </div>
  );
};

// --- APP UTAMA ---
export default function App() {
  const location = useLocation();
  const [muted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [showFetchPlaylist, setShowFetchPlaylist] = useState(false);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    connectSocket();
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const radio = useRadioState();

  const openTerminal = () => {
    const terminalUrl = `${window.location.origin}/terminal?standalone=true`;
    window.open(terminalUrl, "_blank", "width=1400,height=900");
  };

  const formatTime = (date) =>
    date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const formatDate = (date) =>
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatDuration = (secs) => {
    if (!secs && secs !== 0) return "--:--";
    const m = Math.floor(secs / 60);
    const s = Math.max(0, Math.floor(secs % 60));
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* GLOBAL NAVBAR - Selalu muncul */}
      <nav className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700/50 backdrop-blur-sm sticky top-0 z-50 shadow-2xl">
        <div className="max-w-[2000px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  SANOMA
                </h1>
                <p className="text-[10px] text-gray-400 tracking-wider">
                  STATION MASTER
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                to="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  location.pathname === "/"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <List className="w-4 h-4" />
                Control Panel
              </Link>
              <Link
                to="/playlist-editor"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  location.pathname === "/playlist-editor"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Edit3 className="w-4 h-4" />
                Playlist Editor
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="p-4 md:p-6 lg:p-8 text-neutral-200 font-sans">
        {/* GLOBAL PLAYER - Agar musik tidak putus saat navigasi */}
        <div className="max-w-[2000px] mx-auto mb-6">
          <StreamPlayer
            connected={radio.connected}
            playing={radio.playing}
            muted={muted}
            volume={volume}
            monitorEnabled={monitorEnabled}
            onToggleMonitor={() => setMonitorEnabled((v) => !v)}
            onVolumeChange={setVolume}
            compact
          />
        </div>

        {/* ROUTING SYSTEM */}
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                radio={radio}
                openTerminal={openTerminal}
                formatTime={formatTime}
                formatDate={formatDate}
                formatDuration={formatDuration}
                showFetchPlaylist={showFetchPlaylist}
                setShowFetchPlaylist={setShowFetchPlaylist}
                clock={clock}
              />
            }
          />

          <Route
            path="/crossfade"
            element={
              <div className="max-w-[2000px] mx-auto">
                <h2 className="text-2xl font-bold mb-4">
                  Crossfade & Music Bed Engine
                </h2>
                <GraphicalCrossfadeEngine
                  playlistItems={radio.playlist || []}
                />
              </div>
            }
          />

          <Route
            path="/playlist-editor"
            element={
              // Pastikan file ini valid, jika tidak gunakan placeholder
              <PlaylistEditorPage />
            }
          />
        </Routes>
      </div>
    </div>
  );
}
