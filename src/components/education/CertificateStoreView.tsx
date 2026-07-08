"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSession } from "@/api/auth";
import { fetchCertificates, fetchEducations, downloadCertificateFile, deleteCertificateFile, deleteCertificate, updateEducation, updateCertificate, uploadCertificateFile, createCertificate } from "@/api/education";
import type { Certificate, CertificatePlaintext, Education, EducationPlaintext } from "@/types/education";
import TileView, { DocumentTile } from "@/components/common/TileView";
import CertificateModal from "./CertificateModal";

export default function CertificateStoreView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [educations, setEducations] = useState<Education[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
  const [isAddingCertificate, setIsAddingCertificate] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) {
        window.location.href = "/auth/login";
        return;
      }
      setUserId(session.user.id);
      
      const [certs, edus] = await Promise.all([
        fetchCertificates(session.user.id),
        fetchEducations(session.user.id)
      ]);
      setCertificates(certs);
      setEducations(edus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load certificates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownload = async (certId: string) => {
    if (!userId) return;
    const cert = certificates.find((c) => c.id === certId);
    if (!cert) return;

    try {
      const blob = await downloadCertificateFile(userId, cert.file_name, cert.file_iv, cert.file_mime);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cert.label || "certificate";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleActionClick = (certId: string) => {
    const cert = certificates.find((c) => c.id === certId);
    if (cert) {
      setEditingCertificate(cert);
    }
  };

  const handleSaveCertificate = async (
    label: string,
    educationId: string,
    file: File | null,
    existingCertificate: Certificate | null
  ) => {
    if (!userId) return;
    const nowIso = new Date().toISOString();

    if (existingCertificate) {
      // Edit existing
      const payload: Partial<Certificate> = {
        ...existingCertificate,
        label,
        education_id: educationId || "",
        updated_at: nowIso,
      };
      
      await updateCertificate(userId, existingCertificate.id, payload as CertificatePlaintext);
      
      setCertificates(prev => prev.map(c => 
        c.id === existingCertificate.id ? { ...c, ...payload } : c
      ));
      setEditingCertificate(null);
    } else {
      // Create new
      if (!file) throw new Error("File is required to add a new certificate.");
      
      // 1. Upload to storage
      const { fileName, iv, mimeType } = await uploadCertificateFile(userId, file);
      
      // 2. Create DB record
      const newCert = await createCertificate(userId, {
        label,
        file_name: fileName,
        file_iv: iv,
        file_mime: mimeType,
        education_id: educationId || "",
        updated_at: nowIso,
      });
      
      setCertificates(prev => [...prev, newCert]);
      setIsAddingCertificate(false);
    }
  };

  const handleDeleteConfirmed = async (certId: string) => {
    if (!userId) return;
    try {
      const cert = certificates.find((c) => c.id === certId);
      if (!cert) return;
      
      // 1. Delete storage file
      if (cert.file_name) {
        try {
          await deleteCertificateFile(cert.file_name);
        } catch {
          // best-effort
        }
      }

      // 2. Unlink from education
      if (cert.education_id) {
        const edu = educations.find((e) => e.id === cert.education_id);
        if (edu) {
          const nowIso = new Date().toISOString();
          const payload = {
            ...edu,
            certificate_ids: edu.certificate_ids.filter((id) => id !== cert.id),
            updated_at: nowIso,
          };
          await updateEducation(userId, edu.id, payload as EducationPlaintext);
        }
      }

      // 3. Delete DB row
      await deleteCertificate(cert.id);
      
      // Update local state without fetching again
      setCertificates(prev => prev.filter(c => c.id !== cert.id));
    } catch (err) {
      alert("Failed to delete certificate: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const documentTiles: DocumentTile[] = certificates.map((cert) => {
    const edu = educations.find((e) => e.id === cert.education_id);
    return {
      id: cert.id,
      fileName: cert.label || cert.file_name || "Unnamed Certificate",
      fileUrl: "", // Handled by handleDownload directly using API
      linkedItemName: edu ? edu.name : null,
      thumbnailUrl: null, // Generic icons will be used by TileView
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4">
        <Link
          href="/education"
          className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← Back to Education
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <TileView
        documents={documentTiles}
        isLoading={isLoading}
        onDownload={handleDownload}
        onDeleteConfirmed={handleDeleteConfirmed}
        onActionClick={handleActionClick}
        onAdd={() => setIsAddingCertificate(true)}
        title={
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Certificate Store
            </h1>
            <p className="mt-1 text-sm font-normal text-zinc-500 dark:text-zinc-400">
              View all uploaded certificates across all your educations.
            </p>
          </div>
        }
      />

      {editingCertificate && userId && (
        <CertificateModal
          certificate={editingCertificate}
          completedEducations={educations}
          userId={userId}
          onClose={() => setEditingCertificate(null)}
          onSave={handleSaveCertificate}
          onDelete={async (cert) => {
            await handleDeleteConfirmed(cert.id);
            setEditingCertificate(null);
          }}
          onDownload={async (cert) => {
            await handleDownload(cert.id);
          }}
        />
      )}
      {isAddingCertificate && userId && (
        <CertificateModal
          certificate={null}
          completedEducations={educations}
          userId={userId}
          onClose={() => setIsAddingCertificate(false)}
          onSave={handleSaveCertificate}
          onDelete={async () => {}}
          onDownload={async () => {}}
        />
      )}
    </div>
  );
}
