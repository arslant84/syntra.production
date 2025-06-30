// src/lib/firebaseAdmin.ts
// This file is now effectively empty as we are using PostgreSQL.
// Keeping the file for structure but with no active Firebase logic.

let firestoreInstance: any = undefined; // admin.firestore.Firestore | undefined = undefined;
let authAdminInstance: any = undefined; // admin.auth.Auth | undefined = undefined;

const USERS_COLLECTION = 'users';
const ROLES_COLLECTION = 'roles';
const PERMISSIONS_COLLECTION = 'permissions';
const TRF_COLLECTION = 'trfs'; // Example

// console.warn("FIREBASE_ADMIN: Firebase Admin SDK is currently NOT INITIALIZED. Backend will use PostgreSQL.");

export { 
    firestoreInstance as firestore, 
    authAdminInstance as authAdmin,
    USERS_COLLECTION,
    ROLES_COLLECTION,
    PERMISSIONS_COLLECTION,
    TRF_COLLECTION
};
