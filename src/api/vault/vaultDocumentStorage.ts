import { createEncryptedFileStorage } from "@/api/common/encryptedFileStorage";

/**
 * Vault-specific document file storage.
 * All vault files are stored under the "vault" R2 prefix.
 */
const vaultStorage = createEncryptedFileStorage({
  bucket: "vault",
  folder: "vault",
});

export const uploadVaultDocument = vaultStorage.upload;
export const downloadVaultDocument = vaultStorage.download;
export const deleteVaultDocument = vaultStorage.remove;
