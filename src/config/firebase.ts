import { initializeApp, cert, getApp, App, ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

let app: App;
try {
  app = getApp();
} catch (error) {
  console.log("Initializing Firebase...");

  // const serviceAccount: ServiceAccount = {
  //   type: process.env.FIREBASE_TYPE,
  //   project_id: process.env.FIREBASE_PROJECT_ID,
  //   private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  //   private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim(), // Replace escaped newlines and trim
  //   client_email: process.env.FIREBASE_CLIENT_EMAIL,
  //   client_id: process.env.FIREBASE_CLIENT_ID,
  //   auth_uri: process.env.FIREBASE_AUTH_URI,
  //   token_uri: process.env.FIREBASE_TOKEN_URI,
  //   auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  //   client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  //   universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  // };
  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim(),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  app = initializeApp({
    credential: cert(serviceAccount),
  });

  console.log("Firebase initialized successfully.");
}

// Initialize Firestore
const db = getFirestore(app);
db.settings({
  ignoreUndefinedProperties: true,
});

export { db, admin };