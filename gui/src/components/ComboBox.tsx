import React, {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useState,
} from "react";
import { useCombobox } from "downshift";
import styled, { keyframes } from "styled-components";
import {
  buttonColor,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import PillButton from "./PillButton";
import HeaderButtonWithText from "./HeaderButtonWithText";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpLeftIcon,
  ArrowUpOnSquareIcon,
  BeakerIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  FolderIcon,
  GlobeAltIcon,
  HashtagIcon,
  MagnifyingGlassIcon,
  PaintBrushIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { postToIde } from "../vscode";
import { GUIClientContext } from "../App";
import { MeiliSearch } from "meilisearch";
import { setBottomMessage } from "../redux/slices/uiStateSlice";
import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import ContinueButton from "./ContinueButton";
import {
  getFontSize,
  getMarkdownLanguageTagForFile,
  getMetaKeyLabel,
  getPlatform,
  isMetaEquivalentKeyPressed,
} from "../util";
import StyledMarkdownPreview from "./StyledMarkdownPreview";
import { setTakenActionTrue } from "../redux/slices/miscSlice";
import {
  handleKeyDownJetBrains,
  handleKeyDownJetBrainsMac,
} from "../util/jetbrains";
import FileIcon from "./FileIcon";
import { ContextItem } from "../schema/ContextItem";
import {
  addContextItem,
  addContextItemAtIndex,
  deleteContextWithIds,
  newSession,
  setActive,
} from "../redux/slices/sessionStateReducer";
import RingLoader from "./RingLoader";
import CodeSnippetPreview from "./CodeSnippetPreview";

const SEARCH_INDEX_NAME = "continue_context_items";

const ICONS_FOR_DROPDOWN: { [key: string]: any } = {
  file: FolderIcon,
  terminal: CommandLineIcon,
  diff: PlusIcon,
  search: MagnifyingGlassIcon,
  url: GlobeAltIcon,
  "/edit": PaintBrushIcon,
  "/clear": TrashIcon,
  "/test": BeakerIcon,
  "/config": Cog6ToothIcon,
  "/comment": HashtagIcon,
  "/share": ArrowUpOnSquareIcon,
  "/cmd": CommandLineIcon,
  "/codebase": SparklesIcon,
};

function DropdownIcon(props: { provider: string; className?: string }) {
  const Icon = ICONS_FOR_DROPDOWN[props.provider];
  if (!Icon) {
    return null;
  }
  return <Icon className={props.className} height="1.2em" width="1.2em" />;
}

// #region styled components

const gradient = keyframes`
  0% {
    background-position: 0px 0;
  }
  100% {
    background-position: 100em 0;
  }
`;

const GradientBorder = styled.div<{
  borderRadius?: string;
  borderColor?: string;
  isFirst: boolean;
  isLast: boolean;
  loading: boolean;
}>`
  border-radius: ${(props) => props.borderRadius || "0"};
  padding: 1px;
  background: ${(props) =>
    props.borderColor
      ? props.borderColor
      : `repeating-linear-gradient(
    101.79deg,
    #1BBE84 0%,
    #331BBE 16%,
    #BE1B55 33%,
    #A6BE1B 55%,
    #BE1B55 67%,
    #331BBE 85%,
    #1BBE84 99%
  )`};
  animation: ${(props) => (props.loading ? gradient : "")} 6s linear infinite;
  background-size: 200% 200%;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 8px;
`;

const HiddenHeaderButtonWithText = styled.button<{ pinVisible: boolean }>`
  opacity: ${({ pinVisible }) => (pinVisible ? 1 : 0)};
  background-color: transparent;
  border: none;
  outline: none;
  color: ${vscForeground};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 0;
  aspect-ratio: 1;
  padding: 0;
  margin-left: -8px;

  border-radius: ${defaultBorderRadius};

  &:focus {
    margin-left: 1px;
    height: fit-content;
    padding: 3px;
    opacity: 1;
    outline: 1px solid ${lightGray};
  }
`;

const mainInputFontSize = getFontSize();

const MainTextInput = styled.textarea<{
  inQueryForDynamicProvider: boolean;
  fontSize?: number;
}>`
  resize: none;

  padding: 8px;
  font-size: ${(props) => props.fontSize || mainInputFontSize}px;
  font-family: inherit;
  border-radius: ${defaultBorderRadius};
  margin: 0;
  height: auto;
  width: 100%;
  background-color: ${secondaryDark};
  color: ${vscForeground};
  z-index: 1;
  border: 0.5px solid
    ${(props) =>
      props.inQueryForDynamicProvider ? buttonColor : "transparent"};

  &:focus {
    outline: 0.5px solid
      ${(props) => (props.inQueryForDynamicProvider ? buttonColor : lightGray)};
    border: 0.5px solid transparent;
    background-color: ${(props) =>
      props.inQueryForDynamicProvider ? `${buttonColor}22` : secondaryDark};
  }

  &::placeholder {
    color: ${lightGray}cc;
  }
`;

const DeleteButtonDiv = styled.div`
  position: absolute;
  top: 14px;
  right: 12px;
  background-color: ${secondaryDark};
  border-radius: ${defaultBorderRadius};
  z-index: 50;
`;

const DynamicQueryTitleDiv = styled.div`
  position: absolute;
  right: 0px;
  top: 0px;
  height: fit-content;
  padding: 2px 4px;
  border-radius: ${defaultBorderRadius};
  z-index: 2;
  color: white;
  font-size: 12px;

  background-color: ${buttonColor};
`;

const UlMaxHeight = 300;
const Ul = styled.ul<{
  hidden: boolean;
  showAbove: boolean;
  ulHeightPixels: number;
  inputBoxHeight?: string;
  fontSize?: number;
  isMainInput: boolean;
}>`
  ${(props) =>
    props.showAbove
      ? `transform: translateY(-${props.ulHeightPixels + 8}px);`
      : `transform: translateY(${
          (props.isMainInput ? 5 : 4) * (props.fontSize || mainInputFontSize) -
          (props.isMainInput ? 2 : 4) -
          6
        }px);`}
  position: absolute;
  /* background: ${vscBackground}; */
  background-color: transparent;
  backdrop-filter: blur(12px);

  color: ${vscForeground};
  max-height: ${UlMaxHeight}px;
  margin-left: 1px;
  width: calc(100% - 18px);
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 0;
  ${({ hidden }) => hidden && "display: none;"}
  border-radius: ${defaultBorderRadius};
  outline: 0.5px solid ${lightGray};
  -ms-overflow-style: none;
  font-size: ${(props) => props.fontSize || mainInputFontSize}px;

  scrollbar-width: none; /* Firefox */
  z-index: 500;

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Li = styled.li<{
  highlighted: boolean;
  selected: boolean;
  isLastItem: boolean;
}>`
  background-color: ${({ highlighted }) =>
    highlighted ? buttonColor + "66" : "transparent"};
  ${({ selected }) => selected && "font-weight: bold;"}
  padding: 0.5rem 0.5rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  ${({ isLastItem }) => isLastItem && "border-bottom: 1px solid gray;"}
  cursor: pointer;
  z-index: 500;
`;

// #endregion

interface ComboBoxItem {
  name: string;
  description: string;
  id?: string;
  content?: string;
}
interface ComboBoxProps {
  onInputValueChange?: (inputValue: string) => void;
  disabled?: boolean;
  onEnter?: (e?: React.KeyboardEvent<HTMLInputElement>, value?: string) => void;
  onToggleAddContext?: () => void;

  isMainInput: boolean;
  value?: string;
  active?: boolean;
  groupIndices?: number[];
  onToggle?: (arg0: boolean) => void;
  onToggleAll?: (arg0: boolean) => void;
  isToggleOpen?: boolean;
  index?: number;
  onDelete?: () => void;
}

const ComboBox = React.forwardRef((props: ComboBoxProps, ref) => {
  const meilisearchUrl = useSelector(
    (state: RootStore) =>
      state.serverState.meilisearchUrl || "http://127.0.0.1:7700"
  );

  const [searchClient, setSearchClient] = useState<MeiliSearch | undefined>(
    undefined
  );

  useEffect(() => {
    const client = new MeiliSearch({
      host: meilisearchUrl,
    });
    setSearchClient(client);
  }, [meilisearchUrl]);

  const client = useContext(GUIClientContext);
  const dispatch = useDispatch();
  const workspacePaths = (window as any).workspacePaths || [];
  const sessionState = useSelector((state: RootStore) => state.sessionState);

  const [history, setHistory] = React.useState<string[]>([]);
  // The position of the current command you are typing now, so the one that will be appended to history once you press enter
  const [positionInHistory, setPositionInHistory] = React.useState<number>(0);
  const [items, setItems] = React.useState<ComboBoxItem[]>([]);

  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height =
      Math.min(inputRef.current.scrollHeight, 300) + "px";
  }, [
    inputRef.current?.scrollHeight,
    inputRef.current?.clientHeight,
    inputRef.current?.value,
  ]);

  // Whether the current input follows an '@' and should be treated as context query
  const [currentlyInContextQuery, setCurrentlyInContextQuery] = useState(false);
  const [nestedContextProvider, setNestedContextProvider] = useState<
    any | undefined
  >(undefined);
  const [inQueryForContextProvider, setInQueryForContextProvider] = useState<
    any | undefined
  >(undefined);

  const availableSlashCommands = useSelector(
    (state: RootStore) =>
      state.serverState.slashCommands?.map((cmd) => {
        return {
          name: `/${cmd.name}`,
          description: cmd.description,
        };
      }) || []
  );
  const selectedContextItems = useSelector((state: RootStore) => {
    if (typeof props.index !== "undefined") {
      return state.sessionState.contextItemsAtIndex[props.index] || [];
    } else {
      return state.sessionState.context_items || [];
    }
  });

  const timeline = useSelector(
    (state: RootStore) => state.sessionState.history
  );
  const active = useSelector((state: RootStore) => state.sessionState.active);

  useEffect(() => {
    if (!currentlyInContextQuery) {
      setNestedContextProvider(undefined);
      setInQueryForContextProvider(undefined);
    }
  }, [currentlyInContextQuery]);

  const contextProviders = useSelector(
    (state: RootStore) => state.serverState.contextProviders
  ) as any[];

  const goBackToContextProviders = () => {
    setCurrentlyInContextQuery(false);
    setNestedContextProvider(undefined);
    setInQueryForContextProvider(undefined);
    downshiftProps.setInputValue("@");
  };

  useEffect(() => {
    if (!nestedContextProvider) {
      setItems(
        contextProviders
          ?.map((provider) => ({
            name: provider.display_title,
            description: provider.description,
            id: provider.title,
          }))
          .sort((c, _) => (c.id === "file" ? -1 : 1)) || []
      );
    }
  }, [nestedContextProvider]);

  const [prevInputValue, setPrevInputValue] = useState("");

  const selectContextItem = useCallback(
    async (id: string, query: string) => {
      const timeout = setTimeout(() => {
        setWaitingForContextItem(true);
      }, 0.1);
      const contextItem = await client?.getContextItem(id, query);
      clearTimeout(timeout);
      setWaitingForContextItem(false);
      if (!contextItem) return;
      if (props.isMainInput) {
        dispatch(addContextItem(contextItem));
      } else if (typeof props.index !== "undefined") {
        dispatch(
          addContextItemAtIndex({ item: contextItem, index: props.index })
        );
      }
    },
    [client, props.index]
  );

  const onInputValueChangeCallback = useCallback(
    ({ inputValue, highlightedIndex }: any) => {
      // Clear the input
      if (!inputValue) {
        setItems([]);
        setNestedContextProvider(undefined);
        setCurrentlyInContextQuery(false);
        return;
      }

      // Hacky way of stopping bug where first context provider title is injected into input
      if (
        prevInputValue === "" &&
        contextProviders?.some((p) => p.display_title === inputValue)
      ) {
        downshiftProps.setInputValue("");
        setPrevInputValue("");
        return;
      }
      setPrevInputValue(inputValue);

      if (
        inQueryForContextProvider &&
        !inputValue.startsWith(`@${inQueryForContextProvider.title}`)
      ) {
        setInQueryForContextProvider(undefined);
      }

      props.onInputValueChange?.(inputValue);

      // Handle context selection
      if (inputValue.endsWith("@") || currentlyInContextQuery) {
        const segs = inputValue?.split("@") || [];

        if (segs.length > 1) {
          // Get search results and return
          setCurrentlyInContextQuery(true);
          const providerAndQuery = segs[segs.length - 1] || "";

          if (nestedContextProvider && !inputValue.endsWith("@")) {
            // Search only within this specific context provider
            const spaceSegs = providerAndQuery.split(" ");
            getFilteredContextItemsForProvider(
              nestedContextProvider.title,
              spaceSegs.length > 1 ? spaceSegs[1] : ""
            ).then((res) => {
              setItems(res);
            });
          } else {
            // Search through the list of context providers
            const filteredItems =
              contextProviders
                ?.filter(
                  (provider) =>
                    `@${provider.title}`
                      .toLowerCase()
                      .startsWith(inputValue.toLowerCase()) ||
                    `@${provider.display_title}`
                      .toLowerCase()
                      .startsWith(inputValue.toLowerCase())
                )
                .map((provider) => ({
                  name: provider.display_title,
                  description: provider.description,
                  id: provider.title,
                }))
                .sort((c, _) => (c.id === "file" ? -1 : 1)) || [];
            setItems(filteredItems);
            setCurrentlyInContextQuery(true);
          }
          return;
        } else {
          // Exit the '@' context menu
          setCurrentlyInContextQuery(false);
          setNestedContextProvider(undefined);
        }
      }

      setNestedContextProvider(undefined);

      // Handle slash commands
      setItems(
        availableSlashCommands?.filter((slashCommand) => {
          const sc = slashCommand.name.toLowerCase();
          const iv = inputValue.toLowerCase();
          return sc.startsWith(iv) && sc !== iv;
        }) || []
      );

      if (inputValue.startsWith("/") || inputValue.startsWith("@")) {
        dispatch(setTakenActionTrue(null));
      }
    },
    [
      availableSlashCommands,
      currentlyInContextQuery,
      nestedContextProvider,
      inQueryForContextProvider,
    ]
  );

  const getFilteredContextItemsForProvider = async (
    provider: string,
    query: string
  ) => {
    // Only return context items from the current workspace - the index is currently shared between all sessions
    const workspaceFilter =
      workspacePaths && workspacePaths.length > 0
        ? `workspace_dir IN [ ${workspacePaths
            .map((path) => `"${path}"`)
            .join(", ")} ] AND provider_name = '${provider}'`
        : undefined;
    try {
      const res = await searchClient?.index(SEARCH_INDEX_NAME).search(query, {
        filter: workspaceFilter,
      });
      return (
        res?.hits.map((hit) => {
          return {
            name: hit.name,
            description: hit.description,
            id: hit.id,
            content: hit.content,
          };
        }) || []
      );
    } catch (e) {
      console.log("Error searching context items", e);
      return [];
    }
  };

  const { getInputProps, ...downshiftProps } = useCombobox({
    onInputValueChange: onInputValueChangeCallback,
    items,
    itemToString(item) {
      return item ? item.name : "";
    },
  });

  const [waitingForContextItem, setWaitingForContextItem] = useState(false);

  useEffect(() => {
    if (downshiftProps.highlightedIndex < 0) {
      downshiftProps.setHighlightedIndex(0);
    }
  }, [downshiftProps.inputValue]);

  const divRef = React.useRef<HTMLDivElement>(null);
  const ulRef = React.useRef<HTMLUListElement>(null);
  const showAbove = () => {
    return (
      (divRef.current?.getBoundingClientRect().top || Number.MAX_SAFE_INTEGER) >
      UlMaxHeight
    );
  };

  useImperativeHandle(ref, () => downshiftProps, [downshiftProps]);

  const contextItemsDivRef = React.useRef<HTMLDivElement>(null);
  const handleTabPressed = useCallback(() => {
    setShowContextItemsIfNotMain(true);
    // Set the focus to the next item in the context items div
    if (!contextItemsDivRef.current) {
      return;
    }
    const focusableItems = contextItemsDivRef.current.querySelectorAll(
      `.pill-button-${props.index || "main"}`
    );
    const focusableItemsArray = Array.from(focusableItems);
    const focusedItemIndex = focusableItemsArray.findIndex(
      (item) => item === document.activeElement
    );
    if (focusedItemIndex === focusableItemsArray.length - 1) {
      inputRef.current?.focus();
    } else if (focusedItemIndex !== -1) {
      const nextItem =
        focusableItemsArray[
          (focusedItemIndex + 1) % focusableItemsArray.length
        ];
      (nextItem as any)?.focus();
    } else {
      const firstItem = focusableItemsArray[0];
      (firstItem as any)?.focus();
    }
  }, [props.index]);

  useEffect(() => {
    if (inputRef.current) {
      const listener = (e: any) => {
        if (e.key === "Tab") {
          e.preventDefault();
          handleTabPressed();
        }
      };
      inputRef.current.addEventListener("keydown", listener);
      return () => {
        inputRef.current?.removeEventListener("keydown", listener);
      };
    }
  }, [inputRef.current]);

  useEffect(() => {
    if (props.value) {
      downshiftProps.setInputValue(props.value);
    }
  }, [props.value, downshiftProps.setInputValue]);

  const [isHovered, setIsHovered] = useState(false);

  useLayoutEffect(() => {
    if (!ulRef.current) {
      return;
    }
    downshiftProps.setHighlightedIndex(0);
  }, [items, downshiftProps.setHighlightedIndex, ulRef.current]);

  const [metaKeyPressed, setMetaKeyPressed] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        setMetaKeyPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta") {
        setMetaKeyPressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const persistSession = useCallback(() => {
    client?.persistSession(sessionState, workspacePaths[0] || "");
  }, [client, sessionState, workspacePaths]);

  useEffect(() => {
    if (!inputRef.current || !props.isMainInput) {
      return;
    }
    if (props.isMainInput) {
      inputRef.current.focus();
    }
    const handler = (event: any) => {
      if (event.data.type === "focusContinueInput") {
        inputRef.current!.focus();
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "focusContinueInputWithEdit") {
        inputRef.current!.focus();

        if (!inputRef.current?.value.startsWith("/edit")) {
          downshiftProps.setInputValue("/edit ");
        }
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "focusContinueInputWithNewSession") {
        client?.stopSession();
        persistSession();
        dispatch(newSession());
        dispatch(setTakenActionTrue(null));
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [inputRef.current, props.isMainInput, persistSession]);

  const deleteButtonDivRef = React.useRef<HTMLDivElement>(null);
  const stickyDropdownHeaderDiv = React.useRef<HTMLDivElement>(null);

  const selectContextItemFromDropdown = useCallback(
    (event: any) => {
      const newItem = items[downshiftProps.highlightedIndex];
      const newProviderName = newItem?.name;
      const newProvider = contextProviders.find(
        (provider) => provider.display_title === newProviderName
      );

      if (!newProvider) {
        if (nestedContextProvider && newItem.id) {
          // Tell server the context item was selected
          selectContextItem(newItem.id, "");

          // Clear the input
          downshiftProps.setInputValue("");
          setCurrentlyInContextQuery(false);
          setNestedContextProvider(undefined);
          setInQueryForContextProvider(undefined);
          (event.nativeEvent as any).preventDownshiftDefault = true;
          event.preventDefault();
          return;
        }
        // This is a slash command
        (event.nativeEvent as any).preventDownshiftDefault = true;
        event.preventDefault();
        return;
      } else if (newProvider.dynamic && newProvider.requires_query) {
        // This is a dynamic context provider that requires a query, like URL / Search
        setInQueryForContextProvider(newProvider);
        downshiftProps.setInputValue(`@${newProvider.title} `);
        (event.nativeEvent as any).preventDownshiftDefault = true;
        event.preventDefault();
        return;
      } else if (newProvider.dynamic) {
        // This is a normal dynamic context provider like Diff or Terminal
        if (!newItem.id) return;

        // Get the query from the input value
        const segs = downshiftProps.inputValue.split("@");
        const query = segs[segs.length - 1];

        // Tell server the context item was selected
        selectContextItem(newItem.id, query);
        if (downshiftProps.inputValue.includes("@")) {
          const selectedNestedContextProvider = contextProviders.find(
            (provider) => provider.title === newItem.id
          );
          if (
            !nestedContextProvider &&
            !selectedNestedContextProvider?.dynamic
          ) {
            downshiftProps.setInputValue(`@${newItem.id} `);
            setNestedContextProvider(selectedNestedContextProvider);
          } else {
            downshiftProps.setInputValue("");
          }
        }

        // Clear the input
        downshiftProps.setInputValue("");
        setCurrentlyInContextQuery(false);
        setNestedContextProvider(undefined);
        setInQueryForContextProvider(undefined);
        (event.nativeEvent as any).preventDownshiftDefault = true;
        event.preventDefault();
        return;
      }

      setNestedContextProvider(newProvider);
      downshiftProps.setInputValue(`@${newProvider.title} `);
      (event.nativeEvent as any).preventDownshiftDefault = true;
      event.preventDefault();
      getFilteredContextItemsForProvider(newProvider.title, "").then((items) =>
        setItems(items)
      );
    },
    [
      items,
      downshiftProps.highlightedIndex,
      contextProviders,
      nestedContextProvider,
      downshiftProps.inputValue,
      selectContextItem,
    ]
  );

  const [isComposing, setIsComposing] = useState(false);

  const [showContextToggleOn, setShowContextToggleOn] = useState(false);

  const [previewingContextItem, setPreviewingContextItem] = useState<
    ContextItem | undefined
  >(undefined);

  const [focusedContextItem, setFocusedContextItem] = useState<
    ContextItem | undefined
  >(undefined);

  const topRef = React.useRef<HTMLDivElement>(null);

  const [showContextItemsIfNotMain, setShowContextItemsIfNotMain] =
    useState(false);

  useEffect(() => {
    if (!inputFocused) {
      setShowContextItemsIfNotMain(false);
    }
  }, [inputFocused]);

  useEffect(() => {
    if (selectedContextItems.length > 0) {
      setShowContextItemsIfNotMain(true);
    }
  }, [selectedContextItems]);

  return (
    <div
      ref={topRef}
      style={{
        paddingTop: "4px",
        backgroundColor: vscBackground,
      }}
    >
      {selectedContextItems.length === 0 && props.isMainInput && (
        <div
          style={{
            color: lightGray,
            fontSize: "10px",
            backgroundColor: vscBackground,
            paddingLeft: "12px",
            paddingTop: getFontSize(),
            width: "calc(100% - 24px)",
          }}
        >
          <span
            onClick={() => {
              downshiftProps.setInputValue("@");
              inputRef.current?.focus();
            }}
            className="hover:underline cursor-pointer"
          >
            + Add Context
          </span>
          {downshiftProps.inputValue?.startsWith("/edit") && (
            <span className="float-right">Inserting at cursor</span>
          )}
        </div>
      )}

      {props.isMainInput ||
      (selectedContextItems.length > 0 && showContextItemsIfNotMain) ? (
        <div
          className="px-2 flex gap-2 items-center flex-wrap"
          ref={contextItemsDivRef}
          style={{ backgroundColor: vscBackground }}
        >
          {selectedContextItems.length > 0 && (
            <div
              className="cursor-pointer"
              onClick={(e) => {
                setShowContextToggleOn((prev) => !prev);
              }}
              id="toggle-context-div"
            >
              {showContextToggleOn ? (
                <ChevronDownIcon width="14px" height="14px" color={lightGray} />
              ) : (
                <ChevronRightIcon
                  width="14px"
                  height="14px"
                  color={lightGray}
                />
              )}
            </div>
          )}

          <HiddenHeaderButtonWithText
            pinVisible={selectedContextItems.length >= 8}
            className={
              selectedContextItems.length > 0
                ? `pill-button-${props.index || "main"}`
                : ""
            }
            onClick={() => {
              dispatch(
                deleteContextWithIds({
                  ids: selectedContextItems.map((item) => item.description.id),
                  index: props.index,
                })
              );
              inputRef.current?.focus();
              setPreviewingContextItem(undefined);
              setFocusedContextItem(undefined);
            }}
            onKeyDown={(e: any) => {
              if (e.key === "Backspace") {
                dispatch(
                  deleteContextWithIds({
                    ids: selectedContextItems.map(
                      (item) => item.description.id
                    ),
                    index: props.index,
                  })
                );
                inputRef.current?.focus();
                setPreviewingContextItem(undefined);
                setFocusedContextItem(undefined);
              }
            }}
          >
            <TrashIcon width="1.2em" height="1.2em" />
          </HiddenHeaderButtonWithText>
          {selectedContextItems.length < 8 ? (
            <>
              {selectedContextItems.map((item, idx) => {
                return (
                  <PillButton
                    inputIndex={props.index}
                    areMultipleItems={selectedContextItems.length > 1}
                    key={`${item.description.id.item_id}${idx}`}
                    item={item}
                    editing={
                      item.editing &&
                      (inputRef.current as any)?.value?.startsWith("/edit")
                    }
                    editingAny={(inputRef.current as any)?.value?.startsWith(
                      "/edit"
                    )}
                    stepIndex={props.index}
                    index={idx}
                    onDelete={() => {
                      dispatch(
                        deleteContextWithIds({
                          ids: [item.description.id],
                          index: props.index,
                        })
                      );
                      inputRef.current?.focus();
                      if (
                        (item.description.id.item_id ===
                          focusedContextItem?.description.id.item_id &&
                          focusedContextItem?.description.id.provider_name ===
                            item.description.id.provider_name) ||
                        (item.description.id.item_id ===
                          previewingContextItem?.description.id.item_id &&
                          previewingContextItem?.description.id
                            .provider_name ===
                            item.description.id.provider_name)
                      ) {
                        setPreviewingContextItem(undefined);
                        setFocusedContextItem(undefined);
                      }
                    }}
                    onClick={(e) => {
                      if (
                        item.description.id.item_id ===
                          focusedContextItem?.description.id.item_id &&
                        focusedContextItem?.description.id.provider_name ===
                          item.description.id.provider_name
                      ) {
                        setFocusedContextItem(undefined);
                      } else {
                        setFocusedContextItem(item);
                      }
                    }}
                    onBlur={() => {
                      setFocusedContextItem(undefined);
                    }}
                    toggleViewContent={() => {
                      setPreviewingContextItem((prev) => {
                        if (!prev) return item;
                        if (
                          prev.description.id.item_id ===
                            item.description.id.item_id &&
                          prev.description.id.provider_name ===
                            item.description.id.provider_name
                        ) {
                          return undefined;
                        } else {
                          return item;
                        }
                      });
                    }}
                    previewing={
                      item.description.id.item_id ===
                        previewingContextItem?.description.id.item_id &&
                      previewingContextItem?.description.id.provider_name ===
                        item.description.id.provider_name
                    }
                    focusing={
                      item.description.id.item_id ===
                        focusedContextItem?.description.id.item_id &&
                      focusedContextItem?.description.id.provider_name ===
                        item.description.id.provider_name
                    }
                    prefixInputWithEdit={(should) => {
                      if (
                        !should &&
                        inputRef.current?.value.startsWith("/edit")
                      ) {
                        downshiftProps.setInputValue(
                          inputRef.current?.value.replace("/edit ", "")
                        );
                      }
                      if (downshiftProps.inputValue.startsWith("/edit")) return;
                      downshiftProps.setInputValue(
                        `/edit ${downshiftProps.inputValue}`
                      );
                      inputRef.current?.focus();
                    }}
                  />
                );
              })}
              {waitingForContextItem && (
                <RingLoader
                  period={1.5}
                  className="ml-0 mt-1 mb-0"
                  width="1.0em"
                  height="1.0em"
                  size={32}
                  wFull={false}
                ></RingLoader>
              )}
            </>
          ) : (
            <div
              onClick={() => {
                if (props.isMainInput) {
                  setShowContextToggleOn((prev) => !prev);
                } else {
                  inputRef.current?.focus();
                  setShowContextItemsIfNotMain(true);
                }
              }}
              style={{
                color: lightGray,
                backgroundColor: vscBackground,
                fontSize: "12px",
                alignItems: "center",
                display: "flex",
                height: "100%",
                cursor: "pointer",
              }}
            >
              {selectedContextItems.length} snippets selected
            </div>
          )}
          {/* {selectedContextItems.length > 0 && (
          <HeaderButtonWithText
            onClick={() => {
              client?.showContextVirtualFile(props.index);
            }}
            text="View Current Context"
          >
            <MagnifyingGlassIcon width="1.4em" height="1.4em" />
          </HeaderButtonWithText>
        )} */}
        </div>
      ) : (
        selectedContextItems.length > 0 && (
          <div
            onClick={() => {
              inputRef.current?.focus();
              setShowContextItemsIfNotMain(true);
            }}
            style={{
              color: lightGray,
              fontSize: "10px",
              backgroundColor: vscBackground,
              paddingLeft: "12px",
              cursor: "default",
              paddingTop: getFontSize(),
              width: "fit-content",
            }}
          >
            {props.active ? "Using" : "Used"} {selectedContextItems.length}{" "}
            context item
            {selectedContextItems.length === 1 ? "" : "s"}
          </div>
        )
      )}
      {previewingContextItem && (
        <pre className="m-0">
          <StyledMarkdownPreview
            source={`\`\`\`${getMarkdownLanguageTagForFile(
              previewingContextItem.description.description
            )}\n${previewingContextItem.content}\n\`\`\``}
            maxHeight={200}
          />
        </pre>
      )}
      {showContextToggleOn && (
        <div>
          <HeaderButtonWithText
            className="mr-4 ml-auto -mt-2"
            text="Delete All"
            onClick={() => {
              dispatch(
                deleteContextWithIds({
                  ids: selectedContextItems.map((item) => item.description.id),
                  index: props.index,
                })
              );
              inputRef.current?.focus();
              setPreviewingContextItem(undefined);
              setFocusedContextItem(undefined);
            }}
          >
            <div className="flex items-center">
              <TrashIcon width="1.2em" height="1.2em" />
              Delete All
            </div>
          </HeaderButtonWithText>
          {selectedContextItems.map((item) => (
            <CodeSnippetPreview
              index={props.index}
              item={item}
            ></CodeSnippetPreview>
          ))}
        </div>
      )}
      <div
        className="flex px-2 relative"
        style={{
          backgroundColor: vscBackground,
        }}
        ref={divRef}
      >
        <GradientBorder
          loading={props.active || false}
          isFirst={false}
          isLast={false}
          borderColor={props.active ? undefined : vscBackground}
          borderRadius={defaultBorderRadius}
        >
          <MainTextInput
            onClick={() => {
              inputRef.current?.focus();
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={(e) => {
              if (
                e.relatedTarget === deleteButtonDivRef.current ||
                (e.relatedTarget instanceof Node &&
                  deleteButtonDivRef.current?.contains(e.relatedTarget as Node))
              ) {
                return;
              }
              setIsHovered(false);
            }}
            rows={props.isMainInput ? undefined : 1}
            inQueryForDynamicProvider={
              typeof inQueryForContextProvider !== "undefined"
            }
            fontSize={getFontSize()}
            disabled={props.disabled}
            placeholder={`Ask a question, '/' for slash commands, '@' to add context`}
            {...getInputProps({
              onCompositionStart: () => setIsComposing(true),
              onCompositionEnd: () => setIsComposing(false),
              onChange: (e) => {},
              onFocus: (e) => {
                setInputFocused(true);
                dispatch(setBottomMessage(undefined));
              },
              onBlur: (e) => {
                if (
                  topRef.current?.contains(e.relatedTarget as Node) ||
                  document
                    .getElementById("toggle-context-div")
                    ?.contains(e.relatedTarget as Node)
                ) {
                  return;
                }
                setInputFocused(false);
              },
              onKeyDown: (event) => {
                // Prevent duplicate calls to keyDown events due to IME.
                if (isComposing) {
                  return;
                }
                dispatch(setBottomMessage(undefined));
                if (event.key === "Enter" && event.shiftKey) {
                  // Prevent Downshift's default 'Enter' behavior.
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                  setCurrentlyInContextQuery(false);
                } else if (
                  event.key === "Enter" &&
                  (!downshiftProps.isOpen || items.length === 0) &&
                  !isComposing
                ) {
                  const value = downshiftProps.inputValue;
                  if (inQueryForContextProvider) {
                    const segs = value.split("@");
                    selectContextItem(
                      inQueryForContextProvider.title,
                      segs[segs.length - 1]
                    );
                    setCurrentlyInContextQuery(false);
                    downshiftProps.setInputValue("");
                    return;
                  } else {
                    if (value !== "") {
                      setPositionInHistory(history.length + 1);
                      setHistory([...history, value]);
                    }
                    // Prevent Downshift's default 'Enter' behavior.
                    (event.nativeEvent as any).preventDownshiftDefault = true;

                    if (props.onEnter) {
                      props.onEnter(event, value);
                    }
                  }
                  setCurrentlyInContextQuery(false);
                } else if (event.key === "Enter" && currentlyInContextQuery) {
                  // Handle "Enter" for Context Providers
                  selectContextItemFromDropdown(event);
                } else if (
                  event.key === "Tab" &&
                  downshiftProps.isOpen &&
                  items.length > 0 &&
                  items[downshiftProps.highlightedIndex]?.name.startsWith("/")
                ) {
                  downshiftProps.setInputValue(items[0].name);
                  event.preventDefault();
                } else if (event.key === "Tab") {
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                } else if (
                  (event.key === "ArrowUp" || event.key === "ArrowDown") &&
                  items.length > 0
                ) {
                  return;
                } else if (event.key === "ArrowUp") {
                  // Only go back in history if selectionStart is 0
                  // (i.e. the cursor is at the beginning of the input)
                  if (
                    positionInHistory == 0 ||
                    event.currentTarget.selectionStart !== 0
                  ) {
                    (event.nativeEvent as any).preventDownshiftDefault = true;
                    return;
                  } else if (
                    positionInHistory == history.length &&
                    (history.length === 0 ||
                      history[history.length - 1] !== event.currentTarget.value)
                  ) {
                    setHistory([...history, event.currentTarget.value]);
                  }
                  downshiftProps.setInputValue(history[positionInHistory - 1]);
                  setPositionInHistory((prev) => prev - 1);
                  setCurrentlyInContextQuery(false);
                } else if (event.key === "ArrowDown") {
                  if (
                    positionInHistory === history.length ||
                    event.currentTarget.selectionStart !==
                      event.currentTarget.value.length
                  ) {
                    (event.nativeEvent as any).preventDownshiftDefault = true;
                    return;
                  }

                  if (positionInHistory < history.length) {
                    downshiftProps.setInputValue(
                      history[positionInHistory + 1]
                    );
                  }
                  setPositionInHistory((prev) =>
                    Math.min(prev + 1, history.length)
                  );
                  setCurrentlyInContextQuery(false);
                } else if (event.key === "Escape") {
                  if (nestedContextProvider) {
                    goBackToContextProviders();
                    (event.nativeEvent as any).preventDownshiftDefault = true;
                    return;
                  } else if (inQueryForContextProvider) {
                    goBackToContextProviders();
                    (event.nativeEvent as any).preventDownshiftDefault = true;
                    return;
                  }

                  setCurrentlyInContextQuery(false);
                  if (downshiftProps.isOpen && items.length > 0) {
                    downshiftProps.closeMenu();
                    (event.nativeEvent as any).preventDownshiftDefault = true;
                  } else {
                    (event.nativeEvent as any).preventDownshiftDefault = true;
                    // Remove focus from the input
                    inputRef.current?.blur();
                    // Move cursor back over to the editor
                    postToIde("focusEditor", {});
                  }
                }
                // Home and end keys
                else if (event.key === "Home") {
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                } else if (event.key === "End") {
                  (event.nativeEvent as any).preventDownshiftDefault = true;
                } else if (localStorage.getItem("ide") === "jetbrains") {
                  if (getPlatform() === "mac") {
                    handleKeyDownJetBrainsMac(
                      event,
                      downshiftProps.inputValue,
                      downshiftProps.setInputValue
                    );
                  } else {
                    handleKeyDownJetBrains(
                      event,
                      downshiftProps.inputValue,
                      downshiftProps.setInputValue
                    );
                  }
                }
              },
              onClick: () => {
                dispatch(setBottomMessage(undefined));
              },
              ref: inputRef,
            })}
          />
          {props.isMainInput || (
            <DeleteButtonDiv ref={deleteButtonDivRef}>
              {isHovered && (
                <div className="flex">
                  <>
                    {timeline
                      .filter(
                        (h, i: number) =>
                          props.groupIndices?.includes(i) && h.logs
                      )
                      .some((h) => h.logs!.length > 0) && (
                      <HeaderButtonWithText
                        onClick={(e) => {
                          e.stopPropagation();
                          if (props.groupIndices) {
                            const content =
                              "This is the exact prompt sent to the LLM: \n\n" +
                              timeline
                                .filter((_, i) => {
                                  return props.groupIndices?.includes(i);
                                })
                                .flatMap((s) => s.logs || [])
                                .join("\n");
                            postToIde("showVirtualFile", {
                              name: "inspect_prompt.md",
                              content,
                            });
                          }
                        }}
                        text="Inspect Prompt"
                      >
                        <ArrowUpLeftIcon width="1.3em" height="1.3em" />
                      </HeaderButtonWithText>
                    )}
                    <HeaderButtonWithText
                      onClick={(e) => {
                        e.stopPropagation();
                        if (props.active && props.groupIndices) {
                          client?.stopSession();
                        } else {
                          props.onDelete?.();
                        }
                      }}
                      text={
                        props.active ? `Stop (${getMetaKeyLabel()}⌫)` : "Delete"
                      }
                    >
                      {props.active ? null : (
                        // <StopCircleIcon width="1.4em" height="1.4em" />
                        <XMarkIcon width="1.4em" height="1.4em" />
                      )}
                    </HeaderButtonWithText>
                  </>
                </div>
              )}
            </DeleteButtonDiv>
          )}
        </GradientBorder>
        {inQueryForContextProvider && (
          <DynamicQueryTitleDiv>
            Enter {inQueryForContextProvider.display_title} Query
          </DynamicQueryTitleDiv>
        )}

        <Ul
          {...downshiftProps.getMenuProps({
            ref: ulRef,
          })}
          isMainInput={props.isMainInput}
          showAbove={showAbove()}
          ulHeightPixels={ulRef.current?.getBoundingClientRect().height || 0}
          hidden={
            !downshiftProps.isOpen ||
            items.length === 0 ||
            inputRef.current?.value === ""
          }
          fontSize={getFontSize()}
        >
          {nestedContextProvider && (
            <div
              ref={stickyDropdownHeaderDiv}
              style={{
                backgroundColor: secondaryDark,
                borderBottom: `0.5px solid ${lightGray}`,
                display: "flex",
                gap: "4px",
                position: "sticky",
                top: "0px",
              }}
              className="py-2 px-4 my-0"
            >
              <ArrowLeftIcon
                width="1.4em"
                height="1.4em"
                className="cursor-pointer"
                onClick={(e) => {
                  goBackToContextProviders();
                  inputRef.current?.focus();
                }}
              />
              {nestedContextProvider.display_title} -{" "}
              {nestedContextProvider.description}
            </div>
          )}
          <div
            style={{
              maxHeight: `${
                UlMaxHeight -
                (stickyDropdownHeaderDiv.current?.clientHeight || 50)
              }px`,
              overflow: "auto",
            }}
          >
            {downshiftProps.isOpen &&
              items.map((item, index) => (
                <Li
                  style={{
                    borderTop:
                      index === 0 ? "none" : `0.5px solid ${lightGray}`,
                  }}
                  key={`${item.name}${index}`}
                  {...downshiftProps.getItemProps({ item, index })}
                  highlighted={downshiftProps.highlightedIndex === index}
                  selected={downshiftProps.selectedItem === item}
                  onClick={(e) => {
                    selectContextItemFromDropdown(e);
                    e.stopPropagation();
                    e.preventDefault();
                    inputRef.current?.focus();
                  }}
                >
                  <span className="flex justify-between w-full items-center">
                    <div className="flex items-center justify-center">
                      {nestedContextProvider && (
                        <FileIcon
                          height="20px"
                          width="20px"
                          filename={item.name}
                        ></FileIcon>
                      )}
                      <DropdownIcon provider={item.name} className="mr-2" />
                      <DropdownIcon provider={item.id} className="mr-2" />
                      {item.name}
                      {"  "}
                    </div>
                    <span
                      style={{
                        color: vscForeground,
                        float: "right",
                        textAlign: "right",
                      }}
                      hidden={downshiftProps.highlightedIndex !== index}
                    >
                      {item.description}
                    </span>
                  </span>
                  {contextProviders
                    ?.filter(
                      (provider) => !provider.dynamic || provider.requires_query
                    )
                    .find((provider) => provider.title === item.id) && (
                    <ArrowRightIcon
                      width="1.2em"
                      height="1.2em"
                      color={vscForeground}
                      className="ml-2 flex-shrink-0"
                    />
                  )}
                </Li>
              ))}
            {downshiftProps.isOpen && items.length === 0 && (
              <Li
                key="empty-items-li"
                highlighted={false}
                selected={false}
                isLastItem={false}
              >
                <span
                  style={{
                    color: lightGray,
                    float: "right",
                    textAlign: "right",
                    display: "flex",
                    width: "100%",
                    cursor: "default",
                  }}
                >
                  No items found
                </span>
              </Li>
            )}
          </div>
        </Ul>
      </div>

      {props.isMainInput && (
        <>
          <div
            style={{
              color: lightGray,
              fontSize: "10px",
              backgroundColor: vscBackground,
              width: "calc(100% - 16px)",
              height: "0",
              marginTop: "4px",
            }}
          >
            <span
              onClick={() => {
                const inputValue = downshiftProps.inputValue;
                if (inputValue?.startsWith("/codebase")) {
                  downshiftProps.setInputValue(
                    inputValue.replace("/codebase ", "")
                  );
                } else {
                  downshiftProps.setInputValue("/codebase " + inputValue);
                }
                inputRef.current?.focus();
              }}
              className={"hover:underline cursor-pointer float-right"}
            >
              {downshiftProps.inputValue?.startsWith("/codebase")
                ? "Using codebase"
                : "⌘ ⏎ Use codebase"}
            </span>
          </div>
          <br />
        </>
      )}

      {props.isMainInput && (
        <ContinueButton
          disabled={
            !active &&
            (!(inputRef.current as any)?.value || typeof client === "undefined")
          }
          onClick={() => {
            if (active) {
              client?.stopSession();
              dispatch(setActive(false));
            } else {
              props.onEnter?.(undefined);
            }
          }}
          showStop={active}
        />
      )}
    </div>
  );
});

export default ComboBox;
