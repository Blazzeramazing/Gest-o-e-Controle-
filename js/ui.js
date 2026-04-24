import { state } from './state.js';
import { auth, db, getPublicPath } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

export function showStatusMessage(message, type = 'success', container = 'main') {
    const el = container === 'auth' ? document.getElementById('authStatusMessage') : document.getElementById('statusMessage');
    if (!el) return;
    
    el.innerHTML = message;
    el.classList.remove('hidden', 'bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/30', 'bg-red-500/20', 'text-red-400', 'border-red-500/30');
    
    if (type === 'success') {
        el.classList.add('bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/30');
    } else {
        el.classList.add('bg-red-500/20', 'text-red-400', 'border-red-500/30');
    }
    
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

export function showConfirm(message, title = 'Confirmação') {
    return new Promise((resolve) => {
        const modal = document.getElementById('generic-confirm-modal');
        const titleEl = document.getElementById('confirm-modal-title');
        const messageEl = document.getElementById('confirm-modal-message');
        const confirmBtn = document.getElementById('confirm-modal-confirm');
        const cancelBtn = document.getElementById('confirm-modal-cancel');

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.remove('hidden');

        const cleanup = (result) => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onConfirm = () => cleanup(true);
        const onCancel = () => cleanup(false);

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}

export function showPrompt(message, title = 'Entrada de Dados') {
    return new Promise((resolve) => {
        const modal = document.getElementById('generic-prompt-modal');
        const titleEl = document.getElementById('prompt-modal-title');
        const messageEl = document.getElementById('prompt-modal-message');
        const form = document.getElementById('generic-prompt-form');
        const input = document.getElementById('prompt-modal-input');
        const cancelBtn = document.getElementById('prompt-modal-cancel');

        titleEl.textContent = title;
        messageEl.textContent = message;
        input.value = '';
        modal.classList.remove('hidden');
        input.focus();

        const cleanup = (result) => {
            modal.classList.add('hidden');
            form.removeEventListener('submit', onSubmit);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onSubmit = (e) => {
            e.preventDefault();
            cleanup(input.value);
        };
        const onCancel = () => cleanup(null);

        form.addEventListener('submit', onSubmit);
        cancelBtn.addEventListener('click', onCancel);
    });
}

export function setupUIForRole() {
    const role = state.currentUserProfile.role;
    const badge = document.getElementById('user-role-badge');
    const mainTitle = document.getElementById('app-main-title');
    const baseBadgeClasses = "px-3 py-1 text-[10px] md:text-xs font-bold rounded-full border truncate max-w-[160px] md:max-w-[250px] inline-block align-middle";

    if(role === 'admin') {
        mainTitle.textContent = "Gestão e Controle";
        badge.textContent = "Superintendente";
        badge.className = `${baseBadgeClasses} bg-blue-500/20 text-blue-300 border-blue-500/30`;
    } else if (role === 'coordenador') {
        mainTitle.textContent = "Gestão e Controle";
        badge.textContent = "Coordenador";
        badge.className = `${baseBadgeClasses} bg-indigo-500/20 text-indigo-300 border-indigo-500/30`;
    } else if (role === 'agente') {
        mainTitle.textContent = "Central de Operações";
        badge.textContent = "Agente de Segurança";
        badge.className = `${baseBadgeClasses} bg-orange-500/20 text-orange-300 border-orange-500/30`;
    } else if (role === 'supervisor_seguranca') {
        mainTitle.textContent = "Central de Operações";
        badge.textContent = "Supervisor de Segurança";
        badge.className = `${baseBadgeClasses} bg-orange-600/20 text-orange-400 border-orange-600/30`;
    } else if (role === 'manutencao' ) {
        mainTitle.textContent = "Gestão de Operações" ;
        badge.textContent = "Gerente de Operações" ;
        badge.className = `${baseBadgeClasses} bg-slate-600/30 text-blue-300 border-slate-500/40` ;
    } else if (role === 'servicos_gerais' ) {
        mainTitle.textContent = "Serviços Gerais" ;
        badge.textContent = "Supervisor de Serviços Gerais" ;
        badge.className = `${baseBadgeClasses} bg-teal-600/20 text-emerald-300 border-teal-600/30` ;
    } else if (role === 'agente_manutencao' ) {
        mainTitle.textContent = "Operações (Agente)" ;
        badge.textContent = "Agente de Operações" ;
        badge.className = `${baseBadgeClasses} bg-slate-600/30 text-blue-300 border-slate-500/40` ;
    } else if (role === 'agente_servicos_gerais') {
        mainTitle.textContent = "Operações - SG";
        badge.textContent = "Agente S. Gerais";
        badge.className = `${baseBadgeClasses} bg-teal-600/20 text-emerald-300 border-teal-600/30`;
    } else {
        mainTitle.textContent = "Portal do Lojista";
        const nomeLoja = state.currentUserProfile.store?.nomeFantasia || state.currentUserProfile.store?.nomeReal || 'Sem Loja';
        badge.textContent = `Lojista: ${nomeLoja}`;
        badge.className = `${baseBadgeClasses} bg-emerald-500/20 text-emerald-300 border-emerald-500/30`;
    }

    document.querySelectorAll('#main-menu .tab-button').forEach(btn => {
        const match = btn.getAttribute('onclick')?.match(/'([^']+)'/);
        const tabTarget = match ? match[1] : null;
    
        if (role === 'admin') {
            btn.classList.remove('hidden');
        } else if (state.currentUserProfile.permissoes && Array.isArray(state.currentUserProfile.permissoes)) {
            if (state.currentUserProfile.permissoes.includes(tabTarget)) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        } else {
            const roles = btn.getAttribute('data-roles')?.split(',') || [];
            if (roles.includes(role)) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        }
    });

    if (role !== 'lojista') {
        document.getElementById('collab-store-search-container')?.classList.remove('hidden');
        state.selectedCollabStore = null;
    } else {
        document.getElementById('collab-store-search-container')?.classList.add('hidden');
        state.selectedCollabStore = state.currentUserProfile.store;
    }

    document.querySelectorAll('div[data-roles], section[data-roles]').forEach(el => {
        const rolesPermitidos = el.getAttribute('data-roles').split(',');
        if (rolesPermitidos.includes(role)) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

export function setupImageViewer() {
    window.openImageViewer = (imgSrc) => {
        const modal = document.getElementById('image-viewer-modal');
        const img = document.getElementById('image-viewer-img');
        if (!modal || !img) return;
        img.src = imgSrc;
        modal.classList.remove('hidden');
    };

    window.closeImageViewer = () => {
        const modal = document.getElementById('image-viewer-modal');
        const img = document.getElementById('image-viewer-img');
        if (!modal || !img) return;
        modal.classList.add('hidden');
        img.src = '';
    };

    document.getElementById('image-viewer-close')?.addEventListener('click', window.closeImageViewer);
    document.getElementById('image-viewer-modal')?.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'image-viewer-modal') window.closeImageViewer();
    });
}

export async function showTab(tabName) {
    const mainMenu = document.getElementById('main-menu');
    const loadingOverlay = document.getElementById('loading-overlay');
    const passwordPromptOverlay = document.getElementById('password-prompt-overlay');
    
    mainMenu.classList.add('hidden');

    if (tabName === 'dashboard') {
        loadingOverlay.classList.remove('hidden');
        document.getElementById('loading-text').textContent = 'Carregando gráficos...';
        try {
            // Supondo que loadLib seja global ou importada
            if (window.loadLib) await window.loadLib('chart');
        } catch (e) {
            showStatusMessage('Erro ao carregar gráficos.', 'error');
            loadingOverlay.classList.add('hidden');
            return;
        }
        loadingOverlay.classList.add('hidden');
    }

    if (tabName === 'passwords' && state.currentUserProfile.role !== 'admin') {
        return; 
    }

    if (tabName === 'plantao' && state.currentUserProfile.role === 'agente') {
        return;
    }

    const hasPassword = tabName === 'passwords' || (state.sectionPasswords && state.sectionPasswords[tabName]);
    const isAdminBypass = state.currentUserProfile.role === 'admin' && tabName !== 'passwords';

    if (hasPassword && !state.unlockedSections.has(tabName) && !isAdminBypass && (state.currentUserProfile.role === 'admin' || state.currentUserProfile.role === 'agente')) {
        state.pendingTab = tabName;
        document.getElementById('password-prompt-error').classList.add('hidden');
        document.getElementById('password-prompt-form').reset();
        passwordPromptOverlay.classList.remove('hidden');
        document.getElementById('password-prompt-input').focus();
    } else {
        displayTab(tabName);
    }
}

export function displayTab(tabName) {
    clearInterval(state.homeCarouselInterval);
    
    // Reset temporary state for forms
    state.currentTeamMembers = [];
    state.currentOSTeamMembers = [];
    state.currentEntryStores = [];
    state.currentProviderStores = [];
    state.currentReportImages = [];
    state.currentChatAttachment = null;

    const tabs = {
        inicio: document.getElementById('tab-inicio'),
        chat: document.getElementById('tab-chat'),
        'my-os': document.getElementById('tab-my-os'),
        control: document.getElementById('tab-control'),
        providers: document.getElementById('tab-providers'),
        'approve-os': document.getElementById('tab-approve-os'),
        collaborators: document.getElementById('tab-collaborators'),
        'qr-reader': document.getElementById('tab-qr-reader'),
        rondas: document.getElementById('tab-rondas'),
        plantao: document.getElementById('tab-plantao'),
        emprestimo: document.getElementById('tab-emprestimo'),
        equipamentos: document.getElementById('tab-equipamentos'),
        stores: document.getElementById('tab-stores'),
        reports: document.getElementById('tab-reports'),
        almoxarifado: document.getElementById('tab-almoxarifado'),
        chaves: document.getElementById('tab-chaves'),
        notas: document.getElementById('tab-notas'),
        dashboard: document.getElementById('tab-dashboard'),
        timeline: document.getElementById('tab-timeline'), 
        'portal-control': document.getElementById('tab-portal-control'),
        'portal-lojas': document.getElementById('tab-portal-lojas'),
        'audit-admin': document.getElementById('tab-audit-admin'),
        users: document.getElementById('tab-users'),
        passwords: document.getElementById('tab-passwords')
    };

    const currentTabNameEl = document.getElementById('current-tab-name');

    Object.keys(tabs).forEach(key => {
        const tab = tabs[key];
        const tabBtn = document.getElementById(`tab-btn-${key}`);
        if (tab) {
            if (key === tabName) {
                tab.classList.remove('hidden');
            } else {
                tab.classList.add('hidden');
            }
        }
        if (tabBtn) {
            if (key === tabName) {
                tabBtn.classList.add('active');
                if (currentTabNameEl) currentTabNameEl.textContent = tabBtn.textContent.trim();
            } else {
                tabBtn.classList.remove('active');
            }
        }
    });
    
    if (window.setupMasks) window.setupMasks(tabName);

    // Call render functions (re-exposed globally for now or imported)
    if (window.renderPage) window.renderPage(tabName);
}

export function setupChatViewportFixes() {
    if (state.chatViewportInitialized) return;
    state.chatViewportInitialized = true;

    const handler = () => {
        const tabChat = document.getElementById('tab-chat');
        if (!tabChat || tabChat.classList.contains('hidden')) return;
        applyChatViewportSizing();
    };

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handler);
        window.visualViewport.addEventListener('scroll', handler);
    }
    window.addEventListener('resize', handler);

    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.id === 'chat-input' || target.closest('#tab-chat')) {
            setTimeout(handler, 50);
        }
    });

    document.addEventListener('focusout', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.id === 'chat-input') {
            setTimeout(handler, 50);
        }
    });
}

