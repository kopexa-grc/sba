# Styleguide – Kopexa Schutzbedarfsanalyse

Lebende Referenz: `/styleguide` in der App (`src/pages/Styleguide.tsx`). Neue UI-Bausteine erst dort aufnehmen, dann verwenden.

## Grundsatz

Die App übernimmt die Design-Tokens des Kopexa-Sight-Themes (`@kopexa/theme`), aber **nicht** die Komponentenbibliothek
`@kopexa/sight` – deren Abhängigkeitsbaum (tiptap, ark-ui, react-aria …) ist für eine Offline-PWA zu schwer. Die
Primitives in `src/components/ui.tsx` bilden das Kopexa-Erscheinungsbild mit Tailwind v4 nach.

Werden später shadcn/ui- oder Sight-Komponenten ergänzt, gelten dieselben Tokens: Farben nur aus `@theme`
(`src/index.css`), keine Tailwind-Default-Paletten außer für die Ampel-Soft-Töne (emerald/amber/red 50–800).

## Tokens (`src/index.css`)

| Token | Wert | Verwendung |
| --- | --- | --- |
| `primary-950` | oklch(26.35% 0.054 251.42) ≈ `#10263E` | Kopexa Navy: Header, Primärbutton, Siegel versiegelt |
| `primary-50 … 900` | Sight-Primärskala | Hover (`primary-50`), Fokus (`primary-500`), Links (`primary-700`) |
| `ink` / `muted` | Text / Sekundärtext | |
| `line` | Rahmen, Trennlinien | immer 1 px |
| `surface` / `paper` | Seitenhintergrund / Karten | kühles Grau, kein Creme |
| `lvl-1` `#10B981` | Normal | nur Schutzbedarf |
| `lvl-2` `#F59E0B` | Hoch | nur Schutzbedarf |
| `lvl-3` `#EF4444` | Sehr hoch | nur Schutzbedarf |
| `lvl-open` | offen / unbewertet | |
| Radius | 4 px (klein), 6 px (Controls), 8 px (Karten) | nie größer |

Ampelfarben sind für Schutzbedarfe reserviert. Status (Entwurf/Prüfung/Freigegeben) nutzt `Badge`-Töne, Fehler `red-700`.

## Typografie

- **Schibsted Grotesk** (`font-display`): Überschriften, Kennzahlen im Siegel. Sparsam.
- **Public Sans** (`font-sans`): Fließtext und UI – nüchtern, behördennah, passend zum BSI-Kontext.
- Beide über `@fontsource-variable` lokal gebündelt (offline-fähig, keine Google-Fonts-Requests).
- Skala: 28 Seitentitel · 21 Abschnitt · 15–16 Karte · 14 Text · 13–13.5 Controls · 12.5 Hilfe · 11.5 Tabellenkopf (caps).
- Monospace nur für Hashes/IDs.

## Komponenten (`src/components`)

| Komponente | Datei | Regeln |
| --- | --- | --- |
| `Button` | ui.tsx | `primary` genau einmal pro Bereich; `secondary` Standard; `danger` nur für destruktive Aktionen |
| `Input`, `Textarea`, `Select`, `Field` | ui.tsx | Label immer sichtbar; Pflicht mit `*`; Fehlertext ersetzt Hilfetext |
| `Segmented` | ui.tsx | Ja/Nein-Vorfragen, max. 3 Optionen |
| `Dialog` | ui.tsx | natives `<dialog>`; Footer rechtsbündig, Primäraktion rechts |
| `Badge`, `StatusBadge` | ui.tsx, StatusBadge.tsx | Status, Versionen |
| `LevelPill`, `LevelGauge`, `TriadChips` | level.tsx | Schutzbedarf in Text / Optionen / Listen |
| `Seal` | level.tsx | Signaturelement: V/I/A live, nach Freigabe versiegelt (SHA-256) |

## Texte

- UI-Texte deutsch, Quelltext und Kommentare englisch.
- Aktionen benennen, was passiert („Zur Prüfung einreichen“, „Freigeben“), und behalten den Namen im Toast („Freigegeben und versiegelt.“).
- Fehler erklären, was fehlt und wo – ohne Entschuldigung.
