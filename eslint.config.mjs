import next from "next";

/** @type {import('eslint').Linter.Config} */
const config = {
  // Your existing extends or other rules might go here in the future
  // For now, we are just adding the rule to disable 'any'
  rules: {
    "@typescript-eslint/no-explicit-any": "off"
  },
  ...next.config,
};

export default config;
