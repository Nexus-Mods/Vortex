/* eslint-disable */
import * as http from 'node:http';
import * as https from 'node:https';
import { AddressInfo } from 'node:net';
import * as querystring from 'node:querystring';
import * as url from 'node:url';
import { log } from '../../../util/log';
import { OAUTH_REDIRECT_URL } from '../constants';
import NEXUSMODS_LOGO from './nexusmodslogo';
import { ArgumentInvalid } from '../../../util/CustomErrors';

type TokenType = 'Bearer';

// see https://www.oauth.com/oauth2-servers/access-tokens/access-token-response/
type TokenErrorType = 'invalid_request' | 'invalid_client' | 'invalid_grant' | 'invalid_scope' | 'unauthorized_client' | 'unsupported_grant_type';

export interface ITokenReply {
  access_token: string;
  token_type: TokenType;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface IOAuthServerSettings {
  baseUrl: string;
  clientId: string;
  redirectUrl: string;
}

/* eslint-disable max-len */
function makeResultPage(success: boolean) {

  var html = [];

  html.push(
    `<!DOCTYPE html>

    <html lang="en">
    
    <head>
    <title>Authentication Status</title>
    
      <meta http-equiv="refresh" content="6; url=http://www.nexusmods.com/" />
    
    </head>
    
    <body style="display: flex; flex-direction: column; height: 50vh; justify-content: center; align-items: center; background-color: black; font-family: sans-serif; color: white;">
    
    <div style="text-align: center; ">
    
    <img width="200px" src="data:image/png;base64,${NEXUSMODS_LOGO}" />`
  );

  if (success) {

  html.push(`
    <h1>Vortex log in successful!</h1>
  `);

  } else {

  html.push(`
    <h1>Vortex was unable to log in</h1>
    <p style="font-size: 1.2em;">Please check Vortex for more information</a></p>
  `);
  }

  html.push(`

  <p style="font-size: 1.2em;">Taking you to the <a href="http://www.nexusmods.com/" style="color: #D98F40;">Nexus Mods homepage</a></p>
    </div>
    </body>
    
    </html>
  `);

  return html.join("");
}
/* eslint-enable max-len */

/**
 * deals with token exchange for OAuth2
 **/
class OAuth {
  private mVerifier: string;
  private mServerSettings: IOAuthServerSettings;
  private mStates: { [state: string]: (err: Error, token: ITokenReply) => void } = {};
  private mServer: http.Server;
  private mLastServerPort: number;
  private mLocalhost: boolean;

  constructor(settings: IOAuthServerSettings) {
    this.mServerSettings = settings;
    this.mLocalhost = url.parse(OAUTH_REDIRECT_URL).protocol === 'http:';
  }

  public async sendRequest(
    onToken: (err: Error, token: ITokenReply) => void,
    onOpenPage: (url: string) => void)
    : Promise<void> {

    // importing uuid can take significant amounts of time so always delay it as far as possible
    const uuid = (await import('uuid/v1')).default;
    const crypto = (await import('crypto')).default;

    const state = uuid();
    this.mStates[state] = onToken;

    // see https://www.rfc-editor.org/rfc/rfc7636#section-4.1
    this.mVerifier = Buffer.from(uuid().replace(/-/g, '')).toString('base64');
    // see https://www.rfc-editor.org/rfc/rfc7636#section-4.2
    const challenge = crypto.createHash('sha256').update(this.mVerifier).digest('base64');

    try {
      this.mLastServerPort = this.mLocalhost ? await this.ensureServer() : -1;
    } catch (err) {
      log('error', 'failed to start server', err);
      throw err;
    }

    // see https://www.rfc-editor.org/rfc/rfc7636#section-4.3
    const url = this.authorizeUrl(challenge, state);

    // call callback with generated url
    onOpenPage(url);
  }

  public async receiveCode(code: string, state?: string): Promise<void> {
    if (state === undefined) {
      for (const key of Object.keys(this.mStates)) {
        await this.receiveCode(code, key);
      }
    } else {
      if (this.mStates[state] === undefined) {
        throw new ArgumentInvalid('unexpected authorize token');
      }
      try {
        const tokenReply = await this.sentAuthorizeToken(code)
        this.mStates[state]?.(null, tokenReply);
      } catch (err) {
        this.mStates[state]?.(err, undefined);
      }
      delete this.mStates[state];
    }
  }

  private async ensureServer(): Promise<number> {
    if (this.mServer === undefined) {
      log('info', 'starting localhost server to receive oauth response');
      await this.startServer();
    }
    const addr: AddressInfo = this.mServer.address() as AddressInfo;
    log('info', 'using localhost server for oauth response', { port: addr.port });
    return addr.port;
  }

  private checkServerStillRequired() {
    if (this.mLocalhost && (Object.keys(this.mStates).length === 0)) {
      log('info', 'no more oauth responses outstanding, stopping server');
      this.stopServer();
    }
  }