export function applyChatViewportSizing() {
    const tabChat = document.getElementById('tab-chat');
    const mainAppContainer = document.getElementById('main-app-container');
    if (!tabChat || !mainAppContainer) return;

    if (window.innerWidth >= 768) {
        tabChat.style.height = '';
        tabChat.style.maxHeight = '';
        mainAppContainer.style.paddingBottom = '0.5rem';
        mainAppContainer.classList.remove('pb-24');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        return;
    }

    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const tabTop = tabChat.getBoundingClientRect().top;
    const nextHeight = Math.max(0, Math.floor(viewportHeight - tabTop));

    tabChat.style.height = `${nextHeight}px`;
    tabChat.style.maxHeight = 'none';
    mainAppContainer.style.paddingBottom = '0.5rem';
    mainAppContainer.classList.remove('pb-24');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
}

export function renderPaginationControls(id, totalPages, currentPage, onPageChange) {
    const container = document.getElementById(`${id}-pagination-controls`);
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="flex items-center justify-center gap-2 mt-6 pb-4">
            <button class="p-2 rounded-md bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed btn-prev">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <span class="text-sm font-medium text-slate-400">Página ${currentPage} de ${totalPages}</span>
            <button class="p-2 rounded-md bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed btn-next">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
        </div>
    `;

    const prevBtn = container.querySelector('.btn-prev');
    const nextBtn = container.querySelector('.btn-next');

    if (currentPage <= 1) prevBtn.disabled = true;
    if (currentPage >= totalPages) nextBtn.disabled = true;

    prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
    nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
}