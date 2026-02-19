export interface IJWTAccessToken {
  application_id: number;
  exp: number;
  fingerprint?: string;
  iat: number;
  iss: string;
  jti: string;
  sub: string;
  user: {
    group_id: number;
    id: number;
    joined: number;
    membership_roles: string[];
    other_group_ids: string;
    permissions: { [key: string]: string[] };
    premium_expiry: number;
    age_verified: boolean;
    username: string;
  };
}
