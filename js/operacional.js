import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, orderBy, limit, doc, updateDoc, addDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { safeGetDate, formatDateTime } from './utils.js';
import { showStatusMessage, showConfirm } from './ui.js';

export function listenForPlantao() { 
    if (!state.currentUserId) return; 
    const unsub = onSnapshot(collection(db, getPublicPath('relatorios_supervisor')), (snap) => { 
        state.relatoriosPlantaoCache = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => safeGetDate(b.createdAt) - safeGetDate(a.createdAt)); 
        renderPlantaoHistory(); 
        if (window.renderTimelinePage) window.renderTimelinePage(); 
    }); 
    state.unsubscribeListeners.push(unsub);
}

export function renderOSPages() {
    renderMyOS();
    renderApproveOS();
}

export function renderMyOS() {
    const list = document.getElementById('my-os-list');
    if (!list) return;

    let filtered = state.osCache.filter(os => os.criadorId === state.currentUserId);
    
    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-center py-8">Você não possui ordens de serviço.</p>';
        return;
    }

    list.innerHTML = filtered.map(os => `
        <div class="card bg-slate-900/80 border ${os.status === 'aprovada' ? 'border-green-500/30' : 'border-slate-700'} rounded-lg p-4 space-y-3">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-bold text-slate-200">${os.tipoServico}</h3>
                    <p class="text-xs text-slate-500">${os.lojaNome}</p>
                </div>
                <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${os.status === 'aprovada' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}">${os.status}</span>
            </div>
            <p class="text-sm text-slate-400">${os.descricao || 'Sem descrição'}</p>
            <div class="text-[10px] text-slate-500 font-mono">${formatDateTime(os.createdAt)}</div>
        </div>
    `).join('');
}

export function renderApproveOS() {
    const list = document.getElementById('approve-os-list');
    if (!list) return;

    let filtered = state.osCache.filter(os => os.status === 'pendente');
    
    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-center py-8">Nenhuma ordem de serviço pendente de aprovação.</p>';
        return;
    }

    list.innerHTML = filtered.map(os => `
        <div class="card bg-slate-900/80 border border-slate-700 rounded-lg p-4 space-y-3">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-bold text-slate-200">${os.tipoServico}</h3>
                    <p class="text-xs text-slate-500">${os.lojaNome} - ${os.solicitanteNome}</p>
                </div>
                <button class="bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded hover:bg-green-500 btn-approve-os" data-id="${os.id}">Aprovar</button>
            </div>
            <p class="text-sm text-slate-400">${os.descricao || 'Sem descrição'}</p>
            <div class="text-[10px] text-slate-500 font-mono">${formatDateTime(os.createdAt)}</div>
        </div>
    `).join('');
}

export function renderEquipamentosHistoryPage() {
    const list = document.getElementById('equipamentos-history-list');
    if (!list) return;

    if (state.equipamentosHistoryCache.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-center py-8">Nenhum histórico de equipamentos.</p>';
        return;
    }

    list.innerHTML = state.equipamentosHistoryCache.map(e => `
        <div class="card bg-slate-900/80 border border-slate-700 rounded-lg p-4 space-y-2">
            <div class="flex justify-between items-center">
                <p class="font-bold text-slate-200">${e.equipamento}</p>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Finalizado</span>
            </div>
            <p class="text-sm text-slate-400">${e.responsavel} - ${e.documento}</p>
            <div class="text-[10px] text-slate-500 font-mono">
                <p>Retirada: ${formatDateTime(e.createdAt)}</p>
                <p>Devolução: ${formatDateTime(e.returnTime)}</p>
            </div>
        </div>
    `).join('');
}

export function renderNotasPage() {
    const list = document.getElementById('notas-list');
    if (!list) return;

    if (state.notasCache.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-center py-8">Nenhuma nota fiscal registrada.</p>';
        return;
    }

    list.innerHTML = state.notasCache.map(n => `
        <div class="card bg-slate-900/80 border border-slate-700 rounded-lg p-4 space-y-2">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-bold text-slate-200">${n.lojaNome}</h3>
                    <p class="text-xs text-slate-500">Nota: ${n.numeroNota}</p>
                </div>
                <span class="text-cyan-400 font-bold">R$ ${n.valor}</span>
            </div>
            <p class="text-sm text-slate-400">${n.descricao || 'Sem descrição'}</p>
            <div class="text-[10px] text-slate-500 font-mono">${formatDateTime(n.dataEmissao)}</div>
        </div>
    `).join('');
}

