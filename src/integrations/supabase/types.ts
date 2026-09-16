export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          performed_by: string | null
          performed_by_role: Database["public"]["Enums"]["app_role"] | null
          related_record_id: string
          related_record_type: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          performed_by?: string | null
          performed_by_role?: Database["public"]["Enums"]["app_role"] | null
          related_record_id: string
          related_record_type: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          performed_by?: string | null
          performed_by_role?: Database["public"]["Enums"]["app_role"] | null
          related_record_id?: string
          related_record_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          application_id: string | null
          application_ref: string | null
          attendees: Json
          created_at: string
          description: string
          end_at: string
          event_type: string
          firm_id: string | null
          firm_name: string | null
          google_event_id: string | null
          id: string
          is_recurring: boolean
          location: string | null
          meeting_url: string | null
          recurrence_rule: string | null
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
          start_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          application_ref?: string | null
          attendees?: Json
          created_at?: string
          description?: string
          end_at: string
          event_type: string
          firm_id?: string | null
          firm_name?: string | null
          google_event_id?: string | null
          id?: string
          is_recurring?: boolean
          location?: string | null
          meeting_url?: string | null
          recurrence_rule?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          start_at: string
          status?: string
          timezone: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          application_ref?: string | null
          attendees?: Json
          created_at?: string
          description?: string
          end_at?: string
          event_type?: string
          firm_id?: string | null
          firm_name?: string | null
          google_event_id?: string | null
          id?: string
          is_recurring?: boolean
          location?: string | null
          meeting_url?: string | null
          recurrence_rule?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          start_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "client_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_applications: {
        Row: {
          amount_requested: number | null
          application_source: string | null
          archived: boolean
          assigned_to: string | null
          case_type: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string | null
          firm_contact_id: string | null
          firm_id: string
          funding_status: Database["public"]["Enums"]["funding_status"]
          id: string
          lender_result_status: Database["public"]["Enums"]["lender_result_status"]
          link_sent_date: string | null
          payment_to_firm_status: Database["public"]["Enums"]["payment_to_firm_status"]
          selected_lender_offer_id: string | null
          started_date: string | null
          status: Database["public"]["Enums"]["application_status"]
          stuck: boolean
          stuck_assigned_to: string | null
          stuck_flagged_date: string | null
          stuck_reason: string | null
          stuck_resolution_notes: string | null
          stuck_resolved: boolean
          stuck_resolved_date: string | null
          submitted_date: string | null
          updated_at: string
        }
        Insert: {
          amount_requested?: number | null
          application_source?: string | null
          archived?: boolean
          assigned_to?: string | null
          case_type?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          firm_contact_id?: string | null
          firm_id: string
          funding_status?: Database["public"]["Enums"]["funding_status"]
          id?: string
          lender_result_status?: Database["public"]["Enums"]["lender_result_status"]
          link_sent_date?: string | null
          payment_to_firm_status?: Database["public"]["Enums"]["payment_to_firm_status"]
          selected_lender_offer_id?: string | null
          started_date?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          stuck?: boolean
          stuck_assigned_to?: string | null
          stuck_flagged_date?: string | null
          stuck_reason?: string | null
          stuck_resolution_notes?: string | null
          stuck_resolved?: boolean
          stuck_resolved_date?: string | null
          submitted_date?: string | null
          updated_at?: string
        }
        Update: {
          amount_requested?: number | null
          application_source?: string | null
          archived?: boolean
          assigned_to?: string | null
          case_type?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          firm_contact_id?: string | null
          firm_id?: string
          funding_status?: Database["public"]["Enums"]["funding_status"]
          id?: string
          lender_result_status?: Database["public"]["Enums"]["lender_result_status"]
          link_sent_date?: string | null
          payment_to_firm_status?: Database["public"]["Enums"]["payment_to_firm_status"]
          selected_lender_offer_id?: string | null
          started_date?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          stuck?: boolean
          stuck_assigned_to?: string | null
          stuck_flagged_date?: string | null
          stuck_reason?: string | null
          stuck_resolution_notes?: string | null
          stuck_resolved?: boolean
          stuck_resolved_date?: string | null
          submitted_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_applications_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_applications_firm_contact_id_fkey"
            columns: ["firm_contact_id"]
            isOneToOne: false
            referencedRelation: "firm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_applications_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_applications_stuck_assigned_to_fkey"
            columns: ["stuck_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_selected_offer"
            columns: ["selected_lender_offer_id"]
            isOneToOne: false
            referencedRelation: "lender_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_contacts: {
        Row: {
          active: boolean
          archived: boolean
          created_at: string
          created_by: string | null
          email: string | null
          firm_id: string
          id: string
          last_contacted_date: string | null
          name: string
          notes: string | null
          perm_issue_refunds: boolean
          perm_manage_firm_users: boolean
          perm_process_payments: boolean
          perm_send_app_links: boolean
          perm_view_applications: boolean
          perm_view_dashboard: boolean
          perm_view_payment_status: boolean
          perm_view_transactions: boolean
          permission_level: string | null
          phone: string | null
          role: Database["public"]["Enums"]["firm_contact_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          firm_id: string
          id?: string
          last_contacted_date?: string | null
          name: string
          notes?: string | null
          perm_issue_refunds?: boolean
          perm_manage_firm_users?: boolean
          perm_process_payments?: boolean
          perm_send_app_links?: boolean
          perm_view_applications?: boolean
          perm_view_dashboard?: boolean
          perm_view_payment_status?: boolean
          perm_view_transactions?: boolean
          permission_level?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["firm_contact_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          firm_id?: string
          id?: string
          last_contacted_date?: string | null
          name?: string
          notes?: string | null
          perm_issue_refunds?: boolean
          perm_manage_firm_users?: boolean
          perm_process_payments?: boolean
          perm_send_app_links?: boolean
          perm_view_applications?: boolean
          perm_view_dashboard?: boolean
          perm_view_payment_status?: boolean
          perm_view_transactions?: boolean
          permission_level?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["firm_contact_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_contacts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          access_token: string | null
          created_at: string
          email: string
          id: string
          last_sync: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email: string
          id?: string
          last_sync?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email?: string
          id?: string
          last_sync?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          archived: boolean
          assigned_account_manager: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          firm_size: string | null
          id: string
          last_activity_date: string | null
          lead_source: Database["public"]["Enums"]["lead_source"] | null
          lost_reason: string | null
          main_contact_name: string | null
          name: string
          next_follow_up_date: string | null
          onboarding_status: Database["public"]["Enums"]["firm_onboarding_status"]
          operating_account_connected: Database["public"]["Enums"]["yes_no_unknown"]
          payment_processor: Database["public"]["Enums"]["payment_processor"]
          payment_setup_notes: string | null
          payment_setup_updated_at: string | null
          payment_status: Database["public"]["Enums"]["firm_payment_status"]
          phone: string | null
          practice_areas: string[] | null
          reconnect_date: string | null
          reconnect_notes: string | null
          sales_status: Database["public"]["Enums"]["firm_sales_status"]
          state: string | null
          trust_account_connected: Database["public"]["Enums"]["yes_no_unknown"]
          updated_at: string
          website: string | null
        }
        Insert: {
          archived?: boolean
          assigned_account_manager?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          firm_size?: string | null
          id?: string
          last_activity_date?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          lost_reason?: string | null
          main_contact_name?: string | null
          name: string
          next_follow_up_date?: string | null
          onboarding_status?: Database["public"]["Enums"]["firm_onboarding_status"]
          operating_account_connected?: Database["public"]["Enums"]["yes_no_unknown"]
          payment_processor?: Database["public"]["Enums"]["payment_processor"]
          payment_setup_notes?: string | null
          payment_setup_updated_at?: string | null
          payment_status?: Database["public"]["Enums"]["firm_payment_status"]
          phone?: string | null
          practice_areas?: string[] | null
          reconnect_date?: string | null
          reconnect_notes?: string | null
          sales_status?: Database["public"]["Enums"]["firm_sales_status"]
          state?: string | null
          trust_account_connected?: Database["public"]["Enums"]["yes_no_unknown"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          archived?: boolean
          assigned_account_manager?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          firm_size?: string | null
          id?: string
          last_activity_date?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          lost_reason?: string | null
          main_contact_name?: string | null
          name?: string
          next_follow_up_date?: string | null
          onboarding_status?: Database["public"]["Enums"]["firm_onboarding_status"]
          operating_account_connected?: Database["public"]["Enums"]["yes_no_unknown"]
          payment_processor?: Database["public"]["Enums"]["payment_processor"]
          payment_setup_notes?: string | null
          payment_setup_updated_at?: string | null
          payment_status?: Database["public"]["Enums"]["firm_payment_status"]
          phone?: string | null
          practice_areas?: string[] | null
          reconnect_date?: string | null
          reconnect_notes?: string | null
          sales_status?: Database["public"]["Enums"]["firm_sales_status"]
          state?: string | null
          trust_account_connected?: Database["public"]["Enums"]["yes_no_unknown"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "firms_assigned_account_manager_fkey"
            columns: ["assigned_account_manager"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          channel: Database["public"]["Enums"]["lead_channel"]
          city: string | null
          client_name: string | null
          company: string | null
          converted_at: string | null
          converted_by: string | null
          converted_firm_id: string | null
          created_at: string
          email: string | null
          external_id: string | null
          funding_amount: string | null
          id: string
          message: string | null
          name: string | null
          phone: string | null
          raw_payload: Json | null
          scheduled_at: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["lead_channel"]
          city?: string | null
          client_name?: string | null
          company?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_firm_id?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          funding_amount?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          raw_payload?: Json | null
          scheduled_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["lead_channel"]
          city?: string | null
          client_name?: string | null
          company?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_firm_id?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          funding_amount?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          raw_payload?: Json | null
          scheduled_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      lender_offers: {
        Row: {
          application_id: string
          apr: number | null
          created_at: string
          created_by: string | null
          estimated_funding_timeline: string | null
          estimated_monthly_payment: number | null
          id: string
          lender_id: string | null
          notes: string | null
          offer_amount: number | null
          offer_expiration_date: string | null
          selected_by_client: boolean
          status: Database["public"]["Enums"]["lender_offer_status"]
          term_months: number | null
          updated_at: string
        }
        Insert: {
          application_id: string
          apr?: number | null
          created_at?: string
          created_by?: string | null
          estimated_funding_timeline?: string | null
          estimated_monthly_payment?: number | null
          id?: string
          lender_id?: string | null
          notes?: string | null
          offer_amount?: number | null
          offer_expiration_date?: string | null
          selected_by_client?: boolean
          status?: Database["public"]["Enums"]["lender_offer_status"]
          term_months?: number | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          apr?: number | null
          created_at?: string
          created_by?: string | null
          estimated_funding_timeline?: string | null
          estimated_monthly_payment?: number | null
          id?: string
          lender_id?: string | null
          notes?: string | null
          offer_amount?: number | null
          offer_expiration_date?: string | null
          selected_by_client?: boolean
          status?: Database["public"]["Enums"]["lender_offer_status"]
          term_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lender_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "client_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lender_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lender_offers_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      lenders: {
        Row: {
          active: boolean
          archived: boolean
          avg_approval_rate: number | null
          avg_decision_time_hours: number | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["lender_status"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived?: boolean
          avg_approval_rate?: number | null
          avg_decision_time_hours?: number | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lender_status"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived?: boolean
          avg_approval_rate?: number | null
          avg_decision_time_hours?: number | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lender_status"]
          updated_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_role: Database["public"]["Enums"]["app_role"] | null
          edited: boolean
          id: string
          note_body: string
          note_type: Database["public"]["Enums"]["note_type"]
          related_record_id: string
          related_record_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_role?: Database["public"]["Enums"]["app_role"] | null
          edited?: boolean
          id?: string
          note_body: string
          note_type?: Database["public"]["Enums"]["note_type"]
          related_record_id: string
          related_record_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_role?: Database["public"]["Enums"]["app_role"] | null
          edited?: boolean
          id?: string
          note_body?: string
          note_type?: Database["public"]["Enums"]["note_type"]
          related_record_id?: string
          related_record_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dismissals: {
        Row: {
          activity_log_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          activity_log_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          activity_log_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          actual_funding_date: string | null
          amount_expected_to_firm: number | null
          application_id: string | null
          archived: boolean
          casefunders_fee_amount: number | null
          created_at: string
          created_by: string | null
          destination_type: Database["public"]["Enums"]["destination_type"]
          external_transaction_id: string | null
          firm_id: string
          funded_amount: number | null
          funds_released_to_firm: boolean
          id: string
          manual_review: boolean
          notes: string | null
          payment_processor: Database["public"]["Enums"]["payment_processor"]
          status: Database["public"]["Enums"]["payment_to_firm_status"]
          target_funding_date: string | null
          updated_at: string
        }
        Insert: {
          actual_funding_date?: string | null
          amount_expected_to_firm?: number | null
          application_id?: string | null
          archived?: boolean
          casefunders_fee_amount?: number | null
          created_at?: string
          created_by?: string | null
          destination_type?: Database["public"]["Enums"]["destination_type"]
          external_transaction_id?: string | null
          firm_id: string
          funded_amount?: number | null
          funds_released_to_firm?: boolean
          id?: string
          manual_review?: boolean
          notes?: string | null
          payment_processor?: Database["public"]["Enums"]["payment_processor"]
          status?: Database["public"]["Enums"]["payment_to_firm_status"]
          target_funding_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_funding_date?: string | null
          amount_expected_to_firm?: number | null
          application_id?: string | null
          archived?: boolean
          casefunders_fee_amount?: number | null
          created_at?: string
          created_by?: string | null
          destination_type?: Database["public"]["Enums"]["destination_type"]
          external_transaction_id?: string | null
          firm_id?: string
          funded_amount?: number | null
          funds_released_to_firm?: boolean
          id?: string
          manual_review?: boolean
          notes?: string | null
          payment_processor?: Database["public"]["Enums"]["payment_processor"]
          status?: Database["public"]["Enums"]["payment_to_firm_status"]
          target_funding_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "client_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          birthday: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          application_id: string | null
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          firm_id: string | null
          id: string
          lender_id: string | null
          payment_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          firm_id?: string | null
          id?: string
          lender_id?: string | null
          payment_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          firm_id?: string | null
          id?: string
          lender_id?: string | null
          payment_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "client_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "firm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_firm_activity: { Args: { _firm_id: string }; Returns: undefined }
      firm_deletions_last_24h: { Args: { _user_id: string }; Returns: number }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "sales"
        | "operations"
        | "support"
        | "sales_team_lead"
        | "operations_team_lead"
      application_status:
        | "link_not_sent"
        | "link_sent"
        | "application_started"
        | "submitted"
        | "offers_available"
        | "no_offers"
        | "client_selected_offer"
        | "approved"
        | "declined"
        | "funded"
        | "paid_to_firm"
        | "issue_stuck"
        | "cancelled"
      destination_type:
        | "trust_account"
        | "operating_account"
        | "unknown_not_set"
      firm_contact_role:
        | "firm_admin"
        | "attorney"
        | "billing_staff"
        | "staff_assistant"
        | "other"
      firm_onboarding_status:
        | "not_started"
        | "signup_submitted"
        | "firm_profile_incomplete"
        | "users_pending"
        | "payment_setup_pending"
        | "training_pending"
        | "ready_for_first_application"
        | "complete"
        | "bank_account_connected"
        | "onboarding_done"
        | "completed_first_application"
        | "funded_three_cases"
      firm_payment_status:
        | "not_started"
        | "onboarding_link_sent"
        | "started"
        | "bank_account_needed"
        | "bank_account_connected"
        | "verification_pending"
        | "verified_ready"
        | "issue_manual_review"
        | "disabled"
      firm_sales_status:
        | "new_lead"
        | "contacted"
        | "interested"
        | "demo_booked"
        | "demo_completed"
        | "demo_no_show"
        | "demo_needs_reschedule"
        | "follow_up_after_demo"
        | "signup_link_sent"
        | "signed_up"
        | "lost_not_interested"
        | "reconnect_later"
        | "demo_completed_signed_up"
        | "demo_completed_didnt_sign_up"
        | "dnc"
      funding_status:
        | "not_started"
        | "pending"
        | "approved"
        | "disbursed_to_client"
        | "confirmed_funded"
        | "failed"
        | "cancelled"
        | "manual_review"
      lead_channel: "callrail" | "calendly" | "manual" | "website" | "anonymous_client_flow" | "linkedin"
      lead_source:
        | "cold_call"
        | "email_campaign"
        | "google_ads"
        | "referral"
        | "event"
        | "linkedin"
        | "website"
        | "partner"
        | "manual_entry"
        | "other"
      lead_status: "new" | "converted" | "dismissed"
      lender_offer_status:
        | "pending"
        | "offered"
        | "declined"
        | "selected"
        | "expired"
        | "error"
        | "manual_review"
      lender_result_status:
        | "not_sent"
        | "pending"
        | "offers_returned"
        | "no_offers"
        | "manual_review"
        | "error"
      lender_status:
        | "active"
        | "inactive"
        | "testing"
        | "paused"
        | "reconnect_later"
      note_type:
        | "general"
        | "call_log"
        | "email"
        | "meeting"
        | "follow_up"
        | "support"
        | "payment_funding"
      payment_processor: "confido" | "stripe" | "manual" | "other" | "not_set"
      payment_to_firm_status:
        | "not_started"
        | "payment_method_needed"
        | "payment_method_saved"
        | "ready_to_charge"
        | "charged"
        | "paid_to_firm"
        | "failed"
        | "refunded"
        | "manual_review"
        | "cancelled"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "open"
        | "in_progress"
        | "completed"
        | "overdue"
        | "cancelled"
      task_type:
        | "follow_up"
        | "demo"
        | "onboarding"
        | "application_issue"
        | "payment_funding_issue"
        | "support"
        | "sales"
        | "internal"
      yes_no_unknown: "yes" | "no" | "not_required" | "unknown"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "sales",
        "operations",
        "support",
        "sales_team_lead",
        "operations_team_lead",
      ],
      application_status: [
        "link_not_sent",
        "link_sent",
        "application_started",
        "submitted",
        "offers_available",
        "no_offers",
        "client_selected_offer",
        "approved",
        "declined",
        "funded",
        "paid_to_firm",
        "issue_stuck",
        "cancelled",
      ],
      destination_type: [
        "trust_account",
        "operating_account",
        "unknown_not_set",
      ],
      firm_contact_role: [
        "firm_admin",
        "attorney",
        "billing_staff",
        "staff_assistant",
        "other",
      ],
      firm_onboarding_status: [
        "not_started",
        "signup_submitted",
        "firm_profile_incomplete",
        "users_pending",
        "payment_setup_pending",
        "training_pending",
        "ready_for_first_application",
        "complete",
        "bank_account_connected",
        "onboarding_done",
        "completed_first_application",
        "funded_three_cases",
      ],
      firm_payment_status: [
        "not_started",
        "onboarding_link_sent",
        "started",
        "bank_account_needed",
        "bank_account_connected",
        "verification_pending",
        "verified_ready",
        "issue_manual_review",
        "disabled",
      ],
      firm_sales_status: [
        "new_lead",
        "contacted",
        "interested",
        "demo_booked",
        "demo_completed",
        "demo_no_show",
        "demo_needs_reschedule",
        "follow_up_after_demo",
        "signup_link_sent",
        "signed_up",
        "lost_not_interested",
        "reconnect_later",
        "demo_completed_signed_up",
        "demo_completed_didnt_sign_up",
        "dnc",
      ],
      funding_status: [
        "not_started",
        "pending",
        "approved",
        "disbursed_to_client",
        "confirmed_funded",
        "failed",
        "cancelled",
        "manual_review",
      ],
      lead_channel: ["callrail", "calendly", "manual", "website", "anonymous_client_flow", "linkedin"],
      lead_source: [
        "cold_call",
        "email_campaign",
        "google_ads",
        "referral",
        "event",
        "linkedin",
        "website",
        "partner",
        "manual_entry",
        "other",
      ],
      lead_status: ["new", "converted", "dismissed"],
      lender_offer_status: [
        "pending",
        "offered",
        "declined",
        "selected",
        "expired",
        "error",
        "manual_review",
      ],
      lender_result_status: [
        "not_sent",
        "pending",
        "offers_returned",
        "no_offers",
        "manual_review",
        "error",
      ],
      lender_status: [
        "active",
        "inactive",
        "testing",
        "paused",
        "reconnect_later",
      ],
      note_type: [
        "general",
        "call_log",
        "email",
        "meeting",
        "follow_up",
        "support",
        "payment_funding",
      ],
      payment_processor: ["confido", "stripe", "manual", "other", "not_set"],
      payment_to_firm_status: [
        "not_started",
        "payment_method_needed",
        "payment_method_saved",
        "ready_to_charge",
        "charged",
        "paid_to_firm",
        "failed",
        "refunded",
        "manual_review",
        "cancelled",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["open", "in_progress", "completed", "overdue", "cancelled"],
      task_type: [
        "follow_up",
        "demo",
        "onboarding",
        "application_issue",
        "payment_funding_issue",
        "support",
        "sales",
        "internal",
      ],
      yes_no_unknown: ["yes", "no", "not_required", "unknown"],
    },
  },
} as const
