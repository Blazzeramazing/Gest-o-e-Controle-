import { state } from './state.js';
import { auth, db, getPublicPath } from './firebase-config.js';
import { initAuth, login, logout, resetPassword } from './auth.js';
import { showTab, displayTab, setupUIForRole, showStatusMessage, showConfirm, showPrompt, renderPaginationControls } from './ui.js';
import { listenForChaves, setupChavesEventListeners, renderChavesPage, renderChavesHistory, limparAssinatura, registrarEmprestimoChave, registrarDevolucaoChave, excluirChave } from './chaves.js';
import { listenForRondas, listenForAreas, setupRondasEventListeners, renderAreasList, renderRondasHistory, checkActiveRondaUI, loadAreasBaselineDate, applyRondasRoleUI, startRondaScanner, finalizarRonda, printAreaQR, deleteArea, showRondaTimeline } from './rondas.js';
import { listenForAlmoxarifado, listenForAlmoxMovimentacoes, setupAlmoxEventListeners, renderAlmoxarifado, renderAlmoxMovimentacoes, registrarMovimentacao } from './almoxarifado.js';
import { listenForEntries, renderActiveEntries, renderVehicleHistoryPage, listenForProviders, renderActiveProviders, renderProviderHistoryPage, setupLogisticaEventListeners } from './logistica.js';
import { listenForEquipamentos, listenForNotas, listenForOS, listenForPlantao, listenForLoans, renderPlantaoHistory, renderOSPages, renderMyOS, renderApproveOS, renderNotasPage, renderEquipamentosHistoryPage, renderLoansPage, setupOperacionalEventListeners, startEquipamentosCron, finalizarEquipamento } from './operacional.js';
import { listenForStores, renderStoresPage, listenForCollaborators, renderCollaboratorsPage, setupComercialEventListeners } from './comercial.js';
import { listenForUsers, renderUsersPage, openEditUserModal, openAddUserModal, toggleUserBlock, deleteUser, setupUsersEventListeners } from './users.js';
import { listenForChatSessions, initChat, renderChatContacts, openChat, setupChatEventListeners, setupChatViewportFixes } from './chat.js';
import { listenForReports, renderReportsPage, listenForAuditAdmin, renderAuditAdminPage, updateDashboard } from './analise.js';
import { setupReportsEventListeners } from './reports.js';
import { loadSectionPasswords, populatePasswordManagementForm, handlePasswordManagementSave, listenForPortalContent, verifySectionPassword, renderPortalAdmin, renderPortalLoja } from './config.js';
import { updateHomeKPIs, updateHomePageContent, renderTimelinePage, startHomeCarouselLoop } from './home.js';
import { formatDateTime, safeGetDate, debounce, escapeHtml, hashString, loadLib, generateGenericPdf, generateAndSavePdf } from './utils.js';

// Expor funções globais para o HTML (Necessário para onclick e chamadas inline)
window.state = state;
window.showTab = showTab;
window.login = login;
window.logout = logout;
window.resetPassword = resetPassword;
window.renderTimelinePage = renderTimelinePage;
window.updateHomeKPIs = updateHomeKPIs;
window.updateHomePageContent = updateHomePageContent;
window.formatDateTime = formatDateTime;
window.safeGetDate = safeGetDate;
window.escapeHtml = escapeHtml;
window.hashString = hashString;
window.renderPaginationControls = renderPaginationControls;
window.loadLib = loadLib;
window.generateGenericPdf = generateGenericPdf;
window.generateAndSavePdf = generateAndSavePdf;
window.renderChatContacts = renderChatContacts;
window.openChat = openChat;
window.registrarMovimentacao = registrarMovimentacao;

// Operacional
window.startEquipamentosCron = startEquipamentosCron;
window.finalizarEquipamento = finalizarEquipamento;

// Rondas
window.startRondaScanner = startRondaScanner;
window.finalizarRonda = finalizarRonda;
window.printAreaQR = printAreaQR;
window.deleteArea = deleteArea;
window.showRondaTimeline = showRondaTimeline;

// Chaves
window.limparAssinatura = limparAssinatura;
window.registrarEmprestimoChave = registrarEmprestimoChave;
window.registrarDevolucaoChave = registrarDevolucaoChave;
window.excluirChave = excluirChave;

