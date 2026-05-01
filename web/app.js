const editor = document.getElementById('editor');
const highlights = document.getElementById('highlights');
const errorCountEl = document.getElementById('error-count');
const modeToast = document.getElementById('mode-toast');

const SUGG_KEYS = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f'];

let currentErrors = [];
let checkTimeout = null;
let activePopover = null;
let focusedErrIdx = -1;   // which error is currently focused/navigated
let activeSugg = [];   // suggestions for the open popover
let activeErrOffset = -1;
let activeErrLength = 0;
let ignoredWords = new Set();
let semicolonCount = 0;
let semicolonTimer = null;

// ── Utilities ──────────────────────────────────────────────
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


function syncScroll() {
    highlights.scrollTop = editor.scrollTop;
    highlights.scrollLeft = editor.scrollLeft;
}
editor.addEventListener('scroll', syncScroll);
window.addEventListener('resize', syncScroll);

function toast(msg, duration = 1200) {
    modeToast.textContent = msg;
    modeToast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => modeToast.classList.remove('show'), duration);
}

// ── Error count ─────────────────────────────────────────────
function updateErrorCount(count) {
    if (count === 0) { errorCountEl.textContent = ''; errorCountEl.className = 'error-count'; }
    else { errorCountEl.textContent = count + (count === 1 ? ' error' : ' errors'); errorCountEl.className = 'error-count has-errors'; }
}

// ── Render highlights ────────────────────────────────────────
function renderHighlights(text, errors) {
    const visible = errors.filter(e => !ignoredWords.has(e.word.toLowerCase()));

    if (!visible.length) {
        highlights.innerHTML = escapeHtml(text).replace(/\n$/, '\n\n');
        return;
    }

    let out = '', idx = 0;
    const sorted = [...visible].sort((a, b) => a.offset - b.offset);

    sorted.forEach((err, i) => {
        out += escapeHtml(text.substring(idx, err.offset));
        const word = text.substring(err.offset, err.offset + err.length);
        const isFocused = focusedErrIdx >= 0 && currentErrors[focusedErrIdx] === err;
        out += `<mark data-offset="${err.offset}" data-length="${err.length}" data-word="${escapeHtml(err.word)}" data-suggestions="${escapeHtml(JSON.stringify(err.suggestions || []))}" class="${isFocused ? 'focused-error' : ''}">${escapeHtml(word)}</mark>`;
        idx = err.offset + err.length;
    });

    out += escapeHtml(text.substring(idx));
    out = out.replace(/\n$/, '\n\n');
    highlights.innerHTML = out;

    highlights.querySelectorAll('mark').forEach(mark => {
        mark.addEventListener('click', e => { e.stopPropagation(); openPopoverOnMark(mark); });
    });
}

// ── Spelling check ───────────────────────────────────────────
async function checkSpelling(text) {
    if (!text.trim()) {
        currentErrors = [];
        renderHighlights(text, []);
        updateErrorCount(0);
        return;
    }

    try {
        const res = await fetch('/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        currentErrors = (data.errors || []).filter(e => !ignoredWords.has(e.word.toLowerCase()));
        renderHighlights(editor.value, currentErrors);
        updateErrorCount(currentErrors.length);
    } catch {
        // silently ignore error state styling since UI is removed
    }
}

editor.addEventListener('input', () => {
    renderHighlights(editor.value, currentErrors);
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => checkSpelling(editor.value), 500);
});

// ── Popover ──────────────────────────────────────────────────
function openPopoverOnMark(mark) {
    closePopover();
    const word = mark.dataset.word;
    const offset = parseInt(mark.dataset.offset);
    const length = parseInt(mark.dataset.length);
    let suggestions = [];
    try { suggestions = JSON.parse(mark.dataset.suggestions); } catch { }

    activeErrOffset = offset;
    activeErrLength = length;
    activeSugg = suggestions.slice(0, 8).map(s => {
        if (word.length > 0 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase())
            return s.charAt(0).toUpperCase() + s.slice(1);
        return s;
    });

    const rect = mark.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'popover';

    const wordLabel = document.createElement('div');
    wordLabel.className = 'popover-word';
    wordLabel.textContent = word;
    pop.appendChild(wordLabel);

    const chips = document.createElement('div');
    chips.className = 'popover-chips';

    if (activeSugg.length > 0) {
        activeSugg.forEach((sugg, i) => {
            const chip = document.createElement('button');
            chip.className = 'chip';
            chip.innerHTML = `<span class="chip-key">${SUGG_KEYS[i]}</span>${escapeHtml(sugg)}`;
            chip.addEventListener('click', () => { applyCorrection(offset, length, sugg); closePopover(); });
            chips.appendChild(chip);
        });
    } else {
        const none = document.createElement('span');
        none.className = 'no-suggestions';
        none.textContent = 'no suggestions';
        chips.appendChild(none);
    }
    pop.appendChild(chips);

    // hint bar
    const hint = document.createElement('div');
    hint.className = 'popover-hint';
    hint.innerHTML = `<span><kbd>Esc</kbd> close</span><span><kbd>i</kbd> ignore</span><span><kbd>Tab</kbd> nav</span>`;
    pop.appendChild(hint);

    const arrow = document.createElement('div');
    arrow.className = 'popover-arrow';
    pop.appendChild(arrow);

    document.body.appendChild(pop);
    activePopover = pop;

    const PW = 240;
    const h = pop.offsetHeight;
    let left = rect.left + rect.width / 2 - PW / 2;
    let top = rect.top - h - 12;

    if (top < 8) {
        top = rect.bottom + 12;
        arrow.style.display = 'none';
    }
    if (left < 8) left = 8;
    if (left + PW > window.innerWidth - 8) left = window.innerWidth - PW - 8;

    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.style.width = PW + 'px';
}

