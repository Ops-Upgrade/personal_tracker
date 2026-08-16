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
      className={`fixed bottom-32 right-6 z-[100] rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity md:bottom-8 ${typeStyles[type]}`}
    >
      {message}
    </div>
  );
}
