export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member";
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member";
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          naming_rule_set_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          naming_rule_set_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          naming_rule_set_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      project_files: {
        Row: {
          id: string;
          project_id: string;
          file_name: string;
          file_type: "l5x" | "l5k";
          file_size: number;
          storage_path: string;
          parsing_status: "pending" | "processing" | "completed" | "failed";
          parsing_error: string | null;
          uploaded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          file_name: string;
          file_type: "l5x" | "l5k";
          file_size: number;
          storage_path: string;
          parsing_status?: "pending" | "processing" | "completed" | "failed";
          parsing_error?: string | null;
          uploaded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          file_name?: string;
          file_type?: "l5x" | "l5k";
          file_size?: number;
          storage_path?: string;
          parsing_status?: "pending" | "processing" | "completed" | "failed";
          parsing_error?: string | null;
          uploaded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      parsed_tags: {
        Row: {
          id: string;
          file_id: string;
          name: string;
          data_type: string;
          scope: string;
          description: string | null;
          value: string | null;
          alias_for: string | null;
          usage: string | null;
          radix: string | null;
          external_access: string | null;
          dimensions: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          name: string;
          data_type: string;
          scope: string;
          description?: string | null;
          value?: string | null;
          alias_for?: string | null;
          usage?: string | null;
          radix?: string | null;
          external_access?: string | null;
          dimensions?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          name?: string;
          data_type?: string;
          scope?: string;
          description?: string | null;
          value?: string | null;
          alias_for?: string | null;
          usage?: string | null;
          radix?: string | null;
          external_access?: string | null;
          dimensions?: string | null;
          created_at?: string;
        };
      };
      parsed_io_modules: {
        Row: {
          id: string;
          file_id: string;
          name: string;
          catalog_number: string | null;
          parent_module: string | null;
          slot: number | null;
          connection_info: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          name: string;
          catalog_number?: string | null;
          parent_module?: string | null;
          slot?: number | null;
          connection_info?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          name?: string;
          catalog_number?: string | null;
          parent_module?: string | null;
          slot?: number | null;
          connection_info?: Json | null;
          created_at?: string;
        };
      };
      parsed_routines: {
        Row: {
          id: string;
          file_id: string;
          name: string;
          program_name: string;
          type: string;
          description: string | null;
          rung_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          name: string;
          program_name: string;
          type: string;
          description?: string | null;
          rung_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          name?: string;
          program_name?: string;
          type?: string;
          description?: string | null;
          rung_count?: number | null;
          created_at?: string;
        };
      };
      parsed_rungs: {
        Row: {
          id: string;
          file_id: string;
          routine_id: string | null;
          routine_name: string;
          program_name: string;
          number: number;
          content: string | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          routine_id?: string | null;
          routine_name: string;
          program_name: string;
          number: number;
          content?: string | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          routine_id?: string | null;
          routine_name?: string;
          program_name?: string;
          number?: number;
          content?: string | null;
          comment?: string | null;
          created_at?: string;
        };
      };
      tag_references: {
        Row: {
          id: string;
          file_id: string;
          tag_name: string;
          routine_name: string;
          program_name: string;
          rung_number: number;
          usage_type: "read" | "write" | "both";
          created_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          tag_name: string;
          routine_name: string;
          program_name: string;
          rung_number: number;
          usage_type: "read" | "write" | "both";
          created_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          tag_name?: string;
          routine_name?: string;
          program_name?: string;
          rung_number?: number;
          usage_type?: "read" | "write" | "both";
          created_at?: string;
        };
      };
      parsed_udts: {
        Row: {
          id: string;
          file_id: string;
          name: string;
          description: string | null;
          family_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          name: string;
          description?: string | null;
          family_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          name?: string;
          description?: string | null;
          family_type?: string | null;
          created_at?: string;
        };
      };
      parsed_udt_members: {
        Row: {
          id: string;
          udt_id: string;
          name: string;
          data_type: string;
          dimension: string | null;
          radix: string | null;
          external_access: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          udt_id: string;
          name: string;
          data_type: string;
          dimension?: string | null;
          radix?: string | null;
          external_access?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          udt_id?: string;
          name?: string;
          data_type?: string;
          dimension?: string | null;
          radix?: string | null;
          external_access?: string | null;
          description?: string | null;
          created_at?: string;
        };
      };
      parsed_aois: {
        Row: {
          id: string;
          file_id: string;
          name: string;
          description: string | null;
          revision: string | null;
          vendor: string | null;
          execute_prescan: boolean;
          execute_postscan: boolean;
          execute_enable_in_false: boolean;
          created_date: string | null;
          created_by: string | null;
          edited_date: string | null;
          edited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          name: string;
          description?: string | null;
          revision?: string | null;
          vendor?: string | null;
          execute_prescan?: boolean;
          execute_postscan?: boolean;
          execute_enable_in_false?: boolean;
          created_date?: string | null;
          created_by?: string | null;
          edited_date?: string | null;
          edited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          name?: string;
          description?: string | null;
          revision?: string | null;
          vendor?: string | null;
          execute_prescan?: boolean;
          execute_postscan?: boolean;
          execute_enable_in_false?: boolean;
          created_date?: string | null;
          created_by?: string | null;
          edited_date?: string | null;
          edited_by?: string | null;
          created_at?: string;
        };
      };
      parsed_aoi_parameters: {
        Row: {
          id: string;
          aoi_id: string;
          name: string;
          data_type: string;
          usage: "Input" | "Output" | "InOut";
          required: boolean;
          visible: boolean;
          external_access: string | null;
          description: string | null;
          default_value: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          aoi_id: string;
          name: string;
          data_type: string;
          usage: "Input" | "Output" | "InOut";
          required?: boolean;
          visible?: boolean;
          external_access?: string | null;
          description?: string | null;
          default_value?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          aoi_id?: string;
          name?: string;
          data_type?: string;
          usage?: "Input" | "Output" | "InOut";
          required?: boolean;
          visible?: boolean;
          external_access?: string | null;
          description?: string | null;
          default_value?: string | null;
          created_at?: string;
        };
      };
      parsed_aoi_local_tags: {
        Row: {
          id: string;
          aoi_id: string;
          name: string;
          data_type: string;
          radix: string | null;
          external_access: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          aoi_id: string;
          name: string;
          data_type: string;
          radix?: string | null;
          external_access?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          aoi_id?: string;
          name?: string;
          data_type?: string;
          radix?: string | null;
          external_access?: string | null;
          description?: string | null;
          created_at?: string;
        };
      };
      parsed_aoi_routines: {
        Row: {
          id: string;
          aoi_id: string;
          name: string;
          type: string;
          description: string | null;
          rung_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          aoi_id: string;
          name: string;
          type: string;
          description?: string | null;
          rung_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          aoi_id?: string;
          name?: string;
          type?: string;
          description?: string | null;
          rung_count?: number | null;
          created_at?: string;
        };
      };
      naming_rules: {
        Row: {
          id: string;
          organization_id: string;
          rule_set_id: string;
          name: string;
          description: string | null;
          pattern: string;
          applies_to: "all" | "controller" | "program" | "io" | "udt" | "aoi";
          severity: "error" | "warning" | "info";
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          rule_set_id: string;
          name: string;
          description?: string | null;
          pattern: string;
          applies_to: "all" | "controller" | "program" | "io" | "udt" | "aoi";
          severity?: "error" | "warning" | "info";
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          rule_set_id?: string;
          name?: string;
          description?: string | null;
          pattern?: string;
          applies_to?: "all" | "controller" | "program" | "io" | "udt" | "aoi";
          severity?: "error" | "warning" | "info";
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      naming_rule_sets: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          is_default: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_analysis_cache: {
        Row: {
          id: string;
          file_id: string;
          analysis_type: "explain" | "issues" | "search";
          target: string;
          input_hash: string;
          result: Record<string, unknown>;
          tokens_used: number | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          file_id: string;
          analysis_type: "explain" | "issues" | "search";
          target: string;
          input_hash: string;
          result: Record<string, unknown>;
          tokens_used?: number | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          file_id?: string;
          analysis_type?: "explain" | "issues" | "search";
          target?: string;
          input_hash?: string;
          result?: Record<string, unknown>;
          tokens_used?: number | null;
          created_at?: string;
          expires_at?: string;
        };
      };
      ai_usage_log: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          analysis_type: string;
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
          cached: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          analysis_type: string;
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          cached?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          analysis_type?: string;
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          cached?: boolean;
          created_at?: string;
        };
      };
      project_activity_log: {
        Row: {
          id: string;
          project_id: string;
          user_id: string | null;
          user_email: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          target_name: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id?: string | null;
          user_email?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          target_name?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string | null;
          user_email?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          target_name?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
      };
      project_user_sessions: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          last_seen_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
