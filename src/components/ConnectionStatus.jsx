export default function ConnectionStatus({ connected }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          connected ? "bg-green-500 animate-pulse" : "bg-red-500"
        }`}
      />
      <span
        className={`text-sm font-medium ${
          connected ? "text-green-400" : "text-red-400"
        }`}
      >
        {connected ? "Backend Connected" : "Backend Disconnected"}
      </span>
    </div>
  );
}
