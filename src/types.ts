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
}

export interface SkillSourceRecord {
  readonly article: KnowledgeBaseArticle;
  readonly skillName: string;
  readonly skillDescription: string;
  readonly skillContent: string;
}

export interface KnowledgeBaseSkillsConfig {
  readonly knowledgeBasePath: string;
  readonly cacheRoot: string;
}
