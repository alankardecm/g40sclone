export type ChatMessage = {
  role: string;
  content?: string;
};

export type StructuredAssistantResponse = {
  answer: string;
  confidence?: number;
  needsClarification: boolean;
  clarifyingQuestion: string;
  nextStep: string;
  sourceHint: string;
};

export type OperationalAnswer = StructuredAssistantResponse;
