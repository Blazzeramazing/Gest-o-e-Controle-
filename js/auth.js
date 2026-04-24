import { state } from './state.js';
import { auth, db, getPublicPath } from './firebase-config.js';
import { 
    onAuthStateChanged, signOut, signInWithEmailAndPassword, 
    sendPasswordResetEmail, sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showStatusMessage, setupUIForRole, showTab } from './ui.js';

function setupAuthUIHandlers() {
    const loginFormContainer = document.getElementById('login-form-container');
    const resetFormContainer = document.getElementById('reset-form-container');

    const showLogin = () => {
        resetFormContainer?.classList.add('hidden');
        loginFormContainer?.classList.remove('hidden');
    };

    const showReset = () => {
        loginFormContainer?.classList.add('hidden');
        resetFormContainer?.classList.remove('hidden');
    };

    document.getElementById('show-reset')?.addEventListener('click', (e) => {
        e.preventDefault();
        showReset();
    });

    document.getElementById('back-to-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });

    document.getElementById('back-arrow-reset')?.addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm && !loginForm.dataset.bound) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = String(document.getElementById('login-email')?.value || '').trim();
            const password = String(document.getElementById('login-password')?.value || '');
            if (!email || !password) {
                showStatusMessage('Preencha email e senha.', 'error', 'auth');
                return;
            }
            await login(email, password);
        });
        loginForm.dataset.bound = '1';
    }

    const resetForm = document.getElementById('reset-form');
    if (resetForm && !resetForm.dataset.bound) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = String(document.getElementById('reset-email')?.value || '').trim();
            if (!email) {
                showStatusMessage('Informe o email.', 'error', 'auth');
                return;
            }
            const ok = await resetPassword(email);
            if (ok) showLogin();
        });
        resetForm.dataset.bound = '1';
    }
}

export function initAuth() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const authContainer = document.getElementById('auth-container');
    const mainAppContainer = document.getElementById('main-app-container');

    setupAuthUIHandlers();

    onAuthStateChanged(auth, async (user) => {
        loadingOverlay.classList.remove('hidden');
        if (window.detachListeners) window.detachListeners(); 

        if (user && user.emailVerified) {
            state.currentUserId = user.uid;
            
            const profileRef = doc(db, getPublicPath('user_profiles'), user.uid);
            try {
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) { 
                    state.currentUserProfile = profileSnap.data(); 

                    if (state.currentUserProfile.status === 'bloqueado') { 
                        await signOut(auth); 
                        showStatusMessage("Seu acesso foi bloqueado pela Administração.", "error", "auth"); 
                        loadingOverlay.classList.add('hidden'); 
                        return; 
                    } 

                    if (!state.currentUserProfile.nome || !state.currentUserProfile.email) { 
                        await setDoc(profileRef, { 
                            nome: user.displayName || 'Sem Nome', 
                            email: user.email 
                        }, { merge: true }); 
                        state.currentUserProfile.nome = user.displayName; 
                        state.currentUserProfile.email = user.email; 
                    } 
                    
                    authContainer.classList.add('hidden'); 
                    mainAppContainer.classList.remove('hidden'); 
                    document.getElementById('welcome-message').textContent = `Bem-vindo(a), ${user.displayName || 'Usuário'}`; 
                    
                    setupUIForRole(); 
                    if (window.initApp) await window.initApp(); 
                } else { 
                    await signOut(auth);
                    showStatusMessage("Conta sem perfil de acesso. Contate a Administração.", "error", "auth");
                    loadingOverlay.classList.add('hidden');
                    return;
                }
            } catch(e) {
                 console.error("Erro ao buscar perfil", e);
            }
        } else {
            state.currentUserId = null;
            state.currentUserProfile = null;
            authContainer.classList.remove('hidden');
            mainAppContainer.classList.add('hidden');
            state.unlockedSections.clear();
        }
        loadingOverlay.classList.add('hidden');
    });
}

export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            let message = 'Seu e-mail ainda não foi verificado. Por favor, verifique sua caixa de entrada. <a href="#" id="resend-verification" class="font-bold underline text-cyan-400">Reenviar email</a>';
            showStatusMessage(message, 'error', 'auth');
            
            document.getElementById('resend-verification')?.addEventListener('click', async (resendEvent) => {
                resendEvent.preventDefault();
                try {
                    const tempUserCredential = await signInWithEmailAndPassword(auth, email, password);
                    await sendEmailVerification(tempUserCredential.user);
                    await signOut(auth);
                    showStatusMessage('Email de verificação reenviado com sucesso.', 'success', 'auth');
                } catch (resendError) {
                    showStatusMessage(`Erro ao reenviar: ${resendError.message}`, 'error', 'auth');
                }
            });
        }
    } catch (error) {
        showStatusMessage("Email ou senha inválidos.", 'error', 'auth');
    }
}

export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showStatusMessage("Link de recuperação enviado para o seu email.", 'success', 'auth');
        return true;
    } catch (error) {
        showStatusMessage(`Erro: ${error.message}`, 'error', 'auth');
        return false;
    }
}

export async function logout() {
    await signOut(auth);
    window.location.reload();
}
