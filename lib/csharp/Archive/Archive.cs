using SevenZip;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using Util;
using Util.Collections;

namespace Archiving
{
	/// <summary>
	/// Encapsulates the interactions with an archive file.
	/// </summary>
	public class Archive : IDisposable
	{
		/// <summary>
		/// Raised when the files in the archive have changed.
		/// </summary>
		public event EventHandler FilesChanged = delegate { };

		/// <summary>
		/// The path prefix used to identify a file as being contained in an archive.
		/// </summary>
		protected const string ARCHIVE_PREFIX = "arch:";

		private IFileSystem m_fsFileUtil = null;
		private string m_strPath = null;
		private ICompressor m_szcCompressor = null;
		private List<string> m_strFiles = null;
		private Dictionary<string, ArchiveFileInfo> m_dicFileInfo = null;
		private bool m_booCanEdit = false;
		private bool m_booIsSolid = false;
		private IExtractor m_szeReadOnlyExtractor = null;
		private string m_strReadOnlyTempDirectory = null;
		private IExtractorFactory m_efExtractorFactory;

		#region Properties

		/// <summary>
		/// Gets whether or not the archive is read-only.
		/// </summary>
		/// <remarks>
		/// RAR files are the only read-only archives. This is because FOMM isn't allow to create/edit RAR files
		/// (from a licensing standpoint).
		/// </remarks>
		/// <value>Whether or not the archive is read-only.</value>
		public bool CanEdit
		{
			get
			{
				return !m_booCanEdit;
			}
		}

		/// <summary>
		/// Gets the path of the archive.
		/// </summary>
		/// <value>The path of the archive.</value>
		public string ArchivePath
		{
			get
			{
				return m_strPath;
			}
		}

		/// <summary>
		/// Gets the names of the volumes that make up this archive.
		/// </summary>
		/// <value>The names of the volumes that make up this archive.</value>
		public string[] VolumeFileNames
		{
			get
			{
				using (IExtractor szeExtractor = m_efExtractorFactory.GetExtractor(m_strPath))
				{
					IList<string> lstVolumes = szeExtractor.VolumeFileNames;
					string[] strVolumes = new string[lstVolumes.Count];
					lstVolumes.CopyTo(strVolumes, 0);
					return strVolumes;
				}
			}
		}

		/// <summary>
		/// Gets whether the archive is solid.
		/// </summary>
		/// <value>Whether the archive is solid.</value>
		public bool IsSolid
		{
			get
			{
				return m_booIsSolid;
			}
		}

		#endregion

		#region Utility Methods

		/// <summary>
		/// Determines whether or not the file specified by the given path
		/// is an archive.
		/// </summary>
		/// <returns><c>true</c> if the specified file is an archive;
		/// <c>false</c> otherwise.</returns>
		public static bool IsArchive(IFileSystem p_fsFileUtil, IExtractorFactory p_efExtractorFactory, string p_strPath)
		{
			if (!p_strPath.StartsWith(ARCHIVE_PREFIX) && !p_fsFileUtil.Exists(p_strPath))
				return false;

			try
			{
				using (IExtractor szeExtractor = p_efExtractorFactory.GetExtractor(p_strPath))
				{
					UInt32 g = szeExtractor.FilesCount;
				}
				return true;
			}
			catch (Exception)
			{
				return false;
			}
		}

		/// <summary>
		/// Determines whether or not the given path points to a file in an archive.
		/// </summary>
		/// <returns><c>true</c> if the given path points to a file in an archive;
		/// <c>false</c> otherwise.</returns>
		public static bool IsArchivePath(string p_strPath)
		{
			return !String.IsNullOrEmpty(p_strPath) && p_strPath.StartsWith(ARCHIVE_PREFIX, StringComparison.OrdinalIgnoreCase);
		}

		/// <summary>
		/// Parses the given path to extract the path to the archive file, and the path to
		/// a file within said archive.
		/// </summary>
		/// <param name="p_strPath">The file path to parse.</param>
		/// <returns>The path to an archive file, and the path to a file within said archive.</returns>
		public static KeyValuePair<string, string> ParseArchivePath(string p_strPath)
		{
			if (!p_strPath.StartsWith(ARCHIVE_PREFIX))
				return new KeyValuePair<string, string>(null, null);
			Int32 intEndIndex = p_strPath.LastIndexOf("//");
			if (intEndIndex < 0)
				intEndIndex = p_strPath.Length;
			string strArchive = p_strPath.Substring(ARCHIVE_PREFIX.Length, intEndIndex - ARCHIVE_PREFIX.Length);
			string strPath = p_strPath.Substring(intEndIndex + 2);
			return new KeyValuePair<string, string>(strArchive, strPath);
		}

