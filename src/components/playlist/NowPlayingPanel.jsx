export default function NowPlayingPanel({ playlist, index, progress }) {
  const prev = playlist[(index - 1 + playlist.length) % playlist.length] || {};
  const cur = playlist[index] || {};
  const next = playlist[(index + 1) % playlist.length] || {};

  const percent = Math.min(100, (progress / cur.duration) * 100);

  return (
    <div className="border-b border-neutral-800 shrink-0">
      <Row label="Last" track={prev} dim />
      <div className="relative bg-green-900/20 px-4 py-3">
        <div
          className="absolute inset-y-0 left-0 bg-green-500/20"
          style={{ width: `${percent}%` }}
        />
        <div className="relative">
          <div className="text-xs text-green-400 uppercase">Playing</div>
          <div className="text-xl font-bold">{cur.title}</div>
          <div className="text-sm text-green-300">{cur.artist}</div>
        </div>
      </div>
      <Row label="Next" track={next} />
    </div>
  );
}

const Row = ({ label, track, dim }) => (
  <div
    className={`px-4 py-2 flex gap-4 ${
      dim ? "opacity-50 bg-red-900/10" : "bg-yellow-900/10"
    }`}
  >
    <span className="w-20 text-xs uppercase">{label}</span>
    <span className="truncate">
      {track.artist} – {track.title}
    </span>
  </div>
);
