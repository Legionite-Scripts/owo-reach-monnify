import { useEffect, useRef, useState } from "react";

// Every named SSE event the backend's /api/events stream can emit
// (see server/routes/events.ts + every `publish(...)` call server-side).
const EVENT_TYPES = [
  "ingestion.started",
  "ingestion.parsed",
  "ingestion.verifying",
  "ingestion.brief",
  "run.created",
  "run.updated",
  "beneficiary.updated",
  "beneficiary.paycode_revealed",
  "beneficiary.nudge_sent",
  "webhook.received",
];

/**
 * Subscribes to the backend's live event wire for the lifetime of the
 * calling component. `onEvent(type, payload)` fires for every event; the
 * hook itself only tracks connection status so pages can show it if useful.
 * A single EventSource per mounted consumer is fine at this scale (per PRD:
 * single-process, single-admin ops console).
 */
export function useLiveEvents(onEvent) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    const bound = EVENT_TYPES.map((type) => {
      const listener = (e) => {
        let payload = {};
        try {
          payload = JSON.parse(e.data);
        } catch {
          /* ignore malformed payloads rather than crash the dashboard */
        }
        handlerRef.current?.(type, payload);
      };
      source.addEventListener(type, listener);
      return [type, listener];
    });

    return () => {
      bound.forEach(([type, listener]) => source.removeEventListener(type, listener));
      source.close();
    };
  }, []);

  return connected;
}
