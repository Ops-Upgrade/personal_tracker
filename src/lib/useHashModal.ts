"use client";

import { useState, useCallback, useEffect } from "react";

export interface UseHashModalOptions {
  /** Allowed hash values that trigger a modal */
  validHashes: string[];
}

export interface UseHashModalReturn {
  activeHash: string | null;
  openModal: (hash: string) => void;
  closeModal: () => void;
  setActiveHash: (hash: string | null) => void;
}

export function useHashModal({
  validHashes,
}: UseHashModalOptions): UseHashModalReturn {
  const [activeHash, setActiveHash] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const rawHash = window.location.hash.replace("#", "");
    return validHashes.includes(rawHash) ? rawHash : null;
  });

  const openModal = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  const closeModal = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setActiveHash(null);
  }, []);

  useEffect(() => {
    const handler = () => {
      const rawHash = window.location.hash.replace("#", "");
      if (validHashes.includes(rawHash)) {
        setActiveHash(rawHash);
      } else {
        setActiveHash(null);
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [validHashes]);

  return { activeHash, openModal, closeModal, setActiveHash };
}
