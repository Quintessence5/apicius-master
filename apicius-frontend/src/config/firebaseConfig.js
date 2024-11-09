import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

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
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider(); // Add Google Auth provider

export default app;