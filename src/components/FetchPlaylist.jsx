import { useState } from 'react';
import { getSocket } from '../api/socket';

/**
 * FetchPlaylist Component
 * Allows users to fetch and download playlists by selecting date/time
 */
export default function FetchPlaylist() {
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPlaylist, setGeneratedPlaylist] = useState(null);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const socket = getSocket();

    // Get current date as default
    const today = new Date().toISOString().split('T')[0];

    const handleGenerate = () => {
        if (!selectedDate || !selectedTime) {
            setError('Please select both date and time');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedPlaylist(null);

        // Create datetime in LOCAL timezone (not UTC)
        // Format: YYYY-MM-DDTHH:mm (local time)
        const localDateTime = `${selectedDate}T${selectedTime}:00`;
        const targetDate = new Date(localDateTime);
        
        // Convert to ISO string for backend
        const targetDateTime = targetDate.toISOString();

        console.log('Selected (Local):', localDateTime);
        console.log('Sending to backend (ISO):', targetDateTime);
        console.log('Target Date Object:', targetDate);

        socket.emit("playlist:generate_future", { targetDateTime }, (response) => {
            setIsGenerating(false);

            if (response.ok) {
                setGeneratedPlaylist(response);
                console.log('Generated playlist:', response);
            } else {
                setError(response.error || 'Failed to generate playlist');
            }
        });
    };

    const handleDownload = () => {
        if (!generatedPlaylist) return;

        // Create CSV content
        const csvHeader = 'Position,Title,Artist,Filename,Duration (sec),Category\n';
        const csvRows = generatedPlaylist.playlist.map(track => 
            `${track.position},"${track.title}","${track.artist}","${track.filename}",${track.duration},"${track.category}"`
        ).join('\n');
        const csvContent = csvHeader + csvRows;

        // Create downloadable file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        // Use the selected date/time for filename (local time)
        const dateStr = selectedDate.replace(/-/g, '');
        const timeStr = selectedTime.replace(/:/g, '');
        link.setAttribute('href', url);
        link.setAttribute('download', `playlist_${dateStr}_${timeStr}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadJSON = () => {
        if (!generatedPlaylist) return;

        // Create JSON content
        const jsonContent = JSON.stringify(generatedPlaylist, null, 2);

        // Create downloadable file
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        // Use the selected date/time for filename (local time)
        const dateStr = selectedDate.replace(/-/g, '');
        const timeStr = selectedTime.replace(/:/g, '');
        link.setAttribute('href', url);
        link.setAttribute('download', `playlist_${dateStr}_${timeStr}.json`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const getTotalDuration = () => {
        if (!generatedPlaylist) return 0;
        return generatedPlaylist.playlist.reduce((sum, track) => sum + track.duration, 0);
    };

    const formatDisplayTime = () => {
        if (!selectedDate || !selectedTime) return '';
        // Display the exact date/time user selected (local time)
        const localDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
        return localDateTime.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const handleSaveToPlaylistManager = () => {
        if (!generatedPlaylist) return;

        setIsSaving(true);
        setSaveSuccess(false);
        setError(null);

        // Generate playlist ID with scheduler prefix (automatic playlist)
        const dateStr = selectedDate.replace(/-/g, '');
        const timeStr = selectedTime.replace(/:/g, '');
        const playlistId = `playlist_${dateStr}_${timeStr}.json`;

        // Transform playlist data to match expected format
        const tracks = generatedPlaylist.playlist.map(track => ({
            title: track.title || '',
            artist: track.artist || '',
            filename: track.filename || '',
            sourceFileName: track.sourceFileName || '', // For downloading
            cutInMs: track.cutIn || 0,
            cutOutMs: track.cutOut || 0,
            mixPointMs: track.mixPoint || 0,
            uuid: track.uuid || '',
            category: track.category || ''
        }));

        console.log('Saving playlist:', playlistId, 'with', tracks.length, 'tracks');

        socket.emit('playlist:save', { id: playlistId, tracks }, (response) => {
            setIsSaving(false);
            
            if (response && response.ok) {
                setSaveSuccess(true);
                console.log('✅ Playlist saved to manager:', playlistId);
                
                // Auto-hide success message after 3 seconds
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                setError(response?.error || 'Failed to save playlist to manager');
                console.error('❌ Failed to save playlist:', response);
            }
        });
    };

    return (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-lg">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    Fetch Playlist
                </h2>
                <p className="text-neutral-400 text-sm mt-1">
                    Fetch and download playlists for any date and time
                </p>
            </div>

            {/* Input Controls */}
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date Picker */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                            Select Date
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                        />
                    </div>

                    {/* Time Picker */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-2">
                            Select Time
                        </label>
                        <input
                            type="time"
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(e.target.value)}
                            className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                        />
                    </div>
                </div>

                {/* Display selected time */}
                {selectedDate && selectedTime && (
                    <div className="text-sm text-neutral-400 bg-neutral-950 px-4 py-2 rounded border border-neutral-800">
                        📅 Selected: <span className="text-white font-mono">{formatDisplayTime()}</span>
                    </div>
                )}

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !selectedDate || !selectedTime}
                    className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-900/50"
                >
                    {isGenerating ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Fetching...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Fetch Playlist
                        </>
                    )}
                </button>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <h4 className="text-red-400 font-semibold text-sm">Error</h4>
                            <p className="text-red-300 text-sm mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {/* Generated Playlist Display */}
                {generatedPlaylist && (
                    <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg overflow-hidden">
                        {/* Playlist Header */}
                        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between bg-green-900/20">
                            <div>
                                <h3 className="text-green-400 font-semibold flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Playlist Fetched Successfully
                                </h3>
                                <p className="text-neutral-400 text-xs mt-1">
                                    {generatedPlaylist.totalTracks} tracks • Total duration: {formatDuration(getTotalDuration())}
                                </p>
                                <p className="text-neutral-500 text-xs mt-0.5">
                                    Selected: {formatDisplayTime()}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveToPlaylistManager}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg hover:shadow-green-900/50"
                                    title="Save to Playlist Manager (Scheduler)"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                            </svg>
                                            Save Scheduler
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleDownloadJSON}
                                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    title="Download as JSON"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    JSON
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg hover:shadow-indigo-900/50"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Download CSV
                                </button>
                            </div>
                        </div>

                        {/* Success Message */}
                        {saveSuccess && (
                            <div className="px-4 py-3 bg-green-900/30 border-b border-green-700/50 flex items-center gap-3">
                                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-green-300 text-sm font-medium">
                                    ✅ Saved to Playlist Manager as Scheduler playlist
                                </span>
                            </div>
                        )}

                        {/* Playlist Table */}
                        <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-neutral-900 border-b border-neutral-800">
                                    <tr className="text-neutral-400 text-xs">
                                        <th className="px-4 py-2 text-left font-medium">#</th>
                                        <th className="px-4 py-2 text-left font-medium">Title</th>
                                        <th className="px-4 py-2 text-left font-medium">Artist</th>
                                        <th className="px-4 py-2 text-left font-medium">Category</th>
                                        <th className="px-4 py-2 text-right font-medium">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {generatedPlaylist.playlist.map((track) => (
                                        <tr 
                                            key={track.position}
                                            className="border-b border-neutral-800/40 hover:bg-neutral-800/30 transition"
                                        >
                                            <td className="px-4 py-2 text-neutral-500 font-mono text-xs">
                                                {track.position}
                                            </td>
                                            <td className="px-4 py-2 text-white truncate max-w-xs">
                                                {track.title}
                                            </td>
                                            <td className="px-4 py-2 text-neutral-300 truncate max-w-xs">
                                                {track.artist}
                                            </td>
                                            <td className="px-4 py-2 text-neutral-400 text-xs">
                                                <span className="px-2 py-1 bg-neutral-800 rounded-full">
                                                    {track.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-neutral-400 text-right font-mono text-xs">
                                                {formatDuration(track.duration)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
