using System;
using System.Collections.Generic;
using System.IO;
using System.Xml;
using System.Xml.Linq;

namespace Nexus.Client.ModManagement.Scripting.XmlScript
{
	/// <summary>
	/// Performs the mod installation based on the XML script.
	/// </summary>
	public class XmlScriptInstaller // ??? : BackgroundTask
	{
		private XDocument m_docLog = new XDocument();
		private XElement m_xelRoot = null;

		#region Properties

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the required dependencies.
		/// </summary>
		/// <param name="p_modMod">The mod for which the script is running.</param>
		/// <param name="p_gmdGameMode">The game mode currently being managed.</param>
		/// <param name="p_igpInstallers">The utility class to use to install the mod items.</param>
		public XmlScriptInstaller()
		{
		}

		#endregion

		/// <summary>
		/// Performs the mod installation based on the XML script.
		/// </summary>
		/// <param name="p_strModName">The name of the mod whose script in executing.</param>
		/// <param name="p_xscScript">The script that is executing.</param>
		/// <param name="p_csmStateManager">The state manager managing the install state.</param>
		/// <param name="p_colFilesToInstall">The list of files to install.</param>
		/// <param name="p_colPluginsToActivate">The list of plugins to activate.</param>
		/// <returns><c>true</c> if the installation succeeded;
		/// <c>false</c> otherwise.</returns>
		public bool Install(string p_strModName, XmlScript p_xscScript, ConditionStateManager p_csmStateManager, ICollection<InstallableFile> p_colFilesToInstall, ICollection<InstallableFile> p_colPluginsToActivate)
		{
			bool booSuccess = false;
			try
			{
				booSuccess = InstallFiles(p_xscScript, p_csmStateManager, p_colFilesToInstall, p_colPluginsToActivate);
			}
			catch (Exception ex)
			{
				booSuccess = false;
				throw new Exception(ex.Message);
			}
			return booSuccess;
		}

		/// <summary>
		/// Installs and activates files are required. This method is used by the background worker.
		/// </summary>
		/// <param name="p_scpScript">The XMl Script to execute.</param>
		protected bool InstallFiles(XmlScript p_xscScript, ConditionStateManager p_csmStateManager, ICollection<InstallableFile> p_colFilesToInstall, ICollection<InstallableFile> p_colPluginsToActivate)
		{
			IList<InstallableFile> lstRequiredFiles = p_xscScript.RequiredInstallFiles;
			IList<ConditionallyInstalledFileSet> lstConditionallyInstalledFileSets = p_xscScript.ConditionallyInstalledFileSets;

			foreach (InstallableFile iflRequiredFile in lstRequiredFiles)
			{
				if (!InstallFile(iflRequiredFile, true))
					return false;
			}

			foreach (InstallableFile ilfFile in p_colFilesToInstall)
			{
				if (!InstallFile(ilfFile, p_colPluginsToActivate.Contains(ilfFile)))
					return false;
			}

			foreach (ConditionallyInstalledFileSet cisFileSet in lstConditionallyInstalledFileSets)
			{
				if (cisFileSet.Condition.GetIsFulfilled(p_csmStateManager))
					foreach (InstallableFile ilfFile in cisFileSet.Files)
					{
						if (!InstallFile(ilfFile, true))
							return false;
					}
			}
			return true;
		}

