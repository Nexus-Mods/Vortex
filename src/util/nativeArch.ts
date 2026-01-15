import * as winapiBindings from "winapi-bindings";

export const getCPUArch = () => {
  try {
    const nativeArchInfo = winapiBindings.GetNativeArch();
    return nativeArchInfo.nativeArch;
  } catch {
    return "Unknown";
  }
};
