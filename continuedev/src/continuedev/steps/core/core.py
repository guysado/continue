# These steps are depended upon by ContinueSDK
import os
import subprocess
from textwrap import dedent
from typing import Coroutine, List, Union

from ...models.main import Range
from ...libs.llm.prompt_utils import MarkdownStyleEncoderDecoder
from ...models.filesystem_edit import EditDiff, FileEdit, FileEditWithFullContents, FileSystemEdit
from ...models.filesystem import FileSystem, RangeInFile, RangeInFileWithContents
from ...core.observation import Observation, TextObservation, TracebackObservation, UserInputObservation
from ...core.main import Step, SequentialStep
from ...libs.llm.openai import MAX_TOKENS_FOR_MODEL
import difflib


class ContinueSDK:
    pass


class Models:
    pass


class ReversibleStep(Step):
    async def reverse(self, sdk: ContinueSDK):
        raise NotImplementedError


class MessageStep(Step):
    name: str = "Message"
    message: str

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return self.message

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        return TextObservation(text=self.message)


class FileSystemEditStep(ReversibleStep):
    edit: FileSystemEdit
    _diff: Union[EditDiff, None] = None

    hide: bool = True

    async def run(self, sdk: "ContinueSDK") -> Coroutine[Observation, None, None]:
        self._diff = await sdk.ide.applyFileSystemEdit(self.edit)
        return None

    async def reverse(self, sdk: "ContinueSDK"):
        await sdk.ide.applyFileSystemEdit(self._diff.backward)
        # Where and when should file saves happen?


def output_contains_error(output: str) -> bool:
    return "Traceback" in output or "SyntaxError" in output


AI_ASSISTED_STRING = "(✨ AI-Assisted ✨)"


class ShellCommandsStep(Step):
    cmds: List[str]
    cwd: Union[str, None] = None
    name: str = "Run Shell Commands"
    handle_error: bool = True

    _err_text: Union[str, None] = None

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        if self._err_text is not None:
            return f"Error when running shell commands:\n```\n{self._err_text}\n```"

        cmds_str = "\n".join(self.cmds)
        return await models.gpt35.complete(f"{cmds_str}\n\nSummarize what was done in these shell commands, using markdown bullet points:")

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        cwd = await sdk.ide.getWorkspaceDirectory() if self.cwd is None else self.cwd

        for cmd in self.cmds:
            output = await sdk.ide.runCommand(cmd)
            if self.handle_error and output is not None and output_contains_error(output):
                suggestion = await sdk.models.gpt35.complete(dedent(f"""\
                    While running the command `{cmd}`, the following error occurred:

                    ```ascii
                    {output}
                    ```

                    This is a brief summary of the error followed by a suggestion on how it can be fixed:"""), with_history=await sdk.get_chat_context())

                sdk.raise_exception(
                    title="Error while running query", message=output, with_step=MessageStep(name=f"Suggestion to solve error {AI_ASSISTED_STRING}", message=f"{suggestion}\n\nYou can click the retry button on the failed step to try again.")
                )

        return TextObservation(text=output)

        # process = subprocess.Popen(
        #     '/bin/bash', stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=cwd)

        # stdin_input = "\n".join(self.cmds)
        # out, err = process.communicate(stdin_input.encode())

        # # If it fails, return the error
        # if err is not None and err != "":
        #     self._err_text = err
        #     return TextObservation(text=err)

        # return None


