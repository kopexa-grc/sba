import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { LevelMark } from "../components/level";
import { resetTours } from "../components/Tour";
import { Button } from "../components/ui";
import { usePageTitle } from "../lib/a11y";
import { CATALOG, SCENARIO_SHORT } from "../domain/catalog";

const SECTIONS = [
  { id: "methode", title: "Methode" },
  { id: "grundwerte", title: "Grundwerte" },
  { id: "kategorien", title: "Schutzbedarfskategorien" },
  { id: "szenarien", title: "Schadensszenarien" },
  { id: "maximum", title: "Maximumprinzip & Sondereffekte" },
  { id: "ablauf", title: "Ablauf in der App" },
  { id: "versionen", title: "Versionen & Änderungsprotokoll" },
  { id: "schema", title: "Bewertungsschema" },
  { id: "daten", title: "Import, Export & Datenschutz" },
  { id: "berater", title: "Für Beraterinnen und Berater" },
  { id: "haftung", title: "Haftung & Grenzen" },
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
  usePageTitle("Handbuch");
  const navigate = useNavigate();
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
          <Button
            className="mt-4"
            onClick={() => {
              resetTours();
              navigate("/");
            }}
          >
            Einführung erneut ansehen
          </Button>
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
            Grundwert und eine Erläuterung je Szenario Pflicht – Auditoren fordern sie in jeder Prüfung. Ohne sie lässt sich eine Version nicht abschließen.
          </p>
        </Section>

        <Section id="ablauf" title="Ablauf in der App">
          <ol className="grid gap-1.5 pl-5 [list-style:decimal]">
            <li>Analyse anlegen oder Excel-Bogen übernehmen.</li>
            <li>Asset, Owner und Geltungsbereich erfassen.</li>
            <li>Vertraulichkeit, Integrität und Verfügbarkeit im Fragebogen bewerten – rechts steht das Ergebnis.</li>
            <li>Im Ergebnis Sondereffekte prüfen, Begründungen ergänzen, offene Punkte abarbeiten.</li>
            <li>Version abschließen und den Bericht als PDF oder Excel exportieren.</li>
            <li>Maßnahmen im ISMS ableiten; für eine Unterschrift den PDF-Bericht ausdrucken.</li>
          </ol>
        </Section>

        <Section id="versionen" title="Versionen & Änderungsprotokoll">
          <p>
            Eine Version ist <strong>in Bearbeitung</strong>, bis Sie sie <strong>abschließen</strong>. Danach ist sie
            schreibgeschützt und dokumentiert den Stand der Analyse. Änderungen erfolgen in einer neuen Version – als kleine
            Änderung (z. B. 1.1) oder als Neubewertung (z. B. 2.0). Die abgeschlossene Version bleibt unverändert erhalten.
          </p>
          <p>
            Jede Änderung landet mit Zeitpunkt, Person, altem und neuem Wert im Änderungsprotokoll. Wird eine bestehende
            Einstufung höher- oder herabgestuft – auch gegenüber der vorherigen Version –, fragt die App nach dem Grund. Der
            Versionsvergleich zeigt Verschärfungen rot, Herabstufungen und neue Begründungen grün, Stammdaten gelb.
          </p>
          <p>
            Jede Version hat eine Prüfsumme (SHA-256 über ihren Inhalt). Sie steht im Fuß jeder Berichtsseite und in der
            Historie. So lässt sich erkennen, ob ausgedruckte Seiten zur selben Version gehören und ob ein Bericht zu dem Stand
            passt, der in der App gespeichert ist.
          </p>
          <p className="text-muted">
            Die App ist für die eigenständige Analyse gedacht. Eine formelle Freigabe durch eine zweite Person findet außerhalb
            statt, etwa per Unterschrift auf dem PDF-Bericht oder in der Kopexa-Plattform.
          </p>
        </Section>

        <Section id="schema" title="Bewertungsschema">
          <p>
            Ab welchem Betrag ein finanzieller Schaden „hoch“ ist und welche Ausfallzeit noch tolerierbar ist, hängt von der
            Organisation ab. Die Standardwerte stammen aus dem Referenzbogen (1 Mio. € / 10 Mio. €, 24 h / 1 h). Unter
            Einstellungen lassen sie sich anpassen; die Fragen im Bogen übernehmen die Werte.
          </p>
          <p>
            Jede Analyse speichert, mit welchem Schema-Stand sie bewertet wurde. Spätere Änderungen am Schema gelten nur für
            neue Analysen und neue Versionen – abgeschlossene Bewertungen bleiben nachvollziehbar.
          </p>
        </Section>

        <Section id="daten" title="Import, Export & Datenschutz">
          <ul className="grid gap-1.5 pl-5 [list-style:disc]">
            <li>
              <strong>Import:</strong> FS_Schutzbedarfsanalyse als Excel (.xlsx) oder OpenDocument (.ods) wird anhand der Zellkoordinaten und der Fragetexte
              erkannt. Abweichende Dateiversionen ordnen Sie in der Vorschau zeilenweise zu; widersprüchliche Ja/Nein-Angaben
              („Eingabe prüfen!“) lösen Sie dort auf.
            </li>
            <li>
              <strong>Prüfbericht als Tabelle:</strong> für Excel (.xlsx) oder für LibreOffice, Collabora und openDesk (.ods, ISO/IEC
              26300). Deckblatt, Anwendung (Originalstruktur mit Formeln und Ampel), Änderungsprotokoll und Definitionen – für
              Auditoren ohne Zugriff auf die App.
            </li>
            <li>
              <strong>PDF-Bericht:</strong> Management Summary, Begründungen, Maßnahmen und Unterschriftenfelder zum Ausdrucken.
            </li>
            <li>
              <strong>Speichern und Öffnen (.sba):</strong> das Dateiformat der App – für eine Analyse („Als Datei speichern“),
              alle Analysen samt Einstellungen oder nur die Einstellungen zum Weitergeben. „Datei öffnen“ liest sie wieder ein;
              installiert als App öffnen sich .sba-Dateien auch per Doppelklick. Beim Öffnen wählen Sie, was übernommen wird; ältere Dateien werden automatisch
              umgewandelt.
            </li>
          </ul>
          <p>
            Alle Daten liegen ausschließlich in diesem Browser (IndexedDB). Es werden keine Inhalte an Server übertragen. Die
            App funktioniert nach dem ersten Laden vollständig offline und lässt sich als App installieren. Löschen Sie die
            Browserdaten, sind die Analysen weg – speichern Sie regelmäßig alles als Datei. Die App erinnert nach 30 Tagen daran.
          </p>
        </Section>

        <Section id="berater" title="Für Beraterinnen und Berater">
          <p>
            Sie können die Schutzbedarfsanalyse kostenlos bei Ihren Mandanten einsetzen – auch im Rahmen bezahlter Beratung.
            Die Apache License 2.0 erlaubt die gewerbliche Nutzung ausdrücklich.
          </p>
          <ul className="grid gap-1.5 pl-5 [list-style:disc]">
            <li>
              <strong>Eigener Auftritt:</strong> Unter Einstellungen tragen Sie die Organisation des Mandanten mit Logo ein und bei
              „Erstellt durch“ Ihr Beratungsunternehmen. Beides erscheint in PDF- und Tabellenberichten.
            </li>
            <li>
              <strong>Mehrere Mandanten:</strong> Speichern Sie je Mandant die Einstellungen (Menü Datei → Einstellungen als
              Datei speichern) und die Analysen (Alle Analysen speichern). Beim Wechsel öffnen Sie die Dateien des Mandanten.
              Alternativ nutzen Sie je Mandant ein eigenes Browserprofil.
            </li>
            <li>
              <strong>Schneller Start:</strong> Die Asset-Liste des Mandanten übernehmen Sie über „Assets erfassen“ aus CSV oder
              Excel; ausgefüllte Erhebungsbögen importieren Sie direkt.
            </li>
            <li>
              <strong>Übergabe:</strong> Der Mandant erhält die .sba-Datei und kann die Analysen selbst weiterführen – ohne Konto
              und ohne Installation.
            </li>
          </ul>
          <p>
            Sie beraten regelmäßig zu ISMS, ISO 27001, NIS2 oder IT-Grundschutz? Im{" "}
            <a className="underline underline-offset-2" href="https://kopexa.com/de/partners">
              Partnerprogramm von Kopexa
            </a>{" "}
            finden Sie weitere Möglichkeiten der Zusammenarbeit.
          </p>
        </Section>

        <Section id="haftung" title="Haftung & Grenzen">
          <p>
            Die Kopexa Schutzbedarfsanalyse ist ein kostenloses Hilfsmittel, um den Schutzbedarf strukturiert und
            nachvollziehbar nach der Methodik des BSI-Standards 200-2 zu ermitteln. Sie ersetzt keine Rechts-, Datenschutz-
            oder Auditberatung und keine Prüfung durch eine Zertifizierungsstelle.
          </p>
          <p>
            Einstufungen, Begründungen und daraus abgeleitete Maßnahmen liegen in der Verantwortung der anwendenden
            Organisation. Fragenkatalog, Kategorien und Maßnahmenvorschläge sind Beispiele und müssen gegebenenfalls an die
            eigenen Anforderungen angepasst werden; sie erheben keinen Anspruch auf Vollständigkeit.
          </p>
          <p>
            Die Software wird ohne Gewähr bereitgestellt. Kopexa haftet nicht für Schäden aus der Nutzung, insbesondere nicht
            für Datenverluste – die Daten liegen ausschließlich in Ihrem Browser; sichern Sie sie regelmäßig als Datei.
            Unberührt bleibt die Haftung für Vorsatz und grobe Fahrlässigkeit sowie nach zwingenden gesetzlichen Vorschriften.
          </p>
          <p>
            Der Quellcode steht unter der Apache License 2.0 auf{" "}
            <a className="underline underline-offset-2" href="https://github.com/kopexa-grc/sba">
              github.com/kopexa-grc/sba
            </a>
            .
          </p>
        </Section>
      </article>
    </div>
  );
}
