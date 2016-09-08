using System;
using System.IO;
using System.Runtime.InteropServices;

namespace Util
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


	public interface IFileSystem
	{
		/// <summary>
		/// Copies, moves or deletes a filesystem object using shell functionality
		/// (I.e. shows an OS dialog on overwrite, can move files to the recycle bin, ...)
		/// </summary>
		/// <param name="lpFileOp">Descriptor of the file operation to execute</param>
		/// <returns>An error code. please note that this function has its own set of error codes documented
		/// here: https://msdn.microsoft.com/en-us/library/windows/desktop/bb762164(v=vs.85).aspx </returns>
		Int32 ShellFileOperation(ref SHFILEOPSTRUCT lpFileOp);

		/// <summary>
		/// Creates a temporary directory rooted at the given path.
		/// </summary>
		/// <param name="p_strBasePath">The path under which to create the temporary directory.</param>
		/// <returns>The path to the newly created temporary directory.</returns>
		string CreateTempDirectory();

		/// <summary>
		/// rename a directory
		/// </summary>
		/// <param name="p_strSource">old name</param>
		/// <param name="p_strDest">new name</param>
		/// <returns>true on success</returns>
		bool RenameDirectory(string p_strSource, string p_strDest);

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
		bool Copy(string p_strSource, string p_strDestination, Func<string, bool> p_fncCopyCallback);

		/// <summary>
		/// retrieves the list of files in the specified path that match a pattern
		/// </summary>
		/// <param name="p_strPath">path to search in</param>
		/// <param name="p_strPattern">the patterns have to match</param>
		/// <param name="searchOption">options to control how the search works (i.e. recursive vs. only the specified dir)</param>
		/// <returns></returns>
		string[] GetFiles(string p_strPath, string p_strPattern, SearchOption searchOption);

		/// <summary>
		/// 
		/// </summary>
		/// <param name="p_strPath"></param>
		/// <param name="p_strText"></param>
		void WriteAllLines(string p_strPath, string[] p_strText);

		/// <summary>
		/// 
		/// </summary>
		/// <param name="p_strPath"></param>
		/// <param name="p_strText"></param>
		void AppendAllText(string p_strPath, string p_strText);

		/// <summary>
		/// Moves the specified file to the specified path, optionally overwritting
		/// any existing file.
		/// </summary>
		/// <param name="p_strFrom">The path to the file to move.</param>
		/// <param name="p_strTo">the path to which to move the file.</param>
		/// <param name="p_booOverwrite">Whether to overwrite any file found at the destination.</param>
		void Move(string p_strFrom, string p_strTo, bool p_booOverwrite = false);

		/// <summary>
		/// Creates a directory at the given path.
		/// </summary>
		/// <remarks>
		/// The standard <see cref="Directory.CreateDirectory()"/> has a latency issue where
		/// the directory is not necessarily ready for use immediately after creation. This
		/// method waits until the cirectory is created and ready before returning.
		/// </remarks>
		/// <param name="p_strPath">The path of the directory to create.</param>
		void CreateDirectory(string p_strPath);

		/// <summary>
		/// Forces deletion of the given path.
		/// </summary>
		/// <remarks>
		/// This method is recursive if the given path is a directory. This method will clear read only/system
		/// attributes if required to delete the path.
		/// </remarks>
		/// <param name="p_strPath">The path to delete.</param>
		void ForceDelete(string p_strPath);

		/// <summary>
		/// Clears the attributes of the given path.
		/// </summary>
		/// <remarks>
		/// This sets the path's attributes to <see cref="FileAttributes.Normal"/>. This operation is
		/// optionally recursive.
		/// </remarks>
		/// <param name="p_strPath">The path whose attributes are to be cleared.</param>
		/// <param name="p_booRecurse">Whether or not to clear the attributes on all children files and folers.</param>
		void ClearAttributes(string p_strPath, bool p_booRecurse);

		/// <summary>
		/// Clears the attributes of the given directory.
		/// </summary>
		/// <remarks>
		/// This sets the directory's attributes to <see cref="FileAttributes.Normal"/>. This operation is
		/// optionally recursive.
		/// </remarks>
		/// <param name="p_difPath">The directory whose attributes are to be cleared.</param>
		/// <param name="p_booRecurse">Whether or not to clear the attributes on all children files and folers.</param>
		void ClearAttributes(DirectoryInfo p_difPath, bool p_booRecurse);

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
		void WriteAllBytes(string p_strPath, byte[] p_bteData);

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
		void WriteAllText(string p_strPath, string p_strData);

		/// <summary>
		/// test if a file exists
		/// </summary>
		/// <param name="p_strFilePath"></param>
		/// <returns></returns>
		bool Exists(string p_strFilePath);

		/// <summary>
		/// Check if the file is in use.
		/// </summary>
		bool IsFileLocked(string filePath);	

		/// <summary>
		/// read whole content of a file into an array linewise
		/// </summary>
		/// <param name="p_strFilePath"></param>
		/// <returns></returns>
		string[] ReadAllLines(string p_strFilePath);

		/// <summary>
		/// read whole uninterpreted content of a file into a byte array
		/// </summary>
		/// <param name="p_strFilePath">path to the file to read</param>
		/// <returns></returns>
		byte[] ReadAllBytes(string p_strFilePath);

		/// <summary>
		/// delete a file
		/// </summary>
		/// <param name="p_strPath"></param>
		void Delete(string p_strPath);

		/// <summary>
		/// opens a file stream
		/// </summary>
		/// <param name="p_filePath">path of the file to open</param>
		/// <param name="p_fmMode">mode</param>
		/// <returns></returns>
		Stream Open(string p_filePath, FileMode p_fmMode);

		/// <summary>
		/// change the file attributes on a file
		/// </summary>
		/// <param name="p_filePath">path of the file to change</param>
		/// <param name="p_faAttributes">new attributes</param>
		void SetAttributes(string p_filePath, FileAttributes p_faAttributes);

		/// <summary>
		/// retrieve file attributes for a file
		/// </summary>
		/// <param name="p_filePath">path of the file</param>
		/// <returns>attributes or null if the file doesn't exist</returns>
		FileAttributes GetAttributes(string p_filePath);

		/// <summary>
		/// retrieve file info for a file
		/// </summary>
		/// <param name="strInstallFilePath">path of the file</param>
		/// <returns>file info</returns>
		IFileInfo GetFileInfo(string strInstallFilePath);
	}
}
