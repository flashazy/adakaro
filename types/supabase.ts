export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "parent" | "super_admin";
export type SchoolStatus = "active" | "suspended";
export type StudentStatus = "active" | "inactive" | "graduated" | "transferred";
export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "mobile_money"
  | "card"
  | "cheque"
  | "clickpesa";
export type PaymentStatusType = "completed" | "pending" | "failed" | "refunded";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      admin_activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          user_email: string;
          user_role: "admin" | "super_admin";
          school_id: string | null;
          action: string;
          action_details: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_email?: string;
          user_role: "admin" | "super_admin";
          school_id?: string | null;
          action: string;
          action_details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string | null;
          user_email?: string;
          user_role?: "admin" | "super_admin";
          school_id?: string | null;
          action?: string;
          action_details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
        };
      };
      schools: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          currency: string;
          plan: string;
          status: SchoolStatus;
          suspension_reason: string | null;
          plan_expires_at: string | null;
          student_limit: number | null;
          admin_limit: number | null;
          admission_prefix: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          logo_url?: string | null;
          currency?: string;
          plan?: string;
          status?: SchoolStatus;
          suspension_reason?: string | null;
          plan_expires_at?: string | null;
          student_limit?: number | null;
          admin_limit?: number | null;
          admission_prefix?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          logo_url?: string | null;
          currency?: string;
          plan?: string;
          status?: SchoolStatus;
          suspension_reason?: string | null;
          plan_expires_at?: string | null;
          student_limit?: number | null;
          admin_limit?: number | null;
          admission_prefix?: string | null;
          updated_at?: string;
        };
      };
      school_admission_counters: {
        Row: {
          school_id: string;
          next_number: number;
          updated_at: string;
        };
        Insert: {
          school_id: string;
          next_number?: number;
          updated_at?: string;
        };
        Update: {
          next_number?: number;
          updated_at?: string;
        };
      };
      school_members: {
        Row: {
          id: string;
          school_id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          role?: UserRole;
        };
      };
      school_invitations: {
        Row: {
          id: string;
          school_id: string;
          invited_email: string;
          invited_by: string;
          token: string;
          status: string;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          school_id: string;
          invited_email: string;
          invited_by: string;
          token: string;
          status?: string;
          created_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          status?: string;
          accepted_at?: string | null;
          expires_at?: string;
        };
      };
      upgrade_requests: {
        Row: {
          id: string;
          school_id: string;
          requested_by: string;
          current_plan: string;
          requested_plan: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          requested_by: string;
          current_plan: string;
          requested_plan: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          updated_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          class_id: string;
          full_name: string;
          admission_number: string | null;
          parent_name: string | null;
          parent_email: string | null;
          parent_phone: string | null;
          date_of_birth: string | null;
          gender: string | null;
          status: StudentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_id: string;
          full_name: string;
          admission_number?: string | null;
          parent_name?: string | null;
          parent_email?: string | null;
          parent_phone?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          status?: StudentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          full_name?: string;
          admission_number?: string | null;
          parent_name?: string | null;
          parent_email?: string | null;
          parent_phone?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          status?: StudentStatus;
          updated_at?: string;
        };
      };
      fee_types: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          description: string | null;
          is_recurring: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          description?: string | null;
          is_recurring?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_recurring?: boolean;
          updated_at?: string;
        };
      };
      fee_structures: {
        Row: {
          id: string;
          school_id: string;
          fee_type_id: string | null;
          class_id: string | null;
          student_id: string | null;
          name: string;
          amount: number;
          term: string;
          due_date: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          fee_type_id?: string | null;
          class_id?: string | null;
          student_id?: string | null;
          name: string;
          amount: number;
          term: string;
          due_date?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          fee_type_id?: string | null;
          class_id?: string | null;
          student_id?: string | null;
          name?: string;
          amount?: number;
          term?: string;
          due_date?: string | null;
          description?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          student_id: string;
          fee_structure_id: string;
          amount: number;
          payment_method: PaymentMethod;
          status: PaymentStatusType;
          payment_date: string;
          reference_number: string | null;
          recorded_by: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          fee_structure_id: string;
          amount: number;
          payment_method: PaymentMethod;
          status?: PaymentStatusType;
          payment_date?: string;
          reference_number?: string | null;
          recorded_by: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          payment_method?: PaymentMethod;
          status?: PaymentStatusType;
          payment_date?: string;
          reference_number?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      receipts: {
        Row: {
          id: string;
          payment_id: string;
          receipt_number: string;
          issued_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          receipt_number?: string;
          issued_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          issued_at?: string;
          updated_at?: string;
        };
      };
      parent_students: {
        Row: {
          id: string;
          parent_id: string;
          student_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          student_id: string;
          created_at?: string;
        };
        Update: {
          parent_id?: string;
          student_id?: string;
        };
      };
      parent_link_requests: {
        Row: {
          id: string;
          parent_id: string;
          admission_number: string;
          student_id: string | null;
          school_id: string | null;
          status: "pending" | "approved" | "rejected";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          admission_number: string;
          student_id?: string | null;
          school_id?: string | null;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "approved" | "rejected";
          updated_at?: string;
        };
      };
      clickpesa_fee_bills: {
        Row: {
          id: string;
          student_id: string;
          fee_structure_id: string;
          parent_id: string;
          control_number: string | null;
          checkout_link: string | null;
          order_reference: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          fee_structure_id: string;
          parent_id: string;
          control_number?: string | null;
          checkout_link?: string | null;
          order_reference: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          control_number?: string | null;
          checkout_link?: string | null;
          order_reference?: string;
          amount?: number;
        };
      };
      school_reactivation_bills: {
        Row: {
          id: string;
          school_id: string;
          user_id: string;
          order_reference: string;
          amount: number;
          currency: string;
          status: "pending" | "paid" | "failed";
          control_number: string | null;
          checkout_link: string | null;
          payment_reference: string | null;
          paid_at: string | null;
          raw_webhook_last: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id: string;
          order_reference: string;
          amount: number;
          currency?: string;
          status?: "pending" | "paid" | "failed";
          control_number?: string | null;
          checkout_link?: string | null;
          payment_reference?: string | null;
          paid_at?: string | null;
          raw_webhook_last?: Json | null;
          created_at?: string;
        };
        Update: {
          status?: "pending" | "paid" | "failed";
          control_number?: string | null;
          checkout_link?: string | null;
          payment_reference?: string | null;
          paid_at?: string | null;
          raw_webhook_last?: Json | null;
        };
      };
      clickpesa_payment_transactions: {
        Row: {
          id: string;
          clickpesa_bill_id: string;
          payment_reference: string | null;
          amount: number;
          status: string;
          raw_webhook: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          clickpesa_bill_id: string;
          payment_reference?: string | null;
          amount: number;
          status?: string;
          raw_webhook?: Json | null;
          created_at?: string;
        };
        Update: {
          payment_reference?: string | null;
          amount?: number;
          status?: string;
          raw_webhook?: Json | null;
        };
      };
    };
    Views: {
      student_fee_balances: {
        Row: {
          student_id: string;
          student_name: string;
          school_id: string;
          class_id: string;
          parent_id: string;
          fee_structure_id: string;
          fee_name: string;
          term: string;
          total_fee: number;
          total_paid: number;
          balance: number;
          due_date: string | null;
        };
      };
    };
    Functions: {
      create_founding_school: {
        Args: {
          p_name: string;
          p_address?: string | null;
          p_phone?: string | null;
          p_email?: string | null;
          p_logo_url?: string | null;
          p_currency?: string | null;
          p_admission_prefix?: string | null;
        };
        Returns: string;
      };
      generate_unique_prefix: {
        Args: { p_school_name: string };
        Returns: string;
      };
      peek_next_admission_number: {
        Args: { p_school_id: string };
        Returns: string | null;
      };
      get_next_admission_number: {
        Args: { p_school_id: string };
        Returns: string;
      };
      get_my_school_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      get_my_school_for_dashboard: {
        Args: Record<string, never>;
        Returns: Json | null;
      };
      get_school_role: {
        Args: { p_school_id: string };
        Returns: UserRole | null;
      };
      is_school_admin: {
        Args: { p_school_id: string };
        Returns: boolean;
      };
      user_school_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      parent_student_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      lookup_student_by_admission: {
        Args: { adm_number: string; p_prefer_school_id?: string | null };
        Returns: { student_id: string; school_id: string }[];
      };
      get_pending_parent_link_requests_for_admin: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          parent_id: string;
          admission_number: string;
          student_id: string | null;
          created_at: string;
        }[];
      };
      admin_approve_parent_link_request: {
        Args: { p_request_id: string; p_student_id: string };
        Returns: Json;
      };
      admin_reject_parent_link_request: {
        Args: { p_request_id: string };
        Returns: Json;
      };
      accept_school_invitation: {
        Args: { p_token: string };
        Returns: Json;
      };
      is_email_already_school_admin: {
        Args: { p_school_id: string; p_email: string };
        Returns: boolean;
      };
      peek_school_invitation: {
        Args: { p_token: string };
        Returns: Json;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_user_blocked_by_school_suspension: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      school_is_operational: {
        Args: { p_school_id: string };
        Returns: boolean;
      };
      super_admin_create_school: {
        Args: {
          p_name: string;
          p_currency: string;
          p_plan: string;
          p_admin_user_id: string;
        };
        Returns: string;
      };
      super_admin_dashboard_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      super_admin_list_schools_with_counts: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          plan: string;
          currency: string;
          created_at: string;
          created_by: string;
          admin_count: number;
          student_count: number;
        }[];
      };
      super_admin_review_upgrade_request: {
        Args: { p_request_id: string; p_approve: boolean };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      school_status: SchoolStatus;
      student_status: StudentStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatusType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience row type aliases
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type School = Database["public"]["Tables"]["schools"]["Row"];
export type SchoolMember = Database["public"]["Tables"]["school_members"]["Row"];
export type Class = Database["public"]["Tables"]["classes"]["Row"];
export type Student = Database["public"]["Tables"]["students"]["Row"];
export type FeeType = Database["public"]["Tables"]["fee_types"]["Row"];
export type FeeStructure = Database["public"]["Tables"]["fee_structures"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type ParentStudent = Database["public"]["Tables"]["parent_students"]["Row"];
export type ParentLinkRequest = Database["public"]["Tables"]["parent_link_requests"]["Row"];
export type SchoolInvitation = Database["public"]["Tables"]["school_invitations"]["Row"];
export type UpgradeRequest = Database["public"]["Tables"]["upgrade_requests"]["Row"];
export type StudentFeeBalance = Database["public"]["Views"]["student_fee_balances"]["Row"];
