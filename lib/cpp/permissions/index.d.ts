export interface IOptions {
  recursive?: boolean;
}

export type Permission = 'r' | 'w' | 'x' | 'rw' | 'rx' | 'wx' | 'rwx';
export type UserGroup = 'everyone' | 'owner' | 'group' | 'guest' | 'administrator';

export function allow(path: string, group: UserGroup, rights: Permission): Promise<void>;
