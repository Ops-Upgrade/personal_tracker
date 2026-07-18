const DB_NAME = "personal-tracker-keys";
const DB_VERSION = 1;
const STORE_NAME = "dek-store";

let cachedDEK: { userId: string; key: CryptoKey } | null = null;function openDB(): Promise<IDBDatabase> {
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
  cachedDEK = { userId, key: dek };
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
  if (cachedDEK && cachedDEK.userId === userId) {
    return cachedDEK.key;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(userId);
    req.onsuccess = () => {
      db.close();
      const key = (req.result as CryptoKey) ?? null;
      if (key) {
        cachedDEK = { userId, key };
      }
      resolve(key);
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
  if (cachedDEK && cachedDEK.userId === userId) {
    cachedDEK = null;
  }
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
  if (cachedDEK && cachedDEK.userId === userId) return true;
  const key = await loadDEK(userId);
  return key !== null;
}
