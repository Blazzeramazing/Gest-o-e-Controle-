const __libs = {
    chart: { src: "https://cdn.jsdelivr.net/npm/chart.js", loaded: false },
    imask: { src: "https://unpkg.com/imask", loaded: false },
    html5qrcode: { src: "https://unpkg.com/html5-qrcode", loaded: false },
    jspdf: { src: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", loaded: false },
    autotable: { src: "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js", loaded: false },
    html2canvas: { src: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", loaded: false }
};

export async function loadLib(name) {
    if (__libs[name].loaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = __libs[name].src;
        script.onload = () => { __libs[name].loaded = true; resolve(); };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

export async function generateGenericPdf(title, headers, dataRows, filename) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    loadingOverlay.classList.remove('hidden');
    loadingText.textContent = 'Gerando Relatório PDF...';
    
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        await loadLib('jspdf');
        if (window.jspdf?.jsPDF) window.jsPDF = window.jspdf.jsPDF;
        await loadLib('autotable');

        const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
        if (!jsPDF) throw new Error('jsPDF não disponível');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        
        pdf.setFontSize(16);
        pdf.text(title, pdfWidth / 2, margin, { align: 'center' });
        pdf.setFontSize(10);
        pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pdfWidth / 2, margin + 5, { align: 'center' });

        if (typeof pdf.autoTable !== 'function' && window.jspdf?.jsPDF?.API?.autoTable) {
            pdf.autoTable = window.jspdf.jsPDF.API.autoTable;
        }
        if (typeof pdf.autoTable !== 'function') throw new Error('autoTable não disponível');

        const safeHeaders = (headers || []).map(h => h == null ? '' : String(h));
        const safeRows = (dataRows || []).map(r => (r || []).map(c => c == null ? '' : String(c)));

        pdf.autoTable({
            head: [safeHeaders],
            body: safeRows,
            startY: margin + 15,
            theme: 'grid',
            headStyles: { fillColor: [230, 230, 230], textColor: 20 },
            styles: { fontSize: 8 },
            margin: { left: margin, right: margin }
        });

        pdf.save(`${filename}.pdf`);

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        if (window.showStatusMessage) window.showStatusMessage("Ocorreu um erro ao gerar o PDF.", "error");
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

export async function generateAndSavePdf(element, filename) {
    try {
        await Promise.all([loadLib('jspdf'), loadLib('html2canvas')]);
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/png');
        const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
        if (!jsPDF) throw new Error('jsPDF não disponível');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = canvas.height * pdfWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save(`${filename}.pdf`);
    } catch(error) {
        console.error("Erro ao gerar PDF:", error);
        if (window.showStatusMessage) window.showStatusMessage("Ocorreu um erro ao gerar o PDF.", "error");
    }
}

export function safeGetDate(timestamp) {
    if (!timestamp) return new Date();
    if (timestamp instanceof Date) return timestamp;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return new Date(timestamp);
}

export function formatDateTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = safeGetDate(timestamp);
    return date.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export async function hashString(str) {
    if (!str) return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}