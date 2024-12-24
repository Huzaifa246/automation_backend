import * as admin from 'firebase-admin';

// Initialize Firebase app only once
if (!admin.apps.length) {
    console.log("Initializing Firebase...");

    const serviceAccount = {
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim(),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    if (!serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error("Missing Firebase credentials in environment variables.");
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    console.log("Firebase initialized successfully.");
} else {
    console.log("Firebase app already initialized.");
}

// Get Firestore instance
const db = admin.firestore();
db.settings({
    ignoreUndefinedProperties: true,
});

export { db, admin };
