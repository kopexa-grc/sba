import { Document, Font, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

// Never hyphenate: e-mail addresses and technical identifiers must stay intact.
Font.registerHyphenationCallback((word) => [word]);
import type { ReactNode } from "react";
import { CATALOG, SCENARIO_SHORT } from "../../domain/catalog";
import { META_LABEL } from "../../domain/diff";
import { MEASURES } from "../../domain/measures";
import { goalResult, scenarioLevel, validate, type Rated } from "../../domain/scoring";
import {
  ASSET_TYPE_LABEL,
  GOALS,
  GOAL_LABEL,
  GOAL_SHORT,
  LEVEL_LABEL,
  OVERRIDE_KIND_LABEL,
  STATUS_LABEL,
  type AssessmentVersion,
  type AssetMeta,
  type Goal,
  type ScenarioId,
  type Signoff,
} from "../../domain/types";
import { versionLabel } from "../../domain/versioning";

export type IntegrityState = "unsealed" | "valid" | "tampered";

export interface ReportOptions {
  integrity?: IntegrityState;
  /** Fixed generation date, mainly for deterministic tests. */
  generatedAt?: Date;
}

const NAVY = "#1B2A41";
const NAVY_SOFT = "#E8EDF5";
const INK = "#1F2937";
const MUTED = "#6B7280";
const LINE = "#D9DEE7";
const PAPER_ALT = "#F6F8FB";

const LEVEL_COLOR: Record<Rated, string> = { 1: "#10B981", 2: "#F59E0B", 3: "#EF4444" };
const LEVEL_TINT: Record<Rated, string> = { 1: "#D1FAE5", 2: "#FEF3C7", 3: "#FEE2E2" };
const LEVEL_INK: Record<Rated, string> = { 1: "#065F46", 2: "#92400E", 3: "#991B1B" };
const OPEN_COLOR = "#9CA3AF";

// Stammdaten order: wide fields break the two-column grid.
const META_ORDER: (keyof AssetMeta)[] = [
  "name", "type", "owner", "orgUnit", "contact", "assessor", "location", "personalData",
  "specialCategoryData", "description", "scope",
];
const WIDE_META = new Set<keyof AssetMeta>(["description", "scope", "specialCategoryData"]);

const SCENARIO_ORDER: ScenarioId[] = ["legal", "privacy", "safety", "operations", "reputation", "financial"];

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
    lineHeight: 1.4,
  },
  band: {
    backgroundColor: NAVY,
    marginHorizontal: -42,
    marginTop: -36,
    paddingHorizontal: 42,
    paddingVertical: 16,
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  brand: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 11, letterSpacing: 2 },
  brandSub: { color: "#B8C4D6", fontSize: 9, marginTop: 2 },
  bandRight: { color: "#B8C4D6", fontSize: 8, textAlign: "right" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 17, color: NAVY, lineHeight: 1.2, marginBottom: 3 },
  subtitle: { fontSize: 9, color: MUTED, marginBottom: 6 },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: NAVY,
    marginTop: 11,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
  },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: INK, marginTop: 8, marginBottom: 3 },
  muted: { color: MUTED },
  small: { fontSize: 7.5, color: MUTED },
  para: { marginBottom: 4 },
  row: { flexDirection: "row" },
  kvGrid: { flexDirection: "row", flexWrap: "wrap" },
  kvItem: { width: "50%", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3, paddingRight: 10 },
  kvItemWide: { width: "100%" },
  kvKey: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 },
  kvVal: {},
  cards: { flexDirection: "row", marginTop: 2 },
  card: { flex: 1, borderRadius: 4, padding: 8, marginRight: 8, borderWidth: 1 },
  cardLast: { marginRight: 0 },
  cardGoal: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase" },
  cardLevel: { fontFamily: "Helvetica-Bold", fontSize: 15, marginTop: 4 },
  cardNote: { fontSize: 7.5, marginTop: 4 },
  table: { borderWidth: 0.5, borderColor: LINE, borderRadius: 2 },
  th: {
    flexDirection: "row",
    backgroundColor: NAVY_SOFT,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: NAVY,
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE },
  trLast: { borderBottomWidth: 0 },
  cell: { paddingVertical: 3, paddingHorizontal: 5 },
  pill: { borderRadius: 2, paddingVertical: 2, paddingHorizontal: 4, textAlign: "center", fontSize: 8 },
  box: { backgroundColor: PAPER_ALT, borderLeftWidth: 2, borderLeftColor: NAVY, padding: 7, marginTop: 8 },
  goalBlock: { marginBottom: 4 },
  measureCols: { flexDirection: "row" },
  measureCol: { flex: 1, marginRight: 10, fontSize: 8 },
  goalHead: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 2 },
  goalHeadText: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: NAVY, marginRight: 8 },
  scenario: { borderLeftWidth: 2, paddingLeft: 8, marginTop: 4, marginBottom: 2, fontSize: 8.5 },
  label: { fontFamily: "Helvetica-Bold", fontSize: 8, color: MUTED, marginTop: 3 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10, color: NAVY },
  bulletText: { flex: 1 },
  warn: { flexDirection: "row", marginBottom: 2, color: "#92400E" },
  sigLine: { borderBottomWidth: 0.75, borderBottomColor: INK, height: 26 },
  mono: { fontFamily: "Courier", fontSize: 7.5 },
  footer: {
    position: "absolute",
    top: 800,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
    fontSize: 7.5,
    color: MUTED,
  },
  draftBanner: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    color: "#92400E",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textAlign: "center",
    paddingVertical: 4,
    marginBottom: 10,
    letterSpacing: 1,
  },
  watermark: {
    position: "absolute",
    top: 380,
    left: 20,
    right: 20,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 54,
    color: "#F59E0B",
    opacity: 0.12,
    transform: "rotate(-35deg)",
  },
});

