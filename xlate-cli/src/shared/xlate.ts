export type TranslationTaskStatus =
  | "PARSING"
  | "UPLOADING"
  | "TRANSLATING"
  | "COMPLETE"
  | "ERROR";

export interface TranslationTask {
  id: string;
  whenStarted: number;
  status: TranslationTaskStatus;
  client: string;
  project: string;
  uniqueStrings: string;
  languages: string[];
  totalTargetStrings: string;
  existingTargetStrings: string;
  stringsToXlate: string;
  stringsXlated: string;
}
