import { useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../app/session";
import { repo } from "../db/repo";
import { ASSET_TYPE_LABEL, type AssetType } from "../domain/types";
import { Button, Dialog, Field, Input, Select } from "./ui";

export function NewAssetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actor, identity, guard } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("application");
  const [owner, setOwner] = useState("");

  async function create() {
    const v = await guard(() => repo.createAsset(actor, { name: name.trim(), type, owner: owner.trim(), assessor: identity?.name ?? "" }));
    if (!v) return;
    setName("");
    setOwner("");
    onClose();
    navigate(`/a/${v.assetId}/v/${v.id}`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Neue Schutzbedarfsanalyse"
      description="Pro Asset eine Analyse – so bleibt jede Einstufung einzeln nachvollziehbar."
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={create}>
            Analyse anlegen
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create();
        }}
      >
        <Field label="Asset-Bezeichnung" required>
          {(id) => (
            <Input id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. SAP S/4HANA Core, Kunden-CRM" />
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Asset-Typ">
            {(id) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value as AssetType)}>
                {(Object.keys(ASSET_TYPE_LABEL) as AssetType[]).map((t) => (
                  <option key={t} value={t}>
                    {ASSET_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Asset-Owner">
            {(id) => <Input id={id} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Name / Abteilung" />}
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
