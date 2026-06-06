import { NextResponse } from 'next/server';
import { persistInboundCommunication } from '@/modules/communication/application/persist-inbound-communication';
import { handleBotMessage } from '@/lib/evolution-bot';
import { sendText } from '@/lib/evolution-api';
import { handleAudioMeeting } from '@/lib/netmeet-whatsapp';
import { registerLid, resolveReplyTarget } from '@/lib/bot-registry';
import { getEmailByPhone, registerPhoneEmail, isPhoneRegistered } from '@/lib/phone-email-registry';
import { savePendingAudio, getPendingAudio, clearPendingAudio } from '@/lib/pending-audio';
import { isEmailKnown } from '@/lib/user-registry';

// Payload da Evolution API v1.x — evento MESSAGES_UPSERT
// data é um array de mensagens
type EvoMessageItem = {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string };
    audioMessage?: object;
    videoMessage?: { caption?: string };
    documentMessage?: { title?: string; mimetype?: string };
    stickerMessage?: object;
  };
  messageType: string;
  messageTimestamp: number;
  pushName?: string;
};

type EvoWebhookPayload = {
  event: string;        // "MESSAGES_UPSERT" em v1.x
  instance: string;
  data: EvoMessageItem | EvoMessageItem[];
  apikey?: string;
};

function extractText(item: EvoMessageItem): string {
  const m = item.message ?? {};
  const raw =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.title ||
    '';
  if (raw) return raw;

  const labels: Record<string, string> = {
    audioMessage:    '[audio recebido]',
    imageMessage:    '[imagem recebida]',
    videoMessage:    '[video recebido]',
    documentMessage: '[documento recebido]',
    stickerMessage:  '[figurinha recebida]',
    locationMessage: '[localizacao recebida]',
    contactMessage:  '[contato recebido]',
  };
  return labels[item.messageType] ?? '';
}

function isGroup(jid: string) {
  return jid.endsWith('@g.us');
}

// Normaliza o nome do evento para comparação
function isMessageUpsert(event: string) {
  const e = event.toLowerCase().replace(/[._]/g, '');
  return e === 'messagesupsert';
}

// Deduplicação em memória para respostas do bot — evita responder múltiplas
// vezes quando a Evolution API faz retry do webhook por timeout
const botRespondedIds = new Map<string, number>();
const BOT_DEDUP_TTL_MS = 5 * 60 * 1000; // 5 min

function hasBotResponded(msgId: string): boolean {
  const ts = botRespondedIds.get(msgId);
  return ts !== undefined && Date.now() - ts < BOT_DEDUP_TTL_MS;
}

function markBotResponded(msgId: string) {
  botRespondedIds.set(msgId, Date.now());
  // Limpeza periódica para evitar crescimento ilimitado
  if (botRespondedIds.size > 1000) {
    const cutoff = Date.now() - BOT_DEDUP_TTL_MS;
    for (const [id, ts] of botRespondedIds) {
      if (ts < cutoff) botRespondedIds.delete(id);
    }
  }
}

// Mensagens com mais de 60s são históricas (batch de reconexão da Evolution)
// O bot não deve responder a elas para evitar spam
const BOT_RECENCY_WINDOW_MS = 60_000;

function isRecentMessage(timestampSeconds: number): boolean {
  return Date.now() - timestampSeconds * 1000 < BOT_RECENCY_WINDOW_MS;
}

