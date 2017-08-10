using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using FomodInstaller.Interface;
using Utils;

namespace FomodInstaller.Scripting.ModScript
{
	/// <summary>
	/// Implements the functions availabe to Mod Script scripts.
	/// </summary>
	/// <remarks>
	/// The proxy allows sandboxed scripts to call functions that can perform
	/// actions outside of the sandbox.
	/// 
	/// All values in Mod Script are strings. Thus, all parameters to the functions
	/// are strings. If they represent another datatype, the functions must
	/// convert the values before using them.
	/// 
	/// There are a few exceptions, where some methods accept non-string parameters.
	/// This is becuase these methods are called by the interpreter, and not from
	/// the interpreted code. For example, the Select methods that display the
	/// Select Form are called by the interpreter plumbing.
	/// </remarks>
	public class ModScriptFunctionProxy : ScriptFunctionProxy
	{
		private Dictionary<string, string> m_dicCopiedFileMappings = new Dictionary<string, string>();

        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the given values.
        /// </summary>
        /// <param name="modArchive">The mod for which the script is running.</param>
        /// <param name="coreDelegates">The Core delegates component.</param>
        public ModScriptFunctionProxy(Mod modArchive, CoreDelegates coreDelegates)
			: base(modArchive, coreDelegates)
 		{
 		}

		#endregion

		#region File Management

		/// <summary>
		/// Installs the specified file from the mod to the specified location on the file system.
		/// </summary>
		/// <param name="p_strFrom">The path of the file in the mod to install.</param>
		/// <param name="p_strTo">The path on the file system where the file is to be created.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		public override bool InstallFileFromMod(string p_strFrom, string p_strTo)
		{
			if (base.InstallFileFromMod(p_strFrom, p_strTo))
			{
				if (!string.Equals(p_strFrom, p_strTo, StringComparison.OrdinalIgnoreCase))
					m_dicCopiedFileMappings[p_strFrom] = p_strTo;
				return true;
			}
			return false;
		}

		/// <summary>
		/// Replaces the file specified by <paramref name="p_strFileToPatch"/> with the
		/// file sepcifed by <paramref name="p_strNewFile"/>, optionally creating the file
		/// if it does not exist.
		/// </summary>
		/// <remarks>
		/// The effects of this method persist even if the mod activation fails. This is a legacy
		/// method from the Oblivion Mod Manager. The ideology behind the method breaks of of the
		/// contracts gauranteed by this mod manager, namely that a failed mod activation does not
		/// affect the game installation. As such, this method behaves like
		/// <see cref="ScriptFunctionProxy.InstallFileFromMod(string, string)"/>, with the exception that the
		/// file won't be created if it doesn't exist.
		/// </remarks>
		/// <param name="p_strNewFile">The path of the file in the mod to install.</param>
		/// <param name="p_strFileToPatch">The path on the file system where the file is to be created.</param>
		/// <param name="p_strCreate">Whether to create the file if it doesn not exist.</param>
		public void PatchPlugin(string p_strNewFile, string p_strFileToPatch, string p_strCreate)
		{
			bool booCreate = bool.Parse(p_strCreate);
			if (!booCreate && !DataFileExists(p_strFileToPatch))
				return;
			InstallFileFromMod(p_strNewFile, p_strFileToPatch);
		}

		/// <summary>
		/// Replaces the file specified by <paramref name="p_strFileToPatch"/> with the
		/// file sepcifed by <paramref name="p_strNewFile"/>, optionally creating the file
		/// if it does not exist.
		/// </summary>
		/// <remarks>
		/// The effects of this method persist even if the mod activation fails. This is a legacy
		/// method from the Oblivion Mod Manager. The ideology behind the method breaks of of the
		/// contracts gauranteed by this mod manager, namely that a failed mod activation does not
		/// affect the game installation. As such, this method behaves like
		/// <see cref="ScriptFunctionProxy.InstallFileFromMod(string, string)"/>, with the exception that the
		/// file won't be created if it doesn't exist.
		/// </remarks>
		/// <param name="p_strNewFile">The path of the file in the mod to install.</param>
		/// <param name="p_strFileToPatch">The path on the file system where the file is to be created.</param>
		/// <param name="p_strCreate">Whether to create the file if it doesn not exist.</param>
		public void PatchDataFile(string p_strNewFile, string p_strFileToPatch, string p_strCreate)
		{
			PatchPlugin(p_strNewFile, p_strFileToPatch, p_strCreate);
		}

		/// <summary>
		/// Installs the specified file from the mod to the specified location on the file system.
		/// </summary>
		/// <remarks>
		/// This is the legacy form of <see cref="ScriptFunctionProxy.InstallFileFromMod(string, string)"/>. It now just calls
		/// <see cref="ScriptFunctionProxy.InstallFileFromMod(string, string)"/>.
		/// </remarks>
		/// <param name="p_strFrom">The path of the file in the mod to install.</param>
		/// <param name="p_strTo">The path on the file system where the file is to be created.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		/// <seealso cref="ScriptFunctionProxy.InstallFileFromMod(string, string)"/>
		public bool CopyDataFile(string p_strFrom, string p_strTo)
		{
			return InstallFileFromMod(p_strFrom, p_strTo);
		}

		/// <summary>
		/// Installs the specified file from the mod to the specified location on the file system.
		/// </summary>
		/// <remarks>
		/// This is an alis for <see cref="CopyDataFile(string, string)"/>. It exists
		/// to maintain compatibility with old Mod Scripts.
		/// </remarks>
		/// <param name="p_strFrom">The path of the file in the mod to install.</param>
		/// <param name="p_strTo">The path on the file system where the file is to be created.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		/// <seealso cref="CopyDataFile(string, string)"/>
		public bool CopyPlugin(string p_strFrom, string p_strTo)
		{
			return InstallFileFromMod(p_strFrom, p_strTo);
		}

