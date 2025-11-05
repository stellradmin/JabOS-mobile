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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          description: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          trigger_type: string
          trigger_value: number | null
          updated_at: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          trigger_type: string
          trigger_value?: number | null
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          trigger_type?: string
          trigger_value?: number | null
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "achievements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_draft: boolean | null
          is_pinned: boolean | null
          organization_id: string
          priority: string | null
          published_at: string | null
          target_audience: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_draft?: boolean | null
          is_pinned?: boolean | null
          organization_id: string
          priority?: string | null
          published_at?: string | null
          target_audience?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_draft?: boolean | null
          is_pinned?: boolean | null
          organization_id?: string
          priority?: string | null
          published_at?: string | null
          target_audience?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          class_instance_id: string | null
          created_at: string | null
          id: string
          location: string | null
          method: string | null
          notes: string | null
          organization_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          class_instance_id?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          method?: string | null
          notes?: string | null
          organization_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          class_instance_id?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          method?: string | null
          notes?: string | null
          organization_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          canceled_at: string | null
          cancellation_reason: string | null
          checked_in_at: string | null
          class_instance_id: string
          created_at: string | null
          id: string
          organization_id: string
          status: string | null
          updated_at: string | null
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          canceled_at?: string | null
          cancellation_reason?: string | null
          checked_in_at?: string | null
          class_instance_id: string
          created_at?: string | null
          id?: string
          organization_id: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          canceled_at?: string | null
          cancellation_reason?: string | null
          checked_in_at?: string | null
          class_instance_id?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_interventions: {
        Row: {
          created_at: string
          estimated_value_retained: number | null
          id: string
          initiated_by: string | null
          intervention_type: string
          member_id: string
          message: string | null
          notes: string | null
          organization_id: string
          outcome: string | null
          resolved_at: string | null
          scheduled_for: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          estimated_value_retained?: number | null
          id?: string
          initiated_by?: string | null
          intervention_type: string
          member_id: string
          message?: string | null
          notes?: string | null
          organization_id: string
          outcome?: string | null
          resolved_at?: string | null
          scheduled_for?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          estimated_value_retained?: number | null
          id?: string
          initiated_by?: string | null
          intervention_type?: string
          member_id?: string
          message?: string | null
          notes?: string | null
          organization_id?: string
          outcome?: string | null
          resolved_at?: string | null
          scheduled_for?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "churn_interventions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "churn_interventions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "churn_interventions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "churn_interventions_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      class_instances: {
        Row: {
          canceled_at: string | null
          canceled_reason: string | null
          class_id: string
          coach_id: string | null
          created_at: string | null
          end_time: string
          id: string
          max_capacity: number | null
          notes: string | null
          organization_id: string
          start_time: string
          status: string | null
          total_attended: number | null
          total_bookings: number | null
          total_no_shows: number | null
          updated_at: string | null
        }
        Insert: {
          canceled_at?: string | null
          canceled_reason?: string | null
          class_id: string
          coach_id?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          max_capacity?: number | null
          notes?: string | null
          organization_id: string
          start_time: string
          status?: string | null
          total_attended?: number | null
          total_bookings?: number | null
          total_no_shows?: number | null
          updated_at?: string | null
        }
        Update: {
          canceled_at?: string | null
          canceled_reason?: string | null
          class_id?: string
          coach_id?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          max_capacity?: number | null
          notes?: string | null
          organization_id?: string
          start_time?: string
          status?: string | null
          total_attended?: number | null
          total_bookings?: number | null
          total_no_shows?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_instances_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instances_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          allow_waitlist: boolean | null
          cancellation_hours: number | null
          class_type: string | null
          coach_id: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          max_capacity: number | null
          organization_id: string
          recurrence_rule: string | null
          require_membership: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          allow_waitlist?: boolean | null
          cancellation_hours?: number | null
          class_type?: string | null
          coach_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          max_capacity?: number | null
          organization_id: string
          recurrence_rule?: string | null
          require_membership?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          allow_waitlist?: boolean | null
          cancellation_hours?: number | null
          class_type?: string | null
          coach_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          max_capacity?: number | null
          organization_id?: string
          recurrence_rule?: string | null
          require_membership?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          last_message_content: string | null
          match_id: string | null
          participant_1_id: string | null
          participant_2_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_content?: string | null
          match_id?: string | null
          participant_1_id?: string | null
          participant_2_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_content?: string | null
          match_id?: string | null
          participant_1_id?: string | null
          participant_2_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gym_metrics: {
        Row: {
          active_members: number | null
          avg_capacity_utilization: number | null
          avg_class_attendance: number | null
          churned_members: number | null
          created_at: string | null
          date: string
          id: string
          new_members: number | null
          new_revenue_cents: number | null
          organization_id: string
          renewal_revenue_cents: number | null
          retention_rate_30d: number | null
          retention_rate_60d: number | null
          retention_rate_90d: number | null
          revenue_cents: number | null
          total_attendance: number | null
          total_bookings: number | null
          total_cancellations: number | null
          total_class_capacity: number | null
          total_classes: number | null
          total_members: number | null
          total_no_shows: number | null
          total_sparring_sessions: number | null
          total_workouts_logged: number | null
          trial_members: number | null
          updated_at: string | null
        }
        Insert: {
          active_members?: number | null
          avg_capacity_utilization?: number | null
          avg_class_attendance?: number | null
          churned_members?: number | null
          created_at?: string | null
          date: string
          id?: string
          new_members?: number | null
          new_revenue_cents?: number | null
          organization_id: string
          renewal_revenue_cents?: number | null
          retention_rate_30d?: number | null
          retention_rate_60d?: number | null
          retention_rate_90d?: number | null
          revenue_cents?: number | null
          total_attendance?: number | null
          total_bookings?: number | null
          total_cancellations?: number | null
          total_class_capacity?: number | null
          total_classes?: number | null
          total_members?: number | null
          total_no_shows?: number | null
          total_sparring_sessions?: number | null
          total_workouts_logged?: number | null
          trial_members?: number | null
          updated_at?: string | null
        }
        Update: {
          active_members?: number | null
          avg_capacity_utilization?: number | null
          avg_class_attendance?: number | null
          churned_members?: number | null
          created_at?: string | null
          date?: string
          id?: string
          new_members?: number | null
          new_revenue_cents?: number | null
          organization_id?: string
          renewal_revenue_cents?: number | null
          retention_rate_30d?: number | null
          retention_rate_60d?: number | null
          retention_rate_90d?: number | null
          revenue_cents?: number | null
          total_attendance?: number | null
          total_bookings?: number | null
          total_cancellations?: number | null
          total_class_capacity?: number | null
          total_classes?: number | null
          total_members?: number | null
          total_no_shows?: number | null
          total_sparring_sessions?: number | null
          total_workouts_logged?: number | null
          trial_members?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_date: string | null
          invoice_pdf: string | null
          organization_id: string
          paid_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_pdf?: string | null
          organization_id: string
          paid_at?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_date?: string | null
          invoice_pdf?: string | null
          organization_id?: string
          paid_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_reports: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          id: string
          issue_description: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          issue_description: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          issue_description?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          astrological_grade: string | null
          calculation_result: Json | null
          compatibility_score: number | null
          conversation_id: string | null
          created_at: string | null
          id: string
          match_request_id: string | null
          matched_at: string | null
          overall_score: number | null
          questionnaire_grade: string | null
          status: string | null
          updated_at: string | null
          user1_id: string | null
          user2_id: string | null
        }
        Insert: {
          astrological_grade?: string | null
          calculation_result?: Json | null
          compatibility_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          match_request_id?: string | null
          matched_at?: string | null
          overall_score?: number | null
          questionnaire_grade?: string | null
          status?: string | null
          updated_at?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Update: {
          astrological_grade?: string | null
          calculation_result?: Json | null
          compatibility_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          match_request_id?: string | null
          matched_at?: string | null
          overall_score?: number | null
          questionnaire_grade?: string | null
          status?: string | null
          updated_at?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          id: string
          member_id: string
          organization_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          id?: string
          member_id: string
          organization_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          id?: string
          member_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_achievements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_achievements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          bio: string | null
          bouts: number | null
          created_at: string | null
          current_streak_days: number | null
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          experience_level: string | null
          gender: string | null
          goals: string | null
          height_cm: number | null
          id: string
          injuries_history: string | null
          looking_for_sparring: boolean | null
          medical_conditions: string | null
          organization_id: string | null
          sparring_approval_notes: string | null
          sparring_approved_at: string | null
          sparring_approved_by: string | null
          sparring_eligible: boolean
          stance: string | null
          total_classes_attended: number | null
          total_sparring_sessions: number | null
          total_workouts: number | null
          updated_at: string | null
          user_id: string | null
          waiver_signed: boolean | null
          waiver_signed_at: string | null
          weight_class: string | null
          weight_kg: number | null
        }
        Insert: {
          bio?: string | null
          bouts?: number | null
          created_at?: string | null
          current_streak_days?: number | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          experience_level?: string | null
          gender?: string | null
          goals?: string | null
          height_cm?: number | null
          id?: string
          injuries_history?: string | null
          looking_for_sparring?: boolean | null
          medical_conditions?: string | null
          organization_id?: string | null
          sparring_approval_notes?: string | null
          sparring_approved_at?: string | null
          sparring_approved_by?: string | null
          sparring_eligible?: boolean
          stance?: string | null
          total_classes_attended?: number | null
          total_sparring_sessions?: number | null
          total_workouts?: number | null
          updated_at?: string | null
          user_id?: string | null
          waiver_signed?: boolean | null
          waiver_signed_at?: string | null
          weight_class?: string | null
          weight_kg?: number | null
        }
        Update: {
          bio?: string | null
          bouts?: number | null
          created_at?: string | null
          current_streak_days?: number | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          experience_level?: string | null
          gender?: string | null
          goals?: string | null
          height_cm?: number | null
          id?: string
          injuries_history?: string | null
          looking_for_sparring?: boolean | null
          medical_conditions?: string | null
          organization_id?: string | null
          sparring_approval_notes?: string | null
          sparring_approved_at?: string | null
          sparring_approved_by?: string | null
          sparring_eligible?: boolean
          stance?: string | null
          total_classes_attended?: number | null
          total_sparring_sessions?: number | null
          total_workouts?: number | null
          updated_at?: string | null
          user_id?: string | null
          waiver_signed?: boolean | null
          waiver_signed_at?: string | null
          weight_class?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profiles_sparring_approved_by_fkey"
            columns: ["sparring_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      member_progress: {
        Row: {
          created_at: string
          current_level: number
          last_activity_date: string | null
          member_id: string
          organization_id: string
          total_xp: number
          updated_at: string
          week_start_date: string | null
          weekly_ring_progress: Json
          xp_for_next_level: number
        }
        Insert: {
          created_at?: string
          current_level?: number
          last_activity_date?: string | null
          member_id: string
          organization_id: string
          total_xp?: number
          updated_at?: string
          week_start_date?: string | null
          weekly_ring_progress?: Json
          xp_for_next_level?: number
        }
        Update: {
          created_at?: string
          current_level?: number
          last_activity_date?: string | null
          member_id?: string
          organization_id?: string
          total_xp?: number
          updated_at?: string
          week_start_date?: string | null
          weekly_ring_progress?: Json
          xp_for_next_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_risk_scores: {
        Row: {
          attendance_drop_rate: number | null
          attendance_trend: string | null
          avg_visits_4w: number | null
          calculated_at: string | null
          calculated_date: string
          contributing_factors: Json
          created_at: string
          days_since_last_activity: number | null
          days_until_renewal: number | null
          delta_vs_baseline: number | null
          engagement_score: number | null
          last_message_read_at: string | null
          last_message_sent_at: string | null
          member_id: string
          message_read_rate: number | null
          next_expected_visit: string | null
          notes: string | null
          organization_id: string
          risk_band: string
          risk_score: number
          streak_broken: boolean | null
          subscription_status: string | null
          variety_index: number | null
        }
        Insert: {
          attendance_drop_rate?: number | null
          attendance_trend?: string | null
          avg_visits_4w?: number | null
          calculated_at?: string | null
          calculated_date?: string
          contributing_factors?: Json
          created_at?: string
          days_since_last_activity?: number | null
          days_until_renewal?: number | null
          delta_vs_baseline?: number | null
          engagement_score?: number | null
          last_message_read_at?: string | null
          last_message_sent_at?: string | null
          member_id: string
          message_read_rate?: number | null
          next_expected_visit?: string | null
          notes?: string | null
          organization_id: string
          risk_band: string
          risk_score: number
          streak_broken?: boolean | null
          subscription_status?: string | null
          variety_index?: number | null
        }
        Update: {
          attendance_drop_rate?: number | null
          attendance_trend?: string | null
          avg_visits_4w?: number | null
          calculated_at?: string | null
          calculated_date?: string
          contributing_factors?: Json
          created_at?: string
          days_since_last_activity?: number | null
          days_until_renewal?: number | null
          delta_vs_baseline?: number | null
          engagement_score?: number | null
          last_message_read_at?: string | null
          last_message_sent_at?: string | null
          member_id?: string
          message_read_rate?: number | null
          next_expected_visit?: string | null
          notes?: string | null
          organization_id?: string
          risk_band?: string
          risk_score?: number
          streak_broken?: boolean | null
          subscription_status?: string | null
          variety_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_risk_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_risk_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_subscriptions: {
        Row: {
          auto_renew: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string
          paused_at: string | null
          plan_id: string
          remaining_class_credits: number | null
          started_at: string | null
          status: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id: string
          paused_at?: string | null
          plan_id: string
          remaining_class_credits?: number | null
          started_at?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string
          paused_at?: string | null
          plan_id?: string
          remaining_class_credits?: number | null
          started_at?: string | null
          status?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          allows_open_gym: boolean | null
          allows_sparring: boolean | null
          billing_interval: string
          class_credits: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          organization_id: string
          price_cents: number
          priority_booking: boolean | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          allows_open_gym?: boolean | null
          allows_sparring?: boolean | null
          billing_interval: string
          class_credits?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          organization_id: string
          price_cents: number
          priority_booking?: boolean | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          allows_open_gym?: boolean | null
          allows_sparring?: boolean | null
          billing_interval?: string
          class_credits?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          organization_id?: string
          price_cents?: number
          priority_booking?: boolean | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          id: string
          message_id: string
          mutual_receipts_enabled: boolean
          read_at: string | null
          reader_id: string
          reader_receipts_enabled: boolean
          receipt_sent_at: string | null
          sender_id: string
          sender_receipts_enabled: boolean
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message_id: string
          mutual_receipts_enabled?: boolean
          read_at?: string | null
          reader_id: string
          reader_receipts_enabled?: boolean
          receipt_sent_at?: string | null
          sender_id: string
          sender_receipts_enabled?: boolean
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message_id?: string
          mutual_receipts_enabled?: boolean
          read_at?: string | null
          reader_id?: string
          reader_receipts_enabled?: boolean
          receipt_sent_at?: string | null
          sender_id?: string
          sender_receipts_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          is_read: boolean | null
          message_type: string | null
          read_receipt_sent: boolean | null
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          read_receipt_sent?: boolean | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          read_receipt_sent?: boolean | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      nudge_queue: {
        Row: {
          created_at: string
          id: string
          intervention_id: string | null
          member_id: string
          message_body: string
          message_id: string | null
          message_subject: string | null
          metadata: Json | null
          nudge_type: string | null
          organization_id: string
          scheduled_for: string
          scheduled_send_at: string | null
          sent_at: string | null
          status: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_id?: string | null
          member_id: string
          message_body: string
          message_id?: string | null
          message_subject?: string | null
          metadata?: Json | null
          nudge_type?: string | null
          organization_id: string
          scheduled_for: string
          scheduled_send_at?: string | null
          sent_at?: string | null
          status?: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intervention_id?: string | null
          member_id?: string
          message_body?: string
          message_id?: string | null
          message_subject?: string | null
          metadata?: Json | null
          nudge_type?: string | null
          organization_id?: string
          scheduled_for?: string
          scheduled_send_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudge_queue_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "churn_interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudge_queue_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudge_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudge_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          slug: string
          state: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          timezone: string | null
          trial_ends_at: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          slug: string
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          slug?: string
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          organization_id: string
          stripe_payment_method_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          organization_id: string
          stripe_payment_method_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          organization_id?: string
          stripe_payment_method_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_preferences: Json | null
          age: number | null
          app_settings: Json | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          education_level: string | null
          gender: string | null
          has_kids: boolean | null
          id: string
          interests: string[] | null
          is_single: boolean | null
          location: Json | null
          looking_for: string | null
          onboarding_completed: boolean | null
          politics: string | null
          push_token: string | null
          traits: string[] | null
          updated_at: string | null
          username: string | null
          wants_kids: string | null
          zodiac_sign: string | null
        }
        Insert: {
          activity_preferences?: Json | null
          age?: number | null
          app_settings?: Json | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          education_level?: string | null
          gender?: string | null
          has_kids?: boolean | null
          id: string
          interests?: string[] | null
          is_single?: boolean | null
          location?: Json | null
          looking_for?: string | null
          onboarding_completed?: boolean | null
          politics?: string | null
          push_token?: string | null
          traits?: string[] | null
          updated_at?: string | null
          username?: string | null
          wants_kids?: string | null
          zodiac_sign?: string | null
        }
        Update: {
          activity_preferences?: Json | null
          age?: number | null
          app_settings?: Json | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          education_level?: string | null
          gender?: string | null
          has_kids?: boolean | null
          id?: string
          interests?: string[] | null
          is_single?: boolean | null
          location?: Json | null
          looking_for?: string | null
          onboarding_completed?: boolean | null
          politics?: string | null
          push_token?: string | null
          traits?: string[] | null
          updated_at?: string | null
          username?: string | null
          wants_kids?: string | null
          zodiac_sign?: string | null
        }
        Relationships: []
      }
      quiz_lead_events: {
        Row: {
          email: string | null
          event_type: string
          id: number
          ip_address: unknown
          occurred_at: string | null
          properties: Json | null
          session_id: string
          step: number | null
        }
        Insert: {
          email?: string | null
          event_type: string
          id?: number
          ip_address?: unknown
          occurred_at?: string | null
          properties?: Json | null
          session_id: string
          step?: number | null
        }
        Update: {
          email?: string | null
          event_type?: string
          id?: number
          ip_address?: unknown
          occurred_at?: string | null
          properties?: Json | null
          session_id?: string
          step?: number | null
        }
        Relationships: []
      }
      quiz_leads: {
        Row: {
          birth_date: string
          birth_lat: number | null
          birth_lng: number | null
          birth_location: string
          birth_time: string | null
          converted_to_app: boolean | null
          created_at: string | null
          email: string
          id: string
          ip_address: unknown
          question_1_answer: string | null
          question_2_answer: string | null
          question_3_answer: string | null
          quiz_results: Json | null
          session_id: string | null
          source: string | null
          subscribed_at: string | null
          timezone: string | null
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          birth_date: string
          birth_lat?: number | null
          birth_lng?: number | null
          birth_location: string
          birth_time?: string | null
          converted_to_app?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          ip_address?: unknown
          question_1_answer?: string | null
          question_2_answer?: string | null
          question_3_answer?: string | null
          quiz_results?: Json | null
          session_id?: string | null
          source?: string | null
          subscribed_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          birth_date?: string
          birth_lat?: number | null
          birth_lng?: number | null
          birth_location?: string
          birth_time?: string | null
          converted_to_app?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: unknown
          question_1_answer?: string | null
          question_2_answer?: string | null
          question_3_answer?: string | null
          quiz_results?: Json | null
          session_id?: string | null
          source?: string | null
          subscribed_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      quiz_nurture_queue: {
        Row: {
          created_at: string | null
          id: number
          metadata: Json | null
          processed_at: string | null
          quiz_lead_id: string | null
          scheduled_for: string
          sequence_step: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          metadata?: Json | null
          processed_at?: string | null
          quiz_lead_id?: string | null
          scheduled_for: string
          sequence_step: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          metadata?: Json | null
          processed_at?: string | null
          quiz_lead_id?: string | null
          scheduled_for?: string
          sequence_step?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_nurture_queue_quiz_lead_id_fkey"
            columns: ["quiz_lead_id"]
            isOneToOne: false
            referencedRelation: "quiz_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      resend_event_log: {
        Row: {
          email: string | null
          event_type: string
          id: number
          message_id: string | null
          payload: Json | null
          received_at: string | null
        }
        Insert: {
          email?: string | null
          event_type: string
          id?: number
          message_id?: string | null
          payload?: Json | null
          received_at?: string | null
        }
        Update: {
          email?: string | null
          event_type?: string
          id?: number
          message_id?: string | null
          payload?: Json | null
          received_at?: string | null
        }
        Relationships: []
      }
      resend_template_registry: {
        Row: {
          description: string | null
          template_id: string
          updated_at: string | null
          version: string
        }
        Insert: {
          description?: string | null
          template_id: string
          updated_at?: string | null
          version: string
        }
        Update: {
          description?: string | null
          template_id?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      role_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          new_role: string | null
          previous_role: string | null
          reason: string
          target_user_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_role?: string | null
          previous_role?: string | null
          reason: string
          target_user_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_role?: string | null
          previous_role?: string | null
          reason?: string
          target_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          level: number
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          level: number
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      sparring_matches: {
        Row: {
          canceled_at: string | null
          cancellation_reason: string | null
          class_instance_id: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          is_light_sparring: boolean | null
          member_1_feedback: string | null
          member_1_id: string
          member_2_feedback: string | null
          member_2_id: string
          notes: string | null
          organization_id: string
          proposed_by: string | null
          round_duration_minutes: number | null
          rounds: number | null
          scheduled_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          canceled_at?: string | null
          cancellation_reason?: string | null
          class_instance_id?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_light_sparring?: boolean | null
          member_1_feedback?: string | null
          member_1_id: string
          member_2_feedback?: string | null
          member_2_id: string
          notes?: string | null
          organization_id: string
          proposed_by?: string | null
          round_duration_minutes?: number | null
          rounds?: number | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          canceled_at?: string | null
          cancellation_reason?: string | null
          class_instance_id?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_light_sparring?: boolean | null
          member_1_feedback?: string | null
          member_1_id?: string
          member_2_feedback?: string | null
          member_2_id?: string
          notes?: string | null
          organization_id?: string
          proposed_by?: string | null
          round_duration_minutes?: number | null
          rounds?: number | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sparring_matches_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sparring_matches_member_1_id_fkey"
            columns: ["member_1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sparring_matches_member_2_id_fkey"
            columns: ["member_2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sparring_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sparring_matches_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      stripe_customers: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          stripe_customer_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          stripe_customer_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          stripe_customer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_cents: number
          canceled_at: string | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          ended_at: string | null
          id: string
          interval: string
          organization_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          canceled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          interval: string
          organization_id: string
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          canceled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          interval?: string
          organization_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      swipes: {
        Row: {
          created_at: string | null
          id: string
          swipe_type: string | null
          swiped_id: string | null
          swiper_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          swipe_type?: string | null
          swiped_id?: string | null
          swiper_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          swipe_type?: string | null
          swiped_id?: string | null
          swiper_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      timer_presets: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          is_public: boolean | null
          name: string
          organization_id: string
          rest_duration_seconds: number
          round_duration_seconds: number
          rounds: number
          updated_at: string | null
          warning_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_public?: boolean | null
          name: string
          organization_id: string
          rest_duration_seconds: number
          round_duration_seconds: number
          rounds: number
          updated_at?: string | null
          warning_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_public?: boolean | null
          name?: string
          organization_id?: string
          rest_duration_seconds?: number
          round_duration_seconds?: number
          rounds?: number
          updated_at?: string | null
          warning_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timer_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timer_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactional_email_queue: {
        Row: {
          created_at: string | null
          email: string
          error_message: string | null
          event_type: string
          id: number
          payload: Json | null
          processed_at: string | null
          status: string | null
          template_version: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          error_message?: string | null
          event_type: string
          id?: number
          payload?: Json | null
          processed_at?: string | null
          status?: string | null
          template_version?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          error_message?: string | null
          event_type?: string
          id?: number
          payload?: Json | null
          processed_at?: string | null
          status?: string | null
          template_version?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          last_seen_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          last_seen_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          reason: string
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason: string
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          birth_date: string | null
          birth_location: string | null
          birth_time: string | null
          created_at: string | null
          date_night_preferences: Json | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          organization_id: string | null
          phone: string | null
          questionnaire_responses: Json | null
          role: string | null
          settings: Json | null
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          birth_date?: string | null
          birth_location?: string | null
          birth_time?: string | null
          created_at?: string | null
          date_night_preferences?: Json | null
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          organization_id?: string | null
          phone?: string | null
          questionnaire_responses?: Json | null
          role?: string | null
          settings?: Json | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          birth_date?: string | null
          birth_location?: string | null
          birth_time?: string | null
          created_at?: string | null
          date_night_preferences?: Json | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          organization_id?: string | null
          phone?: string | null
          questionnaire_responses?: Json | null
          role?: string | null
          settings?: Json | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          calories_burned: number | null
          class_instance_id: string | null
          created_at: string | null
          duration_minutes: number | null
          heart_rate_avg: number | null
          id: string
          intensity_level: string | null
          logged_at: string | null
          notes: string | null
          organization_id: string
          rating: number | null
          rounds: number | null
          timer_preset_id: string | null
          updated_at: string | null
          user_id: string
          workout_type: string | null
        }
        Insert: {
          calories_burned?: number | null
          class_instance_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          heart_rate_avg?: number | null
          id?: string
          intensity_level?: string | null
          logged_at?: string | null
          notes?: string | null
          organization_id: string
          rating?: number | null
          rounds?: number | null
          timer_preset_id?: string | null
          updated_at?: string | null
          user_id: string
          workout_type?: string | null
        }
        Update: {
          calories_burned?: number | null
          class_instance_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          heart_rate_avg?: number | null
          id?: string
          intensity_level?: string | null
          logged_at?: string | null
          notes?: string | null
          organization_id?: string
          rating?: number | null
          rounds?: number | null
          timer_preset_id?: string | null
          updated_at?: string | null
          user_id?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_timer_preset_id_fkey"
            columns: ["timer_preset_id"]
            isOneToOne: false
            referencedRelation: "timer_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string
          metadata: Json | null
          organization_id: string
          reason: string
          related_id: string | null
          related_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          member_id: string
          metadata?: Json | null
          organization_id: string
          reason: string
          related_id?: string | null
          related_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string
          metadata?: Json | null
          organization_id?: string
          reason?: string
          related_id?: string | null
          related_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      api_mark_messages_read: {
        Args: {
          p_conversation_id: string
          p_message_ids?: Json
          p_reader_id: string
        }
        Returns: Json
      }
      bytea_to_text: { Args: { data: string }; Returns: string }
      calculate_compatibility_scores: {
        Args: { user_a_id: string; user_b_id: string }
        Returns: Json
      }
      calculate_level_from_xp: {
        Args: { p_organization_id: string; p_total_xp: number }
        Returns: {
          level: number
          xp_for_next_level: number
        }[]
      }
      can_manage_role: {
        Args: { p_manager_id: string; p_target_role: string }
        Returns: boolean
      }
      check_and_award_achievements: {
        Args: {
          p_member_id: string
          p_organization_id: string
          p_trigger_type: string
          p_trigger_value: number
        }
        Returns: undefined
      }
      check_sparring_eligibility: {
        Args: { p_member_id: string }
        Returns: {
          eligible: boolean
          reasons: string[]
        }[]
      }
      clear_user_onboarding_data: {
        Args: { user_email: string }
        Returns: string
      }
      confirm_system_match: {
        Args: {
          p_current_user_id: string
          p_source_match_request_id?: string
          p_target_user_id: string
        }
        Returns: {
          conversation_id: string
          match_id: string
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      dropgeometrytable:
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      enablelongtransactions: { Args: never; Returns: string }
      enqueue_password_reset: { Args: { p_email: string }; Returns: undefined }
      enqueue_transactional_email: {
        Args: {
          p_email: string
          p_event_type: string
          p_payload?: Json
          p_user_id: string
        }
        Returns: undefined
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_user_roles: { Args: never; Returns: undefined }
      generate_slug: { Args: { p_name: string }; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_app_setting: { Args: { setting_key: string }; Returns: string }
      get_conversation_read_status: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: {
          delivery_status: string
          message_id: string
          read_at: string
          reader_id: string
          receipt_visible: boolean
          sender_id: string
        }[]
      }
      get_potential_matches_optimized: {
        Args: {
          activity_filter?: string
          exclude_user_ids?: string[]
          limit_count?: number
          max_age_filter?: number
          max_distance_km?: number
          min_age_filter?: number
          offset_count?: number
          viewer_id: string
          zodiac_filter?: string
        }
        Returns: {
          age: number
          avatar_url: string
          bio: string
          compatibility_score: number
          display_name: string
          distance_km: number
          education_level: string
          gender: string
          id: string
          interests: string[]
          zodiac_sign: string
        }[]
      }
      get_user_booking_status: {
        Args: { p_class_instance_id: string; p_user_id: string }
        Returns: string
      }
      get_user_conversations: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          id: string
          last_message_at: string
          last_message_content: string
          other_participant: Json
          participant_1_id: string
          participant_2_id: string
          updated_at: string
        }[]
      }
      get_user_organization: { Args: { p_user_id: string }; Returns: string }
      get_user_role: {
        Args: { p_user_id: string }
        Returns: {
          permissions: Json
          role_level: number
          role_name: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_any_permission: {
        Args: { p_permissions: string[]; p_user_id: string }
        Returns: boolean
      }
      has_available_capacity: {
        Args: { p_class_instance_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { p_permission: string; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { p_organization_id: string; p_role: string; p_user_id: string }
        Returns: boolean
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: boolean
      }
      is_staff: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_conversation_messages_read: {
        Args: {
          p_conversation_id: string
          p_message_ids?: string[]
          p_reader_id: string
        }
        Returns: Json
      }
      mark_message_read: {
        Args: { p_message_id: string; p_reader_id: string }
        Returns: Json
      }
      populate_geometry_columns:
        | { Args: { use_typmod?: boolean }; Returns: string }
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      reset_weekly_rings: { Args: never; Returns: undefined }
      seed_default_achievements: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      should_share_read_receipt: {
        Args: { reader_id: string; sender_id: string }
        Returns: boolean
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_askml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geom: unknown }; Returns: number }
        | { Args: { geog: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      update_ring_progress: {
        Args: {
          p_member_id: string
          p_organization_id: string
          p_ring_type: string
        }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
