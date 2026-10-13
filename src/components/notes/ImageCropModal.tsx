"use client";

import { useState, useCallback, useRef } from "react";
import Cropper, { type Area } from "react-easy-crop";
import ModalFrame from "@/components/common/ModalFrame";
import Button from "@/components/common/Button";

interface ImageCropModalProps {
  image: string;
  onCropComplete: (croppedFile: File, width: number, height: number) => void;
  onClose: () => void;
}

/**
 * Creates a File and dimensions from a cropped area of an image.
 */
async function getCroppedFile(
  imageSrc: string,
  pixelCrop: Area
): Promise<{ file: File; width: number; height: number }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2d context");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas toBlob returned null"));
        return;
      }
      const file = new File([blob], "cropped-image.png", { type: "image/png" });
      resolve({ file, width: pixelCrop.width, height: pixelCrop.height });
    }, "image/png");
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = url;
  });
}

const ASPECT_RATIOS = [
  { label: "Freeform", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:2", value: 3 / 2 },
];

export default function ImageCropModal({
  image,
  onCropComplete,
  onClose,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectedAspect, setSelectedAspect] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const cropAreaRef = useRef<Area | null>(null);

  const onCropCompleteHandler = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      cropAreaRef.current = croppedAreaPixels;
    },
    []
  );

  async function handleSave() {
    if (!cropAreaRef.current) return;
    setLoading(true);
    try {
      const { file, width, height } = await getCroppedFile(
        image,
        cropAreaRef.current
      );
      onCropComplete(file, width, height);
    } catch (err) {
      console.error("Failed to crop image:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalFrame title="Crop Canvas Image" onClose={onClose} maxWidthClassName="max-w-2xl">
      <div className="space-y-4">
        {/* Cropper Viewport */}
        <div className="relative h-80 w-full overflow-hidden rounded-lg bg-zinc-950">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={selectedAspect}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
          />
        </div>

        {/* Aspect Ratio Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Aspect:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_RATIOS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setSelectedAspect(item.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedAspect === item.value
                    ? "bg-blue-600 text-white"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom Slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-zinc-300 accent-blue-600 dark:bg-zinc-700 dark:accent-blue-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "Apply Crop"}
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
