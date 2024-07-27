import dotenv from "dotenv";
import { AzureOpenAIApi } from "./apis/AzureOpenAI.js";
import { OpenAIApi } from "./apis/OpenAI.js";
import { BaseLlmApi } from "./apis/base.js";

dotenv.config();

export interface LlmApiConfig {
  provider: string;
  apiKey: string;
  apiBase?: string;
}

export function constructLlmApi(config: LlmApiConfig): BaseLlmApi {
  switch (config.provider) {
    case "openai":
      return new OpenAIApi(config);
    case "mistral":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.mistral.ai/v1/",
      });
    case "azure":
      return new AzureOpenAIApi(config);
    case "voyage":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.voyageai.com/v1/",
      });
    case "cohere":
      return new OpenAIApi({
        ...config,
        apiBase: "https://api.cohere.ai/v1/",
      });
    default:
      throw new Error(`Unsupported LLM API format: ${config.provider}`);
  }
}

export {
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatCompletionCreateParams,
  type ChatCompletionCreateParamsNonStreaming,
  type ChatCompletionCreateParamsStreaming,
  type Completion,
  type CompletionCreateParams,
  type CompletionCreateParamsNonStreaming,
  type CompletionCreateParamsStreaming,
} from "openai/resources/index.mjs";
