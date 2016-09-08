using System;
using System.Collections.Generic;
using System.IO;
using System.Security;
using System.Security.Permissions;
using System.Xml.Linq;
using Util.BackgroundTasks;
using Util;
using Util.Collections;
using Mods;
using GameMode;
using UI;
using PluginManagement;

namespace Scripting
{
	/// <summary>
	/// Implements the functions availabe to scripts.
	/// </summary>
	/// <remarks>
	/// The proxy allows sandboxed scripts to call functions that can perform
	/// actions outside of the sandbox.
	/// </remarks>
	public class ScriptFunctionProxy : MarshalByRefObject
	{
		private XDocument m_docLog = new XDocument();
		private XElement m_xelRoot = null;

		#region Events

		/// <summary>
		/// Raised when a task in the set has started.
		/// </summary>
		/// <remarks>
		/// The argument passed with the event args is the task that
		/// has been started.
		/// </remarks>
		public event EventHandler<EventArgs<IBackgroundTask>> TaskStarted = delegate { };

		#endregion

		#region Properties

		/// <summary>
		/// Gets the mod for which the script is running.
		/// </summary>
		/// <value>The mod for which the script is running.</value>
		protected IMod Mod { get; private set; }

		/// <summary>
		/// Gets the game mode currently being managed.
		/// </summary>
		/// <value>The game mode currently being managed.</value>
		protected IGameMode GameMode { get; private set; }

		/// <summary>
		/// Gets the installer group to use to install mod items.
		/// </summary>
		/// <value>The installer group to use to install mod items.</value>
		protected InstallerGroup Installers { get; private set; }

		/// <summary>
		/// Gets the manager to use to display UI elements.
		/// </summary>
		/// <value>The manager to use to display UI elements.</value>
		protected IUI UIManager { get; private set; }

		/// <summary>
		/// path files are being installed to
		/// </summary>
		public string DestinationPath { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_modMod">The mod for which the script is running.</param>
		/// <param name="p_gmdGameMode">The game mode currently being managed.</param>
		/// <param name="p_strDetinationPath">path the mod is being installed to</param>
		/// <param name="p_igpInstallers">The utility class to use to install the mod items.</param>
		/// <param name="p_uipUIProxy">The UI manager to use to interact with UI elements.</param>
		public ScriptFunctionProxy(IMod p_modMod, IGameMode p_gmdGameMode, string p_strDestinationPath, InstallerGroup p_igpInstallers, IUI p_uipUIProxy)
		{
			Mod = p_modMod;
			GameMode = p_gmdGameMode;
			Installers = p_igpInstallers;
			UIManager = p_uipUIProxy;
			DestinationPath = p_strDestinationPath;
		}

		#endregion

		#region Event Raising

		/// <summary>
		/// Raises the <see cref="TaskStarted"/> event.
		/// </summary>
		/// <param name="e">An <see cref="EventArgs{IBackgroundTask}"/> describing the task that was started.</param>
		protected virtual void OnTaskStarted(EventArgs<IBackgroundTask> e)
		{
			TaskStarted(this, e);
		}

		/// <summary>
		/// Raises the <see cref="TaskStarted"/> event.
		/// </summary>
		/// <param name="p_bgtTask">The task that was started.</param>
		protected void OnTaskStarted(IBackgroundTask p_bgtTask)
		{
			OnTaskStarted(new EventArgs<IBackgroundTask>(p_bgtTask));
		}

		#endregion

		#region Installation

		/// <summary>
		/// Performs a basic install of the mod.
		/// </summary>
		/// <remarks>
		/// A basic install installs all of the file in the mod to the Data directory
		/// or activates all esp and esm files.
		/// </remarks>
		/// <returns><c>true</c> if the installation succeed;
		/// <c>false</c> otherwise.</returns>
		public bool PerformBasicInstall()
		{
			bool booSuccess = false;
			try
			{
				new SecurityPermission(SecurityPermissionFlag.UnmanagedCode).Assert();
				BasicInstallTask bitTask = new BasicInstallTask(Mod, GameMode, Installers.FileInstaller, "", null, null);
				OnTaskStarted(bitTask);
				booSuccess = bitTask.Execute();
			}
			finally
			{
				PermissionSet.RevertAssert();
			}
			return booSuccess;
		}

		#endregion

		#region File Management

		/// <summary>
		/// Installs the files in the specified folder from the mod to the file system.
		/// </summary>
		/// <param name="p_strFrom">The path of the folder in the mod containing the files to install.</param>
		/// <param name="p_booRecurse">Whether to install all files in all subfolders.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		public bool InstallFolderFromMod(string p_strFrom, bool p_booRecurse)
		{
			string strFrom = p_strFrom.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).ToLowerInvariant();
			return InstallFolderFromMod(strFrom, strFrom, p_booRecurse);
		}

