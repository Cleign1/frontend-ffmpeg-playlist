import { io } from "socket.io-client";
import { useEffect } from "react";

// 1. Create the socket explicitly outside of any component
// This ensures it exists immediately when the app loads.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";
const SOCKET_AUTH_TOKEN =
  import.meta.env.VITE_PLAYLIST_SOCKET_TOKEN ||
  import.meta.env.VITE_SOCKET_AUTH_TOKEN ||
  null;

// Singleton socket instance
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: SOCKET_AUTH_TOKEN ? { token: SOCKET_AUTH_TOKEN } : undefined,
  extraHeaders: SOCKET_AUTH_TOKEN
    ? { "x-editor-token": SOCKET_AUTH_TOKEN, "x-token": SOCKET_AUTH_TOKEN }
    : undefined,
});

export const connectSocket = (token) => {
  const finalToken = token || SOCKET_AUTH_TOKEN;
  if (finalToken) {
    socket.auth = { ...(socket.auth || {}), token: finalToken };
    const existingHeaders = socket.io.opts.extraHeaders || {};
    socket.io.opts.extraHeaders = {
      ...existingHeaders,
      "x-editor-token": finalToken,
      "x-token": finalToken,
    };
  }

  if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

export const getSocket = () => {
  return socket;
};

export const setSocketAuthToken = (token) => {
  if (!token) return;
  socket.auth = { ...(socket.auth || {}), token };
  const existingHeaders = socket.io.opts.extraHeaders || {};
  socket.io.opts.extraHeaders = {
    ...existingHeaders,
    "x-editor-token": token,
    "x-token": token,
  };
};

/**
 * Emits a request to insert a track into the playlist.
 * @param {number} index - The target index in the playlist.
 * @param {object} track - The track object (must contain filename or file_path).
 * @returns {Promise} - Resolves with server response.
 */
export const insertPlaylistTrack = (index, track) => {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }
    socket.emit("playlist:insert", { index, track }, (response) => {
      if (response && response.ok) {
        resolve(response);
      } else {
        reject(new Error(response?.error || "Failed to insert track"));
      }
    });
  });
};

export const listVoiceTracks = () =>
  new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error("Socket not connected"));
      return;
    }
    socket.emit("library:list_voice_tracks", {}, (response) => {
      if (response?.ok) resolve(response.tracks || []);
      else reject(new Error(response?.error || "Failed to list voice tracks"));
    });
  });

export const useSocket = () => {
  useEffect(() => {
    // Pastikan connect saat komponen di-mount
    if (!socket.connected) {
      connectSocket();
    }
  }, []);

  return socket;
};
