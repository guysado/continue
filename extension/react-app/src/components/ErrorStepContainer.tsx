import React from "react";
import styled from "styled-components";
import { HistoryNode } from "../../../schema/HistoryNode";
import { defaultBorderRadius, vscBackground } from ".";
import HeaderButtonWithText from "./HeaderButtonWithText";
import {
  MinusCircleIcon,
  MinusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const Div = styled.div`
  padding: 8px;
  background-color: #ff000011;
  border-radius: ${defaultBorderRadius};
  border: 1px solid #cc0000;
`;

interface ErrorStepContainerProps {
  historyNode: HistoryNode;
  onClose: () => void;
}

function ErrorStepContainer(props: ErrorStepContainerProps) {
  return (
    <div style={{ backgroundColor: vscBackground, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          right: "4px",
          top: "4px",
        }}
      >
        <HeaderButtonWithText text="Collapse" onClick={() => props.onClose()}>
          <MinusCircleIcon width="24px" height="24px" />
        </HeaderButtonWithText>
      </div>
      <Div>
        <pre className="overflow-x-scroll">
          {props.historyNode.observation?.error as string}
        </pre>
      </Div>
    </div>
  );
}

export default ErrorStepContainer;
