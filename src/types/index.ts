export type UserRole = "viewer" | "admin";

export type DocumentStatus = "processing" | "ready" | "failed";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface KnowledgeDocument {
  id: string;
  document_name: string;
  file_path: string;
  file_type: "pdf" | "docx";
  file_size: number | null;
  vector_collection_ref: string | null;
  uploaded_by: string | null;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunkMatch {
  id: string;
  document_id: string;
  content: string;
  page_number: number | null;
  document_name: string;
  similarity: number;
}

export interface Citation {
  document_name: string;
  page: number | null;
  document_id: string;
  snippet: string;
}

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export interface RagAnswer {
  answer: string;
  citations: Citation[];
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  followUps: string[];
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  document_ids?: string[];
  document_count?: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  document_id: string | null;
  collection_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: number | null;
  created_at?: string;
}