function openPopoverOnFocused() {
    if (focusedErrIdx < 0 || !currentErrors[focusedErrIdx]) return;
    const err = currentErrors[focusedErrIdx];
    const mark = highlights.querySelector(`mark[data-offset="${err.offset}"]`);
    if (mark) openPopoverOnMark(mark);
}

function closePopover() {
    if (activePopover) { activePopover.remove(); activePopover = null; }
    activeSugg = [];
    activeErrOffset = -1;
    activeErrLength = 0;
}


// ── Apply correction ─────────────────────────────────────────
function applyCorrection(offset, length, replacement) {
    const text = editor.value;
    const newText = text.substring(0, offset) + replacement + text.substring(offset + length);

    editor.value = newText;
    currentErrors = currentErrors.filter(e => e.offset !== offset);
    renderHighlights(newText, currentErrors);
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => checkSpelling(newText), 300);

    editor.setSelectionRange(editor.value.length, editor.value.length);
    syncScroll();
    editor.focus();
}

// ── Navigate errors ──────────────────────────────────────────
function navigateError(dir) {
    const visible = currentErrors.filter(e => !ignoredWords.has(e.word.toLowerCase()));
    if (!visible.length) { toast('no errors'); return; }

    if (focusedErrIdx < 0) {
        focusedErrIdx = dir > 0 ? 0 : visible.length - 1;
    } else {
        focusedErrIdx = (focusedErrIdx + dir + visible.length) % visible.length;
    }

    const err = visible[focusedErrIdx];
    focusedErrIdx = currentErrors.indexOf(err);
    renderHighlights(editor.value, currentErrors);

    const scrollPos = editor.scrollTop;
    editor.setSelectionRange(err.offset, err.offset + err.length);
    editor.focus({ preventScroll: true });
    editor.scrollTop = scrollPos;

    const lineH = 18 * 1.85;
    const lines = editor.value.substring(0, err.offset).split('\n').length;
    const targetScroll = Math.max(0, (lines - 3) * lineH);

    if (err.offset > editor.selectionStart + 50 || Math.abs(editor.scrollTop - targetScroll) > editor.clientHeight / 2) {
        editor.scrollTo({ top: targetScroll });
        syncScroll();
    }

    toast(`error ${currentErrors.filter((_, i) => i <= focusedErrIdx && !ignoredWords.has(currentErrors[i].word.toLowerCase())).length} of ${visible.length}`);
    openPopoverOnFocused();
}

// ── Ignore word ──────────────────────────────────────────────
function ignoreCurrentWord() {
    if (activeErrOffset < 0) return;
    const err = currentErrors.find(e => e.offset === activeErrOffset);
    if (!err) return;
    ignoredWords.add(err.word.toLowerCase());
    currentErrors = currentErrors.filter(e => e.offset !== activeErrOffset);
    closePopover();
    renderHighlights(editor.value, currentErrors);
    updateErrorCount(currentErrors.length);
    toast(`"${err.word}" ignored`);
    editor.setSelectionRange(editor.value.length, editor.value.length);
    editor.focus();
}

// ── Keyboard handling ────────────────────────────────────────
let lastKey = '';
let lastKeyTime = 0;

editor.addEventListener('keydown', e => {
    // Ctrl+; → re-check
    if (e.ctrlKey && e.key === ';') {
        e.preventDefault();
        clearTimeout(checkTimeout);
        checkSpelling(editor.value);
        toast('checking…');
        return;
    }

    // When popover is open
    if (activePopover) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closePopover();
            editor.setSelectionRange(editor.value.length, editor.value.length);
            editor.focus();
            return;
        }
        if (e.key.toLowerCase() === 'i') {
            e.preventDefault();
            ignoreCurrentWord();
            return;
        }

        const lower = e.key.toLowerCase();
        if (SUGG_KEYS.includes(lower) && !e.ctrlKey && !e.metaKey) {
            const idx = SUGG_KEYS.indexOf(lower);
            if (activeSugg[idx]) {
                e.preventDefault();
                applyCorrection(activeErrOffset, activeErrLength, activeSugg[idx]);
                closePopover();
            }
            return;
        }
    }

    // Tab → navigate errors
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        closePopover();
        navigateError(e.shiftKey ? -1 : 1);
        return;
    }

    // Enter → open menu on focused error
    if (e.key === 'Enter' && !activePopover && focusedErrIdx >= 0) {
        const pos = editor.selectionStart;
        const err = currentErrors.find(e2 => pos >= e2.offset && pos <= e2.offset + e2.length && !ignoredWords.has(e2.word.toLowerCase()));
        if (err) {
            e.preventDefault();
            focusedErrIdx = currentErrors.indexOf(err);
            renderHighlights(editor.value, currentErrors);
            openPopoverOnFocused();
            return;
        }
    }
});

document.addEventListener('click', e => {
    if (activePopover && !activePopover.contains(e.target)) closePopover();
});
