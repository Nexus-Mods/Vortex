import * as React from 'react';
import { Alert, Button, ControlLabel, FormControl, FormGroup, InputGroup, Panel, Grid, Row, Col, HelpBlock, Table } from 'react-bootstrap';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { actions, ComponentEx, log, tooltip, types, util } from 'vortex-api';

export interface ISettingsDebugProps {
  readThemes: () => Promise<string[]>;
  onCloneTheme: (themeName: string, newName: string) => Promise<void>;
  onSelectTheme: (themeName: string) => void;
  onSaveTheme: (themeName: string, variables: { [name: string]: string }) => Promise<void>;
  onRemoveTheme: (themeName: string) => Promise<void>;
  readThemeVariables: (themeName: string) => Promise<{ [key: string]: string }>;
  locationToName: (location: string) => string;
  nameToLocation: (name: string) => string;
  isThemeCustom: (themeName: string) => boolean;
  onEditStyle: (themeName: string) => void;
  getAvailableFonts: () => Promise<string[]>;
}

interface IConnectedProps {
  currentTheme: string;
}

interface IActionProps {
  onShowDialog: (
    type: types.DialogType,
    title: string,
    content: types.IDialogContent,
    actions: types.DialogActions,
  ) => Promise<types.IDialogResult>;
  onShowError: (title: string, details: any) => void;
  onShowInfo: (message: string) => void;  
  onShowActivity: (message: string) => void;
  onShowSuccess: (message: string) => void;
  onShowWarning: (message: string) => void;
}

type IWrapperProps = ISettingsDebugProps & IConnectedProps & IActionProps;
type IProps = Omit<ISettingsDebugProps, "readThemes"> & { themes: string[] } & IConnectedProps & IActionProps;

interface IComponentState {
  availableFonts: string[];
  variables: { [key: string]: string };
  editable: boolean;
  lastUpdated: number;
}

class SettingsDebug extends ComponentEx<IProps, IComponentState> {
 
  // references so we can get computed styles later
  h1Ref: React.RefObject<HTMLHeadingElement>;
  h2Ref: React.RefObject<HTMLHeadingElement>;
  h3Ref: React.RefObject<HTMLHeadingElement>;
  h4Ref: React.RefObject<HTMLHeadingElement>;
  h5Ref: React.RefObject<HTMLHeadingElement>;
  h6Ref: React.RefObject<HTMLHeadingElement>;

  heading2xlSemiRef: React.RefObject<HTMLDivElement>;
  headingXlSemiRef: React.RefObject<HTMLDivElement>;
  headingLgSemiRef: React.RefObject<HTMLDivElement>;
  headingMdSemiRef: React.RefObject<HTMLDivElement>;
  headingSmSemiRef: React.RefObject<HTMLDivElement>;
  headingXsSemiRef: React.RefObject<HTMLDivElement>;
  
  // computed styles so we can display what they actually are
  h1Styles: CSSStyleDeclaration;
  h2Styles: CSSStyleDeclaration;
  h3Styles: CSSStyleDeclaration;
  h4Styles: CSSStyleDeclaration;
  h5Styles: CSSStyleDeclaration;
  h6Styles: CSSStyleDeclaration;

  heading2xlSemiStyles: CSSStyleDeclaration;
  headingXlSemiStyles: CSSStyleDeclaration;
  headingLgSemiStyles: CSSStyleDeclaration;
  headingMdSemiStyles: CSSStyleDeclaration;
  headingSmSemiStyles: CSSStyleDeclaration;
  headingXsSemiStyles: CSSStyleDeclaration;

