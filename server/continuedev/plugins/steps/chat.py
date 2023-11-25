import html
from typing import List, Optional

from continuedev.plugins.steps.openai_run_func import OpenAIRunFunction

from ...libs.llm.base import CompletionOptions

# absolute import needed so instanceof works
from continuedev.core.main import ChatMessage, SetStep, Step
from ...core.sdk import ContinueSDK
from ...libs.util.devdata import dev_data_logger
from ...libs.util.strings import remove_quotes_and_escapes
from ...libs.util.telemetry import posthog_logger

FREE_USAGE_STEP_NAME = "Please enter OpenAI API key"


def add_ellipsis(text: str, max_length: int = 200) -> str:
    if len(text) > max_length:
        return text[: max_length - 3] + "..."
    return text


class SimpleChatStep(Step):
    name: str = "Generating Response..."
    manage_own_chat_context: bool = True
    description: str = ""
    messages: List[ChatMessage] = None
    prompt: Optional[str] = None

    completion_options: Optional[CompletionOptions] = None

    async def run(self, sdk: ContinueSDK):
        posthog_logger.capture_event(
            "model_use",
            {
                "model": sdk.models.default.model,
                "provider": sdk.models.default.__class__.__name__,
            },
        )
        dev_data_logger.capture(
            "model_use",
            {
                "model": sdk.models.default.model,
                "provider": sdk.models.default.__class__.__name__,
            },
        )
  
        messages = self.messages or await sdk.get_chat_context()

        if self.prompt and messages:
            messages[-1].content = self.prompt

        kwargs = self.completion_options.dict() if self.completion_options else {}
        session_id = sdk.get_session_id()
        generator = sdk.models.chat.stream_chat(messages, session_id=session_id, **kwargs)

        yield SetStep(description="")
        async for chunk in generator:
            print("Type of chunk:", type(chunk))
            print("Type of SetStep:", SetStep)


            if "content" in chunk:
                yield chunk["content"]

                # HTML unencode
                end_size = len(chunk["content"]) - 6
                if "&" in self.description[-end_size:]:
                    self.description = self.description[:-end_size] + html.unescape(
                        self.description[-end_size:]
                    )
            elif isinstance(chunk, OpenAIRunFunction):
                await chunk.run(sdk=sdk)
                #yield chunk

        if sdk.config.disable_summaries:
            self.name = ""
        else:
            yield SetStep(name="Generating title...")
            yield SetStep(
                name=add_ellipsis(
                    remove_quotes_and_escapes(
                        await sdk.models.summarize.complete(
                            f'"{self.description}"\n\nPlease write a short title summarizing the message quoted above. Use no more than 10 words:',
                            max_tokens=20,
                            log=False,
                            session_id = sdk.get_session_id()
                        )
                    ),
                    200,
                )
            )

        self.chat_context.append(
            ChatMessage(role="assistant", content=self.description, summary=self.name)
        )

        # TODO: Never actually closing.
        await generator.aclose()