class DefaultModelEditCodeStep(Step):
    user_input: str
    range_in_files: List[RangeInFile]
    name: str = "Editing Code"
    hide = False
    _prompt: str = dedent("""\
        # Task instructions

        You are an AI assistant that is tasked with editing a section of code within a file as instructed by a human developer. You will be provided with the original code section to edit, the code that comes before the code section, the code that comes after the code section, and the edit instructions as context. Please make sure to only output the code you have been asked to edit. It is very important that this code runs and is in the correct programming language. I will now provide you with two examples and then give you the task.

        # Example #1

        ## The code that comes before the section

        a = 5
        b = 4

        ## The code that comes after the code section

        def mul(a, b):
            return a * b

        ## Code section to be edited

        def sum():
            return a + b

        ## Edit instructions

        Make a and b parameters of sum

        ## Edited code section

        def sum(a, b):
            return a + b

        # Example #2

        ## The code that comes before it

        export class CapturedTerminal {
            private readonly terminal: vscode.Terminal;
            private readonly shellCmd: string;
            private readonly ptyProcess: any;

            private shellPrompt: string | undefined = undefined;
            private dataBuffer: string = "";

            private onDataListeners: ((data: string) => void)[] = [];

            show() {
                this.terminal.show();
            }

            isClosed(): boolean {
                return this.terminal.exitStatus !== undefined;
            }

            private commandQueue: [string, (output: string) => void][] = [];
            private hasRunCommand: boolean = false;

        ## The code that comes after it

          private async waitForCommandToFinish() {
            return new Promise<string>((resolve, reject) => {
            this.onDataListeners.push((data: any) => {
                const strippedData = stripAnsi(data);
                this.dataBuffer += strippedData;
                if (this.dataEndsInPrompt(strippedData)) {
                resolve(this.dataBuffer);
                this.dataBuffer = "";
                this.onDataListeners = [];
                }
            });
            });
        }

        ## Code section to be edited

        private dataEndsInPrompt(strippedData: string): boolean {
            const lines = this.dataBuffer.split("\n");
            return (
            lines.length > 0 &&
            (lines[lines.length - 1].includes("bash-") ||
                lines[lines.length - 1].includes(") $ ")) &&
            lines[lines.length - 1].includes("$")
            );
        }

        ## Edit instructions

        more reliably parse the command line prompt for different shells

        ## Edited code section

        private dataEndsInPrompt(strippedData: string): boolean {
            const lines = strippedData.split("\n");
            const lastLine = lines[lines.length - 1];

            return (
            lines.length > 0 &&
            (((lastLine.includes("bash-") || lastLine.includes(") $ ")) &&
                lastLine.includes("$")) ||
                (lastLine.includes("]> ") && lastLine.includes(") [")) ||
                (lastLine.includes(" (") && lastLine.includes(")>")) ||
                (typeof this.commandPromptString !== "undefined" &&
                (lastLine.includes(this.commandPromptString) ||
                    this.commandPromptString.length -
                    longestCommonSubsequence(lastLine, this.commandPromptString)
                        .length <
                    3)))
            );
        }

        # Task

        Now complete the task by outputting an edit. DO NOT rewrite the code that comes before or after the original code to edit. You are only to rewrite the original code as instructed:

        ## The code that comes before the section

        {prefix}

        ## The code that comes after the code section

        {suffix}

        ## Code section to be edited

        {commit}

        ## Edit instructions

        {commit_msg}

        ## Edited code section


        """)

    _prompt_and_completion: str = ""

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        description = await models.gpt35.complete(
            f"{self._prompt_and_completion}\n\nPlease give brief a description of the changes made above using markdown bullet points. Be concise and only mention changes made to the commit before, not prefix or suffix:")
        self.name = await models.gpt35.complete(f"Write a very short title to describe this requested change: '{self.user_input}'. This is the title:")
        return f"`{self.user_input}`\n\n" + description

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        self.description = f"`{self.user_input}`"
        await sdk.update_ui()

        rif_with_contents = []
        for range_in_file in self.range_in_files:
            file_contents = await sdk.ide.readRangeInFile(range_in_file)
            rif_with_contents.append(
                RangeInFileWithContents.from_range_in_file(range_in_file, file_contents))

        rif_dict = {}
        for rif in rif_with_contents:
            rif_dict[rif.filepath] = rif.contents

        for rif in rif_with_contents:
            await sdk.ide.setFileOpen(rif.filepath)

            model_to_use = sdk.models.default

            full_file_contents = await sdk.ide.readFile(rif.filepath)

            full_file_contents_lst = full_file_contents.split("\n")

            max_start_line = rif.range.start.line
            min_end_line = rif.range.end.line
            cur_start_line = 0
            cur_end_line = len(full_file_contents_lst) - 1

            def cut_context(model_to_use, total_tokens, cur_start_line, cur_end_line):

                if total_tokens > MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                    while cur_end_line > min_end_line:
                        total_tokens -= model_to_use.count_tokens(
                            full_file_contents_lst[cur_end_line])
                        cur_end_line -= 1
                        if total_tokens < MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                            return cur_start_line, cur_end_line

                    if total_tokens > MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                        while cur_start_line < max_start_line:
                            cur_start_line += 1
                            total_tokens -= model_to_use.count_tokens(
                                full_file_contents_lst[cur_end_line])
                            if total_tokens < MAX_TOKENS_FOR_MODEL[model_to_use.name]:
                                return cur_start_line, cur_end_line

                return cur_start_line, cur_end_line

            if model_to_use.name == "gpt-4":

                total_tokens = model_to_use.count_tokens(full_file_contents)
                cur_start_line, cur_end_line = cut_context(
                    model_to_use, total_tokens, cur_start_line, cur_end_line)

            elif model_to_use.name == "gpt-3.5-turbo" or model_to_use.name == "gpt-3.5-turbo-16k":

                if sdk.models.gpt35.count_tokens(full_file_contents) > MAX_TOKENS_FOR_MODEL["gpt-3.5-turbo"]:

                    model_to_use = sdk.models.gpt3516k
                    total_tokens = model_to_use.count_tokens(
                        full_file_contents)
                    cur_start_line, cur_end_line = cut_context(
                        model_to_use, total_tokens, cur_start_line, cur_end_line)

            else:

                raise Exception("Unknown default model")

            code_before = "".join(
                full_file_contents_lst[cur_start_line:max_start_line])
            code_after = "".join(
                full_file_contents_lst[min_end_line:cur_end_line])

            segs = [code_before, code_after]

            prompt = self._prompt.format(
                code=rif.contents, user_request=self.user_input, file_prefix=segs[0], file_suffix=segs[1])

            lines = []
            unfinished_line = ""
            i = 0
            original_lines = rif.contents.split("\n")
            lines_to_highlight = []

            async def add_line(i: int, line: str):
                range = Range.from_shorthand(
                    rif.range.start.line + i, rif.range.start.character if i == 0 else 0, rif.range.start.line + i + 1, 0)
                await sdk.ide.applyFileSystemEdit(FileEdit(
                    filepath=rif.filepath,
                    range=range,
                    replacement=line + "\n"
                ))
                lines_to_highlight.append(rif.range.start.line + i)
                # await sdk.ide.highlightCode(RangeInFile(
                #     filepath=rif.filepath,
                #     range=range
                # ))

            async for chunk in model_to_use.stream_chat(prompt, with_history=await sdk.get_chat_context()):
                chunk_lines = chunk.split("\n")
                chunk_lines[0] = unfinished_line + chunk_lines[0]
                if chunk.endswith("\n"):
                    unfinished_line = ""
                    chunk_lines.pop()  # because this will be an empty string
                else:
                    unfinished_line = chunk_lines.pop()
                lines.extend(chunk_lines)

                for line in chunk_lines:
                    if i < len(original_lines) and line == original_lines[i]:
                        i += 1
                        continue

                    await add_line(i, line)
                    i += 1

            # Add the unfinished line
            if unfinished_line != "":
                if not i < len(original_lines) or not unfinished_line == original_lines[i]:
                    await add_line(i, unfinished_line)
                lines.append(unfinished_line)
                i += 1

            # Remove the leftover original lines
            while i < len(original_lines):
                range = Range.from_shorthand(
                    rif.range.start.line + i, rif.range.start.character, rif.range.start.line + i, len(original_lines[i]))
                await sdk.ide.applyFileSystemEdit(FileEdit(
                    filepath=rif.filepath,
                    range=range,
                    replacement=""
                ))
                # await sdk.ide.highlightCode(RangeInFile(
                #     filepath=rif.filepath,
                #     range=range
                # ))
                i += 1

            completion = "\n".join(lines)
            # eot_token = "<|endoftext|>"
            # completion = completion.removesuffix(eot_token)

            # # Remove tags and If it accidentally includes prefix or suffix, remove it
            # if completion.strip().startswith("```"):
            #     completion = completion.strip().removeprefix("```").removesuffix("```")
            # completion = completion.replace("<file_prefix>", "").replace("<file_suffix>", "").replace(
            #     "<commit_before>", "").replace("<commit_msg>", "").replace("<commit_after>", "")
            # completion = completion.removeprefix(segs[0])
            # completion = completion.removesuffix(segs[1])

            self._prompt_and_completion += prompt + completion

            # await sdk.ide.applyFileSystemEdit(FileEdit(
            #     filepath=rif.filepath,
            #     range=rif.range,
            #     replacement=completion
            # ))

            current_hl_start = None
            last_hl = None
            rifs_to_highlight = []
            for line in lines_to_highlight:
                if current_hl_start is None:
                    current_hl_start = line
                elif line != last_hl + 1:
                    rifs_to_highlight.append(RangeInFile(
                        filepath=rif.filepath, range=Range.from_shorthand(current_hl_start, 0, last_hl, 0)))
                    current_hl_start = line
                last_hl = line

            if current_hl_start is not None:
                rifs_to_highlight.append(RangeInFile(
                    filepath=rif.filepath, range=Range.from_shorthand(current_hl_start, 0, last_hl, 0)))

            for rif_to_hl in rifs_to_highlight:
                await sdk.ide.highlightCode(rif_to_hl)

            await sdk.ide.saveFile(rif.filepath)