		/// <summary>
		/// Generates a path to a file in an archive.
		/// </summary>
		/// <param name="p_strArchivePath">The path of the archive file.</param>
		/// <param name="p_strInternalPath">The path of the file in the archive.</param>
		/// <returns></returns>
		public static string GenerateArchivePath(string p_strArchivePath, string p_strInternalPath)
		{
			return String.Format("{0}{1}//{2}", Archive.ARCHIVE_PREFIX, p_strArchivePath, p_strInternalPath);
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor the initializes the object with the given values.
		/// </summary>
		/// <param name="p_strPath">The path to the archive file.</param>
		public Archive(IFileSystem p_fsFileUtil, IExtractorFactory p_efExtractorFactory, string p_strPath)
		{
			m_fsFileUtil = p_fsFileUtil;
			m_efExtractorFactory = p_efExtractorFactory;
			m_strPath = p_strPath;
			if (!p_strPath.StartsWith(ARCHIVE_PREFIX))
			{
				m_strPath = p_strPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
				using (IExtractor szeExtractor = p_efExtractorFactory.GetExtractor(m_strPath))
				{
					if (Enum.IsDefined(typeof(OutArchiveFormat), szeExtractor.Format.ToString()))
					{
						m_szcCompressor = p_efExtractorFactory.GetCompressor();
						m_szcCompressor.CompressionMode = CompressionMode.Append;
						m_szcCompressor.ArchiveFormat = (OutArchiveFormat)Enum.Parse(typeof(OutArchiveFormat), szeExtractor.Format.ToString());
						m_booCanEdit = true;
					}
				}
			}
			m_dicFileInfo = new Dictionary<string, ArchiveFileInfo>(StringComparer.OrdinalIgnoreCase);
			m_strFiles = new List<string>();
			LoadFileIndices();
		}

		#endregion

		#region Read Transactions

		/// <summary>
		/// Raised to update listeners on the progress of the read-only initialization.
		/// </summary>
		public event CancelProgressEventHandler ReadOnlyInitProgressUpdated = delegate { };

		/// <summary>
		/// Gets whether the archive is in read-only mode.
		/// </summary>
		/// <remarks>
		/// Read-only mode maintains a single extractor for all operations, greatly increasing
		/// extraction speed as the extractor isn't created/destroyed for each operation. While
		/// in read-only mod the underlying file is left open (this class holds a handle to the file).
		/// </remarks>
		/// <value>Whether the archive is in read-only mode.</value>
		protected bool IsReadonly
		{
			get
			{
				return ((object)m_strReadOnlyTempDirectory ?? m_szeReadOnlyExtractor) != null;
			}
		}

		/// <summary>
		/// Starts a read-only transaction.
		/// </summary>
		/// <remarks>
		/// This puts the archive into read-only mode.
		/// </remarks>
		/// <param name="p_fsFileUtil">An instance of a <see cref="FileUtil"/> class.</param>
		/// <exception cref="ArgumentNullException">Thrown if <paramref name="p_fsFileUtil"/> is <c>null</c>.</exception>
		public void BeginReadOnlyTransaction()
		{
			if (m_szeReadOnlyExtractor == null)
			{
				m_szeReadOnlyExtractor = m_efExtractorFactory.GetThreadSafeExtractor(m_strPath);
				if (m_szeReadOnlyExtractor.IsSolid)
				{
					m_szeReadOnlyExtractor.Dispose();
					m_szeReadOnlyExtractor = null;
					m_strReadOnlyTempDirectory = m_fsFileUtil.CreateTempDirectory();
					using (IExtractor szeExtractor = m_efExtractorFactory.GetExtractor(m_strPath))
					{
						szeExtractor.FileExtractionFinished += new EventHandler<FileInfoEventArgs>(FileExtractionFinished);
						szeExtractor.ExtractArchive(m_strReadOnlyTempDirectory);
					}
				}
			}
		}

		#region Callbacks

		/// <summary>
		/// Called when a file has been extracted from a source archive.
		/// </summary>
		/// <remarks>
		/// This notifies listeners that a read-only initialization step has finished.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">An <see cref="EventArgs"/> describing the event arguments.</param>
		private void FileExtractionFinished(object sender, FileInfoEventArgs e)
		{
			CancelProgressEventArgs ceaArgs = new CancelProgressEventArgs((float)e.PercentDone / 100f);
			ReadOnlyInitProgressUpdated(this, ceaArgs);
			e.Cancel = ceaArgs.Cancel;
		}

		#endregion

		/// <summary>
		/// Ends a read-only transaction.
		/// </summary>
		/// <remarks>
		/// This takes the archive out of read-only mode, and releases any used resources.
		/// </remarks>
		public void EndReadOnlyTransaction()
		{
			if (m_szeReadOnlyExtractor != null)
				m_szeReadOnlyExtractor.Dispose();
			m_szeReadOnlyExtractor = null;
			if (!String.IsNullOrEmpty(m_strReadOnlyTempDirectory))
				m_fsFileUtil.ForceDelete(m_strReadOnlyTempDirectory);
			m_strReadOnlyTempDirectory = null;
		}

		#endregion

		/// <summary>
		/// Caches information about the files in the archive.
		/// </summary>
		protected void LoadFileIndices()
		{
			m_dicFileInfo.Clear();
			m_strFiles.Clear();
			using (IExtractor szeExtractor = m_efExtractorFactory.GetExtractor(m_strPath))
			{
				try
				{
					m_booIsSolid = szeExtractor.IsSolid;

					foreach (ArchiveFileInfo afiFile in szeExtractor.ArchiveFileData)
						if (!afiFile.IsDirectory)
						{
							m_dicFileInfo[afiFile.FileName.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar)] = afiFile;
							m_strFiles.Add(afiFile.FileName.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar));
						}
				}
				catch { }
			}
			FilesChanged(this, new EventArgs());
		}

