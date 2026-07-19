import { createContext, useCallback, useContext, useState } from "react";
import Icon from "../components/Icon.jsx";

const ToastContext = createContext(null);

let uid = 0;

const ICONS = { success: "check", error: "error", info: "info" };
const COLORS = {
  success: { border: "border-reach", icon: "text-reach" },
  error: { border: "border-state-failed", icon: "text-state-failed" },
  info: { border: "border-hairline", icon: "text-brass" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, { type = "info", duration } = {}) => {
      const id = ++uid;
      setToasts((t) => [...t, { id, message, type }]);
      const ttl = duration ?? (type === "error" ? 7000 : 4500);
      if (ttl) setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (message, opts) => push(message, { ...opts, type: "success" }),
    error: (message, opts) => push(message, { ...opts, type: "error" }),
    info: (message, opts) => push(message, { ...opts, type: "info" }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-2.5rem))] pointer-events-none">
        {toasts.map((t) => {
          const c = COLORS[t.type] ?? COLORS.info;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto border ${c.border} bg-white shadow-instrument px-4 py-3 flex items-start gap-3 animate-settle`}
              role="status"
            >
              <Icon name={ICONS[t.type] ?? "info"} size={18} className={`${c.icon} mt-0.5`} />
              <p className="text-[13px] text-ink flex-1 leading-snug">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="text-ink-soft hover:text-ink shrink-0 -mt-0.5"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
