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
  public: {
    Tables: {
      age_verification_attempts: {
        Row: {
          attempt_status: string
          created_at: string | null
          device_fingerprint: string | null
          geolocation: Json | null
          id: string
          ip_address: unknown
          metadata: Json | null
          session_id: string
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
          verification_method: string
        }
        Insert: {
          attempt_status?: string
          created_at?: string | null
          device_fingerprint?: string | null
          geolocation?: Json | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          session_id: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          verification_method: string
        }
        Update: {
          attempt_status?: string
          created_at?: string | null
          device_fingerprint?: string | null
          geolocation?: Json | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          session_id?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          verification_method?: string
        }
        Relationships: []
      }
      age_verification_audit_logs: {
        Row: {
          compliance_impact: string | null
          created_at: string | null
          event_data: Json | null
          event_description: string
          event_type: string
          id: string
          ip_address: unknown
          performed_by: string | null
          retention_period: string | null
          user_agent: string | null
          user_id: string | null
          verification_attempt_id: string | null
        }
        Insert: {
          compliance_impact?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_description: string
          event_type: string
          id?: string
          ip_address?: unknown
          performed_by?: string | null
          retention_period?: string | null
          user_agent?: string | null
          user_id?: string | null
          verification_attempt_id?: string | null
        }
        Update: {
          compliance_impact?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_description?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          performed_by?: string | null
          retention_period?: string | null
          user_agent?: string | null
          user_id?: string | null
          verification_attempt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "age_verification_audit_logs_verification_attempt_id_fkey"
            columns: ["verification_attempt_id"]
            isOneToOne: false
            referencedRelation: "age_verification_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      age_verification_compliance_reports: {
        Row: {
          audit_findings: Json | null
          compliance_score: number
          coppa_compliance_status: boolean
          failed_verifications: number
          fraud_cases_detected: number
          gdpr_compliance_status: boolean
          generated_at: string | null
          generated_by: string | null
          id: string
          manual_reviews_required: number
          recommendations: Json | null
          report_data: Json
          report_period_end: string
          report_period_start: string
          successful_verifications: number
          total_verification_attempts: number
          underage_users_blocked: number
        }
        Insert: {
          audit_findings?: Json | null
          compliance_score: number
          coppa_compliance_status: boolean
          failed_verifications: number
          fraud_cases_detected: number
          gdpr_compliance_status: boolean
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          manual_reviews_required: number
          recommendations?: Json | null
          report_data: Json
          report_period_end: string
          report_period_start: string
          successful_verifications: number
          total_verification_attempts: number
          underage_users_blocked: number
        }
        Update: {
          audit_findings?: Json | null
          compliance_score?: number
          coppa_compliance_status?: boolean
          failed_verifications?: number
          fraud_cases_detected?: number
          gdpr_compliance_status?: boolean
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          manual_reviews_required?: number
          recommendations?: Json | null
          report_data?: Json
          report_period_end?: string
          report_period_start?: string
          successful_verifications?: number
          total_verification_attempts?: number
          underage_users_blocked?: number
        }
        Relationships: []
      }
      age_verification_manual_queue: {
        Row: {
          ai_confidence: number | null
          assigned_reviewer_id: string | null
          compliance_review_required: boolean | null
          decision: string | null
          decision_reason: string | null
          document_hash: string | null
          document_type: string | null
          escalation_level: number | null
          extracted_data: Json | null
          flag_reasons: string[] | null
          id: string
          priority: string
          review_completed_at: string | null
          review_started_at: string | null
          reviewer_notes: string | null
          status: string | null
          submission_id: string
          submission_time: string | null
          user_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          assigned_reviewer_id?: string | null
          compliance_review_required?: boolean | null
          decision?: string | null
          decision_reason?: string | null
          document_hash?: string | null
          document_type?: string | null
          escalation_level?: number | null
          extracted_data?: Json | null
          flag_reasons?: string[] | null
          id?: string
          priority?: string
          review_completed_at?: string | null
          review_started_at?: string | null
          reviewer_notes?: string | null
          status?: string | null
          submission_id: string
          submission_time?: string | null
          user_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          assigned_reviewer_id?: string | null
          compliance_review_required?: boolean | null
          decision?: string | null
          decision_reason?: string | null
          document_hash?: string | null
          document_type?: string | null
          escalation_level?: number | null
          extracted_data?: Json | null
          flag_reasons?: string[] | null
          id?: string
          priority?: string
          review_completed_at?: string | null
          review_started_at?: string | null
          reviewer_notes?: string | null
          status?: string | null
          submission_id?: string
          submission_time?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "age_verification_manual_queue_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "age_verification_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      age_verification_results: {
        Row: {
          attempt_id: string
          compliance_flags: Json | null
          created_at: string | null
          document_expiry_date: string | null
          document_type: string | null
          fraud_indicators: Json | null
          fraud_score: number | null
          id: string
          is_verified: boolean
          issuing_authority: string | null
          manual_review_reason: string | null
          processing_time_ms: number | null
          requires_manual_review: boolean | null
          user_id: string | null
          verification_confidence: number | null
          verification_provider: string | null
          verified_age: number | null
        }
        Insert: {
          attempt_id: string
          compliance_flags?: Json | null
          created_at?: string | null
          document_expiry_date?: string | null
          document_type?: string | null
          fraud_indicators?: Json | null
          fraud_score?: number | null
          id?: string
          is_verified?: boolean
          issuing_authority?: string | null
          manual_review_reason?: string | null
          processing_time_ms?: number | null
          requires_manual_review?: boolean | null
          user_id?: string | null
          verification_confidence?: number | null
          verification_provider?: string | null
          verified_age?: number | null
        }
        Update: {
          attempt_id?: string
          compliance_flags?: Json | null
          created_at?: string | null
          document_expiry_date?: string | null
          document_type?: string | null
          fraud_indicators?: Json | null
          fraud_score?: number | null
          id?: string
          is_verified?: boolean
          issuing_authority?: string | null
          manual_review_reason?: string | null
          processing_time_ms?: number | null
          requires_manual_review?: boolean | null
          user_id?: string | null
          verification_confidence?: number | null
          verification_provider?: string | null
          verified_age?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "age_verification_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "age_verification_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          context: Json | null
          created_at: string
          device_info: Json | null
          event_name: string
          event_properties: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          device_info?: Json | null
          event_name: string
          event_properties?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          device_info?: Json | null
          event_name?: string
          event_properties?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      api_version_usage: {
        Row: {
          compatibility_mode: string[] | null
          created_at: string | null
          endpoint: string
          id: string
          ip_address: unknown
          is_deprecated: boolean | null
          requested_version: string
          resolved_version: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          compatibility_mode?: string[] | null
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: unknown
          is_deprecated?: boolean | null
          requested_version: string
          resolved_version: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          compatibility_mode?: string[] | null
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: unknown
          is_deprecated?: boolean | null
          requested_version?: string
          resolved_version?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
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
      audit_logs: {
        Row: {
          action: string | null
          context: Json | null
          created_at: string | null
          error_message: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          operation_type: Database["public"]["Enums"]["audit_operation_type"]
          record_id: string | null
          resource_id: string | null
          resource_type: string | null
          session_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          context?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          operation_type: Database["public"]["Enums"]["audit_operation_type"]
          record_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          context?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          operation_type?: Database["public"]["Enums"]["audit_operation_type"]
          record_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          blocked_until: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          notes: string | null
          reasons: string[] | null
          threat_score: number | null
          updated_at: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          ip_address: unknown
          notes?: string | null
          reasons?: string[] | null
          threat_score?: number | null
          updated_at?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          notes?: string | null
          reasons?: string[] | null
          threat_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      cohort_segments: {
        Row: {
          analysis_date: string
          avg_matches: number | null
          avg_messages: number | null
          avg_revenue: number | null
          avg_session_time: number | null
          cohort_name: string
          cohort_type: string
          created_at: string
          id: string
          metadata: Json | null
          premium_conversion: number | null
          retention_d1: number | null
          retention_d30: number | null
          retention_d7: number | null
          user_count: number
        }
        Insert: {
          analysis_date: string
          avg_matches?: number | null
          avg_messages?: number | null
          avg_revenue?: number | null
          avg_session_time?: number | null
          cohort_name: string
          cohort_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          premium_conversion?: number | null
          retention_d1?: number | null
          retention_d30?: number | null
          retention_d7?: number | null
          user_count?: number
        }
        Update: {
          analysis_date?: string
          avg_matches?: number | null
          avg_messages?: number | null
          avg_revenue?: number | null
          avg_session_time?: number | null
          cohort_name?: string
          cohort_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          premium_conversion?: number | null
          retention_d1?: number | null
          retention_d30?: number | null
          retention_d7?: number | null
          user_count?: number
        }
        Relationships: []
      }
      compatibility_performance_log: {
        Row: {
          batch_size: number | null
          cache_hit_rate: number | null
          calculation_time_ms: number | null
          created_at: string | null
          error_count: number | null
          id: string
          user_id: string | null
        }
        Insert: {
          batch_size?: number | null
          cache_hit_rate?: number | null
          calculation_time_ms?: number | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          user_id?: string | null
        }
        Update: {
          batch_size?: number | null
          cache_hit_rate?: number | null
          calculation_time_ms?: number | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compatibility_performance_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compatibility_performance_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      compatibility_score_cache: {
        Row: {
          astrological_score: number
          calculation_details: Json | null
          compatibility_score: number
          created_at: string
          id: string
          is_recommended: boolean
          overall_grade: string
          questionnaire_score: number
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          astrological_score?: number
          calculation_details?: Json | null
          compatibility_score?: number
          created_at?: string
          id?: string
          is_recommended?: boolean
          overall_grade?: string
          questionnaire_score?: number
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          astrological_score?: number
          calculation_details?: Json | null
          compatibility_score?: number
          created_at?: string
          id?: string
          is_recommended?: boolean
          overall_grade?: string
          questionnaire_score?: number
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compatibility_score_cache_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compatibility_score_cache_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibility_score_cache_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compatibility_score_cache_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      compatibility_scores: {
        Row: {
          calculated_at: string
          compatibility_score: number
          created_at: string
          expires_at: string | null
          id: string
          potential_match_id: string
          score_components: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calculated_at?: string
          compatibility_score: number
          created_at?: string
          expires_at?: string | null
          id?: string
          potential_match_id: string
          score_components?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calculated_at?: string
          compatibility_score?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          potential_match_id?: string
          score_components?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          id: string
          last_message_at: string | null
          last_message_content: string | null
          last_message_preview: string | null
          match_id: string | null
          unread_counts: Json | null
          updated_at: string | null
          user1_id: string | null
          user2_id: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_preview?: string | null
          match_id?: string | null
          unread_counts?: Json | null
          updated_at?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          last_message_at?: string | null
          last_message_content?: string | null
          last_message_preview?: string | null
          match_id?: string | null
          unread_counts?: Json | null
          updated_at?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "discoverable_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "discoverable_users_with_preferences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "persona_verification_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "secure_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["potential_match_id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_matching_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_read_receipt_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "discoverable_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "discoverable_users_with_preferences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "persona_verification_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "secure_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["potential_match_id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_matching_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_read_receipt_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric_date: string
          metric_type: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_date: string
          metric_type: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_date?: string
          metric_type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      dashboard_admins: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_seen_at: string | null
          metadata: Json
          permissions: Json
          role: Database["public"]["Enums"]["dashboard_admin_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          permissions?: Json
          role?: Database["public"]["Enums"]["dashboard_admin_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          permissions?: Json
          role?: Database["public"]["Enums"]["dashboard_admin_role"]
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_thresholds: {
        Row: {
          critical_threshold: number | null
          metadata: Json | null
          metric_name: string
          updated_at: string
          warning_threshold: number | null
        }
        Insert: {
          critical_threshold?: number | null
          metadata?: Json | null
          metric_name: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Update: {
          critical_threshold?: number | null
          metadata?: Json | null
          metric_name?: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Relationships: []
      }
      deletion_audit: {
        Row: {
          created_at: string | null
          deleted_by: string
          deletion_metadata: Json | null
          deletion_reason: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_by: string
          deletion_metadata?: Json | null
          deletion_reason: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_by?: string
          deletion_metadata?: Json | null
          deletion_reason?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deletion_audit_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deletion_audit_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_fraud_detection: {
        Row: {
          associated_user_ids: string[] | null
          confidence_score: number
          detection_count: number | null
          detection_method: string
          document_hash: string
          first_detected_at: string | null
          fraud_type: string
          id: string
          investigation_status: string | null
          last_detected_at: string | null
          metadata: Json | null
          reported_to_authorities: boolean | null
        }
        Insert: {
          associated_user_ids?: string[] | null
          confidence_score: number
          detection_count?: number | null
          detection_method: string
          document_hash: string
          first_detected_at?: string | null
          fraud_type: string
          id?: string
          investigation_status?: string | null
          last_detected_at?: string | null
          metadata?: Json | null
          reported_to_authorities?: boolean | null
        }
        Update: {
          associated_user_ids?: string[] | null
          confidence_score?: number
          detection_count?: number | null
          detection_method?: string
          document_hash?: string
          first_detected_at?: string | null
          fraud_type?: string
          id?: string
          investigation_status?: string | null
          last_detected_at?: string | null
          metadata?: Json | null
          reported_to_authorities?: boolean | null
        }
        Relationships: []
      }
      edge_function_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          function_name: string
          id: string
          request_params: Json | null
          response_size: number | null
          status_code: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          function_name: string
          id?: string
          request_params?: Json | null
          response_size?: number | null
          status_code?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          function_name?: string
          id?: string
          request_params?: Json | null
          response_size?: number | null
          status_code?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edge_function_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "edge_function_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      encrypted_birth_data: {
        Row: {
          created_at: string | null
          encrypted_data: string
          encryption_key_id: string
          id: string
          iv: string
          salt: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_data: string
          encryption_key_id: string
          id?: string
          iv: string
          salt: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_data?: string
          encryption_key_id?: string
          id?: string
          iv?: string
          salt?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json | null
          correlation_id: string | null
          created_at: string | null
          details: Json | null
          error_code: string
          id: string
          message: string
          severity: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string | null
          details?: Json | null
          error_code: string
          id?: string
          message: string
          severity: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string | null
          details?: Json | null
          error_code?: string
          id?: string
          message?: string
          severity?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      invite_usage_log: {
        Row: {
          id: string
          invited_user_id: string
          metadata: Json | null
          subscription_status: string
          used_at: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_user_id: string
          metadata?: Json | null
          subscription_status: string
          used_at?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_user_id?: string
          metadata?: Json | null
          subscription_status?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_usage_log_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "discoverable_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "discoverable_users_with_preferences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_usage_log_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "persona_verification_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "secure_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["potential_match_id"]
          },
          {
            foreignKeyName: "invite_usage_log_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_usage_log_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "user_matching_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "user_read_receipt_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discoverable_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discoverable_users_with_preferences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "persona_verification_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "secure_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["potential_match_id"]
          },
          {
            foreignKeyName: "invite_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_matching_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_read_receipt_summary"
            referencedColumns: ["user_id"]
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
      match_creation_logs: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          created_by: string | null
          event_type: string
          id: string
          match_id: string | null
          match_request_id: string | null
          metadata: Json | null
          source_type: string
          timestamp: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          match_id?: string | null
          match_request_id?: string | null
          metadata?: Json | null
          source_type: string
          timestamp?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          match_id?: string | null
          match_request_id?: string | null
          metadata?: Json | null
          source_type?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_creation_logs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_creation_logs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "secure_match_view"
            referencedColumns: ["id"]
          },
        ]
      }
      match_logs: {
        Row: {
          category: string
          context: Json | null
          conversation_id: string | null
          correlation_id: string | null
          created_at: string | null
          duration: number | null
          error_details: Json | null
          id: string
          level: string
          match_id: string | null
          message: string
          metadata: Json | null
          operation: string
          request_id: string | null
          session_id: string | null
          swipe_id: string | null
          tags: string[] | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          context?: Json | null
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string | null
          duration?: number | null
          error_details?: Json | null
          id?: string
          level: string
          match_id?: string | null
          message: string
          metadata?: Json | null
          operation: string
          request_id?: string | null
          session_id?: string | null
          swipe_id?: string | null
          tags?: string[] | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          context?: Json | null
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string | null
          duration?: number | null
          error_details?: Json | null
          id?: string
          level?: string
          match_id?: string | null
          message?: string
          metadata?: Json | null
          operation?: string
          request_id?: string | null
          session_id?: string | null
          swipe_id?: string | null
          tags?: string[] | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      match_metrics: {
        Row: {
          avg_time_to_match: unknown
          created_at: string
          id: string
          match_quality_score: number | null
          metadata: Json | null
          metric_date: string
          total_matches: number
        }
        Insert: {
          avg_time_to_match?: unknown
          created_at?: string
          id?: string
          match_quality_score?: number | null
          metadata?: Json | null
          metric_date: string
          total_matches?: number
        }
        Update: {
          avg_time_to_match?: unknown
          created_at?: string
          id?: string
          match_quality_score?: number | null
          metadata?: Json | null
          metric_date?: string
          total_matches?: number
        }
        Relationships: []
      }
      match_requests: {
        Row: {
          compatibility_details: Json | null
          compatibility_score: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          matched_user_id: string
          requester_id: string
          response_message: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          compatibility_details?: Json | null
          compatibility_score?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          matched_user_id: string
          requester_id: string
          response_message?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          compatibility_details?: Json | null
          compatibility_score?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          matched_user_id?: string
          requester_id?: string
          response_message?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_requests_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "match_requests_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "match_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      match_status_audit: {
        Row: {
          created_at: string | null
          from_status: string
          id: string
          match_id: string | null
          metadata: Json | null
          reason: string | null
          to_status: string
          transition_timestamp: string | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string | null
          from_status: string
          id?: string
          match_id?: string | null
          metadata?: Json | null
          reason?: string | null
          to_status: string
          transition_timestamp?: string | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string | null
          from_status?: string
          id?: string
          match_id?: string | null
          metadata?: Json | null
          reason?: string | null
          to_status?: string
          transition_timestamp?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_status_audit_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_status_audit_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "secure_match_view"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          astro_compatibility: Json | null
          astrological_grade: string | null
          astrological_score: number | null
          calculation_result: Json | null
          calculation_result_encrypted: string | null
          combined_score: number | null
          compatibility_encryption_version: string | null
          compatibility_score: number | null
          conversation_id: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          id: string
          is_recommended: boolean | null
          match_request_id: string | null
          matched_at: string | null
          meets_threshold: boolean | null
          priority_score: number | null
          questionnaire_compatibility: Json | null
          questionnaire_grade: string | null
          questionnaire_score: number | null
          status: string | null
          updated_at: string | null
          user1_id: string | null
          user2_id: string | null
        }
        Insert: {
          astro_compatibility?: Json | null
          astrological_grade?: string | null
          astrological_score?: number | null
          calculation_result?: Json | null
          calculation_result_encrypted?: string | null
          combined_score?: number | null
          compatibility_encryption_version?: string | null
          compatibility_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          is_recommended?: boolean | null
          match_request_id?: string | null
          matched_at?: string | null
          meets_threshold?: boolean | null
          priority_score?: number | null
          questionnaire_compatibility?: Json | null
          questionnaire_grade?: string | null
          questionnaire_score?: number | null
          status?: string | null
          updated_at?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Update: {
          astro_compatibility?: Json | null
          astrological_grade?: string | null
          astrological_score?: number | null
          calculation_result?: Json | null
          calculation_result_encrypted?: string | null
          combined_score?: number | null
          compatibility_encryption_version?: string | null
          compatibility_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          is_recommended?: boolean | null
          match_request_id?: string | null
          matched_at?: string | null
          meets_threshold?: boolean | null
          priority_score?: number | null
          questionnaire_compatibility?: Json | null
          questionnaire_grade?: string | null
          questionnaire_score?: number | null
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
            referencedRelation: "conversation_summary_cache"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "matches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "matches_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      materialized_view_performance: {
        Row: {
          details: Json | null
          duration_ms: number
          id: string
          operation: string
          rows_affected: number | null
          timestamp: string
          view_name: string
        }
        Insert: {
          details?: Json | null
          duration_ms: number
          id?: string
          operation: string
          rows_affected?: number | null
          timestamp?: string
          view_name: string
        }
        Update: {
          details?: Json | null
          duration_ms?: number
          id?: string
          operation?: string
          rows_affected?: number | null
          timestamp?: string
          view_name?: string
        }
        Relationships: []
      }
      materialized_view_refresh_schedule: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_refresh: string | null
          next_refresh: string | null
          refresh_interval_minutes: number
          view_name: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_refresh?: string | null
          next_refresh?: string | null
          refresh_interval_minutes: number
          view_name: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_refresh?: string | null
          next_refresh?: string | null
          refresh_interval_minutes?: number
          view_name?: string
        }
        Relationships: []
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
            referencedRelation: "conversation_summary_cache"
            referencedColumns: ["conversation_id"]
          },
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
          deleted_at: string | null
          deleted_for_recipient: boolean | null
          deleted_for_sender: boolean | null
          delivered_at: string | null
          id: string
          is_read: boolean | null
          media_type: string | null
          media_url: string | null
          message_type: string | null
          read_at: string | null
          read_receipt_sent: boolean | null
          sender_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_for_recipient?: boolean | null
          deleted_for_sender?: boolean | null
          delivered_at?: string | null
          id?: string
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          read_at?: string | null
          read_receipt_sent?: boolean | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_for_recipient?: boolean | null
          deleted_for_sender?: boolean | null
          delivered_at?: string | null
          id?: string
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          read_at?: string | null
          read_receipt_sent?: boolean | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_summary_cache"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      natal_charts: {
        Row: {
          access_count: number | null
          calculated_at: string | null
          calculation_metadata_encrypted: string | null
          chart_data_encrypted: string
          chart_hash: string | null
          chart_version: string | null
          created_at: string | null
          encryption_version: string | null
          id: string
          last_accessed_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_count?: number | null
          calculated_at?: string | null
          calculation_metadata_encrypted?: string | null
          chart_data_encrypted: string
          chart_hash?: string | null
          chart_version?: string | null
          created_at?: string | null
          encryption_version?: string | null
          id?: string
          last_accessed_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_count?: number | null
          calculated_at?: string | null
          calculation_metadata_encrypted?: string | null
          chart_data_encrypted?: string
          chart_hash?: string | null
          chart_version?: string | null
          created_at?: string | null
          encryption_version?: string | null
          id?: string
          last_accessed_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_read_status: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          read_from_device: string | null
          read_location: unknown
          session_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          read_from_device?: string | null
          read_location?: unknown
          session_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          read_from_device?: string | null
          read_location?: unknown
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_read_status_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "user_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_name: string
          recorded_at: string
          unit: string | null
          value: number
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_name: string
          recorded_at?: string
          unit?: string | null
          value: number
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_name?: string
          recorded_at?: string
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      password_policy_violations: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          ip_address: unknown
          password_strength_score: number | null
          user_agent: string | null
          user_id: string | null
          violation_details: Json | null
          violation_type: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: unknown
          password_strength_score?: number | null
          user_agent?: string | null
          user_id?: string | null
          violation_details?: Json | null
          violation_type: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          ip_address?: unknown
          password_strength_score?: number | null
          user_agent?: string | null
          user_id?: string | null
          violation_details?: Json | null
          violation_type?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          endpoint: string | null
          id: string
          metadata: Json | null
          metric_name: string
          metric_unit: string
          metric_value: number
          recorded_at: string | null
          user_id: string | null
        }
        Insert: {
          endpoint?: string | null
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_unit: string
          metric_value: number
          recorded_at?: string | null
          user_id?: string | null
        }
        Update: {
          endpoint?: string | null
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_unit?: string
          metric_value?: number
          recorded_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      persona_verification_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          inquiry_id: string
          liveness_score: number | null
          metadata: Json | null
          session_token: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          inquiry_id: string
          liveness_score?: number | null
          metadata?: Json | null
          session_token?: string | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          inquiry_id?: string
          liveness_score?: number | null
          metadata?: Json | null
          session_token?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      persona_webhook_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          inquiry_id: string
          processed: boolean | null
          processed_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_data: Json
          event_type: string
          id?: string
          inquiry_id: string
          processed?: boolean | null
          processed_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          inquiry_id?: string
          processed?: boolean | null
          processed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      photo_manual_review_queue: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          priority: number | null
          profile_id: string
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          updated_at: string | null
          user_id: string
          verification_log_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          priority?: number | null
          profile_id: string
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          updated_at?: string | null
          user_id: string
          verification_log_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          priority?: number | null
          profile_id?: string
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          updated_at?: string | null
          user_id?: string
          verification_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_manual_review_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "discoverable_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_manual_review_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "discoverable_users_with_preferences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "photo_manual_review_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "persona_verification_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_manual_review_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_manual_review_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "secure_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_manual_review_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["potential_match_id"]
          },
          {
            foreignKeyName: "photo_manual_review_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "photo_manual_review_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_matching_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_manual_review_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_read_receipt_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "photo_manual_review_queue_verification_log_id_fkey"
            columns: ["verification_log_id"]
            isOneToOne: false
            referencedRelation: "photo_verification_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_verification_logs: {
        Row: {
          created_at: string | null
          id: string
          image_uri: string | null
          image_url: string
          updated_at: string | null
          user_id: string
          verification_result: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_uri?: string | null
          image_url: string
          updated_at?: string | null
          user_id: string
          verification_result: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          image_uri?: string | null
          image_url?: string
          updated_at?: string | null
          user_id?: string
          verification_result?: Json
        }
        Relationships: []
      }
      photo_verification_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_preferences: Json | null
          age: number | null
          age_verification_completed_at: string | null
          age_verification_method: string | null
          age_verification_status: string | null
          age_verified: boolean | null
          app_settings: Json | null
          avatar_url: string | null
          bio: string | null
          birth_data_encrypted: boolean | null
          compliance_flags: Json | null
          created_at: string | null
          current_city: string | null
          current_city_lat: number | null
          current_city_lng: number | null
          daily_invites_remaining: number | null
          daily_swipe_count: number | null
          display_name: string | null
          education_level: string | null
          gender: string | null
          has_kids: boolean | null
          id: string
          interests: string[] | null
          is_admin: boolean | null
          is_discoverable: boolean | null
          is_single: boolean | null
          last_invite_reset_date: string | null
          last_swipe_at: string | null
          last_swipe_reset: string | null
          location: Json | null
          looking_for: string | null
          natal_chart_data: Json | null
          onboarding_completed: boolean | null
          persona_inquiry_id: string | null
          persona_liveness_score: number | null
          persona_verification_status: string | null
          persona_verified_at: string | null
          photo_verification_confidence: number | null
          photo_verification_date: string | null
          photo_verification_status: string | null
          politics: string | null
          push_token: string | null
          revenue_cat_user_id: string | null
          subscription_platform: string | null
          subscription_status: string | null
          traits: string[] | null
          updated_at: string | null
          username: string | null
          wants_kids: string | null
          zodiac_sign: string | null
        }
        Insert: {
          activity_preferences?: Json | null
          age?: number | null
          age_verification_completed_at?: string | null
          age_verification_method?: string | null
          age_verification_status?: string | null
          age_verified?: boolean | null
          app_settings?: Json | null
          avatar_url?: string | null
          bio?: string | null
          birth_data_encrypted?: boolean | null
          compliance_flags?: Json | null
          created_at?: string | null
          current_city?: string | null
          current_city_lat?: number | null
          current_city_lng?: number | null
          daily_invites_remaining?: number | null
          daily_swipe_count?: number | null
          display_name?: string | null
          education_level?: string | null
          gender?: string | null
          has_kids?: boolean | null
          id: string
          interests?: string[] | null
          is_admin?: boolean | null
          is_discoverable?: boolean | null
          is_single?: boolean | null
          last_invite_reset_date?: string | null
          last_swipe_at?: string | null
          last_swipe_reset?: string | null
          location?: Json | null
          looking_for?: string | null
          natal_chart_data?: Json | null
          onboarding_completed?: boolean | null
          persona_inquiry_id?: string | null
          persona_liveness_score?: number | null
          persona_verification_status?: string | null
          persona_verified_at?: string | null
          photo_verification_confidence?: number | null
          photo_verification_date?: string | null
          photo_verification_status?: string | null
          politics?: string | null
          push_token?: string | null
          revenue_cat_user_id?: string | null
          subscription_platform?: string | null
          subscription_status?: string | null
          traits?: string[] | null
          updated_at?: string | null
          username?: string | null
          wants_kids?: string | null
          zodiac_sign?: string | null
        }
        Update: {
          activity_preferences?: Json | null
          age?: number | null
          age_verification_completed_at?: string | null
          age_verification_method?: string | null
          age_verification_status?: string | null
          age_verified?: boolean | null
          app_settings?: Json | null
          avatar_url?: string | null
          bio?: string | null
          birth_data_encrypted?: boolean | null
          compliance_flags?: Json | null
          created_at?: string | null
          current_city?: string | null
          current_city_lat?: number | null
          current_city_lng?: number | null
          daily_invites_remaining?: number | null
          daily_swipe_count?: number | null
          display_name?: string | null
          education_level?: string | null
          gender?: string | null
          has_kids?: boolean | null
          id?: string
          interests?: string[] | null
          is_admin?: boolean | null
          is_discoverable?: boolean | null
          is_single?: boolean | null
          last_invite_reset_date?: string | null
          last_swipe_at?: string | null
          last_swipe_reset?: string | null
          location?: Json | null
          looking_for?: string | null
          natal_chart_data?: Json | null
          onboarding_completed?: boolean | null
          persona_inquiry_id?: string | null
          persona_liveness_score?: number | null
          persona_verification_status?: string | null
          persona_verified_at?: string | null
          photo_verification_confidence?: number | null
          photo_verification_date?: string | null
          photo_verification_status?: string | null
          politics?: string | null
          push_token?: string | null
          revenue_cat_user_id?: string | null
          subscription_platform?: string | null
          subscription_status?: string | null
          traits?: string[] | null
          updated_at?: string | null
          username?: string | null
          wants_kids?: string | null
          zodiac_sign?: string | null
        }
        Relationships: []
      }
      query_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string
          result_data: Json
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at: string
          result_data: Json
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string
          result_data?: Json
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
      rate_limit_entries: {
        Row: {
          created_at: string
          id: number
          identifier: string
          limit_value: number
          request_count: number
          reset_time: string
          updated_at: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: number
          identifier: string
          limit_value: number
          request_count?: number
          reset_time: string
          updated_at?: string
          window_start: string
        }
        Update: {
          created_at?: string
          id?: number
          identifier?: string
          limit_value?: number
          request_count?: number
          reset_time?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
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
      retention_cohorts: {
        Row: {
          cohort_date: string
          cohort_size: number
          created_at: string
          day_1_rate: number | null
          day_1_retained: number | null
          day_14_rate: number | null
          day_14_retained: number | null
          day_30_rate: number | null
          day_30_retained: number | null
          day_7_rate: number | null
          day_7_retained: number | null
          day_90_rate: number | null
          day_90_retained: number | null
          id: string
          metadata: Json | null
          updated_at: string
        }
        Insert: {
          cohort_date: string
          cohort_size?: number
          created_at?: string
          day_1_rate?: number | null
          day_1_retained?: number | null
          day_14_rate?: number | null
          day_14_retained?: number | null
          day_30_rate?: number | null
          day_30_retained?: number | null
          day_7_rate?: number | null
          day_7_retained?: number | null
          day_90_rate?: number | null
          day_90_retained?: number | null
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Update: {
          cohort_date?: string
          cohort_size?: number
          created_at?: string
          day_1_rate?: number | null
          day_1_retained?: number | null
          day_14_rate?: number | null
          day_14_retained?: number | null
          day_30_rate?: number | null
          day_30_retained?: number | null
          day_7_rate?: number | null
          day_7_retained?: number | null
          day_90_rate?: number | null
          day_90_retained?: number | null
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      revenuecat_entitlements: {
        Row: {
          created_at: string
          entitlement_id: string
          expires_date: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          product_id: string
          purchase_date: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entitlement_id: string
          expires_date?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          product_id: string
          purchase_date: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entitlement_id?: string
          expires_date?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          product_id?: string
          purchase_date?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenuecat_entitlements_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "revenuecat_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenuecat_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "revenuecat_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      revenuecat_products: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          entitlement_ids: string[]
          id: string
          intro_period: string | null
          is_active: boolean
          metadata: Json | null
          price_metadata: Json | null
          price_usd: number | null
          product_id: string
          product_type: string
          sort_order: number | null
          store: string
          store_product_id: string
          subscription_period: string | null
          trial_period: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          entitlement_ids?: string[]
          id?: string
          intro_period?: string | null
          is_active?: boolean
          metadata?: Json | null
          price_metadata?: Json | null
          price_usd?: number | null
          product_id: string
          product_type: string
          sort_order?: number | null
          store: string
          store_product_id: string
          subscription_period?: string | null
          trial_period?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          entitlement_ids?: string[]
          id?: string
          intro_period?: string | null
          is_active?: boolean
          metadata?: Json | null
          price_metadata?: Json | null
          price_usd?: number | null
          product_id?: string
          product_type?: string
          sort_order?: number | null
          store?: string
          store_product_id?: string
          subscription_period?: string | null
          trial_period?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      revenuecat_subscriptions: {
        Row: {
          auto_resume_date: string | null
          billing_issue_detected_at: string | null
          created_at: string
          currency: string | null
          entitlement_id: string
          expires_date: string | null
          grace_period_expires_date: string | null
          id: string
          is_active: boolean | null
          is_sandbox: boolean
          metadata: Json | null
          original_purchase_date: string
          period_type: string
          price_in_purchased_currency: number | null
          product_id: string
          purchase_date: string
          revenuecat_original_app_user_id: string
          revenuecat_subscriber_id: string
          status: string
          store: string
          store_original_transaction_id: string | null
          store_transaction_id: string | null
          unsubscribe_detected_at: string | null
          updated_at: string
          user_id: string
          will_renew: boolean
        }
        Insert: {
          auto_resume_date?: string | null
          billing_issue_detected_at?: string | null
          created_at?: string
          currency?: string | null
          entitlement_id: string
          expires_date?: string | null
          grace_period_expires_date?: string | null
          id?: string
          is_active?: boolean | null
          is_sandbox?: boolean
          metadata?: Json | null
          original_purchase_date: string
          period_type: string
          price_in_purchased_currency?: number | null
          product_id: string
          purchase_date: string
          revenuecat_original_app_user_id: string
          revenuecat_subscriber_id: string
          status: string
          store: string
          store_original_transaction_id?: string | null
          store_transaction_id?: string | null
          unsubscribe_detected_at?: string | null
          updated_at?: string
          user_id: string
          will_renew?: boolean
        }
        Update: {
          auto_resume_date?: string | null
          billing_issue_detected_at?: string | null
          created_at?: string
          currency?: string | null
          entitlement_id?: string
          expires_date?: string | null
          grace_period_expires_date?: string | null
          id?: string
          is_active?: boolean | null
          is_sandbox?: boolean
          metadata?: Json | null
          original_purchase_date?: string
          period_type?: string
          price_in_purchased_currency?: number | null
          product_id?: string
          purchase_date?: string
          revenuecat_original_app_user_id?: string
          revenuecat_subscriber_id?: string
          status?: string
          store?: string
          store_original_transaction_id?: string | null
          store_transaction_id?: string | null
          unsubscribe_detected_at?: string | null
          updated_at?: string
          user_id?: string
          will_renew?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "revenuecat_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "revenuecat_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      revenuecat_webhook_events: {
        Row: {
          app_user_id: string
          created_at: string
          entitlement_id: string | null
          event_id: string
          event_timestamp: string
          event_type: string
          id: string
          last_processing_error: string | null
          processed: boolean
          processed_at: string | null
          processing_attempts: number
          product_id: string | null
          raw_payload: Json
          store: string | null
          user_id: string | null
        }
        Insert: {
          app_user_id: string
          created_at?: string
          entitlement_id?: string | null
          event_id: string
          event_timestamp: string
          event_type: string
          id?: string
          last_processing_error?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_attempts?: number
          product_id?: string | null
          raw_payload: Json
          store?: string | null
          user_id?: string | null
        }
        Update: {
          app_user_id?: string
          created_at?: string
          entitlement_id?: string | null
          event_id?: string
          event_timestamp?: string
          event_type?: string
          id?: string
          last_processing_error?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_attempts?: number
          product_id?: string | null
          raw_payload?: Json
          store?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenuecat_webhook_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "revenuecat_webhook_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          data: Json
          description: string | null
          id: string
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          data?: Json
          description?: string | null
          id?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          data?: Json
          description?: string | null
          id?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          action_taken: string | null
          analyst_notes: string | null
          blocked: boolean | null
          context: Json | null
          created_at: string | null
          details: Json
          endpoint: string | null
          event_category: string | null
          event_type: string
          flagged_by: string[] | null
          geolocation: Json | null
          id: string
          investigation_status: string | null
          ip_address: unknown
          method: string | null
          request_body_hash: string | null
          request_headers: Json | null
          request_id: string | null
          request_method: string | null
          request_path: string | null
          resolved_at: string | null
          response_code: number | null
          session_id: string | null
          severity: string
          threat_score: number | null
          timestamp: string
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          analyst_notes?: string | null
          blocked?: boolean | null
          context?: Json | null
          created_at?: string | null
          details?: Json
          endpoint?: string | null
          event_category?: string | null
          event_type: string
          flagged_by?: string[] | null
          geolocation?: Json | null
          id?: string
          investigation_status?: string | null
          ip_address?: unknown
          method?: string | null
          request_body_hash?: string | null
          request_headers?: Json | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          resolved_at?: string | null
          response_code?: number | null
          session_id?: string | null
          severity: string
          threat_score?: number | null
          timestamp?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          analyst_notes?: string | null
          blocked?: boolean | null
          context?: Json | null
          created_at?: string | null
          details?: Json
          endpoint?: string | null
          event_category?: string | null
          event_type?: string
          flagged_by?: string[] | null
          geolocation?: Json | null
          id?: string
          investigation_status?: string | null
          ip_address?: unknown
          method?: string | null
          request_body_hash?: string | null
          request_headers?: Json | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          resolved_at?: string | null
          response_code?: number | null
          session_id?: string | null
          severity?: string
          threat_score?: number | null
          timestamp?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_metrics: {
        Row: {
          created_at: string | null
          id: string
          metric_name: string
          metric_type: string
          metric_unit: string | null
          metric_value: number
          tags: Json | null
          timestamp: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_name: string
          metric_type: string
          metric_unit?: string | null
          metric_value: number
          tags?: Json | null
          timestamp?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_name?: string
          metric_type?: string
          metric_unit?: string | null
          metric_value?: number
          tags?: Json | null
          timestamp?: string
        }
        Relationships: []
      }
      service_role_usage_audit: {
        Row: {
          client_ip: unknown
          created_at: string | null
          function_name: string
          id: string
          is_legitimate: boolean
          justification: string | null
          operation_type: string
          request_id: string | null
          table_accessed: string | null
          user_context: string | null
        }
        Insert: {
          client_ip?: unknown
          created_at?: string | null
          function_name: string
          id?: string
          is_legitimate?: boolean
          justification?: string | null
          operation_type: string
          request_id?: string | null
          table_accessed?: string | null
          user_context?: string | null
        }
        Update: {
          client_ip?: unknown
          created_at?: string | null
          function_name?: string
          id?: string
          is_legitimate?: boolean
          justification?: string | null
          operation_type?: string
          request_id?: string | null
          table_accessed?: string | null
          user_context?: string | null
        }
        Relationships: []
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
      swipe_exclusion_cache: {
        Row: {
          created_at: string
          id: string
          last_updated: string
          swiped_user_ids: string[]
          swiper_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated?: string
          swiped_user_ids?: string[]
          swiper_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_updated?: string
          swiped_user_ids?: string[]
          swiper_id?: string
        }
        Relationships: []
      }
      swipes: {
        Row: {
          created_at: string | null
          direction: string | null
          id: string
          location_context: Json | null
          swipe_type: string | null
          swiped_id: string | null
          swiper_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          direction?: string | null
          id?: string
          location_context?: Json | null
          swipe_type?: string | null
          swiped_id?: string | null
          swiper_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string | null
          id?: string
          location_context?: Json | null
          swipe_type?: string | null
          swiped_id?: string | null
          swiper_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      threshold_history: {
        Row: {
          admin_email: string | null
          admin_role: string | null
          change_reason: string | null
          changed_by: string | null
          created_at: string
          field_changed: string
          id: string
          metric_name: string
          new_value: Json
          old_value: Json
        }
        Insert: {
          admin_email?: string | null
          admin_role?: string | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          field_changed: string
          id?: string
          metric_name: string
          new_value: Json
          old_value: Json
        }
        Update: {
          admin_email?: string | null
          admin_role?: string | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          field_changed?: string
          id?: string
          metric_name?: string
          new_value?: Json
          old_value?: Json
        }
        Relationships: []
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
      transactions: {
        Row: {
          amount: number
          card_brand: string | null
          card_last4: string | null
          created_at: string | null
          currency: string
          failed_reason: string | null
          fee_amount: number | null
          id: string
          net_amount: number | null
          payment_method_type: string | null
          processed_at: string | null
          status: string
          stripe_charge_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string
          subscription_id: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string | null
          currency?: string
          failed_reason?: string | null
          fee_amount?: number | null
          id?: string
          net_amount?: number | null
          payment_method_type?: string | null
          processed_at?: string | null
          status: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id: string
          subscription_id?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string | null
          currency?: string
          failed_reason?: string | null
          fee_amount?: number | null
          id?: string
          net_amount?: number | null
          payment_method_type?: string | null
          processed_at?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string
          subscription_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_match_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      underage_user_blocks: {
        Row: {
          block_reason: string
          block_timestamp: string | null
          compliance_notifications_sent: Json | null
          data_deletion_completed_at: string | null
          data_deletion_scheduled_at: string | null
          detected_age: number | null
          detection_method: string
          device_fingerprint: string | null
          id: string
          ip_address: unknown
          legal_review_required: boolean | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          block_reason: string
          block_timestamp?: string | null
          compliance_notifications_sent?: Json | null
          data_deletion_completed_at?: string | null
          data_deletion_scheduled_at?: string | null
          detected_age?: number | null
          detection_method: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          legal_review_required?: boolean | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          block_reason?: string
          block_timestamp?: string | null
          compliance_notifications_sent?: Json | null
          data_deletion_completed_at?: string | null
          data_deletion_scheduled_at?: string | null
          detected_age?: number | null
          detection_method?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          legal_review_required?: boolean | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_behavior_analytics: {
        Row: {
          anomalies: string[] | null
          created_at: string | null
          date: string
          event_types: Json | null
          id: string
          ip_addresses: unknown[] | null
          last_activity: string | null
          risk_score: number | null
          total_events: number | null
          updated_at: string | null
          user_agents: string[] | null
          user_id: string
        }
        Insert: {
          anomalies?: string[] | null
          created_at?: string | null
          date?: string
          event_types?: Json | null
          id?: string
          ip_addresses?: unknown[] | null
          last_activity?: string | null
          risk_score?: number | null
          total_events?: number | null
          updated_at?: string | null
          user_agents?: string[] | null
          user_id: string
        }
        Update: {
          anomalies?: string[] | null
          created_at?: string | null
          date?: string
          event_types?: Json | null
          id?: string
          ip_addresses?: unknown[] | null
          last_activity?: string | null
          risk_score?: number | null
          total_events?: number | null
          updated_at?: string | null
          user_agents?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          block_type: string
          blocked_user_id: string
          blocking_user_id: string
          created_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          block_type?: string
          blocked_user_id: string
          blocking_user_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          block_type?: string
          blocked_user_id?: string
          blocking_user_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          deep_link_url: string | null
          delivered_at: string | null
          expires_at: string | null
          id: string
          interaction_count: number | null
          last_interaction_at: string | null
          metadata: Json | null
          priority: Database["public"]["Enums"]["notification_priority"]
          push_response: Json | null
          push_sent_at: string | null
          push_token: string | null
          read_at: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deep_link_url?: string | null
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          push_response?: Json | null
          push_sent_at?: string | null
          push_token?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deep_link_url?: string | null
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          push_response?: Json | null
          push_sent_at?: string | null
          push_token?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
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
      user_settings: {
        Row: {
          accessibility_features_enabled: boolean | null
          advanced_preferences: Json
          app_update_notifications: boolean | null
          boost_profile: boolean | null
          created_at: string
          daily_matches_notifications: boolean | null
          data_sharing_enabled: boolean | null
          discovery_enabled: boolean | null
          do_not_disturb_enabled: boolean | null
          do_not_disturb_end_time: string | null
          do_not_disturb_start_time: string | null
          education_level_preference: string[] | null
          gender_preference: string | null
          high_contrast_enabled: boolean | null
          id: string
          incognito_mode: boolean | null
          large_text_enabled: boolean | null
          marketing_notifications_enabled: boolean | null
          match_notifications_enabled: boolean | null
          match_request_notifications: boolean | null
          max_age_preference: number | null
          max_height_preference: number | null
          message_notifications_email: boolean | null
          message_notifications_enabled: boolean | null
          message_notifications_push: boolean | null
          message_notifications_sound: boolean | null
          min_age_preference: number | null
          min_height_preference: number | null
          notification_delivery_hours: Json | null
          notification_frequency: string | null
          preferred_distance_km: number | null
          profile_visibility_public: boolean | null
          read_receipts_enabled: boolean | null
          reduced_motion_enabled: boolean | null
          screen_reader_enabled: boolean | null
          settings_version: number
          show_age_on_profile: boolean | null
          show_distance_on_profile: boolean | null
          show_height_on_profile: boolean | null
          updated_at: string
          user_id: string
          zodiac_compatibility_required: boolean | null
        }
        Insert: {
          accessibility_features_enabled?: boolean | null
          advanced_preferences?: Json
          app_update_notifications?: boolean | null
          boost_profile?: boolean | null
          created_at?: string
          daily_matches_notifications?: boolean | null
          data_sharing_enabled?: boolean | null
          discovery_enabled?: boolean | null
          do_not_disturb_enabled?: boolean | null
          do_not_disturb_end_time?: string | null
          do_not_disturb_start_time?: string | null
          education_level_preference?: string[] | null
          gender_preference?: string | null
          high_contrast_enabled?: boolean | null
          id?: string
          incognito_mode?: boolean | null
          large_text_enabled?: boolean | null
          marketing_notifications_enabled?: boolean | null
          match_notifications_enabled?: boolean | null
          match_request_notifications?: boolean | null
          max_age_preference?: number | null
          max_height_preference?: number | null
          message_notifications_email?: boolean | null
          message_notifications_enabled?: boolean | null
          message_notifications_push?: boolean | null
          message_notifications_sound?: boolean | null
          min_age_preference?: number | null
          min_height_preference?: number | null
          notification_delivery_hours?: Json | null
          notification_frequency?: string | null
          preferred_distance_km?: number | null
          profile_visibility_public?: boolean | null
          read_receipts_enabled?: boolean | null
          reduced_motion_enabled?: boolean | null
          screen_reader_enabled?: boolean | null
          settings_version?: number
          show_age_on_profile?: boolean | null
          show_distance_on_profile?: boolean | null
          show_height_on_profile?: boolean | null
          updated_at?: string
          user_id: string
          zodiac_compatibility_required?: boolean | null
        }
        Update: {
          accessibility_features_enabled?: boolean | null
          advanced_preferences?: Json
          app_update_notifications?: boolean | null
          boost_profile?: boolean | null
          created_at?: string
          daily_matches_notifications?: boolean | null
          data_sharing_enabled?: boolean | null
          discovery_enabled?: boolean | null
          do_not_disturb_enabled?: boolean | null
          do_not_disturb_end_time?: string | null
          do_not_disturb_start_time?: string | null
          education_level_preference?: string[] | null
          gender_preference?: string | null
          high_contrast_enabled?: boolean | null
          id?: string
          incognito_mode?: boolean | null
          large_text_enabled?: boolean | null
          marketing_notifications_enabled?: boolean | null
          match_notifications_enabled?: boolean | null
          match_request_notifications?: boolean | null
          max_age_preference?: number | null
          max_height_preference?: number | null
          message_notifications_email?: boolean | null
          message_notifications_enabled?: boolean | null
          message_notifications_push?: boolean | null
          message_notifications_sound?: boolean | null
          min_age_preference?: number | null
          min_height_preference?: number | null
          notification_delivery_hours?: Json | null
          notification_frequency?: string | null
          preferred_distance_km?: number | null
          profile_visibility_public?: boolean | null
          read_receipts_enabled?: boolean | null
          reduced_motion_enabled?: boolean | null
          screen_reader_enabled?: boolean | null
          settings_version?: number
          show_age_on_profile?: boolean | null
          show_distance_on_profile?: boolean | null
          show_height_on_profile?: boolean | null
          updated_at?: string
          user_id?: string
          zodiac_compatibility_required?: boolean | null
        }
        Relationships: []
      }
      user_settings_changelog: {
        Row: {
          change_source: string | null
          changed_fields: Json
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          previous_values: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          change_source?: string | null
          changed_fields: Json
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          previous_values?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          change_source?: string | null
          changed_fields?: Json
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          previous_values?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          activity_preferences: string[] | null
          auth_user_id: string | null
          birth_city: string | null
          birth_date: string | null
          birth_date_encrypted: string | null
          birth_lat: number | null
          birth_lat_encrypted: string | null
          birth_lng: number | null
          birth_lng_encrypted: string | null
          birth_location: string | null
          birth_location_encrypted: string | null
          birth_time: string | null
          birth_time_encrypted: string | null
          created_at: string | null
          date_night_preferences: Json | null
          email: string
          encrypted_at: string | null
          encryption_enabled: boolean | null
          encryption_version: string | null
          has_kids: boolean | null
          id: string
          looking_for: string[] | null
          moon_sign: string | null
          natal_chart_data: Json | null
          preferences: Json | null
          questionnaire_responses: Json | null
          questionnaire_responses_encrypted: string | null
          rising_sign: string | null
          subscription_status: string | null
          subscription_tier: string | null
          sun_sign: string | null
          updated_at: string | null
          wants_kids: string | null
        }
        Insert: {
          activity_preferences?: string[] | null
          auth_user_id?: string | null
          birth_city?: string | null
          birth_date?: string | null
          birth_date_encrypted?: string | null
          birth_lat?: number | null
          birth_lat_encrypted?: string | null
          birth_lng?: number | null
          birth_lng_encrypted?: string | null
          birth_location?: string | null
          birth_location_encrypted?: string | null
          birth_time?: string | null
          birth_time_encrypted?: string | null
          created_at?: string | null
          date_night_preferences?: Json | null
          email: string
          encrypted_at?: string | null
          encryption_enabled?: boolean | null
          encryption_version?: string | null
          has_kids?: boolean | null
          id?: string
          looking_for?: string[] | null
          moon_sign?: string | null
          natal_chart_data?: Json | null
          preferences?: Json | null
          questionnaire_responses?: Json | null
          questionnaire_responses_encrypted?: string | null
          rising_sign?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          sun_sign?: string | null
          updated_at?: string | null
          wants_kids?: string | null
        }
        Update: {
          activity_preferences?: string[] | null
          auth_user_id?: string | null
          birth_city?: string | null
          birth_date?: string | null
          birth_date_encrypted?: string | null
          birth_lat?: number | null
          birth_lat_encrypted?: string | null
          birth_lng?: number | null
          birth_lng_encrypted?: string | null
          birth_location?: string | null
          birth_location_encrypted?: string | null
          birth_time?: string | null
          birth_time_encrypted?: string | null
          created_at?: string | null
          date_night_preferences?: Json | null
          email?: string
          encrypted_at?: string | null
          encryption_enabled?: boolean | null
          encryption_version?: string | null
          has_kids?: boolean | null
          id?: string
          looking_for?: string[] | null
          moon_sign?: string | null
          natal_chart_data?: Json | null
          preferences?: Json | null
          questionnaire_responses?: Json | null
          questionnaire_responses_encrypted?: string | null
          rising_sign?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          sun_sign?: string | null
          updated_at?: string | null
          wants_kids?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      conversation_summary_cache: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          last_message_at: string | null
          last_message_content: string | null
          last_sender_id: string | null
          total_messages: number | null
          updated_at: string | null
          user1_avatar: string | null
          user1_id: string | null
          user1_messages: number | null
          user1_name: string | null
          user1_unread_count: number | null
          user2_avatar: string | null
          user2_id: string | null
          user2_messages: number | null
          user2_name: string | null
          user2_unread_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "discoverable_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "discoverable_users_with_preferences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "persona_verification_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "secure_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["potential_match_id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_matching_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_read_receipt_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "discoverable_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "discoverable_users_with_preferences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "persona_verification_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "secure_profile_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["potential_match_id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_compatibility_cache"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_matching_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_read_receipt_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      discoverable_profiles: {
        Row: {
          age: number | null
          bio_preview: string | null
          created_at: string | null
          display_name: string | null
          gender: string | null
          id: string | null
          location: Json | null
          looking_for: string | null
          photos: Json | null
          zodiac_sign: string | null
        }
        Insert: {
          age?: number | null
          bio_preview?: never
          created_at?: string | null
          display_name?: string | null
          gender?: string | null
          id?: string | null
          location?: never
          looking_for?: string | null
          photos?: never
          zodiac_sign?: string | null
        }
        Update: {
          age?: number | null
          bio_preview?: never
          created_at?: string | null
          display_name?: string | null
          gender?: string | null
          id?: string | null
          location?: never
          looking_for?: string | null
          photos?: never
          zodiac_sign?: string | null
        }
        Relationships: []
      }
      discoverable_users_with_preferences: {
        Row: {
          age: number | null
          display_name: string | null
          gender: string | null
          gender_preference: string | null
          lat: number | null
          lng: number | null
          max_age_preference: number | null
          max_height_preference: number | null
          min_age_preference: number | null
          min_height_preference: number | null
          preferred_distance_km: number | null
          updated_at: string | null
          user_id: string | null
          zodiac_compatibility_required: boolean | null
          zodiac_sign: string | null
        }
        Relationships: []
      }
      edge_function_performance: {
        Row: {
          avg_execution_time_ms: number | null
          error_count: number | null
          function_name: string | null
          hour: string | null
          max_execution_time_ms: number | null
          success_count: number | null
          success_rate_percent: number | null
          total_calls: number | null
        }
        Relationships: []
      }
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
      persona_verification_summary: {
        Row: {
          display_name: string | null
          id: string | null
          persona_inquiry_id: string | null
          persona_liveness_score: number | null
          persona_verification_status: string | null
          persona_verified_at: string | null
          profile_created_at: string | null
          total_attempts: number | null
        }
        Insert: {
          display_name?: string | null
          id?: string | null
          persona_inquiry_id?: string | null
          persona_liveness_score?: number | null
          persona_verification_status?: string | null
          persona_verified_at?: string | null
          profile_created_at?: string | null
          total_attempts?: never
        }
        Update: {
          display_name?: string | null
          id?: string | null
          persona_inquiry_id?: string | null
          persona_liveness_score?: number | null
          persona_verification_status?: string | null
          persona_verified_at?: string | null
          profile_created_at?: string | null
          total_attempts?: never
        }
        Relationships: []
      }
      read_receipt_analytics: {
        Row: {
          date: string | null
          receipts_private: number | null
          receipts_shared: number | null
          sharing_percentage: number | null
          total_read_receipts: number | null
          unique_conversations: number | null
          unique_readers: number | null
          unique_senders: number | null
        }
        Relationships: []
      }
      schema_validation: {
        Row: {
          column_default: string | null
          column_name: unknown
          data_type: string | null
          is_nullable: string | null
          table_name: unknown
        }
        Relationships: []
      }
      secure_match_view: {
        Row: {
          compatibility_grade: string | null
          compatibility_score: number | null
          conversation_id: string | null
          id: string | null
          matched_at: string | null
          status: string | null
          user1_id: string | null
          user2_id: string | null
        }
        Insert: {
          compatibility_grade?: never
          compatibility_score?: number | null
          conversation_id?: string | null
          id?: string | null
          matched_at?: string | null
          status?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Update: {
          compatibility_grade?: never
          compatibility_score?: number | null
          conversation_id?: string | null
          id?: string | null
          matched_at?: string | null
          status?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_summary_cache"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "matches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_profile_view: {
        Row: {
          age: number | null
          avatar_url: string | null
          city: string | null
          created_at: string | null
          display_name: string | null
          education_category: string | null
          gender: string | null
          id: string | null
          interests_preview: string[] | null
          zodiac_sign: string | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          city?: never
          created_at?: string | null
          display_name?: string | null
          education_category?: never
          gender?: string | null
          id?: string | null
          interests_preview?: never
          zodiac_sign?: string | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          city?: never
          created_at?: string | null
          display_name?: string | null
          education_category?: never
          gender?: string | null
          id?: string | null
          interests_preview?: never
          zodiac_sign?: string | null
        }
        Relationships: []
      }
      service_role_security_violations: {
        Row: {
          affected_users: string[] | null
          first_violation: string | null
          function_name: string | null
          justifications_given: string[] | null
          last_violation: string | null
          operation_type: string | null
          table_accessed: string | null
          violation_count: number | null
        }
        Relationships: []
      }
      service_role_usage_summary: {
        Row: {
          function_name: string | null
          hour_bucket: string | null
          illegitimate_usage: number | null
          legitimacy_percentage: number | null
          legitimate_usage: number | null
          operation_type: string | null
          total_usage: number | null
        }
        Relationships: []
      }
      user_compatibility_cache: {
        Row: {
          calculated_at: string | null
          compatibility_score: number | null
          potential_match_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      user_engagement_stats: {
        Row: {
          daily_active_users: number | null
          day: string | null
          likes_sent: number | null
          messages_sent: number | null
          profile_views: number | null
        }
        Relationships: []
      }
      user_match_stats: {
        Row: {
          active_matches: number | null
          last_activity: string | null
          likes_received: number | null
          likes_sent: number | null
          passes_sent: number | null
          pending_requests_received: number | null
          pending_requests_sent: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_matching_summary: {
        Row: {
          activity_preferences: Json | null
          age: number | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          education_level: string | null
          gender: string | null
          id: string | null
          interests: string[] | null
          interests_count: number | null
          location: Json | null
          location_point: unknown
          looking_for: string[] | null
          max_age_pref: number | null
          max_distance_pref: number | null
          min_age_pref: number | null
          onboarding_completed: boolean | null
          preferences: Json | null
          traits: string[] | null
          zodiac_sign: string | null
        }
        Relationships: []
      }
      user_read_receipt_summary: {
        Row: {
          display_name: string | null
          read_receipts_enabled: boolean | null
          receipts_received: number | null
          receipts_shared: number | null
          total_messages_read: number | null
          total_messages_sent: number | null
          user_id: string | null
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
      add_to_swipe_cache: {
        Args: { p_swiped_user_id: string; p_swiper_id: string }
        Returns: undefined
      }
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
      analyze_cohort_segments: {
        Args: never
        Returns: {
          avg_matches: number
          avg_messages: number
          cohort_name: string
          cohort_type: string
          retention_d30: number
          retention_d7: number
          user_count: number
        }[]
      }
      anonymize_inactive_users: { Args: never; Returns: number }
      api_mark_messages_read: {
        Args: {
          p_conversation_id: string
          p_message_ids?: Json
          p_reader_id: string
        }
        Returns: Json
      }
      archive_conversation: {
        Args: { p_archive?: boolean; p_conversation_id: string }
        Returns: Json
      }
      batch_calculate_compatibility: {
        Args: { potential_match_ids: string[]; user_id: string }
        Returns: {
          combined_score: number
          compatibility_factors: Json
          match_id: string
          natal_score: number
          questionnaire_score: number
        }[]
      }
      batch_calculate_compatibility_optimized: {
        Args: { candidate_ids: string[]; target_user_id: string }
        Returns: {
          astrological_grade: string
          astrological_score: number
          calculation_time_ms: number
          combined_grade: string
          combined_score: number
          match_id: string
          meets_threshold: boolean
          priority_score: number
          questionnaire_grade: string
          questionnaire_score: number
        }[]
      }
      build_placements_from_chart: { Args: { p_chart: Json }; Returns: Json }
      bytea_to_text: { Args: { data: string }; Returns: string }
      calculate_absolute_degree: {
        Args: { degree_within_sign: number; sign_name: string }
        Returns: number
      }
      calculate_answer_similarity: {
        Args: { answer1: string; answer2: string }
        Returns: number
      }
      calculate_astrological_compatibility: {
        Args: { user_a_chart: Json; user_b_chart: Json }
        Returns: Json
      }
      calculate_avg_time_to_match: { Args: never; Returns: unknown }
      calculate_communication_compatibility: {
        Args: { match_responses: Json; user_responses: Json }
        Returns: number
      }
      calculate_compatibility_score: {
        Args: { user1_id: string; user2_id: string }
        Returns: {
          astro_details: Json
          astro_score: number
          overall_score: number
          questionnaire_details: Json
          questionnaire_score: number
        }[]
      }
      calculate_compatibility_scores: {
        Args: { user_a_id: string; user_b_id: string }
        Returns: Json
      }
      calculate_element_harmony: {
        Args: { sign1: string; sign2: string }
        Returns: number
      }
      calculate_lifestyle_match: {
        Args: { match_responses: Json; user_responses: Json }
        Returns: number
      }
      calculate_match_quality_score: { Args: never; Returns: number }
      calculate_modality_balance: {
        Args: { sign1: string; sign2: string }
        Returns: number
      }
      calculate_natal_compatibility: {
        Args: {
          match_moon: string
          match_rising: string
          match_sun: string
          user_moon: string
          user_rising: string
          user_sun: string
        }
        Returns: number
      }
      calculate_optimized_astrological_compatibility: {
        Args: {
          match_moon: string
          match_rising: string
          match_sun: string
          user_moon: string
          user_rising: string
          user_sun: string
        }
        Returns: number
      }
      calculate_optimized_questionnaire_compatibility: {
        Args: { match_responses: Json; user_responses: Json }
        Returns: number
      }
      calculate_questionnaire_category_match: {
        Args: { category: string; match_responses: Json; user_responses: Json }
        Returns: number
      }
      calculate_questionnaire_compatibility: {
        Args: { match_responses: Json; user_responses: Json }
        Returns: number
      }
      calculate_relationship_goals_match: {
        Args: { match_responses: Json; user_responses: Json }
        Returns: number
      }
      calculate_retention_cohorts: {
        Args: { days_back?: number }
        Returns: {
          cohort_date: string
          cohort_size: number
          day_1_rate: number
          day_1_retained: number
          day_30_rate: number
          day_30_retained: number
          day_7_rate: number
          day_7_retained: number
        }[]
      }
      calculate_shared_values: {
        Args: { match_responses: Json; user_responses: Json }
        Returns: number
      }
      calculate_sign_compatibility: {
        Args: { sign1: string; sign2: string }
        Returns: number
      }
      can_manage_role: {
        Args: { p_manager_id: string; p_target_role: string }
        Returns: boolean
      }
      can_users_interact: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      can_view_match_request: {
        Args: { p_request_id: string; p_user_id: string }
        Returns: boolean
      }
      check_and_update_rate_limit: {
        Args: {
          p_identifier: string
          p_limit: number
          p_reset_time: string
          p_window_start: string
        }
        Returns: Json
      }
      check_match_eligibility: {
        Args: { p_target_id: string; p_viewer_id: string }
        Returns: {
          compatibility_score: number
          is_eligible: boolean
          reason: string
        }[]
      }
      check_mutual_compatibility: {
        Args: { user_a_id: string; user_b_id: string }
        Returns: Json
      }
      check_mutual_match: {
        Args: { p_user1_id: string; p_user2_id: string }
        Returns: boolean
      }
      check_query_performance: {
        Args: never
        Returns: {
          priority: string
          suggestion: string
          table_name: string
        }[]
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_limit: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_swipe_limit: { Args: { user_id: string }; Returns: boolean }
      check_swipe_rate_limit: { Args: { user_id: string }; Returns: boolean }
      check_user_eligibility_filters: {
        Args: { target_id: string; viewer_id: string }
        Returns: Json
      }
      check_users_connected: {
        Args: { user1_id: string; user2_id: string }
        Returns: boolean
      }
      cleanup_audit_logs: { Args: never; Returns: number }
      cleanup_expired_notifications: { Args: never; Returns: number }
      cleanup_expired_rate_limits: { Args: never; Returns: number }
      cleanup_old_audit_logs: { Args: never; Returns: number }
      cleanup_old_edge_function_logs: { Args: never; Returns: number }
      cleanup_old_persona_logs: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      cleanup_old_security_events: { Args: never; Returns: undefined }
      cleanup_old_verification_logs: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      cleanup_query_cache: { Args: never; Returns: number }
      cleanup_service_role_audit: { Args: never; Returns: undefined }
      cleanup_test_data: {
        Args: { p_user_id_pattern?: string }
        Returns: number
      }
      clear_all_user_notifications: {
        Args: { p_user_id?: string }
        Returns: number
      }
      clear_user_onboarding_data: {
        Args: { user_email: string }
        Returns: string
      }
      complete_age_verification: {
        Args: {
          p_attempt_id: string
          p_document_expiry_date?: string
          p_document_type?: string
          p_fraud_indicators?: Json
          p_fraud_score?: number
          p_is_verified: boolean
          p_issuing_authority?: string
          p_manual_review_reason?: string
          p_processing_time_ms?: number
          p_requires_manual_review?: boolean
          p_verification_confidence?: number
          p_verification_provider?: string
          p_verified_age?: number
        }
        Returns: boolean
      }
      compute_age_from_text_date: {
        Args: { p_birth_date: string }
        Returns: number
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
      consume_invite: {
        Args: { user_uuid: string }
        Returns: {
          remaining_after: number
          subscription_status: string
          success: boolean
        }[]
      }
      create_match_from_request: {
        Args: { p_match_request_id: string }
        Returns: string
      }
      create_message_and_update_conversation: {
        Args: {
          p_content: string
          p_conversation_id: string
          p_media_type?: string
          p_media_url?: string
          p_sender_id: string
        }
        Returns: string
      }
      create_secure_match_request: {
        Args: {
          p_compatibility_score?: number
          p_matched_user_id: string
          p_requester_id: string
        }
        Returns: Json
      }
      current_user_dashboard_role: { Args: never; Returns: string }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      delete_conversation: {
        Args: { p_conversation_id: string; p_hard_delete?: boolean }
        Returns: Json
      }
      disablelongtransactions: { Args: never; Returns: string }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
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
      element_of: { Args: { sign: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      encrypt_user_birth_data: { Args: { p_user_id: string }; Returns: boolean }
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
      ensure_profile_exists: { Args: { user_id: string }; Returns: boolean }
      ensure_user_exists: { Args: { user_id: string }; Returns: boolean }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_user_roles: { Args: never; Returns: undefined }
      extract_planets_from_natal_chart: {
        Args: { p_chart: Json }
        Returns: Json
      }
      extract_questionnaire_answer: {
        Args: { question_index: number; responses: Json }
        Returns: number
      }
      generate_test_user: {
        Args: {
          p_activity_prefs?: Json
          p_age: number
          p_display_name: string
          p_gender: string
          p_lat?: number
          p_lng?: number
          p_looking_for: string[]
          p_user_id: string
          p_zodiac_sign: string
        }
        Returns: undefined
      }
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
      get_active_subscriptions: {
        Args: { user_uuid: string }
        Returns: {
          expires_date: string
          product_id: string
          status: string
          subscription_id: string
          will_renew: boolean
        }[]
      }
      get_all_thresholds: { Args: never; Returns: Json }
      get_app_setting: { Args: { setting_key: string }; Returns: string }
      get_cached_query: {
        Args: { p_cache_key: string; p_ttl_seconds?: number }
        Returns: Json
      }
      get_cached_user_settings: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_compatibility_performance_stats: {
        Args: { lookback_hours?: number }
        Returns: {
          avg_batch_size: number
          avg_cache_hit_rate: number
          avg_calculation_time_ms: number
          p95_calculation_time_ms: number
          success_rate: number
          total_calculations: number
        }[]
      }
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
      get_conversations_with_cursor: {
        Args: { p_cursor?: string; p_limit?: number }
        Returns: {
          created_at: string
          has_more: boolean
          id: string
          last_message_at: string
          last_message_preview: string
          next_cursor: string
          participant_1_id: string
          participant_2_id: string
          unread_count: number
        }[]
      }
      get_dashboard_metrics: { Args: { days_back?: number }; Returns: Json }
      get_database_performance_metrics: {
        Args: never
        Returns: {
          description: string
          metric_name: string
          metric_value: number
          unit: string
        }[]
      }
      get_decrypted_birth_data: { Args: { p_user_id: string }; Returns: Json }
      get_decrypted_natal_chart: { Args: { p_user_id: string }; Returns: Json }
      get_element_compatibility: {
        Args: { sign1: string; sign2: string }
        Returns: number
      }
      get_filtered_potential_matches: {
        Args: {
          exclude_user_ids?: string[]
          limit_count?: number
          max_age_filter?: number
          min_age_filter?: number
          offset_count?: number
          viewer_id: string
          zodiac_filter?: string
        }
        Returns: {
          age: number
          avatar_url: string
          display_name: string
          education_level: string
          gender: string
          id: string
          interests: string[]
          traits: string[]
          zodiac_sign: string
        }[]
      }
      get_invite_status: {
        Args: { user_uuid: string }
        Returns: {
          is_premium: boolean
          last_reset: string
          needs_reset: boolean
          remaining: number
          total: number
        }[]
      }
      get_match_status_fast: {
        Args: { p_user1_id: string; p_user2_id: string }
        Returns: {
          has_pending_request: boolean
          has_swiped: boolean
          is_matched: boolean
          match_id: string
          request_id: string
          swipe_type: string
        }[]
      }
      get_matched_profile: {
        Args: { profile_id: string }
        Returns: {
          age: number
          avatar_url: string
          bio: string
          compatibility_score: number
          created_at: string
          display_name: string
          gender: string
          id: string
          location: Json
          looking_for: string
          match_id: string
          matched_at: string
          username: string
          zodiac_sign: string
        }[]
      }
      get_messages_with_cursor: {
        Args: {
          p_conversation_id: string
          p_cursor?: string
          p_direction?: string
          p_limit?: number
        }
        Returns: {
          content: string
          conversation_id: string
          created_at: string
          has_more: boolean
          id: string
          message_type: string
          next_cursor: string
          sender_id: string
        }[]
      }
      get_or_create_match: {
        Args: {
          p_match_request_id?: string
          p_user1_id: string
          p_user2_id: string
        }
        Returns: string
      }
      get_persona_verification_statistics: {
        Args: never
        Returns: {
          avg_liveness_score: number
          failed_verifications: number
          in_progress: number
          last_24h_verifications: number
          not_started: number
          pending_verifications: number
          total_users: number
          verification_rate: number
          verified_users: number
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
      get_retention_curve_data: { Args: { days_back?: number }; Returns: Json }
      get_secure_potential_matches: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          age: number
          avatar_url: string
          city: string
          compatibility_grade: string
          compatibility_score: number
          display_name: string
          gender: string
          id: string
          interests_preview: string[]
          zodiac_sign: string
        }[]
      }
      get_secure_user_matches: {
        Args: { p_user_id: string }
        Returns: {
          compatibility_grade: string
          conversation_id: string
          last_message_at: string
          last_message_preview: string
          match_id: string
          matched_at: string
          other_user_avatar: string
          other_user_id: string
          other_user_name: string
          unread_count: number
        }[]
      }
      get_security_dashboard_metrics: {
        Args: { time_range?: unknown }
        Returns: Json
      }
      get_settings_usage_stats: { Args: never; Returns: Json }
      get_sign: { Args: { body_name: string; j: Json }; Returns: string }
      get_sign_compatibility: {
        Args: { sign1: string; sign2: string }
        Returns: number
      }
      get_threshold_history: {
        Args: { p_limit?: number; p_metric_name?: string }
        Returns: Json
      }
      get_unread_notification_count: {
        Args: { p_user_id?: string }
        Returns: number
      }
      get_user_conversations: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          id: string
          last_message_at: string
          last_message_content: string
          other_participant: Json
          updated_at: string
          user1_id: string
          user2_id: string
        }[]
      }
      get_user_conversations_optimized: {
        Args: { limit_count?: number; offset_count?: number; user_id: string }
        Returns: {
          conversation_id: string
          last_message_at: string
          last_message_content: string
          other_user_avatar: string
          other_user_id: string
          other_user_name: string
          total_messages: number
          unread_count: number
        }[]
      }
      get_user_conversations_with_details: {
        Args: { p_user_id: string }
        Returns: {
          conversation_created_at: string
          conversation_id: string
          conversation_updated_at: string
          last_message_at: string
          last_message_preview: string
          match_id: string
          other_participant_avatar_url: string
          other_participant_display_name: string
          other_participant_id: string
        }[]
      }
      get_user_exclusion_list: { Args: { user_id: string }; Returns: string[] }
      get_user_matching_preferences: {
        Args: { target_user_id: string }
        Returns: {
          discovery_enabled: boolean
          gender_preference: string
          incognito_mode: boolean
          max_age_preference: number
          max_height_preference: number
          min_age_preference: number
          min_height_preference: number
          preferred_distance_km: number
          user_id: string
          zodiac_compatibility_required: boolean
        }[]
      }
      get_user_notification_preferences: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_user_preferences: { Args: { user_id: string }; Returns: Json }
      get_user_privacy_settings: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_user_risk_assessment: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_user_role: {
        Args: { p_user_id: string }
        Returns: {
          permissions: Json
          role_level: number
          role_name: string
        }[]
      }
      get_user_role_level: { Args: { user_id: string }; Returns: number }
      get_user_settings: { Args: { target_user_id: string }; Returns: Json }
      get_verification_statistics: {
        Args: never
        Returns: {
          avg_confidence: number
          manual_review_queue_size: number
          pending_review: number
          rejected_profiles: number
          total_profiles: number
          unverified_profiles: number
          verification_rate: number
          verified_profiles: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      handle_underage_user_detection: {
        Args: {
          p_block_reason: string
          p_detected_age: number
          p_detection_method: string
          p_device_fingerprint?: string
          p_ip_address?: unknown
          p_user_id: string
        }
        Returns: undefined
      }
      has_active_match_context: {
        Args: { p_target_id: string; p_viewer_id: string }
        Returns: boolean
      }
      has_active_premium: { Args: { user_uuid: string }; Returns: boolean }
      has_any_permission: {
        Args: { p_permissions: string[]; p_user_id: string }
        Returns: boolean
      }
      has_invites_available: { Args: { user_uuid: string }; Returns: boolean }
      has_permission: {
        Args: { p_permission: string; p_user_id: string }
        Returns: boolean
      }
      health_check_edge_functions: { Args: never; Returns: Json }
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
      is_active_dashboard_admin: { Args: { p_user: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_conversation_participant_secure: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_legitimate_service_role_operation: {
        Args: {
          operation_type: string
          table_name: string
          user_context?: string
        }
        Returns: boolean
      }
      is_match_participant: {
        Args: { p_match_id: string; p_user_id: string }
        Returns: boolean
      }
      is_profile_complete: { Args: { user_id: string }; Returns: boolean }
      is_user_discoverable: {
        Args: { target_user_id: string; viewing_user_id?: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_context?: Json
          p_error_message?: string
          p_operation_type: string
          p_record_id?: string
          p_table_name?: string
        }
        Returns: string
      }
      log_compatibility_performance: {
        Args: {
          p_batch_size: number
          p_cache_hit_rate: number
          p_calculation_time_ms: number
          p_error_count?: number
          p_user_id: string
        }
        Returns: undefined
      }
      log_edge_function_performance: {
        Args: {
          p_error_message?: string
          p_execution_time_ms?: number
          p_function_name: string
          p_request_params?: Json
          p_response_size?: number
          p_status_code?: number
          p_user_id?: string
        }
        Returns: string
      }
      log_security_event:
        | {
            Args: {
              p_event_category: string
              p_event_details?: Json
              p_event_type: string
              p_ip_address?: unknown
              p_request_headers?: Json
              p_request_method?: string
              p_request_path?: string
              p_response_code?: number
              p_session_id?: string
              p_severity?: string
              p_threat_score?: number
              p_user_agent?: string
              p_user_id?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_action: string
              p_metadata?: Json
              p_resource_id?: string
              p_resource_type: string
            }
            Returns: undefined
          }
        | {
            Args: { p_details?: Json; p_event_type: string; p_user_id: string }
            Returns: undefined
          }
      log_service_role_usage: {
        Args: {
          client_ip?: string
          function_name: string
          justification?: string
          operation_type: string
          request_id?: string
          table_accessed?: string
          user_context?: string
        }
        Returns: undefined
      }
      log_settings_change: {
        Args: {
          change_source?: string
          changed_fields: Json
          ip_address?: unknown
          new_values: Json
          previous_values: Json
          target_user_id: string
          user_agent?: string
        }
        Returns: string
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
      mark_notification_read: {
        Args: {
          p_device_type?: string
          p_notification_id: string
          p_session_id?: string
          p_user_id?: string
        }
        Returns: boolean
      }
      mark_view_for_refresh: {
        Args: { p_view_name: string }
        Returns: undefined
      }
      migrate_existing_user_settings: { Args: never; Returns: number }
      optimize_matching_session: { Args: never; Returns: undefined }
      pair_score: { Args: { a: string; b: string }; Returns: number }
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
      record_performance_metric: {
        Args: {
          p_endpoint?: string
          p_metadata?: Json
          p_metric_name: string
          p_metric_unit: string
          p_metric_value: number
        }
        Returns: undefined
      }
      refresh_conversation_summary_cache: { Args: never; Returns: undefined }
      refresh_match_compatibility_cache: { Args: never; Returns: undefined }
      refresh_match_stats: { Args: never; Returns: undefined }
      refresh_retention_cohorts: { Args: never; Returns: number }
      refresh_swipe_exclusion_cache: { Args: never; Returns: undefined }
      refresh_user_compatibility_cache: {
        Args: { p_user_id: string }
        Returns: number
      }
      refresh_user_matching_summary: { Args: never; Returns: undefined }
      sanitize_user_input: { Args: { p_input: string }; Returns: string }
      score_to_grade: { Args: { score: number }; Returns: string }
      search_discoverable_profiles: {
        Args: {
          p_gender?: string
          p_limit?: number
          p_looking_for?: string
          p_max_age?: number
          p_max_distance_km?: number
          p_min_age?: number
          p_offset?: number
          p_user_location?: Json
          p_zodiac_sign?: string
        }
        Returns: {
          age: number
          bio_preview: string
          display_name: string
          distance_km: number
          gender: string
          id: string
          location_display: string
          photo_url: string
          zodiac_sign: string
        }[]
      }
      send_secure_message: {
        Args: {
          p_content: string
          p_conversation_id: string
          p_message_type?: string
          p_sender_id: string
        }
        Returns: Json
      }
      set_cached_query: {
        Args: {
          p_cache_key: string
          p_result_data: Json
          p_ttl_seconds?: number
        }
        Returns: undefined
      }
      should_send_notification: {
        Args: { notification_type?: string; target_user_id: string }
        Returns: boolean
      }
      should_share_read_receipt: {
        Args: { reader_id: string; sender_id: string }
        Returns: boolean
      }
      soundex: { Args: { "": string }; Returns: string }
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
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
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
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
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
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
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
      start_age_verification: {
        Args: {
          p_device_fingerprint?: string
          p_geolocation?: Json
          p_ip_address?: unknown
          p_session_id: string
          p_user_agent?: string
          p_user_id: string
          p_verification_method: string
        }
        Returns: string
      }
      store_encrypted_natal_chart: {
        Args: {
          p_calculation_metadata?: Json
          p_chart_data: Json
          p_user_id: string
        }
        Returns: string
      }
      test_alert_threshold: {
        Args: { p_metric_name: string; p_test_value: number }
        Returns: Json
      }
      text_soundex: { Args: { "": string }; Returns: string }
      text_to_bytea: { Args: { data: string }; Returns: string }
      track_profile_view: { Args: { profile_id: string }; Returns: undefined }
      track_slow_query: {
        Args: {
          p_duration_ms: number
          p_query_name: string
          p_query_params?: Json
        }
        Returns: undefined
      }
      unlockrows: { Args: { "": string }; Returns: number }
      unmatch_users: {
        Args: {
          p_metadata?: Json
          p_other_user_id: string
          p_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      update_persona_verification_status: {
        Args: {
          p_inquiry_id: string
          p_liveness_score?: number
          p_status: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_threshold_with_audit: {
        Args: {
          p_change_reason?: string
          p_critical_threshold?: number
          p_metadata?: Json
          p_metric_name: string
          p_warning_threshold?: number
        }
        Returns: Json
      }
      update_user_preferences: {
        Args: { new_preferences: Json; user_id: string }
        Returns: Json
      }
      update_user_settings: {
        Args: { settings_update: Json; target_user_id: string }
        Returns: Json
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
      user_has_permission: {
        Args: { permission: string; user_id: string }
        Returns: boolean
      }
      validate_current_service_role_usage: {
        Args: never
        Returns: {
          function_name: string
          issue_description: string
          issue_severity: string
          recommendation: string
        }[]
      }
      validate_profile_security: { Args: { p_user_id: string }; Returns: Json }
      validate_rls_coverage: {
        Args: never
        Returns: {
          has_delete_policy: boolean
          has_insert_policy: boolean
          has_select_policy: boolean
          has_update_policy: boolean
          policy_count: number
          rls_enabled: boolean
          security_status: string
          table_name: string
        }[]
      }
      validate_settings_update: {
        Args: { settings_update: Json; target_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      audit_operation_type:
        | "match_request_created"
        | "match_request_updated"
        | "match_request_deleted"
        | "match_created"
        | "match_updated"
        | "match_deleted"
        | "conversation_created"
        | "conversation_updated"
        | "conversation_deleted"
        | "message_sent"
        | "message_deleted"
        | "message_created"
        | "swipe_recorded"
        | "swipe_created"
        | "swipe_deleted"
        | "profile_updated"
        | "auth_login"
        | "auth_logout"
        | "subscription_changed"
        | "error_occurred"
        | "audit_cleanup"
        | "profile_view"
      dashboard_admin_role: "super_admin" | "operator" | "analyst" | "read_only"
      notification_priority: "low" | "normal" | "high" | "critical"
      notification_status: "pending" | "sent" | "delivered" | "read" | "failed"
      notification_type:
        | "new_match"
        | "new_message"
        | "profile_view"
        | "super_like"
        | "date_reminder"
        | "system_announcement"
        | "security_alert"
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
  public: {
    Enums: {
      audit_operation_type: [
        "match_request_created",
        "match_request_updated",
        "match_request_deleted",
        "match_created",
        "match_updated",
        "match_deleted",
        "conversation_created",
        "conversation_updated",
        "conversation_deleted",
        "message_sent",
        "message_deleted",
        "message_created",
        "swipe_recorded",
        "swipe_created",
        "swipe_deleted",
        "profile_updated",
        "auth_login",
        "auth_logout",
        "subscription_changed",
        "error_occurred",
        "audit_cleanup",
        "profile_view",
      ],
      dashboard_admin_role: ["super_admin", "operator", "analyst", "read_only"],
      notification_priority: ["low", "normal", "high", "critical"],
      notification_status: ["pending", "sent", "delivered", "read", "failed"],
      notification_type: [
        "new_match",
        "new_message",
        "profile_view",
        "super_like",
        "date_reminder",
        "system_announcement",
        "security_alert",
      ],
    },
  },
} as const
