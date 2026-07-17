"use client";

import { Star } from "lucide-react";

interface StarRatingProps {
  value: number; // 0–5, supports 0.5 increments
  onChange: (value: number) => void;
  max?: number;
  size?: number; // px
}

/**
 * Controlled star rating primitive (0.5–5 range).
 * Click left half of a star → x.5, right half → x.0.
 * Click the same value again to clear.
 */
export default function StarRating({
  value,
  onChange,
  max = 5,
  size = 18,
}: StarRatingProps) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const star = i + 1;
        const full = star <= Math.floor(value);
        const half = !full && star === Math.ceil(value) && value % 1 !== 0;

        return (
          <button
            key={star}
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const leftHalf = x < rect.width / 2;
              const newValue = leftHalf ? star - 0.5 : star;
              // Toggle off if clicking the same value
              onChange(value === newValue ? 0 : newValue);
            }}
            className="relative transition-transform hover:scale-110"
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          >
            {/* Empty star (always rendered as background) */}
            <Star
              size={size}
              className="text-zinc-300 dark:text-zinc-600"
            />

            {/* Filled overlay — full or half */}
            {(full || half) && (
              <Star
                size={size}
                className="fill-amber-400 text-amber-400 absolute inset-0"
                style={
                  half ? { clipPath: "inset(0 50% 0 0)" } : undefined
                }
              />
            )}
          </button>
        );
      })}
    </span>
  );
}
