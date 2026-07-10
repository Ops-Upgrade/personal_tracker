import { createEncryptedFileStorage } from "@/api/common/encryptedFileStorage";

const storage = createEncryptedFileStorage({
  bucket: "certificates",
  folder: "certificate",
});

export const uploadCertificateFile = storage.upload;
export const downloadCertificateFile = storage.download;
export const deleteCertificateFile = storage.remove;