using System;
using System.Runtime.Remoting.Messaging;
using System.Threading;
using Util;
using Util.BackgroundTasks;

namespace Installer
{
	/// <summary>
	/// The base class for all mod installers.
	/// </summary>
	public abstract class ModInstallerBase : IBackgroundTaskSet, IDisposable
	{
		/// <summary>
		/// We only want on installer running at a time, so as not to mess up
		/// the file system, of settings files. As such, all installers lock
		/// on this lock object.
		/// </summary>
		/// 
		protected static readonly object objInstallLock = new object();

		/// <summary>
		/// We only want on uninstaller running at a time, so as not to mess up
		/// the file system, of settings files. As such, all uninstaller lock
		/// on this lock object.
		/// </summary>
		/// 
		protected static readonly object objUninstallLock = new object();

		#region Events

		/// <summary>
		/// Raised when a task in the set has started.
		/// </summary>
		/// <remarks>
		/// The argument passed with the event args is the task that
		/// has been started.
		/// </remarks>
		public event EventHandler<EventArgs<IBackgroundTask>> TaskStarted = delegate { };

		/// <summary>
		/// Raised when a task set has completed.
		/// </summary>
		public event EventHandler<TaskSetCompletedEventArgs> TaskSetCompleted = delegate { };

		#endregion

		private EventWaitHandle m_ewhSetCompleted = new EventWaitHandle(false, EventResetMode.ManualReset);

		#region Properties

		/// <summary>
		/// Gets the current error message.
		/// </summary>
		/// <value>The current error message.</value>
		public string PopupErrorMessage { get; protected set; }

		/// <summary>
		/// Gets the current error message type.
		/// </summary>
		/// <value>The current error message type.</value>
		public string PopupErrorMessageType { get; protected set; }

		/// <summary>
		/// Gets the current error message details.
		/// </summary>
		/// <value>The current error message details.</value>
		public string DetailsErrorMessage { get; protected set; }

		/// <summary>
		/// Gets whether the task set has completed.
		/// </summary>
		/// <value>Whether the task set has completed.</value>
		public bool IsCompleted { get; private set; }

		/// <summary>
		/// Gets whether the task set is queued.
		/// </summary>
		/// <value>Whether the task set is queued.</value>
		public bool IsQueued { get;  set; }

		#endregion

		#region Constructors

		/// <summary>
		/// The default constructor.
		/// </summary>
		public ModInstallerBase()
		{
		}

		#endregion

		#region Event Raising

		#region Task Started

		/// <summary>
		/// Raises the <see cref="TaskStarted"/> event.
		/// </summary>
		/// <param name="e">An <see cref="EventArgs{IBackgroundTask}"/> describing the task that was started.</param>
		private void RaiseTaskStarted(EventArgs<IBackgroundTask> e)
		{
			TaskStarted(this, e);
		}

		/// <summary>
		/// The callback called by the begin invoke method used to call the event asynchronously upon completion
		/// of the event.
		/// </summary>
		/// <param name="p_asrResult">The asynchronous result for the call.</param>
		private void EndTaskStartedCallback(IAsyncResult p_asrResult)
		{
			Action<EventArgs<IBackgroundTask>> dlcEvent = (Action<EventArgs<IBackgroundTask>>)((AsyncResult)p_asrResult).AsyncDelegate;
			dlcEvent.EndInvoke(p_asrResult);
			p_asrResult.AsyncWaitHandle.Close();
		}

		/// <summary>
		/// Raises the <see cref="TaskStarted"/> event.
		/// </summary>
		/// <remarks>
		/// The event is raised asynchronously, so the installer can continue its work uninterrupted.
		/// This is to prevent deadlocks, primarily on the UI thread.
		/// </remarks>
		/// <param name="e">An <see cref="EventArgs{IBackgroundTask}"/> describing the task that was started.</param>
		protected virtual void OnTaskStarted(EventArgs<IBackgroundTask> e)
		{
			((Action<EventArgs<IBackgroundTask>>)RaiseTaskStarted).BeginInvoke(e, EndTaskStartedCallback, null);
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

		#region Task Set Completed

		/// <summary>
		/// Raises the <see cref="TaskSetCompleted"/> event.
		/// </summary>
		/// <param name="e">A <see cref="TaskSetCompletedEventArgs"/> describing the task that was started.</param>
		private void RaiseTaskSetCompleted(TaskSetCompletedEventArgs e)
		{
			TaskSetCompleted(this, e);
		}

		/// <summary>
		/// The callback called by the begin invoke method used to call the event asynchronously upon completion
		/// of the event.
		/// </summary>
		/// <param name="p_asrResult">The asynchronous result for the call.</param>
		private void EndTaskSetCompletedCallback(IAsyncResult p_asrResult)
		{
			Action<TaskSetCompletedEventArgs> dlcEvent = (Action<TaskSetCompletedEventArgs>)((AsyncResult)p_asrResult).AsyncDelegate;
			dlcEvent.EndInvoke(p_asrResult);
			p_asrResult.AsyncWaitHandle.Close();
		}

		/// <summary>
		/// Raises the <see cref="TaskSetCompleted"/> event.
		/// </summary>
		/// <remarks>
		/// The event is raised asynchronously, so the installer can continue its work uninterrupted.
		/// This is to prevent deadlocks, primarily on the UI thread.
		/// </remarks>
		/// <param name="e">A <see cref="TaskSetCompletedEventArgs"/> describing the task that was started.</param>
		protected virtual void OnTaskSetCompleted(TaskSetCompletedEventArgs e)
		{
			IsCompleted = true;
			m_ewhSetCompleted.Set();
			((Action<TaskSetCompletedEventArgs>)RaiseTaskSetCompleted).BeginInvoke(e, EndTaskSetCompletedCallback, null);
		}

		/// <summary>
		/// Raises the <see cref="TaskSetCompleted"/> event.
		/// </summary>
		/// <param name="p_booSuccess">Whether or not the task set completed successfully.</param>
		/// <param name="p_strMessage">The message of the completed task set.</param>
		/// <param name="p_modMod">The mod the installer acted upon.</param>
		protected void OnTaskSetCompleted(bool p_booSuccess, string p_strMessage, object p_modMod)
		{
			OnTaskSetCompleted(new TaskSetCompletedEventArgs(p_booSuccess, p_strMessage, p_modMod));
		}

		#endregion

		#endregion

		/// <summary>
		/// Blocks until the task set is completed.
		/// </summary>
		public void Wait()
		{
			m_ewhSetCompleted.WaitOne();
		}

		#region IDisposable Support
		private bool m_booDisposedValue = false;

		protected virtual void Dispose(bool disposing)
		{
			if (!m_booDisposedValue)
			{
				if (disposing)
				{
					m_ewhSetCompleted.Dispose();
				}

				m_booDisposedValue = true;
			}
		}

		public void Dispose()
		{
			Dispose(true);
		}
		#endregion
	}
}
