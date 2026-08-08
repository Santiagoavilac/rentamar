export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      amenities: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["user_role"] | null;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          ip_hash: string | null;
          reason: string | null;
          request_id: string | null;
          user_agent_summary: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["user_role"] | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          ip_hash?: string | null;
          reason?: string | null;
          request_id?: string | null;
          user_agent_summary?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["user_role"] | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          ip_hash?: string | null;
          reason?: string | null;
          request_id?: string | null;
          user_agent_summary?: string | null;
        };
        Relationships: [];
      };
      availability_blocks: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          property_id: string;
          reason: string | null;
          released_at: string | null;
          released_by: string | null;
          status: Database["public"]["Enums"]["availability_block_status"];
          stay_range: unknown;
          type: Database["public"]["Enums"]["availability_block_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          property_id: string;
          reason?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          status?: Database["public"]["Enums"]["availability_block_status"];
          stay_range: unknown;
          type?: Database["public"]["Enums"]["availability_block_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          property_id?: string;
          reason?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          status?: Database["public"]["Enums"]["availability_block_status"];
          stay_range?: unknown;
          type?: Database["public"]["Enums"]["availability_block_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_blocks_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_companions: {
        Row: {
          booking_id: string;
          created_at: string;
          document_id: string;
          full_name: string;
          id: string;
          phone: string | null;
          sort_order: number;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          document_id: string;
          full_name: string;
          id?: string;
          phone?: string | null;
          sort_order?: number;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          document_id?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "booking_companions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_events: {
        Row: {
          actor_id: string | null;
          booking_id: string;
          created_at: string;
          event_type: Database["public"]["Enums"]["booking_event_type"];
          id: string;
          metadata: Json;
          new_status: Database["public"]["Enums"]["booking_status"] | null;
          old_status: Database["public"]["Enums"]["booking_status"] | null;
          reason: string | null;
          source: Database["public"]["Enums"]["booking_event_source"];
        };
        Insert: {
          actor_id?: string | null;
          booking_id: string;
          created_at?: string;
          event_type: Database["public"]["Enums"]["booking_event_type"];
          id?: string;
          metadata?: Json;
          new_status?: Database["public"]["Enums"]["booking_status"] | null;
          old_status?: Database["public"]["Enums"]["booking_status"] | null;
          reason?: string | null;
          source: Database["public"]["Enums"]["booking_event_source"];
        };
        Update: {
          actor_id?: string | null;
          booking_id?: string;
          created_at?: string;
          event_type?: Database["public"]["Enums"]["booking_event_type"];
          id?: string;
          metadata?: Json;
          new_status?: Database["public"]["Enums"]["booking_status"] | null;
          old_status?: Database["public"]["Enums"]["booking_status"] | null;
          reason?: string | null;
          source?: Database["public"]["Enums"]["booking_event_source"];
        };
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_holds: {
        Row: {
          booking_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          property_id: string;
          released_at: string | null;
          status: Database["public"]["Enums"]["hold_status"];
          stay_range: unknown;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          property_id: string;
          released_at?: string | null;
          status?: Database["public"]["Enums"]["hold_status"];
          stay_range: unknown;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          property_id?: string;
          released_at?: string | null;
          status?: Database["public"]["Enums"]["hold_status"];
          stay_range?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: "booking_holds_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_holds_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_price_items: {
        Row: {
          booking_id: string;
          created_at: string;
          description: string | null;
          id: string;
          quantity: number;
          total_amount_minor: number;
          type: Database["public"]["Enums"]["price_item_type"];
          unit_amount_minor: number;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          quantity?: number;
          total_amount_minor: number;
          type: Database["public"]["Enums"]["price_item_type"];
          unit_amount_minor: number;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          quantity?: number;
          total_amount_minor?: number;
          type?: Database["public"]["Enums"]["price_item_type"];
          unit_amount_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "booking_price_items_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          access_token_hash: string | null;
          affiliate_document_id: string | null;
          booking_code: string;
          cancelled_at: string | null;
          channel: Database["public"]["Enums"]["booking_channel"];
          check_in: string;
          check_out: string;
          cleaning_fee_minor: number;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          currency: string;
          discount_minor: number;
          guest_city: string | null;
          guest_document_id: string | null;
          guest_email: string | null;
          guest_id: string | null;
          guest_name: string;
          guest_nationality: string | null;
          guest_phone: string | null;
          guests: number;
          hold_expires_at: string | null;
          id: string;
          nights: number;
          payment_status: Database["public"]["Enums"]["booking_payment_status"];
          property_id: string;
          service_fee_minor: number;
          status: Database["public"]["Enums"]["booking_status"];
          subtotal_minor: number;
          total_minor: number;
          updated_at: string;
        };
        Insert: {
          access_token_hash?: string | null;
          affiliate_document_id?: string | null;
          booking_code: string;
          cancelled_at?: string | null;
          channel?: Database["public"]["Enums"]["booking_channel"];
          check_in: string;
          check_out: string;
          cleaning_fee_minor?: number;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          discount_minor?: number;
          guest_city?: string | null;
          guest_document_id?: string | null;
          guest_email?: string | null;
          guest_id?: string | null;
          guest_name: string;
          guest_nationality?: string | null;
          guest_phone?: string | null;
          guests: number;
          hold_expires_at?: string | null;
          id?: string;
          nights: number;
          payment_status?: Database["public"]["Enums"]["booking_payment_status"];
          property_id: string;
          service_fee_minor?: number;
          status?: Database["public"]["Enums"]["booking_status"];
          subtotal_minor: number;
          total_minor: number;
          updated_at?: string;
        };
        Update: {
          access_token_hash?: string | null;
          affiliate_document_id?: string | null;
          booking_code?: string;
          cancelled_at?: string | null;
          channel?: Database["public"]["Enums"]["booking_channel"];
          check_in?: string;
          check_out?: string;
          cleaning_fee_minor?: number;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          discount_minor?: number;
          guest_city?: string | null;
          guest_document_id?: string | null;
          guest_email?: string | null;
          guest_id?: string | null;
          guest_name?: string;
          guest_nationality?: string | null;
          guest_phone?: string | null;
          guests?: number;
          hold_expires_at?: string | null;
          id?: string;
          nights?: number;
          payment_status?: Database["public"]["Enums"]["booking_payment_status"];
          property_id?: string;
          service_fee_minor?: number;
          status?: Database["public"]["Enums"]["booking_status"];
          subtotal_minor?: number;
          total_minor?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      cleaner_accounts: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          updated_at: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      cleaning_reports: {
        Row: {
          account_id: string;
          created_at: string;
          entry_time: string;
          exit_time: string;
          full_name: string;
          id: string;
          property_id: string | null;
          property_name: string;
          username: string;
          work_date: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          entry_time: string;
          exit_time: string;
          full_name: string;
          id?: string;
          property_id?: string | null;
          property_name: string;
          username: string;
          work_date: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          entry_time?: string;
          exit_time?: string;
          full_name?: string;
          id?: string;
          property_id?: string | null;
          property_name?: string;
          username?: string;
          work_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cleaning_reports_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "cleaner_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cleaning_reports_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      co_owner_accounts: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          property_name: string;
          room_count: number;
          updated_at: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          property_name: string;
          room_count: number;
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          property_name?: string;
          room_count?: number;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      co_owner_stay_guests: {
        Row: {
          birth_date: string;
          created_at: string;
          document_id: string;
          full_name: string;
          id: string;
          phone: string | null;
          sort_order: number;
          stay_id: string;
        };
        Insert: {
          birth_date: string;
          created_at?: string;
          document_id: string;
          full_name: string;
          id?: string;
          phone?: string | null;
          sort_order?: number;
          stay_id: string;
        };
        Update: {
          birth_date?: string;
          created_at?: string;
          document_id?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          sort_order?: number;
          stay_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "co_owner_stay_guests_stay_id_fkey";
            columns: ["stay_id"];
            isOneToOne: false;
            referencedRelation: "co_owner_stays";
            referencedColumns: ["id"];
          },
        ];
      };
      co_owner_stays: {
        Row: {
          account_id: string;
          adults: number;
          birth_date: string | null;
          check_in_at: string;
          check_out_at: string;
          city: string | null;
          created_at: string;
          document_id: string;
          full_name: string;
          id: string;
          minors: number;
          nationality: string | null;
          phone: string;
          property_name: string;
          room_count: number;
          username: string;
        };
        Insert: {
          account_id: string;
          adults: number;
          birth_date?: string | null;
          check_in_at: string;
          check_out_at: string;
          city?: string | null;
          created_at?: string;
          document_id: string;
          full_name: string;
          id?: string;
          minors?: number;
          nationality?: string | null;
          phone: string;
          property_name: string;
          room_count: number;
          username: string;
        };
        Update: {
          account_id?: string;
          adults?: number;
          birth_date?: string | null;
          check_in_at?: string;
          check_out_at?: string;
          city?: string | null;
          created_at?: string;
          document_id?: string;
          full_name?: string;
          id?: string;
          minors?: number;
          nationality?: string | null;
          phone?: string;
          property_name?: string;
          room_count?: number;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "co_owner_stays_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "co_owner_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      declarations: {
        Row: {
          accepted_at: string;
          booking_id: string | null;
          created_at: string;
          data_snapshot: Json;
          document_version: string;
          generated_at: string;
          id: string;
          pdf_path: string;
          stay_id: string | null;
        };
        Insert: {
          accepted_at: string;
          booking_id?: string | null;
          created_at?: string;
          data_snapshot: Json;
          document_version: string;
          generated_at?: string;
          id?: string;
          pdf_path: string;
          stay_id?: string | null;
        };
        Update: {
          accepted_at?: string;
          booking_id?: string | null;
          created_at?: string;
          data_snapshot?: Json;
          document_version?: string;
          generated_at?: string;
          id?: string;
          pdf_path?: string;
          stay_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "declarations_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "declarations_stay_id_fkey";
            columns: ["stay_id"];
            isOneToOne: false;
            referencedRelation: "co_owner_stays";
            referencedColumns: ["id"];
          },
        ];
      };
      id_documents: {
        Row: {
          booking_id: string;
          created_at: string;
          file_path: string;
          id: string;
          mime_type: string;
          side: string;
          size_bytes: number;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          file_path: string;
          id?: string;
          mime_type: string;
          side: string;
          size_bytes: number;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          file_path?: string;
          id?: string;
          mime_type?: string;
          side?: string;
          size_bytes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "id_documents_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      map_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          icon_key: string;
          id: string;
          is_visible: boolean;
          linked_property_id: string | null;
          linked_tower_id: string | null;
          map_id: string;
          metadata: Json;
          name: string;
          normalized_height: number;
          normalized_width: number;
          normalized_x: number;
          normalized_y: number;
          rotation: number;
          status: Database["public"]["Enums"]["map_item_status"];
          type: Database["public"]["Enums"]["map_item_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          icon_key: string;
          id?: string;
          is_visible?: boolean;
          linked_property_id?: string | null;
          linked_tower_id?: string | null;
          map_id: string;
          metadata?: Json;
          name: string;
          normalized_height?: number;
          normalized_width?: number;
          normalized_x: number;
          normalized_y: number;
          rotation?: number;
          status?: Database["public"]["Enums"]["map_item_status"];
          type: Database["public"]["Enums"]["map_item_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          icon_key?: string;
          id?: string;
          is_visible?: boolean;
          linked_property_id?: string | null;
          linked_tower_id?: string | null;
          map_id?: string;
          metadata?: Json;
          name?: string;
          normalized_height?: number;
          normalized_width?: number;
          normalized_x?: number;
          normalized_y?: number;
          rotation?: number;
          status?: Database["public"]["Enums"]["map_item_status"];
          type?: Database["public"]["Enums"]["map_item_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_items_linked_property_id_fkey";
            columns: ["linked_property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_items_linked_tower_id_fkey";
            columns: ["linked_tower_id"];
            isOneToOne: false;
            referencedRelation: "towers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_items_map_id_fkey";
            columns: ["map_id"];
            isOneToOne: false;
            referencedRelation: "maps";
            referencedColumns: ["id"];
          },
        ];
      };
      maps: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          image_height: number | null;
          image_url: string | null;
          image_width: number | null;
          name: string;
          published_at: string | null;
          published_data: Json | null;
          published_image_height: number | null;
          published_image_url: string | null;
          published_image_width: number | null;
          published_version: number | null;
          slug: string;
          status: Database["public"]["Enums"]["map_status"];
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_height?: number | null;
          image_url?: string | null;
          image_width?: number | null;
          name: string;
          published_at?: string | null;
          published_data?: Json | null;
          published_image_height?: number | null;
          published_image_url?: string | null;
          published_image_width?: number | null;
          published_version?: number | null;
          slug: string;
          status?: Database["public"]["Enums"]["map_status"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_height?: number | null;
          image_url?: string | null;
          image_width?: number | null;
          name?: string;
          published_at?: string | null;
          published_data?: Json | null;
          published_image_height?: number | null;
          published_image_url?: string | null;
          published_image_width?: number | null;
          published_version?: number | null;
          slug?: string;
          status?: Database["public"]["Enums"]["map_status"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      mock_payment_state: {
        Row: {
          external_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          external_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          external_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_events: {
        Row: {
          booking_id: string;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          event_type: string;
          id: string;
          metadata: Json | null;
          new_status: Database["public"]["Enums"]["payment_status"] | null;
          old_status: Database["public"]["Enums"]["payment_status"] | null;
          payment_id: string;
          provider_status_code: string | null;
          request_id: string | null;
          source: Database["public"]["Enums"]["payment_event_source"];
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          event_type: string;
          id?: string;
          metadata?: Json | null;
          new_status?: Database["public"]["Enums"]["payment_status"] | null;
          old_status?: Database["public"]["Enums"]["payment_status"] | null;
          payment_id: string;
          provider_status_code?: string | null;
          request_id?: string | null;
          source: Database["public"]["Enums"]["payment_event_source"];
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          event_type?: string;
          id?: string;
          metadata?: Json | null;
          new_status?: Database["public"]["Enums"]["payment_status"] | null;
          old_status?: Database["public"]["Enums"]["payment_status"] | null;
          payment_id?: string;
          provider_status_code?: string | null;
          request_id?: string | null;
          source?: Database["public"]["Enums"]["payment_event_source"];
        };
        Relationships: [
          {
            foreignKeyName: "payment_events_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_events_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_receipts: {
        Row: {
          ai_result: number | null;
          ai_status: string;
          attempt_no: number;
          booking_id: string;
          created_at: string;
          file_path: string;
          id: string;
          mime_type: string;
          payment_id: string;
          sha256: string;
          size_bytes: number;
        };
        Insert: {
          ai_result?: number | null;
          ai_status?: string;
          attempt_no: number;
          booking_id: string;
          created_at?: string;
          file_path: string;
          id?: string;
          mime_type: string;
          payment_id: string;
          sha256: string;
          size_bytes: number;
        };
        Update: {
          ai_result?: number | null;
          ai_status?: string;
          attempt_no?: number;
          booking_id?: string;
          created_at?: string;
          file_path?: string;
          id?: string;
          mime_type?: string;
          payment_id?: string;
          sha256?: string;
          size_bytes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payment_receipts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_receipts_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_minor: number;
          booking_id: string;
          create_response_raw: Json | null;
          created_at: string;
          currency: string;
          expires_at: string;
          external_id: string | null;
          external_qr_code: string | null;
          failed_at: string | null;
          id: string;
          idempotency_key: string;
          last_provider_check_at: string | null;
          last_status_response_raw: Json | null;
          method: Database["public"]["Enums"]["payment_method"];
          paid_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_mode: string | null;
          provider_status_code: string | null;
          qr_image_base64: string | null;
          qr_mime_type: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          booking_id: string;
          create_response_raw?: Json | null;
          created_at?: string;
          currency?: string;
          expires_at: string;
          external_id?: string | null;
          external_qr_code?: string | null;
          failed_at?: string | null;
          id?: string;
          idempotency_key: string;
          last_provider_check_at?: string | null;
          last_status_response_raw?: Json | null;
          method?: Database["public"]["Enums"]["payment_method"];
          paid_at?: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_mode?: string | null;
          provider_status_code?: string | null;
          qr_image_base64?: string | null;
          qr_mime_type?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          booking_id?: string;
          create_response_raw?: Json | null;
          created_at?: string;
          currency?: string;
          expires_at?: string;
          external_id?: string | null;
          external_qr_code?: string | null;
          failed_at?: string | null;
          id?: string;
          idempotency_key?: string;
          last_provider_check_at?: string | null;
          last_status_response_raw?: Json | null;
          method?: Database["public"]["Enums"]["payment_method"];
          paid_at?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_mode?: string | null;
          provider_status_code?: string | null;
          qr_image_base64?: string | null;
          qr_mime_type?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      price_change_history: {
        Row: {
          change_type: Database["public"]["Enums"]["price_change_type"];
          changed_by: string | null;
          created_at: string;
          id: string;
          new_value: Json | null;
          old_value: Json | null;
          property_id: string;
          property_rate_id: string | null;
          reason: string | null;
        };
        Insert: {
          change_type: Database["public"]["Enums"]["price_change_type"];
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          property_id: string;
          property_rate_id?: string | null;
          reason?: string | null;
        };
        Update: {
          change_type?: Database["public"]["Enums"]["price_change_type"];
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          property_id?: string;
          property_rate_id?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "price_change_history_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_history_property_rate_id_fkey";
            columns: ["property_rate_id"];
            isOneToOne: false;
            referencedRelation: "property_rates";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          affiliate_nightly_price_minor: number | null;
          base_price_minor: number;
          bathrooms: number;
          bedrooms: number;
          beds: number;
          check_in_time: string;
          check_out_time: string;
          created_at: string;
          currency: string;
          description: string | null;
          duration_pricing_enabled: boolean;
          featured: boolean;
          id: string;
          location_reference: string | null;
          max_guests: number;
          minimum_nights: number;
          name: string;
          property_type: string | null;
          rules: string | null;
          short_description: string | null;
          slug: string;
          status: Database["public"]["Enums"]["property_status"];
          tower_id: string | null;
          updated_at: string;
          zone: string | null;
        };
        Insert: {
          affiliate_nightly_price_minor?: number | null;
          base_price_minor: number;
          bathrooms?: number;
          bedrooms?: number;
          beds?: number;
          check_in_time?: string;
          check_out_time?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          duration_pricing_enabled?: boolean;
          featured?: boolean;
          id?: string;
          location_reference?: string | null;
          max_guests?: number;
          minimum_nights?: number;
          name: string;
          property_type?: string | null;
          rules?: string | null;
          short_description?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["property_status"];
          tower_id?: string | null;
          updated_at?: string;
          zone?: string | null;
        };
        Update: {
          affiliate_nightly_price_minor?: number | null;
          base_price_minor?: number;
          bathrooms?: number;
          bedrooms?: number;
          beds?: number;
          check_in_time?: string;
          check_out_time?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          duration_pricing_enabled?: boolean;
          featured?: boolean;
          id?: string;
          location_reference?: string | null;
          max_guests?: number;
          minimum_nights?: number;
          name?: string;
          property_type?: string | null;
          rules?: string | null;
          short_description?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["property_status"];
          tower_id?: string | null;
          updated_at?: string;
          zone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "properties_tower_id_fkey";
            columns: ["tower_id"];
            isOneToOne: false;
            referencedRelation: "towers";
            referencedColumns: ["id"];
          },
        ];
      };
      property_amenities: {
        Row: {
          amenity_id: string;
          property_id: string;
        };
        Insert: {
          amenity_id: string;
          property_id: string;
        };
        Update: {
          amenity_id?: string;
          property_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_amenities_amenity_id_fkey";
            columns: ["amenity_id"];
            isOneToOne: false;
            referencedRelation: "amenities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_amenities_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_images: {
        Row: {
          alt_text: string | null;
          created_at: string;
          id: string;
          is_cover: boolean;
          property_id: string;
          sort_order: number;
          url: string;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          is_cover?: boolean;
          property_id: string;
          sort_order?: number;
          url: string;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          is_cover?: boolean;
          property_id?: string;
          sort_order?: number;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_rates: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          label: string | null;
          minimum_nights: number | null;
          nightly_price_minor: number;
          property_id: string;
          start_date: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          label?: string | null;
          minimum_nights?: number | null;
          nightly_price_minor: number;
          property_id: string;
          start_date: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          label?: string | null;
          minimum_nights?: number | null;
          nightly_price_minor?: number;
          property_id?: string;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_rates_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_stay_prices: {
        Row: {
          created_at: string;
          id: string;
          nights: number;
          property_id: string;
          total_price_minor: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nights: number;
          property_id: string;
          total_price_minor: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nights?: number;
          property_id?: string;
          total_price_minor?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_stay_prices_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      towers: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_confirm_ai_payment: {
        Args: { p_actor_id: string; p_payment_id: string };
        Returns: Json;
      };
      admin_reject_payment: {
        Args: { p_actor_id: string; p_payment_id: string; p_reason: string };
        Returns: Json;
      };
      apply_receipt_result: {
        Args: {
          p_mode: string;
          p_payment_id: string;
          // Ajuste manual: `p_receipt_id uuid` acepta NULL (fallback de dedupe/insert).
          p_receipt_id: string | null;
          p_result: number;
        };
        Returns: Json;
      };
      attach_payment_provider_data: {
        Args: {
          p_external_id: string;
          p_payment_id: string;
          p_provider_status_code: string;
          p_qr_code: string;
          p_qr_image_base64: string;
          p_qr_mime_type: string;
          p_raw: Json;
        };
        Returns: undefined;
      };
      calculate_affiliate_booking_price: {
        Args: {
          p_check_in: string;
          p_check_out: string;
          p_guest_count: number;
          p_property_id: string;
        };
        Returns: Json;
      };
      calculate_booking_price: {
        Args: {
          p_check_in: string;
          p_check_out: string;
          p_guest_count: number;
          p_property_id: string;
        };
        Returns: Json;
      };
      cancel_booking: {
        Args: {
          p_actor_id: string;
          p_booking_id: string;
          p_reason: string;
          p_source: Database["public"]["Enums"]["booking_event_source"];
        };
        Returns: Json;
      };
      change_property_base_price: {
        Args: {
          p_actor_id: string;
          p_new_minor: number;
          p_property_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      change_user_role: {
        Args: {
          p_actor_id: string;
          p_new_role: Database["public"]["Enums"]["user_role"];
          p_reason: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      confirm_booking_manual: {
        Args: {
          p_actor_id: string;
          p_booking_id: string;
          p_reason: string;
          p_source: Database["public"]["Enums"]["booking_event_source"];
        };
        Returns: Json;
      };
      confirm_booking_payment: { Args: { p_payment_id: string }; Returns: Json };
      create_admin_booking: {
        Args: {
          // Ajuste manual: args opcionales/nullable del RPC que el generador tipa sin null.
          p_access_token_hash: string | null;
          p_actor_id: string;
          p_check_in: string;
          p_check_out: string;
          p_guest_count: number;
          p_guest_email: string;
          p_guest_name: string;
          p_guest_phone: string | null;
          p_hold_expires_at: string | null;
          p_kind: string;
          p_property_id: string;
          p_reason: string;
          p_source: Database["public"]["Enums"]["booking_event_source"];
        };
        Returns: Json;
      };
      create_affiliate_booking_request: {
        Args: {
          p_affiliate_document_id: string;
          // Ajuste manual: `p_affiliate_email text` acepta NULL.
          p_affiliate_email: string | null;
          p_affiliate_name: string;
          p_affiliate_phone: string;
          p_check_in: string;
          p_check_out: string;
          p_companions: Json;
          p_guest_count: number;
          p_max_pending?: number;
          p_property_id: string;
        };
        Returns: Json;
      };
      create_availability_block: {
        Args: {
          p_actor_id: string;
          p_from: string;
          p_property_id: string;
          p_reason: string;
          p_to: string;
          p_type: Database["public"]["Enums"]["availability_block_type"];
        };
        Returns: Json;
      };
      create_booking_with_hold: {
        Args: {
          p_access_token_hash: string;
          p_check_in: string;
          p_check_out: string;
          p_guest_count: number;
          p_guest_email: string;
          p_guest_name: string;
          // Ajuste manual: el parámetro SQL `p_guest_phone text` acepta NULL.
          // El generador lo tipa como string; reaplicar este `| null` tras regenerar.
          p_guest_phone: string | null;
          p_hold_minutes?: number;
          p_property_id: string;
        };
        Returns: Json;
      };
      create_payment_intent: {
        Args: {
          p_booking_id: string;
          p_expires_at: string;
          p_idempotency_key: string;
          p_method: Database["public"]["Enums"]["payment_method"];
          p_provider: Database["public"]["Enums"]["payment_provider"];
          p_provider_mode: string;
        };
        Returns: Json;
      };
      create_property_rate: {
        Args: {
          p_actor_id: string;
          p_end: string;
          p_label: string;
          p_minimum_nights: number;
          p_price_minor: number;
          p_property_id: string;
          p_reason: string;
          p_start: string;
        };
        Returns: Json;
      };
      expire_booking_admin: {
        Args: {
          p_actor_id: string;
          p_booking_id: string;
          p_reason: string;
          p_source: Database["public"]["Enums"]["booking_event_source"];
        };
        Returns: Json;
      };
      expire_payment: { Args: { p_payment_id: string }; Returns: boolean };
      expire_stale_holds: { Args: never; Returns: number };
      expire_stale_payments: { Args: never; Returns: number };
      generate_booking_code: { Args: never; Returns: string };
      get_property_availability: {
        Args: { p_from: string; p_property_id: string; p_to: string };
        Returns: {
          stay_range: unknown;
        }[];
      };
      is_admin: { Args: never; Returns: boolean };
      is_staff: { Args: never; Returns: boolean };
      mark_booking_manual_review: {
        Args: {
          p_actor_id: string;
          p_booking_id: string;
          p_reason: string;
          p_source: Database["public"]["Enums"]["booking_event_source"];
        };
        Returns: Json;
      };
      record_payment_error: {
        Args: {
          p_payment_id: string;
          p_provider_status_code: string;
          p_raw: Json;
        };
        Returns: undefined;
      };
      register_cleaning: {
        Args: {
          p_entry_time: string;
          p_exit_time: string;
          p_property_id: string;
          p_work_date: string;
        };
        Returns: Json;
      };
      register_co_owner_stay: {
        Args: {
          p_adults: number;
          p_check_in_at: string;
          p_check_out_at: string;
          p_document_id: string;
          p_full_name: string;
          p_minors: number;
          p_phone: string;
        };
        Returns: Json;
      };
      release_availability_block: {
        Args: { p_actor_id: string; p_block_id: string; p_reason: string };
        Returns: Json;
      };
      remove_property_rate: {
        Args: { p_actor_id: string; p_rate_id: string; p_reason: string };
        Returns: Json;
      };
      save_property_pricing: {
        Args: {
          p_actor_id: string;
          p_base_price_minor: number;
          p_duration_pricing_enabled: boolean;
          p_prices: Json;
          p_property_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      set_booking_companions: {
        Args: { p_actor_id: string; p_booking_id: string; p_companions: Json };
        Returns: Json;
      };
      set_property_affiliate_pricing: {
        Args: {
          p_actor_id: string;
          // Ajuste manual: `p_nightly_minor` acepta NULL (deshabilitar precio afiliado).
          p_nightly_minor: number | null;
          p_property_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      update_admin_booking: {
        Args: {
          p_actor_id: string;
          p_booking_id: string;
          p_check_in: string;
          p_check_out: string;
          p_guest_count: number;
          p_guest_email: string;
          p_guest_name: string;
          // Ajuste manual: args nullable del RPC que el generador tipa sin null.
          p_guest_phone: string | null;
          p_hold_expires_at: string | null;
          p_property_id: string;
          p_reason: string;
          p_source: Database["public"]["Enums"]["booking_event_source"];
        };
        Returns: Json;
      };
      update_availability_block: {
        Args: {
          p_actor_id: string;
          p_block_id: string;
          p_from: string;
          p_property_id: string;
          p_reason: string;
          p_to: string;
          p_type: Database["public"]["Enums"]["availability_block_type"];
        };
        Returns: Json;
      };
      update_property_rate: {
        Args: {
          p_actor_id: string;
          p_end: string;
          p_label: string;
          p_minimum_nights: number;
          p_price_minor: number;
          p_rate_id: string;
          p_reason: string;
          p_start: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      availability_block_status: "active" | "released" | "expired";
      availability_block_type:
        "maintenance" | "internal_use" | "owner_use" | "operational" | "manual" | "other";
      booking_channel: "direct" | "admin" | "affiliate";
      booking_event_source: "system" | "guest" | "admin" | "operator" | "payment" | "expiration";
      booking_event_type:
        | "created"
        | "status_changed"
        | "cancelled"
        | "expired"
        | "manual_review"
        | "confirmed_manual"
        | "hold_released"
        | "refund_required"
        | "note";
      booking_payment_status:
        "unpaid" | "pending" | "paid" | "expired" | "failed" | "refunded" | "refund_required";
      booking_status:
        | "draft"
        | "pending_payment"
        | "confirmed"
        | "expired"
        | "cancelled"
        | "completed"
        | "manual_review";
      hold_status: "active" | "converted" | "expired" | "released";
      map_item_status: "draft" | "published" | "archived";
      map_item_type:
        | "house"
        | "tower"
        | "restaurant"
        | "clubhouse"
        | "entrance"
        | "pool"
        | "sports"
        | "parking"
        | "office"
        | "social_area"
        | "poi";
      map_status: "draft" | "published" | "archived";
      payment_event_source:
        "create" | "browser_poll" | "manual_verify" | "cron" | "admin" | "reconciliation";
      payment_method: "qr";
      payment_provider: "mock" | "bnb" | "transfer";
      payment_status:
        | "created"
        | "pending"
        | "paid"
        | "expired"
        | "error"
        | "cancelled"
        | "refunded"
        | "manual_review"
        | "ai_approved";
      price_change_type:
        | "base_price"
        | "rate_create"
        | "rate_update"
        | "rate_remove"
        | "duration_pricing_update"
        | "affiliate_price";
      price_item_type: "nightly_rate" | "cleaning_fee" | "service_fee" | "discount";
      property_status: "draft" | "published" | "paused" | "archived";
      user_role: "guest" | "admin" | "operator" | "co_owner" | "cleaner";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      availability_block_status: ["active", "released", "expired"],
      availability_block_type: [
        "maintenance",
        "internal_use",
        "owner_use",
        "operational",
        "manual",
        "other",
      ],
      booking_channel: ["direct", "admin", "affiliate"],
      booking_event_source: ["system", "guest", "admin", "operator", "payment", "expiration"],
      booking_event_type: [
        "created",
        "status_changed",
        "cancelled",
        "expired",
        "manual_review",
        "confirmed_manual",
        "hold_released",
        "refund_required",
        "note",
      ],
      booking_payment_status: [
        "unpaid",
        "pending",
        "paid",
        "expired",
        "failed",
        "refunded",
        "refund_required",
      ],
      booking_status: [
        "draft",
        "pending_payment",
        "confirmed",
        "expired",
        "cancelled",
        "completed",
        "manual_review",
      ],
      hold_status: ["active", "converted", "expired", "released"],
      map_item_status: ["draft", "published", "archived"],
      map_item_type: [
        "house",
        "tower",
        "restaurant",
        "clubhouse",
        "entrance",
        "pool",
        "sports",
        "parking",
        "office",
        "social_area",
        "poi",
      ],
      map_status: ["draft", "published", "archived"],
      payment_event_source: [
        "create",
        "browser_poll",
        "manual_verify",
        "cron",
        "admin",
        "reconciliation",
      ],
      payment_method: ["qr"],
      payment_provider: ["mock", "bnb", "transfer"],
      payment_status: [
        "created",
        "pending",
        "paid",
        "expired",
        "error",
        "cancelled",
        "refunded",
        "manual_review",
        "ai_approved",
      ],
      price_change_type: [
        "base_price",
        "rate_create",
        "rate_update",
        "rate_remove",
        "duration_pricing_update",
        "affiliate_price",
      ],
      price_item_type: ["nightly_rate", "cleaning_fee", "service_fee", "discount"],
      property_status: ["draft", "published", "paused", "archived"],
      user_role: ["guest", "admin", "operator", "co_owner", "cleaner"],
    },
  },
} as const;
