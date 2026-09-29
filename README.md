# Kopexa Schutzbedarfsanalyse (SBA)

Progressive Web App für die Schutzbedarfsfeststellung nach **BSI IT-Grundschutz 200-2** und **ISO/IEC 27001** –
Nachfolger des Excel-Bogens `FS_Schutzbedarfsanalyse_neu.xlsx`.

**Live:** https://kopexa-grc.github.io/sba/ (später https://schutzbedarf.kopexa.com)

- Geführter Wizard: Asset & Scope → Vertraulichkeit → Integrität → Verfügbarkeit → Ergebnis
- Maximumprinzip live, Sondereffekte (Kumulation, Verteilung, Vererbung) als begründete Übersteuerung
- Begründungspflicht für „Hoch“ und „Sehr hoch“, Plausibilitätsprüfung vor dem Einreichen
- Workflow Entwurf → In Prüfung → Freigegeben; Freigabe versiegelt die Version mit SHA-256
- Versionierung (Minor/Major), feldgenauer Audit-Trail mit Änderungsgrund, visueller Versionsvergleich
- XLSX-Import des Legacy-Bogens (inkl. Zeilenzuordnung und Auflösung von „Eingabe prüfen!“-Widersprüchen)
- XLSX-Prüfbericht (Deckblatt, Anwendung mit Originalformeln, Audit-Trail, Definitionen), PDF-Executive-Report,
  JSON-Sicherung (`.sba.json`, schema-versioniert)
- Offline-first: alle Daten in IndexedDB, keine Serverkommunikation, installierbar

## Entwicklung

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # Vitest: Scoring, Versionierung, Repo, XLSX, PDF
pnpm typecheck
pnpm build      # dist/ inkl. Service Worker und 404.html (SPA-Fallback für GitHub Pages)
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/domain` | Fragenkatalog (1:1 aus dem Excel, mit Zellkoordinaten), Scoring, Versionierung/Hash, Diff, Definitionen, Maßnahmen |
| `src/db` | Dexie-Datenbank und Repository (auditierte Änderungen, Workflow-Übergänge, Import/Export) |
| `src/io` | JSON-Sicherung, `xlsx/` (ExcelJS Import/Export), `pdf/` (react-pdf Report) – XLSX/PDF werden lazy geladen |
| `src/workspace` | Wizard-Schritte, Ergebnis, Historie, Vergleich, Workflow-Aktionen |
| `src/pages` | Übersicht, Analyse, Handbuch, Einstellungen, Styleguide |
| `docs/STYLEGUIDE.md` | Design-Tokens und Komponentenregeln (Kopexa-CI) |

## Methodische Hinweise

- Wie im Referenzbogen wird „Beeinträchtigung der persönlichen Unversehrtheit“ für Vertraulichkeit nicht bewertet
  (17 statt 18 Szenarien).
- Die Frage zu Leib & Leben bei Verfügbarkeit ist sprachlich auf Ausfall statt Manipulation korrigiert (im Excel kopiert).
- Eine neue Version löst die bisher freigegebene erst bei ihrer eigenen Freigabe ab; bis dahin bleibt die alte gültig.
- Änderungsgründe sind Pflicht, wenn sich eine bestehende Einstufung ändert – auch gegenüber der freigegebenen Vorversion.

## Deployment

Push auf `main` → GitHub Actions (Typecheck, Tests, Build) → GitHub Pages. Gesteuert über Repo-Variablen:

| Variable | Heute | Mit eigener Domain |
| --- | --- | --- |
| `PAGES_BASE_PATH` | `/sba/` | leer lassen oder `/` |
| `PAGES_CNAME` | nicht gesetzt | `schutzbedarf.kopexa.com` |

Umstellen auf die Domain: in Cloudflare `CNAME schutzbedarf → kopexa-grc.github.io` (DNS only) anlegen, die beiden
Variablen setzen, in den Pages-Settings die Custom Domain eintragen und den Workflow neu laufen lassen.
