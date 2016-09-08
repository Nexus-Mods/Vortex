using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace Util
{
	class NativeMethods
	{
        // Copies, moves, renames, or deletes a file system object. 
        [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
        public static extern Int32 SHFileOperation(
            ref SHFILEOPSTRUCT lpFileOp);       // Address of an SHFILEOPSTRUCT 
                                                // structure that contains information this function needs 
                                                // to carry out the specified operation. This parameter must 
                                                // contain a valid value that is not NULL. You are 
                                                // responsible for validating the value. If you do not 
                                                // validate it, you will experience unexpected results.
	}


	/// <summary>
	/// Utility functions to work with files.
	/// </summary>
	public class FileUtil : IFileSystem
    {


        // Contains information that the SHFileOperation function uses to perform 
        // file operations. 
        private enum Operation : UInt16
        {
            FO_MOVE = 0x0001,
            FO_COPY = 0x0002,
            FO_DELETE = 0x0003,
            FO_RENAME = 0x0004,
        }

        public Int32 ShellFileOperation(ref SHFILEOPSTRUCT lpFileOp)
        {
            return NativeMethods.SHFileOperation(ref lpFileOp);
        }

        /// <summary>
        /// Creates a temporary directory.
        /// </summary>
        /// <returns>The path to the newly created temporary directory.</returns>
        public virtual string CreateTempDirectory()
        {
            return CreateTempDirectory(Path.GetTempPath());
        }

        /// <summary>
        /// Creates a temporary directory rooted at the given path.
        /// </summary>
        /// <param name="p_strBasePath">The path under which to create the temporary directory.</param>
        /// <returns>The path to the newly created temporary directory.</returns>
        protected string CreateTempDirectory(string p_strBasePath)
        {
            for (Int32 i = 0; i < Int32.MaxValue; i++)
            {
                string strPath = Path.Combine(p_strBasePath, Path.GetRandomFileName());
                if (!Directory.Exists(strPath))
                {
                    Directory.CreateDirectory(strPath);
                    return strPath + Path.DirectorySeparatorChar;
                }
            }
            throw new Exception("Could not create temporary folder because directory is full.");
        }

        public bool RenameDirectory(string p_strSource, string p_strDest)
        {
            SHFILEOPSTRUCT struc = new SHFILEOPSTRUCT();

            struc.hNameMappings = IntPtr.Zero;
            struc.hwnd = IntPtr.Zero;
            struc.lpszProgressTitle = "Rename Release directory";
            struc.pFrom = Marshal.StringToHGlobalUni(p_strSource);
            struc.pTo = Marshal.StringToHGlobalUni(p_strDest);
            struc.wFunc = (uint)Operation.FO_RENAME;

            int ret = NativeMethods.SHFileOperation(ref struc);

            if (ret != 0)
                return false;
            else
                return true;
        }

        /// <summary>
        /// Copies the source to the destination.
        /// </summary>
        /// <remarks>
        /// If the source is a directory, it is copied recursively.
        /// </remarks>
        /// <param name="p_strSource">The path from which to copy.</param>
        /// <param name="p_strDestination">The path to which to copy.</param>
        /// <param name="p_fncCopyCallback">A callback method that notifies the caller when a file has been copied,
        /// and provides the opportunity to cancel the copy operation.</param>
        /// <returns><c>true</c> if the copy operation wasn't cancelled; <c>false</c> otherwise.</returns>
        public bool Copy(string p_strSource, string p_strDestination, Func<string, bool> p_fncCopyCallback)
        {
            if (File.Exists(p_strSource))
            {
                if (!Directory.Exists(Path.GetDirectoryName(p_strDestination)))
                    Directory.CreateDirectory(Path.GetDirectoryName(p_strDestination));
                File.Copy(p_strSource, p_strDestination, true);
                if ((p_fncCopyCallback != null) && p_fncCopyCallback(p_strSource))
                    return false;
            }
            else if (Directory.Exists(p_strSource))
            {
                if (!Directory.Exists(p_strDestination))
                    Directory.CreateDirectory(p_strDestination);
                string[] strFiles = Directory.GetFiles(p_strSource);
                foreach (string strFile in strFiles)
                {
                    File.Copy(strFile, Path.Combine(p_strDestination, Path.GetFileName(strFile)), true);
                    if ((p_fncCopyCallback != null) && p_fncCopyCallback(strFile))
                        return false;
                }
                string[] strDirectories = Directory.GetDirectories(p_strSource);
                foreach (string strDirectory in strDirectories)
                    if (!Copy(strDirectory, Path.Combine(p_strDestination, Path.GetFileName(strDirectory)), p_fncCopyCallback))
                        return false;
            }
            return true;
        }

        /// <summary>
        /// Moves the specified file to the specified path, optionally overwritting
        /// any existing file.
        /// </summary>
        /// <param name="p_strFrom">The path to the file to move.</param>
        /// <param name="p_strTo">the path to which to move the file.</param>
        /// <param name="p_booOverwrite">Whether to overwrite any file found at the destination.</param>
        public void Move(string p_strFrom, string p_strTo, bool p_booOverwrite)
        {
            if (p_booOverwrite)
                ForceDelete(p_strTo);
            File.Move(p_strFrom, p_strTo);
        }

        /// <summary>
        /// Creates a directory at the given path.
        /// </summary>
        /// <remarks>
        /// The standard <see cref="Directory.CreateDirectory()"/> has a latency issue where
        /// the directory is not necessarily ready for use immediately after creation. This
        /// method waits until the cirectory is created and ready before returning.
        /// </remarks>
        /// <param name="p_strPath">The path of the directory to create.</param>
        public void CreateDirectory(string p_strPath)
        {
            int intRetries = 1;
            Directory.CreateDirectory(p_strPath);
            while (!Directory.Exists(p_strPath) && intRetries <= 10)
            {
                intRetries++;
                Thread.Sleep(100);
            }
        }

        /// <summary>
        /// Forces deletion of the given path.
        /// </summary>
        /// <remarks>
        /// This method is recursive if the given path is a directory. This method will clear read only/system
        /// attributes if required to delete the path.
        /// </remarks>
        /// <param name="p_strPath">The path to delete.</param>
        public void ForceDelete(string p_strPath)
        {
            for (Int32 i = 0; i < 5; i++)
            {
                try
                {
                    if (File.Exists(p_strPath))
                        File.Delete(p_strPath);
                    else if (Directory.Exists(p_strPath))
                        Directory.Delete(p_strPath, true);
                    return;
                }
                catch (Exception e)
                {
                    if (!(e is IOException || e is UnauthorizedAccessException || e is DirectoryNotFoundException || e is FileNotFoundException))
                        throw;
                    try
                    {
                        ClearAttributes(p_strPath, true);
                    }
                    catch (Exception ex)
                    {
                        if (!(ex is IOException || ex is ArgumentException || ex is DirectoryNotFoundException || e is FileNotFoundException))
                            throw;
                        //we couldn't clear the attributes
                    }
                }
            }
        }

        /// <summary>
        /// Clears the attributes of the given path.
        /// </summary>
        /// <remarks>
        /// This sets the path's attributes to <see cref="FileAttributes.Normal"/>. This operation is
        /// optionally recursive.
        /// </remarks>
        /// <param name="p_strPath">The path whose attributes are to be cleared.</param>
        /// <param name="p_booRecurse">Whether or not to clear the attributes on all children files and folers.</param>
        public void ClearAttributes(string p_strPath, bool p_booRecurse)
        {
            try
            {
                if (File.Exists(p_strPath))
                {
                    FileInfo fifFile = new FileInfo(p_strPath);
                    fifFile.Attributes = FileAttributes.Normal;
                }
                else if (Directory.Exists(p_strPath))
                    ClearAttributes(new DirectoryInfo(p_strPath), p_booRecurse);
            }
            catch (Exception e)
            {
                if (!(e is IOException || e is UnauthorizedAccessException || e is DirectoryNotFoundException || e is FileNotFoundException))
                    throw;
            }
        }

        /// <summary>
        /// Clears the attributes of the given directory.
        /// </summary>
        /// <remarks>
        /// This sets the directory's attributes to <see cref="FileAttributes.Normal"/>. This operation is
        /// optionally recursive.
        /// </remarks>
        /// <param name="p_difPath">The directory whose attributes are to be cleared.</param>
        /// <param name="p_booRecurse">Whether or not to clear the attributes on all children files and folers.</param>
        public void ClearAttributes(DirectoryInfo p_difPath, bool p_booRecurse)
        {
            try
            {
                p_difPath.Attributes = FileAttributes.Normal;
                if (p_booRecurse)
                {
                    foreach (DirectoryInfo difDirectory in p_difPath.GetDirectories())
                        ClearAttributes(difDirectory, p_booRecurse);
                    foreach (FileInfo fifFile in p_difPath.GetFiles())
                        fifFile.Attributes = FileAttributes.Normal;
                }
            }
            catch (Exception e)
            {
                if (!(e is IOException || e is UnauthorizedAccessException || e is DirectoryNotFoundException || e is FileNotFoundException))
                    throw;
            }
        }

        /// <summary>
        /// Writes the given data to the specified file.
        /// </summary>
        /// <remarks>
        /// If the specified file exists, it will be overwritten. If the specified file
        /// does not exist, it is created. If the directory containing the specified file
        /// does not exist, it is created.
        /// </remarks>
        /// <param name="p_strPath">The path to which to write the given data.</param>
        /// <param name="p_bteData">The data to write to the file.</param>
        public void WriteAllBytes(string p_strPath, byte[] p_bteData)
        {
            string strDirectory = Path.GetDirectoryName(p_strPath);
            if (!Directory.Exists(strDirectory))
                Directory.CreateDirectory(strDirectory);
            File.WriteAllBytes(p_strPath, p_bteData);
        }

        /// <summary>
        /// Writes the given data to the specified file.
        /// </summary>
        /// <remarks>
        /// If the specified file exists, it will be overwritten. If the specified file
        /// does not exist, it is created. If the directory containing the specified file
        /// does not exist, it is created.
        /// </remarks>
        /// <param name="p_strPath">The path to which to write the given text.</param>
        /// <param name="p_strData">The text to write to the file.</param>
        public void WriteAllText(string p_strPath, string p_strData)
        {
            string strDirectory = Path.GetDirectoryName(p_strPath);
            if (!Directory.Exists(strDirectory))
                Directory.CreateDirectory(strDirectory);
            File.WriteAllText(p_strPath, p_strData);
        }

		public bool Exists(string p_strFilePath)
		{
			return File.Exists(p_strFilePath);
		}

		public bool IsFileLocked(string filePath)
		{
			try
			{
				using (Open(filePath, FileMode.Open)) { }
				return false;
			}
			catch (IOException)
			{
				return true;
			}
		}

		public string[] ReadAllLines(string p_strFilePath)
		{
			return File.ReadAllLines(p_strFilePath);
		}

        public void Delete(string p_strPath)
        {
            File.Delete(p_strPath);
        }

		public string[] GetFiles(string p_strPath, string p_strPattern, SearchOption searchOption)
		{
			return Directory.GetFiles(p_strPath, p_strPattern, searchOption);
		}

		public byte[] ReadAllBytes(string p_strFilePath)
		{
			return File.ReadAllBytes(p_strFilePath);
		}

		public void WriteAllLines(string p_strPath, string[] p_strText)
		{
			File.WriteAllLines(p_strPath, p_strText);
		}

		public void AppendAllText(string p_strPath, string p_strText)
		{
			File.AppendAllText(p_strPath, p_strText);
		}

		public Stream Open(string p_filePath, FileMode p_fmMode)
		{
			return File.Open(p_filePath, p_fmMode);
		}

		public void SetAttributes(string p_FilePath, FileAttributes p_faAttributes)
		{
			File.SetAttributes(p_FilePath, p_faAttributes);
		}

		public FileAttributes GetAttributes(string p_filePath)
		{
			return File.GetAttributes(p_filePath);
		}

		public IFileInfo GetFileInfo(string strInstallFilePath)
		{
			return new FileInfoWrapper(strInstallFilePath);
		}
	}
}
