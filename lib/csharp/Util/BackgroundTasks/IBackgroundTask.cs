using System;
using System.ComponentModel;

namespace Util.BackgroundTasks
{
	/// <summary>
	/// The contract for tasks that run in a background thread.
	/// </summary>
	/// <remarks>
	/// This contract provides properties that allow the tracking of the progress
	/// of a background task from another thread.
	/// </remarks>
	public interface IBackgroundTask : INotifyPropertyChanged
	{
		#region Events

		/// <summary>
		/// Raised when the task has ended.
		/// </summary>
		event EventHandler<TaskEndedEventArgs> TaskEnded;

		#endregion

		#region Properties

		Int32 TaskSpeed { get; set; }

		Int32 ActiveThreads { get; set; }

		#region Overall Progress

		/// <summary>
		/// Gets the message shown above the total progress bar.
		/// </summary>
		/// <value>The message shown above the total progress bar.</value>
		string OverallMessage { get; }

		/// <summary>
		/// Gets whether to display the overall progress bar as a marquee.
		/// </summary>
		/// <value>Whether to display the overall progress bar as a marquee.</value>
		bool ShowOverallProgressAsMarquee { get; }

		/// <summary>
		/// Gets the progress on the overall work.
		/// </summary>
		/// <value>The progress on the overall work.</value>
		Int64 OverallProgress { get; }

		/// <summary>
		/// Gets the minimum value on the overall progress bar.
		/// </summary>
		/// <value>The minimum value on the overall progress bar.</value>
		Int64 OverallProgressMinimum { get; }

		/// <summary>
		/// Gets the maximum value on the overall progress bar.
		/// </summary>
		/// <value>The maximum value on the overall progress bar.</value>
		Int64 OverallProgressMaximum { get; }

		/// <summary>
		/// Gets the step size of the overall progress bar.
		/// </summary>
		/// <value>The step size of the overall progress bar.</value>
		Int32 OverallProgressStepSize { get; }

		#endregion

		#region Item Progress

		/// <summary>
		/// Gets whether the item progress is visible.
		/// </summary>
		/// <value>Whether the item progress is visible.</value>
		bool ShowItemProgress { get; }

		/// <summary>
		/// Gets whether to display the item progress bar as a marquee.
		/// </summary>
		/// <value>Whether to display the item progress bar as a marquee.</value>
		bool ShowItemProgressAsMarquee { get; }

		/// <summary>
		/// Gets the message shown above the item progress bar.
		/// </summary>
		/// <value>The message shown above the item progress bar.</value>
		string ItemMessage { get; }

		/// <summary>
		/// Gets the progress on current item of work.
		/// </summary>
		/// <value>The progress on current item of work.</value>
		Int64 ItemProgress { get; }

		/// <summary>
		/// Gets the minimum value on the item progress bar.
		/// </summary>
		/// <value>The minimum value on the item progress bar.</value>
		Int64 ItemProgressMinimum { get; }

		/// <summary>
		/// Gets the maximum value on the item progress bar.
		/// </summary>
		/// <value>The maximum value on the item progress bar.</value>
		Int64 ItemProgressMaximum { get; }

		/// <summary>
		/// Gets the step size of the item progress bar.
		/// </summary>
		/// <value>The step size of the item progress bar.</value>
		Int32 ItemProgressStepSize { get; }

		#endregion

		/// <summary>
		/// Gets the status of the task.
		/// </summary>
		/// <value>The status of the task.</value>
		TaskStatus Status { get; }

 		/// <summary>
		/// Gets the status of the eventual nested task.
		/// </summary>
		/// <value>The status of the eventual nested task.</value>
		TaskStatus InnerTaskStatus { get; }

		/// <summary>
		/// Gets the return value of the task.
		/// </summary>
		/// <remarks>
		/// This value should be used in conjunction with <see cref="Status"/>.
		/// </remarks>
		/// <value>The return value of the task.</value>
		object ReturnValue { get; }

		/// <summary>
		/// Gets whether or not the task is actively working.
		/// </summary>
		/// <remarks>
		/// This is shorthand for checking if the <see cref="Status"/>
		/// is either <see cref="TaskStatus.Running"/> or <see cref="TaskStatus.Cancelling"/>.
		/// </remarks>
		/// <value>Whether or not the task is actively working.</value>
		bool IsActive { get; }

		/// <summary>
		/// Gets whether or not the task is remote.
		/// </summary>
		/// <remarks>
		/// This is shorthand for checking if the task
		/// is either remote or local.
		/// </remarks>
		/// <value>Whether or not the task is remote.</value>
		bool IsRemote{ get; }

		/// <summary>
		/// Gets whether the task supports pausing.
		/// </summary>
		/// <value>Thether the task supports pausing.</value>
		bool SupportsPause { get; }

		/// <summary>
		/// Gets whether the task supports queuing.
		/// </summary>
		/// <value>Thether the task supports queuing.</value>
		bool SupportsQueue { get; }

		#endregion

		#region Task Control

		/// <summary>
		/// Cancels the background task.
		/// </summary>
		void Cancel();

		/// <summary>
		/// Pauses the task.
		/// </summary>
		/// <exception cref="InvalidOperationException">Thrown if the task does not support pausing.</exception>
		void Pause();

		/// <summary>
		/// Queues the task.
		/// </summary>
		/// <exception cref="InvalidOperationException">Thrown if the task does not support queuing.</exception>
		void Queue();

		/// <summary>
		/// Resumes the task.
		/// </summary>
		/// <exception cref="InvalidOperationException">Thrown if the task is not paused.</exception>
		void Resume();

		#endregion
	}
}
