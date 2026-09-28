-- ============================================================
-- 042_welcome_menu_buttons.sql — Configurable Welcome Intent Qualification Menu
--
-- Allows any account to configure interactive WhatsApp buttons
-- that are sent to new customers on greeting / initial inbound message.
--
-- Stored in the existing `automations` table with trigger_type = 'welcome_intent_menu':
--   - account_id: Account UUID
--   - trigger_type: 'welcome_intent_menu'
--   - is_active: boolean (toggle enabled / disabled)
--   - trigger_config: jsonb {
--       header_text: text,
--       body_text: text,
--       footer_text: text,
--       buttons: [
--         { id: text, title: text, action: 'booking' | 'ai_inquiry' | 'talk_to_team' | 'custom_reply', reply_text?: text }
--       ]
--     }
-- ============================================================

-- Create partial index to accelerate welcome_intent_menu lookup
CREATE INDEX IF NOT EXISTS idx_automations_welcome_menu
  ON automations(account_id, trigger_type)
  WHERE trigger_type = 'welcome_intent_menu';
