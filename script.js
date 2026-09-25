'use strict';

/* ==========================================================================
   Constants & state
   ========================================================================== */

const STORAGE_KEY = 'keep-clone-notes-v1';

// Keep in sync with the max-width media query in stylesheet.css.
const MOBILE_BREAKPOINT = 800;

// Note colors live once as CSS custom properties (stylesheet.css); read them
// through var(--note-*) instead of duplicating hex values here.
const COLOR_KEYS = ['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'darkblue', 'purple', 'pink', 'brown', 'gray'];

function colorVar(key) {
    return `var(--note-${COLOR_KEYS.includes(key) ? key : 'default'})`;
}

let notes = loadNotes();
let nextId = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;

let activeView = 'notes';
let searchTerm = '';
let activeLabelFilter = null;

// Color/reminder popovers can target the note-capture draft, the edit-modal
// draft, or an existing note; draft state for the first two lives here.
const drafts = {
    draft: { color: 'default', reminder: '' },
    edit: { color: 'default', reminder: '' },
};

let editingId = null;
let editOriginal = null;

let pendingConfirmAction = null;
let colorPopoverTarget = null;
let reminderPopoverTarget = null;
let snackbarTimeout = null;

/* ==========================================================================
   DOM references
   ========================================================================== */

const menuToggleBtnEl = document.getElementById('menu-toggle-btn');
const sidebarEl = document.getElementById('sidebar');
const sidebarBackdropEl = document.getElementById('sidebar-backdrop');
const navItems = Array.from(document.querySelectorAll('.nav-item'));

const searchFormEl = document.getElementById('search-form');
const searchInputEl = document.getElementById('search-input');
const clearSearchBtnEl = document.getElementById('clear-search-btn');

const refreshBtnEl = document.getElementById('refresh-btn');
const viewToggleBtnEl = document.getElementById('view-toggle-btn');
const shortcutsBtnEl = document.getElementById('shortcuts-btn');
const shortcutsModalEl = document.getElementById('shortcuts-modal');
const shortcutsCloseBtnEl = document.getElementById('shortcuts-close-btn');
const settingsBtnEl = document.getElementById('settings-btn');
const settingsModalEl = document.getElementById('settings-modal');
const settingsCloseBtnEl = document.getElementById('settings-close-btn');
const darkThemeToggleEl = document.getElementById('dark-theme-toggle');

const noteFormEl = document.getElementById('note-form');
const noteTitleEl = document.getElementById('note-title');
const noteTextEl = document.getElementById('note-text');
const formCloseBtnEl = document.getElementById('form-close-btn');
const formColorBtnEl = noteFormEl.querySelector('.form-color-btn');
const formReminderBtnEl = noteFormEl.querySelector('.form-reminder-btn');

const notesEmptyStateEl = document.getElementById('notes-empty-state');
const pinnedHeadingEl = document.getElementById('pinned-heading');
const pinnedListEl = document.getElementById('pinned-list');
const othersHeadingEl = document.getElementById('others-heading');
const notesListEl = document.getElementById('notes-list');

const remindersEmptyStateEl = document.getElementById('reminders-empty-state');
const remindersListEl = document.getElementById('reminders-list');

const labelsEmptyStateEl = document.getElementById('labels-empty-state');
const labelsChipListEl = document.getElementById('labels-chip-list');
const labelsListEl = document.getElementById('labels-list');

const archiveEmptyStateEl = document.getElementById('archive-empty-state');
const archiveListEl = document.getElementById('archive-list');

const emptyTrashBtnEl = document.getElementById('empty-trash-btn');
const trashEmptyStateEl = document.getElementById('trash-empty-state');
const trashListEl = document.getElementById('trash-list');

const searchEmptyStateEl = document.getElementById('search-empty-state');
const searchListEl = document.getElementById('search-list');

const cardTemplateEl = document.getElementById('note-card-template');
const gridContainers = [pinnedListEl, notesListEl, remindersListEl, labelsListEl, archiveListEl, trashListEl, searchListEl];

const colorPopoverEl = document.getElementById('color-popover');
const reminderPopoverEl = document.getElementById('reminder-popover');
const reminderInputEl = document.getElementById('reminder-input');
const reminderSaveBtnEl = document.getElementById('reminder-save-btn');
const reminderRemoveBtnEl = document.getElementById('reminder-remove-btn');

const editModalEl = document.getElementById('edit-modal');
const editModalContentEl = editModalEl.querySelector('.modal-content');
const editTitleEl = document.getElementById('edit-title');
const editTextEl = document.getElementById('edit-text');
const editLabelEl = document.getElementById('edit-label');
const editColorBtnEl = document.getElementById('edit-color-btn');
const closeModalBtnEl = document.getElementById('close-modal-btn');
const saveEditBtnEl = document.getElementById('save-edit-btn');

const confirmModalEl = document.getElementById('confirm-modal');
const confirmMessageEl = document.getElementById('confirm-message');
const confirmCancelBtnEl = document.getElementById('confirm-cancel-btn');
const confirmOkBtnEl = document.getElementById('confirm-ok-btn');

const snackbarEl = document.getElementById('snackbar');
const snackbarMessageEl = document.getElementById('snackbar-message');
const snackbarUndoBtnEl = document.getElementById('snackbar-undo-btn');

/* ==========================================================================
   Persistence
   ========================================================================== */

function loadNotes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (err) {
        console.warn('Could not load saved notes:', err);
        return [];
    }
}

