using System;
using System.ComponentModel;
using Mods;
using Util;
using Util.BackgroundTasks;

namespace ModManagement
{
	/// <summary>
	/// Prepares a mod for installation.
	/// </summary>
	public class PrepareModTask : BackgroundTask
	{
		#region Properties

		/// <summary>
		/// Gets or sets the file utility class.
		/// </summary>
		/// <value>The file utility class.</value>
		protected FileUtil FileUtility { get; set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_futFileUtility">The file utility class.</param>
		public PrepareModTask(FileUtil p_futFileUtility)
		{
			FileUtility = p_futFileUtility;
		}

		#endregion

		/// <summary>
		/// Prepares the given mod for installation.
		/// </summary>
		/// <remarks>
		/// This task puts the mod into read-only mode.
		/// </remarks>
		/// <returns><c>true</c> if the mod was successfully prepared;
		/// <c>false</c> otherwise.</returns>
		/// <param name="p_modMod">The mod to prepare.</param>
		public bool PrepareMod(IMod p_modMod)
		{
			OverallMessage = "Preparing Mod...";
			ShowItemProgress = false;
			OverallProgressMaximum = 100;
			OverallProgressStepSize = 1;

			try
			{
				p_modMod.ReadOnlyInitProgressUpdated += new CancelProgressEventHandler(Mod_ReadOnlyInitProgressUpdated);
				p_modMod.BeginReadOnlyTransaction(FileUtility);
			}
			catch (Exception)
			{
				Status = TaskStatus.Error;
				OnTaskEnded(false);
				throw;
			}
			finally
			{
				p_modMod.ReadOnlyInitProgressUpdated -= Mod_ReadOnlyInitProgressUpdated;
			}
			bool booSuccess = Status != TaskStatus.Cancelling;
			Status = Status == TaskStatus.Cancelling ? TaskStatus.Cancelled : TaskStatus.Complete;
			OnTaskEnded(booSuccess);
			return booSuccess;
		}

		/// <summary>
		/// Handles the <see cref="IMod.ReadOnlyInitProgressUpdated"/> event of the Mod.
		/// </summary>
		/// <remarks>
		/// This steps the progress in the progress dialog.
		/// </remarks>
		/// <param name="sender">The object that raised the event.</param>
		/// <param name="e">A <see cref="CancelEventArgs"/> describing the event arguments.</param>
		private void Mod_ReadOnlyInitProgressUpdated(object sender, CancelProgressEventArgs e)
		{
			e.Cancel = (Status == TaskStatus.Cancelling);
			OverallProgress = (Int32)(e.PercentComplete * 100);
		}
	}
}
