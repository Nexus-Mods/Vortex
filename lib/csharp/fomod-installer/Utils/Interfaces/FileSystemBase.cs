using System;
using System.IO;

namespace Utils
{
	public abstract class FileSystemBase: IFileSystem
	{
		/// <summary>
		/// Copies, moves or deletes a filesystem object using shell functionality
		/// (I.e. shows an OS dialog on overwrite, can move files to the recycle bin, ...)
		/// </summary>
		/// <param name="lpFileOp">Descriptor of the file operation to execute</param>
		/// <returns>An error code. please note that this function has its own set of error codes documented
		/// here: https://msdn.microsoft.com/en-us/library/windows/desktop/bb762164(v=vs.85).aspx </returns>
		public virtual int ShellFileOperation(ref SHFILEOPSTRUCT lpFileOp)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Creates a temporary directory rooted at the given path.
		/// </summary>
		/// <param name="basePath">The path under which to create the temporary directory.</param>
		/// <returns>The path to the newly created temporary directory.</returns>
		public virtual string CreateTempDirectory(string basePath)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Rename a directory
		/// </summary>
		/// <param name="nameOld">old name</param>
		/// <param name="nameNew">new name</param>
		/// <returns>true on success</returns>
		public virtual bool RenameDirectory(string nameOld, string nameNew)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Copies the source to the destination.
		/// </summary>
		/// <remarks>
		/// If the source is a directory, it is copied recursively.
		/// </remarks>
		/// <param name="sourcePath">The path from which to copy.</param>
		/// <param name="destinationPath">The path to which to copy.</param>
		/// <param name="fncCopyCallback">A callback method that notifies the caller when a file has been copied,
		/// and provides the opportunity to cancel the copy operation.</param>
		/// <returns><c>true</c> if the copy operation wasn't cancelled; <c>false</c> otherwise.</returns>
		public virtual bool Copy(string sourcePath, string destinationPath, Func<string, bool> fncCopyCallback)
		{
			throw new NotImplementedException();
		}
		
