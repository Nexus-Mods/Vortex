import { log } from './log';

import Promise from 'bluebird';
import * as https from 'https';
import * as _ from 'lodash';
import * as semver from 'semver';
import * as url from 'url';
import { DataInvalid } from './CustomErrors';

export interface IGitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
}

export interface IGitHubAsset {
  browser_download_url: string;
  content_type: string;
  created_at: string;
  download_count: number;
  id: string;
  label: any;
  name: string;
  node_id: string;
  size: number;
  state: string;
  updated_at: string;
  uploader: IGitHubUser;
  url: string;
}

export interface IGitHubRelease {
  assets: IGitHubAsset[];
  assets_url: string;
  author: IGitHubUser;
  body: string;
  created_at: string;
  draft: boolean;
  html_url: string;
  id: number;
  name: string;
  node_id: string;
  prerelease: boolean;
  published_at: string;
  tag_name: string;
  tarball_url: string;
  target_commitish: string;
  upload_url: string;
  url: string;
  zipball_url: string;
}

export class RateLimitExceeded extends Error {
  constructor() {
    super('Too many requests to GitHub');
    this.name = this.constructor.name;
  }
}

/**
 * wrap requests to the Vortex GitHub repo, caching results where appropriate
 *
 * @class GitHub
 */
class GitHub {
  // oldest release to be returned when retrieving releases
  private static RELEASE_CUTOFF = '0.12.7';
  private static USER_AGENT = 'Vortex';
  private static CONFIG_BRANCH = 'announcements';

  private static repoUrl() {
    
    const isPreviewBuild = process.env.IS_PREVIEW_BUILD === 'true' ?? false
    const repo = isPreviewBuild ? 'Vortex-Staging' : 'Vortex'

    return `https://api.github.com/repos/Nexus-Mods/${repo}`;
  }

  private static rawUrl() {

    const isPreviewBuild = process.env.IS_PREVIEW_BUILD === 'true' ?? false
    const repo = isPreviewBuild ? 'Vortex-Staging' : 'Vortex'

    return `https://raw.githubusercontent.com/Nexus-Mods/${repo}`;
  }

  private mReleaseCache: Promise<IGitHubRelease[]>;
  private mRatelimitReset: number;

  public releases(): Promise<IGitHubRelease[]> {
    if (this.mReleaseCache === undefined) {
      this.mReleaseCache = this.queryReleases()
        .catch(err => {
          this.mReleaseCache = undefined;
          return Promise.reject(err);
        });
    }

    return this.mReleaseCache;
  }

  public fetchConfig(config: string): Promise<any> {
    return this.query(GitHub.rawUrl(), `${GitHub.CONFIG_BRANCH}/${config}.json`);
  }

  private query(baseUrl: string, request: string): Promise<any> {
    if ((this.mRatelimitReset !== undefined) && (this.mRatelimitReset > Date.now())) {
      return Promise.reject(new RateLimitExceeded());
    }
    const stackErr = new Error();

    return new Promise((resolve, reject) => {
        const relUrl = url.parse(`${baseUrl}/${request}`);
        const options: https.RequestOptions = {
          ..._.pick(relUrl, ['port', 'hostname', 'path']),
          headers: {
            'User-Agent': GitHub.USER_AGENT,
          },
        };

        https.get(options, res => {
          res.setEncoding('utf-8');
          const callsRemaining = parseInt(res.headers['x-ratelimit-remaining'] as string, 10);
          if ((res.statusCode === 403) && (callsRemaining === 0)) {
            const resetDate = parseInt(res.headers['x-ratelimit-reset'] as string, 10) * 1000;
            log('info', 'GitHub rate limit exceeded',
              { reset_at: (new Date(resetDate)).toString() });
            this.mRatelimitReset = resetDate;
            return reject(new RateLimitExceeded());
          }

          let output = '';
          res
            .on('data', data => output += data)
            .on('end', () => {
              try {
                return resolve(JSON.parse(output));
              } catch (parseErr) {
                const message = output.split('\n')[0];
                const error = new Error(message);
                error.stack = stackErr.stack;
                reject(error);
              }
            });
        })
          .on('error', err => {
            reject(err);
          })
          .end();
      });
  }

  private queryReleases(): Promise<IGitHubRelease[]> {
    return this.query(GitHub.repoUrl(), 'releases')
      .then((releases: IGitHubRelease[]) => {
        if (!Array.isArray(releases)) {
          return Promise.reject(new DataInvalid('expected array of github releases'));
        }
        const current = releases
          .filter(rel => semver.valid(rel.name) && semver.gte(rel.name, GitHub.RELEASE_CUTOFF))
          .sort((lhs, rhs) => semver.compare(lhs.name, rhs.name));

        return Promise.resolve(current);
      });
  }
}

export default new GitHub();