		/// <summary>
		/// Installs the specified file from the mod to the file system.
		/// </summary>
		/// This is an alias for <see cref="ScriptFunctionProxy.InstallFileFromMod(string)"/>. It exists
		/// to maintain compatibility with old Mod Scripts.
		/// <param name="p_strFile">The path of the file to install.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		/// <seealso cref="ScriptFunctionProxy.InstallFileFromMod(string)"/>
		public bool InstallPlugin(string p_strFile)
		{
			return InstallFileFromMod(p_strFile, p_strFile);
		}

		/// <summary>
		/// Installs the specified file from the mod to the file system.
		/// </summary>
		/// This is an alias for <see cref="ScriptFunctionProxy.InstallFileFromMod(string)"/>. It exists
		/// to maintain compatibility with old Mod Scripts.
		/// <param name="p_strFile">The path of the file to install.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		/// <seealso cref="ScriptFunctionProxy.InstallFileFromMod(string)"/>
		public bool InstallDataFile(string p_strFile)
		{
			return InstallFileFromMod(p_strFile, p_strFile);
		}

		/// <summary>
		/// Installs the files in the specified folder from the mod to the file system.
		/// </summary>
		/// <remarks>
		/// This is an alis for <see cref="ScriptFunctionProxy.InstallFolderFromMod(string, bool)"/>. It exists
		/// to maintain compatibility with old Mod Scripts.
		/// </remarks>
		/// <param name="p_strFrom">The path of the folder in the mod containing the files to install.</param>
		/// <param name="p_strRecurse">Whether to install all files in all subfolders.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		/// <seealso cref="ScriptFunctionProxy.InstallFolderFromMod(string, bool)"/>
		public bool InstallDataFolder(string p_strFrom, string p_strRecurse)
		{
			bool booRecurse = Boolean.Parse(p_strRecurse);
			return InstallFolderFromMod(p_strFrom, booRecurse);
		}

		/// <summary>
		/// Installs the files in the specified folder from the mod to the specified location on the file system.
		/// </summary>
		/// <remarks>
		/// This is an alis for <see cref="ScriptFunctionProxy.InstallFolderFromMod(string, string, bool)"/>. It exists
		/// to maintain compatibility with old Mod Scripts.
		/// </remarks>
		/// <param name="p_strFrom">The path of the folder in the mod containing the files to install.</param>
		/// <param name="p_strTo">The path on the file system where the files are to be created.</param>
		/// <param name="p_strRecurse">Whether to install all files in all subfolders.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		/// <seealso cref="ScriptFunctionProxy.InstallFolderFromMod(string, string, bool)"/>
		public bool CopyDataFolder(string p_strFrom, string p_strTo, string p_strRecurse)
		{
			bool booRecurse = Boolean.Parse(p_strRecurse);
			return InstallFolderFromMod(p_strFrom, p_strTo, booRecurse);
		}

		#region Folder List Retrieval

		/// <summary>
		/// Retrieves the list of folders that contain non-plugin files in the specified folder in the mod.
		/// </summary>
		/// <param name="p_strFolder">The folder whose folders list is to be retrieved.</param>
		/// <returns>The list of folders that contain non-plugin files in the specified folder in the mod.</returns>
		public string[] DataFolder(string p_strFolder)
		{
			return DataFolder(p_strFolder, false.ToString());
		}

		/// <summary>
		/// Retrieves the list of folders that contain non-plugin files in the specified folder in the mod.
		/// </summary>
		/// <param name="p_strFolder">The folder whose folders list is to be retrieved.</param>
		/// <param name="p_strRecurse">Whether to return folders that are in subdirectories of the given directory.</param>
		/// <returns>The list of folders that contain non-plugin files in the specified folder in the mod.</returns>
		public string[] DataFolder(string p_strFolder, string p_strRecurse)
		{
			return DataFolder(p_strFolder, p_strRecurse, null);
		}

		/// <summary>
		/// Retrieves the list of folders that contain non-plugin files in the specified folder in the mod that match the given search string.
		/// </summary>
		/// <remarks>
		/// The given search string recognizes the * and ? wild cards.
		/// </remarks>
		/// <param name="p_strFolder">The folder whose folders list is to be retrieved.</param>
		/// <param name="p_strRecurse">Whether to return folders that are in subdirectories of the given directory.</param>
		/// <param name="p_strSearchString">The search string against which to match folder names.</param>
		/// <returns>The list of folders that contain non-plugin files in the specified folder in the mod that match the given search string.</returns>
		public string[] DataFolder(string p_strFolder, string p_strRecurse, string p_strSearchString)
		{
			return GetFolders(p_strFolder, p_strRecurse, p_strSearchString, true);
		}

		/// <summary>
		/// Retrieves the list of folders that contain plugin files in the specified folder in the mod.
		/// </summary>
		/// <param name="p_strFolder">The folder whose folders list is to be retrieved.</param>
		/// <returns>The list of folders that contain plugin files in the specified folder in the mod.</returns>
		public string[] PluginFolder(string p_strFolder)
		{
			return PluginFolder(p_strFolder, false.ToString());
		}

		/// <summary>
		/// Retrieves the list of folders that contain plugin files in the specified folder in the mod.
		/// </summary>
		/// <param name="p_strFolder">The folder whose folders list is to be retrieved.</param>
		/// <param name="p_strRecurse">Whether to return folders that are in subdirectories of the given directory.</param>
		/// <returns>The list of folders that contain plugin files in the specified folder in the mod.</returns>
		public string[] PluginFolder(string p_strFolder, string p_strRecurse)
		{
			return PluginFolder(p_strFolder, p_strRecurse, null);
		}

