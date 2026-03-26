import { useState, useCallback, useMemo } from 'react';

/**
 * @typedef {Object} TimingMarker
 * @property {number|null} value - Raw millisecond value (null if not available)
 * @property {string} display - Formatted display string (defaults to "00:00" if unavailable)
 * @property {boolean} isValid - Whether the marker has a valid value for region creation
 */

/**
 * @typedef {Object} TrackTimingData
 * @property {TimingMarker} cutIn - Cut In marker data
 * @property {TimingMarker} mixPoint - Mix Point marker data
 * @property {TimingMarker} cutOut - Cut Out marker data
 * @property {number|null} duration - Track duration in milliseconds
 * @property {boolean} hasValidMarkers - Whether at least one marker is valid
 */

/**
 * Default display value for missing/invalid timestamps
 */
const DEFAULT_TIME_DISPLAY = '00:00';

/**
 * Validates if a value is a valid numeric timestamp (non-null, finite number, >= 0)
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid timestamp
 */
const isValidTimestamp = (value) => {
    return (
        value !== null &&
        value !== undefined &&
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0
    );
};

/**
 * Format milliseconds to MM:SS.mmm or MM:SS display
 * @param {number|null} ms - Milliseconds value
 * @param {boolean} includeMs - Whether to include milliseconds in display
 * @returns {string} Formatted time string
 */
const formatMilliseconds = (ms, includeMs = false) => {
    if (!isValidTimestamp(ms)) return DEFAULT_TIME_DISPLAY;
    
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (includeMs) {
        const milliseconds = Math.floor((totalSeconds % 1) * 1000);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    }
    
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Extract Cut In value from track data with fallback priority
 * Priority: cutIn > audio_cut_in > playlist_element_cut_in > audio_aut_cut_in
 * @param {Object} track - Track data object
 * @returns {number|null} Cut In value in milliseconds or null
 */
const extractCutIn = (track) => {
    if (!track || typeof track !== 'object') return null;
    
    const candidates = [
        track.cutIn,
        track.cut_in,
        track.audio_cut_in,
        track.playlist_element_cut_in,
        track.audio_aut_cut_in,
        track.audio_web_cut_in
    ];
    
    for (const value of candidates) {
        if (isValidTimestamp(value)) {
            return value;
        }
    }
    
    return null;
};

/**
 * Extract Mix Point value from track data with fallback priority
 * Priority: mix_point_pr_ev > mixPoint > audio_aut_mixpoint > bcn_mixpoint
 * @param {Object} track - Track data object
 * @returns {number|null} Mix Point value in milliseconds or null
 */
const extractMixPoint = (track) => {
    if (!track || typeof track !== 'object') return null;
    
    const candidates = [
        track.mix_point_pr_ev,
        track.mixPoint,
        track.mix_point,
        track.audio_aut_mixpoint,
        track.bcn_mixpoint,
        track.audio_web_mixpoint
    ];
    
    for (const value of candidates) {
        if (isValidTimestamp(value)) {
            return value;
        }
    }
    
    return null;
};

/**
 * Extract Cut Out value from track data with fallback priority
 * Priority: cutOut > cut_out > audio_aut_cut_out > audio_web_cut_out
 * @param {Object} track - Track data object
 * @returns {number|null} Cut Out value in milliseconds or null
 */
const extractCutOut = (track) => {
    if (!track || typeof track !== 'object') return null;
    
    const candidates = [
        track.cutOut,
        track.cut_out,
        track.audio_aut_cut_out,
        track.audio_web_cut_out
    ];
    
    for (const value of candidates) {
        if (isValidTimestamp(value)) {
            return value;
        }
    }
    
    return null;
};

/**
 * Extract duration from track data
 * @param {Object} track - Track data object
 * @returns {number|null} Duration in milliseconds or null
 */
const extractDuration = (track) => {
    if (!track || typeof track !== 'object') return null;
    
    // Check for duration fields (some may be in seconds)
    if (isValidTimestamp(track.duration)) {
        // If duration is small (< 1000), assume it's in seconds
        return track.duration < 1000 ? track.duration * 1000 : track.duration;
    }
    
    if (isValidTimestamp(track.playlist_element_length)) {
        // playlist_element_length is typically in seconds as string
        const lengthSec = parseFloat(track.playlist_element_length);
        if (Number.isFinite(lengthSec)) {
            return lengthSec * 1000;
        }
    }
    
    // Fallback: derive from cut_out if available
    const cutOut = extractCutOut(track);
    if (cutOut) return cutOut;
    
    return null;
};

/**
 * Create a TimingMarker object from a raw value
 * @param {number|null} value - Raw millisecond value
 * @param {boolean} includeMs - Whether to include milliseconds in display
 * @returns {TimingMarker}
 */
const createMarker = (value, includeMs = false) => {
    const isValid = isValidTimestamp(value);
    return {
        value: isValid ? value : null,
        display: isValid ? formatMilliseconds(value, includeMs) : DEFAULT_TIME_DISPLAY,
        isValid
    };
};

/**
 * Parse a single track's timing data with strict validation
 * @param {Object} track - Track data from scheduler JSON
 * @returns {TrackTimingData}
 */
export const parseTrackTiming = (track) => {
    const cutInValue = extractCutIn(track);
    const mixPointValue = extractMixPoint(track);
    const cutOutValue = extractCutOut(track);
    const durationValue = extractDuration(track);
    
    const cutIn = createMarker(cutInValue);
    const mixPoint = createMarker(mixPointValue);
    const cutOut = createMarker(cutOutValue);
    
    return {
        cutIn,
        mixPoint,
        cutOut,
        duration: durationValue,
        hasValidMarkers: cutIn.isValid || mixPoint.isValid || cutOut.isValid
    };
};

/**
 * Parse timing data for multiple tracks from scheduler JSON
 * Optimized for performance with large datasets using memoization-friendly patterns
 * @param {Array} tracks - Array of track data from scheduler JSON
 * @returns {Map<string, TrackTimingData>} Map of audio_id/filename to timing data
 */
export const parseSchedulerTracks = (tracks) => {
    if (!Array.isArray(tracks)) return new Map();
    
    const timingMap = new Map();
    
    for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (!track || typeof track !== 'object') continue;
        
        // Use multiple identifiers for lookup flexibility
        const identifiers = [
            track.audio_id,
            track.title_id,
            track.fileName,
            track.filename_as,
            track.element_id
        ].filter(Boolean);
        
        const timing = parseTrackTiming(track);
        
        // Store by all available identifiers for fast lookup
        for (const id of identifiers) {
            const key = String(id);
            if (!timingMap.has(key)) {
                timingMap.set(key, {
                    ...timing,
                    trackInfo: {
                        artist: track.artist || track.audio_artist || track.playlist_element_artist,
                        title: track.title,
                        filename: track.fileName || track.filename_as,
                        audioId: track.audio_id
                    }
                });
            }
        }
    }
    
    return timingMap;
};

