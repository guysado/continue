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
    "intro",
    "quickstart",
    "how-to-use-continue",
    {
      type: "category",
      label: "🌉 Model setup",
      collapsible: true,
      collapsed: true,
      items: [
        "model-setup/overview",
        "model-setup/select-provider",
        "model-setup/select-model",
        "model-setup/configuration",
      ],
    },
    {
      type: "category",
      label: "🎨 Customization",
      collapsible: true,
      collapsed: true,
      items: [
        "customization/overview",
        "customization/context-providers",
        "customization/slash-commands",
      ],
    },
    {
      type: "category",
      label: "🚶 Walkthroughs",
      collapsible: true,
      collapsed: true,
      items: [
        // "walkthroughs/codellama",
        "walkthroughs/running-continue-without-internet",
        "walkthroughs/codebase-embeddings",
        // "walkthroughs/config-file-migration",
      ],
    },
    "development-data",
    "telemetry",
    "troubleshooting",
    {
      type: "category",
      label: "📖 Reference",
      collapsible: true,
      collapsed: true,
      items: [
        {
          type: "autogenerated",
          dirName: "reference",
        },
      ],
    },
  ],
};

module.exports = sidebars;
