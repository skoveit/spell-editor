const editor = document.getElementById('editor');
const highlights = document.getElementById('highlights');
const container = document.getElementById('suggestions-container');
const errorCountBadge = document.getElementById('error-count');
const statusIndicator = document.getElementById('status');

let currentErrors = [];
let checkTimeout = null;

// Escape HTML utility to prevent XSS in highlights
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Function to handle scroll syncing between textarea and highlights
const syncScroll = () => {
    highlights.scrollTop = editor.scrollTop;
    highlights.scrollLeft = editor.scrollLeft;
};

editor.addEventListener('scroll', syncScroll);

// Main editor input handler
editor.addEventListener('input', () => {
    updateHighlightsBasic();

    // Debounce the API call
    clearTimeout(checkTimeout);
    statusIndicator.textContent = "Typing...";
    statusIndicator.className = "status-indicator loading";

    checkTimeout = setTimeout(() => {
        checkSpelling(editor.value);
    }, 500); // 500ms debounce
});

// We need an initial highlight sync in case there's text
function updateHighlightsBasic() {
    // Just sync text with no marks temporarily
    let text = escapeHtml(editor.value);
    // ensure trailing newlines render correctly
    text = text.replace(/\n$/g, '\n\n');
    highlights.innerHTML = text;
}

async function checkSpelling(text) {
    if (!text.trim()) {
        statusIndicator.textContent = "Ready";
        statusIndicator.className = "status-indicator";
        currentErrors = [];
        renderSidebar();
        return;
    }

    try {
        const response = await fetch('/api/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        currentErrors = data.errors || [];

        statusIndicator.textContent = "Checked";
        statusIndicator.className = "status-indicator";

        applyHighlights(text, currentErrors);
        renderSidebar();

    } catch (error) {
        console.error('Error checking spelling:', error);
        statusIndicator.textContent = "Error connecting to server";
        statusIndicator.className = "status-indicator error";
    }
}

function applyHighlights(text, errors) {
    let highlightedText = "";
    let currentIndex = 0;

    // Sort errors by offset to process them sequentially
    errors.sort((a, b) => a.offset - b.offset);

    for (const err of errors) {
        // Add text before the error
        highlightedText += escapeHtml(text.substring(currentIndex, err.offset));

        // Add the errored word wrapped in <mark>
        let errorWord = text.substring(err.offset, err.offset + err.length);
        highlightedText += `<mark data-id="${err.offset}">${escapeHtml(errorWord)}</mark>`;

        currentIndex = err.offset + err.length;
    }

    // Add remaining text
    highlightedText += escapeHtml(text.substring(currentIndex));

    // ensure trailing newlines render correctly
    highlightedText = highlightedText.replace(/\n$/g, '\n\n');

    highlights.innerHTML = highlightedText;
}

function renderSidebar() {
    errorCountBadge.textContent = currentErrors.length;

    if (currentErrors.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>No spelling errors found. Great job!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    currentErrors.forEach((err) => {
        const card = document.createElement('div');
        card.className = 'error-card';

        const nav = document.createElement('div');
        nav.className = 'error-word-nav';

        const wordTitle = document.createElement('div');
        wordTitle.className = 'misspelled-word';
        wordTitle.textContent = err.word;

        nav.appendChild(wordTitle);
        card.appendChild(nav);

        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'suggestion-chips';

        if (err.suggestions && err.suggestions.length > 0) {
            err.suggestions.forEach(sugg => {
                const chip = document.createElement('button');
                chip.className = 'suggestion-chip';
                // Preserve original capitalization roughly (if first letter was upper, make suggestion upper)
                let displaySugg = sugg;
                if (err.word.length > 0 && err.word[0] === err.word[0].toUpperCase()) {
                    displaySugg = sugg.charAt(0).toUpperCase() + sugg.slice(1);
                }

                chip.textContent = displaySugg;
                chip.addEventListener('click', () => {
                    applyCorrection(err, displaySugg);
                });
                chipsContainer.appendChild(chip);
            });
        } else {
            const noSugg = document.createElement('span');
            noSugg.className = 'no-suggestions';
            noSugg.textContent = "No suggestions available";
            chipsContainer.appendChild(noSugg);
        }

        card.appendChild(chipsContainer);
        container.appendChild(card);
    });
}

function applyCorrection(errorObj, correctedWord) {
    const text = editor.value;
    // We must replace exactly at the offset and length
    const newText = text.substring(0, errorObj.offset) + correctedWord + text.substring(errorObj.offset + errorObj.length);
    editor.value = newText;

    // It's a quick hack to trigger an update, better is to recalculate everything
    statusIndicator.textContent = "Typing...";
    statusIndicator.className = "status-indicator loading";

    updateHighlightsBasic();
    checkSpelling(newText);

    // Focus back to editor
    editor.focus();
}

// Ensure dimensions and styles of highlights strictly match editor
// This is critical for the overlay technique to work
window.addEventListener('resize', () => {
    syncScroll();
});

// Initially render the UI correctly
updateHighlightsBasic();
