import { useState, useEffect, useMemo, useRef } from "react";
import { io } from "socket.io-client";
import PlaylistHeader from "./PlaylistHeader";
import NowPlayingPanel from "./NowPlayingPanel";
import PlaylistTable from "./PlaylistTable";

// CONFIG: Use Env Variable with a fallback
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const STREAM_LATENCY_MS = Number(
  import.meta.env.VITE_STREAM_LATENCY_MS || 3000,
);

export default function PlaylistViewer({
  viewMode = "LIVE",
  editorPlaylistId = null,
  onEditClose,
  activePlaylistId,
  playing,
  radioStartTime,
}) {
  const [playlist, setPlaylist] = useState([]);
  const [listeners, setListeners] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [displayTrack, setDisplayTrack] = useState(null);
  const [progress, setProgress] = useState(0);
  const [anchorTime, setAnchorTime] = useState(0);
  const [displayAnchorTime, setDisplayAnchorTime] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [playlistType, setPlaylistType] = useState(null); // Track playlist type
  const [internalRadioStartTime, setInternalRadioStartTime] = useState(0); // Track when radio started
  const [dragContext, setDragContext] = useState({ index: null, track: null });
  const [isTrashHover, setIsTrashHover] = useState(false);
  const [hasRequestedNextHour, setHasRequestedNextHour] = useState(false);

  const statusRef = useRef({
    startedAt: 0,
    isPlaying: false,
  });

  const displayRef = useRef({
    track: null,
    startedAt: 0,
    pending: null,
    timeoutId: null,
  });

  const socketRef = useRef(null);

  const currentTrackIndex = useMemo(() => {
    if (viewMode === "EDITOR") return -1; // No "Current Track" highlighting in Editor
    if (!currentTrack || playlist.length === 0) return -1;
    if (currentTrack.uuid) {
      const idx = playlist.findIndex((t) => t.uuid === currentTrack.uuid);
      if (idx !== -1) return idx;
    }
    return playlist.findIndex(
      (t) =>
        (t.fileName && t.fileName === currentTrack.fileName) ||
        (t.title === currentTrack.title && t.artist === currentTrack.artist),
    );
  }, [playlist, currentTrack, viewMode]);

  const displayTrackIndex = useMemo(() => {
    if (viewMode === "EDITOR") return -1;
    if (!displayTrack || playlist.length === 0) return -1;
    if (displayTrack.uuid) {
      const idx = playlist.findIndex((t) => t.uuid === displayTrack.uuid);
      if (idx !== -1) return idx;
    }
    return playlist.findIndex(
      (t) =>
        (t.fileName && t.fileName === displayTrack.fileName) ||
        (t.title === displayTrack.title && t.artist === displayTrack.artist),
    );
  }, [playlist, displayTrack, viewMode]);

  const getTrackDurationMs = (track) => {
    if (!track) return 0;
    if (track.playDurationMs && track.playDurationMs > 0)
      return track.playDurationMs;
    const cutOut = track.cutOutMs ?? track.cutOut ?? 0;
    const cutIn = track.cutInMs ?? track.cutIn ?? 0;
    const cutDuration = cutOut - cutIn;
    if (cutDuration > 0) return cutDuration;
    if (track.duration && track.duration > 0) return track.duration * 1000;
    return 0;
  };

  const isSameTrack = (a, b) => {
    if (!a || !b) return false;
    if (a.uuid && b.uuid) return a.uuid === b.uuid;
    if (a.fileName && b.fileName) return a.fileName === b.fileName;
    return a.title === b.title && a.artist === b.artist;
  };

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    // LIVE MODE LOGIC
    socket.on("playlist_update", (data) => {
      if (viewMode === "LIVE") {
        const list = data.playlist || data || [];
        setPlaylist(list);
      }
    });

    const handleStatus = (status) => {
      setListeners(status.listeners || 0);
      setCurrentTrack(status.currentTrack);
      const start = status.currentStreamStart || Date.now();
      setAnchorTime(start);
      statusRef.current = { startedAt: start, isPlaying: status.isPlaying };

      // Track radio start time - when radio starts playing, record the time
      if (status.isPlaying && internalRadioStartTime === 0) {
        // Calculate when the playlist actually started (not just current track)
        // This should be when the first track started
        const firstTrackStart = start - (status.currentTrackOffset || 0);
        setInternalRadioStartTime(firstTrackStart);
      } else if (!status.isPlaying) {
        // Reset when radio stops
        setInternalRadioStartTime(0);
      }

      const incomingTrack = status.currentTrack || null;
      const incomingStart = status.currentStreamStart || Date.now();

      if (!status.isPlaying || !incomingTrack) {
        if (displayRef.current.timeoutId) {
          clearTimeout(displayRef.current.timeoutId);
        }
        displayRef.current = {
          track: null,
          startedAt: 0,
          pending: null,
          timeoutId: null,
        };
        setDisplayTrack(null);
        setDisplayAnchorTime(0);
        return;
      }

      const commitDisplay = (track, startedAt) => {
        if (displayRef.current.timeoutId) {
          clearTimeout(displayRef.current.timeoutId);
        }
        displayRef.current.track = track;
        displayRef.current.startedAt = startedAt;
        displayRef.current.pending = null;
        displayRef.current.timeoutId = null;
        setDisplayTrack(track);
        setDisplayAnchorTime(startedAt);
      };

      const currentDisplay = displayRef.current.track;

      if (!currentDisplay || isSameTrack(currentDisplay, incomingTrack)) {
        commitDisplay(incomingTrack, incomingStart);
        return;
      }

      const durationMs = getTrackDurationMs(currentDisplay);
      if (!durationMs) {
        commitDisplay(incomingTrack, incomingStart);
        return;
      }

      const displayEndAt =
        displayRef.current.startedAt + durationMs + STREAM_LATENCY_MS;
      const remainingMs = displayEndAt - Date.now();

      if (remainingMs <= 0) {
        commitDisplay(incomingTrack, incomingStart);
        return;
      }

      displayRef.current.pending = {
        track: incomingTrack,
        startedAt: incomingStart,
      };
      if (displayRef.current.timeoutId) {
        clearTimeout(displayRef.current.timeoutId);
      }

      displayRef.current.timeoutId = setTimeout(() => {
        const pending = displayRef.current.pending;
        if (pending) commitDisplay(pending.track, pending.startedAt);
      }, remainingMs);
    };

    socket.on("status_update", handleStatus);
    socket.on("player:state", handleStatus);

    return () => {
      if (displayRef.current.timeoutId) {
        clearTimeout(displayRef.current.timeoutId);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [viewMode]); // Re-run if mode changes (though mainly we just gate the update)

  // EDITOR MODE: Fetch Content
  useEffect(() => {
    if (viewMode === "EDITOR" && editorPlaylistId && socketRef.current) {
      // Determine playlist type from filename
      let type = "manual";
      if (editorPlaylistId.startsWith("playlist_")) type = "scheduler";
      else if (editorPlaylistId.startsWith("manual_")) type = "manual";
      setPlaylistType(type);
      setPlaylist([]); // Clear previous

      socketRef.current.emit(
        "playlist:read",
        { id: editorPlaylistId },
        (res) => {
          if (res.ok) setPlaylist(res.tracks);
          else console.error("Failed to load playlist:", res.error);
        },
      );
    }
  }, [viewMode, editorPlaylistId]);

  // LIVE MODE: Determine active playlist type
  useEffect(() => {
    if (viewMode === "LIVE" && activePlaylistId) {
      let type = "scheduler"; // Default for live is usually scheduler
      if (activePlaylistId.startsWith("manual_")) type = "manual";
      else if (activePlaylistId.startsWith("playlist_")) type = "scheduler";
      setPlaylistType(type);
      setHasRequestedNextHour(false);
    } else if (viewMode === "LIVE") {
      setPlaylistType("scheduler"); // Default
      setHasRequestedNextHour(false);
    }
  }, [viewMode, activePlaylistId]);

  // SAVE HANDLER (Manual playlists: editor or live-manual)
  const savePlaylist = (newTracks) => {
    const targetId = viewMode === "LIVE" ? activePlaylistId : editorPlaylistId;
    if (!targetId) return;
    if (viewMode === "LIVE" && playlistType !== "manual") return; // only allow live saves for manual playlists

    setIsSaving(true);
    socketRef.current.emit(
      "playlist:update_manual",
      { id: targetId, tracks: newTracks },
      (res) => {
        setIsSaving(false);
        if (res.ok) {
          // Success feedback?
        } else {
          alert("Failed to save: " + res.error);
        }
      },
    );
  };

  const handleInsert = (index, track) => {
    if (viewMode === "LIVE" && playlistType !== "manual") {
      alert("Cannot edit the LIVE scheduler playlist directly.");
      return;
    }

    // Optimistic Update
    const newPlaylist = [...playlist];

    // Standardize Track Object
    const cleanTrack = {
      ...track,
      uuid: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), // Temp UUID
      cutInMs: track.cutInMs || 0,
      cutOutMs: track.cutOutMs || 0,
      mixPointMs: track.mixPointMs || 0,
      title: track.title || track.filename,
      artist: track.artist || "Unknown",
      duration: track.duration || 0,
      playDurationMs: track.playDurationMs || 0,
    };

    newPlaylist.splice(index, 0, cleanTrack);
    setPlaylist(newPlaylist);
    savePlaylist(newPlaylist);
  };

  const handleReorder = (fromIndex, toIndex) => {
    if (viewMode === "LIVE" && playlistType !== "manual") return;
    const newPlaylist = [...playlist];
    const [moved] = newPlaylist.splice(fromIndex, 1);
    newPlaylist.splice(toIndex, 0, moved);
    setPlaylist(newPlaylist);
    savePlaylist(newPlaylist);
  };

  const handleRemove = (index) => {
    if (playlistType !== "manual") return;
    if (
      index === null ||
      index === undefined ||
      index < 0 ||
      index >= playlist.length
    )
      return;
    const newPlaylist = [...playlist];
    newPlaylist.splice(index, 1);
    setPlaylist(newPlaylist);
    savePlaylist(newPlaylist);
  };

  // We need to update PlaylistTable to support onReorder if not present,
  // or just use onInsert logic if it handles drops internally.
  // Current PlaylistTable handles "Drop" by calling onInsert.
  // We need to enhance PlaylistTable to support Reordering (Internal Drag).
  // But for now, let's assume onInsert handles "New Tracks" and we might need a separate handler for internal moves.

  // ... Wait, PlaylistTable implementation:
  // onDrop -> if (jsonData) ... if (track && onInsert) onInsert...
  // It handles internal rows as "Insert Copy".
  // Real reorder requires knowing it came from the same list.
  // The current PlaylistTable implementation sends "track" data in dragStart.
  // It doesn't send "index".
  // If I want reorder, I need index.

  const handlePlay = (uuid) => {
    if (!socketRef.current) return;
    // Only allow play command from LIVE view (to avoid confusion) OR allow preview?
    // Let's allow Play from anywhere, but it forces the radio to play that UUID from the ACTIVE playlist.
    // If we are editing a non-active playlist, this might fail or play the wrong song if UUID collision (unlikely)
    // or simply not find it.

    if (viewMode === "EDITOR") {
      // Preview? Or Switch?
      // For now, disable Play in Editor to avoid confusion.
      return;
    }

    console.log("Requesting Play for UUID:", uuid);
    socketRef.current.emit("player:play", { uuid }, (response) => {
      if (!response.ok) {
        console.error("Play Failed:", response.error);
      }
    });
  };

  // When we are within the last 5 tracks of the hour, proactively ask the backend to append the next hour
  useEffect(() => {
    if (viewMode !== "LIVE") return;
    if (playlistType !== "scheduler" && playlistType !== "manual") return;
    if (!statusRef.current.isPlaying) return;
    if (!socketRef.current || playlist.length === 0) return;

    const safeIndex = currentTrackIndex >= 0 ? currentTrackIndex : 0;
    const remaining = playlist.length - (safeIndex + 1);

    // Reset the flag when we have plenty of headroom so subsequent hours can preload
    if (remaining > 8 && hasRequestedNextHour) {
      setHasRequestedNextHour(false);
      return;
    }

    if (remaining <= 5 && !hasRequestedNextHour) {
      setHasRequestedNextHour(true);

      socketRef.current.emit("playlist:preload_next_hour", (res) => {
        if (res?.ok && Array.isArray(res.tracks) && res.tracks.length) {
          setPlaylist((prev) => {
            const known = new Set(prev.map((t) => t.uuid));
            const unique = res.tracks.filter((t) => !known.has(t.uuid));
            return unique.length ? [...prev, ...unique] : prev;
          });
        } else if (res?.ok === false) {
          // allow retry after a short pause if backend reported failure
          setTimeout(() => setHasRequestedNextHour(false), 5000);
        }
      });
    }
  }, [
    playlist,
    currentTrackIndex,
    viewMode,
    playlistType,
    hasRequestedNextHour,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      const { isPlaying } = statusRef.current;
      const startedAt = displayRef.current.startedAt;
      const effectiveStart = startedAt + STREAM_LATENCY_MS;
      if (isPlaying && startedAt > 0) {
        setProgress(Math.max(0, (Date.now() - effectiveStart) / 1000));
      } else {
        setProgress(0);
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  if (!isConnected && playlist.length === 0 && viewMode === "LIVE") {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-900 text-neutral-500 rounded-xl border border-neutral-800">
        <div className="text-center">
          <p className="animate-pulse">Connecting to Station...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col w-full flex-1 min-h-0 overflow-hidden rounded-xl border transition-colors ${viewMode === "EDITOR" ? "bg-indigo-950/20 border-indigo-500/50" : "bg-neutral-950/50 border-neutral-800"}`}
    >
      {/* HEADER OVERRIDE FOR EDITOR */}
      {viewMode === "EDITOR" ? (
        <div className="p-4 bg-indigo-900/40 border-b border-indigo-500/30 flex justify-between items-center">
          <div>
            <h2 className="text-indigo-100 font-bold text-lg flex items-center gap-2">
              ✏️ EDITING:{" "}
              <span className="font-mono text-indigo-300">
                {editorPlaylistId}
              </span>
            </h2>
            <p className="text-indigo-400 text-xs mt-1">
              {playlistType === "scheduler" ? (
                <>
                  🔒 Automatic Playlist (Read-Only) - Items cannot be reordered
                  or modified
                </>
              ) : (
                <>
                  Drag tracks here from the Media Library. Changes save
                  automatically.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="text-xs text-yellow-400 animate-pulse">
                SAVING...
              </span>
            )}
            <button
              onClick={onEditClose}
              className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1 rounded text-sm"
            >
              Close Editor
            </button>
          </div>
        </div>
      ) : (
        <>
          <PlaylistHeader listeners={listeners} />
          {playlistType === "scheduler" && (
            <div className="px-4 py-2 bg-yellow-900/20 border-b border-yellow-800/30 flex items-center gap-2 text-xs text-yellow-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                Automatic Playlist Active - Drag & drop disabled for scheduled
                items
              </span>
            </div>
          )}
        </>
      )}

      {currentTrack && viewMode === "LIVE" && (
        <NowPlayingPanel
          playlist={playlist}
          index={displayTrackIndex !== -1 ? displayTrackIndex : 0}
          progress={progress}
        />
      )}

      <PlaylistTable
        playlist={playlist}
        currentIndex={displayTrackIndex}
        anchor={viewMode === "LIVE" ? displayAnchorTime : 0}
        onInsert={handleInsert}
        onReorder={handleReorder}
        onPlay={handlePlay}
        playlistType={playlistType}
        playing={statusRef.current.isPlaying}
        radioStartTime={internalRadioStartTime || radioStartTime || 0}
        onDragStartRow={({ track, index }) => {
          setDragContext({ track, index });
          setIsTrashHover(false);
        }}
        onDragEndRow={() => {
          setDragContext({ track: null, index: null });
          setIsTrashHover(false);
        }}
      />

      {/* Removal Dropzone (active only while dragging in editor manual mode) */}
      {viewMode === "EDITOR" &&
        playlistType === "manual" &&
        dragContext.track && (
          <div
            className={`pointer-events-auto absolute top-3 right-3 px-4 py-3 rounded-lg border text-xs font-semibold transition-all shadow-lg ${
              isTrashHover
                ? "bg-red-600 text-white border-red-400 scale-105"
                : "bg-neutral-900 text-neutral-200 border-neutral-700 opacity-90"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsTrashHover(true);
            }}
            onDragLeave={() => setIsTrashHover(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsTrashHover(false);
              try {
                const jsonData = e.dataTransfer.getData("application/json");
                if (jsonData) {
                  const { originIndex } = JSON.parse(jsonData);
                  if (originIndex !== undefined) {
                    handleRemove(originIndex);
                  }
                }
              } catch (err) {
                console.error("Remove drop parse error", err);
              }
              setDragContext({ track: null, index: null });
            }}
          >
            <div className="flex items-center gap-2">
              <span>🗑️ Drag here to remove</span>
              {dragContext.track && (
                <span className="font-mono text-[11px] text-neutral-400 truncate max-w-48">
                  {dragContext.track.title || dragContext.track.filename}
                </span>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
