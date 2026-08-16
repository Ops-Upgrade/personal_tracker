// ── High-Fidelity CSS Theme Engine ──
// Every theme is a handcrafted set of classes & inline styles controlling
// the card container, typography, progress bar, and picker swatch.

import type { CSSProperties } from "react";

export interface ThemeStyles {
  /** Base color for fallbacks and solid-fill contexts. */
  solidColor: string;

  // ── Container ──
  cardClass: string;
  cardStyle: CSSProperties;

  // ── Typography ──
  titleClass: string;
  titleStyle: CSSProperties;
  subtitleClass: string;
  subtitleStyle: CSSProperties;

  // ── Progress Bar ──
  progressTrackClass: string;
  progressTrackStyle: CSSProperties;
  progressFillClass: string;
  progressFillStyle: CSSProperties;

  // ── Theme Picker Swatch ──
  swatchClass: string;
  swatchStyle: CSSProperties;

  // ── Page-Level Background ──
  pageClass?: string;
  pageStyle?: CSSProperties;

  // ── Glass Content Panel (matrix box, etc.) ──
  panelClass?: string;
  panelStyle?: CSSProperties;
}

export const SPECIAL_THEMES: Record<string, ThemeStyles> = {
  // ═══════════════════════════════════════════════════════════════════
  //  ROW 0 — MONOCHROME (dedicated top row in picker)
  // ═══════════════════════════════════════════════════════════════════

  "theme:monochrome-light": {
    solidColor: "#ffffff",
    cardClass: "bg-white border-2 border-black",
    cardStyle: { borderColor: "#000000", backgroundColor: "#ffffff" },
    titleClass: "text-black font-black uppercase tracking-widest",
    titleStyle: { color: "#000000" },
    subtitleClass: "text-zinc-500 font-bold",
    subtitleStyle: {},
    progressTrackClass: "bg-zinc-100 border border-black rounded-none",
    progressTrackStyle: {},
    progressFillClass: "bg-black rounded-none",
    progressFillStyle: {},
    swatchClass: "bg-white border-2 border-black",
    swatchStyle: {},
    pageStyle: {
      backgroundImage:
        "linear-gradient(180deg, rgba(0,0,0,0.04) 0%, transparent 45%)",
    },
    panelClass: "bg-white/90 border-2 border-black",
    panelStyle: {},
  },

  "theme:monochrome-dark": {
    solidColor: "#000000",
    cardClass: "bg-black border-2 border-white",
    cardStyle: { borderColor: "#ffffff", backgroundColor: "#000000" },
    titleClass: "text-white font-black uppercase tracking-widest",
    titleStyle: { color: "#ffffff" },
    subtitleClass: "text-zinc-400 font-bold",
    subtitleStyle: {},
    progressTrackClass: "bg-zinc-900 border border-white rounded-none",
    progressTrackStyle: {},
    progressFillClass: "bg-white rounded-none",
    progressFillStyle: {},
    swatchClass: "bg-black border-2 border-white",
    swatchStyle: {},
    pageStyle: {
      backgroundImage:
        "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 45%)",
    },
    panelClass: "bg-black/90 border-2 border-white",
    panelStyle: {},
  },

  // ═══════════════════════════════════════════════════════════════════
  //  ROW 1 — LUXURY METALS + IRIDESCENT
  // ═══════════════════════════════════════════════════════════════════

  "theme:gold": {
    solidColor: "#D4AF37",
    cardClass: "border border-yellow-600/30",
    cardStyle: {
      background:
        "linear-gradient(135deg, #BF953F 0%, #FCF6BA 30%, #B38728 50%, #FBF5B7 70%, #AA771C 100%)",
      boxShadow:
        "inset 0 1px 2px rgba(255,255,255,0.6), 0 4px 10px rgba(0,0,0,0.15)",
    },
    titleClass: "text-amber-950 font-serif font-bold",
    titleStyle: { textShadow: "1px 1px 0px rgba(255,255,255,0.5)" },
    subtitleClass: "text-amber-900 font-serif font-medium",
    subtitleStyle: {},
    progressTrackClass: "bg-amber-950/20",
    progressTrackStyle: { boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)" },
    progressFillClass: "bg-gradient-to-r from-amber-600 to-yellow-400",
    progressFillStyle: {},
    swatchClass: "border border-yellow-600/40",
    swatchStyle: {
      background:
        "linear-gradient(135deg, #BF953F, #FCF6BA 30%, #B38728 50%, #FBF5B7 70%, #AA771C)",
      boxShadow:
        "inset 0 1px 1px rgba(255,255,255,0.5), 0 0 8px rgba(212,175,55,0.45)",
    },
    pageStyle: {
      backgroundImage:
        "linear-gradient(180deg, rgba(212,175,55,0.18) 0%, transparent 65%)",
      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
      maskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
    },
    panelClass: "backdrop-blur-md border border-amber-500/20",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(255,255,255,0.04) 50%, rgba(180,130,40,0.04) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.2), 0 0 30px rgba(212,175,55,0.1)",
    },
  },

  "theme:silver": {
    solidColor: "#94a3b8",
    cardClass: "border border-slate-400",
    cardStyle: {
      background:
        "linear-gradient(135deg, #f8fafc 0%, #cbd5e1 30%, #94a3b8 50%, #cbd5e1 70%, #f8fafc 100%)",
      boxShadow: "inset 0 1px 2px rgba(255,255,255,0.8)",
    },
    titleClass: "text-slate-700 font-serif font-bold",
    titleStyle: {},
    subtitleClass: "text-slate-700",
    subtitleStyle: {},
    progressTrackClass: "bg-slate-900/10",
    progressTrackStyle: {},
    progressFillClass: "bg-slate-700",
    progressFillStyle: {},
    swatchClass: "border border-slate-400",
    swatchStyle: {
      background:
        "linear-gradient(135deg, #f8fafc, #cbd5e1 30%, #94a3b8 50%, #cbd5e1 70%, #f8fafc)",
      boxShadow:
        "inset 0 1px 1px rgba(255,255,255,0.7), 0 0 6px rgba(148,163,184,0.35)",
    },
    pageStyle: {
      backgroundImage:
        "linear-gradient(180deg, rgba(148,163,184,0.15) 0%, transparent 65%)",
      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
      maskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
    },
    panelClass: "backdrop-blur-md border border-slate-400/20",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(148,163,184,0.05) 0%, rgba(255,255,255,0.04) 50%, rgba(148,163,184,0.03) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.25), 0 0 25px rgba(148,163,184,0.08)",
    },
  },

  "theme:bronze": {
    solidColor: "#b45309",
    cardClass: "border border-amber-900",
    cardStyle: {
      background:
        "linear-gradient(135deg, #fef3c7 0%, #d97706 30%, #92400e 50%, #d97706 70%, #fef3c7 100%)",
      boxShadow: "inset 0 1px 2px rgba(255,255,255,0.4)",
    },
    titleClass: "text-amber-950 font-serif font-bold",
    titleStyle: {},
    subtitleClass: "text-amber-900",
    subtitleStyle: {},
    progressTrackClass: "bg-amber-950/20",
    progressTrackStyle: {},
    progressFillClass: "bg-amber-900",
    progressFillStyle: {},
    swatchClass: "border border-amber-800/50",
    swatchStyle: {
      background:
        "linear-gradient(135deg, #fef3c7, #d97706 30%, #92400e 50%, #d97706 70%, #fef3c7)",
      boxShadow:
        "inset 0 1px 1px rgba(255,255,255,0.4), 0 0 6px rgba(180,83,9,0.4)",
    },
    pageStyle: {
      backgroundImage:
        "linear-gradient(180deg, rgba(180,83,9,0.15) 0%, transparent 65%)",
      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
      maskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
    },
    panelClass: "backdrop-blur-md border border-amber-700/20",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(180,83,9,0.05) 0%, rgba(255,255,255,0.04) 50%, rgba(140,60,5,0.04) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.15), 0 0 25px rgba(180,83,9,0.1)",
    },
  },

  "theme:rose-gold": {
    solidColor: "#fda4af",
    cardClass: "border border-rose-300 shadow-sm",
    cardStyle: {
      background:
        "linear-gradient(135deg, #ffe4e6 0%, #fda4af 30%, #fecdd3 50%, #fda4af 70%, #ffe4e6 100%)",
      boxShadow: "inset 0 1px 2px rgba(255,255,255,0.7)",
    },
    titleClass: "text-rose-900 font-serif",
    titleStyle: {},
    subtitleClass: "text-rose-700",
    subtitleStyle: {},
    progressTrackClass: "bg-rose-900/10",
    progressTrackStyle: {},
    progressFillClass: "bg-rose-700",
    progressFillStyle: {},
    swatchClass: "border border-rose-300",
    swatchStyle: {
      background:
        "linear-gradient(135deg, #ffe4e6, #fda4af 30%, #fecdd3 50%, #fda4af 70%, #ffe4e6)",
      boxShadow:
        "inset 0 1px 1px rgba(255,255,255,0.6), 0 0 6px rgba(253,164,175,0.4)",
    },
    pageStyle: {
      backgroundImage:
        "linear-gradient(180deg, rgba(253,164,175,0.15) 0%, transparent 65%)",
      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
      maskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
    },
    panelClass: "backdrop-blur-md border border-rose-300/20",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(253,164,175,0.06) 0%, rgba(255,255,255,0.05) 50%, rgba(253,180,190,0.04) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.25), 0 0 25px rgba(253,164,175,0.1)",
    },
  },

  "theme:iridescent": {
    solidColor: "#a1c4fd",
    cardClass: "border border-white/30 dark:border-zinc-700/30",
    cardStyle: {
      background:
        "linear-gradient(120deg, #ff9a9e 0%, #fecfef 20%, #a1c4fd 50%, #c2e9fb 80%, #fbc2eb 100%)",
      boxShadow:
        "0 6px 24px rgba(160,190,250,0.25), inset 0 1px 0 rgba(255,255,255,0.5)",
    },
    titleClass: "text-zinc-800 font-semibold",
    titleStyle: { textShadow: "0 1px 1px rgba(255,255,255,0.4)" },
    subtitleClass: "text-zinc-600 font-medium",
    subtitleStyle: {},
    progressTrackClass: "bg-white/30 dark:bg-white/10",
    progressTrackStyle: {},
    progressFillClass:
      "bg-gradient-to-r from-pink-300 via-blue-300 to-purple-300",
    progressFillStyle: {},
    swatchClass: "border border-white/40 rounded-full",
    swatchStyle: {
      background:
        "linear-gradient(120deg, #ff9a9e, #fecfef, #a1c4fd, #c2e9fb, #fbc2eb)",
      boxShadow: "0 0 10px rgba(161,196,253,0.45)",
    },
    pageStyle: {
      backgroundImage:
        "linear-gradient(180deg, rgba(161,196,253,0.14) 0%, rgba(255,154,158,0.08) 35%, transparent 65%)",
      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
      maskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
    },
    panelClass: "backdrop-blur-md border border-white/30",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(255,154,158,0.05) 0%, rgba(161,196,253,0.06) 40%, rgba(194,233,251,0.05) 70%, rgba(251,194,235,0.04) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.2), 0 0 30px rgba(161,196,253,0.12)",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  ROW 2 — GLASS + GEMS + BLOOD MOON
  // ═══════════════════════════════════════════════════════════════════

  "theme:glass": {
    solidColor: "#94a3b8",
    cardClass: "gem-tile",
    cardStyle: {
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.05) 100%)",
      border: "1px solid rgba(255,255,255,0.4)",
      boxShadow: [
        "inset 2px 2px 6px rgba(255,255,255,0.5)",
        "inset -3px -3px 8px rgba(0,0,0,0.15)",
        "0 0 18px rgba(255,255,255,0.15)",
      ].join(", "),
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    },
    titleClass: "text-zinc-900 dark:text-white font-light tracking-wide",
    titleStyle: { textShadow: "0 1px 2px rgba(255,255,255,0.3)" },
    subtitleClass: "text-zinc-700 dark:text-zinc-200",
    subtitleStyle: {},
    progressTrackClass: "bg-black/10 dark:bg-white/10",
    progressTrackStyle: {},
    progressFillClass: "bg-zinc-800 dark:bg-white",
    progressFillStyle: {},
    swatchClass: "border border-white/40",
    swatchStyle: {
      background: "rgba(255,255,255,0.22)",
      backdropFilter: "blur(8px)",
      boxShadow:
        "inset 1px 1px 2px rgba(255,255,255,0.5), inset -1px -1px 2px rgba(0,0,0,0.1), 0 0 10px rgba(255,255,255,0.2)",
    },
    pageStyle: {
      backgroundImage:
        "linear-gradient(110deg, rgba(255,255,255,0.10) 0%, transparent 55%)",
    },
    panelClass: "backdrop-blur-lg border border-white/30",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.03) 100%)",
      boxShadow:
        "inset 2px 2px 6px rgba(255,255,255,0.3), inset -2px -2px 6px rgba(0,0,0,0.08), 0 0 20px rgba(255,255,255,0.1)",
    },
  },

  "theme:amethyst": {
    solidColor: "#a21caf",
    cardClass: "gem-tile",
    cardStyle: {
      background: [
        "linear-gradient(135deg, rgba(200,150,255,0.15) 0%, rgba(120,60,160,0.35) 40%, rgba(60,20,90,0.55) 100%)",
        "linear-gradient(45deg, rgba(180,100,220,0.4), rgba(90,30,120,0.6))",
      ].join(", "),
      border: "1px solid rgba(230,190,255,0.5)",
      boxShadow: [
        "inset 2px 2px 6px rgba(255,255,255,0.35)",
        "inset -4px -4px 10px rgba(30,0,50,0.6)",
        "0 0 24px rgba(160,80,220,0.35)",
      ].join(", "),
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    },
    titleClass: "text-fuchsia-100 font-serif tracking-widest",
    titleStyle: {},
    subtitleClass: "text-fuchsia-300",
    subtitleStyle: {},
    progressTrackClass: "bg-fuchsia-950",
    progressTrackStyle: { boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" },
    progressFillClass: "bg-fuchsia-400",
    progressFillStyle: { boxShadow: "0 0 8px #d946ef" },
    swatchClass: "border border-fuchsia-400/40",
    swatchStyle: {
      background: "linear-gradient(135deg, #a21caf, #4a044e)",
      boxShadow:
        "inset 2px 2px 4px rgba(255,255,255,0.2), inset -2px -2px 4px rgba(0,0,0,0.4), 0 0 10px rgba(162,28,175,0.45)",
    },
    pageStyle: {
      background:
        "conic-gradient(from 160deg at 50% -15%, rgba(162,28,175,0.14) 0deg, rgba(74,4,78,0.08) 90deg, rgba(162,28,175,0.14) 180deg, rgba(74,4,78,0.06) 270deg, rgba(162,28,175,0.14) 360deg)",
      WebkitMaskImage: "radial-gradient(ellipse at top, black 0%, transparent 75%)",
      maskImage: "radial-gradient(ellipse at top, black 0%, transparent 75%)",
    },
    panelClass: "backdrop-blur-md border border-fuchsia-400/25",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(162,28,175,0.08) 0%, rgba(100,20,120,0.06) 50%, rgba(60,10,80,0.04) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.2), 0 0 30px rgba(162,28,175,0.15)",
    },
  },

  "theme:ruby": {
    solidColor: "#be123c",
    cardClass: "gem-tile",
    cardStyle: {
      background: [
        "linear-gradient(135deg, rgba(255,150,150,0.15) 0%, rgba(180,20,40,0.4) 40%, rgba(90,5,15,0.6) 100%)",
        "linear-gradient(45deg, rgba(220,60,80,0.4), rgba(110,10,20,0.6))",
      ].join(", "),
      border: "1px solid rgba(255,190,190,0.5)",
      boxShadow: [
        "inset 2px 2px 6px rgba(255,255,255,0.35)",
        "inset -4px -4px 10px rgba(50,0,5,0.6)",
        "0 0 24px rgba(220,40,60,0.4)",
      ].join(", "),
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    },
    titleClass: "text-rose-100 font-serif tracking-widest",
    titleStyle: {},
    subtitleClass: "text-rose-300",
    subtitleStyle: {},
    progressTrackClass: "bg-rose-950",
    progressTrackStyle: { boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" },
    progressFillClass: "bg-rose-400",
    progressFillStyle: { boxShadow: "0 0 8px #fb7185" },
    swatchClass: "border border-rose-400/40",
    swatchStyle: {
      background: "linear-gradient(135deg, #be123c, #4c0519)",
      boxShadow:
        "inset 2px 2px 4px rgba(255,255,255,0.2), inset -2px -2px 4px rgba(0,0,0,0.4), 0 0 10px rgba(190,18,60,0.45)",
    },
    pageStyle: {
      background:
        "conic-gradient(from 40deg at 50% -15%, rgba(190,18,60,0.14) 0deg, rgba(76,5,25,0.08) 90deg, rgba(190,18,60,0.14) 180deg, rgba(76,5,25,0.06) 270deg, rgba(190,18,60,0.14) 360deg)",
      WebkitMaskImage: "radial-gradient(ellipse at top, black 0%, transparent 75%)",
      maskImage: "radial-gradient(ellipse at top, black 0%, transparent 75%)",
    },
    panelClass: "backdrop-blur-md border border-rose-400/25",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(190,18,60,0.08) 0%, rgba(110,10,20,0.06) 50%, rgba(70,5,10,0.04) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.2), 0 0 30px rgba(190,18,60,0.18)",
    },
  },

  "theme:first-crush": {
    solidColor: "#c084fc",
    cardClass: "border border-purple-200/60 shadow-sm",
    cardStyle: {
      backgroundImage: [
        "radial-gradient(circle at 20% 25%, #fbcfe8 0%, transparent 55%)",
        "radial-gradient(circle at 80% 15%, #bfdbfe 0%, transparent 55%)",
        "radial-gradient(circle at 45% 80%, #e9d5ff 0%, transparent 55%)",
        "linear-gradient(to bottom, #fdf4ff, #fef9c3)",
      ].join(", "),
    },
    titleClass: "text-purple-700 font-light",
    titleStyle: {},
    subtitleClass: "text-purple-400",
    subtitleStyle: {},
    progressTrackClass: "bg-purple-200",
    progressTrackStyle: {},
    progressFillClass: "bg-purple-400",
    progressFillStyle: {},
    swatchClass: "border border-purple-200/60",
    swatchStyle: {
      background: "radial-gradient(circle at 30% 30%, #fbcfe8, #e9d5ff 60%, #fdf4ff)",
      boxShadow: "0 0 8px rgba(192,132,252,0.35)",
    },
    pageStyle: {
      backgroundImage: [
        "radial-gradient(circle at 20% 10%, rgba(251,207,232,0.18) 0%, transparent 45%)",
        "radial-gradient(circle at 80% 5%, rgba(191,219,254,0.14) 0%, transparent 45%)",
        "radial-gradient(circle at 50% 15%, rgba(233,213,255,0.16) 0%, transparent 50%)",
      ].join(", "),
      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
      maskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
    },
    panelClass: "backdrop-blur-md border border-purple-200/25",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(251,207,232,0.06) 0%, rgba(191,219,254,0.05) 30%, rgba(233,213,255,0.06) 60%, rgba(255,255,255,0.04) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.2), 0 0 30px rgba(192,132,252,0.12)",
    },
  },

  "theme:blood-moon": {
    solidColor: "#991b1b",
    cardClass: "border border-red-950",
    cardStyle: {
      background:
        "radial-gradient(circle at 75% 18%, #991b1b 0%, #450a0a 30%, #000000 80%)",
    },
    titleClass: "text-red-500 font-serif tracking-widest",
    titleStyle: { textShadow: "0 0 6px rgba(153,27,27,0.5)" },
    subtitleClass: "text-red-900",
    subtitleStyle: {},
    progressTrackClass: "bg-zinc-900",
    progressTrackStyle: {},
    progressFillClass: "bg-red-700",
    progressFillStyle: { boxShadow: "0 0 8px #991b1b" },
    swatchClass: "border border-red-900/60",
    swatchStyle: {
      background: "radial-gradient(circle at 75% 18%, #991b1b, #000000 80%)",
      boxShadow: "0 0 8px rgba(153,27,27,0.45)",
    },
    pageStyle: {
      background:
        "radial-gradient(circle at 75% 5%, rgba(153,27,27,0.18) 0%, transparent 55%)",
      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 65%)",
      maskImage: "linear-gradient(to bottom, black 0%, transparent 65%)",
    },
    panelClass: "backdrop-blur-md border border-red-800/25",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(153,27,27,0.06) 0%, rgba(80,10,10,0.04) 50%, rgba(0,0,0,0.05) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.08), 0 0 30px rgba(153,27,27,0.15)",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  //  ROW 3 — ORGANIC ASSETS + SCI-FI
  // ═══════════════════════════════════════════════════════════════════

  "theme:galaxy": {
    solidColor: "#a855f7",
    cardClass: "overflow-hidden",
    cardStyle: {
      backgroundImage:
        "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/images/galaxy.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      boxShadow: "inset 0 0 80px rgba(0,0,0,0.5)",
    },
    titleClass: "text-white font-light tracking-widest",
    titleStyle: { textShadow: "0 0 15px rgba(255,255,255,0.8)" },
    subtitleClass: "text-purple-200",
    subtitleStyle: {},
    progressTrackClass: "bg-white/10",
    progressTrackStyle: {},
    progressFillClass: "bg-purple-400",
    progressFillStyle: { boxShadow: "0 0 12px #c084fc" },
    swatchClass: "border border-purple-500/40",
    swatchStyle: {
      background: "radial-gradient(circle at 30% 30%, #a855f7, #1e1b4b 60%, #000000)",
      boxShadow: "0 0 10px rgba(168,85,247,0.5)",
    },
    pageStyle: {
      backgroundImage: "url('/images/galaxy.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "top center",
      WebkitMaskImage: "radial-gradient(ellipse at top, rgba(0,0,0,0.45) 0%, transparent 70%)",
      maskImage: "radial-gradient(ellipse at top, rgba(0,0,0,0.45) 0%, transparent 70%)",
    },
    panelClass: "backdrop-blur-md border border-purple-500/20",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(30,10,60,0.15) 0%, rgba(10,5,30,0.12) 50%, rgba(5,2,20,0.1) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.06), 0 0 30px rgba(168,85,247,0.12)",
    },
  },

  "theme:magma": {
    solidColor: "#ea580c",
    cardClass: "border-b-4 border-orange-600 overflow-hidden",
    cardStyle: {
      backgroundImage:
        "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/images/magma.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    titleClass: "text-white font-black uppercase tracking-wider",
    titleStyle: { textShadow: "0 0 10px #ea580c" },
    subtitleClass: "text-orange-200 font-bold",
    subtitleStyle: {},
    progressTrackClass: "bg-red-950/60",
    progressTrackStyle: {},
    progressFillClass: "bg-gradient-to-r from-red-600 to-yellow-500",
    progressFillStyle: { boxShadow: "0 0 10px #f59e0b" },
    swatchClass: "border border-orange-600/50",
    swatchStyle: {
      background: "linear-gradient(to top, #450a0a, #dc2626, #ea580c)",
      boxShadow: "0 0 10px rgba(234,88,12,0.5)",
    },
    pageStyle: {
      backgroundImage: "url('/images/magma.png')",
      backgroundSize: "cover",
      backgroundPosition: "top center",
      WebkitMaskImage: "radial-gradient(ellipse at top, rgba(0,0,0,0.45) 0%, transparent 70%)",
      maskImage: "radial-gradient(ellipse at top, rgba(0,0,0,0.45) 0%, transparent 70%)",
    },
    panelClass: "backdrop-blur-md border border-orange-600/20",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(60,10,5,0.15) 0%, rgba(30,5,2,0.12) 50%, rgba(10,2,1,0.1) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.05), 0 0 25px rgba(234,88,12,0.15)",
    },
  },

  "theme:abyss": {
    solidColor: "#0284c7",
    cardClass: "overflow-hidden",
    cardStyle: {
      backgroundImage:
        "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/images/abyss.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    titleClass: "text-cyan-100 font-serif",
    titleStyle: { textShadow: "0 2px 8px rgba(0,0,0,0.8)" },
    subtitleClass: "text-cyan-300",
    subtitleStyle: {},
    progressTrackClass: "bg-slate-900/50",
    progressTrackStyle: {},
    progressFillClass: "bg-cyan-400",
    progressFillStyle: { boxShadow: "0 0 12px #22d3ee" },
    swatchClass: "border border-cyan-500/40",
    swatchStyle: {
      background: "radial-gradient(circle at 50% 80%, #0284c7, #020617 80%)",
      boxShadow: "0 0 10px rgba(2,132,199,0.5)",
    },
    pageStyle: {
      backgroundImage: "url('/images/abyss.png')",
      backgroundSize: "cover",
      backgroundPosition: "top center",
      WebkitMaskImage: "radial-gradient(ellipse at top, rgba(0,0,0,0.45) 0%, transparent 70%)",
      maskImage: "radial-gradient(ellipse at top, rgba(0,0,0,0.45) 0%, transparent 70%)",
    },
    panelClass: "backdrop-blur-md border border-cyan-500/20",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(2,20,40,0.15) 0%, rgba(2,10,30,0.12) 50%, rgba(2,5,20,0.1) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(255,255,255,0.05), 0 0 25px rgba(2,132,199,0.15)",
    },
  },

  "theme:cyberpunk": {
    solidColor: "#00f0ff",
    cardClass: "border-4 border-pink-600 bg-zinc-950 font-mono rounded-none",
    cardStyle: {
      boxShadow:
        "6px 6px 0 #06b6d4, 0 0 20px rgba(219,39,119,0.4), inset 0 0 20px rgba(0,240,255,0.12)",
      backgroundImage: [
        "repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,240,255,0.08) 5px, rgba(0,240,255,0.08) 6px)",
        "repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(0,240,255,0.08) 5px, rgba(0,240,255,0.08) 6px)",
        "linear-gradient(to bottom, #09090b, #0f0f10)",
      ].join(", "),
    },
    titleClass: "text-cyan-400 uppercase tracking-widest font-black",
    titleStyle: { textShadow: "0 0 8px rgba(0,240,255,0.8)" },
    subtitleClass: "text-pink-500 uppercase font-bold text-[10px]",
    subtitleStyle: {},
    progressTrackClass: "bg-zinc-900 border border-pink-600/50 rounded-none",
    progressTrackStyle: {},
    progressFillClass: "bg-cyan-400 rounded-none",
    progressFillStyle: { boxShadow: "0 0 10px rgba(0,240,255,0.8)" },
    swatchClass: "border-2 border-pink-600 rounded-none",
    swatchStyle: {
      background: "#09090b",
      boxShadow: "0 0 12px #db2777, 0 0 4px #06b6d4",
    },
    pageStyle: {
      backgroundImage: [
        "repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,240,255,0.07) 5px, rgba(0,240,255,0.07) 6px)",
        "repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(0,240,255,0.07) 5px, rgba(0,240,255,0.07) 6px)",
      ].join(", "),
      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 65%)",
      maskImage: "linear-gradient(to bottom, black 0%, transparent 65%)",
    },
    panelClass: "backdrop-blur-md border-2 border-pink-600/30 !rounded-none",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(15,15,20,0.15) 50%, rgba(0,0,0,0.2) 100%)",
      boxShadow:
        "0 0 20px rgba(0,240,255,0.08), 0 0 5px rgba(219,39,119,0.1)",
    },
  },

  "theme:matrix": {
    solidColor: "#00ff00",
    cardClass: "bg-black border border-green-500/40 font-mono rounded-sm overflow-hidden",
    cardStyle: {
      backgroundImage:
        "repeating-linear-gradient(180deg, rgba(0,0,0,0) 0, rgba(0,255,0,0.08) 10px, rgba(0,0,0,1) 10px, rgba(0,0,0,1) 20px), linear-gradient(to bottom, #001100, #000000)",
      animation: "matrix-rain 2.5s linear infinite",
    },
    titleClass: "text-green-400 font-bold tracking-widest",
    titleStyle: { textShadow: "0 0 8px rgba(0,255,0,0.8)" },
    subtitleClass: "text-green-700 font-bold",
    subtitleStyle: {},
    progressTrackClass: "bg-black border border-green-900 rounded-sm",
    progressTrackStyle: {},
    progressFillClass: "bg-green-500 rounded-sm",
    progressFillStyle: { boxShadow: "0 0 10px #00ff00" },
    swatchClass: "border border-green-500/40 rounded-sm",
    swatchStyle: {
      background: "linear-gradient(to bottom, #001a00, #000000)",
      boxShadow: "0 0 8px rgba(0,255,0,0.4)",
    },
    pageStyle: {
      backgroundImage:
        "repeating-linear-gradient(180deg, rgba(0,0,0,0) 0, rgba(0,255,0,0.05) 10px, rgba(0,0,0,1) 10px, rgba(0,0,0,1) 20px)",
      animation: "matrix-rain 4s linear infinite",
      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 60%)",
      maskImage: "linear-gradient(to bottom, black 0%, transparent 60%)",
    },
    panelClass: "backdrop-blur-md border border-green-500/30 !rounded-sm",
    panelStyle: {
      background:
        "linear-gradient(135deg, rgba(0,20,0,0.25) 0%, rgba(0,10,0,0.2) 50%, rgba(0,5,0,0.15) 100%)",
      boxShadow:
        "inset 1px 1px 3px rgba(0,255,0,0.05), 0 0 20px rgba(0,255,0,0.08)",
    },
  },
};

