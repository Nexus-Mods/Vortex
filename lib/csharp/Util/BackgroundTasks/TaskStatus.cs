
namespace Util.BackgroundTasks
{
	/// <summary>
	/// The task statuses.
	/// </summary>
	public enum TaskStatus
	{
		/// <summary>
		/// Indicates the task is finished, but incomplete.
		/// </summary>
		Incomplete,
		
		/// <summary>
		/// Indicates the task is finished, and complete.
		/// </summary>
		Complete,

		/// <summary>
		/// Indicates the task has been cancelled.
		/// </summary>
		Cancelled,

		/// <summary>
		/// Indicates the task is being cancelled.
		/// </summary>
		Cancelling,

		/// <summary>
		/// Indicates the task is paused.
		/// </summary>
		Paused,

		/// <summary>
		/// Indicates the task is running, or has yet to start.
		/// </summary>
		Running,

		/// <summary>
		/// Indicates the task is finished, but in an error state.
		/// </summary>
		Error,

		/// <summary>
		/// Indicates the task is retrying.
		/// </summary>
		Retrying,

		/// <summary>
		/// Indicates the task has been queued.
		/// </summary>
		Queued
	}
}
