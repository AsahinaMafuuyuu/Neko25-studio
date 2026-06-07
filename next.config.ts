import type { NextConfig } from "next";
import { installDep0040WarningFilter } from "./warning-filter";

installDep0040WarningFilter();

const nextConfig: NextConfig = {
  serverExternalPackages: ["@insforge/sdk"],
};

export default nextConfig;
