import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, orderBy, limit, 
    addDoc, updateDoc, doc, getDoc, setDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showStatusMessage, showConfirm, showPrompt } from './ui.js';
import { formatDateTime, safeGetDate } from './utils.js';

export async function startRondaScanner() {
    if (!state.activeRonda) {
        showStatusMessage("Inicie uma ronda primeiro.", "error");
        return;
    }
    // Lógica para abrir scanner QR
    console.log("Iniciando scanner de ronda...");
    // Aqui viria a integração com Html5QrCode
}

export async function finalizarRonda() {
    if (!state.activeRonda) return;
    if (await showConfirm("Deseja finalizar a ronda atual?")) {
        try {
            const totalLocais = state.activeRonda.locaisTotais || 1;
            const checkins = state.activeRonda.checkins || [];
            const progresso = (checkins.length / totalLocais) * 100;

            await updateDoc(doc(db, getPublicPath('rondas_historico'), state.activeRonda.id), {
                status: 'finalizada',
                dataFim: new Date(),
                progressoFinal: progresso
            });
            showStatusMessage("Ronda finalizada com sucesso!");
        } catch (error) {
            showStatusMessage("Erro ao finalizar ronda.", "error");
        }
    }
}

export async function printAreaQR(id, nome, risco) {
    // Lógica para gerar e imprimir QR Code da área
    console.log(`Gerando QR para área: ${nome} (${id})`);
    if (window.generateGenericPdf) {
        window.generateGenericPdf(`QR_Area_${nome}`, `Área: ${nome}\nCriticidade: ${risco}\nID: ${id}`);
    }
}

export async function deleteArea(id) {
    if (await showConfirm("Deseja excluir esta área crítica?")) {
        try {
            await updateDoc(doc(db, getPublicPath('areas_criticas'), id), { ativa: false });
            showStatusMessage("Área excluída.");
        } catch (error) {
            showStatusMessage("Erro ao excluir área.", "error");
        }
    }
}

export function showRondaTimeline(id) {
    // Lógica para mostrar detalhes/timeline de uma ronda finalizada
    console.log(`Mostrando detalhes da ronda: ${id}`);
}

export function getRondaSetorForRole(role) {
    if (role === 'admin') return 'seguranca';
    if (role === 'coordenador' || role === 'supervisor_seguranca' || role === 'agente') return 'seguranca';
    if (role === 'manutencao') return 'operacoes';
    if (role === 'servicos_gerais') return 'servicos_gerais';
    return 'seguranca';
}

export function getAreaSetor(area) {
    const setor = area?.setorRonda || 'seguranca';
    if (setor === 'operacoes' && area?.departamento === 'coordenador') return 'seguranca';
    return setor;
}

export function getRondaRecordSetor(ronda) {
    const setor = ronda?.setor || 'seguranca';
    if (setor === 'operacoes' && ronda?.departamento === 'coordenador') return 'seguranca';
    return setor;
}

