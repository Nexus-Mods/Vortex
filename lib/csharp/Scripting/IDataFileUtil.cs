using System.IO;

namespace Scripting
{
	/// <summary>
	/// Describes the properties and methods of a data file utility.
	/// </summary>
	/// <remarks>
	/// A data file utility provides access to the user's installation path.
	/// </remarks>
	public interface IDataFileUtil
	{
		/// <summary>
		/// Ensures that the given path is safe to be accessed.
		/// </summary>
		/// <param name="p_strPath">The path whose safety is to be verified.</param>
		/// <exception cref="IllegalFilePathException">Thrown if the given path is not safe.</exception>
		void AssertFilePathIsSafe(string p_strPath);

		/// <summary>
		/// Determines if the specified file exists in the user's Data directory.
		/// </summary>
		/// <param name="p_strPath">The path of the file whose existence is to be verified.</param>
		/// <returns><c>true</c> if the specified file exists; <c>true</c>
		/// otherwise.</returns>
		/// <exception cref="IllegalFilePathException">Thrown if the given path is not safe.</exception>
		bool DataFileExists(string p_strPath);

		/// <summary>
		/// Gets a filtered list of all files in a user's Data directory.
		/// </summary>
		/// <param name="p_strPath">The subdirectory of the Data directory from which to get the listing.</param>
		/// <param name="p_strPattern">The pattern against which to filter the file paths.</param>
		/// <param name="p_booAllFolders">Whether or not to search through subdirectories.</param>
		/// <returns>A filtered list of all files in a user's Data directory.</returns>
		/// <exception cref="IllegalFilePathException">Thrown if the given path is not safe.</exception>
		string[] GetExistingDataFileList(string p_strPath, string p_strPattern, bool p_booAllFolders);

		/// <summary>
		/// Gets the speified file from the user's Data directory.
		/// </summary>
		/// <param name="p_strPath">The path of the file to retrieve.</param>
		/// <returns>The specified file.</returns>
		/// <exception cref="IllegalFilePathException">Thrown if the given path is not safe.</exception>
		/// <exception cref="FileNotFoundException">Thrown if the specified file does not exist.</exception>
		byte[] GetExistingDataFile(string p_strPath);
	}
}
