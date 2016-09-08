namespace Util.Transactions
{
	/// <summary>
	/// Describes the enlistment of a resource manager in a transaction.
	/// </summary>
	public class Enlistment
	{
		/// <summary>
		/// Gets or sets whether the enlisted resource manager has finished its processing.
		/// </summary>
		/// <value>Whether the enlisted resource manager has finished its processing.</value>
		internal bool DoneProcessing { get; set; }

		/// <summary>
		/// Marks the enlistmant as having finished.
		/// </summary>
		public virtual void Done()
		{
			DoneProcessing = true;
		}

		/// <summary>
		/// The default constructor.
		/// </summary>
		public Enlistment()
		{
			DoneProcessing = false;
		}
	}
}
