module.exports = ({ config }) => {
  const localBackend = process.env.EXPO_PUBLIC_API_URL?.startsWith("http://");

  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSSupportsLiveActivities: true,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSAllowsLocalNetworking: !!localBackend,
        },
        ...(localBackend ? { NSLocalNetworkUsageDescription: "Cpool connects to the development server on your local Wi-Fi." } : {}),
      },
    },
  };
};