		/// <summary>
		/// Retrieves the list of files in the specified path that match a pattern
		/// </summary>
		/// <param name="searchPath">path to search in</param>
		/// <param name="pattern">the patterns have to match</param>
		/// <param name="searchOption">options to control how the search works (i.e. recursive vs. only the specified dir)</param>
		/// <returns></returns>
		public virtual string[] GetFiles(string searchPath, string pattern, SearchOption searchOption)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Writes the text in the specified file.
		/// </summary>
		/// <param name="path"></param>
		/// <param name="text"></param>
		public virtual void WriteAllLines(string path, string[] text)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Appends the text to the specified file.
		/// </summary>
		/// <param name="path"></param>
		/// <param name="text"></param>
		public virtual void AppendAllText(string path, string text)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Moves the specified file to the specified path, optionally overwritting
		/// any existing file.
		/// </summary>
		/// <param name="pathFrom">The path to the file to move.</param>
		/// <param name="pathTo">the path to which to move the file.</param>
		/// <param name="overwrite">Whether to overwrite any file found at the destination.</param>
		public virtual void Move(string pathFrom, string pathTo, bool overwrite = false)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Creates a directory at the given path.
		/// </summary>
		/// <remarks>
		/// The standard <see cref="Directory.CreateDirectory()"/> has a latency issue where
		/// the directory is not necessarily ready for use immediately after creation. This
		/// method waits until the cirectory is created and ready before returning.
		/// </remarks>
		/// <param name="path">The path of the directory to create.</param>
		public virtual void CreateDirectory(string path)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Forces deletion of the given path.
		/// </summary>
		/// <remarks>
		/// This method is recursive if the given path is a directory. This method will clear read only/system
		/// attributes if required to delete the path.
		/// </remarks>
		/// <param name="path">The path to delete.</param>
		public virtual void ForceDelete(string path)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Clears the attributes of the given path.
		/// </summary>
		/// <remarks>
		/// This sets the path's attributes to <see cref="FileAttributes.Normal"/>. This operation is
		/// optionally recursive.
		/// </remarks>
		/// <param name="path">The path whose attributes are to be cleared.</param>
		/// <param name="recurse">Whether or not to clear the attributes on all children files and folers.</param>
		public virtual void ClearAttributes(string path, bool recurse)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Clears the attributes of the given directory.
		/// </summary>
		/// <remarks>
		/// This sets the directory's attributes to <see cref="FileAttributes.Normal"/>. This operation is
		/// optionally recursive.
		/// </remarks>
		/// <param name="pathInfo">The directory whose attributes are to be cleared.</param>
		/// <param name="recurse">Whether or not to clear the attributes on all children files and folers.</param>
		public virtual void ClearAttributes(DirectoryInfo pathInfo, bool recurse)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Writes the given data to the specified file.
		/// </summary>
		/// <remarks>
		/// If the specified file exists, it will be overwritten. If the specified file
		/// does not exist, it is created. If the directory containing the specified file
		/// does not exist, it is created.
		/// </remarks>
		/// <param name="path">The path to which to write the given data.</param>
		/// <param name="dataBytes">The data to write to the file.</param>
		public virtual void WriteAllBytes(string path, byte[] dataBytes)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Writes the given data to the specified file.
		/// </summary>
		/// <remarks>
		/// If the specified file exists, it will be overwritten. If the specified file
		/// does not exist, it is created. If the directory containing the specified file
		/// does not exist, it is created.
		/// </remarks>
		/// <param name="path">The path to which to write the given text.</param>
		/// <param name="dataString">The text to write to the file.</param>
		public virtual void WriteAllText(string path, string dataString)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Test if a file exists
		/// </summary>
		/// <param name="filePath"></param>
		/// <returns></returns>
		public virtual bool FileExists(string filePath)
		{
			throw new NotImplementedException();
		}

        /// <summary>
        /// Test if a directory exists
        /// </summary>
        /// <param name="directoryPath"></param>
        /// <returns></returns>
        public virtual bool DirectoryExists(string directoryPath)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Check if the file is in use.
        /// </summary>
        public virtual bool IsFileLocked(string filePath)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Read whole content of a file into an array linewise
		/// </summary>
		/// <param name="filePath"></param>
		/// <returns></returns>
		public virtual string[] ReadAllLines(string filePath)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Read whole uninterpreted content of a file into a byte array
		/// </summary>
		/// <param name="filePath">path to the file to read</param>
		/// <returns></returns>
		public virtual byte[] ReadAllBytes(string filePath)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Delete a file
		/// </summary>
		/// <param name="path"></param>
		public virtual void Delete(string path)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Opens a file stream
		/// </summary>
		/// <param name="filePath">path of the file to open</param>
		/// <param name="fileMode">mode</param>
		/// <returns></returns>
		public virtual Stream Open(string filePath, FileMode fileMode)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Change the file attributes on a file
		/// </summary>
		/// <param name="filePath">path of the file to change</param>
		/// <param name="fileAttributes">new attributes</param>
		public virtual void SetAttributes(string filePath, FileAttributes fileAttributes)
		{
			throw new NotImplementedException();
		}

		/// <summary>
		/// Retrieve file attributes for a file
		/// </summary>
		/// <param name="filePath">path of the file</param>
		/// <returns>attributes or null if the file doesn't exist</returns>
		public virtual FileAttributes GetAttributes(string filePath)
		{
			throw new NotImplementedException();
		}

        /// <summary>
        /// Retrieve file info for a file
        /// </summary>
        /// <param name="filePath">path of the file</param>
        /// <returns>file info</returns>
        public virtual IFileInfo GetFileInfo(string filePath)
		{
			throw new NotImplementedException();
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
        public virtual bool IsSafeFilePath(string p_strPath)
        {
            throw new NotImplementedException();
        }
    }
}
