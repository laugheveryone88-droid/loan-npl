const MONGOLIAN_NUMBER_FORMAT = new Intl.NumberFormat("mn-MN", {
  maximumFractionDigits: 0,
});

export function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? MONGOLIAN_NUMBER_FORMAT.format(value)
    : "—";
}

export function formatMoney(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 2 }).format(value)} ₮`
    : "—";
}

export function formatCompactNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("mn-MN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function maskPhone(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) {
    return "••••";
  }

  return `${"•".repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
}

export function maskIdentifier(value: string | null | undefined) {
  if (!value) return "—";

  const normalized = value.trim();
  if (normalized.length <= 4) return "••••";

  return `${"•".repeat(Math.max(normalized.length - 4, 4))}${normalized.slice(-4)}`;
}
