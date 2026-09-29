import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

// Never hyphenate: e-mail addresses and technical identifiers must stay intact.
Font.registerHyphenationCallback((word) => [word]);
import type { ReactNode } from "react";
import { CATALOG, SCENARIO_SHORT, type GoalDef } from "../../domain/catalog";
import { META_LABEL } from "../../domain/diff";
import { fingerprint, groupedFingerprint, shortFingerprint } from "../../domain/fingerprint";
import { nextSteps } from "../../domain/next-steps";
import { catalogFor, DEFAULT_MEASURES, describeScheme, type MeasureCatalog, type Settings } from "../../domain/scheme";
import { goalResult, scenarioLevel, validate, type Rated } from "../../domain/scoring";
import {
  ASSET_TYPE_LABEL,
  GOALS,
  GOAL_EN,
  GOAL_LABEL,
  LEVEL_LABEL,
  OVERRIDE_KIND_LABEL,
  STATUS_LABEL,
  type AssessmentVersion,
  type AssetMeta,
  type Goal,
  type ScenarioId,
} from "../../domain/types";
import { versionLabel } from "../../domain/versioning";

export interface ReportOptions {
  /** Organization, measures; the rating scheme comes from the version itself. */
  settings?: Settings;
  /** Fixed generation date, mainly for deterministic tests. */
  generatedAt?: Date;
}

interface ReportContext {
  version: AssessmentVersion;
  history: AssessmentVersion[];
  catalog: Record<Goal, GoalDef>;
  measures: MeasureCatalog;
  orgName: string;
  /** PNG/JPEG data URL; other formats are not supported by the PDF renderer. */
  logo: string | null;
  /** SHA-256 over the version content (hex), printed on every page. */
  fingerprint: string;
  /** Consultancy that prepared the report, if set in the settings. */
  preparedBy: { name: string; logo: string | null } | null;
  generatedAt: Date;
}

const INK = "#141A23";
const MUTED = "#6B7280";
const LINE = "#D9DDE3";
const EMPTY_BAR = "#E3E6EA";
const DANGER = "#B91C1C";

const LEVEL_COLOR: Record<Rated, string> = { 1: "#10B981", 2: "#F59E0B", 3: "#EF4444" };

// Stammdaten order: wide fields span both columns.
const META_ORDER: (keyof AssetMeta)[] = [
  "name", "type", "owner", "orgUnit", "contact", "assessor", "location", "personalData",
  "specialCategoryData", "description", "scope",
];
const WIDE_META = new Set<keyof AssetMeta>(["description", "scope", "specialCategoryData"]);

const SCENARIO_ORDER: ScenarioId[] = ["legal", "privacy", "safety", "operations", "reputation", "financial"];

const HAIRLINE = 0.5;
const PAD_X = 56;

