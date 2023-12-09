/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * Steps that are not allowed to be run, and will be skipped if attempted
 */
export type DisallowedSteps = string[] | null;
/**
 * If this field is set to True, we will collect anonymous telemetry as described in the documentation page on telemetry. If set to False, we will not collect any data.
 */
export type AllowAnonymousTelemetry = boolean | null;
/**
 * The title you wish to give your model.
 */
export type Title = string;
/**
 * The provider of the model. This is used to determine the type of model, and how to interact with it.
 */
export type Provider =
  | "openai"
  | "openai-free-trial"
  | "openai-agent"
  | "openai-aiohttp"
  | "anthropic"
  | "together"
  | "ollama"
  | "huggingface-tgi"
  | "huggingface-inference-api"
  | "llama.cpp"
  | "replicate"
  | "text-gen-webui"
  | "google-palm"
  | "lmstudio"
  | "llamafile";
/**
 * The name of the model. Used to autodetect prompt template.
 */
export type Model = string;
/**
 * OpenAI, Anthropic, Together, or other API key
 */
export type ApiKey = string | null;
/**
 * The base URL of the LLM API.
 */
export type ApiBase = string | null;
/**
 * The maximum context length of the LLM in tokens, as counted by count_tokens.
 */
export type ContextLength = number;
/**
 * The chat template used to format messages. This is auto-detected for most models, but can be overridden here.
 */
export type Template = ("llama2" | "alpaca" | "zephyr" | "phind" | "anthropic" | "chatml" | "deepseek") | null;
/**
 * The temperature of the completion.
 */
export type Temperature = number | null;
/**
 * The top_p of the completion.
 */
export type TopP = number | null;
/**
 * The top_k of the completion.
 */
export type TopK = number | null;
/**
 * The presence penalty Aof the completion.
 */
export type PresencePenalty = number | null;
/**
 * The frequency penalty of the completion.
 */
export type FrequencyPenalty = number | null;
/**
 * The stop tokens of the completion.
 */
export type Stop = string[] | null;
/**
 * The maximum number of tokens to generate.
 */
export type MaxTokens = number;
/**
 * The session_id of the UI.
 */
export type SessionId = string | null;
/**
 * The assistant_id of the UI.
 */
export type AssistantId = string | null;
/**
 * A system message that will always be followed by the LLM
 */
export type SystemMessage = string | null;
/**
 * Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts.
 */
export type Timeout = number | null;
/**
 * Whether to verify SSL certificates for requests.
 */
export type VerifySsl = boolean | null;
/**
 * Path to a custom CA bundle to use when making the HTTP request
 */
export type CaBundlePath = string | null;
/**
 * Proxy URL to use when making the HTTP request
 */
export type Proxy = string | null;
/**
 * Headers to use when making the HTTP request
 */
export type Headers = {
  [k: string]: string;
} | null;
export type Models = ModelDescription[];
/**
 * The default model. If other model roles are not set, they will fall back to default.
 */
export type Default = string;
/**
 * The model to use for chat. If not set, will fall back to default.
 */
export type Chat = string | null;
/**
 * The model to use for editing. If not set, will fall back to default.
 */
export type Edit = string | null;
/**
 * The model to use for summarization. If not set, will fall back to default.
 */
export type Summarize = string | null;
/**
 * A system message that will always be followed by the LLM
 */
export type SystemMessage1 = string | null;
/**
 * An array of slash commands that let you map custom Steps to a shortcut.
 */
export type SlashCommands = SlashCommand[] | null;
export type Name = string;
export type Description = string;
export type Step =
  | unknown
  | (
      | "AnswerQuestionChroma"
      | "GenerateShellCommandStep"
      | "EditHighlightedCodeStep"
      | "ShareSessionStep"
      | "CommentCodeStep"
      | "ClearHistoryStep"
      | "StackOverflowStep"
      | "OpenConfigStep"
    );
export type Params = {
  [k: string]: unknown;
} | null;
/**
 * An array of custom commands that allow you to reuse prompts. Each has name, description, and prompt properties. When you enter /<name> in the text input, it will act as a shortcut to the prompt.
 */
export type CustomCommands = CustomCommand[] | null;
export type Name1 = string;
export type Prompt = string;
export type Description1 = string;
export type Name2 = "diff" | "github" | "terminal" | "open" | "google" | "search" | "url" | "tree";
/**
 * A list of ContextProvider objects that can be used to provide context to the LLM by typing '@'. Read more about ContextProviders in the documentation.
 */
export type ContextProviders = ContextProviderWithParams[];
/**
 * An optional token to identify the user.
 */
