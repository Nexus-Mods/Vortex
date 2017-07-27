import { TranslationFunction } from 'i18next';
import { ComponentEx } from 'nmm-api';
import * as React from 'react';
import { Button, Col, ControlLabel, Form, FormControl, FormGroup,
  Grid, OverlayTrigger, Popover, Row } from 'react-bootstrap';
import { ChromePicker, Color } from 'react-color';

interface IColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface IColorProps {
  name: string;
  color: IColor;
  onUpdateColor: (name: string, colorHex: string) => void;
}

function toHex(num: number): string {
  let res = num.toString(16);
  if (num < 16) {
    res = '0' + res;
  }
  return res;
}

function colorToHex(color: IColor): string {
  return '#'
    + toHex(color.r)
    + toHex(color.g)
    + toHex(color.b);
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
        display: 'inline-block',
        border: 'solid 1px gray',
        marginLeft: 4,
        backgroundColor: colorToHex(color),
      }}
    />
  );
}

class ColorPreview extends React.Component<IColorProps, {}> {
  public render(): JSX.Element {
    const { color } = this.props;
    const popover = (
      <Popover
        id='color-preview'
      >
        <ChromePicker
          color={color}
          disableAlpha={true}
          onChangeComplete={this.onUpdate}
        />
      </Popover>
    );

    return (
      <OverlayTrigger trigger='click' rootClose placement='top' overlay={popover}>
        <div>
          {colorToHex(color)}
          {renderColorBox(color)}
        </div>
      </OverlayTrigger>
    );
  }

  private onUpdate = (color: any) => {
    const { name, onUpdateColor } = this.props;
    onUpdateColor(name, color.hex);
  }
}

interface IColorEntry {
  name: string;
  value: string;
}

export interface IBaseProps {
  t: TranslationFunction;
  availableFonts: string[];
  theme: { [name: string]: string };
  onApply: (updatedTheme: { [name: string]: string }) => void;
}

type IProps = IBaseProps;

const colorDefaults: IColorEntry[] = [
  { name: 'brand-primary', value: '#2c3e50' },
  { name: 'brand-highlight', value: '#428BCA' },
  { name: 'brand-success', value: '#5DB85C' },
  { name: 'brand-info', value: '#3498DB' },
  { name: 'brand-warning', value: '#F1AE4E' },
  { name: 'brand-danger', value: '#D95450' },
  { name: 'brand-bg', value: '#192431' },
  { name: 'brand-menu', value: '#202C3D' },
  { name: 'brand-secondary', value: '#0c5886' },
  { name: 'brand-selected', value: '#4c5663' },
  { name: 'text-color', value: '#eeeeee' },
  { name: 'text-color-disabled', value: '#bbbbbb' },
  { name: 'link-color', value: '#3498DB' },
];

interface IComponentState {
  fontFamily: string;
  fontSize: number;
  hidpiScale: number;
  colors: { [key: string]: string };
}

class ThemeEditor extends ComponentEx<IProps, IComponentState> {
  private static BUCKETS = 3;

  constructor(props: IProps) {
    super(props);

    this.initState({
      colors: {},
      fontSize: 13,
      fontFamily: 'Arial',
      hidpiScale: 100,
    });

  }

  public componentDidMount() {
    this.setColors(this.props.theme);
    this.setFontSize(this.props.theme);
    this.setHiDPIScale(this.props.theme);
    this.setFontFamily(this.props.theme);
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (newProps.theme !== this.props.theme) {
      this.setColors(newProps.theme);
      this.setFontSize(newProps.theme);
      this.setHiDPIScale(newProps.theme);
      this.setFontFamily(newProps.theme);
    }
  }