class EditFileStep(Step):
    filepath: str
    prompt: str
    hide: bool = True

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return "Editing file: " + self.filepath

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        file_contents = await sdk.ide.readFile(self.filepath)
        await sdk.run_step(DefaultModelEditCodeStep(
            range_in_files=[RangeInFile.from_entire_file(
                self.filepath, file_contents)],
            user_input=self.prompt
        ))


class ManualEditStep(ReversibleStep):
    edit_diff: EditDiff
    hide: bool = True

    hide: bool = True

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return "Manual edit step"
        # TODO - only handling FileEdit here, but need all other types of FileSystemEdits
        # Also requires the merge_file_edit function
        # return llm.complete(dedent(f"""This code was replaced:

        #     {self.edit_diff.backward.replacement}

        #     With this code:

        #     {self.edit_diff.forward.replacement}

        #     Maximally concise summary of changes in bullet points (can use markdown):
        # """))

    @classmethod
    def from_sequence(cls, edits: List[FileEditWithFullContents]) -> "ManualEditStep":
        diffs = []
        for edit in edits:
            _, diff = FileSystem.apply_edit_to_str(
                edit.fileContents, edit.fileEdit)
            diffs.append(diff)
        return cls(edit_diff=EditDiff.from_sequence(diffs))

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        return None

    async def reverse(self, sdk: ContinueSDK):
        await sdk.ide.applyFileSystemEdit(self.edit_diff.backward)


class UserInputStep(Step):
    user_input: str
    name: str = "User Input"
    hide: bool = True

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return self.user_input

    async def run(self, sdk: ContinueSDK) -> Coroutine[UserInputObservation, None, None]:
        return UserInputObservation(user_input=self.user_input)


class WaitForUserInputStep(Step):
    prompt: str
    name: str = "Waiting for user input"

    _description: Union[str, None] = None
    _response: Union[str, None] = None

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        if self._response is None:
            return self.prompt
        else:
            return f"{self.prompt}\n\n`{self._response}`"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        self.description = self.prompt
        resp = await sdk.wait_for_user_input()
        self.description = f"{self.prompt}\n\n`{resp}`"
        return TextObservation(text=resp)


class WaitForUserConfirmationStep(Step):
    prompt: str
    name: str = "Waiting for user confirmation"

    async def describe(self, models: Models) -> Coroutine[str, None, None]:
        return self.prompt

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        self.description = self.prompt
        resp = await sdk.wait_for_user_input()
        return TextObservation(text=resp)
