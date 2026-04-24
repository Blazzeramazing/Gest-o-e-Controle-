import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    doc, getDoc, setDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showStatusMessage, displayTab } from './ui.js';
import { hashString } from './utils.js';

const MASTER_PASSWORD_HASH = 'ae10900e37c1b78987e907083e37e9e1a1d7f9d785642b67465916a4c292e6f0';
const ADMIN_CODE_HASH = '94ad9d4d6ddc8dfff2623f8ac170f31493acdb41d40f4f3630000831273c6056';
const AGENTE_CODE_HASH = 'f3d337879b8b060c43112c851cb9845304a8d5bba41a866e8578a6c666692a6e';

export async function verifySectionPassword(e) {
    e.preventDefault();
    const input = document.getElementById('password-prompt-input');
    const typed = input.value.trim();
    const errorEl = document.getElementById('password-prompt-error');
    
    if (!typed) return;
    
    const typedHash = await hashString(typed);
    const storedData = state.sectionPasswords[state.pendingTab];
    const sectionHash = (typeof storedData === 'object' && storedData !== null) ? storedData.hash : storedData;

    if (typedHash === sectionHash || typedHash === MASTER_PASSWORD_HASH) {
        state.unlockedSections.add(state.pendingTab);
        document.getElementById('password-prompt-overlay').classList.add('hidden');
        displayTab(state.pendingTab);
        state.pendingTab = null;
    } else {
        errorEl.textContent = "Senha incorreta.";
        errorEl.classList.remove('hidden');
        input.value = '';
        input.focus();
    }
}

export async function loadSectionPasswords() {
    if (!state.currentUserId) return;
    const configDocRef = doc(db, getPublicPath('configuracoes'), 'senhas');
    try {
        const docSnap = await getDoc(configDocRef);
        state.sectionPasswords = docSnap.exists() ? docSnap.data() : {};
    } catch (error) {
        state.sectionPasswords = {};
    }
}

export function populatePasswordManagementForm() {
    const container = document.getElementById('password-fields-container');
    if (!container) return;
    container.innerHTML = '';
    const sections = [
        { id: 'control', label: 'Carga e Descarga' },
        { id: 'providers', label: 'Prestadores de Serviço' },
        { id: 'approve-os', label: 'Aprovação de OS' },
        { id: 'collaborators', label: 'Cadastro Colaboradores' },
        { id: 'qr-reader', label: 'Leitor QR Code' },
        { id: 'emprestimo', label: 'Empréstimos' }, 
        { id: 'equipamentos', label: 'Empréstimos de Equip.' },
        { id: 'stores', label: 'Gerenciar Lojas' },
        { id: 'reports', label: 'Relatórios' },
        { id: 'almoxarifado', label: 'Almoxarifado' },
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'rondas', label: 'Rondas em Áreas' },
        { id: 'portal-control', label: 'Portal Admin' },
        { id: 'portal-lojas', label: 'Portal Lojas' }
    ];

    sections.forEach(section => {
        const div = document.createElement('div');
        const storedData = state.sectionPasswords[section.id];
        const displayValue = (typeof storedData === 'object' && storedData !== null) ? storedData.plain : (storedData || '');
        
        div.innerHTML = `
            <label for="pass-${section.id}" class="block text-sm font-medium text-slate-400">${section.label}</label>
            <input type="text" id="pass-${section.id}" name="${section.id}" value="${displayValue}" placeholder="Deixe em branco para livre acesso" class="w-full mt-1 p-2 bg-slate-900/50 border border-slate-700 rounded-md text-slate-200">
        `;
        container.appendChild(div);
    });
}

export async function handlePasswordManagementSave(e) {
    e.preventDefault();
    const form = e.target;
    const newPasswords = {};
    const inputs = form.querySelectorAll('input');
    
    for (const input of inputs) {
        const val = input.value.trim();
        if (val) {
            newPasswords[input.name] = {
                plain: val,
                hash: await window.hashString(val)
            };
        } else {
            newPasswords[input.name] = '';
        }
    }

    try {
        const configDocRef = doc(db, getPublicPath('configuracoes'), 'senhas');
        await setDoc(configDocRef, newPasswords);
        if (window.registrarAuditoriaAdmin) await window.registrarAuditoriaAdmin("ALTERAÇÃO_SENHAS", "Alterou senhas de acesso das seções");
        state.sectionPasswords = newPasswords;
        state.unlockedSections.clear();
        showStatusMessage("Senhas atualizadas com sucesso!");
        displayTab('inicio'); 
    } catch (error) {
        showStatusMessage("Falha ao salvar as senhas.", "error");
    }
}

