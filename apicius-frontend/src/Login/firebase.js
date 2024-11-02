import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBt6JMB0BPqMpN9fw7QGjAFqEtTvaCVOZw", 
  authDomain: "apicius06.firebaseapp.com", // Peut aussi être localhost
  projectId: "apicius06",
  clientId: "1065313505475-eupubnnvgjtjp6es16gu1l4s6dcocv82.apps.googleusercontent.com",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