export function applyRondasRoleUI() {
    const role = state.currentUserProfile?.role;
    const setor = role === 'admin' ? (state.rondaSetorFilter || 'seguranca') : getRondaSetorForRole(role);
    const setorContainer = document.getElementById('ronda-setor-filter-container');
    const setorFilter = document.getElementById('ronda-setor-filter');
    const historyFilters = document.getElementById('rondas-history-filters');
    const historyTitle = document.getElementById('rondas-history-title');
    const isLeader = ['admin', 'coordenador', 'servicos_gerais'].includes(role);
    
    if (setorContainer) {
        setorContainer.classList.toggle('hidden', role !== 'admin');
    }
    
    if (role === 'admin' && setorFilter) {
        if (!setorFilter.dataset.bound) {
            setorFilter.addEventListener('change', () => {
                state.rondaSetorFilter = setorFilter.value;
                state.areasCurrentPage = 1;
                state.rondasCurrentPage = 1;
                applyRondasRoleUI();
                renderAreasList();
                renderRondasHistory();
                const all = state.rondasCache;
                if (state.rondaSetorFilter !== 'todos') {
                    state.activeRonda = all.find(r => r.status === 'ativa' && getRondaRecordSetor(r) === state.rondaSetorFilter) || null;
                } else {
                    state.activeRonda = all.find(r => r.status === 'ativa') || null;
                }
                checkActiveRondaUI();
            });
            setorFilter.dataset.bound = '1';
        }
        setorFilter.value = state.rondaSetorFilter;
    }

    const select = document.getElementById('area-setor');
    if (select) {
        if (role === 'admin') {
            select.disabled = false;
            if (state.rondaSetorFilter !== 'todos') select.value = state.rondaSetorFilter;
        } else {
            select.value = setor;
            select.disabled = true;
        }
    }

    if (historyFilters) historyFilters.classList.toggle('hidden', !isLeader);
    if (historyTitle) historyTitle.textContent = isLeader ? 'Histórico de Rondas' : 'Minhas Rondas Recentes (12h)';
    
    if (!isLeader) {
        if (!state._recentInterval) {
            state._recentInterval = setInterval(() => {
                if (document.getElementById('tab-rondas')?.classList.contains('hidden')) return;
                renderRondasHistory();
            }, 60000);
        }
    }
    if (!state.activeRonda) applyRondaTheme(setor);
}

export async function loadAreasBaselineDate() {
    if (state.areasBaselineDate) return;
    const key = 'areasBaselineDate';
    const stored = localStorage.getItem(key);
    if (stored) {
        const d = new Date(stored);
        if (!isNaN(d.getTime())) state.areasBaselineDate = d;
    }
    try {
        const ref = doc(db, getPublicPath('configuracoes'), 'rondas');
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() || {};
            if (data.areasAtivasDesde) {
                const d = safeGetDate(data.areasAtivasDesde);
                if (!isNaN(d.getTime())) {
                    state.areasBaselineDate = d;
                    localStorage.setItem(key, d.toISOString());
                    return;
                }
            }
        }
    } catch (e) {}

    if (!state.areasBaselineDate) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        state.areasBaselineDate = d;
        localStorage.setItem(key, d.toISOString());
        try {
            if (['admin', 'coordenador', 'servicos_gerais'].includes(state.currentUserProfile?.role)) {
                await setDoc(doc(db, getPublicPath('configuracoes'), 'rondas'), { areasAtivasDesde: d }, { merge: true });
            }
        } catch (e) {}
    }
}

export function applyRondaTheme(setor) {
    const hud = document.querySelector('#ronda-ativa-hud > div');
    const progressText = document.getElementById('ronda-progress-text');
    const progressBar = document.getElementById('ronda-progress-bar');

    const theme = setor === 'operacoes'
        ? { border: 'border-blue-500', shadow: 'shadow-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' }
        : (setor === 'servicos_gerais'
            ? { border: 'border-emerald-500', shadow: 'shadow-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' }
            : { border: 'border-cyan-500', shadow: 'shadow-cyan-500/20', text: 'text-cyan-400', bar: 'bg-cyan-500' });

    if (hud) {
        hud.classList.remove('border-cyan-500', 'border-blue-500', 'border-emerald-500', 'shadow-cyan-500/20', 'shadow-blue-500/20', 'shadow-emerald-500/20');
        hud.classList.add(theme.border, theme.shadow);
    }
    if (progressText) {
        progressText.classList.remove('text-cyan-400', 'text-blue-400', 'text-emerald-400');
        progressText.classList.add(theme.text);
    }
    if (progressBar) {
        progressBar.classList.remove('bg-cyan-500', 'bg-blue-500', 'bg-emerald-500');
        progressBar.classList.add(theme.bar);
    }
}

