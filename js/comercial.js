import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, orderBy, limit, 
    addDoc, updateDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showStatusMessage, showConfirm } from './ui.js';
import { formatDateTime, safeGetDate, debounce } from './utils.js';

export function listenForStores() {
    if (!state.currentUserId) return;
    const unsub = onSnapshot(collection(db, getPublicPath('lojas')), (snap) => {
        state.storesCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }));
        if (!document.getElementById('tab-stores').classList.contains('hidden')) renderStoresPage();
        if (window.renderChatContacts) window.renderChatContacts();
    });
    state.unsubscribeListeners.push(unsub);
}

export function renderStoresPage() {
    const listEl = document.getElementById('store-management-list');
    const searchInput = document.getElementById('store-management-search');
    if (!listEl) return;

    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
    let filtered = state.storesCache;

    if (searchTerm) {
        filtered = filtered.filter(s => 
            s.nomeReal.toLowerCase().includes(searchTerm) || 
            s.nomeFantasia.toLowerCase().includes(searchTerm) || 
            s.numero.includes(searchTerm)
        );
    }

    const startIndex = (state.storesCurrentPage - 1) * state.storesPerPage;
    const endIndex = startIndex + state.storesPerPage;
    const storesToShow = filtered.slice(startIndex, endIndex);

    if (storesToShow.length === 0) {
        listEl.innerHTML = '<p class="text-slate-500 text-center py-8">Nenhuma loja encontrada.</p>';
    } else {
        listEl.innerHTML = storesToShow.map(store => `
            <div class="card bg-slate-900/80 border border-slate-700 rounded-lg p-4 flex flex-col justify-between gap-4">
                <div>
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-xs font-bold text-cyan-400">#${store.numero}</span>
                        <div class="flex gap-2">
                            <button class="text-yellow-400 hover:text-yellow-300 btn-edit-store" data-id="${store.id}" title="Editar">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z"></path></svg>
                            </button>
                            <button class="text-red-500 hover:text-red-400 btn-delete-store" data-id="${store.id}" title="Excluir">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    <h3 class="font-bold text-slate-200 text-lg leading-tight mb-1">${store.nomeReal}</h3>
                    <p class="text-sm text-slate-400">${store.nomeFantasia || 'Sem nome fantasia'}</p>
                </div>
            </div>
        `).join('');
    }

    if (window.renderPaginationControls) window.renderPaginationControls('stores', Math.ceil(filtered.length / state.storesPerPage), state.storesCurrentPage, (p) => { state.storesCurrentPage = p; renderStoresPage(); });
}

export function listenForCollaborators() {
    if (!state.currentUserId) return;
    const unsub = onSnapshot(collection(db, getPublicPath('colaboradores_lojas')), (snap) => {
        state.collaboratorsCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!document.getElementById('tab-collaborators').classList.contains('hidden')) renderCollaboratorsPage();
    });
    state.unsubscribeListeners.push(unsub);
}

export function renderCollaboratorsPage() {
    const activeList = document.getElementById('active-collaborators-list');
    const expiredList = document.getElementById('expired-collaborators-list');
    const activeSearch = document.getElementById('active-collaborators-search')?.value.toLowerCase() || '';
    const expiredSearch = document.getElementById('expired-collaborators-search')?.value.toLowerCase() || '';

    if (!activeList || !expiredList) return;

    const now = new Date();
    let active = state.collaboratorsCache.filter(c => safeGetDate(c.dataFim) >= now);
    let expired = state.collaboratorsCache.filter(c => safeGetDate(c.dataFim) < now);

    if (activeSearch) active = active.filter(c => c.nome.toLowerCase().includes(activeSearch) || c.documento.includes(activeSearch));
    if (expiredSearch) expired = expired.filter(c => c.nome.toLowerCase().includes(expiredSearch) || c.documento.includes(expiredSearch));

    // Simple list rendering (no pagination for now to match original if needed)
    activeList.innerHTML = active.map(c => renderCollabCard(c)).join('') || '<p class="text-slate-500">Nenhum colaborador ativo.</p>';
    expiredList.innerHTML = expired.map(c => renderCollabCard(c)).join('') || '<p class="text-slate-500">Nenhum colaborador expirado.</p>';
}

function renderCollabCard(c) {
    const isExpired = safeGetDate(c.dataFim) < new Date();
    return `
        <div class="card bg-slate-900/80 border ${isExpired ? 'border-red-500/30' : 'border-slate-700'} rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-cyan-500/50 transition-colors btn-show-collab" data-id="${c.id}">
            <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 overflow-hidden">
                ${c.fotoUrl ? `<img src="${c.fotoUrl}" class="w-full h-full object-cover">` : `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`}
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-200 truncate">${c.nome}</p>
                <p class="text-[10px] text-slate-500 truncate">${c.store?.nomeReal || 'Sem Loja'}</p>
            </div>
            ${isExpired ? '<span class="text-[10px] font-bold text-red-400">EXPIRADO</span>' : ''}
        </div>
    `;
}

export function setupComercialEventListeners() {
    document.getElementById('store-management-search')?.addEventListener('input', debounce(() => {
        state.storesCurrentPage = 1;
        renderStoresPage();
    }, 300));

    document.getElementById('active-collaborators-search')?.addEventListener('input', debounce(() => {
        state.activeCollabIndex = 0;
        renderCollaboratorsPage();
    }, 300));

    document.getElementById('expired-collaborators-search')?.addEventListener('input', debounce(() => {
        state.expiredCollabIndex = 0;
        renderCollaboratorsPage();
    }, 300));

    document.querySelectorAll('.btn-show-collab').forEach(el => {
        el.addEventListener('click', () => {
            if (window.showCollaboratorDetails) window.showCollaboratorDetails(el.dataset.id);
        });
    });
}