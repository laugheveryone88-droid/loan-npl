export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      loan_collection_actions: {
        Row: {
          action_date: string | null;
          created_at: string;
          id: number;
          note: string;
          record_id: string;
          source_row: number;
          source_sheet: string;
          status: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          action_date?: string | null;
          created_at?: string;
          id?: never;
          note?: string;
          record_id: string;
          source_row: number;
          source_sheet: string;
          status?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          action_date?: string | null;
          created_at?: string;
          id?: never;
          note?: string;
          record_id?: string;
          source_row?: number;
          source_sheet?: string;
          status?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sheet_payment_baselines: {
        Row: {
          baseline_amount: number
          baseline_at: string
          created_at: string
          customer_cif: string
          high_water_amount: number | null
          high_water_at: string | null
          loan_signature: string
          spreadsheet_id: string
          user_id: string
        }
        Insert: {
          baseline_amount: number
          baseline_at: string
          created_at?: string
          customer_cif: string
          high_water_amount?: number | null
          high_water_at?: string | null
          loan_signature: string
          spreadsheet_id: string
          user_id: string
        }
        Update: {
          baseline_amount?: number
          baseline_at?: string
          created_at?: string
          customer_cif?: string
          high_water_amount?: number | null
          high_water_at?: string | null
          loan_signature?: string
          spreadsheet_id?: string
          user_id?: string
        }
        Relationships: []
      }
      sheet_snapshot_history: {
        Row: {
          captured_at: string;
          change_summary: Json;
          column_count: number;
          id: number;
          payload: Json;
          row_count: number;
          snapshot_hash: string;
          spreadsheet_id: string;
          spreadsheet_title: string;
          user_id: string;
        };
        Insert: {
          captured_at?: string;
          change_summary?: Json;
          column_count?: number;
          id?: never;
          payload: Json;
          row_count?: number;
          snapshot_hash: string;
          spreadsheet_id: string;
          spreadsheet_title: string;
          user_id: string;
        };
        Update: {
          captured_at?: string;
          change_summary?: Json;
          column_count?: number;
          id?: never;
          payload?: Json;
          row_count?: number;
          snapshot_hash?: string;
          spreadsheet_id?: string;
          spreadsheet_title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      advance_sheet_payment_baselines: {
        Args: { p_observations: Json; p_spreadsheet_id: string }
        Returns: undefined
      }
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never;

export const Constants = {
  public: { Enums: {} },
} as const;
