/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type ContinueConfig = ContinueConfig1;
export type Name = string;
export type Hide = boolean;
export type Description = string;
export type SystemMessage = string;
export type Role = "assistant" | "user" | "system" | "function";
export type Content = string;
export type Name1 = string;
export type Summary = string;
export type Name2 = string;
export type Arguments = string;
export type ChatContext = ChatMessage[];
export type ManageOwnChatContext = boolean;
export type StepsOnStartup = Step[];
export type DisallowedSteps = string[];
export type AllowAnonymousTelemetry = boolean;
export type Models = Models1;
export type RequiresApiKey = string;
export type RequiresUniqueId = boolean;
export type RequiresWriteLog = boolean;
export type SystemMessage1 = string;
export type Temperature = number;
export type Name3 = string;
export type Prompt = string;
export type Description1 = string;
export type CustomCommands = CustomCommand[];
export type Name4 = string;
export type Description2 = string;
export type SlashCommands = SlashCommand[];
export type SystemMessage2 = string;
export type Title = string;
export type Name5 = string;
export type Description3 = string;
export type ProviderTitle = string;
export type ItemId = string;
export type Content1 = string;
export type Editing = boolean;
export type Editable = boolean;
export type SelectedItems = ContextItem[];
export type ContextProviders = ContextProvider[];

/**
 * A pydantic class for the continue config file.
 */
export interface ContinueConfig1 {
  steps_on_startup?: StepsOnStartup;
  disallowed_steps?: DisallowedSteps;
  allow_anonymous_telemetry?: AllowAnonymousTelemetry;
  models?: Models;
  temperature?: Temperature;
  custom_commands?: CustomCommands;
  slash_commands?: SlashCommands;
  on_traceback?: Step;
  system_message?: SystemMessage2;
  policy_override?: Policy;
  context_providers?: ContextProviders;
  [k: string]: unknown;
}
export interface Step {
  name?: Name;
  hide?: Hide;
  description?: Description;
  system_message?: SystemMessage;
  chat_context?: ChatContext;
  manage_own_chat_context?: ManageOwnChatContext;
  [k: string]: unknown;
}
export interface ChatMessage {
  role: Role;
  content?: Content;
  name?: Name1;
  summary: Summary;
  function_call?: FunctionCall;
  [k: string]: unknown;
}
export interface FunctionCall {
  name: Name2;
  arguments: Arguments;
  [k: string]: unknown;
}
/**
 * Main class that holds the current model configuration
 */
export interface Models1 {
  default: LLM;
  small?: LLM;
  medium?: LLM;
  large?: LLM;
  edit?: LLM;
  chat?: LLM;
  sdk?: ContinueSDK;
  [k: string]: unknown;
}
export interface LLM {
  requires_api_key?: RequiresApiKey;
  requires_unique_id?: RequiresUniqueId;
  requires_write_log?: RequiresWriteLog;
  system_message?: SystemMessage1;
  [k: string]: unknown;
}
export interface ContinueSDK {
  [k: string]: unknown;
}
export interface CustomCommand {
  name: Name3;
  prompt: Prompt;
  description: Description1;
  [k: string]: unknown;
}
export interface SlashCommand {
  name: Name4;
  description: Description2;
  step: Step1;
  params?: Params;
  [k: string]: unknown;
}
export interface Step1 {
  [k: string]: unknown;
}
export interface Params {
  [k: string]: unknown;
}
/**
 * A rule that determines which step to take next
 */
export interface Policy {
  [k: string]: unknown;
}
/**
 * The ContextProvider class is a plugin that lets you provide new information to the LLM by typing '@'.
 * When you type '@', the context provider will be asked to populate a list of options.
 * These options will be updated on each keystroke.
 * When you hit enter on an option, the context provider will add that item to the autopilot's list of context (which is all stored in the ContextManager object).
 */
export interface ContextProvider {
  title: Title;
  sdk?: ContinueSDK1;
  selected_items?: SelectedItems;
  [k: string]: unknown;
}
/**
 * To avoid circular imports
 */
export interface ContinueSDK1 {
  [k: string]: unknown;
}
/**
 * A ContextItem is a single item that is stored in the ContextManager.
 */
export interface ContextItem {
  description: ContextItemDescription;
  content: Content1;
  editing?: Editing;
  editable?: Editable;
  [k: string]: unknown;
}
/**
 * A ContextItemDescription is a description of a ContextItem that is displayed to the user when they type '@'.
 *
 * The id can be used to retrieve the ContextItem from the ContextManager.
 */
export interface ContextItemDescription {
  name: Name5;
  description: Description3;
  id: ContextItemId;
  [k: string]: unknown;
}
/**
 * A ContextItemId is a unique identifier for a ContextItem.
 */
export interface ContextItemId {
  provider_title: ProviderTitle;
  item_id: ItemId;
  [k: string]: unknown;
}
