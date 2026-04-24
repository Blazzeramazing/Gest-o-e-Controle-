import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, orderBy, limit, 
    updateDoc, deleteDoc, doc, setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    createUserWithEmailAndPassword, updateProfile, signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { secondaryAuth } from './firebase-config.js';
import { showStatusMessage, showConfirm } from './ui.js';
import { debounce } from './utils.js';

export function listenForUsers() {
    onSnapshot(collection(db, getPublicPath('user_profiles')), (snapshot) => {
        state.usersCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!document.getElementById('tab-users').classList.contains('hidden')) renderUsersPage();
    });
}

export function renderUsersPage() {
    const listEl = document.getElementById('users-list-tbody');
    if (!listEl) return;

    const search = String(document.getElementById('users-search')?.value || '').trim().toLowerCase();
    let filtered = state.usersCache || [];
    if (search) filtered = filtered.filter(u => [u.nome, u.email, u.role].join(' ').toLowerCase().includes(search));

    listEl.innerHTML = filtered.length ? filtered.map(u => `
        <tr class="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
            <td class="px-4 py-3">
                <p class="font-bold text-slate-200">${u.nome || 'Sem Nome'}</p>
                <p class="text-xs text-slate-500">${u.email}</p>
            </td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300 uppercase">${u.role}</span>
            </td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold ${u.status === 'bloqueado' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'} uppercase">${u.status || 'ativo'}</span>
            </td>
            <td class="px-4 py-3 text-right space-x-2">
                <button onclick="openEditUserModal('${u.id}')" class="p-2 bg-slate-700 hover:bg-slate-600 rounded-md text-cyan-400" title="Editar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z"></path></svg></button>
                <button onclick="toggleUserBlock('${u.id}', '${u.status}')" class="p-2 bg-slate-700 hover:bg-slate-600 rounded-md ${u.status === 'bloqueado' ? 'text-green-400' : 'text-yellow-400'}" title="${u.status === 'bloqueado' ? 'Ativar' : 'Bloquear'}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636"></path></svg></button>
                <button onclick="deleteUser('${u.id}')" class="p-2 bg-slate-700 hover:bg-slate-600 rounded-md text-red-400" title="Excluir"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </td>
        </tr>`).join('') : '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>';
}

export function openEditUserModal(userId) {
    const user = state.usersCache.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-nome').value = user.nome || '';
    const editRoleSelect = document.getElementById('edit-user-role');
    const role = state.currentUserProfile.role;

    if (role === 'admin') {
        editRoleSelect.innerHTML = `
            <option value="lojista">Gerente Lojista</option>
            <option value="agente">Agente de Segurança</option>
            <option value="admin">Superintendente</option>
            <option value="coordenador">Coordenador</option>
            <option value="supervisor_seguranca">Supervisor de Segurança</option>
            <option value="manutencao">Gerente de Operações</option> 
            <option value="agente_manutencao">Agente de Operações</option> 
            <option value="servicos_gerais">Supervisor de Serviços Gerais</option>
            <option value="agente_servicos_gerais">Agente de Serviços Gerais</option>
        `;
    } else if (role === 'coordenador') {
        editRoleSelect.innerHTML = `
            <option value="lojista">Gerente Lojista</option>
            <option value="agente">Agente de Segurança</option>
            <option value="supervisor_seguranca">Supervisor de Segurança</option>
            <option value="manutencao">Gerente de Operações</option> 
            <option value="agente_manutencao">Agente de Operações</option> 
            <option value="servicos_gerais">Supervisor de Serviços Gerais</option>
            <option value="agente_servicos_gerais">Agente de Serviços Gerais</option>
        `;
    }

    editRoleSelect.value = user.role || 'lojista';

    const storeSelect = document.getElementById('edit-user-store');
    storeSelect.innerHTML = '<option value="" disabled selected>Selecione uma loja...</option>';
    (state.storesCache || []).forEach(store => {
        const opt = document.createElement('option');
        opt.value = store.id;
        opt.textContent = `${store.nomeReal} (#${store.numero})`;
        storeSelect.appendChild(opt);
    });

    const storeContainer = document.getElementById('edit-user-store-container');
    if (user.role === 'lojista') {
        storeContainer.classList.remove('hidden');
        if (user.storeId) storeSelect.value = user.storeId;
    } else {
        storeContainer.classList.add('hidden');
    }

    document.querySelectorAll('#edit-user-permissions input[type="checkbox"]').forEach(cb => {
        if (cb.value === 'inicio') {
            cb.checked = true;
        } else {
            cb.checked = user.permissoes ? user.permissoes.includes(cb.value) : false;
        }
    });

    document.getElementById('edit-user-modal').classList.remove('hidden');
}