function saveNotes() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
        console.warn('Could not save notes:', err);
        showSnackbar('Could not save — storage is full or unavailable');
    }
}

function generateId() {
    return nextId++;
}

/* ==========================================================================
   Note mutations
   ========================================================================== */

function addNote({ title, text, color, reminder, label }) {
    notes.push({
        id: generateId(),
        title: title || '',
        text: text || '',
        color: color || 'default',
        label: label || '',
        reminder: reminder || '',
        pinned: false,
        archived: false,
        trashed: false,
        trashedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    saveNotes();
    renderApp();
}

function updateNote(id, patch) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    Object.assign(note, patch, { updatedAt: Date.now() });
    saveNotes();
    renderApp();
}

function togglePin(id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    updateNote(id, { pinned: !note.pinned });
}

function archiveNote(id) {
    updateNote(id, { archived: true, pinned: false });
}

function unarchiveNote(id) {
    updateNote(id, { archived: false });
}

function trashNote(id) {
    updateNote(id, { trashed: true, trashedAt: Date.now(), pinned: false });
}

function restoreNote(id) {
    updateNote(id, { trashed: false, trashedAt: null });
}

function deleteForever(id) {
    notes = notes.filter((n) => n.id !== id);
    saveNotes();
    renderApp();
}

function emptyTrash() {
    notes = notes.filter((n) => !n.trashed);
    saveNotes();
    renderApp();
}

/* ==========================================================================
   Rendering
   ========================================================================== */

function byUpdatedDesc(a, b) {
    return b.updatedAt - a.updatedAt;
}

function formatReminder(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function populateCardContent(card, note) {
    card.style.backgroundColor = colorVar(note.color);
    // Every non-default swatch stays a light pastel in both themes, so it
    // always needs dark text — only "default" follows the theme's own
    // foreground color (light text in dark mode on its dark background).
    card.classList.toggle('note-card-tinted', note.color !== 'default');

    const titleEl = card.querySelector('.note-card-title');
    titleEl.textContent = note.title;
    titleEl.classList.toggle('hidden', !note.title);

    card.querySelector('.note-card-text').textContent = note.text;

    const summary = note.title || note.text.slice(0, 60) || 'empty note';
    card.querySelector('.note-card-body').setAttribute('aria-label', `Edit note: ${summary}`);

    const labelEl = card.querySelector('.note-card-label');
    if (note.label) {
        labelEl.textContent = note.label;
        labelEl.classList.remove('hidden');
    }

    const reminderEl = card.querySelector('.note-card-reminder');
    if (note.reminder) {
        reminderEl.textContent = formatReminder(note.reminder);
        reminderEl.classList.remove('hidden');
    }

    const pinBtn = card.querySelector('.pin-btn');
    pinBtn.classList.toggle('active', note.pinned);
    pinBtn.setAttribute('aria-pressed', String(note.pinned));
    pinBtn.dataset.tooltip = note.pinned ? 'Unpin note' : 'Pin note';
    pinBtn.setAttribute('aria-label', note.pinned ? 'Unpin note' : 'Pin note');
}

function applyCardStateVisibility(card, note) {
    const pinBtn = card.querySelector('.pin-btn');
    const archiveBtn = card.querySelector('.card-archive-btn');
    const unarchiveBtn = card.querySelector('.card-unarchive-btn');
    const restoreBtn = card.querySelector('.card-restore-btn');
    const deleteBtn = card.querySelector('.card-delete-btn');
    const colorBtn = card.querySelector('.card-color-btn');
    const reminderBtn = card.querySelector('.card-reminder-btn');

    if (note.trashed) {
        pinBtn.classList.add('hidden');
        archiveBtn.classList.add('hidden');
        colorBtn.classList.add('hidden');
        reminderBtn.classList.add('hidden');
        restoreBtn.classList.remove('hidden');
        deleteBtn.dataset.tooltip = 'Delete forever';
        deleteBtn.setAttribute('aria-label', 'Delete note forever');
    } else if (note.archived) {
        archiveBtn.classList.add('hidden');
        unarchiveBtn.classList.remove('hidden');
        pinBtn.classList.add('hidden');
    }
}

function createNoteCard(note) {
    const card = cardTemplateEl.content.firstElementChild.cloneNode(true);
    card.dataset.id = String(note.id);
    populateCardContent(card, note);
    applyCardStateVisibility(card, note);
    return card;
}

function fillGrid(container, list) {
    container.innerHTML = '';
    list.forEach((note) => container.appendChild(createNoteCard(note)));
}

function renderNotesView() {
    const active = notes.filter((n) => !n.archived && !n.trashed);
    const pinned = active.filter((n) => n.pinned).sort(byUpdatedDesc);
    const others = active.filter((n) => !n.pinned).sort(byUpdatedDesc);

    fillGrid(pinnedListEl, pinned);
    fillGrid(notesListEl, others);

    pinnedHeadingEl.classList.toggle('hidden', pinned.length === 0);
    othersHeadingEl.classList.toggle('hidden', pinned.length === 0 || others.length === 0);
    notesEmptyStateEl.classList.toggle('hidden', active.length > 0);
}

function renderReminders() {
    // Archived notes are intentionally excluded: Reminders surfaces things
    // that still need attention, and archiving is how a note is marked done.
    const list = notes
        .filter((n) => !n.archived && !n.trashed && n.reminder)
        .sort((a, b) => new Date(a.reminder) - new Date(b.reminder));
    fillGrid(remindersListEl, list);
    remindersEmptyStateEl.classList.toggle('hidden', list.length > 0);
}

function renderLabels() {
    // Unlike Reminders, archived notes are intentionally included here:
    // labels are an organizing tool that should still work after archiving.
    const labeled = notes.filter((n) => !n.trashed && n.label && n.label.trim());
    const uniqueLabels = [...new Set(labeled.map((n) => n.label.trim()))].sort((a, b) => a.localeCompare(b));

    if (activeLabelFilter && !uniqueLabels.includes(activeLabelFilter)) {
        activeLabelFilter = null;
    }

    labelsChipListEl.innerHTML = '';
    uniqueLabels.forEach((label) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'label-chip' + (activeLabelFilter === label ? ' active' : '');
        chip.textContent = label;
        chip.addEventListener('click', () => {
            activeLabelFilter = activeLabelFilter === label ? null : label;
            renderLabels();
        });
        labelsChipListEl.appendChild(chip);
    });

    const filtered = activeLabelFilter ? labeled.filter((n) => n.label.trim() === activeLabelFilter) : labeled;
    fillGrid(labelsListEl, filtered.sort(byUpdatedDesc));
    labelsEmptyStateEl.classList.toggle('hidden', uniqueLabels.length > 0);
}

function renderArchive() {
    const list = notes.filter((n) => n.archived && !n.trashed).sort(byUpdatedDesc);
    fillGrid(archiveListEl, list);
    archiveEmptyStateEl.classList.toggle('hidden', list.length > 0);
}

function renderTrash() {
    const list = notes.filter((n) => n.trashed).sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0));
    fillGrid(trashListEl, list);
    trashEmptyStateEl.classList.toggle('hidden', list.length > 0);
}

