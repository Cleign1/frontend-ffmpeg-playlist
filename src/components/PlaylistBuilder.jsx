import { useState } from "react";
import { getSocket } from "../api/socket";

export default function PlaylistBuilder({ disabled }) {
  const socket = getSocket();
  const [tracks, setTracks] = useState([]);

  const addTrack = () => {
    setTracks([
      ...tracks,
      {
        title: "",
        artist: "",
        path: "",
        cutInMs: 0,
        cutOutMs: 0,
        mixPointMs: 0,
      },
    ]);
  };

  const updateTrack = (i, key, value) => {
    const next = [...tracks];
    next[i][key] = value;
    setTracks(next);
  };

  const sendPlaylist = () => {
    if (!tracks.length) {
      alert("Playlist empty");
      return;
    }
    socket.emit("set_playlist", tracks);
  };

  return (
    <div className="rounded-lg bg-neutral-900 border border-neutral-800 p-4 space-y-3">
      <h3 className="text-lg font-semibold">Manual Playlist</h3>

      {tracks.map((t, i) => (
        <div key={i} className="flex flex-col md:flex-row gap-2">
          <input
            className="flex-1 rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-sm"
            placeholder="Title"
            value={t.title}
            onChange={(e) => updateTrack(i, "title", e.target.value)}
          />
          <input
            className="flex-1 rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-sm"
            placeholder="Artist"
            value={t.artist}
            onChange={(e) => updateTrack(i, "artist", e.target.value)}
          />
          <input
            className="flex-1 rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-sm"
            placeholder="Path"
            value={t.path}
            onChange={(e) => updateTrack(i, "path", e.target.value)}
          />
          <button
            className="px-2 text-red-400 hover:text-red-300"
            onClick={() => setTracks(tracks.filter((_, x) => x !== i))}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <button
          disabled={disabled}
          onClick={addTrack}
          className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-sm hover:bg-neutral-700 disabled:opacity-40"
        >
          + Add Track
        </button>

        <button
          disabled={disabled}
          onClick={sendPlaylist}
          className="px-3 py-2 rounded bg-blue-600 text-sm font-medium hover:bg-blue-500 disabled:opacity-40"
        >
          Send Playlist
        </button>
      </div>
    </div>
  );
}
