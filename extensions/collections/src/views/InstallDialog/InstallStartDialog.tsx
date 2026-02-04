import { DEFAULT_INSTRUCTIONS, NAMESPACE } from "../../constants";
import InstallDriver from "../../util/InstallDriver";

import CollectionThumbnail from "../CollectionTile";

import YouCuratedTag from "./YouCuratedThisTag";

import * as React from "react";
import { Button, Media } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import Select from "react-select";
import * as Redux from "redux";
import { generate as shortid } from "shortid";
import {
  actions,
  ComponentEx,
  FlexLayout,
  Modal,
  More,
  Toggle,
  types,
  util,
} from "vortex-api";
import ReactMarkdown from "react-markdown";

interface IInstallDialogProps {
  onHide: () => void;
  visible: boolean;
  driver: InstallDriver;
  onSwitchProfile: (profileId: string) => Promise<void>;
}

interface IConnectedProps {
  allProfiles: { [profileId: string]: types.IProfile };
  mods: { [modId: string]: types.IMod };
  isPremium: boolean;
  userInfo: { userId: number };
  nextProfileId: string;
  collectionsInstallWhileDownloading: boolean;
}

interface IActionProps {
  onAddProfile: (profile: types.IProfile) => void;
  onSetCollectionConcurrency: (enabled: boolean) => void;
  onSetModAttribute: (
    gameId: string,
    modId: string,
    key: string,
    value: any,
  ) => void;
  onSetModAttributes: (
    gameId: string,
    modId: string,
    attributes: { [key: string]: any },
  ) => void;
  onAddRule: (gameId: string, modId: string, rule: types.IModRule) => void;
  onRemoveRule: (gameId: string, modId: string, rule: types.IModRule) => void;
  onSetProfilesVisible: () => void;
}

type IProps = IInstallDialogProps & IConnectedProps & IActionProps;

interface IInstallDialogState {
  selectedProfile: string;
  confirmProfile: boolean;
  recommendedNewProfile: boolean;
}

function nop() {
  // nop
}

interface IInstallDialogSelectProfileProps {
  t: types.TFunction;
  profile: types.IProfile;
  selectedProfile: string;
  recommendedNewProfile: boolean;
  allProfiles: { [profileId: string]: types.IProfile };
  onSelectProfile: (value: { value: string; label: string }) => void;
}

function InstallDialogSelectProfile(props: IInstallDialogSelectProfileProps) {
  const {
    t,
    allProfiles,
    onSelectProfile,
    profile,
    selectedProfile,
    recommendedNewProfile,
  } = props;

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
          recommended: recommendedNewProfile
            ? t(" (Recommended by curator)")
            : "",
        },
      }),
    });

  return (
    <FlexLayout type="row" id="collections-profile-select">
      <FlexLayout.Fixed>
        {t("Install this collection to profile") + ":"}
      </FlexLayout.Fixed>
      <FlexLayout.Flex>
        <Select
          options={profileOptions}
          value={selectedProfile ?? profile.id}
          onChange={onSelectProfile}
          clearable={false}
        />
      </FlexLayout.Flex>
    </FlexLayout>
  );
}

interface IInstallDialogConfirmProfileProps {
  t: types.TFunction;
  collectionName: string;
  selectedProfile: types.IProfile;
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
  private mLastCollection: types.IMod;
  constructor(props: IProps) {
    super(props);

    this.initState({
      selectedProfile: undefined,
      confirmProfile: false,
      recommendedNewProfile: false,
    });

    if (props.driver !== undefined) {
      this.props.driver.onUpdate(() => this.forceUpdate());
    }
  }

