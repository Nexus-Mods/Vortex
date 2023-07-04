
import { USERINFO_ENDPOINT } from '../constants';

export interface IUserInfo {
  sub: string;
  name: string;
  email: string;
  avatar: string;
  group_id: number;
  membership_roles: string[];
  premium_expiry: number;
}

export async function getUserInfo(token: string): Promise<IUserInfo> {

  const headers: Headers = new Headers()

  // Add a few headers
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');

  // Add a custom header, which we can use to check
  headers.set('Authorization', `Bearer ${token}`);

  // Create the request object, which will be a RequestInfo type. 
  // Here, we will pass in the URL as well as the options object as parameters.
  const request: RequestInfo = new Request(USERINFO_ENDPOINT, {
    method: 'GET',
    headers: headers
  })

  const response = await fetch(request);

  if (!response.ok) {
    const message = `An error has occured: ${response.status}`;
    throw new Error(message);
  }

  const userInfo:IUserInfo = await response.json();
  return userInfo;
}