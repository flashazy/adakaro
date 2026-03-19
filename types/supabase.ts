export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "parent";
export type StudentStatus = "active" | "inactive" | "graduated" | "transferred";
export type PaymentMethod = "cash" | "bank_transfer" | "mobile_money" | "card" | "cheque" | "azampay";
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
      schools: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
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
        Args: { adm_number: string };
        Returns: { student_id: string; school_id: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
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
export type StudentFeeBalance = Database["public"]["Views"]["student_fee_balances"]["Row"];
