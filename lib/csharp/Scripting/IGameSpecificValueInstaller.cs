
namespace Scripting
{
	/// <summary>
	/// Describes the methods and properties of a Game Specific Value installer.
	/// </summary>
	/// <remarks>
	/// A Game Specific Value installer installs values that are specific to a game mode.
	/// </remarks>
	public interface IGameSpecificValueInstaller
	{
		/// <summary>
		/// Edits the specified game specific value.
		/// </summary>
		/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
		/// <param name="p_bteValue">The value to install.</param>
		/// <returns><c>true</c> if the value was set; <c>false</c> otherwise.</returns>
		bool EditGameSpecificValue(string p_strKey, byte[] p_bteValue);

		/// <summary>
		/// Undoes the edit made to the specified game specific value.
		/// </summary>
		/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
		void UnEditGameSpecificValue(string p_strKey);

		/// <summary>
		/// Finalizes the installation of the values.
		/// </summary>
		void FinalizeInstall();
	}
}
