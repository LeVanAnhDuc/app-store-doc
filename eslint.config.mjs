import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "out/**", "playwright-report/**", "test-results/**"] },
  ...coreWebVitals,
  ...typescriptConfig,
];

export default config;