export function listenForLoans() { 
    if (!state.currentUserId) return; 
    const unsub = onSnapshot(collection(db, getPublicPath('emprestimos_diversos')), (snap) => { 
        state.loansCache = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => safeGetDate(b.createdAt) - safeGetDate(a.createdAt)); 
        renderLoansPage(); 
    }); 
    state.unsubscribeListeners.push(unsub);
}

export function renderLoansPage() {
    const list = document.getElementById('loans-list');
    if (!list) return;

    if (state.loansCache.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-center py-8">Nenhum empréstimo ativo.</p>';
        return;
    }

    list.innerHTML = state.loansCache.map(l => `
        <div class="card bg-slate-900/80 border ${l.status === 'devolvido' ? 'border-green-500/30' : 'border-red-500/30'} rounded-lg p-4 space-y-2">
            <div class="flex justify-between items-center">
                <p class="font-bold text-slate-200">${l.item}</p>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${l.status === 'devolvido' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${l.status}</span>
            </div>
            <p class="text-sm text-slate-400">${l.responsavel} - ${l.lojaNome || 'N/A'}</p>
            <div class="text-[10px] text-slate-500 font-mono">
                <p>Início: ${formatDateTime(l.createdAt)}</p>
                ${l.returnedAt ? `<p>Devolução: ${formatDateTime(l.returnedAt)}</p>` : ''}
            </div>
            ${l.status !== 'devolvido' ? `<button class="w-full mt-2 py-1.5 bg-slate-700 text-white text-xs rounded btn-return-loan" data-id="${l.id}">Registrar Devolução</button>` : ''}
        </div>
    `).join('');
}

export function renderPlantaoHistory() {
    const list = document.getElementById('plantao-history-list'); 
    const paginationEl = document.getElementById('plantao-pagination-controls');
    if(!list) return;

    const searchInput = document.getElementById('plantao-history-search');
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();

    let filtered = state.relatoriosPlantaoCache;
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.supervisorNome.toLowerCase().includes(searchTerm) || 
            p.ocorrencias.toLowerCase().includes(searchTerm)
        );
    }

    const startIndex = (state.plantaoCurrentPage - 1) * state.plantaoPerPage;
    const itemsToShow = filtered.slice(startIndex, startIndex + state.plantaoPerPage);

    if (itemsToShow.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-center py-8">Nenhum relatório de plantão.</p>';
    } else {
        list.innerHTML = itemsToShow.map(p => `
            <div class="card bg-slate-900/80 border border-slate-700 rounded-lg p-4 space-y-2">
                <div class="flex justify-between items-start">
                    <p class="font-bold text-slate-200">${p.supervisorNome}</p>
                    <span class="text-[10px] font-mono text-slate-500">${formatDateTime(p.createdAt)}</span>
                </div>
                <p class="text-sm text-slate-400 line-clamp-2">${p.ocorrencias || 'Sem observações.'}</p>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-slate-500 italic">${p.periodo || 'N/A'}</span>
                    <button class="text-cyan-400 text-xs font-bold hover:underline btn-ver-plantao" data-id="${p.id}">Ver Detalhes</button>
                </div>
            </div>
        `).join('');
    }

    if (window.renderPaginationControls) window.renderPaginationControls('plantao', Math.ceil(filtered.length / state.plantaoPerPage), state.plantaoCurrentPage, (p) => { state.plantaoCurrentPage = p; renderPlantaoHistory(); });
}

export async function approveOS(id) {
    if (await showConfirm("Deseja aprovar esta ordem de serviço?")) {
        try {
            await updateDoc(doc(db, getPublicPath('ordens_servico'), id), {
                status: 'aprovada',
                approvedAt: new Date(),
                approvedBy: state.currentUserId
            });
            showStatusMessage("Ordem de serviço aprovada!");
        } catch (error) {
            showStatusMessage("Erro ao aprovar OS.", "error");
        }
    }
}

