import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import {
  StyledTooltip,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscForeground,
} from ".";
import {
  TrashIcon,
  PaintBrushIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { GUIClientContext } from "../App";
import { useDispatch } from "react-redux";
import { ContextItem } from "../../../schema/FullState";
import { getFontSize } from "../util";
import HeaderButtonWithText from "./HeaderButtonWithText";

const Button = styled.button<{ fontSize?: number }>`
  border: none;
  color: ${vscForeground};
  background-color: ${secondaryDark};
  border-radius: ${defaultBorderRadius};
  padding: 4px;
  padding-left: 8px;
  padding-right: 8px;
  overflow: hidden;
  font-size: ${(props) => props.fontSize || getFontSize()}px;

  cursor: pointer;
`;

const GridDiv = styled.div`
  position: absolute;
  left: 0px;
  top: 0px;
  width: 100%;
  height: 100%;
  display: grid;
  grid-gap: 0;
  align-items: center;
  border-radius: ${defaultBorderRadius};

  background-color: ${secondaryDark};
`;

const ButtonDiv = styled.div<{ backgroundColor: string }>`
  background-color: ${secondaryDark};
  height: 100%;
  display: flex;
  align-items: center;

  &:hover {
    background-color: ${(props) => props.backgroundColor};
  }
`;

const CircleDiv = styled.div`
  position: absolute;
  top: -10px;
  right: -10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: red;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
`;

interface PillButtonProps {
  onHover?: (arg0: boolean) => void;
  item: ContextItem;
  editing: boolean;
  editingAny: boolean;
  index: number;
  areMultipleItems?: boolean;
  onDelete?: (index?: number) => void;
  onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  stepIndex?: number;
  previewing?: boolean;
}

interface StyledButtonProps {
  borderColor?: string;
  editing?: boolean;
}

const Container = styled.div<{ previewing?: boolean }>`
  ${(props) => {
    return (
      props.previewing &&
      `
      padding-bottom: 16px;
      margin-bottom: -16px;
    `
    );
  }}
  border-radius: ${defaultBorderRadius};
  background-color: ${secondaryDark};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledButton = styled(Button)<StyledButtonProps>`
  position: relative;
  border-color: ${(props) => props.borderColor || "transparent"};
  border-width: 1px;
  border-style: solid;

  &:focus {
    outline: none;
    /* border-color: ${lightGray}; */
    text-decoration: underline;
  }
`;

const PillButton = (props: PillButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const client = useContext(GUIClientContext);

  const [warning, setWarning] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (props.editing && props.item.content.length > 4000) {
      setWarning("Editing such a large range may be slow");
    } else {
      setWarning(undefined);
    }
  }, [props.editing, props.item]);

  const dispatch = useDispatch();

  return (
    <div style={{ position: "relative" }}>
      <Container previewing={props.previewing}>
        <StyledButton
          fontSize={getFontSize()}
          borderColor={
            props.editing ? (warning ? "red" : undefined) : undefined
          }
          onMouseEnter={() => {
            setIsHovered(true);
            if (props.onHover) {
              props.onHover(true);
            }
          }}
          onMouseLeave={() => {
            setIsHovered(false);
            if (props.onHover) {
              props.onHover(false);
            }
          }}
          className={`pill-button-${props.stepIndex || "main"}`}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              props.onDelete?.(props.stepIndex);
            }
          }}
          onClick={(e) => {
            props.onClick?.(e);
          }}
        >
          <span className={isHovered ? "underline" : ""}>
            {props.item.description.name}
          </span>
        </StyledButton>
        {props.previewing && (
          <HeaderButtonWithText
            text="Delete"
            onClick={() => props.onDelete?.(props.stepIndex)}
          >
            <TrashIcon width="1.4em" height="1.4em" />
          </HeaderButtonWithText>
        )}
      </Container>
      <StyledTooltip id={`edit-${props.index}`}>
        {props.item.editing
          ? "Editing this section (with entire file as context)"
          : "Edit this section"}
      </StyledTooltip>
      <StyledTooltip id={`delete-${props.index}`}>Delete</StyledTooltip>
      {props.editing &&
        (warning ? (
          <>
            <CircleDiv
              data-tooltip-id={`circle-div-${props.item.description.name}`}
              className="z-10"
            >
              <ExclamationTriangleIcon
                style={{ margin: "auto" }}
                width="1.0em"
                strokeWidth={2}
              />
            </CircleDiv>
            <StyledTooltip id={`circle-div-${props.item.description.name}`}>
              {warning}
            </StyledTooltip>
          </>
        ) : (
          <>
            <CircleDiv
              data-tooltip-id={`circle-div-${props.item.description.name}`}
              style={{
                backgroundColor: "#8800aa55",
                border: `0.5px solid ${lightGray}`,
                padding: "1px",
                zIndex: 1,
              }}
            >
              <PaintBrushIcon
                style={{ margin: "auto" }}
                width="1.0em"
                strokeWidth={2}
              />
            </CircleDiv>
            <StyledTooltip id={`circle-div-${props.item.description.name}`}>
              Editing this range
            </StyledTooltip>
          </>
        ))}
    </div>
  );
};

export default PillButton;
