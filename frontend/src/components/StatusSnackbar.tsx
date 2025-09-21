import { useEffect } from "react";

export type StatusSnackbarProps = {
  open: boolean;
  message: string;
  severity?: "success" | "info" | "warning" | "error";
  onClose: () => void;
};

export default function StatusSnackbar({
  open,
  message,
  severity = "info",
  onClose,
}: StatusSnackbarProps) {
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [open, onClose]);

  if (!open) return null;

  const severityStyles = {
    success: "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    info: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    error: "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  };

  const icons = {
    success: "✓",
    info: "ℹ",
    warning: "⚠",
    error: "✕",
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={`
          flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
          ${severityStyles[severity]}
          min-w-[300px] max-w-[500px]
        `}
      >
        <span className="text-xl">{icons[severity]}</span>
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="ml-4 text-xl hover:opacity-70 transition-opacity"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}