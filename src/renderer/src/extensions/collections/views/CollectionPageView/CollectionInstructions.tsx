import * as React from "react";
import { Button } from "react-bootstrap";
import ReactMarkdown from "react-markdown";

import type { IMod, IModRule } from "../../../../extensions/mod_management/types/IMod";
import { findModByRef } from "../../../../extensions/mod_management/util/findModByRef";
import { renderModReference } from "../../../../extensions/mod_management/util/modName";
import type { TFunction } from "../../../../util/i18n";
import { DEFAULT_INSTRUCTIONS } from "../../constants";
import { isEmpty } from "../../util/util";

export interface IInstructionsProps {
  t: TFunction;
  collection: IMod;
  mods: { [modId: string]: IMod };
  onToggleInstructions: (evt: React.MouseEvent<any>) => void;
}

interface IInstructionsEntry {
  rule: IModRule;
  mod: IMod;
  name: string;
  instructions: string;
}

function Instructions(props: IInstructionsProps) {
  const { t, collection, mods, onToggleInstructions } = props;

  const { required, optional } = React.useMemo(() => {
    return (collection.rules ?? []).reduce(
      (prev, rule) => {
        if (isEmpty(rule.extra?.instructions) || !["requires", "recommends"].includes(rule.type)) {
          return prev;
        }

        const mod: IMod = findModByRef(rule.reference, mods);

        if (mod !== undefined) {
          const entry: IInstructionsEntry = {
            rule,
            mod,
            name: renderModReference(rule.reference),
            instructions: rule.extra?.instructions,
          };

          if (rule.type === "requires") {
            prev.required.push(entry);
          } else {
            prev.optional.push(entry);
          }
        }

        return prev;
      },
      {
        required: [] as IInstructionsEntry[],
        optional: [] as IInstructionsEntry[],
      },
    );
  }, [mods, collection]);

  const installInstructions =
    (collection.attributes?.installInstructions === undefined ||
      collection.attributes?.installInstructions === "") &&
    required.length === 0 &&
    optional.length === 0
      ? t(DEFAULT_INSTRUCTIONS)
      : collection.attributes?.installInstructions;

  return (
    <>
      <ReactMarkdown
        allowedElements={["p", "br", "a", "em", "strong"]}
        className="collection-instructions-text"
        unwrapDisallowed={true}
      >
        {installInstructions}
      </ReactMarkdown>

      {required.length > 0 ? (
        <>
          <h4>{t("Instructions - Required Mods")}</h4>

          <div className="collection-instructions-container">
            <table>
              <tbody>
                {required.map((iter) => (
                  <tr key={iter.name}>
                    <td className="collection-mod-name">{iter.name}</td>

                    <td className="collection-mod-instructions">
                      <ReactMarkdown
                        allowedElements={["p", "br", "a", "em", "strong"]}
                        unwrapDisallowed={true}
                      >
                        {iter.instructions}
                      </ReactMarkdown>
                    </td>

                    <td className="collection-mod-actions">
                      <Button data-modid={iter.mod?.id} onClick={onToggleInstructions}>
                        {t("Open instructions")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {optional.length > 0 ? (
        <>
          <h4>{t("Instructions - Optional Mods")}</h4>

          <div className="collection-instructions-container">
            <table>
              <tbody>
                {optional.map((iter) => (
                  <tr key={iter.name}>
                    <td className="collection-mod-name">{iter.name}</td>

                    <td className="collection-mod-instructions">
                      <ReactMarkdown
                        allowedElements={["p", "br", "a", "em", "strong"]}
                        unwrapDisallowed={true}
                      >
                        {iter.instructions}
                      </ReactMarkdown>
                    </td>

                    <td className="collection-mod-actions">
                      <Button data-modid={iter.mod?.id} onClick={onToggleInstructions}>
                        {t("Open instructions")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}

export default Instructions;
