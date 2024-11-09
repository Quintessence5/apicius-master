// backend/config/firebaseConfig.js
import admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import serviceAccount from '../../private/apicius05-firebase-adminsdk-w5v1o-505d701e82.json';

// Initialize Firebase Admin SDK for backend only
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

// Firebase client configuration (for backend tasks only)
const firebaseConfig = {
    apiKey: "AIzaSyCRwp3hzQKDAhHfkLrI-wU7PfoyFJ6qTRI",
    authDomain: "apicius05.firebaseapp.com",
    projectId: "apicius05",
    storageBucket: "apicius05.firebasestorage.app",
    messagingSenderId: "798334228211",
    appId: "1:798334228211:web:662352443d22c35ffec986",
    measurementId: "G-XW4Y9NWGH5D",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { admin, auth };
export default app;
