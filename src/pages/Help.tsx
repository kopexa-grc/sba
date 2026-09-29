import type { ReactNode } from "react";
import { LevelMark } from "../components/level";
import { CATALOG, SCENARIO_SHORT } from "../domain/catalog";

const SECTIONS = [
  { id: "methode", title: "Methode" },
  { id: "grundwerte", title: "Grundwerte" },
  { id: "kategorien", title: "Schutzbedarfskategorien" },
  { id: "szenarien", title: "Schadensszenarien" },
  { id: "maximum", title: "Maximumprinzip & Sondereffekte" },
  { id: "ablauf", title: "Ablauf in der App" },
  { id: "freigabe", title: "Freigabe, Siegel & Versionen" },
  { id: "daten", title: "Import, Export & Datenschutz" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line pt-6">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <div className="mt-2 grid gap-3 text-[14px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

export function Help() {
  return (
    <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-8 sm:px-6 md:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Inhalt" className="md:sticky md:top-20 md:self-start">
        <div className="mb-2 px-2 text-[13px] font-semibold">Inhalt</div>
        <ul className="grid gap-0.5 text-[13px]">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-md px-2 py-1 text-muted hover:bg-surface hover:text-ink">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <article className="grid min-w-0 gap-6">
        <header>
          <h1 className="text-[24px] leading-tight font-semibold">Schutzbedarfsanalyse – Handbuch</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-muted">
            Welcher Schaden entsteht der Organisation oder Dritten, wenn Vertraulichkeit, Integrität oder Verfügbarkeit
            eines Assets verletzt werden? Diese Frage beantwortet die Schutzbedarfsanalyse – als Grundlage jedes ISMS nach
            BSI IT-Grundschutz (Standard 200-2) und ISO/IEC 27001.
          </p>
        </header>

        <Section id="methode" title="Methode">
          <p>Eine vollständige Analyse besteht aus vier Ebenen, die die App der Reihe nach abfragt:</p>
          <ol className="grid gap-1.5 pl-5 [list-style:decimal]">
            <li>
              <strong>Asset &amp; Geltungsbereich</strong> – was untersucht wird, wer es verantwortet, wo die Grenze liegt.
            </li>
            <li>
              <strong>Grundwerte</strong> – Vertraulichkeit, Integrität und Verfügbarkeit werden getrennt bewertet, nie pauschal.
            </li>
            <li>
              <strong>Schadensszenarien</strong> – jeder Grundwert wird gegen sechs Schadensarten gespiegelt.
            </li>
            <li>
              <strong>Bewertung &amp; Aggregation</strong> – Einstufung, Maximumprinzip und Sondereffekte.
            </li>
          </ol>
        </Section>

        <Section id="grundwerte" title="Grundwerte">
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Vertraulichkeit", "Wer darf die Daten sehen?", "Datenleck, unbefugte Einsicht, Veröffentlichung von Personaldaten."],
              ["Integrität", "Sind die Daten korrekt und unverfälscht?", "Manipulierte Buchungsdaten, unbemerkte Konfigurationsänderungen."],
              ["Verfügbarkeit", "Stehen System und Daten rechtzeitig bereit?", "Systemausfall, Ransomware, DoS, Leitungsunterbrechung."],
            ].map(([t, q, e]) => (
              <div key={t}>
                <dt className="text-[14px] font-semibold">{t}</dt>
                <dd className="mt-1 text-[13px]">{q}</dd>
                <dd className="mt-1 text-[12.5px] text-muted">{e}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="kategorien" title="Schutzbedarfskategorien">
          <div className="grid gap-2">
            {(
              [
                [1, "Die Schadensauswirkungen sind begrenzt und überschaubar: geringfügige Verstöße, kurzzeitige Beeinträchtigung, geringer finanzieller Schaden."],
                [2, "Die Schadensauswirkungen können beträchtlich sein: spürbare finanzielle Einbußen, Verstoß gegen gesetzliche oder vertragliche Pflichten, erhebliche Behinderung der Geschäftsprozesse."],
                [3, "Die Schadensauswirkungen können ein existenziell bedrohliches, katastrophales Ausmaß erreichen: Existenzgefährdung, Gefahr für Leib und Leben, Ausfall kritischer Infrastrukturen."],
              ] as const
            ).map(([l, t]) => (
              <div key={l} className="flex flex-col gap-1.5 border-t border-line pt-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="w-24 shrink-0">
                  <LevelMark level={l} />
                </span>
                <span className="text-[13.5px]">{t}</span>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-muted">
            Die vollständigen Definitionen je Szenario und Grundwert finden Sie im Fragebogen unter „Definition der
            Schutzbedarfskategorien“ und im Excel-Export auf dem Blatt „Definitionen“.
          </p>
        </Section>

        <Section id="szenarien" title="Schadensszenarien">
          <p>
            Jedes Szenario beginnt mit einer Vorfrage (Ja/Nein). Wird sie verneint, ist das Szenario „Normal“. Wird sie bejaht,
            wählen Sie das Schadensausmaß. So entstehen keine widersprüchlichen Eingaben wie im alten Excel-Bogen.
          </p>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {CATALOG.I.scenarios.map((s) => (
              <li key={s.id} className="border-t border-line pt-2">
                <div className="text-[13.5px] font-medium">{SCENARIO_SHORT[s.id]}</div>
                <div className="text-[12.5px] text-muted">{s.hint}</div>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-muted">
            Wie im Referenz-Erhebungsbogen wird „Leib &amp; Leben“ beim Grundwert Vertraulichkeit nicht betrachtet, da keine
            Unmittelbarkeit zwischen Vertraulichkeitsverlust und Beeinträchtigung besteht. Insgesamt sind 17 Szenarien zu
            bewerten.
          </p>
        </Section>

        <Section id="maximum" title="Maximumprinzip & Sondereffekte">
          <p>
            Der Schutzbedarf eines Grundwerts entspricht dem höchsten Einzelschaden aller Szenarien:{" "}
            <em>Schutzbedarf = max(Szenario₁ … Szenarioₙ)</em>. Sind fünf Szenarien „Normal“ und eines „Sehr hoch“, ist der
            Grundwert „Sehr hoch“.
          </p>
          <p>Nach der formalen Bewertung prüfen Sie im Schritt „Ergebnis &amp; Begründung“ drei Effekte:</p>
          <ul className="grid gap-1.5 pl-5 [list-style:disc]">
            <li>
              <strong>Kumulationseffekt</strong> – mehrere „normale“ Schäden ergeben zusammen einen höheren Schaden (Hochstufung).
            </li>
            <li>
              <strong>Verteilungseffekt</strong> – Redundanzen kompensieren den Ausfall einer Komponente (Herabstufung möglich).
            </li>
            <li>
              <strong>Schutzbedarfsvererbung</strong> – Server, Datenbanken und Netze erben den Schutzbedarf der Prozesse und
              Anwendungen, die auf ihnen laufen.
            </li>
          </ul>
          <p>
            Jede Übersteuerung braucht eine eigene Begründung. Für „Hoch“ und „Sehr hoch“ ist zusätzlich eine Begründung je
            Grundwert und eine Erläuterung je Szenario Pflicht – Auditoren fordern sie in jeder Prüfung.
          </p>
        </Section>

        <Section id="ablauf" title="Ablauf in der App">
          <ol className="grid gap-1.5 pl-5 [list-style:decimal]">
            <li>Analyse anlegen oder Excel-Bogen übernehmen.</li>
            <li>Asset, Owner und Geltungsbereich erfassen.</li>
            <li>Vertraulichkeit, Integrität und Verfügbarkeit im Fragebogen bewerten – das Siegel rechts zeigt das Ergebnis live.</li>
            <li>Im Ergebnis Sondereffekte prüfen, Begründungen ergänzen, Plausibilitätsprüfung abarbeiten.</li>
            <li>Zur Prüfung einreichen; CISO, ISB oder DSB geben frei oder weisen mit Kommentar zurück.</li>
            <li>Bericht als PDF (Management) oder Excel (Audit) exportieren; Maßnahmen im ISMS ableiten.</li>
          </ol>
        </Section>

        <Section id="freigabe" title="Freigabe, Siegel & Versionen">
          <p>
            Status: <strong>Entwurf</strong> → <strong>In Prüfung</strong> → <strong>Freigegeben</strong>. Eine zurückgewiesene
            Version geht als Entwurf zurück. Ab dem Einreichen ist die Version schreibgeschützt.
          </p>
          <p>
            Bei der Freigabe bildet die App einen SHA-256-Hash über den gesamten Inhalt (Stammdaten, Antworten, Begründungen,
            Freigabevermerke). Das Siegel prüft diesen Hash bei jedem Öffnen – auch nach einem JSON-Import. Weicht der Inhalt
            ab, wird das Siegel rot als „verletzt“ markiert.
          </p>
          <p>
            Änderungen an einer freigegebenen Analyse erfolgen über „Neue Version anlegen“ (Minor, z. B. 1.1, oder Major, z. B.
            2.0). Die bisherige Version bleibt gültig, bis die neue freigegeben ist, und wird dann archiviert. Jede
            Höher- oder Herabstufung erfordert einen Änderungsgrund und landet mit altem und neuem Wert im Audit-Trail. Der
            Versionsvergleich zeigt Verschärfungen rot, Herabstufungen und neue Begründungen grün, Stammdaten gelb.
          </p>
        </Section>

        <Section id="daten" title="Import, Export & Datenschutz">
          <ul className="grid gap-1.5 pl-5 [list-style:disc]">
            <li>
              <strong>Excel-Import:</strong> FS_Schutzbedarfsanalyse.xlsx wird anhand der Zellkoordinaten und der Fragetexte
              erkannt. Abweichende Dateiversionen ordnen Sie in der Vorschau zeilenweise zu; widersprüchliche Ja/Nein-Angaben
              („Eingabe prüfen!“) lösen Sie dort auf.
            </li>
            <li>
              <strong>Excel-Export:</strong> Deckblatt, Anwendung (Originalstruktur mit Formeln und Ampel), Audit-Trail und
              Definitionen – für Auditoren ohne Zugriff auf die App.
            </li>
            <li>
              <strong>PDF-Bericht:</strong> Management Summary, Begründungen, Maßnahmen und Unterschriftenmatrix.
            </li>
            <li>
              <strong>Datensicherung (.sba.json):</strong> vollständige Analysen inklusive aller Versionen und Audit-Trail, mit
              Schema-Version für künftige App-Updates.
            </li>
          </ul>
          <p>
            Alle Daten liegen ausschließlich in diesem Browser (IndexedDB). Es werden keine Inhalte an Server übertragen. Die
            App funktioniert nach dem ersten Laden vollständig offline und lässt sich als App installieren. Löschen Sie die
            Browserdaten, sind die Analysen weg – sichern Sie regelmäßig als .sba.json.
          </p>
        </Section>
      </article>
    </div>
  );
}
