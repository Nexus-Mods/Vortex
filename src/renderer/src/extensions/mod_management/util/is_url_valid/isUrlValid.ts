/** Whether text is a full address, as the legacy website field checks it. */
export const isUrlValid = (text: string | undefined): boolean => {
  try {
    new URL(text ?? "");
    return true;
  } catch {
    return false;
  }
};
