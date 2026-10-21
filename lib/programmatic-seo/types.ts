export type GuardrailCategory = "LOW_VALUE" | "THIN_CONTENT" | "DUPLICATE";

export interface GuardrailFinding {
  category: GuardrailCategory;
  description: string;
}
