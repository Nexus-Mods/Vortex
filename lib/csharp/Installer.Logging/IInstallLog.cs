using Mods;
using System.Collections.Generic;
using System.IO;
using Util.Collections;

namespace Installer.Logging
{
	/// <summary>
	/// Describes the properties and methods of an install log.
	/// </summary>
	/// <remarks>
	/// An install log tracks items that are installed by mods.
	/// </remarks>
	public interface IInstallLog
	{
		#region Properties

		/// <summary>
		/// Gets the key of the mod representing original values.
		/// </summary>
		/// <remarks>
		/// Origianl values are values that were preexisting on the system.
		/// </remarks>
		/// <value>The key of the mod representing original values.</value>
		string OriginalValuesKey { get; }

		/// <summary>
		/// Gets the list of active mods.
		/// </summary>
		/// <value>The list of active mods.</value>
		ReadOnlyObservableList<IMod> ActiveMods { get; }

		#endregion

		#region Mod Tracking

		/// <summary>
		/// Adds a mod to the install log.
		/// </summary>
		/// <remarks>
		/// Adding a mod to the install log assigns it a key. Keys are used to track file and
		/// edit versions.
		/// 
		/// If there is no current transaction, the mod is added directly to the install log. Otherwise,
		/// the mod is added to a buffer than can later be committed or rolled back.
		/// </remarks>
		/// <param name="p_modMod">The <see cref="IMod"/> being added.</param>
		void AddActiveMod(IMod p_modMod);

		IInstallLog ReInitialize(Stream p_strLogStream);

		/// <summary>
		/// Replaces a mod in the install log, in a transaction.
		/// </summary>
		/// <remarks>
		/// This replaces a mod in the install log without changing its key.
		/// </remarks>
		/// <param name="p_modOldMod">The mod with to be replaced with the new mod in the install log.</param>
		/// <param name="p_modNewMod">The mod with which to replace the old mod in the install log.</param>
		void ReplaceActiveMod(IMod p_modOldMod, IMod p_modNewMod);

		/// <summary>
		/// Gets the key that was assigned to the specified mod.
		/// </summary>
		/// <param name="p_modMod">The mod whose key is to be retrieved.</param>
		/// <returns>The key that was assigned to the specified mod, or <c>null</c> if
		/// the specified mod has no key.</returns>
		string GetModKey(IMod p_modMod);

		/// <summary>
		/// Gets the list of mods whose versions don't match the version in the install log.
		/// </summary>
		/// <returns>The list of mods whose versions don't match the version in the install log.
		/// The key is the mod info stored in the install log. The value is the actual mod
		/// registered with the mod manager.</returns>
		IEnumerable<KeyValuePair<IMod, IMod>> GetMismatchedVersionMods();

		#endregion

		#region Uninstall

		/// <summary>
		/// Removes the mod, as well as entries for items installed by the given mod,
		/// from the install log.
		/// </summary>
		/// <param name="p_modUninstaller">The mod to remove.</param>
		void RemoveMod(IMod p_modUninstaller);

		#endregion

		#region File Version Management

		/// <summary>
		/// Logs the specified data file as having been installed by the given mod.
		/// </summary>
		/// <param name="p_modInstallingMod">The mod installing the specified data file.</param>
		/// <param name="p_strDataFilePath">The file bieng installed.</param>
		void AddDataFile(IMod p_modInstallingMod, string p_strDataFilePath);

		/// <summary>
		/// Removes the specified data file as having been installed by the given mod.
		/// </summary>
		/// <param name="p_modInstallingMod">The mod for which to remove the specified data file.</param>
		/// <param name="p_strDataFilePath">The file being removed for the given mod.</param>
		void RemoveDataFile(IMod p_modInstallingMod, string p_strDataFilePath);

		/// <summary>
		/// Gets the mod that owns the specified file.
		/// </summary>
		/// <param name="p_strPath">The path of the file whose owner is to be retrieved.</param>
		/// <returns>The mod that owns the specified file or null if there is no mod associated with the file.</returns>
		IMod GetCurrentFileOwner(string p_strPath);

		/// <summary>
		/// Gets the mod that owned the specified file prior to the current owner.
		/// </summary>
		/// <param name="p_strPath">The path of the file whose previous owner is to be retrieved.</param>
		/// <returns>The mod that owned the specified file prior to the current owner or null if there is no previous mod associated with the file.</returns>
		IMod GetPreviousFileOwner(string p_strPath);

		/// <summary>
		/// Gets the key of the mod that owns the specified file.
		/// </summary>
		/// <param name="p_strPath">The path of the file whose owner is to be retrieved.</param>
		/// <returns>The key of the mod that owns the specified file or null if there is no mod associated with the file</returns>
		string GetCurrentFileOwnerKey(string p_strPath);

