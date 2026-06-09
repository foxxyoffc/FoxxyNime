const API_BASE = 'https://backend-anda.vercel.app/api';
const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id || null;

if (!telegramId) {
    alert('Buka dari Telegram resmi ya!');
}

let currentContent = null;
let currentType = 'anime';
let userVip = false;

async function fetchUserStatus() {
    if (!telegramId) return;
    try {
        const res = await fetch(`${API_BASE}/user/status`, {
            headers: { 'x-telegram-id': telegramId }
        });
        const data = await res.json();
        userVip = data.vipDracin;
        document.getElementById('vipBadge').innerHTML = userVip ? '👑 VIP Dracin Unlimited' : '🔓 Anime & Donghua | Dracin 1-10 gratis';
    } catch (err) {
        console.error('Gagal fetch status user:', err);
    }
}

async function loadContents(type) {
    const container = document.getElementById('contentList');
    container.innerHTML = '<div class="loading">Loading...</div>';
    try {
        const res = await fetch(`${API_BASE}/contents?type=${type}&limit=30`);
        const contents = await res.json();
        if (contents.length === 0) {
            container.innerHTML = '<div class="loading">Tidak ada konten.</div>';
            return;
        }
        container.innerHTML = contents.map(c => `
            <div class="card" data-id="${c._id}" data-title="${escapeHtml(c.title)}" data-total="${c.totalEpisodes}" data-type="${c.type}">
                <img src="${c.thumbnail || 'https://via.placeholder.com/80x110?text=No+Img'}" onerror="this.src='https://via.placeholder.com/80x110?text=Anime'">
                <div class="card-info">
                    <h3>${escapeHtml(c.title)}</h3>
                    <p>${c.totalEpisodes} episode • ${c.type === 'dracin' ? (userVip ? 'VIP unlimited' : 'Gratis 1-10') : 'Gratis semua'}</p>
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => {
                currentContent = {
                    id: card.dataset.id,
                    title: card.dataset.title,
                    totalEpisodes: parseInt(card.dataset.total),
                    type: card.dataset.type
                };
                openPlayer();
            });
        });
    } catch (err) {
        container.innerHTML = '<div class="loading">Error loading konten. Coba lagi nanti.</div>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function openPlayer() {
    const modal = document.getElementById('playerModal');
    const modalTitle = document.getElementById('modalTitle');
    const epSelector = document.getElementById('epSelector');
    modalTitle.innerText = currentContent.title;
    
    let buttonsHtml = '';
    for (let i = 1; i <= currentContent.totalEpisodes; i++) {
        let isLocked = false;
        if (currentContent.type === 'dracin' && i > 10 && !userVip) {
            isLocked = true;
        }
        buttonsHtml += `<button class="ep-btn ${isLocked ? 'locked' : ''}" data-ep="${i}">EP ${i} ${isLocked ? '🔒' : ''}</button>`;
    }
    epSelector.innerHTML = buttonsHtml;
    
    document.querySelectorAll('.ep-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const ep = parseInt(btn.dataset.ep);
            await playEpisode(ep);
        });
    });
    
    modal.classList.remove('hidden');
}

async function playEpisode(ep) {
    const videoFrame = document.getElementById('videoFrame');
    videoFrame.src = 'about:blank';
    
    try {
        const res = await fetch(`${API_BASE}/episode/${currentContent.id}/${ep}`, {
            headers: { 'x-telegram-id': telegramId }
        });
        if (res.status === 402) {
            const data = await res.json();
            alert(data.message + '\n' + data.paymentLink);
            window.Telegram.WebApp.openTelegramLink(data.paymentLink);
            return;
        }
        if (!res.ok) throw new Error('Gagal load');
        const data = await res.json();
        videoFrame.src = data.embedUrl;
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

document.querySelector('.close')?.addEventListener('click', () => {
    document.getElementById('playerModal').classList.add('hidden');
    document.getElementById('videoFrame').src = '';
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        loadContents(currentType);
    });
});

fetchUserStatus().then(() => {
    loadContents('anime');
});

window.Telegram.WebApp.ready();
window.Telegram.WebApp.expand();
