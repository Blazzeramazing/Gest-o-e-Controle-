import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, orderBy, limit, 
    addDoc, updateDoc, doc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showStatusMessage, showConfirm } from './ui.js';
import { formatDateTime, safeGetDate } from './utils.js';

export function listenForEntries() {
    if (!state.currentUserId) return;
    const q = query(
        collection(db, getPublicPath('veiculos_entradas')),
        orderBy('dataEntrada', 'desc'),
        limit(500)
    );
    const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.activeEntriesCache = docs.filter(d => d.status === 'ativo');
        state.vehicleHistoryCache = docs.filter(d => d.status === 'finalizado');
        
        renderActiveEntries();
        renderVehicleHistoryPage();
        
        if (window.updateHomeKPIs) window.updateHomeKPIs();
        if (window.renderTimelinePage) window.renderTimelinePage();
    });
    state.unsubscribeListeners.push(unsub);
}

export function renderActiveEntries() {
    const listEl = document.getElementById('active-entries-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (state.activeEntriesCache.length === 0) {
        listEl.innerHTML = '<p class="text-slate-500">Nenhum veículo na doca no momento.</p>';
        return;
    }

    state.activeEntriesCache.sort((a, b) => safeGetDate(b.dataEntrada) - safeGetDate(a.dataEntrada)).forEach(entry => {
        const div = document.createElement('div');
        div.className = 'p-4 bg-slate-700/50 border border-slate-600 rounded-lg card w-[75vw] max-w-[280px] sm:w-auto sm:max-w-none flex-shrink-0 sm:flex-shrink snap-center sm:snap-align-none flex flex-col justify-between';
        
        let storesHtml = '<p class="text-sm text-slate-300">Nenhuma loja informada.</p>';
        if (Array.isArray(entry.lojas) && entry.lojas.length > 0) {
            storesHtml = `<ul class="list-disc list-inside space-y-1">${entry.lojas.map(l => `<li class="text-sm text-slate-300">${l.nomeReal} (#${l.numero}) - ${l.nomeFantasia}</li>`).join('')}</ul>`;
        }

        div.innerHTML = `
            <div class="flex flex-wrap justify-between items-start gap-4">
                <div class="flex-grow">
                    <p class="font-bold text-lg text-cyan-400">${entry.placa.toUpperCase() || 'N/A'}</p>
                    <p class="text-sm text-slate-300"><span class="font-semibold text-slate-400">Motorista:</span> ${entry.motorista}</p>
                    <div class="mt-2">
                        <p class="font-semibold text-slate-400">Lojas de Destino:</p>
                        ${storesHtml}
                    </div>
                    ${entry.descricaoCarga ? `<p class="text-sm text-slate-300 break-words mt-2"><span class="font-semibold text-slate-400">Descrição:</span> ${entry.descricaoCarga}</p>` : ''}
                    <p class="text-sm text-slate-400 mt-2"><span class="font-semibold">Entrada:</span> ${formatDateTime(entry.dataEntrada)}</p>
                </div>
                <button class="bg-red-500/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-500 transform hover:scale-105 self-start btn-register-exit" data-id="${entry.id}">
                    Registrar Saída
                </button>
            </div>
            <div id="exit-form-${entry.id}" class="hidden w-full mt-4 pt-4 border-t border-slate-700">
                <form class="flex flex-wrap items-end gap-4 form-exit" data-id="${entry.id}">
                    <div>
                        <label for="exit-time-${entry.id}" class="block text-sm font-medium text-slate-400">Horário de Saída</label>
                        <input type="datetime-local" id="exit-time-${entry.id}" required class="mt-1 w-full p-2 bg-slate-900/50 border border-slate-700 rounded-md text-slate-300">
                    </div>
                    <button type="submit" class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-500 transform hover:scale-105">
                        Confirmar Saída
                    </button>
                </form>
            </div>`;
        listEl.appendChild(div);
    });
}

export function renderVehicleHistoryPage() {
    const listEl = document.getElementById('history-entries-list');
    const placeholder = document.getElementById('history-placeholder');
    if (!listEl) return;

    const searchTerm = (document.getElementById('vehicle-history-search')?.value || '').toLowerCase();
    const filtered = state.vehicleHistoryCache.filter(entry => {
        const storesText = Array.isArray(entry.lojas) ? entry.lojas.map(l => `${l.nomeReal} ${l.nomeFantasia} ${l.numero}`).join(' ') : '';
        return (entry.placa && entry.placa.toLowerCase().includes(searchTerm)) ||
               (entry.motorista && entry.motorista.toLowerCase().includes(searchTerm)) ||
               (storesText.toLowerCase().includes(searchTerm));
    });

    if (filtered.length === 0) {
        if (placeholder) placeholder.classList.remove('hidden');
        listEl.classList.add('hidden');
        return;
    }

    if (placeholder) placeholder.classList.add('hidden');
    listEl.classList.remove('hidden');
    listEl.innerHTML = '';

    const start = (state.vehicleHistoryCurrentPage - 1) * state.vehicleHistoryPerPage;
    const items = filtered.slice(start, start + state.vehicleHistoryPerPage);

    items.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'card bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col justify-between space-y-3 fade-in';
        
        let storesHtml = '';
        if (Array.isArray(entry.lojas) && entry.lojas.length > 0) {
            storesHtml = `<ul class="list-disc list-inside space-y-1">${entry.lojas.map(l => `<li class="text-sm text-slate-300">${l.nomeReal} (#${l.numero})</li>`).join('')}</ul>`;
        }

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start">
                    <span class="px-2 py-1 text-xs font-semibold text-cyan-200 bg-cyan-500/20 rounded-full">${entry.placa.toUpperCase() || 'N/A'}</span>
                </div>
                <div class="mt-3 space-y-2">
                    ${storesHtml}
                    <div>
                        <p class="font-semibold text-slate-200">${entry.motorista}</p>
                        <p class="text-sm text-slate-400">${entry.documento}</p>
                    </div>
                </div>
            </div>
            <div class="text-xs text-slate-400 border-t border-slate-700 pt-2 space-y-1">
                <p><span class="font-semibold text-slate-300">Entrada:</span> ${formatDateTime(entry.dataEntrada)}</p>
                <p><span class="font-semibold text-slate-300">Saída:</span> ${formatDateTime(entry.dataSaida)}</p>
            </div>`;
        listEl.appendChild(card);
    });

    if (window.renderPaginationControls) window.renderPaginationControls('vehicle-history', Math.ceil(filtered.length / state.vehicleHistoryPerPage), state.vehicleHistoryCurrentPage, (p) => { state.vehicleHistoryCurrentPage = p; renderVehicleHistoryPage(); });
}

export function listenForProviders() {
    if (!state.currentUserId) return;
    const q = query(
        collection(db, getPublicPath('prestadores_servico')),
        orderBy('entryTime', 'desc'),
        limit(500)
    );
    const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.activeProvidersCache = docs.filter(d => d.status === 'ativo');
        state.providerHistoryCache = docs.filter(d => d.status === 'finalizado');
        
        renderActiveProviders();
        renderProviderHistoryPage();
        
        if (window.renderTimelinePage) window.renderTimelinePage();
    });
    state.unsubscribeListeners.push(unsub);
}

export function renderActiveProviders() {
    const listEl = document.getElementById('active-providers-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (state.activeProvidersCache.length === 0) {
        listEl.innerHTML = '<p class="text-slate-500">Nenhum prestador de serviço no local.</p>';
        return;
    }

    state.activeProvidersCache.sort((a, b) => safeGetDate(b.entryTime) - safeGetDate(a.entryTime)).forEach(provider => {
        const div = document.createElement('div');
        div.className = 'p-4 bg-slate-700/50 border border-slate-600 rounded-lg card w-[75vw] max-w-[280px] sm:w-auto sm:max-w-none flex-shrink-0 sm:flex-shrink snap-center sm:snap-align-none flex flex-col justify-between';
        
        let teamHtml = (provider.team || []).map(m => `<li class="text-slate-300">${m.name} (${m.doc})</li>`).join('');
        let storesHtml = (provider.lojas || []).map(l => `<li class="text-sm text-slate-300">${l.nomeReal} (#${l.numero})</li>`).join('');

        div.innerHTML = `
            <div class="flex flex-wrap justify-between items-start gap-4">
                <div class="flex-grow min-w-0">
                    <p class="font-bold text-lg text-cyan-400">${provider.company}</p>
                    <div class="mt-2">
                        <p class="font-semibold text-slate-400">Lojas de Destino:</p>
                        <ul class="list-disc list-inside">${storesHtml}</ul>
                    </div>
                    <p class="text-sm text-slate-300 break-words mt-2"><span class="font-semibold text-slate-400">Serviço:</span> ${provider.description}</p>
                    <div class="text-sm text-slate-400 mt-2">
                        <span class="font-semibold">Equipe:</span>
                        <ul class="list-disc list-inside">${teamHtml}</ul>
                    </div>
                    <p class="text-sm text-slate-400 mt-2"><span class="font-semibold">Entrada:</span> ${formatDateTime(provider.entryTime)}</p>
                </div>
                <button class="bg-red-500/80 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-500 transform hover:scale-105 self-start btn-provider-exit" data-id="${provider.id}">
                    Finalizar Serviço
                </button>
            </div>
            <div id="provider-exit-form-${provider.id}" class="hidden w-full mt-4 pt-4 border-t border-slate-700">
                <form class="flex flex-wrap items-end gap-4 form-provider-exit" data-id="${provider.id}">
                    <div>
                        <label for="provider-exit-time-${provider.id}" class="block text-sm font-medium text-slate-400">Horário de Saída</label>
                        <input type="datetime-local" id="provider-exit-time-${provider.id}" required class="mt-1 w-full p-2 bg-slate-900/50 border border-slate-700 rounded-md text-slate-300">
                    </div>
                    <button type="submit" class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-500 transform hover:scale-105">
                        Confirmar Finalização
                    </button>
                </form>
            </div>
        `;
        listEl.appendChild(div);
    });
}

export function renderProviderHistoryPage() {
    const listEl = document.getElementById('provider-history-list');
    const placeholder = document.getElementById('provider-history-placeholder');
    if (!listEl) return;

    const searchTerm = (document.getElementById('provider-history-search')?.value || '').toLowerCase();
    const filtered = state.providerHistoryCache.filter(p => {
        const teamString = (p.team || []).map(m => `${m.name} ${m.doc}`).join(' ');
        const storesText = (p.lojas || []).map(l => `${l.nomeReal} ${l.numero}`).join(' ');
        return (p.company && p.company.toLowerCase().includes(searchTerm)) ||
               (storesText.toLowerCase().includes(searchTerm)) ||
               (teamString.toLowerCase().includes(searchTerm));
    });

    if (filtered.length === 0) {
        if (placeholder) placeholder.classList.remove('hidden');
        listEl.classList.add('hidden');
        return;
    }

    if (placeholder) placeholder.classList.add('hidden');
    listEl.classList.remove('hidden');
    listEl.innerHTML = '';

    const start = (state.providerHistoryCurrentPage - 1) * state.providerHistoryPerPage;
    const items = filtered.slice(start, start + state.providerHistoryPerPage);

    items.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col justify-between space-y-3 fade-in';
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start">
                    <span class="px-2 py-1 text-xs font-semibold text-green-200 bg-green-500/20 rounded-full">${p.company}</span>
                </div>
                <div class="mt-3 space-y-2">
                    <p class="text-sm text-slate-300">${(p.lojas || []).map(l => l.nomeReal).join(', ')}</p>
                    <p class="text-xs text-slate-400">${(p.team || []).map(m => m.name).join(', ')}</p>
                </div>
            </div>
            <div class="text-xs text-slate-400 border-t border-slate-700 pt-2 space-y-1">
                <p><span class="font-semibold text-slate-300">Entrada:</span> ${formatDateTime(p.entryTime)}</p>
                <p><span class="font-semibold text-slate-300">Saída:</span> ${formatDateTime(p.exitTime)}</p>
            </div>
        `;
        listEl.appendChild(card);
    });

    if (window.renderPaginationControls) window.renderPaginationControls('provider-history', Math.ceil(filtered.length / state.providerHistoryPerPage), state.providerHistoryCurrentPage, (p) => { state.providerHistoryCurrentPage = p; renderProviderHistoryPage(); });
}

export function setupLogisticaEventListeners() {
    document.getElementById('active-entries-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-register-exit');
        if (btn) {
            const id = btn.dataset.id;
            const form = document.getElementById(`exit-form-${id}`);
            form.classList.toggle('hidden');
            if (!form.classList.contains('hidden')) {
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                document.getElementById(`exit-time-${id}`).value = now.toISOString().slice(0, 16);
            }
        }
    });

    document.getElementById('active-entries-list')?.addEventListener('submit', async (e) => {
        const form = e.target.closest('.form-exit');
        if (form) {
            e.preventDefault();
            const id = form.dataset.id;
            const time = document.getElementById(`exit-time-${id}`).value;
            try {
                await updateDoc(doc(db, getPublicPath('veiculos_entradas'), id), { status: 'finalizado', dataSaida: new Date(time) });
                showStatusMessage("Saída registrada.");
            } catch (err) { showStatusMessage("Erro ao registrar saída.", "error"); }
        }
    });

    // Prestadores
    document.getElementById('active-providers-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-provider-exit');
        if (btn) {
            const id = btn.dataset.id;
            const form = document.getElementById(`provider-exit-form-${id}`);
            form.classList.toggle('hidden');
            if (!form.classList.contains('hidden')) {
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                document.getElementById(`provider-exit-time-${id}`).value = now.toISOString().slice(0, 16);
            }
        }
    });

    document.getElementById('active-providers-list')?.addEventListener('submit', async (e) => {
        const form = e.target.closest('.form-provider-exit');
        if (form) {
            e.preventDefault();
            const id = form.dataset.id;
            const time = document.getElementById(`provider-exit-time-${id}`).value;
            try {
                await updateDoc(doc(db, getPublicPath('prestadores_servico'), id), { status: 'finalizado', exitTime: new Date(time) });
                showStatusMessage("Serviço finalizado.");
            } catch (err) { showStatusMessage("Erro ao finalizar serviço.", "error"); }
        }
    });
}