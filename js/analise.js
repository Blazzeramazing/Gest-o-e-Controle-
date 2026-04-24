import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, orderBy, limit, 
    addDoc, updateDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showStatusMessage, showConfirm } from './ui.js';
import { formatDateTime, safeGetDate, debounce } from './utils.js';

export function listenForReports() {
    if (!state.currentUserId) return;
    const unsub = onSnapshot(query(collection(db, getPublicPath('relatorios')), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
        state.reportsCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!document.getElementById('tab-reports').classList.contains('hidden')) renderReportsPage();
    });
    state.unsubscribeListeners.push(unsub);
}

export function renderReportsPage() {
    const listEl = document.getElementById('reports-list');
    if (!listEl) return;
    
    const startIndex = (state.reportsCurrentPage - 1) * state.reportsPerPage;
    const reportsToShow = state.reportsCache.slice(startIndex, startIndex + state.reportsPerPage);

    if (reportsToShow.length === 0) {
        listEl.innerHTML = '<p class="text-slate-500 text-center py-8">Nenhum relatório encontrado.</p>';
    } else {
        listEl.innerHTML = reportsToShow.map(report => `
            <div class="card bg-slate-900/80 border border-slate-700 rounded-lg p-4 space-y-3">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-slate-200">${report.title}</h3>
                        <p class="text-xs text-slate-500">${formatDateTime(report.createdAt)}</p>
                    </div>
                    <button class="text-red-500 hover:text-red-400 btn-delete-report" data-id="${report.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
                <p class="text-sm text-slate-400 line-clamp-3">${report.description}</p>
                ${report.images?.length ? `<div class="flex gap-2 overflow-x-auto pb-2">${report.images.map(img => `<img src="${img}" class="w-16 h-16 object-cover rounded border border-slate-700 cursor-pointer" onclick="window.openImageViewer('${img}')">`).join('')}</div>` : ''}
            </div>
        `).join('');
    }

    if (window.renderPaginationControls) window.renderPaginationControls('reports', Math.ceil(state.reportsCache.length / state.reportsPerPage), state.reportsCurrentPage, (p) => { state.reportsCurrentPage = p; renderReportsPage(); });
}

export function listenForAuditAdmin() {
    if (!state.currentUserId || state.currentUserProfile?.role !== 'admin') return;
    const q = query(
        collection(db, getPublicPath('auditoria_admin')),
        orderBy('timestamp', 'desc'),
        limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
        state.auditAdminCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!document.getElementById('tab-audit-admin').classList.contains('hidden')) renderAuditAdminPage();
    });
    state.unsubscribeListeners.push(unsub);
}

export function renderAuditAdminPage() {
    const listEl = document.getElementById('audit-admin-list');
    const searchInput = document.getElementById('audit-admin-search');
    if (!listEl) return;

    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
    let filtered = state.auditAdminCache;

    if (searchTerm) {
        filtered = filtered.filter(log => 
            log.adminNome.toLowerCase().includes(searchTerm) ||
            log.acao.toLowerCase().includes(searchTerm) ||
            log.detalhes.toLowerCase().includes(searchTerm)
        );
    }

    const startIndex = (state.auditAdminCurrentPage - 1) * state.auditAdminPerPage;
    const endIndex = startIndex + state.auditAdminPerPage;
    const logsToShow = filtered.slice(startIndex, endIndex);

    if (logsToShow.length === 0) {
        listEl.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500">Nenhum log de auditoria encontrado.</td></tr>`;
    } else {
        listEl.innerHTML = logsToShow.map(log => `
            <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                <td class="px-4 py-3 text-xs font-mono text-slate-500">${formatDateTime(log.timestamp)}</td>
                <td class="px-4 py-3 font-bold text-slate-200">${log.adminNome}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded text-[10px] font-bold uppercase bg-cyan-900/30 text-cyan-400 border border-cyan-500/20">${log.acao}</span></td>
                <td class="px-4 py-3 text-slate-400 text-sm">${log.detalhes}</td>
            </tr>
        `).join('');
    }

    if (window.renderPaginationControls) window.renderPaginationControls('audit-admin', Math.ceil(filtered.length / state.auditAdminPerPage), state.auditAdminCurrentPage, (p) => { state.auditAdminCurrentPage = p; renderAuditAdminPage(); });
}

export function updateDashboard() {
    // Lógica para Chart.js - assumindo que as instâncias estão no state.chartInstances
    console.log("Atualizando Dashboard...");
    // Aqui viria a lógica pesada de agregação de dados para os gráficos
}