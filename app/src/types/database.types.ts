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
      analyses: {
        Row: {
          analysis_date: string
          analysis_type: string | null
          completed_at: string | null
          confidence_threshold: number | null
          error_message: string | null
          id: string
          image_id: string | null
          image_name: string
          iou_threshold: number | null
          model_version: string | null
          notes: string | null
          processing_method: string
          processing_progress: Json | null
          processing_time: number | null
          profile_id: string
          source_type: string
          started_at: string | null
          status: string
          total_detections: number
          window_size: string | null
        }
        Insert: {
          analysis_date?: string
          analysis_type?: string | null
          completed_at?: string | null
          confidence_threshold?: number | null
          error_message?: string | null
          id?: string
          image_id?: string | null
          image_name: string
          iou_threshold?: number | null
          model_version?: string | null
          notes?: string | null
          processing_method: string
          processing_progress?: Json | null
          processing_time?: number | null
          profile_id: string
          source_type?: string
          started_at?: string | null
          status?: string
          total_detections?: number
          window_size?: string | null
        }
        Update: {
          analysis_date?: string
          analysis_type?: string | null
          completed_at?: string | null
          confidence_threshold?: number | null
          error_message?: string | null
          id?: string
          image_id?: string | null
          image_name?: string
          iou_threshold?: number | null
          model_version?: string | null
          notes?: string | null
          processing_method?: string
          processing_progress?: Json | null
          processing_time?: number | null
          profile_id?: string
          source_type?: string
          started_at?: string | null
          status?: string
          total_detections?: number
          window_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "user_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_detections: {
        Row: {
          analysis_id: string
          bbox_x1: number
          bbox_x2: number
          bbox_y1: number
          bbox_y2: number
          class_id: number
          class_name: string
          confidence: number
          detection_order: number
          id: string
          window_index: number | null
        }
        Insert: {
          analysis_id: string
          bbox_x1: number
          bbox_x2: number
          bbox_y1: number
          bbox_y2: number
          class_id: number
          class_name: string
          confidence: number
          detection_order: number
          id?: string
          window_index?: number | null
        }
        Update: {
          analysis_id?: string
          bbox_x1?: number
          bbox_x2?: number
          bbox_y1?: number
          bbox_y2?: number
          class_id?: number
          class_name?: string
          confidence?: number
          detection_order?: number
          id?: string
          window_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_detections_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      user_details: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_anonymous: boolean | null
          last_login: string | null
          name: string
          profile_id: string | null
          role: string | null
          total_analyses: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_anonymous?: boolean | null
          last_login?: string | null
          name: string
          profile_id?: string | null
          role?: string | null
          total_analyses?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_anonymous?: boolean | null
          last_login?: string | null
          name?: string
          profile_id?: string | null
          role?: string | null
          total_analyses?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_images: {
        Row: {
          content_type: string
          file_format: string
          file_hash: string | null
          file_size: number
          id: string
          image_height: number
          image_width: number
          original_filename: string
          profile_id: string
          s3_key: string
          s3_url: string | null
          s3_url_expires_at: string | null
          upload_date: string
        }
        Insert: {
          content_type: string
          file_format: string
          file_hash?: string | null
          file_size: number
          id?: string
          image_height: number
          image_width: number
          original_filename: string
          profile_id: string
          s3_key: string
          s3_url?: string | null
          s3_url_expires_at?: string | null
          upload_date?: string
        }
        Update: {
          content_type?: string
          file_format?: string
          file_hash?: string | null
          file_size?: number
          id?: string
          image_height?: number
          image_width?: number
          original_filename?: string
          profile_id?: string
          s3_key?: string
          s3_url?: string | null
          s3_url_expires_at?: string | null
          upload_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_images_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