export function listenForAreas() {
    if (!state.currentUserId) return;
    const areasRef = collection(db, getPublicPath('areas_criticas'));
    const cutoff = state.areasBaselineDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const unsub = onSnapshot(query(areasRef, where('dataCriacao', '>=', cutoff), orderBy('dataCriacao', 'desc'), limit(500)), (snap) => {
        state.areasCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(a => a.ativa);
        renderAreasList(); checkActiveRondaUI();
    });
    state.unsubscribeListeners.push(unsub);
}

export function renderAreasList() {
    const list = document.getElementById('areas-list'); 
    const paginationEl = document.getElementById('areas-pagination-controls');
    const searchInput = document.getElementById('area-search');
    if(!list) return;

    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
    let filteredAreas = state.areasCache;
    
    if (searchTerm) {
        filteredAreas = state.areasCache.filter(a => a.nome.toLowerCase().includes(searchTerm) || (a.descricao && a.descricao.toLowerCase().includes(searchTerm)));
    }
    if (state.currentUserProfile?.role === 'admin') {
        if (state.rondaSetorFilter !== 'todos') {
            filteredAreas = filteredAreas.filter(a => getAreaSetor(a) === state.rondaSetorFilter);
        }
    } else {
        const setor = getRondaSetorForRole(state.currentUserProfile?.role);
        filteredAreas = filteredAreas.filter(a => getAreaSetor(a) === setor);
    }

    const startIndex = (state.areasCurrentPage - 1) * state.areasPerPage;
    const endIndex = startIndex + state.areasPerPage;
    const areasToShow = filteredAreas.slice(startIndex, endIndex);

    let html = areasToShow.length ? '' : '<p class="text-slate-500">Nenhuma área.</p>';

    areasToShow.forEach(area => {
        const c = area.criticidade === 'Alta' ? 'text-red-400' : (area.criticidade === 'Média' ? 'text-yellow-400' : 'text-green-400');
        const adminBtns = ['admin', 'coordenador', 'servicos_gerais', 'supervisor_seguranca'].includes(state.currentUserProfile?.role) ? `<div class="flex gap-2"><button class="bg-slate-700 p-2 rounded hover:bg-slate-600 transition-colors btn-print-qr" data-id="${area.id}" data-nome="${area.nome}" data-risco="${area.criticidade}">Gerar QR</button><button class="bg-slate-700 p-2 rounded text-red-400 hover:bg-slate-600 transition-colors btn-delete-area" data-id="${area.id}">X</button></div>` : '';
        html += `<div class="p-3 bg-slate-900/80 border border-slate-700 rounded-lg flex justify-between items-center gap-4"><div><p class="font-bold text-slate-200">${area.nome} <span class="text-xs font-semibold ${c}">[${area.criticidade}]</span></p><p class="text-xs text-slate-400 mt-1">${area.descricao || 'N/A'}</p></div>${adminBtns}</div>`;
    });

    list.innerHTML = html;

    if (paginationEl && window.renderPaginationControls) window.renderPaginationControls('areas', Math.ceil(filteredAreas.length / state.areasPerPage), state.areasCurrentPage, (page) => { state.areasCurrentPage = page; renderAreasList(); });
}

export function listenForRondas() {
    if (!state.currentUserId) return;
    const role = state.currentUserProfile?.role;
    const isLeader = ['admin', 'coordenador', 'servicos_gerais'].includes(role);
    const cutoffMs = (isLeader ? 7 : 1) * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - cutoffMs);
    const rondasRef = collection(db, getPublicPath('rondas_historico'));
    const unsub = onSnapshot(query(rondasRef, where('dataInicio', '>=', cutoff), orderBy('dataInicio', 'desc'), limit(500)), (snap) => {
        state.rondasCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (state.currentUserProfile?.role !== 'admin') {
            const setor = getRondaSetorForRole(state.currentUserProfile?.role);
            state.rondasCache = state.rondasCache.filter(r => getRondaRecordSetor(r) === setor);
            state.activeRonda = state.rondasCache.find(r => r.status === 'ativa') || null;
        } else {
            if (state.rondaSetorFilter !== 'todos') {
                state.activeRonda = state.rondasCache.find(r => r.status === 'ativa' && getRondaRecordSetor(r) === state.rondaSetorFilter) || null;
            } else {
                state.activeRonda = state.rondasCache.find(r => r.status === 'ativa') || null;
            }
        }
        checkActiveRondaUI(); renderRondasHistory();
        if (window.renderTimelinePage) window.renderTimelinePage();
        if (window.updateHomeKPIs) window.updateHomeKPIs();
    }); 
    state.unsubscribeListeners.push(unsub); 
}

