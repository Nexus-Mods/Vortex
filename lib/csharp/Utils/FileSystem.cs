using System;
using System.IO;
using System.Runtime.InteropServices;

namespace Utils
{
    [System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Design", "CA1049:TypesThatOwnNativeResourcesShouldBeDisposable")]
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode, Pack = 1)]
    public struct SHFILEOPSTRUCT
    {
        [System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Security", "CA2111:PointersShouldNotBeVisible")]
        public IntPtr hwnd;   // Window handle to the dialog box to display 
                              // information about the status of the file 
                              // operation. 
        public UInt32 wFunc;   // Value that indicates which operation to 
                               // perform.
        [System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Security", "CA2111:PointersShouldNotBeVisible")]
        public IntPtr pFrom;   // Address of a buffer to specify one or more 
                               // source file names. These names must be
                               // fully qualified paths. Standard Microsoft®   
                               // MS-DOS® wild cards, such as "*", are 
                               // permitted in the file-name position. 
                               // Although this member is declared as a 
                               // null-terminated string, it is used as a 
                               // buffer to hold multiple file names. Each 
                               // file name must be terminated by a single 
                               // NULL character. An additional NULL 
                               // character must be appended to the end of 
                               // the final name to indicate the end of pFrom. 
        [System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Security", "CA2111:PointersShouldNotBeVisible")]
        public IntPtr pTo;   // Address of a buffer to contain the name of 
                             // the destination file or directory. This 
                             // parameter must be set to NULL if it is not 
                             // used. Like pFrom, the pTo member is also a 
                             // double-null terminated string and is handled 
                             // in much the same way. 
        public UInt16 fFlags;   // Flags that control the file operation. 

        public Int32 fAnyOperationsAborted;

        // Value that receives TRUE if the user aborted 
        // any file operations before they were 
        // completed, or FALSE otherwise. 
        [System.Diagnostics.CodeAnalysis.SuppressMessage("Microsoft.Security", "CA2111:PointersShouldNotBeVisible")]
        public IntPtr hNameMappings;

        // A handle to a name mapping object containing 
        // the old and new names of the renamed files. 
        // This member is used only if the 
        // fFlags member includes the 
        // FOF_WANTMAPPINGHANDLE flag.

        [MarshalAs(UnmanagedType.LPWStr)]
        public String lpszProgressTitle;

        // Address of a string to use as the title of 
        // a progress dialog box. This member is used 
        // only if fFlags includes the 
        // FOF_SIMPLEPROGRESS flag.
    }

    public static class FileSystem
	{
		/// <summary>
		/// Test if a file exists
		/// </summary>
		/// <param name="filePath"></param>
		/// <returns></returns>
		public static bool FileExists(string filePath)
		{
			return File.Exists(filePath);
		}

        /// <summary>
        /// Test if a directory exists
        /// </summary>
        /// <param name="filePath"></param>
        /// <returns></returns>
        public static bool DirectoryExists(string directoryPath)
        {
            return Directory.Exists(directoryPath);
        }

        /// <summary>
        /// Read whole content of a file into an array linewise
        /// </summary>
        /// <param name="filePath"></param>
        /// <returns></returns>
        public static string[] ReadAllLines(string filePath)
		{
			return File.ReadAllLines(filePath);
		}

        /// <summary>
        /// Read whole uninterpreted content of a file into a byte array
        /// </summary>
        /// <param name="filePath">path to the file to read</param>
        /// <returns></returns>
        public static byte[] ReadAllBytes(string filePath)
		{
			return File.ReadAllBytes(filePath);
		}

        /// <summary>
        /// Opens a file stream
        /// </summary>
        /// <param name="filePath">path of the file to open</param>
        /// <param name="fileMode">mode</param>
        /// <returns></returns>
        public static Stream Open(string filePath, FileMode fileMode)
		{
			return File.Open(filePath, fileMode);
		}

        /// <summary>
        /// Retrieve file attributes for a file
        /// </summary>
        /// <param name="filePath">path of the file</param>
        /// <returns>attributes or null if the file doesn't exist</returns>
        public static FileAttributes GetAttributes(string filePath)
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
        public static bool IsSafeFilePath(string p_strPath)
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

        /// <summary>
        /// Retrieves the list of files in the specified path that match a pattern
        /// </summary>
        /// <param name="searchPath">path to search in</param>
        /// <param name="pattern">the patterns have to match</param>
        /// <param name="searchOption">options to control how the search works (i.e. recursive vs. only the specified dir)</param>
        /// <returns></returns>
        public static string[] GetFiles(string searchPath, string pattern, SearchOption searchOption)
        {
            return Directory.GetFiles(searchPath, pattern, searchOption);
        }
    }
}