/**
 * Parse nested scheduler JSON structure (supports both array and object formats)
 * @param {Object|Array} jsonData - Raw scheduler JSON data
 * @returns {Array} Flattened array of track details
 */
export const flattenSchedulerJson = (jsonData) => {
    if (!jsonData) return [];
    
    // Direct array of tracks
    if (Array.isArray(jsonData)) {
        // Check if it's array of version objects with details
        if (jsonData[0]?.details) {
            return jsonData.flatMap(item => item.details || []);
        }
        return jsonData;
    }
    
    // Object with playlist.details structure
    if (jsonData.playlist?.details) {
        return jsonData.playlist.details;
    }
    
    // Object with details array directly
    if (jsonData.details) {
        return jsonData.details;
    }
    
    return [];
};

/**
 * Custom React hook for fetching and parsing track timing markers from scheduler JSON
 * 
 * @param {Object} options - Hook options
 * @param {Object} options.initialData - Initial scheduler JSON data (optional)
 * @returns {Object} Hook return value with timing data and utilities
 */
export function useTrackTimingMarkers(options = {}) {
    const { 
        initialData = null 
    } = options;
    
    const [schedulerData, setSchedulerData] = useState(initialData);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    /**
     * Memoized parsed timing data map for performance
     */
    const timingDataMap = useMemo(() => {
        if (!schedulerData) return new Map();
        
        const tracks = flattenSchedulerJson(schedulerData);
        return parseSchedulerTracks(tracks);
    }, [schedulerData]);
    
    /**
     * Get timing data for a specific track by identifier
     * @param {string|number} identifier - Track identifier (audio_id, filename, etc.)
     * @returns {TrackTimingData|null}
     */
    const getTrackTiming = useCallback((identifier) => {
        if (!identifier) return null;
        return timingDataMap.get(String(identifier)) || null;
    }, [timingDataMap]);
    
    /**
     * Get timing data formatted for AudioPreview component props
     * Returns null values for invalid markers (enabling conditional region creation)
     * @param {string|number} identifier - Track identifier
     * @returns {Object} Props object for AudioPreview metadata
     */
    const getAudioPreviewProps = useCallback((identifier) => {
        const timing = getTrackTiming(identifier);
        
        if (!timing) {
            return {
                cut_in: null,
                mix_point: null,
                cut_out: null,
                duration: null,
                displayValues: {
                    cutIn: DEFAULT_TIME_DISPLAY,
                    mixPoint: DEFAULT_TIME_DISPLAY,
                    cutOut: DEFAULT_TIME_DISPLAY
                }
            };
        }
        
        return {
            // Only pass valid values (null for invalid - prevents marker creation)
            cut_in: timing.cutIn.isValid ? timing.cutIn.value : null,
            mix_point: timing.mixPoint.isValid ? timing.mixPoint.value : null,
            cut_out: timing.cutOut.isValid ? timing.cutOut.value : null,
            duration: timing.duration,
            // Display values (always have a formatted string)
            displayValues: {
                cutIn: timing.cutIn.display,
                mixPoint: timing.mixPoint.display,
                cutOut: timing.cutOut.display
            },
            // Metadata for UI
            hasValidMarkers: timing.hasValidMarkers,
            trackInfo: timing.trackInfo
        };
    }, [getTrackTiming]);
    
    /**
     * Load scheduler data from JSON object or URL
     * @param {Object|string} source - JSON data or URL to fetch
     */
    const loadSchedulerData = useCallback(async (source) => {
        setIsLoading(true);
        setError(null);
        
        try {
            let data = source;
            
            // If source is URL string, fetch it
            if (typeof source === 'string' && source.startsWith('http')) {
                const response = await fetch(source);
                if (!response.ok) {
                    throw new Error(`Failed to fetch scheduler data: ${response.statusText}`);
                }
                data = await response.json();
            }
            
            setSchedulerData(data);
        } catch (err) {
            console.error('[useTrackTimingMarkers] Error loading scheduler data:', err);
            setError(err.message || 'Failed to load scheduler data');
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    /**
     * Clear all loaded scheduler data
     */
    const clearData = useCallback(() => {
        setSchedulerData(null);
        setError(null);
    }, []);
    
    return {
        // State
        isLoading,
        error,
        hasData: schedulerData !== null,
        trackCount: timingDataMap.size,
        
        // Data access methods
        getTrackTiming,
        getAudioPreviewProps,
        timingDataMap,
        
        // Data management
        loadSchedulerData,
        clearData,
        setSchedulerData
    };
}

/**
 * Utility: Validate track timing data before marker creation
 * Used in AudioPreview to conditionally render markers
 * @param {Object} metadata - Metadata object with timing values
 * @returns {Object} Validated markers config
 */
export const validateMarkersForCreation = (metadata) => {
    if (!metadata) {
        return {
            shouldCreateCutIn: false,
            shouldCreateMixPoint: false,
            shouldCreateCutOut: false,
            cutInMs: null,
            mixPointMs: null,
            cutOutMs: null
        };
    }
    
    const cutInMs = metadata.cut_in ?? metadata.cutIn;
    const mixPointMs = metadata.mix_point ?? metadata.mixPoint ?? metadata.mix_point_pr_ev;
    const cutOutMs = metadata.cut_out ?? metadata.cutOut;
    
    return {
        shouldCreateCutIn: isValidTimestamp(cutInMs),
        shouldCreateMixPoint: isValidTimestamp(mixPointMs),
        shouldCreateCutOut: isValidTimestamp(cutOutMs),
        cutInMs: isValidTimestamp(cutInMs) ? cutInMs : null,
        mixPointMs: isValidTimestamp(mixPointMs) ? mixPointMs : null,
        cutOutMs: isValidTimestamp(cutOutMs) ? cutOutMs : null
    };
};

export default useTrackTimingMarkers;