// Usuários
window.openEditUserModal = openEditUserModal;
window.openAddUserModal = openAddUserModal;
window.toggleUserBlock = toggleUserBlock;
window.deleteUser = deleteUser;

// Configurações e Segurança
window.verifySectionPassword = verifySectionPassword;
window.handlePasswordManagementSave = handlePasswordManagementSave;

window.registrarAuditoriaAdmin = async (acao, detalhes) => {
    const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
    if (!state.currentUserId || state.currentUserProfile?.role !== 'admin') return;
    try {
        await addDoc(collection(db, getPublicPath('auditoria_admin')), {
            adminId: state.currentUserId,
            adminNome: state.currentUserProfile.nome || 'Admin',
            acao: acao,
            detalhes: detalhes,
            timestamp: new Date()
        });
    } catch (error) { console.error("Erro ao registrar auditoria:", error); }
};

// Inicialização Global
async function initApp() {
    setupEventListeners();
    setupChatViewportFixes();
    
    if(state.currentUserProfile.role === 'admin' || state.currentUserProfile.role === 'agente') {
        await loadSectionPasswords();
    }

    // Listeners Compartilhados
    listenForStores();
    listenForCollaborators();
    listenForOS();
    listenForPortalContent();
    listenForChatSessions();
    
    if(state.currentUserProfile.role !== 'lojista') {
        listenForEntries();
        listenForProviders();
        listenForReports();
        
        await loadAreasBaselineDate();
        listenForAreas(); 
        listenForRondas();
        listenForPlantao();
        listenForAlmoxarifado();
        listenForAlmoxMovimentacoes();
        listenForChaves();
        listenForNotas();
        listenForUsers();
        listenForAuditAdmin();
        listenForEquipamentos();
        listenForLoans();
    }
    
    startEquipamentosCron();
    updateHomeKPIs();
    showTab('inicio'); 
}

function setupEventListeners() {
    setupChavesEventListeners();
    setupRondasEventListeners();
    setupAlmoxEventListeners();
    setupComercialEventListeners();
    setupChatEventListeners();
    setupLogisticaEventListeners();
    setupReportsEventListeners();
    setupOperacionalEventListeners();
    setupUsersEventListeners();
    
    // Configurações e Segurança
    document.getElementById('password-management-form')?.addEventListener('submit', handlePasswordManagementSave);
    document.getElementById('password-prompt-form')?.addEventListener('submit', verifySectionPassword);
}

// Iniciar Autenticação
initAuth();

// Expor initApp para o Auth
window.initApp = initApp;

// Renderização Universal de Páginas (Chamada pelo ui.js)
window.renderPage = (tabName) => {
    switch(tabName) {
        case 'inicio': 
            updateHomePageContent(); 
            startHomeCarouselLoop();
            break;
        case 'chaves': renderChavesPage(); renderChavesHistory(); break;
        case 'rondas': applyRondasRoleUI(); renderAreasList(); renderRondasHistory(); break;
        case 'almoxarifado': renderAlmoxarifado(); renderAlmoxMovimentacoes(); break;
        case 'timeline': renderTimelinePage(); break;
        case 'stores': renderStoresPage(); break;
        case 'collaborators': renderCollaboratorsPage(); break;
        case 'plantao': renderPlantaoHistory(); break;
        case 'chat': initChat(); break;
        case 'reports': renderReportsPage(); break;
        case 'audit-admin': renderAuditAdminPage(); break;
        case 'dashboard': updateDashboard(); break;
        case 'passwords': populatePasswordManagementForm(); break;
        case 'control': renderActiveEntries(); renderVehicleHistoryPage(); break;
        case 'providers': renderActiveProviders(); renderProviderHistoryPage(); break;
        case 'users': renderUsersPage(); break;
        case 'my-os': renderMyOS(); break;
        case 'approve-os': renderApproveOS(); break;
        case 'equipamentos': renderEquipamentosHistoryPage(); break;
        case 'notas': renderNotasPage(); break;
        case 'emprestimo': renderLoansPage(); break;
        case 'portal-control': renderPortalAdmin(); break;
        case 'portal-lojas': renderPortalLoja(); break;
    }
};
