# Implementation Plan - Search Screen Apple Music Alignment

## Proposed Changes

### 1. Update Search Header & Scope Toggles
- Restyle search input in `TopBar.tsx` or search view to include microphone icon option, clear "X" button, and rounded pill design matching Apple Music.
- Add scope toggle pills ("Apple Music" vs "Biblioteca") right below the search bar.

### 2. Restyle Recent Searches & History List
- Update the recent searches section in search view to match the list style shown in reference image:
  - Circular/rounded square thumbnails for items (artists, albums, playlists, tracks).
  - Title and subtitle metadata (e.g. "Artista", "Álbum · Artista", "Playlist").
  - Right-facing chevron (`>`) on each row.
  - "Limpar" button on the "Buscas Recentes" header.

### 3. Verification & Tests
- Compile applet and run tests to ensure no regressions.
