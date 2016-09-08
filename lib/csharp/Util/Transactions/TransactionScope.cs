using System;
using System.Transactions;

namespace Util.Transactions
{
	/// <summary>
	/// Manages the ambient transaction.
	/// </summary>
	public class TransactionScope : IDisposable
	{
		private Transaction m_trnTransaction = null;
		private bool m_booCompleted = false;
		private bool m_booOwnsTransaction = false;

		/// <summary>
		/// The default constructor.
		/// </summary>
		/// <remarks>
		/// This sets up the ambient transaction.
		/// 
		/// This class allows the sharing of a transaction across multiple threads. However, it is expected
		/// that all threads created in the scope of the TransactionScope will have finished their work
		/// before <see cref="Complete()"/> is called. If a thread does work after <see cref="Complete()"/>
		/// has been called, expecting to enroll in the same transaction, the behaviour is undefined.
		/// </remarks>
		public TransactionScope()
		{
			if (Transaction.Current == null)
			{
				Transaction.Current = new Transaction();
				m_booOwnsTransaction = true;
			}
			m_trnTransaction = Transaction.Current;
			if (m_trnTransaction.TransactionInformation.Status == TransactionStatus.Aborted)
				throw new TransactionAbortedException("Cannot create a new transaction scope with an aborted transaction.");
		}

		/// <summary>
		/// Completes the transaction.
		/// </summary>
		/// <remarks>
		/// This method gets votes from all the participants on whether or not the transaction should be committed.
		/// </remarks>
		public void Complete()
		{
			if (m_booCompleted)
				throw new TransactionException("Complete has already been called.");

			if (m_trnTransaction.TransactionInformation.Status == TransactionStatus.Aborted)
				throw new TransactionAbortedException("Cannot complete a transaction scope when transaction has already been aborted.");

			if (m_booOwnsTransaction)
			{
				bool booVotedToCommit = false;
				booVotedToCommit = m_trnTransaction.Prepare();
				if (booVotedToCommit && (m_trnTransaction.TransactionInformation.Status == TransactionStatus.Active))
					m_trnTransaction.Commit();
			}
			m_booCompleted = true;
		}

		#region IDisposable Members

		private bool m_booDisposed = false;

		/// <summary>
		/// Disposes of the transaction scope, and removes the ambient transaction.
		/// </summary>
		/// <remarks>
		/// This makes sure the transaction is rolled back if the scope hasn't completed.
		/// </remarks>
		protected virtual void Dispose(bool disposing)
		{
			if (!m_booDisposed)
			{
				if (disposing)
				{
					if (!m_booCompleted)
						m_trnTransaction.Rollback();
					if (m_booOwnsTransaction)
						Transaction.Current = null;
				}
				m_booDisposed = true;
			}
		}

		public void Dispose()
		{
			Dispose(true);
		}

		#endregion
	}
}
