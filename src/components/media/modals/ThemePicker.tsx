"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import {
  getThemeStyles,
  SPECIAL_THEMES,
  hslToHex,
  hexToHue,
  type ThemeStyles,
} from "@/lib/collectionThemes";

const DEFAULT_COLOR = "#8B5CF6";

interface ThemePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ThemePicker({ value, onChange }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve the current value into styles for the trigger swatch
  const currentTheme = getThemeStyles(value || DEFAULT_COLOR);

  // Derive the hue-slider thumb position from the current value.
  // For "theme:*" keys we extract hue from the theme's solidColor.
  const currentHue = useMemo(() => {
    const solid = getThemeStyles(value || DEFAULT_COLOR).solidColor;
    return hexToHue(solid);
  }, [value]);

  // Local hue position (0-100%) — seeded from current value, updated on drag.
  const [huePercent, setHuePercent] = useState(
    () => (currentHue / 360) * 100,
  );

  // Collapsible premium textures section
  const [texturesOpen, setTexturesOpen] = useState(false);

  // Auto-expand textures when picker opens with a premium theme selected
  useEffect(() => {
    if (open) {
      setTexturesOpen((value || "").startsWith("theme:"));
    }
  }, [open, value]);

  // Keep local position in sync when value changes externally
  useEffect(() => {
    setHuePercent((currentHue / 360) * 100);
  }, [currentHue]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ── Hue slider pointer logic ──

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const rect = sliderRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setHuePercent(pct);
      const hue = (pct / 100) * 360;
      onChange(hslToHex(hue));
    },
    [onChange],
  );

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateFromPointer(e.clientX);

    function onMove(ev: PointerEvent) {
      updateFromPointer(ev.clientX);
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  // ── Special theme selection ──

  function handleSpecialTheme(key: string) {
    onChange(key);
    // Keep the hue slider in sync visually
    const solid = SPECIAL_THEMES[key]?.solidColor;
    if (solid) {
      setHuePercent((hexToHue(solid) / 360) * 100);
    }
  }

  // ── Shared swatch renderer ──

  const MONOCHROME_KEYS = ["theme:monochrome-light", "theme:monochrome-dark"];

  function renderSwatch(key: string, styles: ThemeStyles) {
    const label = key.replace("theme:", "");
    const selected = value === key;

    return (
      <button
        key={key}
        type="button"
        onClick={() => handleSpecialTheme(key)}
        className="group relative flex flex-col items-center gap-1"
        aria-label={label}
      >
        <div
          className={`h-10 w-10 !rounded-full transition-transform hover:scale-110 ${
            selected
              ? "ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-zinc-900"
              : ""
          } ${styles.swatchClass}`}
          style={styles.swatchStyle}
        >
          {selected && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full">
              <Check
                size={14}
                className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
              />
            </span>
          )}
        </div>
        <span className="text-[9px] capitalize text-zinc-400 dark:text-zinc-500">
          {label}
        </span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative h-10 w-10 !rounded-full transition-transform hover:scale-110 ${currentTheme.swatchClass}`}
        style={currentTheme.swatchStyle}
        aria-label="Pick theme color"
      />

      {/* Popover */}
      {open && (
        <div className="absolute left-full top-1/2 -translate-y-[44px] z-50 ml-4 w-72 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {/* ── Hue Slider ── */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Custom Color
          </p>

          <div
            ref={sliderRef}
            onPointerDown={handlePointerDown}
            className="relative h-4 w-full cursor-crosshair rounded touch-none select-none"
            style={{
              background:
                "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
          >
            {/* Upward-pointing triangle thumb (below the track, never clipped) */}
            <div
              className="pointer-events-none absolute top-full mt-1 h-0 w-0"
              style={{
                left: `${huePercent}%`,
                transform: "translateX(-50%)",
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderBottom: "8px solid white",
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
              }}
            />
          </div>

          {/* ── Special Textures (Collapsible) ── */}
          <button
            type="button"
            onClick={() => setTexturesOpen((prev) => !prev)}
            className="mt-6 mb-3 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {texturesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Premium Textures
          </button>

          {texturesOpen && (
            <div className="grid grid-cols-5 gap-y-4 gap-x-2">
              {/* ── Top Row: Monochrome themes evenly spaced, empty cols force row break ── */}
              <div /> {/* col 1 — spacer */}
              <div className="col-start-2 flex justify-center">
                {renderSwatch("theme:monochrome-light", SPECIAL_THEMES["theme:monochrome-light"]!)}
              </div>
              <div /> {/* col 3 — spacer */}
              <div className="col-start-4 flex justify-center">
                {renderSwatch("theme:monochrome-dark", SPECIAL_THEMES["theme:monochrome-dark"]!)}
              </div>
              <div /> {/* col 5 — spacer */}

              {/* ── Main Grid: All other themes ── */}
              {Object.entries(SPECIAL_THEMES)
                .filter(([key]) => !MONOCHROME_KEYS.includes(key))
                .map(([key, styles]) => (
                  <div key={key} className="flex justify-center">
                    {renderSwatch(key, styles)}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
