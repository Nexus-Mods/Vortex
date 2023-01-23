export interface IJWTAccessToken {
  application_id: number;
  exp: number;
  fingerprint: string;
  iat: number;
  iss: string;
  jti: string;
  sub: number;
  user: {
    group_id: number;
    id: number;
    membership_roles: string[];
    permissions: { [key: string]: string[] };
    premium_expiry: number;
    username: string;
  }
}