const s = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingBottom: 58,
    paddingHorizontal: PAD_X,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
    lineHeight: 1.38,
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: HAIRLINE,
    borderBottomColor: LINE,
    paddingBottom: 6,
    marginBottom: 20,
    fontSize: 8,
    color: MUTED,
  },
  headBrand: { fontFamily: "Helvetica-Bold", color: INK },
  headLeft: { flexDirection: "row", alignItems: "flex-end" },
  logo: { maxHeight: 14, maxWidth: 70, marginRight: 6, objectFit: "contain" },
  draftLine: { color: DANGER, fontSize: 8.5, marginTop: -12, marginBottom: 14 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 20, lineHeight: 1.2, marginBottom: 4 },
  meta: { fontSize: 8, color: MUTED },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 18, marginBottom: 6 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  muted: { color: MUTED },
  small: { fontSize: 8, color: MUTED },
  para: { marginBottom: 4 },
  row: { flexDirection: "row" },
  label: { fontSize: 8, color: MUTED, marginTop: 4, marginBottom: 0 },
  // Result: three columns between two hairlines, separated by hairlines.
  results: { flexDirection: "row", borderTopWidth: HAIRLINE, borderBottomWidth: HAIRLINE, borderColor: LINE },
  resultCol: { flex: 1, paddingVertical: 8, paddingRight: 12 },
  resultColInner: { borderLeftWidth: HAIRLINE, borderLeftColor: LINE, paddingLeft: 12 },
  // Tables: no outer frame, header and row rules only.
  th: {
    flexDirection: "row",
    borderBottomWidth: HAIRLINE,
    borderBottomColor: INK,
    fontSize: 8,
    color: MUTED,
  },
  tr: { flexDirection: "row", borderBottomWidth: HAIRLINE, borderBottomColor: LINE, alignItems: "center" },
  cell: { paddingVertical: 3, paddingRight: 8 },
  // Scenario matrix: fixed row height, every cell vertically centered.
  matrixRow: { flexDirection: "row", height: 19, borderBottomWidth: HAIRLINE, borderBottomColor: LINE },
  matrixCell: { height: 19, justifyContent: "center", paddingRight: 8 },
  kvGrid: { flexDirection: "row", flexWrap: "wrap" },
  kvItem: { width: "50%", borderBottomWidth: HAIRLINE, borderBottomColor: LINE, paddingVertical: 2.5, paddingRight: 12 },
  kvItemWide: { width: "100%" },
  goalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: HAIRLINE,
    borderBottomColor: INK,
    paddingBottom: 3,
    marginTop: 12,
  },
  goalHeadText: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  scenario: { paddingLeft: 14, paddingVertical: 5, borderBottomWidth: HAIRLINE, borderBottomColor: LINE },
  scenarioHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10, color: MUTED },
  bulletText: { flex: 1 },
  measureCols: { flexDirection: "row" },
  measureCol: { flex: 1, marginRight: 14, fontSize: 8.5 },
  issue: { flexDirection: "row", marginBottom: 3 },
  issueKind: { width: 44, fontSize: 8 },
  pageTitle: { fontFamily: "Helvetica-Bold", fontSize: 16, marginBottom: 8 },
  signoffSummary: { flexDirection: "row", borderTopWidth: HAIRLINE, borderBottomWidth: HAIRLINE, borderColor: LINE, paddingVertical: 8, marginVertical: 14 },
  signBlock: { borderBottomWidth: HAIRLINE, borderBottomColor: LINE, paddingVertical: 14 },
  signField: { borderBottomWidth: 0.75, borderBottomColor: INK, minHeight: 22, justifyContent: "flex-end", paddingBottom: 3, marginBottom: 3 },
  sigLine: { borderBottomWidth: HAIRLINE, borderBottomColor: INK, height: 18 },
  mono: { fontFamily: "Courier", fontSize: 8 },
  footer: {
    position: "absolute",
    top: 800,
    left: PAD_X,
    right: PAD_X,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
  },
  // LevelMark: three bars of increasing height, filled up to the level.
  mark: { flexDirection: "row", alignItems: "flex-end" },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 8, marginRight: 5 },
  bar: { width: 2.6, marginRight: 1.3 },
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

const BAR_HEIGHTS = [4, 6, 8];