		/// <summary>
		/// Gets the key of the mod that owned the specified file prior to the current owner.
		/// </summary>
		/// <param name="p_strPath">The path of the file whose previous owner is to be retrieved.</param>
		/// <returns>The key of the mod that owned the specified file prior to the current owner or null if there is no previous mod associated with the file.</returns>
		string GetPreviousFileOwnerKey(string p_strPath);

		/// <summary>
		/// Logs that the specified data file is an original value.
		/// </summary>
		/// <remarks>
		/// Logging an original data file prepares it to be overwritten by a mod's file.
		/// </remarks>
		/// <param name="p_strDataFilePath">The path of the data file to log as an
		/// original value.</param>
		void LogOriginalDataFile(string p_strDataFilePath);

		/// <summary>
		/// Gets the list of files that were installed by the given mod.
		/// </summary>
		/// <param name="p_modInstaller">The mod whose installed files are to be returned.</param>
		/// <returns>The list of files that were installed by the given mod.</returns>
		IList<string> GetInstalledModFiles(IMod p_modInstaller);

		/// <summary>
		/// Gets all of the mods that have installed the specified file.
		/// </summary>
		/// <param name="p_strPath">The path of the file whose installers are to be retrieved.</param>
		/// <returns>All of the mods that have installed the specified file.</returns>
		IList<IMod> GetFileInstallers(string p_strPath);

		#endregion

		#region INI Version Management

		/// <summary>
		/// Logs the specified INI edit as having been installed by the given mod.
		/// </summary>
		/// <param name="p_modInstallingMod">The mod installing the specified INI edit.</param>
		/// <param name="p_strSettingsFileName">The name of the edited INI file.</param>
		/// <param name="p_strSection">The section containting the INI edit.</param>
		/// <param name="p_strKey">The key of the edited INI value.</param>
		/// <param name="p_strValue">The value installed by the mod.</param>
		void AddIniEdit(IMod p_modInstallingMod, string p_strSettingsFileName, string p_strSection, string p_strKey, string p_strValue);

		/// <summary>
		/// Replaces the edited value of the specified INI edit installed by the given mod.
		/// </summary>
		/// <param name="p_modInstallingMod">The mod whose INI edit value is to be replaced.</param>
		/// <param name="p_strSettingsFileName">The name of the Ini value whose edited value is to be replaced.</param>
		/// <param name="p_strSection">The section of the Ini value whose edited value is to be replaced.</param>
		/// <param name="p_strKey">The key of the Ini value whose edited value is to be replaced.</param>
		/// <param name="p_strValue">The value with which to replace the edited value of the specified INI edit installed by the given mod.</param>
		void ReplaceIniEdit(IMod p_modInstallingMod, string p_strSettingsFileName, string p_strSection, string p_strKey, string p_strValue);

		/// <summary>
		/// Removes the specified ini edit as having been installed by the given mod.
		/// </summary>
		/// <param name="p_modInstallingMod">The mod for which to remove the specified ini edit.</param>
		/// <param name="p_strSettingsFileName">The name of the edited INI file containing the INI edit being removed for the given mod.</param>
		/// <param name="p_strSection">The section containting the INI edit being removed for the given mod.</param>
		/// <param name="p_strKey">The key of the edited INI value whose edit is being removed for the given mod.</param>
		void RemoveIniEdit(IMod p_modInstallingMod, string p_strSettingsFileName, string p_strSection, string p_strKey);

		/// <summary>
		/// Gets the mod that owns the specified INI edit.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the edited INI file.</param>
		/// <param name="p_strSection">The section containting the INI edit.</param>
		/// <param name="p_strKey">The key of the edited INI value.</param>
		/// <returns>The mod that owns the specified INI edit.</returns>
		IMod GetCurrentIniEditOwner(string p_strSettingsFileName, string p_strSection, string p_strKey);

		/// <summary>
		/// Gets the key of the mod that owns the specified INI edit.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the edited INI file.</param>
		/// <param name="p_strSection">The section containting the INI edit.</param>
		/// <param name="p_strKey">The key of the edited INI value.</param>
		/// <returns>The key of the mod that owns the specified INI edit.</returns>
		string GetCurrentIniEditOwnerKey(string p_strSettingsFileName, string p_strSection, string p_strKey);

		/// <summary>
		/// Gets the value of the specified key before it was most recently overwritten.
		/// </summary>
		/// <param name="p_strSettingsFileName">The Ini file containing the key whose previous value is to be retrieved.</param>
		/// <param name="p_strSection">The section containing the key whose previous value is to be retrieved.</param>
		/// <param name="p_strKey">The key whose previous value is to be retrieved.</param>
		/// <returns>The value of the specified key before it was most recently overwritten, or
		/// <c>null</c> if there was no previous value.</returns>
		string GetPreviousIniValue(string p_strSettingsFileName, string p_strSection, string p_strKey);

