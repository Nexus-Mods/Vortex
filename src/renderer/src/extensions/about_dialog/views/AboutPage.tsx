import type { Serialize } from "@cyclonedx/cyclonedx-library";
type BOM = Serialize.JSON.Types.Normalized.Bom;
type BOMComponent = NonNullable<BOM["components"]>[number];
type BOMLicense = NonNullable<BOMComponent["licenses"]>[number];

import * as fs from "fs";
import * as path from "path";

import { getErrorMessageOrDefault } from "@vortex/shared";
import I18next from "i18next";
import * as React from "react";
import { Image, Media, Panel } from "react-bootstrap";
import ReactMarkdown from "react-markdown";

import { ComponentEx, translate } from "../../../controls/ComponentEx";
import More from "../../../controls/More";
import { getApplication } from "../../../util/application";
import getVortexPath from "../../../util/getVortexPath";
import github from "../../../util/github";
import { log } from "../../../util/log";
import opn from "../../../util/opn";
import MainPage from "../../../views/MainPage";

interface IBomModule {
  key: string;
  name: string;
  version: string;
  licenseLabel: string;
  licenseUrl: string | undefined;
}

function licenseInfo(lic: BOMLicense): { label: string; url: string | undefined } {
  if ("expression" in lic) {
    return { label: lic.expression, url: undefined };
  }
  if ("id" in lic.license) {
    return {
      label: lic.license.id,
      url: lic.license.url ?? `https://spdx.org/licenses/${lic.license.id}.html`,
    };
  }
  return { label: lic.license.name, url: lic.license.url };
}

function bomKey(c: BOMComponent, idx: number): string {
  return c["bom-ref"] ?? `${c.name}@${c.version ?? ""}#${idx}`;
}

let moduleList: IBomModule[] = [];
let ownLicenseText: string = "";

try {
  const bomPath = path.join(getVortexPath("assets"), "bom.json");
  const bom: BOM = JSON.parse(fs.readFileSync(bomPath, "utf8"));
  moduleList = (bom.components ?? []).map((c, idx) => {
    const lic = c.licenses?.[0];
    const info = lic !== undefined ? licenseInfo(lic) : { label: "", url: undefined };
    return {
      key: bomKey(c, idx),
      name: c.name,
      version: c.version ?? "",
      licenseLabel: info.label,
      licenseUrl: info.url,
    };
  });
  ownLicenseText = fs
    .readFileSync(path.join(getVortexPath("package_unpacked"), "LICENSE.md"))
    .toString();
} catch (err) {
  // should we display this in the ui? It shouldn't ever happen in the release and 99% of users
  // won't care anyway.
  log("error", "failed to read license files", getErrorMessageOrDefault(err));
}

export interface IBaseProps {
  onHide: () => void;
}

interface IComponentState {
  ownLicense: boolean;
  releaseDate: Date;
  changelog: string;
  tag: string;
}

type IProps = IBaseProps;

class AboutPage extends ComponentEx<IProps, IComponentState> {
  private mMounted: boolean;
  private mVersion: string;

  constructor(props) {
    super(props);
    this.mMounted = false;
    this.initState({
      ownLicense: false,
      releaseDate: undefined,
      changelog: undefined,
      tag: undefined,
    });

    this.mVersion = getApplication().version;
  }

  public componentDidMount() {
    this.mMounted = true;

    // no longer have to ignore if development now that we have tag information as part of the package.json version
    // this code hasn't changed, but we only show the date now next to version and not the changelog or tag

    github
      .releases()
      .then((releases) => {
        if (this.mMounted) {
          try {
            const thisVersion = "v" + this.mVersion;
            const thisRelease = releases.find((rel) => rel.tag_name === thisVersion);
            if (thisRelease !== undefined) {
              this.nextState.releaseDate = new Date(thisRelease.published_at);
              this.nextState.changelog = thisRelease.body;
              this.nextState.tag = thisRelease.prerelease ? "Beta" : undefined;
            } else {
              // no release found on github, so it's packaged but not distributed properly yet
              // this could be on the mystery Next repo for testing
              this.nextState.tag = "Preview";
            }
          } catch (err) {
            log("warn", "Failed to parse release info", getErrorMessageOrDefault(err));
          }
        }
      })
      .catch((err) => {
        log("warn", "Failed to look up current Vortex releases", getErrorMessageOrDefault(err));
      });
  }

  public componentWillUnmount() {
    this.mMounted = false;
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { changelog, ownLicense, tag, releaseDate } = this.state;

    const imgPath = path.resolve(getVortexPath("assets"), "images", "vortex.png");

    let body = null;

    const licenseBox = ownLicense ? (
      <ReactMarkdown className="license-text-own" disallowedElements={["link"]}>
        {ownLicenseText}
      </ReactMarkdown>
    ) : (
      <div className="third-party-box">
        <div>
          <h4>{t("Third-party libraries")}</h4>
        </div>
        <div className="about-panel">{moduleList.map(this.renderModule)}</div>
      </div>
    );

    const PanelX: any = Panel;
    body = (
      <MainPage.Body id="about-dialog">
        <Panel>
          <PanelX.Body>
            <Media style={{ marginBottom: 5, display: "block" }}>
              <Media.Left>
                <Image className="vortex-logo" src={imgPath} />
              </Media.Left>
              <Media.Body>
                <h2 className="media-heading">
                  Vortex {this.mVersion}{" "}
                  {releaseDate !== undefined
                    ? `(${releaseDate.toLocaleDateString(I18next.language)})`
                    : ""}
                </h2>
                <p>&#169;2026 Black Tree Gaming Ltd.</p>
                <p>
                  {t("Released under")} <a onClick={this.showOwnLicense}>GPL-3</a> {t("License")}
                </p>
              </Media.Body>
            </Media>
            <p>
              <strong>Electron</strong> {(process.versions as any).electron}
            </p>
            <p>
              <strong>Node</strong> {process.versions.node}
            </p>
            <p>
              <strong>Chrome</strong> {(process.versions as any).chrome}
            </p>
            {licenseBox}
          </PanelX.Body>
        </Panel>
      </MainPage.Body>
    );

    return <MainPage>{body}</MainPage>;
  }

  private showOwnLicense = () => {
    this.nextState.ownLicense = !this.state.ownLicense;
  };

  private openLicense = (evt: React.MouseEvent<HTMLAnchorElement>) => {
    evt.preventDefault();
    const url = evt.currentTarget.getAttribute("data-url");
    if (url !== null) {
      opn(url).catch(() => null);
    }
  };

  private renderModule = (mod: IBomModule) => {
    const { t } = this.props;
    const labelText = `${mod.licenseLabel} ${t("License")}`;
    const label =
      mod.licenseUrl !== undefined ? (
        <a href={mod.licenseUrl} data-url={mod.licenseUrl} onClick={this.openLicense}>
          {labelText}
        </a>
      ) : (
        labelText
      );
    return (
      <div key={mod.key}>
        <h5 style={{ display: "inline" }}>
          {mod.name} ({mod.version})
        </h5>{" "}
        <h6 style={{ display: "inline" }}>
          <sup>{label}</sup>
        </h6>
      </div>
    );
  };
}

export default translate(["common"])(AboutPage) as React.ComponentClass<IBaseProps>;
