"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/common/Button";
import ImageCropperModal from "@/components/common/ImageCropperModal";
import { Pencil } from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATARS_BUCKET = "avatars";

interface ProfileFormProps {
  /** Current user ID */
  userId: string;
  /** Current display name from user_metadata, if any */
  currentName: string | null;
  /** Current avatar URL from user_metadata, if any */
  currentAvatarUrl: string | null;
  /** Called after profile update succeeds — parent can refresh user data */
  onProfileUpdated: () => void;
}

/**
 * Profile form component.
 *
 * Handles:
 * - Name editing (stored in user_metadata.full_name)
 * - Avatar selection → cropping (via ImageCropperModal) → upload to Supabase Storage
 * - Cache-busting via avatar_updated_at timestamp in user_metadata
 */
export default function ProfileForm({
  userId,
  currentName,
  currentAvatarUrl,
  onProfileUpdated,
}: ProfileFormProps) {
  const supabase = createClient();

  const [name, setName] = useState(currentName ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cropper state
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Validate and open the cropper for a selected file */
  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Unsupported file type. Please use JPEG, PNG, or WebP.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large. Maximum size is 5 MB.");
      return;
    }

    setError(null);
    const url = URL.createObjectURL(file);
    setCropperImage(url);
  }

  /** Called when the cropper finishes — upload the result */
  async function handleCropped(croppedFile: File | null) {
    // Revoke the blob URL
    if (cropperImage) {
      URL.revokeObjectURL(cropperImage);
    }
    setCropperImage(null);

    if (!croppedFile) return; // user cancelled

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Upload to Supabase Storage: avatars/{userId}/avatar.jpg
      const filePath = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(filePath, croppedFile, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      // Update user_metadata with avatar timestamp for cache busting
      const avatarUpdatedAt = new Date().toISOString();
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_updated_at: avatarUpdatedAt },
      });

      if (updateError) throw new Error(updateError.message);

      // Refresh the avatar URL with cache busting
      const { data: urlData } = supabase.storage
        .from(AVATARS_BUCKET)
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        setAvatarUrl(`${urlData.publicUrl}?t=${Date.now()}`);
      }

      setSuccess(true);
      onProfileUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload avatar."
      );
    } finally {
      setSaving(false);
    }
  }

  /** Save the display name */
  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const trimmed = name.trim();
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: trimmed || null },
      });

      if (updateError) throw new Error(updateError.message);

      setSuccess(true);
      onProfileUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update name."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="w-full max-w-md space-y-8">
        {/* Avatar Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Avatar
          </h3>

          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Avatar"
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-700"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-2xl font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {(name || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-zinc-700 text-white transition-colors hover:bg-zinc-900 dark:border-zinc-950 dark:bg-zinc-400 dark:text-zinc-900 dark:hover:bg-zinc-300"
                aria-label="Change avatar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Click the pencil icon to upload a new avatar.
              <br />
              JPEG, PNG, or WebP. Max 5 MB.
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Divider */}
        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Name Section */}
        <form onSubmit={handleSaveName} className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Display Name
          </h3>

          <div className="space-y-2">
            <label
              htmlFor="display-name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={100}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-400/20"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Name"}
          </Button>
        </form>

        {/* Feedback */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
            Profile updated successfully.
          </div>
        )}
      </div>

      {/* Cropper Modal */}
      {cropperImage && (
        <ImageCropperModal
          image={cropperImage}
          onCropComplete={handleCropped}
          onClose={() => {
            if (cropperImage) URL.revokeObjectURL(cropperImage);
            setCropperImage(null);
          }}
        />
      )}
    </>
  );
}
