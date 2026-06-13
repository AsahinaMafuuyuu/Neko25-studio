import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { installDep0040WarningFilter } from "./warning-filter";

installDep0040WarningFilter();

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@insforge/sdk"],
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
};

export default withNextIntl(nextConfig);
