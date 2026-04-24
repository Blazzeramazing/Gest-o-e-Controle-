import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, orderBy, limit, 
    addDoc, updateDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showStatusMessage, showConfirm, showPrompt } from './ui.js';
import { formatDateTime, escapeHtml, debounce } from './utils.js';

export function listenForChaves() {
    onSnapshot(collection(db, getPublicPath('chaves_inventario')), (snapshot) => {
        state.chavesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || '')));
        if (!document.getElementById('tab-chaves').classList.contains('hidden')) renderChavesPage();
        if (window.updateHomeKPIs) window.updateHomeKPIs();
    });

    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const historyQuery = query(
        collection(db, getPublicPath('chaves_historico')),
        where('dataRetirada', '>=', trintaDiasAtras),
        orderBy('dataRetirada', 'desc'),
        limit(500)
    );

    onSnapshot(historyQuery, (snapshot) => {
        state.chavesHistoryCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!document.getElementById('tab-chaves').classList.contains('hidden')) renderChavesHistory();
        if (window.renderTimelinePage) window.renderTimelinePage();
        if (window.updateHomeKPIs) window.updateHomeKPIs();
    });
}

export function renderChavesPage() {
    const listEl = document.getElementById('chaves-grid-list');
    const pagEl = document.getElementById('chaves-grid-pagination-controls');
    if (!listEl) return;

    const search = String(document.getElementById('chaves-search')?.value || '').trim().toLowerCase();
    
    document.querySelectorAll('#chaves-armario-tabs button').forEach(btn => {
        const isActive = btn.dataset.chavesArmario === state.chavesActiveArmario;
        btn.className = `chaves-armario-tab flex-1 lg:flex-none px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap ${isActive ? 'bg-slate-800 text-cyan-300 shadow' : 'text-slate-400 hover:text-slate-200'}`;
    });

    let filtered = state.chavesCache.filter(c => state.chavesActiveArmario === 'ALL' || c.armario === state.chavesActiveArmario);
    if (search) filtered = filtered.filter(c => [c.codigo, c.localLabel, c.responsavel].join(' ').toLowerCase().includes(search));

    const startIndex = (state.chavesCurrentPage - 1) * state.chavesPerPage;
    const pageItems = filtered.slice(startIndex, startIndex + state.chavesPerPage);
    const isSuper = state.currentUserProfile?.role === 'admin' || state.currentUserProfile?.role === 'coordenador';

    listEl.innerHTML = pageItems.length ? pageItems.map(c => {
        const isEmp = c.status === 'emprestada';
        return `
        <div class="card bg-slate-800/50 border ${isEmp ? 'border-red-500/50' : 'border-green-500/50'} p-4 rounded-xl flex flex-col gap-3 min-w-[260px] w-[85%] sm:min-w-0 sm:w-auto flex-shrink-0 snap-center">
            <div class="flex justify-between items-start">
                <div><p class="font-bold text-white text-lg">${c.codigo}</p><p class="text-sm text-slate-400">${c.localLabel}</p></div>
                <div class="flex items-center gap-2">
                    <button type="button" class="btn-editar-chave p-2 rounded-lg bg-slate-900/40 border border-slate-700 text-slate-300 hover:bg-slate-700/50" data-id="${c.id}" title="Editar Chave">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L9.832 16.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897l9.682-9.682z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 7.125L16.875 4.5"></path></svg>
                    </button>
                    ${isSuper ? `<button type="button" class="btn-excluir-chave p-2 rounded-lg bg-red-900/40 border border-red-700 text-red-400 hover:bg-red-700/50" data-id="${c.id}" title="Excluir Chave"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>` : ''}
                    <span class="text-[10px] font-bold px-2 py-1 rounded-full ${isEmp ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}">${isEmp ? 'Emprestada' : 'Disponível'}</span>
                </div>
            </div>
            <div class="text-sm text-slate-400 mt-2">${isEmp ? `Com: <strong class="text-slate-200">${c.responsavel}</strong>` : 'Pronta para uso.'}</div>
            <div class="flex gap-2 mt-auto">
                <button class="btn-emprestar-chave flex-1 py-2 rounded text-xs font-bold ${isEmp ? 'bg-slate-700/50 text-slate-500' : 'bg-cyan-600 text-white hover:bg-cyan-500'}" data-id="${c.id}" ${isEmp ? 'disabled' : ''}>Emprestar</button>
                <button class="btn-devolver-chave flex-1 py-2 rounded text-xs font-bold ${!isEmp ? 'bg-slate-700/50 text-slate-500' : 'bg-green-600 text-white hover:bg-green-500'}" data-id="${c.id}" ${!isEmp ? 'disabled' : ''}>Devolver</button>
            </div>
        </div>`;
    }).join('') : '<p class="col-span-full text-slate-500 text-center py-6">Nenhuma chave encontrada.</p>';

    if(pagEl && window.renderPaginationControls) window.renderPaginationControls('chaves-grid', Math.ceil(filtered.length / state.chavesPerPage), state.chavesCurrentPage, (p) => { state.chavesCurrentPage = p; renderChavesPage(); });
}

