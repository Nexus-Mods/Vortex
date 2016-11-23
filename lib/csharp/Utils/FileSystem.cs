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
	}
}
