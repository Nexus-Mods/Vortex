using System.IO;
using Utils;

namespace FomodInstaller.Scripting
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
        /// <summary>
        /// Gets or sets the path at which the current game is installed.
        /// </summary>
        /// <value>The path at which the current game is installed.</value>
        protected string GameInstallationPath { get; set; }

        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the given values.
        /// </summary>
        /// <param name="gameInstallationPath">The path at which the current game is installed.</param>
        public DataFileUtil(string gameInstallationPath)
		{
			GameInstallationPath = gameInstallationPath;
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
        /// <param name="checkPath">The path whose safety is to be verified.</param>
        /// <returns><c>true</c> if the given path is safe to write to;
        /// <c>false</c> otherwise.</returns>
        private bool IsSafeFilePath(string checkPath)
		{
            return FileSystem.IsSafeFilePath(checkPath);
		}

        /// <summary>
        /// Ensures that the given path is safe to be accessed.
        /// </summary>
        /// <param name="checkPath">The path whose safety is to be verified.</param>
        /// <seealso cref="IsSafeFilePath"/>
        public void AssertFilePathIsSafe(string checkPath)
		{
			if (!IsSafeFilePath(checkPath))
				throw new FileNotFoundException(checkPath);
		}

        /// <summary>
        /// Determines if the specified file exists in the user's Data directory.
        /// </summary>
        /// <param name="filePath">The path of the file whose existence is to be verified.</param>
        /// <returns><c>true</c> if the specified file exists;
        /// <c>false</c> otherwise.</returns>
        public bool DataFileExists(string filePath)
		{
			AssertFilePathIsSafe(filePath);
			string DataPath = Path.Combine(GameInstallationPath, filePath);
#if DEBUG
			new System.Security.Permissions.FileIOPermission(System.Security.Permissions.FileIOPermissionAccess.Read, DataPath).Demand();
#endif
			return FileSystem.FileExists(DataPath);
		}

        /// <summary>
        /// Gets a filtered list of all files in a user's Data directory.
        /// </summary>
        /// <param name="dataPath">The subdirectory of the Data directory from which to get the listing.</param>
        /// <param name="filterPattern">The pattern against which to filter the file paths.</param>
        /// <param name="isRecursive">Whether or not to search through subdirectories.</param>
        /// <returns>A filtered list of all files in a user's Data directory.</returns>
        public string[] GetExistingDataFileList(string dataPath, string filterPattern, bool isRecursive)
		{
			AssertFilePathIsSafe(dataPath);
			return FileSystem.GetFiles(Path.Combine(GameInstallationPath, dataPath), filterPattern, isRecursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly);
		}

        /// <summary>
        /// Gets the speified file from the user's Data directory.
        /// </summary>
        /// <param name="filePath">The path of the file to retrieve.</param>
        /// <returns>The specified file.</returns>
        /// <exception cref="FileNotFoundException">Thrown if the specified file does not exist.</exception>
        public byte[] GetExistingDataFile(string filePath)
		{
			AssertFilePathIsSafe(filePath);
			string DataPath = Path.GetFullPath(Path.Combine(GameInstallationPath, filePath));
			if (!FileSystem.FileExists(DataPath))
				throw new FileNotFoundException();
			return FileSystem.ReadAllBytes(DataPath);
		}
	}
}
