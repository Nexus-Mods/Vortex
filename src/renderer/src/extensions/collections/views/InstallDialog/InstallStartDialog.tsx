import * as React from "react";
import { Button, Media } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { connect } from "react-redux";
import Select from "react-select";
import type * as Redux from "redux";
import { generate as shortid } from "shortid";

import * as actions from "../../../../actions";
import { ComponentEx } from "../../../../controls/ComponentEx";
import FlexLayout from "../../../../controls/FlexLayout";
import Modal from "../../../../controls/Modal";
import More from "../../../../controls/More";
import Toggle from "../../../../controls/Toggle";
import { getGame } from "../../../../extensions/gamemode_management/util/getGame";
import type { IMod, IModRule } from "../../../../extensions/mod_management/types/IMod";
import renderModName from "../../../../extensions/mod_management/util/modName";
import getTextProfileManagement from "../../../../extensions/profile_management/texts";
import type { IProfile } from "../../../../extensions/profile_management/types/IProfile";
import type { IState } from "../../../../types/IState";
import type { TFunction } from "../../../../util/i18n";
import { getSafe } from "../../../../util/storeHelper";
import { batchDispatch } from "../../../../util/util";
import { DEFAULT_INSTRUCTIONS, NAMESPACE } from "../../constants";
import { isGamebryoGame } from "../../util/gameSupport";
import type InstallDriver from "../../util/InstallDriver";
import CollectionThumbnail from "../CollectionTile";
import YouCuratedTag from "./YouCuratedThisTag";

interface IInstallDialogProps {
  onHide: () => void;
  visible: boolean;
  driver: InstallDriver;
  onSwitchProfile: (profileId: string) => Promise<void>;
}

interface IConnectedProps {
  allProfiles: { [profileId: string]: IProfile };
  mods: { [modId: string]: IMod };
  isPremium: boolean;
  userInfo: { userId: number };
  nextProfileId: string;
  collectionsInstallWhileDownloading: boolean;
  useModernLayout: boolean;
}

interface IActionProps {
  onAddProfile: (profile: IProfile) => void;
  onSetCollectionConcurrency: (enabled: boolean) => void;
  onSetModAttribute: (gameId: string, modId: string, key: string, value: any) => void;
  onSetModAttributes: (gameId: string, modId: string, attributes: { [key: string]: any }) => void;
  onAddRule: (gameId: string, modId: string, rule: IModRule) => void;
  onRemoveRule: (gameId: string, modId: string, rule: IModRule) => void;
  onSetProfilesVisible: () => void;
  onShowProfilesPage: (useModernLayout: boolean) => void;
}

type IProps = IInstallDialogProps & IConnectedProps & IActionProps;

interface IInstallDialogState {
  selectedProfile: string;
  confirmProfile: boolean;
  recommendedNewProfile: boolean;
  skipPluginRules: boolean;
}

function nop() {
  // nop
}

interface IInstallDialogSelectProfileProps {
  t: TFunction;
  profile: IProfile;
  selectedProfile: string;
  recommendedNewProfile: boolean;
  allProfiles: { [profileId: string]: IProfile };
  onSelectProfile: (value: { value: string; label: string }) => void;
}

function InstallDialogSelectProfile(props: IInstallDialogSelectProfileProps) {
  const { t, allProfiles, onSelectProfile, profile, selectedProfile, recommendedNewProfile } =
    props;

  const profileOptions = Object.keys(allProfiles)
    .filter((profId) => allProfiles[profId].gameId === profile.gameId)
    .map((profId) => ({
      value: profId,
      label:
        profId === profile.id
          ? t("{{name}} (Current)", { replace: { name: profile.name } })
          : allProfiles[profId].name,
    }))
    .concat({
      value: "__new",
      label: t("Create new profile{{recommended}}", {
        replace: {
          recommended: recommendedNewProfile ? t(" (Recommended by curator)") : "",
        },
      }),
    });

  return (
    <FlexLayout id="collections-profile-select" type="row">
      <FlexLayout.Fixed>{t("Install this collection to profile") + ":"}</FlexLayout.Fixed>

      <FlexLayout.Flex>
        <Select
          clearable={false}
          options={profileOptions}
          value={selectedProfile ?? profile.id}
          onChange={onSelectProfile}
        />
      </FlexLayout.Flex>
    </FlexLayout>
  );
}

interface IInstallDialogConfirmProfileProps {
  t: TFunction;
  collectionName: string;
  selectedProfile: IProfile;
}

function InstallDialogConfirmProfile(props: IInstallDialogConfirmProfileProps) {
  const { t, collectionName, selectedProfile } = props;

  const profileName = selectedProfile?.name ?? collectionName;

  return (
    <>
      <p>
        {t("Currently installing to profile: {{profileName}}", {
          replace: {
            profileName,
          },
        })}
      </p>

      <p>{t("Do you want to switch to this profile?")}</p>
    </>
  );
}

/**
 * Installation prompt that shows up when the user imports a collection
 */
