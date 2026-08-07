const DEFAULT_QUESTS = [
    { id: 'hydrate', name: 'Hydrate', icon: '💧', xp: 20 },
    { id: 'walk', name: 'Walk', icon: '🚶', xp: 20 },
    { id: 'workout', name: 'Workout', icon: '🏋️', xp: 25 },
    { id: 'protein', name: 'Eat high protein', icon: '🍗', xp: 20 },
    { id: 'learn', name: 'Learn something', icon: '📚', xp: 20 },
    { id: 'peace', name: 'Protect your peace', icon: '🧠', xp: 20 },
    { id: 'sleep', name: 'Sleep on time', icon: '😴', xp: 20 },
];

let QUESTS = [...DEFAULT_QUESTS];

function getLocalDate() {
    const d = new Date();
    return d.getFullYear() + '-' + 
           String(d.getMonth() + 1).padStart(2, '0') + '-' + 
           String(d.getDate()).padStart(2, '0');
}

function dateStringToDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

let currentDate = getLocalDate();
let allDays = {};
let stats = { health: 2, mind: 2, discipline: 2, confidence: 3 };
let totalXP = 0;
let deferredPrompt = null;
let customQuests = [];
let npcTraps = [];
let sideQuests = [];

// Level calculation
function getLevelFromXP(xp) {
    if (xp < 500) return 1;
    if (xp < 1000) return 2;
    if (xp < 1500) return 3;
    if (xp < 2000) return 4;
    if (xp < 2500) return 5;
    return Math.floor(xp / 500);
}

function getXPForLevel(level) {
    return (level - 1) * 500;
}

function getXPToNextLevel(xp) {
    const currentLevel = getLevelFromXP(xp);
    const nextLevelXP = currentLevel * 500;
    return nextLevelXP - xp;
}

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(registration => console.log('Service Worker registered'))
        .catch(err => console.log('Service Worker registration failed:', err));
}

// Handle install prompt
window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    document.getElementById('installPrompt').classList.add('show');
});

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choiceResult => {
            if (choiceResult.outcome === 'accepted') {
                console.log('App installed');
            }
            deferredPrompt = null;
            dismissInstall();
        });
    }
}

function dismissInstall() {
    document.getElementById('installPrompt').classList.remove('show');
}

function loadData() {
    try {
        const saved = localStorage.getItem('lifeSimulator_days');
        if (saved) allDays = JSON.parse(saved);

        const savedStats = localStorage.getItem('lifeSimulator_stats');
        if (savedStats) stats = JSON.parse(savedStats);

        const savedXP = localStorage.getItem('lifeSimulator_totalXP');
        if (savedXP) totalXP = parseInt(savedXP, 10);

        const savedCustomQuests = localStorage.getItem('lifeSimulator_customQuests');
        if (savedCustomQuests) customQuests = JSON.parse(savedCustomQuests);

        const savedNPCTraps = localStorage.getItem('lifeSimulator_npcTraps');
        if (savedNPCTraps) npcTraps = JSON.parse(savedNPCTraps);

        const savedSideQuests = localStorage.getItem('lifeSimulator_sideQuests');
        if (savedSideQuests) sideQuests = JSON.parse(savedSideQuests);

        QUESTS = [...DEFAULT_QUESTS, ...customQuests];

        console.log('✓ Data loaded successfully', { allDays, stats, totalXP, customQuests, npcTraps, sideQuests });
    } catch (err) {
        console.error('Error loading data:', err);
        alert('Storage issue detected. Try: Settings → Privacy → Clear site data');
    }
}

function saveData() {
    try {
        localStorage.setItem('lifeSimulator_days', JSON.stringify(allDays));
        localStorage.setItem('lifeSimulator_stats', JSON.stringify(stats));
        localStorage.setItem('lifeSimulator_totalXP', totalXP.toString());
        localStorage.setItem('lifeSimulator_customQuests', JSON.stringify(customQuests));
        localStorage.setItem('lifeSimulator_npcTraps', JSON.stringify(npcTraps));
        localStorage.setItem('lifeSimulator_sideQuests', JSON.stringify(sideQuests));
        console.log('✓ Data saved:', { totalXP, statsLevel: getLevelFromXP(totalXP) });
    } catch (err) {
        console.error('Error saving data:', err);
        alert('Storage full or unavailable. Clear some space and try again.');
    }
}

