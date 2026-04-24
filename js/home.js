import { state } from './state.js';
import { formatDateTime, safeGetDate } from './utils.js';

export function updateHomeKPIs() {
    const veiculosCount = state.activeEntriesCache.length;
    const chavesCount = state.chavesCache.filter(c => c.status === 'emprestada').length;
    const equipCount = state.equipamentosCache.filter(e => e.status === 'ativo').length;
    const rondasCount = state.rondasCache.filter(r => r.status === 'em_andamento' || r.status === 'ativa').length;

    const veiculosEl = document.getElementById('kpi-veiculos-count');
    const chavesEl = document.getElementById('kpi-chaves-count');
    const equipEl = document.getElementById('kpi-equip-count');
    const rondasEl = document.getElementById('kpi-rondas-count');

    if (veiculosEl) veiculosEl.textContent = veiculosCount;
    if (chavesEl) chavesEl.textContent = chavesCount;
    if (equipEl) equipEl.textContent = equipCount;
    if (rondasEl) rondasEl.textContent = rondasCount;
}

export function updateHomePageContent() {
    const role = state.currentUserProfile?.role;
    const activeCache = role === 'lojista' ? state.portalContentLojaCache : state.portalContentAdminCache;

    const bannerImg = document.querySelector('#home-banner-container img');
    if (bannerImg && activeCache.bannerUrl) bannerImg.src = activeCache.bannerUrl;

    const track = document.getElementById('home-carousel-track');
    if (track) {
        if (activeCache.carousel && activeCache.carousel.length > 0) {
            track.innerHTML = activeCache.carousel.map((item, i) => `
                <div class="carousel-item h-full">
                    <img src="${item.imageUrl}" class="w-full h-full object-cover" loading="lazy" decoding="async">
                </div>
            `).join('');
            state.homeCarouselIndex = 0;
            updateHomeCarousel();
        } else {
            track.innerHTML = '<div class="carousel-item h-full flex items-center justify-center bg-slate-800"><p class="text-slate-500">Nenhuma imagem no carrossel.</p></div>';
        }
    }

    const quoteEl = document.querySelector('#home-quote-container p');
    if (quoteEl && activeCache.quote) quoteEl.textContent = activeCache.quote;
    
    const welcomeTitle = document.querySelector('#home-welcome-text-container h2');
    const welcomeDesc = document.querySelector('#home-welcome-text-container p');
    if (welcomeTitle && activeCache.welcomeText?.title) welcomeTitle.textContent = activeCache.welcomeText.title;
    if (welcomeDesc && activeCache.welcomeText?.description) welcomeDesc.textContent = activeCache.welcomeText.description;
}

export function updateHomeCarousel() {
    const track = document.getElementById('home-carousel-track');
    if (!track) return;
    track.style.transform = `translateX(-${state.homeCarouselIndex * 100}%)`;
}

export function startHomeCarouselLoop() {
    clearInterval(state.homeCarouselInterval);
    const role = state.currentUserProfile?.role;
    const activeCache = role === 'lojista' ? state.portalContentLojaCache : state.portalContentAdminCache;
    
    if (activeCache.carousel && activeCache.carousel.length > 1 && activeCache.carouselLoop) {
        state.homeCarouselInterval = setInterval(() => {
            state.homeCarouselIndex = (state.homeCarouselIndex + 1) % activeCache.carousel.length;
            updateHomeCarousel();
        }, 5000);
    }
}

