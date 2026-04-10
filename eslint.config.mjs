import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Downgraded to warn: pre-existing debt from eslint-config-next 16 + React 19.
      // TODO: fix these patterns and restore to 'error' in a follow-up pass.
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