// ── Helpers ──

/**
 * Resolve a database color value into full ThemeStyles.
 *
 * - `"theme:gold"` etc. → looks up SPECIAL_THEMES (falls back to gold).
 * - Plain hex (`"#8B5CF6"`) → auto-generates a safe solid-color theme.
 */
export function getThemeStyles(dbColorValue: string): ThemeStyles {
  // Special named theme
  if (dbColorValue && dbColorValue.startsWith("theme:")) {
    return (
      SPECIAL_THEMES[dbColorValue] ?? SPECIAL_THEMES["theme:gold"]!
    );
  }

  // Solid hex fallback (also handles empty/falsy values)
  const hex = dbColorValue || "#8B5CF6";

  return {
    solidColor: hex,
    cardClass: "border-2 transition-transform",
    cardStyle: {
      borderColor: hex,
      backgroundColor: `${hex}15`,
    },
    titleClass: "font-bold",
    titleStyle: { color: hex },
    subtitleClass: "",
    subtitleStyle: { color: hex, opacity: 0.7 },
    progressTrackClass: "bg-black/10 dark:bg-white/10",
    progressTrackStyle: {},
    progressFillClass: "",
    progressFillStyle: { backgroundColor: hex },
    swatchClass: "border border-zinc-200 dark:border-zinc-700",
    swatchStyle: { backgroundColor: hex },
    pageStyle: {
      backgroundImage: `linear-gradient(180deg, ${hex}20 0%, transparent 50%)`,
    },
  };
}
