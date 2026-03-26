import { useState, useEffect } from "react";
import {
  getSocket,
  useSocket,
  listVoiceTracks,
  connectSocket,
} from "../api/socket";
import { PlayCircle, Volume2, VolumeX, Mic2, Music2, Loader2 } from "lucide-react";

/**
 * MusicBedSelector
 * UI to select a background track, add a voice-over clip, and set ducking/ramp timings.
 * Emits `req-preview-musicbed` with two layers: music (ducked) and voice (on top),
 * and lets user preview the temporary render.
 */
export default function MusicBedSelector({ tracks = [] }) {
  const socket = useSocket();
  const [musicId, setMusicId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [musicLevel, setMusicLevel] = useState(0.4);
  const [voiceLevel, setVoiceLevel] = useState(0.9);
  const [voiceStart, setVoiceStart] = useState(0);
  const [rampUpDelay, setRampUpDelay] = useState(1.0);
  const [rampUpDur, setRampUpDur] = useState(2.0);
  const [isRendering, setIsRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [library, setLibrary] = useState([]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setPreviewUrl(data.url);
      setIsRendering(false);
    };
    socket.on("preview-musicbed-ready", handler);
    return () => socket.off("preview-musicbed-ready", handler);
  }, [socket]);

  const [voiceFiles, setVoiceFiles] = useState([]);

  useEffect(() => {
    listVoiceTracks()
      .then(setVoiceFiles)
      .catch(() => setVoiceFiles([]));
  }, []);

  useEffect(() => {
    const s = getSocket();

    const fetchLists = () => {
      s.emit("library:list", (resp) => {
        if (resp?.ok) setLibrary(resp.library || []);
      });
      listVoiceTracks()
        .then(setVoiceFiles)
        .catch(() => setVoiceFiles([]));
    };

    if (s.connected) {
      fetchLists();
    } else {
      const onConnect = () => {
        fetchLists();
        s.off("connect", onConnect);
      };
      s.on("connect", onConnect);
      connectSocket();
      return () => s.off("connect", onConnect);
    }
  }, []);

  const dedupeByFile = (items = []) => {
    const seen = new Set();
    const out = [];
    items.forEach((t) => {
      const key = t.filename || t.id || t.name;
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(t);
    });
    return out;
  };

  const musicOptions = dedupeByFile((tracks || []).concat(library).filter((t) => {
    const cat = (t.category || "").toLowerCase();
    return cat === "music" || cat === "" || (!t.type && !cat) || t.type === "music";
  }));
  const voiceOptions = dedupeByFile((tracks || []).concat(library).filter((t) => {
    const cat = (t.category || "").toLowerCase();
    return (
      t.type === "voice" ||
      cat === "voice track" ||
      cat.includes("cat_vt_ai") ||
      cat.startsWith("voice")
    );
  }));

  useEffect(() => {
    if (!musicId && musicOptions.length > 0) {
      setMusicId(musicOptions[0].id || musicOptions[0].filename || "");
    }
  }, [musicOptions, musicId]);

  useEffect(() => {
    if (voiceId) return;
    const vo = voiceOptions.length
      ? voiceOptions[0]
      : voiceFiles.length
        ? { filename: voiceFiles[0] }
        : null;
    if (vo) setVoiceId(vo.id || vo.filename || vo);
  }, [voiceOptions, voiceFiles, voiceId]);

  const findTrack = (id) =>
    tracks.find(
      (t) => t.id === id || t.filename === id || t.fileName === id || t.name === id,
    ) ||
    library.find(
      (t) => t.id === id || t.filename === id || t.fileName === id || t.name === id,
    );

  const resolveRef = (track, fallback) => {
    const ref =
      track?.filename ||
      track?.fileName ||
      track?.name ||
      track?.originalFilename ||
      track?.path ||
      track?.source ||
      track?.id ||
      fallback;
    return ref || fallback;
  };

  const getVoiceDurationSec = (voice) => {
    if (!voice) return 10;
    return (
      voice.duration ||
      (voice.playDurationMs ? voice.playDurationMs / 1000 : 0) ||
      (voice.cutOutMs ? voice.cutOutMs / 1000 : 0) ||
      10
    );
  };

  const sendPreview = () => {
    if (!socket) return;
    let music = findTrack(musicId);
    let voice = findTrack(voiceId);

    if (!music && musicId) {
      music = { filename: musicId, id: musicId, duration: 60, category: "music" };
    } else if (music) {
      const ref = resolveRef(music, musicId);
      music = { ...music, id: ref, filename: ref };
    }
    if (!voice && voiceId) {
      voice = {
        filename: voiceId,
        id: voiceId,
        duration: 30,
        category: "voice track",
      };
    } else if (voice) {
      const ref = resolveRef(voice, voiceId);
      voice = { ...voice, id: ref, filename: ref };
    }
    if (!music || !voice) return;
    setIsRendering(true);

    const voiceDuration = getVoiceDurationSec(voice);

    // Music layer ducked during voice, then ramp up
    const musicSettings = {
      cut_in: 0,
      cut_out: music.duration || 60,
      mix_point: (voiceStart + voiceDuration + rampUpDelay + rampUpDur) || 20,
      start_at: 0,
    };

    const voiceSettings = {
      cut_in: 0,
      cut_out: voiceDuration,
      mix_point: voiceDuration,
    };

    const items = [
      {
        id: music.id || music.filename,
        filename: music.filename,
        modifiedSettings: musicSettings,
        voiceGain: musicLevel,
        envelope: {
          gainStart: musicLevel,
          gainTarget: 0.9,
          voiceEndSec: voiceDuration + voiceStart,
          rampDelaySec: rampUpDelay,
          rampDurSec: rampUpDur,
        },
        type: "music",
      },
      {
        id: voice.id || voice.filename,
        filename: voice.filename,
        modifiedSettings: {
          ...voiceSettings,
          start_at: voiceStart,
        },
        voiceGain: voiceLevel,
        advanceTimeline: false,
        type: "voice",
      },
    ];

    socket.emit("req-preview-musicbed", { items });
  };

  const baseSelect = (value, setValue, options, placeholder) => (
    <select
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => {
        const key = opt.id || opt.filename || opt;
        const label = opt.title || opt.name || opt.filename || opt;
        const value = opt.id || opt.filename || opt;
        return (
          <option key={key} value={value}>
            {label}
          </option>
        );
      })}
    </select>
  );

  return (
    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-gray-700/60 rounded-2xl p-5 shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg">
          <Mic2 className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Voice-over Music Bed</h3>
          <p className="text-sm text-gray-400">Duck music under voice and ramp back up.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Music Track</label>
          {baseSelect(musicId, setMusicId, musicOptions, "Select music")}
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Voice Clip</label>
          {baseSelect(
            voiceId,
            setVoiceId,
            voiceOptions.length ? voiceOptions : voiceFiles,
            "Select voice-over",
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Music Level (0-1)</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={musicLevel}
            onChange={(e) => setMusicLevel(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-300 font-mono">{musicLevel.toFixed(2)}</div>

          <label className="text-xs text-gray-400">Voice Start (s)</label>
          <input
            type="number"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            value={voiceStart}
            min="0"
            onChange={(e) => setVoiceStart(Number(e.target.value))}
          />

        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Voice Level (0-1)</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={voiceLevel}
            onChange={(e) => setVoiceLevel(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-300 font-mono">{voiceLevel.toFixed(2)}</div>

          <label className="text-xs text-gray-400">Ramp-up Delay After Voice (s)</label>
          <input
            type="number"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            value={rampUpDelay}
            min="0"
            step="0.1"
            onChange={(e) => setRampUpDelay(Number(e.target.value))}
          />

          <label className="text-xs text-gray-400">Ramp-up Duration (s)</label>
          <input
            type="number"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            value={rampUpDur}
            min="0.5"
            step="0.1"
            onChange={(e) => setRampUpDur(Number(e.target.value))}
          />

          <div className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-3 text-xs text-gray-300">
            Flow: music starts full → voice starts at {voiceStart}s → music stays at {musicLevel.toFixed(2)} during voice → waits {rampUpDelay}s → ramps up over {rampUpDur}s to 0.9.
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={!musicId || !voiceId || isRendering}
          onClick={sendPreview}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold shadow-lg disabled:opacity-40"
        >
          {isRendering ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Rendering...
            </>
          ) : (
            <>
              <PlayCircle className="w-4 h-4" />
              Preview Music Bed
            </>
          )}
        </button>
      </div>

      {previewUrl && (
        <div className="mt-4 p-4 bg-gray-800/70 border border-gray-700 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-gray-200 mb-2">
            <Music2 className="w-4 h-4 text-emerald-400" />
            Rendered Preview
          </div>
          <audio controls src={previewUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}