function renderSearch() {
    const q = searchTerm.trim().toLowerCase();
    const list = notes
        .filter((n) => !n.trashed)
        .filter((n) => n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q) || (n.label && n.label.toLowerCase().includes(q)))
        .sort(byUpdatedDesc);
    fillGrid(searchListEl, list);
    searchEmptyStateEl.classList.toggle('hidden', list.length > 0);
}

function renderApp() {
    const hasSearch = searchTerm.trim().length > 0;
    const viewToShow = hasSearch ? 'search' : activeView;

    document.querySelectorAll('.view').forEach((section) => {
        section.classList.toggle('hidden', section.id !== `${viewToShow}-view`);
    });

    if (hasSearch) {
        renderSearch();
        return;
    }

    switch (activeView) {
        case 'notes':
            renderNotesView();
            break;
        case 'reminders':
            renderReminders();
            break;
        case 'labels':
            renderLabels();
            break;
        case 'archive':
            renderArchive();
            break;
        case 'trash':
            renderTrash();
            break;
        default:
            renderNotesView();
    }
}

/* ==========================================================================
   Sidebar & navigation
   ========================================================================== */

function collapseSidebarIfMobile() {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
        sidebarEl.classList.remove('expanded');
        sidebarBackdropEl.classList.remove('expanded');
        menuToggleBtnEl.setAttribute('aria-expanded', 'false');
    }
}

