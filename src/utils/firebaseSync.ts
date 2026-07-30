// src/utils/firebaseSync.ts
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { LocalStore } from './localStore';

const DOC_COLL = 'store_data';
const DOC_ID = 'pearlcrm';

export function subscribeToStore(
  onUpdate: (data: LocalStore) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) return () => {};

  const docRef = doc(db, DOC_COLL, DOC_ID);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as LocalStore);
      } else {
        // If document doesn't exist, initialize with empty structure
        onUpdate({
          newCustomers: [],
          editedCustomers: {},
          deletedCustomerIds: [],
          newOrders: [],
          editedOrders: {},
          deletedOrderIds: [],
          inventoryLogs: [],
        });
      }
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveToFirestore(data: LocalStore): Promise<void> {
  if (!db) return;
  const docRef = doc(db, DOC_COLL, DOC_ID);
  await setDoc(docRef, data);
}

export async function clearDeletedOrdersInFirestore(): Promise<void> {
  if (!db) return;
  const docRef = doc(db, DOC_COLL, DOC_ID);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    const data = snapshot.data() as LocalStore;
    data.deletedOrderIds = [];
    await setDoc(docRef, data);
  }
}

export async function clearManualAdditionsInFirestore(): Promise<void> {
  if (!db) return;
  const docRef = doc(db, DOC_COLL, DOC_ID);
  const data: LocalStore = {
    newCustomers: [],
    newOrders: [],
    deletedCustomerIds: [],
    deletedOrderIds: [],
    editedCustomers: {},
    editedOrders: {},
    inventoryLogs: [],
  };
  await setDoc(docRef, data);
}

export async function mergeAndUploadLocal(localData: LocalStore): Promise<LocalStore> {
  if (!db) return localData;
  const docRef = doc(db, DOC_COLL, DOC_ID);
  const snapshot = await getDoc(docRef);
  
  let onlineData: LocalStore = {
    newCustomers: [],
    editedCustomers: {},
    deletedCustomerIds: [],
    newOrders: [],
    editedOrders: {},
    deletedOrderIds: [],
    inventoryLogs: [],
  };

  if (snapshot.exists()) {
    onlineData = snapshot.data() as LocalStore;
  }

  // Merge logic: combine lists
  const mergedNewCustomers = [...onlineData.newCustomers];
  localData.newCustomers.forEach((lc) => {
    if (!mergedNewCustomers.some((oc) => oc.id === lc.id)) {
      mergedNewCustomers.push(lc);
    }
  });

  const mergedNewOrders = [...onlineData.newOrders];
  localData.newOrders.forEach((lo) => {
    if (!mergedNewOrders.some((oo) => oo.id === lo.id)) {
      mergedNewOrders.push(lo);
    }
  });

  // Combine deleted sets
  const mergedDeletedCustomerIds = Array.from(new Set([
    ...onlineData.deletedCustomerIds,
    ...localData.deletedCustomerIds
  ]));

  const mergedDeletedOrderIds = Array.from(new Set([
    ...onlineData.deletedOrderIds,
    ...localData.deletedOrderIds
  ]));

  // Combine edited records
  const mergedEditedCustomers = {
    ...onlineData.editedCustomers,
    ...localData.editedCustomers
  };

  const mergedEditedOrders = {
    ...onlineData.editedOrders,
    ...localData.editedOrders
  };

  const mergedInventoryLogs = [...(onlineData.inventoryLogs || [])];
  (localData.inventoryLogs || []).forEach(log => {
    const idx = mergedInventoryLogs.findIndex((l: any) => l.id === log.id);
    if (idx === -1) {
      mergedInventoryLogs.push(log);
    } else {
      mergedInventoryLogs[idx] = log; // local overwrite
    }
  });

  const finalMerged: LocalStore = {
    newCustomers: mergedNewCustomers,
    editedCustomers: mergedEditedCustomers,
    deletedCustomerIds: mergedDeletedCustomerIds,
    newOrders: mergedNewOrders,
    editedOrders: mergedEditedOrders,
    deletedOrderIds: mergedDeletedOrderIds,
    inventoryLogs: mergedInventoryLogs,
  };

  await setDoc(docRef, finalMerged);
  return finalMerged;
}
