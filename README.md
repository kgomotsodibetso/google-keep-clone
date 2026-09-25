# Keep Clone

A simplified clone of [Google Keep](https://keep.google.com), built with plain HTML, CSS and JavaScript for the Zaio Institute of Tech web development assignment. No frameworks, build tools, or dependencies — just three files.

## Running it

There's no build step. Either:

1. Double-click `index.html` to open it directly in your browser, **or**
2. Serve the folder with any static server, e.g. from this folder run:
   ```
   npx serve .
   ```
   or, with Python installed:
   ```
   python -m http.server 8000
   ```
   then visit `http://localhost:8000`.

Works in any modern browser (Chrome, Edge, Firefox, Safari) — it uses the native `<dialog>` element for modals and `localStorage` for saving notes, so no backend or database is needed. Notes persist in the browser between visits; clearing site data/localStorage will reset them.

## Features

- **Create & add notes** — click the "Take a note..." bar to expand a title/body form; it saves automatically when you submit, click Close, click away, or press Escape.
- **Display notes** — an active-notes grid (masonry-style layout), with pinned notes separated from the rest.
- **Pin / unpin** a note to keep it at the top.
- **Background colors** — a Keep-style color picker popover, shared between the create form, each note card, and the edit modal.
- **Reminders** — attach a date/time to a note via a small popover; a dedicated Reminders view lists them chronologically.
- **Labels** — tag a note with a label from the edit modal; a Labels view lists all labels as filter chips.
- **Archive** — move a note out of the main view without deleting it; unarchive brings it back.
- **Trash** — deleting a note moves it to Trash (reversible via an "Undo" snackbar); from Trash you can restore a note or permanently delete it (with a confirmation modal), or empty the whole trash at once.
- **Search** — filters notes live by title, body, or label text.
- **Edit modal** — click any note's body to open a full editor for its title, text, and label.
- **Tooltips** — hovering any icon-only button shows a custom CSS tooltip describing its action.
- **Responsive layout** — the sidebar collapses behind a menu toggle and the note grid drops to a single column on narrow/mobile screens.

## File structure

```
Google Keep/
├── index.html        # Page structure: app bar, sidebar nav, note views, modals, popovers
├── stylesheet.css     # All styling, including the responsive layout
├── script.js          # All application logic (state, rendering, event handling)
├── assets/
│   └── icon_2026_v2_192.png   # Favicon / app icon
└── README.md
```

## Notes on the implementation

- All note data is kept in a single in-memory array and persisted to `localStorage` after every change — there's no backend.
- Note cards are cloned from a single `<template>` element rather than built with HTML strings, and clicks are handled with one delegated listener per grid rather than one listener per button.
- The edit and confirmation dialogs use the native `<dialog>` element, which provides built-in backdrop and Escape-to-close behavior for free.
