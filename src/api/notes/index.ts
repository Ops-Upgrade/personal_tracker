/**
 * Barrel export for the Notes domain API layer.
 */
export {
  uploadNoteImage,
  downloadNoteImage,
  deleteNoteImage,
} from "./noteStorage";

export {
  fetchNotebooks,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  reorderNotebooks,
} from "./notebooks";

export {
  fetchSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from "./sections";

export {
  fetchPages,
  createPage,
  updatePageMeta,
  deletePage,
  reorderPages,
  gcPageImages,
} from "./pages";

export {
  getPageContent,
  savePageContent,
  RevisionConflictError,
} from "./pageContent";
