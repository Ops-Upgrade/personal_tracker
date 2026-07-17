/**
 * Barrel export for the API service layer.
 * Import as: import { login, logout } from "@/api";
 */
export { login, logout, getSession } from "./auth";
export { fetchUserKeys, upsertUserKeys } from "./auth";
export type { UserKeysRow } from "./auth";
export { fetchTasks, createTask, updateTask, deleteTask } from "./taskmanager";
export { fetchNotes, createNote, updateNote, deleteNote } from "./taskmanager";
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
  renameCollection,
  deleteCollection,
} from "./media";
export {
  searchMedia,
  getDiscoverMedia,
  getMediaDetails,
  getSeasonDetails,
} from "./media";
