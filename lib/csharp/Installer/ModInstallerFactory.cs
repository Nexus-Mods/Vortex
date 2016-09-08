using Util;
using Util.Collections;
using Mods;
using GameMode;
using UI;
using Installer.Logging;
using Scripting;
using IniEditing;
using ChinhDo.Transactions.FileManager;

namespace Installer
{
	/// <summary>
	/// The class that creates <see cref="ModInstaller"/>s.
	/// </summary>
	public class ModInstallerFactory
	{
		private IGameMode m_gmdGameMode = null;
		private IInstallLog m_ilgInstallLog = null;
		private IScriptExecutorFactory m_sefExecutorFactory = null;
		private IIniMethods m_imIni;
		private IFileSystem m_fsFileUtil;
		private IFileManager m_fmFileManager;

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the factory with the required dependencies.
		/// </summary>
		/// <param name="p_gmdGameMode">The game mode for which the created installer will be installing mods.</param>
		/// <param name="p_sefExecutorFactory">Factory for script executors</param>
		/// <param name="p_fsFileUtil">proxy for file operations</param>
		/// <param name="p_fmFileManager">interface for (transacted) file operations</param>
		/// <param name="p_ilgInstallLog">The install log that tracks mod install info
		/// <param name="p_imIni">interface for ini operations</param>
		/// for the current game mode.</param>
		/// <param name="p_pmgPluginManager">The plugin manager to use to work with plugins.</param>
		public ModInstallerFactory(IGameMode p_gmdGameMode, IScriptExecutorFactory p_sefExecutorFactory,
									IFileSystem p_fsFileUtil, IFileManager p_fmFileManager,
									IInstallLog p_ilgInstallLog, IIniMethods p_imIni)
		{
			m_gmdGameMode = p_gmdGameMode;
			m_ilgInstallLog = p_ilgInstallLog;
			m_sefExecutorFactory = p_sefExecutorFactory;
			m_imIni = p_imIni;
			m_fsFileUtil = p_fsFileUtil;
			m_fmFileManager = p_fmFileManager;
		}

		#endregion

		/// <summary>
		/// Creates a mod installer for the given mod.
		/// </summary>
		/// <param name="p_modMod">The mod for which to create the installer.</param>
		/// <param name="p_strDestination">The destination folder to install into</param>
		/// <param name="p_dlgOverwriteConfirmationDelegate">The method to call in order to confirm an overwrite.</param>
		/// <param name="p_rolActiveMods">The list of active mods.</param>
		/// <returns>A mod installer for the given mod.</returns>
		public ModInstaller CreateInstaller(IMod p_modMod, string p_strDestination, ConfirmItemOverwriteDelegate p_dlgOverwriteConfirmationDelegate, ReadOnlyObservableList<IMod> p_rolActiveMods)
		{
			return new ModInstaller(p_modMod, m_gmdGameMode, m_sefExecutorFactory, m_imIni, m_fsFileUtil, m_ilgInstallLog,
				m_fmFileManager, p_strDestination, null, p_dlgOverwriteConfirmationDelegate, p_rolActiveMods);
		}
		/*
		/// <summary>
		/// Creates a mod uninstaller for the given mod.
		/// </summary>
		/// <param name="p_modMod">The mod for which to create the uninstaller.</param>
		/// <param name="p_rolActiveMods">The list of active mods.</param>
		/// <returns>A mod uninstaller for the given mod.</returns>
		public ModUninstaller CreateUninstaller(IMod p_modMod, ReadOnlyObservableList<IMod> p_rolActiveMods)
		{
			return new ModUninstaller(p_modMod, m_gmdGameMode, m_eifEnvironmentInfo, m_ivaVirtualModActivator, m_ilgInstallLog, m_pmgPluginManager, p_rolActiveMods);
		}

		/// <summary>
		/// Creates a mod deleter for the given mod.
		/// </summary>
		/// <param name="p_modMod">The mod for which to create the deleter.</param>
		/// <param name="p_rolActiveMods">The list of active mods.</param>
		/// <returns>A mod deleter for the given mod.</returns>
		public ModDeleter CreateDelete(IMod p_modMod, ReadOnlyObservableList<IMod> p_rolActiveMods)
		{
			return new ModDeleter(p_modMod, m_gmdGameMode, m_eifEnvironmentInfo, m_ivaVirtualModActivator, m_ilgInstallLog, m_pmgPluginManager, p_rolActiveMods);
		}
		*/
	}
}