export function checkActiveRondaUI() {
    const hud = document.getElementById('ronda-ativa-hud'), init = document.getElementById('ronda-iniciar-container');
    if (state.activeRonda) {
        hud?.classList.remove('hidden'); init?.classList.add('hidden');
        document.getElementById('ronda-agente-nome').textContent = state.activeRonda.agenteNome;
        applyRondaTheme(state.activeRonda.setor || 'seguranca');
        const totalLocais = state.activeRonda.locaisTotais ?? getAreasForRondaTurno(state.activeRonda.turno || 'diurna', state.activeRonda.setor || 'seguranca').length;
        const perc = totalLocais > 0 ? ((state.activeRonda.checkins||[]).length / totalLocais) * 100 : 0;
        document.getElementById('ronda-progress-bar').style.width = `${Math.min(perc, 100)}%`;
        document.getElementById('ronda-progress-text').textContent = `${(state.activeRonda.checkins||[]).length} / ${totalLocais} Locais`;
        
        if(!state.rondaTimerInterval) state.rondaTimerInterval = setInterval(() => {
            const diff = new Date() - safeGetDate(state.activeRonda.dataInicio);
            const timerEl = document.getElementById('ronda-timer');
            if (timerEl) timerEl.textContent = new Date(diff).toISOString().substr(11, 8);
        }, 1000);
    } else { 
        hud?.classList.add('hidden'); 
        init?.classList.remove('hidden'); 
        clearInterval(state.rondaTimerInterval); 
        state.rondaTimerInterval = null; 
    }
}

export function getAreasForRondaTurno(turno, setor) {
    const t = turno || 'diurna';
    const s = setor || 'seguranca';
    return (state.areasCache || []).filter(a => {
        if (!a || a.ativa === false) return false;
        if (getAreaSetor(a) !== s) return false;
        const areaTurno = a.turnoRonda || 'ambas';
        if (areaTurno === 'ambas') return true;
        return areaTurno === t;
    });
}

