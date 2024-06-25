import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { StyledButton } from "./components";
import { CopyToTerminalButton } from "./CopyToTerminalButton";
import { CheckMarkHeader } from "./CheckMarkHeader";
import { ONBOARDING_LOCAL_MODEL_TITLE } from "core/config/onboarding";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

type OllamaConnectionStatuses =
  | "waiting_to_download"
  | "downloading"
  | "verified";

enum DefaultLocaLModels {
  Chat = "llama3",
  Autocomplete = "starcoder2:3b",
  Embeddings = "nomic-embed-text",
}

const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";
const REFETCH_MODELS_INTERVAL_MS = 1000;

function LocalOnboarding() {
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const [downloadedOllamaModels, setDownloadedOllamaModels] = useState<
    string[] | undefined
  >(undefined);

  const [ollamaConnectionStatus, setOllamaConnectionStatus] =
    useState<OllamaConnectionStatuses>("waiting_to_download");

  const [hasLoadedChatModel, setHasLoadedChatModel] = useState(false);

  const isOllamaConnected = ollamaConnectionStatus === "verified";

  function handleCompleteClick() {
    navigate("/");
  }

  function isModelDownloaded(model: string) {
    return false;
    // if (!downloadedOllamaModels) {
    //   return false;
    // }

    // return downloadedOllamaModels.some(
    //   (ollamaModel) => ollamaModel.startsWith(model), // We use `startsWith` to ignore trailing tags like `:latest`
    // );
  }

  function renderOllamaConnectionStatus(status: OllamaConnectionStatuses) {
    switch (status) {
      case "waiting_to_download":
        return (
          <div className="pb-6">
            <a
              href={OLLAMA_DOWNLOAD_URL}
              target="_blank"
              onClick={() => setOllamaConnectionStatus("downloading")}
            >
              Click here to download Ollama from their site.
            </a>

            <p className="leading-relaxed">
              Once downloaded, start the application. This page will refresh
              once you've started Ollama.
            </p>
          </div>
        );

      case "downloading":
        return <p className="pb-6">Checking for connection to Ollama...</p>;

      case "verified":
        return <></>;

      default:
        return <></>;
    }
  }

  /**
   * The first time we detect that a chat model has been loaded,
   * we send an empty request to load it
   */
  useEffect(() => {
    if (!hasLoadedChatModel && isModelDownloaded(DefaultLocaLModels.Chat)) {
      ideMessenger.post("llm/complete", {
        completionOptions: {},
        prompt: "",
        title: ONBOARDING_LOCAL_MODEL_TITLE,
      });

      setHasLoadedChatModel(true);
    }
  }, [downloadedOllamaModels]);

  /**
   * Sets up an interval that runs every `REFETCH_MODELS_INTERVAL_MS`
   * to fetch the list of downloaded models and update state.
   */
  useEffect(() => {
    const fetchDownloadedModels = async () => {
      const models = await ideMessenger.request("llm/listModels", {
        title: ONBOARDING_LOCAL_MODEL_TITLE,
      });

      if (Array.isArray(models)) {
        // If we got a response, the connection has been verified
        if (!isOllamaConnected) {
          setOllamaConnectionStatus("verified");
        }

        setDownloadedOllamaModels(models);
      }
    };

    // Immediately invoke to try to minimize jank if a user already has
    // the models installed. A better fix would be to not load the onboarding
    // steps until we've first checked if the user already has the models installed.
    fetchDownloadedModels();

    const interval = setInterval(
      fetchDownloadedModels,
      REFETCH_MODELS_INTERVAL_MS,
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-8 overflow-y-scroll">
      <div>
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate("/onboarding")}
          className="inline-block cursor-pointer"
        />
      </div>

      <h1 className="text-center">Set up your local LLM</h1>

      <div>
        <CheckMarkHeader isComplete={isOllamaConnected}>
          1. Download and start Ollama
        </CheckMarkHeader>

        {renderOllamaConnectionStatus(ollamaConnectionStatus)}
      </div>

      <div>
        <CheckMarkHeader
          isComplete={isModelDownloaded(DefaultLocaLModels.Chat)}
        >
          2. Download a model for chat
        </CheckMarkHeader>
        {!isModelDownloaded(DefaultLocaLModels.Chat) && (
          <div className="pb-6">
            <p className="leading-relaxed">
              We recommend using <code>{DefaultLocaLModels.Chat}</code>, the
              latest open-source model trained by Meta.
            </p>

            <CopyToTerminalButton
              command={`ollama run ${DefaultLocaLModels.Chat}`}
            ></CopyToTerminalButton>
          </div>
        )}
      </div>

      <div>
        <CheckMarkHeader
          isComplete={isModelDownloaded(DefaultLocaLModels.Autocomplete)}
        >
          3. Download a model for tab autocomplete
        </CheckMarkHeader>

        {!isModelDownloaded(DefaultLocaLModels.Autocomplete) && (
          <div className="pb-6">
            <p className="leading-relaxed">
              We recommend using <code>{DefaultLocaLModels.Autocomplete}</code>,
              a state-of-the-art 3B parameter autocomplete model trained by
              Hugging Face.
            </p>

            <CopyToTerminalButton
              command={`ollama run ${DefaultLocaLModels.Autocomplete}`}
            ></CopyToTerminalButton>
          </div>
        )}
      </div>

      <div>
        <CheckMarkHeader
          isComplete={isModelDownloaded(DefaultLocaLModels.Embeddings)}
        >
          4. Download a model for embeddings
        </CheckMarkHeader>

        {!isModelDownloaded(DefaultLocaLModels.Embeddings) && (
          <div className="pb-6">
            <p className="leading-relaxed">
              We recommend using <code>{DefaultLocaLModels.Embeddings}</code>, a
              8192 context-length that outperforms OpenAI <code>ada-002</code>{" "}
              and <code>text-embedding-3-small</code>
              on both short and long context tasks.
            </p>

            <CopyToTerminalButton
              command={`ollama run ${DefaultLocaLModels.Embeddings}`}
            ></CopyToTerminalButton>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-end mt-4">
        <StyledButton onClick={handleCompleteClick}>
          Complete onboarding
        </StyledButton>
      </div>
    </div>
  );
}

export default LocalOnboarding;