		/// <summary>
		/// Retrieves the list of folders that contain plugin files in the specified folder in the mod that match the given search string.
		/// </summary>
		/// <remarks>
		/// The given search string recognizes the * and ? wild cards.
		/// </remarks>
		/// <param name="p_strFolder">The folder whose folders list is to be retrieved.</param>
		/// <param name="p_strRecurse">Whether to return folders that are in subdirectories of the given directory.</param>
		/// <param name="p_strSearchString">The search string against which to match folder names.</param>
		/// <returns>The list of folders that contain plugin files in the specified folder in the mod that match the given search string.</returns>
		public string[] PluginFolder(string p_strFolder, string p_strRecurse, string p_strSearchString)
		{
			return GetFolders(p_strFolder, p_strRecurse, p_strSearchString, false);
		}

		/// <summary>
		/// Retrieves the list of folders that contain either non-plugin or plugin files in the specified folder
		/// in the mod that match the given search string.
		/// </summary>
		/// <remarks>
		/// The given search string recognizes the * and ? wild cards.
		/// </remarks>
		/// <param name="p_strFolder">The folder whose folders list is to be retrieved.</param>
		/// <param name="p_strRecurse">Whether to return folders that are in subdirectories of the given directory.</param>
		/// <param name="p_strSearchString">The search string against which to match folder names.</param>
		/// <param name="p_booDataFolders"><c>true</c> if the method should return folders that contain non-plugin files;
		/// <c>false</c> if the method should return folders that contain plugin files.</param>
		/// <returns>The list of folders that contain either non-plugin or plugin files in the specified folder
		/// in the mod that match the given search string.</returns>
		private string[] GetFolders(string p_strFolder, string p_strRecurse, string p_strSearchString, bool p_booDataFolders)
		{
			bool booRecurse = bool.Parse(p_strRecurse);
			List<string> setFolders = new List<string>();
			string[] strFiles = GetModFileList(p_strFolder, true);
			Regex rgxSearchString = null;
			if (!string.IsNullOrEmpty(p_strSearchString))
			{
				string strPattern = p_strSearchString.Replace(".", "\\.").Replace("*", ".*");
				rgxSearchString = new Regex(strPattern);
			}
			string strFolder = null;
			foreach (string strFile in strFiles)
			{
				strFolder = Path.GetDirectoryName(strFile);
				if (!booRecurse)
				{
					string strParent = Path.GetDirectoryName(strFolder);
					while (!string.IsNullOrEmpty(strParent) && !strParent.Equals(p_strFolder, StringComparison.OrdinalIgnoreCase))
					{
						strFolder = strParent;
						strParent = Path.GetDirectoryName(strFolder);
					}
					if (string.IsNullOrEmpty(strParent))
						continue;
				}
				if (((rgxSearchString == null) || rgxSearchString.IsMatch(strFolder)) && (IsPlugin(strFile) ^ p_booDataFolders))
					setFolders.Add(strFolder);
			}
            setFolders.Sort(StringComparer.OrdinalIgnoreCase);

            return setFolders.ToArray();
		}

		#endregion

		#region File List Retrieval

		/// <summary>
		/// Retrieves the list of non-plugin files in the specified folder in the mod.
		/// </summary>
		/// <param name="p_strFolder">The folder whose file list is to be retrieved.</param>
		/// <returns>The list of non-plugin files in the specified folder in the mod.</returns>
		public string[] DataFile(string p_strFolder)
		{
			return DataFile(p_strFolder, false.ToString());
		}

		/// <summary>
		/// Retrieves the list of non-plugin files in the specified folder in the mod.
		/// </summary>
		/// <param name="p_strFolder">The folder whose file list is to be retrieved.</param>
		/// <param name="p_strRecurse">Whether to return files that are in subdirectories of the given directory.</param>
		/// <returns>The list of non-plugin files in the specified folder in the mod.</returns>
		public string[] DataFile(string p_strFolder, string p_strRecurse)
		{
			return DataFile(p_strFolder, p_strRecurse, null);
		}

		/// <summary>
		/// Retrieves the list of non-plugin files in the specified folder in the mod that match the given search string.
		/// </summary>
		/// <remarks>
		/// The given search string recognizes the * and ? wild cards.
		/// </remarks>
		/// <param name="p_strFolder">The folder whose file list is to be retrieved.</param>
		/// <param name="p_strRecurse">Whether to return files that are in subdirectories of the given directory.</param>
		/// <param name="p_strSearchString">The search string against which to match file names.</param>
		/// <returns>The list of non-plugin files in the specified folder in the mod that match the given search string.</returns>
		public string[] DataFile(string p_strFolder, string p_strRecurse, string p_strSearchString)
		{
			bool booRecurse = bool.Parse(p_strRecurse);
			List<string> setFolders = new List<string>();
			string[] strFiles = GetModFileList(p_strFolder, booRecurse);
			Regex rgxSearchString = null;
			if (!string.IsNullOrEmpty(p_strSearchString))
			{
				string strPattern = p_strSearchString.Replace(".", "\\.").Replace("*", ".*");
				rgxSearchString = new Regex(strPattern);
			}
			foreach (string strFile in strFiles)
			{
				if (((rgxSearchString == null) || rgxSearchString.IsMatch(strFile)) && !IsPlugin(strFile))
					setFolders.Add(strFile);
			}
            setFolders.Sort(StringComparer.OrdinalIgnoreCase);
			return setFolders.ToArray();
		}

