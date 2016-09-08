using System.Collections.Generic;
using Util;

namespace Mods
{
	/// <summary>
	/// The interface for mods.
	/// </summary>
	public interface IMod : IModInfo, IScriptedMod
	{
		#region Properties

		/// <summary>
		/// Gets the filename of the mod. This is the file path of ModArchivePath
		/// </summary>
		/// <value>The filename of the mod.</value>
		string Filename { get; }

		/// <summary>
		/// Gets the path to the mod archive.
		/// </summary>
		/// <value>The path to the mod archive.</value>
		string ModArchivePath { get; }

		/// <summary>
		/// Gets the format of the mod.
		/// </summary>
		/// <value>The format of the mod.</value>
		IModFormat Format { get; }

		/// <summary>
		/// Gets the internal path to the screenshot.
		/// </summary>
		/// <remarks>
		/// This property return a path that can be passed to the <see cref="GetFile(string)"/>
		/// method.
		/// </remarks>
		/// <value>The internal path to the screenshot.</value>
		string ScreenshotPath { get; }

		#endregion

		#region Read Transactions

		/// <summary>
		/// Raised to update listeners on the progress of the read-only initialization.
		/// </summary>
		event CancelProgressEventHandler ReadOnlyInitProgressUpdated;

		/// <summary>
		/// Starts a read-only transaction.
		/// </summary>
		/// <remarks>
		/// This puts the Mod into read-only mode.
		/// 
		/// Read-only mode can greatly increase the speed at which multiple file are extracted.
		/// </remarks>
		void BeginReadOnlyTransaction(IFileSystem p_futFileUtil);

		/// <summary>
		/// Ends a read-only transaction.
		/// </summary>
		/// <remarks>
		/// This takes the Mod out of read-only mode.
		/// 
		/// Read-only mode can greatly increase the speed at which multiple file are extracted.
		/// </remarks>
		void EndReadOnlyTransaction();

		#endregion

		#region File Management

		/// <summary>
		/// Retrieves the specified file from the mod.
		/// </summary>
		/// <param name="p_strFile">The file to retrieve.</param>
		/// <returns>The requested file data.</returns>
		/// <exception cref="System.IO.FileNotFoundException">Thrown if the specified file
		/// is not in the mod.</exception>
		byte[] GetFile(string p_strFile);

		/// <summary>
		/// Retrieves the list of files in this Mod.
		/// </summary>
		/// <returns>The list of files in this Mod.</returns>
		List<string> GetFileList();
		
		/// <summary>
		/// Retrieves the list of all files in the specified Mod folder.
		/// </summary>
		/// <param name="p_strFolderPath">The Mod folder whose file list is to be retrieved.</param>
		/// <param name="p_booRecurse">Whether to return files that are in subdirectories of the given directory.</param>
		/// <returns>The list of all files in the specified Mod folder.</returns>
		List<string> GetFileList(string p_strFolderPath, bool p_booRecurse);

		/// <summary>
		/// Determines if last known version is the same as the current version.
		/// </summary>
		/// <returns><c>true</c> if the versions are the same;
		/// <c>false</c> otherwise.</returns>
		bool IsMatchingVersion();

		#endregion
	}
}