class InstallDialog extends ComponentEx<IProps, IInstallDialogState> {
  private mLastCollection: IMod;
  private mUnsubscribeDriver?: () => void;
  constructor(props: IProps) {
    super(props);

    this.initState({
      selectedProfile: undefined,
      confirmProfile: false,
      recommendedNewProfile: false,
      skipPluginRules: false,
    });
  }

  public componentDidMount() {
    // subscribe here, not in the constructor: a constructor subscription can fire forceUpdate
    // before this instance mounts (or on an instance that never mounts at all)
    if (this.props.driver !== undefined) {
      this.mUnsubscribeDriver = this.props.driver.onUpdate(() => this.forceUpdate());
    }
  }

  public componentWillUnmount() {
    this.mUnsubscribeDriver?.();
    this.mUnsubscribeDriver = undefined;
  }

  static getDerivedStateFromProps(props: IProps, state: IInstallDialogState) {
    if (!state.selectedProfile && !!props.driver?.collection?.attributes?.recommendNewProfile) {
      return {
        recommendedNewProfile: true,
        selectedProfile: "__new",
      };
    }
    return null;
  }

  public componentDidUpdate(prevProps: IProps) {
    const { driver } = this.props;
    if (driver !== undefined) {
      if (driver !== prevProps.driver) {
        // drop the old driver's hook before subscribing to the new one, so a stale handler
        // doesn't linger and forceUpdate after the driver swap
        this.mUnsubscribeDriver?.();
        this.mUnsubscribeDriver = driver.onUpdate(() => this.forceUpdate());
      }

      if (driver.collection !== this.mLastCollection) {
        this.nextState.confirmProfile = false;
        this.nextState.selectedProfile = undefined;
        this.mLastCollection = driver.collection;
      }
    }
  }

