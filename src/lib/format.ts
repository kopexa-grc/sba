const date = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | null | undefined): string {
  return iso ? date.format(new Date(iso)) : "–";
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "–";
}

/** Strips the e-mail part of an actor label ("Name <mail>"). */
export function actorName(actor: string): string {
  return actor.replace(/\s*<.*>$/, "");
}
