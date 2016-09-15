import { II18NProps } from '../types/II18NProps';
import { IIconDefinition } from '../types/IIconDefinition';
import IconBar from './IconBar';
import Settings from './Settings';
import { Button } from './TooltipControls';
import * as React from 'react';
import { Label, Modal, Well, FormControl } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import update = require('react-addons-update');
import { setLoggedUser } from '../actions/actions';
import { connect } from 'react-redux';
let Developer = undefined;
if (process.env.NODE_ENV === 'development') {
    Developer = require('./Developer').default;
}

interface IMainWindowProps {
    className: string;
}

interface IMainWindowConnectedProps {
    account: any;
}

interface IMainWindowState {
//<<<<<<< Updated upstream
    showLayer: string;
    currentTab: string;
    modalIsOpen: boolean;
    username: string;
    password: string;
}

interface IMainWindowActionProps {
    onSetAccount: Function
}

let Client = require('node-rest-client').Client;
let client = new Client();

function mapStateToProps(state: any): IMainWindowConnectedProps {
    return { account: state.account }
}

function mapDispatchToProps(dispatch: Function): IMainWindowActionProps {
    return {
        onSetAccount: (account) => dispatch(setLoggedUser(account))
    }
}

let account = connect(mapStateToProps, mapDispatchToProps)(this) as React.ComponentClass<IMainWindowProps>;
export { account }

class MainWindow extends React.Component<IMainWindowProps & II18NProps, IMainWindowState> {

    private buttonsLeft: IIconDefinition[];
    private buttonsRight: IIconDefinition[];

    handleChangeUsername = (event) => this.handleChange(event, 'username');
    handleChangePassword = (event) => this.handleChange(event, 'password');

    constructor(props) {
        super(props);
        this.state = {
            showLayer: '',
            currentTab: 'mod',
            modalIsOpen: false,
            password: null,
            username: null
        };

        this.buttonsLeft = [
            { icon: 'bank', title: 'placeholder', action: () => undefined },
        ];

        this.buttonsRight = [
            { icon: 'gear', title: 'Settings', action: () => this.showLayer('settings') },
        ];

        if (Developer !== undefined) {
            this.buttonsRight.push(
                { icon: 'wrench', title: 'Developer', action: () => this.showLayer('developer') }
            );
        }
    }

    public openModal() {
        this.setState({
            modalIsOpen: true,
            username: null,
            password: null,
            showLayer: null,
            currentTab: null
        });
    }

    public LoginAuthentication(username, password) {
        let args = {
            path: { "username": username, "password": password },
            parameters: { Login: null, username: username, password: password },
            headers: { "user-agent": "Nexus Client v0.62.28" }
        };

        client.get("http://nmm.nexusmods.com/Sessions/", args,
            function (data, response) {

                console.log('STATUS: ' + response.statusCode);
                console.log('HEADERS: ' + JSON.stringify(response.headers));

                let sid = response.headers['set-cookie'];
                sid = sid[0].split(";")
                sid = sid[0].split("=");
                sid = sid[1].split(",");
                console.log('SID: ' + sid);
                console.log('username: ' + username);
                let { onSetAccount } = this.props;
                onSetAccount({ username, sid })

                response.setEncoding('utf8');
                response.on('data', function (chunk) {
                    console.log('BODY: ' + chunk);
                }
                );

            });



    }

    public getInitialState() {
        return { modalIsOpen: false };
    }

    public handleModalCloseRequest() {
        this.setState({
            modalIsOpen: false,
            username: null,
            password: null,
            showLayer: null,
            currentTab: null
        });
    }

    public handleChange(event, field) {
        this.setState(update(this.state, { [field]: { $set: event.target.value } }));
    }

    public render(): JSX.Element {
        const { t } = this.props;
        return (
            <div>
                <Layout type='column'>
                    <Fixed>
                        <IconBar group='application-icons' staticElements={this.buttonsLeft} />
                        <IconBar group='help-icons' className='pull-right' staticElements={this.buttonsRight} />
                    </Fixed>
                    <Flex>
                        <Label>Content area placeholder</Label>
                    </Flex>
                    <Fixed>
                        <Well bsStyle='slim'>Statusbar placeholder</Well>
                    </Fixed>
                </Layout>
                <Modal show={this.state.showLayer === 'settings'} onHide={ this.hideLayer }>
                    <Modal.Header>
                        <Modal.Title>{ t('Settings') }</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Settings />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button tooltip={ t('Close') } id='close' onClick={ this.hideLayer }>
                            {t('Close') }
                        </Button>
                    </Modal.Footer>
                </Modal>
                { this.renderDeveloperModal() }
            </div>
        );

    }

    private showLayer = (layer: string) => this.showLayerImpl(layer);
    private hideLayer = () => this.showLayerImpl('');

    private showLayerImpl(layer: string): void {
        this.setState(update(this.state, { showLayer: { $set: layer } }));
    }

    private renderDeveloperModal() {
        return Developer === undefined ? null : (
            <Modal show={this.state.showLayer === 'developer'} onHide={ this.hideLayer }>
                <Modal.Header>
                    <Modal.Title>Developer</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Developer />
                </Modal.Body>
            </Modal>
        );
    }
}

export default translate(['common'], { wait: true })(MainWindow);
//=======
	
            
//	public render() {
	     
//		let openModal = this.openModal.bind(this);
		 
//		 return (
//	      React.DOM.div(null, 
//	        React.DOM.button({onClick: openModal}, "LOGIN"), 
//	       React.createElement(Modal, {
//			show: this.state.modalIsOpen,
//			closable: Boolean(),
//			onShow: function(){},
//			onHide: function(){}
			
//			},
//				<div>
//        <div className="login">
//          <h1>Nexus Mod Manager Login</h1>
//          <form method="post" action="index.html">
//                            <p><FormControl type="text" name="username" value={this.state.username} placeholder="Enter text" onChange={this.handleChangeUsername} /></p>
//                            <p><FormControl type="password" name="password" value={this.state.password} placeholder="Password" onChange={this.handleChangePassword} /></p>
//            <p className="remember_me">
//              <label>
//                <input type="checkbox" name="remember_me" id="remember_me" />
//                Remember me on this computer
//              </label>
//            </p>
//            <p className="submit"><input type="submit" onClick={() => this.LoginAuthentication(this.state.username, this.state.password)} name="commit" defaultValue="Login" /></p>
//          </form>
//        </div>
//        <div className="login-help">
//          <p>Forgot your password? <a href="index.html">Click here to reset it</a>.</p>
//        </div>
//      </div>
//    )));
	      	    
//	}
//}

//>>>>>>> Stashed changes
