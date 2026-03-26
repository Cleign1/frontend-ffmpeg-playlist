import { useEffect, useState } from "react";

export default function PlaylistHeader({ listeners }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="flex justify-between items-center px-4 py-2 bg-neutral-950 border-b border-neutral-800">
      <span className="text-xs text-neutral-400">{now.toDateString()}</span>
      <span className="font-mono text-lg text-blue-400">
        {now.toLocaleTimeString()}
      </span>
      <span className="text-xs text-neutral-400">
        {listeners} listener{listeners !== 1 && "s"}
      </span>
    </div>
  );
}
