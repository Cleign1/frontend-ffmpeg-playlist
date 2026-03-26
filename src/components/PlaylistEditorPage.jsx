import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Radio,
  List,
  Edit3,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Copy,
  Plus,
} from "lucide-react";
import { useRadioState } from "../hooks/useRadioState";
import { getSocket } from "../api/socket";
import MediaLibrary from "./MediaLibrary";
import PlaylistManager from "./PlaylistManager";
import PlaylistViewer from "./playlist/PlaylistViewer";

export default function PlaylistEditorPage() {
  const location = useLocation();
  const radio = useRadioState();
  const [editorPlaylistId, setEditorPlaylistId] = useState(null);
  const [selectedDate, setSelectedDate] = useState("2026-01-25");
  const [selectedTime, setSelectedTime] = useState("06:00");

  const formatScheduleId = () => {
    if (!selectedDate || !selectedTime) return null;
    const dateStr = selectedDate.replace(/-/g, "");
    const timeStr = selectedTime.replace(/:/g, "");
    return `playlist_${dateStr}_${timeStr}.json`;
  };

  const handleEditSelect = (playlist) => {
    setEditorPlaylistId(playlist.id);
  };

  const handleEditClose = () => {
    setEditorPlaylistId(null);
  };

  const handleLoadEdit = () => {
    const socket = getSocket();
    const playlistId = formatScheduleId();
    if (!playlistId) {
      alert("Select a date and time first.");
      return;
    }

    const localDateTime = `${selectedDate}T${selectedTime}:00`;
    const targetDateTime = new Date(localDateTime).toISOString();

    socket.emit("playlist:generate_future", { targetDateTime }, (response) => {
      if (!response?.ok) {
        alert(response?.error || "Failed to load playlist for that slot.");
        return;
      }

      const tracks =
        Array.isArray(response.playlist) && response.playlist.length > 0
          ? response.playlist.map((track) => ({
              title: track.title || "",
              artist: track.artist || "",
              filename: track.filename || "",
              sourceFileName: track.sourceFileName || track.filename || "",
              cutInMs: track.cutIn ?? track.cutInMs ?? 0,
              cutOutMs: track.cutOut ?? track.cutOutMs ?? 0,
              mixPointMs: track.mixPoint ?? track.mixPointMs ?? 0,
              uuid: track.uuid || "",
              category: track.category || "",
            }))
          : [];

      socket.emit("playlist:save", { id: playlistId, tracks }, (saveRes) => {
        if (!saveRes?.ok) {
          alert(saveRes?.error || "Failed to save playlist for editing.");
          return;
        }
        setEditorPlaylistId(playlistId);
      });
    });
  };

  const handleClone = () => {
    const socket = getSocket();
    const playlistId = formatScheduleId();
    if (!playlistId) {
      alert("Select a date and time first.");
      return;
    }
    if (!radio.activePlaylistId) {
      alert("No active playlist to clone.");
      return;
    }

    socket.emit(
      "playlist:clone",
      { sourceId: radio.activePlaylistId, newName: playlistId },
      (res) => {
        if (!res?.ok) {
          alert(res?.error || "Failed to clone playlist.");
          return;
        }
        setEditorPlaylistId(res.id || playlistId);
      },
    );
  };

  const handleNewPlaylist = () => {
    const socket = getSocket();
    const playlistId = formatScheduleId();
    if (!playlistId) {
      alert("Select a date and time first.");
      return;
    }

    socket.emit("playlist:create", { name: playlistId }, (res) => {
      if (!res?.ok) {
        alert(res?.error || "Failed to create playlist.");
        return;
      }
      setEditorPlaylistId(res.id || playlistId);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Navigation */}
      <nav className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700/50 backdrop-blur-sm sticky top-0 z-50 shadow-2xl">
        <div className="max-w-[2000px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  SANOMA
                </h1>
                <p className="text-[10px] text-gray-400 tracking-wider">
                  STATION MASTER
                </p>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex gap-2">
              <Link
                to="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  location.pathname === "/"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <List className="w-4 h-4" />
                Control Panel
              </Link>
              <Link
                to="/playlist-editor"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  location.pathname === "/playlist-editor"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Edit3 className="w-4 h-4" />
                Playlist Editor
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="text-neutral-200 px-4 py-8 font-sans">
        <div className="max-w-[2000px] mx-auto">
          {/* Page Header */}
          <header className="mb-6">
            <div className="flex items-center gap-4">
              <div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white bg-clip-text">
                    Playlist Editor
                  </h1>
                </div>
              </div>
            </div>
          </header>

          {/* Scheduling Bar */}
          <div className="mb-8 bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-gray-900/80 border border-gray-800/70 rounded-2xl shadow-2xl backdrop-blur-lg p-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-center">
              <div className="flex flex-wrap gap-4 items-center xl:col-span-2">
                <div className="flex-1 min-w-[240px]">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                    <CalendarIcon className="w-4 h-4 text-purple-400" />
                    Select Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-gray-900/70 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-inner"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                    <ClockIcon className="w-4 h-4 text-purple-400" />
                    Select Time
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-full bg-gray-900/70 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  onClick={handleLoadEdit}
                  className="flex-1 min-w-[150px] flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                >
                  <Edit3 className="w-4 h-4" />
                  Load & Edit
                </button>
                <button
                  onClick={handleClone}
                  className="flex-1 min-w-[130px] flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-400 hover:to-fuchsia-500 text-white font-semibold px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                >
                  <Copy className="w-4 h-4" />
                  Clone
                </button>
                <button
                  onClick={handleNewPlaylist}
                  className="flex-1 min-w-[150px] flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-semibold px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                >
                  <Plus className="w-4 h-4" />
                  New Playlist
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Playlist Editor Viewer (8 cols) */}
            <div className="lg:col-span-8 flex flex-col space-y-6">
              {editorPlaylistId ? (
                <PlaylistViewer
                  viewMode="EDITOR"
                  editorPlaylistId={editorPlaylistId}
                  activePlaylistId={radio.activePlaylistId}
                  onEditClose={handleEditClose}
                  playing={radio.playing}
                  radioStartTime={0}
                />
              ) : (
                <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-12 shadow-2xl">
                  <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full flex items-center justify-center">
                      <Edit3 className="w-10 h-10 text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-300">
                      No playlist loaded
                    </h2>
                    <p className="text-gray-400 max-w-md">
                      Select a date/time to load an existing playlist, clone
                      one, or create a new playlist to get started
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Playlist Manager and Media Library (4 cols) */}
            <div className="lg:col-span-4 flex flex-col space-y-6">
              <PlaylistManager
                activePlaylistId={radio.activePlaylistId}
                pendingPlaylistId={radio.pendingPlaylistId}
                onSelectForEdit={handleEditSelect}
              />

              <MediaLibrary />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
