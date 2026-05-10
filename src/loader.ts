import { homedir } from 'os';
import { join } from 'path';

export function getDefaultKnowledgeBasePath(): string {
  return process.env.KB_SKILLS_KB_PATH ?? join(homedir(), '.pi', 'knowledge-base');
}