  static getDerivedStateFromProps(props: IProps, state: IInstallDialogState) {
    if (
      !state.selectedProfile &&
      !!props.driver?.collection?.attributes?.recommendNewProfile
    ) {
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
        driver.onUpdate(() => this.forceUpdate());
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
      driver.collection?.attributes?.installInstructions ||
      t(DEFAULT_INSTRUCTIONS);

    // used to convert a \n into something that react-markdown can use to detect paragraphs properly
    installInstructions = installInstructions.replace(/\r?\n/g, "  \r\n");

    const game = util.getGame(profile.gameId);

    const ownCollection: boolean =
      userInfo?.userId !== undefined &&
      driver.collectionInfo?.user?.memberId === userInfo?.userId;
    const collectionName = util.renderModName(driver.collection);
    return (
      <Modal
        show={driver.collection !== undefined && driver.step === "query"}
        onHide={nop}
      >
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
                t={t}
                gameId={profile.gameId}
                collection={driver.collection}
                details={true}
                imageTime={42}
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
                  className="textarea-install-collection-instructions"
                  allowedElements={["p", "br", "a", "em", "strong"]}
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
              <More
                id="more-profile-instcollection"
                name={t("Profiles")}
                wikiId="profiles"
              >
                {util.getText("profile" as any, "profiles", t)}
              </More>
            </p>
          </FlexLayout>
          {this.state.confirmProfile && selectedProfile !== undefined ? (
            <InstallDialogConfirmProfile
              t={t}
              collectionName={collectionName}
              selectedProfile={
                selectedProfile === "__new"
                  ? undefined
                  : allProfiles[selectedProfile]
              }
            />
          ) : (
            <InstallDialogSelectProfile
              t={t}
              allProfiles={allProfiles}
              profile={profile}
              selectedProfile={selectedProfile}
              onSelectProfile={this.changeProfile}
              recommendedNewProfile={recommendedNewProfile}
            />
          )}
          <Toggle
            checked={this.props.collectionsInstallWhileDownloading}
            onToggle={this.props.onSetCollectionConcurrency}
          >
            {t("Install mods during collection downloads")}
          </Toggle>
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
    if (!!value) {
      this.nextState.selectedProfile = value.value;
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
        const { driver, onAddProfile, onSetProfilesVisible } = this.props;
        const { profile } = driver;

        const profileId = shortid();
        const name = util.renderModName(driver.collection);
        const newProfile = {
          id: profileId,
          gameId: profile.gameId,
          name,
          modState: {},
          lastActivated: 0,
        };
        onAddProfile(newProfile);
        onSetProfilesVisible();
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

    // Make sure the profiles are visible.
    this.props.onSetProfilesVisible();
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

function mapStateToProps(
  state: types.IState,
  ownProps: IInstallDialogProps,
): IConnectedProps {
  const { editCollectionId } = (state.session as any).collections;
  const gameMode = ownProps.driver?.profile?.gameId;

  const isPremium = util.getSafe(
    state,
    ["persistent", "nexus", "userInfo", "isPremium"],
    false,
  );
  const collectionsInstallWhileDownloading = util.getSafe(
    state,
    ["settings", "downloads", "collectionsInstallWhileDownloading"],
    true,
  );
  const { userInfo } = state.persistent["nexus"] ?? {};
  return {
    allProfiles: state.persistent.profiles,
    mods:
      editCollectionId !== undefined
        ? state.persistent.mods[gameMode]
        : emptyObject,
    isPremium,
    userInfo,
    nextProfileId: state.settings.profiles.nextProfileId,
    collectionsInstallWhileDownloading,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onSetModAttribute: (
      gameId: string,
      modId: string,
      key: string,
      value: any,
    ) => dispatch(actions.setModAttribute(gameId, modId, key, value)),
    onSetModAttributes: (
      gameId: string,
      modId: string,
      attributes: { [key: string]: any },
    ) => dispatch(actions.setModAttributes(gameId, modId, attributes)),
    onAddRule: (gameId: string, modId: string, rule: types.IModRule) =>
      dispatch(actions.addModRule(gameId, modId, rule)),
    onRemoveRule: (gameId: string, modId: string, rule: types.IModRule) =>
      dispatch(actions.removeModRule(gameId, modId, rule)),
    onAddProfile: (profile: types.IProfile) =>
      dispatch(actions.setProfile(profile)),
    onSetProfilesVisible: () => dispatch(actions.setProfilesVisible(true)),
    onSetCollectionConcurrency: (enabled: boolean) =>
      dispatch(actions.setCollectionConcurrency(enabled)),
  };
}

export default withTranslation(["common", NAMESPACE])(
  connect(
    mapStateToProps,
    mapDispatchToProps,
  )(React.memo(InstallDialog)) as any,
) as React.ComponentClass<IInstallDialogProps>;