		/// <summary>
		/// Retrieves the list of plugin files in the specified folder in the mod.
		/// </summary>
		/// <param name="p_strFolder">The folder whose file list is to be retrieved.</param>
		/// <returns>The list of plugin files in the specified folder in the mod.</returns>
		public string[] Plugin(string p_strFolder)
		{
			return Plugin(p_strFolder, false.ToString());
		}

		/// <summary>
		/// Retrieves the list of plugin files in the specified folder in the mod.
		/// </summary>
		/// <param name="p_strFolder">The folder whose file list is to be retrieved.</param>
		/// <param name="p_strRecurse">Whether to return files that are in subdirectories of the given directory.</param>
		/// <returns>The list of plugin files in the specified folder in the mod.</returns>
		public string[] Plugin(string p_strFolder, string p_strRecurse)
		{
			return Plugin(p_strFolder, p_strRecurse, null);
		}

		/// <summary>
		/// Retrieves the list of plugin files in the specified folder in the mod that match the given search string.
		/// </summary>
		/// <remarks>
		/// The given search string recognizes the * and ? wild cards.
		/// </remarks>
		/// <param name="p_strFolder">The folder whose file list is to be retrieved.</param>
		/// <param name="p_strRecurse">Whether to return files that are in subdirectories of the given directory.</param>
		/// <param name="p_strSearchString">The search string against which to match file names.</param>
		/// <returns>The list of plugin files in the specified folder in the mod that match the given search string.</returns>
		public string[] Plugin(string p_strFolder, string p_strRecurse, string p_strSearchString)
		{
			bool booRecurse = Boolean.Parse(p_strRecurse);
			List<string> setFiles = new List<string>();
			string[] strFiles = GetModFileList(p_strFolder, booRecurse);
			Regex rgxSearchString = null;
			if (!String.IsNullOrEmpty(p_strSearchString))
			{
				string strPattern = p_strSearchString.Replace(".", "\\.").Replace("*", ".*");
				rgxSearchString = new Regex(strPattern);
			}
			foreach (string strFile in strFiles)
			{
				if (((rgxSearchString == null) || rgxSearchString.IsMatch(strFile)) && IsPlugin(strFile))
					setFiles.Add(strFile);
			}
            setFiles.Sort(StringComparer.OrdinalIgnoreCase);
			return setFiles.ToArray();
		}

		#endregion

		#region Byte Writing

		/// <summary>
		/// Sets the specified byte to the given value in the specified file.
		/// </summary>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the byte to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="byte"/> value to which to set the byte.</param>
		public void SetFileByte(string p_strPath, string p_strOffset, string p_strValue)
		{
			long lngOffset = Int64.Parse(p_strOffset);
			byte bteValue = Byte.Parse(p_strValue);
			byte[] bteFile = GetExistingDataFile(p_strPath);
			bteFile[lngOffset] = bteValue;
			GenerateDataFile(p_strPath, bteFile);
		}

		/// <summary>
		/// Sets the specified bytes to the given value in the specified file.
		/// </summary>
		/// <remarks>
		/// This method overwrites 2 bytes at the given offset.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the bytes to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="Int16"/> value to which to set the bytes.</param>
		public void SetFileShort(string p_strPath, string p_strOffset, string p_strValue)
		{
			long lngOffset = Int64.Parse(p_strOffset);
			Int16 shtValue = Int16.Parse(p_strValue);
			byte[] bteFile = GetExistingDataFile(p_strPath);
			byte[] bteValue = BitConverter.GetBytes(shtValue);
			for (Int32 i = 0; i < bteValue.Length; i++)
				bteFile[lngOffset + i] = bteValue[i];
			GenerateDataFile(p_strPath, bteFile);
		}

		/// <summary>
		/// Set the specified bytes to the given value in the specified file.
		/// </summary>
		/// <remarks>
		/// This method overwrites 4 bytes at the given offset.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the bytes to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="Int32"/> value to which to set the bytes.</param>
		public void SetFileInt(string p_strPath, string p_strOffset, string p_strValue)
		{
			long lngOffset = Int64.Parse(p_strOffset);
			Int32 intValue = Int32.Parse(p_strValue);
			byte[] bteFile = GetExistingDataFile(p_strPath);
			byte[] bteValue = BitConverter.GetBytes(intValue);
			for (Int32 i = 0; i < bteValue.Length; i++)
				bteFile[lngOffset + i] = bteValue[i];
			GenerateDataFile(p_strPath, bteFile);
		}

		/// <summary>
		/// Sets the specified bytes to the given value in the specified file.
		/// </summary>
		/// <remarks>
		/// This method overwrites 8 bytes at the given offset.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the bytes to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="Int64"/> value to which to set the bytes.</param>
		public void SetFileLong(string p_strPath, string p_strOffset, string p_strValue)
		{
			long lngOffset = Int64.Parse(p_strOffset);
			Int64 lngValue = Int64.Parse(p_strValue);
			byte[] bteFile = GetExistingDataFile(p_strPath);
			byte[] bteValue = BitConverter.GetBytes(lngValue);
			for (Int32 i = 0; i < bteValue.Length; i++)
				bteFile[lngOffset + i] = bteValue[i];
			GenerateDataFile(p_strPath, bteFile);
		}

		/// <summary>
		/// Sets the specified bytes to the given value in the specified file.
		/// </summary>
		/// <remarks>
		/// This method overwrites 4 bytes at the given offset.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the bytes to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="float"/> value to which to set the bytes.</param>
		public void SetFileFloat(string p_strPath, string p_strOffset, string p_strValue)
		{
			long lngOffset = Int64.Parse(p_strOffset);
			float fltValue = Single.Parse(p_strValue);
			byte[] bteFile = GetExistingDataFile(p_strPath);
			byte[] bteValue = BitConverter.GetBytes(fltValue);
			for (Int32 i = 0; i < bteValue.Length; i++)
				bteFile[lngOffset + i] = bteValue[i];
			GenerateDataFile(p_strPath, bteFile);
		}

