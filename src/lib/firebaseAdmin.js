"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseAdmin = exports.auth = exports.firestore = void 0;
// src/lib/firebaseAdmin.ts
var admin = require("firebase-admin");
exports.firebaseAdmin = admin;
var firestoreInstance;
var authInstance;
var serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
var projectId = process.env.FIREBASE_PROJECT_ID;
var clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
var privateKey = (_a = process.env.FIREBASE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n');
if (!admin.apps.length) {
    console.log('Attempting to initialize Firebase Admin SDK...');
    try {
        if (serviceAccountPath) {
            console.log("Using GOOGLE_APPLICATION_CREDENTIALS path: ".concat(serviceAccountPath));
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });
            console.log('Firebase Admin SDK initialized successfully using GOOGLE_APPLICATION_CREDENTIALS.');
        }
        else if (projectId && clientEmail && privateKey) {
            console.log('GOOGLE_APPLICATION_CREDENTIALS not set. Using individual Firebase environment variables.');
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: projectId,
                    clientEmail: clientEmail,
                    privateKey: privateKey,
                }),
            });
            console.log('Firebase Admin SDK initialized successfully using individual environment variables.');
        }
        else {
            var missingVars = [
                !serviceAccountPath && !projectId && "GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID",
                !clientEmail && "FIREBASE_CLIENT_EMAIL (if not using GOOGLE_APPLICATION_CREDENTIALS)",
                !privateKey && "FIREBASE_PRIVATE_KEY (if not using GOOGLE_APPLICATION_CREDENTIALS)",
            ].filter(Boolean).join(", ");
            var errorMessage = "FATAL ERROR: Firebase Admin SDK configuration is missing. Required: GOOGLE_APPLICATION_CREDENTIALS, or all of FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. Missing: ".concat(missingVars, ". Please check your .env file. Application cannot start.");
            console.error(errorMessage);
            throw new Error(errorMessage);
        }
        firestoreInstance = admin.firestore();
        authInstance = admin.auth();
        console.log("Firestore and Auth instances obtained successfully after initialization.");
    }
    catch (error) {
        console.error('CRITICAL_FIREBASE_INIT_ERROR: Firebase Admin SDK initialization failed:', error.message, error.stack);
        throw new Error("Firebase Admin SDK initialization failed: ".concat(error.message, ". Check server logs."));
    }
}
else {
    console.log('Firebase Admin SDK already initialized. Reusing existing app.');
    firestoreInstance = admin.firestore();
    authInstance = admin.auth();
    if (firestoreInstance && authInstance) {
        console.log("Firestore and Auth instances obtained from existing Firebase app.");
    }
    else {
        console.error("CRITICAL_ERROR_REUSE_INIT: Failed to get Firestore/Auth instances from existing Firebase app.");
    }
}
if (!firestoreInstance) {
    var criticalErrorMsg = "CRITICAL_ERROR_POST_INIT: Firestore instance is undefined after initialization block. This indicates a serious problem with Firebase Admin SDK setup. Check environment variables and service account configuration.";
    console.error(criticalErrorMsg);
    // To prevent the app from trying to run with a non-functional Firebase setup:
    throw new Error(criticalErrorMsg);
}
var firestore = firestoreInstance;
exports.firestore = firestore;
var auth = authInstance;
exports.auth = auth;
