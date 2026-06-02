// src/integrations/supabase/types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          role: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          role: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      article_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          author_name: string;
          category_id: string | null;
          content: string;
          cover_image: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          published: boolean;
          read_minutes: number | null;
          slug: string;
          title: string;
        };
        Insert: {
          author_name?: string;
          category_id?: string | null;
          content: string;
          cover_image?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published?: boolean;
          read_minutes?: number | null;
          slug: string;
          title: string;
        };
        Update: {
          author_name?: string;
          category_id?: string | null;
          content?: string;
          cover_image?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published?: boolean;
          read_minutes?: number | null;
          slug?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "articles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "article_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_events: {
        Row: {
          created_at: string;
          event_date: string;
          event_time: string | null;
          event_type: string;
          id: string;
          notes: string | null;
          plant_name: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_date: string;
          event_time?: string | null;
          event_type: string;
          id?: string;
          notes?: string | null;
          plant_name?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_date?: string;
          event_time?: string | null;
          event_type?: string;
          id?: string;
          notes?: string | null;
          plant_name?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          title: string;
          type: string | null;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          title: string;
          type?: string | null;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          title?: string;
          type?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      plant_diagnoses: {
        Row: {
          cause: string | null;
          created_at: string;
          diagnosis: string;
          fertilizer: string | null;
          id: string;
          image_url: string | null;
          part_type: string | null;
          pesticide: string | null;
          plant_type: string | null;
          recovery_days: number | null;
          severity: string | null;
          severity_score: number | null;
          solution: string | null;
          user_id: string;
        };
        Insert: {
          cause?: string | null;
          created_at?: string;
          diagnosis: string;
          fertilizer?: string | null;
          id?: string;
          image_url?: string | null;
          part_type?: string | null;
          pesticide?: string | null;
          plant_type?: string | null;
          recovery_days?: number | null;
          severity?: string | null;
          severity_score?: number | null;
          solution?: string | null;
          user_id: string;
        };
        Update: {
          cause?: string | null;
          created_at?: string;
          diagnosis?: string;
          fertilizer?: string | null;
          id?: string;
          image_url?: string | null;
          part_type?: string | null;
          pesticide?: string | null;
          plant_type?: string | null;
          recovery_days?: number | null;
          severity?: string | null;
          severity_score?: number | null;
          solution?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          category_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          location: string | null;
          name: string;
          price: number;
          seller_id: string | null;
          stock: number;
          unit: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          location?: string | null;
          name: string;
          price: number;
          seller_id?: string | null;
          stock?: number;
          unit?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          location?: string | null;
          name?: string;
          price?: number;
          seller_id?: string | null;
          stock?: number;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          location: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          location?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          location?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      soil_analyses: {
        Row: {
          created_at: string;
          humidity: number | null;
          id: string;
          nitrogen: number | null;
          ph: number | null;
          recommendation: string | null;
          recommended_crops: string | null;
          recommended_fertilizer: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          humidity?: number | null;
          id?: string;
          nitrogen?: number | null;
          ph?: number | null;
          recommendation?: string | null;
          recommended_crops?: string | null;
          recommended_fertilizer?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          humidity?: number | null;
          id?: string;
          nitrogen?: number | null;
          ph?: number | null;
          recommendation?: string | null;
          recommended_crops?: string | null;
          recommended_fertilizer?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