// The built-in PDF fonts only cover WinAnsi (CP1252). Map common symbols and
// replace everything else, so user input never renders as garbage glyphs.
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const SUBSTITUTES: Record<string, string> = {
  "≤": "<=",
  "≥": ">=",
  "→": "->",
  "←": "<-",
  "≠": "!=",
  "≈": "~",
  "✓": "x",
  "✔": "x",
  "−": "-",
  "\u00a0": " ",
};

export function winAnsi(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (SUBSTITUTES[ch] !== undefined) out += SUBSTITUTES[ch];
    else if (code === 10 || code === 9 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || CP1252_EXTRA.has(ch)) out += ch;
    else out += "?";
  }
  return out;
}

function sanitize<T>(value: T): T {
  if (typeof value === "string") return winAnsi(value) as T;
  if (Array.isArray(value)) return value.map(sanitize) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)])) as T;
  }
  return value;
}

function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return withTime
    ? d.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }) + " UTC"
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function fmtMetaValue(key: keyof AssetMeta, meta: AssetMeta): string {
  if (key === "type") return ASSET_TYPE_LABEL[meta.type];
  const v = meta[key];
  if (v === null) return "nicht angegeben";
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  return v.trim() === "" ? "–" : v;
}

function LevelPill({ level, width }: { level: Rated | null | "na"; width?: number }) {
  if (level === "na") {
    return <Text style={[s.pill, { color: MUTED, backgroundColor: "#F3F4F6", width }]}>n. r.</Text>;
  }
  if (level === null) {
    return <Text style={[s.pill, { color: MUTED, backgroundColor: "#F3F4F6", width }]}>offen</Text>;
  }
  return (
    <Text style={[s.pill, { color: LEVEL_INK[level], backgroundColor: LEVEL_TINT[level], width }]}>
      {LEVEL_LABEL[level]}
    </Text>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={s.bullet} wrap={false}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function Frame({
  version,
  generatedAt,
  heading,
  children,
}: {
  version: AssessmentVersion;
  generatedAt: Date;
  heading: string;
  children: ReactNode;
}) {
  const isFinal = version.status === "approved" || version.status === "archived";
  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.footer} fixed>
        <Text>schutzbedarf.kopexa.com</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `Seite ${pageNumber} von ${totalPages} · erstellt am ${fmtDate(generatedAt.toISOString())}`
          }
        />
      </View>
      {!isFinal && (
        <Text style={s.watermark} fixed>
          ENTWURF
        </Text>
      )}
      <View style={s.band} fixed>
        <View>
          <Text style={s.brand}>KOPEXA</Text>
          <Text style={s.brandSub}>Schutzbedarfsanalyse · {heading}</Text>
        </View>
        <View>
          <Text style={s.bandRight}>{version.meta.name || "Unbenanntes Asset"}</Text>
          <Text style={s.bandRight}>
            Version {versionLabel(version)} · {STATUS_LABEL[version.status]}
          </Text>
        </View>
      </View>
      {!isFinal && (
        <Text style={s.draftBanner} fixed>
          ENTWURF – NICHT FREIGEGEBEN
        </Text>
      )}
      {children}
    </Page>
  );
}

