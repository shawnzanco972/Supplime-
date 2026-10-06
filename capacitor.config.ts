import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.shawnzanco.supplime",
  appName: "Supplime",
  webDir: "dist",
  backgroundColor: "#F4F1EA",
  android: {
    backgroundColor: "#F4F1EA",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      // Dark status-bar icons on the light cream background.
      style: "LIGHT",
    },
    // Lets the optional coach call api.x.ai from the phone without CORS trouble.
    CapacitorHttp: { enabled: true },
    LocalNotifications: {
      smallIcon: "ic_stat_supplime",
      iconColor: "#3D5A4C",
    },
  },
};

export default config;
