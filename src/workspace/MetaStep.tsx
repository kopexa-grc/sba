import { Field, Segmented, Select } from "../components/ui";
import { META_LABEL } from "../domain/diff";
import { formatEuro, formatHours } from "../domain/scheme";
import { ASSET_TYPE_LABEL, type AssetMeta, type AssetType } from "../domain/types";
import { CommitInput, useEditor } from "./editor";

type TextKey = Exclude<keyof AssetMeta, "type" | "personalData" | "specialCategoryData">;

const PLACEHOLDER: Partial<Record<TextKey, string>> = {
  name: "z. B. SAP S/4HANA Core",
  owner: "Name / Abteilung, verantwortlich für das Asset",
  orgUnit: "z. B. IT-Betrieb, Personalwesen",
  contact: "Ansprechpartner:in, Telefon oder E-Mail",
  assessor: "Wer erstellt diese Analyse?",
  location: "Rechenzentrum, Cloud-Region, Gebäude …",
  description: "Kurzbeschreibung und Einsatzzweck",
  scope: "Welche Prozesse, Standorte, Daten und Schnittstellen sind umfasst – und was nicht?",
};

export function MetaStep() {
  const { version, readOnly, update } = useEditor();
  const m = version.meta;
  const setMeta = <K extends keyof AssetMeta>(key: K, value: AssetMeta[K]) =>
    update((v) => {
      v.meta[key] = value;
    });

  const text = (key: TextKey, opts: { multiline?: boolean; required?: boolean } = {}) => (
    <Field label={META_LABEL[key]} required={opts.required}>
      {(id) => (
        <CommitInput
          id={id}
          value={m[key]}
          multiline={opts.multiline}
          placeholder={PLACEHOLDER[key]}
          onCommit={(val) => setMeta(key, val)}
        />
      )}
    </Field>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div>
        <h2 className="text-[20px] font-semibold">Asset &amp; Scope</h2>
        <p className="mt-0.5 text-[14px] text-muted">
          Was wird untersucht, wer verantwortet es und wo verläuft die Grenze der Betrachtung?
        </p>
      </div>

      <section className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          {text("name", { required: true })}
          <Field label={META_LABEL.type}>
            {(id) => (
              <Select id={id} value={m.type} disabled={readOnly} onChange={(e) => setMeta("type", e.target.value as AssetType)}>
                {(Object.keys(ASSET_TYPE_LABEL) as AssetType[]).map((t) => (
                  <option key={t} value={t}>
                    {ASSET_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {text("description", { multiline: true })}
        {text("scope", { multiline: true })}
      </section>

      <section className="grid gap-4 border-t border-line pt-8 md:grid-cols-2">
        <h3 className="text-[15px] font-semibold md:col-span-2">Verantwortung</h3>
        {text("owner", { required: true })}
        {text("orgUnit")}
        {text("contact")}
        {text("assessor")}
        {text("location")}
      </section>

      <section className="grid gap-4 border-t border-line pt-8">
        <h3 className="text-[15px] font-semibold">Personenbezogene Daten</h3>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[14px]">Werden personenbezogene Daten verarbeitet?</div>
            <div className="text-[13px] text-muted">Daten natürlicher Personen nach Art. 4 Nr. 1 DSGVO</div>
          </div>
          <Segmented
            label={META_LABEL.personalData}
            value={m.personalData}
            disabled={readOnly}
            options={[
              { value: true, label: "Ja" },
              { value: false, label: "Nein" },
            ]}
            onChange={(val) =>
              update((v) => {
                v.meta.personalData = val;
                if (!val) v.meta.specialCategoryData = false;
              })
            }
          />
        </div>
        {m.personalData && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[14px]">Auch besondere Kategorien nach Art. 9 DSGVO?</div>
              <div className="text-[13px] text-muted">Gesundheit, Religion, Gewerkschaft, Biometrie, Herkunft, Sexualleben</div>
            </div>
            <Segmented
              label={META_LABEL.specialCategoryData}
              value={m.specialCategoryData}
              disabled={readOnly}
              options={[
                { value: true, label: "Ja" },
                { value: false, label: "Nein" },
              ]}
              onChange={(val) => setMeta("specialCategoryData", val)}
            />
          </div>
        )}
      </section>

      <section className="grid gap-4 border-t border-line pt-8">
        <h3 className="text-[15px] font-semibold">Version</h3>
        <p className="text-[13.5px] text-muted">
          Bewertet nach Schema „{version.scheme.name}“ (Stand {version.scheme.revision}): finanzieller Schaden hoch ab{" "}
          {formatEuro(version.scheme.financialHigh)}, sehr hoch ab {formatEuro(version.scheme.financialVeryHigh)}; tolerierbarer
          Ausfall bei hoch bis {formatHours(version.scheme.availabilityHighHours)}, bei sehr hoch bis{" "}
          {formatHours(version.scheme.availabilityVeryHighHours)}.
        </p>
        <Field label="Anlass dieser Version" hint="Erscheint in der Änderungshistorie des Deckblatts.">
          {(id) => (
            <CommitInput
              id={id}
              value={version.changeSummary}
              onCommit={(val) =>
                update((v) => {
                  v.changeSummary = val;
                })
              }
            />
          )}
        </Field>
      </section>
    </div>
  );
}
