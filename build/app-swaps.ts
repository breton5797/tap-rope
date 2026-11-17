// iPad / Android app build (vite --mode office-app) swaps on top of OFFICE_SWAPS: native haptics and the real ad /
// purchase adapters. The web office and v8 builds never resolve these, so their bundles carry no ad or store SDK.
export const APP_SWAPS: Readonly<Record<string, string>> = {
  'src/platform/haptics.ts': 'src/office/platform/haptics.app.ts',
  'src/office/monetization/platform.ts': 'src/office/monetization/platform.app.ts',
};
