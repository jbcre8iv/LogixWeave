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
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
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