menuToggleBtnEl.addEventListener('click', () => {
    const expanded = sidebarEl.classList.toggle('expanded');
    sidebarBackdropEl.classList.toggle('expanded', expanded && window.innerWidth <= MOBILE_BREAKPOINT);
    menuToggleBtnEl.setAttribute('aria-expanded', String(expanded));
});

sidebarBackdropEl.addEventListener('click', () => {
    sidebarEl.classList.remove('expanded');
    sidebarBackdropEl.classList.remove('expanded');
    menuToggleBtnEl.setAttribute('aria-expanded', 'false');
});

navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
        activeView = btn.dataset.view;
        navItems.forEach((b) => {
            if (b === btn) b.setAttribute('aria-current', 'page');
            else b.removeAttribute('aria-current');
        });
        searchInputEl.value = '';
        searchTerm = '';
        clearSearchBtnEl.classList.add('hidden');
        collapseSidebarIfMobile();
        renderApp();
    });
});

if (window.innerWidth > MOBILE_BREAKPOINT) {
    sidebarEl.classList.add('expanded');
    menuToggleBtnEl.setAttribute('aria-expanded', 'true');
}

/* ==========================================================================
   Search
   ========================================================================== */

searchFormEl.addEventListener('submit', (e) => e.preventDefault());

searchInputEl.addEventListener('input', () => {
    searchTerm = searchInputEl.value;
    clearSearchBtnEl.classList.toggle('hidden', searchTerm.length === 0);
    renderApp();
});

