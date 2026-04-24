import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyC7J_J7JCagM65E5qkl1z-Kn2V360ldmdg",
    authDomain: "minhas-credenciais-firebase.firebaseapp.com",
    projectId: "minhas-credenciais-firebase",
    storageBucket: "minhas-credenciais-firebase.appspot.com",
    messagingSenderId: "90146495031",
    appId: "1:90146495031:web:04bdab47de65f7444cbdb2"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);

export const getPublicPath = (collection) => {
    // Esta função pode ser expandida se houver caminhos dinâmicos
    return collection;
};