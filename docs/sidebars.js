/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: "category",
      label: "🚀 Install",
      collapsible: true,
      collapsed: true,
      items: [
        {
          type: "doc",
          id: "intro",
          label: "Introduction",
        },
        {
          type: "doc",
          id: "install/vscode",
          label: "VS Code",
        },
        {
          type: "doc",
          id: "install/jetbrains",
          label: "JetBrains",
        },
        {
          type: "doc",
          id: "how-to-use-continue",
          label: "How to use Continue",
        },
        {
          type: "doc",
          id: "troubleshooting",
          label: "Troubleshooting",
        },
      ],
    },
    {
      type: "category",
      label: "📚 Tutorials",
      collapsible: true,
      collapsed: true,
      items: [
        "tutorials/continue-fundamentals",
        "tutorials/how-to-use-config-json",
        "tutorials/configuration-examples",
        "tutorials/select-an-llm",
        "tutorials/set-up-codestral",
        "tutorials/llama3.1",
        "tutorials/running-without-internet"
      ],
    },
    {
      type: "category",
      label: "⭐ Features",
      collapsible: true,
      collapsed: true,
      items: [
        "features/codebase-embeddings",
        "features/talk-to-your-docs",
        "features/tab-autocomplete",
        "features/context-providers",
        "features/slash-commands",
        {
          type: "doc",
          id: "features/prompt-files",
          label: "Prompt Files (experimental)",
        },
        {
          type: "doc",
          id: "features/quick-actions",
          label: "Quick Actions (experimental)",
        },
      ],
    },
    {
      type: "category",
      label: "🔬 Advanced",
      collapsible: true,
      collapsed: true,
      items: [
        "advanced/authentication",
        "advanced/custom-llm-provider",
        "advanced/custom-context-provider",
        "advanced/custom-slash-command",
        "advanced/llm-context-length",
        "advanced/customizing-the-chat-template",
        "advanced/customizing-edit-commands-prompt",
        "advanced/customizing-the-llm-capability",
      ],
    },
    {
      type: "category",
      label: "🧑‍💻 Privacy",
      collapsible: true,
      collapsed: true,
      items: [
        "privacy/development-data",
        "privacy/telemetry",
        {
          type: "link",
          label: "Privacy Policy",
          href: "https://www.continue.dev/privacy",
        },
      ],
    },
  ],
  referenceSidebar: [
    "reference/config",
    {
      type: "category",
      label: "LLM Providers",
      collapsible: true,
      collapsed: true,
      items: [
        {
          type: "autogenerated",
          dirName: "reference/Model Providers",
        },
      ],
    },
  ],
  communitySidebar: [
    'community/community',
    {
      type: "doc",
      id: "community/code-of-conduct",
      label: "📜 Code of Conduct",
    },
    'community/roadmap',
    {
      type: "doc",
      id: "community/contributing",
      label: "🤝 Contributing",
    },
    {
      type: "category",
      label: "📝 Changelog",
      collapsible: true,
      collapsed: true,
      items: [
        "community/change-log-vs-code",
        "community/change-log-intellij",
      ],
    },
    'community/support',
  ],
};

module.exports = sidebars;
