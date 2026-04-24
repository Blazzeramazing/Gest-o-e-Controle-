import { state } from './state.js';
import { db, getPublicPath } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, orderBy, limit, 
    addDoc, updateDoc, setDoc, doc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showStatusMessage, showTab } from './ui.js';
import { safeGetDate, debounce, escapeHtml } from './utils.js';

export function listenForChatSessions() { 
    if (!state.currentUserId) return; 
    
    if (state.currentUserProfile.role === 'agente') return; 

    const sessionsCol = collection(db, getPublicPath('chat_sessions')); 
    const unsub = onSnapshot(sessionsCol, (snapshot) => { 
        state.chatSessionsCache = {}; 
        let totalUnread = 0; 

        snapshot.docs.forEach(docSnap => { 
            const session = docSnap.data(); 
            state.chatSessionsCache[docSnap.id] = session; 

            if (state.currentUserProfile.role === 'lojista' && docSnap.id === state.currentUserProfile.storeId) { 
                if (session.unreadLojista) totalUnread++; 
            } else if (state.currentUserProfile.role === 'admin') { 
                if (session.unreadAdmin) totalUnread++; 
            } 
        }); 

        updateNotificationBadges(totalUnread); 

        if (document.getElementById('tab-chat').classList.contains('active') && state.currentUserProfile.role === 'admin') { 
            renderChatContacts(); 
        } 
    }); 
    state.unsubscribeListeners.push(unsub); 
}

function updateNotificationBadges(count) {
    const globalBadge = document.getElementById('global-notification-badge');
    const menuBadge = document.getElementById('menu-chat-badge');

    if (count > 0) {
        if (globalBadge) {
            globalBadge.textContent = count > 9 ? '9+' : count;
            globalBadge.classList.remove('hidden');
        }
        if (menuBadge) {
            menuBadge.textContent = count;
            menuBadge.classList.remove('hidden');
        }
    } else {
        if (globalBadge) globalBadge.classList.add('hidden');
        if (menuBadge) menuBadge.classList.add('hidden');
    }
}

