import update from "immutability-helper";
import * as React from "react";
import { FormControl, ListGroupItem, Panel } from "react-bootstrap";
import Select from "react-select";

import { ComponentEx } from "../../../controls/ComponentEx";
import Toggle from "../../../controls/Toggle";
import { Button } from "../../../controls/TooltipControls";
import { getSafe, setSafe } from "../../../util/storeHelper";
import type { IProfile } from "../types/IProfile";
import type { IProfileFeature, IProfileFeatureChoice } from "../types/IProfileFeature";

const MIN_PROFILE_NAME_LENGTH = 3;
const MAX_PROFILE_NAME_LENGTH = 64;

export interface IEditState {
  edit: IProfile;
  features: IProfileFeature[];
  choices: Record<string, IProfileFeatureChoice[]>;
}

export interface IEditProps {
  profileId: string;
  gameId: string;
  profile?: IProfile;
  features: IProfileFeature[];
  onSetFeature: (profileId: string, featureId: string, value: any) => void;
  onSaveEdit: (profile: IProfile) => void;
  onCancelEdit: () => void;
}

/**
 * list element displayed when editing an item
 *
 * @class ProfileEdit
 */
class ProfileEdit extends ComponentEx<IEditProps, IEditState> {
  constructor(props: IEditProps) {
    super(props);
    const features = props.features.filter((feature) => feature.supported());

    this.state =
      props.profile !== undefined
        ? {
            edit: { ...props.profile },
            features,
            choices: {},
          }
        : {
            edit: {
              id: props.profileId,
              gameId: props.gameId,
              modState: {},
              name: "",
              lastActivated: 0,
            },
            features,
            choices: {},
          };
  }

  public componentDidMount() {
    void this.loadChoices();
  }

  public UNSAFE_componentWillReceiveProps(newProps: IEditProps) {
    if (this.props.gameId !== newProps.gameId) {
      this.setState(
        update(this.state, {
          features: {
            $set: newProps.features.filter((feature) => feature.supported()),
          },
        }),
      );
      void this.loadChoices(newProps);
    }
  }

  public render(): JSX.Element {
    const { t, onCancelEdit, profile, profileId } = this.props;
    const { edit, features } = this.state;
    const nameValid = edit.name.trim().length >= MIN_PROFILE_NAME_LENGTH;
    const inputControl = (
      <FormControl
        autoFocus={true}
        style={{ flexGrow: 1 }}
        type="text"
        value={edit.name}
        maxLength={MAX_PROFILE_NAME_LENGTH}
        onChange={this.changeEditName}
        onKeyPress={this.handleKeypress}
      />
    );

    return (
      <Panel className="profile-edit-panel">
        <Panel.Body>
          {profile === undefined ? t("Create a new profile") : t("Edit profile")}

          <ListGroupItem key={profileId}>
            <div className="inline-form">
              {inputControl}

              <Button
                bsStyle="primary"
                disabled={!nameValid}
                id="__accept"
                tooltip={
                  nameValid
                    ? t("Accept")
                    : t("Profile name must be at least {{num}} characters", {
                        num: MIN_PROFILE_NAME_LENGTH,
                      })
                }
                onClick={this.saveEdit}
              >
                {t("Save")}
              </Button>

              <Button
                bsStyle="secondary"
                id="__cancel"
                tooltip={t("Cancel")}
                onClick={onCancelEdit}
              >
                {t("Cancel")}
              </Button>
            </div>

            <div>{features.map(this.renderFeature)}</div>
          </ListGroupItem>
        </Panel.Body>
      </Panel>
    );
  }

  private renderFeature = (feature: IProfileFeature) => {
    const { t } = this.props;
    const { choices, edit } = this.state;
    if (feature.type === "boolean") {
      return (
        <Toggle
          checked={getSafe(edit, ["features", feature.id], false)}
          dataId={feature.id}
          key={feature.id}
          onToggle={this.toggleCheckbox}
        >
          {t(feature.description)}
        </Toggle>
      );
    } else if (feature.type === "text") {
      return (
        <FormControl
          componentClass="textarea"
          data-id={feature.id}
          key={feature.id}
          placeholder={t(feature.description)}
          value={getSafe(edit, ["features", feature.id], undefined) ?? ""}
          onChange={this.assignString}
        />
      );
    } else if (feature.type === "select") {
      const options = choices[feature.id] ?? [];
      const selectedValue = getSafe(edit, ["features", feature.id], "store");
      return (
        <div className="profile-feature-select" key={feature.id}>
          <label>{t(feature.label)}:</label>
          <Select
            clearable={false}
            disabled={options.length === 0}
            options={options}
            value={selectedValue}
            onChange={(choice: IProfileFeatureChoice) =>
              this.assignChoice(feature.id, choice?.value ?? "store")
            }
          />
        </div>
      );
    }
  };

  private loadChoices = async (props: IEditProps = this.props) => {
    const profile = this.state.edit;
    const entries = await Promise.all(
      this.state.features
        .filter((feature) => feature.type === "select" && feature.choices !== undefined)
        .map(async (feature) => [feature.id, await feature.choices(profile)] as const),
    );
    if (props === this.props) {
      this.setState({ choices: Object.fromEntries(entries) });
    }
  };

  private assignChoice = (featureId: string, value: string) => {
    this.setState(setSafe(this.state, ["edit", "features", featureId], value));
  };

  private toggleCheckbox = (ticked: boolean, dataId: string) => {
    this.setState(setSafe(this.state, ["edit", "features", dataId], ticked));
  };

  private assignString = (evt: React.FormEvent<any>) => {
    const dataId = evt.currentTarget.getAttribute("data-id");
    const value = evt.currentTarget.value;
    this.setState(setSafe(this.state, ["edit", "features", dataId], value));
  };

  private handleKeypress = (evt: React.KeyboardEvent<any>) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      if (this.state.edit.name.trim().length >= MIN_PROFILE_NAME_LENGTH) {
        this.saveEdit();
      }
    }
  };

  private saveEdit = () => {
    this.props.onSaveEdit(this.state.edit);
  };

  private changeEditName = (evt) => {
    this.setState(
      update(this.state, {
        edit: {
          name: { $set: evt.target.value },
        },
      }),
    );
  };
}

export default ProfileEdit;