  private stopServer() {
    this.mServer?.close?.();
    this.mServer = undefined;
  }

  private async startServer(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.mServer = http.createServer()
          .listen(undefined, '127.0.0.1')
          .on('error', reject)
          .on('listening', resolve)
          .on('request', (req, resp) => {
            this.onHTTPRequest(req, resp);
          });
      } catch (err) {
        reject(err);
      }
    });
  }

  private onHTTPRequest(
    req: http.IncomingMessage,
    resp: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {

    const queryItems = url.parse(req.url, true).query;
    const getQueryParam = (key: string): string => {
      const tmp = queryItems[key];
      return Array.isArray(tmp) ? tmp[0] : tmp;
    };
    const code = getQueryParam('code');
    const state = getQueryParam('state');
    const error = getQueryParam('error');
    const error_description = getQueryParam('error_description');

    req.setEncoding('utf-8');
    let msg: string = '';
    req
      .on('data', chunk => { msg += chunk; });


    if ((code !== undefined) && (state !== undefined)) {
      (async () => {
        try {
          await this.receiveCode(code, state as string);
        } catch (err) {
          // ignore unexpected codes
        }
      })();
      resp.write(makeResultPage(true));

      this.checkServerStillRequired();
    } else if (error !== undefined) {
      const err = new Error((error_description as string) ?? 'Description missing');
      err['code'] = error;
      this.mStates[state]?.(err, undefined);
      resp.write(makeResultPage(false)); 
      delete this.mStates[state];

      this.checkServerStillRequired();
    }

    resp.end();
  }

  private async postRequest(tokenUrl: string, request: any): Promise<string> {
    const requestStr = querystring.stringify(request);
    return new Promise((resolve, reject) => {
      const req = https.request({
        ...url.parse(tokenUrl),
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Content-Length': requestStr.length,
        },
      }, res => {
        let responseStr = '';
        let error: Error;
        res
          .on('data', chunk => responseStr += chunk.toString())
          .on('error', err => error = err)
          .on('end', () => {
            if (error) {
              reject(error);
            } else if (res.statusCode !== 200) {
              try {
                const errDetails = JSON.parse(responseStr);
                const err = new Error(`Invalid request: "${errDetails?.error}"`);
                err['code'] = errDetails?.error;
                // these details are explicitly intended for the developer, not for the user
                err['details'] = errDetails?.error_description;
                
                // Special handling for invalid_grant errors
                if (errDetails?.error === 'invalid_grant') {
                  // Add more descriptive error message
                  err['description'] = 'Your OAuth token has either expired or has been revoked. Please log in again to generate a new token.';
                }
                
                reject(err);
              } catch (err) {
                const errMessage = responseStr.includes('<!DOCTYPE html>')
                  ? `Received HTML response from ${tokenUrl} when JSON was expected. Please check your connection settings.`
                  : `Failed to parse failure response: "${responseStr.substring(0, 50)}"`
                reject(new Error(errMessage));
              }
            } else {
              resolve(responseStr);
            }
          });
      });
      req.on('error', err => {
        console.error('token req error', err);
        // Handle network errors that might be related to invalid_grant
        if (err.message.includes('certificate') || err.message.includes('SSL')) {
          const networkErr = new Error('Secure connection failed. This may be due to network issues or an expired OAuth token.');
          networkErr['code'] = 'invalid_grant';
          networkErr['description'] = 'Secure connection failed. Please check your network connection and try logging in again.';
          reject(networkErr);
        } else {
          reject(err);
        }
      });
      req.write(requestStr);
      req.end();
    })
  }

  // sanitize a base64 string to use in urls
  private static sanitizeBase64(input: string) {
    const replacements = {
      '+': '-',
      '/': '_',
    };
    return input
      .replace(/[+/]/g, char => replacements[char])
      .replace(/=*$/, '');
  }

  private authorizeUrl(challenge: string, state: string): string {
    const request = {
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge_method: 'S256',
      client_id: this.mServerSettings.clientId,
      redirect_uri: this.mServerSettings.redirectUrl.replace('PORT', this.mLastServerPort.toString()),
      state,
      code_challenge: OAuth.sanitizeBase64(challenge),
    };
    return `${this.mServerSettings.baseUrl}/authorize?${querystring.stringify(request)}`;
  }

  private async sentAuthorizeToken(code: string): Promise<ITokenReply> {
    const request = {
      grant_type: 'authorization_code',
      client_id: this.mServerSettings.clientId,
      redirect_uri: this.mServerSettings.redirectUrl.replace('PORT', this.mLastServerPort.toString()),
      code,
      code_verifier: this.mVerifier,
    };
    const tokenUrl = `${this.mServerSettings.baseUrl}/token`;
    // TODO: validate result
    return JSON.parse(await this.postRequest(tokenUrl, request));
  }
}

export default OAuth;