		/// <summary>
		/// Determins if the given path is a directory in this archive.
		/// </summary>
		/// <param name="p_strPath">The path to examine.</param>
		/// <returns><c>true</c> if the given path is a directory in this archive;
		/// <c>false</c> otherwise.</returns>
		public bool IsDirectory(string p_strPath)
		{
			string strPath = p_strPath.Trim(new char[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar });
			strPath = strPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			string strPathWithSep = strPath + Path.DirectorySeparatorChar;

			if (m_dicFileInfo.ContainsKey(strPath))
				return false;

			foreach (string strFile in m_dicFileInfo.Keys)
				if (strFile.StartsWith(strPathWithSep, StringComparison.InvariantCultureIgnoreCase))
					return true;

			ArchiveFileInfo afiFile = default(ArchiveFileInfo);
			string strArchiveFileName = null;
			using (IExtractor szeExtractor = m_efExtractorFactory.GetExtractor(m_strPath))
				foreach (ArchiveFileInfo afiTmp in szeExtractor.ArchiveFileData)
				{
					strArchiveFileName = afiTmp.FileName.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
					if (strArchiveFileName.Equals(strPath, StringComparison.InvariantCultureIgnoreCase))
					{
						afiFile = afiTmp;
						break;
					}
				}
			return (afiFile == null) ? false : afiFile.IsDirectory;
		}

		/// <summary>
		/// Gets a list of directories that are in the specified directory in this archive.
		/// </summary>
		/// <param name="p_strDirectory">The directory in the archive whose descendents are to be returned.</param>
		/// <returns>A list of directories that are in the specified directory in this archive.</returns>
		public string[] GetDirectories(string p_strDirectory)
		{
			string strPrefix = p_strDirectory;
			if (String.IsNullOrEmpty(p_strDirectory))
				strPrefix = "";
			strPrefix = strPrefix.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			strPrefix = strPrefix.Trim(Path.DirectorySeparatorChar);
			if (strPrefix.Length > 0)
				strPrefix += Path.DirectorySeparatorChar;
			Set<string> lstFolders = new Set<string>(StringComparer.InvariantCultureIgnoreCase);
			Int32 intStopIndex = 0;
			foreach (string strFile in m_strFiles)
			{
				if (strFile.StartsWith(strPrefix, StringComparison.InvariantCultureIgnoreCase))
				{
					intStopIndex = strFile.IndexOf(Path.DirectorySeparatorChar, strPrefix.Length);
					if (intStopIndex < 0)
						continue;
					lstFolders.Add(String.Copy(strFile.Substring(0, intStopIndex)));
				}
			}
			return lstFolders.ToArray();
		}

