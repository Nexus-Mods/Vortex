import {IValidateKeyData} from '../types/IValidateKeyData';

import * as Promise from 'bluebird';
import Nexus, {IValidateKeyResponse} from 'nexus-api';

function fetchUserInfo(nexus: Nexus, key: string) {
  return new Promise<IValidateKeyData>((resolve, reject) => {
    nexus.validateKey(key)
      .then((data: IValidateKeyResponse) => {
        resolve({
          email: data.email,
          isPremium: data['is_premium?'],
          isSupporter: data['is_supporter?'],
          name: data.name,
          profileUrl: data.profile_url,
          userId: data.user_id,
        });
      })
      .catch(error => reject(error));
  });
}

export default fetchUserInfo;