		/// <summary>
		/// Installs the files in the specified folder from the mod to the specified location on the file system.
		/// </summary>
		/// <param name="p_strFrom">The path of the folder in the mod containing the files to install.</param>
		/// <param name="p_strTo">The path on the file system where the files are to be created.</param>
		/// <param name="p_booRecurse">Whether to install all files in all subfolders.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		public bool InstallFolderFromMod(string p_strFrom, string p_strTo, bool p_booRecurse)
		{
			string strFrom = p_strFrom.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).ToLowerInvariant();
			if (!strFrom.EndsWith(Path.DirectorySeparatorChar.ToString()))
				strFrom += Path.DirectorySeparatorChar;
			string strTo = p_strTo.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			if ((strTo.Length > 0) && (!strTo.EndsWith(Path.DirectorySeparatorChar.ToString())))
				strTo += Path.DirectorySeparatorChar;
			foreach (string strMODFile in GetModFileList(strFrom, p_booRecurse))
			{
				string strNewFileName = strMODFile.Substring(strFrom.Length);
				if (!InstallFileFromMod(strMODFile, Path.Combine(strTo, strNewFileName)))
					return false;
			}
			return true;
		}

		/// <summary>
		/// Installs the specified file from the mod to the specified location on the file system.
		/// </summary>
		/// <param name="p_strFrom">The path of the file in the mod to install.</param>
		/// <param name="p_strTo">The path on the file system where the file is to be created.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		public virtual bool InstallFileFromMod(string p_strFrom, string p_strTo)
		{
			bool booSuccess = false;
			string strFrom = p_strFrom.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).ToLowerInvariant();
			string strTo = p_strTo.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			string strFileType = Path.GetExtension(strTo);
			if (!strFileType.StartsWith("."))
				strFileType = "." + strFileType;

			try
			{
				new SecurityPermission(SecurityPermissionFlag.UnmanagedCode).Assert();

				string strModFilenamePath = Path.Combine(DestinationPath, Path.GetFileNameWithoutExtension(Mod.Filename), strTo);
				string strModDownloadIDPath = (string.IsNullOrWhiteSpace(Mod.DownloadId) || (Mod.DownloadId.Length <= 1)) ? string.Empty : Path.Combine(DestinationPath, Mod.DownloadId, strTo);
				string strVirtualPath = strModFilenamePath;

				if (!string.IsNullOrWhiteSpace(strModDownloadIDPath))
					strVirtualPath = strModDownloadIDPath;

				Installers.FileInstaller.InstallFileFromMod(strFrom, strVirtualPath);

				booSuccess = true;
			}
			finally
			{
				PermissionSet.RevertAssert();
			}
			