clearSearchBtnEl.addEventListener('click', () => {
    searchInputEl.value = '';
    searchTerm = '';
    clearSearchBtnEl.classList.add('hidden');
    renderApp();
    searchInputEl.focus();
});

/* ==========================================================================
   Note capture form
   ========================================================================== */

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
}

function expandForm() {
    noteFormEl.classList.add('expanded');
}

function collapseForm(save) {
    const title = noteTitleEl.value.trim();
    const text = noteTextEl.value.trim();

    if (save && (title || text)) {
        addNote({ title, text, color: drafts.draft.color, reminder: drafts.draft.reminder, label: '' });
    }

    noteFormEl.reset();
    noteFormEl.classList.remove('expanded');
    noteFormEl.style.backgroundColor = '';
    noteFormEl.classList.remove('note-card-tinted');
    noteTextEl.style.height = '';
    drafts.draft.color = 'default';
    drafts.draft.reminder = '';
    hideColorPopover();
    hideReminderPopover();
}

noteTextEl.addEventListener('focus', expandForm);
noteTitleEl.addEventListener('focus', expandForm);
noteTextEl.addEventListener('input', () => autoResizeTextarea(noteTextEl));

noteFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    collapseForm(true);
});

formCloseBtnEl.addEventListener('click', () => collapseForm(true));

/* ==========================================================================
   Color & reminder popovers (shared across form, cards, and edit modal)
   ========================================================================== */

function isSameTarget(a, b) {
    return !!a && !!b && a.type === b.type && a.id === b.id;
}

// Reads/writes a field ('color' or 'reminder') on whatever a popover is
// currently targeting — the note-capture draft, the edit-modal draft, or an
// existing note — so the draft/edit/note branch exists in one place.
function getTargetField(target, field) {
    if (!target) return field === 'color' ? 'default' : '';
    if (target.type === 'note') {
        const note = notes.find((n) => n.id === target.id);
        return note ? note[field] : field === 'color' ? 'default' : '';
    }
    return drafts[target.type][field];
}

function setTargetField(target, field, value) {
    if (target.type === 'note') {
        updateNote(target.id, { [field]: value });
    } else {
        drafts[target.type][field] = value;
    }
}

// A native <dialog> promotes itself (and only its own subtree) to the
// browser's top layer while open, painting above everything else and making
// the rest of the document inert. The shared popovers normally live at the
// end of <body>, so when one is opened from inside the edit modal it must be
// reparented into the dialog first or it renders inert behind the backdrop.
function popoverHomeFor(target) {
    return target.type === 'edit' ? editModalEl : document.body;
}

function positionPopover(popoverEl, triggerBtn, approxWidth) {
    const rect = triggerBtn.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - approxWidth - 8));
    popoverEl.style.top = `${rect.bottom + 6}px`;
    popoverEl.style.left = `${left}px`;
}

function renderColorSwatches() {
    const activeKey = getTargetField(colorPopoverTarget, 'color');
    colorPopoverEl.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'color-swatch-row';
    COLOR_KEYS.forEach((key) => {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'color-swatch' + (key === activeKey ? ' active' : '');
        swatch.style.backgroundColor = colorVar(key);
        swatch.title = label;
        swatch.setAttribute('aria-label', `Set color ${label}`);
        swatch.addEventListener('click', () => applyColor(key));
        row.appendChild(swatch);
    });
    colorPopoverEl.appendChild(row);
}

function hideColorPopover() {
    colorPopoverEl.classList.add('hidden');
    colorPopoverTarget = null;
}

function toggleColorPopover(triggerBtn, target) {
    const alreadyOpen = !colorPopoverEl.classList.contains('hidden') && isSameTarget(colorPopoverTarget, target);
    hideReminderPopover();
    if (alreadyOpen) {
        hideColorPopover();
        return;
    }
    colorPopoverTarget = target;
    popoverHomeFor(target).appendChild(colorPopoverEl);
    renderColorSwatches();
    positionPopover(colorPopoverEl, triggerBtn, 220);
    colorPopoverEl.classList.remove('hidden');
}

