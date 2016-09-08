using System;

namespace Util.BackgroundTasks
{
	/// <summary>
	/// An event arguments class that indicates that a task set has completed.
	/// </summary>
	public class TaskSetCompletedEventArgs : EventArgs
	{
		#region Properties

		/// <summary>
		/// Gets whether or not the task set completed successfully.
		/// </summary>
		/// <value>Whether or not the task set completed successfully.</value>
		public bool Success { get; private set; }

		/// <summary>
		/// Gets the message of the completed task set.
		/// </summary>
		/// <value>The message of the completed task set.</value>
		public string Message { get; private set; }

		/// <summary>
		/// Gets the return value of the completed task set.
		/// </summary>
		/// <value>The return value of the completed task set.</value>
		public object ReturnValue { get; private set; }

		#endregion

		#region Construtors

		/// <summary>
		/// A simple constructor that initialized the obejct with the given values.
		/// </summary>
		/// <param name="p_booSuccess">Whether or not the task set completed successfully.</param>
		/// <param name="p_strMessage">The message of the completed task set.</param>
		/// <param name="p_objReturnValue">The return value of the completed task set.</param>
		public TaskSetCompletedEventArgs(bool p_booSuccess, string p_strMessage, object p_objReturnValue)
		{
			Success = p_booSuccess;
			Message = p_strMessage;
			ReturnValue = p_objReturnValue;
		}

		/// <summary>
		/// A simple constructor that initialized the obejct with the given values.
		/// </summary>
		/// <param name="p_booSuccess">Whether or not the task set completed successfully.</param>
		public TaskSetCompletedEventArgs(bool p_booSuccess)
			: this(p_booSuccess, null, null)
		{
		}

		#endregion
	}
}