		/// <summary>
		/// Installs the given <see cref="InstallableFile"/>, and activates any
		/// plugins it encompasses as requested.
		/// </summary>
		/// <param name="p_ilfFile">The file to install.</param>
		/// <param name="p_booActivate">Whether or not to activate the given file, if it is a plugin.</param>
		/// <returns><c>false</c> if the user cancelled the install;
		/// <c>true</c> otherwise.</returns>
		protected bool InstallFile(InstallableFile p_ilfFile, bool p_booActivate)
		{
			string strSource = p_ilfFile.Source;
			string strDest = p_ilfFile.Destination;
			if (p_ilfFile.IsFolder)
			{
				if (!InstallFolderFromMod(p_ilfFile))
					return false;

				//if the destination length is greater than 0, then nothing in
				// this folder is directly in the Data folder as so cannot be
				// activated
            // ??? 
			//	if (strDest.Length == 0)
			//	{
			//		List<string> lstFiles = Mod.GetFileList(strSource, true);
			//		string strDirectorySeparatorChar = Path.DirectorySeparatorChar.ToString();

			//		if (!strSource.EndsWith(strDirectorySeparatorChar) && !strSource.EndsWith("/"))
			//			strSource += strDirectorySeparatorChar;
			//		foreach (string strFile in lstFiles)
			//		{
			//			string strNewFileName = GameMode.GetModFormatAdjustedPath(Mod.Format, strFile.Substring(strSource.Length, strFile.Length - strSource.Length), false);
			//			if (Installers.PluginManager != null)
			//				if (Installers.PluginManager.IsActivatiblePluginFile(strNewFileName))
			//					Installers.PluginManager.SetPluginActivation(strNewFileName, p_booActivate);
			//		}
			//	}
			//}
			//else
			//{
			//	InstallFileFromMod(strSource, strDest);
			//	SaveXMLInstalledFiles(strSource, strDest);

			//	string strPluginPath = GameMode.GetModFormatAdjustedPath(Mod.Format, String.IsNullOrEmpty(strDest) ? strSource : strDest, false);
			//	if (Installers.PluginManager != null)
			//		if (Installers.PluginManager.IsActivatiblePluginFile(strPluginPath))
			//			Installers.PluginManager.SetPluginActivation(strPluginPath, p_booActivate);
			}
			return true;
		}

		#region Helper Methods

		/// <summary>
		/// Recursively copies all files and folders from one location to another.
		/// </summary>
		/// <param name="p_ilfFile">The folder to install.</param>
		/// <returns><c>false</c> if the user cancelled the install;
		/// <c>true</c> otherwise.</returns>
		protected bool InstallFolderFromMod(InstallableFile p_ilfFile)
		{
            // ???
            //List<string> lstModFiles = Mod.GetFileList(p_ilfFile.Source, true);
            List<string> lstModFiles = new List<string>();


            String strFrom = p_ilfFile.Source.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).ToLowerInvariant();
			if (!strFrom.EndsWith(Path.DirectorySeparatorChar.ToString()))
				strFrom += Path.DirectorySeparatorChar;
			String strTo = p_ilfFile.Destination.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			if ((strTo.Length > 0) && (!strTo.EndsWith(Path.DirectorySeparatorChar.ToString())))
				strTo += Path.DirectorySeparatorChar;
			String strMODFile = null;
			for (Int32 i = 0; i < lstModFiles.Count; i++)
			{
				strMODFile = lstModFiles[i];
				string strNewFileName = strMODFile.Substring(strFrom.Length, strMODFile.Length - strFrom.Length);
				if (strTo.Length > 0)
					strNewFileName = Path.Combine(strTo, strNewFileName);
				InstallFileFromMod(strMODFile, strNewFileName);
			}
			return true;
		}

		/// <summary>
		/// Installs the specified file from the mod to the specified location on the file system.
		/// </summary>
		/// <param name="p_strFrom">The path of the file in the mod to install.</param>
		/// <param name="p_strTo">The path on the file system where the file is to be created.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		protected bool InstallFileFromMod(string p_strFrom, string p_strTo)
		{
			bool booSuccess = false;
			string strFileType = Path.GetExtension(p_strTo);
			if (!strFileType.StartsWith("."))
				strFileType = "." + strFileType;
			//bool booHardLinkFile = ((GameMode.HardlinkRequiredFilesType(p_strTo) || strFileType.Equals(".exe", StringComparison.InvariantCultureIgnoreCase) || strFileType.Equals(".jar", StringComparison.InvariantCultureIgnoreCase)));

			try
			{
                // ???
				//string strModFilenamePath = Path.Combine(Path.GetFileNameWithoutExtension(Mod.Filename), p_strTo);
				//string strModDownloadIDPath = (string.IsNullOrWhiteSpace(Mod.DownloadId) || (Mod.DownloadId.Length <= 1) || Mod.DownloadId.Equals("-1", StringComparison.OrdinalIgnoreCase)) ? string.Empty : Path.Combine(Mod.DownloadId, p_strTo);
				//string strVirtualPath = strModFilenamePath;

				//if (!string.IsNullOrWhiteSpace(strModDownloadIDPath))
				//	strVirtualPath = strModDownloadIDPath;

				//Installers.FileInstaller.InstallFileFromMod(p_strFrom, strVirtualPath);
				// ??? m_mliModLinkInstaller.AddFileLink(Mod, p_strTo, strVirtualPath, true);

				booSuccess = true;
			}
			catch { }

			return booSuccess;
		}

		#endregion
	}
}
