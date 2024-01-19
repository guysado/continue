export interface AutocompleteLanguageInfo {
  stopWords: string[];
  comment: string;
}

export const Typescript = {
  stopWords: ["function", "class", "module", "export "],
  comment: "//",
};