function applyColor(key) {
    if (!colorPopoverTarget) return;
    setTargetField(colorPopoverTarget, 'color', key);
    const tinted = key !== 'default';
    if (colorPopoverTarget.type === 'draft') {
        noteFormEl.style.backgroundColor = colorVar(key);
        noteFormEl.classList.toggle('note-card-tinted', tinted);
    }
    if (colorPopoverTarget.type === 'edit') {
        editModalContentEl.style.backgroundColor = colorVar(key);
        editModalContentEl.classList.toggle('note-card-tinted', tinted);
    }
    hideColorPopover();
}

function hideReminderPopover() {
    reminderPopoverEl.classList.add('hidden');
    reminderPopoverTarget = null;
}

function toggleReminderPopover(triggerBtn, target) {
    const alreadyOpen = !reminderPopoverEl.classList.contains('hidden') && isSameTarget(reminderPopoverTarget, target);
    hideColorPopover();
    if (alreadyOpen) {
        hideReminderPopover();
        return;
    }
    reminderPopoverTarget = target;
    popoverHomeFor(target).appendChild(reminderPopoverEl);
    reminderInputEl.value = getTargetField(target, 'reminder');
    positionPopover(reminderPopoverEl, triggerBtn, 260);
    reminderPopoverEl.classList.remove('hidden');
}

function applyReminder(value) {
    if (!reminderPopoverTarget) return;
    setTargetField(reminderPopoverTarget, 'reminder', value);
}

reminderSaveBtnEl.addEventListener('click', () => {
    applyReminder(reminderInputEl.value);
    hideReminderPopover();
});

reminderRemoveBtnEl.addEventListener('click', () => {
    reminderInputEl.value = '';
    applyReminder('');
    hideReminderPopover();
});

formColorBtnEl.addEventListener('click', () => toggleColorPopover(formColorBtnEl, { type: 'draft' }));
formReminderBtnEl.addEventListener('click', () => toggleReminderPopover(formReminderBtnEl, { type: 'draft' }));
editColorBtnEl.addEventListener('click', () => toggleColorPopover(editColorBtnEl, { type: 'edit' }));

/* ==========================================================================
   Note card interactions (event delegation)
   ========================================================================== */

function handleGridClick(e) {
    const card = e.target.closest('.note-card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const note = notes.find((n) => n.id === id);
    if (!note) return;

    if (e.target.closest('.pin-btn')) {
        togglePin(id);
        return;
    }
    if (e.target.closest('.card-color-btn')) {
        toggleColorPopover(e.target.closest('.card-color-btn'), { type: 'note', id });
        return;
    }
    if (e.target.closest('.card-reminder-btn')) {
        toggleReminderPopover(e.target.closest('.card-reminder-btn'), { type: 'note', id });
        return;
    }
    if (e.target.closest('.card-archive-btn')) {
        archiveNote(id);
        showSnackbar('Note archived', () => unarchiveNote(id));
        return;
    }
    if (e.target.closest('.card-unarchive-btn')) {
        unarchiveNote(id);
        showSnackbar('Note unarchived');
        return;
    }
    if (e.target.closest('.card-restore-btn')) {
        restoreNote(id);
        showSnackbar('Note restored');
        return;
    }
    if (e.target.closest('.card-delete-btn')) {
        if (note.trashed) {
            openConfirmModal("Delete this note forever? This can't be undone.", () => {
                deleteForever(id);
                showSnackbar('Note deleted forever');
            });
        } else {
            trashNote(id);
            showSnackbar('Note moved to trash', () => restoreNote(id));
        }
        return;
    }
    if (e.target.closest('.note-card-body')) {
        openEditModal(note);
    }
}

function handleGridKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const body = e.target.closest('.note-card-body');
    if (!body) return;
    e.preventDefault();
    const card = body.closest('.note-card');
    const note = notes.find((n) => n.id === Number(card.dataset.id));
    if (note) openEditModal(note);
}

