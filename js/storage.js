import { DB_NAME, DB_STORE_NAME, DB_VERSION, STORAGE_KEYS } from "./config.js";
import { state } from "./state.js";
import { elements } from "./dom.js";

export function openAssetDatabase() {
  if (state.assetDbPromise) {
    return state.assetDbPromise;
  }

  state.assetDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB_STORE_NAME)) {
        database.createObjectStore(DB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return state.assetDbPromise;
}

export async function getAssetStore(mode = "readonly") {
  const database = await openAssetDatabase();
  return database.transaction(DB_STORE_NAME, mode).objectStore(DB_STORE_NAME);
}

export async function saveAsset(key, value) {
  const store = await getAssetStore("readwrite");
  return new Promise((resolve, reject) => {
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAsset(key) {
  const store = await getAssetStore("readwrite");
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function persistAssetSafely(key, value) {
  try {
    await saveAsset(key, value);
  } catch (error) {
    console.warn(`Failed to persist asset: ${key}`, error);
  }
}

export async function loadAsset(key) {
  const store = await getAssetStore("readonly");
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function saveSourceText() {
  try {
    localStorage.setItem(STORAGE_KEYS.sourceText, elements.sourceText.value || "");
  } catch (error) {
    console.warn("Failed to save source text", error);
  }
}

export function restoreSourceText() {
  try {
    const savedText = localStorage.getItem(STORAGE_KEYS.sourceText);
    if (!savedText) {
      return false;
    }

    elements.sourceText.value = savedText;
    return true;
  } catch (error) {
    console.warn("Failed to restore source text", error);
    return false;
  }
}
