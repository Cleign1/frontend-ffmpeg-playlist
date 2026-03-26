import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Radio, Sparkles, Waves } from "lucide-react";
import GraphicalCrossfadeEngine from "./GraphicalCrossfadeEngine";
import { connectSocket } from "../api/socket";

/**
 * GraphicalCrossfadePage
 *
 * A dedicated full-page workspace for the advanced crossfade editor.
 * This removes the modal overlay constraint and provides ample room
 * for waveform zooming, drag operations, and visual previews while
 * remaining connected to the same Socket.IO control channel.
 */
export default function GraphicalCrossfadePage() {
  useEffect(() => {
    // Ensure socket connection for control events and playlist hydration
    connectSocket();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-gray-800/70 bg-black/30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-800/40">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-purple-300">
                Crossfade Studio
              </p>
              <h1 className="text-xl font-bold text-white">
                Graphical Crossfade Engine
              </h1>
              <p className="text-xs text-gray-400">
                Visual ducking, overlaps, fades, and timing—socket-driven, no audio uploads.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-800/70 border border-gray-700 hover:bg-gray-700 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <section className="border-b border-gray-800/70 bg-gradient-to-r from-purple-900/30 via-blue-900/20 to-emerald-900/20">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-black/30 border border-purple-500/30">
              <Waves className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <p className="text-sm text-gray-200 font-semibold">
                Timeline-first editing
              </p>
              <p className="text-xs text-gray-400">
                Dedicated workspace for better zoom, drag, and layer management.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-blue-200 bg-blue-900/20 border border-blue-700/40 rounded-lg px-3 py-2">
            <Sparkles className="w-4 h-4" />
            Socket-linked to the music server (control metadata only)
          </div>
        </div>
      </section>

      {/* Editor */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <div className="h-[calc(100vh-220px)] min-h-[640px] bg-gray-900/70 border border-gray-800/80 rounded-2xl shadow-2xl overflow-hidden">
          <GraphicalCrossfadeEngine currentTimeSec={0} lockBufferSec={5} />
        </div>
      </main>
    </div>
  );
}