export function listenForPortalContent() {
    if (!state.currentUserId) return;

    const portalContentRef = doc(db, getPublicPath('configuracoes'), 'portal_content');
    const unsubAdmin = onSnapshot(portalContentRef, (docSnap) => {
        state.portalContentAdminCache = docSnap.exists() ? docSnap.data() : { bannerUrl: '', carousel: [], features: [], quote: '', welcomeText: {}, themeColors: {}, carouselLoop: false};
        
        if (state.currentUserProfile?.role === 'admin') {
            applyTheme(state.portalContentAdminCache.themeColors);
            if (window.updateHomePageContent) window.updateHomePageContent(); 
        }
    });
    state.unsubscribeListeners.push(unsubAdmin);

    const portalContentLojaRef = doc(db, getPublicPath('configuracoes'), 'portal_content_loja');
    const unsubLoja = onSnapshot(portalContentLojaRef, (docSnap) => {
        state.portalContentLojaCache = docSnap.exists() ? docSnap.data() : { bannerUrl: '', carousel: [], features: [], quote: '', welcomeText: {}, themeColors: {}, carouselLoop: false};
        
        if (state.currentUserProfile?.role === 'lojista') {
            applyTheme(state.portalContentLojaCache.themeColors);
            if (window.updateHomePageContent) window.updateHomePageContent(); 
        }
    });
    state.unsubscribeListeners.push(unsubLoja);
}

function applyTheme(theme) {
    const bgColor = theme?.background || '#0f172a';
    const textColor = theme?.text || '#cbd5e1';

    let themeStyleTag = document.getElementById('dynamic-theme-styles');
    if (!themeStyleTag) {
        themeStyleTag = document.createElement('style');
        themeStyleTag.id = 'dynamic-theme-styles';
        document.head.appendChild(themeStyleTag);
    }
    
    themeStyleTag.innerHTML = `
        body { background-color: ${bgColor} !important; color: ${textColor} !important; }
        .text-slate-200, .text-slate-300, .text-white, h1, h2, h3, h4, .font-bold, .font-semibold { color: ${textColor} !important; }
        .text-slate-400, .text-slate-500, input::placeholder, textarea::placeholder, select { color: ${textColor} !important; opacity: 0.7; }
        select option { background: ${bgColor}; color: ${textColor}; }
        h1.bg-clip-text { background-image: linear-gradient(to right, ${textColor}, rgba(255, 255, 255, 0.7)); }
    `;
}

export function renderPortalAdmin() {
    const container = document.getElementById('tab-portal-control');
    if (!container) return;
    const content = state.portalContentAdminCache;
    
    container.innerHTML = `
        <div class="space-y-6 fade-in">
            <h2 class="text-2xl font-bold text-white">Configuração Portal Admin</h2>
            <form id="portal-admin-form" class="space-y-4">
                <div>
                    <label class="block text-sm text-slate-400">URL do Banner</label>
                    <input type="text" name="bannerUrl" value="${content.bannerUrl || ''}" class="w-full p-3 bg-slate-900 border border-slate-700 rounded-md text-slate-200">
                </div>
                <div>
                    <label class="block text-sm text-slate-400">Frase do Dia</label>
                    <textarea name="quote" class="w-full p-3 bg-slate-900 border border-slate-700 rounded-md text-slate-200">${content.quote || ''}</textarea>
                </div>
                <button type="submit" class="bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-cyan-500">Salvar Alterações</button>
            </form>
        </div>
    `;

    document.getElementById('portal-admin-form')?.addEventListener('submit', (e) => handlePortalContentSubmit(e, 'admin'));
}

export function renderPortalLoja() {
    const container = document.getElementById('tab-portal-lojas');
    if (!container) return;
    const content = state.portalContentLojaCache;

    container.innerHTML = `
        <div class="space-y-6 fade-in">
            <h2 class="text-2xl font-bold text-white">Configuração Portal Lojas</h2>
            <form id="portal-loja-form" class="space-y-4">
                <div>
                    <label class="block text-sm text-slate-400">URL do Banner</label>
                    <input type="text" name="bannerUrl" value="${content.bannerUrl || ''}" class="w-full p-3 bg-slate-900 border border-slate-700 rounded-md text-slate-200">
                </div>
                <div>
                    <label class="block text-sm text-slate-400">Frase do Dia</label>
                    <textarea name="quote" class="w-full p-3 bg-slate-900 border border-slate-700 rounded-md text-slate-200">${content.quote || ''}</textarea>
                </div>
                <button type="submit" class="bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-cyan-500">Salvar Alterações</button>
            </form>
        </div>
    `;

    document.getElementById('portal-loja-form')?.addEventListener('submit', (e) => handlePortalContentSubmit(e, 'loja'));
}

async function handlePortalContentSubmit(e, type) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {
        bannerUrl: formData.get('bannerUrl'),
        quote: formData.get('quote')
    };

    try {
        const path = type === 'admin' ? 'portal_content' : 'portal_content_loja';
        await setDoc(doc(db, getPublicPath('configuracoes'), path), updates, { merge: true });
        showStatusMessage("Portal atualizado com sucesso!");
    } catch (error) {
        showStatusMessage("Erro ao atualizar portal.", "error");
    }
}