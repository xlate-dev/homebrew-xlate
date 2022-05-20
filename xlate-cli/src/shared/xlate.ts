export type TranslationTaskStatus =
  | "PARSING"
  | "UPLOADING"
  | "TRANSLATING"
  | "COMPLETE"
  | "ERROR";

export interface TranslationTask {
  whenStarted: number;
  status: TranslationTaskStatus;
  client: string;
  project: string;
  uniqueStrings: string[];
  languages: string[];
  /*
    total_target_strings;
    existing_target_strings;
    strings_to_xlate;
    strings_xlated;
    */
}