function SummaryPage({ version, generatedAt }: { version: AssessmentVersion; generatedAt: Date }) {
  const results = { C: goalResult(version, "C"), I: goalResult(version, "I"), A: goalResult(version, "A") };
  const metaKeys = META_ORDER.filter((k) => k in META_LABEL);
  return (
    <Frame version={version} generatedAt={generatedAt} heading="Management Summary">
      <Text style={s.title}>{version.meta.name || "Unbenanntes Asset"}</Text>
      <Text style={s.subtitle}>
        {ASSET_TYPE_LABEL[version.meta.type]} · Version {versionLabel(version)} · {STATUS_LABEL[version.status]} ·
        zuletzt bearbeitet am {fmtDate(version.updatedAt)}
        {version.approved ? ` · freigegeben am ${fmtDate(version.approved.at)}` : ""}
      </Text>

      <Text style={s.h2}>Gesamtergebnis</Text>
      <View style={s.cards}>
        {GOALS.map((g, i) => {
          const r = results[g];
          const lvl = r.effective;
          const color = lvl ? LEVEL_COLOR[lvl] : OPEN_COLOR;
          return (
            <View
              key={g}
              style={[
                s.card,
                i === GOALS.length - 1 ? s.cardLast : {},
                { borderColor: color, backgroundColor: lvl ? LEVEL_TINT[lvl] : "#F3F4F6" },
              ]}
            >
              <Text style={[s.cardGoal, { color: lvl ? LEVEL_INK[lvl] : MUTED }]}>
                {GOAL_LABEL[g]} ({GOAL_SHORT[g]})
              </Text>
              <Text style={[s.cardLevel, { color: lvl ? LEVEL_INK[lvl] : MUTED }]}>
                {lvl ? LEVEL_LABEL[lvl] : "offen"}
              </Text>
              <Text style={[s.cardNote, { color: lvl ? LEVEL_INK[lvl] : MUTED }]}>
                {r.override
                  ? `Übersteuert (berechnet: ${r.computed ? LEVEL_LABEL[r.computed] : "offen"})`
                  : r.complete
                    ? "Maximumprinzip"
                    : `vorläufig – ${r.answered} von ${r.total} Szenarien bewertet`}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={s.h2}>Bewertungsmatrix Schadensszenarien</Text>
      <View style={s.table}>
        <View style={s.th}>
          <Text style={[s.cell, { flex: 1 }]}>Schadensszenario</Text>
          {GOALS.map((g) => (
            <Text key={g} style={[s.cell, { width: 84, textAlign: "center" }]}>
              {GOAL_LABEL[g]}
            </Text>
          ))}
        </View>
        {SCENARIO_ORDER.map((id, i) => (
          <View key={id} style={[s.tr, i === SCENARIO_ORDER.length - 1 ? s.trLast : {}]}>
            <Text style={[s.cell, { flex: 1 }]}>{SCENARIO_SHORT[id]}</Text>
            {GOALS.map((g) => {
              const applicable = CATALOG[g].scenarios.some((d) => d.id === id);
              const lvl = applicable ? scenarioLevel(version.answers[g]?.[id]) : "na";
              return (
                <View key={g} style={[s.cell, { width: 84 }]}>
                  <LevelPill level={lvl} />
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={[s.small, { marginTop: 2 }]}>n. r. = nicht relevant für diesen Grundwert · offen = noch nicht bewertet</Text>

      <Text style={s.h2}>Stammdaten</Text>
      <View style={s.kvGrid}>
        {metaKeys.map((k) => (
          <View key={k} style={[s.kvItem, WIDE_META.has(k) ? s.kvItemWide : {}]} wrap={false}>
            <Text style={s.kvKey}>{META_LABEL[k]}</Text>
            <Text style={s.kvVal}>{fmtMetaValue(k, version.meta)}</Text>
          </View>
        ))}
      </View>

    </Frame>
  );
}

function selectedOptionText(goal: Goal, id: ScenarioId, level: Rated): string | null {
  const def = CATALOG[goal].scenarios.find((d) => d.id === id);
  const opt = def?.options.find((o) => o.level === level);
  if (!def || !opt) return null;
  return def.kind === "binary" ? `${def.followUp} ${opt.text}` : `${def.followUp.replace(/\s*…$/, "")} ${opt.text}.`;
}

function ReasoningPage({ version, generatedAt }: { version: AssessmentVersion; generatedAt: Date }) {
  const high = GOALS.map((g) => goalResult(version, g)).filter((r) => r.effective !== null && r.effective >= 2);
  const warnings = validate(version);
  return (
    <Frame version={version} generatedAt={generatedAt} heading="Begründungen">
      <Text style={s.h2}>Begründungen für erhöhten Schutzbedarf</Text>
      {high.length === 0 && (
        <Text style={s.para}>
          Für alle Grundwerte wurde der Schutzbedarf „Normal“ festgestellt (bzw. ist noch offen). Eine gesonderte
          Begründung ist nicht erforderlich.
        </Text>
      )}
      {high.map((r) => {
        const lvl = r.effective as Rated;
        const scenarios = CATALOG[r.goal].scenarios
          .map((d) => ({ d, a: version.answers[r.goal]?.[d.id], l: scenarioLevel(version.answers[r.goal]?.[d.id]) }))
          .filter((x) => x.l !== null && x.l >= 2);
        return (
          <View key={r.goal} style={s.goalBlock}>
            <View style={s.goalHead} wrap={false}>
              <Text style={s.goalHeadText}>{GOAL_LABEL[r.goal]}</Text>
              <LevelPill level={lvl} width={62} />
            </View>
            <Text style={s.label}>Begründung Schutzbedarf</Text>
            <Text style={s.para}>{version.justifications[r.goal].trim() || "– keine Begründung erfasst –"}</Text>
            {r.override && (
              <View wrap={false}>
                <Text style={s.label}>
                  Manuelle Übersteuerung: {OVERRIDE_KIND_LABEL[r.override.kind]} (berechnet:{" "}
                  {r.computed ? LEVEL_LABEL[r.computed] : "offen"}, festgelegt: {LEVEL_LABEL[r.override.level]})
                </Text>
                <Text style={s.para}>{r.override.reason.trim() || "– keine Begründung erfasst –"}</Text>
              </View>
            )}
            {scenarios.map(({ d, a, l }) => (
              <View key={d.id} style={[s.scenario, { borderLeftColor: LEVEL_COLOR[l as Rated] }]} wrap={false}>
                <View style={s.row}>
                  <Text style={[s.h3, { marginTop: 0, flex: 1 }]}>{d.title}</Text>
                  <LevelPill level={l} width={56} />
                </View>
                <Text style={s.muted}>{selectedOptionText(r.goal, d.id, l as Rated)}</Text>
                {a?.explanation.trim() ? (
                  <>
                    <Text style={s.label}>Erläuterung</Text>
                    <Text>{a.explanation}</Text>
                  </>
                ) : null}
                {a?.notes.trim() ? (
                  <>
                    <Text style={s.label}>Weitere Ausführungen</Text>
                    <Text>{a.notes}</Text>
                  </>
                ) : null}
              </View>
            ))}
          </View>
        );
      })}


      {warnings.length > 0 && (
        <>
          <Text style={s.h2}>Offene Plausibilitätshinweise</Text>
          {warnings.map((w) => (
            <View key={w.path + w.message} style={s.warn} wrap={false}>
              <Text style={s.bulletDot}>{w.severity === "error" ? "!" : "•"}</Text>
              <Text style={s.bulletText}>
                {w.severity === "error" ? "Fehler: " : "Hinweis: "}
                {w.message}
              </Text>
            </View>
          ))}
        </>
      )}
    </Frame>
  );
}

const INTEGRITY_TEXT: Record<IntegrityState, { title: string; body: string; color: string }> = {
  valid: {
    title: "Integrität bestätigt",
    body: "Der SHA-256-Hash über den Inhalt der Version stimmt mit dem bei der Freigabe versiegelten Wert überein. Die Version wurde seit der Freigabe nicht verändert.",
    color: "#065F46",
  },
  tampered: {
    title: "Integritätsverletzung festgestellt",
    body: "Der berechnete SHA-256-Hash weicht vom versiegelten Wert ab. Der Inhalt wurde nach der Freigabe verändert; dieser Bericht ist nicht revisionssicher.",
    color: "#991B1B",
  },
  unsealed: {
    title: "Nicht versiegelt",
    body: "Diese Version ist noch nicht freigegeben und daher nicht kryptografisch versiegelt. Inhalte können sich noch ändern.",
    color: "#92400E",
  },
};

function SignoffRow({ role, signoff, last }: { role: string; signoff: Signoff | null; last?: boolean }) {
  return (
    <View style={[s.tr, last ? s.trLast : {}]} wrap={false}>
      <Text style={[s.cell, { width: "20%", fontFamily: "Helvetica-Bold" }]}>{role}</Text>
      <Text style={[s.cell, { width: "24%" }]}>{signoff?.by ?? ""}</Text>
      <Text style={[s.cell, { width: "18%" }]}>{signoff ? fmtDate(signoff.at, true) : ""}</Text>
      <View style={[s.cell, { width: "18%" }]}>
        <Text style={{ color: signoff ? "#065F46" : MUTED }}>{signoff ? "digital erfasst" : "ausstehend"}</Text>
        {signoff?.comment ? <Text style={s.small}>{signoff.comment}</Text> : null}
      </View>
      <View style={[s.cell, { width: "20%" }]}>
        <View style={s.sigLine} />
      </View>
    </View>
  );
}

function SignoffPage({
  version,
  history,
  integrity,
  generatedAt,
}: {
  version: AssessmentVersion;
  history: AssessmentVersion[];
  integrity: IntegrityState;
  generatedAt: Date;
}) {
  const info = INTEGRITY_TEXT[integrity];
  const created: Signoff = { at: version.createdAt, by: version.createdBy };
  const rows = [...history].sort((a, b) => a.major - b.major || a.minor - b.minor);
  const high = GOALS.map((g) => goalResult(version, g)).filter((r) => r.effective !== null && r.effective >= 2);
  return (
    <Frame version={version} generatedAt={generatedAt} heading="Maßnahmen & Freigabe">
      {high.length > 0 && (
        <>
          <View wrap={false}>
            <Text style={s.h2}>Empfohlene Maßnahmen</Text>
            <View style={s.measureCols}>
              {high.map((r) => (
                <View key={r.goal} style={s.measureCol}>
                  <Text style={[s.h3, { marginTop: 0 }]}>
                    {GOAL_LABEL[r.goal]} – {LEVEL_LABEL[r.effective as Rated]}
                  </Text>
                  {MEASURES[r.goal][r.effective as 2 | 3].map((m) => (
                    <Bullet key={m}>{winAnsi(m)}</Bullet>
                  ))}
                </View>
              ))}
            </View>
          </View>
          <Text style={[s.small, { marginTop: 4 }]}>
            Hinweis: Die Maßnahmen sind Empfehlungen zur Ableitung im ISMS und ersetzen keine Modellierung nach IT-Grundschutz-Kompendium.
          </Text>
        </>
      )}
      <Text style={s.h2}>Freigabe- und Unterschriftenmatrix</Text>
      <View style={s.table}>
        <View style={s.th}>
          <Text style={[s.cell, { width: "20%" }]}>Rolle</Text>
          <Text style={[s.cell, { width: "24%" }]}>Name</Text>
          <Text style={[s.cell, { width: "18%" }]}>Datum</Text>
          <Text style={[s.cell, { width: "18%" }]}>Digitale Freigabe</Text>
          <Text style={[s.cell, { width: "20%" }]}>Unterschrift</Text>
        </View>
        <SignoffRow role="Erstellt" signoff={created} />
        <SignoffRow role="Fachlich freigegeben" signoff={version.submitted} />
        <SignoffRow role="Freigegeben" signoff={version.approved} last />
      </View>
      {version.rejections.length > 0 && (
        <Text style={[s.small, { marginTop: 4 }]}>
          Zurückweisungen im Prüfprozess:{" "}
          {version.rejections.map((r) => `${fmtDate(r.at)} ${r.by}${r.comment ? ` („${r.comment}“)` : ""}`).join("; ")}
        </Text>
      )}

      <Text style={s.h2}>Integritätsnachweis</Text>
      <View style={[s.box, { borderLeftColor: info.color, marginTop: 0 }]} wrap={false}>
        <Text style={[s.h3, { marginTop: 0, color: info.color }]}>{info.title}</Text>
        <Text style={s.para}>{info.body}</Text>
        <Text style={s.label}>SHA-256</Text>
        <Text style={s.mono}>{version.hash ?? "–"}</Text>
        <Text style={[s.small, { marginTop: 4 }]}>Versions-ID {version.id}</Text>
      </View>

      <Text style={s.h2}>Änderungshistorie</Text>
      <View style={s.table}>
        <View style={s.th}>
          <Text style={[s.cell, { width: "12%" }]}>Version</Text>
          <Text style={[s.cell, { width: "14%" }]}>Datum</Text>
          <Text style={[s.cell, { width: "38%" }]}>Beschreibung der Änderung</Text>
          <Text style={[s.cell, { width: "22%" }]}>Bearbeiter</Text>
          <Text style={[s.cell, { width: "14%" }]}>Status</Text>
        </View>
        {rows.map((h, i) => (
          <View
            key={h.id}
            style={[s.tr, i === rows.length - 1 ? s.trLast : {}, h.id === version.id ? { backgroundColor: PAPER_ALT } : {}]}
            wrap={false}
          >
            <Text style={[s.cell, { width: "12%", fontFamily: h.id === version.id ? "Helvetica-Bold" : "Helvetica" }]}>
              {versionLabel(h)}
            </Text>
            <Text style={[s.cell, { width: "14%" }]}>{fmtDate(h.approved?.at ?? h.createdAt)}</Text>
            <Text style={[s.cell, { width: "38%" }]}>{h.changeSummary || "–"}</Text>
            <Text style={[s.cell, { width: "22%" }]}>{h.approved?.by ?? h.createdBy}</Text>
            <Text style={[s.cell, { width: "14%" }]}>{STATUS_LABEL[h.status]}</Text>
          </View>
        ))}
        {rows.length === 0 && (
          <View style={[s.tr, s.trLast]}>
            <Text style={[s.cell, s.muted]}>Keine Historie vorhanden.</Text>
          </View>
        )}
      </View>
      <View style={s.box} wrap={false}>
        <Text style={[s.h3, { marginTop: 0 }]}>Methodische Grundlage</Text>
        <Text>
          Der Schutzbedarf wird je Grundwert (Vertraulichkeit, Integrität, Verfügbarkeit) anhand standardisierter
          Schadensszenarien nach BSI-Standard 200-2 bzw. ISO/IEC 27001 ermittelt. Es gilt das Maximumprinzip: Der
          Schutzbedarf eines Grundwerts entspricht dem höchsten Einzelschaden. Kumulations-, Verteilungs- und
          Vererbungseffekte werden als begründete Übersteuerung dokumentiert.
        </Text>
      </View>
    </Frame>
  );
}

export function ReportDocument({
  version,
  history,
  integrity,
  generatedAt,
}: {
  version: AssessmentVersion;
  history: AssessmentVersion[];
  integrity: IntegrityState;
  generatedAt: Date;
}) {
  return (
    <Document
      title={`Schutzbedarfsanalyse ${version.meta.name} v${versionLabel(version)}`}
      author="Kopexa Schutzbedarfsanalyse"
      subject="Schutzbedarfsanalyse – Executive Report"
      creator="schutzbedarf.kopexa.com"
      producer="schutzbedarf.kopexa.com"
      language="de-DE"
    >
      <SummaryPage version={version} generatedAt={generatedAt} />
      <ReasoningPage version={version} generatedAt={generatedAt} />
      <SignoffPage version={version} history={history} integrity={integrity} generatedAt={generatedAt} />
    </Document>
  );
}

function documentFor(version: AssessmentVersion, history: AssessmentVersion[], opts: ReportOptions = {}) {
  const integrity = opts.integrity ?? (version.hash ? "valid" : "unsealed");
  return (
    <ReportDocument
      version={sanitize(version)}
      history={sanitize(history)}
      integrity={integrity}
      generatedAt={opts.generatedAt ?? new Date()}
    />
  );
}

export function renderReportPdf(
  version: AssessmentVersion,
  history: AssessmentVersion[],
  opts?: ReportOptions,
): Promise<Blob> {
  return pdf(documentFor(version, history, opts)).toBlob();
}

/** Node-only helper used by tests and scripts. */
export async function renderReportBuffer(
  version: AssessmentVersion,
  history: AssessmentVersion[],
  opts?: ReportOptions,
): Promise<Uint8Array> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  return renderToBuffer(documentFor(version, history, opts));
}