		/// <summary>
		/// Gets a list of files that are in the specified directory in this archive.
		/// </summary>
		/// <param name="p_strDirectory">The directory in the archive whose descendents are to be returned.</param>
		/// <param name="p_booRecurse">Whether to return files that are in subdirectories of the given directory.</param>
		/// <returns>A list of files that are in the specified directory in this archive.</returns>
		public string[] GetFiles(string p_strDirectory, bool p_booRecurse)
		{
			Set<string> lstFiles = new Set<string>(StringComparer.InvariantCultureIgnoreCase);
			/*
			if (String.IsNullOrEmpty(p_strDirectory))
			{
				m_strFiles.ForEach((s) => { lstFiles.Add(String.Copy(s)); });
			}
			else
			{*/
				string strPrefix = p_strDirectory;
				strPrefix = strPrefix.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
				strPrefix = strPrefix.Trim(Path.DirectorySeparatorChar);
				if (strPrefix.Length > 0)
					strPrefix += Path.DirectorySeparatorChar;
				Int32 intStopIndex = 0;
				foreach (string strFile in m_strFiles)
				{
					if (strFile.StartsWith(strPrefix, StringComparison.InvariantCultureIgnoreCase))
					{
						if (!p_booRecurse)
						{
							intStopIndex = strFile.IndexOf(Path.DirectorySeparatorChar, strPrefix.Length);
							if (intStopIndex > 0)
								continue;
						}
						lstFiles.Add(String.Copy(strFile));
					}
				}
			//}
			return lstFiles.ToArray();
		}

		/// <summary>
		/// Gets a list of files that are in the specified directory and match the given pattern in this archive.
		/// </summary>
		/// <param name="p_strDirectory">The directory in the archive whose descendents are to be returned.</param>
		/// <param name="p_strPattern">The filename pattern of the files to be returned.</param>
		/// <param name="p_booRecurse">Whether to return files that are in subdirectories of the given directory.</param>
		/// <returns>A list of files that are in the specified directory and match the given pattern in this archive.</returns>
		public string[] GetFiles(string p_strDirectory, string p_strPattern, bool p_booRecurse)
		{
			Set<string> lstFiles = new Set<string>(StringComparer.InvariantCultureIgnoreCase);
			string[] strFiles = GetFiles(p_strDirectory, p_booRecurse);

			string strSeparatorChar = Path.DirectorySeparatorChar.Equals('\\') ? @"\\" : Path.DirectorySeparatorChar.ToString();
			string strPattern = p_strPattern.Replace(".", "\\.").Replace("*", ".*").Replace(Path.AltDirectorySeparatorChar.ToString(), strSeparatorChar);
			Regex rgxPattern = new Regex(strPattern);

			foreach (string strFile in strFiles)
				if (rgxPattern.IsMatch(strFile))
					lstFiles.Add(strFile);
			return lstFiles.ToArray();
		}

		/// <summary>
		/// Determins if the archive contains the specified file.
		/// </summary>
		/// <param name="p_strPath">The path of the file whose presence in the archive is to be determined.</param>
		/// <returns><c>true</c> if the file is in the archive;
		/// <c>false</c> otherwise.</returns>
		public bool ContainsFile(string p_strPath)
		{
			string strPath = p_strPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			return m_dicFileInfo.ContainsKey(strPath);
		}

		/// <summary>
		/// Gets the contents of the specified file in the archive.
		/// </summary>
		/// <param name="p_strPath">The file whose contents are to be retrieved.</param>
		/// <returns>The contents of the specified file in the archive.</returns>
		/// TODO: This code is horrible! apart from completely missing abstraction of the archive type/read-only state,
		///   it creates a - potentially very large - buffer which is then never touched in read-only mode if there is
		///   no RO transaction.
		///   This function should return a stream.
		public byte[] GetFileContents(string p_strPath)
		{
			string strPath = p_strPath.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			if (!m_dicFileInfo.ContainsKey(strPath))
				throw new FileNotFoundException("The requested file does not exist in the archive.", p_strPath);

			byte[] bteFile = null;
			ArchiveFileInfo afiFile = m_dicFileInfo[strPath];
			bteFile = new byte[afiFile.Size];
			using (MemoryStream msmFile = new MemoryStream(bteFile))
			{
				//check to see if we are on the same thread as the extractor
				// if not, then marshall the call to the extractor's thread.
				// this needs to be done as the 7zip dll cannot handle calls from other
				// threads.
				if (IsReadonly)
				{
					if (m_szeReadOnlyExtractor == null)
						bteFile = m_fsFileUtil.ReadAllBytes(Path.Combine(m_strReadOnlyTempDirectory, strPath));
					else
						m_szeReadOnlyExtractor.ExtractFile(afiFile.Index, msmFile);
				}
				else
				{
					using (IExtractor szeExtractor = m_efExtractorFactory.GetExtractor(m_strPath))
						szeExtractor.ExtractFile(afiFile.Index, msmFile);
				}
			}
			if (bteFile.LongLength != (Int64)afiFile.Size)
			{
				//if I understand things correctly, this block should never execute
				// as bteFile should always be exactly the right size to hold the extracted file
				//however, just to be safe, I've included this code to make sure we only return
				// valid bytes
				byte[] bteReal = new byte[afiFile.Size];
				Array.Copy(bteFile, bteReal, bteReal.LongLength);
				bteFile = bteReal;
			}
			return bteFile;
		}

