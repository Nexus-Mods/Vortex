using GameMode;
using Mods;
using PluginManagement;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Util.BackgroundTasks;
using Util.Collections;

namespace Scripting
{
	/// <summary>
	/// Performs a standard mod installation.
	/// </summary>
	/// <remarks>
	/// A basic install installs all of the files in the mod to the installation directory,
	/// and activates all plugin files.
	/// </remarks>
	public class BasicInstallTask : ThreadedBackgroundTask
	{
		private Func<string, bool> m_fncInstallFilter;

		#region Properties

		/// <summary>
		/// Gets or sets the mod being installed.
		/// </summary>
		/// <value>The mod being installed.</value>
		protected IMod Mod { get; set; }

		/// <summary>
		/// Gets the current game mode.
		/// </summary>
		/// <value>The the current game mode.</value>
		protected IGameMode GameMode { get; private set; }

		/// <summary>
		/// Gets or sets the installer to use to install files.
		/// </summary>
		/// <value>The installer to use to install files.</value>
		protected IModFileInstaller FileInstaller { get; set; }

		/// <summary>
		/// the path to install to
		/// </summary>
		protected string DestinationPath { get; set; }

		/// <summary>
		/// Gets the list of currently active mods.
		/// </summary>
		/// <value>The list of currently active mods.</value>
		protected ReadOnlyObservableList<IMod> ActiveMods { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_modMod">The mod being installed.</param>
		/// <param name="p_gmdGameMode">The the current game mode.</param>
		/// <param name="p_mfiFileInstaller">The file installer to use.</param>
		/// <param name="p_pmgPluginManager">The plugin manager.</param>
		/// <param name="p_rolActiveMods">The list of active mods.</param>
		/// <param name="p_lstInstallFiles">The list of specific files to install, if null the mod will be installed as usual.</param>
		public BasicInstallTask(IMod p_modMod, IGameMode p_gmdGameMode, IModFileInstaller p_mfiFileInstaller,
								string p_strDestinationPath,
								ReadOnlyObservableList<IMod> p_rolActiveMods, Func<string, bool> p_fncInstallFilter)
		{
			Mod = p_modMod;
			GameMode = p_gmdGameMode;
			FileInstaller = p_mfiFileInstaller;
			DestinationPath = p_strDestinationPath;
			ActiveMods = p_rolActiveMods;
			m_fncInstallFilter = p_fncInstallFilter;
		}

		#endregion

		/// <summary>
		/// Runs the basic install task.
		/// </summary>
		/// <returns><c>true</c> if the installation succeed;
		/// <c>false</c> otherwise.</returns>
		public bool Execute()
		{
			OverallMessage = "Installing Mod...";
			ShowItemProgress = false;
			OverallProgressStepSize = 1;
			return (bool)StartWait();
		}

		/// <summary>
		/// The method that is called to start the backgound task.
		/// </summary>
		/// <remarks>
		/// This method installs all of the files in the <see cref="IMod"/> being installed.
		/// </remarks>
		/// <param name="p_objArgs">Arguments to for the task execution.</param>
		/// <returns>A return value.</returns>
		protected override object DoWork(object[] p_objArgs)
		{
			char[] chrDirectorySeperators = new char[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar };
			IEnumerable<string> filtered = (m_fncInstallFilter == null) ? Mod.GetFileList()
																		: Mod.GetFileList().Where(x => m_fncInstallFilter(x));
			List<KeyValuePair<string, string>> lstFiles = filtered.Select(x => new KeyValuePair<string, string>(x, null)).ToList();

			OverallProgressMaximum = lstFiles.Count;

			int count = 0;

			foreach (KeyValuePair<string, string> File in lstFiles)
			{
				string strFileTo = File.Value;
				if (string.IsNullOrWhiteSpace(strFileTo))
					strFileTo = File.Key;


				if (Status == TaskStatus.Cancelling)
					return false;
				string strFixedPath = GameMode.GetModFormatAdjustedPath(Mod.Format, strFileTo, Mod, false);
				if (string.IsNullOrEmpty(strFixedPath))
					continue;

				string strModFilenamePath = Path.Combine(DestinationPath, Path.GetFileNameWithoutExtension(Mod.Filename), GameMode.GetModFormatAdjustedPath(Mod.Format, strFileTo, true));
				string strModDownloadIDPath = (string.IsNullOrWhiteSpace(Mod.DownloadId) || (Mod.DownloadId.Length <= 1) || Mod.DownloadId.Equals("-1", StringComparison.OrdinalIgnoreCase)) ? string.Empty : Path.Combine(DestinationPath, Mod.DownloadId, GameMode.GetModFormatAdjustedPath(Mod.Format, strFileTo, true));
				string strVirtualPath = strModFilenamePath;

				if (!string.IsNullOrWhiteSpace(strModDownloadIDPath))
					strVirtualPath = strModDownloadIDPath;

				string strFileType = Path.GetExtension(File.Key);
				if (!strFileType.StartsWith("."))
					strFileType = "." + strFileType;

				if (!string.IsNullOrEmpty(strFixedPath))
				{
					FileInstaller.InstallFileFromMod(File.Key, strVirtualPath);
					++count;
				}
				StepOverallProgress();
			}

			if ((lstFiles.Count > 0) && (count <= 0))
				throw new InvalidDataException(string.Format("This mod does not have the correct file structure for a {0} mod that NMM can use. It will not work with NMM.", GameMode.Name));

			return true;
		}
	}
}
