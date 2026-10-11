import type { Project } from '@/payload-types';
import { CodeEmbed } from './CodeEmbed';

type ContentBlock = NonNullable<Project['content']>[number];

/**
 * A document's content blocks, in order. Only the block types listed here are
 * drawn — the rest have no component yet and are skipped.
 */
export function RenderBlocks({ blocks }: { blocks?: ContentBlock[] | null }) {
  return blocks?.map((block, i) => {
    switch (block.blockType) {
      case 'codeEmbed':
        return <CodeEmbed key={block.id ?? i} {...block} />;
      default:
        return null;
    }
  });
}
