// What initiated a collection install pause, recorded on the "pause collection" log so a
// log audit can tell an intentional user pause from an incidental one (game switch,
// logout, removal, free-user download cancel).
export type CollectionPauseTrigger =
  | "user"
  | "logout"
  | "remove"
  | "gamemode-changed"
  | "free-user-cancel";
