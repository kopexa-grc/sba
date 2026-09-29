# Styleguide – Kopexa Schutzbedarfsanalyse

Verbindlich für jede UI-Änderung. Lebende Referenz: `/styleguide` (`src/pages/Styleguide.tsx`).
Neue Muster erst dort aufnehmen, dann verwenden.

## 1. Haltung

Ein Werkzeug für CISOs, ISBs und Auditoren. Es soll wirken wie ein gut gemachtes Formular einer Behörde, die
Geschmack hat: ruhig, präzise, dicht, ohne Dekoration. Farbe ist Information, nie Stimmung.

1. **Struktur kommt aus Weißraum und Linien**, nicht aus Kästen. Eine Überschrift und eine 1‑px-Linie gliedern besser
   als eine weitere Karte.
2. **Farbe nur auf Daten.** Die Ampel (Normal/Hoch/Sehr hoch) erscheint ausschließlich im Stufenbalken. Text bleibt `ink`.
3. **Eine Primäraktion pro Ansicht.** Alles andere ist sekundär oder ein Textlink.
4. **Text vor Symbol.** Icons nur, wo sie schneller lesbar sind als Worte (Schloss, Warnung, Suche, Menüpfeil).
5. **Sachlich formuliert.** Kein Marketing, keine Ausrufezeichen, keine Entschuldigungen.

## 2. Verbotene Muster

Diese Muster lassen Oberflächen generisch und „KI-generiert“ wirken. Sie werden im Review abgelehnt.

| Muster | Warum nicht | Stattdessen |
| --- | --- | --- |
| Farbiger Rand links an Karten, Listenzeilen, Optionen (`border-l-4`, Inset-Schatten, Farbbalken) | Das Standardmotiv generierter Oberflächen; doppelt die Information | Zustand über Text, Stufenbalken oder Rahmenfarbe des ganzen Elements |
| Pastell-Pills mit Punkt und Ring (`bg-red-50 ring-red-200` + `●`) | Visuelles Rauschen, jede Zeile schreit | `LevelMark` (Balken + Text in `ink`) |
| Farbig hinterlegte Hinweisflächen (rote/gelbe/grüne Boxen) | Macht aus jedem Hinweis einen Alarm | Icon in Signalfarbe + Text in `ink`, ohne Fläche |
| Überschriften oder Labels in Versalien mit Sperrung (`uppercase tracking-wide`) | Dashboard-Klischee | Satzschreibung, `muted`, 12.5 px |
| Nummern in Kreisen, Schritt-„Bubbles“ | Template-Stepper | Nummer als Text oder gar keine |
| Gestrichelte Leerzustands-Boxen, zentriert mit Icon | Generischer Empty State | Linksbündiger Text + eine Aktion |
| Schatten auf Karten, Buttons, aktiven Navigationspunkten | Unruhe, falsche Tiefe | Schatten nur für Overlays (Dialog, Menü, Toast) |
| Verläufe, halbtransparente Farbflächen, Glas | Stimmung statt Information | Flächen `paper` oder `surface` |
| Icon vor jedem Button und Menüpunkt | Füllmaterial | Nur wo das Icon Bedeutung trägt |
| Chips für Metadaten (`v1.0`, `Anwendung`, `Entwurf` als Badges nebeneinander) | Badge-Friedhof | Metazeile als Text mit `·` getrennt |
| Karten in Karten | Verschachtelte Rahmen | Eine Ebene Rahmen, darunter Linien |
| Zwei Schriftgrößen-Sprünge in einer Zeile, Emojis, Sparkles | – | – |

## 3. Tokens (`src/index.css`)

| Token | Wert | Verwendung |
| --- | --- | --- |
| `primary-950` | `#10263E` (Kopexa Navy) | Kopfzeile, Primärbutton, Fokus der Auswahl |
| `primary-700` | Links | Textlinks, sonst nichts |
| `ink` | fast schwarz, kühl | jeder Text |
| `muted` | Grau 50 % | Sekundärtext, Metazeilen |
| `line` | Grau 91 % | Rahmen und Trennlinien, immer 1 px |
| `surface` | Grau 97.5 % | Hover, aktive Navigation, Tabellenkopf – nie großflächig |
| `paper` | Weiß | Seitenhintergrund und Container |
| `lvl-1` `#10B981` · `lvl-2` `#F59E0B` · `lvl-3` `#EF4444` | Ampel | **nur** im Stufenbalken und in Exporten |
| `danger` | `red-700` | Fehlertext, destruktive Aktionen |

Radien: 6 px für Controls, 8 px für Container, 4 px für Kleinteile. Nie größer, nie `rounded-full` außer Avatare.

## 4. Typografie

- **Public Sans** für alles; **Schibsted Grotesk** nur für Seitentitel (H1) und die drei Ergebniswerte.
- Skala: H1 24/28 · H2 17 semibold · H3 14 semibold · Text 14/1.55 · Controls 13.5 · Meta 12.5 `muted`.
- Keine Versalien, kein Letterspacing, Ziffern tabellarisch (`tabular`), wo gezählt oder verglichen wird.
- Monospace nur für Hashes und IDs.

## 5. Layout

- Seite weiß. Inhalt max. 1200 px, Seitenrand 16 px (mobil) / 24 px.
- Abstände im 4‑px-Raster; zwischen Abschnitten 32 px, innerhalb 12–16 px.
- Gliederung: Abschnittsüberschrift (H2) + Inhalt. Linien (`border-line`) trennen Zeilen in Listen und Tabellen.
- Container mit Rahmen nur für Dinge, die man als Einheit bearbeitet (ein Szenario, ein Dialog, eine Tabelle).

