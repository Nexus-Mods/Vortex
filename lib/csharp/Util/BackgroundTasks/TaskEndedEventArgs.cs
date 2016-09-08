using System;

namespace Util.BackgroundTasks
{
	/// <summary>
	/// An event arguments class that indicates that a task has ended.
	/// </summary>
	public class TaskEndedEventArgs : EventArgs
	{
		#region Properties

		/// <summary>
		/// Gets the status of the ended task.
		/// </summary>
		/// <value>The status of the ended task.</value>
		public TaskStatus Status { get; private set; }

		/// <summary>
		/// Gets the return value of the ended task.
		/// </summary>
		/// <value>The return value of the ended task.</value>
		public object ReturnValue { get; private set; }

		/// <summary>
		/// Gets the task completion message.
		/// </summary>
		/// <remarks>
		/// This can be used to convey error information to the user.
		/// </remarks>
		/// <value>The task completion message.</value>
		public string Message { get; private set; }

		#endregion

		#region Construtors

		/// <summary>
		/// A simple constructor that initialized the obejct with the given values.
		/// </summary>
		/// <param name="p_tstStatus">The status of the ended task.</param>
		/// <param name="p_strMessage">The task completion message.</param>
		/// <param name="p_objReturnValue">The return value of the completed task.</param>
		public TaskEndedEventArgs(TaskStatus p_tstStatus, string p_strMessage, object p_objReturnValue)
		{
			Status = p_tstStatus;
			Message = p_strMessage;
			ReturnValue = p_objReturnValue;
		}

		#endregion
	}
}
