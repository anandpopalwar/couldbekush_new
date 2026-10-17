import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // process.cwd() is ESM-safe (no __dirname now that the project is "type": "module").
  outputFileTracingRoot: process.cwd(),
  // Dev only: let a Cloudflare quick tunnel (cloudflared) show the dev server
  // to someone else — Next otherwise blocks its scripts from another hostname.
  allowedDevOrigins: ["*.trycloudflare.com"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Vercel Blob public store: <store-id>.public.blob.vercel-storage.com
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default withPayload(nextConfig);
