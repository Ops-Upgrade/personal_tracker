import { createEncryptedFileStorage } from "@/api/common/encryptedFileStorage";

const storage = createEncryptedFileStorage({
  bucket: "documents",
  folder: "document",
});

export const uploadDocumentFile = storage.upload;
export const downloadDocumentFile = storage.download;
export const deleteDocumentFile = storage.remove;
