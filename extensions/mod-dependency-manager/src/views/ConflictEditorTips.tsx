import React from "react";

export default function ConflictEditorTips() {
  return (
    <div>
      <p>
        Setting rules between conflicting mods will decide which mod's files
        "win" the conflict by loading after the other conflicting files.
      </p>
      <p>
        You can think of it like the "winning" mod overriding the other mod,
        only that you can always come back and flip the rule without having to
        reinstall your mods.
      </p>
      <p>
        When it comes to deciding which mod should go after the other, there are
        a few things to consider.
      </p>
      <p>It is strongly advised to:</p>
      <ul>
        <li>Load patches and options after their base mod</li>
        <li>Load mods depending on others after their dependency</li>
      </ul>
      <p>
        The following is generally advised, but may not always produce the
        desired results:
      </p>
      <ul>
        <li>
          Load newer mods after older ones. ("Use Suggestions" is based on this
          principle)
        </li>
        <li>Load lesser known mods after very popular ones</li>
        <li>
          Load the mods you care most about after the ones you can live without
        </li>
      </ul>
    </div>
  );
}
