const DB_NAME = "personal-tracker-keys";
const DB_VERSION = 1;
const STORE_NAME = "dek-store";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persist a CryptoKey in IndexedDB, keyed by user ID.
 * IndexedDB can store non-extractable CryptoKey objects directly —
 * the browser keeps the raw key material in protected storage.
 */
export async function saveDEK(
  userId: string,
  dek: CryptoKey
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(dek, userId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Retrieve a CryptoKey from IndexedDB, or null if not present.
 */
export async function loadDEK(
  userId: string
): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(userId);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as CryptoKey) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/**
 * Remove the DEK for this user (called on logout).
 */
export async function clearDEK(userId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(userId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Check whether a DEK is stored for this user.
 */
export async function hasDEK(userId: string): Promise<boolean> {
  const key = await loadDEK(userId);
  return key !== null;
}
