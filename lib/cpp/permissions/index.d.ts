export interface IOptions {
  recursive?: boolean;
}

export type Permission = 'r' | 'rw' | 'rx' | 'rwx';
export type UserGroup = 'everyone' | 'group';

export function allow(path: string, group: UserGroup, rights: Permission): Promise<void>;
