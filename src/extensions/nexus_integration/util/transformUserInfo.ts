import {IValidateKeyData} from '../types/IValidateKeyData';

import {IValidateKeyResponse} from '@nexusmods/nexus-api';

// transform the server response into the format we store internally
function transformUserInfo(input: IValidateKeyResponse): IValidateKeyData {
  return ({
    email: input.email,
    isPremium: input.is_premium,
    isSupporter: input.is_supporter,
    name: input.name,
    profileUrl: input.profile_url,
    userId: input.user_id,
  });
}

export default transformUserInfo;
