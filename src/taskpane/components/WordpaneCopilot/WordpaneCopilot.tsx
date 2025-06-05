import React, { useEffect, useMemo, useRef, useState } from "react";
import withAuth from "../../routes/withAuth";
import { useAuthUser } from "react-auth-kit";
import "./WordpaneCopilot.css";
import "draft-js/dist/Draft.css";
import useSelectedText from "../../hooks/useSelectedText";
import {
  IMessage,
  IPromptType,
  IShortcutType,
  IButtonStatus,
  IChatTypes,
  IMessageRequest,
  ITenderBid,
} from "../../../types";
import { Box, Button, Grid, MenuItem, MenuList, Paper, Tab, Tabs } from "@mui/material";
import MessageBox from "../MessageBox";
import { customPrompts } from "./constants";
import {
  askCopilot,
  askDiagram,
  askInternetQuestion,
  askLibraryChatQuestion,
  getDefaultMessage,
  formatHTML,
  refineResponse,
  setCacheVersion,
  withId,
  markdownToHTML,
} from "./helper";
import Welcome from "./Welcome";
import useShowWelcome from "../../hooks/useShowWelcome";
import posthog from "posthog-js";
import SignoutFab from "./components/SignoutFab/SignoutFab";
import TenderSearchMessageBox from "../MessageBox/TenderSearchMessageBox";

