using System;

namespace Util.BackgroundTasks
{
	/// <summary>
	/// The contract for a set of tasks that run in a background thread.
	/// </summary>
	/// <remarks>
	/// This contract provides properties that allow observers to be notified
	/// task that are starting in a set. A set is a grouping of related tasks.
	/// </remarks>
	public interface IBackgroundTaskSet
	{
		#region Events

		/// <summary>
		/// Raised when a task in the set has started.
		/// </summary>
		/// <remarks>
		/// The argument passed with the event args is the task that
		/// has been started.
		/// </remarks>
		event EventHandler<EventArgs<IBackgroundTask>> TaskStarted;

		/// <summary>
		/// Raised when a task set has completed.
		/// </summary>
		event EventHandler<TaskSetCompletedEventArgs> TaskSetCompleted;

		#endregion

		#region Properties

		/// <summary>
		/// Gets whether the task set has completed.
		/// </summary>
		/// <value>Whether the task set has completed.</value>
		bool IsCompleted { get; }

		/// <summary>
		/// Gets whether the task set is queued.
		/// </summary>
		/// <value>Whether the task set is queued.</value>
		bool IsQueued { get; set; }

		#endregion

		/// <summary>
		/// Blocks until the task set is completed.
		/// </summary>
		void Wait();
	}
}
