/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";

// Hardcoded URL
const STREAM_URL = "http://localhost:3000/api/stream";

export default function StreamPlayer({
  connected,
  playing,
  muted,
  volume,
  monitorEnabled,
  onToggleMonitor,
  onVolumeChange,
  compact = false,
}) {
  const audioRef = useRef(null);

  // REFS: Track internal logic without triggering re-renders
  const hasSkippedRef = useRef(false);
  const systemMutedRef = useRef(true);

  // STATE: Only for UI updates
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);

  // 1. MAIN LOGIC: Handle Connection manually
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (monitorEnabled && connected && playing) {
      // --- START UP ---
      hasSkippedRef.current = false;
      systemMutedRef.current = true;

      // REMOVED: setError(false) - forcing state update here caused the error.
      // We rely on the play() promise below to clear the error on success.

      // Manual DOM manipulation
      audio.src = `${STREAM_URL}?t=${Date.now()}`;
      audio.muted = true;
      audio.load();

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // SUCCESS: Clear error here (asynchronously), which is safe.
            setError(false);
          })
          .catch((e) => {
            console.error("Autoplay prevented:", e);
            setError(true);
          });
      }
    } else {
      // --- SHUT DOWN ---
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setBuffering(false);
      // We don't strictly need to clear error here,
      // but if you want to reset the dot color on stop, you can do:
      // setError(false);
    }
  }, [monitorEnabled, connected, playing]);

  // 2. VOLUME SYNC
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = systemMutedRef.current || muted;
    }
  }, [volume, muted]);

  // 3. START IMMEDIATELY (NO DELAY)
  const handleCanPlay = () => {
    if (hasSkippedRef.current) return;
    hasSkippedRef.current = true;

    systemMutedRef.current = false;
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
    setBuffering(false);
  };

  return (
    <div
      className={`flex items-center ${
        compact ? "gap-2 px-3 py-1 text-xs" : "gap-3 px-4 py-2 text-sm"
      } bg-neutral-900 border border-neutral-800 rounded-lg`}
    >
      <audio
        ref={audioRef}
        preload="none"
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onError={() => setError(true)}
        onCanPlay={handleCanPlay}
      />

      <div
        className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
          error
            ? "bg-red-500"
            : buffering && monitorEnabled
              ? "bg-yellow-400 animate-pulse"
              : monitorEnabled
                ? "bg-green-500 animate-pulse"
                : "bg-neutral-500"
        }`}
      />

      <span
        className={`${compact ? "text-xs w-28" : "text-sm w-32"} text-neutral-300 font-medium`}
      >
        {error
          ? "Stream Error"
          : buffering && monitorEnabled
            ? "Buffering..."
            : monitorEnabled
              ? "Listening Live"
              : "Monitoring Disabled"}
      </span>

      {/* Monitor Toggle */}
      <button
        className={`px-2 py-1 rounded-md border text-xs ${
          monitorEnabled
            ? "border-green-500 text-green-200 bg-green-500/10"
            : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
        }`}
        onClick={onToggleMonitor}
      >
        {monitorEnabled ? "Disable Monitor" : "Enable Monitor"}
      </button>

      {/* Volume */}
      <div className="flex items-center gap-2">
        <span className="text-neutral-400 text-xs">Vol</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange?.(Number(e.target.value))}
          className="w-24 accent-green-500"
        />
        <span className="text-neutral-300 text-xs w-10 text-right">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}