const WordpaneCopilot = () => {
  const getAuth = useAuthUser();
  const auth = getAuth();
  const tokenRef = useRef(auth?.token || "default");

  const [isCustomPromptMenuVisible, setCustomPromptMenuVisible] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [libraryChatMessages, setLibraryChatMessages] = useState<IMessage[]>(getDefaultMessage("library-chat", true));
  const [internetResearchMessages, setInternetResearchMessages] = useState<IMessage[]>(
    getDefaultMessage("internet-search", true)
  );
  const [tenderSearchMessages, setTenderSearchMessages] = useState<IMessage[]>(
    getDefaultMessage("tender-search", true)
  );

  const [showOptions, setShowOptions] = useState(false);

  const [inputValue, setInputValue] = useState("");

  const optionsContainerRef = useRef(null); // Ref for the options container
  const responseMessageBoxRef = useRef(null); // Ref for the response message box
  const textInputRef = useRef(null);

  const responseBoxRef = useRef(null); // Ref for the response box

  const [selectedTab, setSelectedTab] = useState<IChatTypes>("library-chat");
  const [selectedTenderBid, setSelectedTenderBid] = useState<ITenderBid>();

  const { showWelcome, setShowWelcome } = useShowWelcome();

  const isLibraryChatTab = useMemo(() => selectedTab === "library-chat", [selectedTab]);
  const isInternetSearchTab = useMemo(() => selectedTab === "internet-search", [selectedTab]);
  const isTenderSearchTab = useMemo(() => selectedTab === "tender-search", [selectedTab]);

  const isLiveChatLoading = useMemo(
    () => isLibraryChatTab && libraryChatMessages.find((item) => item.type === "loading") !== undefined,
    [isLibraryChatTab, libraryChatMessages]
  );

  const isInternetSearchLoading = useMemo(
    () => isInternetSearchTab && internetResearchMessages.find((item) => item.type === "loading") !== undefined,
    [isInternetSearchTab, internetResearchMessages]
  );

  const isTenderSearchLoading = useMemo(
    () => isTenderSearchTab && tenderSearchMessages.find((item) => item.type === "loading") !== undefined,
    [isTenderSearchTab, tenderSearchMessages]
  );

  const isLoading = useMemo(
    () => isLiveChatLoading || isInternetSearchLoading || isTenderSearchLoading,
    [isLiveChatLoading, isInternetSearchLoading, isTenderSearchLoading]
  );

  const [isCustomPrompt, setIsCustomPrompt] = useState(false);

  const [currentRefine, setCurrentRefine] = useState<{ tab: IChatTypes; message: IMessage }>(undefined);
  const isRefine = useMemo(() => currentRefine !== undefined, [currentRefine]);

  useEffect(() => {
    if (responseMessageBoxRef?.current) {
      const scrollBox = responseMessageBoxRef.current.querySelector(".mini-messages");
      if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
    }
    if (textInputRef?.current && isLoading === false) {
      textInputRef.current.focus();
    }
  }, [isLoading]);

  const toggleCustomPromptMenuVisible: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    setTimeout(() => {
      setCustomPromptMenuVisible(!isCustomPromptMenuVisible);
    }, 10);
  };

  useSelectedText({ onChange: setSelectedText });

  const handleClearMessages = () => {
    setInputValue("");
    switch (selectedTab) {
      case "library-chat":
        setLibraryChatMessages(getDefaultMessage("library-chat"));
        break;
      case "internet-search":
        setInternetResearchMessages(getDefaultMessage("internet-search"));
        break;
      case "tender-search":
        setTenderSearchMessages(getDefaultMessage("tender-search"));
        break;
      default:
        break;
    }

    setCustomPromptMenuVisible(false);

    setShowOptions(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      setCustomPromptMenuVisible(false);
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showOptions, isCustomPromptMenuVisible]);

  //only hide options if show Options equals true and the user clicks somewhere else in the response box. So clicking on an option and the selected text changing should not trigger this
  useEffect(() => {
    const handleClickOutsideOptions = (event) => {
      if (
        responseBoxRef.current &&
        optionsContainerRef.current &&
        responseBoxRef.current.contains(event.target) &&
        !optionsContainerRef.current.contains(event.target) &&
        showOptions
      ) {
        setShowOptions(false);
        // Clear the orange style and reset the text
      }
    };

    document.addEventListener("click", handleClickOutsideOptions);
    return () => {
      document.removeEventListener("click", handleClickOutsideOptions);
    };
  }, [showOptions]);

  const handleClickMessageShortcut = (action: IShortcutType, message: IMessage) => {
    posthog.capture("word_addin_message_shortcut_clicked", {
      action,
      messageType: message.type,
      client_type: "word_add_in",
    });

    if (action === "refine") {
      setCurrentRefine({ tab: selectedTab, message });
    } else if (action === "insert") {
      insertToWord(message, "End");
    } else if (action === "replace") {
      insertToWord(message, "Replace");
    } else if (action === "copy") {
      const copyToClipboard = (textToCopy: string) => {
        const input = document.createElement("input");
        input.type = "text";
        input.value = textToCopy;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      };
      copyToClipboard(message.value);
    }

    setCustomPromptMenuVisible(false);
    setSelectedText("");
  };

  useEffect(() => {
    if (selectedText.trim() && selectedText.trim().length > 0) {
      setCustomPromptMenuVisible(true);
    } else {
      setCustomPromptMenuVisible(false);
      setIsCustomPrompt(false);
    }
  }, [selectedText]);

  useEffect(() => {
    if (selectedTab !== "library-chat" && isCustomPrompt) {
      setIsCustomPrompt(false);
    }
  }, [selectedTab]);

  useEffect(() => {
    if (currentRefine) {
      setIsCustomPrompt(false);
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }
  }, [currentRefine]);

  useEffect(() => {
    if (isCustomPrompt) {
      setCurrentRefine(undefined);
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }
  }, [isCustomPrompt]);

  const askCustomPrompt = async (request: IMessageRequest): Promise<IMessage> => {
    try {
      if (request.action === "Graph") {
        return await askDiagram(tokenRef.current, request);
      } else if (request.action === "Custom Prompt") {
        const response = await askCopilot(tokenRef.current, request);
        setIsCustomPrompt(false);
        return response;
      } else {
        return await askCopilot(tokenRef.current, request);
      }
    } catch (error) {
      console.error("Error sending question:", error);
      // Replace the temporary loading message with the error message
      return withId({
        createdBy: "bot",
        type: "text",
        value: error.response?.status === 400 ? "Message failed, please contact support..." : error.message,
        action: "default",
        isRefine: request.isRefine,
        request,
      });
    }
  };

  const insertToWord = (
    { type, value }: IMessage,
    insertLocation:
      | Word.InsertLocation.replace
      | Word.InsertLocation.start
      | Word.InsertLocation.end
      | "Replace"
      | "Start"
      | "End"
  ) => {
    posthog.capture("word_addin_insert_started", {
      contentType: type,
      insertLocation,
      client_type: "word_add_in",
    });

    Word.run(async (context) => {
      try {
        const selection = context.document.getSelection();
        selection.paragraphs.load("items");
        return context
          .sync()
          .then(async function () {
            if (type === "image") {
              const newSelection = selection.insertParagraph("", "After");
              newSelection.insertInlinePictureFromBase64(value.split(",")[1], insertLocation);
            } else if (type === "text") {
              selection.insertHtml(formatHTML(value), insertLocation);
            }
            await context.sync();

            posthog.capture("word_addin_insert_succeeded", {
              contentType: type,
              insertLocation,
              client_type: "word_add_in",
            });
          })
          .catch((error) => {
            console.error("Error: ", error);
            posthog.capture("word_addin_insert_failed", {
              contentType: type,
              insertLocation,
              error: error.message,
              client_type: "word_add_in",
            });
          });
      } catch (error) {
        posthog.capture("word_addin_insert_error", {
          contentType: type,
          insertLocation,
          error: error.message,
          client_type: "word_add_in",
        });
      }
    });
  };

  const handleClickMenuItem = (item: { id: IPromptType; title: string }) => () => {
    posthog.capture("word_addin_menu_item_clicked", {
      itemId: item.id,
      itemTitle: item.title,
      client_type: "word_add_in",
    });

    if (item.id === "Custom Prompt") {
      setIsCustomPrompt(true);
      setSelectedTab("library-chat");
    } else {
      handleCustomPromptMessage({
        highlightedText: selectedText,
        instructionText: inputValue,
        action: item.id,
        messages: libraryChatMessages,
        isRefine: false,
        isCustomPrompt: false,
        type: "text",
      });
    }
  };

  useEffect(() => {
    localStorage.setItem(
      "internet-search",
      JSON.stringify(
        internetResearchMessages.map((message) => ({ ...message, request: { ...message.request, messages: [] } }))
      )
    );
    setCacheVersion();
  }, [internetResearchMessages]);

  useEffect(() => {
    localStorage.setItem(
      "library-chat",
      JSON.stringify(
        libraryChatMessages.map((message) => ({ ...message, request: { ...message.request, messages: [] } }))
      )
    );
    setCacheVersion();
  }, [libraryChatMessages]);

  useEffect(() => {
    localStorage.setItem(
      "tender-search",
      JSON.stringify(
        tenderSearchMessages.map((message) => ({ ...message, request: { ...message.request, messages: [] } }))
      )
    );
    setCacheVersion();
  }, [tenderSearchMessages]);

  const handleClickSubmitButton = () => {
    setShowWelcome(false);
    posthog.capture("word_addin_submit_clicked", {
      isRefine,
      isCustomPrompt,
      selectedTab,
      hasSelectedText: !!selectedText.trim(),
      client_type: "word_add_in",
    });

    if (isRefine) {
      if (currentRefine.tab === "library-chat") {
        const refine = refineResponse(inputValue, currentRefine.message, libraryChatMessages);
        if (currentRefine.message.action === "default") {
          handleLibraryChatMessage({
            ...currentRefine.message.request,
            isRefine: true,
            refineInstruction: inputValue,
            messages: refine.messages,
          });
        } else {
          handleCustomPromptMessage({
            ...currentRefine.message.request,
            isRefine: true,
            refineInstruction: inputValue,
            messages: refine.messages,
          });
        }
      } else if (currentRefine.tab === "internet-search") {
        const refine = refineResponse(inputValue, currentRefine.message, internetResearchMessages);
        handleInternetSearchMessage({
          ...currentRefine.message.request,
          isRefine: true,
          refineInstruction: inputValue,
          messages: refine.messages,
        });
      } else if (currentRefine.tab === "tender-search") {
        const refine = refineResponse(inputValue, currentRefine.message, tenderSearchMessages);
        handleTenderSearchMessage({
          ...currentRefine.message.request,
          isRefine: true,
          refineInstruction: inputValue,
          messages: refine.messages,
        });
      }
      setCurrentRefine(undefined);
    } else if (isCustomPrompt) {
      handleCustomPromptMessage({
        highlightedText: selectedText,
        instructionText: inputValue,
        action: "Custom Prompt",
        messages: libraryChatMessages,
        isRefine: false,
        isCustomPrompt: true,
        type: "text",
      });
    } else {
      if (isLibraryChatTab) {
        handleLibraryChatMessage({
          highlightedText: selectedText,
          instructionText: inputValue,
          action: "default",
          messages: libraryChatMessages,
          isRefine: false,
          isCustomPrompt: false,
          type: "text",
        });
      } else if (isInternetSearchTab) {
        handleInternetSearchMessage({
          highlightedText: selectedText,
          instructionText: inputValue,
          action: "default",
          messages: internetResearchMessages,
          isRefine: false,
          isCustomPrompt: false,
          type: "text",
        });
      } else if (isTenderSearchTab) {
        handleTenderSearchMessage({
          highlightedText: selectedText,
          instructionText: inputValue,
          action: "default",
          messages: tenderSearchMessages,
          isRefine: false,
          isCustomPrompt: false,
          type: "text",
          tenderBid: selectedTenderBid,
        });
      }
    }
  };

  const handleLibraryChatMessage = (request: IMessageRequest) => {
    if (request.instructionText.trim() !== "") {
      posthog.capture("word_addin_library_chat_message_sent", {
        isRefine: request.isRefine,
        hasHighlightedText: !!request.highlightedText,
        client_type: "word_add_in",
      });

      setLibraryChatMessages([
        ...request.messages,
        withId({
          type: "text",
          createdBy: "user",
          value: request.instructionText,
          action: "default",
          isRefine: request.isRefine,
          request,
        }),
        withId({ type: "loading", createdBy: "bot", value: "loading", action: "default", isRefine: false, request }),
      ]);

      askLibraryChatQuestion(tokenRef.current, request)
        .then((message) => {
          setLibraryChatMessages((messages) => [...messages.slice(0, -1), message]);
          posthog.capture("word_addin_library_chat_response_received", {
            messageType: message.type,
            client_type: "word_add_in",
          });
        })
        .catch((error) => {
          console.log(error);
          posthog.capture("word_addin_library_chat_error", {
            error: error.message,
            client_type: "word_add_in",
          });
        });
      setInputValue("");
    }
  };

  const handleInternetSearchMessage = (request: IMessageRequest) => {
    if (request.instructionText.trim() !== "") {
      setInternetResearchMessages([
        ...request.messages,
        withId({
          type: "text",
          createdBy: "user",
          value: request.instructionText,
          action: "default",
          isRefine: request.isRefine,
          request,
        }),
        withId({ type: "loading", createdBy: "bot", value: "loading", action: "default", isRefine: false, request }),
      ]);
      askInternetQuestion(tokenRef.current, request)
        .then((message) => {
          setInternetResearchMessages((messages) => [...messages.slice(0, -1), message]);
        })
        .catch(console.log);
      setInputValue("");
    }
  };

  const handleCustomPromptMessage = (request: IMessageRequest) => {
    setShowWelcome(false);
    setSelectedTab("library-chat");
    if (request.highlightedText.trim()) {
      setLibraryChatMessages([
        ...request.messages,
        withId({
          type: "text",
          createdBy: "user",
          value: request.highlightedText,
          action: request.action,
          isRefine: request.isRefine,
          request,
        }),
        withId({ type: "loading", createdBy: "bot", value: "loading", action: "default", isRefine: false, request }),
      ]);
      askCustomPrompt(request)
        .then((message) => {
          setLibraryChatMessages((messages) => [...messages.slice(0, -1), message]);
        })
        .catch(console.log);
      setInputValue("");
    }
  };

  const handleTenderSearchMessage = (request: IMessageRequest) => {
    if (request.instructionText.trim() !== "" && request.tenderBid) {
      setTenderSearchMessages([
        ...request.messages,
        withId({
          type: "text",
          createdBy: "user",
          value: request.instructionText,
          action: "default",
          isRefine: request.isRefine,
          request,
          tenderBid: request.tenderBid,
        }),
        withId({ type: "loading", createdBy: "bot", value: "loading", action: "default", isRefine: false, request }),
      ]);
      askLibraryChatQuestion(tokenRef.current, request)
        .then((message) => {
          setTenderSearchMessages((messages) => [...messages.slice(0, -1), message]);
        })
        .catch(console.log);
      setInputValue("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleClickSubmitButton();
    }
  };

  const shortcutVisible = (message: IMessage, type: IShortcutType): IButtonStatus => {
    if (message.type === "text" && type === "copy" && message.createdBy == "bot") return "enabled";
    if (message.type === "text" && type === "replace") return "enabled";
    if (message.type === "image" && type === "insert") return "enabled";
    if (type === "refine" && currentRefine?.message?.id === message.id) return "disabled";
    if (type === "refine" && currentRefine?.message?.id !== message.id) return "enabled";
    return "hidden";
  };

  // Track tab changes
  useEffect(() => {
    posthog.capture("word_addin_tab_changed", {
      newTab: selectedTab,
      client_type: "word_add_in",
    });
  }, [selectedTab]);

  // Track welcome screen visibility
  useEffect(() => {
    if (!showWelcome) {
      posthog.capture("word_addin_welcome_closed", {
        client_type: "word_add_in",
      });
    }
  }, [showWelcome]);

  return (
    <Box display="flex" flexDirection="column" height="100%" padding={"3px"}>
      <Box position="relative">
        <Tabs
          variant="fullWidth"
          onChange={(_e, value) => isLoading || setSelectedTab(value)}
          value={selectedTab}
          TabIndicatorProps={{ style: { display: "none" } }}
        >
          <Tab label="Library Chat" value="library-chat" onClick={() => isLoading || setSelectedTab("library-chat")} />
          <Tab label="Tender Research" value="tender-search" />
          <Tab label="Internet AI" value="internet-search" />
        </Tabs>
        <SignoutFab />
      </Box>
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
        }}
        ref={responseMessageBoxRef}
      >
        <div className="bid-pilot-container border-box">
          {showWelcome && !isTenderSearchTab ? (
            <Welcome />
          ) : isInternetSearchTab ? (
            <MessageBox
              messages={internetResearchMessages}
              showShortcuts={true}
              handleClickShortcut={handleClickMessageShortcut}
              shortcutVisible={shortcutVisible}
            />
          ) : isLibraryChatTab ? (
            <MessageBox
              messages={libraryChatMessages}
              showShortcuts={true}
              handleClickShortcut={handleClickMessageShortcut}
              shortcutVisible={shortcutVisible}
            />
          ) : isTenderSearchTab ? (
            <TenderSearchMessageBox
              messages={tenderSearchMessages}
              showShortcuts={true}
              handleClickShortcut={handleClickMessageShortcut}
              shortcutVisible={shortcutVisible}
              setSelectedTenderBid={setSelectedTenderBid}
              selectedTenderBid={selectedTenderBid}
            />
          ) : (
            "Invalid Tab"
          )}
        </div>
      </Box>
      <Box marginTop="2px">
        <div className="border-box" style={{ padding: "5px 10px" }}>
          {isCustomPromptMenuVisible && (
            <Paper
              variant="outlined"
              className="enhance-prompt-menu"
              sx={{
                borderColor: (theme) => theme.palette.primary.main,
              }}
            >
              <MenuList>
                {customPrompts.map((item) => {
                  return (
                    <MenuItem onClick={handleClickMenuItem(item)} key={item.id}>
                      {item.title}
                    </MenuItem>
                  );
                })}
              </MenuList>
            </Paper>
          )}
          <Box display="flex" flexDirection="row">
            <Grid item container spacing={1}>
              <Grid item>
                <Button
                  variant={isCustomPromptMenuVisible ? "contained" : "outlined"}
                  color={isCustomPromptMenuVisible || isCustomPrompt ? "primary" : "info"}
                  disabled={selectedText.length === 0 || isLoading}
                  onClick={toggleCustomPromptMenuVisible}
                  size="small"
                >
                  Enhance
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={() =>
                    handleCustomPromptMessage({
                      highlightedText: selectedText,
                      instructionText: inputValue,
                      action: "Graph",
                      messages: libraryChatMessages,
                      isRefine: false,
                      isCustomPrompt: false,
                      type: "text",
                    })
                  }
                  disabled={selectedText.length === 0 || isLoading}
                >
                  Graph
                </Button>
              </Grid>
            </Grid>
            <Grid item>
              <Button variant="outlined" color="info" onClick={handleClearMessages} disabled={isLoading} size="small">
                Clear
              </Button>
            </Grid>
          </Box>
        </div>
      </Box>
      <Box marginTop="2px">
        <div className="border-box chat-input-box">
          <textarea
            placeholder={
              isRefine
                ? "Please type your refinement in here..."
                : isCustomPrompt
                  ? "Please type your custom prompt in here..."
                  : isInternetSearchTab
                    ? "Please type your search query in here..."
                    : "Please type your question in here..."
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className={"chat-input" + (isCustomPrompt ? " custom-prompt" : "")}
            rows={2}
            ref={textInputRef}
          />
          <Button
            onClick={handleClickSubmitButton}
            disabled={isLoading || inputValue.trim() === "" || (isTenderSearchTab && !selectedTenderBid)}
            className="chat-send-button"
            color="primary"
            variant="contained"
            size="small"
          >
            {isRefine ? "Refine" : "Generate"}
          </Button>
        </div>
      </Box>
    </Box>
  );
};

export default withAuth(WordpaneCopilot);