  public render(): React.ReactNode {
    const { t, driver, allProfiles, nextProfileId, userInfo } = this.props;
    const { selectedProfile, recommendedNewProfile } = this.state;

    if (driver?.profile === undefined) {
      return null;
    }

    const { profile } = driver;

    if (nextProfileId !== profile.id) {
      return null;
    }

    let installInstructions =
      driver.collection?.attributes?.installInstructions || t(DEFAULT_INSTRUCTIONS);

    // used to convert a \n into something that react-markdown can use to detect paragraphs properly
    installInstructions = installInstructions.replace(/\r?\n/g, "  \r\n");

    const game = getGame(profile.gameId);

    const ownCollection: boolean =
      userInfo?.userId !== undefined && driver.collectionInfo?.user?.memberId === userInfo?.userId;
    const collectionName = renderModName(driver.collection);
    return (
      <Modal show={driver.collection !== undefined && driver.step === "query"} onHide={nop}>
        <Modal.Header>
          <Modal.Title>
            {t("{{gameName}} collection added", {
              replace: { gameName: game.name },
            })}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Media>
            <Media.Left>
              <CollectionThumbnail
                collection={driver.collection}
                details={true}
                gameId={profile.gameId}
                imageTime={42}
                t={t}
              />
            </Media.Left>

            <Media.Right style={{ width: "100%", display: "flex" }}>
              <Media.Body>
                <Media.Heading>Collection instructions</Media.Heading>

                <p className="collections-instructions-canbereviewed">
                  Instructions can be reviewed during installation.
                </p>

                {ownCollection ? <YouCuratedTag t={t} /> : null}

                <ReactMarkdown
                  allowedElements={["p", "br", "a", "em", "strong"]}
                  className="textarea-install-collection-instructions"
                  unwrapDisallowed={true}
                >
                  {installInstructions}
                </ReactMarkdown>
              </Media.Body>
            </Media.Right>
          </Media>

          <FlexLayout type="row">
            <p>
              {t(
                "Profiles allow you to have multiple mod set-ups for a game at once and quickly switch between them.",
              )}

              <More id="more-profile-instcollection" name={t("Profiles")} wikiId="profiles">
                {getTextProfileManagement("profiles", t)}
              </More>
            </p>
          </FlexLayout>

          {this.state.confirmProfile && selectedProfile !== undefined ? (
            <InstallDialogConfirmProfile
              collectionName={collectionName}
              selectedProfile={
                selectedProfile === "__new" ? undefined : allProfiles[selectedProfile]
              }
              t={t}
            />
          ) : (
            <InstallDialogSelectProfile
              allProfiles={allProfiles}
              profile={profile}
              recommendedNewProfile={recommendedNewProfile}
              selectedProfile={selectedProfile}
              t={t}
              onSelectProfile={this.changeProfile}
            />
          )}

          <Toggle
            checked={this.props.collectionsInstallWhileDownloading}
            onToggle={this.props.onSetCollectionConcurrency}
          >
            {t("Install mods during collection downloads")}
          </Toggle>

          {isGamebryoGame(profile.gameId) ? (
            <Toggle checked={this.state.skipPluginRules} onToggle={this.toggleSkipPluginRules}>
              {t("Skip plugin rules")}

              <More id="install-skip-plugin-rules" name={t("Skip plugin rules")}>
                {t(
                  "If enabled, custom LOOT plugin rules and groups included in this collection " +
                    "will not be applied. This can help prevent inherited plugin rules from " +
                    "causing conflicts.",
                )}
              </More>
            </Toggle>
          ) : null}
        </Modal.Body>

        <Modal.Footer>
          {this.state.confirmProfile ? (
            <>
              <Button onClick={this.next}>{t("No")}</Button>

              <Button onClick={this.switchProfile}>{t("Yes")}</Button>
            </>
          ) : (
            <>
              <Button onClick={this.cancel}>{t("Later")}</Button>

              <Button onClick={this.next}>{t("Install Now")}</Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
    );
  }

  private changeProfile = (value: { value: string; label: string }) => {
    if (value) {
      this.nextState.selectedProfile = value.value;
    }
  };

  private toggleSkipPluginRules = (checked: boolean) => {
    this.nextState.skipPluginRules = checked;
    const { driver, onSetModAttribute } = this.props;
    if (driver?.collection !== undefined) {
      onSetModAttribute(driver.profile.gameId, driver.collection.id, "skipPluginRules", checked);
    }
  };

  private cancel = () => {
    this.props.driver.cancel();
  };

  private next = () => {
    if (
      !this.state.confirmProfile &&
      this.state.selectedProfile !== undefined &&
      this.state.selectedProfile !== this.props.driver?.profile?.id
    ) {
      if (this.state.selectedProfile === "__new") {
        const { driver, onAddProfile, onShowProfilesPage, useModernLayout } = this.props;
        const { profile } = driver;

        const profileId = shortid();
        const name = renderModName(driver.collection);
        const newProfile = {
          id: profileId,
          gameId: profile.gameId,
          name,
          modState: {},
          lastActivated: 0,
        };
        onAddProfile(newProfile);
        onShowProfilesPage(useModernLayout);
        this.nextState.selectedProfile = profileId;
      }
      this.nextState.confirmProfile = true;
    } else {
      this.startInstall();
    }
  };

  private switchProfile = async () => {
    const { selectedProfile } = this.state;
    await this.props.onSwitchProfile(selectedProfile);

    // Make sure the profiles page is visible and navigate to it.
    this.props.onShowProfilesPage(this.props.useModernLayout);
    this.startInstall();
  };

  private startInstall() {
    const { allProfiles, driver } = this.props;
    const { selectedProfile } = this.state;

    const { profile } = driver;

    if (selectedProfile !== undefined && selectedProfile !== profile.id) {
      driver.profile = allProfiles[selectedProfile];
    }

    driver.continue();
  }
}

const emptyObject = {};

function mapStateToProps(state: IState, ownProps: IInstallDialogProps): IConnectedProps {
  const { editCollectionId } = (state.session as any).collections;
  const gameMode = ownProps.driver?.profile?.gameId;

  const isPremium = getSafe(state, ["persistent", "nexus", "userInfo", "isPremium"], false);
  const collectionsInstallWhileDownloading = getSafe(
    state,
    ["settings", "downloads", "collectionsInstallWhileDownloading"],
    true,
  );
  const { userInfo } = state.persistent["nexus"] ?? {};
  return {
    allProfiles: state.persistent.profiles,
    mods: editCollectionId !== undefined ? state.persistent.mods[gameMode] : emptyObject,
    isPremium,
    userInfo,
    nextProfileId: state.settings.profiles.nextProfileId,
    collectionsInstallWhileDownloading,
    useModernLayout: state.settings.window.useModernLayout ?? true,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onSetModAttribute: (gameId: string, modId: string, key: string, value: any) =>
      dispatch(actions.setModAttribute(gameId, modId, key, value)),
    onSetModAttributes: (gameId: string, modId: string, attributes: { [key: string]: any }) =>
      dispatch(actions.setModAttributes(gameId, modId, attributes)),
    onAddRule: (gameId: string, modId: string, rule: IModRule) =>
      dispatch(actions.addModRule(gameId, modId, rule)),
    onRemoveRule: (gameId: string, modId: string, rule: IModRule) =>
      dispatch(actions.removeModRule(gameId, modId, rule)),
    onAddProfile: (profile: IProfile) => dispatch(actions.setProfile(profile)),
    onSetProfilesVisible: () => dispatch(actions.setProfilesVisible(true)),
    onShowProfilesPage: (useModernLayout: boolean) =>
      batchDispatch(dispatch, [
        actions.setProfilesVisible(true),
        actions.setOpenMainPage(useModernLayout ? "game-profiles" : "Profiles", false),
      ]),
    onSetCollectionConcurrency: (enabled: boolean) =>
      dispatch(actions.setCollectionConcurrency(enabled)),
  };
}

export default withTranslation(["common", NAMESPACE])(
  connect(mapStateToProps, mapDispatchToProps)(React.memo(InstallDialog)) as any,
) as React.ComponentClass<IInstallDialogProps>;
