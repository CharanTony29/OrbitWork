/**
 * Client-side persistent storage for uploaded PPTX template buffers using IndexedDB.
 * Works seamlessly across browser tabs, sessions, and reloads without the 5MB localStorage limit.
 */

const DB_NAME = "orbitwork_templates_db";
const STORE_NAME = "template_buffers";
const DB_VERSION = 1;

// In-memory cache for fast synchronous access within the active session
const BUFFER_CACHE = new Map<string, Uint8Array>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/**
 * Save template Uint8Array buffer into IndexedDB and in-memory cache
 */
export async function saveTemplateBuffer(templateId: string, buffer: Uint8Array): Promise<void> {
  BUFFER_CACHE.set(templateId, buffer);
  if (typeof window === "undefined" || !window.indexedDB) return;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(buffer, templateId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[template-storage] Failed to save buffer to IndexedDB:", err);
  }
}

/**
 * Retrieve template buffer from memory cache or IndexedDB
 */
export async function getTemplateBuffer(templateId: string): Promise<Uint8Array | null> {
  if (BUFFER_CACHE.has(templateId)) {
    return BUFFER_CACHE.get(templateId)!;
  }
  if (typeof window === "undefined" || !window.indexedDB) return null;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(templateId);
      req.onsuccess = () => {
        const result = req.result as Uint8Array | undefined;
        if (result) {
          BUFFER_CACHE.set(templateId, result);
          resolve(result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[template-storage] Failed to load buffer from IndexedDB:", err);
    return null;
  }
}

/**
 * Synchronous buffer retrieval from memory cache
 */
export function getCachedTemplateBuffer(templateId: string): Uint8Array | null {
  return BUFFER_CACHE.get(templateId) || null;
}

/**
 * Delete a template buffer
 */
export async function deleteTemplateBuffer(templateId: string): Promise<void> {
  BUFFER_CACHE.delete(templateId);
  if (typeof window === "undefined" || !window.indexedDB) return;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(templateId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[template-storage] Failed to delete buffer from IndexedDB:", err);
  }
}
