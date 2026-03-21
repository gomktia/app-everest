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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      abandoned_carts: {
        Row: {
          abandoned_at: string | null
          created_at: string | null
          email: string
          id: string
          products: Json
          recovered_order_id: string | null
          recovery_email_sent: boolean | null
          recovery_token: string | null
          stripe_checkout_session_id: string | null
          total_cents: number
        }
        Insert: {
          abandoned_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          products: Json
          recovered_order_id?: string | null
          recovery_email_sent?: boolean | null
          recovery_token?: string | null
          stripe_checkout_session_id?: string | null
          total_cents: number
        }
        Update: {
          abandoned_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          products?: Json
          recovered_order_id?: string | null
          recovery_email_sent?: boolean | null
          recovery_token?: string | null
          stripe_checkout_session_id?: string | null
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_recovered_order_id_fkey"
            columns: ["recovered_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      acervo_items: {
        Row: {
          banca: string | null
          category: string
          concurso: string | null
          created_at: string | null
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          questions_count: number | null
          questions_extracted: boolean | null
          subcategory: string | null
          title: string
          year: number | null
        }
        Insert: {
          banca?: string | null
          category: string
          concurso?: string | null
          created_at?: string | null
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          questions_count?: number | null
          questions_extracted?: boolean | null
          subcategory?: string | null
          title: string
          year?: number | null
        }
        Update: {
          banca?: string | null
          category?: string
          concurso?: string | null
          created_at?: string | null
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          questions_count?: number | null
          questions_extracted?: boolean | null
          subcategory?: string | null
          title?: string
          year?: number | null
        }
        Relationships: []
      }
      achievements: {
        Row: {
          category: string | null
          created_at: string
          description: string
          icon_url: string | null
          id: string
          name: string
          xp_reward: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          icon_url?: string | null
          id?: string
          name: string
          xp_reward?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          icon_url?: string | null
          id?: string
          name?: string
          xp_reward?: number | null
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          approved_at: string | null
          commission_cents: number
          created_at: string | null
          id: string
          order_id: string
          paid_at: string | null
          reversed_at: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          approved_at?: string | null
          commission_cents: number
          created_at?: string | null
          id?: string
          order_id: string
          paid_at?: string | null
          reversed_at?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          approved_at?: string | null
          commission_cents?: number
          created_at?: string | null
          id?: string
          order_id?: string
          paid_at?: string | null
          reversed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          commission_percent: number
          created_at: string | null
          id: string
          is_active: boolean | null
          total_earned_cents: number | null
          total_paid_cents: number | null
          user_id: string
        }
        Insert: {
          affiliate_code: string
          commission_percent?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          total_earned_cents?: number | null
          total_paid_cents?: number | null
          user_id: string
        }
        Update: {
          affiliate_code?: string
          commission_percent?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          total_earned_cents?: number | null
          total_paid_cents?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_configs: {
        Row: {
          api_key: string | null
          base_url: string | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          display_name: string
          id: string
          is_active: boolean | null
          model_name: string | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          model_name?: string | null
          provider: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          model_name?: string | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          cost_estimate_brl: number | null
          created_at: string | null
          feature: string
          id: string
          metadata: Json | null
          model: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          cost_estimate_brl?: number | null
          created_at?: string | null
          feature: string
          id?: string
          metadata?: Json | null
          model?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          cost_estimate_brl?: number | null
          created_at?: string | null
          feature?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_courses: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          thumbnail_url: string | null
          total_duration_seconds: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          thumbnail_url?: string | null
          total_duration_seconds?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          thumbnail_url?: string | null
          total_duration_seconds?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      audio_lessons: {
        Row: {
          audio_source_type:
            | Database["public"]["Enums"]["audio_source_provider"]
            | null
          audio_source_url: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_active: boolean
          is_preview: boolean
          module_id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          audio_source_type?:
            | Database["public"]["Enums"]["audio_source_provider"]
            | null
          audio_source_url: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_preview?: boolean
          module_id: string
          order_index: number
          title: string
          updated_at?: string
        }
        Update: {
          audio_source_type?:
            | Database["public"]["Enums"]["audio_source_provider"]
            | null
          audio_source_url?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_preview?: boolean
          module_id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_audio_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "audio_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
          total_duration_seconds: number | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index: number
          total_duration_seconds?: number | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          total_duration_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_audio_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "audio_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_time_seconds: number
          id: string
          is_completed: boolean
          lesson_id: string
          progress_percentage: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_time_seconds: number
          id?: string
          is_completed?: boolean
          lesson_id: string
          progress_percentage: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_time_seconds?: number
          id?: string
          is_completed?: boolean
          lesson_id?: string
          progress_percentage?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_audio_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "audio_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          end_time: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          related_entity_id: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          related_entity_id?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          related_entity_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      circuit_breaker_state: {
        Row: {
          failure_count: number | null
          last_failure_at: string | null
          opened_at: string | null
          service: string
          state: string
          updated_at: string | null
        }
        Insert: {
          failure_count?: number | null
          last_failure_at?: string | null
          opened_at?: string | null
          service: string
          state?: string
          updated_at?: string | null
        }
        Update: {
          failure_count?: number | null
          last_failure_at?: string | null
          opened_at?: string | null
          service?: string
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      class_content_access: {
        Row: {
          class_id: string
          content_id: string
          content_type: string
          created_at: string | null
          id: string
        }
        Insert: {
          class_id: string
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
        }
        Update: {
          class_id?: string
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_content_access_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_courses: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          class_id: string
          course_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          class_id: string
          course_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          class_id?: string
          course_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_courses_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "video_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      class_feature_permissions: {
        Row: {
          class_id: string
          created_at: string
          feature_key: string
          id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          feature_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          feature_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_feature_permissions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_lesson_rules: {
        Row: {
          class_id: string
          created_at: string | null
          id: string
          lesson_id: string
          rule_type: string
          rule_value: string | null
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          id?: string
          lesson_id: string
          rule_type?: string
          rule_value?: string | null
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          id?: string
          lesson_id?: string
          rule_type?: string
          rule_value?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_lesson_rules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_lesson_rules_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      class_module_rules: {
        Row: {
          class_id: string
          created_at: string | null
          id: string
          module_id: string
          rule_type: string
          rule_value: string | null
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          id?: string
          module_id: string
          rule_type?: string
          rule_value?: string | null
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          id?: string
          module_id?: string
          rule_type?: string
          rule_value?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_module_rules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_module_rules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "video_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          access_duration_days: number | null
          class_type: Database["public"]["Enums"]["class_type"]
          created_at: string
          description: string | null
          end_date: string | null
          external_id: string | null
          id: string
          is_default: boolean | null
          name: string
          start_date: string
          status: string
          teacher_id: string
          trial_duration_days: number | null
          trial_essay_submission_limit: number | null
          trial_flashcard_limit_per_day: number | null
          trial_quiz_limit_per_day: number | null
          updated_at: string
        }
        Insert: {
          access_duration_days?: number | null
          class_type?: Database["public"]["Enums"]["class_type"]
          created_at?: string
          description?: string | null
          end_date?: string | null
          external_id?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          start_date: string
          status?: string
          teacher_id: string
          trial_duration_days?: number | null
          trial_essay_submission_limit?: number | null
          trial_flashcard_limit_per_day?: number | null
          trial_quiz_limit_per_day?: number | null
          updated_at?: string
        }
        Update: {
          access_duration_days?: number | null
          class_type?: Database["public"]["Enums"]["class_type"]
          created_at?: string
          description?: string | null
          end_date?: string | null
          external_id?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          start_date?: string
          status?: string
          teacher_id?: string
          trial_duration_days?: number | null
          trial_essay_submission_limit?: number | null
          trial_flashcard_limit_per_day?: number | null
          trial_quiz_limit_per_day?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      community_attachments: {
        Row: {
          comment_id: string | null
          created_at: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          mime_type: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          mime_type: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          mime_type?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_best_answer: boolean | null
          is_official: boolean | null
          likes_count: number | null
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_best_answer?: boolean | null
          is_official?: boolean | null
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_best_answer?: boolean | null
          is_official?: boolean | null
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_topic_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_mutes: {
        Row: {
          created_at: string | null
          id: string
          muted_by: string
          muted_until: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          muted_by: string
          muted_until: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          muted_by?: string
          muted_until?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      community_poll_options: {
        Row: {
          id: string
          order: number | null
          post_id: string
          text: string
          votes_count: number | null
        }
        Insert: {
          id?: string
          order?: number | null
          post_id: string
          text: string
          votes_count?: number | null
        }
        Update: {
          id?: string
          order?: number | null
          post_id?: string
          text?: string
          votes_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_poll_options_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_poll_votes: {
        Row: {
          created_at: string | null
          id: string
          option_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "community_poll_options"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string
          id: string
          is_locked: boolean | null
          is_pinned: boolean | null
          is_resolved: boolean | null
          likes_count: number | null
          link_preview: Json | null
          mentions: string[] | null
          resolved_at: string | null
          resolved_by: string | null
          space_id: string | null
          title: string
          type: string | null
          updated_at: string
          user_id: string
          views: number | null
          xp_awarded: number | null
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          likes_count?: number | null
          link_preview?: Json | null
          mentions?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          space_id?: string | null
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
          views?: number | null
          xp_awarded?: number | null
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          is_resolved?: boolean | null
          likes_count?: number | null
          link_preview?: Json | null
          mentions?: string[] | null
          resolved_at?: string | null
          resolved_by?: string | null
          space_id?: string | null
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string
          views?: number | null
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_topics_category_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "community_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      community_reports: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_reporter_id_users_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_reporter_id_users_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_reviewed_by_users_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_reviewed_by_users_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_spaces: {
        Row: {
          class_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          name: string
          order: number | null
          slug: string
          space_type: string | null
        }
        Insert: {
          class_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          order?: number | null
          slug: string
          space_type?: string | null
        }
        Update: {
          class_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          order?: number | null
          slug?: string
          space_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_spaces_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      community_word_filter: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          word: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          word: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          word?: string
        }
        Relationships: []
      }
      correction_templates: {
        Row: {
          content_criteria: Json
          correction_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          expression_debit_value: number
          id: string
          is_default: boolean | null
          max_grade: number
          name: string
          structure_criteria: Json
          updated_at: string | null
        }
        Insert: {
          content_criteria: Json
          correction_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expression_debit_value?: number
          id?: string
          is_default?: boolean | null
          max_grade?: number
          name: string
          structure_criteria: Json
          updated_at?: string | null
        }
        Update: {
          content_criteria?: Json
          correction_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expression_debit_value?: number
          id?: string
          is_default?: boolean | null
          max_grade?: number
          name?: string
          structure_criteria?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          applicable_products: string[] | null
          code: string
          created_at: string | null
          current_uses: number | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          stripe_coupon_id: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_products?: string[] | null
          code: string
          created_at?: string | null
          current_uses?: number | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          stripe_coupon_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_products?: string[] | null
          code?: string
          created_at?: string | null
          current_uses?: number | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          stripe_coupon_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      error_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      essay_annotations: {
        Row: {
          annotation_text: string
          created_at: string
          end_offset: number
          error_category_id: string | null
          essay_id: string
          id: string
          start_offset: number
          suggested_correction: string | null
          teacher_id: string | null
        }
        Insert: {
          annotation_text: string
          created_at?: string
          end_offset: number
          error_category_id?: string | null
          essay_id: string
          id?: string
          start_offset: number
          suggested_correction?: string | null
          teacher_id?: string | null
        }
        Update: {
          annotation_text?: string
          created_at?: string
          end_offset?: number
          error_category_id?: string | null
          essay_id?: string
          id?: string
          start_offset?: number
          suggested_correction?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_essay_annotations_error_category_id_fkey"
            columns: ["error_category_id"]
            isOneToOne: false
            referencedRelation: "error_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_essay_annotations_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_competency_scores: {
        Row: {
          competency_name: string
          competency_number: number
          created_at: string | null
          created_by: string | null
          essay_id: string
          id: string
          justification: string | null
          max_score: number
          score: number
          source: string
        }
        Insert: {
          competency_name: string
          competency_number: number
          created_at?: string | null
          created_by?: string | null
          essay_id: string
          id?: string
          justification?: string | null
          max_score?: number
          score?: number
          source?: string
        }
        Update: {
          competency_name?: string
          competency_number?: number
          created_at?: string | null
          created_by?: string | null
          essay_id?: string
          id?: string
          justification?: string | null
          max_score?: number
          score?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_competency_scores_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_content_analysis: {
        Row: {
          analysis_text: string
          created_at: string | null
          created_by: string | null
          criterion_description: string | null
          criterion_name: string
          criterion_type: string
          debit_level: string
          debit_value: number
          essay_id: string
          id: string
          source: string
        }
        Insert: {
          analysis_text: string
          created_at?: string | null
          created_by?: string | null
          criterion_description?: string | null
          criterion_name: string
          criterion_type: string
          debit_level: string
          debit_value: number
          essay_id: string
          id?: string
          source?: string
        }
        Update: {
          analysis_text?: string
          created_at?: string | null
          created_by?: string | null
          criterion_description?: string | null
          criterion_name?: string
          criterion_type?: string
          debit_level?: string
          debit_value?: number
          essay_id?: string
          id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_content_analysis_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_expression_errors: {
        Row: {
          created_at: string | null
          created_by: string | null
          debit_value: number
          error_explanation: string
          error_text: string
          essay_id: string
          id: string
          paragraph_number: number
          sentence_number: number
          source: string
          suggested_correction: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          debit_value: number
          error_explanation: string
          error_text: string
          essay_id: string
          id?: string
          paragraph_number: number
          sentence_number: number
          source?: string
          suggested_correction: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          debit_value?: number
          error_explanation?: string
          error_text?: string
          essay_id?: string
          id?: string
          paragraph_number?: number
          sentence_number?: number
          source?: string
          suggested_correction?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_expression_errors_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_improvement_suggestions: {
        Row: {
          category: string
          created_at: string | null
          essay_id: string
          id: string
          suggestion_text: string
        }
        Insert: {
          category: string
          created_at?: string | null
          essay_id: string
          id?: string
          suggestion_text: string
        }
        Update: {
          category?: string
          created_at?: string | null
          essay_id?: string
          id?: string
          suggestion_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_improvement_suggestions_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_prompts: {
        Row: {
          course_id: string | null
          created_at: string
          created_by_user_id: string | null
          criteria_template_id: string | null
          description: string
          end_date: string | null
          evaluation_criteria: Json
          id: string
          is_active: boolean | null
          start_date: string | null
          subject_id: string | null
          suggested_repertoire: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          criteria_template_id?: string | null
          description: string
          end_date?: string | null
          evaluation_criteria: Json
          id?: string
          is_active?: boolean | null
          start_date?: string | null
          subject_id?: string | null
          suggested_repertoire?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          criteria_template_id?: string | null
          description?: string
          end_date?: string | null
          evaluation_criteria?: Json
          id?: string
          is_active?: boolean | null
          start_date?: string | null
          subject_id?: string | null
          suggested_repertoire?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_prompts_criteria_template_id_fkey"
            columns: ["criteria_template_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_essay_prompts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_essay_prompts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_structure_analysis: {
        Row: {
          analysis_text: string
          created_at: string | null
          created_by: string | null
          debit_value: number
          essay_id: string
          expected_structure: Json | null
          id: string
          paragraph_number: number
          paragraph_type: string
          source: string
        }
        Insert: {
          analysis_text: string
          created_at?: string | null
          created_by?: string | null
          debit_value?: number
          essay_id: string
          expected_structure?: Json | null
          id?: string
          paragraph_number: number
          paragraph_type: string
          source?: string
        }
        Update: {
          analysis_text?: string
          created_at?: string | null
          created_by?: string | null
          debit_value?: number
          essay_id?: string
          expected_structure?: Json | null
          id?: string
          paragraph_number?: number
          paragraph_type?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_structure_analysis_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essays: {
        Row: {
          ai_analysis: Json | null
          ai_correction_raw: Json | null
          ai_suggested_grade: Json | null
          annotated_text_html: string | null
          annotation_image_url: string | null
          content_debit_total: number | null
          corrected_file_url: string | null
          correction_date: string | null
          correction_template_id: string | null
          correction_type: string | null
          created_at: string
          expression_debit_total: number | null
          file_url: string | null
          final_grade: number | null
          final_grade_ciaar: number | null
          final_grade_enem: number | null
          id: string
          prompt_id: string
          status: Database["public"]["Enums"]["essay_status_enum"] | null
          structure_debit_total: number | null
          student_id: string
          submission_date: string
          submission_text: string
          teacher_feedback_audio_url: string | null
          teacher_feedback_text: string | null
          teacher_id: string | null
          transcribed_text: string | null
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_correction_raw?: Json | null
          ai_suggested_grade?: Json | null
          annotated_text_html?: string | null
          annotation_image_url?: string | null
          content_debit_total?: number | null
          corrected_file_url?: string | null
          correction_date?: string | null
          correction_template_id?: string | null
          correction_type?: string | null
          created_at?: string
          expression_debit_total?: number | null
          file_url?: string | null
          final_grade?: number | null
          final_grade_ciaar?: number | null
          final_grade_enem?: number | null
          id?: string
          prompt_id: string
          status?: Database["public"]["Enums"]["essay_status_enum"] | null
          structure_debit_total?: number | null
          student_id: string
          submission_date?: string
          submission_text: string
          teacher_feedback_audio_url?: string | null
          teacher_feedback_text?: string | null
          teacher_id?: string | null
          transcribed_text?: string | null
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_correction_raw?: Json | null
          ai_suggested_grade?: Json | null
          annotated_text_html?: string | null
          annotation_image_url?: string | null
          content_debit_total?: number | null
          corrected_file_url?: string | null
          correction_date?: string | null
          correction_template_id?: string | null
          correction_type?: string | null
          created_at?: string
          expression_debit_total?: number | null
          file_url?: string | null
          final_grade?: number | null
          final_grade_ciaar?: number | null
          final_grade_enem?: number | null
          id?: string
          prompt_id?: string
          status?: Database["public"]["Enums"]["essay_status_enum"] | null
          structure_debit_total?: number | null
          student_id?: string
          submission_date?: string
          submission_text?: string
          teacher_feedback_audio_url?: string | null
          teacher_feedback_text?: string | null
          teacher_id?: string | null
          transcribed_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "essays_correction_template_id_fkey"
            columns: ["correction_template_id"]
            isOneToOne: false
            referencedRelation: "correction_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_essays_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "essay_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_criteria_templates: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          criteria: Json
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          criteria: Json
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          criteria?: Json
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      flashcard_progress: {
        Row: {
          confidence_rating: number | null
          created_at: string
          ease_factor: number
          flashcard_id: string
          id: string
          interval_days: number
          last_reviewed_at: string
          next_review_at: string
          quality: number
          repetitions: number
          response_time_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_rating?: number | null
          created_at?: string
          ease_factor?: number
          flashcard_id: string
          id?: string
          interval_days: number
          last_reviewed_at?: string
          next_review_at: string
          quality: number
          repetitions: number
          response_time_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_rating?: number | null
          created_at?: string
          ease_factor?: number
          flashcard_id?: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string
          next_review_at?: string
          quality?: number
          repetitions?: number
          response_time_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_flashcard_progress_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_session_history: {
        Row: {
          cards_reviewed: number | null
          correct_answers: number | null
          ended_at: string | null
          group_session_id: string | null
          id: string
          incorrect_answers: number | null
          session_mode: string
          started_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          cards_reviewed?: number | null
          correct_answers?: number | null
          ended_at?: string | null
          group_session_id?: string | null
          id?: string
          incorrect_answers?: number | null
          session_mode: string
          started_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          cards_reviewed?: number | null
          correct_answers?: number | null
          ended_at?: string | null
          group_session_id?: string | null
          id?: string
          incorrect_answers?: number | null
          session_mode?: string
          started_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_session_history_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          acervo_item_id: string | null
          answer: string
          created_at: string
          created_by_user_id: string
          difficulty: number
          explanation: string | null
          external_resource_url: string | null
          flashcard_set_id: string | null
          id: string
          question: string
          source_banca: string | null
          source_exam: string | null
          source_type: string | null
          source_year: number | null
          topic_id: string
          updated_at: string
        }
        Insert: {
          acervo_item_id?: string | null
          answer: string
          created_at?: string
          created_by_user_id: string
          difficulty?: number
          explanation?: string | null
          external_resource_url?: string | null
          flashcard_set_id?: string | null
          id?: string
          question: string
          source_banca?: string | null
          source_exam?: string | null
          source_type?: string | null
          source_year?: number | null
          topic_id: string
          updated_at?: string
        }
        Update: {
          acervo_item_id?: string | null
          answer?: string
          created_at?: string
          created_by_user_id?: string
          difficulty?: number
          explanation?: string | null
          external_resource_url?: string | null
          flashcard_set_id?: string | null
          id?: string
          question?: string
          source_banca?: string | null
          source_exam?: string | null
          source_type?: string | null
          source_year?: number | null
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_acervo_item_id_fkey"
            columns: ["acervo_item_id"]
            isOneToOne: false
            referencedRelation: "acervo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_flashcards_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          duplicate_items: number | null
          error_log: Json | null
          failed_items: number | null
          flashcards_created: number | null
          id: string
          imported_items: number | null
          job_type: string
          metadata: Json | null
          questions_created: number | null
          source_name: string
          started_at: string | null
          status: string
          total_items: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duplicate_items?: number | null
          error_log?: Json | null
          failed_items?: number | null
          flashcards_created?: number | null
          id?: string
          imported_items?: number | null
          job_type: string
          metadata?: Json | null
          questions_created?: number | null
          source_name: string
          started_at?: string | null
          status?: string
          total_items?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          duplicate_items?: number | null
          error_log?: Json | null
          failed_items?: number | null
          flashcards_created?: number | null
          id?: string
          imported_items?: number | null
          job_type?: string
          metadata?: Json | null
          questions_created?: number | null
          source_name?: string
          started_at?: string | null
          status?: string
          total_items?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_registrations: {
        Row: {
          id: string
          invite_id: string
          registered_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          invite_id: string
          registered_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          invite_id?: string
          registered_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_registrations_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          access_duration_days: number | null
          class_id: string | null
          course_id: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by_user_id: string | null
          description: string | null
          id: string
          max_slots: number | null
          motivational_message: string | null
          slug: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          access_duration_days?: number | null
          class_id?: string | null
          course_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          max_slots?: number | null
          motivational_message?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          access_duration_days?: number | null
          class_id?: string | null
          course_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          max_slots?: number | null
          motivational_message?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "video_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          max_attempts: number | null
          payload: Json
          result: Json | null
          started_at: string | null
          status: string
          type: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_attempts?: number | null
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          type: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_attempts?: number | null
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      kiwify_products: {
        Row: {
          class_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          kiwify_product_id: string
          product_name: string
        }
        Insert: {
          class_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kiwify_product_id: string
          product_name: string
        }
        Update: {
          class_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kiwify_product_id?: string
          product_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiwify_products_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          lesson_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          lesson_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_attachments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lesson_id: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "video_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lesson_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          content: string
          created_at: string
          drawing_data: string | null
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          drawing_data?: string | null
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          drawing_data?: string | null
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_ratings: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_ratings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      live_events: {
        Row: {
          calendar_event_id: string | null
          class_id: string | null
          course_id: string | null
          created_at: string | null
          description: string | null
          id: string
          panda_live_id: string | null
          panda_rtmp: string | null
          panda_stream_key: string | null
          provider: string
          recording_published: boolean | null
          recording_url: string | null
          reminder_sent: boolean | null
          scheduled_end: string
          scheduled_start: string
          status: string
          stream_url: string | null
          teacher_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          calendar_event_id?: string | null
          class_id?: string | null
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          panda_live_id?: string | null
          panda_rtmp?: string | null
          panda_stream_key?: string | null
          provider: string
          recording_published?: boolean | null
          recording_url?: string | null
          reminder_sent?: boolean | null
          scheduled_end: string
          scheduled_start: string
          status?: string
          stream_url?: string | null
          teacher_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          calendar_event_id?: string | null
          class_id?: string | null
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          panda_live_id?: string | null
          panda_rtmp?: string | null
          panda_stream_key?: string | null
          provider?: string
          recording_published?: boolean | null
          recording_url?: string | null
          reminder_sent?: boolean | null
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          stream_url?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_events_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "video_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mind_maps: {
        Row: {
          color: string | null
          created_at: string | null
          data: Json
          icon: string | null
          id: string
          subject: string
          title: string
          topic: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          data?: Json
          icon?: string | null
          id?: string
          subject: string
          title: string
          topic: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          data?: Json
          icon?: string | null
          id?: string
          subject?: string
          title?: string
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          class_id: string
          id: string
          order_id: string
          price_cents: number
          quantity: number | null
          stripe_product_id: string
        }
        Insert: {
          class_id: string
          id?: string
          order_id: string
          price_cents: number
          quantity?: number | null
          stripe_product_id: string
        }
        Update: {
          class_id?: string
          id?: string
          order_id?: string
          price_cents?: number
          quantity?: number | null
          stripe_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_stripe_product_id_fkey"
            columns: ["stripe_product_id"]
            isOneToOne: false
            referencedRelation: "stripe_products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          affiliate_id: string | null
          coupon_id: string | null
          created_at: string | null
          currency: string | null
          id: string
          installments: number | null
          metadata: Json | null
          payment_method: string | null
          split_payments_completed: number | null
          split_payments_expected: number | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          total_cents: number
          user_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          coupon_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          installments?: number | null
          metadata?: Json | null
          payment_method?: string | null
          split_payments_completed?: number | null
          split_payments_expected?: number | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          total_cents: number
          user_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          coupon_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          installments?: number | null
          metadata?: Json | null
          payment_method?: string | null
          split_payments_completed?: number | null
          split_payments_expected?: number | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          total_cents?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          card_brand: string | null
          card_last4: string | null
          created_at: string | null
          id: string
          net_amount_cents: number | null
          order_id: string
          paid_at: string | null
          payment_method: string | null
          pix_expiration: string | null
          status: string
          stripe_charge_id: string | null
          stripe_fee_cents: number | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents: number
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          net_amount_cents?: number | null
          order_id: string
          paid_at?: string | null
          payment_method?: string | null
          pix_expiration?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_fee_cents?: number | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          net_amount_cents?: number | null
          order_id?: string
          paid_at?: string | null
          payment_method?: string | null
          pix_expiration?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_fee_cents?: number | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pomodoro_sessions: {
        Row: {
          completed: boolean
          created_at: string | null
          duration_minutes: number
          id: string
          topic_id: string | null
          topic_title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string | null
          duration_minutes?: number
          id?: string
          topic_id?: string | null
          topic_title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string | null
          duration_minutes?: number
          id?: string
          topic_id?: string | null
          topic_title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pomodoro_sessions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answer_json: Json | null
          answer_value: string | null
          attempt_id: string
          created_at: string | null
          id: string
          is_correct: boolean | null
          points_earned: number | null
          question_id: string
          time_spent_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          answer_json?: Json | null
          answer_value?: string | null
          attempt_id: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id: string
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          answer_json?: Json | null
          answer_value?: string | null
          attempt_id?: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempt_answers: {
        Row: {
          answered_at: string
          created_at: string
          id: string
          is_correct: boolean
          quiz_attempt_id: string
          quiz_question_id: string
          updated_at: string
          user_answer: string | null
        }
        Insert: {
          answered_at?: string
          created_at?: string
          id?: string
          is_correct: boolean
          quiz_attempt_id: string
          quiz_question_id: string
          updated_at?: string
          user_answer?: string | null
        }
        Update: {
          answered_at?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          quiz_attempt_id?: string
          quiz_question_id?: string
          updated_at?: string
          user_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_quiz_attempt_answers_quiz_attempt_id_fkey"
            columns: ["quiz_attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_quiz_attempt_answers_quiz_question_id_fkey"
            columns: ["quiz_question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          attempt_date: string
          created_at: string
          duration_seconds: number | null
          id: string
          percentage: number | null
          quiz_id: string
          score: number
          started_at: string | null
          status: string | null
          submitted_at: string | null
          time_spent_seconds: number | null
          total_points: number | null
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempt_date?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          percentage?: number | null
          quiz_id: string
          score?: number
          started_at?: string | null
          status?: string | null
          submitted_at?: string | null
          time_spent_seconds?: number | null
          total_points?: number | null
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempt_date?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          percentage?: number | null
          quiz_id?: string
          score?: number
          started_at?: string | null
          status?: string | null
          submitted_at?: string | null
          time_spent_seconds?: number | null
          total_points?: number | null
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_classes: {
        Row: {
          class_id: string
          created_at: string | null
          id: string
          quiz_id: string
        }
        Insert: {
          class_id: string
          created_at?: string | null
          id?: string
          quiz_id: string
        }
        Update: {
          class_id?: string
          created_at?: string | null
          id?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_classes_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_question_stats: {
        Row: {
          average_time_seconds: number | null
          correct_answers: number | null
          difficulty_level: string | null
          id: string
          incorrect_answers: number | null
          question_id: string
          quiz_id: string
          total_answers: number | null
          updated_at: string | null
        }
        Insert: {
          average_time_seconds?: number | null
          correct_answers?: number | null
          difficulty_level?: string | null
          id?: string
          incorrect_answers?: number | null
          question_id: string
          quiz_id: string
          total_answers?: number | null
          updated_at?: string | null
        }
        Update: {
          average_time_seconds?: number | null
          correct_answers?: number | null
          difficulty_level?: string | null
          id?: string
          incorrect_answers?: number | null
          question_id?: string
          quiz_id?: string
          total_answers?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_stats_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_question_stats_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          acervo_item_id: string | null
          ai_audited_at: string | null
          correct_answer: string
          correct_answers: Json | null
          created_at: string
          created_by_user_id: string | null
          difficulty: string | null
          display_order: number | null
          explanation: string | null
          explanation_html: string | null
          id: string
          matching_pairs: Json | null
          needs_review: boolean | null
          options: Json | null
          options_rich: Json | null
          ordering_items: Json | null
          points: number
          question_format: string
          question_html: string | null
          question_image_caption: string | null
          question_image_url: string | null
          question_number: string | null
          question_text: string
          question_type: string
          quiz_id: string
          reading_text_id: string | null
          source_banca: string | null
          source_exam: string | null
          source_question_number: number | null
          source_year: number | null
          tags: string[] | null
          time_limit_seconds: number | null
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          acervo_item_id?: string | null
          ai_audited_at?: string | null
          correct_answer: string
          correct_answers?: Json | null
          created_at?: string
          created_by_user_id?: string | null
          difficulty?: string | null
          display_order?: number | null
          explanation?: string | null
          explanation_html?: string | null
          id?: string
          matching_pairs?: Json | null
          needs_review?: boolean | null
          options?: Json | null
          options_rich?: Json | null
          ordering_items?: Json | null
          points?: number
          question_format?: string
          question_html?: string | null
          question_image_caption?: string | null
          question_image_url?: string | null
          question_number?: string | null
          question_text: string
          question_type: string
          quiz_id: string
          reading_text_id?: string | null
          source_banca?: string | null
          source_exam?: string | null
          source_question_number?: number | null
          source_year?: number | null
          tags?: string[] | null
          time_limit_seconds?: number | null
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          acervo_item_id?: string | null
          ai_audited_at?: string | null
          correct_answer?: string
          correct_answers?: Json | null
          created_at?: string
          created_by_user_id?: string | null
          difficulty?: string | null
          display_order?: number | null
          explanation?: string | null
          explanation_html?: string | null
          id?: string
          matching_pairs?: Json | null
          needs_review?: boolean | null
          options?: Json | null
          options_rich?: Json | null
          ordering_items?: Json | null
          points?: number
          question_format?: string
          question_html?: string | null
          question_image_caption?: string | null
          question_image_url?: string | null
          question_number?: string | null
          question_text?: string
          question_type?: string
          quiz_id?: string
          reading_text_id?: string | null
          source_banca?: string | null
          source_exam?: string | null
          source_question_number?: number | null
          source_year?: number | null
          tags?: string[] | null
          time_limit_seconds?: number | null
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_acervo_item_id_fkey"
            columns: ["acervo_item_id"]
            isOneToOne: false
            referencedRelation: "acervo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_reading_text_id_fkey"
            columns: ["reading_text_id"]
            isOneToOne: false
            referencedRelation: "quiz_reading_texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_reading_texts: {
        Row: {
          author: string | null
          content: string
          content_html: string | null
          created_at: string | null
          display_order: number | null
          id: string
          quiz_id: string
          source: string | null
          title: string | null
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          author?: string | null
          content: string
          content_html?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          quiz_id: string
          source?: string | null
          title?: string | null
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          author?: string | null
          content?: string
          content_html?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          quiz_id?: string
          source?: string | null
          title?: string | null
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_reading_texts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          allow_review: boolean | null
          created_at: string
          created_by: string | null
          created_by_user_id: string
          description: string | null
          duration_minutes: number | null
          id: string
          instructions: string | null
          passing_score: number | null
          scheduled_end: string | null
          scheduled_start: string | null
          show_results_immediately: boolean | null
          shuffle_options: boolean | null
          shuffle_questions: boolean | null
          status: string | null
          title: string
          topic_id: string
          total_points: number | null
          type: string | null
          updated_at: string
        }
        Insert: {
          allow_review?: boolean | null
          created_at?: string
          created_by?: string | null
          created_by_user_id: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          passing_score?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          show_results_immediately?: boolean | null
          shuffle_options?: boolean | null
          shuffle_questions?: boolean | null
          status?: string | null
          title: string
          topic_id: string
          total_points?: number | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          allow_review?: boolean | null
          created_at?: string
          created_by?: string | null
          created_by_user_id?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          passing_score?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          show_results_immediately?: boolean | null
          shuffle_options?: boolean | null
          shuffle_questions?: boolean | null
          status?: string | null
          title?: string
          topic_id?: string
          total_points?: number | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_quizzes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          admin_user_id: string | null
          amount_cents: number
          created_at: string | null
          id: string
          order_id: string
          payment_id: string
          reason: string | null
          refunded_at: string | null
          status: string
          stripe_refund_id: string | null
        }
        Insert: {
          admin_user_id?: string | null
          amount_cents: number
          created_at?: string | null
          id?: string
          order_id: string
          payment_id: string
          reason?: string | null
          refunded_at?: string | null
          status?: string
          stripe_refund_id?: string | null
        }
        Update: {
          admin_user_id?: string | null
          amount_cents?: number
          created_at?: string | null
          id?: string
          order_id?: string
          payment_id?: string
          reason?: string | null
          refunded_at?: string | null
          status?: string
          stripe_refund_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      rpg_ranks: {
        Row: {
          created_at: string
          id: string
          max_xp: number
          min_xp: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_xp: number
          min_xp: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_xp?: number
          min_xp?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          activity_id: string | null
          activity_type: string
          created_at: string
          id: string
          recorded_at: string
          score_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          activity_type: string
          created_at?: string
          id?: string
          recorded_at?: string
          score_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          activity_type?: string
          created_at?: string
          id?: string
          recorded_at?: string
          score_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_product_classes: {
        Row: {
          class_id: string
          id: string
          stripe_product_id: string
        }
        Insert: {
          class_id: string
          id?: string
          stripe_product_id: string
        }
        Update: {
          class_id?: string
          id?: string
          stripe_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_product_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_product_classes_stripe_product_id_fkey"
            columns: ["stripe_product_id"]
            isOneToOne: false
            referencedRelation: "stripe_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_products: {
        Row: {
          access_days: number | null
          created_at: string | null
          currency: string | null
          id: string
          installments_max: number | null
          is_active: boolean | null
          is_bundle: boolean | null
          landing_page_slug: string | null
          price_cents: number
          product_name: string
          stripe_price_id: string
          stripe_product_id: string
        }
        Insert: {
          access_days?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          installments_max?: number | null
          is_active?: boolean | null
          is_bundle?: boolean | null
          landing_page_slug?: string | null
          price_cents: number
          product_name: string
          stripe_price_id: string
          stripe_product_id: string
        }
        Update: {
          access_days?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          installments_max?: number | null
          is_active?: boolean | null
          is_bundle?: boolean | null
          landing_page_slug?: string | null
          price_cents?: number
          product_name?: string
          stripe_price_id?: string
          stripe_product_id?: string
        }
        Relationships: []
      }
      student_classes: {
        Row: {
          class_id: string
          coupon_code: string | null
          created_at: string
          enrollment_date: string
          id: string
          order_id: string | null
          source: string | null
          subscription_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          coupon_code?: string | null
          created_at?: string
          enrollment_date: string
          id?: string
          order_id?: string | null
          source?: string | null
          subscription_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          coupon_code?: string | null
          created_at?: string
          enrollment_date?: string
          id?: string
          order_id?: string | null
          source?: string | null
          subscription_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_student_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_classes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_classes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_classes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      study_topics: {
        Row: {
          category: string
          created_at: string | null
          id: string
          pomodoros: number
          status: string
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          pomodoros?: number
          status?: string
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          pomodoros?: number
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          category: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      teachers: {
        Row: {
          created_at: string
          department: string | null
          employee_id_number: string
          hire_date: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          employee_id_number: string
          hire_date?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          employee_id_number?: string
          hire_date?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          name: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          name: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          name?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_allowed_content: {
        Row: {
          class_id: string
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_allowed_content_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achieved_at: string
          achievement_id: string
          id: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          achievement_id: string
          id?: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          achievement_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_downloaded_audio_lessons: {
        Row: {
          created_at: string
          downloaded_at: string
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          downloaded_at?: string
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          downloaded_at?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_user_downloaded_audio_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "audio_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_incorrect_flashcards: {
        Row: {
          created_at: string
          flashcard_id: string
          id: string
          last_incorrect_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flashcard_id: string
          id?: string
          last_incorrect_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flashcard_id?: string
          id?: string
          last_incorrect_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_user_incorrect_flashcards_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          completion_percentage: number
          created_at: string
          id: string
          last_accessed_at: string
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completion_percentage: number
          created_at?: string
          id?: string
          last_accessed_at?: string
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completion_percentage?: number
          created_at?: string
          id?: string
          last_accessed_at?: string
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_user_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          last_active_at: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          background_sound: string | null
          daily_study_goal_minutes: number | null
          dashboard_layout: Json | null
          flashcard_theme: string | null
          id: string
          pomodoro_break_minutes: number | null
          pomodoro_duration_minutes: number | null
          timer_alerts: boolean | null
          updated_at: string
          use_pomodoro: boolean | null
          user_id: string
        }
        Insert: {
          background_sound?: string | null
          daily_study_goal_minutes?: number | null
          dashboard_layout?: Json | null
          flashcard_theme?: string | null
          id?: string
          pomodoro_break_minutes?: number | null
          pomodoro_duration_minutes?: number | null
          timer_alerts?: boolean | null
          updated_at?: string
          use_pomodoro?: boolean | null
          user_id: string
        }
        Update: {
          background_sound?: string | null
          daily_study_goal_minutes?: number | null
          dashboard_layout?: Json | null
          flashcard_theme?: string | null
          id?: string
          pomodoro_break_minutes?: number | null
          pomodoro_duration_minutes?: number | null
          timer_alerts?: boolean | null
          updated_at?: string
          use_pomodoro?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cpf_cnpj: string | null
          created_at: string
          department: string | null
          email: string
          employee_id_number: string | null
          enrollment_date: string | null
          first_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          is_banned: boolean | null
          is_unlimited_access: boolean | null
          last_name: string
          last_seen_at: string | null
          must_change_password: boolean
          phone: string | null
          role: string
          student_id_number: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          department?: string | null
          email: string
          employee_id_number?: string | null
          enrollment_date?: string | null
          first_name?: string
          hire_date?: string | null
          id: string
          is_active?: boolean
          is_banned?: boolean | null
          is_unlimited_access?: boolean | null
          last_name?: string
          last_seen_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          role?: string
          student_id_number?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          department?: string | null
          email?: string
          employee_id_number?: string | null
          enrollment_date?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          is_banned?: boolean | null
          is_unlimited_access?: boolean | null
          last_name?: string
          last_seen_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          role?: string
          student_id_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      video_courses: {
        Row: {
          acronym: string | null
          category: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          evercast_enabled: boolean
          id: string
          is_active: boolean | null
          layout_preference: string | null
          moderate_comments: boolean | null
          name: string
          onboarding_text: string | null
          sales_url: string | null
          show_in_storefront: boolean | null
          status: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          acronym?: string | null
          category?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          evercast_enabled?: boolean
          id?: string
          is_active?: boolean | null
          layout_preference?: string | null
          moderate_comments?: boolean | null
          name: string
          onboarding_text?: string | null
          sales_url?: string | null
          show_in_storefront?: boolean | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          acronym?: string | null
          category?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          evercast_enabled?: boolean
          id?: string
          is_active?: boolean | null
          layout_preference?: string | null
          moderate_comments?: boolean | null
          name?: string
          onboarding_text?: string | null
          sales_url?: string | null
          show_in_storefront?: boolean | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      video_lessons: {
        Row: {
          accompanying_pdf_attachment_id: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_active: boolean | null
          is_preview: boolean | null
          module_id: string
          order_index: number
          quiz_id: string | null
          quiz_min_percentage: number | null
          quiz_required: boolean | null
          title: string
          topic_id: string | null
          updated_at: string
          video_source_id: string | null
          video_source_type:
            | Database["public"]["Enums"]["video_source_provider"]
            | null
        }
        Insert: {
          accompanying_pdf_attachment_id?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean | null
          is_preview?: boolean | null
          module_id: string
          order_index?: number
          quiz_id?: string | null
          quiz_min_percentage?: number | null
          quiz_required?: boolean | null
          title: string
          topic_id?: string | null
          updated_at?: string
          video_source_id?: string | null
          video_source_type?:
            | Database["public"]["Enums"]["video_source_provider"]
            | null
        }
        Update: {
          accompanying_pdf_attachment_id?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean | null
          is_preview?: boolean | null
          module_id?: string
          order_index?: number
          quiz_id?: string | null
          quiz_min_percentage?: number | null
          quiz_required?: boolean | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          video_source_id?: string | null
          video_source_type?:
            | Database["public"]["Enums"]["video_source_provider"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "video_lessons_accompanying_pdf_attachment_id_fkey"
            columns: ["accompanying_pdf_attachment_id"]
            isOneToOne: false
            referencedRelation: "lesson_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "video_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_lessons_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      video_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          module_type: string | null
          name: string
          order_index: number
          parent_module_id: string | null
          quiz_id: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          module_type?: string | null
          name: string
          order_index?: number
          parent_module_id?: string | null
          quiz_id?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          module_type?: string | null
          name?: string
          order_index?: number
          parent_module_id?: string | null
          quiz_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "video_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_modules_parent_module_id_fkey"
            columns: ["parent_module_id"]
            isOneToOne: false
            referencedRelation: "video_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_modules_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      video_progress: {
        Row: {
          created_at: string
          current_time_seconds: number
          id: string
          is_completed: boolean
          lesson_id: string
          progress_percentage: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_time_seconds?: number
          id?: string
          is_completed?: boolean
          lesson_id: string
          progress_percentage?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_time_seconds?: number
          id?: string
          is_completed?: boolean
          lesson_id?: string
          progress_percentage?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          is_active: boolean | null
          last_name: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          last_name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_user_score: {
        Args: {
          p_activity_id?: string
          p_activity_type: string
          p_score_value: number
          p_user_id: string
        }
        Returns: string
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      calculate_subscription_expiration: {
        Args: { p_class_id: string; p_enrollment_date: string }
        Returns: string
      }
      check_auth_status: {
        Args: never
        Returns: {
          auth_users_count: number
          missing_profiles: number
          public_users_count: number
          status: string
          user_profiles_count: number
        }[]
      }
      downgrade_expired_subscriptions: {
        Args: never
        Returns: {
          expired_at: string
          new_class_name: string
          old_class_name: string
          user_email: string
          user_id: string
        }[]
      }
      get_auth_user_role: { Args: never; Returns: string }
      get_gamification_stats: { Args: never; Returns: Json }
      get_import_stats: { Args: never; Returns: Json }
      get_invite_registration_count: {
        Args: { p_invite_id: string }
        Returns: number
      }
      get_question_performance_for_quiz: {
        Args: { p_quiz_id: string }
        Returns: {
          correct_answers: number
          incorrect_answers: number
          question_id: string
          question_text: string
        }[]
      }
      get_ranking: {
        Args: { ranking_limit?: number }
        Returns: {
          achievements_count: number
          email: string
          first_name: string
          last_name: string
          total_xp: number
          user_id: string
        }[]
      }
      get_ranking_by_activity_type: {
        Args: { p_activity_type: string; p_limit?: number }
        Returns: {
          email: string
          first_name: string
          last_name: string
          rank_position: number
          total_xp_activity: number
          total_xp_general: number
          user_id: string
        }[]
      }
      get_ranking_by_class: {
        Args: { p_class_id: string; ranking_limit?: number }
        Returns: {
          achievements_count: number
          email: string
          first_name: string
          last_name: string
          total_xp: number
          user_id: string
        }[]
      }
      get_study_stats: {
        Args: { user_id: string }
        Returns: {
          completed_topics: number
          current_week_pomodoros: number
          total_minutes: number
          total_pomodoros: number
          total_topics: number
        }[]
      }
      get_subjects_with_quiz_counts: {
        Args: never
        Returns: {
          category: string
          created_at: string
          created_by_user_id: string
          description: string
          id: string
          image_url: string
          name: string
          quiz_count: number
          updated_at: string
        }[]
      }
      get_system_stats: { Args: never; Returns: Json }
      get_total_xp: { Args: never; Returns: number }
      get_trial_allowed_content_for_user: {
        Args: { user_id: string }
        Returns: {
          content_id: string
          content_type: string
        }[]
      }
      get_user_growth_data: {
        Args: { p_months?: number }
        Returns: {
          active_users: number
          month_label: string
          total_users: number
        }[]
      }
      get_user_rank_position: {
        Args: { p_user_id: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
          rank_position: number
          role: string
          total_xp: number
          user_id: string
        }[]
      }
      get_user_ranking: {
        Args: { p_limit?: number }
        Returns: {
          email: string
          first_name: string
          last_name: string
          rank_position: number
          role: string
          total_xp: number
          user_id: string
        }[]
      }
      get_user_role: { Args: never; Returns: string }
      get_user_score_history: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          activity_id: string
          activity_type: string
          id: string
          recorded_at: string
          score_value: number
        }[]
      }
      get_weekly_activity_data: {
        Args: { p_days?: number }
        Returns: {
          activity_count: number
          day_of_week: number
        }[]
      }
      get_xp_statistics: {
        Args: never
        Returns: {
          average_xp: number
          max_xp: number
          min_xp: number
          total_users: number
          total_xp_distributed: number
        }[]
      }
      increment: {
        Args: { column_name: string; row_id: string; table_name: string }
        Returns: undefined
      }
      increment_topic_pomodoros: {
        Args: { topic_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_teacher: { Args: never; Returns: boolean }
      is_authenticated: { Args: never; Returns: boolean }
      is_teacher: { Args: never; Returns: boolean }
      is_trial_user: { Args: { user_id: string }; Returns: boolean }
      register_invite_slot: {
        Args: { p_invite_id: string; p_user_id: string }
        Returns: boolean
      }
      submit_quiz_attempt: { Args: { p_attempt_id: string }; Returns: Json }
      update_last_seen: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      audio_source_provider: "panda_video_hls" | "mp3_url"
      calendar_event_type:
        | "SIMULATION"
        | "ESSAY_DEADLINE"
        | "LIVE_CLASS"
        | "GENERAL"
      class_type: "standard" | "trial"
      collaborator_permission: "viewer" | "editor"
      essay_status_enum: "draft" | "correcting" | "corrected" | "submitted"
      session_status: "pending" | "active" | "completed"
      user_role: "student" | "teacher" | "administrator"
      video_source_provider: "panda_video" | "youtube" | "vimeo"
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
      audio_source_provider: ["panda_video_hls", "mp3_url"],
      calendar_event_type: [
        "SIMULATION",
        "ESSAY_DEADLINE",
        "LIVE_CLASS",
        "GENERAL",
      ],
      class_type: ["standard", "trial"],
      collaborator_permission: ["viewer", "editor"],
      essay_status_enum: ["draft", "correcting", "corrected", "submitted"],
      session_status: ["pending", "active", "completed"],
      user_role: ["student", "teacher", "administrator"],
      video_source_provider: ["panda_video", "youtube", "vimeo"],
    },
  },
} as const