		/// <summary>
		/// Replaces the specified file in the archive with the given data.
		/// </summary>
		/// <remarks>
		/// If the specified file doesn't exist in the archive, the file is added.
		/// </remarks>
		/// <param name="p_strFileName">The path to the file to replace in the archive.</param>
		/// <param name="p_strData">The new file data.</param>
		public void ReplaceFile(string p_strFileName, string p_strData)
		{
			ReplaceFile(p_strFileName, Encoding.Default.GetBytes(p_strData));
		}

		/// <summary>
		/// Replaces the specified file in the archive with the given data.
		/// </summary>
		/// <remarks>
		/// If the specified file doesn't exist in the archive, the file is added.
		/// </remarks>
		/// <param name="p_strFileName">The path to the file to replace in the archive.</param>
		/// <param name="p_bteData">The new file data.</param>
		/// <exception cref="InvalidOperationException">Thrown if modification of archives of the current
		/// archive type is not supported.</exception>
		/// <exception cref="InvalidOperationException">Thrown if modification of archive is attempted
		/// while the archive is in a ready only transaction.</exception>
		public void ReplaceFile(string p_strFileName, byte[] p_bteData)
		{
			if (IsReadonly)
				throw new InvalidOperationException("Cannot replace a file while Archive is in a Read Only Transaction.");
			if (!m_booCanEdit)
				using (IExtractor szeExtractor = m_efExtractorFactory.GetExtractor(m_strPath))
					throw new InvalidOperationException("Cannot modify archive of type: " + szeExtractor.Format);
			string strPath = p_strFileName.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			if (m_dicFileInfo.ContainsKey(strPath))
			{
				Dictionary<int, string> dicDelete = new Dictionary<int, string>() { { m_dicFileInfo[strPath].Index, null } };
				m_szcCompressor.ModifyArchive(m_strPath, dicDelete);
			}
			using (MemoryStream msmData = new MemoryStream(p_bteData))
			{
				m_szcCompressor.CompressStreamDictionary(new Dictionary<string, Stream>() { { p_strFileName, msmData } }, m_strPath);
			}
			LoadFileIndices();
		}

		/// <summary>
		/// Deletes the specified file from the archive.
		/// </summary>
		/// <remarks>
		/// If the specified file doesn't exist in the archive, nothing is done.
		/// </remarks>
		/// <param name="p_strFileName">The path to the file to delete from the archive.</param>
		/// <exception cref="InvalidOperationException">Thrown if modification of archives of the current
		/// archive type is not supported.</exception>
		/// <exception cref="InvalidOperationException">Thrown if modification of archive is attempted
		/// while the archive is in a ready only transaction.</exception>
		public void DeleteFile(string p_strFileName)
		{
			if (IsReadonly)
				throw new InvalidOperationException("Cannot delete a file while Archive is in a Read Only Transaction.");
			if (!m_booCanEdit)
				using (IExtractor szeExtractor = m_efExtractorFactory.GetExtractor(m_strPath))
					throw new InvalidOperationException("Cannot modify archive of type: " + szeExtractor.Format);
			string strPath = p_strFileName.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			if (m_dicFileInfo.ContainsKey(strPath))
			{
				Dictionary<int, string> dicDelete = new Dictionary<int, string>() { { m_dicFileInfo[strPath].Index, null } };
				m_szcCompressor.ModifyArchive(m_strPath, dicDelete);
			}
			LoadFileIndices();
		}

		#region IDisposable Members

		private bool m_booDisposed = false;

		/// <summary>
		/// Disposes of the resources used by the object.
		/// </summary>
		protected virtual void Dispose(bool disposing)
		{
			if (!m_booDisposed)
			{
				EndReadOnlyTransaction();
			}
			m_booDisposed = true;
		}

		public void Dispose()
		{
			Dispose(true);
		}

		#endregion
	}
}
