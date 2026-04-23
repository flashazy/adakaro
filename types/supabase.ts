export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "parent" | "super_admin" | "teacher";
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
          password_changed: boolean;
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
          password_changed?: boolean;
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
          password_changed?: boolean;
          updated_at?: string;
        };
      };
      academic_reports: {
        Row: {
          id: string;
          school_id: string;
          class_id: string;
          term: string;
          academic_year: string;
          report_data: Json;
          generated_at: string;
          generated_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          class_id: string;
          term: string;
          academic_year: string;
          report_data?: Json;
          generated_at?: string;
          generated_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          school_id?: string;
          class_id?: string;
          term?: string;
          academic_year?: string;
          report_data?: Json;
          generated_at?: string;
          generated_by?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_reports_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_reports_class_id_fkey";
            columns: ["class_id"];
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_reports_generated_by_fkey";
            columns: ["generated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      admin_report_preferences: {
        Row: {
          id: string;
          enabled: boolean;
          frequency: "weekly" | "monthly" | null;
          day_of_week: number | null;
          day_of_month: number | null;
          recipients: string[];
          export_to_email_enabled: boolean;
          last_sent: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          enabled?: boolean;
          frequency?: "weekly" | "monthly" | null;
          day_of_week?: number | null;
          day_of_month?: number | null;
          recipients?: string[];
          export_to_email_enabled?: boolean;
          last_sent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          frequency?: "weekly" | "monthly" | null;
          day_of_week?: number | null;
          day_of_month?: number | null;
          recipients?: string[];
          export_to_email_enabled?: boolean;
          last_sent?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      broadcast_reads: {
        Row: {
          id: string;
          broadcast_id: string;
          user_id: string;
          read_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          broadcast_id: string;
          user_id: string;
          read_at?: string;
          created_at?: string;
        };
        Update: {
          read_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "broadcast_reads_broadcast_id_fkey";
            columns: ["broadcast_id"];
            referencedRelation: "broadcasts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "broadcast_reads_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      broadcasts: {
        Row: {
          id: string;
          title: string;
          message: string;
          is_urgent: boolean;
          sent_by: string;
          sent_at: string;
          target_user_ids: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          message: string;
          is_urgent?: boolean;
          sent_by: string;
          sent_at?: string;
          target_user_ids?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          message?: string;
          is_urgent?: boolean;
          sent_at?: string;
          target_user_ids?: string[] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "broadcasts_sent_by_fkey";
            columns: ["sent_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          city: string | null;
          postal_code: string | null;
          phone: string | null;
          email: string | null;
          registration_number: string | null;
          motto: string | null;
          primary_color: string | null;
          logo_url: string | null;
          currency: string;
          plan: string;
          status: SchoolStatus;
          suspension_reason: string | null;
          plan_expires_at: string | null;
          student_limit: number | null;
          admin_limit: number | null;
          admission_prefix: string | null;
          school_level: "primary" | "secondary";
          current_academic_year: string | null;
          term_structure: "2_terms" | "3_terms" | null;
          term_1_start: string | null;
          term_1_end: string | null;
          term_2_start: string | null;
          term_2_end: string | null;
          term_3_start: string | null;
          term_3_end: string | null;
          timezone: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          phone?: string | null;
          email?: string | null;
          registration_number?: string | null;
          motto?: string | null;
          primary_color?: string | null;
          logo_url?: string | null;
          currency?: string;
          plan?: string;
          status?: SchoolStatus;
          suspension_reason?: string | null;
          plan_expires_at?: string | null;
          student_limit?: number | null;
          admin_limit?: number | null;
          admission_prefix?: string | null;
          school_level?: "primary" | "secondary";
          current_academic_year?: string | null;
          term_structure?: "2_terms" | "3_terms" | null;
          term_1_start?: string | null;
          term_1_end?: string | null;
          term_2_start?: string | null;
          term_2_end?: string | null;
          term_3_start?: string | null;
          term_3_end?: string | null;
          timezone?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
          city?: string | null;
          postal_code?: string | null;
          phone?: string | null;
          email?: string | null;
          registration_number?: string | null;
          motto?: string | null;
          primary_color?: string | null;
          logo_url?: string | null;
          currency?: string;
          plan?: string;
          status?: SchoolStatus;
          suspension_reason?: string | null;
          plan_expires_at?: string | null;
          student_limit?: number | null;
          admin_limit?: number | null;
          admission_prefix?: string | null;
          school_level?: "primary" | "secondary";
          current_academic_year?: string | null;
          term_structure?: "2_terms" | "3_terms" | null;
          term_1_start?: string | null;
          term_1_end?: string | null;
          term_2_start?: string | null;
          term_2_end?: string | null;
          term_3_start?: string | null;
          term_3_end?: string | null;
          timezone?: string | null;
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
          parent_class_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          description?: string | null;
          parent_class_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          parent_class_id?: string | null;
          updated_at?: string;
        };
      };
      subjects: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          code: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          code?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          code?: string | null;
          description?: string | null;
          updated_at?: string;
        };
      };
      subject_classes: {
        Row: {
          id: string;
          subject_id: string;
          class_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          class_id: string;
          created_at?: string;
        };
        Update: {
          subject_id?: string;
          class_id?: string;
        };
      };
      student_academic_records: {
        Row: {
          id: string;
          student_id: string;
          academic_year: number;
          term: "Term 1" | "Term 2";
          notes: string | null;
          special_needs: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          academic_year: number;
          term: "Term 1" | "Term 2";
          notes?: string | null;
          special_needs?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          academic_year?: number;
          term?: "Term 1" | "Term 2";
          notes?: string | null;
          special_needs?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_academic_records_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_academic_records_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_discipline_records: {
        Row: {
          id: string;
          student_id: string;
          incident_date: string;
          incident_type:
            | "warning"
            | "detention"
            | "suspension"
            | "expulsion"
            | "other";
          description: string;
          action_taken: string | null;
          status: "pending" | "resolved" | "appealed";
          resolved_date: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          incident_date: string;
          incident_type:
            | "warning"
            | "detention"
            | "suspension"
            | "expulsion"
            | "other";
          description: string;
          action_taken?: string | null;
          status?: "pending" | "resolved" | "appealed";
          resolved_date?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          incident_date?: string;
          incident_type?:
            | "warning"
            | "detention"
            | "suspension"
            | "expulsion"
            | "other";
          description?: string;
          action_taken?: string | null;
          status?: "pending" | "resolved" | "appealed";
          resolved_date?: string | null;
          recorded_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_discipline_records_recorded_by_fkey";
            columns: ["recorded_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_discipline_records_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_finance_records: {
        Row: {
          id: string;
          student_id: string;
          academic_year: number;
          term: "Term 1" | "Term 2";
          fee_balance: number;
          scholarship_amount: number;
          scholarship_type: string | null;
          payment_notes: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          academic_year: number;
          term: "Term 1" | "Term 2";
          fee_balance?: number;
          scholarship_amount?: number;
          scholarship_type?: string | null;
          payment_notes?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          academic_year?: number;
          term?: "Term 1" | "Term 2";
          fee_balance?: number;
          scholarship_amount?: number;
          scholarship_type?: string | null;
          payment_notes?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_finance_records_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_finance_records_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_health_records: {
        Row: {
          id: string;
          student_id: string;
          condition: string;
          severity: "mild" | "moderate" | "severe" | null;
          medication: string | null;
          special_care_notes: string | null;
          emergency_contact_phone: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          condition: string;
          severity?: "mild" | "moderate" | "severe" | null;
          medication?: string | null;
          special_care_notes?: string | null;
          emergency_contact_phone?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          condition?: string;
          severity?: "mild" | "moderate" | "severe" | null;
          medication?: string | null;
          special_care_notes?: string | null;
          emergency_contact_phone?: string | null;
          recorded_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_health_records_recorded_by_fkey";
            columns: ["recorded_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_health_records_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_department_roles: {
        Row: {
          id: string;
          school_id: string;
          user_id: string;
          department: "academic" | "discipline" | "health" | "finance";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id: string;
          department: "academic" | "discipline" | "health" | "finance";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          school_id?: string;
          user_id?: string;
          department?: "academic" | "discipline" | "health" | "finance";
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_department_roles_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_department_roles_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_coordinators: {
        Row: {
          id: string;
          teacher_id: string;
          class_id: string;
          school_id: string;
          assigned_at: string;
          assigned_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          class_id: string;
          school_id: string;
          assigned_at?: string;
          assigned_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          teacher_id?: string;
          class_id?: string;
          school_id?: string;
          assigned_at?: string;
          assigned_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_coordinators_teacher_id_fkey";
            columns: ["teacher_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_coordinators_class_id_fkey";
            columns: ["class_id"];
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_coordinators_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_coordinators_assigned_by_fkey";
            columns: ["assigned_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      school_member_record_attachment_scopes: {
        Row: {
          school_id: string;
          user_id: string;
          scope: "health" | "discipline";
          created_at: string;
        };
        Insert: {
          school_id: string;
          user_id: string;
          scope: "health" | "discipline";
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_member_record_attachment_scopes_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "school_member_record_attachment_scopes_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_record_attachments: {
        Row: {
          id: string;
          record_id: string;
          record_type: "discipline" | "health";
          file_name: string;
          file_url: string;
          file_size: number | null;
          mime_type: string | null;
          description: string | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          record_id: string;
          record_type: "discipline" | "health";
          file_name: string;
          file_url: string;
          file_size?: number | null;
          mime_type?: string | null;
          description?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          record_id?: string;
          record_type?: "discipline" | "health";
          file_name?: string;
          file_url?: string;
          file_size?: number | null;
          mime_type?: string | null;
          description?: string | null;
          uploaded_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_record_attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
          gender: "male" | "female" | null;
          enrollment_date: string;
          status: StudentStatus;
          avatar_url: string | null;
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
          gender?: "male" | "female" | null;
          enrollment_date?: string;
          status?: StudentStatus;
          avatar_url?: string | null;
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
          gender?: "male" | "female" | null;
          enrollment_date?: string;
          status?: StudentStatus;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      student_subject_enrollment: {
        Row: {
          id: string;
          student_id: string;
          subject_id: string;
          class_id: string;
          academic_year: number;
          term: "Term 1" | "Term 2";
          enrolled_from: string;
          enrolled_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          subject_id: string;
          class_id: string;
          academic_year?: number;
          term: "Term 1" | "Term 2";
          enrolled_from?: string;
          enrolled_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          student_id?: string;
          subject_id?: string;
          class_id?: string;
          academic_year?: number;
          term?: "Term 1" | "Term 2";
          enrolled_from?: string;
          enrolled_to?: string | null;
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
      parent_viewed_results: {
        Row: {
          parent_id: string;
          student_id: string;
          subject: string;
          assignment_id: string;
          viewed_at: string;
        };
        Insert: {
          parent_id: string;
          student_id: string;
          subject: string;
          assignment_id: string;
          viewed_at?: string;
        };
        Update: {
          subject?: string;
          viewed_at?: string;
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
      teacher_assignments: {
        Row: {
          id: string;
          teacher_id: string;
          school_id: string;
          class_id: string;
          subject: string;
          subject_id: string | null;
          academic_year: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          school_id: string;
          class_id: string;
          subject?: string;
          subject_id?: string | null;
          academic_year: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          teacher_id?: string;
          school_id?: string;
          class_id?: string;
          subject?: string;
          subject_id?: string | null;
          academic_year?: string;
          updated_at?: string;
        };
      };
      teacher_attendance: {
        Row: {
          id: string;
          teacher_id: string;
          school_id: string;
          class_id: string;
          student_id: string;
          attendance_date: string;
          status: "present" | "absent" | "late";
          subject_id: string | null;
          attendance_scope_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          school_id: string;
          class_id: string;
          student_id: string;
          attendance_date: string;
          status: "present" | "absent" | "late";
          subject_id?: string | null;
          attendance_scope_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          teacher_id?: string;
          school_id?: string;
          class_id?: string;
          student_id?: string;
          attendance_date?: string;
          status?: "present" | "absent" | "late";
          subject_id?: string | null;
          attendance_scope_key?: string;
          updated_at?: string;
        };
      };
      teacher_documents: {
        Row: {
          id: string;
          teacher_id: string;
          document_name: string;
          file_url: string;
          file_type: string;
          file_size: number | null;
          category: string;
          uploaded_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          document_name: string;
          file_url: string;
          file_type: string;
          file_size?: number | null;
          category?: string;
          uploaded_at?: string;
          updated_at?: string;
        };
        Update: {
          document_name?: string;
          file_url?: string;
          file_type?: string;
          file_size?: number | null;
          category?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teacher_gradebook_assignments: {
        Row: {
          id: string;
          teacher_id: string;
          class_id: string;
          subject: string;
          title: string;
          max_score: number;
          weight: number;
          due_date: string | null;
          academic_year: string;
          exam_type: string | null;
          term: "Term 1" | "Term 2" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          class_id: string;
          subject?: string;
          title: string;
          max_score: number;
          weight?: number;
          due_date?: string | null;
          academic_year?: string;
          exam_type?: string | null;
          term?: "Term 1" | "Term 2" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          teacher_id?: string;
          class_id?: string;
          subject?: string;
          title?: string;
          max_score?: number;
          weight?: number;
          due_date?: string | null;
          academic_year?: string;
          exam_type?: string | null;
          term?: "Term 1" | "Term 2" | null;
          updated_at?: string;
        };
      };
      teacher_invitations: {
        Row: {
          id: string;
          email: string;
          school_id: string;
          class_id: string | null;
          subject: string;
          academic_year: string;
          token: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
          used_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          school_id: string;
          class_id?: string | null;
          subject?: string;
          academic_year?: string;
          token: string;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
          used_at?: string | null;
        };
        Update: {
          email?: string;
          school_id?: string;
          class_id?: string | null;
          subject?: string;
          academic_year?: string;
          token?: string;
          expires_at?: string;
          updated_at?: string;
          used_at?: string | null;
        };
      };
      teacher_scores: {
        Row: {
          id: string;
          assignment_id: string;
          student_id: string;
          score: number | null;
          comments: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          student_id: string;
          score?: number | null;
          comments?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          student_id?: string;
          score?: number | null;
          comments?: string | null;
          updated_at?: string;
        };
      };
      teacher_subjects: {
        Row: {
          id: string;
          teacher_id: string;
          subject_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          subject_id: string;
          created_at?: string;
        };
        Update: {
          teacher_id?: string;
          subject_id?: string;
        };
        Relationships: [];
      };
      lesson_plans: {
        Row: {
          id: string;
          teacher_id: string;
          class_id: string;
          subject_id: string;
          lesson_date: string;
          period: string;
          duration_minutes: number;
          total_boys: number;
          total_girls: number;
          total_pupils: number;
          present_count: number;
          main_competence: string;
          specific_competence: string;
          main_activities: string;
          specific_activities: string;
          teaching_resources: string;
          "references": string;
          teaching_learning_process: Json;
          teaching_activities: string;
          learning_activities: string;
          materials: string;
          reference_materials: string;
          remarks: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          class_id: string;
          subject_id: string;
          lesson_date: string;
          period: string;
          duration_minutes: number;
          total_boys?: number;
          total_girls?: number;
          total_pupils?: number;
          present_count?: number;
          main_competence?: string;
          specific_competence?: string;
          main_activities?: string;
          specific_activities?: string;
          teaching_resources?: string;
          "references"?: string;
          teaching_learning_process?: Json;
          teaching_activities?: string;
          learning_activities?: string;
          materials?: string;
          reference_materials?: string;
          remarks?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          teacher_id?: string;
          class_id?: string;
          subject_id?: string;
          lesson_date?: string;
          period?: string;
          duration_minutes?: number;
          total_boys?: number;
          total_girls?: number;
          total_pupils?: number;
          present_count?: number;
          main_competence?: string;
          specific_competence?: string;
          main_activities?: string;
          specific_activities?: string;
          teaching_resources?: string;
          "references"?: string;
          teaching_learning_process?: Json;
          teaching_activities?: string;
          learning_activities?: string;
          materials?: string;
          reference_materials?: string;
          remarks?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teacher_lessons: {
        Row: {
          id: string;
          teacher_id: string;
          class_id: string;
          subject: string;
          lesson_date: string;
          topic: string;
          objectives: string | null;
          materials: string | null;
          procedure: string | null;
          assessment: string | null;
          homework: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          class_id: string;
          subject?: string;
          lesson_date: string;
          topic?: string;
          objectives?: string | null;
          materials?: string | null;
          procedure?: string | null;
          assessment?: string | null;
          homework?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          teacher_id?: string;
          class_id?: string;
          subject?: string;
          lesson_date?: string;
          topic?: string;
          objectives?: string | null;
          materials?: string | null;
          procedure?: string | null;
          assessment?: string | null;
          homework?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      report_cards: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          school_id: string;
          teacher_id: string;
          term: string;
          academic_year: string;
          status:
            | "draft"
            | "pending_review"
            | "approved"
            | "changes_requested";
          submitted_at: string | null;
          reviewed_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          school_id: string;
          teacher_id: string;
          term?: string;
          academic_year?: string;
          status?:
            | "draft"
            | "pending_review"
            | "approved"
            | "changes_requested";
          submitted_at?: string | null;
          reviewed_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          student_id?: string;
          class_id?: string;
          school_id?: string;
          teacher_id?: string;
          term?: string;
          academic_year?: string;
          status?:
            | "draft"
            | "pending_review"
            | "approved"
            | "changes_requested";
          submitted_at?: string | null;
          reviewed_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          admin_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      teacher_report_card_comments: {
        Row: {
          id: string;
          teacher_id: string;
          student_id: string;
          subject: string;
          academic_year: string;
          comment: string | null;
          status: "draft" | "submitted" | "approved";
          created_at: string;
          updated_at: string;
          term: string;
          report_card_id: string;
          score_percent: number | null;
          letter_grade: string | null;
          exam1_score: number | null;
          exam2_score: number | null;
          calculated_score: number | null;
          calculated_grade: string | null;
          exam1_gradebook_original: number | null;
          exam2_gradebook_original: number | null;
          exam1_score_overridden: boolean;
          exam2_score_overridden: boolean;
          position: number | null;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          student_id: string;
          subject?: string;
          academic_year?: string;
          comment?: string | null;
          status?: "draft" | "submitted" | "approved";
          created_at?: string;
          updated_at?: string;
          term?: string;
          report_card_id: string;
          score_percent?: number | null;
          letter_grade?: string | null;
          exam1_score?: number | null;
          exam2_score?: number | null;
          calculated_score?: number | null;
          calculated_grade?: string | null;
          exam1_gradebook_original?: number | null;
          exam2_gradebook_original?: number | null;
          exam1_score_overridden?: boolean;
          exam2_score_overridden?: boolean;
          position?: number | null;
        };
        Update: {
          teacher_id?: string;
          student_id?: string;
          subject?: string;
          academic_year?: string;
          comment?: string | null;
          status?: "draft" | "submitted" | "approved";
          updated_at?: string;
          term?: string;
          report_card_id?: string;
          score_percent?: number | null;
          letter_grade?: string | null;
          exam1_score?: number | null;
          exam2_score?: number | null;
          calculated_score?: number | null;
          calculated_grade?: string | null;
          exam1_gradebook_original?: number | null;
          exam2_gradebook_original?: number | null;
          exam1_score_overridden?: boolean;
          exam2_score_overridden?: boolean;
          position?: number | null;
        };
        Relationships: [];
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
      is_teacher: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_teacher_for_class: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      is_teacher_for_school: {
        Args: { p_school_id: string };
        Returns: boolean;
      };
      is_teacher_for_student_by_id: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      has_record_attachment_scope: {
        Args: { p_school_id: string; p_scope: string };
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
export type Broadcast = Database["public"]["Tables"]["broadcasts"]["Row"];
export type BroadcastRead = Database["public"]["Tables"]["broadcast_reads"]["Row"];
export type StudentFeeBalance = Database["public"]["Views"]["student_fee_balances"]["Row"];
