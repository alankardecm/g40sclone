export type OmnichannelSource =
  | 'whatsapp'
  | 'telegram'
  | 'instagram'
  | 'email'
  | 'webchat'
  | 'sms'
  | 'other';

export type OmnichannelInboundPayload = {
  source?: OmnichannelSource;
  source_type?: string;
  bridge_name?: string;
  account_id?: string;
  account_name?: string;
  conversation_id?: string;
  conversation_name?: string;
  group_id?: string;
  group_name?: string;
  group_jid?: string;
  sender_id?: string;
  sender_name?: string;
  sender_jid?: string;
  message_id?: string;
  message_text?: string;
  text?: string;
  message_type?: string;
  timestamp?: number | string;
  msg_timestamp?: number;
  metadata?: Record<string, unknown>;
};

export type PersistInboundCommunicationInput = {
  source: OmnichannelSource;
  sourceType: string;
  conversationId?: string;
  conversationName?: string;
  senderId?: string | null;
  senderName?: string | null;
  messageId?: string | null;
  messageText: string;
  messageType?: string | null;
  mediaBase64?: string | null;
  mediaMimeType?: string | null;
  bridgeName?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  metadata?: Record<string, unknown>;
  sentAt?: number;
};