export function openAddUserModal() {
    document.getElementById('add-user-form')?.reset();
    
    const storeSelect = document.getElementById('add-user-store');
    storeSelect.innerHTML = '<option value="" disabled selected>Selecione uma loja...</option>';
    (state.storesCache || []).forEach(store => {
        const opt = document.createElement('option');
        opt.value = store.id;
        opt.textContent = `${store.nomeReal} (#${store.numero})`;
        storeSelect.appendChild(opt);
    });

    const role = state.currentUserProfile.role;
    const addRoleSelect = document.getElementById('add-user-role');
    if (role === 'admin') {
        addRoleSelect.innerHTML = `
            <option value="lojista" selected>Gerente Lojista</option>
            <option value="agente">Agente de Segurança</option>
            <option value="admin">Superintendente</option>
            <option value="coordenador">Coordenador</option>
            <option value="supervisor_seguranca">Supervisor de Segurança</option>
            <option value="manutencao">Gerente de Operações</option> 
            <option value="agente_manutencao">Agente de Operações</option> 
            <option value="servicos_gerais">Supervisor de Serviços Gerais</option>
            <option value="agente_servicos_gerais">Agente de Serviços Gerais</option>
        `;
    }

    document.getElementById('add-user-modal').classList.remove('hidden');
}

export async function toggleUserBlock(id, currentStatus) {
    const newStatus = currentStatus === 'bloqueado' ? 'ativo' : 'bloqueado';
    const actionText = newStatus === 'bloqueado' ? 'bloquear o acesso deste usuário' : 'desbloquear este usuário';
     
    if (await showConfirm(`Tem certeza que deseja ${actionText}?`)) {
        try {
            await updateDoc(doc(db, getPublicPath('user_profiles'), id), { status: newStatus });
            const u = state.usersCache.find(x => x.id === id);
            if (window.registrarAuditoriaAdmin) {
                await window.registrarAuditoriaAdmin(newStatus === 'bloqueado' ? "BLOQUEIO_USUÁRIO" : "DESBLOQUEIO_USUÁRIO", `${newStatus === 'bloqueado' ? 'Bloqueou' : 'Desbloqueou'} ${u?.nome || id}`);
            }
            showStatusMessage(`Usuário ${newStatus === 'bloqueado' ? 'bloqueado' : 'desbloqueado'} com sucesso!`);
        } catch (error) {
            showStatusMessage("Erro ao alterar o status do usuário.", "error");
        }
    }
}

