import json
from typing import Callable, Optional

import aiohttp

from ..llm import LLM
from .prompts.chat import llama2_template_messages


class TogetherLLM(LLM):
    api_key: str
    "Together API key"

    model: str = "togethercomputer/RedPajama-INCITE-7B-Instruct"
    base_url: str = "https://api.together.xyz"
    verify_ssl: Optional[bool] = None

    _client_session: aiohttp.ClientSession = None

    template_messages: Callable = llama2_template_messages

    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._client_session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        )

    async def stop(self):
        await self._client_session.close()

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self._client_session.post(
            f"{self.base_url}/inference",
            json={
                "prompt": prompt,
                "stream_tokens": True,
                **args,
            },
            headers={"Authorization": f"Bearer {self.api_key}"},
        ) as resp:
            async for line in resp.content.iter_chunks():
                if line[1]:
                    json_chunk = line[0].decode("utf-8")
                    if json_chunk.startswith(": ping - ") or json_chunk.startswith(
                        "data: [DONE]"
                    ):
                        continue

                    chunks = json_chunk.split("\n")
                    for chunk in chunks:
                        if chunk.strip() != "":
                            if chunk.startswith("data: "):
                                chunk = chunk[6:]
                            json_chunk = json.loads(chunk)
                            if "choices" in json_chunk:
                                yield json_chunk["choices"][0]["text"]

    async def _complete(self, prompt: str, options):
        args = self.collect_args(options)

        async with self._client_session.post(
            f"{self.base_url}/inference",
            json={"prompt": prompt, **args},
            headers={"Authorization": f"Bearer {self.api_key}"},
        ) as resp:
            text = await resp.text()
            j = json.loads(text)
            if "choices" not in j["output"]:
                raise Exception(text)
            if "output" in j:
                return j["output"]["choices"][0]["text"]
