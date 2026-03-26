import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * @typedef {Object} TrackMetadata
 * @property {number|null} audio_id - The audio ID
 * @property {string} title - Track title
 * @property {string} artist - Track artist
 * @property {string} category - Track category
 * @property {string[]|null} genres - Track genres
 * @property {number} cutIn - Cut in point (ms)
 * @property {number} cutOut - Cut out point (ms)
 * @property {number|null} intro - Intro point (ms)
 * @property {number} mix_point_pr_ev - Mix point (ms)
 * @property {string|null} fileName - Original filename
 * @property {string} extractedAt - Extraction timestamp
 */

/**
 * @typedef {Object} UseTrackMetadataResult
 * @property {TrackMetadata|null} metadata - The fetched metadata
 * @property {boolean} isLoading - Loading state
 * @property {string|null} error - Error message if fetch failed
 * @property {string} displayName - Formatted "Title - Artist" or fallback to filename/audio_id
 * @property {function} refetch - Function to manually refetch metadata
 */

/**
 * Extracts audio_id from a filename
 * Handles formats like "12345678.m4a", "12345678.mp3", etc.
 * @param {string} filename - The filename to parse
 * @returns {string|null} The extracted audio_id or null
 */
const extractAudioId = (filename) => {
    if (!filename) return null;
    
    // Remove path if present
    const baseName = filename.split('/').pop();
    
    // Remove extension
    const withoutExt = baseName?.replace(/\.[^.]+$/, '');
    
    // Check if it's a numeric ID
    if (withoutExt && /^\d+$/.test(withoutExt)) {
        return withoutExt;
    }
    
    return withoutExt || null;
};

/**
 * Formats a display name from metadata or falls back to filename/audio_id
 * @param {TrackMetadata|null} metadata - The metadata object
 * @param {string} filename - The original filename
 * @returns {string} Formatted display name
 */
const formatDisplayName = (metadata, filename) => {
    // Priority 1: Use title + artist from metadata
    if (metadata?.title && metadata?.artist) {
        const title = String(metadata.title).trim();
        const artist = String(metadata.artist).trim();
        if (title && artist && title !== 'Unknown Title' && artist !== 'Unknown Artist') {
            return `${title} - ${artist}`;
        }
    }
    
    // Priority 2: Use just title if artist is generic
    if (metadata?.title && metadata.title !== 'Unknown Title') {
        return String(metadata.title).trim();
    }
    
    // Priority 3: Fall back to filename without extension
    if (filename) {
        const baseName = filename.split('/').pop();
        const withoutExt = baseName?.replace(/\.[^.]+$/, '');
        return withoutExt || filename;
    }
    
    return 'Unknown Track';
};

/**
 * Custom hook for fetching and managing track metadata by audio_id or filename
 * 
 * @param {string|number|null} filenameOrId - The filename (e.g., "12345678.m4a") or audio_id
 * @param {Object} options - Optional configuration
 * @param {boolean} options.enabled - Whether to fetch automatically (default: true)
 * @param {string} options.baseUrl - API base URL (default: from env or localhost:3000)
 * @returns {UseTrackMetadataResult}
 * 
 * @example
 * const { displayName, metadata, isLoading } = useTrackMetadata('12345678.m4a');
 * // displayName = "Track Title - Artist Name" or "12345678" if metadata unavailable
 */
