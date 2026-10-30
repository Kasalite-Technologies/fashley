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
      coin_generations: {
        Row: {
          attempts: number
          cost: number
          created_at: string
          id: string
          is_free: boolean
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          cost: number
          created_at?: string
          id: string
          is_free: boolean
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          cost?: number
          created_at?: string
          id?: string
          is_free?: boolean
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_packages: {
        Row: {
          active: boolean
          coins: number
          currency: string
          id: string
          name: string
          price_minor: number | null
        }
        Insert: {
          active?: boolean
          coins: number
          currency?: string
          id: string
          name: string
          price_minor?: number | null
        }
        Update: {
          active?: boolean
          coins?: number
          currency?: string
          id?: string
          name?: string
          price_minor?: number | null
        }
        Relationships: []
      }
      coin_purchases: {
        Row: {
          amount_minor: number
          coins: number
          created_at: string
          currency: string
          package_id: string
          reference: string
          status: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          coins: number
          created_at?: string
          currency: string
          package_id: string
          reference: string
          status?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          coins?: number
          created_at?: string
          currency?: string
          package_id?: string
          reference?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_settings: {
        Row: {
          generation_cost: number
          id: number
          purchases_enabled: boolean
        }
        Insert: {
          generation_cost?: number
          id?: number
          purchases_enabled?: boolean
        }
        Update: {
          generation_cost?: number
          id?: number
          purchases_enabled?: boolean
        }
        Relationships: []
      }
      coin_wallets: {
        Row: {
          balance: number
          free_used: number
          user_id: string
        }
        Insert: {
          balance?: number
          free_used?: number
          user_id: string
        }
        Update: {
          balance?: number
          free_used?: number
          user_id?: string
        }
        Relationships: []
      }
      designs: {
        Row: {
          accessories: Json | null
          category: string
          collection: string
          created_at: string
          id: string
          image_path: string
          occasion: string | null
          style: string | null
          user_id: string
        }
        Insert: {
          accessories?: Json | null
          category: string
          collection?: string
          created_at?: string
          id?: string
          image_path: string
          occasion?: string | null
          style?: string | null
          user_id?: string
        }
        Update: {
          accessories?: Json | null
          category?: string
          collection?: string
          created_at?: string
          id?: string
          image_path?: string
          occasion?: string | null
          style?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shop_notifications: {
        Row: {
          created_at: string
          email: string
          id: string
          section: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          section: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          section?: string
        }
        Relationships: []
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
      finish_coin_generation: {
        Args: { p_request: string; p_success: boolean }
        Returns: undefined
      }
      fulfill_coin_purchase: {
        Args: { p_amount: number; p_currency: string; p_reference: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reserve_coin_generation: {
        Args: { p_request: string; p_user: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
