
namespace Installer
{
	/// <summary>
	/// The possible results of confirmation to upgrade a mod.
	/// </summary>
	public enum ConfirmUpgradeResult
	{
		/// <summary>
		/// Indicates no action should be performed.
		/// </summary>
		Cancel,

		/// <summary>
		/// Indicates an upgrade should be performed.
		/// </summary>
		Upgrade,

		/// <summary>
		/// Indicates the mod should be activated as a separate mod, not an upgrade.
		/// </summary>
		NormalActivation
	}
}
