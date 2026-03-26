import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getSocket } from "../api/socket";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import {
  validateMarkersForCreation,
  parseTrackTiming,
} from "../hooks/useTrackTimingMarkers";
import { useTrackMetadata } from "../hooks/useTrackMetadata";

/**
 * AudioPreviewSocket Component
 * Displays audio player with health check validation via Socket.IO
 * Uses WaveSurfer.js for waveform visualization that's visible immediately on mount
 * Unified controls with single Play/Pause button integrated with waveform
 *
 * Sidecar Metadata Loading:
 * - Fetches corresponding JSON metadata from song_data/metadata/
 * - Creates color-coded timing markers (cutIn, cutOut, mix_point_pr_ev)
 * - Handles fetch cancellation on song switch to avoid race conditions
 * - Displays human-readable "Title - Artist" format instead of audio_id
 */
export default function AudioPreview({ filename, onClose }) {
  const [healthStatus, setHealthStatus] = useState(null);
  const [sidecarMetadata, setSidecarMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [waveformLoading, setWaveformLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // WaveSurfer refs
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionsRef = useRef(null);

  const socket = getSocket();

  // Use the custom hook for human-readable display name
  const {
    displayName,
    metadata: trackMetadata,
    isLoading: metadataLoading,
  } = useTrackMetadata(filename);

  /**
   * Fetch sidecar metadata JSON when filename changes
   * Uses AbortController to cancel requests on quick song switches
   */
  useEffect(() => {
    if (!filename) return;

    const abortController = new AbortController();

    const fetchSidecarMetadata = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(
          `${baseUrl}/api/preview/metadata/${encodeURIComponent(filename)}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          // Fail silently on 404 or other errors
          console.log(
            "[AudioPreviewSocket] No sidecar metadata found for:",
            filename,
          );
          setSidecarMetadata(null);
          return;
        }

        const data = await response.json();

        if (data.success && data.metadata) {
          console.log(
            "[AudioPreviewSocket] Loaded sidecar metadata:",
            data.metadata,
          );
          setSidecarMetadata(data.metadata);
        } else {
          setSidecarMetadata(null);
        }
      } catch (err) {
        if (err.name === "AbortError") {
          console.log(
            "[AudioPreviewSocket] Metadata fetch aborted (song changed)",
          );
          return;
        }
        // Fail silently - don't affect audio playback
        console.warn(
          "[AudioPreviewSocket] Sidecar metadata fetch failed:",
          err.message,
        );
        setSidecarMetadata(null);
      }
    };

    fetchSidecarMetadata();

    return () => {
      abortController.abort();
    };
  }, [filename]);

  /**
   * Combine health status metadata with sidecar metadata
   * Sidecar metadata takes priority for timing fields
   */
  const combinedMetadata = useMemo(() => {
    const healthMeta = healthStatus?.metadata || {};
    const sidecar = sidecarMetadata || {};

    // Sidecar values override health metadata for timing fields
    return {
      ...healthMeta,
      cutIn: sidecar.cutIn ?? healthMeta.cutIn ?? null,
      cutOut: sidecar.cutOut ?? healthMeta.cutOut ?? null,
      mix_point_pr_ev:
        sidecar.mix_point_pr_ev ?? healthMeta.mix_point_pr_ev ?? null,
      intro: sidecar.intro ?? healthMeta.intro ?? null,
      // Keep other sidecar fields
      artist: sidecar.artist || healthMeta.artist,
      title: sidecar.title || healthMeta.title,
      category: sidecar.category || healthMeta.category,
    };
  }, [healthStatus?.metadata, sidecarMetadata]);

  /**
   * Resolve file format for UI display
   * Priority: sidecar metadata format/file_type -> filename extension
   */
  const displayFormat = useMemo(() => {
    const sidecarFormat =
      trackMetadata?.format ||
      trackMetadata?.file_type ||
      trackMetadata?.fileType;
    if (sidecarFormat && typeof sidecarFormat === "string") {
      return sidecarFormat.trim().toUpperCase();
    }

    if (filename) {
      const base = filename.split("/").pop() || "";
      const ext = base.includes(".") ? base.split(".").pop() : "";
      return ext ? ext.toUpperCase() : "UNKNOWN";
    }

    return "UNKNOWN";
  }, [trackMetadata, filename]);

  /**
   * Memoized validated timing data with strict null checking
   * Uses parseTrackTiming for consistent validation across the component
   * Returns display values that default to "00:00" when markers are missing/invalid
   */
  const validatedTiming = useMemo(() => {
    if (!combinedMetadata || Object.keys(combinedMetadata).length === 0) {
      return {
        cutIn: { value: null, display: "00:00", isValid: false },
        mixPoint: { value: null, display: "00:00", isValid: false },
        cutOut: { value: null, display: "00:00", isValid: false },
        hasValidMarkers: false,
      };
    }
    return parseTrackTiming(combinedMetadata);
  }, [combinedMetadata]);

  /**
   * Format seconds to MM:SS
   */
  const formatTime = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, []);

  /**
   * Initialize WaveSurfer instance when audioUrl is available
   */
  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;

    console.log(
      "[AudioPreviewSocket] Initializing WaveSurfer with URL:",
      audioUrl,
    );
    setWaveformLoading(true);

    const abortController = new AbortController();
    let isCleanedUp = false;

    const initWaveSurfer = async () => {
      try {
        // Create Regions plugin
        const regions = RegionsPlugin.create();
        regionsRef.current = regions;

        // Create WaveSurfer instance
        const ws = WaveSurfer.create({
          container: waveformRef.current,
          height: 120,
          normalize: true,
          waveColor: "#4a5568",
          progressColor: "#667eea",
          cursorColor: "#f59e0b",
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          responsive: true,
          backend: "WebAudio",
          plugins: [regions],
          fetchParams: {
            signal: abortController.signal,
          },
        });

        if (isCleanedUp) {
          ws.destroy();
          return;
        }

        wavesurferRef.current = ws;

        // Set initial volume
        ws.setVolume(volume);

        // Event: Ready
        ws.on("ready", () => {
          if (isCleanedUp) return;
          console.log("[AudioPreviewSocket] WaveSurfer ready");
          const audioDuration = ws.getDuration();
          setDuration(audioDuration);
          setWaveformLoading(false);

          // Create timing markers using combined metadata (sidecar + health)
          createTimingMarkers(regions, combinedMetadata, audioDuration);
        });

        // Event: Play/Pause
        ws.on("play", () => {
          if (!isCleanedUp) setIsPlaying(true);
        });
        ws.on("pause", () => {
          if (!isCleanedUp) setIsPlaying(false);
        });
        ws.on("finish", () => {
          if (!isCleanedUp) setIsPlaying(false);
        });

        // Event: Time update
        ws.on("timeupdate", (time) => {
          if (!isCleanedUp) setCurrentTime(time);
        });

        // Event: Error
        ws.on("error", (err) => {
          if (err.name === "AbortError" || abortController.signal.aborted) {
            console.log("[AudioPreviewSocket] Load aborted");
            return;
          }
          if (isCleanedUp) return;
          console.error("[AudioPreviewSocket] WaveSurfer error:", err);
          setWaveformLoading(false);
        });

        // Load audio
        await ws.load(audioUrl);
      } catch (err) {
        if (err.name === "AbortError" || abortController.signal.aborted) {
          return;
        }
        if (isCleanedUp) return;
        console.error("[AudioPreviewSocket] Init error:", err);
        setWaveformLoading(false);
      }
    };

    initWaveSurfer();

    // Cleanup function - prevents memory leaks and stops audio when modal closes
    return () => {
      console.log(
        "[AudioPreviewSocket] Cleaning up WaveSurfer (destroy + pause)...",
      );
      isCleanedUp = true;
      abortController.abort();

      // Pause first to be extra sure playback halts before destroy
      if (wavesurferRef.current) {
        try {
          if (
            wavesurferRef.current.isPlaying &&
            wavesurferRef.current.isPlaying()
          ) {
            wavesurferRef.current.pause();
          }
          wavesurferRef.current.destroy();
        } catch (err) {
          console.error("[AudioPreviewSocket] Cleanup error:", err);
        } finally {
          wavesurferRef.current = null;
        }
      }

      regionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, combinedMetadata]);

  /**
   * Create timing markers using Regions plugin with strict validation
   * Only creates markers when values are valid (non-null, finite numbers >= 0)
   * Uses the exact logic: regions.addRegion({ start: X, content: 'Marker', color: randomColor() })
   */
  const createTimingMarkers = useCallback(
    (regionsPlugin, metadata, audioDuration) => {
      if (!regionsPlugin || !audioDuration) return;

      console.log(
        "[AudioPreviewSocket] Creating timing markers with strict validation:",
        metadata,
      );

      try {
        regionsPlugin.clearRegions();

        // Use strict validation utility - only creates markers for valid values
        const {
          shouldCreateCutIn,
          shouldCreateMixPoint,
          shouldCreateCutOut,
          cutInMs,
          mixPointMs,
          cutOutMs,
        } = validateMarkersForCreation(metadata);

        // Convert to seconds for WaveSurfer (only if valid)
        const cutInSec = shouldCreateCutIn ? cutInMs / 1000 : null;
        const mixPointSec = shouldCreateMixPoint ? mixPointMs / 1000 : null;
        const cutOutSec = shouldCreateCutOut ? cutOutMs / 1000 : null;

        console.log("[AudioPreviewSocket] Validated markers:", {
          cutIn: { shouldCreate: shouldCreateCutIn, sec: cutInSec },
          mixPoint: { shouldCreate: shouldCreateMixPoint, sec: mixPointSec },
          cutOut: { shouldCreate: shouldCreateCutOut, sec: cutOutSec },
        });

        // 1. Cut-In Marker - STRICTLY skip if value is missing/null/invalid
        // No text label - only color-coded vertical line
        if (shouldCreateCutIn && cutInSec > 0 && cutInSec < audioDuration) {
          regionsPlugin.addRegion({
            start: cutInSec,
            content: "",
            color: "rgba(16, 185, 129, 0.7)", // Green - slightly more opaque for visibility
          });
        }

        // 2. Mix Point Marker - Keep label as it's a mixing reference point
        if (
          shouldCreateMixPoint &&
          mixPointSec > 0 &&
          mixPointSec < audioDuration
        ) {
          regionsPlugin.addRegion({
            start: mixPointSec,
            content: "",
            color: "rgba(251, 191, 36, 0.6)", // Amber
          });
        }

        // 3. Cut-Out Marker - STRICTLY skip if value is missing/null/invalid
        // No text label - only color-coded vertical line
        if (shouldCreateCutOut && cutOutSec > 0 && cutOutSec < audioDuration) {
          regionsPlugin.addRegion({
            start: cutOutSec,
            content: "",
            color: "rgba(239, 68, 68, 0.7)", // Red - slightly more opaque for visibility
          });
        }

        // 4. Play Region - only create if we have valid cut points
        if (shouldCreateCutIn || shouldCreateCutOut) {
          const regionStart = shouldCreateCutIn ? cutInSec : 0;
          const regionEnd = shouldCreateCutOut
            ? Math.min(cutOutSec, audioDuration)
            : audioDuration;

          regionsPlugin.addRegion({
            id: "play-region",
            start: regionStart,
            end: regionEnd,
            color: "rgba(102, 126, 234, 0.15)",
            drag: false,
            resize: false,
          });
        }

        console.log(
          "[AudioPreviewSocket] Markers created successfully (only for valid values)",
        );
      } catch (err) {
        console.error("[AudioPreviewSocket] Error creating markers:", err);
      }
    },
    [],
  );

  /**
   * Re-create markers when sidecar metadata loads after wavesurfer is already ready
   * This handles the race condition where metadata arrives after waveform initialization
   */
  useEffect(() => {
    if (
      !wavesurferRef.current ||
      !regionsRef.current ||
      !duration ||
      waveformLoading
    )
      return;

    // Only recreate if we have sidecar metadata
    if (sidecarMetadata) {
      console.log(
        "[AudioPreviewSocket] Updating markers with sidecar metadata",
      );
      createTimingMarkers(regionsRef.current, combinedMetadata, duration);
    }
  }, [
    sidecarMetadata,
    combinedMetadata,
    duration,
    waveformLoading,
    createTimingMarkers,
  ]);

  // Fetch health status on mount
  useEffect(() => {
    if (!filename) {
      setError("No filename provided");
      setIsLoading(false);
      return;
    }

    checkFileHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename]);

  const checkFileHealth = () => {
    setIsLoading(true);
    setError(null);

    socket.emit("preview:health", { filename }, (response) => {
      if (response.ok) {
        setHealthStatus(response);

        // If healthy, get audio URL
        if (response.isHealthy) {
          socket.emit("preview:get_audio_url", { filename }, (urlResponse) => {
            if (urlResponse.ok) {
              // Use full URL with backend port
              const baseUrl =
                import.meta.env.VITE_API_URL || "http://localhost:3000";
              setAudioUrl(`${baseUrl}${urlResponse.url}`);
            }
          });
        }
      } else {
        setError(response.error || "Health check failed");
      }
      setIsLoading(false);
    });
  };

  /**
   * Play/Pause toggle using WaveSurfer
   */
  const togglePlayback = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  }, []);

  /**
   * Send the current track to the audio editor via Socket.IO
   */
  const handleSendToEditor = useCallback(() => {
    if (!filename) return;
    socket.emit("editor:push_track", { filename }, (res) => {
      if (!res?.ok) {
        alert(res?.error || "Failed to send track to editor");
      } else {
        alert("Track sent to audio editor");
      }
    });
  }, [socket, filename]);

  /**
   * Handle volume change
   */
  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(newVolume);
    }
  }, []);

  /**
   * Skip to specific time position
   */
  const skipToTime = useCallback(
    (timeMs) => {
      if (!wavesurferRef.current || !duration) return;
      const timeSec = timeMs / 1000;
      wavesurferRef.current.seekTo(timeSec / duration);
    },
    [duration],
  );

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatBitrate = (bitrate) => {
    if (!bitrate) return "Unknown";
    const kbps = Math.floor(bitrate / 1000);
    return `${kbps} kbps`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="text-neutral-400 text-sm">
            Checking file health...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-neutral-900 rounded-xl border border-red-500 p-6">
        <div className="flex items-start space-x-3">
          <svg
            className="w-6 h-6 text-red-500 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h3 className="text-red-400 font-semibold">Connection Error</h3>
            <p className="text-neutral-400 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const isHealthy = healthStatus?.isHealthy;
  const metadata = healthStatus?.metadata;

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-2xl">
      {/* Header with Close Button */}
      <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          🎵 Audio Preview
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Warning Banner for Corrupted Files */}
      {!isHealthy && (
        <div className="bg-red-900/50 border-b border-red-700 p-4">
          <div className="flex items-start space-x-3">
            <svg
              className="w-6 h-6 text-red-400 shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-red-400 font-semibold text-sm">
                ⚠️ File Corrupted
              </h3>
              <p className="text-red-300 text-sm mt-1">
                {healthStatus?.error ||
                  "This audio file appears to be damaged or incomplete."}
              </p>
              <p className="text-red-400 text-xs mt-1 font-mono">
                Error Code: {healthStatus?.errorCode}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Player Section */}
      <div className="p-6">
        <div className="flex items-start space-x-4">
          {/* Album Art / Icon */}
          <div className="shrink-0">
            <div
              className={`w-24 h-24 rounded-xl flex items-center justify-center ${
                isHealthy
                  ? "bg-linear-to-br from-indigo-500 to-purple-600"
                  : "bg-neutral-800"
              }`}
            >
              <svg
                className={`w-12 h-12 ${isHealthy ? "text-white" : "text-neutral-600"}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
              </svg>
            </div>
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <h3
              className="text-white font-semibold text-lg truncate"
              title={displayName}
            >
              {metadataLoading ? (
                <span className="text-neutral-400 animate-pulse">
                  Loading...
                </span>
              ) : (
                displayName
              )}
            </h3>
            {/* Show audio_id as subtitle if we have a display name */}
            {trackMetadata && (
              <p className="text-neutral-500 text-xs font-mono mt-1">
                ID: {filename.replace(/\.[^.]+$/, "")}
              </p>
            )}

            {isHealthy && metadata && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-neutral-400">
                    Duration:{" "}
                    <span className="text-white font-mono">
                      {formatDuration(metadata.duration)}
                    </span>
                  </span>
                  <span className="text-neutral-400">
                    Format:{" "}
                    <span className="text-white font-semibold">
                      {displayFormat}
                    </span>
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-neutral-400">
                    Bitrate:{" "}
                    <span className="text-white font-mono">
                      {formatBitrate(metadata.bitrate)}
                    </span>
                  </span>
                  <span className="text-neutral-400">
                    Size:{" "}
                    <span className="text-white font-mono">
                      {formatFileSize(metadata.size)}
                    </span>
                  </span>
                </div>
                {metadata.codec && (
                  <div className="text-sm text-neutral-400">
                    Codec: <span className="text-white">{metadata.codec}</span>
                    {metadata.sampleRate && (
                      <span className="ml-3">
                        Sample Rate:{" "}
                        <span className="text-white font-mono">
                          {metadata.sampleRate} Hz
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isHealthy && metadata && (
              <div className="mt-2 text-sm text-neutral-400">
                Size:{" "}
                <span className="text-white font-mono">
                  {formatFileSize(metadata.size)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Audio Player Controls */}
        <div className="mt-6">
          {isHealthy && audioUrl ? (
            <>
              {/* Waveform Container - Visible immediately on mount */}
              <div className="bg-neutral-950 rounded-lg border border-neutral-700 overflow-hidden">
                {/* Waveform Header with Time Display */}
                <div className="bg-neutral-800 px-4 py-2 border-b border-neutral-700 flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-400">
                    Waveform
                  </span>
                  <span className="text-xs font-mono text-neutral-300">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Waveform Canvas */}
                <div className="relative p-4">
                  {/* Loading Overlay */}
                  {waveformLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 z-10">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                        <span className="text-neutral-400 text-sm">
                          Loading waveform...
                        </span>
                      </div>
                    </div>
                  )}

                  {/* WaveSurfer Container - Waveform renders here */}
                  <div ref={waveformRef} className="w-full" />
                </div>
              </div>

              {/* Unified Playback Controls */}
              <div className="mt-4 flex items-center justify-between">
                {/* Play/Pause Button - Single unified control */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlayback}
                    disabled={waveformLoading}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg ${
                      waveformLoading
                        ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-900/50"
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Play</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSendToEditor}
                    disabled={waveformLoading}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 shadow ${
                      waveformLoading
                        ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-900/50"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 11.586V4a1 1 0 011-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Send to Editor</span>
                  </button>

                  {/* Health Status Badge */}
                  <span className="text-sm text-green-400 flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    File is healthy
                  </span>
                </div>

                {/* Volume Control */}
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-neutral-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-xs text-neutral-400 font-mono w-10">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Timeline Cue Buttons - Only show buttons for valid markers */}
              <div className="mt-4 flex items-center gap-2">
                {/* Cut In Button - Only if valid */}
                {validatedTiming.cutIn.isValid && (
                  <button
                    onClick={() => skipToTime(validatedTiming.cutIn.value)}
                    disabled={waveformLoading}
                    className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    🎬 Cut In
                  </button>
                )}

                {/* Mix Point Button - Only if valid */}
                {validatedTiming.mixPoint.isValid && (
                  <button
                    onClick={() => skipToTime(validatedTiming.mixPoint.value)}
                    disabled={waveformLoading}
                    className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    🎛️ Mix Point
                  </button>
                )}

                {/* Cut Out Button - Only if valid */}
                {validatedTiming.cutOut.isValid && (
                  <button
                    onClick={() => skipToTime(validatedTiming.cutOut.value)}
                    disabled={waveformLoading}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    🎬 Cut Out
                  </button>
                )}
              </div>

              {/* Timing Information Display - Always shows, uses "00:00" for missing values */}
              <div className="mt-3 pt-3 border-t border-neutral-700 grid grid-cols-3 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium ${validatedTiming.cutIn.isValid ? "text-green-400" : "text-neutral-500"}`}
                  >
                    Cut In:
                  </span>
                  <span
                    className={`font-mono ${validatedTiming.cutIn.isValid ? "text-neutral-200" : "text-neutral-600"}`}
                  >
                    {validatedTiming.cutIn.display}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium ${validatedTiming.mixPoint.isValid ? "text-amber-400" : "text-neutral-500"}`}
                  >
                    Mix Point:
                  </span>
                  <span
                    className={`font-mono ${validatedTiming.mixPoint.isValid ? "text-neutral-200" : "text-neutral-600"}`}
                  >
                    {validatedTiming.mixPoint.display}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium ${validatedTiming.cutOut.isValid ? "text-red-400" : "text-neutral-500"}`}
                  >
                    Cut Out:
                  </span>
                  <span
                    className={`font-mono ${validatedTiming.cutOut.isValid ? "text-neutral-200" : "text-neutral-600"}`}
                  >
                    {validatedTiming.cutOut.display}
                  </span>
                </div>
              </div>

              {/* Marker Legend */}
              <div className="mt-4 pt-3 border-t border-neutral-800">
                <div className="flex items-center justify-center gap-4 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-600/30 border border-blue-600 rounded"></div>
                    <span className="text-neutral-400">Play Region</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-green-600/50 border border-green-600 rounded"></div>
                    <span className="text-neutral-400">Cut In</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-amber-500/60 border border-amber-500 rounded"></div>
                    <span className="text-neutral-400">Mix Point</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-600/50 border border-red-600 rounded"></div>
                    <span className="text-neutral-400">Cut Out</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-neutral-950 rounded-lg p-8 text-center border border-neutral-800">
              <svg
                className="w-16 h-16 text-neutral-700 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
              <p className="text-neutral-500 font-medium text-lg">
                Playback Disabled
              </p>
              <p className="text-neutral-600 text-sm mt-1">
                This file cannot be played due to corruption
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Health Status Footer */}
      <div
        className={`px-6 py-3 text-xs ${isHealthy ? "bg-green-900/30" : "bg-red-900/30"} border-t ${
          isHealthy ? "border-green-800" : "border-red-800"
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`font-medium ${isHealthy ? "text-green-400" : "text-red-400"}`}
          >
            {isHealthy ? "✓ Health Check Passed" : "✗ Health Check Failed"}
          </span>
          <button
            onClick={checkFileHealth}
            className="text-neutral-400 hover:text-white transition-colors text-xs font-medium"
          >
            🔄 Recheck
          </button>
        </div>
      </div>
    </div>
  );
}