function LevelMark({
  level,
  word = true,
  size = 9,
  bold = false,
}: {
  level: Rated | null | "na";
  word?: boolean;
  size?: number;
  bold?: boolean;
}) {
  if (level === "na") {
    return (
      <View style={s.mark}>
        <Text style={{ color: MUTED, fontSize: size, lineHeight: 1 }}>n. r.</Text>
      </View>
    );
  }
  return (
    <View style={s.mark}>
      <View style={[s.bars, word ? { marginBottom: size * 0.2 } : {}]}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={h}
            style={[s.bar, { height: h, backgroundColor: level !== null && i < level ? LEVEL_COLOR[level] : EMPTY_BAR }]}
          />
        ))}
      </View>
      {word && (
        <Text style={{ fontSize: size, lineHeight: 1, color: level === null ? MUTED : INK, fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>
          {level === null ? "offen" : LEVEL_LABEL[level]}
        </Text>
      )}
    </View>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={s.bullet} wrap={false}>
      <Text style={s.bulletDot}>–</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function Frame({ ctx, children }: { ctx: ReportContext; children: ReactNode }) {
  const { version } = ctx;
  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.head} fixed>
        <View style={s.headLeft}>
          {ctx.logo && <Image src={ctx.logo} style={s.logo} />}
          <Text>
            <Text style={s.headBrand}>{ctx.orgName}</Text>  Schutzbedarfsanalyse
          </Text>
        </View>
        <Text>
          {version.meta.name || "Unbenanntes Asset"} · Version {versionLabel(version)}
        </Text>
      </View>
      {version.status === "draft" && (
        <Text style={s.draftLine} fixed>
          In Bearbeitung – nicht abgeschlossen.
        </Text>
      )}
      {children}
      <View style={s.footer} fixed>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {ctx.preparedBy?.logo && <Image src={ctx.preparedBy.logo} style={{ height: 9, marginRight: 5 }} />}
          <Text>
            {ctx.preparedBy ? `Erstellt durch ${ctx.preparedBy.name} · ` : ""}schutzbedarf.kopexa.com
          </Text>
        </View>
        <Text
          render={({ pageNumber, totalPages }) =>
            `${ctx.fingerprint ? `Prüfsumme ${shortFingerprint(ctx.fingerprint)} · ` : ""}Seite ${pageNumber} von ${totalPages} · erstellt am ${fmtDate(ctx.generatedAt.toISOString())}`
          }
        />
      </View>
    </Page>
  );
}

