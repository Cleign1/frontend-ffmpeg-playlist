import { getSocket } from "./socket";

/**
 * Socket event names for graphical crossfade interactions.
 * These helpers are intentionally lightweight and can be consumed by any UI
 * (e.g., a graphical crossfade editor or modal) without duplicating socket logic.
 */
const EVENTS = {
  GRAPHICAL_UPDATE: "crossfade:graphical:update",
  GRAPHICAL_STATE: "crossfade:graphical:state",
  GRAPHICAL_REQUEST: "crossfade:graphical:get",
  CROSSFADE_ENABLE: "crossfade_enable",
  CROSSFADE_SET: "crossfade_set",
  CROSSFADE_PRESET: "crossfade_preset",
};

/**
 * Emit a full graphical crossfade configuration to the backend.
 * @param {Object} payload
 * @param {Array} payload.layers - Timeline layers with timing + envelope info.
 * @param {number} [payload.lockBufferSeconds] - Optional lock buffer guardrail.
 * @param {number} [payload.playheadSeconds] - Optional reference playhead.
 * @param {Function} [ack] - Optional ack callback from the server.
 */
export function emitGraphicalCrossfadeUpdate(payload, ack) {
  const socket = getSocket();
  socket.emit(EVENTS.GRAPHICAL_UPDATE, payload, ack);
}

/**
 * Request the current graphical crossfade state from the backend.
 * @param {Function} [ack] - Optional ack callback receiving the state.
 */
export function requestGraphicalCrossfadeState(ack) {
  const socket = getSocket();
  socket.emit(EVENTS.GRAPHICAL_REQUEST, {}, ack);
}

/**
 * Subscribe to graphical crossfade state updates.
 * @param {(state: any) => void} handler
 * @returns {() => void} unsubscribe function
 */
export function onGraphicalCrossfadeState(handler) {
  const socket = getSocket();
  socket.on(EVENTS.GRAPHICAL_STATE, handler);
  return () => socket.off(EVENTS.GRAPHICAL_STATE, handler);
}

/**
 * Toggle the crossfade engine (same flag used by the slider panel).
 * @param {boolean} enabled
 * @param {Function} [ack]
 */
export function setCrossfadeEnabled(enabled, ack) {
  const socket = getSocket();
  socket.emit(EVENTS.CROSSFADE_ENABLE, !!enabled, ack);
}

/**
 * Apply a standard crossfade preset (soft | normal | aggressive).
 * @param {"soft"|"normal"|"aggressive"} preset
 * @param {Function} [ack]
 */
export function applyCrossfadePreset(preset, ack) {
  const socket = getSocket();
  socket.emit(EVENTS.CROSSFADE_PRESET, preset, ack);
}

/**
 * Patch timing-oriented crossfade fields (mirrors the existing slider controls).
 * @param {Object} patch - e.g., { fadeInMs, fadeOutMs, preloadMs, overlapMs }
 * @param {Function} [ack]
 */
export function patchCrossfadeTiming(patch, ack) {
  const socket = getSocket();
  socket.emit(EVENTS.CROSSFADE_SET, patch, ack);
}