		#endregion

		#region Text File Writing

		/// <summary>
		/// Sets the specified line in the speficied file to the given value.
		/// </summary>
		/// <remarks>
		/// The file is assumed to be a text file.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the line.</param>
		/// <param name="p_strLineNumber">The line number to change.</param>
		/// <param name="p_strValue">The value to which to set the line.</param>
		public void SetTextLine(string p_strPath, string p_strLineNumber, string p_strValue)
		{
			string strPath = p_strPath;
			if (!File.Exists(strPath) && m_dicCopiedFileMappings.ContainsKey(p_strPath))
				strPath = m_dicCopiedFileMappings[p_strPath];
			Int32 intLine = Int32.Parse(p_strLineNumber);
			byte[] bteFile = GetExistingDataFile(strPath);
			string[] strLines = TextUtil.ByteToStringLines(bteFile);
			strLines[intLine] = p_strValue;
			using (MemoryStream mstData = new MemoryStream())
			{
				using (StreamWriter swrWriter = new StreamWriter(mstData))
				{
					foreach (string strLine in strLines)
						swrWriter.WriteLine(strLine);
				}
				bteFile = mstData.GetBuffer();
			}
			GenerateDataFile(strPath, bteFile);
		}

		/// <summary>
		/// Sets the specified line in the speficied file to the given value.
		/// </summary>
		/// <remarks>
		/// This is an alias for <see cref="SetTextLine(string, string, string)"/>. It exists
		/// to maintian compatibility with old Mod Script.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the line.</param>
		/// <param name="p_strLineNumber">The line number to change.</param>
		/// <param name="p_strValue">The value to which to set the line.</param>
		/// <seealso cref="SetTextLine(string, string, string)"/>
		public void EditXMLLine(string p_strPath, string p_strLineNumber, string p_strValue)
		{
			SetTextLine(p_strPath, p_strLineNumber, p_strValue);
		}

		/// <summary>
		/// Replaces all instances of the given old value with the given new value in the specified file.
		/// </summary>
		/// <remarks>
		/// The file is assumed to be a text file.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to perform the replacement.</param>
		/// <param name="p_strOldValue">The value to replace.</param>
		/// <param name="p_strNewValue">The value with which to replace the old value.</param>
		public void ReplaceTextInFile(string p_strPath, string p_strOldValue, string p_strNewValue)
		{
			string strPath = p_strPath;
			if (!File.Exists(strPath) && m_dicCopiedFileMappings.ContainsKey(p_strPath))
				strPath = m_dicCopiedFileMappings[p_strPath];
			byte[] bteFile = GetExistingDataFile(strPath);
			string strText = TextUtil.ByteToString(bteFile).Replace(p_strOldValue, p_strNewValue);
			using (MemoryStream mstData = new MemoryStream())
			{
				using (StreamWriter swrWriter = new StreamWriter(mstData))
				{
					swrWriter.Write(strText);
				}
				bteFile = mstData.GetBuffer();
			}
			GenerateDataFile(strPath, bteFile);
		}

		/// <summary>
		/// Replaces all instances of the given old value with the given new value in the specified file.
		/// </summary>
		/// <remarks>
		/// This is an alias for <see cref="ReplaceTextInFile(string, string, string)"/>. It exists
		/// to maintian compatibility with old Mod Script.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to perform the replacement.</param>
		/// <param name="p_strOldValue">The value to replace.</param>
		/// <param name="p_strNewValue">The value with which to replace the old value.</param>
		/// <seealso cref="ReplaceTextInFile(string, string, string)"/>
		public void EditXMLReplace(string p_strPath, string p_strOldValue, string p_strNewValue)
		{
			ReplaceTextInFile(p_strPath, p_strOldValue, p_strNewValue);
		}

		#endregion

		#region Path Manipulation

		/// <summary>
		/// Combines the given paths.
		/// </summary>
		/// <param name="p_strPath1">The first path to combine.</param>
		/// <param name="p_strPath2">The second path to combine.</param>
		/// <returns>The combined paths.</returns>
		public string CombinePaths(string p_strPath1, string p_strPath2)
		{
			return Path.Combine(p_strPath1, p_strPath2);
		}

		/// <summary>
		/// Gets the name of the directory of the given path.
		/// </summary>
		/// <param name="p_strPath">The path from which to extract the directory name.</param>
		/// <returns>The name of the directory of the given path.</returns>
		public string GetDirectoryName(string p_strPath)
		{
			return Path.GetDirectoryName(p_strPath);
		}

		/// <summary>
		/// Gets the name of the file of the given path, including extension.
		/// </summary>
		/// <param name="p_strPath">The path from which to extract the file name.</param>
		/// <returns>The name of the file of the given path, including extension..</returns>
		public string GetFileName(string p_strPath)
		{
			return Path.GetFileName(p_strPath);
		}

		/// <summary>
		/// Gets the name of the file of the given path, excluding extension.
		/// </summary>
		/// <param name="p_strPath">The path from which to extract the file name.</param>
		/// <returns>The name of the file of the given path, excluding extension..</returns>
		public string GetFileNameWithoutExtension(string p_strPath)
		{
			return Path.GetFileNameWithoutExtension(p_strPath);
		}

		#endregion

		#endregion

		#region UI

		#region Message Box

		/// <summary>
		/// Shows a yes/no message box with the given message.
		/// </summary>
		/// <param name="p_strMessage">The message to display in the message box.</param>
		/// <returns><c>true</c> if the user selects yes;
		/// <c>false</c> otherwise.</returns>
		public bool DialogYesNo(string p_strMessage)
		{
			return DialogYesNo(p_strMessage, "Question");
		}

