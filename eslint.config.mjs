import next from "eslint-config-next";

const config = [
  {
    ignores: [".next/**", ".supermemory/**", "node_modules/**", "contracts/**"]
  },
  ...next
];

export default config;
