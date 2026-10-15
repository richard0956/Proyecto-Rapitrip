
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            "accounts_staff": {
                  Row: {
                    "account_status": "activa"|"anonimizada" | null,"commerce_id": string | null,"email": string | null,"full_name": string | null,"granted_at": string | null,"role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente" | null,"role_status": "activo"|"suspendido"|"revocado" | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"commerce_requests_list": {
                  Row: {
                    "business_name": string | null,"commerce_id": string | null,"created_at": string | null,"decision_reason": string | null,"id": string | null,"requester_id": string | null,"reviewed_at": string | null,"status": "pendiente"|"aprobada"|"rechazada" | null
                  }
                  ComputedFields: never
                  Insert: {
                           "business_name"?: string | null,"commerce_id"?: string | null,"created_at"?: string | null,"decision_reason"?: string | null,"id"?: string | null,"requester_id"?: string | null,"reviewed_at"?: string | null,"status"?: "pendiente"|"aprobada"|"rechazada" | null
                         }
                        Update: {
                           "business_name"?: string | null,"commerce_id"?: string | null,"created_at"?: string | null,"decision_reason"?: string | null,"id"?: string | null,"requester_id"?: string | null,"reviewed_at"?: string | null,"status"?: "pendiente"|"aprobada"|"rechazada" | null
                         }
                        Relationships: [
                    
                  ]
                },"couriers_list": {
                  Row: {
                    "created_at": string | null,"full_name": string | null,"id": string | null,"phone": string | null,"status": string | null,"user_id": string | null,"vehicle_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"full_name"?: string | null,"id"?: string | null,"phone"?: string | null,"status"?: string | null,"user_id"?: string | null,"vehicle_type"?: string | null
                         }
                        Update: {
                           "created_at"?: string | null,"full_name"?: string | null,"id"?: string | null,"phone"?: string | null,"status"?: string | null,"user_id"?: string | null,"vehicle_type"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"invitations_list": {
                  Row: {
                    "accepted_at": string | null,"created_at": string | null,"email": string | null,"expires_at": string | null,"id": string | null,"invited_by": string | null,"role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente" | null,"status": "pendiente"|"aceptada"|"cancelada"|"vencida" | null
                  }
                  ComputedFields: never
                  Insert: {
                           "accepted_at"?: string | null,"created_at"?: string | null,"email"?: string | null,"expires_at"?: string | null,"id"?: string | null,"invited_by"?: string | null,"role"?: "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente" | null,"status"?: "pendiente"|"aceptada"|"cancelada"|"vencida" | null
                         }
                        Update: {
                           "accepted_at"?: string | null,"created_at"?: string | null,"email"?: string | null,"expires_at"?: string | null,"id"?: string | null,"invited_by"?: string | null,"role"?: "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente" | null,"status"?: "pendiente"|"aceptada"|"cancelada"|"vencida" | null
                         }
                        Relationships: [
                    
                  ]
                },"it_incidents_list": {
                  Row: {
                    "created_at": string | null,"description": string | null,"id": string | null,"origin": "automatico"|"manual" | null,"resolution": string | null,"resolved_at": string | null,"severity": "baja"|"media"|"alta" | null,"status": "abierto"|"en_atencion"|"resuelto" | null,"type": "seguridad"|"interrupcion" | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"description"?: string | null,"id"?: string | null,"origin"?: "automatico"|"manual" | null,"resolution"?: string | null,"resolved_at"?: string | null,"severity"?: "baja"|"media"|"alta" | null,"status"?: "abierto"|"en_atencion"|"resuelto" | null,"type"?: "seguridad"|"interrupcion" | null
                         }
                        Update: {
                           "created_at"?: string | null,"description"?: string | null,"id"?: string | null,"origin"?: "automatico"|"manual" | null,"resolution"?: string | null,"resolved_at"?: string | null,"severity"?: "baja"|"media"|"alta" | null,"status"?: "abierto"|"en_atencion"|"resuelto" | null,"type"?: "seguridad"|"interrupcion" | null
                         }
                        Relationships: [
                    
                  ]
                },"my_profile": {
                  Row: {
                    "created_at": string | null,"email": string | null,"full_name": string | null,"id": string | null,"last_sign_in_at": string | null,"phone": string | null,"status": "activa"|"anonimizada" | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"my_roles": {
                  Row: {
                    "commerce_id": string | null,"granted_at": string | null,"id": string | null,"role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente" | null,"status": "activo"|"suspendido"|"revocado" | null
                  }
                  ComputedFields: never
                  Insert: {
                           "commerce_id"?: string | null,"granted_at"?: string | null,"id"?: string | null,"role"?: "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente" | null,"status"?: "activo"|"suspendido"|"revocado" | null
                         }
                        Update: {
                           "commerce_id"?: string | null,"granted_at"?: string | null,"id"?: string | null,"role"?: "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente" | null,"status"?: "activo"|"suspendido"|"revocado" | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "approve_commerce_request":
{ Args: { "p_convenio_confirmed": boolean,"p_request": string }; Returns: string
                           },
"audit_script_action":
{ Args: { "p_action": string,"p_reason": string,"p_target": string }; Returns: undefined
                           },
"begin_accept_invitation":
{ Args: { "p_token_hash": string }; Returns: Json
                           },
"bootstrap_superadmin":
{ Args: { "p_user": string }; Returns: undefined
                           },
"cancel_invitation":
{ Args: { "p_id": string }; Returns: undefined
                           },
"claim_outbox":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,"data": Json,"id": string,"template": string,"to_email": string
            }[]
                           },
"confirm_anonymization":
{ Args: { "p_holder_request"?: boolean,"p_reason": string,"p_user": string }; Returns: undefined
                           },
"create_courier":
{ Args: { "p_document_path"?: string,"p_full_name": string,"p_phone": string,"p_vehicle_type": string }; Returns: string
                           },
"create_invitation":
{ Args: { "p_email": string,"p_role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente","p_token_hash": string }; Returns: Json
                           },
"export_dataset":
{ Args: { "p_dataset": string,"p_from"?: string,"p_reason": string,"p_to"?: string }; Returns: Json
                           },
"finish_accept_invitation":
{ Args: { "p_token_hash": string,"p_user": string }; Returns: boolean
                           },
"get_client_detail":
{ Args: { "p_user": string }; Returns: Json
                           },
"list_anonymization_candidates":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"lookup_auth_user":
{ Args: { "p_email": string }; Returns: Json
                           },
"mark_outbox":
{ Args: { "p_error"?: string,"p_id": string,"p_ok": boolean }; Returns: undefined
                           },
"reactivate_role":
{ Args: { "p_reason": string,"p_role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente","p_user": string }; Returns: undefined
                           },
"read_courier_document":
{ Args: { "p_id": string }; Returns: string
                           },
"reject_commerce_request":
{ Args: { "p_reason": string,"p_request": string }; Returns: undefined
                           },
"report_incident":
{ Args: { "p_description": string,"p_severity": "baja"|"media"|"alta","p_type": "seguridad"|"interrupcion" }; Returns: string
                           },
"reset_mfa":
{ Args: { "p_reason": string,"p_target": string }; Returns: undefined
                           },
"revoke_role":
{ Args: { "p_reason": string,"p_role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente","p_user": string }; Returns: undefined
                           },
"set_courier_status":
{ Args: { "p_id": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"set_incident_status":
{ Args: { "p_id": string,"p_resolution"?: string,"p_status": "abierto"|"en_atencion"|"resuelto" }; Returns: undefined
                           },
"submit_commerce_request":
{ Args: { "p_business_name": string,"p_details"?: Json }; Returns: string
                           },
"suspend_role":
{ Args: { "p_reason": string,"p_role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente","p_user": string }; Returns: undefined
                           },
"touch_session":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"update_courier":
{ Args: { "p_document_path"?: string,"p_full_name": string,"p_id": string,"p_phone": string,"p_vehicle_type": string }; Returns: undefined
                           },
"update_my_profile":
{ Args: { "p_full_name": string,"p_phone": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