export function useTrackMetadata(filenameOrId, options = {}) {
    const { 
        enabled = true,
        baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    } = options;

    const [metadata, setMetadata] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Normalize the input to a filename string
    const filename = useMemo(() => {
        if (!filenameOrId) return null;
        return String(filenameOrId);
    }, [filenameOrId]);

    // Extract audio_id for display fallback
    const audioId = useMemo(() => extractAudioId(filename), [filename]);

    /**
     * Fetch metadata from the server
     */
    const fetchMetadata = useCallback(async (signal) => {
        if (!filename) {
            setMetadata(null);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${baseUrl}/api/preview/metadata/${encodeURIComponent(filename)}`,
                { signal }
            );

            if (!response.ok) {
                // 404 is expected for files without metadata
                if (response.status === 404) {
                    console.log('[useTrackMetadata] No metadata found for:', filename);
                    setMetadata(null);
                    setError(null);
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
                return;
            }

            const data = await response.json();

            if (data.success && data.metadata) {
                console.log('[useTrackMetadata] Loaded metadata for:', filename, data.metadata);
                setMetadata(data.metadata);
                setError(null);
            } else {
                setMetadata(null);
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                // Request was cancelled, don't update state
                return;
            }
            console.warn('[useTrackMetadata] Fetch failed for:', filename, err.message);
            setMetadata(null);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [filename, baseUrl]);

    /**
     * Effect to fetch metadata when filename changes
     * Uses AbortController to cancel pending requests on unmount or filename change
     */
    useEffect(() => {
        if (!enabled || !filename) {
            setMetadata(null);
            setIsLoading(false);
            return;
        }

        const abortController = new AbortController();
        fetchMetadata(abortController.signal);

        return () => {
            abortController.abort();
        };
    }, [enabled, filename, fetchMetadata]);

    /**
     * Manual refetch function
     */
    const refetch = useCallback(() => {
        const abortController = new AbortController();
        fetchMetadata(abortController.signal);
    }, [fetchMetadata]);

    /**
     * Computed display name - "Title - Artist" or fallback
     */
    const displayName = useMemo(() => {
        return formatDisplayName(metadata, filename);
    }, [metadata, filename]);

    return {
        metadata,
        isLoading,
        error,
        displayName,
        audioId,
        refetch
    };
}

/**
 * Batch fetch metadata for multiple tracks
 * Useful for the Media Library to fetch all metadata at once
 * 
 * @param {string[]} filenames - Array of filenames to fetch metadata for
 * @param {Object} options - Optional configuration
 * @returns {Object} Map of filename -> metadata
 */
export function useTrackMetadataBatch(filenames, options = {}) {
    const {
        enabled = true,
        baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    } = options;

    const [metadataMap, setMetadataMap] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !filenames || filenames.length === 0) {
            return;
        }

        const abortController = new AbortController();
        
        const fetchAll = async () => {
            setIsLoading(true);
            const results = {};

            // Fetch in parallel with a concurrency limit
            const BATCH_SIZE = 10;
            
            for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
                const batch = filenames.slice(i, i + BATCH_SIZE);
                
                const batchResults = await Promise.all(
                    batch.map(async (filename) => {
                        try {
                            const response = await fetch(
                                `${baseUrl}/api/preview/metadata/${encodeURIComponent(filename)}`,
                                { signal: abortController.signal }
                            );

                            if (response.ok) {
                                const data = await response.json();
                                if (data.success && data.metadata) {
                                    return { filename, metadata: data.metadata };
                                }
                            }
                            return { filename, metadata: null };
                        } catch (err) {
                            if (err.name === 'AbortError') throw err;
                            return { filename, metadata: null };
                        }
                    })
                );

                batchResults.forEach(({ filename, metadata }) => {
                    results[filename] = metadata;
                });
            }

            setMetadataMap(results);
            setIsLoading(false);
        };

        fetchAll().catch(err => {
            if (err.name !== 'AbortError') {
                console.error('[useTrackMetadataBatch] Error:', err);
            }
        });

        return () => {
            abortController.abort();
        };
    }, [enabled, filenames, baseUrl]);

    /**
     * Get display name for a specific filename
     */
    const getDisplayName = useCallback((filename) => {
        const metadata = metadataMap[filename];
        return formatDisplayName(metadata, filename);
    }, [metadataMap]);

    return {
        metadataMap,
        isLoading,
        getDisplayName
    };
}

export default useTrackMetadata;
