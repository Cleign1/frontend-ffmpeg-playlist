import { useState, useEffect } from "react";

const formatTime = (sec) => {
  if (!sec || isNaN(sec)) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
};

export default function PlaylistTable({
  playlist,
  currentIndex,
  anchor,
  onInsert,
  onReorder,
  playlistType,
  playing,
  radioStartTime,
  onDragStartRow,
  onDragEndRow,
}) {
  const [dropTarget, setDropTarget] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // LOCKOUT CONFIGURATION: Items within this window cannot be reordered
  const LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Update current time every second when radio is playing
  useEffect(() => {
    const baseStart = anchor || radioStartTime;
    if (!playing || !baseStart) {
      setCurrentTime(Date.now());
      return;
    }

    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [playing, radioStartTime, anchor]);

  // Determine if this is an automatic playlist (from scheduler)
  // Automatic playlists should not allow reordering
  const isAutomatic = playlistType === "scheduler" || playlistType === "auto";

  // Helper: track play duration in ms
  const getPlayDurationMs = (track) => {
    if (!track) return 0;
    const cutDuration =
      (track.cutOutMs || track.cutOut || 0) -
      (track.cutInMs || track.cutIn || 0);
    const fallbackDuration =
      track.duration && track.duration > 0 ? track.duration * 1000 : 0;
    const candidate =
      track.playDurationMs ||
      (cutDuration > 0 ? cutDuration : 0) ||
      fallbackDuration;
    return candidate > 0 ? candidate : 0;
  };

  // Helper: compute absolute start time for a track using the current track as anchor
  const computeTrackStartTime = (trackIndex) => {
    const baseStart = anchor || radioStartTime;
    if (!playing || !baseStart || baseStart === 0) return null;
    if (trackIndex < 0 || trackIndex >= playlist.length) return null;

    // If we don't know which track is current, fall back to legacy cumulative calculation
    if (
      currentIndex === null ||
      currentIndex === undefined ||
      currentIndex < 0
    ) {
      let cumulativeDurationMs = 0;
      for (let i = 0; i < trackIndex; i++) {
        cumulativeDurationMs += getPlayDurationMs(playlist[i]);
      }
      return baseStart + cumulativeDurationMs;
    }

    // Calculate offset relative to the current track's start (radioStartTime/anchor)
    let offset = 0;
    if (trackIndex > currentIndex) {
      for (let i = currentIndex; i < trackIndex; i++) {
        offset += getPlayDurationMs(playlist[i]);
      }
    } else if (trackIndex < currentIndex) {
      for (let i = trackIndex; i < currentIndex; i++) {
        offset -= getPlayDurationMs(playlist[i]);
      }
    }

    return baseStart + offset;
  };

  /**
   * Check if a track is within the lockout window (next 5 minutes)
   * Tracks within this window cannot be reordered to prevent FFmpeg conflicts
   */
  const isWithinLockoutWindow = (trackIndex) => {
    const trackStartTime = computeTrackStartTime(trackIndex);
    if (!trackStartTime) return false;

    const timeUntilTrack = trackStartTime - currentTime;

    // Track is locked if it starts within the next 5 minutes
    return timeUntilTrack <= LOCKOUT_WINDOW_MS && timeUntilTrack >= 0;
  };

  const getStartTime = (trackIndex) => {
    const trackStartTime = computeTrackStartTime(trackIndex);
    if (!trackStartTime) {
      return "--:--";
    }

    // Format as HH:MM:SS
    const date = new Date(trackStartTime);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStartTimeWithHighlight = (trackIndex) => {
    const trackStartTime = computeTrackStartTime(trackIndex);
    if (!trackStartTime) {
      return {
        time: "--:--",
        isPast: false,
        isCurrent: false,
        isUpcoming: true,
      };
    }

    // Get track duration
    const currentTrack = playlist[trackIndex];
    const trackDuration = getPlayDurationMs(currentTrack);
    const trackEndTime = trackStartTime + trackDuration;

    // Determine state
    const isPast = currentTime >= trackEndTime;
    const isCurrent =
      currentTime >= trackStartTime && currentTime < trackEndTime;
    const isUpcoming = currentTime < trackStartTime;

    // Format time
    const date = new Date(trackStartTime);
    const time = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return { time, isPast, isCurrent, isUpcoming };
  };

  const handleDragStart = (e, track, index) => {
    // Disable dragging for automatic playlists
    if (isAutomatic) {
      e.preventDefault();
      return;
    }

    // Disable dragging for tracks within lockout window
    if (isWithinLockoutWindow(index)) {
      e.preventDefault();
      return;
    }

    // Include originIndex for reordering/removal
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ track, originIndex: index }),
    );
    e.dataTransfer.effectAllowed = "copyMove";
    if (onDragStartRow) onDragStartRow({ track, index });
  };

  const handleDragOver = (e, index) => {
    // Block drag operations on automatic playlists
    if (isAutomatic) {
      e.dataTransfer.dropEffect = "none";
      return;
    }

    // Block dropping on tracks within lockout window
    if (isWithinLockoutWindow(index)) {
      e.dataTransfer.dropEffect = "none";
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = "copy"; // Or move, but copy is fine for UI
    if (dropTarget !== index) setDropTarget(index);
  };

  const handleDrop = (e, targetIndex) => {
    // Block drops on automatic playlists
    if (isAutomatic) {
      return;
    }

    // Block drops on tracks within lockout window
    if (isWithinLockoutWindow(targetIndex)) {
      return;
    }

    e.preventDefault();
    setDropTarget(null);
    if (onDragEndRow) onDragEndRow();

    // 1. Handle Internal Row Drop
    const jsonData = e.dataTransfer.getData("application/json");
    if (jsonData) {
      try {
        const { track, originIndex } = JSON.parse(jsonData);

        // Check if source is also locked (shouldn't be, but double-check)
        if (originIndex !== undefined && isWithinLockoutWindow(originIndex)) {
          console.warn("Cannot reorder: Source track is within lockout window");
          return;
        }

        // If we have an origin index and onReorder is provided, use it
        if (originIndex !== undefined && onReorder) {
          onReorder(originIndex, targetIndex);
        } else if (track && onInsert) {
          onInsert(targetIndex, track);
        }
      } catch (err) {
        console.error("Drop Parse Error:", err);
      }
      return;
    }

    // 2. Handle External File Drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const trackData = {
        filename: file.name,
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Imported File",
        is_external: true,
      };
      if (onInsert) onInsert(targetIndex, trackData);
    }
  };

  const handleContainerDrop = (e) => {
    // Block drops on automatic playlists
    if (isAutomatic) {
      return;
    }

    // Only handle if we dropped on the empty space (not caught by a row)
    // We assume this means "Append to end"
    e.preventDefault();
    setDropTarget(null); // Clear any row target
    if (onDragEndRow) onDragEndRow();

    const targetIndex = playlist.length; // Append

    const jsonData = e.dataTransfer.getData("application/json");
    if (jsonData) {
      try {
        const { track, originIndex } = JSON.parse(jsonData);
        if (originIndex !== undefined && onReorder) {
          onReorder(originIndex, targetIndex);
        } else if (track && onInsert) {
          onInsert(targetIndex, track);
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // External Files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // ... (Similar logic for external files if needed, or just reuse)
      const file = e.dataTransfer.files[0];
      const trackData = {
        filename: file.name,
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Imported File",
        is_external: true,
      };
      if (onInsert) onInsert(targetIndex, trackData);
    }
  };

  const handleContainerDragOver = (e) => {
    // Block drag-over on automatic playlists
    if (isAutomatic) {
      e.dataTransfer.dropEffect = "none";
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto pb-4 relative"
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
    >
      <table className="w-full text-sm text-left border-collapse">
        {/* Sticky Header: Stays at the top while scrolling */}
        <thead className="sticky top-0 bg-neutral-950 z-10 text-neutral-500 font-mono text-xs uppercase border-b border-neutral-800 shadow-sm">
          <tr>
            <th className="p-3 w-24">Time</th>
            <th className="p-3">Artist</th>
            <th className="p-3">Title</th>
            <th className="p-3 text-right">Dur</th>
          </tr>
        </thead>

        <tbody onDragLeave={() => setDropTarget(null)}>
          {playlist.length === 0 && (
            <tr>
              <td
                colSpan="4"
                className="p-8 text-center text-neutral-600 border-dashed border-2 border-neutral-800 rounded-lg m-4"
              >
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <span className="text-2xl">📥</span>
                  <span className="text-sm font-medium">
                    Drop songs here to add to playlist
                  </span>
                </div>
              </td>
            </tr>
          )}

          {playlist.map((t, i) => {
            const active = i === currentIndex;
            const isTarget = dropTarget === i;
            const isLocked = isWithinLockoutWindow(i); // Check if locked
            const isDraggable = !isAutomatic && !isLocked; // Disable dragging for automatic playlists and locked items
            const timeInfo = getStartTimeWithHighlight(i);

            // Calculate time until track starts (for tooltip)
            let timeUntilStart = null;
            if (playing && (anchor || radioStartTime)) {
              const trackStartTime = computeTrackStartTime(i);
              if (trackStartTime) {
                timeUntilStart = Math.max(
                  0,
                  Math.floor((trackStartTime - currentTime) / 1000 / 60),
                ); // Minutes
              }
            }

            return (
              <tr
                key={t.uuid || i} // Prefer UUID for key
                draggable={isDraggable}
                onDragStart={(e) => {
                  if (!isDraggable) {
                    e.preventDefault();
                    return;
                  }
                  e.stopPropagation(); // Stop propagation so container doesn't get it
                  handleDragStart(e, t, i);
                }}
                onDragOver={(e) => {
                  e.stopPropagation(); // Prioritize Row Drop
                  handleDragOver(e, i);
                }}
                onDrop={(e) => {
                  e.stopPropagation(); // Prioritize Row Drop
                  handleDrop(e, i);
                }}
                onDragEnd={() => {
                  if (onDragEndRow) onDragEndRow();
                }}
                className={`border-b border-neutral-800/40 transition-colors ${
                  isDraggable
                    ? "cursor-grab active:cursor-grabbing"
                    : "cursor-not-allowed"
                } ${
                  active
                    ? "bg-green-500/10 text-green-100"
                    : timeInfo.isPast
                      ? "text-neutral-600 hover:bg-neutral-900/50"
                      : "text-neutral-400 hover:bg-neutral-900"
                } ${isTarget && isDraggable ? "border-t-2 border-t-blue-500 bg-neutral-800/50" : ""} ${
                  !isDraggable ? "opacity-90" : ""
                } ${isLocked ? "bg-red-950/10 border-l-2 border-l-red-600" : ""}`}
                title={
                  isAutomatic
                    ? "Automatic playlist items cannot be reordered"
                    : isLocked
                      ? `🔒 LOCKED: Plays in ${timeUntilStart} min - Cannot reorder items within 5-minute safety window`
                      : isDraggable
                        ? "Drag to reorder"
                        : ""
                }
              >
                <td
                  className={`p-3 font-mono text-xs ${
                    active
                      ? "text-green-400 font-bold"
                      : timeInfo.isCurrent
                        ? "text-yellow-400 font-bold animate-pulse"
                        : timeInfo.isPast
                          ? "text-neutral-600"
                          : isLocked
                            ? "text-orange-400"
                            : "text-neutral-500"
                  } relative`}
                >
                  {(!isDraggable || isLocked) && (
                    <span
                      className={`absolute left-1 top-1/2 -translate-y-1/2 ${
                        isLocked ? "text-red-500" : "text-yellow-500"
                      }`}
                      title={
                        isLocked
                          ? "Locked (5-min safety window)"
                          : "Locked (Automatic)"
                      }
                    >
                      🔒
                    </span>
                  )}
                  <span className={!isDraggable || isLocked ? "ml-5" : ""}>
                    {timeInfo.time}
                    {timeInfo.isCurrent && (
                      <span className="ml-1 text-xs">▶</span>
                    )}
                    {isLocked && timeUntilStart !== null && (
                      <span className="ml-2 text-[10px] text-red-400">
                        ({timeUntilStart}m)
                      </span>
                    )}
                  </span>
                </td>
                <td
                  className={`p-3 font-medium truncate max-w-35 ${timeInfo.isPast ? "opacity-50" : ""}`}
                >
                  {t.artist}
                </td>
                <td
                  className={`p-3 text-neutral-300 truncate max-w-45 ${timeInfo.isPast ? "opacity-50" : ""}`}
                >
                  {t.title}
                </td>
                <td
                  className={`p-3 text-right font-mono text-xs opacity-60 ${timeInfo.isPast ? "opacity-30" : ""}`}
                >
                  {formatTime(t.duration)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Spacer to make it easier to drop at bottom */}
      <div className="h-20" />
    </div>
  );
}
