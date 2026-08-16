"use client";

import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import {
  getThemeStyles,
  SPECIAL_THEMES,
  type ThemeStyles,
} from "@/lib/collectionThemes";

const DEFAULT_COLOR = "#8B5CF6";

/**
 * Convert a hex color to HSV Saturation (0-100) and Value (0-100),
 * matching the axes of the 2D picker (S: left→right, V: top→bottom).
 * Unparseable input returns { s: 0, v: 0 } (the top-left corner).
 */
function hexToHSV(hex: string) {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) return { s: 0, v: 0 };

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max * 100;
  const s = max === 0 ? 0 : ((max - min) / max) * 100;
  return { s, v };
}

interface ThemePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ThemePicker({ value, onChange }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve the current value into styles for the trigger swatch.
  // `solidColor` is always a plain hex, even for "theme:*" values.
  const currentTheme = getThemeStyles(value || DEFAULT_COLOR);

  // Popover tab: "custom" (2D picker) or "premium" (theme grid).
  // Default to premium when the current value is a special theme.
  const [activeTab, setActiveTab] = useState<"custom" | "premium">(() =>
    (value || "").startsWith("theme:") ? "premium" : "custom",
  );

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

  // ── Custom color change (contrast guard) ──

  // Snap low-contrast picks to the premium monochrome themes so text and
  // controls stay visible against the page background.
  function handleColorChange(newHex: string) {
    const { s, v } = hexToHSV(newHex);

    // Bottom area (dark gray / black) works perfectly
    if (v < 15) {
      onChange("theme:monochrome-dark");
      return;
    }

    // Upper-left arc (white / light grays)
    // Calculate distance from top-left corner (S=0, V=100)
    const distFromTopLeft = Math.sqrt(Math.pow(s, 2) + Math.pow(100 - v, 2));
    if (distFromTopLeft < 20) {
      onChange("theme:monochrome-light");
      return;
    }

    onChange(newHex);
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
        onClick={() => onChange(key)}
        className="group relative flex flex-col items-center gap-1"
        aria-label={label}
      >
        <div
          className={`h-8 w-8 sm:h-10 sm:w-10 !rounded-full transition-transform hover:scale-110 ${
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
        onClick={() => setOpen(!open)}
        className={`relative h-10 w-10 !rounded-full transition-transform hover:scale-110 ${currentTheme.swatchClass}`}
        style={currentTheme.swatchStyle}
        aria-label="Pick theme color"
      />

      {/* Popover */}
      {open && (
        <div className="absolute left-1/2 top-full mt-4 -translate-x-1/2 sm:mt-0 sm:left-full sm:top-1/2 sm:translate-x-0 sm:-translate-y-[44px] z-50 sm:ml-4 w-64 sm:w-72 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {/* ── Tab switcher ── */}
          <div className="mb-4 flex gap-4 border-b border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={`pb-2 text-xs font-bold uppercase tracking-wider ${
                activeTab === "custom"
                  ? "border-b-2 border-violet-500 text-violet-500"
                  : "text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Custom
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("premium")}
              className={`pb-2 text-xs font-bold uppercase tracking-wider ${
                activeTab === "premium"
                  ? "border-b-2 border-violet-500 text-violet-500"
                  : "text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Premium
            </button>
          </div>

          {/* ── Custom tab: 2D picker + hex input ── */}
          {activeTab === "custom" && (
            <div className="space-y-3">
              <HexColorPicker
                color={currentTheme.solidColor}
                onChange={handleColorChange}
                style={{ width: "100%" }}
              />

              <div className="flex items-center gap-2">
                <HexColorInput
                  color={currentTheme.solidColor}
                  onChange={handleColorChange}
                  prefixed
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 outline-none transition-colors focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                />
              </div>
            </div>
          )}

          {/* ── Premium tab: special themes grid ── */}
          {activeTab === "premium" && (
            <div className="grid grid-cols-5 gap-y-2 gap-x-1 sm:gap-y-4 sm:gap-x-2 max-h-[45vh] overflow-y-auto overscroll-contain sm:max-h-none sm:overflow-auto">
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
