export type RagSource = {
  title: string;
  source: string;
  score?: number;
  imageUrl?: string;
};

export type RagContextResult = {
  provider: 'pinecone' | 'empty' | string;
  context: string;
  sources: RagSource[];
  diagnostics: string[];
};
