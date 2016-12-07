using System.IO;

namespace Utils
{
	public partial class FileSystem : FileSystemBase
	{
		/// <summary>
		/// Test if a file exists
		/// </summary>
		/// <param name="filePath"></param>
		/// <returns></returns>
		public override bool FileExists(string filePath)
		{
			return File.Exists(filePath);
		}

        /// <summary>
        /// Test if a directory exists
        /// </summary>
        /// <param name="filePath"></param>
        /// <returns></returns>
        public override bool DirectoryExists(string directoryPath)
        {
            return Directory.Exists(directoryPath);
        }

        /// <summary>
        /// Read whole content of a file into an array linewise
        /// </summary>
        /// <param name="filePath"></param>
        /// <returns></returns>
        public override string[] ReadAllLines(string filePath)
		{
			return File.ReadAllLines(filePath);
		}

		/// <summary>
		/// Read whole uninterpreted content of a file into a byte array
		/// </summary>
		/// <param name="filePath">path to the file to read</param>
		/// <returns></returns>
		public override byte[] ReadAllBytes(string filePath)
		{
			return File.ReadAllBytes(filePath);
		}

		/// <summary>
		/// Opens a file stream
		/// </summary>
		/// <param name="filePath">path of the file to open</param>
		/// <param name="fileMode">mode</param>
		/// <returns></returns>
		public override Stream Open(string filePath, FileMode fileMode)
		{
			return File.Open(filePath, fileMode);
		}

		/// <summary>
		/// Retrieve file attributes for a file
		/// </summary>
		/// <param name="filePath">path of the file</param>
		/// <returns>attributes or null if the file doesn't exist</returns>
		public override FileAttributes GetAttributes(string filePath)
		{
			return File.GetAttributes(filePath);
		}

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
        public override bool IsSafeFilePath(string p_strPath)
        {
            if (p_strPath.IndexOfAny(Path.GetInvalidPathChars()) != -1)
                return false;
            if (Path.IsPathRooted(p_strPath))
                return false;
            if (p_strPath.Contains(".." + Path.AltDirectorySeparatorChar))
                return false;
            if (p_strPath.Contains(".." + Path.DirectorySeparatorChar))
                return false;
            return true;
        }
    }
}
