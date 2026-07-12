"use client";

import { useState, useCallback, useRef } from "react";
import Cropper, { type Area } from "react-easy-crop";
import ModalFrame from "@/components/common/ModalFrame";
import Button from "@/components/common/Button";

interface ImageCropperModalProps {
  /** The source image to crop (File, Blob, or URL string) */
  image: string;
  /** Called with the cropped image as a File, or null if cancelled */
  onCropComplete: (croppedFile: File | null) => void;
  /** Called when the modal is dismissed without cropping */
  onClose: () => void;
}

/**
 * Creates a File from a cropped area of an image.
 * Renders the image onto an offscreen canvas at the cropped region,
 * then exports it as a square JPEG File.
 */
async function getCroppedFile(
  imageSrc: string,
  pixelCrop: Area
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2d context");

  // Output a square at the cropped size
  const size = Math.min(pixelCrop.width, pixelCrop.height);
  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas toBlob returned null"));
        return;
      }
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      resolve(file);
    }, "image/jpeg");
  });
}

/**
 * Helper: loads an image from a URL into an HTMLImageElement.
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = url;
  });
}

/**
 * Modal wrapping react-easy-crop for 1:1 image cropping.
 * Reusable — pass any image source and get back a cropped square File.
 */
export default function ImageCropperModal({
  image,
  onCropComplete,
  onClose,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
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
      const file = await getCroppedFile(image, cropAreaRef.current);
      onCropComplete(file);
    } catch {
      onCropComplete(null);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    onCropComplete(null);
  }

  return (
    <ModalFrame title="Crop Image" onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="space-y-4">
        {/* Cropper area */}
        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-zinc-900">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-zinc-300 accent-zinc-600 dark:bg-zinc-700 dark:accent-zinc-400"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