export async function POST(req: Request) {
  const payload = (await req.json()) as EvoWebhookPayload;

  // Ignorar tudo que não seja mensagem nova em tempo real
  if (!isMessageUpsert(payload.event)) {
    return NextResponse.json({ ok: true, skipped: true, event: payload.event });
  }

  // v1.x envia array; normaliza para sempre trabalhar com array
  const items = Array.isArray(payload.data) ? payload.data : [payload.data];
  const instance = payload.instance;

  const incoming = items.filter(item => !item.key.fromMe);

  // Persiste todas as mensagens no pipeline existente
  const results = await Promise.allSettled(
    incoming.map(item => {
      const jid   = item.key.remoteJid;
      const group = isGroup(jid);

      return persistInboundCommunication({
        source:           'whatsapp',
        sourceType:       group ? 'whatsapp_group' : 'whatsapp_direct',
        conversationId:   jid,
        conversationName: group ? jid.split('@')[0] : (item.pushName ?? jid.split('@')[0]),
        senderId:         item.key.participant ?? (group ? null : jid),
        senderName:       item.pushName ?? null,
        messageId:        item.key.id,
        messageText:      extractText(item),
        messageType:      item.messageType,
        mediaBase64:      null,
        mediaMimeType:    null,
        bridgeName:       `evolution:${instance}`,
        sentAt:           item.messageTimestamp,
      });
    })
  );

  // Bot: responde mensagens diretas (não de grupo) — texto e áudio
  for (const item of incoming) {
    const jid        = item.key.remoteJid;
    const text       = extractText(item).trim();
    const isTextMsg  = item.messageType === 'conversation' || item.messageType === 'extendedTextMessage';
    const isAudioDoc = item.messageType === 'documentMessage' &&
      (item.message?.documentMessage?.mimetype ?? '').startsWith('audio/')
    const isAudioMsg = item.messageType === 'audioMessage' || isAudioDoc;

    if (isGroup(jid)) continue;
    if (!isTextMsg && !isAudioMsg) continue;

    // Áudio: só bloqueia reenvio duplicado — não aplica filtro de recência
    // (áudio é sempre intencional; o servidor pode ter reiniciado durante o build)
    // Texto: aplica filtro de 60s para descartar batch histórico na reconexão da Evolution
    if (!isAudioMsg && !isRecentMessage(item.messageTimestamp)) continue;
    if (hasBotResponded(item.key.id)) continue;
    markBotResponded(item.key.id);

    // Áudio → NetMeet
    if (isAudioMsg) {
      const replyPhone = await resolveReplyTarget(jid);
      const replyTo    = replyPhone ?? (!jid.includes('@lid') ? jid.split('@')[0] : null);

      console.log(`[NetMeet] áudio recebido — jid=${jid} replyTo=${replyTo ?? 'null (LID sem registro)'}`);

      if (!replyTo) {
        // JID @lid sem registro — tenta avisar (geralmente falha, mas loga para diagnóstico)
        console.warn(`[NetMeet] @lid sem registro: ${jid} — não é possível responder`);
        sendText(instance, jid,
          '🎙️ *Áudio recebido!*\n\nPara usar o NetMeet, envie primeiro:\n*/start SEU_NUMERO*\n\nEx: `/start 19999999999`'
        ).catch(() => {/* @lid sem registro — falha esperada */});
        continue;
      }

      const email = await getEmailByPhone(replyTo);
      console.log(`[NetMeet] email para ${replyTo}: ${email ?? 'não registrado'}`);

      if (email) {
        handleAudioMeeting(instance, item, replyTo, email, item.pushName)
          .catch(err => console.error('[NetMeet] erro ao processar áudio:', err));
      } else {
        await savePendingAudio(replyTo, {
          instance, item, replyTo,
          pushName: item.pushName ?? '',
          timestamp: new Date().toISOString(),
        });
        sendText(instance, replyTo,
          '🎙️ *Áudio recebido!*\n\nInforme seu email corporativo para salvar a ata:\n_(ex: colaborador@suaempresa.com)_'
        ).catch(err => console.error('[NetMeet] erro ao pedir email:', err));
      }
      continue;
    }

    // Texto
    if (!text) continue;

    // Comando /start <numero> — registra mapeamento LID → número real
    const startMatch = text.match(/^\/start\s+([\d\s()\-+]+)$/i);
    if (startMatch && jid.includes('@lid')) {
      const lid   = jid.split('@')[0];
      const phone = startMatch[1].replace(/\D/g, '');
      const full  = phone.startsWith('55') ? phone : `55${phone}`;
      await registerLid(lid, full);
      sendText(instance, full,
        '✅ Número registrado! Agora posso responder suas mensagens.\n\nTente: *status* ou *oi*'
      ).catch(err => console.error('[Bot] erro ao confirmar /start:', err));
      continue;
    }

    // Resolve destino: número real (se LID registrado) ou número do JID
    const replyPhone = await resolveReplyTarget(jid);
    const replyTo    = replyPhone ?? (!jid.includes('@lid') ? jid.split('@')[0] : null);

    if (!replyTo) {
      // LID ainda não registrado — tenta avisar (vai falhar silenciosamente)
      sendText(instance, jid,
        '👋 Para ativar o assistente, envie:\n*/start SEU_NUMERO*\n\nEx: `/start 19999999999`'
      ).catch(() => console.warn(`[Bot] @lid sem registro, não respondeu: ${jid}`));
      continue;
    }

    // Detecção de email — registro de usuário no bot
    const emailMatch = text.match(/^[\w.+-]+@[\w-]+\.[\w.]+$/)
    if (emailMatch) {
      const email = emailMatch[0].toLowerCase()
      // Verifica se o email existe no Hub (logado ou pré-cadastrado)
      if (!(await isEmailKnown(email))) {
        const appName = process.env.NEXT_PUBLIC_APP_NAME || 'AM OS';
        sendText(instance, replyTo,
          `❌ Email *${email}* não encontrado no ${appName}.\n\nPeça ao administrador para cadastrá-lo ou acesse ${process.env.NEXTAUTH_URL ?? 'o portal'} para fazer login.`
        ).catch(() => {})
        continue
      }
      await registerPhoneEmail(replyTo, email)
      const pending = await getPendingAudio(replyTo)
      if (pending) {
        await clearPendingAudio(replyTo)
        sendText(instance, replyTo, `✅ Email *${email}* registrado! Processando sua ata agora...`).catch(() => {})
        handleAudioMeeting(
          pending.instance,
          pending.item as Parameters<typeof handleAudioMeeting>[1],
          pending.replyTo,
          email,
          pending.pushName,
        ).catch(err => console.error('[NetMeet] erro ao processar áudio pendente:', err))
      } else {
        sendText(instance, replyTo,
          `✅ Email *${email}* registrado! Agora pode usar o assistente normalmente.\n\nTente: *status*, *oi* ou faça uma pergunta sobre os dados.`
        ).catch(() => {})
      }
      continue
    }

    // Verifica se o número está autorizado (tem email registrado no bot)
    if (!(await isPhoneRegistered(replyTo))) {
      sendText(instance, replyTo,
        '👋 Para usar o assistente, informe seu email corporativo:\n_(ex: colaborador@suaempresa.com)_'
      ).catch(() => {})
      continue
    }

    // Fire-and-forget
    handleBotMessage(text, item.pushName ?? undefined, replyTo)
      .then(reply => sendText(instance, replyTo, reply))
      .catch(err  => console.error('[Bot] falha ao responder:', err));
  }

  const saved  = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return NextResponse.json({ ok: true, saved, failed });
}
