export function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
}

export function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
}

export function switchTab(id) {
    // Hide all tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    // Deactivate all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activate the targeted tab pane
    const targetPane = document.getElementById(id);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    // Activate the targeted tab button
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${id}"]`) || Array.from(document.querySelectorAll('.tab-btn')).find(b => {
        const onclick = b.getAttribute('onclick') || '';
        return onclick.includes(id);
    });
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}
