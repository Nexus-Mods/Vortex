using System.ComponentModel;

namespace Util
{
	/// <summary>
	/// Describes the arguments passed to a cancelable progress update event.
	/// </summary>
	public class CancelProgressEventArgs : CancelEventArgs
	{
		/// <summary>
		/// Gets the completion percentage being reported.
		/// </summary>
		/// <value>The completion percentage being reported.</value>
		public float PercentComplete { get; protected set; }

		/// <summary>
		/// A simple contructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_fltPercentComplete">he completion percentage being reported.</param>
		public CancelProgressEventArgs(float p_fltPercentComplete)
		{
			PercentComplete = p_fltPercentComplete;
		}
	}

	/// <summary>
	/// The handler for cancellable progress update events.
	/// </summary>
	/// <param name="sender">The object that raised the event.</param>
	/// <param name="e">A <see cref="CancelProgressEventArgs"/> describing the event arguments.</param>
	public delegate void CancelProgressEventHandler(object sender, CancelProgressEventArgs e);
}