gridContainers.forEach((container) => {
    container.addEventListener('click', handleGridClick);
    container.addEventListener('keydown', handleGridKeydown);
});

/* ==========================================================================
   Edit modal
   ========================================================================== */

// A native <dialog>'s ::backdrop isn't a separate hit-testable node, so a
// click that lands there targets the <dialog> element itself — but a click
// on any descendant control (including a keyboard-activated Enter/Space,
// whose synthetic MouseEvent always reports clientX/clientY as 0) bubbles up
// with that descendant as e.target instead. Checking e.target === dialogEl,
// rather than comparing click coordinates to the dialog's rect, correctly
// tells backdrop clicks apart from every other way of clicking inside it.
function enableBackdropClose(dialogEl) {
    dialogEl.addEventListener('click', (e) => {
        if (e.target === dialogEl) dialogEl.close();
    });
}

function openEditModal(note) {
    editingId = note.id;
    editOriginal = { title: note.title, text: note.text, label: note.label, color: note.color, reminder: note.reminder };
    drafts.edit.color = note.color;
    drafts.edit.reminder = note.reminder;
    editTitleEl.value = note.title;
    editTextEl.value = note.text;
    editLabelEl.value = note.label;
    editModalContentEl.style.backgroundColor = colorVar(note.color);
    editModalContentEl.classList.toggle('note-card-tinted', note.color !== 'default');
    editModalEl.showModal();
    editTitleEl.focus();
}

// Save and Close both simply close the dialog — every way of leaving it
// (Save, Close, Escape, clicking the backdrop) goes through the single
// 'close' handler below, so they all behave consistently and a stray Escape
// press can never silently discard an edit.
saveEditBtnEl.addEventListener('click', () => editModalEl.close());
closeModalBtnEl.addEventListener('click', () => editModalEl.close());

editModalEl.addEventListener('close', () => {
    if (editingId !== null && editOriginal) {
        const title = editTitleEl.value.trim();
        const text = editTextEl.value.trim();
        const label = editLabelEl.value.trim();
        const wasEmpty = !editOriginal.title && !editOriginal.text;
        const changed =
            title !== editOriginal.title ||
            text !== editOriginal.text ||
            label !== editOriginal.label ||
            drafts.edit.color !== editOriginal.color ||
            drafts.edit.reminder !== editOriginal.reminder;

        if (!title && !text) {
            if (!wasEmpty) {
                trashNote(editingId);
                showSnackbar('Empty note moved to trash', () => restoreNote(editingId));
            }
        } else if (changed) {
            updateNote(editingId, { title, text, label, color: drafts.edit.color, reminder: drafts.edit.reminder });
        }
    }
    editingId = null;
    editOriginal = null;
    hideColorPopover();
});

enableBackdropClose(editModalEl);

/* ==========================================================================
   Confirm modal
   ========================================================================== */

function openConfirmModal(message, action) {
    confirmMessageEl.textContent = message;
    pendingConfirmAction = action;
    confirmModalEl.showModal();
}

confirmOkBtnEl.addEventListener('click', () => {
    if (pendingConfirmAction) pendingConfirmAction();
    confirmModalEl.close();
});

confirmCancelBtnEl.addEventListener('click', () => confirmModalEl.close());

confirmModalEl.addEventListener('close', () => {
    pendingConfirmAction = null;
});

enableBackdropClose(confirmModalEl);

/* ==========================================================================
   Top bar: refresh, view mode, shortcuts, settings (dark theme)
   ========================================================================== */

