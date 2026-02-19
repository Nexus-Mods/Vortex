import { TFunction } from "i18next";
import * as React from "react";
import {
  Button,
  Col,
  ControlLabel,
  Form,
  FormControl,
  FormGroup,
  Grid,
  OverlayTrigger,
  Panel,
  Popover,
  Row,
} from "react-bootstrap";
import { ChromePicker } from "react-color";
import { ComponentEx, More, Toggle } from "vortex-api";

interface IColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface IColorProps {
  name: string;
  color: IColor;
  disabled: boolean;
  onUpdateColor: (name: string, colorHex: string) => void;
}

function toHex(num: number): string {
  let res = num.toString(16);
  if (num < 16) {
    res = "0" + res;
  }
  return res;
}

function colorToHex(color: IColor): string {
  return "#" + toHex(color.r) + toHex(color.g) + toHex(color.b);
}

function colorFromHex(colorHex: string): IColor {
  const parts = colorHex.substr(1).match(/.{2}/g);
  return {
    r: parseInt(parts[0], 16),
    g: parseInt(parts[1], 16),
    b: parseInt(parts[2], 16),
  };
}

function renderColorBox(color: IColor): JSX.Element {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        display: "inline-block",
        border: "solid 1px gray",
        marginLeft: 4,
        backgroundColor: colorToHex(color),
      }}
    />
  );
}

class ColorPreview extends React.Component<IColorProps, never> {
  public render(): JSX.Element {
    const { color, disabled } = this.props;
    const popover = (
      <Popover id="color-preview">
        <ChromePicker
          color={color}
          disableAlpha={true}
          onChangeComplete={this.onUpdate}
        />
      </Popover>
    );

    const content = (
      <div>
        {colorToHex(color)}
        {renderColorBox(color)}
      </div>
    );

    return disabled ? (
      content
    ) : (
      <OverlayTrigger
        trigger="click"
        rootClose
        placement="top"
        overlay={popover}
      >
        {content}
      </OverlayTrigger>
    );
  }

  private onUpdate = (color: any) => {
    const { name, onUpdateColor } = this.props;
    onUpdateColor(name, color.hex);
  };
}

interface IColorEntry {
  name: string;
  value: string;
}

export interface IBaseProps {
  t: TFunction;
  themeName: string;
  theme: { [name: string]: string };
  disabled: boolean;
  onApply: (updatedTheme: { [name: string]: string }) => void;
  onEditStyle: (themeName: string) => void;
  getAvailableFonts: () => Promise<string[]>;
}

type IProps = IBaseProps;

const colorDefaults: IColorEntry[] = [
  { name: "brand-primary", value: "#C87B28" },
  { name: "brand-highlight", value: "#1D4ED8" },
  { name: "brand-success", value: "#166534" },
  { name: "brand-info", value: "#1D4ED8" },
  { name: "brand-warning", value: "#FACC15" },
  { name: "brand-danger", value: "#991B1B" },
  { name: "brand-bg", value: "#18181B" },
  { name: "brand-menu", value: "#27272A" },
  { name: "brand-secondary", value: "#C87B28" },
  { name: "brand-clickable", value: "#C87B28" },
  { name: "text-color", value: "#F4F4F5" },
  { name: "text-color-disabled", value: "#898994" },
  { name: "link-color", value: "#C87B28" },
];

interface IComponentState {
  fontFamily: string;
  fontFamilyHeadings: string;
  fontSize: number;
  hidpiScale: number;
  colors: { [key: string]: string };
  margin: number;
  dashletHeight: number;
  titlebarRows: number;
  dark: boolean;

  availableFonts: string[];
}

const defaultTheme = {
  colors: {},
  fontSize: 12,
  fontFamily: "Inter",
  fontFamilyHeadings: "Inter",
  hidpiScale: 100,
  margin: 24,
  dashletHeight: 120,
  titlebarRows: 2,
  dark: true,
};

const standardFonts: string[] = [
  "Inter",
  "Roboto",
  "Montserrat",
  "BebasNeue",
  "sans-serif",
  "serif",
  "Arial",
  "Courier New",
  "Georgia",
  "Impact",
  "Marlett",
  "Monaco",
  "Tahoma",
  "Times New Roman",
  "Verdana",
];

