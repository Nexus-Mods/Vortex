/**
 * Whether mkeiitmods should make itself the system handler for nxm:// links.
 *
 * Vortex does this on first start (setting not yet chosen). mkeiitmods must not take the
 * links away from an installed Vortex without being asked, so only an explicit opt-in from
 * the "Handle Nexus Links" setting counts.
 */
export function shouldClaimNxmLinks(associateSetting: boolean | undefined): boolean {
  return associateSetting === true;
}
