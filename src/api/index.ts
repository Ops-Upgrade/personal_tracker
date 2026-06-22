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
