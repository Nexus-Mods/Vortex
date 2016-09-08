
using Mods;

namespace Installer
{
	/// <summary>
	/// This asks the use to confirm the upgrading of the given old mod to the given new mod.
	/// </summary>
	/// <param name="p_modOld">The old mod to be upgrade to the new mod.</param>
	/// <param name="p_modNew">The new mod to which to upgrade from the old.</param>
	/// <returns>The user's choice.</returns>
	public delegate ConfirmUpgradeResult ConfirmModUpgradeDelegate(IMod p_modOld, IMod p_modNew);
}