  constructor(props: IProps) {
    super(props);

    this.initState({
      availableFonts: [],
      variables: {},
      editable: false,
      lastUpdated: Date.now()
    });
    
    // create references ready
    this.heading2xlSemiRef = React.createRef<HTMLDivElement>();
    this.headingXlSemiRef = React.createRef<HTMLDivElement>();
    this.headingLgSemiRef = React.createRef<HTMLDivElement>();
    this.headingMdSemiRef = React.createRef<HTMLDivElement>();
    this.headingSmSemiRef = React.createRef<HTMLDivElement>();
    this.headingXsSemiRef = React.createRef<HTMLDivElement>(); 

    this.h1Ref = React.createRef<HTMLHeadingElement>(); 
    this.h2Ref = React.createRef<HTMLHeadingElement>();  
    this.h3Ref = React.createRef<HTMLHeadingElement>();  
    this.h4Ref = React.createRef<HTMLHeadingElement>();  
    this.h5Ref = React.createRef<HTMLHeadingElement>();  
    this.h6Ref = React.createRef<HTMLHeadingElement>();    
  }

  public UNSAFE_componentWillMount() {
    this.nextState.availableFonts = Array.from(new Set<string>(
      [
        'Inter',
        'Roboto',
        'BebasNeue',
        'Montserrat',
      ]));

    this.nextState.editable = this.isCustom(this.props.currentTheme);
    return this.updateVariables(this.props.currentTheme);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.currentTheme !== newProps.currentTheme) {
      this.updateVariables(newProps.currentTheme);
      this.nextState.editable = this.isCustom(newProps.currentTheme);
    }
  }

  
  componentDidMount(): void {
    // used for initial loading
    this.updateComputedStyles();   
  }

  componentDidUpdate(): void {    
    // used for the refresh button updates the component
    this.updateComputedStyles();
  }
  
  private updateComputedStyles() {
    this.h1Styles = window.getComputedStyle(this.h1Ref.current!); 
    this.h2Styles = window.getComputedStyle(this.h2Ref.current!); 
    this.h3Styles = window.getComputedStyle(this.h3Ref.current!); 
    this.h4Styles = window.getComputedStyle(this.h4Ref.current!); 
    this.h5Styles = window.getComputedStyle(this.h5Ref.current!); 
    this.h6Styles = window.getComputedStyle(this.h6Ref.current!);

    this.heading2xlSemiStyles = window.getComputedStyle(this.heading2xlSemiRef.current!);
    this.headingXlSemiStyles = window.getComputedStyle(this.headingXlSemiRef.current!);
    this.headingLgSemiStyles = window.getComputedStyle(this.headingLgSemiRef.current!);
    this.headingMdSemiStyles = window.getComputedStyle(this.headingMdSemiRef.current!);
    this.headingSmSemiStyles = window.getComputedStyle(this.headingSmSemiRef.current!);
    this.headingXsSemiStyles = window.getComputedStyle(this.headingXsSemiRef.current!);
  }

  public render(): JSX.Element {
    const { t, currentTheme, themes } = this.props;
    const { editable, variables, lastUpdated } = this.state;

    return (
      <Grid fluid key={lastUpdated}>
        <Row >
          <Button onClick={this.refresh}>Refresh Theme</Button> {new Date(lastUpdated).toString()}
        </Row>

        <Row>
          
          <Table condensed>
            <thead>
              <tr>
                <th>Style Name</th>
                <th>Font Size</th>
                <th>Font Weight</th>
                <th>Letter Spacing</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div ref={this.heading2xlSemiRef} className='heading-2xl-semi'>heading-2xl-semi</div></td>
                <td>{this.heading2xlSemiStyles?.fontSize}</td>
                <td>{this.heading2xlSemiStyles?.fontWeight}</td>
                <td>{this.heading2xlSemiStyles?.letterSpacing}</td>
              </tr>
              <tr>
                <td><div ref={this.headingXlSemiRef} className='heading-xl-semi'>heading-xl-semi</div></td>
                <td>{this.headingXlSemiStyles?.fontSize}</td>
                <td>{this.headingXlSemiStyles?.fontWeight}</td>
                <td>{this.headingXlSemiStyles?.letterSpacing}</td>
              </tr>
              <tr>
                <td><div ref={this.headingLgSemiRef} className='heading-lg-semi'>heading-lg-semi</div></td>
                <td>{this.headingLgSemiStyles?.fontSize}</td>
                <td>{this.headingLgSemiStyles?.fontWeight}</td>
                <td>{this.headingLgSemiStyles?.letterSpacing}</td>
              </tr>
              <tr>
                <td><div ref={this.headingMdSemiRef} className='heading-md-semi'>heading-md-semi</div></td>
                <td>{this.headingMdSemiStyles?.fontSize}</td>
                <td>{this.headingMdSemiStyles?.fontWeight}</td>
                <td>{this.headingMdSemiStyles?.letterSpacing}</td>
              </tr>
              <tr>
                <td><div ref={this.headingSmSemiRef} className='heading-sm-semi'>heading-sm-semi</div></td>
                <td>{this.headingSmSemiStyles?.fontSize}</td>
                <td>{this.headingSmSemiStyles?.fontWeight}</td>
                <td>{this.headingSmSemiStyles?.letterSpacing}</td>
              </tr>
              <tr>
                <td><div ref={this.headingXsSemiRef} className='heading-xs-semi'>heading-xs-semi</div></td>
                <td>{this.headingXsSemiStyles?.fontSize}</td>
                <td>{this.headingXsSemiStyles?.fontWeight}</td>
                <td>{this.headingXsSemiStyles?.letterSpacing}</td>
              </tr>
            </tbody>
          </Table>

        </Row>


        <Row>
          <Col sm={4} md={4} lg={4}>
            <h3>Controls</h3>

            <p>asdasdasdfsd</p>
              
            <Button bsStyle='default'>Default</Button> 
            <Button bsStyle='primary'>Primary</Button> 
            <Button bsStyle='secondary'>Secondary</Button> 
            <Button bsStyle='ghost'>Ghost</Button> 
            <Button bsStyle='ad'>Ad</Button>  

            <form>
              <FormGroup
                controlId="formBasicText"
              //validationState={this.getValidationState()}
              >
                <ControlLabel>Working example with validation</ControlLabel>
                <FormControl
                  type="text"
                  //value={this.state.value}
                  placeholder="Enter text"
                //onChange={this.handleChange}
                />
                <FormControl.Feedback />
                <HelpBlock>Validation is based on string length.</HelpBlock>
              </FormGroup>
            </form>

          </Col>
          <Col sm={4} md={4} lg={4}>
            <h3>Typography</h3>

            <h4>Generic</h4>

            <p><code>p</code>The quick <a href='#'>brown fox jumps</a> over the lazy dog. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            <h1 ref={this.h1Ref}><code>h1</code>Heading 1 {this.h1Styles?.fontSize}</h1> 
            <h2 ref={this.h2Ref}><code>h2</code>Heading 2 {this.h2Styles?.fontSize}</h2>  
            <h3 ref={this.h3Ref}><code>h3</code>Heading 3 {this.h3Styles?.fontSize}</h3>  
            <h4 ref={this.h4Ref}><code>h4</code>Heading 4 {this.h4Styles?.fontSize}</h4>  
            <h5 ref={this.h5Ref}><code>h5</code>Heading 5 {this.h5Styles?.fontSize}</h5>  
            <h6 ref={this.h6Ref}><code>h6</code>Heading 6 {this.h6Styles?.fontSize}</h6> 


   
          </Col>
          <Col sm={4} md={4} lg={4} wrap=''>
            <h3>Utilities</h3>
            <h4>Notifications</h4>
            <p>Use these buttons to fire test notifications of different types</p>
            <Button onClick={() => this.props.onShowError('Test Error', {})}>Test Error</Button>  
            <Button onClick={() => this.props.onShowInfo('Test Info')}>Test Info</Button>   
            <Button onClick={() => this.props.onShowSuccess('Test Success')}>Test Success</Button>
            <Button onClick={() => this.props.onShowActivity('Test Activity')}>Test Activity (3s)</Button> 
            <Button onClick={() => this.props.onShowWarning('Test Warning')}>Test Warning</Button>               
            <h4>Subheading</h4>
            <p>asdasd</p>
          </Col>
        </Row>
      </Grid>
    );
  }

  /*
  actions: [
          {
            title: 'Download', action: dismiss => {
              dismiss();
              resolve();
            },
          },
          {
            title: 'Remind me later',
            action: dismiss => {
              dismiss();
              reject(new UserCanceled());
            },
          },
        ],
        */
  

  public renderTheme(key: string, name: string) {
    return <option key={key} value={key}>{name}</option>;
  }

  private refresh = () => {

    const { currentTheme } = this.props;
    this.props.onSelectTheme(currentTheme);

    setTimeout(() => {
      this.nextState.lastUpdated = Date.now();
    }, 3000);
  }

  private saveTheme = (variables: { [name: string]: string }) => {
    const { currentTheme, onSaveTheme } = this.props;
    onSaveTheme(currentTheme, variables);
  }

  private async updateVariables(themeName: string) {
    this.nextState.variables = await this.props.readThemeVariables(themeName);
  }

  private onClone = () => {
    this.cloneTheme(this.props.currentTheme, this.props.themes);
  }

  private cloneTheme(themeName: string, themes: string[], error?: string) {
    const { t, onCloneTheme } = this.props;

    // note: In the past we used proper name normalization based on the file system themes are stored on,
    //   meaning that on a case-sensitive file system (linux), we would have allowed two themes to be named
    //   "same" and "SAME".
    //   I don't feel like that's actually desireable - much less worth making the code more complex over
    const existing = new Set(themes.map(theme => this.props.locationToName(theme).toUpperCase()));

    return this.props.onShowDialog('question', 'Enter a name', {
      bbcode: error !== undefined ? `[color=red]${error}[/color]` : undefined,
      input: [{
        id: 'name',
        placeholder: 'Theme Name',
        value: themeName !== '__default' ? themeName : '',
      }],
      condition: (content: types.IDialogContent) => {
        const res: types.IConditionResult[] = [];
        const { value } = content.input?.[0] ?? {};
        if ((value !== undefined) && (existing.has(value.toUpperCase()))) {
          res.push({
            id: 'name',
            errorText: 'Name already used',
            actions: ['Clone'],
          });
        }
        if ((value !== undefined) && !util.isFilenameValid(value)) {
          res.push({
            id: 'name',
            errorText: 'Invalid symbols in name',
            actions: ['Clone'],
          });
        }
        return res;
      },
    }, [{ label: 'Cancel' }, { label: 'Clone' }])
      .then(res => {
        if (res.action === 'Clone') {
          return onCloneTheme(themeName, res.input.name);
        }
        return Promise.resolve();
      })
      .catch(err => {
        if (err instanceof util.ArgumentInvalid) {
          return this.cloneTheme(themeName, themes, err.message);
        }
        this.props.onShowError('Failed to clone theme', err);
      });
  }

  private isCustom = (themeName: string): boolean => {
    return this.props.isThemeCustom(themeName);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    currentTheme: state.settings.interface.currentTheme,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, any, Redux.Action>): IActionProps {
  return {
    onShowError: (title: string, details: any) => util.showError(dispatch, title, details),
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
    onShowInfo: (message: string) => dispatch(actions.addNotification({
      id:'test-notification-info',
      type: 'info',
      message,      
    })),
    onShowSuccess: (message: string) => dispatch(actions.addNotification({
      id:'test-notification-success',
      type: 'success',
      message,      
    })),
    onShowWarning: (message: string) => dispatch(actions.addNotification({
      id:'test-notification-warning',
      type: 'warning',
      message,      
    })),
    onShowActivity: (message: string) => {
      dispatch(actions.addNotification({
        id:'test-notification-activity',
        type: 'activity',
        message,      
      })); 
      setTimeout(() => {
        dispatch(actions.dismissNotification('test-notification-activity'));        
      }, 3000); 
      
    },
  };
}

function SettingsDebugWrapper(props: IWrapperProps) {
  const [themes, setThemes] = React.useState<string[]>();

  React.useEffect(() => {
    (async () => {
      const result = await props.readThemes();
      setThemes(result);
    })();
  }, []);

  if (themes !== undefined) {
    return <SettingsDebug {...props} themes={themes} />
  }

  return null;
}

export default
  withTranslation(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsDebugWrapper)) as React.ComponentClass<ISettingsDebugProps>;
