import { GetNativeArch } from 'winapi-bindings';

export const getCPUArch = () => {
  try {
    const nativeArchInfo = GetNativeArch();
    return nativeArchInfo.nativeArch;
  } catch (err) {
    return 'Unknown';
  }
}