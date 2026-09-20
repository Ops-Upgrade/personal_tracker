import { createEncryptedFileStorage } from "@/api/common/encryptedFileStorage";

/**
 * Note-specific image and file storage.
 * Stored under the "notes" R2 prefix.
 */
const storage = createEncryptedFileStorage({
  bucket: "notes",
  folder: "notes",
});

export const uploadNoteImage = storage.upload;
export const downloadNoteImage = storage.download;
export const deleteNoteImage = storage.remove;
