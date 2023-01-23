import * as https from 'node:https';
import * as querystring from 'node:querystring';
import * as url from 'node:url';

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

/**
 * deals with token exchange for OAuth2
 **/
class OAuth {
  private mVerifier: string;
  private mServerSettings: IOAuthServerSettings;
  private mOnOpenPage: (url: string) => void;
  private mStates: { [state: string]: (err: Error, token: ITokenReply) => void } = {};

  constructor(settings: IOAuthServerSettings, onOpenPage: (url: string) => void) {
    this.mServerSettings = settings;
    this.mOnOpenPage = onOpenPage;
  }

  public async sendRequest(onToken: (err: Error, token: ITokenReply) => void): Promise<void> {
    // importing uuid can take significant amounts of time so always delay it as far as possible
    const uuid = (await import('uuid/v1')).default;
    const crypto = (await import('crypto')).default;

    const state = uuid();
    this.mStates[state] = onToken;

    // see https://www.rfc-editor.org/rfc/rfc7636#section-4.1
    this.mVerifier = Buffer.from(uuid().replace(/-/g, '')).toString('base64');
    // see https://www.rfc-editor.org/rfc/rfc7636#section-4.2
    const challenge = crypto.createHash('sha256').update(this.mVerifier).digest('base64');
    // see https://www.rfc-editor.org/rfc/rfc7636#section-4.3
    this.mOnOpenPage(this.authorizeUrl(challenge, state));
  }

  public async receiveCode(code: string, state: string): Promise<void> {
    try {
      const tokenReply = await this.sentAuthorizeToken(code)
      this.mStates[state]?.(null, tokenReply);
    } catch (err) {
      this.mStates[state]?.(err, undefined);
    }
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
                reject(err);
              } catch (err) {
                reject(new Error(
                  `Failed to parse failure response: "${responseStr.substring(0, 50)}"`));
              }
            } else {
              resolve(responseStr);
            }
          });
      });
      req.on('error', err => console.error('token req error', err));
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
      scope: 'public',
      code_challenge_method: 'S256',
      client_id: this.mServerSettings.clientId,
      redirect_uri: this.mServerSettings.redirectUrl,
      state,
      code_challenge: OAuth.sanitizeBase64(challenge),
    };
    return `${this.mServerSettings.baseUrl}/authorize?${querystring.stringify(request)}`;
  }

  private async sentAuthorizeToken(code: string): Promise<ITokenReply> {
    const request = {
      grant_type: 'authorization_code',
      client_id: this.mServerSettings.clientId,
      redirect_uri: this.mServerSettings.redirectUrl,
      code,
      code_verifier: this.mVerifier,
    };
    const tokenUrl = `${this.mServerSettings.baseUrl}/token`;
    // TODO: validate result
    return JSON.parse(await this.postRequest(tokenUrl, request));
  }
}

export default OAuth;
