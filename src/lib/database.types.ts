// Tipos do banco Supabase (schema public), no formato de `supabase gen types typescript`.
// Gerado por introspecção do catálogo em 20/09/2026 (a CLI exige Docker para --db-url).
// NÃO editar à mão: regenerar após cada migration (ver docs/database/README.md).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          id: number
          identified_user_id: string | null
          ip_address: unknown | null
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          id?: never
          identified_user_id?: string | null
          ip_address?: unknown | null
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          id?: never
          identified_user_id?: string | null
          ip_address?: unknown | null
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_identified_user_id_fkey"
            columns: ["identified_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_shifts: {
        Row: {
          event_id: string
          shift_id: number
        }
        Insert: {
          event_id: string
          shift_id: number
        }
        Update: {
          event_id?: string
          shift_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_shifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          event_date: string
          event_type: string
          id: string
          scope: string
          source: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          event_date: string
          event_type: string
          id?: string
          scope: string
          source?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          event_date?: string
          event_type?: string
          id?: string
          scope?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          error_message: string | null
          id: string
          loaded_at: string | null
          reverted_at: string | null
          source_file: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          loaded_at?: string | null
          reverted_at?: string | null
          source_file: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          loaded_at?: string | null
          reverted_at?: string | null
          source_file?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          batch_id: string
          created_at: string
          discard_reason: string | null
          downtime_id: string | null
          error_message: string | null
          id: number
          kind: string
          machine_id: number | null
          notes: string | null
          operator_count: number | null
          production_date: string | null
          production_record_id: string | null
          quantity: number | null
          raw_machine: string
          raw_value: string | null
          shift_id: number | null
          source_cell: string
          source_sheet: string
          status: string
          target_quantity: number | null
          target_source: string | null
          work_mode: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          discard_reason?: string | null
          downtime_id?: string | null
          error_message?: string | null
          id?: never
          kind: string
          machine_id?: number | null
          notes?: string | null
          operator_count?: number | null
          production_date?: string | null
          production_record_id?: string | null
          quantity?: number | null
          raw_machine: string
          raw_value?: string | null
          shift_id?: number | null
          source_cell: string
          source_sheet: string
          status?: string
          target_quantity?: number | null
          target_source?: string | null
          work_mode?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          discard_reason?: string | null
          downtime_id?: string | null
          error_message?: string | null
          id?: never
          kind?: string
          machine_id?: number | null
          notes?: string | null
          operator_count?: number | null
          production_date?: string | null
          production_record_id?: string | null
          quantity?: number | null
          raw_machine?: string
          raw_value?: string | null
          shift_id?: number | null
          source_cell?: string
          source_sheet?: string
          status?: string
          target_quantity?: number | null
          target_source?: string | null
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_downtime_id_fkey"
            columns: ["downtime_id"]
            isOneToOne: false
            referencedRelation: "machine_downtimes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_production_record_id_fkey"
            columns: ["production_record_id"]
            isOneToOne: false
            referencedRelation: "production_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_downtimes: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string | null
          external_id: string | null
          id: string
          machine_id: number
          notes: string | null
          reason: string
          source: string
          started_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          external_id?: string | null
          id?: string
          machine_id: number
          notes?: string | null
          reason: string
          source?: string
          started_at: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          external_id?: string | null
          id?: string
          machine_id?: number
          notes?: string | null
          reason?: string
          source?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_downtimes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_downtimes_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_targets: {
        Row: {
          basis: string
          created_at: string
          created_by: string | null
          id: string
          machine_id: number
          quantity_per_shift: number
          valid_from: string
        }
        Insert: {
          basis?: string
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id: number
          quantity_per_shift: number
          valid_from: string
        }
        Update: {
          basis?: string
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: number
          quantity_per_shift?: number
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_targets_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          created_at: string
          created_by: string | null
          efficiency: number | null
          has_target: boolean
          id: number
          name: string
          pieces_per_minute: number | null
          process: string | null
          standard_operator_count: number | null
          started_on: string | null
          status: string
          status_updated_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          efficiency?: number | null
          has_target?: boolean
          id?: never
          name: string
          pieces_per_minute?: number | null
          process?: string | null
          standard_operator_count?: number | null
          started_on?: string | null
          status?: string
          status_updated_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          efficiency?: number | null
          has_target?: boolean
          id?: never
          name?: string
          pieces_per_minute?: number | null
          process?: string | null
          standard_operator_count?: number | null
          started_on?: string | null
          status?: string
          status_updated_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          notification_type: string
          read_at: string | null
          recipient_id: string
          related_id: string | null
          related_table: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          notification_type: string
          read_at?: string | null
          recipient_id: string
          related_id?: string | null
          related_table?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
          related_id?: string | null
          related_table?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          code: string
          description: string
          sort_order: number
        }
        Insert: {
          category: string
          code: string
          description: string
          sort_order: number
        }
        Update: {
          category?: string
          code?: string
          description?: string
          sort_order?: number
        }
        Relationships: []
      }
      production_orders: {
        Row: {
          created_at: string
          id: string
          is_rework: boolean
          notes: string | null
          order_number: string
          production_record_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_rework?: boolean
          notes?: string | null
          order_number: string
          production_record_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          is_rework?: boolean
          notes?: string | null
          order_number?: string
          production_record_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_production_record_id_fkey"
            columns: ["production_record_id"]
            isOneToOne: false
            referencedRelation: "production_records"
            referencedColumns: ["id"]
          },
        ]
      }
      production_records: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          import_batch_id: string | null
          machine_id: number
          notes: string | null
          operator_count: number | null
          production_date: string
          shift_id: number
          source_ref: string | null
          target_basis: string
          target_quantity: number
          updated_at: string
          updated_by: string | null
          work_mode: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          import_batch_id?: string | null
          machine_id: number
          notes?: string | null
          operator_count?: number | null
          production_date: string
          shift_id: number
          source_ref?: string | null
          target_basis?: string
          target_quantity: number
          updated_at?: string
          updated_by?: string | null
          work_mode?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          import_batch_id?: string | null
          machine_id?: number
          notes?: string | null
          operator_count?: number | null
          production_date?: string
          shift_id?: number
          source_ref?: string | null
          target_basis?: string
          target_quantity?: number
          updated_at?: string
          updated_by?: string | null
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          approved_at: string | null
          approved_by: string | null
          badge_number: string | null
          created_at: string
          full_name: string
          id: string
          role_id: number | null
          status: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          approved_at?: string | null
          approved_by?: string | null
          badge_number?: string | null
          created_at?: string
          full_name: string
          id: string
          role_id?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          approved_at?: string | null
          approved_by?: string | null
          badge_number?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role_id?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_code: string
          role_id: number
        }
        Insert: {
          permission_code: string
          role_id: number
        }
        Update: {
          permission_code?: string
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          description: string | null
          id: number
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          id: number
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      shared_account_sessions: {
        Row: {
          account_id: string
          auth_session_id: string
          id: string
          identified_at: string
          identified_user_id: string
        }
        Insert: {
          account_id: string
          auth_session_id: string
          id?: string
          identified_at?: string
          identified_user_id: string
        }
        Update: {
          account_id?: string
          auth_session_id?: string
          id?: string
          identified_at?: string
          identified_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_account_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_account_sessions_identified_user_id_fkey"
            columns: ["identified_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          end_time: string | null
          gross_minutes: number | null
          id: number
          is_active: boolean
          name: string
          start_time: string | null
          useful_minutes: number | null
        }
        Insert: {
          end_time?: string | null
          gross_minutes?: number | null
          id: number
          is_active?: boolean
          name: string
          start_time?: string | null
          useful_minutes?: number | null
        }
        Update: {
          end_time?: string | null
          gross_minutes?: number | null
          id?: number
          is_active?: boolean
          name?: string
          start_time?: string | null
          useful_minutes?: number | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission_code: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission_code: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_messages: {
        Row: {
          id: string
          work_order_id: string
          author_id: string | null
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      work_order_reads: {
        Row: {
          user_id: string
          work_order_id: string
          last_read_at: string
        }
        Insert: {
          user_id?: string
          work_order_id?: string
          last_read_at?: string
        }
        Update: {
          user_id?: string
          work_order_id?: string
          last_read_at?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          id: string
          order_number: string
          machine_id: number
          material_code: string | null
          material_description: string | null
          planned_quantity: number | null
          stage: string
          pause_reason: string | null
          released_at: string | null
          closed_at: string | null
          source: string
          sap_synced_at: string | null
          created_by: string | null
          created_at: string
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          order_number?: string
          machine_id?: number
          material_code?: string | null
          material_description?: string | null
          planned_quantity?: number | null
          stage?: string
          pause_reason?: string | null
          released_at?: string | null
          closed_at?: string | null
          source?: string
          sap_synced_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          machine_id?: number
          material_code?: string | null
          material_description?: string | null
          planned_quantity?: number | null
          stage?: string
          pause_reason?: string | null
          released_at?: string | null
          closed_at?: string | null
          source?: string
          sap_synced_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      work_order_conversation: {
        Row: {
          id: string | null
          work_order_id: string | null
          created_at: string | null
          author_id: string | null
          kind: string | null
          body: string | null
          shift_id: number | null
          is_rework: boolean | null
        }
        Relationships: []
      }
      work_order_summary: {
        Row: {
          id: string | null
          order_number: string | null
          machine_id: number | null
          material_code: string | null
          material_description: string | null
          planned_quantity: number | null
          stage: string | null
          pause_reason: string | null
          released_at: string | null
          closed_at: string | null
          source: string | null
          sap_synced_at: string | null
          created_by: string | null
          created_at: string | null
          updated_by: string | null
          updated_at: string | null
          produced_quantity: number | null
          rework_quantity: number | null
          entry_count: number | null
          last_entry_at: string | null
        }
        Relationships: []
      }
      current_machine_targets: {
        Row: {
          basis: string | null
          created_at: string | null
          created_by: string | null
          machine_id: number | null
          quantity_per_shift: number | null
          target_id: string | null
          valid_from: string | null
        }
        Relationships: []
      }
      production_summary: {
        Row: {
          adjusted_target: number | null
          counts_toward_target: boolean | null
          created_at: string | null
          created_by: string | null
          effective_target: number | null
          good_quantity: number | null
          id: string | null
          is_excluded_day: boolean | null
          machine_id: number | null
          machine_name: string | null
          notes: string | null
          operator_count: number | null
          order_count: number | null
          production_date: string | null
          rework_quantity: number | null
          shift_id: number | null
          shift_name: string | null
          staffing_ratio: number | null
          target_basis: string | null
          target_quantity: number | null
          total_quantity: number | null
          updated_at: string | null
          updated_by: string | null
          work_mode: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_work_order: {
        Args: {
          p_order_number: string
          p_machine_id: number
          p_material_code?: string
          p_material_description?: string
          p_planned_quantity?: number
        }
        Returns: string
      }
      importar_ops_do_sap: {
        Args: {
          p_ops: Json
        }
        Returns: number
      }
      mark_work_order_read: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      post_work_order_message: {
        Args: {
          p_id: string
          p_body: string
        }
        Returns: string
      }
      set_work_order_stage: {
        Args: {
          p_id: string
          p_stage: string
          p_reason?: string
        }
        Returns: undefined
      }
      update_work_order: {
        Args: {
          p_id: string
          p_machine_id?: number
          p_material_code?: string
          p_material_description?: string
          p_planned_quantity?: number
        }
        Returns: undefined
      }
      add_calendar_events: {
        Args: {
          p_dates: string[]
          p_description: string
          p_event_type: string
          p_scope?: string
          p_shift_ids?: number[]
        }
        Returns: number
      }
      approve_user: {
        Args: {
          p_user_id: string
          p_role_id: number
          p_permissions?: string[]
        }
        Returns: undefined
      }
      bootstrap_admin: {
        Args: {
          p_email: string
          p_role_code?: string
        }
        Returns: undefined
      }
      bulk_delete_production_records: {
        Args: {
          p_ids: string[]
        }
        Returns: number
      }
      bulk_update_production_records: {
        Args: {
          p_ids: string[]
          p_new_date?: string
          p_new_shift_id?: number
        }
        Returns: number
      }
      can_delete_production_record: {
        Args: {
          p_created_by: string
          p_created_at: string
        }
        Returns: boolean
      }
      can_edit_production_record: {
        Args: {
          p_created_by: string
          p_created_at: string
        }
        Returns: boolean
      }
      carregar_lote_importacao: {
        Args: {
          p_lote: string
        }
        Returns: Json
      }
      create_machine: {
        Args: {
          p_name: string
          p_initial_target?: number
          p_has_target?: boolean
          p_standard_operator_count?: number
          p_basis?: string
        }
        Returns: number
      }
      current_identified_user_id: {
        Args: never
        Returns: string
      }
      delete_production_record: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      has_permission: {
        Args: {
          p_code: string
        }
        Returns: boolean
      }
      identify_shared_session: {
        Args: {
          p_badge_number: string
        }
        Returns: string
      }
      insert_production_orders: {
        Args: {
          p_record_id: string
          p_orders: Json
        }
        Returns: number
      }
      is_active_user: {
        Args: never
        Returns: boolean
      }
      list_profile_names: {
        Args: never
        Returns: {
          id: string
          full_name: string
        }[]
      }
      machine_target_basis_on: {
        Args: {
          p_machine_id: number
          p_date: string
        }
        Returns: string
      }
      machine_target_on: {
        Args: {
          p_machine_id: number
          p_date: string
        }
        Returns: number
      }
      my_permissions: {
        Args: never
        Returns: string[]
      }
      pode_importar: {
        Args: never
        Returns: boolean
      }
      reverter_lote_importacao: {
        Args: {
          p_lote: string
        }
        Returns: Json
      }
      save_machine_targets: {
        Args: {
          p_targets: Json
          p_valid_from?: string
          p_bases?: Json
        }
        Returns: number
      }
      save_production_record: {
        Args: {
          p_production_date: string
          p_shift_id: number
          p_machine_id: number
          p_orders?: Json
          p_notes?: string
          p_operator_count?: number
          p_work_mode?: string
          p_replace_orders?: boolean
        }
        Returns: string
      }
      sincronizar_permissoes_dos_papeis: {
        Args: never
        Returns: number
      }
      update_production_record: {
        Args: {
          p_id: string
          p_notes?: string
          p_operator_count?: number
          p_orders?: Json
          p_production_date?: string
          p_shift_id?: number
          p_work_mode?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never
