import { createEncryptedFileStorage } from "@/api/common/encryptedFileStorage";

const storage = createEncryptedFileStorage({
  bucket: "expenses",
  folder: "invoice",
});

export const uploadInvoice = storage.upload;
export const downloadInvoice = storage.download;
export const deleteInvoice = storage.remove;
