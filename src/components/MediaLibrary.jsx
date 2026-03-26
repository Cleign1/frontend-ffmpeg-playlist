/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from "react";
import { Search, Music, Mic, RefreshCw, Eye, Folder } from "lucide-react";
import { getSocket } from "../api/socket";
import AudioPreviewSocket from "./AudioPreviewSocket";
import { useTrackMetadataBatch } from "../hooks/useTrackMetadata";

export default function MediaLibrary({ onDragStart }) {
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [previewFile, setPreviewFile] = useState(null);

  // Extract filenames for batch metadata fetch
  const filenames = useMemo(
    () => library.map((item) => item.filename),
    [library],
  );

  // Batch fetch metadata for all library items
  const {
    metadataMap,
    isLoading: metadataLoading,
    getDisplayName,
  } = useTrackMetadataBatch(filenames, { enabled: filenames.length > 0 });

  const fetchLibrary = () => {
    setLoading(true);
    const socket = getSocket();
    socket.emit("library:list", (response) => {
      if (response.ok) {
        setLibrary(response.library);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    const socket = getSocket();
    if (socket.connected) fetchLibrary();

    const onConnect = () => fetchLibrary();
    const onLibraryUpdate = (payload) => {
      if (Array.isArray(payload)) {
        setLibrary(payload);
      } else {
        fetchLibrary();
      }
    };
    socket.on("connect", onConnect);
    socket.on("library:update", onLibraryUpdate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("library:update", onLibraryUpdate);
    };
  }, []);

  const filtered = library.filter((item) => {
    const displayName = getDisplayName(item.filename);
    const categoryRaw = item.category || "Other";
    const normalizedCategory =
      categoryRaw === "Ad"
        ? "Ads"
        : categoryRaw === "Spot"
          ? "Spot"
          : categoryRaw === "Voice"
            ? "Voice Track"
            : categoryRaw === "Uncategorized"
              ? "Other"
              : categoryRaw;
    const query = filter.toLowerCase();
    const matchesQuery =
      displayName.toLowerCase().includes(query) ||
      item.filename.toLowerCase().includes(query) ||
      normalizedCategory.toLowerCase().includes(query);
    const matchesCategory =
      activeCategory === "All" || normalizedCategory === activeCategory;
    return matchesQuery && matchesCategory;
  });

  // Group by normalized Category
  const grouped = filtered.reduce((acc, item) => {
    const catRaw = item.category || "Other";
    const cat =
      catRaw === "Ad"
        ? "Ads"
        : catRaw === "Spot"
          ? "Spot"
          : catRaw === "Voice"
            ? "Voice Track"
            : catRaw === "Uncategorized"
              ? "Other"
              : catRaw;
    acc[cat] = acc[cat] || [];
    acc[cat].push(item);
    return acc;
  }, {});
  const canonicalOrder = [
    "Music",
    "Voice Track",
    "Jingle",
    "Ads",
    "Spot",
    "Other",
  ];
  const categoryIconMap = {
    Music,
    "Voice Track": Mic,
    Spot: Music,
    Ads: Music,
    Jingle: Music,
    Other: Folder,
    All: Music,
  };
  const categoryFilters = [
    "All",
    "Music",
    "Voice Track",
    "Jingle",
    "Ads",
    "Spot",
    "Other",
  ];
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = canonicalOrder.indexOf(a);
    const bi = canonicalOrder.indexOf(b);
    const aIdx = ai === -1 ? canonicalOrder.length : ai;
    const bIdx = bi === -1 ? canonicalOrder.length : bi;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.localeCompare(b);
  });

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[700px]">
      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <AudioPreviewSocket
              filename={previewFile}
              onClose={() => setPreviewFile(null)}
            />
          </div>
        </div>
      )}

      <div className="p-6 border-b border-gray-700/50 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg shadow-lg">
              <Folder className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Media Library
            </h3>
          </div>
          <button
            onClick={fetchLibrary}
            className="p-2.5 bg-gray-700/50 hover:bg-gray-600/70 rounded-lg transition-all duration-200 group shadow-lg"
            title="Refresh library"
          >
            <RefreshCw className="w-4 h-4 text-gray-400 group-hover:text-white group-hover:rotate-180 transition-all duration-500" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tracks..."
            className="w-full pl-10 pr-4 py-3 bg-gradient-to-r from-gray-900/70 to-gray-900/40 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-inner"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {categoryFilters.map((cat) => {
            const isActive = activeCategory === cat;
            const Icon = categoryIconMap[cat] || Music;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  isActive
                    ? "bg-purple-600/20 text-white border-purple-500 shadow-inner"
                    : "bg-gray-900/50 text-gray-300 border-gray-700 hover:border-purple-500/40 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        {(loading || metadataLoading) && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-700 border-t-purple-500 shadow-lg"></div>
            <p className="text-sm text-gray-400 mt-4 font-medium">
              Loading library...
            </p>
          </div>
        )}

        {!loading &&
          sortedCategories.map((cat) => {
            const CategoryIcon = categoryIconMap[cat] || Music;

            return (
              <div key={cat}>
                <div className="flex items-center gap-2 text-xs font-bold text-purple-400 mb-4 px-2 uppercase tracking-wider">
                  <CategoryIcon className="w-4 h-4" />
                  <span>{cat}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 to-transparent ml-2"></div>
                </div>
                <div className="space-y-2.5">
                  {grouped[cat].map((item) => {
                    // Get display name from metadata hook (Title - Artist) or fallback to audio_id
                    const trackMetadata = metadataMap[item.filename];

                    // Prefer metadata titles, then library titles, then filename fallback
                    const displayName =
                      trackMetadata?.title && trackMetadata?.artist
                        ? `${trackMetadata.title} - ${trackMetadata.artist}`
                        : item.title && item.artist
                          ? `${item.title} - ${item.artist}`
                          : getDisplayName(item.filename);

                    return (
                      <div
                        key={item.filename}
                        draggable="true"
                        onDragStart={(e) => {
                          // Use metadata values if available, otherwise use library item values
                          const trackData = {
                            title: trackMetadata?.title || item.title,
                            artist: trackMetadata?.artist || item.artist,
                            filename: item.filename,
                            category: trackMetadata?.category || item.category,
                            duration: item.duration,
                            playDurationMs: item.playDurationMs,
                            cutInMs: trackMetadata?.cutIn ?? item.cutInMs,
                            cutOutMs: trackMetadata?.cutOut ?? item.cutOutMs,
                            mixPointMs:
                              trackMetadata?.mix_point_pr_ev ?? item.mixPointMs,
                          };
                          e.dataTransfer.setData(
                            "application/json",
                            JSON.stringify({ track: trackData }),
                          );
                          if (onDragStart) onDragStart(item);
                        }}
                        className="group bg-gradient-to-br from-gray-900/50 to-gray-900/30 hover:from-gray-800/70 hover:to-gray-800/50 border border-gray-700/50 hover:border-purple-500/50 rounded-lg p-3.5 cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-lg hover:shadow-purple-900/10 hover:scale-[1.01]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-900/30 rounded-lg group-hover:bg-purple-900/50 transition-all duration-200 flex-shrink-0 shadow-inner">
                            <Music className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className="truncate text-sm font-semibold text-white group-hover:text-purple-300 transition-colors"
                              title={displayName}
                            >
                              {displayName}
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-xs text-gray-500 font-mono font-semibold bg-gray-800/50 px-2 py-0.5 rounded">
                                {item.filename.split(".").pop().toUpperCase()}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewFile(item.filename);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1.5 px-2.5 py-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 rounded-lg font-medium border border-transparent hover:border-purple-500/30"
                                title="Preview & Health Check"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Preview
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gradient-to-r from-gray-900/70 to-gray-900/50 border-t border-gray-700/50">
        <div className="text-center text-xs text-gray-400 font-semibold">
          <span className="text-purple-400">{filtered.length}</span> tracks
          available
        </div>
      </div>

      <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }

                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(31, 41, 55, 0.5);
                    border-radius: 4px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(107, 114, 128, 0.5);
                    border-radius: 4px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(107, 114, 128, 0.8);
                }
            `}</style>
    </div>
  );
}
