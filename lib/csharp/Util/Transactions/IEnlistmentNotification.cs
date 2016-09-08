namespace Util.Transactions
{
	/// <summary>
	/// An interface used by resource managers that want to participate in a transaction.
	/// </summary>
	public interface IEnlistmentNotification
	{
		/// <summary>
		/// Used to notify an enlisted resource manager that the transaction is being committed.
		/// </summary>
		/// <param name="p_eltEnlistment">The enlistment class used to communicate with the resource manager.</param>
		void Commit(Enlistment p_eltEnlistment);

		/// <summary>
		/// Used to notify an enlisted resource manager that the transaction is in doubt.
		/// </summary>
		/// <remarks>
		/// A transaction is in doubt if it has not received votes from all enlisted resource managers
		/// as to the state of the transaciton.
		/// </remarks>
		/// <param name="p_eltEnlistment">The enlistment class used to communicate with the resource manager.</param>
		void InDoubt(Enlistment p_eltEnlistment);

		/// <summary>
		/// Used to notify an enlisted resource manager that the transaction is being prepared for commitment.
		/// </summary>
		/// <param name="p_entPreparingEnlistment">The enlistment class used to communicate with the resource manager.</param>
		void Prepare(PreparingEnlistment p_entPreparingEnlistment);

		/// <summary>
		/// Used to notify an enlisted resource manager that the transaction is being rolled back.
		/// </summary>
		/// <param name="p_eltEnlistment">The enlistment class used to communicate with the resource manager.</param>
		void Rollback(Enlistment p_eltEnlistment);
	}
}