function exportData() {
    const backup = {
        timestamp: new Date().toISOString(),
        allDays,
        stats,
        totalXP,
        level: getLevelFromXP(totalXP),
        customQuests,
        npcTraps,
        sideQuests
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-simulator-backup-${getLocalDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                allDays = backup.allDays || {};
                stats = backup.stats || { health: 2, mind: 2, discipline: 2, confidence: 3 };
                totalXP = backup.totalXP || 0;
                customQuests = backup.customQuests || [];
                npcTraps = backup.npcTraps || [];
                sideQuests = backup.sideQuests || [];
                QUESTS = [...DEFAULT_QUESTS, ...customQuests];
                saveData();
                updateDisplay();
                alert('✓ Data restored! Refresh the page.');
            } catch (err) {
                alert('Invalid backup file');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function getCurrentDayData() {
    if (!allDays[currentDate]) {
        allDays[currentDate] = { quests: {}, traps: {}, sideQuests: {}, journal: '' };
    }
    return allDays[currentDate];
}

function updateDisplay() {
    const date = dateStringToDate(currentDate);
    document.getElementById('dateDisplay').textContent = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
    document.getElementById('dayIndicator').textContent = currentDate;
    document.getElementById('daysTracked').textContent = Object.keys(allDays).length;

    const dayData = getCurrentDayData();
    document.getElementById('journal').value = dayData.journal || '';

    // Update level display
    const currentLevel = getLevelFromXP(totalXP);
    const levelXP = getXPForLevel(currentLevel);
    const nextLevelXP = getXPForLevel(currentLevel + 1);
    const xpInCurrentLevel = totalXP - levelXP;
    const xpNeededForLevel = nextLevelXP - levelXP;
    const progressPercent = (xpInCurrentLevel / xpNeededForLevel) * 100;

    document.getElementById('playerLevel').textContent = currentLevel;
    document.getElementById('totalXPDisplay').textContent = totalXP;
    document.getElementById('xpToNext').textContent = Math.max(0, nextLevelXP - totalXP);
    document.getElementById('xpBar').style.width = Math.min(100, progressPercent) + '%';

    updateQuests(dayData.quests);
    updateTraps(dayData.traps);
    updateSideQuests(dayData.sideQuests);
    updateStats();
    updateScores(dayData.quests, dayData.sideQuests);
}

function updateQuests(quests) {
    const list = document.getElementById('questList');
    list.innerHTML = '';
    QUESTS.forEach(quest => {
        const completed = quests[quest.id] || false;
        const isCustom = customQuests.some(q => q.id === quest.id);
        const div = document.createElement('div');
        div.className = `quest-item ${completed ? 'completed' : ''}`;
        
        let deleteBtn = '';
        if (isCustom) {
            deleteBtn = `<button class="delete-btn" onclick="deleteCustomQuest('${quest.id}')">Delete</button>`;
        }
        
        div.innerHTML = `
            <div class="quest-checkbox">${completed ? '✓' : ''}</div>
            <div class="quest-content">
                <span class="quest-icon">${quest.icon}</span>
                <span class="quest-name">${quest.name}</span>
                <span class="quest-xp">+${quest.xp} XP</span>
            </div>
            ${deleteBtn}
        `;
        div.style.cursor = 'pointer';
        div.onclick = (e) => {
            if (!e.target.classList.contains('delete-btn')) {
                toggleQuest(quest.id);
            }
        };
        list.appendChild(div);
    });
}

function updateTraps(traps) {
    const list = document.getElementById('trapList');
    list.innerHTML = '';
    npcTraps.forEach(trap => {
        const triggered = traps[trap.id] || false;
        const div = document.createElement('div');
        div.className = `quest-item trap ${triggered ? 'triggered' : ''}`;
        div.innerHTML = `
            <div class="quest-checkbox">${triggered ? '✗' : ''}</div>
            <div class="quest-content">
                <span class="quest-icon">🪤</span>
                <span class="quest-name">${trap.name}</span>
                <span class="trap-xp">${triggered ? '-5 XP' : ''}</span>
            </div>
            <button class="delete-btn" onclick="deleteNPCTrap('${trap.id}')">Delete</button>
        `;
        div.onclick = (e) => {
            if (!e.target.classList.contains('delete-btn')) {
                toggleTrap(trap.id);
            }
        };
        list.appendChild(div);
    });
}

function updateSideQuests(sideQuestStates) {
    const list = document.getElementById('sideQuestList');
    list.innerHTML = '';
    sideQuests.forEach(quest => {
        const completed = sideQuestStates[quest.id] || false;
        const div = document.createElement('div');
        div.className = `quest-item ${completed ? 'completed' : ''}`;
        div.innerHTML = `
            <div class="quest-checkbox">${completed ? '✓' : ''}</div>
            <div class="quest-content">
                <span class="quest-icon">⚔️</span>
                <span class="quest-name">${quest.name}</span>
                <span class="quest-xp">+${quest.xp} XP</span>
            </div>
            <button class="delete-btn" onclick="deleteSideQuest('${quest.id}')">Delete</button>
        `;
        div.onclick = (e) => {
            if (!e.target.classList.contains('delete-btn')) {
                toggleSideQuest(quest.id);
            }
        };
        list.appendChild(div);
    });
}

function updateStats() {
    const grid = document.getElementById('statsGrid');
    grid.innerHTML = `
        ${createStatRow('Health', stats.health, '❤️')}
        ${createStatRow('Mind', stats.mind, '🧠')}
        ${createStatRow('Discipline', stats.discipline, '⚔️')}
        ${createStatRow('Confidence', stats.confidence, '😎')}
    `;
}

function createStatRow(label, value, icon) {
    const bars = Array(4).fill(0).map((_, i) => 
        `<div class="bar ${i < value ? 'filled' : ''}"></div>`
    ).join('');
    return `
        <div class="stat-row">
            <div class="stat-label">
                <span class="stat-icon">${icon}</span>
                ${label}
            </div>
            <div class="stat-bars">${bars}</div>
        </div>
    `;
}

function updateScores(quests, sideQuestStates = {}) {
    const completed = Object.values(quests).filter(Boolean).length;
    const sideCompleted = Object.values(sideQuestStates).filter(Boolean).length;
    document.getElementById('questScore').textContent = `${completed}/${DEFAULT_QUESTS.length}`;

    const xp = QUESTS.reduce((sum, quest) => {
        return sum + (quests[quest.id] ? quest.xp : 0);
    }, 0);
    const sideXp = sideQuests.reduce((sum, quest) => {
        return sum + (sideQuestStates[quest.id] ? quest.xp : 0);
    }, 0);
    
    document.getElementById('xpEarned').textContent = xp + sideXp;
}

function toggleQuest(questId) {
    const dayData = getCurrentDayData();
    const wasCompleted = dayData.quests[questId];
    dayData.quests[questId] = !wasCompleted;

    if (!wasCompleted) {
        const quest = QUESTS.find(q => q.id === questId);
        if (quest) totalXP += quest.xp;
        
        if (questId === 'workout' || questId === 'protein') stats.health = Math.min(4, stats.health + 1);
        if (questId === 'peace') stats.mind = Math.min(4, stats.mind + 1);
        if (questId === 'walk' || questId === 'sleep') stats.discipline = Math.min(4, stats.discipline + 1);
        if (questId === 'learn') stats.confidence = Math.min(4, stats.confidence + 1);
    } else {
        const quest = QUESTS.find(q => q.id === questId);
        if (quest) totalXP = Math.max(0, totalXP - quest.xp);
    }

    saveData();
    updateDisplay();
}

function toggleTrap(trapId) {
    const dayData = getCurrentDayData();
    const wasTriggered = dayData.traps[trapId];
    dayData.traps[trapId] = !wasTriggered;

    if (!wasTriggered) {
        totalXP = Math.max(0, totalXP - 5);
    } else {
        totalXP += 5;
    }

    saveData();
    updateDisplay();
}

function toggleSideQuest(questId) {
    const dayData = getCurrentDayData();
    const wasCompleted = dayData.sideQuests[questId];
    dayData.sideQuests[questId] = !wasCompleted;

    if (!wasCompleted) {
        const quest = sideQuests.find(q => q.id === questId);
        if (quest) totalXP += quest.xp;
    } else {
        const quest = sideQuests.find(q => q.id === questId);
        if (quest) totalXP = Math.max(0, totalXP - quest.xp);
    }

    saveData();
    updateDisplay();
}

function addCustomQuest() {
    const nameInput = document.getElementById('newQuestName');
    const xpInput = document.getElementById('newQuestXP');
    const name = nameInput.value.trim();
    const xp = parseInt(xpInput.value) || 20;

    if (!name) {
        alert('Enter a quest name');
        return;
    }

    const id = 'custom_' + Date.now();
    const quest = { id, name, icon: '🎯', xp };
    customQuests.push(quest);
    QUESTS.push(quest);

    nameInput.value = '';
    xpInput.value = '20';

    saveData();
    updateDisplay();
}

function deleteCustomQuest(questId) {
    customQuests = customQuests.filter(q => q.id !== questId);
    QUESTS = QUESTS.filter(q => q.id !== questId);
    
    // Remove from all days
    Object.values(allDays).forEach(day => {
        delete day.quests[questId];
    });

    saveData();
    updateDisplay();
}

function addNPCTrap() {
    const nameInput = document.getElementById('newTrapName');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Enter a trap name');
        return;
    }

    const id = 'trap_' + Date.now();
    const trap = { id, name };
    npcTraps.push(trap);

    nameInput.value = '';

    saveData();
    updateDisplay();
}

function deleteNPCTrap(trapId) {
    npcTraps = npcTraps.filter(t => t.id !== trapId);
    
    // Remove from all days and restore XP if triggered
    Object.values(allDays).forEach(day => {
        if (day.traps && day.traps[trapId]) {
            totalXP += 5;
            delete day.traps[trapId];
        }
    });

    saveData();
    updateDisplay();
}

function addSideQuest() {
    const nameInput = document.getElementById('newSideQuestName');
    const xpInput = document.getElementById('newSideQuestXP');
    const name = nameInput.value.trim();
    const xp = parseInt(xpInput.value) || 15;

    if (!name) {
        alert('Enter a side quest name');
        return;
    }

    const id = 'side_' + Date.now();
    const quest = { id, name, xp };
    sideQuests.push(quest);

    nameInput.value = '';
    xpInput.value = '15';

    saveData();
    updateDisplay();
}

function deleteSideQuest(questId) {
    sideQuests = sideQuests.filter(q => q.id !== questId);
    
    // Remove from all days
    Object.values(allDays).forEach(day => {
        if (day.sideQuests) {
            delete day.sideQuests[questId];
        }
    });

    saveData();
    updateDisplay();
}

function addXP() {
    const value = parseInt(document.getElementById('xpAdjustValue').value) || 0;
    if (value > 0) {
        totalXP += value;
        document.getElementById('xpAdjustValue').value = '0';
        saveData();
        updateDisplay();
    }
}

function removeXP() {
    const value = parseInt(document.getElementById('xpAdjustValue').value) || 0;
    if (value > 0) {
        totalXP = Math.max(0, totalXP - value);
        document.getElementById('xpAdjustValue').value = '0';
        saveData();
        updateDisplay();
    }
}

function handleJournalChange() {
    const dayData = getCurrentDayData();
    dayData.journal = document.getElementById('journal').value;
    saveData();
}

function prevDay() {
    const d = dateStringToDate(currentDate);
    d.setDate(d.getDate() - 1);
    currentDate = d.getFullYear() + '-' + 
                 String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                 String(d.getDate()).padStart(2, '0');
    updateDisplay();
}

function nextDay() {
    const d = dateStringToDate(currentDate);
    d.setDate(d.getDate() + 1);
    currentDate = d.getFullYear() + '-' + 
                 String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                 String(d.getDate()).padStart(2, '0');
    updateDisplay();
}

function goToToday() {
    currentDate = getLocalDate();
    updateDisplay();
}

document.getElementById('journal').addEventListener('input', handleJournalChange);

// Initialize
loadData();
updateDisplay();