export function initChat() {
    const sidebar = document.getElementById('chat-sidebar');
    const windowEl = document.getElementById('chat-window');
    const backBtn = document.getElementById('chat-back-btn');

    if (state.currentUserProfile.role === 'lojista') {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex');
        windowEl.classList.remove('hidden');
        windowEl.classList.add('flex');
        backBtn.classList.remove('hidden');
        openChat(state.currentUserProfile.storeId, 'Administração da Doca');
    } else {
        renderChatContacts();
        
        if (window.innerWidth < 768) {
            sidebar.classList.remove('hidden');
            sidebar.classList.add('flex');
            windowEl.classList.add('hidden');
            windowEl.classList.remove('flex');
        } else {
            sidebar.classList.remove('hidden');
            sidebar.classList.add('flex');
            windowEl.classList.remove('hidden');
            windowEl.classList.add('flex');
        }

        document.getElementById('chat-input').disabled = true;
        document.getElementById('chat-send-btn').disabled = true;
        document.getElementById('chat-attach-btn').disabled = true;
        document.getElementById('chat-header-name').textContent = "Selecione uma loja";
        document.getElementById('chat-header-status').textContent = "Sistema de Mensagens Integrado";
        document.getElementById('chat-header-avatar').textContent = "?";
        document.getElementById('chat-messages-container').innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="bg-slate-800/80 px-4 py-2 rounded-full text-xs text-slate-400 text-center shadow-sm">
                    As mensagens são protegidas de ponta a ponta e exclusivas entre a loja e Administração.
                </div>
            </div>`;
        state.currentChatStoreId = null;
        state.currentChatAttachment = null;
        document.getElementById('chat-attachment-preview').classList.add('hidden');
        document.getElementById('chat-file-input').value = '';
    }
}

export function renderChatContacts() {
    const listEl = document.getElementById('chat-contacts-list');
    const searchInput = document.getElementById('chat-search');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    const searchTerm = (searchInput?.value || '').toLowerCase();

    const storesWithSessions = state.storesCache.filter(store => 
        store.nomeReal.toLowerCase().includes(searchTerm) || 
        store.nomeFantasia.toLowerCase().includes(searchTerm) || 
        store.numero.includes(searchTerm)
    ).map(store => {
        const session = state.chatSessionsCache[store.id] || { lastMessageTime: 0, unreadAdmin: false };
        return { ...store, session };
    });

    storesWithSessions.sort((a, b) => {
        const timeA = a.session.lastMessageTime ? safeGetDate(a.session.lastMessageTime).getTime() : 0;
        const timeB = b.session.lastMessageTime ? safeGetDate(b.session.lastMessageTime).getTime() : 0;
        return timeB - timeA;
    });

    if (storesWithSessions.length === 0) {
        listEl.innerHTML = '<p class="text-slate-500 text-sm p-4 text-center">Nenhuma loja encontrada.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    storesWithSessions.forEach(store => {
        const btn = document.createElement('button');
        const isSelected = state.currentChatStoreId === store.id;
        const isUnread = store.session.unreadAdmin;
        
        btn.className = `w-full text-left p-4 border-b border-slate-700/50 hover:bg-slate-700/50 flex items-center gap-3 transition-colors ${isSelected ? 'bg-slate-700/50 border-l-4 border-l-cyan-500' : 'border-l-4 border-l-transparent'}`;
        
        const initials = (store.nomeReal || '??').substring(0, 2).toUpperCase();
        const badgeHtml = isUnread ? `<span class="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-800"></span>` : '';

        btn.innerHTML = `
            <div class="relative w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold flex-shrink-0">
                ${initials}
                ${badgeHtml}
            </div>
            <div class="overflow-hidden w-full">
                <div class="flex justify-between items-center w-full">
                    <h4 class="text-slate-200 font-semibold truncate ${isUnread ? 'text-white' : ''}">${store.nomeReal}</h4>
                    ${store.session.lastMessageTime ? `<span class="text-[10px] text-slate-500 ml-2">${safeGetDate(store.session.lastMessageTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>` : ''}
                </div>
                <p class="text-slate-400 text-xs truncate ${isUnread ? 'font-semibold text-slate-300' : ''}">${store.session.lastMessageText || `Loja #${store.numero}`}</p>
            </div>
        `;
        btn.onclick = () => {
            if (window.innerWidth < 768) {
                document.getElementById('chat-sidebar').classList.add('hidden');
                document.getElementById('chat-sidebar').classList.remove('flex');
                document.getElementById('chat-window').classList.remove('hidden');
                document.getElementById('chat-window').classList.add('flex');
            }
            openChat(store.id, store.nomeReal);
        };
        fragment.appendChild(btn);
    });
    listEl.appendChild(fragment);
}

export function openChat(storeId, storeName) {
    state.currentChatStoreId = storeId;
    document.getElementById('chat-header-name').textContent = storeName;
    document.getElementById('chat-header-status').textContent = "online";
    document.getElementById('chat-header-avatar').textContent = (storeName || '??').substring(0, 2).toUpperCase();
    
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const attachBtn = document.getElementById('chat-attach-btn');
    
    input.disabled = false;
    sendBtn.disabled = false;
    attachBtn.disabled = false;
    
    state.currentChatAttachment = null;
    document.getElementById('chat-attachment-preview').classList.add('hidden');
    document.getElementById('chat-file-input').value = '';
    
    input.focus();
    
    if (state._chatUnsubscribe) state._chatUnsubscribe();

    markChatSessionAsRead(storeId);
    
    const chatCol = collection(db, getPublicPath(`chats_${storeId}`));
    state._chatUnsubscribe = onSnapshot(chatCol, (snapshot) => {
        state.chatMessagesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.chatMessagesCache.sort((a,b) => safeGetDate(a.createdAt) - safeGetDate(b.createdAt));
        renderChatMessages();
        markChatSessionAsRead(storeId);
    });

    if (window.innerWidth < 768) { 
        document.querySelector('header')?.classList.add('hidden'); 
        document.getElementById('menu-toggle-btn')?.parentElement?.classList.add('hidden'); 
        const mainApp = document.getElementById('main-app-container'); 
        mainApp?.classList.remove('p-4', 'md:p-8', 'pb-24'); 
        mainApp?.classList.add('p-0'); 
    } 
}

function markChatSessionAsRead(storeId) {
    const isLojista = state.currentUserProfile.role === 'lojista';
    const sessionData = state.chatSessionsCache[storeId];
    if (sessionData) {
        const sessionRef = doc(db, getPublicPath('chat_sessions'), storeId);
        if (isLojista && sessionData.unreadLojista) {
            updateDoc(sessionRef, { unreadLojista: false }).catch(() => {});
        } else if (!isLojista && sessionData.unreadAdmin) {
            updateDoc(sessionRef, { unreadAdmin: false }).catch(() => {});
        }
    }
}

export function renderChatMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    
    const fragment = document.createDocumentFragment();
    
    const headerInfo = document.createElement('div');
    headerInfo.className = 'flex items-center justify-center my-4';
    headerInfo.innerHTML = `
        <div class="bg-slate-800/80 px-4 py-2 rounded-full text-xs text-slate-400 text-center shadow-sm">
            As mensagens são protegidas de ponta a ponta e exclusivas entre a loja e a doca.
        </div>
    `;
    fragment.appendChild(headerInfo);

    if (state.chatMessagesCache.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'text-center text-slate-500 text-sm mt-10';
        emptyMsg.textContent = 'Envie a primeira mensagem para iniciar a conversa.';
        fragment.appendChild(emptyMsg);
        container.innerHTML = '';
        container.appendChild(fragment);
        return;
    }

    let lastDate = null;
    const isLojista = state.currentUserProfile.role === 'lojista';

    state.chatMessagesCache.forEach(msg => {
        const msgDateObj = safeGetDate(msg.createdAt);
        const dateStr = msgDateObj.toLocaleDateString('pt-BR');
        const timeStr = msgDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (dateStr !== lastDate) {
            const dateDivider = document.createElement('div');
            dateDivider.className = 'flex justify-center my-4';
            dateDivider.innerHTML = `<span class="bg-slate-800/80 px-3 py-1 rounded-md text-xs text-slate-400 shadow-sm">${dateStr}</span>`;
            fragment.appendChild(dateDivider);
            lastDate = dateStr;
        }

        const isMe = msg.senderId === state.currentUserId;
        const bubbleAlign = isMe ? 'self-end' : 'self-start';
        const bubbleColor = isMe ? 'bg-teal-700 text-teal-50' : 'bg-slate-700 text-slate-200';
        const bubbleRadius = isMe ? 'rounded-l-xl rounded-tr-xl rounded-br-sm' : 'rounded-r-xl rounded-tl-xl rounded-bl-sm';
        
        const senderLabel = !isMe ? (isLojista ? '<p class="text-xs text-blue-400 font-semibold mb-1">Admin</p>' : '<p class="text-xs text-cyan-400 font-semibold mb-1">Loja</p>') : '';

        let attachmentHtml = '';
        if (msg.attachment) {
            if (msg.attachment.type.startsWith('image/')) {
                attachmentHtml = `<img src="${msg.attachment.base64}" alt="Anexo" class="max-w-[200px] sm:max-w-xs rounded-md mt-2 border border-slate-600/50 cursor-pointer hover:opacity-90 transition-opacity object-cover" onclick="window.open('${msg.attachment.base64}')" loading="lazy" decoding="async">`;
            } else if (msg.attachment.type === 'application/pdf') {
                attachmentHtml = `
                <a href="${msg.attachment.base64}" download="${msg.attachment.name}" class="flex items-center gap-2 p-2 bg-slate-900/50 rounded-md mt-2 hover:bg-slate-800 transition-colors border border-slate-600/50 text-slate-300 no-underline max-w-[200px] sm:max-w-xs">
                    <svg class="w-6 h-6 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path></svg>
                    <span class="text-xs truncate font-medium">${msg.attachment.name}</span>
                    <svg class="w-4 h-4 ml-auto text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </a>`;
            }
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `flex flex-col max-w-[85%] md:max-w-[70%] ${bubbleAlign} mb-1 min-w-[120px]`;
        msgDiv.innerHTML = `
            <div class="${bubbleColor} ${bubbleRadius} p-3 shadow-md relative group">
                ${senderLabel}
                ${msg.text ? `<p class="text-sm whitespace-pre-wrap break-words leading-relaxed">${msg.text}</p>` : ''}
                ${attachmentHtml}
                <div class="flex items-center justify-end gap-1 mt-1 opacity-70">
                    <span class="text-[10px]">${timeStr}</span>
                    ${isMe ? `<svg class="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>` : ''}
                </div>
            </div>
        `;
        fragment.appendChild(msgDiv);
    });

    container.innerHTML = '';
    container.appendChild(fragment);

    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
    });
}

export function setupChatViewportFixes() {
    if (state._chatViewportInitialized) return;
    state._chatViewportInitialized = true;

    const handler = () => {
        const tabChat = document.getElementById('tab-chat');
        if (!tabChat || tabChat.classList.contains('hidden')) return;
        applyChatViewportSizing();
    };

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handler);
        window.visualViewport.addEventListener('scroll', handler);
    }
    window.addEventListener('resize', handler);

    document.addEventListener('focusin', (e) => {
        if (e.target.id === 'chat-input' || e.target.closest('#tab-chat')) {
            setTimeout(handler, 50);
        }
    });

    document.addEventListener('focusout', (e) => {
        if (e.target.id === 'chat-input') {
            setTimeout(handler, 50);
        }
    });
}

function applyChatViewportSizing() {
    const tabChat = document.getElementById('tab-chat');
    const mainAppContainer = document.getElementById('main-app-container');
    if (!tabChat || !mainAppContainer) return;

    if (window.innerWidth >= 768) {
        tabChat.style.height = '';
        tabChat.style.maxHeight = '';
        mainAppContainer.style.paddingBottom = '0.5rem';
        mainAppContainer.classList.remove('pb-24');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        return;
    }

    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const tabTop = tabChat.getBoundingClientRect().top;
    const nextHeight = Math.max(0, Math.floor(viewportHeight - tabTop));

    tabChat.style.height = `${nextHeight}px`;
    tabChat.style.maxHeight = 'none';
    mainAppContainer.style.paddingBottom = '0.5rem';
    mainAppContainer.classList.remove('pb-24');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
}

export function setupChatEventListeners() {
    document.getElementById('chat-search')?.addEventListener('input', debounce(renderChatContacts, 300));
    
    document.getElementById('chat-back-btn')?.addEventListener('click', () => {
        document.querySelector('header')?.classList.remove('hidden');
        document.getElementById('menu-toggle-btn')?.parentElement?.classList.remove('hidden');
        const mainApp = document.getElementById('main-app-container');
        mainApp?.classList.remove('p-0');
        mainApp?.classList.add('p-4', 'md:p-8', 'pb-24');

        if (state.currentUserProfile.role === 'lojista') {
            showTab('inicio');
            return;
        }

        document.getElementById('chat-sidebar').classList.remove('hidden');
        document.getElementById('chat-sidebar').classList.add('flex');
        document.getElementById('chat-window').classList.add('hidden');
        document.getElementById('chat-window').classList.remove('flex');
        state.currentChatStoreId = null;
        if(state._chatUnsubscribe) { state._chatUnsubscribe(); state._chatUnsubscribe = null; }
        renderChatContacts();
    });

    document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        const sendBtn = document.getElementById('chat-send-btn');
        
        if (!text && !state.currentChatAttachment) return;
        if (!state.currentChatStoreId) return;

        input.disabled = true;
        sendBtn.disabled = true;

        const msg = {
            text: text,
            senderId: state.currentUserId,
            senderRole: state.currentUserProfile.role,
            criadorId: state.currentUserId,
            liderId: state.currentUserProfile.liderId || null,
            createdAt: new Date(),
            attachment: state.currentChatAttachment
        };

        try {
            await addDoc(collection(db, getPublicPath(`chats_${state.currentChatStoreId}`)), msg);
            
            const sessionRef = doc(db, getPublicPath('chat_sessions'), state.currentChatStoreId);
            const isLojista = state.currentUserProfile.role === 'lojista';
            const sessionData = {
                lastMessageTime: new Date(),
                lastMessageText: text ? text : (state.currentChatAttachment ? '[Arquivo Anexado]' : ''),
                unreadLojista: !isLojista,
                unreadAdmin: isLojista
            };
            await setDoc(sessionRef, sessionData, { merge: true });

            input.value = '';
            input.style.height = 'auto'; 
            state.currentChatAttachment = null;
            document.getElementById('chat-attachment-preview').classList.add('hidden');
            document.getElementById('chat-file-input').value = '';

        } catch (error) {
            showStatusMessage("Erro ao enviar a mensagem ou anexo.", "error");
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    });

    document.getElementById('chat-attach-btn')?.addEventListener('click', () => {
        document.getElementById('chat-file-input').click();
    });

    document.getElementById('chat-remove-attachment')?.addEventListener('click', () => {
        state.currentChatAttachment = null;
        document.getElementById('chat-file-input').value = '';
        document.getElementById('chat-attachment-preview').classList.add('hidden');
    });

    document.getElementById('chat-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const MAX_FILE_SIZE = 800 * 1024; 
        if (file.size > MAX_FILE_SIZE && file.type === 'application/pdf') {
            showStatusMessage('PDF muito grande! O limite é de 800KB.', 'error');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (readEvent) => {
            if (file.type.startsWith('image/')) {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    state.currentChatAttachment = {
                        base64: canvas.toDataURL('image/jpeg', 0.8),
                        name: file.name,
                        type: file.type
                    };
                    showChatAttachmentPreview();
                    canvas.width = 0; canvas.height = 0;
                };
                img.src = readEvent.target.result;
            } else if (file.type === 'application/pdf') {
                state.currentChatAttachment = {
                    base64: readEvent.target.result,
                    name: file.name,
                    type: file.type
                };
                showChatAttachmentPreview();
            } else {
                showStatusMessage('Tipo de arquivo não suportado.', 'error');
                e.target.value = '';
            }
        };
        reader.readAsDataURL(file);
    });
}

function showChatAttachmentPreview() {
    const previewDiv = document.getElementById('chat-attachment-preview');
    const thumbDiv = document.getElementById('chat-attachment-thumb');
    const nameSpan = document.getElementById('chat-attachment-name');

    if (state.currentChatAttachment.type.startsWith('image/')) {
        thumbDiv.style.backgroundImage = `url(${state.currentChatAttachment.base64})`;
        thumbDiv.innerHTML = '';
    } else {
        thumbDiv.style.backgroundImage = 'none';
        thumbDiv.innerHTML = `<svg class="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path></svg>`;
    }
    nameSpan.textContent = state.currentChatAttachment.name;
    previewDiv.classList.remove('hidden');
}