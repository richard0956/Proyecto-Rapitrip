
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
                },"cash_sessions_list": {
                  Row: {
                    "cash_expected": number | null,"cash_total": number | null,"cashier_id": string | null,"closed_at": string | null,"counted_amount": number | null,"difference": number | null,"expected_amount": number | null,"id": string | null,"note": string | null,"opened_at": string | null,"opening_amount": number | null,"sales_count": number | null,"sales_total": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "cash_expected"?: never,"cash_total"?: never,"cashier_id"?: string | null,"closed_at"?: string | null,"counted_amount"?: number | null,"difference"?: number | null,"expected_amount"?: number | null,"id"?: string | null,"note"?: string | null,"opened_at"?: string | null,"opening_amount"?: number | null,"sales_count"?: never,"sales_total"?: never
                         }
                        Update: {
                           "cash_expected"?: never,"cash_total"?: never,"cashier_id"?: string | null,"closed_at"?: string | null,"counted_amount"?: number | null,"difference"?: number | null,"expected_amount"?: number | null,"id"?: string | null,"note"?: string | null,"opened_at"?: string | null,"opening_amount"?: number | null,"sales_count"?: never,"sales_total"?: never
                         }
                        Relationships: [
                    
                  ]
                },"commerce_requests_list": {
                  Row: {
                    "business_name": string | null,"commerce_id": string | null,"created_at": string | null,"decision_reason": string | null,"details": Json | null,"id": string | null,"requester_id": string | null,"reviewed_at": string | null,"status": "pendiente"|"aprobada"|"rechazada" | null
                  }
                  ComputedFields: never
                  Insert: {
                           "business_name"?: string | null,"commerce_id"?: string | null,"created_at"?: string | null,"decision_reason"?: string | null,"details"?: Json | null,"id"?: string | null,"requester_id"?: string | null,"reviewed_at"?: string | null,"status"?: "pendiente"|"aprobada"|"rechazada" | null
                         }
                        Update: {
                           "business_name"?: string | null,"commerce_id"?: string | null,"created_at"?: string | null,"decision_reason"?: string | null,"details"?: Json | null,"id"?: string | null,"requester_id"?: string | null,"reviewed_at"?: string | null,"status"?: "pendiente"|"aprobada"|"rechazada" | null
                         }
                        Relationships: [
                    
                  ]
                },"commerces_list": {
                  Row: {
                    "created_at": string | null,"id": string | null,"name": string | null,"status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"id"?: string | null,"name"?: string | null,"status"?: string | null
                         }
                        Update: {
                           "created_at"?: string | null,"id"?: string | null,"name"?: string | null,"status"?: string | null
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
                },"inventory_list": {
                  Row: {
                    "available": boolean | null,"commerce_id": string | null,"low_stock_threshold": number | null,"product_id": string | null,"product_name": string | null,"product_status": string | null,"quantity": number | null,"sku": string | null,"stock_state": string | null,"store_id": string | null,"store_name": string | null,"track_stock": boolean | null,"updated_at": string | null,"variant_id": string | null,"variant_name": string | null,"variant_status": string | null
                  }
                  ComputedFields: never
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
                },"master_items_list": {
                  Row: {
                    "created_at": string | null,"id": string | null,"kind": string | null,"name": string | null,"parent_id": string | null,"parent_name": string | null,"status": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"my_commerce_requests": {
                  Row: {
                    "business_name": string | null,"created_at": string | null,"decision_reason": string | null,"id": string | null,"reviewed_at": string | null,"status": "pendiente"|"aprobada"|"rechazada" | null
                  }
                  ComputedFields: never
                  Insert: {
                           "business_name"?: string | null,"created_at"?: string | null,"decision_reason"?: string | null,"id"?: string | null,"reviewed_at"?: string | null,"status"?: "pendiente"|"aprobada"|"rechazada" | null
                         }
                        Update: {
                           "business_name"?: string | null,"created_at"?: string | null,"decision_reason"?: string | null,"id"?: string | null,"reviewed_at"?: string | null,"status"?: "pendiente"|"aprobada"|"rechazada" | null
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
                },"order_delivery_list": {
                  Row: {
                    "address": string | null,"notes": string | null,"order_id": string | null,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "address"?: string | null,"notes"?: string | null,"order_id"?: string | null,"phone"?: string | null
                         }
                        Update: {
                           "address"?: string | null,"notes"?: string | null,"order_id"?: string | null,"phone"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"order_events_list": {
                  Row: {
                    "created_at": string | null,"from_status": string | null,"id": number | null,"order_id": string | null,"reason": string | null,"to_status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"from_status"?: string | null,"id"?: number | null,"order_id"?: string | null,"reason"?: string | null,"to_status"?: string | null
                         }
                        Update: {
                           "created_at"?: string | null,"from_status"?: string | null,"id"?: number | null,"order_id"?: string | null,"reason"?: string | null,"to_status"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"order_items_list": {
                  Row: {
                    "id": string | null,"line_total": number | null,"order_id": string | null,"product_name": string | null,"quantity": number | null,"sku": string | null,"unit_price": number | null,"variant_id": string | null,"variant_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "id"?: string | null,"line_total"?: number | null,"order_id"?: string | null,"product_name"?: string | null,"quantity"?: number | null,"sku"?: string | null,"unit_price"?: number | null,"variant_id"?: string | null,"variant_name"?: string | null
                         }
                        Update: {
                           "id"?: string | null,"line_total"?: number | null,"order_id"?: string | null,"product_name"?: string | null,"quantity"?: number | null,"sku"?: string | null,"unit_price"?: number | null,"variant_id"?: string | null,"variant_name"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"orders_list": {
                  Row: {
                    "cash_session_id": string | null,"cashier_id": string | null,"channel": string | null,"client_id": string | null,"commerce_id": string | null,"confirmed_at": string | null,"courier_id": string | null,"created_at": string | null,"delivered_at": string | null,"delivery_fee": number | null,"expires_at": string | null,"id": string | null,"item_count": number | null,"number": number | null,"payment_method": string | null,"payment_status": string | null,"status": string | null,"status_reason": string | null,"store_id": string | null,"store_name": string | null,"subtotal": number | null,"total": number | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "cash_session_id"?: string | null,"cashier_id"?: string | null,"channel"?: string | null,"client_id"?: string | null,"commerce_id"?: string | null,"confirmed_at"?: string | null,"courier_id"?: string | null,"created_at"?: string | null,"delivered_at"?: string | null,"delivery_fee"?: number | null,"expires_at"?: string | null,"id"?: string | null,"item_count"?: never,"number"?: number | null,"payment_method"?: string | null,"payment_status"?: string | null,"status"?: string | null,"status_reason"?: string | null,"store_id"?: string | null,"store_name"?: string | null,"subtotal"?: number | null,"total"?: number | null,"updated_at"?: string | null
                         }
                        Update: {
                           "cash_session_id"?: string | null,"cashier_id"?: string | null,"channel"?: string | null,"client_id"?: string | null,"commerce_id"?: string | null,"confirmed_at"?: string | null,"courier_id"?: string | null,"created_at"?: string | null,"delivered_at"?: string | null,"delivery_fee"?: number | null,"expires_at"?: string | null,"id"?: string | null,"item_count"?: never,"number"?: number | null,"payment_method"?: string | null,"payment_status"?: string | null,"status"?: string | null,"status_reason"?: string | null,"store_id"?: string | null,"store_name"?: string | null,"subtotal"?: number | null,"total"?: number | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"payment_events_list": {
                  Row: {
                    "event_id": string | null,"event_type": string | null,"order_id": string | null,"order_number": number | null,"outcome": string | null,"received_at": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"product_images_list": {
                  Row: {
                    "id": string | null,"path": string | null,"position": number | null,"product_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "id"?: string | null,"path"?: string | null,"position"?: number | null,"product_id"?: string | null
                         }
                        Update: {
                           "id"?: string | null,"path"?: string | null,"position"?: number | null,"product_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"product_variants_list": {
                  Row: {
                    "id": string | null,"name": string | null,"price": number | null,"product_id": string | null,"sku": string | null,"status": string | null,"store_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "id"?: string | null,"name"?: string | null,"price"?: number | null,"product_id"?: string | null,"sku"?: string | null,"status"?: string | null,"store_id"?: string | null
                         }
                        Update: {
                           "id"?: string | null,"name"?: string | null,"price"?: number | null,"product_id"?: string | null,"sku"?: string | null,"status"?: string | null,"store_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"products_list": {
                  Row: {
                    "active_variants": number | null,"brand_id": string | null,"category_id": string | null,"commerce_id": string | null,"cover_path": string | null,"created_at": string | null,"description": string | null,"id": string | null,"min_price": number | null,"name": string | null,"product_type_id": string | null,"status": string | null,"store_id": string | null,"store_name": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"stock_movements_list": {
                  Row: {
                    "created_at": string | null,"delta": number | null,"id": number | null,"kind": string | null,"quantity_after": number | null,"reason": string | null,"store_id": string | null,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"delta"?: number | null,"id"?: number | null,"kind"?: string | null,"quantity_after"?: number | null,"reason"?: string | null,"store_id"?: string | null,"variant_id"?: string | null
                         }
                        Update: {
                           "created_at"?: string | null,"delta"?: number | null,"id"?: number | null,"kind"?: string | null,"quantity_after"?: number | null,"reason"?: string | null,"store_id"?: string | null,"variant_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"store_exceptions_list": {
                  Row: {
                    "closed": boolean | null,"closes": string | null,"id": string | null,"note": string | null,"on_date": string | null,"opens": string | null,"store_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "closed"?: boolean | null,"closes"?: never,"id"?: string | null,"note"?: string | null,"on_date"?: string | null,"opens"?: never,"store_id"?: string | null
                         }
                        Update: {
                           "closed"?: boolean | null,"closes"?: never,"id"?: string | null,"note"?: string | null,"on_date"?: string | null,"opens"?: never,"store_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"store_hours_list": {
                  Row: {
                    "closes": string | null,"id": string | null,"opens": string | null,"store_id": string | null,"weekday": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "closes"?: never,"id"?: string | null,"opens"?: never,"store_id"?: string | null,"weekday"?: number | null
                         }
                        Update: {
                           "closes"?: never,"id"?: string | null,"opens"?: never,"store_id"?: string | null,"weekday"?: number | null
                         }
                        Relationships: [
                    
                  ]
                },"stores_list": {
                  Row: {
                    "address": string | null,"closed_reason": string | null,"closed_until": string | null,"commerce_id": string | null,"commerce_name": string | null,"contact_phone": string | null,"created_at": string | null,"delivery_fee": number | null,"hour_ranges": number | null,"id": string | null,"name": string | null,"open_now": boolean | null,"status": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_product_image":
{ Args: { "p_path": string,"p_product": string }; Returns: string
                           },
"add_stock":
{ Args: { "p_amount": number,"p_reason": string,"p_variant": string }; Returns: number
                           },
"apply_stripe_event":
{ Args: { "p_amount": number,"p_currency": string,"p_event_id": string,"p_intent": string,"p_order": string,"p_paid": boolean,"p_session": string,"p_type": string }; Returns: string
                           },
"approve_commerce_request":
{ Args: { "p_convenio_confirmed": boolean,"p_request": string }; Returns: string
                           },
"assign_order_courier":
{ Args: { "p_courier": string,"p_order": string }; Returns: undefined
                           },
"audit_events_page":
{ Args: { "p_action"?: string,"p_actor"?: string,"p_before"?: number,"p_from"?: string,"p_limit"?: number,"p_target_type"?: string,"p_to"?: string }; Returns: Json
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
"claim_pending_refunds":
{ Args: { "p_limit"?: number }; Returns: {
              "order_id": string,"order_number": number,"payment_intent_id": string
            }[]
                           },
"close_cash_session":
{ Args: { "p_counted": number,"p_note"?: string }; Returns: Json
                           },
"close_store_temporarily":
{ Args: { "p_reason"?: string,"p_store": string,"p_until": string }; Returns: undefined
                           },
"confirm_anonymization":
{ Args: { "p_holder_request"?: boolean,"p_reason": string,"p_user": string }; Returns: undefined
                           },
"count_stock":
{ Args: { "p_quantity": number,"p_reason": string,"p_variant": string }; Returns: number
                           },
"counter_catalog":
{ Args: Record<PropertyKey, never>; Returns: {
              "price": number,"product_name": string,"quantity": number,"sku": string,"store_id": string,"store_name": string,"variant_id": string,"variant_name": string
            }[]
                           },
"create_counter_sale":
{ Args: { "p_items": Json,"p_payment_method": string,"p_store": string }; Returns: string
                           },
"create_courier":
{ Args: { "p_document_path"?: string,"p_full_name": string,"p_phone": string,"p_vehicle_type": string }; Returns: string
                           },
"create_invitation":
{ Args: { "p_email": string,"p_role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente","p_token_hash": string }; Returns: Json
                           },
"create_master_item":
{ Args: { "p_kind": string,"p_name": string,"p_parent"?: string }; Returns: string
                           },
"create_order":
{ Args: { "p_address": string,"p_items": Json,"p_notes"?: string,"p_payment_method": string,"p_phone": string,"p_store": string }; Returns: string
                           },
"create_product":
{ Args: { "p_brand"?: string,"p_category"?: string,"p_description"?: string,"p_name": string,"p_store": string,"p_type"?: string }; Returns: string
                           },
"create_store":
{ Args: { "p_address"?: string,"p_commerce": string,"p_name": string,"p_phone"?: string }; Returns: string
                           },
"create_variant":
{ Args: { "p_name": string,"p_price": number,"p_product": string,"p_sku": string }; Returns: string
                           },
"delete_store_exception":
{ Args: { "p_date": string,"p_store": string }; Returns: undefined
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
"login_events_page":
{ Args: { "p_before"?: number,"p_from"?: string,"p_limit"?: number,"p_result"?: string,"p_to"?: string,"p_user"?: string }; Returns: Json
                           },
"lookup_auth_user":
{ Args: { "p_email": string }; Returns: Json
                           },
"mark_order_paid":
{ Args: { "p_order": string }; Returns: undefined
                           },
"mark_order_refunded":
{ Args: { "p_order": string,"p_refund": string }; Returns: undefined
                           },
"mark_outbox":
{ Args: { "p_error"?: string,"p_id": string,"p_ok": boolean }; Returns: undefined
                           },
"open_cash_session":
{ Args: { "p_opening": number }; Returns: string
                           },
"reactivate_role":
{ Args: { "p_reason": string,"p_role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente","p_user": string }; Returns: undefined
                           },
"read_courier_document":
{ Args: { "p_id": string }; Returns: string
                           },
"record_order_checkout_session":
{ Args: { "p_currency": string,"p_order": string,"p_session": string }; Returns: Json
                           },
"reject_commerce_request":
{ Args: { "p_reason": string,"p_request": string }; Returns: undefined
                           },
"remove_product_image":
{ Args: { "p_image": string }; Returns: string
                           },
"remove_stock":
{ Args: { "p_amount": number,"p_reason": string,"p_variant": string }; Returns: number
                           },
"rename_master_item":
{ Args: { "p_id": string,"p_name": string }; Returns: undefined
                           },
"reopen_store":
{ Args: { "p_store": string }; Returns: undefined
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
"set_commerce_status":
{ Args: { "p_commerce": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"set_courier_status":
{ Args: { "p_id": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"set_incident_status":
{ Args: { "p_id": string,"p_resolution"?: string,"p_status": "abierto"|"en_atencion"|"resuelto" }; Returns: undefined
                           },
"set_master_item_status":
{ Args: { "p_id": string,"p_reason"?: string,"p_status": string }; Returns: undefined
                           },
"set_order_status":
{ Args: { "p_order": string,"p_reason"?: string,"p_to": string }; Returns: undefined
                           },
"set_payment_event_outcome":
{ Args: { "p_event_id": string,"p_outcome": string }; Returns: undefined
                           },
"set_product_status":
{ Args: { "p_product": string,"p_reason"?: string,"p_status": string }; Returns: undefined
                           },
"set_stock_tracking":
{ Args: { "p_threshold"?: number,"p_track": boolean,"p_variant": string }; Returns: undefined
                           },
"set_store_delivery_fee":
{ Args: { "p_fee": number,"p_store": string }; Returns: undefined
                           },
"set_store_exception":
{ Args: { "p_closed": boolean,"p_closes"?: string,"p_date": string,"p_note"?: string,"p_opens"?: string,"p_store": string }; Returns: undefined
                           },
"set_store_hours":
{ Args: { "p_hours": Json,"p_store": string }; Returns: undefined
                           },
"set_store_status":
{ Args: { "p_reason"?: string,"p_status": string,"p_store": string }; Returns: undefined
                           },
"set_variant_status":
{ Args: { "p_status": string,"p_variant": string }; Returns: undefined
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
                           },
"update_product":
{ Args: { "p_brand"?: string,"p_category"?: string,"p_description"?: string,"p_name": string,"p_product": string,"p_type"?: string }; Returns: undefined
                           },
"update_store":
{ Args: { "p_address"?: string,"p_name": string,"p_phone"?: string,"p_store": string }; Returns: undefined
                           },
"update_variant":
{ Args: { "p_name": string,"p_price": number,"p_sku": string,"p_variant": string }; Returns: undefined
                           },
"void_counter_sale":
{ Args: { "p_order": string,"p_reason": string }; Returns: undefined
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
