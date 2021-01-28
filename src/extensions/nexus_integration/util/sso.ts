import { NEXUS_BASE_URL } from '../constants';

export function getPageURL(loginId: string) {
  return `${NEXUS_BASE_URL}/sso?application=vortex&id=${loginId}`;
}
