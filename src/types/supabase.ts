export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ListingType = 'product' | 'service';
export type ItemCondition = 'new' | 'like_new' | 'used';
export type TransactionStatus = 
  | 'scheduled' 
  | 'completed' 
  | 'cancelled' 
  | 'buyer_no_show' 
  | 'seller_no_show' 
  | 'disputed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          campus_email: string
          campus_name: string
          nim: string
          whatsapp_number: string
          reliability_score: number
          created_at: string
        }
        Insert: {
          id: string
          campus_email: string
          campus_name: string
          nim: string
          whatsapp_number: string
          reliability_score?: number
          created_at?: string
        }
        Update: {
          id?: string
          campus_email?: string
          campus_name?: string
          nim?: string
          whatsapp_number?: string
          reliability_score?: number
          created_at?: string
        }
        Relationships: []
      }
      campus_safe_zones: {
        Row: {
          id: string
          campus_name: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          campus_name: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          campus_name?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          id: string
          seller_id: string
          type: ListingType
          title: string
          price: number
          campus_name: string
          images: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          type: ListingType
          title: string
          price: number
          campus_name: string
          images?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          seller_id?: string
          type?: ListingType
          title?: string
          price?: number
          campus_name?: string
          images?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      listing_products: {
        Row: {
          id: string
          condition: ItemCondition
          stock: number
        }
        Insert: {
          id: string
          condition: ItemCondition
          stock: number
        }
        Update: {
          id?: string
          condition?: ItemCondition
          stock?: number
        }
        Relationships: []
      }
      listing_services: {
        Row: {
          id: string
          delivery_estimate_days: number
          revision_limit: number
          scope_description: string
        }
        Insert: {
          id: string
          delivery_estimate_days: number
          revision_limit: number
          scope_description: string
        }
        Update: {
          id?: string
          delivery_estimate_days?: number
          revision_limit?: number
          scope_description?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          listing_id: string
          seller_id: string
          buyer_id: string
          safe_zone_id: string
          scheduled_at: string
          handshake_otp: string
          status: TransactionStatus
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          seller_id: string
          buyer_id: string
          safe_zone_id: string
          scheduled_at: string
          handshake_otp: string
          status?: TransactionStatus
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          seller_id?: string
          buyer_id?: string
          safe_zone_id?: string
          scheduled_at?: string
          handshake_otp?: string
          status?: TransactionStatus
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      verify_handshake: {
        Args: {
          p_transaction_id: string
          p_input_otp: string
        }
        Returns: void
      }
      get_buyer_otp: {
        Args: {
          p_transaction_id: string
        }
        Returns: string
      }
    }
    Enums: {
      listing_type: ListingType
      item_condition: ItemCondition
      transaction_status: TransactionStatus
    }
  }
}
