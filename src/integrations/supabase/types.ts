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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          day: string
          end_time: string | null
          id: string
          start_time: string | null
          status: Database["public"]["Enums"]["avail_status"]
          user_id: string
        }
        Insert: {
          day: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          status: Database["public"]["Enums"]["avail_status"]
          user_id: string
        }
        Update: {
          day?: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["avail_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_patterns: {
        Row: {
          end_time: string | null
          id: string
          start_time: string | null
          status: Database["public"]["Enums"]["avail_status"]
          user_id: string
          weekday: number
        }
        Insert: {
          end_time?: string | null
          id?: string
          start_time?: string | null
          status: Database["public"]["Enums"]["avail_status"]
          user_id: string
          weekday: number
        }
        Update: {
          end_time?: string | null
          id?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["avail_status"]
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_patterns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          account: string | null
          client_name: string | null
          contact_name: string | null
          created_at: string
          day: string
          end_time: string | null
          id: string
          notes: string | null
          order_url: string | null
          pax: number | null
          puree_id: string | null
          reference: string | null
          source: string
          start_time: string | null
          state: string | null
          title: string
          venue: string | null
        }
        Insert: {
          account?: string | null
          client_name?: string | null
          contact_name?: string | null
          created_at?: string
          day: string
          end_time?: string | null
          id?: string
          notes?: string | null
          order_url?: string | null
          pax?: number | null
          puree_id?: string | null
          reference?: string | null
          source?: string
          start_time?: string | null
          state?: string | null
          title?: string
          venue?: string | null
        }
        Update: {
          account?: string | null
          client_name?: string | null
          contact_name?: string | null
          created_at?: string
          day?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          order_url?: string | null
          pax?: number | null
          puree_id?: string | null
          reference?: string | null
          source?: string
          start_time?: string | null
          state?: string | null
          title?: string
          venue?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          day: string
          event_id: string | null
          id: string
          note: string | null
          office_note: string | null
          receipt_path: string | null
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          day: string
          event_id?: string | null
          id?: string
          note?: string | null
          office_note?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          day?: string
          event_id?: string | null
          id?: string
          note?: string | null
          office_note?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          deadline: string | null
          decline_reason: string | null
          event_id: string
          id: string
          mode: string
          responded_at: string | null
          staffing_row_id: string
          status: Database["public"]["Enums"]["invite_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          decline_reason?: string | null
          event_id: string
          id?: string
          mode?: string
          responded_at?: string | null
          staffing_row_id: string
          status?: Database["public"]["Enums"]["invite_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          decline_reason?: string | null
          event_id?: string
          id?: string
          mode?: string
          responded_at?: string | null
          staffing_row_id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_staffing_row_id_fkey"
            columns: ["staffing_row_id"]
            isOneToOne: false
            referencedRelation: "staffing_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_rates: {
        Row: {
          client_rate: number
          end_hour: number | null
          id: string
          label: string
          sort: number
          start_hour: number
        }
        Insert: {
          client_rate: number
          end_hour?: number | null
          id?: string
          label: string
          sort?: number
          start_hour: number
        }
        Update: {
          client_rate?: number
          end_hour?: number | null
          id?: string
          label?: string
          sort?: number
          start_hour?: number
        }
        Relationships: []
      }
      position_rates: {
        Row: {
          client_rate: number | null
          hourly_cost: number | null
          position_id: string
        }
        Insert: {
          client_rate?: number | null
          hourly_cost?: number | null
          position_id: string
        }
        Update: {
          client_rate?: number | null
          hourly_cost?: number | null
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_rates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: true
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          languages: string[]
          main_position_id: string | null
          other_position_ids: string[]
          personal_hourly_cost: number | null
          phone: string | null
          photo_url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          languages?: string[]
          main_position_id?: string | null
          other_position_ids?: string[]
          personal_hourly_cost?: number | null
          phone?: string | null
          photo_url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          languages?: string[]
          main_position_id?: string | null
          other_position_ids?: string[]
          personal_hourly_cost?: number | null
          phone?: string | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_main_position_id_fkey"
            columns: ["main_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notes: {
        Row: {
          notes: string
          user_id: string
        }
        Insert: {
          notes?: string
          user_id: string
        }
        Update: {
          notes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_rows: {
        Row: {
          break_minutes: number
          created_at: string
          end_time: string
          event_id: string
          id: string
          position_id: string
          quantity: number
          start_time: string
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          end_time: string
          event_id: string
          id?: string
          position_id: string
          quantity?: number
          start_time: string
        }
        Update: {
          break_minutes?: number
          created_at?: string
          end_time?: string
          event_id?: string
          id?: string
          position_id?: string
          quantity?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_rows_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_rows_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      event_team: {
        Args: { _event: string }
        Returns: {
          end_time: string
          full_name: string
          photo_url: string
          position_name: string
          start_time: string
          status: Database["public"]["Enums"]["invite_status"]
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_office: { Args: never; Returns: boolean }
      my_rate: { Args: { _position: string }; Returns: number }
      notify_office: {
        Args: { _body: string; _link: string; _title: string }
        Returns: undefined
      }
      on_event: { Args: { _event: string }; Returns: boolean }
      respond_invitation: {
        Args: { _accept: boolean; _id: string; _reason?: string }
        Returns: Database["public"]["Enums"]["invite_status"]
      }
    }
    Enums: {
      app_role: "office" | "staff"
      avail_status: "available" | "partial" | "unavailable"
      invite_status:
        | "invited"
        | "accepted"
        | "declined"
        | "confirmed"
        | "cancelled"
        | "closed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["office", "staff"],
      avail_status: ["available", "partial", "unavailable"],
      invite_status: [
        "invited",
        "accepted",
        "declined",
        "confirmed",
        "cancelled",
        "closed",
      ],
    },
  },
} as const
