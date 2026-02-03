import * as React from "react";
import { useTranslation } from "react-i18next";
import { ControlLabel, FormControl } from "react-bootstrap";
import { FlexLayout, More, Toggle, tooltip, types } from "vortex-api";
import { INSTRUCTIONS_PLACEHOLDER, NAMESPACE } from "../../constants";

export interface IInstructionProps {
  collection: types.IMod;
  onSetCollectionAttribute: (path: string[], value: any) => void;
}

function CollectionGeneralInfo(props: IInstructionProps) {
  return (
    <FlexLayout type="row">
      {instructions(props)}
      {settings(props)}
    </FlexLayout>
  );
}

const settings = (props: IInstructionProps) => {
  const [t] = useTranslation([NAMESPACE, "common"]);
  const { onSetCollectionAttribute, collection } = props;
  const [recommendNewProfile, setRecommendNewProfile] = React.useState(
    collection.attributes?.collection?.collectionConfig?.recommendNewProfile,
  );

  const toggleRecommendNewProfile = React.useCallback(() => {
    const newValue = !recommendNewProfile;
    setRecommendNewProfile(newValue);
    onSetCollectionAttribute(
      ["collectionConfig", "recommendNewProfile"],
      newValue,
    );
  }, [onSetCollectionAttribute, recommendNewProfile, setRecommendNewProfile]);

  return (
    <FlexLayout
      type="column"
      id="collection-settings-edit"
      className="collection-settings-edit"
    >
      <h4>{t("Options")}</h4>
      <p>
        {t(
          "The below settings can optionally be changed to customize this collection",
        )}
      </p>

      <Toggle
        id={"settings-recommend-new-profile"}
        onToggle={toggleRecommendNewProfile}
        checked={recommendNewProfile}
      >
        {t("Recommend new profile")}
        <More
          id="collection-settings-recommendnewprofile"
          name={t("Recommend new profile")}
        >
          {t(
            "If enabled, Vortex will recommend creating a new profile when installing this collection. If disabled, the collection will be installed into the currently active profile.",
          )}
        </More>
      </Toggle>
    </FlexLayout>
  );
};

const instructions = (props: IInstructionProps) => {
  const [t] = useTranslation([NAMESPACE, "common"]);
  const { collection, onSetCollectionAttribute } = props;

  const [input, setInput] = React.useState(
    collection.attributes?.["collection"]?.["installInstructions"],
  );
  const [placeholder, setPlaceholder] = React.useState(
    t(INSTRUCTIONS_PLACEHOLDER) as string,
  );
  const [hasChanged, setHasChanged] = React.useState(false);

  React.useEffect(() => {
    setInput(collection.attributes?.["collection"]?.["installInstructions"]);
  }, [collection]);

  const assignInstructions = React.useCallback(
    (evt: React.FormEvent<any>) => {
      setInput(evt.currentTarget.value);
      setHasChanged(true);
    },
    [setInput],
  );

  const saveInstructions = React.useCallback(() => {
    onSetCollectionAttribute(["installInstructions"], input);
    setHasChanged(false);
  }, [input]);

  return (
    <FlexLayout
      type="column"
      id="collection-instructions-edit"
      className="collection-instructions-edit"
    >
      <FlexLayout.Fixed className="collection-instructions-container">
        <h4>{t("Instructions")}</h4>
        <p>
          {t(
            "Instructions will be shown to the user before installation starts and can be reviewed in the Instructions tab. You can also add individual mod instructions in the Mods tab.",
          )}
        </p>
        <FormControl
          id="collection-instructions-area"
          componentClass="textarea"
          value={input}
          onChange={assignInstructions}
          placeholder={placeholder}
          onFocus={(e) => setPlaceholder("")}
          onBlur={(e) => setPlaceholder(t(INSTRUCTIONS_PLACEHOLDER))}
          rows={8}
        />
      </FlexLayout.Fixed>

      <FlexLayout.Fixed className="collection-instructions-buttons">
        <tooltip.Button
          disabled={!hasChanged}
          tooltip={t("Save Instructions")}
          onClick={saveInstructions}
        >
          {t("Save")}
        </tooltip.Button>
      </FlexLayout.Fixed>
    </FlexLayout>
  );
};

export default CollectionGeneralInfo;
