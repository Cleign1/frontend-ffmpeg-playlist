import { useState, useEffect } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Edit3,
  PlayCircle,
  Clock,
  List,
  RefreshCw,
} from "lucide-react";
import { getSocket } from "../api/socket";

export default function PlaylistManager({
  activePlaylistId,
  pendingPlaylistId,
  onSelectForEdit,
}) {
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");

  const normalizeId = (id) => {
    if (typeof id !== "string") return id;
    const base = id.split(/[\\/]/).pop();
    if (!base) return id;
    const trimmed = base.endsWith(".json") ? base.slice(0, -5) : base;
    return trimmed.toLowerCase();
  };

  const normalizedActiveId = normalizeId(activePlaylistId);

  const fetchPlaylists = () => {
    const socket = getSocket();
    socket.emit("playlist:list", (res) => {
      if (res.ok) setPlaylists(res.playlists);
    });
  };

  useEffect(() => {
    const socket = getSocket();
    if (socket.connected) fetchPlaylists();

    const onUpdate = () => fetchPlaylists();
    // Add Connect Listener
    const onConnect = () => fetchPlaylists();

    socket.on("playlists:updated", onUpdate);
    socket.on("connect", onConnect);

    return () => {
      socket.off("playlists:updated", onUpdate);
      socket.off("connect", onConnect);
    };
  }, []);

  useEffect(() => {
    if (!normalizedActiveId) return;
    const exists = playlists.some(
      (p) => normalizeId(p.id) === normalizedActiveId,
    );
    if (!exists) fetchPlaylists();
  }, [normalizedActiveId, playlists]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    setCreating(true);
    const socket = getSocket();
    socket.emit("playlist:create", { name: newPlaylistName }, (res) => {
      setCreating(false);
      if (res.ok) {
        setNewPlaylistName("");
        fetchPlaylists();
      } else {
        alert(res.error);
      }
    });
  };

  // New Clone Handler
  const handleCloneLive = () => {
    if (!activePlaylistId) {
      alert("No active playlist to clone.");
      return;
    }

    const name = prompt("Enter name for the cloned playlist:");
    if (!name) return;

    getSocket().emit(
      "playlist:clone",
      { sourceId: activePlaylistId, newName: name },
      (res) => {
        if (!res.ok) alert(res.error);
        // playlist:updated event will trigger refresh
      },
    );
  };

  const handleDelete = (id) => {
    if (deletingId) return;
    const target = playlists.find((p) => p.id === id);
    const displayName = target?.name || id;
    if (!confirm(`Delete playlist "${displayName}"?`)) return;

    setDeletingId(id);

    getSocket().emit("playlist:delete", { id }, (res) => {
      setDeletingId(null);
      if (res.ok) {
        fetchPlaylists();
      } else {
        alert(res.error || "Failed to delete playlist");
      }
    });
  };

  const handleSwitch = (id) => {
    if (!confirm(`Switch LIVE BROADCAST to ${id}?`)) return;
    getSocket().emit("radio:switch_playlist", { id }, (res) => {
      if (!res.ok) {
        alert(res.error);
      } else if (res.pending) {
        alert(`Queued ${id}. It will apply after the current track.`);
      }
    });
  };

  const handleQueueSwitch = (id) => {
    getSocket().emit("radio:queue_switch", { id }, (res) => {
      if (!res.ok) {
        alert(res.error || "Failed to queue playlist");
      } else {
        alert(`Queued ${id}. It will apply after the current track.`);
      }
    });
  };

  const handleCancelPending = () => {
    getSocket().emit("radio:cancel_pending", (res) => {
      if (!res?.success)
        alert(res?.error || "Failed to cancel pending playlist");
    });
  };

  const handleApplyPending = () => {
    getSocket().emit("radio:apply_pending", (res) => {
      if (!res?.success)
        alert(res?.error || "Failed to apply pending playlist");
    });
  };

  const filteredPlaylists = playlists.filter((pl) => {
    const matchesType =
      typeFilter === "manual"
        ? pl.type === "manual"
        : typeFilter === "scheduler"
          ? pl.type !== "manual"
          : true;
    const matchesSearch = pl.name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const sortedPlaylists = [...filteredPlaylists].sort((a, b) => {
    let result = 0;
    if (sortBy === "name") result = a.name.localeCompare(b.name);
    else if (sortBy === "type")
      result = (a.type || "").localeCompare(b.type || "");
    else
      result = new Date(a.modified).getTime() - new Date(b.modified).getTime();
    return sortOrder === "asc" ? result : -result;
  });

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-[520px] lg:min-h-[640px] max-h-[85vh]">
      <div className="p-6 border-b border-gray-700/50 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg shadow-lg">
            <List className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex flex-col">
            <h3
              className="text-xl font-bold text-white tracking-tight"
              aria-label="Playlist Manager panel"
            >
              Playlist Manager
            </h3>
            <div className="text-[11px] text-gray-400 flex flex-wrap gap-3 mt-1">
              <span className="flex items-center gap-1">
                <span className="text-gray-500">Active:</span>
                <span className="text-white font-semibold">
                  {activePlaylistId || "—"}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-gray-500">Pending:</span>
                <span className="text-amber-300 font-semibold">
                  {pendingPlaylistId || "—"}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-gray-900/60 border border-gray-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  typeFilter === "all"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-gray-300 hover:text-white hover:bg-gray-800"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("scheduler")}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  typeFilter === "scheduler"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-gray-300 hover:text-white hover:bg-gray-800"
                }`}
              >
                Scheduler
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("manual")}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-all ${
                  typeFilter === "manual"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-gray-300 hover:text-white hover:bg-gray-800"
                }`}
              >
                Manual
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search playlists..."
                className="bg-gray-900/70 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                Sort
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-900/70 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="recent">Most Recent</option>
                <option value="name">Name (A-Z)</option>
                <option value="type">Type</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-gray-900/70 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
              <button
                type="button"
                onClick={fetchPlaylists}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg border border-gray-700 shadow-sm transition"
              >
                <RefreshCw className="w-4 h-4 text-gray-300" />
                Refresh
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <form onSubmit={handleCreate} className="flex gap-2">
              <input
                className="bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white flex-1 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder-gray-400 shadow-inner"
                placeholder="New Playlist Name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                disabled={creating}
              />
              <button
                type="submit"
                disabled={creating}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:from-gray-700 disabled:to-gray-700 text-white px-5 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <button
              onClick={handleCloneLive}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02]"
            >
              <Copy className="w-4 h-4" />
              Clone Active Playlist
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {pendingPlaylistId && (
          <div className="p-5 rounded-xl border border-amber-500/50 bg-gradient-to-br from-amber-900/30 to-amber-800/20 text-amber-200 flex flex-col gap-3 shadow-lg shadow-amber-900/20">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="font-bold uppercase tracking-wider text-sm">
                Pending Switch:
              </span>
              <span className="px-3 py-1.5 bg-amber-500 text-black rounded-lg font-mono text-xs font-bold shadow-md">
                {pendingPlaylistId}
              </span>
            </div>
            <p className="text-xs text-amber-100/90 font-medium">
              Will apply after current track ends.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleApplyPending}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-lg text-xs font-bold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02]"
              >
                Apply Now
              </button>
              <button
                onClick={handleCancelPending}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-amber-400/50 text-amber-100 hover:bg-gray-700 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-[1.02]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {sortedPlaylists.map((pl) => {
          const isActive = normalizedActiveId === normalizeId(pl.id);
          const isDeleting = deletingId === pl.id;

          return (
            <div
              key={pl.id}
              className={`p-5 rounded-xl border transition-all duration-200 group ${
                isActive
                  ? "bg-gradient-to-br from-green-900/30 to-green-800/20 border-green-500/40 shadow-lg shadow-green-900/10"
                  : "bg-gradient-to-br from-gray-900/50 to-gray-900/30 border-gray-700/50 hover:from-gray-800/70 hover:to-gray-800/50 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-900/10"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div
                    className={`text-base font-bold flex flex-wrap items-center gap-2 break-words ${
                      isActive ? "text-white" : "text-gray-300"
                    }`}
                  >
                    <span className="break-words break-all" title={pl.name}>
                      {pl.name}
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-[10px] rounded-lg font-bold shadow-lg">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-sm" />
                        ON AIR
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-gray-400 font-mono mt-1.5 flex items-center gap-2">
                    <span>{new Date(pl.modified).toLocaleString()}</span>
                    <span className="">•</span>
                    <span className="text-purple-400 font-semibold">
                      {pl.type.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleDelete(pl.id)}
                    disabled={isDeleting}
                    className={`p-2 rounded-lg transition-all ${isDeleting ? "text-red-300/70 bg-red-900/30 cursor-not-allowed" : "text-red-400 hover:text-red-300 hover:bg-red-900/30"}`}
                    title={isDeleting ? "Deleting..." : `Delete ${pl.name}`}
                  >
                    <Trash2
                      className={`w-4 h-4 ${isDeleting ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                <button
                  onClick={() => onSelectForEdit(pl)}
                  className="flex items-center justify-center gap-1 bg-gray-700/80 hover:bg-gray-600 text-gray-200 hover:text-white py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={() => handleQueueSwitch(pl.id)}
                  className="flex items-center justify-center gap-1 bg-gray-700/80 hover:bg-gray-600 text-gray-200 hover:text-white py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                >
                  <Clock className="w-3 h-3" />
                  Queue
                </button>
                <button
                  onClick={() => handleSwitch(pl.id)}
                  disabled={isActive}
                  className={`flex items-center justify-center gap-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                    isActive
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-md hover:shadow-lg hover:scale-105"
                  }`}
                >
                  <PlayCircle className="w-3 h-3" />
                  Live
                </button>
              </div>
            </div>
          );
        })}
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
