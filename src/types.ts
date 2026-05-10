export interface ValueTag {
  readonly key: string;
  readonly value: string;
}

export interface KnowledgeBaseArticle {
  readonly slug: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly ValueTag[];
  readonly filePath: string;
  /** Raw frontmatter fields (e.g. description, name) not stored in tags */
  readonly frontmatter: Record<string, unknown>;
}

export interface SkillSourceRecord {
  readonly article: KnowledgeBaseArticle;
  readonly skillName: string;
  readonly skillDescription: string;
  readonly skillContent: string;
}

export type ArticleScope = 'local' | 'global';

export interface CreateArticleOptions {
  readonly title: string;
  readonly tags: readonly ValueTag[];
  readonly content?: string;
  readonly created?: Date;
  readonly modified?: Date;
}

export interface SaveSkillOptions {
  readonly skillName: string;
  readonly skillContent: string;
  readonly docTitle?: string;
  readonly docContent?: string;
  readonly scope?: ArticleScope;
  readonly tags?: string;
  readonly enabled?: boolean;
}

export interface SaveSkillResult {
  readonly success: boolean;
  readonly skillSlug?: string;
  readonly docSlug?: string;
  readonly skillRef?: string;
  readonly error?: string;
}

export interface MaterializeSkillOptions {
  readonly articleSlug: string;
  readonly scope?: 'local' | 'global';
}

export interface MaterializeSkillResult {
  readonly success: boolean;
  readonly outputPath?: string;
  readonly skillName?: string;
  readonly error?: string;
}