			return booSuccess;
		}

		/// <summary>
		/// Create the XML file with the Install Files list (From the rar to the folder).
		/// </summary>
		private void SaveXMLInstalledFiles(string p_strFrom, string p_strTo)
		{
			if (m_docLog == null)
				m_docLog = new XDocument();

			string strInstallFilesPath = Path.Combine(Path.Combine(GameMode.GameModeEnvironmentInfo.InstallInfoDirectory, "Scripted"), Path.GetFileNameWithoutExtension(Mod.Filename)) + ".xml";
			if (!Directory.Exists(Path.Combine(GameMode.GameModeEnvironmentInfo.InstallInfoDirectory, "Scripted")))
				Directory.CreateDirectory(Path.Combine(GameMode.GameModeEnvironmentInfo.InstallInfoDirectory, "Scripted"));

			if (Directory.Exists(Path.Combine(GameMode.GameModeEnvironmentInfo.InstallInfoDirectory, "Scripted")))
			{
				if (!File.Exists(strInstallFilesPath))
				{
					m_xelRoot = new XElement("FileList", new XAttribute("ModName", Mod.ModName ?? String.Empty), new XAttribute("ModVersion", Mod.HumanReadableVersion ?? String.Empty));
					m_docLog.Add(m_xelRoot);
					XElement xelFiles = new XElement("File", new XAttribute("FileFrom", p_strFrom ?? String.Empty), new XAttribute("FileTo", p_strTo ?? String.Empty));
					m_xelRoot.Add(xelFiles);
				}
				else
				{
					XElement xelFiles = new XElement("File", new XAttribute("FileFrom", p_strFrom ?? String.Empty), new XAttribute("FileTo", p_strTo ?? String.Empty));
					m_xelRoot.Add(xelFiles);
				}

				m_docLog.Save(strInstallFilesPath);
			}
		}

		/// <summary>
		/// Installs the specified file from the mod to the file system.
		/// </summary>
		/// <param name="p_strFile">The path of the file to install.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		public bool InstallFileFromMod(string p_strFile)
		{
			string strFile = p_strFile.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			return InstallFileFromMod(strFile, strFile);
		}

		/// <summary>
		/// Retrieves the list of files in the mod.
		/// </summary>
		/// <returns>The list of files in the mod.</returns>
		public string[] GetModFileList()
		{
			string[] strFiles = null;
			try
			{
				new SecurityPermission(SecurityPermissionFlag.UnmanagedCode).Assert();
				strFiles = Mod.GetFileList().ToArray();
			}
			finally
			{
				PermissionSet.RevertAssert();
			}
			for (Int32 i = strFiles.Length - 1; i >= 0; i--)
				strFiles[i] = strFiles[i].Replace(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
			return strFiles;
		}

		/// <summary>
		/// Retrieves the list of files in the specified folder in the mod.
		/// </summary>
		/// <param name="p_strFolder">The folder whose file list is to be retrieved.</param>
		/// <param name="p_booRecurse">Whether to return files that are in subdirectories of the given directory.</param>
		/// <returns>The list of files in the specified folder in the mod.</returns>
		public string[] GetModFileList(string p_strFolder, bool p_booRecurse)
		{
			string[] strFiles = null;
			try
			{
				new SecurityPermission(SecurityPermissionFlag.UnmanagedCode).Assert();
				strFiles = Mod.GetFileList(p_strFolder, p_booRecurse).ToArray();
			}
			finally
			{
				PermissionSet.RevertAssert();
			}
			for (Int32 i = strFiles.Length - 1; i >= 0; i--)
				strFiles[i] = strFiles[i].Replace(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
			return strFiles;
		}

		/// <summary>
		/// Retrieves the specified file from the mod.
		/// </summary>
		/// <param name="p_strFile">The file to retrieve.</param>
		/// <returns>The requested file data.</returns>
		public byte[] GetFileFromMod(string p_strFile)
		{
			byte[] bteFile = null;
			try
			{
				new SecurityPermission(SecurityPermissionFlag.UnmanagedCode).Assert();
				bteFile = Mod.GetFile(p_strFile);
			}
			finally
			{
				PermissionSet.RevertAssert();
			}
			return bteFile;
		}

		/// <summary>
		/// Gets a filtered list of all files in a user's Data directory.
		/// </summary>
		/// <param name="p_strPath">The subdirectory of the Data directory from which to get the listing.</param>
		/// <param name="p_strPattern">The pattern against which to filter the file paths.</param>
		/// <param name="p_booAllFolders">Whether or not to search through subdirectories.</param>
		/// <returns>A filtered list of all files in a user's Data directory.</returns>
		public string[] GetExistingDataFileList(string p_strPath, string p_strPattern, bool p_booAllFolders)
		{
			string strPath = p_strPath.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			string strFixedPath = GameMode.GetModFormatAdjustedPath(Mod.Format, strPath, false);
			return Installers.DataFileUtility.GetExistingDataFileList(strFixedPath, p_strPattern, p_booAllFolders);
		}

		/// <summary>
		/// Determines if the specified file exists in the user's Data directory.
		/// </summary>
		/// <param name="p_strPath">The path of the file whose existence is to be verified.</param>
		/// <returns><c>true</c> if the specified file exists; <c>false</c>
		/// otherwise.</returns>
		public bool DataFileExists(string p_strPath)
		{
			string strPath = p_strPath.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			string strFixedPath = GameMode.GetModFormatAdjustedPath(Mod.Format, strPath, false);
			return Installers.DataFileUtility.DataFileExists(strFixedPath);
		}

		/// <summary>
		/// Gets the speified file from the user's Data directory.
		/// </summary>
		/// <param name="p_strPath">The path of the file to retrieve.</param>
		/// <returns>The specified file, or <c>null</c> if the file does not exist.</returns>
		public byte[] GetExistingDataFile(string p_strPath)
		{
			string strPath = p_strPath.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			string strFixedPath = GameMode.GetModFormatAdjustedPath(Mod.Format, strPath, false);
			return Installers.DataFileUtility.GetExistingDataFile(strFixedPath);
		}

		/// <summary>
		/// Writes the file represented by the given byte array to the given path.
		/// </summary>
		/// <remarks>
		/// This method writes the given data as a file at the given path. If the file
		/// already exists the user is prompted to overwrite the file.
		/// </remarks>
		/// <param name="p_strPath">The path where the file is to be created.</param>
		/// <param name="p_bteData">The data that is to make up the file.</param>
		/// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
		public bool GenerateDataFile(string p_strPath, byte[] p_bteData)
		{
			bool booSuccess = false;
			string strPath = p_strPath.Trim().Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
			string strFileType = Path.GetExtension(strPath);
			if (!strFileType.StartsWith("."))
				strFileType = "." + strFileType;

			try
			{
				new SecurityPermission(SecurityPermissionFlag.UnmanagedCode).Assert();

				string strModFilenamePath = Path.Combine(DestinationPath, Path.GetFileNameWithoutExtension(Mod.Filename), strPath);
				string strModDownloadIDPath = (string.IsNullOrWhiteSpace(Mod.DownloadId) || (Mod.DownloadId.Length <= 1) || Mod.DownloadId.Equals("-1", StringComparison.OrdinalIgnoreCase)) ? string.Empty : Path.Combine(DestinationPath, Mod.DownloadId, strPath);
				string strVirtualPath = strModFilenamePath;

				if (!string.IsNullOrWhiteSpace(strModDownloadIDPath))
					strVirtualPath = strModDownloadIDPath;

				Installers.FileInstaller.GenerateDataFile(strVirtualPath, p_bteData);

				booSuccess = true;
			}
			finally
			{
				PermissionSet.RevertAssert();
			}
			return booSuccess;
		}

		#endregion

		#region UI

		#region MessageBox

		/// <summary>
		/// Shows a message box with the given message.
		/// </summary>
		/// <param name="p_strMessage">The message to display in the message box.</param>
		public void MessageBox(string p_strMessage)
		{
			UIManager.ShowMessageBox(p_strMessage);
		}

		/// <summary>
		/// Shows a message box with the given message and title.
		/// </summary>
		/// <param name="p_strMessage">The message to display in the message box.</param>
		/// <param name="p_strTitle">The message box's title, display in the title bar.</param>
		public void MessageBox(string p_strMessage, string p_strTitle)
		{
			UIManager.ShowMessageBox(p_strMessage, p_strTitle);
		}

		/// <summary>
		/// Shows a message box with the given message, title, and buttons.
		/// </summary>
		/// <param name="p_strMessage">The message to display in the message box.</param>
		/// <param name="p_strTitle">The message box's title, display in the title bar.</param>
		/// <param name="p_mbbButtons">The buttons to show in the message box.</param>
		public DialogResult MessageBox(string p_strMessage, string p_strTitle, MessageBoxButtons p_mbbButtons)
		{
			return UIManager.ShowMessageBox(p_strMessage, p_strTitle, p_mbbButtons);
		}

		/// <summary>
		/// Shows a message box with the given message, title, buttons, and icon.
		/// </summary>
		/// <param name="p_strMessage">The message to display in the message box.</param>
		/// <param name="p_strTitle">The message box's title, display in the title bar.</param>
		/// <param name="p_mbbButtons">The buttons to show in the message box.</param>
		/// <param name="p_mdiIcon">The icon to display in the message box.</param>
		public DialogResult MessageBox(string p_strMessage, string p_strTitle, MessageBoxButtons p_mbbButtons, MessageBoxIcon p_mdiIcon)
		{
			return UIManager.ShowMessageBox(p_strMessage, p_strTitle, p_mbbButtons, p_mdiIcon);
		}

		#endregion

		#region ExtendedMessageBox

		/// <summary>
		/// Shows an extended message box with the given message, title, details, buttons, and icon.
		/// </summary>
		/// <param name="p_strMessage">The message to display in the message box.</param>
		/// <param name="p_strTitle">The message box's title, displayed in the title bar.</param>
		/// <param name="p_strDetails">The message box's details, displayed in the details area.</param>
		/// <param name="p_mbbButtons">The buttons to show in the message box.</param>
		/// <param name="p_mdiIcon">The icon to display in the message box.</param>
		public DialogResult ExtendedMessageBox(string p_strMessage, string p_strTitle, string p_strDetails, MessageBoxButtons p_mbbButtons, MessageBoxIcon p_mdiIcon)
		{
			return UIManager.ShowExtendedMessageBox(p_strMessage, p_strTitle, p_strDetails, p_mbbButtons, p_mdiIcon);
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
		public string[] Select(IList<SelectOption> p_lstOptions, string p_strTitle, bool p_booSelectMany)
		{
			return UIManager.Select(p_lstOptions, p_strTitle, p_booSelectMany);
		}

		#endregion

		#endregion

		#region Version Checking

		/// <summary>
		/// Gets the version of the mod manager.
		/// </summary>
		/// <returns>The version of the mod manager.</returns>
		public virtual Version GetModManagerVersion()
		{
			// TODO: the mod manager version is really none of the installers beesway
			return new Version(1, 0);
		}

		/// <summary>
		/// Gets the version of the game that is installed.
		/// </summary>
		/// <returns>The version of the game, or <c>null</c> if Fallout
		/// is not installed.</returns>
		public Version GetGameVersion()
		{
			return GameMode.GameVersion;
		}

		#endregion

		#region Plugin Management

		/// <summary>
		/// The returns a list of the paths of the given plugins, relative to the game mode's installation path.
		/// </summary>
		/// <param name="p_lstPlugins">The plugins whose paths are to be made relative.</param>
		/// <returns>A list of the paths of the given plugins, relative to the game mode's installation path.</returns>
		protected string[] RelativizePluginPaths(IList<Plugin> p_lstPlugins)
		{
			string[] strPlugins = new string[p_lstPlugins.Count];
			string strInstallationPath = Path.Combine(GameMode.GameModeEnvironmentInfo.InstallationPath, GameMode.GetModFormatAdjustedPath(Mod.Format, null, false));
			Int32 intTrimLength = strInstallationPath.Trim(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).Length + 1;
			for (Int32 i = 0; i < p_lstPlugins.Count; i++)
				strPlugins[i] = p_lstPlugins[i].Filename.Remove(0, intTrimLength);
			return strPlugins;
		}

		/// <summary>
		/// Gets a list of all installed plugins.
		/// </summary>
		/// <returns>A list of all installed plugins.</returns>
		public string[] GetAllPlugins()
		{
			return RelativizePluginPaths(Installers.PluginManager.ManagedPlugins);
		}

		#region Plugin Activation Management

		/// <summary>
		/// Retrieves a list of currently active plugins.
		/// </summary>
		/// <returns>A list of currently active plugins.</returns>
		public string[] GetActivePlugins()
		{
			return RelativizePluginPaths(Installers.PluginManager.ActivePlugins);
		}

		/// <summary>
		/// Sets the activated status of a plugin (i.e., and esp or esm file).
		/// </summary>
		/// <param name="p_strPluginPath">The path to the plugin to activate or deactivate.</param>
		/// <param name="p_booActivate">Whether to activate the plugin.</param>
		public void SetPluginActivation(string p_strPluginPath, bool p_booActivate)
		{
			string strFixedPath = GameMode.GetModFormatAdjustedPath(Mod.Format, p_strPluginPath, false);
			Installers.PluginManager.SetPluginActivation(strFixedPath, p_booActivate);
		}

		#endregion

		#region Load Order Management

		/// <summary>
		/// Sets the load order of the specifid plugin.
		/// </summary>
		/// <param name="p_strPlugin">The path to the plugin file whose load order is to be set.</param>
		/// <param name="p_intNewIndex">The new load order index of the plugin.</param>
		protected void DoSetPluginOrderIndex(string p_strPlugin, int p_intNewIndex)
		{

			string strFixedPath = Path.Combine(GameMode.GameModeEnvironmentInfo.InstallationPath, GameMode.GetModFormatAdjustedPath(Mod.Format, p_strPlugin, false));
			Plugin plgPlugin = Installers.PluginManager.ManagedPlugins.Find(x => x.Filename.Equals(strFixedPath, StringComparison.OrdinalIgnoreCase));
			Installers.PluginManager.SetPluginOrderIndex(plgPlugin, p_intNewIndex);
		}

		/// <summary>
		/// Sets the load order of the specifid plugin.
		/// </summary>
		/// <param name="p_strPlugin">The path to the plugin file whose load order is to be set.</param>
		/// <param name="p_intNewIndex">The new load order index of the plugin.</param>
		public void SetPluginOrderIndex(string p_strPlugin, int p_intNewIndex)
		{
			DoSetPluginOrderIndex(p_strPlugin, p_intNewIndex);
		}

		/// <summary>
		/// Sets the load order of the plugins.
		/// </summary>
		/// <remarks>
		/// Each plugin will be moved from its current index to its indices' position
		/// in <paramref name="p_intPlugins"/>.
		/// </remarks>
		/// <param name="p_intPlugins">The new load order of the plugins. Each entry in this array
		/// contains the current index of a plugin. This array must contain all current indices.</param>
		protected void DoSetLoadOrder(int[] p_intPlugins)
		{
			List<Plugin> lstPlugins = new List<Plugin>(Installers.PluginManager.ManagedPlugins);
			if (p_intPlugins.Length != lstPlugins.Count)
				throw new ArgumentException("Length of new load order array was different to the total number of plugins");

			for (int i = 0; i < p_intPlugins.Length; i++)
				if (p_intPlugins[i] < 0 || p_intPlugins[i] >= p_intPlugins.Length)
					throw new IndexOutOfRangeException("A plugin index was out of range");

			for (int i = 0; i < lstPlugins.Count; i++)
				Installers.PluginManager.SetPluginOrderIndex(lstPlugins[i], i);
		}

		/// <summary>
		/// Sets the load order of the plugins.
		/// </summary>
		/// <remarks>
		/// Each plugin will be moved from its current index to its indices' position
		/// in <paramref name="p_intPlugins"/>.
		/// </remarks>
		/// <param name="p_intPlugins">The new load order of the plugins. Each entry in this array
		/// contains the current index of a plugin. This array must contain all current indices.</param>
		public void SetLoadOrder(int[] p_intPlugins)
		{
			DoSetLoadOrder(p_intPlugins);
		}

		/// <summary>
		/// Moves the specified plugins to the given position in the load order.
		/// </summary>
		/// <remarks>
		/// Note that the order of the given list of plugins is not maintained. They are re-ordered
		/// to be in the same order as they are in the before-operation load order. This, I think,
		/// is somewhat counter-intuitive and may change, though likely not so as to not break
		/// backwards compatibility.
		/// </remarks>
		/// <param name="p_intPlugins">The list of plugins to move to the given position in the
		/// load order. Each entry in this array contains the current index of a plugin.</param>
		/// <param name="p_intPosition">The position in the load order to which to move the specified
		/// plugins.</param>
		protected void DoSetLoadOrder(int[] p_intPlugins, int p_intPosition)
		{
			List<Plugin> lstPlugins = new List<Plugin>(Installers.PluginManager.ManagedPlugins);
			Array.Sort<int>(p_intPlugins);

			Int32 intLoadOrder = 0;
			for (int i = 0; i < p_intPosition; i++)
			{
				if (Array.BinarySearch<int>(p_intPlugins, i) >= 0)
					continue;
				Installers.PluginManager.SetPluginOrderIndex(lstPlugins[i], intLoadOrder++);
			}
			for (int i = 0; i < p_intPlugins.Length; i++)
				Installers.PluginManager.SetPluginOrderIndex(lstPlugins[p_intPlugins[i]], intLoadOrder++);
			for (int i = p_intPosition; i < lstPlugins.Count; i++)
			{
				if (Array.BinarySearch<int>(p_intPlugins, i) >= 0)
					continue;
				Installers.PluginManager.SetPluginOrderIndex(lstPlugins[i], intLoadOrder++);
			}
		}

		/// <summary>
		/// Moves the specified plugins to the given position in the load order.
		/// </summary>
		/// <remarks>
		/// Note that the order of the given list of plugins is not maintained. They are re-ordered
		/// to be in the same order as they are in the before-operation load order. This, I think,
		/// is somewhat counter-intuitive and may change, though likely not so as to not break
		/// backwards compatibility.
		/// </remarks>
		/// <param name="p_intPlugins">The list of plugins to move to the given position in the
		/// load order. Each entry in this array contains the current index of a plugin.</param>
		/// <param name="p_intPosition">The position in the load order to which to move the specified
		/// plugins.</param>
		public void SetLoadOrder(int[] p_intPlugins, int p_intPosition)
		{
			DoSetLoadOrder(p_intPlugins, p_intPosition);
		}

		/// <summary>
		/// Orders the plugins such that the specified plugins are in the specified
		/// order.
		/// </summary>
		/// <remarks>
		/// The given plugins may not end up consecutively ordered.
		/// </remarks>
		/// <param name="p_strRelativelyOrderedPlugins">The plugins to order relative to one another.</param>
		public void SetRelativeLoadOrder(string[] p_strRelativelyOrderedPlugins)
		{
			if (p_strRelativelyOrderedPlugins.Length == 0)
				return;
			List<string> lstRelativelyOrderedPlugins = new List<string>();
			foreach (string strPlugin in p_strRelativelyOrderedPlugins)
				lstRelativelyOrderedPlugins.Add(GameMode.GetModFormatAdjustedPath(Mod.Format, strPlugin, false));

			Plugin plgCurrent = null;
			Int32 intInitialIndex = 0;
			while (((plgCurrent = Installers.PluginManager.GetRegisteredPlugin(lstRelativelyOrderedPlugins[intInitialIndex])) == null) && (intInitialIndex < lstRelativelyOrderedPlugins.Count))
				intInitialIndex++;
			if (plgCurrent == null)
				return;
			for (Int32 i = intInitialIndex + 1; i < lstRelativelyOrderedPlugins.Count; i++)
			{
				Plugin plgNext = Installers.PluginManager.GetRegisteredPlugin(lstRelativelyOrderedPlugins[i]);
				if (plgNext == null)
					continue;
				Int32 intNextPosition = Installers.PluginManager.GetPluginOrderIndex(plgNext);
				//we have to set this value every time, instead of caching the value (by
				// declaring Int32 intCurrentPosition outside of the for loop) because
				// calling Installers.PluginManager.SetPluginOrderIndex() does not guarantee
				// that the load order will change. for example trying to order an ESM
				// after an ESP file will result in no change, and will mean the intCurrentPosition
				// we are dead reckoning will be wrong
				Int32 intCurrentPosition = Installers.PluginManager.GetPluginOrderIndex(plgCurrent);
				if (intNextPosition > intCurrentPosition)
				{
					plgCurrent = plgNext;
					continue;
				}
				Installers.PluginManager.SetPluginOrderIndex(plgNext, intCurrentPosition + 1);
				//if the reorder worked, we have a new current, otherwise the old one is still the
				// correct current.
				if (intNextPosition != Installers.PluginManager.GetPluginOrderIndex(plgNext))
					plgCurrent = plgNext;
			}
		}

		#endregion

		#endregion

		#region Ini File Value Management

		#region Ini File Value Retrieval

		/// <summary>
		/// Retrieves the specified settings value as a string.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the settings file from which to retrieve the value.</param>
		/// <param name="p_strSection">The section containing the value to retrieve.</param>
		/// <param name="p_strKey">The key of the value to retrieve.</param>
		/// <returns>The specified value as a string.</returns>
		public string GetIniString(string p_strSettingsFileName, string p_strSection, string p_strKey)
		{
			return Installers.IniEditor.GetIniString(p_strSettingsFileName, p_strSection, p_strKey);
		}

		/// <summary>
		/// Retrieves the specified settings value as an integer.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the settings file from which to retrieve the value.</param>
		/// <param name="p_strSection">The section containing the value to retrieve.</param>
		/// <param name="p_strKey">The key of the value to retrieve.</param>
		/// <returns>The specified value as an integer.</returns>
		public Int32 GetIniInt(string p_strSettingsFileName, string p_strSection, string p_strKey)
		{
			return Installers.IniEditor.GetIniInt(p_strSettingsFileName, p_strSection, p_strKey);
		}

		#endregion

		#region Ini Editing

		/// <summary>
		/// Sets the specified value in the specified Ini file to the given value.
		/// </summary>
		/// <param name="p_strSettingsFileName">The name of the settings file to edit.</param>
		/// <param name="p_strSection">The section in the Ini file to edit.</param>
		/// <param name="p_strKey">The key in the Ini file to edit.</param>
		/// <param name="p_strValue">The value to which to set the key.</param>
		/// <returns><c>true</c> if the value was set; <c>false</c>
		/// if the user chose not to overwrite the existing value.</returns>
		public bool EditIni(string p_strSettingsFileName, string p_strSection, string p_strKey, string p_strValue)
		{
			return Installers.IniEditor.EditIni(p_strSettingsFileName, p_strSection, p_strKey, p_strValue);
		}

		#endregion

		#endregion

		#region Obsolete/Ignored

		/// <summary>
		/// Registers a warning to be displayed when the user deactivates the specified plugin in the mod manager.
		/// </summary>
		/// <remarks>
		/// This method is ignored. Registering warnings is not supported by the currect implementation of the mod
		/// manager.
		/// </remarks>
		/// <param name="p_strPlugin">The plugin for which to register a warning.</param>
		/// <param name="p_strWarningType">The type of warning to register.</param>
		public void SetDeactivationWarning(string p_strPlugin, string p_strWarningType)
		{
			DeactivationWarningType dwtWarningType = (DeactivationWarningType)Enum.Parse(typeof(DeactivationWarningType), p_strWarningType);
			SetDeactivationWarning(p_strPlugin, dwtWarningType);
		}

		/// <summary>
		/// Registers a warning to be displayed when the user deactivates the specified plugin in the mod manager.
		/// </summary>
		/// <remarks>
		/// This method is ignored. Registering warnings is not supported by the currect implementation of the mod
		/// manager.
		/// </remarks>
		/// <param name="p_strPlugin">The plugin for which to register a warning.</param>
		/// <param name="p_dwtWarningType">The type of warning to register.</param>
		private void SetDeactivationWarning(string p_strPlugin, DeactivationWarningType p_dwtWarningType)
		{
			//TODO implement registering plugin deactivation warnings
			// in addition to generic warning types, we should allow custom messages
		}

		#endregion
	}

	/// <summary>
	/// List to possible warning types when registering a warning for a plugin deactivation.
	/// </summary>
	public enum DeactivationWarningType
	{
		/// <summary>
		/// Allow the deactivation.
		/// </summary>
		Allow,

		/// <summary>
		/// Warn that the deactivation may cause problems.
		/// </summary>
		WarnAgainst,

		/// <summary>
		/// Prevent the mod from being deactivated.
		/// </summary>
		Disallow
	}
}
