using System.IO;
using Utils;

namespace Components.Scripting
{
	/// <summary>
	/// This class provides access to the user's installation path.
	/// </summary>
	/// <remarks>
	/// This class ensures that the calling code only has access to the parts of the
	/// file system that are related to the game mode currently being managed.
	/// </remarks>
	public class DataFileUtil 
	{
        #region Fields

        protected static FileSystem FileSystem;

        #endregion
        
        /// <summary>
        /// Gets or sets the path at which the current game is installed.
        /// </summary>
        /// <value>The path at which the current game is installed.</value>
        protected string GameInstallationPath { get; set; }

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strGameInstallationPath">The path at which the current game is installed.</param>
		public DataFileUtil(string p_strGameInstallationPath)
		{
			GameInstallationPath = p_strGameInstallationPath;
		}

		#endregion

		/// <summary>
		/// Verifies if the given path is safe to be written to.
		/// </summary>
		/// <remarks>
		/// A path is safe to be written to if it contains no charaters
		/// disallowed by the operating system, and if is is in the Data
		/// directory or one of its sub-directories.
		/// </remarks>
		/// <param name="p_strPath">The path whose safety is to be verified.</param>
		/// <returns><c>true</c> if the given path is safe to write to;
		/// <c>false</c> otherwise.</returns>
		private bool IsSafeFilePath(string p_strPath)
		{
            return FileSystem.IsSafeFilePath(p_strPath);
		}

		/// <summary>
		/// Ensures that the given path is safe to be accessed.
		/// </summary>
		/// <param name="p_strPath">The path whose safety is to be verified.</param>
		/// <seealso cref="IsSafeFilePath"/>
		public void AssertFilePathIsSafe(string p_strPath)
		{
			if (!IsSafeFilePath(p_strPath))
				throw new FileNotFoundException(p_strPath);
		}

		/// <summary>
		/// Determines if the specified file exists in the user's Data directory.
		/// </summary>
		/// <param name="p_strPath">The path of the file whose existence is to be verified.</param>
		/// <returns><c>true</c> if the specified file exists;
		/// <c>false</c> otherwise.</returns>
		public bool DataFileExists(string p_strPath)
		{
			AssertFilePathIsSafe(p_strPath);
			string datapath = Path.Combine(GameInstallationPath, p_strPath);
#if DEBUG
			new System.Security.Permissions.FileIOPermission(System.Security.Permissions.FileIOPermissionAccess.Read, datapath).Demand();
#endif
			return FileSystem.FileExists(datapath);
		}

		/// <summary>
		/// Gets a filtered list of all files in a user's Data directory.
		/// </summary>
		/// <param name="p_strPath">The subdirectory of the Data directory from which to get the listing.</param>
		/// <param name="p_strPattern">The pattern against which to filter the file paths.</param>
		/// <param name="p_booAllFolders">Whether or not to search through subdirectories.</param>
		/// <returns>A filtered list of all files in a user's Data directory.</returns>
		public string[] GetExistingDataFileList(string p_strPath, string p_strPattern, bool p_booAllFolders)
		{
			AssertFilePathIsSafe(p_strPath);
			return FileSystem.GetFiles(Path.Combine(GameInstallationPath, p_strPath), p_strPattern, p_booAllFolders ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly);
		}

		/// <summary>
		/// Gets the speified file from the user's Data directory.
		/// </summary>
		/// <param name="p_strPath">The path of the file to retrieve.</param>
		/// <returns>The specified file.</returns>
		/// <exception cref="FileNotFoundException">Thrown if the specified file does not exist.</exception>
		public byte[] GetExistingDataFile(string p_strPath)
		{
			AssertFilePathIsSafe(p_strPath);
			string datapath = Path.GetFullPath(Path.Combine(GameInstallationPath, p_strPath));
			if (!FileSystem.FileExists(datapath))
				throw new FileNotFoundException();
			return FileSystem.ReadAllBytes(datapath);
		}
	}
}
