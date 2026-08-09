import type { ReactNode } from "react";

interface OverlayActionButtonProps {
  /** Click handler. */
  onClick: (e: React.MouseEvent) => void;
  /** Accessible title for the button. */
  title: string;
  /** Icon or label inside the button. */
  children: ReactNode;
  /** Additional class names for hover state colour, etc. */
  className?: string;
}

/**
 * Frosted-glass overlay action button — used for delete / download /
 * unlink icons that appear on hover over tile thumbnails.
 *
 * Extracted from the repeated `bg-white/20 text-white backdrop-blur-sm`
 * pattern in TileView.
 */
export default function OverlayActionButton({
  onClick,
  title,
  children,
  className = "",
}: OverlayActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md bg-white/20 text-white backdrop-blur-sm transition-colors ${className}`}
      title={title}
    >
      {children}
    </button>
  );
}
