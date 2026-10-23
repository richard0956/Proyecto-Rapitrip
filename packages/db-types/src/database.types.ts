
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
                },"commerce_reclassification_stats": {
                  Row: {
                    "commerce_id": string | null,"express_total": number | null,"reclassified": number | null
                  }
                  ComputedFields: never
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
                    "created_at": string | null,"id": string | null,"kind": string | null,"name": string | null,"ruc": string | null,"status": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"id"?: string | null,"kind"?: string | null,"name"?: string | null,"ruc"?: string | null,"status"?: string | null
                         }
                        Update: {
                           "created_at"?: string | null,"id"?: string | null,"kind"?: string | null,"name"?: string | null,"ruc"?: string | null,"status"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"couriers_list": {
                  Row: {
                    "created_at": string | null,"department": string | null,"full_name": string | null,"id": string | null,"phone": string | null,"status": string | null,"user_id": string | null,"vehicle_class": string | null,"vehicle_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"department"?: string | null,"full_name"?: string | null,"id"?: string | null,"phone"?: string | null,"status"?: string | null,"user_id"?: string | null,"vehicle_class"?: string | null,"vehicle_type"?: string | null
                         }
                        Update: {
                           "created_at"?: string | null,"department"?: string | null,"full_name"?: string | null,"id"?: string | null,"phone"?: string | null,"status"?: string | null,"user_id"?: string | null,"vehicle_class"?: string | null,"vehicle_type"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"delivery_class_settings_view": {
                  Row: {
                    "max_order_kg": number | null,"max_side_cm": number | null,"max_sum_cm": number | null,"max_unit_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "max_order_kg"?: number | null,"max_side_cm"?: number | null,"max_sum_cm"?: number | null,"max_unit_kg"?: number | null
                         }
                        Update: {
                           "max_order_kg"?: number | null,"max_side_cm"?: number | null,"max_sum_cm"?: number | null,"max_unit_kg"?: number | null
                         }
                        Relationships: [
                    
                  ]
                },"delivery_zones_list": {
                  Row: {
                    "courier_pay": number | null,"customer_fee": number | null,"margin": number | null,"up_to_km": number | null,"zone": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "courier_pay"?: number | null,"customer_fee"?: number | null,"margin"?: number | null,"up_to_km"?: number | null,"zone"?: number | null
                         }
                        Update: {
                           "courier_pay"?: number | null,"customer_fee"?: number | null,"margin"?: number | null,"up_to_km"?: number | null,"zone"?: number | null
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
                    "created_at": string | null,"id": string | null,"kind": string | null,"name": string | null,"parent_id": string | null,"parent_name": string | null,"programado_only": boolean | null,"status": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"my_addresses": {
                  Row: {
                    "address": string | null,"created_at": string | null,"department": string | null,"id": string | null,"is_default": boolean | null,"label": string | null,"latitude": number | null,"longitude": number | null,"phone": string | null,"reference": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "address"?: string | null,"created_at"?: string | null,"department"?: string | null,"id"?: string | null,"is_default"?: boolean | null,"label"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"phone"?: string | null,"reference"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "address"?: string | null,"created_at"?: string | null,"department"?: string | null,"id"?: string | null,"is_default"?: boolean | null,"label"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"phone"?: string | null,"reference"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"my_checkouts": {
                  Row: {
                    "created_at": string | null,"id": string | null,"order_count": number | null,"payment_method": string | null,"payment_status": string | null,"total": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"id"?: string | null,"order_count"?: number | null,"payment_method"?: string | null,"payment_status"?: string | null,"total"?: number | null
                         }
                        Update: {
                           "created_at"?: string | null,"id"?: string | null,"order_count"?: number | null,"payment_method"?: string | null,"payment_status"?: string | null,"total"?: number | null
                         }
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
                },"my_order_units": {
                  Row: {
                    "checkout_id": string | null,"created_at": string | null,"order_count": number | null,"payment_status": string | null,"total": number | null,"unit_id": string | null
                  }
                  ComputedFields: never
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
                    "address": string | null,"latitude": number | null,"longitude": number | null,"notes": string | null,"order_id": string | null,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "address"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"notes"?: string | null,"order_id"?: string | null,"phone"?: string | null
                         }
                        Update: {
                           "address"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"notes"?: string | null,"order_id"?: string | null,"phone"?: string | null
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
                    "cash_received_at": string | null,"cash_session_id": string | null,"cashier_id": string | null,"channel": string | null,"checkout_id": string | null,"class_reason": string | null,"client_id": string | null,"commerce_id": string | null,"confirmed_at": string | null,"courier_id": string | null,"created_at": string | null,"delivered_at": string | null,"delivery_class": string | null,"delivery_fee": number | null,"destination_department": string | null,"eta_max_days": number | null,"eta_min_days": number | null,"expires_at": string | null,"id": string | null,"item_count": number | null,"number": number | null,"origin_department": string | null,"payment_method": string | null,"payment_ref": string | null,"payment_status": string | null,"reclassified_at": string | null,"reclassified_reason": string | null,"status": string | null,"status_reason": string | null,"store_id": string | null,"store_name": string | null,"subtotal": number | null,"total": number | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "cash_received_at"?: string | null,"cash_session_id"?: string | null,"cashier_id"?: string | null,"channel"?: string | null,"checkout_id"?: string | null,"class_reason"?: string | null,"client_id"?: string | null,"commerce_id"?: string | null,"confirmed_at"?: string | null,"courier_id"?: string | null,"created_at"?: string | null,"delivered_at"?: string | null,"delivery_class"?: string | null,"delivery_fee"?: number | null,"destination_department"?: string | null,"eta_max_days"?: number | null,"eta_min_days"?: number | null,"expires_at"?: string | null,"id"?: string | null,"item_count"?: never,"number"?: number | null,"origin_department"?: string | null,"payment_method"?: string | null,"payment_ref"?: string | null,"payment_status"?: string | null,"reclassified_at"?: string | null,"reclassified_reason"?: string | null,"status"?: string | null,"status_reason"?: string | null,"store_id"?: string | null,"store_name"?: string | null,"subtotal"?: number | null,"total"?: number | null,"updated_at"?: string | null
                         }
                        Update: {
                           "cash_received_at"?: string | null,"cash_session_id"?: string | null,"cashier_id"?: string | null,"channel"?: string | null,"checkout_id"?: string | null,"class_reason"?: string | null,"client_id"?: string | null,"commerce_id"?: string | null,"confirmed_at"?: string | null,"courier_id"?: string | null,"created_at"?: string | null,"delivered_at"?: string | null,"delivery_class"?: string | null,"delivery_fee"?: number | null,"destination_department"?: string | null,"eta_max_days"?: number | null,"eta_min_days"?: number | null,"expires_at"?: string | null,"id"?: string | null,"item_count"?: never,"number"?: number | null,"origin_department"?: string | null,"payment_method"?: string | null,"payment_ref"?: string | null,"payment_status"?: string | null,"reclassified_at"?: string | null,"reclassified_reason"?: string | null,"status"?: string | null,"status_reason"?: string | null,"store_id"?: string | null,"store_name"?: string | null,"subtotal"?: number | null,"total"?: number | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"payment_events_list": {
                  Row: {
                    "event_id": string | null,"event_type": string | null,"for_checkout": boolean | null,"order_id": string | null,"order_number": number | null,"outcome": string | null,"received_at": string | null,"updated_at": string | null
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
                    "compare_at_price": number | null,"discount_pct": number | null,"id": string | null,"name": string | null,"price": number | null,"product_id": string | null,"sku": string | null,"status": string | null,"store_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "compare_at_price"?: number | null,"discount_pct"?: never,"id"?: string | null,"name"?: string | null,"price"?: number | null,"product_id"?: string | null,"sku"?: string | null,"status"?: string | null,"store_id"?: string | null
                         }
                        Update: {
                           "compare_at_price"?: number | null,"discount_pct"?: never,"id"?: string | null,"name"?: string | null,"price"?: number | null,"product_id"?: string | null,"sku"?: string | null,"status"?: string | null,"store_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"products_list": {
                  Row: {
                    "active_variants": number | null,"brand_id": string | null,"category_id": string | null,"commerce_id": string | null,"cover_path": string | null,"created_at": string | null,"description": string | null,"express_eligible": boolean | null,"express_ok": boolean | null,"height_cm": number | null,"id": string | null,"length_cm": number | null,"min_price": number | null,"name": string | null,"product_type_id": string | null,"status": string | null,"store_id": string | null,"store_name": string | null,"updated_at": string | null,"validation_days": number | null,"weight_kg": number | null,"width_cm": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"programmed_bands_list": {
                  Row: {
                    "band": number | null,"courier_pay": number | null,"customer_fee": number | null,"margin": number | null,"max_days": number | null,"min_days": number | null,"up_to_km": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "band"?: number | null,"courier_pay"?: number | null,"customer_fee"?: number | null,"margin"?: number | null,"max_days"?: number | null,"min_days"?: number | null,"up_to_km"?: number | null
                         }
                        Update: {
                           "band"?: number | null,"courier_pay"?: number | null,"customer_fee"?: number | null,"margin"?: number | null,"max_days"?: number | null,"min_days"?: number | null,"up_to_km"?: number | null
                         }
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
                    "address": string | null,"closed_reason": string | null,"closed_until": string | null,"commerce_id": string | null,"commerce_name": string | null,"contact_phone": string | null,"created_at": string | null,"delivery_fee": number | null,"department": string | null,"hour_ranges": number | null,"id": string | null,"latitude": number | null,"longitude": number | null,"name": string | null,"open_now": boolean | null,"status": string | null,"updated_at": string | null
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
"apply_stripe_checkout_event":
{ Args: { "p_amount": number,"p_checkout": string,"p_currency": string,"p_event_id": string,"p_intent": string,"p_paid": boolean,"p_session": string,"p_type": string }; Returns: string
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
"avg_prep_minutes":
{ Args: { "p_from": string,"p_store"?: string,"p_to": string }; Returns: number
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
"cash_session_incidents_for":
{ Args: { "p_session": string }; Returns: {
              "commerce_name": string,"detail": string,"kind": string,"order_number": number
            }[]
                           },
"catalog_categories":
{ Args: { "p_store"?: string }; Returns: {
              "id": string,"name": string,"product_count": number
            }[]
                           },
"catalog_product":
{ Args: { "p_product": string }; Returns: Json
                           },
"catalog_products":
{ Args: { "p_category"?: string,"p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_store"?: string }; Returns: {
              "category_id": string,"category_name": string,"cover_path": string,"id": string,"min_price": number,"name": string,"store_id": string,"store_name": string
            }[]
                           },
"catalog_search_products":
{ Args: { "p_category"?: string,"p_discount_only"?: boolean,"p_kind"?: string,"p_limit"?: number,"p_max_price"?: number,"p_min_price"?: number,"p_offset"?: number,"p_open_only"?: boolean,"p_query"?: string,"p_sort"?: string,"p_store"?: string }; Returns: {
              "brand_name": string,"category_id": string,"category_name": string,"commerce_kind": string,"compare_price": number,"cover_path": string,"created_at": string,"discount_pct": number,"id": string,"min_price": number,"name": string,"quick_max": number,"quick_variant_id": string,"quick_variant_name": string,"store_id": string,"store_name": string,"store_open": boolean,"total_count": number,"variant_count": number
            }[]
                           },
"catalog_search_stores":
{ Args: { "p_category"?: string,"p_kind"?: string,"p_limit"?: number,"p_offset"?: number,"p_open_only"?: boolean,"p_query"?: string }; Returns: {
              "address": string,"categories": (string)[],"closed_reason": string,"closed_until": string,"commerce_kind": string,"delivery_fee": number,"id": string,"name": string,"open_now": boolean,"product_count": number
            }[]
                           },
"catalog_store":
{ Args: { "p_store": string }; Returns: Json
                           },
"catalog_stores":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_open_only"?: boolean }; Returns: {
              "address": string,"closed_reason": string,"closed_until": string,"delivery_fee": number,"id": string,"name": string,"open_now": boolean,"product_count": number
            }[]
                           },
"claim_outbox":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,"data": Json,"id": string,"template": string,"to_email": string
            }[]
                           },
"claim_pending_refunds":
{ Args: { "p_limit"?: number }; Returns: {
              "amount_cents": number,"order_id": string,"order_number": number,"payment_intent_id": string
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
"create_checkout":
{ Args: { "p_address": string,"p_client_ref"?: string,"p_department"?: string,"p_groups": Json,"p_latitude"?: number,"p_longitude"?: number,"p_notes"?: string,"p_payment_method": string,"p_phone": string }; Returns: Json
                           },
"create_counter_sale":
{ Args: { "p_items": Json,"p_payment_method": string,"p_reference"?: string,"p_store": string }; Returns: string
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
{ Args: { "p_address": string,"p_client_ref"?: string,"p_items": Json,"p_latitude"?: number,"p_longitude"?: number,"p_notes"?: string,"p_payment_method": string,"p_phone": string,"p_quote_id"?: string,"p_store": string }; Returns: string
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
"decide_return":
{ Args: { "p_decision": string,"p_note": string,"p_request": string }; Returns: undefined
                           },
"delete_address":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_store_exception":
{ Args: { "p_date": string,"p_store": string }; Returns: undefined
                           },
"delivered_totals":
{ Args: { "p_from": string,"p_store"?: string,"p_to": string }; Returns: {
              "delivery_fees": number,"orders": number,"products": number
            }[]
                           },
"delivery_store_point":
{ Args: { "p_store": string }; Returns: {
              "latitude": number,"longitude": number
            }[]
                           },
"department_for_point":
{ Args: { "p_latitude": number,"p_longitude": number }; Returns: string
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
"my_return_request":
{ Args: { "p_order": string }; Returns: {
              "decided_at": string,"decision_note": string,"payment_method": string,"photo_count": number,"reason": string,"request_id": string,"requested_at": string,"status": string
            }[]
                           },
"open_cash_session":
{ Args: { "p_opening": number }; Returns: string
                           },
"order_distance_km":
{ Args: { "p_order": string }; Returns: number
                           },
"order_route_points":
{ Args: { "p_order": string }; Returns: {
              "dest_latitude": number,"dest_longitude": number,"store_latitude": number,"store_longitude": number,"store_name": string
            }[]
                           },
"orders_by_status":
{ Args: { "p_from": string,"p_store"?: string,"p_to": string }; Returns: {
              "orders": number,"status": string
            }[]
                           },
"overdue_confirmations":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"payments_by_day":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "day": string,"method": string,"total": number
            }[]
                           },
"pending_cash_returns":
{ Args: Record<PropertyKey, never>; Returns: {
              "decided_at": string,"order_number": number,"request_id": string,"store_name": string,"total": number
            }[]
                           },
"pending_courier_cash":
{ Args: Record<PropertyKey, never>; Returns: {
              "delivered_at": string,"order_id": string,"order_number": number,"payment_ref": string,"store_name": string,"total": number
            }[]
                           },
"product_daily":
{ Args: { "p_from": string,"p_product": string,"p_to": string }; Returns: {
              "day": string,"orders": number,"units": number
            }[]
                           },
"product_sales":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "product_id": string,"sales": number,"units": number
            }[]
                           },
"product_stats":
{ Args: { "p_from": string,"p_store"?: string,"p_to": string }; Returns: {
              "cancelled_units": number,"orders": number,"product_id": string,"reserved_units": number,"sales": number,"units": number
            }[]
                           },
"quote_cart":
{ Args: { "p_items": Json,"p_store": string }; Returns: Json
                           },
"quote_delivery":
{ Args: { "p_latitude": number,"p_longitude": number,"p_store": string }; Returns: Json
                           },
"quote_delivery_group":
{ Args: { "p_department"?: string,"p_items": Json,"p_latitude": number,"p_longitude": number,"p_quote_id"?: string,"p_store": string }; Returns: Json
                           },
"reactivate_role":
{ Args: { "p_reason": string,"p_role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente","p_user": string }; Returns: undefined
                           },
"read_courier_document":
{ Args: { "p_id": string }; Returns: string
                           },
"receive_courier_cash":
{ Args: { "p_order": string }; Returns: undefined
                           },
"reclassify_order":
{ Args: { "p_order": string,"p_reason": string }; Returns: undefined
                           },
"record_checkout_payment_session":
{ Args: { "p_checkout": string,"p_currency": string,"p_session": string }; Returns: Json
                           },
"record_delivery_quote":
{ Args: { "p_client": string,"p_latitude": number,"p_longitude": number,"p_road_km"?: number,"p_store": string }; Returns: Json
                           },
"record_order_checkout_session":
{ Args: { "p_currency": string,"p_order": string,"p_session": string }; Returns: Json
                           },
"register_courier_cash":
{ Args: { "p_order": string }; Returns: string
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
"remove_variant_discount":
{ Args: { "p_variant": string }; Returns: undefined
                           },
"rename_master_item":
{ Args: { "p_id": string,"p_name": string }; Returns: undefined
                           },
"reopen_store":
{ Args: { "p_store": string }; Returns: undefined
                           },
"repeat_rejections":
{ Args: { "p_days"?: number,"p_min"?: number }; Returns: {
              "commerce_id": string,"rejections": number,"store_name": string
            }[]
                           },
"report_incident":
{ Args: { "p_description": string,"p_severity": "baja"|"media"|"alta","p_type": "seguridad"|"interrupcion" }; Returns: string
                           },
"request_return":
{ Args: { "p_order": string,"p_photos": (string)[],"p_reason": string }; Returns: string
                           },
"reset_mfa":
{ Args: { "p_reason": string,"p_target": string }; Returns: undefined
                           },
"return_cash_to_customer":
{ Args: { "p_request": string }; Returns: undefined
                           },
"return_requests_for_admin":
{ Args: Record<PropertyKey, never>; Returns: {
              "decided_at": string,"decision_note": string,"order_number": number,"payment_method": string,"photos": (string)[],"reason": string,"request_id": string,"requested_at": string,"status": string,"store_name": string,"total": number
            }[]
                           },
"revoke_role":
{ Args: { "p_reason": string,"p_role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente","p_user": string }; Returns: undefined
                           },
"sales_by_day":
{ Args: { "p_from": string,"p_store"?: string,"p_to": string }; Returns: {
              "day": string,"orders": number,"sales": number
            }[]
                           },
"sales_by_store":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "orders": number,"sales": number,"store_id": string,"store_name": string
            }[]
                           },
"save_address":
{ Args: { "p_address": string,"p_id": string,"p_label": string,"p_latitude"?: number,"p_longitude"?: number,"p_make_default"?: boolean,"p_phone"?: string,"p_reference"?: string }; Returns: string
                           },
"set_address_department":
{ Args: { "p_department": string,"p_id": string }; Returns: undefined
                           },
"set_commerce_status":
{ Args: { "p_commerce": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"set_courier_coverage":
{ Args: { "p_courier": string,"p_department": string,"p_vehicle_class": string }; Returns: undefined
                           },
"set_courier_status":
{ Args: { "p_id": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"set_default_address":
{ Args: { "p_id": string }; Returns: undefined
                           },
"set_delivery_class_limits":
{ Args: { "p_order_kg": number,"p_side_cm": number,"p_sum_cm": number,"p_unit_kg": number }; Returns: undefined
                           },
"set_incident_status":
{ Args: { "p_id": string,"p_resolution"?: string,"p_status": "abierto"|"en_atencion"|"resuelto" }; Returns: undefined
                           },
"set_master_item_programado_only":
{ Args: { "p_id": string,"p_value": boolean }; Returns: undefined
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
"set_product_delivery":
{ Args: { "p_eligible": boolean,"p_height_cm": number,"p_length_cm": number,"p_product": string,"p_validation_days"?: number,"p_weight_kg": number,"p_width_cm": number }; Returns: undefined
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
"set_store_department":
{ Args: { "p_department": string,"p_store": string }; Returns: undefined
                           },
"set_store_exception":
{ Args: { "p_closed": boolean,"p_closes"?: string,"p_date": string,"p_note"?: string,"p_opens"?: string,"p_store": string }; Returns: undefined
                           },
"set_store_hours":
{ Args: { "p_hours": Json,"p_store": string }; Returns: undefined
                           },
"set_store_location":
{ Args: { "p_latitude": number,"p_longitude": number,"p_store": string }; Returns: undefined
                           },
"set_store_status":
{ Args: { "p_reason"?: string,"p_status": string,"p_store": string }; Returns: undefined
                           },
"set_variant_status":
{ Args: { "p_status": string,"p_variant": string }; Returns: undefined
                           },
"store_top_products":
{ Args: { "p_from": string,"p_per_store"?: number,"p_to": string }; Returns: {
              "product_name": string,"rank": number,"sales": number,"store_id": string,"units": number
            }[]
                           },
"submit_commerce_request":
{ Args: { "p_business_name": string,"p_details"?: Json }; Returns: string
                           },
"suspend_role":
{ Args: { "p_reason": string,"p_role": "superadmin"|"admin"|"cajero"|"coordinador"|"comercio"|"cliente","p_user": string }; Returns: undefined
                           },
"top_products":
{ Args: { "p_from": string,"p_limit"?: number,"p_store"?: string,"p_to": string }; Returns: {
              "product_name": string,"sales": number,"units": number
            }[]
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
