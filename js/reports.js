import { state } from './state.js';
import { db, storage, getPublicPath } from './firebase-config.js';
import { 
    collection, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { showStatusMessage } from './ui.js';

export async function handleAddReport(e) {
    e.preventDefault();
    const form = e.target;
    const title = form.querySelector('#report-title').value;
    const description = form.querySelector('#report-description').value;
    const loadingOverlay = document.getElementById('loading-overlay');

    loadingOverlay.classList.remove('hidden');
    document.getElementById('loading-text').textContent = 'Enviando relatório...';

    try {
        const imageUrls = [];
        for (let i = 0; i < state.currentReportImages.length; i++) {
            const base64 = state.currentReportImages[i];
            const storageRef = ref(storage, `reports/${Date.now()}_${i}.jpg`);
            await uploadString(storageRef, base64, 'data_url');
            const url = await getDownloadURL(storageRef);
            imageUrls.push(url);
        }

        await addDoc(collection(db, getPublicPath('relatorios')), {
            title,
            description,
            images: imageUrls,
            createdAt: serverTimestamp(),
            criadorId: state.currentUserId,
            criadorNome: state.currentUserProfile.nome,
            departamento: state.currentUserProfile.role,
            liderId: state.currentUserProfile.liderId || null
        });

        showStatusMessage("Relatório enviado com sucesso!");
        form.reset();
        state.currentReportImages = [];
        document.getElementById('report-image-previews').innerHTML = '';
    } catch (error) {
        showStatusMessage("Erro ao enviar relatório.", "error");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

export function handleReportFileSelect(event) {
    const previewContainer = document.getElementById('report-image-previews');
    const files = Array.from(event.target.files);

    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            state.currentReportImages.push(base64);
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700';
            imgWrapper.innerHTML = `
                <img src="${base64}" class="w-full h-full object-cover">
                <button type="button" class="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-lg hover:bg-red-600 transition-colors" onclick="this.parentElement.remove(); state.currentReportImages = state.currentReportImages.filter(img => img !== '${base64}')">
                    &times;
                </button>
            `;
            previewContainer.appendChild(imgWrapper);
        };
        reader.readAsDataURL(file);
    });
}

export function setupReportsEventListeners() {
    document.getElementById('add-report-form')?.addEventListener('submit', handleAddReport);
    document.getElementById('report-images')?.addEventListener('change', handleReportFileSelect);
}