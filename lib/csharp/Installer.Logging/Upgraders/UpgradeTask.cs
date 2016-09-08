using ChinhDo.Transactions;
using Mods;
using System.Diagnostics;
using System.IO;
using Util.BackgroundTasks;
using Util.Transactions;

namespace Installer.Logging.Upgraders
{
	/// <summary>
	/// Upgrades the Install Log from a specific version to the latest version.
	/// </summary>
	/// <remarks>
	/// This base class handles setting up the common resources and transaction required for all
	/// log upgrades.
	/// </remarks>
	public abstract class UpgradeTask : ThreadedBackgroundTask
	{
		private TxFileManager m_tfmFileManager = null;

		#region Properties

		/// <summary>
		/// Gets the transactional file manager to be used in the upgrade.
		/// </summary>
		protected TxFileManager FileManager
		{
			get
			{
				return m_tfmFileManager;
			}
		}

		#endregion

		/// <summary>
		/// Called to perform the upgrade.
		/// </summary>
		/// <remarks>
		/// Sets up the resources required to upgrade the install log.
		/// </remarks>
		/// <param name="p_mdrManagedModRegistry">The <see cref="ModRegistry"/> that contains the list
		/// of managed mods.</param>
		/// <param name="p_strModInstallDirectory">The path of the directory where all of the mods are installed.</param>
		/// <param name="p_strLogStream">The stream from which to load the install log information.</param>
		public void Upgrade(Stream p_strLogStream, string p_strModInstallDirectory, IModRegistry p_mdrManagedModRegistry)
		{
			Trace.WriteLine("Beginning Install Log Upgrade.");

			using (TransactionScope tsTransaction = new TransactionScope())
			{
				Start(p_strLogStream, p_strModInstallDirectory, p_mdrManagedModRegistry);
				tsTransaction.Complete();
				m_tfmFileManager = null;
			}
		}

		/// <summary>
		/// Performs the actual upgrade.
		/// </summary>
		/// <param name="p_objArgs">The task arguments.</param>
		/// <returns>A status message.</returns>
		protected override object DoWork(object[] p_objArgs)
		{
			try
			{
				UpgradeInstallLog((Stream)p_objArgs[0], (string)p_objArgs[1], (IModRegistry)p_objArgs[2]);
				return null;
			}
			catch (UpgradeException e)
			{
				Status = TaskStatus.Error;
				return e.Message;
			}
		}

		/// <summary>
		/// Upgrades the install log.
		/// </summary>
		/// <param name="p_mrgModRegistry">The <see cref="ModRegistry"/> that contains the list
		/// of managed mods.</param>
		/// <param name="p_strModInstallDirectory">The path of the directory where all of the mods are installed.</param>
		/// <param name="p_strLogStream">The stream from which to load the install log information.</param>
		protected abstract void UpgradeInstallLog(Stream p_strLogStream, string p_strModInstallDirectory, IModRegistry p_mrgModRegistry);
	}
}
