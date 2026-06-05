import OpenAI from 'openai';

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});
