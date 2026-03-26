import { useEffect, useRef, useState } from "react";

export default function AudioPlayer({ playing }) {
  const audioRef = useRef(null);
  const [buffering, setBuffering] = useState(false);
  // Start muted to hide the "server burst" (the old jingle playing)
  const [isMuted, setIsMuted] = useState(true);

  // Cache Buster: Ensures browser requests a fresh stream on mount
  const [streamUrl] = useState(() => `/api/stream?nocache=${Date.now()}`);

  // 1. Kill Switch: Clean up immediately on refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
      }
    };
  }, []);

  // 2. Play/Pause Control
  useEffect(() => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.play().catch((e) => console.error("Play error:", e));
    } else {
      audioRef.current.pause();
    }
  }, [playing]);

  // 3. The "Jump to Live" Logic
  const handleCanPlay = (e) => {
    const audio = e.currentTarget;

    // Use a massive number to force the browser to jump to the very end (Live Edge)
    // This skips the "Jingle/History" buffer sent by the server.
    if (audio.seekable.length > 0) {
       // Browser hack: seeking to Infinity forces it to the absolute latest packet
       audio.currentTime = Number.MAX_SAFE_INTEGER; 
    }
    
    // Slight delay to allow the seek to finish before unmuting
    setTimeout(() => {
      setIsMuted(false);
    }, 200);
  };

  return (
    <div className="flex items-center justify-between rounded-lg bg-neutral-900 px-4 py-3 border border-neutral-800">
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="auto"
        muted={isMuted} // Mute initially so user doesn't hear the glitch
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={handleCanPlay} // Trigger the skip logic
      />

      <span
        className={`text-sm font-medium ${
          buffering
            ? "text-yellow-400"
            : playing
            ? "text-green-400"
            : "text-red-400"
        }`}
      >
        {buffering ? "Buffering…" : playing ? "LIVE" : "Stopped"}
      </span>
    </div>
  );
}