export async function deleteUser(userId) {
    if (await showConfirm("Tem certeza que deseja excluir permanentemente o perfil deste usuário? Ele perderá o acesso ao sistema.", "Excluir Usuário")) {
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.classList.remove('hidden');
        try {
            const u = state.usersCache.find(x => x.id === userId);
            await deleteDoc(doc(db, getPublicPath('user_profiles'), userId));
            if (window.registrarAuditoriaAdmin) {
                await window.registrarAuditoriaAdmin("EXCLUSÃO_USUÁRIO", `Excluiu conta de ${u?.nome || userId}`);
            }
            showStatusMessage("Usuário excluído com sucesso.");
        } catch (error) {
            console.error("Erro ao excluir usuário:", error);
            showStatusMessage("Erro ao excluir o usuário.", "error");
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }
}

export async function handleAddUserSubmit(e) {
    e.preventDefault();
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');

    const nome = document.getElementById('add-user-nome').value.trim();
    const email = document.getElementById('add-user-email').value.trim();
    const password = document.getElementById('add-user-password').value;
    const role = document.getElementById('add-user-role').value;
    const storeId = document.getElementById('add-user-store').value;
    const permissoesArray = Array.from(document.querySelectorAll('.add-perm-cb:checked')).map(cb => cb.value);
    if (!permissoesArray.includes('inicio')) permissoesArray.push('inicio');

    let storeObj = null;
    if (role === 'lojista') {
        storeObj = state.storesCache.find(s => s.id === storeId) || null;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newUser = userCredential.user;

        await updateProfile(newUser, { displayName: nome });

        const profileData = {
            nome: nome,
            email: email,
            role: role,
            storeId: role === 'lojista' ? storeId : null,
            store: storeObj,
            departamento: (role === 'agente_manutencao') ? 'manutencao' : (role === 'agente_servicos_gerais' ? 'servicos_gerais' : role),
            status: 'ativo',
            permissoes: permissoesArray,
            liderId: (state.currentUserProfile.role === 'admin' ? null : state.currentUserId),
            createdAt: new Date()
        };
        
        await setDoc(doc(db, getPublicPath('user_profiles'), newUser.uid), profileData);
        if (window.registrarAuditoriaAdmin) {
            await window.registrarAuditoriaAdmin("CRIAÇÃO_USUÁRIO", `Criou novo usuário: ${nome} (${role})`);
        }
        await signOut(secondaryAuth);

        showStatusMessage(`Usuário ${nome} criado com sucesso!`);
        document.getElementById('add-user-modal').classList.add('hidden');
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
            showStatusMessage("Este e-mail já está em uso por outra conta.", "error");
        } else {
            showStatusMessage("Erro ao criar conta. Tente novamente.", "error");
        }
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

export async function handleEditUserSubmit(e) {
    e.preventDefault();
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');

    const userId = document.getElementById('edit-user-id').value;
    const newRole = document.getElementById('edit-user-role').value;
    const novoDept = (newRole === 'agente_manutencao') ? 'manutencao' : (newRole === 'agente_servicos_gerais' ? 'servicos_gerais' : newRole);
    const newNome = document.getElementById('edit-user-nome').value.trim();
    const storeId = document.getElementById('edit-user-store').value;
    const permissoesArray = Array.from(document.querySelectorAll('.edit-perm-cb:checked')).map(cb => cb.value);
    if (!permissoesArray.includes('inicio')) permissoesArray.push('inicio');

    let updatedData = {
        nome: newNome,
        role: newRole,
        storeId: null,
        store: null,
        departamento: novoDept,
        permissoes: permissoesArray
    };

    if (newRole === 'lojista') {
        const storeObj = state.storesCache.find(s => s.id === storeId);
        updatedData.storeId = storeId;
        updatedData.store = storeObj || null;
    }

    try {
        await updateDoc(doc(db, getPublicPath('user_profiles'), userId), updatedData);
        if (window.registrarAuditoriaAdmin) {
            await window.registrarAuditoriaAdmin("EDIÇÃO_USUÁRIO", `Editou perfil de ${newNome} (${newRole})`);
        }
        showStatusMessage("Usuário atualizado com sucesso!");
        document.getElementById('edit-user-modal').classList.add('hidden');
    } catch (error) {
        showStatusMessage("Erro ao atualizar usuário.", "error");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

export function setupUsersEventListeners() {
    document.getElementById('add-user-form')?.addEventListener('submit', handleAddUserSubmit);
    document.getElementById('edit-user-form')?.addEventListener('submit', handleEditUserSubmit);
    document.getElementById('users-search')?.addEventListener('input', debounce(() => {
        renderUsersPage();
    }, 300));
    
    document.getElementById('add-user-role')?.addEventListener('change', (e) => {
        const role = e.target.value;
        const storeContainer = document.getElementById('add-user-store-container');
        if (role === 'lojista') storeContainer.classList.remove('hidden');
        else storeContainer.classList.add('hidden');
    });

    document.getElementById('edit-user-role')?.addEventListener('change', (e) => {
        const role = e.target.value;
        const storeContainer = document.getElementById('edit-user-store-container');
        if (role === 'lojista') storeContainer.classList.remove('hidden');
        else storeContainer.classList.add('hidden');
    });
}
