import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    collection, onSnapshot, addDoc, updateDoc, doc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showStatusMessage, showConfirm } from './ui.js';
import { formatDateTime, safeGetDate, debounce } from './utils.js';

export function listenForAlmoxarifado() {
    if (!state.currentUserId) return;
    const unsub = onSnapshot(collection(db, getPublicPath('almoxarifado_itens')), (snap) => {
        state.almoxarifadoCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAlmoxarifado();
    });
    state.unsubscribeListeners.push(unsub);
}

export function listenForAlmoxMovimentacoes() {
    if (!state.currentUserId) return;
    const unsub = onSnapshot(collection(db, getPublicPath('almoxarifado_movimentacoes')), (snap) => {
        state.almoxMovimentacoesCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => safeGetDate(b.dataMovimentacao) - safeGetDate(a.dataMovimentacao));
        renderAlmoxMovimentacoes();
        if (window.renderTimelinePage) window.renderTimelinePage();
    });
    state.unsubscribeListeners.push(unsub);
}

export function renderAlmoxarifado() {
    const list = document.getElementById('almox-items-list');
    const searchInput = document.getElementById('almox-search');
    if (!list) return;

    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
    let filtered = state.almoxarifadoCache.filter(item => {
        // canViewData logic locally or imported
        const myRole = state.currentUserProfile?.role;
        const myId = state.currentUserId;
        if (myRole === 'admin') return true;
        if (myRole === 'coordenador') {
            return item.departamento === 'seguranca' || item.departamento === 'agente' || item.departamento === 'supervisor_seguranca' || item.departamento === 'coordenador';
        }
        const isLeader = ['manutencao', 'servicos_gerais', 'supervisor_seguranca'].includes(myRole);
        if (isLeader) return item.criadorId === myId || item.liderId === myId;
        return item.criadorId === myId;
    });

    if (searchTerm) {
        filtered = filtered.filter(item => 
            item.nome.toLowerCase().includes(searchTerm) || 
            item.codigo.toLowerCase().includes(searchTerm) ||
            item.categoria.toLowerCase().includes(searchTerm)
        );
    }

    // Update KPIs
    const totalItens = filtered.length;
    const itensCriticos = filtered.filter(item => item.qtdAtual <= item.qtdMinima).length;
    
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const saidasRecentes = state.almoxMovimentacoesCache.filter(m => 
        m.tipo === 'saida' && safeGetDate(m.dataMovimentacao) >= trintaDiasAtras
    ).reduce((acc, curr) => acc + (Number(curr.quantidade) || 0), 0);

    const kpiTotalEl = document.getElementById('almox-kpi-total');
    const kpiCriticoEl = document.getElementById('almox-kpi-critico');
    const kpiSaidasEl = document.getElementById('almox-kpi-saidas');

    if (kpiTotalEl) kpiTotalEl.textContent = totalItens;
    if (kpiCriticoEl) kpiCriticoEl.textContent = itensCriticos;
    if (kpiSaidasEl) kpiSaidasEl.textContent = saidasRecentes;

    const startIndex = (state.almoxCurrentPage - 1) * state.almoxPerPage;
    const endIndex = startIndex + state.almoxPerPage;
    const itemsToShow = filtered.slice(startIndex, endIndex);

    if (itemsToShow.length === 0) {
        list.innerHTML = '<p class="text-slate-500 col-span-full text-center py-8">Nenhum item encontrado.</p>';
    } else {
        list.innerHTML = itemsToShow.map(item => {
            const isCritico = item.qtdAtual <= item.qtdMinima;
            const borderClass = isCritico ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-cyan-500';
            return `
                <div class="card bg-slate-900/80 border border-slate-700 rounded-lg p-4 flex flex-col justify-between gap-4 ${borderClass}">
                    <div>
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${item.categoria}</span>
                            <span class="text-[10px] font-mono text-slate-500">#${item.codigo}</span>
                        </div>
                        <h3 class="font-bold text-slate-200 text-lg leading-tight mb-1">${item.nome}</h3>
                        <div class="flex items-end gap-2">
                            <span class="text-2xl font-black ${isCritico ? 'text-red-400' : 'text-cyan-400'}">${item.qtdAtual}</span>
                            <span class="text-xs text-slate-500 mb-1 font-medium">${item.unidade}(s)</span>
                        </div>
                        ${isCritico ? `<p class="text-[10px] text-red-400 font-bold mt-1 animate-pulse">ESTOQUE ABAIXO DO MÍNIMO (${item.qtdMinima})</p>` : ''}
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <button class="btn-almox-entrada bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 py-1.5 rounded text-xs font-bold hover:bg-emerald-600/30 transition-all" data-id="${item.id}">+ Entrada</button>
                        <button class="btn-almox-saida bg-orange-600/20 text-orange-400 border border-orange-600/30 py-1.5 rounded text-xs font-bold hover:bg-orange-600/30 transition-all" data-id="${item.id}">- Saída</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (window.renderPaginationControls) window.renderPaginationControls('almox', Math.ceil(filtered.length / state.almoxPerPage), state.almoxCurrentPage, (p) => { state.almoxCurrentPage = p; renderAlmoxarifado(); });
}

export function renderAlmoxMovimentacoes() { 
    const tbody = document.getElementById('almox-mov-list'); 
    if (!tbody) return; 

    const searchInput = document.getElementById('almox-mov-search'); 
    const startDateInput = document.getElementById('almox-mov-start-date'); 
    const endDateInput = document.getElementById('almox-mov-end-date'); 

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : ''; 
    const startDateStr = startDateInput ? startDateInput.value : ''; 
    const endDateStr = endDateInput ? endDateInput.value : ''; 

    let filteredMovs = state.almoxMovimentacoesCache.filter(item => {
        const myRole = state.currentUserProfile?.role;
        const myId = state.currentUserId;
        if (myRole === 'admin') return true;
        if (myRole === 'coordenador') return item.departamento === 'seguranca' || item.departamento === 'agente' || item.departamento === 'supervisor_seguranca' || item.departamento === 'coordenador';
        const isLeader = ['manutencao', 'servicos_gerais', 'supervisor_seguranca'].includes(myRole);
        if (isLeader) return item.criadorId === myId || item.liderId === myId;
        return item.criadorId === myId;
    }); 

    if (startDateStr && endDateStr) { 
        const startDate = new Date(startDateStr + 'T00:00:00'); 
        const endDate = new Date(endDateStr + 'T23:59:59'); 
        
        if (startDate <= endDate) { 
            filteredMovs = filteredMovs.filter(m => { 
                if (!m.dataMovimentacao) return false; 
                const movDate = safeGetDate(m.dataMovimentacao); 
                return movDate >= startDate && movDate <= endDate; 
            }); 
        } 
    } 

    if (searchTerm) { 
        filteredMovs = filteredMovs.filter(m => 
            (m.itemNome && m.itemNome.toLowerCase().includes(searchTerm)) || 
            (m.responsavel && m.responsavel.toLowerCase().includes(searchTerm)) || 
            (m.destinoObs && m.destinoObs.toLowerCase().includes(searchTerm)) || 
            (m.tipo && m.tipo.toLowerCase().includes(searchTerm)) 
        ); 
    } 

    const startIndex = (state.almoxMovCurrentPage - 1) * state.almoxMovPerPage; 
    const endIndex = startIndex + state.almoxMovPerPage; 
    const movsToShow = filteredMovs.slice(startIndex, endIndex); 

    if (movsToShow.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">Nenhuma movimentação encontrada para esta busca.</td></tr>`; 
    } else { 
        tbody.innerHTML = movsToShow.map(m => ` 
            <tr class="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"> 
                <td class="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">${formatDateTime(m.dataMovimentacao)}</td> 
                <td class="px-4 py-3 font-medium text-slate-200 break-words">${m.itemNome}</td> 
                <td class="px-4 py-3"> 
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${m.tipo === 'entrada' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}"> 
                        ${m.tipo} 
                    </span> 
                </td> 
                <td class="px-4 py-3 font-bold whitespace-nowrap ${m.tipo === 'entrada' ? 'text-emerald-400' : 'text-orange-400'}">${m.tipo === 'entrada' ? '+' : '-'}${m.quantidade}</td> 
                <td class="px-4 py-3 text-xs break-words">${m.responsavel} <br> ${state.currentUserProfile?.role === 'admin' ? (window.getDeptBadge ? window.getDeptBadge(m.departamento) : '') : ''}</td> 
                <td class="px-4 py-3 text-xs text-slate-400 italic break-words">${m.destinoObs || '-'}</td> 
            </tr> 
        `).join(''); 

        if (window.renderPaginationControls) window.renderPaginationControls('almox-mov', Math.ceil(filteredMovs.length / state.almoxMovPerPage), state.almoxMovCurrentPage, (p) => { state.almoxMovCurrentPage = p; renderAlmoxMovimentacoes(); }); 
    } 
}

export async function registrarMovimentacao(id, tipo) {
    const item = state.almoxarifadoCache.find(i => i.id === id);
    if (!item) return;

    const action = tipo === 'entrada' ? 'Entrada' : 'Saída';
    const msg = `Quantidade de ${action} para: ${item.nome}`;
    const qtyStr = await window.showPrompt(msg, "1");
    if (!qtyStr) return;
    
    const qty = Number(qtyStr);
    if (isNaN(qty) || qty <= 0) {
        showStatusMessage("Quantidade inválida.", "error");
        return;
    }

    if (tipo === 'saida' && qty > item.qtdAtual) {
        showStatusMessage("Estoque insuficiente.", "error");
        return;
    }

    const obs = await window.showPrompt("Observação / Destino (Opcional)", "");
    
    try {
        const newQty = tipo === 'entrada' ? item.qtdAtual + qty : item.qtdAtual - qty;
        await updateDoc(doc(db, getPublicPath('almoxarifado_itens'), id), { qtdAtual: newQty });
        
        await addDoc(collection(db, getPublicPath('almoxarifado_movimentacoes')), {
            itemId: id,
            itemNome: item.nome,
            itemCodigo: item.codigo,
            tipo: tipo,
            quantidade: qty,
            responsavel: state.currentUserProfile.nome || 'Sistema',
            destinoObs: obs || '',
            dataMovimentacao: new Date(),
            departamento: state.currentUserProfile.departamento || 'geral',
            criadorId: state.currentUserId
        });

        showStatusMessage(`${action} registrada com sucesso!`);
    } catch (error) {
        showStatusMessage(`Erro ao registrar ${action.toLowerCase()}.`, "error");
    }
}

export function setupAlmoxEventListeners() {
    document.getElementById('almox-search')?.addEventListener('input', debounce(() => {
        state.almoxCurrentPage = 1;
        renderAlmoxarifado();
    }, 300));
    
    document.getElementById('almox-mov-search')?.addEventListener('input', debounce(() => {
        state.almoxMovCurrentPage = 1;
        renderAlmoxMovimentacoes();
    }, 300));

    document.getElementById('almox-items-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('btn-almox-entrada')) {
            if (window.registrarMovimentacao) window.registrarMovimentacao(id, 'entrada');
        } else if (btn.classList.contains('btn-almox-saida')) {
            if (window.registrarMovimentacao) window.registrarMovimentacao(id, 'saida');
        }
    });
}