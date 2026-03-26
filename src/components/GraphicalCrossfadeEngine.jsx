// frontend-ffmpeg-playlist/src/components/GraphicalCrossfadeEngine.jsx
import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "../api/socket";
import {
  emitGraphicalCrossfadeUpdate,
  onGraphicalCrossfadeState,
  requestGraphicalCrossfadeState,
} from "../api/crossfade";

const PIXELS_PER_SEC = 30; // Skala Zoom

const GraphicalCrossfadeEngine = ({ playlistItems }) => {
  const socket = useSocket();
  const [tracks, setTracks] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const tracksRef = useRef([]);

  const mapPlaylistToTracks = (items = []) => {
    let accumulatedTime = 0;
    const mapped = items.map((item, index) => {
      const meta = item.metadata || {};
      const durationSec =
        (meta.duration ??
          item.duration ??
          (item.playDurationMs ? item.playDurationMs / 1000 : undefined) ??
          (item.cutOutMs && item.cutInMs
            ? (item.cutOutMs - item.cutInMs) / 1000
            : undefined)) || 30;

      const cutIn =
        (meta.trimStart ??
          item.cutInMs ??
          item.cut_in ??
          item.cutIn ??
          0) / 1000;
      const cutOut =
        (meta.trimEnd ??
          item.cutOutMs ??
          item.cut_out ??
          item.cutOut ??
          durationSec * 1000) / 1000;
      const mixPoint =
        (meta.mixPoint ??
          item.mixPointMs ??
          item.mix_point ??
          item.mix_point_pr_ev ??
          item.mixPoint ??
          0) /
          1000 || cutOut;

      const trackObj = {
        id: item.id || item.uuid || item.audio_id || item.filename || `track-${index}`,
        title:
          meta.title ||
          item.title ||
          item.fileName ||
          item.filename ||
          `Track ${index + 1}`,
        filename: item.filename || item.fileName || meta.fileName || null,
        duration: durationSec,
        startTime: accumulatedTime,
        originalMeta: {
          cut_in: cutIn,
          cut_out: cutOut,
          mix_point: mixPoint,
        },
        currentSettings: {
          cut_in: cutIn,
          cut_out: cutOut,
          mix_point: mixPoint,
        },
      };

      accumulatedTime += mixPoint - cutIn;
      return trackObj;
    });
    return mapped;
  };

  const layersFromTracks = (list) =>
    list.map((t) => ({
      id: t.id,
      filename: t.filename,
      title: t.title,
      start: t.startTime ?? 0,
      cut_in: t.currentSettings?.cut_in ?? 0,
      cut_out: t.currentSettings?.cut_out ?? t.duration ?? 0,
      mix_point: t.currentSettings?.mix_point ?? t.duration ?? 0,
      duration: t.duration,
    }));

  const applyGraphicalState = (state) => {
    if (!state || !Array.isArray(state.layers)) return;
    const mapped = state.layers.map((layer, index) => {
      const cutIn = layer.cut_in ?? layer.cutIn ?? 0;
      const cutOut = layer.cut_out ?? layer.cutOut ?? layer.duration ?? 0;
      const mixPoint = layer.mix_point ?? layer.mixPoint ?? cutOut;
      return {
        id: layer.id || `layer-${index}`,
        title: layer.title || `Track ${index + 1}`,
        filename: layer.filename || layer.fileName || null,
        duration: layer.duration ?? cutOut - cutIn ?? 0,
        startTime: layer.start ?? layer.startTime ?? 0,
        originalMeta: {
          cut_in: cutIn,
          cut_out: cutOut,
          mix_point: mixPoint,
        },
        currentSettings: {
          cut_in: cutIn,
          cut_out: cutOut,
          mix_point: mixPoint,
        },
      };
    });
    setTracks(mapped);
  };

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Initial Load: from props
  useEffect(() => {
    if (playlistItems && playlistItems.length > 0) {
      const mapped = mapPlaylistToTracks(playlistItems);
      setTracks(mapped);
      emitGraphicalCrossfadeUpdate({ layers: layersFromTracks(mapped) });
    }
  }, [playlistItems]);

  // Subscribe to live playlist updates and request current playlist
  useEffect(() => {
    if (!socket) return;
    const handlePlaylist = (payload) => {
      const list =
        Array.isArray(payload?.playlist) && payload.playlist.length
          ? payload.playlist
          : Array.isArray(payload)
            ? payload
            : [];
      const mapped = mapPlaylistToTracks(list);
      setTracks(mapped);
      emitGraphicalCrossfadeUpdate({ layers: layersFromTracks(mapped) });
    };

    socket.on("playlist_update", handlePlaylist);
    socket.emit("get_playlist");

    return () => {
      socket.off("playlist_update", handlePlaylist);
    };
  }, [socket]);

  // Subscribe to graphical crossfade state (server-persisted)
  useEffect(() => {
    const unsubscribe = onGraphicalCrossfadeState((state) => {
      applyGraphicalState(state);
    });
    requestGraphicalCrossfadeState((state) => applyGraphicalState(state));
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle Socket Response
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setPreviewUrl(data.url);
      setIsRendering(false);
    };
    socket.on("preview-musicbed-ready", handler);
    return () => socket.off("preview-musicbed-ready", handler);
  }, [socket]);

  // Logic Dragging (Mengubah Mix Point track SEBELUMNYA)
  const handleDragStart = (e, index) => {
    if (index === 0) return; // Track pertama tidak bisa digeser start-nya

    const startX = e.clientX;
    const prevTrack = tracks[index - 1];
    const initialPrevMixPoint = prevTrack.currentSettings.mix_point;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSeconds = deltaX / PIXELS_PER_SEC;

      // Update Mix Point Track Sebelumnya
      // Geser kanan = Mix Point tambah besar = Track ini masuk telat
      const newMixPoint = initialPrevMixPoint + deltaSeconds;

      setTracks((currentTracks) => {
        const newTracks = [...currentTracks];

        // Update track sebelumnya
        newTracks[index - 1] = {
          ...newTracks[index - 1],
          currentSettings: {
            ...newTracks[index - 1].currentSettings,
            mix_point: Math.max(
              newTracks[index - 1].currentSettings.cut_in,
              Math.min(
                newTracks[index - 1].currentSettings.cut_out,
                newMixPoint,
              ),
            ),
          },
        };

        // Recalculate Start Times untuk semua track ke bawah
        // Karena satu pergeseran mempengaruhi rantai waktu di bawahnya
        let accTime = 0;
        for (let i = 0; i < newTracks.length; i++) {
          newTracks[i].startTime = accTime;
          const s = newTracks[i].currentSettings;
          accTime += s.mix_point - s.cut_in;
        }

        return newTracks;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const requestRender = () => {
    if (!tracks || tracks.length === 0) return;
    setIsRendering(true);
    const payload = tracks.map((t) => ({
      id: t.id,
      filename: t.filename,
      modifiedSettings: t.currentSettings,
    }));
    emitGraphicalCrossfadeUpdate({
      layers: layersFromTracks(tracks),
      playheadSeconds: 0,
    });
    socket.emit("req-preview-musicbed", { items: payload });
  };

  return (
    <div className="bg-gray-900 p-4 rounded text-white border border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">Music Bed Sequencer</h2>
        <div className="flex gap-2">
          <button
            onClick={requestRender}
            disabled={isRendering}
            className={`px-4 py-2 rounded font-bold ${isRendering ? "bg-gray-600" : "bg-green-600 hover:bg-green-500"}`}
          >
            {isRendering ? "Processing FFmpeg..." : "Apply & Listen"}
          </button>
        </div>
      </div>

      {/* Container Scrollable */}
      <div
        className="overflow-x-auto border border-gray-800 bg-gray-950 p-4 relative"
        style={{ height: "420px", minHeight: "420px" }}
      >
        {tracks.length === 0 ? (
          <div className="text-center text-gray-500 py-16">No Tracks</div>
        ) : (
          tracks.map((track, index) => (
            <div
              key={track.id}
              onMouseDown={(e) => handleDragStart(e, index)}
              className={`absolute h-20 rounded-md border border-gray-600 flex flex-col justify-center px-2 select-none
                            ${index % 2 === 0 ? "bg-blue-900/80" : "bg-purple-900/80"}
                            cursor-pointer hover:brightness-110 transition-colors`}
              style={{
                left: `${track.startTime * PIXELS_PER_SEC}px`,
                top: `${index * 90 + 20}px`,
                width: `${(track.currentSettings.cut_out - track.currentSettings.cut_in) * PIXELS_PER_SEC}px`,
                transition: "none",
              }}
            >
              <div className="font-bold truncate">{track.title}</div>
              <div className="text-xs text-gray-300">
                Start: {track.startTime.toFixed(1)}s | Mix Out:{" "}
                {track.currentSettings.mix_point.toFixed(1)}s
              </div>

              <div
                className="absolute top-0 bottom-0 bg-yellow-500 w-1 z-10"
                style={{
                  left: `${(track.currentSettings.mix_point - track.currentSettings.cut_in) * PIXELS_PER_SEC}px`,
                }}
                title="Mix Point (Next track starts here)"
              ></div>
            </div>
          ))
        )}
      </div>

      {/* Audio Player Hasil Render */}
      {previewUrl && (
        <div className="mt-4 p-4 bg-gray-800 rounded">
          <p className="mb-2 text-sm text-gray-400">
            Preview Result (Actual FFmpeg Output):
          </p>
          <audio controls src={previewUrl} className="w-full" autoPlay />
        </div>
      )}
    </div>
  );
};

export default GraphicalCrossfadeEngine;
