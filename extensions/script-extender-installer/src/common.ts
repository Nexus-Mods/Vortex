export const storeName = (id: string) => {
  switch (id) {
    case "gog":
      return "GOG";
    case "epic":
      return "Epic Games";
    case "xbox":
      return "Xbox Game Pass";
    case "steam":
      return "Steam";
    default:
      return "Unknown Game Store";
  }
};
