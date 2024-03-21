import { debounce } from "lodash";
import { useEffect, useState } from "react";
import useUIConfig from "../../hooks/useUIConfig";
import CodeBlockToolBar from "./CodeBlockToolbar";

function childToText(child: any) {
  if (typeof child === "string") {
    return child;
  } else if (child?.props) {
    return childToText(child.props?.children);
  } else if (Array.isArray(child)) {
    return childrenToText(child);
  } else {
    return "";
  }
}

function childrenToText(children: any) {
  return children.map((child: any) => childToText(child)).join("");
}

function PreWithToolbar(props: { children: any }) {
  const uiConfig = useUIConfig()
  const toolbarBottom = uiConfig?.codeBlockToolbarPosition == 'bottom';

  const [hovering, setHovering] = useState(true);

  const [copyValue, setCopyValue] = useState("");

  useEffect(() => {
    const debouncedEffect = debounce(() => {
      setCopyValue(childrenToText(props.children.props.children));
    }, 100);

    debouncedEffect();

    return () => {
      debouncedEffect.cancel();
    };
  }, [props.children]);

  return (
    <div
      style={{ padding: "0px" }}
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {!toolbarBottom && hovering && <CodeBlockToolBar text={copyValue} bottom={toolbarBottom}></CodeBlockToolBar>}
      {props.children}
      {toolbarBottom && hovering && <CodeBlockToolBar text={copyValue} bottom={toolbarBottom}></CodeBlockToolBar>}
    </div>
  );
}

export default PreWithToolbar;
