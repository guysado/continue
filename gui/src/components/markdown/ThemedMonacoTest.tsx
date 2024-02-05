import { wireTmGrammars } from "monaco-editor-textmate";
import { Registry } from "monaco-textmate";
import { useMemo, useRef, useState } from "react";
import MonacoEditor from "react-monaco-editor";
import styled from "styled-components";
import {
  VSC_EDITOR_BACKGROUND_VAR,
  defaultBorderRadius,
  parseColorForHex,
} from "..";
import "./monaco.css";

const fetchTextMateGrammar = async (lang: string): Promise<string> => {
  return (
    await fetch(`${(window as any).vscMediaUrl}/textmate-syntaxes/${lang}`)
  ).text();
};

const supportedLanguages = {
  "source.ts": ["typescript", "TypeScript.tmLanguage.json"],
  "source.js": ["javascript", "JavaScript.tmLanguage.json"],
  "source.rust": ["rust", "rust.json"],
  // "source.batchfile": ["batchfile", "Batch File.tmLanguage"],
  "source.c": ["c", "c.json"],
  "source.cpp": ["cpp", "c++.json"],
  // "source.clojure": ["clojure", "Clojure.tmLanguage"],
  // "source.coffeescript": ["coffeescript", "coffeescript.json"],
  // "source.cshtml": ["cshtml", "cshtml.json"],
  // "source.css": ["css", "css.plist"],
  // "source.diff": ["diff", "diff.tmLanguage"],
  // "source.dockerfile": ["dockerfile", "Dockerfile.tmLanguage"],
  // "source.fsharp": ["fsharp", "fsharp.json"],
  // "source.git-commit": ["git-commit", "git-commit.tmLanguage"],
  // "source.git-rebase": ["git-rebase", "git-rebase.tmLanguage"],
  "source.go": ["go", "go.json"],
  // "source.groovy": ["groovy", "Groovy.tmLanguage"],
  // "source.handlebars": ["handlebars", "Handlebars.json"],
  "source.html": ["html", "html.json"],
  // "source.jade": ["jade", "Jade.json"],
  "source.java": ["java", "java.json"],
  // "source.javascript": ["javascript", "JavaScript.tmLanguage.json"],
  // // "source.json": ["json", "JSON.tmLanguage"],
  // "source.less": ["less", "less.tmLanguage.json"],
  // "source.lua": ["lua", "lua.json"],
  "source.python": ["python", "MagicPython.tmLanguage.json"],
  // "source.magicregexp": ["magicregexp", "MagicRegExp.tmLanguage.json"],
  // "source.makefile": ["makefile", "Makefile.json"],
  // // "source.markdown": ["markdown", "markdown.tmLanguage"],
  // // "source.objective-c": ["objective-c", "Objective-C.tmLanguage"],
  // // "source.perl6": ["perl6", "Perl 6.tmLanguage"],
  // // "source.perl": ["perl", "Perl.plist"],
  "source.php": ["php", "php.json"],
  // // "source.platform": ["platform", "Platform.tmLanguage"],
  // // "source.powershell": ["powershell", "PowershellSyntax.tmLanguage"],
  // // "source.properties": ["properties", "properties.plist"],
  // // "source.r": ["r", "R.plist"],
  // // "source.regexp": ["regexp", "Regular Expressions (JavaScript).tmLanguage"],
  // // "source.ruby": ["ruby", "Ruby.plist"],
  // "source.scss": ["scss", "scss.json"],
  // "source.shaderlab": ["shaderlab", "shaderlab.json"],
  // "source.shell-unix-bash": [
  //   "shell-unix-bash",
  //   "Shell-Unix-Bash.tmLanguage.json",
  // ],
  // // "source.sql": ["sql", "SQL.plist"],
  "source.swift": ["swift", "swift.json"],
  "source.tsx": ["tsx", "TypeScriptReact.tmLanguage.json"],
  "source.xml": ["xml", "xml.json"],
  "source.xsl": ["xsl", "xsl.json"],
  "source.yaml": ["yaml", "yaml.json"],
};

export const supportedLanguagesArray = Object.keys(supportedLanguages).map(
  (l) => supportedLanguages[l][0]
);

const registry = new Registry({
  getGrammarDefinition: async (scopeName) => {
    if (scopeName in supportedLanguages) {
      const [_, tmFilename] = supportedLanguages[scopeName];
      let content;
      try {
        content = await fetchTextMateGrammar(tmFilename);
      } catch (e) {
        console.warn("Error fetching grammar for language", scopeName, e);
        content = await fetchTextMateGrammar("TypeScript.tmLanguage.json");
      }

      return {
        format: "json",
        content,
      };
    } else {
      return null;
    }
  },
});

const theme = {
  id: "custom-theme",
  name: "Custom Theme",
  theme: {
    ...(window as any).fullColorTheme,
    base: "vs-dark",
    inherit: true,
    encodedTokensColors: undefined,
    // rules: [],
    colors: {
      "editor.background": parseColorForHex(VSC_EDITOR_BACKGROUND_VAR),
    },
  },
};

const ContainerDiv = styled.div<{ showBorder: 0 | 1 }>`
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
  border: ${(props) => (props.showBorder ? "1px solid #8888" : "none")};
`;

interface MonacoCodeBlockProps {
  codeString: string;
  preProps: any;
  language: string;
  showBorder: boolean;
}

export const ThemedMonacoTest = (props: MonacoCodeBlockProps) => {
  const monacoRef = useRef(null);
  const editorRef = useRef();

  // code in editor
  const [value, setValue] = useState(props.codeString);

  const setCurrentTheme = (themeId) => {
    monacoRef.current.editor.defineTheme("custom-theme", theme.theme);

    liftOff(monacoRef.current).then(() => {
      monacoRef.current.editor.setTheme("custom-theme");
      setValue(props.codeString);
    });
  };

  const liftOff = async (monaco) => {
    const grammars = new Map();

    for (const [scopeName, [languageId, _]] of Object.entries(
      supportedLanguages
    )) {
      grammars.set(languageId, scopeName);
      monaco.languages.register({ id: languageId });
    }

    await wireTmGrammars(monaco, registry, grammars, editorRef.current);
  };

  const onEditorDidMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    setCurrentTheme(theme);
  };

  const onEditorChange = (value) => {
    setValue(value);
  };

  const memoizedEditor = useMemo(
    () => (
      <MonacoEditor
        height={props.codeString.split("\n").length * 18 + 4}
        value={props.codeString}
        editorDidMount={onEditorDidMount}
        onChange={onEditorChange}
        language={
          supportedLanguagesArray.includes(props.language)
            ? props.language
            : "typescript"
        }
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          scrollbar: {
            alwaysConsumeMouseWheel: false,
            verticalScrollbarSize: 4,
            horizontalScrollbarSize: 4,
          },
          hover: {},
          renderWhitespace: "none",
          overviewRulerLanes: 0,
          lineNumbers: "off",
          folding: false,
          guides: {
            indentation: false,
          },
          renderLineHighlight: "none",
        }}
      />
    ),
    [onEditorChange, onEditorDidMount]
  );

  return (
    <ContainerDiv showBorder={props.showBorder} {...props.preProps}>
      {memoizedEditor}
    </ContainerDiv>
  );
};
