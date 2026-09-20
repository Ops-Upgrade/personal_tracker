"use client";

import React, { useState, useRef, useCallback } from "react";
import { getStroke } from "perfect-freehand";
import type { InkStroke } from "@/types/notes";
import type { PointerTool } from "./useNotesStore";

interface InkCanvasProps {
  strokes: InkStroke[];
  pointerTool: PointerTool;
  penColor?: string;
  penSize?: number;
  onAddStroke: (stroke: InkStroke) => void;
  onRemoveStroke: (strokeId: string) => void;
  width: number;
  height: number;
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0.toString(), y0.toString(), ((x0 + x1) / 2).toString(), ((y0 + y1) / 2).toString());
      return acc;
    },
    ["M", stroke[0][0].toString(), stroke[0][1].toString(), "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

export default function InkCanvas({
  strokes,
  pointerTool,
  penColor = "#2563eb",
  penSize = 3,
  onAddStroke,
  onRemoveStroke,
  width,
  height,
}: InkCanvasProps) {
  const [currentPoints, setCurrentPoints] = useState<[number, number, number?][] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDrawing = useRef(false);

  const getPageCoords = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): [number, number, number] => {
      if (!svgRef.current) return [e.clientX, e.clientY, e.pressure];
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return [x, y, e.pressure];
    },
    []
  );

  const checkEraserCollision = useCallback(
    (x: number, y: number) => {
      const radius = 16;
      for (const stroke of strokes) {
        for (const pt of stroke.points) {
          const dx = pt[0] - x;
          const dy = pt[1] - y;
          if (dx * dx + dy * dy < radius * radius) {
            onRemoveStroke(stroke.id);
            break;
          }
        }
      }
    },
    [strokes, onRemoveStroke]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (pointerTool === "default") return;
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);

      const [x, y, p] = getPageCoords(e);
      if (pointerTool === "pen") {
        isDrawing.current = true;
        setCurrentPoints([[x, y, p]]);
      } else if (pointerTool === "eraser") {
        isDrawing.current = true;
        checkEraserCollision(x, y);
      }
    },
    [pointerTool, getPageCoords, checkEraserCollision]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing.current || pointerTool === "default") return;
      e.preventDefault();

      const [x, y, p] = getPageCoords(e);
      if (pointerTool === "pen") {
        setCurrentPoints((prev) => (prev ? [...prev, [x, y, p]] : [[x, y, p]]));
      } else if (pointerTool === "eraser") {
        checkEraserCollision(x, y);
      }
    },
    [pointerTool, getPageCoords, checkEraserCollision]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing.current || pointerTool === "default") return;
      e.preventDefault();
      isDrawing.current = false;

      if (pointerTool === "pen" && currentPoints && currentPoints.length > 0) {
        const newStroke: InkStroke = {
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
          points: currentPoints,
          color: penColor,
          size: penSize,
          z: strokes.length + 1,
        };
        onAddStroke(newStroke);
      }
      setCurrentPoints(null);
    },
    [pointerTool, currentPoints, penColor, penSize, strokes.length, onAddStroke]
  );

  const currentStrokeOutline = currentPoints
    ? getStroke(currentPoints, {
        size: penSize * 2,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      })
    : null;

  return (
    <svg
      ref={svgRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: pointerTool === "default" ? "none" : "auto",
        cursor:
          pointerTool === "pen"
            ? "crosshair"
            : pointerTool === "eraser"
            ? "cell"
            : "default",
      }}
      className="absolute inset-0 z-20"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Existing strokes */}
      {strokes.map((stroke) => {
        const outline = getStroke(stroke.points, {
          size: (stroke.size || 3) * 2,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
        });
        const pathData = getSvgPathFromStroke(outline);
        return (
          <path
            key={stroke.id}
            d={pathData}
            fill={stroke.color}
            opacity={0.9}
          />
        );
      })}

      {/* Live active stroke */}
      {currentStrokeOutline && (
        <path
          d={getSvgPathFromStroke(currentStrokeOutline)}
          fill={penColor}
          opacity={0.9}
        />
      )}
    </svg>
  );
}