function SummaryPage({ ctx }: { ctx: ReportContext }) {
  const { version } = ctx;
  const results = { C: goalResult(version, "C"), I: goalResult(version, "I"), A: goalResult(version, "A") };
  const metaKeys = META_ORDER.filter((k) => k in META_LABEL);
  return (
    <Frame ctx={ctx}>
      <Text style={s.title}>{version.meta.name || "Unbenanntes Asset"}</Text>
      <Text style={s.meta}>
        {ASSET_TYPE_LABEL[version.meta.type]} · Version {versionLabel(version)} · {STATUS_LABEL[version.status]} · zuletzt
        bearbeitet am {fmtDate(version.updatedAt)}
        {version.closedAt ? ` · abgeschlossen am ${fmtDate(version.closedAt)} von ${version.closedBy ?? "–"}` : ""}
      </Text>

      <Text style={s.h2}>Ergebnis</Text>
      <View style={s.results}>
        {GOALS.map((g, i) => {
          const r = results[g];
          return (
            <View key={g} style={[s.resultCol, i > 0 ? s.resultColInner : {}]}>
              <Text style={s.small}>
                {GOAL_LABEL[g]} ({GOAL_EN[g]})
              </Text>
              <View style={{ marginTop: 5, marginBottom: 1 }}>
                <LevelMark level={r.effective} size={15} bold />
              </View>
              <Text style={[s.small, { marginTop: 5 }]}>
                {r.override
                  ? `Übersteuert, berechnet: ${r.computed ? LEVEL_LABEL[r.computed] : "offen"}`
                  : r.complete
                    ? "Maximum aller Szenarien"
                    : `Vorläufig, ${r.answered} von ${r.total} Szenarien bewertet`}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={s.h2}>Bewertung je Schadensszenario</Text>
      <View style={s.th}>
        <Text style={[s.cell, { flex: 1 }]}>Schadensszenario</Text>
        {GOALS.map((g) => (
          <View key={g} style={[s.cell, { width: 88 }]}>
            <Text>{GOAL_LABEL[g]}</Text>
            <Text style={{ fontSize: 7 }}>{GOAL_EN[g]}</Text>
          </View>
        ))}
      </View>
      {SCENARIO_ORDER.map((id) => (
        <View key={id} style={s.matrixRow} wrap={false}>
          <View style={[s.matrixCell, { flex: 1 }]}>
            <View style={s.mark}>
              <Text style={{ fontSize: 9, lineHeight: 1 }}>{SCENARIO_SHORT[id]}</Text>
            </View>
          </View>
          {GOALS.map((g) => {
            const applicable = CATALOG[g].scenarios.some((d) => d.id === id);
            const lvl = applicable ? scenarioLevel(version.answers[g]?.[id]) : "na";
            return (
              <View key={g} style={[s.matrixCell, { width: 88 }]}>
                <LevelMark level={lvl} />
              </View>
            );
          })}
        </View>
      ))}
      <Text style={[s.small, { marginTop: 4 }]}>n. r. = für diesen Grundwert nicht relevant · offen = noch nicht bewertet</Text>

      <Text style={s.h2}>Stammdaten</Text>
      <View style={s.kvGrid}>
        {metaKeys.map((k) => (
          <View key={k} style={[s.kvItem, WIDE_META.has(k) ? s.kvItemWide : {}]} wrap={false}>
            <Text style={s.small}>{META_LABEL[k]}</Text>
            <Text>{fmtMetaValue(k, version.meta)}</Text>
          </View>
        ))}
      </View>
    </Frame>
  );
}

function selectedOptionText(catalog: Record<Goal, GoalDef>, goal: Goal, id: ScenarioId, level: Rated): string | null {
  const def = catalog[goal].scenarios.find((d) => d.id === id);
  const opt = def?.options.find((o) => o.level === level);
  if (!def || !opt) return null;
  return def.kind === "binary" ? `${def.followUp} ${opt.text}` : `${def.followUp.replace(/\s*…$/, "")} ${opt.text}.`;
}

function ReasoningPage({ ctx }: { ctx: ReportContext }) {
  const { version, catalog } = ctx;
  const high = GOALS.map((g) => goalResult(version, g)).filter((r) => r.effective !== null && r.effective >= 2);
  const issues = validate(version);
  return (
    <Frame ctx={ctx}>
      <Text style={[s.h2, { marginTop: 0 }]}>Begründungen für erhöhten Schutzbedarf</Text>
      {high.length === 0 && (
        <Text style={s.para}>
          Für alle Grundwerte ist der Schutzbedarf „Normal“ oder noch offen. Eine gesonderte Begründung ist nicht
          erforderlich.
        </Text>
      )}
      {high.map((r) => {
        const scenarios = catalog[r.goal].scenarios
          .map((d) => ({ d, a: version.answers[r.goal]?.[d.id], l: scenarioLevel(version.answers[r.goal]?.[d.id]) }))
          .filter((x) => x.l !== null && x.l >= 2);
        return (
          <View key={r.goal}>
            <View style={s.goalHead} wrap={false}>
              <Text style={s.goalHeadText}>
                {GOAL_LABEL[r.goal]} <Text style={{ fontFamily: "Helvetica", color: MUTED }}>({GOAL_EN[r.goal]})</Text>
              </Text>
              <LevelMark level={r.effective} size={9.5} />
            </View>
            <Text style={s.label}>Begründung</Text>
            <Text style={s.para}>{version.justifications[r.goal].trim() || "Keine Begründung erfasst."}</Text>
            {r.override && (
              <View wrap={false}>
                <Text style={s.label}>
                  Übersteuerung: {OVERRIDE_KIND_LABEL[r.override.kind]} · berechnet{" "}
                  {r.computed ? LEVEL_LABEL[r.computed] : "offen"}, festgelegt {LEVEL_LABEL[r.override.level]}
                </Text>
                <Text style={s.para}>{r.override.reason.trim() || "Keine Begründung erfasst."}</Text>
              </View>
            )}
            {scenarios.length > 0 && <Text style={[s.label, { marginTop: 8 }]}>Szenarien mit erhöhtem Schutzbedarf</Text>}
            {scenarios.map(({ d, a, l }) => (
              <View key={d.id} style={s.scenario} wrap={false}>
                <View style={s.scenarioHead}>
                  <Text style={s.h3}>{d.title}</Text>
                  <LevelMark level={l} />
                </View>
                <Text style={s.muted}>{selectedOptionText(catalog, r.goal, d.id, l as Rated)}</Text>
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

      {issues.length > 0 && (
        <>
          <Text style={s.h2} minPresenceAhead={24}>
            Offene Plausibilitätshinweise
          </Text>
          {issues.map((w) => (
            <View key={w.path + w.message} style={s.issue} wrap={false}>
              <Text style={[s.issueKind, { color: w.severity === "error" ? DANGER : MUTED }]}>
                {w.severity === "error" ? "Fehlt" : "Hinweis"}
              </Text>
              <Text style={s.bulletText}>{w.message}</Text>
            </View>
          ))}
        </>
      )}
      <ClosingSection ctx={ctx} />
    </Frame>
  );
}

/** One sign-off with generous space for handwriting. */
function SignoffBlock({ role, hint, name, date }: { role: string; hint: string; name?: string; date?: string }) {
  const field = (label: string, value?: string, flex = 1) => (
    <View style={{ flex, marginRight: 12 }}>
      <View style={s.signField}>{value ? <Text>{value}</Text> : null}</View>
      <Text style={s.small}>{label}</Text>
    </View>
  );
  return (
    <View style={s.signBlock} wrap={false}>
      <Text style={s.h3}>{role}</Text>
      <Text style={[s.small, { marginBottom: 14 }]}>{hint}</Text>
      <View style={{ flexDirection: "row" }}>
        {field("Name", name, 1.3)}
        {field("Funktion")}
      </View>
      <View style={{ flexDirection: "row", marginTop: 16 }}>
        {field("Ort, Datum", date, 1)}
        {field("Unterschrift", undefined, 1.3)}
      </View>
    </View>
  );
}

/** Measures, sign-off, history and method; flows on after the justifications. */
function ClosingSection({ ctx }: { ctx: ReportContext }) {
  const { version, history, measures } = ctx;
  const rows = [...history].sort((a, b) => a.major - b.major || a.minor - b.minor);
  const high = GOALS.map((g) => goalResult(version, g)).filter((r) => r.effective !== null && r.effective >= 2);
  return (
    <>
      <View break>
        <Text style={[s.h2, { marginTop: 0 }]} minPresenceAhead={60}>
          Nächste Schritte
        </Text>
        {nextSteps(version).map((step, i) => (
          <View key={step.id} style={{ flexDirection: "row", marginBottom: 2 }} wrap={false}>
            <Text style={{ width: 12, color: MUTED }}>{i + 1}.</Text>
            <Text style={{ flex: 1 }}>
              {step.title}
              {step.link ? <Text style={{ color: MUTED }}>{` – ${step.link.href.replace("https://", "")}`}</Text> : null}
            </Text>
          </View>
        ))}
      </View>

      {high.length > 0 && (
        <View>
          <Text style={s.h2} minPresenceAhead={60}>
            Empfohlene Maßnahmen
          </Text>
          <View style={s.measureCols}>
            {high.map((r) => (
              <View key={r.goal} style={s.measureCol}>
                <Text style={[s.h3, { marginBottom: 3 }]}>
                  {GOAL_LABEL[r.goal]}, {LEVEL_LABEL[r.effective as Rated]}
                </Text>
                {(r.effective === 3 ? [...measures[r.goal][2], ...measures[r.goal][3]] : measures[r.goal][2]).map((m, i) => (
                  <Bullet key={`${i}-${m}`}>{winAnsi(m)}</Bullet>
                ))}
              </View>
            ))}
          </View>
          <Text style={[s.small, { marginTop: 4 }]}>
            Empfehlungen zur Ableitung im ISMS; sie ersetzen keine Modellierung nach IT-Grundschutz-Kompendium.
          </Text>
        </View>
      )}

      {/* Sign-off: own page, so it does not get lost at the end of the report. */}
      <View break>
        <Text style={s.pageTitle}>Freigabe</Text>
        <Text style={s.para}>
          Mit ihrer Unterschrift bestätigen die Beteiligten, dass die Schutzbedarfsfeststellung für „
          {version.meta.name || "Unbenanntes Asset"}“, Version {versionLabel(version)}, vollständig ist und die Einstufungen
          nachvollziehbar begründet sind.
        </Text>
        {ctx.fingerprint && (
          <Text style={s.small}>
            Prüfsumme dieser Version: <Text style={s.mono}>{groupedFingerprint(ctx.fingerprint)}</Text>
          </Text>
        )}
        <View style={s.signoffSummary}>
          {GOALS.map((g) => {
            const r = goalResult(version, g);
            return (
              <View key={g} style={{ flex: 1 }}>
                <Text style={s.small}>{GOAL_LABEL[g]}</Text>
                <LevelMark level={r.effective} size={11} bold />
              </View>
            );
          })}
        </View>
        <SignoffBlock
          role="Erstellt"
          hint="Ersteller:in der Analyse"
          name={version.createdBy.replace(/\s*<.*>$/, "")}
          date={fmtDate(version.createdAt)}
        />
        <SignoffBlock role="Geprüft" hint="z. B. Informationssicherheitsbeauftragte:r, Datenschutzbeauftragte:r" />
        <SignoffBlock role="Freigegeben" hint="z. B. Asset-Owner, CISO oder Geschäftsleitung" />
      </View>

      {/* Appendix: history, method and notes. */}
      <View break>
        <Text style={s.pageTitle}>Anhang</Text>
        <Text style={s.h2} minPresenceAhead={40}>
          Änderungshistorie
        </Text>
        <View style={s.th}>
          <Text style={[s.cell, { width: "12%" }]}>Version</Text>
          <Text style={[s.cell, { width: "14%" }]}>Datum</Text>
          <Text style={[s.cell, { width: "35%" }]}>Beschreibung</Text>
          <Text style={[s.cell, { width: "22%" }]}>Bearbeitet von</Text>
          <Text style={[s.cell, { width: "17%" }]}>Status</Text>
        </View>
        {rows.map((h) => {
          const current = h.id === version.id;
          const font = { fontFamily: current ? "Helvetica-Bold" : "Helvetica" };
          return (
            <View key={h.id} style={s.tr} wrap={false}>
              <Text style={[s.cell, { width: "12%" }, font]}>{versionLabel(h)}</Text>
              <Text style={[s.cell, { width: "14%" }]}>{fmtDate(h.closedAt ?? h.createdAt)}</Text>
              <Text style={[s.cell, { width: "35%" }]}>{h.changeSummary || "–"}</Text>
              <Text style={[s.cell, { width: "22%" }]}>{h.closedBy ?? h.createdBy}</Text>
              <Text style={[s.cell, { width: "17%" }]}>{STATUS_LABEL[h.status]}</Text>
            </View>
          );
        })}
        {rows.length === 0 && (
          <View style={s.tr}>
            <Text style={[s.cell, s.muted]}>Keine Historie vorhanden.</Text>
          </View>
        )}

        <Text style={s.h2} minPresenceAhead={40}>
          Methode
        </Text>
        <Text style={s.para}>
          Der Schutzbedarf wird je Grundwert (Vertraulichkeit, Integrität, Verfügbarkeit) anhand standardisierter
          Schadensszenarien nach BSI-Standard 200-2 bzw. ISO/IEC 27001 ermittelt. Es gilt das Maximumprinzip: Der Schutzbedarf
          eines Grundwerts entspricht dem höchsten Einzelschaden. Kumulations-, Verteilungs- und Vererbungseffekte werden als
          begründete Übersteuerung dokumentiert.
        </Text>
        <Text style={s.para}>Bewertungsschema: {describeScheme(version.scheme)}</Text>
        <Text style={s.small}>
          Versions-ID <Text style={s.mono}>{version.id}</Text>
        </Text>

        {ctx.fingerprint && (
          <>
            <Text style={s.h2} minPresenceAhead={40}>
              Prüfsumme
            </Text>
            <Text style={s.para}>
              Jede Seite trägt die Kurzform der Prüfsumme. Sie wird als SHA-256 über den Inhalt dieser Version berechnet;
              Seiten einer anderen Version oder eines anderen Dokuments zeigen einen anderen Wert. Zum Prüfen die Analyse in
              der Schutzbedarfsanalyse öffnen: Die Historie zeigt dieselbe Prüfsumme je Version.
            </Text>
            <Text style={s.small}>
              <Text style={s.mono}>{groupedFingerprint(ctx.fingerprint)}</Text>
            </Text>
          </>
        )}

        <Text style={s.h2} minPresenceAhead={40}>
          Hinweise
        </Text>
        <Text style={s.muted}>
          Erstellt mit der Kopexa Schutzbedarfsanalyse (schutzbedarf.kopexa.com), einem kostenlosen Hilfsmittel ohne Gewähr. Sie
          ersetzt keine Rechts-, Datenschutz- oder Auditberatung; Einstufung, Begründung und abgeleitete Maßnahmen verantwortet
          die anwendende Organisation.
        </Text>
      </View>
    </>
  );
}

function isRasterDataUrl(url: string | null | undefined): url is string {
  return !!url && /^data:image\/(png|jpe?g);base64,/i.test(url);
}

export function ReportDocument({
  version,
  history,
  settings,
  generatedAt,
  fingerprint: fp = "",
}: {
  version: AssessmentVersion;
  history: AssessmentVersion[];
  settings?: Settings;
  generatedAt: Date;
  /** From fingerprint(version) of the unsanitized version, so it matches the app. */
  fingerprint?: string;
}) {
  const ctx: ReportContext = {
    version,
    history,
    fingerprint: fp,
    catalog: catalogFor(version.scheme),
    measures: settings?.measures ?? DEFAULT_MEASURES,
    orgName: settings?.organization.name.trim() || "Kopexa",
    logo: isRasterDataUrl(settings?.organization.logo) ? settings!.organization.logo : null,
    preparedBy: settings?.preparedBy?.name.trim()
      ? {
          name: settings.preparedBy.name.trim(),
          logo: isRasterDataUrl(settings.preparedBy.logo) ? settings.preparedBy.logo : null,
        }
      : null,
    generatedAt,
  };
  return (
    <Document
      title={`Schutzbedarfsanalyse ${version.meta.name} v${versionLabel(version)}`}
      author={ctx.orgName}
      subject="Schutzbedarfsanalyse – Executive Report"
      creator="schutzbedarf.kopexa.com"
      producer="schutzbedarf.kopexa.com"
      language="de-DE"
    >
      <SummaryPage ctx={ctx} />
      <ReasoningPage ctx={ctx} />
    </Document>
  );
}

async function documentFor(version: AssessmentVersion, history: AssessmentVersion[], opts: ReportOptions = {}) {
  // Computed on the stored version (before text sanitizing) so it matches the value in the app.
  const fp = await fingerprint(version);
  const settings = opts.settings
    ? {
        ...sanitize(opts.settings),
        organization: { ...sanitize(opts.settings.organization), logo: opts.settings.organization.logo },
        preparedBy: opts.settings.preparedBy
          ? { ...sanitize(opts.settings.preparedBy), logo: opts.settings.preparedBy.logo }
          : { name: "", logo: null },
      }
    : undefined;
  return (
    <ReportDocument
      version={sanitize(version)}
      history={sanitize(history)}
      settings={settings}
      generatedAt={opts.generatedAt ?? new Date()}
      fingerprint={fp}
    />
  );
}

export async function renderReportPdf(
  version: AssessmentVersion,
  history: AssessmentVersion[],
  opts?: ReportOptions,
): Promise<Blob> {
  return pdf(await documentFor(version, history, opts)).toBlob();
}

/** Node-only helper used by tests and scripts. */
export async function renderReportBuffer(
  version: AssessmentVersion,
  history: AssessmentVersion[],
  opts?: ReportOptions,
): Promise<Uint8Array> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  return renderToBuffer(await documentFor(version, history, opts));
}