export async function finalizarEquipamento(id) {
    if (await showConfirm("Confirmar devolução do equipamento?")) {
        try {
            await updateDoc(doc(db, getPublicPath('equipamentos_emprestados'), id), {
                status: 'finalizado',
                returnTime: new Date()
            });
            showStatusMessage("Equipamento devolvido com sucesso!");
        } catch (error) {
            showStatusMessage("Erro ao registrar devolução.", "error");
        }
    }
}

export function startEquipamentosCron() {
    // Cron para verificar equipamentos atrasados
    console.log("Iniciando cron de equipamentos...");
    setInterval(() => {
        const agora = new Date();
        state.equipamentosCache.filter(e => e.status === 'ativo').forEach(e => {
            const retirada = safeGetDate(e.createdAt);
            const diff = (agora - retirada) / (1000 * 60 * 60); // horas
            if (diff > 24) {
                // Notificar ou marcar como atrasado
            }
        });
    }, 1000 * 60 * 60); // a cada hora
}

export function setupOperacionalEventListeners() {
    document.getElementById('plantao-history-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-ver-plantao');
        if (btn && window.showPlantaoDetails) window.showPlantaoDetails(btn.dataset.id);
    });

    document.getElementById('approve-os-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-approve-os');
        if (btn) approveOS(btn.dataset.id);
    });

    document.getElementById('equipamentos-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('btn-finalizar-equip')) {
            finalizarEquipamento(btn.dataset.id);
        }
    });

    document.getElementById('loans-list')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-return-loan');
        if (btn) {
            const id = btn.dataset.id;
            try {
                await updateDoc(doc(db, getPublicPath('emprestimos_diversos'), id), {
                    status: 'devolvido',
                    returnedAt: new Date()
                });
                showStatusMessage("Devolução registrada.");
            } catch (err) { showStatusMessage("Erro ao registrar devolução.", "error"); }
        }
    });
}

export function listenForEquipamentos() { 
    if (!state.currentUserId) return; 
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const q = query(
        collection(db, getPublicPath('equipamentos_emprestados')),
        where('createdAt', '>=', trintaDiasAtras),
        orderBy('createdAt', 'desc'),
        limit(500)
    );
    const unsub = onSnapshot(q, (snapshot) => { 
        state.equipamentosCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })); 
        state.equipamentosHistoryCache = state.equipamentosCache.filter(e => e.status === 'finalizado').sort((a, b) => safeGetDate(b.returnTime) - safeGetDate(a.returnTime)); 
        if (window.renderEquipamentosHistoryPage) window.renderEquipamentosHistoryPage(); 
        if (window.renderTimelinePage) window.renderTimelinePage();
        if (window.updateHomeKPIs) window.updateHomeKPIs();
    }); 
    state.unsubscribeListeners.push(unsub); 
}

export function listenForNotas() {
    if (!state.currentUserId) return;
    const noventaDiasAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const q = query(
        collection(db, getPublicPath('notas_despesas')),
        where('dataEmissao', '>=', noventaDiasAtras),
        orderBy('dataEmissao', 'desc'),
        limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
        state.notasCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (window.renderNotasPage) window.renderNotasPage();
        if (window.renderTimelinePage) window.renderTimelinePage();
    });
    state.unsubscribeListeners.push(unsub);
}

export function listenForOS() {
    if(!state.currentUserId) return;
    const sessentaDiasAtras = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const q = query(
        collection(db, getPublicPath('ordens_servico')),
        where('createdAt', '>=', sessentaDiasAtras),
        orderBy('createdAt', 'desc'),
        limit(500)
    );
    const unsub = onSnapshot(q, (snapshot) => {
        state.osCache = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        if (window.renderOSPages) window.renderOSPages();
        if (window.renderTimelinePage) window.renderTimelinePage();
        if (window.updateHomeKPIs) window.updateHomeKPIs();
    });
    state.unsubscribeListeners.push(unsub);
}