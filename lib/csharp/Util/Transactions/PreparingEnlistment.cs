namespace Util.Transactions
{
	/// <summary>
	/// This class is used to communicate with enlistments.
	/// </summary>
	public class PreparingEnlistment : Enlistment
	{
		/// <summary>
		/// Gets or sets whether the enlistmant is voting to commit, rollback, or abstains.
		/// </summary>
		/// <value>Whether the enlistmant is voting to commit, rollback, or abstains.</value>
		internal bool? VoteToCommit { get; set; }

		/// <summary>
		/// Marks the enlistmant as having finished.
		/// </summary>
		public override void Done()
		{
			base.Done();
			if (!VoteToCommit.HasValue)
				VoteToCommit = true;
		}

		/// <summary>
		/// Causes the enlistment to vote to commit.
		/// </summary>
		public void Prepared()
		{
			VoteToCommit = true;
		}

		/// <summary>
		/// Causes the enlistment to vote to rollback.
		/// </summary>
		public void ForceRollback()
		{
			VoteToCommit = false;
		}

		/// <summary>
		/// The default constructor.
		/// </summary>
		public PreparingEnlistment()
		{
			VoteToCommit = null;
		}
	}
}