refreshBtnEl.addEventListener('click', () => {
    notes = loadNotes();
    nextId = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
    renderApp();
    refreshBtnEl.classList.add('spinning');
    setTimeout(() => refreshBtnEl.classList.remove('spinning'), 600);
});

const VIEW_MODE_KEY = 'keep-clone-view-mode';
let listViewMode = localStorage.getItem(VIEW_MODE_KEY) === 'list';

const GRID_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>';
const LIST_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>';

function applyViewMode() {
    document.querySelectorAll('.notes-grid').forEach((grid) => grid.classList.toggle('list-view', listViewMode));
    viewToggleBtnEl.innerHTML = listViewMode ? GRID_ICON : LIST_ICON;
    const nextLabel = listViewMode ? 'Grid view' : 'List view';
    viewToggleBtnEl.dataset.tooltip = nextLabel;
    viewToggleBtnEl.setAttribute('aria-label', `Switch to ${nextLabel.toLowerCase()}`);
    viewToggleBtnEl.setAttribute('aria-pressed', String(listViewMode));
}

viewToggleBtnEl.addEventListener('click', () => {
    listViewMode = !listViewMode;
    localStorage.setItem(VIEW_MODE_KEY, listViewMode ? 'list' : 'grid');
    applyViewMode();
});

shortcutsBtnEl.addEventListener('click', () => shortcutsModalEl.showModal());
shortcutsCloseBtnEl.addEventListener('click', () => shortcutsModalEl.close());
enableBackdropClose(shortcutsModalEl);

const THEME_KEY = 'keep-clone-theme';

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    darkThemeToggleEl.checked = theme === 'dark';
}

settingsBtnEl.addEventListener('click', () => settingsModalEl.showModal());
settingsCloseBtnEl.addEventListener('click', () => settingsModalEl.close());
enableBackdropClose(settingsModalEl);

darkThemeToggleEl.addEventListener('change', () => {
    const theme = darkThemeToggleEl.checked ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
});

applyTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light');
applyViewMode();

emptyTrashBtnEl.addEventListener('click', () => {
    if (!notes.some((n) => n.trashed)) return;
    openConfirmModal('Empty Trash? All notes in Trash will be permanently deleted.', () => {
        emptyTrash();
        showSnackbar('Trash emptied');
    });
});

/* ==========================================================================
   Snackbar
   ========================================================================== */

function hideSnackbar() {
    snackbarEl.classList.add('hidden');
    clearTimeout(snackbarTimeout);
}

function showSnackbar(message, undoFn) {
    clearTimeout(snackbarTimeout);
    snackbarMessageEl.textContent = message;
    snackbarUndoBtnEl.classList.toggle('hidden', !undoFn);
    snackbarUndoBtnEl.onclick = () => {
        if (undoFn) undoFn();
        hideSnackbar();
    };
    snackbarEl.classList.remove('hidden');
    snackbarTimeout = setTimeout(hideSnackbar, 5000);
}

/* ==========================================================================
   Global click / keyboard handling
   ========================================================================== */

document.addEventListener('click', (e) => {
    const isColorTrigger = e.target.closest('.form-color-btn, .card-color-btn, #edit-color-btn');
    const isReminderTrigger = e.target.closest('.form-reminder-btn, .card-reminder-btn');

    if (!e.target.closest('#color-popover') && !isColorTrigger) hideColorPopover();
    if (!e.target.closest('#reminder-popover') && !isReminderTrigger) hideReminderPopover();

    if (noteFormEl.classList.contains('expanded') && !noteFormEl.contains(e.target) && !e.target.closest('.popover')) {
        collapseForm(true);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!colorPopoverEl.classList.contains('hidden')) {
        hideColorPopover();
    } else if (!reminderPopoverEl.classList.contains('hidden')) {
        hideReminderPopover();
    } else if (noteFormEl.classList.contains('expanded')) {
        collapseForm(true);
    }
});

/* ==========================================================================
   Init
   ========================================================================== */

renderApp();
