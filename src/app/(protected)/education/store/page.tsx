"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { getSession } from "@/api/auth";
import {
  fetchEducations,
  updateEducation,
  deleteEducation,
  createEducation,
} from "@/api/education";
import { fetchDocuments } from "@/api/common/documents";
import { InputField, TextareaField, SelectField } from "@/components/common/FormField";
import type { EducationPlaintext } from "@/types/education";
import type { Document } from "@/types/document";
import { PRIORITIES, type Priority } from "@/types/taskmanager";
import GlobalStoreView from "@/components/common/store/GlobalStoreView";

/**
 * Education Document Store.
 * Uses GlobalStoreView with education records as parent items.
 *
 * Maintains parity with the old CertificateStoreView:
 * - Clicking a linked cert navigates to the education page to edit the parent
 * - Standalone upload offers inline "create new education" form
 */
export default function EducationStorePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [parentRecords, setParentRecords] = useState<{ id: string; name: string }[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);

  // --- Auth + data loading ---
  useEffect(() => {
    const init = async () => {
      const session = await getSession();
      if (session?.user.id) setUserId(session.user.id);
    };
    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const [edus, docs] = await Promise.all([
        fetchEducations(userId),
        fetchDocuments(userId),
      ]);
      if (!cancelled) {
        setAllDocuments(docs);
        setParentRecords(edus.map((e) => ({ id: e.id, name: e.name })));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const refreshAll = useCallback(async () => {
    if (!userId) return;
    const [edus, docs] = await Promise.all([
      fetchEducations(userId),
      fetchDocuments(userId),
    ]);
    setAllDocuments(docs);
    setParentRecords(edus.map((e) => ({ id: e.id, name: e.name })));
  }, [userId]);

  // --- Action click: linked doc → navigate to education page to edit parent ---
  const handleActionClick = useCallback(
    (docId: string) => {
      const doc = allDocuments.find((d) => d.id === docId);
      if (!doc?.linked_id) return;
      // Navigate to education page with modal query param — EducationView will pick it up
      router.push(`${ROUTES.EDUCATION}?modal=edit-education-${doc.linked_id}`);
    },
    [allDocuments, router],
  );

  // --- Parent CRUD handlers ---
  const handleDeleteParent = useCallback(
    async (parentId: string) => {
      if (!userId) return;
      await deleteEducation(parentId);
      await refreshAll();
    },
    [userId, refreshAll],
  );

  const handleUnlinkFromParent = useCallback(
    async (documentId: string, parentId: string) => {
      if (!userId) return;
      const edus = await fetchEducations(userId);
      const edu = edus.find((e) => e.id === parentId);
      if (edu) {
        const newDocIds = edu.document_ids.filter((id) => id !== documentId);
        await updateEducation(userId, parentId, {
          ...edu, document_ids: newDocIds, updated_at: new Date().toISOString(),
        } as EducationPlaintext);
      }
      await refreshAll();
    },
    [userId, refreshAll],
  );

  const handleBulkLinkToParent = useCallback(
    async (documentIds: string[], parentId: string) => {
      if (!userId) return;
      const edus = await fetchEducations(userId);
      const edu = edus.find((e) => e.id === parentId);
      if (edu) {
        const merged = [...new Set([...edu.document_ids, ...documentIds])];
        await updateEducation(userId, parentId, {
          ...edu, document_ids: merged, updated_at: new Date().toISOString(),
        } as EducationPlaintext);
      }
      await refreshAll();
    },
    [userId, refreshAll],
  );

  // --- Inline education creation form state ---
  const [newEduName, setNewEduName] = useState("");
  const [newEduProvider, setNewEduProvider] = useState("");
  const [newEduPriority, setNewEduPriority] = useState<Priority>("medium");
  const [newEduDueDate, setNewEduDueDate] = useState("");
  const [newEduDescription, setNewEduDescription] = useState("");

  const renderNewRecordForm = useCallback(
    ({ disabled, isSaving }: { disabled: boolean; isSaving: boolean }) => (
      <fieldset disabled={disabled || isSaving} className="space-y-3">
        <InputField label="Course / Certification Name" value={newEduName}
          onChange={setNewEduName} disabled={isSaving || disabled}
          placeholder="e.g. AWS Solutions Architect" />
        <InputField label="Provider" value={newEduProvider}
          onChange={setNewEduProvider} disabled={isSaving || disabled}
          placeholder="Institution or platform" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Priority" value={newEduPriority}
            onChange={(v) => setNewEduPriority(v as Priority)}
            disabled={isSaving || disabled}
            options={PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))} />
          <InputField label="Due Date" type="date" value={newEduDueDate}
            onChange={setNewEduDueDate} disabled={isSaving || disabled} />
        </div>
        <TextareaField label="Description" value={newEduDescription}
          onChange={setNewEduDescription} disabled={isSaving || disabled} rows={2} />
      </fieldset>
    ),
    [newEduName, newEduProvider, newEduPriority, newEduDueDate, newEduDescription],
  );

  const extractNewRecordData = useCallback((): Record<string, string> | null => {
    if (!newEduName.trim()) return null;
    return {
      name: newEduName.trim(), provider: newEduProvider.trim(), priority: newEduPriority,
      due_date: newEduDueDate, description: newEduDescription.trim(),
    };
  }, [newEduName, newEduProvider, newEduPriority, newEduDueDate, newEduDescription]);

  const onCreateParentFromStore = useCallback(
    async (data: Record<string, string>): Promise<string> => {
      if (!userId) throw new Error("No active session.");
      const nowIso = new Date().toISOString();
      const edu = await createEducation(userId, {
        name: data.name || "", provider: data.provider || "",
        priority: (data.priority as Priority) || "medium",
        due_date: data.due_date || null, description: data.description || "",
        is_completed: false, completed_at: null, document_ids: [],
        updated_at: nowIso,
      });
      await refreshAll();
      setNewEduName(""); setNewEduProvider(""); setNewEduPriority("medium");
      setNewEduDueDate(""); setNewEduDescription("");
      return edu.id;
    },
    [userId, refreshAll],
  );

  return (
    <GlobalStoreView
      domain="education"
      title="Certificate Store"
      description="View all uploaded certificates across all your educations."
      backHref={ROUTES.EDUCATION}
      backLabel="← Back to Education"
      parentRecords={parentRecords}
      onDeleteParentRecord={handleDeleteParent}
      onUnlinkFromParent={handleUnlinkFromParent}
      onBulkLinkToParent={handleBulkLinkToParent}
      onActionClick={handleActionClick}
      renderNewRecordForm={renderNewRecordForm}
      extractNewRecordData={extractNewRecordData}
      onCreateParentFromStore={onCreateParentFromStore}
    />
  );
}