		/// <summary>
		/// Shows a yes/no message box with the given message and title.
		/// </summary>
		/// <param name="p_strMessage">The message to display in the message box.</param>
		/// <param name="p_strTitle">The message box's title, displayed in the title bar.</param>
		/// <returns><c>true</c> if the user selects yes;
		/// <c>false</c> otherwise.</returns>
		public bool DialogYesNo(string p_strMessage, string p_strTitle)
		{
            // ??? This stuff should be handled by the user interaction delegate
            //return UIManager.ShowMessageBox(p_strMessage, p_strTitle, MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes;
            return false;
        }

        /// <summary>
        /// Shows a message box with the given message.
        /// </summary>
        /// <param name="p_strMessage">The message to display in the message box.</param>
        public void Message(string p_strMessage)
		{
            // ??? This stuff should be handled by the user interaction delegate
            //UIManager.ShowMessageBox(p_strMessage);
        }

        /// <summary>
        /// Shows a message box with the given message and title.
        /// </summary>
        /// <param name="p_strMessage">The message to display in the message box.</param>
        /// <param name="p_strTitle">The message box's title, displayed in the title bar.</param>
        public void Message(string p_strMessage, string p_strTitle)
		{
            // ??? This stuff should be handled by the user interaction delegate
            //UIManager.ShowMessageBox(p_strMessage, p_strTitle);
		}

		#endregion

		#region Select

		/// <summary>
		/// Displays a selection form to the user.
		/// </summary>
		/// <param name="p_lstOptions">The options from which to select.</param>
		/// <param name="p_strTitle">The title of the selection form.</param>
		/// <param name="p_booSelectMany">Whether more than one items can be selected.</param>
		/// <returns>The selected option names.</returns>
		public string[] Select(IList<ModScriptSelectOption> p_lstOptions, string p_strTitle, bool p_booSelectMany)
		{
            // ??? This stuff should be handled by the user interaction delegate
            //List<SelectOption> lstOptions = new List<SelectOption>();
            //foreach (ModScriptSelectOption msoOption in p_lstOptions)
            //{
            //	Image imgImage = String.IsNullOrEmpty(msoOption.ImagePath) ? null : new ExtendedImage(Mod.GetFile(msoOption.ImagePath));
            //	lstOptions.Add(new SelectOption(msoOption.Name, msoOption.IsDefault, msoOption.Description, imgImage));
            //}
            //return UIManager.Select(lstOptions, p_strTitle, p_booSelectMany);
            return null;

        }

        #endregion

        #region Text Input

        /// <summary>
        /// Displays text editor, and returns the entered text.
        /// </summary>
        /// <returns>The text entered into the editor.</returns>
        public string InputString()
		{
			return InputString(null, null);
		}

		/// <summary>
		/// Displays text editor, and returns the entered text.
		/// </summary>
		/// <param name="p_strTitle">The title of the editor.</param>
		/// <returns>The text entered into the editor.</returns>
		public string InputString(string p_strTitle)
		{
			return InputString(p_strTitle, null);
		}

		/// <summary>
		/// Displays text editor, and returns the entered text.
		/// </summary>
		/// <param name="p_strTitle">The title of the editor.</param>
		/// <param name="p_strInitialValue">The initial value of the editor.</param>
		/// <returns>The text entered into the editor.</returns>
		public string InputString(string p_strTitle, string p_strInitialValue)
		{
            // ??? This stuff should be handled by the user interaction delegate
            //return ((ModScriptUIUtil)UIManager).GetText(p_strTitle, p_strInitialValue);
            return null;
        }

        /// <summary>
        /// Displays the text in the specified mod file in a read-only editor window.
        /// </summary>
        /// <param name="p_strPath">The path to the file in the mod whose text is to be displayed.</param>
        public void DisplayText(string p_strPath)
		{
			DisplayText(p_strPath, null);
		}

		/// <summary>
		/// Displays the text in the specified mod file in a read-only editor window.
		/// </summary>
		/// <param name="p_strPath">The path to the file in the mod whose text is to be displayed.</param>
		/// <param name="p_strTitle">The title of the window.</param>
		public void DisplayText(string p_strPath, string p_strTitle)
		{
            // ??? This stuff should be handled by the user interaction delegate
            //string strText = TextUtil.ByteToString(Mod.GetFile(p_strPath));
            //((ModScriptUIUtil)UIManager).ShowText(p_strTitle, strText);
        }

        #endregion

        /// <summary>
        /// Displays the given image.
        /// </summary>
        /// <param name="p_strImagePath">The path to the image in the mod to display.</param>
        /// <param name="p_strTitle">The title to display in the image viewer.</param>
        public void DisplayImage(string p_strImagePath, string p_strTitle)
		{
            // ??? This stuff should be handled by the user interaction delegate
            //Image imgImage = new ExtendedImage(Mod.GetFile(p_strImagePath));
            //((ModScriptUIUtil)UIManager).ShowImage(imgImage, p_strTitle);

        }

        #endregion

        #region Version Checking

        /// <summary>
        /// Gets the version of the mod manager.
        /// </summary>
        /// <remarks>
        /// If the mod manager's verison is less than the last version of OBMM
        /// (which we assume is 1.12), return 1.12 as the version. This is to ensure
        /// legacy scripts written for OBMM won't quit, thinking the manager doesn't
        /// support all of the Mod Script functions.
        /// </remarks>
        /// <returns>The version of the mod manager.</returns>
        public override Version GetModManagerVersion()
		{
            // ??? A delegate should provide this info
            return new Version("1.0.0.0");
        }

