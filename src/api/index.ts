/**
 * Barrel export for the API service layer.
 * Import as: import { login, logout } from "@/api";
 */
export { login, logout, getSession } from "./auth";
export { fetchUserKeys, insertUserKeys, upsertUserKeys } from "./auth";
export type { UserKeysRow } from "./auth";
export { fetchTasks, createTask, updateTask, deleteTask } from "./taskmanager";
export { fetchExpenses, createExpense, updateExpense, deleteExpense } from "./expense";
export { fetchEducations, createEducation, updateEducation, deleteEducation } from "./education";
export {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  fetchDocumentsByDomain,
} from "./common/documents";
export {
  uploadDocumentFile,
  downloadDocumentFile,
  deleteDocumentFile,
} from "./common/documentStorage";
export {
  fetchMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
} from "./medical";
export {
  listMedia,
  createMedia,
  updateMedia,
  deleteMedia,
  findDuplicate,
  unlinkFromCollection,
  formatEpisodeKey,
  computeShowStatus,
} from "./media";
export {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from "./media";
export {
  searchMedia,
  getDiscoverMedia,
  getMediaDetails,
  getSeasonDetails,
} from "./media";
export {
  uploadNoteImage,
  downloadNoteImage,
  deleteNoteImage,
  fetchNotebooks,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  reorderNotebooks,
  fetchSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  fetchPages,
  createPage,
  updatePageMeta,
  deletePage,
  reorderPages,
  gcPageImages,
  getPageContent,
  savePageContent,
  RevisionConflictError,
} from "./notes";
