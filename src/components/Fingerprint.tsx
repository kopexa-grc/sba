import { useEffect, useState } from "react";
import { fingerprint, shortFingerprint } from "../domain/fingerprint";
import type { AssessmentVersion } from "../domain/types";

/** Short checksum of a version, as printed in the report footers – for comparing a printout with the app. */
export function FingerprintText({ version }: { version: AssessmentVersion }) {
  const [hex, setHex] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fingerprint(version).then((h) => alive && setHex(h));
    return () => {
      alive = false;
    };
  }, [version]);
  if (!hex) return null;
  return (
    <span title={`SHA-256 ${hex}`}>
      Prüfsumme <span className="font-mono text-[12px]">{shortFingerprint(hex)}</span>
    </span>
  );
}