		/// <summary>
		/// Determines if the current mod manager version is less than the given version.
		/// </summary>
		/// <param name="p_strModManagerVersion">The version to which to compare the mod manager's version.</param>
		/// <returns><c>true</c> if the mod manager's version is less than the given version.</returns>
		public bool VersionLessThan(string p_strModManagerVersion)
		{
			Version verCompare = new Version(p_strModManagerVersion.Contains(".") ? p_strModManagerVersion : p_strModManagerVersion + ".0");
			return GetModManagerVersion() < verCompare;
		}

		/// <summary>
		/// Determines if the current mod manager version is greater than the given version.
		/// </summary>
		/// <param name="p_strModManagerVersion">The version to which to compare the mod manager's version.</param>
		/// <returns><c>true</c> if the mod manager's version is greater than the given version.</returns>
		public bool VersionGreaterThan(string p_strModManagerVersion)
		{
			Version verCompare = new Version(p_strModManagerVersion.Contains(".") ? p_strModManagerVersion : p_strModManagerVersion + ".0");
			return GetModManagerVersion() > verCompare;
		}

		/// <summary>
		/// Determines if the current game version is greater than the given version.
		/// </summary>
		/// <param name="p_strGameVersion">The version to which to compare the game's version.</param>
		/// <returns><c>true</c> if the game's version is greater than the given version.</returns>
		public bool GameNewerThan(string p_strGameVersion)
		{
			Version verCompare = new Version(p_strGameVersion.Contains(".") ? p_strGameVersion : p_strGameVersion + ".0");
			return GetGameVersion() > verCompare;
		}

		#endregion

		#region Plugin Management

		/// <summary>
		/// Determines if the given path points at a plugin.
		/// </summary>
		/// <param name="p_strPath">The path to the file to be idecntified.</param>
		/// <returns><c>true</c> if the given path represents a plugin file;
		/// <c>false</c> otherwise.</returns>
		public bool IsPlugin(string p_strPath)
		{
            // ??? This value should be returned by the plugin delegate
            return false;
            //if (m_pdvDiscoverer == null)
            //	m_pdvDiscoverer = GameMode.GetPluginDiscoverer();
            //return m_pdvDiscoverer.IsPlugin(p_strPath);
        }

		#region Byte Writing

        // ??? Do we need a new instruction to support this or we want to leave it unsupported?

		/// <summary>
		/// Set the specified byte to the given value in the specified file.
		/// </summary>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the byte to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="byte"/> value to which to set the byte.</param>
		public void SetPluginByte(string p_strPath, string p_strOffset, string p_strValue)
		{
			SetFileByte(p_strPath, p_strOffset, p_strValue);
		}

		/// <summary>
		/// Set the specified bytes to the given value in the specified file.
		/// </summary>
		/// <remarks>
		/// This method overwrites 2 bytes at the given offset.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the bytes to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="Int16"/> value to which to set the byte.</param>
		public void SetPluginShort(string p_strPath, string p_strOffset, string p_strValue)
		{
			SetFileShort(p_strPath, p_strOffset, p_strValue);
		}

		/// <summary>
		/// Set the specified bytes to the given value in the specified file.
		/// </summary>
		/// <remarks>
		/// This method overwrites 4 bytes at the given offset.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the bytes to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="Int32"/> value to which to set the byte.</param>
		public void SetPluginInt(string p_strPath, string p_strOffset, string p_strValue)
		{
			SetFileInt(p_strPath, p_strOffset, p_strValue);
		}

		/// <summary>
		/// Set the specified bytes to the given value in the specified file.
		/// </summary>
		/// <remarks>
		/// This method overwrites 8 bytes at the given offset.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the bytes to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="Int64"/> value to which to set the byte.</param>
		public void SetPluginLong(string p_strPath, string p_strOffset, string p_strValue)
		{
			SetFileLong(p_strPath, p_strOffset, p_strValue);
		}

		/// <summary>
		/// Set the specified bytes to the given value in the specified file.
		/// </summary>
		/// <remarks>
		/// This method overwrites 4 bytes at the given offset.
		/// </remarks>
		/// <param name="p_strPath">The path of the file in which to change the byte value.</param>
		/// <param name="p_strOffset">The offset of the bytes to change.</param>
		/// <param name="p_strValue">The string representation of the <see cref="float"/> value to which to set the byte.</param>
		public void SetPluginFloat(string p_strPath, string p_strOffset, string p_strValue)
		{
			SetFileFloat(p_strPath, p_strOffset, p_strValue);
		}

		#endregion

		#region Plugin Activation Management

		/// <summary>
		/// Deactivates the specified plugin.
		/// </summary>
		/// <param name="p_strPluginPath">The path to the plugin to deactivate.</param>
		public void UncheckEsp(string p_strPluginPath)
		{
			SetPluginActivation(p_strPluginPath, false);
		}

		#endregion

		#endregion

		#region Comparisons

		/// <summary>
		/// Determines if the given strings are equal.
		/// </summary>
		/// <param name="p_strArg1">The first string to compare.</param>
		/// <param name="p_strArg2">The second string to compare.</param>
		/// <returns><c>true</c> if the given strings are equal;
		/// <c>false</c> otherwise.</returns>
		public bool Equal(string p_strArg1, string p_strArg2)
		{
			return string.Equals(p_strArg1, p_strArg2);
		}

