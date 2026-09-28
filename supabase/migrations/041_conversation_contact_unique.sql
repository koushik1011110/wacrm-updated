-- ============================================================
-- 041_conversation_contact_unique
--
-- Prevent duplicate conversations for the same contact within an account.
-- Ensures that all messages, images, audio, video from a single contact
-- route to the same conversation thread instead of fragmenting across
-- multiple separate conversation records.
--
-- This migration:
--   1. Collapses any duplicate conversations per (account_id, contact_id)
--      into the oldest conversation, re-pointing child records (messages,
--      message_reactions, deals, flow_runs, bookings, notifications).
--   2. Updates the survivor conversation's last_message_text, last_message_at,
--      and unread_count from the merged messages.
--   3. Adds a UNIQUE INDEX on (account_id, contact_id) to strictly enforce
--      one conversation per (account, contact) at the database level.
-- ============================================================

CREATE OR REPLACE FUNCTION public.merge_duplicate_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group    RECORD;
  v_survivor UUID;
  v_losers   UUID[];
  v_merged   INTEGER := 0;
  v_latest_msg RECORD;
  v_unread_cnt INTEGER;
BEGIN
  FOR v_group IN
    SELECT account_id,
           contact_id,
           array_agg(id ORDER BY created_at ASC, id ASC) AS ids
    FROM conversations
    GROUP BY account_id, contact_id
    HAVING count(*) > 1
  LOOP
    v_survivor := v_group.ids[1];
    v_losers   := v_group.ids[2:array_length(v_group.ids, 1)];

    -- Re-point child rows from loser conversations to survivor conversation
    UPDATE messages          SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE message_reactions SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE deals             SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE flow_runs         SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE bookings          SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);
    UPDATE notifications     SET conversation_id = v_survivor WHERE conversation_id = ANY(v_losers);

    -- Delete loser conversations
    DELETE FROM conversations WHERE id = ANY(v_losers);

    -- Recompute survivor summary
    SELECT content_text, content_type, created_at
      INTO v_latest_msg
      FROM messages
     WHERE conversation_id = v_survivor
     ORDER BY created_at DESC
     LIMIT 1;

    SELECT count(*)
      INTO v_unread_cnt
      FROM messages
     WHERE conversation_id = v_survivor
       AND sender_type = 'customer'
       AND status <> 'read';

    IF v_latest_msg IS NOT NULL THEN
      UPDATE conversations
         SET last_message_at   = v_latest_msg.created_at,
             last_message_text = COALESCE(v_latest_msg.content_text, '[' || v_latest_msg.content_type || ']'),
             unread_count      = v_unread_cnt,
             updated_at        = NOW()
       WHERE id = v_survivor;
    END IF;

    v_merged := v_merged + COALESCE(array_length(v_losers, 1), 0);
  END LOOP;

  RETURN v_merged;
END;
$$;

ALTER FUNCTION public.merge_duplicate_conversations() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.merge_duplicate_conversations() FROM PUBLIC;

SELECT public.merge_duplicate_conversations();

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_account_contact
  ON conversations (account_id, contact_id);
