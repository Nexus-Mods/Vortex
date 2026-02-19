import "csstype";

// Don't try to switch to an IPC solution, we seem to handle
// -webkit-app-region: drag just fine
declare module "csstype" {
  interface Properties {
    WebkitAppRegion?: "drag" | "no-drag";
  }
}
