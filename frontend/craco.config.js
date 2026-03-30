const path = require("path");
require("dotenv").config();

const isLocalDevelopment = process.env.NODE_ENV === 'development' && process.env.DISABLE_VISUAL_EDITS !== 'true';

const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig, { env }) => {
      // Produzione: restituisci config pulita immediatamente
      if (env === 'production' || !isLocalDevelopment) {
        console.log("🚀 YachtAssist Build: Visual Edits disabilitati per la produzione.");
        return webpackConfig;
      }

      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/build/**',
          '**/dist/**',
          '**/coverage/**',
          '**/public/**',
        ],
      };

      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      // Solo in locale: prova Emergent
      try {
        const { withVisualEdits } = require("@emergentbase/visual-edits/craco");
        return withVisualEdits(webpackConfig);
      } catch (err) {
        console.warn("⚠️ Emergent Visual Edits non trovato.");
        return webpackConfig;
      }
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }
      setupHealthEndpoints(devServer, healthPluginInstance);
      return middlewares;
    };
  }
  return devServerConfig;
};

module.exports = webpackConfig;