export type UserToken = string | null;
/**
 * The URL of the server where development data is sent. No data is sent unless you have explicitly set the `user_token` property to a valid token that we have shared.
 */
export type DataServerUrl = string | null;
/**
 * If set to `True`, Continue will not generate summaries for each Step. This can be useful if you want to save on compute.
 */
export type DisableSummaries = boolean | null;
/**
 * If set to `True`, Continue will not index the codebase. This is mainly used for debugging purposes.
 */
export type DisableIndexing = boolean | null;
/**
 * Number of results to initially retrieve from vector database
 */
export type NRetrieve = number | null;
/**
 * Final number of results to use after re-ranking
 */
export type NFinal = number | null;
/**
 * Whether to use re-ranking, which will allow initial selection of n_retrieve results, then will use an LLM to select the top n_final results
 */
export type UseReranking = boolean;
/**
 * Number of results to group together when re-ranking. Each group will be processed in parallel.
 */
export type RerankGroupSize = number;
/**
 * Files to ignore when indexing the codebase. You can use glob patterns, such as ** /*.py. This is useful for directories that contain generated code, or other directories that are not relevant to the codebase.
 */
export type IgnoreFiles = string[];
/**
 * OpenAI API key
 */
export type OpenaiApiKey = string | null;
/**
 * OpenAI API base URL
 */
export type ApiBase1 = string | null;
/**
 * OpenAI API type
 */
export type ApiType = string | null;
/**
 * OpenAI API version
 */
export type ApiVersion = string | null;
/**
 * OpenAI organization ID
 */
export type OrganizationId = string | null;

export interface SerializedContinueConfig {
  disallowed_steps?: DisallowedSteps;
  allow_anonymous_telemetry?: AllowAnonymousTelemetry;
  models?: Models;
  /**
   * Roles for models. Each entry should be the title of a model in the models array.
   */
  model_roles?: ModelRoles;
  system_message?: SystemMessage1;
  /**
   * Default options for completion. These will be overriden by any options set for a specific model.
   */
  completion_options?: BaseCompletionOptions;
  slash_commands?: SlashCommands;
  custom_commands?: CustomCommands;
  context_providers?: ContextProviders;
  user_token?: UserToken;
  data_server_url?: DataServerUrl;
  disable_summaries?: DisableSummaries;
  disable_indexing?: DisableIndexing;
  /**
   * Settings for the retrieval system. Read more about the retrieval system in the documentation.
   */
  retrieval_settings?: RetrievalSettings | null;
  [k: string]: unknown;
}
export interface ModelDescription {
  title: Title;
  provider: Provider;
  model: Model;
  api_key?: ApiKey;
  api_base?: ApiBase;
  context_length?: ContextLength;
  template?: Template;
  /**
   * Options for the completion endpoint. Read more about the completion options in the documentation.
   */
  completion_options?: BaseCompletionOptions;
  system_message?: SystemMessage;
  /**
   * Options for the HTTP request to the LLM.
   */
  request_options?: RequestOptions;
  [k: string]: unknown;
}
export interface BaseCompletionOptions {
  temperature?: Temperature;
  top_p?: TopP;
  top_k?: TopK;
  presence_penalty?: PresencePenalty;
  frequency_penalty?: FrequencyPenalty;
  stop?: Stop;
  max_tokens?: MaxTokens;
  session_id?: SessionId;
  assistant_id?: AssistantId;
  [k: string]: unknown;
}
export interface RequestOptions {
  timeout?: Timeout;
  verify_ssl?: VerifySsl;
  ca_bundle_path?: CaBundlePath;
  proxy?: Proxy;
  headers?: Headers;
  [k: string]: unknown;
}
export interface ModelRoles {
  default: Default;
  chat?: Chat;
  edit?: Edit;
  summarize?: Summarize;
  [k: string]: unknown;
}
export interface SlashCommand {
  name: Name;
  description: Description;
  step?: Step;
  params?: Params;
  [k: string]: unknown;
}
export interface CustomCommand {
  name: Name1;
  prompt: Prompt;
  description: Description1;
  [k: string]: unknown;
}
export interface ContextProviderWithParams {
  name: Name2;
  params?: Params1;
  [k: string]: unknown;
}
export interface Params1 {
  [k: string]: unknown;
}
export interface RetrievalSettings {
  n_retrieve?: NRetrieve;
  n_final?: NFinal;
  use_reranking?: UseReranking;
  rerank_group_size?: RerankGroupSize;
  ignore_files?: IgnoreFiles;
  openai_api_key?: OpenaiApiKey;
  api_base?: ApiBase1;
  api_type?: ApiType;
  api_version?: ApiVersion;
  organization_id?: OrganizationId;
  [k: string]: unknown;
}
