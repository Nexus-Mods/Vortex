using IniEditing;
using PluginManagement;

namespace Scripting
{
	/// <summary>
	/// This groups together the installers need to install mods.
	/// </summary>
	public class InstallerGroup
	{
		#region Properties

		/// <summary>
		/// Gets the utility class to use to work with data files.
		/// </summary>
		/// <value>The utility class to use to work with data files.</value>
		public IDataFileUtil DataFileUtility { get; private set; }

		/// <summary>
		/// Gets or sets the installer to use to install files.
		/// </summary>
		/// <value>The installer to use to install files.</value>
		public IModFileInstaller FileInstaller { get; private set; }

		/// <summary>
		/// Gets or sets the installer to use to install INI values.
		/// </summary>
		/// <value>The installer to use to install INI values.</value>
		public IIniEditor IniEditor { get; private set; }

		/// <summary>
		/// Gets or sets the installer to use to install game specific values.
		/// </summary>
		/// <value>The installer to use to install game specific values.</value>
		public IGameSpecificValueInstaller GameSpecificValueInstaller { get; private set; }

		/// <summary>
		/// Gets manager to use to manage plugins.
		/// </summary>
		/// <value>The manager to use to manage plugins.</value>
		public IPluginManager PluginManager { get; private set; }

		#endregion

		/// <summary>
		/// A sinmple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_dfuDataFileUtility">The utility class to use to work with data files.</param>
		/// <param name="p_mfiFileInstaller">The installer to use to install files.</param>
		/// <param name="p_iniIniEditor">The installer to use to install INI values.</param>
		public InstallerGroup(IDataFileUtil p_dfuDataFileUtility, IModFileInstaller p_mfiFileInstaller, IIniEditor p_iniIniEditor, IGameSpecificValueInstaller p_gviValueInstaller)
		{
			DataFileUtility = p_dfuDataFileUtility;
			FileInstaller = p_mfiFileInstaller;
			IniEditor = p_iniIniEditor;
			GameSpecificValueInstaller = p_gviValueInstaller;
		}
	}
}
