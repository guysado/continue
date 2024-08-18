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
      label: "🌉 Setup",
      collapsible: true,
      collapsed: true,
      items: [
        "setup/overview",
        "setup/configuration",
        "setup/model-providers",
        "setup/select-model",
      ],
    },
    {
      type: "category",
      label: "📚 Tutorials",
      collapsible: true,
      collapsed: true,
      items: ["walkthroughs/set-up-codestral", "walkthroughs/llama3.1"],
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
        "customization/context-providers",
        "customization/slash-commands",
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
      label: "🧑‍💻 Privacy",
      collapsible: true,
      collapsed: true,
      items: [
        "development-data",
        "telemetry",
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
    {
      type: "doc",
      id: "community/code-of-conduct",
      label: "📜 Code of Conduct",
    },
    // roadmap,
    {
      type: "doc",
      id: "community/contributing",
      label: "🤝 Contributing",
    },
    "changelog",
    // support
  ],
};

module.exports = sidebars;
