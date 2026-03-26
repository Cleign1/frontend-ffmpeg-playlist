import { useState } from 'react';
import AudioWaveformPreview from './components/AudioWaveformPreview';

/**
 * Example: Basic Usage
 * Demonstrates simple waveform with timing cues
 */
export function ExampleBasic() {
  const audioUrl = "http://localhost:3000/api/preview/audio/song.mp3";
  
  const metadata = {
    cut_in: 5000,      // Start at 5 seconds
    cut_out: 180000,   // End at 3 minutes
    mix_point: 170000  // Mix at 2:50
  };

  return (
    <div className="p-6 bg-neutral-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">
        Basic Waveform Example
      </h1>
      
      <AudioWaveformPreview 
        audioUrl={audioUrl}
        metadata={metadata}
      />
    </div>
  );
}

/**
 * Example: With Callbacks
 * Demonstrates event handling and state management
 */
export function ExampleWithCallbacks() {
  const [waveformReady, setWaveformReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const audioUrl = "http://localhost:3000/api/preview/audio/song.mp3";
  
  const metadata = {
    cut_in: 5000,
    cut_out: 180000,
    mix_point: 170000,
    title: "Example Song",
    artist: "Example Artist"
  };

  const handleReady = (data) => {
    console.log('Waveform ready!', data);
    setWaveformReady(true);
    setDuration(data.duration);
  };

  const handleError = (err) => {
    console.error('Waveform error:', err);
    setError(err.message);
  };

  const handleRegionClick = (region, event) => {
    console.log(`Clicked on ${region.id}:`, {
      start: region.start,
      end: region.end,
      content: region.content
    });
  };

  return (
    <div className="p-6 bg-neutral-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-4">
        Waveform with Callbacks
      </h1>
      
      {/* Status Display */}
      <div className="mb-6 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-neutral-400">Status:</span>
            <span className={`ml-2 font-medium ${waveformReady ? 'text-green-400' : 'text-yellow-400'}`}>
              {waveformReady ? '✅ Ready' : '⏳ Loading...'}
            </span>
          </div>
          <div>
            <span className="text-neutral-400">Duration:</span>
            <span className="ml-2 font-medium text-blue-400">
              {duration ? `${Math.floor(duration)}s` : '-'}
            </span>
          </div>
          <div>
            <span className="text-neutral-400">Error:</span>
            <span className="ml-2 font-medium text-red-400">
              {error || 'None'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Waveform */}
      <AudioWaveformPreview 
        audioUrl={audioUrl}
        metadata={metadata}
        onReady={handleReady}
        onError={handleError}
        onRegionClick={handleRegionClick}
      />
      
      {/* Track Info */}
      {waveformReady && (
        <div className="mt-6 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
          <h2 className="text-lg font-bold text-white mb-3">Track Information</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-neutral-400">Title:</span>
              <span className="ml-2 text-neutral-200">{metadata.title}</span>
            </div>
            <div>
              <span className="text-neutral-400">Artist:</span>
              <span className="ml-2 text-neutral-200">{metadata.artist}</span>
            </div>
            <div>
              <span className="text-neutral-400">Cut In:</span>
              <span className="ml-2 text-green-400">{metadata.cut_in}ms</span>
            </div>
            <div>
              <span className="text-neutral-400">Cut Out:</span>
              <span className="ml-2 text-red-400">{metadata.cut_out}ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example: API Integration
 * Demonstrates fetching track data from backend API
 */
export function ExampleAPIIntegration() {
  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState(null);

  // Example track list
  const tracks = [
    { id: 1, title: "Song One", filename: "song1.mp3" },
    { id: 2, title: "Song Two", filename: "song2.mp3" },
    { id: 3, title: "Song Three", filename: "song3.mp3" }
  ];

  const loadTrack = async (trackId, filename) => {
    setLoading(true);
    setSelectedTrackId(trackId);
    
    try {
      // Fetch track metadata from backend
      const response = await fetch(`http://localhost:3000/api/track/${trackId}`);
      const data = await response.json();
      
      // Format for waveform component
      setTrackData({
        audioUrl: `http://localhost:3000/api/preview/audio/${filename}`,
        metadata: {
          cut_in: data.cutInMs || 0,
          cut_out: data.cutOutMs || data.durationMs,
          mix_point: data.mixPointMs || null,
          title: data.title,
          artist: data.artist,
          duration: data.durationSec
        }
      });
    } catch (error) {
      console.error('Failed to load track:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-neutral-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">
        API Integration Example
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Track List */}
        <div className="lg:col-span-1">
          <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
            <div className="bg-neutral-800 px-4 py-3 border-b border-neutral-700">
              <h2 className="text-sm font-bold text-neutral-200">Track Library</h2>
            </div>
            <div className="p-2">
              {tracks.map(track => (
                <button
                  key={track.id}
                  onClick={() => loadTrack(track.id, track.filename)}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition ${
                    selectedTrackId === track.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  <div className="font-medium">{track.title}</div>
                  <div className="text-xs opacity-70">{track.filename}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Waveform Display */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="flex items-center justify-center h-64 bg-neutral-900 rounded-lg border border-neutral-800">
              <div className="text-center">
                <div className="text-4xl mb-2 animate-spin">⏳</div>
                <div className="text-neutral-400">Loading track data...</div>
              </div>
            </div>
          )}
          
          {!loading && !trackData && (
            <div className="flex items-center justify-center h-64 bg-neutral-900 rounded-lg border border-neutral-800">
              <div className="text-center">
                <div className="text-4xl mb-2">🎵</div>
                <div className="text-neutral-400">Select a track to preview</div>
              </div>
            </div>
          )}
          
          {!loading && trackData && (
            <AudioWaveformPreview 
              audioUrl={trackData.audioUrl}
              metadata={trackData.metadata}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Example: Playlist Integration
 * Demonstrates integration with existing playlist system
 */
export function ExamplePlaylistIntegration() {
  const [currentTrack, setCurrentTrack] = useState(null);
  
  // Example: This would come from your existing playlist state
  const playlist = [
    {
      uuid: "track-1",
      title: "Morning Show Theme",
      artist: "Radio Orchestra",
      filename: "morning_theme.mp3",
      cutInMs: 0,
      cutOutMs: 180000,
      mixPointMs: 170000
    },
    {
      uuid: "track-2",
      title: "News Jingle",
      artist: "Studio Band",
      filename: "news_jingle.mp3",
      cutInMs: 500,
      cutOutMs: 15000,
      mixPointMs: 12000
    },
    {
      uuid: "track-3",
      title: "Weather Report Music",
      artist: "Background Music",
      filename: "weather_music.mp3",
      cutInMs: 1000,
      cutOutMs: 45000,
      mixPointMs: 40000
    }
  ];

  const handleTrackClick = (track) => {
    setCurrentTrack(track);
  };

  return (
    <div className="p-6 bg-neutral-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">
        Playlist Integration Example
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Playlist Table */}
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
          <div className="bg-neutral-800 px-4 py-3 border-b border-neutral-700">
            <h2 className="text-sm font-bold text-neutral-200">Current Playlist</h2>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-neutral-850 text-neutral-400 text-xs uppercase sticky top-0">
                <tr>
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Title</th>
                  <th className="p-3 text-left">Artist</th>
                  <th className="p-3 text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {playlist.map((track, index) => (
                  <tr
                    key={track.uuid}
                    onClick={() => handleTrackClick(track)}
                    className={`border-b border-neutral-800 cursor-pointer transition ${
                      currentTrack?.uuid === track.uuid
                        ? 'bg-blue-600/20 text-blue-200'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <td className="p-3 font-mono">{index + 1}</td>
                    <td className="p-3 font-medium">{track.title}</td>
                    <td className="p-3">{track.artist}</td>
                    <td className="p-3 text-right font-mono">
                      {Math.floor((track.cutOutMs - track.cutInMs) / 1000)}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Waveform Preview */}
        <div>
          {currentTrack ? (
            <AudioWaveformPreview 
              audioUrl={`http://localhost:3000/api/preview/audio/${currentTrack.filename}`}
              metadata={{
                cut_in: currentTrack.cutInMs,
                cut_out: currentTrack.cutOutMs,
                mix_point: currentTrack.mixPointMs
              }}
              height={180}
            />
          ) : (
            <div className="flex items-center justify-center h-64 bg-neutral-900 rounded-lg border border-neutral-800">
              <div className="text-center">
                <div className="text-4xl mb-2">👆</div>
                <div className="text-neutral-400">Click a track to see waveform</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Example: Custom Height and Styling
 * Demonstrates customization options
 */
export function ExampleCustomStyling() {
  const audioUrl = "http://localhost:3000/api/preview/audio/song.mp3";
  
  const metadata = {
    cut_in: 5000,
    cut_out: 180000,
    mix_point: 170000
  };

  return (
    <div className="p-6 bg-gradient-to-br from-purple-950 to-neutral-950 min-h-screen">
      <h1 className="text-2xl font-bold text-white mb-6">
        Custom Styling Example
      </h1>
      
      {/* Compact Version */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-3">Compact (80px)</h2>
        <AudioWaveformPreview 
          audioUrl={audioUrl}
          metadata={metadata}
          height={80}
        />
      </div>
      
      {/* Standard Version */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-3">Standard (128px)</h2>
        <AudioWaveformPreview 
          audioUrl={audioUrl}
          metadata={metadata}
          height={128}
        />
      </div>
      
      {/* Large Version */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-3">Large (256px)</h2>
        <AudioWaveformPreview 
          audioUrl={audioUrl}
          metadata={metadata}
          height={256}
        />
      </div>
      
      {/* In Custom Container */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-3">Custom Container</h2>
        <div className="border-4 border-purple-500 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20">
          <AudioWaveformPreview 
            audioUrl={audioUrl}
            metadata={metadata}
            height={200}
          />
        </div>
      </div>
    </div>
  );
}
