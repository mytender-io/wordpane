export interface IMessage {
  type: "text" | "image" | "loading";
  value: string;
  createdBy: "user" | "bot";
  action: "default" | IPromptType;
  isRefine: boolean;
  id: string;
  request: IMessageRequest;
}

export type IMessageRequest =
  | {
      type: "text" | "image";
      highlightedText: string;
      instructionText: string;
      action: IPromptType | "default";
      messages: IMessage[];
      isRefine: false;
      isCustomPrompt: boolean;
      tenderBid?: ITenderBid;
    }
  | {
      type: "text" | "image";
      highlightedText: string;
      instructionText: string;
      action: IPromptType | "default";
      messages: IMessage[];
      isRefine: true;
      isCustomPrompt: boolean;
      refineInstruction: string;
      tenderBid?: ITenderBid;
    };

export type IPromptType =
  | "Summarise"
  | "Expand"
  | "Inject Tender Context"
  | "Inject Company Voice"
  | "We will Active Voice"
  | "Graph"
  | "Custom Prompt";

export type IShortcutType = "insert" | "replace" | "refine" | "copy";

export type IButtonStatus = "hidden" | "disabled" | "enabled";

export type IChatTypes = "library-chat" | "internet-search" | "tender-search";

export interface ITenderBid {
  _id: string;
  bid_manager: string;
  bid_qualification_result: string;
  bid_title: string;
  client_name: string;
  compliance_requirements: string;
  contract_information: string;
}
