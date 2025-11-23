import next from "eslint-config-next";

export default [
  {
    ignores: ["**/dist/**", "**/.next/**"],
  },
  ...next(),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "jsx-a11y/role-supports-aria-props": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/exhaustive-deps": "warn"
    },
  },
];