        /// <summary>
        /// Determines if the first integer is greater than the second.
        /// </summary>
        /// <param name="p_strArg1">The string representation of the first integer to compare. Must be convertible to <see cref="int"/>.</param>
        /// <param name="p_strArg2">The string representation of the second integer to compare. Must be convertible to <see cref="int"/>.</param>
        /// <returns><c>true</c> if the first integer is greater than the second;
        /// <c>false</c> otherwise.</returns>
        public bool GreaterThan(string p_strArg1, string p_strArg2)
		{
			int intArg1 = -1;
			int intArg2 = -1;
			if (!int.TryParse(p_strArg1, out intArg1) || !int.TryParse(p_strArg2, out intArg2))
				throw new ArgumentException("Arguments must be convertible to integers.");
			return intArg1 > intArg2;
		}

        /// <summary>
        /// Determines if the first integer is greater than, or equal to, the second.
        /// </summary>
        /// <param name="p_strArg1">The string representation of the first integer to compare. Must be convertible to <see cref="int"/>.</param>
        /// <param name="p_strArg2">The string representation of the second integer to compare. Must be convertible to <see cref="int"/>.</param>
        /// <returns><c>true</c> if the first integer is greater than, or equal to, the second;
        /// <c>false</c> otherwise.</returns>
        public bool GreaterEqual(string p_strArg1, string p_strArg2)
		{
            int intArg1 = -1;
            int intArg2 = -1;
			if (!int.TryParse(p_strArg1, out intArg1) || !int.TryParse(p_strArg2, out intArg2))
				throw new ArgumentException("Arguments must be convertible to integers.");
			return intArg1 >= intArg2;
		}

		/// <summary>
		/// Determines if the first float is greater than the second.
		/// </summary>
		/// <param name="p_strArg1">The string representation of the first float to compare. Must be convertible to <see cref="float"/>.</param>
		/// <param name="p_strArg2">The string representation of the second float to compare. Must be convertible to <see cref="float"/>.</param>
		/// <returns><c>true</c> if the first float is greater than the second;
		/// <c>false</c> otherwise.</returns>
		public bool fGreaterThan(string p_strArg1, string p_strArg2)
		{
			float fltArg1 = -1;
			float fltArg2 = -1;
			if (!float.TryParse(p_strArg1, out fltArg1) || !float.TryParse(p_strArg2, out fltArg2))
				throw new ArgumentException("Arguments must be convertible to floats.");
			return fltArg1 > fltArg2;
		}

		/// <summary>
		/// Determines if the first float is greater than, or equal to, the second.
		/// </summary>
		/// <param name="p_strArg1">The string representation of the first float to compare. Must be convertible to <see cref="float"/>.</param>
		/// <param name="p_strArg2">The string representation of the second float to compare. Must be convertible to <see cref="float"/>.</param>
		/// <returns><c>true</c> if the first float is greater than, or equal to, the second;
		/// <c>false</c> otherwise.</returns>
		public bool fGreaterEqual(string p_strArg1, string p_strArg2)
		{
			float fltArg1 = -1;
			float fltArg2 = -1;
			if (!float.TryParse(p_strArg1, out fltArg1) || !float.TryParse(p_strArg2, out fltArg2))
				throw new ArgumentException("Arguments must be convertible to floats.");
			return fltArg1 >= fltArg2;
		}

		#endregion

		#region String Functions

		/// <summary>
		/// Gets the specified substring of the given value.
		/// </summary>
		/// <param name="p_strValue">The value from which to get the substring.</param>
		/// <param name="p_strStart">The inclusive start position of the substring.</param>
		/// <returns>The specified substring of the given value.</returns>
		public string Substring(string p_strValue, string p_strStart)
		{
			return p_strValue.Substring(int.Parse(p_strStart));
		}

		/// <summary>
		/// Gets the specified substring of the given value.
		/// </summary>
		/// <param name="p_strValue">The value from which to get the substring.</param>
		/// <param name="p_strStart">The inclusive start position of the substring.</param>
		/// <param name="p_strLength">The length of the substring.</param>
		/// <returns>The specified substring of the given value.</returns>
		public string Substring(string p_strValue, string p_strStart, string p_strLength)
		{
			return p_strValue.Substring(int.Parse(p_strStart), int.Parse(p_strLength));
		}

		/// <summary>
		/// Removes the specified substring from the given value.
		/// </summary>
		/// <param name="p_strValue">The value from which to remove the substring.</param>
		/// <param name="p_strStart">The inclusive start position of the substring.</param>
		/// <returns>The given value without the specified substring.</returns>
		public string RemoveString(string p_strValue, string p_strStart)
		{
			return p_strValue.Remove(int.Parse(p_strStart));
		}

		/// <summary>
		/// Removes the specified substring from the given value.
		/// </summary>
		/// <param name="p_strValue">The value from which to remove the substring.</param>
		/// <param name="p_strStart">The inclusive start position of the substring.</param>
		/// <param name="p_strLength">The length of the substring.</param>
		/// <returns>The given value without the specified substring.</returns>
		public string RemoveString(string p_strValue, string p_strStart, string p_strLength)
		{
			return p_strValue.Remove(int.Parse(p_strStart), int.Parse(p_strLength));
		}

		/// <summary>
		/// Gets the length of the given value.
		/// </summary>
		/// <param name="p_strValue">The value from whose length is to be determined.</param>
		/// <returns>The length of the given value.</returns>
		public string StringLength(string p_strValue)
		{
			return p_strValue.Length.ToString();
		}

		#endregion

		#region Math

		/// <summary>
		/// Evaluates the given mathematical expression.
		/// </summary>
		/// <param name="p_strExpression">The expression to evaluate.</param>
		/// <returns>The result of the given mathematical expression.</returns>
		public string Calculate(string p_strExpression)
		{
            // ??? Are we supporting this?
            //string strExpression = p_strExpression.Replace("mod", "%");
            //Expression expExpression = new Expression(strExpression, EvaluateOptions.IgnoreCase);
            //return expExpression.Evaluate().ToString();
            return null;
		}

		#endregion
	}
}
