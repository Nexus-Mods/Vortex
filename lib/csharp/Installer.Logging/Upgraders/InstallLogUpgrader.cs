using Mods;
using System;
using System.Collections.Generic;
using System.IO;
using Util.BackgroundTasks;

namespace Installer.Logging.Upgraders
{
	/// <summary>
	/// Upgrades the install log.
	/// </summary>
	public class InstallLogUpgrader
	{
		private Dictionary<Version, UpgradeTask> m_dicUpgraders = null;

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public InstallLogUpgrader()
		{
			m_dicUpgraders = new Dictionary<Version, UpgradeTask>();
			m_dicUpgraders[new Version("0.2.0.0")] = new Upgrade0200Task();
			m_dicUpgraders[new Version("0.3.0.0")] = new Upgrade0300Task();
			m_dicUpgraders[new Version("0.4.0.0")] = new Upgrade0400Task();
		}

		#endregion

		/// <summary>
		/// Determines if the specified install log needs to be upgraded.
		/// </summary>
		/// <param name="p_strLogStream">The stream of an install log whose upgrade status is to be determined.</param>
		/// <returns><c>true</c> if the specified install log needs to be upgraded;
		/// <c>false</c> otherwise.</returns>
		public bool NeedsUpgrade(Stream p_strLogStream)
		{
			Version verLogVersion = InstallLog.ReadVersion(p_strLogStream);
			return verLogVersion != InstallLog.CurrentVersion;
		}

		/// <summary>
		/// Determines if the specified install log can be upgraded.
		/// </summary>
		/// <param name="p_strLogStream">The path of the install log whose upgradable status is to be determined.</param>
		/// <returns><c>true</c> if the specified install log can to be upgraded;
		/// <c>false</c> otherwise.</returns>
		public bool CanUpgrade(Stream p_strLogStream)
		{
			Version verLogVersion = InstallLog.ReadVersion(p_strLogStream);
			return m_dicUpgraders.ContainsKey(verLogVersion);
		}

		/// <summary>
		/// Upgrades the install log.
		/// </summary>
		/// <returns>The task that performs the upgrading.</returns>
		/// <param name="p_mrgModRegistry">The <see cref="ModRegistry"/> that contains the list
		/// of managed modss.</param>
		/// <param name="p_strModInstallDirectory">The path of the directory where all of the mods are installed.</param>
		/// <param name="p_strLogPath">The path from which to load the install log information.</param>
		public IBackgroundTask UpgradeInstallLog(Stream p_strLogStream, string p_strModInstallDirectory, IModRegistry p_mrgModRegistry)
		{
			Version verLogVersion = InstallLog.ReadVersion(p_strLogStream);
			if (!m_dicUpgraders.ContainsKey(verLogVersion))
				throw new UpgradeException("Unrecognized log version: " + verLogVersion.ToString());
			m_dicUpgraders[verLogVersion].Upgrade(p_strLogStream, p_strModInstallDirectory, p_mrgModRegistry);
			return m_dicUpgraders[verLogVersion];
		}
	}
}