class ThemeEditor extends ComponentEx<IProps, IComponentState> {
  private static BUCKETS = 3;

  constructor(props: IProps) {
    super(props);

    this.initState({
      ...defaultTheme,
      availableFonts: standardFonts,
    });
  }

  public componentDidMount() {
    this.setColors(this.props.theme);
    this.setFontSize(this.props.theme);
    this.setHiDPIScale(this.props.theme);
    this.setFontFamily(this.props.theme);
    this.setFontFamilyHeadings(this.props.theme);
    this.setMargin(this.props.theme);
    this.setDashletHeight(this.props.theme);
    this.setDark(this.props.theme);
    this.setTitlebarRows(this.props.theme);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (newProps.theme !== this.props.theme) {
      this.setColors(newProps.theme);
      this.setFontSize(newProps.theme);
      this.setHiDPIScale(newProps.theme);
      this.setFontFamily(newProps.theme);
      this.setFontFamilyHeadings(newProps.theme);
      this.setMargin(newProps.theme);
      this.setDashletHeight(newProps.theme);
      this.setDark(newProps.theme);
      this.setTitlebarRows(this.props.theme);
    }
  }

  public render(): JSX.Element {
    const { t, disabled } = this.props;
    const {
      colors,
      dark,
      dashletHeight,
      fontFamily,
      fontFamilyHeadings,
      fontSize,
      margin,
      titlebarRows,
    } = this.state;

    const availableFonts = this.state.availableFonts.slice(0);
    if (!availableFonts.includes(fontFamily)) {
      availableFonts.push(fontFamily);
    }

    const buckets: IColorEntry[][] = colorDefaults.reduce(
      (prev, value, idx) => {
        if (idx < ThemeEditor.BUCKETS) {
          prev[idx % ThemeEditor.BUCKETS] = [];
        }
        prev[idx % ThemeEditor.BUCKETS].push(value);
        return prev;
      },
      new Array(ThemeEditor.BUCKETS),
    );
    return (
      <div>
        <Form disabled={disabled} horizontal>
          <FormGroup>
            <Col sm={4}>
              <ControlLabel>
                {t("Font Size:")} {fontSize}
              </ControlLabel>
            </Col>
            <Col sm={8}>
              <FormControl
                type="range"
                value={fontSize}
                min={8}
                max={24}
                onChange={this.onChangeFontSize}
                disabled={disabled}
              />
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={4}>
              <ControlLabel>{t("Margins:")}</ControlLabel>
            </Col>
            <Col sm={8}>
              <FormControl
                type="range"
                value={margin}
                min={0}
                max={80}
                onChange={this.onChangeMargin}
                disabled={disabled}
              />
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={4}>
              <ControlLabel>{t("Font Family:")}</ControlLabel>
            </Col>
            <Col sm={4}>
              <FormControl
                componentClass="select"
                onChange={this.onChangeFontFamily}
                value={fontFamily}
                disabled={disabled}
              >
                {availableFonts.map(this.renderFontOption)}
              </FormControl>
            </Col>
            <Col sm={4}>
              <Button onClick={this.readFont}>{t("Read system fonts")}</Button>
              <More id="more-system-fonts" name={t("System Fonts")}>
                {t(
                  "Makes all system fonts installed on the system available in the Font dropdowns. " +
                    "This function seems to cause Vortex to crash for a very small number " +
                    "of users and we have not been able to identify what sets the " +
                    "affected systems apart yet.",
                )}
              </More>
            </Col>
          </FormGroup>
          <FormGroup>
            <Col smOffset={4} sm={8}>
              <FormControl.Static
                style={{ fontFamily, fontSize: fontSize.toString() + "px" }}
              >
                {t("The quick brown fox jumps over the lazy dog")}
              </FormControl.Static>
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={4}>
              <ControlLabel>{t("Font Family (Headings):")}</ControlLabel>
            </Col>
            <Col sm={8}>
              <FormControl
                componentClass="select"
                onChange={this.onChangeFontFamilyHeadings}
                value={fontFamilyHeadings}
                disabled={disabled}
              >
                {availableFonts.map(this.renderFontOption)}
              </FormControl>
            </Col>
          </FormGroup>
          <FormGroup>
            <Col smOffset={4} sm={8}>
              <FormControl.Static
                style={
                  {
                    fontFamily: fontFamilyHeadings,
                    fontSize: fontSize.toString() + "px",
                    textTransform: "uppercase",
                  } as any
                }
              >
                {t("The quick brown fox jumps over the lazy dog")}
              </FormControl.Static>
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={4}>
              <ControlLabel>
                {t("Dashlet Height:")} {dashletHeight}px
                <More id="more-dashlet-height" name={t("Dashlet Height")}>
                  {t(
                    "Every dashlet (the widgets on the Dashboards) has a height that is a " +
                      "multiple of this value and a width of either 1/3, 2/3 or 3/3 of the " +
                      "window width. Here you can adjust the base height of dashlets but " +
                      "we can't promise every dashlet will look good or even be usable with " +
                      "non-default height.",
                  )}
                </More>
              </ControlLabel>
            </Col>
            <Col sm={8}>
              <FormControl
                type="range"
                value={dashletHeight}
                min={50}
                max={1000}
                step={4}
                onChange={this.onChangeDashletHeight}
                disabled={disabled}
              />
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={4}>
              <ControlLabel>
                {t("Titlebar Rows:")} {titlebarRows}
              </ControlLabel>
            </Col>
            <Col sm={8}>
              <FormControl
                type="range"
                value={titlebarRows}
                min={1}
                max={3}
                step={1}
                onChange={this.onChangeTitlebarRows}
                disabled={disabled}
              />
            </Col>
          </FormGroup>
        </Form>

        <Panel>
          <div className="panel-body">
            <Grid style={{ width: "100%" }}>
              {buckets[0].map((value, idx) => {
                return (
                  <Row key={idx}>
                    {buckets.map((bucket) =>
                      bucket[idx] !== undefined
                        ? this.renderEntry(
                            bucket[idx],
                            colors[bucket[idx].name],
                          )
                        : null,
                    )}
                  </Row>
                );
              })}
            </Grid>
          </div>
        </Panel>
        <Toggle checked={dark} onToggle={this.onChangeDark} disabled={disabled}>
          {t("Dark Theme")}
          <More id="more-dark-theme" name={t("Dark Theme")}>
            {t(
              "When this is enabled, grays are essentially inverted, so a light gray becomes " +
                "a dark gray and vice versa.\n" +
                "If your theme is mostly light foreground colors on dark background, this " +
                "will produce better contrast.",
            )}
          </More>
        </Toggle>
        {disabled ? null : (
          <a onClick={this.editManually}>{t("Edit CSS manually...")}</a>
        )}
        {disabled ? null : (
          <div className="pull-right">
            <Button bsStyle="primary" onClick={this.revert}>
              {t("Revert")}
            </Button>
            <Button bsStyle="primary" onClick={this.apply}>
              {t("Apply")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  private readFont = () => {
    this.props
      .getAvailableFonts()
      .then((fonts) => (this.nextState.availableFonts = fonts));
  };

  private renderEntry = (entry: IColorEntry, value: string) => {
    const { disabled } = this.props;
    return (
      <Col
        key={entry.name}
        sm={4}
        md={4}
        lg={4}
        style={{ display: "inline-flex" }}
      >
        <span style={{ marginRight: "auto" }}>{entry.name}</span>
        <ColorPreview
          name={entry.name}
          color={colorFromHex(value || entry.value)}
          onUpdateColor={this.updateColor}
          disabled={disabled}
        />
      </Col>
    );
  };

  private renderFontOption(name: string) {
    return <option key={name}>{name}</option>;
  }

  private editManually = () => {
    const { disabled, themeName } = this.props;
    if (disabled) {
      return;
    }

    this.props.onEditStyle(themeName);
  };

  private revert = () => {
    this.setColors(this.props.theme);
    this.setFontSize(this.props.theme);
    this.setHiDPIScale(this.props.theme);
    this.setFontFamily(this.props.theme);
    this.setFontFamilyHeadings(this.props.theme);
    this.setMargin(this.props.theme);
    this.setDark(this.props.theme);
    this.setTitlebarRows(this.props.theme);
  };

  private apply = () => {
    let fontFamily = this.state.fontFamily;
    if (!["serif", "sans-serif"].includes(fontFamily)) {
      fontFamily = `"${fontFamily}"`;
    }
    const theme: { [key: string]: string } = {
      ...this.state.colors,
      "font-size-base": this.state.fontSize.toString() + "px",
      "hidpi-scale-factor": this.state.hidpiScale.toString() + "%",
      "font-family-base": fontFamily,
      "font-family-headings": '"' + this.state.fontFamilyHeadings + '"',
      "gutter-width": this.state.margin.toString() + "px",
      "dashlet-height": `${this.state.dashletHeight}px`,
      "dark-theme": this.state.dark ? "true" : "false",
      "titlebar-rows": this.state.titlebarRows.toString(),
    };
    const grayNames = [
      "gray-lighter",
      "gray-light",
      "gray",
      "gray-dark",
      "gray-darker",
    ];
    let grayColors = ["D4D4D8", "A1A1AA", "3F3F46", "27272A", "18181B"];
    if (this.state.dark) {
      grayColors = grayColors.reverse();
    }

    grayNames.forEach((id: string, idx: number) => {
      theme[id] = "#" + grayColors[idx];
    });

    this.props.onApply(theme);
  };

  private updateColor = (name: string, color: string) => {
    this.nextState.colors[name] = color;
  };

  private onChangeFontSize = (evt) => {
    this.nextState.fontSize = evt.currentTarget.value;
  };

  private onChangeHiDPIScale = (evt) => {
    this.nextState.hidpiScale = evt.currentTarget.value;
  };

  private onChangeFontFamily = (evt) => {
    this.nextState.fontFamily = evt.currentTarget.value;
  };

  private onChangeFontFamilyHeadings = (evt) => {
    this.nextState.fontFamilyHeadings = evt.currentTarget.value;
  };

  private onChangeMargin = (evt) => {
    this.nextState.margin = evt.currentTarget.value;
  };

  private onChangeDashletHeight = (evt) => {
    this.nextState.dashletHeight = evt.currentTarget.value;
  };

  private onChangeTitlebarRows = (evt) => {
    this.nextState.titlebarRows = evt.currentTarget.value;
  };

  private onChangeDark = (newValue) => {
    this.nextState.dark = newValue;
  };

  private setFontSize(theme: { [name: string]: string }) {
    this.nextState.fontSize =
      theme["font-size-base"] !== undefined
        ? parseInt(theme["font-size-base"], 10)
        : defaultTheme.fontSize;
  }

  private setHiDPIScale(theme: { [name: string]: string }) {
    this.nextState.hidpiScale =
      theme["hidpi-scale-factor"] !== undefined
        ? parseInt(theme["hidpi-scale-factor"], 10)
        : defaultTheme.hidpiScale;
  }

  private setFontFamily(theme: { [name: string]: string }) {
    const fontFamily = theme["font-family-base"] || defaultTheme.fontFamily;
    this.nextState.fontFamily = fontFamily.replace(/^"|"$/g, "");
  }

  private setFontFamilyHeadings(theme: { [name: string]: string }) {
    const fontFamily =
      theme["font-family-headings"] || defaultTheme.fontFamilyHeadings;
    this.nextState.fontFamilyHeadings = fontFamily.replace(/^"|"$/g, "");
  }

  private setMargin(theme: { [name: string]: string }) {
    this.nextState.margin =
      theme["gutter-width"] !== undefined
        ? parseInt(theme["gutter-width"], 10)
        : defaultTheme.margin;
  }

  private setDashletHeight(theme: { [name: string]: string }) {
    if (theme["dashlet-height"] !== undefined) {
      this.nextState.dashletHeight = parseInt(theme["dashlet-height"], 10);
    }
  }

  private setDark(theme: { [name: string]: string }) {
    const dark =
      theme["dark-theme"] !== undefined
        ? theme["dark-theme"] === "true"
        : defaultTheme.dark;
    this.nextState.dark = dark;
  }

  private setTitlebarRows(theme: { [name: string]: string }) {
    if (theme["titlebar-rows"] !== undefined) {
      this.nextState.titlebarRows = parseInt(theme["titlebar-rows"], 10);
    }
  }

  private setColors(theme: { [name: string]: string }) {
    this.nextState.colors = {};
    colorDefaults.forEach((entry) => {
      if (
        colorDefaults.find((color) => color.name === entry.name) !== undefined
      ) {
        this.nextState.colors[entry.name] = theme[entry.name] || entry.value;
      }
    });
  }
}

export default ThemeEditor;
