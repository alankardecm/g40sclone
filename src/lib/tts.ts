import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const openAiApiKey = process.env.OPENAI_API_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY;
const ttsProvider = process.env.TTS_PROVIDER || (googleApiKey ? 'google' : 'openai');
const ttsModel = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const ttsVoice = process.env.OPENAI_TTS_VOICE || 'marin';
const ttsFormat = process.env.OPENAI_TTS_FORMAT || 'mp3';
const ttsSpeed = Number(process.env.OPENAI_TTS_SPEED || '1');

const openAiClient = openAiApiKey
  ? new OpenAI({
      apiKey: openAiApiKey,
    })
  : null;

const genAI = googleApiKey ? new GoogleGenerativeAI(googleApiKey) : null;

export function isServerTtsConfigured() {
  return Boolean((openAiClient && openAiApiKey) || (genAI && googleApiKey));
}

export async function synthesizeSpeech(input: string) {
  const text = String(input || '').trim();
  if (!text) {
    throw new Error('tts_input_required');
  }

  // Se o provedor for Google ou se não houver OpenAI configurada mas houver Google
  if (ttsProvider === 'google' || (!openAiApiKey && googleApiKey)) {
    if (!genAI) throw new Error('google_tts_not_configured');

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      // Nota: Gemini 2.0 Flash suporta saída de áudio nativa em algumas configurações, 
      // mas aqui usamos um prompt para garantir a geração de um boletim.
      // Em uma implementação futura mais profunda, usaríamos o stream de áudio real do modelo.
      // Por enquanto, como o SDK do Gemini 2.0 para Node.js ainda está evoluindo na parte de áudio binário direto,
      // se falhar o binário, faremos o fallback para OpenAI se disponível.
      
      if (openAiClient && openAiApiKey) {
        return synthesizeSpeechWithOpenAI(text);
      }
      
      throw new Error('gemini_tts_binary_not_yet_implemented_in_this_sdk_version');
    } catch (err) {
      if (openAiClient && openAiApiKey) {
        return synthesizeSpeechWithOpenAI(text);
      }
      throw err;
    }
  }

  return synthesizeSpeechWithOpenAI(text);
}

async function synthesizeSpeechWithOpenAI(text: string) {
  if (!openAiClient || !openAiApiKey) {
    throw new Error('openai_tts_not_configured');
  }

  const response = await openAiClient.audio.speech.create({
    model: ttsModel,
    voice: ttsVoice,
    input: text,
    response_format: ttsFormat as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm',
    speed: Number.isFinite(ttsSpeed) ? Math.min(Math.max(ttsSpeed, 0.25), 4) : 1,
    instructions:
      'Fale em portugues do Brasil com tom natural, executivo e calor humano. Soe confiante, claro e nada robotizado.',
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    buffer,
    contentType: ttsFormat === 'wav' ? 'audio/wav' : ttsFormat === 'aac' ? 'audio/aac' : ttsFormat === 'opus' ? 'audio/ogg' : ttsFormat === 'flac' ? 'audio/flac' : 'audio/mpeg',
    fileExtension: ttsFormat,
    model: ttsModel,
    voice: ttsVoice,
  };
}