## 6. Komponenten

### Button
- `primary`: Navy-Fläche, weißer Text. Genau einer pro Ansicht.
- `secondary`: weiß, 1‑px-Rahmen `line`, Hover `surface`.
- `ghost`: ohne Rahmen, Hover `surface`. Für Toolbar-Aktionen.
- `danger`: wie secondary, Text `red-700`. Nur in Bestätigungsdialogen primär.
- Höhe 32 px (sm 28 px), Text 13.5 px medium, kein Icon außer bei Menüpfeil oder reinen Icon-Buttons.

### Eingabefelder
- 32 px hoch, Rahmen `line`, Fokus: Rahmen `primary-950`, kein Glow-Ring.
- Label darüber, 13 px medium. Pflicht: „(Pflicht)“ in `muted` statt rotem Stern.
- Fehler: Text `red-700` unter dem Feld, Rahmen `red-700`. Hilfetext `muted`.

### Ja/Nein (`Segmented`)
- Zwei Segmente in einem 1‑px-Rahmen; aktiv: Navy-Fläche. Nicht strecken (`self-start`).

### Auswahl der Schadensstufe (`OptionRow`)
- Zeilen mit Radio, Text, rechts `LevelMark`. Rahmen `line`; ausgewählt: Rahmen `primary-950` + Fläche `surface`.
- **Kein** farbiger Streifen, keine farbige Fläche.

### Schutzbedarf (`LevelMark`)
- Drei Balken (4 × 6/9/12 px), gefüllt bis zur Stufe in Ampelfarbe, Rest `line`; daneben das Wort in `ink`.
- Offen: drei leere Balken + „offen“ in `muted`.
- Kompakt (Tabellen, Navigation): nur Balken, Wort als `title`.

### Ergebnis (`ResultSummary`)
- Drei Spalten V / I / A: Grundwert (`muted`), Stufe groß (Schibsted 20), `LevelMark`-Balken, Zusatz („3 von 6 bewertet“,
  „übersteuert“). Getrennt durch 1‑px-Linien, keine Füllungen.
- Darunter die Siegelzeile: Schloss-Icon + „Versiegelt am … · SHA-256 1a2b…9f0e“. Verletzt: Icon und Text `red-700`.

### Status
- Text in der Metazeile: „Entwurf“, „In Prüfung“, „Freigegeben“, „Archiviert“. Gesperrte Status mit Schloss-Icon.
- Hinweiszeile für schreibgeschützte Versionen: eine Zeile unter dem Kopf, weiß, Linie unten, Icon + Text.

### Hinweise und Fehler (`Notice`)
- Zeile mit Icon in Signalfarbe (`red-700` Fehler, `amber-600` Hinweis, `ink` Info) und Text in `ink`. Keine Fläche.

### Tabellen
- Kopf: 12.5 px `muted`, Satzschreibung, Linie unten. Zeilen: Linie zwischen den Zeilen, Hover `surface`.
- Keine Zebra-Streifen, keine Außenrahmen mit Radius um Tabellen im Fließtext.

### Navigation (Schritte)
- Liste aus Textlinks; aktiv: Fläche `surface`, Text `ink` semibold. Rechts klein der Fortschritt (`3/6`) oder `LevelMark` kompakt.

### Menüs (Radix, im Stil von shadcn/ui)
- Umsetzung auf `@radix-ui/react-menubar` und `@radix-ui/react-dropdown-menu` (`src/components/menu.tsx`) – Tastatur,
  Fokus, Tippsuche und Platzierung im Viewport kommen von Radix; die Optik aus den Tokens dieses Guides.
- **Menü „Datei“** in der Kopfzeile, auf jeder Seite an derselben Stelle: Neu, Öffnen, Importieren · Speichern
  (Analyse, alle, Einstellungen) · Berichte exportieren. Gruppen durch Linien, Tastenkürzel rechts in `muted`
  (⌘S/Strg+S, ⌘O/Strg+O, ⇧⌘S) und als `aria-keyshortcuts`.
- `.sba` ist das eigene Dateiformat: „Speichern/Öffnen“. PDF, XLSX und ODS sind Berichte: „Exportieren“. Fremde Bögen:
  „Importieren“.
- Kontextaktionen einer Seite (z. B. Löschen) in einem „⋯“-Dropdown; destruktive Einträge `red-700`.
- Menüflächen: Weiß, 1‑px-Rahmen, Radius 6 px, Overlay-Schatten, Einträge 13.5 px, hervorgehoben mit `surface`.

### Dialog, Menü, Toast
- Einzige Elemente mit Schatten. Dialog: Titel 16 semibold, Aktionen rechts, Primäraktion ganz rechts.
- Menüeinträge ohne Icons; destruktive Einträge durch Linie abgetrennt, Text `red-700`.

### Leerzustand
- Linksbündig: Überschrift H2, ein Satz, eine Primäraktion, optional eine sekundäre.

### Versionsvergleich
- Tabelle Feld · Vorher · Nachher. Nachher-Wert eingefärbt: verschärft `red-700` mit „↑“, herabgestuft `emerald-700`
  mit „↓“, Begründung `emerald-700`, Stammdaten `amber-700`. Legende als Text über der Tabelle.

## 7. Texte

- UI-Texte deutsch, Quelltext und Kommentare englisch.
- Buttons benennen die Aktion („Zur Prüfung einreichen“), der Toast bestätigt mit demselben Verb („Eingereicht.“).
- Fehler sagen, was fehlt und wo („Integrität: Begründung für „Hoch“ fehlt.“).
- Keine Füllsätze in Beschreibungen; eine Zeile unter der Überschrift reicht oder gar keine.
