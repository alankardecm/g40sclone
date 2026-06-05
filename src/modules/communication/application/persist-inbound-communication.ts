import { getSupabaseAdmin } from '@/lib/supabase';
import { analyzeInboundMessage } from '@/modules/communication/application/message-analysis';
import type { PersistInboundCommunicationInput } from '@/shared/types/omnichannel';
import { transcribeAudio, analyzeImage } from '@/lib/ai';

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildConversationKey(input: PersistInboundCommunicationInput) {
  const rawConversationId = String(input.conversationId || '').trim();
  const rawConversationName = String(input.conversationName || '').trim();
  const fallbackId = rawConversationId || rawConversationName || `${input.source}-conversation`;
  const safeId = fallbackId.replace(/\s+/g, '-');

  return {
    conversationId: rawConversationId || fallbackId,
    conversationName: rawConversationName || rawConversationId || `${input.source} conversation`,
    storageKey: `${input.source}:${safeId}`,
  };
}

function buildGroupDescription(input: PersistInboundCommunicationInput) {
  const pieces = [
    input.source ? `Canal ${input.source}` : null,
    input.accountName ? `Conta ${input.accountName}` : null,
    input.accountId ? `Conta ID ${input.accountId}` : null,
  ].filter(Boolean);

  return pieces.join(' | ') || 'Canal monitorado';
}

export async function persistInboundCommunication(input: PersistInboundCommunicationInput) {
  const supabase = getSupabaseAdmin();
  let text = String(input.messageText || '').trim();
  const mediaBuffer = input.mediaBase64 ? Buffer.from(input.mediaBase64, 'base64') : null;

  // Processamento de Mídia (IA)
  if (mediaBuffer) {
    if (input.messageType === 'audioMessage') {
      const transcription = await transcribeAudio(mediaBuffer);
      if (transcription) {
        text = text ? `${text}\n[Transcrição]: ${transcription}` : `[Transcrição]: ${transcription}`;
      }
    } else if (input.messageType === 'imageMessage') {
      const description = await analyzeImage(
        mediaBuffer,
        'Descreva esta imagem recebida em um grupo do NOC/TI. Extraia erros, nomes de equipamentos ou status visiveis.'
      );
      if (description) {
        text = text ? `${text}\n[IA Vision]: ${description}` : `[IA Vision]: ${description}`;
      }
    }
  }

  if (!text) {
    return { ok: false as const, status: 400, error: 'message_text is required' };
  }

  const conversation = buildConversationKey(input);
  const rawMessageId = input.messageId?.trim();
  const externalMessageId =
    rawMessageId && input.source !== 'whatsapp' ? `${input.source}:${rawMessageId}` : rawMessageId;

  if (externalMessageId) {
    const { data: existingMessage, error: lookupError } = await supabase
      .from('wa_messages')
      .select('id')
      .eq('external_message_id', externalMessageId)
      .maybeSingle();

    if (lookupError) {
      return { ok: false as const, status: 500, error: lookupError.message };
    }

    if (existingMessage?.id) {
      return {
        ok: true as const,
        status: 200,
        duplicate: true,
        conversation_id: conversation.conversationId,
        conversation_name: conversation.conversationName,
        message_id: existingMessage.id,
      };
    }
  }

  const { data: groupsByStorageKey, error: groupFetchError } = await supabase
    .from('wa_groups')
    .select('id, whatsapp_jid, name')
    .eq('whatsapp_jid', conversation.storageKey);

  if (groupFetchError) {
    return { ok: false as const, status: 500, error: groupFetchError.message };
  }

  const exactGroup =
    (groupsByStorageKey || []).find((group) => group.whatsapp_jid === conversation.storageKey);

  let namedGroup = null;
  if (!exactGroup) {
    const { data: groupsByName, error: groupNameError } = await supabase
      .from('wa_groups')
      .select('id, whatsapp_jid, name')
      .ilike('name', conversation.conversationName)
      .limit(10);

    if (groupNameError) {
      return { ok: false as const, status: 500, error: groupNameError.message };
    }

    namedGroup =
      (groupsByName || []).find((group) => normalizeText(group.name) === normalizeText(conversation.conversationName)) || null;
  }

  let groupId = (exactGroup?.id || namedGroup?.id) as string | undefined;
  if (!groupId) {
    const { data: createdGroup, error: createGroupError } = await supabase
      .from('wa_groups')
      .insert({
        whatsapp_jid: conversation.storageKey,
        name: conversation.conversationName,
        description: buildGroupDescription(input),
        is_active: true,
      })
      .select('id')
      .single();

    if (createGroupError) {
      return { ok: false as const, status: 500, error: createGroupError.message };
    }

    groupId = createdGroup.id;
  }

  const analysis = await analyzeInboundMessage(text);
  const sentAt = input.sentAt || Math.floor(Date.now() / 1000);
  const bridgeName =
    [
      input.bridgeName,
      input.accountName ? `${input.source}:${input.accountName}` : null,
      input.accountId ? `${input.source}:${input.accountId}` : null,
    ].filter(Boolean)[0] || null;

  const { data: messageRow, error: messageError } = await supabase
    .from('wa_messages')
    .insert({
      group_id: groupId,
      source_type: input.sourceType,
      external_message_id: externalMessageId || null,
      bridge_name: bridgeName,
      sender_jid: input.senderId || null,
      sender_name: input.senderName || null,
      text_raw: text,
      message_type: input.messageType || null,
      msg_timestamp: sentAt,
      analysis_status: 'done',
    })
    .select('id')
    .single();

  if (messageError) {
    return { ok: false as const, status: 500, error: messageError.message };
  }

  const { error: analysisError } = await supabase.from('wa_analysis').insert({
    message_id: messageRow.id,
    sentiment: analysis.sentiment,
    sentiment_score: analysis.sentimentScore,
    keywords: analysis.keywords,
    topic: analysis.topic,
    urgency: analysis.urgency,
    summary: analysis.summary,
    flags: [
      ...analysis.flags,
      `channel_${input.source}`,
      input.accountId ? `account_${normalizeText(input.accountId).replace(/\s+/g, '_')}` : null,
    ].filter(Boolean),
    model_used: analysis.modelUsed,
  });

  if (analysisError) {
    return { ok: false as const, status: 500, error: analysisError.message };
  }

  return {
    ok: true as const,
    status: 200,
    conversation_id: conversation.conversationId,
    conversation_name: conversation.conversationName,
    message_id: messageRow.id,
    analysis: {
      sentiment: analysis.sentiment,
      sentiment_score: analysis.sentimentScore,
      keywords: analysis.keywords,
      topic: analysis.topic,
      urgency: analysis.urgency,
      flags: analysis.flags,
      summary: analysis.summary,
      model_used: analysis.modelUsed,
    },
  };
}