export function renderTimelinePage() { 
    const listEl = document.getElementById('auditoria-timeline-list'); 
    const filterType = document.getElementById('timeline-filter-type')?.value || 'all'; 
    if (!listEl) return; 

    let atividades = []; 
    const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000); 

    const getNomeUsuario = (userId, defaultNome) => {
        const user = (state.usersCache || []).find(u => u.id === userId);
        if (user && user.role === 'admin') return null; 
        return user ? user.nome : defaultNome;
    };

    const canViewTimelineItem = (itemDept, itemCriadorId) => { 
        const myRole = state.currentUserProfile?.role; 
        const myId = state.currentUserId; 
        if (myRole === 'admin') return true; 
        if (myRole === 'coordenador' || myRole === 'supervisor_seguranca') return itemDept === 'seguranca' || itemDept === 'agente' || itemDept === 'supervisor_seguranca' || itemDept === 'coordenador'; 
        if (myRole === 'manutencao') return itemDept === 'manutencao' || itemDept === 'agente_manutencao'; 
        if (myRole === 'servicos_gerais') return itemDept === 'servicos_gerais' || itemDept === 'agente_servicos_gerais'; 
        return itemCriadorId === myId; 
    }; 

    if (filterType === 'all' || filterType === 'registros') { 
        [...state.activeEntriesCache, ...state.vehicleHistoryCache].forEach(reg => { 
            if (!canViewTimelineItem(reg.departamento || 'agente', reg.criadorId)) return; 
            const executorNome = getNomeUsuario(reg.criadorId, 'Portaria');
            if (!executorNome) return;
            const dataEntrada = safeGetDate(reg.dataEntrada); 
            if (dataEntrada >= vinteQuatroHorasAtras) atividades.push({ data: dataEntrada, tipo: 'veiculo', texto: `Entrada de Veículo: ${reg.placa} - Motorista: ${reg.motorista}`, usuario: executorNome }); 
            if (reg.status === 'finalizado' && reg.dataSaida) { 
                const dataSaida = safeGetDate(reg.dataSaida); 
                if (dataSaida >= vinteQuatroHorasAtras) atividades.push({ data: dataSaida, tipo: 'veiculo', texto: `Saída de Veículo: ${reg.placa}`, usuario: executorNome }); 
            } 
        }); 
        [...state.activeProvidersCache, ...state.providerHistoryCache].forEach(reg => { 
            if (!canViewTimelineItem(reg.departamento || 'agente', reg.criadorId)) return; 
            const executorNome = getNomeUsuario(reg.criadorId, 'Portaria');
            if (!executorNome) return;
            const dataEntrada = safeGetDate(reg.entryTime); 
            if (dataEntrada >= vinteQuatroHorasAtras) atividades.push({ data: dataEntrada, tipo: 'prestador', texto: `Entrada Serviço: ${reg.company}`, usuario: executorNome }); 
            if (reg.status === 'finalizado' && reg.exitTime) { 
                const dataSaida = safeGetDate(reg.exitTime); 
                if (dataSaida >= vinteQuatroHorasAtras) atividades.push({ data: dataSaida, tipo: 'prestador', texto: `Saída Serviço: ${reg.company}`, usuario: executorNome }); 
            } 
        }); 
    } 

    if (filterType === 'all' || filterType === 'almoxarifado') { 
        state.almoxMovimentacoesCache.forEach(mov => { 
            if (!canViewTimelineItem(mov.departamento, mov.criadorId)) return; 
            const executorNome = getNomeUsuario(mov.criadorId, mov.responsavel);
            if (!executorNome) return;
            const dataObj = safeGetDate(mov.dataMovimentacao); 
            if (dataObj >= vinteQuatroHorasAtras) atividades.push({ data: dataObj, tipo: 'almoxarifado', texto: `${mov.tipo.toUpperCase()}: ${mov.quantidade}x ${mov.itemNome}`, usuario: executorNome }); 
        }); 
    } 

    if (filterType === 'all' || filterType === 'rondas') { 
        state.rondasCache.forEach(ronda => { 
            if (!canViewTimelineItem(ronda.departamento, ronda.criadorId)) return; 
            const executorNome = getNomeUsuario(ronda.agenteId, ronda.agenteNome);
            if (!executorNome) return;
            const dataObj = safeGetDate(ronda.dataInicio); 
            if (dataObj >= vinteQuatroHorasAtras) atividades.push({ data: dataObj, tipo: 'ronda', texto: `Ronda Iniciada. Progresso: ${Math.round(ronda.progressoFinal || 0)}%`, usuario: executorNome }); 
            if (ronda.status === 'finalizada' && ronda.dataFim) {
                const dataFim = safeGetDate(ronda.dataFim);
                if (dataFim >= vinteQuatroHorasAtras) atividades.push({ data: dataFim, tipo: 'ronda', texto: `Ronda Finalizada. Progresso: ${Math.round(ronda.progressoFinal || 0)}%`, usuario: executorNome });
            }
        }); 
        state.relatoriosPlantaoCache.forEach(plantao => { 
            if (!canViewTimelineItem(plantao.departamento || 'supervisor_seguranca', plantao.criadorId)) return; 
            const executorNome = getNomeUsuario(plantao.supervisorId, plantao.supervisorNome);
            if (!executorNome) return;
            const dataObj = safeGetDate(plantao.createdAt); 
            if (dataObj >= vinteQuatroHorasAtras) atividades.push({ data: dataObj, tipo: 'plantao', texto: `Relatório de Plantão Entregue.`, usuario: executorNome }); 
        }); 
    } 

    if (filterType === 'all' || filterType === 'chaves') {
        state.chavesHistoryCache.forEach(h => {
            if (!canViewTimelineItem('seguranca', h.criadorId)) return;
            const executorEmp = getNomeUsuario(h.executorEmprestimoId, h.executorEmprestimoNome || h.responsavelRetirada);
            if (executorEmp) {
                const dataRetirada = safeGetDate(h.dataRetirada);
                if (dataRetirada >= vinteQuatroHorasAtras) atividades.push({ data: dataRetirada, tipo: 'chaves', texto: `Chave Retirada: ${h.chaveCodigo} (${h.localLabel}) - Por: ${h.responsavelRetirada}`, usuario: executorEmp });
            }
            if (h.dataDevolucao) {
                const executorDev = getNomeUsuario(h.executorDevolucaoId, h.executorDevolucaoNome || 'Operador');
                if (executorDev) {
                    const dataDevolucao = safeGetDate(h.dataDevolucao);
                    if (dataDevolucao >= vinteQuatroHorasAtras) atividades.push({ data: dataDevolucao, tipo: 'chaves', texto: `Chave Devolvida: ${h.chaveCodigo} (${h.localLabel})`, usuario: executorDev });
                }
            }
        });
    }

    if (filterType === 'all' || filterType === 'equipamentos') {
        state.equipamentosCache.forEach(e => {
            if (!canViewTimelineItem(e.departamento || 'agente', e.criadorId)) return;
            const executor = getNomeUsuario(e.criadorId, 'Segurança');
            if (!executor) return;
            const dataCriacao = safeGetDate(e.createdAt);
            if (dataCriacao >= vinteQuatroHorasAtras) atividades.push({ data: dataCriacao, tipo: 'equipamento', texto: `Empréstimo Equip.: ${e.equipamento} para ${e.responsavel}`, usuario: executor });
            if (e.status === 'finalizado' && e.returnTime) {
                const dataFim = safeGetDate(e.returnTime);
                if (dataFim >= vinteQuatroHorasAtras) atividades.push({ data: dataFim, tipo: 'equipamento', texto: `Devolução Equip.: ${e.equipamento}`, usuario: executor });
            }
        });
    }

    if (filterType === 'all' || filterType === 'os') {
        state.osCache.forEach(os => {
            if (!canViewTimelineItem(os.departamento || 'lojista', os.criadorId)) return;
            const executor = getNomeUsuario(os.criadorId, os.solicitanteNome || 'Lojista');
            if (!executor) return;
            const dataCriacao = safeGetDate(os.createdAt);
            if (dataCriacao >= vinteQuatroHorasAtras) atividades.push({ data: dataCriacao, tipo: 'os', texto: `OS Criada: ${os.tipoServico} - ${os.lojaNome}`, usuario: executor });
            if (os.status === 'aprovada' && os.approvedAt) {
                const dataAprov = safeGetDate(os.approvedAt);
                if (dataAprov >= vinteQuatroHorasAtras) atividades.push({ data: dataAprov, tipo: 'os', texto: `OS Aprovada: ${os.tipoServico}`, usuario: 'Coordenação' });
            }
        });
    }

    if (filterType === 'all' || filterType === 'notas') {
        state.notasCache.forEach(n => {
            if (!canViewTimelineItem(n.departamento || 'admin', n.criadorId)) return;
            const executor = getNomeUsuario(n.criadorId, n.criadorNome || 'Admin');
            if (!executor) return;
            const dataEmissao = safeGetDate(n.dataEmissao);
            if (dataEmissao >= vinteQuatroHorasAtras) atividades.push({ data: dataEmissao, tipo: 'notas', texto: `Nota Registrada: ${n.lojaNome} - R$ ${n.valor}`, usuario: executor });
        });
    }

    atividades.sort((a, b) => b.data - a.data); 
    if (atividades.length === 0) { 
        listEl.innerHTML = '<p class="text-slate-500 text-sm p-4">Nenhuma atividade nas últimas 24 horas.</p>'; 
        return; 
    } 

    listEl.innerHTML = atividades.map(att => { 
        let iconeClass = 'bg-slate-500'; 
        if (att.tipo === 'veiculo' || att.tipo === 'prestador') iconeClass = 'bg-blue-500'; 
        if (att.tipo === 'almoxarifado') iconeClass = 'bg-orange-500'; 
        if (att.tipo === 'ronda' || att.tipo === 'plantao') iconeClass = 'bg-green-500'; 
        if (att.tipo === 'chaves') iconeClass = 'bg-purple-500';
        if (att.tipo === 'equipamento') iconeClass = 'bg-indigo-500';
        if (att.tipo === 'notas') iconeClass = 'bg-emerald-500';
        if (att.tipo === 'os') iconeClass = 'bg-yellow-500';

        return ` 
            <div class="relative"> 
                <div class="absolute -left-[21px] top-1 w-3 h-3 rounded-full ${iconeClass} border-2 border-slate-900"></div> 
                <div class="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 hover:border-cyan-500/30 transition-colors"> 
                    <p class="text-sm font-semibold text-slate-200 break-words">${att.texto}</p> 
                    <div class="flex justify-between items-center mt-1"> 
                        <p class="text-xs text-slate-400">Por: <span class="font-medium text-cyan-400">${att.usuario || 'Sistema'}</span></p> 
                        <p class="text-xs font-mono text-slate-500">${formatDateTime(att.data)}</p> 
                    </div> 
                </div> 
            </div> 
        `; 
    }).join(''); 
}