  public render(): JSX.Element {
    const { t, availableFonts } = this.props;
    const { colors, fontFamily, fontSize, hidpiScale } = this.state;
    const buckets: IColorEntry[][] = colorDefaults.reduce((prev, value, idx) => {
      if (idx < ThemeEditor.BUCKETS) {
        prev[idx % ThemeEditor.BUCKETS] = [];
      }
      prev[idx % ThemeEditor.BUCKETS].push(value);
      return prev;
    }, new Array(ThemeEditor.BUCKETS));
    return (
      <div>
        <Form horizontal>
          <FormGroup>
            <Col sm={4}>
              <ControlLabel>{t('Font Size:')} {fontSize}</ControlLabel>
            </Col>
            <Col sm={8}>
              <FormControl
                type='range'
                value={fontSize}
                min={8}
                max={24}
                onChange={this.onChangeFontSize}
              />
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={4}>
              <ControlLabel>{t('HiDPI Scale:')} {hidpiScale}%</ControlLabel>
            </Col>
            <Col sm={8}>
              <FormControl
                type='range'
                value={hidpiScale}
                min={50}
                max={300}
                onChange={this.onChangeHiDPIScale}
              />
            </Col>
          </FormGroup>
          <FormGroup>
            <Col sm={4}>
              <ControlLabel>{t('Font Family:')}</ControlLabel>
            </Col>
            <Col sm={8}>
              <FormControl
                componentClass='select'
                onChange={this.onChangeFontFamily}
                value={fontFamily}
              >
              { availableFonts.map(this.renderFontOption) }
              </FormControl>
            </Col>
          </FormGroup>
          <FormGroup>
            <Col smOffset={4} sm={8}>
              <FormControl.Static style={{ fontFamily, fontSize: fontSize.toString() + 'px' }}>
                The quick brown fox jumps over the lazy dog
              </FormControl.Static>
            </Col>
          </FormGroup>
        </Form>

        <Grid style={{ width: '100%' }}>
          {buckets[0].map((value, idx) => {
            return (
              <Row key={idx}>
                {buckets.map(bucket =>
                  bucket[idx] !== undefined
                    ? this.renderEntry(bucket[idx], colors[bucket[idx].name])
                    : null)}
              </Row>
            );
          })}
        </Grid>
        <div className='pull-right'>
          <Button onClick={this.revert}>{t('Revert')}</Button>
          <Button onClick={this.apply}>{t('Apply')}</Button>
        </div>
      </div>
    );
  }

  private renderEntry = (entry: IColorEntry, value: string) => {
    return (
      <Col key={entry.name} sm={4} md={4} lg={4} style={{ display: 'inline-flex' }}>
        <span style={{ marginRight: 'auto' }}>{ entry.name }</span>
        <ColorPreview
          name={entry.name}
          color={colorFromHex(value || entry.value)}
          onUpdateColor={this.updateColor}
        />
      </Col>
    );
  }

  private renderFontOption(name: string) {
    return (
      <option key={name}>
        {name}
      </option>
    );
  }

  private revert = () => {
    this.setColors(this.props.theme);
  }

  private apply = () => {
    const theme: { [key: string]: string } = {
      ...this.state.colors,
      'font-size-base': this.state.fontSize.toString() + 'px',
      'hidpi-scale-factor': this.state.hidpiScale.toString() + '%',
      'font-family-base': '"' + this.state.fontFamily + '"',
    };

    this.props.onApply(theme);
  }

  private updateColor = (name: string, color: string) => {
    this.nextState.colors[name] = color;
  }

  private onChangeFontSize = (evt) => {
    this.nextState.fontSize = evt.currentTarget.value;
  }

  private onChangeHiDPIScale = (evt) => {
    this.nextState.hidpiScale = evt.currentTarget.value;
  }

  private onChangeFontFamily = (evt) => {
    this.nextState.fontFamily = evt.currentTarget.value;
  }

  private setFontSize(theme: { [name: string]: string }) {
    if (theme['font-size-base'] !== undefined) {
      this.nextState.fontSize = parseInt(theme['font-size-base'], 10);
    }
  }

  private setHiDPIScale(theme: { [name: string]: string }) {
    if (theme['hidpi-scale-factor'] !== undefined) {
      this.nextState.hidpiScale = parseInt(theme['hidpi-scale-factor'], 10);
    }
  }

  private setFontFamily(theme: { [name: string]: string }) {
    if (theme['font-family-base'] !== undefined) {
      const fontFamily = theme['font-family-base'] || '';
      this.nextState.fontFamily = fontFamily.replace(/^"|"$/g, '');
    }
  }

  private setColors(theme: { [name: string]: string }) {
    this.nextState.colors = {};
    colorDefaults.forEach(entry => {
        if (colorDefaults.find(color => color.name === entry.name) !== undefined) {
            this.nextState.colors[entry.name] = theme[entry.name] || entry.value;
        }
    });
  }
}

export default ThemeEditor;
