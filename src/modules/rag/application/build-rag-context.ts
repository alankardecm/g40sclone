import { buildRagContext as buildLegacyRagContext } from '@/lib/rag';
import type { RagContextResult } from '@/shared/types/rag';

export async function buildRagContext(query: string): Promise<RagContextResult> {
  return buildLegacyRagContext(query);
}
