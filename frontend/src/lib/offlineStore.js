function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("plan2field-reports", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("drafts", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function operation(mode, fn) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("drafts", mode);
    const request = fn(tx.objectStore("drafts"));
    tx.oncomplete = () => {
      resolve(request.result);
      database.close();
    };
    tx.onerror = () => {
      reject(tx.error);
      database.close();
    };
  });
}
export const saveDraft = (draft) =>
  operation("readwrite", (store) => store.put(draft));
export const removeDraft = (id) =>
  operation("readwrite", (store) => store.delete(id));
export async function draftsFor(user) {
  return (await operation("readonly", (store) => store.getAll())).filter(
    (d) => d.userId === user,
  );
}
