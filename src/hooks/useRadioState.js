// frontend-ffmpeg-playlist/src/hooks/useRadioState.js
import { useState, useEffect, useCallback } from "react";
import { connectSocket, getSocket } from "../api/socket";

export const useRadioState = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState({
    state: "stopped", // 'playing', 'stopped', 'paused'
    playing: false,
    mode: "MANUAL",
    currentSong: null,
    playlist: [],
    volume: 100,
    listeners: 0,
    activePlaylistId: null,
    pendingPlaylistId: null,
    stationInfo: {},
    crossfade: {
      enabled: false,
      fadeInMs: 0,
      preloadMs: 0,
      overlapMs: 0,
      fadeOutMs: 0,
    },
  });

  // Fungsi untuk mengirim command ke backend
  const sendCommand = useCallback((command, payload = {}) => {
    const socket = getSocket();
    if (socket) {
      socket.emit("control-command", { command, ...payload });
    }
  }, []);

  useEffect(() => {
    // Inisialisasi koneksi
    const socket = connectSocket();

    const onConnect = () => {
      setIsConnected(true);
      console.log("Socket Connected");
    };

    const onDisconnect = () => {
      setIsConnected(false);
      console.log("Socket Disconnected");
    };

    // Menerima update status rutin dari backend
    const onStatusUpdate = (newStatus) => {
      const mapped = { ...newStatus };
      if (mapped.playing === undefined && mapped.isPlaying !== undefined) {
        mapped.playing = mapped.isPlaying;
      }
      if (mapped.listeners === undefined && mapped.clients !== undefined) {
        mapped.listeners = mapped.clients;
      }
      if (mapped.mode === undefined && mapped.playbackMode) {
        mapped.mode = mapped.playbackMode === "auto" ? "AUTO" : "MANUAL";
      }
      if (mapped.currentTrack && !mapped.currentSong) {
        mapped.currentSong = mapped.currentTrack;
      }
      if (mapped.radio_channel_info && !mapped.stationInfo) {
        mapped.stationInfo = mapped.radio_channel_info;
      }
      if (
        !mapped.stationInfo &&
        mapped.stationInfo === undefined &&
        mapped.radio_channel_info === undefined &&
        newStatus.network_code
      ) {
        mapped.stationInfo = {
          network_code: newStatus.network_code,
          network_id: newStatus.network_id,
          local_code: newStatus.local_code,
          country_code: newStatus.country_code,
        };
      }
      if (mapped.crossfadeGraphical && !mapped.crossfadeGraphical.syncedAt) {
        mapped.crossfadeGraphical = {
          ...mapped.crossfadeGraphical,
          syncedAt: Date.now(),
        };
      }
      if (mapped.crossfade === undefined && newStatus.crossfadeGraphical) {
        // derive timing fields from graphical state when missing
        mapped.crossfade = {
          enabled: !!newStatus.crossfadeGraphical.enabled,
          fadeInMs: newStatus.crossfadeGraphical.fadeInMs ?? 0,
          preloadMs: newStatus.crossfadeGraphical.preloadMs ?? 0,
          overlapMs: newStatus.crossfadeGraphical.overlapMs ?? 0,
          fadeOutMs: newStatus.crossfadeGraphical.fadeOutMs ?? 0,
        };
      }
      setStatus((prev) => ({ ...prev, ...mapped }));
    };

    const onRadioInfo = (info) => {
      setStatus((prev) => ({ ...prev, stationInfo: info || {} }));
    };

    const onListeners = (count) => {
      if (typeof count === "number") {
        setStatus((prev) => ({ ...prev, listeners: count }));
      }
    };

    const onPlaylist = (playlistPayload) => {
      const list =
        Array.isArray(playlistPayload?.playlist) && playlistPayload.playlist.length
          ? playlistPayload.playlist
          : Array.isArray(playlistPayload)
            ? playlistPayload
            : [];
      setStatus((prev) => ({ ...prev, playlist: list }));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("status", onStatusUpdate);
    socket.on("status_update", onStatusUpdate);
    socket.on("player:state", onStatusUpdate);
    socket.on("state", onStatusUpdate);
    socket.on("radio-status", onStatusUpdate); // Handle variasi nama event
    socket.on("playlist_update", onPlaylist);
    socket.on("radio_channel_info", onRadioInfo);
    socket.on("listeners", onListeners);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("status", onStatusUpdate);
      socket.off("status_update", onStatusUpdate);
      socket.off("player:state", onStatusUpdate);
      socket.off("state", onStatusUpdate);
      socket.off("radio-status", onStatusUpdate);
      socket.off("playlist_update", onPlaylist);
      socket.off("radio_channel_info", onRadioInfo);
      socket.off("listeners", onListeners);
    };
  }, []);

  return {
    isConnected,
    connected: isConnected,
    status,
    sendCommand,
    // Helper shortcuts
    isPlaying: status.playing || status.state === "playing",
    currentSong: status.currentSong,
    playlist: status.playlist || [],
    playing: status.playing,
    isStopping: status.isStopping || status.stopRequested,
    mode: status.mode,
    activePlaylistId: status.activePlaylistId,
    pendingPlaylistId: status.pendingPlaylistId,
    listeners: status.listeners,
    stationInfo: status.stationInfo,
    nowPlaying: status.currentSong,
    crossfade: status.crossfade,
  };
};
