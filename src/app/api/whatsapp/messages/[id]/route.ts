import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/whatsapp/messages/[id]
 *
 * Deletes a message from the conversation thread, cascades related rows (e.g. reactions),
 * and updates the conversation's `last_message_text` and `last_message_at` so the inbox
 * snippet reflects the previous remaining message.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: messageId } = await params;
    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    // Resolve user's account_id via profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const accountId = profile?.account_id as string | undefined;
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 }
      );
    }

    // Find the message and verify account ownership of the parent conversation
    const { data: message, error: fetchErr } = await supabase
      .from('messages')
      .select('id, conversation_id, conversations!inner(account_id)')
      .eq('id', messageId)
      .maybeSingle();

    if (fetchErr || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const conv = message.conversations as unknown as { account_id: string } | null;
    if (conv?.account_id !== accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const conversationId = message.conversation_id;

    // Delete the message row
    const { error: deleteErr } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (deleteErr) {
      console.error('[delete-message] error deleting message:', deleteErr);
      return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
    }

    // Find the new latest message in the conversation (if any)
    const { data: latestMsg } = await supabase
      .from('messages')
      .select('content_text, content_type, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMsg) {
      const nextText = latestMsg.content_text || (latestMsg.content_type ? `[${latestMsg.content_type}]` : '');
      await supabase
        .from('conversations')
        .update({
          last_message_at: latestMsg.created_at,
          last_message_text: nextText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    } else {
      await supabase
        .from('conversations')
        .update({
          last_message_at: null,
          last_message_text: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    }

    return NextResponse.json({
      success: true,
      messageId,
      conversationId,
      lastMessageText: latestMsg ? (latestMsg.content_text || `[${latestMsg.content_type}]`) : null,
      lastMessageAt: latestMsg ? latestMsg.created_at : null,
    });
  } catch (err) {
    console.error('[delete-message] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
