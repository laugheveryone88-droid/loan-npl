export const GOOGLE_SHEETS_ACCESS_TOKEN_COOKIE =
  "loan_npl_google_sheets_access_token";

export const GOOGLE_SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

export const LIVE_OVERDUE_SPREADSHEET_ID =
  "1NDDlNpouyiVPZrsmhS_3Mwkli1pjYIL7gyLpznN11G4";

export const LIVE_OVERDUE_SPREADSHEET_URL =
  `https://docs.google.com/spreadsheets/d/${LIVE_OVERDUE_SPREADSHEET_ID}/edit`;

export const LIVE_OVERDUE_SPREADSHEET_NAME = "Хугацаа хэтрэлт онтайм";

export const LIVE_OVERDUE_SYNC_INTERVAL_MS = 60_000;
export const LIVE_OVERDUE_SYNC_MAX_RETRY_MS = 120_000;

export const LIVE_OVERDUE_SYNC_SCHEDULE_LABEL =
  "Апп харагдаж байх үед бүх баганын өөрчлөлтийг 1 минут тутам автоматаар шалгана.";
