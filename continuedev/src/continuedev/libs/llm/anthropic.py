from typing import Any, Coroutine

from anthropic import AI_PROMPT, HUMAN_PROMPT, AsyncAnthropic

from ..llm import LLM, CompletionOptions
from .prompts.chat import anthropic_template_messages


class AnthropicLLM(LLM):
    api_key: str
    "Anthropic API key"

    model: str = "claude-2"

    _async_client: AsyncAnthropic = None

    template_messages = anthropic_template_messages

    class Config:
        arbitrary_types_allowed = True

    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._async_client = AsyncAnthropic(api_key=self.api_key)

        if self.model == "claude-2":
            self.context_length = 100_000

    def collect_args(self, options: CompletionOptions):
        args = super().collect_args(options)

        if "max_tokens" in args:
            args["max_tokens_to_sample"] = args["max_tokens"]
            del args["max_tokens"]
        if "frequency_penalty" in args:
            del args["frequency_penalty"]
        if "presence_penalty" in args:
            del args["presence_penalty"]
        return args

    async def _stream_complete(self, prompt: str, options):
        args = self.collect_args(options)
        prompt = f"{HUMAN_PROMPT} {prompt} {AI_PROMPT}"

        async for chunk in await self._async_client.completions.create(
            prompt=prompt, stream=True, **args
        ):
            yield chunk.completion

    async def _complete(self, prompt: str, options) -> Coroutine[Any, Any, str]:
        args = self.collect_args(options)
        prompt = f"{HUMAN_PROMPT} {prompt} {AI_PROMPT}"
        return (
            await self._async_client.completions.create(prompt=prompt, **args)
        ).completion
