export type AssistantRole = 'user' | 'assistant';

export interface AssistantTurn {
  role: AssistantRole;
  content: string;
}

export interface AssistantContext {
  caseId?: string;
  institutionId?: string;
}

export interface AssistantSource {
  id: string;
  type: 'case' | 'institution' | 'relationship';
  label: string;
  href: string;
}

export interface AssistantResponse {
  answer: string;
  sources: AssistantSource[];
  counts: {
    cases: number;
    institutions: number;
    relationships: number;
  };
}
