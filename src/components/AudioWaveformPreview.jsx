import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';

/**
 * AudioWaveformPreview Component
 * 
 * A production-ready React component for audio waveform visualization using wavesurfer.js v7+
 * Displays timing cues (cut_in, cut_out, mix_point) as colored regions on the waveform
 * 
 * @param {Object} props
 * @param {string} props.audioUrl - URL of the audio file to visualize
 * @param {Object} props.metadata - Audio metadata containing timing information
 * @param {number} props.metadata.cut_in - Start time in milliseconds (where audio should begin)
 * @param {number} props.metadata.cut_out - End time in milliseconds (where audio should end)
 * @param {number} props.metadata.mix_point - Mix point in milliseconds (crossfade point)
 * @param {number} props.metadata.duration - Total duration in seconds (optional)
 * @param {number} props.height - Waveform height in pixels (default: 128)
 * @param {boolean} props.normalize - Whether to normalize waveform (default: true)
 * @param {Function} props.onReady - Callback when waveform is ready
 * @param {Function} props.onError - Callback when error occurs
 * @param {Function} props.onRegionClick - Callback when region is clicked
 */
export default function AudioWaveformPreview({
  audioUrl,
  metadata = {},
  height = 128,
  normalize = true,
  onReady,
  onError,
  onRegionClick
}) {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionsPluginRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  /**
   * Format milliseconds to MM:SS.mmm
   */
  const formatTime = useCallback((ms) => {
    if (!ms || isNaN(ms)) return '00:00.000';
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }, []);

  /**
   * Format seconds to MM:SS
   */
  const formatSeconds = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  /**
   * Initialize WaveSurfer and Regions plugin
   */
  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return;

    console.log('[AudioWaveform] Initializing WaveSurfer...');
    setIsLoading(true);
    setError(null);

    // Create AbortController for fetch cancellation
    const abortController = new AbortController();
    let wavesurfer = null;
    let isCleanedUp = false;

    const initializeWavesurfer = async () => {
      try {
        // Create Regions plugin instance
        const regions = RegionsPlugin.create();
        regionsPluginRef.current = regions;

        // Initialize WaveSurfer
        wavesurfer = WaveSurfer.create({
          container: waveformRef.current,
          height: height,
          normalize: normalize,
          waveColor: '#4a5568',
          progressColor: '#667eea',
          cursorColor: '#667eea',
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          responsive: true,
          backend: 'WebAudio',
          plugins: [regions],
          // Pass AbortSignal to fetch requests
          fetchParams: {
            signal: abortController.signal
          }
        });

        // Check if already cleaned up
        if (isCleanedUp) {
          wavesurfer.destroy();
          return;
        }

        wavesurferRef.current = wavesurfer;

        // Event: Loading
        wavesurfer.on('loading', (percent) => {
          console.log(`[AudioWaveform] Loading: ${percent}%`);
        });

        // Event: Ready
        wavesurfer.on('ready', () => {
          if (isCleanedUp) return;
          
          console.log('[AudioWaveform] Ready');
          const audioDuration = wavesurfer.getDuration();
          setDuration(audioDuration);
          setIsLoading(false);
          
          // Create regions after waveform is ready
          createTimingRegions(wavesurfer, regions, metadata, audioDuration);
          
          if (onReady) {
            onReady({ 
              duration: audioDuration, 
              wavesurfer, 
              regions 
            });
          }
        });

        // Event: Play/Pause
        wavesurfer.on('play', () => {
          if (!isCleanedUp) setIsPlaying(true);
        });
        wavesurfer.on('pause', () => {
          if (!isCleanedUp) setIsPlaying(false);
        });

        // Event: Time update
        wavesurfer.on('timeupdate', (time) => {
          if (!isCleanedUp) setCurrentTime(time);
        });

        // Event: Error
        wavesurfer.on('error', (err) => {
          // Ignore AbortError - it's expected during cleanup
          if (err.name === 'AbortError' || abortController.signal.aborted) {
            console.log('[AudioWaveform] Load aborted (cleanup)');
            return;
          }
          
          if (isCleanedUp) return;
          
          console.error('[AudioWaveform] Error:', err);
          setError(err.message || 'Failed to load audio');
          setIsLoading(false);
          if (onError) {
            onError(err);
          }
        });

        // Event: Region click
        regions.on('region-clicked', (region, e) => {
          if (isCleanedUp) return;
          
          console.log('[AudioWaveform] Region clicked:', region.id);
          if (onRegionClick) {
            onRegionClick(region, e);
          }
        });

        // Load audio with abort signal
        await wavesurfer.load(audioUrl);

      } catch (err) {
        // Ignore AbortError - it's expected during cleanup
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          console.log('[AudioWaveform] Initialization aborted (cleanup)');
          return;
        }
        
        if (isCleanedUp) return;
        
        console.error('[AudioWaveform] Initialization error:', err);
        setError(err.message || 'Failed to initialize waveform');
        setIsLoading(false);
        if (onError) {
          onError(err);
        }
      }
    };

    // Start initialization
    initializeWavesurfer();

    // Cleanup function
    return () => {
      console.log('[AudioWaveform] Cleaning up...');
      isCleanedUp = true;
      
      // Abort any ongoing fetch requests
      abortController.abort();
      
      // Destroy wavesurfer instance
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
          wavesurferRef.current = null;
        } catch (err) {
          console.error('[AudioWaveform] Cleanup error:', err);
        }
      }
      regionsPluginRef.current = null;
    };
  }, [audioUrl, height, normalize, onReady, onError, onRegionClick]);

  /**
   * Create timing regions based on metadata
   */
  const createTimingRegions = useCallback((wavesurfer, regionsPlugin, metadata, audioDuration) => {
    if (!regionsPlugin || !metadata) return;

    console.log('[AudioWaveform] Creating timing regions:', metadata);

    try {
      // Clear existing regions
      regionsPlugin.clearRegions();

      const {
        cut_in = 0,
        cutIn = 0,
        cut_out,
        cutOut,
        mix_point,
        mixPoint,
        mix_point_pr_ev,
        duration: metaDuration
      } = metadata;

      // Normalize values (support both naming conventions)
      const cutInMs = cut_in || cutIn || 0;
      const cutOutMs = cut_out || cutOut || metaDuration || (audioDuration * 1000);
      const mixPointMs = mix_point || mixPoint || mix_point_pr_ev;

      const cutInSec = cutInMs / 1000;
      const cutOutSec = cutOutMs / 1000;
      const mixPointSec = mixPointMs ? mixPointMs / 1000 : null;

      // Validate values
      if (cutInSec < 0 || cutInSec > audioDuration) {
        console.warn('[AudioWaveform] Invalid cut_in value:', cutInSec);
        return;
      }
      if (cutOutSec < cutInSec || cutOutSec > audioDuration) {
        console.warn('[AudioWaveform] Invalid cut_out value:', cutOutSec);
        return;
      }

      // 1. Create PLAY REGION (cut_in to cut_out) - The actual playable region
      regionsPlugin.addRegion({
        id: 'play-region',
        start: cutInSec,
        end: cutOutSec,
        color: 'rgba(102, 126, 234, 0.2)', // Blue - playable region
        drag: false,
        resize: false,
        content: '▶ Play Region'
      });

      // 2. Create CUT-IN MARKER (fade-in point)
      if (cutInSec > 0) {
        regionsPlugin.addRegion({
          id: 'cut-in-marker',
          start: cutInSec,
          end: cutInSec + 0.1, // Small width for visibility
          color: 'rgba(16, 185, 129, 0.4)', // Green - start point
          drag: false,
          resize: false,
          content: '🎬 Cut In'
        });
      }

      // 3. Create CUT-OUT MARKER (fade-out point)
      if (cutOutSec < audioDuration) {
        regionsPlugin.addRegion({
          id: 'cut-out-marker',
          start: cutOutSec - 0.1,
          end: cutOutSec,
          color: 'rgba(239, 68, 68, 0.4)', // Red - end point
          drag: false,
          resize: false,
          content: '🎬 Cut Out'
        });
      }

      // 4. Create MIX POINT MARKER (crossfade point) - if exists
      if (mixPointSec && mixPointSec > cutInSec && mixPointSec < cutOutSec) {
        regionsPlugin.addRegion({
          id: 'mix-point-marker',
          start: mixPointSec - 0.1,
          end: mixPointSec + 0.1,
          color: 'rgba(251, 191, 36, 0.5)', // Yellow/Amber - mix point
          drag: false,
          resize: false,
          content: '🎛️ Mix Point'
        });
      }

      // 5. Create PRE-CUT region (before cut_in) - dimmed/excluded region
      if (cutInSec > 0) {
        regionsPlugin.addRegion({
          id: 'pre-cut-region',
          start: 0,
          end: cutInSec,
          color: 'rgba(156, 163, 175, 0.1)', // Gray - excluded region
          drag: false,
          resize: false
        });
      }

      // 6. Create POST-CUT region (after cut_out) - dimmed/excluded region
      if (cutOutSec < audioDuration) {
        regionsPlugin.addRegion({
          id: 'post-cut-region',
          start: cutOutSec,
          end: audioDuration,
          color: 'rgba(156, 163, 175, 0.1)', // Gray - excluded region
          drag: false,
          resize: false
        });
      }

      console.log('[AudioWaveform] Regions created successfully');

    } catch (err) {
      console.error('[AudioWaveform] Error creating regions:', err);
    }
  }, []);

  /**
   * Play/Pause toggle
   */
  const handlePlayPause = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  }, []);

  /**
   * Skip to cut-in position
   */
  const handleSkipToCutIn = useCallback(() => {
    if (!wavesurferRef.current || !metadata) return;
    const cutInMs = metadata.cut_in || metadata.cutIn || 0;
    const cutInSec = cutInMs / 1000;
    wavesurferRef.current.seekTo(cutInSec / duration);
  }, [metadata, duration]);

  /**
   * Skip to mix point position
   */
  const handleSkipToMixPoint = useCallback(() => {
    if (!wavesurferRef.current || !metadata) return;
    const mixPointMs = metadata.mix_point || metadata.mixPoint || metadata.mix_point_pr_ev;
    if (!mixPointMs) return;
    const mixPointSec = mixPointMs / 1000;
    wavesurferRef.current.seekTo(mixPointSec / duration);
  }, [metadata, duration]);

  /**
   * Skip to cut-out position
   */
  const handleSkipToCutOut = useCallback(() => {
    if (!wavesurferRef.current || !metadata) return;
    const cutOutMs = metadata.cut_out || metadata.cutOut || (duration * 1000);
    const cutOutSec = cutOutMs / 1000;
    wavesurferRef.current.seekTo(cutOutSec / duration);
  }, [metadata, duration]);

  // Defensive check: no audio URL
  if (!audioUrl) {
    return (
      <div className="flex items-center justify-center h-32 bg-neutral-900 rounded-lg border border-neutral-800">
        <p className="text-neutral-500 text-sm">No audio URL provided</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="bg-neutral-800 px-4 py-3 border-b border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-neutral-200 tracking-wide">
              🎵 Audio Waveform Preview
            </h3>
            {isLoading && (
              <span className="text-xs text-blue-400 animate-pulse">
                Loading...
              </span>
            )}
          </div>
          
          {/* Time Display */}
          <div className="text-xs font-mono text-neutral-400">
            {formatSeconds(currentTime)} / {formatSeconds(duration)}
          </div>
        </div>
      </div>

      {/* Waveform Container */}
      <div className="relative bg-neutral-950 p-4">
        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 z-10">
            <div className="text-center">
              <div className="text-4xl mb-2">❌</div>
              <p className="text-red-400 text-sm font-medium">Error Loading Audio</p>
              <p className="text-neutral-500 text-xs mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 z-10">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-2">⏳</div>
              <p className="text-blue-400 text-sm font-medium">Loading Waveform...</p>
            </div>
          </div>
        )}

        {/* Waveform */}
        <div ref={waveformRef} className="w-full" />
      </div>

      {/* Controls */}
      <div className="bg-neutral-800 px-4 py-3 border-t border-neutral-700">
        <div className="flex items-center justify-between">
          {/* Playback Control */}
          <button
            onClick={handlePlayPause}
            disabled={isLoading || !!error}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
              isLoading || error
                ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>

          {/* Timing Cue Buttons */}
          <div className="flex items-center gap-2">
            {/* Cut In Button */}
            {(metadata?.cut_in || metadata?.cutIn) && (
              <button
                onClick={handleSkipToCutIn}
                disabled={isLoading || !!error}
                className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Jump to Cut In (${formatTime(metadata.cut_in || metadata.cutIn)})`}
              >
                🎬 Cut In
              </button>
            )}

            {/* Mix Point Button */}
            {(metadata?.mix_point || metadata?.mixPoint || metadata?.mix_point_pr_ev) && (
              <button
                onClick={handleSkipToMixPoint}
                disabled={isLoading || !!error}
                className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Jump to Mix Point (${formatTime(
                  metadata.mix_point || metadata.mixPoint || metadata.mix_point_pr_ev
                )})`}
              >
                🎛️ Mix Point
              </button>
            )}

            {/* Cut Out Button */}
            {(metadata?.cut_out || metadata?.cutOut) && (
              <button
                onClick={handleSkipToCutOut}
                disabled={isLoading || !!error}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Jump to Cut Out (${formatTime(metadata.cut_out || metadata.cutOut)})`}
              >
                🎬 Cut Out
              </button>
            )}
          </div>
        </div>

        {/* Timing Information */}
        {metadata && !isLoading && !error && (
          <div className="mt-3 pt-3 border-t border-neutral-700 grid grid-cols-3 gap-3 text-xs">
            {/* Cut In Info */}
            {(metadata.cut_in || metadata.cutIn !== undefined) && (
              <div className="flex items-center gap-2">
                <span className="text-green-400 font-medium">Cut In:</span>
                <span className="font-mono text-neutral-300">
                  {formatTime(metadata.cut_in || metadata.cutIn)}
                </span>
              </div>
            )}

            {/* Mix Point Info */}
            {(metadata.mix_point || metadata.mixPoint || metadata.mix_point_pr_ev) && (
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-medium">Mix Point:</span>
                <span className="font-mono text-neutral-300">
                  {formatTime(metadata.mix_point || metadata.mixPoint || metadata.mix_point_pr_ev)}
                </span>
              </div>
            )}

            {/* Cut Out Info */}
            {(metadata.cut_out || metadata.cutOut) && (
              <div className="flex items-center gap-2">
                <span className="text-red-400 font-medium">Cut Out:</span>
                <span className="font-mono text-neutral-300">
                  {formatTime(metadata.cut_out || metadata.cutOut)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-neutral-850 px-4 py-2 border-t border-neutral-700">
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-600/30 border border-blue-600 rounded"></div>
            <span className="text-neutral-400">Play Region</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-600/40 border border-green-600 rounded"></div>
            <span className="text-neutral-400">Cut In</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-amber-600/50 border border-amber-600 rounded"></div>
            <span className="text-neutral-400">Mix Point</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-600/40 border border-red-600 rounded"></div>
            <span className="text-neutral-400">Cut Out</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-neutral-600/20 border border-neutral-600 rounded"></div>
            <span className="text-neutral-400">Excluded</span>
          </div>
        </div>
      </div>
    </div>
  );
}