export function renderChavesHistory() {
    const tbody = document.getElementById('chaves-history-tbody');
    if (!tbody) return;
    const start = (state.chavesHistoryCurrentPage - 1) * state.chavesHistoryPerPage;
    const pageItems = state.chavesHistoryCache.slice(start, start + state.chavesHistoryPerPage);
    
    tbody.innerHTML = pageItems.length ? pageItems.map(h => `
        <tr class="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
            <td class="px-4 py-3 font-semibold text-slate-200 whitespace-nowrap">${h.chaveCodigo} ${h.assinaturaRetirada ? `<button type="button" class="btn-ver-assinatura-chave ml-2 inline-flex items-center justify-center w-8 h-8 rounded bg-slate-800/70 border border-slate-700 text-cyan-300 hover:bg-slate-700/50 align-middle" data-src="${escapeHtml(h.assinaturaRetirada)}" title="Ver assinatura"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21h18"></path></svg></button>` : ''}</td>
            <td class="px-4 py-3 text-slate-300 break-words">${h.localLabel}</td>
            <td class="px-4 py-3 text-slate-300 break-words">${h.responsavelRetirada}</td>
            <td class="px-4 py-3 text-slate-400 whitespace-nowrap">${formatDateTime(h.dataRetirada)}</td>
            <td class="px-4 py-3 text-slate-400 whitespace-nowrap">${formatDateTime(h.dataDevolucao)}</td>
            <td class="px-4 py-3 text-cyan-400/80 font-medium whitespace-nowrap">${h.executorEmprestimoNome || '-'}</td>
            <td class="px-4 py-3 text-emerald-400/80 font-medium whitespace-nowrap">${h.executorDevolucaoNome || '-'}</td>
        </tr>`).join('') : '<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">Sem histórico.</td></tr>';
    
    if (window.renderPaginationControls) window.renderPaginationControls('chaves', Math.ceil(state.chavesHistoryCache.length / state.chavesHistoryPerPage), state.chavesHistoryCurrentPage, (p) => { state.chavesHistoryCurrentPage = p; renderChavesHistory(); });
}

// Lógica de Assinatura Digital
let signaturePad, signatureCtx, isDrawing = false;

export function initSignaturePad() {
    signaturePad = document.getElementById('signature-pad');
    if(!signaturePad) return;
    signatureCtx = signaturePad.getContext('2d');
    
    const rect = signaturePad.parentElement.getBoundingClientRect();
    signaturePad.width = rect.width;
    signaturePad.height = rect.height;
    
    signatureCtx.fillStyle = '#ffffff';
    signatureCtx.fillRect(0, 0, signaturePad.width, signaturePad.height);
    signatureCtx.lineWidth = 2.5;
    signatureCtx.lineCap = 'round';
    signatureCtx.strokeStyle = '#0f172a';

    const getEventPos = (e) => {
        const rect = signaturePad.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        isDrawing = true;
        const pos = getEventPos(e);
        signatureCtx.beginPath();
        signatureCtx.moveTo(pos.x, pos.y);
    };
    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getEventPos(e);
        signatureCtx.lineTo(pos.x, pos.y);
        signatureCtx.stroke();
    };
    const stopDrawing = () => { isDrawing = false; };

    signaturePad.addEventListener('mousedown', startDrawing);
    signaturePad.addEventListener('mousemove', draw);
    signaturePad.addEventListener('mouseup', stopDrawing);
    signaturePad.addEventListener('mouseout', stopDrawing);
    signaturePad.addEventListener('touchstart', startDrawing, { passive: false });
    signaturePad.addEventListener('touchmove', draw, { passive: false });
    signaturePad.addEventListener('touchend', stopDrawing);
}

export function limparAssinatura() {
    if(signatureCtx && signaturePad) {
        signatureCtx.fillStyle = '#ffffff';
        signatureCtx.fillRect(0, 0, signaturePad.width, signaturePad.height);
    }
}

function isSignatureEmpty() {
    if (!signaturePad) return true;
    const blank = document.createElement('canvas');
    blank.width = signaturePad.width;
    blank.height = signaturePad.height;
    const ctx = blank.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, blank.width, blank.height);
    return signaturePad.toDataURL() === blank.toDataURL();
}

export function registrarEmprestimoChave(id) {
    const c = state.chavesCache.find(x => x.id === id);
    if (!c || c.status === 'emprestada') return;
    
    document.getElementById('emprestimo-chave-id').value = id;
    document.getElementById('emprestimo-chave-nome').value = '';
    document.getElementById('emprestimo-chave-info').textContent = `Chave: ${c.codigo} - ${c.localLabel}`;
    
    document.getElementById('modal-emprestimo-chave').classList.remove('hidden');
    
    setTimeout(() => {
        initSignaturePad();
        limparAssinatura();
        document.getElementById('emprestimo-chave-nome').focus();
    }, 50);
}

export async function handleEmprestimoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('emprestimo-chave-id').value;
    const resp = document.getElementById('emprestimo-chave-nome').value.trim();
    
    if (isSignatureEmpty()) {
        showStatusMessage("A assinatura do responsável é obrigatória.", "error");
        return;
    }
    
    const c = state.chavesCache.find(x => x.id === id);
    if (!c) return;

    document.getElementById('modal-emprestimo-chave').classList.add('hidden');
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');

    try {
        const signatureBase64 = signaturePad.toDataURL('image/jpeg', 0.8);
        
        await updateDoc(doc(db, getPublicPath('chaves_inventario'), id), { status: 'emprestada', responsavel: resp });
        await addDoc(collection(db, getPublicPath('chaves_historico')), {
            chaveId: id,
            chaveCodigo: c.codigo,
            localLabel: c.localLabel,
            armario: c.armario,
            responsavelRetirada: resp,
            assinaturaRetirada: signatureBase64,
            dataRetirada: new Date(),
            dataDevolucao: null,
            criadorId: state.currentUserId,
            liderId: state.currentUserProfile.liderId || null,
            executorEmprestimoId: state.currentUserId,
            executorEmprestimoNome: state.currentUserProfile.nome || 'Operador CCO'
        });
        showStatusMessage(`Chave ${c.codigo} emprestada para ${resp}.`);
    } catch (err) {
        showStatusMessage("Erro ao registrar empréstimo.", "error");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

export async function registrarDevolucaoChave(id) {
    if (!(await showConfirm("Confirmar devolução da chave?"))) return;
    await updateDoc(doc(db, getPublicPath('chaves_inventario'), id), { status: 'disponivel', responsavel: null });
    const aberto = state.chavesHistoryCache.find(h => h.chaveId === id && !h.dataDevolucao);
    if (aberto) {
        await updateDoc(doc(db, getPublicPath('chaves_historico'), aberto.id), {
            dataDevolucao: new Date(),
            executorDevolucaoId: state.currentUserId,
            executorDevolucaoNome: state.currentUserProfile.nome || 'Operador CCO'
        });
    }
    showStatusMessage("Devolução registrada.");
}

export async function cadastrarNovaChave(e) {
    e.preventDefault();
    try {
        await addDoc(collection(db, getPublicPath('chaves_inventario')), {
            codigo: document.getElementById('nova-chave-codigo').value.toUpperCase(),
            localLabel: document.getElementById('nova-chave-local').value,
            armario: document.getElementById('nova-chave-armario').value,
            status: 'disponivel', responsavel: null, dataCadastro: new Date(),
            criadorId: state.currentUserId,
            liderId: state.currentUserProfile.liderId || null
        });
        showStatusMessage("Chave cadastrada!");
        e.target.reset();
        document.getElementById('modal-nova-chave').classList.add('hidden');
    } catch(err) {
        showStatusMessage("Erro ao cadastrar.", "error");
    }
}

export async function editarChave(id) {
    const c = state.chavesCache.find(x => x.id === id);
    if (!c) return;
    const novoLocal = await showPrompt("Novo local da chave:", "Editar Chave");
    if (!novoLocal) return;
    try {
        await updateDoc(doc(db, getPublicPath('chaves_inventario'), id), { localLabel: String(novoLocal).trim() });
        showStatusMessage("Chave atualizada com sucesso.");
    } catch (e) {
        showStatusMessage("Erro ao atualizar chave.", "error");
    }
}

export async function excluirChave(id) {
    if (!(await showConfirm("Tem certeza que deseja excluir esta chave definitivamente do inventário?"))) return;
    try {
        await deleteDoc(doc(db, getPublicPath('chaves_inventario'), id));
        showStatusMessage("Chave excluída com sucesso.");
    } catch(e) {
        showStatusMessage("Erro ao excluir chave.", "error");
    }
}

export function setupChavesEventListeners() {
    document.getElementById('form-emprestimo-chave')?.addEventListener('submit', handleEmprestimoSubmit);
    document.getElementById('form-nova-chave')?.addEventListener('submit', cadastrarNovaChave);
    document.getElementById('chaves-armario-tabs')?.addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') {
            state.chavesActiveArmario = e.target.dataset.chavesArmario;
            state.chavesCurrentPage = 1;
            renderChavesPage();
        }
    });
    document.getElementById('chaves-search')?.addEventListener('input', debounce(() => {
        state.chavesCurrentPage = 1;
        renderChavesPage();
    }, 300));

    document.getElementById('chaves-grid-list')?.addEventListener('click', async (e) => {
        const btn = e.target?.closest?.('button[data-id]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('btn-editar-chave')) await editarChave(id);
        if (btn.classList.contains('btn-excluir-chave')) await excluirChave(id);
        if (btn.classList.contains('btn-emprestar-chave')) registrarEmprestimoChave(id);
        if (btn.classList.contains('btn-devolver-chave')) registrarDevolucaoChave(id);
    });

    document.getElementById('chaves-history-tbody')?.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('.btn-ver-assinatura-chave');
        if (btn && window.openImageViewer) window.openImageViewer(btn.dataset.src);
    });
}