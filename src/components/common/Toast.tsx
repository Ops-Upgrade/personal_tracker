"use client";

type ToastType = "success" | "error";

interface ToastProps {
  isVisible: boolean;
  message: string;
  type?: ToastType;
}

const typeStyles: Record<ToastType, string> = {
  success: "bg-green-600",
  error: "bg-red-600",
};

export type { ToastType };

export default function Toast({
  isVisible,
  message,
  type = "success",
}: ToastProps) {
  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity ${typeStyles[type]}`}
    >
      {message}
    </div>
  );
}
