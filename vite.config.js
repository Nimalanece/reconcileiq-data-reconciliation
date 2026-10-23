import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";
          if (/\/node_modules\/(antd|@rc-component|rc-[^/]+|@ant-design\/icons)\//.test(id)) return "vendor-ui";
          if (/\/node_modules\/(recharts|d3-[^/]+)\//.test(id)) return "vendor-charts";
          return undefined;
        },
      },
    },
  },
});
