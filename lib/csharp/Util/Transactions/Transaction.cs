using System;
using System.Collections.Generic;

namespace Util.Transactions
{
	/// <summary>
	/// The possible options for enlistment.
	/// </summary>
	public enum EnlistmentOptions
	{
		None
	}

	/// <summary>
	/// A transaction.
	/// </summary>
	/// <remarks>
	/// This transaction class has no timeout.
	/// 
	/// This class allows sharing of transactions across threads, as the abient transaction
	/// is not restricted to a single thread.
	/// </remarks>
	public class Transaction : IDisposable
	{
		private static Transaction m_trnAmbient = null;

		/// <summary>
		/// Gets or sets the ambient transaction.
		/// </summary>
		/// <value>The ambient transaction.</value>
		public static Transaction Current
		{
			get
			{
				return m_trnAmbient;
			}
			internal set
			{
				m_trnAmbient = value;
			}
		}

		private List<IEnlistmentNotification> m_lstNotifications = new List<IEnlistmentNotification>();
		private TransactionInformation m_tinInfo = new TransactionInformation();

		/// <summary>
		/// Gets the information about this transaction.
		/// </summary>
		/// <value>The information about this transaction.</value>
		public TransactionInformation TransactionInformation
		{
			get
			{
				return m_tinInfo;
			}
		}
		
		/// <summary>
		/// Enlists a resource manager in this transaction.
		/// </summary>
		/// <param name="p_entNotification">The resource manager to enlist.</param>
		/// <param name="p_eopOptions">The enlistment options. This value must be <see cref="EnlistmentOptions.None"/>.</param>
		/// <exception cref="ArgumentException">Thrown if <paramref name="p_eopOptions"/> is not
		/// <see cref="EnlistmentOptions.None"/>.</exception>
		public void EnlistVolatile(IEnlistmentNotification p_entResourceManager, EnlistmentOptions p_eopOptions)
		{
			if (p_eopOptions != EnlistmentOptions.None)
				throw new ArgumentException("EnlistmentOptions must be None.", "p_eopOptions");

			m_lstNotifications.Add(p_entResourceManager);
		}

		/// <summary>
		/// Prepares the enlisted resource managers for committal.
		/// </summary>
		/// <returns><c>true</c> if all polled participants voted to commit;
		/// <c>false</c> otherwise.</returns>
		internal bool Prepare()
		{
			/*if (TransactionInformation.Status == TransactionStatus.Aborted)
				return false;

			if (TransactionInformation.Status != TransactionStatus.Active)
				throw new TransactionException("Cannot prepare transaction, as it is not active. Trasnaction Status: " + TransactionInformation.Status);
			*/
			bool booVoteToCommit = true;

			PreparingEnlistment lpeEnlistment = null;
			IEnlistmentNotification entNotification = null;
			for (Int32 i = m_lstNotifications.Count - 1; i >= 0; i--)
			{
				entNotification = m_lstNotifications[i];
				lpeEnlistment = new PreparingEnlistment();
				entNotification.Prepare(lpeEnlistment);
				if (lpeEnlistment.VoteToCommit.HasValue)
				{
					booVoteToCommit &= lpeEnlistment.VoteToCommit.Value;
					if (lpeEnlistment.DoneProcessing)
						m_lstNotifications.RemoveAt(i);
				}
				else
				{
					booVoteToCommit = false;
					TransactionInformation.Status = TransactionStatus.InDoubt;
				}
			}
			if (TransactionInformation.Status == TransactionStatus.InDoubt)
				NotifyInDoubt();
			return booVoteToCommit;
		}

		/// <summary>
		/// Tells al participanting resource managers to commit their changes.
		/// </summary>
		internal void Commit()
		{
			if (TransactionInformation.Status != TransactionStatus.Active)
				throw new TransactionException("Cannot commit transaction, as it is not active. Trasnaction Status: " + TransactionInformation.Status);

			PreparingEnlistment lpeEnlistment = null;
			IEnlistmentNotification entNotification = null;
			for (Int32 i = m_lstNotifications.Count - 1; i >= 0; i--)
			{
				entNotification = m_lstNotifications[i];
				lpeEnlistment = new PreparingEnlistment();
				entNotification.Commit(lpeEnlistment);
				if (lpeEnlistment.DoneProcessing)
					m_lstNotifications.RemoveAt(i);
			}
			if (m_lstNotifications.Count > 0)
			{
				TransactionInformation.Status = TransactionStatus.InDoubt;
				NotifyInDoubt();
			}
			else
				TransactionInformation.Status = TransactionStatus.Committed;
		}

		/// <summary>
		/// Tells the participating resource managers that the transaction status is in doubt.
		/// </summary>
		protected void NotifyInDoubt()
		{
			if (TransactionInformation.Status != TransactionStatus.InDoubt)
				return;

			Enlistment eltEnlistment = null;
			IEnlistmentNotification entNotification = null;
			for (Int32 i = m_lstNotifications.Count - 1; i >= 0; i--)
			{
				entNotification = m_lstNotifications[i];
				eltEnlistment = new Enlistment();
				entNotification.InDoubt(eltEnlistment);
				if (eltEnlistment.DoneProcessing)
					m_lstNotifications.RemoveAt(i);
			}
		}

		/// <summary>
		/// Tells the participating resource managers to rollback their changes.
		/// </summary>
		public void Rollback()
		{
			if (TransactionInformation.Status == TransactionStatus.Aborted)
				return;

			List<RollbackException.ExceptedResourceManager> lstExceptions = new List<RollbackException.ExceptedResourceManager>();
			Enlistment eltEnlistment = null;
			IEnlistmentNotification entNotification = null;
			for (Int32 i = m_lstNotifications.Count - 1; i >= 0; i--)
			{
				entNotification = m_lstNotifications[i];
				eltEnlistment = new Enlistment();
				try
				{
					entNotification.Rollback(eltEnlistment);
				}
				catch (Exception e)
				{
					lstExceptions.Add(new RollbackException.ExceptedResourceManager(entNotification, e));
				}
				if (eltEnlistment.DoneProcessing)
					m_lstNotifications.RemoveAt(i);
			}
			if (m_lstNotifications.Count > 0)
			{
				TransactionInformation.Status = TransactionStatus.InDoubt;
				NotifyInDoubt();
			}
			else
				TransactionInformation.Status = TransactionStatus.Aborted;

			if (lstExceptions.Count > 0)
				throw new RollbackException(lstExceptions);
		}

		#region IDisposable Members

		private bool m_booDisposed = false;

		/// <summary>
		/// Disposes of the transaction.
		/// </summary>
		protected virtual void Dispose(bool disposing)
		{
			if (!m_booDisposed)
			{
				if (disposing)
				{
					if (TransactionInformation.Status == TransactionStatus.Active)
						Rollback();

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