		/// <summary>
		/// Logs that the specified INI value is an original value.
		/// </summary>
		/// <remarks>
		/// Logging an original INI value prepares it to be overwritten by a mod's value.
		/// </remarks>
		/// <param name="p_strSettingsFileName">The name of the INI file containing the original value to log.</param>
		/// <param name="p_strSection">The section containting the original INI value to log.</param>
		/// <param name="p_strKey">The key of the original INI value to log.</param>
		/// <param name="p_strValue">The original value.</param>
		void LogOriginalIniValue(string p_strSettingsFileName, string p_strSection, string p_strKey, string p_strValue);

		/// <summary>
		/// Gets the list of INI edits that were installed by the given mod.
		/// </summary>
		/// <param name="p_modInstaller">The mod whose installed edits are to be returned.</param>
		/// <returns>The list of edits that was installed by the given mod.</returns>
		IList<IniEdit> GetInstalledIniEdits(IMod p_modInstaller);

		/// <summary>
		/// Gets all of the mods that have installed the specified Ini edit.
		/// </summary>
		/// <param name="p_strSettingsFileName">The Ini file containing the key whose installers are to be retrieved.</param>
		/// <param name="p_strSection">The section containing the key whose installers are to be retrieved.</param>
		/// <param name="p_strKey">The key whose installers are to be retrieved.</param>
		/// <returns>All of the mods that have installed the specified Ini edit.</returns>
		IList<IMod> GetIniEditInstallers(string p_strSettingsFileName, string p_strSection, string p_strKey);

		#endregion

		#region Game Specific Value Version Management

		/// <summary>
		/// Logs the specified Game Specific Value edit as having been installed by the given mod.
		/// </summary>
		/// <param name="p_modInstallingMod">The mod installing the specified INI edit.</param>
		/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
		/// <param name="p_bteValue">The value installed by the mod.</param>
		void AddGameSpecificValueEdit(IMod p_modInstallingMod, string p_strKey, byte[] p_bteValue);

		/// <summary>
		/// Replaces the edited value of the specified game specific value edit installed by the given mod.
		/// </summary>
		/// <param name="p_modInstallingMod">The mod whose game specific value edit value is to be replaced.</param>
		/// <param name="p_strKey">The key of the game spcified value whose edited value is to be replaced.</param>
		/// <param name="p_bteValue">The value with which to replace the edited value of the specified game specific value edit installed by the given mod.</param>
		void ReplaceGameSpecificValueEdit(IMod p_modInstallingMod, string p_strKey, byte[] p_bteValue);

		/// <summary>
		/// Removes the specified Game Specific Value edit as having been installed by the given mod.
		/// </summary>
		/// <param name="p_modInstallingMod">The mod for which to remove the specified Game Specific Value edit.</param>
		/// <param name="p_strKey">The key of the Game Specific Value whose edit is being removed for the given mod.</param>
		void RemoveGameSpecificValueEdit(IMod p_modInstallingMod, string p_strKey);

		/// <summary>
		/// Gets the mod that owns the specified Game Specific Value edit.
		/// </summary>
		/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
		/// <returns>The mod that owns the specified Game Specific Value edit.</returns>
		IMod GetCurrentGameSpecificValueEditOwner(string p_strKey);

		/// <summary>
		/// Gets the key of the mod that owns the specified Game Specific Value edit.
		/// </summary>
		/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
		/// <returns>The key of the mod that owns the specified Game Specific Value edit.</returns>
		string GetCurrentGameSpecificValueEditOwnerKey(string p_strKey);

		/// <summary>
		/// Gets the value of the specified key before it was most recently overwritten.
		/// </summary>
		/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
		/// <returns>The value of the specified key before it was most recently overwritten, or
		/// <c>null</c> if there was no previous value.</returns>
		byte[] GetPreviousGameSpecificValue(string p_strKey);

		/// <summary>
		/// Logs that the specified Game Specific Value is an original value.
		/// </summary>
		/// <remarks>
		/// Logging an original Game Specific Value prepares it to be overwritten by a mod's value.
		/// </remarks>
		/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
		/// <param name="p_bteValue">The original value.</param>
		void LogOriginalGameSpecificValue(string p_strKey, byte[] p_bteValue);

		/// <summary>
		/// Gets the list of Game Specific Value edited keys that were installed by the given mod.
		/// </summary>
		/// <param name="p_modInstaller">The mod whose installed edits are to be returned.</param>
		/// <returns>The list of edited keys that was installed by the given mod.</returns>
		IList<string> GetInstalledGameSpecificValueEdits(IMod p_modInstaller);

		/// <summary>
		/// Gets all of the mods that have installed the specified game specific value edit.
		/// </summary>
		/// <param name="p_strKey">The key whose installers are to be retrieved.</param>
		/// <returns>All of the mods that have installed the specified game specific value edit.</returns>
		IList<IMod> GetGameSpecificValueEditInstallers(string p_strKey);

		#endregion

		byte[] GetXMLModList();
		byte[] GetXMLIniList();
	}
}
