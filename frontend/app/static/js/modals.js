export function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
}

export function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
}

export function switchTab(id) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const targetTab = document.getElementById(id);
    if (targetTab) targetTab.classList.add('active');
    
    // Find matching button and mark active
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => {
        const onclick = b.getAttribute('onclick') || '';
        return onclick.includes(id);
    });
    if (activeBtn) activeBtn.classList.add('active');
}
