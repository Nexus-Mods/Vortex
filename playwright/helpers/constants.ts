
const HOST = "nexusmods.com";

export type User = {
  email: string;
  login: string;
  password: string;
};

type Constants = {
  ERROR_MESSAGES: {
    [key: string]: string;
  };
  SECRETS: {
    [key: string]: string;
  };
  URLS: {
    [key: string]: string;
  };
  USER_ACCOUNTS: {
    [key: string]: User;
  };
};

export const constants = {
  ERROR_MESSAGES: {
    COMMENT_TOO_LONG: `Comments can be up to 5000 characters. If you need to post long-form content you can use a tool like <a href=\"https://pastebin.com/\">Pastebin</a> or <a href=\"https://privatebin.net/\">Privatebin</a>.`,
    ISSUE_TOO_LONG: `Issues can be up to 5000 characters. If you need to post long-form content you can use a tool like <a href=\"https://pastebin.com/\">Pastebin</a> or <a href=\"https://privatebin.net/\">Privatebin</a>.`,
    TOPIC_TOO_LONG: `Your topic content is too long. Please submit a topic with content no larger than 5000 characters.`,
  },
  SECRETS: {
    OTP_SECRET: `SRA5FA7YTYK63MD4JHTUG43M`,
  },
  URLS: {
    ADMIN_BAN_PAGE_URL: `https://www.${HOST}/admin/members/ban`,
    ADMIN_HOME_PAGE_URL: `https://www.${HOST}/admin`,
    ADS_SUFFIX: `?nntestads=stage`,
    ADULT_COLLECTION_PAGE_URL: `https://www.${HOST}/games/e2e/collections/slug5`,
    ADULT_REVISION_COLLECTION_PAGE_URL: `https://www.${HOST}/games/e2e/collections/slug0/revisions/1`,
    BASE_PROFILE_URL: `https://www.${HOST}/profile`,
    BILLING_PAGE_URL: `https://users.${HOST}/account/billing`,
    CHANGE_AVATAR_PAGE_URL: `https://www.${HOST}/settings/profile`,
    COLLECTION_BUG_PAGE_URL: `https://www.${HOST}/games/e2e/collections/slug3/bugs`,
    COLLECTION_CHANGELOG_PAGE_URL: `https://www.${HOST}/games/e2e/collections/slug0/revisions/1/changelog`,
    COLLECTION_COMMENTS_PAGE_URL: `https://www.${HOST}/games/e2e/collections/slug4/comments`,
    COLLECTION_MOD_PAGE_URL: `https://www.${HOST}/games/e2e/collections/slug1/mods`,
    COLLECTION_ONE_REVISION_PAGE_URL: `https://www.${HOST}/games/e2e/collections/slug0`,
    COLLECTION_PAGE_0_URL: `https://www.${HOST}/games/e2e/collections/slug0`,
    COLLECTION_PAGE_100_REVISIONS_URL: `https://www.${HOST}/games/stardewvalley/collections/collection-with-100-revisions`,
    COLLECTION_PAGE_13_URL: `https://www.${HOST}/games/e2e/collections/slug13`,
    COLLECTION_PAGE_1_URL: `https://www.${HOST}/games/e2e/collections/slug1`,
    COLLECTION_PAGE_28_URL: `https://www.${HOST}/games/e2e/collections/slug28`,
    COLLECTION_PAGE_2_URL: `https://www.${HOST}/games/e2e/collections/slug2`,
    COLLECTION_PAGE_3_URL: `https://www.${HOST}/games/e2e/collections/slug3`,
    COLLECTION_PAGE_URL: `https://www.${HOST}/games/e2e/collections/slug2`,
    COLLECTIONS_ALL_COLLECTIONS_PAGE_URL: `https://www.${HOST}/collections`,
    COLLECTIONS_LIST_PAGE_URL: `https://www.${HOST}/games/e2e/collections`,
    COLLECTIONS_URL: `https://www.${HOST}/collections`,
    COPYRIGHT_GAME_URL: `https://www.${HOST}/games/dragonage`,
    COPYRIGHT_MODS_LIST_URL: `https://www.${HOST}/games/dragonage/mods`,
    E2E_COLLECTIONS_LIST_PAGE_URL: `https://www.${HOST}/games/e2e/collections?gameName=E2E+Testing`,
    EDIT_ABOUT_ME_PAGE_URL: `https://www.${HOST}/settings/profile/about-me`,
    FLAMEWORK_PAGE_URL: `https://www.${HOST}/`,
    FREE_USER_1_PROFILE_PAGE_URL: `https://www.${HOST}/profile/freeuser1/about-me`,
    FREE_USER_3_PROFILE_PAGE_URL: `https://www.${HOST}/profile/freeuser3/about-me`,
    GAMES_FW_PAGE_URL: `https://www.${HOST}/games`,
    GAMES_PAGE_URL: `https://www.${HOST}/games`,
    GAMES_RECENTLY_ADDED_PAGE_URL: `https://www.${HOST}/games?sort=approved`,
    GENERAL_SEARCH_RESULTS_URL: `https://www.${HOST}/search`,
    HOME_PAGE_URL: `https://www.${HOST}/`,
    INVISION_MESSENGER_URL: `https://forums.${HOST}/messenger/`,
    INVISION_URL: `https://forums.${HOST}/`,
    LISTED_COLLECTION_PAGE_URL: `https://www.${HOST}/games/e2e/collections/slug1`,
    LOGIN_PAGE_URL: `https://users.${HOST}/auth/sign_in`,
    MAIL_HOG_URL: `https://mail.${HOST}/`,
    ME3_GAME_URL: `https://www.${HOST}/games/masseffect3`,
    ME3_MODS_LIST_URL: `https://www.${HOST}/games/masseffect3/mods`,
    MOD_AUTHOR_1_PROFILE_PAGE_URL: `https://www.${HOST}/profile/modauthor1/about-me`,
    MOD_AUTHOR_2_MODS_PAGE_URL: `https://www.${HOST}/profile/modauthor2/mods`,
    MOD_AUTHOR_2_PROFILE_PAGE_URL: `https://www.${HOST}/profile/modauthor2/about-me`,
    MOD_AUTHOR_3_MEDIA_PAGE_URL: `https://www.${HOST}/profile/modauthor3/media`,
    MOD_AUTHOR_3_PROFILE_PAGE_URL: `https://www.${HOST}/profile/modauthor3/about-me`,
    MODERATION_PAGE_URL: `https://moderation.${HOST}/cases`,
    MODS_ALL_MODS_PAGE_FW_URL: `https://www.${HOST}/mods`,
    MODS_ALL_MODS_PAGE_URL: `https://www.${HOST}/mods`,
    MODS_PAGE_URL: `https://www.${HOST}/modrewards#/mods/1`,
    MY_COLLECTIONS_PAGE_URL: `https://www.${HOST}/my-collections`,
    NEW_PREMIUM_PAGE_URL: `https://users.${HOST}/premium`,
    NEXT_URL: `https://www.${HOST}`,
    NORMALMEMBER_9_COLLECTIONS_PAGE_URL: `https://www.${HOST}/profile/normalmember9/collections`,
    NORMALMEMBER_9_MODS_PAGE_URL: `https://www.${HOST}/profile/normalmember9/mods`,
    NORMALMEMBER_9_PROFILE_PAGE_URL: `https://www.${HOST}/profile/normalmember9`,
    OAUTH_URL: `https://users.${HOST}/oauth/authorize?client_id=vortex&redirect_uri=nxm://oauth/callback&response_type=code&scopes=public`,
    PADDLE_WEBHOOK_URL: `https://users.${HOST}/pay/webhooks/paddle_billing`,
    PASSWORD_RESET_PAGE_URL: `https://users.${HOST}/auth/password/new`,
    PREMIUM_PAGE_URL: `https://users.${HOST}/account/billing/premium`,
    PROFILE_PAGE_URL: `https://users.${HOST}/account/profile`,
    PUBLIC_PROFILE_ROOT_PAGE: `https://www.${HOST}/profile/`,
    REGISTER_ACCOUNT_URL: `https://users.${HOST}/register`,
    SECURITY_PAGE_URL: `https://users.${HOST}/account/security`,
    SETTINGS_API_KEYS_PAGE_URL: `https://www.${HOST}/settings/api-keys`,
    SETTINGS_CONTENT_BLOCKING_PAGE_URL: `https://www.${HOST}/settings/content-blocking`,
    SETTINGS_DONATIONS_PAGE_URL: `https://www.${HOST}/settings/donations`,
    SETTINGS_PAGE_URL: `https://www.${HOST}/settings/preferences`,
    SETTINGS_PROFILE_PAGE_URL: `https://www.${HOST}/settings/profile`,
    SINGLE_GAME_URL: `https://www.${HOST}/games/e2e`,
    SKYRIM_GAME_URL: `https://www.${HOST}/games/skyrim`,
    SUPPORTER_IMAGES_PAGE_URL: `https://www.${HOST}/games/masseffect3/supporterimages`,
    UPLOAD_MOD_PAGE_URL: `https://www.${HOST}/mods/add`,
    UPLOAD_PAGE_URL: `https://upload.${HOST}/`,
    USER_PROFILE_PAGE: `https://users.${HOST}/account/profile/edit`,
    USERS_PAGE: `https://users.${HOST}/`,
    WALLET_PAGE_URL: `https://www.${HOST}/modrewards#/wallet/all/1`,
    WALLET_STORE_PAGE_URL: `https://www.${HOST}/modrewards#/store/all/1`,
  },
  USER_ACCOUNTS: {
    ADMIN: {
      email: 'adminuser@nexusmods.com',
      login: 'adminuser',
      password: 'Password1234',
    },
    AGE_VERIFIED_USER: {
      email: 'ageverified@nexusmods.com',
      login: 'ageverified',
      password: 'Password1234',
    },
    COLLECTION_DOWNLOADER_1: {
      email: 'i.amti..z@gmail.com',
      login: 'normalmember9',
      password: 'Password1234',
    },
    CURATOR: {
      email: 'i.amti..z@gmail.com',
      login: 'normalmember9',
      password: 'Password1234',
    },
    EX_PREMIUM_2018_USER: {
      email: '2018legacypremium1@nexusmods.com',
      login: '2018legacypremium1',
      password: 'Password1234',
    },
    EX_PREMIUM_2019_USER: {
      email: '2019legacypremium1@nexusmods.com',
      login: '2019legacypremium1',
      password: 'Password1234',
    },
    FREE_USER: {
      email: 'freeuser1@nexusmods.com',
      login: 'freeuser1',
      password: 'Password1234',
    },
    FREE_USER_3: {
      email: 'freeuser3@nexusmods.com',
      login: 'freeuser3',
      password: 'Password1234',
    },
    FREE_USER_4: {
      email: 'freeuser4@nexusmods.com',
      login: 'freeuser4',
      password: 'Password1234',
    },
    INACTIVE_USER: {
      email: 'hideadultcontent3@nexusmods.com',
      login: 'hideadultcontent3',
      password: 'Password1234',
    },
    INVALID: {
      email: '1234johndoe@nexusmods.com',
      login: '1234johndoe',
      password: 'doesnt-matter',
    },
    MFA_ENABLED_USER: {
      email: '2famember1@test.com',
      login: '2famember1',
      password: 'Password1234',
    },
    MFA_USER: {
      email: 'freeuser3@nexusmods.com',
      login: 'freeuser3',
      password: 'Password1234',
    },
    MOD_AUTHOR: {
      email: 'modauthor1@test.com',
      login: 'modauthor1',
      password: 'Password1234',
    },
    MOD_AUTHOR_2: {
      email: 'modauthor2@test.com',
      login: 'modauthor2',
      password: 'Password1234',
    },
    MOD_AUTHOR_3: {
      email: 'modauthor3@test.com',
      login: 'modauthor3',
      password: 'Password1234',
    },
    MOD_AUTHOR_NO_DP: {
      email: 'modauthor5@test.com',
      login: 'modauthor5',
      password: 'Password1234',
    },
    NO_TOS: {
      email: 'notosuser4@test.com',
      login: 'notosuser4',
      password: 'Password1234',
    },
    NORMAL_MEMBER: {
      email: 'i.amti..z@gmail.com',
      login: 'normalmember9',
      password: 'Password1234',
    },
    PREMIUM_1: {
      email: '2009legacylifetime1@nexusmods.com',
      login: '2009legacylifetime1',
      password: 'Password1234',
    },
    PREMIUM_ADULT: {
      email: 'premiumadult@nexusmods.com',
      login: 'premiumadult',
      password: 'Password1234',
    },
    REPORTER_1: {
      email: '',
      login: '',
      password: '',
    },
    SHOW_ADULT_CONTENT: {
      email: 'showadultcontent5@test.com',
      login: 'showadultcontent5',
      password: 'Password1234',
    },
    SUPERADMIN: {
      email: 'superadminuser@nexusmods.com',
      login: 'superadminuser',
      password: 'Password1234',
    },
    VERIFIED_MOD_AUTHOR: {
      email: 'modauthor2@nexusmods.com',
      login: 'modauthor2',
      password: 'Password1234',
    },
  },
} as const satisfies Constants;
