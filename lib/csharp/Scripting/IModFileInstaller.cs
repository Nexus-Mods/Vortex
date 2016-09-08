using System;
using System.Collections.Generic;

namespace Scripting
{
	/// <summary>
	/// Interface for file operations ordered by an installer script.
	/// </summary>
	/// <remarks>
	/// A mod file installer installs mod files.
	/// </remarks>
	public interface IModFileInstaller
	{
		/// <summary>
		/// Installs the speified file from the Mod to the file system.
		/// </summary>
		/// <param name="p_strModFilePath">The path of the file in the Mod to install.</param>
		/// <param name="p_strInstallPath">The path on the file system where the file is to be created.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> if the user chose
		/// not to overwrite an existing file.</returns>
		bool InstallFileFromMod(string p_strModFilePath, string p_strInstallPath);

		/// <summary>
		/// Writes the file represented by the given byte array to the given path.
		/// </summary>
		/// <remarks>
		/// This method writes the given data as a file at the given path. If the file
		/// already exists the user is prompted to overwrite the file.
		/// </remarks>
		/// <param name="p_strPath">The path where the file is to be created.</param>
		/// <param name="p_bteData">The data that is to make up the file.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> if the user chose
		/// not to overwrite an existing file.</returns>
		/// <exception cref="Nexus.Client.ModManagement.Scripting.IllegalFilePathException">Thrown if <paramref name="p_strPath"/> is
		/// not safe.</exception>
		bool GenerateDataFile(string p_strPath, byte[] p_bteData);

		/// <summary>
		/// Checks whether the file is a gamebryo-like plugin and if the program can activate it.
		/// </summary>
		bool PluginCheck(string p_strPath, bool p_booRemove);

		/// <summary>
		/// Uninstalls the specified file.
		/// </summary>
		/// <remarks>
		/// If the mod we are uninstalling doesn't own the file, then its version is removed
		/// from the overwrites directory. If the mod we are uninstalling overwrote a file when it
		/// installed the specified file, then the overwritten file is restored. Otherwise
		/// the file is deleted.
		/// </remarks>
		/// <param name="p_strPath">The path to the file that is to be uninstalled.</param>
		bool UninstallDataFile(string p_strPath);

		/// <summary>
		/// Finalizes the installation of the files.
		/// </summary>
		void FinalizeInstall();

		/// <summary>
		/// Gets a list of install errors.
		/// </summary>
		/// <value>The list of errors.</value>
		List<string> InstallErrors { get; }
	}
}