export function renderRondasHistory() {
    const list = document.getElementById('rondas-history-list'); 
    const paginationEl = document.getElementById('rondas-pagination-controls');
    if(!list) return;
    
    const role = state.currentUserProfile?.role;
    const isLeader = ['admin', 'coordenador', 'servicos_gerais'].includes(role);
    const df = isLeader ? document.getElementById('rondas-history-date').value : '';
    const searchInput = document.getElementById('rondas-history-search');
    const searchTerm = isLeader ? (searchInput ? searchInput.value : '').toLowerCase() : '';

    let f = state.rondasCache.filter(r => r.status === 'finalizada').sort((a,b) => safeGetDate(b.dataInicio) - safeGetDate(a.dataInicio));
    if (state.currentUserProfile?.role !== 'admin') {
        const setor = getRondaSetorForRole(state.currentUserProfile?.role);
        f = f.filter(r => getRondaRecordSetor(r) === setor);
    } else if (state.rondaSetorFilter !== 'todos') {
        f = f.filter(r => getRondaRecordSetor(r) === state.rondaSetorFilter);
    }
    if (!isLeader) {
        const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
        f = f.filter(r => r.agenteId === state.currentUserId && safeGetDate(r.dataFim || r.dataInicio) >= cutoff);
    }
    if(df) f = f.filter(r => safeGetDate(r.dataInicio).toISOString().split('T')[0] === df);
    if(searchTerm) f = f.filter(r => (r.agenteNome || '').toLowerCase().includes(searchTerm));

    const startIndex = (state.rondasCurrentPage - 1) * state.rondasPerPage;
    const endIndex = startIndex + state.rondasPerPage;
    const rondasToShow = f.slice(startIndex, endIndex);

    let html = rondasToShow.length ? '' : '<p class="text-slate-500">Nenhuma ronda no histórico.</p>';

    rondasToShow.forEach(r => { 
        const displayNome = r.agenteNome || (r.agenteRole === 'admin' ? 'Admin' : 'Agente');
        const badge = state.currentUserProfile?.role === 'admin' ? (window.getDeptBadge ? window.getDeptBadge(r.departamento) : '') : ''; 
        const setor = r.setor || 'seguranca';
        const theme = setor === 'operacoes'
            ? { hover: 'hover:border-blue-500', perc: 'text-blue-400', label: 'Operações' }
            : (setor === 'servicos_gerais'
                ? { hover: 'hover:border-emerald-500', perc: 'text-emerald-400', label: 'Serviços Gerais' }
                : { hover: 'hover:border-cyan-500', perc: 'text-cyan-400', label: 'Segurança' });
        const setorBadge = state.currentUserProfile?.role === 'admin' ? `<span class="ml-2 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-slate-300">${theme.label}</span>` : '';
        const turno = r.turno || 'diurna';
        const turnoTheme = turno === 'noturna'
            ? { text: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', label: 'Noturna' }
            : { text: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', label: 'Diurna' };
        const turnoBadge = `<span class="ml-2 text-[10px] font-bold px-2 py-1 rounded-full ${turnoTheme.bg} ${turnoTheme.text} border ${turnoTheme.border}">${turnoTheme.label}</span>`;
        html += `<div class="p-4 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer ${theme.hover} transition-colors btn-show-ronda-timeline" data-id="${r.id}"><div class="flex justify-between items-center"><p class="font-bold text-slate-200">${displayNome} ${badge} ${setorBadge} ${turnoBadge}</p><p class="text-sm font-bold ${theme.perc}">${Math.round(r.progressoFinal)}%</p></div><p class="text-xs text-slate-400 mt-2">${safeGetDate(r.dataInicio).toLocaleDateString()} | Anomalias: <span class="${r.totalAnomalias>0?'text-red-400 font-bold':''}">${r.totalAnomalias}</span></p></div>`; 
    });

    list.innerHTML = html;

    if (paginationEl && window.renderPaginationControls) window.renderPaginationControls('rondas', Math.ceil(f.length / state.rondasPerPage), state.rondasCurrentPage, (page) => { state.rondasCurrentPage = page; renderRondasHistory(); });
}

export function setupRondasEventListeners() {
    document.getElementById('btn-ler-ponto')?.addEventListener('click', () => { if (window.startRondaScanner) window.startRondaScanner(); });
    document.getElementById('btn-finalizar-ronda')?.addEventListener('click', () => { if (window.finalizarRonda) window.finalizarRonda(); });
    document.getElementById('rondas-history-date')?.addEventListener('change', () => { state.rondasCurrentPage = 1; renderRondasHistory(); });
    
    document.getElementById('areas-list')?.addEventListener('click', async (e) => {
        const btn = e.target?.closest?.('button');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('btn-print-qr')) {
            if (window.printAreaQR) window.printAreaQR(id, btn.dataset.nome, btn.dataset.risco);
        }
        if (btn.classList.contains('btn-delete-area')) {
            if (window.deleteArea) window.deleteArea(id);
        }
    });

    document.getElementById('rondas-history-list')?.addEventListener('click', (e) => {
        const item = e.target?.closest?.('.btn-show-ronda-timeline');
        if (item && window.showRondaTimeline) window.showRondaTimeline(item.dataset.id);
    });
}