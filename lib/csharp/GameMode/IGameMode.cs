using Mods;
using System;
using System.Collections.Generic;

namespace GameMode
{
	/// <summary>
	/// Describes the properties and methods of a game mode.
	/// </summary>
	/// <remarks>
	/// A game mode exposes the info and functionality that describes a game-specific environemnt in which
	/// mods are managed.
	/// </remarks>
	public interface IGameMode : IGameModeDescriptor, IDisposable
	{
		#region Properties

		/// <summary>
		/// Gets the information about the game mode's environement.
		/// </summary>
		/// <value>The information about the game mode's environement.</value>
		IGameModeEnvironmentInfo GameModeEnvironmentInfo { get; }

		/// <summary>
		/// Gets the version of the installed game.
		/// </summary>
		/// <value>The version of the installed game.</value>
		Version GameVersion { get; }

		/// <summary>
		/// Gets a list of paths to which the game mode writes.
		/// </summary>
		/// <value>A list of paths to which the game mode writes.</value>
		IEnumerable<string> WritablePaths { get; }

		/// <summary>
		/// Gets the game launcher for the game mode.
		/// </summary>
		/// <value>The game launcher for the game mode.</value>
		IGameLauncher GameLauncher { get; }

		/// <summary>
		/// Gets the tool launcher for the game mode.
		/// </summary>
		/// <value>The tool launcher for the game mode.</value>
		IToolLauncher GameToolLauncher { get; }
		
		/// <summary>
		/// Gets whether the game mode uses plugins.
		/// </summary>
		/// <remarks>
		/// This indicates whether the game mode used plugins that are
		/// installed by mods, or simply used mods, without
		/// plugins.
		/// 
		/// In games that use mods only, the installation of a mods package
		/// is sufficient to add the functionality to the game. The game
		/// will often have no concept of managable game modifications.
		/// 
		/// In games that use plugins, mods can install files that directly
		/// affect the game (similar to the mod-free use case), but can also
		/// install plugins that can be managed (for example activated/reordered)
		/// after the mod is installed.
		/// </remarks>
		/// <value>Whether the game mode uses plugins.</value>
		bool UsesPlugins { get; }

		/// <summary>
		/// Gets the default game categories.
		/// </summary>
		/// <value>The default game categories stored in the resource file.</value>
		string GameDefaultCategories { get; }

		/// <summary>
		/// Gets the default game files.
		/// </summary>
		/// <value>The default game files stored in the resource file.</value>
		string BaseGameFiles { get; }

		/// <summary>
		/// Gets the max allowed number of active plugins.
		/// </summary>
		/// <value>The max allowed number of active plugins (0 if there's no limit).</value>
		Int32 MaxAllowedActivePluginsCount { get; }

		/// <summary>
		/// Whether the game requires mod file merging.
		/// </summary>
		bool RequiresModFileMerge { get; }

		/// <summary>
		/// The name of the game's merged file.
		/// </summary>
		string MergedFileName { get; }

		/// <summary>
		/// Whether the game has a secondary install path.
		/// </summary>
		bool HasSecondaryInstallPath { get; }

		/// <summary>
		/// Whether the game requires the profile manager to save optional files.
		/// </summary>
		bool RequiresOptionalFilesCheckOnProfileSwitch { get; }

		/// <summary>
		/// Gets the tool launcher for the SupportedTools.
		/// </summary>
		/// <value>The tool launcher for the SupportedTools.</value>
		ISupportedToolsLauncher SupportedToolsLauncher { get; }

		#endregion

		/// <summary>
		/// Adjusts the given path to be relative to the installation path of the game mode.
		/// </summary>
		/// <remarks>
		/// This is basically a hack to allow older FOMods to work. Older FOMods assumed
		/// the installation path of Fallout games to be &lt;games>/data, but this new manager specifies
		/// the installation path to be &lt;games>. This breaks the older FOMods, so this method can detect
		/// the older FOMods (or other mod formats that needs massaging), and adjusts the given path
		/// to be relative to the new instaalation path to make things work.
		/// </remarks>
		/// <param name="p_mftModFormat">The mod format for which to adjust the path.</param>
		/// <param name="p_strPath">The path to adjust</param>
		/// <param name="p_booIgnoreIfPresent">Whether to ignore the path if the specific root is already present</param>
		/// <returns>The given path, adjusted to be relative to the installation path of the game mode.</returns>
		string GetModFormatAdjustedPath(IModFormat p_mftModFormat, string p_strPath, bool p_booIgnoreIfPresent);

		/// <summary>
		/// Adjusts the given path to be relative to the installation path of the game mode.
		/// </summary>
		/// <remarks>
		/// This is basically a hack to allow older FOMods to work. Older FOMods assumed
		/// the installation path of Fallout games to be &lt;games>/data, but this new manager specifies
		/// the installation path to be &lt;games>. This breaks the older FOMods, so this method can detect
		/// the older FOMods (or other mod formats that needs massaging), and adjusts the given path
		/// to be relative to the new instaalation path to make things work.
		/// </remarks>
		/// <param name="p_mftModFormat">The mod format for which to adjust the path.</param>
		/// <param name="p_strPath">The path to adjust.</param>
		/// <param name="p_modMod">The mod.</param>
		/// <param name="p_booIgnoreIfPresent">Whether to ignore the path if the specific root is already present</param>
		/// <returns>The given path, adjusted to be relative to the installation path of the game mode.</returns>
		string GetModFormatAdjustedPath(IModFormat p_mftModFormat, string p_strPath, IMod p_modMod, bool p_booIgnoreIfPresent);

		/// <summary>
		/// Checks whether the current game mode requires external config steps to be taken before installing mods.
		/// </summary>
		/// <returns>Whether the current game mode requires external config steps to be taken before installing mods.</returns>
		/// <param name="p_strMessage">The message to show to the user.</param>
		bool RequiresExternalConfig(out string p_strMessage);

		/// <summary>
		/// Whether to run a secondary tools if present.
		/// </summary>
		/// <returns>The path to the optional tool to run.</returns>
		/// <param name="p_strMessage">The message to show to the user.</param>
		string PostProfileSwitchTool(out string p_strMessage);

		/// <summary>
		/// Whether the profile manager should save extra files for the current game mode.
		/// </summary>
		/// <returns>The list of optional files to save (if present) in a profile.</returns>
		/// <param name="p_strMessage">The list of files/plugins/mods to save.</param>
		string[] GetOptionalFilesList(string[] p_strList);

		/// <summary>
		/// Whether the profile manager should load extra files for the current game mode.
		/// </summary>
		/// <returns>The list of optional files to load (if present) in a profile.</returns>
		/// <param name="p_strMessage">The list of files/plugins/mods to load.</param>
		void SetOptionalFilesList(string[] p_strList);

		/// <summary>
		/// The supported formats list.
		/// </summary>
		List<string> SupportedFormats { get; }
	}
}
